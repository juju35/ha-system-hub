export var SH_HUB_STYLE = `
  ha-card.illus { padding:0; overflow:hidden; }
  .banner { position:relative; height:90px; overflow:hidden; cursor:pointer; background:#eef2f7; color:#0d2a45; }
  .banner.night { background:#1c2230; color:#fff; }
  .sh-scene { position:absolute; right:0; bottom:10px; height:80px; width:min(200px, 62%);
              -webkit-mask-image:linear-gradient(90deg, transparent 0, #000 14%); mask-image:linear-gradient(90deg, transparent 0, #000 14%); }
  .ground { position:absolute; left:0; right:0; bottom:0; height:10px; background:#9aa1a9; box-shadow:inset 0 2px 0 #b5bbc2; }
  .night .ground { background:#2c323b; box-shadow:none; }
  .htext { position:absolute; z-index:1; left:0; top:0; bottom:10px; right:min(200px, 62%); display:flex; align-items:center; gap:10px;
           padding:8px 8px 8px 14px; min-width:0; }
  .hicon { width:40px; height:40px; flex:none; border-radius:50%; display:grid; place-items:center; --mdc-icon-size:24px; color:var(--sh-tone);
           background:rgba(255,255,255,.62); box-shadow:inset 0 0 0 1px color-mix(in srgb, var(--sh-tone) 22%, transparent); }
  .night .hicon { background:rgba(255,255,255,.12); }
  .htext .who { flex:1; min-width:0; }
  .htext .title { font-size:16px; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:inherit; }
  .htext .sub { font-size:13px; color:#3b5b78; }
  .night .htext .sub { color:rgba(255,255,255,.78); }
  .htext .dots { justify-content:flex-start; max-width:none; margin-top:4px; flex-wrap:nowrap; overflow:hidden; }
  /* The pill under the subtitle (see _fitPill): the area dots beside it, on the same line. */
  .htext .who.pill-below { flex-direction:row; flex-wrap:wrap; align-items:center; align-content:center; column-gap:8px; }
  .htext .who.pill-below > .trow > .title, .htext .who.pill-below > .sub { flex:1 0 100%; min-width:0; }
  .htext .who.pill-below > .dots { order:3; margin-top:2px; flex:0 1 auto; min-width:0; }
  /* A narrow card: no room for the picture beside the text, the background alone stays. */
  .banner { container:sh-banner / inline-size; }
  @container sh-banner (max-width: 300px) { .sh-scene { display:none; } .htext { right:0; } }
  .banner .chip { background:color-mix(in srgb, var(--c) 18%, rgba(255,255,255,.78)); color:color-mix(in srgb, var(--c) 45%, #0d2a45); }
  .banner.night .chip { background:color-mix(in srgb, var(--c) 30%, rgba(8,18,38,.55)); color:color-mix(in srgb, var(--c) 35%, #ffffff); }
  .body { padding:0 16px 14px; }
  /* The mini card's expand / collapse button: 24 px, round, smoked glass, in the banner's top right corner */
  .banner > .zoom { color:#3b5b78; background:rgba(255,255,255,.55); -webkit-backdrop-filter:blur(6px); backdrop-filter:blur(6px);
                    box-shadow:inset 0 0 0 1px rgba(0,0,0,.06); }
  .banner.night > .zoom { color:rgba(255,255,255,.85); background:rgba(255,255,255,.12); }
  .banner:has(> .zoom) .htext { padding-right:30px; }
  .sh-blink { animation:sh-bl 1.2s steps(2) infinite; }
  .sh-gauge { animation:sh-bl 3s ease-in-out infinite; }
  .sh-up { animation:sh-up 1.4s ease-in-out infinite; }
  .sh-ping { transform-box:fill-box; transform-origin:center; animation:sh-ping 2.4s ease-out infinite; }
  .sh-pop { animation:sh-bl 1.6s ease-in-out infinite; }
  @keyframes sh-bl { 50% { opacity:.25; } }
  @keyframes sh-up { 50% { transform:translateY(-1.5px); } }
  @keyframes sh-ping { from { opacity:.8; transform:scale(.7); } to { opacity:0; transform:scale(1.25); } }
  @media (prefers-reduced-motion: reduce) { .sh-scene * { animation:none !important; } }
`;

