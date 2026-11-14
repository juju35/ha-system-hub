"""Render the System Hub sidebar panel (each tab, light and dark, and on a phone) and save the README screenshots.

Usage: python scripts/screenshots.py  (needs `pip install playwright` and `playwright install chromium`)
CHROMIUM_PATH=/path/to/chrome to use another browser. The clock is frozen, the data are mock values with neutral names,
and the strings are the integration's English translations, as Home Assistant serves them to the panel.
A file is only rewritten when its decoded pixels differ from the one already there (compared through ffmpeg): a
re-encode that looks the same leaves the repository untouched.
"""

import json
import os
import shutil
import subprocess
from datetime import datetime, timedelta
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
COMPONENT = ROOT / "custom_components/system_hub"
PANEL_JS = (COMPONENT / "frontend/system-hub-panel.js").read_text(encoding="utf-8")
ICONS_JS = (COMPONENT / "frontend/system-hub-icons.js").read_text(encoding="utf-8")
CARD_JS = (COMPONENT / "frontend/cards/system-hub-card.js").read_text(encoding="utf-8")
ICONS = json.loads((ROOT / "scripts/screenshot-icons.json").read_text(encoding="utf-8"))
NOW = "2026-11-10T09:00:00+01:00"
WIDTH = 1100
PHONE = (390, 844)

THEMES = {
    "light": {
        "--primary-background-color": "#e8eaed",
        "--secondary-background-color": "#ececec",
        "--card-background-color": "#ffffff",
        "--primary-text-color": "#212121",
        "--secondary-text-color": "#727272",
        "--divider-color": "rgba(0,0,0,.12)",
        "--app-header-background-color": "#03a9f4",
        "--app-header-text-color": "#ffffff",
    },
    "dark": {
        "--primary-background-color": "#111111",
        "--secondary-background-color": "#282828",
        "--card-background-color": "#1c1c1c",
        "--primary-text-color": "#e1e1e1",
        "--secondary-text-color": "#9b9b9b",
        "--divider-color": "rgba(225,225,225,.12)",
        "--app-header-background-color": "#101e24",
        "--app-header-text-color": "#e1e1e1",
    },
}
COMMON = {
    "--primary-color": "#03a9f4",
    "--success-color": "#43a047",
    "--warning-color": "#ffa600",
    "--error-color": "#db4437",
    "--text-primary-color": "#ffffff",
}


def _flatten(prefix, value, out):
    if isinstance(value, dict):
        for key, item in value.items():
            _flatten(f"{prefix}.{key}", item, out)
    else:
        out[prefix] = value
    return out


# The translations as Home Assistant hands them to the frontend: flat keys under component.system_hub.
STRINGS = _flatten("component.system_hub", json.loads((COMPONENT / "translations/en.json").read_text("utf-8")), {})

# Minimal stand-ins for Home Assistant's <ha-card>, <ha-icon>, <ha-switch>, <ha-menu-button> and <ha-form>.
HA_ELEMENTS = (
    "const ICONS = "
    + json.dumps(ICONS)
    + ";"
    + """
customElements.define("ha-card", class extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" }).innerHTML =
      "<style>:host{display:block;background:var(--card-background-color);border-radius:12px;" +
      "border:1px solid var(--divider-color);color:var(--primary-text-color);overflow:hidden}</style><slot></slot>";
  }
});
customElements.define("ha-icon", class extends HTMLElement {
  static get observedAttributes() { return ["icon"]; }
  connectedCallback() { this._draw(); }
  attributeChangedCallback() { this._draw(); }
  _draw() {
    const icon = this.getAttribute("icon") || "";
    // An icon set of its own (system-hub:good…, the sidebar emblem): drawn from window.customIcons, as Home Assistant does
    const [set, name] = icon.split(":");
    if (set !== "mdi" && window.customIcons?.[set]) {
      window.customIcons[set].getIcon(name).then(({ path, viewBox }) => {
        this.style.display = "inline-flex";
        this.innerHTML = '<svg viewBox="' + (viewBox || "0 0 24 24") + '" style="width:var(--mdc-icon-size,24px);height:var(--mdc-icon-size,24px);fill:currentColor"><path d="' + path + '"/></svg>';
      });
      return;
    }
    const path = ICONS[icon.replace("mdi:", "")] || "";
    this.style.display = "inline-flex";
    this.innerHTML = '<svg viewBox="0 0 24 24" style="width:var(--mdc-icon-size,24px);height:var(--mdc-icon-size,24px);fill:currentColor"><path d="' + path + '"/></svg>';
  }
});
customElements.define("ha-menu-button", class extends HTMLElement {
  connectedCallback() {
    this.style.cssText = "display:flex;padding:8px;--mdc-icon-size:24px";
    this.innerHTML = '<ha-icon icon="mdi:menu"></ha-icon>';
  }
});
// A stand-in for Home Assistant's <ha-form>, drawn from the serialized schema of a step as the options flow sends it:
// filled text fields with their label inside, a unit after a number, switches for the booleans, a list for a select
// in list mode, the helper under each field.
customElements.define("ha-form", class extends HTMLElement {
  set schema(v) { this._schema = v; this._queue(); }
  set data(v) { this._data = v; this._queue(); }
  set computeLabel(v) { this._label = v; this._queue(); }
  set computeHelper(v) { this._helper = v; this._queue(); }
  _queue() { if (!this._q) { this._q = true; queueMicrotask(() => { this._q = false; this._draw(); }); } }
  connectedCallback() { this._draw(); }
  _draw() {
    const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const data = this._data || {};
    const caret = '<svg viewBox="0 0 24 24"><path d="M7,10L12,15L17,10H7Z"/></svg>';
    const box = (label, value, after = "") =>
      '<div class="box"><span class="lab">' + esc(label) + '</span><span class="val' + (value === "" ? " none" : "") + '">' +
      (value === "" ? "&nbsp;" : esc(value)) + "</span>" + after + "</div>";
    const field = (f) => {
      const label = (this._label && this._label(f)) || f.name;
      const helper = (this._helper && this._helper(f)) || "";
      const sel = f.selector || {};
      const kind = Object.keys(sel)[0] || f.type;
      const cfg = sel[kind] || {};
      const value = data[f.name];
      let html;
      if (kind === "boolean") {
        html = '<div class="bool"><span class="blab">' + esc(label) + "</span>" + (value ? "<ha-switch checked></ha-switch>" : "<ha-switch></ha-switch>") + "</div>";
      } else if (kind === "select" && cfg.mode === "list") {
        const options = (cfg.options || []).map((o) => (typeof o === "object" ? o : { value: o, label: o }));
        const chosen = [].concat(value ?? []);
        html = '<div class="list"><span class="blab">' + esc(label) + "</span>" + options.map((o) =>
          '<span class="opt"><span class="tick' + (chosen.includes(o.value) ? " on" : "") + '"></span>' + esc(o.label) + "</span>").join("") + "</div>";
      } else if (kind === "select" || kind === "entity" || kind === "device") {
        const options = (cfg.options || []).map((o) => (typeof o === "object" ? o : { value: o, label: o }));
        const shown = [].concat(value ?? []).map((v) => options.find((o) => o.value === v)?.label ?? v).join(", ");
        html = box(label, shown, '<span class="caret">' + caret + "</span>");
      } else if (kind === "number") {
        html = box(label, value ?? "", cfg.unit_of_measurement ? '<span class="unit">' + esc(cfg.unit_of_measurement) + "</span>" : "");
      } else if (kind === "time") {
        html = box(label, String(value ?? "").slice(0, 5));
      } else {
        html = box(label, typeof value === "object" ? JSON.stringify(value) : (value ?? ""));
      }
      return '<div class="field">' + html + (helper ? '<div class="help">' + esc(helper) + "</div>" : "") + "</div>";
    };
    this.shadowRoot || this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = "<style>" +
      ":host{display:flex;flex-direction:column;gap:20px}" +
      ".box{position:relative;display:flex;align-items:center;min-height:56px;padding:0 12px 0 16px;border-radius:4px 4px 0 0;" +
      "background:var(--input-fill-color, color-mix(in srgb, var(--primary-text-color) 5%, transparent));" +
      "border-bottom:1px solid var(--secondary-text-color);box-sizing:border-box}" +
      ".lab{position:absolute;left:16px;top:8px;font-size:12px;color:var(--secondary-text-color)}" +
      ".val{flex:1;padding-top:18px;font-size:16px;color:var(--primary-text-color);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      ".unit{padding-top:18px;padding-left:8px;color:var(--secondary-text-color)}" +
      ".caret{display:flex;fill:var(--secondary-text-color)}.caret svg{width:24px;height:24px}" +
      ".help{font-size:12px;color:var(--secondary-text-color);padding:4px 16px 0;line-height:1.4}" +
      ".bool{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:40px}" +
      ".blab{font-size:14px;color:var(--primary-text-color)}" +
      ".list{display:flex;flex-direction:column;gap:10px}.opt{display:flex;align-items:center;gap:12px;font-size:14px}" +
      ".tick{width:16px;height:16px;border:2px solid var(--secondary-text-color);border-radius:2px;box-sizing:border-box}" +
      ".tick.on{background:var(--primary-color);border-color:var(--primary-color)}" +
      "</style>" + (this._schema || []).map(field).join("");
  }
});
customElements.define("ha-switch", class extends HTMLElement {
  connectedCallback() {
    const on = this.hasAttribute("checked");
    this.style.cssText = "display:inline-block;flex:none;width:36px;height:14px;border-radius:7px;position:relative;" +
      "background:" + (on ? "color-mix(in srgb, var(--primary-color) 50%, transparent)" : "var(--divider-color)");
    this.innerHTML = '<span style="position:absolute;top:-3px;left:' + (on ? "16px" : "-2px") + ';width:20px;height:20px;' +
      'border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,.4);background:' + (on ? "var(--primary-color)" : "#fafafa") + '"></span>';
  }
});"""
)


