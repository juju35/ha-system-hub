// Unit tests for the card: the card file is evaluated with stubs, no browser needed.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../custom_components/system_hub/frontend/cards/git-sync-card.js', import.meta.url), 'utf8');

// Elements found in the rendered HTML by an id or class: enough to click the buttons and type a message.
// They also track the shadow root's activeElement, to check that a re-render keeps the keyboard focus.
const fakeElement = (root, sel) => ({
  handlers: {},
  value: '',
  id: sel.startsWith('#') ? sel.slice(1) : '',
  classList: { contains: (c) => sel === `.${c}` },
  addEventListener(type, fn) {
    this.handlers[type] = fn;
  },
  click() {
    this.handlers.click?.({});
  },
  key(key) {
    const ev = { key, prevented: false, preventDefault() {
      this.prevented = true;
    } };
    this.handlers.keydown?.(ev);
    return ev;
  },
  focus(options) {
    root.activeElement = this;
    (root.focusCalls ||= []).push({ target: sel, options });
  },
});
const fakeNode = () => ({
  innerHTML: '',
  style: {},
  handlers: {},
  addEventListener(type, fn) {
    this.handlers[type] = fn;
  },
  appendChild() {},
  dispatch(value) {
    this.handlers['value-changed']({ detail: { value } });
  },
  attachShadow() {
    const elements = {};
    const root = {
      innerHTML: '',
      elements,
      querySelector: (sel) => {
        const html = root.innerHTML;
        const present = sel.startsWith('#') ? html.includes(`id="${sel.slice(1)}"`) : html.includes(`class="${sel.slice(1)}`) || html.includes(` ${sel.slice(1)}"`);
        if (!present) return null;
        elements[sel] ||= fakeElement(root, sel);
        return elements[sel];
      },
    };
    // Each render replaces the DOM: forget the elements of the previous one.
    let inner = '';
    Object.defineProperty(root, 'innerHTML', {
      get: () => inner,
      set: (v) => {
        inner = v;
        root.activeElement = null;
        for (const k of Object.keys(elements)) delete elements[k];
      },
    });
    this.shadowRoot = root;
    return root;
  },
});

const context = {
  HTMLElement: class {},
  customElements: { get: () => true, define() {} },
  window: {},
  document: { createElement: () => fakeNode() },
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
  `${source}\nthis.gs = { GitSyncCard, GitSyncCardEditor, GitSyncMiniCard, GitSyncMiniCardEditor, GitSyncDiffDialog, GS_I18N, gsEsc, gsLang, gsLocale, gsDevices, gsRepo, GS_DEFAULTS };`,
  context,
);
const { GitSyncCard, GitSyncCardEditor, GitSyncMiniCard, GitSyncMiniCardEditor, GitSyncDiffDialog, GS_I18N, gsEsc, gsLang, gsLocale, gsDevices, gsRepo } = context.gs;

const STATUS = 'sensor.system_hub_git_sync_status';
const LAST_COMMIT = 'sensor.system_hub_git_sync_last_commit';
const LAST_PUSH = 'sensor.system_hub_git_sync_last_push';
const LAST_EXPORT = 'sensor.system_hub_git_sync_last_export';
const COMMIT = 'button.system_hub_git_sync_commit_and_push';

const minutesAgo = (m) => new Date(Date.now() - m * 60000).toISOString();

const REGISTRY = {
  [STATUS]: { platform: 'system_hub', device_id: 'd1', translation_key: 'git_sync_status' },
  [LAST_COMMIT]: { platform: 'system_hub', device_id: 'd1', translation_key: 'git_sync_last_commit' },
  [LAST_PUSH]: { platform: 'system_hub', device_id: 'd1', translation_key: 'git_sync_last_push' },
  [LAST_EXPORT]: { platform: 'system_hub', device_id: 'd1', translation_key: 'git_sync_last_export' },
  [COMMIT]: { platform: 'system_hub', device_id: 'd1', translation_key: 'git_sync_commit_push' },
  'sensor.other': { platform: 'demo', device_id: 'd2' },
  // Another System Hub module's status, on its own device: not the Git Sync one
  'sensor.system_hub_marketplace_status': { platform: 'system_hub', device_id: 'd3', translation_key: 'marketplace_status' },
};

function makeHass({
  status = 'clean',
  files = [],
  error = null,
  language = 'en',
  response,
  aiTask = null,
  admin = true,
  ahead = ['ahead', 'diverged'].includes(status) ? 1 : 0,
  behind = ['behind', 'diverged'].includes(status) ? 1 : 0,
} = {}) {
  const calls = [];
  return {
    calls,
    language,
    user: { is_admin: admin },
    entities: REGISTRY,
    devices: { d1: { config_entries: ['entry1'] } },
    states: {
      [STATUS]: {
        state: status,
        attributes: {
          branch: 'main',
          remote_url: 'git@github.com:me/homeassistant-config.git',
          changed_count: files.length,
          changed_files: files,
          ahead,
          behind,
          last_error: error,
          ai_task: aiTask,
        },
      },
      [LAST_COMMIT]: {
        state: minutesAgo(42),
        attributes: { message: 'feat(corridor): lower the night light threshold', short_sha: '3f9c2ab' },
      },
      [LAST_PUSH]: { state: minutesAgo(42), attributes: { message: 'x' } },
      [LAST_EXPORT]: { state: 'unknown', attributes: {} },
    },
    callService: async (...args) => {
      calls.push(args);
      return { response: response ?? { committed: true, message: 'fix: typo' } };
    },
  };
}

function render(config, hass, Card = GitSyncCard) {
  const card = new Card();
  card.attachShadow = fakeNode().attachShadow;
  card.style = {};
  card.toasts = [];
  card.dispatchEvent = (ev) => card.toasts.push(ev.detail?.message);
  card.setConfig(config);
  card.hass = hass;
  return card;
}

const html = (card) => card.shadowRoot.innerHTML;

