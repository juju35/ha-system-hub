// ---------------------------------------------------------------------------
// Full card
// ---------------------------------------------------------------------------
import { ICONS } from "./core.js";
import { esc, fmtBytes, fmtBytesPair, fmtNum, fmtRate, fmtUptime, metricLevel, num, svgIcon, temperature, toBps, toBytes, uptimeSec } from "./helpers.js";
import { backupStatus, discover, discoverBackup, discoverDatabase, diskUsage, fmtRelative, interfaces, mainIp, memUsage } from "./entity-discovery.js";
import { BASE_STYLE, spark } from "./shared-styles.js";
import { SystemMonitorBase } from "./card-base.js";
import { NET_STYLE } from "./mini-card.js";


export const ring = (p) => {
  const r = 26;
  const c = 2 * Math.PI * r;
  const v = p === null ? 0 : Math.max(0, Math.min(100, p));
  return `<svg class="ring" viewBox="0 0 64 64">
    <circle cx="32" cy="32" r="${r}" class="track"/>
    <circle cx="32" cy="32" r="${r}" class="value" stroke-dasharray="${((v / 100) * c).toFixed(1)} ${c.toFixed(1)}"/>
  </svg>`;
};

/** Status tiles under the header of the full card. */
export const TILES_STYLE = `
  /* Tiles of equal width side by side while they fit. A label or a status takes two lines (never a cut word) before its
     tile goes down to a second row, whose tiles share its width; the tiles of a row keep the same height. */
  .stats { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 12px 10px; }
  .stat { flex: 1 1 0; display: flex; flex-direction: column; gap: 0; padding: 6px 8px; border-radius: 10px; min-width: min-content; max-width: 100%;
          box-sizing: border-box; background: color-mix(in srgb, var(--c, var(--sm-ok)) 12%, var(--secondary-background-color, transparent)); }
  .stat .k { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--secondary-text-color); min-width: 0; }
  .stat .k span, .stat .v { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; overflow-wrap: normal; }
  .stat .k .icon { width: 16px; height: 16px; color: var(--c, var(--sm-ok)); }
  .stat .v { font-size: 13px; font-weight: 500; color: color-mix(in srgb, var(--c, var(--sm-ok)) 45%, var(--primary-text-color)); }
`;

