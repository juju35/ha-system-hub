"""Tests for the git wrapper and the dashboard export."""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path

import pytest

from custom_components.system_hub.git_sync.coordinator import sanitize_message
from custom_components.system_hub.git_sync.export import export_dashboards
from custom_components.system_hub.git_sync.git import (
    GitError,
    GitRepo,
    GitStatus,
    _parse_branch_line,
    parse_patch,
    redact_credentials,
    redact_url,
)

from .conftest import clone, git, push_from


def _repo(path: Path) -> GitRepo:
    return GitRepo(str(path), remote="origin", branch="", ssh_key="", author_name="", author_email="")


def test_parse_branch_line() -> None:
    status = GitStatus()
    _parse_branch_line("main...origin/main [ahead 2, behind 1]", status)
    assert (status.branch, status.upstream, status.ahead, status.behind) == ("main", "origin/main", 2, 1)


def test_sanitize_message() -> None:
    raw = '\n  feat: add `light.salon` $automation "x".\nsecond line'
    assert sanitize_message(raw) == "feat: add light.salon automation x"
    assert len(sanitize_message("x" * 300)) == 100


async def test_status_commit_push(repo: Path) -> None:
    git_repo = _repo(repo)
    assert await git_repo.is_repository()

    status = await git_repo.status()
    assert status.branch == "main"
    assert not status.dirty

    (repo / "automations.yaml").write_text("[]\n", encoding="utf-8")
    status = await git_repo.status()
    assert status.files == ["automations.yaml"]

    diff = await git_repo.stage_all()
    assert diff is not None
    assert diff.files == 1
    assert "===DIFF===" in diff.as_prompt()

    await git_repo.commit("feat: add automations")
    await git_repo.push()
    status = await git_repo.status()
    assert not status.dirty
    assert status.ahead == 0
    assert git(repo, "log", "-1", "--format=%s", "origin/main").strip() == "feat: add automations"
    assert await git_repo.stage_all() is None


def test_export_dashboards(tmp_path: Path) -> None:
    storage = tmp_path / ".storage"
    storage.mkdir()
    (storage / "lovelace").write_text(
        json.dumps({"version": 1, "key": "lovelace", "data": {"config": {"views": [{"title": "Home"}]}}}),
        encoding="utf-8",
    )
    (storage / "core.config").write_text("{}", encoding="utf-8")
    out = tmp_path / "export"

    result = export_dashboards(str(storage), str(out), "both")
    assert result.files == ["lovelace", "lovelace.yaml"]
    assert list(result.managed) == ["lovelace", "lovelace.yaml"]
    assert "title: Home" in (out / "lovelace.yaml").read_text(encoding="utf-8")
    assert not (out / "core.config").exists()


@pytest.mark.parametrize("branch", ["", "main"])
async def test_first_push_sets_the_upstream(fresh_repo: Path, branch: str) -> None:
    """The README setup (no `push -u`): the first push works and tracks the remote branch."""
    git_repo = GitRepo(str(fresh_repo), remote="origin", branch=branch, ssh_key="", author_name="", author_email="")
    status = await git_repo.status()
    assert status.upstream is None
    assert status.push_pending

    await git_repo.push()
    status = await git_repo.status()
    assert status.upstream == "origin/main"
    assert not status.push_pending
    assert git(fresh_repo, "log", "-1", "--format=%s", "origin/main").strip() == "chore: initial"

    # The next commit is seen as a pending push.
    (fresh_repo / "scripts.yaml").write_text("{}\n", encoding="utf-8")
    await git_repo.stage_all()
    await git_repo.commit("feat: add scripts")
    status = await git_repo.status()
    assert status.ahead == 1
    assert status.push_pending


async def test_detached_head_is_not_a_pending_push(repo: Path) -> None:
    git(repo, "checkout", "-q", "--detach")
    status = await _repo(repo).status()
    assert status.upstream is None
    assert not status.push_pending


