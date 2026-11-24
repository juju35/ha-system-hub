import { BM_BANDS, BM_DEFAULTS, BM_FORECAST_DAYS, bmByForecast, bmDialogOpen, bmEsc, bmLang, bmT } from "./i18n-helpers.js";
import { BM_PILL, bmAreaIcon, bmCandidates, bmFindButton, bmFocusKey, bmPick, bmTypeOf } from "./battery-types.js";
import { shBanner, shbIsNight } from "./illustrated-header.js";
import { bmHoldUnderPress, bmKeepsFocus } from "./mini-card.js";

export class BatteryMonitorCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement('sh-batteries-card-editor');
  }

  static getStubConfig() {
    return {};
  }

  setConfig(config) {
    this.connectedWhileHidden = true;
    this._config = { ...BM_DEFAULTS, ...config };
    // show_title / show_subtitle: the header's title / subtitle, hidden by the stylesheet
    this.toggleAttribute?.('hide-title', config.show_title === false);
    if (!this.shadowRoot) {
      this.attachShadow({ mode: 'open' });
      bmHoldUnderPress(this, () => this._render());
    }
    this._sig = null;
    this._render();
  }

  // The status pill goes on the title row, right after the title, only when the whole title and the pill's whole
  // label fit there; otherwise it takes its own line under the subtitle (the subtitle then on one line). Its dot
  // alone on a card 200 px wide or less, or when its label is wider than the title block (or, in a banner, would not
  // fit above the ground strip). Measured after each render and on every new width (or once the web font is loaded),
  // never by a fixed width; $BM_PILL names the parts.
  _fitPill() {
    const S = BM_PILL;
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
    // Cheap short-circuit before rebuilding the whole signature: the sensor's state object, the registries (areas: room icons),
    // the language and the hour bucket ("low for X h") are unchanged, so nothing the card shows can have
    // changed. A Battery Notes type edit alone waits for the next sensor update or hour at worst.
    const entity = this._state?.entity;
    if (
      old &&
      this._sig &&
      entity &&
      hass.states[entity] === old.states[entity] &&
      hass.states[this._state.button] === old.states[this._state.button] &&
      hass.entities === old.entities &&
      hass.devices === old.devices &&
      hass.areas === old.areas &&
      bmLang(hass, this._config) === bmLang(old, this._config) &&
      Math.floor(Date.now() / 3600000) === this._sigHour
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

  disconnectedCallback() {
    // Left in the middle of a press: nothing stays held.
    this._dropPress?.();
    // A dashboard edit can simply move the card in the DOM: only close the full screen if the card is really gone.
    Promise.resolve().then(() => {
      if (this.isConnected) return;
      this._closePopup();
      clearTimeout(this._notifyTimer);
      this._notifyState = null;
    });
  }

  getCardSize() {
    if (this.hidden) return 0;
    return 1 + Math.ceil((this._shown || 1) / (this._config?.columns || 1));
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6, rows: 'auto' };
  }

  _t(key, vars) {
    return bmT(bmLang(this._hass, this._config), key, vars);
  }

  _since(iso, key) {
    const hours = Math.max(0, (Date.now() - Date.parse(iso)) / 3600000);
    // "< 1 h" the first hour, hours up to two days, days beyond.
    let d = this._t('days', { n: Math.floor(hours / 24) });
    if (hours < 1) d = this._t('hours', { n: '< 1' });
    else if (hours < 48) d = this._t('hours', { n: Math.floor(hours) });
    return this._t(key, { d });
  }

  // The sensor and the "Notify now" button of its device. What comes from the entity registry (the integration's
  // sensors, each sensor's button) is kept until hass.entities changes; the states are read again at each call, so a
  // sensor missing, restored or without its battery list at the first render is found as soon as its state is there.
  // An empty registry result is never kept.
  _lookup() {
    const registry = this._hass.entities;
    if (!this._reg || this._reg.registry !== registry) this._reg = { registry, candidates: null, buttons: {} };
    const reg = this._reg;
    let entity = this._config.entity;
    if (!entity) {
      const candidates = reg.candidates || bmCandidates(registry);
      if (candidates.length) reg.candidates = candidates;
      entity = bmPick(this._hass, candidates);
    }
    if (!entity) return {};
    if (!(entity in reg.buttons)) {
      const button = bmFindButton(registry, entity);
      // No button is kept only once the registry knows the sensor (otherwise it may just not be loaded yet).
      if (!button && !registry?.[entity]) return { entity };
      reg.buttons[entity] = button;
    }
    return { entity, button: reg.buttons[entity] };
  }

  _render() {
    if (!this._config || !this._hass || !this.shadowRoot) return;
    // Held under a press (see bmHoldUnderPress), drawn after its click.
    if (this._pressing) {
      this._dirty = true;
      return;
    }
    this._dirty = false;
    const c = this._config;
    const { entity, button } = this._lookup();
    const st = entity && this._hass.states[entity];
    const all = st?.attributes.batteries || [];
    const low = all.filter((b) => b.low);
    const unavailable = all.filter((b) => b.unavailable);
    const attention = low.length + unavailable.length;
    const due = all.filter((b) => b.due);
    // The compact mini card lists only the batteries needing attention, like only_low.
    const compact = this._compact();
    const shown = c.only_low || compact ? all.filter((b) => b.low || b.unavailable) : all;
    this._shown = shown.length;

    // The current hour too: "low for X h" is computed from the clock, while below_since doesn't change.
    // The battery types read from Battery Notes, which may change without the battery list changing.
    const types = all.map((b) => bmTypeOf(this._hass, c, b));
    // The room icons of the full screen, which an area edit alone changes.
    const icons = [...new Set(all.map((b) => b.area))].map((a) => bmAreaIcon(this._hass, a));
    const hour = Math.floor(Date.now() / 3600000);
    // The button's availability too: an unavailable "Notify now" button is disabled.
    const buttonUnavailable = this._hass.states?.[button]?.state === 'unavailable';
    const sig = JSON.stringify([c, shbIsNight(this._hass, c), bmLang(this._hass, c), entity, st?.state, all, types, icons, button, buttonUnavailable, hour, compact]);
    this._sigHour = hour;
    if (sig === this._sig) return;
    this._sig = sig;
    this._state = { entity, button, all, low, unavailable, due, attention };
    if (this._popup) this._renderPopup();

    const hidden = c.hide_when_ok && st && !attention && !this._editMode && !this._preview;
    this._setHidden(hidden);
    if (hidden) return;
    if (c.expanded && st) {
      this._renderExpanded();
      return;
    }

    const level = this._level();
    const counts = [
      low.length ? this._t(low.length > 1 ? 'low_many' : 'low_one', { n: low.length }) : '',
      unavailable.length
        ? this._t(unavailable.length > 1 ? 'unavailable_many' : 'unavailable_one', { n: unavailable.length })
        : '',
    ].filter(Boolean);
    const status = this._status(st, counts, all);
    const cols = Math.min(3, Math.max(1, Number(c.columns) || 1));

    // The room and the battery type (CR2032, 2× AA…) under each name, when known.
    const rows = shown
      .map((b) => this._row(b, [b.area, this._typeLabel(bmTypeOf(this._hass, c, b))].filter(Boolean).join(' · ')))
      .join('');

    // Writing the markup again replaces the focused control (a battery, a header button): it is found again after.
    const active = this.shadowRoot.activeElement;
    const focused = bmKeepsFocus(this, active) && bmFocusKey(active);
    this.shadowRoot.innerHTML = shBanner(`
      <style>${BatteryMonitorCard.styles}</style>
      <ha-card class="lvl-${level}${compact ? ' mini' : ''}">
        <div class="head">
          <div class="badge"><ha-icon icon="${level === 'ok' ? 'mdi:battery-check-outline' : 'mdi:battery-alert-variant-outline'}"></ha-icon></div>
          ${this._headMain(c.title || this._t('title'), status)}
          ${
            c.popup !== false && st && !compact
              ? `<button class="full" title="${bmEsc(this._t('popup_open'))}" aria-label="${bmEsc(this._t('popup_open'))}"><ha-icon icon="mdi:fullscreen"></ha-icon></button>`
              : ''
          }
          ${this._zoomButton()}
        </div>
        ${rows ? `<div class="list" style="--cols:${cols}">${rows}</div>` : ''}
      </ha-card>`, { hass: this._hass, config: c, scene: 'batteries', pad: '12px' });

    this.shadowRoot.querySelector('.notify')?.addEventListener('click', () => this._notify());
    this.shadowRoot.querySelector('.full')?.addEventListener('click', () => this._openPopup());
    this.shadowRoot.querySelector('.zoom')?.addEventListener('click', (ev) => this._onZoom(ev));
    for (const el of this.shadowRoot.querySelectorAll('.row')) el.addEventListener('click', () => this._moreInfo(el.dataset.id));
    // Without preventScroll the browser scrolls the dashboard to the card on every battery update.
    if (focused) this.shadowRoot.querySelector(focused)?.focus?.({ preventScroll: true });
  }

  // Overridden by the mini card: compact (only the batteries needing attention), and its detail button.
  _compact() {
    return false;
  }

  _zoomButton() {
    return '';
  }

  // 'alert' when a battery is due, 'warn' when one needs attention, else 'ok'.
  _level() {
    const s = this._state;
    return s.due.length ? 'alert' : s.attention ? 'warn' : 'ok';
  }

  _status(st, counts, all) {
    if (!st) return this._t('not_loaded');
    return counts.length ? counts.join(' · ') : this._t(all.length ? 'all_ok' : 'no_batteries');
  }

  // The title and the status pill (see _fitPill), then the "Notify now" button, in a block of their own between the
  // badge and the full screen (or close) button.
  _headMain(title, status) {
    return `<div class="main"><div class="mt"><div class="title-row"><div class="title">${bmEsc(title)}</div>${this._pill(status)}</div></div>${this._notifyButton()}</div>`;
  }

  // The status pill: its whole text, on its own line under the title when the header is short of room.
  _pill(status) {
    const text = bmEsc(status);
    return `<div class="pill" title="${text}"><span class="pt">${text}</span></div>`;
  }

  // The "Notify now" button's look: its state while a press runs ('busy'), just after ('done'), or when it failed
  // ('error'); disabled while the button entity is unavailable.
  _notifyLook() {
    const unavailable = this._hass?.states?.[this._state?.button]?.state === 'unavailable';
    const state = unavailable ? '' : this._notifyState || '';
    const label = unavailable
      ? this._t('notify_unavailable')
      : state === 'done'
        ? this._t('notify_sent')
        : state === 'error'
          ? this._t('notify_failed', { error: this._notifyError })
          : this._t('notify_now');
    const icon = { busy: 'mdi:loading', done: 'mdi:check', error: 'mdi:alert-circle-outline' }[state] || 'mdi:bell-ring-outline';
    return { unavailable, state, label, icon };
  }

  _notifyButton() {
    if (!this._config.notify_button || !this._state?.button) return '';
    const { unavailable, state, label, icon } = this._notifyLook();
    const l = bmEsc(label);
    return `<button class="notify" data-state="${state}" title="${l}" aria-label="${l}"${unavailable ? ' disabled' : ''}${state === 'busy' ? ' aria-busy="true"' : ''}><ha-icon icon="${icon}"></ha-icon></button>`;
  }

  // Shows the press state on the buttons already there (the card's and the full screen's), without writing the
  // markup again: a button focused from the keyboard keeps its focus.
  _setNotify(state, error = '') {
    this._notifyState = state;
    this._notifyError = error;
    const { unavailable, state: shown, label, icon } = this._notifyLook();
    for (const root of [this.shadowRoot, this._popup?.shadowRoot]) {
      for (const el of root?.querySelectorAll?.('.notify') || []) {
        if (el.dataset) el.dataset.state = shown;
        el.title = label;
        el.setAttribute?.('aria-label', label);
        if (shown === 'busy') el.setAttribute?.('aria-busy', 'true');
        else el.removeAttribute?.('aria-busy');
        el.toggleAttribute?.('disabled', unavailable);
        el.querySelector?.('ha-icon')?.setAttribute('icon', icon);
      }
    }
  }

  // Presses the "Notify now" button: busy while the call runs, a check mark once sent, the reason in the tooltip
  // when it fails. A press while one runs, or on an unavailable button, does nothing.
  async _notify() {
    const button = this._state?.button;
    if (!button || this._notifyState === 'busy' || this._notifyLook().unavailable) return;
    clearTimeout(this._notifyTimer);
    this._setNotify('busy');
    let state = 'done';
    let error = '';
    try {
      await this._hass.callService('button', 'press', { entity_id: button });
    } catch (err) {
      state = 'error';
      error = String(err?.message || err?.code || err || '');
    }
    this._setNotify(state, error);
    this._notifyTimer = setTimeout(() => this._setNotify(null), state === 'done' ? 2000 : 8000);
  }

  _moreInfo(entityId) {
    const ev = new Event('hass-more-info', { bubbles: true, composed: true });
    ev.detail = { entityId };
    this.dispatchEvent(ev);
  }

  // The battery type with how many it takes: "1× CR2032", "4× AA"; a built-in rechargeable battery has no count.
  _typeLabel(t, withCount = true) {
    if (!t) return '';
    if (t.type === 'rechargeable') return this._t('rechargeable');
    return withCount ? `${t.quantity || 1}× ${t.type}` : t.type;
  }

  // One battery: `context` (its room, or its type) then how long it has needed attention, under its name.
  _row(b, context, withForecast = true) {
    // A low battery is a warning; an unavailable one (often a dead one, shown with its own icon) or one due for
    // replacement is an alert.
    const kind = `${b.unavailable || b.due ? 'alert' : b.low ? 'warn' : 'ok'}${b.unavailable ? ' na' : ''}${b.due ? ' due' : ''}`;
    const value = b.unavailable ? this._t('unavailable') : b.level == null ? this._t('low') : `${b.level} %`;
    const since = b.below_since ? this._since(b.below_since, b.unavailable ? 'since_unavailable' : 'since') : null;
    // Replacement forecast from the measured drain: shown once the threshold is less than two months away.
    const forecast =
      withForecast && !b.alert && Number.isInteger(b.days_left) && b.days_left <= BM_FORECAST_DAYS
        ? this._t('forecast', { d: this._t('days', { n: b.days_left }) })
        : null;
    const sub = [context, since || forecast].filter(Boolean).join(' · ');
    const bar = b.level == null ? '' : `<span class="bar" style="width:${Math.max(2, Math.min(100, b.level))}%"></span>`;
    return `
          <button class="row ${kind}" data-id="${bmEsc(b.entity_id)}" title="${bmEsc(b.name)} — ${bmEsc(value)}">
            <span class="ic"><ha-icon icon="${bmEsc(b.icon)}"></ha-icon></span>
            <span class="txt">
              <span class="name">${bmEsc(b.name)}</span>
              ${sub ? `<span class="sub">${bmEsc(sub)}</span>` : ''}
            </span>
            <span class="lvl">${bmEsc(value)}${bar ? `<span class="track">${bar}</span>` : ''}</span>
          </button>`;
  }

  // ── Full screen ──
  // Every battery over the whole screen, grouped by room or by battery type, with what to buy for the ones to
  // replace. Appended to the page's body so that no dashboard container clips it; closes with its button, Escape,
  // a click outside or the back button.
  _openPopup() {
    if (this._popup?.isConnected) return;
    if (this._popup) this._closePopup(true);
    const host = document.createElement('div');
    host.className = 'battery-monitor-popup';
    const root = host.attachShadow({ mode: 'open' });
    root.addEventListener('click', (ev) => this._onPopupClick(ev));
    this._onPopupKey = (ev) => {
      // Escape over a more-info opened from here closes that dialog only, and Tab moves in that dialog.
      if (bmDialogOpen()) return;
      if (ev.key === 'Escape') this._closePopup();
      else if (ev.key === 'Tab') this._trapTab(ev);
    };
    this._onPopupBack = (ev) => {
      // A more-info opened from a row adds its own history entry; closing it goes back to the popup's entry:
      // stay open. Our own flag tells that case apart: older versions of Home Assistant leave a closed-dialog
      // state on the dashboard's entry after any more-info opened from the dashboard, so the state alone cannot.
      // The state still has to be the popup's entry (ours, or the dialog state older versions put on it), in case
      // no more-info opened at all.
      const state = ev?.state;
      const opened = this._moreInfoOpen;
      this._moreInfoOpen = false;
      if (opened && (state?.batteryMonitorPopup || state?.dialog)) {
        this._popupLayer(false);
        return;
      }
      this._closePopup(true);
    };
    document.addEventListener('keydown', this._onPopupKey);
    window.addEventListener?.('popstate', this._onPopupBack);
    window.history?.pushState?.({ batteryMonitorPopup: true }, '');
    // Our own flag: a more-info may rewrite history.state, which then no longer tells whether to go back.
    this._popupHistory = !!window.history?.pushState;
    // The page the popup's entry belongs to: once the user has navigated elsewhere (a device link in a more-info
    // opened from here), going back would undo that navigation.
    this._popupUrl = window.location?.href;
    this._bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.appendChild(host);
    this._popup = host;
    this._view ||= 'room';
    this._renderPopup();
    // The keyboard goes with the dialog: its close button first.
    root.querySelector('.close')?.focus?.({ preventScroll: true });
  }

  // Tab from the last control goes back to the first one, Shift+Tab from the first to the last: the focus never
  // leaves for the dashboard hidden behind the full screen.
  _trapTab(ev) {
    const root = this._popup?.shadowRoot;
    const items = [...(root?.querySelectorAll?.('button:not([disabled])') || [])];
    if (!items.length) return;
    const at = items.indexOf(root.activeElement);
    const next = ev.shiftKey ? (at <= 0 ? items[items.length - 1] : null) : at < 0 || at === items.length - 1 ? items[0] : null;
    if (!next) return;
    ev.preventDefault();
    next.focus();
  }

  // `fromBack`: the back button already left the history entry the popup added.
  _closePopup(fromBack = false) {
    if (!this._popup) return;
    const host = this._popup;
    this._popup = null;
    this._moreInfoOpen = false;
    host.remove();
    document.removeEventListener('keydown', this._onPopupKey);
    window.removeEventListener?.('popstate', this._onPopupBack);
    document.body.style.overflow = this._bodyOverflow || '';
    const pushed = this._popupHistory && window.location?.href === this._popupUrl;
    this._popupHistory = false;
    this._popupUrl = null;
    if (!fromBack && pushed) window.history.back();
    // The focus back on the button that opened it.
    this.shadowRoot?.querySelector?.('.full')?.focus?.({ preventScroll: true });
  }

  // Home Assistant's dialogs are not in the browser's top layer: while a more-info opened from the full screen
  // is shown, the layer drops below them (their z-index is 7-8), and comes back on top once it is closed.
  _popupLayer(under) {
    this._popup?.style.setProperty?.('--bm-layer', under ? '5' : '9999');
  }

  _onPopupClick(ev) {
    const path = ev.composedPath();
    const el = path.find(
      (n) => n.classList && (n.dataset?.id || n.dataset?.view || n.classList.contains('close') || n.classList.contains('notify') || n.classList.contains('csv')),
    );
    if (!el) {
      if (!path.some((n) => n.classList?.contains?.('sheet'))) this._closePopup();
      return;
    }
    if (el.classList.contains('close')) this._closePopup();
    else if (el.classList.contains('notify')) this._notify();
    else if (el.classList.contains('csv')) this._exportCsv();
    else if (el.dataset.view) {
      this._view = el.dataset.view;
      this._renderPopup();
    } else if (el.dataset.id) {
      this._popupLayer(true);
      this._moreInfoOpen = true;
      this._moreInfo(el.dataset.id);
    }
  }

  // The batteries in groups: [{ key, name, icon, hint, items: [{ b, context }] }], by room, by type or by replacement date.
  _groups(view) {
    if (view === 'forecast') return this._forecastGroups();
    const map = new Map();
    for (const b of this._state.all) {
      const t = bmTypeOf(this._hass, this._config, b);
      const key = view === 'room' ? b.area || '' : t?.type || '';
      if (!map.has(key)) map.set(key, []);
      // By type, the group names the type: each battery tells its room and how many it takes.
      const count = t && t.type !== 'rechargeable' ? this._t(t.quantity > 1 ? 'cells' : 'cells_one', { n: t.quantity }) : '';
      map.get(key).push({ b, cells: t?.quantity || 1, context: view === 'room' ? this._typeLabel(t) : [b.area, count].filter(Boolean).join(' · ') });
    }
    const groups = [...map.entries()].map(([key, items]) => ({
      key,
      items,
      name: key
        ? view === 'type' && key === 'rechargeable'
          ? this._t('rechargeable')
          : key
        : this._t(view === 'room' ? 'no_area' : 'unknown_type'),
      icon: view === 'room' ? bmAreaIcon(this._hass, key) : key ? 'mdi:battery-outline' : 'mdi:battery-unknown',
      hint: view === 'type' && !key ? this._t('unknown_type_hint') : '',
      // By type, the batteries of that type in all (a remote with 2 AAA counts 2); by room, the devices.
      cells: view === 'type' && key && key !== 'rechargeable' ? items.reduce((n, x) => n + x.cells, 0) : null,
    }));
    // Rooms by name, types by how many batteries use them; the room-less and the unknown last.
    const last = (g) => (g.key ? 0 : 1);
    const bySize = (a, b) => (view === 'type' ? b.items.length - a.items.length : 0);
    return groups.sort((a, b) => last(a) - last(b) || bySize(a, b) || a.name.localeCompare(b.name));
  }

  // By replacement date: the ones to replace now, then by how soon the measured drain takes them to the threshold
  // (the soonest first), the ones without a forecast yet last. Each row tells its room, its drain and the date.
  _forecastGroups() {
    const groups = BM_BANDS.map((band) => ({ ...band, items: [] }));
    for (const b of [...this._state.all].sort(bmByForecast)) {
      const group = groups.find((g) => g.test(b));
      const drain = Number(b.drain_per_day) > 0 ? this._t('drain', { n: this._num(b.drain_per_day, b.drain_per_day < 1 ? 2 : 1) }) : '';
      // A battery to replace now: the row itself tells since when.
      let when = '';
      if (group.key !== 'now' && group.key !== 'none') {
        when = this._t('forecast', { d: this._t('days', { n: b.days_left }) });
        if (b.replace_by) when += ` ${this._t('replace_on', { date: this._date(b.replace_by) })}`;
      }
      group.items.push({ b, context: [b.area, when, drain].filter(Boolean).join(' · ') });
    }
    return groups
      .filter((g) => g.items.length)
      .map(({ key, icon, items }) => ({
        key,
        icon,
        items,
        name: this._t(`fc_${key}`),
        hint: key === 'none' ? this._t('fc_none_hint') : '',
        cells: null,
      }));
  }

  _num(n, digits) {
    try {
      return new Intl.NumberFormat(bmLang(this._hass, this._config), { maximumFractionDigits: digits }).format(n);
    } catch {
      return String(Math.round(n * 10 ** digits) / 10 ** digits);
    }
  }

  _date(iso) {
    try {
      // The year only for a date beyond the next eleven months, which would read as this year's otherwise.
      const d = new Date(iso);
      const far = d - Date.now() > 330 * 864e5;
      return new Intl.DateTimeFormat(bmLang(this._hass, this._config), { day: 'numeric', month: 'short', ...(far ? { year: 'numeric' } : {}) }).format(d);
    } catch {
      return String(iso).slice(0, 10);
    }
  }

  // The first battery the drain takes to the threshold (not one already needing attention): "Hub · 22 Dec".
  _nextReplacement() {
    const next = this._state.all
      .filter((b) => !b.low && !b.unavailable && Number.isInteger(b.days_left))
      .sort((a, b) => a.days_left - b.days_left)[0];
    if (!next) return '';
    const when = next.replace_by ? this._date(next.replace_by) : this._t('forecast', { d: this._t('days', { n: next.days_left }) });
    return `<div class="next"><span class="rlabel"><ha-icon icon="mdi:calendar-clock"></ha-icon>${bmEsc(this._t('next_replacement'))}</span><button class="nextb" data-id="${bmEsc(next.entity_id)}"><b>${bmEsc(next.name)}</b> · ${bmEsc(when)}</button></div>`;
  }

  // Every battery as a CSV file, downloaded by the browser: name, room, type, level, status, drain and forecast.
  _csv() {
    const cell = (v) => {
      const text = String(v ?? '');
      return /[",;\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const head = ['name', 'area', 'type', 'level', 'status', 'drain_per_day', 'days_left', 'replace_by', 'below_since', 'entity_id'];
    const rows = this._state.all.map((b) => [
      b.name,
      b.area || '',
      this._typeLabel(bmTypeOf(this._hass, this._config, b)),
      b.level ?? '',
      b.unavailable ? 'unavailable' : b.low ? 'low' : 'ok',
      b.drain_per_day ?? '',
      b.days_left ?? '',
      b.replace_by ? String(b.replace_by).slice(0, 10) : '',
      b.below_since || '',
      b.entity_id,
    ]);
    return [head, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
  }

  _exportCsv() {
    const blob = new Blob([`\ufeff${this._csv()}\r\n`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `batteries-${new Date().toISOString().slice(0, 10)}.csv`;
    (this._popup?.shadowRoot || document.body).appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  _groupCount(g) {
    if (g.cells != null) return this._t(g.cells > 1 ? 'cells' : 'cells_one', { n: g.cells });
    return g.items.length > 1 ? this._t('count', { n: g.items.length }) : this._t('count_one');
  }

  // What to buy: the types of the batteries needing attention, with how many of each.
  _toReplace() {
    const need = new Map();
    for (const b of this._state.all.filter((x) => x.low || x.unavailable)) {
      const t = bmTypeOf(this._hass, this._config, b);
      const key = t?.type || '';
      need.set(key, (need.get(key) || 0) + (t?.quantity || 1));
    }
    return [...need.entries()]
      .sort((a, b) => !a[0] - !b[0] || b[1] - a[1])
      .map(([type, n]) => `<span class="buy${type ? '' : ' unknown'}"><b>${n}×</b> ${bmEsc(type ? this._typeLabel({ type }, false) : this._t('unknown_type'))}</span>`)
      .join('');
  }

  // The full screen content: header (badge, title, notify button, status), the view tabs, what to replace, the next
  // replacement, the CSV export, then the battery groups. `close`: the close button of the full screen layer.
  _fullHtml({ close, csv }) {
    const c = this._config;
    const s = this._state;
    const level = this._level();
    const counts = [
      s.low.length ? this._t(s.low.length > 1 ? 'low_many' : 'low_one', { n: s.low.length }) : '',
      s.unavailable.length ? this._t(s.unavailable.length > 1 ? 'unavailable_many' : 'unavailable_one', { n: s.unavailable.length }) : '',
    ].filter(Boolean);
    const status = this._status(true, counts, s.all);
    const view = this._view;
    const groups = this._groups(view)
      .map((g) => {
        const alerts = g.items.filter(({ b }) => b.low || b.unavailable).length;
        return `
        <section class="group${alerts ? ' attention' : ''}">
          <div class="ghead"><ha-icon icon="${bmEsc(g.icon)}"></ha-icon><span class="gname">${bmEsc(g.name)}</span>
            ${alerts ? `<span class="gchip">${bmEsc(this._t('to_check', { n: alerts }))}</span>` : ''}
            <span class="gcount">${bmEsc(this._groupCount(g))}</span></div>
          ${g.hint ? `<div class="ghint">${bmEsc(g.hint)}</div>` : ''}
          <div class="glist">${g.items.map(({ b, context }) => this._row(b, context, view !== 'forecast')).join('')}</div>
        </section>`;
      })
      .join('');
    const buy = this._toReplace();
    const tab = (v) =>
      `<button class="tab${view === v ? ' on' : ''}" data-view="${v}" aria-pressed="${view === v}">${bmEsc(this._t({ room: 'by_room', type: 'by_type', forecast: 'by_forecast' }[v]))}</button>`;
    return `
        <ha-card class="popup${close ? '' : ' expanded'} lvl-${level}">
          <div class="head">
            <div class="badge"><ha-icon icon="${level === 'ok' ? 'mdi:battery-check-outline' : 'mdi:battery-alert-variant-outline'}"></ha-icon></div>
            ${this._headMain(c.title || this._t('title'), status)}
            ${close ? `<button class="close" title="${bmEsc(this._t('popup_close'))}" aria-label="${bmEsc(this._t('popup_close'))}"><ha-icon icon="mdi:close"></ha-icon></button>` : ''}
          </div>
          <div class="bar-top">
            <div class="tabs" role="group">${tab('room')}${tab('type')}${tab('forecast')}</div>
            <div class="replace"><span class="rlabel"><ha-icon icon="mdi:cart-outline"></ha-icon>${bmEsc(this._t('to_replace'))}</span>${buy || `<span class="none">${bmEsc(this._t('nothing_to_replace'))}</span>`}</div>
            ${this._nextReplacement()}
            ${csv ? `<button class="csv" title="${bmEsc(this._t('export_csv'))}"><ha-icon icon="mdi:file-delimited-outline"></ha-icon><span>${bmEsc(this._t('export_csv'))}</span></button>` : ''}
          </div>
          <div class="groups">${groups}</div>
        </ha-card>`;
  }

  _renderPopup() {
    const host = this._popup;
    if (!host || !this._state) return;
    const view = this._view;
    const title = bmEsc(this._config.title || this._t('title'));
    // A refresh while the user is reading (a battery change, the hour ticking) keeps their scroll position;
    // switching tabs starts back at the top.
    const scrolled = (view === this._renderedView && host.shadowRoot.querySelector('.sheet')?.scrollTop) || 0;
    this._renderedView = view;
    // The focused control (a tab, a battery, a button) is found again in the new markup.
    const focused = bmFocusKey(host.shadowRoot.activeElement);
    host.shadowRoot.innerHTML = `
      <style>${BatteryMonitorCard.styles}${BatteryMonitorCard.fullStyles}${BatteryMonitorCard.popupStyles}</style>
      <div class="backdrop"><div class="sheet" role="dialog" aria-modal="true" aria-label="${title}">
        ${this._fullHtml({ close: true, csv: this._config.csv_button !== false })}
      </div></div>`;
    if (scrolled) {
      const sheet = host.shadowRoot.querySelector('.sheet');
      if (sheet) sheet.scrollTop = scrolled;
    }
    if (focused) host.shadowRoot.querySelector(focused)?.focus?.({ preventScroll: true });
  }

  // `expanded: true`: the full screen content in the card itself, no layer, no close button; a click on a row opens
  // its more-info, the view tabs switch the grouping.
  _renderExpanded() {
    this._view ||= 'room';
    const root = this.shadowRoot;
    const focused = bmFocusKey(root.activeElement);
    root.innerHTML = `
      <style>${BatteryMonitorCard.styles}${BatteryMonitorCard.fullStyles}${BatteryMonitorCard.expandedStyles}</style>
      ${this._fullHtml({ close: false, csv: this._config.csv_button !== false })}`;
    root.querySelector('.notify')?.addEventListener('click', () => this._notify());
    root.querySelector('.csv')?.addEventListener('click', () => this._exportCsv());
    for (const el of root.querySelectorAll('[data-view]')) {
      el.addEventListener('click', () => {
        this._view = el.dataset.view;
        this._sig = null;
        this._render();
      });
    }
    for (const el of root.querySelectorAll('[data-id]')) el.addEventListener('click', () => this._moreInfo(el.dataset.id));
    if (focused) root.querySelector(focused)?.focus?.({ preventScroll: true });
  }

  static get styles() {
    return `
      /* A block, never narrower than its grid or flex track (min-width: 0): see the size container below. */
      :host([hidden]) { display: none !important; }
      /* Home Assistant's <ha-icon> is inline: as a box of its own, its icon is centred in its badge */
      ha-icon { display: inline-flex; align-items: center; justify-content: center; vertical-align: middle; line-height: 0; }
      :host {
        display: block;
        min-width: 0;
        --bm-ok: var(--success-color, #43a047);
        --bm-warn: var(--warning-color, #ffa600);
        --bm-alert: var(--error-color, #db4437);
        --bm-na: var(--disabled-color, #9e9e9e);
        /* Text in a status colour: the colour mixed with the theme's text, darker in light themes and lighter in dark
           ones, so that it stays readable (4.5:1) on its tinted background. Badges, icons and bars keep the plain colour. */
        --bm-ok-text: color-mix(in srgb, var(--bm-ok) 40%, var(--primary-text-color, #212121));
        --bm-warn-text: color-mix(in srgb, var(--bm-warn) 40%, var(--primary-text-color, #212121));
        --bm-alert-text: color-mix(in srgb, var(--bm-alert) 40%, var(--primary-text-color, #212121));
        --bm-primary-text: color-mix(in srgb, var(--primary-color, #03a9f4) 40%, var(--primary-text-color, #212121));
      }
      /* The card is a size container: the header and the list adapt to its own width (the Sections view's columns).
         A size container takes no width from its content: in a parent sized by its content (inline-block, an \`auto\`
         grid column of layout-card) it would shrink to its padding. An empty, zero-height grid before it gives the
         host up to 240px there, and no minimum (minmax(0, …)): unlike an intrinsic size on ha-card, a wrapper <div>
         in a \`1fr 1fr\` grid or a \`flex: 1\` row still shrinks to its track instead of overflowing. */
      :host::before { content: ""; display: grid; grid-template-columns: minmax(0, 240px); height: 0; }
      ha-card { padding: 12px; overflow: hidden; container-type: inline-size; }
      ha-card.lvl-ok    { --c: var(--bm-ok); --ct: var(--bm-ok-text); }
      ha-card.lvl-warn  { --c: var(--bm-warn); --ct: var(--bm-warn-text); }
      ha-card.lvl-alert { --c: var(--bm-alert); --ct: var(--bm-alert-text); }

      /* The title and its pill take the room left; the icon buttons never shrink. */
      .head { display: flex; align-items: center; gap: 10px; min-width: 0; }
      .main { flex: 1 1 0; min-width: 0; display: flex; align-items: center; gap: 4px 10px; }
      .mt { flex: 1 1 0; min-width: 0; }
      .badge { flex: none; width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center;
               background: color-mix(in srgb, var(--c) 16%, transparent); color: var(--c); }
      .badge ha-icon { --mdc-icon-size: 24px; }
      .title { flex: 0 1 auto; min-width: min(100%, 8ch); font-size: 16px; font-weight: 500; color: var(--primary-text-color);
               white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .pill { flex: 0 1 auto; min-width: 0; max-width: 100%; overflow-wrap: anywhere;
              box-sizing: border-box; font-size: 11px; font-weight: 500; padding: 1px 8px; border-radius: 9px;
              color: var(--ct); background: color-mix(in srgb, var(--c) 14%, transparent); }
      .pt { display: block; }
      /* The pill right after the title, a dot in the status colour before its text. */
      .pill { display: inline-flex; align-items: center; gap: 4px; }
      .pill::before { content: ''; flex: none; width: 6px; height: 6px; border-radius: 50%; background: var(--c); }
      .pill .pt { min-width: 0; }
      /* The status pill: on the title row, 8 px after the title, only when the whole title and the pill's whole label fit
         there; otherwise on its own line under the subtitle, which then keeps one line; its dot alone at 200 px or less
         or when its label does not fit the title block (its text stays in its title and for screen readers). Measured
         after each render (_fitPill), in every language, never by a fixed width. */
      .title-row { display: flex; flex-wrap: nowrap; align-items: center; gap: 8px; min-width: 0; }
      .title-row > .title { flex: 0 1 auto; min-width: 0; }
      .title-row > .pill { flex: none; min-width: auto; max-width: none; overflow: visible; align-self: center; margin-top: 0; }
      .title-row > .pill .pt { min-width: auto; overflow: visible; white-space: nowrap; display: inline; -webkit-line-clamp: none; line-clamp: none; }
      .mt.pill-below { display: flex; flex-direction: column; align-items: stretch; }
      .mt.pill-below > * { order: 3; }
      .mt.pill-below > .title-row { display: contents; }
      .mt.pill-below > .sub { order: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .mt.pill-below > .title-row > .pill { order: 2; align-self: flex-start; margin-top: 2px; }
      .mt.pill-dot > .title-row > .pill { padding: 4px; gap: 0; }
      .mt.pill-dot > .title-row > .pill .dot { display: block; }
      .mt.pill-dot > .title-row > .pill .pt { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
      .notify { all: unset; cursor: pointer; flex: none; width: 26px; height: 26px; border-radius: 50%;
                display: grid; place-items: center; color: var(--secondary-text-color); }
      .notify:hover { background: color-mix(in srgb, var(--secondary-text-color) 14%, transparent); }
      .notify:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
      .notify ha-icon { --mdc-icon-size: 16px; }
      .notify[data-state='busy'] { cursor: progress; }
      .notify[data-state='busy'] ha-icon { animation: bm-spin 1s linear infinite; }
      .notify[data-state='done'] { color: var(--bm-ok-text); }
      .notify[data-state='error'] { color: var(--bm-alert-text); }
      .notify:disabled { cursor: default; opacity: .4; }
      .notify:disabled:hover { background: none; }
      .full { all: unset; cursor: pointer; flex: none; width: 24px; height: 24px; margin: -4px -4px -4px 0; border-radius: 50%;
              display: grid; place-items: center; color: var(--secondary-text-color); }
      .full:hover { background: color-mix(in srgb, var(--secondary-text-color) 14%, transparent); color: var(--primary-text-color); }
      .full:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
      .full ha-icon { --mdc-icon-size: 16px; }
      /* Mini card: the detail button, top right, like the full screen button it replaces while compact. */
      .zoom { all: unset; cursor: pointer; flex: none; width: 24px; height: 24px; margin: -4px -4px -4px 0; border-radius: 50%;
              display: grid; place-items: center; color: var(--secondary-text-color); }
      .zoom:hover { background: color-mix(in srgb, var(--secondary-text-color) 14%, transparent); color: var(--primary-text-color); }
      .zoom:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
      .zoom ha-icon { --mdc-icon-size: 16px; }
      /* The header icon of the mini card keeps the full card's size (40px), even narrow. */
      ha-card.mini .badge { display: grid; width: 40px; height: 40px; }
      /* Mini card: the expand / collapse button in the card's top right corner (24 px, round), the header's other
         buttons (full screen, notify now) on the same top line at its left; the header keeps clear of them. */
      ha-card:has(.zoom) { position: relative; }
      .head:has(> .zoom) { padding-right: 21px; }
      .head:has(> .zoom):has(.full, .notify) { padding-right: 49px; }
      .head:has(> .zoom):has(> .full):has(.notify) { padding-right: 77px; }
      .head > .zoom, .head:has(> .zoom) .full, .head:has(> .zoom) .notify {
        position: absolute; z-index: 2; top: 5px; width: 24px; height: 24px; margin: 0;
        background: color-mix(in srgb, var(--secondary-text-color) 10%, transparent); }
      .head > .zoom { right: 5px; }
      .head:has(> .zoom) .full, .head:has(> .zoom):not(:has(> .full)) .notify { right: 33px; }
      .head:has(> .zoom):has(> .full) .notify { right: 61px; }
      ha-card.mini .badge ha-icon { --mdc-icon-size: 24px; }

      /* Up to --cols columns, each at least 160px wide (or the whole card, if narrower): fewer columns when they do not fit */
      .list { display: grid; gap: 6px; margin-top: 8px;
              grid-template-columns: repeat(auto-fill, minmax(min(100%, max(160px, (100% - (var(--cols) - 1) * 6px) / var(--cols) - 0.5px)), 1fr)); }
      .row { --t: var(--bm-ok); --tt: var(--bm-ok-text); all: unset; box-sizing: border-box; cursor: pointer; min-width: 0;
             display: flex; align-items: center; gap: 8px; padding: 5px 10px 5px 5px; border-radius: 10px;
             background: var(--secondary-background-color, rgba(127,127,127,.08)); }
      .row.warn  { --t: var(--bm-warn); --tt: var(--bm-warn-text); }
      .row.alert  { --t: var(--bm-alert); --tt: var(--bm-alert-text); }
      .row.na .lvl { font-weight: 400; }
      /* Only the rows needing attention are tinted; an OK row keeps the neutral tile, its colour on the icon and the bar */
      .row.warn, .row.alert { background: color-mix(in srgb, var(--t) 12%, var(--secondary-background-color, transparent)); }
      .row.ok:hover { background: color-mix(in srgb, var(--secondary-text-color) 10%, var(--secondary-background-color, transparent)); }
      .row.warn:hover, .row.alert:hover { background: color-mix(in srgb, var(--t) 18%, var(--secondary-background-color, transparent)); }
      .row:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
      .ic { flex: none; width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center;
            color: var(--t); background: color-mix(in srgb, var(--t) 18%, transparent); }
      .ic ha-icon { --mdc-icon-size: 16px; }
      .row.due .ic { animation: bm-blink 1.5s ease-in-out infinite; }
      .txt { flex: 1; display: flex; flex-direction: column; min-width: 0; }
      .name { font-size: 13px; font-weight: 500; line-height: 1.2; color: var(--primary-text-color);
              white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .sub { font-size: 11px; line-height: 1.2; color: var(--secondary-text-color);
             white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .row.warn .sub, .row.alert .sub { color: var(--tt); }
      /* A status of several words (nl “Niet beschikbaar”) wraps rather than squeezing the name out of a narrow column;
         it never gets narrower than its longest word */
      .lvl { flex: 0 1 auto; max-width: 45%; min-width: min-content; text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 3px;
             font-size: 12px; font-weight: 500; color: var(--primary-text-color); font-variant-numeric: tabular-nums; }
      .row:not(.ok) .lvl { color: var(--tt); }
      .track { width: 44px; height: 4px; border-radius: 2px; overflow: hidden;
               background: color-mix(in srgb, var(--secondary-text-color) 22%, transparent); }
      .bar { display: block; height: 100%; border-radius: 2px; background: var(--t); }

      /* Narrow (a card of 6 columns, half a section on a phone): the spacing tightens and the badge shrinks. */
      @container (max-width: 240px) {
        .head { gap: 6px; }
        .main { column-gap: 6px; }
        .badge { width: 32px; height: 32px; }
        .badge ha-icon { --mdc-icon-size: 20px; }
      }
      /* Narrower still (half of a phone's section): the badge goes, its colour stays on the pill; each battery's
         level goes under its name, so that a status such as "Unavailable" no longer squeezes the name out. */
      @container (max-width: 180px) {
        .badge { display: none; }
        .row { display: grid; grid-template-columns: auto minmax(0, 1fr); column-gap: 8px; row-gap: 3px; }
        .ic { grid-row: span 2; }
        .lvl { max-width: none; min-width: 0; flex-direction: row; align-items: center; justify-content: flex-start;
               gap: 6px; text-align: left; overflow-wrap: anywhere; }
      }

      @keyframes bm-blink { 0%, 100% { opacity: 1 } 50% { opacity: .35 } }
      @keyframes bm-spin { to { transform: rotate(360deg) } }
      @media (prefers-reduced-motion: reduce) { .row.due .ic, .notify[data-state='busy'] ha-icon { animation: none; } }
      :host([hide-title]) .main .title { visibility: hidden; }
    `;
  }

  // The full screen layer: opaque over translucent themes, one column on a phone, groups in balanced columns wider.
  // The full screen layer: the backdrop, the scrolling sheet, the sticky header and its close button.
  static get popupStyles() {
    return `
      :host { all: initial; display: block; font-family: var(--paper-font-body1_-_font-family, var(--ha-font-family-body, Roboto, sans-serif));
              color: var(--primary-text-color); -webkit-font-smoothing: antialiased; }
      :host::before { content: none; }
      .backdrop { position: fixed; inset: 0; z-index: var(--bm-layer, 9999); background: rgba(0,0,0,.6);
                  -webkit-backdrop-filter: blur(24px); backdrop-filter: blur(24px); animation: bm-fade .2s ease-out both; }
      .sheet { position: absolute; inset: 0; overflow-y: auto; overscroll-behavior: contain; animation: bm-sheet .28s cubic-bezier(.2,.8,.2,1) both;
               background: linear-gradient(var(--card-background-color, #fff), var(--card-background-color, #fff)), var(--primary-background-color, #fafafa); }
      ha-card.popup { --ha-card-border-radius: 0; --ha-card-box-shadow: none; border-radius: 0; box-shadow: none; background: transparent; border: none;
                      min-height: 100%; box-sizing: border-box; max-width: 1800px; margin: 0 auto; overflow: visible;
                      padding: 0 max(16px, env(safe-area-inset-right)) max(24px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left)); }
      .popup .head { position: sticky; top: 0; z-index: 2; padding: max(10px, env(safe-area-inset-top)) 0 10px;
                     background: linear-gradient(var(--card-background-color, #fff), var(--card-background-color, #fff)), var(--primary-background-color, #fafafa); }
      .close { all: unset; cursor: pointer; flex: none; width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center;
               background: var(--secondary-background-color, rgba(128,128,128,.12)); color: var(--primary-text-color); }
      .close:hover { background: color-mix(in srgb, var(--primary-text-color) 14%, transparent); }
      .close:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
      @media (min-width: 760px) {
        ha-card.popup { padding-left: max(24px, env(safe-area-inset-left)); padding-right: max(24px, env(safe-area-inset-right)); }
      }
      @keyframes bm-fade { from { opacity: 0 } to { opacity: 1 } }
      @keyframes bm-sheet { from { opacity: 0; transform: translateY(24px) } to { opacity: 1; transform: none } }
      @media (prefers-reduced-motion: reduce) { .backdrop, .sheet { animation: none !important; } }
    `;
  }

  // The expanded card: the same content as the full screen, in an ordinary card.
  static get expandedStyles() {
    return `
      ha-card.expanded .head { padding-bottom: 6px; }
      ha-card.expanded .bar-top { margin: 0 0 14px; }
      @media (min-width: 760px) {
        ha-card.expanded .groups { columns: 2 300px; }
      }
    `;
  }

  // The full screen content, in the layer and in the expanded card: view tabs, what to replace, next replacement,
  // CSV export, battery groups.
  static get fullStyles() {
    return `
      .popup .title { font-size: 18px; }
      .tab:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
      .bar-top { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 20px; margin: 6px 0 16px; }
      .tabs { display: inline-flex; gap: 4px; padding: 3px; border-radius: 12px; background: var(--secondary-background-color, rgba(128,128,128,.1)); }
      .tab { all: unset; cursor: pointer; padding: 6px 14px; border-radius: 9px; font-size: 13px; font-weight: 500; color: var(--secondary-text-color); }
      .tab.on { background: color-mix(in srgb, var(--primary-color) 15%, transparent); color: var(--bm-primary-text); }
      .replace { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 12px; color: var(--secondary-text-color); }
      .rlabel { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 500; text-transform: uppercase;
                letter-spacing: .04em; color: var(--secondary-text-color); }
      .rlabel ha-icon { --mdc-icon-size: 16px; }
      .buy { padding: 2px 9px; border-radius: 999px; color: var(--primary-text-color);
             background: color-mix(in srgb, var(--bm-warn) 16%, transparent); }
      .buy b { color: var(--bm-warn-text); }
      .buy.unknown { background: color-mix(in srgb, var(--bm-na) 18%, transparent); }
      .buy.unknown b { color: var(--secondary-text-color); }
      .none { color: var(--bm-ok-text); font-weight: 500; }
      .next { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 12px; color: var(--secondary-text-color); }
      .nextb { all: unset; cursor: pointer; padding: 2px 9px; border-radius: 999px; color: var(--primary-text-color);
               background: color-mix(in srgb, var(--primary-color) 12%, transparent); }
      .nextb b { font-weight: 500; }
      .nextb:hover { background: color-mix(in srgb, var(--primary-color) 20%, transparent); }
      .csv { all: unset; cursor: pointer; margin-left: auto; display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 9px;
             font-size: 13px; font-weight: 500; color: var(--bm-primary-text); border: 1px solid color-mix(in srgb, var(--primary-color) 45%, transparent); }
      .csv:hover { background: color-mix(in srgb, var(--primary-color) 10%, transparent); }
      .csv ha-icon { --mdc-icon-size: 16px; }
      .nextb:focus-visible, .csv:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }

      .groups { display: flex; flex-direction: column; gap: 18px; }
      .group { display: flex; flex-direction: column; gap: 6px; }
      .ghead { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 500; color: var(--primary-text-color); }
      .ghead ha-icon { --mdc-icon-size: 18px; color: var(--secondary-text-color); }
      .gname { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .gchip { font-size: 11px; padding: 1px 8px; border-radius: 999px; color: var(--bm-warn-text);
               background: color-mix(in srgb, var(--bm-warn) 14%, transparent); }
      .gcount { font-size: 11px; font-weight: 400; color: var(--secondary-text-color); }
      .ghint { font-size: 11px; color: var(--secondary-text-color); margin-top: -2px; }
      .glist { display: grid; gap: 6px; }
      @media (min-width: 760px) {
        .groups { display: block; columns: 2 320px; column-gap: 28px; }
        .group { break-inside: avoid; margin-bottom: 20px; }
      }
      @media (min-width: 1200px) { .groups { columns: 3 320px; } }
      @media (min-width: 1600px) { .groups { columns: 4 320px; } }
    `;
  }
}
