"""Outbound connections: the hosts Home Assistant Core contacts, and the integration that asks for each.

Off by default (Settings → Security → Track outbound connections). Off, nothing is hooked: no cost at all. On, three
entry points are wrapped, and put back as they were when it is turned off again:

- aiohttp's ``TCPConnector._resolve_host`` (the class): every new aiohttp connection, whatever its resolver (aiodns
  included, which never goes through the event loop);
- ``getaddrinfo`` of Home Assistant's event loop (this one instance only): httpx/anyio, websockets, asyncio streams…;
- ``socket.getaddrinfo``: synchronous libraries (requests…) run in the executor. Counted only when an integration's
  code is on the stack, since the event loop's own resolver calls come through here too, from a bare worker thread.

Only *new* connections come here (pooled, keep-alive ones never do). The cost of each: a walk up the stack reading
each frame's file name (the domain of each file kept, so a file is parsed once) and a dict update under a lock; the
time spent is summed and shown in the tab, so it can be checked. No I/O: kept in memory (500 hosts at most, 7 days
after their last contact), saved at most once an hour and only when something changed; no entity, nothing in the
recorder.

The hosts seen during the first 24 hours count as known (learning); after that, a host new for an integration is
flagged until it is marked as known. A host can be ignored: listed apart, never flagged.
"""

from __future__ import annotations

import contextvars
import ipaddress
import logging
import re
import socket
import sys
import threading
import time
from types import FrameType
from typing import Any, Final

from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.storage import Store

from ..const import DOMAIN

_LOGGER = logging.getLogger(__name__)

STORE_KEY: Final = f"{DOMAIN}.outbound"
KEEP_SECONDS: Final = 7 * 86400
LEARN_SECONDS: Final = 86400
SAVE_DELAY: Final = 3600
MAX_HOSTS: Final = 500
MAX_PORTS: Final = 4
MAX_DEPTH: Final = 64
CORE: Final = "homeassistant"

_CUSTOM = re.compile(r"[/\\]custom_components[/\\]([^/\\]+)[/\\]")
_BUILT_IN = re.compile(r"[/\\]homeassistant[/\\]components[/\\]([^/\\]+)[/\\]")
_MISS: Final = object()
# Set while aiohttp resolves a host: its threaded resolver then calls the loop's getaddrinfo, already counted
_IN_AIOHTTP: contextvars.ContextVar[bool] = contextvars.ContextVar(f"{DOMAIN}_outbound_aiohttp", default=False)


def domain_of(filename: str) -> tuple[str, bool] | None:
    """The integration a source file belongs to, and whether it is a custom one; None for any other file."""
    if match := _CUSTOM.search(filename):
        return match[1], True
    if match := _BUILT_IN.search(filename):
        return match[1], False
    return None


def is_local(host: str) -> bool:
    """A host on the local network: a private, loopback or link-local address, a .local, .lan, .home.arpa or
    single-label name."""
    try:
        address = ipaddress.ip_address(host.strip("[]").split("%")[0])
    except ValueError:
        return "." not in host or host.endswith((".local", ".lan", ".home.arpa", ".internal", ".localdomain"))
    return address.is_private or address.is_loopback or address.is_link_local


