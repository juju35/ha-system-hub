"""Tests for Integration Watchdog."""

from __future__ import annotations

import asyncio
import gc
import json
from datetime import timedelta
from unittest.mock import AsyncMock, patch

import pytest
from freezegun.api import FrozenDateTimeFactory
from homeassistant.components import persistent_notification
from homeassistant.components.repairs import repairs_flow_manager
from homeassistant.config_entries import ConfigEntryDisabler, ConfigEntryState, OperationNotAllowed
from homeassistant.const import EVENT_HOMEASSISTANT_STARTED, EVENT_STATE_CHANGED, STATE_UNAVAILABLE
from homeassistant.core import CoreState, HomeAssistant
from homeassistant.data_entry_flow import FlowResultType
from homeassistant.exceptions import HomeAssistantError, ServiceValidationError
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers import issue_registry as ir
from homeassistant.setup import async_setup_component
from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.common import (
    MockConfigEntry,
    async_capture_events,
    async_fire_time_changed,
    async_mock_service,
)

from custom_components.system_hub.const import DOMAIN
from custom_components.system_hub.watchdog import core as watchdog_module
from custom_components.system_hub.watchdog.const import (
    CONF_GRACE_PERIOD,
    CONF_IGNORED,
    CONF_MAX_RELOADS,
    CONF_NOTIFY,
    CONF_SCAN_INTERVAL,
    EVENT_RELOADED,
    HISTORY_SIZE,
    STORAGE_KEY,
)

from .conftest import add_integration

UNAVAILABLE = "sensor.system_hub_watchdog_unavailable_integrations"
LAST_RELOAD = "sensor.system_hub_watchdog_last_reload"
LAST_CHECK = "sensor.system_hub_watchdog_last_check"
BUTTON = "button.system_hub_watchdog_check_now"
OPTIONS = {
    CONF_SCAN_INTERVAL: 5,
    CONF_GRACE_PERIOD: 15,
    CONF_MAX_RELOADS: 3,
    CONF_IGNORED: [],
    CONF_NOTIFY: [],
}


