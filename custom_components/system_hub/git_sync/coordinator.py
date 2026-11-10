"""Coordinator: polls git status and runs commit/push and dashboard exports."""

from __future__ import annotations

import asyncio
import logging
import os
import re
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from functools import partial
from pathlib import PurePosixPath
from typing import Any
from urllib.parse import urlsplit

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError, ServiceValidationError
from homeassistant.helpers import issue_registry as ir
from homeassistant.helpers.storage import Store
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed
from homeassistant.util import dt as dt_util

from ..const import DOMAIN
from .const import (
    AI_INSTRUCTIONS,
    COMMIT_MESSAGE_MAX,
    CONF_AI_TASK_ENTITY,
    CONF_ALLOW_SENSITIVE,
    CONF_AUTHOR_EMAIL,
    CONF_AUTHOR_NAME,
    CONF_BRANCH,
    CONF_COMMIT_LANGUAGE,
    CONF_EXPORT_BEFORE_COMMIT,
    CONF_EXPORT_DIR,
    CONF_EXPORT_ENABLED,
    CONF_EXPORT_FORMAT,
    CONF_FETCH_INTERVAL,
    CONF_NOTIFY_IMAGE,
    CONF_NOTIFY_SERVICE,
    CONF_PULL_BEFORE_PUSH,
    CONF_REMOTE,
    CONF_REPO_PATH,
    CONF_SSH_KEY,
    CONF_STATUS_INTERVAL,
    DEFAULT_ALLOW_SENSITIVE,
    DEFAULT_BRANCH,
    DEFAULT_COMMIT_LANGUAGE,
    DEFAULT_EXPORT_DIR,
    DEFAULT_EXPORT_FORMAT,
    DEFAULT_FETCH_INTERVAL,
    DEFAULT_PULL_BEFORE_PUSH,
    DEFAULT_REMOTE,
    DEFAULT_SSH_KEY,
    DEFAULT_STATUS_INTERVAL,
    EVENT_COMMITTED,
    EVENT_EXPORTED,
    ISSUE_GITIGNORE,
    ISSUE_PUSH_BLOCKED,
    LANGUAGE_NAMES,
    SNAPSHOT_COOLDOWN,
    STATUS_AHEAD,
    STATUS_BEHIND,
    STATUS_CLEAN,
    STATUS_DIRTY,
    STATUS_DIVERGED,
    STATUS_ERROR,
    STORAGE_KEY,
    STORAGE_VERSION,
)
from .export import export_dashboards, export_dir_allowed
from .git import (
    GitCommit,
    GitError,
    GitRepo,
    GitStatus,
    RebaseConflictError,
    StagedDiff,
    WorkTreeDiff,
    append_gitignore,
    blocked_sensitive,
    generate_ssh_key,
    redact_url,
)

_LOGGER = logging.getLogger(__name__)

_UNSAFE_CHARS = re.compile(r"[`$\"]")
# The errors of a push that stays blocked until something is done by hand.
_BLOCKED_PUSH = ("diverged", "behind_remote", "rebase_conflict")


@dataclass(slots=True)
class GitSyncData:
    """Snapshot exposed to the entities."""

    status: str = STATUS_CLEAN
    git: GitStatus = field(default_factory=GitStatus)
    remote_url: str | None = None
    head: GitCommit | None = None
    last_push: datetime | None = None
    last_push_message: str | None = None
    last_export: datetime | None = None
    last_export_files: list[str] = field(default_factory=list)
    last_error: str | None = None
    ai_task: str | None = None


@dataclass(slots=True, frozen=True)
class CommitResult:
    """Outcome of a commit and push: the commit message (None when nothing was committed) and whether it pushed."""

    message: str | None = None
    pushed: bool = False

    @property
    def committed(self) -> bool:
        """Return True when a commit was made."""
        return self.message is not None


def _signature(status: GitStatus) -> tuple[tuple[str, ...], int, int]:
    """The changed files and the commits ahead and behind: what an automatic commit was blocked on."""
    return tuple(sorted(status.files)), status.ahead, status.behind


def sanitize_message(raw: str) -> str:
    """Keep the first line, strip shell-unsafe characters and cap the length."""
    line = next((part.strip() for part in raw.splitlines() if part.strip()), "")
    line = _UNSAFE_CHARS.sub("", line).strip().rstrip(".")
    return line[:COMMIT_MESSAGE_MAX].rstrip()


