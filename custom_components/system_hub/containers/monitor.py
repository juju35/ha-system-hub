"""Monitor Home Assistant's own containers through the Supervisor: Core, the Supervisor, its plugins, every add-on.

Monitoring only: nothing is started, stopped or restarted. Every refresh reads the list of add-ons, the
information and statistics of each one, of Core, of the Supervisor and of its plugins (audio, cli, dns,
multicast, observer): state, version, image, CPU, memory, network, disk; each one with its Docker container name.
A container is *down* when it should run and doesn't: Core, the Supervisor or a plugin not answering, or an
add-on set to start at boot that is stopped or in error. Going down and coming back are notified, never during
Home Assistant's start (the add-ons are still starting then) and never at the first refresh.
"""

from __future__ import annotations

import asyncio
import logging
from collections import deque
from collections.abc import Callable
from dataclasses import asdict, dataclass, field
from datetime import datetime
from types import SimpleNamespace
from typing import Any

from homeassistant.components import persistent_notification
from homeassistant.core import CALLBACK_TYPE, CoreState, HomeAssistant, callback
from homeassistant.helpers.translation import async_get_translations
from homeassistant.util import dt as dt_util

from ..const import DOMAIN
from ..notify import async_send_notify
from .const import (
    APP_PREFIX_SINCE,
    CONTAINER_CORE,
    CONTAINER_PREFIX,
    HISTORY_SPAN,
    HISTORY_STEP,
    KIND_ADDON,
    KIND_CORE,
    KIND_PLUGIN,
    KIND_SUPERVISOR,
    PLUGINS,
    REQUEST_TIMEOUT,
    SLUG_CORE,
    SLUG_SUPERVISOR,
    STATE_STARTED,
    STATE_STARTUP,
)

_LOGGER = logging.getLogger(__name__)


@dataclass
class Container:
    """What the Supervisor says about one container at the last refresh."""

    slug: str
    name: str
    kind: str
    state: str
    version: str | None = None
    version_latest: str | None = None
    update_available: bool = False
    # Add-ons only: "auto" when started at boot. Core, the Supervisor and its plugins always should run.
    boot: str | None = None
    # The Docker container (homeassistant, hassio_supervisor, hassio_dns, app_<slug>…) and its image with the tag.
    container: str | None = None
    image: str | None = None
    cpu_percent: float | None = None
    memory_usage: int | None = None
    memory_limit: int | None = None
    memory_percent: float | None = None
    network_rx: int | None = None
    network_tx: int | None = None
    blk_read: int | None = None
    blk_write: int | None = None
    # When the state last changed (first refresh: when it was first seen).
    since: datetime = field(default_factory=dt_util.utcnow)

    @property
    def expected(self) -> bool:
        """Should be running."""
        return self.kind != KIND_ADDON or self.boot == "auto"

    @property
    def running(self) -> bool:
        return self.state in (STATE_STARTED, STATE_STARTUP)

    @property
    def down(self) -> bool:
        return self.expected and not self.running

    def as_dict(self) -> dict[str, Any]:
        return {**asdict(self), "since": self.since.isoformat(), "expected": self.expected, "down": self.down}


def _client(hass: HomeAssistant) -> Any:
    from homeassistant.components.hassio import get_supervisor_client  # noqa: PLC0415 - only with the Supervisor

    return get_supervisor_client(hass)


def supervisor_available(hass: HomeAssistant) -> bool:
    """Home Assistant OS or Supervised: the hassio integration is loaded."""
    return "hassio" in hass.config.components


