"""Diagnostics for System Hub: options and the state of each module turned on, without personal data."""

from __future__ import annotations

from dataclasses import asdict
from typing import Any

from homeassistant.components.diagnostics import async_redact_data
from homeassistant.core import HomeAssistant

from . import SystemHubConfigEntry, enabled_modules
from .git_sync.const import CONF_AUTHOR_EMAIL, CONF_AUTHOR_NAME, CONF_SSH_KEY
from .git_sync.git import redact_credentials, redact_url
from .marketplace import refresher as refresher_module
from .orphans.entities import orphans_list
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
    "ip_address",
    CONF_SSH_KEY,
    CONF_AUTHOR_NAME,
    CONF_AUTHOR_EMAIL,
    "secret",
    "private_key",
    "public_key",
    # Orphans: the config entry titles of the orphans, and what vehicles and parcels are often named by.
    "entry_title",
    "plate",
    "tracking_number",
    "vin",
}


def _git_sync(coordinator: Any) -> dict[str, Any]:
    """The repository's state; its remote keeps its host but loses any user and password."""
    state: dict[str, Any] | None = None
    if coordinator.data is not None:
        state = asdict(coordinator.data)
        state["remote_url"] = redact_url(state["remote_url"])
        if state["last_error"]:
            state["last_error"] = redact_credentials(state["last_error"])
    return {"last_update_success": coordinator.last_update_success, "data": state}


async def async_get_config_entry_diagnostics(hass: HomeAssistant, entry: SystemHubConfigEntry) -> dict[str, Any]:
    options = dict(entry.options)
    if isinstance(git_options := options.get("git_sync"), dict) and isinstance(git_options.get("remote"), str):
        # A remote given as a URL keeps its host but loses its user and password.
        options["git_sync"] = {**git_options, "remote": redact_url(git_options["remote"])}
    data: dict[str, Any] = {
        "entry": {"data": dict(entry.data), "options": options},
        "modules": enabled_modules(entry),
    }
    if (monitor := entry.runtime_data.containers) is not None:
        data["containers"] = {
            "last_update": monitor.last_update.isoformat() if monitor.last_update else None,
            "error": monitor.error,
            "containers": [c.as_dict() for c in monitor.containers.values()],
        }
    if (batteries := entry.runtime_data.batteries) is not None:
        data["batteries"] = {
            "threshold": batteries.threshold,
            "duration_hours": batteries.duration.total_seconds() / 3600,
            "ignored_entities": sorted(batteries.ignored_entities),
            "ignored_integrations": sorted(batteries.ignored_integrations),
            "notify_services_count": len(batteries.notify_services),
            "last_notification": batteries.last_notification.isoformat() if batteries.last_notification else None,
            "last_notified": batteries.last_notified,
            "forecast_at": batteries.forecast_at.isoformat() if batteries.forecast_at else None,
            "batteries": [b.as_dict() for b in batteries.batteries],
        }
    if (git := entry.runtime_data.git_sync) is not None:
        data["git_sync"] = _git_sync(git)
        if further := entry.runtime_data.git_syncs[1:]:
            data["git_sync_repositories"] = {c.repo_id: _git_sync(c) for c in further}
    if (watchdog := entry.runtime_data.watchdog) is not None:
        data |= _watchdog(watchdog)
    if (refresher := entry.runtime_data.marketplace) is not None:
        data |= _marketplace(hass, refresher)
    if (scanner := entry.runtime_data.orphans) is not None:
        data["orphans"] = _orphans(scanner)
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


def _orphans(scanner: Any) -> dict[str, Any]:
    """The last scan; config entry titles (often an account or a host) are redacted with "entry_title"."""
    return {
        "ready": scanner.ready,
        "started_at": scanner.started_at.isoformat() if scanner.started_at else None,
        "next_scan": scanner.next_scan.isoformat() if scanner.next_scan else None,
        "last_scan": scanner.last_scan.isoformat() if scanner.last_scan else None,
        "removed": scanner.removed,
        "counts": scanner.counts(),
        **{k: v for k, v in orphans_list(scanner).items() if k in ("entities", "devices")},
    }
