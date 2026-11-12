"""Security module: refused logins, accounts, long-lived tokens, exposure, add-ons and credentials left in clear.

Home Assistant keeps no history of refused logins: they are read as its http component logs them (a handler on its
logger, homeassistant.components.http.ban) and kept 7 days in a store; a refusal from the Internet is notified (a
persistent notification and the notify actions chosen) unless turned off. The rest is read when the panel asks
(system_hub/security): the accounts and their tokens from the auth manager, the IP bans and the HTTP settings from
the http component, the add-ons from the Supervisor and the YAML files for credentials written in clear (both once an
hour; the file, the line and the key, never the value). No entities of its own.
"""

from __future__ import annotations

import asyncio
import ipaddress
import logging
import re
import time
from pathlib import Path
from typing import Any, Final

from homeassistant.components import persistent_notification
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.storage import Store
from homeassistant.helpers.translation import async_get_translations

from ..const import DOMAIN
from ..notify import async_send_notify

_LOGGER = logging.getLogger(__name__)

BAN_LOGGER: Final = "homeassistant.components.http.ban"
CONF_NOTIFY: Final = "notify"
CONF_NOTIFY_SERVICES: Final = "notify_services"
CONF_TOKEN_DAYS: Final = "token_unused_days"
CONF_IGNORED_IPS: Final = "ignored_ips"
DEFAULT_TOKEN_DAYS: Final = 90
KEEP_SECONDS: Final = 7 * 86400
MAX_ATTEMPTS: Final = 1000
CACHE_SECONDS: Final = 3600
# A refusal from one IP notified once an hour at most
NOTIFY_EVERY: Final = 3600
STORE_KEY: Final = f"{DOMAIN}.security"
CACHE_KEY: Final = "security_cache"

_REFUSED = re.compile(
    r"invalid authentication from (?P<host>.+?) \((?P<ip>[0-9a-fA-F:.]+)\)\.(?: Requested URL: '(?P<url>.*?)'\.)?"
    r"(?: \((?P<agent>.*)\))?$"
)
_BANNED = re.compile(r"Banned IP (?P<ip>\S+) for too many login attempts")
# A key that holds a credential, and its value written in clear (not !secret, !env_var, !include, a template)
_SECRET_KEY = re.compile(
    r"^(?P<indent>\s*)(?:-\s+)?(?P<key>[A-Za-z0-9_]*(?:password|passwd|token|api_key|apikey|secret|client_secret)"
    r"[A-Za-z0-9_]*)\s*:\s*(?P<value>\S.*?)\s*$",
    re.IGNORECASE,
)
_SKIP_DIRS: Final = {".storage", ".cloud", "custom_components", "deps", "tts", "www", "node_modules", ".git", "backups"}


def settings(options: Any) -> dict[str, Any]:
    """The module's settings, with their defaults."""
    options = options if isinstance(options, dict) else {}
    return {
        CONF_NOTIFY: bool(options.get(CONF_NOTIFY, True)),
        CONF_NOTIFY_SERVICES: [str(s) for s in options.get(CONF_NOTIFY_SERVICES) or []],
        CONF_TOKEN_DAYS: int(options.get(CONF_TOKEN_DAYS) or DEFAULT_TOKEN_DAYS),
        CONF_IGNORED_IPS: [str(s) for s in options.get(CONF_IGNORED_IPS) or []],
    }


def is_internet(ip: str) -> bool:
    """An address from the Internet: not private, loopback or link-local."""
    try:
        address = ipaddress.ip_address(ip)
    except ValueError:
        return False
    return not (address.is_private or address.is_loopback or address.is_link_local)


class _Handler(logging.Handler):
    def __init__(self, watcher: SecurityWatcher) -> None:
        super().__init__(logging.WARNING)
        self.watcher = watcher

    def emit(self, record: logging.LogRecord) -> None:
        try:
            message = record.getMessage()
        except Exception:  # noqa: BLE001 - a record that cannot be formatted is skipped
            return
        self.watcher.hass.loop.call_soon_threadsafe(self.watcher.record, message, record.created)


