// Unit tests for the Security card: the card file is evaluated with stubs, no browser needed.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../custom_components/system_hub/frontend/cards/security-card.js', import.meta.url), 'utf8');

const pushed = [];
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
    this.shadowRoot = {
      innerHTML: '',
      querySelector: () => null,
      querySelectorAll: (sel) => (sel === '.row[data-open]' ? [...this.shadowRoot.innerHTML.matchAll(/class="row [^"]*" data-open/g)].map(() => fakeNode()) : []),
      addEventListener() {},
      activeElement: null,
    };
    return this.shadowRoot;
  },
});
const context = {
  HTMLElement: class {
    constructor() {
      Object.assign(this, fakeNode());
    }
    toggleAttribute() {}
    dispatchEvent() {}
  },
  customElements: { get: () => true, define() {} },
  window: { history: { pushState: (_s, _t, url) => pushed.push(url) }, addEventListener() {}, removeEventListener() {}, dispatchEvent() {} },
  document: { createElement: () => fakeNode(), addEventListener() {}, removeEventListener() {} },
  CustomEvent: class {
    constructor(type, init) {
      this.type = type;
      this.detail = init?.detail;
    }
  },
  setInterval: () => 1,
  clearInterval() {},
  setTimeout,
  Intl,
  console,
  Date,
};
vm.createContext(context);
vm.runInContext(
  `${source}\nthis.sc = { SecurityCard, SecurityMiniCard, SecurityCardEditor, SC_I18N, scPoints, SC_DEFAULTS };`,
  context,
);
const { SecurityCard, SecurityMiniCard, SecurityCardEditor, SC_I18N, scPoints } = context.sc;

const NOW = Date.now() / 1000;
const DATA = {
  refused: [
    { ip: '185.220.101.42', count: 5, day: 5, last: NOW - 7200, internet: true, ignored: false },
    { ip: '192.168.1.37', count: 1, day: 1, last: NOW - 600, internet: false, ignored: false },
    { ip: '8.8.4.4', count: 2, day: 2, last: NOW - 600, internet: true, ignored: true },
  ],
  bans: [
    { ip: '185.220.101.42', at: NOW - 7000 },
    { ip: '203.0.113.9', at: NOW - 3600 },
  ],
  exposure: { external_url: 'https://ha.example.org', https: true, ip_ban: true },
  users: [
    { id: 'u1', name: 'Owner', admin: true, active: true, mfa: true },
    { id: 'u2', name: 'Admin two', admin: true, active: true, mfa: false },
    { id: 'u3', name: 'Tablet', admin: false, active: true, mfa: false },
  ],
  tokens: [
    { id: 't1', name: 'Old script', unused: true },
    { id: 't2', name: 'Grafana', unused: false },
  ],
  addons: [
    { slug: 'ssh', name: 'Advanced SSH', protected: false },
    { slug: 'terminal', name: 'Terminal', protected: false, allowed: true },
  ],
  config: [{ file: 'configuration.yaml', line: 142, key: 'password' }],
  outbound: {
    hosts: 3,
    integrations: [{ domain: 'iptv', name: 'IPTV', new: 1, hosts: [{ host: 'collector.example.net', new: true, first: NOW - 7200 }] }],
  },
  scanned_at: NOW - 900,
  token_unused_days: 90,
};

async function mount(Card, config = {}, data = DATA, user = { id: 'a', is_admin: true }) {
  const card = new Card();
  const calls = [];
  card.setConfig({ type: 'custom:sh-security-card', ...config });
  card.hass = {
    language: 'en',
    locale: { language: 'en' },
    user,
    callWS: async (msg) => {
      calls.push(msg.type);
      if (data instanceof Error) throw data;
      return data;
    },
  };
  await new Promise((r) => setTimeout(r, 0));
  return { card, html: card.shadowRoot.innerHTML, calls };
}

test('the points, the worst first: refusals and bans of the day, add-ons, then 2FA, new hosts, tokens, credentials', () => {
  const points = scPoints(DATA, NOW);
  assert.equal(JSON.stringify(points.map((p) => p.kind)), JSON.stringify(['refused', 'ban', 'addon', 'mfa', 'host', 'tokens', 'clear']));
  assert.equal(points[0].banned, true);
  assert.equal(points[1].ip, '203.0.113.9');
  assert.equal(points[5].names.join(), 'Old script');
  assert.equal(scPoints(null).length, 0);
  // An external URL without HTTPS is a point to check
  assert.equal(scPoints({ exposure: { external_url: 'http://x', https: false } }).at(-1).kind, 'http');
});

