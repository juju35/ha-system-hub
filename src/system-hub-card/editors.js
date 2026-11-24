// The editor: the module first, then the module's own editor (or the Status card's options)
import { SH_CARD_GROUPS, SH_CARD_MODULES, SH_CARD_TAG, SH_MINI_MODULES, shCardStrings, shCardT } from "./core.js";

export class SystemHubCardEditorBase extends HTMLElement {
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
        { name: 'illustration', selector: { boolean: {} } },
        {
          name: 'illustration_theme',
          selector: { select: { mode: 'dropdown', options: ['auto', 'day', 'night'].map((v) => ({ value: v, label: this._t(`card_theme_${v}`, { auto: 'Automatic (follows the theme)', day: 'Day', night: 'Night' }[v]) })) } },
        },
      );
      // The mini card shows only the summary and the areas to look at; its detail view takes hide_ok, as the full card.
      if (!this.constructor.mini) {
        schema.push(
          { name: 'show_title', selector: { boolean: {} } },
          { name: 'show_subtitle', selector: { boolean: {} } },
          { name: 'hide_ok', selector: { boolean: {} } },
        );
      } else {
        schema.push({ name: 'hide_ok', selector: { boolean: {} } }, { name: 'zoom', selector: { boolean: {} } });
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
        ({ module: this._t('card_module', 'Module'), groups: this._t('card_groups', 'Groups'), hide_ok: this._t('card_hide_ok', 'Hide what is fine'), show_title: this._t('card_show_title', 'Show title'), show_subtitle: this._t('card_show_subtitle', 'Show subtitle'), illustration: this._t('card_illustration', 'Illustration'), illustration_theme: this._t('card_illustration_theme', 'Illustration theme'), zoom: this._t('card_zoom', 'Detail button') })[s.name] || s.name;
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
        if (config.illustration === true) delete config.illustration;
        if (config.zoom === true) delete config.zoom;
        if (!config.illustration_theme || config.illustration_theme === 'auto') delete config.illustration_theme;
        this._emit(config);
      });
      this.shadowRoot.querySelector('.form').appendChild(this._form);
    }
    this._form.hass = this._hass;
    this._form.schema = this._schema();
    this._form.data = this._config.module === 'status' ? { show_title: true, show_subtitle: true, illustration: true, illustration_theme: 'auto', ...(this.constructor.mini ? { zoom: true } : {}), ...this._config } : this._config;
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

export class SystemHubCardEditor extends SystemHubCardEditorBase {}

export class SystemHubMiniCardEditor extends SystemHubCardEditorBase {
  static get mini() {
    return true;
  }
}
