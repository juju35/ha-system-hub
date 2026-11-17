"""The database's size, read every 15 minutes for its sensor, so that the recorder keeps its history."""

from __future__ import annotations

import logging
from collections.abc import Callable
from datetime import datetime, timedelta
from typing import Final

from homeassistant.const import EVENT_HOMEASSISTANT_STARTED
from homeassistant.core import CoreState, Event, HomeAssistant, callback
from homeassistant.helpers.event import async_track_time_interval
from homeassistant.util import dt as dt_util

from . import RECORDER_DOMAIN, async_size, engine

_LOGGER = logging.getLogger(__name__)

INTERVAL: Final = timedelta(minutes=15)


class DatabaseMonitor:
    """The size of the recorder's database (SQLite file, MariaDB / MySQL schema, PostgreSQL database)."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self.size: int | None = None
        self.engine: str | None = None
        self.last_update: datetime | None = None
        self._listeners: list[Callable[[], None]] = []
        self._unsubs: list[Callable[[], None]] = []

    @callback
    def async_add_listener(self, update: Callable[[], None]) -> Callable[[], None]:
        self._listeners.append(update)
        return lambda: self._listeners.remove(update)

    async def async_start(self) -> None:
        """Read at once once Home Assistant runs (the recorder's database is ready then), then every 15 minutes."""
        if self.hass.state is CoreState.running:
            await self.async_refresh()
        else:

            async def _started(_event: Event) -> None:
                await self.async_refresh()

            self._unsubs.append(self.hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STARTED, _started))
        self._unsubs.append(async_track_time_interval(self.hass, self._tick, INTERVAL))

    @callback
    def async_stop(self) -> None:
        while self._unsubs:
            try:
                self._unsubs.pop()()
            except ValueError:
                # The start listener already fired
                pass

    async def _tick(self, _now: datetime) -> None:
        await self.async_refresh()

    async def async_refresh(self) -> None:
        if RECORDER_DOMAIN not in self.hass.config.components:
            return
        from homeassistant.components.recorder import get_instance  # noqa: PLC0415

        try:
            instance = get_instance(self.hass)
            self.engine = engine(instance)
            self.size = await async_size(self.hass, instance)
        except Exception as err:  # noqa: BLE001 - the sensor is unknown until the next read
            _LOGGER.debug("Database size not read: %s", err)
            self.size = None
        self.last_update = dt_util.utcnow()
        for update in list(self._listeners):
            update()
