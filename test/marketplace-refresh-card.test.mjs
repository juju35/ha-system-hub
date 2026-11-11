// Unit tests for the card: the card file is evaluated with stubs, no browser needed.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../custom_components/system_hub/frontend/cards/marketplace-refresh-card.js', import.meta.url), 'utf8');

// Elements found in the rendered HTML by a selector: enough to click the check button.
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
      // A class selector found in the rendered HTML (the same node across renders, like a kept focus).
      querySelector: (sel) => {
        const cls = sel.startsWith('.') ? sel.slice(1) : null;
        if (!cls || !new RegExp(`class="(?:[^"]* )?${cls}(?: [^"]*)?"`).test(this.shadowRoot.innerHTML)) return null;
        elements[sel] ||= fakeNode();
        return elements[sel];
      },
      querySelectorAll: () => [],
    };
    return this.shadowRoot;
  },
});
const context = {
  HTMLElement: class {},
  customElements: { get: () => true, define() {} },
  window: {},
  document: { createElement: () => fakeNode() },
  Event: class {
    constructor(type) {
      this.type = type;
    }
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
vm.runInContext(`${source}\nthis.hr = { MarketplaceRefreshCard, MarketplaceRefreshCardEditor, HR_I18N, hrEsc, hrLang, hrLocale, hrDevices, HR_DEFAULTS };`, context);
const { MarketplaceRefreshCard, MarketplaceRefreshCardEditor, HR_I18N, hrEsc, hrLang, hrLocale, hrDevices, HR_DEFAULTS } = context.hr;

const STATUS = 'sensor.system_hub_marketplace_status';
const LAST_CHECK = 'sensor.system_hub_marketplace_last_check';
const BUTTON = 'button.system_hub_marketplace_check_updates';
const minutes = (m) => new Date(Date.now() + m * 60000).toISOString();

const REGISTRY = {
  [STATUS]: { platform: 'system_hub', device_id: 'd1', translation_key: 'marketplace_status' },
  [LAST_CHECK]: { platform: 'system_hub', device_id: 'd1', translation_key: 'marketplace_last_check' },
  [BUTTON]: { platform: 'system_hub', device_id: 'd1', translation_key: 'marketplace_check_updates' },
  // Another System Hub module's status, on its own device: not the Marketplace one
  'sensor.system_hub_git_sync_status': { platform: 'system_hub', device_id: 'd2', translation_key: 'git_sync_status' },
  'update.mushroom_update': { platform: 'marketplace' },
  'update.card_mod_update': { platform: 'marketplace' },
  'update.spook_update': { platform: 'marketplace' },
  'update.core': { platform: 'hassio' },
};

function makeHass({ state = 'idle', attrs = {}, updates = ['update.mushroom_update'], interval = 24, button = 'unknown', language = 'en', admin = true } = {}) {
  const calls = [];
  const states = {
    [STATUS]: { state, attributes: { done: 0, total: 0, updates: updates.length, failed: [], error: null, ...attrs } },
    [LAST_CHECK]: {
      state: minutes(-180),
      attributes: { scan_interval: interval, next_check: interval ? minutes(21 * 60) : null },
    },
    [BUTTON]: { state: button, attributes: {} },
    'update.core': { entity_id: 'update.core', state: 'on', attributes: { title: 'Core' } },
  };
  for (const id of ['update.mushroom_update', 'update.card_mod_update', 'update.spook_update']) {
    const on = updates.includes(id);
    states[id] = {
      entity_id: id,
      state: on ? 'on' : 'off',
      attributes: { title: id.split('.')[1].replace('_update', ''), installed_version: 'v1.0.0', latest_version: on ? 'v1.1.0' : 'v1.0.0' },
    };
  }
  return { calls, language, entities: REGISTRY, states, user: { is_admin: admin }, callService: (...args) => calls.push(args) };
}

function render(config, hass) {
  const card = new MarketplaceRefreshCard();
  card.attachShadow = fakeNode().attachShadow;
  card.style = {};
  card.dispatchEvent = () => {};
  card.setConfig(config);
  card.hass = hass;
  return card;
}

const html = (card) => card.shadowRoot.innerHTML;

const placeholders = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

// Each language's card matches its patterns (strings, relative dates).
function assertRendered(cases) {
  for (const [language, patterns] of Object.entries(cases)) {
    const out = html(render({}, makeHass({ language })));
    for (const re of patterns) assert.match(out, re, language);
  }
}

test('every language has the English keys, arrays of the same length and the same placeholders', () => {
  const keys = Object.keys(HR_I18N.en).sort();
  for (const [lang, strings] of Object.entries(HR_I18N)) {
    // A `<key>_few` plural form (Serbian, Polish) is the only extra key, next to the `<key>_many` it refines.
    const extra = Object.keys(strings).filter((k) => !keys.includes(k));
    for (const k of extra) assert.ok(k.endsWith('_few') && keys.includes(k.replace(/_few$/, '_many')), `${lang}.${k}`);
    for (const k of extra) assert.deepEqual(placeholders(strings[k]), placeholders(HR_I18N.en[k.replace(/_few$/, '_many')]), `${lang}.${k}`);
    assert.deepEqual(Object.keys(strings).filter((k) => keys.includes(k)).sort(), keys, lang);
    for (const k of keys) {
      const en = HR_I18N.en[k];
      if (Array.isArray(en)) assert.equal(strings[k].length, en.length, `${lang}.${k}`);
      assert.deepEqual(placeholders(strings[k]), placeholders(en), `${lang}.${k}`);
      assert.ok(String(strings[k]).trim(), `${lang}.${k} is empty`);
    }
  }
});

test('every language of the integration is in the card', () => {
  assert.deepEqual(Object.keys(HR_I18N).sort(), [
    'bg', 'cs', 'da', 'de', 'el', 'en', 'es', 'fr', 'hu', 'it', 'lv', 'nl', 'pl', 'pt', 'ro', 'ru', 'sk', 'sl', 'sr', 'sr-Latn', 'sv', 'uk',
  ]);
});

test('Romanian to Greek (12 languages): full code, then the part before the dash', () => {
  const regional = {
    'ro-RO': 'ro', 'da-DK': 'da', 'sv-SE': 'sv', 'bg-BG': 'bg', 'ru-RU': 'ru', 'uk-UA': 'uk', 'hu-HU': 'hu',
    'sk-SK': 'sk', 'cs-CZ': 'cs', 'sl-SI': 'sl', 'lv-LV': 'lv', 'el-GR': 'el',
  };
  for (const [language, lang] of Object.entries(regional)) {
    assert.equal(hrLang({ language }, {}), lang, language);
    assert.equal(hrLang({ language: lang }, {}), lang, lang);
  }
  assert.equal(hrLang({ language: 'en' }, { language: 'el' }), 'el');
  assert.equal(hrLocale({ language: 'sv-FI' }, {}), 'sv-FI');
});

test('Romanian to Greek (12 languages): card strings and relative dates', () => {
  const cases = {
    ro: [/Caută actualizări/, /Verificat acum \d+ ore/],
    da: [/Søg efter opdateringer/, /Kontrolleret for \d+ timer siden/],
    sv: [/Sök efter uppdateringar/, /Kontrollerad för \d+ timmar sedan/],
    bg: [/Провери за актуализации/, /Проверено преди \d+ часа/],
    ru: [/Проверить обновления/, /Проверено \d+ час\S* назад/],
    uk: [/Перевірити оновлення/, /Перевірено \d+ годин\S* тому/],
    hu: [/Frissítések keresése/, /Ellenőrizve \d+ órával ezelőtt/],
    sk: [/Skontrolovať aktualizácie/, /Skontrolované pred \d+ hodinami/],
    cs: [/Zkontrolovat aktualizace/, /Zkontrolováno před \d+ hodinami/],
    sl: [/Preveri posodobitve/, /Preverjeno pred \d+ urami/],
    lv: [/Meklēt atjauninājumus/, /Pārbaudīts pirms \d+ stundām/],
    el: [/Έλεγχος για ενημερώσεις/, /Έλεγχος πριν από \d+ ώρες/],
  };
  assertRendered(cases);
});

test('Italian, Dutch, Portuguese and Polish: full code, then the part before the dash, else English', () => {
  assert.equal(hrLang({ language: 'it-IT' }, {}), 'it');
  assert.equal(hrLang({ language: 'nl-BE' }, {}), 'nl');
  assert.equal(hrLang({ language: 'pt' }, {}), 'pt');
  // Brazilian Portuguese falls back to European Portuguese.
  assert.equal(hrLang({ language: 'pt-BR' }, {}), 'pt');
  assert.equal(hrLang({ language: 'pl-PL' }, {}), 'pl');
  assert.equal(hrLang({ language: 'sr-Latn' }, {}), 'sr-Latn');
  assert.equal(hrLang({ language: 'ja' }, {}), 'en');
  assert.equal(hrLang({ language: 'en' }, { language: 'pl' }), 'pl');
});

test('Italian, Dutch, Portuguese and Polish: card strings and relative dates', () => {
  const cases = {
    it: [/Cerca aggiornamenti/, /Verificato \d+ ore fa/],
    nl: [/Controleren op updates/, /Gecontroleerd \d+ uur geleden/],
    pt: [/Procurar atualizações/, /Verificado há \d+ horas/],
    pl: [/Sprawdź aktualizacje/, /Sprawdzono \d+ godzin\w* temu/],
  };
  assertRendered(cases);
});

test('dates use Home Assistant\'s full locale when its base is the card\'s language', () => {
  assert.equal(hrLocale({ language: 'pt-BR' }, {}), 'pt-BR');
  assert.equal(hrLocale({ locale: { language: 'pt-BR' }, language: 'pt' }, {}), 'pt-BR');
  assert.equal(hrLocale({ language: 'fr-CA' }, {}), 'fr-CA');
  assert.equal(hrLocale({ language: 'pt' }, {}), 'pt-PT');
  assert.equal(hrLocale({ locale: { language: 'pt' }, language: 'pt' }, {}), 'pt-PT');
  assert.equal(hrLocale({ language: 'en' }, { language: 'pt' }), 'pt-PT');
  assert.equal(hrLocale({ language: 'pt' }, { language: 'fr' }), 'fr');
  assert.equal(hrLocale({ language: 'pt-BR' }, { language: 'pl' }), 'pl');
  assert.equal(hrLocale({ language: 'ja' }, {}), 'en');
  assert.equal(hrLocale({ language: 'sr-Latn' }, { language: 'sr' }), 'sr');
  assert.equal(hrLocale({ language: 'sr-Latn' }, {}), 'sr-Latn');
});

test('Serbian is there in Cyrillic (sr) and Latin (sr-Latn)', () => {
  assert.ok(HR_I18N.sr && HR_I18N['sr-Latn']);
  // Proper nouns, brands and placeholders are left out of the script check.
  const strip = (s) => String(s).replace(/\{\w+\}|Marketplace|Refresh|Home Assistant|GitHub/g, '');
  for (const [k, s] of Object.entries(HR_I18N.sr)) assert.doesNotMatch(strip(s), /[A-Za-z]/, `sr.${k}: ${s}`);
  for (const [k, s] of Object.entries(HR_I18N['sr-Latn'])) assert.doesNotMatch(s, /[Ѐ-ӿ]/, `sr-Latn.${k}: ${s}`);
});

test('language follows Home Assistant, then the config, with English as fallback', () => {
  assert.equal(hrLang({ language: 'fr-FR' }, {}), 'fr');
  assert.equal(hrLang({ language: 'fr' }, { language: 'es' }), 'es');
  assert.equal(hrLang({ language: 'ja' }, {}), 'en');
  assert.equal(hrLang({ language: 'sr-Latn' }, {}), 'sr-Latn');
  assert.equal(hrLang({ language: 'sr' }, {}), 'sr');
  assert.equal(hrLang({ locale: { language: 'sr-Latn' }, language: 'en' }, {}), 'sr-Latn');
  assert.equal(hrLang({ language: 'sr-Latn' }, { language: 'sr' }), 'sr');
});

test('Serbian in Latin script: card strings and relative dates', () => {
  const lat = html(render({}, makeHass({ language: 'sr-Latn' })));
  assert.match(lat, /Proveri ažuriranja/);
  assert.match(lat, /Provereno pre \d+ sat/);
  assert.doesNotMatch(lat.replace(/<style>[\s\S]*?<\/style>/, ''), /[Ѐ-ӿ]/);
  const cyr = html(render({}, makeHass({ language: 'sr' })));
  assert.match(cyr, /Провери ажурирања/);
  assert.match(cyr, /Проверено пре \d+ сат/);
});

test('editor offers every language, Serbian in both scripts', () => {
  const editor = new MarketplaceRefreshCardEditor();
  editor.appendChild = () => {};
  editor.dispatchEvent = () => {};
  editor.setConfig({});
  editor.hass = makeHass();
  const options = editor._form.schema.find((s) => s.name === 'language').selector.select.options;
  assert.deepEqual(JSON.parse(JSON.stringify(options.map((o) => [o.value, o.label]))), [
    ['en', 'English'],
    ['fr', 'Français'],
    ['de', 'Deutsch'],
    ['es', 'Español'],
    ['sr', 'Српски'],
    ['sr-Latn', 'Srpski (latinica)'],
    ['it', 'Italiano'],
    ['nl', 'Nederlands'],
    ['pt', 'Português (Portugal)'],
    ['pl', 'Polski'],
    ['ro', 'Română'],
    ['da', 'Dansk'],
    ['sv', 'Svenska'],
    ['bg', 'Български'],
    ['ru', 'Русский'],
    ['uk', 'Українська'],
    ['hu', 'Magyar'],
    ['sk', 'Slovenčina'],
    ['cs', 'Čeština'],
    ['sl', 'Slovenščina'],
    ['lv', 'Latviešu'],
    ['el', 'Ελληνικά'],
  ]);
  // Every language of the card is offered.
  assert.deepEqual(JSON.parse(JSON.stringify(options.map((o) => o.value).sort())), Object.keys(HR_I18N).sort());
});

test('entities found by translation key, or by entity ID when it is missing', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(hrDevices(REGISTRY).d1)), { status: STATUS, last_check: LAST_CHECK, button: BUTTON });
  const noKeys = Object.fromEntries(Object.entries(REGISTRY).map(([id, e]) => [id, { ...e, translation_key: undefined }]));
  assert.equal(hrDevices(noKeys).d1.button, BUTTON);
});

