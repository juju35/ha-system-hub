// ── Editor ───────────────────────────────────────────────────────────────────
import { pickerDefine } from "./card-picker.js";
import { OE_DOMAIN, ORPHAN_ENTITIES_CARD_VERSION } from "./core.js";
import { OE_DEFAULTS, OE_LANGS, OE_MAX_ROWS, oeLang, oeT } from "./i18n-helpers.js";
import { shbClean, shbData, shbFields, shbLabel } from "./illustrated-header.js";
import { OrphanEntitiesCard } from "./card.js";
import { OrphanEntitiesMiniCard } from "./mini-card.js";

export const OE_HELPERS = ['entity', 'title', 'show_stats', 'show_filters', 'max_rows', 'scan_button', 'zoom', 'hide_when_empty', 'language'];

export class OrphanEntitiesCardEditor extends HTMLElement {
  static get DEFAULTS() {
    return OE_DEFAULTS;
  }

  // Fields shown after the "Scan now" button: the mini card adds its detail button there.
  _extraFields() {
    return [];
  }

  setConfig(config) {
    this._config = config;
    this._update();
  }

  set hass(hass) {
    this._hass = hass;
    this._update();
  }

  _update() {
    if (!this._hass || !this._config) return;
    if (!this._form) {
      this._form = document.createElement('ha-form');
      const t = (key) => oeT(oeLang(this._hass, this._config), key);
      this._form.computeLabel = (s) => shbLabel(this._hass, s.name) ?? t(`ed_${s.name}`);
      this._form.computeHelper = (s) => (OE_HELPERS.includes(s.name) ? t(`ed_${s.name}_helper`) : undefined);
      this._form.addEventListener('value-changed', (ev) => {
        const config = { ...ev.detail.value };
        // Options left at their default are not written to the YAML.
        for (const k of Object.keys(config)) {
          if (config[k] === '' || config[k] == null || this.constructor.DEFAULTS[k] === config[k]) delete config[k];
        }
        this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: shbClean(config) }, bubbles: true, composed: true }));
      });
      this.appendChild(this._form);
    }
    this._form.hass = this._hass;
    const c = this._config;
    const lang = oeLang(this._hass, c);
    // Reassigning the schema at every Home Assistant update would re-render ha-form while the user is typing.
    if (this._deps && this._deps.config === c && this._deps.lang === lang) return;
    this._deps = { config: c, lang };
    this._form.data = shbData({ ...this.constructor.DEFAULTS, ...c });
    this._form.schema = [
      { name: 'entity', selector: { entity: { filter: { integration: OE_DOMAIN, domain: 'sensor' } } } },
      { name: 'title', selector: { text: {} } },
      ...shbFields(this._hass),
      { name: 'show_title', selector: { boolean: {} } },
      { name: 'show_subtitle', selector: { boolean: {} } },
      { name: 'show_stats', selector: { boolean: {} } },
      { name: 'show_filters', selector: { boolean: {} } },
      { name: 'max_rows', selector: { number: { min: 1, max: OE_MAX_ROWS, mode: 'box' } } },
      { name: 'scan_button', selector: { boolean: {} } },
      ...this._extraFields(),
      { name: 'hide_when_empty', selector: { boolean: {} } },
      { name: 'language', selector: { select: { mode: 'dropdown', options: OE_LANGS.map(([value, label]) => ({ value, label })) } } },
    ];
  }
}

// The mini card's editor: the full card's options (its detail view), plus the detail button.
export class OrphanEntitiesMiniCardEditor extends OrphanEntitiesCardEditor {
  static get DEFAULTS() {
    return { ...OE_DEFAULTS, zoom: true };
  }

  _extraFields() {
    return [{ name: 'zoom', selector: { boolean: {} } }];
  }
}

// Each card is registered on its own: a page that already loaded an older copy of this file still gets the other.
window.systemHubCards = window.systemHubCards || [];
if (!customElements.get('sh-orphans-card')) {
  pickerDefine('sh-orphans-card', OrphanEntitiesCard);
  pickerDefine('sh-orphans-card-editor', OrphanEntitiesCardEditor);
  window.systemHubCards.push({
    type: 'sh-orphans-card',
    name: 'Orphan Entities Card',
    description: 'The entities their integration no longer provides: filter, select and remove them in bulk',
    preview: true,
    documentationURL: 'https://github.com/juju35/ha-system-hub#orphans',
  });
  console.info(`%c ORPHAN-ENTITIES-CARD %c v${ORPHAN_ENTITIES_CARD_VERSION} `, 'background:#7e57c2;color:#fff;font-weight:700', '');
}
if (!customElements.get('sh-orphans-mini-card')) {
  pickerDefine('sh-orphans-mini-card', OrphanEntitiesMiniCard);
  pickerDefine('sh-orphans-mini-card-editor', OrphanEntitiesMiniCardEditor);
  window.systemHubCards.push({
    type: 'sh-orphans-mini-card',
    name: 'Orphan Entities Mini Card',
    description: 'Orphaned entities by reason on two lines, with a detail button showing the full card',
    preview: true,
    documentationURL: 'https://github.com/juju35/ha-system-hub#orphans',
  });
}