test('every language has the English keys and placeholders', () => {
  const keys = Object.keys(GS_I18N.en).sort();
  const placeholders = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  assert.deepEqual(
    Object.keys(GS_I18N).sort(),
    ['bg', 'cs', 'da', 'de', 'el', 'en', 'es', 'fr', 'hu', 'it', 'lv', 'nl', 'pl', 'pt', 'ro', 'ru', 'sk', 'sl', 'sr', 'sr-Latn', 'sv', 'uk'],
  );
  for (const [lang, strings] of Object.entries(GS_I18N)) {
    assert.deepEqual(Object.keys(strings).sort(), keys, lang);
    for (const key of keys) {
      assert.equal(typeof strings[key], typeof GS_I18N.en[key], `${lang}.${key}`);
      assert.ok(strings[key].trim(), `${lang}.${key}: empty`);
      assert.deepEqual(placeholders(strings[key]), placeholders(GS_I18N.en[key]), `${lang}.${key}: placeholders`);
    }
  }
});

test('Serbian: the Cyrillic and Latin cards say the same thing, letter for letter', () => {
  const cyr = 'абвгдђежзијклљмнњопрстћуфхцчџш';
  const lat = ['a', 'b', 'v', 'g', 'd', 'đ', 'e', 'ž', 'z', 'i', 'j', 'k', 'l', 'lj', 'm', 'n', 'nj', 'o', 'p', 'r', 's', 't', 'ć', 'u', 'f', 'h', 'c', 'č', 'dž', 'š'];
  const map = new Map();
  [...cyr].forEach((c, i) => {
    map.set(c, lat[i]);
    map.set(c.toUpperCase(), lat[i][0].toUpperCase() + lat[i].slice(1));
  });
  // Latin words left in Cyrillic are names and Git terms of the English card (Git Sync, commit, push, Enter…).
  const english = Object.values(GS_I18N.en).join(' ').toLowerCase();
  for (const [key, text] of Object.entries(GS_I18N.sr)) {
    assert.equal([...text].map((c) => map.get(c) ?? c).join(''), GS_I18N['sr-Latn'][key], key);
    assert.doesNotMatch(GS_I18N['sr-Latn'][key], /[\u0400-\u04ff]/, key);
    for (const word of text.match(/[A-Za-z]+/g) || []) assert.ok(english.includes(word.toLowerCase()), `${key}: ${word}`);
  }
});

test('Serbian: a file count reads right for any number', () => {
  // The noun changes form after 2–4 and after 5+: the count goes after a colon, not before it.
  assert.equal(GS_I18N.sr.files_many, 'Датотека: {n}');
  assert.equal(GS_I18N['sr-Latn'].files_many, 'Datoteka: {n}');
  for (const key of ['confirm_text_many', 'exported_many']) assert.match(GS_I18N.sr[key], /: \{n\}\.?$/, key);
});

test('language follows Home Assistant, then the config, with English as fallback', () => {
  assert.equal(gsLang({ language: 'fr-FR' }, {}), 'fr');
  assert.equal(gsLang({ language: 'fr' }, { language: 'de' }), 'de');
  assert.equal(gsLang({ language: 'ja' }, {}), 'en');
});

test('language: exact code, then the part before the dash, then English', () => {
  assert.equal(gsLang({ language: 'fr-FR' }, {}), 'fr');
  assert.equal(gsLang({ language: 'sr-Latn' }, {}), 'sr-Latn');
  assert.equal(gsLang({ locale: { language: 'sr-Latn' }, language: 'sr' }, {}), 'sr-Latn');
  assert.equal(gsLang({ language: 'sr' }, {}), 'sr');
  assert.equal(gsLang({ language: 'sr-Cyrl' }, {}), 'sr');
  assert.equal(gsLang({ language: 'zh-Hant' }, {}), 'en');
  assert.equal(gsLang({ language: 'en' }, { language: 'sr-Latn' }), 'sr-Latn');
});

test('language: Italian, Dutch, Portuguese and Polish, regional variants included', () => {
  assert.equal(gsLang({ language: 'it-IT' }, {}), 'it');
  assert.equal(gsLang({ language: 'nl-BE' }, {}), 'nl');
  assert.equal(gsLang({ language: 'pt' }, {}), 'pt');
  // Brazilian Portuguese falls back to the European Portuguese strings, not to English.
  assert.equal(gsLang({ language: 'pt-BR' }, {}), 'pt');
  assert.equal(gsLang({ language: 'pl-PL' }, {}), 'pl');
  assert.equal(gsLang({ language: 'sr-Latn' }, {}), 'sr-Latn');
  assert.equal(gsLang({ language: 'ja' }, {}), 'en');
});

test('Polish: a file count reads right for any number', () => {
  // Like Serbian, the noun changes form after 2–4 and after 5+: the count goes after a colon.
  assert.equal(GS_I18N.pl.files_many, 'Pliki: {n}');
  for (const key of ['confirm_text_many', 'exported_many']) assert.match(GS_I18N.pl[key], /: \{n\}\.?$/, key);
  const card = render({}, makeHass({ language: 'pl', status: 'dirty', files: ['a.yaml', 'b.yaml', 'c.yaml', 'd.yaml', 'e.yaml'] }));
  assert.match(html(card), /Pliki: 5/);
  assert.match(html(card), /Ostatni push/);
});

test('dates use Home Assistant\'s regional locale when it matches the card\'s language', () => {
  assert.equal(gsLocale({ language: 'pt' }, {}), 'pt-PT');
  assert.equal(gsLocale({ language: 'pt-BR' }, {}), 'pt-BR');
  assert.equal(gsLocale({ locale: { language: 'nl-BE' }, language: 'nl' }, {}), 'nl-BE');
  assert.equal(gsLocale({ language: 'fr-CA' }, { language: 'pt' }), 'pt-PT');
  assert.equal(gsLocale({ language: 'sr-Latn' }, { language: 'sr' }), 'sr');
  assert.equal(gsLocale({ language: 'sr-Latn' }, {}), 'sr-Latn');
  assert.equal(gsLocale({ language: 'ja' }, {}), 'en');
});

test('European Portuguese wording', () => {
  const card = render({}, makeHass({ language: 'pt-PT', status: 'dirty', files: ['a.yaml', 'b.yaml'] }));
  assert.match(html(card), /2 ficheiros/);
  assert.doesNotMatch(Object.values(GS_I18N.pt).join(' '), /arquivo|tela|usuário|configurações/i);
});

