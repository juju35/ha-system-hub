// ---------------------------------------------------------------------------
// Mini card
// ---------------------------------------------------------------------------
import { ICONS } from "./core.js";
import { ago, esc, svgIcon } from "./helpers.js";
import { BASE_STYLE, watchOutside } from "./shared-styles.js";
import { AutomationMonitorCard } from "./full-card.js";

export const MINI_STYLE = `
  .name { font-size: 16px; }
  /* A narrower Refresh button (same icon) leaves the title room for the detail button. */
  .refresh { width: 28px; height: 28px; }
  .content { padding: 0 12px 12px; display: flex; flex-direction: column; gap: 8px; }
  .counter { padding: 8px 10px; }
  .counter .badge { width: 30px; height: 30px; }
  .counter .badge .icon { width: 18px; height: 18px; }
  .counter .n { font-size: 20px; }
  .line { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--secondary-text-color); min-width: 0; }
  .line .icon { width: 14px; height: 14px; color: var(--c); }
  .line span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .line b { font-weight: 500; color: var(--primary-text-color); }
`;

// The mini card extends the full card: its detail button (top right, `zoom: false` removes it) switches it to the
// full card's content, same configuration, and back; a click anywhere outside the card brings it back too.
export class AutomationMonitorMiniCard extends AutomationMonitorCard {
  constructor() {
    super();
    this._zoomed = false;
    this.shadowRoot.addEventListener("click", (ev) => this._zoomClick(ev));
    // A click outside the card, and not in a dialog opened from it, brings it back to the compact view.
    this._unzoom = watchOutside(this, (ev) => {
      if (ev === this._confirmCloseEvent) return;
      if (this._zoomed) this._setZoom(false);
    });
  }

  static getConfigElement() {
    return document.createElement("sh-automations-mini-card-editor");
  }

  // Short counter labels, and no automation count in the signature, while compact.
  get _compact() {
    return !this._zoomed;
  }

  connectedCallback() {
    super.connectedCallback();
    this._unzoom.on();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._unzoom.off();
    // Back to the compact view once off the screen.
    this._zoomed = false;
  }

  getCardSize() {
    if (this.hidden) return 0;
    return this._zoomed ? super.getCardSize() : 3;
  }

  getGridOptions() {
    return this._zoomed ? super.getGridOptions() : { columns: 6, min_columns: 6 };
  }

  _setZoom(zoomed) {
    this._zoomed = zoomed;
    this._update();
  }

  // A click on the detail button: never a tap on anything else of the card.
  _zoomClick(ev) {
    if (!ev.target?.closest?.(".zoom")) return;
    ev.stopPropagation();
    this._setZoom(!this._zoomed);
    // Keyboard use (Enter / Space: no click count) keeps the focus on the button.
    if (ev.detail === 0) this.shadowRoot.querySelector(".zoom")?.focus({ preventScroll: true });
  }

  _zoomButton() {
    if (this._config.zoom === false) return "";
    const z = this._zoomed;
    const label = esc(this._t(z ? "zoom_out" : "zoom_in"));
    return `<button class="zoom" title="${label}" aria-label="${label}" aria-expanded="${z}">${svgIcon(z ? ICONS.collapse : ICONS.expand)}</button>`;
  }

  _render() {
    if (this._zoomed) return super._render();
    const data = this._data();
    if (data.error) return this._errorCard(data.error);
    const c = this._config;
    const lines = [];
    const last = c.show_failed !== false && data.failures[0];
    if (last) {
      const when = ago(this._hass, c, last.last_error_time);
      lines.push(
        `<div class="line crit clickable" role="button" tabindex="0" data-key="failed:${esc(last.entity_id)}" data-entity="${esc(last.entity_id)}">${svgIcon(ICONS.alert)}<span><b>${esc(last.name || last.entity_id)}</b>${
          when ? ` · ${esc(when)}` : ""
        }</span></div>`
      );
    }
    const off = c.show_linked !== false && data.linked[0];
    if (off) {
      const when = ago(this._hass, c, off.unavailable_since);
      lines.push(
        `<div class="line warn clickable" role="button" tabindex="0" data-key="linked:${esc(off.entity_id)}" data-entity="${esc(off.entity_id)}">${svgIcon(ICONS.disconnect)}<span><b>${esc(off.name || off.entity_id)}</b>${
          when ? ` · ${esc(this._t("unavailable_since", { when }))}` : ""
        }</span></div>`
      );
    }
    return `<style>${BASE_STYLE}${MINI_STYLE}</style>
      <ha-card>
        ${this._header(data, "")}
        <div class="content">${this._counters(data)}${lines.join("")}</div>
      </ha-card>`;
  }
}
