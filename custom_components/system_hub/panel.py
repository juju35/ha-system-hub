"""Sidebar panel (administrators): one tab per module turned on, the System tab and the settings.

The panel draws its own content from the `system_hub/state` WebSocket command, which gathers what every module
holds, and the System Monitor sensors; `system_hub/update_settings` turns modules on or off and orders the tabs.
The actions of the panel are the integration's own actions, called by the panel.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er

from .const import (
    CONF_MODULES,
    CONF_SYSTEM,
    CONF_TABS,
    DEFAULT_THRESHOLDS,
    DOMAIN,
    MODULE_GIT_SYNC,
    MODULES,
    TAB_SYSTEM,
)
from .orphans import panel as orphans_panel

STATIC_URL = f"/{DOMAIN}_static"
FRONTEND_DIR = Path(__file__).parent / "frontend"
MODULE = "system-hub-panel.js"
ELEMENT = "system-hub-panel"
PANEL_PATH = "system-hub"
PANEL_ICON = "mdi:home-analytics"
TITLE = "System Hub"
TABS = (TAB_SYSTEM, *MODULES)

# System Monitor sensors shown in the System tab, by translation key; per-disk and per-interface ones carry their
# mount point or interface in their name.
SYSTEM_KEYS = (
    "processor_use",
    "processor_temperature",
    "memory_use_percent",
    "memory_use",
    "memory_free",
    "swap_use_percent",
    "swap_use",
    "swap_free",
    "ipv4_address",
    "network_in",
    "network_out",
    "load_1m",
    "load_5m",
    "load_15m",
    "last_boot",
    "disk_use_percent",
    "disk_use",
    "disk_free",
    "throughput_network_in",
    "throughput_network_out",
)


def _version() -> str:
    manifest = json.loads((Path(__file__).parent / "manifest.json").read_text(encoding="utf-8"))
    return str(manifest.get("version", "0"))


async def async_register_panel(hass: HomeAssistant) -> None:
    """Serve the panel's module (once per run), add it to the sidebar for administrators and its commands."""
    if "frontend" not in hass.config.components:
        return
    from homeassistant.components import frontend  # noqa: PLC0415 - the frontend is optional
    from homeassistant.components.http import StaticPathConfig  # noqa: PLC0415

    data = hass.data.setdefault(DOMAIN, {})
    if not data.get("panel_registered"):
        # Cached by the browser: the panel URL carries the version, so a new release is fetched again.
        await hass.http.async_register_static_paths([StaticPathConfig(STATIC_URL, str(FRONTEND_DIR), True)])
        websocket_api.async_register_command(hass, ws_state)
        websocket_api.async_register_command(hass, ws_update_settings)
        websocket_api.async_register_command(hass, orphans_panel.ws_orphans)
        data["panel_registered"] = True
    if PANEL_PATH in hass.data.get(frontend.DATA_PANELS, {}):
        return
    version = await hass.async_add_executor_job(_version)
    frontend.async_register_built_in_panel(
        hass,
        component_name="custom",
        sidebar_title=TITLE,
        sidebar_icon=PANEL_ICON,
        frontend_url_path=PANEL_PATH,
        require_admin=True,
        config={
            "_panel_custom": {
                "name": ELEMENT,
                "module_url": f"{STATIC_URL}/{MODULE}?v={version}",
                "embed_iframe": False,
                "trust_external": False,
            }
        },
    )


@callback
def async_remove_panel(hass: HomeAssistant) -> None:
    if "frontend" not in hass.config.components:
        return
    from homeassistant.components import frontend  # noqa: PLC0415

    if PANEL_PATH in hass.data.get(frontend.DATA_PANELS, {}):
        frontend.async_remove_panel(hass, PANEL_PATH)


def tab_order(options: dict[str, Any]) -> list[str]:
    """The tabs in the order chosen, every known tab once (new ones at the end); Settings is always last."""
    chosen = options.get(CONF_TABS)
    order = [t for t in chosen if t in TABS] if isinstance(chosen, list) else []
    order = list(dict.fromkeys(order))
    return [*order, *(t for t in TABS if t not in order)]


def _entry(hass: HomeAssistant) -> Any | None:
    return next((e for e in hass.config_entries.async_entries(DOMAIN) if e.state is ConfigEntryState.LOADED), None)


# Home Assistant's own backups (the Backup integration's sensors), by translation key.
BACKUP_KEYS = (
    "last_successful_automatic_backup",
    "last_attempted_automatic_backup",
    "next_scheduled_automatic_backup",
    "backup_manager_state",
)


