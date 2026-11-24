// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

export const BASE_STYLE = `
  /* Text in a state or accent colour is mixed with the theme's text colour (darker in light themes, lighter in dark
     ones) to stay readable (WCAG AA 4.5:1); dots, borders, badges and icons keep the pure colour. */
  /* Home Assistant's <ha-icon> is inline: as a box of its own, its icon is centred in its badge */
  ha-icon { display: inline-flex; align-items: center; justify-content: center; vertical-align: middle; line-height: 0; }
  :host { --am-blue: #1db6ec; --am-ok: var(--success-color, #43a047); --am-warn: var(--warning-color, #ffa600);
          --am-crit: var(--error-color, #db4437);
          --am-blue-text: color-mix(in srgb, var(--am-blue) 40%, var(--primary-text-color, #212121)); }
  /* A block host: its width (watched by a ResizeObserver, see _observeWidth) sets the narrow / compact / nologo / tiny
     attributes below. No CSS size container on the host: its size containment drops the card to ~24 px in a
     container that sizes it by its content (layout-card, button-card, an inline-block, an auto grid column).
     Instead the card's content does not size the host (inline-size containment on ha-card), and an invisible,
     zero-height spacer gives it its intrinsic widths: ~420 px preferred (a row of short words), a few px minimum
     (one word), so a 1fr column, or a <div> wrapping the card in one, can make it as narrow as it needs.
     min-width: 0 lets a grid or flex layout shrink the host itself. */
  :host { display: block; min-width: 0; }
  :host([hidden]) { display: none !important; }
  :host::before { content: "${"x ".repeat(35).trim()}"; display: block; height: 0; overflow: hidden; visibility: hidden;
                  font: 10px/0 monospace; }
  ha-card { contain: inline-size; }
  ha-card { overflow: hidden; }
  .icon { width: 18px; height: 18px; fill: currentColor; flex: none; }
  .muted { color: var(--secondary-text-color); }
  .clickable { cursor: pointer; }
  [role="button"]:focus-visible { outline: 2px solid var(--primary-color, #03a9f4); outline-offset: 2px; }
  .ok { --c: var(--am-ok); } .warn { --c: var(--am-warn); } .crit { --c: var(--am-crit); }
  .na { --c: var(--disabled-text-color, #9e9e9e); }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--c, var(--am-ok)); flex: none; display: inline-block; }
  .chip { display: inline-flex; align-items: center; gap: 4px; padding: 1px 8px; border-radius: 12px; font-size: 11px; font-weight: 500; white-space: nowrap;
          background: color-mix(in srgb, var(--c, var(--am-ok)) 15%, transparent);
          color: color-mix(in srgb, var(--c, var(--am-ok)) 50%, var(--primary-text-color, #212121)); flex: 0 1 auto; min-width: 0; }
  /* The chip keeps its whole label and only truncates when the title is down to its minimum width. */
  .chip .txt { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  .header { display: flex; align-items: center; gap: 10px; padding: 12px 12px 8px; }
  /* Narrow headers free room for the title and the chip's whole label, step by step: below 320 px a smaller logo and
     narrower gaps, below 280 px no logo, and below 245 px (6 columns of the Sections view on a phone) the chip shows
     only its dot (its text stays in title and aria-label), so the title stays readable and the buttons stay in the
     card. */
  :host([compact]) .header { gap: 6px; }
  :host([compact]) .logo { height: 28px; width: 28px; }
  :host([compact]) .logo .icon { width: 16px; height: 16px; }
  :host([nologo]) .logo { display: none; }
  .logo { height: 40px; width: 40px; border-radius: 50%; flex: none; display: grid; place-items: center;
          color: var(--c, var(--am-ok)); background: color-mix(in srgb, var(--c, var(--am-ok)) 16%, transparent); }
  .logo .icon { width: 24px; height: 24px; fill: currentColor; }
  .refresh { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border: none; border-radius: 50%; padding: 0;
             flex: none; cursor: pointer; background: transparent; color: var(--secondary-text-color); }
  .refresh:hover { background: var(--secondary-background-color, rgba(127,127,127,.12)); color: var(--am-blue); }
  .refresh .icon { width: 20px; height: 20px; }
  .refresh.spin .icon { color: var(--am-blue); animation: am-spin 1s linear infinite; }
  @keyframes am-spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) {
    .refresh.spin .icon { animation: none; }
    .section-title .chevron { transition: none; }
  }
  /* The title block takes the room left, truncates, and keeps a few characters whatever the chip and buttons need. */
  .titles { flex: 1 1 0; min-width: 5ch; }
  /* The status pill: on the title row, 8 px after the title, only when the whole title and the pill's whole label fit
     there; otherwise on its own line under the subtitle, which then keeps one line; its dot alone at 200 px or less
     or when its label does not fit the title block (its text stays in its title and for screen readers). Measured
     after each render (_fitPill), in every language, never by a fixed width. */
  .title-row { display: flex; flex-wrap: nowrap; align-items: center; gap: 8px; min-width: 0; }
  .title-row > .name { flex: 0 1 auto; min-width: 0; }
  .title-row > .chip { flex: none; min-width: auto; max-width: none; overflow: visible; align-self: center; margin-top: 0; }
  .title-row > .chip .txt { min-width: auto; overflow: visible; white-space: nowrap; display: inline; -webkit-line-clamp: none; line-clamp: none; }
  .titles.pill-below { display: flex; flex-direction: column; align-items: stretch; }
  .titles.pill-below > * { order: 3; }
  .titles.pill-below > .title-row { display: contents; }
  .titles.pill-below > .sub { order: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .titles.pill-below > .title-row > .chip { order: 2; align-self: flex-start; margin-top: 2px; }
  .titles.pill-dot > .title-row > .chip { padding: 4px; gap: 0; }
  .titles.pill-dot > .title-row > .chip .dot { display: block; }
  .titles.pill-dot > .title-row > .chip .txt { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
  /* Mini card: the expand / collapse button in the card's top right corner (24 px, round), the Refresh button on the
     same top line at its left; the header keeps clear of them. */
  ha-card:has(> .header > .zoom) { position: relative; }
  .header:has(> .zoom) { padding-right: 38px; }
  .header:has(> .zoom):has(> .refresh) { padding-right: 66px; }
  .header > .zoom, .header:has(> .zoom) > .refresh { position: absolute; z-index: 2; top: 5px; width: 24px; height: 24px; margin: 0;
                                                     background: color-mix(in srgb, var(--secondary-text-color) 10%, transparent); }
  .header > .zoom { right: 5px; }
  .header:has(> .zoom) > .refresh { right: 33px; }
  .header:has(> .zoom) > .refresh .icon { width: 16px; height: 16px; }
  .name { font-size: 16px; font-weight: 500; line-height: 1.25; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sub { font-size: 12px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  /* As ha-alert: theme text colour, warning colour on the left border and a light tint. */
  .warning { padding: 16px; color: var(--primary-text-color); border-left: 4px solid var(--am-warn);
             background: color-mix(in srgb, var(--am-warn) 12%, transparent); }
  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; border: none; cursor: pointer; font: inherit; font-size: 12px;
         font-weight: 500; padding: 4px 8px; border-radius: 16px; background: var(--secondary-background-color, rgba(127,127,127,.12));
         color: var(--primary-text-color); min-width: 0; white-space: nowrap; }
  .btn:hover { background: color-mix(in srgb, var(--am-blue) 16%, var(--secondary-background-color, rgba(127,127,127,.12))); }
  .btn .icon { width: 16px; height: 16px; color: var(--am-blue); }
  .counters { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
  .counter { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 12px; min-width: 0;
             background: var(--secondary-background-color, rgba(127,127,127,.08)); }
  .counter.crit, .counter.warn { background: color-mix(in srgb, var(--c) 12%, transparent); }
  .counter .badge { width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex: none;
                    background: color-mix(in srgb, var(--c) 18%, transparent); color: var(--c); }
  .counter .badge .icon { width: 18px; height: 18px; }
  .counter .n { font-size: 20px; font-weight: 500; line-height: 1.1; }
  .counter.crit .n, .counter.warn .n { color: color-mix(in srgb, var(--c) 50%, var(--primary-text-color, #212121)); }
  .counter .lbl { font-size: 12px; color: var(--secondary-text-color); line-height: 1.2; overflow-wrap: anywhere; }
  /* Narrow card (below 384 px): one counter per row, so long labels (Automatisierungen, automatiseringen…) fit
     their counter. */
  :host([narrow]) .counters { grid-template-columns: minmax(0, 1fr); }
  .counter > div:last-child { min-width: 0; }
  .zoom { all: unset; flex: none; cursor: pointer; width: 24px; height: 24px; margin: -4px -4px -4px 0;
          border-radius: 50%; display: grid; place-items: center; color: var(--secondary-text-color); }
  .zoom .icon { width: 16px; height: 16px; }
  .zoom:hover { background: color-mix(in srgb, var(--secondary-text-color) 16%, transparent); color: var(--primary-text-color); }
  .zoom:focus-visible { outline: 2px solid var(--primary-color, #03a9f4); outline-offset: 1px; }
  :host([hide-title]) .titles > .name, :host([hide-subtitle]) .titles > .sub { display: none; }
`;
// In-card confirmation popup (Clear / Clear all), as in ha-vacuum-card and ha-system-monitor-card: a
// backdrop over the card with a small dialog at the top, so it stays in view when the card is long,
// and follows the card's theme (the native window.confirm does neither).
export const DIALOG_STYLE = `
  ha-card.dialog-open { position: relative; min-height: 160px; }
  .backdrop { position: absolute; inset: 0; background: rgba(0,0,0,.45); display: flex; align-items: flex-start; justify-content: center;
              padding-top: 12px; box-sizing: border-box; z-index: 9; border-radius: inherit; }
  .modal { background: var(--card-background-color, #1c1c1c); color: var(--primary-text-color); width: min(92%, 340px); max-height: calc(100% - 24px);
           box-sizing: border-box; border-radius: 14px; padding: 16px; box-shadow: 0 8px 30px rgba(0,0,0,.4); display: flex; flex-direction: column; gap: 12px; }
  .modal .msg { font-size: 14px; line-height: 1.4; }
  .modal-actions { display: flex; justify-content: flex-end; gap: 8px; }
  /* No filled button: the smoked .btn background tinted with the accent colour, accent-tinted text. */
  .modal .btn.primary { color: var(--am-blue-text); background: color-mix(in srgb, var(--am-blue) 16%, var(--secondary-background-color, rgba(127,127,127,.12))); }
  .modal .btn.primary:hover { background: color-mix(in srgb, var(--am-blue) 26%, var(--secondary-background-color, rgba(127,127,127,.12))); }
`;

// After the confirmation popup closes, clicks on the card are ignored for this long: the second click of a
// double click on OK would otherwise land on what lies under the button.
export const CONFIRM_GUARD_MS = 400;

// A click inside a dialog (more-info opened from the card, say) is not a click outside the card.
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

// The parts of the header that hold the status pill (see _fitPill).
export const AM_PILL = { block: ".titles", row: ".title-row", name: ".name", chip: ".chip", sub: ".sub" };
