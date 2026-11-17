// The status pill's place in the headers of every card, decided by measurement (_fitPill), on a stand-in layout: on
// the title row only when the whole title and the pill's whole label fit; otherwise on its own line under the
// subtitle; its dot alone on a card 200 px wide or less, or when its label is wider than the title block. No fixed
// width decides it.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const CARDS = {
  "automation-monitor-card.js": "AM_PILL",
  "battery-monitor-card.js": "BM_PILL",
  "git-sync-card.js": "GS_PILL",
  "integration-watchdog-card.js": "IW_PILL",
  "marketplace-refresh-card.js": "MR_PILL",
  "orphan-entities-card.js": "OE_PILL",
  "system-hub-card.js": "SH_CARD_PILL",
  "system-monitor-card.js": "SM_PILL",
};
const source = (file) => readFileSync(new URL(`../custom_components/system_hub/frontend/cards/${file}`, import.meta.url), "utf8");

// The card's _fitPill and its parts (the XX_PILL constant), taken from its source.
function fitOf(file, constant) {
  const src = source(file);
  const parts = new Function(`return ${src.match(new RegExp(`(?:const|var) ${constant} = (\\{[^}]*\\});`))[1]}`)();
  const start = src.indexOf("  _fitPill() {");
  const body = src.slice(start + "  _fitPill() {".length, src.indexOf("\n  }\n", start));
  return { parts, fit: new Function(constant, `return function () {${body}\n};`)(parts) };
}

// A header (block > row > title + pill, then the subtitle) whose boxes follow the classes _fitPill sets.
function header(parts, { rowW, titleW, chipW, cardW = 400 }) {
  const classes = new Set();
  const box = (width) => ({ top: 10, bottom: 30, height: 20, left: 0, right: width, width });
  const node = (sel, extra = {}) => ({ sel, matches: (s) => s === sel, ...extra });
  const name = node(parts.name, { scrollWidth: titleW, getBoundingClientRect: () => box(titleW) });
  const chip = node(parts.chip, { getBoundingClientRect: () => box(classes.has("pill-dot") ? 14 : chipW) });
  const row = node(parts.row, { children: [name, chip], getBoundingClientRect: () => box(rowW) });
  const sub = node(parts.sub, { getBoundingClientRect: () => box(60) });
  const block = node(parts.block, {
    children: [row, sub],
    classList: {
      add: (...c) => {
        for (const x of c) classes.add(x);
      },
      remove: (...c) => {
        for (const x of c) classes.delete(x);
      },
    },
    getBoundingClientRect: () => box(rowW),
    closest: () => null,
  });
  const host = { getBoundingClientRect: () => ({ width: cardW }), shadowRoot: { querySelectorAll: (sel) => (sel === parts.block ? [block] : []) } };
  return { host, classes };
}

for (const [file, constant] of Object.entries(CARDS)) {
  test(`${file}: the pill beside a whole title, else under the subtitle, its dot when narrow`, () => {
    const { parts, fit } = fitOf(file, constant);
    const run = (opts) => {
      const h = header(parts, opts);
      fit.call(h.host);
      return [...h.classes].sort().join(" ");
    };
    assert.equal(run({ rowW: 300, titleW: 120, chipW: 70 }), "");
    // One pixel short: the pill goes under the subtitle with its whole label, the title stays whole.
    assert.equal(run({ rowW: 199, titleW: 120, chipW: 71 }), "pill-below");
    // A label wider than the title block: its dot alone.
    assert.equal(run({ rowW: 120, titleW: 110, chipW: 140 }), "pill-below pill-dot");
    // 200 px or less: the dot, on the title row when the title fits.
    assert.equal(run({ rowW: 150, titleW: 60, chipW: 70, cardW: 200 }), "pill-dot");
    // The CSS follows the classes, and no fixed width moves or hides the pill.
    const src = source(file);
    assert.match(src, new RegExp(`${parts.block.replace(".", "\\.")}\\.pill-below > ${parts.row.replace(".", "\\.")} \\{ display: contents; \\}`));
    assert.match(src, new RegExp(`${parts.block.replace(".", "\\.")}\\.pill-dot > ${parts.row.replace(".", "\\.")} > ${parts.chip.replace(".", "\\.")} `));
    assert.doesNotMatch(src, /:host\(\[tiny\]\) \.chip|\.pill\.compact|@container [a-z-]*titles/);
  });
}
