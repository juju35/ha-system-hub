// Narrow cards (the minimum width of getGridOptions, 4 to 6 columns of a Sections view, the zoomed mini card), status
// text contrast and focus rings: the CSS rules that keep them right. The layouts were measured in Chromium (see the
// pull request "Review pass 9 fixes"); test/resize.browser.test.mjs covers re-fitting on resize in Chromium.
import assert from "node:assert/strict";
import { test } from "node:test";
import { devices, entities, states, updateAvailable } from "./mock-states.mjs";
import { load } from "./load.mjs";

const lib = load();
const hassWith = (extra = {}) => ({ states: { ...states, ...extra }, entities, devices, language: "en", config: { version: "2026.10.2" } });
const card = (Cls, hass, config = {}) => {
  const c = new Cls();
  c._hass = hass;
  c._config = config;
  return c;
};
const styleOf = (html) => [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n");
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");
/** Declarations of the top-level rules (outside @media / @container) whose selector list contains this selector. */
const rulesFor = (css, selector) => {
  const flat = strip(css).replace(/@(?:media|container)[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, "");
  return [...flat.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((m) => m[1].split(",").some((s) => s.trim() === selector))
    .map((m) => m[2])
    .join(";");
};
/** Inner CSS of the @container blocks of this container name. */
const containerBlocks = (css, name) =>
  [...strip(css).matchAll(/@container\s+([\w-]+)\s*\(max-width:\s*(\d+)px\)\s*\{((?:[^{}]*\{[^{}]*\})*)[^{}]*\}/g)]
    .filter((m) => m[1] === name)
    .map((m) => ({ max: Number(m[2]), body: m[3] }));

const renders = () => {
  const hass = hassWith(updateAvailable);
  const zoomed = (Cls) => {
    const c = card(Cls, hass);
    c._zoomed = true;
    return c._render();
  };
  return {
    full: card(lib.SystemMonitorCard, hass)._render(),
    "mini zoomed": zoomed(lib.SystemMonitorMiniCard),
  };
};

for (const [name, html] of Object.entries(renders())) {
  test(`${name}: the header title keeps a few letters, the pill gives way, the buttons keep their size`, () => {
    const css = styleOf(html);
    // The title block grows from 0 (it never takes the pill's room first) and keeps 4 letters and the ellipsis
    // ("Home…" is 6.1ch of the 16 px title: 4ch kept "Ho…"), measured in the title's font.
    const titles = rulesFor(css, ".titles");
    assert.match(titles, /flex:\s*1 1 0(?:;|\s|$)/);
    assert.ok(Number(titles.match(/min-width:\s*([\d.]+)ch/)?.[1]) >= 6.5, titles);
    assert.match(titles, /font-size:\s*16px/);
    assert.match(rulesFor(css, ".name"), /font-size:\s*16px/);
    const nameRule = rulesFor(css, ".title-row > .name");
    assert.match(nameRule, /flex:\s*1 1 0(?:;|\s|$)/);
    assert.ok(Number(nameRule.match(/min-width:\s*min\(([\d.]+)ch, 100%\)/)?.[1]) >= 6.5, nameRule);
    assert.match(rulesFor(css, ".name"), /text-overflow:\s*ellipsis/);
    // The pill is cut only when the room really lacks: no cap at half the line.
    const chip = rulesFor(css, ".title-row > .chip");
    assert.match(chip, /flex:\s*0 1 auto/);
    assert.match(chip, /min-width:\s*0/);
    assert.doesNotMatch(chip, /max-width/);
    assert.match(rulesFor(css, ".title-row > .chip > .chip-text"), /text-overflow:\s*ellipsis/);
    assert.match(rulesFor(css, ".header"), /container:\s*sm-header \/ inline-size/);
    const narrow = containerBlocks(css, "sm-header");
    assert.ok(narrow.some((b) => /\.title-row > \.chip > \.chip-text\s*\{[^}]*display:\s*none/.test(b.body)), "the pill never drops to its dot");
    // A 245 px card (221 px inside its header) still shows the pill's text: only a phone-width header drops it.
    for (const b of narrow.filter((x) => /\.chip-text\s*\{[^}]*display:\s*none/.test(x.body)))
      assert.ok(b.max < 221, `@container sm-header (max-width: ${b.max}px)`);
    assert.match(rulesFor(css, ".zoom"), /flex:\s*none/);
  });

  test(`${name}: the header pill keeps its text in title and aria-label`, () => {
    const pill = html.match(/<div class="title-row">[\s\S]*?(<span class="chip[^>]*>)<span class="dot"><\/span><span class="chip-text">/);
    assert.ok(pill, "no .chip-text in the header pill");
    assert.match(pill[1], /title="Update 2026\.10\.3"/);
    assert.match(pill[1], /aria-label="Update 2026\.10\.3"/);
  });
}

test("header pill: every status (update, unknown, up to date, running) has its text in title and aria-label", () => {
  const sm = (hass) => lib.discover(hass);
  for (const [extra, text] of [
    [updateAvailable, "Update 2026.10.3"],
    [{ "update.home_assistant_core_update": { entity_id: "update.home_assistant_core_update", state: "unavailable", attributes: {} } }, "Unknown"],
    [{}, "Up to date"],
  ]) {
    const hass = hassWith(extra);
    const head = card(lib.SystemMonitorCard, hass)._header(sm(hass));
    assert.match(head, new RegExp(`title="${text}" aria-label="${text}"><span class="dot"></span><span class="chip-text">`), text);
  }
});

test("storage: on a narrow card the used / total size goes under the bar, the mount point keeps the line", () => {
  const css = styleOf(card(lib.SystemMonitorCard, hassWith())._render());
  assert.match(rulesFor(css, ".content"), /container:\s*sm-content \/ inline-size/);
  const narrow = containerBlocks(css, "sm-content").filter((b) => /\.vol/.test(b.body));
  assert.ok(narrow.length, "no @container sm-content block for the volumes");
  const body = narrow.map((b) => b.body).join("");
  assert.match(body, /\.vol \.detail\s*\{[^}]*grid-column:\s*1 \/ -1[^}]*grid-row:\s*3/);
  assert.match(body, /\.vol \.row\s*\{[^}]*grid-column:\s*1 \/ -1/);
  // Wide enough for "/media" and the longest detail ("iskorišćeno od", "użyte z") side by side above it.
  assert.ok(narrow.every((b) => b.max >= 300));
});

// WCAG 2 contrast of text in a status colour on its tinted background, with Home Assistant's default colours.
const hex = (h) => [1, 3, 5].map((i) => Number.parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, p) => a.map((x, i) => x * p + b[i] * (1 - p));
const lum = (c) => {
  const [r, g, b] = c.map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
const THEMES = { light: { text: "#212121", card: "#ffffff", bg2: "#ececec" }, dark: { text: "#e1e1e1", card: "#1c1c1c", bg2: "#282828" } };
const COLORS = { blue: "#18bcf2", primary: "#03a9f4", ok: "#43a047", warn: "#ffa600", crit: "#db4437", muted: "#727272" };

test("status text (tiles, pills, buttons) reads at 4.5:1 or more in light and dark themes", () => {
  const mini = card(lib.SystemMonitorMiniCard, hassWith(updateAvailable))._render();
  const css = strip([...Object.values(renders()), mini].map(styleOf).join("\n"));
  // No text in a raw status colour: always mixed with the text colour. Icons keep the status colour.
  for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g))
    if (!selector.split(",").every((x) => /\.icon\s*$/.test(x.trim())))
      assert.doesNotMatch(body, /(?:^|[;\s])color:\s*var\(--(?:c|sm-ok|sm-warn|sm-crit|sm-blue|primary-color)\b/, selector.trim());
  const pcts = [...css.matchAll(/(?:^|[;{\s])color:\s*color-mix\(in srgb, var\(--[\w-]+(?:, [^)]*\))?\)? (\d+)%, var\(--primary-text-color\)\)/gm)].map((m) => Number(m[1]));
  assert.ok(pcts.length >= 5, `${pcts.length} mixed text colours`);
  for (const p of new Set(pcts))
    for (const [theme, t] of Object.entries(THEMES))
      for (const [name, c] of Object.entries(COLORS)) {
        const fg = mix(hex(c), hex(t.text), p / 100);
        // Tile (12 % of the colour over the secondary background) and pill or button (15 % over the card).
        for (const bg of [mix(hex(c), hex(t.bg2), 0.12), mix(hex(c), hex(t.card), 0.15)])
          assert.ok(ratio(fg, bg) >= 4.5, `${theme} ${name} at ${p}%: ${ratio(fg, bg).toFixed(2)}:1`);
      }
});

test("focus rings use the theme's primary colour, like the other cards", () => {
  const css = strip(styleOf(renders().full));
  assert.match(css, /--sm-focus:\s*var\(--primary-color, #03a9f4\)/);
  const outlines = [...css.matchAll(/outline:\s*2px solid ([^;}]+)/g)].map((m) => m[1].trim());
  assert.ok(outlines.length >= 2);
  for (const o of outlines) assert.equal(o, "var(--sm-focus)");
});

// Phone width: 6 columns of a Sections view on a 320 px screen make a 156 px card, 132 px inside its 12 px padding.
const PHONE = 132;

test("full card and zoomed mini card: a pill that does not fit beside 4 letters of the title goes under it, whole", () => {
  for (const [name, html] of Object.entries(renders())) assert.match(rulesFor(styleOf(html), ".title-row"), /flex-wrap:\s*wrap/, name);
});

test("full card under ~255 px: the logo and the title row's gap give 12 px to the pill, so that it keeps its text at 245 px", () => {
  const css = styleOf(card(lib.SystemMonitorCard, hassWith(updateAvailable))._render());
  // At 245 px (221 px inside the header) the pill keeps 12 px more beside the title; a longer one wraps under it.
  const blocks = containerBlocks(css, "sm-header").filter((b) => b.max >= 221 && /\.logo\s*\{/.test(b.body));
  assert.ok(blocks.length, "no @container sm-header block for a 245 px card");
  const body = blocks.map((b) => b.body).join("");
  const logo = Number(body.match(/\.logo\s*\{[^}]*width:\s*(\d+)px/)?.[1]);
  const gap = Number(body.match(/\.title-row\s*\{[^}]*gap:\s*(\d+)px/)?.[1]);
  const full = Number(rulesFor(css, ".logo").match(/width:\s*(\d+)px/g).pop().match(/\d+/)[0]);
  const fullGap = Number(rulesFor(css, ".title-row").match(/gap:\s*(\d+)px/)[1]);
  assert.ok(full - logo + fullGap - gap >= 12, `${full}->${logo} px, gap ${fullGap}->${gap} px`);
  // The pill still drops its text only on a phone-width header.
  for (const b of blocks) assert.doesNotMatch(b.body, /chip-text/);
});

test("mini card: the folded view keeps the full card's logo size", () => {
  const hass = hassWith(updateAvailable);
  const size = (Cls) => rulesFor(styleOf(card(Cls, hass)._render()), ".logo").match(/width:\s*(\d+)px/g).pop();
  assert.equal(size(lib.SystemMonitorMiniCard), size(lib.SystemMonitorCard));
});

test("every card under its minimum width (flex row of two cards): the logo gives its room to the title", () => {
  const hass = hassWith(updateAvailable);
  for (const Cls of [lib.SystemMonitorCard, lib.SystemMonitorMiniCard]) {
    const css = styleOf(card(Cls, hass)._render());
    const blocks = containerBlocks(css, "sm-header").filter((b) => /\.header \.logo\s*\{[^}]*display:\s*none/.test(b.body));
    assert.ok(blocks.length, Cls.name);
    for (const b of blocks) assert.ok(b.max < PHONE, `${Cls.name}: @container sm-header (max-width: ${b.max}px)`);
  }
});

test("full card at phone width: the section titles drop their icon and tighten so that the chevron stays inside", () => {
  const html = card(lib.SystemMonitorCard, hassWith(updateAvailable))._render();
  const css = styleOf(html);
  const phone = containerBlocks(css, "sm-content").filter((b) => b.max >= PHONE && /\.section-title/.test(b.body));
  assert.ok(phone.length, "no phone-width @container sm-content block");
  const body = phone.map((b) => b.body).join("");
  assert.match(body, /\.section-title\s*\{[^}]*gap:\s*4px/);
  assert.match(body, /\.section-title > \.icon:first-child\s*\{[^}]*display:\s*none/);
});

/** Smallest width of one grid track size at this container width, `max-content` counting as `value` px. */
const trackPx = (x, width, value) => {
  x = x.trim();
  let m = x.match(/^min\((\d+)px,\s*(\d+)%\)$/);
  if (m) return Math.min(Number(m[1]), (Number(m[2]) * width) / 100);
  if ((m = x.match(/^(\d+)px$/))) return Number(m[1]);
  if (x === "0" || x.endsWith("fr")) return 0;
  if (/^(max-content|auto|min-content)$/.test(x)) return value;
  throw new Error(`track ${x}`);
};
/** Smallest width of a grid track list: the sum of its tracks' floors. */
const trackMin = (list, width, value) =>
  [...list.matchAll(/minmax\((min\([^)]*\)|[^,]+),[^)]*\)|\S+/g)].reduce((a, m) => a + trackPx(m[1] ?? m[0], width, value), 0);

test("mini card at phone width: the metric grid fits inside the card with the whole value (130°F) and 4 letters of label", () => {
  const css = styleOf(card(lib.SystemMonitorMiniCard, hassWith(updateAvailable))._render());
  const content = rulesFor(css, ".content");
  const list = content.match(/grid-template-columns:\s*([^;]+)/)[1];
  const gap = content.match(/(?:^|;)\s*gap:\s*([^;]+)/)[1].trim();
  const column = gap.match(/^\S+\s+(min\(\d+px,\s*\d+%\)|\S+)$/)?.[1] || gap;
  const colGap = trackPx(column, PHONE, 0);
  const VALUE = 40; // "130°F", 13 px bold
  const need = trackMin(list, PHONE, VALUE) + 3 * colGap;
  assert.ok(need <= PHONE, `${need} px needed in ${PHONE} px: ${list} / gap ${gap}`);
  // The label column's floor still shows 4 letters (13 px text, about 7.5 px each).
  const label = list.match(/^\S+\s+minmax\((min\([^)]*\)|[^,]+),/)[1];
  assert.ok(trackPx(label, PHONE, 0) >= 30, label);
  // The label gives way with an ellipsis, the value never wraps.
  assert.match(rulesFor(css, ".metric > span:not(.v)"), /text-overflow:\s*ellipsis/);
  assert.match(rulesFor(css, ".metric .v"), /white-space:\s*nowrap/);
});

test("mini card footer: the two network rates wrap rather than run out of a narrow card", () => {
  // The footer rates: without the 24 h curves (with them, the rates are tiles above the footer).
  const html = card(lib.SystemMonitorMiniCard, hassWith(), { show_history: false })._render();
  assert.match(html, /<span class="rates"><span class="clickable[^"]*"[^>]*>[\s\S]*?<\/span><span class="clickable[^"]*"/);
  assert.doesNotMatch(html, /&nbsp;&nbsp;<span class="clickable"/);
  assert.match(rulesFor(styleOf(html), ".foot .rates"), /flex-wrap:\s*wrap/);
});

test("header icon: the monitor icon in the status color, always shown", () => {
  const icon = (extra, config = {}) =>
    card(lib.SystemMonitorCard, hassWith(extra), config)._render().match(/<span class="logo (\w+)" aria-hidden="true"><svg class="icon /)?.[1];
  assert.equal(icon({}), "good");
  assert.equal(icon(updateAvailable), "warn");
  // show_image is gone: an old false value no longer hides the icon.
  assert.equal(icon(updateAvailable, { show_image: false }), "warn");
  assert.doesNotMatch(card(lib.SystemMonitorCard, hassWith())._render(), /<img class="logo"/);
});
