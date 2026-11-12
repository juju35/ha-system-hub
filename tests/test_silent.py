"""Silent devices module: the devices not heard from beyond the hours set, the weak signals, ignored from the panel."""

from __future__ import annotations

from datetime import timedelta

from freezegun.api import FrozenDateTimeFactory
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.system_hub.const import CONF_MODULES, DOMAIN
from custom_components.system_hub.silent import silent_state


def _device(hass: HomeAssistant, name: str, entities: list[tuple[str, str, str | None, str | None]]) -> str:
    """A device of a radio integration and its entities: (platform, unique id, device class, translation key)."""
    owner = MockConfigEntry(domain="zha")
    owner.add_to_hass(hass)
    device = dr.async_get(hass).async_get_or_create(
        config_entry_id=owner.entry_id, identifiers={("zha", name)}, name=name
    )
    registry = er.async_get(hass)
    for platform, uid, device_class, key in entities:
        registry.async_get_or_create(
            "sensor",
            platform,
            f"{name}_{uid}",
            suggested_object_id=f"{name}_{uid}",
            device_id=device.id,
            original_device_class=device_class,
            translation_key=key,
        )
    return device.id


async def test_silent_and_weak_devices(hass: HomeAssistant, freezer: FrozenDateTimeFactory) -> None:
    cave = _device(hass, "cave", [("zha", "temperature", "temperature", None), ("zha", "battery", "battery", None)])
    plug = _device(hass, "plug", [("zha", "power", "power", None), ("zha", "lqi", None, "lqi")])
    gone = _device(hass, "gone", [("zha", "temperature", "temperature", None)])
    _device(hass, "other", [("hue", "temperature", "temperature", None)])
    hass.states.async_set("sensor.cave_temperature", "12")
    hass.states.async_set("sensor.cave_battery", "62")
    hass.states.async_set("sensor.gone_temperature", "unavailable")
    hass.states.async_set("sensor.other_temperature", "20")
    # A day and a half later, the plug reports (the same value moves last_reported), with a weak LQI
    freezer.tick(timedelta(hours=36))
    hass.states.async_set("sensor.plug_power", "5")
    hass.states.async_set("sensor.plug_lqi", "31")

    state = silent_state(hass, {"battery_hours": 24, "mains_hours": 24})
    rows = {r["device_id"]: r for r in state["devices"]}
    assert state["tracked"] == 3
    assert state["integrations"] == ["zha"]
    assert rows[gone]["silent"] and rows[gone]["unavailable"]
    assert rows[cave]["silent"] and rows[cave]["battery"] and rows[cave]["level"] == 62
    assert not rows[plug]["silent"]
    assert rows[plug]["signal"] == {"kind": "lqi", "value": 31, "weak": True}
    # Silent first, the longest silent first; the weak signal last
    assert [r["device_id"] for r in state["devices"]][-1] == plug
    # Longer hours on a battery: the cave is no longer silent; an ignored device is counted apart
    state = silent_state(hass, {"battery_hours": 48, "mains_hours": 24, "ignored_devices": [gone]})
    assert {r["device_id"] for r in state["devices"]} == {plug}
    assert state["ignored"] == 1


async def test_ignore_from_the_panel_without_a_reload(hass: HomeAssistant, hass_ws_client) -> None:
    entry = MockConfigEntry(domain=DOMAIN, title="System Hub", options={CONF_MODULES: ["silent"]})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": "system_hub/silent_ignore", "device_id": "abc"})
    assert (await client.receive_json())["result"] == {"ignored": ["abc"]}
    await hass.async_block_till_done()
    assert entry.options["silent"]["ignored_devices"] == ["abc"]
    # Not reloaded: the same runtime data
    data = entry.runtime_data
    await client.send_json({"id": 2, "type": "system_hub/silent_ignore", "device_id": "abc", "ignore": False})
    assert (await client.receive_json())["result"] == {"ignored": []}
    await hass.async_block_till_done()
    assert entry.runtime_data is data
    await client.send_json({"id": 3, "type": "system_hub/state"})
    assert (await client.receive_json())["result"]["silent"]["tracked"] == 0


async def test_settings_step(hass: HomeAssistant) -> None:
    entry = MockConfigEntry(domain=DOMAIN, title="System Hub", options={CONF_MODULES: ["silent"]})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    result = await hass.config_entries.options.async_init(entry.entry_id)
    assert "silent" in result["menu_options"]
    result = await hass.config_entries.options.async_configure(result["flow_id"], {"next_step_id": "silent"})
    result = await hass.config_entries.options.async_configure(
        result["flow_id"], {"integrations": ["zha", "mqtt"], "battery_hours": 30, "mains_hours": 6}
    )
    assert entry.options["silent"] == {
        "integrations": ["zha", "mqtt"],
        "battery_hours": 30,
        "mains_hours": 6,
        "ignored_devices": [],
    }
