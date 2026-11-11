"""What the screenshot scripts of the cards fed by a Node.js mock share (System Monitor, Automation Monitor).

The mock states live with the cards' tests (test/<card>/mock-states.mjs) and are dated from the panel's frozen clock;
each light/dark pair gives screenshots/<file>.png and <file>-dark.png. A file is only rewritten when its decoded
pixels differ from the one already there (scripts/screenshots.py).
"""

import json
import os
import subprocess
from pathlib import Path

from playwright.sync_api import sync_playwright

from screenshots import NOW, ROOT, capture, open_page, page_html

# The mini card zoomed in, in a mount script: a mouse click (detail 1) on its detail button; a keyboard one would focus
# the button and draw its focus ring.
ZOOM = """  if (zoom) el.shadowRoot.querySelector(".zoom").dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true, detail: 1 }));
"""

# Minimal stand-in for Home Assistant's <ha-card>
HA_CARD = """customElements.define("ha-card", class extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" }).innerHTML =
      "<style>:host{display:block;background:var(--card-background-color);border-radius:12px;" +
      "border:1px solid var(--divider-color);color:var(--primary-text-color);overflow:hidden}</style><slot></slot>";
  }
});"""


def light_dark(pairs: list[dict]) -> list[dict]:
    """Each pair twice: light (<file>) and dark (<file>-dark)."""
    return [
        {**pair, "file": pair["file"] + suffix, "theme": theme}
        for pair in pairs
        for theme, suffix in (("light", ""), ("dark", "-dark"))
    ]


def node_mock(path: Path, names: list[str]) -> dict:
    """The named exports of a mock module, run by Node.js with Date frozen at the panel's clock."""
    picked = ", ".join(f"{name}: m.{name}" for name in names)
    script = f"""
const now = Date.parse({json.dumps(NOW)});
const RealDate = Date;
globalThis.Date = class extends RealDate {{
  constructor(...a) {{ super(...(a.length ? a : [now])); }}
  static now() {{ return now; }}
}};
const m = await import({json.dumps(path.as_uri())});
console.log(JSON.stringify({{ {picked} }}));
"""
    out = subprocess.run(["node", "--input-type=module", "-e", script], check=True, capture_output=True, text=True)
    return json.loads(out.stdout)


def render(card_file: str, shots: list[dict], mount: str, args) -> None:
    """Load the card, mount each shot with `mount` called on args(shot), and capture #root with its 16 px frame."""
    card_js = (ROOT / "custom_components/system_hub/frontend/cards" / card_file).read_text(encoding="utf-8")
    out = ROOT / "screenshots"
    out.mkdir(exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get("CHROMIUM_PATH") or None)
        for shot in shots:
            page = open_page(browser, shot["file"], (1000, 2000), page_html(shot["theme"], shot["width"], padding=16))
            page.add_script_tag(content=HA_CARD)
            page.add_script_tag(content=card_js)
            page.evaluate(mount, args(shot))
            page.wait_for_timeout(800)
            box = page.locator("#root").bounding_box()
            clip = {"x": 0, "y": 0, "width": shot["width"] + 32, "height": int(box["height"] + 0.999) + 32}
            capture(page, out / f"{shot['file']}.png", clip=clip, animations="disabled")
            page.close()
        browser.close()
