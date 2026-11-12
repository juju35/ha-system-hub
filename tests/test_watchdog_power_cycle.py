"""Power cycles: a device switched off and on again with the smart plug that powers it."""

from __future__ import annotations

import asyncio
from datetime import timedelta
from unittest.mock import AsyncMock, patch

import pytest
from freezegun.api import FrozenDateTimeFactory
from homeassistant.components import persistent_notification
from homeassistant.const import STATE_OFF, STATE_ON, STATE_UNAVAILABLE
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.data_entry_flow import FlowResultType
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.setup import async_setup_component
from pytest_homeassistant_custom_component.common import MockConfigEntry, async_capture_events

from custom_components.system_hub.const import DOMAIN
from custom_components.system_hub.watchdog import core as watchdog_module
from custom_components.system_hub.watchdog.const import (
    CONF_GRACE_PERIOD,
    CONF_IGNORED,
    CONF_MAX_RELOADS,
    CONF_NOTIFY,
    CONF_POWER_CYCLES,
    CONF_SCAN_INTERVAL,
    EVENT_POWER_CYCLED,
    STORAGE_KEY,
)

PLUG = "switch.box_plug"
OPTIONS = {
    CONF_SCAN_INTERVAL: 5,
    CONF_GRACE_PERIOD: 15,
    CONF_MAX_RELOADS: 2,
    # The device's own integration isn't reloaded: only the power cycles are tested here.
    CONF_IGNORED: ["box"],
    CONF_NOTIFY: [],
}


def _device(hass: HomeAssistant, states: list[str]) -> str:
    """A device of the "box" integration with one sensor per item of `states`; returns its id."""
    entry = MockConfigEntry(domain="box", title="Box")
    entry.add_to_hass(hass)
    device = dr.async_get(hass).async_get_or_create(
        config_entry_id=entry.entry_id, identifiers={("box", "1")}, name="Internet box"
    )
    registry = er.async_get(hass)
    for i, value in enumerate(states):
        entity = registry.async_get_or_create(
            "sensor", "box", f"box_{i}", config_entry=entry, device_id=device.id, suggested_object_id=f"box_{i}"
        )
        hass.states.async_set(entity.entity_id, value)
    return device.id


def _set_device(hass: HomeAssistant, device_id: str, value: str) -> None:
    for entity in er.async_entries_for_device(er.async_get(hass), device_id):
        hass.states.async_set(entity.entity_id, value)


@pytest.fixture
def plug(hass: HomeAssistant) -> list[str]:
    """The plug, on; its turn_off / turn_on calls, in order (they change its state like a real plug)."""
    hass.states.async_set(PLUG, STATE_ON, {"friendly_name": "Box plug"})
    calls: list[str] = []

    async def handle(call: ServiceCall) -> None:
        calls.append(call.service)
        hass.states.async_set(
            PLUG, STATE_OFF if call.service == "turn_off" else STATE_ON, {"friendly_name": "Box plug"}
        )

    hass.services.async_register("switch", "turn_off", handle)
    hass.services.async_register("switch", "turn_on", handle)
    return calls


@pytest.fixture(autouse=True)
def no_wait():
    with patch.object(watchdog_module, "_sleep", AsyncMock()) as sleep:
        yield sleep