test('updates from the Marketplace update entities only, with their versions', () => {
  const out = html(render({}, makeHass({ updates: ['update.mushroom_update', 'update.card_mod_update'] })));
  assert.match(out, /lvl-info/);
  assert.match(out, /2 updates/);
  assert.match(out, /card_mod/);
  assert.match(out, /v1\.0\.0 → v1\.1\.0/);
  assert.doesNotMatch(out, />Core</);
  // Sorted by name.
  assert.ok(out.indexOf('card_mod') < out.indexOf('mushroom'));
});

test('up to date: ok, last and next check', () => {
  const out = html(render({}, makeHass({ updates: [] })));
  assert.match(out, /lvl-ok/);
  assert.match(out, /Up to date/);
  assert.match(out, /Checked 3 hours ago · next in 21 hours/);
  // No update: no "Updates available" section.
  assert.doesNotMatch(out, /Updates available/);
});

test('automatic check off is said so', () => {
  assert.match(html(render({}, makeHass({ interval: 0 }))), /automatic check off/);
});

test('running: progress and disabled button', () => {
  const out = html(render({}, makeHass({ state: 'running', attrs: { done: 12, total: 48 } })));
  assert.match(out, /Checking 12\/48/);
  assert.match(out, /aria-valuenow="25"/);
  assert.match(out, /class="check"[^>]*disabled/);
});

