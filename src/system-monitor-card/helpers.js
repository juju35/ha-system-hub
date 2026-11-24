// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
import { STRINGS } from "./i18n/strings.js";

export const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);


export const lang = (hass, config) => {
  const l = (config?.language) || (hass && (hass.locale?.language || hass.language)) || "en";
  return STRINGS[l] ? l : STRINGS[l.split("-")[0]] ? l.split("-")[0] : "en";
};

// Locale for Intl: Home Assistant's full locale when its base matches the card's resolved language (keeps the region,
// e.g. pt-BR or de-CH), otherwise the resolved language. Home Assistant's "pt" is European Portuguese, which Intl would
// format as Brazilian, so bare "pt" becomes "pt-PT". sr-Latn stays as resolved.
export const fmtLang = (hass, config) => {
  const l = lang(hass, config);
  const ha = hass && (hass.locale?.language || hass.language);
  const loc = ha && ha.split("-")[0] === l ? ha : l;
  return loc === "pt" ? "pt-PT" : loc;
};

/** A number with `min` to `max` decimals in the locale's notation (decimal comma in French), without grouping. */
export const fmtNum = (v, loc, max, min = max) => {
  try {
    return new Intl.NumberFormat(loc, { minimumFractionDigits: min, maximumFractionDigits: max, useGrouping: false }).format(v);
  } catch {
    return new Intl.NumberFormat("en", { minimumFractionDigits: min, maximumFractionDigits: max, useGrouping: false }).format(v);
  }
};

export const t = (hass, config, key) => STRINGS[lang(hass, config)][key] ?? STRINGS.en[key] ?? key;

export const num = (s) => {
  if (!s) return null;
  const v = parseFloat(s.state);
  return Number.isFinite(v) ? v : null;
};

// Data sizes: SI prefixes are powers of 1000, binary prefixes (KiB, MiB…) powers of 1024.
export const SIZE_FACTORS = {
  bit: 1 / 8, kbit: 125, Mbit: 125e3, Gbit: 125e6,
  B: 1, kB: 1e3, KB: 1e3, MB: 1e6, GB: 1e9, TB: 1e12, PB: 1e15,
  KiB: 1024, MiB: 1024 ** 2, GiB: 1024 ** 3, TiB: 1024 ** 4, PiB: 1024 ** 5,
};

export const toBytes = (s) => {
  const v = num(s);
  if (v === null) return null;
  return v * (SIZE_FACTORS[s.attributes.unit_of_measurement || "B"] ?? 1);
};

/** Data rate sensor in bytes per second (System Monitor reports MB/s by default). */
export const toBps = (s) => {
  const v = num(s);
  if (v === null) return null;
  const unit = String(s.attributes.unit_of_measurement || "B/s").replace(/\/s$/, "");
  return v * (SIZE_FACTORS[unit] ?? 1);
};

/** Sizes in powers of 1024, with binary prefixes as Home Assistant shows them (System Monitor reports MiB and GiB). */
export const fmtBytes = (b, loc = "en") => {
  if (b === null || b === undefined) return "—";
  const units = ["B", "KiB", "MiB", "GiB", "TiB", "PiB"];
  let i = 0;
  while (b >= 1024 && i < units.length - 1) {
    b /= 1024;
    i++;
  }
  // Up to 2 decimals under 10, 1 under 100, none above; trailing zeros dropped ("1.5 KiB", "20 GiB").
  return `${fmtNum(b, loc, b >= 100 || i === 0 ? 0 : b >= 10 ? 1 : 2, 0)} ${units[i]}`;
};

// "used / total" label: the unit of used is dropped only when it matches the total's ("12.3 / 62.5 GiB", "980 MiB / 62.5 GiB").
export const fmtBytesPair = (used, total, loc = "en") => {
  const u = fmtBytes(used, loc).split(" ");
  const t = fmtBytes(total, loc).split(" ");
  return `${u[1] === t[1] ? u[0] : u.join(" ")} / ${t.join(" ")}`;
};

export const fmtRate = (bps, loc = "en") => {
  if (bps === null || bps === undefined) return "—";
  const units = ["B/s", "kB/s", "MB/s", "GB/s"];
  let i = 0;
  while (bps >= 1000 && i < units.length - 1) {
    bps /= 1000;
    i++;
  }
  return `${fmtNum(bps, loc, bps >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
};

export const fmtUptime = (sec, hass, config) => {
  if (sec === null) return "—";
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d} ${t(hass, config, "days")} ${h} ${t(hass, config, "hours")}`;
  if (h > 0) return `${h} ${t(hass, config, "hours")} ${m} ${t(hass, config, "minutes")}`;
  return `${m} ${t(hass, config, "minutes")}`;
};

