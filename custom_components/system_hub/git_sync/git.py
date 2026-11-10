"""Thin async wrapper around the git command line."""

from __future__ import annotations

import asyncio
import fnmatch
import logging
import os
import re
import shlex
import shutil
import tempfile
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit, urlunsplit

from .const import (
    CHANGED_FILES_MAX,
    DIFF_FILE_MAX_LINES,
    DIFF_MAX_CHARS,
    DIFF_MAX_FILES,
    FETCH_TIMEOUT,
    GIT_TIMEOUT,
    GITIGNORE_REQUIRED,
    SENSITIVE_FOLDERS,
    SENSITIVE_NAMES,
)

_LOGGER = logging.getLogger(__name__)

# "scheme://user:password@host": the userinfo of a URL, e.g. an HTTPS remote carrying a token.
_URL_USERINFO = re.compile(r"([a-zA-Z][a-zA-Z0-9+.-]*://)[^/@\s'\"]+@")


def redact_credentials(text: str) -> str:
    """Remove the user and password of every URL in a message (git errors, logs)."""
    return _URL_USERINFO.sub(r"\1", text)


def redact_url(url: str | None) -> str | None:
    """Return a remote URL without its user and password ("https://token@host/…" → "https://host/…").

    scp-like SSH remotes ("git@github.com:me/repo.git") carry no secret and are kept as they are.
    """
    if not url or "://" not in url:
        return url
    parts = urlsplit(url)
    if "@" not in parts.netloc:
        return url
    return urlunsplit(parts._replace(netloc=parts.netloc.rpartition("@")[2]))


# A "key: value" (YAML, also as a "- key: value" list item) or "key": "value" / key = value line whose key names a
# secret, in a patch line (+, - or space). "pin" only as a whole word of the key ("pin", "door_pin", not "pinned").
_SECRET_LINE = re.compile(
    r"""^(?P<head>[-+ ]\s*(?:-\s+)?["']?(?:[\w.-]*"""
    r"(?:password|passwd|token|api[-_]?key|apikey|client_secret|secret|private_key|authorization|bearer)"
    r"""[\w.-]*|(?:[\w.-]*[_.-])?pin(?:[_.-][\w.-]*)?)["']?\s*[:=]\s*)"""
    r"(?P<value>.+)$",
    re.IGNORECASE,
)
# An HTTP bearer credential anywhere in a line ("Authorization: Bearer eyJ…", headers in a JSON string).
_BEARER = re.compile(r"(\bBearer\s+)[^\s\"',}]+", re.IGNORECASE)


def redact_secrets(patch: str) -> str:
    """Hide the value of the secret-looking keys of a patch ("password: x" → "password: <redacted>").

    A reference to secrets.yaml ("password: !secret wifi") carries no secret and is kept.
    """
    lines = []
    for line in patch.split("\n"):
        match = _SECRET_LINE.match(line)
        value = match.group("value").strip() if match else ""
        if match and value and not value.startswith("!secret") and value not in ("{", "[", "|", ">"):
            lines.append(f"{match.group('head')}<redacted>")
        else:
            lines.append(_BEARER.sub(r"\1<redacted>", line))
    return "\n".join(lines)


def is_sensitive(path: str) -> bool:
    """Return True for a file that must not be committed: secrets, auth storage, keys, database, logs."""
    parts = path.split("/")
    if any(part in SENSITIVE_FOLDERS for part in parts[:-1]):
        return True
    return any(fnmatch.fnmatch(parts[-1], pattern) for pattern in SENSITIVE_NAMES)


def blocked_sensitive(changes: list[tuple[str, str]], *, allow_tracked: bool) -> list[str]:
    """Return the sensitive files among (status, path) changes that a commit must refuse.

    A new file (A) is always refused; a change to a tracked one only unless `allow_tracked`. A deletion removes the
    file from the repository and is allowed.
    """
    return [
        path
        for status, path in changes
        if is_sensitive(path) and status != "D" and (status == "A" or not allow_tracked)
    ]


