"""Orphans module in System Hub: diagnostics, the panel's data, ignore without reload, the module turned off."""

from __future__ import annotations

from unittest.mock import patch

import pytest
from homeassistant.components.diagnostics import REDACTED
from homeassistant.const import STATE_UNAVAILABLE
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ServiceValidationError
from homeassistant.helpers import device_registry as dr
from homeassistant.setup import async_setup_component
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.system_hub.const import DOMAIN
from custom_components.system_hub.diagnostics import async_get_config_entry_diagnostics

from .test_orphans import OPTIONS, ORPHANS, RESTORED, _entity, _integration, _orphan_device, _scan, _setup


async def test_diagnostics(hass: HomeAssistant) -> None:
    """The last scan is returned, the config entry titles (accounts, hosts) redacted."""
    account = _integration(hass, "acme")
    hass.config_entries.async_update_entry(account, title="jane.doe@example.com")
    orphan = _entity(hass, "acme", "old_lamp", STATE_UNAVAILABLE, account, attributes=RESTORED)
    entry = await _setup(hass)
    await _scan(hass)

    data = await async_get_config_entry_diagnostics(hass, entry)
    assert "jane.doe" not in str(data)
    scanner = data["orphans"]
    assert scanner["ready"] is True
    assert scanner["last_scan"]
    assert scanner["counts"]["not_provided"] == 1
    [item] = scanner["entities"]
    assert item["entity_id"] == orphan
    assert item["reason"] == "not_provided"
    assert item["entry_title"] == REDACTED
    assert item["used_by"] == []
    assert scanner["devices"] == []


async def _panel(hass: HomeAssistant, hass_ws_client, **options) -> tuple[MockConfigEntry, object]:
    assert await async_setup_component(hass, "frontend", {})
    entry = await _setup(hass, **options)
    return entry, await hass_ws_client(hass)


async def test_state_and_orphans_command(hass: HomeAssistant, hass_ws_client) -> None:
    """`system_hub/state` carries the counts, `system_hub/orphans` the whole list (not capped) with the names."""
    acme = _integration(hass, "acme")
    one = _entity(hass, "acme", "one", STATE_UNAVAILABLE, acme, attributes=RESTORED)
    two = _entity(hass, "acme", "two", STATE_UNAVAILABLE, acme, attributes=RESTORED)
    old, _, _ = _orphan_device(hass, "delta")
    with patch("custom_components.system_hub.orphans.entities.MAX_LISTED", 1):
        _entry, client = await _panel(hass, hass_ws_client)
        await _scan(hass)
        assert len(hass.states.get(ORPHANS).attributes["entities"]) == 1

        await client.send_json_auto_id({"type": "system_hub/state"})
        state = (await client.receive_json())["result"]
        assert "orphans" in state["modules"]
        summary = state["orphans"]
        assert summary["total"] == 2
        assert summary["counts"]["not_provided"] == 2
        assert summary["devices"] == 1
        assert summary["last_scan"]

        await client.send_json_auto_id({"type": "system_hub/orphans"})
        result = (await client.receive_json())["result"]
    assert [e["entity_id"] for e in result["entities"]] == [one, two]
    assert [d["device_id"] for d in result["devices"]] == [old.id]
    assert result["truncated"] == 0
    assert result["integrations"] == {}
    assert result["total"] == 2


async def test_orphans_command_with_the_module_off(hass: HomeAssistant, hass_ws_client) -> None:
    assert await async_setup_component(hass, "frontend", {})
    entry = MockConfigEntry(domain=DOMAIN, unique_id=DOMAIN, options={"modules": ["watchdog"]})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "system_hub/orphans"})
    response = await client.receive_json()
    assert response["success"] is False
    assert response["error"]["code"] == "module_disabled"
    await client.send_json_auto_id({"type": "system_hub/state"})
    assert "orphans" not in (await client.receive_json())["result"]
    for service, data in (("scan", {}), ("remove", {"entities": ["sensor.a"]}), ("ignore", {"entities": ["sensor.a"]})):
        with pytest.raises(ServiceValidationError) as err:
            await hass.services.async_call(DOMAIN, f"orphans_{service}", data, blocking=True)
        assert err.value.translation_key == "module_disabled"
    assert hass.states.get(ORPHANS) is None


async def test_ignore_keeps_the_other_modules_running(hass: HomeAssistant) -> None:
    """Ignoring is applied at once and saved in the options, without reloading System Hub."""
    acme = _integration(hass, "acme")
    one = _entity(hass, "acme", "one", STATE_UNAVAILABLE, acme, attributes=RESTORED)
    entry = MockConfigEntry(
        domain=DOMAIN, unique_id=DOMAIN, options={"modules": ["batteries", "orphans"], "orphans": OPTIONS}
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    await _scan(hass)
    batteries = entry.runtime_data.batteries
    with patch.object(hass.config_entries, "async_reload") as reload:
        await hass.services.async_call(DOMAIN, "orphans_ignore", {"entities": [one]}, blocking=True)
        await hass.async_block_till_done()
    reload.assert_not_called()
    assert entry.runtime_data.batteries is batteries
    assert entry.options["orphans"]["ignored_entities"] == [one]
    assert entry.options["modules"] == ["batteries", "orphans"]
    assert hass.states.get(ORPHANS).state == "0"


async def test_one_device_for_the_module(hass: HomeAssistant) -> None:
    entry = await _setup(hass)
    devices = dr.async_entries_for_config_entry(dr.async_get(hass), entry.entry_id)
    assert [d.name for d in devices] == ["System Hub Cleanup"]
    assert (DOMAIN, f"{entry.entry_id}_orphans") in devices[0].identifiers
