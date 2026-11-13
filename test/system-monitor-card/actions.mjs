// show_actions (#82): Reload the configuration, Restart Home Assistant and Reboot the host on the full card,
// administrators only, each confirmed in the card itself.
import assert from "node:assert/strict";
import { test } from "node:test";
import { entities, states } from "./mock-states.mjs";
import { load } from "./load.mjs";

const lib = load();

const card = ({ admin = true, supervisor = true, config = { show_actions: true } } = {}) => {
  const c = new lib.SystemMonitorCard();
  const calls = [];
  c._hass = {
    states,
    entities,
    devices: {},
    language: "en",
    user: { is_admin: admin },
    config: { components: supervisor ? ["hassio", "systemmonitor"] : ["systemmonitor"] },
    callService: async (domain, service, data) => calls.push([domain, service, data]),
    callApi: async () => ({ result: "valid" }),
  };
  c._config = config;
  c._update = () => {
    c._html = c._render();
  };
  c.shadowRoot = { querySelector: () => null };
  return { c, calls };
};

test("show_actions: off by default, and for a user who is not an administrator", () => {
  assert.doesNotMatch(card({ config: {} }).c._render(), /data-action="ha_ask:/);
  assert.doesNotMatch(card({ admin: false }).c._render(), /data-action="ha_ask:/);
});

test("show_actions: Reload, Restart and, with the Supervisor only, Reboot the host", () => {
  const html = card().c._render();
  assert.match(html, /data-action="ha_ask:reload"[\s\S]*Reload configuration/);
  assert.match(html, /data-action="ha_ask:restart"[\s\S]*Restart Home Assistant/);
  assert.match(html, /data-action="ha_ask:reboot"[\s\S]*Reboot the host/);
  assert.doesNotMatch(card({ supervisor: false }).c._render(), /ha_ask:reboot/);
});

test("show_actions: the reboot asks first, then calls hassio.host_reboot", async () => {
  const { c, calls } = card();
  await c._haAction("ha_ask:reboot");
  assert.equal(calls.length, 0);
  assert.match(c._html, /role="alertdialog"[\s\S]*Reboot the host\?/);
  assert.match(c._html, /data-action="ha_cancel"/);
  await c._haAction("ha_cancel");
  assert.doesNotMatch(c._html, /role="alertdialog"/);
  await c._haAction("ha_ok:reboot");
  assert.equal(calls.length, 0, "no reboot without asking first");
  await c._haAction("ha_ask:reboot");
  await c._haAction("ha_ok:reboot");
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [["hassio", "host_reboot", {}]]);
  assert.match(c._html, /The host is rebooting…/);
});

test("show_actions: the restart checks the configuration and is refused while it is invalid", async () => {
  const { c, calls } = card();
  c._hass.callApi = async () => ({ result: "invalid", errors: "Invalid config for 'automation'" });
  await c._haAction("ha_ask:restart");
  assert.match(c._html, /The configuration is invalid/);
  assert.match(c._html, /data-action="ha_ok:restart" disabled/);
  await c._haAction("ha_ok:restart");
  assert.equal(calls.length, 0);
  c._hass.callApi = async () => ({ result: "valid" });
  await c._haAction("ha_ask:restart");
  assert.match(c._html, /The configuration is valid/);
  assert.doesNotMatch(c._html, /data-action="ha_ok:restart" disabled/);
  await c._haAction("ha_ok:restart");
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [["homeassistant", "restart", {}]]);
});

test("show_actions: the reload runs homeassistant.reload_all; a failure is shown, a dropped connection is not", async () => {
  const { c, calls } = card();
  await c._haAction("ha_ask:reload");
  await c._haAction("ha_ok:reload");
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [["homeassistant", "reload_all", {}]]);
  c._hass.callService = async () => {
    throw { code: 3, message: "Connection lost" };
  };
  await c._haAction("ha_ask:reboot");
  await c._haAction("ha_ok:reboot");
  assert.doesNotMatch(c._html, /Failed/);
  c._hass.callService = async () => {
    throw { code: "unauthorized", message: "Unauthorized" };
  };
  await c._haAction("ha_ask:reboot");
  await c._haAction("ha_ok:reboot");
  assert.match(c._html, /Failed: Unauthorized/);
  assert.doesNotMatch(c._html, /\[object Object\]/);
});

test("show_actions: in the card editor, off by default and left out of the YAML when off", () => {
  let onChange;
  lib.document.createElement = () => ({
    addEventListener(_name, handler) {
      onChange = handler;
    },
  });
  const e = new lib.SystemMonitorCardEditor();
  const sent = [];
  e.appendChild = () => {};
  e.dispatchEvent = (ev) => sent.push(ev);
  e.setConfig({ type: "custom:x" });
  e.hass = { states, entities, devices: {}, language: "en" };
  assert.equal(e._form.data.show_actions, false);
  const names = JSON.stringify(e._form.schema);
  assert.match(names, /"show_actions"/);
  onChange({ stopPropagation() {}, detail: { value: { ...e._form.data, show_actions: false } } });
  assert.equal("show_actions" in e._config, false);
  onChange({ stopPropagation() {}, detail: { value: { ...e._form.data, show_actions: true } } });
  assert.equal(e._config.show_actions, true);
  lib.document.createElement = () => ({ addEventListener() {} });
  const mini = new lib.SystemMonitorMiniCardEditor();
  mini.appendChild = () => {};
  mini.setConfig({ type: "custom:x" });
  mini.hass = { states, entities, devices: {}, language: "en" };
  // The mini card's zoomed view is the full card: its editor offers the option too (off by default).
  assert.match(JSON.stringify(mini._form.schema), /"show_actions"/);
  assert.equal(mini._form.data.show_actions, false);
});