async def test_status_does_not_rewrite_the_index(repo: Path) -> None:
    """Polling `git status` must not take index.lock, or a concurrent `git add` fails on it."""
    index = repo / ".git" / "index"
    tracked = repo / "configuration.yaml"
    before = index.stat().st_mtime_ns
    # Same content, new mtime: a plain `git status` refreshes the stat data and rewrites the index.
    os.utime(tracked, ns=(tracked.stat().st_atime_ns, tracked.stat().st_mtime_ns + 5_000_000_000))
    await _repo(repo).status()
    assert index.stat().st_mtime_ns == before
    assert _repo(repo)._env()["GIT_OPTIONAL_LOCKS"] == "0"


def test_redact_credentials() -> None:
    assert redact_url("https://user:ghp_secret@github.com/me/ha.git") == "https://github.com/me/ha.git"
    assert redact_url("https://ghp_secret@github.com/me/ha.git") == "https://github.com/me/ha.git"
    assert redact_url("git@github.com:me/ha.git") == "git@github.com:me/ha.git"
    assert redact_url("ssh://git@github.com:22/me/ha.git") == "ssh://github.com:22/me/ha.git"
    assert redact_url(None) is None
    assert (
        redact_credentials("fatal: repository 'https://u:tok@example.com/r.git/' not found")
        == "fatal: repository 'https://example.com/r.git/' not found"
    )


async def test_git_errors_hide_the_token(repo: Path) -> None:
    """A git error quoting a URL with credentials reaches last_error and the logs without them."""
    with pytest.raises(GitError) as err:
        await _repo(repo).run("checkout", "https://user:ghp_secret@github.com/me/ha.git")
    assert "github.com/me/ha.git" in str(err.value)
    assert "ghp_secret" not in str(err.value)


def _storage(tmp_path: Path, *names: str) -> Path:
    storage = tmp_path / ".storage"
    storage.mkdir(exist_ok=True)
    for name in names:
        (storage / name).write_text(
            json.dumps({"version": 1, "key": name, "data": {"config": {"views": [{"title": name}]}}}),
            encoding="utf-8",
        )
    return storage


def test_export_removes_stale_files(tmp_path: Path) -> None:
    """A deleted dashboard, or a json→yaml switch, does not leave its old file behind."""
    storage = _storage(tmp_path, "lovelace", "lovelace.old")
    out = tmp_path / "export"
    (out).mkdir()
    (out / "README.md").write_text("mine\n", encoding="utf-8")

    first = export_dashboards(str(storage), str(out), "both")
    assert first.files == [
        "lovelace",
        "lovelace.yaml",
        "lovelace.old",
        "lovelace.old.yaml",
    ]
    (storage / "lovelace.old").unlink()
    assert export_dashboards(str(storage), str(out), "yaml", first.managed).files == ["lovelace.yaml"]
    assert sorted(p.name for p in out.iterdir()) == ["README.md", "lovelace.yaml"]


def test_export_keeps_the_yaml_of_an_unreadable_dashboard(tmp_path: Path) -> None:
    storage = _storage(tmp_path, "lovelace")
    out = tmp_path / "export"
    first = export_dashboards(str(storage), str(out), "yaml")
    (storage / "lovelace").write_text("{not json", encoding="utf-8")
    second = export_dashboards(str(storage), str(out), "yaml", first.managed)
    assert second.files == []
    assert (out / "lovelace.yaml").exists()
    # Still the integration's file: removed once the dashboard is gone for good.
    assert list(second.managed) == ["lovelace.yaml"]
    (storage / "lovelace").unlink()
    export_dashboards(str(storage), str(out), "yaml", second.managed)
    assert not (out / "lovelace.yaml").exists()


def test_export_into_the_storage_folder_deletes_nothing(tmp_path: Path) -> None:
    storage = _storage(tmp_path, "lovelace")
    first = export_dashboards(str(storage), str(storage), "yaml")
    export_dashboards(str(storage), str(storage), "json", first.managed)
    assert (storage / "lovelace").exists()
    assert (storage / "lovelace.yaml").exists()


