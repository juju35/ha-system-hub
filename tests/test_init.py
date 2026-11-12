"""Setup, config flow and modules of System Hub: each module can be turned on or off."""

from __future__ import annotations

import pytest
from homeassistant import config_entries
from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType
from homeassistant.exceptions import ServiceValidationError
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.system_hub.const import CONF_MODULES, DOMAIN

WATCHDOG_SENSOR = "sensor.system_hub_sentinel_unavailable_integrations"
WATCHDOG_BUTTON = "button.system_hub_sentinel_check_now"
MARKETPLACE_SENSOR = "sensor.system_hub_updates_status"


async def _setup(hass: HomeAssistant, modules: list[str]) -> MockConfigEntry:
    entry = MockConfigEntry(domain=DOMAIN, title="System Hub", options={CONF_MODULES: modules})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


async def test_flow_with_marketplace(hass: HomeAssistant, fake_marketplace) -> None:
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
    assert result["type"] is FlowResultType.FORM
    result = await hass.config_entries.flow.async_configure(result["flow_id"], {"watchdog": True, "marketplace": True})
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert result["title"] == "System Hub"
    assert result["options"] == {CONF_MODULES: ["security", "logs", "watchdog", "marketplace", "batteries", "orphans"]}

    again = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
    assert again["type"] is FlowResultType.ABORT
    assert again["reason"] == "single_instance_allowed"


async def test_flow_without_marketplace(hass: HomeAssistant) -> None:
    """The Marketplace module is off by default without the Marketplace, and can't be turned on."""
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
    defaults = {str(key): key.default() for key in result["data_schema"].schema}
    assert defaults == {
        "containers": False,
        "logs": True,
        "database": False,
        "security": True,
        "watchdog": True,
        "marketplace": False,
        "backups": False,
        "silent": False,
        "batteries": True,
        "git_sync": False,
        "automations": False,
        "orphans": True,
    }
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], {"containers": False, "watchdog": True, "marketplace": True}
    )
    assert result["type"] is FlowResultType.FORM
    assert result["errors"] == {"marketplace": "marketplace_not_loaded"}
    result = await hass.config_entries.flow.async_configure(result["flow_id"], {"watchdog": True, "marketplace": False})
    assert result["options"] == {CONF_MODULES: ["security", "logs", "watchdog", "batteries", "orphans"]}


async def test_backups_module(hass: HomeAssistant) -> None:
    """Backups: refused without the Backup integration; its setting saved, and given to the panel."""
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
    result = await hass.config_entries.flow.async_configure(result["flow_id"], {"backups": True})
    assert result["errors"] == {"backups": "backup_not_loaded"}
    hass.config.components.add("backup")
    entry = await _setup(hass, ["backups"])
    result = await hass.config_entries.options.async_init(entry.entry_id)
    assert "backups" in result["menu_options"]
    result = await hass.config_entries.options.async_configure(result["flow_id"], {"next_step_id": "backups"})
    result = await hass.config_entries.options.async_configure(result["flow_id"], {"max_age": 5})
    assert entry.options["backups"] == {"max_age": 5}


async def test_no_module(hass: HomeAssistant) -> None:
    """Every module off: loads, with no entity."""
    entry = await _setup(hass, [])
    assert entry.state is ConfigEntryState.LOADED
    assert not er.async_entries_for_config_entry(er.async_get(hass), entry.entry_id)
    assert await hass.config_entries.async_unload(entry.entry_id)
    assert entry.state is ConfigEntryState.NOT_LOADED


async def test_options_without_modules_turn_everything_on(hass: HomeAssistant, fake_marketplace) -> None:
    """An entry whose options don't list the modules (set up by hand) runs them all."""
    entry = MockConfigEntry(domain=DOMAIN, title="System Hub")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    assert entry.runtime_data.watchdog is not None
    assert entry.runtime_data.marketplace is not None