export const FULL_STYLE = `
  .logo { height: 40px; width: 40px; }
  /* A narrow card (under ~255 px) gives the pill the logo's last 8 px and 4 px of its gap: "Update 2026.10.3" stays
     beside 4 letters of the title at 245 px. */
  @container sm-header (max-width: 230px) {
    .logo { height: 32px; width: 32px; }
    .logo .icon { width: 20px; height: 20px; }
    .title-row { gap: 4px; }
  }
  /* Still too narrow for the pill beside 4 letters of the title (a longer label, or the zoom button of a zoomed mini
     card in a narrow masonry column): the pill goes under the title, whole, instead of being cut. */
  .title-row { flex-wrap: wrap; row-gap: 2px; }
  .section-title.toggle { cursor: pointer; margin-bottom: 0; user-select: none; }
  .section-title .count { margin-left: auto; text-transform: none; letter-spacing: 0; font-weight: 400; }
  .section-title.closed .chevron { transform: rotate(-90deg); }
  .section-title .chip { text-transform: none; letter-spacing: 0; padding: 0 8px; }
  .content { padding: 0 12px 12px; display: flex; flex-direction: column; gap: 12px; container: sm-content / inline-size; }
  .section-title { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 500; text-transform: uppercase;
                   letter-spacing: .04em; color: var(--secondary-text-color); margin-bottom: 6px; }
  .section-title .icon { width: 16px; height: 16px; }
  /* Narrow cards, long names: the name gives way with an ellipsis (full text in title); the pills, the count and the
     chevron keep their size. */
  .section-title > * { flex: none; }
  .section-title > .label, .section-title > .arg { flex: 0 1 auto; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  /* Phone width (6 columns of a 320 px screen, 132 px inside): the section icon goes and the gaps shrink, so that the
     pills, the count and the chevron stay inside the card with the name. */
  @container sm-content (max-width: 160px) {
    .section-title { gap: 4px; }
    .section-title > .icon:first-child { display: none; }
  }
  .gauges { display: grid; grid-template-columns: repeat(var(--n, 3), minmax(0, 1fr)); gap: 6px; container-type: inline-size; }
  .gauge { display: flex; flex-direction: column; align-items: center; min-width: 0; position: relative; border-radius: 10px; overflow: hidden; }
  /* 24 h curve of the CPU and RAM gauges, behind the whole gauge (0 % at its bottom, 100 % at its top). */
  .gauge > :not(.spark) { position: relative; }
  .gauge .spark { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
  .dial { position: relative; width: 100%; max-width: 60px; aspect-ratio: 1; }
  .ring { width: 100%; height: 100%; transform: rotate(-90deg); display: block; }
  .ring circle { fill: none; stroke-width: 6; }
  .ring .track { stroke: var(--divider-color, rgba(127,127,127,.25)); }
  .ring .value { stroke: var(--c, var(--sm-blue)); stroke-linecap: round; }
  .dial .val { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
  .dial .val b { font-size: 14px; font-weight: 500; }
  .dial .val .icon { width: 12px; height: 12px; color: var(--secondary-text-color); }
  .gauge .lbl { font-size: 12px; color: var(--secondary-text-color); margin-top: 0; text-align: center; max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
  /* Used / total: on two lines (at the slash) rather than over the next gauge. */
  .gauge .lbl2 { font-size: 11px; color: var(--secondary-text-color); text-align: center; }
  /* Four gauges on a narrow card: a size smaller, so that the longest labels (Datenträger) still fit. */
  @container (max-width: 300px) { .gauge .lbl { font-size: 11px; } .gauge .lbl2 { font-size: 10px; } }
  .section-title .arg { text-transform: none; letter-spacing: 0; }
  .facts { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 12px; margin-top: 6px; }
  .facts > span { display: inline-flex; align-items: center; gap: 4px; }
  .facts .icon { width: 14px; height: 14px; color: var(--secondary-text-color); }
  .vol { margin-bottom: 8px; display: grid; grid-template-columns: minmax(0, 1fr) auto; column-gap: 8px; align-items: center; }
  .vol .row { grid-column: 1; grid-row: 1; }
  .vol:last-child { margin-bottom: 0; }
  .row { display: flex; align-items: center; gap: 8px; font-size: 13px; }
  .row .icon { color: var(--secondary-text-color); }
  .row .grow { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .row .tag { font-size: 11px; padding: 1px 6px; border-radius: 6px; background: var(--secondary-background-color, rgba(127,127,127,.12));
              color: var(--secondary-text-color); }
  .vol .bar { margin: 4px 0 0; grid-column: 1 / -1; grid-row: 2; }
  .vol.backup.warn .when, .vol.backup.crit .when { color: color-mix(in srgb, var(--c) 45%, var(--primary-text-color)); font-weight: 600; }
  .vol .detail { font-size: 11px; color: var(--secondary-text-color); display: flex; justify-content: flex-end; grid-column: 2; grid-row: 1; gap: 8px; }
  /* Narrow card: the mount point (the main information) keeps the whole line, the used / total size goes under the bar. */
  @container sm-content (max-width: 300px) {
    .vol .row { grid-column: 1 / -1; }
    .vol .detail { grid-column: 1 / -1; grid-row: 3; margin-top: 2px; }
  }
  .procs { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
  .procs .chip { font-weight: 400; }
  /* gauge_style: bar (#131): the System section's metrics as lines, like the mini card's, with the used / total size
     before the value. One grid for every line: the label and size columns widen for the longest, the same for all. */
  .lines { display: grid; gap: 8px min(8px, 3%);
           grid-template-columns: 18px minmax(min(64px, 30%), max-content) minmax(16px, 1fr) max-content minmax(max-content, 44px); }
  .line { grid-column: 1 / -1; display: grid; grid-template-columns: subgrid; align-items: center; font-size: 13px; position: relative; }
  .line > :not(.spark) { position: relative; }
  .line .spark { position: absolute; inset: -2px -4px; width: calc(100% + 8px); height: calc(100% + 4px); pointer-events: none; }
  .line .icon { color: var(--secondary-text-color); }
  .line .l { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .line .d { font-size: 11px; color: var(--secondary-text-color); white-space: nowrap; text-align: right; }
  .line .v { text-align: right; font-weight: 500; white-space: nowrap; }
  /* A narrow card: the used / total size gives its room to the bar (its column goes, the value stays last). */
  @container sm-content (max-width: 300px) {
    .line .d { display: none; }
    .lines { column-gap: 6px; grid-template-columns: 18px minmax(min(64px, 30%), max-content) minmax(16px, 1fr) minmax(max-content, 44px); }
  }
`;

// show_actions: what each button runs, its icon, and whether it is shown as dangerous (red).
export const HA_ACTIONS = {
  reload: { service: ["homeassistant", "reload_all"], icon: ICONS.reload, danger: false },
  restart: { service: ["homeassistant", "restart"], icon: ICONS.restart, danger: true },
  reboot: { service: ["hassio", "host_reboot"], icon: ICONS.reboot, danger: true },
};