def test_export_keeps_the_users_own_lovelace_files(tmp_path: Path) -> None:
    """Files of the export folder the integration did not write (YAML-mode dashboards) are never deleted."""
    storage = _storage(tmp_path, "lovelace")
    out = tmp_path / "export"
    out.mkdir()
    (out / "lovelace-energy.yaml").write_text("views: []\n", encoding="utf-8")
    (out / "lovelace_tablet.yaml").write_text("views: []\n", encoding="utf-8")

    export_dashboards(str(storage), str(out), "json")
    export_dashboards(str(storage), str(out), "yaml")
    assert sorted(p.name for p in out.iterdir()) == [
        "lovelace",
        "lovelace-energy.yaml",
        "lovelace.yaml",
        "lovelace_tablet.yaml",
    ]


def test_export_deletes_only_its_own_stale_files(tmp_path: Path) -> None:
    """json → yaml: the integration's old JSON goes, the user's files and names outside the folder stay."""
    storage = _storage(tmp_path, "lovelace")
    out = tmp_path / "export"
    out.mkdir()
    (out / "lovelace-energy.yaml").write_text("views: []\n", encoding="utf-8")
    (tmp_path / "lovelace.secret").write_text("x\n", encoding="utf-8")

    first = export_dashboards(str(storage), str(out), "json")
    assert list(first.managed) == ["lovelace"]
    # A tampered manifest cannot reach outside the folder nor a file that is not a dashboard export.
    (out / "README.md").write_text("x\n", encoding="utf-8")
    digest = hashlib.sha256(b"x\n").hexdigest()  # matching hashes: only the name checks stop the deletion
    tampered = {**first.managed, "../lovelace.secret": digest, "README.md": digest}
    export_dashboards(str(storage), str(out), "yaml", tampered)
    assert sorted(p.name for p in out.iterdir()) == ["README.md", "lovelace-energy.yaml", "lovelace.yaml"]
    assert (tmp_path / "lovelace.secret").exists()


async def test_status_lists_non_ascii_names_as_is(repo: Path) -> None:
    """`git status` quotes non-ASCII paths by default ("\\303\\251t\\303\\251.yaml"): the names stay readable."""
    (repo / "été.yaml").write_text("{}\n", encoding="utf-8")
    (repo / "with space.yaml").write_text("{}\n", encoding="utf-8")
    status = await _repo(repo).status()
    assert sorted(status.files) == ["with space.yaml", "été.yaml"]


async def test_status_with_a_staged_rename(repo: Path) -> None:
    """A rename left staged (failed commit) counts once, under its new name."""
    git(repo, "mv", "configuration.yaml", "configuration é.yaml")
    status = await _repo(repo).status()
    assert status.files == ["configuration é.yaml"]
    assert status.branch == "main"
    assert status.upstream == "origin/main"


def test_export_spares_an_exported_file_the_user_changed(tmp_path: Path) -> None:
    """An exported YAML reused and edited by the user (YAML-mode dashboard) survives its dashboard's deletion."""
    storage = _storage(tmp_path, "lovelace", "lovelace.dashboard_x")
    out = tmp_path / "export"
    first = export_dashboards(str(storage), str(out), "yaml")
    (out / "lovelace.dashboard_x.yaml").write_text("views: [{title: Mine}]\n", encoding="utf-8")
    (storage / "lovelace.dashboard_x").unlink()

    second = export_dashboards(str(storage), str(out), "yaml", first.managed)
    assert (out / "lovelace.dashboard_x.yaml").read_text(encoding="utf-8") == "views: [{title: Mine}]\n"
    # No longer the integration's file: never deleted later either.
    assert set(second.managed) == {"lovelace.yaml"}


def test_export_deletes_its_unchanged_stale_file(tmp_path: Path) -> None:
    """The hash check still lets an untouched file of a deleted dashboard go."""
    storage = _storage(tmp_path, "lovelace", "lovelace.old")
    out = tmp_path / "export"
    first = export_dashboards(str(storage), str(out), "both")
    (storage / "lovelace.old").unlink()
    export_dashboards(str(storage), str(out), "both", first.managed)
    assert sorted(p.name for p in out.iterdir()) == ["lovelace", "lovelace.yaml"]


