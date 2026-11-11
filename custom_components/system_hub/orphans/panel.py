"""What the panel's Orphans tab shows: a summary in `system_hub/state`, the whole list from `system_hub/orphans`."""

from __future__ import annotations

from typing import Any

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import HomeAssistant, callback
from homeassistant.loader import async_get_loaded_integration

from ..const import DOMAIN
from .entities import orphans_list
from .scanner import OrphanScanner


def summary(scanner: OrphanScanner) -> dict[str, Any]:
    """The counts by reason, the orphan devices and the scans, for the tab's tiles."""
    return {
        "total": len(scanner.orphans),
        "counts": scanner.counts(),
        "devices": len(scanner.devices),
        "removed": scanner.removed,
        "ignored": len(scanner.ignored_entities),
        "last_scan": scanner.last_scan.isoformat() if scanner.last_scan else None,
        "next_scan": scanner.next_scan.isoformat() if scanner.next_scan else None,
        "stale_hours": scanner.stale_hours,
    }


def _integration_names(hass: HomeAssistant, domains: set[str]) -> dict[str, str]:
    """The names of the integrations loaded among `domains`; the others are shown by their domain."""
    names = {}
    for domain in domains:
        try:
            names[domain] = async_get_loaded_integration(hass, domain).name
        except Exception:  # noqa: BLE001 - not loaded (removed, YAML platform gone): the domain is the name
            continue
    return names


@websocket_api.require_admin
@websocket_api.websocket_command({vol.Required("type"): "system_hub/orphans"})
@callback
def ws_orphans(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Every orphan entity and device of the last scan, with what uses it and the integrations' names."""
    entry = next((e for e in hass.config_entries.async_entries(DOMAIN) if e.state is ConfigEntryState.LOADED), None)
    scanner = entry.runtime_data.orphans if entry is not None else None
    if scanner is None:
        connection.send_error(msg["id"], "module_disabled", "The Orphans module is turned off")
        return
    listed = orphans_list(scanner)
    domains = {item["platform"] for item in listed["entities"]}
    connection.send_result(msg["id"], {**summary(scanner), **listed, "integrations": _integration_names(hass, domains)})
