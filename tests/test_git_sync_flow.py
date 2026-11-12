"""Git Sync module in the config and options flows: the repository is checked before it is saved."""

from __future__ import annotations

from pathlib import Path

import pytest
import voluptuous as vol
from homeassistant import config_entries
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.system_hub.const import CONF_MODULES, DOMAIN
from custom_components.system_hub.git_sync.const import (
    CONF_AUTHOR_EMAIL,
    CONF_AUTHOR_NAME,
    CONF_BRANCH,
    CONF_COMMIT_INTERVAL,
    CONF_EXPORT_DIR,
    CONF_EXPORT_ENABLED,
    CONF_NOTIFY_IMAGE,
    CONF_NOTIFY_SERVICE,
    CONF_REMOTE,
    CONF_REPO_PATH,
    CONF_SSH_KEY,
)

from .conftest import git, git_sync_entry

ONLY_GIT_SYNC = {
    "containers": False,
    "logs": False,
    "database": False,
    "security": False,
    "watchdog": False,
    "marketplace": False,
    "batteries": False,
    "git_sync": True,
    "orphans": False,
}


def _repository(repo: Path, **extra) -> dict:
    return {CONF_REPO_PATH: str(repo), CONF_REMOTE: "origin", CONF_SSH_KEY: "", **extra}


async def test_git_sync_is_off_by_default(hass: HomeAssistant) -> None:
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
    defaults = {str(key): key.default() for key in result["data_schema"].schema}
    assert defaults["git_sync"] is False


async def test_setup_checks_the_repository(hass: HomeAssistant, repo: Path, tmp_path: Path) -> None:
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
    result = await hass.config_entries.flow.async_configure(result["flow_id"], ONLY_GIT_SYNC)
    assert result["step_id"] == "git_sync_repository"

    bad = await hass.config_entries.flow.async_configure(result["flow_id"], _repository(tmp_path))
    assert bad["errors"] == {CONF_REPO_PATH: "not_a_repository"}
    bad = await hass.config_entries.flow.async_configure(result["flow_id"], _repository(repo, remote="upstream"))
    assert bad["errors"] == {CONF_REMOTE: "unknown_remote"}

    done = await hass.config_entries.flow.async_configure(result["flow_id"], _repository(repo, repo_path=f"{repo}/"))
    assert done["type"] is FlowResultType.CREATE_ENTRY
    assert done["options"][CONF_MODULES] == ["git_sync"]
    assert done["options"]["git_sync"][CONF_REPO_PATH] == str(repo)
    await hass.async_block_till_done()
    assert hass.states.get("button.system_hub_versioning_commit_and_push") is not None


@pytest.mark.parametrize("branch", ["main..", "a b", "-x", "feature/"])
async def test_a_branch_name_git_refuses(hass: HomeAssistant, repo: Path, branch: str) -> None:
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
    result = await hass.config_entries.flow.async_configure(result["flow_id"], ONLY_GIT_SYNC)
    bad = await hass.config_entries.flow.async_configure(result["flow_id"], _repository(repo, branch=branch))
    assert bad["errors"] == {CONF_BRANCH: "invalid_branch"}
    done = await hass.config_entries.flow.async_configure(result["flow_id"], _repository(repo, branch="release/1.x"))
    assert done["type"] is FlowResultType.CREATE_ENTRY


async def test_a_git_identity_is_required(hass: HomeAssistant, repo: Path, monkeypatch) -> None:
    git(repo, "config", "--unset", "user.name")
    git(repo, "config", "--unset", "user.email")
    monkeypatch.setenv("GIT_CONFIG_GLOBAL", "/dev/null")
    monkeypatch.setenv("GIT_CONFIG_NOSYSTEM", "1")
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
    result = await hass.config_entries.flow.async_configure(result["flow_id"], ONLY_GIT_SYNC)
    bad = await hass.config_entries.flow.async_configure(result["flow_id"], _repository(repo))
    assert bad["errors"] == {CONF_AUTHOR_EMAIL: "author_required"}
    done = await hass.config_entries.flow.async_configure(
        result["flow_id"], _repository(repo, author_name="Jane", author_email="jane@example.com")
    )
    assert done["type"] is FlowResultType.CREATE_ENTRY


