import assert from "node:assert/strict";
import { test } from "node:test";
import { devices, entities, states } from "./mock-states.mjs";
import { load } from "./load.mjs";

const lib = load();
const hassWith = (overrides = {}) => ({ states: { ...states }, entities, devices, language: "en", ...overrides });

const CORE = "update.home_assistant_core_update";

/** The hass with these entities in this state, without attributes (as Home Assistant reports an unavailable entity). */
const withStates = (hass, ids, state = "unavailable") => {
  const next = { ...hass.states };
  for (const id of ids) next[id] = { entity_id: id, state, attributes: {} };
  return { ...hass, states: next };
};

const card = (Cls, hass, config = {}) => {
  const c = new Cls();
  c._hass = hass;
  c._config = config;
  return c;
};

for (const state of ["unavailable", "unknown"]) {
  test(`Core update ${state}: the header chip does not claim "Up to date"`, () => {
    const hass = withStates(hassWith(), [CORE], state);
    const header = card(lib.SystemMonitorCard, hass)._header(lib.discover(hass));
    assert.doesNotMatch(header, /chip good/);
    assert.doesNotMatch(header, /Up to date/);
    assert.match(header, /chip clickable muted/);
  });
}

test("Core update unavailable: the mini card's footer is neutral", () => {
  const hass = withStates(hassWith(), [CORE]);
  const html = card(lib.SystemMonitorMiniCard, hass)._compactRender();
  assert.doesNotMatch(html, /class="clickable good"/);
  assert.match(html, /class="clickable muted"/);
});

test("OS update unavailable with Core up to date: the header chip is neutral, a pending Core update still wins", () => {
  const hass = hassWith();
  const os = lib.discover(hass).os_update;
  if (!os) return;
  const h = withStates(hass, [os]);
  assert.match(card(lib.SystemMonitorCard, h)._header(lib.discover(h)), /chip clickable muted/);
  h.states[CORE] = { ...hass.states[CORE], state: "on", attributes: { ...hass.states[CORE].attributes, latest_version: "2099.1.0" } };
  assert.match(card(lib.SystemMonitorCard, h)._header(lib.discover(h)), /chip clickable warn/);
});