async def _setup(hass: HomeAssistant, **options) -> MockConfigEntry:
    entry = MockConfigEntry(
        domain=DOMAIN, unique_id=DOMAIN, options={"modules": ["watchdog"], "watchdog": {**OPTIONS, **options}}
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


async def _settings_flow(hass: HomeAssistant, entry: MockConfigEntry):
    """The options flow, past its menu: the settings form."""
    result = await hass.config_entries.options.async_init(entry.entry_id)
    assert result["type"] is FlowResultType.MENU
    return await hass.config_entries.options.async_configure(result["flow_id"], {"next_step_id": "watchdog"})


async def _check(hass: HomeAssistant) -> None:
    await hass.services.async_call(DOMAIN, "watchdog_check", {}, blocking=True)
    await hass.async_block_till_done()


async def test_single_instance(hass):
    await _setup(hass)
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": "user"})
    assert result["type"] is FlowResultType.ABORT


async def test_options_flow(hass):
    entry = await _setup(hass)
    result = await _settings_flow(hass, entry)
    assert result["type"] is FlowResultType.FORM
    result = await hass.config_entries.options.async_configure(
        result["flow_id"],
        {CONF_SCAN_INTERVAL: 2, CONF_GRACE_PERIOD: 5, CONF_MAX_RELOADS: 3, CONF_IGNORED: ["mqtt"]},
    )
    assert result["type"] is FlowResultType.CREATE_ENTRY
    await hass.async_block_till_done()
    assert entry.options["watchdog"] == {
        CONF_SCAN_INTERVAL: 2,
        CONF_GRACE_PERIOD: 5,
        CONF_MAX_RELOADS: 3,
        CONF_IGNORED: ["mqtt"],
        CONF_NOTIFY: [],
    }
    assert entry.state is ConfigEntryState.LOADED
    assert hass.states.get(UNAVAILABLE).attributes["ignored"] == ["mqtt"]

    # A pause entity is kept only when chosen.
    result = await _settings_flow(hass, entry)
    result = await hass.config_entries.options.async_configure(
        result["flow_id"],
        {CONF_SCAN_INTERVAL: 2, CONF_GRACE_PERIOD: 5, CONF_MAX_RELOADS: 3, "pause_entity": "input_boolean.maintenance"},
    )
    await hass.async_block_till_done()
    assert entry.options["watchdog"]["pause_entity"] == "input_boolean.maintenance"


async def test_reloads_unavailable_integration_after_grace_period(hass: HomeAssistant, freezer: FrozenDateTimeFactory):
    dead = add_integration(hass, "dead", [STATE_UNAVAILABLE, STATE_UNAVAILABLE])
    add_integration(hass, "partial", [STATE_UNAVAILABLE, "12"])
    add_integration(hass, "alive", ["on"])
    add_integration(hass, "empty", [])
    add_integration(hass, "unloaded", [STATE_UNAVAILABLE], state=ConfigEntryState.NOT_LOADED)
    await _setup(hass)
    events = async_capture_events(hass, EVENT_RELOADED)

    with patch.object(hass.config_entries, "async_reload", AsyncMock(return_value=True)) as reload:
        # Within the grace period: listed, not reloaded.
        await _check(hass)
        reload.assert_not_awaited()
        state = hass.states.get(UNAVAILABLE)
        assert state.state == "1"
        assert [i["domain"] for i in state.attributes["integrations"]] == ["dead"]

        freezer.tick(timedelta(minutes=15))
        await _check(hass)
        reload.assert_awaited_once_with(dead.entry_id)

    assert len(events) == 1
    assert events[0].data["domain"] == "dead"
    assert events[0].data["success"] is True
    state = hass.states.get(LAST_RELOAD)
    assert state.state not in ("unknown", "unavailable")
    assert state.attributes["domain"] == "dead"
    assert state.attributes["reloads"] == 1
    assert hass.states.get(LAST_CHECK).state not in ("unknown", "unavailable")


async def test_pause_entity_holds_the_reloads(hass: HomeAssistant, freezer: FrozenDateTimeFactory):
    dead = add_integration(hass, "dead", [STATE_UNAVAILABLE])
    hass.states.async_set("input_boolean.maintenance", "on")
    await _setup(hass, pause_entity="input_boolean.maintenance")
    freezer.tick(timedelta(hours=1))
    with patch.object(hass.config_entries, "async_reload", AsyncMock(return_value=True)) as reload:
        await _check(hass)
        reload.assert_not_awaited()
        state = hass.states.get(UNAVAILABLE)
        # Still listed, and the sensor says why nothing happens.
        assert state.state == "1"
        assert state.attributes["paused"] is True
        hass.states.async_set("input_boolean.maintenance", "off")
        await _check(hass)
        reload.assert_awaited_once_with(dead.entry_id)
    assert hass.states.get(UNAVAILABLE).attributes["paused"] is False


async def test_grace_overrides_per_integration(hass: HomeAssistant, freezer: FrozenDateTimeFactory):
    slow = add_integration(hass, "slow", [STATE_UNAVAILABLE])
    fast = add_integration(hass, "fast", [STATE_UNAVAILABLE])
    await _setup(hass, grace_overrides={"slow": 60, "fast": 5})
    with patch.object(hass.config_entries, "async_reload", AsyncMock(return_value=True)) as reload:
        # "fast" after its own 5 minutes, before the global 15; "slow" not at 15.
        freezer.tick(timedelta(minutes=4))
        await _check(hass)
        reload.assert_not_awaited()
        freezer.tick(timedelta(minutes=1))
        await _check(hass)
        reload.assert_awaited_once_with(fast.entry_id)
        reload.reset_mock()
        freezer.tick(timedelta(minutes=10))
        await _check(hass)
        assert slow.entry_id not in [c.args[0] for c in reload.await_args_list]
        # "slow" waits its own hour.
        reload.reset_mock()
        freezer.tick(timedelta(minutes=45))
        await _check(hass)
        assert slow.entry_id in [c.args[0] for c in reload.await_args_list]


async def test_options_flow_grace_overrides(hass):
    entry = await _setup(hass)
    base = {CONF_SCAN_INTERVAL: 2, CONF_GRACE_PERIOD: 5, CONF_MAX_RELOADS: 3}
    result = await _settings_flow(hass, entry)
    result = await hass.config_entries.options.async_configure(
        result["flow_id"], {**base, "grace_overrides": "zha: 30\nfoo"}
    )
    assert result["type"] is FlowResultType.FORM
    assert result["errors"] == {"grace_overrides": "invalid_overrides"}
    result = await hass.config_entries.options.async_configure(
        result["flow_id"], {**base, "grace_overrides": "ZHA: 30, tuya=90\n\n"}
    )
    assert result["type"] is FlowResultType.CREATE_ENTRY
    await hass.async_block_till_done()
    assert entry.options["watchdog"]["grace_overrides"] == {"tuya": 90, "zha": 30}
    assert entry.runtime_data.watchdog.grace("zha") == timedelta(minutes=30)
    assert entry.runtime_data.watchdog.grace("mqtt") == timedelta(minutes=5)
    # Shown back one per line; emptied, the option goes away.
    result = await _settings_flow(hass, entry)
    key = next(k for k in result["data_schema"].schema if k == "grace_overrides")
    assert key.description["suggested_value"] == "tuya: 90\nzha: 30"
    result = await hass.config_entries.options.async_configure(result["flow_id"], {**base, "grace_overrides": ""})
    await hass.async_block_till_done()
    assert "grace_overrides" not in entry.options["watchdog"]


async def test_ignored_integration(hass: HomeAssistant, freezer: FrozenDateTimeFactory):
    add_integration(hass, "dead", [STATE_UNAVAILABLE])
    await _setup(hass, **{CONF_IGNORED: ["dead"]})
    freezer.tick(timedelta(hours=1))
    with patch.object(hass.config_entries, "async_reload", AsyncMock(return_value=True)) as reload:
        await _check(hass)
    reload.assert_not_awaited()
    assert hass.states.get(UNAVAILABLE).state == "0"


async def test_disabled_entities_are_skipped(hass: HomeAssistant, freezer: FrozenDateTimeFactory):
    entry = add_integration(hass, "mixed", [STATE_UNAVAILABLE])
    registry = er.async_get(hass)
    disabled = registry.async_get_or_create(
        "sensor", "mixed", "disabled", config_entry=entry, disabled_by=er.RegistryEntryDisabler.USER
    )
    hass.states.async_set(disabled.entity_id, "on")
    await _setup(hass)
    freezer.tick(timedelta(minutes=20))
    with patch.object(hass.config_entries, "async_reload", AsyncMock(return_value=True)) as reload:
        await _check(hass)
    reload.assert_awaited_once_with(entry.entry_id)


async def test_entities_not_provided_count_as_unavailable(hass: HomeAssistant, freezer: FrozenDateTimeFactory):
    """Loaded, but its entities were never created (device off): only "restored" placeholders."""
    entry = add_integration(hass, "printer", [])
    registry = er.async_get(hass)
    for i in range(3):
        entity = registry.async_get_or_create("sensor", "printer", f"p{i}", config_entry=entry)
        hass.states.async_set(entity.entity_id, STATE_UNAVAILABLE, {"restored": True, "supported_features": 0})
    await _setup(hass)
    freezer.tick(timedelta(minutes=15))
    with patch.object(hass.config_entries, "async_reload", AsyncMock(return_value=True)) as reload:
        await _check(hass)
    reload.assert_awaited_once_with(entry.entry_id)


async def test_failed_reload_does_not_stop_the_others(hass: HomeAssistant, freezer: FrozenDateTimeFactory):
    first = add_integration(hass, "aaa", [STATE_UNAVAILABLE])
    second = add_integration(hass, "bbb", [STATE_UNAVAILABLE])
    await _setup(hass)
    events = async_capture_events(hass, EVENT_RELOADED)
    freezer.tick(timedelta(minutes=20))
    with patch.object(
        hass.config_entries, "async_reload", AsyncMock(side_effect=[RuntimeError("boom"), True])
    ) as reload:
        await _check(hass)
    assert [c.args[0] for c in reload.await_args_list] == [first.entry_id, second.entry_id]
    assert [e.data["success"] for e in events] == [False, True]
    assert hass.states.get(LAST_RELOAD).attributes["reloads"] == 2


async def test_recovered_during_check_is_not_reloaded(hass: HomeAssistant, freezer: FrozenDateTimeFactory):
    """An integration available again between the snapshot and its turn in the reload loop is skipped."""
    first = add_integration(hass, "aaa", [STATE_UNAVAILABLE])
    add_integration(hass, "bbb", [STATE_UNAVAILABLE])
    await _setup(hass)
    freezer.tick(timedelta(minutes=20))

    async def recover_second(entry_id: str) -> bool:
        hass.states.async_set("sensor.bbb_0", "on")
        return True

    with patch.object(hass.config_entries, "async_reload", AsyncMock(side_effect=recover_second)) as reload:
        await _check(hass)
    reload.assert_awaited_once_with(first.entry_id)
    assert hass.states.get(UNAVAILABLE).state == "1"


async def test_broken_translation_does_not_stop_the_check(hass: HomeAssistant, freezer: FrozenDateTimeFactory):
    """A translation with an unknown placeholder falls back to the raw template, the check goes on."""
    first = add_integration(hass, "aaa", [STATE_UNAVAILABLE])
    second = add_integration(hass, "bbb", [STATE_UNAVAILABLE])
    await _setup(hass)
    freezer.tick(timedelta(minutes=20))
    strings = {
        f"component.{DOMAIN}.common.watchdog_reloaded_title": "Reloaded {unknown}",
        f"component.{DOMAIN}.common.watchdog_reloaded": "Stray brace } in {title}",
    }
    with (
        patch.object(watchdog_module, "async_get_translations", AsyncMock(return_value=strings)),
        patch.object(hass.config_entries, "async_reload", AsyncMock(return_value=True)) as reload,
    ):
        await _check(hass)
    assert [c.args[0] for c in reload.await_args_list] == [first.entry_id, second.entry_id]
    notifications = persistent_notification._async_get_or_create_notifications(hass)
    notification = notifications[f"{DOMAIN}_watchdog_{first.entry_id}"]
    assert notification["title"] == "Reloaded {unknown}"
    assert notification["message"] == "Stray brace } in {title}"
    assert hass.states.get(LAST_CHECK).state not in ("unknown", "unavailable")


async def test_scheduled_check_and_button(hass: HomeAssistant, freezer: FrozenDateTimeFactory):
    dead = add_integration(hass, "dead", [STATE_UNAVAILABLE])
    await _setup(hass, **{CONF_SCAN_INTERVAL: 1, CONF_GRACE_PERIOD: 1})
    with patch.object(hass.config_entries, "async_reload", AsyncMock(return_value=True)) as reload:
        freezer.tick(timedelta(minutes=1, seconds=1))
        async_fire_time_changed(hass)
        await hass.async_block_till_done()
        reload.assert_awaited_once_with(dead.entry_id)

        # One grace period after the first reload, the button runs a check that reloads again.
        reload.reset_mock()
        freezer.tick(timedelta(minutes=1))
        await hass.services.async_call("button", "press", {"entity_id": BUTTON}, blocking=True)
        await hass.async_block_till_done()
        reload.assert_awaited_once_with(dead.entry_id)


async def test_unload(hass):
    entry = await _setup(hass)
    assert await hass.config_entries.async_unload(entry.entry_id)
    assert entry.state is ConfigEntryState.NOT_LOADED


async def test_no_reload_while_starting(hass: HomeAssistant, freezer: FrozenDateTimeFactory):
    add_integration(hass, "dead", [STATE_UNAVAILABLE])
    hass.set_state(CoreState.starting)
    await _setup(hass)
    freezer.tick(timedelta(hours=1))
    with patch.object(hass.config_entries, "async_reload", AsyncMock(return_value=True)) as reload:
        await _check(hass)
        async_fire_time_changed(hass)
        await hass.async_block_till_done()
        reload.assert_not_awaited()
        assert hass.states.get(LAST_CHECK).state == "unknown"

        # Started: first check right away, but nothing reloaded during the grace period.
        hass.set_state(CoreState.running)
        hass.bus.async_fire(EVENT_HOMEASSISTANT_STARTED)
        await hass.async_block_till_done()
        reload.assert_not_awaited()
        assert hass.states.get(UNAVAILABLE).state == "1"

        freezer.tick(timedelta(minutes=15))
        await _check(hass)
        reload.assert_awaited_once()


async def test_backoff_and_give_up(hass: HomeAssistant, freezer: FrozenDateTimeFactory):
    dead = add_integration(hass, "dead", [STATE_UNAVAILABLE])
    await _setup(hass)  # grace 15 min, 3 reloads
    freezer.tick(timedelta(minutes=15))
    with patch.object(hass.config_entries, "async_reload", AsyncMock(return_value=True)) as reload:
        times = []
        # Checks every 5 minutes for 3 hours.
        for minute in range(0, 180, 5):
            count = reload.await_count
            await _check(hass)
            if reload.await_count > count:
                times.append(minute)
            freezer.tick(timedelta(minutes=5))
    # Reloads at 0, +15 min, +30 min (delay doubled), then never again.
    assert times == [0, 15, 45]
    assert reload.await_count == 3
    item = hass.states.get(UNAVAILABLE).attributes["integrations"][0]
    assert item["reloads"] == 3
    assert item["gave_up"] is True
    notifications = persistent_notification._async_get_or_create_notifications(hass)
    notification = notifications[f"{DOMAIN}_watchdog_{dead.entry_id}"]
    assert "still unavailable after 3 reloads" in notification["message"]


async def test_recovery_resets_after_its_delay(hass: HomeAssistant, freezer: FrozenDateTimeFactory):
    dead = add_integration(hass, "dead", [STATE_UNAVAILABLE])
    entity_id = "sensor.dead_0"
    await _setup(hass, **{CONF_MAX_RELOADS: 1})
    freezer.tick(timedelta(minutes=15))
    with patch.object(hass.config_entries, "async_reload", AsyncMock(return_value=True)) as reload:
        await _check(hass)
        assert reload.await_count == 1
        # Back for a moment long after the reload, then down again: the count is kept, no new reload.
        freezer.tick(timedelta(minutes=30))
        hass.states.async_set(entity_id, "1")
        await _check(hass)
        hass.states.async_set(entity_id, STATE_UNAVAILABLE)
        freezer.tick(timedelta(minutes=16))
        await _check(hass)
        assert reload.await_count == 1
        # Available for the delay, measured from its return: starts over.
        hass.states.async_set(entity_id, "1")
        await _check(hass)
        freezer.tick(timedelta(minutes=10))
        await _check(hass)
        freezer.tick(timedelta(minutes=5))
        await _check(hass)
        hass.states.async_set(entity_id, STATE_UNAVAILABLE)
        freezer.tick(timedelta(minutes=16))
        await _check(hass)
        assert reload.await_count == 2
        reload.assert_awaited_with(dead.entry_id)


async def test_gives_up_only_after_the_last_delay(hass: HomeAssistant, freezer: FrozenDateTimeFactory):
    """The give-up notification waits for the delay after the last reload."""
    dead = add_integration(hass, "dead", [STATE_UNAVAILABLE])
    await _setup(hass)  # grace 15 min, 3 reloads: at 0, 15, 45, then the last delay is 60 min
    freezer.tick(timedelta(minutes=15))
    key = f"{DOMAIN}_watchdog_{dead.entry_id}"
    with patch.object(hass.config_entries, "async_reload", AsyncMock(return_value=True)):
        gave_up_at = None
        for minute in range(0, 180, 5):
            await _check(hass)
            item = hass.states.get(UNAVAILABLE).attributes["integrations"][0]
            if item["gave_up"] and gave_up_at is None:
                gave_up_at = minute
                message = persistent_notification._async_get_or_create_notifications(hass)[key]["message"]
                assert "still unavailable after 3 reloads" in message
            freezer.tick(timedelta(minutes=5))
    assert gave_up_at == 105


async def test_blip_after_give_up_keeps_the_count(hass: HomeAssistant, freezer: FrozenDateTimeFactory):
    add_integration(hass, "dead", [STATE_UNAVAILABLE])
    entity_id = "sensor.dead_0"
    await _setup(hass)
    freezer.tick(timedelta(minutes=15))
    with patch.object(hass.config_entries, "async_reload", AsyncMock(return_value=True)) as reload:
        for _ in range(36):
            await _check(hass)
            freezer.tick(timedelta(minutes=5))
        assert reload.await_count == 3
        assert hass.states.get(UNAVAILABLE).attributes["integrations"][0]["gave_up"] is True
        # One check with the integration available, then down again for hours: nothing more.
        hass.states.async_set(entity_id, "1")
        await _check(hass)
        hass.states.async_set(entity_id, STATE_UNAVAILABLE)
        for _ in range(36):
            freezer.tick(timedelta(minutes=5))
            await _check(hass)
        assert reload.await_count == 3
        item = hass.states.get(UNAVAILABLE).attributes["integrations"][0]
        assert item["reloads"] == 3
        assert item["gave_up"] is True


async def _check_past_timeout(hass: HomeAssistant, freezer: FrozenDateTimeFactory, timeout: timedelta) -> None:
    """Run a check that hangs, and move the clock past `timeout` so that it gives up waiting."""
    task = hass.async_create_task(_check(hass))
    for _ in range(10):
        await asyncio.sleep(0)
    freezer.tick(timeout + timedelta(seconds=1))
    async_fire_time_changed(hass)
    await task


async def test_hung_reload_times_out(hass: HomeAssistant, freezer: FrozenDateTimeFactory):
    """A reload that never returns counts as failed and doesn't keep the check running."""
    add_integration(hass, "hung", [STATE_UNAVAILABLE])
    other = add_integration(hass, "other", [STATE_UNAVAILABLE])
    await _setup(hass)
    events = async_capture_events(hass, EVENT_RELOADED)
    freezer.tick(timedelta(minutes=15))
    release = asyncio.Event()

    async def reload_side_effect(entry_id):
        if entry_id != other.entry_id:
            await release.wait()
        return True

    with patch.object(hass.config_entries, "async_reload", AsyncMock(side_effect=reload_side_effect)):
        await _check_past_timeout(hass, freezer, watchdog_module.RELOAD_TIMEOUT)
        assert [(e.data["domain"], e.data["success"]) for e in events] == [("hung", False), ("other", True)]
        assert not hass.config_entries.async_entries(DOMAIN)[0].runtime_data.watchdog.running
        assert hass.states.get(BUTTON).state != "unavailable"
        release.set()
        await hass.async_block_till_done(wait_background_tasks=True)


async def test_reload_failing_after_timeout_is_logged(
    hass: HomeAssistant, freezer: FrozenDateTimeFactory, caplog: pytest.LogCaptureFixture
):
    """A reload that fails after its timeout is logged, not left to "Task exception was never retrieved"."""
    add_integration(hass, "late", [STATE_UNAVAILABLE])
    await _setup(hass)
    freezer.tick(timedelta(minutes=15))
    release = asyncio.Event()
    unhandled = []
    hass.loop.set_exception_handler(lambda _loop, context: unhandled.append(context))

    async def reload_side_effect(_entry_id):
        await release.wait()
        raise OperationNotAllowed("late failure")

    with patch.object(hass.config_entries, "async_reload", AsyncMock(side_effect=reload_side_effect)):
        await _check_past_timeout(hass, freezer, watchdog_module.RELOAD_TIMEOUT)
        release.set()
        await hass.async_block_till_done(wait_background_tasks=True)
    gc.collect()
    await asyncio.sleep(0)
    assert not [c for c in unhandled if "never retrieved" in c.get("message", "")]
    assert "Reloading Late (late) failed after its timeout" in caplog.text
    assert "late failure" in caplog.text


async def test_hung_notifier_times_out(hass: HomeAssistant, freezer: FrozenDateTimeFactory):
    add_integration(hass, "dead", [STATE_UNAVAILABLE])
    release = asyncio.Event()

    async def hang(_call):
        await release.wait()

    hass.services.async_register("notify", "stuck", hang)
    await _setup(hass, **{CONF_NOTIFY: ["notify.stuck"]})
    freezer.tick(timedelta(minutes=15))
    with patch.object(hass.config_entries, "async_reload", AsyncMock(return_value=True)) as reload:
        await _check_past_timeout(hass, freezer, watchdog_module.NOTIFY_TIMEOUT)
    reload.assert_awaited_once()
    assert not hass.config_entries.async_entries(DOMAIN)[0].runtime_data.watchdog.running
    release.set()
    await hass.async_block_till_done()


async def test_helpers_are_not_reloaded(hass: HomeAssistant, freezer: FrozenDateTimeFactory):
    add_integration(hass, "template", [STATE_UNAVAILABLE])
    dead = add_integration(hass, "dead", [STATE_UNAVAILABLE])
    await _setup(hass)
    freezer.tick(timedelta(minutes=15))
    with patch.object(hass.config_entries, "async_reload", AsyncMock(return_value=True)) as reload:
        await _check(hass)
    reload.assert_awaited_once_with(dead.entry_id)
    assert [i["domain"] for i in hass.states.get(UNAVAILABLE).attributes["integrations"]] == ["dead"]


async def test_notifications(hass: HomeAssistant, freezer: FrozenDateTimeFactory):
    dead = add_integration(hass, "dead", [STATE_UNAVAILABLE])
    calls = async_mock_service(hass, "notify", "mobile_app_phone")
    await _setup(hass, **{CONF_NOTIFY: ["notify.mobile_app_phone", "notify.missing"]})
    freezer.tick(timedelta(minutes=15))
    with patch.object(hass.config_entries, "async_reload", AsyncMock(return_value=True)):
        await _check(hass)
    notification = persistent_notification._async_get_or_create_notifications(hass)[
        f"{DOMAIN}_watchdog_{dead.entry_id}"
    ]
    assert notification["title"] == "Integration reloaded"
    assert notification["message"].startswith("Dead (dead) was reloaded")
    assert "Reload 1/3" in notification["message"]
    assert len(calls) == 1
    assert calls[0].data == {"title": "Integration reloaded", "message": notification["message"]}


async def test_failed_reload_notification(hass: HomeAssistant, freezer: FrozenDateTimeFactory):
    dead = add_integration(hass, "dead", [STATE_UNAVAILABLE])
    await _setup(hass)
    freezer.tick(timedelta(minutes=15))
    with patch.object(hass.config_entries, "async_reload", AsyncMock(return_value=False)):
        await _check(hass)
    notification = persistent_notification._async_get_or_create_notifications(hass)[
        f"{DOMAIN}_watchdog_{dead.entry_id}"
    ]
    assert notification["title"] == "Integration reload failed"


async def test_options_change_keeps_the_grace_from_the_states(hass: HomeAssistant, freezer: FrozenDateTimeFactory):
    """Changing the options reloads the watchdog: an integration already down long enough is reloaded right away."""
    dead = add_integration(hass, "dead", [STATE_UNAVAILABLE])
    entry = await _setup(hass)
    freezer.tick(timedelta(minutes=10))
    real_reload = hass.config_entries.async_reload

    async def reload_side_effect(entry_id):
        return True if entry_id == dead.entry_id else await real_reload(entry_id)

    with patch.object(hass.config_entries, "async_reload", AsyncMock(side_effect=reload_side_effect)) as reload:
        result = await _settings_flow(hass, entry)
        await hass.config_entries.options.async_configure(
            result["flow_id"],
            {CONF_SCAN_INTERVAL: 5, CONF_GRACE_PERIOD: 1, CONF_MAX_RELOADS: 3, CONF_IGNORED: []},
        )
        await hass.async_block_till_done()
    # The watchdog's first check after its own reload reloads the integration right away.
    reload.assert_any_await(dead.entry_id)


async def test_setup_retry_and_error_are_watched(hass: HomeAssistant, freezer: FrozenDateTimeFactory):
    retry = add_integration(hass, "retry", [STATE_UNAVAILABLE], state=ConfigEntryState.SETUP_RETRY)
    error = add_integration(hass, "error", [STATE_UNAVAILABLE], state=ConfigEntryState.SETUP_ERROR)
    await _setup(hass)
    assert {i["domain"] for i in hass.states.get(UNAVAILABLE).attributes["integrations"]} == {
        "retry",
        "error",
    }
    freezer.tick(timedelta(minutes=15))
    with patch.object(hass.config_entries, "async_reload", AsyncMock(return_value=True)) as reload:
        await _check(hass)
    assert {c.args[0] for c in reload.await_args_list} == {retry.entry_id, error.entry_id}


async def _change_options(hass: HomeAssistant, entry: MockConfigEntry, block: bool = True, **options) -> None:
    result = await _settings_flow(hass, entry)
    await hass.config_entries.options.async_configure(
        result["flow_id"],
        {k: v for k, v in {**OPTIONS, **options}.items() if k != CONF_NOTIFY},
    )
    if block:
        await hass.async_block_till_done()


async def test_options_change_keeps_the_count(hass: HomeAssistant, freezer: FrozenDateTimeFactory):
    """An integration given up stays so when the watchdog's own entry is reloaded."""
    dead = add_integration(hass, "dead", [STATE_UNAVAILABLE])
    entry = await _setup(hass, **{CONF_MAX_RELOADS: 1})
    freezer.tick(timedelta(minutes=15))
    real_reload = hass.config_entries.async_reload

    async def reload_side_effect(entry_id):
        return True if entry_id == dead.entry_id else await real_reload(entry_id)

    with patch.object(hass.config_entries, "async_reload", AsyncMock(side_effect=reload_side_effect)) as reload:
        await _check(hass)
        freezer.tick(timedelta(minutes=16))
        await _check(hass)
        assert hass.states.get(UNAVAILABLE).attributes["integrations"][0]["gave_up"] is True
        await _change_options(hass, entry, **{CONF_MAX_RELOADS: 1, CONF_SCAN_INTERVAL: 10})
        freezer.tick(timedelta(minutes=16))
        await _check(hass)
        assert [c.args[0] for c in reload.await_args_list].count(dead.entry_id) == 1
        item = hass.states.get(UNAVAILABLE).attributes["integrations"][0]
        assert item["reloads"] == 1
        assert item["gave_up"] is True
        # A higher limit reloads it again.
        await _change_options(hass, entry, **{CONF_MAX_RELOADS: 2})
        await _check(hass)
        assert [c.args[0] for c in reload.await_args_list].count(dead.entry_id) == 2
        assert hass.states.get(UNAVAILABLE).attributes["integrations"][0]["gave_up"] is False


async def test_check_action_waits_for_a_running_check(hass: HomeAssistant, freezer: FrozenDateTimeFactory):
    """The action runs its own check once the running one has ended, instead of returning at once."""
    add_integration(hass, "dead", [STATE_UNAVAILABLE])
    entry = await _setup(hass)
    watchdog = entry.runtime_data.watchdog
    freezer.tick(timedelta(minutes=15))
    release = asyncio.Event()

    async def slow_reload(_entry_id):
        await release.wait()
        return True

    checks = []
    real_load = watchdog._async_load_helpers

    async def counted_load():
        checks.append(1)
        await real_load()

    with (
        patch.object(hass.config_entries, "async_reload", AsyncMock(side_effect=slow_reload)),
        patch.object(watchdog, "_async_load_helpers", counted_load),
    ):
        running = hass.async_create_task(watchdog.async_check())
        for _ in range(10):
            await asyncio.sleep(0)
        assert watchdog.running
        action = hass.async_create_task(hass.services.async_call(DOMAIN, "watchdog_check", {}, blocking=True))
        for _ in range(10):
            await asyncio.sleep(0)
        assert not action.done()
        release.set()
        async with asyncio.timeout(5):
            await running
            await action
    # Two checks: the running one, then the action's own.
    assert len(checks) == 2


async def test_no_double_reload_while_the_watchdog_reloads(hass: HomeAssistant, freezer: FrozenDateTimeFactory):
    """Options saved during a check: the new instance waits for it, the integration is reloaded once."""
    dead = add_integration(hass, "dead", [STATE_UNAVAILABLE])
    entry = await _setup(hass)
    old = entry.runtime_data.watchdog
    freezer.tick(timedelta(minutes=15))
    release = asyncio.Event()
    real_reload = hass.config_entries.async_reload

    async def reload_side_effect(entry_id):
        if entry_id != dead.entry_id:
            return await real_reload(entry_id)
        await release.wait()
        return True

    with patch.object(hass.config_entries, "async_reload", AsyncMock(side_effect=reload_side_effect)) as reload:
        running = hass.async_create_task(old.async_check())
        for _ in range(10):
            await asyncio.sleep(0)
        assert old.running
        await _change_options(hass, entry, block=False, **{CONF_SCAN_INTERVAL: 10})
        for _ in range(50):
            await asyncio.sleep(0)
        assert entry.runtime_data.watchdog is not old
        # The new instance's first check is waiting for the old one.
        assert entry.runtime_data.watchdog.running
        release.set()
        async with asyncio.timeout(5):
            await running
        await hass.async_block_till_done()
        assert [c.args[0] for c in reload.await_args_list].count(dead.entry_id) == 1


async def test_setup_stuck_past_the_timeout_keeps_the_count(hass: HomeAssistant, freezer: FrozenDateTimeFactory):
    """A reload whose setup stays in progress past its timeout is not taken for a recovery: max_reloads holds."""
    dead = add_integration(hass, "dead", [STATE_UNAVAILABLE])
    await _setup(hass)  # grace 15 min, 3 reloads
    freezer.tick(timedelta(minutes=15))
    stuck_until = {}

    async def reload_side_effect(entry_id):
        # The reload timed out: the setup goes on in the background for 25 minutes, then fails.
        dead.mock_state(hass, ConfigEntryState.SETUP_IN_PROGRESS)
        stuck_until[entry_id] = 0
        return False

    with patch.object(hass.config_entries, "async_reload", AsyncMock(side_effect=reload_side_effect)) as reload:
        for _ in range(12 * 6):  # 6 hours, a check every 5 minutes
            if dead.entry_id in stuck_until:
                stuck_until[dead.entry_id] += 5
                if stuck_until[dead.entry_id] > 25:
                    del stuck_until[dead.entry_id]
                    dead.mock_state(hass, ConfigEntryState.SETUP_RETRY)
            await _check(hass)
            freezer.tick(timedelta(minutes=5))
    assert reload.await_count == 3
    item = hass.states.get(UNAVAILABLE).attributes["integrations"][0]
    assert item["reloads"] == 3
    assert item["gave_up"] is True


async def test_entry_without_available_entity_keeps_the_count(hass: HomeAssistant, freezer: FrozenDateTimeFactory):
    """Out of the list without any available entity (all disabled, no state left) is not a recovery."""
    dead = add_integration(hass, "dead", [STATE_UNAVAILABLE])
    entity_id = "sensor.dead_0"
    await _setup(hass, **{CONF_MAX_RELOADS: 1})
    freezer.tick(timedelta(minutes=15))
    watchdog = hass.config_entries.async_entries(DOMAIN)[0].runtime_data.watchdog
    with patch.object(hass.config_entries, "async_reload", AsyncMock(return_value=True)) as reload:
        await _check(hass)
        assert reload.await_count == 1
        hass.states.async_remove(entity_id)
        for _ in range(12):
            freezer.tick(timedelta(minutes=5))
            await _check(hass)
        assert watchdog.attempts.get(dead.entry_id) is not None
        assert watchdog.attempts[dead.entry_id].count == 1
        hass.states.async_set(entity_id, STATE_UNAVAILABLE)
        for _ in range(12):
            freezer.tick(timedelta(minutes=5))
            await _check(hass)
        assert reload.await_count == 1
        assert hass.states.get(UNAVAILABLE).attributes["integrations"][0]["gave_up"] is True


async def test_removed_entry_is_forgotten(hass: HomeAssistant, freezer: FrozenDateTimeFactory):
    dead = add_integration(hass, "dead", [STATE_UNAVAILABLE])
    await _setup(hass)
    freezer.tick(timedelta(minutes=15))
    watchdog = hass.config_entries.async_entries(DOMAIN)[0].runtime_data.watchdog
    with patch.object(hass.config_entries, "async_reload", AsyncMock(return_value=True)):
        await _check(hass)
    assert dead.entry_id in watchdog.attempts
    await hass.config_entries.async_remove(dead.entry_id)
    await _check(hass)
    assert dead.entry_id not in watchdog.attempts


async def test_check_action_not_loaded_is_translated(hass: HomeAssistant):
    entry = await _setup(hass)
    assert await hass.config_entries.async_unload(entry.entry_id)
    with pytest.raises(ServiceValidationError) as err:
        await hass.services.async_call(DOMAIN, "watchdog_check", {}, blocking=True)
    assert err.value.translation_key == "not_loaded"
    assert err.value.translation_domain == DOMAIN


async def test_remove_entry_waits_for_a_running_check(hass: HomeAssistant, freezer: FrozenDateTimeFactory):
    """Removing the watchdog doesn't drop the shared lock while a check still holds it."""
    add_integration(hass, "dead", [STATE_UNAVAILABLE])
    entry = await _setup(hass)
    freezer.tick(timedelta(minutes=15))
    lock = hass.data[DOMAIN]["watchdog"]["lock"]
    release = asyncio.Event()

    async def slow(_entry_id):
        await release.wait()
        return True

    with patch.object(hass.config_entries, "async_reload", AsyncMock(side_effect=slow)):
        check = hass.async_create_task(entry.runtime_data.watchdog.async_check(wait=True))
        for _ in range(20):
            await asyncio.sleep(0)
        assert lock.locked()
        remove = hass.async_create_task(hass.config_entries.async_remove(entry.entry_id))
        for _ in range(20):
            await asyncio.sleep(0)
        still_there = DOMAIN in hass.data
        release.set()
        await check
        await remove
    assert still_there
    assert "watchdog" not in hass.data.get(DOMAIN, {})


async def test_added_back_during_removal_keeps_the_shared_state(hass: HomeAssistant, freezer: FrozenDateTimeFactory):
    """Added back while the removal waits for a running check: the shared lock stays registered."""
    add_integration(hass, "dead", [STATE_UNAVAILABLE])
    entry = await _setup(hass)
    freezer.tick(timedelta(minutes=15))
    shared = hass.data[DOMAIN]["watchdog"]
    release = asyncio.Event()

    async def slow(_entry_id):
        await release.wait()
        return True

    with patch.object(hass.config_entries, "async_reload", AsyncMock(side_effect=slow)):
        check = hass.async_create_task(entry.runtime_data.watchdog.async_check(wait=True))
        for _ in range(20):
            await asyncio.sleep(0)
        remove = hass.async_create_task(hass.config_entries.async_remove(entry.entry_id))
        for _ in range(20):
            await asyncio.sleep(0)
        # The removal is waiting for the check: the integration is added back meanwhile.
        new = MockConfigEntry(domain=DOMAIN, unique_id=DOMAIN, options={"modules": ["watchdog"], "watchdog": OPTIONS})
        new.add_to_hass(hass)
        setup = hass.async_create_task(hass.config_entries.async_setup(new.entry_id))
        for _ in range(20):
            await asyncio.sleep(0)
        release.set()
        async with asyncio.timeout(5):
            await check
            await remove
            assert await setup
        await hass.async_block_till_done()
    # The new instance's shared state is still the one registered: a later options reload reuses its lock.
    assert hass.data[DOMAIN]["watchdog"] is shared
    assert new.runtime_data.watchdog._lock is shared["lock"]


async def test_scheduled_check_queued_behind_a_waiting_one_is_skipped(hass: HomeAssistant):
    """A scheduled check that saw the lock free but queued behind a waiting one is skipped, not run again."""
    entry = await _setup(hass)
    watchdog = entry.runtime_data.watchdog
    lock = hass.data[DOMAIN]["watchdog"]["lock"]
    checks = []
    real_load = watchdog._async_load_helpers

    async def counted_load():
        checks.append(1)
        await real_load()

    with patch.object(watchdog, "_async_load_helpers", counted_load):
        await lock.acquire()  # A check is running.
        waiting = hass.async_create_task(watchdog.async_check(wait=True))
        for _ in range(5):
            await asyncio.sleep(0)
        # The running check ends; the scheduled one starts (eagerly) before the waiting one resumes:
        # it sees the lock free, queues behind the waiting one, and must then be skipped, not run again.
        lock.release()
        scheduled = hass.async_create_task(watchdog.async_check())
        async with asyncio.timeout(5):
            await waiting
            await scheduled
    assert len(checks) == 1


async def test_disabled_entry_starts_over(hass: HomeAssistant, freezer: FrozenDateTimeFactory):
    """Disabled by the user after a give-up, then enabled again still down: it is reloaded again."""
    dead = add_integration(hass, "dead", [STATE_UNAVAILABLE])
    entity_id = "sensor.dead_0"
    await _setup(hass, **{CONF_MAX_RELOADS: 1})
    freezer.tick(timedelta(minutes=15))
    watchdog = hass.config_entries.async_entries(DOMAIN)[0].runtime_data.watchdog
    with patch.object(hass.config_entries, "async_reload", AsyncMock(return_value=True)) as reload:
        for _ in range(12):
            await _check(hass)
            freezer.tick(timedelta(minutes=5))
        assert reload.await_count == 1
        assert hass.states.get(UNAVAILABLE).attributes["integrations"][0]["gave_up"] is True
        # Disabled for a day (the reload done by Home Assistant itself is mocked: set its result).
        assert await hass.config_entries.async_set_disabled_by(dead.entry_id, ConfigEntryDisabler.USER)
        await hass.async_block_till_done()
        dead.mock_state(hass, ConfigEntryState.NOT_LOADED)
        for _ in range(24):
            freezer.tick(timedelta(hours=1))
            await _check(hass)
        assert dead.entry_id not in watchdog.attempts
        # Enabled again, still down.
        assert await hass.config_entries.async_set_disabled_by(dead.entry_id, None)
        await hass.async_block_till_done()
        dead.mock_state(hass, ConfigEntryState.SETUP_RETRY)
        hass.states.async_set(entity_id, STATE_UNAVAILABLE)
        reload.reset_mock()
        for _ in range(12):
            freezer.tick(timedelta(minutes=5))
            await _check(hass)
        # Reloaded again, then given up again after max_reloads.
        reload.assert_awaited_once_with(dead.entry_id)
        assert hass.states.get(UNAVAILABLE).attributes["integrations"][0]["gave_up"] is True


async def test_disabled_entry_starts_over_without_a_check_in_between(
    hass: HomeAssistant, freezer: FrozenDateTimeFactory
):
    """Disabled then enabled again within seconds (no check meanwhile), still down: it is reloaded again."""
    dead = add_integration(hass, "dead", [STATE_UNAVAILABLE])
    await _setup(hass, **{CONF_MAX_RELOADS: 1})
    freezer.tick(timedelta(minutes=15))
    watchdog = hass.config_entries.async_entries(DOMAIN)[0].runtime_data.watchdog
    with patch.object(hass.config_entries, "async_reload", AsyncMock(return_value=True)) as reload:
        for _ in range(12):
            await _check(hass)
            freezer.tick(timedelta(minutes=5))
        assert reload.await_count == 1
        assert watchdog.attempts[dead.entry_id].gave_up is True
        # Disabled and enabled again right away: no check runs in between.
        assert await hass.config_entries.async_set_disabled_by(dead.entry_id, ConfigEntryDisabler.USER)
        await hass.async_block_till_done()
        dead.mock_state(hass, ConfigEntryState.NOT_LOADED)
        freezer.tick(timedelta(seconds=30))
        assert await hass.config_entries.async_set_disabled_by(dead.entry_id, None)
        await hass.async_block_till_done()
        dead.mock_state(hass, ConfigEntryState.SETUP_RETRY)
        hass.states.async_set("sensor.dead_0", STATE_UNAVAILABLE)
        reload.reset_mock()
        for _ in range(12):
            freezer.tick(timedelta(minutes=5))
            await _check(hass)
        reload.assert_awaited_once_with(dead.entry_id)


async def test_removed_watchdog_stops_its_running_check(hass: HomeAssistant, freezer: FrozenDateTimeFactory):
    """A check still running when the watchdog is removed reloads nothing more."""
    add_integration(hass, "dead", [STATE_UNAVAILABLE])
    add_integration(hass, "down", [STATE_UNAVAILABLE])
    entry = await _setup(hass)
    freezer.tick(timedelta(minutes=15))
    release = asyncio.Event()

    async def slow(_entry_id):
        await release.wait()
        return True

    with patch.object(hass.config_entries, "async_reload", AsyncMock(side_effect=slow)) as reload:
        check = hass.async_create_task(entry.runtime_data.watchdog.async_check(wait=True))
        for _ in range(20):
            await asyncio.sleep(0)
        assert reload.await_count == 1
        remove = hass.async_create_task(hass.config_entries.async_remove(entry.entry_id))
        for _ in range(20):
            await asyncio.sleep(0)
        release.set()
        await check
        await remove
        assert reload.await_count == 1
    assert "watchdog" not in hass.data.get(DOMAIN, {})


async def test_options_change_keeps_the_last_reload(hass: HomeAssistant, freezer: FrozenDateTimeFactory):
    """The last reload sensor and its reload total survive a reload of the watchdog's own entry."""
    dead = add_integration(hass, "dead", [STATE_UNAVAILABLE])
    entry = await _setup(hass)
    freezer.tick(timedelta(minutes=15))
    real_reload = hass.config_entries.async_reload

    async def reload_side_effect(entry_id):
        return True if entry_id == dead.entry_id else await real_reload(entry_id)

    with patch.object(hass.config_entries, "async_reload", AsyncMock(side_effect=reload_side_effect)):
        await _check(hass)
        before = hass.states.get(LAST_RELOAD)
        assert before.attributes["reloads"] == 1
        await _change_options(hass, entry, **{CONF_SCAN_INTERVAL: 10})
    after = hass.states.get(LAST_RELOAD)
    assert after.state == before.state
    assert after.attributes["reloads"] == 1
    assert after.attributes["entry_id"] == dead.entry_id


async def test_error_on_one_integration_does_not_stop_the_check(
    hass: HomeAssistant, freezer: FrozenDateTimeFactory, caplog: pytest.LogCaptureFixture
):
    """An unexpected error on one integration is logged, the others are still reloaded and the entities updated."""
    first = add_integration(hass, "first", [STATE_UNAVAILABLE])
    second = add_integration(hass, "second", [STATE_UNAVAILABLE])
    entry = await _setup(hass)
    watchdog = entry.runtime_data.watchdog
    freezer.tick(timedelta(minutes=15))
    real_send = watchdog._async_send

    async def broken_send(key, item, attempt):
        if item.entry_id == first.entry_id:
            raise RuntimeError("boom")
        await real_send(key, item, attempt)

    with (
        patch.object(hass.config_entries, "async_reload", AsyncMock(return_value=True)) as reload,
        patch.object(watchdog, "_async_send", broken_send),
    ):
        await _check(hass)
    assert {c.args[0] for c in reload.await_args_list} == {first.entry_id, second.entry_id}
    assert "Handling First (first) failed" in caplog.text
    assert hass.states.get(LAST_CHECK).state not in ("unknown", "unavailable")
    assert hass.states.get(BUTTON).state != "unavailable"


async def test_error_during_the_check_still_updates_the_entities(hass: HomeAssistant, freezer: FrozenDateTimeFactory):
    """A check that fails outright still records its end and frees the button."""
    entry = await _setup(hass)
    watchdog = entry.runtime_data.watchdog
    before = watchdog.last_check
    state_before = hass.states.get(LAST_CHECK).state
    freezer.tick(timedelta(minutes=1))
    with (
        patch.object(watchdog, "_async_load_helpers", AsyncMock(side_effect=RuntimeError("boom"))),
        pytest.raises(RuntimeError),
    ):
        await watchdog.async_check(wait=True)
    await hass.async_block_till_done()
    assert watchdog.last_check is not None and watchdog.last_check != before
    assert hass.states.get(LAST_CHECK).state != state_before
    assert hass.states.get(BUTTON).state != "unavailable"


async def test_give_up_after_lowering_the_limit_tells_the_real_count(
    hass: HomeAssistant, freezer: FrozenDateTimeFactory
):
    """Given up after the limit was lowered: the notification gives the reloads done, not the new limit."""
    dead = add_integration(hass, "dead", [STATE_UNAVAILABLE])
    entry = await _setup(hass)  # grace 15 min, 3 reloads
    freezer.tick(timedelta(minutes=15))
    real_reload = hass.config_entries.async_reload

    async def reload_side_effect(entry_id):
        return True if entry_id == dead.entry_id else await real_reload(entry_id)

    with patch.object(hass.config_entries, "async_reload", AsyncMock(side_effect=reload_side_effect)):
        await _check(hass)
        freezer.tick(timedelta(minutes=15))
        await _check(hass)
        assert hass.states.get(UNAVAILABLE).attributes["integrations"][0]["reloads"] == 2
        await _change_options(hass, entry, **{CONF_MAX_RELOADS: 1})
        freezer.tick(timedelta(minutes=30))
        await _check(hass)
    assert hass.states.get(UNAVAILABLE).attributes["integrations"][0]["gave_up"] is True
    notification = persistent_notification._async_get_or_create_notifications(hass)[
        f"{DOMAIN}_watchdog_{dead.entry_id}"
    ]
    assert "still unavailable after 2 reloads" in notification["message"]


async def test_history_of_reloads_and_give_up(hass: HomeAssistant, freezer: FrozenDateTimeFactory, hass_storage: dict):
    """Each reload, failed reload and give-up is listed for the card, newest first, and saved."""
    dead = add_integration(hass, "dead", [STATE_UNAVAILABLE])
    await _setup(hass, **{CONF_MAX_RELOADS: 2})
    freezer.tick(timedelta(minutes=15))
    with patch.object(hass.config_entries, "async_reload", AsyncMock(side_effect=[True, False])):
        await _check(hass)  # reload 1/2
        freezer.tick(timedelta(minutes=15))
        await _check(hass)  # reload 2/2, fails
        freezer.tick(timedelta(minutes=30))
        changes = async_capture_events(hass, EVENT_STATE_CHANGED)
        await _check(hass)  # given up
    # The give-up changes neither the state nor `reloads`: it must still be written, as the card shows it.
    assert [e.data["entity_id"] for e in changes].count(LAST_RELOAD) == 1
    # What the frontend receives (the JSON of the state), not the list held in memory.
    sent = json.loads(hass.states.get(LAST_RELOAD).as_dict_json)["attributes"]["history"]
    assert [h["kind"] for h in sent] == ["gave_up", "reload_failed", "reloaded"]
    history = hass.states.get(LAST_RELOAD).attributes["history"]
    assert [h["kind"] for h in history] == ["gave_up", "reload_failed", "reloaded"]
    assert [h["attempt"] for h in history] == [2, 2, 1]
    assert all(h["entry_id"] == dead.entry_id and h["domain"] == "dead" and h["title"] == "Dead" for h in history)
    assert all(h["max_reloads"] == 2 for h in history)
    assert hass.states.get(UNAVAILABLE).attributes["max_reloads"] == 2
    # Written a little later, once for the whole check.
    freezer.tick(timedelta(seconds=watchdog_module.HISTORY_SAVE_DELAY + 1))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    assert [h["kind"] for h in hass_storage[STORAGE_KEY]["data"]["history"]] == ["gave_up", "reload_failed", "reloaded"]


async def test_history_is_capped(hass: HomeAssistant, freezer: FrozenDateTimeFactory):
    """Only the most recent HISTORY_SIZE items are kept."""
    entry = await _setup(hass)
    watchdog = entry.runtime_data.watchdog
    item = watchdog_module.UnavailableIntegration("id", "dead", "Dead", freezer())
    for n in range(HISTORY_SIZE + 5):
        watchdog._record("reloaded", item, n, freezer())
    assert len(watchdog.history) == HISTORY_SIZE
    assert watchdog.history[0]["attempt"] == HISTORY_SIZE + 4


async def test_give_up_with_full_history_reaches_the_card(hass: HomeAssistant, freezer: FrozenDateTimeFactory):
    """With the history full (same length) and the same state, a give-up is still sent to the frontend."""
    entry = await _setup(hass)
    watchdog = entry.runtime_data.watchdog
    item = watchdog_module.UnavailableIntegration("id", "dead", "Dead", freezer())
    for n in range(HISTORY_SIZE):
        watchdog._record("reloaded", item, n, freezer())
    watchdog._notify_listeners()
    await hass.async_block_till_done()
    changes = async_capture_events(hass, EVENT_STATE_CHANGED)
    watchdog._record("gave_up", item, HISTORY_SIZE, freezer())
    watchdog._notify_listeners()
    await hass.async_block_till_done()
    assert [e.data["entity_id"] for e in changes].count(LAST_RELOAD) == 1
    sent = json.loads(hass.states.get(LAST_RELOAD).as_dict_json)["attributes"]["history"]
    assert len(sent) == HISTORY_SIZE
    assert sent[0]["kind"] == "gave_up"


async def test_history_restored_after_restart(hass: HomeAssistant, hass_storage: dict):
    """The history saved by a previous run is loaded; malformed items are skipped."""
    saved = {
        "kind": "reloaded",
        "at": "2026-10-30T08:00:00+00:00",
        "entry_id": "abc",
        "domain": "zha",
        "title": "Zigbee",
        "attempt": 1,
        "max_reloads": 3,
        "unavailable_since": "2026-10-30T07:40:00+00:00",
    }
    hass_storage[STORAGE_KEY] = {
        "version": 1,
        "key": STORAGE_KEY,
        "data": {"history": [saved, {"kind": "exploded"}, {**saved, "at": "not a date"}, "junk"]},
    }
    await _setup(hass)
    assert hass.states.get(LAST_RELOAD).attributes["history"] == [saved]
    assert json.loads(hass.states.get(LAST_RELOAD).as_dict_json)["attributes"]["history"] == [saved]


async def test_history_kept_across_options_change(hass: HomeAssistant, freezer: FrozenDateTimeFactory):
    """Changing the options reloads the watchdog: the history it already had stays."""
    add_integration(hass, "dead", [STATE_UNAVAILABLE])
    entry = await _setup(hass)
    freezer.tick(timedelta(minutes=15))
    with patch.object(hass.config_entries, "async_reload", AsyncMock(return_value=True)):
        await _check(hass)
    hass.config_entries.async_update_entry(
        entry, options={**entry.options, "watchdog": {**OPTIONS, CONF_SCAN_INTERVAL: 10}}
    )
    await hass.async_block_till_done()
    assert [h["kind"] for h in hass.states.get(LAST_RELOAD).attributes["history"]] == ["reloaded"]


async def test_history_corrupt_file(hass: HomeAssistant, hass_storage: dict):
    """A history file that is not what the watchdog wrote starts an empty history."""
    hass_storage[STORAGE_KEY] = {"version": 1, "key": STORAGE_KEY, "data": ["not", "a", "dict"]}
    await _setup(hass)
    assert hass.states.get(LAST_RELOAD).attributes["history"] == []


async def test_remove_drops_the_history(hass: HomeAssistant, freezer: FrozenDateTimeFactory, hass_storage: dict):
    """Removing the integration deletes the saved history, through the store holding a save still pending."""
    hass_storage[STORAGE_KEY] = {"version": 1, "key": STORAGE_KEY, "data": {"history": []}}
    add_integration(hass, "dead", [STATE_UNAVAILABLE])
    entry = await _setup(hass)
    store = hass.data[DOMAIN]["watchdog"]["store"]
    freezer.tick(timedelta(minutes=15))
    with patch.object(hass.config_entries, "async_reload", AsyncMock(return_value=True)):
        await _check(hass)
    # Real Store.async_remove also cancels the pending delayed save; the test storage mock only drops the data.
    with patch.object(store, "async_remove", wraps=store.async_remove) as remove:
        assert await hass.config_entries.async_remove(entry.entry_id)
        await hass.async_block_till_done()
    remove.assert_awaited_once()
    assert STORAGE_KEY not in hass_storage


async def test_ignored_single_entry(hass: HomeAssistant, freezer: FrozenDateTimeFactory):
    """An ignored entry is never reloaded; another entry of the same integration still is."""
    from custom_components.system_hub.watchdog.const import CONF_IGNORED_ENTRIES

    ignored = add_integration(hass, "tapo", [STATE_UNAVAILABLE])
    watched = MockConfigEntry(domain="tapo", title="Living room camera")
    watched.add_to_hass(hass)
    watched.mock_state(hass, ConfigEntryState.LOADED)
    entity = er.async_get(hass).async_get_or_create("sensor", "tapo", "living", config_entry=watched)
    hass.states.async_set(entity.entity_id, STATE_UNAVAILABLE)
    await _setup(hass, **{CONF_IGNORED_ENTRIES: [ignored.entry_id]})
    freezer.tick(timedelta(hours=1))
    with patch.object(hass.config_entries, "async_reload", AsyncMock(return_value=True)) as reload:
        await _check(hass)
    reload.assert_awaited_once_with(watched.entry_id)


async def test_reloads_in_24_hours(hass: HomeAssistant, freezer: FrozenDateTimeFactory):
    entry = await _setup(hass)
    watchdog = entry.runtime_data.watchdog
    now = dt_util.utcnow()
    watchdog.history[:] = [
        {"kind": "reloaded", "at": (now - timedelta(hours=1)).isoformat(), "title": "Zigbee", "domain": "zha"},
        {"kind": "reload_failed", "at": (now - timedelta(hours=3)).isoformat(), "title": "Zigbee", "domain": "zha"},
        {"kind": "gave_up", "at": (now - timedelta(hours=3)).isoformat(), "title": "Zigbee", "domain": "zha"},
        {"kind": "reloaded", "at": (now - timedelta(hours=5)).isoformat(), "title": "Tapo", "domain": "tapo"},
        {"kind": "reloaded", "at": (now - timedelta(hours=30)).isoformat(), "title": "Tapo", "domain": "tapo"},
    ]
    watchdog._notify_listeners()  # noqa: SLF001
    await hass.async_block_till_done()
    state = next(s for s in hass.states.async_all("sensor") if s.entity_id.endswith("_24_h"))
    assert state.state == "3"
    assert state.attributes["failed"] == 1
    assert state.attributes["integrations"] == {"Zigbee": 2, "Tapo": 1}


async def _give_up(hass: HomeAssistant, freezer: FrozenDateTimeFactory) -> MockConfigEntry:
    """An unavailable integration, reloaded once and then given up (max_reloads 1, grace 15 min)."""
    dead = add_integration(hass, "dead", [STATE_UNAVAILABLE])
    await _setup(hass, **{CONF_MAX_RELOADS: 1})
    freezer.tick(timedelta(minutes=15))
    with patch.object(hass.config_entries, "async_reload", AsyncMock(return_value=True)):
        await _check(hass)
        assert ir.async_get(hass).async_get_issue(DOMAIN, f"watchdog_gave_up_{dead.entry_id}") is None
        freezer.tick(timedelta(minutes=15))
        await _check(hass)
    return dead


async def test_give_up_raises_a_repairs_issue(hass: HomeAssistant, freezer: FrozenDateTimeFactory):
    dead = await _give_up(hass, freezer)
    issue = ir.async_get(hass).async_get_issue(DOMAIN, f"watchdog_gave_up_{dead.entry_id}")
    assert issue is not None
    assert issue.translation_key == "watchdog_gave_up"
    assert issue.severity == ir.IssueSeverity.WARNING
    assert issue.is_fixable
    assert issue.data == {"entry_id": dead.entry_id}
    assert not issue.is_persistent
    assert issue.translation_placeholders == {"title": "Dead", "domain": "dead", "attempt": "1"}


async def test_repairs_issue_deleted_once_recovered(hass: HomeAssistant, freezer: FrozenDateTimeFactory):
    dead = await _give_up(hass, freezer)
    registry = ir.async_get(hass)
    issue_id = f"watchdog_gave_up_{dead.entry_id}"
    # Back for a moment: still given up, the issue stays.
    hass.states.async_set("sensor.dead_0", "1")
    await _check(hass)
    assert registry.async_get_issue(DOMAIN, issue_id) is not None
    # Available for its delay: recovered, the issue goes.
    freezer.tick(timedelta(minutes=15))
    await _check(hass)
    assert registry.async_get_issue(DOMAIN, issue_id) is None


async def test_repairs_issue_deleted_when_disabled_or_removed(hass: HomeAssistant, freezer: FrozenDateTimeFactory):
    dead = await _give_up(hass, freezer)
    registry = ir.async_get(hass)
    issue_id = f"watchdog_gave_up_{dead.entry_id}"
    # Disabled (the reload done by Home Assistant itself is mocked: set its result), no check in between.
    with patch.object(hass.config_entries, "async_reload", AsyncMock(return_value=True)):
        assert await hass.config_entries.async_set_disabled_by(dead.entry_id, ConfigEntryDisabler.USER)
    await hass.async_block_till_done()
    dead.mock_state(hass, ConfigEntryState.NOT_LOADED)
    assert registry.async_get_issue(DOMAIN, issue_id) is None

    other = add_integration(hass, "other", [STATE_UNAVAILABLE])
    watchdog = hass.config_entries.async_entries(DOMAIN)[0].runtime_data.watchdog
    with patch.object(hass.config_entries, "async_reload", AsyncMock(return_value=True)):
        for _ in range(7):
            freezer.tick(timedelta(minutes=5))
            await _check(hass)
    assert watchdog.attempts[other.entry_id].gave_up is True
    assert registry.async_get_issue(DOMAIN, f"watchdog_gave_up_{other.entry_id}") is not None
    await hass.config_entries.async_remove(other.entry_id)
    await _check(hass)
    assert registry.async_get_issue(DOMAIN, f"watchdog_gave_up_{other.entry_id}") is None


async def test_repairs_issue_deleted_when_the_limit_is_raised(hass: HomeAssistant, freezer: FrozenDateTimeFactory):
    dead = await _give_up(hass, freezer)
    entry = hass.config_entries.async_entries(DOMAIN)[0]
    hass.config_entries.async_update_entry(
        entry, options={**entry.options, "watchdog": {**entry.options["watchdog"], CONF_MAX_RELOADS: 3}}
    )
    await hass.async_block_till_done()
    with patch.object(hass.config_entries, "async_reload", AsyncMock(return_value=True)):
        await _check(hass)
    assert ir.async_get(hass).async_get_issue(DOMAIN, f"watchdog_gave_up_{dead.entry_id}") is None


async def test_repairs_issues_deleted_with_the_watchdog(hass: HomeAssistant, freezer: FrozenDateTimeFactory):
    dead = await _give_up(hass, freezer)
    entry = hass.config_entries.async_entries(DOMAIN)[0]
    await hass.config_entries.async_remove(entry.entry_id)
    await hass.async_block_till_done()
    assert ir.async_get(hass).async_get_issue(DOMAIN, f"watchdog_gave_up_{dead.entry_id}") is None


async def _flush_store(hass: HomeAssistant, freezer: FrozenDateTimeFactory) -> None:
    freezer.tick(timedelta(seconds=watchdog_module.HISTORY_SAVE_DELAY + 1))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()


async def test_attempts_saved(hass: HomeAssistant, freezer: FrozenDateTimeFactory, hass_storage: dict):
    """The reload counts are written with the history, so that a restart keeps them."""
    dead = await _give_up(hass, freezer)
    await _flush_store(hass, freezer)
    saved = hass_storage[STORAGE_KEY]["data"]["attempts"]
    assert list(saved) == [dead.entry_id]
    assert saved[dead.entry_id]["count"] == 1
    assert saved[dead.entry_id]["gave_up"] is True
    assert dt_util.parse_datetime(saved[dead.entry_id]["last"]) is not None
    # Recovered: forgotten, in the file too.
    hass.states.async_set("sensor.dead_0", "1")
    await _check(hass)
    freezer.tick(timedelta(minutes=15))
    await _check(hass)
    await _flush_store(hass, freezer)
    assert hass_storage[STORAGE_KEY]["data"]["attempts"] == {}


async def test_attempts_restored_after_restart(hass: HomeAssistant, freezer: FrozenDateTimeFactory, hass_storage: dict):
    """Counts saved by a previous run come back; removed entries and malformed items are dropped."""
    dead = add_integration(hass, "dead", [STATE_UNAVAILABLE])
    flaky = add_integration(hass, "flaky", [STATE_UNAVAILABLE])
    last = (dt_util.utcnow() - timedelta(hours=1)).isoformat()
    hass_storage[STORAGE_KEY] = {
        "version": 1,
        "key": STORAGE_KEY,
        "data": {
            "history": [],
            "attempts": {
                dead.entry_id: {"count": 3, "last": last, "gave_up": True, "recovered_at": None},
                flaky.entry_id: {"count": 1, "last": last, "gave_up": False, "recovered_at": None},
                "removed_meanwhile": {"count": 2, "last": last, "gave_up": True, "recovered_at": None},
                "broken": {"count": "x", "gave_up": True},
            },
        },
    }
    entry = await _setup(hass)
    watchdog = entry.runtime_data.watchdog
    assert set(watchdog.attempts) == {dead.entry_id, flaky.entry_id}
    assert watchdog.attempts[dead.entry_id].count == 3
    assert watchdog.attempts[dead.entry_id].gave_up is True
    assert watchdog.attempts[flaky.entry_id].last == dt_util.parse_datetime(last)
    # The Repairs issue of the integration still given up is raised again.
    registry = ir.async_get(hass)
    issue = registry.async_get_issue(DOMAIN, f"watchdog_gave_up_{dead.entry_id}")
    assert issue is not None
    assert issue.translation_placeholders == {"title": "Dead", "domain": "dead", "attempt": "3"}
    assert registry.async_get_issue(DOMAIN, "gave_up_removed_meanwhile") is None
    # Shown as given up, and not reloaded again.
    items = {i["domain"]: i for i in hass.states.get(UNAVAILABLE).attributes["integrations"]}
    assert items["dead"]["gave_up"] is True
    assert items["dead"]["reloads"] == 3
    freezer.tick(timedelta(minutes=15))
    with patch.object(hass.config_entries, "async_reload", AsyncMock(return_value=True)) as reload:
        await _check(hass)
    assert [c.args[0] for c in reload.await_args_list] == [flaky.entry_id]
    assert watchdog.attempts[flaky.entry_id].count == 2
    # The dropped ones leave the file.
    await _flush_store(hass, freezer)
    assert set(hass_storage[STORAGE_KEY]["data"]["attempts"]) == {dead.entry_id, flaky.entry_id}


async def test_repairs_try_again(hass: HomeAssistant, freezer: FrozenDateTimeFactory, caplog: pytest.LogCaptureFixture):
    """The issue's "Try again" starts over and reloads the integration in the background."""
    assert await async_setup_component(hass, "repairs", {})
    dead = await _give_up(hass, freezer)
    watchdog = hass.config_entries.async_entries(DOMAIN)[0].runtime_data.watchdog
    issue_id = f"watchdog_gave_up_{dead.entry_id}"
    manager = repairs_flow_manager(hass)
    result = await manager.async_init(DOMAIN, data={"issue_id": issue_id})
    assert result["type"] is FlowResultType.FORM
    assert result["step_id"] == "confirm"
    assert result["description_placeholders"] == {"title": "Dead", "domain": "dead", "attempt": "1"}
    with patch.object(hass.config_entries, "async_reload", AsyncMock(return_value=True)) as reload:
        result = await manager.async_configure(result["flow_id"], {})
        assert result["type"] is FlowResultType.ABORT
        assert result["reason"] == "reload_started"
        assert result["description_placeholders"] == {"title": "Dead"}
        await hass.async_block_till_done()
    reload.assert_awaited_once_with(dead.entry_id)
    assert dead.entry_id not in watchdog.attempts
    assert ir.async_get(hass).async_get_issue(DOMAIN, issue_id) is None
    assert hass.states.get(UNAVAILABLE).attributes["integrations"][0]["gave_up"] is False

    # Still unavailable: the watchdog starts over (reloads it again, up to the limit). A failed reload is only logged.
    dead_again = await _give_up_again(hass, freezer, dead)
    assert dead_again.gave_up is True
    result = await manager.async_init(DOMAIN, data={"issue_id": issue_id})
    caplog.clear()
    with patch.object(hass.config_entries, "async_reload", AsyncMock(return_value=False)):
        result = await manager.async_configure(result["flow_id"], {})
        await hass.async_block_till_done()
    assert result["reason"] == "reload_started"
    assert "Reset of Dead (dead): the reload failed" in caplog.text
    assert dead.entry_id not in watchdog.attempts


async def test_repairs_try_again_does_not_wait_for_the_reload(hass: HomeAssistant, freezer: FrozenDateTimeFactory):
    """The flow closes at once, even while a check holds the lock or the reload takes long."""
    assert await async_setup_component(hass, "repairs", {})
    dead = await _give_up(hass, freezer)
    watchdog = hass.config_entries.async_entries(DOMAIN)[0].runtime_data.watchdog
    manager = repairs_flow_manager(hass)
    result = await manager.async_init(DOMAIN, data={"issue_id": f"watchdog_gave_up_{dead.entry_id}"})
    release = asyncio.Event()

    async def slow_reload(_entry_id: str) -> bool:
        await release.wait()
        return True

    with patch.object(hass.config_entries, "async_reload", side_effect=slow_reload) as reload:
        async with watchdog._lock:  # noqa: SLF001 - a check still running
            task = asyncio.ensure_future(manager.async_configure(result["flow_id"], {}))
            for _ in range(5):
                await asyncio.sleep(0)
            if not task.done():
                task.cancel()
                pytest.fail("The flow waits for the running check")
            assert task.result()["reason"] == "reload_started"
            reload.assert_not_called()
        await asyncio.sleep(0)
        await asyncio.sleep(0)
        reload.assert_called_once_with(dead.entry_id)
        release.set()
        await hass.async_block_till_done()
    assert dead.entry_id not in watchdog.attempts


async def test_notification_dismissed_on_recovery_and_reset(hass: HomeAssistant, freezer: FrozenDateTimeFactory):
    """The per-integration notification goes once the watchdog starts over for it."""
    notifications = persistent_notification._async_get_or_create_notifications(hass)
    dead = await _give_up(hass, freezer)
    key = f"{DOMAIN}_watchdog_{dead.entry_id}"
    assert key in notifications
    # Recovered for its delay.
    hass.states.async_set("sensor.dead_0", "1")
    await _check(hass)
    assert key in notifications
    freezer.tick(timedelta(minutes=15))
    await _check(hass)
    assert key not in notifications
    # Reset (action) of an integration just reloaded.
    hass.states.async_set("sensor.dead_0", STATE_UNAVAILABLE)
    freezer.tick(timedelta(minutes=15))
    with patch.object(hass.config_entries, "async_reload", AsyncMock(return_value=True)):
        await _check(hass)
        assert key in notifications
        await hass.services.async_call(DOMAIN, "watchdog_reset", {"entry_id": dead.entry_id}, blocking=True)
    assert key not in notifications


async def test_notification_dismissed_on_entry_removal(hass: HomeAssistant, freezer: FrozenDateTimeFactory):
    notifications = persistent_notification._async_get_or_create_notifications(hass)
    dead = await _give_up(hass, freezer)
    await hass.config_entries.async_remove(dead.entry_id)
    await _check(hass)
    assert f"{DOMAIN}_watchdog_{dead.entry_id}" not in notifications


async def test_notifications_dismissed_with_the_watchdog(hass: HomeAssistant, freezer: FrozenDateTimeFactory):
    notifications = persistent_notification._async_get_or_create_notifications(hass)
    dead = await _give_up(hass, freezer)
    assert f"{DOMAIN}_watchdog_{dead.entry_id}" in notifications
    await hass.config_entries.async_remove(hass.config_entries.async_entries(DOMAIN)[0].entry_id)
    await hass.async_block_till_done()
    assert f"{DOMAIN}_watchdog_{dead.entry_id}" not in notifications


async def _give_up_again(hass: HomeAssistant, freezer: FrozenDateTimeFactory, entry: MockConfigEntry):
    watchdog = hass.config_entries.async_entries(DOMAIN)[0].runtime_data.watchdog
    with patch.object(hass.config_entries, "async_reload", AsyncMock(return_value=True)):
        for _ in range(7):
            freezer.tick(timedelta(minutes=5))
            await _check(hass)
    return watchdog.attempts[entry.entry_id]


async def test_reset_action(hass: HomeAssistant, freezer: FrozenDateTimeFactory):
    dead = await _give_up(hass, freezer)
    watchdog = hass.config_entries.async_entries(DOMAIN)[0].runtime_data.watchdog
    with patch.object(hass.config_entries, "async_reload", AsyncMock(return_value=True)) as reload:
        await hass.services.async_call(DOMAIN, "watchdog_reset", {"entry_id": dead.entry_id}, blocking=True)
    reload.assert_awaited_once_with(dead.entry_id)
    assert dead.entry_id not in watchdog.attempts
    assert ir.async_get(hass).async_get_issue(DOMAIN, f"watchdog_gave_up_{dead.entry_id}") is None
    # A failed reload is reported (the counts are reset anyway).
    with (
        patch.object(hass.config_entries, "async_reload", AsyncMock(side_effect=RuntimeError("boom"))),
        pytest.raises(HomeAssistantError) as err,
    ):
        await hass.services.async_call(DOMAIN, "watchdog_reset", {"entry_id": dead.entry_id}, blocking=True)
    assert err.value.translation_key == "watchdog_reload_failed"
    # Unknown entry, or the watchdog itself: refused.
    for entry_id in ("nope", hass.config_entries.async_entries(DOMAIN)[0].entry_id):
        with pytest.raises(ServiceValidationError) as err:
            await hass.services.async_call(DOMAIN, "watchdog_reset", {"entry_id": entry_id}, blocking=True)
        assert err.value.translation_key == "watchdog_unknown_entry"
