// gauge_style: bar and the level colours (#131).
import assert from "node:assert/strict";
import { test } from "node:test";
import { devices, entities, states } from "./mock-states.mjs";
import { load } from "./load.mjs";

const lib = load();
lib.document.createElement = () => ({ addEventListener() {} });
const hass = { states, entities, devices, language: "en", config: { version: "2026.10.2" } };
const render = (Cls, config, zoomed = false) => {
  const el = new Cls();
  el._hass = hass;
  el._config = { show_history: false, ...config };
  if (zoomed) el._zoomed = true;
  return el._render();
};
const CPU = "sensor.system_monitor_processor_use"; // 23 %
const RAM = "sensor.system_monitor_memory_usage"; // 38.6 %

test("rings by default, lines with gauge_style: bar", () => {
  const rings = render(lib.SystemMonitorCard, {});
  assert.match(rings, /class="gauges"/);
  assert.doesNotMatch(rings, /class="lines"/);
  const lines = render(lib.SystemMonitorCard, { gauge_style: "bar", cpu_warning: 20 });
  assert.doesNotMatch(lines, /class="gauges"/);
  assert.match(lines, /class="lines"/);
  // Each metric keeps its level, its entity and its value; the RAM line shows its used / total size.
  assert.match(lines, new RegExp(`class="line clickable warn" data-entity="${CPU.replace(/\./g, "\\.")}"`));
  const ram = lines.slice(lines.indexOf(`data-entity="${RAM}"`));
  assert.match(ram.slice(0, ram.indexOf("</div>\n    </div>") + 20), /class="d">[^<]+GiB<\/span><span class="v">39%/);
  assert.match(lines, /<div class="bar"><div style="width:23%"><\/div><\/div>/);
});

test("the zoomed mini card follows gauge_style", () => {
  assert.match(render(lib.SystemMonitorMiniCard, { gauge_style: "bar" }, true), /class="lines"/);
});

test("level colours: theme names, RGB lists and CSS colours; unusable values ignored", () => {
  assert.equal(lib.levelColor("green"), "var(--green-color, #4caf50)");
  assert.equal(lib.levelColor("deep-orange"), "var(--deep-orange-color, #ff6f22)");
  assert.equal(lib.levelColor([10, 20, 30]), "rgb(10, 20, 30)");
  assert.equal(lib.levelColor(" #43a047 "), "#43a047");
  assert.equal(lib.levelColor("rgb(1, 2, 3)"), "rgb(1, 2, 3)");
  for (const bad of ["", null, undefined, 3, "red; color: x", "a}b", [1, 2]]) assert.equal(lib.levelColor(bad), null, String(bad));
  assert.equal(lib.levelColor("constructor"), "constructor");
});

for (const Cls of [lib.SystemMonitorCard, lib.SystemMonitorMiniCard])
  test(`${Cls.name}: the level colours are set on the card, and removed again`, () => {
    const el = new Cls();
    const props = {};
    el.style = { setProperty: (k, v) => (props[k] = v), removeProperty: (k) => delete props[k] };
    el._update = () => {};
    el.setConfig({ ok_color: "green", warning_color: "#ff9800", critical_color: [200, 0, 0] });
    assert.deepEqual(props, { "--sm-level-ok": "var(--green-color, #4caf50)", "--sm-warn": "#ff9800", "--sm-crit": "rgb(200, 0, 0)" });
    el.setConfig({ warning_color: "orange" });
    assert.deepEqual(props, { "--sm-warn": "var(--orange-color, #ff9800)" });
  });

for (const Cls of [lib.SystemMonitorCardEditor, lib.SystemMonitorMiniCardEditor])
  test(`${Cls.name}: gauge_style and the colours in the editor, ring left out of the YAML`, () => {
    let listener;
    lib.document.createElement = () => ({
      addEventListener: (_, fn) => {
        listener = fn;
      },
    });
    const e = new Cls();
    e.appendChild = () => {};
    e.dispatchEvent = () => {};
    e.setConfig({ type: "custom:x" });
    e.hass = hass;
    const names = e._form.schema.flatMap((f) => (f.schema ? f.schema.map((s) => s.name) : [f.name]));
    for (const k of ["gauge_style", "ok_color", "warning_color", "critical_color"]) {
      assert.ok(names.includes(k), k);
      for (const [code, s] of Object.entries(lib.STRINGS)) assert.ok(s[k], `${code}.${k}`);
    }
    for (const [code, s] of Object.entries(lib.STRINGS)) for (const k of ["gauge_ring", "gauge_bar", "ok_color_helper"]) assert.ok(s[k], `${code}.${k}`);
    assert.equal(e._form.data.gauge_style, "ring");
    listener({ stopPropagation() {}, detail: { value: { ...e._form.data, ok_color: "green" } } });
    assert.deepEqual({ ...e._config }, { type: "custom:x", ok_color: "green" });
    listener({ stopPropagation() {}, detail: { value: { ...e._form.data, gauge_style: "bar" } } });
    assert.equal(e._config.gauge_style, "bar");
    lib.document.createElement = () => ({ addEventListener() {} });
  });