test('failed repositories and a failed check', () => {
  const failed = html(render({}, makeHass({ updates: [], attrs: { failed: ['someone/broken: 404 Not Found'] } })));
  assert.match(failed, /lvl-warn/);
  assert.match(failed, /1 failed/);
  assert.match(failed, /someone\/broken/);
  assert.match(failed, /404 Not Found/);
  const error = html(render({}, makeHass({ state: 'error', attrs: { error: 'rate limited' } })));
  assert.match(error, /lvl-alert/);
  assert.match(error, /The last check failed/);
  assert.match(error, /rate limited/);
  assert.doesNotMatch(html(render({ show_failed: false }, makeHass({ state: 'error', attrs: { error: 'x' } }))), /The last check failed/);
});

test('without a GitHub account connected, the repositories not checked say why, once', () => {
  const out = html(render({}, makeHass({ updates: [], attrs: { failed: ['someone/broken'], not_checked: ['someone/custom', 'other/custom'], github_connected: false } })));
  assert.match(out, /someone\/custom/);
  assert.match(out, /someone\/broken/);
  assert.match(out, /3 failed/);
  assert.equal((out.match(/GitHub isn’t connected to the Marketplace/g) || []).length, 1);
  // Only failures, or nothing at all: no such line.
  assert.doesNotMatch(html(render({}, makeHass({ updates: [], attrs: { failed: ['someone/custom'], github_connected: false } }))), /GitHub isn’t connected/);
  assert.doesNotMatch(html(render({}, makeHass({ updates: [], attrs: { failed: [], not_checked: [], github_connected: false } }))), /GitHub isn’t connected/);
  assert.doesNotMatch(html(render({ show_failed: false }, makeHass({ updates: [], attrs: { not_checked: ['x'], github_connected: false } }))), /GitHub isn’t connected/);
});

