// Unit tests for the sidebar panel: the panel file is evaluated with stubs, no browser needed.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../custom_components/system_hub/frontend/system-hub-panel.js', import.meta.url), 'utf8');
const en = JSON.parse(readFileSync(new URL('../custom_components/system_hub/translations/en.json', import.meta.url), 'utf8'));
const context = {
  HTMLElement: class {
    // The events the panel sends (hass-notification: its toasts)
    dispatchEvent(ev) {
      this.events = [...(this.events || []), ev];
    }
    attachShadow() {
      this.shadowRoot = { querySelector: () => null };
      return this.shadowRoot;
    }
  },
  customElements: { get: () => undefined, define() {} },
  CustomEvent: class {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail;
    }
  },
  document: { hidden: false },
  setInterval: () => 0,
  clearInterval() {},
  setTimeout: () => 0,
  clearTimeout() {},
};
vm.createContext(context);
vm.runInContext(`${source}\nthis.panel = { SystemHubPanel, shBytes, shTone, shSpark, shEsc, shErr };`, context);
const { SystemHubPanel, shBytes, shTone, shSpark, shEsc, shErr } = context.panel;

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
  // The tab shown: the System tab unless a test picks another (the panel opens on the first tab)
  p._tab = tab || 'system';
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

test('batteries tab: what to replace, and the fine batteries hidden when asked', () => {
  const state = {
    loaded: true,
    modules: ['batteries'],
    tabs: ['batteries'],
    batteries: {
      threshold: 20,
      hide_ok: true,
      batteries: [
        { entity_id: 'sensor.a', name: 'Door', level: 8, low: true, battery_type: '2× AA' },
        { entity_id: 'sensor.b', name: 'Smoke', level: null, unavailable: true },
        { entity_id: 'sensor.c', name: 'Lamp', level: 90, battery_type: 'CR2032', days_left: 40, replace_by: '2026-12-20T00:00:00+01:00' },
      ],
    },
  };
  const html = panel(state, 'batteries')._content();
  assert.match(html, /<b>2×<\/b> AA/);
  assert.match(html, /<b>1×<\/b> Unknown type/);
  assert.match(html, /Next replacement/);
  assert.match(html, /Door/);
  assert.doesNotMatch(html, /class="brow[^"]*" data-more="sensor.c"/);
  state.batteries.hide_ok = false;
  assert.match(panel(state, 'batteries')._content(), /class="brow ok" data-more="sensor.c"/);
});

