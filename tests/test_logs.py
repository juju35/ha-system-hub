"""Logs module: its settings, and a message ignored from the panel without a reload."""

from __future__ import annotations

from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.system_hub.const import CONF_MODULES, DOMAIN


async def _setup(hass: HomeAssistant) -> MockConfigEntry:
    hass.config.components.add("system_log")
    entry = MockConfigEntry(domain=DOMAIN, title="System Hub", options={CONF_MODULES: ["logs"]})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


async def test_ignore_from_the_panel_without_a_reload(hass: HomeAssistant, hass_ws_client) -> None:
    entry = await _setup(hass)
    client = await hass_ws_client(hass)
    data = entry.runtime_data
    await client.send_json({"id": 1, "type": "system_hub/logs_ignore", "key": "custom_components.x|Timeout"})
    assert (await client.receive_json())["result"] == {"ignored": ["custom_components.x|Timeout"]}
    await hass.async_block_till_done()
    assert entry.runtime_data is data
    await client.send_json({"id": 2, "type": "system_hub/state"})
    assert (await client.receive_json())["result"]["logs"] == {
        "error_threshold": 10,
        "ignored_messages": ["custom_components.x|Timeout"],
    }


async def test_settings_step(hass: HomeAssistant) -> None:
    entry = await _setup(hass)
    result = await hass.config_entries.options.async_init(entry.entry_id)
    assert "logs" in result["menu_options"]
    result = await hass.config_entries.options.async_configure(result["flow_id"], {"next_step_id": "logs"})
    result = await hass.config_entries.options.async_configure(
        result["flow_id"], {"error_threshold": 25, "ignored_messages": []}
    )
    assert entry.options["logs"] == {"error_threshold": 25, "ignored_messages": []}
