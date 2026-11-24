import { GS_DOMAIN, GS_PREFIX } from "./core.js";
import { GS_I18N } from "./i18n/gs-i18n.js";

export const gsLang = (hass, config) => {
  const raw = String(config?.language || hass?.locale?.language || hass?.language || 'en');
  // Exact code first (sr-Latn, Serbian in Latin script), then its base language (fr-FR → fr, pt-BR → pt).
  if (GS_I18N[raw]) return raw;
  const l = raw.split('-')[0];
  return GS_I18N[l] ? l : 'en';
};

// Locale for Intl: Home Assistant's full code (pt-PT, nl-BE…) when it is a variant of the card's language,
// else the card's language. Bare "pt" means Brazilian to Intl, while the card's Portuguese is European.
export const gsLocale = (hass, config) => {
  const lang = gsLang(hass, config);
  const full = String(hass?.locale?.language || hass?.language || '');
  const locale = full && (full === lang || (!GS_I18N[full] && full.split('-')[0] === lang)) ? full : lang;
  return locale === 'pt' ? 'pt-PT' : locale;
};

export const gsT = (lang, key, vars = {}) =>
  (GS_I18N[lang]?.[key] ?? GS_I18N.en[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');

// "{n} file" / "{n} files": the *_one key for 1, *_many otherwise.
export const gsN = (lang, key, n, vars = {}) => gsT(lang, `${key}_${n === 1 ? 'one' : 'many'}`, { n, ...vars });

export const gsEsc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const GS_DEFAULTS = { show_title: true, show_subtitle: true, show_files: true, show_export: true };
export const GS_MINI_DEFAULTS = { ...GS_DEFAULTS, zoom: true };
export const GS_FILES_SHOWN = 30;
// behind: the remote has commits that are not here (the next commit pulls them first);
// diverged: both sides have commits, nothing is pushed until it is resolved by hand (see Settings → Repairs).
export const GS_STATUSES = ['clean', 'dirty', 'ahead', 'error', 'behind', 'diverged'];

// Pull is offered whenever the remote has commits that are not here (status behind, but also dirty or error),
// except with local changes on top of local commits: the action refuses that case (commit first, then pull).
export function gsPullable(a) {
  const behind = Number(a?.behind) || 0;
  const ahead = Number(a?.ahead) || 0;
  const dirty = (Number(a?.changed_count) || 0) > 0;
  return behind > 0 && !(dirty && ahead > 0);
}

// Minutes elapsed since `iso` (0 for a date in the future or unreadable).
export const gsMinutes = (iso, now = Date.now()) => {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? Math.max(0, (now - t) / 60000) : 0;
};

// The integration's entities, from the entity registry: { device: { status, last_commit, …, commit_push } }.
// Each entity is told apart by its translation key, else by the end of its entity ID (renamed IDs keep the key).
export const GS_KEYS = {
  status: '_status',
  changed_files: '_changed_files',
  last_commit: '_last_commit',
  last_push: '_last_push',
  last_export: '_last_export',
  branch: '_branch',
  commit_push: '_commit_and_push',
  export_dashboards: '_export_dashboards',
};
export function gsDevices(registry) {
  const devices = {};
  for (const [id, e] of Object.entries(registry || {})) {
    if (e?.platform !== GS_DOMAIN) continue;
    // Only the Git Sync module's entities: other modules have a "status" too
    const tk = String(e.translation_key || '');
    if (tk && !tk.startsWith(GS_PREFIX)) continue;
    if (!tk && !id.includes('_git_sync_')) continue;
    const d = (devices[e.device_id || ''] ||= {});
    const keys = Object.keys(GS_KEYS);
    const key = keys.find((k) => tk === GS_PREFIX + k) || keys.find((k) => id.endsWith(GS_KEYS[k]));
    if (key) d[key] = id;
  }
  return devices;
}

// A click in a dialog opened from the card (more-info, the diff viewer…) is not a click elsewhere.
export const gsInDialog = (ev) =>
  (ev.composedPath?.() || []).some((n) =>
    ['ha-more-info-dialog', 'ha-dialog', 'dialog', 'git-sync-diff-dialog'].includes(n?.localName),
  );

// "A click elsewhere" is caught on the pointer, not only on the click event: on iOS (Safari and the companion app)
// a tap on something that is not clickable (the background, an empty spot, a card with no action) sends no click to
// the page. It counts when the press and the release are both outside (`isOut`; a slider dragged out of the card
// does not fold it), and a scroll does not count (the browser cancels the pointer). Keyboard clicks still go through
// the click event.
export const gsWatchOutside = (isOut, handler) => {
  let downOutside = false;
  const onDown = (ev) => {
    downOutside = isOut(ev);
  };
  const onUp = (ev) => {
    if (downOutside && isOut(ev)) handler(ev);
    downOutside = false;
  };
  const onClick = (ev) => {
    if (ev.detail === 0 && isOut(ev)) handler(ev);
  };
  return {
    on() {
      document.addEventListener?.('pointerdown', onDown, true);
      document.addEventListener?.('pointerup', onUp, true);
      document.addEventListener?.('click', onClick, true);
    },
    // A tap (press and release at the same spot), for the tests.
    tap(ev) {
      onDown(ev);
      onUp(ev);
    },
    off() {
      document.removeEventListener?.('pointerdown', onDown, true);
      document.removeEventListener?.('pointerup', onUp, true);
      document.removeEventListener?.('click', onClick, true);
    },
  };
};

// No rewrite of the card between a press and its click: Home Assistant updates the card several times a second, and a
// rewrite under the pointer replaces the element pressed, so that the click lands on the card itself and does nothing
// (a button or a row that does not react). While a press is in progress (`_pressing`), a render is left pending
// (`_dirty`): it is done at the click, or right after the release when no click follows (a drag, a scroll).
// `_byPointer` tells a mouse or touch use from the keyboard: after a rewrite, the focus is put back only for the
// keyboard (no focus ring after a click), and always in a text field.
export const gsHoldUnderPress = (card, render) => {
  const root = card.shadowRoot;
  card._onPressEnd = () => {
    window.removeEventListener?.('pointerup', card._onPressEnd, true);
    window.removeEventListener?.('pointercancel', card._onPressEnd, true);
    setTimeout(() => card._endPress(), 0);
  };
  card._endPress = () => {
    card._pressing = false;
    if (!card._dirty) return;
    card._dirty = false;
    render();
  };
  // Left in the middle of a press (see disconnectedCallback).
  card._dropPress = () => {
    card._pressing = false;
    card._dirty = false;
    window.removeEventListener?.('pointerup', card._onPressEnd, true);
    window.removeEventListener?.('pointercancel', card._onPressEnd, true);
  };
  root.addEventListener?.('pointerdown', () => {
    card._byPointer = true;
    card._pressing = true;
    window.addEventListener?.('pointerup', card._onPressEnd, true);
    window.addEventListener?.('pointercancel', card._onPressEnd, true);
  });
  root.addEventListener?.('keydown', () => {
    card._byPointer = false;
  });
  // At the click (capture: before the card acts on it) the press is over, and what the click changes is drawn at once.
  card._pressClick = (ev) => {
    card._pressing = false;
    if (ev.detail === 0) card._byPointer = false;
  };
  root.addEventListener?.('click', card._pressClick, true);
};

// Whether the focus goes back to `el` after a rewrite (see gsHoldUnderPress).
export const gsKeepsFocus = (card, el) => !card._byPointer || typeof el?.selectionStart === 'number';

// Status letter and colour of a file in the diff viewer, as in an editor's source control view.
export const GS_DIFF_STATUS = {
  added: { letter: 'A', key: 'diff_added', color: 'var(--gs-ok)' },
  modified: { letter: 'M', key: 'diff_modified', color: 'var(--gs-warn)' },
  deleted: { letter: 'D', key: 'diff_deleted', color: 'var(--gs-alert)' },
  renamed: { letter: 'R', key: 'diff_renamed', color: 'var(--gs-info)' },
  copied: { letter: 'C', key: 'diff_added', color: 'var(--gs-info)' },
  mode: { letter: 'T', key: 'diff_mode', color: 'var(--gs-off)' },
};

// jscpd:ignore-start (the panel's own copy of the diff viewer: a dashboard card loads without the panel)
// "config/packages/lights.yaml" → ["lights.yaml", "config/packages"].
export const gsSplitPath = (path) => {
  const i = String(path || '').lastIndexOf('/');
  return i < 0 ? [path, ''] : [path.slice(i + 1), path.slice(0, i)];
};

// "git@github.com:me/homeassistant-config.git" → "me/homeassistant-config".
export const gsRepo = (url) => {
  if (!url) return '';
  const cleaned = String(url).replace(/\.git$/, '');
  const m = cleaned.match(/[:/]([^/:]+\/[^/:]+)$/);
  return m ? m[1] : cleaned;
};
// jscpd:ignore-end

// The parts of the header that hold the status pill (see _fitPill).
export const GS_PILL = { block: '.titles', row: '.title-row', name: '.title', chip: '.pill', sub: '.subtitle' };