test('system tab: swap from its use and free, uptime, IP address, database, backups, processes', () => {
  const now = Date.now();
  const html = panel({
    loaded: true,
    modules: [],
    tabs: ['system'],
    system: [
      { key: 'swap_use', entity_id: 'sensor.su', name: 'Swap use', state: '256', unit: 'MiB' },
      { key: 'swap_free', entity_id: 'sensor.sf', name: 'Swap free', state: '768', unit: 'MiB' },
      { key: 'last_boot', entity_id: 'sensor.boot', name: 'Last boot', state: new Date(now - (2 * 24 + 3) * 3600000).toISOString() },
      { key: 'ipv4_address', entity_id: 'sensor.ip', name: 'IPv4 address eth0', state: '192.168.1.2' },
      { key: 'database_size', entity_id: 'sensor.db', name: 'DB size', state: '612.4', unit: 'MB' },
      { key: 'backup_last_successful_automatic_backup', entity_id: 'sensor.ok', name: 'Last ok', state: new Date(now - 10 * 86400000).toISOString() },
      { key: 'process', entity_id: 'binary_sensor.p1', name: 'System Monitor Process frigate', state: 'off' },
      { key: 'process', entity_id: 'binary_sensor.p2', name: 'System Monitor Process mosquitto', state: 'on' },
    ],
  })._content();
  assert.match(html, /<b>25<\/b>%/);
  assert.match(html, /<b>2<\/b>d <b>3<\/b>h/);
  assert.match(html, /192\.168\.1\.2/);
  assert.match(html, /<b>612<\/b>MB/);
  assert.match(html, /tile bad link" data-more="sensor.ok"/);
  assert.ok(html.indexOf('frigate') < html.indexOf('mosquitto'));
  assert.match(html, /1 Stopped/);
});

test('watchdog tab: the power cycles, and the rooms of the batteries with their own icons', () => {
  const html = panel(
    {
      loaded: true,
      modules: ['watchdog', 'batteries'],
      tabs: ['watchdog'],
      watchdog: {
        max_reloads: 3,
        unavailable: [],
        history: [],
        power_cycles: [
          { device_id: 'd1', device_name: 'Hub', area: 'Hall', switch: 'switch.p', switch_name: 'Hub plug', switch_state: 'off', delay: 20, off_time: 10, unavailable: true, count: 1 },
        ],
      },
    },
    'watchdog',
  )._content();
  assert.match(html, /Power cycles/);
  assert.match(html, /Hub plug · unavailable for 20 min · off for 10 s · power cycles: 1\/3/);
  assert.match(html, /Plug off: left alone/);
  assert.match(html, /href="\/config\/devices\/device\/d1"/);
  const p = panel({ loaded: true, modules: ['batteries'], tabs: ['batteries'], batteries: { batteries: [] } }, 'batteries');
  p._hass.areas = { k: { name: 'Kitchen', icon: 'mdi:fridge-outline' }, b: { name: 'Bath' } };
  assert.equal(p._areaIcon('Kitchen'), 'mdi:fridge-outline');
  assert.equal(p._areaIcon('Bath'), 'mdi:door-open');
  assert.equal(p._areaIcon(''), 'mdi:home-outline');
});

test('updates tab: Home Assistant, the add-ons and the devices before the Marketplace, each installed once asked', async () => {
  const state = {
    loaded: true,
    modules: ['marketplace'],
    tabs: ['marketplace'],
    marketplace: { state: 'idle', list: [], backup_before_install: true },
    system_updates: {
      available: [
        { entity_id: 'update.core', kind: 'core', title: 'Home Assistant Core', installed: '2026.11.1', latest: '2026.11.2', release_summary: 'Fixes', backup: true },
        { entity_id: 'update.mosquitto', kind: 'addon', title: 'Mosquitto broker', installed: '6.5.1', latest: '6.5.2', backup: true },
        { entity_id: 'update.lamp', kind: 'device', title: 'Lamp', installed: '1.0.21', latest: '1.0.24', backup: false },
      ],
      up_to_date: { system: 1, addon: 10, device: 23 },
    },
  };
  const p = panel(state, 'marketplace');
  const html = p._content();
  const sections = [...html.matchAll(/<h2 class="stsec">([^<]+)<\/h2>/g)].map((m) => m[1]);
  assert.deepEqual(sections, ['Home Assistant', 'Add-ons', 'Devices and services', 'Marketplace']);
  assert.match(html, /Available: 3 · Up to date: Home Assistant 1, add-ons 10, devices and services 23/);
  assert.match(html, /Restarts Home Assistant/);
  // The backup chosen in the Updates settings, switched here
  assert.match(html, /data-action="upd_backup" aria-pressed="true"/);
  // Install asks first, then calls update.install with the backup where the update can make one
  const calls = [];
  p._hass.callService = async (domain, service, data) => calls.push([domain, service, data]);
  p._hass.callWS = async () => state;
  p._render = () => {};
  const click = (action, dataset) => p._onClick({ target: { closest: (sel) => (sel === '[data-action]' ? { dataset: { action, ...dataset } } : null) } });
  click('upd_confirm', { entity: 'update.core' });
  const asked = p._content();
  assert.match(asked, /Install Home Assistant Core 2026.11.2\?/);
  assert.match(asked, /data-action="upd_install" data-entity="update.core" data-backup="1"/);
  await click('upd_install', { entity: 'update.core', backup: '1' });
  assert.equal(JSON.stringify(calls), JSON.stringify([['update', 'install', { entity_id: 'update.core', backup: true }]]));
  // Status: every update counted
  assert.equal(p._stArea('marketplace')[1], '3 available');
});

test('updates tab: Update all, the Marketplace first and Home Assistant itself last, asked first', async () => {
  const sys = (entity_id, kind, backup = true) => ({ entity_id, kind, title: entity_id, installed: '1', latest: '2', backup });
  const state = {
    loaded: true,
    modules: ['marketplace'],
    tabs: ['marketplace'],
    marketplace: { state: 'idle', list: [{ entity_id: 'update.mushroom', title: 'Mushroom' }], backup_before_install: false },
    system_updates: {
      available: [sys('update.core', 'core'), sys('update.os', 'os'), sys('update.sup', 'supervisor'), sys('update.mqtt', 'addon'), sys('update.plug', 'device', false)],
      up_to_date: {},
    },
  };
  const p = panel(state, 'marketplace');
  // OS left out while Core waits: two restarts
  assert.match(p._content(), /data-action="upd_all_confirm"[^>]*>[\s\S]*?Update all \(5\)/);
  p._render = () => {};
  const click = (action) => p._onClick({ target: { closest: (sel) => (sel === '[data-action]' ? { dataset: { action } } : null) } });
  click('upd_all_confirm');
  assert.match(p._content(), /Install the 5 updates one after the other\? Home Assistant restarts at the end\. Home Assistant OS is left for afterwards/);
  const calls = [];
  p._hass.callService = async (domain, service, data) => calls.push(`${domain}.${service} ${data.entity_id}${data.wait ? ' wait' : ''}`);
  p._hass.callWS = async () => state;
  await click('upd_all');
  assert.equal(
    JSON.stringify(calls),
    JSON.stringify([
      'system_hub.marketplace_install_updates update.mushroom wait',
      'update.install update.mqtt',
      'update.install update.plug',
      'update.install update.sup',
      'update.install update.core',
    ]),
  );
});

test('marketplace tab: the progress of a check running', () => {
  const started = new Date(Date.now() - 40000).toISOString();
  const html = panel(
    { loaded: true, modules: ['marketplace'], tabs: ['marketplace'], marketplace: { state: 'running', done: 10, total: 40, failed: ['X'], started_at: started } },
    'marketplace',
  )._content();
  assert.match(html, /role="progressbar"[^>]*aria-valuenow="10"/);
  assert.match(html, /25 %/);
  assert.match(html, /10 of 40 checked/);
  assert.match(html, /≈ 2 min left/);
  assert.match(html, /1 failed/);
  const reading = panel({ loaded: true, modules: ['marketplace'], tabs: ['marketplace'], marketplace: { state: 'running', done: 0, total: 0 } }, 'marketplace')._content();
  assert.match(reading, /class="pbar busy"/);
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
  for (const m of ['containers', 'watchdog', 'marketplace', 'batteries', 'git_sync', 'automations']) assert.match(html, new RegExp(`data-module="${m}"`));
  assert.match(html, /data-module="watchdog" checked/);
  // One section per group with ↑ ↓; in each, its modules turned on, then the ones turned off; the first one opened by
  // default; no handle where there is nothing to order
  assert.match(html, /System<\/span><button class="icon-btn" data-action="cfg_group" data-group="system" data-dir="-1" disabled/);
  assert.match(html, /<div class="cfglist" data-group="system"><div class="row cfgrow" data-row-tab="system"><span class="cfgpad">/);
  assert.match(html, /data-row-tab="system">.*?<span class="pill cfgdef">default/s);
  assert.match(html, /data-row-tab="system">.*?<div class="cfglist off"><div class="row cfgrow off" data-row-tab="containers"/s);
  assert.match(html, /Reliability<\/span>.*?data-row-tab="watchdog".*?Devices<\/span>/s);
  assert.doesNotMatch(html, /data-module="status"|data-module="system" checked/);
  // A group moved with ↑: its modules side by side, before the group above it
  const q = panel({ loaded: true, modules: ['watchdog', 'automations'], tabs: ['system', 'watchdog'] }, 'settings');
  q._render = () => {};
  q._cfgMoveGroup('reliability', -1);
  assert.deepEqual([...q._draft.tabs.slice(0, 4)], ['watchdog', 'automations', 'system', 'containers']);
  // A row dragged, or moved with ↓ from its handle: the order inside its group
  q._cfgMove('automations', 0);
  assert.deepEqual([...q._draft.tabs.slice(0, 3)], ['automations', 'watchdog', 'system']);
  q._cfgDragKey({ key: 'ArrowDown', preventDefault() {}, target: { closest: () => ({ dataset: { tab: 'automations' } }) } });
  assert.deepEqual([...q._draft.tabs.slice(0, 3)], ['watchdog', 'automations', 'system']);
  // Nothing changed: no save bar; a change brings it, with Discard
  assert.doesNotMatch(html, /data-action="save"/);
  const p = panel({ loaded: true, modules: ['watchdog'], tabs: ['system', 'watchdog'] }, 'settings');
  p._draft.tabs = ['watchdog', 'system'];
  const changed = p._content();
  assert.match(changed, /class="savebar"/);
  assert.match(changed, /Unsaved changes/);
  assert.match(changed, /data-action="save">/);
  assert.match(changed, /data-action="discard"/);
});

test('automations tab: failures and unavailable linked entities from Automation Monitor, or how to add it', () => {
  const failures = Array.from({ length: 7 }, (_v, i) => ({
    entity_id: `automation.a${i}`,
    name: `Automation ${i}`,
    last_error_time: '2026-11-10T08:00:00+00:00',
    error_message: i ? null : 'Entity <light.hall> is unavailable',
    error_step: i ? null : 'action/0',
    consecutive_failures: i ? 1 : 3,
    trace: i ? null : '/config/automation/trace/1',
    edit: '/config/automation/edit/1',
  }));
  const state = {
    loaded: true,
    modules: ['automations'],
    tabs: ['system', 'automations'],
    automations: {
      available: true,
      failed_entity: 'sensor.failed_automations',
      linked_entity: 'sensor.linked_entities_unavailable',
      failed_na: false,
      linked_na: true,
      automations: 12,
      failures,
      linked: [{ entity_id: 'light.hall', name: 'Hall', unavailable_since: null, used_by: [{ entity_id: 'script.x', name: 'X', edit: '/config/script/edit/x' }] }],
    },
  };
  const p = panel(state, 'automations');
  assert.deepEqual([...p._tabs()], ['system', 'automations', 'settings']);
  const html = p._content();
  assert.match(html, /Failed automations/);
  assert.match(html, /&#60;light.hall&#62;/);
  assert.match(html, /action\/0/);
  assert.match(html, /3 failures in a row/);
  assert.match(html, /href="\/config\/automation\/trace\/1"/);
  assert.match(html, /data-action="auto_clear_all"/);
  assert.match(html, /data-action="auto_rebuild"/);
  // 5 shown, then "Show 2 more"; the unreadable sensor is a dash, not 0
  assert.equal((html.match(/data-action="auto_clear" /g) || []).length, 5);
  assert.match(html, /Show 2 more/);
  assert.match(html, /<b>—<\/b>/);
  assert.match(html, /Used by/);
  p._render = () => {};
  p._autoAction('auto_more:failed', {});
  assert.equal((p._content().match(/data-action="auto_clear" /g) || []).length, 7);
  p._autoAction('auto_fold:failed', {});
  assert.doesNotMatch(p._content(), /data-action="auto_clear" /);

  const none = panel({ ...state, automations: { available: false, loaded: false } }, 'automations')._content();
  assert.match(none, /Automation Monitor not found/);
  assert.match(none, /href="\/config\/integrations\/dashboard\/add\?domain=automation_monitor"/);
});

test('automations tab: Clear asks first, then calls Automation Monitor', async () => {
  const calls = [];
  const p = panel(
    { loaded: true, modules: ['automations'], tabs: ['automations'], automations: { available: true, failures: [{ entity_id: 'automation.a', name: 'A' }], linked: [] } },
    'automations',
  );
  p._hass.callService = async (domain, service, data) => calls.push([domain, service, data]);
  p._hass.callWS = async () => p._state;
  p._render = () => {};
  p._autoAction('auto_clear', { dataset: { entity: 'automation.a' } });
  assert.equal(calls.length, 0);
  assert.match(p._content(), /Clear the failure of A\?/);
  await p._autoAction('auto_clear_ok', { dataset: { entity: 'automation.a' } });
  p._autoAction('auto_clear_all', { dataset: {} });
  assert.match(p._content(), /Clear all failed automations\?/);
  await p._autoAction('auto_clear_all_ok', { dataset: {} });
  await p._autoAction('auto_rebuild', { dataset: {} });
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    ['automation_monitor', 'reset', { entity_id: 'automation.a' }],
    ['automation_monitor', 'reset', {}],
    ['automation_monitor', 'rebuild_linked_entities', {}],
  ]);
  assert.equal(p._confirm, null);
});

