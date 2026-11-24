// ── Mini card ────────────────────────────────────────────────────────────────
// A click in a dialog opened from the card (a battery's more-info) does not fold it back.
import { bmEsc } from "./i18n-helpers.js";
import { BatteryMonitorCard } from "./card.js";

export const bmInDialog = (ev) => ev.composedPath().some((n) => ['ha-more-info-dialog', 'ha-dialog', 'dialog'].includes(n.localName));

// "A click elsewhere" is caught on the pointer, not only on the click event: on iOS (Safari and the companion app)
// a tap on something that is not clickable (the background, an empty spot, a card with no action) sends no click to
// the page. It counts when the press and the release are both outside (`isOut`; a slider dragged out of the card
// does not fold it), and a scroll does not count (the browser cancels the pointer). Keyboard clicks still go through
// the click event.
export const bmWatchOutside = (isOut, handler) => {
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
export const bmHoldUnderPress = (card, render) => {
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

// Whether the focus goes back to `el` after a rewrite (see bmHoldUnderPress).
export const bmKeepsFocus = (card, el) => !card._byPointer || typeof el?.selectionStart === 'number';

/**
 * Compact card: the header (status, "Notify now") and only the batteries needing attention. Its detail button (top
 * right) switches it to the full card and back; a click outside the card brings the compact view back.
 */
export class BatteryMonitorMiniCard extends BatteryMonitorCard {
  constructor() {
    super();
    this._zoomed = false;
    // The full screen opened from the zoomed card lives on the page's body, outside the card: not outside here.
    this._outside = bmWatchOutside(
      (ev) => {
        if (bmInDialog(ev)) return false;
        const path = ev.composedPath();
        return !path.includes(this) && !(this._popup && path.includes(this._popup));
      },
      () => {
        if (this._zoomed) this._setZoom(false);
      },
    );
  }

  static getStubConfig() {
    return {};
  }

  setConfig(config) {
    // The host attribute behind the mini card's styles; never set in the constructor.
    this.setAttribute?.('mini', '');
    super.setConfig(config);
  }

  connectedCallback() {
    this._outside.on();
    // Back on the page after leaving it: rendered again in the compact view.
    if (this._hass && this._config) this._render();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._outside.off();
    // Left (another dashboard view, a conditional card hidden): back to the compact view on return.
    this._zoomed = false;
  }

  getCardSize() {
    if (this.hidden) return 0;
    return this._zoomed ? super.getCardSize() : 1 + (this._shown || 0);
  }

  getGridOptions() {
    return this._zoomed ? super.getGridOptions() : { columns: 6, min_columns: 6, rows: 'auto' };
  }

  _compact() {
    return !this._zoomed;
  }

  _setZoom(zoomed) {
    this._zoomed = zoomed;
    this._sig = null;
    this._render();
  }

  _zoomButton() {
    if (!this._state?.entity) return '';
    const label = bmEsc(this._t(this._zoomed ? 'zoom_out' : 'zoom_in'));
    return `<button class="zoom" title="${label}" aria-label="${label}" aria-expanded="${this._zoomed}"><ha-icon icon="mdi:${this._zoomed ? 'arrow-collapse' : 'arrow-expand'}"></ha-icon></button>`;
  }

  _onZoom(ev) {
    ev?.stopPropagation?.();
    this._setZoom(!this._zoomed);
    // Keyboard use (Enter / Space: no click count) keeps the focus on the button, without scrolling the page.
    if (!ev?.detail) this.shadowRoot.querySelector('.zoom')?.focus?.({ preventScroll: true });
  }
}
