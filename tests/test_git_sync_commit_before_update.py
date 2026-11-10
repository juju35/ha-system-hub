"""Commit before updates: a snapshot of the configuration when update.install is called."""

from __future__ import annotations

from pathlib import Path

from homeassistant.const import EVENT_CALL_SERVICE
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.system_hub.const import DOMAIN
from custom_components.system_hub.git_sync.const import (
    CONF_COMMIT_BEFORE_UPDATE,
    CONF_COMMIT_INTERVAL,
    CONF_EXPORT_ENABLED,
    CONF_REMOTE,
    CONF_REPO_PATH,
    CONF_SSH_KEY,
)

from .conftest import git, git_sync_entry


async def _setup(hass: HomeAssistant, repo: Path, enabled: bool = True) -> MockConfigEntry:
    entry = git_sync_entry(
        domain=DOMAIN,
        unique_id=str(repo),
        data={CONF_REPO_PATH: str(repo), CONF_REMOTE: "origin", CONF_SSH_KEY: ""},
        options={CONF_COMMIT_INTERVAL: 0, CONF_EXPORT_ENABLED: False, CONF_COMMIT_BEFORE_UPDATE: enabled},
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


def _install(hass: HomeAssistant, entity_id: str | list[str]) -> None:
    hass.bus.async_fire(
        EVENT_CALL_SERVICE, {"domain": "update", "service": "install", "service_data": {"entity_id": entity_id}}
    )


async def test_an_update_install_commits_the_configuration_first(hass: HomeAssistant, repo: Path) -> None:
    await _setup(hass, repo)
    hass.states.async_set(
        "update.home_assistant_core_update", "on", {"title": "Home Assistant Core", "latest_version": "2026.12.0"}
    )
    (repo / "automations.yaml").write_text("[]\n", encoding="utf-8")

    _install(hass, "update.home_assistant_core_update")
    await hass.async_block_till_done()
    assert git(repo, "log", "-1", "--format=%s", "origin/main").strip() == (
        "chore: snapshot before updating Home Assistant Core to 2026.12.0"
    )

    # Update all: the next installs of the batch are covered by that snapshot, they commit nothing.
    (repo / "scripts.yaml").write_text("{}\n", encoding="utf-8")
    _install(hass, ["update.home_assistant_core_update"])
    await hass.async_block_till_done()
    assert git(repo, "status", "--porcelain").strip() == "?? scripts.yaml"


async def test_other_actions_and_the_option_off_commit_nothing(hass: HomeAssistant, repo: Path) -> None:
    await _setup(hass, repo, enabled=False)
    (repo / "automations.yaml").write_text("[]\n", encoding="utf-8")
    _install(hass, "update.anything")
    hass.bus.async_fire(EVENT_CALL_SERVICE, {"domain": "update", "service": "skip", "service_data": {}})
    await hass.async_block_till_done()
    assert git(repo, "log", "-1", "--format=%s").strip() == "chore: initial"


async def test_a_snapshot_names_several_updates(hass: HomeAssistant, repo: Path) -> None:
    entry = await _setup(hass, repo)
    for i in range(5):
        hass.states.async_set(f"update.u{i}", "on", {"friendly_name": f"U{i}"})
    (repo / "automations.yaml").write_text("[]\n", encoding="utf-8")
    result = await entry.runtime_data.git_sync.async_snapshot_before_update(
        [f"update.u{i}" for i in range(5)] + ["update.gone"]
    )
    assert result.message == "chore: snapshot before updating U0, U1, U2 and 2 more"
    await hass.async_block_till_done()