def append_gitignore(repo_path: str, lines: list[str]) -> None:
    """Append lines to the .gitignore of a repository (created when missing). Runs in the executor."""
    gitignore = Path(repo_path, ".gitignore")
    current = gitignore.read_text(encoding="utf-8") if gitignore.exists() else ""
    prefix = "" if not current or current.endswith("\n") else "\n"
    with gitignore.open("a", encoding="utf-8") as file:
        file.write(prefix + "# Added by Git Sync: never commit secrets\n" + "".join(f"{line}\n" for line in lines))


class GitError(Exception):
    """Raised when a git command fails."""


class RebaseConflictError(GitError):
    """Raised when `git pull --rebase` stops on a conflict (the rebase is aborted)."""


@dataclass(slots=True)
class GitStatus:
    """Parsed result of `git status --porcelain=v1 --branch`."""

    branch: str | None = None
    upstream: str | None = None
    ahead: int = 0
    behind: int = 0
    files: list[str] = field(default_factory=list)
    unborn: bool = False

    @property
    def dirty(self) -> bool:
        """Return True when the working tree has changes."""
        return bool(self.files)

    @property
    def detached(self) -> bool:
        """Return True when HEAD is not on a branch."""
        return self.branch is None or self.branch.startswith("HEAD ")

    @property
    def diverged(self) -> bool:
        """Return True when both the local branch and its upstream have commits the other lacks."""
        return bool(self.ahead and self.behind)

    @property
    def push_pending(self) -> bool:
        """Return True when commits are waiting to be pushed.

        A branch without upstream (set up with `git remote add`, never pushed with `-u`) counts as pending:
        nothing tells it is on the remote, and the push sets the upstream.
        """
        if self.ahead:
            return True
        return self.upstream is None and not self.detached and not self.unborn


@dataclass(slots=True)
class GitCommit:
    """A commit as reported by `git log`."""

    sha: str
    message: str
    timestamp: int


@dataclass(slots=True)
class StagedDiff:
    """Staged changes: per-file stats and a truncated patch."""

    stat: str
    patch: str
    files: int

    def as_prompt(self) -> str:
        """Return the diff in the format sent to the AI task, without the values of secret-looking keys."""
        return f"{self.stat}\n===DIFF===\n{redact_secrets(self.patch)}"


@dataclass(slots=True)
class DiffLine:
    """One line of a hunk: context, addition or deletion, with its line numbers on both sides."""

    kind: str  # "context", "add" or "del"
    old: int | None
    new: int | None
    text: str

    def as_dict(self) -> dict[str, Any]:
        """Return the line as sent to the card."""
        return {"kind": self.kind, "old": self.old, "new": self.new, "text": self.text}


@dataclass(slots=True)
class DiffHunk:
    """A hunk of a file diff: its `@@` header and lines."""

    header: str
    lines: list[DiffLine] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        """Return the hunk as sent to the card."""
        return {"header": self.header, "lines": [line.as_dict() for line in self.lines]}


@dataclass(slots=True)
class FileDiff:
    """The diff of one file, as the card's viewer shows it (file by file, like an editor)."""

    path: str
    status: str = "modified"  # added, modified, deleted, renamed, copied, mode
    old_path: str | None = None
    binary: bool = False
    additions: int = 0
    deletions: int = 0
    hunks: list[DiffHunk] = field(default_factory=list)
    # Lines of the patch left out once DIFF_FILE_MAX_LINES was reached (0: the whole patch is there).
    truncated: int = 0

    def as_dict(self) -> dict[str, Any]:
        """Return the file as sent to the card."""
        return {
            "path": self.path,
            "status": self.status,
            "old_path": self.old_path,
            "binary": self.binary,
            "additions": self.additions,
            "deletions": self.deletions,
            "hunks": [hunk.as_dict() for hunk in self.hunks],
            "truncated": self.truncated,
        }