def _history(base, wobble):
    """24 h of CPU readings every 30 minutes, gently moving around `base` (the panel only draws the values)."""
    return [[1794229200 + 1800 * i, base + wobble[i % len(wobble)]] for i in range(48)]


CONTAINERS = [
    # slug, name, kind, state, version, latest, cpu %, memory MiB, memory %, boot, image
    (
        "homeassistant",
        "Home Assistant Core",
        "core",
        "started",
        "2026.11.1",
        "2026.11.1",
        6.4,
        1180,
        29.5,
        None,
        "ghcr.io/home-assistant/qemux86-64-homeassistant",
    ),
    (
        "supervisor",
        "Supervisor",
        "supervisor",
        "started",
        "2026.11.0",
        "2026.11.1",
        0.8,
        210,
        5.2,
        None,
        "ghcr.io/home-assistant/amd64-hassio-supervisor",
    ),
    (
        "audio",
        "Audio",
        "plugin",
        "started",
        "2026.10.0",
        "2026.10.0",
        0.1,
        22,
        0.5,
        None,
        "ghcr.io/home-assistant/amd64-hassio-audio",
    ),
    (
        "cli",
        "CLI",
        "plugin",
        "started",
        "2026.10.1",
        "2026.10.1",
        0.0,
        4,
        0.1,
        None,
        "ghcr.io/home-assistant/amd64-hassio-cli",
    ),
    (
        "dns",
        "DNS",
        "plugin",
        "started",
        "2026.10.0",
        "2026.10.0",
        0.1,
        12,
        0.3,
        None,
        "ghcr.io/home-assistant/amd64-hassio-dns",
    ),
    (
        "multicast",
        "Multicast",
        "plugin",
        "started",
        "2026.10.0",
        "2026.10.0",
        0.0,
        3,
        0.1,
        None,
        "ghcr.io/home-assistant/amd64-hassio-multicast",
    ),
    (
        "observer",
        "Observer",
        "plugin",
        "started",
        "2026.08.0",
        "2026.08.0",
        0.0,
        6,
        0.1,
        None,
        "ghcr.io/home-assistant/amd64-hassio-observer",
    ),
    (
        "core_mosquitto",
        "Mosquitto broker",
        "addon",
        "started",
        "6.5.1",
        "6.5.1",
        0.3,
        18,
        0.4,
        "auto",
        "ghcr.io/home-assistant/amd64-addon-mosquitto",
    ),
    (
        "a0d7b954_zigbee2mqtt",
        "Zigbee2MQTT",
        "addon",
        "started",
        "2.6.2",
        "2.7.0",
        2.1,
        164,
        4.1,
        "auto",
        "ghcr.io/zigbee2mqtt/zigbee2mqtt-amd64",
    ),
    (
        "core_matter_server",
        "Matter Server",
        "addon",
        "error",
        "8.1.0",
        "8.1.0",
        None,
        None,
        None,
        "auto",
        "ghcr.io/home-assistant/app-matter-server",
    ),
    (
        "a0d7b954_vscode",
        "Studio Code Server",
        "addon",
        "stopped",
        "5.20.0",
        "5.20.0",
        None,
        None,
        None,
        "manual",
        "ghcr.io/hassio-addons/vscode/amd64",
    ),
]


def _orphan(entity_id, name, platform, reason, since, **extra):
    return {
        "entity_id": entity_id,
        "name": name,
        "platform": platform,
        "reason": reason,
        "since": since,
        "entry_id": None,
        "entry_title": None,
        "device": None,
        "disabled": False,
        "used_by": [],
        **extra,
    }


def mock_orphans():
    """What system_hub/orphans answers: the orphan entities of each kind, two still used, one orphan device."""
    used = [
        {
            "type": "automation",
            "id": "automation.porch_at_sunset",
            "name": "Porch light at sunset",
            "path": "/config/automation/edit/17",
        },
        {"type": "dashboard", "id": "lovelace", "name": "Overview", "path": "/lovelace"},
    ]
    entities = [
        _orphan(
            "sensor.old_hub_temperature",
            "Old hub temperature",
            "acme_hub",
            "entry_removed",
            "2026-10-28T10:00:00+01:00",
            device="Old hub",
            entry_title="Acme hub",
        ),
        _orphan(
            "binary_sensor.old_hub_motion",
            "Old hub motion",
            "acme_hub",
            "entry_removed",
            "2026-10-28T10:00:00+01:00",
            device="Old hub",
            disabled=True,
        ),
        _orphan("switch.pool_pump", "Pool pump", "pool_controller", "integration_missing", "2026-11-02T18:40:00+01:00"),
        _orphan(
            "light.porch",
            "Porch light",
            "hue",
            "not_provided",
            "2026-11-06T07:15:00+01:00",
            device="Porch",
            used_by=used,
        ),
        _orphan(
            "sensor.porch_light_power",
            "Porch light power",
            "hue",
            "not_provided",
            "2026-11-06T07:15:00+01:00",
            device="Porch",
        ),
        _orphan(
            "sensor.garage_door_battery",
            "Garage door battery",
            "zha",
            "unavailable",
            "2026-11-07T22:05:00+01:00",
            device="Garage door",
            used_by=used[:1],
        ),
        _orphan(
            "sensor.weather_station_uv", "Weather station UV", "weather_station", "unknown", "2026-11-04T12:00:00+01:00"
        ),
    ]
    counts = {
        r: sum(e["reason"] == r for e in entities)
        for r in ("entry_removed", "integration_missing", "not_provided", "unavailable", "unknown")
    }
    devices = [
        {
            "device_id": "a1b2c3",
            "name": "Old hub",
            "manufacturer": "Acme",
            "model": "Hub H1",
            "entities": 2,
            "since": "2026-10-28T10:00:00+01:00",
            "used_by": [],
        },
    ]
    summary = {
        "total": len(entities),
        "counts": counts,
        "devices": len(devices),
        "removed": 12,
        "ignored": 3,
        "last_scan": "2026-11-10T08:45:00+01:00",
        "next_scan": None,
        "stale_hours": 24,
    }
    integrations = {"hue": "Philips Hue", "zha": "Zigbee Home Automation"}
    return summary, {
        **summary,
        "entities": entities,
        "devices": devices,
        "truncated": 0,
        "devices_truncated": 0,
        "integrations": integrations,
    }


