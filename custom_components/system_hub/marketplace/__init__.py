"""Marketplace module: check every repository installed from the Marketplace for updates, on the server."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import CALLBACK_TYPE, HomeAssistant, callback
from homeassistant.helpers.event import async_call_later
from homeassistant.helpers.start import async_at_started
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .const import CONF_SCAN_INTERVAL, DEFAULT_SCAN_INTERVAL, STATE_ERROR
from .refresher import STORAGE_KEY, STORAGE_VERSION, MarketplaceNotAvailableError, MarketplaceRefresher

_LOGGER = logging.getLogger(__name__)

# Delay before trying again a scheduled check that failed or was skipped because the Marketplace couldn't be used.
RETRY_INTERVAL = timedelta(hours=1)


async def async_setup_marketplace(
    hass: HomeAssistant, entry: ConfigEntry, options: dict[str, Any]
) -> MarketplaceRefresher:
    """Load the last check and schedule the automatic one."""
    refresher = MarketplaceRefresher(hass, entry, options)
    await refresher.async_load()
    if refresher.scan_interval > 0:
        _async_schedule(hass, entry, refresher, timedelta(hours=refresher.scan_interval))
    return refresher


async def async_options_changed(refresher: MarketplaceRefresher, options: dict[str, Any]) -> None:
    """A new interval counts from the last check, not from the time set before."""
    if refresher.scan_interval != int(options.get(CONF_SCAN_INTERVAL, DEFAULT_SCAN_INTERVAL)):
        await refresher.async_forget_next_due()


async def async_remove_marketplace(hass: HomeAssistant) -> None:
    """The integration is removed: forget the last check."""
    await Store(hass, STORAGE_VERSION, STORAGE_KEY).async_remove()


def _async_schedule(
    hass: HomeAssistant, entry: ConfigEntry, refresher: MarketplaceRefresher, interval: timedelta
) -> None:
    """Run the automatic check one interval after the last one, kept across restarts.

    Once Home Assistant has started, an overdue check runs right away, so that restarting more
    often than the interval doesn't postpone it forever. Before the first check, the interval
    counts from the first setup. The time the scheduler sets (`next_due`, also an hour after a
    failed or skipped check) is kept across restarts and shown as the sensor's `next_check`.
    """
    cancel: list[CALLBACK_TYPE] = []

    @callback
    def cancel_timer() -> None:
        while cancel:
            cancel.pop()()

    @callback
    def schedule(due: datetime) -> None:
        cancel_timer()
        refresher.async_set_next_due(due)
        cancel.append(async_call_later(hass, max((due - dt_util.utcnow()).total_seconds(), 0), run))

    def interval_due() -> datetime:
        return (refresher.last_check or refresher.since or dt_util.utcnow()) + interval

    @callback
    def schedule_next() -> None:
        schedule(interval_due())

    @callback
    def retry() -> None:
        # Often temporary (Marketplace rate-limited or still starting, GitHub down): try again within the hour,
        # or a minute after GitHub's rate limit resets when the check was not started for lack of requests left.
        due = dt_util.utcnow() + min(interval, RETRY_INTERVAL)
        if refresher.retry_after is not None:
            due = max(refresher.retry_after + timedelta(minutes=1), dt_util.utcnow() + timedelta(minutes=1))
        schedule(due)

    @callback
    def on_done() -> None:
        # A failed check (often temporary) is tried again within the hour, not a whole interval later.
        if refresher.state == STATE_ERROR:
            retry()
        else:
            schedule_next()

    async def run(_now: datetime) -> None:
        cancel.clear()
        # When a check is already running, its end (on_done) schedules the next one; when updates are
        # being installed, their end (on_install_done) runs the check then.
        if refresher.installing_updates:
            return
        try:
            refresher.async_start()
        except MarketplaceNotAvailableError as err:
            _LOGGER.warning("Scheduled Marketplace check skipped: %s", err)
            retry()

    @callback
    def at_started(_hass: HomeAssistant) -> None:
        # The time set before the restart (a retry within the hour included), never later than one interval.
        due = interval_due() if refresher.next_due is None else min(refresher.next_due, interval_due())
        if due <= dt_util.utcnow():
            entry.async_create_task(hass, run(dt_util.utcnow()))
        else:
            schedule(due)

    refresher.on_done = on_done
    refresher.on_install_done = schedule_next
    entry.async_on_unload(cancel_timer)
    entry.async_on_unload(async_at_started(hass, at_started))
