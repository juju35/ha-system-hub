// ── Editor ───────────────────────────────────────────────────────────────────
import { pickerDefine } from "./card-picker.js";
import { GIT_SYNC_CARD_VERSION, GS_DOMAIN } from "./core.js";
import { GS_DEFAULTS, GS_MINI_DEFAULTS, gsDevices, gsLang, gsT } from "./i18n-helpers.js";
import { shbClean, shbData, shbFields, shbLabel } from "./illustrated-header.js";
import { GitSyncCard } from "./card.js";
import { GitSyncMiniCard } from "./mini-card.js";
import { GitSyncDiffDialog } from "./diff-viewer.js";

export const GS_HELPERS = ['entity', 'title', 'zoom', 'show_files', 'show_export', 'language'];

// jscpd:ignore-start (each card is its own dashboard resource: the editor boilerplate is theirs)
export class GitSyncCardEditor extends HTMLElement {
  // Options of the card; the mini card's editor adds the zoom button.
  _defaults() {
    return GS_DEFAULTS;
  }

  _options() {
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
      const t = (key) => gsT(gsLang(this._hass, this._config), key);
      this._form.computeLabel = (s) => shbLabel(this._hass, s.name) ?? t(`ed_${s.name}`);
      this._form.computeHelper = (s) => (GS_HELPERS.includes(s.name) ? t(`ed_${s.name}_helper`) : undefined);
      this._form.addEventListener('value-changed', (ev) => {
        const config = { ...ev.detail.value };
        // Options left at their default are not written to the YAML.
        for (const k of Object.keys(config)) {
          if (config[k] === '' || config[k] == null || this._defaults()[k] === config[k]) delete config[k];
        }
        this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: shbClean(config) }, bubbles: true, composed: true }));
      });
      this.appendChild(this._form);
    }
    this._form.hass = this._hass;
    const c = this._config;
    const lang = gsLang(this._hass, c);
    // Reassigning the schema at every Home Assistant update would re-render ha-form while the user is typing.
    if (this._deps && this._deps.config === c && this._deps.lang === lang) return;
    this._deps = { config: c, lang };
    this._form.data = shbData({ ...this._defaults(), ...c });
    this._form.schema = [
      {
        name: 'entity',
        selector: {
          entity: {
            filter: { integration: GS_DOMAIN, domain: 'sensor' },
            // The Git Sync module's sensors only, not those of the other System Hub modules
            include_entities: Object.values(gsDevices(this._hass?.entities))
              .flatMap((d) => Object.values(d))
              .filter((id) => id.startsWith('sensor.')),
          },
        },
      },
      { name: 'title', selector: { text: {} } },
      ...this._options(),
      ...shbFields(this._hass),
      { name: 'show_title', selector: { boolean: {} } },
      { name: 'show_subtitle', selector: { boolean: {} } },
      { name: 'show_files', selector: { boolean: {} } },
      { name: 'show_export', selector: { boolean: {} } },
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
              { value: 'sr', label: 'Српски' },
              { value: 'sr-Latn', label: 'Srpski (latinica)' },
            ],
          },
        },
      },
    ];
  }
}
// jscpd:ignore-end

export class GitSyncMiniCardEditor extends GitSyncCardEditor {
  _defaults() {
    return GS_MINI_DEFAULTS;
  }

  _options() {
    return [{ name: 'zoom', selector: { boolean: {} } }];
  }
}

if (!customElements.get('sh-git-sync-card')) {
  pickerDefine('sh-git-sync-card', GitSyncCard);
  pickerDefine('sh-git-sync-card-editor', GitSyncCardEditor);
  pickerDefine('sh-git-sync-mini-card', GitSyncMiniCard);
  pickerDefine('sh-git-sync-mini-card-editor', GitSyncMiniCardEditor);
  pickerDefine('git-sync-diff-dialog', GitSyncDiffDialog);
  window.systemHubCards = window.systemHubCards || [];
  window.systemHubCards.push(
    {
      type: 'sh-git-sync-card',
      name: 'Git Sync Card',
      description: 'Git status of the configuration, Commit & push and dashboard export',
      preview: true,
      documentationURL: 'https://github.com/juju35/ha-system-hub',
    },
    {
      type: 'sh-git-sync-mini-card',
      name: 'Git Sync Mini Card',
      description: 'Compact Git status with Commit & push; its zoom button shows the full card',
      preview: true,
      documentationURL: 'https://github.com/juju35/ha-system-hub',
    },
  );
  console.info(`%c GIT-SYNC-CARD %c v${GIT_SYNC_CARD_VERSION} `, 'background:#f05133;color:#fff;font-weight:700', '');
}
