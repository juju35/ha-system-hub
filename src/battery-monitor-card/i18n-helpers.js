import { BM_I18N } from "./i18n/bm-i18n.js";

export const bmLang = (hass, config) => {
  const raw = String(config?.language || hass?.locale?.language || hass?.language || 'en');
  // Exact code first (sr-Latn, Serbian in Latin script), then the part before the dash (fr-FR → fr, pt-BR → pt).
  if (BM_I18N[raw]) return raw;
  const l = raw.split('-')[0].toLowerCase();
  return BM_I18N[l] ? l : 'en';
};

// A Home Assistant dialog (a more-info…) is open: its history entry is the current one.
export const bmDialogOpen = () => {
  const state = globalThis.window?.history?.state;
  return !!state?.dialog && state.open !== false;
};

export const bmT = (lang, key, vars = {}) =>
  (BM_I18N[lang]?.[key] ?? BM_I18N.en[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');

export const bmEsc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Days left under which a battery's replacement forecast is shown in the list.
export const BM_FORECAST_DAYS = 60;

// The full screen view by replacement date: each battery goes in the first band it fits.
export const bmDaysLeft = (b) => (Number.isInteger(b.days_left) ? b.days_left : Number.POSITIVE_INFINITY);
export const BM_BANDS = [
  { key: 'now', icon: 'mdi:battery-alert-variant-outline', test: (b) => Boolean(b.low || b.unavailable) },
  { key: 'month', icon: 'mdi:calendar-alert', test: (b) => bmDaysLeft(b) <= 30 },
  { key: 'quarter', icon: 'mdi:calendar-clock', test: (b) => bmDaysLeft(b) <= 92 },
  { key: 'later', icon: 'mdi:calendar-check', test: (b) => bmDaysLeft(b) < Number.POSITIVE_INFINITY },
  { key: 'none', icon: 'mdi:help-circle-outline', test: () => true },
];
// The soonest to the threshold first, then the lowest, then by name.
export function bmByForecast(a, b) {
  return bmDaysLeft(a) - bmDaysLeft(b) || (a.level ?? 101) - (b.level ?? 101) || a.name.localeCompare(b.name);
}
// `expanded`: the full screen view laid out in the card itself (by room / by type / by replacement date, what to replace,
// next replacement), as the sidebar panel shows it; `csv_button` hides its CSV export.
export const BM_DEFAULTS = { show_title: true, columns: 1, only_low: false, hide_when_ok: false, notify_button: true, popup: true, expanded: false, csv_button: true };
