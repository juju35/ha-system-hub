// Unit tests for the sidebar panel: the panel file is evaluated with stubs, no browser needed.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../custom_components/system_hub/frontend/system-hub-panel.js', import.meta.url), 'utf8');
const en = JSON.parse(readFileSync(new URL('../custom_components/system_hub/translations/en.json', import.meta.url), 'utf8'));
const context = {
  HTMLElement: class {
    attachShadow() {
      this.shadowRoot = { querySelector: () => null };
      return this.shadowRoot;
    }
  },
  customElements: { get: () => undefined, define() {} },
  document: { hidden: false },
  setInterval: () => 0,
  clearInterval() {},
  setTimeout: () => 0,
};
vm.createContext(context);
vm.runInContext(`${source}\nthis.panel = { SystemHubPanel, shBytes, shTone, shSpark, shEsc };`, context);
const { SystemHubPanel, shBytes, shTone, shSpark, shEsc } = context.panel;

// The strings as Home Assistant's localize returns them from the integration's English translations
function localize(key, vars = {}) {
  const path = key.replace('component.system_hub.', '').split('.');
  let value = en;
  for (const part of path) value = value?.[part];
  if (typeof value !== 'string') return '';
  return value.replace(/\{(\w+)\}/g, (_m, name) => String(vars[name] ?? `{${name}}`));
}

function panel(state, tab) {
  const p = new SystemHubPanel();
  p._hass = { language: 'en', localize };
  p._localize = localize;
  p._state = state;
  if (tab) p._tab = tab;
  return p;
}

test('helpers: sizes in base 1024, tones, escaping, sparkline', () => {
  assert.equal(shBytes(512), '512 B');
  assert.equal(shBytes(1536), '1.50 KiB');
  assert.equal(shBytes(250 * 1024 * 1024), '250 MiB');
  assert.equal(shBytes(null), '—');
  assert.equal(shTone(10), 'good');
  assert.equal(shTone(75), 'warn');
  assert.equal(shTone(95), 'bad');
  assert.equal(shTone(null), '');
  assert.equal(shEsc('<a href="x">'), '&#60;a href=&#34;x&#34;&#62;');
  assert.equal(shSpark([5]), '');
  assert.match(shSpark([0, 50, 100]), /<polyline points="0.0,30.0 50.0,15.0 100.0,0.0"\/>/);
});

test('every string the panel uses is in the translations', () => {
  const keys = new Set([...source.matchAll(/_t\('(\w+)'/g)].map((m) => m[1]));
  const options = en.selector.panel.options;
  for (const key of keys) assert.ok(options[key], `selector.panel.options.${key}`);
  for (const key of ['core', 'supervisor', 'addon']) assert.ok(options[key], key);
});

test('tabs: System, the modules turned on in the order chosen, Settings last', () => {
  const p = panel({ loaded: true, modules: ['batteries', 'watchdog'], tabs: ['batteries', 'system', 'containers', 'watchdog'] });
  assert.deepEqual([...p._tabs()], ['batteries', 'system', 'watchdog', 'settings']);
  assert.deepEqual([...panel({ loaded: false })._tabs()], ['system', 'settings']);
});

test('system tab: rings, history charts and their periods, or how to add System Monitor', async () => {
  const state = {
    loaded: true,
    modules: [],
    tabs: ['system'],
    system: [
      { key: 'processor_use', entity_id: 'sensor.cpu', name: 'CPU', state: '95', unit: '%' },
      { key: 'memory_use_percent', entity_id: 'sensor.ram', name: 'RAM', state: '40', unit: '%' },
      { key: 'disk_use_percent', entity_id: 'sensor.disk', name: 'Disk usage /', state: '40', unit: '%' },
      { key: 'throughput_network_in', entity_id: 'sensor.rx', name: 'Network in eth0', state: '1.5', unit: 'MB/s' },
    ],
  };
  const p = panel(state);
  const calls = [];
  const now = Date.now() / 1000;
  p._hass.callWS = async (msg) => {
    calls.push(msg);
    return Object.fromEntries(msg.entity_ids.map((id) => [id, [{ s: '10', lu: now - 3600 }, { s: '30', lu: now - 60 }]]));
  };
  let html = p._content();
  assert.match(html, /class="ring link" data-more="sensor.cpu"/);
  assert.match(html, /<b>95<\/b><span>%<\/span>/);
  assert.match(html, /CPU, RAM and temperature/);
  assert.match(html, /data-action="period" data-chart="system" data-hours="24" aria-pressed="true"/);
  assert.match(html, /Loading/);
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls[0].type, 'history/history_during_period');
  html = p._content();
  assert.match(html, /<polyline points="[^"]+" stroke="#03a9f4"\/>/);
  assert.match(html, /Network/);
  assert.match(html, /Disk usage/);
  assert.match(panel({ loaded: true, modules: [], tabs: ['system'], system: [] })._content(), /domain=systemmonitor/);
});

