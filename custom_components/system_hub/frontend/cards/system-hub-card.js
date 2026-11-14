// System Hub's Lovelace cards: one card and one mini card, `module:` picking what they show.
//   type: custom:system-hub-card        module: status (default), system, watchdog, marketplace, batteries, git_sync,
//                                       automations, orphans
//   type: custom:system-hub-mini-card   module: status (default), system, watchdog, batteries, git_sync, automations,
//                                       orphans
// A module's card is the one its own file defines (sh-<module>-card, sh-<module>-mini-card), with its options
// unchanged. The status cards show the Status tab of the panel: they read it with the panel's own code (its module,
// without showing it), as the sidebar icon does, so the three always agree. Administrators only, as the panel.

var SYSTEM_HUB_CARD_VERSION = '2.7.1';
var SH_CARD_MODULES = ['status', 'system', 'watchdog', 'marketplace', 'batteries', 'git_sync', 'automations', 'orphans'];
var SH_MINI_MODULES = ['status', 'system', 'watchdog', 'batteries', 'git_sync', 'automations', 'orphans'];
var SH_CARD_GROUPS = ['system', 'reliability', 'maintenance', 'devices'];
var SH_CARD_TAG = (module, mini) => `sh-${module.replace('_', '-')}${mini ? '-mini' : ''}-card`;
// The status read again every 30 seconds at most, whichever card asks
var SH_CARD_READ_MS = 30000;

function shCardEsc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

// The panel's strings (selector.panel), loaded once
async function shCardStrings(hass) {
  try {
    await hass.loadBackendTranslation?.('selector', 'system_hub');
  } catch (_err) {
    // the English fallbacks below
  }
}

function shCardT(hass, key, fallback, vars) {
  try {
    var text = hass?.localize?.(`component.system_hub.selector.panel.options.${key}`, vars || {});
    if (text) return text;
  } catch (_err) {
    // the fallback
  }
  return String(fallback).replace(/\{(\w+)\}/g, (_m, name) => String(vars?.[name] ?? ''));
}

// The panel read without being shown: one for the page, shared with the sidebar icon (system-hub-icons.js)
async function shCardProbe(hass) {
  var panel = hass?.panels?.['system-hub'];
  if (!hass?.user?.is_admin || !panel) throw new Error('admin');
  if (!customElements.get('system-hub-panel')) await import(panel.config._panel_custom.module_url);
  var Panel = customElements.get('system-hub-panel');
  var probe = (window.__systemHubProbe ??= new Panel());
  probe._headless = true;
  probe._hass = hass;
  if (!probe._cardRead || Date.now() - probe._cardAt > SH_CARD_READ_MS) {
    probe._cardAt = Date.now();
    probe._cardRead = (async () => {
      if (!probe._localize) await probe._loadStrings();
      await probe._load();
    })();
  }
  await probe._cardRead;
  return probe;
}

// The areas of the Status tab, by group, the ones not wanted left out
function shCardStatus(probe, config) {
  var Panel = probe.constructor;
  var { areas, counts, score, tone } = probe._stTone();
  var groups = Array.isArray(config.groups) && config.groups.length ? config.groups : SH_CARD_GROUPS;
  var shown = areas.filter(([tab, [t]]) => groups.includes(Panel.groupOf(tab)) && !(config.hide_ok && t === 'good'));
  var points = counts.bad + counts.warn + counts.info;
  return { areas: shown, all: areas, counts, score, tone, points };
}

function shCardOpen(tab) {
  history.pushState(null, '', `/system-hub/${tab}`);
  window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: false } }));
}

var SH_CARD_STYLE = `
  :host { display:block; }
  ha-card { padding:14px 16px; --sh-good: var(--success-color, #43a047); --sh-warn: var(--warning-color, #ffa600);
            --sh-bad: var(--error-color, #db4437); --sh-info: var(--info-color, #039be5); }
  .head { display:flex; align-items:center; gap:12px; cursor:pointer; }
  .badge { width:48px; height:48px; border-radius:50%; flex:none; display:flex; align-items:center; justify-content:center;
           --mdc-icon-size:30px; color:var(--sh-tone); background:color-mix(in srgb, var(--sh-tone) 14%, transparent); }
  .mini .badge { width:36px; height:36px; --mdc-icon-size:22px; }
  .good { --sh-tone: var(--sh-good); } .warn { --sh-tone: var(--sh-warn); } .bad { --sh-tone: var(--sh-bad); } .info { --sh-tone: var(--sh-info); }
  .who { flex:1; min-width:0; }
  .title { font-size:17px; color:var(--primary-text-color); }
  .mini .title { font-size:15px; }
  .sub { font-size:12.5px; color:var(--secondary-text-color); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  :host([hide-title]) .head .who > .title, :host([hide-subtitle]) .head .who > .sub { display:none; }
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
`;