def test_export_does_not_overwrite_a_users_file(tmp_path: Path) -> None:
    """A file of the user named like an export (lovelace_resources.yaml) is not overwritten."""
    storage = _storage(tmp_path, "lovelace", "lovelace_resources")
    out = tmp_path / "export"
    out.mkdir()
    (out / "lovelace_resources.yaml").write_text("mine: true\n", encoding="utf-8")

    result = export_dashboards(str(storage), str(out), "yaml")
    assert (out / "lovelace_resources.yaml").read_text(encoding="utf-8") == "mine: true\n"
    assert result.files == ["lovelace.yaml"]
    assert result.skipped == ["lovelace_resources.yaml"]
    assert set(result.managed) == {"lovelace.yaml"}
    # Once the export owns a file, it keeps it up to date, even if the user edited it.
    (out / "lovelace.yaml").write_text("edited\n", encoding="utf-8")
    again = export_dashboards(str(storage), str(out), "yaml", result.managed)
    assert "title: lovelace" in (out / "lovelace.yaml").read_text(encoding="utf-8")
    assert again.skipped == ["lovelace_resources.yaml"]


def test_export_adopts_the_files_of_an_older_version(tmp_path: Path) -> None:
    """First export after an update from a version without manifest: its own old files are refreshed."""
    storage = _storage(tmp_path, "lovelace")
    out = tmp_path / "export"
    out.mkdir()
    (out / "lovelace.yaml").write_text("views: []\n", encoding="utf-8")
    result = export_dashboards(str(storage), str(out), "yaml", adopt=True)
    assert result.skipped == []
    assert "title: lovelace" in (out / "lovelace.yaml").read_text(encoding="utf-8")


def test_parse_patch_file_by_file() -> None:
    patch = """diff --git a/configuration.yaml b/configuration.yaml
index 1111111..2222222 100644
--- a/configuration.yaml
+++ b/configuration.yaml
@@ -1,3 +1,4 @@ homeassistant:
 default_config:
-logger: info
+logger: debug
+recorder:
 frontend:
\\ No newline at end of file
diff --git a/my notes.txt b/my notes.txt
new file mode 100644
index 0000000..3333333
--- /dev/null
+++ b/my notes.txt
@@ -0,0 +1 @@
+hello
diff --git a/old.yaml b/new.yaml
similarity index 100%
rename from old.yaml
rename to new.yaml
diff --git a/gone.yaml b/gone.yaml
deleted file mode 100644
index 4444444..0000000
--- a/gone.yaml
+++ /dev/null
@@ -1 +0,0 @@
-bye
diff --git a/icon.png b/icon.png
new file mode 100644
index 0000000..5555555
Binary files /dev/null and b/icon.png differ
diff --git a/run.sh b/run.sh
old mode 100644
new mode 100755
"""
    result = parse_patch(patch)
    assert [(f.path, f.status) for f in result.files] == [
        ("configuration.yaml", "modified"),
        ("my notes.txt", "added"),
        ("new.yaml", "renamed"),
        ("gone.yaml", "deleted"),
        ("icon.png", "added"),
        ("run.sh", "mode"),
    ]
    first = result.files[0]
    assert (first.additions, first.deletions, first.old_path) == (2, 1, None)
    assert first.hunks[0].header == "@@ -1,3 +1,4 @@ homeassistant:"
    assert [(line.kind, line.old, line.new, line.text) for line in first.hunks[0].lines] == [
        ("context", 1, 1, "default_config:"),
        ("del", 2, None, "logger: info"),
        ("add", None, 2, "logger: debug"),
        ("add", None, 3, "recorder:"),
        ("context", 3, 4, "frontend:"),
    ]
    assert result.files[2].old_path == "old.yaml"
    assert result.files[4].binary and not result.files[4].hunks
    assert (result.additions, result.deletions, result.more_files) == (3, 2, 0)
    added = result.as_dict()["files"][1]["hunks"][0]["lines"]
    assert added == [{"kind": "add", "old": None, "new": 1, "text": "hello"}]