class OutboundMonitor:
    """The hosts contacted, by integration: {host: {domain: {count, first, last, ports, custom}}}."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self._store: Store[dict[str, Any]] = Store(hass, 1, STORE_KEY)
        self._lock = threading.Lock()
        self._files: dict[str, tuple[str, bool] | None] = {}
        self.hosts: dict[str, dict[str, dict[str, Any]]] = {}
        self.known: set[str] = set()
        self.ignored: set[str] = set()
        self.since = 0.0
        self.cost_ns = 0
        self.connections = 0
        self._on = False
        self._save_pending = False
        self._loop_thread = 0
        self._originals: dict[str, Any] = {}

    # --- Start and stop -------------------------------------------------------------------------------------------

    async def async_start(self) -> None:
        data = await self._store.async_load() or {}
        self.since = float(data.get("since") or time.time())
        self.hosts = {h: dict(by) for h, by in (data.get("hosts") or {}).items() if isinstance(by, dict)}
        self.known = set(data.get("known") or [])
        self.ignored = set(data.get("ignored") or [])
        self._prune(time.time())
        self._loop_thread = threading.get_ident()
        self._install()
        if not data:
            self._schedule_save()

    async def async_stop(self) -> None:
        """Put every wrapped function back; a second call does nothing."""
        if not self._on:
            return
        self._uninstall()
        await self._store.async_save(self._data())

    def _install(self) -> None:
        self._on = True
        monitor = self
        try:
            from aiohttp.connector import TCPConnector  # noqa: PLC0415

            resolve = TCPConnector._resolve_host  # noqa: SLF001

            async def _resolve_host(connector: Any, host: str, port: int, *args: Any, **kwargs: Any) -> Any:
                if monitor._on:  # noqa: SLF001
                    monitor.seen(host, port, sys._getframe(1))  # noqa: SLF001
                token = _IN_AIOHTTP.set(True)
                try:
                    return await resolve(connector, host, port, *args, **kwargs)
                finally:
                    _IN_AIOHTTP.reset(token)

            TCPConnector._resolve_host = _resolve_host  # type: ignore[method-assign] # noqa: SLF001
            self._originals["aiohttp"] = (TCPConnector, resolve, _resolve_host)
        except Exception as err:  # noqa: BLE001 - an aiohttp without this method: the other hooks still count
            _LOGGER.debug("aiohttp connections not tracked: %s", err)

        loop = self.hass.loop
        loop_getaddrinfo = loop.getaddrinfo

        async def getaddrinfo(host: Any, port: Any, *args: Any, **kwargs: Any) -> Any:
            if monitor._on and not _IN_AIOHTTP.get():  # noqa: SLF001
                monitor.seen(host, port, sys._getframe(1))  # noqa: SLF001
            return await loop_getaddrinfo(host, port, *args, **kwargs)

        try:
            loop.getaddrinfo = getaddrinfo  # type: ignore[method-assign]
            self._originals["loop"] = (loop, getaddrinfo)
        except (AttributeError, TypeError) as err:  # a loop without instance attributes (uvloop)
            _LOGGER.debug("Event loop lookups not tracked: %s", err)

        sock_getaddrinfo = socket.getaddrinfo

        def sync_getaddrinfo(host: Any, port: Any, *args: Any, **kwargs: Any) -> Any:
            if monitor._on and threading.get_ident() != monitor._loop_thread:  # noqa: SLF001
                monitor.seen(host, port, sys._getframe(1), sync=True)  # noqa: SLF001
            return sock_getaddrinfo(host, port, *args, **kwargs)

        socket.getaddrinfo = sync_getaddrinfo
        self._originals["socket"] = (sock_getaddrinfo, sync_getaddrinfo)

    def _uninstall(self) -> None:
        """Each function put back unless something else wrapped it since: then ours only passes the call on."""
        self._on = False
        if aio := self._originals.pop("aiohttp", None):
            connector, resolve, ours = aio
            if connector.__dict__.get("_resolve_host") is ours:
                connector._resolve_host = resolve  # noqa: SLF001
        if loop_hook := self._originals.pop("loop", None):
            loop, ours = loop_hook
            if loop.__dict__.get("getaddrinfo") is ours:
                del loop.getaddrinfo
        if sock := self._originals.pop("socket", None):
            original, ours = sock
            if socket.getaddrinfo is ours:
                socket.getaddrinfo = original

    # --- Counting ---------------------------------------------------------------------------------------------------

    def _caller(self, frame: FrameType | None) -> tuple[str, bool] | None:
        """The nearest integration on the stack: its file's domain, read once per file."""
        depth = 0
        files = self._files
        while frame is not None and depth < MAX_DEPTH:
            filename = frame.f_code.co_filename
            hit = files.get(filename, _MISS)
            if hit is _MISS:
                hit = files[filename] = domain_of(filename)
            if hit is not None:
                return hit  # type: ignore[return-value]
            frame = frame.f_back
            depth += 1
        return None

    def seen(self, host: Any, port: Any, frame: FrameType | None, sync: bool = False) -> None:
        """A new connection to host:port, asked from frame; never raises."""
        start = time.perf_counter_ns()
        try:
            if isinstance(host, bytes):
                host = host.decode("ascii", "ignore")
            if not host or not isinstance(host, str):
                return
            caller = self._caller(frame)
            if caller is None:
                if sync:  # the event loop's own resolver, from a worker thread: counted by its loop hook
                    return
                caller = (CORE, False)
            self._count(host.rstrip(".").lower(), port, *caller)
        except Exception as err:  # noqa: BLE001 - never in the way of a connection
            _LOGGER.debug("Outbound connection not counted: %s", err)
        finally:
            self.cost_ns += time.perf_counter_ns() - start

    def _count(self, host: str, port: Any, domain: str, custom: bool) -> None:
        now = time.time()
        try:
            port = int(port) if port not in (None, "") else None
        except (TypeError, ValueError):
            port = None
        with self._lock:
            self.connections += 1
            by = self.hosts.get(host)
            if by is None:
                if len(self.hosts) >= MAX_HOSTS:
                    oldest = min(self.hosts, key=lambda h: max(r["last"] for r in self.hosts[h].values()))
                    del self.hosts[oldest]
                by = self.hosts[host] = {}
            row = by.get(domain)
            if row is None:
                row = by[domain] = {"count": 0, "first": now, "ports": [], "custom": custom}
                # Seen during the first day: known from the start
                if now - self.since < LEARN_SECONDS:
                    self.known.add(f"{domain}|{host}")
            row["count"] += 1
            row["last"] = now
            if port and port not in row["ports"] and len(row["ports"]) < MAX_PORTS:
                row["ports"].append(port)
        if not self._save_pending:
            self._save_pending = True
            if threading.get_ident() == self._loop_thread:
                self._schedule_save()
            else:
                self.hass.loop.call_soon_threadsafe(self._schedule_save)

    @callback
    def _schedule_save(self) -> None:
        self._save_pending = True
        self._store.async_delay_save(self._data, SAVE_DELAY)

    def _data(self) -> dict[str, Any]:
        with self._lock:
            self._save_pending = False
            self._prune(time.time())
            return {
                "since": self.since,
                "hosts": {h: {d: dict(r) for d, r in by.items()} for h, by in self.hosts.items()},
                "known": sorted(self.known),
                "ignored": sorted(self.ignored),
            }

    def _prune(self, now: float) -> None:
        since = now - KEEP_SECONDS
        for host in list(self.hosts):
            by = {d: r for d, r in self.hosts[host].items() if r.get("last", 0) > since}
            if by:
                self.hosts[host] = by
            else:
                del self.hosts[host]
        live = {f"{d}|{h}" for h, by in self.hosts.items() for d in by}
        self.known &= live

    # --- Reading and marking ----------------------------------------------------------------------------------------

    def _is_new(self, host: str, domain: str) -> bool:
        return f"{domain}|{host}" not in self.known and host not in self.ignored

    async def async_mark(self, action: str, host: str | None = None, domain: str | None = None) -> None:
        """known/unknown (one host of one integration, every one of an integration, or all), ignore/unignore (a
        host); saved at once."""
        with self._lock:
            if action in ("ignore", "unignore") and host:
                (self.ignored.add if action == "ignore" else self.ignored.discard)(host)
            elif action in ("known", "unknown"):
                pairs = {
                    f"{d}|{h}"
                    for h, by in self.hosts.items()
                    for d in by
                    if (host is None or h == host) and (domain is None or d == domain)
                }
                self.known = self.known | pairs if action == "known" else self.known - pairs
        await self._store.async_save(self._data())

    def state(self) -> dict[str, Any]:
        """By integration, most recent first: its hosts, the new ones first."""
        now = time.time()
        groups: dict[str, dict[str, Any]] = {}
        with self._lock:
            self._prune(now)
            for host, by in self.hosts.items():
                for domain, row in by.items():
                    group = groups.setdefault(
                        domain,
                        {
                            "domain": domain,
                            "name": domain,
                            "custom": bool(row.get("custom")),
                            "hosts": [],
                        },
                    )
                    group["hosts"].append(
                        {
                            "host": host,
                            "ports": list(row.get("ports") or []),
                            "count": row["count"],
                            "first": row["first"],
                            "last": row["last"],
                            "local": is_local(host),
                            "new": self._is_new(host, domain),
                            "ignored": host in self.ignored,
                        }
                    )
        names = integration_names(self.hass, set(groups))
        for group in groups.values():
            group["name"] = names[group["domain"]]
            group["hosts"].sort(key=lambda h: (not h["new"], h["ignored"], -h["last"]))
            group["count"] = sum(h["count"] for h in group["hosts"])
            group["last"] = max(h["last"] for h in group["hosts"])
            group["new"] = sum(h["new"] for h in group["hosts"])
        return {
            "since": self.since,
            "learning_until": self.since + LEARN_SECONDS if now - self.since < LEARN_SECONDS else None,
            "connections": self.connections,
            "cost_us": round(self.cost_ns / 1000),
            "hosts": len({h for h, by in self.hosts.items() if h not in self.ignored}),
            "integrations": sorted(groups.values(), key=lambda g: (-g["new"], -g["last"])),
        }


def integration_names(hass: HomeAssistant, domains: set[str]) -> dict[str, str]:
    """The names of the loaded integrations among domains."""
    from homeassistant.loader import async_get_loaded_integration  # noqa: PLC0415

    names = {}
    for domain in domains:
        try:
            names[domain] = async_get_loaded_integration(hass, domain).name
        except Exception:  # noqa: BLE001 - not loaded (yet): its domain
            names[domain] = "Home Assistant" if domain == CORE else domain
    return names
