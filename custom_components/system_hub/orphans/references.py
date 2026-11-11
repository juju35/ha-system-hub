"""What still uses an orphan entity: automations, scripts, scenes, groups and dashboards (storage mode)."""

from __future__ import annotations

import logging
import re
from collections.abc import Iterable
from typing import Any

from homeassistant.components.automation import automations_with_device, automations_with_entity
from homeassistant.components.group import groups_with_entity
from homeassistant.components.homeassistant.scene import scenes_with_entity
from homeassistant.components.script import scripts_with_device, scripts_with_entity
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.json import json_dumps

_LOGGER = logging.getLogger(__name__)

# The kinds of references, in the order the card lists them.
REF_AUTOMATION = "automation"
REF_SCRIPT = "script"
REF_SCENE = "scene"
REF_GROUP = "group"
REF_DASHBOARD = "dashboard"


@callback
def _name(hass: HomeAssistant, entity_id: str) -> str:
    state = hass.states.get(entity_id)
    return (state.attributes.get("friendly_name") if state else None) or entity_id


@callback
def _ref(hass: HomeAssistant, kind: str, entity_id: str) -> dict[str, Any]:
    """An automation, script, scene or group by its entity, with its editor page when it has one."""
    state = hass.states.get(entity_id)
    config_id = state.attributes.get("id") if state else None
    path = None
    if kind == REF_SCRIPT:
        path = f"/config/script/edit/{entity_id.split('.', 1)[1]}"
    elif kind in (REF_AUTOMATION, REF_SCENE) and config_id:
        # Only the automations and scenes made in the UI (or with an `id`) have an editor page.
        path = f"/config/{kind}/edit/{config_id}"
    return {"type": kind, "id": entity_id, "name": _name(hass, entity_id), "path": path}


async def async_dashboards(hass: HomeAssistant) -> list[dict[str, Any]]:
    """The dashboards in storage mode, each with its config as JSON text. YAML dashboards are not read."""
    lovelace = hass.data.get("lovelace")
    # A dict before Home Assistant 2025.2, then a dataclass.
    dashboards = lovelace.get("dashboards") if isinstance(lovelace, dict) else getattr(lovelace, "dashboards", None)
    found: list[dict[str, Any]] = []
    for url_path, dashboard in list((dashboards or {}).items()):
        if getattr(dashboard, "mode", None) != "storage":
            continue
        try:
            # Read from the store once, then from the dashboard's memory.
            config = await dashboard.async_load(False)
        except Exception:  # noqa: BLE001 - auto-generated (ConfigNotFound), recovery mode: nothing to scan
            continue
        info = getattr(dashboard, "config", None) or {}
        try:
            text = json_dumps(config)
        except (TypeError, ValueError):
            _LOGGER.debug("Dashboard %s could not be read", url_path, exc_info=True)
            continue
        found.append(
            {
                "type": REF_DASHBOARD,
                "id": url_path or "lovelace",
                "name": info.get("title") or url_path or "Overview",
                "path": f"/{url_path or 'lovelace'}",
                "text": text,
            }
        )
    # The default dashboard first, then by name.
    return sorted(found, key=lambda d: (d["id"] != "lovelace", d["name"].casefold()))


def find_dashboard_references(
    entity_ids: Iterable[str], dashboards: list[dict[str, Any]]
) -> dict[str, list[dict[str, Any]]]:
    """{entity_id: dashboards using it}: one pass per dashboard, whole IDs (sensor.a does not match sensor.a_b)."""
    wanted = list(dict.fromkeys(entity_ids))
    found: dict[str, list[dict[str, Any]]] = {}
    if not wanted or not dashboards:
        return found
    pattern = re.compile(
        r"(?<![\w.])(" + "|".join(re.escape(e) for e in sorted(wanted, key=len, reverse=True)) + r")(?!\w)"
    )
    for dashboard in dashboards:
        ref = {k: v for k, v in dashboard.items() if k != "text"}
        for entity_id in dict.fromkeys(pattern.findall(dashboard["text"])):
            found.setdefault(entity_id, []).append(ref)
    return found


@callback
def find_references(
    hass: HomeAssistant, entity_ids: Iterable[str], in_dashboards: dict[str, list[dict[str, Any]]]
) -> dict[str, list[dict[str, Any]]]:
    """{entity_id: what uses it}, for the entities that something uses. Only the loaded integrations are asked;
    `in_dashboards` comes from find_dashboard_references."""
    wanted = list(dict.fromkeys(entity_ids))
    if not wanted:
        return {}
    loaded = hass.config.components
    finders = [
        (kind, finder)
        for kind, finder in (
            (REF_AUTOMATION, automations_with_entity),
            (REF_SCRIPT, scripts_with_entity),
            (REF_SCENE, scenes_with_entity),
            (REF_GROUP, groups_with_entity),
        )
        if kind in loaded
    ]
    # Group helpers (light, sensor, switch… groups) list their members in their `entity_id` attribute.
    helpers: dict[str, list[str]] = {}
    if REF_GROUP in loaded:
        for entry in list(er.async_get(hass).entities.values()):
            if entry.platform != REF_GROUP or entry.domain == REF_GROUP:
                continue
            state = hass.states.get(entry.entity_id)
            members = state.attributes.get("entity_id") if state else None
            if isinstance(members, (list, tuple)):
                for member in members:
                    helpers.setdefault(member, []).append(entry.entity_id)

    found: dict[str, list[dict[str, Any]]] = {}
    for entity_id in wanted:
        refs: list[dict[str, Any]] = []
        for kind, finder in finders:
            try:
                users = finder(hass, entity_id)
            except Exception:  # noqa: BLE001 - never fail a scan on another integration's data
                _LOGGER.debug("Could not list the %ss using %s", kind, entity_id, exc_info=True)
                continue
            refs.extend(_ref(hass, kind, user) for user in sorted(users) if user != entity_id)
        refs.extend(_ref(hass, REF_GROUP, user) for user in sorted(helpers.get(entity_id, [])) if user != entity_id)
        refs.extend(in_dashboards.get(entity_id, []))
        if refs:
            found[entity_id] = refs
    return found


@callback
def find_device_references(hass: HomeAssistant, device_ids: Iterable[str]) -> dict[str, list[dict[str, Any]]]:
    """{device_id: automations and scripts using it (device triggers, conditions, actions)}, for the devices used."""
    loaded = hass.config.components
    finders = [
        (kind, finder)
        for kind, finder in ((REF_AUTOMATION, automations_with_device), (REF_SCRIPT, scripts_with_device))
        if kind in loaded
    ]
    found: dict[str, list[dict[str, Any]]] = {}
    for device_id in dict.fromkeys(device_ids):
        refs: list[dict[str, Any]] = []
        for kind, finder in finders:
            try:
                users = finder(hass, device_id)
            except Exception:  # noqa: BLE001 - never fail a scan on another integration's data
                _LOGGER.debug("Could not list the %ss using device %s", kind, device_id, exc_info=True)
                continue
            refs.extend(_ref(hass, kind, user) for user in sorted(users))
        if refs:
            found[device_id] = refs
    return found
