"""Config flow, setup and services."""

from __future__ import annotations

from pathlib import Path

import pytest
from homeassistant import config_entries
from homeassistant.core import Context, HomeAssistant
from homeassistant.data_entry_flow import FlowResultType
from homeassistant.exceptions import Unauthorized, UnknownUser
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.system_hub.const import DOMAIN
from custom_components.system_hub.git_sync.const import (
    CONF_COMMIT_INTERVAL,
    CONF_EXPORT_DIR,
    CONF_EXPORT_ENABLED,
    CONF_REMOTE,
    CONF_REPO_PATH,
    CONF_SSH_KEY,
)

from .conftest import clone, git, git_sync_entry, push_from


async def test_setup_and_commit(hass: HomeAssistant, repo: Path, tmp_path: Path) -> None:
    entry = git_sync_entry(
        domain=DOMAIN,
        unique_id=str(repo),
        data={CONF_REPO_PATH: str(repo), CONF_REMOTE: "origin", CONF_SSH_KEY: ""},
        options={
            CONF_COMMIT_INTERVAL: 0,
            CONF_EXPORT_ENABLED: False,
            CONF_EXPORT_DIR: str(tmp_path / "export"),
        },
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    states = [s for s in hass.states.async_all("sensor") if s.attributes.get("changed_count") is not None]
    assert len(states) == 1
    assert states[0].state == "clean"

    (repo / "scripts.yaml").write_text("{}\n", encoding="utf-8")
    await entry.runtime_data.git_sync.async_refresh()
    await hass.async_block_till_done()
    assert hass.states.get(states[0].entity_id).state == "dirty"

    response = await hass.services.async_call(
        DOMAIN, "git_sync_commit_push", {"message": "feat: add scripts"}, blocking=True, return_response=True
    )
    assert response["committed"] is True
    assert git(repo, "log", "-1", "--format=%s", "origin/main").strip() == "feat: add scripts"
    assert hass.states.get(states[0].entity_id).state == "clean"

    response = await hass.services.async_call(DOMAIN, "git_sync_commit_push", {}, blocking=True, return_response=True)
    assert response["committed"] is False

    assert await hass.config_entries.async_unload(entry.entry_id)


def _mock_ai_task(hass: HomeAssistant, answer: str) -> list[dict]:
    """Register a fake ai_task.generate_data returning `answer`; return the calls made."""
    from homeassistant.core import ServiceCall, SupportsResponse

    calls: list[dict] = []

    async def generate(call: ServiceCall) -> dict:
        calls.append(dict(call.data))
        return {"conversation_id": "x", "data": answer}

    hass.services.async_register("ai_task", "generate_data", generate, supports_response=SupportsResponse.ONLY)
    return calls


async def test_generate_message(hass: HomeAssistant, repo: Path, tmp_path: Path) -> None:
    import pytest
    from homeassistant.exceptions import ServiceValidationError

    from custom_components.system_hub.git_sync.const import CONF_AI_TASK_ENTITY

    calls = _mock_ai_task(hass, "`feat: add the scripts file`.\nsecond line")
    entry = git_sync_entry(
        domain=DOMAIN,
        unique_id=str(repo),
        data={CONF_REPO_PATH: str(repo), CONF_REMOTE: "origin", CONF_SSH_KEY: ""},
        options={CONF_COMMIT_INTERVAL: 0, CONF_EXPORT_ENABLED: False, CONF_AI_TASK_ENTITY: "ai_task.test"},
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    # Nothing changed: no message, the AI task is not called.
    response = await hass.services.async_call(
        DOMAIN, "git_sync_generate_message", {}, blocking=True, return_response=True
    )
    assert response == {"message": None}
    assert not calls

    # A file partly staged by the user keeps its index state: the preview uses a copy of the index.
    (repo / "scripts.yaml").write_text("{}\n", encoding="utf-8")
    (repo / "notes.txt").write_text("x\n", encoding="utf-8")
    git(repo, "add", "notes.txt")
    response = await hass.services.async_call(
        DOMAIN, "git_sync_generate_message", {}, blocking=True, return_response=True
    )
    assert response == {"message": "feat: add the scripts file"}
    assert "scripts.yaml" in calls[0]["instructions"]
    assert calls[0]["entity_id"] == "ai_task.test"
    assert git(repo, "diff", "--cached", "--name-only").split() == ["notes.txt"]
    assert git(repo, "log", "-1", "--format=%s").strip() == "chore: initial"

    # The commit uses the AI message too.
    response = await hass.services.async_call(DOMAIN, "git_sync_commit_push", {}, blocking=True, return_response=True)
    assert response["message"] == "feat: add the scripts file"

    status = next(s for s in hass.states.async_all("sensor") if "changed_count" in s.attributes)
    assert status.attributes["ai_task"] == "ai_task.test"

    hass.config_entries.async_update_entry(
        entry, options={**entry.options, "git_sync": {**entry.options["git_sync"], CONF_AI_TASK_ENTITY: None}}
    )
    await hass.async_block_till_done()
    with pytest.raises(ServiceValidationError):
        await hass.services.async_call(DOMAIN, "git_sync_generate_message", {}, blocking=True, return_response=True)


_ONLY_GIT_SYNC = {"containers": False, "watchdog": False, "marketplace": False, "batteries": False, "git_sync": True}


async def test_default_ai_task_and_language(hass: HomeAssistant, repo: Path) -> None:
    from custom_components.system_hub.git_sync.const import CONF_AI_TASK_ENTITY, CONF_COMMIT_LANGUAGE

    hass.config.language = "fr"
    hass.states.async_set("ai_task.google_ai_task", "unknown")

    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
    result = await hass.config_entries.flow.async_configure(result["flow_id"], _ONLY_GIT_SYNC)
    done = await hass.config_entries.flow.async_configure(
        result["flow_id"], {CONF_REPO_PATH: str(repo), CONF_REMOTE: "origin", CONF_SSH_KEY: ""}
    )
    assert done["type"] is FlowResultType.CREATE_ENTRY
    options = done["options"]["git_sync"]
    assert (options[CONF_AI_TASK_ENTITY], options[CONF_COMMIT_LANGUAGE]) == ("ai_task.google_ai_task", "fr")


@pytest.mark.parametrize(
    ("ha_language", "expected"),
    [("ru", "ru"), ("el", "el"), ("sr-Latn", "sr-latn"), ("sr", "sr"), ("pt-BR", "pt"), ("cs", "cs"), ("ja", "en")],
)
async def test_default_language_follows_home_assistant(
    hass: HomeAssistant, repo: Path, ha_language: str, expected: str
) -> None:
    """Commit messages default to Home Assistant's language: full tag first, then its language, else English."""
    from custom_components.system_hub.git_sync.const import CONF_COMMIT_LANGUAGE

    hass.config.language = ha_language
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
    result = await hass.config_entries.flow.async_configure(result["flow_id"], _ONLY_GIT_SYNC)
    done = await hass.config_entries.flow.async_configure(
        result["flow_id"], {CONF_REPO_PATH: str(repo), CONF_REMOTE: "origin", CONF_SSH_KEY: ""}
    )
    assert done["options"]["git_sync"][CONF_COMMIT_LANGUAGE] == expected


async def test_ai_prompt_names_the_commit_language(hass: HomeAssistant, repo: Path) -> None:
    """The AI is asked for the message in the chosen language, by its English name."""
    from custom_components.system_hub.git_sync.const import CONF_AI_TASK_ENTITY, CONF_COMMIT_LANGUAGE

    calls = _mock_ai_task(hass, "fix: ažuriraj skripte")
    entry = git_sync_entry(
        domain=DOMAIN,
        unique_id=str(repo),
        data={CONF_REPO_PATH: str(repo), CONF_REMOTE: "origin", CONF_SSH_KEY: ""},
        options={
            CONF_COMMIT_INTERVAL: 0,
            CONF_EXPORT_ENABLED: False,
            CONF_AI_TASK_ENTITY: "ai_task.test",
            CONF_COMMIT_LANGUAGE: "sr-latn",
        },
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    (repo / "scripts.yaml").write_text("{}\n", encoding="utf-8")
    await hass.services.async_call(DOMAIN, "git_sync_generate_message", {}, blocking=True, return_response=True)
    assert "commit message in Serbian (Latin script)," in calls[0]["instructions"]


def _suggested(schema, key: str):
    for marker in schema.schema:
        if marker == key:
            return (marker.description or {}).get("suggested_value")
    raise KeyError(key)


def _defaults(schema) -> dict:
    import voluptuous as vol

    return {
        str(marker): marker.default()
        for marker in schema.schema
        if isinstance(marker, vol.Marker) and marker.default is not vol.UNDEFINED
    }


def _entry(repo: Path, **options) -> MockConfigEntry:
    return git_sync_entry(
        domain=DOMAIN,
        unique_id=str(repo),
        data={CONF_REPO_PATH: str(repo), CONF_REMOTE: "origin", CONF_SSH_KEY: ""},
        options={CONF_COMMIT_INTERVAL: 0, CONF_EXPORT_ENABLED: False, **options},
    )


def _status(hass: HomeAssistant):
    return next(s for s in hass.states.async_all("sensor") if "changed_count" in s.attributes)


async def test_readme_setup_pushes_and_tracks(hass: HomeAssistant, fresh_repo: Path) -> None:
    """`git init` + `git remote add` (no `push -u`): the commit is pushed and the next ones are seen as pending."""
    entry = _entry(fresh_repo)
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    # Never pushed: the initial commit is waiting.
    assert _status(hass).state == "ahead"

    (fresh_repo / "scripts.yaml").write_text("{}\n", encoding="utf-8")
    await entry.runtime_data.git_sync.async_refresh()
    response = await hass.services.async_call(
        DOMAIN, "git_sync_commit_push", {"message": "feat: add scripts"}, blocking=True, return_response=True
    )
    assert response["committed"] is True
    assert git(fresh_repo, "log", "-1", "--format=%s", "origin/main").strip() == "feat: add scripts"
    assert _status(hass).state == "clean"
    assert _status(hass).attributes["upstream"] == "origin/main"


async def test_nothing_new_pushes_the_pending_commit(hass: HomeAssistant, fresh_repo: Path) -> None:
    """Commit & push with only a pending push: pushed, last push updated, reported as pushed."""
    entry = _entry(fresh_repo)
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    last_push = next(s for s in hass.states.async_all("sensor") if s.entity_id.endswith("_last_push"))
    assert hass.states.get(last_push.entity_id).state == "unknown"

    response = await hass.services.async_call(DOMAIN, "git_sync_commit_push", {}, blocking=True, return_response=True)
    result = response
    assert (result["committed"], result["pushed"], result["message"]) == (False, True, None)
    assert git(fresh_repo, "log", "-1", "--format=%s", "origin/main").strip() == "chore: initial"
    assert hass.states.get(last_push.entity_id).state not in ("unknown", "unavailable")
    assert hass.states.get(last_push.entity_id).attributes["message"] == "chore: initial"
    assert _status(hass).state == "clean"

    # Clean and pushed: nothing at all.
    response = await hass.services.async_call(DOMAIN, "git_sync_commit_push", {}, blocking=True, return_response=True)
    assert (response["committed"], response["pushed"]) == (False, False)


async def test_failed_push_is_retried_automatically(hass: HomeAssistant, repo: Path, tmp_path: Path) -> None:
    """After a failed push on a clean tree, the automatic commit retries it."""
    import pytest
    from homeassistant.exceptions import HomeAssistantError

    entry = _entry(repo)
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    coordinator = entry.runtime_data.git_sync

    remote = tmp_path / "remote.git"
    remote.rename(tmp_path / "away.git")
    (repo / "scripts.yaml").write_text("{}\n", encoding="utf-8")
    with pytest.raises(HomeAssistantError):
        await coordinator.async_commit_push("feat: add scripts")
    await coordinator.async_refresh()
    assert _status(hass).state == "error"
    assert coordinator.data.git.ahead == 1
    assert coordinator.dirty

    (tmp_path / "away.git").rename(remote)
    response = await hass.services.async_call(DOMAIN, "git_sync_commit_push", {}, blocking=True, return_response=True)
    assert response["pushed"] is True
    assert git(repo, "log", "-1", "--format=%s", "origin/main").strip() == "feat: add scripts"
    assert _status(hass).state == "clean"
    assert not coordinator.dirty


async def test_remote_credentials_not_exposed(hass: HomeAssistant, repo: Path) -> None:
    """An HTTPS remote with a token: the token is in no state attribute."""
    git(repo, "remote", "set-url", "origin", "https://user:ghp_secret@github.com/me/ha.git")
    entry = _entry(repo)
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    states = [s for s in hass.states.async_all() if s.entity_id.startswith(("sensor.", "button."))]
    assert states
    for state in states:
        assert "ghp_secret" not in str(state.attributes), state.entity_id
    assert _status(hass).attributes["remote_url"] == "https://github.com/me/ha.git"


async def test_export_cleanup_spares_the_users_files(hass: HomeAssistant, repo: Path, tmp_path: Path) -> None:
    """Across a restart, the export removes a deleted dashboard's file but never the user's lovelace-*.yaml."""
    import json

    hass.config.config_dir = str(tmp_path / "config")
    storage = tmp_path / "config" / ".storage"
    storage.mkdir(parents=True)
    for name in ("lovelace", "lovelace.old"):
        (storage / name).write_text(json.dumps({"data": {"config": {"views": []}}}), encoding="utf-8")
    export_dir = repo / "dashboards"
    export_dir.mkdir()
    (export_dir / "lovelace-energy.yaml").write_text("views: []\n", encoding="utf-8")
    (export_dir / "lovelace_tablet.yaml").write_text("views: []\n", encoding="utf-8")

    entry = _entry(repo, **{CONF_EXPORT_DIR: str(export_dir)})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    assert await entry.runtime_data.git_sync.async_export_dashboards() == ["lovelace", "lovelace.old"]

    # Restart: the list of files written by the export survives it.
    assert await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    (storage / "lovelace.old").unlink()
    await hass.services.async_call(DOMAIN, "git_sync_export_dashboards", {}, blocking=True, return_response=True)
    assert sorted(p.name for p in export_dir.iterdir()) == ["lovelace", "lovelace-energy.yaml", "lovelace_tablet.yaml"]

    # Another export folder: the manifest of the first one deletes nothing there.
    other = repo / "other"
    other.mkdir()
    (other / "lovelace.old").write_text("mine\n", encoding="utf-8")
    hass.config_entries.async_update_entry(
        entry, options={**entry.options, "git_sync": {**entry.options["git_sync"], CONF_EXPORT_DIR: str(other)}}
    )
    await hass.async_block_till_done()
    await entry.runtime_data.git_sync.async_export_dashboards()
    assert (other / "lovelace.old").read_text(encoding="utf-8") == "mine\n"
    await hass.async_block_till_done()


def _dashboards(tmp_path: Path, hass: HomeAssistant, *names: str) -> Path:
    import json

    hass.config.config_dir = str(tmp_path / "config")
    storage = tmp_path / "config" / ".storage"
    storage.mkdir(parents=True)
    for name in names:
        (storage / name).write_text(json.dumps({"data": {"config": {"views": [{"title": name}]}}}), encoding="utf-8")
    return storage


async def test_export_spares_an_exported_file_the_user_reused(hass: HomeAssistant, repo: Path, tmp_path: Path) -> None:
    """An exported YAML edited by the user (now a YAML-mode dashboard) is not deleted with its dashboard."""
    storage = _dashboards(tmp_path, hass, "lovelace", "lovelace.dashboard_x")
    export_dir = repo / "dashboards"
    entry = _entry(repo, **{CONF_EXPORT_DIR: str(export_dir), "export_format": "yaml"})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    await entry.runtime_data.git_sync.async_export_dashboards()

    (export_dir / "lovelace.dashboard_x.yaml").write_text("views: [{title: Mine}]\n", encoding="utf-8")
    (storage / "lovelace.dashboard_x").unlink()
    # The hashes of what the export wrote survive a restart.
    assert await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    assert await entry.runtime_data.git_sync.async_export_dashboards() == ["lovelace.yaml"]
    assert (export_dir / "lovelace.dashboard_x.yaml").read_text(encoding="utf-8") == "views: [{title: Mine}]\n"
    await hass.async_block_till_done()


async def test_first_export_does_not_overwrite_the_users_file(hass: HomeAssistant, repo: Path, tmp_path: Path) -> None:
    """Never exported before: a file of the user with an export name stays as it is."""
    _dashboards(tmp_path, hass, "lovelace", "lovelace_resources")
    export_dir = repo / "dashboards"
    export_dir.mkdir()
    (export_dir / "lovelace_resources.yaml").write_text("mine: true\n", encoding="utf-8")
    entry = _entry(repo, **{CONF_EXPORT_DIR: str(export_dir), "export_format": "yaml"})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    assert await entry.runtime_data.git_sync.async_export_dashboards() == ["lovelace.yaml"]
    assert (export_dir / "lovelace_resources.yaml").read_text(encoding="utf-8") == "mine: true\n"
    await hass.async_block_till_done()


async def test_export_after_an_update_refreshes_the_old_files(
    hass: HomeAssistant, hass_storage: dict, repo: Path, tmp_path: Path
) -> None:
    """Update from 0.1.4 (an export done, no manifest): its exported files are refreshed, none deleted."""
    _dashboards(tmp_path, hass, "lovelace")
    export_dir = repo / "dashboards"
    export_dir.mkdir()
    (export_dir / "lovelace.yaml").write_text("views: []\n", encoding="utf-8")
    (export_dir / "lovelace.gone.yaml").write_text("views: []\n", encoding="utf-8")
    entry = _entry(repo, **{CONF_EXPORT_DIR: str(export_dir), "export_format": "yaml"})
    hass_storage[f"{DOMAIN}.git_sync"] = {
        "version": 1,
        "key": f"{DOMAIN}.{entry.entry_id}",
        "data": {
            "last_export": "2026-10-30T10:00:00+00:00",
            "last_export_files": ["lovelace.yaml", "lovelace.gone.yaml", "lovelace-energy.yaml"],
        },
    }
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    assert await entry.runtime_data.git_sync.async_export_dashboards() == ["lovelace.yaml"]
    assert "title: lovelace" in (export_dir / "lovelace.yaml").read_text(encoding="utf-8")
    assert (export_dir / "lovelace.gone.yaml").exists()
    await hass.async_block_till_done()


async def test_push_error_cleared_once_pushed_outside(hass: HomeAssistant, repo: Path, tmp_path: Path) -> None:
    """A failed push then fixed with `git push` in a terminal: the error does not stay forever."""
    import pytest
    from homeassistant.exceptions import HomeAssistantError

    entry = _entry(repo)
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    coordinator = entry.runtime_data.git_sync

    remote = tmp_path / "remote.git"
    remote.rename(tmp_path / "away.git")
    (repo / "scripts.yaml").write_text("{}\n", encoding="utf-8")
    with pytest.raises(HomeAssistantError):
        await coordinator.async_commit_push("feat: add scripts")
    await coordinator.async_refresh()
    assert _status(hass).state == "error"

    (tmp_path / "away.git").rename(remote)
    git(repo, "push", "-q")
    await coordinator.async_refresh()
    await hass.async_block_till_done()
    assert _status(hass).state == "clean"
    assert coordinator.data.last_error is None


async def test_failed_commit_keeps_the_error(hass: HomeAssistant, repo: Path) -> None:
    """A commit that fails leaves the files staged: the tree is dirty, the error is kept for the card."""
    from unittest.mock import patch

    import pytest
    from homeassistant.exceptions import HomeAssistantError

    from custom_components.system_hub.git_sync.git import GitError, GitRepo

    entry = _entry(repo)
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    coordinator = entry.runtime_data.git_sync

    (repo / "scripts.yaml").write_text("{}\n", encoding="utf-8")
    with (
        patch.object(GitRepo, "commit", side_effect=GitError("git commit failed: Author identity unknown")),
        pytest.raises(HomeAssistantError),
    ):
        await coordinator.async_commit_push("feat: add scripts")
    await coordinator.async_refresh()
    assert _status(hass).state == "dirty"
    assert coordinator.data.last_error == "git commit failed: Author identity unknown"


async def test_get_diff_service(hass: HomeAssistant, repo: Path) -> None:
    entry = git_sync_entry(
        domain=DOMAIN,
        unique_id=str(repo),
        data={CONF_REPO_PATH: str(repo), CONF_REMOTE: "origin", CONF_SSH_KEY: ""},
        options={CONF_COMMIT_INTERVAL: 0, CONF_EXPORT_ENABLED: False},
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    response = await hass.services.async_call(DOMAIN, "git_sync_get_diff", {}, blocking=True, return_response=True)
    assert response == {"files": [], "more_files": 0, "additions": 0, "deletions": 0}

    (repo / "configuration.yaml").write_text("default_config:\nlogger:\n", encoding="utf-8")
    response = await hass.services.async_call(DOMAIN, "git_sync_get_diff", {}, blocking=True, return_response=True)
    assert response["additions"] == 1
    (file,) = response["files"]
    assert file["path"] == "configuration.yaml"
    assert file["status"] == "modified"
    assert file["hunks"][0]["lines"][-1] == {"kind": "add", "old": None, "new": 2, "text": "logger:"}
    # Nothing was committed or staged by looking at the diff.
    assert git(repo, "status", "--porcelain").rstrip() == " M configuration.yaml"


@pytest.mark.parametrize(
    "service",
    [
        "git_sync_commit_push",
        "git_sync_export_dashboards",
        "git_sync_generate_message",
        "git_sync_get_diff",
        "git_sync_generate_ssh_key",
        "git_sync_pull",
    ],
)
async def test_services_require_admin(
    hass: HomeAssistant, repo: Path, hass_admin_user, hass_read_only_user, service: str
) -> None:
    entry = git_sync_entry(
        domain=DOMAIN,
        unique_id=str(repo),
        data={CONF_REPO_PATH: str(repo), CONF_REMOTE: "origin", CONF_SSH_KEY: ""},
        options={CONF_COMMIT_INTERVAL: 0, CONF_EXPORT_ENABLED: False},
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    (repo / "secrets.yaml").write_text("api_key: hunter2\n", encoding="utf-8")

    with pytest.raises(Unauthorized):
        await hass.services.async_call(
            DOMAIN, service, {}, blocking=True, return_response=True, context=Context(user_id=hass_read_only_user.id)
        )
    with pytest.raises(UnknownUser):
        await hass.services.async_call(
            DOMAIN, service, {}, blocking=True, return_response=True, context=Context(user_id="unknown")
        )
    # Nothing was committed by the refused calls.
    assert git(repo, "status", "--porcelain").rstrip() == "?? secrets.yaml"


async def test_admin_can_call_the_services(hass: HomeAssistant, repo: Path, hass_admin_user) -> None:
    entry = git_sync_entry(
        domain=DOMAIN,
        unique_id=str(repo),
        data={CONF_REPO_PATH: str(repo), CONF_REMOTE: "origin", CONF_SSH_KEY: ""},
        options={CONF_COMMIT_INTERVAL: 0, CONF_EXPORT_ENABLED: False},
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    context = Context(user_id=hass_admin_user.id)

    (repo / "configuration.yaml").write_text("default_config:\nlogger:\n", encoding="utf-8")
    response = await hass.services.async_call(
        DOMAIN, "git_sync_get_diff", {}, blocking=True, return_response=True, context=context
    )
    assert response["additions"] == 1
    response = await hass.services.async_call(
        DOMAIN,
        "git_sync_commit_push",
        {"message": "feat: logger"},
        blocking=True,
        return_response=True,
        context=context,
    )
    assert response["pushed"] is True
    assert git(repo, "log", "-1", "--format=%s", "origin/main").strip() == "feat: logger"


def _issue(hass: HomeAssistant, key: str, entry: MockConfigEntry):
    from homeassistant.helpers import issue_registry as ir

    return ir.async_get(hass).async_get_issue(DOMAIN, f"{key}_{entry.entry_id}")


async def _setup(hass: HomeAssistant, entry: MockConfigEntry):
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry.runtime_data.git_sync


async def test_status_refresh_fetches_the_remote(hass: HomeAssistant, repo: Path, tmp_path: Path) -> None:
    """The polling fetches (at most every fetch_interval): a commit pushed elsewhere shows as behind."""
    coordinator = await _setup(hass, _entry(repo))
    push_from(clone(tmp_path), "automations.yaml", "[]\n")

    # The first refresh (setup) does not fetch; the next one does, then not before the interval.
    await coordinator.async_refresh()
    assert _status(hass).state == "behind"
    assert _status(hass).attributes["behind"] == 1
    push_from(tmp_path / "other", "scripts.yaml", "{}\n")
    await coordinator.async_refresh()
    assert _status(hass).attributes["behind"] == 1

    coordinator._last_fetch -= 15 * 60
    await coordinator.async_refresh()
    assert _status(hass).attributes["behind"] == 2


async def test_fetch_interval_zero_does_not_fetch(hass: HomeAssistant, repo: Path, tmp_path: Path) -> None:
    from custom_components.system_hub.git_sync.const import CONF_FETCH_INTERVAL

    coordinator = await _setup(hass, _entry(repo, **{CONF_FETCH_INTERVAL: 0}))
    push_from(clone(tmp_path), "automations.yaml", "[]\n")
    await coordinator.async_refresh()
    assert _status(hass).state == "clean"


async def test_commit_pulls_the_remote_commits_first(hass: HomeAssistant, repo: Path, tmp_path: Path) -> None:
    """The remote moved: the commit is rebased on it (pull --rebase) and pushed, history stays linear."""
    coordinator = await _setup(hass, _entry(repo))
    push_from(clone(tmp_path), "automations.yaml", "[]\n")

    (repo / "scripts.yaml").write_text("{}\n", encoding="utf-8")
    result = await coordinator.async_commit_push("feat: add scripts")
    assert (result.committed, result.pushed) == (True, True)
    log = git(repo, "log", "--format=%s", "origin/main").split("\n")
    assert log[:3] == ["feat: add scripts", "chore: automations.yaml from elsewhere", "chore: initial"]
    assert git(repo, "rev-list", "--merges", "--count", "HEAD").strip() == "0"
    assert _status(hass).state == "clean"


async def test_diverged_is_not_pushed_and_raises_a_repair(hass: HomeAssistant, repo: Path, tmp_path: Path) -> None:
    """Local commits never pushed and new remote commits: nothing is committed or pushed, a repair explains."""
    from homeassistant.exceptions import HomeAssistantError

    entry = _entry(repo)
    coordinator = await _setup(hass, entry)
    (repo / "scripts.yaml").write_text("{}\n", encoding="utf-8")
    git(repo, "add", "-A")
    git(repo, "commit", "-q", "-m", "feat: local commit")
    push_from(clone(tmp_path), "automations.yaml", "[]\n")
    remote_head = git(tmp_path / "remote.git", "rev-parse", "main")

    (repo / "groups.yaml").write_text("{}\n", encoding="utf-8")
    with pytest.raises(HomeAssistantError) as err:
        await coordinator.async_commit_push("feat: groups")
    assert err.value.translation_key == "diverged"
    assert err.value.translation_placeholders["behind"] == "1"
    assert coordinator.data.last_error.startswith("The local branch and origin have diverged")
    assert git(tmp_path / "remote.git", "rev-parse", "main") == remote_head
    assert git(repo, "log", "-1", "--format=%s").strip() == "feat: local commit"
    issue = _issue(hass, "git_sync_push_blocked", entry)
    assert issue is not None
    assert issue.translation_key == "diverged"
    assert issue.translation_placeholders["upstream"] == "origin/main"
    await coordinator.async_refresh()
    assert _status(hass).state == "diverged"
    assert not coordinator.dirty

    # Resolved in a terminal, then Commit and push: pushed, the repair is gone.
    git(repo, "pull", "-q", "--rebase", "--autostash")
    result = await coordinator.async_commit_push("feat: groups")
    assert result.pushed
    assert git(tmp_path / "remote.git", "log", "-1", "--format=%s", "main").strip() == "feat: groups"
    assert _issue(hass, "git_sync_push_blocked", entry) is None


async def test_rebase_conflict_is_aborted_and_not_pushed(hass: HomeAssistant, repo: Path, tmp_path: Path) -> None:
    from homeassistant.exceptions import HomeAssistantError

    entry = _entry(repo)
    coordinator = await _setup(hass, entry)
    push_from(clone(tmp_path), "configuration.yaml", "default_config:\nhttp:\n")
    remote_head = git(tmp_path / "remote.git", "rev-parse", "main")

    (repo / "configuration.yaml").write_text("default_config:\nlogger:\n", encoding="utf-8")
    with pytest.raises(HomeAssistantError) as err:
        await coordinator.async_commit_push("feat: logger")
    assert err.value.translation_key == "rebase_conflict"
    assert git(tmp_path / "remote.git", "rev-parse", "main") == remote_head
    assert not (repo / ".git" / "rebase-merge").exists()
    assert (repo / "configuration.yaml").read_text(encoding="utf-8") == "default_config:\nlogger:\n"
    assert _issue(hass, "git_sync_push_blocked", entry).translation_key == "diverged"
    await coordinator.async_refresh()
    assert _status(hass).state == "diverged"


async def test_behind_without_pull_before_push(hass: HomeAssistant, repo: Path, tmp_path: Path) -> None:
    from homeassistant.exceptions import HomeAssistantError

    from custom_components.system_hub.git_sync.const import CONF_PULL_BEFORE_PUSH

    entry = _entry(repo, **{CONF_PULL_BEFORE_PUSH: False})
    coordinator = await _setup(hass, entry)
    push_from(clone(tmp_path), "automations.yaml", "[]\n")
    (repo / "scripts.yaml").write_text("{}\n", encoding="utf-8")
    with pytest.raises(HomeAssistantError) as err:
        await coordinator.async_commit_push("feat: add scripts")
    assert err.value.translation_key == "behind_remote"
    assert git(repo, "log", "-1", "--format=%s").strip() == "chore: initial"
    assert _issue(hass, "git_sync_push_blocked", entry).translation_key == "behind_remote"


async def test_sensitive_files_block_the_commit(hass: HomeAssistant, repo: Path, tmp_path: Path) -> None:
    """A new secrets.yaml is never committed; a tracked .storage file only when allowed."""
    from homeassistant.exceptions import ServiceValidationError

    from custom_components.system_hub.git_sync.const import CONF_ALLOW_SENSITIVE

    entry = _entry(repo)
    coordinator = await _setup(hass, entry)
    (repo / "secrets.yaml").write_text("wifi: hunter2\n", encoding="utf-8")
    (repo / "scripts.yaml").write_text("{}\n", encoding="utf-8")
    with pytest.raises(ServiceValidationError) as err:
        await coordinator.async_commit_push("feat: add scripts")
    assert err.value.translation_key == "sensitive_files"
    assert err.value.translation_placeholders == {"files": "secrets.yaml"}
    assert git(repo, "log", "-1", "--format=%s").strip() == "chore: initial"
    # Neither committed nor staged.
    assert git(repo, "diff", "--cached", "--name-only").strip() == ""
    assert git(tmp_path / "remote.git", "log", "-1", "--format=%s", "main").strip() == "chore: initial"

    # A .storage file committed by hand earlier: refused, unless allowed in the options.
    (repo / "secrets.yaml").unlink()
    (repo / ".storage").mkdir()
    (repo / ".storage" / "lovelace").write_text("{}\n", encoding="utf-8")
    git(repo, "add", "-A")
    git(repo, "commit", "-q", "-m", "chore: storage")
    (repo / ".storage" / "lovelace").write_text('{"views": []}\n', encoding="utf-8")
    with pytest.raises(ServiceValidationError):
        await coordinator.async_commit_push("feat: dashboard")

    hass.config_entries.async_update_entry(
        entry, options={**entry.options, "git_sync": {**entry.options["git_sync"], CONF_ALLOW_SENSITIVE: True}}
    )
    await hass.async_block_till_done()
    result = await entry.runtime_data.git_sync.async_commit_push("feat: dashboard")
    assert result.pushed
    assert git(tmp_path / "remote.git", "log", "-1", "--format=%s", "main").strip() == "feat: dashboard"


async def test_ai_prompt_is_redacted_and_refuses_secrets(hass: HomeAssistant, repo: Path) -> None:
    from homeassistant.exceptions import ServiceValidationError

    from custom_components.system_hub.git_sync.const import CONF_AI_TASK_ENTITY

    calls = _mock_ai_task(hass, "feat: mqtt broker")
    await _setup(hass, _entry(repo, **{CONF_AI_TASK_ENTITY: "ai_task.test"}))
    (repo / "configuration.yaml").write_text(
        "default_config:\nmqtt:\n  username: ha\n  password: hunter2\n  client_secret: s3cr3t\n", encoding="utf-8"
    )
    response = await hass.services.async_call(
        DOMAIN, "git_sync_generate_message", {}, blocking=True, return_response=True
    )
    assert response == {"message": "feat: mqtt broker"}
    prompt = calls[0]["instructions"]
    assert "username: ha" in prompt
    assert "hunter2" not in prompt
    assert "s3cr3t" not in prompt
    assert "password: <redacted>" in prompt

    # A sensitive file is not even sent to the AI task.
    (repo / "secrets.yaml").write_text("wifi: hunter2\n", encoding="utf-8")
    with pytest.raises(ServiceValidationError):
        await hass.services.async_call(DOMAIN, "git_sync_generate_message", {}, blocking=True, return_response=True)
    assert len(calls) == 1


async def test_gitignore_repair_and_fix_flow(hass: HomeAssistant, repo: Path) -> None:
    from custom_components.system_hub.repairs import async_create_fix_flow

    entry = _entry(repo)
    await _setup(hass, entry)
    issue = _issue(hass, "git_sync_gitignore_missing", entry)
    assert issue is not None
    assert issue.is_fixable
    assert issue.translation_placeholders["lines"] == "- `secrets.yaml`\n- `.storage/`"

    flow = await async_create_fix_flow(hass, issue.issue_id, issue.data)
    flow.hass = hass
    flow.handler = DOMAIN
    flow.issue_id = issue.issue_id
    form = await flow.async_step_init()
    assert form["type"] is FlowResultType.FORM
    assert form["step_id"] == "confirm"
    assert form["description_placeholders"]["repo"] == str(repo)
    # Nothing written before the confirmation.
    assert not (repo / ".gitignore").exists()

    done = await flow.async_step_confirm({})
    assert done["type"] is FlowResultType.CREATE_ENTRY
    lines = (repo / ".gitignore").read_text(encoding="utf-8").splitlines()
    assert "secrets.yaml" in lines
    assert ".storage/" in lines
    assert _issue(hass, "git_sync_gitignore_missing", entry) is None


async def test_gitignore_covering_secrets_raises_no_repair(hass: HomeAssistant, repo: Path) -> None:
    (repo / ".gitignore").write_text("secrets.yaml\n.storage\n", encoding="utf-8")
    entry = _entry(repo)
    await _setup(hass, entry)
    assert _issue(hass, "git_sync_gitignore_missing", entry) is None


async def test_secret_written_during_the_commit_is_unstaged(hass: HomeAssistant, repo: Path, tmp_path: Path) -> None:
    """A sensitive file appearing between the check and `git add -A` is caught on the real index and unstaged."""
    from homeassistant.exceptions import ServiceValidationError

    coordinator = await _setup(hass, _entry(repo))
    stage_all = coordinator.repo.stage_all

    async def racing_stage_all():
        (repo / "secrets.yaml").write_text("wifi: hunter2\n", encoding="utf-8")
        return await stage_all()

    coordinator.repo.stage_all = racing_stage_all
    (repo / "scripts.yaml").write_text("{}\n", encoding="utf-8")
    with pytest.raises(ServiceValidationError) as err:
        await coordinator.async_commit_push("feat: add scripts")
    assert err.value.translation_placeholders == {"files": "secrets.yaml"}
    assert git(repo, "log", "-1", "--format=%s").strip() == "chore: initial"
    assert git(repo, "diff", "--cached", "--name-only").strip() == ""
    assert git(tmp_path / "remote.git", "log", "-1", "--format=%s", "main").strip() == "chore: initial"


async def test_blocked_auto_commit_warns_once_until_the_changes_differ(
    hass: HomeAssistant, repo: Path, tmp_path: Path, caplog: pytest.LogCaptureFixture
) -> None:
    from custom_components.system_hub.git_sync.const import CONF_PULL_BEFORE_PUSH

    coordinator = await _setup(hass, _entry(repo, **{CONF_PULL_BEFORE_PUSH: False}))
    attempts = 0
    commit_push = coordinator.async_commit_push

    async def counting_commit_push(*args):
        nonlocal attempts
        attempts += 1
        return await commit_push(*args)

    coordinator.async_commit_push = counting_commit_push

    # Sensitive file: refused once, with a warning and no traceback, then skipped while nothing changes.
    (repo / "secrets.yaml").write_text("wifi: hunter2\n", encoding="utf-8")
    for _ in range(3):
        await coordinator.async_refresh()
        await coordinator.async_auto_commit()
    assert attempts == 1
    warnings = [r for r in caplog.records if "Automatic commit skipped" in r.getMessage()]
    assert len(warnings) == 1
    assert warnings[0].levelname == "WARNING"
    assert warnings[0].exc_info is None

    # Another file changed: tried again (still refused).
    (repo / "scripts.yaml").write_text("{}\n", encoding="utf-8")
    await coordinator.async_refresh()
    await coordinator.async_auto_commit()
    assert attempts == 2

    # Behind with Pull before push off: blocked once, then skipped.
    (repo / "secrets.yaml").unlink()
    push_from(clone(tmp_path), "automations.yaml", "[]\n")
    for _ in range(2):
        await coordinator.async_refresh()
        await coordinator.async_auto_commit()
    assert attempts == 3
    assert git(repo, "log", "-1", "--format=%s").strip() == "chore: initial"

    # Resolved (pulled): committed and pushed at the next interval.
    git(repo, "pull", "-q", "--rebase", "--autostash")
    await coordinator.async_refresh()
    await coordinator.async_auto_commit()
    assert attempts == 4
    assert git(tmp_path / "remote.git", "log", "-1", "--format=%s", "main").strip().startswith("chore: update")


async def test_pull_action(hass: HomeAssistant, repo: Path, tmp_path: Path, hass_admin_user) -> None:
    """Behind: fast-forward; nothing new: 0; diverged: local commits rebased, unless the work tree has changes."""
    from homeassistant.exceptions import HomeAssistantError

    coordinator = await _setup(hass, _entry(repo))
    other = clone(tmp_path)
    push_from(other, "automations.yaml", "[]\n")
    await coordinator.async_refresh()
    assert _status(hass).state == "behind"

    context = Context(user_id=hass_admin_user.id)
    response = await hass.services.async_call(
        DOMAIN, "git_sync_pull", {}, blocking=True, return_response=True, context=context
    )
    assert response["pulled"] == 1
    assert git(repo, "rev-parse", "HEAD") == git(tmp_path / "remote.git", "rev-parse", "main")
    assert _status(hass).state == "clean"
    response = await hass.services.async_call(DOMAIN, "git_sync_pull", {}, blocking=True, return_response=True)
    assert response["pulled"] == 0

    # Behind with a change in the work tree (nothing ahead): fast-forward, the change is kept.
    push_from(other, "customize.yaml", "{}\n")
    (repo / "configuration.yaml").write_text("default_config:\nlogger:\n", encoding="utf-8")
    await coordinator.async_refresh()
    assert _status(hass).state == "dirty"
    assert await coordinator.async_pull() == 1
    assert git(repo, "rev-parse", "HEAD") == git(tmp_path / "remote.git", "rev-parse", "main")
    assert (repo / "configuration.yaml").read_text(encoding="utf-8") == "default_config:\nlogger:\n"
    git(repo, "checkout", "--", "configuration.yaml")

    # Diverged with a change in the work tree: refused, nothing moved.
    (repo / "scripts.yaml").write_text("{}\n", encoding="utf-8")
    git(repo, "add", "-A")
    git(repo, "commit", "-q", "-m", "feat: local commit")
    push_from(other, "groups.yaml", "{}\n")
    (repo / "configuration.yaml").write_text("default_config:\nlogger:\n", encoding="utf-8")
    head = git(repo, "rev-parse", "HEAD")
    with pytest.raises(HomeAssistantError) as err:
        await coordinator.async_pull()
    assert err.value.translation_key == "diverged"
    assert git(repo, "rev-parse", "HEAD") == head

    # Clean work tree: the local commit is rebased on the remote one, not pushed.
    git(repo, "checkout", "--", "configuration.yaml")
    assert await coordinator.async_pull() == 1
    assert git(repo, "log", "--format=%s", "-3").split("\n")[:3] == [
        "feat: local commit",
        "chore: groups.yaml from elsewhere",
        "chore: customize.yaml from elsewhere",
    ]
    assert _status(hass).state == "ahead"


async def test_notification_image_with_a_query_string(hass: HomeAssistant, repo: Path) -> None:
    from pytest_homeassistant_custom_component.common import async_mock_service

    from custom_components.system_hub.git_sync.const import CONF_NOTIFY_IMAGE, CONF_NOTIFY_SERVICE

    calls = async_mock_service(hass, "notify", "mobile_app_phone")
    coordinator = await _setup(
        hass,
        _entry(repo, **{CONF_NOTIFY_SERVICE: "notify.mobile_app_phone", CONF_NOTIFY_IMAGE: "https://x/git.png?v=2"}),
    )
    (repo / "scripts.yaml").write_text("{}\n", encoding="utf-8")
    await coordinator.async_commit_push("feat: add scripts")
    await hass.async_block_till_done()
    assert calls[0].data["data"]["attachment"] == {"url": "https://x/git.png?v=2", "content-type": "png"}


async def test_failed_auto_commit_warns_once_per_message_and_retries(
    hass: HomeAssistant, repo: Path, tmp_path: Path, caplog: pytest.LogCaptureFixture
) -> None:
    """A push failure is retried at every interval, logged once per distinct message, without a traceback."""
    coordinator = await _setup(hass, _entry(repo))
    remote = git(repo, "remote", "get-url", "origin").strip()
    git(repo, "remote", "set-url", "origin", str(tmp_path / "missing.git"))
    (repo / "scripts.yaml").write_text("{}\n", encoding="utf-8")
    for _ in range(3):
        await coordinator.async_refresh()
        await coordinator.async_auto_commit()
    failures = [r for r in caplog.records if "Automatic commit failed" in r.getMessage()]
    assert len(failures) == 1
    assert failures[0].levelname == "WARNING"
    assert failures[0].exc_info is None
    assert _status(hass).state == "error"

    # Reachable again: the pending commit is pushed; a new failure afterwards is logged again.
    git(repo, "remote", "set-url", "origin", remote)
    await coordinator.async_refresh()
    await coordinator.async_auto_commit()
    assert git(tmp_path / "remote.git", "rev-parse", "main") == git(repo, "rev-parse", "HEAD")
    git(repo, "remote", "set-url", "origin", str(tmp_path / "missing.git"))
    (repo / "groups.yaml").write_text("{}\n", encoding="utf-8")
    await coordinator.async_refresh()
    await coordinator.async_auto_commit()
    failures = [r for r in caplog.records if "Automatic commit failed" in r.getMessage()]
    assert len(failures) == 2
