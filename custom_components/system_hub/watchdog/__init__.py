"""Watchdog module: reload the integrations whose entities are all unavailable, power cycle devices by their plug."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any

from homeassistant.components import persistent_notification
from homeassistant.config_entries import SIGNAL_CONFIG_ENTRY_CHANGED, ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers import issue_registry as ir
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.event import async_track_time_interval
from homeassistant.helpers.start import async_at_started
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from ..const import DOMAIN
from .const import (
    CONF_DELAY,
    CONF_DEVICE,
    CONF_GRACE_OVERRIDES,
    CONF_GRACE_PERIOD,
    CONF_IGNORED,
    CONF_IGNORED_ENTRIES,
    CONF_MAX_RELOADS,
    CONF_NOTIFY,
    CONF_OFF_TIME,
    CONF_PAUSE_ENTITY,
    CONF_POWER_CYCLES,
    CONF_SCAN_INTERVAL,
    CONF_SWITCH,
    DEFAULT_CYCLE_DELAY,
    DEFAULT_GRACE_PERIOD,
    DEFAULT_MAX_RELOADS,
    DEFAULT_OFF_TIME,
    DEFAULT_SCAN_INTERVAL,
    STORAGE_KEY,
    STORAGE_VERSION,
)
from .core import IntegrationWatchdog, PowerCycle, device_notification_id, notification_id

_LOGGER = logging.getLogger(__name__)
# Key of the watchdog's state in hass.data[DOMAIN]: reload counts, lock and store, kept across reloads of the entry.
SHARED_KEY = "watchdog"


def _shared(hass: HomeAssistant) -> dict[str, Any]:
    return hass.data.setdefault(DOMAIN, {}).setdefault(SHARED_KEY, {})


async def async_setup_watchdog(hass: HomeAssistant, entry: ConfigEntry, options: dict[str, Any]) -> IntegrationWatchdog:
    """Start the watchdog for the entry: the periodic check, and the first one once Home Assistant has started."""
    watchdog = IntegrationWatchdog(
        hass,
        options.get(CONF_IGNORED, []),
        timedelta(minutes=int(options.get(CONF_GRACE_PERIOD, DEFAULT_GRACE_PERIOD))),
        int(options.get(CONF_MAX_RELOADS, DEFAULT_MAX_RELOADS)),
        options.get(CONF_NOTIFY, []),
        # Reload counts and lock, kept in memory until Home Assistant restarts.
        _shared(hass),
        options.get(CONF_IGNORED_ENTRIES, []),
        options.get(CONF_PAUSE_ENTITY),
        {domain: timedelta(minutes=int(m)) for domain, m in options.get(CONF_GRACE_OVERRIDES, {}).items()},
        power_cycles(options.get(CONF_POWER_CYCLES, [])),
    )
    await watchdog.async_load()
    entry.async_on_unload(watchdog.async_stop)
    entry.async_on_unload(async_dispatcher_connect(hass, SIGNAL_CONFIG_ENTRY_CHANGED, watchdog.async_entry_changed))

    async def scheduled(_now: datetime) -> None:
        # The check itself does nothing while Home Assistant is starting or stopping.
        await watchdog.async_check()

    minutes = int(options.get(CONF_SCAN_INTERVAL, DEFAULT_SCAN_INTERVAL))
    entry.async_on_unload(async_track_time_interval(hass, scheduled, timedelta(minutes=minutes)))

    async def first_check(_hass: HomeAssistant) -> None:
        # Runs right away when Home Assistant is already running (started_at is then already set).
        if watchdog.started_at is None:
            watchdog.started_at = dt_util.utcnow()
        # After a reload of the entry, a check of the previous instance may still be running.
        await watchdog.async_check(wait=True)

    entry.async_on_unload(async_at_started(hass, first_check))
    return watchdog


async def async_wait_idle(hass: HomeAssistant) -> None:
    """Wait for a check still running (of an instance being unloaded or removed)."""
    shared = hass.data.get(DOMAIN, {}).get(SHARED_KEY)
    if shared is not None and (lock := shared.get("lock")) is not None:
        async with lock:
            pass


async def async_disable_watchdog(hass: HomeAssistant) -> None:
    """The module was turned off: its Repairs issues and notifications are of no use any more. Its history stays."""
    await async_wait_idle(hass)
    _dismiss(hass, hass.data.get(DOMAIN, {}).get(SHARED_KEY))


async def async_remove_watchdog(hass: HomeAssistant) -> None:
    """The integration is removed: forget the reload counts, the history, the issues and the notifications.

    Call async_wait_idle first: a check still running must end before its state is dropped.
    """
    shared = hass.data.get(DOMAIN, {}).get(SHARED_KEY)
    _dismiss(hass, shared)
    store = shared.get("store") if shared else None
    await (store or Store(hass, STORAGE_VERSION, STORAGE_KEY)).async_remove()
    hass.data.get(DOMAIN, {}).pop(SHARED_KEY, None)


def _dismiss(hass: HomeAssistant, shared: dict[str, Any] | None) -> None:
    # Persistent notifications only live until Home Assistant stops: those of this run are the entries counted or
    # recorded in the shared state.
    if shared is not None:
        for entry_id in {*shared.get("attempts", {}), *(item["entry_id"] for item in shared.get("history", []))}:
            persistent_notification.async_dismiss(hass, notification_id(entry_id))
        devices = {
            *shared.get("cycle_attempts", {}),
            *(i["device_id"] for i in shared.get("history", []) if "device_id" in i),
        }
        for device_id in devices:
            persistent_notification.async_dismiss(hass, device_notification_id(device_id))
    registry = ir.async_get(hass)
    for domain, issue_id in list(registry.issues):
        if domain == DOMAIN and issue_id.startswith("watchdog_"):
            ir.async_delete_issue(hass, DOMAIN, issue_id)


def power_cycles(items: Any) -> list[PowerCycle]:
    """The power cycles of the options; malformed ones skipped."""
    cycles = []
    for item in items if isinstance(items, list) else []:
        try:
            cycles.append(
                PowerCycle(
                    str(item[CONF_DEVICE]),
                    str(item[CONF_SWITCH]),
                    timedelta(minutes=int(item.get(CONF_DELAY, DEFAULT_CYCLE_DELAY))),
                    timedelta(seconds=int(item.get(CONF_OFF_TIME, DEFAULT_OFF_TIME))),
                )
            )
        except (KeyError, TypeError, ValueError, AttributeError):
            _LOGGER.warning("Invalid power cycle in the options, skipped: %s", item)
    return cycles
