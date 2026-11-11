"""Render the Orphan Entities cards (System Hub's Orphans module) with mock data and save the README screenshots.

Usage: python scripts/screenshots_orphans.py  (needs `pip install playwright` and `playwright install chromium`)
CHROMIUM_PATH=/path/to/chrome to use another browser. The clock is frozen so the durations and "x min ago" stay the same.
Integration logos are not fetched (the reason icon is shown), so the captures don't depend on the network.
Every capture keeps a 16 px frame of the theme background around the card.
A capture is only rewritten when its decoded pixels differ from the file already there (a re-encoded but identical
image is not a change), so an unchanged card never produces a screenshot commit.
"""

import base64
import json
import os
from datetime import datetime, timedelta
from pathlib import Path

from playwright.sync_api import sync_playwright

import screenshots as panel_screenshots
from screenshots import page_html

ROOT = Path(__file__).resolve().parent.parent
CARD_JS = (ROOT / "custom_components/system_hub/frontend/cards/orphan-entities-card.js").read_text(encoding="utf-8")
NOW = datetime.fromisoformat("2026-11-04T10:00:00+01:00")
WIDTH = 460

# Material Design Icons paths used by the card (from @mdi/js): its own file, apart from the panel's.
ICONS = json.loads((ROOT / "scripts/screenshots_orphans-icons.json").read_text(encoding="utf-8"))

# The panel's stand-ins for <ha-card> and <ha-icon> (and the others), drawing the card's own icons.
HA_ELEMENTS = f"const ICONS = {json.dumps(ICONS)};" + panel_screenshots.HA_ELEMENTS.split(";", 1)[1]

ORPHANS = "sensor.system_hub_orphans_orphaned_entities"
LAST_SCAN = "sensor.system_hub_orphans_last_scan"
BUTTON = "button.system_hub_orphans_scan_now"


def ago(**delta) -> str:
    return (NOW - timedelta(**delta)).isoformat()


def orphan(entity_id, name, platform, reason, device=None, disabled=False, used_by=(), **delta):
    return {
        "entity_id": entity_id,
        "name": name,
        "platform": platform,
        "reason": reason,
        "since": ago(**delta),
        # A YAML platform has no config entry.
        "entry_id": None if reason == "integration_missing" else f"entry_{platform}",
        "entry_title": None if reason == "integration_missing" else platform.replace("_", " ").title(),
        "device": device,
        "disabled": disabled,
        "used_by": list(used_by),
    }


def ref(kind, name, path=None):
    return {"type": kind, "id": f"{kind}.{name.lower().replace(' ', '_')}", "name": name, "path": path}


# What still uses the hallway spot and the garage door, mock data.
HALLWAY_USES = [
    ref("automation", "Hallway motion light", "/config/automation/edit/1700000000001"),
    ref("script", "Good night", "/config/script/edit/good_night"),
    ref("dashboard", "Overview", "/lovelace"),
]
GARAGE_USES = [ref("automation", "Garage left open", "/config/automation/edit/1700000000002")]


# Mock orphans: neutral names, one of each reason.
ORPHANS_LIST = [
    orphan("sensor.old_node_battery", "Old node battery", "zwave_js", "entry_removed", "Old node", True, days=40),
    orphan("switch.pool_pump", "Pool pump", "command_line", "integration_missing", days=12),
    orphan("light.hallway_spot", "Hallway spot", "hue", "not_provided", "Hallway spot", used_by=HALLWAY_USES, days=9),
    orphan("sensor.hallway_spot_power", "Hallway spot power", "hue", "not_provided", "Hallway spot", days=9),
    orphan(
        "binary_sensor.garage_door",
        "Garage door",
        "zha",
        "unavailable",
        "Garage door sensor",
        used_by=GARAGE_USES,
        days=3,
    ),
    orphan("sensor.weather_station_uv", "Weather station UV", "netatmo", "unknown", "Weather station", hours=30),
]


def mock_hass(items, removed=3, devices=()):
    platform = {"platform": "system_hub", "device_id": "orphans"}
    return {
        "states": {
            ORPHANS: {
                "entity_id": ORPHANS,
                "state": str(len(items)),
                "attributes": {
                    "entities": items,
                    "devices": list(devices),
                    "removed": removed,
                    "ignored_integrations": ["mobile_app"],
                    "ignored_entities": ["sensor.kept_on_purpose"],
                },
            },
            LAST_SCAN: {"entity_id": LAST_SCAN, "state": ago(minutes=2), "attributes": {}},
            BUTTON: {"entity_id": BUTTON, "state": "unknown", "attributes": {}},
        },
        "entities": {
            ORPHANS: {**platform, "translation_key": "orphans_orphans"},
            LAST_SCAN: {**platform, "translation_key": "orphans_last_scan"},
            BUTTON: {**platform, "translation_key": "orphans_scan"},
        },
        "language": "en",
        "locale": {"language": "en"},
        # An administrator: entities can be selected, removed and ignored.
        "user": {"is_admin": True},
    }


# Devices whose integration was removed, mock data.
DEVICES = [
    {
        "device_id": "d1",
        "name": "Old Zigbee hub",
        "manufacturer": "Acme",
        "model": "ZH-1",
        "entities": 4,
        "since": None,
        # An automation still uses the device itself (device trigger): its "Used by" badge.
        "used_by": [{"type": "automation", "id": "automation.hub_button", "name": "Hub button", "path": None}],
    },
    {"device_id": "d2", "name": "Garage plug", "manufacturer": "Acme", "model": "P2", "entities": 0, "since": None},
]