test('the card: status pill, rows opening the Security tab, max_items and "+N more", the line in order', async () => {
  const { card, html, calls } = await mount(SecurityCard, { max_items: 4 });
  assert.equal(calls.join(), 'system_hub/security');
  assert.match(html, /lvl-alert/);
  assert.match(html, /3 to fix · 4 to check/);
  assert.match(html, /185\.220\.101\.42[\s\S]*?Internet · ×5 ·[\s\S]*?Banned/);
  assert.match(html, /Advanced SSH[\s\S]*?Not protected/);
  assert.doesNotMatch(html, /Terminal/);
  assert.match(html, /Admin two[\s\S]*?No 2FA/);
  assert.doesNotMatch(html, /collector\.example\.net/);
  assert.match(html, /\+3 more/);
  assert.match(html, /The rest is in order[\s\S]*?HTTPS · IP ban on · 1 of 2 admins with 2FA/);
  assert.match(html, /scene|shb-scene/);
  card._open();
  assert.equal(pushed.at(-1), '/system-hub/security');
  card._open('security_accounts');
  assert.equal(pushed.at(-1), '/system-hub/security_accounts');
  // Each row opens its sub-tab
  assert.match(html, /data-open="security"[^>]*>[\s\S]*?185\.220\.101\.42/);
  assert.match(html, /data-open="security_system"[^>]*>[\s\S]*?Advanced SSH/);
  assert.match(html, /data-open="security_accounts"[^>]*>[\s\S]*?Admin two/);
  // show_ok: false drops the line
  const { html: plain } = await mount(SecurityCard, { show_ok: false });
  assert.doesNotMatch(plain, /The rest is in order/);
  assert.throws(() => new SecurityCard().setConfig({ max_items: 0 }), /max_items/);
});

test('everything in order: the line and the outbound hosts; hide_when_ok hides the card', async () => {
  const fine = { ...DATA, refused: [], bans: [], users: [DATA.users[0]], tokens: [], addons: [], config: [], outbound: { hosts: 9, integrations: [] } };
  const { html } = await mount(SecurityCard, {}, fine);
  assert.match(html, /lvl-ok/);
  assert.match(html, /Nothing to report/);
  assert.match(html, /Everything is in order/);
  assert.match(html, /9 hosts contacted[\s\S]*?No new host in 7 days/);
  const { card } = await mount(SecurityCard, { hide_when_ok: true }, fine);
  assert.equal(card.hidden, true);
});

test('not an administrator, module off, an error: a notice, no command sent to a non-admin', async () => {
  const denied = await mount(SecurityCard, {}, DATA, { id: 'b', is_admin: false });
  assert.equal(denied.calls.length, 0);
  assert.match(denied.html, /Administrators only/);
  const off = Object.assign(new Error('off'), { code: 'not_enabled' });
  assert.match((await mount(SecurityCard, {}, off)).html, /Security module off/);
  assert.match((await mount(SecurityCard, {}, new Error('boom'))).html, /Could not read[\s\S]*?boom/);
});

test('the mini card: its three worst points and "+N more", the full card once zoomed in', async () => {
  const { card, html } = await mount(SecurityMiniCard);
  assert.match(html, /class="zoom"/);
  assert.equal((html.match(/class="row (bad|warn)"/g) || []).length, 3);
  assert.match(html, /\+4 more/);
  assert.doesNotMatch(html, /The rest is in order/);
  card._zoomed = true;
  card._sig = null;
  card._render();
  assert.match(card.shadowRoot.innerHTML, /The rest is in order/);
  assert.throws(() => new SecurityMiniCard().setConfig({ zoom: 'no' }), /zoom/);
});

test('the editor keeps the YAML minimal; every language has every English key', () => {
  const editor = new SecurityCardEditor();
  let written;
  editor.dispatchEvent = (ev) => (written = ev.detail.config);
  editor.setConfig({ type: 'custom:sh-security-card' });
  editor.hass = { language: 'en', locale: { language: 'en' } };
  editor._form.dispatch({ type: 'custom:sh-security-card', max_items: 6, show_ok: false, illustration: true, title: '' });
  assert.equal(JSON.stringify(written), JSON.stringify({ type: 'custom:sh-security-card', show_ok: false }));
  const keys = Object.keys(SC_I18N.en);
  for (const [lang, table] of Object.entries(SC_I18N)) {
    const missing = keys.filter((k) => !(k in table));
    assert.equal(missing.length, 0, `${lang} misses ${missing.join(', ')}`);
  }
});
