"""Render the Git Sync card, its mini card and diff viewer with mock data and save the docs screenshots.

Usage: python scripts/screenshots_git_sync.py  (needs `pip install playwright pillow` and `playwright install chromium`)
CHROMIUM_PATH=/path/to/chrome to use another browser. The clock is frozen so the "x min ago" stay the same.
Mock data only: no real repository, file name or person. Every capture keeps a 16 px frame of the theme background.
A file is only rewritten when its decoded pixels change, so a re-encoding alone never shows up as a diff.
"""

import os
from datetime import timedelta

from playwright.sync_api import sync_playwright
from screenshot_cards import CARDS, NOW, ROOT, ha_elements, page_html, save

CARD_JS = (CARDS / "git-sync-card.js").read_text()
WIDTH = 460
MINI_WIDTH = 300  # about 6 columns of a sections view
HA_ELEMENTS = ha_elements("screenshot-icons-git-sync.json")

STATUS = "sensor.system_hub_git_sync_status"
LAST_COMMIT = "sensor.system_hub_git_sync_last_commit"
LAST_PUSH = "sensor.system_hub_git_sync_last_push"
LAST_EXPORT = "sensor.system_hub_git_sync_last_export"


def ago(**delta) -> str:
    return (NOW - timedelta(**delta)).isoformat()


FILES = [
    "automations.yaml",
    "scripts.yaml",
    "dashboards_export/lovelace.dashboard_home",
    "packages/lighting.yaml",
]


def mock_hass(status, files, error=None):
    platform = {"platform": "system_hub", "device_id": "system_hub"}
    return {
        "states": {
            STATUS: {
                "entity_id": STATUS,
                "state": status,
                "attributes": {
                    "branch": "main",
                    "remote_url": "git@github.com:example/homeassistant-config.git",
                    "changed_count": len(files),
                    "changed_files": files,
                    "last_error": error,
                    "ai_task": "ai_task.assistant",
                },
            },
            LAST_COMMIT: {
                "entity_id": LAST_COMMIT,
                "state": ago(minutes=42),
                "attributes": {
                    "message": "feat(corridor): lower the night light threshold to 5 lux",
                    "short_sha": "3f9c2ab",
                },
            },
            LAST_PUSH: {"entity_id": LAST_PUSH, "state": ago(minutes=42), "attributes": {}},
            LAST_EXPORT: {
                "entity_id": LAST_EXPORT,
                "state": ago(hours=6),
                "attributes": {"files": ["lovelace", "lovelace.dashboard_home", "lovelace_dashboards"]},
            },
        },
        "entities": {
            STATUS: {**platform, "translation_key": "git_sync_status"},
            LAST_COMMIT: {**platform, "translation_key": "git_sync_last_commit"},
            LAST_PUSH: {**platform, "translation_key": "git_sync_last_push"},
            LAST_EXPORT: {**platform, "translation_key": "git_sync_last_export"},
        },
        "language": "en",
        "locale": {"language": "en"},
        # The actions are shown to administrators only.
        "user": {"is_admin": True},
    }


# The changes shown by the diff viewer (what the get_diff action returns), mock data.
DIFF = {
    "additions": 14,
    "deletions": 3,
    "more_files": 0,
    "files": [
        {
            "path": "automations.yaml",
            "status": "modified",
            "old_path": None,
            "binary": False,
            "additions": 7,
            "deletions": 2,
            "truncated": 0,
            "hunks": [
                {
                    "header": "@@ -12,9 +12,14 @@ - alias: Corridor night light",
                    "lines": [
                        {"kind": "context", "old": 12, "new": 12, "text": "  triggers:"},
                        {"kind": "context", "old": 13, "new": 13, "text": "    - trigger: state"},
                        {
                            "kind": "context",
                            "old": 14,
                            "new": 14,
                            "text": "      entity_id: binary_sensor.corridor_occupancy",
                        },
                        {"kind": "context", "old": 15, "new": 15, "text": '      to: "on"'},
                        {"kind": "context", "old": 16, "new": 16, "text": "  conditions:"},
                        {"kind": "del", "old": 17, "new": None, "text": "    - condition: numeric_state"},
                        {"kind": "del", "old": 18, "new": None, "text": "      entity_id: sensor.corridor_illuminance"},
                        {"kind": "add", "old": None, "new": 17, "text": "    - condition: numeric_state"},
                        {"kind": "add", "old": None, "new": 18, "text": "      entity_id: sensor.corridor_illuminance"},
                        {"kind": "add", "old": None, "new": 19, "text": "      below: 5"},
                        {"kind": "add", "old": None, "new": 20, "text": "    - condition: time"},
                        {"kind": "add", "old": None, "new": 21, "text": '      after: "22:00:00"'},
                        {"kind": "add", "old": None, "new": 22, "text": '      before: "07:00:00"'},
                        {"kind": "context", "old": 19, "new": 23, "text": "  actions:"},
                        {"kind": "context", "old": 20, "new": 24, "text": "    - action: light.turn_on"},
                        {"kind": "add", "old": None, "new": 25, "text": "      data:"},
                        {"kind": "add", "old": None, "new": 26, "text": "        brightness_pct: 30"},
                    ],
                }
            ],
        },
        {
            "path": "scripts.yaml",
            "status": "modified",
            "old_path": None,
            "binary": False,
            "additions": 1,
            "deletions": 1,
            "truncated": 0,
            "hunks": [
                {
                    "header": "@@ -3,3 +3,3 @@",
                    "lines": [
                        {"kind": "del", "old": 4, "new": None, "text": "  icon: mdi:lightbulb"},
                        {"kind": "add", "old": None, "new": 4, "text": "  icon: mdi:lightbulb-night"},
                    ],
                }
            ],
        },
        {
            "path": "dashboards_export/lovelace.dashboard_home",
            "status": "modified",
            "old_path": None,
            "binary": False,
            "additions": 3,
            "deletions": 0,
            "truncated": 0,
            "hunks": [],
        },
        {
            "path": "packages/lighting.yaml",
            "status": "added",
            "old_path": None,
            "binary": False,
            "additions": 3,
            "deletions": 0,
            "truncated": 0,
            "hunks": [
                {
                    "header": "@@ -0,0 +1,3 @@",
                    "lines": [
                        {"kind": "add", "old": None, "new": 1, "text": "scene:"},
                        {"kind": "add", "old": None, "new": 2, "text": "  - name: Corridor night"},
                        {"kind": "add", "old": None, "new": 3, "text": "    entities: {}"},
                    ],
                }
            ],
        },
    ],
}

