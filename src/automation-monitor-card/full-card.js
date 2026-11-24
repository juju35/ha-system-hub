// ---------------------------------------------------------------------------
// Full card
// ---------------------------------------------------------------------------
import { DEFAULT_MAX_ITEMS, ICONS } from "./core.js";
import { ago, esc, fullDate, svgIcon } from "./helpers.js";
import { editorPath, tracePath } from "./registry-based-resolution.js";
import { BASE_STYLE } from "./shared-styles.js";
import { AutomationMonitorBase } from "./card-base.js";

export const FULL_STYLE = `
  .content { padding: 0 12px 12px; display: flex; flex-direction: column; gap: 12px; }
  .section-title { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 500; text-transform: uppercase;
                   letter-spacing: .04em; color: var(--secondary-text-color); margin-bottom: 6px; min-height: 24px; }
  .section-title .icon { width: 16px; height: 16px; }
  /* The label takes the room left and wraps; the button, count and chevron never shrink. */
  .section-title .toggle { flex: 1 1 auto; min-width: 0; display: flex; align-items: center; gap: 6px; border-radius: 6px; }
  .section-title .label { min-width: 0; overflow-wrap: anywhere; }
  .section-title .count { text-transform: none; letter-spacing: 0; font-weight: 400; flex: none; }
  .section-title .btn { text-transform: none; letter-spacing: 0; flex: none; }
  /* Narrow card (below 384 px): the Clear all button shows only its icon (its text stays in title and aria-label). */
  :host([narrow]) .section-title .btn > span { display: none; }
  :host([narrow]) .section-title .btn { padding: 4px 6px; }
  .section-title.fold { cursor: pointer; user-select: none; }
  .section-title .chevron { transition: transform .2s ease; }
  .section-title.closed { margin-bottom: 0; }
  .section-title.closed .chevron { transform: rotate(-90deg); }
  .items { display: flex; flex-direction: column; gap: 6px; }
  .item { display: flex; gap: 8px; padding: 8px 10px; border-radius: 12px; min-width: 0;
          background: var(--secondary-background-color, rgba(127,127,127,.08)); border-left: 3px solid var(--c); }
  .item > .icon { width: 20px; height: 20px; color: var(--c); margin-top: 1px; }
  .item .body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
  /* Name, then time: the time goes under the name when both do not fit, and both truncate rather than overflow. */
  .item .top { display: flex; flex-wrap: wrap; align-items: baseline; column-gap: 8px; row-gap: 1px; min-width: 0; }
  .item .title { flex: 1 1 auto; min-width: 0; max-width: 100%; font-size: 13px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .item .when { font-size: 12px; color: var(--secondary-text-color); white-space: nowrap; flex: 0 1 auto; min-width: 0; max-width: 100%;
                overflow: hidden; text-overflow: ellipsis; }
  .item .eid { font-size: 12px; color: var(--secondary-text-color); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .item .msg { font-family: var(--code-font-family, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace); font-size: 12px; line-height: 1.4;
               padding: 4px 8px; border-radius: 8px; overflow-wrap: anywhere; color: var(--primary-text-color);
               background: color-mix(in srgb, var(--c) 10%, transparent); }
  .tags { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .tag { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; padding: 1px 6px; border-radius: 8px; max-width: 100%;
         background: var(--card-background-color, rgba(127,127,127,.12)); color: var(--primary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tag .icon { width: 14px; height: 14px; color: var(--secondary-text-color); }
  .tag.link { cursor: pointer; }
  .tag.link:hover { color: var(--am-blue-text); }
  .tag.link:hover .icon { color: var(--am-blue); }
  .tag.streak { color: color-mix(in srgb, var(--am-crit) 50%, var(--primary-text-color, #212121)); }
  .tag.streak .icon { color: var(--am-crit); }
  .actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 2px; }
  .item .btn { background: var(--card-background-color, rgba(127,127,127,.12)); }
  .used { font-size: 12px; color: var(--secondary-text-color); }
  .more { align-self: center; }
`;

