"""Several repositories in the Git Sync module, as the former Git Sync integration had one entry per repository."""

from __future__ import annotations

import subprocess
from pathlib import Path

import pytest
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType
from homeassistant.exceptions import ServiceValidationError
from homeassistant.helpers import device_registry as dr
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.system_hub.const import DOMAIN
from custom_components.system_hub.git_sync.const import (
    CONF_COMMIT_INTERVAL,
    CONF_EXPORT_ENABLED,
    CONF_EXPORT_FORMAT,
    CONF_REMOTE,
    CONF_REPO_ID,
    CONF_REPO_PATH,
    CONF_REPOSITORIES,
    CONF_SSH_KEY,
)

from .conftest import git

PANEL = {"source": "system_hub_panel"}


def _repository(tmp_path: Path, name: str) -> Path:
    """A repository with one commit, tracking its own bare remote."""
    remote = tmp_path / f"{name}.git"
    work = tmp_path / name
    subprocess.run(["git", "init", "--bare", "-q", "-b", "main", str(remote)], check=True)
    subprocess.run(["git", "init", "-q", "-b", "main", str(work)], check=True)
    git(work, "config", "user.name", "Test")
    git(work, "config", "user.email", "test@example.com")
    (work / "configuration.yaml").write_text("default_config:\n", encoding="utf-8")
    git(work, "add", "-A")
    git(work, "commit", "-q", "-m", "chore: initial")
    git(work, "remote", "add", "origin", str(remote))
    git(work, "push", "-q", "-u", "origin", "main")
    return work


def _settings(path: Path, **extra) -> dict:
    return {
        CONF_REPO_PATH: str(path),
        CONF_REMOTE: "origin",
        CONF_SSH_KEY: "",
        CONF_COMMIT_INTERVAL: 0,
        CONF_EXPORT_ENABLED: False,
        **extra,
    }