test('containers tab: the down ones first, monitoring only (no restart button)', () => {
  const html = panel(
    {
      loaded: true,
      modules: ['containers'],
      tabs: ['containers'],
      containers: {
        last_update: '2026-11-10T20:00:00+00:00',
        containers: [
          { slug: 'homeassistant', name: 'Home Assistant Core', kind: 'core', state: 'started', cpu_percent: 12, memory_percent: 30, memory_usage: 300 * 1048576, version: '2026.11.0' },
          { slug: 'mosquitto', name: 'Mosquitto <broker>', kind: 'addon', state: 'stopped', down: true, update_available: true, version_latest: '7.0' },
        ],
        history: { homeassistant: [['t1', 10, 30], ['t2', 20, 31]] },
      },
    },
    'containers',
  )._content();
  assert.ok(html.indexOf('Mosquitto &#60;broker&#62;') < html.indexOf('Home Assistant Core'));
  assert.match(html, /Update 7\.0/);
  assert.match(html, /300 MiB/);
  assert.match(html, /<polyline/);
  assert.doesNotMatch(html, /restart/i);
  assert.match(html, /data-action="containers_refresh"/);
});

test('watchdog tab: try again on each unavailable integration', () => {
  const html = panel(
    {
      loaded: true,
      modules: ['watchdog'],
      tabs: ['watchdog'],
      watchdog: { unavailable: [{ entry_id: 'abc', title: 'Hue', domain: 'hue', gave_up: true, since: null }], history: [], reloads: 2 },
    },
    'watchdog',
  )._content();
  assert.match(html, /data-action="watchdog_reset:abc"/);
  assert.match(html, /Given up/);
  assert.match(html, /Check now/);
});

test('marketplace tab: update all asks first', () => {
  const p = panel({ loaded: true, modules: ['marketplace'], tabs: ['marketplace'], marketplace: { state: 'idle', updates: 1, pending: ['juju35/ha-parcel'] } }, 'marketplace');
  assert.match(p._content(), /data-action="confirm_install"/);
  assert.doesNotMatch(p._content(), /data-action="marketplace_install_updates"/);
  p._confirm = 'install';
  assert.match(p._content(), /data-action="marketplace_install_updates"/);
});

test('batteries tab: lowest first, unavailable on top', () => {
  const html = panel(
    {
      loaded: true,
      modules: ['batteries'],
      tabs: ['batteries'],
      batteries: {
        threshold: 20,
        low: 1,
        batteries: [
          { entity_id: 'sensor.a', name: 'Lock', level: 80 },
          { entity_id: 'sensor.b', name: 'Door', level: 8, low: true, alert: true },
          { entity_id: 'sensor.c', name: 'Smoke', level: null, unavailable: true, alert: true },
        ],
      },
    },
    'batteries',
  )._content();
  assert.ok(html.indexOf('Smoke') < html.indexOf('Door') && html.indexOf('Door') < html.indexOf('Lock'));
  assert.match(html, /Notify now/);
});

