import { SC_DEFAULTS, SC_MAX_ITEMS, SC_PANEL, SC_PILL, SC_READ_MS, scEsc, scLang, scLocale, scPoints, scT } from "./i18n-helpers.js";
import { shBanner, shbIsNight } from "./illustrated-header.js";
import { scHoldUnderPress, scKeepsFocus } from "./mini-card.js";
import { SC_I18N } from "./i18n/sc-i18n.js";

// security-card: what needs a look in the Security module, the worst first (refused logins from the Internet, add-ons
// not protected, administrators without 2FA, new outbound hosts, unused tokens, credentials in clear), then a line
// telling the rest is in order. Every row opens the panel's Security tab. Read from system_hub/security, which is for
// administrators only: the other users get a short notice.
export class SecurityCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement('sh-security-card-editor');
  }

  static getStubConfig() {
    return {};
  }

  setConfig(config) {
    const max = config?.max_items;
    if (max != null && (!Number.isInteger(max) || max < 1 || max > SC_MAX_ITEMS)) throw new Error(`max_items must be a whole number from 1 to ${SC_MAX_ITEMS}`);
    this.connectedWhileHidden = true;
    this._config = { ...SC_DEFAULTS, ...config };
    // show_title / show_subtitle: the header's title / subtitle, hidden by the stylesheet
    this.toggleAttribute?.('hide-title', config.show_title === false);
    this.toggleAttribute?.('hide-subtitle', config.show_subtitle === false);
    if (!this.shadowRoot) {
      this.attachShadow({ mode: 'open' });
      scHoldUnderPress(this, () => this._render());
    }
    this._sig = null;
    this._render();
  }

  connectedCallback() {
    // Read again every 5 minutes while on the page
    clearInterval(this._timer);
    this._timer = setInterval(() => this._read(), SC_READ_MS);
    if (this._hass && this._config) this._read();
  }

  disconnectedCallback() {
    clearInterval(this._timer);
    this._timer = null;
    this._unwatchPill();
  }

  /* jscpd:ignore-start */
  // The status pill goes on the title row, right after the title, only when the whole title and the pill's whole
  // label fit there; otherwise it takes its own line under the subtitle (the subtitle then on one line). Its dot
  // alone on a card 200 px wide or less, or when its label is wider than the title block (or, in a banner, would not
  // fit above the ground strip). Measured after each render and on every new width (or once the web font is loaded),
  // never by a fixed width; $SC_PILL names the parts.
  _fitPill() {
    const S = SC_PILL;
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
  /* jscpd:ignore-end */

  set hass(hass) {
    this._watchPill();
    const old = this._hass;
    this._hass = hass;
    // First Home Assistant object, or another user: read now. Otherwise the timer reads again.
    if (!old || old.user?.id !== hass.user?.id || old.user?.is_admin !== hass.user?.is_admin) this._read();
    this._render();
  }

  get hass() {
    return this._hass;
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

  // Reads system_hub/security; an administrator only (the command refuses the others): { data } or { error }.
  async _read() {
    const hass = this._hass;
    if (!hass?.callWS) return;
    if (hass.user?.is_admin !== true) {
      this._result = { denied: true };
      this._render();
      return;
    }
    if (this._reading) return;
    this._reading = true;
    try {
      this._result = { data: await hass.callWS({ type: 'system_hub/security' }) };
    } catch (err) {
      this._result = { error: err?.code === 'not_enabled' || err?.code === 'unknown_command' ? 'off' : err?.message || err?.code || String(err) };
    }
    this._reading = false;
    this._sig = null;
    this._render();
  }

  // Hides the card and tells Lovelace (card-visibility-changed): hui-card reads the `hidden` property and then
  // drops the card's slot in a sections view. connectedWhileHidden keeps the card in the DOM so that it keeps
  // following its data and shows again on its own. Never hidden in the editor preview / edit mode.
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
    return scT(scLang(this._hass, this._config), key, vars);
  }

  // "{n} to fix" with the plural form of the card's language: `key_one`, `key_few` (when the language has it) or
  // `key_many`.
  _count(key, n) {
    let cat = n === 1 ? 'one' : 'other';
    try {
      cat = new Intl.PluralRules(scLocale(this._hass, this._config)).select(n);
    } catch {
      // Unknown locale: the simple rule above.
    }
    const form = cat === 'one' ? 'one' : cat === 'few' && SC_I18N[scLang(this._hass, this._config)]?.[`${key}_few`] ? 'few' : 'many';
    return this._t(`${key}_${form}`, { n });
  }

  // "3 minutes ago", "yesterday"… in the card's language; ts in seconds.
  _ago(ts) {
    const m = Math.max(0, (Date.now() / 1000 - Number(ts)) / 60);
    if (!Number.isFinite(m)) return '';
    let rtf;
    try {
      rtf = new Intl.RelativeTimeFormat(scLocale(this._hass, this._config), { numeric: 'auto' });
    } catch {
      return '';
    }
    if (m < 1) return rtf.format(0, 'second');
    if (m < 60) return rtf.format(-Math.floor(m), 'minute');
    if (m < 1440) return rtf.format(-Math.floor(m / 60), 'hour');
    return rtf.format(-Math.floor(m / 1440), 'day');
  }

  _render() {
    // Held under a press (see scHoldUnderPress), drawn after its click.
    if (this._pressing) {
      this._dirty = true;
      return;
    }
    this._dirty = false;
    const m = this._prepare();
    if (!m) return;
    // innerHTML replaces every element: the one that had the keyboard focus gets it back after the render.
    const active = this.shadowRoot.activeElement;
    const focusKey = scKeepsFocus(this, active) && active?.dataset?.focus;
    this._draw(m);
    this._bind();
    if (focusKey) [...this.shadowRoot.querySelectorAll('[data-focus]')].find((el) => el.dataset.focus === focusKey)?.focus({ preventScroll: true });
  }

  // What the card shows; null when nothing changed since the last render, or the card is hidden.
  _prepare() {
    if (!this._config || !this._hass || !this.shadowRoot) return null;
    const c = this._config;
    const r = this._result || {};
    const minute = Math.floor(Date.now() / 60000);
    // `_zoomed`: the mini card's view (compact or full), undefined on the full card.
    const sig = JSON.stringify([c, shbIsNight(this._hass, c), scLang(this._hass, c), r, minute, this._zoomed]);
    if (sig === this._sig) return null;
    this._sig = sig;
    const data = r.data || null;
    const points = scPoints(data);
    const bad = points.filter((p) => p.tone === 'bad').length;
    const level = !data ? 'na' : bad ? 'alert' : points.length ? 'warn' : 'ok';
    const hidden = c.hide_when_ok && level === 'ok' && !this._editMode && !this._preview;
    this._setHidden(hidden);
    if (hidden) return null;
    const icon = { ok: 'mdi:shield-check-outline', warn: 'mdi:shield-alert-outline', alert: 'mdi:shield-lock-outline', na: 'mdi:shield-outline' }[level];
    return { r, data, points, bad, level, icon };
  }

  // The rows shown: at most max_items (the mini card's compact view, fewer), then "+N more".
  _limit() {
    return this._config.max_items;
  }

  // The mini card's compact view: no line telling the rest is in order.
  get _compact() {
    return false;
  }

  _draw(m) {
    const { r, data, points, bad, level, icon } = m;
    const c = this._config;
    const subtitle = data?.scanned_at ? this._t('scanned', { d: this._ago(data.scanned_at) }) : '';
    let body;
    if (!data) {
      const [title, text] = r.denied ? ['admin_only', 'admin_only_text'] : r.error === 'off' ? ['off', 'off_text'] : r.error ? ['error_title', null] : ['loading', null];
      body = `<div class="empty"><span class="et">${scEsc(this._t(title))}</span>${text || r.error ? `<span>${scEsc(text ? this._t(text) : this._t('error', { error: r.error }))}</span>` : ''}</div>`;
      this._rows = 1;
    } else {
      const limit = this._limit();
      const shown = points.slice(0, limit);
      const rows = shown.map((p) => this._row(this._point(p)));
      if (points.length > limit) rows.push(this._more(points.length - limit));
      if (c.show_ok && !this._compact) rows.push(...this._okRows(data, points.length));
      body = rows.length ? `<div class="list">${rows.join('')}</div>` : '';
      this._rows = rows.length;
    }
    this.shadowRoot.innerHTML = shBanner(`
      <style>${this.constructor.styles}</style>
      <ha-card class="lvl-${level}">
        <div class="head">
          <div class="badge"><ha-icon icon="${icon}"></ha-icon></div>
          <div class="heading">
            <div class="title-row"><div class="title">${scEsc(c.title || this._t('title'))}</div>${this._pill(this._status(r, points, bad))}</div>
            ${subtitle ? `<div class="subtitle">${scEsc(subtitle)}</div>` : ''}
          </div>
          ${this._headExtra()}
        </div>
        ${body}
      </ha-card>`, { hass: this._hass, config: c, scene: 'security', pad: '12px' });
  }

  _bind() {
    for (const el of this.shadowRoot.querySelectorAll('.row[data-open]')) el.addEventListener('click', () => this._open());
  }

  _status(r, points, bad) {
    if (!r.data) return this._t(r.denied ? 'admin_only' : r.error === 'off' ? 'off' : r.error ? 'error_title' : 'loading');
    if (!points.length) return this._t('all_ok');
    const parts = [];
    if (bad) parts.push(this._count('to_fix', bad));
    if (points.length - bad) parts.push(this._count('to_check', points.length - bad));
    return parts.join(' · ');
  }

  // The status pill: its text, or only its coloured dot when the header is narrow (the text stays in the tooltip
  // and for screen readers).
  _pill(text) {
    const t = scEsc(text);
    return `<div class="pill" title="${t}"><span class="dot"></span><span class="ptxt">${t}</span></div>`;
  }

  // Added at the end of the header by the mini card (its detail button).
  _headExtra() {
    return '';
  }

  // A point as a row: { tone, icon, name, sub, tag, mono, key }.
  _point(p) {
    if (p.kind === 'refused') {
      return { ...p, icon: 'mdi:shield-alert-outline', name: p.ip, mono: true, sub: this._t('refused_sub', { n: p.count, d: this._ago(p.last) }), tag: p.banned ? this._t('banned') : `×${p.count}` };
    }
    if (p.kind === 'ban') return { ...p, icon: 'mdi:cancel', name: p.ip, mono: true, sub: this._t('banned_sub', { d: this._ago(p.at) }), tag: this._t('banned') };
    if (p.kind === 'addon') return { ...p, icon: 'mdi:puzzle-outline', name: p.name, sub: this._t('addon_sub'), tag: this._t('unprotected') };
    if (p.kind === 'mfa') return { ...p, icon: 'mdi:account-alert-outline', name: p.name, sub: this._t('no_mfa_sub'), tag: this._t('no_mfa') };
    if (p.kind === 'host') {
      return { ...p, icon: 'mdi:lan-connect', name: p.host, mono: true, sub: this._t('new_host_sub', { integration: p.integration, d: this._ago(p.first) }), tag: this._t('new_host') };
    }
    if (p.kind === 'tokens') {
      return { ...p, icon: 'mdi:key-alert-outline', name: this._count('tokens', p.names.length), sub: p.names.join(' · '), tag: this._t('tokens_tag', { n: p.days }) };
    }
    if (p.kind === 'clear') {
      return { ...p, icon: 'mdi:form-textbox-password', name: this._t('clear_name', { file: p.file, n: p.line }), sub: this._t('clear_sub', { key: p.field }), tag: '!secret' };
    }
    return { ...p, icon: 'mdi:web', name: this._t('http_name'), sub: p.url, tag: 'HTTP' };
  }

  // A row: a button opening the panel's Security tab.
  _row({ tone, icon, name, sub, tag, mono, key }) {
    const t = scEsc(`${name} — ${sub}`);
    return `<button class="row ${tone}" data-open data-focus="${scEsc(key)}" title="${t}">
            <span class="ic"><ha-icon icon="${icon}"></ha-icon></span>
            <span class="txt"><span class="name${mono ? ' mono' : ''}">${scEsc(name)}</span><span class="sub">${scEsc(sub)}</span></span>
            ${tag ? `<span class="tag">${scEsc(tag)}</span>` : ''}</button>`;
  }

  _more(n) {
    return `<button class="row more" data-open data-focus="more"><span class="ic"><ha-icon icon="mdi:dots-horizontal"></ha-icon></span><span class="txt"><span class="name">${scEsc(this._count('more', n))}</span></span><span class="tag">${scEsc(this._t('open_panel'))}</span></button>`;
  }

  // In order: a line telling the rest (or everything) is in order, what it covers; the outbound hosts when tracked
  // and none is new.
  _okRows(d, problems) {
    const ex = d.exposure || {};
    const admins = (d.users || []).filter((u) => u.admin && u.active);
    const parts = [
      ex.external_url ? (ex.https ? 'HTTPS' : '') : this._t('no_external'),
      this._t(ex.ip_ban ? 'ip_ban_on' : 'ip_ban_off'),
      admins.length ? this._t('mfa_of', { n: admins.filter((u) => u.mfa).length, total: admins.length }) : '',
    ].filter(Boolean);
    const rows = [this._row({ tone: 'good', icon: 'mdi:check-circle-outline', name: this._t(problems ? 'rest_ok' : 'ok_title'), sub: parts.join(' · '), key: 'ok' })];
    const ob = d.outbound;
    if (ob && !problems) rows.push(this._row({ tone: 'idle', icon: 'mdi:lan-connect', name: this._count('hosts', ob.hosts), sub: this._t('no_new_host'), key: 'ob' }));
    return rows;
  }

  // The panel's Security tab
  _open() {
    window.history.pushState(null, '', SC_PANEL);
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
        --sc-natural-width: 360px;
        --sc-ok: var(--success-color, #43a047);
        --sc-warn: var(--warning-color, #ffa600);
        --sc-alert: var(--error-color, #db4437);
        --sc-na: var(--disabled-color, #9e9e9e);
        /* Secondary text on the tinted rows: nudged towards the primary text so it stays readable (WCAG AA) */
        --sc-muted: color-mix(in srgb, var(--secondary-text-color) 70%, var(--primary-text-color));
      }
      /* Width without a minimum (see the Watchdog card): a natural width, no min-content floor */
      :host::before { content: ""; display: grid; grid-template-columns: minmax(0, var(--sc-natural-width)); height: 0; }
      ha-card { padding: 12px; overflow: hidden; contain: inline-size; }
      ha-card.lvl-ok    { --c: var(--sc-ok); }
      ha-card.lvl-warn  { --c: var(--sc-warn); }
      ha-card.lvl-alert { --c: var(--sc-alert); }
      ha-card.lvl-na    { --c: var(--sc-na); }

      .head { display: flex; align-items: center; gap: 8px; container-type: inline-size; }
      .badge { flex: none; width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center;
               background: color-mix(in srgb, var(--c) 16%, transparent); color: var(--c); }
      .badge ha-icon { --mdc-icon-size: 24px; }
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
      .pill .ptxt { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: normal; line-height: 1.25;
                    display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; }
      .pill .dot { flex: none; width: 6px; height: 6px; margin-right: 4px; border-radius: 50%; background: var(--c); }
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
      /* Mini card: the expand / collapse button in the card's top right corner; the header keeps clear of it */
      ha-card:has(.zoom) { position: relative; }
      .head:has(> .zoom) { padding-right: 21px; }
      .head > .zoom { position: absolute; z-index: 2; top: 5px; right: 5px; width: 24px; height: 24px; margin: 0;
                      background: color-mix(in srgb, var(--secondary-text-color) 10%, transparent); }
      @container (max-width: 140px) {
        .head .badge { display: none; }
      }

      .list { display: flex; flex-direction: column; gap: 6px; margin-top: 4px; }
      .empty { display: flex; flex-direction: column; gap: 2px; font-size: 13px; color: var(--sc-muted); padding: 8px 10px; border-radius: 10px;
               background: var(--secondary-background-color, rgba(127,127,127,.08)); }
      .empty .et { font-weight: 500; color: var(--primary-text-color); }
      .row { --t: var(--secondary-text-color); all: unset; box-sizing: border-box; min-width: 0; cursor: pointer;
             display: flex; align-items: center; gap: 8px; padding: 5px 10px 5px 5px; border-radius: 10px;
             background: color-mix(in srgb, var(--t) 12%, var(--secondary-background-color, transparent)); }
      .row.bad  { --t: var(--sc-alert); }
      .row.warn { --t: var(--sc-warn); }
      .row.good { --t: var(--sc-ok); }
      /* The neutral rows (the outbound hosts, "+N more") keep the plain tile, their colour on the icon */
      .row.idle, .row.more { background: var(--secondary-background-color, rgba(127,127,127,.08)); }
      .row:hover { background: color-mix(in srgb, var(--t) 18%, var(--secondary-background-color, transparent)); }
      .row:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
      .ic { flex: none; width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center;
            color: var(--t); background: color-mix(in srgb, var(--t) 18%, transparent); }
      .ic ha-icon { --mdc-icon-size: 16px; }
      .txt { flex: 1; display: flex; flex-direction: column; min-width: 0; }
      .name { font-size: 13px; font-weight: 500; line-height: 1.2; color: var(--primary-text-color);
              white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .name.mono { font-family: var(--code-font-family, ui-monospace, SFMono-Regular, Menlo, monospace); font-size: 12.5px; }
      .sub { font-size: 11px; line-height: 1.2; color: var(--sc-muted);
             white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .sub:empty { display: none; }
      /* What it is on the right shrinks (up to half the row) before the name does */
      .tag { flex: 0 1 auto; min-width: 0; max-width: 50%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 12px; font-weight: 500;
             color: color-mix(in srgb, var(--t) 40%, var(--primary-text-color)); }
      .row.more .tag { color: var(--sc-muted); font-weight: 400; }
      :host([hide-title]) .heading .title, :host([hide-subtitle]) .heading > .subtitle { display: none; }
    `;
  }
}