export class AutomationMonitorCard extends AutomationMonitorBase {
  static getConfigElement() {
    return document.createElement("sh-automations-card-editor");
  }

  static getStubConfig() {
    return {};
  }

  getCardSize() {
    if (this.hidden) return 0;
    return 6;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6 };
  }

  _render() {
    const data = this._data();
    if (data.error) return this._errorCard(data.error);
    const c = this._config;
    const parts = [this._counters(data)];
    if (c.show_failed !== false) parts.push(this._failedSection(data));
    if (c.show_linked !== false) parts.push(this._linkedSection(data));
    return `<style>${BASE_STYLE}${FULL_STYLE}</style>
      <ha-card>
        ${this._header(data, this._sub(data))}
        <div class="content">${parts.filter(Boolean).join("")}</div>
      </ha-card>`;
  }

  _max() {
    const m = parseInt(this._config.max_items, 10);
    return Number.isFinite(m) && m > 0 ? m : DEFAULT_MAX_ITEMS;
  }

  // Items of a list, cut to max_items with a "show more" button.
  _list(key, items, renderItem) {
    const max = this._max();
    const open = this._expanded[key];
    const shown = open ? items : items.slice(0, max);
    const more =
      items.length > max
        ? `<button class="btn more" data-action="expand" data-entity="${key}">${svgIcon(open ? ICONS.chevron_up : ICONS.chevron_down)}<span>${esc(
            open ? this._t("show_less") : this._t("show_more", { n: items.length - max })
          )}</span></button>`
        : "";
    return `<div class="items">${shown.map(renderItem).join("")}${more}</div>`;
  }

  // Lists are collapsed until their title is clicked, unless expand_<key> is set
  // (collapse_<key>: false, the former option, is still honoured).
  _isOpen(key) {
    return this._folds?.[key] ?? (this._config[`expand_${key}`] === true || this._config[`collapse_${key}`] === false);
  }

  // Title: icon, label, actions, "shown/total" counter and chevron, as in the Dockhand card. A click anywhere on it
  // but on its button folds the list; for the keyboard and screen readers the toggle is the icon and label (with
  // aria-expanded), next to the Clear all button and not around it (no button inside a button).
  _section(key, icon, label, items, renderItem, button) {
    const open = this._isOpen(key);
    const shown = this._expanded[key] ? items.length : Math.min(items.length, this._max());
    return `<div>
      <div class="section-title fold ${open ? "" : "closed"}" data-action="fold" data-section="${key}"><span class="toggle" role="button" tabindex="0" aria-expanded="${open}">${svgIcon(
        icon
      )}<span class="label">${esc(label)}</span></span>${button || ""}<span class="count">${shown}/${items.length}</span>${svgIcon(ICONS.chevron_down, "chevron")}</div>
      ${open ? this._list(key, items, renderItem) : ""}
    </div>`;
  }

  _failedSection(data) {
    const controls = this._config.show_controls !== false && this._admin;
    const button =
      controls && data.failures.length
        ? `<button class="btn" data-action="reset_all" title="${esc(this._t("reset_all"))}" aria-label="${esc(this._t("reset_all"))}">${svgIcon(ICONS.clear)}<span>${esc(
            this._t("reset_all")
          )}</span></button>`
        : "";
    // Nothing to list: the counter above already says so.
    if (!data.failures.length) return "";
    return this._section("failed", ICONS.robot_alert, this._t("failed_automations"), data.failures, (a) => this._failure(a, controls), button);
  }

  _failure(a, controls) {
    const h = this._hass;
    const name = a.name || a.entity_id;
    const when = ago(h, this._config, a.last_error_time);
    const tags = [];
    if (a.error_step && a.error_step !== "unknown") tags.push(`<span class="tag" title="${esc(this._t("step"))}">${svgIcon(ICONS.step)}${esc(a.error_step)}</span>`);
    if (a.consecutive_failures > 1) tags.push(`<span class="tag streak">${svgIcon(ICONS.repeat)}${esc(this._t("streak", { n: a.consecutive_failures }))}</span>`);
    const actions = [];
    const trace = this._admin && tracePath(h, a.entity_id, a.unique_id);
    const edit = this._admin && editorPath(h, a.entity_id, a.unique_id);
    if (trace) actions.push(`<button class="btn" data-key="trace" data-path="${esc(trace)}">${svgIcon(ICONS.trace)}<span>${esc(this._t("trace"))}</span></button>`);
    if (edit) actions.push(`<button class="btn" data-key="edit" data-path="${esc(edit)}">${svgIcon(ICONS.edit)}<span>${esc(this._t("edit"))}</span></button>`);
    if (controls)
      actions.push(
        `<button class="btn" data-key="reset" data-action="reset" data-entity="${esc(a.entity_id)}" data-label="${esc(name)}">${svgIcon(ICONS.reset)}<span>${esc(this._t("reset"))}</span></button>`
      );
    return `
      <div class="item crit" data-key="${esc(a.entity_id)}">
        ${svgIcon(ICONS.robot_alert)}
        <div class="body">
          <div class="top">
            <span class="title clickable" role="button" tabindex="0" data-entity="${esc(a.entity_id)}">${esc(name)}</span>
            ${when ? `<span class="when" title="${esc(fullDate(h, this._config, a.last_error_time))}">${esc(when)}</span>` : ""}
          </div>
          ${this._config.show_details !== false && a.error_message ? `<div class="msg">${esc(a.error_message)}</div>` : ""}
          ${tags.length ? `<div class="tags">${tags.join("")}</div>` : ""}
          ${actions.length ? `<div class="actions">${actions.join("")}</div>` : ""}
        </div>
      </div>`;
  }

  _linkedSection(data) {
    if (!data.linked.length) return "";
    return this._section("linked", ICONS.disconnect, this._t("linked_unavailable"), data.linked, (e) => this._linked(e));
  }

  _linked(e) {
    const h = this._hass;
    const when = ago(h, this._config, e.unavailable_since);
    const details = Array.isArray(e.referenced_by_details) && e.referenced_by_details.length ? e.referenced_by_details : (e.referenced_by || []).map((id) => ({ entity_id: id }));
    const sources = details.map((src) => {
      const domain = String(src.entity_id).split(".")[0];
      const name = src.name || h.states[src.entity_id]?.attributes?.friendly_name || src.entity_id;
      // Non-admins get the more-info dialog instead of the editor.
      const path = this._admin && editorPath(h, src.entity_id, src.unique_id);
      const icon = ICONS[domain] || ICONS.automation;
      return `<span class="tag link" role="button" tabindex="0" data-key="${esc(src.entity_id)}" ${path ? `data-path="${esc(path)}"` : `data-entity="${esc(src.entity_id)}"`} title="${esc(src.entity_id)}">${svgIcon(icon)}${esc(name)}</span>`;
    });
    return `
      <div class="item warn" data-key="${esc(e.entity_id)}">
        ${svgIcon(ICONS.disconnect)}
        <div class="body">
          <div class="top">
            <span class="title clickable" role="button" tabindex="0" data-entity="${esc(e.entity_id)}">${esc(e.name || e.entity_id)}</span>
            ${when ? `<span class="when" title="${esc(fullDate(h, this._config, e.unavailable_since))}">${esc(this._t("unavailable_since", { when }))}</span>` : ""}
          </div>
          <div class="eid">${esc(e.entity_id)}</div>
          ${sources.length ? `<div class="tags"><span class="used">${esc(this._t("used_by"))}</span>${sources.join("")}</div>` : ""}
        </div>
      </div>`;
  }
}
