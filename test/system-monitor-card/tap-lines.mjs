// #129: tap_action: none, the System section's lines left out one by one, and the reload / restart / reboot
// buttons as icons only when they do not fit on one line.
import assert from "node:assert/strict";
import { test } from "node:test";
import { devices, entities, states } from "./mock-states.mjs";
import { load } from "./load.mjs";

const lib = load();
const hass = () => ({
  states: { ...states },
  entities,
  devices,
  language: "en",
  user: { is_admin: true },
  config: { components: ["hassio", "systemmonitor"] },
});

const card = (Cls, config = {}) => {
  const c = new Cls();
  c._hass = hass();
  c._config = config;
  return c;
};

test("tap_action: none, as a string or as the editor's object", () => {
  assert.equal(lib.tapNone({ tap_action: "none" }), true);
  assert.equal(lib.tapNone({ tap_action: { action: "none" } }), true);
  assert.equal(lib.tapNone({ tap_action: { action: "more-info" } }), false);
  assert.equal(lib.tapNone({}), false);
});

test("tap_action: none: nothing opens an entity, the folds and buttons still act", () => {
  for (const Cls of [lib.SystemMonitorCard, lib.SystemMonitorMiniCard]) {
    const c = card(Cls, { tap_action: "none", show_actions: true });
    c._update();
    const html = c.shadowRoot.innerHTML;
    assert.match(c._render(), /data-entity="sensor\./, "the render itself is unchanged");
    assert.doesNotMatch(html, /data-entity=/);
    // Every element left as a button acts (a fold, the zoom) or is a real <button>.
    for (const tag of html.match(/<(span|div)\b[^>]*role="button"[^>]*>/g) || []) assert.match(tag, /data-action="/, tag);
    assert.doesNotMatch(html, /class="[^"]*\bclickable\b[^"]*"(?![^>]*data-action)/);
    assert.match(html, /data-action="zoom"|data-action="ha_ask:reload"/);
  }
});

test("tap_action: none: a click on an entity opens nothing", () => {
  // The base element's attachShadow, patched to catch the card's click listener.
  const base = Object.getPrototypeOf(Object.getPrototypeOf(lib.SystemMonitorCard.prototype));
  const attach = base.attachShadow;
  const clicks = [];
  base.attachShadow = function () {
    this.shadowRoot = { addEventListener: (type, fn) => type === "click" && clicks.push(fn), querySelector: () => null, innerHTML: "" };
    return this.shadowRoot;
  };
  const c = new lib.SystemMonitorCard();
  base.attachShadow = attach;
  const opened = [];
  c.dispatchEvent = (ev) => opened.push(ev);
  const ev = { composedPath: () => [{ dataset: { entity: "sensor.x" } }], detail: 1 };
  c._config = {};
  for (const fn of clicks) fn(ev);
  assert.equal(opened.length, 1);
  c._config = { tap_action: "none" };
  for (const fn of clicks) fn(ev);
  assert.equal(opened.length, 1);
});

test("show_uptime / show_load / show_ip: each line of the System section can be left out", () => {
  const full = card(lib.SystemMonitorCard)._render();
  assert.match(full, /Uptime:/);
  assert.match(full, /Load/);
  assert.match(full, /192\.168\./);
  const html = card(lib.SystemMonitorCard, { show_uptime: false, show_load: false, show_ip: false })._render();
  assert.doesNotMatch(html, /Uptime:/);
  assert.doesNotMatch(html, /class="facts"/);
  assert.match(card(lib.SystemMonitorCard, { show_ip: false })._render(), /Uptime:/);
  assert.doesNotMatch(card(lib.SystemMonitorCard, { show_ip: false })._render(), /192\.168\./);
  // The mini card's footer uptime follows show_uptime too.
  const mini = card(lib.SystemMonitorMiniCard);
  const timer = lib.ICONS.timer;
  assert.ok(mini._compactRender().includes(timer));
  assert.ok(!card(lib.SystemMonitorMiniCard, { show_uptime: false })._compactRender().includes(timer));
});

test("show_actions: the buttons carry their label in title and aria-label, icons only once they wrap", () => {
  const c = card(lib.SystemMonitorCard, { show_actions: true });
  const html = c._render();
  assert.match(html, /<div class="ha-main">/);
  assert.match(html, /data-action="ha_ask:restart" title="Restart Home Assistant" aria-label="Restart Home Assistant"/);
  // Two rows of buttons: icons only.
  const classes = new Set();
  const button = (top) => ({ getBoundingClientRect: () => ({ top }) });
  const row = {
    children: [button(0), button(0), button(40)],
    classList: { remove: (n) => classes.delete(n), toggle: (n, on) => (on ? classes.add(n) : classes.delete(n)) },
  };
  c.shadowRoot = { querySelector: (sel) => (sel === ".ha-main" ? row : null) };
  c._fitActs();
  assert.equal(c._actsIcons, true);
  assert.ok(classes.has("icons"));
  assert.match(c._render(), /<div class="ha-main icons">/);
  row.children = [button(0), button(0), button(0)];
  c._fitActs();
  assert.equal(c._actsIcons, false);
  assert.ok(!classes.has("icons"));
});

test("editor: show_uptime / show_load / show_ip on by default, tap_action left out at more-info", () => {
  let onChange;
  lib.document.createElement = () => ({
    addEventListener(_name, handler) {
      onChange = handler;
    },
  });
  for (const Editor of [lib.SystemMonitorCardEditor, lib.SystemMonitorMiniCardEditor]) {
    const e = new Editor();
    e.appendChild = () => {};
    e.dispatchEvent = () => {};
    e.setConfig({ type: "custom:x", tap_action: "none" });
    e.hass = hass();
    for (const k of ["show_uptime", "show_load", "show_ip"]) assert.equal(e._form.data[k], true, k);
    assert.deepEqual({ ...e._form.data.tap_action }, { action: "none" });
    assert.match(JSON.stringify(e._form.schema), /"tap_action".*"ui_action"/);
    onChange({ stopPropagation() {}, detail: { value: { ...e._form.data, tap_action: { action: "more-info" }, show_ip: false } } });
    assert.equal("tap_action" in e._config, false);
    assert.equal(e._config.show_ip, false);
    onChange({ stopPropagation() {}, detail: { value: { ...e._form.data, tap_action: { action: "none" }, show_ip: true } } });
    assert.deepEqual({ ...e._config.tap_action }, { action: "none" });
    assert.equal("show_ip" in e._config, false);
  }
  lib.document.createElement = () => ({ addEventListener() {} });
});
