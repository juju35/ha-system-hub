// Unit tests for the unified cards (system-hub-card, system-hub-mini-card): a module's own card, or the Status card.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../custom_components/system_hub/frontend/cards/system-hub-card.js', import.meta.url), 'utf8');

function node() {
  return {
    children: [],
    handlers: {},
    innerHTML: '',
    appendChild(child) {
      this.children.push(child);
    },
    replaceChildren(...children) {
      this.children = children;
    },
    addEventListener(type, fn) {
      this.handlers[type] = fn;
    },
    querySelectorAll: () => [],
  };
}

function load() {
  const registry = new Map();
  class Element {
    constructor() {
      this.children = [];
      this.events = [];
    }
    attachShadow() {
      const parts = { '.form': node(), '.inner': node() };
      this.shadowRoot = { ...node(), querySelector: (sel) => parts[sel] };
      return this.shadowRoot;
    }
    replaceChildren(...children) {
      this.children = children;
    }
    set innerHTML(_v) {
      this.children = [];
    }
    dispatchEvent(ev) {
      this.events.push(ev);
    }
  }
  // The module cards, as their own files define them
  class InnerCard extends Element {
    setConfig(config) {
      this.config = config;
    }
    getCardSize() {
      return 7;
    }
    static getConfigElement() {
      return new InnerEditor();
    }
  }
  class InnerEditor extends Element {
    setConfig(config) {
      this.config = config;
    }
  }
  // The panel read without being shown
  class Panel {
    static ICONS = { system: 'mdi:chip', logs: 'mdi:text', batteries: 'mdi:battery', backups: 'mdi:backup-restore' };
    static groupOf = (tab) => ({ system: 'system', logs: 'reliability', batteries: 'devices', backups: 'maintenance' })[tab];
    async _loadStrings() {
      this._localize = () => '';
    }
    async _load() {
      this._state = { loaded: true };
      this.loads = (this.loads || 0) + 1;
    }
    _stTone() {
      return {
        areas: [
          ['system', ['bad', 'Disk 93 %']],
          ['logs', ['warn', '3 errors']],
          ['batteries', ['warn', '2 to replace']],
          ['backups', ['good', '3 hours ago']],
        ],
        counts: { bad: 1, warn: 2, info: 0, good: 1 },
        score: 75,
        tone: 'warn',
      };
    }
    _t(key, vars) {
      return `${key}${vars ? `:${JSON.stringify(vars)}` : ''}`;
    }
    _tabName(tab) {
      return `Tab ${tab}`;
    }
    _groupName(group) {
      return `Group ${group}`;
    }
  }
  registry.set('sh-batteries-card', InnerCard);
  registry.set('sh-batteries-mini-card', InnerCard);
  registry.set('system-hub-panel', Panel);
  // Home Assistant's form: the value the user changes
  registry.set(
    'ha-form',
    class extends Element {
      constructor() {
        super();
        this.handlers = {};
      }
      addEventListener(type, fn) {
        this.handlers[type] = fn;
      }
    },
  );
  const context = {
    HTMLElement: Element,
    CustomEvent: class {
      constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail;
      }
    },
    customElements: {
      get: (name) => registry.get(name),
      define: (name, cls) => registry.set(name, cls),
      whenDefined: () => new Promise(() => {}),
    },
    document: { hidden: false, createElement: (tag) => new (registry.get(tag))() },
    window: {},
    console: { info() {} },
    history: { pushState() {} },
    setInterval: () => 0,
    clearInterval() {},
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(source, context);
  return { context, registry };
}

const hass = {
  user: { is_admin: true },
  panels: { 'system-hub': { config: { _panel_custom: { module_url: '/p.js' } } } },
  localize: () => '',
  loadBackendTranslation: async () => {},
};

test('a module: its own card, the options without module, hass and the size passed on', () => {
  const { registry } = load();
  const card = new (registry.get('system-hub-card'))();
  assert.throws(() => card.setConfig({ module: 'logs' }), /Unknown System Hub module: logs/);
  card.setConfig({ type: 'custom:system-hub-card', module: 'batteries', threshold: 20 });
  const inner = card.children[0];
  assert.equal(JSON.stringify(inner.config), JSON.stringify({ type: 'custom:system-hub-card', threshold: 20 }));
  card.hass = hass;
  assert.equal(inner.hass, hass);
  assert.equal(card.getCardSize(), 7);
  // The mini card has no Marketplace
  const mini = new (registry.get('system-hub-mini-card'))();
  assert.throws(() => mini.setConfig({ module: 'marketplace' }), /Unknown/);
  mini.setConfig({ module: 'batteries' });
  assert.ok(mini.children[0] instanceof registry.get('sh-batteries-mini-card'));
});

