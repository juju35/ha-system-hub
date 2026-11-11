// Evaluates src/system-monitor-card.js (a plain script, not a module) in a sandbox with just
// enough browser stubs to define the cards, and returns its internal helpers for the tests.
import { readFileSync } from "node:fs";
import vm from "node:vm";

const NAMES = [
  "discover",
  "discoverDatabase",
  "discoverBackup",
  "backupStatus",
  "trackedIds",
  "renderSignature",
  "sameSignature",
  "focusSelector",
  "fmtBytes",
  "fmtBytesPair",
  "spark",
  "ICONS",
  "STRINGS",
  "lang",
  "SystemMonitorCard",
  "SystemMonitorMiniCard",
  "SystemMonitorCardEditor",
  "SystemMonitorMiniCardEditor",
  "document",
  "window",
];

export const load = () => {
  const src = readFileSync(new URL("../../custom_components/system_hub/frontend/cards/system-monitor-card.js", import.meta.url), "utf8");
  const defined = new Map();
  const context = {
    HTMLElement: class {
      attachShadow() {
        this.shadowRoot = { addEventListener() {}, querySelector: () => null, innerHTML: "" };
        return this.shadowRoot;
      }
    },
    customElements: { get: (n) => defined.get(n), define: (n, c) => defined.set(n, c) },
    document: { addEventListener() {}, removeEventListener() {}, createElement: () => ({}) },
    console: { info() {}, log: console.log },
    CustomEvent: class {},
    history: { pushState() {} },
    Intl,
    Date,
    setInterval: () => 0,
    clearInterval() {},
  };
  context.window = context;
  vm.createContext(context);
  return vm.runInContext(`${src}\n;({ ${NAMES.join(", ")} })`, context);
};
