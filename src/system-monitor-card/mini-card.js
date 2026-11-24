// ---------------------------------------------------------------------------
// Mini card
// ---------------------------------------------------------------------------
import { ICONS } from "./core.js";
import { esc, fmtRate, fmtUptime, metricLevel, num, svgIcon, temperature, toBps, uptimeSec } from "./helpers.js";
import { backupStatus, discover, discoverBackup, diskUsage, fmtRelative, interfaces, memUsage, updateStatus } from "./entity-discovery.js";
import { BASE_STYLE, spark } from "./shared-styles.js";
import { SystemMonitorZoomCard } from "./zoomable-compact-card.js";

// Download / upload tiles with their 24 h curve: the network section of the full card, the rates row of the mini card.
export const NET_STYLE = `
  .net { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; }
  .net + .net { margin-top: 6px; }
  .tile { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 10px; min-width: 0;
          background: var(--secondary-background-color, rgba(127,127,127,.08)); position: relative; overflow: hidden; }
  .tile > :not(.spark) { position: relative; }
  .tile .spark { position: absolute; left: 0; bottom: 0; width: 100%; height: 55%; pointer-events: none; }
  .spark-a { fill: color-mix(in srgb, var(--c, var(--sm-blue)) 12%, transparent); }
  .spark-l { fill: none; stroke: color-mix(in srgb, var(--c, var(--sm-blue)) 50%, transparent); stroke-width: 1.2; vector-effect: non-scaling-stroke; }
  .tile .icon { color: var(--c, var(--sm-blue)); }
  .tile .k { font-size: 11px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tile .v { font-size: 14px; font-weight: 500; }
  .tile .t { font-size: 11px; color: var(--secondary-text-color); }
  .tile.up { --c: var(--info-color, #039be5); }
  .tile.down { --c: var(--sm-ok); }
  /* A narrow card (a mini card on 6 columns of a phone): one tile per line, so that each rate keeps its whole text. */
  @container (max-width: 260px) { .net { grid-template-columns: minmax(0, 1fr); } }
`;

export const MINI_STYLE = `
  /* The full card's logo size: the compact view does not shrink it. */
  .logo { height: 40px; width: 40px; align-self: flex-start; }
  .name { font-size: 16px; }
  /* One grid for every metric: the label column widens for the longest label (Datenträger), the same for all rows.
     At phone width (6 columns of a 320 px screen, 132 px inside) the gaps and the label give way (ellipsis), the bar
     keeps a few pixels and the value its whole text ("130°F"): no container query, the grid itself is the card. */
  .content { padding: 0 12px 12px; display: grid; gap: 8px min(8px, 3%);
             grid-template-columns: 18px minmax(min(64px, 30%), max-content) minmax(16px, 1fr) minmax(max-content, 56px); }
  .content > * { grid-column: 1 / -1; }
  .metric { display: grid; grid-template-columns: subgrid; align-items: center; font-size: 13px; }
  .metric .icon { color: var(--secondary-text-color); }
  .metric .v { text-align: right; font-weight: 500; white-space: nowrap; }
  .metric > span:not(.v) { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .foot { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 4px 8px; font-size: 12px; color: var(--secondary-text-color); margin-top: 2px; }
  .foot span { display: inline-flex; align-items: center; gap: 2px; }
  .foot .icon { width: 14px; height: 14px; }
  .foot .rates { flex-wrap: wrap; column-gap: 8px; }
  .foot .stopped { font-weight: 500; color: color-mix(in srgb, var(--sm-crit) 45%, var(--primary-text-color)); }
  /* 24 h curve of the CPU and RAM rows, behind the whole row. */
  .metric { position: relative; }
  .metric > :not(.spark) { position: relative; }
  .metric .spark { position: absolute; inset: -2px -4px; width: calc(100% + 8px); height: calc(100% + 4px); pointer-events: none; }
`;

/**
 * Compact card: CPU, RAM, disk and temperature bars, Core / OS status, network and uptime.
 * Its zoom button (top right, `zoom: false` removes it) switches it to the full card and back.
 */
export class SystemMonitorMiniCard extends SystemMonitorZoomCard {
  static getConfigElement() {
    return document.createElement("sh-system-mini-card-editor");
  }

  _compactSize() {
    return 3;
  }

  /** The compact view tints its header icon red while a monitored process is stopped. */
  _logoAlert(sm) {
    return !this._zoomed && this._config.show_processes !== false && this._stopped(sm).length > 0;
  }

  _metric(id, icon, label, p, display, cls, hist = null, max = 100) {
    return `<div class="metric clickable ${cls}" data-entity="${id || ""}" role="button" tabindex="0">${spark(hist?.[id], hist?.end, max)}
      ${svgIcon(icon)}<span>${label}</span>
      <div class="bar"><div style="width:${p === null ? 0 : Math.max(0, Math.min(100, p))}%"></div></div>
      <span class="v">${display}</span>
    </div>`;
  }