@dataclass(slots=True)
class WorkTreeDiff:
    """Every change a commit would include, file by file."""

    files: list[FileDiff] = field(default_factory=list)
    # Files past DIFF_MAX_FILES, counted but not sent.
    more_files: int = 0

    @property
    def additions(self) -> int:
        """Lines added over every file sent."""
        return sum(f.additions for f in self.files)

    @property
    def deletions(self) -> int:
        """Lines removed over every file sent."""
        return sum(f.deletions for f in self.files)

    def as_dict(self) -> dict[str, Any]:
        """Return the diff as sent to the card."""
        return {
            "files": [f.as_dict() for f in self.files],
            "more_files": self.more_files,
            "additions": self.additions,
            "deletions": self.deletions,
        }


class GitRepo:
    """Run git commands against one working tree."""

    def __init__(
        self,
        path: str,
        *,
        remote: str,
        branch: str,
        ssh_key: str,
        author_name: str,
        author_email: str,
    ) -> None:
        """Store the repository settings."""
        self.path = path
        self.remote = remote
        self.branch = branch
        self.ssh_key = ssh_key
        self.author_name = author_name
        self.author_email = author_email

    # ------------------------------------------------------------------ helpers

    def _env(self) -> dict[str, str]:
        env = dict(os.environ)
        env["GIT_TERMINAL_PROMPT"] = "0"
        env["LC_ALL"] = "C"
        # The status polling runs outside the commit lock: it must not take index.lock to refresh the index,
        # or a concurrent `git add -A` fails with "Unable to create '.git/index.lock': File exists".
        env["GIT_OPTIONAL_LOCKS"] = "0"
        if self.ssh_key:
            key = Path(self.ssh_key)
            known_hosts = key.parent / "known_hosts"
            env["GIT_SSH_COMMAND"] = (
                f"ssh -i {shlex.quote(str(key))} -o IdentitiesOnly=yes "
                f"-o StrictHostKeyChecking=accept-new -o BatchMode=yes "
                f"-o UserKnownHostsFile={shlex.quote(str(known_hosts))}"
            )
        return env

    def _base_args(self) -> list[str]:
        args = ["git", "-C", self.path, "-c", f"safe.directory={self.path}"]
        if self.author_name:
            args += ["-c", f"user.name={self.author_name}"]
        if self.author_email:
            args += ["-c", f"user.email={self.author_email}"]
        return args

    async def run(
        self, *args: str, check: bool = True, env: dict[str, str] | None = None, timeout: float = GIT_TIMEOUT
    ) -> tuple[int, str]:
        """Run a git sub-command and return (returncode, stdout)."""
        cmd = [*self._base_args(), *args]
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env={**self._env(), **(env or {})},
        )
        try:
            out, err = await asyncio.wait_for(proc.communicate(), timeout)
        except TimeoutError as exc:
            proc.kill()
            await proc.wait()
            raise GitError(f"git {args[0]} timed out after {timeout:g}s") from exc

        stdout = out.decode(errors="replace")
        if check and proc.returncode != 0:
            message = err.decode(errors="replace").strip() or stdout.strip()
            raise GitError(redact_credentials(f"git {args[0]} failed: {message}"))
        return proc.returncode or 0, stdout

    # ------------------------------------------------------------------ queries

    async def is_repository(self) -> bool:
        """Return True when the path is inside a git work tree."""
        try:
            code, out = await self.run("rev-parse", "--is-inside-work-tree", check=False)
        except (OSError, GitError):
            return False
        return code == 0 and out.strip() == "true"

    async def has_identity(self) -> bool:
        """Return True when git can sign a commit here (author settings, repository, global config or host)."""
        try:
            code, _ = await self.run("var", "GIT_COMMITTER_IDENT", check=False)
        except (OSError, GitError):
            return False
        return code == 0

    async def valid_branch(self) -> bool:
        """Return True when no target branch is set, or when git accepts its name as a branch."""
        if not self.branch:
            return True
        try:
            code, _ = await self.run("check-ref-format", "--branch", self.branch, check=False)
        except (OSError, GitError):
            return False
        return code == 0

    async def remote_url(self) -> str | None:
        """Return the URL of the configured remote."""
        code, out = await self.run("remote", "get-url", self.remote, check=False)
        return out.strip() if code == 0 else None

    async def status(self) -> GitStatus:
        """Return branch, upstream divergence and changed files."""
        # -z: paths as they are, never quoted or escaped (non-ASCII names, spaces, quotes).
        _, out = await self.run("status", "--porcelain=v1", "-z", "--branch", "--untracked-files=all")
        status = GitStatus()
        entries = iter(out.split("\0"))
        for entry in entries:
            if entry.startswith("## "):
                _parse_branch_line(entry[3:], status)
            elif len(entry) > 3:
                status.files.append(entry[3:])
                if entry[0] in "RC":
                    # A rename or copy is followed by its original path.
                    next(entries, None)
        return status

    async def gitignore_missing(self) -> list[str]:
        """Return the .gitignore lines needed so that secrets.yaml and .storage are never committed."""
        missing = []
        for probe, line in GITIGNORE_REQUIRED:
            # --no-index: the rules count, even for a file already tracked.
            code, _ = await self.run("check-ignore", "--no-index", "-q", probe, check=False)
            if code == 1:
                missing.append(line)
        return missing

    async def last_commit(self) -> GitCommit | None:
        """Return the HEAD commit, or None on an empty repository."""
        code, out = await self.run("log", "-1", "--format=%H%x1f%s%x1f%ct", check=False)
        if code != 0 or not out.strip():
            return None
        sha, message, timestamp = out.strip().split("\x1f", 2)
        return GitCommit(sha=sha, message=message, timestamp=int(timestamp))

    # ------------------------------------------------------------------ actions

    async def stage_all(self) -> StagedDiff | None:
        """Stage every change and return the staged diff, None if nothing staged."""
        await self.run("add", "-A")
        return await self._staged_diff()

    @asynccontextmanager
    async def _preview_index(self) -> AsyncIterator[dict[str, str]]:
        """Stage every change in a copy of the index and yield the env pointing git at it.

        `git add -A` runs against the copy (GIT_INDEX_FILE), so nothing the user staged changes.
        """
        _, index = await self.run("rev-parse", "--git-path", "index")
        index_path = Path(self.path, index.strip())
        tmp = await asyncio.to_thread(tempfile.mkdtemp, prefix="git_sync_")
        try:
            env = {"GIT_INDEX_FILE": str(Path(tmp, "index"))}
            if await asyncio.to_thread(index_path.is_file):
                await asyncio.to_thread(shutil.copyfile, index_path, env["GIT_INDEX_FILE"])
            await self.run("add", "-A", env=env)
            yield env
        finally:
            await asyncio.to_thread(shutil.rmtree, tmp, True)

    async def preview_diff(self) -> StagedDiff | None:
        """Return the diff a commit would have, without touching the real index."""
        async with self._preview_index() as env:
            return await self._staged_diff(env)

    async def preview_changes(self) -> list[tuple[str, str]]:
        """Return (status, path) of every change a commit would include, without touching the real index.

        No rename detection: a renamed file is a deletion (D) and an addition (A).
        """
        async with self._preview_index() as env:
            return await self.staged_changes(env)

    async def staged_changes(self, env: dict[str, str] | None = None) -> list[tuple[str, str]]:
        """Return (status, path) of every change staged in the index (the real one unless `env` points elsewhere)."""
        _, out = await self.run("diff", "--cached", "--name-status", "--no-renames", "-z", env=env)
        fields = [f for f in out.split("\0") if f]
        return [(fields[i][0], fields[i + 1]) for i in range(0, len(fields) - 1, 2)]

    async def unstage_all(self) -> None:
        """Empty the index back to HEAD, leaving the work tree untouched."""
        await self.run("reset", "--quiet")

    async def preview_files(self) -> WorkTreeDiff:
        """Return the diff a commit would have, file by file, without touching the real index."""
        async with self._preview_index() as env:
            code, _ = await self.run("diff", "--cached", "--quiet", check=False, env=env)
            if code == 0:
                return WorkTreeDiff()
            # No colour, no external diff, no renames hidden behind a similarity index: one patch per file.
            _, patch = await self.run(
                "-c",
                "core.quotePath=false",
                "diff",
                "--cached",
                "--no-color",
                "--no-ext-diff",
                "--find-renames",
                "--src-prefix=a/",
                "--dst-prefix=b/",
                env=env,
            )
        return parse_patch(patch)

    async def _staged_diff(self, env: dict[str, str] | None = None) -> StagedDiff | None:
        code, _ = await self.run("diff", "--cached", "--quiet", check=False, env=env)
        if code == 0:
            return None
        _, stat = await self.run("diff", "--cached", "--stat", env=env)
        _, names = await self.run("diff", "--cached", "--name-only", env=env)
        _, patch = await self.run("diff", "--cached", env=env)
        return StagedDiff(
            stat=stat.strip(),
            patch=patch[:DIFF_MAX_CHARS],
            files=len([n for n in names.splitlines() if n.strip()]),
        )

    async def commit(self, message: str) -> None:
        """Commit the staged changes."""
        await self.run("commit", "--quiet", "-m", message)

    async def fetch(self) -> None:
        """Update the remote-tracking branches, so that the status counts the commits behind."""
        await self.run("fetch", "--quiet", "--no-tags", self.remote, timeout=FETCH_TIMEOUT)

    async def pull_ff_only(self) -> None:
        """Fast-forward to the upstream; git refuses when it would overwrite a local change."""
        await self.run("pull", "--ff-only", "--quiet", "--no-tags")

    async def pull_rebase(self) -> None:
        """Rebase the local commits on the upstream; on a conflict, abort and raise RebaseConflictError."""
        try:
            await self.run("pull", "--rebase", "--autostash", "--quiet", "--no-tags")
        except GitError:
            for name in ("rebase-merge", "rebase-apply"):
                _, path = await self.run("rev-parse", "--git-path", name)
                if await asyncio.to_thread(Path(self.path, path.strip()).exists):
                    await self.run("rebase", "--abort")
                    raise RebaseConflictError(
                        "git pull --rebase stopped on a conflict: the rebase was aborted, nothing was pushed"
                    ) from None
            raise

    async def push(self) -> None:
        """Push the current branch to the configured remote.

        A branch without upstream (`git remote add` without `push -u`) gets one, so that the next statuses
        count the commits waiting to be pushed.
        """
        status = await self.status()
        args = ["push", "--quiet"]
        if status.upstream is None and not status.detached:
            args.append("--set-upstream")
        args.append(self.remote)
        if self.branch:
            args.append(f"HEAD:{self.branch}")
        elif status.upstream is None:
            args.append("HEAD")
        await self.run(*args)


