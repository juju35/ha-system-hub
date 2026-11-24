// ── Mini card ────────────────────────────────────────────────────────────────
// orphan-entities-mini-card: the status on two lines — the badge, title and status pill, then a chip per reason
// (with its count) and the time of the last scan. Its detail button (top right, `zoom: false` removes it) switches it
// to the full card and back, as does a click anywhere else, unless it lands in a dialog opened from the card. A
// reason's chip opens the full card filtered on that reason.
import { OE_REASONS, OE_REASON_ICONS, oeEsc, oeKind } from "./i18n-helpers.js";
import { shBanner } from "./illustrated-header.js";
import { OrphanEntitiesCard, oeWatchOutside } from "./card.js";

export class OrphanEntitiesMiniCard extends OrphanEntitiesCard {
  static getConfigElement() {
    return document.createElement('sh-orphans-mini-card-editor');
  }

  constructor() {
    super();
    this._zoomed = false;
    this._unzoom = oeWatchOutside(
      (ev) => {
        const path = ev.composedPath();
        return !path.includes(this) && !path.some((n) => ['ha-more-info-dialog', 'ha-dialog', 'dialog'].includes(n.localName));
      },
      () => {
        if (!this._zoomed) return;
        this._zoomed = false;
        this._confirm = null;
        this._render();
      },
    );
  }

  connectedCallback() {
    super.connectedCallback();
    this._unzoom.on();
    // Back on the page after leaving it: rendered again in the compact view.
    if (this._hass && this._config) this._render();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._unzoom.off();
    // Left (another dashboard view, a conditional card hidden): back to the compact view on return.
    this._zoomed = false;
    this._confirm = null;
  }

  setConfig(config) {
    if (config?.zoom != null && typeof config.zoom !== 'boolean') throw new Error('zoom must be true or false');
    super.setConfig(config);
  }

  getCardSize() {
    if (this.hidden) return 0;
    return this._zoomed ? super.getCardSize() : 2;
  }

  getGridOptions() {
    return { columns: 6, min_columns: 6, rows: 'auto' };
  }

  _badgeIcon() {
    return 'mdi:ghost-outline';
  }

  _headExtra() {
    if (this._config.zoom === false) return '';
    const label = oeEsc(this._t(this._zoomed ? 'zoom_out' : 'zoom_in'));
    const icon = this._zoomed ? 'mdi:arrow-collapse' : 'mdi:arrow-expand';
    return `<button class="zoom" data-focus="zoom" title="${label}" aria-label="${label}" aria-expanded="${this._zoomed}"><ha-icon icon="${icon}"></ha-icon></button>`;
  }

  _draw(m) {
    if (this._zoomed) {
      super._draw(m);
      return;
    }
    const { items, scanned, level, scannedAt } = m;
    this.shadowRoot.innerHTML = shBanner(`
      <style>${this.constructor.styles}</style>
      <ha-card class="lvl-${level}">
        <div class="mini">
          <div class="badge"><ha-icon icon="${this._badgeIcon()}"></ha-icon></div>
          <div class="body">
            <div class="head">
              <div class="heading"><div class="title-row"><div class="title">${oeEsc(this._config.title || this._t('title'))}</div>${this._pill(this._status(items, scanned))}</div></div>
              ${this._scanButton()}
              ${this._headExtra()}
            </div>
            <div class="rs">${m.st ? this._chips(items, scanned, scannedAt) : ''}</div>
          </div>
        </div>
      </ha-card>`, { hass: this._hass, config: this._config, scene: 'orphans', pad: '12px' });
  }

  _zoom(on, reason) {
    this._zoomed = on;
    if (reason != null) {
      this._reason = reason;
      this._showAll = false;
    }
    if (!on) this._confirm = null;
    this._render();
  }