// show_actions: the shortcuts `shortcuts` may list, each shown only when its page is in Home Assistant — the File
// editor (else Studio Code Server) and the Marketplace when in the sidebar (#133, #144); `path`: a page inside the panel.
export const HA_SHORTCUTS = [
  { key: "file_editor", panels: ["core_configurator", "a0d7b954_vscode"], icon: "M8,12H16V14H8V12M10,20H6V4H13V9H18V12.1L20,10.1V8L14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H10V20M8,18H12.1L13,17.1V16H8V18M20.2,13C20.3,13 20.5,13.1 20.6,13.2L21.9,14.5C22.1,14.7 22.1,15.1 21.9,15.3L20.9,16.3L18.8,14.2L19.8,13.2C19.9,13.1 20,13 20.2,13M20.2,16.9L14.1,23H12V20.9L18.1,14.8L20.2,16.9Z" },
  { key: "marketplace", panels: ["marketplace"], icon: "M5.06 3C4.63 3 4.22 3.14 3.84 3.42S3.24 4.06 3.14 4.5L2.11 8.91C1.86 10 2.06 10.95 2.72 11.77L3 12.05V19C3 19.5 3.2 20 3.61 20.39S4.5 21 5 21H19C19.5 21 20 20.8 20.39 20.39S21 19.5 21 19V12.05L21.28 11.77C21.94 10.95 22.14 10 21.89 8.91L20.86 4.5C20.73 4.06 20.5 3.7 20.13 3.42C19.77 3.14 19.38 3 18.94 3H5.06M18.89 4.97L19.97 9.38C20.06 9.81 19.97 10.2 19.69 10.55C19.44 10.86 19.13 11 18.75 11C18.44 11 18.17 10.9 17.95 10.66C17.73 10.43 17.61 10.16 17.58 9.84L16.97 5L18.89 4.97M5.06 5H7.03L6.42 9.84C6.3 10.63 5.91 11 5.25 11C4.84 11 4.53 10.86 4.31 10.55C4.03 10.2 3.94 9.81 4.03 9.38L5.06 5M9.05 5H11V9.7C11 10.05 10.89 10.35 10.64 10.62C10.39 10.88 10.08 11 9.7 11C9.36 11 9.07 10.88 8.84 10.59S8.5 10 8.5 9.66V9.5L9.05 5M13 5H14.95L15.5 9.5C15.58 9.92 15.5 10.27 15.21 10.57C14.95 10.87 14.61 11 14.2 11C13.89 11 13.61 10.88 13.36 10.62C13.11 10.35 13 10.05 13 9.7V5M7.45 12.05C8.08 12.67 8.86 13 9.8 13C10.64 13 11.38 12.67 12 12.05C12.69 12.67 13.45 13 14.3 13C15.17 13 15.92 12.67 16.55 12.05C17.11 12.67 17.86 13 18.8 13H19.03V19H5V13H5.25C6.16 13 6.89 12.67 7.45 12.05Z" },
  { key: "settings", panels: ["config"], path: "/config/dashboard", icon: "M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.21,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.21,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.67 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z" },
  { key: "integrations", panels: ["config"], path: "/config/integrations/dashboard", icon: "M22,13.5C22,15.26 20.7,16.72 19,16.96V20A2,2 0 0,1 17,22H13.2V21.7A2.7,2.7 0 0,0 10.5,19C9,19 7.8,20.21 7.8,21.7V22H4A2,2 0 0,1 2,20V16.2H2.3C3.79,16.2 5,15 5,13.5C5,12 3.79,10.8 2.3,10.8H2V7A2,2 0 0,1 4,5H7.04C7.28,3.3 8.74,2 10.5,2C12.26,2 13.72,3.3 13.96,5H17A2,2 0 0,1 19,7V10.04C20.7,10.28 22,11.74 22,13.5M17,15H18.5A1.5,1.5 0 0,0 20,13.5A1.5,1.5 0 0,0 18.5,12H17V7H12V5.5A1.5,1.5 0 0,0 10.5,4A1.5,1.5 0 0,0 9,5.5V7H4V9.12C5.76,9.8 7,11.5 7,13.5C7,15.5 5.75,17.2 4,17.88V20H6.12C6.8,18.25 8.5,17 10.5,17C12.5,17 14.2,18.25 14.88,20H17V15Z" },
  { key: "logs", panels: ["config"], path: "/config/logs", icon: "M18 7C16.9 7 16 7.9 16 9V15C16 16.1 16.9 17 18 17H20C21.1 17 22 16.1 22 15V11H20V15H18V9H22V7H18M2 7V17H8V15H4V7H2M11 7C9.9 7 9 7.9 9 9V15C9 16.1 9.9 17 11 17H13C14.1 17 15 16.1 15 15V9C15 7.9 14.1 7 13 7H11M11 9H13V15H11V9Z" },
  { key: "developer_tools", panels: ["developer-tools"], path: "/developer-tools/state", icon: "M2 19.63L13.43 8.2L12.72 7.5L14.14 6.07L12 3.89C13.2 2.7 15.09 2.7 16.27 3.89L19.87 7.5L18.45 8.91H21.29L22 9.62L18.45 13.21L17.74 12.5V9.62L16.27 11.04L15.56 10.33L4.13 21.76L2 19.63Z" },
];
// The shortcuts shown when `shortcuts` is not set.
export const HA_DEFAULT_SHORTCUTS = ["file_editor", "marketplace", "settings"];

