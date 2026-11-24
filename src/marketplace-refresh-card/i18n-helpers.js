// The full code when the card has it (sr-Latn), else the part before the dash (fr-FR → fr, pt-BR → pt), else English.
import { HR_DOMAIN, HR_PREFIX } from "./core.js";
import { HR_I18N } from "./i18n/hr-i18n.js";

export const hrLang = (hass, config) => {
  const raw = String(config?.language || hass?.locale?.language || hass?.language || 'en');
  if (HR_I18N[raw]) return raw;
  const l = raw.split('-')[0];
  return HR_I18N[l] ? l : 'en';
};

// Locale for Intl: Home Assistant's full locale (pt-BR, fr-CA…) when its base is the card's language, else the card's
// language (option `language:` set to another one, or a code the card has its own strings for: sr vs sr-Latn).
// A bare `pt` is Home Assistant's European Portuguese: Intl reads it as Brazilian, so it becomes pt-PT.
export const hrLocale = (hass, config) => {
  const lang = hrLang(hass, config);
  const full = String(hass?.locale?.language || hass?.language || '');
  const loc = full === lang || (!HR_I18N[full] && full.split('-')[0] === lang) ? full || lang : lang;
  return loc === 'pt' ? 'pt-PT' : loc;
};

export const hrT = (lang, key, vars = {}) =>
  (HR_I18N[lang]?.[key] ?? HR_I18N.en[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');

// A count's string: `<key>_one`, `<key>_few` (Serbian, Polish: 2-4, 22-24…) or `<key>_many`, by the language's plural rules.
export const hrPlural = (lang, locale, key, n) => {
  let form = n === 1 ? 'one' : 'other';
  try {
    form = new Intl.PluralRules(locale).select(n);
  } catch {
    // Unknown locale: one or other.
  }
  const strings = HR_I18N[lang] || HR_I18N.en;
  const suffix = form === 'one' ? 'one' : form === 'few' && strings[`${key}_few`] ? 'few' : 'many';
  return hrT(lang, `${key}_${suffix}`, { n });
};

export const hrEsc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// The focus the card gives back itself (after a re-render, a confirmation) never scrolls the page.
export const HR_FOCUS = { preventScroll: true };
export const HR_DEFAULTS = { show_title: true, show_subtitle: true, show_next_check: true, show_updates: true, show_system_updates: false, show_failed: true, check_button: true, install_button: true, hide_when_ok: false };

// The integration's entities, from the entity registry: { device: { status, last_check, button } }.
// Each entity is told apart by its translation key, else by the end of its entity ID (renamed IDs keep the key).
export const HR_KEYS = { status: '_marketplace_status', last_check: '_marketplace_last_check', check_updates: '_marketplace_check_updates' };
export function hrDevices(registry) {
  const devices = {};
  for (const [id, e] of Object.entries(registry || {})) {
    if (e?.platform !== HR_DOMAIN) continue;
    // The other modules of System Hub have a status too: only the Marketplace's.
    const tk = String(e.translation_key || '');
    if (tk && !tk.startsWith(HR_PREFIX)) continue;
    const keys = Object.keys(HR_KEYS);
    const key = keys.find((k) => tk === HR_PREFIX + k) || (!tk && keys.find((k) => id.endsWith(HR_KEYS[k])));
    if (!key) continue;
    const d = (devices[e.device_id || ''] ||= {});
    d[key === 'check_updates' ? 'button' : key] = id;
  }
  return devices;
}

// The editor's entity choice: the Marketplace status sensors, when there is any.
export const hrStatusIds = (registry) => {
  const ids = Object.values(hrDevices(registry))
    .map((d) => d.status)
    .filter(Boolean);
  return ids.length ? { include_entities: ids } : {};
};

// The Marketplace's own update entities: one per installed repository.
export const hrMarketplaceUpdates = (registry) =>
  Object.keys(registry || {}).filter((id) => id.startsWith('update.') && registry[id]?.platform === 'marketplace');

// Every other update entity (show_system_updates): Home Assistant itself (Core, Supervisor, OS) and the apps, from the
// Supervisor, then the devices and services (a Zigbee or ESPHome firmware…). The repositories of HACS are left out too,
// and the hidden entities, like the Updates tab of the panel.
export const HR_REPOSITORY_PLATFORMS = ['marketplace', 'hacs'];
export const hrSystemUpdates = (registry) =>
  Object.keys(registry || {}).filter(
    (id) => id.startsWith('update.') && !HR_REPOSITORY_PLATFORMS.includes(registry[id]?.platform) && !registry[id]?.hidden,
  );

// The parts of the header that hold the status pill (see _fitPill).
export const MR_PILL = { block: '.heading', row: '.title-row', name: '.title', chip: '.pill', sub: '.subtitle' };
