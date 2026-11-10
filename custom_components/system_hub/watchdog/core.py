"""Find the integrations whose entities are all unavailable, and reload them.

An integration (config entry) is unavailable when it is loaded or its setup failed, has at least one enabled
entity with a state, and every one of these entities is `unavailable`. It is reloaded once
the most recent of these entities has been unavailable for the grace period.

Nothing is reloaded while Home Assistant is starting or stopping. Helpers (template, group,
utility meter...) are left out: their entities follow their sources, a reload can't fix them.
An integration that stays unavailable is reloaded at most `max_reloads` times in a row, the delay
between two reloads doubling each time (grace, 2 x grace, 4 x grace...); once the delay after the
last one has passed, the watchdog gives up on it until it has been available again for the current
delay. Every reload, and giving up, is notified; giving up also raises a Repairs issue, deleted once
the integration has recovered (or is removed or disabled), whose "Try again" (like the reset action)
starts over and reloads it at once. The counts are saved with the history, so a restart keeps them.

A device can also be associated with the smart plug that powers it (power cycles): once all its enabled
entities have been unavailable for its own delay, the plug is switched off, then on again after a few
seconds, with the same rules (no cycle during the start, pause entity, doubling delay, limit, notifications).
A plug that is off (on purpose) or unavailable is left alone, and a plug switched off by the watchdog is always
switched on again, after a restart of Home Assistant too.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Callable, Iterable
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

from homeassistant.components import persistent_notification
from homeassistant.config_entries import ConfigEntry, ConfigEntryChange, ConfigEntryState
from homeassistant.const import (
    ATTR_ENTITY_ID,
    SERVICE_TURN_OFF,
    SERVICE_TURN_ON,
    STATE_OFF,
    STATE_ON,
    STATE_UNAVAILABLE,
)
from homeassistant.core import CALLBACK_TYPE, CoreState, HomeAssistant, State, callback
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers import issue_registry as ir
from homeassistant.helpers.storage import Store
from homeassistant.helpers.translation import async_get_translations
from homeassistant.loader import async_get_integrations
from homeassistant.util import dt as dt_util

from ..const import DOMAIN
from .const import EVENT_POWER_CYCLED, EVENT_RELOADED, HISTORY_SIZE, STORAGE_KEY, STORAGE_VERSION

_LOGGER = logging.getLogger(__name__)

# Entries checked: loaded, or whose setup failed (Home Assistant retries those with a growing delay,
# or not at all after an error; a reload retries right away). Disabled or not loaded ones are left alone.
WATCHED_STATES = (
    ConfigEntryState.LOADED,
    ConfigEntryState.SETUP_RETRY,
    ConfigEntryState.SETUP_ERROR,
)

# Seconds a change of the history or the counts waits before being written, so that a check reloading several
# integrations writes it once.
HISTORY_SAVE_DELAY = 10
# Kinds of the history items: the notification sent for each.
HISTORY_KINDS = ("reloaded", "reload_failed", "gave_up", "power_cycled", "power_cycle_failed", "power_cycle_gave_up")

# A reload or a notify action that doesn't return within this time counts as failed, so that
# a hung integration can't keep the check (and its lock) busy forever.
RELOAD_TIMEOUT = timedelta(minutes=5)
NOTIFY_TIMEOUT = timedelta(seconds=30)
# Same for switching a plug off or on.
SWITCH_TIMEOUT = timedelta(seconds=30)
# How a power cycle waits with the plug off (replaced in the tests).
_sleep = asyncio.sleep


@dataclass(frozen=True)
class UnavailableIntegration:
    """A loaded config entry whose entities are all unavailable."""

    entry_id: str
    domain: str
    title: str
    since: datetime


@dataclass(frozen=True)
class PowerCycle:
    """A device and the smart plug that powers it."""

    device_id: str
    switch: str
    # All the device's entities unavailable for this long: the plug is switched off then on.
    delay: timedelta
    # How long the plug stays off.
    off_time: timedelta


@dataclass(frozen=True)
class UnavailableDevice:
    """A device of a power cycle whose entities are all unavailable.

    entry_id, domain and title are those of the history items (its main config entry, its name), so that the card
    shows it like an integration.
    """

    device_id: str
    entry_id: str
    domain: str
    title: str
    since: datetime


@dataclass
class Attempts:
    """Reloads in a row of an integration that stays unavailable."""

    count: int = 0
    last: datetime | None = None
    gave_up: bool = False
    # First check that found the integration available again, None while it is unavailable.
    recovered_at: datetime | None = None

    def as_dict(self) -> dict[str, Any]:
        """JSON form, saved with the history and shown in the diagnostics."""
        return {
            "count": self.count,
            "last": self.last.isoformat() if self.last else None,
            "gave_up": self.gave_up,
            "recovered_at": self.recovered_at.isoformat() if self.recovered_at else None,
        }

    @classmethod
    def from_dict(cls, data: Any) -> Attempts | None:
        """Read what as_dict wrote; None when it is malformed."""
        if not isinstance(data, dict):
            return None
        count, gave_up = data.get("count"), data.get("gave_up")
        if not isinstance(count, int) or isinstance(count, bool) or count < 0 or not isinstance(gave_up, bool):
            return None
        dates: list[datetime | None] = []
        for key in ("last", "recovered_at"):
            value = data.get(key)
            if value is None:
                dates.append(None)
            elif not isinstance(value, str) or (parsed := dt_util.parse_datetime(value)) is None:
                return None
            else:
                dates.append(parsed)
        return cls(count, dates[0], gave_up, dates[1])


@dataclass(frozen=True)
class Reload:
    """A reload done by the watchdog."""

    entry_id: str
    domain: str
    title: str
    success: bool
    at: datetime


class IntegrationWatchdog:
    """Runs the checks and keeps their result for the entities."""

    def __init__(
        self,
        hass: HomeAssistant,
        ignored: Iterable[str],
        grace_period: timedelta,
        max_reloads: int,
        notify_services: Iterable[str] = (),
        shared: dict[str, Any] | None = None,
        ignored_entries: Iterable[str] = (),
        pause_entity: str | None = None,
        grace_overrides: dict[str, timedelta] | None = None,
        power_cycles: Iterable[PowerCycle] = (),
    ) -> None:
        self.hass = hass
        self.power_cycles: list[PowerCycle] = list(power_cycles)
        # While this entity is on, nothing is reloaded (the checks still list the unavailable integrations).
        self.pause_entity = pause_entity
        self.ignored: frozenset[str] = frozenset(ignored) | {DOMAIN}
        # Single config entries never reloaded (one camera of an integration whose others are watched).
        self.ignored_entries: frozenset[str] = frozenset(ignored_entries)
        self.grace_period = grace_period
        # Per integration domain (a slow Zigbee network, a cloud that takes its time): its own grace period.
        self.grace_overrides: dict[str, timedelta] = dict(grace_overrides or {})
        self.max_reloads = max_reloads
        self.notify_services = list(notify_services)
        self.unavailable: list[UnavailableIntegration] = []
        # Kept by __init__ across reloads of the watchdog's entry (options changed), with the lock:
        # an integration given up stays so, and a check still running in the previous instance
        # keeps the new one waiting instead of reloading the same entries twice.
        shared = shared if shared is not None else {}
        self._shared = shared
        shared.setdefault("checks", 0)
        # The reload count and the last reload too, so that the sensor doesn't start over at each options change.
        shared.setdefault("reloads", 0)
        self.attempts: dict[str, Attempts] = shared.setdefault("attempts", {})
        # The same per device, for the power cycles, and the plugs switched off and not switched on again yet
        # (Home Assistant stopped during a power cycle): switched on at the next check.
        self.cycle_attempts: dict[str, Attempts] = shared.setdefault("cycle_attempts", {})
        self.powered_off: set[str] = shared.setdefault("powered_off", set())
        # Recent reloads and give-ups for the card, newest first, and the counts above: loaded from storage by
        # async_load (once per Home Assistant run, then shared).
        self.history: list[dict[str, Any]] = shared.setdefault("history", [])
        self._store: Store[dict[str, Any]] = shared.setdefault("store", Store(hass, STORAGE_VERSION, STORAGE_KEY))
        self.last_check: datetime | None = None
        # When Home Assistant finished starting: nothing is reloaded before the grace period has
        # passed since then, whatever the states say. None until it has started; set far in the
        # past when the watchdog itself is set up later (options changed, update installed).
        self.started_at: datetime | None = (
            datetime.min.replace(tzinfo=dt_util.UTC) if hass.state is CoreState.running else None
        )
        # Integration domains whose integration_type is "helper", and those known not to be.
        self._helpers: dict[str, bool] = {}
        self._lock: asyncio.Lock = shared.setdefault("lock", asyncio.Lock())
        self._listeners: list[CALLBACK_TYPE] = []
        # Set when the watchdog's entry is unloaded: a check still running stops reloading.
        self._stopped = False

    @property
    def paused(self) -> bool:
        """The pause entity is on: maintenance, a planned outage, the night."""
        return bool(self.pause_entity) and self.hass.states.is_state(self.pause_entity, STATE_ON)

    @property
    def running(self) -> bool:
        return self._lock.locked()

    @property
    def reloads(self) -> int:
        """Reloads done since Home Assistant started."""
        return self._shared["reloads"]

    @property
    def last_reload(self) -> Reload | None:
        return self._shared.get("last_reload")

    async def async_load(self) -> None:
        """Read the history and the counts saved by a previous run of Home Assistant, once."""
        if self._shared.get("history_loaded"):
            return
        self._shared["history_loaded"] = True
        try:
            data = await self._store.async_load()
        except Exception:  # noqa: BLE001 - a broken file must not prevent the watchdog from starting
            _LOGGER.exception("Could not read the reload history: starting a new one")
            return
        if not isinstance(data, dict):
            return
        items = data.get("history")
        if isinstance(items, list):
            valid = [i for i in items if _valid_history_item(i)]
            # Items recorded since the start (before the file was read) stay first.
            self.history.extend(valid[: max(HISTORY_SIZE - len(self.history), 0)])
        dropped = self._load_cycles(data)
        saved = data.get("attempts")
        if not isinstance(saved, dict):
            if dropped:
                self._save()
            return
        for entry_id, value in saved.items():
            attempts = Attempts.from_dict(value)
            entry = self.hass.config_entries.async_get_entry(entry_id)
            # Removed while Home Assistant was stopped (or malformed): forgotten.
            if attempts is None or entry is None:
                dropped = True
                continue
            if entry_id in self.attempts:
                continue
            self.attempts[entry_id] = attempts
            # The Repairs issue is not persistent: raised again for an integration still given up.
            if attempts.gave_up:
                self._create_issue(entry_id, entry.title, entry.domain, attempts.count)
        if dropped:
            self._save()

    def _load_cycles(self, data: dict[str, Any]) -> bool:
        """The power cycle counts and the plugs left off; True when some were dropped (malformed, device removed)."""
        dropped = False
        powered_off = data.get("powered_off")
        if isinstance(powered_off, list):
            self.powered_off.update(s for s in powered_off if isinstance(s, str))
        saved = data.get("power_cycles")
        if not isinstance(saved, dict):
            return dropped
        devices = dr.async_get(self.hass)
        for device_id, value in saved.items():
            attempts = Attempts.from_dict(value)
            if attempts is None or devices.async_get(device_id) is None:
                dropped = True
                continue
            self.cycle_attempts.setdefault(device_id, attempts)
        return dropped

    def _saved_data(self) -> dict[str, Any]:
        return {
            "history": list(self.history),
            "attempts": {entry_id: attempts.as_dict() for entry_id, attempts in self.attempts.items()},
            "power_cycles": {device_id: attempts.as_dict() for device_id, attempts in self.cycle_attempts.items()},
            "powered_off": sorted(self.powered_off),
        }

    def _counts(self) -> dict[str, Any]:
        """The counts saved with the history, to tell whether a check changed them."""
        return {
            "attempts": {entry_id: attempts.as_dict() for entry_id, attempts in self.attempts.items()},
            "power_cycles": {device_id: attempts.as_dict() for device_id, attempts in self.cycle_attempts.items()},
        }

    @callback
    def _save(self) -> None:
        """Write the history and the counts a little later."""
        self._store.async_delay_save(self._saved_data, HISTORY_SAVE_DELAY)

    @callback
    def _create_issue(self, entry_id: str, title: str, domain: str, attempt: int) -> None:
        """The Repairs issue of an integration given up, with its "Try again" (see repairs.py)."""
        ir.async_create_issue(
            self.hass,
            DOMAIN,
            issue_id(entry_id),
            is_fixable=True,
            severity=ir.IssueSeverity.WARNING,
            translation_key="watchdog_gave_up",
            translation_placeholders={"title": title, "domain": domain, "attempt": str(attempt)},
            data={"entry_id": entry_id},
        )

    @callback
    def _record(
        self, kind: str, item: UnavailableIntegration | UnavailableDevice, attempt: int, at: datetime, **extra: Any
    ) -> None:
        """Add a reload, a power cycle or a give-up to the history, newest first, and save it a little later."""
        self.history.insert(
            0,
            {
                "kind": kind,
                "at": at.isoformat(),
                "entry_id": item.entry_id,
                "domain": item.domain,
                "title": item.title,
                "attempt": attempt,
                "max_reloads": self.max_reloads,
                "unavailable_since": item.since.isoformat(),
                **extra,
            },
        )
        del self.history[HISTORY_SIZE:]
        self._save()

    @callback
    def async_stop(self) -> None:
        """Stop a check still running: the watchdog's entry is being unloaded or removed."""
        self._stopped = True

    @callback
    def async_entry_changed(self, _change: ConfigEntryChange, entry: ConfigEntry) -> None:
        """Forget the reloads of an entry disabled by the user: once enabled again, it starts over.

        Done on the change itself: disabling then enabling again usually takes less than a check interval.
        """
        if entry.disabled_by is not None:
            self._forget(entry.entry_id)

    @callback
    def _forget(self, entry_id: str) -> None:
        """Start over for an entry: recovered, removed, disabled or reset.

        Its Repairs issue and its notification, if any, go too.
        """
        if self.attempts.pop(entry_id, None) is not None:
            self._save()
        ir.async_delete_issue(self.hass, DOMAIN, issue_id(entry_id))
        persistent_notification.async_dismiss(self.hass, notification_id(entry_id))

    async def async_reset(self, entry_id: str) -> bool:
        """Start over for an entry and reload it now (Repairs "Try again", the reset action).

        Waits for a check still running, so that both don't reload it at once. Returns whether the reload succeeded.
        """
        async with self._lock:
            self._forget(entry_id)
            entry = self.hass.config_entries.async_get_entry(entry_id)
            success = False
            if entry is not None:
                _LOGGER.info("Reset of %s (%s): reloading it", entry.title, entry.domain)
                success = await self._async_timed_reload(entry_id, entry.title, entry.domain)
                # async_reload returning False (setup failed) is not logged by _async_timed_reload: the Repairs
                # flow, which no longer waits for the result, tells to look here.
                if not success:
                    _LOGGER.warning("Reset of %s (%s): the reload failed", entry.title, entry.domain)
            self.unavailable = self.async_find_unavailable()
        self._notify_listeners()
        return success

    @callback
    def async_add_listener(self, update_callback: CALLBACK_TYPE) -> Callable[[], None]:
        self._listeners.append(update_callback)
        return lambda: self._listeners.remove(update_callback)

    @callback
    def _notify_listeners(self) -> None:
        for listener in list(self._listeners):
            listener()

    def as_dict(self, item: UnavailableIntegration) -> dict[str, Any]:
        attempts = self.attempts.get(item.entry_id, Attempts())
        return {
            "domain": item.domain,
            "title": item.title,
            "entry_id": item.entry_id,
            "since": item.since.isoformat(),
            "reloads": attempts.count,
            "gave_up": attempts.gave_up,
        }

    async def _async_load_helpers(self) -> None:
        """Learn the integration type of the domains not seen yet."""
        domains = {e.domain for e in self.hass.config_entries.async_entries()} - self._helpers.keys()
        if not domains:
            return
        for domain, integration in (await async_get_integrations(self.hass, domains)).items():
            self._helpers[domain] = not isinstance(integration, Exception) and integration.integration_type == "helper"

    @callback
    def async_find_unavailable(self) -> list[UnavailableIntegration]:
        """Watched, not ignored, not helper config entries whose entities are all unavailable."""
        registry = er.async_get(self.hass)
        found: list[UnavailableIntegration] = []
        for entry in self.hass.config_entries.async_entries():
            if (
                entry.domain in self.ignored
                or entry.entry_id in self.ignored_entries
                or entry.state not in WATCHED_STATES
                or self._helpers.get(entry.domain)
            ):
                continue
            states = []
            for entity in er.async_entries_for_config_entry(registry, entry.entry_id):
                if entity.disabled:
                    continue
                state = self.hass.states.get(entity.entity_id)
                if state is None:
                    continue
                # This keeps the entities the integration hasn't created (device off, connection lost at
                # setup): they hold an "unavailable" placeholder state with `restored: true` and count
                # as unavailable too.
                states.append(state)
            if not states or any(s.state != STATE_UNAVAILABLE for s in states):
                continue
            found.append(
                UnavailableIntegration(
                    entry_id=entry.entry_id,
                    domain=entry.domain,
                    title=entry.title,
                    since=max(s.last_changed for s in states),
                )
            )
        return sorted(found, key=lambda u: (u.domain, u.title))

    @callback
    def _has_available_entity(self, entry: ConfigEntry) -> bool:
        """A watched entry with at least one enabled entity whose state is not unavailable."""
        if entry.state not in WATCHED_STATES:
            return False
        for entity in er.async_entries_for_config_entry(er.async_get(self.hass), entry.entry_id):
            if entity.disabled:
                continue
            state = self.hass.states.get(entity.entity_id)
            if state is not None and state.state != STATE_UNAVAILABLE:
                return True
        return False

    async def async_check(self, wait: bool = False) -> None:
        """Find the unavailable integrations and reload those that are due.

        While a check is running, a scheduled one is skipped; with `wait` (the action, the first
        check after a reload of the watchdog), it runs once the running one has ended.
        """
        if self.hass.state is not CoreState.running:
            _LOGGER.debug("Home Assistant is not running (%s): no check", self.hass.state)
            return
        if self._lock.locked() and not wait:
            _LOGGER.debug("A check is already running")
            return
        seen = self._shared["checks"]
        saved = self._counts()
        try:
            async with self._lock:
                if self.hass.state is not CoreState.running or self._stopped:
                    return
                # A scheduled check can see the lock free right after a release and still queue behind a
                # waiting one: a check done since the counter was read above means it already ran, skip it.
                if not wait and self._shared["checks"] != seen:
                    _LOGGER.debug("A check ran while this one was waiting for the lock")
                    return
                self._shared["checks"] += 1
                self._notify_listeners()
                try:
                    await self._async_check()
                finally:
                    self.last_check = dt_util.utcnow()
        finally:
            # The counts changed (reload, give-up, recovery): saved so that a restart keeps them.
            if saved != self._counts():
                self._save()
            # Also after an unexpected error: the entities (and the button, available again) must not stay stale.
            self._notify_listeners()

    async def _async_check(self) -> None:
        """The check itself, run under the lock."""
        await self._async_restore_power()
        await self._async_load_helpers()
        self.unavailable = self.async_find_unavailable()
        # An integration available again starts over, once it has stayed so for its current
        # delay, counted from the first check that found it back: one that comes back for a
        # moment and falls again keeps its count.
        now = dt_util.utcnow()
        current = {u.entry_id for u in self.unavailable}
        for entry_id, attempts in list(self.attempts.items()):
            if entry_id in current:
                attempts.recovered_at = None
                continue
            entry = self.hass.config_entries.async_get_entry(entry_id)
            # Removed, or disabled by the user (also forgotten as soon as it is disabled, see
            # async_entry_changed): once enabled again, it starts over.
            if entry is None or entry.disabled_by is not None:
                self._forget(entry_id)
                continue
            # Out of the list is not available again: a setup or unload still in progress (a reload past
            # its timeout), or no entity with an available state. Left as it is.
            if not self._has_available_entity(entry):
                continue
            if attempts.recovered_at is None:
                attempts.recovered_at = now
            if attempts.count == 0 or now - attempts.recovered_at >= self._delay(attempts, entry.domain):
                self._forget(entry_id)
        for item in self.unavailable:
            # Stop as soon as Home Assistant starts stopping, or the watchdog is unloaded or removed.
            if self.hass.state is not CoreState.running or self._stopped:
                break
            try:
                await self._async_handle(item)
            except Exception:  # noqa: BLE001 - one integration must not stop the check of the others
                _LOGGER.exception("Handling %s (%s) failed", item.title, item.domain)
        await self._async_power_cycles()
        self.unavailable = self.async_find_unavailable()

    async def _async_handle(self, item: UnavailableIntegration) -> None:
        now = dt_util.utcnow()
        attempts = self.attempts.setdefault(item.entry_id, Attempts())
        grace = self.grace(item.domain)
        # After a start, the global grace period applies to all (the time for Home Assistant to settle).
        if self.started_at is None or now - item.since < grace or now - self.started_at < self.grace_period:
            return
        if self.paused:
            _LOGGER.debug("%s (%s) not reloaded: paused by %s", item.title, item.domain, self.pause_entity)
            return
        # The last reload gets its full delay too before giving up.
        if attempts.last is not None and now - attempts.last < self._delay(attempts, item.domain):
            return
        if attempts.count >= self.max_reloads:
            if not attempts.gave_up:
                attempts.gave_up = True
                _LOGGER.warning(
                    "%s (%s) is still unavailable after %d reloads: not reloading it again until it recovers",
                    item.title,
                    item.domain,
                    attempts.count,
                )
                self._record("gave_up", item, attempts.count, now)
                self._create_issue(item.entry_id, item.title, item.domain, attempts.count)
                await self._async_send("gave_up", item, attempts.count)
            return
        # Given up with a lower limit, before the options were changed: reloaded again up to the new one.
        if attempts.gave_up:
            attempts.gave_up = False
            ir.async_delete_issue(self.hass, DOMAIN, issue_id(item.entry_id))
        await self._async_reload(item, attempts)

    def grace(self, domain: str) -> timedelta:
        """Grace period of an integration: its own one when set, else the global one."""
        return self.grace_overrides.get(domain, self.grace_period)

    def _delay(self, attempts: Attempts, domain: str) -> timedelta:
        """Minimum time after a reload before the next one: grace, 2 x grace, 4 x grace..."""
        return self.grace(domain) * 2 ** max(attempts.count - 1, 0)

    @staticmethod
    def _log_late_reload(task: asyncio.Task, title: str, domain: str) -> None:
        """Log the failure of a reload that finished after its timeout."""
        if task.cancelled() or (err := task.exception()) is None:
            return
        _LOGGER.error(
            "Reloading %s (%s) failed after its timeout",
            title,
            domain,
            exc_info=(type(err), err, err.__traceback__),
        )

    async def _async_timed_reload(self, entry_id: str, title: str, domain: str) -> bool:
        """Reload a config entry within RELOAD_TIMEOUT; a timeout or an error is a failure."""
        # Shielded: on timeout the check goes on, the reload itself isn't cancelled halfway.
        task = self.hass.async_create_background_task(
            self.hass.config_entries.async_reload(entry_id), f"{DOMAIN} watchdog reload {entry_id}"
        )
        try:
            async with asyncio.timeout(RELOAD_TIMEOUT.total_seconds()):
                return bool(await asyncio.shield(task))
        except TimeoutError:
            _LOGGER.warning(
                "Reloading %s (%s) didn't finish within %s: counted as failed", title, domain, RELOAD_TIMEOUT
            )
            # Nobody awaits the shielded reload any more: read its outcome so that a late failure is logged
            # here instead of asyncio's "Task exception was never retrieved".
            task.add_done_callback(lambda t: self._log_late_reload(t, title, domain))
        except Exception:  # noqa: BLE001 - one broken integration must not stop the watchdog
            _LOGGER.exception("Reloading %s (%s) failed", title, domain)
        return False

    async def _async_reload(self, item: UnavailableIntegration, attempts: Attempts) -> None:
        entry: ConfigEntry | None = self.hass.config_entries.async_get_entry(item.entry_id)
        if entry is None or entry.state not in WATCHED_STATES:
            return
        # The unavailable list is a snapshot taken at the start of the check, and the earlier reloads
        # of this check may have taken minutes: skip one that has become available again since.
        if self._has_available_entity(entry):
            return
        _LOGGER.warning(
            "Reloading %s (%s): all its entities are unavailable since %s",
            item.title,
            item.domain,
            item.since.isoformat(),
        )
        success = await self._async_timed_reload(item.entry_id, item.title, item.domain)
        attempts.count += 1
        attempts.last = dt_util.utcnow()
        self._shared["reloads"] += 1
        self._shared["last_reload"] = Reload(item.entry_id, item.domain, item.title, success, attempts.last)
        self._record("reloaded" if success else "reload_failed", item, attempts.count, attempts.last)
        self.hass.bus.async_fire(
            EVENT_RELOADED,
            {
                "entry_id": item.entry_id,
                "domain": item.domain,
                "title": item.title,
                "success": success,
                "unavailable_since": item.since.isoformat(),
                "attempt": attempts.count,
                "max_reloads": self.max_reloads,
            },
        )
        await self._async_send("reloaded" if success else "reload_failed", item, attempts.count)

    # Power cycles

    @callback
    def _device_states(self, cycle: PowerCycle) -> list[State]:
        """States of the device's enabled entities, its plug left out (it may be on the device it powers)."""
        states = []
        for entity in er.async_entries_for_device(er.async_get(self.hass), cycle.device_id):
            if entity.disabled or entity.entity_id == cycle.switch:
                continue
            if (state := self.hass.states.get(entity.entity_id)) is not None:
                states.append(state)
        return states

    @callback
    def async_find_unavailable_devices(self) -> list[tuple[PowerCycle, UnavailableDevice]]:
        """The devices of the power cycles whose enabled entities (with a state) are all unavailable."""
        devices = dr.async_get(self.hass)
        found = []
        for cycle in self.power_cycles:
            device = devices.async_get(cycle.device_id)
            states = self._device_states(cycle) if device is not None and not device.disabled else []
            if not states or any(s.state != STATE_UNAVAILABLE for s in states):
                continue
            entry_id = _device_entry_id(device)
            entry = self.hass.config_entries.async_get_entry(entry_id) if entry_id else None
            found.append(
                (
                    cycle,
                    UnavailableDevice(
                        device_id=cycle.device_id,
                        entry_id=entry_id,
                        domain=entry.domain if entry else "",
                        title=device.name_by_user or device.name or cycle.device_id,
                        since=max(s.last_changed for s in states),
                    ),
                )
            )
        return found

    @callback
    def _forget_device(self, device_id: str) -> None:
        """Start over for the power cycles of a device: recovered, removed, or no longer configured."""
        if self.cycle_attempts.pop(device_id, None) is not None:
            self._save()
        persistent_notification.async_dismiss(self.hass, device_notification_id(device_id))

    @staticmethod
    def _cycle_delay(attempts: Attempts, cycle: PowerCycle) -> timedelta:
        """Minimum time after a power cycle before the next one: delay, 2 x delay, 4 x delay..."""
        return cycle.delay * 2 ** max(attempts.count - 1, 0)

    async def _async_power_cycles(self) -> None:
        """Power cycle the devices due, and start over for those available again."""
        configured = {cycle.device_id: cycle for cycle in self.power_cycles}
        unavailable = self.async_find_unavailable_devices()
        current = {cycle.device_id for cycle, _ in unavailable}
        now = dt_util.utcnow()
        devices = dr.async_get(self.hass)
        for device_id, attempts in list(self.cycle_attempts.items()):
            cycle = configured.get(device_id)
            if cycle is None or devices.async_get(device_id) is None:
                self._forget_device(device_id)
                continue
            if device_id in current:
                attempts.recovered_at = None
                continue
            # Available again only with an entity whose state is not unavailable (not a device without states).
            if not any(s.state != STATE_UNAVAILABLE for s in self._device_states(cycle)):
                continue
            if attempts.recovered_at is None:
                attempts.recovered_at = now
            if attempts.count == 0 or now - attempts.recovered_at >= self._cycle_delay(attempts, cycle):
                self._forget_device(device_id)
        for cycle, item in unavailable:
            if self.hass.state is not CoreState.running or self._stopped:
                break
            try:
                await self._async_handle_device(cycle, item)
            except Exception:  # noqa: BLE001 - one device must not stop the others
                _LOGGER.exception("Power cycling %s (%s) failed", item.title, cycle.switch)

    async def _async_handle_device(self, cycle: PowerCycle, item: UnavailableDevice) -> None:
        now = dt_util.utcnow()
        if self.started_at is None or now - item.since < cycle.delay or now - self.started_at < self.grace_period:
            return
        if self.paused:
            _LOGGER.debug("%s not power cycled: paused by %s", item.title, self.pause_entity)
            return
        # Off (on purpose: the device is unavailable because it isn't powered) or unavailable: left alone.
        if not self.hass.states.is_state(cycle.switch, STATE_ON):
            _LOGGER.debug("%s not power cycled: %s is not on", item.title, cycle.switch)
            return
        attempts = self.cycle_attempts.setdefault(cycle.device_id, Attempts())
        if attempts.last is not None and now - attempts.last < self._cycle_delay(attempts, cycle):
            return
        switch_name = self._switch_name(cycle.switch)
        if attempts.count >= self.max_reloads:
            if not attempts.gave_up:
                attempts.gave_up = True
                _LOGGER.warning(
                    "%s is still unavailable after %d power cycles: not switching %s off again until it recovers",
                    item.title,
                    attempts.count,
                    cycle.switch,
                )
                self._record("power_cycle_gave_up", item, attempts.count, now, **self._cycle_extra(cycle, switch_name))
                await self._async_send(
                    "power_cycle_gave_up",
                    item,
                    attempts.count,
                    device_notification_id(cycle.device_id),
                    switch=switch_name,
                )
            return
        attempts.gave_up = False
        _LOGGER.warning(
            "Power cycling %s with %s: all its entities are unavailable since %s",
            item.title,
            cycle.switch,
            item.since.isoformat(),
        )
        success = await self._async_power_cycle(cycle)
        attempts.count += 1
        attempts.last = dt_util.utcnow()
        kind = "power_cycled" if success else "power_cycle_failed"
        self._record(kind, item, attempts.count, attempts.last, **self._cycle_extra(cycle, switch_name))
        self.hass.bus.async_fire(
            EVENT_POWER_CYCLED,
            {
                "device_id": cycle.device_id,
                "name": item.title,
                "switch": cycle.switch,
                "success": success,
                "unavailable_since": item.since.isoformat(),
                "attempt": attempts.count,
                "max_reloads": self.max_reloads,
            },
        )
        await self._async_send(kind, item, attempts.count, device_notification_id(cycle.device_id), switch=switch_name)

    @staticmethod
    def _cycle_extra(cycle: PowerCycle, switch_name: str) -> dict[str, str]:
        """The history fields of a power cycle, besides those of a reload."""
        return {"device_id": cycle.device_id, "switch": cycle.switch, "switch_name": switch_name}

    @callback
    def _switch_name(self, switch: str) -> str:
        state = self.hass.states.get(switch)
        return state.name if state is not None else switch

    async def _async_switch(self, service: str, switch: str) -> bool:
        """Switch a plug off or on within SWITCH_TIMEOUT; a timeout or an error is a failure."""
        # Shielded: switching on must go through even if the check is cancelled (Home Assistant stopping).
        task = self.hass.async_create_background_task(
            self.hass.services.async_call("switch", service, {ATTR_ENTITY_ID: switch}, blocking=True),
            f"{DOMAIN} {service} {switch}",
        )
        try:
            async with asyncio.timeout(SWITCH_TIMEOUT.total_seconds()):
                await asyncio.shield(task)
        except TimeoutError:
            _LOGGER.warning("%s of %s didn't finish within %s", service, switch, SWITCH_TIMEOUT)
        except Exception:  # noqa: BLE001 - a broken plug must not stop the watchdog
            _LOGGER.exception("%s of %s failed", service, switch)
        else:
            return True
        return False

    async def _async_save_now(self) -> None:
        try:
            await self._store.async_save(self._saved_data())
        except Exception:  # noqa: BLE001 - the power cycle goes on, the delayed write tries again
            _LOGGER.exception("Could not save the plugs switched off")
            self._save()

    async def _async_power_cycle(self, cycle: PowerCycle) -> bool:
        """Switch the plug off, wait, switch it on again (always, even when switching off failed or on a cancel)."""
        # Written at once: a plug left off by a restart during the power cycle is switched on at the next start.
        self.powered_off.add(cycle.switch)
        await self._async_save_now()
        success = False
        try:
            if await self._async_switch(SERVICE_TURN_OFF, cycle.switch):
                await _sleep(cycle.off_time.total_seconds())
                success = True
        finally:
            success = await self._async_switch_on(cycle.switch) and success
        return success

    async def _async_switch_on(self, switch: str) -> bool:
        """Switch a plug on again; once done, it is no longer in the plugs left off."""
        if not await self._async_switch(SERVICE_TURN_ON, switch):
            return False
        self.powered_off.discard(switch)
        self._save()
        return True

    async def _async_restore_power(self) -> None:
        """Switch on the plugs a power cycle left off (Home Assistant stopped meanwhile), once they are back."""
        for switch in sorted(self.powered_off):
            state = self.hass.states.get(switch)
            if state is None or state.state == STATE_UNAVAILABLE:
                continue
            if state.state == STATE_OFF:
                _LOGGER.warning("Switching %s on again: a power cycle was interrupted", switch)
                await self._async_switch_on(switch)
            else:
                self.powered_off.discard(switch)
                self._save()

    async def _async_send(
        self,
        key: str,
        item: UnavailableIntegration | UnavailableDevice,
        attempt: int,
        notification: str | None = None,
        **extra: str,
    ) -> None:
        """Persistent notification (one per integration or device, replaced), and the notify services chosen."""
        strings = await async_get_translations(self.hass, self.hass.config.language, "common", [DOMAIN])
        placeholders = {
            "title": item.title,
            "domain": item.domain,
            "since": dt_util.as_local(item.since).strftime("%Y-%m-%d %H:%M"),
            "attempt": str(attempt),
            "max": str(self.max_reloads),
            **extra,
        }

        def text(name: str) -> str:
            template = strings.get(f"component.{DOMAIN}.common.watchdog_{name}")
            if template is None:
                _LOGGER.warning("Missing notification translation %s: using the key itself", name)
                return name
            # A translation with an unknown placeholder or a stray brace must not abort the check.
            try:
                return template.format(**placeholders)
            except (KeyError, IndexError, ValueError):
                _LOGGER.warning("Invalid placeholders in the %s translation: %r", name, template)
                return template

        title, message = text(f"{key}_title"), text(key)
        persistent_notification.async_create(
            self.hass, message, title=title, notification_id=notification or notification_id(item.entry_id)
        )
        for service in self.notify_services:
            name = service.removeprefix("notify.")
            if not self.hass.services.has_service("notify", name):
                _LOGGER.warning("Notify action notify.%s not found", name)
                continue
            try:
                async with asyncio.timeout(NOTIFY_TIMEOUT.total_seconds()):
                    await self.hass.services.async_call(
                        "notify", name, {"title": title, "message": message}, blocking=True
                    )
            except TimeoutError:
                _LOGGER.warning("Sending the notification with notify.%s didn't finish within %s", name, NOTIFY_TIMEOUT)
            except Exception:  # noqa: BLE001 - a broken notifier must not stop the watchdog
                _LOGGER.exception("Sending the notification with notify.%s failed", name)


