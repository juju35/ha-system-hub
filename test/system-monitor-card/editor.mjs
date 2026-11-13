import assert from "node:assert/strict";
import { test } from "node:test";
import { devices, entities, states } from "./mock-states.mjs";
import { load } from "./load.mjs";

const lib = load();
// The editor's ha-form: a plain object that records what the editor gives it.
lib.document.createElement = () => ({ addEventListener() {} });
const hassWith = (extra = {}, language = "en") => ({ states: { ...states, ...extra }, entities, devices, language });

const editor = (Cls) => {
  const e = new Cls();
  e.appendChild = () => {};
  e.dispatchEvent = () => {};
  return e;
};

// ha-form renders again whenever its schema or data is a new object: a state change of Home Assistant (set hass,
// several times a second) must not hand it new ones.
for (const Cls of [lib.SystemMonitorCardEditor, lib.SystemMonitorMiniCardEditor])
  test(`${Cls.name}: the form keeps its schema and data across state changes`, () => {
    const e = editor(Cls);
    e.setConfig({ type: "custom:x", title: "Server" });
    e.hass = hassWith();
    const { schema, data } = e._form;
    assert.ok(Array.isArray(schema) && schema.length);
    e.hass = hassWith({ "sensor.system_monitor_processor_use": { entity_id: "sensor.system_monitor_processor_use", state: "57", attributes: { unit_of_measurement: "%" } } });
    assert.equal(e._form.schema, schema, "new schema on a state change");
    assert.equal(e._form.data, data, "new data on a state change");
    // A new config: new data, same schema.
    e.setConfig({ type: "custom:x", title: "NAS" });
    assert.notEqual(e._form.data, data);
    assert.equal(e._form.data.title, "NAS");
    assert.equal(e._form.schema, schema);
    // Another language: new labels, hence a new schema.
    e.hass = hassWith({}, "fr");
    assert.notEqual(e._form.schema, schema);
    assert.equal(e._form.schema.find((f) => f.name === "language").selector.select.options[0].label, "Automatique");
  });

test("card editor: a new network interface shows up in the interface choice", () => {
  const e = editor(lib.SystemMonitorCardEditor);
  e.setConfig({ type: "custom:x" });
  e.hass = hassWith();
  const before = e._form.schema;
  const id = "sensor.system_monitor_network_throughput_in_wlan0";
  const hass = hassWith({
    [id]: { entity_id: id, state: "0.1", attributes: { unit_of_measurement: "MB/s", device_class: "data_rate", friendly_name: "System Monitor Network throughput in wlan0" } },
  });
  hass.entities = { ...entities, [id]: { entity_id: id, platform: "systemmonitor", translation_key: "throughput_network_in" } };
  e.hass = hass;
  const options = (s) => s.find((f) => f.name === "interface").selector.select.options.map((o) => o.value);
  assert.ok(options(e._form.schema).includes("wlan0"), options(e._form.schema).join());
  assert.notEqual(e._form.schema, before);
});

test("SystemMonitorMiniCardEditor: the full card's sections, shown by the zoom", () => {
  const names = (Cls) => {
    const e = editor(Cls);
    e.setConfig({});
    e.hass = hassWith();
    return e._form.schema.flatMap((f) => (f.schema ? f.schema.map((x) => x.name) : [f.name]));
  };
  const mini = names(lib.SystemMonitorMiniCardEditor);
  for (const name of names(lib.SystemMonitorCardEditor)) assert.ok(mini.includes(name), name);
  assert.ok(mini.includes("zoom"));
});
