"""Orphans module: list the entities their integration no longer provides and the orphan devices, remove in bulk.

Scans the registries every 15 minutes (and a few seconds after they change), once the grace period after a start is
over; what still uses each orphan (automations, scripts, scenes, groups, dashboards) comes with it.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from homeassistant.config_entries import SIGNAL_CONFIG_ENTRY_CHANGED, ConfigEntry
from homeassistant.core import CALLBACK_TYPE, CoreState, Event, HomeAssistant, callback
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.event import async_call_later, async_track_time_interval
from homeassistant.helpers.start import async_at_started
from homeassistant.util import dt as dt_util

from .const import (
    CONF_GRACE_PERIOD,
    CONF_IGNORED_ENTITIES,
    CONF_IGNORED_INTEGRATIONS,
    CONF_INCLUDE_UNKNOWN,
    CONF_SCAN_INTERVAL,
    CONF_STALE_HOURS,
    DEFAULT_GRACE_PERIOD,
    DEFAULT_INCLUDE_UNKNOWN,
    DEFAULT_SCAN_INTERVAL,
    DEFAULT_STALE_HOURS,
    EVENT_LOVELACE_UPDATED,
    REGISTRY_DEBOUNCE,
)
from .scanner import OrphanScanner


async def async_setup_orphans(hass: HomeAssistant, entry: ConfigEntry, options: dict[str, Any]) -> OrphanScanner:
    """Start the scanner for the entry: the periodic scan, after registry changes, and once the grace period is over."""
    grace = timedelta(minutes=int(options.get(CONF_GRACE_PERIOD, DEFAULT_GRACE_PERIOD)))
    scanner = OrphanScanner(
        hass,
        grace,
        int(options.get(CONF_STALE_HOURS, DEFAULT_STALE_HOURS)),
        bool(options.get(CONF_INCLUDE_UNKNOWN, DEFAULT_INCLUDE_UNKNOWN)),
        options.get(CONF_IGNORED_INTEGRATIONS, []),
        options.get(CONF_IGNORED_ENTITIES, []),
    )
    # Set up with Home Assistant already running (added, options changed): no grace period.
    if hass.state is CoreState.running:
        scanner.started_at = dt_util.utcnow() - grace

    pending: CALLBACK_TYPE | None = None

    @callback
    def _scan_later(*_: Any) -> None:
        """Scan once a burst of registry or config entry changes is over."""
        nonlocal pending
        if pending is not None:
            pending()

        @callback
        def _run(_now: datetime) -> None:
            nonlocal pending
            pending = None
            scanner.async_scan()

        pending = async_call_later(hass, REGISTRY_DEBOUNCE, _run)

    @callback
    def _cancel() -> None:
        if pending is not None:
            pending()

    entry.async_on_unload(_cancel)
    entry.async_on_unload(hass.bus.async_listen(er.EVENT_ENTITY_REGISTRY_UPDATED, _scan_later))
    entry.async_on_unload(async_dispatcher_connect(hass, SIGNAL_CONFIG_ENTRY_CHANGED, _scan_later))

    @callback
    def _dashboard_saved(_event: Event) -> None:
        scanner.async_dashboards_changed()

    entry.async_on_unload(hass.bus.async_listen(EVENT_LOVELACE_UPDATED, _dashboard_saved))

    @callback
    def scheduled(_now: datetime) -> None:
        # Does nothing while Home Assistant is starting or within the grace period.
        scanner.async_scan()

    minutes = int(options.get(CONF_SCAN_INTERVAL, DEFAULT_SCAN_INTERVAL))
    entry.async_on_unload(async_track_time_interval(hass, scheduled, timedelta(minutes=minutes)))

    @callback
    def delayed(_now: datetime) -> None:
        scanner.async_scan()

    @callback
    def first_scan(_hass: HomeAssistant) -> None:
        scanner.async_started()
        if scanner.ready:
            scanner.async_scan()
        else:
            # Right after a start: once the integrations had the grace period to set up their entities.
            entry.async_on_unload(async_call_later(hass, grace, delayed))

    entry.async_on_unload(async_at_started(hass, first_scan))
    return scanner
