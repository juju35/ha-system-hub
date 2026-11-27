// Settings tab: each module's settings, edited in the panel. The panel drives System Hub's own options flow (the
// form Configure shows) through Home Assistant's flow API, so the fields, their checks and their errors are the same;
// the forms are Home Assistant's <ha-form>. A module's further steps (power cycles, battery types, the import, the Git
// repository) open from its section the same way.
import { SH_DOMAIN, SH_MODULE_ICONS, shAllTabs, shErr, shEsc, shGroupOf } from "./core.js";
import { SystemHubPanel } from "./panel.js";

export var SH_SETTINGS_STEPS = {
  system: ['system'],
  containers: ['containers'],
  watchdog: ['watchdog', 'watchdog_add_power_cycle', 'watchdog_remove_power_cycle'],
  marketplace: ['marketplace'],
  backups: ['backups'],
  purge: ['purge'],
  database: ['database'],
  security: ['security'],
  logs: ['logs'],
  silent: ['silent'],
  batteries: ['batteries', 'batteries_types', 'batteries_import'],
  git_sync: ['git_sync', 'git_sync_repository', 'git_sync_add_repository', 'git_sync_other', 'git_sync_remove_repository'],
  automations: ['automations'],
  orphans: ['orphans'],
};
export var SH_SETTINGS_ICONS = { system: 'mdi:chip' };

// Home Assistant loads <ha-form> with its config pages: loaded here through them when no page has needed it yet
export async function shLoadHaForm() {
  if (customElements.get('ha-form')) return true;
  try {
    await customElements.whenDefined('partial-panel-resolver');
    var resolver = document.createElement('partial-panel-resolver');
    resolver.hass = { panels: [{ url_path: 'tmp', component_name: 'config' }] };
    resolver._updateRoutes();
    await resolver.routerOptions.routes.tmp.load();
    await customElements.whenDefined('ha-panel-config');
    var config = document.createElement('ha-panel-config');
    await config.routerOptions.routes.automation.load();
  } catch (_err) {
    // Not loaded: the section links to Configure instead
  }
  return Boolean(customElements.get('ha-form'));
}

// The values a form starts from: those it suggests, else its defaults
// A form's values to start with: its suggested values, else its defaults; an empty suggestion (an entity not chosen)
// is left out, as Home Assistant's own forms do: sent as null, it would not pass the field's check (#63)
export function shFormData(schema) {
  var data = {};
  for (var field of schema || []) {
    var suggested = field.description?.suggested_value;
    if (suggested !== undefined && suggested !== null) data[field.name] = suggested;
    else if (field.default !== undefined && field.default !== null) data[field.name] = field.default;
  }
  return data;
}

// The values sent: the empty ones left out, as Home Assistant's own forms do: null or undefined, and an empty string
// but in a text field (an entity or a device picker cleared gives one, which its check refuses)
export function shFormSubmit(data, schema) {
  var text = new Set((schema || []).filter((f) => f.selector && ('text' in f.selector || 'template' in f.selector)).map((f) => f.name));
  return Object.fromEntries(Object.entries(data || {}).filter(([key, value]) => value !== null && value !== undefined && (value !== '' || text.has(key))));
}

// A form refused by Home Assistant (400: the values did not pass the checks): its errors by field, as the form shows
// them; "base" for those of the whole form
export function shFormErrors(err) {
  var errors = err?.body?.errors;
  if (!errors || typeof errors !== 'object') return { base: shErr(err) };
  return Object.fromEntries(Object.entries(errors).map(([key, value]) => [key, Array.isArray(value) ? value.join(' · ') : String(value)]));
}

