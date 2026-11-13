// Unit tests for the Orphan Entities card (System Hub's Orphans module): the card file is evaluated with stubs, no browser needed.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import { contrast, over, resolve, rules } from './wcag.mjs';

const source = readFileSync(new URL('../custom_components/system_hub/frontend/cards/orphan-entities-card.js', import.meta.url), 'utf8');

// Keys of the elements focused by the card.
const focused = [];

const fakeNode = () => ({
  innerHTML: '',
  style: {},
  handlers: {},
  addEventListener(type, fn) {
    this.handlers[type] = fn;
  },
  appendChild() {},
  // An ha-form stand-in: what the user changes in the editor.
  dispatch(value) {
    this.handlers['value-changed']({ detail: { value } });
  },
  attachShadow() {
    const elements = {};
    this.shadowRoot = {
      innerHTML: '',
      querySelector: (sel) => {
        if (!['.scan', '.zoom'].includes(sel) || !this.shadowRoot.innerHTML.includes(`class="${sel.slice(1)}"`)) return null;
        elements[sel] ||= fakeNode();
        return elements[sel];
      },
      querySelectorAll: (sel) =>
        sel === '[data-focus]'
          ? [...this.shadowRoot.innerHTML.matchAll(/data-focus="([^"]*)"/g)].map(([, key]) => ({
              dataset: { focus: key.replace(/&amp;/g, '&').replace(/&quot;/g, '"') },
              focus() {
                focused.push(key);
              },
            }))
          : [],
      activeElement: null,
      elements,
    };
    return this.shadowRoot;
  },
});
const documentListeners = {};
const context = {
  HTMLElement: class {},
  customElements: { get: () => true, define() {} },
  window: { history: { pushState() {} }, addEventListener() {}, dispatchEvent() {} },
  document: {
    createElement: () => fakeNode(),
    addEventListener: (type, fn) => (documentListeners[type] = fn),
    removeEventListener: (type) => delete documentListeners[type],
  },
  CustomEvent: class {
    constructor(type, init) {
      this.type = type;
      this.detail = init?.detail;
    }
  },
  Intl,
  console,
  Date,
};
vm.createContext(context);
vm.runInContext(
  `${source}\nthis.oe = { OrphanEntitiesCard, OrphanEntitiesCardEditor, OrphanEntitiesMiniCard, OrphanEntitiesMiniCardEditor, OE_I18N, OE_LANGS, OE_REASONS, oeEsc, oeLang, oeLocale, oeDevices, oeFilter, OE_DEFAULTS };`,
  context,
);
const { OrphanEntitiesCard, OrphanEntitiesCardEditor, OrphanEntitiesMiniCard, OrphanEntitiesMiniCardEditor, OE_I18N, OE_LANGS, oeLang, oeDevices, oeFilter } = context.oe;

const ORPHANS = 'sensor.system_hub_orphans_orphaned_entities';
const LAST_SCAN = 'sensor.system_hub_orphans_last_scan';
const BUTTON = 'button.system_hub_orphans_scan_now';
const minutesAgo = (m) => new Date(Date.now() - m * 60000).toISOString();

const REGISTRY = {
  [ORPHANS]: { platform: 'system_hub', device_id: 'd1', translation_key: 'orphans_orphans' },
  [LAST_SCAN]: { platform: 'system_hub', device_id: 'd1', translation_key: 'orphans_last_scan' },
  [BUTTON]: { platform: 'system_hub', device_id: 'd1', translation_key: 'orphans_scan' },
  'sensor.other': { platform: 'demo', device_id: 'd2' },
};

const orphan = (entity_id, platform, reason, extra = {}) => ({
  entity_id,
  name: entity_id.split('.')[1].replace(/_/g, ' '),
  platform,
  reason,
  since: minutesAgo(3 * 1440),
  entry_id: `e_${platform}`,
  entry_title: platform,
  device: null,
  disabled: false,
  ...extra,
});

const ITEMS = [
  orphan('sensor.old_node', 'zwave_js', 'entry_removed', { disabled: true }),
  orphan('switch.pump', 'command_line', 'integration_missing'),
  orphan('light.hallway', 'hue', 'not_provided', { device: 'Hallway' }),
  orphan('sensor.hallway_temperature', 'hue', 'not_provided'),
  orphan('sensor.garage_door', 'zha', 'unavailable'),
  orphan('sensor.forecast', 'met', 'unknown'),
];

function makeHass({ items = ITEMS, scanned = true, admin = true, language = 'en', entities = REGISTRY, fail = null, response = null, noResponse = false } = {}) {
  const calls = [];
  return {
    calls,
    language,
    user: { is_admin: admin },
    entities,
    states: {
      [ORPHANS]: {
        state: scanned ? String(items.length) : 'unknown',
        attributes: { entities: items, removed: 2, ignored_integrations: ['mqtt'], ignored_entities: ['sensor.kept'] },
      },
      [LAST_SCAN]: { state: scanned ? minutesAgo(3) : 'unknown', attributes: {} },
      [BUTTON]: { state: 'unknown', attributes: {} },
    },
    callService: async (...args) => {
      calls.push(args);
      if (fail) throw fail;
      // Before Home Assistant 2025.1 admin actions refuse return_response.
      if (args[5] && noResponse) throw { code: 'service_validation_error', translation_key: 'service_does_not_support_response', message: 'The action does not support responses' };
      return args[5] ? { context: {}, response } : { context: {} };
    },
  };
}