def _key(hass: HomeAssistant, item: er.RegistryEntry) -> str | None:
    """What the System tab shows an entity as: System Monitor sensor or process, backup sensor, database size."""
    if item.platform == "systemmonitor":
        if item.domain == "binary_sensor":
            return "process" if item.translation_key == "process" else None
        key = item.translation_key or ("last_boot" if item.original_device_class == "timestamp" else None)
        key = "last_boot" if key == "uptime" else key
        return key if key in SYSTEM_KEYS else None
    if item.platform == "backup" and item.translation_key in BACKUP_KEYS:
        return f"backup_{item.translation_key}"
    # The File Size integration on the recorder's database (home-assistant_v2.db)
    if item.platform == "filesize" and item.translation_key == "size" and item.config_entry_id:
        entry = hass.config_entries.async_get_entry(item.config_entry_id)
        if entry and str(entry.data.get("file_path", "")).endswith(".db"):
            return "database_size"
    return None


def thresholds(options: dict[str, Any]) -> dict[str, list[int]]:
    """The System tab's thresholds (orange, red) chosen, the defaults for the others."""
    chosen = options.get(CONF_SYSTEM) if isinstance(options.get(CONF_SYSTEM), dict) else {}
    result = {}
    for key, (warn, crit) in DEFAULT_THRESHOLDS.items():
        result[key] = [int(chosen.get(f"{key}_warning", warn)), int(chosen.get(f"{key}_critical", crit))]
    return result


def _updates(hass: HomeAssistant) -> list[dict[str, Any]]:
    """Home Assistant Core and OS: installed and latest versions, whether an update is available."""
    updates = []
    for key, entity_id in (
        ("core", "update.home_assistant_core_update"),
        ("os", "update.home_assistant_operating_system_update"),
    ):
        if (state := hass.states.get(entity_id)) is None:
            continue
        updates.append(
            {
                "key": key,
                "entity_id": entity_id,
                "state": state.state,
                "installed": state.attributes.get("installed_version"),
                "latest": state.attributes.get("latest_version"),
            }
        )
    return updates


def _system(hass: HomeAssistant) -> list[dict[str, Any]]:
    """System Monitor sensors and processes, backups, database size: key, entity id, name, state, unit."""
    registry = er.async_get(hass)
    sensors = []
    for item in sorted(registry.entities.values(), key=lambda e: e.entity_id):
        if item.disabled_by or item.hidden_by or item.platform not in ("systemmonitor", "backup", "filesize"):
            continue
        key = _key(hass, item)
        if key is None or (state := hass.states.get(item.entity_id)) is None:
            continue
        sensors.append(
            {
                "key": key,
                "entity_id": item.entity_id,
                "name": state.name,
                "state": state.state,
                "unit": state.attributes.get("unit_of_measurement"),
            }
        )
    return sensors


def _containers(monitor: Any) -> dict[str, Any]:
    return {
        "last_update": monitor.last_update.isoformat() if monitor.last_update else None,
        "error": monitor.error,
        "containers": [c.as_dict() for c in monitor.containers.values()],
        "history": {slug: list(points) for slug, points in monitor.history.items()},
    }


