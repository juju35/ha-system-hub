"""Render the Watchdog card and mini card (ported from Integration Watchdog) with mock data, for the README.

Usage: python scripts/screenshots_watchdog.py  (needs `pip install playwright` and `playwright install chromium`)
CHROMIUM_PATH=/path/to/chrome to use another browser. The clock is frozen so the durations and "x min ago" stay the same.
Integration logos are not fetched (the generic icon is shown), so the captures don't depend on the network.
Every capture keeps a 16 px frame of the theme background around the card. A capture is only rewritten when its decoded
pixels differ from the file already there, so an unchanged card never produces a screenshot commit.
"""

import base64
import json
import os
from datetime import datetime, timedelta
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
CARD_JS = (ROOT / "custom_components/system_hub/frontend/cards/integration-watchdog-card.js").read_text()
# Material Design Icons paths used by the card (from @mdi/js).
ICONS = json.loads((ROOT / "scripts/screenshot-icons-watchdog.json").read_text())
NOW = datetime.fromisoformat("2026-10-31T14:00:00+01:00")
WIDTH = 460
MINI_WIDTH = 400
CARD = "integration-watchdog-card"
MINI = "integration-watchdog-mini-card"

THEMES = {
    "light": {
        "--primary-background-color": "#e8eaed",
        "--secondary-background-color": "#ececec",
        "--card-background-color": "#ffffff",
        "--primary-text-color": "#212121",
        "--secondary-text-color": "#727272",
        "--divider-color": "rgba(0,0,0,.12)",
    },
    "dark": {
        "--primary-background-color": "#111111",
        "--secondary-background-color": "#282828",
        "--card-background-color": "#1c1c1c",
        "--primary-text-color": "#e1e1e1",
        "--secondary-text-color": "#9b9b9b",
        "--divider-color": "rgba(225,225,225,.12)",
    },
}
COMMON = {
    "--primary-color": "#03a9f4",
    "--success-color": "#43a047",
    "--warning-color": "#ffa600",
    "--error-color": "#db4437",
    "--text-primary-color": "#ffffff",
}

# Minimal stand-ins for Home Assistant's <ha-card> and <ha-icon>.
HA_ELEMENTS = (
    "const ICONS = "
    + json.dumps(ICONS)
    + ";"
    + """
customElements.define("ha-card", class extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" }).innerHTML =
      "<style>:host{display:block;background:var(--card-background-color);border-radius:12px;" +
      "border:1px solid var(--divider-color);color:var(--primary-text-color);overflow:hidden}</style><slot></slot>";
  }
});
customElements.define("ha-icon", class extends HTMLElement {
  static get observedAttributes() { return ["icon"]; }
  connectedCallback() { this._draw(); }
  attributeChangedCallback() { this._draw(); }
  _draw() {
    const path = ICONS[(this.getAttribute("icon") || "").replace("mdi:", "")] || "";
    this.style.display = "inline-flex";
    this.innerHTML = '<svg viewBox="0 0 24 24" style="width:var(--mdc-icon-size,24px);height:var(--mdc-icon-size,24px);fill:currentColor"><path d="' + path + '"/></svg>';
  }
});"""
)

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


def page_html(theme, width, padding=16):
    variables = "".join(f"{k}:{v};" for k, v in {**THEMES[theme], **COMMON}.items())
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>
:root {{ {variables} }}
body {{ margin: 0; padding: {padding}px; background: var(--primary-background-color);
       font-family: Roboto, "Segoe UI", Helvetica, Arial, sans-serif; width: {width}px; }}
</style></head><body><div id="root"></div></body></html>"""


MOUNT = """([hass, dark, card, zoom]) => {
    const el = document.createElement(card);
    el.setConfig({ type: `custom:${card}` });
    el.hass = { ...hass, themes: { darkMode: dark }, callService: async () => {} };
    document.getElementById("root").appendChild(el);
    // The mini card zoomed in: its detail button clicked with the mouse (no focus ring), the full card shown.
    if (zoom) el.shadowRoot.querySelector(".zoom").dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true, detail: 1 }));
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


def save(page, name: str, width: int, frame: int) -> None:
    """Shoot #root (`frame` px of background added below it) into screenshots/<name>.png when its pixels changed."""
    box = page.locator("#root").bounding_box()
    clip = {"x": 0, "y": 0, "width": width, "height": int(box["height"] + 0.999) + frame}
    path = ROOT / "screenshots" / f"{name}.png"
    path.parent.mkdir(exist_ok=True)
    png = page.screenshot(clip=clip, animations="disabled")
    if same_pixels(page, png, path):
        print(f"{path.relative_to(ROOT)} (unchanged)")
    else:
        path.write_bytes(png)
        print(path.relative_to(ROOT))
    page.close()


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get("CHROMIUM_PATH") or None)
        for shot in SHOTS:
            page = browser.new_page(device_scale_factor=2, viewport={"width": 1000, "height": 1600})
            page.on("pageerror", lambda err, name=shot["file"]: print(f"{name}: page error: {err}"))
            # No integration logo: the generic icon, the same on every machine.
            page.route("https://brands.home-assistant.io/**", lambda route: route.abort())
            page.clock.set_fixed_time(NOW.isoformat())
            page.set_content(page_html(shot["theme"], shot["width"]))
            page.add_script_tag(content=HA_ELEMENTS)
            page.add_script_tag(content=CARD_JS)
            page.evaluate(MOUNT, [mock_hass(*shot["hass"]), shot["theme"] == "dark", shot["card"], shot["zoom"]])
            page.wait_for_timeout(400)
            save(page, shot["file"], shot["width"] + 32, 32)
        browser.close()


if __name__ == "__main__":
    main()
