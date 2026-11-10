"""Batteries module: low batteries notified twice a day, replacement forecast and spare batteries."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from homeassistant.components import persistent_notification
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import CoreState, HomeAssistant, callback
from homeassistant.helpers.event import async_track_time_change, async_track_time_interval
from homeassistant.helpers.start import async_at_started
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from ..const import DOMAIN
from .const import (
    CONF_DURATION,
    CONF_EVENING,
    CONF_IGNORED_ENTITIES,
    CONF_IGNORED_INTEGRATIONS,
    CONF_MORNING,
    CONF_NOTIFY,
    CONF_THRESHOLD,
    DEFAULT_DURATION,
    DEFAULT_EVENING,
    DEFAULT_IGNORED_INTEGRATIONS,
    DEFAULT_MORNING,
    DEFAULT_THRESHOLD,
    NOTIFICATION_ID,
    REFRESH_MINUTES,
    STORAGE_KEY,
    STORAGE_VERSION,
)
from .monitor import BatteryMonitor


async def async_setup_batteries(hass: HomeAssistant, entry: ConfigEntry, options: dict[str, Any]) -> BatteryMonitor:
    """Follow the batteries, refresh the list, forecast once a day and notify at the two times chosen."""
    monitor = BatteryMonitor(
        hass,
        int(options.get(CONF_THRESHOLD, DEFAULT_THRESHOLD)),
        timedelta(hours=float(options.get(CONF_DURATION, DEFAULT_DURATION))),
        options.get(CONF_NOTIFY, []),
        options.get(CONF_IGNORED_ENTITIES, []),
        options.get(CONF_IGNORED_INTEGRATIONS, DEFAULT_IGNORED_INTEGRATIONS),
        entry.entry_id,
    )
    await monitor.async_load()
    entry.async_on_unload(monitor.async_listen())

    # Levels and durations move on even when no battery changes.
    @callback
    def refresh(now: datetime) -> None:
        monitor.async_refresh()
        # The drains are measured on the history once a day: a forecast of the replacement dates.
        if hass.state is CoreState.running and monitor.forecast_due(now):
            entry.async_create_background_task(hass, monitor.async_forecast(), f"{DOMAIN}_batteries_forecast")

    @callback
    def first_forecast(_hass: HomeAssistant) -> None:
        # Drains measured less than a day ago (kept in .storage) are reused: no 30-day history query at each restart.
        if not monitor.forecast_due():
            return
        entry.async_create_background_task(hass, monitor.async_forecast(), f"{DOMAIN}_batteries_forecast")

    entry.async_on_unload(async_track_time_interval(hass, refresh, timedelta(minutes=REFRESH_MINUTES)))
    # At start-up, the batteries of integrations loading after this one (ZHA, Z-Wave…) are not there yet:
    # the first forecast waits for Home Assistant to be started, rather than skipping them for a day.
    entry.async_on_unload(async_at_started(hass, first_forecast))

    async def scheduled(_now: datetime) -> None:
        await monitor.async_notify()

    times = set()
    for key, default in ((CONF_MORNING, DEFAULT_MORNING), (CONF_EVENING, DEFAULT_EVENING)):
        at = dt_util.parse_time(str(options.get(key, default))) or dt_util.parse_time(default)
        # The same morning and evening time schedules one notification, not two at the same second.
        if at in times:
            continue
        times.add(at)
        entry.async_on_unload(
            async_track_time_change(hass, scheduled, hour=at.hour, minute=at.minute, second=at.second)
        )
    return monitor


@callback
def async_disable_batteries(hass: HomeAssistant) -> None:
    """The module was turned off: its notification is of no use any more. The low-battery times stay."""
    persistent_notification.async_dismiss(hass, NOTIFICATION_ID)


async def async_remove_batteries(hass: HomeAssistant) -> None:
    """The integration is removed: drop the notification and the stored low-battery times and drains."""
    persistent_notification.async_dismiss(hass, NOTIFICATION_ID)
    # A reinstall must start every count afresh, not resume times from the removed entry.
    await Store(hass, STORAGE_VERSION, STORAGE_KEY).async_remove()
