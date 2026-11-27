/*
 * System Hub sidebar panel (administrators): Status, the modules in four groups (System, Reliability, Maintenance,
 * Devices), and Settings.
 *
 * The tab's illustrated banner as the top bar, the menu button in it, as the ha-* panels (ENT ONE, IPTV); then the tabs on
 * the page's background, as in Smart Comfort: text, the active one underlined, Settings last; a group's modules turned
 * on are sub-tabs under it. The module shown is in the address (/system-hub/<module>, or a group's name for its first). The panel draws its own content from the system_hub/state WebSocket command, read
 * again every 10 seconds while it is shown and after each action; its buttons call the integration's own actions.
 * Settings turns modules on or off and orders the tabs (system_hub/update_settings).
 *
 * Every string comes from the integration's translations (loaded with hass.loadBackendTranslation): the panel's
 * own under selector.panel, the buttons from the entity and action names, the modules from the config flow.
 *
 * https://github.com/juju35/ha-system-hub
 */
export var SYSTEM_HUB_PANEL_VERSION = '3.16.0';
export var SH_DOMAIN = 'system_hub';
export var SH_REFRESH_MS = 10000;
// A state that could not be read (Home Assistant restarting, connection lost): read again after
export var SH_RETRY_MS = 3000;
export var SH_MODULE_ICONS = {
  status: 'mdi:heart-pulse',
  system: 'mdi:chip',
  containers: 'mdi:docker',
  watchdog: 'mdi:shield-search',
  marketplace: 'mdi:storefront-outline',
  database: 'mdi:database-outline',
  security: 'mdi:shield-lock-outline',
  backups: 'mdi:backup-restore',
  purge: 'mdi:delete-clock-outline',
  logs: 'mdi:text-box-search-outline',
  silent: 'mdi:access-point-off',
  batteries: 'mdi:battery-heart-variant',
  git_sync: 'mdi:source-branch-sync',
  automations: 'mdi:robot-confused-outline',
  orphans: 'mdi:ghost-outline',
  settings: 'mdi:cog-outline',
};
// The modules (their names when the translations are not loaded yet; the panel shows tab_<module>)
export var SH_MODULE_NAMES = {
  containers: 'Containers',
  database: 'Database',
  security: 'Security',
  watchdog: 'Watchdog',
  marketplace: 'Marketplace',
  backups: 'Backups',
  purge: 'Purge',
  logs: 'Logs',
  silent: 'Silent devices',
  batteries: 'Batteries',
  git_sync: 'Git Sync',
  automations: 'Automations',
  orphans: 'Orphans',
};
// The tabs under the toolbar: Status, one per group of modules (its modules as sub-tabs), Settings last
export var SH_GROUPS = {
  system: ['system', 'containers', 'database'],
  // A group of its own: one module, its sections as sub-tabs (SH_SUBTABS)
  security: ['security', 'security_accounts', 'security_system', 'security_outbound'],
  reliability: ['logs', 'watchdog', 'automations'],
  maintenance: ['marketplace', 'backups', 'purge', 'git_sync'],
  devices: ['silent', 'batteries', 'orphans'],
};
// A module whose sections are sub-tabs: the first keeps the module's name (and its address, /system-hub/security)
export var SH_SUBTABS = { security: ['security', 'security_accounts', 'security_system', 'security_outbound'] };
export var SH_SUBTAB_ICONS = {
  security: 'mdi:login-variant',
  security_accounts: 'mdi:account-key-outline',
  security_system: 'mdi:puzzle-outline',
  security_outbound: 'mdi:lan-connect',
};
// The module a tab shows: a sub-tab's module, else the tab itself
export function shTabBase(tab) {
  return Object.keys(SH_SUBTABS).find((m) => SH_SUBTABS[m].includes(tab)) || tab;
}
// The group of a tab; Status and Settings are groups of their own
export function shGroupOf(tab) {
  return Object.keys(SH_GROUPS).find((g) => SH_GROUPS[g].includes(tab)) || tab;
}
// The tabs with the ones of a group side by side: the groups in the order of their first tab
export function shGroupTabs(tabs) {
  var order = [...new Set(tabs || [])];
  return [...new Set(order.map(shGroupOf))].flatMap((g) => order.filter((t) => shGroupOf(t) === g));
}
// Every tab in its order, the ones not in it yet after (each in its group)
export function shAllTabs(tabs) {
  var order = [...(tabs || [])];
  return shGroupTabs([...order, ...['status', 'system', ...Object.keys(SH_MODULE_NAMES)].filter((t) => !order.includes(t))]);
}
// Automations tab: the items shown per list before "Show more", as in the Automation Monitor card
export var SH_AUTO_MAX = 5;
// Git Sync tab: the list of changed files is folded beyond this many
export var SH_GIT_FILES_MAX = 5;

