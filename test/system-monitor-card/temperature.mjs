import assert from "node:assert/strict";
import { test } from "node:test";
import { devices, entities, states } from "./mock-states.mjs";
import { load } from "./load.mjs";

const lib = load();
const TEMP = Object.keys(states).find((id) => /processor_temperature/.test(id));

/** The hass with the CPU temperature in this state and unit (Home Assistant converts it to the user's unit). */
const hassWithTemp = (state, unit, system) => ({
  states: { ...states, [TEMP]: { ...states[TEMP], state, attributes: { ...states[TEMP].attributes, unit_of_measurement: unit } } },
  entities,
  devices,
  language: "en",
  config: system ? { unit_system: { temperature: system } } : {},
});

const card = (Cls, hass) => {
  const c = new Cls();
  c._hass = hass;
  c._config = {};
  return c;
};

/** The CPU temperature gauge (full card) and bar (mini card), as rendered. */
const tempWidgets = (hass) => {
  const full = card(lib.SystemMonitorCard, hass)._system(lib.discover(hass));
  const mini = card(lib.SystemMonitorMiniCard, hass)._compactRender();
  const pick = (html, cls) => html.split(`<div class="${cls} clickable`).find((x) => x.includes(`data-entity="${TEMP}"`));
  return { full: pick(full, "gauge"), mini: pick(mini, "metric") };
};

const levelOf = (html) => html.match(/^ (\w*)"/)?.[1];
const ringPct = (html) => {
  const [dash, circ] = html.match(/stroke-dasharray="([\d.]+) ([\d.]+)"/).slice(1).map(Number);
  return (dash / circ) * 100;
};
const barPct = (html) => Number(html.match(/style="width:([\d.]+)%"/)[1]);

for (const [label, state, unit, system, shown, level, pct] of [
  // 54 °C, as Home Assistant reports it in °C and, converted, in °F and in K.
  ["°C", "54.2", "°C", "°C", "54°C", "ok", 54.2],
  ["°F (US customary units)", "129.6", "°F", "°F", "130°F", "ok", 54.2],
  ["°F (display unit of the sensor only)", "129.6", "°F", "°C", "130°F", "ok", 54.2],
  ["K", "327.35", "K", "°C", "327 K", "ok", 54.2],
  // Thresholds in °C (warn 75, crit 90), converted: 80 °C = 176 °F, 95 °C = 203 °F.
  ["°F, warm", "176", "°F", "°F", "176°F", "warn", 80],
  ["°F, hot", "203", "°F", "°F", "203°F", "crit", 95],
  ["°F, just under the warning threshold (75 °C = 167 °F)", "166", "°F", "°F", "166°F", "ok", 74.4],
]) {
  test(`CPU temperature in ${label}: shown in its own unit, levels and gauge in °C`, () => {
    const w = tempWidgets(hassWithTemp(state, unit, system));
    for (const [where, html] of Object.entries(w)) {
      assert.ok(html, `${where}: no temperature widget`);
      assert.ok(html.includes(shown), `${where}: "${shown}" not shown`);
      assert.doesNotMatch(html, unit === "°C" ? /°F/ : /\d°C/, `${where}: wrong unit`);
      assert.equal(levelOf(html), level, `${where}: level`);
    }
    assert.ok(Math.abs(ringPct(w.full) - pct) < 0.2, `ring at ${ringPct(w.full)}%, expected ${pct}%`);
    assert.ok(Math.abs(barPct(w.mini) - pct) < 0.2, `bar at ${barPct(w.mini)}%, expected ${pct}%`);
  });
}

test("CPU temperature without a unit: the unit of Home Assistant's unit system, else °C", () => {
  const f = tempWidgets(hassWithTemp("129.6", undefined, "°F"));
  assert.ok(f.full.includes("130°F"));
  assert.equal(levelOf(f.full), "ok");
  const c = tempWidgets(hassWithTemp("54.2", undefined, undefined));
  assert.ok(c.full.includes("54°C"));
});

for (const state of ["unavailable", "unknown"]) {
  test(`CPU temperature ${state} in °F: a dash, no level, an empty gauge`, () => {
    const w = tempWidgets(hassWithTemp(state, "°F", "°F"));
    for (const html of Object.values(w)) {
      assert.match(html, /—/);
      assert.equal(levelOf(html), "");
      assert.doesNotMatch(html, /°[CF]/);
    }
    assert.equal(ringPct(w.full), 0);
    assert.equal(barPct(w.mini), 0);
  });
}
