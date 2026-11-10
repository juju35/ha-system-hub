"""Containers module: monitor Core, the Supervisor and the add-ons through the Supervisor (monitoring only)."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.event import async_track_time_interval
from homeassistant.helpers.start import async_at_started

from .const import CONF_NOTIFY, CONF_NOTIFY_SERVICES, CONF_SCAN_INTERVAL, DEFAULT_SCAN_INTERVAL
from .monitor import ContainerMonitor


async def async_setup_containers(hass: HomeAssistant, entry: ConfigEntry, options: dict[str, Any]) -> ContainerMonitor:
    """Read the containers once Home Assistant has started, then at the interval chosen."""
    monitor = ContainerMonitor(hass, bool(options.get(CONF_NOTIFY, True)), list(options.get(CONF_NOTIFY_SERVICES, [])))

    async def scheduled(_now: datetime) -> None:
        await monitor.async_refresh()

    seconds = int(options.get(CONF_SCAN_INTERVAL, DEFAULT_SCAN_INTERVAL))
    entry.async_on_unload(async_track_time_interval(hass, scheduled, timedelta(seconds=seconds)))

    async def first_refresh(_hass: HomeAssistant) -> None:
        await monitor.async_refresh()

    entry.async_on_unload(async_at_started(hass, first_refresh))
    return monitor