test('status: the areas by group, the summary; hide_ok and groups narrow it', async () => {
  const { registry, context } = load();
  const card = new (registry.get('system-hub-card'))();
  card.setConfig({});
  card.hass = hass;
  await card._read();
  const html = card.shadowRoot.innerHTML;
  // The illustrated header: the server icon and the picture in the overall tone, by day (no sun, light theme)
  assert.match(html, /class="banner warn" data-tab="status"/);
  assert.match(html, /mdi:nas/);
  assert.match(html, /class="sh-scene"/);
  assert.match(html, /st_points:\{&#34;n&#34;:3\}/);
  // The score in the status pill after the title (dot and score, in the overall tone), the counts under it.
  assert.match(html, /<div class="title">[^<]+<\/div><span class="chip \w+" title="75\/100" aria-label="75\/100"><span class="cdot"><\/span><span class="ct">75\/100<\/span><\/span>/);
  assert.match(html, /<div class="sub" title="[^"]*">st_n_bad:\{&#34;n&#34;:1\} · st_n_warn:\{&#34;n&#34;:2\}<\/div>/);
  assert.match(html, /Group system[\s\S]*Tab system[\s\S]*Disk 93 %[\s\S]*Group reliability[\s\S]*Group maintenance[\s\S]*Group devices/);
  card.setConfig({ hide_ok: true, groups: ['devices', 'maintenance'] });
  const narrow = card.shadowRoot.innerHTML;
  assert.match(narrow, /2 to replace/);
  assert.doesNotMatch(narrow, /3 hours ago|Disk 93/);
  // One read of the panel for the page, shared
  assert.equal(context.window.__systemHubProbe.loads, 1);
  // Not an administrator: said so
  const other = new (registry.get('system-hub-card'))();
  other.setConfig({});
  other.hass = { ...hass, user: { is_admin: false } };
  await other._read();
  assert.match(other.shadowRoot.innerHTML, /for administrators only/);
});

test('status mini card: one line, the first details and a dot per area to look at', async () => {
  const { registry } = load();
  const mini = new (registry.get('system-hub-mini-card'))();
  mini.setConfig({});
  mini.hass = hass;
  await mini._read();
  const html = mini.shadowRoot.innerHTML;
  assert.match(html, /Disk 93 % · 3 errors · 2 to replace/);
  assert.equal((html.match(/class="dot /g) || []).length, 3);
  assert.match(html, /dot bad[\s\S]*dot warn[\s\S]*dot warn/);
});

test('editor: the module first, then its own editor; another module starts its options again', () => {
  const { registry } = load();
  const editor = new (registry.get('system-hub-card-editor'))();
  editor.hass = hass;
  editor.setConfig({ type: 'custom:system-hub-card', module: 'batteries', threshold: 20 });
  const inner = editor.shadowRoot.querySelector('.inner');
  assert.equal(JSON.stringify(inner.children[0].config), JSON.stringify({ type: 'custom:system-hub-card', threshold: 20 }));
  // The module's editor changes an option: the module kept
  inner.handlers['config-changed']({ target: inner.children[0], stopPropagation() {}, detail: { config: { type: 'x', threshold: 30 } } });
  assert.equal(
    JSON.stringify(editor.events.at(-1).detail.config),
    JSON.stringify({ type: 'custom:system-hub-card', module: 'batteries', threshold: 30 }),
  );
  // Status: the groups and Hide what is fine, no module editor
  const form = editor.shadowRoot.querySelector('.form').children[0];
  form.handlers['value-changed']({ stopPropagation() {}, detail: { value: { module: 'status' } } });
  assert.equal(JSON.stringify(editor.events.at(-1).detail.config), JSON.stringify({ type: 'custom:system-hub-card', module: 'status' }));
  assert.equal(form.schema.map((s) => s.name).join(), 'module,groups,illustration,illustration_theme,show_title,show_subtitle,hide_ok');
  // The defaults (illustration on, automatic theme) are left out of the YAML
  form.handlers['value-changed']({ stopPropagation() {}, detail: { value: { module: 'status', illustration: true, illustration_theme: 'auto' } } });
  assert.equal(JSON.stringify(editor.events.at(-1).detail.config), JSON.stringify({ type: 'custom:system-hub-card', module: 'status' }));
  form.handlers['value-changed']({ stopPropagation() {}, detail: { value: { module: 'status', illustration: false, illustration_theme: 'night' } } });
  assert.equal(
    JSON.stringify(editor.events.at(-1).detail.config),
    JSON.stringify({ type: 'custom:system-hub-card', module: 'status', illustration: false, illustration_theme: 'night' }),
  );
  assert.equal(inner.children.length, 0);
});

test('mini editor, status: the groups, the illustration, hide_ok of its detail view and the detail button', () => {
  const { registry } = load();
  const editor = new (registry.get('system-hub-mini-card-editor'))();
  editor.hass = hass;
  editor.setConfig({ type: 'custom:system-hub-mini-card', module: 'status' });
  const form = editor.shadowRoot.querySelector('.form').children[0];
  assert.equal(form.schema.map((s) => s.name).join(), 'module,groups,illustration,illustration_theme,hide_ok,zoom');
  assert.equal(form.data.zoom, true);
  // The default (the button shown) is left out of the YAML; false is kept
  form.handlers['value-changed']({ stopPropagation() {}, detail: { value: { module: 'status', zoom: true } } });
  assert.equal(JSON.stringify(editor.events.at(-1).detail.config), JSON.stringify({ type: 'custom:system-hub-mini-card', module: 'status' }));
  form.handlers['value-changed']({ stopPropagation() {}, detail: { value: { module: 'status', zoom: false } } });
  assert.equal(JSON.stringify(editor.events.at(-1).detail.config), JSON.stringify({ type: 'custom:system-hub-mini-card', module: 'status', zoom: false }));
});

test('status mini card: the detail button shows the areas by group and back; a click elsewhere or leaving folds it', async () => {
  const { registry } = load();
  const mini = new (registry.get('system-hub-mini-card'))();
  assert.throws(() => mini.setConfig({ zoom: 'yes' }), /zoom must be true or false/);
  mini.setConfig({});
  mini.hass = hass;
  await mini._read();
  let html = mini.shadowRoot.innerHTML;
  // Compact: the button in the banner's top right corner, no areas
  assert.match(html, /class="banner warn" data-tab="status">[\s\S]*<\/div><button class="zoom" title="Show details" aria-label="Show details" aria-expanded="false"><ha-icon icon="mdi:arrow-expand"><\/ha-icon><\/button><\/div><\/ha-card>$/);
  assert.doesNotMatch(html, /class="group"/);
  assert.equal(mini.getCardSize(), 1);
  // Zoomed: the full card's areas by group under the same header, the button to come back
  mini._zoom(true);
  html = mini.shadowRoot.innerHTML;
  assert.match(html, /aria-expanded="true"><ha-icon icon="mdi:arrow-collapse">/);
  assert.match(html, /<div class="body"><div class="group">Group system[\s\S]*Disk 93 %[\s\S]*3 hours ago[\s\S]*Group devices/);
  assert.equal(mini.getCardSize(), 6);
  // A tap inside the card or in a dialog opened from it: still zoomed; anywhere else: compact
  mini._unzoom.tap({ composedPath: () => [mini] });
  mini._unzoom.tap({ composedPath: () => [{ localName: 'ha-more-info-dialog' }] });
  assert.match(mini.shadowRoot.innerHTML, /class="group"/);
  mini._unzoom.tap({ composedPath: () => [{ localName: 'div' }] });
  assert.doesNotMatch(mini.shadowRoot.innerHTML, /class="group"/);
  // Left while zoomed: compact on return
  mini._zoom(true);
  mini.disconnectedCallback();
  assert.equal(mini._zoomed, false);
  assert.doesNotMatch(mini.shadowRoot.innerHTML, /class="group"/);
  // hide_ok narrows the detail view, as on the full card
  mini.setConfig({ hide_ok: true });
  mini._zoom(true);
  assert.doesNotMatch(mini.shadowRoot.innerHTML, /3 hours ago/);
  // The classic header: the button at the right of the row, the areas under it
  mini.setConfig({ illustration: false });
  assert.match(mini.shadowRoot.innerHTML, /<ha-card class="zoomed"><div class="mini warn" data-tab="status">[\s\S]*<\/div><button class="zoom"[\s\S]*<div class="groups"><div class="group">/);
  mini._zoom(false);
  assert.match(mini.shadowRoot.innerHTML, /<ha-card class="mini warn" data-tab="status">[\s\S]*<button class="zoom"[^>]*aria-expanded="false"/);
  // zoom: false removes the button
  mini.setConfig({ zoom: false });
  assert.doesNotMatch(mini.shadowRoot.innerHTML, /class="zoom"/);
});

test('the Status mini card zoom button: 24 px, round, top right, smoked glass on the illustrated header (ha-* charter)', () => {
  assert.match(source, /\.zoom \{ all:unset; position:absolute; z-index:2; top:5px; right:5px; width:24px; height:24px; border-radius:50%;/);
  assert.match(source, /\.banner > \.zoom \{[^}]*backdrop-filter:blur\(6px\)/);
  assert.match(source, /\.banner\.night > \.zoom \{ color:rgba\(255,255,255,\.85\); background:rgba\(255,255,255,\.12\); \}/);
});

test('illustrated header: night from the theme or the option; each part in the tone of its area; classic header', async () => {
  const { registry } = load();
  const card = new (registry.get('system-hub-card'))();
  card.setConfig({});
  card.hass = { ...hass, themes: { darkMode: true }, states: { 'sun.sun': { state: 'below_horizon' } } };
  await card._read();
  let html = card.shadowRoot.innerHTML;
  assert.match(html, /class="banner warn night"/);
  // The system area is critical: the host's light and frame in red; the batteries to watch: a low amber level
  assert.match(html, /cx="11" cy="9" r="1.4" fill="#e5484d"/);
  assert.match(html, /y="2" width="8" height="6" rx="1" fill="#f5a623"/);
  // The score fills the ring
  assert.match(html, /stroke-dasharray="56.5 100"/);
  // A light theme after sunset: drawn again by day without a new read
  card.hass = { ...hass, themes: { darkMode: false }, states: { 'sun.sun': { state: 'below_horizon' } } };
  assert.match(card.shadowRoot.innerHTML, /class="banner warn"/);
  // Forced by the option, whatever the sun and the theme
  card.setConfig({ illustration_theme: 'night' });
  assert.match(card.shadowRoot.innerHTML, /class="banner warn night"/);
  card.setConfig({ illustration_theme: 'day' });
  card.hass = { ...hass, themes: { darkMode: true } };
  assert.match(card.shadowRoot.innerHTML, /class="banner warn"/);
  // No sun: Home Assistant's dark theme alone
  card.setConfig({});
  card.hass = { ...hass, themes: { darkMode: true } };
  card._renderStatus();
  assert.match(card.shadowRoot.innerHTML, /class="banner warn night"/);
  // The sun up but the dark theme: night all the same (a day picture would glare on a dark card), drawn again
  card.hass = { ...hass, themes: { darkMode: true }, states: { 'sun.sun': { state: 'above_horizon' } } };
  assert.match(card.shadowRoot.innerHTML, /class="banner warn night"/);
  card.hass = { ...hass, themes: { darkMode: false }, states: { 'sun.sun': { state: 'above_horizon' } } };
  assert.match(card.shadowRoot.innerHTML, /class="banner warn"/);
  // illustration: false keeps the classic header and its emblem
  card.setConfig({ illustration: false });
  html = card.shadowRoot.innerHTML;
  assert.match(html, /system-hub:warn/);
  assert.doesNotMatch(html, /banner|sh-scene/);
  // The mini card: the same banner, the details and the dots on its background
  const mini = new (registry.get('system-hub-mini-card'))();
  mini.setConfig({});
  mini.hass = hass;
  await mini._read();
  assert.match(mini.shadowRoot.innerHTML, /class="banner warn"[\s\S]*Disk 93 %[\s\S]*class="dots"/);
});

test('the classic header pastille is round, 40 px, the same size folded and full (ha-* charter)', () => {
  const badge = source.match(/\n\s*\.badge \{([^}]*)\}/)[1];
  assert.match(badge, /width:40px; height:40px; border-radius:50%/);
  assert.doesNotMatch(source, /\.mini \.badge \{/);
});

test('a module turned off: its card never loads, the card says so instead of an empty spot', () => {
  const { registry, context } = load();
  let later;
  context.setTimeout = (fn) => {
    later = fn;
    return 1;
  };
  context.clearTimeout = () => {};
  registry.set(
    'ha-card',
    class extends registry.get('sh-batteries-card') {
      style = {};
    },
  );
  const card = new (registry.get('system-hub-card'))();
  card.setConfig({ module: 'watchdog' });
  card.hass = hass;
  assert.equal(card.children.length, 0);
  later();
  assert.equal(card.children.length, 1);
  assert.equal(card.children[0].textContent, 'System Hub: turn the watchdog module on to show this card');
  // Its card defined in the meantime: nothing said
  card.setConfig({ module: 'batteries' });
  later();
  assert.ok(card.children[0] instanceof registry.get('sh-batteries-card'));
});
