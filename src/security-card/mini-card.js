/* jscpd:ignore-start */
// ── Mini card ────────────────────────────────────────────────────────────────
// "A click elsewhere" is caught on the pointer, not only on the click event: on iOS (Safari and the companion app)
// a tap on something that is not clickable (the background, an empty spot, a card with no action) sends no click to
// the page. It counts when the press and the release are both outside (`isOut`; a slider dragged out of the card
// does not fold it), and a scroll does not count (the browser cancels the pointer). Keyboard clicks still go through
// the click event.
import { SC_MINI_ITEMS, scEsc } from "./i18n-helpers.js";
import { SecurityCard } from "./card.js";

export const scWatchOutside = (isOut, handler) => {
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
export const scHoldUnderPress = (card, render) => {
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

// Whether the focus goes back to `el` after a rewrite (see scHoldUnderPress).
export const scKeepsFocus = (card, el) => !card._byPointer || typeof el?.selectionStart === 'number';
/* jscpd:ignore-end */

// security-mini-card: the header and the first three points (the worst first), then "+N more". Its detail button
// (top right, `zoom: false` removes it) switches it to the full card and back; a click anywhere else brings it back
// too, unless it lands in a dialog opened from the card.
export class SecurityMiniCard extends SecurityCard {
  static getConfigElement() {
    return document.createElement('sh-security-mini-card-editor');
  }

  constructor() {
    super();
    this._zoomed = false;
    this._unzoom = scWatchOutside(
      (ev) => {
        const path = ev.composedPath();
        return !path.includes(this) && !path.some((n) => ['ha-more-info-dialog', 'ha-dialog', 'dialog'].includes(n.localName));
      },
      () => {
        if (!this._zoomed) return;
        this._zoomed = false;
        this._render();
      },
    );
  }

  connectedCallback() {
    this._unzoom.on();
    super.connectedCallback();
    // Back on the page after leaving it: rendered again in the compact view.
    if (this._hass && this._config) this._render();
  }

  disconnectedCallback() {
    // Left in the middle of a press: nothing stays held.
    this._dropPress?.();
    this._unzoom.off();
    super.disconnectedCallback();
    // Left (another dashboard view, a conditional card hidden): back to the compact view on return.
    this._zoomed = false;
  }

  setConfig(config) {
    if (config?.zoom != null && typeof config.zoom !== 'boolean') throw new Error('zoom must be true or false');
    super.setConfig(config);
  }

  getCardSize() {
    if (this.hidden) return 0;
    return this._zoomed ? super.getCardSize() : 2 + Math.min(this._rows || 0, SC_MINI_ITEMS + 1);
  }

  // 6 columns of a phone section (~156 px) still hold the header once the badge has given way.
  getGridOptions() {
    return { columns: 6, min_columns: 6, rows: 'auto' };
  }

  get _compact() {
    return !this._zoomed;
  }

  _limit() {
    return this._zoomed ? super._limit() : Math.min(SC_MINI_ITEMS, super._limit());
  }

  _headExtra() {
    if (this._config.zoom === false) return '';
    const label = scEsc(this._t(this._zoomed ? 'zoom_out' : 'zoom_in'));
    const icon = this._zoomed ? 'mdi:arrow-collapse' : 'mdi:arrow-expand';
    return `<button class="zoom" data-focus="zoom" title="${label}" aria-label="${label}" aria-expanded="${this._zoomed}"><ha-icon icon="${icon}"></ha-icon></button>`;
  }

  _bind() {
    super._bind();
    this.shadowRoot.querySelector('.zoom')?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      this._zoomed = !this._zoomed;
      this._render();
      // The button was replaced: keyboard use (Enter / Space, no click count) keeps the focus on the new one.
      if (ev.detail === 0) this.shadowRoot.querySelector('.zoom')?.focus({ preventScroll: true });
    });
  }

  static get styles() {
    return `${SecurityCard.styles}
      :host { --sc-natural-width: 300px; }
      .zoom { all: unset; cursor: pointer; flex: none; width: 26px; height: 26px; border-radius: 50%;
              display: grid; place-items: center; color: var(--secondary-text-color); }
      .zoom:hover { background: color-mix(in srgb, var(--secondary-text-color) 14%, transparent); color: var(--primary-text-color); }
      .zoom:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
      .zoom ha-icon { --mdc-icon-size: 16px; }
    `;
  }
}
