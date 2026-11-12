"""The cards of System Hub before 2.0 moved to system-hub-card and system-hub-mini-card (`module:` picks the module).

At every start, once the dashboards are loaded: every card of an old type in a dashboard edited from the UI, wherever
it is (a view, a section, a stack, a conditional card, another card's popup…), takes the new type and its module, its
options kept. The dashboard's config before its first change is saved in .storage/system_hub.dashboards_backup. A
dashboard written in YAML is not rewritten (its comments would be lost): a repair lists its cards to change, and goes
away once none is left.
"""

from __future__ import annotations

import copy
import logging
from typing import Any, Final

from homeassistant.core import HomeAssistant
from homeassistant.helpers import issue_registry as ir
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

CARD: Final = "system-hub-card"
MINI_CARD: Final = "system-hub-mini-card"
# The types before 2.0: the new type and the module
OLD_TYPES: Final = {
    "system-monitor-card": (CARD, "system"),
    "system-monitor-mini-card": (MINI_CARD, "system"),
    "integration-watchdog-card": (CARD, "watchdog"),
    "integration-watchdog-mini-card": (MINI_CARD, "watchdog"),
    "marketplace-refresh-card": (CARD, "marketplace"),
    "battery-monitor-card": (CARD, "batteries"),
    "battery-monitor-mini-card": (MINI_CARD, "batteries"),
    "git-sync-card": (CARD, "git_sync"),
    "git-sync-mini-card": (MINI_CARD, "git_sync"),
    "automation-monitor-card": (CARD, "automations"),
    "automation-monitor-mini-card": (MINI_CARD, "automations"),
    "orphan-entities-card": (CARD, "orphans"),
    "orphan-entities-mini-card": (MINI_CARD, "orphans"),
}
BACKUP_KEY: Final = f"{DOMAIN}.dashboards_backup"
ISSUE_PREFIX: Final = "cards_yaml_"


def convert(node: Any, found: list[str]) -> Any:
    """The config with every card of an old type moved to the new one; the old types met are added to `found`."""
    if isinstance(node, list):
        return [convert(item, found) for item in node]
    if not isinstance(node, dict):
        return node
    kind = node.get("type")
    old = kind.removeprefix("custom:") if isinstance(kind, str) and kind.startswith("custom:") else None
    rest = {key: convert(value, found) for key, value in node.items()}
    if old not in OLD_TYPES:
        return rest
    found.append(old)
    new, module = OLD_TYPES[old]
    rest.pop("type")
    rest.pop("module", None)
    return {"type": f"custom:{new}", "module": module, **rest}


def _dashboards(hass: HomeAssistant) -> dict[str | None, Any]:
    """The dashboards: hass.data["lovelace"] is a dict before 2025.2, then a dataclass."""
    lovelace = hass.data.get("lovelace")
    dashboards = lovelace.get("dashboards") if isinstance(lovelace, dict) else getattr(lovelace, "dashboards", None)
    return dict(dashboards or {})


async def async_migrate_dashboards(hass: HomeAssistant) -> int:
    """Move the old cards of the UI dashboards, flag those of the YAML ones; the number of cards moved."""
    store: Store[dict[str, Any]] = Store(hass, 1, BACKUP_KEY)
    backup: dict[str, Any] | None = None
    moved = 0
    for url_path, dashboard in _dashboards(hass).items():
        key = url_path or "lovelace"
        try:
            config = await dashboard.async_load(False)
        except Exception:  # noqa: BLE001 - no config yet (generated dashboard), or a YAML file that does not load
            continue
        found: list[str] = []
        new = convert(copy.deepcopy(config), found)
        issue = f"{ISSUE_PREFIX}{key}"
        if getattr(dashboard, "mode", "storage") != "storage":
            if not found:
                ir.async_delete_issue(hass, DOMAIN, issue)
                continue
            path = str(getattr(dashboard, "path", "") or "").removeprefix(hass.config.config_dir).lstrip("/")
            ir.async_create_issue(
                hass,
                DOMAIN,
                issue,
                is_fixable=False,
                severity=ir.IssueSeverity.WARNING,
                translation_key="cards_yaml",
                translation_placeholders={
                    "dashboard": key,
                    "path": path or key,
                    "count": str(len(found)),
                    "types": "\n".join(
                        f"- `custom:{old}` → `custom:{OLD_TYPES[old][0]}` + `module: {OLD_TYPES[old][1]}`"
                        for old in sorted(set(found))
                    ),
                },
            )
            continue
        if not found:
            continue
        if backup is None:
            backup = await store.async_load() or {}
        # The config before the first move kept: a second start never overwrites it
        backup.setdefault(key, {"at": dt_util.utcnow().isoformat(), "config": config})
        await store.async_save(backup)
        await dashboard.async_save(new)
        moved += len(found)
        _LOGGER.info("Dashboard %s: %d System Hub cards moved to system-hub-card", key, len(found))
    return moved