def mock_security():
    """What system_hub/security answers: refusals from the Internet, an admin without 2FA, unused tokens."""
    now = datetime.fromisoformat(NOW).timestamp()
    return {
        "refused": [
            {
                "ip": "185.220.101.42",
                "host": None,
                "count": 5,
                "day": 5,
                "last": now - 7200,
                "url": "/auth/login_flow",
                "agent": None,
                "internet": True,
                "ignored": False,
            },
            {
                "ip": "45.155.205.7",
                "host": None,
                "count": 1,
                "day": 1,
                "last": now - 32400,
                "url": "/api/",
                "agent": None,
                "internet": True,
                "ignored": False,
            },
            {
                "ip": "192.168.1.37",
                "host": "tablette-salon.lan",
                "count": 1,
                "day": 0,
                "last": now - 43000,
                "url": "/api/websocket",
                "agent": None,
                "internet": False,
                "ignored": False,
            },
        ],
        "bans": [{"ip": "185.220.101.42", "at": now - 7100, "internet": True}],
        "exposure": {
            "external_url": "https://ha.example.org",
            "https": True,
            "internal_url": None,
            "ssl_certificate": False,
            "trusted_proxies": ["172.30.33.0/24"],
            "ip_ban": True,
            "login_threshold": 5,
            "cloud": False,
        },
        "users": [
            {
                "id": "1",
                "name": "Julien",
                "owner": True,
                "admin": True,
                "active": True,
                "local_only": False,
                "mfa": True,
                "sessions": 3,
                "last_used": now - 180,
            },
            {
                "id": "2",
                "name": "Marie",
                "owner": False,
                "admin": True,
                "active": True,
                "local_only": False,
                "mfa": False,
                "sessions": 2,
                "last_used": now - 172800,
            },
            {
                "id": "3",
                "name": "Living room tablet",
                "owner": False,
                "admin": False,
                "active": True,
                "local_only": True,
                "mfa": False,
                "sessions": 1,
                "last_used": now - 300,
            },
            {
                "id": "4",
                "name": "Guest",
                "owner": False,
                "admin": False,
                "active": False,
                "local_only": False,
                "mfa": False,
                "sessions": 0,
                "last_used": now - 10500000,
            },
        ],
        "tokens": [
            {
                "id": "a",
                "name": "Old backup script",
                "user": "Julien",
                "created": now - 63000000,
                "last_used": now - 18000000,
                "last_ip": "192.168.1.20",
                "unused": True,
            },
            {
                "id": "b",
                "name": "API test",
                "user": "Marie",
                "created": now - 36000000,
                "last_used": None,
                "last_ip": None,
                "unused": True,
            },
            {
                "id": "c",
                "name": "Node-RED",
                "user": "Julien",
                "created": now - 31000000,
                "last_used": now - 60,
                "last_ip": "172.30.33.4",
                "unused": False,
            },
            {
                "id": "d",
                "name": "Grafana",
                "user": "Julien",
                "created": now - 63000000,
                "last_used": now - 10800,
                "last_ip": "192.168.1.20",
                "unused": False,
            },
        ],
        "addons": [
            {
                "slug": "ssh",
                "name": "Advanced SSH & Web Terminal",
                "protected": False,
                "full_access": True,
                "host_network": True,
                "rating": 2,
            },
            {
                "slug": "frigate",
                "name": "Frigate",
                "protected": True,
                "full_access": True,
                "host_network": False,
                "rating": 4,
            },
            {
                "slug": "terminal",
                "name": "Terminal & SSH",
                "protected": False,
                "full_access": False,
                "host_network": True,
                "rating": 5,
                "allowed": True,
            },
            {
                "slug": "z2m",
                "name": "Zigbee2MQTT",
                "protected": True,
                "full_access": False,
                "host_network": True,
                "rating": 5,
            },
            *(
                {
                    "slug": f"a{i}",
                    "name": f"Add-on {i}",
                    "protected": True,
                    "full_access": False,
                    "host_network": False,
                    "rating": 6,
                }
                for i in range(11)
            ),
        ],
        "config": [
            {"file": "configuration.yaml", "line": 142, "key": "password"},
            {"file": "packages/weather.yaml", "line": 18, "key": "api_key"},
        ],
        "scanned_at": now - 900,
        "token_unused_days": 90,
    }


def mock_database():
    """What system_hub/database answers: a SQLite database near its limit, the devices that wrote the most."""

    def device(device_id, name, area, entities, total=None):
        rows = [
            {"entity_id": e, "name": n, "count": c, "excluded": e == "sensor.uptime_seconds"} for e, n, c in entities
        ]
        return {
            "device_id": device_id,
            "name": name,
            "area": area,
            "count": total or sum(r["count"] for r in rows),
            "excluded": sum(r["excluded"] for r in rows),
            "entity_ids": [r["entity_id"] for r in rows],
            "entities": rows,
        }

    top = [
        device(
            "linky",
            "Linky",
            "Garage",
            [
                ("sensor.linky_papp", "Linky Apparent power", 17280),
                ("sensor.linky_iinst", "Linky Current", 4320),
                ("sensor.linky_east", "Linky Energy", 1440),
            ],
        ),
        device(
            "shelly",
            "Shelly EM",
            "Garage",
            [
                ("sensor.shelly_em_power", "Shelly EM Power", 8640),
                ("sensor.shelly_em_voltage", "Shelly EM Voltage", 1440),
            ],
        ),
        device(
            "host",
            "System Monitor",
            None,
            [("sensor.processor_use", "Processor use", 2880), ("sensor.uptime_seconds", "Uptime", 2880)],
        ),
        device("salon", "Salon sensor", "Salon", [("sensor.salon_temperature", "Salon Temperature", 1420)]),
        device(
            None,
            "Zigbee2MQTT Bridge state",
            None,
            [("sensor.zigbee2mqtt_bridge_state", "Zigbee2MQTT Bridge state", 960)],
        ),
    ]
    for row in top:
        if row["device_id"] is None:
            row["name"] = row["entities"][0]["name"]
    return {
        "engine": "sqlite",
        "size": int(1.78 * 1024**3),
        "keep_days": 10,
        "auto_purge": True,
        "total_day": 41250,
        "counted_at": datetime.fromisoformat(NOW).timestamp() - 1500,
        "top": top,
    }


def mock_system_log():
    """Home Assistant's log: a custom integration timing out, the MQTT broker dropping, a slow weather update."""
    now = datetime.fromisoformat(NOW).timestamp()

    def entry(name, level, message, count, minutes, source, exception=None):
        return {
            "name": name,
            "message": [message],
            "level": level,
            "source": source,
            "timestamp": now - minutes * 60,
            "exception": exception or "",
            "count": count,
            "first_occurred": now - 20 * 3600,
        }

    return [
        entry(
            "custom_components.tapo_cameras.coordinator",
            "ERROR",
            "Error fetching Living room camera data: TimeoutError",
            21,
            3,
            ["custom_components/tapo_cameras/coordinator.py", 142],
            'Traceback (most recent call last):\n  File "/config/custom_components/tapo_cameras/coordinator.py", line 142, in _async_update_data\n    data = await self.api.get_status()\nTimeoutError',
        ),
        entry(
            "homeassistant.components.mqtt.client",
            "ERROR",
            "Disconnected from MQTT server core-mosquitto:1883 (7)",
            9,
            64,
            ["components/mqtt/client.py", 1093],
        ),
        entry(
            "homeassistant.components.hp",
            "ERROR",
            "Unable to reach 192.168.1.40: the printer is asleep",
            4,
            360,
            ["custom_components/hp/coordinator.py", 88],
        ),
        entry(
            "homeassistant.components.meteo_france.weather",
            "WARNING",
            "Update of weather.home is taking over 10 seconds",
            38,
            12,
            ["helpers/entity_platform.py", 1005],
        ),
    ]


def mock_zha():
    """A ZHA mesh as zha/devices gives it: the coordinator, five routers, their end devices; the cellar sensor silent."""
    routers = [
        ("r1", "Living room plug", 214, ["Living room motion", "Sofa lamp remote", "TV sensor"]),
        ("r2", "Kitchen bulb", 188, ["Fridge door", "Kitchen leak"]),
        ("r3", "Hallway relay", 152, ["Front door", "Hallway motion", "Coat closet"]),
        ("r4", "Garage plug", 74, ["Cellar sensor", "Garage door"]),
        ("r5", "Bedroom bulb", 201, ["Bedroom window", "Bedside button"]),
    ]
    devices = [
        {
            "ieee": "c",
            "device_type": "Coordinator",
            "name": "Coordinator",
            "available": True,
            "neighbors": [{"ieee": r, "lqi": lqi, "relationship": "Child"} for r, _, lqi, _ in routers],
        }
    ]
    for i, (rid, name, lqi, ends) in enumerate(routers):
        neighbors = [{"ieee": f"{rid}e{j}", "lqi": 190 - 37 * j, "relationship": "Child"} for j in range(len(ends))]
        nxt = routers[(i + 1) % len(routers)][0]
        neighbors.append({"ieee": nxt, "lqi": 96, "relationship": "Sibling"})
        devices.append(
            {"ieee": rid, "device_type": "Router", "name": name, "lqi": lqi, "available": True, "neighbors": neighbors}
        )
        for j, end in enumerate(ends):
            devices.append(
                {
                    "ieee": f"{rid}e{j}",
                    "device_type": "EndDevice",
                    "name": end,
                    "device_reg_id": "d1" if end == "Cellar sensor" else None,
                    "available": True,
                    "neighbors": [],
                }
            )
    return devices


