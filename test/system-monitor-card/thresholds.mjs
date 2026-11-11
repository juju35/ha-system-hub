// Warning / critical thresholds: the hard-coded levels are the defaults, each can be set in the card options.
import assert from "node:assert/strict";
import { test } from "node:test";
import { devices, entities, states } from "./mock-states.mjs";
import { load } from "./load.mjs";

const lib = load();
lib.document.createElement = () => ({ addEventListener() {} });
const hass = { states, entities, devices, language: "en", config: { version: "2026.10.2" } };
const render = (Cls, config) => {
  const el = new Cls();
  el._hass = hass;
  el._config = { show_history: false, ...config };
  return el._render();
};
// Level class of the gauge (full card) or metric row (mini card) of an entity.
const cls = (html, id) => html.match(new RegExp(`class="(?:gauge|metric) clickable (\\w*)" data-entity="${id.replace(/\./g, "\\.")}"`))?.[1];
const CPU = "sensor.system_monitor_processor_use"; // 23 %
const TEMP = "sensor.system_monitor_processor_temperature"; // 54.2 °C
const RAM = "sensor.system_monitor_memory_usage"; // 38.6 %

test("defaults: the former hard-coded levels", () => {
  const html = render(lib.SystemMonitorCard, {});
  assert.equal(cls(html, CPU), "ok");
  assert.equal(cls(html, TEMP), "ok");
  assert.equal(cls(html, RAM), "ok");
});

for (const Cls of [lib.SystemMonitorCard, lib.SystemMonitorMiniCard])
  test(`${Cls.name}: thresholds from the config`, () => {
    const html = render(Cls, { cpu_warning: 20, cpu_critical: 50, temp_warning: 40, temp_critical: 50, ram_warning: "30", ram_critical: "" });
    assert.equal(cls(html, CPU), "warn");
    assert.equal(cls(html, TEMP), "crit");
    // A number as text counts; an empty value falls back to the default (95).
    assert.equal(cls(html, RAM), "warn");
  });

test("temperature thresholds stay in °C with a °F sensor", () => {
  const f = { ...states, [TEMP]: { ...states[TEMP], state: "130", attributes: { ...states[TEMP].attributes, unit_of_measurement: "°F" } } };
  const el = new lib.SystemMonitorCard();
  el._hass = { ...hass, states: f };
  el._config = { show_history: false, temp_warning: 50 };
  assert.equal(cls(el._render(), TEMP), "warn"); // 130 °F = 54.4 °C
});

for (const Cls of [lib.SystemMonitorCardEditor, lib.SystemMonitorMiniCardEditor])
  test(`${Cls.name}: thresholds shown at their defaults, dropped from the YAML when left there`, () => {
    const e = new Cls();
    let listener;
    lib.document.createElement = () => ({
      addEventListener: (_, fn) => {
        listener = fn;
      },
    });
    e.appendChild = () => {};
    e.dispatchEvent = () => {};
    e.setConfig({ type: "custom:x", cpu_warning: 60 });
    e.hass = hass;
    const names = e._form.schema.flatMap((f) => (f.schema ? f.schema.map((s) => s.name) : [f.name]));
    for (const k of ["cpu_warning", "cpu_critical", "ram_warning", "ram_critical", "disk_warning", "disk_critical", "temp_warning", "temp_critical", "swap_warning", "swap_critical"]) {
      assert.ok(names.includes(k), k);
      for (const [code, s] of Object.entries(lib.STRINGS)) assert.ok(s[k], `${code}.${k}`);
    }
    assert.equal(e._form.data.cpu_warning, 60);
    assert.equal(e._form.data.cpu_critical, 90);
    assert.equal(e._form.data.temp_warning, 75);
    assert.equal(e._form.data.swap_warning, 50);
    listener({ stopPropagation() {}, detail: { value: { ...e._form.data, ram_critical: 97 } } });
    assert.deepEqual({ ...e._config }, { type: "custom:x", cpu_warning: 60, ram_critical: 97 });
    lib.document.createElement = () => ({ addEventListener() {} });
  });

test("Serbian Cyrillic threshold labels carry no Latin letters", () => {
  for (const [k, v] of Object.entries(lib.STRINGS.sr)) if (/_(warning|critical)$/.test(k)) assert.doesNotMatch(v, /[A-Za-z]/, k);
});
