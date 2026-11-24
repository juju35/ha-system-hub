// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------


export const BASE_STYLE = `
  /* A block host: in Home Assistant the card sits in hui-card (no display), and an inline host has no size of its own. */
  /* Home Assistant's <ha-icon> is inline: as a box of its own, its icon is centred in its badge */
  ha-icon { display: inline-flex; align-items: center; justify-content: center; vertical-align: middle; line-height: 0; }
  :host { display: block; }
  /* ok_color / warning_color / critical_color (#131) set --sm-level-ok, --sm-warn and --sm-crit on the host itself. */
  :host { --sm-blue: #18bcf2; --sm-ok: var(--success-color, #43a047); --sm-warn: var(--warning-color, #ffa600); --sm-crit: var(--error-color, #db4437);
          --sm-focus: var(--primary-color, #03a9f4); }
  /* Status colours tint pills, dots, bars, rings and icons; text in a status colour is mixed with the text colour
     (45 %), so that it reads at 4.5:1 or more on its tinted background in light and dark themes alike. */
  ha-card { overflow: hidden; position: relative; }
  ha-card.dialog-open { min-height: 220px; }
  .icon { width: 18px; height: 18px; fill: currentColor; flex: none; }
  .muted { color: var(--secondary-text-color); --c: var(--secondary-text-color); }
  .clickable { cursor: pointer; }
  .clickable:focus-visible, [role="button"]:focus-visible { outline: 2px solid var(--sm-focus); outline-offset: -2px; }
  .ok { --c: var(--sm-level-ok, var(--sm-blue)); } .warn { --c: var(--sm-warn); } .crit { --c: var(--sm-crit); } .good { --c: var(--sm-ok); }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--c, var(--sm-ok)); flex: none; display: inline-block; }
  .chip { display: inline-flex; align-items: center; gap: 4px; padding: 1px 8px; border-radius: 12px; font-size: 11px; font-weight: 500;
          background: color-mix(in srgb, var(--c, var(--sm-ok)) 15%, transparent); color: color-mix(in srgb, var(--c, var(--sm-ok)) 45%, var(--primary-text-color)); }
  .bar { height: 4px; border-radius: 3px; background: var(--divider-color, rgba(127,127,127,.25)); overflow: hidden; }
  .bar > div { height: 100%; border-radius: 3px; background: var(--c, var(--sm-blue)); }
  .header { display: flex; align-items: center; gap: 10px; padding: 12px 12px 8px; container: sm-header / inline-size; }
  /* The title keeps 4 letters and its ellipsis ("Home…", 6.5ch of the 16 px title): the block measures its minimum in the
     title's font (its other lines set their own sizes). */
  .titles { flex: 1 1 0; min-width: 6.5ch; font-size: 16px; }
  /* The status pill shares the title's line, centred on it whatever the subtitle or the logo size. The title grows
     from 0 (flex-basis 0): the pill keeps its whole text while the title can still give way, down to a few letters
     (then an ellipsis); only then is the pill cut, and on a narrow header it shows its dot only (its text stays in
     title and aria-label). The buttons never shrink. */
  .name { font-size: 16px; font-weight: 500; line-height: 1.25; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sub { font-size: 12px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  /* Round icon of the showcase site, tinted with the status colour like the pill. */
  .logo { flex: none; border-radius: 50%; display: grid; place-items: center;
          background: color-mix(in srgb, var(--c, var(--sm-ok)) 16%, transparent); }
  .logo .icon { width: 24px; height: 24px; fill: currentColor; color: var(--c, var(--sm-ok)); }
  /* The status pill: on the title row, 8 px after the title, only when the whole title and the pill's whole label fit
     there; otherwise on its own line under the subtitle, which then keeps one line; its dot alone at 200 px or less
     or when its label does not fit the title block (its text stays in its title and for screen readers). Measured
     after each render (_fitPill), in every language, never by a fixed width. */
  .title-row { display: flex; flex-wrap: nowrap; align-items: center; gap: 8px; min-width: 0; }
  .title-row > .name { flex: 0 1 auto; min-width: 0; }
  .title-row > .chip { flex: none; min-width: auto; max-width: none; overflow: visible; align-self: center; margin-top: 0; }
  .title-row > .chip .chip-text { min-width: auto; overflow: visible; white-space: nowrap; display: inline; -webkit-line-clamp: none; line-clamp: none; }
  .titles.pill-below { display: flex; flex-direction: column; align-items: stretch; }
  .titles.pill-below > * { order: 3; }
  .titles.pill-below > .title-row { display: contents; }
  .titles.pill-below > .sub { order: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .titles.pill-below > .title-row > .chip { order: 2; align-self: flex-start; margin-top: 2px; }
  .titles.pill-dot > .title-row > .chip { padding: 4px; gap: 0; }
  .titles.pill-dot > .title-row > .chip .dot { display: block; }
  .titles.pill-dot > .title-row > .chip .chip-text { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
  /* Under the cards' minimum width (6 columns of a 320 px screen, 132 px inside the header), as in a flex row of two
     cards: the logo gives its room, so that the title keeps 4 letters and the zoom button stays inside. */
  @container sm-header (max-width: 131px) {
    .header .logo { display: none; }
  }
  .warning { padding: 16px; color: color-mix(in srgb, var(--sm-warn) 45%, var(--primary-text-color)); }
  /* Zoom button of the mini card: in the card's top right corner (24 px, round); the header keeps clear of it. */
  .zoom { all: unset; position: absolute; z-index: 2; top: 5px; right: 5px; cursor: pointer; width: 24px; height: 24px; border-radius: 50%;
          display: grid; place-items: center; color: var(--secondary-text-color);
          background: color-mix(in srgb, var(--secondary-text-color) 10%, transparent); }
  .header:has(> .zoom) { padding-right: 38px; }
  .zoom .icon { width: 16px; height: 16px; }
  .zoom:hover { background: color-mix(in srgb, var(--secondary-text-color) 16%, transparent); color: var(--primary-text-color); }
  .zoom:focus-visible { outline: 2px solid var(--sm-focus); outline-offset: 1px; }
  :host([hide-title]) .titles .name, :host([hide-subtitle]) .titles > .sub { display: none; }
`;