// A card of a module (its own card element), or the Status card
class SystemHubCardBase extends HTMLElement {
  static get mini() {
    return false;
  }

  setConfig(config) {
    var module = config?.module || 'status';
    var modules = this.constructor.mini ? SH_MINI_MODULES : SH_CARD_MODULES;
    if (!modules.includes(module)) throw new Error(`Unknown System Hub module: ${module} (${modules.join(', ')})`);
    this._config = { ...config, module };
    // show_title / show_subtitle (status module): the header's title / subtitle, hidden by the stylesheet
    this.toggleAttribute?.('hide-title', config?.show_title === false);
    this.toggleAttribute?.('hide-subtitle', config?.show_subtitle === false);
    if (module === 'status') {
      this._inner = null;
      this.innerHTML = '';
      if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
      this._renderStatus();
      return;
    }
    if (this.shadowRoot) this.shadowRoot.innerHTML = '<slot></slot>';
    var tag = SH_CARD_TAG(module, this.constructor.mini);
    var inner = { ...config };
    delete inner.module;
    var mount = (Card) => {
      if (this._config?.module !== module) return;
      if (!(this._inner instanceof Card)) {
        this._inner = document.createElement(tag);
        this.replaceChildren(this._inner);
      }
      this._inner.setConfig(inner);
      if (this._hass) this._inner.hass = this._hass;
    };
    var Card = customElements.get(tag);
    if (Card) mount(Card);
    else customElements.whenDefined(tag).then(mount);
  }

  set hass(hass) {
    var first = !this._hass;
    this._hass = hass;
    if (this._inner) this._inner.hass = hass;
    else if (this._config?.module === 'status' && (first || Date.now() - (this._readAt || 0) > SH_CARD_READ_MS)) this._read();
  }

  connectedCallback() {
    if (this._config?.module !== 'status') return;
    this._timer ??= setInterval(() => !document.hidden && this._read(), SH_CARD_READ_MS);
  }

  disconnectedCallback() {
    clearInterval(this._timer);
    this._timer = null;
  }

  async _read() {
    if (!this._hass) return;
    this._readAt = Date.now();
    try {
      await shCardStrings(this._hass);
      this._probe = await shCardProbe(this._hass);
      this._error = null;
    } catch (err) {
      this._error = err?.message === 'admin' ? 'admin' : String(err?.message || err);
    }
    this._renderStatus();
  }

  getCardSize() {
    if (this._inner?.getCardSize) return this._inner.getCardSize();
    return this.constructor.mini ? 1 : 6;
  }

  getGridOptions() {
    if (this._inner?.getGridOptions) return this._inner.getGridOptions();
    // Before a module's card is defined (its file still loading), the size it will ask for: half a section for a
    // module's mini card, the whole width otherwise; the height follows the content
    var half = this.constructor.mini && this._config?.module !== 'status';
    return { columns: half ? 6 : 12, min_columns: 6, rows: 'auto' };
  }

  _note(text) {
    return `<ha-card class="mini note">${shCardEsc(text)}</ha-card>`;
  }

