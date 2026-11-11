import assert from "node:assert/strict";
import { test } from "node:test";
import { devices, entities, states } from "./mock-states.mjs";
import { load } from "./load.mjs";

const lib = load();
const hassWith = (overrides = {}) => ({ states: { ...states }, entities, devices, language: "en", ...overrides });

const card = (Cls, hass, config = {}) => {
  const c = new Cls();
  c._hass = hass;
  c._config = config;
  return c;
};

/** Every card, as rendered (the mini and status cards both folded and zoomed to the full card). */
const renders = () => {
  const hass = hassWith();
  const zoomed = (Cls) => {
    const c = card(Cls, hass);
    c._zoomed = true;
    return c._render();
  };
  return {
    full: card(lib.SystemMonitorCard, hass)._render(),
    mini: card(lib.SystemMonitorMiniCard, hass)._render(),
    "mini zoomed": zoomed(lib.SystemMonitorMiniCard),
  };
};

const styleOf = (html) => [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n");

/** The declarations of the rules whose selector list contains this selector, outside any @media or @container block. */
const rulesFor = (css, selector) => {
  const flat = css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/@(?:media|container)[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, "");
  return [...flat.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((m) => m[1].split(",").some((s) => s.trim() === selector))
    .map((m) => m[2])
    .join(";");
};

for (const [name, html] of Object.entries(renders())) {
  // Every render replaces the whole shadow DOM: a CSS transition never plays (no old value to start from).
  test(`${name}: no dead CSS transitions on re-rendered elements`, () => {
    const css = styleOf(html);
    for (const sel of [".bar > div", ".ring .value", ".section-title .chevron"])
      assert.doesNotMatch(rulesFor(css, sel), /transition/, `${sel} has a transition that never plays`);
  });
}

test("full card: the disk gauge uses the disk icon, not the database one", () => {
  const hass = hassWith();
  const html = card(lib.SystemMonitorCard, hass)._system(lib.discover(hass));
  const gauge = html.split('<div class="gauge').find((g) => /Disk \//.test(g));
  assert.ok(gauge, "no disk gauge");
  assert.ok(gauge.includes(lib.ICONS.disk), "disk gauge without the disk icon");
  assert.ok(!gauge.includes(lib.ICONS.database), "disk gauge with the database icon");
});

test("mini card: the disk bar uses the disk icon, not the database one", () => {
  const html = card(lib.SystemMonitorMiniCard, hassWith())._render();
  assert.ok(html.includes(lib.ICONS.disk), "no disk icon in the mini card");
  assert.ok(!html.includes(lib.ICONS.database), "database icon in the mini card (no database row there)");
});

test("full card: the gauge detail (3.02 / 7.81 GiB) is not faded below the secondary text colour", () => {
  const css = styleOf(card(lib.SystemMonitorCard, hassWith())._render());
  assert.doesNotMatch(rulesFor(css, ".gauge .lbl2"), /opacity/);
});

// Narrow cards (300 px): the status tiles' labels and values wrap instead of being cut with an ellipsis.
test("status tiles: labels and values wrap on two lines, never cut with an ellipsis", () => {
  for (const [name, html] of Object.entries(renders())) {
    const css = styleOf(html);
    if (!/class="stats"/.test(html)) continue;
    for (const sel of [".stat .k span", ".stat .v"]) {
      const rules = rulesFor(css, sel);
      assert.doesNotMatch(rules, /text-overflow:\s*ellipsis|white-space:\s*nowrap/, `${name}: ${sel} is cut on one line`);
      assert.match(rules, /-webkit-line-clamp:\s*2/, `${name}: ${sel} is not clamped to two lines`);
    }
    // A tile is at least as wide as its longest word: it wraps to a new row rather than cutting a word.
    assert.match(rulesFor(css, ".stats"), /flex-wrap:\s*wrap/, `${name}: tiles don't wrap`);
    assert.match(rulesFor(css, ".stat"), /min-width:\s*min-content/, `${name}: a tile can cut a word`);
  }
});

test("labels still cut on the narrowest cards keep their full text in title", () => {
  const html = card(lib.SystemMonitorCard, hassWith())._render();
  for (const m of html.matchAll(/<div class="(?:lbl|k)"( title="[^"]*")?>([^<]*)<\/div>/g))
    assert.equal(m[1], ` title="${m[2]}"`, `"${m[2]}" without a title`);
});

// Narrow cards (260 px, long names): the section name gives way, never the chevron.
test("section titles: the name is cut with an ellipsis (full text in title), the chevron keeps its size", () => {
  for (const [name, html] of Object.entries(renders())) {
    if (!/class="section-title/.test(html)) continue;
    const css = styleOf(html);
    assert.match(rulesFor(css, ".section-title > *"), /flex:\s*none/, `${name}: the header items can shrink`);
    const label = rulesFor(css, ".section-title > .label");
    for (const re of [/min-width:\s*0/, /text-overflow:\s*ellipsis/, /white-space:\s*nowrap/, /overflow:\s*hidden/, /flex:\s*0 1 auto/])
      assert.match(label, re, `${name}: section name without ${re}`);
    for (const head of html.matchAll(/<div class="section-title[^"]*"[^>]*>([\s\S]*?)<\/div>/g)) {
      const m = head[1].match(/<span class="label"( title="[^"]*")?>([^<]*)<\/span>/);
      assert.ok(m, `${name}: section title without a .label name: ${head[1].trim().slice(0, 80)}`);
      assert.equal(m[1], ` title="${m[2]}"`, `${name}: "${m[2]}" without a title`);
    }
  }
});

test("mini card: the metric labels share one column wide enough for the longest one", () => {
  const css = styleOf(card(lib.SystemMonitorMiniCard, hassWith())._render());
  assert.match(rulesFor(css, ".content"), /grid-template-columns:\s*18px minmax\(min\(64px, 30%\), max-content\)/);
  assert.match(rulesFor(css, ".metric"), /grid-template-columns:\s*subgrid/);
});
