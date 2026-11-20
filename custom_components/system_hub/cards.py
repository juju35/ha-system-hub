"""Lovelace cards: the frontend/cards/*.js files are served, those of the modules turned on loaded on every page.

The cards are served with the panel's static folder (/system_hub_static/cards/<file>.js), and each one is added to
Settings → Dashboards → Resources with the version in its URL, so that a release is fetched again. A file dropped in
frontend/cards/ is picked up with no code change. With the resources in YAML mode, the cards are loaded on every page
instead. The release splits each card's translations into <file>.i18n.<lang>.js files next to it (loaded on demand):
those are served too, but are not resources.

The card of a module turned off ($CARD_MODULES) is left out of the resources, since it would show nothing: a page does
not download it. The Status card (system-hub-card.js) and the System Monitor and Automation Monitor cards, which read
other integrations, are always loaded.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from homeassistant.components.frontend import add_extra_js_url
from homeassistant.core import HomeAssistant

from .const import (
    CONF_MODULES,
    DOMAIN,
    MODULE_BATTERIES,
    MODULE_GIT_SYNC,
    MODULE_MARKETPLACE,
    MODULE_ORPHANS,
    MODULE_WATCHDOG,
    MODULES,
    VERSION,
)

_LOGGER = logging.getLogger(__name__)

CARDS_DIR = Path(__file__).parent / "frontend" / "cards"
CARDS_URL = f"/{DOMAIN}_static/cards"
# The cards that show only what a module reads: loaded only while it is turned on
CARD_MODULES = {
    "battery-monitor-card.js": MODULE_BATTERIES,
    "git-sync-card.js": MODULE_GIT_SYNC,
    "integration-watchdog-card.js": MODULE_WATCHDOG,
    "marketplace-refresh-card.js": MODULE_MARKETPLACE,
    "orphan-entities-card.js": MODULE_ORPHANS,
}


def card_files(folder: Path = CARDS_DIR) -> list[str]:
    """The cards' files, the translation files left out (executor: reads the folder)."""
    if not folder.is_dir():
        return []
    return sorted(p.name for p in folder.glob("*.js") if ".i18n." not in p.name)


def _modules_on(hass: HomeAssistant) -> set[str]:
    """The modules turned on in System Hub's options; every module when it is not added or its options don't say."""
    entries = hass.config_entries.async_entries(DOMAIN)
    modules = entries[0].options.get(CONF_MODULES) if entries else None
    return set(modules) if isinstance(modules, list) else set(MODULES)


def wanted_cards(names: list[str], modules: set[str]) -> list[str]:
    """The cards to load: those of no module, and those of the modules turned on."""
    return [name for name in names if name not in CARD_MODULES or CARD_MODULES[name] in modules]


def _storage_resources(hass: HomeAssistant) -> Any | None:
    """The dashboard resources collection when it is editable from the UI.

    hass.data["lovelace"] is a dict before 2025.2, then a dataclass whose `mode` field became `resource_mode` in 2026.2.
    """
    lovelace = hass.data.get("lovelace")
    if isinstance(lovelace, dict):
        mode, resources = lovelace.get("resource_mode", lovelace.get("mode")), lovelace.get("resources")
    else:
        mode = getattr(lovelace, "resource_mode", getattr(lovelace, "mode", None))
        resources = getattr(lovelace, "resources", None)
    return resources if mode == "storage" else None


def _base(url: str) -> str:
    return url.split("?")[0]


async def async_register_cards(hass: HomeAssistant) -> None:
    """Add or update each card in the dashboard resources; drop those of cards no longer shipped."""
    names = wanted_cards(await hass.async_add_executor_job(card_files), _modules_on(hass))
    urls = {f"{CARDS_URL}/{name}": f"{CARDS_URL}/{name}?v={VERSION}" for name in names}
    resources = _storage_resources(hass)
    if resources is None:
        # Resources in YAML mode: loaded on every page instead, each once per run (one turned off stays until a
        # restart: Home Assistant cannot take an extra module back).
        added: set[str] = hass.data.setdefault(DOMAIN, {}).setdefault("cards_extra_js", set())
        for url in urls.values():
            if url not in added:
                add_extra_js_url(hass, url)
                added.add(url)
        return
    try:
        await resources.async_get_info()  # loads the collection from storage
        seen: set[str] = set()
        for item in list(resources.async_items()):
            base = _base(item.get("url", ""))
            if not base.startswith(f"{CARDS_URL}/"):
                continue
            if base not in urls or base in seen:
                # A card no longer shipped, or a duplicate
                await resources.async_delete_item(item["id"])
                continue
            seen.add(base)
            if item["url"] != urls[base]:
                await resources.async_update_item(item["id"], {"res_type": "module", "url": urls[base]})
        for base, url in urls.items():
            if base not in seen:
                await resources.async_create_item({"res_type": "module", "url": url})
    except Exception:  # noqa: BLE001 - never block the integration on its cards
        _LOGGER.exception("Could not register the System Hub cards as dashboard resources")


async def async_remove_cards(hass: HomeAssistant) -> None:
    """Drop the cards from the dashboard resources (the integration is removed)."""
    if (resources := _storage_resources(hass)) is None:
        return
    for item in list(resources.async_items()):
        if _base(item.get("url", "")).startswith(f"{CARDS_URL}/"):
            await resources.async_delete_item(item["id"])