  _bind() {
    super._bind();
    this.shadowRoot.querySelector('.zoom')?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      this._zoom(!this._zoomed);
      // The button was replaced: keyboard use (Enter / Space, no click count) keeps the focus on the new one.
      if (ev.detail === 0) this.shadowRoot.querySelector('.zoom')?.focus({ preventScroll: true });
    });
    for (const el of this.shadowRoot.querySelectorAll('.r')) {
      el.addEventListener('click', (ev) => {
        if (el.dataset.zoom != null && this._config.zoom !== false) {
          ev.stopPropagation();
          this._zoom(true, el.dataset.zoom);
        } else if (el.dataset.entity) {
          this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId: el.dataset.entity }, bubbles: true, composed: true }));
        }
      });
    }
  }

  _chip(cls, icon, text, title, focus, attrs) {
    return `<button class="r ${cls}" ${attrs} data-focus="${oeEsc(focus)}" title="${oeEsc(title)}"><ha-icon icon="${icon}"></ha-icon><span class="rt">${oeEsc(text)}</span></button>`;
  }

  _chips(items, scanned, scannedAt) {
    const ids = this._ids;
    const sensor = `data-entity="${oeEsc(ids.orphans)}"`;
    const counts = {};
    for (const i of items) counts[i.reason] = (counts[i.reason] || 0) + 1;
    // One tinted chip per reason: no longer provided in red, stale in orange. It opens the filtered full card.
    const chips = OE_REASONS.filter((r) => counts[r]).map((r) => {
      const label = `${this._t(`reason_${r}`)} · ${counts[r]}`;
      return this._chip(`${oeKind(r)} pill`, OE_REASON_ICONS[r], label, label, `m:${r}`, `data-zoom="${r}" ${sensor}`);
    });
    if (scanned && !items.length) chips.push(this._chip('ok', 'mdi:check-circle', this._t('none'), this._t('empty'), 'm:ok', sensor));
    // The mini card is narrow: while waiting the chip only says when ("in 10 minutes"), the full status is its tooltip.
    const due = scanned ? '' : this._in(this._hass.states[ids.orphans]?.attributes?.next_scan);
    const text = scannedAt ? this._t('scanned', { d: this._ago(scannedAt) }) : scanned ? this._t('never_scanned') : due || this._t('waiting');
    const tip = scannedAt ? this._absolute(scannedAt) : due ? this._waiting() : text;
    chips.push(this._chip('idle', 'mdi:clock-check-outline', text, tip, 'm:s', ids.last_scan ? `data-entity="${oeEsc(ids.last_scan)}"` : ''));
    return chips.join('');
  }

  static get styles() {
    return `${OrphanEntitiesCard.styles}
      :host { --oe-natural-width: 300px; }
      /* Badge, then the two lines; the badge keeps the full card's size (40 px), top-aligned */
      .mini { display: flex; align-items: flex-start; gap: 10px; container-type: inline-size; }
      .body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
      .mini .head { min-height: 40px; }
      .rs { display: flex; flex-wrap: wrap; gap: 2px 4px; margin-left: -4px; }
      .rs:empty { display: none; }
      .r { --t: var(--secondary-text-color); all: unset; box-sizing: border-box; cursor: pointer;
           display: inline-flex; align-items: center; gap: 3px; max-width: 100%; min-width: 0;
           padding: 0 6px 0 4px; border-radius: 999px; font-size: 12px; font-weight: 500; line-height: 18px;
           white-space: nowrap; color: var(--primary-text-color); }
      .r.ok    { --t: var(--oe-ok); }
      .r.warn  { --t: var(--oe-warn); }
      .r.alert { --t: var(--oe-alert); }
      .r.idle  { color: var(--oe-muted); }
      .r ha-icon { flex: none; display: inline-flex; --mdc-icon-size: 13px; color: var(--t); }
      .r .rt { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
      .r.pill { color: color-mix(in srgb, var(--t) 40%, var(--primary-text-color)); background: color-mix(in srgb, var(--t) 14%, transparent); }
      .r:hover { background: color-mix(in srgb, var(--t) 16%, var(--secondary-background-color, transparent)); }
      .r.pill:hover { background: color-mix(in srgb, var(--t) 22%, transparent); }
      .r:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
      .zoom { all: unset; cursor: pointer; flex: none; width: 26px; height: 26px; border-radius: 50%;
              display: grid; place-items: center; color: var(--secondary-text-color); }
      .zoom:hover { background: color-mix(in srgb, var(--secondary-text-color) 14%, transparent); color: var(--primary-text-color); }
      .zoom:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
      .zoom ha-icon { --mdc-icon-size: 16px; }
      @container (max-width: 150px) {
        .mini > .badge { display: none; }
        .mini .head { gap: 4px; }
      }
    `;
  }
}
