"""Render the Security card and mini card with mock data, for the README.

Usage: python scripts/screenshots_security.py  (needs `pip install playwright` and `playwright install chromium`)
CHROMIUM_PATH=/path/to/chrome to use another browser. The clock is frozen so the "x min ago" stay the same.
The data are the panel screenshots' (mock_security in screenshots.py), answered to system_hub/security. Every capture
keeps a 16 px frame of the theme background around the card. A capture is only rewritten when its decoded pixels
differ from the file already there, so an unchanged card never produces a screenshot commit.
"""

import copy
import json
import os
from datetime import datetime
from pathlib import Path

from playwright.sync_api import sync_playwright
from screenshot_cards import open_card_page, shoot

from screenshots import HA_ELEMENTS as HUB_ELEMENTS
from screenshots import NOW as PANEL_NOW
from screenshots import mock_security

ROOT = Path(__file__).resolve().parent.parent
CARD_JS = (ROOT / "custom_components/system_hub/frontend/cards/security-card.js").read_text()
# Material Design Icons paths used by the card (from @mdi/js).
ICONS = json.loads((ROOT / "scripts/screenshot-icons-security.json").read_text())
WIDTH = 460
MINI_WIDTH = 400
CARD = "sh-security-card"
MINI = "sh-security-mini-card"
# The panel's clock, which its mock data follow
NOW = datetime.fromisoformat(PANEL_NOW)

# The stand-ins for Home Assistant's elements are those of the panel screenshots, with the card's icons added.
HA_ELEMENTS = HUB_ELEMENTS + "\nObject.assign(ICONS, " + json.dumps(ICONS) + ");"


def fine():
    """Everything in order: no refused login, every administrator with 2FA, add-ons protected, nothing new."""
    data = copy.deepcopy(mock_security())
    data.update(refused=[], bans=[], config=[])
    data["addons"] = [a for a in data["addons"] if a["protected"] or a.get("allowed")]
    data["tokens"] = [{**t, "unused": False} for t in data["tokens"]]
    data["users"] = [{**u, "mfa": True} if u["admin"] else u for u in data["users"]]
    if data.get("outbound"):
        for group in data["outbound"]["integrations"]:
            group["new"] = 0
            for host in group["hosts"]:
                host["new"] = False
    return data


SHOTS = [
    {
        "file": f"card-security{name}{'-dark' if theme == 'dark' else ''}",
        "theme": theme,
        "card": card,
        "width": width,
        "fine": ok,
        "zoom": zoom,
    }
    for theme in ("light", "dark")
    for name, card, width, ok, zoom in (
        ("", CARD, WIDTH, False, False),
        ("-ok", CARD, WIDTH, True, False),
        # Mini card: its three worst points, everything in order, and zoomed in on the full card.
        ("-mini", MINI, MINI_WIDTH, False, False),
        ("-mini-ok", MINI, MINI_WIDTH, True, False),
        ("-mini-zoom", MINI, MINI_WIDTH, False, True),
    )
]

MOUNT = """async ([data, dark, card, zoom]) => {
    const el = document.createElement(card);
    el.setConfig({ type: `custom:${card}` });
    el.hass = {
      language: "en",
      locale: { language: "en" },
      themes: { darkMode: dark },
      user: { id: "admin", is_admin: true },
      states: {},
      entities: {},
      callWS: async (msg) => (msg.type === "system_hub/security" ? data : {}),
    };
    document.getElementById("root").appendChild(el);
    await new Promise((resolve) => setTimeout(resolve, 50));
    // The mini card zoomed in: its full view drawn, as its detail button does (no focus ring on the button)
    if (zoom) {
      el._zoomed = true;
      el._sig = null;
      el._render();
    }
}"""


def capture(browser, shot):
    """One capture: the card mounted on its theme's page, answered the mock data, then shot with its frame."""
    data = fine() if shot["fine"] else mock_security()
    page = open_card_page(browser, shot["file"], shot["theme"], shot["width"], HA_ELEMENTS, CARD_JS, now=NOW)
    page.evaluate(MOUNT, [data, shot["theme"] == "dark", shot["card"], shot["zoom"]])
    page.wait_for_timeout(400)
    shoot(page, shot["file"], shot["width"])


if __name__ == "__main__":
    with sync_playwright() as playwright:
        chromium = playwright.chromium.launch(executable_path=os.environ.get("CHROMIUM_PATH") or None)
        for each in SHOTS:
            capture(chromium, each)
        chromium.close()