class GitSyncCoordinator(DataUpdateCoordinator[GitSyncData]):
    """Owns the repository and every write operation on it."""

    config_entry: ConfigEntry

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry, settings: dict[str, Any]) -> None:
        """Set up the coordinator from the settings of the module."""
        self.settings: dict[str, Any] = dict(settings)
        super().__init__(
            hass,
            _LOGGER,
            config_entry=entry,
            name=f"{DOMAIN} git sync",
            update_interval=timedelta(seconds=self.settings.get(CONF_STATUS_INTERVAL, DEFAULT_STATUS_INTERVAL)),
        )
        self.repo = GitRepo(
            self.settings[CONF_REPO_PATH],
            remote=self.settings.get(CONF_REMOTE) or DEFAULT_REMOTE,
            branch=self.settings.get(CONF_BRANCH) or DEFAULT_BRANCH,
            ssh_key=self.settings.get(CONF_SSH_KEY) or DEFAULT_SSH_KEY,
            author_name=self.settings.get(CONF_AUTHOR_NAME) or "",
            author_email=self.settings.get(CONF_AUTHOR_EMAIL) or "",
        )
        self._store = self._make_store(hass, entry)
        self._lock = asyncio.Lock()
        self._state = GitSyncData(ai_task=self.settings.get(CONF_AI_TASK_ENTITY) or None)
        # Per export folder, the files the integration itself wrote there and the hash of what it wrote: the only
        # files a later export may overwrite, or delete while unchanged.
        self._export_manifest: dict[str, dict[str, str]] = {}
        # Seconds between two fetches of the status polling (0: only before a push), and when the last one ran.
        self._fetch_every = int(self.settings.get(CONF_FETCH_INTERVAL, DEFAULT_FETCH_INTERVAL)) * 60
        self._last_fetch: float | None = None
        # The .gitignore lines missing to exclude secrets.yaml and .storage (None: not checked yet).
        self.gitignore_missing: list[str] | None = None
        # The changes (files, commits ahead and behind) whose automatic commit was refused or blocked.
        self._auto_blocked: tuple[tuple[str, ...], int, int] | None = None
        self._last_snapshot: float | None = None  # time.monotonic() of the last snapshot before an update
        # Last error of an automatic commit that is retried at every interval (push or fetch failure): logged once.
        self._auto_error: str | None = None

    @staticmethod
    def _make_store(hass: HomeAssistant, _entry: ConfigEntry | None = None) -> Store[dict[str, Any]]:
        return Store(hass, STORAGE_VERSION, STORAGE_KEY)

    @classmethod
    async def async_remove_store(cls, hass: HomeAssistant) -> None:
        """Delete the file holding the last push/export, when the integration is removed."""
        await cls._make_store(hass).async_remove()

    # ------------------------------------------------------------------ polling

    async def async_load(self) -> None:
        """Restore the last push/export info saved across restarts."""
        stored = await self._store.async_load() or {}
        if value := stored.get("last_push"):
            self._state.last_push = dt_util.parse_datetime(value)
        self._state.last_push_message = stored.get("last_push_message")
        if value := stored.get("last_export"):
            self._state.last_export = dt_util.parse_datetime(value)
        self._state.last_export_files = stored.get("last_export_files", [])
        manifest = stored.get("export_manifest")
        if isinstance(manifest, dict):
            self._export_manifest = {
                folder: {name: digest for name, digest in files.items() if isinstance(digest, str)}
                for folder, files in manifest.items()
                if isinstance(folder, str) and isinstance(files, dict)
            }

    async def _async_save(self) -> None:
        state = self._state
        await self._store.async_save(
            {
                "last_push": state.last_push.isoformat() if state.last_push else None,
                "last_push_message": state.last_push_message,
                "last_export": state.last_export.isoformat() if state.last_export else None,
                "last_export_files": state.last_export_files,
                "export_manifest": self._export_manifest,
            }
        )

    async def _async_fetch(self) -> None:
        """Fetch the remote, best effort: an unreachable remote is reported by the push, not by the status."""
        self._last_fetch = time.monotonic()
        try:
            await self.repo.fetch()
        except (GitError, OSError) as err:
            _LOGGER.debug("git fetch failed: %s", err)

    def _fetch_due(self) -> bool:
        # Not on the first refresh (the setup does not wait for the network) nor during a commit, which fetches.
        if not self._fetch_every or self.data is None or self._lock.locked():
            return False
        return self._last_fetch is None or time.monotonic() - self._last_fetch >= self._fetch_every

    async def _async_update_data(self) -> GitSyncData:
        state = self._state
        if self._fetch_due():
            await self._async_fetch()
        try:
            await self._async_check_gitignore()
            state.git = await self.repo.status()
            state.head = await self.repo.last_commit()
            # An HTTPS remote may carry a token ("https://user:token@host/…"): never expose it in the state.
            state.remote_url = redact_url(await self.repo.remote_url())
        except (GitError, OSError) as err:
            raise UpdateFailed(str(err)) from err

        # last_error only holds commit/push failures; it is cleared by the next
        # successful push, so a failed push stays visible until it is fixed.
        # It is also cleared once nothing is left to commit or push, e.g. after a `git push` run in a terminal:
        # a failed commit leaves its files staged (dirty), a failed push leaves commits ahead (push_pending).
        # A detached HEAD cannot tell whether its commits reached the remote: its error is kept.
        git_state = state.git
        if state.last_error and not (git_state.dirty or git_state.push_pending or git_state.detached):
            state.last_error = None
        if not git_state.behind:
            # Rebased and pushed in a terminal: nothing blocks the push any more.
            self._delete_issue(ISSUE_PUSH_BLOCKED)
        if git_state.diverged:
            # Nothing can be pushed until it is resolved by hand, whatever the work tree holds.
            state.status = STATUS_DIVERGED
        elif git_state.dirty:
            state.status = STATUS_DIRTY
        elif state.last_error:
            state.status = STATUS_ERROR
        elif git_state.behind:
            state.status = STATUS_BEHIND
        elif git_state.push_pending:
            state.status = STATUS_AHEAD
        else:
            state.status = STATUS_CLEAN
        return state

    # ------------------------------------------------------------------ repairs

    def _issue_id(self, key: str) -> str:
        return f"{key}_{self.config_entry.entry_id}"

    def _delete_issue(self, key: str) -> None:
        ir.async_delete_issue(self.hass, DOMAIN, self._issue_id(key))

    async def _async_check_gitignore(self) -> None:
        """Raise a fixable repair when .gitignore lets secrets.yaml or .storage be committed."""
        is_config = await asyncio.to_thread(os.path.isfile, os.path.join(self.repo.path, "configuration.yaml"))
        missing = await self.repo.gitignore_missing() if is_config else []
        if missing == self.gitignore_missing:
            return
        self.gitignore_missing = missing
        if not missing:
            self._delete_issue(ISSUE_GITIGNORE)
            return
        ir.async_create_issue(
            self.hass,
            DOMAIN,
            self._issue_id(ISSUE_GITIGNORE),
            is_fixable=True,
            severity=ir.IssueSeverity.WARNING,
            translation_key=ISSUE_GITIGNORE,
            translation_placeholders={"repo": self.repo.path, "lines": "\n".join(f"- `{line}`" for line in missing)},
            data={"entry_id": self.config_entry.entry_id},
        )

    async def async_fix_gitignore(self) -> None:
        """Append the missing lines to .gitignore (the repair's fix flow, confirmed by an admin)."""
        lines = await self.repo.gitignore_missing()
        if lines:
            await self.hass.async_add_executor_job(append_gitignore, self.repo.path, lines)
        await self.async_refresh()

    def _push_blocked(self, key: str, status: GitStatus) -> HomeAssistantError:
        """Raise the repair explaining why nothing was pushed, and return the error to raise."""
        placeholders = {
            "repo": self.repo.path,
            "remote": self.repo.remote,
            "upstream": status.upstream or self.repo.remote,
            "ahead": str(status.ahead),
            "behind": str(status.behind),
        }
        ir.async_create_issue(
            self.hass,
            DOMAIN,
            self._issue_id(ISSUE_PUSH_BLOCKED),
            is_fixable=False,
            severity=ir.IssueSeverity.ERROR,
            translation_key="behind_remote" if key == "behind_remote" else "diverged",
            translation_placeholders=placeholders,
        )
        return HomeAssistantError(translation_domain=DOMAIN, translation_key=key, translation_placeholders=placeholders)

    async def _async_check_sensitive(self) -> None:
        """Refuse changes to sensitive files (secrets, auth storage, keys, database, logs)."""
        self._check_sensitive(await self.repo.preview_changes())

    def _check_sensitive(self, changes: list[tuple[str, str]]) -> None:
        allow = self.settings.get(CONF_ALLOW_SENSITIVE, DEFAULT_ALLOW_SENSITIVE)
        blocked = blocked_sensitive(changes, allow_tracked=allow)
        if blocked:
            raise ServiceValidationError(
                translation_domain=DOMAIN,
                translation_key="sensitive_files",
                translation_placeholders={"files": ", ".join(blocked[:10]) + (" …" if len(blocked) > 10 else "")},
            )

    @property
    def dirty(self) -> bool:
        """Return True when there is something to commit or push.

        A failed push on a clean tree leaves the status at error with commits still waiting: they count too,
        so that the automatic commit retries the push instead of waiting for a file to change.
        """
        data = self.data
        if data is None:
            return False
        return data.status in (STATUS_DIRTY, STATUS_AHEAD) or (data.status == STATUS_ERROR and data.git.push_pending)

    # ------------------------------------------------------------------ commit / push

    async def async_commit_push(self, message: str | None = None) -> CommitResult:
        """Stage, commit and push; or push the commits left pending by an earlier failure."""
        async with self._lock:
            if self.settings.get(CONF_EXPORT_BEFORE_COMMIT) and self.settings.get(CONF_EXPORT_ENABLED, True):
                await self._export()

            try:
                # A remote moved since the last fetch would make the push fail with a bare "rejected".
                await self._async_fetch()
                before = await self.repo.status()
                if before.diverged:
                    raise self._push_blocked("diverged", before)
                pull = self.settings.get(CONF_PULL_BEFORE_PUSH, DEFAULT_PULL_BEFORE_PUSH)
                if before.behind and not pull:
                    raise self._push_blocked("behind_remote", before)
                await self._async_check_sensitive()
                diff = await self.repo.stage_all()
                # A sensitive file written between the check above and `git add -A` would be staged unchecked:
                # check what the real index now holds, and unstage everything if it is refused.
                try:
                    self._check_sensitive(await self.repo.staged_changes())
                except ServiceValidationError:
                    await self.repo.unstage_all()
                    raise
                if diff is None:
                    # Nothing new: push what an earlier failure (or a never pushed branch) left pending.
                    if not (await self.repo.status()).push_pending:
                        return CommitResult()
                    commit_message = None
                else:
                    commit_message = sanitize_message(message or "") or await self._ai_message(diff)
                    await self.repo.commit(commit_message)
                if before.behind:
                    try:
                        await self.repo.pull_rebase()
                    except RebaseConflictError as err:
                        raise self._push_blocked("rebase_conflict", await self.repo.status()) from err
                await self.repo.push()
            except (GitError, HomeAssistantError) as err:
                self._state.status = STATUS_ERROR
                self._state.last_error = str(err)
                self.async_update_listeners()
                if isinstance(err, HomeAssistantError):
                    raise
                raise HomeAssistantError(str(err)) from err

            self._delete_issue(ISSUE_PUSH_BLOCKED)
            self._state.last_error = None
            self._state.last_push = dt_util.utcnow()
            await self.async_refresh()
            head = self._state.head
            self._state.last_push_message = commit_message or (head.message if head else None)
            await self._async_save()
            self.async_update_listeners()

        if diff is None:
            return CommitResult(pushed=True)
        self.hass.bus.async_fire(
            EVENT_COMMITTED,
            {
                "entry_id": self.config_entry.entry_id,
                "message": commit_message,
                "sha": head.sha if head else None,
                "files": diff.files,
            },
        )
        await self._notify(commit_message)
        return CommitResult(message=commit_message, pushed=True)

    async def async_snapshot_before_update(self, entity_ids: list[str]) -> CommitResult | None:
        """Commit and push the configuration as it is before an update gets installed (Commit before updates).

        Runs when the update.install action is called: the commit stages the files within moments, while the
        update is still downloading. Once per SNAPSHOT_COOLDOWN, so that Update all (one install after the
        other) gets one snapshot from before the first, not commits of the files the first install changed.
        None when skipped; a failure is logged, never raised (the update goes on either way).
        """
        now = time.monotonic()
        if self._last_snapshot is not None and now - self._last_snapshot < SNAPSHOT_COOLDOWN:
            return None
        self._last_snapshot = now
        names = []
        for entity_id in entity_ids:
            state = self.hass.states.get(entity_id)
            if state is None:
                continue
            title = state.attributes.get("title") or state.attributes.get("friendly_name") or entity_id
            latest = state.attributes.get("latest_version")
            names.append(f"{title} to {latest}" if latest else str(title))
        what = ", ".join(names[:3]) + (f" and {len(names) - 3} more" if len(names) > 3 else "")
        message = f"chore: snapshot before updating {what}" if what else "chore: snapshot before an update"
        try:
            return await self.async_commit_push(message)
        except HomeAssistantError as err:
            _LOGGER.warning("Snapshot before the update failed, the update goes on: %s", err)
            return None

    async def async_auto_commit(self) -> None:
        """Commit and push on the commit interval, without retrying a blocked change set every time.

        A refused commit (sensitive files) or a blocked push (diverged, behind with Pull before push off, rebase
        conflict) is logged once, then skipped until the changed files or the commits ahead/behind differ. Any other
        failure (remote unreachable, authentication) is retried at every interval, with one warning per distinct
        message and no traceback.
        """
        await self.async_request_refresh()
        if not self.dirty:
            return
        if _signature(self.data.git) == self._auto_blocked:
            return
        try:
            await self.async_commit_push()
        except HomeAssistantError as err:
            if not isinstance(err, ServiceValidationError) and err.translation_key not in _BLOCKED_PUSH:
                if str(err) != self._auto_error:
                    self._auto_error = str(err)
                    _LOGGER.warning("Automatic commit failed, retried at the next interval: %s", err)
                return
            # Taken after the attempt: the commit fetched, so the commits behind are counted as the polling will.
            try:
                self._auto_blocked = _signature(await self.repo.status())
            except (GitError, OSError):
                self._auto_blocked = _signature(self.data.git)
            _LOGGER.warning("Automatic commit skipped until the changes differ: %s", err)
            return
        self._auto_blocked = None
        self._auto_error = None

    async def async_pull(self) -> int:
        """Bring in the remote commits and return how many there were.

        Fast-forward when nothing local waits to be pushed; local commits are rebased on the remote ones
        (`git pull --rebase --autostash`, aborted on a conflict), but only on a clean work tree.
        """
        async with self._lock:
            try:
                self._last_fetch = time.monotonic()
                await self.repo.fetch()
                before = await self.repo.status()
                if not before.behind:
                    return 0
                if not before.ahead:
                    await self.repo.pull_ff_only()
                elif before.dirty:
                    raise self._push_blocked("diverged", before)
                else:
                    try:
                        await self.repo.pull_rebase()
                    except RebaseConflictError as err:
                        raise self._push_blocked("rebase_conflict", await self.repo.status()) from err
            except (GitError, OSError) as err:
                raise HomeAssistantError(str(err)) from err
            finally:
                await self.async_refresh()
        return before.behind

    def _fallback_message(self, diff: StagedDiff) -> str:
        return f"chore: update configuration ({diff.files} file{'s' if diff.files > 1 else ''})"

    async def _ai_message(self, diff: StagedDiff) -> str:
        """Ask the configured AI task for a commit message, with a safe fallback."""
        try:
            return await self._async_ask_ai(diff) or self._fallback_message(diff)
        except HomeAssistantError as err:
            _LOGGER.warning("AI task failed, using fallback commit message: %s", err)
            return self._fallback_message(diff)

    async def _async_ask_ai(self, diff: StagedDiff) -> str | None:
        """Return the AI task's message, None when no AI task is set up; raise when it fails."""
        entity_id = self.settings.get(CONF_AI_TASK_ENTITY)
        if not entity_id or not self.hass.services.has_service("ai_task", "generate_data"):
            return None
        language = LANGUAGE_NAMES.get(self.settings.get(CONF_COMMIT_LANGUAGE, DEFAULT_COMMIT_LANGUAGE), "English")
        prompt = AI_INSTRUCTIONS.format(language=language, max_len=COMMIT_MESSAGE_MAX, diff=diff.as_prompt())
        response = await self.hass.services.async_call(
            "ai_task",
            "generate_data",
            {
                "task_name": "git_commit_message",
                "entity_id": entity_id,
                "instructions": prompt,
            },
            blocking=True,
            return_response=True,
        )
        data = (response or {}).get("data")
        return sanitize_message(data if isinstance(data, str) else "") or None

    @property
    def ai_task(self) -> str | None:
        """The AI task entity writing the commit messages, if any."""
        return self.settings.get(CONF_AI_TASK_ENTITY) or None

    async def async_generate_message(self) -> str | None:
        """Write a commit message for the current changes without committing. None when nothing changed."""
        if not self.ai_task:
            raise ServiceValidationError(translation_domain=DOMAIN, translation_key="no_ai_task")
        try:
            await self._async_check_sensitive()
            diff = await self.repo.preview_diff()
        except GitError as err:
            raise HomeAssistantError(str(err)) from err
        if diff is None:
            return None
        message = await self._async_ask_ai(diff)
        if message is None:
            raise HomeAssistantError(translation_domain=DOMAIN, translation_key="ai_task_failed")
        return message

    async def async_get_diff(self) -> WorkTreeDiff:
        """Return the changes a commit would include, file by file, for the card's diff viewer."""
        try:
            return await self.repo.preview_files()
        except GitError as err:
            raise HomeAssistantError(str(err)) from err

    async def _notify(self, message: str) -> None:
        service = (self.settings.get(CONF_NOTIFY_SERVICE) or "").strip()
        if not service:
            return
        domain, _, name = service.partition(".")
        if not name:
            domain, name = "notify", domain
        payload: dict[str, Any] = {"title": "Git commit", "message": message}
        if image := self.settings.get(CONF_NOTIFY_IMAGE):
            payload["data"] = {
                # The extension of the URL's path: a query string ("…/a.png?v=2") is not part of it.
                "attachment": {"url": image, "content-type": PurePosixPath(urlsplit(image).path).suffix[1:]},
                "image": image,
                "notification_icon": "mdi:git",
            }
        try:
            await self.hass.services.async_call(domain, name, payload, blocking=False)
        except HomeAssistantError as err:
            _LOGGER.warning("Notification via %s failed: %s", service, err)

    # ------------------------------------------------------------------ dashboards

    async def async_export_dashboards(self) -> list[str]:
        """Export dashboards (serialised with commits)."""
        async with self._lock:
            files = await self._export()
        await self.async_refresh()
        return files

    async def _export(self) -> list[str]:
        # A relative folder is read from the configuration folder, not from the process's working directory.
        export_dir = os.path.normpath(self.hass.config.path(self.settings.get(CONF_EXPORT_DIR) or DEFAULT_EXPORT_DIR))
        if not await self.hass.async_add_executor_job(
            export_dir_allowed, export_dir, self.hass.config.config_dir, self.hass.config.allowlist_external_dirs
        ):
            raise HomeAssistantError(
                translation_domain=DOMAIN,
                translation_key="export_dir_not_allowed",
                translation_placeholders={"path": export_dir},
            )
        # Files written by an earlier export into this same folder. Nothing is deleted from a folder the export
        # never wrote to, nor on the first export after an update from a version without manifest; that first
        # export (an export was done, no manifest) refreshes the old version's files instead of skipping them.
        previous = self._export_manifest.get(export_dir, {})
        adopt = not self._export_manifest and self._state.last_export is not None
        try:
            result = await self.hass.async_add_executor_job(
                partial(
                    export_dashboards,
                    self.hass.config.path(".storage"),
                    export_dir,
                    self.settings.get(CONF_EXPORT_FORMAT) or DEFAULT_EXPORT_FORMAT,
                    previous,
                    adopt=adopt,
                )
            )
        except OSError as err:
            raise HomeAssistantError(f"Dashboard export failed: {err}") from err

        files = result.files
        self._export_manifest[export_dir] = result.managed
        self._state.last_export = dt_util.utcnow()
        self._state.last_export_files = files
        await self._async_save()
        self.hass.bus.async_fire(EVENT_EXPORTED, {"entry_id": self.config_entry.entry_id, "files": files})
        return files

    # ------------------------------------------------------------------ SSH

    async def async_generate_ssh_key(self) -> str:
        """Create the deploy key if needed and return its public part."""
        try:
            return await generate_ssh_key(self.settings.get(CONF_SSH_KEY) or DEFAULT_SSH_KEY)
        except (GitError, OSError) as err:
            raise HomeAssistantError(str(err)) from err
