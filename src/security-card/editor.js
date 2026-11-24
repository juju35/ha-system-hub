// ── Editor ───────────────────────────────────────────────────────────────────
import { pickerDefine } from "./card-picker.js";
import { SECURITY_CARD_VERSION } from "./core.js";
import { SC_DEFAULTS, SC_MAX_ITEMS, scLang, scT } from "./i18n-helpers.js";
import { shbClean, shbData, shbFields, shbLabel } from "./illustrated-header.js";
import { SecurityCard } from "./card.js";
import { SecurityMiniCard } from "./mini-card.js";

export const SC_HELPERS = ['max_items', 'show_ok', 'zoom', 'hide_when_ok', 'language'];

export class SecurityCardEditor extends HTMLElement {
  static get DEFAULTS() {
    return SC_DEFAULTS;
  }

  // Fields shown after the list's options: the mini card adds its detail button there.
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
      const t = (key) => scT(scLang(this._hass, this._config), key);
      this._form.computeLabel = (s) => shbLabel(this._hass, s.name) ?? t(`ed_${s.name}`);
      this._form.computeHelper = (s) => (SC_HELPERS.includes(s.name) ? t(`ed_${s.name}_helper`) : undefined);
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
    const lang = scLang(this._hass, c);
    // Reassigning the schema at every Home Assistant update would re-render ha-form while the user is typing.
    if (this._deps && this._deps.config === c && this._deps.lang === lang) return;
    this._deps = { config: c, lang };
    this._form.data = shbData({ ...this.constructor.DEFAULTS, ...c });
    this._form.schema = [
      { name: 'title', selector: { text: {} } },
      ...shbFields(this._hass),
      { name: 'show_title', selector: { boolean: {} } },
      { name: 'show_subtitle', selector: { boolean: {} } },
      { name: 'max_items', selector: { number: { min: 1, max: SC_MAX_ITEMS, mode: 'box' } } },
      { name: 'show_ok', selector: { boolean: {} } },
      ...this._extraFields(),
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
              { value: 'it', label: 'Italiano' },
              { value: 'nl', label: 'Nederlands' },
              { value: 'pt', label: 'Português (Portugal)' },
              { value: 'pl', label: 'Polski' },
              { value: 'sr', label: 'Српски' },
              { value: 'sr-Latn', label: 'Srpski (latinica)' },
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

// The mini card's editor: the full card's options (its detail view), plus the detail button.
export class SecurityMiniCardEditor extends SecurityCardEditor {
  static get DEFAULTS() {
    return { ...SC_DEFAULTS, zoom: true };
  }

  _extraFields() {
    return [{ name: 'zoom', selector: { boolean: {} } }];
  }
}

// Each card is registered on its own: a page that already loaded an older copy of this file still gets the mini card
// from this one.
window.systemHubCards = window.systemHubCards || [];
if (!customElements.get('sh-security-card')) {
  pickerDefine('sh-security-card', SecurityCard);
  pickerDefine('sh-security-card-editor', SecurityCardEditor);
  window.systemHubCards.push({
    type: 'sh-security-card',
    name: 'Security Card (System Hub)',
    description: 'What needs a look in System Hub Security: refused logins, add-ons not protected, 2FA, new outbound hosts, tokens',
    preview: true,
    documentationURL: 'https://github.com/juju35/ha-system-hub',
  });
  console.info(`%c SECURITY-CARD %c v${SECURITY_CARD_VERSION} `, 'background:#db4437;color:#fff;font-weight:700', '');
}
if (!customElements.get('sh-security-mini-card')) {
  pickerDefine('sh-security-mini-card', SecurityMiniCard);
  pickerDefine('sh-security-mini-card-editor', SecurityMiniCardEditor);
  window.systemHubCards.push({
    type: 'sh-security-mini-card',
    name: 'Security Mini Card (System Hub)',
    description: 'The System Hub Security status and its three worst points, with a detail button showing the full card',
    preview: true,
    documentationURL: 'https://github.com/juju35/ha-system-hub',
  });
}
