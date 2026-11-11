"""The standalone integrations System Hub replaces: their settings, taken over when a module is turned on.

Each one stored its settings under the same keys as its module here (Battery Monitor's types and spare batteries also
live outside its entry: see batteries/importer.py). Git Sync could hold several repositories; the module keeps one, the
configuration folder's when there is one.
"""

from __future__ import annotations

from types import ModuleType
from typing import Any, Final

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .batteries import const as batteries_const
from .const import MODULE_BATTERIES, MODULE_GIT_SYNC, MODULE_MARKETPLACE, MODULE_ORPHANS, MODULE_WATCHDOG
from .git_sync import const as git_sync_const
from .marketplace import const as marketplace_const
from .orphans import const as orphans_const
from .watchdog import const as watchdog_const

# Module -> domain of the standalone integration it replaces.
STANDALONE: Final = {
    MODULE_WATCHDOG: "integration_watchdog",
    MODULE_MARKETPLACE: "marketplace_refresh",
    MODULE_BATTERIES: "battery_monitor",
    MODULE_GIT_SYNC: "git_sync",
    MODULE_ORPHANS: "orphan_entities",
}
_CONSTS: Final[dict[str, ModuleType]] = {
    MODULE_WATCHDOG: watchdog_const,
    MODULE_MARKETPLACE: marketplace_const,
    MODULE_BATTERIES: batteries_const,
    MODULE_GIT_SYNC: git_sync_const,
    MODULE_ORPHANS: orphans_const,
}


def _keys(module: str) -> set[str]:
    """The option keys of a module: the values of its CONF_* constants."""
    const = _CONSTS[module]
    return {value for name, value in vars(const).items() if name.startswith("CONF_") and isinstance(value, str)}


def entry(hass: HomeAssistant, module: str) -> ConfigEntry | None:
    """The standalone integration's entry for a module (Git Sync: the configuration folder's repository first)."""
    domain = STANDALONE.get(module)
    entries = [e for e in hass.config_entries.async_entries(domain) if not e.disabled_by] if domain else []
    if module == MODULE_GIT_SYNC:
        config = hass.config.path().rstrip("/")

        def elsewhere(candidate: ConfigEntry) -> bool:
            options = {**candidate.data, **candidate.options}
            return str(options.get(git_sync_const.CONF_REPO_PATH, "")).rstrip("/") != config

        entries.sort(key=elsewhere)
    return entries[0] if entries else None


def settings(hass: HomeAssistant, module: str) -> dict[str, Any]:
    """The standalone integration's settings for a module, under the module's keys; empty without one."""
    found = entry(hass, module)
    if found is None:
        return {}
    keys = _keys(module)
    return {key: value for key, value in {**found.data, **found.options}.items() if key in keys}


def taken_over(hass: HomeAssistant, current: dict[str, Any], module: str) -> dict[str, Any]:
    """A module's options turned on: the standalone integration's settings when the module was never set here."""
    if current:
        return current
    return settings(hass, module)
