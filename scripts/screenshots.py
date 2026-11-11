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
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
COMPONENT = ROOT / "custom_components/system_hub"
PANEL_JS = (COMPONENT / "frontend/system-hub-panel.js").read_text(encoding="utf-8")
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

# Minimal stand-ins for Home Assistant's <ha-card>, <ha-icon>, <ha-switch> and <ha-menu-button>.
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
    const path = ICONS[(this.getAttribute("icon") || "").replace("mdi:", "")] || "";
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
    # slug, name, kind, state, version, latest, cpu %, memory MiB, memory %, boot
    ("homeassistant", "Home Assistant Core", "core", "started", "2026.11.1", "2026.11.1", 6.4, 1180, 29.5, None),
    ("supervisor", "Supervisor", "supervisor", "started", "2026.11.0", "2026.11.0", 0.8, 210, 5.2, None),
    ("core_mosquitto", "Mosquitto broker", "addon", "started", "6.5.1", "6.5.1", 0.3, 18, 0.4, "auto"),
    ("a0d7b954_zigbee2mqtt", "Zigbee2MQTT", "addon", "started", "2.6.2", "2.7.0", 2.1, 164, 4.1, "auto"),
    ("core_matter_server", "Matter Server", "addon", "error", "8.1.0", "8.1.0", None, None, None, "auto"),
    ("a0d7b954_vscode", "Studio Code Server", "addon", "stopped", "5.20.0", "5.20.0", None, None, None, "manual"),
]


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
        ("disk_use_percent", "sensor.system_monitor_disk_usage", "Disk usage /", "38.4", "%"),
        ("disk_use_percent", "sensor.system_monitor_disk_usage_media", "Disk usage /media", "82.7", "%"),
        ("disk_use_percent", "sensor.system_monitor_disk_usage_backup", "Disk usage /backup", "93.1", "%"),
    ]
    containers = []
    for slug, name, kind, state, version, latest, cpu, mem, mem_pct, boot in CONTAINERS:
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
        "modules": ["containers", "watchdog", "marketplace", "batteries", "git_sync"],
        "tabs": ["system", "containers", "watchdog", "marketplace", "batteries", "git_sync"],
        "git_sync_configured": True,
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
            "updates": 3,
            "pending": ["Mushroom", "Bubble Card", "Auto-entities"],
            "failed": [],
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
MOUNT = """([state, strings, tab, narrow, view]) => {
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
    el.route = { path: tab === "system" ? "" : `/${tab}` };
    el.hass = {
        language: "en",
        locale: { language: "en" },
        user: { is_admin: true },
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
        callWS: async (msg) =>
            msg.type === "system_hub/state"
                ? state
                : msg.service === "git_sync_get_diff"
                  ? { response: state.git_sync_diff }
                  : msg.type === "history/history_during_period"
                    ? history(msg)
                    : msg.type === "recorder/statistics_during_period"
                      ? statistics(msg)
                      : {},
    };
    if (view) el._battView = view;
    document.getElementById("root").appendChild(el);
}"""

# Opens the diff viewer from the Git Sync tab.
OPEN_DIFF = """() => document.querySelector("system-hub-panel").shadowRoot.querySelector('[data-action="git_sync_diff"]').click()"""

TABS = ["system", "containers", "watchdog", "marketplace", "batteries", "git_sync", "settings"]
SHOTS = [
    *(
        {"file": f"panel-{tab.replace('_', '-')}{suffix}", "theme": theme, "tab": tab}
        for tab in TABS
        for theme, suffix in (("light", ""), ("dark", "-dark"))
    ),
    *(
        {"file": f"panel-batteries-{view}{suffix}", "theme": theme, "tab": "batteries", "view": view}
        for view in ("room", "type", "forecast")
        for theme, suffix in (("light", ""), ("dark", "-dark"))
    ),
    {"file": "panel-marketplace-checking", "theme": "light", "tab": "marketplace", "checking": True},
    {"file": "panel-marketplace-checking-dark", "theme": "dark", "tab": "marketplace", "checking": True},
    {"file": "panel-git-sync-diff", "theme": "light", "tab": "git_sync", "diff": True},
    {"file": "panel-git-sync-diff-dark", "theme": "dark", "tab": "git_sync", "diff": True},
    {"file": "panel-phone", "theme": "light", "tab": "system", "phone": True},
    {"file": "panel-phone-dark", "theme": "dark", "tab": "system", "phone": True},
]


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
            page.evaluate(MOUNT, [shown, STRINGS, shot["tab"], bool(shot.get("phone")), shot.get("view")])
            page.wait_for_timeout(400)
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
