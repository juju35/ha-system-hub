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
  assert.match(html, /data-tab-move="system" data-dir="-1"[^>]*disabled/);
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
    updates: [{ key: 'core', state: 'off', installed: '2026.11.1', latest: '2026.11.1' }],
  })._content();
  assert.match(fine, /class="tile good link"/);
  assert.match(fine, /Up to date/);
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