class ContainerMonitor:
    """Reads the containers at an interval and keeps them for the entities and the panel."""

    def __init__(self, hass: HomeAssistant, notify: bool, notify_services: list[str]) -> None:
        self.hass = hass
        self.notify = notify
        self.notify_services = list(notify_services)
        self.containers: dict[str, Container] = {}
        self.last_update: datetime | None = None
        self.error: str | None = None
        # slug -> [(time, cpu %, memory %)], one point every HISTORY_STEP.
        self.history: dict[str, deque[tuple[str, float | None, float | None]]] = {}
        self._last_point: datetime | None = None
        self._listeners: list[Callable[[], None]] = []
        self._lock = asyncio.Lock()

    @callback
    def async_add_listener(self, update: Callable[[], None]) -> CALLBACK_TYPE:
        self._listeners.append(update)

        @callback
        def remove() -> None:
            self._listeners.remove(update)

        return remove

    @callback
    def _notify_listeners(self) -> None:
        for update in list(self._listeners):
            update()

    @property
    def down(self) -> list[Container]:
        return [c for c in self.containers.values() if c.down]

    @property
    def running(self) -> list[Container]:
        return [c for c in self.containers.values() if c.running]

    async def async_refresh(self) -> None:
        """Read every container; a refresh already running is not run twice."""
        if self._lock.locked():
            return
        async with self._lock:
            try:
                async with asyncio.timeout(REQUEST_TIMEOUT):
                    containers = await self._async_read()
            except Exception as err:  # noqa: BLE001 - the Supervisor busy or restarting must not stop the module
                self.error = str(err) or type(err).__name__
                _LOGGER.warning("Could not read the containers from the Supervisor: %s", self.error)
                self._notify_listeners()
                return
            self.error = None
            first = self.last_update is None
            changes = self._merge(containers)
            self.last_update = dt_util.utcnow()
            self._record_history()
            self._notify_listeners()
            # No notification at the first refresh, nor while Home Assistant starts: the add-ons are starting too.
            if not first and self.notify and self.hass.state is CoreState.running:
                for container, went_down in changes:
                    await self._async_send(container, went_down)

    async def _async_read(self) -> list[Container]:
        client = _client(self.hass)
        # The plugins and the add-ons' images have no call of their own in the client: its plain requests
        raw = getattr(client, "_client", None)
        core_info, core_stats, sup_info, sup_stats, addons = await asyncio.gather(
            client.homeassistant.info(),
            client.homeassistant.stats(),
            client.supervisor.info(),
            client.supervisor.stats(),
            client.addons.list(),
        )
        core = _container(SLUG_CORE, "Home Assistant Core", KIND_CORE, STATE_STARTED, core_info, core_stats)
        core.container = CONTAINER_CORE
        core.image = _tagged(getattr(core_info, "image", None), core.version)
        sup = _container(SLUG_SUPERVISOR, "Supervisor", KIND_SUPERVISOR, STATE_STARTED, sup_info, sup_stats)
        sup.container = f"{CONTAINER_PREFIX}supervisor"
        arch = getattr(sup_info, "arch", None)
        sup.image = _tagged(f"ghcr.io/home-assistant/{arch}-hassio-supervisor" if arch else None, sup.version)
        prefix = "app" if _version(sup.version) >= APP_PREFIX_SINCE else "addon"
        containers = [core, sup]

        async def plugin(name: str) -> Container | None:
            info, stats = await asyncio.gather(_get(raw, f"{name}/info"), _get(raw, f"{name}/stats"))
            if info is None:
                return None
            container = _container(
                name, PLUGINS[name], KIND_PLUGIN, STATE_STARTED if stats is not None else "unknown", info, stats
            )
            container.container = f"{CONTAINER_PREFIX}{name}"
            container.image = _tagged(getattr(info, "image", None), container.version)
            return container

        async def addon(item: Any) -> Container:
            # Statistics only exist for a running add-on; the boot setting and the image come from its full information.
            info, stats = await asyncio.gather(
                _get(raw, f"addons/{item.slug}/info") if raw is not None else client.addons.addon_info(item.slug),
                client.addons.addon_stats(item.slug) if _value(item.state) == STATE_STARTED else _none(),
                return_exceptions=True,
            )
            container = _container(
                item.slug,
                item.name,
                KIND_ADDON,
                _value(item.state),
                item,
                None if isinstance(stats, BaseException) else stats,
            )
            container.container = f"{prefix}_{item.slug}"
            if info is not None and not isinstance(info, BaseException):
                container.boot = _value(getattr(info, "boot", None)) if getattr(info, "boot", None) else None
                container.image = _tagged(getattr(info, "image", None), container.version)
            return container

        if raw is not None:
            containers += [c for c in await asyncio.gather(*(plugin(name) for name in PLUGINS)) if c is not None]
        containers += await asyncio.gather(*(addon(item) for item in addons))
        return containers

    def _merge(self, containers: list[Container]) -> list[tuple[Container, bool]]:
        """Keep the `since` of a state that didn't change; return the containers that went down or came back."""
        changes: list[tuple[Container, bool]] = []
        merged: dict[str, Container] = {}
        for container in containers:
            previous = self.containers.get(container.slug)
            if previous is not None and previous.state == container.state:
                container.since = previous.since
            if previous is not None and previous.down != container.down:
                changes.append((container, container.down))
            merged[container.slug] = container
        self.containers = merged
        for slug in set(self.history) - set(merged):
            del self.history[slug]
        return changes

    def _record_history(self) -> None:
        now = dt_util.utcnow()
        if self._last_point is not None and now - self._last_point < HISTORY_STEP:
            return
        self._last_point = now
        size = int(HISTORY_SPAN / HISTORY_STEP)
        for container in self.containers.values():
            points = self.history.setdefault(container.slug, deque(maxlen=size))
            points.append((now.isoformat(), container.cpu_percent, container.memory_percent))

    async def _async_send(self, container: Container, went_down: bool) -> None:
        """Persistent notification (one per container, replaced) and the notify actions chosen."""
        key = "down" if went_down else "back"
        strings = await async_get_translations(self.hass, self.hass.config.language, "common", [DOMAIN])

        def text(name: str) -> str:
            template = strings.get(f"component.{DOMAIN}.common.containers_{name}", name)
            try:
                return template.format(name=container.name, state=container.state)
            except (KeyError, IndexError, ValueError):
                return template

        title, message = text(f"{key}_title"), text(key)
        notification = notification_id(container.slug)
        if went_down:
            persistent_notification.async_create(self.hass, message, title=title, notification_id=notification)
        else:
            persistent_notification.async_dismiss(self.hass, notification)
        await async_send_notify(self.hass, self.notify_services, title, message)

    @callback
    def async_dismiss_all(self) -> None:
        for slug in self.containers:
            persistent_notification.async_dismiss(self.hass, notification_id(slug))


