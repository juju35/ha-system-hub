import { OE_DOMAIN } from "./core.js";
import { OE_DEFAULTS, OE_MAX_ROWS, OE_PILL, OE_REASONS, OE_REASON_ICONS, OE_REF_ICONS, oeDevices, oeEsc, oeFilter, oeKind, oeLang, oeLocale, oeMinutes, oePick, oeT, oeUses } from "./i18n-helpers.js";
import { shBanner, shbIsNight } from "./illustrated-header.js";
import { OrphanEntitiesMiniCard } from "./mini-card.js";
import { OE_I18N } from "./i18n/oe-i18n.js";

export class OrphanEntitiesCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement('sh-orphans-card-editor');
  }

  static getStubConfig() {
    return {};
  }

  constructor() {
    super();
    // What the user is doing on the card: kept across the renders.
    this._q = '';
    this._platform = '';
    this._reason = '';
    this._sel = new Set();
    // The orphan devices selected (by device ID).
    this._dsel = new Set();
    // The rows whose "Used by" list is open.
    this._open = new Set();
    this._showAll = false;
    this._confirm = null;
    this._busy = false;
    this._onKey = (ev) => {
      if (ev.key === 'Escape' && this._confirm) {
        this._confirm = null;
        this._render();
      }
    };
  }

  connectedCallback() {
    document.addEventListener('keydown', this._onKey);
    this._watchPill();
  }

  disconnectedCallback() {
    // Left in the middle of a press: nothing stays held.
    this._dropPress?.();
    document.removeEventListener('keydown', this._onKey);
    this._unwatchPill();
  }

  // The status pill goes on the title row, right after the title, only when the whole title and the pill's whole
  // label fit there; otherwise it takes its own line under the subtitle (the subtitle then on one line). Its dot
  // alone on a card 200 px wide or less, or when its label is wider than the title block (or, in a banner, would not
  // fit above the ground strip). Measured after each render and on every new width (or once the web font is loaded),
  // never by a fixed width; $OE_PILL names the parts.
  _fitPill() {
    const S = OE_PILL;
    for (const t of this.shadowRoot?.querySelectorAll?.(S.block) || []) {
      const row = [...(t.children || [])].find((n) => n.matches?.(S.row));
      const name = row && [...row.children].find((n) => n.matches?.(S.name));
      const chips = row ? [...row.children].filter((n) => n.matches?.(S.chip)) : [];
      if (!name?.getBoundingClientRect || !chips.length) continue;
      t.classList.remove("pill-below", "pill-dot");
      if (this.getBoundingClientRect().width <= 200) t.classList.add("pill-dot");
      // The title's whole width (scrollWidth is rounded: 1 px more, so that a title that fits is never cut).
      const need = chips.reduce((w, c) => w + 8 + c.getBoundingClientRect().width, name.scrollWidth + 1);
      if (need <= row.getBoundingClientRect().width + 0.5) continue;
      t.classList.add("pill-below");
      const box = t.closest(".banner")?.getBoundingClientRect();
      const right = t.getBoundingClientRect().right;
      const out = [name, ...chips, ...[...t.children].filter((n) => n.matches?.(S.sub))].some((n) => {
        const r = n.getBoundingClientRect();
        return r.height > 0 && (r.right > right + 0.5 || (box && (r.top < box.top - 0.5 || r.bottom > box.bottom - 10.5)));
      });
      if (out) t.classList.add("pill-dot");
    }
  }

  // Fitted again on a new width, a new content (a render) and once the web font is loaded, in the next frame.
  _watchPill() {
    if (this._pillWatch || typeof ResizeObserver !== "function") return;
    const fit = () => {
      cancelAnimationFrame(this._pillFrame);
      this._pillFrame = requestAnimationFrame(() => this._fitPill());
    };
    this._pillWatch = [new ResizeObserver(fit), typeof MutationObserver === "function" ? new MutationObserver(fit) : null];
    this._pillWatch[0].observe(this);
    if (this.shadowRoot) this._pillWatch[1]?.observe(this.shadowRoot, { childList: true, subtree: true, characterData: true });
    document.fonts?.ready?.then(fit);
    fit();
  }

  _unwatchPill() {
    for (const o of this._pillWatch || []) o?.disconnect();
    this._pillWatch = null;
  }

  setConfig(config) {
    this.connectedWhileHidden = true;
    this._config = { ...OE_DEFAULTS, ...config };
    // show_title / show_subtitle: the header's title / subtitle, hidden by the stylesheet
    this.toggleAttribute?.('hide-title', config.show_title === false);
    this.toggleAttribute?.('hide-subtitle', config.show_subtitle === false);
    if (!this.shadowRoot) {
      this.attachShadow({ mode: 'open' });
      oeHoldUnderPress(this, () => this._render());
    }
    this._sig = null;
    this._render();
  }

  set hass(hass) {
    const old = this._hass;
    this._hass = hass;
    // Nothing the card shows changed: the same state objects, registry, language and minute ("3 min ago").
    const ids = this._ids;
    if (
      old &&
      this._sig &&
      // No sensor found yet (integration not loaded): its return must be seen at once, not at the next minute.
      ids?.orphans &&
      hass.entities === old.entities &&
      hass.user === old.user &&
      Object.values(ids).every((id) => !id || hass.states[id] === old.states[id]) &&
      oeLang(hass, this._config) === oeLang(old, this._config) &&
      Math.floor(Date.now() / 60000) === this._sigMinute
    ) {
      return;
    }
    this._render();
  }

  // Set by Lovelace while the dashboard is edited (editMode) and in the card editor's preview (preview): a card
  // hidden by hide_when_empty shows again there, so that it can still be edited.
  set editMode(value) {
    this._editMode = value;
    this._sig = null;
    this._render();
  }

  get editMode() {
    return this._editMode;
  }

  set preview(value) {
    this._preview = value;
    this._sig = null;
    this._render();
  }

  get preview() {
    return this._preview;
  }

  // Hides the card and tells Lovelace (card-visibility-changed): hui-card reads the `hidden` property and then
  // drops the card's slot in a sections view. connectedWhileHidden keeps the card in the DOM so that it keeps
  // following its entities and shows again on its own. Never hidden in the editor preview / edit mode.
  _setHidden(hidden) {
    hidden = !!hidden && !this._editMode && !this._preview;
    this.connectedWhileHidden = true;
    this.style.display = hidden ? 'none' : '';
    if (!!this.hidden !== hidden) {
      this.hidden = hidden;
      this.dispatchEvent(new CustomEvent('card-visibility-changed', { detail: { value: !hidden }, bubbles: true, composed: true }));
    }
    return hidden;
  }

  getCardSize() {
    if (this.hidden) return 0;
    return 3 + (this._rows || 0);
  }

  getGridOptions() {
    return { columns: 12, min_columns: 8, rows: 'auto' };
  }

  _t(key, vars) {
    return oeT(oeLang(this._hass, this._config), key, vars);
  }

  // "{n} orphans" with the plural form of the card's language: `key_one`, `key_few` (2-4 in Serbian, Polish,
  // Russian, Ukrainian, Czech and Slovak, 0 and 2-19 in Romanian, when the language has it) or `key_many`.
  _count(key, n) {
    let cat = n === 1 ? 'one' : 'other';
    try {
      cat = new Intl.PluralRules(oeLocale(this._hass, this._config)).select(n);
    } catch {
      // Unknown locale: the simple rule above.
    }
    const form = cat === 'one' ? 'one' : cat === 'few' && OE_I18N[oeLang(this._hass, this._config)]?.[`${key}_few`] ? 'few' : 'many';
    return this._t(`${key}_${form}`, { n });
  }

  // "12 min", "3 h", "2 d".
  _duration(minutes) {
    if (minutes < 60) return this._t('minutes', { n: Math.max(1, Math.floor(minutes)) });
    const h = minutes / 60;
    return h < 48 ? this._t('hours', { n: Math.floor(h) }) : this._t('days', { n: Math.floor(h / 24) });
  }

  // "3 minutes ago", "yesterday"… in the card's language.
  _ago(iso) {
    const m = oeMinutes(iso);
    let rtf;
    try {
      rtf = new Intl.RelativeTimeFormat(oeLocale(this._hass, this._config), { numeric: 'auto' });
    } catch {
      return this._duration(m);
    }
    if (m < 1) return rtf.format(0, 'second');
    if (m < 60) return rtf.format(-Math.floor(m), 'minute');
    if (m < 1440) return rtf.format(-Math.floor(m / 60), 'hour');
    return rtf.format(-Math.floor(m / 1440), 'day');
  }

  // "in 7 minutes": when the first scan after a start is due (end of the grace period), or "" once it is.
  _in(iso) {
    const m = iso ? (new Date(iso).getTime() - Date.now()) / 60000 : NaN;
    if (!(m > 0)) return '';
    try {
      const rtf = new Intl.RelativeTimeFormat(oeLocale(this._hass, this._config), { numeric: 'auto' });
      return m < 60 ? rtf.format(Math.ceil(m), 'minute') : rtf.format(Math.ceil(m / 60), 'hour');
    } catch {
      return this._duration(m);
    }
  }

  // The status while the sensor is unknown (Home Assistant starting, grace period): with the time of the first scan.
  _waiting() {
    const due = this._in(this._hass.states[this._ids.orphans]?.attributes?.next_scan);
    return due ? `${this._t('waiting')} (${due})` : this._t('waiting');
  }

  _absolute(iso) {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return '';
    try {
      return d.toLocaleString(oeLocale(this._hass, this._config), { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
      return d.toISOString();
    }
  }

  // The entities of the device of the chosen (or found) sensor. Cached per registry object, never when empty.
  _lookup() {
    const registry = this._hass.entities;
    if (!this._reg || this._reg.registry !== registry) {
      const devices = oeDevices(registry);
      this._reg = Object.keys(devices).length ? { registry, devices } : null;
    }
    const devices = this._reg?.devices || {};
    let entity = this._config.entity;
    if (!entity) entity = oePick(this._hass, Object.values(devices).map((d) => d.orphans).filter(Boolean));
    if (!entity) return {};
    const device = Object.values(devices).find((d) => d.orphans === entity) || {};
    return { ...device, orphans: entity };
  }

  _render() {
    // Held under a press (see oeHoldUnderPress), drawn after its click.
    if (this._pressing) {
      this._dirty = true;
      return;
    }
    this._dirty = false;
    const m = this._prepare();
    if (!m) return;
    // innerHTML replaces every element: the one that had the keyboard focus gets it back after the render,
    // a text field with its caret.
    const active = this.shadowRoot.activeElement;
    const focusKey = oeKeepsFocus(this, active) && active?.dataset?.focus;
    const caret = active && typeof active.selectionStart === 'number' ? [active.selectionStart, active.selectionEnd] : null;
    this._draw(m);
    this._bind();
    this._fitPill();
    if (!focusKey) return;
    const el = [...this.shadowRoot.querySelectorAll('[data-focus]')].find((n) => n.dataset.focus === focusKey);
    el?.focus({ preventScroll: true });
    if (el && caret && typeof el.setSelectionRange === 'function') el.setSelectionRange(...caret);
  }

  // What the card shows, read from the sensors; null when nothing changed since the last render, or the card is hidden.
  _prepare() {
    if (!this._config || !this._hass || !this.shadowRoot) return null;
    const c = this._config;
    const ids = this._lookup();
    this._ids = ids;
    const states = this._hass.states;
    // Without its list (unavailable or restored while the integration is not loaded), the sensor says nothing.
    const sensorSt = ids.orphans && states[ids.orphans];
    const st = Array.isArray(sensorSt?.attributes?.entities) ? sensorSt : null;
    const scanSt = ids.last_scan && states[ids.last_scan];

    const minute = Math.floor(Date.now() / 60000);
    this._sigMinute = minute;
    // Only administrators can remove or ignore entities (admin actions), or open Settings.
    this._admin = this._hass.user?.is_admin === true;
    const ui = [this._q, this._platform, this._reason, [...this._sel], [...this._dsel], [...this._open], this._showAll, this._confirm, this._busy, this._zoomed];
    const sig = JSON.stringify([c, shbIsNight(this._hass, c), oeLang(this._hass, c), ids, sensorSt, scanSt, minute, this._admin, ui]);
    if (sig === this._sig) return null;
    this._sig = sig;

    const items = st ? st.attributes.entities.filter((i) => i && typeof i.entity_id === 'string') : [];
    // The sensor's state is unknown until the first scan (Home Assistant starting, grace period).
    const scanned = !!st && !['unknown', 'unavailable'].includes(sensorSt.state);
    const level = !st ? 'na' : !scanned ? 'idle' : items.length ? 'warn' : 'ok';

    const hidden = c.hide_when_empty && scanned && !items.length && !this._editMode && !this._preview;
    this._setHidden(hidden);
    if (hidden) return null;

    // The selection only keeps what is still listed; a filter on a vanished integration is dropped.
    const listed = new Set(items.map((i) => i.entity_id));
    for (const id of this._sel) if (!listed.has(id)) this._sel.delete(id);
    const devs = new Set((Array.isArray(st?.attributes?.devices) ? st.attributes.devices : []).map((d) => d?.device_id));
    for (const id of this._dsel) if (!devs.has(id)) this._dsel.delete(id);
    // The "Used by" lists open on entity and device rows.
    for (const id of this._open) if (!listed.has(id) && !devs.has(id)) this._open.delete(id);
    if (this._platform && !items.some((i) => i.platform === this._platform)) this._platform = '';
    if (this._reason && !items.some((i) => i.reason === this._reason)) this._reason = '';

    const shown = oeFilter(items, { q: this._q, platform: this._platform, reason: this._reason });
    const max = Math.min(OE_MAX_ROWS, Math.max(1, Number(c.max_rows) || OE_DEFAULTS.max_rows));
    const visible = this._showAll ? shown : shown.slice(0, max);
    this._rows = visible.length;
    const scannedAt = scanSt && !['unknown', 'unavailable'].includes(scanSt.state) ? scanSt.state : null;
    return { st, scanned, items, shown, visible, level, scannedAt };
  }

  _badgeIcon() {
    return 'mdi:broom';
  }

  _draw(m) {
    const { st, scanned, items, shown, visible, level, scannedAt } = m;
    const c = this._config;
    const subtitle = !st ? '' : scannedAt ? this._t('scanned', { d: this._ago(scannedAt) }) : this._t('never_scanned');
    const a = st?.attributes || {};
    const ignored = (a.ignored_integrations?.length || 0) + (a.ignored_entities?.length || 0);
    this.shadowRoot.innerHTML = shBanner(`
      <style>${this.constructor.styles}</style>
      <ha-card class="lvl-${level}${this._confirm ? ' dlg-open' : ''}">
        ${this._header(subtitle, scannedAt, items, scanned)}
        ${c.show_stats && scanned ? this._stats(items.length, Number(a.removed) || 0, ignored, a) : ''}
        ${scanned && items.length && c.show_filters ? this._filters(items) : ''}
        ${scanned ? this._list(items, shown, visible) : ''}
        ${scanned && Number(a.truncated) > 0 ? `<div class="empty trunc">${oeEsc(this._t('truncated', { n: Number(a.truncated) }))}</div>` : ''}
        ${scanned ? this._devices(a.devices, Number(a.devices_truncated) || 0) : ''}
        ${this._confirm ? this._dialog() : ''}
      </ha-card>`, { hass: this._hass, config: this._config, scene: 'orphans', pad: '12px' });
  }

  _header(subtitle, scannedAt, items, scanned) {
    return `<div class="head">
          <div class="badge"><ha-icon icon="${this._badgeIcon()}"></ha-icon></div>
          <div class="heading">
            <div class="title-row"><div class="title">${oeEsc(this._config.title || this._t('title'))}</div>${this._pill(this._status(items, scanned))}</div>
            ${subtitle ? `<div class="subtitle" title="${oeEsc(scannedAt ? this._absolute(scannedAt) : '')}">${oeEsc(subtitle)}</div>` : ''}
          </div>
          ${this._scanButton()}
          ${this._headExtra()}
        </div>`;
  }

  _bind() {
    const root = this.shadowRoot;
    const on = (sel, type, fn) => {
      for (const el of root.querySelectorAll(sel)) el.addEventListener(type, (ev) => fn(el, ev));
    };
    root.querySelector('.scan')?.addEventListener('click', () => this._scan());
    on('input.q', 'input', (el) => {
      this._q = el.value;
      this._showAll = false;
      this._render();
    });
    on('select.platform', 'change', (el) => {
      this._platform = el.value;
      this._showAll = false;
      this._render();
    });
    on('.chip[data-reason]', 'click', (el) => {
      this._reason = el.dataset.reason;
      this._showAll = false;
      this._render();
    });
    on('.row[data-id]', 'click', (el) => this._toggle(el.dataset.id));
    on('.row[data-dev]', 'click', (el) => this._toggle(el.dataset.dev, this._dsel));
    on('.used[data-used]', 'click', (el) => {
      const id = el.dataset.used;
      if (this._open.has(id)) this._open.delete(id);
      else this._open.add(id);
      this._render();
    });
    // An editor page or a dashboard: opened in Home Assistant's frontend, without reloading the page.
    on('.refs a[data-nav]', 'click', (el, ev) => {
      if (ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.button) return;
      ev.preventDefault();
      window.history.pushState(null, '', el.dataset.nav);
      window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: false } }));
    });
    on('.all', 'click', () => this._toggleAll());
    on('.more', 'click', () => {
      this._showAll = true;
      this._render();
    });
    on('.act[data-act]', 'click', (el) => {
      const act = el.dataset.act;
      if (act === 'clear') this._sel.clear();
      else if (act === 'clear_devices') this._dsel.clear();
      else this._confirm = act;
      this._render();
    });
    on('.dlg [data-dlg]', 'click', (el) => (el.dataset.dlg === 'ok' ? this._run() : this._cancel()));
    on('.scrim', 'click', () => this._cancel());
    // A brand image that doesn't exist (custom integration without a brand) falls back to the generic icon.
    for (const img of root.querySelectorAll('img.brand')) {
      img.addEventListener('error', () => img.parentElement?.classList.add('nobrand'), { once: true });
    }
  }

  _cancel() {
    this._confirm = null;
    this._render();
  }

  _toggle(id, set = this._sel) {
    if (!this._admin || !id) return;
    if (set.has(id)) set.delete(id);
    else set.add(id);
    this._render();
  }

  // Selects every entity matching the filters (not only the rows shown), or clears them when all are selected.
  _toggleAll() {
    if (!this._admin) return;
    const items = this._hass.states[this._ids.orphans]?.attributes?.entities || [];
    const shown = oeFilter(items, { q: this._q, platform: this._platform, reason: this._reason }).map((i) => i.entity_id);
    const all = shown.length && shown.every((id) => this._sel.has(id));
    for (const id of shown) {
      if (all) this._sel.delete(id);
      else this._sel.add(id);
    }
    this._render();
  }

  _status(items, scanned) {
    if (!this._ids.orphans || !this._hass.states[this._ids.orphans]?.attributes?.entities) return this._t('not_loaded');
    // The mini card's header is narrow, and its chip says when the first scan is due.
    if (!scanned) return this instanceof OrphanEntitiesMiniCard ? this._t('waiting') : this._waiting();
    return items.length ? this._count('orphans', items.length) : this._t('none');
  }

  // The status pill: its text, or only its coloured dot when the header is narrow (the text stays in the tooltip
  // and for screen readers).
  _pill(text) {
    const t = oeEsc(text);
    return `<div class="pill" title="${t}"><span class="dot"></span><span class="ptxt">${t}</span></div>`;
  }

  // Added at the end of the header by the mini card (its detail button).
  _headExtra() {
    return '';
  }

  _scanButton() {
    if (!this._config.scan_button || !this._ids.button) return '';
    const label = oeEsc(this._t('scan_now'));
    return `<button class="scan" data-focus="scan" title="${label}" aria-label="${label}"${this._busy ? ' disabled' : ''}><ha-icon icon="mdi:refresh"></ha-icon></button>`;
  }

  _toast(message) {
    this.dispatchEvent(new CustomEvent('hass-notification', { detail: { message }, bubbles: true, composed: true }));
  }

  _fail(err) {
    this._toast(this._t('action_failed', { error: err?.message || err?.code || String(err) }));
  }

  // A failure (connection lost, button removed) is shown as a Home Assistant toast.
  async _scan() {
    if (!this._ids.button) return;
    try {
      await this._hass.callService('button', 'press', { entity_id: this._ids.button });
    } catch (err) {
      this._fail(err);
    }
  }

  // Calls an admin action of the integration and returns its response; null before Home Assistant 2025.1, whose admin
  // actions return none (the action is then called again without asking for one).
  async _call(service, data) {
    try {
      const res = await this._hass.callService(OE_DOMAIN, `orphans_${service}`, data, undefined, false, true);
      return res?.response ?? null;
    } catch (err) {
      if (err?.translation_key !== 'service_does_not_support_response' && !/response/i.test(String(err?.message || ''))) throw err;
      await this._hass.callService(OE_DOMAIN, `orphans_${service}`, data);
      return null;
    }
  }

  // "3 entities removed", then how many were kept because they are no longer orphaned since the scan.
  _removedToast(done, response) {
    const kept = Array.isArray(response?.skipped) ? response.skipped.length : 0;
    this._toast(kept ? `${done} · ${this._t('kept', { n: kept })}` : done);
  }

  // The confirmed action on the selection: remove or ignore (admin actions of the integration).
  async _run() {
    const act = this._confirm;
    if (act === 'remove_devices' || act === 'ignore_devices') return this._runDevices(act);
    const entities = [...this._sel];
    if (!entities.length || !act || this._busy) return;
    this._busy = true;
    this._confirm = null;
    this._render();
    try {
      if (act === 'remove') {
        // What was actually removed: an entity provided again since the scan is kept (`skipped`).
        const res = await this._call('remove', { entities });
        const n = Array.isArray(res?.removed) ? res.removed.length : entities.length;
        this._removedToast(this._count('removed', n), res);
      } else {
        await this._hass.callService(OE_DOMAIN, `orphans_${act}`, { entities });
        this._toast(this._count('ignored', entities.length));
      }
      for (const id of entities) this._sel.delete(id);
    } catch (err) {
      this._fail(err);
    } finally {
      this._busy = false;
      this._render();
    }
  }

  // The selected devices, or every listed one when none is selected (Remove devices only).
  _deviceTargets() {
    const listed = this._hass.states[this._ids.orphans]?.attributes?.devices || [];
    return this._dsel.size ? listed.filter((d) => this._dsel.has(d.device_id)) : listed;
  }

  async _runDevices(act) {
    const devices = this._deviceTargets().map((d) => d.device_id);
    if (!devices.length || this._busy || (act === 'ignore_devices' && !this._dsel.size)) return;
    this._busy = true;
    this._confirm = null;
    this._render();
    try {
      if (act === 'remove_devices') {
        // Without a selection, every orphan device goes, also those the sensor leaves out (`devices_truncated`).
        const res = await this._call('remove_devices', this._dsel.size ? { devices } : {});
        const n = Array.isArray(res?.removed) ? res.removed.length : devices.length;
        this._removedToast(this._t('devices_removed', { n }), res);
      } else {
        await this._hass.callService(OE_DOMAIN, 'orphans_ignore', { devices });
        this._toast(this._t('devices_ignored', { n: devices.length }));
      }
      for (const id of devices) this._dsel.delete(id);
    } catch (err) {
      this._fail(err);
    } finally {
      this._busy = false;
      this._render();
    }
  }

  _stats(orphans, removed, ignored, a) {
    const names = [...(a.ignored_integrations || []), ...(a.ignored_entities || [])].join(', ');
    const tile = (cls, value, key, title = '') =>
      `<div class="stat ${cls}"${title ? ` title="${oeEsc(title)}"` : ''}><span class="val">${oeEsc(value)}</span><span class="lbl">${oeEsc(this._t(key))}</span></div>`;
    return `<div class="stats">
          ${tile(orphans ? 'warn' : '', orphans, 'stat_orphans')}
          ${tile('', removed, 'stat_removed', this._t('stat_removed_hint'))}
          ${tile('', ignored, 'stat_ignored', names)}
        </div>`;
  }

  _filters(items) {
    const counts = {};
    for (const i of items) counts[i.reason] = (counts[i.reason] || 0) + 1;
    const platforms = {};
    for (const i of items) platforms[i.platform] = (platforms[i.platform] || 0) + 1;
    const chip = (reason, label, n) =>
      `<button class="chip${this._reason === reason ? ' on' : ''}${reason ? ` ${oeKind(reason)}` : ''}" data-reason="${reason}" data-focus="r:${reason}" aria-pressed="${this._reason === reason}">${oeEsc(label)}<span class="n">${n}</span></button>`;
    const search = oeEsc(this._t('search'));
    return `<div class="filters">
          <div class="frow">
            <label class="field"><ha-icon icon="mdi:magnify"></ha-icon><input class="q" type="search" data-focus="q" placeholder="${search}" aria-label="${search}" value="${oeEsc(this._q)}"></label>
            <select class="platform" data-focus="p" aria-label="${oeEsc(this._t('all_integrations'))}">
              <option value="">${oeEsc(this._t('all_integrations'))}</option>
              ${Object.keys(platforms)
                .sort()
                .map((p) => `<option value="${oeEsc(p)}"${p === this._platform ? ' selected' : ''}>${oeEsc(p)} (${platforms[p]})</option>`)
                .join('')}
            </select>
          </div>
          <div class="chips">
            ${chip('', this._t('all'), items.length)}
            ${OE_REASONS.filter((r) => counts[r])
              .map((r) => chip(r, this._t(`reason_${r}`), counts[r]))
              .join('')}
          </div>
        </div>`;
  }

  _list(items, shown, visible) {
    if (!items.length) return `<div class="section"><div class="empty ok">${oeEsc(this._t('empty'))}</div></div>`;
    const admin = this._admin;
    const all = shown.length > 0 && shown.every((i) => this._sel.has(i.entity_id));
    const some = !all && shown.some((i) => this._sel.has(i.entity_id));
    const head = admin
      ? `<button class="all" data-focus="all" role="checkbox" aria-checked="${all ? 'true' : some ? 'mixed' : 'false'}"${shown.length ? '' : ' disabled'}>
            <span class="box${all ? ' on' : some ? ' some' : ''}"><ha-icon icon="${all ? 'mdi:check' : some ? 'mdi:minus' : ''}"></ha-icon></span>
            <span>${oeEsc(this._t('select_all', { n: shown.length }))}</span>
          </button>`
      : `<div class="stitle">${oeEsc(this._t('list_title'))}</div>`;
    const rows = visible.length ? visible.map((i) => this._row(i)).join('') : `<div class="empty">${oeEsc(this._t('no_match'))}</div>`;
    const more =
      visible.length < shown.length
        ? `<button class="more" data-focus="more">${oeEsc(this._t('show_all', { n: shown.length }))}</button>`
        : '';
    return `<div class="section">
          <div class="lhead">${head}${admin && this._sel.size ? this._actions() : ''}</div>
          <div class="list">${rows}</div>
          ${more}
        </div>`;
  }

  // Devices whose integration entries were all removed: listed under the entities. Administrators select some to
  // remove or ignore them, or remove them all.
  _devices(devices, truncated = 0) {
    const list = Array.isArray(devices) ? devices : [];
    if (!list.length) return '';
    const rows = list
      .map((d) => {
        const sub = [[d.manufacturer, d.model].filter(Boolean).join(' '), d.entities ? this._t('dev_entities', { n: d.entities }) : '']
          .filter(Boolean)
          .join(' · ');
        const body = `<span class="ic nobrand"><ha-icon icon="mdi:devices"></ha-icon></span>
            <span class="txt"><span class="name">${oeEsc(d.name)}</span>${sub ? `<span class="sub">${oeEsc(sub)}</span>` : ''}</span>`;
        const on = this._dsel.has(d.device_id);
        const row = !this._admin
          ? `<div class="row alert" title="${oeEsc(d.name)}">${body}</div>`
          : `<button class="row alert${on ? ' sel' : ''}" role="checkbox" aria-checked="${on}" data-dev="${oeEsc(d.device_id)}" data-focus="v:${oeEsc(d.device_id)}" title="${oeEsc(d.name)}">
            <span class="box${on ? ' on' : ''}"><ha-icon icon="${on ? 'mdi:check' : ''}"></ha-icon></span>${body}
          </button>`;
        // Automations and scripts with device triggers, conditions or actions on it.
        const uses = oeUses(d);
        return uses.length ? this._used(d.device_id, row, uses) : row;
      })
      .join('');
    const btn = (act, icon, cls, key = act) => {
      const label = oeEsc(this._t(key));
      return `<button class="act ${cls}" data-act="${act}" data-focus="a:${act}" title="${label}" aria-label="${label}"${this._busy ? ' disabled' : ''}><ha-icon icon="${icon}"></ha-icon><span>${cls === 'icon' ? '' : label}</span></button>`;
    };
    let actions = '';
    if (this._admin && this._dsel.size) {
      actions = `<div class="bar">${btn('ignore_devices', 'mdi:eye-off-outline', 'neutral', 'ignore')}${btn('remove_devices', 'mdi:delete-outline', 'danger')}${btn('clear_devices', 'mdi:close', 'icon', 'clear')}</div>`;
    } else if (this._admin) {
      actions = btn('remove_devices', 'mdi:delete-outline', 'danger');
    }
    const count = this._dsel.size ? `${this._dsel.size}/${list.length}` : list.length;
    return `<div class="section devs">
          <div class="lhead"><div class="stitle" title="${oeEsc(this._t('devices_hint'))}">${oeEsc(this._t('devices_title'))} · ${count}</div>${actions}</div>
          <div class="list">${rows}</div>
          ${truncated > 0 ? `<div class="empty trunc">${oeEsc(this._t('devices_truncated', { n: truncated }))}</div>` : ''}
        </div>`;
  }

  _row(i) {
    const kind = oeKind(i.reason);
    const label = this._t(`reason_${i.reason}`);
    const sub = [i.entity_id, i.device || i.entry_title, i.disabled ? this._t('disabled') : ''].filter(Boolean).join(' · ');
    const since = i.since ? this._t('for', { d: this._duration(oeMinutes(i.since)) }) : '';
    const title = [`${i.name} (${i.entity_id})`, i.platform, label, i.since ? this._absolute(i.since) : ''].filter(Boolean).join(' — ');
    const body = `
            ${this._brand(i.platform, OE_REASON_ICONS[i.reason] || 'mdi:ghost-outline')}
            <span class="txt">
              <span class="name">${oeEsc(i.name)}</span>
              <span class="sub">${oeEsc(sub)}</span>
            </span>
            <span class="when">
              <span class="lbl">${oeEsc(label)}</span>
              ${since ? `<span class="ago">${oeEsc(since)}</span>` : ''}
            </span>`;
    const on = this._sel.has(i.entity_id);
    const row = !this._admin
      ? `<div class="row ${kind}" title="${oeEsc(title)}">${body}</div>`
      : `<button class="row ${kind}${on ? ' sel' : ''}" role="checkbox" aria-checked="${on}" data-id="${oeEsc(i.entity_id)}" data-focus="e:${oeEsc(i.entity_id)}" title="${oeEsc(title)}">
            <span class="box${on ? ' on' : ''}"><ha-icon icon="${on ? 'mdi:check' : ''}"></ha-icon></span>${body}
          </button>`;
    const uses = oeUses(i);
    return uses.length ? this._used(i.entity_id, row, uses) : row;
  }

  // A row still used by something: its "Used by N" badge (the list in its tooltip) opens the list under the row,
  // each with a link to its editor page or dashboard when it has one.
  _used(id, row, uses) {
    const open = this._open.has(id);
    const kind = (r) => this._t(`ref_${r.type}`);
    const tip = uses.map((r) => `${kind(r)}: ${r.name}`).join('\n');
    const label = this._t('used_by', { n: uses.length });
    const refs = uses
      .map((r) => {
        const name = oeEsc(r.name);
        const path = typeof r.path === 'string' && r.path.startsWith('/') ? r.path : '';
        const link = path ? `<a href="${oeEsc(path)}" data-nav="${oeEsc(path)}">${name}</a>` : `<span class="rn">${name}</span>`;
        return `<li><ha-icon icon="${OE_REF_ICONS[r.type] || 'mdi:link-variant'}"></ha-icon><span class="rk">${oeEsc(kind(r))}</span>${link}</li>`;
      })
      .join('');
    return `<div class="item"><div class="rowwrap">${row}<button class="used" data-used="${oeEsc(id)}" data-focus="u:${oeEsc(id)}" aria-expanded="${open}" title="${oeEsc(tip)}"><ha-icon icon="mdi:link-variant"></ha-icon><span>${oeEsc(label)}</span></button></div>${open ? `<ul class="refs">${refs}</ul>` : ''}</div>`;
  }

  // Above the list while entities are selected: their count, then Ignore, Remove and clear.
  _actions() {
    const btn = (act, icon, cls) => {
      const label = oeEsc(this._t(act));
      return `<button class="act ${cls}" data-act="${act}" data-focus="a:${act}" title="${label}" aria-label="${label}"${this._busy ? ' disabled' : ''}><ha-icon icon="${icon}"></ha-icon><span>${act === 'clear' ? '' : label}</span></button>`;
    };
    return `<div class="bar">
          <span class="count">${oeEsc(this._count('selected', this._sel.size))}</span>
          ${btn('ignore', 'mdi:eye-off-outline', 'neutral')}
          ${btn('remove', 'mdi:delete-outline', 'danger')}
          ${btn('clear', 'mdi:close', 'icon')}
        </div>`;
  }

  // The confirmation, at the top of the card over a scrim: the action, its consequences and the first entities.
  _dialog() {
    const act = this._confirm;
    if (act === 'remove_devices' || act === 'ignore_devices') return this._devicesDialog(act);
    const ids = [...this._sel];
    const items = this._hass.states[this._ids.orphans]?.attributes?.entities || [];
    const byId = new Map(items.map((i) => [i.entity_id, i]));
    const remove = act === 'remove';
    // The selected entities still in use come first: they are the ones to look at before removing.
    const uses = (id) => oeUses(byId.get(id)).length;
    if (remove) ids.sort((a, b) => (uses(b) > 0) - (uses(a) > 0));
    const used = remove ? ids.filter((id) => uses(id)).length : 0;
    const first = ids.slice(0, 5).map((id) => {
      const n = remove ? uses(id) : 0;
      const badge = n ? ` <span class="ub">${oeEsc(this._t('used_by', { n }))}</span>` : '';
      return `<li><span class="name">${oeEsc(byId.get(id)?.name || id)}</span> <span class="sub">${oeEsc(id)}</span>${badge}</li>`;
    });
    if (ids.length > 5) first.push(`<li class="sub">${oeEsc(this._t('and_more', { n: ids.length - 5 }))}</li>`);
    const warn = used ? `<div class="dw"><ha-icon icon="mdi:alert-outline"></ha-icon><span>${oeEsc(this._count('confirm_used', used))}</span></div>` : '';
    return `<div class="scrim"></div>
        <div class="dlg ${remove ? 'danger' : 'neutral'}" role="alertdialog" aria-modal="true" aria-labelledby="dlg-t">
          <div class="dt" id="dlg-t">${oeEsc(this._count(remove ? 'confirm_remove' : 'confirm_ignore', ids.length))}</div>
          <div class="dx">${oeEsc(this._t(remove ? 'confirm_remove_text' : 'confirm_ignore_text'))}</div>
          ${warn}
          <ul>${first.join('')}</ul>
          <div class="db">
            <button class="act icon-text" data-dlg="cancel" data-focus="d:cancel">${oeEsc(this._t('cancel'))}</button>
            <button class="act ${remove ? 'danger' : 'neutral'}" data-dlg="ok" data-focus="d:ok"><ha-icon icon="${remove ? 'mdi:delete-outline' : 'mdi:eye-off-outline'}"></ha-icon><span>${oeEsc(this._t(used ? 'remove_anyway' : act))}</span></button>
          </div>
        </div>`;
  }

  _devicesDialog(act) {
    const devices = [...this._deviceTargets()];
    const remove = act === 'remove_devices';
    // Removing them all also removes those the sensor leaves out.
    const total = devices.length + (remove && !this._dsel.size ? Number(this._hass.states[this._ids.orphans]?.attributes?.devices_truncated) || 0 : 0);
    // The devices still used by automations or scripts come first.
    const uses = (d) => (remove ? oeUses(d).length : 0);
    devices.sort((a, b) => (uses(b) > 0) - (uses(a) > 0));
    const used = devices.filter((d) => uses(d)).length;
    const first = devices.slice(0, 5).map((d) => {
      const n = uses(d);
      const badge = n ? ` <span class="ub">${oeEsc(this._t('used_by', { n }))}</span>` : '';
      return `<li><span class="name">${oeEsc(d.name)}</span> <span class="sub">${oeEsc([d.manufacturer, d.model].filter(Boolean).join(' '))}</span>${badge}</li>`;
    });
    if (total > 5) first.push(`<li class="sub">${oeEsc(this._t('and_more', { n: total - 5 }))}</li>`);
    const warn = used ? `<div class="dw"><ha-icon icon="mdi:alert-outline"></ha-icon><span>${oeEsc(this._t('confirm_devices_used', { n: used }))}</span></div>` : '';
    return `<div class="scrim"></div>
        <div class="dlg ${remove ? 'danger' : 'neutral'}" role="alertdialog" aria-modal="true" aria-labelledby="dlg-t">
          <div class="dt" id="dlg-t">${oeEsc(this._t(remove ? 'confirm_devices' : 'confirm_ignore_devices'))}</div>
          <div class="dx">${oeEsc(this._t(remove ? 'confirm_devices_text' : 'confirm_ignore_text'))}</div>
          ${warn}
          <ul>${first.join('')}</ul>
          <div class="db">
            <button class="act icon-text" data-dlg="cancel" data-focus="d:cancel">${oeEsc(this._t('cancel'))}</button>
            <button class="act ${remove ? 'danger' : 'neutral'}" data-dlg="ok" data-focus="d:ok"><ha-icon icon="${remove ? 'mdi:delete-outline' : 'mdi:eye-off-outline'}"></ha-icon><span>${oeEsc(this._t(remove ? (used ? 'remove_anyway' : 'remove_devices') : 'ignore'))}</span></button>
          </div>
        </div>`;
  }

  // The integration's logo from the Home Assistant brands, with the reason's icon behind it when there is none.
  _brand(domain, fallback) {
    const dark = this._hass.themes?.darkMode ? 'dark_' : '';
    const src = `https://brands.home-assistant.io/_/${encodeURIComponent(domain)}/${dark}icon.png`;
    return `<span class="ic"><img class="brand" src="${oeEsc(src)}" alt="" loading="lazy" referrerpolicy="no-referrer"><ha-icon icon="${fallback}"></ha-icon></span>`;
  }

  static get styles() {
    return `
      :host([hidden]) { display: none !important; }
      /* Home Assistant's <ha-icon> is inline: as a box of its own, its icon is centred in its badge */
      ha-icon { display: inline-flex; align-items: center; justify-content: center; vertical-align: middle; line-height: 0; }
      :host {
        display: block;
        min-width: 0;
        --oe-natural-width: 380px;
        --oe-accent: #7e57c2;
        --oe-ok: var(--success-color, #43a047);
        --oe-warn: var(--warning-color, #ffa600);
        --oe-alert: var(--error-color, #db4437);
        --oe-na: var(--disabled-color, #9e9e9e);
        /* Secondary text on the tinted tiles: nudged towards the primary text so it stays readable (WCAG AA) */
        --oe-muted: color-mix(in srgb, var(--secondary-text-color) 70%, var(--primary-text-color));
      }
      /* Width without a minimum: the card contributes no width of its own (inline-size containment), the empty
         zero-height grid gives it a natural width with a min-content width of 0 (see ha-integration-watchdog). */
      :host::before { content: ""; display: grid; grid-template-columns: minmax(0, var(--oe-natural-width)); height: 0; }
      ha-card { position: relative; padding: 12px; overflow: hidden; contain: inline-size; }
      ha-card.lvl-ok   { --c: var(--oe-ok); }
      ha-card.lvl-warn { --c: var(--oe-warn); }
      ha-card.lvl-idle { --c: var(--oe-na); }
      ha-card.lvl-na   { --c: var(--oe-na); }

      /* The header is a size container: the pill keeps only its dot when it is narrow */
      .head { display: flex; align-items: center; gap: 8px; container-type: inline-size; }
      /* The project's icon, in its accent colour whatever the status (the pill tells it) */
      .badge { flex: none; width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center;
               background: color-mix(in srgb, var(--oe-accent) 16%, transparent); color: var(--oe-accent); }
      .badge ha-icon { --mdc-icon-size: 24px; }
      /* The title keeps at least 45 % of the header (a few words), the pill takes at most 60 % and wraps on two
         lines before the title is cut: "En attente de la première analyse" must not leave "Orp…" on a mini card. */
      .heading { flex: 1 1 0; min-width: min(45%, 14ch); display: flex; flex-direction: column; }
      .title { font-size: 16px; font-weight: 500; line-height: 1.25; color: var(--primary-text-color);
               white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .subtitle { font-size: 12px; line-height: 1.3; color: var(--secondary-text-color);
                  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .pill { flex: 0 1 auto; min-width: 0; max-width: 60%; display: flex; align-items: center; box-sizing: border-box;
              white-space: nowrap; overflow: hidden;
              font-size: 11px; font-weight: 500; padding: 1px 6px; border-radius: 9px;
              color: color-mix(in srgb, var(--c) 40%, var(--primary-text-color));
              background: color-mix(in srgb, var(--c) 14%, transparent); }
      .pill .ptxt { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: normal; line-height: 1.25;
                    display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; }
      .pill .dot { flex: none; width: 6px; height: 6px; margin-right: 4px; border-radius: 50%; background: var(--c); }
      /* The status pill: on the title row, 8 px after the title, only when the whole title and the pill's whole label fit
         there; otherwise on its own line under the subtitle, which then keeps one line; its dot alone at 200 px or less
         or when its label does not fit the title block (its text stays in its title and for screen readers). Measured
         after each render (_fitPill), in every language, never by a fixed width. */
      .title-row { display: flex; flex-wrap: nowrap; align-items: center; gap: 8px; min-width: 0; }
      .title-row > .title { flex: 0 1 auto; min-width: 0; }
      .title-row > .pill { flex: none; min-width: auto; max-width: none; overflow: visible; align-self: center; margin-top: 0; }
      .title-row > .pill .ptxt { min-width: auto; overflow: visible; white-space: nowrap; display: inline; -webkit-line-clamp: none; line-clamp: none; }
      .heading.pill-below { display: flex; flex-direction: column; align-items: stretch; }
      .heading.pill-below > * { order: 3; }
      .heading.pill-below > .title-row { display: contents; }
      .heading.pill-below > .subtitle { order: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .heading.pill-below > .title-row > .pill { order: 2; align-self: flex-start; margin-top: 2px; }
      .heading.pill-dot > .title-row > .pill { padding: 4px; gap: 0; }
      .heading.pill-dot > .title-row > .pill .dot { display: block; }
      .heading.pill-dot > .title-row > .pill .ptxt { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
      /* Mini card: the expand / collapse button in the card's top right corner (24 px, round), the scan button on the
         same top line at its left; the header keeps clear of them. */
      ha-card:has(.zoom) { position: relative; }
      .head:has(> .zoom) { padding-right: 21px; }
      .head:has(> .zoom):has(> .scan) { padding-right: 49px; }
      .head > .zoom, .head:has(> .zoom) > .scan { position: absolute; z-index: 2; top: 5px; width: 24px; height: 24px; margin: 0;
                                                 background: color-mix(in srgb, var(--secondary-text-color) 10%, transparent); }
      .head > .zoom { right: 5px; }
      .head:has(> .zoom) > .scan { right: 33px; }
      @container (max-width: 140px) {
        .head .badge { display: none; }
      }
      .scan { all: unset; cursor: pointer; flex: none; width: 26px; height: 26px; border-radius: 50%;
              display: grid; place-items: center; color: var(--secondary-text-color); }
      .scan:hover { background: color-mix(in srgb, var(--secondary-text-color) 14%, transparent); color: var(--primary-text-color); }
      .scan:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
      .scan[disabled] { cursor: default; opacity: .4; background: none; }
      .scan ha-icon { --mdc-icon-size: 16px; }

      .stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; margin-top: 10px; }
      .stat { --t: var(--secondary-text-color); display: flex; flex-direction: column; align-items: center; gap: 1px;
              padding: 6px 4px; border-radius: 10px; min-width: 0;
              background: var(--secondary-background-color, rgba(127,127,127,.08)); }
      .stat.warn { --t: var(--oe-warn); background: color-mix(in srgb, var(--t) 12%, var(--secondary-background-color, transparent)); }
      .stat .val { font-size: 18px; font-weight: 500; line-height: 1.2; font-variant-numeric: tabular-nums; color: var(--primary-text-color); }
      .stat.warn .val { color: color-mix(in srgb, var(--t) 40%, var(--primary-text-color)); }
      .stat .lbl { font-size: 11px; color: var(--oe-muted); max-width: 100%;
                   white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

      .filters { margin-top: 12px; display: flex; flex-direction: column; gap: 6px; }
      .frow { display: flex; flex-wrap: wrap; gap: 6px; }
      .field { flex: 1 1 160px; min-width: 0; display: flex; align-items: center; gap: 4px; box-sizing: border-box;
               height: 32px; padding: 0 8px; border-radius: 10px; color: var(--secondary-text-color);
               background: var(--secondary-background-color, rgba(127,127,127,.08)); }
      .field:focus-within { outline: 2px solid var(--primary-color); outline-offset: -2px; }
      .field ha-icon { flex: none; --mdc-icon-size: 16px; }
      .field input { all: unset; flex: 1; min-width: 0; font-size: 13px; color: var(--primary-text-color); }
      .field input::placeholder { color: var(--oe-muted); opacity: 1; }
      select.platform { flex: 0 1 180px; min-width: 0; height: 32px; box-sizing: border-box; padding: 0 6px;
                        border: 0; border-radius: 10px; font: inherit; font-size: 13px; color: var(--primary-text-color);
                        background: var(--secondary-background-color, rgba(127,127,127,.08)); }
      select.platform:focus-visible { outline: 2px solid var(--primary-color); outline-offset: -2px; }
      .chips { display: flex; flex-wrap: wrap; gap: 4px; }
      .chip { --t: var(--primary-color); all: unset; cursor: pointer; box-sizing: border-box; display: inline-flex;
              align-items: center; gap: 4px; height: 24px; padding: 0 8px; border-radius: 999px; font-size: 12px;
              font-weight: 500; color: var(--oe-muted); white-space: nowrap;
              background: var(--secondary-background-color, rgba(127,127,127,.08)); }
      .chip.warn  { --t: var(--oe-warn); }
      .chip.alert { --t: var(--oe-alert); }
      .chip .n { font-variant-numeric: tabular-nums; opacity: .8; }
      .chip:hover { background: color-mix(in srgb, var(--t) 12%, var(--secondary-background-color, transparent)); }
      .chip.on { color: color-mix(in srgb, var(--t) 40%, var(--primary-text-color));
                 background: color-mix(in srgb, var(--t) 18%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--t) 50%, transparent); }
      .chip:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }

      .section { margin-top: 12px; }
      .lhead { display: flex; align-items: center; margin: 0 2px 6px; }
      .devs .lhead > .act { margin-left: auto; }
      .empty.trunc { margin-top: 6px; }
      .stitle { font-size: 12px; font-weight: 500; color: var(--secondary-text-color);
                text-transform: uppercase; letter-spacing: .04em; }
      .all { all: unset; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; padding: 2px 4px 2px 3px;
             border-radius: 8px; font-size: 12px; font-weight: 500; color: var(--secondary-text-color); }
      .all:hover { color: var(--primary-text-color); }
      .all[disabled] { cursor: default; opacity: .5; }
      .all:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
      .list { display: flex; flex-direction: column; gap: 6px; }
      .empty { font-size: 13px; color: var(--oe-muted); padding: 8px 10px; border-radius: 10px;
               background: var(--secondary-background-color, rgba(127,127,127,.08)); }
      .empty.ok { --t: var(--oe-ok); background: color-mix(in srgb, var(--t) 12%, var(--secondary-background-color, transparent)); }
      .row { --t: var(--oe-warn); all: unset; box-sizing: border-box; min-width: 0;
             display: flex; align-items: center; gap: 8px; padding: 5px 10px 5px 5px; border-radius: 10px;
             background: color-mix(in srgb, var(--t) 10%, var(--secondary-background-color, transparent)); }
      .row.alert { --t: var(--oe-alert); }
      button.row { cursor: pointer; padding-left: 8px; }
      button.row:hover { background: color-mix(in srgb, var(--t) 16%, var(--secondary-background-color, transparent)); }
      button.row.sel { box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--primary-color) 60%, transparent);
                       background: color-mix(in srgb, var(--primary-color) 10%, var(--secondary-background-color, transparent)); }
      .row:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
      /* The checkbox: an outline, ticked in the primary colour */
      .box { flex: none; width: 16px; height: 16px; box-sizing: border-box; border-radius: 4px; display: grid; place-items: center;
             border: 1.5px solid var(--secondary-text-color); color: var(--primary-color); }
      .box.on, .box.some { border-color: var(--primary-color); background: color-mix(in srgb, var(--primary-color) 16%, transparent); }
      .box ha-icon { --mdc-icon-size: 14px; }
      .ic { position: relative; flex: none; width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center;
            color: var(--t); background: color-mix(in srgb, var(--t) 18%, transparent); overflow: hidden; }
      .ic ha-icon { --mdc-icon-size: 16px; }
      .ic img.brand { position: absolute; inset: 5px; width: 18px; height: 18px; object-fit: contain; }
      .ic:not(.nobrand) img.brand + ha-icon { visibility: hidden; }
      .ic.nobrand img.brand { display: none; }
      .txt { flex: 1; display: flex; flex-direction: column; min-width: 0; }
      .name { font-size: 13px; font-weight: 500; line-height: 1.2; color: var(--primary-text-color);
              white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .sub { font-size: 11px; line-height: 1.2; color: var(--oe-muted);
             white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      /* The reason and how long, on the right: they shrink (up to 40% of the row) before the name does */
      .when { flex: 0 1 auto; min-width: 0; max-width: 40%; display: flex; flex-direction: column; align-items: flex-end; }
      .when > span { max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .when .lbl { font-size: 12px; font-weight: 500; line-height: 1.2; color: color-mix(in srgb, var(--t) 40%, var(--primary-text-color)); }
      .when .ago { font-size: 11px; line-height: 1.2; color: var(--oe-muted); }
      /* A row still in use: its "Used by N" badge (orange, tinted) in the row at its right, its list under it when open */
      .item { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; min-width: 0; }
      /* The badge sits in the row, at its right (the row keeps its room), so every row has the list's width */
      .rowwrap { position: relative; flex: 1 1 100%; min-width: 0; display: flex; }
      .rowwrap > .row { flex: 1 1 0; padding-right: 112px; }
      .rowwrap > .used { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); }
      .used { --t: var(--oe-warn); all: unset; cursor: pointer; flex: none; box-sizing: border-box; display: inline-flex;
              align-items: center; gap: 3px; height: 24px; padding: 0 8px; border-radius: 12px; font-size: 11px; font-weight: 500;
              white-space: nowrap; color: color-mix(in srgb, var(--t) 40%, var(--primary-text-color));
              background: color-mix(in srgb, var(--t) 16%, transparent); }
      .used:hover { background: color-mix(in srgb, var(--t) 24%, transparent); }
      .used:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
      .used ha-icon { --mdc-icon-size: 14px; }
      .used[aria-expanded="true"] { box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--t) 50%, transparent); }
      .refs { --t: var(--oe-warn); flex: 1 0 100%; box-sizing: border-box; margin: 0; padding: 6px 10px; list-style: none;
              display: flex; flex-direction: column; gap: 4px; border-radius: 10px; font-size: 12px;
              background: color-mix(in srgb, var(--t) 6%, var(--secondary-background-color, transparent)); }
      .refs li { display: flex; align-items: center; gap: 6px; min-width: 0; }
      .refs ha-icon { flex: none; --mdc-icon-size: 14px; color: var(--secondary-text-color); }
      .refs .rk { flex: none; color: var(--oe-muted); }
      .refs a, .refs .rn { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500; }
      .refs .rn { color: var(--primary-text-color); }
      .refs a { color: color-mix(in srgb, var(--primary-color) 45%, var(--primary-text-color)); text-decoration: underline; text-underline-offset: 2px; }
      .refs a:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 1px; border-radius: 2px; }
      .more { all: unset; cursor: pointer; display: block; box-sizing: border-box; width: 100%; margin-top: 6px; padding: 6px;
              border-radius: 10px; text-align: center; font-size: 12px; font-weight: 500; color: var(--primary-color);
              background: color-mix(in srgb, var(--primary-color) 8%, transparent); }
      .more:hover { background: color-mix(in srgb, var(--primary-color) 14%, transparent); }
      .more:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }

      /* The selection's actions, at the right of "Select all": they wrap under it on a narrow card */
      .lhead { flex-wrap: wrap; gap: 6px; }
      .bar { margin-left: auto; display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 4px; min-width: 0; }
      .bar .count { min-width: 0; padding-right: 2px; font-size: 12px; font-weight: 500; color: var(--primary-text-color);
                    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      /* Buttons are tinted, never filled */
      .act { --t: var(--secondary-text-color); all: unset; cursor: pointer; box-sizing: border-box; display: inline-flex;
             align-items: center; gap: 4px; height: 28px; padding: 0 10px; border-radius: 14px; font-size: 12px; font-weight: 500;
             white-space: nowrap; color: color-mix(in srgb, var(--t) 40%, var(--primary-text-color));
             background: color-mix(in srgb, var(--t) 14%, transparent); }
      .act.danger { --t: var(--oe-alert); }
      .act.neutral { --t: var(--primary-color); }
      .act.icon { width: 28px; padding: 0; justify-content: center; background: none; color: var(--secondary-text-color); }
      .act.icon span:empty { display: none; }
      .act.icon-text { background: none; color: var(--secondary-text-color); }
      .act:hover { background: color-mix(in srgb, var(--t) 22%, transparent); }
      .act[disabled] { cursor: default; opacity: .5; }
      .act:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
      .act ha-icon { --mdc-icon-size: 16px; }

      /* Confirmation at the top of the card, over a scrim covering the card */
      ha-card.dlg-open { min-height: 240px; }
      .scrim { position: absolute; inset: 0; background: rgba(0,0,0,.32); }
      .dlg { --t: var(--oe-alert); position: absolute; top: 8px; left: 8px; right: 8px; box-sizing: border-box; padding: 14px;
             border-radius: 14px; background: var(--card-background-color, var(--ha-card-background, #fff));
             border: 1px solid var(--divider-color, rgba(127,127,127,.2)); box-shadow: 0 4px 18px rgba(0,0,0,.28); }
      .dlg.neutral { --t: var(--primary-color); }
      .dlg .dt { font-size: 15px; font-weight: 500; color: var(--primary-text-color); }
      .dlg .dx { margin-top: 4px; font-size: 12px; line-height: 1.4; color: var(--oe-muted); }
      .dlg ul { margin: 8px 0 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 2px; }
      .dlg li { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 12px; }
      .dlg li .name { display: inline; font-size: 12px; }
      .db { display: flex; justify-content: flex-end; gap: 6px; margin-top: 12px; }
      .dlg .dw { --t: var(--oe-warn); margin-top: 8px; padding: 6px 8px; border-radius: 10px; display: flex; align-items: flex-start; gap: 6px;
                 font-size: 12px; line-height: 1.4; color: color-mix(in srgb, var(--t) 40%, var(--primary-text-color));
                 background: color-mix(in srgb, var(--t) 14%, transparent); }
      .dlg .dw ha-icon { flex: none; --mdc-icon-size: 16px; }
      .dlg .ub { --t: var(--oe-warn); font-size: 11px; font-weight: 500; padding: 0 6px; border-radius: 8px;
                 color: color-mix(in srgb, var(--t) 40%, var(--primary-text-color)); background: color-mix(in srgb, var(--t) 16%, transparent); }
      :host([hide-title]) .heading .title, :host([hide-subtitle]) .heading > .subtitle { display: none; }
    `;
  }
}

// "A click elsewhere" is caught on the pointer, not only on the click event: on iOS (Safari and the companion app)
// a tap on something that is not clickable (the background, an empty spot, a card with no action) sends no click to
// the page. It counts when the press and the release are both outside (`isOut`; a slider dragged out of the card
// does not fold it), and a scroll does not count (the browser cancels the pointer). Keyboard clicks still go through
// the click event.
export const oeWatchOutside = (isOut, handler) => {
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
export const oeHoldUnderPress = (card, render) => {
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

// Whether the focus goes back to `el` after a rewrite (see oeHoldUnderPress).
export const oeKeepsFocus = (card, el) => !card._byPointer || typeof el?.selectionStart === 'number';