def issue_id(entry_id: str) -> str:
    """Repairs issue raised when the watchdog gives up on a config entry."""
    return f"watchdog_gave_up_{entry_id}"


def _device_entry_id(device: dr.DeviceEntry) -> str:
    """The config entry of a device: `config_entry_id` from Home Assistant 2026.11 (one entry per device), before
    that `primary_config_entry` (deprecated since), then any of `config_entries`."""
    entry_id = getattr(device, "config_entry_id", _MISSING)
    if entry_id is not _MISSING:
        return entry_id or ""
    return getattr(device, "primary_config_entry", None) or next(iter(device.config_entries), "")


_MISSING = object()


def device_notification_id(device_id: str) -> str:
    """Persistent notification of the power cycles of a device (one per device, replaced)."""
    return f"{DOMAIN}_watchdog_device_{device_id}"


def notification_id(entry_id: str) -> str:
    """Persistent notification of the reloads of a config entry (one per entry, replaced, dismissed by _forget)."""
    return f"{DOMAIN}_watchdog_{entry_id}"


def _valid_history_item(item: Any) -> bool:
    """A history item as written by _record: the card relies on these fields."""
    if not isinstance(item, dict) or item.get("kind") not in HISTORY_KINDS:
        return False
    if not all(isinstance(item.get(k), str) for k in ("at", "entry_id", "domain", "title")):
        return False
    return dt_util.parse_datetime(item["at"]) is not None and isinstance(item.get("attempt"), int)
