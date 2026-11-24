import { shCardEsc, shCardPill, shCardT } from "./core.js";
import { shCardOutside } from "./styles.js";
import { SystemHubCardBase } from "./card-base.js";

export class SystemHubCard extends SystemHubCardBase {
  static getConfigElement() {
    return document.createElement('system-hub-card-editor');
  }

  static getStubConfig() {
    return { module: 'status' };
  }
}

export class SystemHubMiniCard extends SystemHubCardBase {
  static get mini() {
    return true;
  }

  static getConfigElement() {
    return document.createElement('system-hub-mini-card-editor');
  }

  static getStubConfig() {
    return { module: 'status' };
  }

  // The Status mini card's detail button (top right, `zoom: false` removes it) shows the full Status card's areas
  // under its header, and back; a click anywhere else brings the compact view back too, unless it lands in a dialog
  // opened from the card. Left (another view, a conditional card hidden), it is compact again on return.
  constructor() {
    super();
    this._zoomed = false;
    this._unzoom = shCardOutside(
      (ev) => {
        var path = ev.composedPath?.() || [];
        return !path.includes(this) && !path.some((n) => ['ha-more-info-dialog', 'ha-dialog', 'dialog'].includes(n?.localName));
      },
      () => this._zoom(false),
    );
  }

  connectedCallback() {
    super.connectedCallback();
    this._unzoom.on();
    // Back on the page: drawn again (compact), the status pill fitted again
    if (this._config?.module === 'status' && this._probe) this._renderStatus();
  }

  disconnectedCallback() {
    this._unzoom.off();
    // Compact again, before the base card lets its observers go
    this._zoom(false);
    super.disconnectedCallback();
  }

  setConfig(config) {
    if (config?.zoom != null && typeof config.zoom !== 'boolean') throw new Error('zoom must be true or false');
    super.setConfig(config);
  }

  getCardSize() {
    if (this._config?.module === 'status' && this._zoomed) return 6;
    return super.getCardSize();
  }

  _zoom(on) {
    if (this._zoomed === on) return;
    this._zoomed = on;
    this._renderStatus();
  }

  _zoomButton() {
    if (this._config.zoom === false || !this._probe?._state || this._error) return '';
    var label = shCardEsc(shCardT(this._hass, this._zoomed ? 'card_zoom_out' : 'card_zoom_in', this._zoomed ? 'Back to the compact view' : 'Show details'));
    var icon = this._zoomed ? 'mdi:arrow-collapse' : 'mdi:arrow-expand';
    return `<button class="zoom" title="${label}" aria-label="${label}" aria-expanded="${this._zoomed}"><ha-icon icon="${icon}"></ha-icon></button>`;
  }

  _bindZoom() {
    this.shadowRoot.querySelector?.('.zoom')?.addEventListener('click', (ev) => {
      // Not the banner's click (it opens the panel)
      ev.stopPropagation();
      this._zoom(!this._zoomed);
      // The button was replaced: keyboard use (Enter / Space, no click count) keeps the focus on the new one
      if (ev.detail === 0) this.shadowRoot.querySelector?.('.zoom')?.focus({ preventScroll: true });
    });
  }

  // One line: the emblem, the summary, the details of the first areas to look at and a dot per area; zoomed, the
  // full Status card's areas by group under it
  _statusCard(status) {
    var p = this._probe;
    var { title } = this._summary(status);
    var order = { bad: 0, warn: 1, info: 2 };
    var look = status.areas.filter(([, [tone]]) => tone !== 'good').sort((a, b) => order[a[1][0]] - order[b[1][0]]);
    var sub = look.length
      ? look
          .slice(0, 3)
          .map(([, [, value]]) => value)
          .join(' · ')
      : '';
    var dots = look.map(([tab, [tone]]) => `<span class="dot ${tone}" title="${shCardEsc(p._tabName(tab))}"></span>`).join('');
    var zoom = this._zoomButton();
    var groups = this._zoomed && zoom ? this._groups(status) : '';
    if (this._config.illustration !== false) {
      var head = `<div class="who"><div class="trow"><div class="title">${shCardEsc(title)}</div>${shCardPill(status)}</div>${sub ? `<div class="sub" title="${shCardEsc(sub)}">${shCardEsc(sub)}</div>` : ''}${dots ? `<div class="dots">${dots}</div>` : ''}</div>`;
      return `<ha-card class="illus">${this._banner(status, head, zoom)}${groups ? `<div class="body">${groups}</div>` : ''}</ha-card>`;
    }
    var row = `<div class="badge"><ha-icon icon="system-hub:${status.tone}"></ha-icon></div>
      <div class="who"><div class="trow"><div class="title">${shCardEsc(title)}</div>${shCardPill(status)}</div>${sub ? `<div class="sub" title="${shCardEsc(sub)}">${shCardEsc(sub)}</div>` : ''}</div><div class="dots">${dots}</div>`;
    if (groups) return `<ha-card class="zoomed"><div class="mini ${status.tone}" data-tab="status">${row}</div>${zoom}<div class="groups">${groups}</div></ha-card>`;
    return `<ha-card class="mini ${status.tone}" data-tab="status">${row}${zoom}</ha-card>`;
  }
}
