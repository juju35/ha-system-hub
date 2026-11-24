// ---------------------------------------------------------------------------
// Zoomable compact card (mini)
// ---------------------------------------------------------------------------
import { ICONS } from "./core.js";
import { esc, svgIcon } from "./helpers.js";
import { SystemMonitorCard } from "./full-card.js";

/** A click inside a dialog (more-info opened from the card, say) is not a click outside the card. */
export const inDialog = (ev) => ev.composedPath().some((n) => ["ha-more-info-dialog", "ha-dialog", "dialog"].includes(n.localName));

// A click or tap outside of the card, and not in a Home Assistant dialog opened from it.
export const isOutside = (card, ev) => !ev.composedPath().includes(card) && !inDialog(ev);

// "A click elsewhere" is caught on the pointer, not only on the click event: on iOS (Safari and the companion app)
// a tap on something that is not clickable (the background, an empty spot, a card with no action) sends no click to
// the page. It counts when the press and the release are both outside the card (a slider dragged out of the card
// does not fold it), and a scroll does not count (the browser cancels the pointer). Keyboard clicks still go through
// the click event.
export const watchOutside = (card, handler) => {
  let downOutside = false;
  const onDown = (ev) => {
    downOutside = isOutside(card, ev);
  };
  const onUp = (ev) => {
    if (downOutside && isOutside(card, ev)) handler(ev);
    downOutside = false;
  };
  const onClick = (ev) => {
    if (ev.detail === 0 && isOutside(card, ev)) handler(ev);
  };
  return {
    on() {
      document.addEventListener("pointerdown", onDown, true);
      document.addEventListener("pointerup", onUp, true);
      document.addEventListener("click", onClick, true);
    },
    // A tap (press and release at the same spot), for the tests.
    tap(ev) {
      onDown(ev);
      onUp(ev);
    },
    off() {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("pointerup", onUp, true);
      document.removeEventListener("click", onClick, true);
    },
  };
};

// No rewrite of the card between a press and its click: Home Assistant updates the card several times a second, and a
// rewrite under the pointer replaces the element pressed, so that the click lands on the card itself and does nothing
// (a button or a row that does not react). While a press is in progress (`_pressing`), a render is left pending
// (`_dirty`): it is done at the click, or right after the release when no click follows (a drag, a scroll).
// `_byPointer` tells a mouse or touch use from the keyboard: after a rewrite, the focus is put back only for the
// keyboard (no focus ring after a click), and always in a text field.
export const holdUnderPress = (card, render) => {
  const root = card.shadowRoot;
  card._onPressEnd = () => {
    window.removeEventListener?.("pointerup", card._onPressEnd, true);
    window.removeEventListener?.("pointercancel", card._onPressEnd, true);
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
    window.removeEventListener?.("pointerup", card._onPressEnd, true);
    window.removeEventListener?.("pointercancel", card._onPressEnd, true);
  };
  root.addEventListener?.("pointerdown", () => {
    card._byPointer = true;
    card._pressing = true;
    window.addEventListener?.("pointerup", card._onPressEnd, true);
    window.addEventListener?.("pointercancel", card._onPressEnd, true);
  });
  root.addEventListener?.("keydown", () => {
    card._byPointer = false;
  });
  // At the click (capture: before the card acts on it) the press is over, and what the click changes is drawn at once.
  card._pressClick = (ev) => {
    card._pressing = false;
    if (ev.detail === 0) card._byPointer = false;
  };
  root.addEventListener?.("click", card._pressClick, true);
};

// Whether the focus goes back to `el` after a rewrite (see holdUnderPress).
export const keepsFocus = (card, el) => !card._byPointer || typeof el?.selectionStart === "number";

/**
 * A compact card with a zoom button at the far right of its header (`zoom: false` removes it): the
 * button switches it to the full card, with the same config, and back; a click anywhere outside the
 * card brings the compact view back too. Subclasses render their compact view in `_compactRender()`
 * and give its size in `_compactSize()`.
 */
export class SystemMonitorZoomCard extends SystemMonitorCard {
  constructor() {
    super();
    // A click outside the card (or a dialog opened from it) brings it back to the compact view.
    this._unzoom = watchOutside(this, () => {
      if (this._zoomed) this._setZoom(false);
    });
  }

  connectedCallback() {
    this._unzoom.on();
    super.connectedCallback();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._unzoom.off();
    // Back to the compact view once off the screen.
    this._zoomed = false;
  }

  getCardSize() {
    return this._zoomed ? super.getCardSize() : this._compactSize();
  }

  getGridOptions() {
    return this._zoomed ? super.getGridOptions() : { columns: 6, min_columns: 6 };
  }

  /** Full card, or back to the compact view (its processes list folded again). */
  _setZoom(zoomed) {
    this._zoomed = zoomed;
    if (!zoomed) this._procsOpen = false;
    this._update();
  }

  _zoomClick(ev) {
    ev.stopPropagation(); // no other action of the header
    this._setZoom(!this._zoomed);
    // Keyboard use (Enter / Space: no click count) keeps the focus on the button that replaced this one.
    if (ev.detail === 0) this.shadowRoot.querySelector(".zoom")?.focus({ preventScroll: true });
  }

  /** The header of both views, with the zoom button at its far right. */
  _header(sm, aside = "") {
    if (this._config.zoom === false) return super._header(sm, aside);
    const title = esc(this._t(this._zoomed ? "zoom_out" : "zoom_in"));
    const button = `<button class="zoom" data-action="zoom" title="${title}" aria-label="${title}">${svgIcon(this._zoomed ? ICONS.collapse : ICONS.expand)}</button>`;
    return super._header(sm, aside + button);
  }

  _render() {
    return this._zoomed ? super._render() : this._compactRender();
  }
}