test('language: the twelve languages added in 1.1.1, regional variants included', () => {
  for (const lang of ['ro', 'da', 'sv', 'bg', 'ru', 'uk', 'hu', 'sk', 'cs', 'sl', 'lv', 'el']) {
    assert.equal(gsLang({ language: lang }, {}), lang);
  }
  assert.equal(gsLang({ language: 'sv-FI' }, {}), 'sv');
  assert.equal(gsLang({ language: 'ru-UA' }, {}), 'ru');
  assert.equal(gsLang({ language: 'el-CY' }, {}), 'el');
  assert.equal(gsLocale({ language: 'sv-FI' }, {}), 'sv-FI');
  assert.equal(gsLocale({ language: 'en' }, { language: 'uk' }), 'uk');
});

test('Slavic, Baltic and Romanian: a file count reads right for any number', () => {
  // As for Polish and Serbian, the noun changes form with the number: the count goes after a colon.
  for (const lang of ['ro', 'ru', 'uk', 'sk', 'cs', 'sl', 'lv']) {
    assert.match(GS_I18N[lang].files_many, /: \{n\}$/, lang);
    for (const key of ['confirm_text_many', 'exported_many']) assert.match(GS_I18N[lang][key], /: \{n\}\.?$/, `${lang}.${key}`);
  }
  const card = render({}, makeHass({ language: 'ru', status: 'dirty', files: ['a.yaml', 'b.yaml', 'c.yaml', 'd.yaml', 'e.yaml'] }));
  assert.match(html(card), /Файлы: 5/);
  assert.match(html(card), /Последний push/);
});

test('Cyrillic and Greek cards are in their own script, Serbian Latin stays Latin', () => {
  // Latin words left are names and Git terms of the English card (Git Sync, commit, push, Enter, AI…).
  const english = Object.values(GS_I18N.en).join(' ').toLowerCase();
  for (const lang of ['bg', 'ru', 'uk', 'el']) {
    for (const [key, text] of Object.entries(GS_I18N[lang])) {
      for (const word of text.match(/[A-Za-z]+/g) || []) assert.ok(english.includes(word.toLowerCase()), `${lang}.${key}: ${word}`);
    }
  }
  assert.match(Object.values(GS_I18N.el).join(' '), /[\u0370-\u03ff]/);
  const card = render({}, makeHass({ language: 'el', status: 'dirty', files: ['a.yaml', 'b.yaml'] }));
  assert.match(html(card), /2 αρχεία/);
  const lat = render({}, makeHass({ language: 'sr-Latn', status: 'dirty', files: ['a.yaml', 'b.yaml'] }));
  assert.doesNotMatch(html(lat).replace(/<style[\s\S]*?<\/style>/g, ''), /[\u0370-\u04ff]/);
});

test('Serbian Latin: the card, its dates and relative times are in Latin script', () => {
  const card = render({}, makeHass({ language: 'sr-Latn', status: 'dirty', files: ['a.yaml', 'b.yaml'] }));
  const out = html(card);
  assert.match(out, /Izmene/);
  assert.match(out, /Datoteka: 2/);
  assert.match(out, /Poslednji push/);
  assert.match(card._ago(minutesAgo(42)), /^pre 42 minut/);
  assert.doesNotMatch(card._ago(minutesAgo(42)) + card._absolute(minutesAgo(42)), /[\u0400-\u04ff]/);
  const cyr = render({}, makeHass({ language: 'sr', status: 'dirty', files: ['a.yaml'] }));
  assert.match(html(cyr), /1 датотека/);
  assert.match(cyr._ago(minutesAgo(42)), /^пре 42 минут/);
});

test('editor offers every language of the card, Italian, Dutch, Portuguese and Polish included', () => {
  const editor = new GitSyncCardEditor();
  editor.appendChild = () => {};
  editor.setConfig({});
  editor.hass = makeHass();
  const options = editor._form.schema.find((s) => s.name === 'language').selector.select.options;
  assert.deepEqual(JSON.parse(JSON.stringify(options.map((o) => o.value).sort())), Object.keys(GS_I18N).sort());
  const labels = Object.fromEntries(options.map((o) => [o.value, o.label]));
  assert.deepEqual(
    JSON.parse(JSON.stringify(['it', 'nl', 'pt', 'pl'].map((l) => labels[l]))),
    ['Italiano', 'Nederlands', 'Português (Portugal)', 'Polski'],
  );
});

test('editor offers the twelve languages added in 1.1.1 under their own names', () => {
  const editor = new GitSyncCardEditor();
  editor.appendChild = () => {};
  editor.setConfig({});
  editor.hass = makeHass();
  const options = editor._form.schema.find((s) => s.name === 'language').selector.select.options;
  const labels = Object.fromEntries(options.map((o) => [o.value, o.label]));
  assert.deepEqual(
    JSON.parse(JSON.stringify(['ro', 'da', 'sv', 'bg', 'ru', 'uk', 'hu', 'sk', 'cs', 'sl', 'lv', 'el'].map((l) => labels[l]))),
    ['Română', 'Dansk', 'Svenska', 'Български', 'Русский', 'Українська', 'Magyar', 'Slovenčina', 'Čeština', 'Slovenščina', 'Latviešu', 'Ελληνικά'],
  );
});

test('editor offers Serbian in both scripts', () => {
  const editor = new GitSyncCardEditor();
  editor.appendChild = () => {};
  editor.setConfig({});
  editor.hass = makeHass();
  const options = editor._form.schema.find((s) => s.name === 'language').selector.select.options;
  assert.deepEqual(
    JSON.parse(JSON.stringify(options.slice(-2).map((o) => [o.value, o.label]))),
    [
      ['sr', 'Српски'],
      ['sr-Latn', 'Srpski (latinica)'],
    ],
  );
});

test('entities found by translation key, or by entity ID when it is missing', () => {
  assert.equal(gsDevices(REGISTRY).d1.status, STATUS);
  assert.equal(gsDevices(REGISTRY).d1.commit_push, COMMIT);
  const noKeys = Object.fromEntries(Object.entries(REGISTRY).map(([id, e]) => [id, { ...e, translation_key: undefined }]));
  assert.equal(gsDevices(noKeys).d1.last_commit, LAST_COMMIT);
  assert.equal(gsDevices(noKeys).d1.commit_push, COMMIT);
  assert.equal(gsDevices(noKeys).d2, undefined);
});