test('system tab: Reload configuration asks first, then reloads every YAML configuration', async () => {
  const calls = [];
  const p = panel({ loaded: true, modules: [], tabs: ['system'], system: [] });
  p._hass.callService = async (domain, service, data) => calls.push([domain, service, data]);
  p._hass.callWS = async () => p._state;
  p._render = () => {};
  p._toast = () => {};
  assert.match(p._content(), /data-action="ha_ask:reload"/);
  assert.match(p._content(), /data-action="ha_ask:restart"/);
  await p._haAction('ha_ask:reload');
  assert.equal(calls.length, 0);
  assert.match(p._content(), /role="alertdialog"[\s\S]*Reload the configuration\?/);
  await p._haAction('ha_ok:reload');
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [['homeassistant', 'reload_all', {}]]);
  assert.doesNotMatch(p._content(), /role="alertdialog"/);
});

test('system tab: Restart checks the configuration first and is refused while it is invalid', async () => {
  const calls = [];
  const p = panel({ loaded: true, modules: [], tabs: ['system'], system: [] });
  p._hass.callService = async (domain, service, data) => calls.push([domain, service, data]);
  p._render = () => {};
  p._toast = () => {};
  p._hass.callApi = async () => ({ result: 'invalid', errors: "Invalid config for 'automation'" });
  await p._haAction('ha_ask:restart');
  var html = p._content();
  assert.match(html, /Restart Home Assistant\?/);
  assert.match(html, /The configuration is invalid/);
  assert.match(html, /Invalid config for &#39;automation&#39;|Invalid config for 'automation'/);
  assert.match(html, /data-action="ha_ok:restart"[^>]* disabled/);
  // Cancelled; then valid: restarts
  p._onClick({ target: { closest: (sel) => (sel === '[data-action]' ? { dataset: { action: 'cancel' } } : null) } });
  assert.equal(p._confirm, null);
  p._hass.callApi = async () => ({ result: 'valid' });
  await p._haAction('ha_ask:restart');
  assert.match(p._content(), /The configuration is valid/);
  assert.doesNotMatch(p._content(), /data-action="ha_ok:restart"[^>]* disabled/);
  await p._haAction('ha_ok:restart');
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [['homeassistant', 'restart', {}]]);
  assert.equal(p._confirm, null);
});

test('system tab: a restart that drops the connection is no failure', async () => {
  const p = panel({ loaded: true, modules: [], tabs: ['system'], system: [] });
  p._render = () => {};
  p._toast = () => {};
  p._hass.callService = async () => {
    throw { code: 3, message: 'Connection lost' };
  };
  await p._haAction('ha_ok:restart');
  assert.equal(p._messages.ha, undefined);
  p._hass.callService = async () => {
    throw new Error('Unauthorized');
  };
  await p._haAction('ha_ok:restart');
  assert.match(p._messages.ha.text, /Unauthorized/);
});

test('automations tab: Clear all with failures left out clears the listed ones only', async () => {
  const calls = [];
  const p = panel(
    {
      loaded: true,
      modules: ['automations'],
      tabs: ['automations'],
      automations: { available: true, failures: [{ entity_id: 'automation.a' }, { entity_id: 'automation.b' }], failures_hidden: 1, linked: [] },
    },
    'automations',
  );
  p._hass.callService = async (domain, service, data) => calls.push([domain, service, data]);
  p._hass.callWS = async () => p._state;
  p._render = () => {};
  p._toast = () => {};
  await p._autoAction('auto_clear_all_ok', { dataset: {} });
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    ['automation_monitor', 'reset', { entity_id: 'automation.a' }],
    ['automation_monitor', 'reset', { entity_id: 'automation.b' }],
  ]);
});

