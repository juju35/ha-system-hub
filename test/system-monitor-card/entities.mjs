import assert from "node:assert/strict";
import { test } from "node:test";
import { devices, entities, states } from "./mock-states.mjs";
import { load } from "./load.mjs";

const lib = load();
lib.document.createElement = () => ({ addEventListener() {} });

// Sensors of another integration: a CPU, two disks of a NAS (one by its usage, one by used and free), a LAN.
const OWN = {
  "sensor.nas_cpu": { entity_id: "sensor.nas_cpu", state: "23", attributes: { unit_of_measurement: "%" } },
  "sensor.hdd1_usage": { entity_id: "sensor.hdd1_usage", state: "41", attributes: { unit_of_measurement: "%" } },
  "sensor.hdd2_used": { entity_id: "sensor.hdd2_used", state: "300", attributes: { unit_of_measurement: "GB" } },
  "sensor.hdd2_free": { entity_id: "sensor.hdd2_free", state: "700", attributes: { unit_of_measurement: "GB" } },
  "sensor.lan_in": { entity_id: "sensor.lan_in", state: "1.5", attributes: { unit_of_measurement: "MB/s" } },
  "sensor.lan_out": { entity_id: "sensor.lan_out", state: "0.2", attributes: { unit_of_measurement: "MB/s" } },
};
const CONFIG = {
  entities: {
    processor_use: "sensor.nas_cpu",
    disks: { "/mnt/hdd1": "sensor.hdd1_usage", "/mnt/hdd2": { use: "sensor.hdd2_used", free: "sensor.hdd2_free" }, "/bad": "not an id" },
    interfaces: { lan: { in: "sensor.lan_in", out: "sensor.lan_out" } },
  },
};

test("entities: the sensors chosen replace or add to the discovered ones; a cached result per discovery and option", () => {
  const hass = { states: { ...states, ...OWN }, entities, devices, language: "en" };
  const plain = lib.discover(hass);
  const sm = lib.discover(hass, CONFIG);
  assert.equal(sm.scalars.processor_use, "sensor.nas_cpu");
  assert.equal(sm.scalars.memory_use_percent, plain.scalars.memory_use_percent);
  assert.deepEqual({ ...sm.disks["/mnt/hdd1"] }, { disk_use_percent: "sensor.hdd1_usage" });
  assert.deepEqual({ ...sm.disks["/mnt/hdd2"] }, { disk_use: "sensor.hdd2_used", disk_free: "sensor.hdd2_free" });
  assert.equal(sm.disks["/bad"], undefined);
  assert.deepEqual({ ...sm.nets.lan }, { throughput_network_in: "sensor.lan_in", throughput_network_out: "sensor.lan_out" });
  // The discovery itself is untouched, and the same option gives the same object
  assert.notEqual(plain.scalars.processor_use, "sensor.nas_cpu");
  assert.equal(lib.discover(hass, { entities: JSON.parse(JSON.stringify(CONFIG.entities)) }), sm);
  // Tracked: a change of a chosen sensor renders again
  assert.ok(lib.trackedIds(hass, CONFIG).includes("sensor.hdd2_free"));
});

test("entities: without System Monitor, the card shows the sensors chosen", () => {
  const hass = { states: { ...OWN }, entities: {}, devices: {}, language: "en" };
  assert.equal(lib.discover(hass).found, false);
  const card = new lib.SystemMonitorCard();
  card._hass = hass;
  card._config = CONFIG;
  const html = card._render();
  assert.match(html, /sensor\.nas_cpu/);
  assert.match(html, /\/mnt\/hdd1/);
  assert.match(html, /\/mnt\/hdd2/);
});

test("editor: the main sensors chosen under entities, the YAML disks kept, emptied ones dropped", () => {
  const e = new lib.SystemMonitorCardEditor();
  e.appendChild = () => {};
  // The sandbox's CustomEvent keeps nothing: the config saved is the editor's own.
  const sent = [];
  e.dispatchEvent = () => sent.push(e._config);
  e.setConfig({ type: "custom:system-monitor-card", entities: { disks: { "/mnt/hdd1": "sensor.hdd1_usage" } } });
  let changed;
  lib.document.createElement = () => ({ addEventListener: (_n, fn) => (changed = fn) });
  e._form = undefined;
  e.hass = { states: { ...states }, entities, devices, language: "en" };
  const fold = e._form.schema.find((f) => f.name === "entities");
  assert.equal(fold.type, "expandable");
  assert.deepEqual([...fold.schema.map((f) => f.name)], ["processor_use", "processor_temperature", "memory_use_percent", "swap_use_percent", "last_boot"]);
  assert.equal(e._form.computeLabel({ name: "processor_use" }), "CPU usage (%)");
  changed({ stopPropagation() {}, detail: { value: { ...e._form.data, entities: { ...e._form.data.entities, processor_use: "sensor.nas_cpu", last_boot: "" } } } });
  assert.deepEqual(JSON.parse(JSON.stringify(sent.at(-1).entities)), { disks: { "/mnt/hdd1": "sensor.hdd1_usage" }, processor_use: "sensor.nas_cpu" });
  changed({ stopPropagation() {}, detail: { value: { ...e._form.data, entities: { processor_use: "" } } } });
  assert.equal(sent.at(-1).entities, undefined);
});