export const ACTIONS_STYLE = `
  .ha-acts { display: flex; flex-wrap: wrap; justify-content: flex-end; align-items: center; gap: 6px; }
  .ha-msg { flex: 1 1 100%; font-size: 12px; text-align: right; }
  .ha-main { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; max-width: 100%; }
  .ha-main.icons .ha-btn { padding: 4px 10px; }
  .ha-main.icons .ha-btn > span { display: none; }
  .ha-msg.crit { color: color-mix(in srgb, var(--sm-crit) 45%, var(--primary-text-color)); }
  .ha-btn { all: unset; box-sizing: border-box; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; min-height: 32px;
            padding: 4px 12px; border-radius: 16px; font-size: 13px; font-weight: 500; --c: var(--sm-focus);
            color: color-mix(in srgb, var(--c) 45%, var(--primary-text-color)); background: color-mix(in srgb, var(--c) 12%, transparent); }
  .ha-btn.danger { --c: var(--sm-crit); }
  .ha-btn.sc { padding: 4px 8px; text-decoration: none; }
  .ha-btn .icon { width: 16px; height: 16px; color: var(--c); }
  .ha-btn:hover { background: color-mix(in srgb, var(--c) 20%, transparent); }
  .ha-btn:focus-visible { outline: 2px solid var(--sm-focus); outline-offset: 1px; }
  .ha-btn[disabled] { cursor: default; opacity: .5; }
  .ha-confirm { padding: 10px 12px; border-radius: 10px; background: color-mix(in srgb, var(--c) 8%, transparent); }
  .ha-confirm.ok { --c: var(--sm-focus); }
  .ha-title { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 500; }
  .ha-title .icon { color: var(--c); }
  .ha-confirm p { margin: 8px 0; font-size: 13px; line-height: 1.4; color: var(--secondary-text-color); }
  .ha-check { display: flex; gap: 6px; align-items: flex-start; font-size: 12px; margin-bottom: 8px;
              color: color-mix(in srgb, var(--c) 45%, var(--primary-text-color)); }
  .ha-check .icon { width: 16px; height: 16px; color: var(--c); }
  .ha-check pre { margin: 4px 0 0; white-space: pre-wrap; overflow-wrap: anywhere; max-height: 120px; overflow: auto; font-size: 11px; }
`;

export class SystemMonitorCard extends SystemMonitorBase {
  static getConfigElement() {
    return document.createElement("sh-system-card-editor");
  }

  static getStubConfig() {
    return {};
  }