test('automations tab: its settings open from the tab', () => {
  const html = panel({ loaded: true, modules: ['automations'], tabs: ['automations'], automations: { available: true, failures: [], linked: [] } }, 'automations')._content();
  assert.match(html, /data-action="open_settings:automations"/);
});

test('git sync tab: a chip per repository, the actions on the one shown', async () => {
  const repos = [
    { id: '', title: 'config', path: '/config', status: 'clean', branch: 'main', changed: 0, files: [] },
    { id: 'ab12cd34', title: 'esphome', path: '/config/esphome', status: 'dirty', branch: 'dev', changed: 1, files: ['node.yaml'] },
  ];
  const calls = [];
  const p = panel({ loaded: true, modules: ['git_sync'], tabs: ['git_sync'], git_sync: repos[0], git_sync_repos: repos }, 'git_sync');
  p._hass.callService = async (_domain, service, data) => calls.push([service, data]);
  p._hass.callWS = async () => p._state;
  p._render = () => {};
  p._toast = () => {};
  let html = p._content();
  assert.match(html, /data-action="git_repo" data-id="ab12cd34"[^>]*>esphome</);
  assert.doesNotMatch(html, /node\.yaml/);
  const click = (action, dataset = {}) => p._onClick({ target: { closest: (sel) => (sel === '[data-action]' ? { dataset: { action, ...dataset }, disabled: false } : null) } });
  click('git_repo', { id: 'ab12cd34' });
  html = p._content();
  assert.match(html, /node\.yaml/);
  assert.match(html, /<b>dev<\/b>/);
  await click('git_sync_pull');
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [['git_sync_pull', { repository: '/config/esphome' }]]);
  // A single repository: no chip, no repository named
  const one = panel({ loaded: true, modules: ['git_sync'], tabs: ['git_sync'], git_sync: repos[0], git_sync_repos: [repos[0]] }, 'git_sync');
  assert.doesNotMatch(one._content(), /git_repo/);
  assert.equal(JSON.stringify(one._gitTarget()), '{}');
});

test('system tab: virtual interfaces left out, totals received and sent, Core and OS versions', () => {
  const html = panel({
    loaded: true,
    modules: [],
    tabs: ['system'],
    system: [
      { key: 'throughput_network_in', entity_id: 'sensor.rx_eth0', name: 'Network throughput in eth0', state: '1.5', unit: 'MB/s' },
      { key: 'throughput_network_in', entity_id: 'sensor.rx_docker0', name: 'Network throughput in docker0', state: '40', unit: 'MB/s' },
      { key: 'throughput_network_out', entity_id: 'sensor.tx_veth', name: 'Network throughput out veth1a2b', state: '30', unit: 'MB/s' },
      { key: 'throughput_network_out', entity_id: 'sensor.tx_eth0', name: 'Network throughput out eth0', state: '0.5', unit: 'MB/s' },
      { key: 'network_in', entity_id: 'sensor.in_eth0', name: 'Network in eth0', state: '1024', unit: 'MiB' },
      { key: 'network_in', entity_id: 'sensor.in_hassio', name: 'Network in hassio', state: '9999', unit: 'MiB' },
      { key: 'network_out', entity_id: 'sensor.out_eth0', name: 'Network out eth0', state: '512', unit: 'MiB' },
    ],
    updates: [
      { key: 'core', entity_id: 'update.home_assistant_core_update', state: 'on', installed: '2026.10.4', latest: '2026.11.1' },
      { key: 'os', entity_id: 'update.home_assistant_operating_system_update', state: 'off', installed: '16.3', latest: '16.3' },
    ],
  })._content();
  assert.match(html, />1\.5<\/b>\/ <b[^>]*>0\.5<\/b>MB\/s/);
  assert.match(html, /<b class="ver">1.00 GiB<\/b> <span class="more">\/ 512 MiB<\/span>/);
  assert.match(html, /Received \/ sent/);
  assert.match(html, /<a class="tilelink" href="\/config\/updates"[^>]*><ha-card class="tile warn link" title="Core 2026.10.4 · OS 16.3"/);
  assert.match(html, /<b class="ver">2026.10.4<\/b> <span class="more">OS 16.3<\/span>/);
  assert.match(html, /Update to Core 2026.11.1/);
  const fine = panel({
    loaded: true,
    modules: [],
    tabs: ['system'],
    system: [{ key: 'ipv4_address', entity_id: 'sensor.ip', name: 'IP', state: '10.0.0.2' }],
    updates: [{ key: 'core', entity_id: 'update.home_assistant_core_mise_a_jour', state: 'off', installed: '2026.11.1', latest: '2026.11.1' }],
  })._content();
  assert.match(fine, /class="tile good link"/);
  assert.match(fine, /Up to date/);
  // Without the Supervisor: the version running, no update to tell
  var bare = panel({
    loaded: true,
    modules: [],
    tabs: ['system'],
    system: [{ key: 'ipv4_address', entity_id: 'sensor.ip', name: 'IP', state: '10.0.0.2' }],
    updates: [{ key: 'core', entity_id: null, state: 'off', installed: '2026.11.1', latest: null }],
  })._content();
  assert.match(bare, /class="tile {2}link" title="Core 2026.11.1">[\s\S]*?<b class="ver">2026.11.1<\/b><\/div><div class="s">Home Assistant</);
  assert.doesNotMatch(bare, /Up to date/);
});

test('system tab: the thresholds chosen colour the rings, the swap and the disks', () => {
  const state = {
    loaded: true,
    modules: [],
    tabs: ['system'],
    system: [
      { key: 'processor_use', entity_id: 'sensor.cpu', name: 'CPU', state: '65', unit: '%' },
      { key: 'disk_use_percent', entity_id: 'sensor.disk', name: 'Disk usage /', state: '85', unit: '%' },
      { key: 'swap_use_percent', entity_id: 'sensor.swap', name: 'Swap', state: '60', unit: '%' },
    ],
  };
  let html = panel(state)._content();
  // The defaults: CPU 65 % is fine, the disk at 85 % orange, the swap at 60 % orange
  assert.match(html, /<div class="rv "><b>65<\/b>/);
  assert.match(html, /<div class="rv warn"><b>85<\/b>/);
  assert.match(html, /class="tile warn link" data-more="sensor.swap"/);
  assert.match(html, /class="item link warn" data-more="sensor.disk"/);
  state.thresholds = { cpu: [50, 60], disk: [90, 95], swap: [70, 80] };
  html = panel(state)._content();
  assert.match(html, /<div class="rv bad"><b>65<\/b>/);
  assert.match(html, /class="item link good" data-more="sensor.disk"/);
  assert.match(html, /class="tile good link" data-more="sensor.swap"/);
});

