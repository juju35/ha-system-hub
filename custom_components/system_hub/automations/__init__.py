"""Automations module: what Automation Monitor reports, shown in the panel's Automations tab.

The module has no entity and no settings of its own. It reads the two sensors of the Automation Monitor integration
(https://github.com/olli-dot-dev/ha-automation-monitor), found in the entity registry by platform and translation key
(the default entity ids are a fallback), as the Automation Monitor card does; the tab's buttons call that
integration's own actions (automation_monitor.reset, automation_monitor.rebuild_linked_entities).
"""

from __future__ import annotations

from typing import Any, Final
from urllib.parse import quote

from homeassistant.const import STATE_UNAVAILABLE, STATE_UNKNOWN
from homeassistant.core import HomeAssistant, State
from homeassistant.helpers import entity_registry as er

AUTOMATION_MONITOR: Final = "automation_monitor"
# The two sensors of Automation Monitor, by translation key.
KEYS: Final = {"failed": "failed_automations", "linked": "linked_entities_unavailable"}


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


def state(hass: HomeAssistant) -> dict[str, Any]:
    """What the Automations tab shows: Automation Monitor's failed automations and unavailable linked entities."""
    sensors = _sensors(hass)
    if not sensors:
        return {"available": False, "loaded": AUTOMATION_MONITOR in hass.config.components}
    failed = hass.states.get(sensors.get("failed", ""))
    linked = hass.states.get(sensors.get("linked", ""))
    # Most recent first; an item without a time goes last.
    failures = sorted(
        (_failure(hass, item) for item in _items(failed, "automations")),
        key=lambda f: str(f["last_error_time"] or ""),
        reverse=True,
    )
    entities = sorted(
        (_linked(hass, item) for item in _items(linked, "entities")),
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
        "automations": len(hass.states.async_entity_ids("automation")),
    }
