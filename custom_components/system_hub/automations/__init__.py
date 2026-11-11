"""Automations module: what Automation Monitor reports, shown in the panel's Automations tab.

The module has no entity of its own; its settings leave devices and entities out, as the card's exclude_devices and
exclude_entities do. It reads the two sensors of the Automation Monitor integration
(https://github.com/olli-dot-dev/ha-automation-monitor), found in the entity registry by platform and translation key
(the default entity ids are a fallback), as the Automation Monitor card does; the tab's buttons call that
integration's own actions (automation_monitor.reset, automation_monitor.rebuild_linked_entities).
"""

from __future__ import annotations

import re
from collections.abc import Callable, Iterable
from typing import Any, Final
from urllib.parse import quote

from homeassistant.const import STATE_UNAVAILABLE, STATE_UNKNOWN
from homeassistant.core import HomeAssistant, State
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er

AUTOMATION_MONITOR: Final = "automation_monitor"
# The two sensors of Automation Monitor, by translation key.
KEYS: Final = {"failed": "failed_automations", "linked": "linked_entities_unavailable"}
# Settings: devices (ids or names) and entities (ids or patterns with * and ?) left out of the lists, counts and status.
CONF_EXCLUDE_DEVICES: Final = "exclude_devices"
CONF_EXCLUDE_ENTITIES: Final = "exclude_entities"


def _values(value: Any) -> list[str]:
    items = value if isinstance(value, (list, tuple)) else [value] if value else []
    return [str(v).strip() for v in items if str(v).strip()]


def excluded_devices(hass: HomeAssistant, value: Any) -> set[str]:
    """The ids of the devices to ignore: given by id, or by name (as the card's YAML allows)."""
    wanted = _values(value)
    ids = set(wanted)
    names = {v.casefold() for v in wanted}
    if names:
        registry = dr.async_get(hass)
        # Iterating the registry gives the device entries since 2026.11 (their ids before): both are handled.
        for item in list(registry.devices):
            device = registry.async_get(item) if isinstance(item, str) else item
            if device is None:
                continue
            name = (device.name_by_user or device.name or "").casefold()
            if name and name in names:
                ids.add(device.id)
    return ids


def entity_matcher(value: Any) -> Callable[[str], bool] | None:
    """A test on an entity id: an id listed, or a pattern with * (any characters) and ? (one); case-insensitive."""
    wanted = [v.lower() for v in _values(value)]
    if not wanted:
        return None
    ids = {v for v in wanted if "*" not in v and "?" not in v}
    globs = [
        re.compile("^" + re.escape(v).replace(r"\*", ".*").replace(r"\?", ".") + "$")
        for v in wanted
        if "*" in v or "?" in v
    ]
    return lambda entity_id: (s := str(entity_id).lower()) in ids or any(g.match(s) for g in globs)


def _sensors(hass: HomeAssistant) -> dict[str, str]:
    """The entity ids of Automation Monitor's sensors: {"failed": ..., "linked": ...}, those found."""
    found: dict[str, str] = {}
    for item in er.async_get(hass).entities.values():
        if item.platform != AUTOMATION_MONITOR:
            continue
        for kind, key in KEYS.items():
            if item.translation_key == key and kind not in found:
                found[kind] = item.entity_id
    for kind, key in KEYS.items():
        if kind not in found and hass.states.get(f"sensor.{key}") is not None:
            found[kind] = f"sensor.{key}"
    return found


def _valid(state: State | None) -> bool:
    return state is not None and state.state not in (STATE_UNAVAILABLE, STATE_UNKNOWN)


def _path(hass: HomeAssistant, entity_id: str, unique_id: Any, page: str) -> str | None:
    """The editor (page "edit") or the trace (page "trace") of an automation, script or scene."""
    domain, _, object_id = str(entity_id).partition(".")
    state = hass.states.get(entity_id)
    if domain == "script":
        key = unique_id or object_id
        return f"/config/script/{page}/{quote(str(key), safe='')}" if key else None
    if domain not in ("automation", "scene") or (domain == "scene" and page != "edit"):
        return None
    ident = state.attributes.get("id") if state else None
    ident = ident or unique_id
    return f"/config/{domain}/{page}/{quote(str(ident), safe='')}" if ident else None


def _name(hass: HomeAssistant, entity_id: str, name: Any) -> str:
    if name:
        return str(name)
    state = hass.states.get(entity_id)
    return state.name if state else entity_id


