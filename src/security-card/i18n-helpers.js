import { SC_I18N } from "./i18n/sc-i18n.js";

export const scLang = (hass, config) => {
  const raw = String(config?.language || hass?.locale?.language || hass?.language || 'en');
  if (SC_I18N[raw]) return raw;
  const l = raw.split('-')[0];
  return SC_I18N[l] ? l : 'en';
};

// The locale for Intl: Home Assistant's full tag (pt-BR, nl-BE…) when it is the card's language, else the card's language.
// A bare "pt" is Home Assistant's European Portuguese, but Intl reads it as Brazilian: it becomes pt-PT.
export const scLocale = (hass, config) => {
  const lang = scLang(hass, config);
  const ha = String(hass?.locale?.language || hass?.language || '');
  const tag = ha && (ha === lang || ha.split('-')[0] === lang) ? ha : lang;
  return tag === 'pt' ? 'pt-PT' : tag;
};

export const scT = (lang, key, vars = {}) =>
  (SC_I18N[lang]?.[key] ?? SC_I18N.en[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');

export const scEsc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const SC_DEFAULTS = {
  show_title: true,
  show_subtitle: true,
  max_items: 6,
  show_ok: true,
  hide_when_ok: false,
};
export const SC_MAX_ITEMS = 20;
// The mini card's compact view: its first points only
export const SC_MINI_ITEMS = 3;
// Read again every 5 minutes at most, as the panel's Security tab
export const SC_READ_MS = 300000;
export const SC_PANEL = '/system-hub/security';
// The panel's Security sub-tab of each kind of point
export const SC_TABS = { refused: 'security', ban: 'security', http: 'security', mfa: 'security_accounts', tokens: 'security_accounts', addon: 'security_system', clear: 'security_system', host: 'security_outbound' };

// What needs a look in system_hub/security's answer, the worst first: [{ tone, kind, key, ... }]. bad: refused logins
// from the Internet in 24 h (and the bans of that day), add-ons running unprotected without being allowed; warn:
// administrators without 2FA, hosts new for an integration, unused long-lived tokens (one point), credentials written
// in clear, an external URL without HTTPS. The same rules as the panel's (_scSummary).
export function scPoints(d, now = Date.now() / 1000) {
  if (!d) return [];
  const day = now - 86400;
  const bad = [];
  const warn = [];
  const banned = new Map((d.bans || []).map((b) => [b.ip, b.at]));
  const refused = (d.refused || []).filter((r) => r.internet && !r.ignored && r.day > 0);
  for (const r of refused) bad.push({ tone: 'bad', kind: 'refused', key: `r:${r.ip}`, ip: r.ip, count: r.day, last: r.last, banned: banned.has(r.ip) });
  for (const b of d.bans || []) {
    if (b.at > day && !refused.some((r) => r.ip === b.ip)) bad.push({ tone: 'bad', kind: 'ban', key: `b:${b.ip}`, ip: b.ip, at: b.at });
  }
  for (const a of d.addons || []) {
    if (!a.protected && !a.allowed) bad.push({ tone: 'bad', kind: 'addon', key: `a:${a.slug}`, name: a.name });
  }
  for (const u of d.users || []) {
    if (u.admin && u.active && !u.mfa) warn.push({ tone: 'warn', kind: 'mfa', key: `u:${u.id || u.name}`, name: u.name });
  }
  for (const g of d.outbound?.integrations || []) {
    for (const h of g.hosts || []) {
      if (h.new) warn.push({ tone: 'warn', kind: 'host', key: `h:${g.domain}|${h.host}`, host: h.host, integration: g.name, first: h.first });
    }
  }
  const unused = (d.tokens || []).filter((t) => t.unused);
  if (unused.length) warn.push({ tone: 'warn', kind: 'tokens', key: 't', names: unused.map((t) => t.name), days: d.token_unused_days });
  for (const c of d.config || []) warn.push({ tone: 'warn', kind: 'clear', key: `c:${c.file}:${c.line}`, file: c.file, line: c.line, field: c.key });
  if (d.exposure?.external_url && d.exposure.https === false) warn.push({ tone: 'warn', kind: 'http', key: 'x', url: d.exposure.external_url });
  return [...bad, ...warn];
}

// The parts of the header that hold the status pill (see _fitPill).
export const SC_PILL = { block: '.heading', row: '.title-row', name: '.title', chip: '.pill', sub: '.subtitle' };
