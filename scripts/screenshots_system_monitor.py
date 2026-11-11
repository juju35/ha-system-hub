"""Render the System Monitor Card and Mini Card (light and dark) and save their screenshots.

Usage: python scripts/screenshots_system_monitor.py  (needs Node.js, `pip install playwright` and
`playwright install chromium`). The data are the mock System Monitor states of the cards' tests
(test/system-monitor-card/mock-states.mjs), dated from a frozen clock; the recorder statistics are plausible 24 h
curves. The cards draw their own icons: no icon file is needed. A file is only rewritten when its decoded pixels
differ from the one already there (scripts/screenshots.py).
"""

import json
import os
import subprocess

from playwright.sync_api import sync_playwright

from screenshots import NOW, ROOT, capture, open_page, page_html

CARD_JS = (ROOT / "custom_components/system_hub/frontend/cards/system-monitor-card.js").read_text(encoding="utf-8")
MOCK = ROOT / "test/system-monitor-card/mock-states.mjs"

# One entry per light/dark pair: screenshots/<file>.png and <file>-dark.png
PAIRS = [
    {"file": "card-system-monitor", "type": "system-monitor-card", "width": 460, "procs_ok": True},
    {"file": "card-system-monitor-mini", "type": "system-monitor-mini-card", "width": 380},
    {
        "file": "card-system-monitor-mini-zoom",
        "type": "system-monitor-mini-card",
        "width": 460,
        "procs_ok": True,
        "zoom": True,
    },
]
SHOTS = [
    {**pair, "file": pair["file"] + suffix, "theme": theme}
    for pair in PAIRS
    for theme, suffix in (("light", ""), ("dark", "-dark"))
]

# Minimal stand-in for Home Assistant's <ha-card>
HA_CARD = """customElements.define("ha-card", class extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" }).innerHTML =
      "<style>:host{display:block;background:var(--card-background-color);border-radius:12px;" +
      "border:1px solid var(--divider-color);color:var(--primary-text-color);overflow:hidden}</style><slot></slot>";
  }
});"""

MOUNT = """([type, config, states, entities, devices, zoom]) => {
  const el = document.createElement(type);
  el.setConfig({ type: `custom:${type}`, ...config });
  // Recorder statistics: a 24 h rate curve for each rate sensor (busy evening, quiet night), and percentages for the
  // CPU (a few peaks) and the RAM (slowly rising).
  const mean = (id, k, i) =>
    /processor_use/.test(id)
      ? 12 + 30 * Math.exp(-((i - 220) ** 2) / 300) + 18 * Math.exp(-((i - 90) ** 2) / 150) + 4 * Math.sin(i * 0.08) ** 2
      : /memory/.test(id)
        ? 33 + (i / 288) * 6 + 2 * Math.sin(i * 0.05) ** 2
        : 20 + 80 * Math.exp(-((i - 230 + k * 20) ** 2) / 900) + 35 * Math.exp(-((i - 110) ** 2) / 400) + 6 * Math.sin(i * 0.035 + k) ** 2;
  const callWS = async (msg) =>
    Object.fromEntries(
      (msg.statistic_ids || []).map((id, k) => [
        id,
        Array.from({ length: 288 }, (_, i) => ({ start: Date.parse(msg.start_time) + i * 300000, mean: mean(id, k, i) })),
      ])
    );
  el.hass = {
    states, entities, devices, callWS,
    config: { version: "2026.10.2" }, language: "en", locale: { language: "en" }, user: { is_admin: true },
  };
  document.getElementById("root").appendChild(el);
  // A mouse click (detail 1): a keyboard one would focus the button and draw its focus ring.
  if (zoom) el.shadowRoot.querySelector(".zoom").dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true, detail: 1 }));
}"""


def mock_states():
    """The mock states, entity and device registries of the cards' tests, dated from the frozen clock."""
    script = f"""
const now = Date.parse({json.dumps(NOW)});
const RealDate = Date;
globalThis.Date = class extends RealDate {{
  constructor(...a) {{ super(...(a.length ? a : [now])); }}
  static now() {{ return now; }}
}};
const m = await import({json.dumps(MOCK.as_uri())});
console.log(JSON.stringify(m));
"""
    out = subprocess.run(["node", "--input-type=module", "-e", script], check=True, capture_output=True, text=True)
    return json.loads(out.stdout)


def main():
    out = ROOT / "screenshots"
    out.mkdir(exist_ok=True)
    mock = mock_states()
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get("CHROMIUM_PATH") or None)
        for shot in SHOTS:
            html = page_html(shot["theme"], shot["width"], padding=16)
            page = open_page(browser, shot["file"], (1000, 2000), html)
            page.add_script_tag(content=HA_CARD)
            page.add_script_tag(content=CARD_JS)
            states = {**mock["states"], **(mock["procsRunning"] if shot.get("procs_ok") else {})}
            page.evaluate(MOUNT, [shot["type"], {}, states, mock["entities"], mock["devices"], bool(shot.get("zoom"))])
            page.wait_for_timeout(800)
            box = page.locator("#root").bounding_box()
            clip = {"x": 0, "y": 0, "width": shot["width"] + 32, "height": int(box["height"] + 0.999) + 32}
            capture(page, out / f"{shot['file']}.png", clip=clip, animations="disabled")
            page.close()
        browser.close()


if __name__ == "__main__":
    main()
