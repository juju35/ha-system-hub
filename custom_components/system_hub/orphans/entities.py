"""Entities of the Orphans module: orphaned entities (with their list), last scan, Scan now."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from homeassistant.components.button import ButtonEntity
from homeassistant.components.sensor import SensorDeviceClass, SensorEntity, SensorStateClass
from homeassistant.const import EntityCategory

from ..const import MODULE_ORPHANS
from ..entity import SystemHubEntity
from .const import MAX_LISTED
from .scanner import OrphanScanner


class OrphansEntity(SystemHubEntity):
    """An entity of the Orphans module."""

    def __init__(self, scanner: OrphanScanner, entry_id: str, key: str) -> None:
        super().__init__(scanner, entry_id, MODULE_ORPHANS, key)
        self.scanner = scanner


def orphans_list(scanner: OrphanScanner, limit: int | None = None) -> dict[str, Any]:
    """The orphan entities and devices, each with what still uses it (`used_by`), the most certain orphans first."""
    orphans, devices = scanner.orphans, scanner.devices
    return {
        "entities": [{**o.as_dict(), "used_by": scanner.references.get(o.entity_id, [])} for o in orphans[:limit]],
        "devices": [
            {**d.as_dict(), "used_by": scanner.device_references.get(d.device_id, [])} for d in devices[:limit]
        ],
        "truncated": max(0, len(orphans) - limit) if limit else 0,
        "devices_truncated": max(0, len(devices) - limit) if limit else 0,
    }


class OrphansSensor(OrphansEntity, SensorEntity):
    """Number of orphaned entities, listed in the attributes."""

    _attr_state_class = SensorStateClass.MEASUREMENT
    # Rewritten at every scan and possibly long: kept out of the recorder database.
    _unrecorded_attributes = frozenset(
        {
            "entities",
            "devices",
            "next_scan",
            "ignored_integrations",
            "ignored_entities",
            "truncated",
            "devices_truncated",
        }
    )

    @property
    def native_value(self) -> int | None:
        return None if self.scanner.last_scan is None else len(self.scanner.orphans)

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        # Capped: the attributes go to every open dashboard at each change (the panel reads the whole list).
        return {
            **orphans_list(self.scanner, MAX_LISTED),
            # End of the grace period after a start (None once it is over): the card says when the first scan is due.
            "next_scan": self.scanner.next_scan.isoformat() if self.scanner.next_scan else None,
            "counts": self.scanner.counts(),
            "removed": self.scanner.removed,
            "stale_hours": self.scanner.stale_hours,
            "include_unknown": self.scanner.include_unknown,
            "ignored_integrations": sorted(self.scanner.ignored_integrations),
            "ignored_entities": sorted(self.scanner.ignored_entities),
        }


class OrphansLastScanSensor(OrphansEntity, SensorEntity):
    """End of the last scan."""

    _attr_device_class = SensorDeviceClass.TIMESTAMP
    _attr_entity_category = EntityCategory.DIAGNOSTIC

    @property
    def native_value(self) -> datetime | None:
        return self.scanner.last_scan


class OrphansScanButton(OrphansEntity, ButtonEntity):
    """Scan now, even within the grace period (does nothing while Home Assistant is starting)."""

    async def async_press(self) -> None:
        self.scanner.async_scan(force=True)


def sensors(scanner: OrphanScanner, entry_id: str) -> list[SensorEntity]:
    return [OrphansSensor(scanner, entry_id, "orphans"), OrphansLastScanSensor(scanner, entry_id, "last_scan")]


def buttons(scanner: OrphanScanner, entry_id: str) -> list[ButtonEntity]:
    return [OrphansScanButton(scanner, entry_id, "scan")]