def _failure(hass: HomeAssistant, item: dict[str, Any]) -> dict[str, Any]:
    entity_id = str(item.get("entity_id", ""))
    step = item.get("error_step")
    count = item.get("consecutive_failures")
    return {
        "entity_id": entity_id,
        "name": _name(hass, entity_id, item.get("name")),
        "last_error_time": item.get("last_error_time"),
        "error_message": item.get("error_message") or None,
        "error_step": step if step and step != "unknown" else None,
        "consecutive_failures": count if isinstance(count, int) and not isinstance(count, bool) else 0,
        "trace": _path(hass, entity_id, item.get("unique_id"), "trace"),
        "edit": _path(hass, entity_id, item.get("unique_id"), "edit"),
    }


def _used_by(hass: HomeAssistant, item: dict[str, Any]) -> list[dict[str, Any]]:
    details = item.get("referenced_by_details")
    if not (isinstance(details, list) and details):
        details = [{"entity_id": ref} for ref in item.get("referenced_by") or []]
    sources = []
    for ref in details:
        src = ref if isinstance(ref, dict) else {"entity_id": ref}
        entity_id = str(src.get("entity_id", ""))
        if not entity_id:
            continue
        sources.append(
            {
                "entity_id": entity_id,
                "name": _name(hass, entity_id, src.get("name")),
                "edit": _path(hass, entity_id, src.get("unique_id"), "edit"),
            }
        )
    return sources


def _linked(hass: HomeAssistant, item: dict[str, Any]) -> dict[str, Any]:
    entity_id = str(item.get("entity_id", ""))
    return {
        "entity_id": entity_id,
        "name": _name(hass, entity_id, item.get("name")),
        "unavailable_since": item.get("unavailable_since"),
        "used_by": _used_by(hass, item),
    }


def _items(state: State | None, attribute: str) -> list[dict[str, Any]]:
    value = state.attributes.get(attribute) if _valid(state) and state else None
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, dict) and item.get("entity_id")]


def _device_of(hass: HomeAssistant, item: dict[str, Any]) -> str | None:
    """The device of an item: the device_id Automation Monitor gives, else the entity registry's."""
    if item.get("device_id"):
        return str(item["device_id"])
    entry = er.async_get(hass).async_get(str(item.get("entity_id", "")))
    return entry.device_id if entry else None


def _kept(
    hass: HomeAssistant, items: Iterable[dict[str, Any]], devices: set[str], matcher: Callable[[str], bool] | None
) -> list[dict[str, Any]]:
    return [
        item
        for item in items
        if not (devices and _device_of(hass, item) in devices) and not (matcher and matcher(item["entity_id"]))
    ]


def state(hass: HomeAssistant, options: dict[str, Any] | None = None) -> dict[str, Any]:
    """What the Automations tab shows: Automation Monitor's failed automations and unavailable linked entities,
    without the devices and entities the settings leave out."""
    options = options or {}
    devices = excluded_devices(hass, options.get(CONF_EXCLUDE_DEVICES))
    matcher = entity_matcher(options.get(CONF_EXCLUDE_ENTITIES))
    sensors = _sensors(hass)
    if not sensors:
        return {"available": False, "loaded": AUTOMATION_MONITOR in hass.config.components}
    failed = hass.states.get(sensors.get("failed", ""))
    linked = hass.states.get(sensors.get("linked", ""))
    # Most recent first; an item without a time goes last.
    all_failures = _items(failed, "automations")
    kept_failures = _kept(hass, all_failures, devices, matcher)
    all_linked = _items(linked, "entities")
    kept_linked = _kept(hass, all_linked, devices, matcher)
    failures = sorted(
        (_failure(hass, item) for item in kept_failures),
        key=lambda f: str(f["last_error_time"] or ""),
        reverse=True,
    )
    entities = sorted(
        (_linked(hass, item) for item in kept_linked),
        key=lambda e: str(e["unavailable_since"] or ""),
        reverse=True,
    )
    return {
        "available": True,
        "loaded": AUTOMATION_MONITOR in hass.config.components,
        "failed_entity": sensors.get("failed"),
        "linked_entity": sensors.get("linked"),
        # A sensor unavailable, unknown or missing says nothing: not "0 problems".
        "failed_na": not _valid(failed),
        "linked_na": not _valid(linked),
        "failures": failures,
        "linked": entities,
        # Left out by the settings: Clear all then clears the failures listed only, one by one.
        "failures_hidden": len(all_failures) - len(kept_failures),
        "linked_hidden": len(all_linked) - len(kept_linked),
        "automations": len(hass.states.async_entity_ids("automation")),
    }