def mock_matter():
    """Matter devices: a Thread network (two routers, sleepy sensors, one unavailable), Wi-Fi devices, a bridge.

    Returns the device registry entries and what matter/node_diagnostics answers for each node.
    """
    nodes = [
        ("m1", "Kitchen plug", "thread", "routing_end_device", True),
        ("m2", "Hallway light", "thread", "routing_end_device", True),
        ("m3", "Bedroom blinds", "thread", "sleepy_end_device", True),
        ("m4", "Window sensor", "thread", "sleepy_end_device", False),
        ("m5", "Bathroom humidity", "thread", "sleepy_end_device", True),
        ("m6", "Desk lamp", "wifi", "end_device", True),
        ("m7", "Air purifier", "wifi", "end_device", True),
        ("m8", "Hub bridge", "ethernet", "bridge", True),
    ]
    registry = [{"id": i, "name": name, "identifiers": [["matter", i]]} for i, name, *_ in nodes]
    registry += [
        {"id": f"m8b{j}", "name": name, "identifiers": [["matter", f"m8b{j}"]], "via_device_id": "m8"}
        for j, name in enumerate(["Garden spot", "Porch light"])
    ]
    diagnostics = {
        i: {
            "network_type": net,
            "network_name": "Home" if net == "thread" else None,
            "node_type": kind,
            "available": up,
        }
        for i, _, net, kind, up in nodes
    }
    return registry, diagnostics


def mock_silent():
    """The Silent devices module: a cellar sensor quiet for 3 days, a plug gone, two weak signals."""

    def device(device_id, name, area, integration, heard, **more):
        base = {"unavailable": False, "silent": False, "battery": False, "level": None, "signal": None}
        return {
            "device_id": device_id,
            "name": name,
            "area": area,
            "integration": integration,
            "last_heard": heard,
            **base,
            **more,
        }

    return {
        "tracked": 87,
        "ignored": 2,
        "integrations": ["esphome", "mqtt", "zha"],
        "battery_hours": 24,
        "mains_hours": 24,
        "devices": [
            device(
                "d1", "Cellar sensor", "Cellar", "zha", "2026-11-07T08:12:00+01:00", silent=True, battery=True, level=62
            ),
            device("d2", "Garage plug", "Garage", "mqtt", "2026-11-10T04:02:00+01:00", silent=True, unavailable=True),
            device(
                "d3",
                "Gate contact",
                "Outside",
                "mqtt",
                "2026-11-10T08:46:00+01:00",
                battery=True,
                level=78,
                signal={"kind": "lqi", "value": 31, "weak": True},
            ),
            device(
                "d4",
                "Garden shed sensor",
                "Garden",
                "esphome",
                "2026-11-10T08:58:00+01:00",
                signal={"kind": "rssi", "value": -84, "weak": True},
            ),
        ],
    }


def mock_backup_info():
    """Home Assistant's backups: one a night for 30 days but a missed night, the cloud copy failing for 5 days."""
    now = datetime.fromisoformat(NOW)
    backups = []
    for day in range(30):
        if day == 12:
            continue
        date = (now - timedelta(days=day)).replace(hour=4, minute=45)
        agents = {
            "backup.local": {"protected": True, "size": 1_331_000_000},
            "hassio.nas": {"protected": True, "size": 1_331_000_000},
        }
        if day >= 5:
            agents["cloud.cloud"] = {"protected": True, "size": 1_331_000_000}
        backups.append(
            {
                "backup_id": f"auto{day}",
                "name": f"Automatic backup {date:%Y.%-m.%-d}",
                "date": date.isoformat(),
                "with_automatic_settings": True,
                "failed_agent_ids": ["cloud.cloud"] if day < 5 else [],
                "agents": agents,
            }
        )
    backups.insert(
        1,
        {
            "backup_id": "manual1",
            "name": "Before Zigbee2MQTT 2.7.0",
            "date": (now - timedelta(hours=15)).isoformat(),
            "with_automatic_settings": False,
            "failed_agent_ids": [],
            "agents": {"backup.local": {"protected": True, "size": 325_000_000}},
        },
    )
    last = backups[0]["date"]
    return {
        "state": "idle",
        "agent_errors": {},
        "backups": backups,
        "last_attempted_automatic_backup": last,
        "last_completed_automatic_backup": last,
        "next_automatic_backup": (now + timedelta(days=1)).replace(hour=4, minute=45).isoformat(),
    }


