"""Battery types set in Configure, the import from Battery Monitor, and the panel's "hide the fine batteries"."""

from __future__ import annotations

import json

from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.system_hub.batteries.const import (
    CONF_BATTERY_MODELS,
    CONF_BATTERY_TYPES,
    CONF_HIDE_OK,
    CONF_THRESHOLD,
)
from custom_components.system_hub.const import DOMAIN

from .conftest import add_battery
from .test_batteries import OPTIONS

LOW = "sensor.system_hub_batteries_low_batteries"


async def _setup(hass: HomeAssistant, **options) -> MockConfigEntry:
    entry = MockConfigEntry(
        domain=DOMAIN, unique_id=DOMAIN, options={"modules": ["batteries"], "batteries": {**OPTIONS, **options}}
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


def _types(hass: HomeAssistant) -> dict[str, str | None]:
    return {b["name"]: b["battery_type"] for b in hass.states.get(LOW).attributes["batteries"]}


def _model(hass: HomeAssistant, entity_id: str, model: str) -> None:
    entry = er.async_get(hass).async_get(entity_id)
    dr.async_get(hass).async_update_device(entry.device_id, model=model)


async def _types_step(hass: HomeAssistant, entry: MockConfigEntry, user_input: dict):
    result = await hass.config_entries.options.async_init(entry.entry_id, context={"source": "system_hub_panel"})
    assert "batteries_types" in result["menu_options"]
    result = await hass.config_entries.options.async_configure(result["flow_id"], {"next_step_id": "batteries_types"})
    assert result["step_id"] == "batteries_types"
    return await hass.config_entries.options.async_configure(result["flow_id"], user_input)


async def test_types_set_by_hand_come_first(hass: HomeAssistant) -> None:
    door = add_battery(hass, "Door", "50")
    remote = add_battery(hass, "Remote", "60")
    lock = add_battery(hass, "Lock", "70")
    _model(hass, remote, "RC-1")
    _model(hass, lock, "RC-1")
    # Battery Notes says CR2032 for the door: the type set for it wins
    hass.states.async_set(door, "50", {"device_class": "battery", "unit_of_measurement": "%", "battery_type": "CR2032"})
    await _setup(hass, **{CONF_BATTERY_TYPES: {door: "CR2450", lock: "4× AA"}, CONF_BATTERY_MODELS: {"RC-1": "2× AAA"}})
    assert _types(hass) == {"Door": "CR2450", "Remote": "2× AAA", "Lock": "4× AA"}


async def test_set_a_type_for_a_battery_then_for_its_model(hass: HomeAssistant) -> None:
    door = add_battery(hass, "Door", "50")
    remote = add_battery(hass, "Remote", "60")
    _model(hass, remote, "RC-1")
    entry = await _setup(hass)

    result = await _types_step(hass, entry, {"battery": door, "type": "AA", "quantity": 2})
    assert result["type"] is FlowResultType.CREATE_ENTRY
    await hass.async_block_till_done()
    assert entry.options["batteries"][CONF_BATTERY_TYPES] == {door: "2× AA"}
    assert entry.options["batteries"][CONF_THRESHOLD] == 20
    assert _types(hass)["Door"] == "2× AA"

    result = await _types_step(
        hass, entry, {"set": [f"battery:{door}"], "battery": remote, "type": "CR2032", "whole_model": True}
    )
    assert result["type"] is FlowResultType.CREATE_ENTRY
    await hass.async_block_till_done()
    assert entry.options["batteries"][CONF_BATTERY_MODELS] == {"RC-1": "CR2032"}
    assert _types(hass) == {"Door": "2× AA", "Remote": "CR2032"}

    # Unticked: removed
    result = await _types_step(hass, entry, {"set": ["model:RC-1"]})
    await hass.async_block_till_done()
    assert entry.options["batteries"][CONF_BATTERY_TYPES] == {}
    assert entry.options["batteries"][CONF_BATTERY_MODELS] == {"RC-1": "CR2032"}


async def test_type_errors(hass: HomeAssistant) -> None:
    door = add_battery(hass, "Door", "50")
    entry = await _setup(hass)
    result = await _types_step(hass, entry, {"type": "AA"})
    assert result["errors"] == {"battery": "battery_required"}
    result = await hass.config_entries.options.async_configure(result["flow_id"], {"battery": door})
    assert result["errors"] == {"type": "type_required"}
    # The door's device has no model
    result = await hass.config_entries.options.async_configure(
        result["flow_id"], {"battery": door, "type": "AA", "whole_model": True}
    )
    assert result["errors"] == {"whole_model": "no_model"}
    # A rechargeable battery has no count; "3× AAA" typed wins over the quantity field
    result = await hass.config_entries.options.async_configure(
        result["flow_id"], {"battery": door, "type": "3× AAA", "quantity": 1}
    )
    assert result["type"] is FlowResultType.CREATE_ENTRY
    # The entry reloads with the new options: done before the test ends, so no timer of the old setup is left
    await hass.async_block_till_done()
    assert entry.options["batteries"][CONF_BATTERY_TYPES] == {door: "3× AAA"}


async def test_batteries_settings_keep_the_types_and_hide_the_fine_ones(hass: HomeAssistant, hass_ws_client) -> None:
    door = add_battery(hass, "Door", "50")
    entry = await _setup(hass, **{CONF_BATTERY_TYPES: {door: "CR2450"}})
    result = await hass.config_entries.options.async_init(entry.entry_id, context={"source": "system_hub_panel"})
    result = await hass.config_entries.options.async_configure(result["flow_id"], {"next_step_id": "batteries"})
    result = await hass.config_entries.options.async_configure(result["flow_id"], {**OPTIONS, CONF_HIDE_OK: True})
    assert result["type"] is FlowResultType.CREATE_ENTRY
    await hass.async_block_till_done()
    assert entry.options["batteries"][CONF_BATTERY_TYPES] == {door: "CR2450"}
    assert entry.options["batteries"][CONF_HIDE_OK] is True
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "system_hub/state"})
    assert (await client.receive_json())["result"]["batteries"]["hide_ok"] is True