test('batteries tab: search, spares and their stock, CSV export', async () => {
  const state = {
    loaded: true,
    modules: ['batteries'],
    tabs: ['batteries'],
    batteries: {
      threshold: 20,
      batteries: [
        { entity_id: 'sensor.a', name: 'Door', area: 'Entrance', level: 8, low: true, battery_type: 'CR2032', below_since: '2026-11-01T10:00:00+00:00' },
        { entity_id: 'sensor.b', name: 'Remote, living', area: 'Kitchen', level: 40, battery_type: '2× AAA', days_left: 20, drain_per_day: 1.2, replace_by: '2026-12-01T00:00:00+01:00' },
        { entity_id: 'sensor.c', name: 'Smoke', level: null, unavailable: true },
      ],
      spares: { CR2032: { stock: 0, needed: 1, short: 1 }, AAA: { stock: 6, needed: 2, short: 0 } },
    },
  };
  const p = panel(state, 'batteries');
  let html = p._content();
  assert.match(html, /data-draft="batt_search"/);
  assert.match(html, /data-action="batt_csv"/);
  assert.match(html, /<button class="spare short" data-action="stock_edit" data-kind="CR2032"><b>0×<\/b> CR2032 · 1 to buy<\/button>/);
  assert.match(html, /<button class="spare" data-action="stock_edit" data-kind="AAA"><b>6×<\/b> AAA<\/button>/);
  // The search: by room, by type, or nothing
  p._draft.batt_search = 'kitchen';
  html = p._content();
  assert.match(html, /data-more="sensor.b"/);
  assert.doesNotMatch(html, /data-more="sensor.a"/);
  p._draft.batt_search = 'cr20';
  assert.match(p._content(), /data-more="sensor.a"/);
  p._draft.batt_search = 'nothing';
  assert.match(p._content(), /No battery matches/);
  p._draft.batt_search = '';
  // CSV: every battery, quoted where needed
  const csv = p._battCsv().split('\r\n');
  assert.equal(csv[0], 'name,area,type,level,status,drain_per_day,days_left,replace_by,below_since,entity_id');
  assert.equal(csv[1], 'Door,Entrance,CR2032,8,low,,,,2026-11-01T10:00:00+00:00,sensor.a');
  assert.equal(csv[2], '"Remote, living",Kitchen,2× AAA,40,ok,1.2,20,2026-12-01,,sensor.b');
  assert.equal(csv[3], 'Smoke,,,,unavailable,,,,,sensor.c');
  // The stock of a type: the form filled from the chip, then the service
  const calls = [];
  p._hass.callService = async (...args) => calls.push(args);
  p._hass.callWS = async () => state;
  p._render = () => {};
  const click = (dataset) => p._onClick({ target: { closest: (sel) => (sel === '[data-action]' ? { dataset } : null) } });
  click({ action: 'stock_edit', kind: 'AAA' });
  assert.equal(p._stockForm, true);
  assert.equal(p._draft.stock_type, 'AAA');
  assert.equal(p._draft.stock_count, '6');
  assert.match(p._content(), /data-draft="stock_count" type="number"[^>]*value="6"/);
  p._draft.stock_count = '4';
  await click({ action: 'set_stock' });
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [['system_hub', 'batteries_set_stock', { battery_type: 'AAA', count: 4 }]]);
  assert.equal(p._stockForm, false);
});

test('a running action spins its own button until the state is read again; done in a toast, a failure stays', async () => {
  const state = { loaded: true, modules: ['watchdog'], tabs: ['system', 'watchdog'], watchdog: { unavailable: [{ entry_id: 'e1', title: 'Plugs', domain: 'tuya', count: 1, max: 5 }] } };
  const p = panel(state, 'watchdog');
  const seen = [];
  p._render = () => seen.push(p._content());
  p._load = async () => {};
  let fail = false;
  p._hass.callService = async () => {
    if (fail) throw new Error('Nope');
  };
  await p._run('watchdog_reset', 'watchdog_reset', { entry_id: 'e1' }, null, 'system_hub', 'watchdog_reset:e1');
  // While it ran: that button spun and was disabled, the others did not
  assert.match(seen[0], /data-action="watchdog_reset:e1" disabled aria-busy="true">\s*<ha-icon class="spin" icon="mdi:loading">/);
  assert.doesNotMatch(seen[0], /data-action="watchdog_check"[^>]*aria-busy/);
  assert.doesNotMatch(seen.at(-1), /aria-busy="true"/);
  assert.equal(p.events.at(-1).type, 'hass-notification');
  assert.equal(p.events.at(-1).detail.message, 'Done');
  fail = true;
  await p._run('watchdog_check', 'watchdog_check', {});
  assert.match(p._content(), /Failed: Nope/);
});

test('times near now in words, the date beyond a week', () => {
  const p = panel({ loaded: true });
  const at = (ms) => new Date(Date.now() + ms).toISOString();
  assert.equal(p._rel(at(-5000)), 'now');
  assert.equal(p._rel(at(-5 * 60000)), '5 minutes ago');
  assert.equal(p._rel(at(3 * 3600000)), 'in 3 hours');
  assert.equal(p._rel(at(-3 * 86400000)), '3 days ago');
  assert.equal(p._rel(at(-10 * 86400000)), p._ago(at(-10 * 86400000)));
  assert.equal(p._rel(null), 'Never');
});

test('containers tab: the Docker containers with their image', () => {
  const state = {
    loaded: true,
    modules: ['containers'],
    tabs: ['system', 'containers'],
    system: [
      { key: 'processor_use', entity_id: 'sensor.cpu', name: 'CPU', state: '10', unit: '%' },
      { key: 'process', entity_id: 'binary_sensor.process_frigate', name: 'Process frigate', state: 'off', attributes: { process: 'frigate' } },
    ],
    containers: {
      containers: [
        { slug: 'dns', name: 'DNS', kind: 'plugin', state: 'started', container: 'hassio_dns', image: 'ghcr.io/home-assistant/amd64-hassio-dns:2026.10.0' },
        { slug: 'a0d7b954_vscode', name: 'Studio Code Server', kind: 'addon', state: 'started', container: 'app_a0d7b954_vscode', image: 'ghcr.io/hassio-addons/vscode:7.2.0', update_available: true, version_latest: '7.3.0' },
        { slug: 'supervisor', name: 'Supervisor', kind: 'supervisor', state: 'started', container: 'hassio_supervisor' },
      ],
      history: {},
    },
  };
  const p = panel(state, 'containers');
  const html = p._content();
  assert.ok(html.indexOf('hassio_supervisor') < html.indexOf('hassio_dns'));
  assert.ok(html.indexOf('hassio_dns') < html.indexOf('app_a0d7b954_vscode'));
  assert.match(html, /Studio Code Server · ghcr\.io\/hassio-addons\/vscode:7\.2\.0/);
  assert.match(html, /7\.3\.0/);
  // The processes are listed with the containers, no longer in the System tab
  assert.equal(p._tabName('containers'), 'Containers & process');
  assert.match(html, /Processes/);
  assert.match(html, /binary_sensor\.process_frigate/);
  p._tab = 'system';
  assert.doesNotMatch(p._content(), /binary_sensor\.process_frigate/);
});

