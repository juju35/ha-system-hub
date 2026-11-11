"""Render the Marketplace Refresh card with mock data and save the docs screenshots.

Usage: python scripts/screenshots_marketplace.py  (needs `pip install playwright pillow` and `playwright install chromium`)
CHROMIUM_PATH=/path/to/chrome to use another browser. The clock is frozen so "3 hours ago" and "in 21 hours" stay the same.
Repository pictures are not fetched (the generic icon is shown), so the captures don't depend on the network.
Every capture keeps a 16 px frame of the theme background around the card, and is only rewritten when its pixels change.
"""

import os
from datetime import timedelta

from screenshot_cards import CARDS, NOW, ROOT, ha_elements, page_html, save

CARD_JS = (CARDS / "marketplace-refresh-card.js").read_text()
WIDTH = 460
HA_ELEMENTS = ha_elements("screenshot-icons-marketplace.json")

STATUS = "sensor.system_hub_marketplace_status"
LAST_CHECK = "sensor.system_hub_marketplace_last_check"
BUTTON = "button.system_hub_marketplace_check_updates"


def at(**delta) -> str:
    return (NOW + timedelta(**delta)).isoformat()


# Mock Marketplace repositories: (update entity, title, installed, latest).
REPOSITORIES = [
    ("update.mushroom_update", "Mushroom", "v4.4.0", "v4.5.0"),
    ("update.card_mod_update", "card-mod", "v3.4.4", "v3.4.5"),
    ("update.auto_entities_update", "auto-entities", "v1.13.0", "v1.14.1"),
    ("update.button_card_update", "button-card", "v4.3.0", "v4.3.0"),
    ("update.spook_update", "Spook", "v4.0.0", "v4.0.0"),
]


def mock_hass(status, attrs, with_updates):
    platform = {"platform": "system_hub", "device_id": "system_hub"}
    states = {
        STATUS: {
            "entity_id": STATUS,
            "state": status,
            "attributes": {"done": 0, "total": 0, "updates": 0, "failed": [], "error": None, **attrs},
        },
        LAST_CHECK: {
            "entity_id": LAST_CHECK,
            "state": at(hours=-3),
            "attributes": {"scan_interval": 24, "next_check": at(hours=21)},
        },
        BUTTON: {"entity_id": BUTTON, "state": "unknown", "attributes": {}},
    }
    entities = {
        STATUS: {**platform, "translation_key": "marketplace_status"},
        LAST_CHECK: {**platform, "translation_key": "marketplace_last_check"},
        BUTTON: {**platform, "translation_key": "marketplace_check_updates"},
    }
    for entity_id, title, installed, latest in REPOSITORIES:
        update = with_updates and installed != latest
        states[entity_id] = {
            "entity_id": entity_id,
            "state": "on" if update else "off",
            "attributes": {
                "title": title,
                "installed_version": installed,
                "latest_version": latest if update else installed,
                "entity_picture": f"https://brands.home-assistant.io/_/{entity_id}/icon.png",
            },
        }
        entities[entity_id] = {"platform": "marketplace"}
    # An administrator: the card offers "Update all".
    return {
        "states": states,
        "entities": entities,
        "language": "en",
        "locale": {"language": "en"},
        "user": {"is_admin": True},
    }


UPDATES = ("idle", {"updates": 3, "failed": ["someone/abandoned-card: 404 Not Found"]}, True)
CHECKING = ("running", {"done": 31, "total": 48}, True)
UP_TO_DATE = ("idle", {}, False)
INSTALLING = ("idle", {"updates": 3, "installing": ["update.card_mod_update", "update.mushroom_update"]}, True)
SHOTS = [
    {"file": "card-marketplace", "theme": "light", "hass": UPDATES},
    {"file": "card-marketplace-dark", "theme": "dark", "hass": UPDATES},
    {"file": "card-marketplace-checking", "theme": "light", "hass": CHECKING},
    {"file": "card-marketplace-checking-dark", "theme": "dark", "hass": CHECKING},
    {"file": "card-marketplace-ok", "theme": "light", "hass": UP_TO_DATE},
    {"file": "card-marketplace-ok-dark", "theme": "dark", "hass": UP_TO_DATE},
    {"file": "card-marketplace-installing", "theme": "light", "hass": INSTALLING},
    {"file": "card-marketplace-installing-dark", "theme": "dark", "hass": INSTALLING},
]


MOUNT = """([hass, dark]) => {
    const el = document.createElement("marketplace-refresh-card");
    el.setConfig({ type: "custom:marketplace-refresh-card" });
    el.hass = { ...hass, themes: { darkMode: dark }, callService: async () => {} };
    document.getElementById("root").appendChild(el);
}"""


def main():
    # Imported here: the module loads without Playwright installed.
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get("CHROMIUM_PATH") or None)
        for shot in SHOTS:
            page = browser.new_page(device_scale_factor=2, viewport={"width": 1000, "height": 1600})
            page.on("pageerror", lambda err, name=shot["file"]: print(f"{name}: page error: {err}"))
            # No repository picture: the generic icon, the same on every machine.
            page.route("https://brands.home-assistant.io/**", lambda route: route.abort())
            page.clock.set_fixed_time(NOW.isoformat())
            page.set_content(page_html(shot["theme"], WIDTH))
            page.add_script_tag(content=HA_ELEMENTS)
            page.add_script_tag(content=CARD_JS)
            page.evaluate(MOUNT, [mock_hass(*shot["hass"]), shot["theme"] == "dark"])
            page.wait_for_timeout(400)
            box = page.locator("#root").bounding_box()
            clip = {"x": 0, "y": 0, "width": WIDTH + 32, "height": int(box["height"] + 0.999) + 32}
            png = page.screenshot(clip=clip, animations="disabled")
            save(ROOT / "screenshots" / f"{shot['file']}.png", png)
            page.close()
        browser.close()


if __name__ == "__main__":
    main()