export var SH_SETTINGS_METHODS = {
  _cfgState() {
    this._cfg ??= { module: null, step: null, flow: null, data: {}, errors: {}, menu: [], busy: false, error: null, haForm: null };
    return this._cfg;
  },

  // One row per module (and the System thresholds): its switch, what it does, and its settings once opened
  // The modules and the tabs in one list, as Home Assistant's sidebar editor: the ones turned on in the order of the
  // tabs (dragged by their handle, or moved with ↑ ↓ from it), each with its switch and its settings opened in place;
  // the ones turned off below
  _settingsModules(modules) {
    var cfg = this._cfgState();
    var tabs = shAllTabs(this._draft.tabs || this._state.tabs);
    var on = (t) => t === 'status' || t === 'system' || modules.includes(t);
    var row = (tab, enabled) => {
      var fixed = tab === 'status' || tab === 'system';
      var steps = SH_SETTINGS_STEPS[tab] || [];
      var saved = tab === 'system' || (this._state.modules || []).includes(tab);
      var open = cfg.module === tab;
      var name = this._tabName(tab);
      var hint =
        tab === 'status'
          ? this._t('st_hint')
          : tab === 'system'
            ? this._t('settings_system_hint')
            : this._l(`component.${SH_DOMAIN}.config.step.user.data_description.${tab}`);
      var first = enabled && tabs.find(on) === tab;
      // A handle only where there is something to order: two modules or more of the group turned on
      var handle = enabled && tabs.filter((t) => on(t) && shGroupOf(t) === shGroupOf(tab)).length > 1
        ? `<button class="icon-btn dragh" data-tab="${tab}" title="${shEsc(this._t('drag'))}" aria-label="${shEsc(`${this._t('drag')} · ${name}`)}"><ha-icon icon="mdi:drag-horizontal-variant"></ha-icon></button>`
        : '<span class="cfgpad"></span>';
      var head = `<div class="row cfgrow${open ? ' open' : ''}${enabled ? '' : ' off'}" data-row-tab="${tab}">${handle}<ha-icon icon="${SH_MODULE_ICONS[tab]}"></ha-icon>
        <div class="who"><div class="n">${shEsc(name)}${first ? `<span class="pill cfgdef">${shEsc(this._t('tab_default'))}</span>` : ''}</div>${hint ? `<div class="s">${shEsc(hint)}</div>` : ''}</div>
        ${fixed ? '' : `<ha-switch data-module="${tab}"${enabled ? ' checked' : ''} aria-label="${shEsc(name)}"></ha-switch>`}
        ${
          steps.length && saved
            ? `<button class="icon-btn" data-action="cfg_toggle" data-module="${tab}" aria-expanded="${open}" title="${shEsc(this._t('settings'))}" aria-label="${shEsc(`${this._t('settings')} · ${name}`)}"><ha-icon icon="mdi:cog${open ? '' : '-outline'}"></ha-icon></button>`
            : '<span class="cfgpad"></span>'
        }</div>`;
      return head + (open ? this._cfgBody(tab) : '');
    };
    // One section per group, moved with ↑ ↓; its modules turned on (dragged among themselves), then the ones turned off
    var groups = [...new Set(tabs.map(shGroupOf))];
    var sections = groups.map((group, i) => {
      var mine = tabs.filter((t) => shGroupOf(t) === group);
      var gname = this._groupName(group);
      var arrow = (dir, icon, disabled) =>
        `<button class="icon-btn" data-action="cfg_group" data-group="${group}" data-dir="${dir}"${disabled ? ' disabled' : ''} title="${shEsc(this._t(dir < 0 ? 'move_up' : 'move_down'))}" aria-label="${shEsc(`${this._t(dir < 0 ? 'move_up' : 'move_down')} · ${gname}`)}"><ha-icon icon="${icon}"></ha-icon></button>`;
      var enabledRows = mine.filter(on).map((t) => row(t, true)).join('');
      var disabledRows = mine.filter((t) => !on(t)).map((t) => row(t, false)).join('');
      return `<section class="cfgcard"><div class="cfgsec cfggroup"><ha-icon icon="${SH_MODULE_ICONS[mine[0]]}"></ha-icon><span class="grow">${shEsc(gname)}</span>${arrow(-1, 'mdi:arrow-up', i === 0)}${arrow(1, 'mdi:arrow-down', i === groups.length - 1)}</div>
        ${enabledRows ? `<div class="cfglist" data-group="${group}">${enabledRows}</div>` : ''}${disabledRows ? `<div class="cfglist off">${disabledRows}</div>` : ''}</section>`;
    });
    return `<ha-card class="block cfg"><h2>${shEsc(this._t('modules_tabs'))}</h2><span class="msg">${shEsc(this._t('modules_tabs_hint'))}</span>
      <div class="cfggrid">${sections.join('')}${this._settingsDisplay()}</div></ha-card>`;
  },

  // Moves a tab among the ones of its group turned on (the ones turned off keep their place): to the index `to` of that list
  _cfgMove(tab, to) {
    var modules = this._draft.modules || this._state.modules || [];
    var tabs = shAllTabs(this._draft.tabs || this._state.tabs);
    var on = (t) => t === 'status' || t === 'system' || modules.includes(t);
    var group = shGroupOf(tab);
    var mine = tabs.filter((t) => shGroupOf(t) === group);
    var enabled = mine.filter(on).filter((t) => t !== tab);
    enabled.splice(Math.max(0, Math.min(to, enabled.length)), 0, tab);
    var block = [...enabled, ...mine.filter((t) => !on(t))];
    var next = [...new Set(tabs.map(shGroupOf))].flatMap((g) => (g === group ? block : tabs.filter((t) => shGroupOf(t) === g)));
    if (next.join() !== tabs.join()) this._draft.tabs = next;
    this._render();
  },

  // Moves a whole group one place up (-1) or down (1) among the tabs
  _cfgMoveGroup(group, dir) {
    var tabs = shAllTabs(this._draft.tabs || this._state.tabs);
    var groups = [...new Set(tabs.map(shGroupOf))];
    var i = groups.indexOf(group);
    var j = i + dir;
    if (i < 0 || j < 0 || j >= groups.length) return;
    [groups[i], groups[j]] = [groups[j], groups[i]];
    this._draft.tabs = groups.flatMap((g) => tabs.filter((t) => shGroupOf(t) === g));
    this._render();
    this.shadowRoot.querySelector(`[data-action="cfg_group"][data-group="${group}"][data-dir="${dir}"]:not([disabled])`)?.focus();
  },

  // Dragging a row by its handle (mouse, finger, pen): the row follows among those turned on, the order is kept once
  // let go. Followed on the window: a row moved in the page loses the pointer capture
  _cfgDragStart(ev) {
    var handle = ev.target.closest?.('.dragh');
    if (!handle || ev.button > 0) return;
    var list = handle.closest('.cfglist');
    var row = handle.closest('[data-row-tab]');
    if (!list || !row) return;
    ev.preventDefault();
    var cfg = this._cfgState();
    if (cfg.module) {
      this._cfgAbort();
      Object.assign(cfg, { module: null, step: null, error: null, haForm: null });
    }
    this._drag = { tab: row.dataset.rowTab };
    row.classList.add('dragging');
    var move = (e) => {
      var over = this.shadowRoot.elementFromPoint?.(e.clientX, e.clientY)?.closest?.('[data-row-tab]');
      if (!over || over === row || over.parentNode !== list) return;
      var box = over.getBoundingClientRect();
      list.insertBefore(row, e.clientY > box.top + box.height / 2 ? over.nextSibling : over);
    };
    var end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      var order = [...list.querySelectorAll('[data-row-tab]')].map((el) => el.dataset.rowTab);
      this._drag = null;
      this._cfgMove(row.dataset.rowTab, order.indexOf(row.dataset.rowTab));
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  },

  // ↑ ↓ on a handle: the row one place up or down
  _cfgDragKey(ev) {
    var handle = ev.target.closest?.('.dragh');
    if (!handle || (ev.key !== 'ArrowUp' && ev.key !== 'ArrowDown')) return;
    ev.preventDefault();
    var tab = handle.dataset.tab;
    var modules = this._draft.modules || this._state.modules || [];
    var enabled = shAllTabs(this._draft.tabs || this._state.tabs).filter(
      (t) => shGroupOf(t) === shGroupOf(tab) && (t === 'status' || t === 'system' || modules.includes(t)),
    );
    this._cfgMove(tab, enabled.indexOf(tab) + (ev.key === 'ArrowUp' ? -1 : 1));
    this.shadowRoot.querySelector(`.dragh[data-tab="${tab}"]`)?.focus();
  },

  // An open section: the step's form, its further steps, Save
  _cfgBody(m) {
    var cfg = this._cfgState();
    if (cfg.error) {
      return `<div class="cfgbody"><span class="msg bad">${shEsc(cfg.error)}</span>
        <a class="act quiet" href="/config/integrations/integration/${SH_DOMAIN}"><ha-icon icon="mdi:cog-outline"></ha-icon>${shEsc(this._t('configure'))}</a></div>`;
    }
    if (!cfg.flow) return `<div class="cfgbody">${this._spinner(this._t('loading'))}</div>`;
    var others = (SH_SETTINGS_STEPS[m] || []).filter((s) => cfg.menu.includes(s));
    var tabs = others.length > 1
      ? `<div class="btabs cfgtabs" role="group">${others
          .map((s) => `<button class="btab${s === cfg.step ? ' on' : ''}" data-action="cfg_step" data-step="${s}" aria-pressed="${s === cfg.step}">${shEsc(this._cfgTitle(s))}</button>`)
          .join('')}</div>`
      : '';
    var description = this._l(`component.${SH_DOMAIN}.options.step.${cfg.step}.description`, cfg.flow.description_placeholders || {});
    var base = cfg.errors?.base ? this._l(`component.${SH_DOMAIN}.options.error.${cfg.errors.base}`) || cfg.errors.base : '';
    return `<div class="cfgbody">${tabs}
      ${description ? `<div class="s cfgdesc">${shEsc(description)}</div>` : ''}
      <div class="cfgform" data-step="${shEsc(cfg.step)}"></div>
      ${base ? `<span class="msg bad">${shEsc(base)}</span>` : ''}
      <div class="actions"><span class="grow"></span>${this._button('cfg_close', 'mdi:close', this._t('cancel'), { quiet: true, disabled: cfg.busy })}
        ${this._button('cfg_submit', 'mdi:content-save-outline', this._t('save'), { busy: cfg.busy })}</div></div>`;
  },

  _cfgTitle(step) {
    return this._l(`component.${SH_DOMAIN}.options.step.${step}.title`) || step;
  },

  // The form of the open step, put in its place after each drawing (the same element: what is typed stays)
  _cfgMount(main) {
    var cfg = this._cfgState();
    var slot = main.querySelector('.cfgform');
    if (!slot || !cfg.flow) return;
    if (!customElements.get('ha-form')) {
      slot.textContent = this._t('loading');
      return;
    }
    var form = cfg.haForm || document.createElement('ha-form');
    if (!cfg.haForm) {
      form.addEventListener('value-changed', (ev) => {
        cfg.data = ev.detail.value;
      });
      cfg.haForm = form;
    }
    var step = cfg.step;
    form.hass = this._hass;
    form.schema = cfg.flow.data_schema || [];
    form.data = cfg.data;
    form.error = Object.fromEntries(
      Object.entries(cfg.errors || {})
        .filter(([key]) => key !== 'base')
        .map(([key, value]) => [key, this._l(`component.${SH_DOMAIN}.options.error.${value}`) || value]),
    );
    form.computeLabel = (field) => this._l(`component.${SH_DOMAIN}.options.step.${step}.data.${field.name}`) || field.name;
    form.computeHelper = (field) => this._l(`component.${SH_DOMAIN}.options.step.${step}.data_description.${field.name}`);
    form.computeError = (error) => this._l(`component.${SH_DOMAIN}.options.error.${error}`) || error;
    form.disabled = cfg.busy;
    slot.appendChild(form);
  },

  // Opens a module's section on its first step (the one Configure would show), or closes it
  async _cfgOpen(module, step) {
    var cfg = this._cfgState();
    await this._cfgAbort();
    Object.assign(cfg, { module, step: step || SH_SETTINGS_STEPS[module][0], flow: null, data: {}, errors: {}, menu: [], error: null, busy: false });
    this._render();
    var ready = await shLoadHaForm();
    if (!ready) {
      cfg.error = this._t('settings_unavailable');
      return this._render();
    }
    try {
      var menu = await this._hass.callWS({ type: 'system_hub/options_flow' });
      cfg.menu = menu.menu_options || [];
      cfg.flowId = menu.flow_id;
      await this._cfgGo(cfg.step);
    } catch (err) {
      cfg.error = this._t('failed', { error: shErr(err) });
      this._render();
    }
  },

  async _cfgGo(step) {
    var cfg = this._cfgState();
    if (!cfg.menu.includes(step)) step = cfg.menu.find((s) => (SH_SETTINGS_STEPS[cfg.module] || []).includes(s)) || step;
    // A flow goes one way: another step starts it again from its menu
    if (cfg.flow) {
      await this._cfgAbort();
      var menu = await this._hass.callWS({ type: 'system_hub/options_flow' });
      cfg.menu = menu.menu_options || [];
      cfg.flowId = menu.flow_id;
    }
    var form = await this._hass.callApi('POST', `config/config_entries/options/flow/${cfg.flowId}`, { next_step_id: step });
    this._cfgShow(form);
  },

  // What the flow answered: a form (the first time, or with its errors), the settings saved, or an abort
  _cfgShow(result) {
    var cfg = this._cfgState();
    cfg.busy = false;
    if (result.type === 'form') {
      var first = !cfg.flow || cfg.step !== result.step_id;
      cfg.flow = result;
      cfg.step = result.step_id;
      cfg.errors = result.errors || {};
      if (first) {
        cfg.data = shFormData(result.data_schema);
        cfg.haForm = null;
      }
      return this._render();
    }
    if (result.type === 'create_entry') {
      this._toast(this._t('saved'));
      Object.assign(cfg, { module: null, step: null, flow: null, flowId: null, haForm: null });
      this._render();
      // The entry reloads with its new options: read them once it has
      setTimeout(() => this._load(), 1500);
      return;
    }
    cfg.flow = null;
    cfg.flowId = null;
    cfg.error = this._l(`component.${SH_DOMAIN}.options.abort.${result.reason}`) || result.reason || this._t('settings_unavailable');
    this._render();
  },

  async _cfgSubmit() {
    var cfg = this._cfgState();
    if (!cfg.flowId) return;
    cfg.busy = true;
    this._render();
    try {
      this._cfgShow(await this._hass.callApi('POST', `config/config_entries/options/flow/${cfg.flowId}`, shFormSubmit(cfg.data, cfg.flow?.data_schema)));
    } catch (err) {
      cfg.busy = false;
      cfg.errors = shFormErrors(err);
      this._render();
    }
  },

  async _cfgAbort() {
    var cfg = this._cfgState();
    var id = cfg.flowId;
    cfg.flowId = null;
    cfg.flow = null;
    if (id) await this._hass.callApi('DELETE', `config/config_entries/options/flow/${id}`).catch(() => {});
  },

  // The Settings tab's buttons for the sections; true when the click was one of them
  _cfgClick(button) {
    var action = button.dataset.action;
    var cfg = this._cfgState();
    if (action === 'cfg_group') {
      this._cfgMoveGroup(button.dataset.group, Number(button.dataset.dir));
      return true;
    }
    if (action === 'cfg_toggle') {
      var module = button.dataset.module;
      if (cfg.module === module) {
        this._cfgAbort();
        Object.assign(cfg, { module: null, step: null, error: null, haForm: null });
        this._render();
      } else this._cfgOpen(module);
      return true;
    }
    if (action === 'cfg_step') {
      this._cfgGo(button.dataset.step).catch((err) => {
        cfg.error = this._t('failed', { error: shErr(err) });
        this._render();
      });
      return true;
    }
    if (action === 'cfg_submit') {
      this._cfgSubmit();
      return true;
    }
    if (action === 'cfg_close') {
      this._cfgAbort();
      Object.assign(cfg, { module: null, step: null, error: null, haForm: null });
      this._render();
      return true;
    }
    if (action.startsWith('open_settings')) {
      var target = action.split(':')[1];
      this._selectTab('settings');
      if (target && SH_SETTINGS_STEPS[target]) this._cfgOpen(target);
      return true;
    }
    return false;
  },
};

Object.assign(SystemHubPanel.prototype, SH_SETTINGS_METHODS);