/** Seconds since the "Last boot" / "Uptime" sensor (a boot timestamp, or a duration). */
export const DURATION_FACTORS = { s: 1, min: 60, h: 3600, d: 86400 };
export const uptimeSec = (s) => {
  if (!s) return null;
  if (/^\d+(\.\d+)?$/.test(s.state)) return parseFloat(s.state) * (DURATION_FACTORS[s.attributes.unit_of_measurement] ?? 1);
  const boot = Date.parse(s.state);
  return Number.isFinite(boot) ? Math.max(0, (Date.now() - boot) / 1000) : null;
};

/**
 * CPU temperature: Home Assistant converts it to the user's unit (unit system, or the sensor's display unit). The value
 * is shown in that unit, the warning levels and the gauge use it converted to °C.
 */
export const TO_CELSIUS = { "°C": (v) => v, "°F": (v) => ((v - 32) * 5) / 9, K: (v) => v - 273.15 };
export const temperature = (s, hass) => {
  const v = num(s);
  if (v === null) return { c: null, display: "—", max: 100 };
  const unit = s.attributes?.unit_of_measurement || hass?.config?.unit_system?.temperature || "°C";
  const c = (TO_CELSIUS[unit] || TO_CELSIUS["°C"])(v);
  // The top of its 24 h curve: 100 °C in the sensor's unit (its statistics are in that unit).
  const max = unit === "°F" ? 212 : unit === "K" ? 373.15 : 100;
  return { c, display: `${Math.round(v)}${unit.startsWith("°") ? unit : ` ${unit}`}`, max };
};

export const level = (v, warn, crit) => (v === null ? "" : v >= crit ? "crit" : v >= warn ? "warn" : "ok");

// Default warning / critical thresholds: percentages, the CPU temperature in °C. Each can be set in the card options
// (`cpu_warning`, `cpu_critical`, `ram_warning`…).
export const THRESHOLDS = {
  cpu_warning: 70,
  cpu_critical: 90,
  ram_warning: 80,
  ram_critical: 95,
  disk_warning: 80,
  disk_critical: 90,
  temp_warning: 75,
  temp_critical: 90,
  swap_warning: 50,
  swap_critical: 80,
  // Days since the last successful automatic backup.
  backup_warning: 2,
  backup_critical: 7,
};

/** A threshold option as a number, or its default when unset or not a number. */
export const threshold = (config, key) => {
  const v = config?.[key];
  const n = v === "" || v === null || v === undefined ? Number.NaN : Number(v);
  return Number.isFinite(n) ? n : THRESHOLDS[key];
};

/** The level ("ok", "warn", "crit") of a metric's value against the thresholds of the card's config. */
export const metricLevel = (config, metric, v) => level(v, threshold(config, `${metric}_warning`), threshold(config, `${metric}_critical`));

// Home Assistant's theme colour names (the ui_color selector of the visual editor), drawn as `var(--<name>-color)`
// with Home Assistant's default value as fallback (a theme that leaves one out).
export const UI_COLORS = {
  primary: "#03a9f4", accent: "#ff9800", red: "#f44336", pink: "#e91e63", purple: "#926bc7", "deep-purple": "#6e41ab",
  indigo: "#3f51b5", blue: "#2196f3", "light-blue": "#03a9f4", cyan: "#00bcd4", teal: "#009688", green: "#4caf50",
  "light-green": "#8bc34a", lime: "#cddc39", yellow: "#ffeb3b", amber: "#ffc107", orange: "#ff9800", "deep-orange": "#ff6f22",
  brown: "#795548", "light-grey": "#bdbdbd", grey: "#9e9e9e", "dark-grey": "#606060", "blue-grey": "#607d8b", black: "#000000",
  white: "#ffffff", disabled: "#bdbdbd",
};

/**
 * A level colour option (ok_color, warning_color, critical_color, #131) as a CSS colour: a Home Assistant colour name,
 * an `[r, g, b]` list (the RGB selector) or any CSS colour (`#43a047`, `rgb(…)`, `var(--x)`); null when unset or
 * unusable (a value that could leave the property is ignored).
 */
export const levelColor = (v) => {
  if (Array.isArray(v) && v.length === 3 && v.every((n) => Number.isFinite(Number(n)))) return `rgb(${v.map(Number).join(", ")})`;
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s || /[;{}<>"'\\]/.test(s)) return null;
  return Object.hasOwn(UI_COLORS, s) ? `var(--${s}-color, ${UI_COLORS[s]})` : s;
};

// The custom property each level colour option sets on the card.
export const LEVEL_COLORS = { ok_color: "--sm-level-ok", warning_color: "--sm-warn", critical_color: "--sm-crit" };

export const svgIcon = (path, cls = "") => `<svg class="icon ${cls}" viewBox="0 0 24 24"><path d="${path}"/></svg>`;

export const pct = (used, free) => (used !== null && free !== null && used + free > 0 ? (used / (used + free)) * 100 : null);