class SecurityWatcher:
    """The refused logins and the bans, as the http component logs them, kept 7 days."""

    def __init__(self, hass: HomeAssistant, options: dict[str, Any]) -> None:
        self.hass = hass
        self.options = settings(options)
        self.attempts: list[dict[str, Any]] = []
        self.banned: dict[str, float] = {}
        self._store: Store[dict[str, Any]] = Store(hass, 1, STORE_KEY)
        self._handler = _Handler(self)
        self._notified: dict[str, float] = {}

    async def async_start(self) -> None:
        data = await self._store.async_load() or {}
        since = time.time() - KEEP_SECONDS
        self.attempts = [a for a in data.get("attempts", []) if a.get("at", 0) > since]
        self.banned = {ip: at for ip, at in (data.get("banned") or {}).items() if at > since}
        logging.getLogger(BAN_LOGGER).addHandler(self._handler)

    async def async_stop(self) -> None:
        logging.getLogger(BAN_LOGGER).removeHandler(self._handler)
        await self._store.async_save(self._data())

    def _data(self) -> dict[str, Any]:
        return {"attempts": self.attempts, "banned": self.banned}

    @callback
    def record(self, message: str, at: float) -> None:
        """A message of the http component: a refused login or a ban."""
        if banned := _BANNED.search(message):
            self.banned[banned["ip"]] = at
        elif refused := _REFUSED.search(message):
            ip = refused["ip"]
            self.attempts.append(
                {
                    "ip": ip,
                    "host": refused["host"] if refused["host"] != ip else None,
                    "url": refused["url"],
                    "agent": refused["agent"],
                    "at": at,
                }
            )
            since = time.time() - KEEP_SECONDS
            self.attempts = [a for a in self.attempts if a["at"] > since][-MAX_ATTEMPTS:]
            self._maybe_notify(ip, refused["url"])
        else:
            return
        self._store.async_delay_save(self._data, 10)

    def _maybe_notify(self, ip: str, url: str | None) -> None:
        if not self.options[CONF_NOTIFY] or not is_internet(ip) or ip in self.options[CONF_IGNORED_IPS]:
            return
        if time.time() - self._notified.get(ip, 0) < NOTIFY_EVERY:
            return
        self._notified[ip] = time.time()
        self.hass.async_create_task(self._async_notify(ip, url))

    async def _async_notify(self, ip: str, url: str | None) -> None:
        """A persistent notification (one per address, replaced) and the notify actions chosen."""
        strings = await async_get_translations(self.hass, self.hass.config.language, "common", [DOMAIN])
        prefix = f"component.{DOMAIN}.common.security_refused"
        title = strings.get(f"{prefix}_title", "Login refused from the Internet")
        try:
            message = strings.get(prefix, "Refused login from {ip}.").format(ip=ip, url=url or "/")
        except (KeyError, IndexError, ValueError):
            message = f"Refused login from {ip}."
        persistent_notification.async_create(self.hass, message, title=title, notification_id=f"{DOMAIN}_security_{ip}")
        await async_send_notify(self.hass, self.options[CONF_NOTIFY_SERVICES], title, message)

    def refused(self) -> list[dict[str, Any]]:
        """The refused logins by IP, the latest first."""
        now = time.time()
        by_ip: dict[str, dict[str, Any]] = {}
        for attempt in self.attempts:
            row = by_ip.setdefault(
                attempt["ip"],
                {"ip": attempt["ip"], "host": None, "count": 0, "day": 0, "last": 0, "url": None, "agent": None},
            )
            row["count"] += 1
            row["day"] += now - attempt["at"] < 86400
            if attempt["at"] >= row["last"]:
                row.update(last=attempt["at"], url=attempt.get("url"), agent=attempt.get("agent"))
                row["host"] = attempt.get("host") or row["host"]
        ignored = set(self.options[CONF_IGNORED_IPS])
        rows = [{**row, "internet": is_internet(row["ip"]), "ignored": row["ip"] in ignored} for row in by_ip.values()]
        return sorted(rows, key=lambda r: -r["last"])


def _bans(hass: HomeAssistant, watcher: SecurityWatcher | None) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """The IP bans and the HTTP settings that protect the instance."""
    http = getattr(hass, "http", None)
    app = getattr(http, "app", None)
    bans: list[dict[str, Any]] = []
    threshold = 0
    try:
        from homeassistant.components.http.ban import KEY_BAN_MANAGER, KEY_LOGIN_THRESHOLD  # noqa: PLC0415

        if app is not None and KEY_BAN_MANAGER in app:
            threshold = int(app[KEY_LOGIN_THRESHOLD])
            for ip, ban in app[KEY_BAN_MANAGER].ip_bans_lookup.items():
                bans.append({"ip": str(ip), "at": ban.banned_at.timestamp(), "internet": is_internet(str(ip))})
    except (ImportError, KeyError, AttributeError):
        pass
    recent = watcher.banned if watcher else {}
    for ban in bans:
        ban["at"] = max(ban["at"], recent.get(ban["ip"], 0))
    external = hass.config.external_url or ""
    # Read as the cloud integration keeps it (hass.data["cloud"]): importing it would make it a dependency
    cloud_data = hass.data.get("cloud")
    cloud = bool(getattr(getattr(cloud_data, "iot", None), "connected", False))
    exposure = {
        "external_url": external or None,
        "https": external.startswith("https://") if external else None,
        "internal_url": hass.config.internal_url,
        "ssl_certificate": bool(getattr(http, "ssl_certificate", None)),
        "trusted_proxies": [str(p) for p in getattr(http, "trusted_proxies", None) or []],
        "ip_ban": threshold > 0,
        "login_threshold": threshold,
        "cloud": cloud,
    }
    return sorted(bans, key=lambda b: -b["at"]), exposure