async def _setup(hass: HomeAssistant, device_id: str, **options) -> MockConfigEntry:
    cycles = [{"device_id": device_id, "switch": PLUG, "delay": 10, "off_time": 20}]
    entry = MockConfigEntry(
        domain=DOMAIN,
        unique_id=DOMAIN,
        options={"modules": ["watchdog"], "watchdog": {**OPTIONS, CONF_POWER_CYCLES: cycles, **options}},
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


async def _check(hass: HomeAssistant) -> None:
    await hass.services.async_call(DOMAIN, "watchdog_check", {}, blocking=True)
    await hass.async_block_till_done()


def _notification(hass: HomeAssistant, device_id: str) -> dict | None:
    return persistent_notification._async_get_or_create_notifications(hass).get(
        watchdog_module.device_notification_id(device_id)
    )


async def test_power_cycle_after_delay_then_backoff_then_give_up(
    hass: HomeAssistant, freezer: FrozenDateTimeFactory, plug: list[str], no_wait: AsyncMock, hass_storage: dict
):
    device_id = _device(hass, [STATE_UNAVAILABLE, STATE_UNAVAILABLE])
    await _setup(hass, device_id)
    events = async_capture_events(hass, EVENT_POWER_CYCLED)

    # Before its delay (and the grace period after the setup, already passed: HA was running): nothing.
    freezer.tick(timedelta(minutes=9))
    await _check(hass)
    assert plug == []

    freezer.tick(timedelta(minutes=1))
    await _check(hass)
    assert plug == ["turn_off", "turn_on"]
    no_wait.assert_awaited_once_with(20)
    assert hass.states.get(PLUG).state == STATE_ON
    assert events[0].data | {"unavailable_since": None} == {
        "device_id": device_id,
        "name": "Internet box",
        "switch": PLUG,
        "success": True,
        "unavailable_since": None,
        "attempt": 1,
        "max_reloads": 2,
    }
    assert "Internet box" in _notification(hass, device_id)["message"]
    assert "Box plug" in _notification(hass, device_id)["message"]

    # Still unavailable: the next one waits the delay again (count 1), then twice the delay.
    freezer.tick(timedelta(minutes=9))
    await _check(hass)
    assert len(plug) == 2
    freezer.tick(timedelta(minutes=1))
    await _check(hass)
    assert len(plug) == 4
    freezer.tick(timedelta(minutes=19))
    await _check(hass)
    assert len(plug) == 4

    # Limit reached (2): given up once that delay has passed, notified once, never switched off again.
    freezer.tick(timedelta(minutes=1))
    await _check(hass)
    freezer.tick(timedelta(hours=5))
    await _check(hass)
    assert len(plug) == 4
    history = hass.states.get("sensor.system_hub_sentinel_last_reload").attributes["history"]
    assert [h["kind"] for h in history] == ["power_cycle_gave_up", "power_cycled", "power_cycled"]
    assert history[1]["device_id"] == device_id
    assert history[1]["switch"] == PLUG
    assert history[1]["switch_name"] == "Box plug"
    assert history[1]["title"] == "Internet box"
    assert history[1]["domain"] == "box"
    await hass.async_block_till_done()
    freezer.tick(timedelta(seconds=11))
    await hass.async_block_till_done()

    # Back: once available for the current delay, it starts over (notification dismissed).
    _set_device(hass, device_id, "12")
    await _check(hass)
    freezer.tick(timedelta(minutes=20))
    await _check(hass)
    assert _notification(hass, device_id) is None
    entry = hass.config_entries.async_entries(DOMAIN)[0]
    assert entry.runtime_data.watchdog.cycle_attempts == {}


async def test_plug_off_or_unavailable_is_left_alone(
    hass: HomeAssistant, freezer: FrozenDateTimeFactory, plug: list[str]
):
    device_id = _device(hass, [STATE_UNAVAILABLE])
    await _setup(hass, device_id)
    freezer.tick(timedelta(hours=1))
    for state in (STATE_OFF, STATE_UNAVAILABLE):
        hass.states.async_set(PLUG, state)
        await _check(hass)
    assert plug == []


async def test_available_device_and_pause(hass: HomeAssistant, freezer: FrozenDateTimeFactory, plug: list[str]):
    device_id = _device(hass, [STATE_UNAVAILABLE, "on"])
    hass.states.async_set("input_boolean.maintenance", STATE_ON)
    await _setup(hass, device_id, pause_entity="input_boolean.maintenance")
    freezer.tick(timedelta(hours=1))
    await _check(hass)
    assert plug == []
    _set_device(hass, device_id, STATE_UNAVAILABLE)
    freezer.tick(timedelta(hours=1))
    await _check(hass)
    assert plug == []
    hass.states.async_set("input_boolean.maintenance", STATE_OFF)
    await _check(hass)
    assert plug == ["turn_off", "turn_on"]


async def test_plug_switched_on_even_when_switching_off_fails(
    hass: HomeAssistant, freezer: FrozenDateTimeFactory, plug: list[str], no_wait: AsyncMock
):
    device_id = _device(hass, [STATE_UNAVAILABLE])
    await _setup(hass, device_id)
    freezer.tick(timedelta(hours=1))
    no_wait.side_effect = asyncio.CancelledError
    with pytest.raises(asyncio.CancelledError):
        await hass.config_entries.async_entries(DOMAIN)[0].runtime_data.watchdog._async_power_cycle(
            hass.config_entries.async_entries(DOMAIN)[0].runtime_data.watchdog.power_cycles[0]
        )
    # Cancelled with the plug off (Home Assistant stopping): switched on all the same.
    assert plug == ["turn_off", "turn_on"]
    assert hass.states.get(PLUG).state == STATE_ON

    async def broken(call: ServiceCall) -> None:
        raise RuntimeError("plug offline")

    hass.services.async_register("switch", "turn_off", broken)
    no_wait.side_effect = None
    await _check(hass)
    history = hass.states.get("sensor.system_hub_sentinel_last_reload").attributes["history"]
    assert history[0]["kind"] == "power_cycle_failed"
    assert plug[-1] == "turn_on"
    assert "Box plug" in _notification(hass, device_id)["message"]


async def test_plug_left_off_is_switched_on_after_a_restart(hass: HomeAssistant, plug: list[str], hass_storage: dict):
    device_id = _device(hass, ["on"])
    hass.states.async_set(PLUG, STATE_OFF)
    hass_storage[STORAGE_KEY] = {
        "version": 1,
        "key": STORAGE_KEY,
        "data": {"history": [], "attempts": {}, "power_cycles": {"gone": {"count": 1}}, "powered_off": [PLUG]},
    }
    entry = await _setup(hass, device_id)
    await _check(hass)
    assert plug == ["turn_on"]
    assert entry.runtime_data.watchdog.powered_off == set()
    assert entry.runtime_data.watchdog.cycle_attempts == {}


async def test_options_flow_add_and_remove(hass: HomeAssistant, plug: list[str]):
    device_id = _device(hass, ["on"])
    entry = MockConfigEntry(domain=DOMAIN, unique_id=DOMAIN, options={"modules": ["watchdog"], "watchdog": OPTIONS})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    registry = er.async_get(hass)
    own = registry.async_get_or_create("switch", "box", "own_plug", device_id=device_id, suggested_object_id="own")
    empty = dr.async_get(hass).async_get_or_create(
        config_entry_id=hass.config_entries.async_entries("box")[0].entry_id, identifiers={("box", "2")}
    )

    result = await hass.config_entries.options.async_init(entry.entry_id, context={"source": "system_hub_panel"})
    assert result["type"] is FlowResultType.MENU
    assert result["menu_options"] == ["modules", "system", "watchdog", "watchdog_add_power_cycle"]
    result = await hass.config_entries.options.async_configure(
        result["flow_id"], {"next_step_id": "watchdog_add_power_cycle"}
    )
    assert result["type"] is FlowResultType.FORM

    async def submit(**data):
        return await hass.config_entries.options.async_configure(
            result["flow_id"], {"device_id": device_id, "switch": PLUG, "delay": 10, "off_time": 15} | data
        )

    assert (await submit(switch=own.entity_id))["errors"] == {"switch": "switch_on_device"}
    assert (await submit(device_id=empty.id))["errors"] == {"device_id": "device_without_entities"}
    done = await submit()
    assert done["type"] is FlowResultType.CREATE_ENTRY
    await hass.async_block_till_done()
    cycle = {"device_id": device_id, "switch": PLUG, "delay": 10, "off_time": 15}
    assert entry.options["watchdog"][CONF_POWER_CYCLES] == [cycle]
    assert entry.runtime_data.watchdog.power_cycles[0].off_time == timedelta(seconds=15)

    # Twice the same device: refused.
    result = await hass.config_entries.options.async_init(entry.entry_id, context={"source": "system_hub_panel"})
    assert result["menu_options"] == [
        "modules",
        "system",
        "watchdog",
        "watchdog_add_power_cycle",
        "watchdog_remove_power_cycle",
    ]
    result = await hass.config_entries.options.async_configure(
        result["flow_id"], {"next_step_id": "watchdog_add_power_cycle"}
    )
    assert (await submit())["errors"] == {"device_id": "device_already_cycled"}

    # The settings keep the power cycles.
    result = await hass.config_entries.options.async_init(entry.entry_id, context={"source": "system_hub_panel"})
    result = await hass.config_entries.options.async_configure(result["flow_id"], {"next_step_id": "watchdog"})
    await hass.config_entries.options.async_configure(
        result["flow_id"], {CONF_SCAN_INTERVAL: 5, CONF_GRACE_PERIOD: 15, CONF_MAX_RELOADS: 3}
    )
    await hass.async_block_till_done()
    assert entry.options["watchdog"][CONF_POWER_CYCLES] == [cycle]
    assert entry.options["watchdog"][CONF_MAX_RELOADS] == 3

    result = await hass.config_entries.options.async_init(entry.entry_id, context={"source": "system_hub_panel"})
    result = await hass.config_entries.options.async_configure(
        result["flow_id"], {"next_step_id": "watchdog_remove_power_cycle"}
    )
    label = result["data_schema"].schema[CONF_POWER_CYCLES].config["options"][0]["label"]
    assert label == "Internet box → Box plug (10 min, 15 s)"
    result = await hass.config_entries.options.async_configure(result["flow_id"], {CONF_POWER_CYCLES: [device_id]})
    assert result["type"] is FlowResultType.CREATE_ENTRY
    await hass.async_block_till_done()
    assert CONF_POWER_CYCLES not in entry.options["watchdog"]
    assert entry.options["watchdog"][CONF_MAX_RELOADS] == 3


async def test_power_cycles_in_the_panel(hass: HomeAssistant, plug: list[str], hass_ws_client) -> None:
    """The panel lists each power cycle: the device, the plug and its state, the delays, available or not."""
    assert await async_setup_component(hass, "frontend", {})
    device_id = _device(hass, ["unavailable"])
    await _setup(hass, device_id)
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "system_hub/state"})
    [cycle] = (await client.receive_json())["result"]["watchdog"]["power_cycles"]
    assert cycle["device_name"] == "Internet box"
    assert cycle["switch"] == PLUG
    assert cycle["switch_name"] == "Box plug"
    assert cycle["switch_state"] == STATE_ON
    assert cycle["delay"] == 10
    assert cycle["off_time"] == 20
    assert cycle["unavailable"] is True
    assert cycle["count"] == 0
