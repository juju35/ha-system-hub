"""Diagnostics for System Hub: options and the state of each module turned on, without personal data."""

from __future__ import annotations

from dataclasses import asdict
from typing import Any

from homeassistant.components.diagnostics import async_redact_data
from homeassistant.core import HomeAssistant

from . import SystemHubConfigEntry, enabled_modules
from .marketplace import refresher as refresher_module
from .watchdog.const import CONF_NOTIFY

# Entry titles often hold an e-mail address, a user name or a host (one per account or device), and notify
# action names often a person's name (notify.mobile_app_<phone>). Domains and entry ids are kept.
TO_REDACT = {
    "title",
    "switch_name",
    CONF_NOTIFY,
    "username",
    "password",
    "email",
    "host",
    "url",
    "token",
    "access_token",
    "refresh_token",
    "github_token",
    "api_key",
}


async def async_get_config_entry_diagnostics(hass: HomeAssistant, entry: SystemHubConfigEntry) -> dict[str, Any]:
    data: dict[str, Any] = {
        "entry": {"data": dict(entry.data), "options": dict(entry.options)},
        "modules": enabled_modules(entry),
    }
    if (watchdog := entry.runtime_data.watchdog) is not None:
        data |= _watchdog(watchdog)
    if (refresher := entry.runtime_data.marketplace) is not None:
        data |= _marketplace(hass, refresher)
    return async_redact_data(data, TO_REDACT)


def _watchdog(watchdog: Any) -> dict[str, Any]:
    last_reload = watchdog.last_reload
    return {
        "watchdog": {
            "ignored": sorted(watchdog.ignored),
            "ignored_entries": sorted(watchdog.ignored_entries),
            "grace_period": watchdog.grace_period.total_seconds(),
            "grace_overrides": {d: g.total_seconds() for d, g in watchdog.grace_overrides.items()},
            "max_reloads": watchdog.max_reloads,
            "running": watchdog.running,
            "started_at": watchdog.started_at.isoformat() if watchdog.started_at else None,
            "last_check": watchdog.last_check.isoformat() if watchdog.last_check else None,
            "reloads": watchdog.reloads,
            "last_reload": {**asdict(last_reload), "at": last_reload.at.isoformat()} if last_reload else None,
            "unavailable": [watchdog.as_dict(item) for item in watchdog.unavailable],
            "attempts": {entry_id: attempts.as_dict() for entry_id, attempts in watchdog.attempts.items()},
            "history": watchdog.history,
            "power_cycles": [
                {
                    "device_id": c.device_id,
                    "switch": c.switch,
                    "delay": c.delay.total_seconds(),
                    "off_time": c.off_time.total_seconds(),
                }
                for c in watchdog.power_cycles
            ],
            "power_cycle_attempts": {d: a.as_dict() for d, a in watchdog.cycle_attempts.items()},
            "powered_off": sorted(watchdog.powered_off),
        }
    }


def _marketplace(hass: HomeAssistant, refresher: Any) -> dict[str, Any]:
    marketplace = refresher_module._loaded_marketplace(hass)  # noqa: SLF001 - same package, patched in tests
    system = getattr(marketplace, "system", None)
    repositories = getattr(marketplace, "repositories", None)
    return {
        "marketplace_refresher": {
            "state": refresher.state,
            "done": refresher.done,
            "total": refresher.total,
            "updates": refresher.updates,
            "pending": refresher.pending,
            "failed": list(refresher.failed),
            "not_checked": list(refresher.not_checked),
            "error": refresher.error,
            "checking": sorted(refresher.checking),
            "installing": list(refresher.installing),
            "install_failed": list(refresher.install_failed),
            "github_connected": refresher.github_connected,
            "last_check": refresher.last_check.isoformat() if refresher.last_check else None,
            "next_due": refresher.next_due.isoformat() if refresher.next_due else None,
            "since": refresher.since.isoformat() if refresher.since else None,
        },
        "marketplace_integration": {
            "loaded": marketplace is not None,
            "github_connected": getattr(marketplace, "github_connected", None),
            "disabled": getattr(system, "disabled", None),
            "disabled_reason": str(reason) if (reason := getattr(system, "disabled_reason", None)) else None,
            "installed": len(getattr(repositories, "list_installed", None) or []),
        },
    }
