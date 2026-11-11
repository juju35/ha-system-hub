"""What Battery Monitor knew, brought into the Batteries module.

Its settings (threshold, duration, notification times and actions, batteries and integrations left out) come from its
config entry, the battery types set in its cards (per battery and per model) from the dashboards, and the spare
batteries counted with its set_stock action from its storage.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Final

from homeassistant.core import HomeAssistant

from .const import (
    CONF_BATTERY_MODELS,
    CONF_BATTERY_TYPES,
    CONF_DURATION,
    CONF_EVENING,
    CONF_IGNORED_ENTITIES,
    CONF_IGNORED_INTEGRATIONS,
    CONF_MORNING,
    CONF_NOTIFY,
    CONF_THRESHOLD,
)

BATTERY_MONITOR: Final = "battery_monitor"
CARD_TYPES: Final = ("custom:battery-monitor-card", "custom:battery-monitor-mini-card")
SETTINGS: Final = (
    CONF_THRESHOLD,
    CONF_DURATION,
    CONF_MORNING,
    CONF_EVENING,
    CONF_NOTIFY,
    CONF_IGNORED_ENTITIES,
    CONF_IGNORED_INTEGRATIONS,
)
# Battery Monitor's own store (below-threshold times, drains, spare batteries).
STORE_FILE: Final = f"{BATTERY_MONITOR}.below_since"


@dataclass
class Found:
    """What Battery Monitor knew; empty when it was never set up."""

    settings: dict[str, Any] = field(default_factory=dict)
    battery_types: dict[str, str] = field(default_factory=dict)
    battery_models: dict[str, str] = field(default_factory=dict)
    stock: dict[str, int] = field(default_factory=dict)

    def __bool__(self) -> bool:
        return bool(self.settings or self.battery_types or self.battery_models or self.stock)


def _cards(node: Any, found: Found) -> None:
    """The battery types of every Battery Monitor card in a dashboard (cards nested in stacks and sections too)."""
    if isinstance(node, dict):
        if node.get("type") in CARD_TYPES:
            for key, target in ((CONF_BATTERY_TYPES, found.battery_types), (CONF_BATTERY_MODELS, found.battery_models)):
                values = node.get(key)
                if isinstance(values, dict):
                    target.update(
                        {str(k).strip(): str(v).strip() for k, v in values.items() if str(k).strip() and str(v).strip()}
                    )
        for value in node.values():
            _cards(value, found)
    elif isinstance(node, list):
        for value in node:
            _cards(value, found)


def _read_storage(storage: Path, found: Found) -> None:
    """The dashboards (.storage/lovelace*) and Battery Monitor's store, read from disk (executor)."""
    for file in sorted(storage.glob("lovelace*")):
        try:
            data = json.loads(file.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        config = data.get("data", {}).get("config") if isinstance(data, dict) else None
        _cards(config, found)
    try:
        stored = json.loads((storage / STORE_FILE).read_text(encoding="utf-8")).get("data", {})
    except (OSError, ValueError, AttributeError):
        return
    stock = stored.get("stock") if isinstance(stored, dict) else None
    if isinstance(stock, dict):
        found.stock = {
            str(k).strip(): v for k, v in stock.items() if isinstance(v, int) and not isinstance(v, bool) and v >= 0
        }


async def async_find(hass: HomeAssistant) -> Found:
    """What Battery Monitor knew on this Home Assistant."""
    found = Found()
    entry = next(iter(hass.config_entries.async_entries(BATTERY_MONITOR)), None)
    if entry is not None:
        options = {**entry.data, **entry.options}
        found.settings = {key: options[key] for key in SETTINGS if key in options}
    await hass.async_add_executor_job(_read_storage, Path(hass.config.path(".storage")), found)
    return found


def merged(current: dict[str, Any], found: Found) -> dict[str, Any]:
    """The Batteries options with Battery Monitor's: its settings, and its types where none is set here."""
    options = {**current, **found.settings}
    for key, values in ((CONF_BATTERY_TYPES, found.battery_types), (CONF_BATTERY_MODELS, found.battery_models)):
        options[key] = {**values, **(current.get(key) or {})}
    return options
