import assert from "node:assert/strict";
import { test } from "node:test";
import { load } from "./load.mjs";

const {
  AutomationMonitorCard,
  AutomationMonitorMiniCard,
  AutomationMonitorCardEditor,
  resolve,
  sameSig,
  esc,
  editorPath,
  excludedDevices,
  excludedEntities,
  _entityMatcherCache,
  fullDate,
  rtfFor,
  DIALOG_STYLE,
  STRINGS,
  lang,
  intlLang,
  window: win,
} = load("automation-monitor-card.js", [
  "AutomationMonitorCard",
  "AutomationMonitorCardEditor",
  "rtfFor",
  "intlLang",
  "DIALOG_STYLE",
  "window",
  "AutomationMonitorMiniCard",
  "resolve",
  "sameSig",
  "esc",
  "editorPath",
  "excludedDevices",
  "excludedEntities",
  "_entityMatcherCache",
  "fullDate",
  "STRINGS",
  "lang",
]);

const entities = {
  "sensor.failed": { entity_id: "sensor.failed", platform: "automation_monitor", translation_key: "failed_automations" },
  "sensor.linked": { entity_id: "sensor.linked", platform: "automation_monitor", translation_key: "linked_entities_unavailable" },
};
const failure = { entity_id: "automation.a", name: "A", last_error_time: "2026-10-24T10:00:00Z" };
const baseStates = () => ({
  "sensor.failed": { entity_id: "sensor.failed", state: "1", attributes: { automations: [failure] } },
  "sensor.linked": { entity_id: "sensor.linked", state: "0", attributes: { entities: [] } },
  "automation.a": { entity_id: "automation.a", state: "on", attributes: { id: "1" } },
  "light.kitchen": { entity_id: "light.kitchen", state: "off", attributes: {} },
});

const devices = {};
const admin = { is_admin: true };
const card = (states) => {
  const el = new AutomationMonitorCard();
  el._config = {};
  el._hass = { states, entities, devices, language: "en", user: admin };
  return el;
};

test("resolve finds the sensors through the registry and caches on hass.entities", () => {
  const states = baseStates();
  const found = resolve({ entities, states });
  assert.equal(found.failed, "sensor.failed");
  assert.equal(found.linked, "sensor.linked");
  // Mutating the returned object must not leak into the cache.
  found.failed = "x";
  assert.equal(resolve({ entities, states }).failed, "sensor.failed");
});

test("an unrelated state change keeps the render signature", () => {
  const states = baseStates();
  const before = card(states)._signature();
  const after = card({ ...states, "light.kitchen": { ...states["light.kitchen"], state: "on" } })._signature();
  assert.ok(sameSig(before, after));
});

test("a change of a monitored sensor changes the render signature", () => {
  const states = baseStates();
  const before = card(states)._signature();
  const next = { ...states, "sensor.failed": { ...states["sensor.failed"], state: "2" } };
  assert.ok(!sameSig(before, card(next)._signature()));
});

test("esc escapes HTML text and attribute characters", () => {
  assert.equal(esc(`<img src=x onerror="a('b')">&`), "&lt;img src=x onerror=&quot;a(&#39;b&#39;)&quot;&gt;&amp;");
});

test("the script editor link uses the script key (unique_id) when given", () => {
  const hass = { states: {} };
  assert.equal(editorPath(hass, "script.renamed", "ambiance_soiree"), "/config/script/edit/ambiance_soiree");
  assert.equal(editorPath(hass, "script.ambiance", undefined), "/config/script/edit/ambiance");
  assert.equal(editorPath(hass, "script.a", "x y"), "/config/script/edit/x%20y");
});

test("excluded devices are matched by id or name and cached on hass.devices", () => {
  const devs = { d1: { id: "d1", name: "Hall sensor" }, d2: { id: "d2", name: "Plug", name_by_user: "Kitchen plug" } };
  const hass = { devices: devs };
  const ids = excludedDevices(hass, { exclude_devices: ["kitchen plug", "d9"] });
  assert.deepEqual([...ids].sort(), ["d2", "d9", "kitchen plug"].sort());
  assert.equal(excludedDevices(hass, { exclude_devices: ["kitchen plug", "d9"] }), ids);
  // Another exclude_devices value, or a new device registry, is recomputed.
  assert.ok(excludedDevices(hass, { exclude_devices: ["Hall sensor"] }).has("d1"));
  assert.ok(!excludedDevices({ devices: { ...devs } }, { exclude_devices: ["kitchen plug"] }).has("d9"));
  assert.equal(excludedDevices(hass, {}), null);
});

test("setConfig folds the lists shortened by Show more back", () => {
  const el = new AutomationMonitorCard();
  el._expanded = { failed: true };
  el.setConfig({ max_items: 3 });
  assert.deepEqual({ ...el._expanded }, {});
});

test("a failed Refresh call stops the spin and the timer is cleared on disconnect", async () => {
  const el = card(baseStates());
  el._update = () => {};
  el._hass.callService = () => Promise.reject(new Error("unloaded"));
  el._onClick({ composedPath: () => [{ dataset: { action: "rebuild" } }], stopPropagation() {} });
  assert.equal(el._refreshing, true);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(el._refreshing, false);
  assert.equal(el._refreshTimer, null);

  el._hass.callService = () => new Promise(() => {});
  el._onClick({ composedPath: () => [{ dataset: { action: "rebuild" } }], stopPropagation() {} });
  assert.ok(el._refreshTimer);
  el.disconnectedCallback();
  assert.equal(el._refreshTimer, null);
  assert.equal(el._refreshing, false);
});

