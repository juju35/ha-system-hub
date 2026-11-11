// 24 h rate curves (sparklines) behind the network rates, from the recorder statistics.
import assert from "node:assert/strict";
import { test } from "node:test";
import { devices, entities, states } from "./mock-states.mjs";
import { load } from "./load.mjs";

const lib = load();
const tick = () => new Promise((r) => setTimeout(r, 0));
const hassWith = (calls) => ({
  states,
  entities,
  devices,
  language: "en",
  config: { version: "2026.10.2" },
  callWS: async (msg) => {
    calls.push(msg);
    const end = Date.parse(msg.start_time) + 864e5;
    return Object.fromEntries(msg.statistic_ids.map((id) => [id, [10, 40, 20].map((mean, i) => ({ start: end - (3 - i) * 300000, mean }))]));
  },
});
const card = (Cls, hass, config = {}) => {
  const el = new Cls();
  el._hass = hass;
  el._config = config;
  el._update = () => {
    el.html = el._render();
  };
  return el;
};

test("rate tiles: 24 h sparkline from the recorder statistics, refreshed every 5 minutes, off with show_history: false", async () => {
  const calls = [];
  const el = card(lib.SystemMonitorCard, hassWith(calls));
  el._update();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].type, "recorder/statistics_during_period");
  assert.equal(calls[0].period, "5minute");
  assert.deepEqual([...calls[0].types], ["mean"]);
  // One query: the CPU and RAM percentages, then the rates.
  const ids = calls[0].statistic_ids;
  assert.deepEqual([...ids.slice(0, 2)], ["sensor.system_monitor_processor_use", "sensor.system_monitor_memory_usage"]);
  assert.ok(ids.length >= 4);
  assert.ok(ids.slice(2).every((id) => /network_throughput_(in|out)_/.test(id)), ids.join());
  assert.ok(Math.abs(Date.now() - 864e5 - Date.parse(calls[0].start_time)) < 5000);
  assert.doesNotMatch(el.html, /class="spark"/);
  await tick();
  assert.match(el.html, /<div class="tile clickable down"[^>]*><svg class="spark"/);
  assert.match(el.html, /<div class="tile clickable up"[^>]*><svg class="spark"/);
  el._update();
  assert.equal(calls.length, 1, "no new query within 5 minutes");
  el._histAt -= 5 * 60000 + 1;
  el._update();
  assert.equal(calls.length, 2);

  const offCalls = [];
  const off = card(lib.SystemMonitorCard, hassWith(offCalls), { show_history: false });
  off._update();
  await tick();
  assert.doesNotMatch(off.html, /class="spark"/);
  assert.equal(offCalls.length, 0);
});

test("rate tiles: no curve and a retry after a minute when the recorder has no statistics", async () => {
  const hass = hassWith([]);
  let n = 0;
  hass.callWS = async () => {
    n++;
    throw new Error("no statistics");
  };
  const el = card(lib.SystemMonitorCard, hass);
  el._update();
  await tick();
  assert.equal(n, 1);
  assert.doesNotMatch(el._render(), /class="spark"/);
  el._histAt -= 60000 + 1;
  el._update();
  assert.equal(n, 2);
});

test("mini card: the rates show as tiles with the same 24 h curves above the footer", async () => {
  const calls = [];
  const el = card(lib.SystemMonitorMiniCard, hassWith(calls));
  el._update();
  assert.equal(calls.length, 1);
  assert.deepEqual([...calls[0].statistic_ids.slice(0, 2)], ["sensor.system_monitor_processor_use", "sensor.system_monitor_memory_usage"]);
  assert.equal(calls[0].statistic_ids.length, 4);
  await tick();
  assert.match(el.html, /<div class="tile clickable down"[^>]*><svg class="spark"/);
  assert.match(el.html, /<div class="tile clickable up"[^>]*><svg class="spark"/);
  assert.doesNotMatch(el.html, /<span class="rates">/);
  el._update();
  assert.equal(calls.length, 1, "no new query within 5 minutes");
  // Without the curves, the rates stay in the footer.
  el._config = { show_history: false };
  const off = el._render();
  assert.doesNotMatch(off, /class="spark"/);
  assert.match(off, /<span class="rates">/);
});

test("editors: show_history among the toggles of both cards", () => {
  assert.ok(lib.SystemMonitorCardEditor.toggles.includes("show_history"));
  assert.ok(lib.SystemMonitorMiniCardEditor.toggles.includes("show_history"));
  for (const [code, s] of Object.entries(lib.STRINGS)) assert.ok(s.show_history, code);
  assert.doesNotMatch(lib.STRINGS.sr.show_history, /[A-Za-z]/);
});

