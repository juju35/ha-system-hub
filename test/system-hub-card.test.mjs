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
  assert.match(html, /system-hub:warn/);
  assert.match(html, /st_points:\{&#34;n&#34;:3\}/);
  assert.match(html, /75\/100 · st_n_bad:\{&#34;n&#34;:1\} · st_n_warn:\{&#34;n&#34;:2\}/);
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
  assert.equal(form.schema.map((s) => s.name).join(), 'module,groups,show_title,show_subtitle,hide_ok');
  assert.equal(inner.children.length, 0);
});

test('mini editor, status: the groups only, the options the one-line card ignores left out', () => {
  const { registry } = load();
  const editor = new (registry.get('system-hub-mini-card-editor'))();
  editor.hass = hass;
  editor.setConfig({ type: 'custom:system-hub-mini-card', module: 'status' });
  const form = editor.shadowRoot.querySelector('.form').children[0];
  assert.equal(form.schema.map((s) => s.name).join(), 'module,groups');
});