DIRTY = ("dirty", FILES)
CLEAN = ("clean", [])
ERROR = ("error", [], "git push failed: Permission denied (publickey).")

# (file, theme, hass, action after mounting, card)
SHOTS = [
    ("card-git-sync", "light", DIRTY, "files", "git-sync-card"),
    ("card-git-sync-dark", "dark", DIRTY, "files", "git-sync-card"),
    ("card-git-sync-clean", "light", CLEAN, None, "git-sync-card"),
    ("card-git-sync-clean-dark", "dark", CLEAN, None, "git-sync-card"),
    ("card-git-sync-error", "light", ERROR, None, "git-sync-card"),
    ("card-git-sync-error-dark", "dark", ERROR, None, "git-sync-card"),
    ("card-git-sync-confirm", "light", DIRTY, "confirm", "git-sync-card"),
    ("card-git-sync-confirm-dark", "dark", DIRTY, "confirm", "git-sync-card"),
    ("card-git-sync-mini", "light", DIRTY, None, "git-sync-mini-card"),
    ("card-git-sync-mini-dark", "dark", DIRTY, None, "git-sync-mini-card"),
    ("card-git-sync-mini-clean", "light", CLEAN, None, "git-sync-mini-card"),
    ("card-git-sync-mini-clean-dark", "dark", CLEAN, None, "git-sync-mini-card"),
    ("card-git-sync-mini-error", "light", ERROR, None, "git-sync-mini-card"),
    ("card-git-sync-mini-error-dark", "dark", ERROR, None, "git-sync-mini-card"),
    ("card-git-sync-mini-zoomed", "light", DIRTY, "zoom", "git-sync-mini-card"),
    ("card-git-sync-mini-zoomed-dark", "dark", DIRTY, "zoom", "git-sync-mini-card"),
    # The full-screen diff viewer: a desktop window, and a phone (full screen, files as chips above the diff).
    ("card-git-sync-diff", "light", DIRTY, "diff", "git-sync-card"),
    ("card-git-sync-diff-dark", "dark", DIRTY, "diff", "git-sync-card"),
    ("card-git-sync-diff-phone", "light", DIRTY, "diff", "git-sync-card"),
    ("card-git-sync-diff-phone-dark", "dark", DIRTY, "diff", "git-sync-card"),
]
# Viewport of the diff viewer captures (the viewer fills it); other captures are clipped to the card.
VIEWPORTS = {"card-git-sync-diff": (1000, 640), "card-git-sync-diff-phone": (390, 760)}


MOUNT = """([hass, dark, action, card]) => {
    const el = document.createElement(card);
    el.setConfig({ type: `custom:${card}` });
    el.hass = { ...hass, themes: { darkMode: dark }, callService: async (d, s) => ({ response: s === "git_sync_get_diff" ? hass.diff : {} }) };
    document.getElementById("root").appendChild(el);
    if (action === "files") el.shadowRoot.querySelector(".toggle").click();
    if (action === "zoom") el.shadowRoot.querySelector(".zoom").click();
    if (action === "diff") el.shadowRoot.querySelector("#diff").click();
    if (action === "confirm") {
        el.shadowRoot.querySelector("#commit").click();
        // The message written by the sparkle button (AI task) in the field.
        el._draft = "feat(lights): add the corridor night scene";
        el._render();
    }
}"""


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get("CHROMIUM_PATH") or None)
        for name, theme, state, action, card in SHOTS:
            width = MINI_WIDTH if card == "git-sync-mini-card" else WIDTH
            viewport = VIEWPORTS.get(name.removesuffix("-dark"))
            page = browser.new_page(
                device_scale_factor=2,
                viewport={"width": viewport[0], "height": viewport[1]} if viewport else {"width": 1000, "height": 1600},
            )
            page.on("pageerror", lambda err, name=name: print(f"{name}: page error: {err}"))
            page.clock.set_fixed_time(NOW.isoformat())
            page.set_content(page_html(theme, width))
            page.add_script_tag(content=HA_ELEMENTS)
            page.add_script_tag(content=CARD_JS)
            page.evaluate(MOUNT, [{**mock_hass(*state), "diff": DIFF}, theme == "dark", action, card])
            page.wait_for_timeout(400)
            if viewport:
                clip = {"x": 0, "y": 0, "width": viewport[0], "height": viewport[1]}
            else:
                box = page.locator("#root").bounding_box()
                clip = {"x": 0, "y": 0, "width": width + 32, "height": int(box["height"] + 0.999) + 32}
            png = page.screenshot(clip=clip, animations="disabled")
            save(ROOT / "screenshots" / f"{name}.png", png)
            page.close()
        browser.close()


if __name__ == "__main__":
    main()
