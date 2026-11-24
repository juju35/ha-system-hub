// ── Editor ───────────────────────────────────────────────────────────────────
import { pickerDefine } from "./card-picker.js";
import { INTEGRATION_WATCHDOG_CARD_VERSION } from "./core.js";
import { IW_DEFAULTS, IW_MAX_HISTORY, iwLang, iwT } from "./i18n-helpers.js";
import { shbClean, shbData, shbFields, shbLabel } from "./illustrated-header.js";
import { IntegrationWatchdogCard } from "./card.js";
import { IntegrationWatchdogMiniCard } from "./mini-card.js";

export const IW_HELPERS = ['entity', 'title', 'show_stats', 'show_unavailable', 'show_history', 'check_button', 'zoom', 'hide_when_ok', 'language'];

export class IntegrationWatchdogCardEditor extends HTMLElement {
  static get DEFAULTS() {
    return IW_DEFAULTS;
  }

  // Fields shown after the "Check now" button: the mini card adds its detail button there.
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
      const t = (key) => iwT(iwLang(this._hass, this._config), key);
      this._form.computeLabel = (s) => shbLabel(this._hass, s.name) ?? t(`ed_${s.name}`);
      this._form.computeHelper = (s) => (IW_HELPERS.includes(s.name) ? t(`ed_${s.name}_helper`) : undefined);
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
    const lang = iwLang(this._hass, c);
    // Reassigning the schema at every Home Assistant update would re-render ha-form while the user is typing.
    if (this._deps && this._deps.config === c && this._deps.lang === lang) return;
    this._deps = { config: c, lang };
    this._form.data = shbData({ ...this.constructor.DEFAULTS, ...c });
    this._form.schema = [
      { name: 'entity', selector: { entity: { filter: { integration: 'system_hub', domain: 'sensor' } } } },
      { name: 'title', selector: { text: {} } },
      ...shbFields(this._hass),
      { name: 'show_title', selector: { boolean: {} } },
      { name: 'show_subtitle', selector: { boolean: {} } },
      { name: 'show_stats', selector: { boolean: {} } },
      { name: 'show_unavailable', selector: { boolean: {} } },
      { name: 'show_history', selector: { boolean: {} } },
      ...(c.show_history === false
        ? []
        : [{ name: 'history_count', selector: { number: { min: 1, max: IW_MAX_HISTORY, mode: 'box' } } }]),
      { name: 'check_button', selector: { boolean: {} } },
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
export class IntegrationWatchdogMiniCardEditor extends IntegrationWatchdogCardEditor {
  static get DEFAULTS() {
    return { ...IW_DEFAULTS, zoom: true };
  }

  _extraFields() {
    return [{ name: 'zoom', selector: { boolean: {} } }];
  }
}

// Each card is registered on its own: a page that already loaded an older copy of this file (a stale resource or a
// cached version without the mini card) still gets the mini card from this one.
window.systemHubCards = window.systemHubCards || [];
if (!customElements.get('sh-watchdog-card')) {
  pickerDefine('sh-watchdog-card', IntegrationWatchdogCard);
  pickerDefine('sh-watchdog-card-editor', IntegrationWatchdogCardEditor);
  window.systemHubCards.push({
    type: 'sh-watchdog-card',
    name: 'Watchdog Card (System Hub)',
    description: 'The overall status of the System Hub Watchdog: unavailable integrations and recent reloads',
    preview: true,
    documentationURL: 'https://github.com/juju35/ha-system-hub',
  });
  console.info(
    `%c INTEGRATION-WATCHDOG-CARD %c v${INTEGRATION_WATCHDOG_CARD_VERSION} `,
    'background:#14b8a6;color:#fff;font-weight:700',
    '',
  );
}
if (!customElements.get('sh-watchdog-mini-card')) {
  pickerDefine('sh-watchdog-mini-card', IntegrationWatchdogMiniCard);
  pickerDefine('sh-watchdog-mini-card-editor', IntegrationWatchdogMiniCardEditor);
  window.systemHubCards.push({
    type: 'sh-watchdog-mini-card',
    name: 'Watchdog Mini Card (System Hub)',
    description: 'The System Hub Watchdog status and unavailable integrations on two lines, with a detail button showing the full card',
    preview: true,
    documentationURL: 'https://github.com/juju35/ha-system-hub',
  });
}