def mock_state():
    """What system_hub/state answers: every module turned on, with neutral data."""
    system = [
        ("processor_use", "sensor.system_monitor_processor_use", "Processor use", "14", "%"),
        ("memory_use_percent", "sensor.system_monitor_memory_usage", "Memory usage", "47.6", "%"),
        ("swap_use_percent", "sensor.system_monitor_swap_usage", "Swap usage", "3.2", "%"),
        ("processor_temperature", "sensor.system_monitor_processor_temperature", "Processor temperature", "52.0", "°C"),
        ("load_1m", "sensor.system_monitor_load_1m", "Load (1 min)", "0.42", None),
        ("load_5m", "sensor.system_monitor_load_5m", "Load (5 min)", "0.37", None),
        ("load_15m", "sensor.system_monitor_load_15m", "Load (15 min)", "0.31", None),
        ("last_boot", "sensor.system_monitor_last_boot", "Last boot", "2026-11-02T06:12:00+00:00", None),
        ("throughput_network_in", "sensor.system_monitor_network_throughput_in_eth0", "Network in eth0", "1.8", "MB/s"),
        (
            "throughput_network_out",
            "sensor.system_monitor_network_throughput_out_eth0",
            "Network out eth0",
            "0.4",
            "MB/s",
        ),
        # A container bridge: left out of the network figures
        (
            "throughput_network_in",
            "sensor.system_monitor_network_throughput_in_docker0",
            "Network in docker0",
            "9.6",
            "MB/s",
        ),
        ("network_in", "sensor.system_monitor_network_in_eth0", "Network in eth0", "18734.2", "MiB"),
        ("network_out", "sensor.system_monitor_network_out_eth0", "Network out eth0", "4127.9", "MiB"),
        ("ipv4_address", "sensor.system_monitor_ipv4_address_eth0", "IPv4 address eth0", "192.168.1.20", None),
        ("swap_use", "sensor.system_monitor_swap_use", "Swap use", "131", "MiB"),
        ("swap_free", "sensor.system_monitor_swap_free", "Swap free", "3965", "MiB"),
        ("database_size", "sensor.home_assistant_v2_db_size", "home-assistant_v2.db Size", "612.4", "MB"),
        (
            "backup_last_successful_automatic_backup",
            "sensor.backup_last_successful_automatic_backup",
            "Backup Last successful automatic backup",
            "2026-11-10T04:45:00+00:00",
            None,
        ),
        (
            "backup_last_attempted_automatic_backup",
            "sensor.backup_last_attempted_automatic_backup",
            "Backup Last attempted automatic backup",
            "2026-11-10T04:45:00+00:00",
            None,
        ),
        (
            "backup_next_scheduled_automatic_backup",
            "sensor.backup_next_scheduled_automatic_backup",
            "Backup Next scheduled automatic backup",
            "2026-11-11T04:45:00+00:00",
            None,
        ),
        (
            "backup_backup_manager_state",
            "sensor.backup_backup_manager_state",
            "Backup Backup manager state",
            "idle",
            None,
        ),
        ("process", "binary_sensor.system_monitor_process_mosquitto", "System Monitor Process mosquitto", "on", None),
        (
            "process",
            "binary_sensor.system_monitor_process_zigbee2mqtt",
            "System Monitor Process zigbee2mqtt",
            "on",
            None,
        ),
        ("process", "binary_sensor.system_monitor_process_frigate", "System Monitor Process frigate", "off", None),
        # Stopped as allowed in the System settings: grey, no alert
        ("process", "binary_sensor.system_monitor_process_rsync", "System Monitor Process rsync", "off", None),
        ("disk_use_percent", "sensor.system_monitor_disk_usage", "Disk usage /", "38.4", "%"),
        ("disk_use_percent", "sensor.system_monitor_disk_usage_media", "Disk usage /media", "82.7", "%"),
        ("disk_use_percent", "sensor.system_monitor_disk_usage_backup", "Disk usage /backup", "93.1", "%"),
    ]
    containers = []
    for slug, name, kind, state, version, latest, cpu, mem, mem_pct, boot, image in CONTAINERS:
        running = state == "started"
        expected = kind != "addon" or boot == "auto"
        containers.append(
            {
                "slug": slug,
                "name": name,
                "kind": kind,
                "state": state,
                "version": version,
                "version_latest": latest,
                "update_available": version != latest,
                "boot": boot,
                "container": slug if kind == "core" else f"hassio_{slug}" if kind != "addon" else f"app_{slug}",
                "image": f"{image}:{version}",
                "cpu_percent": cpu,
                "memory_usage": mem * 1024 * 1024 if mem else None,
                "memory_limit": 4 * 1024**3,
                "memory_percent": mem_pct,
                "since": "2026-11-10T08:41:00+01:00" if not running else "2026-11-02T06:13:00+01:00",
                "expected": expected,
                "down": expected and not running,
            }
        )
    history = {
        "homeassistant": _history(6, [0, 2, 5, 1, -2, 3, 8, 2]),
        "supervisor": _history(1, [0, 1, 0, 2, 0, 1]),
        "core_mosquitto": _history(1, [0, 0, 1, 0]),
        "a0d7b954_zigbee2mqtt": _history(2, [0, 1, 3, 1, 0, 2]),
    }
    return {
        "loaded": True,
        "entry_id": "system_hub",
        "modules": [
            "containers",
            "database",
            "security",
            "logs",
            "watchdog",
            "marketplace",
            "backups",
            "silent",
            "batteries",
            "git_sync",
            "orphans",
        ],
        "tabs": [
            "status",
            "system",
            "containers",
            "database",
            "security",
            "logs",
            "watchdog",
            "marketplace",
            "backups",
            "silent",
            "batteries",
            "git_sync",
            "orphans",
        ],
        "backups": {"max_age": 3},
        "database": {"max_size": 2},
        "security": {"notify": True, "notify_services": [], "token_unused_days": 90, "ignored_ips": []},
        # The Security tab: what system_hub/security answers
        "security_info": mock_security(),
        # The Database tab: what system_hub/database answers
        "database_info": mock_database(),
        "logs": {
            "error_threshold": 10,
            "ignored_messages": ["homeassistant.components.recorder.core|Setup of platform"],
        },
        # The Logs tab: what system_log/list answers
        "system_log": mock_system_log(),
        # The Silent devices tab: two silent devices, two weak signals
        "silent": mock_silent(),
        # Its Zigbee network: a ZHA device in the registry offers the view, zha/devices gives the mesh;
        # and its Matter network: the Matter devices in the registry, what matter/node_diagnostics answers
        "device_registry": [{"id": "d1", "identifiers": [["zha", "r4e0"]]}, *mock_matter()[0]],
        "matter_diagnostics": mock_matter()[1],
        "zha_devices": mock_zha(),
        # The Orphans tab: the counts with the state, the whole list from its own command
        **dict(zip(("orphans", "orphans_list"), mock_orphans(), strict=True)),
        "git_sync_configured": True,
        # The Backups tab: what Home Assistant's backup/info and backup/agents/info answer
        "backup_info": mock_backup_info(),
        "backup_agents": {
            "agents": [
                {"agent_id": "backup.local", "name": "Local"},
                {"agent_id": "hassio.nas", "name": "NAS"},
                {"agent_id": "cloud.cloud", "name": "Home Assistant Cloud"},
            ]
        },
        # The Updates tab: Home Assistant, an add-on and a device before the Marketplace
        "system_updates": {
            "available": [
                {
                    "entity_id": "update.home_assistant_core_update",
                    "kind": "core",
                    "title": "Home Assistant Core",
                    "installed": "2026.10.4",
                    "latest": "2026.11.1",
                    "release_url": "https://www.home-assistant.io/latest-release-notes/",
                    "release_summary": "The Marketplace, faster dashboards and new integrations.",
                    "picture": None,
                    "installing": False,
                    "backup": True,
                },
                {
                    "entity_id": "update.mosquitto_broker_update",
                    "kind": "addon",
                    "title": "Mosquitto broker",
                    "installed": "6.5.1",
                    "latest": "6.5.2",
                    "release_url": None,
                    "release_summary": "Updates the broker to Mosquitto 2.0.22.",
                    "picture": None,
                    "installing": False,
                    "backup": True,
                },
                {
                    "entity_id": "update.garage_plug_firmware",
                    "kind": "device",
                    "title": "Garage plug",
                    "installed": "1.0.21",
                    "latest": "1.0.24",
                    "release_url": None,
                    "release_summary": None,
                    "picture": None,
                    "installing": False,
                    "backup": False,
                },
            ],
            "up_to_date": {"system": 1, "addon": 10, "device": 23},
        },
        "updates": [
            {
                "key": "core",
                "entity_id": "update.home_assistant_core_update",
                "state": "on",
                "installed": "2026.10.4",
                "latest": "2026.11.1",
            },
            {
                "key": "os",
                "entity_id": "update.home_assistant_operating_system_update",
                "state": "off",
                "installed": "16.3",
                "latest": "16.3",
            },
        ],
        "thresholds": {"cpu": [70, 90], "ram": [70, 90], "disk": [80, 90], "temperature": [70, 85], "swap": [50, 80]},
        "system": [
            {"key": key, "entity_id": entity, "name": name, "state": state, "unit": unit}
            | ({"stoppable": True} if entity == "binary_sensor.system_monitor_process_rsync" else {})
            for key, entity, name, state, unit in system
        ],
        "containers": {
            "last_update": "2026-11-10T08:59:30+01:00",
            "error": None,
            "containers": containers,
            "history": history,
        },
        "watchdog": {
            "running": False,
            "paused": False,
            "last_check": "2026-11-10T08:55:00+01:00",
            "reloads": 4,
            "max_reloads": 5,
            "unavailable": [
                {
                    "domain": "tuya",
                    "title": "Living room plugs",
                    "entry_id": "e1",
                    "since": "2026-11-10T08:30:00+01:00",
                    "reloads": 2,
                    "gave_up": False,
                },
                {
                    "domain": "ipp",
                    "title": "Office printer",
                    "entry_id": "e2",
                    "since": "2026-11-09T18:05:00+01:00",
                    "reloads": 5,
                    "gave_up": True,
                },
            ],
            "power_cycles": [
                {
                    "device_id": "d1",
                    "device_name": "Internet box",
                    "area": "Office",
                    "switch": "switch.router_plug",
                    "switch_name": "Router plug",
                    "switch_state": "on",
                    "delay": 10,
                    "off_time": 15,
                    "unavailable": False,
                    "count": 0,
                    "gave_up": False,
                },
                {
                    "device_id": "d2",
                    "device_name": "Zigbee hub",
                    "area": "Hallway",
                    "switch": "switch.hub_plug",
                    "switch_name": "Hub plug",
                    "switch_state": "on",
                    "delay": 20,
                    "off_time": 10,
                    "unavailable": True,
                    "count": 1,
                    "gave_up": False,
                },
                {
                    "device_id": "d3",
                    "device_name": "Garden camera",
                    "area": "Garden",
                    "switch": "switch.garden_plug",
                    "switch_name": "Garden plug",
                    "switch_state": "off",
                    "delay": 30,
                    "off_time": 30,
                    "unavailable": True,
                    "count": 0,
                    "gave_up": False,
                },
            ],
            "history": [
                {"kind": "reloaded", "at": "2026-11-10T08:50:00+01:00", "domain": "tuya", "title": "Living room plugs"},
                {"kind": "gave_up", "at": "2026-11-09T19:30:00+01:00", "domain": "ipp", "title": "Office printer"},
                {"kind": "power_cycled", "at": "2026-11-09T07:12:00+01:00", "domain": "zha", "title": "Garage hub"},
                {"kind": "reloaded", "at": "2026-11-08T22:04:00+01:00", "domain": "met", "title": "Weather"},
            ],
        },
        "marketplace": {
            "state": "idle",
            "done": 42,
            "total": 42,
            "updates": 4,
            "pending": ["Mushroom", "Bubble Card", "Auto-entities", "Weather Plus Card"],
            "list": [
                {
                    "entity_id": "update.auto_entities_update",
                    "title": "auto-entities",
                    "installed": "v1.13.0",
                    "latest": "v1.14.1",
                    "release_url": "https://github.com/thomasloven/lovelace-auto-entities/releases",
                    "release_summary": "Sorting by attribute, a fix for nested cards and faster updates.",
                    "picture": None,
                    "installing": False,
                },
                {
                    "entity_id": "update.bubble_card_update",
                    "title": "Bubble Card",
                    "installed": "v3.0.4",
                    "latest": "v3.0.5",
                    "release_url": "https://github.com/Clooos/Bubble-Card/releases",
                    "release_summary": "Fixes the pop-up hash on iOS and the slider in the dark theme.",
                    "picture": None,
                    "installing": False,
                },
                {
                    "entity_id": "update.mushroom_update",
                    "title": "Mushroom",
                    "installed": "v4.4.0",
                    "latest": "v5.0.0",
                    "release_url": "https://github.com/piitaya/lovelace-mushroom/releases",
                    "release_summary": "Breaking: a new card editor; some YAML options are renamed.",
                    "picture": None,
                    "installing": False,
                },
                {
                    "entity_id": "update.weather_plus_card_update",
                    "title": "Weather Plus Card",
                    "installed": "v2.4.0",
                    "latest": "v2.4.1",
                    "release_url": "https://github.com/juju35/ha-weather-card/releases/tag/v2.4.1",
                    "release_summary": "Smoother rain at night and a fix for the pollen levels.",
                    "picture": None,
                    "installing": False,
                },
            ],
            "failed": ["someone/abandoned-card"],
            "github_connected": True,
            "rate_limit_remaining": 4812,
            "error": None,
            "installing": [],
            "installing_updates": False,
            "last_check": "2026-11-10T06:00:00+01:00",
            "next_due": "2026-11-10T12:00:00+01:00",
            "scan_interval": 6,
        },
        "batteries": {
            "threshold": 20,
            "low": 2,
            "unavailable": 1,
            "last_notification": "2026-11-09T19:00:00+01:00",
            "spares": {
                "CR2032": {"stock": 0, "needed": 1, "short": 1},
                "AAA": {"stock": 6, "needed": 2, "short": 0},
            },
            "batteries": [
                {
                    "entity_id": f"sensor.battery_{i}",
                    "name": name,
                    "area": area,
                    "level": level,
                    "icon": f"mdi:{icon}",
                    "low": low,
                    "alert": low or unavailable,
                    "unavailable": unavailable,
                    "battery_type": kind,
                    "drain_per_day": drain,
                    "days_left": int((level - 20) / drain) if drain and level else None,
                    "replace_by": replace_by,
                }
                for i, (name, area, level, icon, low, unavailable, kind, drain, replace_by) in enumerate(
                    [
                        ("Front door", "Entrance", 8, "battery-10", True, False, "CR2032", None, None),
                        ("Kitchen leak sensor", "Kitchen", 17, "battery-20", True, False, "CR2450", None, None),
                        (
                            "Smoke detector",
                            "Hallway",
                            None,
                            "battery-alert-variant-outline",
                            False,
                            True,
                            "9V",
                            None,
                            None,
                        ),
                        (
                            "Kitchen remote",
                            "Kitchen",
                            31,
                            "battery-30",
                            False,
                            False,
                            "2× AAA",
                            0.45,
                            "2026-12-04T00:00:00+01:00",
                        ),
                        (
                            "Thermostat",
                            "Living room",
                            54,
                            "battery-50",
                            False,
                            False,
                            "2× AA",
                            0.6,
                            "2027-01-05T00:00:00+01:00",
                        ),
                        (
                            "Window sensor",
                            "Bedroom",
                            71,
                            "battery-70",
                            False,
                            False,
                            "CR2032",
                            0.3,
                            "2027-04-28T00:00:00+01:00",
                        ),
                        ("Motion sensor", "Garage", 93, "battery-90", False, False, "CR123A", None, None),
                    ]
                )
            ],
        },
        "git_sync_diff": {
            "additions": 9,
            "deletions": 2,
            "more_files": 0,
            "files": [
                {
                    "path": "automations.yaml",
                    "status": "modified",
                    "old_path": None,
                    "binary": False,
                    "additions": 7,
                    "deletions": 2,
                    "truncated": 0,
                    "hunks": [
                        {
                            "header": "@@ -12,9 +12,14 @@",
                            "lines": [
                                {"kind": "context", "old": 12, "new": 12, "text": "- id: garage_lights"},
                                {"kind": "context", "old": 13, "new": 13, "text": "  alias: Garage lights"},
                                {"kind": "del", "old": 14, "new": None, "text": "  triggers:"},
                                {"kind": "del", "old": 15, "new": None, "text": "    - trigger: state"},
                                {"kind": "add", "old": None, "new": 14, "text": "  triggers:"},
                                {"kind": "add", "old": None, "new": 15, "text": "    - trigger: state"},
                                {
                                    "kind": "add",
                                    "old": None,
                                    "new": 16,
                                    "text": "      entity_id: binary_sensor.garage_door",
                                },
                                {"kind": "add", "old": None, "new": 17, "text": '      to: "on"'},
                                {"kind": "context", "old": 16, "new": 18, "text": "  actions:"},
                                {"kind": "add", "old": None, "new": 19, "text": "    - action: light.turn_on"},
                                {"kind": "add", "old": None, "new": 20, "text": "      target: { area_id: garage }"},
                                {"kind": "add", "old": None, "new": 21, "text": "      data: { brightness_pct: 80 }"},
                                {"kind": "context", "old": 17, "new": 22, "text": "  mode: single"},
                            ],
                        }
                    ],
                },
                {
                    "path": "dashboards/home.yaml",
                    "status": "added",
                    "old_path": None,
                    "binary": False,
                    "additions": 2,
                    "deletions": 0,
                    "truncated": 0,
                    "hunks": [],
                },
                {
                    "path": "scripts.yaml",
                    "status": "mode",
                    "old_path": None,
                    "binary": False,
                    "additions": 0,
                    "deletions": 0,
                    "truncated": 0,
                    "hunks": [],
                },
            ],
        },
        "git_sync": {
            "available": True,
            "status": "dirty",
            "branch": "main",
            "ahead": 1,
            "behind": 0,
            "files": ["automations.yaml", "dashboards/home.yaml", "scripts.yaml"],
            "changed": 3,
            "remote_url": "git@github.com:example/home-assistant-config.git",
            "last_error": None,
            "last_commit": {"message": "Add the garage lights automation", "sha": "4f2c9a1", "timestamp": 1794293400},
            "last_push": "2026-11-09T21:30:00+01:00",
            "last_export": "2026-11-09T21:29:00+01:00",
            "ai_task": True,
        },
    }


