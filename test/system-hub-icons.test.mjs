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
  // Drawn before the set was known: Home Assistant's legacy mode, cleared so the set is used
  const sidebar = { localName: 'ha-icon', icon: 'system-hub:warn', _legacy: true };
  const other = { localName: 'ha-icon', icon: 'mdi:cog' };
  const inner = { localName: 'ha-icon', icon: 'system-hub:bad' };
  const after = { localName: 'div' };
  const root = { querySelectorAll: () => [sidebar, other, { localName: 'ha-sidebar', shadowRoot: { querySelectorAll: () => [inner] } }, after] };
  assert.equal(context.redraw(root), 2);
  assert.equal(sidebar.icon, '');
  for (const fn of frames) fn();
  assert.equal(sidebar.icon, 'system-hub:warn');
  assert.equal(sidebar._legacy, false);
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

function matchEl(el, sel) {
  if (sel.startsWith(':scope > ')) {
    const rest = sel.slice(9);
    return el.children.filter((c) => matchEl(c, rest));
  }
  if (sel === '.system-hub-badge') return (el.className || '').includes('system-hub-badge') ? [el] : [];
  const slot = sel.match(/^(ha-svg-icon|ha-icon)\[slot="start"\]$/);
  if (slot) return el.localName === slot[1] && el.slot === 'start' ? [el] : [];
  return [];
}

function makeEl(localName, props = {}) {
  return {
    localName,
    children: [],
    style: {},
    dataset: {},
    ...props,
    appendChild(child) {
      child.parent = this;
      this.children.push(child);
      return child;
    },
    insertBefore(child, ref) {
      child.parent = this;
      const i = ref ? this.children.indexOf(ref) : -1;
      if (i < 0) this.children.push(child);
      else this.children.splice(i, 0, child);
      return child;
    },
    get nextSibling() {
      const sibs = this.parent ? this.parent.children : [];
      return sibs[sibs.indexOf(this) + 1] || null;
    },
    remove() {
      if (this.parent) this.parent.children = this.parent.children.filter((c) => c !== this);
    },
    querySelector(sel) {
      return matchEl(this, sel)[0] || null;
    },
    querySelectorAll(sel) {
      return matchEl(this, sel);
    },
  };
}

function withSidebar(context, item) {
  const saved = {};
  context.localStorage = { getItem: (k) => saved[k] ?? null, setItem: (k, v) => (saved[k] = v) };
  context.document.createElement = () => makeEl('span');
  const sidebarShadow = { querySelector: (s) => (s === '#sidebar-panel-system-hub' ? item : null) };
  const haRoot = {
    querySelector: (s) =>
      s === 'home-assistant-main'
        ? { shadowRoot: { querySelector: (s2) => (s2 === 'ha-sidebar' ? { shadowRoot: sidebarShadow } : null) } }
        : null,
  };
  context.document.querySelector = (s) => (s === 'home-assistant' ? { shadowRoot: haRoot } : null);
  return saved;
}

test('the sidebar badge: the count, in the overall tone, at the right of an older <a> item', () => {
  const { context } = load(null);
  const item = makeEl('a');
  const saved = withSidebar(context, item);
  context.window.systemHubSetBadge(3, 'warn');
  const badge = item.children[0];
  assert.equal(badge.textContent, '3');
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

test('the sidebar badge: two slots on a new ha-list-item-button, mirroring the notifications badge', () => {
  const { context } = load(null);
  const item = makeEl('ha-list-item-button', { id: 'sidebar-panel-system-hub' });
  const icon = makeEl('ha-icon', { slot: 'start' });
  item.appendChild(icon);
  item.appendChild(makeEl('span', { slot: 'headline' }));
  withSidebar(context, item);
  // A count can show while the overall tone is still healthy (a single point, score 80+): a green badge
  context.window.systemHubSetBadge(1, 'good');
  const badges = item.children.filter((c) => (c.className || '').includes('system-hub-badge'));
  assert.equal(badges.length, 2);
  const slots = badges.map((b) => b.slot).sort();
  assert.deepEqual(slots, ['end', 'start']);
  // Home Assistant's own badge class, so its CSS places and toggles them
  for (const b of badges) {
    assert.match(b.className, /\bbadge\b/);
    assert.equal(b.textContent, '1');
    assert.match(b.style.cssText, /--success-color/);
  }
  // The start badge sits right after the icon (so `ha-svg-icon + .badge` positions it over the icon)
  assert.equal(item.children[item.children.indexOf(icon) + 1].slot, 'start');
  // The same count and tone: nothing rewritten
  const key = badges[0].dataset.key;
  context.window.systemHubSetBadge(1, 'good');
  assert.equal(item.children.filter((c) => (c.className || '').includes('system-hub-badge'))[0].dataset.key, key);
  // Cleared when there is nothing to check
  context.window.systemHubSetBadge(0, 'good');
  assert.equal(item.children.filter((c) => (c.className || '').includes('system-hub-badge')).length, 0);
});