  _compactRender() {
    const sm = discover(this._hass, this._config);
    if (!sm.found) return this._noSm();
    const c = this._config;
    const sc = sm.scalars;
    const ifs = c.show_network !== false ? interfaces(sm, c) : [];
    const net = ifs.length ? sm.nets[ifs[0]] : null;
    // One statistics query: the CPU and RAM rows and the rates of the first interface.
    const hist = this._histFor(sm, net ? [net.throughput_network_in, net.throughput_network_out] : []);
    const rows = [];
    const cpu = num(this._s(sc.processor_use));
    if (sc.processor_use)
      rows.push(this._metric(sc.processor_use, ICONS.cpu, this._t("cpu"), cpu, cpu === null ? "—" : `${Math.round(cpu)}%`, metricLevel(this._config, "cpu", cpu), hist));
    const mem = memUsage(this._hass, sc, "memory");
    if (sc.memory_use_percent || (sc.memory_use && sc.memory_free))
      rows.push(
        this._metric(sc.memory_use_percent || sc.memory_use, ICONS.ram, this._t("ram"), mem.pct, mem.pct === null ? "—" : `${Math.round(mem.pct)}%`, metricLevel(this._config, "ram", mem.pct), hist)
      );
    if (c.show_storage !== false) {
      const mount = sm.disks["/"] ? "/" : Object.keys(sm.disks)[0];
      if (mount) {
        const d = sm.disks[mount];
        const u = diskUsage(this._hass, d);
        rows.push(
          this._metric(d.disk_use_percent || d.disk_use || d.disk_free, ICONS.disk, this._t("disk"), u.pct, u.pct === null ? "—" : `${Math.round(u.pct)}%`, metricLevel(this._config, "disk", u.pct))
        );
      }
    }
    const temp = temperature(this._s(sc.processor_temperature), this._hass);
    if (sc.processor_temperature)
      rows.push(this._metric(sc.processor_temperature, ICONS.temp, this._t("temperature"), temp.c, esc(temp.display), metricLevel(this._config, "temp", temp.c), hist, temp.max));

    const foot = [];
    const core = this._s(sm.core_update);
    const { pending, unknown } = updateStatus(core, this._s(sm.os_update));
    const status = (pending || unknown || core)?.entity_id;
    foot.push(
      `<span class="clickable ${pending ? "warn" : unknown ? "muted" : "good"}" data-entity="${status || ""}"${status ? ' role="button" tabindex="0"' : ""}><span class="dot"></span>&nbsp;${esc(
        pending
          ? `${this._t("update")} ${pending.attributes.latest_version || ""}`.trim()
          : this._t(unknown ? "st_unknown" : core ? "up_to_date" : "running")
      )}</span>`
    );
    // Stopped processes: a red item, whose click shows the full card (its processes list unfolded), or, without the
    // zoom button, the first stopped process.
    const stopped = c.show_processes !== false ? this._stopped(sm) : [];
    if (stopped.length) {
      const text = this._t(stopped.length === 1 ? "st_stopped_one" : "st_stopped").replace("{n}", stopped.length);
      const title = esc(stopped.length === 1 ? this._t("procs_one") : this._t("procs_many").replace("{n}", stopped.length));
      const target = c.zoom === false ? `data-entity="${stopped[0]}"` : `data-action="zoom"`;
      foot.push(
        `<span class="clickable crit stopped" ${target} role="button" tabindex="0" title="${title}" aria-label="${title}"><span class="dot"></span>&nbsp;${esc(text)}</span>`
      );
    }
    // Backups too old, missing or failed: an item of their level, opening the backup sensor.
    const bk = c.show_backups !== false ? discoverBackup(this._hass) : null;
    const b = bk ? backupStatus(this._hass, this._config, bk) : null;
    if (b && (b.level === "warn" || b.level === "crit")) {
      const text = b.failed ? this._t("backup_failed") : b.last === null ? this._t("backup_none") : `${this._t("backup")} ${fmtRelative(b.last, this._loc())}`;
      foot.push(`<span class="clickable ${b.level}" data-entity="${b.id}" role="button" tabindex="0"><span class="dot"></span>&nbsp;${esc(text)}</span>`);
    }
    // With their 24 h curves, the rates of the first interface get the full card's tiles above the footer (like the
    // NAS and internet box mini cards); without, they stay in the footer.
    let netRow = "";
    if (net && c.show_history !== false) {
      netRow = this._netRow(net, hist);
    } else if (net) {
      const n = net;
      // One span per direction: each rate opens its own sensor.
      const rate = (id, cls, icon) => `<span class="clickable ${cls}" data-entity="${id || ""}"${id ? ' role="button" tabindex="0"' : ""}>${svgIcon(icon)}<span>${fmtRate(toBps(this._s(id)), this._loc())}</span></span>`;
      foot.push(
        `<span class="rates">${rate(n.throughput_network_in, "down", ICONS.down)}${rate(n.throughput_network_out, "up", ICONS.up)}</span>`
      );
    }
    const up = c.show_uptime !== false ? uptimeSec(this._s(sc.last_boot)) : null;
    if (up !== null)
      foot.push(`<span class="clickable" data-entity="${sc.last_boot}" role="button" tabindex="0">${svgIcon(ICONS.timer)}${fmtUptime(up, this._hass, this._config)}</span>`);
    return `<style>${BASE_STYLE}${MINI_STYLE}${NET_STYLE}</style>
      <ha-card>
        ${this._header(sm)}
        <div class="content">
          ${rows.join("")}
          ${netRow}
          ${foot.length ? `<div class="foot">${foot.join("")}</div>` : ""}
        </div>
      </ha-card>`;
  }
}