# Mounts the panel as Home Assistant does: its strings come from loadBackendTranslation, its data from callWS.
MOUNT = """([state, strings, tab, narrow, view, forms]) => {
    const localize = (key, vars) => {
        let text = strings[key];
        if (text === undefined) return "";
        for (const [k, v] of Object.entries(vars || {})) text = text.replaceAll(`{${k}}`, String(v));
        return text;
    };
    // Recorded values of the System Monitor sensors: a gentle wave around their value now, the same at every run.
    const seeded = (id) => {
        let seed = [...id].reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 2147483647, 7);
        return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    };
    const wave = (id, from, step, count) => {
        const sensor = state.system.find((s) => s.entity_id === id);
        const base = Number(sensor?.state) || 0;
        const amp = /processor_use|throughput/.test(id) ? 0.6 : /temperature/.test(id) ? 0.12 : /disk/.test(id) ? 0.01 : 0.06;
        const rnd = seeded(id);
        let v = base;
        return Array.from({ length: count }, (_, i) => {
            v += (rnd() - 0.5) * base * amp;
            v = Math.max(0, v * 0.9 + base * 0.1 + (i % 37 === 20 ? base * amp * 2 : 0));
            return [from + i * step, Math.round(v * 100) / 100];
        });
    };
    const history = (msg) => {
        const from = Date.parse(msg.start_time);
        const count = Math.round((Date.now() - from) / 300000);
        return Object.fromEntries(msg.entity_ids.map((id) => [id, wave(id, from, 300000, count).map(([t, v]) => ({ s: String(v), lu: t / 1000 }))]));
    };
    const statistics = (msg) => {
        const from = Date.parse(msg.start_time);
        return Object.fromEntries(msg.statistic_ids.map((id) => [id, wave(id, from, 3600000, 168).map(([t, v]) => ({ start: t, mean: v }))]));
    };
    const el = document.createElement("system-hub-panel");
    el.panel = { url_path: "system-hub", config: {} };
    el.narrow = narrow;
    el.route = { path: `/${tab}` };
    el.hass = {
        language: "en",
        locale: { language: "en" },
        user: { is_admin: true },
        // ZHA loaded: the Silent devices tab's Zigbee view reads its mesh from zha/devices
        config: { components: ["zha", "matter"] },
        localize,
        loadBackendTranslation: async () => localize,
        areas: {
            entrance: { name: "Entrance", icon: "mdi:door" },
            kitchen: { name: "Kitchen", icon: "mdi:fridge-outline" },
            hallway: { name: "Hallway", icon: "mdi:coat-rack" },
            living_room: { name: "Living room", icon: "mdi:sofa-outline" },
            bedroom: { name: "Bedroom", icon: "mdi:bed-outline" },
            garage: { name: "Garage", icon: "mdi:garage" },
        },
        callService: async () => {},
        // The options flow the Settings tab drives: its menu, then the form of the step asked for
        callApi: async (method, path, body) => (method === "DELETE" ? {} : body?.next_step_id ? forms[body.next_step_id] : {}),
        callWS: async (msg) =>
            msg.type === "system_hub/options_flow"
                ? { type: "menu", flow_id: "screenshots", menu_options: ["modules", ...Object.keys(forms)] }
                : msg.type === "system_hub/state"
                ? state
                : msg.type === "system_hub/orphans"
                  ? state.orphans_list
                  : msg.type === "system_hub/security"
                  ? state.security_info
                  : msg.type === "system_hub/database"
                  ? state.database_info
                  : msg.type === "system_log/list"
                  ? state.system_log
                  : msg.type === "config/device_registry/list"
                  ? state.device_registry
                  : msg.type === "zha/devices"
                  ? state.zha_devices
                  : msg.type === "matter/node_diagnostics"
                  ? state.matter_diagnostics[msg.device_id]
                  : msg.type === "backup/info"
                  ? state.backup_info
                  : msg.type === "backup/agents/info"
                  ? state.backup_agents
                  : msg.service === "git_sync_get_diff"
                  ? { response: state.git_sync_diff }
                  : msg.type === "history/history_during_period"
                    ? history(msg)
                    : msg.type === "recorder/statistics_during_period"
                      ? statistics(msg)
                      : {},
    };
    if (view && tab === "silent") el._slView = view;
    else if (view) el._battView = view;
    document.getElementById("root").appendChild(el);
}"""

