// ---------------------------------------------------------------------------
// Visual editors (ha-form)
// ---------------------------------------------------------------------------
import { LEVEL_COLORS, THRESHOLDS, t } from "./helpers.js";
import { discover, tapNone } from "./entity-discovery.js";
import { shbClean, shbData, shbFields, shbLabel } from "./illustrated-header.js";

// The values whose sensor the visual editor lets the user choose (`entities`).
export const EDITOR_ENTITIES = ["processor_use", "processor_temperature", "memory_use_percent", "swap_use_percent", "last_boot"];

export class SystemMonitorEditorBase extends HTMLElement {
  static get toggles() {
    return [];
  }

  /** Boolean options off by default (show_actions). */
  static get offToggles() {
    return [];
  }

  /** Boolean options, all on by default but the offToggles. */
  _booleans() {
    return ["show_title", "show_subtitle", ...this.constructor.toggles];
  }

  _offBooleans() {
    return this.constructor.offToggles;
  }

  setConfig(config) {
    this._config = { ...config };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _schema() {
    const tr = (k) => t(this._hass, this._config, k);
    const sm = this._hass ? discover(this._hass, this._config) : { nets: {} };
    const ifOptions = Object.keys(sm.nets)
      .filter((i) => sm.nets[i].throughput_network_in || sm.nets[i].throughput_network_out)
      .map((i) => ({ value: i, label: i }));
    return [
      { name: "title", selector: { text: {} } },
      ...shbFields(this._hass),
      {
        type: "grid",
        name: "",
        schema: [
          ...[...this._booleans(), ...this._offBooleans()].map((name) => ({ name, selector: { boolean: {} } })),
        ],
      },
      // tap_action (#129): open the entity's details (default) or nothing.
      { name: "tap_action", selector: { ui_action: { actions: ["more-info", "none"], default_action: "more-info" } } },
      // gauge_style (#131): the System section's gauges as rings (default) or as lines with bars.
      {
        name: "gauge_style",
        selector: { select: { mode: "dropdown", options: [{ value: "ring", label: tr("gauge_ring") }, { value: "bar", label: tr("gauge_bar") }] } },
      },
      // Level colours (#131): Home Assistant's colours, any CSS colour in YAML.
      { type: "grid", name: "", schema: Object.keys(LEVEL_COLORS).map((name) => ({ name, selector: { ui_color: {} } })) },
      // Warning / critical thresholds, shown at their default values.
      {
        type: "grid",
        name: "",
        schema: Object.keys(THRESHOLDS).map((name) => ({
          name,
          selector: {
            number: {
              min: 0,
              max: name.startsWith("temp") ? 150 : name.startsWith("backup") ? 365 : 100,
              step: 1,
              mode: "box",
              unit_of_measurement: name.startsWith("temp") ? "°C" : name.startsWith("backup") ? "d" : "%",
            },
          },
        })),
      },
      {
        name: "interface",
        selector: { select: { mode: "dropdown", custom_value: true, options: [{ value: "", label: tr("lang_auto") }, ...ifOptions] } },
      },
      // Sensors of the user's choice for the main values (the disks and interfaces are set in YAML), saved under
      // `entities`, as the YAML option.
      {
        type: "expandable",
        name: "entities",
        title: tr("entities"),
        schema: EDITOR_ENTITIES.map((key) => ({ name: key, selector: { entity: { domain: "sensor" } } })),
      },
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
    if (!this._form) {
      this._form = document.createElement("ha-form");
      this._form.computeLabel = (s) => shbLabel(this._hass, s.name) ?? t(this._hass, this._config, EDITOR_ENTITIES.includes(s.name) ? `ent_${s.name}` : s.name);
      this._form.computeHelper = (s) => {
        const key = `${s.name}_helper`;
        const text = t(this._hass, this._config, key);
        return text === key ? undefined : text;
      };
      this._form.addEventListener("value-changed", (ev) => {
        ev.stopPropagation();
        const config = { ...ev.detail.value };
        // The sensors chosen in the editor, merged into the YAML ones (disks, interfaces); emptied ones dropped.
        if (config.entities && typeof config.entities === "object") {
          const entities = Object.fromEntries(Object.entries(config.entities).filter(([, v]) => v !== "" && v !== undefined && v !== null));
          config.entities = Object.keys(entities).length ? entities : undefined;
        }
        // tap_action at its default (more-info) is left out of the YAML.
        if (config.tap_action && !tapNone(config)) delete config.tap_action;
        for (const [k, v] of Object.entries(config)) {
          // Keep the YAML minimal: drop empty values, toggles left at their default (true) and default thresholds.
          if (
            v === "" ||
            v === undefined ||
            v === null ||
            (this._booleans().includes(k) && v === true) ||
            (this._offBooleans().includes(k) && v === false) ||
            THRESHOLDS[k] === v ||
            (k === "gauge_style" && v === "ring")
          )
            delete config[k];
        }
        this._config = config;
        this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: shbClean(config) }, bubbles: true, composed: true }));
      });
      this.appendChild(this._form);
    }
    this._form.hass = this._hass;
    // ha-form renders again on a new data or schema object: rebuild them only when the config, the language or the
    // network interfaces change, not on every state change of Home Assistant.
    if (this._formConfig !== this._config) {
      this._formConfig = this._config;
      const data = { ...THRESHOLDS, ...this._config };
      for (const name of this._booleans()) if (data[name] === undefined) data[name] = true;
      for (const name of this._offBooleans()) if (data[name] === undefined) data[name] = false;
      if (data.gauge_style === undefined) data.gauge_style = "ring";
      // `tap_action: none` written in YAML as a plain string: the action selector reads an object.
      if (typeof data.tap_action === "string") data.tap_action = { action: data.tap_action };
      this._form.data = shbData(data);
    }
    const schema = this._schema();
    const key = JSON.stringify(schema);
    if (key !== this._schemaKey) {
      this._schemaKey = key;
      this._form.schema = schema;
    }
  }
}

export class SystemMonitorCardEditor extends SystemMonitorEditorBase {
  static get toggles() {
    return ["show_system", "show_disk", "show_uptime", "show_load", "show_ip", "show_network", "show_history", "show_storage", "show_backups", "show_processes"];
  }

  static get offToggles() {
    return ["show_actions"];
  }
}

export class SystemMonitorMiniCardEditor extends SystemMonitorEditorBase {
  // The full card's sections too: the zoom button shows the full card with this same configuration.
  static get toggles() {
    return ["show_storage", "show_backups", "show_network", "show_history", "show_uptime", "zoom", "show_system", "show_disk", "show_load", "show_ip", "show_processes"];
  }

  static get offToggles() {
    return ["show_actions"];
  }
}