// Sparkline of a series of [time (ms), value] points (24 h of 5-minute means), on a real time axis: x is the
// point's time over the 24 h window ending at `end`, y its value scaled from 0 to `max` (100 for a percentage), else
// to the series' peak. Points more than
// two periods apart are not joined: the curve breaks where the recorder has no data. Runs of a single point are not
// drawn; nothing at all without a run of two points.
export const HIST_REFRESH = 5 * 60000;
export const HIST_WINDOW = 864e5;
export const HIST_PERIOD = 5 * 60000;
export function spark(points, end, max) {
  if (!points || points.length < 2) return "";
  const start = end - HIST_WINDOW;
  const inWindow = points.filter(([at]) => at >= start && at <= end).sort((a, b) => a[0] - b[0]);
  const runs = [];
  let run = [];
  for (const p of inWindow) {
    if (run.length && p[0] - run[run.length - 1][0] > 2 * HIST_PERIOD) {
      runs.push(run);
      run = [];
    }
    run.push(p);
  }
  runs.push(run);
  const drawn = runs.filter((r) => r.length >= 2);
  if (!drawn.length) return "";
  const peak = max || Math.max(...drawn.flat().map(([, v]) => v)) || 1;
  const x = (at) => (((at - start) / HIST_WINDOW) * 100).toFixed(2);
  const y = (v) => (30 - (Math.min(Math.max(0, v), peak) / peak) * 28).toFixed(2);
  const lines = drawn.map((r) => `M${r.map(([at, v]) => `${x(at)},${y(v)}`).join("L")}`);
  const areas = drawn.map((r, i) => `M${x(r[0][0])},30L${lines[i].slice(1)}L${x(r[r.length - 1][0])},30Z`);
  return `<svg class="spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><path class="spark-a" d="${areas.join("")}"/><path class="spark-l" d="${lines.join(
    ""
  )}"/></svg>`;
}

/** Time of a recorder statistics row in ms: a number (Home Assistant 2023.3 and later) or an ISO date string. */
export const statTime = (p) => (typeof p.start === "number" ? p.start : Date.parse(p.start));

// The parts of the header that hold the status pill (see _fitPill).
export const SM_PILL = { block: ".titles", row: ".title-row", name: ".name", chip: ".chip", sub: ".sub" };