# The settings forms, as the options flow sends them (kept up to date by tests/test_screenshot_forms.py)
FORMS = json.loads((ROOT / "scripts/screenshot-forms.json").read_text(encoding="utf-8"))

# Settings tab: a module's settings opened in place on one of its steps; the box of its row and its form.
OPEN_FORM = """async ([module, step]) => {
    const panel = document.querySelector("system-hub-panel");
    await panel._cfgOpen(module, step);
    await new Promise((r) => setTimeout(r, 300));
    const row = panel.shadowRoot.querySelector(`[data-row-tab="${module}"]`);
    const top = row.getBoundingClientRect();
    const bottom = row.nextElementSibling.getBoundingClientRect();
    const card = row.closest("ha-card").getBoundingClientRect();
    return { x: card.x, y: top.y + scrollY, width: card.width, height: bottom.bottom - top.y + 8 };
}"""

# Orphans tab: two entities ticked, then Remove asks first (one of them is still used).
ORPHANS_CONFIRM = """async () => {
    const root = document.querySelector("system-hub-panel").shadowRoot;
    for (const id of ["light.porch", "sensor.porch_light_power"]) root.querySelector(`[data-orph-sel="${id}"]`).click();
    root.querySelector('[data-action="orph_confirm"][data-act="remove"]').click();
}"""

# A status card on its own, next to the panel (hidden): the panel's hass, as a dashboard gives it.
CARD_MOUNT = """async (type) => {
    const panel = document.querySelector("system-hub-panel");
    const hass = { ...panel._hass, panels: { "system-hub": { config: { _panel_custom: { module_url: "" } } } } };
    panel.style.display = "none";
    const card = document.createElement(type);
    card.id = "card";
    card.style.cssText = "display:block;width:" + (type.includes("mini") ? 420 : 520) + "px;padding:16px";
    card.setConfig({ type: "custom:" + type });
    document.querySelector("#root").appendChild(card);
    card.hass = hass;
    await card._read();
}"""

# Unfolds the first device of the Database tab.
OPEN_DEVICE = (
    """() => document.querySelector("system-hub-panel").shadowRoot.querySelector('[data-action="db_open"]')?.click()"""
)

# Opens the diff viewer from the Git Sync tab.
OPEN_DIFF = """() => document.querySelector("system-hub-panel").shadowRoot.querySelector('[data-action="git_sync_diff"]').click()"""

TABS = [
    "status",
    "system",
    "containers",
    "database",
    "security",
    "logs",
    "watchdog",
    "marketplace",
    "backups",
    "silent",
    "batteries",
    "git_sync",
    "orphans",
    "settings",
]
SHOTS = [
    *(
        {"file": f"panel-{tab.replace('_', '-')}{suffix}", "theme": theme, "tab": tab}
        for tab in TABS
        for theme, suffix in (("light", ""), ("dark", "-dark"))
        if tab != "status"
    ),
    *(
        {"file": f"panel-batteries-{view}{suffix}", "theme": theme, "tab": "batteries", "view": view}
        for view in ("room", "type", "forecast")
        for theme, suffix in (("light", ""), ("dark", "-dark"))
    ),
    # The Silent devices tab on its Zigbee and Matter networks: the map beside the tree
    {"file": "panel-silent-zigbee", "theme": "light", "tab": "silent", "view": "zigbee"},
    {"file": "panel-silent-zigbee-dark", "theme": "dark", "tab": "silent", "view": "zigbee"},
    {"file": "panel-silent-matter", "theme": "light", "tab": "silent", "view": "matter"},
    {"file": "panel-silent-matter-dark", "theme": "dark", "tab": "silent", "view": "matter"},
    {"file": "panel-marketplace-checking", "theme": "light", "tab": "marketplace", "checking": True},
    {"file": "panel-marketplace-checking-dark", "theme": "dark", "tab": "marketplace", "checking": True},
    {"file": "panel-git-sync-diff", "theme": "light", "tab": "git_sync", "diff": True},
    {"file": "panel-git-sync-diff-dark", "theme": "dark", "tab": "git_sync", "diff": True},
    # The Status tab with every area, Automation Monitor's included
    {"file": "panel-status", "theme": "light", "tab": "status", "automations": True},
    {"file": "panel-status-dark", "theme": "dark", "tab": "status", "automations": True},
    {"file": "panel-automations", "theme": "light", "tab": "automations", "automations": True},
    {"file": "panel-automations-dark", "theme": "dark", "tab": "automations", "automations": True},
    {"file": "panel-orphans-confirm", "theme": "light", "tab": "orphans", "orphans_confirm": True},
    {"file": "panel-orphans-confirm-dark", "theme": "dark", "tab": "orphans", "orphans_confirm": True},
    # Each module's settings, opened in place in the Settings tab: config-<step>
    *(
        {
            "file": f"config-{step.replace('_', '-').replace('add-power-cycle', 'power-cycle')}{suffix}",
            "theme": theme,
            "tab": "settings",
            "form": (module, step),
        }
        for module, step in (
            ("system", "system"),
            ("containers", "containers"),
            ("database", "database"),
            ("security", "security"),
            ("logs", "logs"),
            ("watchdog", "watchdog"),
            ("watchdog", "watchdog_add_power_cycle"),
            ("marketplace", "marketplace"),
            ("backups", "backups"),
            ("silent", "silent"),
            ("batteries", "batteries"),
            ("batteries", "batteries_types"),
            ("batteries", "batteries_import"),
            ("git_sync", "git_sync_repository"),
            ("git_sync", "git_sync"),
            ("automations", "automations"),
            ("orphans", "orphans"),
        )
        for theme, suffix in (("light", ""), ("dark", "-dark"))
    ),
    # The status cards (system-hub-card, system-hub-mini-card), reading the panel as on a dashboard
    *(
        {
            "file": f"card-status{mini}{suffix}",
            "theme": theme,
            "tab": "status",
            "card": f"system-hub{mini}-card",
            "automations": True,
        }
        for mini in ("", "-mini")
        for theme, suffix in (("light", ""), ("dark", "-dark"))
    ),
    {"file": "panel-phone", "theme": "light", "tab": "system", "phone": True},
    {"file": "panel-phone-dark", "theme": "dark", "tab": "system", "phone": True},
]