async def test_import_from_battery_monitor(hass: HomeAssistant, tmp_path) -> None:
    door = add_battery(hass, "Door", "15")
    remote = add_battery(hass, "Remote", "60")
    _model(hass, remote, "RC-1")
    hass.config.config_dir = str(tmp_path)
    storage = tmp_path / ".storage"
    storage.mkdir()
    dashboard = {
        "views": [
            {
                "sections": [
                    {
                        "cards": [
                            {
                                "type": "vertical-stack",
                                "cards": [{"type": "custom:battery-monitor-card", "battery_types": {door: "CR2450"}}],
                            },
                            {"type": "custom:battery-monitor-mini-card", "battery_models": {"RC-1": "2× AAA"}},
                        ]
                    }
                ]
            }
        ]
    }
    (storage / "lovelace.dashboard_home").write_text(json.dumps({"data": {"config": dashboard}}))
    (storage / "battery_monitor.below_since").write_text(json.dumps({"data": {"stock": {"AA": 4, "bad": -1}}}))
    MockConfigEntry(domain="battery_monitor", options={CONF_THRESHOLD: 30, "duration": 12}).add_to_hass(hass)
    # A type already set here is kept
    entry = await _setup(hass, **{CONF_BATTERY_MODELS: {"RC-1": "CR2032"}})

    result = await hass.config_entries.options.async_init(entry.entry_id, context={"source": "system_hub_panel"})
    assert "batteries_import" in result["menu_options"]
    result = await hass.config_entries.options.async_configure(result["flow_id"], {"next_step_id": "batteries_import"})
    assert result["description_placeholders"] == {"settings": "2", "types": "2", "stock": "1"}
    result = await hass.config_entries.options.async_configure(result["flow_id"], {})
    assert result["type"] is FlowResultType.CREATE_ENTRY
    await hass.async_block_till_done()
    options = entry.options["batteries"]
    assert options[CONF_THRESHOLD] == 30
    assert options["duration"] == 12
    assert options[CONF_BATTERY_TYPES] == {door: "CR2450"}
    assert options[CONF_BATTERY_MODELS] == {"RC-1": "CR2032"}
    assert entry.runtime_data.batteries.stock == {"AA": 4}
    assert _types(hass) == {"Door": "CR2450", "Remote": "CR2032"}


async def test_no_import_without_battery_monitor(hass: HomeAssistant, tmp_path) -> None:
    hass.config.config_dir = str(tmp_path)
    entry = await _setup(hass)
    result = await hass.config_entries.options.async_init(entry.entry_id, context={"source": "system_hub_panel"})
    assert "batteries_import" not in result["menu_options"]
