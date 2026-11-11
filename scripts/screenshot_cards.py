"""What the card screenshot scripts share: the themes, the Home Assistant stand-ins, the page and the pixel compare.

Used by the card screenshot scripts (scripts/screenshots_*.py, run from the repository root).
"""

import json
import tempfile
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CARDS = ROOT / "custom_components/system_hub/frontend/cards"
# The clock is frozen so the "x min ago" stay the same.
NOW = datetime.fromisoformat("2026-10-31T14:00:00+01:00")

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
    "--info-color": "#039be5",
    "--error-color": "#db4437",
    "--text-primary-color": "#ffffff",
}


def ha_elements(icons_file: str) -> str:
    """Minimal stand-ins for Home Assistant's <ha-card> and <ha-icon>, with the card's MDI paths (from @mdi/js).

    Each card has its own icon file: the panel's scripts/screenshot-icons.json is left to the panel.
    """
    icons = json.loads((ROOT / "scripts" / icons_file).read_text(encoding="utf-8"))
    card_css = ";".join(
        (
            "display:block",
            "background:var(--card-background-color)",
            "border-radius:12px",
            "border:1px solid var(--divider-color)",
            "color:var(--primary-text-color)",
            "overflow:hidden",
        )
    )
    svg = "width:var(--mdc-icon-size,24px);height:var(--mdc-icon-size,24px);fill:currentColor"
    return f"""(() => {{
  const paths = {json.dumps(icons)};
  class Card extends HTMLElement {{
    constructor() {{
      super();
      this.attachShadow({{ mode: "open" }}).innerHTML = "<style>:host{{{card_css}}}</style><slot></slot>";
    }}
  }}
  class Icon extends HTMLElement {{
    static observedAttributes = ["icon"];
    connectedCallback() {{ this.paint(); }}
    attributeChangedCallback() {{ this.paint(); }}
    paint() {{
      const name = String(this.getAttribute("icon") || "").replace(/^mdi:/, "");
      this.style.display = "inline-flex";
      this.innerHTML = `<svg viewBox="0 0 24 24" style="{svg}"><path d="${{paths[name] || ""}}"/></svg>`;
    }}
  }}
  customElements.define("ha-card", Card);
  customElements.define("ha-icon", Icon);
}})();"""


def page_html(theme: str, width: int) -> str:
    """An empty page in the theme's colours, the card mounted in #root with a 16 px frame around it."""
    root = "".join(f"{name}:{value};" for name, value in (THEMES[theme] | COMMON).items())
    font = 'Roboto, "Segoe UI", Helvetica, Arial, sans-serif'
    body = f"margin:0;padding:16px;background:var(--primary-background-color);font-family:{font};width:{width}px"
    return f'<!doctype html><html><head><meta charset="utf-8"><style>:root{{{root}}} body{{{body}}}</style></head>' + (
        '<body><div id="root"></div></body></html>'
    )


def same_pixels(old: bytes, new: bytes) -> bool:
    """True when both PNGs decode to the same pixels (size included), whatever their compression (ffmpeg decodes)."""
    from screenshots import pixels

    if old == new:
        return True
    with tempfile.TemporaryDirectory() as tmp:
        a, b = Path(tmp, "a.png"), Path(tmp, "b.png")
        a.write_bytes(old)
        b.write_bytes(new)
        decoded = pixels(a)
        return decoded is not None and decoded == pixels(b)


def save(path: Path, png: bytes) -> None:
    """Write the capture, only when its decoded pixels changed (PNG bytes may differ between machines: zlib)."""
    path.parent.mkdir(exist_ok=True)
    if path.exists() and same_pixels(path.read_bytes(), png):
        print(f"{path.relative_to(ROOT)} (unchanged)")
    else:
        path.write_bytes(png)
        print(path.relative_to(ROOT))


def open_card_page(browser, name: str, theme: str, width: int, *scripts: str, now: datetime = NOW):
    """A page in the theme with the clock frozen, logos not fetched (generic icon), and the given scripts loaded."""
    page = browser.new_page(device_scale_factor=2, viewport={"width": 1000, "height": 1600})
    page.on("pageerror", lambda err: print(f"{name}: page error: {err}"))
    page.route("https://brands.home-assistant.io/**", lambda route: route.abort())
    page.clock.set_fixed_time(now.isoformat())
    page.set_content(page_html(theme, width))
    for script in scripts:
        page.add_script_tag(content=script)
    return page


def shoot(page, name: str, width: int) -> None:
    """Capture #root with its 16 px frame into screenshots/<name>.png (only when its pixels changed)."""
    box = page.locator("#root").bounding_box()
    clip = {"x": 0, "y": 0, "width": width + 32, "height": int(box["height"] + 0.999) + 32}
    save(ROOT / "screenshots" / f"{name}.png", page.screenshot(clip=clip, animations="disabled"))
    page.close()