def _power_cycles(hass: HomeAssistant, watchdog: Any) -> list[dict[str, Any]]:
    """The power cycles set up: the device and its room, the plug and its state, the delays, the current count."""
    unavailable = {cycle.device_id for cycle, _ in watchdog.async_find_unavailable_devices()}
    devices = dr.async_get(hass)
    areas = ar.async_get(hass)
    cycles = []
    for cycle in watchdog.power_cycles:
        device = devices.async_get(cycle.device_id)
        area = areas.async_get_area(device.area_id) if device and device.area_id else None
        plug = hass.states.get(cycle.switch)
        attempts = watchdog.cycle_attempts.get(cycle.device_id)
        cycles.append(
            {
                "device_id": cycle.device_id,
                "device_name": (device.name_by_user or device.name) if device else None,
                "area": area.name if area else None,
                "switch": cycle.switch,
                "switch_name": plug.name if plug else None,
                "switch_state": plug.state if plug else None,
                "delay": int(cycle.delay.total_seconds() // 60),
                "off_time": int(cycle.off_time.total_seconds()),
                "unavailable": cycle.device_id in unavailable,
                "count": attempts.count if attempts else 0,
                "gave_up": attempts.gave_up if attempts else False,
                "last": attempts.last.isoformat() if attempts and attempts.last else None,
            }
        )
    return cycles


def _watchdog(hass: HomeAssistant, watchdog: Any) -> dict[str, Any]:
    return {
        "running": watchdog.running,
        "paused": watchdog.paused,
        "last_check": watchdog.last_check.isoformat() if watchdog.last_check else None,
        "reloads": watchdog.reloads,
        "max_reloads": watchdog.max_reloads,
        "unavailable": [watchdog.as_dict(u) for u in watchdog.unavailable],
        "history": list(watchdog.history),
        "power_cycles": _power_cycles(hass, watchdog),
    }


def _marketplace(refresher: Any) -> dict[str, Any]:
    return {
        "state": refresher.state,
        "done": refresher.done,
        "total": refresher.total,
        "updates": refresher.updates,
        "pending": list(refresher.pending or []),
        "failed": list(refresher.failed),
        "not_checked": len(refresher.not_checked),
        "started_at": refresher.started_at.isoformat() if refresher.started_at else None,
        "github_connected": refresher.github_connected,
        "rate_limit_remaining": refresher.rate_limit_remaining,
        "retry_after": refresher.retry_after.isoformat() if refresher.retry_after else None,
        "error": refresher.error,
        "installing": list(refresher.installing),
        "installing_updates": refresher.installing_updates,
        "last_check": refresher.last_check.isoformat() if refresher.last_check else None,
        "next_due": refresher.next_due.isoformat() if refresher.next_due else None,
        "scan_interval": refresher.scan_interval,
    }


def _batteries(monitor: Any) -> dict[str, Any]:
    return {
        "threshold": monitor.threshold,
        "hide_ok": monitor.hide_ok,
        "low": len(monitor.low),
        "unavailable": len(monitor.unavailable),
        "batteries": [b.as_dict() for b in monitor.batteries],
        "spares": monitor.spares(),
        "last_notification": monitor.last_notification.isoformat() if monitor.last_notification else None,
    }


def _git_sync(coordinator: Any) -> dict[str, Any]:
    from .git_sync.git import redact_credentials, redact_url  # noqa: PLC0415

    data = coordinator.data
    if data is None:
        return {"available": False}
    head = data.head
    return {
        "available": coordinator.last_update_success,
        "status": data.status,
        "branch": data.git.branch,
        "ahead": data.git.ahead,
        "behind": data.git.behind,
        "files": list(data.git.files[:50]),
        "changed": len(data.git.files),
        "remote_url": redact_url(data.remote_url),
        "last_error": redact_credentials(data.last_error) if data.last_error else None,
        "last_commit": {"message": head.message, "sha": head.sha[:7], "timestamp": head.timestamp} if head else None,
        "last_push": data.last_push.isoformat() if data.last_push else None,
        "last_export": data.last_export.isoformat() if data.last_export else None,
        "ai_task": data.ai_task,
    }


@websocket_api.require_admin
@websocket_api.websocket_command({vol.Required("type"): "system_hub/state"})
@callback
def ws_state(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Everything the panel shows: the modules turned on, the tab order and each module's state."""
    entry = _entry(hass)
    if entry is None:
        connection.send_result(msg["id"], {"loaded": False})
        return
    from . import enabled_modules  # noqa: PLC0415 - avoids a circular import

    data = entry.runtime_data
    result: dict[str, Any] = {
        "loaded": True,
        "entry_id": entry.entry_id,
        "modules": enabled_modules(entry),
        "tabs": tab_order(dict(entry.options)),
        "git_sync_configured": data.git_sync is not None,
        "system": _system(hass),
        "updates": _updates(hass),
        "thresholds": thresholds(dict(entry.options)),
    }
    if data.containers is not None:
        result["containers"] = _containers(data.containers)
    if data.watchdog is not None:
        result["watchdog"] = _watchdog(hass, data.watchdog)
    if data.marketplace is not None:
        result["marketplace"] = _marketplace(data.marketplace)
    if data.batteries is not None:
        result["batteries"] = _batteries(data.batteries)
    if data.git_sync is not None:
        result["git_sync"] = _git_sync(data.git_sync)
    if data.orphans is not None:
        result["orphans"] = orphans_panel.summary(data.orphans)
    connection.send_result(msg["id"], result)


@websocket_api.require_admin
@websocket_api.websocket_command(
    {
        vol.Required("type"): "system_hub/update_settings",
        vol.Optional("modules"): [vol.In(MODULES)],
        vol.Optional("tabs"): [vol.In(TABS)],
    }
)
@websocket_api.async_response
async def ws_update_settings(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Turn modules on or off and order the tabs; the entry reloads with them."""
    entry = _entry(hass) or next(iter(hass.config_entries.async_entries(DOMAIN)), None)
    if entry is None:
        connection.send_error(msg["id"], "not_found", "System Hub is not set up")
        return
    options = dict(entry.options)
    if "modules" in msg:
        modules = [m for m in MODULES if m in msg["modules"]]
        git = options.get(MODULE_GIT_SYNC)
        if MODULE_GIT_SYNC in modules and not (isinstance(git, dict) and git.get("repo_path")):
            # The repository must be checked first: only the options flow does that.
            connection.send_error(msg["id"], "git_sync_needs_repository", "Set up the repository in Configure")
            return
        options[CONF_MODULES] = modules
    if "tabs" in msg:
        options[CONF_TABS] = tab_order({CONF_TABS: msg["tabs"]})
    hass.config_entries.async_update_entry(entry, options=options)
    connection.send_result(msg["id"], {"modules": options.get(CONF_MODULES), "tabs": tab_order(options)})