def test_parse_patch_limits() -> None:
    body = "\n".join(f"+line {i}" for i in range(10))
    patch = "".join(
        f"diff --git a/f{n}.txt b/f{n}.txt\nnew file mode 100644\n"
        f"--- /dev/null\n+++ b/f{n}.txt\n@@ -0,0 +1,10 @@\n{body}\n"
        for n in range(3)
    )
    result = parse_patch(patch, max_lines=4, max_files=2)
    assert len(result.files) == 2
    assert result.more_files == 1
    assert len(result.files[0].hunks[0].lines) == 4
    assert result.files[0].truncated == 6
    # The counts cover the whole file, not only the lines kept.
    assert result.files[0].additions == 10


async def test_preview_files_keeps_the_index(repo: Path) -> None:
    git_repo = _repo(repo)
    assert (await git_repo.preview_files()).files == []

    (repo / "configuration.yaml").write_text("default_config:\nlogger:\n", encoding="utf-8")
    (repo / "scripts.yaml").write_text("{}\n", encoding="utf-8")
    git(repo, "add", "scripts.yaml")
    result = await git_repo.preview_files()
    assert [(f.path, f.status, f.additions) for f in result.files] == [
        ("configuration.yaml", "modified", 1),
        ("scripts.yaml", "added", 1),
    ]
    # The untracked file was diffed from a copy of the index: the real one still holds only scripts.yaml.
    assert git(repo, "diff", "--cached", "--name-only").split() == ["scripts.yaml"]


async def test_fetch_counts_the_commits_behind(repo: Path, tmp_path: Path) -> None:
    git_repo = _repo(repo)
    push_from(clone(tmp_path), "automations.yaml", "[]\n")
    assert (await git_repo.status()).behind == 0
    await git_repo.fetch()
    status = await git_repo.status()
    assert (status.ahead, status.behind, status.diverged) == (0, 1, False)

    (repo / "scripts.yaml").write_text("{}\n", encoding="utf-8")
    await git_repo.stage_all()
    await git_repo.commit("feat: scripts")
    assert (await git_repo.status()).diverged


async def test_pull_rebase_conflict_is_aborted(repo: Path, tmp_path: Path) -> None:
    from custom_components.system_hub.git_sync.git import RebaseConflictError

    git_repo = _repo(repo)
    push_from(clone(tmp_path), "configuration.yaml", "default_config:\nhttp:\n")
    (repo / "configuration.yaml").write_text("default_config:\nlogger:\n", encoding="utf-8")
    await git_repo.stage_all()
    await git_repo.commit("feat: logger")
    await git_repo.fetch()
    with pytest.raises(RebaseConflictError):
        await git_repo.pull_rebase()
    # Back on the local commit, no rebase left in progress, nothing changed in the files.
    assert not (repo / ".git" / "rebase-merge").exists()
    assert not (repo / ".git" / "rebase-apply").exists()
    assert git(repo, "log", "-1", "--format=%s").strip() == "feat: logger"
    assert git(repo, "status", "--porcelain").strip() == ""
    assert (await git_repo.status()).diverged


def test_redact_secrets() -> None:
    from custom_components.system_hub.git_sync.git import StagedDiff, redact_secrets

    patch = "\n".join(
        [
            "+++ b/configuration.yaml",
            "+  password: hunter2",
            "-  api_key: 'abc123'",
            '+    "access_token": "eyJhbGciOi",',
            "+  client_secret = s3cr3t",
            "+  wifi_password: !secret wifi",
            "+  name: Kitchen",
            "+  secrets:",
        ]
    )
    redacted = redact_secrets(patch)
    for secret in ("hunter2", "abc123", "eyJhbGciOi", "s3cr3t"):
        assert secret not in redacted
    assert "+  password: <redacted>" in redacted
    assert "+  wifi_password: !secret wifi" in redacted
    assert "+  name: Kitchen" in redacted
    assert "+  secrets:" in redacted
    assert "hunter2" not in StagedDiff(stat="1 file", patch=patch, files=1).as_prompt()


