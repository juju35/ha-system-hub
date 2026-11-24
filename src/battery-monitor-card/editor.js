// ── Editor ───────────────────────────────────────────────────────────────────
import { pickerDefine } from "./card-picker.js";
import { BATTERY_MONITOR_CARD_VERSION } from "./core.js";
import { BM_DEFAULTS, bmLang, bmT } from "./i18n-helpers.js";
import { BM_TYPES, bmCandidates, bmDetectedType, bmModelOf, bmPick } from "./battery-types.js";
import { shbClean, shbData, shbFields, shbLabel } from "./illustrated-header.js";
import { BatteryMonitorCard } from "./card.js";
import { BatteryMonitorMiniCard } from "./mini-card.js";

export const BM_HELPERS = ['entity', 'title', 'only_low', 'hide_when_ok', 'notify_button', 'popup', 'expanded', 'csv_button', 'language', 'battery_models', 'battery_types'];

// A map of the editor (battery types by battery or by model) without its empty entries, or undefined when empty.
export const bmCleanMap = (map) => {
  const out = Object.fromEntries(Object.entries(map || {}).filter(([, v]) => v && String(v).trim()));
  return Object.keys(out).length ? out : undefined;
};

export class BatteryMonitorCardEditor extends HTMLElement {
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
      // The language is read at each call: changing the language option translates the labels at once.
      const t = (key) => bmT(bmLang(this._hass, this._config), key);
      // Inside "Battery types", each field is a battery: labelled with its name and room.
      this._form.computeLabel = (s) => shbLabel(this._hass, s.name) ?? this._labels?.[s.name] ?? t(`ed_${s.name}`);
      this._form.computeHelper = (s) => (BM_HELPERS.includes(s.name) ? t(`ed_${s.name}_helper`) : undefined);
      this._form.addEventListener('value-changed', (ev) => {
        const config = { ...ev.detail.value };
        // Options left at their default are not written to the YAML.
        for (const k of Object.keys(config)) {
          if (config[k] === '' || config[k] == null || BM_DEFAULTS[k] === config[k]) delete config[k];
        }
        for (const key of ['battery_models', 'battery_types']) {
          const map = bmCleanMap(config[key]);
          if (map) config[key] = map;
          else delete config[key];
        }
        this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: shbClean(config) }, bubbles: true, composed: true }));
      });
      this.appendChild(this._form);
    }
    this._form.hass = this._hass;
    const c = this._config;
    const lang = bmLang(this._hass, c);
    const entity = c.entity || bmPick(this._hass, bmCandidates(this._hass.entities));
    // The schema and the data only depend on the config, the registries, the language and the sensor's state:
    // reassigning them at every Home Assistant update would re-render ha-form while the user is typing.
    const deps = this._deps;
    if (
      deps &&
      deps.config === c &&
      deps.lang === lang &&
      deps.state === this._hass.states?.[entity] &&
      deps.entities === this._hass.entities &&
      deps.devices === this._hass.devices
    ) {
      return;
    }
    this._deps = {
      config: c,
      lang,
      state: this._hass.states?.[entity],
      entities: this._hass.entities,
      devices: this._hass.devices,
    };
    this._form.data = shbData({
      ...BM_DEFAULTS,
      ...c,
      battery_models: { ...(c.battery_models || {}) },
      battery_types: { ...(c.battery_types || {}) },
    });
    const all = this._hass.states?.[entity]?.attributes.batteries || [];
    // By model: the models of the batteries whose type is not detected (and the ones already set), with their
    // manufacturer and how many devices; by battery: the ones left without a type, and the ones already set.
    const undetected = all.filter((b) => !bmDetectedType(this._hass, b));
    const models = new Map();
    for (const b of all) {
      const model = bmModelOf(this._hass, b);
      if (!model || (!c.battery_models?.[model] && !undetected.includes(b))) continue;
      const m = models.get(model) || { n: 0, maker: this._hass.devices?.[b.device_id]?.manufacturer || '' };
      m.n += 1;
      models.set(model, m);
    }
    const batteries = all.filter(
      (b) => c.battery_types?.[b.entity_id] || (undetected.includes(b) && !c.battery_models?.[bmModelOf(this._hass, b)]),
    );
    this._labels = {
      ...Object.fromEntries(
        [...models].map(([model, m]) => [
          model,
          [model, m.maker, bmT(lang, m.n > 1 ? 'devices_n' : 'devices_one', { n: m.n })].filter(Boolean).join(' · '),
        ]),
      ),
      ...Object.fromEntries(batteries.map((b) => [b.entity_id, b.area ? `${b.name} · ${b.area}` : b.name])),
    };
    const typeOptions = BM_TYPES.map((v) => ({ value: v, label: v === 'rechargeable' ? bmT(lang, 'rechargeable') : v }));
    this._form.schema = [
      { name: 'entity', selector: { entity: { filter: { integration: 'system_hub', domain: 'sensor' } } } },
      { name: 'title', selector: { text: {} } },
      { name: 'columns', selector: { number: { min: 1, max: 3, mode: 'box' } } },
      ...shbFields(this._hass),
      { name: 'show_title', selector: { boolean: {} } },
      { name: 'only_low', selector: { boolean: {} } },
      { name: 'hide_when_ok', selector: { boolean: {} } },
      { name: 'notify_button', selector: { boolean: {} } },
      { name: 'popup', selector: { boolean: {} } },
      { name: 'expanded', selector: { boolean: {} } },
      { name: 'csv_button', selector: { boolean: {} } },
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
      ...bmTypeSection('battery_models', 'mdi:devices', [...models.keys()].sort(), typeOptions, lang),
      ...bmTypeSection('battery_types', 'mdi:battery-outline', batteries.map((b) => b.entity_id), typeOptions, lang),
    ];
  }
}

// A folded editor section with a type field for each of `names` (models or battery entities), none when empty.
export function bmTypeSection(name, icon, names, options, lang) {
  if (!names.length) return [];
  const selector = { select: { mode: 'dropdown', custom_value: true, options } };
  return [{ name, type: 'expandable', title: bmT(lang, `ed_${name}`), icon, schema: names.map((n) => ({ name: n, selector })) }];
}

if (!customElements.get('sh-batteries-card')) {
  pickerDefine('sh-batteries-card', BatteryMonitorCard);
  pickerDefine('sh-batteries-card-editor', BatteryMonitorCardEditor);
  pickerDefine('sh-batteries-mini-card', BatteryMonitorMiniCard);
  window.systemHubCards = window.systemHubCards || [];
  window.systemHubCards.push(
    {
      type: 'sh-batteries-card',
      name: 'Battery Monitor Card',
      description: 'The batteries watched by System Hub: icon, name and level, the lowest first',
      preview: true,
      documentationURL: 'https://github.com/juju35/ha-system-hub',
    },
    {
      type: 'sh-batteries-mini-card',
      name: 'Battery Monitor Mini Card',
      description: 'Compact: the status and only the batteries needing attention, with a button for the full card',
      preview: true,
      documentationURL: 'https://github.com/juju35/ha-system-hub',
    },
  );
  console.info(
    `%c BATTERY-MONITOR-CARD %c v${BATTERY_MONITOR_CARD_VERSION} `,
    'background:#14b8a6;color:#fff;font-weight:700',
    '',
  );
}
