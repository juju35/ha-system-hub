import assert from "node:assert/strict";
import { test } from "node:test";
import { color, ratio, textContrast } from "./contrast.mjs";
import { load } from "./load.mjs";

const { BASE_STYLE, FULL_STYLE, MINI_STYLE, DIALOG_STYLE } = load("automation-monitor-card.js", [
  "BASE_STYLE",
  "FULL_STYLE",
  "MINI_STYLE",
  "DIALOG_STYLE",
]);
const FULL = BASE_STYLE + FULL_STYLE + DIALOG_STYLE;
const MINI = BASE_STYLE + MINI_STYLE + DIALOG_STYLE;
const THEMES = ["light", "dark"];
// WCAG AA for normal text (the card's texts are at most 20px, weight 500: none counts as large text).
const AA = 4.5;

const check = (css, selectors, surface) => {
  for (const theme of THEMES) {
    const r = textContrast(css, selectors, theme, surface);
    assert.ok(r >= AA, `${selectors.at(-1)} (${theme}): ${r.toFixed(2)}:1 < ${AA}:1`);
  }
};

test("the contrast evaluator matches known WCAG values", () => {
  assert.equal(ratio(color("#000000", {}), color("#ffffff", {})).toFixed(1), "21.0");
  // HA's warning orange on white, as measured in the review.
  assert.equal(ratio(color("#ffa600", {}), color("#ffffff", {})).toFixed(2), "1.96");
});

test("the confirmation popup OK button text is readable in light and dark themes", () => {
  check(FULL, [":host", ".btn", ".modal .btn.primary"]);
  check(FULL, [":host", ".btn", ".modal .btn.primary", ".modal .btn.primary:hover"]);
});

test("the error message (sensors not found / unavailable / old HA) is readable in light and dark themes", () => {
  check(FULL, [":host", ".warning"]);
});

test("state-coloured texts (status chip, counters, streak tag, link hover) are readable in both themes", () => {
  for (const cls of [".ok", ".warn", ".crit", ".na"]) check(FULL, [":host", cls, ".chip"]);
  for (const cls of [".warn", ".crit"]) {
    check(FULL, [":host", cls, ".counter", `.counter${cls}`, `.counter${cls} .n`]);
    check(MINI, [":host", cls, ".counter", `.counter${cls}`, `.counter${cls} .n`]);
  }
  check(FULL, [":host", ".tag", ".tag.streak"]);
  check(FULL, [":host", ".tag", ".tag.link:hover"]);
});

test("a theme that sets only the card background still gets readable texts (CSS fallbacks)", () => {
  const minimal = { "--card-background-color": "#ffffff" };
  for (const selectors of [
    [":host", ".btn", ".modal .btn.primary"],
    [":host", ".warn", ".chip"],
    [":host", ".warn", ".counter", ".counter.warn", ".counter.warn .n"],
    [":host", ".tag", ".tag.streak"],
  ]) {
    const r = textContrast(FULL, selectors, minimal);
    assert.ok(r >= AA, `${selectors.at(-1)}: ${r.toFixed(2)}:1`);
  }
});

test("the state colour stays on dots, borders, badges and icons", () => {
  assert.match(BASE_STYLE, /\.dot \{[^}]*background: var\(--c/);
  assert.match(BASE_STYLE, /\.counter \.badge \{[^}]*color: var\(--c\)/);
  assert.match(FULL_STYLE, /\.item \{[^}]*border-left: 3px solid var\(--c\)/);
  assert.match(FULL_STYLE, /\.item > \.icon \{[^}]*color: var\(--c\)/);
});

test("prefers-reduced-motion stops the refresh spin and the chevron transition", () => {
  const media = BASE_STYLE.match(/@media \(prefers-reduced-motion: reduce\) \{((?:[^{}]*\{[^{}]*\})*)[^{}]*\}/);
  assert.ok(media, "no prefers-reduced-motion rule");
  assert.match(media[1], /\.refresh\.spin \.icon \{[^}]*animation: none/);
  assert.match(media[1], /\.section-title \.chevron \{[^}]*transition: none/);
});

test("the mini card keeps the full card's header icon size (40 px logo)", () => {
  assert.doesNotMatch(MINI_STYLE, /(^|[\s}])\.logo[\s{]/);
  assert.match(BASE_STYLE, /\.logo \{ height: 40px; width: 40px;/);
});

test("no dead state colours or classes in the styles", () => {
  for (const name of ["--am-navy", "--am-idle", ".idle"]) assert.ok(!BASE_STYLE.includes(name), name);
});

// Narrow header rule shared by the cards: a truncating title block that keeps a few characters and does not take the
// chip's room (flex-basis 0), a chip that only shrinks when the room is really missing (dot only when tiny), icon
// buttons that never shrink.
test("narrow header: the title keeps a few characters, the chip shrinks, the icon buttons do not", () => {
  const rule = (sel) => BASE_STYLE.match(new RegExp(`(?:^|\\n)\\s*${sel.replace(/[.*]/g, "\\$&")} \\{([^}]*)\\}`))?.[1] ?? "";
  assert.match(rule(".titles"), /flex: 1 1 0;/);
  assert.match(rule(".titles"), /min-width: \d+ch/);
  assert.match(rule(".name"), /text-overflow: ellipsis/);
  assert.match(rule(".chip"), /flex: 0 1 auto/);
  assert.match(rule(".chip"), /min-width: 0/);
  assert.doesNotMatch(rule(".chip"), /max-width/);
  assert.match(rule(".chip .txt"), /text-overflow: ellipsis/);
  assert.match(BASE_STYLE, /:host\(\[tiny\]\) \.chip \.txt \{ display: none; \}/);
  assert.match(BASE_STYLE, /:host\(\[compact\]\) \.logo \{[^}]*width: 28px/);
  assert.match(BASE_STYLE, /:host\(\[nologo\]\) \.logo \{ display: none; \}/);
  for (const s of [BASE_STYLE, FULL_STYLE]) assert.doesNotMatch(s.replace(/\/\*[\s\S]*?\*\//g, ""), /container-type:|container: [^;]*\/|@container/);
  assert.match(rule(".refresh"), /flex: none/);
  assert.match(BASE_STYLE, /\.zoom \{[^}]*flex: none/);
  assert.match(FULL_STYLE, /\.section-title \.btn \{[^}]*flex: none/);
});