async def test_only_watchdog(hass: HomeAssistant, fake_marketplace) -> None:
    entry = await _setup(hass, ["watchdog"])
    assert entry.runtime_data.watchdog is not None
    assert entry.runtime_data.marketplace is None
    assert hass.states.get(WATCHDOG_SENSOR) is not None
    assert hass.states.get(MARKETPLACE_SENSOR) is None
    with pytest.raises(ServiceValidationError) as err:
        await hass.services.async_call(DOMAIN, "marketplace_check_updates", {}, blocking=True)
    assert err.value.translation_key == "module_disabled"
    assert err.value.translation_placeholders == {"module": "Updates"}
    with pytest.raises(ServiceValidationError) as err:
        await hass.services.async_call(DOMAIN, "batteries_notify", {}, blocking=True)
    assert err.value.translation_placeholders == {"module": "Batteries"}
    assert hass.states.get("sensor.system_hub_batteries_low_batteries") is None


async def test_only_marketplace(hass: HomeAssistant, fake_marketplace) -> None:
    entry = await _setup(hass, ["marketplace"])
    assert entry.runtime_data.watchdog is None
    assert hass.states.get(MARKETPLACE_SENSOR) is not None
    assert hass.states.get(WATCHDOG_BUTTON) is None
    with pytest.raises(ServiceValidationError) as err:
        await hass.services.async_call(DOMAIN, "watchdog_check", {}, blocking=True)
    assert err.value.translation_key == "module_disabled"


async def test_turning_a_module_off_removes_its_entities_and_device(hass: HomeAssistant, fake_marketplace) -> None:
    """Turned off in the options: its entities and its device are removed, its settings kept."""
    entry = await _setup(hass, ["watchdog", "marketplace"])
    hass.config_entries.async_update_entry(entry, options={**entry.options, "watchdog": {"grace_period": 20}})
    await hass.async_block_till_done()
    entities = er.async_get(hass)
    assert entities.async_get(WATCHDOG_SENSOR) is not None

    result = await hass.config_entries.options.async_init(entry.entry_id, context={"source": "system_hub_panel"})
    assert result["type"] is FlowResultType.MENU
    assert result["menu_options"] == ["modules", "system", "watchdog", "watchdog_add_power_cycle", "marketplace"]
    result = await hass.config_entries.options.async_configure(result["flow_id"], {"next_step_id": "modules"})
    result = await hass.config_entries.options.async_configure(
        result["flow_id"], {"watchdog": False, "marketplace": True}
    )
    assert result["type"] is FlowResultType.CREATE_ENTRY
    await hass.async_block_till_done()

    assert entry.options[CONF_MODULES] == ["marketplace"]
    assert entry.options["watchdog"] == {"grace_period": 20}
    assert entry.runtime_data.watchdog is None
    assert entities.async_get(WATCHDOG_SENSOR) is None
    assert entities.async_get(WATCHDOG_BUTTON) is None
    assert entities.async_get(MARKETPLACE_SENSOR) is not None
    identifiers = {
        i for d in dr.async_entries_for_config_entry(dr.async_get(hass), entry.entry_id) for i in d.identifiers
    }
    assert (DOMAIN, f"{entry.entry_id}_watchdog") not in identifiers
    assert (DOMAIN, f"{entry.entry_id}_marketplace") in identifiers

    result = await hass.config_entries.options.async_init(entry.entry_id, context={"source": "system_hub_panel"})
    assert result["menu_options"] == ["modules", "system", "marketplace"]


async def test_options_cannot_turn_on_marketplace_without_it(hass: HomeAssistant) -> None:
    entry = await _setup(hass, ["watchdog"])
    result = await hass.config_entries.options.async_init(entry.entry_id, context={"source": "system_hub_panel"})
    result = await hass.config_entries.options.async_configure(result["flow_id"], {"next_step_id": "modules"})
    result = await hass.config_entries.options.async_configure(
        result["flow_id"], {"watchdog": True, "marketplace": True}
    )
    assert result["type"] is FlowResultType.FORM
    assert result["errors"] == {"marketplace": "marketplace_not_loaded"}


async def test_actions_need_the_integration(hass: HomeAssistant) -> None:
    """Without a loaded entry, every action says System Hub is not loaded."""
    entry = await _setup(hass, ["watchdog"])
    assert await hass.config_entries.async_unload(entry.entry_id)
    with pytest.raises(ServiceValidationError) as err:
        await hass.services.async_call(DOMAIN, "watchdog_check", {}, blocking=True)
    assert err.value.translation_key == "not_loaded"
