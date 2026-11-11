// Unit tests for the panel's Orphans tab, and the card's lookup among System Hub's entities.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../custom_components/system_hub/frontend/system-hub-panel.js', import.meta.url), 'utf8');
const card = readFileSync(new URL('../custom_components/system_hub/frontend/cards/orphan-entities-card.js', import.meta.url), 'utf8');
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
  clearTimeout() {},
  setTimeout: () => 0,
};
vm.createContext(context);
vm.runInContext(`${source}\nthis.panel = { SystemHubPanel, shOrphFilter, SH_ORPH_REASONS };`, context);
const { SystemHubPanel, shOrphFilter } = context.panel;

function localize(key, vars = {}) {
  const path = key.replace('component.system_hub.', '').split('.');
  let value = en;
  for (const part of path) value = value?.[part];
  if (typeof value !== 'string') return '';
  return value.replace(/\{(\w+)\}/g, (_m, name) => String(vars[name] ?? `{${name}}`));
}

const hoursAgo = (h) => new Date(Date.now() - h * 3600000).toISOString();
const orphan = (entity_id, platform, reason, extra = {}) => ({
  entity_id,
  name: entity_id.split('.')[1].replaceAll('_', ' '),
  platform,
  reason,
  since: hoursAgo(30),
  entry_title: null,
  device: null,
  disabled: false,
  used_by: [],
  ...extra,
});
const ENTITIES = [
  orphan('sensor.old_node', 'zwave_js', 'entry_removed', { disabled: true }),
  orphan('light.hallway', 'hue', 'not_provided', { used_by: [{ type: 'automation', name: 'Night <light>', path: '/config/automation/edit/1' }] }),
  orphan('sensor.hallway_temperature', 'hue', 'not_provided'),
  orphan('sensor.garage_door', 'zha', 'unavailable'),
];
const DATA = {
  total: 4,
  counts: { entry_removed: 1, integration_missing: 0, not_provided: 2, unavailable: 1, unknown: 0 },
  devices: [{ device_id: 'd1', name: 'Old hub', manufacturer: 'Acme', model: 'H1', entities: 2, since: hoursAgo(80), used_by: [] }],
  entities: ENTITIES,
  integrations: { hue: 'Philips Hue', zha: 'Zigbee Home Automation' },
};

function panel(data = DATA) {
  const p = new SystemHubPanel();
  const calls = [];
  p._hass = {
    language: 'en',
    localize,
    callService: async (...args) => calls.push(['service', ...args]),
    callWS: async (msg) => {
      calls.push(['ws', msg]);
      if (msg.type === 'call_service') return { response: { removed: msg.service_data.entities || ['d1'], skipped: [] } };
      if (msg.type === 'system_hub/orphans') return data;
      return { loaded: true, modules: ['orphans'], tabs: ['orphans'], orphans: { ...data, devices: data.devices.length } };
    },
  };
  p._localize = localize;
  p._state = { loaded: true, modules: ['orphans'], tabs: ['system', 'orphans'], orphans: { ...data, devices: data.devices.length, removed: 3, last_scan: hoursAgo(1) } };
  p._tab = 'orphans';
  p._orph().data = JSON.parse(JSON.stringify(data));
  p._render = () => {};
  return { p, calls };
}

const click = (p, attrs) =>
  p._orphClick({
    target: {
      closest: (sel) => {
        if (sel.includes('data-orph-sel') && (attrs.orphSel || attrs.orphDsel)) return { dataset: attrs };
        if (sel.includes('data-action') && attrs.action) return { dataset: attrs };
        return null;
      },
    },
  });