test('remote URL shortened to owner/repository', () => {
  assert.equal(gsRepo('git@github.com:me/homeassistant-config.git'), 'me/homeassistant-config');
  assert.equal(gsRepo('https://github.com/me/ha.git'), 'me/ha');
  assert.equal(gsRepo(''), '');
});

test('HTML is escaped', () => {
  assert.equal(gsEsc('<b>"x"</b>'), '&lt;b&gt;&quot;x&quot;&lt;/b&gt;');
});

test('clean repository: status, last commit, commit disabled', () => {
  const out = html(render({}, makeHass()));
  assert.match(out, /st-clean/);
  assert.match(out, /Up to date/);
  assert.match(out, /main → me\/homeassistant-config/);
  assert.match(out, /lower the night light threshold/);
  assert.match(out, /3f9c2ab/);
  assert.match(out, /42 minutes ago/);
  assert.match(out, /Working tree clean/);
  assert.match(out, /Dashboard export[\s\S]*Never/);
  assert.match(out, /id="commit"\s+disabled/);
});

test('changes: files listed when expanded, commit enabled', () => {
  const card = render({}, makeHass({ status: 'dirty', files: ['automations.yaml', 'scripts.yaml'] }));
  assert.match(html(card), /st-dirty/);
  assert.match(html(card), /2 files/);
  assert.doesNotMatch(html(card), /automations\.yaml/);
  card.shadowRoot.querySelector('.toggle').click();
  assert.match(html(card), /<li title="automations.yaml">automations.yaml<\/li>/);
  assert.doesNotMatch(html(card), /id="commit"\s+disabled/);
});

test('show_files and show_export can be turned off', () => {
  const out = html(render({ show_files: false, show_export: false }, makeHass({ status: 'dirty', files: ['a.yaml'] })));
  assert.doesNotMatch(out, /class="row toggle"/);
  assert.match(out, /1 file/);
  assert.doesNotMatch(out, /<span class="label">Dashboard export/);
  assert.doesNotMatch(out, /id="export"/);
});

test('error is shown', () => {
  const out = html(render({}, makeHass({ status: 'error', error: 'git push failed: <denied>' })));
  assert.match(out, /st-error/);
  assert.match(out, /git push failed: &lt;denied&gt;/);
});

test('commit asks for confirmation, then calls the action with the message', async () => {
  const hass = makeHass({ status: 'dirty', files: ['a.yaml'] });
  const card = render({}, hass);
  card.shadowRoot.querySelector('#commit').click();
  assert.match(html(card), /Commit and push now\?/);
  assert.match(html(card), /1 changed file will be committed/);
  card.shadowRoot.querySelector('#message').handlers.input({ target: { value: '  fix: typo ' } });
  card.shadowRoot.querySelector('#confirm').click();
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(JSON.parse(JSON.stringify(hass.calls[0])), [
    'system_hub', 'git_sync_commit_push', { message: 'fix: typo' },
    null,
    false,
    true,
  ]);
  assert.deepEqual(card.toasts, ['Committed: fix: typo']);
  assert.doesNotMatch(html(card), /Commit and push now/);
});

test('export button calls the export action', async () => {
  const hass = makeHass({ response: { files: ['lovelace', 'lovelace.yaml'] } });
  const card = render({}, hass);
  card.shadowRoot.querySelector('#export').click();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(hass.calls[0][1], 'git_sync_export_dashboards');
  assert.deepEqual(card.toasts, ['2 dashboard files exported']);
});

test('French', () => {
  const out = html(render({}, makeHass({ language: 'fr', status: 'dirty', files: ['a.yaml'] })));
  assert.match(out, /Modifications/);
  assert.match(out, /1 fichier/);
  assert.match(out, /Dernier push/);
});

test('not set up', () => {
  const card = render({}, { ...makeHass(), entities: {}, states: {} });
  assert.match(html(card), /Git Sync is not set up/);
});

test('editor drops options left at their default', () => {
  const editor = new GitSyncCardEditor();
  editor.appendChild = () => {};
  const events = [];
  editor.dispatchEvent = (ev) => events.push(ev.detail.config);
  editor.setConfig({});
  editor.hass = makeHass();
  editor._form.dispatch({ show_files: true, show_export: false, title: '' });
  assert.deepEqual(JSON.parse(JSON.stringify(events[0])), { show_export: false });
});

test('message box: branch in the placeholder, no sparkle button without AI task', () => {
  const card = render({}, makeHass({ status: 'dirty', files: ['a.yaml'] }));
  card.shadowRoot.querySelector('#commit').click();
  assert.match(html(card), /placeholder="Message \(Enter to commit on ‘main’\)"/);
  assert.doesNotMatch(html(card), /id="generate"/);
});

test('sparkle button generates the message into the field, without committing', async () => {
  const hass = makeHass({
    status: 'dirty',
    files: ['a.yaml'],
    aiTask: 'ai_task.google',
    response: { message: 'feat(lights): add the corridor scene' },
  });
  const card = render({}, hass);
  card.shadowRoot.querySelector('#commit').click();
  assert.match(html(card), /id="generate"/);
  card.shadowRoot.querySelector('#generate').click();
  assert.match(html(card), /class="field generating"/);
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(JSON.parse(JSON.stringify(hass.calls)), [
    ['system_hub', 'git_sync_generate_message', {}, null, false, true],
  ]);
  assert.match(html(card), /value="feat\(lights\): add the corridor scene"/);
  assert.match(html(card), /Commit and push now\?/);
  card.shadowRoot.querySelector('#confirm').click();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(hass.calls[1][1], 'git_sync_commit_push');
  assert.equal(hass.calls[1][2].message, 'feat(lights): add the corridor scene');
});

test('sparkle button with nothing to describe shows a toast', async () => {
  const hass = makeHass({ status: 'dirty', files: ['a.yaml'], aiTask: 'ai_task.google', response: { message: null } });
  const card = render({}, hass);
  card.shadowRoot.querySelector('#commit').click();
  card.shadowRoot.querySelector('#generate').click();
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(card.toasts, ['Nothing to describe: no changes']);
  assert.match(html(card), /value=""/);
});

