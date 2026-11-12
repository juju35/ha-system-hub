"""Cards before 2.0 moved to system-hub-card: UI dashboards rewritten (a backup first), YAML ones get a repair."""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers import issue_registry as ir

from custom_components.system_hub.cards_migration import BACKUP_KEY, async_migrate_dashboards, convert

OLD = {
    "views": [
        {
            "cards": [
                {"type": "custom:battery-monitor-card", "threshold": 20},
                {"type": "vertical-stack", "cards": [{"type": "custom:integration-watchdog-mini-card"}]},
                {"type": "conditional", "card": {"type": "custom:git-sync-card", "repository": "esphome"}},
                {"type": "entities", "entities": ["sensor.x"]},
            ]
        },
        {"type": "sections", "sections": [{"cards": [{"type": "custom:orphan-entities-mini-card"}]}]},
    ]
}


class Dashboard:
    def __init__(self, mode: str, config: dict[str, Any] | None, path: str = "") -> None:
        self.mode = mode
        self.config = config
        self.path = path
        self.saved: list[dict[str, Any]] = []

    async def async_load(self, force: bool) -> dict[str, Any]:
        if self.config is None:
            raise ValueError("no config")
        return self.config

    async def async_save(self, config: dict[str, Any]) -> None:
        self.saved.append(config)
        self.config = config


def test_convert_keeps_options_and_nesting() -> None:
    found: list[str] = []
    new = convert(OLD, found)
    cards = new["views"][0]["cards"]
    assert cards[0] == {"type": "custom:system-hub-card", "module": "batteries", "threshold": 20}
    assert cards[1]["cards"][0] == {"type": "custom:system-hub-mini-card", "module": "watchdog"}
    assert cards[2]["card"] == {"type": "custom:system-hub-card", "module": "git_sync", "repository": "esphome"}
    assert cards[3] == {"type": "entities", "entities": ["sensor.x"]}
    assert new["views"][1]["sections"][0]["cards"][0]["module"] == "orphans"
    assert sorted(found) == [
        "battery-monitor-card",
        "git-sync-card",
        "integration-watchdog-mini-card",
        "orphan-entities-mini-card",
    ]
    # The original is left untouched
    assert OLD["views"][0]["cards"][0]["type"] == "custom:battery-monitor-card"


async def test_migrate_dashboards(hass: HomeAssistant, hass_storage) -> None:
    ui = Dashboard("storage", OLD)
    clean = Dashboard("storage", {"views": [{"cards": [{"type": "custom:system-hub-card"}]}]})
    empty = Dashboard("storage", None)
    yaml = Dashboard("yaml", OLD, path=f"{hass.config.config_dir}/dashboards/home.yaml")
    hass.data["lovelace"] = SimpleNamespace(dashboards={None: ui, "clean": clean, "empty": empty, "home": yaml})
    assert await async_migrate_dashboards(hass) == 4
    assert ui.saved and ui.config["views"][0]["cards"][0]["type"] == "custom:system-hub-card"
    assert not clean.saved and not yaml.saved
    assert hass_storage[BACKUP_KEY]["data"]["lovelace"]["config"] == OLD
    issue = ir.async_get(hass).async_get_issue("system_hub", "cards_yaml_home")
    assert issue.translation_placeholders["path"] == "dashboards/home.yaml"
    assert issue.translation_placeholders["count"] == "4"
    assert (
        "`custom:battery-monitor-card` → `custom:system-hub-card` + `module: batteries`"
        in (issue.translation_placeholders["types"])
    )
    # The next start: nothing left to move, the backup kept; the YAML fixed, the repair gone
    assert await async_migrate_dashboards(hass) == 0
    assert hass_storage[BACKUP_KEY]["data"]["lovelace"]["config"] == OLD
    yaml.config = ui.config
    await async_migrate_dashboards(hass)
    assert ir.async_get(hass).async_get_issue("system_hub", "cards_yaml_home") is None
