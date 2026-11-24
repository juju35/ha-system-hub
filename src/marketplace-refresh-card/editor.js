// ── Editor ───────────────────────────────────────────────────────────────────
import { pickerDefine } from "./card-picker.js";
import { HR_DOMAIN, MARKETPLACE_REFRESH_CARD_VERSION } from "./core.js";
import { HR_DEFAULTS, hrLang, hrStatusIds, hrT } from "./i18n-helpers.js";
import { shbClean, shbData, shbFields, shbLabel } from "./illustrated-header.js";
import { MarketplaceRefreshCard } from "./card.js";

export const HR_HELPERS = ['entity', 'title', 'show_updates', 'show_system_updates', 'show_failed', 'check_button', 'install_button', 'hide_when_ok', 'language'];

export class MarketplaceRefreshCardEditor extends HTMLElement {
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
      const t = (key) => hrT(hrLang(this._hass, this._config), key);
      this._form.computeLabel = (s) => shbLabel(this._hass, s.name) ?? t(`ed_${s.name}`);
      this._form.computeHelper = (s) => (HR_HELPERS.includes(s.name) ? t(`ed_${s.name}_helper`) : undefined);
      this._form.addEventListener('value-changed', (ev) => {
        const config = { ...ev.detail.value };
        // Options left at their default are not written to the YAML.
        for (const k of Object.keys(config)) {
          if (config[k] === '' || config[k] == null || HR_DEFAULTS[k] === config[k]) delete config[k];
        }
        this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: shbClean(config) }, bubbles: true, composed: true }));
      });
      this.appendChild(this._form);
    }
    this._form.hass = this._hass;
    const c = this._config;
    const lang = hrLang(this._hass, c);
    // Reassigning the schema at every Home Assistant update would re-render ha-form while the user is typing.
    if (this._deps && this._deps.config === c && this._deps.lang === lang) return;
    this._deps = { config: c, lang };
    this._form.data = shbData({ ...HR_DEFAULTS, ...c });
    this._form.schema = [
      {
        name: 'entity',
        selector: {
          entity: {
            filter: { integration: HR_DOMAIN, domain: 'sensor', device_class: 'enum' },
            // Only the Marketplace's status, not the other System Hub modules' (when the registry is known).
            ...hrStatusIds(this._hass?.entities),
          },
        },
      },
      { name: 'title', selector: { text: {} } },
      ...shbFields(this._hass),
      { name: 'show_title', selector: { boolean: {} } },
      { name: 'show_subtitle', selector: { boolean: {} } },
      { name: 'show_next_check', selector: { boolean: {} } },
      { name: 'show_updates', selector: { boolean: {} } },
      { name: 'show_system_updates', selector: { boolean: {} } },
      { name: 'show_failed', selector: { boolean: {} } },
      { name: 'check_button', selector: { boolean: {} } },
      { name: 'install_button', selector: { boolean: {} } },
      { name: 'hide_when_ok', selector: { boolean: {} } },
      {
        name: 'language',
        selector: {
          select: {
            mode: 'dropdown',
            options: [
              { value: 'en', label: 'English' },
              { value: 'fr', label: 'Français' },
              { value: 'de', label: 'Deutsch' },
              { value: 'es', label: 'Español' },
              { value: 'sr', label: 'Српски' },
              { value: 'sr-Latn', label: 'Srpski (latinica)' },
              { value: 'it', label: 'Italiano' },
              { value: 'nl', label: 'Nederlands' },
              { value: 'pt', label: 'Português (Portugal)' },
              { value: 'pl', label: 'Polski' },
              { value: 'ro', label: 'Română' },
              { value: 'da', label: 'Dansk' },
              { value: 'sv', label: 'Svenska' },
              { value: 'bg', label: 'Български' },
              { value: 'ru', label: 'Русский' },
              { value: 'uk', label: 'Українська' },
              { value: 'hu', label: 'Magyar' },
              { value: 'sk', label: 'Slovenčina' },
              { value: 'cs', label: 'Čeština' },
              { value: 'sl', label: 'Slovenščina' },
              { value: 'lv', label: 'Latviešu' },
              { value: 'el', label: 'Ελληνικά' },
            ],
          },
        },
      },
    ];
  }
}

if (!customElements.get('sh-marketplace-card')) {
  pickerDefine('sh-marketplace-card', MarketplaceRefreshCard);
  pickerDefine('sh-marketplace-card-editor', MarketplaceRefreshCardEditor);
  window.systemHubCards = window.systemHubCards || [];
  window.systemHubCards.push({
    type: 'sh-marketplace-card',
    name: 'Marketplace Refresh Card',
    description: 'The update check of Marketplace Refresh: status, last and next check, updates available and failed repositories',
    preview: true,
    documentationURL: 'https://github.com/juju35/ha-system-hub',
  });
  console.info(`%c MARKETPLACE-REFRESH-CARD %c v${MARKETPLACE_REFRESH_CARD_VERSION} `, 'background:#14b8a6;color:#fff;font-weight:700', '');
}
