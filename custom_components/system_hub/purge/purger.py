"""The purge of the folders set, once a day (and at a start when the last one is more than a day old)."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Callable
from datetime import datetime, timedelta
from typing import Any, Final

from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.event import async_track_time_change
from homeassistant.helpers.start import async_at_started
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from . import CONF_DIRECTORIES, CONF_MAX_AGE, browse, purge, resolve, settings

_LOGGER = logging.getLogger(__name__)

STORAGE_KEY: Final = "system_hub.purge"
STORAGE_VERSION: Final = 1
# Every night, at a time few other jobs take.
RUN_AT: Final = {"hour": 3, "minute": 47, "second": 0}


class FilePurger:
    """Deletes the files older than max_age days in each folder set, and keeps the result of the last purge."""

    def __init__(self, hass: HomeAssistant, options: dict[str, Any] | None) -> None:
        self.hass = hass
        chosen = settings(options)
        self.directories: list[str] = chosen[CONF_DIRECTORIES]
        self.max_age: int = chosen[CONF_MAX_AGE]
        self.last_run: datetime | None = None
        self.last_files = 0
        self.last_bytes = 0
        self.last_errors = 0
        self.running = False
        self._lock = asyncio.Lock()
        # The schedule's unsubscribers, then the entities refreshed after each purge
        self._unsubs: list[Callable[[], None]] = []
        self._listeners: list[Callable[[], None]] = []
        self._store: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, STORAGE_KEY)

    @callback
    def async_add_listener(self, update: Callable[[], None]) -> Callable[[], None]:
        """Call update after each purge (and when one starts); returns how to stop."""
        self._listeners.append(update)

        def _remove() -> None:
            self._listeners.remove(update)

        return _remove

    def _notify(self) -> None:
        for update in list(self._listeners):
            update()

    async def async_start(self) -> None:
        """Read the last purge, purge once started when it is more than a day old, then every night."""
        if stored := await self._store.async_load():
            self.last_run = dt_util.parse_datetime(stored.get("last_run") or "")
            self.last_files = int(stored.get("files") or 0)
            self.last_bytes = int(stored.get("bytes") or 0)
            self.last_errors = int(stored.get("errors") or 0)

        async def _started(_hass: HomeAssistant) -> None:
            if self.last_run is None or dt_util.utcnow() - self.last_run > timedelta(days=1):
                await self._async_scheduled()

        self._unsubs.append(async_at_started(self.hass, _started))
        self._unsubs.append(async_track_time_change(self.hass, self._tick, **RUN_AT))

    @callback
    def async_stop(self) -> None:
        while self._unsubs:
            self._unsubs.pop()()

    async def _tick(self, _now: datetime) -> None:
        await self._async_scheduled()

    async def _async_scheduled(self) -> None:
        try:
            await self.async_purge()
        except Exception:  # noqa: BLE001 - a scheduled purge must not end with an unhandled error
            _LOGGER.exception("The scheduled purge failed")

    def _scan(self, dry_run: bool) -> list[dict[str, Any]]:
        """Each folder: its real path, why it is refused, its counts. Blocking."""
        config_dir = self.hass.config.config_dir
        results = []
        for directory in self.directories:
            path, refused = resolve(config_dir, directory)
            item: dict[str, Any] = {"directory": directory, "path": str(path), "refused": refused}
            if refused is None:
                item |= purge(path, self.max_age, dry_run)
            results.append(item)
        return results

    async def async_scan(self) -> list[dict[str, Any]]:
        """What a purge would delete now, without deleting anything."""
        return await self.hass.async_add_executor_job(self._scan, True)

    async def async_purge(self, dry_run: bool = False) -> dict[str, Any]:
        """Purge every folder (or tell what would be with dry_run); one purge at a time."""
        async with self._lock:
            self.running = True
            self._notify()
            try:
                folders = await self.hass.async_add_executor_job(self._scan, dry_run)
            finally:
                self.running = False
            key, size = ("old_files", "old_size") if dry_run else ("deleted", "freed")
            result = {
                "dry_run": dry_run,
                "max_age": self.max_age,
                "files": sum(f.get(key, 0) for f in folders),
                "bytes": sum(f.get(size, 0) for f in folders),
                "errors": sum(len(f.get("errors", [])) for f in folders),
                "directories": folders,
            }
            if not dry_run:
                self.last_run = dt_util.utcnow()
                self.last_files, self.last_bytes, self.last_errors = result["files"], result["bytes"], result["errors"]
                await self._store.async_save(
                    {
                        "last_run": self.last_run.isoformat(),
                        "files": self.last_files,
                        "bytes": self.last_bytes,
                        "errors": self.last_errors,
                    }
                )
                if result["files"] or result["errors"]:
                    _LOGGER.info(
                        "Purge: %s files deleted (%s bytes), %s errors",
                        result["files"],
                        result["bytes"],
                        result["errors"],
                    )
            self._notify()
            return result

    async def async_browse(self, directory: str) -> dict[str, Any]:
        """The sub-folders of a folder of the configuration folder, for the folder picker."""
        return await self.hass.async_add_executor_job(browse, self.hass.config.config_dir, directory, self.max_age)

    def state(self) -> dict[str, Any]:
        """The settings and the last purge, for the panel."""
        return {
            CONF_DIRECTORIES: self.directories,
            CONF_MAX_AGE: self.max_age,
            "last_run": self.last_run.isoformat() if self.last_run else None,
            "last_files": self.last_files,
            "last_bytes": self.last_bytes,
            "last_errors": self.last_errors,
            "running": self.running,
        }

    @staticmethod
    async def async_remove_store(hass: HomeAssistant) -> None:
        await Store(hass, STORAGE_VERSION, STORAGE_KEY).async_remove()