function render(config, hass, Card = OrphanEntitiesCard) {
  const card = new Card();
  card.attachShadow = fakeNode().attachShadow;
  card.style = {};
  card.events = [];
  card.dispatchEvent = (ev) => card.events.push(ev);
  card.setConfig(config);
  card.hass = hass;
  return card;
}

const html = (card) => card.shadowRoot.innerHTML;
const placeholders = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
// Objects made in the card's vm context: compared by value.
const plain = (v) => JSON.parse(JSON.stringify(v));
const rows = (card) => [...html(card).matchAll(/data-id="([^"]+)"/g)].map((m) => m[1]);

test('every language has the English keys and placeholders', () => {
  const keys = Object.keys(OE_I18N.en).sort();
  for (const [lang] of OE_LANGS) assert.ok(OE_I18N[lang], lang);
  for (const [lang, strings] of Object.entries(OE_I18N)) {
    // A "_few" form (2-4 in Serbian and Polish) is optional, next to the "_one"/"_many" forms of English.
    const few = Object.keys(strings).filter((k) => k.endsWith('_few'));
    for (const k of few) assert.deepEqual(placeholders(strings[k]), placeholders(OE_I18N.en[k.replace(/_few$/, '_many')]), `${lang}.${k}`);
    assert.deepEqual(Object.keys(strings).filter((k) => !k.endsWith('_few')).sort(), keys, lang);
    for (const key of keys) {
      assert.ok(String(strings[key]).trim(), `${lang}.${key}`);
      assert.deepEqual(placeholders(strings[key]), placeholders(OE_I18N.en[key]), `${lang}.${key}`);
    }
  }
  // Polish, Serbian, Russian, Ukrainian, Slovak, Czech (2-4) and Romanian (2-19) have their "few" forms.
  for (const lang of ['pl', 'sr', 'sr-Latn', 'ru', 'uk', 'sk', 'cs', 'ro']) {
    for (const k of Object.keys(OE_I18N.en).filter((k) => k.endsWith('_many'))) assert.ok(OE_I18N[lang][k.replace(/_many$/, '_few')], `${lang}.${k}`);
  }
});

test('Serbian strings stay in their script', () => {
  const strip = (s) => s.replace(/Orphan Entities|Home Assistant|\{\w+\}|\b(?:min|h|d)$/g, '');
  for (const [key, s] of Object.entries(OE_I18N.sr)) assert.doesNotMatch(strip(s), /[A-Za-zÀ-ÖØ-öø-ɏ]/, `sr.${key}`);
  for (const [key, s] of Object.entries(OE_I18N['sr-Latn'])) assert.doesNotMatch(s, /[Ѐ-ӿ]/, `sr-Latn.${key}`);
});

test('language follows Home Assistant, then the config, with English as fallback', () => {
  assert.equal(oeLang({ language: 'fr-FR' }, {}), 'fr');
  assert.equal(oeLang({ language: 'fr' }, { language: 'de' }), 'de');
  assert.equal(oeLang({ language: 'ja' }, {}), 'en');
  assert.equal(oeLang({ language: 'pt-BR' }, {}), 'pt');
  assert.equal(oeLang({ locale: { language: 'sr-Latn' }, language: 'sr' }, {}), 'sr-Latn');
  for (const [tag, lang] of [
    ['ro-RO', 'ro'],
    ['da-DK', 'da'],
    ['sv-SE', 'sv'],
    ['bg', 'bg'],
    ['ru-RU', 'ru'],
    ['uk-UA', 'uk'],
    ['hu', 'hu'],
    ['sk', 'sk'],
    ['cs-CZ', 'cs'],
    ['sl', 'sl'],
    ['lv-LV', 'lv'],
    ['el-GR', 'el'],
  ])
    assert.equal(oeLang({ language: tag }, {}), lang, tag);
});

test('entities found by translation key, or by entity ID when it is missing', () => {
  assert.deepEqual({ ...oeDevices(REGISTRY).d1 }, { orphans: ORPHANS, last_scan: LAST_SCAN, button: BUTTON });
  const noKeys = Object.fromEntries(Object.entries(REGISTRY).map(([id, e]) => [id, { ...e, translation_key: undefined }]));
  assert.deepEqual({ ...oeDevices(noKeys).d1 }, { orphans: ORPHANS, last_scan: LAST_SCAN, button: BUTTON });
});

test('filter: words on name, entity ID, integration and device; integration; reason', () => {
  const ids = (list) => list.map((i) => i.entity_id);
  assert.equal(oeFilter(ITEMS).length, ITEMS.length);
  assert.deepEqual(ids(oeFilter(ITEMS, { q: 'hallway' })), ['light.hallway', 'sensor.hallway_temperature']);
  assert.deepEqual(ids(oeFilter(ITEMS, { q: 'HALL temp' })), ['sensor.hallway_temperature']);
  assert.deepEqual(ids(oeFilter(ITEMS, { q: 'zwave' })), ['sensor.old_node']);
  assert.deepEqual(ids(oeFilter(ITEMS, { platform: 'hue', q: 'light' })), ['light.hallway']);
  assert.deepEqual(ids(oeFilter(ITEMS, { reason: 'unknown' })), ['sensor.forecast']);
});

