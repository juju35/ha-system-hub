"""Render a faithful mock of the System Hub entry in Home Assistant's sidebar, with the count badge, and save the
README screenshots as screenshots/sidebar-badge*.

Usage: python scripts/screenshots_sidebar.py  (needs `pip install playwright` and `playwright install chromium`)
CHROMIUM_PATH=/path/to/chrome to use another browser.

The real badge is injected into Home Assistant's own sidebar by system-hub-icons.js; the sidebar is not part of the
isolated element screenshots, so this draws the same row — the Status emblem, the label and Home Assistant's own
`badge` next to it — with a "to watch" (amber) tone, straight from the emblem path and tones of system-hub-icons.js.
A file is only rewritten when its decoded pixels differ from the one already there.
"""

import re
from pathlib import Path

from playwright.sync_api import sync_playwright
from screenshot_cards import open_card_page, shoot

ROOT = Path(__file__).resolve().parent.parent
ICONS = (ROOT / "custom_components/system_hub/frontend/system-hub-icons.js").read_text()
WIDTH = 256

# The emblem shape and the viewBox, read from the frontend so the mock stays in step with the real icon.
WARN_PATH = re.search(r"warn:\s*'([^']*)'", ICONS).group(1)
VIEWBOX = re.search(r"SH_ICON_VIEWBOX\s*=\s*'([^']*)'", ICONS).group(1)

# The sidebar row: the emblem on the left, the label, and Home Assistant's own trailing badge in the Status tone.
ROW = f"""
<div style="background:var(--card-background-color);border-radius:12px;overflow:hidden;padding:4px 0;">
  <div style="display:flex;align-items:center;height:48px;cursor:default;">
    <span style="width:56px;display:flex;align-items:center;justify-content:center;color:var(--secondary-text-color);">
      <svg viewBox="{VIEWBOX}" width="24" height="24" aria-hidden="true"><path d="{WARN_PATH}" fill="currentColor"/></svg>
    </span>
    <span style="flex:1;color:var(--primary-text-color);font-size:14px;line-height:1;">System Hub</span>
    <span style="min-width:18px;height:18px;box-sizing:border-box;padding:0 5px;margin-right:16px;display:inline-flex;
                 align-items:center;justify-content:center;border-radius:9px;font-size:11px;font-weight:500;
                 line-height:1;color:rgba(0,0,0,.87);background:var(--warning-color);">3</span>
  </div>
</div>
"""

SHOTS = [("sidebar-badge", "light"), ("sidebar-badge-dark", "dark")]


def main() -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for name, theme in SHOTS:
            page = open_card_page(browser, name, theme, WIDTH)
            page.evaluate("html => { document.getElementById('root').innerHTML = html; }", ROW)
            page.wait_for_timeout(200)
            shoot(page, name, WIDTH)
        browser.close()


if __name__ == "__main__":
    main()