test('every Orphans string of the panel is in the translations', () => {
  const options = en.selector.panel.options;
  const keys = [...source.matchAll(/_t\('(orph_\w+)'/g)].map((m) => m[1]);
  const plurals = [...source.matchAll(/_orphN\('(orph_\w+)'/g)].map((m) => m[1]);
  assert.ok(keys.length > 20);
  for (const key of keys) assert.ok(options[key], `selector.panel.options.${key}`);
  for (const key of plurals) assert.ok(options[`${key}_one`] && options[`${key}_many`], `selector.panel.options.${key}_one/_many`);
  for (const reason of context.panel.SH_ORPH_REASONS) assert.ok(options[`orph_reason_${reason}`], reason);
  for (const ref of ['automation', 'script', 'scene', 'group', 'dashboard']) assert.ok(options[`orph_ref_${ref}`], ref);
  for (const lang of ['fr', 'de', 'sr-Latn', 'pt-BR']) {
    const other = JSON.parse(readFileSync(new URL(`../custom_components/system_hub/translations/${lang}.json`, import.meta.url), 'utf8'));
    for (const key of Object.keys(options).filter((k) => k.startsWith('orph_'))) assert.ok(other.selector.panel.options[key], `${lang} ${key}`);
  }
});

test('orphans tab: counters by reason, the list with its integrations and what uses each, the orphan devices', () => {
  const { p } = panel();
  const html = p._content();
  assert.match(html, /data-action="orph_reason" data-reason="not_provided"[^>]*>[\s\S]*?<b>2<\/b>[\s\S]*?Not provided/);
  assert.match(html, /data-reason="integration_missing"[\s\S]*?<b>0<\/b>/);
  assert.match(html, /Philips Hue/);
  assert.match(html, /data-orph-sel="light.hallway"/);
  assert.match(html, /<a class="use" href="\/config\/automation\/edit\/1" title="Automation">.*Night &#60;light&#62;<\/a>/);
  assert.match(html, /Used by 1/);
  assert.match(html, /\(disabled\)/);
  assert.match(html, /Orphan devices/);
  assert.match(html, /Acme H1 · Entities: 2/);
  assert.match(html, /href="\/config\/devices\/device\/d1"/);
  assert.match(html, /data-action="orphans_scan"/);
  assert.match(html, /Select the 4 shown/);
});

test('orphans tab: search, integration and reason filters; a reason counter filters too', () => {
  const ids = (items) => items.map((i) => i.entity_id);
  assert.deepEqual(ids(shOrphFilter(ENTITIES, { q: 'HALL temp' })), ['sensor.hallway_temperature']);
  assert.deepEqual(ids(shOrphFilter(ENTITIES, { q: 'philips' }, DATA.integrations)), ['light.hallway', 'sensor.hallway_temperature']);
  assert.deepEqual(ids(shOrphFilter(ENTITIES, { platform: 'zha' })), ['sensor.garage_door']);
  assert.deepEqual(ids(shOrphFilter(ENTITIES, { reason: 'entry_removed' })), ['sensor.old_node']);
  const { p } = panel();
  p._draft.orph_q = 'nothing like it';
  assert.match(p._content(), /No entity matches the filters/);
  p._draft.orph_q = '';
  click(p, { action: 'orph_reason', reason: 'unavailable' });
  assert.equal(p._draft.orph_reason, 'unavailable');
  let html = p._content();
  assert.match(html, /data-orph-sel="sensor.garage_door"/);
  assert.doesNotMatch(html, /data-orph-sel="light.hallway"/);
  assert.match(html, /aria-pressed="true"/);
  // Clicked again: every reason
  click(p, { action: 'orph_reason', reason: 'unavailable' });
  assert.equal(p._draft.orph_reason, '');
  html = panel({ ...DATA, entities: [], devices: [], counts: {} }).p._content();
  assert.match(html, /Every entity is provided by its integration/);
  assert.doesNotMatch(html, /Orphan devices<\/span>/);
});

test('orphans tab: select one by one or every match, remove after a confirmation that warns about what uses them', async () => {
  const { p, calls } = panel();
  click(p, { orphSel: 'light.hallway' });
  assert.deepEqual([...p._orph().sel], ['light.hallway']);
  let html = p._content();
  assert.match(html, /1 selected/);
  click(p, { action: 'orph_confirm', act: 'remove' });
  html = p._content();
  assert.match(html, /role="alertdialog"/);
  assert.match(html, /Remove 1 entity from the entity registry\?/);
  assert.match(html, /1 selected entity is still in use/);
  assert.match(html, /Remove anyway/);
  click(p, { action: 'orph_cancel' });
  assert.equal(p._orph().confirm, null);
  p._draft.orph_platform = 'hue';
  click(p, { action: 'orph_select_all' });
  assert.deepEqual([...p._orph().sel].sort(), ['light.hallway', 'sensor.hallway_temperature']);
  click(p, { action: 'orph_confirm', act: 'remove' });
  await p._orphRun('remove');
  const call = calls.find((c) => c[0] === 'ws' && c[1].type === 'call_service');
  assert.deepEqual(JSON.parse(JSON.stringify(call[1])), {
    type: 'call_service',
    domain: 'system_hub',
    service: 'orphans_remove',
    service_data: { entities: ['light.hallway', 'sensor.hallway_temperature'] },
    return_response: true,
  });
  assert.equal(p.events.at(-1).detail.message, '2 entities removed');
  assert.equal(p._orph().sel.size, 0);
  // The list is read again after the action
  assert.ok(calls.some((c) => c[0] === 'ws' && c[1].type === 'system_hub/orphans'));
});

test('orphans tab: ignore the selection; remove or ignore the orphan devices', async () => {
  const { p, calls } = panel();
  click(p, { orphSel: 'sensor.garage_door' });
  click(p, { action: 'orph_confirm', act: 'ignore' });
  assert.match(p._content(), /Ignore 1 entity\?/);
  await p._orphRun('ignore');
  assert.deepEqual(JSON.parse(JSON.stringify(calls.find((c) => c[0] === 'service'))), ['service', 'system_hub', 'orphans_ignore', { entities: ['sensor.garage_door'] }]);
  assert.equal(p.events.at(-1).detail.message, '1 entity ignored');

  // No device selected: Remove devices takes every orphan device, Ignore needs a selection
  assert.match(p._content(), /data-action="orph_confirm" data-act="ignore_devices" disabled/);
  click(p, { action: 'orph_confirm', act: 'remove_devices' });
  assert.match(p._content(), /Remove the orphan devices\?/);
  await p._orphRun('remove_devices');
  const call = calls.filter((c) => c[0] === 'ws' && c[1].type === 'call_service').at(-1);
  assert.equal(call[1].service, 'orphans_remove_devices');
  assert.deepEqual(JSON.parse(JSON.stringify(call[1].service_data)), {});
  click(p, { orphDsel: 'd1' });
  await p._orphRun('ignore_devices');
  assert.deepEqual(JSON.parse(JSON.stringify(calls.filter((c) => c[0] === 'service').at(-1).slice(0, 4))), ['service', 'system_hub', 'orphans_ignore', { devices: ['d1'] }]);
});

test('orphans tab: a failed action says why; the list is read when the tab opens', async () => {
  const { p } = panel();
  p._hass.callService = async () => {
    throw new Error('Unauthorized');
  };
  click(p, { orphSel: 'sensor.garage_door' });
  await p._orphRun('ignore');
  assert.equal(p._messages.orphans.text, 'Failed: Unauthorized');
  assert.equal(p._messages.orphans.tone, 'bad');

  const fresh = panel();
  fresh.p._orphState = null;
  assert.match(fresh.p._content(), /Loading/);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(fresh.p._orph().data.entities.length, 4);
});

test('orphans tab: at most 100 rows until Show all', () => {
  const many = Array.from({ length: 130 }, (_, i) => orphan(`sensor.s${i}`, 'demo', 'not_provided'));
  const { p } = panel({ ...DATA, entities: many });
  assert.equal((p._content().match(/data-orph-sel=/g) || []).length, 100);
  assert.match(p._content(), /Show all \(130\)/);
  click(p, { action: 'orph_all' });
  assert.equal((p._content().match(/data-orph-sel=/g) || []).length, 130);
});

test('card: finds the Orphans entities among the other System Hub modules', () => {
  const ctx = { HTMLElement: class {}, customElements: { get: () => true, define() {} }, window: {}, document: {}, console, Intl, Date };
  vm.createContext(ctx);
  vm.runInContext(`${card}\nthis.oe = { oeDevices };`, ctx);
  const registry = {
    'sensor.system_hub_watchdog_last_check': { platform: 'system_hub', device_id: 'w', translation_key: 'watchdog_last_check' },
    'sensor.system_hub_orphans_orphaned_entities': { platform: 'system_hub', device_id: 'o', translation_key: 'orphans_orphans' },
    'sensor.renamed': { platform: 'system_hub', device_id: 'o', translation_key: 'orphans_last_scan' },
    'button.system_hub_orphans_scan_now': { platform: 'system_hub', device_id: 'o' },
  };
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.oe.oeDevices(registry))), {
    o: { orphans: 'sensor.system_hub_orphans_orphaned_entities', last_scan: 'sensor.renamed', button: 'button.system_hub_orphans_scan_now' },
  });
});
