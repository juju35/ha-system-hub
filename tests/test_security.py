"""Security module: refused logins read from the http component's log, accounts, tokens, credentials in clear."""

from __future__ import annotations

import logging
from datetime import timedelta

from homeassistant.auth.models import TOKEN_TYPE_LONG_LIVED_ACCESS_TOKEN
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.system_hub.const import CONF_MODULES, DOMAIN
from custom_components.system_hub.security import BAN_LOGGER, is_internet, scan_config, settings

REFUSED = (
    "Login attempt or request with invalid authentication from {host} ({ip}). Requested URL: '/auth/login_flow/x'. "
    "(Mozilla/5.0)"
)


async def _setup(hass: HomeAssistant, **options) -> MockConfigEntry:
    entry = MockConfigEntry(
        domain=DOMAIN, title="System Hub", options={CONF_MODULES: ["security"], "security": options}
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


def test_internet_addresses() -> None:
    assert is_internet("203.0.113.42") is False  # documentation range: reserved, counted as private
    assert is_internet("8.8.8.8")
    assert not is_internet("192.168.1.37")
    assert not is_internet("::1")
    assert not is_internet("not an ip")
    assert settings(None) == {"notify": True, "notify_services": [], "token_unused_days": 90, "ignored_ips": []}


async def test_refused_logins_from_the_log(hass: HomeAssistant, hass_ws_client) -> None:
    entry = await _setup(hass)
    log = logging.getLogger(BAN_LOGGER)
    for _ in range(3):
        log.warning(REFUSED.format(host="dns.google", ip="8.8.8.8"))
    log.warning(REFUSED.format(host="192.168.1.37", ip="192.168.1.37"))
    log.warning("Banned IP 8.8.8.8 for too many login attempts")
    await hass.async_block_till_done()
    rows = entry.runtime_data.security.refused()
    assert [(r["ip"], r["count"], r["internet"]) for r in rows] == [("192.168.1.37", 1, False), ("8.8.8.8", 3, True)]
    assert rows[1]["host"] == "dns.google"
    assert rows[1]["url"] == "/auth/login_flow/x"
    assert "8.8.8.8" in entry.runtime_data.security.banned
    # From the Internet: notified once (the next ones within the hour are not); the local one is not
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": "persistent_notification/get"})
    ids = [n["notification_id"] for n in (await client.receive_json())["result"]]
    assert "system_hub_security_8.8.8.8" in ids
    assert "system_hub_security_192.168.1.37" not in ids
    # Ignored from the panel: no reload, flagged in the list
    data = entry.runtime_data
    await client.send_json({"id": 2, "type": "system_hub/security_ignore", "ip": "192.168.1.37"})
    assert (await client.receive_json())["result"] == {"ignored": ["192.168.1.37"]}
    await hass.async_block_till_done()
    assert entry.runtime_data is data
    assert entry.options["security"]["ignored_ips"] == ["192.168.1.37"]
    assert data.security.refused()[0]["ignored"]
    # Kept across a restart of the module
    await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    assert len(entry.runtime_data.security.attempts) == 4


async def test_accounts_tokens_and_revoke(hass: HomeAssistant, hass_ws_client, hass_admin_user) -> None:
    await _setup(hass)
    old = await hass.auth.async_create_refresh_token(
        hass_admin_user,
        client_name="Old script",
        token_type=TOKEN_TYPE_LONG_LIVED_ACCESS_TOKEN,
        access_token_expiration=timedelta(days=3650),
    )
    old.created_at -= timedelta(days=200)
    used = await hass.auth.async_create_refresh_token(
        hass_admin_user,
        client_name="Grafana",
        token_type=TOKEN_TYPE_LONG_LIVED_ACCESS_TOKEN,
        access_token_expiration=timedelta(days=3650),
    )
    hass.auth.async_create_access_token(used, "192.168.1.20")
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": "system_hub/security"})
    result = (await client.receive_json())["result"]
    admin = next(u for u in result["users"] if u["id"] == hass_admin_user.id)
    assert admin["admin"] and not admin["mfa"]
    tokens = {t["name"]: t for t in result["tokens"]}
    assert tokens["Old script"]["unused"] and not tokens["Grafana"]["unused"]
    assert tokens["Grafana"]["last_ip"] == "192.168.1.20"
    assert result["exposure"]["external_url"] is None
    assert result["addons"] is None
    await client.send_json({"id": 2, "type": "system_hub/security_revoke", "token_id": old.id})
    assert (await client.receive_json())["result"] == {"revoked": old.id}
    assert hass.auth.async_get_refresh_token(old.id) is None
    # Only a long-lived token: a session is not revoked here
    session = next(t for t in hass_admin_user.refresh_tokens.values() if t.token_type == "normal")
    await client.send_json({"id": 3, "type": "system_hub/security_revoke", "token_id": session.id})
    assert (await client.receive_json())["error"]["code"] == "not_found"


def test_credentials_in_clear(tmp_path) -> None:
    (tmp_path / "configuration.yaml").write_text(
        "mqtt:\n  password: hunter2\n  username: me\nhttp:\n  api_key: !secret key\n# token: commented\n"
        "rest:\n  - access_token: '{{ states(\"x\") }}'\n    token_unused_days: 90\n",
        encoding="utf-8",
    )
    (tmp_path / "packages").mkdir()
    (tmp_path / "packages" / "meteo.yaml").write_text("weather:\n  api_key: abc123\n", encoding="utf-8")
    (tmp_path / "secrets.yaml").write_text("key: abc\n", encoding="utf-8")
    (tmp_path / ".storage").mkdir()
    (tmp_path / ".storage" / "x.yaml").write_text("password: x\n", encoding="utf-8")
    assert scan_config(str(tmp_path)) == [
        {"file": "configuration.yaml", "line": 2, "key": "password"},
        {"file": "packages/meteo.yaml", "line": 2, "key": "api_key"},
    ]


async def test_settings_step(hass: HomeAssistant) -> None:
    entry = await _setup(hass)
    result = await hass.config_entries.options.async_init(entry.entry_id)
    assert "security" in result["menu_options"]
    result = await hass.config_entries.options.async_configure(result["flow_id"], {"next_step_id": "security"})
    result = await hass.config_entries.options.async_configure(
        result["flow_id"], {"notify": False, "notify_services": [], "token_unused_days": 30, "ignored_ips": ["1.2.3.4"]}
    )
    assert entry.options["security"] == {
        "notify": False,
        "notify_services": [],
        "token_unused_days": 30,
        "ignored_ips": ["1.2.3.4"],
    }