export var SH_CARD_STYLE = `
  /* Home Assistant's <ha-icon> is inline: as a box of its own, its icon is centred in its badge */
  ha-icon { display: inline-flex; align-items: center; justify-content: center; vertical-align: middle; line-height: 0; }
  :host { display:block; }
  ha-card { padding:14px 16px; --sh-good: var(--success-color, #43a047); --sh-warn: var(--warning-color, #ffa600);
            --sh-bad: var(--error-color, #db4437); --sh-info: var(--info-color, #039be5); }
  .head { display:flex; align-items:center; gap:12px; cursor:pointer; }
  /* The round 40 px status pastille of the ha-* headers, the same size folded (mini) and full */
  .badge { width:40px; height:40px; border-radius:50%; flex:none; display:flex; align-items:center; justify-content:center;
           --mdc-icon-size:24px; color:var(--sh-tone); background:color-mix(in srgb, var(--sh-tone) 14%, transparent); }
  .good { --sh-tone: var(--sh-good); } .warn { --sh-tone: var(--sh-warn); } .bad { --sh-tone: var(--sh-bad); } .info { --sh-tone: var(--sh-info); }
  .who { flex:1; min-width:0; }
  .title { font-size:17px; color:var(--primary-text-color); }
  .mini .title { font-size:15px; }
  .sub { font-size:12.5px; color:var(--secondary-text-color); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  :host([hide-title]) .head .who > .trow > .title, :host([hide-subtitle]) .head .who > .sub,
  :host([hide-title]) .htext .who > .trow > .title, :host([hide-subtitle]) .htext .who > .sub { display:none; }
  .open { color:var(--secondary-text-color); --mdc-icon-size:20px; }
  .group { font-size:11px; letter-spacing:.08em; text-transform:uppercase; color:var(--secondary-text-color); margin:12px 0 6px; }
  .areas { display:grid; grid-template-columns:repeat(auto-fill, minmax(170px, 1fr)); gap:6px; }
  .area { display:flex; align-items:center; gap:8px; padding:6px 8px; border-radius:10px; cursor:pointer; text-align:left; font:inherit;
          border:0; color:inherit; background:color-mix(in srgb, var(--sh-tone, var(--secondary-text-color)) 9%, transparent); --mdc-icon-size:18px; }
  .area ha-icon { color:var(--sh-tone); flex:none; }
  .area .who div:first-child { font-size:12px; color:var(--secondary-text-color); }
  .area .who div:last-child { font-size:13.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .dot { width:8px; height:8px; border-radius:50%; flex:none; background:var(--sh-tone); }
  .mini { display:flex; align-items:center; gap:12px; padding:10px 14px; cursor:pointer; }
  .dots { display:flex; gap:3px; flex-wrap:wrap; justify-content:flex-end; max-width:40%; }
  .note { color:var(--secondary-text-color); }
  /* The mini card's expand / collapse button, top right in both views (smoked glass on the illustrated header) */
  ha-card:has(.zoom) { position:relative; }
  .zoom { all:unset; position:absolute; z-index:2; top:5px; right:5px; width:24px; height:24px; border-radius:50%; display:grid;
          place-items:center; cursor:pointer; --mdc-icon-size:16px; color:var(--secondary-text-color);
          background:color-mix(in srgb, var(--secondary-text-color) 10%, transparent); }
  .zoom:hover { color:var(--primary-text-color); }
  .zoom:focus-visible { outline:2px solid var(--primary-color); outline-offset:2px; }
  ha-card.mini:has(> .zoom), .zoomed > .mini { padding-right:35px; }
  .zoomed { padding:0 0 14px; }
  .zoomed > .groups { padding:0 16px; }
  .trow > .title { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .chip { --c:var(--sh-tone); display:inline-flex; align-items:center; gap:5px; padding:1px 8px; border-radius:12px;
          font-size:11px; font-weight:500; line-height:16px; white-space:nowrap; color:color-mix(in srgb, var(--c) 50%, var(--primary-text-color));
          background:color-mix(in srgb, var(--c) 15%, transparent); }
  .chip .cdot { width:7px; height:7px; border-radius:50%; flex:none; background:var(--c); }
  .chip .ct { white-space:nowrap; }

  /* The status pill: on the title row, 8 px after the title, only when the whole title and the pill's whole label fit
     there; otherwise on its own line under the subtitle, which then keeps one line; its dot alone at 200 px or less
     or when its label does not fit the title block (its text stays in its title and for screen readers). Measured
     after each render (_fitPill), in every language, never by a fixed width. */
  .trow { display: flex; flex-wrap: nowrap; align-items: center; gap: 8px; min-width: 0; }
  .trow > .title { flex: 0 1 auto; min-width: 0; }
  .trow > .chip { flex: none; min-width: auto; max-width: none; overflow: visible; align-self: center; margin-top: 0; }
  .trow > .chip .ct { min-width: auto; overflow: visible; white-space: nowrap; display: inline; -webkit-line-clamp: none; line-clamp: none; }
  .who.pill-below { display: flex; flex-direction: column; align-items: stretch; }
  .who.pill-below > * { order: 3; }
  .who.pill-below > .trow { display: contents; }
  .who.pill-below > .sub { order: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .who.pill-below > .trow > .chip { order: 2; align-self: flex-start; margin-top: 2px; }
  .who.pill-dot > .trow > .chip { padding: 4px; gap: 0; }
  .who.pill-dot > .trow > .chip .dot { display: block; }
  .who.pill-dot > .trow > .chip .ct { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
`;

// The parts of the header that hold the status pill (see _fitPill).
export var SH_CARD_PILL = { block: '.who', row: '.trow', name: '.title', chip: '.chip', sub: '.sub' };

// "A click elsewhere" is caught on the pointer, not only on the click event: on iOS (Safari and the companion app) a
// tap on something that is not clickable (the background, an empty spot) sends no click to the page. It counts when
// the press and the release are both outside (a slider dragged out of the card does not fold it); a scroll does not
// (the browser cancels the pointer). Keyboard clicks still go through the click event.
export function shCardOutside(isOut, handler) {
  var pressedOut = false;
  var down = (ev) => {
    pressedOut = isOut(ev);
  };
  var up = (ev) => {
    if (pressedOut && isOut(ev)) handler(ev);
    pressedOut = false;
  };
  var key = (ev) => {
    if (ev.detail === 0 && isOut(ev)) handler(ev);
  };
  var events = [
    ['pointerdown', down],
    ['pointerup', up],
    ['click', key],
  ];
  return {
    on() {
      for (var [type, fn] of events) document.addEventListener?.(type, fn, true);
    },
    off() {
      for (var [type, fn] of events) document.removeEventListener?.(type, fn, true);
    },
    // A tap (press and release at the same spot), for the tests
    tap(ev) {
      down(ev);
      up(ev);
    },
  };
}
