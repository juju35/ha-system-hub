"""A module turned on takes over the settings of the standalone integration it replaces."""

from __future__ import annotations

from pathlib import Path

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.system_hub.const import CONF_MODULES, DOMAIN
from custom_components.system_hub.git_sync.const import (
    CONF_EXPORT_FORMAT,
    CONF_REMOTE,
    CONF_REPO_PATH,
    CONF_SSH_KEY,
)
from custom_components.system_hub.standalone import entry as standalone_entry

PANEL = {"source": "system_hub_panel"}
NONE_ON = {
    "containers": False,
    "watchdog": False,
    "marketplace": False,
    "batteries": False,
    "git_sync": False,
    "orphans": False,
}


def _standalone(hass: HomeAssistant, domain: str, data: dict | None = None, options: dict | None = None) -> None:
    MockConfigEntry(domain=domain, title=domain, data=data or {}, options=options or {}).add_to_hass(hass)


async def _hub(hass: HomeAssistant, **options) -> MockConfigEntry:
    entry = MockConfigEntry(domain=DOMAIN, title="System Hub", options={CONF_MODULES: [], **options})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


async def _turn_on(hass: HomeAssistant, entry: MockConfigEntry, **modules) -> dict:
    result = await hass.config_entries.options.async_init(entry.entry_id, context=PANEL)
    result = await hass.config_entries.options.async_configure(result["flow_id"], {"next_step_id": "modules"})
    return await hass.config_entries.options.async_configure(result["flow_id"], NONE_ON | modules)


async def test_orphans_and_watchdog_take_over_the_standalone_settings(hass: HomeAssistant) -> None:
    _standalone(
        hass,
        "orphan_entities",
        options={"scan_interval": 30, "ignored_entities": ["sensor.old"], "unrelated": True},
    )
    _standalone(hass, "integration_watchdog", data={"scan_interval": 5}, options={"max_reloads": 2})
    entry = await _hub(hass)
    done = await _turn_on(hass, entry, orphans=True, watchdog=True)
    assert done["type"] is FlowResultType.CREATE_ENTRY
    await hass.async_block_till_done()
    assert entry.options["orphans"] == {"scan_interval": 30, "ignored_entities": ["sensor.old"]}
    assert entry.options["watchdog"] == {"scan_interval": 5, "max_reloads": 2}


async def test_a_module_already_set_keeps_its_settings(hass: HomeAssistant) -> None:
    _standalone(hass, "orphan_entities", options={"scan_interval": 30})
    entry = await _hub(hass, orphans={"scan_interval": 60})
    await _turn_on(hass, entry, orphans=True)
    await hass.async_block_till_done()
    assert entry.options["orphans"] == {"scan_interval": 60}


async def test_a_disabled_standalone_entry_is_left_alone(hass: HomeAssistant) -> None:
    MockConfigEntry(
        domain="orphan_entities",
        options={"scan_interval": 30},
        disabled_by=config_entries.ConfigEntryDisabler.USER,
    ).add_to_hass(hass)
    entry = await _hub(hass)
    await _turn_on(hass, entry, orphans=True)
    await hass.async_block_till_done()
    assert "orphans" not in entry.options


async def test_setup_takes_over_the_standalone_settings(hass: HomeAssistant) -> None:
    _standalone(hass, "marketplace_refresh", options={"backup_before_install": True})
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
    done = await hass.config_entries.flow.async_configure(result["flow_id"], NONE_ON | {"orphans": True})
    assert done["type"] is FlowResultType.CREATE_ENTRY
    # Marketplace not turned on: its settings stay where they are.
    assert "marketplace" not in done["options"]


async def test_git_sync_starts_from_the_standalone_repository(hass: HomeAssistant, repo: Path) -> None:
    """The repository form is filled with the standalone Git Sync's, and its other settings are kept."""
    _standalone(
        hass,
        "git_sync",
        data={CONF_REPO_PATH: str(repo), CONF_REMOTE: "origin", CONF_SSH_KEY: ""},
        options={CONF_EXPORT_FORMAT: "yaml"},
    )
    entry = await _hub(hass)
    form = await _turn_on(hass, entry, git_sync=True)
    assert form["step_id"] == "git_sync_repository"
    defaults = {str(key): key.default() for key in form["data_schema"].schema if key.default is not vol.UNDEFINED}
    assert defaults[CONF_REPO_PATH] == str(repo)
    done = await hass.config_entries.options.async_configure(
        form["flow_id"], {CONF_REPO_PATH: str(repo), CONF_REMOTE: "origin", CONF_SSH_KEY: ""}
    )
    assert done["type"] is FlowResultType.CREATE_ENTRY
    await hass.async_block_till_done()
    assert entry.options["git_sync"][CONF_EXPORT_FORMAT] == "yaml"
    assert entry.options["git_sync"][CONF_REPO_PATH] == str(repo)


async def test_git_sync_prefers_the_configuration_folder(hass: HomeAssistant) -> None:
    _standalone(hass, "git_sync", data={CONF_REPO_PATH: "/share/other"})
    _standalone(hass, "git_sync", data={CONF_REPO_PATH: hass.config.path() + "/"})
    found = standalone_entry(hass, "git_sync")
    assert found is not None
    assert found.data[CONF_REPO_PATH] == hass.config.path() + "/"