test("the automations are only counted while the subtitle shows their number", () => {
  const states = baseStates();
  let walks = 0;
  const counting = (st) =>
    new Proxy(st, {
      ownKeys: (t) => {
        walks++;
        return Reflect.ownKeys(t);
      },
    });
  // A recent failure is in the subtitle: no count.
  const el = card(counting(states));
  el._signature();
  assert.equal(walks, 0);
  // No failure: the subtitle shows "N automations", which follows the number of automations.
  const clear = { ...states, "sensor.failed": { ...states["sensor.failed"], state: "0", attributes: { automations: [] } } };
  const before = card(clear)._signature();
  const more = { ...clear, "automation.b": { entity_id: "automation.b", state: "on", attributes: {} } };
  assert.ok(!sameSig(before, card(more)._signature()));
  assert.match(card(more)._render(), /2 automations/);
});

// Mini card detail button: a mini card whose renders are captured instead of patched into a DOM.
const zoomCard = (config = {}) => {
  const el = new AutomationMonitorMiniCard();
  el._config = config;
  el._hass = { states: baseStates(), entities, devices, language: config.language || "en", user: admin };
  el._update = () => {
    el.html = el._render();
  };
  el.shadowRoot.querySelector = () => null;
  el._update();
  return el;
};
const node = (localName) => ({ localName });
const click = (path, extra = {}) => ({ composedPath: () => path, stopPropagation() {}, detail: 1, ...extra });
const zoomButton = () => click([], { target: { closest: (sel) => (sel === ".zoom" ? {} : null) } });