async def test_turned_on_in_the_options_asks_for_the_repository(hass: HomeAssistant, repo: Path) -> None:
    entry = MockConfigEntry(domain=DOMAIN, title="System Hub", options={CONF_MODULES: []})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    result = await hass.config_entries.options.async_init(entry.entry_id, context={"source": "system_hub_panel"})
    result = await hass.config_entries.options.async_configure(result["flow_id"], {"next_step_id": "modules"})
    result = await hass.config_entries.options.async_configure(result["flow_id"], ONLY_GIT_SYNC)
    assert result["step_id"] == "git_sync_repository"
    done = await hass.config_entries.options.async_configure(result["flow_id"], _repository(repo))
    assert done["type"] is FlowResultType.CREATE_ENTRY
    await hass.async_block_till_done()
    assert entry.options[CONF_MODULES] == ["git_sync"]
    assert entry.runtime_data.git_sync is not None

    result = await hass.config_entries.options.async_init(entry.entry_id, context={"source": "system_hub_panel"})
    assert result["menu_options"] == ["modules", "system", "git_sync_repository", "git_sync", "git_sync_add_repository"]


async def test_turned_on_without_a_repository_is_skipped(hass: HomeAssistant) -> None:
    """Options set by hand without a repository: the rest of System Hub still loads."""
    entry = MockConfigEntry(domain=DOMAIN, title="System Hub", options={CONF_MODULES: ["git_sync"]})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    assert entry.runtime_data.git_sync is None


async def _setup(hass: HomeAssistant, repo: Path, **options) -> MockConfigEntry:
    entry = git_sync_entry(
        data={CONF_REPO_PATH: str(repo), CONF_REMOTE: "origin", CONF_SSH_KEY: ""},
        options={CONF_COMMIT_INTERVAL: 0, CONF_EXPORT_ENABLED: False, **options},
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


def _defaults(schema) -> dict:
    return {str(key): key.default() for key in schema.schema if key.default is not vol.UNDEFINED}


async def _options_form(hass: HomeAssistant, entry: MockConfigEntry):
    result = await hass.config_entries.options.async_init(entry.entry_id, context={"source": "system_hub_panel"})
    return await hass.config_entries.options.async_configure(result["flow_id"], {"next_step_id": "git_sync"})


async def test_options_can_be_emptied(hass: HomeAssistant, repo: Path) -> None:
    """A text field emptied (left out by the frontend) is stored empty, not restored; the repository is kept."""
    entry = await _setup(hass, repo, **{CONF_NOTIFY_SERVICE: "notify.notify", CONF_NOTIFY_IMAGE: "https://x/a.png"})
    form = await _options_form(hass, entry)
    user_input = {
        k: v for k, v in _defaults(form["data_schema"]).items() if k not in (CONF_NOTIFY_SERVICE, CONF_NOTIFY_IMAGE)
    }
    done = await hass.config_entries.options.async_configure(form["flow_id"], user_input)
    assert done["type"] is FlowResultType.CREATE_ENTRY
    await hass.async_block_till_done()
    settings = entry.options["git_sync"]
    assert settings[CONF_NOTIFY_SERVICE] == ""
    assert settings[CONF_NOTIFY_IMAGE] == ""
    assert settings[CONF_REPO_PATH] == str(repo)


async def test_options_refuse_an_unknown_action_and_folder(hass: HomeAssistant, repo: Path, tmp_path: Path) -> None:
    entry = await _setup(hass, repo)
    form = await _options_form(hass, entry)
    user_input = _defaults(form["data_schema"])
    bad = await hass.config_entries.options.async_configure(
        form["flow_id"], {**user_input, CONF_NOTIFY_SERVICE: "notify.nowhere", CONF_EXPORT_DIR: "/etc"}
    )
    assert bad["errors"] == {
        CONF_NOTIFY_SERVICE: "unknown_notify_service",
        CONF_EXPORT_DIR: "export_dir_not_allowed",
    }


async def test_repository_can_be_changed_and_emptied(hass: HomeAssistant, repo: Path) -> None:
    entry = await _setup(hass, repo, **{CONF_BRANCH: "main", CONF_AUTHOR_NAME: "Jane"})
    result = await hass.config_entries.options.async_init(entry.entry_id, context={"source": "system_hub_panel"})
    result = await hass.config_entries.options.async_configure(
        result["flow_id"], {"next_step_id": "git_sync_repository"}
    )
    done = await hass.config_entries.options.async_configure(result["flow_id"], _repository(repo))
    assert done["type"] is FlowResultType.CREATE_ENTRY
    await hass.async_block_till_done()
    settings = entry.options["git_sync"]
    assert settings[CONF_BRANCH] == ""
    assert settings[CONF_AUTHOR_NAME] == ""
    assert settings[CONF_COMMIT_INTERVAL] == 0