  getCardSize() {
    return 7;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6 };
  }

  _render() {
    const sm = discover(this._hass, this._config);
    if (!sm.found) return this._noSm();
    const c = this._config;
    const parts = [];
    const ifs = c.show_network !== false ? interfaces(sm, c) : [];
    const hist = this._histFor(sm, ifs.flatMap((i) => [sm.nets[i].throughput_network_in, sm.nets[i].throughput_network_out]));
    if (c.show_system !== false) parts.push(this._system(sm, hist));
    if (c.show_network !== false) parts.push(this._network(sm, ifs, hist));
    if (c.show_storage !== false) parts.push(this._storage(sm));
    if (c.show_processes !== false) parts.push(this._processes(sm));
    parts.push(this._actions());
    return `<style>${BASE_STYLE}${TILES_STYLE}${FULL_STYLE}${NET_STYLE}${ACTIONS_STYLE}</style>
      <ha-card>
        ${this._header(sm)}
        ${this._statusRow(sm)}
        <div class="content">${parts.filter(Boolean).join("")}</div>
      </ha-card>`;
  }

  /** Name of a section title: cut with an ellipsis when the card is too narrow, its full text in title. */
  _label(key) {
    const text = esc(this._t(key));
    return `<span class="label" title="${text}">${text}</span>`;
  }

  _gauge(id, label, icon, value, display, cls, detail = "", hist = null, max = 100) {
    return `<div class="gauge clickable ${cls}" data-entity="${id || ""}" role="button" tabindex="0">${spark(hist?.[id], hist?.end, max)}
      <div class="dial">${ring(value)}<div class="val">${svgIcon(icon)}<b>${display}</b></div></div>
      <div class="lbl" title="${label}">${label}</div>
      ${detail ? `<div class="lbl2">${detail}</div>` : ""}
    </div>`;
  }

  /** A metric of the System section as a line (gauge_style: bar, #131): icon, label, bar, used / total, value. */
  _line(id, label, icon, value, display, cls, detail = "", hist = null, max = 100) {
    const p = value === null ? 0 : Math.max(0, Math.min(100, (value / max) * 100));
    return `<div class="line clickable ${cls}" data-entity="${id || ""}" role="button" tabindex="0">${spark(hist?.[id], hist?.end, max)}
      ${svgIcon(icon)}<span class="l" title="${label}">${label}</span>
      <div class="bar"><div style="width:${p}%"></div></div>
      <span class="d">${detail}</span><span class="v">${display}</span>
    </div>`;
  }

  _system(sm, hist) {
    const c = this._config;
    const sc = sm.scalars;
    const gauges = [];
    const lines = c.gauge_style === "bar";
    const gauge = (...args) => (lines ? this._line(...args) : this._gauge(...args));
    const cpu = num(this._s(sc.processor_use));
    if (sc.processor_use)
      gauges.push(gauge(sc.processor_use, this._t("cpu"), ICONS.cpu, cpu, cpu === null ? "—" : `${Math.round(cpu)}%`, metricLevel(this._config, "cpu", cpu), "", hist));

    const mem = memUsage(this._hass, sc, "memory");
    if (sc.memory_use_percent || (sc.memory_use && sc.memory_free)) {
      const detail = mem.used !== null && mem.total !== null ? fmtBytesPair(mem.used, mem.total, this._loc()) : "";
      gauges.push(
        gauge(sc.memory_use_percent || sc.memory_use, this._t("ram"), ICONS.ram, mem.pct, mem.pct === null ? "—" : `${Math.round(mem.pct)}%`, metricLevel(this._config, "ram", mem.pct), detail, hist)
      );
    }

    // Root file system, else the first mount point; `show_disk: false` leaves it to the Storage section.
    const mount = sm.disks["/"] ? "/" : Object.keys(sm.disks)[0];
    if (mount && this._config.show_disk !== false) {
      const d = sm.disks[mount];
      const u = diskUsage(this._hass, d);
      const detail = u.used !== null && u.total !== null ? fmtBytesPair(u.used, u.total, this._loc()) : "";
      gauges.push(
        gauge(d.disk_use_percent || d.disk_use || d.disk_free, `${this._t("disk")} ${esc(mount)}`, ICONS.disk, u.pct, u.pct === null ? "—" : `${Math.round(u.pct)}%`, metricLevel(this._config, "disk", u.pct), detail)
      );
    }

    const temp = temperature(this._s(sc.processor_temperature), this._hass);
    if (sc.processor_temperature)
      gauges.push(
        gauge(sc.processor_temperature, `${this._t("temperature")} ${this._t("cpu")}`, ICONS.temp, temp.c, esc(temp.display), metricLevel(this._config, "temp", temp.c), "", hist, temp.max)
      );

    const facts = [];
    // show_uptime / show_load / show_ip: each line of the System section can be left out (#129).
    const up = c.show_uptime !== false ? uptimeSec(this._s(sc.last_boot)) : null;
    if (up !== null)
      facts.push(
        `<span class="clickable" data-entity="${sc.last_boot}" role="button" tabindex="0">${svgIcon(ICONS.timer)}${this._t("uptime")} ${fmtUptime(up, this._hass, this._config)}</span>`
      );
    const loads = c.show_load !== false ? ["load_1m", "load_5m", "load_15m"].filter((k) => sc[k]) : [];
    if (loads.length)
      facts.push(
        `<span class="clickable" data-entity="${sc[loads[0]]}" role="button" tabindex="0">${svgIcon(ICONS.load)}${this._t("load")} ${loads
          .map((k) => {
            const v = num(this._s(sc[k]));
            return v === null ? "—" : fmtNum(v, this._loc(), 2);
          })
          .join(" · ")}</span>`
      );
    const ip = c.show_ip !== false ? mainIp(this._hass, sm, this._config) : null;
    if (ip) facts.push(`<span class="clickable" data-entity="${ip.entity_id}" role="button" tabindex="0">${svgIcon(ICONS.ip)}${esc(ip.state)}</span>`);

    if (!gauges.length && !facts.length) return "";
    return `<div>
      ${gauges.length ? (lines ? `<div class="lines">${gauges.join("")}</div>` : `<div class="gauges" style="--n:${gauges.length}">${gauges.join("")}</div>`) : ""}
      ${facts.length ? `<div class="facts">${facts.join("")}</div>` : ""}
    </div>`;
  }

  /**
   * show_actions, administrators only: Reload the configuration, Restart Home Assistant and, with the Supervisor,
   * Reboot the host, as in the System tab of System Hub's panel. Each is confirmed in the card itself (not in an
   * overlay, which the dashboard's containers could hold in); the restart checks the configuration first, as Home
   * Assistant's own dialog does, and is refused while it is invalid.
   */
  _actions() {
    if (this._config.show_actions !== true || !this._hass.user?.is_admin) return "";
    if (this._haConfirm) return this._haConfirmBox(this._haConfirm);
    // `buttons` (#146): the ones listed, in their own order (reload, restart, reboot); all three when not set
    const chosen = Array.isArray(this._config.buttons) ? this._config.buttons : Object.keys(HA_ACTIONS);
    const kinds = Object.keys(HA_ACTIONS).filter((k) => chosen.includes(k) && (k !== "reboot" || this._hass.config?.components?.includes("hassio")));
    const msg = this._haMsg ? `<div class="ha-msg ${this._haMsg.tone}" role="status">${esc(this._haMsg.text)}</div>` : "";
    // Icons only when the buttons with their labels would take more than one line (a phone, #129): see _fitActs.
    const buttons = this._haShortcuts() + kinds.map((k) => this._haButton(`ha_ask:${k}`, k, this._t(`ha_${k}`), k === "reload" && this._haBusy, true)).join("");
    if (!buttons && !msg) return "";
    return `<div class="ha-acts">${msg}<div class="ha-main${this._actsIcons ? " icons" : ""}">${buttons}</div></div>`;
  }

  /** The shortcuts of show_actions, in the order of `shortcuts`: a round icon per page found, before the reload, restart and reboot buttons. */
  _haShortcuts() {
    const panels = this._hass.panels || {};
    const chosen = Array.isArray(this._config.shortcuts) ? this._config.shortcuts : HA_DEFAULT_SHORTCUTS;
    return chosen.map((key) => {
      const sc = HA_SHORTCUTS.find((s) => s.key === key);
      const panel = sc?.panels.find((p) => panels[p]);
      if (!panel) return "";
      const path = sc.path || `/${panel}`;
      const label = esc(this._t(`sc_${sc.key}`));
      return `<a class="ha-btn sc" href="${path}" data-nav="${path}" title="${label}" aria-label="${label}">${svgIcon(sc.icon)}</a>`;
    }).join("");
  }

  /** A button of show_actions; `named`: its label also in title and aria-label, for when only its icon shows. */
  _haButton(action, kind, label, disabled = false, named = false) {
    const cls = HA_ACTIONS[kind]?.danger ? "danger" : "";
    const icon = HA_ACTIONS[kind]?.icon ?? ICONS.close;
    const name = named ? ` title="${esc(label)}" aria-label="${esc(label)}"` : "";
    return `<button type="button" class="ha-btn ${cls}" data-action="${action}"${name}${disabled ? " disabled" : ""}>${svgIcon(icon)}<span>${esc(label)}</span></button>`;
  }

  /**
   * The reload, restart and reboot buttons stay on one line: with their labels while they fit, else as icons only
   * (their labels in title and aria-label). Measured with the labels on each fit, never by a fixed width.
   */
  _fitActs() {
    const row = this.shadowRoot?.querySelector?.(".ha-main");
    const buttons = row ? [...row.children] : [];
    if (buttons.length < 2 || !buttons[0].getBoundingClientRect) return;
    row.classList.remove("icons");
    const tops = buttons.map((b) => Math.round(b.getBoundingClientRect().top));
    this._actsIcons = tops.some((top) => top !== tops[0]);
    row.classList.toggle("icons", this._actsIcons);
  }

  _haConfirmBox(kind) {
    const check = kind === "restart" ? this._haCheck : null;
    let status = "";
    if (check?.checking) status = `<div class="ha-check muted" role="status">${esc(this._t("ha_checking"))}</div>`;
    else if (check?.invalid)
      status = `<div class="ha-check crit" role="alert">${svgIcon(ICONS.alert)}<div><b>${esc(this._t("ha_invalid"))}</b>${check.errors ? `<pre>${esc(check.errors)}</pre>` : ""}</div></div>`;
    else if (check?.valid) status = `<div class="ha-check good" role="status">${svgIcon(ICONS.check)}<span>${esc(this._t("ha_valid"))}</span></div>`;
    const blocked = Boolean(check?.checking || check?.invalid);
    return `<div class="ha-confirm ${HA_ACTIONS[kind].danger ? "crit" : "ok"}" role="alertdialog" aria-labelledby="sm-ha-title" aria-describedby="sm-ha-text">
      <div class="ha-title" id="sm-ha-title">${svgIcon(HA_ACTIONS[kind].icon)}<span>${esc(this._t(`ha_${kind}_title`))}</span></div>
      <p id="sm-ha-text">${esc(this._t(`ha_${kind}_text`))}</p>${status}
      <div class="ha-acts">${this._haButton("ha_cancel", "cancel", this._t("ha_cancel"))}${this._haButton(`ha_ok:${kind}`, kind, this._t(`ha_${kind}`), blocked)}</div>
    </div>`;
  }

  async _haAction(action) {
    const [name, kind] = action.split(":");
    if (name === "ha_cancel") {
      this._haConfirm = null;
      this._haCheck = null;
      this._update();
      this.shadowRoot.querySelector('.ha-btn[data-action^="ha_ask:"]')?.focus?.({ preventScroll: true });
      return;
    }
    if (!HA_ACTIONS[kind]) return;
    if (name === "ha_ask") {
      this._haConfirm = kind;
      this._haMsg = null;
      this._haCheck = kind === "restart" ? { checking: true } : null;
      this._update();
      this.shadowRoot.querySelector('[data-action="ha_cancel"]')?.focus?.({ preventScroll: true });
      if (kind !== "restart") return;
      let check;
      try {
        const result = await this._hass.callApi("POST", "config/core/check_config");
        check = result?.result === "invalid" ? { invalid: true, errors: result.errors || "" } : { valid: result?.result === "valid" };
      } catch (_err) {
        // No check (the configuration panel off): Home Assistant still checks before it restarts.
        check = {};
      }
      if (this._haConfirm !== "restart") return;
      this._haCheck = check;
      this._update();
      return;
    }
    if (name !== "ha_ok" || this._haConfirm !== kind || (kind === "restart" && (this._haCheck?.checking || this._haCheck?.invalid))) return;
    this._haConfirm = null;
    this._haCheck = null;
    const [domain, service] = HA_ACTIONS[kind].service;
    const drops = kind !== "reload";
    this._haMsg = drops ? { text: this._t(kind === "reboot" ? "ha_rebooting" : "ha_restarting"), tone: "muted" } : null;
    this._haBusy = !drops;
    this._update();
    try {
      await this._hass.callService(domain, service, {});
    } catch (err) {
      const text = err?.message || err?.code || (typeof err === "string" ? err : JSON.stringify(err));
      // The restart and the reboot drop the connection: no failure to report then, Home Assistant's own banner takes over.
      if (!drops || !/connection|lost|closed/i.test(String(text))) this._haMsg = { text: this._t("ha_failed").replace("{error}", String(text)), tone: "crit" };
    }
    this._haBusy = false;
    this._update();
  }

  _network(sm, ifs, hist) {
    if (!ifs.length) return "";
    const multi = ifs.length > 1;
    const rows = ifs.map((i) => this._netRow(sm.nets[i], hist, multi ? ` · ${i}` : ""));
    return `<div>
      <div class="section-title">${svgIcon(ICONS.network)}${this._label("network")}${multi ? "" : `<span class="arg" title="${esc(ifs[0])}">· ${esc(ifs[0])}</span>`}</div>
      ${rows.join("")}
    </div>`;
  }

  // The download and upload tiles of an interface, each with its 24 h curve behind the rate when `hist` has it.
  _netRow(n, hist, sfx = "") {
    const tile = (rateKey, totalKey, cls, icon, label) => {
      const id = n[rateKey];
      const total = toBytes(this._s(n[totalKey]));
      return `<div class="tile clickable ${cls}" data-entity="${id || ""}" role="button" tabindex="0">${spark(hist?.[id], hist?.end)}${svgIcon(icon)}<div style="min-width:0">
        <div class="k" title="${esc(label)}">${esc(label)}</div>
        <div class="v">${fmtRate(toBps(this._s(id)), this._loc())}</div>
        ${total !== null ? `<div class="t">${this._t("total")} ${fmtBytes(total, this._loc())}</div>` : ""}
      </div></div>`;
    };
    return `<div class="net">
        ${tile("throughput_network_in", "network_in", "down", ICONS.down, this._t("download") + sfx)}
        ${tile("throughput_network_out", "network_out", "up", ICONS.up, this._t("upload") + sfx)}
      </div>`;
  }

  _bar(id, icon, label, u, metric) {
    const cls = metricLevel(this._config, metric, u.pct);
    return `<div class="vol clickable ${cls}" data-entity="${id || ""}" role="button" tabindex="0">
      <div class="row">${svgIcon(icon)}<span class="grow">${esc(label)}</span></div>
      <div class="bar"><div style="width:${u.pct === null ? 0 : Math.max(0, Math.min(100, u.pct))}%"></div></div>
      <div class="detail">
        <span>${u.used !== null ? `${fmtBytes(u.used, this._loc())} ${this._t("used")}${u.total !== null ? ` ${this._t("of")} ${fmtBytes(u.total, this._loc())}` : ""}` : ""}</span>
        <span>${u.pct === null ? "" : `${Math.round(u.pct)}%`}</span>
      </div>
    </div>`;
  }

  _storage(sm) {
    const rows = Object.entries(sm.disks).map(([mount, d]) =>
      this._bar(d.disk_use || d.disk_use_percent || d.disk_free, ICONS.disk, mount, diskUsage(this._hass, d), "disk")
    );
    const sc = sm.scalars;
    if (sc.swap_use_percent || (sc.swap_use && sc.swap_free)) {
      const u = memUsage(this._hass, sc, "swap");
      if (u.total !== 0) rows.push(this._bar(sc.swap_use_percent || sc.swap_use, ICONS.swap, this._t("swap"), u, "swap"));
    }
    const db = discoverDatabase(this._hass);
    if (db)
      rows.push(`<div class="vol clickable" data-entity="${db}" role="button" tabindex="0">
        <div class="row">${svgIcon(ICONS.database)}<span class="grow">${this._t("database")}</span></div>
        <div class="detail"><span>${fmtBytes(toBytes(this._s(db)), this._loc())}</span></div>
      </div>`);
    const bk = this._config.show_backups !== false ? discoverBackup(this._hass) : null;
    if (bk) {
      const b = backupStatus(this._hass, this._config, bk);
      const loc = this._loc();
      const when = b.last === null ? this._t("backup_none") : fmtRelative(b.last, loc);
      const detail = b.running ? this._t("backup_running") : b.failed ? this._t("backup_failed") : b.next !== null ? this._t("backup_next").replace("{when}", fmtRelative(b.next, loc)) : "";
      rows.push(`<div class="vol clickable backup ${b.level}" data-entity="${b.id}" role="button" tabindex="0">
        <div class="row">${svgIcon(ICONS.backup)}<span class="grow">${this._t("backup")}</span></div>
        <div class="detail">${detail ? `<span>${esc(detail)}</span>` : ""}<span class="when">${esc(when)}</span></div>
      </div>`);
    }
    if (!rows.length) return "";
    return `<div><div class="section-title">${svgIcon(ICONS.database)}${this._label("storage")}</div>${rows.join("")}</div>`;
  }

  _processes(sm) {
    const entries = Object.entries(sm.procs);
    if (!entries.length) return "";
    const n = this._stopped(sm).length;
    const open = this._procsUnfolded();
    const head = `<div class="section-title toggle ${open ? "" : "closed"}" data-action="procs" role="button" tabindex="0" aria-expanded="${open}">
        ${svgIcon(ICONS.process)}${this._label("processes")}
        ${n ? `<span class="chip crit"><span class="dot"></span>${n}</span>` : ""}
        <span class="count">${entries.length}</span>${svgIcon(ICONS.chevron, "chevron")}
      </div>`;
    // Hidden while every process runs, unless unfolded from the status tile; shown as soon as one stops.
    if (!open) return "";
    // Running green, stopped red, unavailable / unknown grey (its state in the tooltip).
    const chips = entries.map(([name, id]) => {
      const state = this._s(id)?.state;
      // Stopped as allowed in System Hub's System settings: grey, no alert
      const cls = state === "on" ? "good" : state === "off" && !this._stoppable?.has(id) ? "crit" : "muted";
      const title = cls === "muted" ? ` title="${esc(`${name}: ${this._t("st_unknown")}`)}"` : "";
      return `<span class="chip clickable ${cls}" data-entity="${id}" role="button" tabindex="0"${title}><span class="dot"></span>${esc(name)}</span>`;
    });
    return `<div>${head}<div class="procs">${chips.join("")}</div></div>`;
  }
}
