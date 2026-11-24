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

// Locale for Intl: the full HA locale (pt-BR, fr-CA…) when it is in the card's language, else the card's
// language. HA uses "pt" for European Portuguese, which Intl reads as Brazilian: it becomes "pt-PT".
// sr-Latn stays as resolved, so the script follows the card and not the HA locale.
export const intlLang = (hass, config) => {
  const l = lang(hass, config);
  const ha = hass && (hass.locale?.language || hass.language);
  const full = l.includes("-") || !ha || ha.split("-")[0] !== l ? l : ha;
  return full === "pt" ? "pt-PT" : full;
};

// Plural forms: with a number {n}, the text "<key>_<CLDR category>" (one, few, many…) of the language is used
// when it has one, else "<key>". One Intl.PluralRules per language.
export const _plurals = new Map();
export const pluralOf = (l, n) => {
  let rules = _plurals.get(l);
  if (!rules) _plurals.set(l, (rules = new Intl.PluralRules(l)));
  return rules.select(n);
};

export const t = (hass, config, key, vars = {}) => {
  const l = STRINGS[lang(hass, config)][key] !== undefined ? lang(hass, config) : "en";
  const dict = STRINGS[l];
  const form = typeof vars.n === "number" ? dict[`${key}_${pluralOf(l, vars.n)}`] : undefined;
  return String(form ?? dict[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
};

export const valid = (s) => s && !["unknown", "unavailable", ""].includes(s.state);

// One RelativeTimeFormat per language, instead of a new one for every relative time of every render.
export const _rtf = new Map();
export const rtfFor = (l) => {
  if (!_rtf.has(l)) _rtf.set(l, new Intl.RelativeTimeFormat(l, { numeric: "auto" }));
  return _rtf.get(l);
};

export const ago = (hass, config, iso) => {
  const d = Date.parse(iso);
  if (!Number.isFinite(d)) return null;
  const diff = (d - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return t(hass, config, "just_now");
  const rtf = rtfFor(intlLang(hass, config));
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  return rtf.format(Math.round(diff / 86400), "day");
};

// 12 / 24 h clock from the Home Assistant profile (time_format): "12", "24", "system" (the browser's own
// locale) or "language" (the card's language, the Intl default: undefined).
export const hour12Of = (hass) => {
  const tf = hass?.locale?.time_format;
  if (tf === "12") return true;
  if (tf === "24") return false;
  if (tf === "system") return new Intl.DateTimeFormat(undefined, { hour: "numeric" }).resolvedOptions().hour12;
  return undefined;
};

export const fullDate = (hass, config, iso) => {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const hour12 = hour12Of(hass);
  return d.toLocaleString(intlLang(hass, config), { dateStyle: "medium", timeStyle: "short", ...(hour12 === undefined ? {} : { hour12 }) });
};

export const byDateDesc = (key) => (a, b) => (Date.parse(b[key]) || 0) - (Date.parse(a[key]) || 0);

export const svgIcon = (path, cls = "") => `<svg class="icon ${cls}" viewBox="0 0 24 24"><path d="${path}"/></svg>`;

// Same values, compared by identity: used to skip a render when nothing the card shows has changed.
export const sameSig = (a, b) => !!a && !!b && a.length === b.length && a.every((v, i) => v === b[i]);

// Patch the shadow DOM in place from the new HTML: nodes whose tag is unchanged are kept, so keyboard
// focus, hover, embedded pictures and CSS transitions survive an update, and only the changed text and
// attributes are written. Rows of a list carry a data-key (their entity or row id) and are matched by it,
// wherever they moved, so a focused row keeps its own data when the list is reordered (a node matched by
// position would be rewritten with the row taking its place, and Enter would act on that row). Nodes
// without a data-key are matched by position.
export const patchAttrs = (cur, next) => {
  for (const { name } of [...cur.attributes]) if (!next.hasAttribute(name)) cur.removeAttribute(name);
  for (const { name, value } of next.attributes) if (cur.getAttribute(name) !== value) cur.setAttribute(name, value);
};
export const keyOf = (n) => (n.nodeType === 1 ? n.getAttribute("data-key") : null);
export const sameNode = (a, b) => !!a && a.nodeType === b.nodeType && a.nodeName === b.nodeName;
// Moves a kept node. moveBefore (where supported) keeps its focus; insertBefore drops it, which is safe:
// Enter then does nothing rather than act on another row.
export const place = (parent, node, ref) => {
  if (node === ref) return;
  try {
    if (parent.moveBefore && node.parentNode === parent) return parent.moveBefore(node, ref);
  } catch (_e) {
    /* fall back to insertBefore */
  }
  parent.insertBefore(node, ref);
};
export const patchChildren = (cur, next) => {
  const old = [...cur.childNodes];
  const fresh = [...next.childNodes];
  const byKey = new Map();
  for (const o of old) {
    const k = keyOf(o);
    if (k !== null && !byKey.has(k)) byKey.set(k, o);
  }
  const used = new Set();
  fresh.forEach((n, i) => {
    const k = keyOf(n);
    let o = k !== null ? byKey.get(k) : old[i];
    if (!sameNode(o, n) || used.has(o) || (k === null && keyOf(o) !== null)) o = null;
    const ref = cur.childNodes[i] ?? null;
    if (!o) {
      cur.insertBefore(n, ref);
      return;
    }
    used.add(o);
    place(cur, o, ref);
    if (n.nodeType === 1) {
      patchAttrs(o, n);
      patchChildren(o, n);
    } else if (o.nodeValue !== n.nodeValue) o.nodeValue = n.nodeValue;
  });
  while (cur.childNodes.length > fresh.length) cur.removeChild(cur.lastChild);
};
export const morph = (root, html) => {
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  patchChildren(root, tpl.content);
};

// Open a Home Assistant page (automation editor, trace…) without reloading the frontend.
export const navigate = (path) => {
  window.history.pushState(null, "", path);
  window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
};