test('hide_when_ok hides the card only while everything is up to date', () => {
  const card = render({ hide_when_ok: true }, makeHass({ updates: [] }));
  assert.equal(card.style.display, 'none');
  card.hass = makeHass();
  assert.equal(card.style.display, '');
});

test('check button presses the button', () => {
  const hass = makeHass();
  const card = render({}, hass);
  card.shadowRoot.querySelector('.check').handlers.click();
  assert.equal(JSON.stringify(hass.calls), JSON.stringify([['button', 'press', { entity_id: BUTTON }]]));
  assert.doesNotMatch(html(render({ check_button: false }, makeHass())), /class="check"/);
});

test('not set up: tells so', () => {
  const out = html(render({}, { ...makeHass(), entities: {}, states: {} }));
  assert.match(out, /lvl-na/);
  assert.match(out, /Marketplace Refresh is not set up/);
});

test('names are escaped', () => {
  const out = html(render({ title: '"><img>' }, makeHass({ updates: [], attrs: { failed: ['<b>x</b>'] } })));
  assert.doesNotMatch(out, /<b>x<\/b>/);
  assert.doesNotMatch(out, /"><img>/);
  assert.equal(hrEsc(`<&>"'`), '&lt;&amp;&gt;&quot;&#39;');
});

test('French', () => {
  const out = html(render({}, makeHass({ language: 'fr', updates: ['update.mushroom_update', 'update.spook_update'] })));
  assert.match(out, /2 mises à jour/);
  assert.match(out, /Mises à jour disponibles/);
});

test('no re-render while nothing changed', () => {
  const hass = makeHass();
  const card = render({}, hass);
  card.shadowRoot.innerHTML = 'kept';
  card.hass = { ...hass };
  assert.equal(card.shadowRoot.innerHTML, 'kept');
});

test('editor leaves the defaults out of the YAML', () => {
  const editor = new MarketplaceRefreshCardEditor();
  editor.appendChild = () => {};
  const sent = [];
  editor.dispatchEvent = (ev) => sent.push(ev.detail.config);
  editor.setConfig({});
  editor.hass = makeHass();
  editor._form.dispatch({ ...HR_DEFAULTS, title: '', show_failed: false });
  assert.deepEqual(JSON.parse(JSON.stringify(sent.at(-1))), { show_failed: false });
});

test('the editor only offers the status sensor', () => {
  const editor = new MarketplaceRefreshCardEditor();
  editor.appendChild = () => {};
  editor.setConfig({});
  editor.hass = makeHass();
  const entity = editor._form.schema.find((s) => s.name === 'entity');
  assert.deepEqual(JSON.parse(JSON.stringify(entity.selector.entity.filter)), {
    integration: 'system_hub',
    domain: 'sensor',
    device_class: 'enum',
  });
  // Not the other System Hub modules' status sensors
  assert.deepEqual(JSON.parse(JSON.stringify(entity.selector.entity.include_entities)), [STATUS]);
});

test('an entity that no longer exists (old Marketplace Refresh integration): the module status is used', () => {
  const hass = makeHass({ state: 'error', updates: [], attrs: { error: 'rate limited' } });
  assert.equal(html(render({ entity: 'sensor.marketplace_refresh_status' }, hass)), html(render({}, hass)));
});

test('any entity of the device as `entity` finds its status sensor', () => {
  const hass = makeHass({ state: 'error', updates: [], attrs: { error: 'rate limited', failed: ['someone/broken: 404'] } });
  const auto = html(render({}, hass));
  for (const entity of [STATUS, LAST_CHECK, BUTTON]) {
    const out = html(render({ entity }, hass));
    assert.equal(out, auto, entity);
  }
  assert.match(auto, /lvl-alert/);
  assert.match(auto, /Checked 3 hours ago/);
  assert.match(auto, /class="check"/);
});

test('an entity unknown to the registry is still read as the status sensor', () => {
  const hass = makeHass({ updates: [] });
  const out = html(render({ entity: 'sensor.renamed_status' }, { ...hass, states: { ...hass.states, 'sensor.renamed_status': hass.states[STATUS] } }));
  assert.match(out, /Up to date/);
});

test('status unavailable or unknown: never shown as up to date, never hidden', () => {
  for (const state of ['unavailable', 'unknown']) {
    const hass = makeHass({ updates: [] });
    for (const id of [STATUS, LAST_CHECK, BUTTON]) hass.states[id] = { state, attributes: {} };
    const card = render({ hide_when_ok: true }, hass);
    const out = html(card);
    assert.equal(card.style.display, '', state);
    assert.match(out, /lvl-na/, state);
    assert.match(out, /Unavailable/, state);
    assert.doesNotMatch(out, /Up to date|Not checked yet|Every repository is up to date/, state);
  }
  const fr = makeHass({ language: 'fr' });
  fr.states[STATUS] = { state: 'unavailable', attributes: {} };
  assert.match(html(render({}, fr)), /Indisponible/);
});

test('a next check already due is not shown in the past', () => {
  const hass = makeHass({ updates: [] });
  hass.states[LAST_CHECK] = { state: minutes(-27 * 60), attributes: { scan_interval: 24, next_check: minutes(-3 * 60) } };
  const out = html(render({}, hass));
  assert.match(out, /Checked 27 hours ago/);
  assert.doesNotMatch(out, /next|ago · /);
});

test("the Marketplace's update entities unavailable or missing: the status sensor's count is used, never up to date", () => {
  for (const mode of ['unavailable', 'missing']) {
    const hass = makeHass({ updates: [], attrs: { updates: 2 } });
    for (const id of ['update.mushroom_update', 'update.card_mod_update', 'update.spook_update']) {
      if (mode === 'missing') delete hass.states[id];
      else hass.states[id] = { entity_id: id, state: 'unavailable', attributes: {} };
    }
    const card = render({ hide_when_ok: true }, hass);
    const out = html(card);
    assert.equal(card.style.display, '', mode);
    assert.match(out, /lvl-info/, mode);
    assert.match(out, /2 updates/, mode);
    assert.doesNotMatch(out, /Up to date|Every repository is up to date/, mode);
    assert.match(out, /Marketplace isn’t loaded/, mode);
  }
});

test('one Marketplace update entity known is enough: the entities stay the truth', () => {
  const hass = makeHass({ updates: [], attrs: { updates: 2 } });
  hass.states['update.spook_update'] = { entity_id: 'update.spook_update', state: 'unavailable', attributes: {} };
  const out = html(render({}, hass));
  assert.match(out, /Up to date/);
});

test('update entities coming back re-render the card', () => {
  const hass = makeHass({ updates: [], attrs: { updates: 2 } });
  const ids = ['update.mushroom_update', 'update.card_mod_update', 'update.spook_update'];
  const back = { ...hass.states };
  for (const id of ids) hass.states[id] = { entity_id: id, state: 'unavailable', attributes: {} };
  const card = render({}, hass);
  assert.match(html(card), /2 updates/);
  card.hass = { ...hass, states: back };
  assert.match(html(card), /Up to date/);
});

test('a re-render keeps the keyboard focus on the check button and on an update row', () => {
  const card = render({}, makeHass());
  const check = card.shadowRoot.querySelector('.check');
  let focused = null;
  check.focus = () => {
    focused = 'check';
  };
  card.shadowRoot.activeElement = { classList: { contains: (c) => c === 'check' }, dataset: {} };
  // Pressing it starts a check: the button is busy, but stays focusable and ignores presses.
  const hass = makeHass({ state: 'running', attrs: { done: 1, total: 4 } });
  card.hass = hass;
  assert.equal(focused, 'check');
  assert.match(html(card), /class="check"[^>]*aria-disabled="true"/);
  assert.doesNotMatch(html(card), /class="check"[^>]*\sdisabled/);
  check.handlers.click();
  assert.equal(hass.calls.length, 0);

  const row = { dataset: { id: 'update.mushroom_update' }, addEventListener() {}, focus: () => (focused = row.dataset.id) };
  card.shadowRoot.querySelectorAll = (sel) => (sel === '.row[data-id]' ? [row] : []);
  card.shadowRoot.activeElement = { classList: { contains: () => false }, dataset: { id: 'update.mushroom_update' } };
  card.hass = makeHass({ updates: ['update.mushroom_update', 'update.spook_update'] });
  assert.equal(focused, 'update.mushroom_update');
});

test('focus given back after a re-render never scrolls the page', () => {
  // A hass update re-renders the card while the user scrolled away: focus({ preventScroll: true }) keeps the page still.
  const card = render({}, makeHass({ updates: ['update.mushroom_update', 'update.card_mod_update'] }));
  const calls = [];
  const spy = (name) => (opts) => calls.push([name, opts]);
  card.shadowRoot.querySelector('.check').focus = spy('check');
  card.shadowRoot.activeElement = { classList: { contains: (c) => c === 'check' }, dataset: {} };
  card.hass = makeHass({ state: 'running', attrs: { done: 1, total: 4 } });
  const row = { dataset: { id: 'update.mushroom_update' }, addEventListener() {}, focus: spy('row') };
  card.shadowRoot.querySelectorAll = (sel) => (sel === '.row[data-id]' ? [row] : []);
  card.shadowRoot.activeElement = { classList: { contains: () => false }, dataset: { id: 'update.mushroom_update' } };
  card.hass = makeHass({ updates: ['update.mushroom_update', 'update.spook_update'] });
  // The confirmation: focus on its safe choice when it opens, back on the button when it closes, kept across a re-render.
  card.shadowRoot.querySelectorAll = () => [];
  card.shadowRoot.querySelector('.install').focus = spy('install');
  card.shadowRoot.querySelector('.install').handlers.click();
  card.shadowRoot.querySelector('.confirm-no').focus = spy('confirm-no');
  card.shadowRoot.querySelector('.install').handlers.click();
  card.shadowRoot.activeElement = { classList: { contains: (c) => c === 'confirm-no' }, dataset: {} };
  card.hass = makeHass({ updates: ['update.mushroom_update', 'update.card_mod_update', 'update.spook_update'] });
  card.shadowRoot.querySelector('.confirm-no').handlers.click();
  const names = calls.map(([n]) => n);
  for (const n of ['check', 'row', 'confirm-no', 'install']) assert.ok(names.includes(n), n);
  for (const [name, opts] of calls) assert.equal(JSON.stringify(opts), '{"preventScroll":true}', name);
});

test('intrinsic width: never collapses in an inline-block or auto column, still shrinks in a 1fr grid', () => {
  const css = MarketplaceRefreshCard.styles.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');
  const host = css.match(/:host \{([^}]*)\}/)[1];
  const card = css.match(/ ha-card \{([^}]*)\}/)[1];
  // The size container is ha-card (inside the host); an empty zero-height grid gives the host a natural width so a
  // shrink-to-fit parent doesn't drop the card to its padding...
  assert.match(card, /container-type: inline-size/);
  assert.doesNotMatch(host, /container/);
  const before = css.match(/:host::before \{([^}]*)\}/)?.[1];
  assert.ok(before, ':host::before');
  assert.match(before, /display: grid;/);
  assert.match(before, /grid-template-columns: minmax\(0, \d+px\)/);
  assert.match(before, /height: 0/);
  // ...without a minimum: in a 1fr 1fr grid, even wrapped in a div, the card shrinks (no px min-width, no contain-intrinsic).
  assert.match(host, /min-width: 0;/);
  assert.doesNotMatch(host, /min-width: [1-9]/);
  assert.doesNotMatch(css, /contain-intrinsic/);
});