test('marketplace tab: a card per update with the size of the change, its notes, its own Update; GitHub kept', async () => {
  const marketplace = {
    state: 'idle',
    updates: 2,
    github_connected: true,
    rate_limit_remaining: 4812,
    retry_after: new Date(Date.now() + 2 * 3600000).toISOString(),
    failed: ['someone/abandoned-card'],
    list: [
      { entity_id: 'update.mushroom', title: 'Mushroom', installed: 'v4.4.0', latest: 'v5.0.0', release_url: 'https://x/rel', release_summary: null, picture: null, installing: false },
      { entity_id: 'update.card_mod', title: 'card-mod', installed: '3.4.4', latest: '3.4.5', release_url: null, release_summary: 'Fix', picture: '/p.png', installing: true },
    ],
  };
  const p = panel({ loaded: true, modules: ['marketplace'], tabs: ['marketplace'], marketplace }, 'marketplace');
  p._hass.callWS = async () => '## v5.0.0\n\n**Breaking**: a [new editor](https://x) and <b>more</b>';
  p._render = () => {};
  let html = p._content();
  assert.match(html, /2 updates available/);
  assert.match(html, /GitHub connected · 4812 requests left/);
  assert.match(html, /limit reached, next try in 2 hours/);
  assert.match(html, /class="pill bad">major/);
  assert.match(html, /class="pill good">patch/);
  assert.match(html, /href="https:\/\/x\/rel"/);
  // card-mod is installing: its button spins
  assert.match(html, /data-action="mk_install" data-entity="update.card_mod" disabled aria-busy="true"/);
  assert.match(html, /href="https:\/\/github.com\/someone\/abandoned-card"/);
  await new Promise((r) => setImmediate(r));
  html = p._content();
  assert.match(html, /v5\.0\.0 Breaking: a new editor and more/);
  // Update on one card installs that one
  const calls = [];
  p._hass.callService = async (...args) => calls.push(args);
  p._load = async () => {};
  p._onClick({ target: { closest: (sel) => (sel === '[data-action]' ? { dataset: { action: 'mk_install', entity: 'update.mushroom' } } : null) } });
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0])), ['system_hub', 'marketplace_install_updates', { entity_id: ['update.mushroom'] }]);
});

test('settings tab: a module opens on its Configure form, driven through the options flow, and saves', async () => {
  const realGet = context.customElements.get;
  context.customElements.get = (name) => (name === 'ha-form' ? class {} : undefined);
  try {
    const state = { loaded: true, entry_id: 'E1', modules: ['watchdog', 'batteries'], tabs: ['system', 'watchdog', 'batteries'] };
    const p = panel(state, 'settings');
    p._render = () => {};
    p._load = async () => {};
    const calls = [];
    let submit = { type: 'form', step_id: 'watchdog', data_schema: [{ name: 'max_reloads', default: 5 }], errors: { max_reloads: 'too_low' } };
    p._hass.callWS = async (msg) => (msg.type === 'system_hub/options_flow' ? p._hass.callApi('POST', 'config/config_entries/options/flow', { handler: 'E1', show_advanced_options: true }) : '');
    p._hass.callApi = async (method, path, body) => {
      calls.push([method, path, body]);
      if (method === 'DELETE') return {};
      if (path === 'config/config_entries/options/flow') return { type: 'menu', flow_id: `F${calls.length}`, menu_options: ['modules', 'system', 'watchdog', 'watchdog_add_power_cycle', 'batteries'] };
      if (body?.next_step_id) {
        return { type: 'form', step_id: body.next_step_id, data_schema: [{ name: 'scan_interval', default: 10 }, { name: 'max_reloads', description: { suggested_value: 3 } }], errors: {} };
      }
      return submit;
    };
    // Every module has its row, the System thresholds too; a module turned off can't be opened
    let html = p._content();
    assert.match(html, /data-action="cfg_toggle" data-module="system"/);
    assert.match(html, /data-action="cfg_toggle" data-module="watchdog"/);
    assert.doesNotMatch(html, /data-action="cfg_toggle" data-module="containers"/);
    await p._cfgOpen('watchdog');
    assert.deepEqual(JSON.parse(JSON.stringify(calls[0])), ['POST', 'config/config_entries/options/flow', { handler: 'E1', show_advanced_options: true }]);
    assert.deepEqual(JSON.parse(JSON.stringify(calls[1])), ['POST', 'config/config_entries/options/flow/F1', { next_step_id: 'watchdog' }]);
    assert.deepEqual({ ...p._cfg.data }, { scan_interval: 10, max_reloads: 3 });
    html = p._content();
    assert.match(html, /class="cfgform" data-step="watchdog"/);
    // Its further steps that Configure offers now
    assert.match(html, /data-action="cfg_step" data-step="watchdog_add_power_cycle"/);
    assert.doesNotMatch(html, /data-step="watchdog_remove_power_cycle"/);
    // A form sent back with its errors stays open; saved: closed, in a toast
    await p._cfgSubmit();
    assert.equal(p._cfg.errors.max_reloads, 'too_low');
    assert.equal(p._cfg.step, 'watchdog');
    submit = { type: 'create_entry' };
    await p._cfgSubmit();
    assert.equal(p._cfg.module, null);
    assert.equal(p.events.at(-1).detail.message, 'Saved');
  } finally {
    context.customElements.get = realGet;
  }
});

test('marketplace tab: a brand image gets its access token; read once', async () => {
  const marketplace = { state: 'idle', updates: 1, list: [{ entity_id: 'update.system_hub', title: 'System Hub', installed: 'v0.5.1', latest: 'v0.5.2', picture: '/api/brands/integration/system_hub/icon.png' }] };
  const p = panel({ loaded: true, modules: ['marketplace'], tabs: ['marketplace'], marketplace }, 'marketplace');
  const calls = [];
  p._hass.callWS = async (msg) => {
    calls.push(msg.type);
    return msg.type === 'brands/access_token' ? { token: 'T 1' } : '';
  };
  p._render = () => {};
  assert.doesNotMatch(p._content(), /<img/);
  await new Promise((r) => setImmediate(r));
  assert.match(p._content(), /src="\/api\/brands\/integration\/system_hub\/icon\.png\?token=T%201"/);
  p._content();
  assert.equal(calls.filter((c) => c === 'brands/access_token').length, 1);
});

