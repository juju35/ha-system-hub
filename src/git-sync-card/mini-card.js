// ── Mini card ────────────────────────────────────────────────────────────────
// The mini card extends the full card: its zoom button (top right, `zoom: false` removes it) switches it to the
// full card's content, same configuration, and back; a click anywhere outside the card brings it back too.
import { GS_MINI_DEFAULTS, gsEsc } from "./i18n-helpers.js";
import { GitSyncCard } from "./card.js";

export class GitSyncMiniCard extends GitSyncCard {
  static getConfigElement() {
    return document.createElement('sh-git-sync-mini-card-editor');
  }

  constructor() {
    super();
    this._zoomed = false;
  }

  setConfig(config) {
    super.setConfig({ ...GS_MINI_DEFAULTS, ...config });
  }

  getCardSize() {
    return this._zoomed ? super.getCardSize() : 2;
  }

  getGridOptions() {
    return this._zoomed ? super.getGridOptions() : { columns: 6, min_columns: 6, rows: 'auto' };
  }

  _compact() {
    return !this._zoomed;
  }

  _toggleZoom() {
    this._zoomed = !this._zoomed;
    this._filesOpen = false;
    this._render();
  }

  // A click elsewhere also leaves the full view, unless a commit message is being written.
  _collapse() {
    const folded = super._collapse();
    if (!this._zoomed || this._confirm) return folded;
    this._zoomed = false;
    return true;
  }

  _zoomButton() {
    if (this._config.zoom === false) return '';
    const label = this._t(this._zoomed ? 'zoom_out' : 'zoom_in');
    return `<button class="zoom" title="${gsEsc(label)}" aria-label="${gsEsc(label)}" aria-expanded="${this._zoomed}">
      <ha-icon icon="${this._zoomed ? 'mdi:arrow-collapse' : 'mdi:arrow-expand'}"></ha-icon></button>`;
  }
}
