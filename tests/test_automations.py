"""Automations module: Automation Monitor's sensors read for the panel's Automations tab."""

from __future__ import annotations

from homeassistant import config_entries
from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er
from homeassistant.setup import async_setup_component
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.system_hub.const import CONF_MODULES, DOMAIN

FAILURES = [
    {
        "entity_id": "automation.old",
        "name": "Old",
        "last_error_time": "2026-11-01T10:00:00+00:00",
        "error_message": "boom",
        "error_step": "unknown",
        "consecutive_failures": 1,
    },
    {
        "entity_id": "automation.lights",
        "last_error_time": "2026-11-10T08:00:00+00:00",
        "error_message": "Entity light.hall is unavailable",
        "error_step": "action/0",
        "consecutive_failures": 3,
    },
    {"name": "no entity id: left out"},
]
LINKED = [
    {
        "entity_id": "light.hall",
        "name": "Hall",
        "unavailable_since": "2026-11-09T12:00:00+00:00",
        "referenced_by_details": [{"entity_id": "automation.lights", "name": "Lights"}],
    },
    {
        "entity_id": "switch.pump",
        "unavailable_since": "2026-11-10T09:00:00+00:00",
        "referenced_by": ["script.water", "scene.evening"],
    },
]


async def _setup(hass: HomeAssistant, modules: list[str]) -> MockConfigEntry:
    assert await async_setup_component(hass, "frontend", {})
    entry = MockConfigEntry(domain=DOMAIN, title="System Hub", options={CONF_MODULES: modules})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


def _monitor(hass: HomeAssistant, failed: str = "2", linked: str = "2") -> None:
    """Automation Monitor's two sensors, renamed: found by their translation keys, not their entity ids."""
    registry = er.async_get(hass)
    for key, object_id, state, attribute, items in (
        ("failed_automations", "echecs", failed, "automations", FAILURES),
        ("linked_entities_unavailable", "liees", linked, "entities", LINKED),
    ):
        item = registry.async_get_or_create(
            "sensor", "automation_monitor", key, suggested_object_id=object_id, translation_key=key
        )
        hass.states.async_set(item.entity_id, state, {attribute: items})
    hass.states.async_set("automation.lights", "on", {"id": "1700000000", "friendly_name": "Lights"})
    hass.states.async_set("automation.old", "on", {"id": "old id"})
    hass.states.async_set("scene.evening", "scening", {"id": "42", "friendly_name": "Evening"})


async def _state(hass: HomeAssistant, hass_ws_client) -> dict:
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "system_hub/state"})
    return (await client.receive_json())["result"]


async def test_failures_and_linked_entities(hass: HomeAssistant, hass_ws_client) -> None:
    _monitor(hass)
    await _setup(hass, ["automations"])
    data = (await _state(hass, hass_ws_client))["automations"]
    assert data["available"] is True
    assert data["failed_entity"] == "sensor.echecs"
    assert data["linked_entity"] == "sensor.liees"
    assert data["failed_na"] is False
    assert data["automations"] == 2
    # Most recent first; the name from the automation when Automation Monitor gives none
    assert data["failures"] == [
        {
            "entity_id": "automation.lights",
            "name": "Lights",
            "last_error_time": "2026-11-10T08:00:00+00:00",
            "error_message": "Entity light.hall is unavailable",
            "error_step": "action/0",
            "consecutive_failures": 3,
            "trace": "/config/automation/trace/1700000000",
            "edit": "/config/automation/edit/1700000000",
        },
        {
            "entity_id": "automation.old",
            "name": "Old",
            "last_error_time": "2026-11-01T10:00:00+00:00",
            "error_message": "boom",
            "error_step": None,
            "consecutive_failures": 1,
            "trace": "/config/automation/trace/old%20id",
            "edit": "/config/automation/edit/old%20id",
        },
    ]
    assert [e["entity_id"] for e in data["linked"]] == ["switch.pump", "light.hall"]
    assert data["linked"][0]["used_by"] == [
        {"entity_id": "script.water", "name": "script.water", "edit": "/config/script/edit/water"},
        {"entity_id": "scene.evening", "name": "Evening", "edit": "/config/scene/edit/42"},
    ]
    assert data["linked"][1] == {
        "entity_id": "light.hall",
        "name": "Hall",
        "unavailable_since": "2026-11-09T12:00:00+00:00",
        "used_by": [{"entity_id": "automation.lights", "name": "Lights", "edit": "/config/automation/edit/1700000000"}],
    }


async def test_unavailable_sensor_is_not_zero_problems(hass: HomeAssistant, hass_ws_client) -> None:
    _monitor(hass, failed="unavailable")
    await _setup(hass, ["automations"])
    data = (await _state(hass, hass_ws_client))["automations"]
    assert data["failed_na"] is True
    assert data["failures"] == []
    assert data["linked_na"] is False
    assert len(data["linked"]) == 2


async def test_default_entity_ids_are_a_fallback(hass: HomeAssistant, hass_ws_client) -> None:
    hass.states.async_set("sensor.failed_automations", "0", {"automations": []})
    await _setup(hass, ["automations"])
    data = (await _state(hass, hass_ws_client))["automations"]
    assert data["available"] is True
    assert data["failed_entity"] == "sensor.failed_automations"
    assert data["linked_entity"] is None
    assert data["linked_na"] is True


async def test_without_automation_monitor(hass: HomeAssistant, hass_ws_client) -> None:
    await _setup(hass, ["automations"])
    result = await _state(hass, hass_ws_client)
    assert result["modules"] == ["automations"]
    assert result["automations"] == {"available": False, "loaded": False}


async def test_module_off_sends_nothing_and_has_no_entities(hass: HomeAssistant, hass_ws_client) -> None:
    _monitor(hass)
    entry = await _setup(hass, ["automations"])
    assert not er.async_entries_for_config_entry(er.async_get(hass), entry.entry_id)
    hass.config_entries.async_update_entry(entry, options={CONF_MODULES: []})
    await hass.async_block_till_done()
    assert "automations" not in await _state(hass, hass_ws_client)


async def test_on_by_default_with_automation_monitor(hass: HomeAssistant) -> None:
    hass.config.components.add("automation_monitor")
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
    defaults = {str(key): key.default() for key in result["data_schema"].schema}
    assert defaults["automations"] is True
    result = await hass.config_entries.flow.async_configure(result["flow_id"], {})
    assert "automations" in result["options"][CONF_MODULES]