@pytest.mark.parametrize(
    ("line", "expected"),
    [
        ("+  - password: hunter2", "+  - password: <redacted>"),
        ("+    -   token: abc", "+    -   token: <redacted>"),
        ("+  authorization: Basic dXNlcjpwdw==", "+  authorization: <redacted>"),
        ('+    "Authorization": "Bearer eyJhbGciOi",', '+    "Authorization": <redacted>'),
        ("+  bearer: eyJhbGciOi", "+  bearer: <redacted>"),
        ("+  api-key: k3y", "+  api-key: <redacted>"),
        ("+  apikey: k3y", "+  apikey: <redacted>"),
        ("+  x-api-key: k3y", "+  x-api-key: <redacted>"),
        ("+  ApiKey = k3y", "+  ApiKey = <redacted>"),
        ("+  private_key: k3y", "+  private_key: <redacted>"),
        ("+  passwd: hunter2", "+  passwd: <redacted>"),
        ("+  pin: 1234", "+  pin: <redacted>"),
        ("+  - door_pin: 1234", "+  - door_pin: <redacted>"),
        ("+  headers: {Authorization: Bearer eyJhbGciOi}", "+  headers: {Authorization: Bearer <redacted>}"),
        ("+  url: https://x/?a=1 bearer eyJhbGciOi", "+  url: https://x/?a=1 bearer <redacted>"),
        # Not secrets: kept as they are.
        ("+  pinned: true", "+  pinned: true"),
        ("+  - name: Kitchen", "+  - name: Kitchen"),
        ("+  - pin: !secret door", "+  - pin: !secret door"),
        ("--- a/configuration.yaml", "--- a/configuration.yaml"),
    ],
)
def test_redact_secrets_forms(line: str, expected: str) -> None:
    from custom_components.system_hub.git_sync.git import redact_secrets

    assert redact_secrets(line) == expected


@pytest.mark.parametrize(
    ("path", "sensitive"),
    [
        ("secrets.yaml", True),
        ("packages/secrets.yaml", True),
        (".storage/auth", True),
        (".storage/lovelace.dashboard", True),
        (".ssh/id_ed25519", True),
        ("certs/server.pem", True),
        ("certs/private.key", True),
        ("id_rsa.pub", True),
        ("known_devices.yaml", True),
        ("home-assistant_v2.db", True),
        ("home-assistant_v2.db-wal", True),
        ("home-assistant.log", True),
        ("configuration.yaml", False),
        ("dashboards_export/lovelace.yaml", False),
        ("keys.yaml", False),
    ],
)
def test_is_sensitive(path: str, sensitive: bool) -> None:
    from custom_components.system_hub.git_sync.git import is_sensitive

    assert is_sensitive(path) is sensitive


def test_blocked_sensitive() -> None:
    from custom_components.system_hub.git_sync.git import blocked_sensitive

    changes = [("A", "secrets.yaml"), ("M", ".storage/core.config"), ("D", "old.pem"), ("M", "automations.yaml")]
    assert blocked_sensitive(changes, allow_tracked=False) == ["secrets.yaml", ".storage/core.config"]
    # Allowed: only the tracked file; a new one is still refused, a deletion never is.
    assert blocked_sensitive(changes, allow_tracked=True) == ["secrets.yaml"]


async def test_preview_changes_keeps_the_index(repo: Path) -> None:
    git_repo = _repo(repo)
    (repo / "secrets.yaml").write_text("x: y\n", encoding="utf-8")
    (repo / "configuration.yaml").write_text("default_config:\nlogger:\n", encoding="utf-8")
    assert sorted(await git_repo.preview_changes()) == [("A", "secrets.yaml"), ("M", "configuration.yaml")]
    assert git(repo, "diff", "--cached", "--name-only").strip() == ""


async def test_gitignore_missing_and_append(repo: Path) -> None:
    from custom_components.system_hub.git_sync.git import append_gitignore

    git_repo = _repo(repo)
    assert await git_repo.gitignore_missing() == ["secrets.yaml", ".storage/"]
    (repo / ".gitignore").write_text("*.log", encoding="utf-8")  # no final newline
    append_gitignore(str(repo), ["secrets.yaml", ".storage/"])
    assert await git_repo.gitignore_missing() == []
    assert (repo / ".gitignore").read_text(encoding="utf-8").splitlines()[:2] == [
        "*.log",
        "# Added by Git Sync: never commit secrets",
    ]