test('changed files expand from the keyboard (Enter and Space) and keep the focus', () => {
  const card = render({}, makeHass({ status: 'dirty', files: ['a.yaml'] }));
  const toggle = card.shadowRoot.querySelector('.toggle');
  toggle.focus();
  const ev = toggle.key('Enter');
  assert.equal(ev.prevented, true);
  assert.match(html(card), /<li title="a.yaml">/);
  assert.match(html(card), /aria-expanded="true"/);
  // Re-rendered by innerHTML: the new toggle has the focus.
  assert.equal(card.shadowRoot.activeElement, card.shadowRoot.querySelector('.toggle'));
  card.shadowRoot.querySelector('.toggle').key(' ');
  assert.doesNotMatch(html(card), /<li title="a.yaml">/);
  card.shadowRoot.querySelector('.toggle').key('a');
  assert.doesNotMatch(html(card), /<li title="a.yaml">/);
});

test('a Home Assistant update does not lose the keyboard focus', () => {
  const hass = makeHass({ status: 'dirty', files: ['a.yaml'] });
  const card = render({}, hass);
  card.shadowRoot.querySelector('#commit').focus();
  card.hass = makeHass({ status: 'dirty', files: ['a.yaml', 'b.yaml'] });
  assert.match(html(card), /2 files/);
  assert.equal(card.shadowRoot.activeElement?.id, 'commit');
});

test('focus given back after a render never scrolls the page (preventScroll)', async () => {
  const hass = makeHass({
    status: 'dirty',
    files: ['a.yaml'],
    aiTask: 'ai_task.google',
    response: { message: 'feat: x' },
  });
  const card = render({}, hass);
  const root = card.shadowRoot;
  root.querySelector('#commit').focus();
  root.focusCalls = [];
  // A Home Assistant update re-renders the card while the focus is in it.
  card.hass = makeHass({ status: 'dirty', files: ['a.yaml', 'b.yaml'], aiTask: 'ai_task.google', response: { message: 'feat: x' } });
  // The popup opens on the message field, and the field gets the focus back after the generation.
  root.querySelector('#commit').click();
  root.querySelector('#generate').click();
  await new Promise((r) => setTimeout(r, 0));
  const targets = root.focusCalls.map((c) => c.target);
  assert.ok(targets.includes('#commit') && targets.includes('#message'), targets.join());
  for (const call of root.focusCalls) assert.deepEqual({ ...call.options }, { preventScroll: true }, call.target);
});

test('push pending: the confirmation does not announce 0 changed files', () => {
  const card = render({}, makeHass({ status: 'ahead' }));
  card.shadowRoot.querySelector('#commit').click();
  assert.doesNotMatch(html(card), /0 changed files/);
  assert.match(html(card), /The commits waiting will be pushed\./);
  const fr = render({}, makeHass({ status: 'error', language: 'fr' }));
  fr.shadowRoot.querySelector('#commit').click();
  assert.match(html(fr), /Les commits en attente seront poussés\./);
});

test('behind and diverged: their own pill, no commit while diverged', () => {
  const behind = render({}, makeHass({ status: 'behind' }));
  assert.match(html(behind), /st-behind/);
  assert.match(html(behind), /pill-text">Behind</);
  const diverged = render({}, makeHass({ status: 'diverged', language: 'fr' }));
  assert.match(html(diverged), /st-diverged/);
  assert.match(html(diverged), /pill-text">Divergé</);
  assert.match(html(diverged), /id="commit"\s+disabled/);
});

test('push only: the toast says it was pushed, not "Nothing to commit"', async () => {
  const hass = makeHass({ status: 'ahead', response: { committed: false, pushed: true, message: null } });
  const card = render({}, hass);
  card.shadowRoot.querySelector('#commit').click();
  card.shadowRoot.querySelector('#confirm').click();
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(card.toasts, ['Pending commits pushed']);
});

test('no commit while the message is being generated, and no stale message afterwards', async () => {
  let answer;
  const hass = makeHass({ status: 'dirty', files: ['a.yaml'], aiTask: 'ai_task.google' });
  hass.callService = (...args) => {
    hass.calls.push(args);
    return new Promise((resolve) => {
      answer = resolve;
    });
  };
  const card = render({}, hass);
  card.shadowRoot.querySelector('#commit').click();
  card.shadowRoot.querySelector('#generate').click();
  assert.match(html(card), /id="confirm"[^>]*disabled/);
  // Closed while generating: the late answer is not kept for the next opening.
  card.shadowRoot.querySelector('#cancel').click();
  answer({ response: { message: 'feat: late message' } });
  await new Promise((r) => setTimeout(r, 0));
  card.shadowRoot.querySelector('#commit').click();
  assert.match(html(card), /id="message"[^>]*value=""/);
  assert.doesNotMatch(html(card), /id="confirm"[^>]*disabled/);
});

test('reduced motion: no chevron or button transition', () => {
  const css = html(render({}, makeHass())).match(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?\})\s*\}/)?.[1] || '';
  assert.match(css, /\.chevron/);
  assert.match(css, /transition: none/);
});

test('editor picks another Git Sync sensor: the card still uses the status sensor of its device', () => {
  const out = html(render({ entity: LAST_COMMIT }, makeHass({ status: 'dirty', files: ['a.yaml'] })));
  assert.match(out, /st-dirty/);
  assert.match(out, /main → me\/homeassistant-config/);
  assert.doesNotMatch(out, /id="commit"\s+disabled/);
  // An entity of no Git Sync device (one of the old Git Sync integration, say): the System Hub one is found.
  const other = html(render({ entity: 'sensor.other' }, makeHass()));
  assert.match(other, /main → me\/homeassistant-config/);
});

// The CSS rule of a selector in the card's stylesheet (first match).
const cssRule = (css, selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return css.match(new RegExp(`(?:^|[}\\s])${escaped}\\s*\\{([^}]*)\\}`))?.[1] || '';
};

