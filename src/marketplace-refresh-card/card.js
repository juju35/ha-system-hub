import { HR_DOMAIN, HR_PREFIX, MR_RATE_LOW } from "./core.js";
import { HR_DEFAULTS, HR_FOCUS, MR_PILL, hrDevices, hrEsc, hrLang, hrLocale, hrMarketplaceUpdates, hrPlural, hrSystemUpdates, hrT } from "./i18n-helpers.js";
import { shBanner, shbIsNight } from "./illustrated-header.js";

export class MarketplaceRefreshCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement('sh-marketplace-card-editor');
  }

  static getStubConfig() {
    return {};
  }

  setConfig(config) {
    this.connectedWhileHidden = true;
    this._config = { ...HR_DEFAULTS, ...config };
    // show_title / show_subtitle: the header's title / subtitle, hidden by the stylesheet
    this.toggleAttribute?.('hide-title', config.show_title === false);
    this.toggleAttribute?.('hide-subtitle', config.show_subtitle === false);
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    this._sig = null;
    this._render();
  }

  set hass(hass) {
    const old = this._hass;
    this._hass = hass;
    // Nothing the card shows changed: the same state objects, registry, language and minute ("3 min ago").
    const watched = this._watched;
    if (
      old &&
      this._sig &&
      watched &&
      hass.entities === old.entities &&
      watched.every((id) => hass.states[id] === old.states[id]) &&
      hrLocale(hass, this._config) === hrLocale(old, this._config) &&
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

  connectedCallback() {
    this._watchPill();
  }

  disconnectedCallback() {
    this._unwatchPill();
  }

  // The status pill goes on the title row, right after the title, only when the whole title and the pill's whole
  // label fit there; otherwise it takes its own line under the subtitle (the subtitle then on one line). Its dot
  // alone on a card 200 px wide or less, or when its label is wider than the title block (or, in a banner, would not
  // fit above the ground strip). Measured after each render and on every new width (or once the web font is loaded),
  // never by a fixed width; $MR_PILL names the parts.
  _fitPill() {
    const S = MR_PILL;
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

  getGridOptions() {
    return { columns: 12, min_columns: 6, rows: 'auto' };
  }

  // An update entity without a title: its device's name (the repository) rather than its friendly_name, which can be
  // the entity's own name alone ("Update", "Firmware") with the newer entity naming.
  _deviceName(id) {
    const deviceId = this._hass.entities?.[id]?.device_id;
    const device = deviceId && this._hass.devices?.[deviceId];
    return device ? device.name_by_user || device.name || '' : '';
  }

  _t(key, vars) {
    return hrT(hrLang(this._hass, this._config), key, vars);
  }

  _n(key, n) {
    return hrPlural(hrLang(this._hass, this._config), hrLocale(this._hass, this._config), key, n);
  }

  // "3 hours ago", "in 21 hours"… in the card's language.
  _relative(iso) {
    const t = new Date(iso).getTime();
    if (!Number.isFinite(t)) return '';
    const m = (t - Date.now()) / 60000;
    let rtf;
    try {
      rtf = new Intl.RelativeTimeFormat(hrLocale(this._hass, this._config), { numeric: 'auto' });
    } catch {
      return new Date(t).toISOString();
    }
    // Rounded to the nearest unit: a check due in 20 h 59 min reads "in 21 hours".
    const a = Math.abs(m);
    if (a < 1) return rtf.format(0, 'second');
    if (a < 59.5) return rtf.format(Math.round(m), 'minute');
    if (a < 2850) return rtf.format(Math.round(m / 60), 'hour');
    return rtf.format(Math.round(m / 1440), 'day');
  }

  _absolute(iso) {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return '';
    try {
      return d.toLocaleString(hrLocale(this._hass, this._config), { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
      return d.toISOString();
    }
  }

  // The integration's entities (cached per registry object, never when empty) and the Marketplace's update entities.
  _lookup() {
    const registry = this._hass.entities;
    if (!this._reg || this._reg.registry !== registry) {
      const devices = hrDevices(registry);
      this._reg = Object.keys(devices).length ? { registry, devices, updates: hrMarketplaceUpdates(registry), system: hrSystemUpdates(registry) } : null;
    }
    const devices = this._reg?.devices || {};
    const updates = this._reg?.updates || [];
    const system = this._reg?.system || [];
    let status = this._config.entity;
    // An entity that no longer exists (one of the old Marketplace Refresh integration, say): the module's own is found.
    if (status && !this._hass.states[status]) status = null;
    if (!status) status = Object.values(devices).map((d) => d.status).find((id) => this._hass.states[id]);
    if (!status) return { updates, system };
    // Any of the device's entities (the Last check sensor, the button) leads to its status sensor.
    const device = Object.values(devices).find((d) => Object.values(d).includes(status));
    return device?.status ? { ...device, updates, system } : { ...device, status, updates, system };
  }

  // GitHub's rate limit as the last check read it: a line when it is low enough to hold the checks back (under
  // 1,500 left: the Marketplace keeps a reserve of 1,000), until it resets. Nothing once reset or unknown.
  _rateLow(a) {
    const left = a.rate_limit_remaining;
    const reset = a.rate_limit_reset && new Date(a.rate_limit_reset).getTime();
    if (typeof left !== 'number' || left >= MR_RATE_LOW || !reset || reset <= Date.now()) return '';
    return `<div class="rate"><ha-icon icon="mdi:speedometer-slow"></ha-icon><span>${hrEsc(this._t('rate_low', { n: left, d: this._relative(a.rate_limit_reset) }))}</span></div>`;
  }

  _render() {
    if (!this._config || !this._hass || !this.shadowRoot) return;
    const c = this._config;
    const ids = this._lookup();
    const states = this._hass.states;
    const raw = ids.status && states[ids.status];
    // Unavailable or unknown (entry not loaded, setup retry, restored state): nothing to read from it.
    const unavailable = !!raw && ['unavailable', 'unknown'].includes(raw.state);
    const st = unavailable ? null : raw;
    const lastSt = ids.last_check && states[ids.last_check];
    const buttonSt = ids.button && states[ids.button];
    const systemIds = c.show_system_updates ? ids.system : [];
    this._watched = [ids.status, ids.last_check, ids.button, ...ids.updates, ...systemIds].filter(Boolean);
    this._ids = ids;

    const minute = Math.floor(Date.now() / 60000);
    this._sigMinute = minute;
    const updateStates = ids.updates.map((id) => states[id]).filter((s) => s?.state === 'on');
    // Every update entity's state, not only the ones on: one coming back from unavailable changes the count.
    const updateSig = ids.updates.map((id) => states[id]?.state);
    const systemStates = systemIds.map((id) => states[id]).filter((s) => s?.state === 'on');
    const admin = !!this._hass.user?.is_admin;
    const sig = JSON.stringify([c, shbIsNight(this._hass, c), hrLocale(this._hass, c), ids, raw, lastSt, buttonSt?.state, updateStates, updateSig, systemStates, minute, admin, !!this._confirm]);
    if (sig === this._sig) return;
    this._sig = sig;

    const a = st?.attributes || {};
    const running = st?.state === 'running';
    // Without a GitHub account connected, the last check only read the catalog: the repositories added from a link
    // are in `not_checked`, listed with the failed ones and explained once under them.
    const notChecked = Array.isArray(a.not_checked) ? a.not_checked : [];
    const failed = [...(Array.isArray(a.failed) ? a.failed : []), ...notChecked];
    const installing = Array.isArray(a.installing) ? a.installing : [];
    const installFailed = Array.isArray(a.install_failed) ? a.install_failed : [];
    const noGithub = notChecked.length > 0;
    const error = st?.state === 'error' ? a.error || this._t('error') : null;
    // The update entities are the truth; the sensor's count is the fallback when the Marketplace's entities aren't there.
    const updates = updateStates
      .map((s) => ({
        id: s.entity_id,
        title: s.attributes.title || this._deviceName(s.entity_id) || s.attributes.friendly_name || s.entity_id,
        from: s.attributes.installed_version,
        to: s.attributes.latest_version,
        picture: s.attributes.entity_picture,
      }))
      .sort((x, y) => String(x.title).localeCompare(String(y.title)));
    // The Marketplace not loaded (setup retry, disabled): its entities are unavailable or gone, so they say nothing.
    const known = ids.updates.some((id) => ['on', 'off'].includes(states[id]?.state));
    const count = known ? updates.length : Number(a.updates) || 0;
    // Home Assistant, the apps first (the Supervisor's), then the devices and services; installed from their own dialog.
    const system = systemStates
      .map((s) => ({
        id: s.entity_id,
        title: s.attributes.title || this._deviceName(s.entity_id) || s.attributes.friendly_name || s.entity_id,
        from: s.attributes.installed_version,
        to: s.attributes.latest_version,
        picture: s.attributes.entity_picture,
        busy: !!s.attributes.in_progress,
        hassio: this._hass.entities?.[s.entity_id]?.platform === 'hassio',
      }))
      .sort((x, y) => Number(y.hassio) - Number(x.hassio) || String(x.title).localeCompare(String(y.title)));
    const total = count + system.length;
    const level = !st ? 'na' : error ? 'alert' : failed.length || installFailed.length ? 'warn' : running || installing.length || total ? 'info' : 'ok';

    const hidden = c.hide_when_ok && st && level === 'ok' && !this._editMode && !this._preview;
    this._setHidden(hidden);
    if (hidden) return;

    const shownUpdates = c.show_updates && st ? updates : [];
    this._rows = shownUpdates.length + (st ? system.length : 0) + (c.show_failed ? failed.length + installFailed.length : 0);
    // Installed from the card: what it lists (and the confirmation counts) is what gets installed.
    this._installable = st && admin && c.install_button && !installing.length ? updates.map((u) => u.id) : [];
    if (!this._installable.length) this._confirm = false;

    const last = lastSt && !['unknown', 'unavailable'].includes(lastSt.state) ? lastSt.state : null;
    // A check already due (overdue, or retried within the hour while the Marketplace is unavailable) has no "next" to show.
    const nextAt = lastSt?.attributes?.next_check;
    const next = nextAt && new Date(nextAt).getTime() > Date.now() ? nextAt : null;
    const interval = lastSt?.attributes?.scan_interval;
    const subtitle = !st
      ? ''
      : [
          last ? this._t('checked', { d: this._relative(last) }) : this._t('never_checked'),
          // show_next_check: false keeps the subtitle short on a phone, where it is cut (#137).
          interval === 0 ? this._t('auto_off') : next && c.show_next_check !== false ? this._t('next', { d: this._relative(next) }) : '',
        ]
          .filter(Boolean)
          .join(' · ');
    const icon = { ok: 'mdi:package-variant-closed-check', info: 'mdi:package-up', warn: 'mdi:package-variant-closed-remove', alert: 'mdi:alert-circle-outline', na: 'mdi:package-variant-closed' }[level];
    const pct = running && a.total ? Math.round((100 * (a.done || 0)) / a.total) : 0;

    // innerHTML replaces the focused element: give the focus back to its new copy afterwards, without scrolling the
    // page (a hass update re-renders the card while the user may have scrolled it out of view).
    const active = this.shadowRoot.activeElement;
    const focusCls = ['check', 'install', 'confirm-yes', 'confirm-no'].find((k) => active?.classList?.contains(k));
    const focus = focusCls || (active?.dataset?.id ? { id: active.dataset.id } : null);
    // The button is also unavailable while updates are installed: grey it out right away, without waiting for its state.
    this._busy = running || installing.length > 0 || buttonSt?.state === 'unavailable';
    this.shadowRoot.innerHTML = shBanner(`
      <style>${MarketplaceRefreshCard.styles}</style>
      <ha-card class="lvl-${level}">
        <div class="head">
          <div class="badge"><ha-icon icon="${icon}"></ha-icon></div>
          <div class="heading">
            <div class="title-row"><div class="title">${hrEsc(c.title || this._t('title'))}</div>${this._pill(unavailable ? this._t('unavailable') : this._status(st, running, a, total, failed, error, installing))}</div>
            ${subtitle ? `<div class="subtitle" title="${hrEsc(last ? this._absolute(last) : '')}">${hrEsc(subtitle)}</div>` : ''}
          </div>
          ${this._checkButton(this._busy)}
        </div>
        ${this._confirm ? this._confirmBox(this._installable.length) : ''}
        ${running ? `<div class="progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div>` : ''}
        ${this._rateLow(a)}
        ${c.show_failed && error ? `<div class="error"><ha-icon icon="mdi:alert-circle-outline"></ha-icon><span><b>${hrEsc(this._t('error_title'))}</b><br>${hrEsc(error)}</span></div>` : ''}
        ${st && system.length ? this._section('system_title', system.map((u) => this._updateRow(u, u.busy)).join(''), system.length) : ''}
        ${
          // No update: no section (the pill already says "Up to date").
          c.show_updates && st && count
            ? this._section(
                'updates_title',
                shownUpdates.length
                  ? shownUpdates.map((u) => this._updateRow(u, installing.includes(u.id))).join('')
                  : `<div class="empty">${hrEsc(this._t('no_details'))}</div>`,
                count,
                this._installButton(installing),
              )
            : ''
        }
        ${c.show_failed && failed.length ? this._section('failed_title', failed.map((f) => this._failedRow(f)).join('') + (noGithub ? `<div class="empty">${hrEsc(this._t('no_github'))}</div>` : '')) : ''}
        ${c.show_failed && installFailed.length ? this._section('install_failed_title', installFailed.map((f) => this._failedRow(f)).join('')) : ''}
      </ha-card>`, { hass: this._hass, config: this._config, scene: 'marketplace', pad: '12px' });

    const check = this.shadowRoot.querySelector('.check');
    check?.addEventListener('click', () => this._check());
    if (focus === 'check') check?.focus(HR_FOCUS);
    const on = (cls, fn) => {
      const el = this.shadowRoot.querySelector(`.${cls}`);
      el?.addEventListener('click', fn);
      if (focus === cls) el?.focus(HR_FOCUS);
    };
    on('install', () => this._askInstall());
    on('confirm-yes', () => this._install());
    on('confirm-no', () => this._setConfirm(false));
    for (const el of this.shadowRoot.querySelectorAll('.row[data-id]')) {
      el.addEventListener('click', () => this._moreInfo(el.dataset.id));
      if (focus?.id === el.dataset.id) el.focus(HR_FOCUS);
    }
    // A repository picture that doesn't load falls back to the generic icon.
    for (const img of this.shadowRoot.querySelectorAll('img.pic')) {
      img.addEventListener('error', () => img.parentElement?.classList.add('nopic'), { once: true });
    }
    if (this.isConnected) this._fitPill();
  }

  // The status pill: only its dot when its label doesn't fit in the header (the text stays for screen readers and in
  // the tooltip).
  _pill(text) {
    const t = hrEsc(text);
    return `<div class="pill" title="${t}"><span class="dot" aria-hidden="true"></span><span class="ptext">${t}</span></div>`;
  }

  _status(st, running, a, count, failed, error, installing = []) {
    if (!st) return this._t('not_loaded');
    if (running) return a.total ? this._t('checking', { done: a.done || 0, total: a.total }) : this._t('checking_short');
    if (installing.length) return this._n('installing', installing.length);
    if (error) return this._t('error');
    const parts = [];
    if (count) parts.push(this._n('updates', count));
    if (failed.length) parts.push(this._n('failed', failed.length));
    return parts.length ? parts.join(' · ') : this._t('up_to_date');
  }

  _checkButton(busy) {
    if (!this._config.check_button || !this._ids.button) return '';
    const label = hrEsc(this._t('check_now'));
    // aria-disabled rather than disabled: a disabled button would drop the keyboard focus while checking.
    return `<button class="check" title="${label}" aria-label="${label}"${busy ? ' aria-disabled="true"' : ''}><ha-icon icon="mdi:refresh"></ha-icon></button>`;
  }

  _check() {
    if (this._ids.button && !this._busy) this._hass.callService('button', 'press', { entity_id: this._ids.button });
  }

  // The updates section's button: "Update all (n)", or the installs' progress while they run.
  _installButton(installing) {
    if (installing.length) {
      return `<span class="install busy" aria-live="polite"><ha-icon icon="mdi:progress-download"></ha-icon><span class="ilabel">${hrEsc(this._t('installing_short'))}</span></span>`;
    }
    const n = this._installable.length;
    if (!n) return '';
    const label = hrEsc(this._t('install_all', { n }));
    return `<button class="install"${this._confirm ? ' aria-expanded="true"' : ''}><ha-icon icon="mdi:package-down"></ha-icon><span class="ilabel">${label}</span></button>`;
  }

  // Confirmation at the top of the card, like the other cards' popups.
  _confirmBox(n) {
    const ask = hrEsc(this._n('confirm', n));
    return `
        <div class="confirm" role="alertdialog" aria-label="${ask}">
          <ha-icon icon="mdi:package-down"></ha-icon>
          <span class="ctext"><b>${ask}</b><br>${hrEsc(this._t('confirm_hint'))}</span>
          <span class="cbtns">
            <button class="confirm-no">${hrEsc(this._t('cancel'))}</button>
            <button class="confirm-yes">${hrEsc(this._t('install'))}</button>
          </span>
        </div>`;
  }

  _setConfirm(on) {
    this._confirm = on;
    this._sig = null;
    this._render();
    // Keyboard focus on the safe choice when it opens, back on the button when it closes.
    this.shadowRoot?.querySelector(on ? '.confirm-no' : '.install')?.focus?.(HR_FOCUS);
  }

  _askInstall() {
    if (this._installable.length) this._setConfirm(true);
  }

  _install() {
    const ids = this._installable;
    this._setConfirm(false);
    if (!ids.length) return;
    // Home Assistant shows the error of a failed call; nothing more to do with it here.
    Promise.resolve(this._hass.callService(HR_DOMAIN, `${HR_PREFIX}install_updates`, { entity_id: ids })).catch(() => {});
  }

  _moreInfo(entityId) {
    const ev = new Event('hass-more-info', { bubbles: true, composed: true });
    ev.detail = { entityId };
    this.dispatchEvent(ev);
  }

  // A section, with its number of items in the title ("Updates available · 3") and an action on its right.
  _section(key, body, count = 0, action = '') {
    const n = count ? ` <span class="count">· ${count}</span>` : '';
    return `<div class="section"><div class="shead"><div class="stitle">${hrEsc(this._t(key))}${n}</div>${action}</div><div class="list">${body}</div></div>`;
  }

  // A brand image of Home Assistant (/api/brands/…) needs its access token, read once (brands/access_token)
  _picture(url) {
    if (!url) return null;
    if (!url.startsWith('/api/brands/')) return url;
    if (this._brandsToken === undefined && this._hass?.callWS) {
      this._brandsToken = null;
      this._hass
        .callWS({ type: 'brands/access_token' })
        .then((res) => {
          this._brandsToken = res?.token || '';
          this._render?.();
        })
        .catch(() => {
          this._brandsToken = '';
        });
    }
    if (!this._brandsToken) return this._brandsToken === '' ? url : null;
    return `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(this._brandsToken)}`;
  }

  _updateRow(u, busy = false) {
    const version = u.from && u.to ? this._t('version', { from: u.from, to: u.to }) : u.to || '';
    const picture = this._picture(u.picture);
    const pic = picture && !busy ? `<img class="pic" src="${hrEsc(picture)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '';
    return `
          <button class="row upd${busy ? ' busy' : ''}" data-id="${hrEsc(u.id)}" title="${hrEsc(u.title)}">
            <span class="ic${pic ? '' : ' nopic'}">${pic}<ha-icon icon="${busy ? 'mdi:progress-download' : 'mdi:package-up'}"></ha-icon></span>
            <span class="txt">
              <span class="name">${hrEsc(u.title)}</span>
              ${version ? `<span class="sub">${hrEsc(version)}</span>` : ''}
            </span>
            <ha-icon class="chev" icon="mdi:chevron-right"></ha-icon>
          </button>`;
  }

  // "owner/repo" or "owner/repo: the error".
  _failedRow(f) {
    const text = String(f);
    const i = text.indexOf(': ');
    const name = i > 0 ? text.slice(0, i) : text;
    const why = i > 0 ? text.slice(i + 2) : '';
    return `
          <div class="row warn" title="${hrEsc(text)}">
            <span class="ic nopic"><ha-icon icon="mdi:alert-outline"></ha-icon></span>
            <span class="txt">
              <span class="name">${hrEsc(name)}</span>
              ${why ? `<span class="sub">${hrEsc(why)}</span>` : ''}
            </span>
          </div>`;
  }

  static get styles() {
    return `
      :host([hidden]) { display: none !important; }
      /* Home Assistant's <ha-icon> is inline: as a box of its own, its icon is centred in its badge */
      ha-icon { display: inline-flex; align-items: center; justify-content: center; vertical-align: middle; line-height: 0; }
      :host {
        --hr-ok: var(--success-color, #43a047);
        --hr-info: var(--info-color, #039be5);
        --hr-warn: var(--warning-color, #ffa600);
        --hr-alert: var(--error-color, #db4437);
        --hr-na: var(--disabled-color, #9e9e9e);
        /* A block that a flex or grid parent may shrink (the card has no minimum width of its own). */
        display: block;
        min-width: 0;
      }
      /* Text and status icons in a state colour are mixed with the text colour: darker on a light theme,
         lighter on a dark one, so they stay readable (4.5:1 for text, 3:1 for icons) on their tinted background. */
      /* A size container: the header's pill turns into a dot on a narrow card. */
      ha-card { padding: 12px; overflow: hidden; container-type: inline-size; }
      /* A size container has no width of its own content: in a parent that sizes to its content (an inline-block, an
         "auto" grid column, some layout-card set-ups) the card would fall to its padding. This empty, zero-height grid
         gives it a natural (max-content) width without any minimum (its min-content width is 0): in a "1fr 1fr" grid,
         wrapped in a div or not, the card still shrinks to its track. contain-intrinsic-inline-size or a min-width on
         the host would be a minimum and overflow there. */
      :host::before { content: ""; display: grid; grid-template-columns: minmax(0, 322px); height: 0; }
      ha-card.lvl-ok    { --c: var(--hr-ok); }
      ha-card.lvl-info  { --c: var(--hr-info); }
      ha-card.lvl-warn  { --c: var(--hr-warn); }
      ha-card.lvl-alert { --c: var(--hr-alert); }
      ha-card.lvl-na    { --c: var(--hr-na); }

      .head { position: relative; display: flex; align-items: center; gap: 10px; }
      .badge { flex: none; width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center;
               background: color-mix(in srgb, var(--c) 16%, transparent); color: color-mix(in srgb, var(--c) 55%, var(--primary-text-color, #212121)); }
      .badge ha-icon { --mdc-icon-size: 24px; }
      /* The title takes the room left (a long subtitle never squeezes the pill) and keeps about four characters;
         the buttons never shrink, the pill keeps its whole label and is only truncated when there is really no room. */
      .heading { flex: 1 1 0%; min-width: 6ch; font-size: 16px; display: flex; flex-direction: column; }
      .title { font-size: 16px; font-weight: 500; line-height: 1.25; color: var(--primary-text-color);
               white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .subtitle { font-size: 12px; line-height: 1.3; color: var(--secondary-text-color);
                  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .pill { position: relative; flex: 0 1 auto; min-width: 0; box-sizing: border-box; display: flex; align-items: center; gap: 5px;
              font-size: 11px; font-weight: 500; padding: 1px 8px; border-radius: 999px;
              color: color-mix(in srgb, var(--c) 40%, var(--primary-text-color, #212121));
              background: color-mix(in srgb, var(--c) 14%, transparent); font-variant-numeric: tabular-nums; }
      .ptext { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .dot { display: block; flex: none; width: 6px; height: 6px; border-radius: 50%; background: var(--c); }
      /* A dot in the status colour before the pill's words; 8 px gaps and a slimmer pill under 324 px; on a phone's
         6 columns (156-194 px) a smaller badge. */
      /* The status pill: on the title row, 8 px after the title, only when the whole title and the pill's whole label fit
         there; otherwise on its own line under the subtitle, which then keeps one line; its dot alone at 200 px or less
         or when its label does not fit the title block (its text stays in its title and for screen readers). Measured
         after each render (_fitPill), in every language, never by a fixed width. */
      .title-row { display: flex; flex-wrap: nowrap; align-items: center; gap: 8px; min-width: 0; }
      .title-row > .title { flex: 0 1 auto; min-width: 0; }
      .title-row > .pill { flex: none; min-width: auto; max-width: none; overflow: visible; align-self: center; margin-top: 0; }
      .title-row > .pill .ptext { min-width: auto; overflow: visible; white-space: nowrap; display: inline; -webkit-line-clamp: none; line-clamp: none; }
      .heading.pill-below { display: flex; flex-direction: column; align-items: stretch; }
      .heading.pill-below > * { order: 3; }
      .heading.pill-below > .title-row { display: contents; }
      .heading.pill-below > .subtitle { order: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .heading.pill-below > .title-row > .pill { order: 2; align-self: flex-start; margin-top: 2px; }
      .heading.pill-dot > .title-row > .pill { padding: 4px; gap: 0; }
      .heading.pill-dot > .title-row > .pill .dot { display: block; }
      .heading.pill-dot > .title-row > .pill .ptext { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
      @container (max-width: 300px) { .head { gap: 8px; } .pill { padding: 1px 6px; } }
      @container (max-width: 170px) {
        .badge { width: 32px; height: 32px; }
        .badge ha-icon { --mdc-icon-size: 20px; }
      }
      .check { all: unset; cursor: pointer; flex: none; width: 26px; height: 26px; border-radius: 50%;
               display: grid; place-items: center; color: var(--secondary-text-color); }
      .check:hover { background: color-mix(in srgb, var(--secondary-text-color) 14%, transparent); color: var(--primary-text-color); }
      .check:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
      .check[aria-disabled="true"] { cursor: default; opacity: .4; background: none; color: var(--secondary-text-color); }
      .check ha-icon { --mdc-icon-size: 16px; }

      .progress { height: 4px; margin-top: 10px; border-radius: 2px; overflow: hidden;
                  background: color-mix(in srgb, var(--secondary-text-color) 22%, transparent); }
      .progress span { display: block; height: 100%; border-radius: 2px; background: var(--c); }

      .rate { display: flex; gap: 8px; align-items: center; margin-top: 10px; font-size: 12px; color: var(--secondary-text-color); }
      .rate ha-icon { --mdc-icon-size: 16px; flex: none; color: var(--warning-color, #ffa600); }
      .error { display: flex; gap: 8px; align-items: flex-start; margin-top: 10px; padding: 8px 10px; border-radius: 10px;
               font-size: 12px; line-height: 1.35; color: var(--primary-text-color);
               background: color-mix(in srgb, var(--hr-alert) 12%, var(--secondary-background-color, transparent)); }
      .error ha-icon { --mdc-icon-size: 18px; color: color-mix(in srgb, var(--hr-alert) 55%, var(--primary-text-color, #212121)); flex: none; }
      .error b { font-weight: 500; color: color-mix(in srgb, var(--hr-alert) 40%, var(--primary-text-color, #212121)); }
      .error span { min-width: 0; overflow-wrap: anywhere; }

      .section { margin-top: 12px; }
      /* The section's button goes under its title when both don't fit on one line. */
      .shead { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px 8px; margin: 0 2px 6px; min-height: 24px; }
      .stitle { min-width: 0; font-size: 12px; font-weight: 500; color: var(--secondary-text-color);
                text-transform: uppercase; letter-spacing: .04em; }
      .stitle .count { font-variant-numeric: tabular-nums; }
      /* No filled button: a tinted outline, the accent colour for the text. */
      .install, .cbtns button { all: unset; box-sizing: border-box; cursor: pointer; flex: none; display: inline-flex; align-items: center; gap: 4px;
               font-size: 12px; font-weight: 500; line-height: 1; padding: 5px 10px; border-radius: 999px; font-variant-numeric: tabular-nums;
               color: color-mix(in srgb, var(--hr-info) 45%, var(--primary-text-color, #212121));
               border: 1px solid color-mix(in srgb, var(--hr-info) 45%, transparent); }
      .install ha-icon { --mdc-icon-size: 16px; flex: none; }
      /* On its own line under the section title, it never gets wider than the card. */
      .install { max-width: 100%; }
      .ilabel { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      button.install:hover, .cbtns button:hover { background: color-mix(in srgb, var(--hr-info) 12%, transparent); }
      .install:focus-visible, .cbtns button:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
      .install.busy { cursor: default; border-color: transparent; color: var(--secondary-text-color); }
      .cbtns .confirm-no { color: var(--secondary-text-color); border-color: color-mix(in srgb, var(--secondary-text-color) 40%, transparent); }
      .cbtns .confirm-no:hover { background: color-mix(in srgb, var(--secondary-text-color) 12%, transparent); }

      .confirm { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; margin-top: 10px; padding: 8px 10px; border-radius: 10px;
                 font-size: 12px; line-height: 1.35; color: var(--primary-text-color);
                 background: color-mix(in srgb, var(--hr-info) 12%, var(--secondary-background-color, transparent)); }
      .confirm > ha-icon { --mdc-icon-size: 18px; flex: none; color: color-mix(in srgb, var(--hr-info) 55%, var(--primary-text-color, #212121)); }
      .confirm b { font-weight: 500; }
      .ctext { flex: 1 1 180px; min-width: 0; }
      .cbtns { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; margin-left: auto; max-width: 100%; }
      .row.busy .ic { color: color-mix(in srgb, var(--hr-info) 55%, var(--primary-text-color, #212121)); }
      .row.busy .ic ha-icon { animation: hr-pulse 1.2s ease-in-out infinite; }
      @keyframes hr-pulse { 50% { opacity: .35; } }
      @media (prefers-reduced-motion: reduce) { .row.busy .ic ha-icon { animation: none; } }
      .list { display: flex; flex-direction: column; gap: 6px; }
      .empty { font-size: 13px; color: var(--secondary-text-color); padding: 8px 10px; border-radius: 10px;
               background: var(--secondary-background-color, rgba(127,127,127,.08)); }
      .row { --t: var(--hr-info); all: unset; box-sizing: border-box; min-width: 0;
             display: flex; align-items: center; gap: 8px; padding: 5px 8px 5px 5px; border-radius: 10px;
             background: var(--secondary-background-color, rgba(127,127,127,.08)); }
      .row.warn { --t: var(--hr-warn); background: color-mix(in srgb, var(--t) 12%, var(--secondary-background-color, transparent)); }
      button.row { cursor: pointer; }
      button.row:hover { background: color-mix(in srgb, var(--t) 14%, var(--secondary-background-color, transparent)); }
      .row:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
      .ic { position: relative; flex: none; width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center;
            color: color-mix(in srgb, var(--t) 55%, var(--primary-text-color, #212121));
            background: color-mix(in srgb, var(--t) 18%, transparent); overflow: hidden; }
      .ic ha-icon { --mdc-icon-size: 16px; }
      .ic img.pic { position: absolute; inset: 5px; width: 18px; height: 18px; object-fit: contain; }
      .ic:not(.nopic) img.pic + ha-icon { visibility: hidden; }
      .ic.nopic img.pic { display: none; }
      .txt { flex: 1; display: flex; flex-direction: column; min-width: 0; }
      .name { font-size: 13px; font-weight: 500; line-height: 1.2; color: var(--primary-text-color);
              white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .sub { font-size: 11px; line-height: 1.2; color: var(--secondary-text-color); font-variant-numeric: tabular-nums;
             white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .row.warn .sub { color: color-mix(in srgb, var(--t) 40%, var(--primary-text-color, #212121)); }
      .chev { flex: none; --mdc-icon-size: 18px; color: var(--secondary-text-color); }
      /* A phone's 6 columns (156-200 px card): the version ("v1.13.0 →" / "v1.14.1"), an error and the section's button go
         on two lines instead of being cut. */
      @container (max-width: 200px) {
        .sub { white-space: normal; overflow-wrap: anywhere; }
        .ilabel { white-space: normal; overflow-wrap: anywhere; }
        .install { border-radius: 12px; line-height: 1.2; }
      }
      :host([hide-title]) .heading .title, :host([hide-subtitle]) .heading > .subtitle { display: none; }
    `;
  }
}