async def _accounts(hass: HomeAssistant, unused_days: int) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """The accounts (system ones left out) and the long-lived tokens."""
    from homeassistant.auth.models import TOKEN_TYPE_LONG_LIVED_ACCESS_TOKEN, TOKEN_TYPE_NORMAL  # noqa: PLC0415

    now = time.time()
    users: list[dict[str, Any]] = []
    tokens: list[dict[str, Any]] = []
    for user in await hass.auth.async_get_users():
        if user.system_generated:
            continue
        mfa = await hass.auth.async_get_enabled_mfa(user)
        sessions = [t for t in user.refresh_tokens.values() if t.token_type == TOKEN_TYPE_NORMAL]
        used = [t.last_used_at.timestamp() for t in user.refresh_tokens.values() if t.last_used_at]
        users.append(
            {
                "id": user.id,
                "name": user.name or "?",
                "owner": user.is_owner,
                "admin": user.is_admin,
                "active": user.is_active,
                "local_only": user.local_only,
                "mfa": bool(mfa),
                "sessions": len(sessions),
                "last_used": max(used) if used else None,
            }
        )
        for token in user.refresh_tokens.values():
            if token.token_type != TOKEN_TYPE_LONG_LIVED_ACCESS_TOKEN:
                continue
            last = token.last_used_at.timestamp() if token.last_used_at else None
            created = token.created_at.timestamp()
            tokens.append(
                {
                    "id": token.id,
                    "name": token.client_name or "?",
                    "user": user.name or "?",
                    "created": created,
                    "last_used": last,
                    "last_ip": token.last_used_ip,
                    "unused": now - (last or created) > unused_days * 86400,
                }
            )
    users.sort(key=lambda u: (not u["owner"], not u["admin"], not u["active"], u["name"].lower()))
    tokens.sort(key=lambda t: (not t["unused"], -(t["last_used"] or 0)))
    return users, tokens


async def _addons(hass: HomeAssistant) -> list[dict[str, Any]] | None:
    """The add-ons and what they are allowed to do, from the Supervisor; None without it."""
    if "hassio" not in hass.config.components:
        return None
    from homeassistant.components.hassio import get_supervisor_client  # noqa: PLC0415

    client = get_supervisor_client(hass)
    items = await client.addons.list()
    infos = await asyncio.gather(*(client.addons.addon_info(item.slug) for item in items), return_exceptions=True)
    rows = []
    for item, info in zip(items, infos, strict=True):
        if isinstance(info, BaseException):
            continue
        rows.append(
            {
                "slug": item.slug,
                "name": item.name,
                "protected": bool(getattr(info, "protected", True)),
                "full_access": bool(getattr(info, "full_access", False)),
                "host_network": bool(getattr(info, "host_network", False)),
                "rating": getattr(info, "rating", None),
            }
        )
    return rows


def scan_config(folder: str) -> list[dict[str, Any]]:
    """The credentials written in clear in the YAML files: the file, the line and the key, never the value."""
    root = Path(folder)
    found: list[dict[str, Any]] = []
    for path in sorted(root.rglob("*.yaml")):
        parts = path.relative_to(root).parts
        if any(p in _SKIP_DIRS or p.startswith(".") for p in parts[:-1]) or path.name == "secrets.yaml":
            continue
        try:
            lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
        except OSError:
            continue
        for number, line in enumerate(lines, 1):
            if line.lstrip().startswith("#"):
                continue
            match = _SECRET_KEY.match(line)
            if not match:
                continue
            value = match["value"].split(" #")[0].strip().strip("'\"")
            if (
                not value
                or value.startswith(("!secret", "!env_var", "!include", "{{", "{%", "|", ">"))
                or value.lower() in ("null", "none", "true", "false", "~")
                or value.replace(".", "", 1).isdigit()
            ):
                continue
            found.append({"file": str(path.relative_to(root)), "line": number, "key": match["key"]})
            if len(found) >= 50:
                return found
    return found


async def security_state(
    hass: HomeAssistant, store: dict[str, Any], watcher: SecurityWatcher | None, options: Any, force: bool = False
) -> dict[str, Any]:
    """Everything the Security tab shows."""
    chosen = settings(options)
    bans, exposure = _bans(hass, watcher)
    users, tokens = await _accounts(hass, chosen[CONF_TOKEN_DAYS])
    cached = store.get(CACHE_KEY)
    if force or not cached or time.time() - cached["at"] > CACHE_SECONDS:
        try:
            addons = await _addons(hass)
        except Exception as err:  # noqa: BLE001 - the Supervisor busy must not hide the rest
            _LOGGER.debug("Could not read the add-ons: %s", err)
            addons = cached["addons"] if cached else None
        config = await hass.async_add_executor_job(scan_config, hass.config.config_dir)
        cached = store[CACHE_KEY] = {"at": time.time(), "addons": addons, "config": config}
    return {
        "refused": watcher.refused() if watcher else [],
        "bans": bans,
        "exposure": exposure,
        "users": users,
        "tokens": tokens,
        "addons": cached["addons"],
        "config": cached["config"],
        "scanned_at": cached["at"],
        "token_unused_days": chosen[CONF_TOKEN_DAYS],
    }
