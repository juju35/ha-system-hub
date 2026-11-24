import { ICONS, PLATFORM } from "./core.js";
import { ago, byDateDesc, esc, morph, navigate, sameSig, svgIcon, t, valid } from "./helpers.js";
import { automationCount, deviceOf, excludedDevices, excludedEntities, findSensors } from "./registry-based-resolution.js";
import { AM_PILL, BASE_STYLE, CONFIRM_GUARD_MS, DIALOG_STYLE, watchOutside } from "./shared-styles.js";
import { shBanner, shbIsNight } from "./illustrated-header.js";

export class AutomationMonitorBase extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._html = "";
    this._expanded = {};
    this.shadowRoot.addEventListener("click", (ev) => this._onClick(ev));
    // Escape closes the confirmation popup (as Cancel). Listened on the window, in the capture phase so a
    // dialog around the card (the card editor preview) does not get it first and close too, only while open.
    this._onKey = (ev) => {
      if (ev.key !== "Escape" || !this._confirm) return;
      ev.stopPropagation();
      this._closeConfirm();
    };
    // Keyboard access: Enter or Space on a focusable non-button element acts as a click.
    this.shadowRoot.addEventListener("keydown", (ev) => {
      if ((ev.key === "Enter" || ev.key === " ") && ev.target.getAttribute?.("role") === "button") {
        ev.preventDefault();
        ev.target.click();
      }
    });
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;
    // Render only when a state the card shows has changed, not on every state change of Home Assistant.
    const sig = this._signature();
    if (sameSig(sig, this._sig)) return;
    this._update(sig);
  }

  get hass() {
    return this._hass;
  }

  setConfig(config) {
    if (!config) throw new Error("Invalid configuration");
    this.connectedWhileHidden = true;
    this._config = { ...config };
    // show_title / show_subtitle: the header"s title / subtitle, hidden by the stylesheet
    this.toggleAttribute?.("hide-title", config.show_title === false);
    this.toggleAttribute?.("hide-subtitle", config.show_subtitle === false);
    this._folds = {};
    this._expanded = {};
    this._html = "";
    this._update();
  }

  // Relative times ("5 minutes ago") are refreshed every minute even without a state change: the render
  // is patched in place, so only their text changes. An "All good" card shows no relative time, so the
  // tick skips the render (signature + full render chain) until a list has items again.
  connectedCallback() {
    this._observeWidth();
    this._watchPill();
    this._timer = setInterval(() => {
      if (this._showsRelativeTime()) this._update();
    }, 60000);
    // A tap or click elsewhere on the page folds the lists back to their defaults and shortens them again
    // (as in ha-carburants-france). On the release, not the press: folding on press would shift the
    // layout under the pointer.
    this._outside ??= watchOutside(this, (ev) => {
      if (!this._confirm && !Object.keys(this._folds || {}).length && !Object.keys(this._expanded).length) return;
      // A click outside the card closes the confirmation popup (as Cancel) before anything else: the event
      // is remembered so the mini card does not also leave its zoomed view on that same click. The focus
      // stays where the user clicked.
      if (this._confirm) {
        this._confirmCloseEvent = ev;
        return this._closeConfirm(false);
      }
      this._folds = {};
      this._expanded = {};
      this._update();
    });
    this._outside.on();
    // Back on the page after leaving it: rendered again in its default state.
    if (this._hass && this._config) this._update();
    // A confirmation popup still open when the card is attached again (Lovelace keeps the card of a view
    // that is left and attaches it again on return) keeps closing on Escape.
    if (this._confirm) window.addEventListener("keydown", this._onKey, true);
  }

  // The card's width sets the host attributes the styles adapt to (no CSS size container, see :host above):
  // narrow below 384 px, compact below 320 px, nologo below 280 px, tiny below 245 px. Only a width change counts,
  // and the attributes are set on the next frame, not in the callback: they change the card's height, and resizing
  // the observed card inside its own callback is a "ResizeObserver loop completed with undelivered notifications"
  // error on window at every threshold crossed.
  _observeWidth() {
    if (typeof ResizeObserver === "undefined") return;
    this._roWidth = undefined;
    this._ro ??= new ResizeObserver((entries) => {
      const w = entries[entries.length - 1].contentRect.width;
      if (!w || w === this._roWidth) return;
      this._roWidth = w;
      if (this._roFrame) cancelAnimationFrame(this._roFrame);
      this._roFrame = requestAnimationFrame(() => {
        this._roFrame = 0;
        this.toggleAttribute("narrow", w < 384);
        this.toggleAttribute("compact", w < 320);
        this.toggleAttribute("nologo", w < 280);
        this.toggleAttribute("tiny", w < 245);
      });
    });
    this._ro.observe(this);
  }

  // The status pill goes on the title row, right after the title, only when the whole title and the pill's whole
  // label fit there; otherwise it takes its own line under the subtitle (the subtitle then on one line). Its dot
  // alone on a card 200 px wide or less, or when its label is wider than the title block (or, in a banner, would not
  // fit above the ground strip). Measured after each render and on every new width (or once the web font is loaded),
  // never by a fixed width; $AM_PILL names the parts.
  _fitPill() {
    const S = AM_PILL;
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
      this._pillFrame = requestAnimationFrame(() => this._fitPill());
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
    this._ro?.disconnect();
    if (this._roFrame) cancelAnimationFrame(this._roFrame);
    this._roFrame = 0;
    clearInterval(this._timer);
    this._stopRefresh();
    this._outside?.off();
    window.removeEventListener("keydown", this._onKey, true);
    // Left (another dashboard view, a conditional card hidden): back to the defaults, so that the card does not
    // come back unfolded or with its popup open.
    this._folds = {};
    this._expanded = {};
    this._confirm = null;
  }

  // True when the card shows at least one relative time: every one of them (subtitle, list items, mini
  // card lines) comes from a shown failed automation or unavailable linked entity.
  _showsRelativeTime() {
    if (!this._hass || !this._config) return false;
    const data = this._data();
    if (data.error) return false;
    const c = this._config;
    return (c.show_failed !== false && data.failures.length > 0) || (c.show_linked !== false && data.linked.length > 0);
  }

  _t(key, vars) {
    return t(this._hass, this._config, key, vars);
  }

  _s(id) {
    return id ? this._hass.states[id] : undefined;
  }

  // Trace, editor links and the Clear / Refresh buttons open admin pages or call admin actions: only
  // administrators get them.
  get _admin() {
    return !!this._hass?.user?.is_admin;
  }

  // What the render depends on: registries, language, the two sensors, the automations, scripts and
  // scenes they list (names, editor ids) and, only while the subtitle shows it, the number of automations
  // (counting them walks every state, and hass.states is replaced on each state change).
  _signature() {
    const h = this._hass;
    const sig = [h.entities, h.devices, shbIsNight(h, this._config), h.language, h.locale?.language, h.locale?.time_format, this._admin];
    const found = findSensors(h, this._config);
    if (found.error) return sig;
    const list = (v) => (Array.isArray(v) ? v : []);
    for (const id of [found.failed, found.linked]) {
      const s = this._s(id);
      sig.push(s);
      for (const item of [...list(s?.attributes?.automations), ...list(s?.attributes?.entities)]) {
        sig.push(h.states[item.entity_id]);
        for (const src of [...list(item.referenced_by_details), ...list(item.referenced_by)]) sig.push(h.states[src?.entity_id ?? src]);
      }
    }
    if (!this._compact) {
      const data = this._data();
      if (!data.error && !this._hasLastFailure(data)) sig.push(automationCount(h));
    }
    return sig;
  }

  // Set by Lovelace while the dashboard is edited (editMode) and in the card editor's preview (preview): a card
  // hidden by hide_when_ok shows again there, so that it can still be edited.
  set editMode(v) {
    this._editMode = v;
    this._update();
  }

  get editMode() {
    return this._editMode;
  }

  set preview(v) {
    this._preview = v;
    this._update();
  }

  get preview() {
    return this._preview;
  }

  // hide_when_ok: hidden while the status is "All good" (never while a sensor can't be read).
  // Hides the card and tells Lovelace (card-visibility-changed): hui-card reads the `hidden` property and then
  // drops the card's slot in a sections view. connectedWhileHidden keeps the card in the DOM so that it keeps
  // following its entities and shows again on its own. Never hidden in the editor preview / edit mode.
  _applyVisibility() {
    const data = this._data();
    const hide = this._config.hide_when_ok === true && !this._editMode && !this._preview && !data.error && this._status(data).cls === "ok";
    this.connectedWhileHidden = true;
    this.style.display = hide ? "none" : "";
    if (!!this.hidden === hide) return hide;
    this.hidden = hide;
    this.dispatchEvent(new CustomEvent("card-visibility-changed", { detail: { value: !hide }, bubbles: true, composed: true }));
    return hide;
  }

  _update(sig) {
    if (!this._hass || !this._config) return;
    this._sig = sig ?? this._signature();
    this._applyVisibility();
    let html = this._render();
    if (this._confirm) {
      html = html.replace(/<ha-card>([\s\S]*)<\/ha-card>\s*$/, (_, inner) => `<ha-card class="dialog-open">${inner}${this._confirmHtml()}</ha-card>`);
    }
    html = shBanner(html, { hass: this._hass, config: this._config, scene: 'automations', pad: '0' });
    if (html !== this._html) {
      this._html = html;
      morph(this.shadowRoot, html);
    }
  }

  // Service call whose failure is logged (Home Assistant already shows a toast) instead of left unhandled.
  _call(domain, service, data) {
    return Promise.resolve()
      .then(() => this._hass.callService(domain, service, data))
      .then(
        () => true,
        (err) => {
          console.error(`automation-monitor-card: ${domain}.${service} failed`, err);
          return false;
        }
      );
  }

  // End of the Refresh button spin (also on a failed call, or when the card is removed).
  _stopRefresh() {
    clearTimeout(this._refreshTimer);
    this._refreshTimer = null;
    if (!this._refreshing) return;
    this._refreshing = false;
    this._update();
  }

  _onClick(ev) {
    const el = ev.composedPath().find((n) => n.dataset && (n.dataset.entity || n.dataset.action || n.dataset.path));
    // Just closed: the rest of a double click on OK does nothing.
    if (!this._confirm && Date.now() - (this._confirmClosedAt ?? 0) < CONFIRM_GUARD_MS) {
      ev.stopPropagation();
      return;
    }
    // Confirmation popup open: only its buttons and the backdrop itself (outside the dialog) act.
    if (this._confirm) {
      ev.stopPropagation();
      const action = el?.dataset.action;
      if (action === "confirm_ok") {
        const { data } = this._confirm;
        this._closeConfirm();
        for (const d of [].concat(data)) this._call(PLATFORM, "reset", d);
      } else if (action === "confirm_cancel" || (action === "confirm_backdrop" && ev.composedPath()[0] === el)) {
        this._closeConfirm();
      }
      return;
    }
    if (!el) return;
    ev.stopPropagation();
    const { action, entity, label, path } = el.dataset;
    if (path) return navigate(path);
    if (action === "fold") {
      this._folds = { ...this._folds, [el.dataset.section]: !this._isOpen(el.dataset.section) };
      return this._update();
    }
    if (action === "expand") {
      this._expanded = { ...this._expanded, [entity]: !this._expanded[entity] };
      return this._update();
    }
    if (action === "reset") {
      this._openConfirm({ data: { entity_id: entity }, text: this._t("confirm_reset", { name: label }), ok: this._t("reset"), opener: el });
    } else if (action === "reset_all") {
      // Failures left out by exclude_devices / exclude_entities stay: then only the listed automations are
      // cleared, one call each (the action takes a single entity_id); otherwise one call clears them all.
      const data = this._data();
      const ids = data.failuresHidden ? [...new Set(data.failures.map((a) => a.entity_id))].map((entity_id) => ({ entity_id })) : {};
      this._openConfirm({ data: ids, text: this._t("confirm_reset_all"), ok: this._t("reset_all"), opener: el });
    } else if (action === "rebuild") {
      // Short spin of the button: the sensors update on their own once the rebuild is done.
      this._refreshing = true;
      this._update();
      clearTimeout(this._refreshTimer);
      this._refreshTimer = setTimeout(() => this._stopRefresh(), 1200);
      this._call(PLATFORM, "rebuild_linked_entities", {}).then((ok) => ok || this._stopRefresh());
    } else if (entity) {
      this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: entity }, bubbles: true, composed: true }));
    }
  }

  // Confirmation before a Clear / Clear all service call: Cancel (button, Escape, backdrop or a click
  // outside the card) does nothing.
  _openConfirm(confirm) {
    this._confirm = confirm;
    window.addEventListener("keydown", this._onKey, true);
    this._update();
    // preventScroll: opening the popup must not bring a scrolled page back to the card.
    this.shadowRoot.querySelector(".modal .primary")?.focus({ preventScroll: true });
  }

  // The focus goes back to the Clear button that opened the popup (its OK button leaves the DOM), unless
  // the popup was closed by a click elsewhere on the page.
  _closeConfirm(restoreFocus = true) {
    const opener = this._confirm?.opener;
    this._confirm = null;
    this._confirmClosedAt = Date.now();
    window.removeEventListener("keydown", this._onKey, true);
    this._update();
    if (restoreFocus && opener?.isConnected) opener.focus({ preventScroll: true });
  }

  _confirmHtml() {
    const c = this._confirm;
    return `<style>${DIALOG_STYLE}</style><div class="backdrop" data-action="confirm_backdrop">
      <div class="modal" role="dialog" aria-modal="true" aria-describedby="confirm-msg">
        <div class="msg" id="confirm-msg">${esc(c.text)}</div>
        <div class="modal-actions">
          <button class="btn" data-action="confirm_cancel"><span>${esc(this._t("cancel"))}</span></button>
          <button class="btn primary" data-action="confirm_ok"><span>${esc(c.ok)}</span></button>
        </div>
      </div>
    </div>`;
  }

  // Current data of the integration, computed once per hass object and configuration: the signature
  // (on every state change) and the render that follows it share the same filtered and sorted lists.
  _data() {
    const memo = this._dataMemo;
    if (memo && memo.hass === this._hass && memo.config === this._config) return memo.data;
    const data = this._computeData();
    this._dataMemo = { hass: this._hass, config: this._config, data };
    return data;
  }

  // Lists from the sensor attributes, most recent first.
  _computeData() {
    const found = findSensors(this._hass, this._config);
    if (found.error) return found;
    const f = this._s(found.failed);
    const l = this._s(found.linked);
    if (!valid(f) && !valid(l)) return { error: "unavailable" };
    // Items of an ignored device or entity are left out everywhere: lists, counters and status.
    const ignored = excludedDevices(this._hass, this._config);
    const ignoredIds = excludedEntities(this._config);
    const keep = (item) => !ignored?.has(deviceOf(this._hass, item)) && !ignoredIds?.(item.entity_id);
    const allFailures = valid(f) && Array.isArray(f.attributes.automations) ? f.attributes.automations : [];
    const failures = allFailures.filter(keep).sort(byDateDesc("last_error_time"));
    const linked = (valid(l) && Array.isArray(l.attributes.entities) ? l.attributes.entities : []).filter(keep).sort(byDateDesc("unavailable_since"));
    // A sensor that is unavailable, unknown or missing (disabled) says nothing: its counter and the status chip
    // must not read it as 0 problems.
    const failuresHidden = failures.length < allFailures.length;
    return { failedId: found.failed, linkedId: found.linked, failures, failuresHidden, linked, failedNA: !valid(f), linkedNA: !valid(l) };
  }

  _status(data) {
    const c = this._config;
    const nf = c.show_failed === false ? 0 : data.failures.length;
    const nl = c.show_linked === false ? 0 : data.linked.length;
    const n = nf + nl;
    if (n) return { cls: nf ? "crit" : "warn", text: this._t("n_problems", { n }), entity: nf ? data.failedId : data.linkedId };
    // No problem known, but a shown list cannot be read: not "All good".
    const na = (c.show_failed !== false && data.failedNA) || (c.show_linked !== false && data.linkedNA);
    if (na) return { cls: "na", text: this._t("sensor_unavailable"), entity: (c.show_failed !== false && data.failedNA ? data.failedId : data.linkedId) || "" };
    return { cls: "ok", text: this._t("all_ok"), entity: data.failedId || data.linkedId };
  }

  // True when the subtitle shows the time of the most recent failure (the signature only needs to know
  // that, not the formatted text).
  _hasLastFailure(data) {
    return this._config.show_failed !== false && data.failures.length > 0 && Number.isFinite(Date.parse(data.failures[0].last_error_time));
  }

  // Relative time of the most recent failure shown in the subtitle, or "".
  _lastFailure(data) {
    return this._hasLastFailure(data) ? ago(this._hass, this._config, data.failures[0].last_error_time) : "";
  }

  _sub(data) {
    const when = this._lastFailure(data);
    if (when) return this._t("last_failure", { when });
    // All automations of Home Assistant: the integration does not expose how many it monitors
    // (its exclusions are not visible to the card), so the label does not claim they are monitored.
    const n = automationCount(this._hass);
    return n ? this._t("automations", { n }) : "";
  }

  _header(data, sub) {
    const c = this._config;
    const status = this._status(data);
    return `
      <div class="header">
        <div class="logo ${status.cls}" aria-hidden="true">${svgIcon(ICONS.robot_confused)}</div>
        <div class="titles">
          <div class="title-row"><div class="name">${esc(c.title || "Automation Monitor")}</div><span class="chip clickable ${status.cls}" role="button" tabindex="0" data-entity="${esc(status.entity || "")}" title="${esc(status.text)}" aria-label="${esc(
            status.text
          )}"><span class="dot"></span><span class="txt">${esc(status.text)}</span></span></div>
          ${sub ? `<div class="sub" title="${esc(sub)}">${esc(sub)}</div>` : ""}
        </div>
        ${
          this._admin
            ? `<button class="refresh ${this._refreshing ? "spin" : ""}" data-action="rebuild" title="${esc(`${this._t("rebuild")} · ${this._t("rebuild_title")}`)}" aria-label="${esc(this._t("rebuild"))}">${svgIcon(ICONS.refresh)}</button>`
            : ""
        }
        ${this._zoomButton()}
      </div>`;
  }

  // Button at the far right of the header: only the mini card has one.
  _zoomButton() {
    return "";
  }

  _counters(data) {
    const c = this._config;
    // An unreadable sensor: a dash in a neutral counter (its own icon, not the check mark of 0), "Sensor
    // unavailable" in its tooltip.
    const counter = (id, icon, n, label, cls, na) =>
      `<div class="counter clickable ${na ? "na" : n ? cls : "ok"}" role="button" tabindex="0" data-entity="${esc(id || "")}"${
        na ? ` title="${esc(this._t("sensor_unavailable"))}"` : ""
      }>
        <div class="badge">${svgIcon(n || na ? icon : ICONS.check)}</div>
        <div><div class="n">${na ? "—" : n}</div><div class="lbl">${esc(label)}</div></div>
      </div>`;
    const list = [];
    if (c.show_failed !== false)
      list.push(
        counter(data.failedId, ICONS.robot_alert, data.failures.length, this._t(this._compact ? "failed_short" : "failed_automations"), "crit", data.failedNA)
      );
    if (c.show_linked !== false)
      list.push(
        counter(data.linkedId, ICONS.disconnect, data.linked.length, this._t(this._compact ? "linked_short" : "linked_unavailable"), "warn", data.linkedNA)
      );
    return list.length ? `<div class="counters" style="${list.length === 1 ? "grid-template-columns:minmax(0,1fr)" : ""}">${list.join("")}</div>` : "";
  }

  _errorCard(key) {
    return `<style>${BASE_STYLE}</style><ha-card><div class="warning">${esc(this._t(key))}</div></ha-card>`;
  }
}
