// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------
import { pickerDefine } from "./card-picker.js";
import { VERSION } from "./core.js";
import { AutomationMonitorCard } from "./full-card.js";
import { AutomationMonitorMiniCard } from "./mini-card.js";
import { AutomationMonitorCardEditor, AutomationMonitorMiniCardEditor } from "./visual-editors.js";

export const define = (name, cls) => {
  if (!customElements.get(name)) pickerDefine(name, cls);
};
define("sh-automations-card", AutomationMonitorCard);
define("sh-automations-mini-card", AutomationMonitorMiniCard);
define("sh-automations-card-editor", AutomationMonitorCardEditor);
define("sh-automations-mini-card-editor", AutomationMonitorMiniCardEditor);

window.systemHubCards = window.systemHubCards || [];
for (const card of [
  {
    type: "sh-automations-card",
    name: "Automation Monitor Card",
    description: "Failed automations and unavailable linked entities reported by Automation Monitor, with error details, trace and editor links.",
  },
  {
    type: "sh-automations-mini-card",
    name: "Automation Monitor Mini Card",
    description: "Compact Automation Monitor overview: number of failed automations and unavailable linked entities.",
  },
]) {
  if (!window.systemHubCards.some((c) => c.type === card.type))
    window.systemHubCards.push({ ...card, preview: true, documentationURL: "https://github.com/juju35/ha-system-hub#automation-monitor-cards" });
}

console.info(
  `%c AUTOMATION-MONITOR-CARD %c v${VERSION} `,
  "color: white; background: #1db6ec; font-weight: 700;",
  "color: #1db6ec; background: white; font-weight: 700;"
);
