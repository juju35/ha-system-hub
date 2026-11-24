// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------
import { pickerDefine } from "./card-picker.js";
import { VERSION } from "./core.js";
import { SystemMonitorCard } from "./full-card.js";
import { SystemMonitorMiniCard } from "./mini-card.js";
import { SystemMonitorCardEditor, SystemMonitorMiniCardEditor } from "./visual-editors.js";

export const define = (name, cls) => {
  if (!customElements.get(name)) pickerDefine(name, cls);
};
define("sh-system-card", SystemMonitorCard);
define("sh-system-mini-card", SystemMonitorMiniCard);
define("sh-system-card-editor", SystemMonitorCardEditor);
define("sh-system-mini-card-editor", SystemMonitorMiniCardEditor);

window.systemHubCards = window.systemHubCards || [];
for (const card of [
  {
    type: "sh-system-card",
    name: "System Monitor Card",
    description: "Monitor the machine running Home Assistant: CPU, RAM, disk, temperature, network, storage and processes.",
  },
  {
    type: "sh-system-mini-card",
    name: "System Monitor Mini Card",
    description: "Compact Home Assistant host overview: CPU, RAM, disk, temperature, network and uptime.",
  },
]) {
  if (!window.systemHubCards.some((c) => c.type === card.type))
    window.systemHubCards.push({ ...card, preview: true, documentationURL: "https://github.com/juju35/ha-system-hub#system-monitor-cards" });
}

console.info(
  `%c SYSTEM-MONITOR-CARD %c v${VERSION} `,
  "color: white; background: #18bcf2; font-weight: 700;",
  "color: #18bcf2; background: white; font-weight: 700;"
);