async def _setup(hass: HomeAssistant, first: Path, further: list[dict]) -> MockConfigEntry:
    entry = MockConfigEntry(
        domain=DOMAIN,
        options={"modules": ["git_sync"], "git_sync": _settings(first), CONF_REPOSITORIES: further},
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


def _statuses(hass: HomeAssistant) -> dict[str, str]:
    """Status sensor of each repository, by its path."""
    return {
        s.attributes["repository"]: s.entity_id
        for s in hass.states.async_all("sensor")
        if s.attributes.get("changed_count") is not None
    }


async def test_two_repositories_each_with_its_device_and_entities(hass: HomeAssistant, tmp_path: Path) -> None:
    first = _repository(tmp_path, "config")
    second = _repository(tmp_path, "esphome")
    entry = await _setup(hass, first, [_settings(second, **{CONF_REPO_ID: "esp1"})])
    statuses = _statuses(hass)
    assert set(statuses) == {str(first), str(second)}
    # The first one keeps the module's entity ids; the further one is named after its folder
    assert statuses[str(first)] == "sensor.system_hub_versioning_status"
    assert statuses[str(second)] == "sensor.system_hub_versioning_esphome_status"
    devices = {d.name for d in dr.async_entries_for_config_entry(dr.async_get(hass), entry.entry_id)}
    assert {"System Hub Versioning", "System Hub Versioning (esphome)"} <= devices
    assert [c.repo_id for c in entry.runtime_data.git_syncs] == ["", "esp1"]


async def test_actions_on_every_repository_or_the_one_named(hass: HomeAssistant, tmp_path: Path) -> None:
    first = _repository(tmp_path, "config")
    second = _repository(tmp_path, "esphome")
    await _setup(hass, first, [_settings(second, **{CONF_REPO_ID: "esp1"})])
    for work in (first, second):
        (work / "scripts.yaml").write_text("{}\n", encoding="utf-8")

    # Named (a trailing slash allowed): only that repository
    response = await hass.services.async_call(
        DOMAIN,
        "git_sync_commit_push",
        {"message": "feat: esphome", "repository": f"{second}/"},
        blocking=True,
        return_response=True,
    )
    assert response["committed"] is True
    assert response["results"] == [
        {"repository": str(second), "committed": True, "pushed": True, "message": "feat: esphome"}
    ]
    assert git(first, "status", "--porcelain").strip() == "?? scripts.yaml"

    # Left out: commit and push on every repository, the first one's result at the top
    (second / "groups.yaml").write_text("{}\n", encoding="utf-8")
    response = await hass.services.async_call(
        DOMAIN, "git_sync_commit_push", {"message": "feat: all"}, blocking=True, return_response=True
    )
    assert response["committed"] is True
    assert [r["repository"] for r in response["results"]] == [str(first), str(second)]
    assert git(first, "log", "-1", "--format=%s", "origin/main").strip() == "feat: all"
    assert git(second, "log", "-1", "--format=%s", "origin/main").strip() == "feat: all"

    # By id too; an unknown one is refused, naming the repositories set up
    await hass.services.async_call(
        DOMAIN, "git_sync_get_diff", {"repository": "esp1"}, blocking=True, return_response=True
    )
    with pytest.raises(ServiceValidationError) as err:
        await hass.services.async_call(
            DOMAIN, "git_sync_pull", {"repository": "/nowhere"}, blocking=True, return_response=True
        )
    assert err.value.translation_key == "unknown_repository"
    assert str(second) in err.value.translation_placeholders["repositories"]


async def test_a_single_repository_answers_as_before(hass: HomeAssistant, tmp_path: Path) -> None:
    first = _repository(tmp_path, "config")
    await _setup(hass, first, [])
    response = await hass.services.async_call(DOMAIN, "git_sync_commit_push", {}, blocking=True, return_response=True)
    assert response == {"committed": False, "pushed": False, "message": None}


async def test_add_set_and_remove_a_repository(hass: HomeAssistant, tmp_path: Path) -> None:
    first = _repository(tmp_path, "config")
    second = _repository(tmp_path, "esphome")
    entry = await _setup(hass, first, [])

    async def step(step_id: str, user_input: dict | None = None) -> dict:
        result = await hass.config_entries.options.async_init(entry.entry_id, context=PANEL)
        assert step_id in result["menu_options"]
        result = await hass.config_entries.options.async_configure(result["flow_id"], {"next_step_id": step_id})
        if user_input is not None:
            result = await hass.config_entries.options.async_configure(result["flow_id"], user_input)
        return result

    # The first repository again: refused
    duplicate = await step(
        "git_sync_add_repository", {CONF_REPO_PATH: str(first), CONF_REMOTE: "origin", CONF_SSH_KEY: ""}
    )
    assert duplicate["errors"] == {CONF_REPO_PATH: "repository_exists"}

    added = await step(
        "git_sync_add_repository", {CONF_REPO_PATH: str(second), CONF_REMOTE: "origin", CONF_SSH_KEY: ""}
    )
    assert added["type"] is FlowResultType.CREATE_ENTRY
    await hass.async_block_till_done()
    [further] = entry.options[CONF_REPOSITORIES]
    repo_id = further[CONF_REPO_ID]
    assert further[CONF_REPO_PATH] == str(second)
    assert str(second) in _statuses(hass)

    # Its own settings: which one, its repository, then its options
    form = await step("git_sync_other", {CONF_REPO_ID: repo_id})
    assert form["step_id"] == "git_sync_other_repository"
    form = await hass.config_entries.options.async_configure(
        form["flow_id"], {CONF_REPO_PATH: str(second), CONF_REMOTE: "origin", CONF_SSH_KEY: ""}
    )
    assert form["step_id"] == "git_sync_other_options"
    done = await hass.config_entries.options.async_configure(
        form["flow_id"], {CONF_COMMIT_INTERVAL: 0, CONF_EXPORT_FORMAT: "yaml", "commit_language": "en"}
    )
    assert done["type"] is FlowResultType.CREATE_ENTRY
    await hass.async_block_till_done()
    assert entry.options[CONF_REPOSITORIES][0][CONF_EXPORT_FORMAT] == "yaml"

    # Removed: its entities and device go with it, the first repository stays
    removed = await step("git_sync_remove_repository", {CONF_REPOSITORIES: [repo_id]})
    assert removed["type"] is FlowResultType.CREATE_ENTRY
    await hass.async_block_till_done()
    assert entry.options[CONF_REPOSITORIES] == []
    assert set(_statuses(hass)) == {str(first)}
    names = {d.name for d in dr.async_entries_for_config_entry(dr.async_get(hass), entry.entry_id)}
    assert "System Hub Versioning (esphome)" not in names
    assert "System Hub Versioning" in names


async def test_every_standalone_repository_is_taken_over(hass: HomeAssistant, tmp_path: Path) -> None:
    """Turned on next to the former Git Sync with two entries: the first repository, then the other one."""
    first = _repository(tmp_path, "config")
    second = _repository(tmp_path, "esphome")
    for path, fmt in ((first, "json"), (second, "yaml")):
        MockConfigEntry(
            domain="git_sync",
            data={CONF_REPO_PATH: str(path), CONF_REMOTE: "origin", CONF_SSH_KEY: ""},
            options={CONF_EXPORT_FORMAT: fmt},
        ).add_to_hass(hass)
    entry = MockConfigEntry(domain=DOMAIN, options={"modules": []})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    result = await hass.config_entries.options.async_init(entry.entry_id, context=PANEL)
    result = await hass.config_entries.options.async_configure(result["flow_id"], {"next_step_id": "modules"})
    modules = dict.fromkeys(("containers", "watchdog", "marketplace", "batteries", "orphans"), False)
    result = await hass.config_entries.options.async_configure(result["flow_id"], modules | {"git_sync": True})
    assert result["step_id"] == "git_sync_repository"
    done = await hass.config_entries.options.async_configure(
        result["flow_id"], {CONF_REPO_PATH: str(first), CONF_REMOTE: "origin", CONF_SSH_KEY: ""}
    )
    assert done["type"] is FlowResultType.CREATE_ENTRY
    await hass.async_block_till_done()
    [further] = entry.options[CONF_REPOSITORIES]
    assert further[CONF_REPO_PATH] == str(second)
    assert further[CONF_EXPORT_FORMAT] == "yaml"
    assert set(_statuses(hass)) == {str(first), str(second)}