def notification_id(slug: str) -> str:
    return f"{DOMAIN}_containers_{slug}"


async def _none() -> None:
    return None


async def _get(raw: Any, uri: str) -> SimpleNamespace | None:
    """A Supervisor endpoint the client has no call for, its data as attributes; None when it fails."""
    if raw is None:
        return None
    try:
        response = await raw.get(uri)
    except Exception:  # noqa: BLE001 - a plugin or an add-on that doesn't answer is left out, not the whole refresh
        return None
    data = getattr(response, "data", None)
    return SimpleNamespace(**data) if isinstance(data, dict) else None


def _tagged(image: str | None, version: str | None) -> str | None:
    """image:version, as Docker lists it."""
    if not image:
        return None
    return f"{image}:{version}" if version else image


def _version(version: str | None) -> tuple[int, ...]:
    """2026.07.4 -> (2026, 7, 4); a dev or unknown version counts as the newest."""
    parts = []
    for part in (version or "").split(".")[:3]:
        if not part.isdigit():
            break
        parts.append(int(part))
    return tuple(parts) if len(parts) == 3 else (9999,)


def _value(value: Any) -> str:
    """An enum of aiohasupervisor, or a plain string."""
    return str(getattr(value, "value", value))


def _container(slug: str, name: str, kind: str, state: str, info: Any, stats: Any) -> Container:
    container = Container(
        slug=slug,
        name=name,
        kind=kind,
        state=state,
        version=getattr(info, "version", None),
        version_latest=getattr(info, "version_latest", None),
        update_available=bool(getattr(info, "update_available", False)),
    )
    if stats is not None:
        for key in (
            "cpu_percent",
            "memory_usage",
            "memory_limit",
            "memory_percent",
            "network_rx",
            "network_tx",
            "blk_read",
            "blk_write",
        ):
            setattr(container, key, getattr(stats, key, None))
    return container
