import { OE_DOMAIN } from "./core.js";
import { OE_I18N } from "./i18n/oe-i18n.js";

export const OE_LANGS = [
  ['en', 'English'],
  ['fr', 'Français'],
  ['de', 'Deutsch'],
  ['es', 'Español'],
  ['it', 'Italiano'],
  ['nl', 'Nederlands'],
  ['pt', 'Português (Portugal)'],
  ['pl', 'Polski'],
  ['sr', 'Српски'],
  ['sr-Latn', 'Srpski (latinica)'],
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
];

export const oeLang = (hass, config) => {
  const raw = String(config?.language || hass?.locale?.language || hass?.language || 'en');
  if (OE_I18N[raw]) return raw;
  const l = raw.split('-')[0];
  return OE_I18N[l] ? l : 'en';
};

// The locale for Intl: Home Assistant's full tag (pt-BR, nl-BE…) when it is the card's language, else the card's language.
// A bare "pt" is Home Assistant's European Portuguese, but Intl reads it as Brazilian: it becomes pt-PT.
export const oeLocale = (hass, config) => {
  const lang = oeLang(hass, config);
  const ha = String(hass?.locale?.language || hass?.language || '');
  const tag = ha && (ha === lang || ha.split('-')[0] === lang) ? ha : lang;
  return tag === 'pt' ? 'pt-PT' : tag;
};

export const oeT = (lang, key, vars = {}) =>
  (OE_I18N[lang]?.[key] ?? OE_I18N.en[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');

export const oeEsc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const OE_DEFAULTS = {
  show_title: true,
  show_subtitle: true,
  show_stats: true,
  show_filters: true,
  max_rows: 25,
  scan_button: true,
  hide_when_empty: false,
};
export const OE_MAX_ROWS = 500;
// In the integration's order, from the most to the least certain orphan.
export const OE_REASONS = ['entry_removed', 'integration_missing', 'not_provided', 'unavailable', 'unknown'];
export const OE_REASON_ICONS = {
  entry_removed: 'mdi:puzzle-remove-outline',
  integration_missing: 'mdi:puzzle-remove-outline',
  not_provided: 'mdi:ghost-outline',
  unavailable: 'mdi:lan-disconnect',
  unknown: 'mdi:help-circle-outline',
};
// What still uses an orphan (the integration's `used_by`), in its order: automations, scripts, scenes, groups, dashboards.
export const OE_REF_ICONS = {
  automation: 'mdi:robot-outline',
  script: 'mdi:script-text-outline',
  scene: 'mdi:palette-outline',
  group: 'mdi:google-circles-communities',
  dashboard: 'mdi:view-dashboard-outline',
};
export const oeUses = (i) => (Array.isArray(i?.used_by) ? i.used_by.filter((r) => r && typeof r.name === 'string') : []);

// No longer provided: red; still provided but stale: orange.
export const oeKind = (reason) => (reason === 'unavailable' || reason === 'unknown' ? 'warn' : 'alert');

// Minutes elapsed since `iso` (0 for a date in the future or unreadable).
export const oeMinutes = (iso, now = Date.now()) => {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? Math.max(0, (now - t) / 60000) : 0;
};

// The Orphans module's entities, from the entity registry: { device: { orphans, last_scan, button } }.
// Each entity is told apart by its translation key, else by the end of its entity ID (renamed IDs keep the key).
// System Hub's other modules share the platform: only these keys are taken.
export const OE_KEYS = {
  orphans: ['orphans_orphans', '_orphans_orphaned_entities'],
  last_scan: ['orphans_last_scan', '_orphans_last_scan'],
  button: ['orphans_scan', '_orphans_scan_now'],
};
export function oeDevices(registry) {
  const devices = {};
  for (const [id, e] of Object.entries(registry || {})) {
    if (e?.platform !== OE_DOMAIN) continue;
    const keys = Object.keys(OE_KEYS);
    const key = keys.find((k) => e.translation_key === OE_KEYS[k][0]) || keys.find((k) => id.endsWith(OE_KEYS[k][1]));
    if (!key) continue;
    (devices[e.device_id || ''] ||= {})[key] = id;
  }
  return devices;
}

// The "Orphaned entities" sensor among `candidates`: the one whose state carries the entity list.
export const oePick = (hass, candidates) => candidates.find((id) => Array.isArray(hass?.states?.[id]?.attributes?.entities));

// The items matching the search text (name, entity ID, integration, device, config entry), integration and reason.
export function oeFilter(items, { q = '', platform = '', reason = '' } = {}) {
  const words = String(q).toLowerCase().split(/\s+/).filter(Boolean);
  return items.filter((i) => {
    if (platform && i.platform !== platform) return false;
    if (reason && i.reason !== reason) return false;
    if (!words.length) return true;
    const hay = [i.name, i.entity_id, i.platform, i.device, i.entry_title].filter(Boolean).join(' ').toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

// The parts of the header that hold the status pill (see _fitPill).
export const OE_PILL = { block: '.heading', row: '.title-row', name: '.title', chip: '.pill', sub: '.subtitle' };