test('marketplace tab: the count is that of the updates waiting now, not of the last check', () => {
  const marketplace = { state: 'idle', updates: 1, list: [] };
  const html = panel({ loaded: true, modules: ['marketplace'], tabs: ['marketplace'], marketplace }, 'marketplace')._content();
  assert.doesNotMatch(html, /1 update available/);
  assert.doesNotMatch(html, /data-action="confirm_install"/);
  assert.match(html, /Everything is up to date/);
});

test('git sync tab: the count of changed files always; more than 5 folded until opened', () => {
  const files = Array.from({ length: 7 }, (_v, i) => `f${i}.yaml`);
  const state = (n) => ({ loaded: true, modules: ['git_sync'], tabs: ['git_sync'], git_sync: { available: true, branch: 'main', status: 'changes', changed: n, files: files.slice(0, n) } });
  const few = panel(state(3), 'git_sync')._content();
  assert.match(few, /<span class="muted">3<\/span>/);
  assert.match(few, /f2\.yaml/);
  const p = panel(state(7), 'git_sync');
  p._render = () => {};
  let many = p._content();
  assert.match(many, /<span class="muted">7<\/span>/);
  assert.doesNotMatch(many, /f0\.yaml/);
  assert.match(many, /data-action="git_files_fold" aria-expanded="false"/);
  p._onClick({ target: { closest: (sel) => (sel === '[data-action]' ? { dataset: { action: 'git_files_fold' } } : null) } });
  many = p._content();
  assert.match(many, /f6\.yaml/);
  assert.match(many, /aria-expanded="true"/);
});

test('groups: Status, the groups with a module turned on, Settings; the modules of a group as sub-tabs', () => {
  const state = {
    loaded: true,
    modules: ['watchdog', 'automations', 'batteries'],
    tabs: ['status', 'system', 'watchdog', 'automations', 'batteries'],
    watchdog: { unavailable: [{ title: 'Printer', gave_up: true }], max_reloads: 5 },
    automations: { available: true, failures: [], linked: [] },
    batteries: { batteries: [] },
  };
  const p = panel(state, 'automations');
  assert.deepEqual([...p._groups()], ['status', 'system', 'reliability', 'devices', 'settings']);
  assert.equal(p._groupName('reliability'), 'Reliability');
  assert.equal(p._groupName('system'), 'System');
  assert.equal(p._tabName('system'), 'Resources');
  assert.equal(p._tabName('watchdog'), 'Sentinel');
  assert.equal(p._tabName('git_sync'), 'Versioning');
  // Two modules in Reliability: sub-tabs, the one shown selected, a dot on the one needing action
  const subs = p._subtabs();
  assert.match(subs, /data-subtab="watchdog" aria-selected="false"[^>]*>.*?Sentinel<span class="subdot bad"/);
  assert.match(subs, /class="subtab active" role="tab" data-subtab="automations" aria-selected="true"/);
  // One module: no sub-tabs
  assert.equal(panel(state, 'batteries')._subtabs(), '');
  // The group's badge: one module to look at, in the colour of the worst
  assert.match(p._groupBadge('reliability'), /class="tbadge bad"[^>]*>1</);
  assert.equal(p._groupBadge('devices'), '');
  // A group chosen: the sub-tab shown last in it, else its first
  p._render = () => {};
  p._selectTab('reliability');
  assert.equal(p._tab, 'watchdog');
  p._selectTab('automations');
  p._selectTab('batteries');
  p._goGroup('reliability');
  assert.equal(p._tab, 'automations');
});

