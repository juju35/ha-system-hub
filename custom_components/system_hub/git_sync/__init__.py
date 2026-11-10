"""Git Sync module: commit and push the Home Assistant configuration, export the dashboards."""

from __future__ import annotations

import logging
from collections.abc import Mapping
from datetime import datetime, timedelta
from typing import Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import ATTR_ENTITY_ID, EVENT_CALL_SERVICE
from homeassistant.core import Event, HomeAssistant, callback
from homeassistant.helpers.event import async_track_time_change, async_track_time_interval
from homeassistant.util import dt as dt_util

from ..const import DOMAIN
from .const import (
    CONF_COMMIT_BEFORE_UPDATE,
    CONF_COMMIT_INTERVAL,
    CONF_EXPORT_ENABLED,
    CONF_EXPORT_TIME,
    CONF_REPO_PATH,
    DEFAULT_COMMIT_INTERVAL,
    DEFAULT_EXPORT_TIME,
)
from .coordinator import GitSyncCoordinator

_LOGGER = logging.getLogger(__name__)


def configured(settings: dict[str, Any]) -> bool:
    """The repository was set up (and checked) in the options."""
    return bool(settings.get(CONF_REPO_PATH))


async def async_setup_git_sync(hass: HomeAssistant, entry: ConfigEntry, settings: dict[str, Any]) -> GitSyncCoordinator:
    """Read the repository, then schedule the automatic commits and the daily export.

    A repository that can't be read (moved, key lost) leaves the module's entities unavailable with the error,
    instead of failing the whole integration: the next refresh tries again.
    """
    coordinator = GitSyncCoordinator(hass, entry, settings)
    await coordinator.async_load()
    await coordinator.async_refresh()
    _schedule(hass, entry, coordinator)
    return coordinator


async def async_remove_git_sync(hass: HomeAssistant) -> None:
    """The integration is removed: forget the last push and export."""
    await GitSyncCoordinator.async_remove_store(hass)


def _schedule(hass: HomeAssistant, entry: ConfigEntry, coordinator: GitSyncCoordinator) -> None:
    """Register the automatic commit interval and the daily dashboard export."""
    settings = coordinator.settings

    interval = int(settings.get(CONF_COMMIT_INTERVAL, DEFAULT_COMMIT_INTERVAL))
    if interval > 0:

        async def _auto_commit(_now: datetime) -> None:
            try:
                await coordinator.async_auto_commit()
            except Exception:
                _LOGGER.exception("Automatic commit failed")

        entry.async_on_unload(
            async_track_time_interval(
                hass, _auto_commit, timedelta(minutes=interval), name=f"{DOMAIN} git sync auto commit"
            )
        )

    if settings.get(CONF_COMMIT_BEFORE_UPDATE):

        @callback
        def _is_update_install(event_data: Mapping[str, Any]) -> bool:
            return event_data.get("domain") == "update" and event_data.get("service") == "install"

        async def _snapshot(event: Event) -> None:
            ids = event.data.get("service_data", {}).get(ATTR_ENTITY_ID) or []
            await coordinator.async_snapshot_before_update([ids] if isinstance(ids, str) else list(ids))

        # The filter runs inline in the event bus: only update.install schedules a call.
        entry.async_on_unload(hass.bus.async_listen(EVENT_CALL_SERVICE, _snapshot, event_filter=_is_update_install))

    if settings.get(CONF_EXPORT_ENABLED, True):
        export_time = dt_util.parse_time(settings.get(CONF_EXPORT_TIME) or DEFAULT_EXPORT_TIME)
        if export_time is None:
            _LOGGER.warning("Invalid export time %s", settings.get(CONF_EXPORT_TIME))
            return

        async def _auto_export(_now: datetime) -> None:
            try:
                await coordinator.async_export_dashboards()
            except Exception:
                _LOGGER.exception("Automatic dashboard export failed")

        entry.async_on_unload(
            async_track_time_change(
                hass,
                _auto_export,
                hour=export_time.hour,
                minute=export_time.minute,
                second=export_time.second,
            )
        )