test("sparkline: real time axis, a break where the recorder has no data, ISO start times too", async () => {
  const hass = hassWith([]);
  // Two runs (the first two hours, the last hour) with a 21 h gap; a lone point in the gap; ISO dates for the last run.
  hass.callWS = async (msg) => {
    const end = Date.parse(msg.start_time) + 864e5;
    return Object.fromEntries(
      msg.statistic_ids.map((id) => [
        id,
        [
          ...Array.from({ length: 24 }, (_, i) => ({ start: end - 864e5 + i * 300000, mean: 10 })),
          { start: end - 864e5 / 2, mean: 50 },
          ...Array.from({ length: 12 }, (_, i) => ({ start: new Date(end - (12 - i) * 300000).toISOString(), mean: 20 })),
        ],
      ])
    );
  };
  const el = card(lib.SystemMonitorCard, hass, { show_system: false });
  el._update();
  await tick();
  const line = el.html.match(/class="spark-l" d="([^"]+)"/)[1];
  const segments = line.split("M").filter(Boolean);
  assert.equal(segments.length, 2, line);
  const xs = (seg) => seg.split("L").map((p) => Number(p.split(",")[0]));
  // First run: from the start of the window to ~2 h (115 minutes / 24 h ≈ 7.99 %), not spread over the width.
  assert.ok(xs(segments[0])[0] < 0.1, segments[0]);
  assert.ok(Math.abs(xs(segments[0]).at(-1) - 7.99) < 0.1, segments[0]);
  // Last run: the last hour, ending 5 minutes before the end of the window.
  assert.ok(Math.abs(xs(segments[1])[0] - 95.83) < 0.1, segments[1]);
  assert.ok(Math.abs(xs(segments[1]).at(-1) - 99.65) < 0.1, segments[1]);
  // The lone point in the middle is not drawn, nor counted in the peak (y of 20 ≈ 2, the top).
  assert.doesNotMatch(line, /\b50\.\d+,/);
  assert.ok(Math.abs(Number(segments[1].split("L")[0].split(",")[1]) - 2) < 0.01, segments[1]);
  // The area closes each run down to the axis on its own.
  const area = el.html.match(/class="spark-a" d="([^"]+)"/)[1];
  assert.equal((area.match(/Z/g) || []).length, 2, area);
});

test("sparkline: nothing without two consecutive points", async () => {
  const end = Date.now();
  const hass = hassWith([]);
  hass.callWS = async (msg) =>
    Object.fromEntries(msg.statistic_ids.map((id) => [id, [0, 1, 2].map((k) => ({ start: end - 864e5 + k * 864e5 * 0.3, mean: 5 }))]));
  const el = card(lib.SystemMonitorMiniCard, hass);
  el._update();
  await tick();
  assert.doesNotMatch(el.html, /class="spark"/);
});

test("CPU and RAM: 24 h curve behind the gauges and the mini card's bars, on a 0-100 % scale", async () => {
  const calls = [];
  const full = card(lib.SystemMonitorCard, hassWith(calls));
  full._update();
  await tick();
  assert.equal(calls.length, 1, "one query for the gauges and the rates");
  assert.match(full.html, /<div class="gauge clickable [^"]*" data-entity="sensor\.system_monitor_processor_use"[^>]*><svg class="spark"/);
  assert.match(full.html, /<div class="gauge clickable [^"]*" data-entity="sensor\.system_monitor_memory_usage"[^>]*><svg class="spark"/);
  // Disk and temperature: no curve.
  assert.doesNotMatch(full.html, /data-entity="sensor\.system_monitor_processor_temperature"[^>]*><svg class="spark"/);
  // 40 % on a 0-100 scale: y = 30 - 0.4 * 28 = 18.8 (not the top, as it would be scaled to the series' peak).
  const cpu = full.html.match(/data-entity="sensor\.system_monitor_processor_use"[^>]*><svg class="spark"[\s\S]*?class="spark-l" d="([^"]+)"/)[1];
  assert.match(cpu, /,18\.80/);

  const mcalls = [];
  const mini = card(lib.SystemMonitorMiniCard, hassWith(mcalls));
  mini._update();
  await tick();
  assert.equal(mcalls.length, 1);
  assert.match(mini.html, /<div class="metric clickable [^"]*" data-entity="sensor\.system_monitor_processor_use"[^>]*><svg class="spark"/);
  assert.match(mini.html, /<div class="metric clickable [^"]*" data-entity="sensor\.system_monitor_memory_usage"[^>]*><svg class="spark"/);

  const off = card(lib.SystemMonitorMiniCard, hassWith([]), { show_history: false });
  off._update();
  await tick();
  assert.doesNotMatch(off.html, /class="spark"/);
});

test("sparkline: a fixed scale clamps the values above it", () => {
  const end = Date.now();
  const d = lib.spark([[end - 600000, 150], [end - 300000, 50]], end, 100).match(/class="spark-l" d="([^"]+)"/)[1];
  assert.match(d, /,2\.00L/);
  assert.match(d, /,16\.00$/);
});