  _renderStatus() {
    var root = this.shadowRoot;
    if (!root || this._config?.module !== 'status') return;
    var hass = this._hass;
    var body;
    if (this._error === 'admin') body = this._note(shCardT(hass, 'card_admin_only', 'System Hub: for administrators only'));
    else if (this._error) body = this._note(shCardT(hass, 'failed', 'Failed: {error}', { error: this._error }));
    else if (!this._probe?._state) body = this._note(shCardT(hass, 'loading', 'Loading…'));
    else body = this._statusCard(shCardStatus(this._probe, this._config));
    root.innerHTML = `<style>${SH_CARD_STYLE}</style>${body}`;
    for (var el of root.querySelectorAll('[data-tab]')) {
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        shCardOpen(ev.currentTarget.dataset.tab);
      });
    }
  }

  _summary(status) {
    var p = this._probe;
    var title = status.points ? p._t(status.points === 1 ? 'st_point' : 'st_points', { n: status.points }) : p._t('st_all_good');
    var parts = [
      ['bad', 'st_n_bad'],
      ['warn', 'st_n_warn'],
      ['info', 'st_n_info'],
    ]
      .filter(([tone]) => status.counts[tone])
      .map(([tone, key]) => p._t(key, { n: status.counts[tone] }));
    return { title, sub: [`${status.score}/100`, ...parts].join(' · ') };
  }

  _statusCard(status) {
    var p = this._probe;
    var { title, sub } = this._summary(status);
    var Panel = p.constructor;
    var area = ([tab, [tone, value]]) => `<button class="area ${tone}" data-tab="${tab}" title="${shCardEsc(p._tabName(tab))}">
        <ha-icon icon="${Panel.ICONS[tab]}"></ha-icon><div class="who"><div>${shCardEsc(p._tabName(tab))}</div><div>${shCardEsc(value)}</div></div><span class="dot"></span></button>`;
    var groups = SH_CARD_GROUPS.map((g) => [g, status.areas.filter(([tab]) => Panel.groupOf(tab) === g)])
      .filter(([, list]) => list.length)
      .map(([g, list]) => `<div class="group">${shCardEsc(p._groupName(g))}</div><div class="areas">${list.map(area).join('')}</div>`)
      .join('');
    return `<ha-card><div class="head ${status.tone}" data-tab="status"><div class="badge"><ha-icon icon="system-hub:${status.tone}"></ha-icon></div>
      <div class="who"><div class="title">${shCardEsc(title)}</div><div class="sub">${shCardEsc(sub)}</div></div><ha-icon class="open" icon="mdi:open-in-new"></ha-icon></div>${groups}</ha-card>`;
  }
}

class SystemHubCard extends SystemHubCardBase {
  static getConfigElement() {
    return document.createElement('system-hub-card-editor');
  }

  static getStubConfig() {
    return { module: 'status' };
  }
}

class SystemHubMiniCard extends SystemHubCardBase {
  static get mini() {
    return true;
  }

  static getConfigElement() {
    return document.createElement('system-hub-mini-card-editor');
  }

  static getStubConfig() {
    return { module: 'status' };
  }

  // One line: the emblem, the summary, the details of the first areas to look at and a dot per area
  _statusCard(status) {
    var p = this._probe;
    var { title } = this._summary(status);
    var order = { bad: 0, warn: 1, info: 2 };
    var look = status.areas.filter(([, [tone]]) => tone !== 'good').sort((a, b) => order[a[1][0]] - order[b[1][0]]);
    var sub = look.length
      ? look
          .slice(0, 3)
          .map(([, [, value]]) => value)
          .join(' · ')
      : `${status.score}/100`;
    var dots = look.map(([tab, [tone]]) => `<span class="dot ${tone}" title="${shCardEsc(p._tabName(tab))}"></span>`).join('');
    return `<ha-card class="mini ${status.tone}" data-tab="status"><div class="badge"><ha-icon icon="system-hub:${status.tone}"></ha-icon></div>
      <div class="who"><div class="title">${shCardEsc(title)}</div><div class="sub">${shCardEsc(sub)}</div></div><div class="dots">${dots}</div></ha-card>`;
  }
}

// The editor: the module first, then the module's own editor (or the Status card's options)
class SystemHubCardEditorBase extends HTMLElement {
  static get mini() {
    return false;
  }

  setConfig(config) {
    this._config = { ...config, module: config?.module || 'status' };
    this._render();
  }

  set hass(hass) {
    var first = !this._hass;
    this._hass = hass;
    if (this._form) this._form.hass = hass;
    if (this._inner) this._inner.hass = hass;
    if (first) shCardStrings(hass).then(() => this._render());
  }

  set lovelace(lovelace) {
    this._lovelace = lovelace;
    if (this._inner) this._inner.lovelace = lovelace;
  }

  _t(key, fallback, vars) {
    return shCardT(this._hass, key, fallback, vars);
  }

  _schema() {
    var modules = this.constructor.mini ? SH_MINI_MODULES : SH_CARD_MODULES;
    var options = modules.map((m) => ({ value: m, label: this._t(`tab_${m}`, m) }));
    var schema = [{ name: 'module', selector: { select: { mode: 'dropdown', options } } }];
    if (this._config.module === 'status') {
      schema.push(
        {
          name: 'groups',
          selector: {
            select: {
              multiple: true,
              mode: 'list',
              options: SH_CARD_GROUPS.map((g) => ({ value: g, label: g === 'system' ? this._t('system', 'System') : this._t(`group_${g}`, g) })),
            },
          },
        },
      );
      // The mini card's one line has no header and only shows the areas to look at: these three change nothing there.
      if (!this.constructor.mini) {
        schema.push(
          { name: 'show_title', selector: { boolean: {} } },
          { name: 'show_subtitle', selector: { boolean: {} } },
          { name: 'hide_ok', selector: { boolean: {} } },
        );
      }
    }
    return schema;
  }