test('orphans listed with their reason, counts, summary and filters', () => {
  const card = render({}, makeHass());
  const h = html(card);
  assert.match(h, /6 orphans/);
  assert.match(h, /Scanned 3 minutes ago/);
  assert.equal(rows(card).length, 6);
  assert.match(h, /Integration removed/);
  assert.match(h, /Not provided/);
  assert.match(h, /data-reason="not_provided"[^>]*>Not provided<span class="n">2</);
  assert.match(h, /<option value="hue">hue \(2\)<\/option>/);
  assert.match(h, /class="stat warn"><span class="val">6</);
  assert.match(h, /title="mqtt, sensor.kept"><span class="val">2</);
  assert.match(h, /for 3 d/);
  assert.match(h, /disabled/);
  // No longer provided in red, still provided but stale in orange.
  assert.match(h, /class="row alert" role="checkbox" aria-checked="false" data-id="light.hallway"/);
  assert.match(h, /class="row warn" role="checkbox" aria-checked="false" data-id="sensor.garage_door"/);
});

test('no orphan: ok status and an empty-list message; hide_when_empty hides it', () => {
  const card = render({}, makeHass({ items: [] }));
  assert.match(html(card), /No orphan/);
  assert.match(html(card), /Every entity is provided/);
  assert.doesNotMatch(html(card), /class="filters"/);
  assert.equal(render({ hide_when_empty: true }, makeHass({ items: [] })).style.display, 'none');
  assert.equal(render({ hide_when_empty: true }, makeHass()).style.display, '');
});