// WCAG contrast of the coloured text and status icons, with Home Assistant's default light and dark themes.
test('coloured text reaches 4.5:1 and status icons 3:1, light and dark', () => {
  const hex = (h) => [1, 3, 5].map((i) => Number.parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, p) => a.map((v, i) => v * p + b[i] * (1 - p));
  const lum = (c) => {
    const [r, g, b] = c.map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
    return (x + 0.05) / (y + 0.05);
  };
  const css = MarketplaceRefreshCard.styles.replace(/\s+/g, ' ');
  // The `color` of a rule: a state colour, or a color-mix of it with the text colour.
  const colorOf = (selector, state, text) => {
    const body = css.slice(css.indexOf(`${selector} {`)).match(/\{([^}]*)\}/)[1];
    const value = body.match(/(?:^|;)\s*color:\s*([^;]+)/)[1].trim();
    const m = value.match(/^color-mix\(in srgb, var\(--[\w-]+\) (\d+)%, var\(--primary-text-color, #\w+\)\)$/);
    if (m) return mix(hex(state), hex(text), Number(m[1]) / 100);
    assert.match(value, /^var\(--[\w-]+\)$/, selector);
    return hex(state);
  };
  const themes = { light: { card: '#ffffff', text: '#212121', sec: '#e5e5e5' }, dark: { card: '#1c1c1c', text: '#e1e1e1', sec: '#282828' } };
  const states = { ok: '#43a047', info: '#039be5', warn: '#ffa600', alert: '#db4437', na: '#9e9e9e' };
  for (const [name, t] of Object.entries(themes)) {
    const card = hex(t.card);
    for (const [lvl, c] of Object.entries(states)) {
      assert.ok(ratio(colorOf('.pill', c, t.text), mix(hex(c), card, 0.14)) >= 4.5, `${name} pill ${lvl}`);
      assert.ok(ratio(colorOf('.badge', c, t.text), mix(hex(c), card, 0.16)) >= 3, `${name} badge ${lvl}`);
    }
    const warnRow = mix(hex(states.warn), hex(t.sec), 0.12);
    assert.ok(ratio(colorOf('.row.warn .sub', states.warn, t.text), warnRow) >= 4.5, `${name} failed row`);
    assert.ok(ratio(colorOf('.ic', states.warn, t.text), mix(hex(states.warn), warnRow, 0.18)) >= 3, `${name} failed icon`);
    assert.ok(ratio(colorOf('.ic', states.info, t.text), mix(hex(states.info), hex(t.sec), 0.18)) >= 3, `${name} update icon`);
    assert.ok(ratio(colorOf('.install, .cbtns button', states.info, t.text), card) >= 4.5, `${name} update all button`);
    const confirmBg = mix(hex(states.info), hex(t.sec), 0.12);
    assert.ok(ratio(colorOf('.confirm > ha-icon', states.info, t.text), confirmBg) >= 3, `${name} confirmation icon`);
    const errorBg = mix(hex(states.alert), hex(t.sec), 0.12);
    assert.ok(ratio(colorOf('.error b', states.alert, t.text), errorBg) >= 4.5, `${name} error title`);
  }
});

test('the updates section counts the updates', () => {
  const out = html(render({}, makeHass({ updates: ['update.mushroom_update', 'update.card_mod_update'] })));
  assert.match(out, /Updates available <span class="count">· 2<\/span>/);
  assert.doesNotMatch(html(render({}, makeHass({ updates: [] }))), /class="count"/);
});

test('update all: asks first, then installs the updates listed', () => {
  const hass = makeHass({ updates: ['update.mushroom_update', 'update.card_mod_update'] });
  const card = render({}, hass);
  assert.match(html(card), /Update all \(2\)/);
  card.shadowRoot.querySelector('.install').handlers.click();
  assert.match(html(card), /Install 2 updates\?/);
  assert.equal(hass.calls.length, 0);
  card.shadowRoot.querySelector('.confirm-no').handlers.click();
  assert.doesNotMatch(html(card), /class="confirm"/);
  card.shadowRoot.querySelector('.install').handlers.click();
  card.shadowRoot.querySelector('.confirm-yes').handlers.click();
  assert.equal(
    JSON.stringify(hass.calls),
    JSON.stringify([['system_hub', 'marketplace_install_updates', { entity_id: ['update.card_mod_update', 'update.mushroom_update'] }]]),
  );
  assert.doesNotMatch(html(card), /class="confirm"/);
});

test('update all: only for administrators, with updates, and when enabled', () => {
  assert.doesNotMatch(html(render({}, makeHass({ admin: false }))), /Update all/);
  assert.doesNotMatch(html(render({}, makeHass({ updates: [] }))), /Update all/);
  assert.doesNotMatch(html(render({ install_button: false }, makeHass())), /Update all/);
});

test('installing: progress in the pill and on the rows, failures listed', () => {
  const hass = makeHass({ updates: ['update.mushroom_update', 'update.card_mod_update'], attrs: { installing: ['update.mushroom_update'] } });
  const out = html(render({}, hass));
  assert.match(out, /Installing… 1 left/);
  assert.match(out, /class="install busy"/);
  assert.match(out, /class="check"[^>]*aria-disabled="true"/);
  assert.doesNotMatch(out, /Update all/);
  assert.match(out, /class="row upd busy" data-id="update\.mushroom_update"/);
  assert.match(out, /class="row upd" data-id="update\.card_mod_update"/);
  const failed = html(render({}, makeHass({ attrs: { install_failed: ['Mushroom: download failed'] } })));
  assert.match(failed, /lvl-warn/);
  assert.match(failed, /Could not be installed/);
  assert.match(failed, /download failed/);
});

test('the confirmation closes when the updates are gone', () => {
  const card = render({}, makeHass());
  card.shadowRoot.querySelector('.install').handlers.click();
  assert.match(html(card), /class="confirm"/);
  card.hass = makeHass({ updates: [] });
  assert.doesNotMatch(html(card), /class="confirm"/);
});

// The pill's text for `updates` updates, `failed` failed repositories or `installing` installs left.
const pill = (language, { updates = 0, failed = 0, installing = 0 } = {}) => {
  const card = render({}, makeHass({ language }));
  const list = (n, p) => Array.from({ length: n }, (_, i) => `${p}${i}`);
  return card._status({ state: 'idle' }, false, {}, updates, list(failed, 'repo'), null, list(installing, 'update.x'));
};

test('installing: the singular for the last install, in every language', () => {
  assert.equal(pill('it', { installing: 1 }), 'Installazione… 1 rimanente');
  assert.equal(pill('it', { installing: 2 }), 'Installazione… 2 rimanenti');
  assert.equal(pill('es', { installing: 1 }), 'Instalando… queda 1');
  assert.equal(pill('es', { installing: 5 }), 'Instalando… quedan 5');
  assert.equal(pill('pt', { installing: 1 }), 'A instalar… falta 1');
  assert.equal(pill('pt', { installing: 2 }), 'A instalar… faltam 2');
  assert.equal(pill('fr', { installing: 1 }), 'Installation… 1 restante');
  assert.equal(pill('fr', { installing: 3 }), 'Installation… 3 restantes');
  assert.equal(pill('en', { installing: 1 }), 'Installing… 1 left');
});

test('1 is singular in every language', () => {
  for (const lang of Object.keys(HR_I18N)) {
    const s = HR_I18N[lang];
    assert.equal(pill(lang, { updates: 1 }), s.updates_one.replace('{n}', '1'), `${lang} updates`);
    assert.equal(pill(lang, { failed: 1 }), s.failed_one.replace('{n}', '1'), `${lang} failed`);
    assert.equal(pill(lang, { installing: 1 }), s.installing_one.replace('{n}', '1'), `${lang} installing`);
  }
});

test('Serbian and Polish plurals: 1, 2-4 and 5+ (21, 22 like 1 and 2 where the language says so)', () => {
  const cases = {
    sr: { failed: ['1 неуспешан', '2 неуспешна', '5 неуспешних', '21 неуспешан', '22 неуспешна'] },
    'sr-Latn': { failed: ['1 neuspešan', '2 neuspešna', '5 neuspešnih', '21 neuspešan', '22 neuspešna'] },
    pl: { updates: ['1 aktualizacja', '2 aktualizacje', '5 aktualizacji', '21 aktualizacji', '22 aktualizacje'] },
    en: { updates: ['1 update', '2 updates', '5 updates', '21 updates', '22 updates'] },
  };
  for (const [lang, byKind] of Object.entries(cases)) {
    for (const [kind, expected] of Object.entries(byKind)) {
      assert.deepEqual([1, 2, 5, 21, 22].map((n) => pill(lang, { [kind]: n })), expected, `${lang} ${kind}`);
    }
  }
});

test('Polish confirmation: 1, 2-4 and 5+', () => {
  const ask = (n) => {
    const card = render({ language: 'pl' }, makeHass());
    return card._confirmBox(n).match(/<b>([^<]*)<\/b>/)[1];
  };
  assert.deepEqual([1, 2, 5, 22].map(ask), [
    'Zainstalować 1 aktualizację?',
    'Zainstalować 2 aktualizacje?',
    'Zainstalować 5 aktualizacji?',
    'Zainstalować 22 aktualizacje?',
  ]);
});

test('plurals: a locale Intl refuses still renders (singular for 1)', () => {
  assert.equal(pill('pl-@@', { updates: 1 }), '1 aktualizacja');
  assert.equal(pill('pl-@@', { updates: 5 }), '5 aktualizacji');
});

test('narrow header: the title keeps a few characters, the pill shrinks to a dot, nothing leaves the card', () => {
  const css = MarketplaceRefreshCard.styles.replace(/\s+/g, ' ');
  const rule = (selector, from = 0) => {
    const i = css.indexOf(` ${selector} {`, from);
    assert.ok(i >= 0, `${selector} rule`);
    return css.slice(i).match(/\{([^}]*)\}/)[1];
  };
  assert.match(rule('.heading'), /flex: 1 1 0%/);
  assert.match(rule('.heading'), /min-width: [4-9]ch/);
  assert.match(rule('.title'), /text-overflow: ellipsis/);
  const pillRule = rule('.pill');
  assert.match(pillRule, /flex: 0 1 auto/);
  assert.match(pillRule, /min-width: 0/);
  // No cap on the pill: it is only truncated when the header really has no room for its label.
  assert.doesNotMatch(pillRule, /max-width/);
  assert.match(rule('.ptext'), /text-overflow: ellipsis/);
  assert.match(rule('.check'), /flex: none/);
  assert.match(rule('.install, .cbtns button'), /flex: none/);
  assert.match(rule('.install'), /max-width: 100%/);
  assert.match(rule('.shead'), /flex-wrap: wrap/);
  assert.match(rule('ha-card'), /container-type: inline-size/);
  // The dot when the label is cut (class set by _fitPill), the text kept for screen readers (not display: none).
  assert.match(rule('.pill.compact .dot'), /display: block/);
  assert.doesNotMatch(rule('.pill.compact .ptext'), /display: none/);
  assert.match(rule('.pill.compact .ptext'), /clip-path: inset\(50%\)/);
  // A phone's 6 columns (156 px card, 132 px of content): the dot sits on the badge's corner, out of the header's row,
  // so badge + title + check button fit (it was pushed 13 px out of the card at 160 px).
  const six = css.indexOf('@container (max-width: 170px)');
  assert.ok(six >= 0, '6-column container query');
  assert.match(rule('.pill, .pill.compact', six), /position: absolute/);
  assert.match(rule('.dot', six), /display: block/);
  assert.match(rule('.ptext', six), /clip-path: inset\(50%\)/);
  assert.match(rule('.badge', six), /width: 32px/);
  assert.match(rule('.head'), /position: relative/);
  // The pill's full text in its tooltip.
  const out = html(render({}, makeHass({ updates: ['update.mushroom_update', 'update.card_mod_update'], attrs: { failed: ['a/b'] } })));
  assert.match(out, /<div class="pill" title="2 updates · 1 failed"><span class="dot" aria-hidden="true"><\/span><span class="ptext">2 updates · 1 failed<\/span><\/div>/);
});

// A stand-in for the rendered pill: its label is cut when its full width is more than the room it is given.
const fakePill = (scrollWidth, clientWidth) => {
  const cls = new Set();
  const ptext = { scrollWidth, clientWidth };
  const pill = {
    classList: {
      contains: (c) => cls.has(c),
      remove: (c) => cls.delete(c),
      toggle: (c, on) => (on ? cls.add(c) : cls.delete(c)),
    },
    querySelector: (sel) => (sel === '.ptext' ? ptext : null),
  };
  return { pill, ptext };
};

test('the pill shrinks to its dot only when its whole label does not fit', () => {
  const card = render({}, makeHass({ updates: ['update.mushroom_update'] }));
  const fit = (scroll, client, was = false) => {
    const { pill } = fakePill(scroll, client);
    if (was) pill.classList.toggle('compact', true);
    card.shadowRoot.querySelector = (sel) => (sel === '.pill' ? pill : null);
    card._fitPill();
    return pill.classList.contains('compact');
  };
  // A label that fits keeps its words (a short "Error" on a 245 px card used to be a dot)...
  assert.equal(fit(40, 40), false);
  assert.equal(fit(40, 80), false);
  // ...measured with its words, not as the dot it was before (a wider card gives it its label back)...
  assert.equal(fit(60, 60, true), false);
  // ...and only a label really cut turns into the dot.
  assert.equal(fit(135, 134), true);
  // No pill (not set up yet): nothing to do.
  card.shadowRoot.querySelector = () => null;
  assert.doesNotThrow(() => card._fitPill());
  // No fixed width threshold for the dot any more: the label decides, not the card's width.
  const css = MarketplaceRefreshCard.styles.replace(/\s+/g, ' ');
  assert.doesNotMatch(css, /@container \(max-width: 240px\)/);
  assert.match(css, /\.pill\.compact \.dot \{ display: block; \}/);
  assert.match(css, /\.pill\.compact \.ptext \{[^}]*clip-path: inset\(50%\)/);
});

test('the pill is fitted again when the card changes width, without a browser it is left alone', () => {
  const observed = [];
  class FakeObserver {
    constructor(fn) {
      this.fn = fn;
    }
    observe(el) {
      observed.push(el);
    }
    disconnect() {
      observed.length = 0;
    }
  }
  context.ResizeObserver = FakeObserver;
  try {
    const card = render({}, makeHass({ updates: ['update.mushroom_update'] }));
    let fits = 0;
    card._fitPill = () => fits++;
    card.connectedCallback();
    assert.deepEqual(observed, [card]);
    fits = 0;
    card._ro.fn();
    assert.equal(fits, 1);
    card.disconnectedCallback();
    assert.equal(observed.length, 0);
  } finally {
    delete context.ResizeObserver;
  }
  // Node, no ResizeObserver: connecting the card does not throw.
  const card = render({}, makeHass({ updates: ['update.mushroom_update'] }));
  assert.doesNotThrow(() => card.connectedCallback());
  assert.doesNotThrow(() => card.disconnectedCallback());
});

test("a phone's 6 columns: the version and Update all wrap instead of being cut", () => {
  const css = MarketplaceRefreshCard.styles.replace(/\s+/g, ' ');
  const cq = css.indexOf('@container (max-width: 200px)');
  assert.ok(cq >= 0, 'narrow container query');
  const block = css.slice(cq, css.indexOf('} }', cq) + 3);
  assert.match(block, /\.sub \{[^}]*white-space: normal/);
  assert.match(block, /\.ilabel \{[^}]*white-space: normal/);
  // The version breaks around its arrow ("v1.13.0 →" / "v1.14.1"), never inside a version unless it can't fit.
  assert.match(block, /\.sub \{[^}]*overflow-wrap: anywhere/);
});

test('hide_when_ok: the hidden card shows again in edit mode and in the editor preview', () => {
  const card = render({ hide_when_ok: true }, makeHass({ updates: [] }));
  const events = [];
  card.dispatchEvent = (ev) => events.push(ev.type);
  assert.equal(card.style.display, 'none');
  card.editMode = true;
  assert.equal(card.style.display, '');
  card.editMode = false;
  assert.equal(card.style.display, 'none');
  card.preview = true;
  assert.equal(card.style.display, '');
  assert.deepEqual(events, ['card-visibility-changed', 'card-visibility-changed', 'card-visibility-changed']);
});

test('an update without a title is named after its device, not its bare friendly_name', () => {
  const hass = makeHass();
  const id = 'update.mushroom_update';
  hass.states[id].attributes = { ...hass.states[id].attributes, title: undefined, friendly_name: 'Update' };
  hass.entities = { ...hass.entities, [id]: { ...hass.entities[id], device_id: 'dm' } };
  hass.devices = { dm: { name: 'Mushroom' } };
  assert.match(html(render({}, hass)), /Mushroom/);
  hass.devices = { dm: { name: 'Mushroom', name_by_user: 'Mushroom cards' } };
  assert.match(html(render({}, hass)), /Mushroom cards/);
  hass.devices = {};
  assert.match(html(render({}, hass)), /Update/);
});

test('few GitHub requests left: a line until the limit resets, nothing otherwise', () => {
  const low = html(render({}, makeHass({ attrs: { rate_limit_remaining: 1020, rate_limit_reset: minutes(20) } })));
  assert.match(low, /class="rate"/);
  assert.match(low, /Few GitHub requests left \(1020\): checks wait until the limit resets in 20 minutes/);
  // Plenty left, the reset passed, or no figure (no GitHub account): no line.
  assert.doesNotMatch(html(render({}, makeHass({ attrs: { rate_limit_remaining: 4200, rate_limit_reset: minutes(20) } }))), /class="rate"/);
  assert.doesNotMatch(html(render({}, makeHass({ attrs: { rate_limit_remaining: 300, rate_limit_reset: minutes(-5) } }))), /class="rate"/);
  assert.doesNotMatch(html(render({}, makeHass({ attrs: { rate_limit_remaining: null, rate_limit_reset: null } }))), /class="rate"/);
});
