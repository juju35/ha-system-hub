"""Render the Automation Monitor Card and Mini Card, light and dark, from the mock states of their tests
(test/automation-monitor-card/mock-states.mjs): see scripts/screenshot_node_cards.py."""

from screenshot_node_cards import ZOOM, light_dark, node_mock, render

from screenshots import ROOT

MOCK = ROOT / "test/automation-monitor-card/mock-states.mjs"

# One entry per light/dark pair: screenshots/<file>.png and <file>-dark.png
PAIRS = [
    {"file": "card-automation-monitor", "type": "sh-automations-card", "width": 460},
    {
        "file": "card-automation-monitor-open",
        "type": "sh-automations-card",
        "width": 460,
        "clicks": ['[data-section="failed"]', '[data-section="linked"]'],
    },
    {"file": "card-automation-monitor-ok", "type": "sh-automations-card", "width": 460, "ok": True},
    {"file": "card-automation-monitor-mini", "type": "sh-automations-mini-card", "width": 380},
    {"file": "card-automation-monitor-mini-ok", "type": "sh-automations-mini-card", "width": 380, "ok": True},
    {"file": "card-automation-monitor-mini-zoom", "type": "sh-automations-mini-card", "width": 460, "zoom": True},
]
SHOTS = light_dark(PAIRS)

MOUNT = (
    """([type, states, entities, zoom, clicks]) => {
  const el = document.createElement(type);
  el.setConfig({ type: `custom:${type}` });
  el.hass = {
    states, entities, language: "en", locale: { language: "en" }, user: { is_admin: true }, callService: () => {},
  };
  document.getElementById("root").appendChild(el);
"""
    + ZOOM
    + """  for (const sel of clicks) el.shadowRoot.querySelector(sel).click();
}"""
)


def main():
    mock = node_mock(MOCK, ["states", "entities", "allGood"])

    def args(shot):
        states = dict(mock["states"])
        if shot.get("ok"):
            for entity_id, override in mock["allGood"].items():
                states[entity_id] = {**states[entity_id], **override}
        return [shot["type"], states, mock["entities"], bool(shot.get("zoom")), shot.get("clicks", [])]

    render("automation-monitor-card.js", SHOTS, MOUNT, args)


if __name__ == "__main__":
    main()