test('before the first scan: waiting, no list; not set up without the sensor', () => {
  const waiting = render({ hide_when_empty: true }, makeHass({ scanned: false, items: [] }));
  assert.match(html(waiting), /Waiting for the first scan/);
  assert.equal(waiting.style.display, '');
  assert.doesNotMatch(html(waiting), /class="list"/);
  // Within the grace period after a start the sensor says when the first scan is due.
  const due = makeHass({ scanned: false, items: [] });
  due.states[ORPHANS].attributes.next_scan = new Date(Date.now() + 7 * 60000).toISOString();
  assert.match(html(render({}, due)), /Waiting for the first scan \(in 7 minutes\)/);
  const mini = html(render({}, due, OrphanEntitiesMiniCard));
  assert.match(mini, /title="Waiting for the first scan \(in 7 minutes\)"/);
  assert.doesNotMatch(mini, /Waiting for the first scan \(in 7 minutes\)<\//);
  assert.match(mini, />in 7 minutes</);
  const none = render({}, { ...makeHass(), entities: {}, states: {} });
  assert.match(html(none), /Not set up/);
});

test('max_rows limits the rows, "Show all" shows the rest', () => {
  const card = render({ max_rows: 2 }, makeHass());
  assert.equal(rows(card).length, 2);
  assert.match(html(card), /Show all \(6\)/);
  card._showAll = true;
  card._render();
  assert.equal(rows(card).length, 6);
});

test('the filters narrow the list; a filter on a vanished integration is dropped', () => {
  const card = render({}, makeHass());
  card._q = 'hallway';
  card._render();
  assert.deepEqual(rows(card), ['light.hallway', 'sensor.hallway_temperature']);
  card._q = 'nothing like that';
  card._render();
  assert.match(html(card), /No entity matches the filters/);
  card._q = '';
  card._platform = 'hue';
  card._render();
  assert.equal(rows(card).length, 2);
  card.hass = makeHass({ items: ITEMS.filter((i) => i.platform !== 'hue') });
  assert.equal(card._platform, '');
  assert.equal(rows(card).length, 4);
});

test('selection: rows toggle, "select all" takes every match of the filters, gone entities are dropped', () => {
  const card = render({}, makeHass());
  card._toggle('light.hallway');
  assert.match(html(card), /1 selected/);
  assert.match(html(card), /aria-checked="true" data-id="light.hallway"/);
  card._toggle('light.hallway');
  assert.doesNotMatch(html(card), /selected/);

  card._config.max_rows = 1;
  card._reason = 'not_provided';
  card._toggleAll();
  // Both, although max_rows shows one.
  assert.deepEqual([...card._sel].sort(), ['light.hallway', 'sensor.hallway_temperature']);
  assert.match(html(card), /aria-checked="true"/);
  card._toggleAll();
  assert.equal(card._sel.size, 0);

  card._reason = '';
  card._toggleAll();
  assert.equal(card._sel.size, 6);
  card.hass = makeHass({ items: ITEMS.slice(2) });
  assert.equal(card._sel.size, 4);
});

test('remove: confirmation at the top of the card, then the action with the selection', async () => {
  const hass = makeHass();
  const card = render({}, hass);
  card._toggle('light.hallway');
  card._toggle('sensor.garage_door');
  card._confirm = 'remove';
  card._render();
  const h = html(card);
  assert.match(h, /class="dlg danger" role="alertdialog"/);
  assert.match(h, /Remove 2 entities from the entity registry\?/);
  assert.match(h, /<li><span class="name">hallway<\/span>/);
  assert.match(h, /ha-card class="lvl-warn dlg-open"/);
  await card._run();
  assert.deepEqual(plain(hass.calls), [['system_hub', 'orphans_remove', { entities: ['light.hallway', 'sensor.garage_door'] }, null, false, true]]);
  assert.equal(card._sel.size, 0);
  assert.equal(card._confirm, null);
  assert.equal(card.events.at(-1).detail.message, '2 entities removed');
});

test('remove: the toast counts what the action removed and kept, not the selection', async () => {
  const hass = makeHass({ response: { removed: ['light.hallway'], skipped: ['sensor.garage_door'] } });
  const card = render({}, hass);
  card._toggle('light.hallway');
  card._toggle('sensor.garage_door');
  card._confirm = 'remove';
  await card._run();
  assert.equal(card.events.at(-1).detail.message, '1 entity removed · Kept, no longer orphaned: 1');
  // Translated.
  const fr = makeHass({ language: 'fr', response: { removed: [], skipped: ['sensor.forecast'] } });
  const frCard = render({}, fr);
  frCard._toggle('sensor.forecast');
  frCard._confirm = 'remove';
  await frCard._run();
  assert.match(frCard.events.at(-1).detail.message, /^0 entité.* · Conservés, plus orphelins : 1$/);
  // Before Home Assistant 2025.1 (no response): called again without asking for one, the selection is counted.
  const old = makeHass({ noResponse: true });
  const oldCard = render({}, old);
  oldCard._toggle('sensor.forecast');
  oldCard._confirm = 'remove';
  await oldCard._run();
  assert.deepEqual(plain(old.calls.map((c) => c.slice(0, 3))), [
    ['system_hub', 'orphans_remove', { entities: ['sensor.forecast'] }],
    ['system_hub', 'orphans_remove', { entities: ['sensor.forecast'] }],
  ]);
  assert.equal(oldCard.events.at(-1).detail.message, '1 entity removed');
});

test('ignore goes through the ignore action', async () => {
  const hass = makeHass();
  const card = render({}, hass);
  card._toggle('sensor.forecast');
  card._confirm = 'ignore';
  card._render();
  assert.match(html(card), /Ignore 1 entity\?/);
  await card._run();
  assert.deepEqual(plain(hass.calls), [['system_hub', 'orphans_ignore', { entities: ['sensor.forecast'] }]]);
  assert.equal(card.events.at(-1).detail.message, '1 entity ignored');
});

test('a failed action is reported and keeps the selection', async () => {
  const hass = makeHass({ fail: new Error('Not in the list') });
  const card = render({}, hass);
  card._toggle('sensor.forecast');
  card._confirm = 'remove';
  await card._run();
  assert.equal(card._sel.size, 1);
  assert.equal(card.events.at(-1).detail.message, 'Failed: Not in the list');
  assert.equal(card._busy, false);
});

test('Escape cancels the confirmation', () => {
  const card = render({}, makeHass());
  card.connectedCallback();
  card._toggle('sensor.forecast');
  card._confirm = 'remove';
  card._render();
  documentListeners.keydown({ key: 'Escape' });
  assert.equal(card._confirm, null);
  assert.doesNotMatch(html(card), /class="dlg/);
  card.disconnectedCallback();
});

test('other users see the list without checkboxes nor actions', () => {
  const card = render({}, makeHass({ admin: false }));
  assert.equal(rows(card).length, 0);
  assert.match(html(card), /<div class="row alert"/);
  assert.doesNotMatch(html(card), /class="all"|class="box/);
  card._toggle('light.hallway');
  assert.equal(card._sel.size, 0);
});

test('scan button presses the button entity; hidden with scan_button: false', async () => {
  const hass = makeHass();
  const card = render({}, hass);
  await card._scan();
  assert.deepEqual(plain(hass.calls), [['button', 'press', { entity_id: BUTTON }]]);
  assert.doesNotMatch(html(render({ scan_button: false }, makeHass())), /class="scan"/);
});

test('names, IDs and the search text are escaped', () => {
  const items = [orphan('sensor.x', 'demo', 'not_provided', { name: '<img src=x onerror=alert(1)>' })];
  const card = render({ title: '<b>T</b>' }, makeHass({ items }));
  card._q = '"><script>';
  card._render();
  assert.doesNotMatch(html(card), /<img src=x|<b>T|"><script>/);
});

test('French, with plurals', () => {
  const card = render({}, makeHass({ language: 'fr' }));
  assert.match(html(card), /6 orphelines/);
  assert.match(html(render({}, makeHass({ language: 'fr', items: ITEMS.slice(0, 1) }))), /1 orpheline/);
});

test('plurals: 1, 2, 5 and 22 in Polish, Serbian, Russian and Ukrainian; 22 is "many" in Slovak and Czech', () => {
  for (const lang of ['pl', 'sr', 'sr-Latn', 'ru', 'uk', 'sk', 'cs']) {
    const card = render({}, makeHass({ language: lang }));
    const forms = [1, 2, 5, 22].map((n) => card._count('orphans', n));
    assert.equal(forms[0], OE_I18N[lang].orphans_one.replace('{n}', 1), lang);
    assert.equal(forms[1], OE_I18N[lang].orphans_few.replace('{n}', 2), lang);
    assert.equal(forms[2], OE_I18N[lang].orphans_many.replace('{n}', 5), lang);
    const twentyTwo = ['sk', 'cs'].includes(lang) ? 'orphans_many' : 'orphans_few';
    assert.equal(forms[3], OE_I18N[lang][twentyTwo].replace('{n}', 22), lang);
  }
});

test('plurals: 1, 2, 19 and 20 in Romanian; one and other elsewhere', () => {
  const ro = render({}, makeHass({ language: 'ro' }));
  assert.deepEqual(
    [1, 2, 19, 20].map((n) => ro._count('orphans', n)),
    ['1 orfană', '2 orfane', '19 orfane', '20 de orfane'],
  );
  for (const lang of ['da', 'sv', 'bg', 'hu', 'sl', 'lv', 'el']) {
    const card = render({}, makeHass({ language: lang }));
    assert.equal(card._count('orphans', 1), OE_I18N[lang].orphans_one.replace('{n}', 1), lang);
    assert.equal(card._count('orphans', 7), OE_I18N[lang].orphans_many.replace('{n}', 7), lang);
  }
});

test('no re-render while nothing changed', () => {
  const hass = makeHass();
  const card = render({}, hass);
  card.shadowRoot.innerHTML = 'untouched';
  card.hass = { ...hass };
  assert.equal(html(card), 'untouched');
});

test('a re-render keeps the focus on the search field', () => {
  const card = render({}, makeHass());
  let caret = null;
  card.shadowRoot.activeElement = { dataset: { focus: 'q' }, selectionStart: 3, selectionEnd: 3 };
  const all = card.shadowRoot.querySelectorAll;
  card.shadowRoot.querySelectorAll = (sel) =>
    sel === '[data-focus]' ? all(sel).map((el) => ({ ...el, setSelectionRange: (...r) => (caret = r) })) : all(sel);
  focused.length = 0;
  card._q = 'hal';
  card._render();
  assert.deepEqual(focused, ['q']);
  assert.deepEqual(caret, [3, 3]);
});

test('editor leaves the defaults out of the YAML; the mini card editor adds the detail button', () => {
  const editor = new OrphanEntitiesCardEditor();
  editor.appendChild = () => {};
  let sent;
  editor.dispatchEvent = (ev) => (sent = ev.detail.config);
  editor.setConfig({});
  editor.hass = makeHass();
  editor._form.dispatch({ show_stats: true, max_rows: 25, title: '', show_filters: false });
  assert.deepEqual({ ...sent }, { show_filters: false });
  assert.ok(!editor._form.schema.some((s) => s.name === 'zoom'));
  assert.deepEqual(
    editor._form.schema.find((s) => s.name === 'language').selector.select.options.map((o) => o.value),
    OE_LANGS.map(([v]) => v),
  );
  const mini = new OrphanEntitiesMiniCardEditor();
  mini.appendChild = () => {};
  mini.setConfig({});
  mini.hass = makeHass();
  assert.ok(mini._form.schema.some((s) => s.name === 'zoom'));
});

test('mini card: a chip per reason with its count, then the last scan; no list', () => {
  const card = render({}, makeHass(), OrphanEntitiesMiniCard);
  const h = html(card);
  assert.match(h, /6 orphans/);
  assert.match(h, /data-zoom="not_provided"[^>]*title="Not provided · 2"/);
  assert.match(h, /class="r warn pill" data-zoom="unknown"/);
  assert.match(h, /Scanned 3 minutes ago/);
  assert.doesNotMatch(h, /class="list"|class="filters"/);
  assert.match(h, /icon="mdi:ghost-outline"/);
  assert.match(html(render({}, makeHass({ items: [] }), OrphanEntitiesMiniCard)), /No orphan/);
});

test('mini card: the detail button switches to the full card and back; a reason chip opens it filtered', () => {
  const card = render({}, makeHass(), OrphanEntitiesMiniCard);
  card.connectedCallback();
  card._zoom(true);
  assert.match(html(card), /class="list"/);
  assert.match(html(card), /aria-expanded="true"/);
  documentListeners.pointerdown({ composedPath: () => [] });
  documentListeners.pointerup({ composedPath: () => [] });
  assert.equal(card._zoomed, false);
  card._zoom(true, 'unknown');
  assert.deepEqual(rows(card), ['sensor.forecast']);
  card.disconnectedCallback();
  assert.doesNotMatch(html(render({ zoom: false }, makeHass(), OrphanEntitiesMiniCard)), /class="zoom"/);
  assert.throws(() => render({ zoom: 'yes' }, makeHass(), OrphanEntitiesMiniCard));
});

const STATE_COLOURS = { '--success-color': '#43a047', '--warning-color': '#ffa600', '--error-color': '#db4437', '--primary-color': '#03a9f4' };
const THEMES = {
  light: {
    ...STATE_COLOURS,
    '--card-background-color': '#ffffff',
    '--secondary-background-color': '#ececec',
    '--primary-text-color': '#212121',
    '--secondary-text-color': '#727272',
    '--disabled-color': '#bdbdbd',
  },
  dark: {
    ...STATE_COLOURS,
    '--card-background-color': '#1c1c1c',
    '--secondary-background-color': '#282828',
    '--primary-text-color': '#e1e1e1',
    '--secondary-text-color': '#9b9b9b',
    '--disabled-color': '#6f6f6f',
  },
};

function checkContrast(Card, cases) {
  const css = rules(Card.styles);
  const last = (selectors, prop) => selectors.map((s) => css[s]?.[prop]).filter(Boolean).at(-1);
  const failures = [];
  for (const [what, own, text, backgrounds] of cases) {
    for (const [theme, colours] of Object.entries(THEMES)) {
      const vars = { '--t': 'var(--secondary-text-color)', ...colours, ...css[':host'], ...own };
      const card = resolve(vars['--card-background-color'], vars);
      const fg = resolve(last(text, 'color'), vars);
      for (const bg of backgrounds) {
        const back = bg.length ? over(resolve(last(bg, 'background'), vars), card) : card;
        const ratio = contrast(fg, back);
        if (ratio < 4.5) failures.push(`${what} (${theme}, on ${bg.at(-1) ?? 'card'}): ${ratio.toFixed(2)}:1`);
      }
    }
  }
  return failures;
}

test('text is readable on its tile in light and dark themes (WCAG AA, 4.5:1)', () => {
  const level = { ok: 'var(--oe-ok)', warn: 'var(--oe-warn)', alert: 'var(--oe-alert)', na: 'var(--oe-na)' };
  const cases = [];
  for (const k of ['ok', 'warn', 'na']) cases.push([`status pill ${k}`, { '--c': level[k] }, ['.pill'], [['.pill']]]);
  for (const k of ['warn', 'alert']) {
    for (const text of ['.when .lbl', '.when .ago', '.name', '.sub']) cases.push([`row ${k} ${text}`, { '--t': level[k] }, [text], [['.row'], ['button.row:hover']]]);
    cases.push([`chip ${k} on`, { '--t': level[k] }, ['.chip', '.chip.on'], [['.chip.on']]]);
    cases.push([`chip ${k}`, { '--t': level[k] }, ['.chip'], [['.chip'], ['.chip:hover']]]);
  }
  cases.push(['selected row', { '--t': level.alert }, ['.name'], [['button.row.sel']]]);
  cases.push(['stat warn value', { '--t': 'var(--oe-warn)' }, ['.stat .val', '.stat.warn .val'], [['.stat.warn']]]);
  cases.push(['stat warn label', { '--t': 'var(--oe-warn)' }, ['.stat .lbl'], [['.stat.warn']]]);
  cases.push(['empty list', {}, ['.empty'], [['.empty'], ['.empty.ok']]]);
  cases.push(['used by badge', {}, ['.used'], [['.used'], ['.used:hover']]]);
  cases.push(['used by kind', {}, ['.refs .rk'], [['.refs']]]);
  cases.push(['used by link', {}, ['.refs a'], [['.refs']]]);
  cases.push(['used by name', {}, ['.refs .rn'], [['.refs']]]);
  cases.push(['still used warning', {}, ['.dlg .dw'], [['.dlg .dw']]]);
  for (const k of ['danger', 'neutral']) {
    const t = k === 'danger' ? 'var(--oe-alert)' : 'var(--primary-color)';
    cases.push([`button ${k}`, { '--t': t }, ['.act'], [['.act'], ['.act:hover']]]);
  }
  assert.deepEqual(checkContrast(OrphanEntitiesCard, cases), []);
});

test('mini card: chip text is readable in light and dark themes (WCAG AA, 4.5:1)', () => {
  const level = { ok: 'var(--oe-ok)', warn: 'var(--oe-warn)', alert: 'var(--oe-alert)' };
  const cases = [];
  for (const k of ['warn', 'alert']) cases.push([`reason chip ${k}`, { '--t': level[k] }, ['.r', '.r.pill'], [['.r.pill'], ['.r.pill:hover']]]);
  cases.push(['no orphan chip', { '--t': level.ok }, ['.r'], [[], ['.r:hover']]]);
  cases.push(['last scan chip', {}, ['.r', '.r.idle'], [[], ['.r:hover']]]);
  assert.deepEqual(checkContrast(OrphanEntitiesMiniCard, cases), []);
});

test('header: the pill keeps its dot alone when its text or the title would be cut, the text otherwise', () => {
  const card = render({}, makeHass({ scanned: false, items: [] }));
  const el = (scrollWidth, clientWidth, extra = {}) => ({ scrollWidth, clientWidth, scrollHeight: 20, clientHeight: 20, ...extra });
  const classes = new Set();
  const pill = { classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c) }, querySelector: () => text };
  let text = el(120, 60);
  let title = el(80, 80);
  card.shadowRoot.querySelector = (sel) => (sel === '.head .pill' ? pill : sel === '.head .title' ? title : null);
  card._fitPill();
  assert.ok(classes.has('compact'), 'cut pill text');
  text = el(60, 60);
  card._fitPill();
  assert.ok(!classes.has('compact'), 'everything fits');
  title = el(120, 40);
  card._fitPill();
  assert.ok(classes.has('compact'), 'cut title');
  // A pill text clamped on more lines than its box shows is cut too.
  title = el(80, 80);
  text = el(60, 60, { scrollHeight: 48, clientHeight: 28 });
  card._fitPill();
  assert.ok(classes.has('compact'), 'clamped text');
});

test('hide_when_empty: the hidden card shows again in edit mode and in the editor preview', () => {
  const card = render({ hide_when_empty: true }, makeHass({ items: [] }));
  const events = [];
  card.dispatchEvent = (ev) => events.push(ev.type);
  assert.equal(card.style.display, 'none');
  card.editMode = true;
  assert.equal(card.style.display, '');
  assert.match(html(card), /No orphan/);
  card.editMode = false;
  assert.equal(card.style.display, 'none');
  card.preview = true;
  assert.equal(card.style.display, '');
  assert.deepEqual(events, ['card-visibility-changed', 'card-visibility-changed', 'card-visibility-changed']);
});

test('orphan devices: listed under the entities, removed together after a confirmation (admins only)', async () => {
  const hass = makeHass();
  const devices = [
    { device_id: 'd1', name: 'Old hub', manufacturer: 'Acme', model: 'H1', entities: 2, since: null },
    { device_id: 'd2', name: 'Old plug', manufacturer: null, model: null, entities: 0, since: null },
  ];
  hass.states[Object.keys(hass.states).find((id) => hass.states[id].attributes?.entities)].attributes.devices = devices;
  const card = render({}, hass);
  let out = html(card);
  assert.match(out, /class="section devs"/);
  assert.match(out, /Orphan devices · 2/);
  assert.match(out, /Old hub<\/span><span class="sub">Acme H1 · Entities: 2/);
  assert.match(out, /data-act="remove_devices"/);
  card._confirm = 'remove_devices';
  card._sig = null;
  card._render();
  out = html(card);
  assert.match(out, /Remove the orphan devices\?/);
  await card._run();
  // Without a selection the integration removes every orphan device, also those its sensor leaves out.
  const call = hass.calls.find((c) => c[1] === 'orphans_remove_devices');
  assert.deepEqual(plain(call.slice(0, 3)), ['system_hub', 'orphans_remove_devices', {}]);
});

test('orphan devices: the toast counts the devices removed and kept; a cut list says how many are left out', async () => {
  const hass = makeHass({ response: { removed: ['d1'], skipped: ['d2'], entities: [] } });
  hass.states[ORPHANS].attributes.devices = [
    { device_id: 'd1', name: 'Old hub', manufacturer: 'Acme', model: 'H1', entities: 2, since: null },
    { device_id: 'd2', name: 'Old plug', manufacturer: null, model: null, entities: 0, since: null },
  ];
  hass.states[ORPHANS].attributes.devices_truncated = 12;
  const card = render({}, hass);
  assert.match(html(card), /class="empty trunc">Orphan devices not listed here: 12/);
  card._confirm = 'remove_devices';
  card._render();
  // All of them: the listed ones and those left out.
  assert.match(html(card), /and 9 more/);
  await card._run();
  assert.equal(card.events.at(-1).detail.message, 'Orphan devices removed: 1 · Kept, no longer orphaned: 1');
});

test('orphan devices: a "Used by" badge and list, the confirmation counts them and asks to remove anyway', () => {
  const hass = makeHass();
  const uses = [{ type: 'automation', id: 'automation.hub_button', name: 'Hub button', path: '/config/automation/edit/hub' }];
  hass.states[ORPHANS].attributes.devices = [
    { device_id: 'd2', name: 'Old plug', manufacturer: null, model: null, entities: 0, since: null, used_by: [] },
    { device_id: 'd1', name: 'Old hub', manufacturer: 'Acme', model: 'H1', entities: 2, since: null, used_by: uses },
  ];
  const card = render({}, hass);
  let h = html(card);
  assert.equal((h.match(/class="used"/g) || []).length, 1);
  assert.match(h, /data-used="d1"[^>]*title="Automation: Hub button">.*<span>Used by 1<\/span>/);
  card._open.add('d1');
  card._render();
  assert.match(html(card), /<a href="\/config\/automation\/edit\/hub" data-nav="\/config\/automation\/edit\/hub">Hub button<\/a>/);
  // The open list of a listed device stays open.
  assert.ok(card._open.has('d1'));
  card._confirm = 'remove_devices';
  card._render();
  h = html(card);
  assert.match(h, /Devices still used by automations or scripts: 1\. They may stop working\./);
  assert.match(h, /<span>Remove anyway<\/span>/);
  assert.match(h, /<ul><li><span class="name">Old hub<\/span> <span class="sub">Acme H1<\/span> <span class="ub">Used by 1<\/span>/);
  // Only the selection: the device in use is not in it.
  card._toggle('d2', card._dsel);
  card._render();
  assert.doesNotMatch(markup(card), /still used|Remove anyway/);
});

const USES = [
  { type: 'automation', id: 'automation.hall_lights', name: 'Hall lights', path: '/config/automation/edit/1700000000' },
  { type: 'script', id: 'script.night', name: 'Night', path: '/config/script/edit/night' },
  { type: 'group', id: 'group.downstairs', name: 'Downstairs', path: null },
  { type: 'dashboard', id: 'lovelace', name: 'Overview', path: '/lovelace' },
];
// The card's markup without its styles.
const markup = (card) => html(card).replace(/<style>[\s\S]*?<\/style>/, '');
const usedItems = () => ITEMS.map((i) => ({ ...i, used_by: i.entity_id === 'light.hallway' ? USES : [] }));

test('used by: a badge on the rows still in use, its list in the tooltip and under the row with links', () => {
  const card = render({}, makeHass({ items: usedItems() }));
  let h = html(card);
  assert.equal((h.match(/class="used"/g) || []).length, 1);
  assert.match(h, /data-used="light.hallway"[^>]*aria-expanded="false" title="Automation: Hall lights\nScript: Night\nGroup: Downstairs\nDashboard: Overview">.*<span>Used by 4<\/span>/);
  assert.doesNotMatch(h, /class="refs"/);
  // Selecting the row still works, the badge is its own button next to it.
  assert.deepEqual(rows(card), ITEMS.map((i) => i.entity_id));
  card._open.add('light.hallway');
  card._render();
  h = html(card);
  assert.match(h, /aria-expanded="true"/);
  assert.match(h, /<a href="\/config\/automation\/edit\/1700000000" data-nav="\/config\/automation\/edit\/1700000000">Hall lights<\/a>/);
  assert.match(h, /<a href="\/config\/script\/edit\/night" data-nav="\/config\/script\/edit\/night">Night<\/a>/);
  assert.match(h, /<span class="rk">Group<\/span><span class="rn">Downstairs<\/span>/);
  // Other users see the badge too.
  assert.match(html(render({}, makeHass({ items: usedItems(), admin: false }))), /Used by 4/);
  // Unused rows: no badge, as before.
  assert.doesNotMatch(html(render({}, makeHass())), /class="used"/);
  // The list of an entity no longer listed closes.
  card.hass = makeHass({ items: usedItems().filter((i) => i.entity_id !== 'light.hallway') });
  assert.equal(card._open.size, 0);
});

test('used by: names and paths are escaped, a path that is not a page is not a link', () => {
  const items = [orphan('sensor.x', 'demo', 'not_provided', { used_by: [{ type: 'automation', name: '<b>A</b>', path: 'javascript:alert(1)' }] })];
  const card = render({}, makeHass({ items }));
  card._open.add('sensor.x');
  card._render();
  assert.doesNotMatch(html(card), /<b>A|javascript:/);
  assert.match(html(card), /<span class="rn">&lt;b&gt;A&lt;\/b&gt;<\/span>/);
});

test('remove: the confirmation counts the selected entities still in use and asks to remove them anyway', () => {
  const card = render({}, makeHass({ items: usedItems() }));
  card._toggle('sensor.garage_door');
  card._toggle('light.hallway');
  card._confirm = 'remove';
  card._render();
  let h = html(card);
  assert.match(h, /1 selected entity is still in use: what uses it may stop working\./);
  assert.match(h, /<span>Remove anyway<\/span>/);
  // The entity in use is listed first, with its badge.
  assert.match(h, /<ul><li><span class="name">hallway<\/span> <span class="sub">light.hallway<\/span> <span class="ub">Used by 4<\/span>/);
  // Nothing in use: the usual confirmation.
  card._sel.delete('light.hallway');
  card._render();
  h = markup(card);
  assert.doesNotMatch(h, /still in use|Remove anyway|class="ub"/);
  assert.match(h, /<span>Remove<\/span>/);
  // Ignoring keeps the entities: no warning.
  card._sel.add('light.hallway');
  card._confirm = 'ignore';
  card._render();
  assert.doesNotMatch(markup(card), /still in use/);
  // Plurals, in French too.
  const fr = render({}, makeHass({ items: ITEMS.map((i) => ({ ...i, used_by: USES })), language: 'fr' }));
  fr._toggleAll();
  fr._confirm = 'remove';
  fr._render();
  assert.match(html(fr), /6 entités sélectionnées sont encore utilisées/);
  assert.match(html(fr), /Supprimer quand même/);
});

test('orphan devices: administrators select some to ignore or remove; a vanished device leaves the selection', async () => {
  const hass = makeHass();
  const devices = [
    { device_id: 'd1', name: 'Old hub', manufacturer: 'Acme', model: 'H1', entities: 2, since: null },
    { device_id: 'd2', name: 'Old plug', manufacturer: null, model: null, entities: 0, since: null },
  ];
  hass.states[ORPHANS].attributes.devices = devices;
  const card = render({}, hass);
  assert.deepEqual([...html(card).matchAll(/data-dev="([^"]+)"/g)].map((m) => m[1]), ['d1', 'd2']);
  card._toggle('d2', card._dsel);
  let out = html(card);
  assert.match(out, /Orphan devices · 1\/2/);
  assert.match(out, /aria-checked="true" data-dev="d2"/);
  assert.match(out, /data-act="ignore_devices"/);
  assert.match(out, /data-act="clear_devices"/);

  card._confirm = 'ignore_devices';
  card._render();
  out = html(card);
  assert.match(out, /Ignore the selected devices\?/);
  assert.match(out, /<li><span class="name">Old plug<\/span>/);
  assert.doesNotMatch(out, /<li><span class="name">Old hub<\/span>/);
  await card._run();
  assert.deepEqual(plain(hass.calls.at(-1).slice(0, 3)), ['system_hub', 'orphans_ignore', { devices: ['d2'] }]);
  assert.equal(card._dsel.size, 0);

  card._toggle('d1', card._dsel);
  card._confirm = 'remove_devices';
  card._render();
  await card._run();
  assert.deepEqual(plain(hass.calls.at(-1).slice(0, 3)), ['system_hub', 'orphans_remove_devices', { devices: ['d1'] }]);

  // A device no longer listed is dropped from the selection.
  card._toggle('d2', card._dsel);
  card.hass = { ...hass, states: { ...hass.states, [ORPHANS]: { ...hass.states[ORPHANS], attributes: { ...hass.states[ORPHANS].attributes, devices: [devices[0]] } } } };
  assert.equal(card._dsel.size, 0);
  // Other users: no checkboxes.
  const viewer = makeHass({ admin: false });
  viewer.states[ORPHANS].attributes.devices = devices;
  assert.doesNotMatch(html(render({}, viewer)), /data-dev=/);
});

test('a list cut by the integration says how many orphans are left out', () => {
  const hass = makeHass();
  hass.states[ORPHANS].attributes.truncated = 40;
  assert.match(html(render({}, hass)), /class="empty trunc">40 more orphans are not listed here/);
  assert.doesNotMatch(html(render({}, makeHass())), /class="empty trunc"/);
});
