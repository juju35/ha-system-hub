// Compact view of the mini card while a monitored process is stopped: red footer item and red header icon.
import assert from "node:assert/strict";
import { test } from "node:test";
import { devices, entities, procsRunning, states } from "./mock-states.mjs";
import { load } from "./load.mjs";

const lib = load();
const Z2M = "binary_sensor.system_monitor_process_zigbee2mqtt";
const hassWith = (extra = {}) => ({ states: { ...states, ...extra }, entities, devices, language: "en", config: { version: "2026.10.2" } });
const mini = (config = {}, extra = {}) => {
  const el = new lib.SystemMonitorMiniCard();
  el._hass = hassWith(extra);
  el._config = config;
  el._update = () => {
    el.html = el._render();
  };
  return el;
};
const stoppedItem = (html) => html.match(/<span class="clickable crit stopped"[^>]*><span class="dot"><\/span>[^<]*<\/span>/)?.[0];

test("mini card: a stopped process shows a red footer item that zooms, and tints the header icon", () => {
  const el = mini();
  const html = el._render();
  const item = stoppedItem(html);
  assert.ok(item, html);
  assert.match(item, /data-action="zoom"/);
  assert.match(item, /role="button" tabindex="0"/);
  assert.match(item, /title="1 process stopped"/);
  assert.match(item, /1 stopped/);
  assert.match(html, /<span class="logo crit"/);
  // Two stopped: the count.
  const two = mini({}, { "binary_sensor.system_monitor_process_mosquitto": { ...states["binary_sensor.system_monitor_process_mosquitto"], state: "off" } })._render();
  assert.match(stoppedItem(two), /2 stopped/);
});

test("mini card: the stopped item zooms to the full card with the processes list unfolded", () => {
  const el = mini();
  el._update();
  el._zoomClick({ stopPropagation() {}, detail: 1 });
  assert.equal(el._zoomed, true);
  assert.match(el.html, /data-action="procs"[^>]*aria-expanded="true"/);
  assert.match(el.html, new RegExp(`data-entity="${Z2M}"`));
  // The full view keeps the update status colour on its icon.
  assert.doesNotMatch(el.html, /<span class="logo crit"/);
});

test("mini card: with zoom: false the stopped item opens the first stopped process", () => {
  const item = stoppedItem(mini({ zoom: false })._render());
  assert.match(item, new RegExp(`data-entity="${Z2M}"`));
  assert.doesNotMatch(item, /data-action/);
});

test("mini card: no stopped item nor red icon when every process runs, an unknown one, or show_processes: false", () => {
  for (const [config, extra] of [
    [{}, procsRunning],
    [{}, { [Z2M]: { ...states[Z2M], state: "unavailable" } }],
    [{ show_processes: false }, {}],
  ]) {
    const html = mini(config, extra)._render();
    assert.equal(stoppedItem(html), undefined, JSON.stringify(config));
    assert.doesNotMatch(html, /<span class="logo crit"/);
  }
});

test("cards: a process that may be stopped (System Hub's System settings) is grey, no alert", async () => {
  const el = mini();
  el._sig = ["x"];
  let asked = null;
  el._hass.callWS = async (msg) => {
    asked = msg;
    return [Z2M];
  };
  el._maybeRender = () => {};
  el._loadStoppable();
  await new Promise((r) => setImmediate(r));
  assert.equal(asked.type, "system_hub/stoppable_processes");
  assert.equal(el._sig, null);
  const html = el._render();
  assert.equal(stoppedItem(html), undefined);
  assert.doesNotMatch(html, /<span class="logo crit"/);
  // Its chip in the full card's list: grey
  const full = new lib.SystemMonitorCard();
  full._hass = el._hass;
  full._config = {};
  full._stoppable = new Set([Z2M]);
  full._procsOpen = true;
  const list = full._render();
  assert.match(list, new RegExp(`chip clickable muted" data-entity="${Z2M}"`));
  // Without System Hub (the command fails): none, the stopped process stays red
  const other = mini();
  other._hass.callWS = async () => {
    throw new Error("unknown command");
  };
  other._loadStoppable();
  await new Promise((r) => setImmediate(r));
  assert.ok(stoppedItem(other._render()));
});