test('status tab: a score, one tile per area in the order of the tabs, each opening its tab', () => {
  const state = {
    loaded: true,
    modules: ['watchdog', 'batteries', 'git_sync', 'orphans', 'containers', 'marketplace'],
    tabs: ['status', 'batteries', 'system', 'watchdog', 'git_sync', 'containers', 'marketplace', 'orphans'],
    thresholds: { cpu: [70, 90], ram: [70, 90], disk: [80, 90], temperature: [70, 85], swap: [50, 80] },
    system: [
      { key: 'processor_use', entity_id: 'sensor.cpu', name: 'CPU', state: '14' },
      { key: 'memory_use_percent', entity_id: 'sensor.ram', name: 'RAM', state: '48' },
      { key: 'disk_use_percent', entity_id: 'sensor.disk', name: 'Disk', state: '93' },
      { key: 'process', entity_id: 'binary_sensor.process_frigate', name: 'Process frigate', state: 'off' },
    ],
    updates: [{ key: 'core', state: 'on', installed: '2026.11.0', latest: '2026.11.1' }],
    watchdog: { unavailable: [{ title: 'Printer', gave_up: true }], max_reloads: 5 },
    batteries: { low: 1, unavailable: 0, batteries: [{ name: 'Door', level: '8', low: true }] },
    git_sync: { available: true, branch: 'main', changed: 0, ahead: 0, behind: 0 },
    orphans: { total: 0, devices: 0 },
    containers: { containers: [{ name: 'Core', container: 'homeassistant', state: 'started' }] },
    marketplace: { state: 'idle', list: [{ title: 'Mushroom', latest: 'v5.0.0' }] },
  };
  const p = panel(state, 'status');
  assert.deepEqual([...p._tabs()].slice(0, 2), ['status', 'batteries']);
  const html = p._content();
  const order = [...html.matchAll(/data-action="st_open" data-tab="(\w+)"/g)].map((m) => m[1]);
  // By group, in the order of their first tab, under the group's name
  assert.deepEqual(order, ['batteries', 'orphans', 'system', 'containers', 'watchdog', 'git_sync', 'marketplace']);
  const sections = [...html.matchAll(/<h2 class="stsec">([^<]+)<\/h2>/g)].map((m) => m[1]);
  assert.deepEqual(sections, ['Devices', 'System', 'Reliability', 'Maintenance']);
  // Batteries to watch, the disk above its red threshold, a given-up integration and a process stopped: needing action
  assert.match(html, /sttile warn" data-action="st_open" data-tab="batteries"/);
  assert.match(html, /sttile bad" data-action="st_open" data-tab="system"/);
  assert.match(html, /High: Disk/);
  assert.match(html, /sttile bad" data-action="st_open" data-tab="containers"[\s\S]*?1 stopped/);
  assert.match(html, /sttile warn" data-action="st_open" data-tab="marketplace"[\s\S]*?2 available/);
  assert.match(html, /sttile good" data-action="st_open" data-tab="git_sync"/);
  // 100 − 3 × 15 − 2 × 5
  assert.match(html, /<b>45<\/b>/);
  assert.match(html, /5 points to check/);
  p._render = () => {};
  p._onClick({ target: { closest: (sel) => (sel === '[data-action]' ? { dataset: { action: 'st_open', tab: 'watchdog' } } : null) } });
  assert.equal(p._tab, 'watchdog');
});

test('load: the words of the error, and what is shown kept while the connection is lost', async () => {
  // A command cut by a lost connection: {error: {code, message}}, not [object Object]
  assert.equal(shErr({ type: 'result', success: false, error: { code: 3, message: 'Connection lost' } }), 'Connection lost');
  assert.equal(shErr({ code: 'unknown_command', message: 'Unknown command.' }), 'Unknown command.');
  assert.equal(shErr({ body: { message: 'Invalid flow' } }), 'Invalid flow');
  assert.equal(shErr(3), '3');
  const lost = async () => {
    throw { type: 'result', success: false, error: { code: 3, message: 'Connection lost' } };
  };
  // Nothing read yet: the message, in words
  const first = panel(null);
  first._hass.callWS = lost;
  first._render = () => {};
  await first._load();
  assert.equal(first._error, 'Connection lost');
  // Already shown: kept, no message
  const shown = panel({ loaded: true, modules: [], tabs: ['system'] });
  shown._hass.callWS = lost;
  let renders = 0;
  shown._render = () => renders++;
  await shown._load();
  assert.ok(!shown._error);
  assert.equal(shown._state.loaded, true);
  assert.equal(renders, 0);
});

test('tabs: none before the state is read, then the first of the configured order (Status)', () => {
  const p = panel(null);
  p._tab = null;
  assert.deepEqual([...p._tabs()], []);
  p._state = { loaded: true, modules: ['watchdog'], tabs: ['status', 'system', 'watchdog'] };
  assert.deepEqual([...p._tabs()], ['status', 'system', 'watchdog', 'settings']);
  // What _render does with no tab picked yet
  if (!p._tabs().includes(p._tab)) p._tab = p._tabs()[0];
  assert.equal(p._tab, 'status');
});

test('processes: one that may be stopped is grey, not counted on the Status tab', () => {
  const state = {
    loaded: true,
    modules: ['containers'],
    tabs: ['status', 'system', 'containers'],
    containers: { containers: [{ slug: 'core', name: 'Core', state: 'started' }] },
    system: [
      { key: 'process', entity_id: 'binary_sensor.p_backup', name: 'Process rsync', state: 'off', stoppable: true },
      { key: 'process', entity_id: 'binary_sensor.p_z2m', name: 'Process zigbee2mqtt', state: 'on' },
    ],
  };
  const p = panel(state, 'containers');
  const html = p._processList();
  assert.match(html, /<span class="pill good">Running<\/span><\/div>/);
  assert.match(html, /Stopped \(allowed\)/);
  assert.doesNotMatch(html, /pill bad/);
  const [tone] = p._stArea('containers');
  assert.equal(tone, 'good');
  // Not allowed: a problem
  state.system[0].stoppable = false;
  assert.equal(p._stArea('containers')[0], 'bad');
});

test('status: the house of the logo beside the score, with the colour of the ring and its badge', () => {
  const base = { loaded: true, modules: [], tabs: ['status', 'system'], system: [{ key: 'processor_use', entity_id: 'sensor.cpu', state: '10' }] };
  const pulse = /class="stbadge good"[^>]*><svg[\s\S]*<polyline points="-34,3/;
  assert.match(panel(base, 'status')._content(), pulse);
  const hot = { ...base, system: [{ key: 'processor_use', entity_id: 'sensor.cpu', state: '99' }] };
  // One area critical: 85, still green
  assert.match(panel(hot, 'status')._content(), pulse);
});

test('backups tab: the last success, the locations and their failures, the last 30 days; Back up now', async () => {
  const now = Date.now();
  const iso = (hours) => new Date(now - hours * 3600000).toISOString();
  const state = { loaded: true, modules: ['backups'], tabs: ['backups'], backups: { max_age: 3 }, system: [] };
  const info = {
    state: 'idle',
    last_completed_automatic_backup: iso(9),
    last_attempted_automatic_backup: iso(9),
    next_automatic_backup: new Date(now + 10 * 3600000).toISOString(),
    agent_errors: { 'cloud.cloud': 'Token expired' },
    backups: [
      { backup_id: 'a1', name: 'Automatic', date: iso(9), with_automatic_settings: true, failed_agent_ids: ['cloud.cloud'], agents: { 'backup.local': { size: 1073741824 }, 'hassio.nas': { size: 1073741824 } } },
      { backup_id: 'm1', name: 'Before an update', date: iso(30), with_automatic_settings: false, agents: { 'backup.local': { size: 314572800 } } },
    ],
  };
  const agents = { agents: [{ agent_id: 'backup.local', name: 'Local' }, { agent_id: 'hassio.nas', name: 'NAS' }, { agent_id: 'cloud.cloud', name: 'Cloud' }] };
  const p = panel(state, 'backups');
  p._hass.callWS = async (msg) => (msg.type === 'backup/info' ? info : agents);
  p._render = () => {};
  await p._bkLoad(true);
  const html = p._content();
  assert.match(html, /2 \/ 3 up to date/);
  assert.match(html, /Cloud<\/div><div class="s">[^<]*Token expired/);
  assert.match(html, /1.00 GiB/);
  assert.equal((html.match(/class="bkday ok"/g) || []).length, 2);
  assert.match(html, /href="\/config\/backup\/details\/a1"/);
  // Status: a location failing, the last backup recent
  const area = p._stArea('backups');
  assert.equal(area[0], 'warn');
  assert.match(area[2], /Cloud/);
  // Too old: a problem from the age set
  info.last_completed_automatic_backup = iso(24 * 4);
  info.last_attempted_automatic_backup = iso(24 * 4);
  info.agent_errors = {};
  info.backups[0].failed_agent_ids = [];
  assert.equal(p._stArea('backups')[0], 'warn');
  assert.match(p._content(), /older than 3 days/);
  // Back up now: Home Assistant's automatic backup
  const calls = [];
  p._hass.callService = async (domain, service) => calls.push(`${domain}.${service}`);
  p._load = async () => {};
  await p._onClick({ target: { closest: (sel) => (sel === '[data-action]' ? { dataset: { action: 'bk_now' } } : null) } });
  assert.equal(JSON.stringify(calls), JSON.stringify(['backup.create_automatic']));
});
