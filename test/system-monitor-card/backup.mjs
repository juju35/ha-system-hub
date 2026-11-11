import assert from "node:assert/strict";
import { test } from "node:test";
import { devices, entities, states } from "./mock-states.mjs";
import { load } from "./load.mjs";

const lib = load();
const LAST = "sensor.backup_last_successful_automatic_backup";
const ATTEMPT = "sensor.backup_last_attempted_automatic_backup";
const STATE = "sensor.backup_backup_manager_state";
const at = (hours) => new Date(Date.now() + hours * 3600 * 1000).toISOString();
const hassWith = (over = {}) => {
  const s = { ...states };
  for (const [id, state] of Object.entries(over)) s[id] = { ...s[id], state };
  return { states: s, entities, devices, language: "en" };
};
const card = (Cls, hass, config = {}) => {
  const c = new Cls();
  c._hass = hass;
  c._config = config;
  return c;
};
const status = (over, config = {}) => {
  const hass = hassWith(over);
  return lib.backupStatus(hass, config, lib.discoverBackup(hass));
};

test("the backup sensors are found by their translation keys", () => {
  const b = lib.discoverBackup(hassWith());
  assert.equal(b.last_successful_automatic_backup, LAST);
  assert.equal(b.backup_manager_state, STATE);
  assert.equal(lib.discoverBackup({ states: {}, entities: {}, devices: {} }), null);
});

test("the level follows the age of the last backup, the thresholds can be set", () => {
  assert.equal(status({}).level, "ok");
  assert.equal(status({ [LAST]: at(-60), [ATTEMPT]: at(-60.1) }).level, "warn");
  assert.equal(status({ [LAST]: at(-24 * 8), [ATTEMPT]: at(-24 * 8 - 0.1) }).level, "crit");
  assert.equal(status({ [LAST]: at(-60), [ATTEMPT]: at(-60.1) }, { backup_warning: 5 }).level, "ok");
});

test("a failed last attempt or no backup at all is critical, a backup running is not", () => {
  const failed = status({ [ATTEMPT]: at(-2) });
  assert.equal(failed.failed, true);
  assert.equal(failed.level, "crit");
  assert.equal(status({ [LAST]: "unknown", [ATTEMPT]: "unknown" }).level, "crit");
  const running = status({ [ATTEMPT]: at(-0.01), [STATE]: "create_backup" });
  assert.equal(running.running, true);
  assert.equal(running.level, "ok");
});

test("the full card shows the backup in Storage, the mini card only when it needs attention", () => {
  const full = card(lib.SystemMonitorCard, hassWith())._storage(lib.discover(hassWith()));
  assert.match(full, /class="vol clickable backup ok" data-entity="sensor\.backup_last_successful_automatic_backup"/);
  assert.match(full, /Next in 10 hours/);
  assert.match(full, /27 hours ago/);
  assert.doesNotMatch(card(lib.SystemMonitorCard, hassWith(), { show_backups: false })._storage(lib.discover(hassWith())), /backup/);

  const ok = card(lib.SystemMonitorMiniCard, hassWith())._compactRender();
  assert.doesNotMatch(ok, /data-entity="sensor\.backup_last/);
  const failed = hassWith({ [ATTEMPT]: at(-2) });
  assert.match(card(lib.SystemMonitorMiniCard, failed)._compactRender(), /class="clickable crit" data-entity="sensor\.backup_last_successful_automatic_backup"[^>]*><span class="dot"><\/span>&nbsp;Last attempt failed/);
});

test("a backup state change re-renders the card", () => {
  assert.ok(lib.trackedIds(hassWith()).includes(LAST));
});