def _parse_branch_line(line: str, status: GitStatus) -> None:
    """Parse the `## branch...upstream [ahead N, behind M]` header."""
    head, _, tracking = line.partition(" [")
    if head.startswith("No commits yet on "):
        status.branch = head.removeprefix("No commits yet on ")
        status.unborn = True
        return
    branch, _, upstream = head.partition("...")
    status.branch = branch or None
    status.upstream = upstream or None
    for part in tracking.rstrip("]").split(","):
        key, _, value = part.strip().partition(" ")
        if key == "ahead" and value.isdigit():
            status.ahead = int(value)
        elif key == "behind" and value.isdigit():
            status.behind = int(value)


_HUNK_HEADER = re.compile(r"^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@")


def _split_git_header(rest: str) -> str | None:
    """Return the path of a `diff --git a/X b/X` line, None when the two halves differ (a rename)."""
    # A path with spaces is not quoted: try every split where both halves name the same file.
    for i, char in enumerate(rest):
        if char != " " or not rest.startswith("a/") or not rest[i + 1 :].startswith("b/"):
            continue
        if rest[2:i] == rest[i + 3 :]:
            return rest[2:i]
    return None


def parse_patch(patch: str, *, max_lines: int = DIFF_FILE_MAX_LINES, max_files: int = DIFF_MAX_FILES) -> WorkTreeDiff:
    """Parse a unified git patch into one FileDiff per file.

    Each file keeps at most `max_lines` hunk lines (the rest is counted in `truncated`), and the result keeps
    at most `max_files` files (the rest is counted in `more_files`).
    """
    result = WorkTreeDiff()
    current: FileDiff | None = None
    hunk: DiffHunk | None = None
    old = new = 0
    kept = 0

    def close() -> None:
        nonlocal current, hunk, kept
        if current is None:
            return
        if len(result.files) < max_files:
            result.files.append(current)
        else:
            result.more_files += 1
        current = hunk = None
        kept = 0

    for line in patch.splitlines():
        if line.startswith("diff --git "):
            close()
            path = _split_git_header(line[len("diff --git ") :])
            current = FileDiff(path=path or "")
            continue
        if current is None:
            continue
        if hunk is None:
            # File header lines, before the first hunk.
            if line.startswith("new file mode"):
                current.status = "added"
            elif line.startswith("deleted file mode"):
                current.status = "deleted"
            elif line.startswith(("old mode", "new mode")) and current.status == "modified":
                current.status = "mode"
            elif line.startswith("rename from "):
                current.status = "renamed"
                current.old_path = line[len("rename from ") :]
            elif line.startswith("rename to "):
                current.path = line[len("rename to ") :]
            elif line.startswith("copy from "):
                current.status = "copied"
                current.old_path = line[len("copy from ") :]
            elif line.startswith("copy to "):
                current.path = line[len("copy to ") :]
            elif line.startswith("Binary files "):
                current.binary = True
            elif line.startswith("--- ") and line != "--- /dev/null" and not current.old_path:
                current.old_path = line[len("--- a/") :] if line.startswith("--- a/") else line[4:]
            elif line.startswith("+++ ") and line != "+++ /dev/null":
                current.path = line[len("+++ b/") :] if line.startswith("+++ b/") else line[4:]
        if match := _HUNK_HEADER.match(line):
            old, new = int(match.group(1)), int(match.group(2))
            hunk = DiffHunk(header=line)
            if kept < max_lines:
                current.hunks.append(hunk)
            continue
        if hunk is None or not line:
            continue
        sign, text = line[0], line[1:]
        if sign == "\\":
            # "\ No newline at end of file": not a line of the file.
            continue
        if sign == "+":
            current.additions += 1
            entry = DiffLine("add", None, new, text)
            new += 1
        elif sign == "-":
            current.deletions += 1
            entry = DiffLine("del", old, None, text)
            old += 1
        elif sign == " ":
            entry = DiffLine("context", old, new, text)
            old += 1
            new += 1
        else:
            continue
        if kept < max_lines:
            hunk.lines.append(entry)
            kept += 1
        else:
            current.truncated += 1
    close()
    # A modified file that is not a rename keeps a single path; the old path is only for renames and copies.
    for file in result.files:
        if file.status not in ("renamed", "copied"):
            file.old_path = None
    return result


def truncate_files(files: list[str]) -> list[str]:
    """Limit the changed file list exposed as an attribute."""
    return files[:CHANGED_FILES_MAX]


async def generate_ssh_key(key_path: str) -> str:
    """Create an ed25519 key pair if missing and return the public key."""
    key = Path(key_path)
    pub = key.with_name(key.name + ".pub")
    if not await asyncio.to_thread(key.exists):
        await asyncio.to_thread(key.parent.mkdir, mode=0o700, parents=True, exist_ok=True)
        proc = await asyncio.create_subprocess_exec(
            "ssh-keygen",
            "-t",
            "ed25519",
            "-C",
            "homeassistant",
            "-f",
            str(key),
            "-N",
            "",
            "-q",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, err = await proc.communicate()
        if proc.returncode != 0:
            raise GitError(f"ssh-keygen failed: {err.decode(errors='replace').strip()}")
        _LOGGER.info("Generated SSH key %s", key)
    content = await asyncio.to_thread(pub.read_text, encoding="utf-8")
    return content.strip()
