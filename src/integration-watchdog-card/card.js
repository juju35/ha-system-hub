import { IW_DEFAULTS, IW_MAX_HISTORY, IW_PILL, iwDevices, iwEsc, iwHistoryKind, iwHistoryLabel, iwLang, iwLatestPerIntegration, iwLocale, iwMinutes, iwPick, iwT } from "./i18n-helpers.js";
import { shBanner, shbIsNight } from "./illustrated-header.js";
import { iwHoldUnderPress, iwKeepsFocus } from "./mini-card.js";
import { IW_I18N } from "./i18n/iw-i18n.js";

export class IntegrationWatchdogCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement('sh-watchdog-card-editor');
  }

  static getStubConfig() {
    return {};
  }

  setConfig(config) {
    this.connectedWhileHidden = true;
    this._config = { ...IW_DEFAULTS, ...config };
    // show_title / show_subtitle: the header's title / subtitle, hidden by the stylesheet
    this.toggleAttribute?.('hide-title', config.show_title === false);
    this.toggleAttribute?.('hide-subtitle', config.show_subtitle === false);
    if (!this.shadowRoot) {
      this.attachShadow({ mode: 'open' });
      iwHoldUnderPress(this, () => this._render());
    }
    this._sig = null;
    this._render();
  }

  // The status pill goes on the title row, right after the title, only when the whole title and the pill's whole
  // label fit there; otherwise it takes its own line under the subtitle (the subtitle then on one line). Its dot
  // alone on a card 200 px wide or less, or when its label is wider than the title block (or, in a banner, would not
  // fit above the ground strip). Measured after each render and on every new width (or once the web font is loaded),
  // never by a fixed width; $IW_PILL names the parts.
  _fitPill() {
    const S = IW_PILL;
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

  set hass(hass) {
    this._watchPill();
    const old = this._hass;
    this._hass = hass;
    // Nothing the card shows changed: the same state objects, registry, language and minute ("3 min ago").
    const ids = this._ids;
    if (
      old &&
      this._sig &&
      ids &&
      // No sensor found yet (watchdog not loaded): its return must be seen at once, not at the next minute.
      ids.unavailable &&
      hass.entities === old.entities &&
      hass.user === old.user &&
      Object.values(ids).every((id) => !id || hass.states[id] === old.states[id]) &&
      iwLang(hass, this._config) === iwLang(old, this._config) &&
      Math.floor(Date.now() / 60000) === this._sigMinute
    ) {
      return;
    }
    this._render();
  }

  // Set by Lovelace while the dashboard is edited (editMode) and in the card editor's preview (preview): a card
  // hidden by hide_when_ok shows again there, so that it can still be edited.
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
    return 2 + (this._rows || 0);
  }

  getGridOptions() {
    return { columns: 12, min_columns: 8, rows: 'auto' };
  }

  _t(key, vars) {
    return iwT(iwLang(this._hass, this._config), key, vars);
  }

  // "{n} unavailable" with the plural form of the card's language: `key_one`, `key_few` (2-4 in Serbian and Polish,
  // when the language has it) or `key_many`.
  _count(key, n) {
    let cat = n === 1 ? 'one' : 'other';
    try {
      cat = new Intl.PluralRules(iwLocale(this._hass, this._config)).select(n);
    } catch {
      // Unknown locale: the simple rule above.
    }
    const form = cat === 'one' ? 'one' : cat === 'few' && IW_I18N[iwLang(this._hass, this._config)]?.[`${key}_few`] ? 'few' : 'many';
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
    const m = iwMinutes(iso);
    let rtf;
    try {
      rtf = new Intl.RelativeTimeFormat(iwLocale(this._hass, this._config), { numeric: 'auto' });
    } catch {
      return this._duration(m);
    }
    if (m < 1) return rtf.format(0, 'second');
    if (m < 60) return rtf.format(-Math.floor(m), 'minute');
    if (m < 1440) return rtf.format(-Math.floor(m / 60), 'hour');
    return rtf.format(-Math.floor(m / 1440), 'day');
  }

  _absolute(iso) {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return '';
    try {
      return d.toLocaleString(iwLocale(this._hass, this._config), { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
      return d.toISOString();
    }
  }

  // The entities of the device of the chosen (or found) sensor. Cached per registry object, never when empty.
  _lookup() {
    const registry = this._hass.entities;
    if (!this._reg || this._reg.registry !== registry) {
      const devices = iwDevices(registry);
      this._reg = Object.keys(devices).length ? { registry, devices } : null;
    }
    const devices = this._reg?.devices || {};
    // An entity set in the card but gone (Integration Watchdog's own sensor, removed with it): found automatically.
    let entity = this._config.entity && this._hass.states?.[this._config.entity] ? this._config.entity : null;
    if (!entity) entity = iwPick(this._hass, Object.values(devices).map((d) => d.unavailable).filter(Boolean));
    if (!entity) return {};
    const device = Object.values(devices).find((d) => d.unavailable === entity) || {};
    return { ...device, unavailable: entity };
  }

  _render() {
    // Held under a press (see iwHoldUnderPress), drawn after its click.
    if (this._pressing) {
      this._dirty = true;
      return;
    }
    this._dirty = false;
    const m = this._prepare();
    if (!m) return;
    // innerHTML replaces every element: the one that had the keyboard focus gets it back after the render.
    const active = this.shadowRoot.activeElement;
    const focusKey = iwKeepsFocus(this, active) && active?.dataset?.focus;
    this._draw(m);
    this._bind();
    if (focusKey) [...this.shadowRoot.querySelectorAll('[data-focus]')].find((el) => el.dataset.focus === focusKey)?.focus({ preventScroll: true });
  }

  // What the card shows, read from the sensors; null when nothing changed since the last render, or the card is hidden.
  _prepare() {
    if (!this._config || !this._hass || !this.shadowRoot) return null;
    const c = this._config;
    const ids = this._lookup();
    this._ids = ids;
    const states = this._hass.states;
    // Without its list (unavailable or restored while the watchdog is not loaded), the sensor says nothing: not set up.
    const sensorSt = ids.unavailable && states[ids.unavailable];
    const st = Array.isArray(sensorSt?.attributes?.integrations) ? sensorSt : null;
    const reloadSt = ids.last_reload && states[ids.last_reload];
    const checkSt = ids.last_check && states[ids.last_check];
    const buttonSt = ids.button && states[ids.button];

    const minute = Math.floor(Date.now() / 60000);
    this._sigMinute = minute;
    // Only administrators can open Settings: the rows are links for them only.
    this._admin = this._hass.user?.is_admin === true;
    // `_zoomed`: the mini card's view (compact or full), undefined on the full card.
    const sig = JSON.stringify([c, shbIsNight(this._hass, c), iwLang(this._hass, c), ids, sensorSt, reloadSt, checkSt, buttonSt?.state, minute, this._admin, this._zoomed]);
    if (sig === this._sig) return null;
    this._sig = sig;

    const items = Array.isArray(st?.attributes?.integrations) ? st.attributes.integrations : [];
    const ignored = Array.isArray(st?.attributes?.ignored) ? st.attributes.ignored : [];
    const max = Number(st?.attributes?.max_reloads) || null;
    const history = Array.isArray(reloadSt?.attributes?.history) ? reloadSt.attributes.history : [];
    const reloads = Number(reloadSt?.attributes?.reloads) || 0;
    const givenUp = items.filter((i) => i.gave_up);
    // The button is unavailable while a check runs.
    const checking = buttonSt?.state === 'unavailable';
    const level = !st ? 'na' : givenUp.length ? 'alert' : items.length ? 'warn' : 'ok';

    const hidden = c.hide_when_ok && st && !items.length && !this._editMode && !this._preview;
    this._setHidden(hidden);
    if (hidden) return null;

    const count = Math.min(IW_MAX_HISTORY, Math.max(1, Number(c.history_count) || IW_DEFAULTS.history_count));
    const shownHistory = c.show_history ? iwLatestPerIntegration(history).slice(0, count) : [];
    this._rows = (c.show_unavailable ? items.length : 0) + shownHistory.length + (c.show_stats && st ? 1 : 0);

    const checkedAt = checkSt && !['unknown', 'unavailable'].includes(checkSt.state) ? checkSt.state : null;
    const icon = { ok: 'mdi:shield-check-outline', warn: 'mdi:shield-alert-outline', alert: 'mdi:shield-off-outline', na: 'mdi:shield-outline' }[level];
    return { st, items, ignored, max, history, reloads, givenUp, checking, level, shownHistory, checkedAt, icon };
  }

  _draw({ st, items, ignored, max, reloads, givenUp, checking, level, shownHistory, checkedAt, icon }) {
    const c = this._config;
    const subtitle = !st ? '' : checkedAt ? this._t('checked', { d: this._ago(checkedAt) }) : this._t('never_checked');
    this.shadowRoot.innerHTML = shBanner(`
      <style>${this.constructor.styles}</style>
      <ha-card class="lvl-${level}">
        <div class="head">
          <div class="badge"><ha-icon icon="${icon}"></ha-icon></div>
          <div class="heading">
            <div class="title-row"><div class="title">${iwEsc(c.title || this._t('title'))}</div>${this._pill(this._status(st, items, givenUp, checking))}</div>
            ${subtitle ? `<div class="subtitle" title="${iwEsc(checkedAt ? this._absolute(checkedAt) : '')}">${iwEsc(subtitle)}</div>` : ''}
          </div>
          ${this._checkButton(checking)}
          ${this._headExtra()}
        </div>
        ${c.show_stats && st ? this._stats(items.length, reloads, ignored) : ''}
        ${c.show_unavailable && items.length ? this._section('unavailable_title', items.map((i) => this._unavailableRow(i, max)).join('')) : ''}
        ${
          c.show_history && st
            ? this._section(
                'history_title',
                shownHistory.length ? shownHistory.map((h) => this._historyRow(h)).join('') : `<div class="empty">${iwEsc(this._t('no_history'))}</div>`,
              )
            : ''
        }
      </ha-card>`, { hass: this._hass, config: this._config, scene: 'watchdog', pad: '12px' });
  }

  _bind() {
    this.shadowRoot.querySelector('.check')?.addEventListener('click', () => this._check());
    for (const el of this.shadowRoot.querySelectorAll('.row[data-domain]')) {
      el.addEventListener('click', () => this._openIntegration(el.dataset.domain, el.dataset.entry));
    }
    for (const el of this.shadowRoot.querySelectorAll('.retry[data-entry]')) {
      el.addEventListener('click', () => this._retry(el.dataset.entry));
    }
    // A brand image that doesn't exist (custom integration without a brand) falls back to the generic icon.
    for (const img of this.shadowRoot.querySelectorAll('img.brand')) {
      img.addEventListener('error', () => img.parentElement?.classList.add('nobrand'), { once: true });
    }
  }

  _status(st, items, givenUp, checking) {
    if (!st) return this._t('not_loaded');
    if (checking) return this._t('checking');
    const parts = [];
    const available = items.length - givenUp.length;
    if (available) parts.push(this._count('unavailable', available));
    if (givenUp.length) parts.push(this._count('gave_up', givenUp.length));
    return parts.length ? parts.join(' · ') : this._t('all_ok');
  }

  // The status pill: its text, or only its coloured dot when the header is narrow (the text stays in the tooltip
  // and for screen readers).
  _pill(text) {
    const t = iwEsc(text);
    return `<div class="pill" title="${t}"><span class="dot"></span><span class="ptxt">${t}</span></div>`;
  }

  // A row: a button opening the integration's page (on its entry) for an administrator, plain text for the other users.
  _row(cls, domain, focus, title, body, entry) {
    const t = iwEsc(title);
    const target = entry ? ` data-entry="${iwEsc(entry)}"` : '';
    return this._admin
      ? `<button class="${cls}" data-domain="${iwEsc(domain)}"${target} data-focus="${iwEsc(focus)}" title="${t}">${body}</button>`
      : `<div class="${cls}" title="${t}">${body}</div>`;
  }

  // Added at the end of the header by the mini card (its detail button).
  _headExtra() {
    return '';
  }

  _checkButton(checking) {
    if (!this._config.check_button || !this._ids.button) return '';
    const label = iwEsc(this._t('check_now'));
    return `<button class="check" data-focus="check" title="${label}" aria-label="${label}"${checking ? ' disabled' : ''}><ha-icon icon="mdi:refresh"></ha-icon></button>`;
  }

  // "Try again" on an integration given up: the reset action forgets its reloads and reloads it. A failure is a toast.
  async _retry(entryId) {
    try {
      await this._hass.callService('system_hub', 'watchdog_reset', { entry_id: entryId });
    } catch (err) {
      const message = this._t('retry_failed', { error: err?.message || err?.code || String(err) });
      this.dispatchEvent(new CustomEvent('hass-notification', { detail: { message }, bubbles: true, composed: true }));
    }
  }

  // A failure (connection lost, button removed) is shown as a Home Assistant toast.
  async _check() {
    if (!this._ids.button) return;
    try {
      await this._hass.callService('button', 'press', { entity_id: this._ids.button });
    } catch (err) {
      const message = this._t('check_failed', { error: err?.message || err?.code || String(err) });
      this.dispatchEvent(new CustomEvent('hass-notification', { detail: { message }, bubbles: true, composed: true }));
    }
  }

  _stats(unavailable, reloads, ignored) {
    const tile = (cls, value, key, title = '') =>
      `<div class="stat ${cls}"${title ? ` title="${iwEsc(title)}"` : ''}><span class="val">${iwEsc(value)}</span><span class="lbl">${iwEsc(this._t(key))}</span></div>`;
    return `<div class="stats">
          ${tile(unavailable ? 'warn' : '', unavailable, 'stat_unavailable')}
          ${tile('', reloads, 'stat_reloads', this._t('stat_reloads_hint'))}
          ${tile('', ignored.length, 'stat_ignored', ignored.join(', '))}
        </div>`;
  }

  _section(key, body) {
    return `<div class="section"><div class="stitle">${iwEsc(this._t(key))}</div><div class="list">${body}</div></div>`;
  }

  // The integration's logo from the Home Assistant brands, with the generic icon behind it when there is none.
  _brand(domain, fallback) {
    const dark = this._hass.themes?.darkMode ? 'dark_' : '';
    const src = `https://brands.home-assistant.io/_/${encodeURIComponent(domain)}/${dark}icon.png`;
    return `<span class="ic"><img class="brand" src="${iwEsc(src)}" alt="" loading="lazy" referrerpolicy="no-referrer"><ha-icon icon="${fallback}"></ha-icon></span>`;
  }

  _unavailableRow(i, max) {
    const kind = i.gave_up ? 'alert' : 'warn';
    const sub = [i.domain, i.since ? this._t('since', { d: this._duration(iwMinutes(i.since)) }) : ''].filter(Boolean).join(' · ');
    const value = i.gave_up ? this._t('gave_up') : i.reloads && max ? this._t('attempts', { n: i.reloads, max }) : this._t('waiting');
    const row = this._row(
      `row ${kind}`,
      i.domain,
      `u:${i.entry_id || i.domain}`,
      `${i.title} (${i.domain})`,
      `
            ${this._brand(i.domain, 'mdi:puzzle-remove-outline')}
            <span class="txt">
              <span class="name">${iwEsc(i.title)}</span>
              <span class="sub">${iwEsc(sub)}</span>
            </span>
            <span class="tag">${iwEsc(value)}</span>`,
      i.entry_id,
    );
    // Given up: an administrator gets "Try again" (the reset action) next to the row.
    if (!i.gave_up || !this._admin || !i.entry_id) return row;
    const label = iwEsc(`${this._t('retry')} — ${i.title}`);
    return `<div class="line">${row}<button class="retry" data-entry="${iwEsc(i.entry_id)}" data-focus="r:${iwEsc(i.entry_id)}" title="${label}" aria-label="${label}"><ha-icon icon="mdi:restart"></ha-icon></button></div>`;
  }

  _historyRow(h) {
    const kind = iwHistoryKind(h.kind);
    const icon = { ok: 'mdi:check-circle', warn: 'mdi:alert-circle', alert: 'mdi:cancel' }[kind];
    const label = this._t(iwHistoryLabel(h.kind));
    // A power cycle: the plug used, instead of the integration's domain.
    const cycle = h.kind.startsWith('power_cycle');
    const detail = h.kind.endsWith('gave_up')
      ? this._t(cycle ? 'cycle_gave_up_after' : 'gave_up_after', { n: h.attempt })
      : h.max_reloads
        ? this._t(cycle ? 'cycle_attempt' : 'attempt', { n: h.attempt, max: h.max_reloads })
        : '';
    const sub = [cycle ? h.switch_name || h.switch : h.domain, detail].filter(Boolean).join(' · ');
    return this._row(
      `row hist ${kind}`,
      h.domain,
      `h:${h.at}:${h.entry_id || h.domain}`,
      `${label} — ${this._absolute(h.at)}`,
      `
            <span class="ic ev"><ha-icon icon="${icon}"></ha-icon></span>
            <span class="txt">
              <span class="name">${iwEsc(h.title)}</span>
              <span class="sub">${iwEsc(sub)}</span>
            </span>
            <span class="when">
              <span class="lbl">${iwEsc(label)}</span>
              <span class="ago">${iwEsc(this._ago(h.at))}</span>
            </span>`,
      h.entry_id,
    );
  }

  // The integration's page in Settings, where its entries can be reloaded or their logs read; scrolled to the entry.
  _openIntegration(domain, entry) {
    if (!domain) return;
    const hash = entry ? `#config_entry=${encodeURIComponent(entry)}` : '';
    window.history.pushState(null, '', `/config/integrations/integration/${encodeURIComponent(domain)}${hash}`);
    window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: false } }));
  }

  static get styles() {
    return `
      :host([hidden]) { display: none !important; }
      /* Home Assistant's <ha-icon> is inline: as a box of its own, its icon is centred in its badge */
      ha-icon { display: inline-flex; align-items: center; justify-content: center; vertical-align: middle; line-height: 0; }
      :host {
        display: block;
        min-width: 0;
        --iw-natural-width: 360px;
        --iw-ok: var(--success-color, #43a047);
        --iw-warn: var(--warning-color, #ffa600);
        --iw-alert: var(--error-color, #db4437);
        --iw-na: var(--disabled-color, #9e9e9e);
        /* Secondary text on the tinted tiles: nudged towards the primary text so it stays readable (WCAG AA) */
        --iw-muted: color-mix(in srgb, var(--secondary-text-color) 70%, var(--primary-text-color));
      }
      /* Width without a minimum. The card contributes no width of its own (inline-size containment): its stats,
         rows and pill would otherwise set a min-content width of 210-354 px, a floor that a 1fr grid column or a
         flex row cannot go below once the card is wrapped in a div (min-width: 0 on the host does not reach the
         wrapper), so the card would run out of its column. The empty, zero-height grid below gives it a natural
         (max-content) width with a min-content width of 0: in a parent sized by its content (layout-card,
         button-card, an inline-block, a grid "auto" column) the card gets that width instead of falling to its
         padding, and in a 1fr 1fr grid or a flex row, wrapped or not, it shrinks to its track. No
         contain-intrinsic-* and no min-width in px: both would be a minimum. */
      :host::before { content: ""; display: grid; grid-template-columns: minmax(0, var(--iw-natural-width)); height: 0; }
      ha-card { padding: 12px; overflow: hidden; contain: inline-size; }
      ha-card.lvl-ok    { --c: var(--iw-ok); }
      ha-card.lvl-warn  { --c: var(--iw-warn); }
      ha-card.lvl-alert { --c: var(--iw-alert); }
      ha-card.lvl-na    { --c: var(--iw-na); }

      /* The header is a size container: the pill keeps only its dot when it is narrow */
      .head { display: flex; align-items: center; gap: 8px; container-type: inline-size; }
      .badge { flex: none; width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center;
               background: color-mix(in srgb, var(--c) 16%, transparent); color: var(--c); }
      .badge ha-icon { --mdc-icon-size: 24px; }
      /* The title takes what the pill leaves (basis 0) and keeps a few characters; the pill keeps its full text
         while there is room and only truncates when there is not */
      .heading { flex: 1 1 0; min-width: 5ch; display: flex; flex-direction: column; }
      .title { font-size: 16px; font-weight: 500; line-height: 1.25; color: var(--primary-text-color);
               white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .subtitle { font-size: 12px; line-height: 1.3; color: var(--secondary-text-color);
                  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .pill { flex: 0 1 auto; min-width: 0; display: flex; align-items: center; box-sizing: border-box;
              white-space: nowrap; overflow: hidden;
              font-size: 11px; font-weight: 500; padding: 1px 6px; border-radius: 9px;
              color: color-mix(in srgb, var(--c) 40%, var(--primary-text-color));
              background: color-mix(in srgb, var(--c) 14%, transparent); }
      /* Short of room the status takes a second line before it is cut */
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
      /* Mini card: the expand / collapse button in the card's top right corner (24 px, round), the check button on the
         same top line at its left; the header keeps clear of them. */
      ha-card:has(.zoom) { position: relative; }
      .head:has(> .zoom) { padding-right: 21px; }
      .head:has(> .zoom):has(> .check) { padding-right: 49px; }
      .head > .zoom, .head:has(> .zoom) > .check { position: absolute; z-index: 2; top: 5px; width: 24px; height: 24px; margin: 0;
                                                 background: color-mix(in srgb, var(--secondary-text-color) 10%, transparent); }
      .head > .zoom { right: 5px; }
      .head:has(> .zoom) > .check { right: 33px; }
      /* A very narrow header (a 1fr 1fr grid on a phone): the badge gives way, the pill's dot still tells the status */
      @container (max-width: 140px) {
        .head .badge { display: none; }
      }
      .check { all: unset; cursor: pointer; flex: none; width: 26px; height: 26px; border-radius: 50%;
               display: grid; place-items: center; color: var(--secondary-text-color); }
      .check:hover { background: color-mix(in srgb, var(--secondary-text-color) 14%, transparent); color: var(--primary-text-color); }
      .check:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
      .check[disabled] { cursor: default; opacity: .4; background: none; }
      .check ha-icon { --mdc-icon-size: 16px; }
      /* A given-up row and its "Try again" button (outlined, not filled) */
      .line { display: flex; align-items: center; gap: 6px; min-width: 0; }
      .line > .row { flex: 1; }
      .retry { all: unset; cursor: pointer; flex: none; box-sizing: border-box; width: 30px; height: 30px; border-radius: 50%;
               display: grid; place-items: center; color: var(--iw-alert); border: 1px solid color-mix(in srgb, var(--iw-alert) 50%, transparent); }
      .retry:hover { background: color-mix(in srgb, var(--iw-alert) 12%, transparent); }
      .retry:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
      .retry ha-icon { --mdc-icon-size: 16px; }

      .stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; margin-top: 10px; }
      .stat { --t: var(--secondary-text-color); display: flex; flex-direction: column; align-items: center; gap: 1px;
              padding: 6px 4px; border-radius: 10px; min-width: 0;
              background: var(--secondary-background-color, rgba(127,127,127,.08)); }
      .stat.warn { --t: var(--iw-warn); background: color-mix(in srgb, var(--t) 12%, var(--secondary-background-color, transparent)); }
      .stat .val { font-size: 18px; font-weight: 500; line-height: 1.2; font-variant-numeric: tabular-nums; color: var(--primary-text-color); }
      .stat.warn .val { color: color-mix(in srgb, var(--t) 40%, var(--primary-text-color)); }
      .stat .lbl { font-size: 11px; color: var(--iw-muted); max-width: 100%;
                   white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

      .section { margin-top: 12px; }
      .stitle { font-size: 12px; font-weight: 500; color: var(--secondary-text-color); margin: 0 2px 6px;
                text-transform: uppercase; letter-spacing: .04em; }
      .list { display: flex; flex-direction: column; gap: 6px; }
      .empty { font-size: 13px; color: var(--iw-muted); padding: 8px 10px; border-radius: 10px;
               background: var(--secondary-background-color, rgba(127,127,127,.08)); }
      .row { --t: var(--iw-ok); all: unset; box-sizing: border-box; min-width: 0;
             display: flex; align-items: center; gap: 8px; padding: 5px 10px 5px 5px; border-radius: 10px;
             background: var(--secondary-background-color, rgba(127,127,127,.08)); }
      .row.warn  { --t: var(--iw-warn); }
      .row.alert { --t: var(--iw-alert); }
      /* Unavailable integrations are tinted; the history keeps the neutral tile, its colour on the icon */
      .row:not(.hist) { background: color-mix(in srgb, var(--t) 12%, var(--secondary-background-color, transparent)); }
      /* Only administrators get clickable rows (buttons): they can open Settings */
      button.row { cursor: pointer; }
      button.row:hover { background: color-mix(in srgb, var(--t) 18%, var(--secondary-background-color, transparent)); }
      button.row.hist:hover { background: color-mix(in srgb, var(--secondary-text-color) 10%, var(--secondary-background-color, transparent)); }
      .row:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
      .ic { position: relative; flex: none; width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center;
            color: var(--t); background: color-mix(in srgb, var(--t) 18%, transparent); overflow: hidden; }
      .ic ha-icon { --mdc-icon-size: 16px; }
      .ic img.brand { position: absolute; inset: 5px; width: 18px; height: 18px; object-fit: contain; }
      .ic:not(.nobrand) img.brand + ha-icon { visibility: hidden; }
      .ic.nobrand img.brand { display: none; }
      .txt { flex: 1; display: flex; flex-direction: column; min-width: 0; }
      .name { font-size: 13px; font-weight: 500; line-height: 1.2; color: var(--primary-text-color);
              white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .sub { font-size: 11px; line-height: 1.2; color: var(--iw-muted);
             white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      /* The outcome on the right shrinks (up to half the row) before the name does */
      .tag { flex: 0 1 auto; min-width: 0; max-width: 50%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 12px; font-weight: 500; color: color-mix(in srgb, var(--t) 40%, var(--primary-text-color)); font-variant-numeric: tabular-nums; }
      .when { flex: 0 1 auto; min-width: 0; max-width: 50%; display: flex; flex-direction: column; align-items: flex-end; }
      .when > span { max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .when .lbl { font-size: 12px; font-weight: 500; line-height: 1.2; color: color-mix(in srgb, var(--t) 40%, var(--primary-text-color)); }
      .when .ago { font-size: 11px; line-height: 1.2; color: var(--iw-muted); }
      :host([hide-title]) .heading .title, :host([hide-subtitle]) .heading > .subtitle { display: none; }
    `;
  }
}
