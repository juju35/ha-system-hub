"""Render the Watchdog card and mini card (ported from Integration Watchdog) with mock data, for the README.

Usage: python scripts/screenshots_watchdog.py  (needs `pip install playwright` and `playwright install chromium`)
CHROMIUM_PATH=/path/to/chrome to use another browser. The clock is frozen so the durations and "x min ago" stay the same.
Integration logos are not fetched (the generic icon is shown), so the captures don't depend on the network.
Every capture keeps a 16 px frame of the theme background around the card. A capture is only rewritten when its decoded
pixels differ from the file already there, so an unchanged card never produces a screenshot commit.
"""

import json
import os
from datetime import timedelta
from pathlib import Path

from playwright.sync_api import sync_playwright
from screenshot_cards import NOW, open_card_page, shoot

from screenshots import HA_ELEMENTS as HUB_ELEMENTS

ROOT = Path(__file__).resolve().parent.parent
CARD_JS = (ROOT / "custom_components/system_hub/frontend/cards/integration-watchdog-card.js").read_text()
# Material Design Icons paths used by the card (from @mdi/js).
ICONS = json.loads((ROOT / "scripts/screenshot-icons-watchdog.json").read_text())
WIDTH = 460
MINI_WIDTH = 400
CARD = "integration-watchdog-card"
MINI = "integration-watchdog-mini-card"

# The stand-ins for Home Assistant's elements are those of the panel screenshots, with the card's icons added.
HA_ELEMENTS = HUB_ELEMENTS + "\nObject.assign(ICONS, " + json.dumps(ICONS) + ");"

# The System Hub Watchdog module's entities.
UNAVAILABLE = "sensor.system_hub_watchdog_unavailable_integrations"
LAST_RELOAD = "sensor.system_hub_watchdog_last_reload"
LAST_CHECK = "sensor.system_hub_watchdog_last_check"
BUTTON = "button.system_hub_watchdog_check_now"


def ago(**delta) -> str:
    return (NOW - timedelta(**delta)).isoformat()


# Mock integrations: one given up, one reloaded once and still down, one within its grace period.
INTEGRATIONS = [
    {"domain": "zha", "title": "Zigbee coordinator", "since": ago(hours=5), "reloads": 3, "gave_up": True},
    {"domain": "hue", "title": "Hue Bridge", "since": ago(minutes=40), "reloads": 1, "gave_up": False},
    {"domain": "sonos", "title": "Sonos", "since": ago(minutes=6), "reloads": 0, "gave_up": False},
]


def event(kind, domain, title, attempt, **delta):
    return {
        "kind": kind,
        "at": ago(**delta),
        "entry_id": f"entry_{domain}",
        "domain": domain,
        "title": title,
        "attempt": attempt,
        "max_reloads": 3,
    }


HISTORY = [
    event("gave_up", "zha", "Zigbee coordinator", 3, minutes=20),
    event("reloaded", "hue", "Hue Bridge", 1, minutes=25),
    event("reload_failed", "zha", "Zigbee coordinator", 3, hours=1, minutes=20),
    event("reloaded", "zha", "Zigbee coordinator", 2, hours=4, minutes=20),
    event("reloaded", "tuya", "Tuya", 1, days=1, hours=2),
]


def mock_hass(integrations, history, reloads):
    platform = {"platform": "system_hub", "device_id": "watchdog"}
    return {
        "states": {
            UNAVAILABLE: {
                "entity_id": UNAVAILABLE,
                "state": str(len(integrations)),
                "attributes": {
                    "integrations": [{**i, "entry_id": f"entry_{i['domain']}"} for i in integrations],
                    "ignored": ["mobile_app", "tts"],
                    "max_reloads": 3,
                    "paused": False,
                },
            },
            LAST_RELOAD: {
                "entity_id": LAST_RELOAD,
                "state": history[0]["at"] if history else "unknown",
                "attributes": {"history": history, "reloads": reloads},
            },
            LAST_CHECK: {"entity_id": LAST_CHECK, "state": ago(minutes=2), "attributes": {}},
            BUTTON: {"entity_id": BUTTON, "state": "unknown", "attributes": {}},
        },
        "entities": {
            UNAVAILABLE: {**platform, "translation_key": "watchdog_unavailable"},
            LAST_RELOAD: {**platform, "translation_key": "watchdog_last_reload"},
            LAST_CHECK: {**platform, "translation_key": "watchdog_last_check"},
            BUTTON: {**platform, "translation_key": "watchdog_check"},
        },
        "language": "en",
        "locale": {"language": "en"},
        # An administrator: the rows open the integration's page.
        "user": {"is_admin": True},
    }


DOWN = (INTEGRATIONS, HISTORY, 4)
OK = ([], HISTORY[1:], 3)
SHOTS = [
    {
        "file": f"card-watchdog{name}{'-dark' if theme == 'dark' else ''}",
        "theme": theme,
        "card": card,
        "width": width,
        "hass": hass,
        "zoom": zoom,
    }
    for theme in ("light", "dark")
    for name, card, width, hass, zoom in (
        ("", CARD, WIDTH, DOWN, False),
        ("-ok", CARD, WIDTH, OK, False),
        # Mini card: compact, everything available, and zoomed in on the full card with its detail button.
        ("-mini", MINI, MINI_WIDTH, DOWN, False),
        ("-mini-ok", MINI, MINI_WIDTH, OK, False),
        ("-mini-zoom", MINI, MINI_WIDTH, DOWN, True),
    )
]


MOUNT = """([hass, dark, card, zoom]) => {
    const el = document.createElement(card);
    el.setConfig({ type: `custom:${card}` });
    el.hass = { ...hass, themes: { darkMode: dark }, callService: async () => {} };
    document.getElementById("root").appendChild(el);
    // The mini card zoomed in: its detail button clicked with the mouse (no focus ring), the full card shown.
    if (zoom) el.shadowRoot.querySelector(".zoom").dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true, detail: 1 }));
}"""


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get("CHROMIUM_PATH") or None)
        for shot in SHOTS:
            page = open_card_page(browser, shot["file"], shot["theme"], shot["width"], HA_ELEMENTS, CARD_JS)
            page.evaluate(MOUNT, [mock_hass(*shot["hass"]), shot["theme"] == "dark", shot["card"], shot["zoom"]])
            page.wait_for_timeout(400)
            shoot(page, shot["file"], shot["width"])
        browser.close()


if __name__ == "__main__":
    main()