  _emit(config) {
    this._config = config;
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config }, bubbles: true, composed: true }));
  }

  _render() {
    if (!this._config) return;
    if (!this.shadowRoot) {
      this.attachShadow({ mode: 'open' });
      this.shadowRoot.innerHTML = '<div class="form"></div><div class="inner"></div>';
      this.shadowRoot.querySelector('.inner').addEventListener('config-changed', (ev) => {
        // The module's editor: its options, the type and the module kept
        if (ev.target === this) return;
        ev.stopPropagation();
        var inner = { ...ev.detail.config };
        delete inner.type;
        this._emit({ type: this._config.type, module: this._config.module, ...inner });
      });
    }
    if (!this._form) {
      this._form = document.createElement('ha-form');
      this._form.computeLabel = (s) =>
        ({ module: this._t('card_module', 'Module'), groups: this._t('card_groups', 'Groups'), hide_ok: this._t('card_hide_ok', 'Hide what is fine'), show_title: this._t('card_show_title', 'Show title'), show_subtitle: this._t('card_show_subtitle', 'Show subtitle') })[s.name] || s.name;
      this._form.addEventListener('value-changed', (ev) => {
        ev.stopPropagation();
        var value = ev.detail.value;
        if (value.module !== this._config.module) {
          // Another module: its own options start again
          this._emit({ type: this._config.type, module: value.module });
          this._render();
          return;
        }
        var config = { ...this._config, ...value };
        if (!config.groups?.length) delete config.groups;
        if (!config.hide_ok) delete config.hide_ok;
        if (config.show_title === true) delete config.show_title;
        if (config.show_subtitle === true) delete config.show_subtitle;
        this._emit(config);
      });
      this.shadowRoot.querySelector('.form').appendChild(this._form);
    }
    this._form.hass = this._hass;
    this._form.schema = this._schema();
    this._form.data = this._config.module === 'status' ? { show_title: true, show_subtitle: true, ...this._config } : this._config;
    this._mountInner();
  }

  _mountInner() {
    var holder = this.shadowRoot.querySelector('.inner');
    var module = this._config.module;
    if (module === 'status') {
      this._inner = null;
      this._innerModule = null;
      holder.replaceChildren();
      return;
    }
    var tag = SH_CARD_TAG(module, this.constructor.mini);
    var Card = customElements.get(tag);
    if (!Card) {
      customElements.whenDefined(tag).then(() => this._mountInner());
      return;
    }
    if (this._innerModule !== module) {
      this._innerModule = module;
      this._inner = Card.getConfigElement ? Card.getConfigElement() : null;
      holder.replaceChildren(...(this._inner ? [this._inner] : []));
    }
    if (!this._inner) return;
    var inner = { ...this._config };
    delete inner.module;
    if (this._hass) this._inner.hass = this._hass;
    if (this._lovelace) this._inner.lovelace = this._lovelace;
    this._inner.setConfig(inner);
  }
}

class SystemHubCardEditor extends SystemHubCardEditorBase {}

class SystemHubMiniCardEditor extends SystemHubCardEditorBase {
  static get mini() {
    return true;
  }
}

if (!customElements.get('system-hub-card')) {
  customElements.define('system-hub-card', SystemHubCard);
  customElements.define('system-hub-card-editor', SystemHubCardEditor);
  customElements.define('system-hub-mini-card', SystemHubMiniCard);
  customElements.define('system-hub-mini-card-editor', SystemHubMiniCardEditor);
  window.customCards = window.customCards || [];
  window.customCards.push(
    {
      type: 'system-hub-card',
      name: 'System Hub',
      description: 'The status of Home Assistant at a glance, or one module of System Hub (module:)',
      preview: true,
      documentationURL: 'https://github.com/juju35/ha-system-hub#lovelace-cards',
    },
    {
      type: 'system-hub-mini-card',
      name: 'System Hub Mini',
      description: 'The status of Home Assistant on one line, or the mini card of one module of System Hub (module:)',
      preview: true,
      documentationURL: 'https://github.com/juju35/ha-system-hub#lovelace-cards',
    },
  );
  console.info(`%c SYSTEM-HUB-CARD %c v${SYSTEM_HUB_CARD_VERSION} `, 'background:#03a9f4;color:#fff;font-weight:700', '');
}