def automations_state(state):
    """The Automations module turned on, with what Automation Monitor reports (only in its own screenshots)."""
    edit = "/config/automation/edit/"
    trace = "/config/automation/trace/"
    failures = [
        {
            "entity_id": "automation.garage_door_closes_at_night",
            "name": "Garage door closes at night",
            "last_error_time": "2026-11-10T08:42:00+01:00",
            "error_message": "Entity cover.garage_door is unavailable",
            "error_step": "action/1",
            "consecutive_failures": 3,
            "trace": f"{trace}garage_night",
            "edit": f"{edit}garage_night",
        },
        {
            "entity_id": "automation.morning_heating",
            "name": "Morning heating",
            "last_error_time": "2026-11-10T06:30:00+01:00",
            "error_message": "Template error: float got invalid input 'unknown' when rendering '{{ states.sensor.outdoor | float }}'",
            "error_step": "condition/0",
            "consecutive_failures": 1,
            "trace": f"{trace}morning_heating",
            "edit": f"{edit}morning_heating",
        },
        {
            "entity_id": "automation.notify_washing_machine_done",
            "name": "Notify when the washing machine is done",
            "last_error_time": "2026-11-09T19:12:00+01:00",
            "error_message": "Action notify.mobile_app_phone not found",
            "error_step": "action/0",
            "consecutive_failures": 2,
            "trace": f"{trace}washing_done",
            "edit": f"{edit}washing_done",
        },
    ]
    linked = [
        {
            "entity_id": "cover.garage_door",
            "name": "Garage door",
            "unavailable_since": "2026-11-10T02:15:00+01:00",
            "used_by": [
                {
                    "entity_id": "automation.garage_door_closes_at_night",
                    "name": "Garage door closes at night",
                    "edit": f"{edit}garage_night",
                },
                {"entity_id": "script.leave_home", "name": "Leave home", "edit": "/config/script/edit/leave_home"},
            ],
        },
        {
            "entity_id": "sensor.outdoor",
            "name": "Outdoor temperature",
            "unavailable_since": "2026-11-09T23:50:00+01:00",
            "used_by": [
                {"entity_id": "automation.morning_heating", "name": "Morning heating", "edit": f"{edit}morning_heating"}
            ],
        },
    ]
    automations = {
        "available": True,
        "loaded": True,
        "failed_entity": "sensor.failed_automations",
        "linked_entity": "sensor.linked_entities_unavailable",
        "failed_na": False,
        "linked_na": False,
        "failures": failures,
        "linked": linked,
        "automations": 48,
    }
    return {
        **state,
        "modules": [*state["modules"], "automations"],
        "tabs": [*state["tabs"], "automations"],
        "automations": automations,
    }


def checking_state(state):
    """The Marketplace check running: 17 of 42 repositories checked in 40 seconds, one failed."""
    running = {**state["marketplace"], "state": "running", "done": 17, "total": 42, "failed": ["Weather Radar Card"]}
    running["started_at"] = "2026-11-10T08:59:20+01:00"
    return {**state, "marketplace": running}


def open_page(browser, name, viewport, html):
    """A new page at the frozen clock, Paris time, with `html` in it; page errors are printed."""
    page = browser.new_page(
        device_scale_factor=2,
        viewport={"width": viewport[0], "height": viewport[1]},
        timezone_id="Europe/Paris",
        locale="en-US",
    )
    page.on("pageerror", lambda err: print(f"{name}: page error: {err}"))
    page.clock.set_fixed_time(NOW)
    page.set_content(html)
    return page


def page_html(theme, width, padding=0):
    variables = "".join(f"{k}:{v};" for k, v in {**THEMES[theme], **COMMON}.items())
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>
:root {{ {variables} }}
body {{ margin: 0; padding: {padding}px; background: var(--primary-background-color); color: var(--primary-text-color);
       font-family: Roboto, "Segoe UI", Helvetica, Arial, sans-serif; width: {width}px; }}
</style></head><body><div id="root"></div></body></html>"""


def pixels(path):
    """The decoded RGBA pixels of an image, with its size, or None when unreadable."""
    try:
        size = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-select_streams",
                "v:0",
                "-show_entries",
                "stream=width,height",
                "-of",
                "csv=p=0",
                str(path),
            ],
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()
        raw = subprocess.run(
            ["ffmpeg", "-v", "error", "-i", str(path), "-f", "rawvideo", "-pix_fmt", "rgba", "-"],
            check=True,
            capture_output=True,
        ).stdout
    except (OSError, subprocess.CalledProcessError):
        return None
    return size, raw


def capture(page, path, **kwargs):
    """Screenshot to a temporary file next to `path`, kept only if its pixels differ from the file already there."""
    tmp = path.with_name(f".new-{path.name}")
    page.screenshot(path=str(tmp), **kwargs)
    if path.exists() and (old := pixels(path)) is not None and old == pixels(tmp):
        tmp.unlink()
        print(path.relative_to(ROOT), "(unchanged)")
        return
    shutil.move(str(tmp), path)
    print(path.relative_to(ROOT))


def main():
    out = ROOT / "screenshots"
    out.mkdir(exist_ok=True)
    state = mock_state()
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get("CHROMIUM_PATH") or None)
        for shot in SHOTS:
            width, height = PHONE if shot.get("phone") else (WIDTH, 900)
            page = open_page(browser, shot["file"], (width, height), page_html(shot["theme"], width))
            page.add_script_tag(content=HA_ELEMENTS)
            page.add_script_tag(content=PANEL_JS)
            shown = checking_state(state) if shot.get("checking") else state
            shown = automations_state(shown) if shot.get("automations") else shown
            page.evaluate(MOUNT, [shown, STRINGS, shot["tab"], bool(shot.get("phone")), shot.get("view"), FORMS])
            page.wait_for_timeout(400)
            if shot.get("card"):
                page.add_script_tag(content=ICONS_JS)
                page.add_script_tag(content=CARD_JS)
                page.evaluate(CARD_MOUNT, shot["card"])
                page.wait_for_timeout(400)
                capture(
                    page, out / f"{shot['file']}.png", clip=page.locator("#card").bounding_box(), animations="disabled"
                )
                page.close()
                continue
            if shot.get("form"):
                clip = page.evaluate(OPEN_FORM, list(shot["form"]))
                capture(page, out / f"{shot['file']}.png", clip=clip, full_page=True, animations="disabled")
                page.close()
                continue
            if shot["tab"] == "database":
                # The first device unfolded, its entities that wrote the most under it
                page.evaluate(OPEN_DEVICE)
                page.wait_for_timeout(200)
            if shot.get("orphans_confirm"):
                page.evaluate(ORPHANS_CONFIRM)
                page.wait_for_timeout(200)
            if shot.get("diff"):
                # The viewer covers the window: the capture is the window.
                page.set_viewport_size({"width": width, "height": 760})
                page.evaluate(OPEN_DIFF)
                page.wait_for_timeout(400)
                capture(page, out / f"{shot['file']}.png", animations="disabled")
                page.close()
                continue
            box = page.locator("#root").bounding_box()
            clip = {"x": 0, "y": 0, "width": width, "height": max(int(box["height"] + 0.999) + 16, 200)}
            capture(page, out / f"{shot['file']}.png", clip=clip, full_page=True, animations="disabled")
            page.close()
        browser.close()


if __name__ == "__main__":
    main()