test('narrow card: the title truncates, the pill shrinks to its dot, buttons wrap instead of overflowing', () => {
  const out = html(render({}, makeHass({ status: 'ahead' })));
  const css = out.match(/<style>([\s\S]*?)<\/style>/)[1];
  // Basis 0: the pill keeps its whole label while there is room, the title keeps a few letters.
  const titles = cssRule(css, '.titles');
  assert.match(titles, /flex: 1 1 0;/);
  assert.match(titles, /min-width: [4-9]ch/);
  const title = cssRule(css, '.title');
  assert.match(title, /min-width: \dch/);
  assert.match(title, /white-space: nowrap/);
  assert.match(title, /text-overflow: ellipsis/);
  const pill = cssRule(css, '.pill');
  assert.match(pill, /flex: 0 1 auto/);
  assert.match(pill, /min-width: 0/);
  assert.doesNotMatch(pill, /max-width/);
  assert.match(cssRule(css, '.pill-text'), /text-overflow: ellipsis/);
  // The size container is inside the card, never ha-card: in an inline-block parent or an auto grid column the
  // card would fall to the width of its padding.
  assert.doesNotMatch(cssRule(css, 'ha-card'), /container/);
  assert.match(cssRule(css, ':host'), /display: block/);
  assert.match(cssRule(css, '.header'), /container-type: inline-size/);
  assert.match(css, /@container \(max-width: \d+px\) \{[\s\S]*?\.pill-text \{ display: none; \}/);
  assert.match(cssRule(css, '.badge'), /flex: none/);
  const button = cssRule(css, 'button.action');
  assert.match(button, /min-width: 0/);
  assert.match(button, /white-space: normal/);
  // A long value (pl, sr at 6 columns on a phone) goes under its label and wraps, never cut by the card.
  assert.match(cssRule(css, '.row'), /flex-wrap: wrap/);
  const value = cssRule(css, '.row .value');
  assert.match(value, /min-width: 0/);
  assert.match(value, /overflow-wrap: anywhere/);
  // The pill text stays available when only the dot is shown.
  assert.match(out, /class="pill" title="Push pending" aria-label="Push pending"/);
});

test('pill and error text: state colour mixed with the text colour (readable in light and dark themes)', () => {
  const out = html(render({}, makeHass({ status: 'error', error: 'git push failed' })));
  const css = out.match(/<style>([\s\S]*?)<\/style>/)[1];
  assert.match(cssRule(css, '.pill'), /color: color-mix\(in srgb, var\(--s\) 40%, var\(--primary-text-color\)\)/);
  assert.match(cssRule(css, '.err'), /color: color-mix\(in srgb, var\(--gs-alert\) 40%, var\(--primary-text-color\)\)/);
});

// ── Mini card ────────────────────────────────────────────────────────────────
const mini = (config, hass) => render(config, hass, GitSyncMiniCard);

test('mini card: compact view with the last commit, the changes, the last push and a zoom button', () => {
  const card = mini({}, makeHass({ status: 'dirty', files: ['a.yaml', 'b.yaml'] }));
  const out = html(card);
  assert.match(out, /class="st-dirty compact"/);
  assert.match(out, /<div class="subtitle">main<\/div>/);
  assert.match(out, /class="m-msg">feat\(corridor\): lower the night light threshold/);
  assert.match(out, /class="m-chip changed"[\s\S]*2 files/);
  assert.match(out, /Last push: 42 minutes ago/);
  assert.match(out, /class="zoom" title="Show the full card"/);
  assert.doesNotMatch(out, /id="export"/);
  assert.doesNotMatch(out, /class="rows"/);
  assert.doesNotMatch(out, /id="commit"[^>]*disabled/);
  assert.equal(card.getCardSize(), 2);
  assert.deepEqual(JSON.parse(JSON.stringify(card.getGridOptions())), { columns: 6, min_columns: 6, rows: 'auto' });
});

test('mini card: the zoom button switches to the full card and back', () => {
  const card = mini({}, makeHass());
  card.shadowRoot.querySelector('.zoom').click();
  let out = html(card);
  assert.doesNotMatch(out, / compact"/);
  assert.match(out, /main → me\/homeassistant-config/);
  assert.match(out, /id="export"/);
  assert.match(out, /class="zoom" title="Back to the compact view"/);
  assert.equal(card.getGridOptions().columns, 12);
  card.shadowRoot.querySelector('.zoom').click();
  out = html(card);
  assert.match(out, / compact"/);
});

test('mini card: a click elsewhere brings back the compact view, not while writing a commit message', () => {
  const card = mini({}, makeHass({ status: 'dirty', files: ['a.yaml'] }));
  const elsewhere = { composedPath: () => [] };
  card.shadowRoot.querySelector('.zoom').click();
  card.shadowRoot.querySelector('#commit').click();
  card._outside.tap(elsewhere);
  assert.match(html(card), /Commit and push now\?/);
  assert.doesNotMatch(html(card), / compact"/);
  card.shadowRoot.querySelector('#cancel').click();
  card._outside.tap({ composedPath: () => [{ localName: 'ha-more-info-dialog' }] });
  assert.doesNotMatch(html(card), / compact"/);
  card._outside.tap(elsewhere);
  assert.match(html(card), / compact"/);
});

test('mini card: commit from the compact view, confirmation in place of the content', async () => {
  const hass = makeHass({ status: 'dirty', files: ['a.yaml'] });
  const card = mini({}, hass);
  card.shadowRoot.querySelector('#commit').click();
  const out = html(card);
  assert.match(out, /class="popup inline"/);
  assert.doesNotMatch(out, /class="overlay"/);
  assert.doesNotMatch(out, /class="m-foot"/);
  card.shadowRoot.querySelector('#message').handlers.input({ target: { value: 'fix: typo' } });
  card.shadowRoot.querySelector('#confirm').click();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(hass.calls[0][1], 'git_sync_commit_push');
  assert.equal(hass.calls[0][2].message, 'fix: typo');
  assert.match(html(card), /class="m-foot"/);
});

test('mini card: clean repository, commit disabled; error shown; zoom: false removes the button', () => {
  let out = html(mini({}, makeHass()));
  assert.match(out, /0 files/);
  assert.match(out, /id="commit"[^>]*disabled/);
  out = html(mini({ zoom: false }, makeHass({ status: 'error', error: 'push <denied>' })));
  assert.match(out, /push &lt;denied&gt;/);
  assert.doesNotMatch(out, /class="zoom"/);
});

test('mini card: French', () => {
  const out = html(mini({}, makeHass({ language: 'fr', status: 'dirty', files: ['a.yaml'] })));
  assert.match(out, /1 fichier/);
  assert.match(out, /Afficher la carte complète/);
});

test('mini card editor: zoom toggle, left out of the YAML at its default', () => {
  const editor = new GitSyncMiniCardEditor();
  editor.appendChild = () => {};
  const events = [];
  editor.dispatchEvent = (ev) => events.push(ev.detail.config);
  editor.setConfig({});
  editor.hass = makeHass();
  assert.ok(editor._form.schema.some((s) => s.name === 'zoom'));
  assert.equal(editor._form.computeLabel({ name: 'zoom' }), 'Zoom button');
  editor._form.dispatch({ zoom: true, show_files: true });
  editor._form.dispatch({ zoom: false });
  assert.deepEqual(JSON.parse(JSON.stringify(events)), [{}, { zoom: false }]);
  const full = new GitSyncCardEditor();
  full.appendChild = () => {};
  full.setConfig({});
  full.hass = makeHass();
  assert.ok(!full._form.schema.some((s) => s.name === 'zoom'));
});

// ── Diff viewer ──────────────────────────────────────────────────────────────
const DIFF = {
  additions: 3,
  deletions: 1,
  more_files: 0,
  files: [
    {
      path: 'packages/lights.yaml',
      status: 'modified',
      old_path: null,
      binary: false,
      additions: 2,
      deletions: 1,
      truncated: 0,
      hunks: [
        {
          header: '@@ -1,3 +1,4 @@',
          lines: [
            { kind: 'context', old: 1, new: 1, text: 'light:' },
            { kind: 'del', old: 2, new: null, text: '  - platform: <old>' },
            { kind: 'add', old: null, new: 2, text: '  - platform: new' },
            { kind: 'add', old: null, new: 3, text: '    name: Couloir' },
          ],
        },
      ],
    },
    { path: 'icon.png', status: 'added', old_path: null, binary: true, additions: 0, deletions: 0, truncated: 0, hunks: [] },
    { path: 'new.yaml', status: 'renamed', old_path: 'old.yaml', binary: false, additions: 1, deletions: 0, truncated: 5, hunks: [{ header: '@@ -1 +1 @@', lines: [{ kind: 'add', old: null, new: 1, text: 'x' }] }] },
  ],
};

function dialog() {
  const d = new GitSyncDiffDialog();
  d.attachShadow = fakeNode().attachShadow;
  return d;
}

test('diff viewer: files on the left with status letter and counts, the selected file hunk by hunk', async () => {
  const d = dialog();
  const opening = d.open({ lang: 'en', locale: 'en', branch: 'main', request: async () => DIFF, onCommit: () => {} });
  assert.match(html(d), /Loading changes…/);
  await opening;
  const out = html(d);
  assert.match(out, /Changes on ‘main’/);
  assert.match(out, /3 files · <span class="d-add">\+3<\/span> <span class="d-del">−1<\/span>/);
  // File list: letter, base name and folder, counts; the first file is selected.
  assert.match(out, /class="d-file selected" data-i="0"[^>]*title="packages\/lights.yaml"/);
  assert.match(out, /<span class="d-st" style="--c:var\(--gs-warn\)" title="Modified"[^>]*>M</);
  assert.match(out, /<span class="d-base">lights.yaml<\/span><span class="d-dir">packages<\/span>/);
  assert.match(out, /<span class="d-st" style="--c:var\(--gs-ok\)" title="Added"[^>]*>A</);
  assert.match(out, /<span class="d-st" style="--c:var\(--gs-info\)" title="Renamed"[^>]*>R</);
  // The diff: hunk header, then one row per line with both line numbers, the sign and the escaped text.
  assert.match(out, /<tr class="hunk">.*@@ -1,3 \+1,4 @@/);
  assert.match(out, /<tr class="ctx"><td class="ln">1<\/td><td class="ln">1<\/td><td class="sg"> <\/td><td class="tx">light:<\/td>/);
  assert.match(out, /<tr class="del"><td class="ln">2<\/td><td class="ln"><\/td><td class="sg">−<\/td><td class="tx"> {2}- platform: &lt;old&gt;<\/td>/);
  assert.match(out, /<tr class="add"><td class="ln"><\/td><td class="ln">3<\/td><td class="sg">\+<\/td><td class="tx"> {4}name: Couloir<\/td>/);
  assert.match(out, /id="commit"/);
});

test('diff viewer: binary file, rename with its old path, truncated patch; Escape and the buttons close it', async () => {
  const d = dialog();
  const commits = [];
  await d.open({ lang: 'fr', locale: 'fr', branch: 'main', request: async () => DIFF, onCommit: () => commits.push(1) });
  d._select(1);
  let out = html(d);
  assert.match(out, /Fichier binaire/);
  assert.match(out, /class="d-file selected" data-i="1"/);
  d._select(2);
  out = html(d);
  assert.match(out, /<span class="d-old">old.yaml<\/span><ha-icon icon="mdi:arrow-right"><\/ha-icon><span>new.yaml<\/span>/);
  assert.match(out, /Diff coupé ici : 5 lignes de plus/);
  // Arrow keys walk the file list, wrapping around.
  d._onKey({ key: 'ArrowDown', preventDefault() {} });
  assert.equal(d._selected, 0);
  d._onKey({ key: 'ArrowUp', preventDefault() {} });
  assert.equal(d._selected, 2);
  // Commit & push closes the viewer and hands over to the card.
  d.shadowRoot.querySelector('#commit').click();
  assert.deepEqual(commits, [1]);
  assert.equal(html(d), '');
  await d.open({ lang: 'fr', locale: 'fr', branch: 'main', request: async () => DIFF });
  assert.doesNotMatch(html(d), /id="commit"/);
  d._onKey({ key: 'Escape', preventDefault() {} });
  assert.equal(html(d), '');
});

test('diff viewer: nothing to show, a failed request, files past the limit', async () => {
  const d = dialog();
  await d.open({ lang: 'en', locale: 'en', branch: 'main', request: async () => ({ files: [], additions: 0, deletions: 0, more_files: 0 }) });
  assert.match(html(d), /No changes to show/);
  assert.doesNotMatch(html(d), /class="d-list"/);
  await d.open({ lang: 'en', locale: 'en', branch: 'main', request: async () => { throw new Error('boom <x>'); } });
  assert.match(html(d), /Failed: boom &lt;x&gt;/);
  await d.open({ lang: 'en', locale: 'en', branch: 'main', request: async () => ({ ...DIFF, more_files: 7 }) });
  assert.match(html(d), /10 files/);
  assert.match(html(d), /7 more files not shown/);
});

test('card: the View changes button opens the viewer on the entry, from the actions and from the commit popup', async () => {
  const created = [];
  context.document.createElement = (tag) => {
    const node = fakeNode();
    node.tag = tag;
    node.open = (opts) => created.push({ tag, opts });
    node.remove = () => {};
    return node;
  };
  try {
    const hass = makeHass({ status: 'dirty', files: ['a.yaml'], response: DIFF });
    const card = render({}, hass);
    assert.match(html(card), /id="diff"[^>]*title="View changes"/);
    card.shadowRoot.querySelector('#diff').click();
    assert.equal(created[0].tag, 'git-sync-diff-dialog');
    assert.equal(created[0].opts.branch, 'main');
    assert.equal(created[0].opts.lang, 'en');
    assert.deepEqual(await created[0].opts.request(), DIFF);
    assert.deepEqual(JSON.parse(JSON.stringify(hass.calls.at(-1).slice(0, 3))), ['system_hub', 'git_sync_get_diff', {}]);
    // Commit & push from the viewer opens the card's commit popup, with the View changes link in it.
    created[0].opts.onCommit();
    assert.match(html(card), /role="dialog"/);
    assert.match(html(card), /class="link" id="diff"/);
    assert.doesNotMatch(html(card), /class="icon-btn" id="diff"/);
    // A clean repository has no button.
    assert.doesNotMatch(html(render({}, makeHass())), /id="diff"/);
    // The compact mini card has it too.
    const mini = render({}, makeHass({ status: 'dirty', files: ['a.yaml'] }), GitSyncMiniCard);
    assert.match(html(mini), /class="icon-btn" id="diff"/);
    card.disconnectedCallback();
    assert.equal(card._diffDialog, null);
  } finally {
    context.document.createElement = () => fakeNode();
  }
});

test('behind: a Pull button (full and mini card) calls the pull action and says how many commits came in', async () => {
  assert.doesNotMatch(html(render({}, makeHass({ status: 'clean' }))), /id="pull"/);
  // Changes on top of local commits: the action refuses it, so no button.
  assert.doesNotMatch(html(render({}, makeHass({ status: 'diverged', files: ['a.yaml'] }))), /id="pull"/);
  // Behind with changes (fast-forward), behind after a failure, clean diverged (rebase): offered.
  assert.match(html(render({}, makeHass({ status: 'dirty', files: ['a.yaml'], behind: 2 }))), /id="pull"/);
  assert.match(html(render({}, makeHass({ status: 'error', behind: 1 }))), /id="pull"/);
  assert.match(html(render({}, makeHass({ status: 'diverged' }))), /id="pull"/);
  assert.match(html(mini({}, makeHass({ status: 'diverged' }))), /id="pull"/);
  const hass = makeHass({ status: 'behind', response: { pulled: 2 } });
  const card = render({}, hass);
  assert.match(html(card), /id="pull"[^>]*>\s*<ha-icon icon="mdi:source-pull"><\/ha-icon>Pull/);
  card.shadowRoot.querySelector('#pull').click();
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(JSON.parse(JSON.stringify(hass.calls[0])), ['system_hub', 'git_sync_pull', {}, null, false, true]);
  assert.deepEqual(card.toasts, ['2 commits pulled']);

  const small = mini({}, makeHass({ status: 'behind', language: 'fr', response: { pulled: 0 } }));
  assert.match(html(small), /class="icon-btn" id="pull" title="Pull"/);
  small.shadowRoot.querySelector('#pull').click();
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(small.toasts, ['À jour']);
});

test('non-admin: the status only, no commit, pull, export, diff or AI message', () => {
  const hass = makeHass({ status: 'dirty', files: ['a.yaml'], behind: 1, aiTask: 'ai_task.openai', admin: false });
  for (const card of [render({}, hass), mini({}, hass)]) {
    const out = html(card);
    assert.match(out, /st-dirty/);
    for (const id of ['commit', 'pull', 'export', 'diff', 'generate', 'confirm']) {
      assert.doesNotMatch(out, new RegExp(`id="${id}"`), id);
    }
  }
  const admin = render({}, makeHass({ status: 'dirty', files: ['a.yaml'], behind: 1, aiTask: 'ai_task.openai' }));
  for (const id of ['commit', 'pull', 'export', 'diff']) assert.match(html(admin), new RegExp(`id="${id}"`), id);
  // No user in hass (not known yet): treated as non-admin.
  const unknown = makeHass({ status: 'dirty', files: ['a.yaml'] });
  delete unknown.user;
  assert.doesNotMatch(html(render({}, unknown)), /id="commit"/);
});

test('several repositories: the actions name the one the card shows, a single one names none', async () => {
  const ESP = 'sensor.system_hub_git_sync_esphome_status';
  const hass = makeHass({ status: 'dirty', files: ['a.yaml'], behind: 2 });
  hass.states[STATUS].attributes.repository = '/config';
  hass.entities = { ...REGISTRY, [ESP]: { platform: 'system_hub', device_id: 'd2', translation_key: 'git_sync_status' } };
  hass.states[ESP] = { state: 'dirty', attributes: { repository: '/config/esphome', branch: 'dev', changed_count: 1, changed_files: ['n.yaml'], behind: 1 } };
  const card = render({ entity: ESP }, hass);
  card.shadowRoot.querySelector('#pull').click();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(JSON.stringify(hass.calls.at(-1).slice(0, 3)), JSON.stringify(['system_hub', 'git_sync_pull', { repository: '/config/esphome' }]));

  const single = makeHass({ status: 'dirty', files: ['a.yaml'], behind: 2 });
  single.states[STATUS].attributes.repository = '/config';
  const one = render({}, single);
  one.shadowRoot.querySelector('#pull').click();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(JSON.stringify(single.calls.at(-1).slice(0, 3)), JSON.stringify(['system_hub', 'git_sync_pull', {}]));
});
