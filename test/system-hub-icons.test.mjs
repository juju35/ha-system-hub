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
