// Unit tests for the sidebar icon module: the Status emblem as an icon set, the status followed for administrators.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../custom_components/system_hub/frontend/system-hub-icons.js', import.meta.url), 'utf8');

function load(hass) {
  const loads = [];
  class Panel {
    async _load() {
      loads.push({ headless: this._headless, hass: this._hass });
    }
  }
  const context = {
    window: {},
    document: { hidden: false, querySelector: () => ({ hass, shadowRoot: null }) },
    customElements: { get: (name) => (name === 'system-hub-panel' ? Panel : undefined) },
    requestAnimationFrame: (fn) => fn(),
    setTimeout: () => 0,
    setInterval: () => 0,
  };
  vm.createContext(context);
  vm.runInContext(`${source}\nthis.follow = shIconFollow;\nthis.redraw = shIconRedraw;`, context);
  return { context, loads };
}

test('icon set: the emblem per tone, good for an unknown name', async () => {
  const { context } = load(null);
  const set = context.window.customIcons['system-hub'];
  const good = await set.getIcon('good');
  assert.equal(good.viewBox, '48 24 444 444');
  assert.match(good.path, /^M/);
  assert.notEqual((await set.getIcon('warn')).path, good.path);
  assert.notEqual((await set.getIcon('bad')).path, good.path);
  assert.equal((await set.getIcon('other')).path, good.path);
  assert.deepEqual(JSON.stringify(await set.getIconList()), JSON.stringify([{ name: 'good' }, { name: 'warn' }, { name: 'bad' }]));
});

test('status followed for an administrator with the panel, read without being shown', async () => {
  const hass = { user: { is_admin: true }, panels: { 'system-hub': { config: { _panel_custom: { module_url: '/x.js' } } } } };
  const { context, loads } = load(hass);
  await context.follow();
  assert.equal(loads.length, 1);
  assert.equal(loads[0].headless, true);
  assert.equal(loads[0].hass, hass);
  // Not an administrator, or no panel: nothing read
  hass.user.is_admin = false;
  await context.follow();
  hass.user.is_admin = true;
  delete hass.panels['system-hub'];
  await context.follow();
  assert.equal(loads.length, 1);
});

test('icons drawn before the set was known are drawn again, each with its own icon', () => {
  const { context } = load(null);
  const frames = [];
  context.requestAnimationFrame = (fn) => frames.push(fn);
  const sidebar = { localName: 'ha-icon', icon: 'system-hub:warn' };
  const other = { localName: 'ha-icon', icon: 'mdi:cog' };
  const inner = { localName: 'ha-icon', icon: 'system-hub:bad' };
  const after = { localName: 'div' };
  const root = { querySelectorAll: () => [sidebar, other, { localName: 'ha-sidebar', shadowRoot: { querySelectorAll: () => [inner] } }, after] };
  assert.equal(context.redraw(root), 2);
  assert.equal(sidebar.icon, '');
  for (const fn of frames) fn();
  assert.equal(sidebar.icon, 'system-hub:warn');
  assert.equal(inner.icon, 'system-hub:bad');
  assert.equal(other.icon, 'mdi:cog');
  assert.equal(after.icon, undefined);
});

test('the status icon: the tone read, drawn again when it changes and kept by the browser', async () => {
  const { context } = load(null);
  const saved = {};
  context.localStorage = { getItem: (k) => saved[k] ?? null, setItem: (k, v) => (saved[k] = v) };
  const set = context.window.customIcons['system-hub'];
  assert.equal((await set.getIcon('status')).path, (await set.getIcon('good')).path);
  const frames = [];
  context.requestAnimationFrame = (fn) => frames.push(fn);
  const icon = { localName: 'ha-icon', icon: 'system-hub:status' };
  context.document.querySelector = () => ({ shadowRoot: { querySelectorAll: () => [icon] } });
  context.window.systemHubSetTone('warn');
  assert.equal((await set.getIcon('status')).path, (await set.getIcon('warn')).path);
  assert.equal(saved['system-hub-tone'], 'warn');
  assert.equal(icon.icon, '');
  for (const fn of frames) fn();
  assert.equal(icon.icon, 'system-hub:status');
  // The same tone, or one that is not: nothing drawn again
  context.window.systemHubSetTone('warn');
  context.window.systemHubSetTone('purple');
  assert.equal(frames.length, 1);
});

function makeEl(localName) {
  return {
    localName,
    children: [],
    style: {},
    dataset: {},
    appendChild(child) {
      this.children.push(child);
      child.parent = this;
    },
    remove() {
      if (this.parent) this.parent.children = this.parent.children.filter((c) => c !== this);
    },
    querySelector() {
      return this.children.find((c) => c.className === 'system-hub-badge') || null;
    },
  };
}

function withSidebar(context, item) {
  const saved = {};
  context.localStorage = { getItem: (k) => saved[k] ?? null, setItem: (k, v) => (saved[k] = v) };
  context.document.createElement = () => makeEl('span');
  const sidebarShadow = { querySelector: (s) => (s === '[href="/system-hub"]' ? item : null) };
  const haRoot = {
    querySelector: (s) =>
      s === 'home-assistant-main'
        ? { shadowRoot: { querySelector: (s2) => (s2 === 'ha-sidebar' ? { shadowRoot: sidebarShadow } : null) } }
        : null,
  };
  context.document.querySelector = (s) => (s === 'home-assistant' ? { shadowRoot: haRoot } : null);
  return saved;
}

test('the sidebar badge: the count, in the overall tone, at the right of an older item', () => {
  const { context } = load(null);
  const item = makeEl('a');
  const saved = withSidebar(context, item);
  context.window.systemHubSetBadge(3, 'warn');
  const badge = item.children[0];
  assert.equal(badge.textContent, '3');
  assert.equal(badge.slot, undefined);
  assert.match(badge.style.cssText, /position:absolute/);
  assert.match(badge.style.cssText, /--warning-color/);
  assert.equal(item.style.position, 'relative');
  assert.equal(saved['system-hub-count'], '3');
  assert.equal(saved['system-hub-badge-tone'], 'warn');
  // A change recolours and recounts; over 99 is capped
  context.window.systemHubSetBadge(120, 'bad');
  assert.equal(item.children[0].textContent, '99+');
  assert.match(item.children[0].style.cssText, /--error-color/);
  // Nothing to check: the badge is taken away
  context.window.systemHubSetBadge(0, 'good');
  assert.equal(item.children.length, 0);
});

test('the sidebar badge: carried in the trailing slot of a new ha-md-list-item', () => {
  const { context } = load(null);
  const item = makeEl('ha-md-list-item');
  withSidebar(context, item);
  // A count can show while the overall tone is still healthy (a single point, score 80+): a green badge
  context.window.systemHubSetBadge(1, 'good');
  const badge = item.children[0];
  assert.equal(badge.slot, 'end');
  assert.match(badge.style.cssText, /margin-inline-end/);
  assert.doesNotMatch(badge.style.cssText, /position:absolute/);
  assert.match(badge.style.cssText, /--success-color/);
  // The same count and tone: nothing rewritten (a fresh key would mean a rewrite)
  const key = badge.dataset.key;
  context.window.systemHubSetBadge(1, 'good');
  assert.equal(item.children[0].dataset.key, key);
});
