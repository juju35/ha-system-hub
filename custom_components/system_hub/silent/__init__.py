"""Silent devices module: the devices of the radio integrations not heard from for a while, and the weak signals.

A device is followed when one of its entities comes from a chosen integration (ZHA, Zigbee2MQTT through MQTT, Z-Wave,
Matter, ESPHome, deCONZ by default). It was last heard when one of its entities last reported a state (the state's
last_reported, which moves even when the value stays the same); with every entity unavailable, since they all went.
It is silent beyond the hours set, one value for the devices on a battery (a battery entity) and one for the others.
Its signal is its LQI (Zigbee, from 0 to 255, weak below 50) or its RSSI (dBm, weak below −80). Nothing is stored:
everything is read from the registries and the states when the panel asks. No entities of its own.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Final

from homeassistant.const import STATE_UNAVAILABLE
from homeassistant.core import HomeAssistant, State
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.util import dt as dt_util

CONF_INTEGRATIONS: Final = "integrations"
CONF_BATTERY_HOURS: Final = "battery_hours"
CONF_MAINS_HOURS: Final = "mains_hours"
CONF_IGNORED_DEVICES: Final = "ignored_devices"
# The integrations of devices that talk over a radio and go quiet when they fail
DEFAULT_INTEGRATIONS: Final = ("zha", "mqtt", "zwave_js", "matter", "esphome", "deconz")
DEFAULT_BATTERY_HOURS: Final = 24
DEFAULT_MAINS_HOURS: Final = 24
# Weak below these
WEAK_LQI: Final = 50
WEAK_RSSI: Final = -80
LQI_KEYS: Final = ("lqi", "linkquality", "link_quality")


def settings(options: Any) -> dict[str, Any]:
    """The module's settings, with their defaults."""
    options = options if isinstance(options, dict) else {}
    integrations = options.get(CONF_INTEGRATIONS)
    return {
        CONF_INTEGRATIONS: list(integrations)
        if isinstance(integrations, list) and integrations
        else list(DEFAULT_INTEGRATIONS),
        CONF_BATTERY_HOURS: int(options.get(CONF_BATTERY_HOURS) or DEFAULT_BATTERY_HOURS),
        CONF_MAINS_HOURS: int(options.get(CONF_MAINS_HOURS) or DEFAULT_MAINS_HOURS),
        CONF_IGNORED_DEVICES: [str(d) for d in options.get(CONF_IGNORED_DEVICES) or []],
    }


def _number(state: State | None) -> float | None:
    try:
        return float(state.state) if state is not None else None
    except (TypeError, ValueError):
        return None


def _signal(hass: HomeAssistant, items: list[er.RegistryEntry]) -> dict[str, Any] | None:
    """The device's LQI, else its RSSI, with whether it is weak."""
    suffixes = tuple(f"_{k}" for k in LQI_KEYS)
    lqi = [i for i in items if (i.translation_key or "").lower() in LQI_KEYS or i.entity_id.endswith(suffixes)]
    rssi = [i for i in items if (i.device_class or i.original_device_class) == "signal_strength"]
    for kind, found, weak in (("lqi", lqi, WEAK_LQI), ("rssi", rssi, WEAK_RSSI)):
        for item in found:
            if (value := _number(hass.states.get(item.entity_id))) is not None:
                return {"kind": kind, "value": round(value), "weak": value < weak}
    return None


def _battery(hass: HomeAssistant, items: list[er.RegistryEntry]) -> tuple[bool, float | None]:
    """Whether the device runs on a battery (it has a battery entity), and its level."""
    on_battery = False
    for item in items:
        if (item.device_class or item.original_device_class) != "battery":
            continue
        on_battery = True
        if item.domain == "sensor" and (level := _number(hass.states.get(item.entity_id))) is not None:
            return True, level
    return on_battery, None


def _last_heard(states: list[State]) -> tuple[datetime, bool]:
    """When the device was last heard, and whether every entity is unavailable (then: since when)."""
    alive = [s for s in states if s.state != STATE_UNAVAILABLE]
    if alive:
        return max(getattr(s, "last_reported", s.last_updated) for s in alive), False
    return max(s.last_changed for s in states), True


def silent_state(hass: HomeAssistant, options: Any) -> dict[str, Any]:
    """The silent devices and the weak signals (silent first, the longest silent first), and the counts."""
    chosen = settings(options)
    integrations = set(chosen[CONF_INTEGRATIONS])
    ignored = set(chosen[CONF_IGNORED_DEVICES])
    entities = er.async_get(hass)
    devices = dr.async_get(hass)
    areas = ar.async_get(hass)
    by_device: dict[str, list[er.RegistryEntry]] = {}
    for item in entities.entities.values():
        if item.device_id and item.platform in integrations and not item.disabled_by:
            by_device.setdefault(item.device_id, []).append(item)
    now = dt_util.utcnow()
    rows = []
    tracked = 0
    ignored_count = 0
    seen_integrations: set[str] = set()
    for device_id, items in by_device.items():
        device = devices.async_get(device_id)
        if device is None or device.disabled_by:
            continue
        if device_id in ignored:
            ignored_count += 1
            continue
        states = [s for item in items if (s := hass.states.get(item.entity_id)) is not None]
        if not states:
            continue
        tracked += 1
        integration = items[0].platform
        seen_integrations.add(integration)
        last, unavailable = _last_heard(states)
        on_battery, level = _battery(hass, items)
        hours = chosen[CONF_BATTERY_HOURS] if on_battery else chosen[CONF_MAINS_HOURS]
        silent = unavailable or now - last > timedelta(hours=hours)
        signal = _signal(hass, items)
        if not silent and not (signal and signal["weak"]):
            continue
        area = areas.async_get_area(device.area_id) if device.area_id else None
        rows.append(
            {
                "device_id": device_id,
                "name": device.name_by_user or device.name or device_id,
                "area": area.name if area else None,
                "integration": integration,
                "last_heard": last.isoformat(),
                "unavailable": unavailable,
                "silent": silent,
                "battery": on_battery,
                "level": round(level) if level is not None else None,
                "signal": signal,
            }
        )
    rows.sort(key=lambda r: (not r["silent"], r["last_heard"]))
    return {
        "devices": rows,
        "tracked": tracked,
        "ignored": ignored_count,
        "integrations": sorted(seen_integrations),
        "battery_hours": chosen[CONF_BATTERY_HOURS],
        "mains_hours": chosen[CONF_MAINS_HOURS],
    }
