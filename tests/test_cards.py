"""Lovelace cards: every frontend/cards/*.js file served and added to the dashboard resources, dropped on removal."""

from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from homeassistant.core import HomeAssistant
from homeassistant.setup import async_setup_component
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.system_hub import cards
from custom_components.system_hub.const import CONF_MODULES, DOMAIN, VERSION

URL = cards.CARDS_URL


def _resources(hass: HomeAssistant):
    """The Lovelace resources collection: hass.data["lovelace"] is a dict before 2025.2, a dataclass after."""
    lovelace = hass.data["lovelace"]
    return lovelace["resources"] if isinstance(lovelace, dict) else lovelace.resources


@pytest.fixture
def card_folder(tmp_path: Path):
    """Two cards and a translation file of one of them, in a cards folder of their own."""
    folder = tmp_path / "cards"
    folder.mkdir()
    for name in ("a-card.js", "b-card.js", "a-card.i18n.fr.js"):
        (folder / name).write_text("// card\n")
    with patch.object(cards, "CARDS_DIR", folder), patch.object(cards.card_files, "__defaults__", (folder,)):
        yield folder


async def _setup(hass: HomeAssistant) -> MockConfigEntry:
    entry = MockConfigEntry(domain=DOMAIN, unique_id=DOMAIN, options={CONF_MODULES: []})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


def _urls(hass: HomeAssistant) -> list[str]:
    return sorted(i["url"] for i in _resources(hass).async_items() if i["url"].startswith(f"{URL}/"))


def test_card_files(card_folder: Path, tmp_path: Path) -> None:
    assert cards.card_files() == ["a-card.js", "b-card.js"]
    assert cards.card_files(tmp_path / "missing") == []


async def test_cards_added_updated_and_removed(hass: HomeAssistant, card_folder: Path) -> None:
    assert await async_setup_component(hass, "lovelace", {})
    resources = _resources(hass)
    await resources.async_get_info()
    # An older version, a duplicate and a card no longer shipped: brought up to date, the extras dropped
    await resources.async_create_item({"res_type": "module", "url": f"{URL}/a-card.js?v=0.0.1"})
    await resources.async_create_item({"res_type": "module", "url": f"{URL}/a-card.js?v=0.0.2"})
    await resources.async_create_item({"res_type": "module", "url": f"{URL}/gone-card.js?v=0.0.1"})
    await resources.async_create_item({"res_type": "module", "url": "/local/other.js"})
    entry = await _setup(hass)
    assert _urls(hass) == [f"{URL}/a-card.js?v={VERSION}", f"{URL}/b-card.js?v={VERSION}"]
    assert any(i["url"] == "/local/other.js" for i in resources.async_items())

    assert await hass.config_entries.async_remove(entry.entry_id)
    await hass.async_block_till_done()
    assert _urls(hass) == []
    assert any(i["url"] == "/local/other.js" for i in resources.async_items())

    # Added back without a restart: the cards come back
    await _setup(hass)
    assert len(_urls(hass)) == 2


@pytest.mark.parametrize(
    ("key", "container"),
    [("mode", dict), ("resource_mode", dict), ("mode", SimpleNamespace), ("resource_mode", SimpleNamespace)],
)
async def test_lovelace_data_variants(hass: HomeAssistant, card_folder: Path, key: str, container: type) -> None:
    """hass.data["lovelace"]: a dict before 2025.2, then a dataclass with `mode`, renamed `resource_mode` in 2026.2."""
    assert await async_setup_component(hass, "lovelace", {})
    resources = _resources(hass)
    hass.data["lovelace"] = container(**{key: "storage", "resources": resources, "dashboards": {}})
    await _setup(hass)
    assert len(_urls(hass)) == 2


async def test_yaml_mode_loads_the_cards_on_every_page(hass: HomeAssistant, card_folder: Path) -> None:
    """Resources in YAML mode are not edited: the cards are loaded on every page instead, once."""
    from homeassistant.components.lovelace.resources import ResourceYAMLCollection  # noqa: PLC0415

    assert await async_setup_component(hass, "lovelace", {})
    hass.data["lovelace"] = {"mode": "yaml", "resources": ResourceYAMLCollection([]), "dashboards": {}}
    with patch.object(cards, "add_extra_js_url") as add_js:
        await _setup(hass)
        await cards.async_register_cards(hass)
    assert sorted(c.args[1] for c in add_js.call_args_list) == [
        f"{URL}/a-card.js?v={VERSION}",
        f"{URL}/b-card.js?v={VERSION}",
    ]


async def test_cards_are_served(hass: HomeAssistant, hass_client) -> None:
    """The shipped cards are served with the panel's static folder."""
    assert await async_setup_component(hass, "lovelace", {})
    await _setup(hass)
    names = await hass.async_add_executor_job(cards.card_files)
    if not names:
        pytest.skip("no card shipped yet")
    client = await hass_client()
    response = await client.get(f"{URL}/{names[0]}")
    assert response.status == 200
