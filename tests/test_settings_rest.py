"""The Settings tab saves through Home Assistant's options flow API (#63): an entity not chosen is left out."""

from __future__ import annotations

from homeassistant.core import HomeAssistant
from homeassistant.setup import async_setup_component
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.system_hub.const import CONF_MODULES, DOMAIN


async def test_sentinel_settings_saved_with_ignored_integrations(hass: HomeAssistant, hass_client) -> None:
    assert await async_setup_component(hass, "config", {})
    entry = MockConfigEntry(domain=DOMAIN, options={CONF_MODULES: ["watchdog"]})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    client = await hass_client()
    flow = await (await client.post("/api/config/config_entries/options/flow", json={"handler": entry.entry_id})).json()
    url = f"/api/config/config_entries/options/flow/{flow['flow_id']}"
    form = await (await client.post(url, json={"next_step_id": "watchdog"})).json()
    # The pause entity is suggested as null: sent back as is, it is refused, field by field
    pause = next(f for f in form["data_schema"] if f["name"] == "pause_entity")
    assert pause["description"]["suggested_value"] is None
    data = {"scan_interval": 5, "grace_period": 10, "max_reloads": 3, "ignored_integrations": ["mqtt"]}
    refused = await client.post(url, json={**data, "pause_entity": None})
    assert refused.status == 400
    assert "pause_entity" in (await refused.json())["errors"]
    # Left out, as the panel now does: saved
    flow = await (await client.post("/api/config/config_entries/options/flow", json={"handler": entry.entry_id})).json()
    url = f"/api/config/config_entries/options/flow/{flow['flow_id']}"
    await client.post(url, json={"next_step_id": "watchdog"})
    result = await (await client.post(url, json=data)).json()
    assert result["type"] == "create_entry"
    await hass.async_block_till_done()
    assert entry.options["watchdog"]["ignored_integrations"] == ["mqtt"]