MINI = "orphan-entities-mini-card"
MINI_WIDTH = 400
SELECTED = ["light.hallway_spot", "sensor.hallway_spot_power"]


def both(file, **shot):
    return [{"file": file, "theme": "light", **shot}, {"file": f"{file}-dark", "theme": "dark", **shot}]


SHOTS = [
    *both("orphans-card", hass=ORPHANS_LIST),
    # Two entities selected: the actions above the list.
    *both("orphans-card-selected", hass=ORPHANS_LIST, select=SELECTED),
    # The confirmation at the top of the card.
    *both("orphans-card-confirm", hass=ORPHANS_LIST, select=SELECTED, confirm="remove"),
    # The "Used by" list of an entity still in use, open under its row.
    *both("orphans-card-used", hass=ORPHANS_LIST, open=["light.hallway_spot"]),
    # Filtered on a reason.
    *both("orphans-card-filtered", hass=ORPHANS_LIST, reason="not_provided"),
    *both("orphans-card-ok", hass=[]),
    # Orphan devices under the entities, one selected: Ignore and Remove devices act on it.
    *both("orphans-card-devices", hass=ORPHANS_LIST[:2], devices=DEVICES, dselect=["d2"]),
    *both("orphans-mini", hass=ORPHANS_LIST, card=MINI, width=MINI_WIDTH),
    *both("orphans-mini-ok", hass=[], card=MINI, width=MINI_WIDTH),
    *both("orphans-mini-zoom", hass=ORPHANS_LIST, card=MINI, width=MINI_WIDTH, zoom=True),
]


MOUNT = """([hass, dark, card, opts]) => {
    // A 16 px frame of the theme background around the card
    document.body.style.padding = "16px";
    const el = document.createElement(card);
    el.setConfig({ type: `custom:${card}` });
    el.hass = { ...hass, themes: { darkMode: dark }, callService: async () => {} };
    document.getElementById("root").appendChild(el);
    // The mini card zoomed in: its detail button clicked with the mouse (no focus ring), the full card shown.
    if (opts.zoom) el.shadowRoot.querySelector(".zoom").dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true, detail: 1 }));
    if (opts.reason) el._reason = opts.reason;
    for (const id of opts.select || []) el._sel.add(id);
    for (const id of opts.dselect || []) el._dsel.add(id);
    for (const id of opts.open || []) el._open.add(id);
    if (opts.confirm) el._confirm = opts.confirm;
    el._sig = null;
    el._render();
}"""


# Decodes two PNGs (base64) in the browser and tells whether their pixels are the same: no image library needed.
SAME_PIXELS = """async ([a, b]) => {
    const decode = async (data) => {
        const img = new Image();
        img.src = "data:image/png;base64," + data;
        await img.decode();
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        return ctx.getImageData(0, 0, canvas.width, canvas.height);
    };
    const [x, y] = [await decode(a), await decode(b)];
    if (x.width !== y.width || x.height !== y.height) return false;
    for (let i = 0; i < x.data.length; i++) if (x.data[i] !== y.data[i]) return false;
    return true;
}"""


def same_pixels(page, new: bytes, path: Path) -> bool:
    """True when `path` exists and holds exactly the pixels of the `new` PNG."""
    if not path.exists():
        return False
    old = path.read_bytes()
    if old == new:
        return True
    return page.evaluate(SAME_PIXELS, [base64.b64encode(new).decode(), base64.b64encode(old).decode()])


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get("CHROMIUM_PATH") or None)
        for shot in SHOTS:
            page = browser.new_page(device_scale_factor=2, viewport={"width": 1000, "height": 1600})
            page.on("pageerror", lambda err, name=shot["file"]: print(f"{name}: page error: {err}"))
            # No integration logo: the reason's icon, the same on every machine.
            page.route("https://brands.home-assistant.io/**", lambda route: route.abort())
            page.clock.set_fixed_time(NOW.isoformat())
            width = shot.get("width", WIDTH)
            page.set_content(page_html(shot["theme"], width))
            page.add_script_tag(content=HA_ELEMENTS)
            page.add_script_tag(content=CARD_JS)
            card = shot.get("card", "orphan-entities-card")
            opts = {k: shot[k] for k in ("zoom", "select", "dselect", "confirm", "reason", "open") if k in shot}
            page.evaluate(
                MOUNT, [mock_hass(shot["hass"], devices=shot.get("devices", ())), shot["theme"] == "dark", card, opts]
            )
            page.wait_for_timeout(400)
            box = page.locator("#root").bounding_box()
            clip = {"x": 0, "y": 0, "width": width + 32, "height": int(box["height"] + 0.999) + 32}
            path = ROOT / "screenshots" / f"{shot['file']}.png"
            path.parent.mkdir(exist_ok=True)
            png = page.screenshot(clip=clip, animations="disabled")
            if same_pixels(page, png, path):
                print(f"{path.relative_to(ROOT)} (unchanged)")
            else:
                path.write_bytes(png)
                print(path.relative_to(ROOT))
            page.close()
        browser.close()


if __name__ == "__main__":
    main()
