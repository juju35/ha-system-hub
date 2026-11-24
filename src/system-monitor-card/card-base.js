import { ICONS } from "./core.js";
import { LEVEL_COLORS, esc, fmtLang, levelColor, svgIcon, t } from "./helpers.js";
import { discover, fireMoreInfo, focusSelector, inertHtml, renderSignature, sameSignature, tapNone, updateStatus } from "./entity-discovery.js";
import { BASE_STYLE, HIST_REFRESH, HIST_WINDOW, SM_PILL, statTime } from "./shared-styles.js";
import { shBanner } from "./illustrated-header.js";
import { holdUnderPress, keepsFocus, watchOutside } from "./zoomable-compact-card.js";

export class SystemMonitorBase extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    holdUnderPress(this, () => this._update());
    this._html = "";
    this._procsOpen = false;
    this.shadowRoot.addEventListener("click", (ev) => {
      const path = ev.composedPath();
      // A shortcut (show_actions): Home Assistant's own navigation, without reloading the page; a new tab as a link.
      const nav = path.find((n) => n.dataset?.nav);
      if (nav && !ev.ctrlKey && !ev.metaKey && !ev.shiftKey && ev.button !== 1) {
        ev.preventDefault();
        history.pushState(null, "", nav.dataset.nav);
        window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
        return;
      }
      const action = path.find((n) => n.dataset?.action);
      if (action?.dataset.action === "zoom") return this._zoomClick?.(ev);
      if (action?.dataset.action.startsWith("ha_")) return this._haAction?.(action.dataset.action);
      if (action) {
        // With a process stopped, the list stays unfolded.
        if (action.dataset.action === "procs" && !this._procsKo()) this._procsOpen = !this._procsOpen;
        this._update();
        return;
      }
      const el = path.find((n) => n.dataset?.entity);
      if (el && !tapNone(this._config)) fireMoreInfo(this, el.dataset.entity);
    });
    // Keyboard: Enter / Space on an element with role="button" (gauges, tiles and rows open their entity).
    this.shadowRoot.addEventListener("keydown", (ev) => {
      if ((ev.key === "Enter" || ev.key === " ") && ev.target?.getAttribute?.("role") === "button") {
        ev.preventDefault();
        ev.target.click();
      }
    });
  }

  connectedCallback() {
    // The uptime and the relative times ("2 minutes ago") depend on the current minute: without a
    // state change, `set hass` doesn't come, so check the render signature (it includes the minute).
    this._minuteTimer = setInterval(() => this._maybeRender(), 30 * 1000);
    this._watchPill();
    // A tap or click elsewhere on the page folds the processes list (as in ha-carburants-france), unless a process is
    // stopped. On the release, not the press: folding on press would shift the layout under the pointer.
    this._outside ??= watchOutside(this, () => {
      if (!this._procsOpen) return;
      this._procsOpen = false;
      this._update();
    });
    this._outside.on();
  }

  // The status pill goes on the title row, right after the title, only when the whole title and the pill's whole
  // label fit there; otherwise it takes its own line under the subtitle (the subtitle then on one line). Its dot
  // alone on a card 200 px wide or less, or when its label is wider than the title block (or, in a banner, would not
  // fit above the ground strip). Measured after each render and on every new width (or once the web font is loaded),
  // never by a fixed width; $SM_PILL names the parts.
  _fitPill() {
    const S = SM_PILL;
    for (const t of this.shadowRoot?.querySelectorAll?.(S.block) || []) {
      const row = [...(t.children || [])].find((n) => n.matches?.(S.row));
      const name = row && [...row.children].find((n) => n.matches?.(S.name));
      const chips = row ? [...row.children].filter((n) => n.matches?.(S.chip)) : [];
      if (!name?.getBoundingClientRect || !chips.length) continue;
      t.classList.remove("pill-below", "pill-dot");
      if (this.getBoundingClientRect().width <= 200) t.classList.add("pill-dot");
      // The title's whole width (scrollWidth is rounded: 1 px more, so that a title that fits is never cut).
      const need = chips.reduce((w, c) => w + 8 + c.getBoundingClientRect().width, name.scrollWidth + 1);
      if (need <= row.getBoundingClientRect().width + 0.5) continue;
      t.classList.add("pill-below");
      const box = t.closest(".banner")?.getBoundingClientRect();
      const right = t.getBoundingClientRect().right;
      const out = [name, ...chips, ...[...t.children].filter((n) => n.matches?.(S.sub))].some((n) => {
        const r = n.getBoundingClientRect();
        return r.height > 0 && (r.right > right + 0.5 || (box && (r.top < box.top - 0.5 || r.bottom > box.bottom - 10.5)));
      });
      if (out) t.classList.add("pill-dot");
    }
  }

  // Fitted again on a new width, a new content (a render) and once the web font is loaded, in the next frame.
  _watchPill() {
    if (this._pillWatch || typeof ResizeObserver !== "function") return;
    const fit = () => {
      cancelAnimationFrame(this._pillFrame);
      this._pillFrame = requestAnimationFrame(() => {
        this._fitPill();
        this._fitActs?.();
      });
    };
    this._pillWatch = [new ResizeObserver(fit), typeof MutationObserver === "function" ? new MutationObserver(fit) : null];
    this._pillWatch[0].observe(this);
    if (this.shadowRoot) this._pillWatch[1]?.observe(this.shadowRoot, { childList: true, subtree: true, characterData: true });
    document.fonts?.ready?.then(fit);
    fit();
  }

  _unwatchPill() {
    for (const o of this._pillWatch || []) o?.disconnect();
    this._pillWatch = null;
  }

  disconnectedCallback() {
    this._unwatchPill();
    clearInterval(this._minuteTimer);
    this._outside?.off();
    this._dropPress();
    // Left (another dashboard view, a conditional card hidden): the processes list comes back folded, a confirmation
    // of show_actions is dropped.
    this._procsOpen = false;
    this._haConfirm = null;
    this._haCheck = null;
  }

  set hass(hass) {
    this._hass = hass;
    this._loadStoppable();
    this._maybeRender();
  }

  /**
   * The processes that may be stopped, chosen in System Hub's System settings: read once, then not counted as stopped
   * (grey chip). Without System Hub loaded, none.
   */
  _loadStoppable() {
    if (this._stoppableAsked || !this._hass?.callWS) return;
    this._stoppableAsked = true;
    this._hass
      .callWS({ type: "system_hub/stoppable_processes" })
      .then((ids) => {
        this._stoppable = new Set(Array.isArray(ids) ? ids : []);
        if (!this._stoppable.size) return;
        this._sig = null;
        this._maybeRender();
      })
      .catch(() => {});
  }

  /** Home Assistant sets hass on every state change of the instance: render only when one the card shows changed. */
  _maybeRender() {
    if (!this._hass) return;
    const sig = renderSignature(this._hass, this._config);
    if (sameSignature(this._sig, sig)) return;
    this._sig = sig;
    this._update();
  }

  get hass() {
    return this._hass;
  }

  setConfig(config) {
    if (!config) throw new Error("Invalid configuration");
    this._config = { ...config };
    // show_title / show_subtitle: the header"s title / subtitle, hidden by the stylesheet
    this.toggleAttribute?.("hide-title", config.show_title === false);
    this.toggleAttribute?.("hide-subtitle", config.show_subtitle === false);
    // ok_color / warning_color / critical_color (#131): on the host, over the stylesheet's defaults.
    for (const [key, prop] of Object.entries(LEVEL_COLORS)) {
      const color = levelColor(config[key]);
      if (color) this.style?.setProperty(prop, color);
      else this.style?.removeProperty(prop);
    }
    this._html = "";
    this._update();
  }

  _t(key) {
    return t(this._hass, this._config, key);
  }

  /** Locale of the card's numbers (decimal separator). */
  _loc() {
    return fmtLang(this._hass, this._config);
  }

  _s(id) {
    return id ? this._hass.states[id] : undefined;
  }

  _update() {
    if (!this._hass || !this._config) return;
    // Held under a press (see holdUnderPress), drawn after its click.
    if (this._pressing) {
      this._dirty = true;
      return;
    }
    this._dirty = false;
    const banner = shBanner(this._render(), { hass: this._hass, config: this._config, scene: 'system', pad: '0' });
    const html = tapNone(this._config) ? inertHtml(banner) : banner;
    if (html !== this._html) {
      // Re-rendering replaces the buttons: keep the focus, without scrolling the page back to the card
      // (a mouse click focuses gauges and rows too).
      const active = this.shadowRoot.activeElement;
      const focused = keepsFocus(this, active) && focusSelector(active);
      this._html = html;
      this.shadowRoot.innerHTML = html;
      if (focused) this.shadowRoot.querySelector(focused)?.focus({ preventScroll: true });
    }
  }

  // 24 h of 5-minute means from the recorder's statistics, fetched again every 5 minutes. Returns what is
  // already there (nothing at first): the card renders again when the answer comes.
  _history(ids) {
    const key = ids.join(",");
    if (key && this._hass.callWS && (this._histKey !== key || Date.now() - this._histAt > HIST_REFRESH)) {
      const end = Date.now();
      this._histKey = key;
      this._histAt = end;
      this._hass
        .callWS({
          type: "recorder/statistics_during_period",
          start_time: new Date(end - HIST_WINDOW).toISOString(),
          statistic_ids: ids,
          period: "5minute",
          types: ["mean"],
        })
        .then((r) => {
          if (this._histKey !== key) return;
          // [time, mean] pairs; the window ends at the request time, so the curves stay put until the next fetch.
          const series = ids.map((id) => [id, (r?.[id] || []).map((p) => [statTime(p), p.mean]).filter(([at, v]) => Number.isFinite(at) && Number.isFinite(v))]);
          this._hist = { ...Object.fromEntries(series), end };
          this._update();
        })
        // No statistics (sensor without state_class, recorder off): try again in a minute, no curve meanwhile.
        .catch(() => {
          this._histAt = Date.now() - HIST_REFRESH + 60000;
        });
    }
    return this._histKey === key ? this._hist : null;
  }

  /**
   * The 24 h history of the CPU and RAM percentages, the CPU temperature and the given rate sensors, in one
   * statistics query (null with `show_history: false`). RAM only from its percentage sensor.
   */
  _histFor(sm, rateIds = []) {
    if (this._config.show_history === false) return null;
    const sc = sm.scalars;
    return this._history([sc.processor_use, sc.memory_use_percent, sc.processor_temperature, ...rateIds].filter(Boolean));
  }

  _header(sm, aside = "") {
    const c = this._config;
    const core = this._s(sm.core_update);
    const os = this._s(sm.os_update);
    const coreVersion = core?.attributes.installed_version || this._hass.config?.version;
    const osVersion = os?.attributes.installed_version;
    const sub = [coreVersion ? `Core ${coreVersion}` : null, osVersion ? `OS ${osVersion}` : null].filter(Boolean).join(" · ");
    // Status chip: pending Core / OS update, else "up to date" (or "running" without update entities).
    const { pending, unknown } = updateStatus(core, os);
    // Its full text stays in title and aria-label: on a narrow header the pill is cut, then shows its dot only.
    const pill = (cls, entity, text) =>
      `<span class="chip ${cls}" data-entity="${entity || ""}"${entity ? ' role="button" tabindex="0"' : ""} title="${esc(text)}" aria-label="${esc(text)}"><span class="dot"></span><span class="chip-text">${esc(text)}</span></span>`;
    // The header icon takes the status colour of the pill: green up to date, orange update pending, grey unknown.
    // A subclass may tint it red instead (the compact view of the mini card, while a process is stopped).
    const iconCls = this._logoAlert(sm) ? "crit" : pending ? "warn" : unknown ? "muted" : "good";
    let chip;
    // The icon red for stopped processes (compact mini card): the pill says so, in the same colour.
    const stopped = iconCls === "crit" ? this._stopped(sm) : [];
    if (stopped.length) chip = pill("clickable crit", stopped[0], this._t(stopped.length === 1 ? "st_stopped_one" : "st_stopped").replace("{n}", stopped.length));
    else if (pending) {
      const text = `${this._t("update")} ${pending.attributes.latest_version || ""}`.trim();
      chip = pill("clickable warn", pending.entity_id, text);
    } else if (unknown) chip = pill("clickable muted", unknown.entity_id, this._t("st_unknown"));
    else chip = pill(`good ${core ? "clickable" : ""}`, core?.entity_id, this._t(core ? "up_to_date" : "running"));
    return `
      <div class="header">
        <span class="logo ${iconCls}" aria-hidden="true">${svgIcon(ICONS.monitor_dashboard)}</span>
        <div class="titles">
          <div class="title-row"><div class="name">${esc(c.title || "Home Assistant")}</div>${chip}</div>
          <div class="sub" title="${esc(sub)}">${esc(sub)}</div>
        </div>
        ${aside}
      </div>`;
  }

  /** Whether the header icon turns red whatever the update status: never on the full card. */
  _logoAlert() {
    return false;
  }

  /**
   * Monitored processes that are stopped (process binary sensors off). An unavailable or unknown sensor says nothing
   * about its process: it is not counted (grey chip, see `_unknownProcs`).
   */
  _stopped(sm) {
    return Object.values(sm.procs).filter((id) => this._s(id)?.state === "off" && !this._stoppable?.has(id));
  }

  /** Monitored processes whose sensor is neither on nor off (unavailable, unknown, missing). */
  _unknownProcs(sm) {
    return Object.values(sm.procs).filter((id) => !["on", "off"].includes(this._s(id)?.state));
  }

  _procsKo() {
    return this._stopped(discover(this._hass, this._config)).length > 0;
  }

  /**
   * The processes section is always unfolded while a process is stopped. Otherwise it is folded
   * by default, unfolds on a click and folds again on a click elsewhere.
   */
  _procsUnfolded() {
    return this._procsKo() || !!this._procsOpen;
  }

  /** Processes status tile: all running, or how many are stopped. */
  _procsStat(sm) {
    if (this._config.show_processes === false || !Object.keys(sm.procs).length) return "";
    const n = this._stopped(sm).length;
    // None stopped but some not reported: the tile does not claim they all run.
    if (!n && this._unknownProcs(sm).length) {
      const unknown = this._t("st_unknown");
      return this._stat("procs", ICONS.process, this._t("processes"), unknown, "muted", `${this._t("processes")}: ${unknown}`);
    }
    const text = n === 0 ? this._t("procs_ok") : n === 1 ? this._t("procs_one") : this._t("procs_many").replace("{n}", n);
    const value = n === 0 ? this._t("st_running") : this._t(n === 1 ? "st_stopped_one" : "st_stopped").replace("{n}", n);
    return this._stat("procs", ICONS.process, this._t("processes"), value, n ? "crit" : "good", text);
  }

  /**
   * A status tile of the row under the header: section icon and name, status in its color; a click folds or unfolds that section.
   * Returns its status class with its HTML, so that callers don't have to read the status back from the markup.
   */
  _stat(action, icon, label, value, cls, title) {
    return {
      cls,
      html: `<div class="stat clickable ${cls}" data-action="${action}" role="button" tabindex="0" title="${esc(title)}" aria-label="${esc(title)}">
        <div class="k">${svgIcon(icon)}<span>${esc(label)}</span></div><div class="v">${esc(value)}</div>
      </div>`,
    };
  }

  /** Status tiles shown: processes. */
  _stats(sm) {
    return [this._procsStat(sm)].filter(Boolean);
  }

  /** Overall statuses (processes), under the header. */
  _statusRow(sm) {
    const stats = this._stats(sm);
    return stats.length ? `<div class="stats" style="--n:${stats.length}">${stats.map((x) => x.html).join("")}</div>` : "";
  }

  _noSm() {
    return `<style>${BASE_STYLE}</style><ha-card><div class="warning">${esc(this._t("no_sm"))}</div></ha-card>`;
  }
}