test("the mini card detail button switches to the full card content and back", () => {
  const el = zoomCard();
  const full = card(el._hass.states);
  full._hass = el._hass;
  assert.match(el.html, /class="line crit/);
  assert.match(el.html, />Failed</);
  // Rightmost header element, after the status pill and the Refresh button.
  assert.match(el.html, /class="chip[\s\S]*?class="refresh[\s\S]*?<button class="zoom" title="Show the full card" aria-label="Show the full card" aria-expanded="false">[\s\S]*?<\/button>\s*<\/div>/);
  assert.equal(el.getCardSize(), 3);
  let stopped = false;
  el._zoomClick({ ...zoomButton(), stopPropagation: () => (stopped = true) });
  assert.equal(stopped, true);
  assert.equal(el._zoomed, true);
  assert.doesNotMatch(el.html, /class="line/);
  assert.equal(el.html.replace(/<button class="zoom"[\s\S]*?<\/button>/, ""), full._render());
  assert.match(el.html, /<button class="zoom" title="Back to the compact view" aria-label="Back to the compact view" aria-expanded="true">/);
  assert.equal(el.getCardSize(), full.getCardSize());
  assert.deepEqual({ ...el.getGridOptions() }, { ...full.getGridOptions() });
  el._zoomClick(zoomButton());
  assert.equal(el._zoomed, false);
  assert.match(el.html, /class="line crit/);
  assert.equal(el.getCardSize(), 3);
});

test("a click outside the mini card collapses it, a click inside or in a dialog does not", () => {
  const el = zoomCard({ language: "fr" });
  assert.match(el.html, /title="Afficher la carte complète"/);
  el._zoomClick(zoomButton());
  assert.match(el.html, /title="Revenir à la vue compacte"/);
  el._unzoom.tap(click([node("div"), el, node("body")]));
  assert.equal(el._zoomed, true);
  for (const dialog of ["ha-more-info-dialog", "ha-dialog", "dialog"]) {
    el._unzoom.tap(click([node("div"), node(dialog), node("body")]));
    assert.equal(el._zoomed, true, dialog);
  }
  // Other clicks on the card leave it as it is.
  el._zoomClick(click([el], { target: { closest: () => null } }));
  assert.equal(el._zoomed, true);
  el._unzoom.tap(click([node("div"), node("body")]));
  assert.equal(el._zoomed, false);
  assert.match(el.html, /class="line crit/);
});

test("a click outside the card folds its sections, a click inside or in a dialog does not", () => {
  const el = card(baseStates());
  el._update = () => {};
  el.connectedCallback();
  const open = () => {
    el._folds = { failed: true };
    el._expanded = { failed: true };
  };
  open();
  el._outside.tap(click([node("div"), el, node("body")]));
  assert.deepEqual({ ...el._folds }, { failed: true });
  for (const dialog of ["ha-more-info-dialog", "ha-dialog", "dialog"]) {
    el._outside.tap(click([node("div"), node(dialog), node("body")]));
    assert.deepEqual({ ...el._expanded }, { failed: true }, dialog);
  }
  el._outside.tap(click([node("div"), node("body")]));
  assert.deepEqual({ ...el._folds }, {});
  assert.deepEqual({ ...el._expanded }, {});
  el.disconnectedCallback();
});

test("Clear asks through the in-card popup: OK calls the service, Cancel, Escape or outside do not", async () => {
  const el = card(baseStates());
  el._update = () => {};
  el.connectedCallback();
  const calls = [];
  el._hass.callService = (domain, service, data) => calls.push(`${domain}.${service} ${JSON.stringify(data)}`);
  const openReset = () => {
    el._confirmClosedAt = 0; // the double-click guard is not what this test exercises
    el._onClick(click([{ dataset: { action: "reset", entity: "automation.a", label: "A" } }]));
  };
  // Cancel button.
  openReset();
  assert.match(el._confirm.text, /A/);
  el._onClick(click([{ dataset: { action: "confirm_cancel" } }]));
  assert.equal(el._confirm, null);
  // Escape.
  openReset();
  el._onKey({ key: "Escape", stopPropagation() {} });
  assert.equal(el._confirm, null);
  // A click outside the card.
  openReset();
  el._outside.tap(click([node("div"), node("body")]));
  assert.equal(el._confirm, null);
  // A click elsewhere on the card neither acts nor closes.
  openReset();
  el._onClick(click([{ dataset: { action: "rebuild" } }]));
  assert.ok(el._confirm);
  assert.deepEqual(calls, []);
  // OK calls the service, for one automation and for all.
  el._onClick(click([{ dataset: { action: "confirm_ok" } }]));
  assert.equal(el._confirm, null);
  el._confirmClosedAt = 0;
  el._onClick(click([{ dataset: { action: "reset_all" } }]));
  el._onClick(click([{ dataset: { action: "confirm_ok" } }]));
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(calls, ['automation_monitor.reset {"entity_id":"automation.a"}', "automation_monitor.reset {}"]);
  // Right after a close, the rest of a double click on OK is swallowed.
  el._onClick(click([{ dataset: { action: "reset", entity: "automation.a", label: "A" } }]));
  assert.equal(el._confirm, null);
  el.disconnectedCallback();
});

test("zoom: false removes the mini card detail button, the full card has none", () => {
  const el = zoomCard({ zoom: false });
  assert.doesNotMatch(el.html, /class="zoom"/);
  assert.doesNotMatch(card(baseStates())._render(), /class="zoom"/);
});

const LANGS = ["fr", "de", "es", "sr", "sr-Latn", "it", "nl", "pt", "pl", "ro", "da", "sv", "bg", "ru", "uk", "hu", "sk", "cs", "sl", "lv", "el"];

test("I18N parity: every language has exactly the English keys and placeholders, and no empty text", () => {
  // Plural forms only some languages need ("<key>_few"…) come on top of a key every language has.
  const plural = (k) => /_(zero|one|two|few|many)$/.test(k) && !(k in STRINGS.en) && k.replace(/_[a-z]+$/, "") in STRINGS.en;
  const keys = Object.keys(STRINGS.en).sort();
  const vars = (s) => (s.match(/\{\w+\}/g) || []).sort().join();
  assert.equal(Object.keys(STRINGS).sort().join(), ["en", ...LANGS].sort().join());
  for (const l of LANGS) {
    assert.ok(STRINGS[l], l);
    assert.deepEqual(Object.keys(STRINGS[l]).filter((k) => !plural(k)).sort(), keys, l);
    for (const k of Object.keys(STRINGS[l]).filter(plural)) assert.equal(vars(STRINGS[l][k]), vars(STRINGS.en[k.replace(/_[a-z]+$/, "")]), `${l}.${k}`);
    for (const k of keys) {
      assert.equal(typeof STRINGS[l][k], "string", `${l}.${k}`);
      assert.ok(STRINGS[l][k].trim(), `${l}.${k} is empty`);
      assert.equal(vars(STRINGS[l][k]), vars(STRINGS.en[k]), `${l}.${k}`);
    }
  }
});

test("Serbian: no Latin letters in sr and no Cyrillic in sr-Latn, except brand names", () => {
  // Brand names and the {x} placeholders stay in Latin letters.
  const kept = /Automation Monitor|Home Assistant|\{\w+\}/g;
  for (const [k, v] of Object.entries(STRINGS.sr)) assert.doesNotMatch(v.replace(kept, ""), /[A-Za-z]/, `sr.${k}`);
  for (const [k, v] of Object.entries(STRINGS["sr-Latn"])) assert.doesNotMatch(v, /[\u0400-\u04FF]/, `sr-Latn.${k}`);
});

test("the language resolves to the full code, then the part before the dash, then English", () => {
  const of = (language) => lang({ language }, {});
  assert.equal(of("fr-FR"), "fr");
  assert.equal(of("sr-Latn"), "sr-Latn");
  assert.equal(of("sr"), "sr");
  assert.equal(of("it-IT"), "it");
  assert.equal(of("nl-BE"), "nl");
  assert.equal(of("pt"), "pt");
  // Brazilian Portuguese falls back to European Portuguese, on purpose.
  assert.equal(of("pt-BR"), "pt");
  assert.equal(of("pl-PL"), "pl");
  assert.equal(of("ro-RO"), "ro");
  assert.equal(of("da-DK"), "da");
  assert.equal(of("sv-FI"), "sv");
  assert.equal(of("uk-UA"), "uk");
  assert.equal(of("cs-CZ"), "cs");
  assert.equal(of("el-GR"), "el");
  assert.equal(of("ja"), "en");
  // The card option comes first, then hass.locale, then hass.language.
  assert.equal(lang({ language: "fr", locale: { language: "sr-Latn" } }, {}), "sr-Latn");
  assert.equal(lang({ language: "sr-Latn" }, { language: "sr" }), "sr");
  // The relative times and dates follow the script: Latin in sr-Latn, Cyrillic in sr.
  assert.match(rtfFor("sr-Latn").format(-3, "minute"), /^[^\u0400-\u04FF]*$/);
  assert.match(rtfFor("sr").format(-3, "minute"), /[\u0400-\u04FF]/);
});

test("Intl gets pt-PT for HA's pt, keeps pt-BR and follows the card option", () => {
  assert.equal(intlLang({ language: "pt" }, {}), "pt-PT");
  assert.equal(intlLang({ language: "en", locale: { language: "pt" } }, {}), "pt-PT");
  assert.equal(intlLang({ language: "pt-BR" }, {}), "pt-BR");
  assert.equal(intlLang({ language: "fr-CA" }, {}), "fr-CA");
  // The card option comes first; the HA locale is only used when it is in the same language.
  assert.equal(intlLang({ language: "pt" }, { language: "fr" }), "fr");
  assert.equal(intlLang({ language: "en" }, { language: "pt" }), "pt-PT");
  assert.equal(intlLang({ language: "pt-BR" }, { language: "pt" }), "pt-BR");
  assert.equal(intlLang({ language: "sr" }, { language: "sr-Latn" }), "sr-Latn");
  assert.equal(intlLang({ language: "ja" }, {}), "en");
  // European formats, not Brazilian ones.
  const d = new Date(2026, 10, 1, 12, 0);
  assert.doesNotMatch(d.toLocaleString(intlLang({ language: "pt" }, {}), { dateStyle: "medium" }), / de nov\. de /);
});

test("the editor offers Serbian in Cyrillic and Latin", () => {
  const ed = new AutomationMonitorCardEditor();
  ed._hass = { states: {}, language: "en" };
  ed._config = {};
  const opts = ed._schema().find((f) => f.name === "language").selector.select.options;
  const sr = opts.filter((o) => o.value.startsWith("sr")).map((o) => `${o.value}=${o.label}`);
  assert.equal(sr.join(), "sr=Српски,sr-Latn=Srpski (latinica)");
});

test("the editor offers every language of the card, with its own name", () => {
  const ed = new AutomationMonitorCardEditor();
  ed._hass = { states: {}, language: "en" };
  ed._config = {};
  const opts = ed._schema().find((f) => f.name === "language").selector.select.options;
  // Joined: the arrays come from the card's own realm.
  assert.equal(
    opts
      .filter((o) => o.value)
      .map((o) => o.value)
      .sort()
      .join(),
    Object.keys(STRINGS).sort().join(),
  );
  const label = (v) => opts.find((o) => o.value === v).label;
  assert.equal(label("it"), "Italiano");
  assert.equal(label("nl"), "Nederlands");
  assert.equal(label("pt"), "Português (Portugal)");
  assert.equal(label("pl"), "Polski");
  const NAMES = {
    ro: "Română",
    da: "Dansk",
    sv: "Svenska",
    bg: "Български",
    ru: "Русский",
    uk: "Українська",
    hu: "Magyar",
    sk: "Slovenčina",
    cs: "Čeština",
    sl: "Slovenščina",
    lv: "Latviešu",
    el: "Ελληνικά",
  };
  for (const [v, name] of Object.entries(NAMES)) assert.equal(label(v), name, v);
});

test("the confirmation popup OK button is not a filled button", () => {
  const rule = DIALOG_STYLE.match(/\.modal \.btn\.primary \{([^}]*)\}/)[1];
  assert.match(rule, /color: var\(--am-blue-text\)/);
  assert.doesNotMatch(rule, /#fff|background: var\(--am-blue\)/);
});

test("the signature does not format relative times and the render reuses its data", () => {
  // One RelativeTimeFormat per language.
  assert.equal(rtfFor("fr"), rtfFor("fr"));
  const el = card(baseStates());
  let formats = 0;
  const realAgo = el._lastFailure;
  el._lastFailure = (d) => (formats++, realAgo.call(el, d));
  el._signature();
  assert.equal(formats, 0);
  // Same hass and configuration: the filtered and sorted lists are computed once.
  assert.equal(el._data(), el._data());
  el._hass = { ...el._hass };
  assert.notEqual(el._dataMemo.hass, el._hass);
  // A failure without a valid date: the subtitle falls back to the automation count, which the signature follows.
  const bad = baseStates();
  bad["sensor.failed"] = { ...bad["sensor.failed"], attributes: { automations: [{ ...failure, last_error_time: "?" }] } };
  const before = card(bad)._signature();
  const more = { ...bad, "automation.b": { entity_id: "automation.b", state: "on", attributes: {} } };
  assert.ok(!sameSig(before, card(more)._signature()));
});

test("Escape is listened in the capture phase while the popup is open, and the focus returns to Clear", () => {
  const added = [];
  const removed = [];
  const add = win.addEventListener;
  const remove = win.removeEventListener;
  win.addEventListener = (...a) => added.push(a);
  win.removeEventListener = (...a) => removed.push(a);
  try {
    const el = card(baseStates());
    el._update = () => {};
    let focused = 0;
    const opener = { dataset: { action: "reset", entity: "automation.a", label: "A" }, isConnected: true, focus: () => focused++ };
    el._onClick(click([opener]));
    assert.equal(added.length, 1);
    assert.equal(added[0][0], "keydown");
    assert.equal(added[0][2], true);
    let stopped = false;
    el._onKey({ key: "Escape", stopPropagation: () => (stopped = true) });
    assert.ok(stopped);
    assert.equal(el._confirm, null);
    assert.deepEqual(removed[0], added[0]);
    assert.equal(focused, 1);
    // Closed by a click elsewhere on the page: the focus stays there.
    el._confirmClosedAt = 0;
    el.connectedCallback();
    el._onClick(click([opener]));
    el._outside.tap(click([node("div"), node("body")]));
    assert.equal(focused, 1);
    el.disconnectedCallback();
  } finally {
    win.addEventListener = add;
    win.removeEventListener = remove;
  }
});

test("a click outside a zoomed mini card with the popup open only closes the popup", () => {
  const el = zoomCard();
  el.connectedCallback();
  el._zoomClick(zoomButton());
  assert.equal(el._zoomed, true);
  el._onClick(click([{ dataset: { action: "reset_all" } }]));
  assert.ok(el._confirm);
  const outside = click([node("div"), node("body")]);
  el._outside.tap(outside);
  el._unzoom.tap(outside);
  assert.equal(el._confirm, null);
  assert.equal(el._zoomed, true);
  // The next click outside brings the compact view back.
  el._unzoom.tap(click([node("div"), node("body")]));
  assert.equal(el._zoomed, false);
  el.disconnectedCallback();
});

test("the editor gives ha-form a new schema only when the language changes", () => {
  const ed = new AutomationMonitorCardEditor();
  ed.setConfig({ type: "custom:automation-monitor-card" });
  const hass = { states: {}, language: "en" };
  ed.hass = hass;
  const { schema, data } = ed._form;
  ed.hass = { ...hass, states: { "light.a": {} } };
  assert.equal(ed._form.schema, schema);
  assert.equal(ed._form.data, data);
  ed.hass = { ...hass, language: "de" };
  assert.notEqual(ed._form.schema, schema);
  ed.setConfig({ type: "custom:automation-monitor-card", max_items: 3 });
  assert.notEqual(ed._form.data, data);
  assert.equal(ed._form.data.max_items, 3);
});

test("a popup open when the card leaves the page is closed: back on the page, no popup and no Escape listener", () => {
  const listeners = new Set();
  const add = win.addEventListener;
  const remove = win.removeEventListener;
  win.addEventListener = (type, fn, capture) => listeners.add(`${type}|${capture}|${fn === el._onKey}`);
  win.removeEventListener = (type, fn, capture) => listeners.delete(`${type}|${capture}|${fn === el._onKey}`);
  const el = card(baseStates());
  try {
    el._update = () => {};
    el.connectedCallback();
    el._onClick(click([{ dataset: { action: "reset", entity: "automation.a", label: "A" } }]));
    assert.ok(listeners.has("keydown|true|true"));
    el._folds = { failed: true };
    // Lovelace view change: the card is detached, cached, then attached again in its default state.
    el.disconnectedCallback();
    assert.equal(el._confirm, null);
    assert.deepEqual({ ...el._folds }, {});
    assert.ok(!listeners.has("keydown|true|true"));
    el.connectedCallback();
    assert.ok(!listeners.has("keydown|true|true"));
  } finally {
    el.disconnectedCallback();
    win.addEventListener = add;
    win.removeEventListener = remove;
  }
});

test("the editor turns the former collapse_<list>: false option into expand_<list>: true", () => {
  const ed = new AutomationMonitorCardEditor();
  const events = [];
  ed.dispatchEvent = (ev) => events.push(ev);
  ed.setConfig({ type: "custom:automation-monitor-card", collapse_failed: false, collapse_linked: true, max_items: 3 });
  assert.deepEqual({ ...ed._config }, { type: "custom:automation-monitor-card", expand_failed: true, max_items: 3 });
  assert.equal(events.length, 1);
  assert.deepEqual({ ...events[0].detail.config }, { ...ed._config });
  // The migrated configuration given back by Home Assistant (or a configuration without the former
  // options) is kept as is, without a new config-changed event.
  ed.setConfig({ ...events[0].detail.config });
  ed.setConfig({ type: "custom:automation-monitor-card", expand_linked: true });
  assert.equal(events.length, 1);
  assert.deepEqual({ ...ed._config }, { type: "custom:automation-monitor-card", expand_linked: true });
});

test("the mini card editor, without list toggles, leaves the collapse_<list> options alone", () => {
  const { AutomationMonitorMiniCardEditor } = load("automation-monitor-card.js", ["AutomationMonitorMiniCardEditor"]);
  const ed = new AutomationMonitorMiniCardEditor();
  const events = [];
  ed.dispatchEvent = (ev) => events.push(ev);
  ed.setConfig({ type: "custom:automation-monitor-mini-card", collapse_failed: false });
  assert.equal(events.length, 0);
  assert.equal(ed._config.collapse_failed, false);
});

// --- Review pass 9 ---

const naStates = (failedState) => {
  const states = baseStates();
  states["sensor.failed"] = { entity_id: "sensor.failed", state: failedState, attributes: {} };
  return states;
};

test("an unavailable or unknown failed-automations sensor is not shown as 0 failures nor All good", () => {
  for (const state of ["unavailable", "unknown"]) {
    const html = card(naStates(state))._render();
    assert.doesNotMatch(html, /All good/, state);
    assert.match(html, /Sensor unavailable/, state);
    // The counter shows a dash and the neutral class, not a green 0 with a check mark.
    assert.match(html, /class="counter clickable na"[\s\S]*?<div class="n">—<\/div>/, state);
    assert.doesNotMatch(html, /class="counter clickable ok" role="button" tabindex="0" data-entity="sensor\.failed"/, state);
  }
});

test("a missing (disabled) failed-automations sensor is not shown as 0 failures nor All good", () => {
  const states = baseStates();
  delete states["sensor.failed"];
  const el = card(states);
  el._hass.entities = { "sensor.linked": entities["sensor.linked"] };
  const html = el._render();
  assert.doesNotMatch(html, /All good/);
  assert.match(html, /<div class="n">—<\/div>/);
});

test("with one sensor unavailable, the problems of the other are still counted", () => {
  const states = naStates("unavailable");
  states["sensor.linked"] = {
    entity_id: "sensor.linked",
    state: "2",
    attributes: { entities: [{ entity_id: "light.kitchen", name: "Kitchen" }, { entity_id: "light.hall", name: "Hall" }] },
  };
  const html = card(states)._render();
  assert.match(html, /class="chip clickable warn"[^>]*>[\s\S]*?2 problems/);
  assert.match(html, /class="n">—</);
  assert.match(html, /class="n">2</);
});

test("plural forms: 1 is singular in every language, Slavic and Baltic languages use their other forms", () => {
  const el = card(baseStates());
  const say = (language, key, n) => {
    el._config = { language };
    return el._t(key, { n });
  };
  const ONE = {
    en: "1 automation",
    fr: "1 automatisation",
    de: "1 Automatisierung",
    es: "1 automatización",
    it: "1 automazione",
    nl: "1 automatisering",
    pt: "1 automatização",
    pl: "1 automatyzacja",
    sr: "1 аутоматизација",
    "sr-Latn": "1 automatizacija",
    ro: "1 automatizare",
    da: "1 automatisering",
    sv: "1 automatisering",
    bg: "1 автоматизация",
    ru: "1 автоматизация",
    uk: "1 автоматизація",
    hu: "1 automatizálás",
    sk: "1 automatizácia",
    cs: "1 automatizace",
    sl: "1 avtomatizacija",
    lv: "1 automatizācija",
    el: "1 αυτοματισμός",
  };
  for (const [l, text] of Object.entries(ONE)) assert.equal(say(l, "automations", 1), text, l);
  // "1 problem": never the plural text with 1 in it.
  // Swedish and Hungarian use the same word: "1 problem" / "5 problem", "1 probléma".
  const SAME = ["sv", "hu"];
  for (const l of Object.keys(ONE).filter((l) => !SAME.includes(l))) assert.notEqual(say(l, "n_problems", 1), STRINGS[l].n_problems.replace("{n}", "1"), l);
  for (const l of SAME) assert.equal(say(l, "n_problems", 1), STRINGS[l].n_problems_one.replace("{n}", "1"), l);
  const cases = {
    sr: { automations: ["1 аутоматизација", "2 аутоматизације", "5 аутоматизација", "21 аутоматизација", "22 аутоматизације"], n_problems: ["1 проблем", "2 проблема", "5 проблема", "21 проблем", "22 проблема"] },
    "sr-Latn": {
      automations: ["1 automatizacija", "2 automatizacije", "5 automatizacija", "21 automatizacija", "22 automatizacije"],
      n_problems: ["1 problem", "2 problema", "5 problema", "21 problem", "22 problema"],
    },
    pl: {
      automations: ["1 automatyzacja", "2 automatyzacje", "5 automatyzacji", "21 automatyzacji", "22 automatyzacje"],
      n_problems: ["1 problem", "2 problemy", "5 problemów", "21 problemów", "22 problemy"],
    },
    ro: { n_problems: ["1 problemă", "2 probleme", "5 probleme", "21 de probleme", "22 de probleme"] },
    ru: { n_problems: ["1 проблема", "2 проблемы", "5 проблем", "21 проблема", "22 проблемы"] },
    uk: { automations: ["1 автоматизація", "2 автоматизації", "5 автоматизацій", "21 автоматизація", "22 автоматизації"] },
    cs: { n_problems: ["1 problém", "2 problémy", "5 problémů", "21 problémů", "22 problémů"] },
    sk: { automations: ["1 automatizácia", "2 automatizácie", "5 automatizácií", "21 automatizácií", "22 automatizácií"] },
    sl: { n_problems: ["1 težava", "2 težavi", "5 težav", "21 težav", "22 težav"], automations: ["1 avtomatizacija", "2 avtomatizaciji", "5 avtomatizacij", "21 avtomatizacij", "22 avtomatizacij"] },
    lv: { n_problems: ["1 problēma", "2 problēmas", "5 problēmas", "21 problēma", "22 problēmas"] },
    en: { automations: ["1 automation", "2 automations", "5 automations", "21 automations", "22 automations"], n_problems: ["1 problem", "2 problems", "5 problems", "21 problems", "22 problems"] },
  };
  for (const [l, keys] of Object.entries(cases))
    for (const [key, texts] of Object.entries(keys)) assert.deepEqual([1, 2, 5, 21, 22].map((n) => say(l, key, n)), texts, `${l}.${key}`);
});

test("the section title toggle holds no button: Clear all sits next to it, not inside it", () => {
  const el = card(baseStates());
  el._config = { expand_failed: true };
  const html = el._render();
  const title = html.match(/<div class="section-title[^"]*"[^>]*>[\s\S]*?<\/div>\s*(?=<div class="items">)/)[0];
  const toggle = title.match(/<span class="toggle"[^>]*role="button"[^>]*>([\s\S]*?)<\/span><\/span>/);
  assert.ok(toggle, "no role=button toggle in the section title");
  assert.doesNotMatch(toggle[1], /<button/);
  assert.match(title, /data-action="reset_all"/);
  assert.match(toggle[0], /aria-expanded="true"/);
  // The title container itself is not a button any more.
  assert.doesNotMatch(title.match(/<div class="section-title[^>]*>/)[0], /role="button"/);
});

test("an unavailable sensor whose list is hidden (show_failed: false) leaves the status at All good", () => {
  const el = card(naStates("unavailable"));
  el._config = { show_failed: false };
  const html = el._render();
  assert.match(html, /All good/);
  assert.doesNotMatch(html, /Sensor unavailable/);
  // The mini card shares the counters: a dash there too.
  const mini = new AutomationMonitorMiniCard();
  mini._config = {};
  mini._hass = { states: naStates("unknown"), entities, devices, language: "en", user: admin };
  assert.match(mini._render(), /<div class="n">—<\/div>/);
});

test("the header icon takes the status color: green when all is good, red on a failure", () => {
  const ok = baseStates();
  ok["sensor.failed"] = { entity_id: "sensor.failed", state: "0", attributes: { automations: [] } };
  assert.match(card(ok)._render(), /<div class="logo ok" aria-hidden="true">/);
  assert.match(card(baseStates())._render(), /<div class="logo crit" aria-hidden="true">/);
  assert.match(card(naStates("unavailable"))._render(), /<div class="logo na" aria-hidden="true">/);
});

test("hide_when_ok hides the cards while all is good, and tells Lovelace; never for an unreadable sensor nor while editing", () => {
  const ok = baseStates();
  ok["sensor.failed"] = { ...ok["sensor.failed"], state: "0", attributes: { automations: [] } };
  // The DOM patch is not stubbed: the visibility step of _update is run on its own.
  const make = (Card, config, states) => {
    const el = new Card();
    el.events = [];
    el.dispatchEvent = (ev) => el.events.push(ev.type);
    el._config = config;
    el._hass = { states, entities, devices, language: "en", user: admin };
    el._applyVisibility();
    return el;
  };
  for (const Card of [AutomationMonitorCard, AutomationMonitorMiniCard]) {
    const el = make(Card, { hide_when_ok: true }, ok);
    assert.equal(el.hidden, true, Card.name);
    assert.deepEqual(el.events, ["card-visibility-changed"], Card.name);
    // A failure: shown again, Lovelace told once more.
    el._hass = { states: baseStates(), entities, devices, language: "en", user: admin };
    el._applyVisibility();
    assert.equal(el.hidden, false, Card.name);
    assert.equal(el.events.length, 2, Card.name);
    // Edited dashboard or card editor preview: always shown.
    el._hass = { states: ok, entities, devices, language: "en", user: admin };
    el._applyVisibility();
    assert.equal(el.hidden, true, Card.name);
    el._editMode = true;
    el._applyVisibility();
    assert.equal(el.hidden, false, Card.name);
    el._editMode = false;
    el._preview = true;
    el._applyVisibility();
    assert.equal(el.hidden, false, Card.name);
  }
  // A sensor that can't be read is not "all good"; the option is off by default.
  const na = baseStates();
  na["sensor.failed"] = { ...na["sensor.failed"], state: "unavailable", attributes: {} };
  na["sensor.linked"] = { ...na["sensor.linked"], state: "unavailable", attributes: {} };
  assert.ok(!make(AutomationMonitorCard, { hide_when_ok: true }, na).hidden);
  assert.ok(!make(AutomationMonitorCard, {}, ok).hidden);
});

test("hide_when_ok is offered in both editors, off by default", () => {
  const { AutomationMonitorMiniCardEditor } = load("automation-monitor-card.js", ["AutomationMonitorMiniCardEditor"]);
  for (const Editor of [AutomationMonitorCardEditor, AutomationMonitorMiniCardEditor]) {
    assert.ok(Editor.toggles.some(([n, d]) => n === "hide_when_ok" && d === false), Editor.name);
  }
});

// Two failures and a linked entity used by a UI script: the admin-only controls are all present for an admin.
const richStates = () => {
  const states = baseStates();
  states["sensor.failed"].attributes.automations = [failure, { entity_id: "automation.b", name: "B", last_error_time: "2026-10-24T09:00:00Z" }];
  states["automation.b"] = { entity_id: "automation.b", state: "on", attributes: { id: "2" } };
  states["sensor.linked"] = {
    entity_id: "sensor.linked",
    state: "1",
    attributes: { entities: [{ entity_id: "light.kitchen", name: "Kitchen", referenced_by_details: [{ entity_id: "script.night", unique_id: "night" }] }] },
  };
  return states;
};

test("non-admins get no Trace, Edit, Clear, Clear all or Refresh, and the used-by tags open more-info", () => {
  const el = card(richStates());
  el._config = { expand_failed: true, expand_linked: true };
  const adminHtml = el._render();
  for (const re of [/data-key="trace"/, /data-key="edit"/, /data-action="reset"/, /data-action="reset_all"/, /data-action="rebuild"/, /data-path="\/config\/script\/edit\/night"/])
    assert.match(adminHtml, re);
  for (const user of [{ is_admin: false }, undefined]) {
    el._hass = { ...el._hass, user };
    const html = el._render();
    for (const re of [/data-key="trace"/, /data-key="edit"/, /data-action="reset"/, /data-action="reset_all"/, /data-action="rebuild"/, /data-path=/])
      assert.doesNotMatch(html, re);
    assert.match(html, /class="tag link"[^>]*data-entity="script.night"/);
  }
  // The admin flag is part of the render signature.
  el._hass = { ...el._hass, user: { is_admin: true } };
  const sig = el._signature();
  el._hass = { ...el._hass, user: { is_admin: false } };
  assert.ok(!sameSig(sig, el._signature()));
});

test("exclude_entities leaves out matching ids and globs from lists, counters and status", () => {
  const match = excludedEntities({ exclude_entities: ["automation.b", "light.*", " Sensor.?ump "] });
  assert.ok(match("automation.b") && match("light.kitchen") && match("sensor.pump") && match("LIGHT.x"));
  assert.ok(!match("automation.a") && !match("sensor.sump_2") && !match("automation.bb"));
  assert.equal(excludedEntities({ exclude_entities: ["automation.b", "light.*", " Sensor.?ump "] }), match);
  assert.equal(excludedEntities({}), null);
  assert.equal(excludedEntities({ exclude_entities: "automation.a" })("automation.a"), true);
  const el = card(richStates());
  el._config = { exclude_entities: ["automation.b", "light.*"] };
  const data = el._data();
  assert.deepEqual(
    data.failures.map((a) => a.entity_id),
    ["automation.a"]
  );
  assert.equal(data.linked.length, 0);
  assert.equal(data.failuresHidden, true);
  assert.match(el._render(), /1 problem/);
});

test("Clear all with exclusions only clears the listed automations, without them it clears everything", async () => {
  const run = async (config) => {
    const el = card(richStates());
    el._config = config;
    el._update = () => {};
    el.connectedCallback();
    const calls = [];
    el._hass.callService = (domain, service, data) => calls.push(`${domain}.${service} ${JSON.stringify(data)}`);
    el._confirmClosedAt = 0;
    el._onClick(click([{ dataset: { action: "reset_all" } }]));
    el._onClick(click([{ dataset: { action: "confirm_ok" } }]));
    await new Promise((r) => setTimeout(r, 0));
    el.disconnectedCallback();
    return calls;
  };
  assert.deepEqual(await run({}), ["automation_monitor.reset {}"]);
  assert.deepEqual(await run({ exclude_entities: ["automation.b"] }), ['automation_monitor.reset {"entity_id":"automation.a"}']);
  // Exclusions that hide no failure keep the single call.
  assert.deepEqual(await run({ exclude_entities: ["light.*"] }), ["automation_monitor.reset {}"]);
});

test("the failure time tooltip follows the 12 / 24 h setting of the profile", () => {
  const iso = "2026-10-24T15:00:00Z";
  const h = (time_format) => ({ language: "en", locale: { language: "en", time_format } });
  assert.doesNotMatch(fullDate(h("24"), {}, iso), /PM|AM/);
  assert.match(fullDate(h("12"), {}, iso), /PM|AM/);
  assert.doesNotMatch(fullDate({ language: "fr", locale: { language: "fr", time_format: "24" } }, {}, iso), /PM|AM/);
  assert.match(fullDate({ language: "fr", locale: { language: "fr", time_format: "12" } }, {}, iso), /PM|AM/i);
  assert.equal(fullDate(h("language"), {}, "nope"), "");
});

test("the editor offers exclude_entities as free text (patterns allowed)", () => {
  const ed = new AutomationMonitorCardEditor();
  ed._hass = { states: {}, language: "en" };
  ed._config = {};
  const field = ed._schema().find((f) => f.name === "exclude_entities");
  assert.deepEqual({ ...field.selector.text }, { multiple: true });
});

test("only the matcher of the last exclude_entities value is cached", () => {
  const a = excludedEntities({ exclude_entities: ["automation.a"] });
  for (let i = 0; i < 50; i++) excludedEntities({ exclude_entities: [`automation.x${i}`] });
  const b = excludedEntities({ exclude_entities: ["automation.b"] });
  assert.deepEqual(Object.keys(_entityMatcherCache), ["key", "matcher"]);
  assert.equal(_entityMatcherCache.key, JSON.stringify(["automation.b"]));
  assert.equal(_entityMatcherCache.matcher, b);
  assert.equal(excludedEntities({ exclude_entities: ["automation.b"] }), b);
  const a2 = excludedEntities({ exclude_entities: ["automation.a"] });
  assert.notEqual(a2, a);
  assert.equal(a2("automation.a"), true);
});

test("icon-only buttons have an accessible name and the confirm popup is described by its message", () => {
  const el = zoomCard();
  assert.match(el.html, /<button class="refresh [^"]*" data-action="rebuild" title="[^"]*" aria-label="Refresh">/);
  el._confirm = { text: "Clear all?", ok: "OK" };
  const html = el._confirmHtml();
  assert.match(html, /role="dialog" aria-modal="true" aria-describedby="confirm-msg"/);
  assert.match(html, /<div class="msg" id="confirm-msg">Clear all\?<\/div>/);
});

test("a press in the card released outside of it (a slider dragged out) does not fold", () => {
  const el = card(baseStates());
  el._update = () => {};
  el.connectedCallback();
  el._folds = { failed: true };
  el._outside.tap(click([node("div"), el, node("body")]));
  assert.deepEqual({ ...el._folds }, { failed: true });
  el.disconnectedCallback();
});
