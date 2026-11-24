import { IW_I18N } from "./i18n/iw-i18n.js";

export const iwLang = (hass, config) => {
  const raw = String(config?.language || hass?.locale?.language || hass?.language || 'en');
  if (IW_I18N[raw]) return raw;
  const l = raw.split('-')[0];
  return IW_I18N[l] ? l : 'en';
};

// The locale for Intl: Home Assistant's full tag (pt-BR, nl-BE…) when it is the card's language, else the card's language.
// A bare "pt" is Home Assistant's European Portuguese, but Intl reads it as Brazilian: it becomes pt-PT.
export const iwLocale = (hass, config) => {
  const lang = iwLang(hass, config);
  const ha = String(hass?.locale?.language || hass?.language || '');
  const tag = ha && (ha === lang || ha.split('-')[0] === lang) ? ha : lang;
  return tag === 'pt' ? 'pt-PT' : tag;
};

export const iwT = (lang, key, vars = {}) =>
  (IW_I18N[lang]?.[key] ?? IW_I18N.en[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');

export const iwEsc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const IW_DEFAULTS = {
  show_title: true,
  show_subtitle: true,
  show_stats: true,
  show_unavailable: true,
  show_history: true,
  history_count: 5,
  check_button: true,
  hide_when_ok: false,
};
export const IW_MAX_HISTORY = 20;

// The history is newest first: keep only the last reload, failed reload or give-up of each integration (config entry).
export const iwLatestPerIntegration = (history) => {
  const seen = new Set();
  return history.filter((h) => {
    // A power cycle is per device, apart from the reloads of the device's integration.
    const key = h?.device_id ? `device:${h.device_id}` : h?.entry_id || `${h?.domain}:${h?.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

// Minutes elapsed since `iso` (0 for a date in the future or unreadable).
export const iwMinutes = (iso, now = Date.now()) => {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? Math.max(0, (now - t) / 60000) : 0;
};

// System Hub's Watchdog entities, from the entity registry: { device: { unavailable, last_reload, last_check, button } }.
// Each entity is told apart by its translation key (watchdog_…), else by the end of its entity ID, among the entities
// of the Watchdog module only (the other modules of System Hub have a "last check" too).
export const IW_KEYS = { unavailable: '_unavailable_integrations', last_reload: '_last_reload', last_check: '_last_check', check: '_check_now' };
export const IW_TRANSLATION_KEYS = { unavailable: 'watchdog_unavailable', last_reload: 'watchdog_last_reload', last_check: 'watchdog_last_check', check: 'watchdog_check' };
export function iwDevices(registry) {
  const devices = {};
  for (const [id, e] of Object.entries(registry || {})) {
    if (e?.platform !== 'system_hub') continue;
    const watchdog = e.translation_key ? e.translation_key.startsWith('watchdog_') : id.includes('_watchdog_');
    if (!watchdog) continue;
    const d = (devices[e.device_id || ''] ||= {});
    const key =
      Object.keys(IW_TRANSLATION_KEYS).find((k) => e.translation_key === IW_TRANSLATION_KEYS[k]) ||
      (e.translation_key ? undefined : Object.keys(IW_KEYS).find((k) => id.endsWith(IW_KEYS[k])));
    if (!key) continue;
    d[key === 'check' ? 'button' : key] = id;
  }
  return devices;
}

// The "Unavailable integrations" sensor among `candidates`: the one whose state carries the integration list.
export const iwPick = (hass, candidates) => candidates.find((id) => Array.isArray(hass?.states?.[id]?.attributes?.integrations));

// History item kinds: reloads and power cycles (a device switched off and on with its plug), done, failed or given up.
export function iwHistoryKind(kind) {
  if (kind === 'reloaded' || kind === 'power_cycled') return 'ok';
  if (kind === 'reload_failed' || kind === 'power_cycle_failed') return 'warn';
  return 'alert';
}

export function iwHistoryLabel(kind) {
  return kind === 'gave_up' || kind === 'power_cycle_gave_up' ? 'gave_up_event' : kind;
}

// The parts of the header that hold the status pill (see _fitPill).
export const IW_PILL = { block: '.heading', row: '.title-row', name: '.title', chip: '.pill', sub: '.subtitle' };