test('batteries tab: by room, by battery type, by replacement date', () => {
  const state = {
    loaded: true,
    modules: ['batteries'],
    tabs: ['batteries'],
    batteries: {
      threshold: 20,
      batteries: [
        { entity_id: 'sensor.a', name: 'Door', area: 'Entrance', level: 8, low: true, battery_type: 'CR2032' },
        { entity_id: 'sensor.b', name: 'Remote', area: 'Kitchen', level: 40, battery_type: '2× AAA', days_left: 20, drain_per_day: 1 },
        { entity_id: 'sensor.c', name: 'Window', area: 'Kitchen', level: 70, battery_type: 'CR2032', days_left: 120 },
        { entity_id: 'sensor.d', name: 'Lamp', level: 90 },
      ],
    },
  };
  const p = panel(state, 'batteries');
  const names = (view) => JSON.parse(JSON.stringify(p._battGroups(state.batteries.batteries, view).map((g) => [g.name, g.items.map((x) => x.b.name)])));
  assert.deepEqual(names('level'), [['', ['Door', 'Remote', 'Window', 'Lamp']]]);
  assert.deepEqual(names('room'), [
    ['Entrance', ['Door']],
    ['Kitchen', ['Remote', 'Window']],
    ['No room', ['Lamp']],
  ]);
  assert.deepEqual(names('type'), [
    ['CR2032', ['Door', 'Window']],
    ['AAA', ['Remote']],
    ['Unknown type', ['Lamp']],
  ]);
  assert.deepEqual(names('forecast'), [
    ['To replace now', ['Door']],
    ['Within 30 days', ['Remote']],
    ['Later', ['Window']],
    ['No forecast yet', ['Lamp']],
  ]);
  p._battView = 'type';
  const html = p._content();
  assert.match(html, /data-view="type" aria-pressed="true"/);
  assert.match(html, /By replacement date/);
});

test('git sync tab: the diff viewer opens on the changes', () => {
  const html = panel(
    { loaded: true, modules: ['git_sync'], tabs: ['git_sync'], git_sync: { status: 'dirty', branch: 'main', changed: 2, files: [] } },
    'git_sync',
  )._content();
  assert.match(html, /data-action="git_sync_diff"[^>]*>\s*<ha-icon icon="mdi:file-compare"><\/ha-icon>View changes/);
  const clean = panel(
    { loaded: true, modules: ['git_sync'], tabs: ['git_sync'], git_sync: { status: 'clean', branch: 'main', changed: 0, ahead: 0, files: [] } },
    'git_sync',
  )._content();
  assert.match(clean, /data-action="git_sync_diff" disabled/);
});

test('git sync tab: commit form, or the repository to set up', () => {
  const html = panel(
    {
      loaded: true,
      modules: ['git_sync'],
      tabs: ['git_sync'],
      git_sync: { status: 'dirty', branch: 'main', changed: 1, files: ['automations.yaml'], ahead: 1, behind: 0, ai_task: 'ai_task.x' },
    },
    'git_sync',
  )._content();
  assert.match(html, /automations\.yaml/);
  assert.match(html, /data-action="git_sync_generate_message"/);
  assert.match(html, /1 to push/);
  assert.match(panel({ loaded: true, modules: ['git_sync'], tabs: ['git_sync'] }, 'git_sync')._content(), /repository/);
});

test('settings tab: every module with its switch, the tabs to order', () => {
  const html = panel({ loaded: true, modules: ['watchdog'], tabs: ['system', 'watchdog'] }, 'settings')._content();
  for (const m of ['containers', 'watchdog', 'marketplace', 'batteries', 'git_sync']) assert.match(html, new RegExp(`data-module="${m}"`));
  assert.match(html, /data-module="watchdog" checked/);
  assert.match(html, /data-tab-move="system" data-dir="-1"[^>]*disabled/);
  assert.match(html, /data-action="save" disabled/);
});
