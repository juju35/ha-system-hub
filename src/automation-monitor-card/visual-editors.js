// ---------------------------------------------------------------------------
// Visual editors (ha-form)
// ---------------------------------------------------------------------------
import { DEFAULT_MAX_ITEMS } from "./core.js";
import { lang, t } from "./helpers.js";
import { shbClean, shbData, shbFields, shbLabel } from "./illustrated-header.js";
import { STRINGS } from "./i18n/strings.js";

export class AutomationMonitorEditorBase extends HTMLElement {
  // [name, default]
  static get toggles() {
    return [
      ["show_title", true],
      ["show_subtitle", true],
      ["show_failed", true],
      ["show_linked", true],
      ["hide_when_ok", false],
    ];
  }

  static extraFields() {
    return [];
  }

  setConfig(config) {
    this._config = { ...config };
    // Former options: collapse_<list>: false (still honoured by the card) becomes expand_<list>: true, and
    // collapse_<list> is dropped, so the "expanded by default" toggle shows the list state and acts on it.
    let migrated = false;
    for (const key of ["failed", "linked"]) {
      const collapse = `collapse_${key}`;
      if (!(collapse in this._config) || !this.constructor.toggles.some(([name]) => name === `expand_${key}`)) continue;
      if (this._config[collapse] === false) this._config[`expand_${key}`] = true;
      delete this._config[collapse];
      migrated = true;
    }
    if (migrated) this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: shbClean({ ...this._config }) }, bubbles: true, composed: true }));
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _schema() {
    const tr = (k) => t(this._hass, this._config, k);
    return [
      { name: "title", selector: { text: {} } },
      ...shbFields(this._hass),
      ...this.constructor.extraFields(tr),
      { name: "exclude_devices", selector: { device: { multiple: true } } },
      // Text, not an entity picker: patterns with * and ? are allowed.
      { name: "exclude_entities", selector: { text: { multiple: true } } },
      { type: "grid", name: "", schema: this.constructor.toggles.map(([name]) => ({ name, selector: { boolean: {} } })) },
      // The two sensors, only needed when they can't be found automatically.
      { name: "failed_entity", selector: { entity: { domain: "sensor" } } },
      { name: "linked_entity", selector: { entity: { domain: "sensor" } } },
      {
        name: "language",
        selector: {
          select: {
            mode: "dropdown",
            options: [
              { value: "", label: tr("lang_auto") },
              { value: "en", label: "English" },
              { value: "fr", label: "Français" },
              { value: "de", label: "Deutsch" },
              { value: "es", label: "Español" },
              { value: "sr", label: "Српски" },
              { value: "sr-Latn", label: "Srpski (latinica)" },
              { value: "it", label: "Italiano" },
              { value: "nl", label: "Nederlands" },
              { value: "pt", label: "Português (Portugal)" },
              { value: "pl", label: "Polski" },
              { value: "ro", label: "Română" },
              { value: "da", label: "Dansk" },
              { value: "sv", label: "Svenska" },
              { value: "bg", label: "Български" },
              { value: "ru", label: "Русский" },
              { value: "uk", label: "Українська" },
              { value: "hu", label: "Magyar" },
              { value: "sk", label: "Slovenčina" },
              { value: "cs", label: "Čeština" },
              { value: "sl", label: "Slovenščina" },
              { value: "lv", label: "Latviešu" },
              { value: "el", label: "Ελληνικά" },
            ],
          },
        },
      },
    ];
  }

  _render() {
    if (!this._hass || !this._config) return;
    const toggles = this.constructor.toggles;
    if (!this._form) {
      this._form = document.createElement("ha-form");
      this._form.computeLabel = (s) => shbLabel(this._hass, s.name) ?? t(this._hass, this._config, s.name);
      this._form.computeHelper = (s) => STRINGS[lang(this._hass, this._config)][`${s.name}_helper`];
      this._form.addEventListener("value-changed", (ev) => {
        ev.stopPropagation();
        const config = { ...ev.detail.value };
        const defaults = { ...Object.fromEntries(toggles), max_items: DEFAULT_MAX_ITEMS };
        // Keep the YAML minimal: drop empty values and options left at their default.
        for (const [k, v] of Object.entries(config)) if (v === "" || v === undefined || v === null || (Array.isArray(v) && !v.length) || (k in defaults && v === defaults[k])) delete config[k];
        this._config = config;
        this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: shbClean(config) }, bubbles: true, composed: true }));
      });
      this.appendChild(this._form);
    }
    this._form.hass = this._hass;
    // New data or schema objects make ha-form render again: only give them when the configuration or the
    // language has changed, not on every state change of Home Assistant while the editor is open.
    if (this._formConfig !== this._config) {
      this._formConfig = this._config;
      const data = { ...this._config };
      for (const [name, def] of toggles) if (data[name] === undefined) data[name] = def;
      if (this.constructor.extraFields(() => "").some((f) => f.name === "max_items") && data.max_items === undefined) data.max_items = DEFAULT_MAX_ITEMS;
      this._form.data = shbData(data);
    }
    const l = lang(this._hass, this._config);
    if (this._formLang !== l) {
      this._formLang = l;
      this._form.schema = this._schema();
    }
  }
}

export class AutomationMonitorCardEditor extends AutomationMonitorEditorBase {
  static get toggles() {
    return [...AutomationMonitorEditorBase.toggles, ["expand_failed", false], ["expand_linked", false], ["show_details", true], ["show_controls", true]];
  }

  static extraFields() {
    return [{ name: "max_items", selector: { number: { min: 1, max: 50, mode: "box" } } }];
  }
}

// The full card's options too: the detail button shows the full card with this same configuration.
export class AutomationMonitorMiniCardEditor extends AutomationMonitorEditorBase {
  static get toggles() {
    return [...AutomationMonitorCardEditor.toggles, ["zoom", true]];
  }

  static extraFields() {
    return AutomationMonitorCardEditor.extraFields();
  }
}
