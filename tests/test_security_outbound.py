"""Security module: outbound connections by integration (off by default, nothing hooked while off)."""

from __future__ import annotations

import socket
import sys
import time

from aiohttp.connector import TCPConnector
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.system_hub.const import CONF_MODULES, DOMAIN
from custom_components.system_hub.security.outbound import LEARN_SECONDS, OutboundMonitor, domain_of, is_local

ORIGINAL_SOCKET = socket.getaddrinfo
ORIGINAL_RESOLVE = TCPConnector._resolve_host  # noqa: SLF001


def _from(path: str, source: str, **names):
    """Run source as if it were written in the file path (an integration's code), returning its result."""
    scope = dict(names)
    exec(compile(f"def call():\n    return {source}\n", path, "exec"), scope)  # noqa: S102
    return scope["call"]()


async def _afrom(path: str, source: str, **names):
    """Await source as if an integration's coroutine in the file path awaited it."""
    scope = dict(names)
    exec(compile(f"async def call():\n    return await {source}\n", path, "exec"), scope)  # noqa: S102
    return await scope["call"]()


async def _setup(hass: HomeAssistant, **options) -> MockConfigEntry:
    entry = MockConfigEntry(
        domain=DOMAIN, title="System Hub", options={CONF_MODULES: ["security"], "security": options}
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


def test_domains_and_local_hosts() -> None:
    assert domain_of("/config/custom_components/iptv/api.py") == ("iptv", True)
    assert domain_of("/usr/src/homeassistant/homeassistant/components/met/coordinator.py") == ("met", False)
    assert domain_of("/usr/lib/python3.13/site-packages/aiohttp/client.py") is None
    assert is_local("192.168.1.10")
    assert is_local("mqtt.local")
    assert is_local("core-mosquitto")
    assert is_local("[fe80::1]")
    assert not is_local("api.github.com")
    assert not is_local("8.8.8.8")


async def test_off_by_default_nothing_hooked(hass: HomeAssistant) -> None:
    entry = await _setup(hass)
    assert entry.runtime_data.security.outbound is None
    assert socket.getaddrinfo is ORIGINAL_SOCKET
    assert TCPConnector._resolve_host is ORIGINAL_RESOLVE  # noqa: SLF001
    assert "getaddrinfo" not in hass.loop.__dict__


async def test_counted_by_integration_then_unhooked(hass: HomeAssistant, hass_ws_client) -> None:
    entry = await _setup(hass, outbound=True)
    monitor = entry.runtime_data.security.outbound
    assert socket.getaddrinfo is not ORIGINAL_SOCKET
    assert "getaddrinfo" in hass.loop.__dict__
    # Through the event loop, from a custom integration's code
    await _afrom("/config/custom_components/iptv/api.py", "loop.getaddrinfo('localhost', 8080)", loop=hass.loop)
    # aiohttp: counted once, its threaded resolver's loop lookup is not counted again
    connector = TCPConnector(resolver=None)
    await _afrom(
        "/x/homeassistant/components/met/api.py", "connector._resolve_host('localhost', 443)", connector=connector
    )
    await connector.close()
    # A synchronous lookup from an integration, in the executor; the loop's own lookup threads are not counted
    await hass.async_add_executor_job(
        lambda: _from("/config/custom_components/tapo/cloud.py", "socket.getaddrinfo('localhost', 443)", socket=socket)
    )
    data = monitor.state()
    by = {g["domain"]: g for g in data["integrations"]}
    assert set(by) == {"iptv", "met", "tapo"}
    assert by["iptv"]["custom"] and not by["met"]["custom"]
    assert by["met"]["hosts"][0]["count"] == 1
    assert by["iptv"]["hosts"][0]["ports"] == [8080]
    assert by["iptv"]["hosts"][0]["local"]
    # Learning: the first day's hosts are known
    assert not any(g["new"] for g in data["integrations"])
    assert data["learning_until"]
    assert data["cost_us"] >= 0

    # After the first day, a new host is flagged until marked as known; ignored, it is not
    monitor.since = time.time() - LEARN_SECONDS - 10
    await _afrom("/config/custom_components/iptv/api.py", "loop.getaddrinfo('127.0.0.1', 80)", loop=hass.loop)
    data = monitor.state()
    iptv = next(g for g in data["integrations"] if g["domain"] == "iptv")
    assert iptv["new"] == 1
    assert iptv["hosts"][0]["host"] == "127.0.0.1"
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "system_hub/security"})
    shown = (await client.receive_json())["result"]["outbound"]
    assert any(g["domain"] == "iptv" and g["new"] == 1 for g in shown["integrations"])
    await client.send_json_auto_id({"type": "system_hub/security_outbound", "action": "known", "domain": "iptv"})
    assert (await client.receive_json())["success"]
    assert not next(g for g in monitor.state()["integrations"] if g["domain"] == "iptv")["new"]
    await client.send_json_auto_id({"type": "system_hub/security_outbound", "action": "unknown", "host": "127.0.0.1"})
    assert (await client.receive_json())["success"]
    await client.send_json_auto_id({"type": "system_hub/security_outbound", "action": "ignore", "host": "127.0.0.1"})
    assert (await client.receive_json())["success"]
    host = next(h for g in monitor.state()["integrations"] for h in g["hosts"] if h["host"] == "127.0.0.1")
    assert host["ignored"] and not host["new"]
    await client.send_json_auto_id({"type": "system_hub/security_outbound", "action": "ignore"})
    assert not (await client.receive_json())["success"]

    # Turned off: every function put back
    assert await hass.config_entries.async_unload(entry.entry_id)
    assert socket.getaddrinfo is ORIGINAL_SOCKET
    assert TCPConnector._resolve_host is ORIGINAL_RESOLVE  # noqa: SLF001
    assert "getaddrinfo" not in hass.loop.__dict__


async def test_kept_across_restarts_and_bounded(hass: HomeAssistant, hass_storage) -> None:
    hass_storage["system_hub.outbound"] = {
        "version": 1,
        "data": {
            "since": time.time() - 10 * 86400,
            "hosts": {
                "api.github.com": {
                    "github": {"count": 3, "first": 1, "last": time.time() - 60, "ports": [443], "custom": True}
                },
                "old.example.org": {
                    "x": {"count": 1, "first": 1, "last": time.time() - 8 * 86400, "ports": [], "custom": True}
                },
            },
            "known": ["github|api.github.com", "x|old.example.org"],
            "ignored": [],
        },
    }
    monitor = OutboundMonitor(hass)
    await monitor.async_start()
    try:
        # Older than 7 days: gone, with its known mark
        assert set(monitor.hosts) == {"api.github.com"}
        assert monitor.known == {"github|api.github.com"}
        # A host that cannot be read is skipped, never raised
        monitor.seen(None, 80, sys._getframe())  # noqa: SLF001
        monitor.seen(object(), 80, sys._getframe())  # noqa: SLF001
        assert set(monitor.hosts) == {"api.github.com"}
    finally:
        await monitor.async_stop()
    assert hass_storage["system_hub.outbound"]["data"]["known"] == ["github|api.github.com"]
