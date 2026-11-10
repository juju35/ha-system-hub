"""Sensors of the modules: Watchdog (unavailable integrations, reloads, last check), Marketplace (status)."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, ClassVar

from homeassistant.components.sensor import SensorDeviceClass, SensorEntity, SensorStateClass
from homeassistant.const import EntityCategory
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.util import dt as dt_util

from . import SystemHubConfigEntry
from .const import DOMAIN, MODULE_MARKETPLACE, MODULE_WATCHDOG
from .entity import SystemHubEntity
from .marketplace.const import STATE_ERROR, STATE_IDLE, STATE_RUNNING
from .marketplace.refresher import MarketplaceRefresher
from .watchdog.core import IntegrationWatchdog


async def async_setup_entry(
    hass: HomeAssistant,
    entry: SystemHubConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    data = entry.runtime_data
    entities: list[SensorEntity] = []
    if (w := data.watchdog) is not None:
        entities += [
            UnavailableSensor(w, entry.entry_id, "unavailable"),
            LastReloadSensor(w, entry.entry_id, "last_reload"),
            WatchdogLastCheckSensor(w, entry.entry_id, "last_check"),
            Reloads24hSensor(w, entry.entry_id, "reloads_24h"),
        ]
    if (r := data.marketplace) is not None:
        entities += [
            MarketplaceStatusSensor(r, entry.entry_id, "status"),
            MarketplaceLastCheckSensor(r, entry.entry_id, "last_check"),
        ]
    async_add_entities(entities)


class WatchdogEntity(SystemHubEntity):
    """An entity of the Watchdog module."""

    def __init__(self, watchdog: IntegrationWatchdog, entry_id: str, key: str) -> None:
        super().__init__(watchdog, entry_id, MODULE_WATCHDOG, key)
        self.watchdog = watchdog


class MarketplaceEntity(SystemHubEntity):
    """An entity of the Marketplace module."""

    def __init__(self, refresher: MarketplaceRefresher, entry_id: str, key: str) -> None:
        super().__init__(refresher, entry_id, MODULE_MARKETPLACE, key)
        self.refresher = refresher


class UnavailableSensor(WatchdogEntity, SensorEntity):
    """Number of integrations whose entities are all unavailable, listed in the attributes."""

    _attr_state_class = SensorStateClass.MEASUREMENT
    # Rewritten at every check: kept out of the recorder database.
    _unrecorded_attributes = frozenset({"integrations", "ignored"})

    @property
    def native_value(self) -> int | None:
        return None if self.watchdog.last_check is None else len(self.watchdog.unavailable)

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        return {
            "integrations": [self.watchdog.as_dict(u) for u in self.watchdog.unavailable],
            "ignored": sorted(self.watchdog.ignored - {DOMAIN}),
            "max_reloads": self.watchdog.max_reloads,
            "paused": self.watchdog.paused,
        }


class LastReloadSensor(WatchdogEntity, SensorEntity):
    """Time of the last reload, with the integration reloaded and the recent reloads for the card."""

    _attr_device_class = SensorDeviceClass.TIMESTAMP
    # Up to HISTORY_SIZE items, saved in the integration's own storage: kept out of the recorder database.
    _unrecorded_attributes = frozenset({"history"})

    @property
    def native_value(self) -> datetime | None:
        return self.watchdog.last_reload.at if self.watchdog.last_reload else None

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        r = self.watchdog.last_reload
        return {
            "domain": r.domain if r else None,
            "title": r.title if r else None,
            "entry_id": r.entry_id if r else None,
            "success": r.success if r else None,
            "reloads": self.watchdog.reloads,
            # A copy: a list shared with the published state always compares equal to it, so a give-up
            # (same state, same total) would not be written.
            "history": list(self.watchdog.history),
        }


class WatchdogLastCheckSensor(WatchdogEntity, SensorEntity):
    """End of the last check."""

    _attr_device_class = SensorDeviceClass.TIMESTAMP
    _attr_entity_category = EntityCategory.DIAGNOSTIC

    @property
    def native_value(self) -> datetime | None:
        return self.watchdog.last_check


class Reloads24hSensor(WatchdogEntity, SensorEntity):
    """Reloads (and failed reloads) of the last 24 hours, from the history: an unstable integration shows up here."""

    _attr_state_class = SensorStateClass.MEASUREMENT

    def _recent(self) -> list[dict[str, Any]]:
        since = dt_util.utcnow() - timedelta(hours=24)
        recent = []
        for item in self.watchdog.history:
            at = dt_util.parse_datetime(item.get("at") or "")
            if at is not None and at.tzinfo is None:
                at = at.replace(tzinfo=dt_util.UTC)
            if item.get("kind") in ("reloaded", "reload_failed") and at is not None and at >= since:
                recent.append(item)
        return recent

    @property
    def native_value(self) -> int:
        return len(self._recent())

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        recent = self._recent()
        counts: dict[str, int] = {}
        for item in recent:
            name = item.get("title") or item.get("domain") or "?"
            counts[name] = counts.get(name, 0) + 1
        return {
            "failed": sum(1 for h in recent if h.get("kind") == "reload_failed"),
            "integrations": counts,
        }


class MarketplaceStatusSensor(MarketplaceEntity, SensorEntity):
    """idle / running / error, with the progress as attributes."""

    _attr_device_class = SensorDeviceClass.ENUM
    _attr_options: ClassVar[list[str]] = [STATE_IDLE, STATE_RUNNING, STATE_ERROR]
    # Lists that change at every repository checked or installed: kept out of the recorder.
    _unrecorded_attributes = frozenset(
        {
            "failed",
            "not_checked",
            "checking",
            "installing",
            "install_failed",
            "rate_limit_remaining",
            "rate_limit_reset",
        }
    )

    @property
    def native_value(self) -> str:
        return self.refresher.state

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        r = self.refresher
        return {
            "done": r.done,
            "total": r.total,
            "updates": r.updates,
            "failed": list(r.failed),
            "not_checked": list(r.not_checked),
            "error": r.error,
            "checking": sorted(r.checking),
            "installing": list(r.installing),
            "install_failed": list(r.install_failed),
            "github_connected": r.github_connected,
            # GitHub's rate limit as read at the last check (None without a GitHub account)
            "rate_limit_remaining": r.rate_limit_remaining,
            "rate_limit_reset": r.rate_limit_reset.isoformat() if r.rate_limit_reset else None,
        }


class MarketplaceLastCheckSensor(MarketplaceEntity, SensorEntity):
    """End of the last check, scheduled or manual."""

    _attr_device_class = SensorDeviceClass.TIMESTAMP
    _attr_entity_category = EntityCategory.DIAGNOSTIC

    @property
    def native_value(self) -> datetime | None:
        return self.refresher.last_check

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """The automatic check's interval (hours, 0 = off) and when it is due, for the card."""
        r = self.refresher
        hours = r.scan_interval
        # As set by the scheduler (an hour after a failed check); before it starts, one interval after the last check.
        last = r.last_check or r.since
        due = (r.next_due or (last + timedelta(hours=hours) if last else None)) if hours > 0 else None
        return {"scan_interval": hours, "next_check": due.isoformat() if due else None}
