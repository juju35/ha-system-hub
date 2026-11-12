"""Render the System Monitor Card and Mini Card (light and dark) and save their screenshots.

Usage: python scripts/screenshots_system_monitor.py  (needs Node.js, `pip install playwright` and
`playwright install chromium`). The data are the mock System Monitor states of the cards' tests
(test/system-monitor-card/mock-states.mjs), dated from a frozen clock; the recorder statistics are plausible 24 h
curves. The cards draw their own icons: no icon file is needed. A file is only rewritten when its decoded pixels
differ from the one already there (scripts/screenshots.py).
"""

from screenshot_node_cards import ZOOM, light_dark, node_mock, render

from screenshots import ROOT

MOCK = ROOT / "test/system-monitor-card/mock-states.mjs"

# One entry per light/dark pair: screenshots/<file>.png and <file>-dark.png
PAIRS = [
    {"file": "card-system-monitor", "type": "sh-system-card", "width": 460, "procs_ok": True},
    {"file": "card-system-monitor-mini", "type": "sh-system-mini-card", "width": 380},
    {
        "file": "card-system-monitor-mini-zoom",
        "type": "sh-system-mini-card",
        "width": 460,
        "procs_ok": True,
        "zoom": True,
    },
]
SHOTS = light_dark(PAIRS)

MOUNT = (
    """([type, config, states, entities, devices, zoom]) => {
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
"""
    + ZOOM
    + """}"""
)


def main():
    mock = node_mock(MOCK, ["states", "entities", "devices", "procsRunning"])

    def args(shot):
        states = {**mock["states"], **(mock["procsRunning"] if shot.get("procs_ok") else {})}
        return [shot["type"], {}, states, mock["entities"], mock["devices"], bool(shot.get("zoom"))]

    render("system-monitor-card.js", SHOTS, MOUNT, args)


if __name__ == "__main__":
    main()