// The size of an update from its versions (v1.2.3 → v1.3.0: minor); null when they are not numbers
export function shChange(from, to) {
  var parse = (v) => String(v || '').replace(/^v/i, '').split(/[.+-]/).slice(0, 3).map(Number);
  var a = parse(from);
  var b = parse(to);
  if (a.length < 2 || b.length < 2 || [...a, ...b].some((x) => Number.isNaN(x))) return null;
  if (b[0] !== a[0]) return 'major';
  if (b[1] !== a[1]) return 'minor';
  return 'patch';
}

// The start of release notes in plain text: Markdown and HTML left out, about 160 characters
export function shExcerpt(text) {
  var plain = String(text || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}(#{1,6}|[-*+]|\d+\.)\s+/gm, '')
    .replace(/[`*_>~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > 160 ? `${plain.slice(0, 157).trimEnd()}…` : plain;
}

// A hue of its own for a name, for the initials that stand in for a missing logo
// juju35's projects, as the showcase site draws them (homeassistant-projects, src/data/projects.yaml): the MDI icon and
// the accent of each repository, for the Updates tab's cards of those without a picture of their own (the cards).
// A project missing here keeps its initial; the former names of the renamed repositories point to the current ones.
export var SH_PROJECTS = {
  'ha-weather-card': ['weather-partly-cloudy', '#f5a623'],
  'ha-uv-card': ['sun-wireless', '#f2b100'],
  'ha-climate-air-card': ['air-conditioner', '#039be5'],
  'ha-smart-comfort': ['home-thermometer', '#26a69a'],
  'ha-heating-card': ['radiator', '#ef6c00'],
  'ha-room-card': ['floor-plan', '#5b6cf0'],
  'ha-energy-card': ['solar-power-variant', '#f9a825'],
  'ha-zlinky-card': ['meter-electric', '#43a047'],
  'ha-cover-card': ['window-shutter', '#5c6bc0'],
  'ha-utility-meter-card': ['water-pump', '#0288d1'],
  'ha-tempo-card': ['calendar-blank-multiple', '#1e88e5'],
  'ha-pool-card': ['pool', '#00acc1'],
  'ha-garden-card': ['sprinkler-variant', '#43a047'],
  'ha-waste-card': ['trash-can', '#7cb342'],
  'ha-presence-card': ['home-account', '#5b6cf0'],
  'ha-alarm-card': ['shield-home', '#e5484d'],
  'ha-smartlock-card': ['lock-smart', '#43a047'],
  'ha-camera': ['cctv', '#e5484d'],
  'ha-tapo': ['cctv', '#4acbd6'],
  'ha-doorbell-card': ['doorbell-video', '#fb8c00'],
  'ha-smart-appliance-card': ['dishwasher', '#039be5'],
  'ha-vacuum-card': ['robot-vacuum', '#ea0029'],
  'ha-mower-card': ['robot-mower', '#5a9e3c'],
  'ha-printer-card': ['printer', '#0096d6'],
  'ha-hp': ['printer-wireless', '#0096d6'],
  'ha-3d-printer-card': ['printer-3d-nozzle', '#00ae42'],
  'ha-pet-card': ['paw', '#ff7043'],
  'ha-internet-box-card': ['router-wireless', '#cd1e25'],
  'ha-router-card': ['router-network', '#0277bd'],
  'ha-nas-card': ['nas', '#00b46e'],
  'ha-switch-card': ['switch', '#5b6cf0'],
  'ha-docker-card': ['docker', '#2496ed'],
  'ha-dns-filter-card': ['shield-check', '#68bc71'],
  'ha-reverse-proxy': ['server-network', '#5b6cf0'],
  'ha-proxmox': ['server', '#e57000'],
  'ha-ups-card': ['power-plug-battery', '#43a047'],
  'ha-uptime-card': ['server-network', '#26a69a'],
  'ha-certificate-card': ['certificate', '#5e35b1'],
  'ha-seedbox-card': ['download-network', '#2e7d32'],
  'ha-vehicle-card': ['car', '#e1b000'],
  'ha-renault-picture': ['car-info', '#e1b000'],
  'ha-orange-internet-on-the-move': ['car-wireless', '#ff7900'],
  'ha-vehicle-consumption': ['gauge-low', '#26a69a'],
  'ha-carburants-france': ['gas-station', '#43a047'],
  'ha-calendar-card': ['calendar-month', '#5b6cf0'],
  'ha-parcel': ['package-variant-closed', '#ff7a00'],
  'ha-wifi-card': ['qrcode-scan', '#039be5'],
  'ha-wero-card': ['qrcode', '#b8a400'],
  'ha-media-card': ['speaker-multiple', '#8e24aa'],
  'ha-public-transport': ['bus-clock', '#00897b'],
  'ha-saint-of-the-day': ['calendar-star', '#8e44ad'],
  'ha-pronote-card': ['school', '#2e7d32'],
  'ha-stock-card': ['chart-line', '#00897b'],
  'ha-automation-monitor-card': ['robot-confused-outline', '#e5484d'],
  'ha-github': ['github', '#8250df'],
  'ha-system-hub': ['home-analytics', '#03a9f4'],
  'ha-system-monitor-card': ['monitor-dashboard', '#039be5'],
  'ha-marketplace-refresh': ['cloud-refresh-variant', '#41bdf5'],
  'ha-integration-watchdog': ['shield-sync-outline', '#41bdf5'],
  'ha-battery-monitor': ['battery-alert', '#ffa600'],
  'ha-git-sync': ['source-branch-sync', '#f05032'],
  'ha-orphan-entities': ['ghost-outline', '#7e57c2'],
};
export var SH_PROJECT_RENAMED = {
  'ha-freebox-card': 'ha-internet-box-card',
  'ha-dockhand-card': 'ha-docker-card',
  'ha-roborock-card': 'ha-vacuum-card',
  'ha-renault-card': 'ha-vehicle-card',
  'ha-ugreen-nas-card': 'ha-nas-card',
  'ha-hp-printer-card': 'ha-printer-card',
  'ha-home-connect-card': 'ha-smart-appliance-card',
  'ha-home-camera-card': 'ha-camera',
  'ha-zoraxy': 'ha-reverse-proxy',
  'ha-switch': 'ha-switch-card',
  'ha-github-card': 'ha-github',
  'ha-hacs-refresh': 'ha-marketplace-refresh',
};

// The project of an update, from its release notes' address on GitHub (github.com/juju35/<repository>/…)
export function shProject(url) {
  var m = /^https:\/\/github\.com\/juju35\/([^/?#]+)/i.exec(String(url || ''));
  if (!m) return null;
  var slug = m[1].toLowerCase().replace(/\.git$/, '');
  var found = SH_PROJECTS[SH_PROJECT_RENAMED[slug] || slug];
  return found ? { icon: `mdi:${found[0]}`, accent: found[1] } : null;
}

export function shHue(name) {
  var h = 0;
  for (var c of String(name || '')) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 55% 48%)`;
}

// A selector finding the same button or row again once the panel is drawn anew (null when nothing names it)
export function shFocusSelector(el) {
  var attrs = ['data-subtab', 'data-action', 'data-more', 'data-entity', 'data-act', 'data-tab-move', 'data-dir', 'data-view', 'data-chart', 'data-hours', 'data-kind'];
  var esc = (v) => (typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(v) : String(v).replace(/["\\]/g, '\\$&'));
  var parts = attrs.filter((a) => el.hasAttribute?.(a)).map((a) => `[${a}="${esc(el.getAttribute(a))}"]`);
  return parts.length ? parts.join('') : null;
}

// The words of an error: a WebSocket one is {code, message}, or {error: {code, message}} when the connection was lost;
// a REST one carries its body
export function shErr(err) {
  if (err == null) return '';
  if (typeof err !== 'object') return String(err);
  var text = err.message || err.error?.message || err.body?.message || err.error?.code || err.code;
  if (typeof text === 'string' && text) return text;
  // A form's errors by field (a 400 of a flow), never "[object Object]"
  var errors = err.body?.errors;
  if (errors && typeof errors === 'object') return Object.values(errors).flat().map(String).join(' · ');
  try {
    return JSON.stringify(text || err.body || err);
  } catch (_err) {
    return String(err);
  }
}

// An integration's name as its users know it
export var SH_INTEGRATIONS = { zha: 'ZHA', mqtt: 'MQTT', zwave_js: 'Z-Wave', matter: 'Matter', esphome: 'ESPHome', deconz: 'deCONZ' };
export function shIntegration(domain) {
  return SH_INTEGRATIONS[domain] || domain;
}

export function shEsc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export function shNum(value) {
  var n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : null;
}
