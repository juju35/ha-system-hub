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
var SYSTEM_HUB_PANEL_VERSION = '3.11.2';
var SH_DOMAIN = 'system_hub';
var SH_REFRESH_MS = 10000;
// A state that could not be read (Home Assistant restarting, connection lost): read again after
var SH_RETRY_MS = 3000;
var SH_MODULE_ICONS = {
  status: 'mdi:heart-pulse',
  system: 'mdi:chip',
  containers: 'mdi:docker',
  watchdog: 'mdi:shield-search',
  marketplace: 'mdi:storefront-outline',
  database: 'mdi:database-outline',
  security: 'mdi:shield-lock-outline',
  backups: 'mdi:backup-restore',
  logs: 'mdi:text-box-search-outline',
  silent: 'mdi:access-point-off',
  batteries: 'mdi:battery-heart-variant',
  git_sync: 'mdi:source-branch-sync',
  automations: 'mdi:robot-confused-outline',
  orphans: 'mdi:ghost-outline',
  settings: 'mdi:cog-outline',
};
// The modules (their names when the translations are not loaded yet; the panel shows tab_<module>)
var SH_MODULE_NAMES = {
  containers: 'Containers',
  database: 'Database',
  security: 'Security',
  watchdog: 'Watchdog',
  marketplace: 'Marketplace',
  backups: 'Backups',
  logs: 'Logs',
  silent: 'Silent devices',
  batteries: 'Batteries',
  git_sync: 'Git Sync',
  automations: 'Automations',
  orphans: 'Orphans',
};
// The tabs under the toolbar: Status, one per group of modules (its modules as sub-tabs), Settings last
var SH_GROUPS = {
  system: ['system', 'containers', 'database', 'security'],
  reliability: ['logs', 'watchdog', 'automations'],
  maintenance: ['marketplace', 'backups', 'git_sync'],
  devices: ['silent', 'batteries', 'orphans'],
};
// The group of a tab; Status and Settings are groups of their own
function shGroupOf(tab) {
  return Object.keys(SH_GROUPS).find((g) => SH_GROUPS[g].includes(tab)) || tab;
}
// The tabs with the ones of a group side by side: the groups in the order of their first tab
function shGroupTabs(tabs) {
  var order = [...new Set(tabs || [])];
  return [...new Set(order.map(shGroupOf))].flatMap((g) => order.filter((t) => shGroupOf(t) === g));
}
// Every tab in its order, the ones not in it yet after (each in its group)
function shAllTabs(tabs) {
  var order = [...(tabs || [])];
  return shGroupTabs([...order, ...['status', 'system', ...Object.keys(SH_MODULE_NAMES)].filter((t) => !order.includes(t))]);
}
// Automations tab: the items shown per list before "Show more", as in the Automation Monitor card
var SH_AUTO_MAX = 5;
// Git Sync tab: the list of changed files is folded beyond this many
var SH_GIT_FILES_MAX = 5;

// The size of an update from its versions (v1.2.3 → v1.3.0: minor); null when they are not numbers
function shChange(from, to) {
  var parse = (v) => String(v || '').replace(/^v/i, '').split(/[.+-]/).slice(0, 3).map(Number);
  var a = parse(from);
  var b = parse(to);
  if (a.length < 2 || b.length < 2 || [...a, ...b].some((x) => Number.isNaN(x))) return null;
  if (b[0] !== a[0]) return 'major';
  if (b[1] !== a[1]) return 'minor';
  return 'patch';
}

// The start of release notes in plain text: Markdown and HTML left out, about 160 characters
function shExcerpt(text) {
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
var SH_PROJECTS = {
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
var SH_PROJECT_RENAMED = {
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
function shProject(url) {
  var m = /^https:\/\/github\.com\/juju35\/([^/?#]+)/i.exec(String(url || ''));
  if (!m) return null;
  var slug = m[1].toLowerCase().replace(/\.git$/, '');
  var found = SH_PROJECTS[SH_PROJECT_RENAMED[slug] || slug];
  return found ? { icon: `mdi:${found[0]}`, accent: found[1] } : null;
}

function shHue(name) {
  var h = 0;
  for (var c of String(name || '')) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 55% 48%)`;
}

// A selector finding the same button or row again once the panel is drawn anew (null when nothing names it)
function shFocusSelector(el) {
  var attrs = ['data-subtab', 'data-action', 'data-more', 'data-entity', 'data-act', 'data-tab-move', 'data-dir', 'data-view', 'data-chart', 'data-hours', 'data-kind'];
  var esc = (v) => (typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(v) : String(v).replace(/["\\]/g, '\\$&'));
  var parts = attrs.filter((a) => el.hasAttribute?.(a)).map((a) => `[${a}="${esc(el.getAttribute(a))}"]`);
  return parts.length ? parts.join('') : null;
}

// The words of an error: a WebSocket one is {code, message}, or {error: {code, message}} when the connection was lost;
// a REST one carries its body
function shErr(err) {
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
var SH_INTEGRATIONS = { zha: 'ZHA', mqtt: 'MQTT', zwave_js: 'Z-Wave', matter: 'Matter', esphome: 'ESPHome', deconz: 'deCONZ' };
function shIntegration(domain) {
  return SH_INTEGRATIONS[domain] || domain;
}

function shEsc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function shNum(value) {
  var n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

// Tone of a percentage: good below 70, warn below 90, bad above
// Silent devices, network views. A Zigbee mesh as ZHA's zha/devices gives it (each device with its neighbour table):
// the nodes (coordinator, routers, end devices) and the links between them; an end device's parent is the router or
// coordinator whose table names it as a child, else its best neighbour among them; a router hangs from the coordinator
function shZhaGraph(list) {
  var roles = { Coordinator: 'coordinator', Router: 'router', EndDevice: 'end' };
  var nodes = (list || []).map((d) => ({
    id: String(d.ieee),
    device_id: d.device_reg_id || null,
    name: d.user_given_name || d.name || String(d.ieee),
    role: roles[d.device_type] || 'end',
    lqi: shNum(d.lqi),
    available: d.available !== false,
    seen: d.last_seen || null,
    parent: null,
  }));
  var byId = new Map(nodes.map((n) => [n.id, n]));
  var links = new Map();
  var best = new Map();
  var offer = (child, parent, lqi, rank) => {
    var had = best.get(child.id);
    if (!had || rank > had.rank || (rank === had.rank && (lqi ?? -1) > (had.lqi ?? -1))) best.set(child.id, { parent: parent.id, lqi, rank });
  };
  for (var d of list || []) {
    var self = byId.get(String(d.ieee));
    for (var nb of d.neighbors || []) {
      var other = byId.get(String(nb.ieee));
      if (!self || !other || other === self) continue;
      var lqi = shNum(nb.lqi);
      var key = [self.id, other.id].sort().join('|');
      if (!links.has(key) || (lqi ?? -1) > (links.get(key).lqi ?? -1)) links.set(key, { a: self.id, b: other.id, lqi });
      var rel = String(nb.relationship || '');
      // The table of self names other: its child, its parent, or a neighbour only (weaker)
      if (other.role === 'end' && self.role !== 'end') offer(other, self, lqi, rel === 'Child' ? 2 : 1);
      else if (self.role === 'end' && other.role !== 'end') offer(self, other, lqi, rel === 'Parent' ? 2 : 1);
    }
  }
  var coordinator = nodes.find((n) => n.role === 'coordinator');
  for (var n of nodes) {
    if (n.role === 'router') n.parent = coordinator?.id || null;
    else if (n.role === 'end') {
      var found = best.get(n.id);
      n.parent = found?.parent || coordinator?.id || null;
      if (n.lqi === null && found) n.lqi = found.lqi;
    }
  }
  return { source: 'zha', nodes, links: [...links.values()] };
}

// Zigbee2MQTT's raw network map (bridge/request/networkmap): its links are read from the table of their target, so
// they become the neighbour tables ZHA gives; the Home Assistant device of a node is the MQTT device named after it
function shZ2mGraph(value, registry) {
  var rel = { 0: 'Parent', 1: 'Child', 2: 'Sibling' };
  var ids = new Map();
  for (var dev of registry || []) {
    for (var [dom, id] of dev.identifiers || []) {
      var m = dom === 'mqtt' && /^zigbee2mqtt_(0x[0-9a-f]+)$/i.exec(String(id));
      if (m) ids.set(m[1].toLowerCase(), dev.id);
    }
  }
  var list = (value?.nodes || []).map((n) => {
    var ieee = String(n.ieeeAddr || '').toLowerCase();
    return {
      ieee,
      device_reg_id: ids.get(ieee) || null,
      name: n.friendlyName || ieee,
      device_type: n.type,
      last_seen: typeof n.lastSeen === 'number' ? new Date(n.lastSeen).toISOString() : n.lastSeen || null,
      neighbors: (value.links || [])
        .filter((l) => String(l.target?.ieeeAddr || '').toLowerCase() === ieee)
        .map((l) => ({ ieee: String(l.source?.ieeeAddr || '').toLowerCase(), lqi: l.lqi ?? l.linkquality, relationship: rel[l.relationship] || '' })),
    };
  });
  return { ...shZhaGraph(list), source: 'z2m' };
}

// The Matter devices by network (matter/node_diagnostics of each node): Thread (by network name), Wi-Fi, Ethernet;
// Matter gives no neighbour table, so a node hangs from its network, the devices a bridge exposes from the bridge
function shMatterGraph(registry, diagnostics) {
  var mine = (registry || []).filter((d) => !d.disabled_by && (d.identifiers || []).some(([dom]) => dom === 'matter'));
  var ids = new Set(mine.map((d) => d.id));
  var diag = new Map(diagnostics || []);
  var hubs = new Map();
  var nodes = [];
  for (var dev of mine) {
    var bridged = ids.has(dev.via_device_id);
    var info = diag.get(dev.id) || null;
    var parent = dev.via_device_id;
    if (!bridged) {
      var kind = ['thread', 'wifi', 'ethernet'].includes(info?.network_type) ? info.network_type : 'other';
      var label = kind === 'thread' ? info.network_name || '' : '';
      parent = `net:${kind}:${label}`;
      if (!hubs.has(parent)) hubs.set(parent, { id: parent, device_id: null, name: label, hub: kind, role: 'hub', lqi: null, available: true, seen: null, parent: null });
    }
    var type = info?.node_type;
    nodes.push({
      id: dev.id,
      device_id: dev.id,
      name: dev.name_by_user || dev.name || dev.id,
      role: type === 'bridge' ? 'bridge' : type === 'routing_end_device' ? 'router' : 'end',
      lqi: null,
      available: bridged ? diag.get(dev.via_device_id)?.available !== false : info?.available !== false,
      seen: null,
      parent,
    });
  }
  return { source: 'matter', nodes: [...hubs.values(), ...nodes], links: [] };
}

// A Z-Wave network as Z-Wave JS gives it: the nodes of zwave_js/network_status (the controller, the always listening
// nodes that route, the others) and each node's last working route (zwave_js node statistics: the repeaters from the
// controller to it, as Home Assistant device ids); a node hangs from its last repeater, else from the controller, the
// hops of its routes are the mesh between repeaters; its signal is its RSSI (dBm). Several controllers, several networks
function shZwaveGraph(networks, registry, stats) {
  var ids = new Map();
  var names = new Map();
  for (var dev of registry || []) {
    for (var [dom, id] of dev.identifiers || []) {
      var m = dom === 'zwave_js' && /^(\d+)-(\d+)$/.exec(String(id));
      if (m && !dev.disabled_by) {
        ids.set(`${m[1]}-${m[2]}`, dev.id);
        names.set(dev.id, dev.name_by_user || dev.name || '');
      }
    }
  }
  var info = new Map(stats || []);
  var nodes = [];
  var byDevice = new Map();
  var controllers = new Map();
  for (var net of networks || []) {
    var home = String(net?.home_id ?? '');
    for (var z of net?.nodes || []) {
      var key = `${home}-${z.node_id}`;
      var device = ids.get(key) || null;
      // Its RSSI, else its last route's (Z-Wave JS reports 125 to 127 when it has no reading)
      var rssi = [info.get(device)?.rssi, info.get(device)?.lwr?.rssi].map(shNum).find((v) => v !== null && v < 0) ?? null;
      var node = {
        id: key,
        device_id: device,
        name: names.get(device) || `Node ${z.node_id}`,
        role: z.is_controller_node ? 'coordinator' : z.is_routing ? 'router' : 'end',
        lqi: null,
        rssi,
        available: z.status !== 3,
        seen: null,
        parent: null,
        home,
      };
      nodes.push(node);
      if (device) byDevice.set(device, node);
      if (node.role === 'coordinator') controllers.set(home, node);
    }
  }
  var links = new Map();
  var tie = (a, b) => {
    if (!a || !b || a === b) return;
    var key = [a.id, b.id].sort().join('|');
    if (!links.has(key)) links.set(key, { a: a.id, b: b.id, lqi: null });
  };
  for (var n of nodes) {
    if (n.role === 'coordinator') continue;
    var root = controllers.get(n.home) || null;
    var route = (r) => (r?.repeaters || []).map((d) => byDevice.get(d)).filter((x) => x && x !== n && x.home === n.home);
    var last = route(info.get(n.device_id)?.lwr);
    n.parent = (last.length ? last[last.length - 1] : root)?.id || null;
    var routes = [info.get(n.device_id)?.lwr, info.get(n.device_id)?.nlwr].filter(Boolean).map(route);
    for (var r of routes) {
      var hops = [root, ...r, n];
      for (var i = 1; i < hops.length; i++) tie(hops[i - 1], hops[i]);
    }
  }
  // Routes read at different times can loop (A through B, B through A): such a node hangs from its controller
  var byId = new Map(nodes.map((x) => [x.id, x]));
  for (var x of nodes) {
    var seen = new Set([x.id]);
    for (var at = byId.get(x.parent); at; at = byId.get(at.parent)) {
      if (seen.has(at.id)) {
        x.parent = controllers.get(x.home)?.id || null;
        break;
      }
      seen.add(at.id);
    }
  }
  for (var y of nodes) delete y.home;
  return { source: 'zwave', nodes, links: [...links.values()] };
}

// The order of a network's nodes: the coordinator or the network, the routers and bridges, the devices
var SH_NET_RANK = { coordinator: 0, hub: 0, bridge: 1, router: 1, end: 2 };

// A network as a tree: each node's children (by its id), and the nodes without a parent among them
function shNetTree(nodes) {
  var ids = new Set(nodes.map((n) => n.id));
  var kids = new Map();
  var roots = [];
  for (var n of nodes) {
    if (n.parent && ids.has(n.parent) && n.parent !== n.id) {
      if (!kids.has(n.parent)) kids.set(n.parent, []);
      kids.get(n.parent).push(n);
    } else roots.push(n);
  }
  return { kids, roots };
}

// Where each node goes on a square map of the given size: the root in the middle (several roots around it), every
// subtree in a slice of the circle as wide as its leaves, one ring per depth
function shNetLayout(nodes, size) {
  var { kids, roots } = shNetTree(nodes);
  for (var list of kids.values()) list.sort((a, b) => SH_NET_RANK[a.role] - SH_NET_RANK[b.role] || a.name.localeCompare(b.name));
  var top = roots.length === 1 ? roots[0] : { id: '', virtual: true };
  if (top.virtual) kids.set('', roots);
  var leaves = new Map();
  var count = (node, seen) => {
    if (seen.has(node.id)) return 0;
    seen.add(node.id);
    var k = kids.get(node.id) || [];
    var total = k.length ? k.reduce((s, c) => s + count(c, seen), 0) : 1;
    leaves.set(node.id, total || 1);
    return total || 1;
  };
  count(top, new Set());
  var depth = (node, seen) => {
    if (seen.has(node.id)) return 0;
    seen.add(node.id);
    return 1 + Math.max(0, ...(kids.get(node.id) || []).map((c) => depth(c, seen)));
  };
  var rings = Math.max(1, depth(top, new Set()) - 1);
  var mid = size / 2;
  var step = (mid - 40) / rings;
  var pos = {};
  var place = (node, d, a0, a1) => {
    if (pos[node.id] || (node.virtual && d)) return;
    var a = (a0 + a1) / 2;
    if (!node.virtual) pos[node.id] = d ? [mid + Math.cos(a) * d * step, mid + Math.sin(a) * d * step] : [mid, mid];
    var k = kids.get(node.id) || [];
    var total = k.reduce((s, c) => s + (leaves.get(c.id) || 1), 0) || 1;
    var at = a0;
    for (var c of k) {
      var span = ((a1 - a0) * (leaves.get(c.id) || 1)) / total;
      place(c, d + 1, at, at + span);
      at += span;
    }
  };
  place(top, 0, -Math.PI / 2, Math.PI * 1.5);
  return pos;
}

// The map's layout. The nodes without children go round their parent in a crown (a gap under it for its name), or,
// past 8 end devices, those in two columns on its left and right and the routers on an arc above, the ones on the
// left with their name on the left; the rest (coordinator, networks, routers with children) is laid out as a graph of
// forces, each pushing the others as far as its crown reaches, every
// link pulling its two ends together, a light pull keeping everything near the middle. It starts from the rings of
// shNetLayout and is computed once per reading, so the same network is always drawn the same way; a single root stays
// in the middle. Each node gets [x, y, side], side -1 when its name goes on its left.
function shNetForce(nodes, links, width, height) {
  var { kids } = shNetTree(nodes);
  var leaf = (n) => n.parent && !(kids.get(n.id) || []).length;
  var core = nodes.filter((n) => !leaf(n));
  var crown = new Map();
  for (var n of nodes) if (leaf(n)) crown.set(n.parent, [...(crown.get(n.parent) || []), n]);
  var COLUMNS = 8;
  var ringOf = (count) => (count ? Math.max(110, (count * 46) / (2 * Math.PI)) : 0);
  var ends = (list) => list.filter((u) => u.role === 'end').length;
  // How far a node's crown reaches: its ring, or its columns (180 to the side, names 200 beyond, 40 per row) and arc
  var reachOf = (list) => (ends(list) > COLUMNS ? Math.max(380, Math.ceil(ends(list) / 2) * 20 + (list.length > ends(list) ? 130 : 0)) : ringOf(list.length));
  var reach = new Map(core.map((c) => [c.id, reachOf(crown.get(c.id) || [])]));
  var ring = shNetLayout(core, Math.min(width, height));
  var pts = core.map((c) => {
    var p = ring[c.id] || [Math.min(width, height) / 2, Math.min(width, height) / 2];
    return { id: c.id, r: reach.get(c.id) || 0, x: p[0] + (width - Math.min(width, height)) / 2, y: p[1] + (height - Math.min(width, height)) / 2, vx: 0, vy: 0 };
  });
  var at = new Map(pts.map((p, i) => [p.id, i]));
  // A chain of routers (Z-Wave routes through repeaters) starts on one line, and the forces would keep it there: each
  // node two hops or more from the root starts turned round its parent, one way then the other
  var turn = 0;
  for (var c0 of core) {
    var up = at.has(c0.parent) ? core[at.get(c0.parent)] : null;
    if (!up || !at.has(up.parent)) continue;
    var me = pts[at.get(c0.id)];
    var pa = pts[at.get(up.id)];
    var ang = (turn++ % 2 ? -1 : 1) * 0.9;
    var ox = me.x - pa.x;
    var oy = me.y - pa.y;
    me.x = pa.x + ox * Math.cos(ang) - oy * Math.sin(ang);
    me.y = pa.y + ox * Math.sin(ang) + oy * Math.cos(ang);
  }
  var springs = [];
  for (var c of core) if (at.has(c.parent)) springs.push([at.get(c.id), at.get(c.parent), 0.6]);
  for (var l of links || []) {
    if (!at.has(l.a) || !at.has(l.b)) continue;
    var a = core[at.get(l.a)];
    var b = core[at.get(l.b)];
    if (a.parent === b.id || b.parent === a.id) continue;
    springs.push([at.get(l.a), at.get(l.b), 0.15]);
  }
  var roots = core.filter((x) => !at.has(x.parent));
  var pinned = roots.length === 1 ? at.get(roots[0].id) : -1;
  // Several roots (Matter networks, nothing between them): each pulled hard to the middle, so they stay together
  var anchored = new Set(roots.length > 1 ? roots.map((x) => at.get(x.id)) : []);
  var k = 130;
  var cx = width / 2;
  var cy = height / 2;
  var steps = pts.length > 200 ? 150 : 300;
  for (var step = 0; step < steps; step++) {
    var heat = 1 - step / steps;
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      for (var j = i + 1; j < pts.length; j++) {
        var q = pts[j];
        var ddx = p.x - q.x;
        var ddy = p.y - q.y;
        var d2 = ddx * ddx + ddy * ddy || 0.01;
        var room = k + p.r + q.r;
        // Far apart, they no longer push: the light pull to the middle keeps the parts together
        if (d2 > 4 * room * room) continue;
        var push = (room * room) / d2;
        p.vx += ddx * push;
        p.vy += ddy * push;
        q.vx -= ddx * push;
        q.vy -= ddy * push;
      }
    }
    for (var [s, t, w] of springs) {
      var ps = pts[s];
      var pt = pts[t];
      var sx = pt.x - ps.x;
      var sy = pt.y - ps.y;
      var pull = (Math.hypot(sx, sy) / (k + ps.r + pt.r)) * w;
      ps.vx += sx * pull;
      ps.vy += sy * pull;
      pt.vx -= sx * pull;
      pt.vy -= sy * pull;
    }
    var limit = 60 * heat + 0.5;
    for (var m = 0; m < pts.length; m++) {
      var r = pts[m];
      var g = anchored.has(m) ? 0.3 : 0.03;
      r.vx += (cx - r.x) * g;
      r.vy += (cy - r.y) * g;
      var v = Math.hypot(r.vx, r.vy);
      if (m !== pinned && v > 0) {
        r.x += (r.vx / v) * Math.min(v, limit);
        r.y += (r.vy / v) * Math.min(v, limit);
      }
      r.vx = 0;
      r.vy = 0;
    }
    if (pinned >= 0) Object.assign(pts[pinned], { x: cx, y: cy });
  }
  var pos = Object.fromEntries(pts.map((p) => [p.id, [p.x, p.y, 1]]));
  // The crowns: round the parent, away from the grandparent (a half circle at least), else all the way round with a
  // gap at the bottom; past 8 end devices, those in two columns and the routers on an arc above
  for (var [pid, list] of crown) {
    var o = pos[pid];
    if (!o) continue;
    list.sort((u, v) => (u.role === 'end') - (v.role === 'end') || u.name.localeCompare(v.name));
    var gp = pos[core.find((x) => x.id === pid)?.parent];
    if (ends(list) > COLUMNS) {
      var cols = list.filter((u) => u.role === 'end');
      var arc = list.filter((u) => u.role !== 'end');
      var half = Math.ceil(cols.length / 2);
      cols.forEach((u, idx) => {
        // The first half on the right, names on the right; the rest on the left, names on the left
        var right = idx < half;
        var row = right ? idx : idx - half;
        var rows = right ? half : cols.length - half;
        pos[u.id] = [o[0] + (right ? 180 : -180), o[1] + (row - (rows - 1) / 2) * 40, right ? 1 : -1, true];
      });
      var top = o[1] - (half * 20 + 110);
      arc.forEach((u, idx) => {
        pos[u.id] = [o[0] + (idx - (arc.length - 1) / 2) * 280, top + Math.abs(idx - (arc.length - 1) / 2) * 18, 1];
      });
      continue;
    }
    var count = list.length;
    var radius = ringOf(count);
    var span = gp ? Math.min(2 * Math.PI, Math.max(Math.PI, count * 0.45)) : 2 * Math.PI;
    var base = gp ? Math.atan2(o[1] - gp[1], o[0] - gp[0]) : Math.PI / 2;
    // A few nodes round a coordinator or a network (its name under it): on an arc above it
    var role = core.find((x) => x.id === pid)?.role;
    if (!gp && count <= 6 && (role === 'coordinator' || role === 'hub')) {
      span = Math.PI + 0.8;
      base = -Math.PI / 2;
    }
    list.forEach((u, idx) => {
      // All the way round: from just after the bottom to just before it, the bottom left free for the parent's name
      var ang = span >= 2 * Math.PI ? Math.PI / 2 + 0.7 + (2 * Math.PI - 1.4) * (count > 1 ? idx / (count - 1) : 0.5) : base - span / 2 + (span * (idx + 0.5)) / count;
      pos[u.id] = [o[0] + Math.cos(ang) * radius, o[1] + Math.sin(ang) * radius, Math.cos(ang) < -0.2 ? -1 : 1];
    });
  }
  return pos;
}

// The box that shows every node with its name, for a map of pxW × pxH screen pixels. The names keep their size in
// pixels, so the margins are in pixels: the units per pixel are the smallest that fit the nodes inside them, and at
// least 1 so that a small network is not blown up (zoomed out, the map leaves out names: see _slFixZoom)
function shNetBox(pos, pxW, pxH) {
  var pts = Object.values(pos);
  if (!pts.length) return [0, 0, pxW, pxH];
  var xs = pts.map((p) => p[0]);
  var ys = pts.map((p) => p[1]);
  var left = pts.some((p) => p[2] === -1) ? 260 : 40;
  var right = 260;
  var top = 80;
  var bottom = 50;
  var x0 = Math.min(...xs);
  var y0 = Math.min(...ys);
  var w = Math.max(...xs) - x0;
  var h = Math.max(...ys) - y0;
  var unit = Math.max(1, w / Math.max(pxW - left - right, 100), h / Math.max(pxH - top - bottom, 100));
  var bw = pxW * unit;
  var bh = pxH * unit;
  return [x0 - left * unit - (bw - w - (left + right) * unit) / 2, y0 - top * unit - (bh - h - (top + bottom) * unit) / 2, bw, bh];
}

// The tone of a link quality: strong, medium, weak (the module's weak signal is below 50)
function shLqiTone(lqi) {
  if (lqi === null || lqi === undefined) return '';
  return lqi >= 100 ? 'good' : lqi >= 50 ? 'warn' : 'bad';
}

// Tone of a Z-Wave RSSI (dBm): good from −70, warn from −80, weak below
function shRssiTone(rssi) {
  if (rssi === null || rssi === undefined) return '';
  return rssi >= -70 ? 'good' : rssi >= -80 ? 'warn' : 'bad';
}

// A node's signal: its LQI (Zigbee) or its RSSI (Z-Wave), its tone and its strength from 0 to 1
function shSignal(n) {
  if (n?.lqi !== null && n?.lqi !== undefined) return { text: `LQI ${n.lqi}`, tone: shLqiTone(n.lqi), level: Math.min(255, n.lqi) / 255 };
  if (n?.rssi !== null && n?.rssi !== undefined) return { text: `${n.rssi} dBm`, tone: shRssiTone(n.rssi), level: Math.max(0, Math.min(1, (n.rssi + 100) / 60)) };
  return null;
}

function shTone(pct, warn = 70, bad = 90) {
  if (pct === null || pct === undefined) return '';
  return pct >= bad ? 'bad' : pct >= warn ? 'warn' : 'good';
}

// Sizes in base 1024 (KiB, MiB, GiB), 2/1/0 decimals, as the other ha-* cards
function shBytes(bytes) {
  var n = shNum(bytes);
  if (n === null) return '—';
  var units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  var i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  var digits = i === 0 ? 0 : n < 10 ? 2 : n < 100 ? 1 : 0;
  return `${n.toFixed(digits)} ${units[i]}`;
}

// A small line of the last values (0-100 scale), behind a gauge: SVG, no library
function shSpark(values) {
  var points = (values || []).filter((v) => v !== null && v !== undefined);
  if (points.length < 2) return '';
  var w = 100;
  var step = w / (points.length - 1);
  var d = points.map((v, i) => `${(i * step).toFixed(1)},${(30 - (Math.min(Math.max(v, 0), 100) * 30) / 100).toFixed(1)}`);
  return `<svg class="spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><polyline points="${d.join(' ')}"/></svg>`;
}

// Settings → Hide the top bar, as last seen in this browser: applied before the state is read
var SH_HIDE_BAR_KEY = 'system_hub_hide_bar';

// Status letter and colour of a file in the diff viewer, as in an editor's source control view.
var SH_DIFF_STATUS = {
  added: { letter: 'A', key: 'diff_added', color: 'var(--sh-ok)' },
  modified: { letter: 'M', key: 'diff_modified', color: 'var(--sh-warn)' },
  deleted: { letter: 'D', key: 'diff_deleted', color: 'var(--sh-alert)' },
  renamed: { letter: 'R', key: 'diff_renamed', color: 'var(--sh-info)' },
  copied: { letter: 'C', key: 'diff_added', color: 'var(--sh-info)' },
  mode: { letter: 'T', key: 'diff_mode', color: 'var(--sh-off)' },
};

// "config/packages/lights.yaml" → ["lights.yaml", "config/packages"].
var shSplitPath = (path) => {
  const i = String(path || '').lastIndexOf('/');
  return i < 0 ? [path, ''] : [path.slice(i + 1), path.slice(0, i)];
};


// The diff viewer of Git Sync, as in an editor's source control view: Versioning's illustrated banner, the counts as
// tiles, the files and the selected file's diff, then the commit message, Write with AI and Commit and push
class SystemHubDiffDialog extends HTMLElement {
  constructor() {
    super();
    this._open = false;
    this._loading = false;
    this._diff = null;
    this._error = null;
    this._selected = 0;
    this._onKey = (ev) => {
      if (!this._open) return;
      if (ev.key === 'Escape') {
        ev.preventDefault();
        this.close();
        return;
      }
      if (ev.key !== 'ArrowDown' && ev.key !== 'ArrowUp') return;
      // The event comes retargeted to this element: its first target tells the diff or the message field apart
      var el = ev.composedPath?.()[0] || ev.target;
      if (el?.closest?.('.d-main, input')) return;
      const files = this._diff?.files || [];
      if (!files.length) return;
      ev.preventDefault();
      this._select((this._selected + (ev.key === 'ArrowDown' ? 1 : files.length - 1)) % files.length);
    };
  }

  // Opens the viewer: `request` fetches the diff; `banner(diff)` draws the header; `generate` (optional) writes a
  // commit message; `onCommit(message)` (optional) adds the message field and Commit and push.
  async open({ t, locale, branch, commitLabel, lastPush, message, style, banner, request, generate, onCommit }) {
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    this._tr = t;
    this._commitLabel = commitLabel;
    this._locale = locale;
    this._branch = branch;
    this._lastPush = lastPush;
    this._message = message || '';
    this._style = style || '';
    this._bannerFn = banner;
    this._generate = generate;
    this._onCommit = onCommit;
    this._generating = false;
    this._open = true;
    this._loading = true;
    this._diff = null;
    this._error = null;
    this._selected = 0;
    this._restore = document.activeElement;
    document.addEventListener?.('keydown', this._onKey);
    this._render();
    try {
      this._diff = await request();
    } catch (err) {
      this._error = shErr(err);
    } finally {
      this._loading = false;
      if (this._open) {
        this._render();
        this.shadowRoot.querySelector('.d-main')?.focus?.({ preventScroll: true });
      }
    }
  }

  close() {
    if (!this._open) return;
    this._open = false;
    document.removeEventListener?.('keydown', this._onKey);
    this._render();
    this._restore?.focus?.({ preventScroll: true });
  }

  _t(key, vars) {
    return this._tr(key, vars);
  }

  _select(index) {
    this._selected = index;
    this._render();
    this.shadowRoot.querySelector('.d-main')?.scrollTo?.(0, 0);
    this.shadowRoot.querySelector(`.d-file[data-i="${index}"]`)?.focus?.({ preventScroll: true });
  }

  _fmt(n) {
    try {
      return Number(n).toLocaleString(this._locale);
    } catch (_err) {
      return String(n);
    }
  }

  _counts(file) {
    return `<span class="d-counts">${file.additions ? `<span class="d-add">+${this._fmt(file.additions)}</span>` : ''}${
      file.deletions ? `<span class="d-del">−${this._fmt(file.deletions)}</span>` : ''
    }</span>`;
  }

  _fileItem(file, index) {
    const st = SH_DIFF_STATUS[file.status] || SH_DIFF_STATUS.modified;
    const [name, dir] = shSplitPath(file.path);
    const label = this._t(st.key);
    return `<button class="d-file${index === this._selected ? ' selected' : ''}" data-i="${index}" role="option" aria-selected="${index === this._selected}"
        title="${shEsc(file.path)}">
      <span class="d-st" style="--c:${st.color}" title="${shEsc(label)}" aria-label="${shEsc(label)}">${st.letter}</span>
      <span class="d-name"><span class="d-base">${shEsc(name)}</span>${dir ? `<span class="d-dir">${shEsc(dir)}</span>` : ''}</span>
      ${this._counts(file)}
    </button>`;
  }

  _hunk(hunk) {
    const rows = hunk.lines
      .map((line) => {
        const cls = line.kind === 'add' ? 'add' : line.kind === 'del' ? 'del' : 'ctx';
        const sign = line.kind === 'add' ? '+' : line.kind === 'del' ? '−' : ' ';
        return `<tr class="${cls}"><td class="ln">${line.old ?? ''}</td><td class="ln">${line.new ?? ''}</td><td class="sg">${sign}</td><td class="tx">${shEsc(line.text)}</td></tr>`;
      })
      .join('');
    return `<tr class="hunk"><td class="ln"></td><td class="ln"></td><td class="sg"></td><td class="tx">${shEsc(hunk.header)}</td></tr>${rows}`;
  }

  _fileView(file) {
    const st = SH_DIFF_STATUS[file.status] || SH_DIFF_STATUS.modified;
    const rename = file.old_path ? `<span class="d-old">${shEsc(file.old_path)}</span><ha-icon icon="mdi:arrow-right"></ha-icon>` : '';
    let body;
    if (file.binary) body = `<div class="d-note"><ha-icon icon="mdi:file-outline"></ha-icon>${shEsc(this._t('diff_binary'))}</div>`;
    else if (!file.hunks.length) body = `<div class="d-note">${shEsc(this._t(st.key))}</div>`;
    else {
      body = `<table class="d-table" aria-label="${shEsc(file.path)}"><tbody>${file.hunks.map((h) => this._hunk(h)).join('')}</tbody></table>`;
      if (file.truncated) body += `<div class="d-note">${shEsc(this._t('diff_truncated', { n: this._fmt(file.truncated) }))}</div>`;
    }
    return `<div class="d-head">
        <span class="d-st" style="--c:${st.color}" title="${shEsc(this._t(st.key))}">${st.letter}</span>
        <span class="d-path">${rename}<span>${shEsc(file.path)}</span></span>
        ${this._counts(file)}
      </div><div class="d-code">${body}</div>`;
  }

  // A tile of the charter: its round icon in its tone, the value, the label under it
  _tile(icon, value, label, tone) {
    return `<div class="d-tile ${tone}"><span class="d-av"><ha-icon icon="${icon}"></ha-icon></span>
      <span class="d-who"><b>${value}</b><span>${shEsc(label)}</span></span></div>`;
  }

  _render() {
    if (!this.shadowRoot) return;
    if (!this._open) {
      this.shadowRoot.innerHTML = '';
      return;
    }
    const diff = this._diff;
    const files = diff?.files || [];
    const total = files.length + (diff?.more_files || 0);
    const selected = files[this._selected];
    const title = this._t('diff_title', { branch: this._branch || 'HEAD' });
    let main;
    if (this._loading) main = `<div class="d-note d-center"><ha-icon class="spin" icon="mdi:loading"></ha-icon>${shEsc(this._t('diff_loading'))}</div>`;
    else if (this._error) main = `<div class="d-note d-center d-error">${shEsc(this._t('failed', { error: this._error }))}</div>`;
    else if (!files.length) main = `<div class="d-note d-center">${shEsc(this._t('diff_empty'))}</div>`;
    else main = this._fileView(selected);
    const close = `<button class="shzoom" id="close" title="${shEsc(this._t('diff_close'))}" aria-label="${shEsc(this._t('diff_close'))}"><ha-icon icon="mdi:close"></ha-icon></button>`;
    const pill = files.length ? this._t(total === 1 ? 'diff_files_one' : 'diff_files_many', { n: this._fmt(total) }) : '';
    const banner = this._bannerFn?.({ title, pill, buttons: close }) || '';
    const tiles = files.length
      ? `<div class="d-tiles">
          ${this._tile('mdi:file-document-edit-outline', this._fmt(total), this._t('changed'), 'warn')}
          ${this._tile('mdi:plus', this._fmt(diff.additions || 0), this._t('diff_lines_added'), diff.additions ? 'good' : '')}
          ${this._tile('mdi:minus', this._fmt(diff.deletions || 0), this._t('diff_lines_deleted'), diff.deletions ? 'bad' : '')}
          ${this._lastPush ? this._tile('mdi:cloud-check-outline', shEsc(this._lastPush.value), this._lastPush.label, '') : ''}
        </div>`
      : '';
    const list = files.length
      ? `<div class="d-side"><div class="d-lt">${shEsc(this._t('changed'))}</div>
          <div class="d-list" role="listbox" aria-label="${shEsc(this._t('changed'))}">${files.map((f, i) => this._fileItem(f, i)).join('')}${
            diff.more_files ? `<div class="d-more">${shEsc(this._t('diff_more_files', { n: this._fmt(diff.more_files) }))}</div>` : ''
          }</div></div>`
      : '';
    const commit = this._onCommit && files.length;
    const foot = commit
      ? `<label class="d-msg"><input id="message" placeholder="${shEsc(this._t('message'))}" aria-label="${shEsc(this._t('message'))}" value="${shEsc(this._message)}"></label>
        ${this._generate ? `<button class="d-btn" id="generate"${this._generating ? ' disabled' : ''}><ha-icon class="${this._generating ? 'spin' : ''}" icon="${this._generating ? 'mdi:loading' : 'mdi:creation-outline'}"></ha-icon><span>${shEsc(this._t('generate'))}</span></button>` : ''}
        <button class="d-btn primary" id="commit"><ha-icon icon="mdi:source-commit-end"></ha-icon><span>${shEsc(this._commitLabel)}</span></button>`
      : `<span class="grow"></span><button class="d-btn" id="close2"><ha-icon icon="mdi:close"></ha-icon><span>${shEsc(this._t('diff_close'))}</span></button>`;
    this.shadowRoot.innerHTML = `<style>${this._style}${this._css()}</style>
      <div class="d-backdrop"></div>
      <div class="d-dialog" role="dialog" aria-modal="true" aria-label="${shEsc(title)}">
        <div class="d-top">${banner}</div>
        ${tiles}
        <div class="d-body${files.length ? '' : ' alone'}">
          ${list}
          <div class="d-main" tabindex="0">${main}</div>
        </div>
        <div class="d-foot${commit ? ' commit' : ''}">${foot}</div>
      </div>`;
    this._bind();
  }

  _bind() {
    const root = this.shadowRoot;
    const on = (sel, fn) => root.querySelector(sel)?.addEventListener('click', fn);
    on('.d-backdrop', () => this.close());
    on('#close', () => this.close());
    on('#close2', () => this.close());
    root.querySelector('#message')?.addEventListener('input', (ev) => {
      this._message = ev.target.value;
    });
    on('#generate', async () => {
      if (this._generating) return;
      this._generating = true;
      this._render();
      try {
        const message = await this._generate();
        if (message) this._message = message;
      } finally {
        this._generating = false;
        if (this._open) {
          this._render();
          root.querySelector('#message')?.focus?.({ preventScroll: true });
        }
      }
    });
    on('#commit', () => {
      const cb = this._onCommit;
      const message = this._message;
      this.close();
      cb?.(message);
    });
    root.querySelector('.d-list')?.addEventListener('click', (ev) => {
      const item = ev.target?.closest?.('.d-file');
      if (item) this._select(Number(item.dataset.i));
    });
  }

  _css() {
    return `
      ha-icon { display:inline-flex; align-items:center; justify-content:center; flex:none; line-height:0; }
      :host { --sh-ok: var(--success-color, #43a047); --sh-warn: var(--warning-color, #ffa600);
              --sh-info: var(--info-color, #039be5); --sh-alert: var(--error-color, #db4437);
              --sh-off: var(--disabled-text-color, #9e9e9e); --sh-accent: var(--primary-color, #03a9f4);
              --sh-mono: var(--code-font-family, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
              --sh-bg: var(--card-background-color, var(--ha-card-background, #fff));
              --sh-sec: color-mix(in srgb, var(--primary-text-color) 6%, var(--sh-bg));
              --sh-line: var(--divider-color, rgba(127,127,127,.2)); }
      /* The banner's and the tiles' tones, as the panel's */
      .good { --tone: ${SH_TONE_HEX.good}; } .warn { --tone: ${SH_TONE_HEX.warn}; } .bad { --tone: ${SH_TONE_HEX.bad}; } .info { --tone: ${SH_TONE_HEX.info}; }
      .d-backdrop { position: fixed; inset: 0; z-index: 1000; background: rgba(0,0,0,.45); backdrop-filter: blur(2px); }
      /* Full screen on a phone; a large centred window elsewhere. */
      .d-dialog { position: fixed; inset: 0; z-index: 1001; display: flex; flex-direction: column; min-height: 0; overflow: hidden;
                  background: var(--sh-bg); color: var(--primary-text-color); font-family: var(--paper-font-body1_-_font-family, inherit); }
      @media (min-width: 900px) and (min-height: 600px) {
        .d-dialog { inset: 24px; max-width: 1280px; margin: 0 auto; border-radius: 16px; box-shadow: 0 12px 40px rgba(0,0,0,.35); }
      }
      .d-top { flex: none; }
      .shzooms { position: absolute; z-index: 2; top: 8px; right: 8px; display: flex; gap: 5px; }
      .shzoom { appearance: none; border: 0; padding: 0; cursor: pointer; width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center;
                --mdc-icon-size: 18px; color: #33506b; background: rgba(255,255,255,.62); box-shadow: inset 0 0 0 1px rgba(255,255,255,.7); }
      .shzoom:hover { background: rgba(255,255,255,.8); }
      .night .shzoom { color: #fff; background: rgba(255,255,255,.12); box-shadow: inset 0 0 0 1px rgba(255,255,255,.2); }
      .shzoom:focus-visible, .d-btn:focus-visible, .d-file:focus-visible { outline: 2px solid var(--sh-accent); outline-offset: 1px; }

      /* The counts: tiles of the charter, filled and rounded, their icon neutral unless it says something */
      .d-tiles { flex: none; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; padding: 12px 16px 0; }
      .d-tile { display: flex; align-items: center; gap: 10px; min-width: 0; min-height: 56px; box-sizing: border-box; padding: 8px 10px 8px 8px;
                border-radius: 12px; background: var(--sh-sec); }
      .d-av { flex: none; width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; --mdc-icon-size: 22px;
              color: var(--primary-text-color); background: color-mix(in srgb, var(--secondary-text-color) 14%, transparent); }
      .d-tile:is(.good, .warn, .bad) .d-av { color: color-mix(in srgb, var(--tone) 70%, var(--primary-text-color)); background: color-mix(in srgb, var(--tone) 18%, transparent); }
      .d-who { min-width: 0; display: flex; flex-direction: column; line-height: 1.25; }
      .d-who b { font-size: 20px; font-weight: 400; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .d-tile:is(.good, .warn, .bad) .d-who b { color: color-mix(in srgb, var(--tone) 70%, var(--primary-text-color)); }
      .d-who span { font-size: 12px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

      .d-body { flex: 1 1 auto; min-height: 0; display: flex; gap: 12px; padding: 12px 16px 0; }
      .d-body.alone .d-main { width: 100%; }
      /* Files: a column on the left; on a narrow screen, a row of chips above the diff. */
      .d-side { flex: none; width: 290px; min-height: 0; display: flex; flex-direction: column; gap: 6px; }
      .d-lt { flex: none; min-height: 24px; padding: 0 4px; display: flex; align-items: center; font-size: 12px; font-weight: 500;
              letter-spacing: .05em; text-transform: uppercase; color: var(--secondary-text-color); }
      .d-list { flex: 1 1 auto; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; }
      .d-file { display: flex; align-items: center; gap: 10px; width: 100%; min-width: 0; min-height: 52px; box-sizing: border-box; padding: 6px 10px 6px 7px;
                border: 1px solid transparent; border-radius: 12px; cursor: pointer; text-align: left; font: inherit; font-size: 13.5px;
                color: var(--primary-text-color); background: var(--sh-sec); }
      .d-file:hover { background: color-mix(in srgb, ${SH_TONE_HEX.warn} 8%, var(--sh-sec)); }
      .d-file.selected { background: color-mix(in srgb, ${SH_TONE_HEX.warn} 12%, var(--sh-sec)); border-color: color-mix(in srgb, ${SH_TONE_HEX.warn} 40%, transparent); }
      .d-st { flex: none; width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; font-family: var(--sh-mono);
              font-size: 12px; font-weight: 700; color: var(--c); background: color-mix(in srgb, var(--c) 18%, transparent); }
      .d-head .d-st { width: 28px; height: 28px; }
      .d-name { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; line-height: 17px; }
      .d-base { font-family: var(--sh-mono); font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .d-dir { font-size: 12px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; direction: rtl; text-align: left; }
      .d-counts { flex: none; display: inline-flex; gap: 6px; font-family: var(--sh-mono); font-size: 12px; }
      .d-add { color: var(--sh-ok); }
      .d-del { color: var(--sh-alert); }
      .d-more { padding: 8px; font-size: 12px; color: var(--secondary-text-color); }

      /* The selected file's diff, in a filled panel: its header strip, then the code on the card's background */
      .d-main { flex: 1 1 auto; min-width: 0; overflow: auto; outline: none; border-radius: 12px; background: var(--sh-sec); }
      .d-head { position: sticky; top: 0; z-index: 1; display: flex; align-items: center; gap: 10px; padding: 8px 12px 8px 8px; font-size: 13px;
                background: color-mix(in srgb, var(--primary-text-color) 9%, var(--sh-bg)); }
      .d-code { margin: 0 1px 1px; border-radius: 0 0 11px 11px; background: var(--sh-bg); min-height: calc(100% - 46px); }
      .d-path { flex: 1 1 auto; min-width: 0; display: flex; align-items: center; gap: 6px; font-family: var(--sh-mono); font-size: 13px;
                white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .d-path ha-icon { --mdc-icon-size: 14px; color: var(--secondary-text-color); }
      .d-old { color: var(--secondary-text-color); }
      .d-note { display: flex; align-items: center; gap: 8px; padding: 16px; font-size: 13px; color: var(--secondary-text-color); }
      .d-note.d-center { justify-content: center; padding: 48px 16px; }
      .d-note.d-error { color: var(--sh-alert); }
      .d-note ha-icon { --mdc-icon-size: 20px; }
      .spin { animation: sh-spin 1s linear infinite; }

      /* The diff itself: old and new line numbers, sign, text; additions tinted green, deletions red. */
      .d-table { width: 100%; border-collapse: collapse; font-family: var(--sh-mono); font-size: 12.5px; line-height: 21px; tab-size: 4; }
      .d-table td { padding: 0 8px; vertical-align: top; white-space: pre; }
      .d-table .ln { width: 1%; min-width: 3.5ch; text-align: right; color: var(--secondary-text-color); opacity: .8; user-select: none; }
      .d-table .sg { width: 1%; padding: 0 4px; user-select: none; }
      .d-table .tx { white-space: pre-wrap; word-break: break-all; }
      .d-table tr.add td { background: color-mix(in srgb, var(--sh-ok) 12%, transparent); }
      .d-table tr.add .ln, .d-table tr.add .sg { color: var(--sh-ok); opacity: 1; }
      .d-table tr.del td { background: color-mix(in srgb, var(--sh-alert) 11%, transparent); }
      .d-table tr.del .ln, .d-table tr.del .sg { color: var(--sh-alert); opacity: 1; }
      .d-table tr.hunk td { color: var(--sh-info); background: color-mix(in srgb, var(--sh-info) 7%, transparent); }

      /* The commit: the message as a filled pill field, Write with AI, Commit and push (pill buttons, none filled) */
      .d-foot { flex: none; display: flex; align-items: center; gap: 8px; padding: 12px 16px 16px; }
      .d-foot .grow { flex: 1; }
      .d-msg { flex: 1 1 auto; min-width: 0; display: flex; }
      .d-msg input { flex: 1; min-width: 0; min-height: 40px; box-sizing: border-box; padding: 0 18px; border: 1px solid transparent; border-radius: 20px;
                     font: inherit; font-size: 14px; color: var(--primary-text-color); background: var(--sh-sec); outline: none; }
      .d-msg input:focus { border-color: color-mix(in srgb, var(--sh-accent) 55%, transparent); }
      .d-btn { flex: none; display: inline-flex; align-items: center; gap: 7px; min-height: 40px; padding: 0 16px; border: 0; border-radius: 20px; cursor: pointer;
               font: inherit; font-size: 14px; font-weight: 500; color: var(--primary-text-color); background: var(--sh-sec); white-space: nowrap; }
      .d-btn:hover { background: color-mix(in srgb, var(--sh-accent) 10%, var(--sh-sec)); }
      .d-btn[disabled] { cursor: default; opacity: .7; }
      .d-btn.primary { color: color-mix(in srgb, var(--sh-accent) 75%, var(--primary-text-color)); background: color-mix(in srgb, var(--sh-accent) 16%, transparent); }
      .d-btn.primary:hover { background: color-mix(in srgb, var(--sh-accent) 24%, transparent); }
      .d-btn ha-icon { --mdc-icon-size: 18px; }

      @media (max-width: 719px) {
        .d-tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); padding: 10px 12px 0; }
        .d-body { flex-direction: column; gap: 10px; padding: 10px 12px 0; }
        .d-side { width: auto; flex: none; }
        .d-lt { display: none; }
        .d-list { flex-direction: row; flex-wrap: nowrap; overflow-x: auto; overflow-y: hidden; }
        .d-file { width: auto; flex: none; max-width: 220px; min-height: 40px; padding: 4px 12px 4px 4px; }
        .d-file .d-st { width: 28px; height: 28px; }
        .d-dir, .d-file .d-counts { display: none; }
        .d-more { white-space: nowrap; align-self: center; }
        .d-foot { padding: 12px; }
        .d-foot.commit { flex-wrap: wrap; }
        .d-foot.commit .d-msg { flex-basis: calc(100% - 48px); }
        .d-foot.commit #generate { width: 40px; padding: 0; justify-content: center; }
        .d-foot.commit #generate span { display: none; }
        .d-foot.commit #commit { flex: 1 1 100%; justify-content: center; }
      }
      @keyframes sh-spin { to { transform: rotate(360deg); } }
      @media (prefers-reduced-motion: reduce) { .spin { animation: none; } }
    `;
  }
}

// Interfaces left out of the network figures: loopback, containers, bridges, tunnels and VPNs (as the old card did)
var SH_VIRTUAL_IF = /^(lo|docker\d*|hassio|veth.*|br-.*|virbr\d*|tun\d*|tap\d*|wg\d*|vlan.*|dummy\d*|tailscale.*)$/;
// The System tab's thresholds (orange, red) when the integration sends none: Configure → System: thresholds
var SH_THRESHOLDS = { cpu: [70, 90], ram: [70, 90], disk: [80, 90], temperature: [70, 85], swap: [50, 80] };

// One colour per kind of data, the same in the rings, the charts and their legends
var SH_COLORS = {
  cpu: '#03a9f4',
  ram: '#8e24aa',
  temp: '#ff7043',
  download: '#43a047',
  upload: '#1e88e5',
  disks: ['#00897b', '#5c6bc0', '#f4511e', '#6d4c41', '#c0ca33'],
};
var SH_BUCKETS = 120;

// [[ms, value]] → `n` averages over [start, end]; a bucket without a reading keeps the last value known before it
function shBuckets(points, start, end, n) {
  var sums = new Array(n).fill(0);
  var counts = new Array(n).fill(0);
  var before = null;
  var step = (end - start) / n;
  (points || []).forEach(([t, v]) => {
    if (v === null || v === undefined || Number.isNaN(v)) return;
    if (t < start) {
      before = v;
      return;
    }
    var i = Math.min(n - 1, Math.floor((t - start) / step));
    sums[i] += v;
    counts[i] += 1;
  });
  var last = before;
  return sums.map((sum, i) => {
    if (counts[i]) last = sum / counts[i];
    return last;
  });
}

// The polyline points of a series, split where it has no value
function shPoints(values, w, h, max) {
  var segs = [];
  var cur = [];
  var step = values.length > 1 ? w / (values.length - 1) : w;
  values.forEach((v, i) => {
    if (v === null || v === undefined) {
      if (cur.length) segs.push(cur);
      cur = [];
      return;
    }
    var y = h - (Math.min(Math.max(v, 0), max) / max) * h;
    cur.push(`${(i * step).toFixed(1)},${y.toFixed(1)}`);
  });
  if (cur.length) segs.push(cur);
  return segs.filter((seg) => seg.length > 1);
}

// The last 24 hours behind a ring: an area at 12 % and its line at 50 %, on a 0-100 scale
function shArea(values, max) {
  return shPoints(values, 100, 30, max)
    .map((seg) => `<svg class="behind" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
      <polygon points="${seg[0].split(',')[0]},30 ${seg.join(' ')} ${seg[seg.length - 1].split(',')[0]},30"/><polyline points="${seg.join(' ')}"/></svg>`)
    .join('');
}

// A round top for a rate axis: 1, 2 or 5 times a power of ten
function shNiceMax(values) {
  var top = Math.max(0, ...values.filter((v) => v !== null && v !== undefined));
  if (!top) return 1;
  var p = 10 ** Math.floor(Math.log10(top));
  return [1, 2, 5, 10].map((m) => m * p).find((m) => m >= top);
}

function shRate(v) {
  return v < 10 ? Number(v.toFixed(1)).toString() : String(Math.round(v));
}

function shRound(n) {
  return Number.isInteger(n) ? n : Number(n.toFixed(1));
}

// "Disk usage /media" → "/media"; "Network throughput in eth0" → "eth0"
function shMount(sensor) {
  var m = String(sensor.name || '').match(/(\/\S*)\s*$/);
  return m ? m[1] : sensor.name;
}

// "System Monitor Process python3" → "python3"
function shProcess(sensor) {
  var name = String(sensor.name || '');
  var i = name.toLowerCase().lastIndexOf('process ');
  return i < 0 ? name : name.slice(i + 8);
}

function shIface(sensor) {
  return String(sensor.name || '').split(' ').pop();
}

// Orphans tab: its styles (its methods are added to the panel at the end of the file)
var SH_ORPHANS_STYLE = `
    .tile.pick { cursor:pointer; }
    .tile.pick.on { box-shadow:inset 0 0 0 2px var(--tone, var(--primary-color)); }
    .ofilters { display:flex; flex-wrap:wrap; gap:8px; align-items:center; padding:4px 14px 10px; }
    .ofilters select { font:inherit; font-size:14px; padding:8px 10px; border-radius:8px; color:inherit; max-width:100%;
                       border:1px solid var(--divider-color, rgba(127,127,127,.3)); background:var(--secondary-background-color, rgba(127,127,127,.08)); }
    .obar { display:flex; flex-wrap:wrap; gap:8px; align-items:center; padding:4px 14px 8px; font-size:13px; color:var(--secondary-text-color); }
    .orow { align-items:flex-start; border-top:1px solid var(--divider-color, rgba(127,127,127,.15)); }
    .orow.on { background:color-mix(in srgb, var(--primary-color) 7%, transparent); }
    .orow > ha-icon { margin-top:2px; }
    .orow input[type=checkbox] { flex:none; width:18px; height:18px; margin:4px 0 0; accent-color:var(--primary-color); cursor:pointer; }
    .orow .who .s { white-space:normal; overflow-wrap:anywhere; }
    .uses { display:flex; flex-wrap:wrap; gap:4px 6px; margin-top:6px; align-items:center; font-size:12px; color:var(--secondary-text-color); }
    .use { display:inline-flex; align-items:center; gap:4px; padding:2px 8px; border-radius:10px; font-size:12px; --mdc-icon-size:14px;
           color:var(--primary-text-color); text-decoration:none; background:var(--secondary-background-color, rgba(127,127,127,.12)); }
    a.use:hover { color:var(--primary-color); }
    .orow .confirm { margin:0 14px 10px; }
    .omore { padding:8px 14px 12px; }
    @media (max-width: 600px) {
      .ofilters .box { min-width:0; flex-basis:100%; }
      .orow .pill { display:none; }
    }
  `;

// ── Folded top bar ──
// As on the dashboards' illustrated headers (ha-dashboard-header): past 24 px of scroll the 90 px top bar and the
// text tabs fold into one 64 px bar — the panel's icon, title and line, the tabs as round icon pills, the status pill
// and the round buttons — sticky at the top; back under 8 px they unfold. The content does not move: the folded bar
// keeps the room of the top bar and tabs under it. On a narrow panel the pills get a row of their own under the bar,
// the status pill turns to a dot and only the first round button is kept. The folded bar mirrors the top bar and the
// tabs (their text, counts, active tab and buttons): a click on a pill or a button clicks the original.
const systemHubPanel_FOLD_CSS = `
  .pf-sense { position:relative; height:0; }
  .pf-sense, .pf-fold, .pf-top, .pf-tabs { overflow-anchor:none; }
  .pf-sense > i { position:absolute; left:0; width:1px; height:1px; pointer-events:none; visibility:hidden; }
  .pf-sense > .pf-s1 { top:24px; } .pf-sense > .pf-s2 { top:8px; }
  .pf-fold { display:none; position:sticky; top:0; z-index:6; container-type:inline-size; color:var(--primary-text-color);
             background:var(--card-background-color, #fff); border-bottom:1px solid var(--divider-color, rgba(0,0,0,.12));
             box-shadow:0 2px 8px rgba(0,0,0,.08); }
  :host([pf-folded]) .pf-fold { display:block; }
  .pf-fold.pf-measure { display:block; position:absolute; visibility:hidden; }
  :host([pf-folded]) .pf-top, :host([pf-folded]) .pf-tabs { display:none !important; }
  .pf-bar { display:flex; flex-wrap:wrap; align-items:center; column-gap:12px; min-height:64px; padding:0 16px; box-sizing:border-box; }
  .pf-menu { flex:none; display:flex; margin-inline:-8px -4px; color:var(--primary-text-color); }
  .pf-menu[hidden] { display:none; }
  .pf-ic { flex:none; width:40px; height:40px; border-radius:50%; display:grid; place-items:center; color:var(--pf-accent);
           background:color-mix(in srgb, currentColor 14%, transparent); }
  .pf-ic svg, .pf-ic img { width:22px; height:22px; fill:currentColor; }
  .pf-ic ha-icon, .pf-ic ha-svg-icon { --mdc-icon-size:22px; }
  .pf-names { display:flex; flex-direction:column; flex:0 1 auto; min-width:0; max-width:260px; }
  .pf-t { font-size:17px; font-weight:700; line-height:1.2; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .pf-s { font-size:12.5px; line-height:1.3; color:var(--secondary-text-color); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .pf-s:empty { display:none; }
  .pf-pills { display:flex; gap:6px; flex:1 1 0; min-width:0; overflow-x:auto; scrollbar-width:none; padding:8px 6px 6px 2px; }
  .pf-pills::-webkit-scrollbar { display:none; }
  .pf-pill { all:unset; position:relative; flex:none; width:48px; height:40px; box-sizing:border-box; border-radius:999px; cursor:pointer;
             display:grid; place-items:center; color:var(--primary-text-color); border:1px solid var(--divider-color, rgba(0,0,0,.12)); }
  .pf-pill:hover { background:color-mix(in srgb, currentColor 6%, transparent); }
  .pf-pill[aria-selected="true"] { color:var(--pf-accent); border:1.5px solid var(--pf-accent); background:color-mix(in srgb, var(--pf-accent) 14%, transparent); }
  .pf-pill:focus-visible { outline:2px solid var(--pf-accent); outline-offset:2px; }
  .pf-pill svg { width:20px; height:20px; fill:currentColor; flex:none; }
  .pf-pill ha-icon { --mdc-icon-size:20px; display:flex; }
  .pf-pill .pf-l { font-size:14px; font-weight:700; }
  .pf-pill b { position:absolute; top:-5px; right:-5px; min-width:18px; height:18px; padding:0 4px; box-sizing:border-box; border-radius:999px;
               font-size:11px; font-weight:700; line-height:14px; text-align:center; color:#fff; background:var(--pf-accent);
               border:2px solid var(--card-background-color, #fff); }
  .pf-end { display:flex; align-items:center; gap:8px; flex:0 1 auto; min-width:0; margin-inline-start:auto; }
  .pf-end > :not(.pf-stat):not(.pf-acts) { min-width:0; max-width:220px; }
  .pf-stat { display:inline-flex; align-items:center; gap:6px; padding:5px 11px; border-radius:999px; font-size:12px; font-weight:600;
             white-space:nowrap; color:var(--pf-c); background:color-mix(in srgb, var(--pf-c) 14%, transparent); }
  .pf-stat > i { width:8px; height:8px; border-radius:50%; background:currentColor; flex:none; }
  .pf-stat:empty, .pf-stat[hidden] { display:none; }
  .pf-acts { display:flex; gap:8px; }
  .pf-acts > * { all:unset; box-sizing:border-box; cursor:pointer; width:40px; height:40px; border-radius:50%; display:grid; place-items:center;
                 color:var(--primary-text-color); border:1px solid var(--divider-color, rgba(0,0,0,.12)); }
  .pf-acts > *:hover { background:color-mix(in srgb, currentColor 6%, transparent); }
  .pf-acts > *:focus-visible { outline:2px solid var(--pf-accent); outline-offset:2px; }
  .pf-acts > *[disabled] { opacity:.6; cursor:default; }
  .pf-acts svg { width:20px; height:20px; fill:currentColor; }
  .pf-acts > .on { color:var(--pf-on, var(--pf-accent)); border:1.5px solid currentColor; background:color-mix(in srgb, currentColor 14%, transparent); }
  .pf-acts ha-icon { --mdc-icon-size:20px; display:flex; }
  .pf-acts .spin svg, .pf-acts .spinning svg { animation:pf-spin 1s linear infinite; }
  @keyframes pf-spin { to { transform:rotate(360deg); } }
  .pf-extra:empty { display:none; }
  .pf-subs { position:absolute; left:0; right:0; top:100%; display:flex; gap:4px; padding:0 12px; overflow-x:auto; scrollbar-width:none;
             background:var(--card-background-color, #fff); border-bottom:1px solid var(--divider-color, rgba(0,0,0,.12));
             box-shadow:0 2px 8px rgba(0,0,0,.08); }
  .pf-subs[hidden] { display:none; }
  .pf-subs::-webkit-scrollbar { display:none; }
  .pf-sub { all:unset; flex:none; display:inline-flex; align-items:center; gap:6px; padding:9px 10px 7px; cursor:pointer; font-size:13px;
            font-weight:500; color:var(--secondary-text-color); border-bottom:2px solid transparent; white-space:nowrap; --mdc-icon-size:18px; }
  .pf-sub:hover { color:var(--primary-text-color); }
  .pf-sub[aria-selected="true"] { color:var(--primary-text-color); border-bottom-color:var(--pf-accent); }
  .pf-sub[aria-selected="true"] ha-icon { color:var(--pf-accent); }
  .pf-sub:focus-visible { outline:2px solid var(--pf-accent); outline-offset:-2px; }
  @container (max-width: 600px) {
    .pf-bar { min-height:0; padding:12px 12px 0 16px; column-gap:10px; row-gap:2px; }
    .pf-names { flex:1 1 0; max-width:none; }
    .pf-t { font-size:17px; }
    .pf-pills { order:9; flex:1 0 100%; margin:0 -12px 0 -16px; padding:6px 12px 10px; }
    .pf-stat { width:26px; height:26px; padding:0; justify-content:center; }
    .pf-stat > span { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; }
    .pf-acts > *:not(:first-child) { display:none; }
    .pf-end > :not(.pf-stat):not(.pf-acts) { max-width:120px; }
    .pf-amenu .pf-acts > *, .pf-amenu .pf-acts > *:not(:first-child) { display:none; }
    .pf-amenu .pf-acts > .on { display:grid; position:relative; }
    .pf-amenu .pf-acts > .on::after { content:""; position:absolute; right:-3px; bottom:-3px; width:14px; height:14px; border-radius:50%;
      background:var(--card-background-color, #fff) no-repeat center / 12px
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23888' d='M7 10l5 5 5-5z'/%3E%3C/svg%3E");
      box-shadow:0 0 0 1px var(--divider-color, rgba(0,0,0,.12)); }
    .pf-amenu.pf-open .pf-acts { position:absolute; z-index:3; right:8px; top:8px; flex-direction:column; padding:6px; border-radius:26px;
      background:var(--card-background-color, #fff); box-shadow:0 6px 18px rgba(0,0,0,.18); }
    .pf-amenu.pf-open .pf-acts > * { display:grid; }
    .pf-amenu.pf-open .pf-acts > .on::after { display:none; }
  }
`;

/**
 * Folds the panel's top bar on scroll. `o`: `top` and `tabs` (the top bar and the tab row), `tab` (a tab, in the
 * row), `key` (a tab's id, from the button), `icons` (id → SVG path), `badge` (a tab's count, in it), `name`, `sub`,
 * `icon`, `status` (in the top bar), `acts` (its round buttons), `accent` (CSS colour), `extra` (an element shown
 * under the bar when folded, such as a sub-tab row: moved there while folded), `side` (an element moved before the
 * status pill while folded, such as an account picker), `subtab` (the sub-tabs of the tab shown, in the page:
 * mirrored in a row under the folded bar), `mount` (the node the folded bar goes before, when not the top bar), `menu` (() => ({ hass, narrow,
 * show })) for Home Assistant's menu button, `css` (the panel's own rules while folded; the folded bar's height is
 * `--pf-h` on the panel), `actsMenu` (narrow: only the active button `.on`, which opens the others, such as alarm
 * modes), `folded` (start folded: the page was drawn again while folded), `badgeColors` (the counts take the colours of the tabs' own badges), `skip` (() => true while the top bar must not fold). Returns { sync, detach }, or null when the panel has no top bar.
 */
function systemHubPanelFold(host, o) {
  const root = host.shadowRoot;
  const q = (sel) => (sel ? root?.querySelector?.(sel) : null);
  const top = q(o.top);
  const tabs = q(o.tabs);
  host.removeAttribute?.("pf-folded");
  if (!root || !top || !tabs || typeof root.querySelector !== "function") return null;
  if (!root.getElementById?.("pf-style")) {
    const style = document.createElement("style");
    style.id = "pf-style";
    style.textContent = systemHubPanel_FOLD_CSS + (o.css || "");
    root.appendChild(style);
  }
  top.classList.add("pf-top");
  tabs.classList.add("pf-tabs");
  const sense = document.createElement("div");
  sense.className = "pf-sense";
  sense.setAttribute("aria-hidden", "true");
  sense.innerHTML = '<i class="pf-s1"></i><i class="pf-s2"></i>';
  const fold = document.createElement("div");
  fold.className = "pf-fold";
  fold.style.setProperty("--pf-accent", o.accent);
  if (o.actsMenu) fold.classList.add("pf-amenu");
  fold.innerHTML = `<div class="pf-bar"><span class="pf-menu" hidden></span><span class="pf-ic" aria-hidden="true"></span>
    <div class="pf-names"><span class="pf-t"></span><span class="pf-s"></span></div>
    <div class="pf-pills" role="tablist"></div>
    <div class="pf-end"><span class="pf-stat" role="status"></span><div class="pf-acts"></div></div></div><div class="pf-extra"></div><div class="pf-subs" role="tablist" hidden></div>`;
  const at = o.mount || top;
  at.parentNode.insertBefore(sense, at);
  at.parentNode.insertBefore(fold, at);
  const el = (c) => fold.querySelector(c);
  // Home Assistant's menu button, in a shadow root of its own: the panel's own look-ups of its menu button never
  // find this one
  const menuBtn = document.createElement("ha-menu-button");
  el(".pf-menu").attachShadow?.({ mode: "open" })?.append(menuBtn);
  // A copy keeps the icons of its ha-icon elements, which panels often set as a property (not copied by cloneNode)
  const copyIcons = (from, to) => {
    const a = from.matches?.("ha-icon") ? [from] : [...from.querySelectorAll("ha-icon")];
    const b = to.matches?.("ha-icon") ? [to] : [...to.querySelectorAll("ha-icon")];
    a.forEach((n, i) => {
      const icon = n.icon || n.getAttribute("icon");
      if (b[i] && icon) b[i].setAttribute("icon", icon);
    });
  };
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
  let folded = false;
  let queued = false;
  let extraHome = null;
  let sideHome = null;

  const tabButtons = () => [...tabs.querySelectorAll(o.tab)];
  const tabLabel = (b) => {
    const clone = b.cloneNode(true);
    for (const n of clone.querySelectorAll?.(`${o.badge || ".badge"}, ha-menu-button, svg`) || []) n.remove();
    return (b.getAttribute("aria-label") || clone.textContent || "").trim();
  };
  const isActive = (b) => b.classList.contains("active") || b.getAttribute("aria-selected") === "true";

  const sync = () => {
    queued = false;
    if (!folded) return;
    const iconBox = q(o.icon);
    const icon = iconBox?.querySelector("svg, ha-icon, ha-svg-icon, img");
    const iconCopy = icon?.cloneNode(true);
    if (iconCopy) copyIcons(icon, iconCopy);
    el(".pf-ic").replaceChildren(...(iconCopy ? [iconCopy] : []));
    // The icon keeps the colour of its state, as in the top bar
    el(".pf-ic").style.color = iconBox && !o.iconAccent ? getComputedStyle(iconBox).color : "";
    el(".pf-t").textContent = (q(o.name)?.textContent || "").trim();
    el(".pf-s").textContent = (q(o.sub)?.textContent || "").trim();
    const st = q(o.status);
    const stat = el(".pf-stat");
    const text = (st?.textContent || "").trim();
    stat.hidden = !text;
    if (text) {
      stat.style.setProperty("--pf-c", getComputedStyle(st).color || "var(--pf-accent)");
      stat.setAttribute("aria-label", text);
      stat.innerHTML = `<i></i><span>${esc(text)}</span>`;
    }
    const focused = root.activeElement?.closest?.(".pf-pill")?.dataset.i;
    const shown = tabs.hidden ? [] : tabButtons();
    el(".pf-pills").innerHTML = (shown.length > 1 ? shown : [])
      .map((b, i) => {
        const id = o.key(b);
        const label = tabLabel(b);
        const badgeEl = b.querySelector(o.badge || ".badge");
        const count = (badgeEl?.textContent || "").trim();
        // The count in the colour of its tab's own badge (its tone), where the panel colours them
        let tone = "";
        if (count && o.badgeColors) {
          const cs = getComputedStyle(badgeEl);
          tone = ` style="background:${cs.backgroundColor};color:${cs.color}"`;
        }
        const path = o.icons[id];
        const own = path ? null : b.querySelector("svg, ha-icon");
        const ownIcon = own?.localName === "ha-icon" ? own.icon || own.getAttribute("icon") : null;
        const glyph = !path
          ? own
            ? ownIcon
              ? `<ha-icon icon="${esc(ownIcon)}" aria-hidden="true"></ha-icon>`
              : own.outerHTML
            : `<span class="pf-l" aria-hidden="true">${esc(label.slice(0, 1))}</span>`
          : path.startsWith("mdi:")
            ? `<ha-icon icon="${esc(path)}" aria-hidden="true"></ha-icon>`
            : `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;
        const on = isActive(b);
        return `<button class="pf-pill" role="tab" data-i="${i}" aria-selected="${on}" tabindex="${on ? 0 : -1}" title="${esc(label)}" aria-label="${esc(count ? `${label} (${count})` : label)}">${glyph}${count ? `<b aria-hidden="true"${tone}>${esc(count)}</b>` : ""}</button>`;
      })
      .join("");
    if (focused !== undefined) el(`.pf-pill[data-i="${focused}"]`)?.focus({ preventScroll: true });
    // The active pill in sight in a scrolling row, without scrolling the page
    const row = el(".pf-pills");
    const act = el(".pf-pill[aria-selected=true]");
    if (act && (act.offsetLeft < row.scrollLeft || act.offsetLeft + act.offsetWidth > row.scrollLeft + row.clientWidth)) {
      row.scrollLeft = Math.max(0, act.offsetLeft - 16);
    }
    // The sub-tabs of the tab shown (in the page, under the top bar), mirrored in a row under the folded bar
    const subs = o.subtab ? [...root.querySelectorAll(o.subtab)].filter((b) => !fold.contains(b)) : [];
    const subRow = el(".pf-subs");
    subRow.hidden = subs.length < 2;
    subRow.innerHTML = subs.length < 2 ? "" : subs
      .map((b, i) => {
        const on = isActive(b);
        const hi = b.querySelector("ha-icon");
        const ic = hi && (hi.icon || hi.getAttribute("icon"));
        return `<button class="pf-sub" role="tab" data-s="${i}" aria-selected="${on}" tabindex="${on ? 0 : -1}">${ic ? `<ha-icon icon="${esc(ic)}" aria-hidden="true"></ha-icon>` : ""}${esc(tabLabel(b))}</button>`;
      })
      .join("");
    subRow.onclick = (ev) => {
      const sb = ev.target.closest?.(".pf-sub");
      if (sb) subs[Number(sb.dataset.s)]?.click();
    };
    const acts = el(".pf-acts");
    acts.textContent = "";
    for (const a of o.acts ? root.querySelectorAll(o.acts) : []) {
      if (a.offsetParent === null && !top.contains(a)) continue;
      const c = a.cloneNode(true);
      copyIcons(a, c);
      c.removeAttribute("id");
      // An active button (`.on`) keeps the colour of its state
      if (c.classList.contains("on")) c.style.setProperty("--pf-on", getComputedStyle(a).color);
      if (c.tagName !== "A") {
        // The panel's own click handlers see the original only (its data-* stay off the copy)
        for (const n of [c, ...c.querySelectorAll("*")]) for (const at of [...n.attributes]) if (at.name.startsWith("data-")) n.removeAttribute(at.name);
        c.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          // Narrow, with `actsMenu`: the active button opens the list of the others first
          if (o.actsMenu && fold.clientWidth <= 600 && (!fold.classList.contains("pf-open") || c.classList.contains("on"))) {
            fold.classList.toggle("pf-open");
            return;
          }
          fold.classList.remove("pf-open");
          a.click();
        });
      }
      acts.appendChild(c);
    }
    const m = o.menu?.();
    el(".pf-menu").hidden = !m?.show;
    if (m) {
      menuBtn.hass = m.hass;
      menuBtn.narrow = m.narrow;
    }
  };
  const queue = () => {
    if (queued || !folded) return;
    queued = true;
    requestAnimationFrame(sync);
  };

  const setFolded = (v) => {
    if (v === folded) return;
    if (v) {
      const t = top.getBoundingClientRect();
      const b = tabs.getBoundingClientRect();
      if (!t.height || o.skip?.()) return; // top bar hidden (Settings): the tabs alone stay sticky
      const extra = q(o.extra);
      // The room of the top bar and the tabs (and an extra row), by their heights: the tabs may be stuck at the top
      // already (a jump down the page), where their position says nothing of the room they take in the page
      const room = t.height + b.height + (extra ? extra.getBoundingClientRect().height : 0);
      folded = true;
      sync();
      if (extra) {
        extraHome = [extra.parentNode, extra.nextSibling];
        el(".pf-extra").appendChild(extra);
      }
      const side = q(o.side);
      if (side) {
        sideHome = [side.parentNode, side.nextSibling];
        el(".pf-end").prepend(side);
      }
      // Measured out of the flow first, so that the content never moves (nor the browser's scroll anchoring with it)
      fold.style.width = `${t.width}px`;
      fold.classList.add("pf-measure");
      const h = fold.offsetHeight;
      fold.classList.remove("pf-measure");
      fold.style.width = "";
      fold.style.marginBottom = `${Math.round(room - h)}px`;
      host.style.setProperty("--pf-h", `${h}px`);
      host.setAttribute("pf-folded", "");
    } else {
      folded = false;
      const extra = el(".pf-extra").firstElementChild;
      if (extra && extraHome) extraHome[0].insertBefore(extra, extraHome[1] && extraHome[1].parentNode === extraHome[0] ? extraHome[1] : null);
      extraHome = null;
      const side = sideHome && el(".pf-end").firstElementChild;
      if (side && !side.matches(".pf-stat")) sideHome[0].insertBefore(side, sideHome[1] && sideHome[1].parentNode === sideHome[0] ? sideHome[1] : null);
      sideHome = null;
      host.removeAttribute("pf-folded");
      fold.style.marginBottom = "";
    }
  };

  el(".pf-pills").addEventListener("click", (ev) => {
    const p = ev.target.closest?.(".pf-pill");
    if (p) tabButtons()[Number(p.dataset.i)]?.click();
  });
  el(".pf-pills").addEventListener("keydown", (ev) => {
    const step = ev.key === "ArrowRight" ? 1 : ev.key === "ArrowLeft" ? -1 : 0;
    const p = ev.target.closest?.(".pf-pill");
    if (!step || !p) return;
    ev.preventDefault();
    const all = [...el(".pf-pills").children];
    all[(Number(p.dataset.i) + step + all.length) % all.length]?.focus();
  });

  // The list of buttons opened (narrow, `actsMenu`) closes at a click elsewhere
  const closeMenu = (ev) => {
    if (fold.classList.contains("pf-open") && !ev.composedPath().includes(el(".pf-acts"))) fold.classList.remove("pf-open");
  };
  if (o.actsMenu) root.addEventListener("click", closeMenu, true);
  let io = null;
  if (typeof IntersectionObserver === "function") {
    const [s1, s2] = sense.children;
    io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const above = !e.isIntersecting && e.boundingClientRect.top < (e.rootBounds?.top ?? 0);
        if (e.target === s1 && above) setFolded(true);
        if (e.target === s2 && e.isIntersecting) setFolded(false);
      }
    });
    io.observe(s1);
    io.observe(s2);
  }
  const mo = typeof MutationObserver === "function" ? new MutationObserver(queue) : null;
  mo?.observe(top, { subtree: true, childList: true, characterData: true, attributes: true });
  mo?.observe(tabs, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["class", "aria-selected", "hidden"] });
  // Drawn again while folded (a panel that rewrites its page): folded straight away, without a frame unfolded
  if (o.folded) setFolded(true);
  return {
    sync: queue,
    detach() {
      root.removeEventListener?.("click", closeMenu, true);
      io?.disconnect();
      mo?.disconnect();
      setFolded(false);
      sense.remove();
      fold.remove();
      host.removeAttribute("pf-folded");
    },
  };
}
// ── End of the folded top bar ──

class SystemHubPanel extends HTMLElement {
  static VERSION = SYSTEM_HUB_PANEL_VERSION;

  static STYLE = `
    :host { display:block; min-height:100%; background:var(--primary-background-color); color:var(--primary-text-color);
            --tone-good: var(--success-color, #43a047); --tone-warn: var(--warning-color, #ffa600); --tone-bad: var(--error-color, #db4437); }
    /* The top bar: the tab's illustrated banner, full width, the menu button before its icon */
    .topbar:empty { display:none; }
    .topbar .shhead { padding-left:4px; gap:6px; right:calc(min(360px, 44%) + var(--acts) + 8px); }
    .topbar .bmenu { flex:none; color:inherit; }
    /* As the other ha-* panels: a neutral wall and the wooden floor (the status is the badge's and the pill's), the
       title at 20 px, the buttons as frosted rounds at the right, centred on the wall, the scene left of them */
    .topbar .shbanner { --acts:96px; background:#f2efe9; }
    .topbar .shbanner.night { background:#2a2b33; }
    .topbar .shbanner:has(.shzooms > :nth-child(3)) { --acts:136px; }
    .topbar .shground { background:repeating-linear-gradient(90deg, #c99a6b 0 38px, #b98a5c 38px 40px); box-shadow:inset 0 2px 0 #a97c50; }
    .topbar .night .shground { background:repeating-linear-gradient(90deg, #4a3a2c 0 38px, #3e3024 38px 40px); box-shadow:inset 0 2px 0 #5a4634; }
    .topbar .shscene { right:var(--acts); }
    .topbar .shtitle { font-size:20px; }
    .topbar .shzooms { top:calc((100% - 10px) / 2 - 17px); right:12px; gap:6px; }
    .topbar .shzoom { width:34px; height:34px; --mdc-icon-size:20px; }
    .topbar .shzoom:hover { background:rgba(255,255,255,.82); }
    @container (max-width:560px) { .topbar .shscene { display:none; } .topbar .shhead { right:var(--acts); } }
    /* The tabs under it, on the page's background */
    .tabsbar { display:flex; background:var(--primary-background-color); color:var(--primary-text-color); position:sticky; top:0; z-index:2;
               border-bottom:1px solid var(--divider-color, rgba(127,127,127,.2)); }
    .tabs { flex:1; min-width:0; display:flex; gap:4px; padding:0 12px; overflow-x:auto; }
    /* Settings → Hide the top bar: the tabs at the top; on a phone, the menu button beside them */
    .tabmenu { display:none !important; }
    :host([hide-bar]) .topbar { display:none; }
    :host([hide-bar][narrow]) .tabmenu { display:flex !important; align-self:center; margin-left:4px; }
    :host([hide-bar][narrow]) .tabs { padding-left:0; }
    .tab { background:none; border:none; border-bottom:2px solid transparent; color:var(--secondary-text-color);
           padding:12px 14px; font:inherit; font-size:14px; font-weight:500; cursor:pointer; white-space:nowrap; }
    .tab:hover, .tab:focus-visible { color:var(--primary-text-color); outline:none; }
    .tab.active { color:var(--primary-text-color); border-bottom-color:var(--primary-color); }
    .tbadge { display:inline-flex; align-items:center; justify-content:center; min-width:18px; height:18px; padding:0 6px; margin-left:6px;
              box-sizing:border-box; border-radius:9px; font-size:11px; font-weight:500; line-height:1;
              color:color-mix(in srgb, var(--tone-warn) 70%, var(--primary-text-color)); background:color-mix(in srgb, var(--tone-warn) 20%, transparent); }
    .tbadge.bad { color:var(--tone-bad); background:color-mix(in srgb, var(--tone-bad) 15%, transparent); }
    .tbadge.info { color:var(--info-color, #039be5); background:color-mix(in srgb, var(--info-color, #039be5) 15%, transparent); }
    .subtabs { display:flex; flex-wrap:wrap; gap:8px; }
    .subtab { display:inline-flex; align-items:center; gap:8px; min-height:40px; padding:0 16px; border-radius:20px; cursor:pointer; font:inherit;
              font-size:14px; color:var(--primary-text-color); background:var(--card-background-color, #fff); --mdc-icon-size:18px;
              border:1px solid var(--divider-color, rgba(127,127,127,.2)); }
    .subtab ha-icon { color:var(--secondary-text-color); }
    .subtab:hover { border-color:color-mix(in srgb, var(--primary-color) 50%, transparent); }
    .subtab:focus-visible { outline:2px solid var(--primary-color); outline-offset:2px; }
    .subtab.active { font-weight:500; color:var(--primary-color); border-color:var(--primary-color);
                     background:color-mix(in srgb, var(--primary-color) 12%, var(--card-background-color, #fff)); }
    .subtab.active ha-icon { color:var(--primary-color); }
    .subdot { width:8px; height:8px; border-radius:50%; background:var(--tone-warn); }
    .subdot.bad { background:var(--tone-bad); }
    .subdot.info { background:var(--info-color, #039be5); }
    .stsec { margin:8px 0 -2px; font-size:12px; font-weight:500; letter-spacing:.06em; text-transform:uppercase; color:var(--secondary-text-color); }
    main { max-width:1040px; margin:0 auto; padding:16px; box-sizing:border-box; display:flex; flex-direction:column; gap:12px; }
    .note { padding:16px; color:var(--secondary-text-color); display:flex; flex-direction:column; gap:10px; align-items:flex-start; }
    .note.error { color:var(--primary-text-color); border-left:3px solid var(--tone-bad); }
    .tiles { display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:10px; }
    .tile { position:relative; overflow:hidden; padding:12px 14px; display:flex; align-items:center; gap:12px; min-width:0; }
    .tile.link { cursor:pointer; }
    .tile .spark { position:absolute; inset:auto 0 0 0; width:100%; height:45%; opacity:.5; pointer-events:none; }
    .spark polyline { fill:none; stroke:var(--tone, var(--primary-color)); stroke-width:1.5; vector-effect:non-scaling-stroke; }
    .avatar { position:relative; width:40px; height:40px; flex:none; border-radius:50%; display:grid; place-items:center; --mdc-icon-size:22px;
              color:var(--tone-text, var(--primary-color)); background:color-mix(in srgb, var(--tone, var(--primary-color)) 15%, transparent); }
    .who { position:relative; flex:1; min-width:0; }
    .who .n { font-size:15px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .who .n b { font-size:20px; font-weight:500; margin-right:4px; font-variant-numeric:tabular-nums; }
    .who .s { font-size:12px; color:var(--secondary-text-color); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .good { --tone:var(--tone-good); } .warn { --tone:var(--tone-warn); } .bad { --tone:var(--tone-bad); } .info { --tone:var(--info-color, #039be5); }
    .good, .warn, .bad, .info { --tone-text: color-mix(in srgb, var(--tone) 50%, var(--primary-text-color)); }
    .pill { flex:none; font-size:11px; font-weight:500; padding:2px 10px; border-radius:12px; color:var(--tone-text, var(--primary-text-color));
            background:color-mix(in srgb, var(--tone, var(--secondary-text-color)) 15%, transparent); white-space:nowrap; }
    .list { padding:6px 0; overflow:hidden; }
    .lhead { display:flex; align-items:center; gap:10px; padding:8px 14px 6px; --mdc-icon-size:18px; color:var(--secondary-text-color); }
    .lhead .lname { flex:1; font-size:14px; font-weight:500; color:var(--primary-text-color); }
    .item { display:flex; align-items:center; gap:12px; padding:8px 14px; min-width:0; }
    .item.link { cursor:pointer; }
    a.item { color:inherit; text-decoration:none; }
    .item.link:hover { background:var(--secondary-background-color, rgba(127,127,127,.08)); }
    .item > ha-icon { flex:none; --mdc-icon-size:22px; color:var(--tone-text, var(--secondary-text-color)); }
    .side { flex:none; display:flex; flex-direction:column; align-items:flex-end; gap:4px; font-size:12px; text-align:right; min-width:90px; }
    .side.fixed { width:150px; min-width:0; }
    .trend { flex:none; width:90px; height:22px; }
    .trend .spark { width:100%; height:100%; display:block; }
    .meter { width:90px; height:6px; border-radius:3px; background:var(--divider-color, rgba(127,127,127,.25)); overflow:hidden; }
    .meter > span { display:block; height:100%; background:var(--tone, var(--primary-color)); }
    .muted { color:var(--secondary-text-color); }
    .empty { padding:18px 14px; color:var(--secondary-text-color); display:flex; align-items:center; gap:10px; --mdc-icon-size:20px; }
    .empty.good ha-icon { color:var(--tone-text); }
    .actions { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
    .act { display:inline-flex; align-items:center; gap:6px; border:0; cursor:pointer; font:inherit; font-size:13px; font-weight:500;
           padding:7px 12px; border-radius:8px; --mdc-icon-size:16px; color:var(--primary-color); text-decoration:none;
           background:color-mix(in srgb, var(--primary-color) 14%, transparent); }
    .act:hover:not([disabled]) { background:color-mix(in srgb, var(--primary-color) 22%, transparent); }
    .act.quiet { color:var(--primary-text-color); background:var(--secondary-background-color, rgba(127,127,127,.12)); }
    .act.sc { text-decoration:none; padding-inline:9px; }
    .act[disabled] { opacity:.5; cursor:default; }
    .act[aria-busy="true"] { opacity:.8; cursor:progress; }
    .act.danger { color:var(--error-color, #db4437); background:color-mix(in srgb, var(--error-color, #db4437) 12%, transparent); }
    .act.danger:hover:not([disabled]) { background:color-mix(in srgb, var(--error-color, #db4437) 20%, transparent); }
    .spin { animation:sh-spin 1s linear infinite; }
    .stgrid { display:grid; grid-template-columns:repeat(auto-fill, minmax(230px, 1fr)); gap:12px; }
    .sttile { position:relative; overflow:hidden; display:flex; flex-direction:column; align-items:stretch; gap:8px; text-align:left; cursor:pointer;
              padding:16px; border-radius:var(--ha-card-border-radius, 12px); border:1px solid var(--divider-color, rgba(127,127,127,.15));
              background:var(--card-background-color, #fff); color:var(--primary-text-color); font:inherit; }
    .sttile:hover { border-color:color-mix(in srgb, var(--tone) 50%, transparent); }
    .sttile:focus-visible { outline:2px solid var(--primary-color); outline-offset:2px; }
    .stic { width:38px; height:38px; border-radius:11px; display:flex; align-items:center; justify-content:center; flex:none; --mdc-icon-size:22px;
            color:var(--tone); background:color-mix(in srgb, var(--tone) 16%, transparent); }
    .stname { flex:1; font-size:14px; font-weight:500; }
    .stdot { width:9px; height:9px; border-radius:50%; background:var(--tone); box-shadow:0 0 8px var(--tone); }
    .stval { position:relative; font-size:19px; font-weight:500; }
    .stdet { position:relative; font-size:12px; color:var(--secondary-text-color); line-height:1.4;
             display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
    .cfg { gap:0; }
    .cfg h2 { margin-bottom:4px; }
    .cfgrow { padding:6px 0; border-top:1px solid var(--divider-color, rgba(127,127,127,.15)); }
    .cfgrow.open { background:color-mix(in srgb, var(--primary-color) 6%, transparent); margin:0 -16px; padding:6px 16px; }
    .cfgpad { width:36px; flex:none; }
    .cfgsec { font-size:12px; font-weight:500; letter-spacing:.06em; text-transform:uppercase; color:var(--secondary-text-color); padding:14px 0 4px; }
    .cfglist { display:flex; flex-direction:column; }
    .cfgrow.off > ha-icon, .cfgrow.off .who { opacity:.55; }
    .dragh { cursor:grab; touch-action:none; color:var(--secondary-text-color); }
    .cfgrow.dragging { background:var(--secondary-background-color, rgba(127,127,127,.12)); box-shadow:0 8px 24px rgba(0,0,0,.25);
                       border-radius:12px; position:relative; z-index:1; }
    .cfgrow.dragging .dragh { cursor:grabbing; }
    .cfgdef { margin-left:8px; vertical-align:2px; }
    .cfgbody { display:flex; flex-direction:column; gap:12px; padding:12px 0 16px 36px; }
    .cfgbody .loading { padding:12px 0; }
    .cfgtabs { align-self:flex-start; }
    .cfgdesc { white-space:pre-line; }
    @media (max-width:600px) { .cfgbody { padding-left:0; } }
    .lgentry { padding:10px 14px; border-top:1px solid var(--divider-color, rgba(127,127,127,.15)); display:flex; flex-direction:column; gap:4px; }
    .lgentry .actions { margin:0; }
    .lgentry .s, .lgentry summary { font-size:12px; color:var(--secondary-text-color); }
    .lgentry summary { cursor:pointer; }
    .lgmsg { font-family:var(--code-font-family, monospace); font-size:13px; white-space:pre-wrap; word-break:break-word; }
    .scnote { font-size:12.5px; color:var(--secondary-text-color); }
    .list .scnote { padding:6px 14px 12px; }
    .sctwo { display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:12px; align-items:start; }
    .list code { font-family:var(--code-font-family, monospace); font-size:12px; }
    .dbrow { width:100%; border:0; background:none; font:inherit; color:inherit; text-align:left; cursor:pointer; }
    .dbrow.on { background:rgba(var(--rgb-primary-color, 3,169,244), .08); }
    .dbrow .who { flex:1; min-width:0; }
    .dbdev { display:flex; align-items:center; padding-right:6px; }
    .dbdev.on { background:rgba(var(--rgb-primary-color, 3,169,244), .08); }
    .dbdev .dbrow { flex:1; min-width:0; }
    .dbdev .dbfold-space { width:36px; flex:none; }
    /* A table of the database: aligned with the devices' counts above (their chevron's room kept) */
    .dbtable { padding-right:56px; }
    .dbtable .who { flex:1; min-width:0; }
    .dbtable .dbcount { flex:none; }
    .dbents { border-left:2px solid var(--divider-color, rgba(127,127,127,.2)); margin-left:24px; padding-right:42px; }
    .dbent { padding-left:14px; }
    .dbent .n { font-size:13px; }
    .dbbar { height:4px; margin-top:6px; border-radius:2px; background:var(--divider-color, rgba(127,127,127,.2)); overflow:hidden; }
    .dbbar span { display:block; height:100%; background:var(--primary-color); }
    .dbcount { display:flex; flex-direction:column; align-items:flex-end; gap:2px; }
    .dbpick { padding:8px 16px 14px; display:flex; flex-direction:column; gap:8px; }
    .dbyaml { display:flex; gap:8px; align-items:flex-start; }
    .dbyaml pre { flex:1; margin:0; }
    .lgpre { margin:6px 0 0; padding:10px; border-radius:8px; overflow-x:auto; font-size:12px; background:var(--secondary-background-color, rgba(127,127,127,.08)); }
    .bkdays { display:flex; flex-wrap:wrap; gap:5px; }
    .bkday { width:20px; height:20px; border-radius:5px; background:var(--divider-color, rgba(127,127,127,.2)); }
    .bkday.ok { background:var(--tone-good); }
    .bkday.bad { background:var(--tone-bad); }
    .mkrestart { display:flex; align-items:center; gap:6px; font-size:13px; --mdc-icon-size:16px;
                 color:color-mix(in srgb, var(--tone-warn) 50%, var(--primary-text-color)); }
    .mkhead { display:flex; align-items:center; gap:14px; padding:14px 16px; flex-wrap:wrap; }
    .mkhead .who { flex:1; min-width:220px; }
    .mkhead .who .n { font-size:16px; font-weight:500; }
    .mkhead .actions { flex:none; flex-wrap:wrap; }
    @media (max-width:700px) {
      .mkhead { align-items:flex-start; position:relative; }
      .mkhead .who { padding-right:44px; }
      .mkhead .actions { flex:1 1 100%; }
      .mkgear { position:absolute; top:10px; right:10px; }
    }
    .mkgh { display:flex; align-items:flex-start; gap:4px; --mdc-icon-size:14px; }
    .mkgh > ha-icon { flex:none; margin-top:1px; }
    .mkgh > span { min-width:0; }
    .mkgrid { display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:12px; }
    .mkcard { padding:14px; display:flex; flex-direction:column; gap:10px; cursor:pointer; }
    .mktop { display:flex; align-items:center; gap:12px; min-width:0; }
    .mktop .who { flex:1; min-width:0; }
    .mktop .who .n { font-weight:500; }
    .mklogo { width:40px; height:40px; border-radius:10px; flex:none; object-fit:contain; display:flex; align-items:center; justify-content:center;
              color:#fff; font-weight:600; font-size:18px; background:var(--logo, var(--primary-color)); }
    img.mklogo { background:var(--secondary-background-color, rgba(127,127,127,.08)); }
    .mklogo.mkproj { border-radius:50%; color:var(--logo); background:color-mix(in srgb, var(--logo) 18%, transparent); }
    .mklogo.mkproj ha-icon { --mdc-icon-size:24px; }
    .mklogos { display:contents; }
    .mklogos > div.mklogo, .mklogos.broken > img { display:none; }
    .mklogos.broken > div.mklogo { display:flex; }
    .mkhead .who .s { white-space:normal; }
    .mkver { display:flex; align-items:center; gap:8px; font-family:var(--sh-mono, monospace); font-size:14px; --mdc-icon-size:18px; }
    .mkver ha-icon { color:var(--primary-color); }
    .mkver b { font-size:15px; }
    .mknotes { font-size:13px; color:var(--secondary-text-color); line-height:1.4; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; white-space:normal; }
    .mkcard .actions { margin-top:auto; }
    .mkcard { position:relative; overflow:hidden; }
    .mkbar { position:absolute; left:0; right:0; bottom:0; height:3px; border-radius:0; }
    .mkbar > span { border-radius:0; }
    .mkpct { font-size:13px; font-weight:500; font-variant-numeric:tabular-nums; color:var(--primary-text-color); }
    .mkpct.muted { font-weight:400; color:var(--secondary-text-color); }
    .pill > ha-icon { --mdc-icon-size:14px; vertical-align:-2px; margin-right:2px; }
    .loading { display:flex; align-items:center; gap:10px; color:var(--secondary-text-color); --mdc-icon-size:20px; }
    .loading ha-icon { color:var(--primary-color); }
    .loading.small { font-size:12px; gap:6px; --mdc-icon-size:16px; }
    .savebar { position:sticky; bottom:12px; z-index:2; display:flex; flex-wrap:wrap; align-items:center; gap:8px; padding:10px 14px;
               border-radius:12px; background:var(--sh-card, var(--card-background-color, #fff)); box-shadow:0 4px 16px rgba(0,0,0,.18);
               border:1px solid color-mix(in srgb, var(--primary-color) 40%, transparent); }
    .savebar .grow { font-size:14px; font-weight:500; }
    [data-more]:focus-visible, .tilelink:focus-visible { outline:2px solid var(--primary-color); outline-offset:2px; }
    .msg { font-size:12px; color:var(--secondary-text-color); overflow-wrap:anywhere; }
    .msg.bad, .msg.good { color:var(--tone-text); }
    .box { display:flex; align-items:center; flex:1; min-width:200px; border-radius:8px; border:1px solid var(--divider-color, rgba(127,127,127,.3));
           background:var(--secondary-background-color, rgba(127,127,127,.08)); }
    .box:focus-within { border-color:var(--primary-color); }
    .box input { flex:1; min-width:0; border:0; outline:0; background:none; color:inherit; font:inherit; font-size:14px; padding:8px 10px; }
    .block { padding:14px 16px; display:flex; flex-direction:column; gap:12px; }
    .block h2 { margin:0; font-size:16px; font-weight:500; }
    .row { display:flex; align-items:center; gap:12px; min-height:40px; }
    .row .who .n { font-size:14px; }
    .row .who .s { white-space:normal; }
    .icon-btn { border:0; background:none; cursor:pointer; color:var(--secondary-text-color); padding:8px; border-radius:50%; display:flex; --mdc-icon-size:20px; }
    .icon-btn:hover:not([disabled]) { background:var(--secondary-background-color); color:var(--primary-color); }
    .icon-btn[disabled] { opacity:.3; cursor:default; }
    .grow { flex:1; }
    .tilelink { color:inherit; text-decoration:none; display:block; min-width:0; }
    .tilelink > .tile { height:100%; box-sizing:border-box; }
    .ver { white-space:nowrap; }
    .rv.warn b { color:color-mix(in srgb, var(--tone-warn) 60%, var(--primary-text-color)); }
    .rv.bad b { color:color-mix(in srgb, var(--tone-bad) 60%, var(--primary-text-color)); }
    .bsearch { flex:0 1 220px; min-width:160px; --mdc-icon-size:18px; padding-left:8px; color:var(--secondary-text-color); }
    .bsearch input { color:var(--primary-text-color); }
    .spare { border:0; cursor:pointer; font:inherit; font-size:12px; padding:2px 9px; border-radius:999px; color:var(--primary-text-color);
             background:color-mix(in srgb, var(--tone-good) 14%, transparent); display:inline-flex; align-items:center; gap:4px; --mdc-icon-size:14px; }
    .spare.short { background:color-mix(in srgb, var(--tone-warn) 16%, transparent); }
    .spare.add { background:var(--secondary-background-color, rgba(127,127,127,.12)); padding:2px 6px; }
    .stockform { display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin:-6px 0 14px; }
    .stockform .box { flex:0 1 200px; min-width:140px; }
    .stockform .box.count { flex:0 1 110px; min-width:90px; }
    .warn-text { color:color-mix(in srgb, var(--tone-warn) 50%, var(--primary-text-color)) !important; }
    .lhead .act { font-size:12px; padding:4px 10px; }
    .mono { font-family:var(--code-font-family, monospace); font-size:15px; }
    .progress { padding:14px 16px; display:flex; flex-direction:column; gap:10px; }
    .phead { display:flex; align-items:center; gap:10px; --mdc-icon-size:20px; color:var(--primary-color); }
    .phead ha-icon { animation:sh-spin 2s linear infinite; }
    .ptitle { flex:1; font-size:15px; font-weight:500; color:var(--primary-text-color); }
    .ppct { font-size:20px; font-weight:500; font-variant-numeric:tabular-nums; color:var(--primary-text-color); }
    .pbar { height:8px; border-radius:4px; overflow:hidden; background:color-mix(in srgb, var(--primary-color) 15%, transparent); }
    .pbar > span { display:block; height:100%; border-radius:4px; background:var(--primary-color); transition:width .6s ease; }
    .pbar.busy > span { animation:sh-slide 1.4s ease-in-out infinite; }
    .pmeta { display:flex; flex-wrap:wrap; gap:6px 18px; font-size:13px; color:var(--secondary-text-color); font-variant-numeric:tabular-nums; }
    .pmeta .bad { color:color-mix(in srgb, var(--tone-bad) 50%, var(--primary-text-color)); }
    .notes { display:flex; flex-direction:column; gap:4px; }
    @keyframes sh-spin { to { transform:rotate(360deg) } }
    @keyframes sh-slide { 0% { transform:translateX(-100%) } 100% { transform:translateX(340%) } }
    @media (prefers-reduced-motion: reduce) { .phead ha-icon, .pbar.busy > span, .spin { animation:none; } }
    .bsheet { padding:14px 16px 16px; }
    .btop { display:flex; flex-wrap:wrap; align-items:center; gap:10px 20px; margin-bottom:16px; }
    .btabs { display:inline-flex; gap:4px; padding:3px; border-radius:12px; background:var(--secondary-background-color, rgba(128,128,128,.1)); }
    .btab { border:0; background:none; cursor:pointer; font:inherit; padding:6px 14px; border-radius:9px; font-size:13px; font-weight:500; color:var(--secondary-text-color); }
    .btab.on { background:color-mix(in srgb, var(--primary-color) 15%, transparent); color:color-mix(in srgb, var(--primary-color) 40%, var(--primary-text-color)); }
    .bline { display:flex; flex-wrap:wrap; align-items:center; gap:6px; font-size:12px; color:var(--secondary-text-color); }
    .rlabel { display:flex; align-items:center; gap:6px; font-size:12px; font-weight:500; text-transform:uppercase; letter-spacing:.04em; --mdc-icon-size:16px; }
    .buy { padding:2px 9px; border-radius:999px; color:var(--primary-text-color); background:color-mix(in srgb, var(--tone-warn) 16%, transparent); }
    .buy b { color:color-mix(in srgb, var(--tone-warn) 40%, var(--primary-text-color)); }
    .buy.unknown { background:color-mix(in srgb, var(--secondary-text-color) 18%, transparent); }
    .buy.unknown b { color:var(--secondary-text-color); }
    .none { color:color-mix(in srgb, var(--tone-good) 40%, var(--primary-text-color)); font-weight:500; }
    .nextb { border:0; cursor:pointer; font:inherit; font-size:12px; padding:2px 9px; border-radius:999px; color:var(--primary-text-color); background:color-mix(in srgb, var(--primary-color) 12%, transparent); }
    .nextb b { font-weight:500; }
    .bgroups { columns:3 300px; column-gap:28px; }
    .bgroup { break-inside:avoid; display:flex; flex-direction:column; gap:6px; margin-bottom:20px; }
    .bgroups.bylevel { columns:2 300px; column-gap:16px; }
    .bgroups.bylevel .glist { grid-template-columns:minmax(0, 1fr); }
    .ghead { display:flex; align-items:center; gap:8px; font-size:14px; font-weight:500; --mdc-icon-size:18px; }
    .ghead ha-icon { color:var(--secondary-text-color); }
    .gname { flex:1; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .gchip { font-size:11px; padding:1px 8px; border-radius:999px; color:color-mix(in srgb, var(--tone-warn) 40%, var(--primary-text-color)); background:color-mix(in srgb, var(--tone-warn) 14%, transparent); }
    .gcount { font-size:11px; font-weight:400; color:var(--secondary-text-color); }
    .glist { display:grid; gap:6px; }
    .ghint { font-size:11px; color:var(--secondary-text-color); margin-top:-2px; }
    .brow { --t:var(--tone-good); --tt:color-mix(in srgb, var(--t) 40%, var(--primary-text-color)); border:0; font:inherit; color:inherit; text-align:left; cursor:pointer;
            min-width:0; display:flex; align-items:center; gap:8px; padding:5px 10px 5px 5px; border-radius:10px; background:var(--secondary-background-color, rgba(127,127,127,.08)); }
    .brow.warn { --t:var(--tone-warn); }
    .brow.alert { --t:var(--tone-bad); }
    .brow.warn, .brow.alert { background:color-mix(in srgb, var(--t) 12%, var(--secondary-background-color, transparent)); }
    .brow:hover { filter:brightness(.97); }
    .brow .ic { flex:none; width:28px; height:28px; border-radius:50%; display:grid; place-items:center; color:var(--t); background:color-mix(in srgb, var(--t) 18%, transparent); --mdc-icon-size:16px; }
    .brow.due .ic { animation:sh-blink 1.5s ease-in-out infinite; }
    .brow .txt { flex:1; display:flex; flex-direction:column; min-width:0; }
    .brow .name { font-size:13px; font-weight:500; line-height:1.25; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .brow .sub { font-size:11px; line-height:1.25; color:var(--secondary-text-color); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .brow.warn .sub, .brow.alert .sub, .brow.warn .lvl, .brow.alert .lvl { color:var(--tt); }
    .brow .lvl { flex:none; display:flex; flex-direction:column; align-items:flex-end; gap:3px; font-size:12px; font-weight:500; font-variant-numeric:tabular-nums; }
    .track { width:44px; height:4px; border-radius:2px; overflow:hidden; background:color-mix(in srgb, var(--secondary-text-color) 22%, transparent); }
    .bar { display:block; height:100%; border-radius:2px; background:var(--t); }
    @keyframes sh-blink { 0%, 100% { opacity:1 } 50% { opacity:.35 } }
    @media (prefers-reduced-motion: reduce) { .brow.due .ic { animation:none; } }
    .segs { display:inline-flex; border-radius:8px; overflow:hidden; background:var(--secondary-background-color, rgba(127,127,127,.12)); }
    .gitrepos { display:flex; flex-wrap:wrap; width:max-content; max-width:100%; margin:0 0 12px; }
    .seg { display:inline-flex; align-items:center; gap:6px; border:0; background:none; cursor:pointer; font:inherit; font-size:13px;
           padding:7px 12px; color:var(--secondary-text-color); --mdc-icon-size:16px; }
    .seg.active { color:var(--primary-color); background:color-mix(in srgb, var(--primary-color) 14%, transparent); font-weight:500; }
    .lhead .muted { font-size:12px; }
    .rings { display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:10px; }
    .ring { position:relative; overflow:hidden; display:flex; flex-direction:column; align-items:center; padding:14px 12px 44px; gap:6px; cursor:pointer; }
    .ring .behind { position:absolute; inset:auto 0 0 0; width:100%; height:34%; pointer-events:none; }
    .ring .behind polygon { fill:var(--ring); opacity:.12; }
    .ring .behind polyline { fill:none; stroke:var(--ring); stroke-width:1.5; opacity:.5; vector-effect:non-scaling-stroke; }
    .gauge { position:relative; width:104px; height:104px; }
    .gauge circle { fill:none; stroke-width:9; }
    .gauge .track { stroke:var(--divider-color, rgba(127,127,127,.2)); }
    .gauge .arc { stroke:var(--ring); stroke-linecap:round; }
    .rv { position:absolute; top:14px; height:104px; display:flex; align-items:center; justify-content:center; gap:2px; }
    .rv b { font-size:24px; font-weight:500; font-variant-numeric:tabular-nums; }
    .rv span { font-size:13px; color:var(--secondary-text-color); margin-top:6px; }
    .rl { position:relative; font-size:16px; font-weight:500; }
    .chart { padding:14px 16px 12px; display:flex; flex-direction:column; gap:8px; min-width:0; }
    .chead { display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
    .ctitle { flex:1; font-size:17px; font-weight:500; }
    .chart .seg { padding:5px 10px; font-size:12px; }
    .plot { position:relative; }
    .plot svg { width:100%; height:100%; display:block; overflow:visible; }
    .plot polyline { fill:none; stroke-width:2; vector-effect:non-scaling-stroke; stroke-linejoin:round; }
    .plot .grid line { stroke:var(--divider-color, rgba(127,127,127,.2)); stroke-width:1; vector-effect:non-scaling-stroke; }
    .ymax { position:absolute; top:-2px; left:0; font-size:11px; color:var(--secondary-text-color); background:var(--card-background-color); padding-right:4px; }
    .cnote { position:absolute; inset:0; display:grid; place-items:center; font-size:13px; color:var(--secondary-text-color); }
    .xaxis { position:relative; height:16px; font-size:12px; color:var(--secondary-text-color); }
    .xaxis span { position:absolute; transform:translateX(-50%); white-space:nowrap; }
    .xaxis span:first-child { transform:none; }
    .xaxis span:last-child { transform:translateX(-100%); }
    .legend { display:flex; flex-wrap:wrap; gap:6px 20px; font-size:14px; }
    .legend .lg { display:inline-flex; align-items:center; gap:8px; cursor:pointer; }
    .legend i { width:14px; height:4px; border-radius:2px; }
    .pair { display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:10px; }
    .ha-ctl { margin-bottom:10px; }
    .ha-backdrop { position:fixed; inset:0; z-index:1000; background:rgba(0,0,0,.45); backdrop-filter:blur(2px); }
    .ha-dialog { position:fixed; z-index:1001; left:50%; top:50%; transform:translate(-50%, -50%); width:min(440px, calc(100vw - 32px));
                 box-sizing:border-box; padding:20px 20px 16px; border-radius:16px; background:var(--card-background-color, #fff);
                 color:var(--primary-text-color); box-shadow:0 12px 40px rgba(0,0,0,.35); }
    .ha-dhead { display:flex; align-items:center; gap:12px; font-size:18px; font-weight:500; }
    .ha-dhead ha-icon { --mdc-icon-size:22px; padding:8px; border-radius:50%; color:var(--primary-color);
                        background:color-mix(in srgb, var(--primary-color) 14%, transparent); }
    .ha-dhead.bad ha-icon { color:var(--error-color, #db4437); background:color-mix(in srgb, var(--error-color, #db4437) 14%, transparent); }
    .ha-dialog p { margin:14px 0; color:var(--secondary-text-color); line-height:1.45; font-size:14px; }
    .ha-check { display:flex; gap:8px; align-items:flex-start; padding:10px 12px; margin-bottom:14px; border-radius:8px; font-size:13px; }
    .ha-check.good { color:var(--tone-good); background:color-mix(in srgb, var(--tone-good) 12%, transparent); }
    .ha-check.bad { color:var(--tone-bad); background:color-mix(in srgb, var(--tone-bad) 12%, transparent); }
    .ha-check pre { margin:6px 0 0; white-space:pre-wrap; overflow-wrap:anywhere; max-height:160px; overflow:auto;
                    font-family:var(--code-font-family, monospace); font-size:12px; color:var(--primary-text-color); }
    .ha-dialog .loading { margin-bottom:14px; }
    .confirm { display:flex; flex-wrap:wrap; align-items:center; gap:8px; padding:10px 14px; border-radius:8px;
               background:color-mix(in srgb, var(--tone-warn) 12%, transparent); }
    code { font-family:var(--code-font-family, monospace); font-size:12px; }
    .who .s.wrap { white-space:normal; overflow-wrap:anywhere; display:flex; flex-wrap:wrap; align-items:center; gap:4px 6px; margin-top:4px; }
    a.pill { text-decoration:none; }
    .item .actions { margin-top:6px; }
    .more-row { justify-content:center; padding:6px 0; }
    .nviews { margin-bottom:12px; width:fit-content; }
    .nbar { display:flex; flex-wrap:wrap; gap:6px; align-items:center; }
    .nmap { position:relative; padding:0; overflow:hidden; }
    .nsvg { display:block; width:100%; height:min(720px, 72vh); cursor:grab; user-select:none; touch-action:none; }
    .nsvg:active { cursor:grabbing; }
    .nsearch { position:absolute; top:12px; left:12px; z-index:1; display:flex; align-items:center; gap:6px; padding:0 10px; height:36px;
               width:min(260px, calc(100% - 80px)); box-sizing:border-box; border:1px solid var(--divider-color, rgba(127,127,127,.3)); border-radius:8px;
               background:var(--card-background-color, #fff); --mdc-icon-size:18px; color:var(--secondary-text-color); }
    .nsearch input { flex:1; min-width:0; border:0; outline:none; background:none; font:inherit; font-size:14px; color:var(--primary-text-color); }
    .ntools { position:absolute; top:12px; right:12px; z-index:1; display:flex; flex-direction:column; gap:6px; }
    .ntool { width:36px; height:36px; display:flex; align-items:center; justify-content:center; border-radius:8px; cursor:pointer; font:inherit; font-size:16px;
             border:1px solid var(--divider-color, rgba(127,127,127,.3)); background:var(--card-background-color, #fff); color:var(--secondary-text-color); --mdc-icon-size:20px; }
    .ntool.on { color:var(--primary-color); border-color:var(--primary-color); }
    .ntool ha-icon[icon="mdi:loading"] { animation:sh-spin 1s linear infinite; }
    .nl { stroke:var(--disabled-text-color, #9e9e9e); stroke-width:1.5; fill:none; vector-effect:non-scaling-stroke; }
    .nl.end { stroke-dasharray:8 6; }
    .nl.mesh { stroke-dasharray:2 5; opacity:.5; stroke-width:1.5; }
    .nl.good { stroke:var(--tone-good); } .nl.warn { stroke:var(--tone-warn); } .nl.bad { stroke:var(--tone-bad); }
    .nl.thread { stroke:#8e6fd6; } .nl.ip { stroke:#f2a03d; }
    .nl.gone { stroke:var(--tone-bad); stroke-dasharray:4 6; }
    .na { fill:var(--disabled-text-color, #9e9e9e); } .na.good { fill:var(--tone-good); } .na.warn { fill:var(--tone-warn); }
    .na.bad, .na.gone { fill:var(--tone-bad); } .na.thread { fill:#8e6fd6; } .na.ip { fill:#f2a03d; }
    .nn { cursor:pointer; } .nn circle, .nn rect { fill:#26a69a; stroke:var(--card-background-color, #fff); stroke-width:2; }
    .nn.coordinator rect, .nn.coordinator circle { fill:var(--primary-color); } .nn.thread rect { fill:#8e6fd6; } .nn.ip rect { fill:#f2a03d; }
    .nn.router circle { fill:#4fb3e0; } .nn.silent circle, .nn.silent rect { fill:var(--tone-bad); }
    .nn .nring { fill:none; stroke:none; }
    .nn.sel .nring, .nn.hit .nring { stroke:var(--primary-color); stroke-width:3; }
    .nn text { font-size:16px; fill:var(--primary-text-color); pointer-events:none; paint-order:stroke;
               stroke:var(--card-background-color, #fff); stroke-width:4px; stroke-linejoin:round; }
    .nn text.sub { font-size:13px; fill:var(--secondary-text-color); }
    .nn.silent text { fill:var(--tone-bad); }
    .nsvg.dense text.sub { display:none; }
    .nsvg.crowded .nn.end:not(.sel):not(.hit):not(.near):not(.silent) text { display:none; }
    .nl.dim, .nn.dim { opacity:.12; }
    .nsvg.focusing .nn:not(.near), .nsvg.focusing .nl:not(.near) { opacity:.1; }
    .nsvg.focusing .nl.near { opacity:1; }
    .ntip { position:absolute; z-index:2; pointer-events:none; max-width:280px; padding:10px 12px; border-radius:8px; font-size:12px; line-height:1.5;
            background:var(--card-background-color, #fff); color:var(--primary-text-color); border:1px solid var(--divider-color, rgba(127,127,127,.3));
            box-shadow:0 4px 16px rgba(0,0,0,.25); }
    .ntip b { display:block; font-size:13px; margin-bottom:2px; }
    .ntip span { color:var(--secondary-text-color); margin-right:6px; }
    .ntip span::after { content:':'; }
    .nlegend { display:flex; flex-wrap:wrap; justify-content:center; gap:6px 16px; padding:8px 12px 12px; font-size:12px; color:var(--secondary-text-color); }
    .nlegend span { display:inline-flex; align-items:center; gap:6px; }
    .nlegend .nd { width:11px; height:11px; border-radius:50%; background:#26a69a; }
    .nlegend .nd.sq { border-radius:3px; } .nlegend .nd.coordinator { background:var(--primary-color); } .nlegend .nd.thread { background:#8e6fd6; }
    .nlegend .nd.ip { background:#f2a03d; } .nlegend .nd.router { background:#4fb3e0; } .nlegend .nd.silent { background:var(--tone-bad); }
    .nlegend .nlq { flex-basis:100%; justify-content:center; }
    .ntree { margin-top:12px; padding:4px 6px; }
    .ntoggle { display:flex; align-items:center; gap:6px; width:100%; border:0; background:none; font:inherit; font-size:14px; font-weight:500;
               color:var(--primary-text-color); padding:8px; cursor:pointer; --mdc-icon-size:20px; }
    .nrows { display:flex; flex-direction:column; gap:1px; padding-bottom:6px; }
    .nrow ha-icon { color:var(--secondary-text-color); } .nrow.silent ha-icon { color:var(--tone-bad); }
    .nrow { display:flex; align-items:center; gap:6px; width:100%; border:0; background:none; font:inherit; font-size:13px; text-align:left;
            color:var(--primary-text-color); padding:6px 8px; border-radius:8px; cursor:pointer; --mdc-icon-size:18px; }
    .nrow:hover { background:color-mix(in srgb, var(--primary-color) 8%, transparent); }
    .nrow.sel { background:color-mix(in srgb, var(--primary-color) 16%, transparent); }
    .nrow.silent { color:var(--tone-bad); }
    .nrow .nn-name { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .nrow .s { font-size:12px; color:var(--secondary-text-color); }
    .ndetail { display:flex; flex-wrap:wrap; align-items:center; gap:10px; padding:10px 14px; margin-top:12px; }
    .ndetail .who { flex:1; min-width:200px; } .ndetail .ndact { display:flex; gap:6px; }
    .ndetail.silent .n { color:var(--tone-bad); }
    @media (max-width: 600px) {
      main { padding:12px 8px; }
      .tiles { grid-template-columns:repeat(2, minmax(0, 1fr)); gap:8px; }
      .tile { padding:10px 12px; gap:10px; }
      .avatar { width:32px; height:32px; --mdc-icon-size:18px; }
      .side { min-width:70px; }
      .meter { width:70px; }
      .side.fixed { width:auto; }
      .trend { display:none; }
      .tile .more { display:none; }
      .rings { grid-template-columns:repeat(2, minmax(0, 1fr)); gap:8px; }
      .gauge { width:84px; height:84px; }
      .rv { height:84px; }
      .rv b { font-size:20px; }
      .pair { grid-template-columns:1fr; }
    }
    ${SH_ORPHANS_STYLE}
  `;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    // The page shown again (the app back from the background): read again at once
    this._onVisible = () => {
      if (!document.hidden && this._hass) this._load();
    };
    this._tab = null;
    this._state = null;
    this._error = null;
    this._busy = {};
    this._messages = {};
    this._draft = {};
    this._localize = null;
    this._hist = {};
    this._histBusy = {};
    this._periods = {};
    // By level: the view chosen lasts while the Batteries tab is shown (see _resetTabState)
    this._battView = 'level';
  }

  set hass(hass) {
    var first = !this._hass;
    // The connection back (Home Assistant restarted, the app back from the background): read again at once
    if (hass?.connection && hass.connection !== this._conn) {
      this._conn = hass.connection;
      hass.connection.addEventListener?.('ready', () => this.isConnected && this._load());
    }
    var language = this._hass?.language;
    this._hass = hass;
    this._menus?.forEach((menu) => {
      menu.hass = hass;
    });
    if (first) this._start();
    else if (hass.language !== language) this._loadStrings();
    else this._updLiveChanged();
  }

  // The Updates tab shown: drawn again when an update starts, moves on (update_percentage) or ends, between two reads
  // of the state, so the progress of each install follows the entity (issue #109)
  _updLiveChanged() {
    if (this._tab !== 'marketplace' || !this._state) return;
    var ids = [...(this._state.marketplace?.list || []), ...(this._state.system_updates?.available || [])].map((u) => u.entity_id);
    var key = ids
      .map((id) => {
        var attrs = this._hass.states?.[id]?.attributes || {};
        return `${id}:${attrs.in_progress ?? ''}:${attrs.update_percentage ?? ''}`;
      })
      .join('|');
    if (key === this._updLiveKey) return;
    var seen = this._updLiveKey !== undefined;
    this._updLiveKey = key;
    if (seen) this._render();
  }

  // An update as its entity says now: installing (in_progress) and the share done (update_percentage, else a number in
  // in_progress as before Home Assistant 2024.11), null when it doesn't report its progress
  _updLive(entityId) {
    var attrs = this._hass?.states?.[entityId]?.attributes || {};
    var installing = Boolean(attrs.in_progress);
    var raw = attrs.update_percentage ?? (typeof attrs.in_progress === 'number' ? attrs.in_progress : null);
    var pct = installing && typeof raw === 'number' && Number.isFinite(raw) ? Math.max(0, Math.min(100, Math.round(raw))) : null;
    return { installing, pct };
  }

  // Installs started: the state read again soon, after which it is read every 2 seconds while they run
  _kickLoad() {
    clearTimeout(this._kick);
    this._kick = setTimeout(() => this.isConnected && this._load(), 1000);
  }

  set narrow(narrow) {
    this._narrow = narrow;
    this.toggleAttribute('narrow', Boolean(narrow));
    this._menus?.forEach((menu) => {
      menu.narrow = narrow;
    });
  }

  // Settings → Hide the top bar: for no one (off), everyone (all) or the users who are not administrators (non_admin)
  // Until the state is read, the choice last seen in this browser: the bar does not show for a moment on load, then go
  _applyHeader() {
    var hidden;
    if (this._state?.loaded) {
      var mode = this._state.hide_header || 'off';
      hidden = mode === 'all' || (mode === 'non_admin' && !this._hass?.user?.is_admin);
      try {
        localStorage.setItem(SH_HIDE_BAR_KEY, hidden ? '1' : '0');
      } catch (_err) {
        // no storage (private mode): the bar may show for a moment on the next load
      }
    } else {
      try {
        hidden = localStorage.getItem(SH_HIDE_BAR_KEY) === '1';
      } catch (_err) {
        hidden = false;
      }
    }
    this.toggleAttribute('hide-bar', hidden);
  }

  set panel(panel) {
    this._panel = panel;
  }

  set route(route) {
    var path = (route?.path || '').split('/').filter(Boolean)[0] || null;
    // Home Assistant gives the route again at each of its updates, the same one: only a new address is followed, so
    // that the panel stays on the tab shown (before 2.0.2, the address it kept was the one the panel opened with, and
    // its first tab came back by itself)
    if (this._routeSeen !== undefined && path === this._routeSeen) return;
    this._routeSeen = path;
    this._routeTab = path;
    if (this._state) {
      this._selectTab(path);
      // Followed: not applied again by the next drawing, which would bring this tab back over one chosen since (a
      // tab chosen after a route took two clicks)
      this._routeTab = null;
    }
  }

  // Values set before the element was defined land as plain properties and hide the setters: passed through them
  _upgradeProperties() {
    ['panel', 'narrow', 'route', 'hass'].forEach((name) => {
      if (!Object.hasOwn(this, name)) return;
      var value = this[name];
      delete this[name];
      this[name] = value;
    });
  }

  connectedCallback() {
    this._upgradeProperties();
    this._timer ??= setInterval(() => {
    if (!this._fold && this.shadowRoot?.querySelector?.(".topbar")) this._attachFold();
      if (!document.hidden) this._load();
    }, SH_REFRESH_MS);
    if (this._hass && this._state) this._load();
    document.addEventListener?.('visibilitychange', this._onVisible);
  }

  disconnectedCallback() {
    clearInterval(this._timer);
    this._fold?.detach();
    this._fold = null;
    clearTimeout(this._fast);
    clearTimeout(this._kick);
    clearTimeout(this._retry);
    this._timer = null;
    document.removeEventListener?.('visibilitychange', this._onVisible);
  }

  async _start() {
    this._renderShell();
    await this._loadStrings();
    await this._load();
  }

  async _loadStrings() {
    try {
      var categories = ['selector', 'entity', 'services', 'config', 'options'];
      var results = await Promise.all(categories.map((c) => this._hass.loadBackendTranslation?.(c, SH_DOMAIN)));
      this._localize = results.find(Boolean) || this._hass.localize;
    } catch (_err) {
      this._localize = this._hass.localize;
    }
    this._render();
  }

  // The panel's own strings (selector.panel), the names of the entities and actions, the module descriptions
  _t(key, vars) {
    return this._l(`component.${SH_DOMAIN}.selector.panel.options.${key}`, vars) || key;
  }

  // Home Assistant's newest localize first: the one a translation load resolved with may lack the categories
  // loaded alongside (the module descriptions of `config`, the forms of `options`)
  _l(key, vars) {
    for (var localize of [this._hass?.localize, this._localize]) {
      if (!localize) continue;
      try {
        var text = localize(key, vars || {});
        if (text) return text;
      } catch (_err) {
        // the next one
      }
    }
    return '';
  }

  _entityName(platform, key) {
    return this._l(`component.${SH_DOMAIN}.entity.${platform}.${key}.name`) || key;
  }

  _serviceName(service) {
    return this._l(`component.${SH_DOMAIN}.services.${service}.name`) || service;
  }

  async _load() {
    if (!this._hass) return;
    try {
      this._state = await this._hass.callWS({ type: 'system_hub/state' });
      this._error = null;
      // A check or installs running on the Marketplace tab: their progress every 2 seconds rather than every 10
      clearTimeout(this._fast);
      var mkBusy = this._state?.marketplace?.state === 'running' || this._state?.marketplace?.installing_updates;
      if (mkBusy && this._tab === 'marketplace' && this.isConnected) {
        this._fast = setTimeout(() => this._load(), 2000);
      }
      // The Orphans tab shown: its whole list, read again with the state
      if (this._state?.orphans && (this._routeTab || this._tab) === 'orphans') await this._orphLoad();
      // The log, for the Logs tab and the Status tab: read again every minute at most
      if (this._state?.logs) await this._lgLoad();
      // The database count and the security scan can take seconds: the panel is drawn without waiting for them, then
      // again once they are read (read for the sidebar icon or a card, they are waited for)
      var slow = [this._state?.database && this._dbLoad(), this._state?.security && this._scLoad()].filter(Boolean);
      if (this._headless) await Promise.all(slow);
      else if (slow.length) Promise.all(slow).then(() => this._idleRender());
      // The Backups tab shown: Home Assistant's backups, read again every minute at most
      if (this._state?.backups && (this._routeTab || this._tab) === 'backups') await this._bkLoad();
      this._reportTone();
      clearTimeout(this._retry);
    } catch (err) {
      // Home Assistant restarting, the connection lost (the app back from the background): what is shown stays, read
      // again in a few seconds; the message only when nothing could be read yet
      if (!this._state?.loaded) this._error = shErr(err);
      clearTimeout(this._retry);
      if (this.isConnected) this._retry = setTimeout(() => this._load(), SH_RETRY_MS);
      if (this._state?.loaded) return;
    }
    this._idleRender();
  }

  // Drawn again, unless a settings form is open: left as it is, what is being typed included
  _idleRender() {
    if (this._tab === 'settings' && (this._cfg?.flow || this._drag)) return;
    this._render();
  }

  _tabs() {
    // Nothing read yet: no tab, so that none is picked before the configured order is known
    if (!this._state) return [];
    if (!this._state.loaded) return ['system', 'settings'];
    var modules = this._state.modules || [];
    return [...shGroupTabs(this._state.tabs).filter((t) => t === 'status' || t === 'system' || modules.includes(t)), 'settings'];
  }

  // The tabs under the toolbar: Status, the groups with a tab shown, Settings
  _groups() {
    return [...new Set(this._tabs().map(shGroupOf))];
  }

  // The sub-tabs of a group: its modules turned on
  _groupTabs(group) {
    return this._tabs().filter((t) => shGroupOf(t) === group);
  }

  _tabName(tab) {
    if (tab === 'settings') return this._t('settings');
    var key = `tab_${tab}`;
    var name = this._t(key);
    return name !== key ? name : SH_MODULE_NAMES[tab] || tab;
  }

  _groupName(group) {
    if (!SH_GROUPS[group]) return this._tabName(group);
    return group === 'system' ? this._t('system') : this._t(`group_${group}`);
  }

  // A group's badge: how many of its modules need a look, in the colour of the worst
  _groupBadge(group) {
    if (!SH_GROUPS[group] || !this._state?.loaded) return '';
    var tones = this._groupTabs(group)
      .map((t) => this._stArea(t)?.[0])
      .filter((t) => t && t !== 'good');
    if (!tones.length) return '';
    var tone = ['bad', 'warn', 'info'].find((t) => tones.includes(t));
    return `<span class="tbadge ${tone}" aria-label="${shEsc(this._t(tones.length === 1 ? 'st_point' : 'st_points', { n: tones.length }))}">${tones.length}</span>`;
  }

  // A tab, or a group (its first sub-tab)
  _selectTab(tab, focus) {
    var tabs = this._tabs();
    if (!tabs.includes(tab) && SH_GROUPS[tab]) tab = this._groupTabs(tab)[0];
    var chosen = tabs.includes(tab) ? tab : tabs[0];
    if (chosen !== this._tab) {
      if (this._tab) this._resetTabState();
      this._tab = chosen;
      this._render();
    }
    if (focus) this.shadowRoot.querySelector(focus === 'sub' ? `[data-subtab="${chosen}"]` : `[data-group="${shGroupOf(chosen)}"]`)?.focus({ preventScroll: true });
  }

  // Another tab shown: what was typed, chosen, sorted, ticked, unfolded or asked in the one left goes, so that every tab
  // opens in its default state. Kept: what was read (the data and their caches) and the actions still running.
  _resetTabState() {
    // Search fields, filters, the commit message, the stock form, unsaved Settings orders
    this._draft = {};
    this._messages = {};
    this._confirm = null;
    this._haCheck = null;
    // Database: devices ticked and unfolded
    this._dbSel = null;
    this._dbOpen = null;
    // Automations: lists folded and shortened again
    this._autoFolds = {};
    this._autoMore = {};
    // Silent devices: the filter, the list view, the device picked and Silent only on a network; Batteries: the view (by level); Resources: the curves' periods
    this._slFilter = null;
    this._slView = 'list';
    this._slSel = null;
    this._slOnly = false;
    this._slBox = null;
    this._slLabels = true;
    this._slTreeOpen = false;
    this._battView = 'level';
    this._periods = {};
    // Updates: Back up before installing back to its setting
    this._updBackup = undefined;
    // Versioning: the first repository, the changed files folded as by default; the stock form closed
    this._gitRepo = undefined;
    this._gitFilesOpen = undefined;
    this._stockForm = false;
    // Cleanup: nothing ticked, the list shortened, no question
    if (this._orphState) Object.assign(this._orphState, { sel: new Set(), dsel: new Set(), all: false, confirm: null });
    // Settings: a module's settings form closed (its flow aborted)
    if (this._cfg?.module) {
      this._cfgAbort();
      Object.assign(this._cfg, { module: null, step: null, error: null, haForm: null });
    }
  }

  // A group's tab clicked: its first sub-tab, whichever was shown last in it
  _goGroup(group, focus) {
    this._goTab(this._groupTabs(group)[0], focus);
  }

  _goTab(tab, focus) {
    // A tab chosen here wins over an address not yet applied
    this._routeTab = null;
    this._selectTab(tab, focus);
    var base = (this._panel?.url_path || 'system-hub').replace(/^\//, '');
    try {
      // Every tab in the address, the first one too: the panel's bare address opens the first tab of the order
      history.replaceState(history.state, '', `/${base}/${this._tab}`);
      // Home Assistant told, so that its route follows: a panel it builds again opens on this tab, not on the first one
      window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: true } }));
    } catch (_err) {
      // no history (a test): the tab still shows
    }
  }

  /** The top bar folds on scroll into one bar with the tabs as icon pills (see systemHubPanelFold). */
  _attachFold() {
    this._fold?.detach();
    this._fold = systemHubPanelFold(this, {
      top: ".topbar",
      tabs: ".tabsbar",
      tab: ".tab",
      key: (b) => b.dataset.group,
      icons: {
        status: "mdi:heart-pulse",
        system: "mdi:server",
        reliability: "mdi:shield-check-outline",
        maintenance: "mdi:update",
        devices: "mdi:devices",
        settings: "mdi:cog",
      },
      badge: ".tbadge",
      name: ".topbar .shtitle",
      sub: ".topbar .shsub",
      icon: ".topbar .shbadge",
      status: ".topbar .shpill",
      acts: ".topbar .shzooms > *",
      subtab: "main .shtop .subtab",
      badgeColors: true,
      accent: "var(--primary-color, #03a9f4)",
      menu: () => ({ hass: this._hass, narrow: this._narrow, show: true }),
    });
  }

  _renderShell() {
    var root = this.shadowRoot;
    if (root.querySelector('.tabsbar')) return;
    root.innerHTML = `<style>${SystemHubPanel.STYLE}</style>
      <header class="topbar"></header><ha-menu-button class="bmenu" hidden></ha-menu-button>
      <div class="tabsbar"><ha-menu-button class="tabmenu"></ha-menu-button><nav class="tabs" role="tablist"></nav></div>
      <main></main>`;
    this._menus = [...root.querySelectorAll('ha-menu-button')];
    this._menu = this._menus[0];
    this._menus.forEach((menu) => {
      menu.hass = this._hass;
      menu.narrow = this._narrow;
    });
    root.querySelector('.tabs').addEventListener('click', (ev) => {
      var group = ev.target.closest?.('[data-group]')?.dataset.group;
      if (group) this._goGroup(group);
    });
    root.querySelector('.tabs').addEventListener('keydown', (ev) => {
      if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') return;
      var groups = this._groups();
      var i = groups.indexOf(shGroupOf(this._tab)) + (ev.key === 'ArrowRight' ? 1 : -1);
      this._goGroup(groups[(i + groups.length) % groups.length], 'group');
      ev.preventDefault();
    });
    // The top bar's buttons (the banner is out of main): Refresh, Settings, the tab's own settings
    root.querySelector('.topbar').addEventListener('click', (ev) => this._onClick(ev));
    root.querySelector('main').addEventListener('click', (ev) => {
      var sub = ev.target.closest?.('[data-subtab]')?.dataset.subtab;
      if (sub) return this._goTab(sub);
      this._onClick(ev);
    });
    root.querySelector('main').addEventListener('keydown', (ev) => {
      if ((ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') || !ev.target.dataset?.subtab) return;
      var subs = this._groupTabs(shGroupOf(this._tab));
      var i = subs.indexOf(this._tab) + (ev.key === 'ArrowRight' ? 1 : -1);
      this._goTab(subs[(i + subs.length) % subs.length], 'sub');
      ev.preventDefault();
    });
    root.querySelector('main').addEventListener('pointerdown', (ev) => this._cfgDragStart?.(ev));
    root.querySelector('main').addEventListener('keydown', (ev) => this._cfgDragKey?.(ev));
    root.querySelector('main').addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && this._confirm?.startsWith?.('ha_')) {
        this._confirm = null;
        this._haCheck = null;
        return this._render();
      }
      if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches?.('[role="button"][data-more]')) {
        ev.preventDefault();
        this._onClick(ev);
      }
    });
    // The network map: zoomed with the wheel, moved by dragging
    root.querySelector('main').addEventListener('wheel', (ev) => this._slWheel(ev), { passive: false });
    root.querySelector('main').addEventListener('pointerdown', (ev) => this._slPanStart(ev));
    root.querySelector('main').addEventListener('pointermove', (ev) => this._slPanMove(ev));
    root.querySelector('main').addEventListener('pointerup', () => this._slPanEnd());
    root.querySelector('main').addEventListener('pointerleave', () => this._slPanEnd());
    root.querySelector('main').addEventListener('pointerover', (ev) => this._slHoverAt(ev));
    root.querySelector('main').addEventListener('pointerout', (ev) => !ev.relatedTarget?.closest?.('svg.nsvg') && this._slHoverEnd(ev.target.closest?.('.nmap')));
    root.querySelector('main').addEventListener('input', (ev) => {
      if (ev.target.dataset?.draft) this._draft[ev.target.dataset.draft] = ev.target.value;
      // The Orphans search and filters narrow the list as they change
      if (ev.target.dataset?.draft?.startsWith('orph_')) this._render();
      if (ev.target.dataset?.draft === 'batt_search' || ev.target.dataset?.draft === 'sl_search') this._render();
    });
    this._attachFold();
  }

  // The tab of an address not applied yet (the panel opened on /system-hub/<tab> before its state was read), once;
  // else a tab that is still there
  _applyRoute() {
    if (this._routeTab && this._state) {
      var wanted = this._routeTab;
      this._routeTab = null;
      // A group in the address (/system-hub/devices) opens its first sub-tab
      if (SH_GROUPS[wanted] && !this._tabs().includes(wanted)) wanted = this._groupTabs(wanted)[0];
      if (this._tabs().includes(wanted)) this._tab = wanted;
    }
    if (!this._tabs().includes(this._tab)) this._tab = this._tabs()[0];
  }

  _render() {
    // Read for the sidebar icon only (system-hub-icons.js): nothing shown
    if (this._headless) return;
    this._renderShell();
    this._applyHeader();
    var root = this.shadowRoot;
    this._applyRoute();
    var current = shGroupOf(this._tab);
    root.querySelector('.tabs').innerHTML = this._groups()
      .map((group) => {
        var selected = group === current;
        return `<button class="tab${selected ? ' active' : ''}" role="tab" data-group="${group}" aria-selected="${selected}" tabindex="${selected ? 0 : -1}">${shEsc(this._groupName(group))}${this._groupBadge(group)}</button>`;
      })
      .join('');
    var main = root.querySelector('main');
    var active = root.activeElement;
    var focusKey = active?.dataset?.draft;
    // The button or row with the focus keeps it through the refresh every few seconds
    var focusSel = !focusKey && active && main.contains(active) ? shFocusSelector(active) : null;
    main.innerHTML = this._top() + this._content();
    // As the mockups: what opens the tab (its tiles, actions, rings) sits in the header card, under the banner
    var top = main.querySelector(':scope > .shtop');
    if (top) {
      var body = document.createElement('div');
      body.className = 'shbody';
      var next = top.nextElementSibling;
      while (next && next.tagName !== 'HA-CARD' && next.tagName !== 'H2' && next.tagName !== 'SECTION' && !next.matches('.stgroups, .mkgrid, .pair, .sctwo')) {
        var after = next.nextElementSibling;
        body.append(next);
        next = after;
      }
      if (body.children.length) top.append(body);
      // The module's settings: a round frosted button in the banner's corner, as on the cards
      var corner = top.querySelector('.shbanner');
      // The tab's own module (the first of its buttons that opens a module's settings, wherever the tab puts it)
      var settings = main.querySelector(`[data-action="open_settings:${this._tab}"]`);
      if (corner && settings) {
        // The spacer _configure put before it goes with it
        if (settings.previousElementSibling?.matches('span.grow')) settings.previousElementSibling.remove();
        var label = settings.textContent.trim();
        settings.className = 'shzoom';
        settings.title = label;
        settings.setAttribute('aria-label', label);
        for (var t of [...settings.childNodes]) if (t.nodeType === 3) t.remove();
        // The same cog as the other ha-* panels' top bars
        settings.querySelector('ha-icon')?.setAttribute('icon', 'mdi:cog');
        corner.querySelector('.shzooms')?.append(settings);
      }
    }
    // Sections side by side, as the mockups lay them out: the cards after the first ones go in two columns
    var span = { watchdog: [1, 3], backups: [0, 2], security: [0, 99] }[this._tab];
    if (span) {
      var cards = [...main.querySelectorAll(':scope > ha-card:not(.shtop), :scope > .sctwo')];
      var rest = cards.slice(...span);
      if (rest.length > 1) {
        var cols = document.createElement('div');
        cols.className = 'shcols';
        rest[0].before(cols);
        for (var c of rest) {
          if (c.matches('.sctwo')) cols.append(...c.children);
          else cols.append(c);
          if (c.matches('.sctwo')) c.remove();
        }
      }
    }
    // The Updates tab: each heading and its tiles (and the Marketplace's status) in one card, as the other sections
    if (this._tab === 'marketplace') {
      for (var h2 of [...main.querySelectorAll(':scope > h2.stsec')]) {
        var sec = document.createElement('ha-card');
        sec.className = 'mksec';
        h2.before(sec);
        var node = h2;
        while (node && (node === h2 || (node.tagName !== 'H2' && !node.matches('ha-card.list')))) {
          var following = node.nextElementSibling;
          sec.append(node);
          node = following;
        }
      }
    }
    this._mountBanner(main);
    var netSvg = main.querySelector('svg.nsvg');
    if (netSvg) this._slFixZoom(netSvg);
    if (this._tab === 'settings') this._cfgMount(main);
    // Rows and tiles that open the entity's dialog: reached and opened from the keyboard too
    main.querySelectorAll('[data-more]:not(button):not(a)').forEach((el) => {
      el.tabIndex = 0;
      el.setAttribute('role', 'button');
    });
    if (focusKey) {
      var field = main.querySelector(`[data-draft="${focusKey}"]`);
      field?.focus();
      field?.setSelectionRange?.(field.value.length, field.value.length);
    } else if (focusSel) {
      main.querySelector(focusSel)?.focus?.({ preventScroll: true });
    }
  }

  // The tab's banner goes up as the top bar, full width, the menu button before its icon; the header card keeps the
  // sub-tabs and what opens the tab, and goes when nothing is left in it
  _mountBanner(main) {
    var bar = this.shadowRoot.querySelector('.topbar');
    var top = main.querySelector(':scope > .shtop');
    var banner = top?.querySelector(':scope > .shbanner');
    if (!banner) {
      bar.replaceChildren();
      return;
    }
    var menu = this._menus[0];
    menu.hidden = false;
    banner.querySelector('.shhead')?.prepend(menu);
    // Settings as a cog beside Refresh, where the tab has no settings of its own (and not on Settings itself)
    var acts = banner.querySelector('.shzooms');
    if (acts && this._tab !== 'settings' && !acts.querySelector('[data-action^="open_settings"]')) {
      var label = shEsc(this._tabName('settings'));
      acts.insertAdjacentHTML('beforeend', `<button class="shzoom" data-action="go_settings" title="${label}" aria-label="${label}"><ha-icon icon="mdi:cog"></ha-icon></button>`);
    }
    bar.replaceChildren(banner);
    if (!top.children.length) top.remove();
  }

  // The tab's header card: its illustrated banner, then the sub-tabs of its group
  _top() {
    var banner = this._banner();
    var subtabs = this._subtabs();
    return banner || subtabs ? `<ha-card class="shtop">${banner}${subtabs}</ha-card>` : '';
  }

  // The sub-tabs of the group shown, when it has more than one module turned on
  _subtabs() {
    var subs = this._state?.loaded ? this._groupTabs(shGroupOf(this._tab)) : [];
    if (subs.length < 2) return '';
    return `<nav class="subtabs" role="tablist" aria-label="${shEsc(this._groupName(shGroupOf(this._tab)))}">${subs
      .map((tab) => {
        var selected = tab === this._tab;
        var tone = this._stArea(tab)?.[0];
        var dot = tone && tone !== 'good' ? `<span class="subdot ${tone}" aria-hidden="true"></span>` : '';
        return `<button class="subtab${selected ? ' active' : ''}" role="tab" data-subtab="${tab}" aria-selected="${selected}" tabindex="${selected ? 0 : -1}"><ha-icon icon="${SH_MODULE_ICONS[tab]}"></ha-icon>${shEsc(this._tabName(tab))}${dot}</button>`;
      })
      .join('')}</nav>`;
  }

  _content() {
    if (this._state === null && this._error) {
      return `<ha-card class="note error" role="alert">${shEsc(this._t('load_failed', { error: this._error }))}
        <button class="act" data-action="reload"><ha-icon icon="mdi:refresh"></ha-icon>${shEsc(this._t('refresh'))}</button></ha-card>`;
    }
    if (this._state === null) return `<ha-card class="note">${this._spinner(this._t('loading'))}</ha-card>`;
    if (!this._state.loaded) return `<ha-card class="note">${shEsc(this._t('not_loaded'))}</ha-card>`;
    var html = {
      status: () => this._status(),
      system: () => this._system(),
      containers: () => this._containers(),
      watchdog: () => this._watchdog(),
      marketplace: () => this._marketplace(),
      backups: () => this._backups(),
      database: () => this._database(),
      security: () => this._security(),
      logs: () => this._logs(),
      silent: () => this._silent(),
      batteries: () => this._batteries(),
      git_sync: () => this._gitSync(),
      automations: () => this._automations(),
      orphans: () => this._orphans(),
      settings: () => this._settings(),
    }[this._tab];
    return html ? html() : '';
  }

  _message(key) {
    var m = this._messages[key];
    return m ? `<span class="msg ${m.tone || ''}" role="status">${shEsc(m.text)}</span>` : '';
  }

  // A button; while its action runs (opts.busy, else this._busy[action]) a spinner replaces its icon and it is disabled
  _button(action, icon, label, opts = {}) {
    var busy = 'busy' in opts ? Boolean(opts.busy) : Boolean(this._busy[action]);
    var attrs = Object.entries(opts.data || {})
      .map(([k, v]) => ` data-${k}="${shEsc(v)}"`)
      .join('');
    var cls = `act${opts.quiet ? ' quiet' : ''}${opts.danger ? ' danger' : ''}`;
    return `<button class="${cls}" data-action="${action}"${attrs}${busy || opts.disabled ? ' disabled' : ''}${busy ? ' aria-busy="true"' : ''}>
      <ha-icon${busy ? ' class="spin"' : ''} icon="${busy ? 'mdi:loading' : icon}"></ha-icon>${shEsc(label)}</button>`;
  }

  // The module settings (Configure), at the end of a tab's buttons
  _configure() {
    return `<span class="grow"></span>${this._button(`open_settings:${this._tab}`, 'mdi:cog-outline', this._t('configure'), { quiet: true })}`;
  }

  // Something being read: a spinner and what it is
  _spinner(text, small = false) {
    return `<div class="loading${small ? ' small' : ''}" role="status" aria-busy="true"><ha-icon class="spin" icon="mdi:loading"></ha-icon>${shEsc(text)}</div>`;
  }

  // A short message in Home Assistant's own toast
  _toast(message) {
    this.dispatchEvent(new CustomEvent('hass-notification', { detail: { message }, bubbles: true, composed: true }));
  }

  _tile(icon, value, label, tone, opts = {}) {
    var card = `<ha-card class="tile ${tone || ''}${opts.entity || opts.href ? ' link' : ''}"${opts.entity ? ` data-more="${shEsc(opts.entity)}"` : ''}${opts.title ? ` title="${shEsc(opts.title)}"` : ''}>
      ${opts.spark || ''}<div class="avatar"><ha-icon icon="${icon}"></ha-icon></div>
      <div class="who"><div class="n">${value}</div><div class="s">${shEsc(label)}</div></div></ha-card>`;
    return opts.href ? `<a class="tilelink" href="${shEsc(opts.href)}" data-nav="${shEsc(opts.href)}">${card}</a>` : card;
  }

  _ago(iso) {
    if (!iso) return this._t('never');
    var date = new Date(iso);
    if (Number.isNaN(date.getTime())) return this._t('never');
    try {
      return date.toLocaleString(this._hass?.locale?.language || this._hass?.language || undefined, {
        dateStyle: 'short',
        timeStyle: 'short',
      });
    } catch (_err) {
      return date.toISOString();
    }
  }

  // A time near now in words ("5 minutes ago", "in 3 hours"), the date beyond a week; _ago gives the date and time
  _rel(iso) {
    var date = new Date(iso);
    if (!iso || Number.isNaN(date.getTime())) return this._t('never');
    var secs = (date.getTime() - Date.now()) / 1000;
    var abs = Math.abs(secs);
    if (abs >= 7 * 86400) return this._ago(iso);
    var [value, unit] = abs < 45 ? [0, 'second'] : abs < 3600 ? [secs / 60, 'minute'] : abs < 48 * 3600 ? [secs / 3600, 'hour'] : [secs / 86400, 'day'];
    try {
      return new Intl.RelativeTimeFormat(this._hass?.locale?.language || this._hass?.language || undefined, { numeric: 'auto' }).format(Math.round(value), unit);
    } catch (_err) {
      return this._ago(iso);
    }
  }

  _day(iso) {
    var date = new Date(iso);
    if (!iso || Number.isNaN(date.getTime())) return '—';
    try {
      return date.toLocaleDateString(this._hass?.locale?.language || this._hass?.language || undefined, { dateStyle: 'medium' });
    } catch (_err) {
      return iso.slice(0, 10);
    }
  }

  // System: the System Monitor sensors
  _system() {
    var sensors = this._state.system || [];
    if (!sensors.length) {
      return `${this._haControls()}<ha-card class="note">${shEsc(this._t('no_system'))}
        <a class="act" href="/config/integrations/dashboard/add?domain=systemmonitor"><ha-icon icon="mdi:plus"></ha-icon>System Monitor</a></ha-card>`;
    }
    var one = (key) => sensors.find((s) => s.key === key);
    var all = (key) => sensors.filter((s) => s.key === key);
    var cpu = one('processor_use');
    var ram = one('memory_use_percent');
    var temp = one('processor_temperature');
    var disks = all('disk_use_percent');
    // Physical interfaces only: docker0, hassio, veth… would count the same traffic twice
    var physical = (s) => !SH_VIRTUAL_IF.test(shIface(s));
    var rx = all('throughput_network_in').filter(physical);
    var txs = all('throughput_network_out').filter(physical);
    var th = { ...SH_THRESHOLDS, ...(this._state.thresholds || {}) };
    var level = (v, key) => shTone(v, th[key][0], th[key][1]);
    // Rings: the value now, the last 24 hours behind it, each kind of data in its own colour
    var ringDefs = [
      [cpu, this._t('cpu'), SH_COLORS.cpu, '%', 'cpu'],
      [ram, this._t('ram'), SH_COLORS.ram, '%', 'ram'],
      [temp, this._t('temperature'), SH_COLORS.temp, temp?.unit || '°C', 'temperature'],
      [disks[0], disks.length > 1 ? `${this._t('disk')} ${shMount(disks[0])}` : this._t('disk'), SH_COLORS.disks[0], '%', 'disk'],
    ].filter(([s]) => s);
    var ringHist = this._history(ringDefs.map(([s]) => s.entity_id), 24);
    var rings = ringDefs.map(([s, label, color, unit, key]) => this._ring(s, label, color, unit, ringHist?.[s.entity_id], level(shNum(s.state), key))).join('');
    var tiles = [];
    // Swap: its percentage, else worked out from the swap used and free (the percentage sensor is off by default)
    var swap = one('swap_use_percent');
    var swapUse = one('swap_use');
    var swapFree = one('swap_free');
    if (swap || swapUse) {
      var used = shNum(swapUse?.state);
      var free = shNum(swapFree?.state);
      var v = swap ? shNum(swap.state) : used !== null && free !== null && used + free > 0 ? (used * 100) / (used + free) : null;
      var size = used === null ? '' : ` <span class="more">${shEsc(`${used} ${swapUse.unit || ''}`.trim())}</span>`;
      tiles.push(this._tile('mdi:swap-horizontal', v === null ? '—' : `<b>${Math.round(v)}</b>%${size}`, this._t('swap'), level(v, 'swap'), { entity: (swap || swapUse).entity_id }));
    }
    var loads = ['load_1m', 'load_5m', 'load_15m'].map(one).filter(Boolean);
    if (loads.length) {
      tiles.push(
        this._tile('mdi:speedometer', loads.map((s, i) => (i ? `<span class="more">${shEsc(shNum(s.state)?.toFixed(2) ?? '—')}</span>` : `<b>${shEsc(shNum(s.state)?.toFixed(2) ?? '—')}</b>`)).join(' '), this._t('load'), '', {
          entity: loads[0].entity_id,
        }),
      );
    }
    // Received and sent since the boot, physical interfaces summed (System Monitor gives MiB)
    var totIn = all('network_in').filter(physical);
    var totOut = all('network_out').filter(physical);
    if (totIn.length || totOut.length) {
      var total = (list) => shBytes(list.reduce((sum, x) => sum + (shNum(x.state) || 0), 0) * 1024 * 1024);
      tiles.push(
        this._tile('mdi:counter', `<b class="ver">${shEsc(total(totIn))}</b> <span class="more">/ ${shEsc(total(totOut))}</span>`, this._t('network_total'), '', {
          entity: (totIn[0] || totOut[0]).entity_id,
        }),
      );
    }
    // Home Assistant Core and OS versions, orange when an update is available; Settings → Updates on a click
    var updates = this._state.updates || [];
    if (updates.length) {
      var pending = updates.filter((u) => u.state === 'on');
      // Core's version first and larger, the OS's after it
      var versions = updates
        .map((u, i) => (i ? `<span class="more">${u.key === 'core' ? 'Core' : 'OS'} ${shEsc(u.installed || '—')}</span>` : `<b class="ver">${shEsc(u.installed || '—')}</b>`))
        .join(' ');
      var full = updates.map((u) => `${u.key === 'core' ? 'Core' : 'OS'} ${u.installed || '—'}`).join(' · ');
      // Without the Supervisor, only the version running: no update to tell
      var known = updates.some((u) => u.entity_id);
      var label = pending.length
        ? this._t('update_to', { versions: pending.map((u) => `${u.key === 'core' ? 'Core' : 'OS'} ${u.latest}`).join(', ') })
        : known
          ? this._t('up_to_date')
          : 'Home Assistant';
      tiles.push(this._tile('mdi:home-assistant', versions, label, pending.length ? 'warn' : known ? 'good' : '', { href: '/config/updates', title: full }));
    }
    // Uptime: how long since the last boot (the date in the tile's title)
    var boot = one('last_boot');
    if (boot) {
      var bootAt = Date.parse(boot.state);
      var up = Number.isNaN(bootAt) ? '—' : this._uptime(Date.now() - bootAt);
      tiles.push(this._tile('mdi:clock-start', up, this._t('uptime_for'), '', { entity: boot.entity_id, title: this._day(boot.state) }));
    }
    var ip = one('ipv4_address');
    if (ip) tiles.push(this._tile('mdi:ip-network-outline', `<span class="mono">${shEsc(ip.state)}</span>`, this._t('ip_address'), '', { entity: ip.entity_id }));
    // The recorder's database, from the File Size integration
    var db = one('database_size');
    if (db) {
      var mb = shNum(db.state);
      tiles.push(this._tile('mdi:database-outline', mb === null ? '—' : `<b>${mb < 10 ? mb.toFixed(1) : Math.round(mb)}</b>${shEsc(db.unit || 'MB')}`, this._t('database'), '', { entity: db.entity_id }));
    }
    // Automatic backups (the Backup integration): the last one, orange after 2 days, red after 7 or when the last attempt
    // failed; the next one, or "Backing up…"
    var lastOk = one('backup_last_successful_automatic_backup');
    var lastTry = one('backup_last_attempted_automatic_backup');
    var nextBackup = one('backup_next_scheduled_automatic_backup');
    var manager = one('backup_backup_manager_state');
    if (lastOk || nextBackup) {
      var okAt = Date.parse(lastOk?.state);
      var tryAt = Date.parse(lastTry?.state);
      var failed = !Number.isNaN(tryAt) && (Number.isNaN(okAt) || tryAt > okAt + 60000);
      var age = Number.isNaN(okAt) ? null : (Date.now() - okAt) / 86400000;
      var tone = failed || age === null || age > 7 ? 'bad' : age > 2 ? 'warn' : 'good';
      var running = manager && manager.state !== 'idle';
      tiles.push(
        this._tile('mdi:backup-restore', shEsc(Number.isNaN(okAt) ? this._t('never') : this._rel(lastOk.state)), failed ? this._t('backup_failed') : this._t('last_backup'), tone, {
          entity: (lastOk || lastTry).entity_id,
        }),
      );
      if (nextBackup || running) {
        tiles.push(
          this._tile('mdi:calendar-clock', shEsc(running ? this._t('backing_up') : this._rel(nextBackup.state)), this._t('next_backup'), running ? 'warn' : '', {
            entity: (nextBackup || manager).entity_id,
          }),
        );
      }
    }
    var unit = (rx[0] || txs[0])?.unit || 'MB/s';
    var rate = (list) => {
      var v = list.reduce((sum, s) => sum + (shNum(s.state) || 0), 0);
      return v < 100 ? v.toFixed(1) : String(Math.round(v));
    };
    // Download and upload in one tile, in their chart colours
    if (rx.length || txs.length) {
      tiles.push(
        this._tile(
          'mdi:swap-vertical',
          `<b style="color:${SH_COLORS.download}">${rate(rx)}</b>/ <b style="color:${SH_COLORS.upload}">${rate(txs)}</b>${shEsc(unit)}`,
          `${this._t('download')} / ${this._t('upload')}`,
          '',
        ),
      );
    }
    // History charts: CPU, RAM and temperature; the network; the disks
    var charts = [];
    var systemLines = [
      [cpu, this._t('cpu'), SH_COLORS.cpu],
      [ram, this._t('ram'), SH_COLORS.ram],
      [temp, `${this._t('temperature')} (${temp?.unit || '°C'})`, SH_COLORS.temp],
    ].filter(([s]) => s);
    if (systemLines.length) charts.push(this._chart('system', this._t('chart_system'), systemLines, { max: 100, unit: '%', height: 180 }));
    var netLines = [
      ...rx.map((s) => [s, rx.length > 1 ? `${this._t('download')} · ${shIface(s)}` : this._t('download'), SH_COLORS.download]),
      ...txs.map((s) => [s, txs.length > 1 ? `${this._t('upload')} · ${shIface(s)}` : this._t('upload'), SH_COLORS.upload]),
    ];
    var diskLines = disks.map((s, i) => [s, shMount(s), SH_COLORS.disks[i % SH_COLORS.disks.length]]);
    var pair = [
      netLines.length ? this._chart('network', this._t('chart_network'), netLines, { unit, height: 130 }) : '',
      diskLines.length ? this._chart('disks', this._t('chart_disks'), diskLines, { max: 100, unit: '%', height: 130 }) : '',
    ].filter(Boolean);
    var diskList = disks.length
      ? `<ha-card class="list"><div class="lhead"><ha-icon icon="mdi:harddisk"></ha-icon><span class="lname">${shEsc(this._t('disks'))}</span></div>
        ${disks
          .map((s) => {
            var v = shNum(s.state);
            return `<div class="item link ${level(v, 'disk')}" data-more="${shEsc(s.entity_id)}"><ha-icon icon="mdi:harddisk"></ha-icon>
              <div class="who"><div class="n">${shEsc(s.name)}</div></div>
              <div class="side"><span>${v === null ? '—' : `${Math.round(v)}%`}</span><div class="meter"><span style="width:${Math.min(v || 0, 100)}%"></span></div></div></div>`;
          })
          .join('')}</ha-card>`
      : '';
    // With the Containers tab, the processes are listed there, next to the containers
    var procList = this._tabs().includes('containers') ? '' : this._processList();
    var lists = [diskList, procList].filter(Boolean);
    return `${this._haControls()}${rings ? `<div class="rings">${rings}</div>` : ''}${tiles.length ? `<div class="tiles">${tiles.join('')}</div>` : ''}
      ${charts.join('')}${pair.length ? `<div class="pair">${pair.join('')}</div>` : ''}${lists.length ? `<div class="pair">${lists.join('')}</div>` : ''}`;
  }

  // Shortcuts to the File editor (else Studio Code Server) and the Marketplace, before the buttons below: a round
  // icon each, shown only when its panel is in Home Assistant's sidebar (#133)
  _haShortcuts() {
    var panels = this._hass?.panels || {};
    return [
      ['file_editor', ['core_configurator', 'a0d7b954_vscode'], 'mdi:file-document-edit-outline'],
      ['marketplace', ['marketplace'], 'mdi:storefront-outline'],
    ]
      .map(([key, paths, icon]) => {
        var path = paths.find((p) => panels[p]);
        if (!path) return '';
        var label = shEsc(this._t(`sc_${key}`));
        return `<a class="act quiet sc" href="/${path}" data-nav="/${path}" title="${label}" aria-label="${label}"><ha-icon icon="${icon}"></ha-icon></a>`;
      })
      .join('');
  }

  // Reload the YAML configuration, restart Home Assistant and reboot the host (with the Supervisor only), each once
  // confirmed in a dialog; the restart checks the configuration first, as Home Assistant's own dialog does, and is
  // refused while it is invalid
  _haControls() {
    var reboot = this._hass?.config?.components?.includes('hassio')
      ? this._button('ha_ask:reboot', 'mdi:power-cycle', this._t('ha_reboot'), { danger: true })
      : '';
    return `<div class="actions ha-ctl">${this._message('ha')}<span class="grow"></span>${this._haShortcuts()}
      ${this._button('ha_ask:reload', 'mdi:reload', this._t('ha_reload'), { quiet: true, busy: this._busy.ha_reload })}
      ${this._button('ha_ask:restart', 'mdi:restart', this._t('ha_restart'), { danger: true })}${reboot}</div>${this._haDialog()}`;
  }

  _haDialog() {
    var kind = { ha_reload: 'reload', ha_restart: 'restart', ha_reboot: 'reboot' }[this._confirm] || null;
    if (!kind) return '';
    var check = kind === 'restart' ? this._haCheck : null;
    var status = '';
    if (check?.checking) status = this._spinner(this._t('ha_checking'), true);
    else if (check?.invalid) {
      status = `<div class="ha-check bad"><ha-icon icon="mdi:alert-circle-outline"></ha-icon><div><b>${shEsc(this._t('ha_invalid'))}</b>
        ${check.errors ? `<pre>${shEsc(check.errors)}</pre>` : ''}</div></div>`;
    } else if (check?.valid) status = `<div class="ha-check good"><ha-icon icon="mdi:check-circle-outline"></ha-icon>${shEsc(this._t('ha_valid'))}</div>`;
    var blocked = Boolean(check?.checking || check?.invalid);
    var icon = { reload: 'mdi:reload', restart: 'mdi:restart', reboot: 'mdi:power-cycle' }[kind];
    var danger = kind !== 'reload';
    return `<div class="ha-backdrop" data-action="cancel"></div>
      <div class="ha-dialog" role="alertdialog" aria-modal="true" aria-labelledby="ha-dialog-title">
        <div class="ha-dhead ${danger ? 'bad' : ''}"><ha-icon icon="${icon}"></ha-icon><span id="ha-dialog-title">${shEsc(this._t(`ha_${kind}_title`))}</span></div>
        <p>${shEsc(this._t(`ha_${kind}_text`))}</p>${status}
        <div class="actions"><span class="grow"></span>${this._button('cancel', 'mdi:close', this._t('cancel'), { quiet: true })}
          ${this._button(`ha_ok:${kind}`, icon, this._t(`ha_${kind}`), { danger, disabled: blocked })}</div></div>`;
  }

  async _haAction(action) {
    var [name, kind] = action.split(':');
    if (name === 'ha_ask') {
      this._confirm = `ha_${kind}`;
      this._haCheck = kind === 'restart' ? { checking: true } : null;
      this._render();
      this.shadowRoot.querySelector('.ha-dialog [data-action="cancel"]')?.focus?.();
      if (kind === 'restart') {
        try {
          var result = await this._hass.callApi('POST', 'config/core/check_config');
          this._haCheck = result?.result === 'invalid' ? { invalid: true, errors: result.errors || '' } : { valid: result?.result === 'valid' };
        } catch (_err) {
          // No check (the configuration panel off): Home Assistant still checks before it restarts
          this._haCheck = {};
        }
        if (this._confirm === 'ha_restart') this._render();
      }
      return;
    }
    this._confirm = null;
    if (kind === 'reload') return this._run('reload_all', 'ha', {}, null, 'homeassistant', 'ha_reload');
    // The restart and the reboot drop the connection: no failure to report then, Home Assistant's own banner takes over
    this._render();
    this._toast(this._t(kind === 'reboot' ? 'ha_rebooting' : 'ha_restarting'));
    try {
      if (kind === 'reboot') await this._hass.callService('hassio', 'host_reboot', {});
      else await this._hass.callService('homeassistant', 'restart', {});
    } catch (err) {
      if (!/connection|lost|closed/i.test(String(err?.message || err?.code || err))) {
        this._messages.ha = { text: this._t('failed', { error: shErr(err) }), tone: 'bad' };
        this._render();
      }
    }
  }

  // The processes System Monitor watches: the stopped ones first (those that may be stopped after them, in grey)
  _processList() {
    var rank = (p) => (p.state === 'on' ? 2 : p.stoppable ? 1 : 0);
    var procs = (this._state.system || []).filter((x) => x.key === 'process').sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
    var stopped = procs.filter((p) => p.state !== 'on' && !p.stoppable).length;
    var procList = procs.length
      ? `<ha-card class="list"><div class="lhead"><ha-icon icon="mdi:application-cog-outline"></ha-icon><span class="lname">${shEsc(this._t('processes'))}</span>
        ${stopped ? `<span class="pill bad">${shEsc(`${stopped} ${this._t('stopped')}`)}</span>` : `<span class="pill good">${shEsc(this._t('running'))}</span>`}</div>
        ${procs
          .map((p) => {
            var on = p.state === 'on';
            // Stopped, as allowed in the System settings: no alert
            var tone = on ? 'good' : p.stoppable ? 'idle' : 'bad';
            var label = on ? this._t('running') : p.stoppable ? this._t('stopped_allowed') : this._t('stopped');
            return `<div class="item link ${tone}" data-more="${shEsc(p.entity_id)}"><ha-icon icon="mdi:cog${on ? '' : '-off'}-outline"></ha-icon>
              <div class="who"><div class="n">${shEsc(shProcess(p))}</div></div><span class="pill ${tone}">${shEsc(label)}</span></div>`;
          })
          .join('')}</ha-card>`
      : '';
    return procList;
  }

  // "8 d 4 h", "5 h 12 min", "35 min"
  _uptime(ms) {
    var min = Math.max(0, Math.floor(ms / 60000));
    var d = Math.floor(min / 1440);
    var h = Math.floor((min % 1440) / 60);
    var m = min % 60;
    if (d) return `<b>${d}</b>${shEsc(this._t('days', { n: '' }).trim())} <b>${h}</b>${shEsc(this._t('hours', { n: '' }).trim())}`;
    if (h) return `<b>${h}</b>${shEsc(this._t('hours', { n: '' }).trim())} <b>${m}</b>${shEsc(this._t('min', { n: '' }).trim())}`;
    return `<b>${m}</b>${shEsc(this._t('min', { n: '' }).trim())}`;
  }

  // A ring: the value now over its scale (0-100, 0-100 °C for a temperature), the last 24 hours drawn behind it
  _ring(sensor, label, color, unit, values, tone) {
    var v = shNum(sensor.state);
    var c = 2 * Math.PI * 40;
    var dash = v === null ? 0 : (c * Math.min(Math.max(v, 0), 100)) / 100;
    var shown = v === null ? '—' : Math.round(v);
    return `<ha-card class="ring link" data-more="${shEsc(sensor.entity_id)}" style="--ring:${color}">
      ${values ? shArea(values, 100) : ''}
      <svg class="gauge" viewBox="0 0 100 100" aria-hidden="true"><circle class="track" cx="50" cy="50" r="40"/>
        <circle class="arc" cx="50" cy="50" r="40" stroke-dasharray="${dash.toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 50 50)"/></svg>
      <div class="rv ${tone === 'good' ? '' : tone || ''}"><b>${shown}</b><span>${shEsc(unit)}</span></div>
      <div class="rl">${shEsc(label)}</div></ha-card>`;
  }

  // A history chart: its lines over the period chosen (1 h, 6 h, 24 h or 7 days), a legend in the lines' colours
  _chart(id, title, lines, opts) {
    var hours = this._periods[id] || 24;
    var data = this._history(
      lines.map(([s]) => s.entity_id),
      hours,
    );
    var periods = [1, 6, 24, 168]
      .map((h) => {
        var label = h < 168 ? this._t('period_h', { n: h }) : this._t('period_d', { n: 7 });
        return `<button class="seg${h === hours ? ' active' : ''}" data-action="period" data-chart="${id}" data-hours="${h}" aria-pressed="${h === hours}">${shEsc(label)}</button>`;
      })
      .join('');
    var series = lines.map(([s, , color]) => ({ color, values: data?.[s.entity_id] || [] }));
    var max = opts.max || shNiceMax(series.flatMap((x) => x.values));
    var w = 1000;
    var h = opts.height;
    var grid = [0.25, 0.5, 0.75, 1].map((f) => `<line x1="0" x2="${w}" y1="${(h - f * h).toFixed(1)}" y2="${(h - f * h).toFixed(1)}"/>`).join('');
    var plot = series
      .map((x) => {
        var pts = shPoints(x.values, w, h, max);
        if (!pts.length) return '';
        return pts
          .map((seg) => `<polygon points="${seg[0].split(',')[0]},${h} ${seg.join(' ')} ${seg[seg.length - 1].split(',')[0]},${h}" fill="${x.color}" opacity=".08"/>
            <polyline points="${seg.join(' ')}" stroke="${x.color}"/>`)
          .join('');
      })
      .join('');
    var empty = data && !series.some((x) => x.values.some((v) => v !== null));
    var ticks = hours < 168 ? [hours, (hours * 3) / 4, hours / 2, hours / 4] : [7, 5, 3, 1];
    var axis = [...ticks.map((n) => (hours < 168 ? this._t('ago_h', { n: shRound(n) }) : this._t('ago_d', { n }))), this._t('now')]
      .map((label, i, list) => `<span style="left:${(i * 100) / (list.length - 1)}%">${shEsc(label)}</span>`)
      .join('');
    var top = opts.max ? `${max} ${opts.unit}` : `${shRate(max)} ${opts.unit}`;
    return `<ha-card class="chart">
      <div class="chead"><span class="ctitle">${shEsc(title)}</span><div class="segs" role="group">${periods}</div></div>
      <div class="plot" style="height:${h}px"><span class="ymax">${shEsc(top)}</span>
        <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><g class="grid">${grid}</g>${plot}</svg>
        ${data === null ? `<span class="cnote">${this._spinner(this._t('loading'), true)}</span>` : empty ? `<span class="cnote">${shEsc(this._t('chart_empty'))}</span>` : ''}</div>
      <div class="xaxis">${axis}</div>
      <div class="legend">${lines.map(([s, label, color]) => `<span class="lg link" data-more="${shEsc(s.entity_id)}"><i style="background:${color}"></i>${shEsc(label)}</span>`).join('')}</div>
    </ha-card>`;
  }

  // The recorded values of `ids` over the last `hours`, SH_BUCKETS averages each (null where nothing is known),
  // fetched once and kept a few minutes; null while the first read runs (the panel draws again once it is in)
  _history(ids, hours) {
    var now = Date.now();
    var fresh = hours <= 1 ? 60e3 : 300e3;
    var missing = ids.filter((id) => {
      var c = this._hist[`${hours}|${id}`];
      return !c || now - c.at > fresh;
    });
    var known = ids.every((id) => this._hist[`${hours}|${id}`]);
    if (missing.length && !this._histBusy[hours]) {
      this._histBusy[hours] = true;
      this._fetchHistory(missing, hours)
        .then((data) => {
          var at = Date.now();
          missing.forEach((id) => {
            this._hist[`${hours}|${id}`] = { at, values: data[id] || [] };
          });
        })
        .catch(() => {
          var at = Date.now();
          missing.forEach((id) => {
            this._hist[`${hours}|${id}`] ??= { at, values: [] };
          });
        })
        .finally(() => {
          delete this._histBusy[hours];
          if (this.isConnected && this._tab === 'system') this._render();
        });
    }
    if (!known) return null;
    return Object.fromEntries(ids.map((id) => [id, this._hist[`${hours}|${id}`].values]));
  }

  async _fetchHistory(ids, hours) {
    var end = Date.now();
    var startMs = end - hours * 3600e3;
    var start = new Date(startMs).toISOString();
    var points = {};
    if (hours > 24) {
      // A week: the recorder's hourly means
      var stats = await this._hass.callWS({ type: 'recorder/statistics_during_period', start_time: start, statistic_ids: ids, period: 'hour', types: ['mean'] });
      ids.forEach((id) => {
        points[id] = (stats?.[id] || []).map((p) => [typeof p.start === 'number' ? p.start : Date.parse(p.start), p.mean]);
      });
    } else {
      var res = await this._hass.callWS({
        type: 'history/history_during_period',
        start_time: start,
        entity_ids: ids,
        minimal_response: true,
        no_attributes: true,
        significant_changes_only: false,
      });
      ids.forEach((id) => {
        points[id] = (res?.[id] || []).map((p) => [(p.lu ?? p.lc ?? 0) * 1000, shNum(p.s)]);
      });
    }
    return Object.fromEntries(ids.map((id) => [id, shBuckets(points[id], startMs, end, SH_BUCKETS)]));
  }

  // Containers: Core, the Supervisor and the add-ons (monitoring only)
  _containers() {
    var data = this._state.containers || {};
    var list = data.containers || [];
    var running = list.filter((c) => c.state === 'started' || c.state === 'startup').length;
    var down = list.filter((c) => c.down);
    var history = data.history || {};
    var tiles = [
      this._tile('mdi:docker', `<b>${running}</b>/ ${list.length}`, this._t('running'), down.length ? 'warn' : 'good'),
      this._tile('mdi:alert-circle-outline', `<b>${down.length}</b>`, this._t('down'), down.length ? 'bad' : 'good'),
      this._tile('mdi:clock-check-outline', shEsc(this._rel(data.last_update)), this._t('last_check'), data.error ? 'bad' : ''),
    ];
    var order = { core: 0, supervisor: 1, plugin: 2, addon: 3 };
    // Core, the Supervisor and the add-ons have their own icon; the others (the plugins), Docker's
    var icons = { core: 'mdi:home-assistant', supervisor: 'mdi:shield-home-outline', addon: 'mdi:puzzle-outline' };
    var rows = [...list]
      .sort((a, b) => (b.down ? 1 : 0) - (a.down ? 1 : 0) || order[a.kind] - order[b.kind] || (a.container || a.name).localeCompare(b.container || b.name))
      .map((c) => {
        var on = c.state === 'started' || c.state === 'startup';
        var tone = c.down ? 'bad' : on ? 'good' : '';
        var cpu = shNum(c.cpu_percent);
        var mem = shNum(c.memory_percent);
        var spark = shSpark((history[c.slug] || []).map((p) => p[1]));
        // As its mockup: what it is as the title, then the container's name and its image (or its version)
        var sub = [c.container || this._t(c.kind), c.image || c.version].filter(Boolean);
        var update = c.update_available ? `<span class="pill warn" title="${shEsc(this._t('update', { version: c.version_latest }))}"><ha-icon icon="mdi:arrow-up-circle-outline"></ha-icon>${shEsc(c.version_latest || '')}</span>` : '';
        return `<div class="item ${tone}"><ha-icon icon="${icons[c.kind] || 'mdi:docker'}"></ha-icon>
          <div class="who"><div class="n">${shEsc(c.name || c.container)}</div><div class="s mono" title="${shEsc(sub.join(' · '))}">${shEsc(sub.join(' · '))}</div></div>${update}
          ${spark ? `<div class="trend ${tone}">${spark}</div>` : ''}
          <div class="side fixed">${
            on
              ? `<span>CPU ${cpu === null ? '—' : `${Math.round(cpu)}%`} · RAM ${mem === null ? '—' : `${Math.round(mem)}%`}</span>
            <div class="meter ${shTone(mem)}"><span style="width:${Math.min(mem || 0, 100)}%"></span></div>
            <span class="muted">${shBytes(c.memory_usage)}</span>`
              : ''
          }</div><span class="pill ${tone}">${shEsc(c.down ? this._t('down') : on ? this._t('running') : this._t('stopped'))}</span></div>`;
      })
      .join('');
    return `<div class="tiles">${tiles.join('')}</div>
      <div class="actions">${this._button('containers_refresh', 'mdi:refresh', this._serviceName('containers_refresh'))}${this._message('containers_refresh')}
      ${data.error ? `<span class="msg bad">${shEsc(data.error)}</span>` : ''}${this._configure()}</div>
      <ha-card class="list"><div class="lhead"><ha-icon icon="mdi:docker"></ha-icon><span class="lname">${shEsc(this._t('containers'))}</span><span class="muted">${running}/${list.length}</span></div>
      ${rows || `<div class="empty"><ha-icon icon="mdi:docker"></ha-icon>${shEsc(this._t('no_containers'))}</div>`}</ha-card>
      ${this._processList()}`;
  }

  // Watchdog: the unavailable integrations and the recent reloads
  _watchdog() {
    var data = this._state.watchdog || {};
    var unavailable = data.unavailable || [];
    var gaveUp = unavailable.filter((u) => u.gave_up);
    var tiles = [
      this._tile('mdi:puzzle-remove-outline', `<b>${unavailable.length}</b>`, this._entityName('sensor', 'watchdog_unavailable'), unavailable.length ? 'warn' : 'good'),
      this._tile('mdi:cancel', `<b>${gaveUp.length}</b>`, this._t('gave_up'), gaveUp.length ? 'bad' : 'good'),
      this._tile('mdi:restart', `<b>${data.reloads ?? 0}</b>`, this._l(`component.${SH_DOMAIN}.entity.sensor.watchdog_last_reload.state_attributes.reloads.name`) || 'Reloads', ''),
      this._tile('mdi:clock-check-outline', shEsc(data.running ? '…' : this._rel(data.last_check)), this._t('last_check'), data.paused ? 'warn' : ''),
    ];
    var rows = unavailable
      .map(
        (u) => `<div class="item ${u.gave_up ? 'bad' : 'warn'}"><ha-icon icon="mdi:puzzle-remove-outline"></ha-icon>
        <div class="who"><div class="n">${shEsc(u.title)}</div><div class="s">${shEsc(u.domain)} · ${shEsc(this._t('unavailable_since', { date: this._ago(u.since) }))}</div></div>
        ${u.gave_up ? `<span class="pill bad">${shEsc(this._t('gave_up'))}</span>` : `<span class="pill warn">${u.reloads ?? 0}/${data.max_reloads ?? ''}</span>`}
        ${this._button(`watchdog_reset:${u.entry_id}`, 'mdi:restart', this._t('try_again'), { quiet: true })}</div>`,
      )
      .join('');
    var history = (data.history || [])
      .slice(0, 50)
      .map((h) => {
        var bad = h.kind.endsWith('failed') || h.kind.endsWith('gave_up');
        var icon = h.kind.startsWith('power_cycle') ? 'mdi:power-plug-outline' : 'mdi:restart';
        return `<div class="item ${bad ? 'bad' : 'good'}"><ha-icon icon="${icon}"></ha-icon>
          <div class="who"><div class="n">${shEsc(h.title)}</div><div class="s">${shEsc(h.domain)} · ${shEsc(h.kind.replaceAll('_', ' '))}</div></div>
          <div class="side muted">${shEsc(this._rel(h.at))}</div></div>`;
      })
      .join('');
    return `<div class="tiles">${tiles.join('')}</div>
      <div class="actions">${this._button('watchdog_check', 'mdi:shield-search', this._entityName('button', 'watchdog_check'), { busy: data.running || this._busy.watchdog_check })}
      ${data.paused ? `<span class="pill warn">${shEsc(this._t('paused'))}</span>` : ''}${this._message('watchdog_check')}${this._message('watchdog_reset')}${this._configure()}</div>
      <ha-card class="list">${rows || `<div class="empty good"><ha-icon icon="mdi:check-circle-outline"></ha-icon>${shEsc(this._t('all_available'))}</div>`}</ha-card>
      ${this._powerCycles(data)}
      <ha-card class="list"><div class="lhead"><ha-icon icon="mdi:history"></ha-icon><span class="lname">${shEsc(this._t('history'))}</span></div>
      ${history || `<div class="empty">${shEsc(this._t('no_history'))}</div>`}</ha-card>`;
  }

  // The devices power cycled through their smart plug: room, plug, delays, status, count; set up in Configure
  _powerCycles(data) {
    var cycles = data.power_cycles || [];
    var rows = cycles
      .map((c) => {
        var tone = c.gave_up ? 'bad' : c.unavailable ? 'warn' : 'good';
        var status = c.gave_up ? this._t('gave_up') : c.unavailable ? this._t('pc_unavailable') : this._t('pc_available');
        var sub = [
          c.switch_name || c.switch,
          this._t('pc_line', { delay: c.delay, off: c.off_time }),
          c.count ? this._t('pc_count', { n: c.count, max: data.max_reloads ?? '' }) : '',
        ].filter(Boolean);
        var plug = c.switch_state === 'off' ? 'plug_off' : c.switch_state === 'unavailable' || c.switch_state === null ? 'plug_unavailable' : '';
        return `<div class="item ${tone}"><ha-icon icon="mdi:power-plug-outline"></ha-icon>
          <div class="who"><div class="n">${shEsc(c.device_name || this._t('unknown_device'))}${c.area ? ` <span class="muted">${shEsc(c.area)}</span>` : ''}</div>
            <div class="s">${shEsc(sub.join(' · '))}</div>${plug ? `<div class="s warn-text">${shEsc(this._t(plug))}</div>` : ''}</div>
          <span class="pill ${tone}">${shEsc(status)}</span>
          ${c.device_id ? `<a class="icon-btn" href="/config/devices/device/${shEsc(c.device_id)}" title="${shEsc(this._t('open_device'))}" aria-label="${shEsc(this._t('open_device'))}"><ha-icon icon="mdi:devices"></ha-icon></a>` : ''}</div>`;
      })
      .join('');
    return `<ha-card class="list"><div class="lhead"><ha-icon icon="mdi:power-plug-outline"></ha-icon><span class="lname">${shEsc(this._t('power_cycles'))}</span>
        ${this._button('open_settings:watchdog', 'mdi:cog-outline', this._t('pc_configure'), { quiet: true })}</div>
      ${rows || `<div class="empty">${shEsc(this._t('pc_none'))}</div>`}</ha-card>`;
  }

  // Marketplace: a header with the check (when, next, GitHub's account and quota) and the buttons, the check's
  // progress while it runs, then a card per update (logo, installed → latest with the size of the change, the start
  // of the release notes, Release notes and Update), and the repositories that could not be checked
  _marketplace() {
    var data = this._state.marketplace || {};
    var running = data.state === 'running';
    var list = data.list || [];
    // The updates waiting now (the Marketplace's update entities), not the count of the last check: one installed since
    // is gone from both the cards and the count
    var n = Array.isArray(data.list) ? list.length : data.updates || 0;
    var failedNames = data.failed || [];
    var installFailed = data.install_failed || [];
    var installing = data.installing_updates || this._busy.marketplace_install_updates;
    var title = n ? this._t(n === 1 ? 'mk_title_one' : 'mk_title', { n }) : running ? this._t('checking') : this._t('no_updates');
    var tone = data.state === 'error' ? 'bad' : n || failedNames.length || installFailed.length ? 'warn' : 'good';
    var meta = [
      data.last_check ? this._t('mk_checked', { when: this._rel(data.last_check) }) : '',
      data.scan_interval && data.next_due ? this._t('mk_next', { when: this._rel(data.next_due) }) : '',
      failedNames.length && !running ? this._t('mk_failed', { n: failedNames.length }) : '',
    ].filter(Boolean);
    // GitHub: the account connected to the Marketplace, the requests left, when it tries again after the limit
    var retry = data.retry_after && new Date(data.retry_after) > new Date() ? this._t('gh_retry', { when: this._rel(data.retry_after) }) : '';
    var github = [
      data.github_connected === false ? this._t('gh_not_connected') : data.github_connected ? this._t('gh_connected') : '',
      Number.isInteger(data.rate_limit_remaining) ? this._t('gh_requests', { n: data.rate_limit_remaining }) : '',
      data.not_checked ? this._t('not_checked', { n: data.not_checked }) : '',
    ].filter(Boolean);
    var confirm = this._confirm === 'install'
      ? `<div class="confirm" role="alertdialog">${shEsc(this._t('confirm_install'))}
          ${this._button('marketplace_install_updates', 'mdi:package-down', this._t('install_all'))}
          ${this._button('cancel', 'mdi:close', this._t('cancel'), { quiet: true })}</div>`
      : '';
    var header = `<ha-card class="mkhead ${tone}"><div class="avatar"><ha-icon icon="${running ? 'mdi:archive-sync' : n ? 'mdi:archive-alert-outline' : 'mdi:archive-check-outline'}"></ha-icon></div>
      <div class="who"><div class="n">${shEsc(title)}</div>
        ${meta.length ? `<div class="s">${shEsc(meta.join(' · '))}</div>` : ''}
        ${github.length || retry ? `<div class="s mkgh"><ha-icon icon="mdi:github"></ha-icon><span>${shEsc(github.join(' · '))}${retry ? `<span class="warn-text">${github.length ? ' · ' : ''}${shEsc(retry)}</span>` : ''}</span></div>` : ''}
        ${data.error ? `<div class="s warn-text">${shEsc(data.error)}</div>` : ''}</div>
      <div class="actions">${this._button('marketplace_check_updates', 'mdi:archive-refresh', this._entityName('button', 'marketplace_check_updates'), {
        quiet: Boolean(n),
        disabled: data.installing_updates,
        busy: running || this._busy.marketplace_check_updates,
      })}
      ${n ? this._button('confirm_install', 'mdi:package-down', `${this._t(this._state.system_updates ? 'mk_update_marketplace' : 'install_all')} (${n})`, { disabled: running, busy: installing }) : ''}
      <button class="act quiet mkgear" data-action="open_settings:marketplace" title="${shEsc(this._t('configure'))}" aria-label="${shEsc(this._t('configure'))}"><ha-icon icon="mdi:cog-outline"></ha-icon></button></div></ha-card>`;
    var cards = list.map((u) => this._mkCard(u)).join('');
    var failed = failedNames
      .map(
        (name) => `<div class="item warn"><ha-icon icon="mdi:alert-outline"></ha-icon><div class="who"><div class="n">${shEsc(name)}</div><div class="s">${shEsc(this._t('could_not_check'))}</div></div>
        ${name.includes('/') ? `<a class="act quiet" href="https://github.com/${shEsc(name)}" target="_blank" rel="noreferrer"><ha-icon icon="mdi:open-in-new"></ha-icon>GitHub</a>` : ''}</div>`,
      )
      .join('');
    // The installs that failed (after their retries), "name: error" — from this panel or the automatic updates
    var notInstalled = installFailed
      .map((text) => {
        var i = String(text).indexOf(': ');
        var name = i > 0 ? text.slice(0, i) : text;
        var why = i > 0 ? text.slice(i + 2) : '';
        return `<div class="item warn"><ha-icon icon="mdi:package-variant-remove"></ha-icon><div class="who"><div class="n">${shEsc(name)}</div><div class="s">${shEsc(this._t('could_not_install'))}${why ? ` · ${shEsc(why)}` : ''}</div></div></div>`;
      })
      .join('');
    if (list.length) this._mkFetchNotes(list);
    var system = this._state.system_updates;
    return `${system ? this._sysUpdates(system) : ''}${system ? `<h2 class="stsec">${shEsc(this._t('upd_marketplace'))}</h2>` : ''}${header}${running ? this._progress(data) : ''}${installing && !this._updRun ? this._mkRunProgress(data) : ''}${confirm}
      ${this._messages.marketplace_check_updates || this._messages.marketplace_install_updates ? `<div class="actions">${this._message('marketplace_check_updates')}${this._message('marketplace_install_updates')}</div>` : ''}
      ${cards ? `<div class="mkgrid">${cards}</div>` : ''}
      ${notInstalled && !installing ? `<ha-card class="list">${notInstalled}</ha-card>` : ''}
      ${failed && !running ? `<ha-card class="list">${failed}</ha-card>` : ''}`;
  }

  // Home Assistant's log (system_log/list): the warnings and errors kept since it started, read every minute at most
  async _lgLoad(force) {
    if (!this._hass?.callWS || (!force && this._lg?.at && Date.now() - this._lg.at < 60000)) return;
    this._lg = { ...(this._lg || {}), at: Date.now() };
    try {
      this._lg = { entries: await this._hass.callWS({ type: 'system_log/list' }), at: Date.now(), error: null };
    } catch (err) {
      this._lg = { ...this._lg, error: shErr(err) };
    }
  }

  // A message's key for Ignore: its logger and the start of its first line
  _lgKey(e) {
    return `${e.name}|${String(e.message?.[0] ?? '').slice(0, 160)}`;
  }

  // The messages by integration (homeassistant.components.<x>, custom_components.<x>, else the logger's root), the
  // ones ignored left out: level 'error' (errors only), 'warning' or 'all'; period 'hour', 'day' or 'all' (since start)
  _lgGroups(level, period) {
    var ignored = new Set(this._state.logs?.ignored_messages || []);
    var since = { hour: 3600, day: 86400 }[period];
    var now = Date.now() / 1000;
    var isError = (e) => e.level === 'ERROR' || e.level === 'CRITICAL';
    var groups = {};
    for (var e of this._lg?.entries || []) {
      if (ignored.has(this._lgKey(e)) || (since && now - e.timestamp > since)) continue;
      if ((level === 'error' && !isError(e)) || (level === 'warning' && isError(e))) continue;
      var m = /^(?:homeassistant\.components|custom_components)\.([^.]+)/.exec(e.name || '');
      var domain = m ? m[1] : (e.name || '').split('.')[0] || '?';
      var g = (groups[domain] ??= { domain, errors: 0, warnings: 0, last: 0, entries: [], custom: (e.name || '').startsWith('custom_components.') });
      g[isError(e) ? 'errors' : 'warnings'] += e.count || 1;
      g.last = Math.max(g.last, e.timestamp);
      g.entries.push(e);
    }
    return Object.values(groups)
      .map((g) => ({ ...g, entries: g.entries.sort((a, b) => b.timestamp - a.timestamp) }))
      .sort((a, b) => b.errors - a.errors || b.warnings - a.warnings || b.last - a.last);
  }

  // Logs: the errors and warnings by integration, a level and a period; each message with how many times it came, its
  // source and its traceback; Reload an integration, Ignore a message, Clear the log
  _logs() {
    if (!this._lg?.entries) {
      if (this._lg?.error) return `<ha-card class="note error" role="alert">${shEsc(this._t('failed', { error: this._lg.error }))}</ha-card>`;
      if (!this._lg) this._lgLoad().then(() => this._render());
      return `<ha-card class="note">${this._spinner(this._t('loading'))}</ha-card>`;
    }
    var level = this._lgLevel || 'all';
    var period = this._lgPeriod || 'day';
    var groups = this._lgGroups(level, period);
    var all = this._lgGroups('all', period);
    var errors = all.reduce((sum, g) => sum + g.errors, 0);
    var warnings = all.reduce((sum, g) => sum + g.warnings, 0);
    var threshold = this._state.logs?.error_threshold ?? 10;
    var ignored = (this._state.logs?.ignored_messages || []).length;
    var tiles = [
      this._tile('mdi:alert-circle-outline', `<b>${errors}</b>`, this._t('lg_errors'), errors ? (all.some((g) => g.errors >= threshold) ? 'bad' : 'warn') : 'good'),
      this._tile('mdi:alert-outline', `<b>${warnings}</b>`, this._t('lg_warnings'), warnings ? 'warn' : 'good'),
      this._tile('mdi:puzzle-outline', `<b>${all.filter((g) => g.errors || g.warnings).length}</b>`, this._t('lg_integrations'), ''),
      this._tile('mdi:eye-off-outline', `<b>${ignored}</b>`, this._t('lg_ignored'), ''),
    ];
    var seg = (action, value, current, label) =>
      `<button class="btab${value === current ? ' on' : ''}" data-action="${action}" data-value="${value}" aria-pressed="${value === current}">${shEsc(label)}</button>`;
    var filters = `<div class="btabs" role="group" aria-label="${shEsc(this._t('lg_level'))}">${seg('lg_level', 'error', level, this._t('lg_errors'))}${seg('lg_level', 'warning', level, this._t('lg_warnings'))}${seg('lg_level', 'all', level, this._t('sl_all'))}</div>
      <div class="btabs" role="group" aria-label="${shEsc(this._t('lg_period'))}">${seg('lg_period', 'hour', period, this._t('lg_hour'))}${seg('lg_period', 'day', period, this._t('lg_day'))}${seg('lg_period', 'all', period, this._t('lg_since_start'))}</div>`;
    var confirm =
      this._confirm === 'lg_clear'
        ? `<div class="confirm" role="alertdialog">${shEsc(this._t('lg_clear_confirm'))}
          ${this._button('lg_clear', 'mdi:delete-sweep-outline', this._t('lg_clear'))}${this._button('cancel', 'mdi:close', this._t('cancel'), { quiet: true })}</div>`
        : '';
    var actions = `<div class="actions">${filters}${this._message('lg')}
      <a class="act quiet" href="/config/logs"><ha-icon icon="mdi:text-box-outline"></ha-icon>${shEsc(this._t('lg_full'))}</a>
      ${this._button('lg_clear_confirm', 'mdi:delete-sweep-outline', this._t('lg_clear'), { quiet: true, busy: this._busy.lg_clear })}${this._configure()}</div>${confirm}`;
    var cards = groups
      .map((g) => {
        var head = {};
        var tone = g.errors >= threshold ? 'bad' : g.errors ? 'warn' : 'info';
        var counts = [g.errors ? this._t('lg_n_errors', { n: g.errors }) : '', g.warnings ? this._t('lg_n_warnings', { n: g.warnings }) : ''].filter(Boolean).join(' · ');
        var reload = g.domain !== 'homeassistant' ? this._button('lg_reload', 'mdi:reload', this._t('lg_reload'), { quiet: true, data: { domain: g.domain }, busy: this._busy[`lg_reload:${g.domain}`] }) : '';
        var entries = g.entries
          .map((e, i) => {
            var first = String(e.message?.[0] ?? '');
            var source = Array.isArray(e.source) ? `${String(e.source[0]).split('/').slice(-2).join('/')}:${e.source[1]}` : '';
            var trace = e.exception ? `<details><summary class="s">${shEsc(this._t('lg_traceback'))}</summary><pre class="lgpre">${shEsc(e.exception)}</pre></details>` : '';
            // As its mockup: how often and where, Ignore as an icon at the right, then the message in its box
            var key = this._lgKey(e);
            var busy = this._busy[`lg_ignore:${key}`];
            var ignore = `<button class="icon-btn lgignore" data-action="lg_ignore" data-key="${shEsc(key)}" title="${shEsc(this._t('sl_ignore'))}" aria-label="${shEsc(this._t('sl_ignore'))}"${busy ? ' disabled aria-busy="true"' : ''}><ha-icon${busy ? ' class="spin"' : ''} icon="${busy ? 'mdi:loading' : 'mdi:eye-off-outline'}"></ha-icon></button>`;
            var meta = [`×${e.count || 1}`, this._rel(new Date(e.timestamp * 1000).toISOString()), e.name].filter(Boolean).join(' · ');
            // As its mockup: the first message's count, time and logger under the integration's name, its Ignore in the
            // row; the next messages with their own line
            if (i === 0) {
              head = { meta, ignore, source };
              return `<div class="lgentry"><div class="lgmsg" title="${shEsc(source)}">${shEsc(first)}</div>${trace}</div>`;
            }
            return `<div class="lgentry"><div class="lgtop"><div class="s">${shEsc([meta, source].filter(Boolean).join(' · '))}</div>${ignore}</div>
              <div class="lgmsg">${shEsc(first)}</div>${trace}</div>`;
          })
          .join('');
        var frequent = g.errors >= threshold ? `<span class="pill bad">${shEsc(this._t('lg_frequent'))}</span>` : '';
        return `<ha-card class="list lggroup ${tone}"><div class="item lgrow ${tone}"><ha-icon icon="${g.custom ? 'mdi:puzzle-outline' : 'mdi:home-assistant'}"></ha-icon>
          <div class="who"><div class="n lgname">${shEsc(shIntegration(g.domain))}</div><div class="s">${shEsc(head.meta || '')}</div></div>
          ${frequent}<span class="pill ${tone}">${shEsc(counts)}</span>${reload}${head.ignore || ''}</div>${entries}</ha-card>`;
      })
      .join('');
    return `<div class="tiles">${tiles.join('')}</div>${actions}
      ${cards || `<ha-card class="list"><div class="empty good"><ha-icon icon="mdi:check-circle-outline"></ha-icon>${shEsc(this._t('lg_none'))}</div></ha-card>`}`;
  }

  // A message left out: saved in the module's settings at once, gone from the list
  async _lgIgnore(key) {
    this._busy[`lg_ignore:${key}`] = true;
    this._render();
    try {
      await this._hass.callWS({ type: 'system_hub/logs_ignore', key });
    } catch (err) {
      this._messages.lg = { text: this._t('failed', { error: shErr(err) }), tone: 'bad' };
    }
    delete this._busy[`lg_ignore:${key}`];
    await this._load();
  }

  // Reloads every entry of an integration (its errors often come from a lost connection)
  async _lgReload(domain) {
    this._busy[`lg_reload:${domain}`] = true;
    this._render();
    try {
      var entries = await this._hass.callWS({ type: 'config_entries/get', domain });
      if (!entries?.length) throw new Error(this._t('lg_no_entry'));
      for (var entry of entries) await this._hass.callService('homeassistant', 'reload_config_entry', { entry_id: entry.entry_id });
      this._toast(this._t('done'));
    } catch (err) {
      this._messages.lg = { text: this._t('failed', { error: shErr(err) }), tone: 'bad' };
    }
    delete this._busy[`lg_reload:${domain}`];
    this._render();
  }

  // Silent devices: the devices of the radio integrations not heard from beyond the hours set, then the weak signals
  _silent() {
    this._slRegLoad();
    var nets = this._slNets();
    var view = nets.includes(this._slView) ? this._slView : 'list';
    var vtab = (v, label) =>
      `<button class="btab${v === view ? ' on' : ''}" data-action="sl_view" data-view="${v}" aria-pressed="${v === view}">${shEsc(label)}</button>`;
    var views = nets.length
      ? `<div class="btabs nviews" role="group">${vtab('list', this._t('sl_view_list'))}${nets.map((v) => vtab(v, this._t(`sl_view_${v}`))).join('')}</div>`
      : '';
    if (view !== 'list') return views + this._slNetwork(view);
    return this._silentList(views);
  }

  // As its mockup: the counts, then the views and the integrations on one row, the devices to look at in their card
  // with what silent and weak mean under them
  _silentList(views = '') {
    var data = this._state.silent || {};
    var all = data.devices || [];
    var quiet = all.filter((d) => d.silent);
    var weak = all.filter((d) => !d.silent && d.signal?.weak);
    var kinds = data.integrations || [];
    var filter = kinds.includes(this._slFilter) ? this._slFilter : null;
    var list = filter ? all.filter((d) => d.integration === filter) : all;
    var tiles = [
      this._tile('mdi:access-point-off', `<b>${quiet.length}</b>`, this._t('sl_silent'), quiet.length ? 'warn' : 'good'),
      this._tile('mdi:wifi-strength-1-alert', `<b>${weak.length}</b>`, this._t('sl_weak'), weak.length ? 'info' : 'good'),
      this._tile('mdi:access-point', `<b>${data.tracked ?? 0}</b>`, this._t('sl_tracked'), ''),
      this._tile('mdi:eye-off-outline', `<b>${data.ignored ?? 0}</b>`, this._t('sl_ignored'), ''),
    ];
    var seg = (kind, label) =>
      `<button class="btab${(kind || null) === filter ? ' on' : ''}" data-action="sl_filter" data-kind="${shEsc(kind || '')}" aria-pressed="${(kind || null) === filter}">${shEsc(label)}</button>`;
    var filters = kinds.length > 1 ? `<div class="btabs" role="group">${seg('', this._t('sl_all'))}${kinds.map((k) => seg(k, shIntegration(k))).join('')}</div>` : '';
    var rows = list
      .map((d) => {
        var tone = d.silent ? 'warn' : 'info';
        var signal = d.signal ? `${d.signal.kind === 'lqi' ? 'LQI' : 'RSSI'} ${d.signal.value}${d.signal.kind === 'rssi' ? ' dBm' : ''}` : '';
        var power = d.battery ? (d.level === null || d.level === undefined ? this._t('sl_battery_unknown') : this._t('sl_battery', { n: d.level })) : this._t('sl_mains');
        var heard = d.unavailable ? this._t('sl_unavailable_since', { when: this._rel(d.last_heard) }) : this._t('sl_heard', { when: this._rel(d.last_heard) });
        return `<div class="item ${tone}"><ha-icon icon="${d.silent ? 'mdi:access-point-off' : 'mdi:wifi-strength-1-alert'}"></ha-icon>
          <div class="who"><div class="n">${shEsc(d.name)}</div><div class="s">${shEsc([d.area, shIntegration(d.integration), heard, signal, power].filter(Boolean).join(' · '))}</div></div>
          <span class="pill ${tone}">${shEsc(this._t(d.silent ? 'sl_silent' : 'sl_weak'))}</span>
          <a class="icon-btn" href="/config/devices/device/${encodeURIComponent(d.device_id)}" title="${shEsc(this._t('open_device'))}" aria-label="${shEsc(`${this._t('open_device')} · ${d.name}`)}"><ha-icon icon="mdi:open-in-new"></ha-icon></a>
          <button class="icon-btn" data-action="sl_ignore" data-device="${shEsc(d.device_id)}" data-name="${shEsc(d.name)}" title="${shEsc(this._t('sl_ignore'))}" aria-label="${shEsc(`${this._t('sl_ignore')} · ${d.name}`)}"${this._busy[`sl_ignore:${d.device_id}`] ? ' disabled aria-busy="true"' : ''}><ha-icon icon="mdi:eye-off-outline"></ha-icon></button></div>`;
      })
      .join('');
    var hint = this._t('sl_hint', { battery: data.battery_hours ?? 24, mains: data.mains_hours ?? 24 });
    return `<div class="tiles">${tiles.join('')}</div>
      <div class="actions">${views}<span class="grow"></span>${filters}${this._message('sl')}${this._configure()}</div>
      <ha-card class="list"><div class="lhead"><ha-icon icon="mdi:access-point-off"></ha-icon><span class="lname">${shEsc(this._tabName('silent'))} · ${list.length}</span></div>
      ${rows || `<div class="empty good"><ha-icon icon="mdi:check-circle-outline"></ha-icon>${shEsc(this._t('sl_none'))}</div>`}<span class="msg slhint">${shEsc(hint)}</span></ha-card>`;
  }

  // A device left out of the module: saved in its settings at once, gone from the list
  async _slIgnore(device, name) {
    this._busy[`sl_ignore:${device}`] = true;
    this._render();
    try {
      await this._hass.callWS({ type: 'system_hub/silent_ignore', device_id: device });
      this._toast(this._t('sl_ignored_done', { name }));
    } catch (err) {
      this._messages.sl = { text: this._t('failed', { error: shErr(err) }), tone: 'bad' };
    }
    delete this._busy[`sl_ignore:${device}`];
    await this._load();
  }

  // The device registry, read once when the Silent devices tab is shown: which networks can be drawn (ZHA or
  // Zigbee2MQTT devices, Matter devices), the Zigbee2MQTT and Matter devices' Home Assistant ids
  _slRegLoad() {
    if (this._slReg || !this._hass?.callWS) return;
    this._slReg = { devices: [], loading: true };
    this._hass
      .callWS({ type: 'config/device_registry/list' })
      .then((devices) => (this._slReg = { devices: Array.isArray(devices) ? devices : [] }))
      .catch(() => (this._slReg = { devices: [] }))
      .then(() => this._tab === 'silent' && this._render());
  }

  _slNets() {
    var has = (test) => (this._slReg?.devices || []).some((d) => !d.disabled_by && (d.identifiers || []).some(test));
    var nets = [];
    if (has(([dom, id]) => dom === 'zha' || (dom === 'mqtt' && /^zigbee2mqtt_0x/i.test(String(id))))) nets.push('zigbee');
    if (has(([dom, id]) => dom === 'zwave_js' && /^\d+-\d+$/.test(String(id)))) nets.push('zwave');
    if (has(([dom]) => dom === 'matter')) nets.push('matter');
    return nets;
  }

  // A network read when its view is shown, again after 5 minutes or on Read again
  async _slNetLoad(net, force) {
    var had = this._slMap?.[net];
    if (!this._hass?.callWS || had?.loading || (had && !force && Date.now() - had.at < 300000)) return;
    this._slMap = { ...(this._slMap || {}), [net]: { ...(had || {}), loading: true, error: null, at: Date.now() } };
    if (force) this._render();
    try {
      var graph = net === 'zigbee' ? await this._slZigbee() : net === 'zwave' ? await this._slZwave() : await this._slMatter();
      this._slMap[net] = { ...graph, loading: false, error: null, at: Date.now() };
    } catch (err) {
      this._slMap[net] = { ...(had || {}), loading: false, error: shErr(err), at: Date.now() };
    }
    if (this._tab === 'silent') this._render();
  }

  async _slZigbee() {
    if ((this._hass.config?.components || []).includes('zha')) return shZhaGraph(await this._hass.callWS({ type: 'zha/devices' }));
    return this._slZ2m();
  }

  // Zigbee2MQTT scans its network when asked (up to a minute or more): its answer on bridge/response/networkmap
  async _slZ2m() {
    var base = 'zigbee2mqtt';
    var timer;
    var unsub;
    try {
      var answer = new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(new Error(this._t('sl_net_timeout', { topic: `${base}/bridge` }))), 120000);
        unsub = this._hass.connection.subscribeMessage(
          (msg) => {
            var data;
            try {
              data = JSON.parse(msg.payload);
            } catch (_err) {
              return;
            }
            if (data?.data?.type !== 'raw') return;
            if (data.status === 'ok') resolve(data.data.value);
            else reject(new Error(data.error || 'networkmap'));
          },
          { type: 'mqtt/subscribe', topic: `${base}/bridge/response/networkmap` },
        );
      });
      await unsub;
      await this._hass.callService('mqtt', 'publish', { topic: `${base}/bridge/request/networkmap`, payload: JSON.stringify({ type: 'raw', routes: false }) });
      return shZ2mGraph(await answer, this._slReg?.devices);
    } finally {
      clearTimeout(timer);
      Promise.resolve(unsub)
        .then((stop) => stop?.())
        .catch(() => {});
    }
  }

  // Each Z-Wave network's status (one of its devices names it), then each node's statistics: the first message of their
  // subscription, read a few at a time (none after 10 s: the node is drawn under its controller)
  async _slZwave() {
    var registry = this._slReg?.devices || [];
    var homes = new Map();
    for (var dev of registry) {
      if (dev.disabled_by) continue;
      for (var [dom, id] of dev.identifiers || []) {
        var m = dom === 'zwave_js' && /^(\d+)-\d+$/.exec(String(id));
        if (m && !homes.has(m[1])) homes.set(m[1], dev.id);
      }
    }
    var networks = (await Promise.all([...homes.values()].map((device_id) => this._hass.callWS({ type: 'zwave_js/network_status', device_id }).catch(() => null))))
      .map((s) => s?.controller)
      .filter(Boolean);
    if (!networks.length) throw new Error('zwave_js/network_status');
    var graph = shZwaveGraph(networks, registry, []);
    var devices = graph.nodes.filter((n) => n.device_id && n.role !== 'coordinator').map((n) => n.device_id);
    var stats = [];
    for (var i = 0; i < devices.length; i += 8) {
      stats.push(...(await Promise.all(devices.slice(i, i + 8).map(async (d) => [d, await this._slZwaveStats(d)]))));
    }
    return shZwaveGraph(networks, registry, stats);
  }

  _slZwaveStats(device_id) {
    var conn = this._hass.connection;
    if (!conn?.subscribeMessage) return Promise.resolve(null);
    return new Promise((resolve) => {
      var unsub;
      var settled = false;
      // Once only: the timeout, the first message, a failed subscription or a message already on its way after it
      // would otherwise unsubscribe again (an error from Home Assistant for an unknown subscription)
      var done = (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
        // Read once the call has returned: a message delivered while subscribing still finds the subscription
        Promise.resolve()
          .then(() => unsub)
          .then((stop) => stop?.())
          .catch(() => {});
      };
      var timer = setTimeout(() => done(null), 10000);
      unsub = conn.subscribeMessage((msg) => done(msg || null), { type: 'zwave_js/subscribe_node_statistics', device_id });
      Promise.resolve(unsub).catch(() => done(null));
    });
  }

  // Each Matter node's diagnostics (its network and whether it routes); the devices it bridges come with it
  async _slMatter() {
    var registry = this._slReg?.devices || [];
    var mine = registry.filter((d) => !d.disabled_by && (d.identifiers || []).some(([dom]) => dom === 'matter'));
    var ids = new Set(mine.map((d) => d.id));
    var tops = mine.filter((d) => !ids.has(d.via_device_id));
    var diags = await Promise.all(tops.map((d) => this._hass.callWS({ type: 'matter/node_diagnostics', device_id: d.id }).catch(() => null)));
    return shMatterGraph(registry, tops.map((d, i) => [d.id, diags[i]]));
  }

  // The view of a network: its map beside its tree by router, the silent devices in red with their last link, a
  // device picked on either side shown on both and detailed below
  _slNetwork(net) {
    this._slNetLoad(net);
    var map = this._slMap?.[net];
    if (!map?.nodes) {
      var reload = this._button('sl_net_reload', 'mdi:refresh', this._t('sl_net_reload'), { quiet: true, data: { net }, busy: map?.loading });
      var wait = this._spinner(this._t(net === 'zigbee' && !(this._hass?.config?.components || []).includes('zha') ? 'sl_net_scanning' : 'sl_net_loading'));
      var failed = map?.error ? `<span class="msg bad" role="status">${shEsc(this._t('sl_net_failed', { error: map.error }))}</span>${reload}` : '';
      return `<ha-card class="note">${failed || wait}</ha-card>`;
    }
    var rows = new Map((this._state.silent?.devices || []).map((d) => [d.device_id, d]));
    var reg = new Map((this._slReg?.devices || []).map((d) => [d.id, d]));
    var nodes = map.nodes.map((n) => {
      var row = n.device_id ? rows.get(n.device_id) : null;
      var dev = reg.get(n.device_id);
      var area = row?.area || this._hass?.areas?.[dev?.area_id]?.name || null;
      var maker = [dev?.manufacturer, dev?.model].filter(Boolean).join(' ');
      return { ...n, row, area, maker, silent: Boolean(row?.silent) || (n.role !== 'hub' && !n.available) };
    });
    var byId = new Map(nodes.map((n) => [n.id, n]));
    // Silent only: the silent devices and the nodes they hang from
    var keep = new Set();
    for (var n of nodes.filter((x) => x.silent)) {
      for (var at = n; at && !keep.has(at.id); at = byId.get(at.parent)) keep.add(at.id);
    }
    // The search: the devices whose name or room holds it
    var query = (this._draft.sl_search || '').trim().toLowerCase();
    var found = (x) => !query || `${this._slName(x)} ${x.area || ''}`.toLowerCase().includes(query);
    var shown = (x) => (!this._slOnly || keep.has(x.id) || x.role === 'coordinator') && found(x);
    var sel = byId.get(this._slSel) ? this._slSel : null;
    var devices = nodes.filter((x) => x.role !== 'hub' && x.role !== 'coordinator');
    var silentCount = devices.filter((x) => x.silent).length;
    var counts = `<span class="pill good">${shEsc(this._t('sl_net_heard', { n: devices.length - silentCount }))}</span>
      <span class="pill ${silentCount ? 'warn' : 'good'}">${shEsc(this._t('sl_n_silent', { n: silentCount }))}</span>
      <span class="pill">${shEsc({ zha: 'ZHA', z2m: 'Zigbee2MQTT', zwave: 'Z-Wave JS' }[map.source] || 'Matter')}</span>`;
    var hint = net === 'matter' || net === 'zwave' ? `<span class="msg">${shEsc(this._t(`sl_net_${net}_hint`))}</span>` : '';
    var treeOpen = Boolean(this._slTreeOpen);
    var tree = `<ha-card class="ntree"><button class="ntoggle" data-action="sl_tree" aria-expanded="${treeOpen}">
        <ha-icon icon="mdi:chevron-${treeOpen ? 'up' : 'down'}"></ha-icon>${shEsc(this._t('sl_net_tree'))}</button>
      ${treeOpen ? `<div class="nrows">${this._slTree(nodes, sel, shown)}</div>` : ''}</ha-card>`;
    return `<div class="actions"><div class="nbar">${counts}</div></div>${hint}
      ${this._slMapSvg(net, map, nodes, sel, shown, query)}${this._slDetail(sel && byId.get(sel), byId)}${tree}`;
  }

  // The name of a node: a network's (Thread and its name, Wi-Fi, Ethernet) or the device's
  _slName(n) {
    if (n.role !== 'hub') return n.name;
    if (n.hub === 'thread') return n.name ? `Thread · ${n.name}` : 'Thread';
    return this._t(`sl_net_${n.hub}`);
  }

  // The map: laid out as a graph of forces once per reading, zoomed with the wheel and moved by dragging; each node
  // with its name and room beside it, the networks and the coordinator as squares, the routers as circles, the devices
  // as small circles, the silent ones red; a device's link points to its parent, coloured by its LQI (Zigbee)
  _slMapSvg(net, map, nodes, sel, shown, query) {
    var W = 1000;
    var H = 640;
    if (!map.pos) map.pos = shNetForce(map.nodes, map.links, W, H);
    var pos = map.pos;
    // Fitted to the map's size on screen (read once it is drawn, 1000 × 640 until then)
    this._slPxUsed = this._slPx || [1000, 640];
    var box = this._slBox?.net === net ? this._slBox.box : shNetBox(pos, ...this._slPxUsed);
    var byId = new Map(nodes.map((x) => [x.id, x]));
    var labels = this._slLabels !== false;
    var fade = (x) => (shown(x) ? '' : ' dim');
    var lines = [];
    for (var l of map.links || []) {
      var a = byId.get(l.a);
      var b = byId.get(l.b);
      if (!a || !b || a.role === 'end' || b.role === 'end' || a.parent === b.id || b.parent === a.id || !pos[a.id] || !pos[b.id]) continue;
      lines.push(`<line class="nl mesh${shown(a) && shown(b) ? '' : ' dim'}" data-a="${shEsc(a.id)}" data-b="${shEsc(b.id)}" x1="${pos[a.id][0].toFixed(1)}" y1="${pos[a.id][1].toFixed(1)}" x2="${pos[b.id][0].toFixed(1)}" y2="${pos[b.id][1].toFixed(1)}"/>`);
    }
    var size = { coordinator: 20, hub: 20, router: 13, bridge: 13, end: 9 };
    for (var x of nodes) {
      var p = byId.get(x.parent);
      if (!p || !pos[x.id] || !pos[p.id]) continue;
      // From the device to its parent, the arrow halfway (the nodes keep their size whatever the zoom)
      var [x1, y1] = pos[x.id];
      var [x2, y2] = pos[p.id];
      var mid = `${((x1 + x2) / 2).toFixed(1)},${((y1 + y2) / 2).toFixed(1)}`;
      var signal = shSignal(x);
      var tone = x.silent ? 'gone' : net === 'matter' ? (p.hub === 'thread' || byId.get(p.parent)?.hub === 'thread' ? 'thread' : p.role === 'hub' ? 'ip' : '') : signal?.tone || '';
      var width = signal ? 1.5 + signal.level * 2.5 : 2;
      var dash = x.role === 'end' ? ' end' : '';
      lines.push(`<polyline class="nl ${tone}${dash}${fade(x)}" data-a="${shEsc(x.id)}" data-b="${shEsc(p.id)}" style="stroke-width:${width.toFixed(1)}px" ${pos[x.id][3] ? '' : `marker-mid="url(#sh-arrow-${tone || 'n'})" `}points="${x1.toFixed(1)},${y1.toFixed(1)} ${mid} ${x2.toFixed(1)},${y2.toFixed(1)}"/>`);
    }
    // For the pointer over a node: its neighbours (parent, children, mesh) and its details
    var adj = new Map(nodes.map((z) => [z.id, new Set([z.id])]));
    var tie = (u, v) => {
      if (!adj.has(u) || !adj.has(v)) return;
      adj.get(u).add(v);
      adj.get(v).add(u);
    };
    for (var z of nodes) tie(z.id, z.parent);
    for (var m of map.links || []) tie(m.a, m.b);
    var roles = { coordinator: 'sl_role_coordinator', hub: 'sl_role_hub', router: 'sl_role_router', bridge: 'sl_role_bridge', end: 'sl_role_end' };
    var tips = new Map(
      nodes.map((z) => {
        var parent = byId.get(z.parent);
        var heard = z.row?.last_heard || z.seen;
        var facts = [
          [this._t('sl_net_role'), this._t(roles[z.role])],
          [this._t('sl_net_status'), z.silent ? this._t('sl_silent') + (heard ? ` · ${this._rel(heard)}` : '') : heard ? this._t('sl_heard', { when: this._rel(heard) }) : ''],
          ['LQI', z.lqi ?? ''],
          ['RSSI', z.rssi !== null && z.rssi !== undefined ? `${z.rssi} dBm` : ''],
          [this._t('sl_net_parent'), parent && z.role !== 'hub' ? this._slName(parent) : ''],
          [this._t('sl_net_model'), z.maker],
          [this._t('sl_net_area'), z.area],
        ].filter(([, v]) => v !== '' && v !== null && v !== undefined);
        return [z.id, `<b>${shEsc(this._slName(z))}</b>${facts.map(([k, v]) => `<div><span>${shEsc(k)}</span>${shEsc(v)}</div>`).join('')}`];
      }),
    );
    this._slHover = { adj, tips };
    var dots = [];
    var texts = [];
    // Shapes and names drawn at the node in screen pixels: scaled by the map's units per pixel (_slFixZoom)
    var unit = (this._slU || 1).toFixed(4);
    for (var y of nodes) {
      if (!pos[y.id]) continue;
      var [cx, cy] = pos[y.id];
      var r = size[y.role] || 9;
      var kind = y.role === 'hub' ? (y.hub === 'thread' ? 'thread' : 'ip') : y.role === 'bridge' ? 'router' : y.role;
      var hit = query && shown(y) ? ' hit' : '';
      var cls = `nn ${kind}${y.silent ? ' silent' : ''}${y.id === sel ? ' sel' : ''}${hit}${fade(y)}`;
      var name = this._slName(y);
      var shape =
        y.role === 'coordinator' || y.role === 'hub'
          ? `<rect class="nring" x="${-r - 4}" y="${-r - 4}" width="${2 * r + 8}" height="${2 * r + 8}" rx="10"/><rect x="${-r}" y="${-r}" width="${2 * r}" height="${2 * r}" rx="8"/>`
          : `<circle class="nring" r="${r + 4}"/><circle r="${r}"/>`;
      var at = `transform="translate(${cx.toFixed(1)} ${cy.toFixed(1)})"`;
      dots.push(`<g class="${cls}" data-action="sl_pick" data-node="${shEsc(y.id)}" ${at}><title>${shEsc([name, y.area].filter(Boolean).join(' · '))}</title><g class="nz" transform="scale(${unit})">${shape}</g></g>`);
      if (labels || y.id === sel || hit) {
        var text = name.length > 24 ? `${name.slice(0, 23)}…` : name;
        var sub = y.silent && y.row?.last_heard ? `${this._t('sl_silent')} · ${this._rel(y.row.last_heard)}` : y.area || '';
        // A device's name on its right; the coordinator's or a network's centred under it, clear of its neighbours
        var under = y.role === 'coordinator' || y.role === 'hub';
        var left = !under && pos[y.id][2] === -1;
        var tx = under ? 0 : left ? -r - 8 : r + 8;
        var ty = under ? r + 20 : sub ? -2 : 5;
        var anchor = under ? ' text-anchor="middle"' : left ? ' text-anchor="end"' : '';
        texts.push(`<g class="${cls}" data-action="sl_pick" data-node="${shEsc(y.id)}" ${at}><g class="nz" transform="scale(${unit})"><text x="${tx}" y="${ty}"${anchor}>${shEsc(text)}</text>${sub ? `<text class="sub" x="${tx}" y="${ty + 17}"${anchor}>${shEsc(sub)}</text>` : ''}</g></g>`);
      }
    }
    var tool = (action, icon, label, on) =>
      `<button class="ntool${on ? ' on' : ''}" data-action="${action}" data-net="${net}" title="${shEsc(label)}" aria-label="${shEsc(label)}"${on === undefined ? '' : ` aria-pressed="${Boolean(on)}"`}>${icon.startsWith('mdi:') ? `<ha-icon icon="${icon}"></ha-icon>` : icon}</button>`;
    var tools = `<div class="ntools">${tool('sl_net_reload', map.loading ? 'mdi:loading' : 'mdi:refresh', this._t('sl_net_reload'))}
      ${tool('sl_fit', 'mdi:magnify-scan', this._t('sl_net_fit'))}${tool('sl_labels', '<b>A</b>', this._t('sl_net_labels'), labels)}
      ${tool('sl_only', 'mdi:access-point-off', this._t('sl_net_only'), Boolean(this._slOnly))}</div>`;
    var search = `<div class="nsearch"><ha-icon icon="mdi:magnify"></ha-icon><input type="search" data-draft="sl_search" value="${shEsc(this._draft.sl_search || '')}" placeholder="${shEsc(this._t('sl_net_search'))}" aria-label="${shEsc(this._t('sl_net_search'))}"></div>`;
    var key = (cls, label) => `<span><i class="nd ${cls}"></i>${shEsc(label)}</span>`;
    var legend = `<div class="nlegend">${net === 'matter' ? key('thread sq', 'Thread') + key('ip sq', this._t('sl_net_ip')) : key('coordinator sq', this._t('sl_role_coordinator'))}
      ${key('router', this._t('sl_role_router'))}${key('end', this._t('sl_role_end'))}${key('silent', this._t('sl_silent'))}
      ${net === 'zigbee' || net === 'zwave' ? `<span class="nlq">${shEsc(this._t('sl_net_legend'))}</span>` : ''}</div>`;
    return `<ha-card class="nmap">${search}${tools}<div class="ntip" hidden></div>
      <svg class="nsvg" data-net="${net}" viewBox="${box.map((v) => v.toFixed(1)).join(' ')}" role="img" aria-label="${shEsc(this._t('sl_net_map'))}">
        <defs>${['n', 'good', 'warn', 'bad', 'thread', 'ip', 'gone'].map((t) => `<marker id="sh-arrow-${t}" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="${(3 * unit).toFixed(2)}" markerHeight="${(3 * unit).toFixed(2)}" orient="auto"><path class="na ${t}" d="M0,0 L10,5 L0,10 z"/></marker>`).join('')}</defs>
        ${lines.join('')}${dots.join('')}${texts.join('')}</svg>${legend}</ha-card>`;
  }

  // The map zoomed around the pointer with the wheel, moved by dragging; a drag is not a click on a node
  _slWheel(ev) {
    var svg = ev.target.closest?.('svg.nsvg');
    if (!svg) return;
    ev.preventDefault();
    var box = svg.getAttribute('viewBox').split(' ').map(Number);
    var rect = svg.getBoundingClientRect();
    var scale = Math.min(box[2] / rect.width, box[3] / rect.height);
    var fx = box[0] + (ev.clientX - rect.left - (rect.width - box[2] / scale) / 2) * scale;
    var fy = box[1] + (ev.clientY - rect.top - (rect.height - box[3] / scale) / 2) * scale;
    var k = ev.deltaY > 0 ? 1.15 : 1 / 1.15;
    var w = Math.min(Math.max(box[2] * k, 150), 6000);
    var h = (box[3] * w) / box[2];
    var next = [fx - ((fx - box[0]) * w) / box[2], fy - ((fy - box[1]) * h) / box[3], w, h];
    this._slBox = { net: svg.dataset.net, box: next };
    svg.setAttribute('viewBox', next.map((v) => v.toFixed(1)).join(' '));
    this._slFixZoom(svg);
  }

  // The map's units per screen pixel, given to the shapes and names (which keep their size) and to the arrows
  _slFixZoom(svg) {
    var rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    // The map fitted for another size than its own: fitted again once
    this._slPx = [Math.round(rect.width), Math.round(rect.height)];
    var used = this._slPxUsed || [];
    if (!this._slBox && (this._slPx[0] !== used[0] || this._slPx[1] !== used[1])) {
      this._slPxUsed = this._slPx;
      requestAnimationFrame(() => this._render());
    }
    var box = svg.getAttribute('viewBox').split(' ').map(Number);
    var unit = Math.max(box[2] / rect.width, box[3] / rect.height);
    this._slU = unit;
    // Zoomed out, the names would run into each other: the rooms go first, then the end devices' names (still shown
    // for the device pointed at, picked or found)
    svg.classList.toggle('dense', unit > 1.4);
    svg.classList.toggle('crowded', unit > 2.2);
    for (var g of svg.querySelectorAll('.nz')) g.setAttribute('transform', `scale(${unit.toFixed(4)})`);
    for (var m of svg.querySelectorAll('marker')) {
      m.setAttribute('markerWidth', (3 * unit).toFixed(2));
      m.setAttribute('markerHeight', (3 * unit).toFixed(2));
    }
  }

  _slPanStart(ev) {
    var svg = ev.target.closest?.('svg.nsvg');
    if (!svg || ev.button !== 0) return;
    var box = svg.getAttribute('viewBox').split(' ').map(Number);
    var rect = svg.getBoundingClientRect();
    this._slPan = { svg, x: ev.clientX, y: ev.clientY, box, scale: Math.max(box[2] / rect.width, box[3] / rect.height), moved: false };
  }

  _slPanMove(ev) {
    var pan = this._slPan;
    if (!pan) return;
    var dx = ev.clientX - pan.x;
    var dy = ev.clientY - pan.y;
    if (!pan.moved && Math.hypot(dx, dy) < 4) return;
    pan.moved = true;
    var next = [pan.box[0] - dx * pan.scale, pan.box[1] - dy * pan.scale, pan.box[2], pan.box[3]];
    this._slBox = { net: pan.svg.dataset.net, box: next };
    pan.svg.setAttribute('viewBox', next.map((v) => v.toFixed(1)).join(' '));
  }

  _slPanEnd() {
    if (this._slPan?.moved) this._slDragged = Date.now();
    this._slPan = null;
  }

  // The pointer over a node: it and its neighbours stand out, the rest fades, its details beside it
  _slHoverAt(ev) {
    var svg = ev.target.closest?.('svg.nsvg');
    var g = svg && !this._slPan?.moved ? ev.target.closest('[data-node]') : null;
    var card = (svg || ev.target).closest?.('.nmap');
    var tip = card?.querySelector('.ntip');
    if (!g || !this._slHover?.adj.has(g.dataset.node)) {
      if (svg || ev.type === 'pointerleave') this._slHoverEnd(card);
      return;
    }
    var id = g.dataset.node;
    var near = this._slHover.adj.get(id);
    svg.classList.add('focusing');
    for (var el of svg.querySelectorAll('[data-node]')) el.classList.toggle('near', near.has(el.dataset.node));
    for (var line of svg.querySelectorAll('.nl[data-a]')) line.classList.toggle('near', line.dataset.a === id || line.dataset.b === id);
    if (!tip) return;
    tip.innerHTML = this._slHover.tips.get(id) || '';
    tip.hidden = false;
    var box = card.getBoundingClientRect();
    var x = ev.clientX - box.left + 16;
    var y = ev.clientY - box.top + 16;
    tip.style.left = `${Math.min(x, box.width - tip.offsetWidth - 8)}px`;
    tip.style.top = `${Math.min(y, box.height - tip.offsetHeight - 8)}px`;
  }

  _slHoverEnd(card) {
    var svg = card?.querySelector('svg.nsvg');
    svg?.classList.remove('focusing');
    for (var el of svg?.querySelectorAll('.near') || []) el.classList.remove('near');
    var tip = card?.querySelector('.ntip');
    if (tip) tip.hidden = true;
  }

  // The tree: the coordinator (or each network), its routers, their devices; the silent ones say since when
  _slTree(nodes, sel, shown) {
    var { kids, roots } = shNetTree(nodes);
    var order = (a, b) => SH_NET_RANK[a.role] - SH_NET_RANK[b.role] || b.silent - a.silent || a.name.localeCompare(b.name);
    var icons = { coordinator: 'mdi:access-point', hub: 'mdi:access-point', router: 'mdi:google-circles-communities', bridge: 'mdi:link-variant', end: 'mdi:chip' };
    var out = [];
    var walk = (node, depth, seen) => {
      if (seen.has(node.id)) return;
      seen.add(node.id);
      if (shown(node)) {
        var side = '';
        if (node.silent) {
          side = `<span class="pill warn">${shEsc(this._t('sl_silent'))}${node.row?.last_heard ? ` · ${shEsc(this._rel(node.row.last_heard))}` : ''}</span>`;
        } else if (shSignal(node)) {
          var signal = shSignal(node);
          side = `<span class="pill ${signal.tone === 'good' ? 'good' : signal.tone === 'warn' ? 'info' : 'warn'}">${shEsc(signal.text)}</span>`;
        } else if (node.seen) side = `<span class="s">${shEsc(this._rel(node.seen))}</span>`;
        var icon = node.role === 'hub' && (node.hub === 'wifi' || node.hub === 'ethernet') ? 'mdi:ip-network-outline' : icons[node.role];
        out.push(`<button class="nrow${node.silent ? ' silent' : ''}${node.id === sel ? ' sel' : ''}" style="padding-left:${8 + depth * 18}px" data-action="sl_pick" data-node="${shEsc(node.id)}" aria-pressed="${node.id === sel}">
          <ha-icon icon="${node.silent ? 'mdi:access-point-off' : icon}"></ha-icon><span class="nn-name">${shEsc(this._slName(node))}</span>${side}</button>`);
      }
      for (var c of (kids.get(node.id) || []).sort(order)) walk(c, depth + 1, seen);
    };
    var seen = new Set();
    for (var r of roots.sort(order)) walk(r, 0, seen);
    return out.join('') || `<div class="empty">${shEsc(this._t('sl_net_empty'))}</div>`;
  }

  // The device picked: its role, its room, when it was last heard, its parent and link, its battery; its page, Ignore
  _slDetail(n, byId) {
    if (!n) return '';
    var row = n.row;
    var role = { coordinator: 'sl_role_coordinator', hub: 'sl_role_hub', router: 'sl_role_router', bridge: 'sl_role_bridge', end: 'sl_role_end' }[n.role];
    var parent = byId.get(n.parent);
    var heard = row
      ? row.unavailable
        ? this._t('sl_unavailable_since', { when: this._rel(row.last_heard) })
        : this._t('sl_heard', { when: this._rel(row.last_heard) })
      : n.seen
        ? this._t('sl_heard', { when: this._rel(n.seen) })
        : '';
    var power = row?.battery ? (row.level === null || row.level === undefined ? this._t('sl_battery_unknown') : this._t('sl_battery', { n: row.level })) : '';
    var via = parent && n.role !== 'hub' ? this._t('sl_net_via', { name: this._slName(parent) }) + (shSignal(n) ? ` (${shSignal(n).text})` : '') : '';
    var bits = [this._t(role), row?.area, heard, via, power].filter(Boolean).join(' · ');
    var open = n.device_id ? `<a class="act quiet" href="/config/devices/device/${encodeURIComponent(n.device_id)}"><ha-icon icon="mdi:open-in-new"></ha-icon>${shEsc(this._t('open_device'))}</a>` : '';
    var ignore = row ? this._button('sl_ignore', 'mdi:eye-off-outline', this._t('sl_ignore'), { quiet: true, data: { device: row.device_id, name: row.name }, busy: this._busy[`sl_ignore:${row.device_id}`] }) : '';
    return `<ha-card class="ndetail${n.silent ? ' silent' : ''}"><div class="who"><div class="n">${shEsc(this._slName(n))}</div><div class="s">${shEsc(bits)}</div></div>
      <span class="ndact">${open}${ignore}</span></ha-card>`;
  }

  // Home Assistant's backups (the Backup integration's backup/info and its locations), read when the tab is shown
  async _bkLoad(force) {
    if (!this._hass?.callWS || (!force && this._bk?.at && Date.now() - this._bk.at < 60000)) return;
    this._bk = { ...(this._bk || {}), at: Date.now() };
    try {
      var [info, agents] = await Promise.all([
        this._hass.callWS({ type: 'backup/info' }),
        this._hass.callWS({ type: 'backup/agents/info' }).catch(() => ({ agents: [] })),
      ]);
      this._bk = { info, agents: agents?.agents || [], at: Date.now(), error: null };
    } catch (err) {
      this._bk = { ...this._bk, error: shErr(err) };
    }
    if (this._tab === 'backups') this._render();
  }

  // The last automatic backups and the locations: from backup/info once read, else from the Backup sensors
  _bkSummary() {
    var max = this._state.backups?.max_age ?? 3;
    var info = this._bk?.info;
    var sensor = (key) => (this._state.system || []).find((x) => x.key === key)?.state;
    var valid = (v) => (v && !Number.isNaN(Date.parse(v)) ? v : null);
    var lastOk = valid(info ? info.last_completed_automatic_backup : sensor('backup_last_successful_automatic_backup'));
    var lastTry = valid(info ? info.last_attempted_automatic_backup : sensor('backup_last_attempted_automatic_backup'));
    var next = valid(info ? info.next_automatic_backup : sensor('backup_next_scheduled_automatic_backup'));
    if (!info && !lastOk && !lastTry && !next) return null;
    var failed = Boolean(lastTry && (!lastOk || Date.parse(lastTry) > Date.parse(lastOk)));
    var old = !lastOk || Date.now() - Date.parse(lastOk) > max * 86400000;
    var backups = [...(info?.backups || [])].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
    var names = Object.fromEntries((this._bk?.agents || []).map((a) => [a.agent_id, a.name || a.agent_id]));
    var ids = [...new Set([...Object.keys(names), ...backups.flatMap((b) => Object.keys(b.agents || {}))])];
    var lastAuto = backups.find((b) => b.with_automatic_settings);
    var agents = ids.map((id) => {
      var mine = backups.filter((b) => b.agents?.[id]);
      var error = info?.agent_errors?.[id] || '';
      return { id, name: names[id] || id, last: mine[0]?.date || null, count: mine.length, error, failed: Boolean(error) || Boolean(lastAuto?.failed_agent_ids?.includes(id)) };
    });
    var failing = agents.filter((a) => a.failed);
    var tone = failed ? 'bad' : old || failing.length ? 'warn' : 'good';
    return { max, lastOk, lastTry, next, failed, old, backups, agents, failing, tone };
  }

  // The size of a backup: the largest copy among its locations
  _bkSize(b) {
    var sizes = Object.values(b?.agents || {}).map((a) => a?.size).filter((v) => typeof v === 'number');
    return sizes.length ? shBytes(Math.max(...sizes)) : '—';
  }

  // Backups: the last success, the next one, the size, each location and the last 30 days; Back up now
  _backups() {
    if (!this._bk?.info) {
      if (!this._bk) this._bkLoad();
      if (this._bk?.error) {
        return `<ha-card class="note error" role="alert">${shEsc(this._t('bk_read_failed', { error: this._bk.error }))}
          <button class="act" data-action="reload"><ha-icon icon="mdi:refresh"></ha-icon>${shEsc(this._t('refresh'))}</button></ha-card>`;
      }
      return `<ha-card class="note">${this._spinner(this._t('loading'))}</ha-card>`;
    }
    var bk = this._bkSummary();
    var running = this._bk.info.state && this._bk.info.state !== 'idle';
    var okAgents = bk.agents.filter((a) => !a.failed).length;
    var tiles = [
      this._tile('mdi:backup-restore', shEsc(bk.lastOk ? this._rel(bk.lastOk) : this._t('never')), bk.failed ? this._t('backup_failed') : this._t('last_backup'), bk.failed ? 'bad' : bk.old ? 'warn' : 'good'),
      this._tile('mdi:calendar-clock', shEsc(running ? this._t('backing_up') : bk.next ? this._rel(bk.next) : '—'), this._t('next_backup'), running ? 'warn' : ''),
      this._tile('mdi:harddisk', shEsc(this._bkSize(bk.backups[0])), this._t('bk_size'), ''),
      this._tile('mdi:server-network', shEsc(this._t('bk_locations_ok', { ok: okAgents, total: bk.agents.length })), this._t('bk_locations'), bk.failing.length ? 'warn' : bk.agents.length ? 'good' : ''),
    ];
    var actions = `<div class="actions">${bk.old && !bk.failed ? `<span class="msg warn-text">${shEsc(this._t('bk_old', { n: bk.max }))}</span>` : ''}${this._message('bk')}
      <span class="grow"></span>
      <a class="act quiet" href="/config/backup/settings"><ha-icon icon="mdi:cog-outline"></ha-icon>${shEsc(this._t('bk_settings'))}</a>
      ${this._button('bk_now', 'mdi:content-save-outline', this._t('bk_now'), { busy: running || this._busy.bk_now })}</div>`;
    var agents = bk.agents
      .map(
        (a) => `<div class="item${a.failed ? ' warn' : ''}"><ha-icon icon="${a.failed ? 'mdi:alert-outline' : 'mdi:check-circle-outline'}"></ha-icon>
        <div class="who"><div class="n">${shEsc(a.name)}</div><div class="s">${shEsc([a.last ? `${this._t('last_backup')} ${this._rel(a.last)}` : this._t('never'), this._t('bk_kept', { n: a.count }), a.error].filter(Boolean).join(' · '))}</div></div>
        <span class="pill ${a.failed ? 'bad' : 'good'}">${shEsc(this._t(a.failed ? 'bk_failed_location' : 'bk_ok_location'))}</span></div>`,
      )
      .join('');
    // The last 30 days, oldest first: a backup that day, the last attempt failed that day, or nothing
    var day = (v) => new Date(v).toDateString();
    var done = new Set(bk.backups.map((b) => day(b.date)));
    var days = Array.from({ length: 30 }, (_v, i) => {
      var d = new Date(Date.now() - (29 - i) * 86400000);
      var cls = done.has(d.toDateString()) ? 'ok' : bk.failed && day(bk.lastTry) === d.toDateString() ? 'bad' : '';
      return `<span class="bkday ${cls}" title="${shEsc(d.toLocaleDateString(this._hass?.language))}"></span>`;
    }).join('');
    var list = bk.backups
      .slice(0, 10)
      .map(
        (b) => `<a class="item link" href="/config/backup/details/${encodeURIComponent(b.backup_id)}"><ha-icon icon="mdi:archive-outline"></ha-icon>
        <div class="who"><div class="n">${shEsc(b.name || b.backup_id)}</div><div class="s">${shEsc(
          [this._rel(b.date), this._t(b.with_automatic_settings ? 'bk_auto' : 'bk_manual'), Object.keys(b.agents || {}).map((id) => bk.agents.find((a) => a.id === id)?.name || id).join(', ')].join(' · '),
        )}</div></div><span class="pill">${shEsc(this._bkSize(b))}</span></a>`,
      )
      .join('');
    return `<div class="tiles">${tiles.join('')}</div>${actions}
      ${agents ? `<ha-card class="list"><div class="lhead"><ha-icon icon="mdi:server-network"></ha-icon><span class="lname">${shEsc(this._t('bk_locations'))}</span></div>${agents}</ha-card>` : ''}
      <ha-card class="block"><h2>${shEsc(this._t('bk_days'))}</h2><div class="bkdays" role="img" aria-label="${shEsc(this._t('bk_days'))}">${days}</div></ha-card>
      <ha-card class="list"><div class="lhead"><ha-icon icon="mdi:archive-outline"></ha-icon><span class="lname">${shEsc(this._t('bk_list'))}</span><span class="muted">${bk.backups.length}</span></div>${list || `<div class="item"><div class="who"><div class="s">${shEsc(this._t('bk_none'))}</div></div></div>`}</ha-card>`;
  }

  // The recorder's database (system_hub/database): read every 5 minutes at most; the server counts the states once an
  // hour, force counts them again
  async _dbLoad(force, recount) {
    if (!this._hass?.callWS || (!force && this._db?.at && Date.now() - this._db.at < 300000)) return;
    this._db = { ...(this._db || {}), at: Date.now() };
    if (recount) this._busy.db_refresh = true;
    try {
      this._db = { data: await this._hass.callWS({ type: 'system_hub/database', force: Boolean(recount) }), at: Date.now(), error: null };
      await this._dbGrowthLoad(this._db.data?.entity_id);
    } catch (err) {
      this._db = { ...this._db, error: shErr(err) };
    }
    delete this._busy.db_refresh;
    if (this._tab === 'database' || recount) this._render();
  }

  // The growth: the daily means of the size sensor over 30 days (recorder statistics, in bytes), read once an hour
  async _dbGrowthLoad(entityId) {
    if (!entityId || (this._dbStats?.id === entityId && Date.now() - this._dbStats.at < 3600000)) return;
    try {
      var start = new Date(Date.now() - 30 * 86400e3).toISOString();
      var stats = await this._hass.callWS({
        type: 'recorder/statistics_during_period',
        start_time: start,
        statistic_ids: [entityId],
        period: 'day',
        types: ['mean'],
        units: { information: 'B' },
      });
      var points = (stats?.[entityId] || [])
        .map((p) => [typeof p.start === 'number' ? p.start : Date.parse(p.start), shNum(p.mean)])
        .filter((p) => p[1] !== null);
      this._dbStats = { id: entityId, at: Date.now(), points };
    } catch (_err) {
      // No statistics yet (or the recorder's API refused): no growth tile
      this._dbStats = { id: entityId, at: Date.now(), points: [] };
    }
  }

  // The change of size over the last 7 days (or since the first day kept, when fewer), and the line of the 30 days
  _dbGrowth(size) {
    var points = this._dbStats?.points || [];
    if (!points.length) return null;
    var now = typeof size === 'number' ? size : points[points.length - 1][1];
    var since = Date.now() - 7 * 86400e3;
    var from = points.find((p) => p[0] >= since - 43200e3) || points[0];
    var days = Math.max(1, Math.round((Date.now() - from[0]) / 86400e3));
    var values = points.map((p) => p[1]);
    var lo = Math.min(...values, now);
    var hi = Math.max(...values, now);
    var spark = shSpark([...values, now].map((v) => (hi > lo ? ((v - lo) / (hi - lo)) * 100 : 50)));
    return { delta: now - from[1], days, spark };
  }

  // The size against the limit set: bad beyond it, warn from 80 %
  _dbTone(size) {
    var max = (this._state.database?.max_size ?? 2) * 1073741824;
    return typeof size !== 'number' ? '' : size > max ? 'bad' : size > max * 0.8 ? 'warn' : 'good';
  }

  // The lines to add to configuration.yaml so that the recorder no longer records the entities chosen
  _dbYaml(entities) {
    return ['recorder:', '  exclude:', '    entities:', ...entities.map((e) => `      - ${e}`)].join('\n');
  }

  async _dbCopy() {
    try {
      await navigator.clipboard.writeText(this._dbYaml([...(this._dbSel || [])]));
      this._toast(this._t('db_copied'));
    } catch (err) {
      this._messages.db = { text: this._t('failed', { error: shErr(err) }), tone: 'bad' };
      this._render();
    }
  }

  // Database: its size, its retention, the states of the day; the devices that wrote the most, each unfolding to its
  // entities that wrote the most, to purge their history or to leave them out of the recorder; Purge and repack
  _database() {
    var data = this._db?.data;
    if (!data) {
      if (this._db?.error) {
        return `<ha-card class="note error" role="alert">${shEsc(this._t('failed', { error: this._db.error }))}
          <button class="act" data-action="db_refresh"><ha-icon icon="mdi:refresh"></ha-icon>${shEsc(this._t('refresh'))}</button></ha-card>`;
      }
      if (!this._db) this._dbLoad();
      return `<ha-card class="note">${this._spinner(this._t('loading'))}</ha-card>`;
    }
    var max = this._state.database?.max_size ?? 2;
    var sel = (this._dbSel ??= new Set());
    var top = data.top || [];
    var counted = new Set(top.flatMap((d) => d.entity_ids || []));
    for (var id of [...sel]) if (!counted.has(id)) sel.delete(id);
    var tone = this._dbTone(data.size);
    var tiles = [
      this._tile('mdi:database-outline', shEsc(typeof data.size === 'number' ? shBytes(data.size) : '—'), this._t('db_size'), tone, {
        title: typeof data.size === 'number' ? this._t('db_limit', { n: max }) : this._t('db_no_size'),
      }),
    ];
    var growth = this._dbGrowth(data.size);
    if (growth) {
      var sign = growth.delta > 0 ? '+' : growth.delta < 0 ? '−' : '';
      tiles.push(
        this._tile('mdi:chart-line-variant', shEsc(`${sign}${shBytes(Math.abs(growth.delta))}`), this._t('db_growth', { n: growth.days }), '', {
          spark: growth.spark,
          title: this._t('db_growth_title'),
          entity: data.entity_id,
        })
      );
    }
    // What a repack would give back: the free pages of SQLite, the free space of the MariaDB / MySQL tables
    if (typeof data.free === 'number' && data.free >= 1048576) {
      tiles.push(this._tile('mdi:broom', shEsc(shBytes(data.free)), this._t('db_free'), '', { title: this._t('db_free_title') }));
    }
    tiles.push(
      this._tile('mdi:calendar-range', shEsc(this._t('db_days', { n: data.keep_days })), this._t(data.auto_purge ? 'db_retention' : 'db_no_auto_purge'), data.auto_purge ? '' : 'warn'),
      this._tile('mdi:chart-timeline-variant', `<b>${(data.total_day ?? 0).toLocaleString(this._hass?.language)}</b>`, this._t('db_states_day'), ''),
      this._tile('mdi:database-cog-outline', shEsc(data.engine === 'sqlite' ? 'SQLite' : data.engine === 'postgresql' ? 'PostgreSQL' : data.engine === 'mysql' ? 'MariaDB / MySQL' : data.engine), this._t('db_engine'), '')
    );
    var confirm =
      this._confirm === 'db_repack'
        ? `<div class="confirm" role="alertdialog">${shEsc(this._t('db_repack_confirm', { n: data.keep_days }))}
          ${this._button('db_repack', 'mdi:database-refresh-outline', this._t('db_repack'))}${this._button('cancel', 'mdi:close', this._t('cancel'), { quiet: true })}</div>`
        : '';
    var actions = `<div class="actions">${tone === 'bad' ? `<span class="msg warn-text">${shEsc(this._t('db_over', { n: max }))}</span>` : ''}${this._message('db')}
      <span class="grow"></span>
      ${this._button('db_refresh', 'mdi:refresh', this._t('db_recount'), { quiet: true, busy: this._busy.db_refresh })}
      ${this._button('db_repack_confirm', 'mdi:database-refresh-outline', this._t('db_repack'), { quiet: true, busy: this._busy.db_repack })}${this._configure()}</div>${confirm}`;
    var total = data.total_day || 0;
    var share = (n) => (total ? Math.round((n / total) * 100) : 0);
    var count = (n, pct) =>
      `<span class="dbcount"><b>${n.toLocaleString(this._hass?.language)}</b><span class="s">${pct} %</span></span>`;
    var open = (this._dbOpen ??= new Set());
    var rows = top.map((d) => this._dbDevice(d, sel, open, share, count)).join('');
    var chosen = [...sel];
    var purge =
      this._confirm === 'db_purge'
        ? `<div class="confirm" role="alertdialog">${shEsc(this._t('db_purge_confirm', { n: chosen.length }))}
          ${this._button('db_purge', 'mdi:delete-clock-outline', this._t('db_purge'))}${this._button('cancel', 'mdi:close', this._t('cancel'), { quiet: true })}</div>`
        : '';
    var picked = chosen.length
      ? `<div class="dbpick"><div class="actions">${this._button('db_purge_confirm', 'mdi:delete-clock-outline', `${this._t('db_purge')} (${chosen.length})`, { busy: this._busy.db_purge })}</div>${purge}
        <div class="s">${shEsc(this._t('db_exclude'))}</div>
        <div class="dbyaml"><pre class="lgpre">${shEsc(this._dbYaml(chosen))}</pre>${this._button('db_copy', 'mdi:content-copy', this._t('db_copy'), { quiet: true })}</div></div>`
      : `<div class="item"><div class="who"><div class="s">${shEsc(this._t(top.length ? 'db_pick_hint' : 'db_none'))}</div></div></div>`;
    return `<div class="tiles">${tiles.join('')}</div>${actions}
      <ha-card class="list"><div class="lhead"><ha-icon icon="mdi:chart-bar"></ha-icon><span class="lname">${shEsc(this._t('db_top'))}</span>
        <span class="muted">${shEsc(this._t('db_counted', { when: this._rel(new Date(data.counted_at * 1000).toISOString()) }))}</span></div>${rows}${picked}</ha-card>
      ${this._dbTables(data)}`;
  }

  // The tables: their rows and their size, the biggest first, each bar its share of the size (of the rows when the
  // engine cannot tell the sizes); MariaDB / MySQL and PostgreSQL estimate the rows
  _dbTables(data) {
    var tables = data.tables || [];
    if (!tables.length) return '';
    var sized = tables.some((t) => typeof t.size === 'number' && t.size > 0);
    var key = sized ? 'size' : 'rows';
    var total = tables.reduce((sum, t) => sum + (t[key] || 0), 0);
    var approx = data.engine !== 'sqlite' ? '≈ ' : '';
    var lang = this._hass?.language;
    var rows = tables
      .map((t) => {
        var pct = total ? Math.round(((t[key] || 0) / total) * 100) : 0;
        var sub = `${approx}${this._t(t.rows === 1 ? 'db_rows_one' : 'db_rows', { n: (t.rows || 0).toLocaleString(lang) })}`;
        var value = sized ? shBytes(t.size || 0) : (t.rows || 0).toLocaleString(lang);
        return `<div class="item dbtable"><ha-icon icon="mdi:table"></ha-icon>
          <div class="who"><div class="n">${shEsc(t.name)}</div><div class="s">${shEsc(sub)}</div>
            <div class="dbbar"><span style="width:${Math.max(pct, 1)}%"></span></div></div>
          <span class="dbcount"><b>${shEsc(value)}</b><span class="s">${pct} %</span></span></div>`;
      })
      .join('');
    return `<ha-card class="list"><div class="lhead"><ha-icon icon="mdi:table-multiple"></ha-icon><span class="lname">${shEsc(this._t('db_tables'))}</span>
      <span class="muted">${tables.length}</span></div>${rows}</ha-card>`;
  }

  // A device of the Database tab: its row picks all its entities that wrote (a box half ticked when some are), its
  // chevron unfolds them, the ones that wrote the most first, each picked on its own. An entity without a device is a
  // row of its own, with nothing to unfold.
  _dbDevice(d, sel, open, share, count) {
    var ids = d.entity_ids || [];
    var key = d.device_id || ids[0] || d.name;
    var picked = ids.filter((id) => sel.has(id)).length;
    var box = picked && picked === ids.length ? 'marked' : picked ? 'intermediate' : 'blank-outline';
    var excluded =
      d.excluded && d.excluded === ids.length
        ? ` <span class="pill">${shEsc(this._t('db_excluded'))}</span>`
        : d.excluded
          ? ` <span class="pill">${shEsc(this._t('db_excluded_some', { n: d.excluded }))}</span>`
          : '';
    var sub = d.device_id
      ? [d.area, this._t(ids.length === 1 ? 'db_entities_one' : 'db_entities_many', { n: ids.length })].filter(Boolean).join(' · ')
      : [ids[0], this._t('db_no_device')].filter(Boolean).join(' · ');
    var pct = share(d.count);
    var isOpen = Boolean(d.device_id) && open.has(key);
    var label = `${this._t('db_unfold')} · ${d.name}`;
    var fold = d.device_id
      ? `<button class="icon-btn" data-action="db_open" data-key="${shEsc(key)}" aria-expanded="${isOpen}" title="${shEsc(label)}" aria-label="${shEsc(label)}"><ha-icon icon="mdi:chevron-${isOpen ? 'up' : 'down'}"></ha-icon></button>`
      : '<span class="dbfold-space"></span>';
    var row = `<div class="dbdev${picked ? ' on' : ''}">
      <button class="item dbrow" data-action="db_pick_device" data-key="${shEsc(key)}" aria-pressed="${picked === ids.length && picked > 0}">
        <ha-icon icon="mdi:checkbox-${box}"></ha-icon>
        <div class="who"><div class="n">${shEsc(d.name)}${excluded}</div><div class="s">${shEsc(sub)}</div>
          <div class="dbbar"><span style="width:${Math.max(pct, 1)}%"></span></div></div>
        ${count(d.count, pct)}</button>${fold}</div>`;
    if (!isOpen) return row;
    var entities = (d.entities || [])
      .map((e) => {
        var on = sel.has(e.entity_id);
        var ep = share(e.count);
        return `<button class="item dbrow dbent${on ? ' on' : ''}" data-action="db_pick" data-entity="${shEsc(e.entity_id)}" aria-pressed="${on}">
          <ha-icon icon="mdi:checkbox-${on ? 'marked' : 'blank-outline'}"></ha-icon>
          <div class="who"><div class="n">${shEsc(e.name)}${e.excluded ? ` <span class="pill">${shEsc(this._t('db_excluded'))}</span>` : ''}</div>
            <div class="s">${shEsc(e.entity_id)}</div><div class="dbbar"><span style="width:${Math.max(ep, 1)}%"></span></div></div>
          ${count(e.count, ep)}</button>`;
      })
      .join('');
    var more = ids.length - (d.entities || []).length;
    var rest = more > 0 ? `<div class="item dbent"><div class="who"><div class="s">${shEsc(this._t(more === 1 ? 'db_more_one' : 'db_more', { n: more }))}</div></div></div>` : '';
    return `${row}<div class="dbents" role="group" aria-label="${shEsc(label)}">${entities}${rest}</div>`;
  }

  // Security (system_hub/security): read every 5 minutes at most; the add-ons and the YAML files are read again by the
  // server once an hour, force (Scan now) reads them at once
  async _scLoad(force, rescan) {
    if (!this._hass?.callWS || (!force && this._sc?.at && Date.now() - this._sc.at < 300000)) return;
    this._sc = { ...(this._sc || {}), at: Date.now() };
    if (rescan) this._busy.sc_scan = true;
    try {
      this._sc = { data: await this._hass.callWS({ type: 'system_hub/security', force: Boolean(rescan) }), at: Date.now(), error: null };
    } catch (err) {
      this._sc = { ...this._sc, error: shErr(err) };
    }
    delete this._busy.sc_scan;
    if (this._tab === 'security' || rescan) this._render();
  }

  // What needs a look: refusals from the Internet in 24 h, recent bans, add-ons not protected (bad); administrators
  // without 2FA, credentials in clear, an external URL without HTTPS, unused tokens (warn)
  _scSummary() {
    var d = this._sc?.data;
    if (!d) return null;
    var day = Date.now() / 1000 - 86400;
    var refused = (d.refused || []).filter((r) => r.internet && !r.ignored && r.day > 0);
    var bans = (d.bans || []).filter((b) => b.at > day);
    // An add-on allowed to run unprotected (Settings → Security, or Allow here) is not a problem
    var unprotected = (d.addons || []).filter((a) => !a.protected && !a.allowed);
    var noMfa = (d.users || []).filter((u) => u.admin && u.active && !u.mfa);
    var admins = (d.users || []).filter((u) => u.admin && u.active);
    var unused = (d.tokens || []).filter((t) => t.unused);
    var clear = d.config || [];
    var http = d.exposure?.https === false;
    var bad = refused.length + bans.length + unprotected.length;
    var warn = noMfa.length + unused.length + clear.length + (http ? 1 : 0);
    return { refused, bans, unprotected, noMfa, admins, unused, clear, http, bad, warn, tone: bad ? 'bad' : warn ? 'warn' : 'good' };
  }

  _scWhen(ts) {
    return ts ? this._rel(new Date(ts * 1000).toISOString()) : this._t('never');
  }

  // A Security command (Ignore, Revoke): its button spins until the tab is read again; a failure next to the buttons
  async _scCall(busyKey, msg, done) {
    this._busy[busyKey] = true;
    this._render();
    try {
      await this._hass.callWS(msg);
      if (done) this._toast(this._t('done'));
      await this._scLoad(true);
    } catch (err) {
      this._messages.sc = { text: this._t('failed', { error: shErr(err) }), tone: 'bad' };
    }
    delete this._busy[busyKey];
    await this._load();
  }

  _scIgnore(ip, ignore) {
    return this._scCall(`sc_ignore:${ip}`, { type: 'system_hub/security_ignore', ip, ignore });
  }

  _scRevoke(token) {
    this._confirm = null;
    return this._scCall(`sc_revoke:${token}`, { type: 'system_hub/security_revoke', token_id: token }, true);
  }

  _scList(icon, title, count, rows, note) {
    return `<ha-card class="list"><div class="lhead"><ha-icon icon="${icon}"></ha-icon><span class="lname">${shEsc(title)}</span><span class="muted">${shEsc(count)}</span></div>${rows}${
      note ? `<div class="scnote">${note}</div>` : ''
    }</ha-card>`;
  }

  _scRow(icon, name, sub, tone = '', end = '') {
    return `<div class="item${tone ? ` ${tone}` : ''}"><ha-icon icon="${icon}"></ha-icon><div class="who"><div class="n">${name}</div><div class="s">${sub}</div></div>${end}</div>`;
  }

  // Security: refused logins, accounts, long-lived tokens (Revoke), exposure, add-ons and credentials in clear
  _security() {
    var d = this._sc?.data;
    if (!d) {
      if (this._sc?.error) {
        return `<ha-card class="note error" role="alert">${shEsc(this._t('failed', { error: this._sc.error }))}
          <button class="act" data-action="sc_scan"><ha-icon icon="mdi:refresh"></ha-icon>${shEsc(this._t('refresh'))}</button></ha-card>`;
      }
      if (!this._sc) this._scLoad();
      return `<ha-card class="note">${this._spinner(this._t('loading'))}</ha-card>`;
    }
    var sum = this._scSummary();
    var pill = (text, tone = '') => `<span class="pill${tone ? ` ${tone}` : ''}">${shEsc(text)}</span>`;
    var day = (d.refused || []).filter((r) => !r.ignored).reduce((n, r) => n + r.day, 0);
    var ex = d.exposure || {};
    var tiles = [
      this._tile('mdi:shield-alert-outline', `<b>${day}</b>`, this._t('sc_refused_day'), sum.refused.length || sum.bans.length ? 'bad' : day ? 'warn' : 'good'),
      this._tile('mdi:account-key-outline', shEsc(this._t('sc_n_of', { n: sum.noMfa.length, total: sum.admins.length })), this._t('sc_admins_no_mfa'), sum.noMfa.length ? 'warn' : 'good'),
      this._tile(
        'mdi:key-chain-variant',
        `<b>${(d.tokens || []).length}</b>${sum.unused.length ? ` · ${shEsc(this._t('sc_tokens_unused', { n: sum.unused.length }))}` : ''}`,
        this._t('sc_tokens'),
        sum.unused.length ? 'warn' : '',
      ),
      this._tile(
        'mdi:web',
        shEsc(ex.external_url ? (ex.https ? 'HTTPS' : 'HTTP') : '—'),
        ex.external_url ? ex.external_url.replace(/^https?:\/\//, '') : this._t('sc_no_external'),
        ex.external_url ? (ex.https ? 'good' : 'warn') : '',
      ),
    ];
    var actions = `<div class="actions">${this._message('sc')}<span class="grow"></span>
      <span class="scnote">${shEsc(this._t('sc_scanned', { when: this._scWhen(d.scanned_at) }))}</span>
      ${this._button('sc_scan', 'mdi:magnify-scan', this._t('sc_scan'), { quiet: true, busy: this._busy.sc_scan })}${this._configure()}</div>`;

    var banned = new Set((d.bans || []).map((b) => b.ip));
    var refused = (d.refused || [])
      .map((r) => {
        var tone = r.ignored ? '' : banned.has(r.ip) ? 'bad' : r.internet ? 'warn' : '';
        var sub = [r.host, this._t(r.internet ? 'sc_internet' : 'sc_local'), this._t('sc_attempts', { n: r.count }), this._t('sc_last', { when: this._scWhen(r.last) }), r.url].filter(Boolean);
        var end = banned.has(r.ip) ? pill(this._t('sc_banned'), 'bad') : r.ignored ? pill(this._t('sc_ignored')) : r.internet ? pill(this._t('sc_internet'), 'warn') : '';
        var button = this._button('sc_ignore', r.ignored ? 'mdi:eye-outline' : 'mdi:eye-off-outline', this._t(r.ignored ? 'sc_unignore' : 'sc_ignore'), {
          quiet: true,
          busy: this._busy[`sc_ignore:${r.ip}`],
          data: { ip: r.ip, ignore: String(!r.ignored) },
        });
        return this._scRow(r.internet ? 'mdi:shield-alert-outline' : 'mdi:lan', shEsc(r.ip), shEsc(sub.join(' · ')), tone, end + button);
      })
      .join('');
    var banNote = [ex.ip_ban ? this._t('sc_ban_on', { n: ex.login_threshold }) : this._t('sc_ban_off'), (d.bans || []).length ? this._t('sc_n_bans', { n: d.bans.length }) : ''].filter(Boolean).join(' ');
    var refusedCard = this._scList('mdi:login-variant', this._t('sc_refused'), this._t('sc_days7'), refused || this._scRow('mdi:check-circle-outline', '', shEsc(this._t('sc_none_refused'))), shEsc(banNote));

    var users = (d.users || [])
      .map((u) => {
        var role = this._t(u.owner ? 'sc_owner' : u.admin ? 'sc_admin' : 'sc_user');
        var sub = [role, u.local_only ? this._t('sc_local_only') : '', u.last_used ? this._t('sc_active_when', { when: this._scWhen(u.last_used) }) : this._t('sc_never_active'), this._t('sc_sessions', { n: u.sessions })].filter(Boolean);
        var warn = u.admin && u.active && !u.mfa;
        var end = !u.active ? pill(this._t('sc_disabled')) : u.mfa ? pill(this._t('sc_mfa'), 'good') : warn ? pill(this._t('sc_no_mfa'), 'warn') : u.local_only ? pill(this._t('sc_local_pill')) : '';
        var icon = !u.active ? 'mdi:account-off-outline' : warn ? 'mdi:account-alert-outline' : 'mdi:account-circle-outline';
        return this._scRow(icon, shEsc(u.name), shEsc(sub.join(' · ')), warn ? 'warn' : '', end);
      })
      .join('');

    var tokens = (d.tokens || [])
      .map((t) => {
        var used = t.last_used ? (t.last_ip ? this._t('sc_used_from', { when: this._scWhen(t.last_used), ip: t.last_ip }) : this._t('sc_used', { when: this._scWhen(t.last_used) })) : this._t('sc_never_used');
        var confirm = this._confirm === `sc_revoke:${t.id}`;
        var end = (t.unused ? pill(this._t('sc_unused'), 'warn') : '') + this._button('sc_revoke_confirm', 'mdi:delete-outline', this._t('sc_revoke'), {
          quiet: true,
          busy: this._busy[`sc_revoke:${t.id}`],
          data: { token: t.id },
        });
        var row = this._scRow(t.unused ? 'mdi:key-alert-outline' : 'mdi:key-outline', shEsc(t.name), shEsc([t.user, this._t('sc_created', { when: this._scWhen(t.created) }), used].join(' · ')), t.unused ? 'warn' : '', end);
        return confirm
          ? `${row}<div class="confirm" role="alertdialog">${shEsc(this._t('sc_revoke_confirm', { name: t.name }))}${this._button('sc_revoke', 'mdi:delete-outline', this._t('sc_revoke'), { danger: true, data: { token: t.id } })}${this._button('cancel', 'mdi:close', this._t('cancel'), { quiet: true })}</div>`
          : row;
      })
      .join('');

    var check = (ok, title, sub, tone) =>
      this._scRow(ok === null ? 'mdi:information-outline' : ok ? 'mdi:check-circle-outline' : 'mdi:alert-outline', shEsc(title), shEsc(sub), ok === false ? tone || 'warn' : '', pill(this._t(ok === null ? 'sc_info' : ok ? 'sc_ok' : 'sc_check'), ok === null ? 'info' : ok ? 'good' : tone || 'warn'));
    var exposure = [
      ex.external_url ? check(ex.https, this._t(ex.https ? 'sc_https_ok' : 'sc_https_no'), ex.external_url) : check(null, this._t('sc_no_external'), ex.cloud ? this._t('sc_cloud') : ''),
      check(ex.trusted_proxies?.length ? true : null, this._t(ex.trusted_proxies?.length ? 'sc_proxy' : 'sc_no_proxy'), (ex.trusted_proxies || []).join(', ')),
      check(ex.ip_ban, this._t('sc_ip_ban'), ex.ip_ban ? this._t('sc_on_n', { n: ex.login_threshold }) : this._t('sc_off')),
      check(null, this._t('sc_cloud'), this._t(ex.cloud ? 'sc_connected' : 'sc_not_connected')),
    ].join('');

    var addons = d.addons
      ? d.addons
          .filter((a) => !a.protected || a.full_access || a.host_network)
          .sort((a, b) => (a.protected || a.allowed) - (b.protected || b.allowed) || (a.rating ?? 9) - (b.rating ?? 9))
          .map((a) => {
            var risky = !a.protected && !a.allowed;
            var tone = risky ? 'bad' : a.full_access ? 'warn' : '';
            var sub = [
              !a.protected ? this._t('sc_protection_off') : '',
              a.full_access ? this._t('sc_full_access_s') : '',
              a.host_network ? this._t('sc_host_network_s') : '',
              a.rating != null ? this._t('sc_rating', { n: a.rating }) : '',
            ].filter(Boolean);
            var end = risky
              ? pill(this._t('sc_unprotected'), 'bad')
              : !a.protected
                ? pill(this._t('sc_allowed'), 'info')
                : a.full_access
                  ? pill(this._t('sc_full_access'), 'warn')
                  : pill(this._t('sc_host_network'), 'info');
            // Unprotected: allowed from here (saved at once), or no longer
            if (!a.protected) {
              end += this._button('sc_allow', a.allowed ? 'mdi:shield-off-outline' : 'mdi:shield-check-outline', this._t(a.allowed ? 'sc_disallow' : 'sc_allow'), {
                quiet: true,
                busy: this._busy[`sc_allow:${a.slug}`],
                data: { slug: a.slug, allow: String(!a.allowed) },
              });
            }
            return this._scRow(risky ? 'mdi:alert-circle-outline' : 'mdi:alert-outline', shEsc(a.name), shEsc(sub.join(' · ')), tone, end);
          })
          .join('')
      : '';
    var flagged = d.addons ? d.addons.filter((a) => !a.protected || a.full_access || a.host_network).length : 0;
    var addonsCard = d.addons ? this._scList('mdi:puzzle-outline', this._t('sc_addons'), this._t('sc_addons_ok', { total: d.addons.length, ok: d.addons.length - flagged }), addons) : '';

    var clear = (d.config || [])
      .map((c) => this._scRow('mdi:form-textbox-password', shEsc(this._t('sc_in_clear')), `<code>${shEsc(c.file)}</code> ${shEsc(this._t('sc_line', { n: c.line }))} · <code>${shEsc(c.key)}</code>`, 'warn', pill('!secret', 'warn')))
      .join('');
    var configCard = this._scList(
      'mdi:file-lock-outline',
      this._t('sc_config'),
      String((d.config || []).length),
      clear || this._scRow('mdi:check-circle-outline', '', shEsc(this._t('sc_config_none'))),
      clear ? shEsc(this._t('sc_config_note')) : '',
    );

    return `<div class="tiles">${tiles.join('')}</div>${actions}${refusedCard}
      ${this._scList('mdi:account-group-outline', this._t('sc_accounts'), String((d.users || []).length), users)}
      ${(d.tokens || []).length ? this._scList('mdi:key-chain-variant', this._t('sc_tokens'), String(d.tokens.length), tokens, shEsc(this._t('sc_tokens_note'))) : ''}
      <div class="sctwo">${this._scList('mdi:web', this._t('sc_exposure'), '', exposure)}${addonsCard}</div>${configCard}`;
  }

  // The Marketplace's installs running (its Update all, or one card's Update): the backup first, then which one of how
  // many, with the share done of the current one
  _mkRunProgress(data) {
    var run = this._mkRunNow(data);
    return run ? this._instProgress(run) : '';
  }

  // Where the Marketplace's installs are: the backup first, then which one of how many
  _mkRunNow(data) {
    if (!data.backing_up && !data.install_total) return null;
    return {
      backup: Boolean(data.backing_up),
      n: Math.min(data.install_total, (data.install_done || 0) + 1),
      total: data.install_total,
      name: data.install_current,
      entity: data.installing?.[0],
    };
  }

  // The tab's Update all running: the Marketplace's repositories first (their progress from the server), then the
  // other updates one by one
  _updRunNow() {
    var run = this._updRun;
    if (!run) return null;
    if (run.item) return { n: run.base + 1, total: run.total, name: run.item.title, entity: run.item.entity_id, backup: false };
    var mk = this._state.marketplace || {};
    return {
      n: Math.min(run.total, (mk.install_done || 0) + 1),
      total: run.total,
      name: mk.install_current || run.first,
      entity: mk.installing?.[0],
      backup: Boolean(mk.backing_up),
    };
  }

  // Installs running: "Backing up Home Assistant…", then "Installing 2 / 5: name" with the share done of the whole run:
  // the updates finished plus the share done of the current one when its entity reports it (update_percentage; its
  // card shows it too). A moving bar while backing up, or for a single update that doesn't report its progress
  _instProgress(run) {
    var current = run.backup || !run.entity ? null : this._updLive(run.entity).pct;
    var pct = run.backup || (current === null && !(run.total > 1))
      ? null
      : Math.round((Math.max(0, run.n - 1) + (current ?? 0) / 100) / Math.max(1, run.total) * 100);
    var title = run.backup ? this._t('mk_backing_up') : this._t('mk_installing', { n: run.n, total: run.total, name: run.name || '' });
    var value = pct === null ? '' : ` aria-valuenow="${pct}"`;
    return `<ha-card class="progress inst" role="progressbar" aria-label="${shEsc(title)}" aria-valuemin="0" aria-valuemax="100"${value}>
      <div class="phead"><ha-icon icon="${run.backup ? 'mdi:backup-restore' : 'mdi:autorenew'}"></ha-icon><span class="ptitle">${shEsc(title)}</span>${pct === null ? '' : `<span class="ppct">${pct} %</span>`}</div>
      <div class="pbar${pct === null ? ' busy' : ''}"><span style="width:${pct ?? 30}%"></span></div>
    </ha-card>`;
  }

  // The updates outside the Marketplace: Home Assistant (Core, Supervisor, OS), the add-ons, the devices and services;
  // one card each, installed one at a time with Home Assistant's update.install, a backup first when chosen
  _sysUpdates(data) {
    var available = data.available || [];
    var backupDefault = Boolean(this._state.marketplace?.backup_before_install);
    var backup = this._updBackup ?? backupDefault;
    if (available.length) this._mkFetchNotes(available);
    var ok = data.up_to_date || {};
    var toggle = available.some((u) => u.backup)
      ? `<button class="act quiet" data-action="upd_backup" aria-pressed="${backup}"><ha-icon icon="mdi:checkbox-${backup ? 'marked' : 'blank-outline'}"></ha-icon>${shEsc(this._t('upd_backup'))}</button>`
      : '';
    // Every update of the tab: these and the Marketplace's
    var repos = (this._state.marketplace?.list || []).length;
    // Short on one line; the detail by kind in its tooltip
    var total = available.length + repos;
    var summary = [total ? this._t('upd_available', { n: total }) : '', this._t('upd_uptodate_short', { n: (ok.system ?? 0) + (ok.addon ?? 0) + (ok.device ?? 0) })].filter(Boolean);
    var detail = [
      total ? this._t('upd_available_detail', { n: total, system: available.length, marketplace: repos }) : '',
      this._t('upd_uptodate', { system: ok.system ?? 0, addons: ok.addon ?? 0, devices: ok.device ?? 0 }),
    ].filter(Boolean);
    // Update all: every update of the tab, the Marketplace's included, in the order of _updPlan
    var plan = this._updPlan();
    var running = Boolean(this._busy.upd_all);
    var all = plan.count
      ? this._button('upd_all_confirm', 'mdi:package-down', `${this._t('install_all')} (${plan.count})`, {
          busy: running,
          disabled: this._state.marketplace?.state === 'running' || this._state.marketplace?.installing_updates,
        })
      : '';
    var confirm =
      this._confirm === 'upd_all'
        ? `<div class="confirm" role="alertdialog">${shEsc(
            [this._t('upd_all_confirm', { n: plan.count }), plan.restarts ? this._t('upd_all_restart') : '', plan.osLater ? this._t('upd_all_os_later') : '']
              .filter(Boolean)
              .join(' '),
          )}
          ${this._button('upd_all', 'mdi:package-down', this._t('install_all'))}
          ${this._button('cancel', 'mdi:close', this._t('cancel'), { quiet: true })}</div>`
        : '';
    var now = this._updRunNow();
    var head = `<div class="actions"><span class="s grow" title="${shEsc(detail.join('\n'))}">${shEsc(summary.join(' · '))}</span>${toggle}${all}</div>${confirm}${now ? this._instProgress(now) : ''}${this._message('upd')}`;
    // One grid, in the order of the server (Core, Supervisor, OS, add-ons, devices); each card says what it is
    return `${head}${available.length ? `<h2 class="stsec">${shEsc(this._t('upd_heading'))}</h2><div class="mkgrid">${available.map((u) => this._mkCard(u, backup)).join('')}</div>` : ''}`;
  }

  // What an update outside the Marketplace is: Core, Supervisor, OS, an add-on, a device or service
  _updKind(kind) {
    return { core: this._t('core'), supervisor: this._t('supervisor'), os: 'OS', addon: this._t('addon'), device: this._t('upd_device') }[kind] || kind;
  }

  // Update all, one step after the other: the Marketplace repositories (System Hub's own install, waited for), the
  // add-ons, the devices and services, the Supervisor, then Home Assistant itself last as it restarts: Core, or OS when
  // Core is up to date (both would need two restarts, so OS is left for afterwards)
  _updPlan() {
    var available = this._state.system_updates?.available || [];
    var repos = (this._state.marketplace?.list || []).map((u) => u.entity_id);
    var of = (kind) => available.filter((u) => u.kind === kind);
    var core = of('core');
    var last = core.length ? core : of('os');
    var items = [...of('addon'), ...of('device'), ...of('supervisor'), ...last];
    return {
      repos,
      items,
      count: repos.length + items.length,
      restarts: last.length > 0,
      osLater: core.length > 0 && of('os').length > 0,
    };
  }

  async _updAll() {
    var plan = this._updPlan();
    var backup = this._updBackup ?? Boolean(this._state.marketplace?.backup_before_install);
    this._confirm = null;
    this._busy.upd_all = true;
    delete this._messages.upd;
    var first = (this._state.marketplace?.list || []).find((u) => u.entity_id === plan.repos[0]);
    this._updRun = { total: plan.count, base: 0, item: null, first: first?.title };
    this._render();
    try {
      if (plan.repos.length) {
        this._kickLoad();
        await this._hass.callService(SH_DOMAIN, 'marketplace_install_updates', { entity_id: plan.repos, wait: true, backup });
      }
      for (var [i, u] of plan.items.entries()) {
        this._updRun = { ...this._updRun, base: plan.repos.length + i, item: u };
        this._busy[`upd_install:${u.entity_id}`] = true;
        this._render();
        await this._hass.callService('update', 'install', { entity_id: u.entity_id, ...(backup && u.backup ? { backup: true } : {}) });
        delete this._busy[`upd_install:${u.entity_id}`];
      }
      this._toast(this._t('done'));
    } catch (err) {
      this._messages.upd = { text: this._t('failed', { error: shErr(err) }), tone: 'bad' };
    }
    for (var key of Object.keys(this._busy)) if (key.startsWith('upd_install:')) delete this._busy[key];
    delete this._busy.upd_all;
    this._updRun = null;
    await this._load();
    this._render();
  }

  // One update: its logo (else its initial), the versions and the size of the change, the start of its release notes.
  // A Marketplace repository is installed by System Hub (one at a time with the others); any other update by Home
  // Assistant's update.install, asked first (Home Assistant itself restarts), with a backup when `backup` and supported
  _mkCard(u, backup) {
    var change = shChange(u.installed, u.latest);
    var system = Boolean(u.kind);
    var live = this._updLive(u.entity_id);
    var busy = u.installing || live.installing || this._busy[`${system ? 'upd' : 'mk'}_install:${u.entity_id}`];
    // Next in the Marketplace's queue (the first one is installing): waiting, not moving yet
    var queued = !system && !live.installing && (this._state.marketplace?.installing || []).indexOf(u.entity_id) > 0;
    // The share done when its entity reports it (update_percentage), next to the button, and a thin bar along the card
    var status = live.pct !== null ? `<span class="mkpct">${live.pct} %</span>` : queued ? `<span class="mkpct muted">${shEsc(this._t('mk_queued'))}</span>` : '';
    var bar = busy && !queued ? `<div class="pbar mkbar${live.pct === null ? ' busy' : ''}" aria-hidden="true"><span style="width:${live.pct ?? 30}%"></span></div>` : '';
    var restart = { core: 'upd_restart_core', supervisor: 'upd_restart_supervisor', os: 'upd_restart_os' }[u.kind];
    var install = system
      ? this._confirm === `upd:${u.entity_id}`
        ? `${this._button('upd_install', 'mdi:package-down', this._t('mk_install'), { data: { entity: u.entity_id, backup: backup && u.backup ? '1' : '' }, busy })}
           ${this._button('cancel', 'mdi:close', this._t('cancel'), { quiet: true })}`
        : this._button('upd_confirm', 'mdi:package-down', this._t('mk_install'), { data: { entity: u.entity_id }, busy })
      : this._button('mk_install', 'mdi:package-down', this._t('mk_install'), { data: { entity: u.entity_id }, busy, disabled: this._state.marketplace?.installing_updates });
    var notes = u.release_summary || this._mkNotes?.[`${u.entity_id}@${u.latest}`];
    var tone = change === 'major' ? 'bad' : change === 'minor' ? 'warn' : 'good';
    // Without a picture, the project's icon when it is one of juju35's (the showcase site's badge), else a card's or a
    // theme's icon in the tone of its row, else the initial
    var project = shProject(u.release_url);
    var kindIcon = { plugin: 'mdi:view-dashboard', theme: 'mdi:palette' }[u.category];
    var initial = project
      ? `<div class="mklogo mkproj" style="--logo:${shEsc(project.accent)}"><ha-icon icon="${shEsc(project.icon)}"></ha-icon></div>`
      : kindIcon
        ? `<div class="mklogo mkproj ${tone}" style="--logo:var(--tone)"><ha-icon icon="${kindIcon}"></ha-icon></div>`
        : `<div class="mklogo" style="--logo:${shHue(u.title)}">${shEsc(String(u.title || '?').charAt(0).toUpperCase())}</div>`;
    // Without a picture, the logo of its integration (a device's firmware: ZHA, MQTT…), from Home Assistant's brands
    var brand = u.integration && /^[a-z0-9_]+$/.test(u.integration) ? `/api/brands/integration/${u.integration}/icon.png` : null;
    var picture = this._mkPicture(u.picture || brand);
    // A picture that doesn't load gives way to the project's icon or the initial
    var logo = picture ? `<span class="mklogos"><img class="mklogo" src="${shEsc(picture)}" alt="" loading="lazy" onerror="this.parentNode.classList.add('broken')">${initial}</span>` : initial;
    // Release notes on the web only (an integration's release_url could be any link)
    var link = /^https?:\/\//i.test(u.release_url || '')
      ? `<a class="act quiet" href="${shEsc(u.release_url)}" target="_blank" rel="noreferrer"><ha-icon icon="mdi:text-box-outline"></ha-icon>${shEsc(this._t('mk_notes'))}</a>`
      : `<button class="act quiet" data-more="${shEsc(u.entity_id)}"><ha-icon icon="mdi:text-box-outline"></ha-icon>${shEsc(this._t('mk_notes'))}</button>`;
    return `<ha-card class="mkcard link" data-more="${shEsc(u.entity_id)}">
      <div class="mktop">${logo}<div class="who"><div class="n">${shEsc(u.title)}</div><div class="s">${shEsc(system ? `${this._updKind(u.kind)} · ${u.entity_id}` : u.entity_id)}</div></div>
        ${change ? `<span class="pill ${tone}">${shEsc(this._t(`mk_${change}`))}</span>` : ''}</div>
      <div class="mkver"><span class="muted">${shEsc(u.installed || '—')}</span><ha-icon icon="mdi:arrow-right"></ha-icon><b>${shEsc(u.latest || '—')}</b></div>
      ${typeof notes === 'string' && notes ? `<div class="s mknotes">${shEsc(notes)}</div>` : ''}
      ${restart ? `<div class="mkrestart"><ha-icon icon="mdi:restart"></ha-icon>${shEsc(this._t(restart))}</div>` : ''}
      ${this._confirm === `upd:${u.entity_id}` ? `<div class="s" role="alert">${shEsc(this._t('upd_confirm', { name: u.title, version: u.latest || '' }))}</div>` : ''}
      <div class="actions">${link}<span class="grow"></span>${status}${install}</div>${bar}</ha-card>`;
  }

  // A brand image of Home Assistant (/api/brands/…) needs its access token, read once (brands/access_token)
  _mkPicture(url) {
    if (!url) return null;
    if (!url.startsWith('/api/brands/')) return url;
    if (this._brandsToken === undefined && this._hass?.callWS) {
      this._brandsToken = null;
      this._hass
        .callWS({ type: 'brands/access_token' })
        .then((res) => {
          this._brandsToken = res?.token || '';
          if (this._tab === 'marketplace') this._render();
        })
        .catch(() => {
          this._brandsToken = '';
        });
    }
    if (!this._brandsToken) return this._brandsToken === '' ? url : null;
    return `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(this._brandsToken)}`;
  }

  // The release notes of each update, read once per version (Home Assistant's update/release_notes): their start
  _mkFetchNotes(list) {
    this._mkNotes ??= {};
    for (const u of list) {
      // One key per update: kept for its own answer
      const key = `${u.entity_id}@${u.latest}`;
      if (u.release_summary || key in this._mkNotes || !this._hass?.callWS) continue;
      this._mkNotes[key] = null;
      this._hass
        .callWS({ type: 'update/release_notes', entity_id: u.entity_id })
        .then((text) => {
          // No notes (null) for many devices: nothing shown
          this._mkNotes[key] = typeof text === 'string' ? shExcerpt(text) : '';
          if (this._tab === 'marketplace') this._render();
        })
        .catch(() => {});
    }
  }

  // The check running: a bar of the repositories checked, the share done, the time left at the pace so far, the
  // failures; a moving bar while the list of repositories is still being read
  _progress(data) {
    var done = data.done ?? 0;
    var total = data.total ?? 0;
    var pct = total ? Math.min(100, Math.round((done * 100) / total)) : null;
    var meta = [];
    if (total) meta.push(this._t('progress', { done, total }));
    var started = data.started_at ? Date.parse(data.started_at) : Number.NaN;
    if (total && done && done < total && !Number.isNaN(started)) {
      var left = ((Date.now() - started) / done) * (total - done);
      meta.push(this._t('remaining', { t: this._duration(left) }));
    }
    var fails = (data.failed || []).length;
    return `<ha-card class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${done}">
      <div class="phead"><ha-icon icon="mdi:archive-sync"></ha-icon><span class="ptitle">${shEsc(this._t('checking'))}</span>${pct === null ? '' : `<span class="ppct">${pct} %</span>`}</div>
      <div class="pbar${pct === null ? ' busy' : ''}"><span style="width:${pct ?? 30}%"></span></div>
      <div class="pmeta">${meta.map((m) => `<span>${shEsc(m)}</span>`).join('')}${fails ? `<span class="bad">${shEsc(this._t('failed_count', { n: fails }))}</span>` : ''}</div>
    </ha-card>`;
  }

  // "45 s", "3 min"
  _duration(ms) {
    var s = Math.max(1, Math.round(ms / 1000));
    return s < 60 ? this._t('sec', { n: s }) : this._t('min', { n: Math.round(s / 60) });
  }

  // Batteries: as the Battery Monitor full screen view — the views, what to replace and the next replacement, then the
  // batteries in groups (by room, by battery type, by replacement date) laid out in columns, or one list by level
  _batteries() {
    var data = this._state.batteries || {};
    var view = this._battView || 'level';
    var all = data.batteries || [];
    // "Hide the batteries that are fine" (Configure → Batteries): only the low and unavailable ones
    var list = data.hide_ok ? all.filter((b) => b.low || b.unavailable) : all;
    // The search: name, room or type
    var query = (this._draft.batt_search || '').trim().toLowerCase();
    if (query) list = list.filter((b) => [b.name, b.area, b.battery_type].some((v) => String(v || '').toLowerCase().includes(query)));
    var tiles = [
      this._tile('mdi:battery-alert-variant-outline', `<b>${data.low ?? 0}</b>`, this._t('low'), data.low ? 'warn' : 'good'),
      this._tile('mdi:battery-unknown', `<b>${data.unavailable ?? 0}</b>`, this._t('unavailable'), data.unavailable ? 'bad' : 'good'),
      this._tile('mdi:bell-check-outline', shEsc(this._rel(data.last_notification)), this._entityName('sensor', 'batteries_last_notification'), ''),
    ];
    var views = [
      ['level', 'by_level'],
      ['room', 'by_room'],
      ['type', 'by_type'],
      ['forecast', 'by_forecast'],
    ]
      .map(([key, label]) => `<button class="btab${key === view ? ' on' : ''}" data-action="batt_view" data-view="${key}" aria-pressed="${key === view}">${shEsc(this._t(label))}</button>`)
      .join('');
    var groups = this._battGroups(list, view)
      .map((g) => {
        var alerts = g.items.filter(({ b }) => b.low || b.unavailable).length;
        var head = g.name
          ? `<div class="ghead"><ha-icon icon="${g.icon}"></ha-icon><span class="gname">${shEsc(g.name)}</span>
            ${alerts ? `<span class="gchip">${shEsc(this._t('to_check', { n: alerts }))}</span>` : ''}
            <span class="gcount">${shEsc(this._battCount(g))}</span></div>`
          : '';
        return `<section class="bgroup">${head}${g.hint ? `<div class="ghint">${shEsc(g.hint)}</div>` : ''}<div class="glist">${g.items.map((x) => this._battRow(x.b, x.context)).join('')}</div></section>`;
      })
      .join('');
    var body = list.length
      ? `<div class="bgroups${view === 'level' ? ' bylevel' : ''}">${groups}</div>`
      : query
        ? `<div class="empty">${shEsc(this._t('no_match'))}</div>`
        : `<div class="empty good"><ha-icon icon="mdi:battery-check-outline"></ha-icon>${shEsc(this._t('all_good', { threshold: data.threshold ?? '' }))}</div>`;
    var buy = this._battToReplace(all);
    var next = this._battNext(all);
    return `<div class="tiles">${tiles.join('')}</div>
      <ha-card class="bsheet">
        <div class="btop">
          <div class="btabs" role="group">${views}</div>
          <div class="bline"><span class="rlabel"><ha-icon icon="mdi:cart-outline"></ha-icon>${shEsc(this._t('to_replace'))}</span>${buy || `<span class="none">${shEsc(this._t('nothing_to_replace'))}</span>`}</div>
          ${next}
          ${this._battSpares(data.spares || {})}
          <span class="grow"></span>
          <label class="box bsearch"><ha-icon icon="mdi:magnify"></ha-icon><input data-draft="batt_search" placeholder="${shEsc(this._t('search_batteries'))}" value="${shEsc(this._draft.batt_search || '')}"></label>
          ${this._button('batt_csv', 'mdi:file-delimited-outline', this._t('export_csv'), { quiet: true })}
          ${this._button('batteries_notify', 'mdi:bell-ring-outline', this._entityName('button', 'batteries_notify_now'), { quiet: true })}${this._message('batteries_notify')}
        </div>
        ${this._stockForm ? this._battStockForm() : ''}
        ${body}
      </ha-card>`;
  }

  // One battery as in the Battery Monitor card: its icon in a coloured bubble, its name, what it is and since when it
  // needs attention, its level over a small bar; a low or unavailable one is tinted
  _battRow(b, context) {
    var kind = b.unavailable || b.due ? 'alert' : b.low ? 'warn' : 'ok';
    var level = shNum(b.level);
    var value = b.unavailable ? this._t('unavailable') : level === null ? this._t('low') : `${Math.round(level)} %`;
    var since = b.below_since ? this._battSince(b.below_since, b.unavailable ? 'unavailable_for' : 'low_for') : '';
    var sub = [context, since].filter(Boolean).join(' · ');
    var bar = level === null ? '' : `<span class="track"><span class="bar" style="width:${Math.max(2, Math.min(100, level))}%"></span></span>`;
    return `<button class="brow ${kind}${b.due ? ' due' : ''}" data-more="${shEsc(b.entity_id)}" title="${shEsc(b.name)} — ${shEsc(value)}">
      <span class="ic"><ha-icon icon="${shEsc(b.icon || 'mdi:battery')}"></ha-icon></span>
      <span class="txt"><span class="name">${shEsc(b.name)}</span>${sub ? `<span class="sub">${shEsc(sub)}</span>` : ''}</span>
      <span class="lvl">${shEsc(value)}${bar}</span></button>`;
  }

  // "low for 3 d": "< 1 h" the first hour, hours up to two days, days beyond
  _battSince(iso, key) {
    var h = Math.max(0, (Date.now() - new Date(iso).getTime()) / 3600000);
    var d = h < 1 ? this._t('hours', { n: '< 1' }) : h < 48 ? this._t('hours', { n: Math.floor(h) }) : this._t('days', { n: Math.floor(h / 24) });
    return this._t(key, { d });
  }

  _battCount(g) {
    var n = g.cells ?? g.items.length;
    if (g.cells != null) return this._t(n === 1 ? 'cells_one' : 'cells_many', { n });
    return this._t(n === 1 ? 'count_one' : 'count_many', { n });
  }

  // What to buy: the types of the batteries needing attention, with how many of each
  _battToReplace(list) {
    var need = new Map();
    list
      .filter((b) => b.low || b.unavailable)
      .forEach((b) => {
        var m = /^(\d+)\s*[×x]\s*(.+)$/i.exec(b.battery_type || '');
        var key = m ? m[2] : b.battery_type || '';
        need.set(key, (need.get(key) || 0) + (m ? Number(m[1]) : 1));
      });
    return [...need.entries()]
      .sort((a, b) => !a[0] - !b[0] || b[1] - a[1])
      .map(([type, n]) => `<span class="buy${type ? '' : ' unknown'}"><b>${n}×</b> ${shEsc(type ? this._battTypeName(type) : this._t('unknown_type'))}</span>`)
      .join('');
  }

  // The spare batteries counted by type: in stock, and how many to buy for the batteries low or due within 30 days
  _battSpares(spares) {
    var chips = Object.entries(spares)
      .map(([kind, s]) => {
        var buy = s.short ? ` · ${this._t('to_buy', { n: s.short })}` : '';
        return `<button class="spare${s.short ? ' short' : ''}" data-action="stock_edit" data-kind="${shEsc(kind)}"><b>${s.stock}×</b> ${shEsc(this._battTypeName(kind))}${shEsc(buy)}</button>`;
      })
      .join('');
    return `<div class="bline"><span class="rlabel"><ha-icon icon="mdi:archive-outline"></ha-icon>${shEsc(this._t('spares'))}</span>${chips}
      <button class="spare add" data-action="stock_edit" data-kind="" title="${shEsc(this._t('set_stock'))}" aria-label="${shEsc(this._t('set_stock'))}"><ha-icon icon="mdi:plus"></ha-icon></button>${this._message('batteries_set_stock')}</div>`;
  }

  // Set the spare batteries of a type (0 keeps counting it, empty stops counting it)
  _battStockForm() {
    return `<div class="stockform"><label class="box"><input data-draft="stock_type" placeholder="${shEsc(this._t('stock_type'))}" value="${shEsc(this._draft.stock_type || '')}"></label>
      <label class="box count"><input data-draft="stock_count" type="number" min="0" max="999" placeholder="${shEsc(this._t('stock_count'))}" value="${shEsc(this._draft.stock_count ?? '')}"></label>
      ${this._button('set_stock', 'mdi:content-save-outline', this._t('save'))}${this._button('stock_cancel', 'mdi:close', this._t('cancel'), { quiet: true })}</div>`;
  }

  // Every battery as a CSV file, downloaded by the browser (as the Battery Monitor card)
  _battCsv() {
    var cell = (v) => {
      var text = String(v ?? '');
      return /[",;\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    var head = ['name', 'area', 'type', 'level', 'status', 'drain_per_day', 'days_left', 'replace_by', 'below_since', 'entity_id'];
    var rows = (this._state.batteries?.batteries || []).map((b) => [
      b.name,
      b.area || '',
      b.battery_type || '',
      b.level ?? '',
      b.unavailable ? 'unavailable' : b.low ? 'low' : 'ok',
      b.drain_per_day ?? '',
      b.days_left ?? '',
      b.replace_by ? String(b.replace_by).slice(0, 10) : '',
      b.below_since || '',
      b.entity_id,
    ]);
    return [head, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
  }

  _battDownload() {
    var blob = new Blob([`\ufeff${this._battCsv()}\r\n`], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = `batteries-${new Date().toISOString().slice(0, 10)}.csv`;
    this.shadowRoot.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // The next battery to replace by its forecast, with its date
  _battNext(list) {
    var next = list.filter((b) => !b.low && !b.unavailable && Number.isInteger(b.days_left)).sort((a, b) => a.days_left - b.days_left)[0];
    if (!next) return '';
    var when = next.replace_by ? this._battDate(next.replace_by) : this._t('forecast', { d: this._t('days', { n: next.days_left }) });
    return `<div class="bline"><span class="rlabel"><ha-icon icon="mdi:calendar-clock"></ha-icon>${shEsc(this._t('next_replacement'))}</span>
      <button class="nextb" data-more="${shEsc(next.entity_id)}"><b>${shEsc(next.name)}</b> · ${shEsc(when)}</button></div>`;
  }

  // A room's own icon, set in its area settings (no room: a house)
  _areaIcon(name) {
    if (!name) return 'mdi:home-outline';
    var area = Object.values(this._hass?.areas || {}).find((a) => a?.name === name);
    return area?.icon || 'mdi:door-open';
  }

  // "2× AA" → AA; a built-in rechargeable battery is its own type
  _battType(b) {
    var raw = (b.battery_type || '').trim();
    if (!raw) return '';
    return raw.replace(/^\d+\s*[×x]\s*/i, '');
  }

  _battTypeName(type) {
    return type === 'rechargeable' ? this._t('rechargeable') : type;
  }

  // [{ key, name, icon, items: [{ b, context }] }]: rooms by name, types by how many batteries use them, the
  // room-less and the unknown last; by replacement date, the bands from now to later, then the ones without forecast
  _battGroups(list, view) {
    var rank = (b) => (b.unavailable ? 0 : b.alert || b.low ? 1 : 2);
    var byLevel = (a, b) => rank(a) - rank(b) || (a.level ?? 101) - (b.level ?? 101) || a.name.localeCompare(b.name);
    if (view === 'forecast') return this._battForecast(list);
    // By level, as its mockup: what to replace (the batteries in error first, then the lowest) beside the ones that
    // are fine
    if (view === 'level') {
      var item = (b) => ({ b, context: [b.area, this._battTypeName(b.battery_type || '')].filter(Boolean).join(' · ') });
      var sorted = [...list].sort(byLevel);
      var due = sorted.filter((b) => b.unavailable || b.alert || b.low);
      var fine = sorted.filter((b) => !(b.unavailable || b.alert || b.low));
      return [
        { key: 'replace', name: this._t('to_replace'), icon: 'mdi:battery-alert-variant-outline', items: due.map(item) },
        { key: 'fine', name: this._t('batt_fine'), icon: 'mdi:battery-check-outline', items: fine.map(item) },
      ].filter((g) => g.items.length);
    }
    var map = new Map();
    [...list].sort(byLevel).forEach((b) => {
      var key = view === 'room' ? b.area || '' : this._battType(b);
      if (!map.has(key)) map.set(key, []);
      var m = /^(\d+)\s*[×x]/.exec(b.battery_type || '');
      var cells = m ? Number(m[1]) : 1;
      var count = view === 'type' && b.battery_type && b.battery_type !== 'rechargeable' ? this._t(cells === 1 ? 'cells_one' : 'cells_many', { n: cells }) : '';
      var context = view === 'room' ? this._battTypeName(b.battery_type || '') : [b.area, count].filter(Boolean).join(' · ');
      map.get(key).push({ b, context, cells });
    });
    return [...map.entries()]
      .map(([key, items]) => ({
        key,
        items,
        name: key ? (view === 'type' ? this._battTypeName(key) : key) : this._t(view === 'room' ? 'no_area' : 'unknown_type'),
        icon: view === 'room' ? this._areaIcon(key) : key ? 'mdi:battery-outline' : 'mdi:battery-unknown',
        hint: view === 'type' && !key ? this._t('unknown_type_hint') : '',
        // By type, the batteries of that type in all (a remote with 2 AAA counts 2)
        cells: view === 'type' && key && key !== 'rechargeable' ? items.reduce((n, x) => n + x.cells, 0) : null,
      }))
      .sort((a, b) => !a.key - !b.key || (view === 'type' ? b.items.length - a.items.length : 0) || a.name.localeCompare(b.name));
  }

  _battForecast(list) {
    var bands = [
      ['now', 'mdi:battery-alert-variant-outline', (b) => b.low || b.unavailable],
      ['month', 'mdi:calendar-alert', (b) => Number.isInteger(b.days_left) && b.days_left <= 30],
      ['quarter', 'mdi:calendar-clock', (b) => Number.isInteger(b.days_left) && b.days_left <= 92],
      ['later', 'mdi:calendar-check', (b) => Number.isInteger(b.days_left)],
      ['none', 'mdi:help-circle-outline', () => true],
    ];
    var items = new Map(bands.map(([key]) => [key, []]));
    var order = (a, b) =>
      (a.days_left ?? Number.POSITIVE_INFINITY) - (b.days_left ?? Number.POSITIVE_INFINITY) || (a.level ?? 101) - (b.level ?? 101) || a.name.localeCompare(b.name);
    [...list].sort(order).forEach((b) => {
      var key = bands.find(([, , test]) => test(b))[0];
      var drain = Number(b.drain_per_day) > 0 ? this._t('drain', { n: this._battNum(b.drain_per_day) }) : '';
      var when =
        key === 'now' || key === 'none'
          ? ''
          : [this._t('forecast', { d: this._t('days', { n: b.days_left }) }), b.replace_by ? this._t('replace_on', { date: this._battDate(b.replace_by) }) : '']
              .filter(Boolean)
              .join(' ');
      items.get(key).push({ b, context: [b.area, when, drain].filter(Boolean).join(' · ') });
    });
    return bands
      .filter(([key]) => items.get(key).length)
      .map(([key, icon]) => ({ key, icon, items: items.get(key), name: this._t(`fc_${key}`) }));
  }

  _battNum(n) {
    var lang = this._hass?.locale?.language || this._hass?.language || undefined;
    try {
      return new Intl.NumberFormat(lang, { maximumFractionDigits: n < 1 ? 2 : 1 }).format(n);
    } catch (_err) {
      return String(Math.round(n * 100) / 100);
    }
  }

  // Day and month; the year only for a date beyond the next eleven months
  _battDate(iso) {
    var date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    var far = date - Date.now() > 330 * 864e5;
    try {
      return date.toLocaleDateString(this._hass?.locale?.language || this._hass?.language || undefined, {
        day: 'numeric',
        month: 'short',
        ...(far ? { year: 'numeric' } : {}),
      });
    } catch (_err) {
      return iso.slice(0, 10);
    }
  }

  // Git Sync: every repository (the first one first), and the one the tab shows (a chip per repository)
  _gitRepos() {
    return this._state.git_sync_repos || [];
  }

  _gitData() {
    var repos = this._gitRepos();
    return repos.find((r) => r.id === this._gitRepo) || repos[0] || this._state.git_sync;
  }

  // The repository the tab's actions run on: named only when there are several
  _gitTarget() {
    var repos = this._gitRepos();
    return repos.length > 1 ? { repository: this._gitData().path } : {};
  }

  // Git Sync: status, changed files, commit and push
  _gitSync() {
    var data = this._gitData();
    if (!data) return `<ha-card class="note">${shEsc(this._t('git_needs_repo'))}</ha-card>`;
    var repos = this._gitRepos();
    var picker =
      repos.length > 1
        ? `<div class="segs gitrepos" role="group" aria-label="${shEsc(this._entityName('sensor', 'git_sync_status'))}">${repos
            .map((r) => {
              var on = r.id === data.id;
              return `<button class="seg${on ? ' active' : ''}" data-action="git_repo" data-id="${shEsc(r.id)}" aria-pressed="${on}" title="${shEsc(r.path)}">${shEsc(r.title)}</button>`;
            })
            .join('')}</div>`
        : '';
    var tone = { clean: 'good', dirty: 'warn', ahead: 'warn', behind: 'warn', diverged: 'bad', error: 'bad' }[data.status] || '';
    var commit = data.last_commit;
    var tiles = [
      this._tile('mdi:source-branch', `<b>${shEsc(data.branch || '—')}</b>`, this._l(`component.${SH_DOMAIN}.entity.sensor.git_sync_status.state.${data.status}`) || data.status, tone),
      this._tile('mdi:file-document-edit-outline', `<b>${data.changed ?? 0}</b>`, this._entityName('sensor', 'git_sync_changed_files'), data.changed ? 'warn' : 'good'),
      this._tile('mdi:source-commit', shEsc(commit ? this._rel(new Date(commit.timestamp * 1000).toISOString()) : this._t('never')), commit ? commit.message : this._entityName('sensor', 'git_sync_last_commit'), ''),
      this._tile('mdi:cloud-check-outline', shEsc(this._rel(data.last_push)), this._entityName('sensor', 'git_sync_last_push'), ''),
    ];
    var sync = [data.ahead ? this._t('ahead', { n: data.ahead }) : '', data.behind ? this._t('behind', { n: data.behind }) : ''].filter(Boolean).join(' · ');
    // The changed files: their count always; folded beyond SH_GIT_FILES_MAX until opened
    var list = data.files || [];
    var count = Math.max(data.changed ?? 0, list.length);
    var open = this._gitFilesOpen ?? count <= SH_GIT_FILES_MAX;
    var files = list
      .map((f) => `<div class="item"><ha-icon icon="mdi:file-outline"></ha-icon><div class="who"><div class="n"><code>${shEsc(f)}</code></div></div></div>`)
      .join('');
    var fold = count
      ? `<button class="icon-btn" data-action="git_files_fold" aria-expanded="${open}" title="${shEsc(this._t('changed'))}" aria-label="${shEsc(this._t('changed'))}"><ha-icon icon="mdi:chevron-${open ? 'up' : 'down'}"></ha-icon></button>`
      : '';
    return `${picker}<div class="tiles">${tiles.join('')}</div>
      <ha-card class="block"><div class="actions"><label class="box"><input data-draft="message" placeholder="${shEsc(this._t('message'))}" value="${shEsc(this._draft.message || '')}"></label>
        ${data.ai_task ? this._button('git_sync_generate_message', 'mdi:creation-outline', this._t('generate'), { quiet: true }) : ''}</div>
        <div class="actions">${this._button('git_sync_commit_push', 'mdi:source-commit-end', this._entityName('button', 'git_sync_commit_push'))}
        ${this._button('git_sync_diff', 'mdi:file-compare', this._t('diff'), { quiet: true, disabled: !data.changed && !data.ahead })}
        ${this._button('git_sync_pull', 'mdi:source-pull', this._serviceName('git_sync_pull'), { quiet: true })}
        ${this._button('git_sync_export_dashboards', 'mdi:export', this._entityName('button', 'git_sync_export_dashboards'), { quiet: true })}
        ${sync ? `<span class="pill warn">${shEsc(sync)}</span>` : ''}${this._message('git_sync')}${this._configure()}</div>
        ${data.last_error ? `<span class="msg bad">${shEsc(data.last_error)}</span>` : ''}
        ${data.remote_url ? `<span class="msg"><code>${shEsc(data.remote_url)}</code></span>` : ''}</ha-card>
      <ha-card class="list"><div class="lhead"><ha-icon icon="mdi:file-multiple-outline"></ha-icon><span class="lname">${shEsc(this._t('changed'))}</span>
        <span class="muted">${count}</span>${fold}</div>
      ${count ? (open ? files : '') : `<div class="empty good"><ha-icon icon="mdi:check-circle-outline"></ha-icon>${shEsc(this._t('clean'))}</div>`}</ha-card>`;
  }

  // Settings: the modules turned on, and the order of the tabs
  _settings() {
    var modules = this._draft.modules || this._state.modules || [];
    var changed = Boolean(this._draft.modules || this._draft.tabs || this._draft.hide_header);
    return `${this._settingsModules(modules)}
      ${
        changed || this._busy.save
          ? `<div class="savebar" role="region" aria-label="${shEsc(this._t('unsaved'))}"><span class="grow">${shEsc(this._t('unsaved'))}</span>
          ${this._button('discard', 'mdi:undo', this._t('discard'), { quiet: true, disabled: this._busy.save })}
          ${this._button('save', 'mdi:content-save-outline', this._t('save'))}</div>`
          : ''
      }
      <div class="actions">${this._message('save')}</div>`;
  }

  // Settings → Display: who the top bar is hidden for
  _settingsDisplay() {
    var mode = this._draft.hide_header || this._state.hide_header || 'off';
    var choices = ['off', 'all', 'non_admin']
      .map((value) => {
        var on = value === mode;
        return `<button class="seg${on ? ' active' : ''}" data-action="hide_header" data-value="${value}" aria-pressed="${on}">${shEsc(this._t(`hide_header_${value}`))}</button>`;
      })
      .join('');
    var hint = mode === 'non_admin' ? `${this._t('hide_header_hint')} ${this._t('hide_header_non_admin_note')}` : this._t('hide_header_hint');
    return `<section class="cfgcard"><div class="cfgsec cfggroup"><ha-icon icon="mdi:monitor-dashboard"></ha-icon><span class="grow">${shEsc(this._t('settings_display'))}</span></div>
      <div class="cfglist"><div class="row cfgrow cfgdisplay"><span class="cfgpad"></span><ha-icon icon="mdi:dock-top"></ha-icon>
        <div class="who"><div class="n">${shEsc(this._t('hide_header'))}</div><div class="s">${shEsc(hint)}</div></div></div>
        <div class="segs cfgsegs" role="group" aria-label="${shEsc(this._t('hide_header'))}">${choices}</div></div></section>`;
  }

  _onClick(ev) {
    if (this._orphClick(ev)) return;
    // A link inside Home Assistant: its own navigation, without reloading the page
    var nav = ev.target.closest?.('[data-nav]');
    if (nav && !ev.ctrlKey && !ev.metaKey && !ev.shiftKey && ev.button !== 1) {
      ev.preventDefault?.();
      history.pushState(null, '', nav.dataset.nav);
      window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: false } }));
      return;
    }
    // A row or a button that opens its entity's dialog; a button or a link inside such a row does its own thing
    var more = ev.target.closest?.('[data-more]');
    var control = ev.target.closest?.('button, a, input, select');
    if (more && (!control || control.hasAttribute('data-more'))) {
      this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId: more.dataset.more }, bubbles: true, composed: true }));
      return;
    }
    var toggle = ev.target.closest?.('ha-switch[data-module]');
    if (toggle) {
      // The switch flips after the click: read it once it has
      setTimeout(() => {
        var current = this._draft.modules || [...(this._state.modules || [])];
        var module = toggle.dataset.module;
        var next = toggle.checked ? [...new Set([...current, module])] : current.filter((m) => m !== module);
        this._draft.modules = Object.keys(SH_MODULE_NAMES).filter((m) => next.includes(m));
        this._render();
      });
      return;
    }
    var button = ev.target.closest?.('[data-action]');
    if (!button || button.disabled) return;
    var action = button.dataset.action;
    if ((action.startsWith('cfg_') || action.startsWith('open_settings')) && this._cfgClick(button)) return;
    if (action === 'reload') return this._load();
    if (action === 'go_settings') return this._goTab('settings');
    if (action === 'cancel' || action === 'confirm_install') {
      this._haCheck = null;
      this._confirm = action === 'confirm_install' ? 'install' : null;
      return this._render();
    }
    if (action === 'period') {
      this._periods[button.dataset.chart] = Number(button.dataset.hours);
      return this._render();
    }
    if (action === 'batt_csv') return this._battDownload();
    if (action === 'st_open') return this._goTab(button.dataset.tab);
    if (action === 'git_files_fold') {
      var shown = this._gitData() || {};
      var shownNow = this._gitFilesOpen ?? Math.max(shown.changed ?? 0, (shown.files || []).length) <= SH_GIT_FILES_MAX;
      this._gitFilesOpen = !shownNow;
      return this._render();
    }
    if (action === 'stock_edit' || action === 'stock_cancel') {
      this._stockForm = action === 'stock_edit';
      if (this._stockForm) {
        var kind = button.dataset.kind || '';
        this._draft.stock_type = kind;
        this._draft.stock_count = kind ? String(this._state.batteries?.spares?.[kind]?.stock ?? '') : '';
      }
      return this._render();
    }
    if (action === 'set_stock') {
      var type = (this._draft.stock_type || '').trim();
      if (!type) return;
      var count = String(this._draft.stock_count ?? '').trim();
      var data = { battery_type: type };
      if (count !== '') data.count = Math.max(0, Math.round(Number(count)));
      return this._run(
        'batteries_set_stock',
        'batteries_set_stock',
        data,
        () => {
          this._stockForm = false;
        },
        SH_DOMAIN,
        action,
      );
    }
    if (action === 'batt_view') {
      this._battView = button.dataset.view;
      return this._render();
    }
    if (action === 'save') return this._save();
    if (action === 'discard') {
      this._draft.modules = null;
      this._draft.tabs = null;
      this._draft.hide_header = null;
      return this._render();
    }
    if (action === 'hide_header') {
      var hideValue = button.dataset.value;
      this._draft.hide_header = hideValue === (this._state.hide_header || 'off') ? null : hideValue;
      return this._render();
    }
    if (action.startsWith('auto_')) return this._autoAction(action, button);
    if (action.startsWith('ha_ask:') || action.startsWith('ha_ok:')) return this._haAction(action);
    if (action.startsWith('watchdog_reset:')) return this._run('watchdog_reset', 'watchdog_reset', { entry_id: action.split(':')[1] }, null, SH_DOMAIN, action);
    if (action === 'git_sync_generate_message') return this._generate();
    if (action === 'git_sync_diff') return this._openDiff();
    if (action === 'git_repo') {
      this._gitRepo = button.dataset.id;
      return this._render();
    }
    if (action === 'git_sync_commit_push') return this._commitPush();
    if (action === 'git_sync_pull' || action === 'git_sync_export_dashboards') return this._run(action, 'git_sync', this._gitTarget(), null, SH_DOMAIN, action);
    if (action === 'lg_level' || action === 'lg_period') {
      this[action === 'lg_level' ? '_lgLevel' : '_lgPeriod'] = button.dataset.value;
      return this._render();
    }
    if (action === 'lg_ignore') return this._lgIgnore(button.dataset.key);
    if (action === 'lg_reload') return this._lgReload(button.dataset.domain);
    if (action === 'lg_clear_confirm') {
      this._confirm = 'lg_clear';
      return this._render();
    }
    if (action === 'lg_clear') {
      this._confirm = null;
      return this._run('clear', 'lg', {}, () => this._lgLoad(true), 'system_log', 'lg_clear');
    }
    if (action === 'sl_filter') {
      this._slFilter = button.dataset.kind || null;
      return this._render();
    }
    if (action === 'sl_view') {
      this._slView = button.dataset.view;
      this._slSel = null;
      return this._render();
    }
    if (action === 'sl_pick' && Date.now() - (this._slDragged || 0) < 300) return;
    if (action === 'sl_fit') {
      this._slBox = null;
      return this._render();
    }
    if (action === 'sl_labels') {
      this._slLabels = this._slLabels === false;
      return this._render();
    }
    if (action === 'sl_tree') {
      this._slTreeOpen = !this._slTreeOpen;
      return this._render();
    }
    if (action === 'sl_pick') {
      this._slSel = this._slSel === button.dataset.node ? null : button.dataset.node;
      return this._render();
    }
    if (action === 'sl_only') {
      this._slOnly = !this._slOnly;
      return this._render();
    }
    if (action === 'sl_net_reload') return this._slNetLoad(button.dataset.net, true);
    if (action === 'sl_ignore') return this._slIgnore(button.dataset.device, button.dataset.name);
    if (action === 'sc_scan') return this._scLoad(true, true);
    if (action === 'sc_ignore') return this._scIgnore(button.dataset.ip, button.dataset.ignore !== 'false');
    if (action === 'sc_revoke_confirm') {
      this._confirm = `sc_revoke:${button.dataset.token}`;
      return this._render();
    }
    if (action === 'sc_revoke') return this._scRevoke(button.dataset.token);
    if (action === 'sc_allow') {
      var allow = button.dataset.allow !== 'false';
      return this._scCall(`sc_allow:${button.dataset.slug}`, { type: 'system_hub/security_allow_addon', slug: button.dataset.slug, allow });
    }
    if (action === 'db_pick_device') {
      var dev = (this._db?.data?.top || []).find((d) => (d.device_id || d.entity_ids?.[0] || d.name) === button.dataset.key);
      var all = dev?.entity_ids || [];
      var set = (this._dbSel ??= new Set());
      // All ticked: untick them; otherwise tick the rest
      if (all.length && all.every((id) => set.has(id))) for (var one of all) set.delete(one);
      else for (var one2 of all) set.add(one2);
      if (this._confirm === 'db_purge') this._confirm = null;
      return this._render();
    }
    if (action === 'db_open') {
      var opened = (this._dbOpen ??= new Set());
      if (opened.has(button.dataset.key)) opened.delete(button.dataset.key);
      else opened.add(button.dataset.key);
      return this._render();
    }
    if (action === 'db_pick') {
      var picked = (this._dbSel ??= new Set());
      if (picked.has(button.dataset.entity)) picked.delete(button.dataset.entity);
      else picked.add(button.dataset.entity);
      if (this._confirm === 'db_purge') this._confirm = null;
      return this._render();
    }
    if (action === 'db_refresh') return this._dbLoad(true, true);
    if (action === 'db_copy') return this._dbCopy();
    if (action === 'db_purge_confirm' || action === 'db_repack_confirm') {
      this._confirm = action.replace('_confirm', '');
      return this._render();
    }
    if (action === 'db_purge') {
      this._confirm = null;
      var entities = [...(this._dbSel || [])];
      this._dbSel = new Set();
      return this._run('purge_entities', 'db', { entity_id: entities, keep_days: 0 }, () => this._dbLoad(true, true), 'recorder', 'db_purge');
    }
    if (action === 'db_repack') {
      this._confirm = null;
      return this._run('purge', 'db', { keep_days: this._db?.data?.keep_days ?? 10, repack: true }, () => this._dbLoad(true, true), 'recorder', 'db_repack');
    }
    if (action === 'bk_now') return this._run('create_automatic', 'bk', {}, () => this._bkLoad(true), 'backup', 'bk_now');
    if (action === 'upd_backup') {
      this._updBackup = !(this._updBackup ?? Boolean(this._state.marketplace?.backup_before_install));
      return this._render();
    }
    if (action === 'upd_all_confirm') {
      this._confirm = 'upd_all';
      return this._render();
    }
    if (action === 'upd_all') return this._updAll();
    if (action === 'upd_confirm') {
      this._confirm = `upd:${button.dataset.entity}`;
      return this._render();
    }
    if (action === 'upd_install') {
      var entity = button.dataset.entity;
      this._confirm = null;
      return this._run('install', 'upd', { entity_id: entity, ...(button.dataset.backup ? { backup: true } : {}) }, null, 'update', `upd_install:${entity}`);
    }
    if (action === 'mk_install') {
      var target = button.dataset.entity;
      this._kickLoad();
      return this._run('marketplace_install_updates', 'marketplace_install_updates', { entity_id: [target], wait: true }, null, SH_DOMAIN, `mk_install:${target}`);
    }
    if (action === 'marketplace_install_updates') {
      this._confirm = null;
      // wait: the service answers once the installs have ended, so a failed one shows next to the buttons
      this._kickLoad();
      return this._run(action, action, { wait: true });
    }
    return this._run(action, action, {});
  }

  // An action: its button spins (busyKey, the clicked button's action) until the state is read again; done in a toast, a
  // failure next to the buttons
  // A list of data calls the action once per item, one after the other (an action that takes a single target).
  async _run(service, messageKey, data, done, domain = SH_DOMAIN, busyKey = service) {
    this._busy[busyKey] = true;
    delete this._messages[messageKey];
    this._render();
    try {
      for (var item of Array.isArray(data) ? data : [data]) await this._hass.callService(domain, service, item);
      this._toast(this._t('done'));
      done?.();
    } catch (err) {
      this._messages[messageKey] = { text: this._t('failed', { error: shErr(err) }), tone: 'bad' };
    }
    await this._load();
    delete this._busy[busyKey];
    this._render();
  }

  // Automations: what Automation Monitor reports (its sensors, read on the server), as in the Automation Monitor card
  _automations() {
    var data = this._state.automations || {};
    if (!data.available) {
      return `<ha-card class="note">${shEsc(this._t('auto_not_found'))}
        <a class="act" href="/config/integrations/dashboard/add?domain=automation_monitor"><ha-icon icon="mdi:plus"></ha-icon>Automation Monitor</a></ha-card>`;
    }
    var failures = data.failures || [];
    var linked = data.linked || [];
    var count = (n, na) => (na ? '<b>—</b>' : `<b>${n}</b>`);
    var tone = (n, na, bad) => (na ? '' : n ? bad : 'good');
    var naTitle = this._t('auto_sensor_unavailable');
    var tiles = [
      this._tile('mdi:robot-confused-outline', count(failures.length, data.failed_na), this._t('auto_failed'), tone(failures.length, data.failed_na, 'bad'), {
        entity: data.failed_entity,
        title: data.failed_na ? naTitle : '',
      }),
      this._tile('mdi:link-variant-off', count(linked.length, data.linked_na), this._t('auto_linked'), tone(linked.length, data.linked_na, 'warn'), {
        entity: data.linked_entity,
        title: data.linked_na ? naTitle : '',
      }),
      this._tile('mdi:clock-alert-outline', shEsc(failures.length ? this._rel(failures[0].last_error_time) : '—'), this._t('auto_last_failure'), ''),
      this._tile('mdi:robot-outline', `<b>${data.automations ?? 0}</b>`, SH_MODULE_NAMES.automations, ''),
    ];
    var confirm = '';
    if (this._confirm === 'auto_clear_all' || this._confirm?.startsWith?.('auto_clear:')) {
      var all = this._confirm === 'auto_clear_all';
      var entity = all ? '' : this._confirm.slice('auto_clear:'.length);
      var name = failures.find((f) => f.entity_id === entity)?.name || entity;
      confirm = `<div class="confirm" role="alertdialog">${shEsc(all ? this._t('auto_confirm_clear_all') : this._t('auto_confirm_clear', { name }))}
        ${this._button(all ? 'auto_clear_all_ok' : 'auto_clear_ok', 'mdi:notification-clear-all', this._t(all ? 'auto_clear_all' : 'auto_clear'), { data: { entity }, danger: true })}
        ${this._button('cancel', 'mdi:close', this._t('cancel'), { quiet: true })}</div>`;
    }
    var both = data.failed_na && data.linked_na;
    return `<div class="tiles">${tiles.join('')}</div>${confirm}
      <div class="actions"><span title="${shEsc(this._t('auto_rebuild_title'))}">${this._button('auto_rebuild', 'mdi:refresh', this._t('auto_rebuild'))}</span>
      ${failures.length ? this._button('auto_clear_all', 'mdi:notification-clear-all', this._t('auto_clear_all'), { quiet: true, busy: this._busy.auto_clear_all }) : ''}
      ${this._message('auto')}${both ? `<span class="msg bad">${shEsc(this._t('auto_unavailable'))}</span>` : ''}${this._configure()}</div>
      ${this._autoSection('failed', 'mdi:robot-confused-outline', this._t('auto_failed'), failures, (f) => this._autoFailure(f))}
      ${this._autoSection('linked', 'mdi:link-variant-off', this._t('auto_linked'), linked, (e) => this._autoLinked(e))}`;
  }

  // A list that folds from its title, cut to SH_AUTO_MAX items with "Show more"
  _autoSection(key, icon, label, items, row) {
    this._autoFolds = this._autoFolds || {};
    this._autoMore = this._autoMore || {};
    var open = !this._autoFolds[key];
    var all = this._autoMore[key];
    var shown = open ? (all ? items : items.slice(0, SH_AUTO_MAX)) : [];
    var more =
      open && items.length > SH_AUTO_MAX
        ? `<div class="actions more-row">${this._button(`auto_more:${key}`, all ? 'mdi:chevron-up' : 'mdi:chevron-down', all ? this._t('auto_show_less') : this._t('auto_show_more', { n: items.length - SH_AUTO_MAX }), { quiet: true })}</div>`
        : '';
    var empty = `<div class="empty good"><ha-icon icon="mdi:check-circle-outline"></ha-icon>${shEsc(this._t('auto_all_ok'))}</div>`;
    return `<ha-card class="list"><div class="lhead"><ha-icon icon="${icon}"></ha-icon><span class="lname">${shEsc(label)}</span>
        <span class="muted">${shown.length}/${items.length}</span>
        <button class="icon-btn" data-action="auto_fold:${key}" aria-expanded="${open}" title="${shEsc(label)}" aria-label="${shEsc(label)}"><ha-icon icon="${open ? 'mdi:chevron-up' : 'mdi:chevron-down'}"></ha-icon></button></div>
      ${open ? (items.length ? shown.map(row).join('') + more : empty) : ''}</ha-card>`;
  }

  _autoFailure(f) {
    var tags = [
      f.error_step ? `<span class="pill" title="${shEsc(this._t('auto_step'))}">${shEsc(f.error_step)}</span>` : '',
      f.consecutive_failures > 1 ? `<span class="pill bad">${shEsc(this._t('auto_streak', { n: f.consecutive_failures }))}</span>` : '',
    ].join('');
    var links = [
      f.trace ? `<a class="act quiet" href="${shEsc(f.trace)}"><ha-icon icon="mdi:chart-timeline-variant"></ha-icon>${shEsc(this._t('auto_trace'))}</a>` : '',
      f.edit ? `<a class="act quiet" href="${shEsc(f.edit)}"><ha-icon icon="mdi:pencil"></ha-icon>${shEsc(this._t('auto_edit'))}</a>` : '',
      this._button('auto_clear', 'mdi:restore', this._t('auto_clear'), { quiet: true, data: { entity: f.entity_id }, busy: this._busy[`auto_clear:${f.entity_id}`] }),
    ].join('');
    return `<div class="item bad link" data-more="${shEsc(f.entity_id)}"><ha-icon icon="mdi:robot-confused-outline"></ha-icon>
      <div class="who"><div class="n">${shEsc(f.name)}</div><div class="s">${shEsc(f.entity_id)}</div>
        ${f.error_message ? `<div class="s wrap"><code>${shEsc(f.error_message)}</code></div>` : ''}
        ${tags ? `<div class="s wrap">${tags}</div>` : ''}
        <div class="actions">${links}</div></div>
      <div class="side muted">${shEsc(this._rel(f.last_error_time))}</div></div>`;
  }

  _autoLinked(e) {
    var used = (e.used_by || [])
      .map((u) =>
        u.edit
          ? `<a class="pill" href="${shEsc(u.edit)}" title="${shEsc(u.entity_id)}">${shEsc(u.name)}</a>`
          : `<span class="pill" title="${shEsc(u.entity_id)}">${shEsc(u.name)}</span>`,
      )
      .join(' ');
    return `<div class="item warn link" data-more="${shEsc(e.entity_id)}"><ha-icon icon="mdi:link-variant-off"></ha-icon>
      <div class="who"><div class="n">${shEsc(e.name)}</div><div class="s">${shEsc(e.entity_id)} · ${shEsc(this._t('unavailable_since', { date: this._ago(e.unavailable_since) }))}</div>
        ${used ? `<div class="s wrap">${shEsc(this._t('auto_used_by'))} ${used}</div>` : ''}</div></div>`;
  }

  // The Automations tab's buttons: Automation Monitor's own actions (Clear asks first), the folds and "Show more"
  _autoAction(action, button) {
    var [name, key] = action.split(':');
    if (name === 'auto_fold') {
      this._autoFolds = { ...this._autoFolds, [key]: !this._autoFolds?.[key] };
      return this._render();
    }
    if (name === 'auto_more') {
      this._autoMore = { ...this._autoMore, [key]: !this._autoMore?.[key] };
      return this._render();
    }
    if (name === 'auto_clear' || name === 'auto_clear_all') {
      this._confirm = name === 'auto_clear_all' ? name : `auto_clear:${button.dataset.entity}`;
      return this._render();
    }
    this._confirm = null;
    if (name === 'auto_clear_ok') return this._run('reset', 'auto', { entity_id: button.dataset.entity }, null, 'automation_monitor', `auto_clear:${button.dataset.entity}`);
    if (name === 'auto_clear_all_ok') {
      // Failures left out by the settings stay: then only the listed ones are cleared, one call each (the action takes a
      // single entity_id); otherwise one call clears them all.
      var auto = this._state.automations || {};
      if (!auto.failures_hidden) return this._run('reset', 'auto', {}, null, 'automation_monitor', 'auto_clear_all');
      return this._run('reset', 'auto', (auto.failures || []).map((f) => ({ entity_id: f.entity_id })), null, 'automation_monitor', 'auto_clear_all');
    }
    if (name === 'auto_rebuild') return this._run('rebuild_linked_entities', 'auto', {}, null, 'automation_monitor', 'auto_rebuild');
  }

  // The changes a commit would include, in the full screen diff viewer: Versioning's banner as its header, the
  // panel's message as its message, and Commit and push from it
  _openDiff() {
    if (!this._diffDialog) {
      this._diffDialog = document.createElement('system-hub-diff-dialog');
      document.body?.appendChild?.(this._diffDialog);
    }
    var state = this._gitData() || {};
    var target = this._gitTarget();
    var sub = [state.ahead ? this._t('ahead', { n: state.ahead }) : '', state.behind ? this._t('behind', { n: state.behind }) : ''].filter(Boolean).join(' · ');
    this._diffDialog.open({
      t: (key, vars) => this._t(key, vars),
      locale: this._hass?.locale?.language || this._hass?.language || undefined,
      branch: state.branch,
      commitLabel: this._entityName('button', 'git_sync_commit_push'),
      lastPush: { value: this._rel(state.last_push), label: this._entityName('sensor', 'git_sync_last_push') },
      message: this._draft.message || '',
      style: SH_BANNER_STYLE,
      banner: (over) => this._banner({ tab: 'git_sync', sub: sub || state.remote_url || '', ...over }),
      request: async () =>
        (await this._hass.callWS({ type: 'call_service', domain: SH_DOMAIN, service: 'git_sync_get_diff', service_data: target, return_response: true }))?.response,
      generate: state.ai_task ? () => this._generate() : null,
      onCommit: (message) => {
        this._draft.message = message;
        this._commitPush();
      },
    });
  }

  // Commit and push, with the message typed (none: the integration writes one)
  _commitPush() {
    var message = (this._draft.message || '').trim();
    return this._run('git_sync_commit_push', 'git_sync', { ...(message ? { message } : {}), ...this._gitTarget() }, () => {
      this._draft.message = '';
    });
  }

  async _generate() {
    var service = 'git_sync_generate_message';
    this._busy[service] = true;
    this._render();
    try {
      var res = await this._hass.callWS({ type: 'call_service', domain: SH_DOMAIN, service, service_data: this._gitTarget(), return_response: true });
      var message = res?.response?.message;
      if (message) this._draft.message = message;
      else this._messages.git_sync = { text: this._t('clean'), tone: '' };
    } catch (err) {
      this._messages.git_sync = { text: this._t('failed', { error: shErr(err) }), tone: 'bad' };
    }
    delete this._busy[service];
    this._render();
    // The diff viewer puts it in its own field
    return message;
  }

  async _save() {
    this._busy.save = true;
    this._render();
    var msg = { type: 'system_hub/update_settings' };
    if (this._draft.modules) msg.modules = this._draft.modules;
    if (this._draft.tabs) msg.tabs = this._draft.tabs;
    if (this._draft.hide_header) msg.hide_header = this._draft.hide_header;
    delete this._messages.save;
    try {
      await this._hass.callWS(msg);
      // The entry reloads with the new modules: the button spins until they are read
      await new Promise((resolve) => setTimeout(resolve, 1500));
      this._draft.modules = null;
      this._draft.tabs = null;
      this._draft.hide_header = null;
      await this._load();
      this._toast(this._t('saved'));
    } catch (err) {
      if (err?.code === 'git_sync_needs_repository') {
        // Its repository first, checked by the flow: the Modules form, with the modules chosen, then the repository
        var chosen = this._draft.modules || [];
        this._draft.modules = null;
        delete this._busy.save;
        this._messages.save = { text: this._t('git_needs_repo'), tone: 'bad' };
        await this._cfgOpen('git_sync', 'modules');
        if (this._cfg?.step === 'modules') {
          for (var m of Object.keys(SH_MODULE_NAMES)) if (m in this._cfg.data) this._cfg.data[m] = chosen.includes(m);
          this._cfg.haForm = null;
          this._render();
        }
        return;
      }
      this._messages.save = { text: this._t('failed', { error: shErr(err) }), tone: 'bad' };
    }
    delete this._busy.save;
    this._render();
  }
}

// Orphans tab (Orphans module): the entities their integration no longer provides and the orphan devices. Counters by
// reason, search and filters, selection one by one or of every match, Remove and Ignore in bulk once confirmed, and
// what still uses each orphan. The whole list comes from system_hub/orphans (the sensor's attributes are capped).
var SH_ORPH_REASONS = ['entry_removed', 'integration_missing', 'not_provided', 'unavailable', 'unknown'];
var SH_ORPH_ICONS = {
  entry_removed: 'mdi:puzzle-remove-outline',
  integration_missing: 'mdi:puzzle-remove-outline',
  not_provided: 'mdi:ghost-outline',
  unavailable: 'mdi:lan-disconnect',
  unknown: 'mdi:help-circle-outline',
};
var SH_ORPH_REF_ICONS = {
  automation: 'mdi:robot-outline',
  script: 'mdi:script-text-outline',
  scene: 'mdi:palette-outline',
  group: 'mdi:google-circles-communities',
  dashboard: 'mdi:view-dashboard-outline',
};
// Rows shown before "Show all"
var SH_ORPH_ROWS = 100;

// No longer provided: red; still provided but stale: orange
function shOrphTone(reason) {
  return reason === 'unavailable' || reason === 'unknown' ? 'warn' : 'bad';
}

// The orphans matching every search word (name, entity ID, integration, device, config entry), integration and reason
function shOrphFilter(items, filters = {}, names = {}) {
  var words = String(filters.q || '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  return (items || []).filter((i) => {
    if (filters.platform && i.platform !== filters.platform) return false;
    if (filters.reason && i.reason !== filters.reason) return false;
    var hay = [i.name, i.entity_id, i.platform, names[i.platform], i.device, i.entry_title].filter(Boolean).join(' ').toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

var SH_ORPHANS_METHODS = {
  _orph() {
    this._orphState ??= { data: null, error: null, loading: false, sel: new Set(), dsel: new Set(), all: false, confirm: null };
    return this._orphState;
  },

  async _orphLoad() {
    var o = this._orph();
    if (o.loading || !this._hass) return;
    o.loading = true;
    try {
      o.data = await this._hass.callWS({ type: 'system_hub/orphans' });
      o.error = null;
      // Only what is still listed stays selected
      var ids = new Set((o.data.entities || []).map((e) => e.entity_id));
      var devices = new Set((o.data.devices || []).map((d) => d.device_id));
      o.sel = new Set([...o.sel].filter((id) => ids.has(id)));
      o.dsel = new Set([...o.dsel].filter((id) => devices.has(id)));
    } catch (err) {
      o.error = shErr(err);
    }
    o.loading = false;
  },

  // "{n} entity" / "{n} entities": the key's _one or _many string
  _orphN(key, n) {
    return this._t(`${key}_${n === 1 ? 'one' : 'many'}`, { n });
  },

  _orphFilters() {
    return { q: this._draft.orph_q || '', platform: this._draft.orph_platform || '', reason: this._draft.orph_reason || '' };
  },

  // "for 3 d": "< 1 h" the first hour, hours up to two days, days beyond
  _orphFor(iso) {
    var t = new Date(iso).getTime();
    if (!iso || !Number.isFinite(t)) return '';
    var h = Math.max(0, (Date.now() - t) / 3600000);
    var d = h < 1 ? this._t('hours', { n: '< 1' }) : h < 48 ? this._t('hours', { n: Math.floor(h) }) : this._t('days', { n: Math.floor(h / 24) });
    return this._t('orph_for', { d });
  },

  // What still uses an orphan: automations, scripts, scenes, groups and dashboards, each a link to its editor
  _orphUses(refs) {
    if (!refs?.length) return '';
    var chips = refs
      .map((r) => {
        var inner = `<ha-icon icon="${SH_ORPH_REF_ICONS[r.type] || 'mdi:link-variant'}"></ha-icon>${shEsc(r.name)}`;
        var title = shEsc(this._t(`orph_ref_${r.type}`));
        return r.path ? `<a class="use" href="${shEsc(r.path)}" title="${title}">${inner}</a>` : `<span class="use" title="${title}">${inner}</span>`;
      })
      .join('');
    return `<div class="uses"><span>${shEsc(this._t('orph_used_by', { n: refs.length }))}</span>${chips}</div>`;
  },

  _orphTile(reason, n, on) {
    var tone = n ? shOrphTone(reason) : 'good';
    return `<ha-card class="tile pick ${tone}${on ? ' on' : ''}" data-action="orph_reason" data-reason="${reason}" aria-pressed="${on}">
      <div class="avatar"><ha-icon icon="${SH_ORPH_ICONS[reason]}"></ha-icon></div>
      <div class="who"><div class="n"><b>${n}</b></div><div class="s">${shEsc(this._t(`orph_reason_${reason}`))}</div></div></ha-card>`;
  },

  _orphConfirm(kind, n, used) {
    var title = {
      remove: this._orphN('orph_confirm_remove', n),
      ignore: this._orphN('orph_confirm_ignore', n),
      remove_devices: this._t('orph_confirm_devices'),
      ignore_devices: this._t('orph_confirm_ignore_devices'),
    }[kind];
    var text = { remove: 'orph_confirm_remove_text', ignore: 'orph_confirm_ignore_text', remove_devices: 'orph_confirm_devices_text' }[kind];
    var warn = used ? (kind === 'remove' ? this._orphN('orph_confirm_used', used) : kind === 'remove_devices' ? this._t('orph_confirm_devices_used', { n: used }) : '') : '';
    var label = kind.startsWith('ignore') ? this._t('orph_ignore') : warn ? this._t('orph_remove_anyway') : this._t('orph_remove');
    return `<div class="confirm" role="alertdialog"><div class="who"><div class="n">${shEsc(title)}</div>
        ${text ? `<div class="s">${shEsc(this._t(text))}</div>` : ''}${warn ? `<div class="s warn-text">${shEsc(warn)}</div>` : ''}</div>
      ${this._button('orph_do', kind.startsWith('ignore') ? 'mdi:eye-off-outline' : 'mdi:delete-outline', label, { danger: !kind.startsWith('ignore') })}
      ${this._button('orph_cancel', 'mdi:close', this._t('cancel'), { quiet: true })}</div>`;
  },

  _orphRow(e, names, on) {
    var sub = [e.entity_id, names[e.platform] || e.platform, e.device, e.entry_title].filter(Boolean);
    var why = [this._t(`orph_reason_${e.reason}`), this._orphFor(e.since)].filter(Boolean).join(' · ');
    var tone = shOrphTone(e.reason);
    return `<div class="item orow ${tone}${on ? ' on' : ''}">
      <input type="checkbox" data-orph-sel="${shEsc(e.entity_id)}"${on ? ' checked' : ''} aria-label="${shEsc(e.name)}">
      <ha-icon icon="${SH_ORPH_ICONS[e.reason] || 'mdi:ghost-outline'}"></ha-icon>
      <div class="who"><div class="n">${shEsc(e.name)}${e.disabled ? ` <span class="muted">(${shEsc(this._t('orph_disabled'))})</span>` : ''}</div>
        <div class="s">${shEsc(sub.join(' · '))}</div><div class="s">${shEsc(why)}</div>${this._orphUses(e.used_by)}</div>
      <span class="pill ${tone}">${shEsc(this._t(`orph_reason_${e.reason}`))}</span></div>`;
  },

  _orphDevices(devices, o) {
    if (!devices.length) return '';
    var rows = devices
      .map((d) => {
        var on = o.dsel.has(d.device_id);
        var sub = [[d.manufacturer, d.model].filter(Boolean).join(' '), this._t('orph_dev_entities', { n: d.entities ?? 0 }), this._orphFor(d.since)].filter(Boolean);
        return `<div class="item orow bad${on ? ' on' : ''}">
          <input type="checkbox" data-orph-dsel="${shEsc(d.device_id)}"${on ? ' checked' : ''} aria-label="${shEsc(d.name)}">
          <ha-icon icon="mdi:devices"></ha-icon>
          <div class="who"><div class="n">${shEsc(d.name)}</div><div class="s">${shEsc(sub.join(' · '))}</div>${this._orphUses(d.used_by)}</div>
          <a class="icon-btn" href="/config/devices/device/${shEsc(d.device_id)}" title="${shEsc(this._t('open_device'))}" aria-label="${shEsc(this._t('open_device'))}"><ha-icon icon="mdi:open-in-new"></ha-icon></a></div>`;
      })
      .join('');
    var targets = o.dsel.size ? devices.filter((d) => o.dsel.has(d.device_id)) : devices;
    var used = targets.filter((d) => d.used_by?.length).length;
    var confirm = o.confirm === 'remove_devices' || o.confirm === 'ignore_devices' ? this._orphConfirm(o.confirm, targets.length, used) : '';
    var bar = `<div class="obar">${o.dsel.size ? `<span>${shEsc(this._orphN('orph_selected', o.dsel.size))}</span>` : ''}
      ${this._button('orph_confirm', 'mdi:delete-outline', this._t('orph_remove_devices'), { data: { act: 'remove_devices' }, disabled: this._busy.orph, busy: this._busy.orph === 'remove_devices', danger: true })}
      ${this._button('orph_confirm', 'mdi:eye-off-outline', this._t('orph_ignore'), { quiet: true, data: { act: 'ignore_devices' }, disabled: !o.dsel.size || this._busy.orph, busy: this._busy.orph === 'ignore_devices' })}
      ${o.dsel.size ? this._button('orph_dclear', 'mdi:close', this._t('orph_clear'), { quiet: true }) : ''}</div>`;
    return `<ha-card class="list"><div class="lhead"><ha-icon icon="mdi:devices"></ha-icon><span class="lname">${shEsc(this._t('orph_devices_title'))}</span>
        <span class="muted">${devices.length}</span></div>
      <div class="obar">${shEsc(this._t('orph_devices_hint'))}</div>${bar}${confirm}${rows}</ha-card>`;
  },

  _orphans() {
    var summary = this._state.orphans || {};
    var o = this._orph();
    if (!o.data && !o.loading && !o.error) {
      this._orphLoad().then(() => this._tab === 'orphans' && this._render());
    }
    var data = o.data || {};
    var counts = data.counts || summary.counts || {};
    var names = data.integrations || {};
    var f = this._orphFilters();
    var entities = data.entities || [];
    var devices = data.devices || [];
    var tiles = [
      ...SH_ORPH_REASONS.map((r) => this._orphTile(r, counts[r] ?? 0, f.reason === r)),
      this._tile('mdi:devices', `<b>${summary.devices ?? devices.length}</b>`, this._t('orph_devices_title'), summary.devices ? 'bad' : 'good'),
      this._tile('mdi:delete-sweep-outline', `<b>${summary.removed ?? 0}</b>`, this._t('orph_stat_removed'), '', { title: this._t('orph_stat_removed_hint') }),
      this._tile('mdi:clock-check-outline', shEsc(summary.last_scan ? this._rel(summary.last_scan) : this._t('orph_never_scanned')), this._entityName('sensor', 'orphans_last_scan'), ''),
    ];
    var waiting = summary.next_scan ? `<span class="pill warn">${shEsc(this._t('orph_waiting'))} · ${shEsc(this._rel(summary.next_scan))}</span>` : '';
    var actions = `<div class="actions">${this._button('orphans_scan', 'mdi:magnify-scan', this._entityName('button', 'orphans_scan'))}
      ${waiting}${summary.ignored ? `<span class="pill">${shEsc(this._t('orph_stat_ignored'))} ${summary.ignored}</span>` : ''}
      ${this._message('orphans_scan')}${this._message('orphans')}
      ${this._configure()}</div>`;
    if (!o.data) {
      var note = o.error ? shEsc(this._t('failed', { error: o.error })) : this._spinner(this._t('loading'));
      return `<div class="tiles">${tiles.join('')}</div>${actions}<ha-card class="note">${note}</ha-card>`;
    }
    var platforms = [...new Set(entities.map((e) => e.platform))].sort((a, b) => (names[a] || a).localeCompare(names[b] || b));
    var matches = shOrphFilter(entities, f, names);
    var shown = o.all ? matches : matches.slice(0, SH_ORPH_ROWS);
    var selected = entities.filter((e) => o.sel.has(e.entity_id));
    var used = selected.filter((e) => e.used_by?.length).length;
    var filters = `<div class="ofilters">
      <label class="box"><input data-draft="orph_q" type="search" placeholder="${shEsc(this._t('orph_search'))}" aria-label="${shEsc(this._t('orph_search'))}" value="${shEsc(f.q)}"></label>
      <select data-draft="orph_platform" aria-label="${shEsc(this._t('orph_all_integrations'))}"><option value="">${shEsc(this._t('orph_all_integrations'))}</option>
        ${platforms.map((p) => `<option value="${shEsc(p)}"${p === f.platform ? ' selected' : ''}>${shEsc(names[p] || p)}</option>`).join('')}</select>
      <select data-draft="orph_reason" aria-label="${shEsc(this._t('orph_all'))}"><option value="">${shEsc(this._t('orph_all'))}</option>
        ${SH_ORPH_REASONS.filter((r) => counts[r])
          .map((r) => `<option value="${r}"${r === f.reason ? ' selected' : ''}>${shEsc(this._t(`orph_reason_${r}`))} (${counts[r]})</option>`)
          .join('')}</select></div>`;
    var unselected = matches.filter((e) => !o.sel.has(e.entity_id)).length;
    var bar = o.sel.size
      ? `<div class="obar"><span>${shEsc(this._orphN('orph_selected', o.sel.size))}</span>
          ${this._button('orph_confirm', 'mdi:delete-outline', this._t('orph_remove'), { data: { act: 'remove' }, disabled: this._busy.orph, busy: this._busy.orph === 'remove', danger: true })}
          ${this._button('orph_confirm', 'mdi:eye-off-outline', this._t('orph_ignore'), { quiet: true, data: { act: 'ignore' }, disabled: this._busy.orph, busy: this._busy.orph === 'ignore' })}
          ${unselected ? this._button('orph_select_all', 'mdi:checkbox-multiple-marked-outline', this._t('orph_select_all', { n: matches.length }), { quiet: true }) : ''}
          ${this._button('orph_clear', 'mdi:close', this._t('orph_clear'), { quiet: true })}</div>`
      : matches.length
        ? `<div class="obar">${this._button('orph_select_all', 'mdi:checkbox-multiple-marked-outline', this._t('orph_select_all', { n: matches.length }), { quiet: true })}</div>`
        : '';
    var confirm = o.confirm === 'remove' || o.confirm === 'ignore' ? this._orphConfirm(o.confirm, o.sel.size, used) : '';
    var rows = shown.map((e) => this._orphRow(e, names, o.sel.has(e.entity_id))).join('');
    var empty = entities.length
      ? `<div class="empty">${shEsc(this._t('orph_no_match'))}</div>`
      : `<div class="empty good"><ha-icon icon="mdi:check-circle-outline"></ha-icon>${shEsc(this._t('orph_empty'))}</div>`;
    var more = shown.length < matches.length ? `<div class="omore">${this._button('orph_all', 'mdi:chevron-down', this._t('orph_show_all', { n: matches.length }), { quiet: true })}</div>` : '';
    return `<div class="tiles">${tiles.join('')}</div>${actions}
      <ha-card class="list"><div class="lhead"><ha-icon icon="mdi:ghost-outline"></ha-icon><span class="lname">${shEsc(this._entityName('sensor', 'orphans_orphans'))}</span>
        <span class="muted">${matches.length === entities.length ? entities.length : `${matches.length} / ${entities.length}`}</span></div>
        ${entities.length ? filters : ''}${bar}${confirm}${rows || empty}${more}</ha-card>
      ${this._orphDevices(devices, o)}`;
  },

  // Checkboxes, filters by reason, selection and the confirmed actions; false: not an Orphans control
  _orphClick(ev) {
    var o = this._orph();
    var pick = ev.target.closest?.('[data-orph-sel], [data-orph-dsel]');
    if (pick) {
      var set = pick.dataset.orphSel ? o.sel : o.dsel;
      var id = pick.dataset.orphSel || pick.dataset.orphDsel;
      if (set.has(id)) set.delete(id);
      else set.add(id);
      o.confirm = null;
      this._render();
      return true;
    }
    var el = ev.target.closest?.('[data-action^="orph_"]');
    if (!el) return false;
    if (el.disabled) return true;
    var action = el.dataset.action;
    if (action === 'orph_reason') {
      this._draft.orph_reason = this._draft.orph_reason === el.dataset.reason ? '' : el.dataset.reason;
    } else if (action === 'orph_select_all') {
      for (var e of shOrphFilter(o.data?.entities, this._orphFilters(), o.data?.integrations)) o.sel.add(e.entity_id);
    } else if (action === 'orph_clear') {
      o.sel.clear();
      o.confirm = null;
    } else if (action === 'orph_dclear') {
      o.dsel.clear();
      o.confirm = null;
    } else if (action === 'orph_confirm') {
      o.confirm = el.dataset.act;
    } else if (action === 'orph_cancel') {
      o.confirm = null;
    } else if (action === 'orph_all') {
      o.all = true;
    } else if (action === 'orph_do') {
      this._orphRun(o.confirm);
      return true;
    }
    this._render();
    return true;
  },

  // An admin action of the module, with its response (what was removed, what was kept as no longer orphaned)
  async _orphCall(service, data) {
    var res = await this._hass.callWS({ type: 'call_service', domain: SH_DOMAIN, service, service_data: data, return_response: true });
    return res?.response || {};
  },

  async _orphRun(act) {
    var o = this._orph();
    o.confirm = null;
    var entities = [...o.sel];
    var devices = [...o.dsel];
    this._busy.orph = act;
    delete this._messages.orphans;
    this._render();
    try {
      var text;
      if (act === 'remove') {
        var res = await this._orphCall('orphans_remove', { entities });
        text = this._orphN('orph_removed', (res.removed || entities).length);
        if (res.skipped?.length) text += ` · ${this._t('orph_kept', { n: res.skipped.length })}`;
        o.sel.clear();
      } else if (act === 'ignore') {
        await this._hass.callService(SH_DOMAIN, 'orphans_ignore', { entities });
        text = this._orphN('orph_ignored', entities.length);
        o.sel.clear();
      } else if (act === 'remove_devices') {
        // Without a selection: every orphan device of the last scan
        var dres = await this._orphCall('orphans_remove_devices', devices.length ? { devices } : {});
        text = this._t('orph_devices_removed', { n: (dres.removed || []).length });
        if (dres.skipped?.length) text += ` · ${this._t('orph_kept', { n: dres.skipped.length })}`;
        o.dsel.clear();
      } else if (act === 'ignore_devices') {
        await this._hass.callService(SH_DOMAIN, 'orphans_ignore', { devices });
        text = this._t('orph_devices_ignored', { n: devices.length });
        o.dsel.clear();
      }
      if (text) this._toast(text);
    } catch (err) {
      this._messages.orphans = { text: this._t('failed', { error: shErr(err) }), tone: 'bad' };
    }
    await this._load();
    delete this._busy.orph;
    this._render();
  },
};

Object.assign(SystemHubPanel.prototype, SH_ORPHANS_METHODS);

if (!customElements.get('system-hub-diff-dialog')) {
  customElements.define('system-hub-diff-dialog', SystemHubDiffDialog);
}
if (!customElements.get('system-hub-panel')) {
  customElements.define('system-hub-panel', SystemHubPanel);
}

// Settings tab: each module's settings, edited in the panel. The panel drives System Hub's own options flow (the
// form Configure shows) through Home Assistant's flow API, so the fields, their checks and their errors are the same;
// the forms are Home Assistant's <ha-form>. A module's further steps (power cycles, battery types, the import, the Git
// repository) open from its section the same way.
var SH_SETTINGS_STEPS = {
  system: ['system'],
  containers: ['containers'],
  watchdog: ['watchdog', 'watchdog_add_power_cycle', 'watchdog_remove_power_cycle'],
  marketplace: ['marketplace'],
  backups: ['backups'],
  database: ['database'],
  security: ['security'],
  logs: ['logs'],
  silent: ['silent'],
  batteries: ['batteries', 'batteries_types', 'batteries_import'],
  git_sync: ['git_sync', 'git_sync_repository', 'git_sync_add_repository', 'git_sync_other', 'git_sync_remove_repository'],
  automations: ['automations'],
  orphans: ['orphans'],
};
var SH_SETTINGS_ICONS = { system: 'mdi:chip' };

// Home Assistant loads <ha-form> with its config pages: loaded here through them when no page has needed it yet
async function shLoadHaForm() {
  if (customElements.get('ha-form')) return true;
  try {
    await customElements.whenDefined('partial-panel-resolver');
    var resolver = document.createElement('partial-panel-resolver');
    resolver.hass = { panels: [{ url_path: 'tmp', component_name: 'config' }] };
    resolver._updateRoutes();
    await resolver.routerOptions.routes.tmp.load();
    await customElements.whenDefined('ha-panel-config');
    var config = document.createElement('ha-panel-config');
    await config.routerOptions.routes.automation.load();
  } catch (_err) {
    // Not loaded: the section links to Configure instead
  }
  return Boolean(customElements.get('ha-form'));
}

// The values a form starts from: those it suggests, else its defaults
// A form's values to start with: its suggested values, else its defaults; an empty suggestion (an entity not chosen)
// is left out, as Home Assistant's own forms do: sent as null, it would not pass the field's check (#63)
function shFormData(schema) {
  var data = {};
  for (var field of schema || []) {
    var suggested = field.description?.suggested_value;
    if (suggested !== undefined && suggested !== null) data[field.name] = suggested;
    else if (field.default !== undefined && field.default !== null) data[field.name] = field.default;
  }
  return data;
}

// The values sent: the empty ones left out, as Home Assistant's own forms do: null or undefined, and an empty string
// but in a text field (an entity or a device picker cleared gives one, which its check refuses)
function shFormSubmit(data, schema) {
  var text = new Set((schema || []).filter((f) => f.selector && ('text' in f.selector || 'template' in f.selector)).map((f) => f.name));
  return Object.fromEntries(Object.entries(data || {}).filter(([key, value]) => value !== null && value !== undefined && (value !== '' || text.has(key))));
}

// A form refused by Home Assistant (400: the values did not pass the checks): its errors by field, as the form shows
// them; "base" for those of the whole form
function shFormErrors(err) {
  var errors = err?.body?.errors;
  if (!errors || typeof errors !== 'object') return { base: shErr(err) };
  return Object.fromEntries(Object.entries(errors).map(([key, value]) => [key, Array.isArray(value) ? value.join(' · ') : String(value)]));
}

var SH_SETTINGS_METHODS = {
  _cfgState() {
    this._cfg ??= { module: null, step: null, flow: null, data: {}, errors: {}, menu: [], busy: false, error: null, haForm: null };
    return this._cfg;
  },

  // One row per module (and the System thresholds): its switch, what it does, and its settings once opened
  // The modules and the tabs in one list, as Home Assistant's sidebar editor: the ones turned on in the order of the
  // tabs (dragged by their handle, or moved with ↑ ↓ from it), each with its switch and its settings opened in place;
  // the ones turned off below
  _settingsModules(modules) {
    var cfg = this._cfgState();
    var tabs = shAllTabs(this._draft.tabs || this._state.tabs);
    var on = (t) => t === 'status' || t === 'system' || modules.includes(t);
    var row = (tab, enabled) => {
      var fixed = tab === 'status' || tab === 'system';
      var steps = SH_SETTINGS_STEPS[tab] || [];
      var saved = tab === 'system' || (this._state.modules || []).includes(tab);
      var open = cfg.module === tab;
      var name = this._tabName(tab);
      var hint =
        tab === 'status'
          ? this._t('st_hint')
          : tab === 'system'
            ? this._t('settings_system_hint')
            : this._l(`component.${SH_DOMAIN}.config.step.user.data_description.${tab}`);
      var first = enabled && tabs.find(on) === tab;
      // A handle only where there is something to order: two modules or more of the group turned on
      var handle = enabled && tabs.filter((t) => on(t) && shGroupOf(t) === shGroupOf(tab)).length > 1
        ? `<button class="icon-btn dragh" data-tab="${tab}" title="${shEsc(this._t('drag'))}" aria-label="${shEsc(`${this._t('drag')} · ${name}`)}"><ha-icon icon="mdi:drag-horizontal-variant"></ha-icon></button>`
        : '<span class="cfgpad"></span>';
      var head = `<div class="row cfgrow${open ? ' open' : ''}${enabled ? '' : ' off'}" data-row-tab="${tab}">${handle}<ha-icon icon="${SH_MODULE_ICONS[tab]}"></ha-icon>
        <div class="who"><div class="n">${shEsc(name)}${first ? `<span class="pill cfgdef">${shEsc(this._t('tab_default'))}</span>` : ''}</div>${hint ? `<div class="s">${shEsc(hint)}</div>` : ''}</div>
        ${fixed ? '' : `<ha-switch data-module="${tab}"${enabled ? ' checked' : ''} aria-label="${shEsc(name)}"></ha-switch>`}
        ${
          steps.length && saved
            ? `<button class="icon-btn" data-action="cfg_toggle" data-module="${tab}" aria-expanded="${open}" title="${shEsc(this._t('settings'))}" aria-label="${shEsc(`${this._t('settings')} · ${name}`)}"><ha-icon icon="mdi:cog${open ? '' : '-outline'}"></ha-icon></button>`
            : '<span class="cfgpad"></span>'
        }</div>`;
      return head + (open ? this._cfgBody(tab) : '');
    };
    // One section per group, moved with ↑ ↓; its modules turned on (dragged among themselves), then the ones turned off
    var groups = [...new Set(tabs.map(shGroupOf))];
    var sections = groups.map((group, i) => {
      var mine = tabs.filter((t) => shGroupOf(t) === group);
      var gname = this._groupName(group);
      var arrow = (dir, icon, disabled) =>
        `<button class="icon-btn" data-action="cfg_group" data-group="${group}" data-dir="${dir}"${disabled ? ' disabled' : ''} title="${shEsc(this._t(dir < 0 ? 'move_up' : 'move_down'))}" aria-label="${shEsc(`${this._t(dir < 0 ? 'move_up' : 'move_down')} · ${gname}`)}"><ha-icon icon="${icon}"></ha-icon></button>`;
      var enabledRows = mine.filter(on).map((t) => row(t, true)).join('');
      var disabledRows = mine.filter((t) => !on(t)).map((t) => row(t, false)).join('');
      return `<section class="cfgcard"><div class="cfgsec cfggroup"><ha-icon icon="${SH_MODULE_ICONS[mine[0]]}"></ha-icon><span class="grow">${shEsc(gname)}</span>${arrow(-1, 'mdi:arrow-up', i === 0)}${arrow(1, 'mdi:arrow-down', i === groups.length - 1)}</div>
        ${enabledRows ? `<div class="cfglist" data-group="${group}">${enabledRows}</div>` : ''}${disabledRows ? `<div class="cfglist off">${disabledRows}</div>` : ''}</section>`;
    });
    return `<ha-card class="block cfg"><h2>${shEsc(this._t('modules_tabs'))}</h2><span class="msg">${shEsc(this._t('modules_tabs_hint'))}</span>
      <div class="cfggrid">${sections.join('')}${this._settingsDisplay()}</div></ha-card>`;
  },

  // Moves a tab among the ones of its group turned on (the ones turned off keep their place): to the index `to` of that list
  _cfgMove(tab, to) {
    var modules = this._draft.modules || this._state.modules || [];
    var tabs = shAllTabs(this._draft.tabs || this._state.tabs);
    var on = (t) => t === 'status' || t === 'system' || modules.includes(t);
    var group = shGroupOf(tab);
    var mine = tabs.filter((t) => shGroupOf(t) === group);
    var enabled = mine.filter(on).filter((t) => t !== tab);
    enabled.splice(Math.max(0, Math.min(to, enabled.length)), 0, tab);
    var block = [...enabled, ...mine.filter((t) => !on(t))];
    var next = [...new Set(tabs.map(shGroupOf))].flatMap((g) => (g === group ? block : tabs.filter((t) => shGroupOf(t) === g)));
    if (next.join() !== tabs.join()) this._draft.tabs = next;
    this._render();
  },

  // Moves a whole group one place up (-1) or down (1) among the tabs
  _cfgMoveGroup(group, dir) {
    var tabs = shAllTabs(this._draft.tabs || this._state.tabs);
    var groups = [...new Set(tabs.map(shGroupOf))];
    var i = groups.indexOf(group);
    var j = i + dir;
    if (i < 0 || j < 0 || j >= groups.length) return;
    [groups[i], groups[j]] = [groups[j], groups[i]];
    this._draft.tabs = groups.flatMap((g) => tabs.filter((t) => shGroupOf(t) === g));
    this._render();
    this.shadowRoot.querySelector(`[data-action="cfg_group"][data-group="${group}"][data-dir="${dir}"]:not([disabled])`)?.focus();
  },

  // Dragging a row by its handle (mouse, finger, pen): the row follows among those turned on, the order is kept once
  // let go. Followed on the window: a row moved in the page loses the pointer capture
  _cfgDragStart(ev) {
    var handle = ev.target.closest?.('.dragh');
    if (!handle || ev.button > 0) return;
    var list = handle.closest('.cfglist');
    var row = handle.closest('[data-row-tab]');
    if (!list || !row) return;
    ev.preventDefault();
    var cfg = this._cfgState();
    if (cfg.module) {
      this._cfgAbort();
      Object.assign(cfg, { module: null, step: null, error: null, haForm: null });
    }
    this._drag = { tab: row.dataset.rowTab };
    row.classList.add('dragging');
    var move = (e) => {
      var over = this.shadowRoot.elementFromPoint?.(e.clientX, e.clientY)?.closest?.('[data-row-tab]');
      if (!over || over === row || over.parentNode !== list) return;
      var box = over.getBoundingClientRect();
      list.insertBefore(row, e.clientY > box.top + box.height / 2 ? over.nextSibling : over);
    };
    var end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      var order = [...list.querySelectorAll('[data-row-tab]')].map((el) => el.dataset.rowTab);
      this._drag = null;
      this._cfgMove(row.dataset.rowTab, order.indexOf(row.dataset.rowTab));
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  },

  // ↑ ↓ on a handle: the row one place up or down
  _cfgDragKey(ev) {
    var handle = ev.target.closest?.('.dragh');
    if (!handle || (ev.key !== 'ArrowUp' && ev.key !== 'ArrowDown')) return;
    ev.preventDefault();
    var tab = handle.dataset.tab;
    var modules = this._draft.modules || this._state.modules || [];
    var enabled = shAllTabs(this._draft.tabs || this._state.tabs).filter(
      (t) => shGroupOf(t) === shGroupOf(tab) && (t === 'status' || t === 'system' || modules.includes(t)),
    );
    this._cfgMove(tab, enabled.indexOf(tab) + (ev.key === 'ArrowUp' ? -1 : 1));
    this.shadowRoot.querySelector(`.dragh[data-tab="${tab}"]`)?.focus();
  },

  // An open section: the step's form, its further steps, Save
  _cfgBody(m) {
    var cfg = this._cfgState();
    if (cfg.error) {
      return `<div class="cfgbody"><span class="msg bad">${shEsc(cfg.error)}</span>
        <a class="act quiet" href="/config/integrations/integration/${SH_DOMAIN}"><ha-icon icon="mdi:cog-outline"></ha-icon>${shEsc(this._t('configure'))}</a></div>`;
    }
    if (!cfg.flow) return `<div class="cfgbody">${this._spinner(this._t('loading'))}</div>`;
    var others = (SH_SETTINGS_STEPS[m] || []).filter((s) => cfg.menu.includes(s));
    var tabs = others.length > 1
      ? `<div class="btabs cfgtabs" role="group">${others
          .map((s) => `<button class="btab${s === cfg.step ? ' on' : ''}" data-action="cfg_step" data-step="${s}" aria-pressed="${s === cfg.step}">${shEsc(this._cfgTitle(s))}</button>`)
          .join('')}</div>`
      : '';
    var description = this._l(`component.${SH_DOMAIN}.options.step.${cfg.step}.description`, cfg.flow.description_placeholders || {});
    var base = cfg.errors?.base ? this._l(`component.${SH_DOMAIN}.options.error.${cfg.errors.base}`) || cfg.errors.base : '';
    return `<div class="cfgbody">${tabs}
      ${description ? `<div class="s cfgdesc">${shEsc(description)}</div>` : ''}
      <div class="cfgform" data-step="${shEsc(cfg.step)}"></div>
      ${base ? `<span class="msg bad">${shEsc(base)}</span>` : ''}
      <div class="actions"><span class="grow"></span>${this._button('cfg_close', 'mdi:close', this._t('cancel'), { quiet: true, disabled: cfg.busy })}
        ${this._button('cfg_submit', 'mdi:content-save-outline', this._t('save'), { busy: cfg.busy })}</div></div>`;
  },

  _cfgTitle(step) {
    return this._l(`component.${SH_DOMAIN}.options.step.${step}.title`) || step;
  },

  // The form of the open step, put in its place after each drawing (the same element: what is typed stays)
  _cfgMount(main) {
    var cfg = this._cfgState();
    var slot = main.querySelector('.cfgform');
    if (!slot || !cfg.flow) return;
    if (!customElements.get('ha-form')) {
      slot.textContent = this._t('loading');
      return;
    }
    var form = cfg.haForm || document.createElement('ha-form');
    if (!cfg.haForm) {
      form.addEventListener('value-changed', (ev) => {
        cfg.data = ev.detail.value;
      });
      cfg.haForm = form;
    }
    var step = cfg.step;
    form.hass = this._hass;
    form.schema = cfg.flow.data_schema || [];
    form.data = cfg.data;
    form.error = Object.fromEntries(
      Object.entries(cfg.errors || {})
        .filter(([key]) => key !== 'base')
        .map(([key, value]) => [key, this._l(`component.${SH_DOMAIN}.options.error.${value}`) || value]),
    );
    form.computeLabel = (field) => this._l(`component.${SH_DOMAIN}.options.step.${step}.data.${field.name}`) || field.name;
    form.computeHelper = (field) => this._l(`component.${SH_DOMAIN}.options.step.${step}.data_description.${field.name}`);
    form.computeError = (error) => this._l(`component.${SH_DOMAIN}.options.error.${error}`) || error;
    form.disabled = cfg.busy;
    slot.appendChild(form);
  },

  // Opens a module's section on its first step (the one Configure would show), or closes it
  async _cfgOpen(module, step) {
    var cfg = this._cfgState();
    await this._cfgAbort();
    Object.assign(cfg, { module, step: step || SH_SETTINGS_STEPS[module][0], flow: null, data: {}, errors: {}, menu: [], error: null, busy: false });
    this._render();
    var ready = await shLoadHaForm();
    if (!ready) {
      cfg.error = this._t('settings_unavailable');
      return this._render();
    }
    try {
      var menu = await this._hass.callWS({ type: 'system_hub/options_flow' });
      cfg.menu = menu.menu_options || [];
      cfg.flowId = menu.flow_id;
      await this._cfgGo(cfg.step);
    } catch (err) {
      cfg.error = this._t('failed', { error: shErr(err) });
      this._render();
    }
  },

  async _cfgGo(step) {
    var cfg = this._cfgState();
    if (!cfg.menu.includes(step)) step = cfg.menu.find((s) => (SH_SETTINGS_STEPS[cfg.module] || []).includes(s)) || step;
    // A flow goes one way: another step starts it again from its menu
    if (cfg.flow) {
      await this._cfgAbort();
      var menu = await this._hass.callWS({ type: 'system_hub/options_flow' });
      cfg.menu = menu.menu_options || [];
      cfg.flowId = menu.flow_id;
    }
    var form = await this._hass.callApi('POST', `config/config_entries/options/flow/${cfg.flowId}`, { next_step_id: step });
    this._cfgShow(form);
  },

  // What the flow answered: a form (the first time, or with its errors), the settings saved, or an abort
  _cfgShow(result) {
    var cfg = this._cfgState();
    cfg.busy = false;
    if (result.type === 'form') {
      var first = !cfg.flow || cfg.step !== result.step_id;
      cfg.flow = result;
      cfg.step = result.step_id;
      cfg.errors = result.errors || {};
      if (first) {
        cfg.data = shFormData(result.data_schema);
        cfg.haForm = null;
      }
      return this._render();
    }
    if (result.type === 'create_entry') {
      this._toast(this._t('saved'));
      Object.assign(cfg, { module: null, step: null, flow: null, flowId: null, haForm: null });
      this._render();
      // The entry reloads with its new options: read them once it has
      setTimeout(() => this._load(), 1500);
      return;
    }
    cfg.flow = null;
    cfg.flowId = null;
    cfg.error = this._l(`component.${SH_DOMAIN}.options.abort.${result.reason}`) || result.reason || this._t('settings_unavailable');
    this._render();
  },

  async _cfgSubmit() {
    var cfg = this._cfgState();
    if (!cfg.flowId) return;
    cfg.busy = true;
    this._render();
    try {
      this._cfgShow(await this._hass.callApi('POST', `config/config_entries/options/flow/${cfg.flowId}`, shFormSubmit(cfg.data, cfg.flow?.data_schema)));
    } catch (err) {
      cfg.busy = false;
      cfg.errors = shFormErrors(err);
      this._render();
    }
  },

  async _cfgAbort() {
    var cfg = this._cfgState();
    var id = cfg.flowId;
    cfg.flowId = null;
    cfg.flow = null;
    if (id) await this._hass.callApi('DELETE', `config/config_entries/options/flow/${id}`).catch(() => {});
  },

  // The Settings tab's buttons for the sections; true when the click was one of them
  _cfgClick(button) {
    var action = button.dataset.action;
    var cfg = this._cfgState();
    if (action === 'cfg_group') {
      this._cfgMoveGroup(button.dataset.group, Number(button.dataset.dir));
      return true;
    }
    if (action === 'cfg_toggle') {
      var module = button.dataset.module;
      if (cfg.module === module) {
        this._cfgAbort();
        Object.assign(cfg, { module: null, step: null, error: null, haForm: null });
        this._render();
      } else this._cfgOpen(module);
      return true;
    }
    if (action === 'cfg_step') {
      this._cfgGo(button.dataset.step).catch((err) => {
        cfg.error = this._t('failed', { error: shErr(err) });
        this._render();
      });
      return true;
    }
    if (action === 'cfg_submit') {
      this._cfgSubmit();
      return true;
    }
    if (action === 'cfg_close') {
      this._cfgAbort();
      Object.assign(cfg, { module: null, step: null, error: null, haForm: null });
      this._render();
      return true;
    }
    if (action.startsWith('open_settings')) {
      var target = action.split(':')[1];
      this._selectTab('settings');
      if (target && SH_SETTINGS_STEPS[target]) this._cfgOpen(target);
      return true;
    }
    return false;
  },
};

Object.assign(SystemHubPanel.prototype, SH_SETTINGS_METHODS);

// Status tab: the health of the instance at a glance. A score out of 100 (100, less 15 per area needing action, 5 per
// area to watch, 1 per area with something to know), then one tile per area in the order of the tabs: its level, what
// it says in a few words, its details; a click opens its tab. Worked out here from what the panel already reads.
var SH_STATUS_WEIGHTS = { bad: 15, warn: 5, info: 1, good: 0 };

// The emblem beside the score, drawn after System Hub's logo in the colour of the ring: the house with its hub (the
// modules around a centre) and a badge cut out of its roof, a pulse in good health, "!" to watch, "×" with a problem
var SH_STATUS_GLYPHS = {
  good: '<polyline points="-34,3 -16,3 -7,-20 6,24 15,-4 34,-4" fill="none" stroke="#fff" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>',
  warn: '<line x1="0" y1="-24" x2="0" y2="6" stroke="#fff" stroke-width="12" stroke-linecap="round"/><circle cx="0" cy="25" r="7.5" fill="#fff"/>',
  bad: '<path d="M-18 -18 L18 18 M18 -18 L-18 18" stroke="#fff" stroke-width="12" stroke-linecap="round"/>',
};

var SH_STATUS_METHODS = {
  // One area: [tone, value, details] or null when there is nothing to show (module off, nothing read yet)
  _stArea(tab) {
    var s = this._state;
    var n = (key, count) => this._t(key, { n: count });
    var join = (parts) => parts.filter(Boolean).join(' · ');
    if (tab === 'system') {
      var sensors = s.system || [];
      if (!sensors.length) return null;
      var one = (key) => sensors.find((x) => x.key === key);
      var th = { ...SH_THRESHOLDS, ...(s.thresholds || {}) };
      var disks = sensors.filter((x) => x.key === 'disk_use_percent');
      var disk = disks.map((d) => shNum(d.state)).filter((v) => v !== null);
      var checks = [
        ['cpu', shNum(one('processor_use')?.state), 'CPU', '%'],
        ['ram', shNum(one('memory_use_percent')?.state), 'RAM', '%'],
        ['temperature', shNum(one('processor_temperature')?.state), '', '°C'],
        ['disk', disk.length ? Math.max(...disk) : null, this._t('disk'), '%'],
      ].filter(([, v]) => v !== null);
      var tones = checks.map(([key, v]) => shTone(v, th[key][0], th[key][1]));
      var tone = tones.includes('bad') ? 'bad' : tones.includes('warn') ? 'warn' : 'good';
      var high = checks.filter((_c, i) => tones[i] !== 'good').map(([, , label]) => label || this._t('temperature'));
      return [tone, tone === 'good' ? this._t('st_normal') : this._t('st_high', { what: high.join(', ') }), join(checks.map(([, v, label, unit]) => `${label ? `${label} ` : ''}${Math.round(v)} ${unit}`))];
    }
    if (tab === 'containers') {
      var data = s.containers;
      if (!data) return null;
      var list = data.containers || [];
      var down = list.filter((c) => c.down);
      var procs = (s.system || []).filter((x) => x.key === 'process');
      // The processes that may be stopped (System settings) are no problem
      var stopped = procs.filter((p) => p.state !== 'on' && !p.stoppable);
      var images = list.filter((c) => c.update_available);
      var running = list.filter((c) => c.state === 'started' || c.state === 'startup').length;
      var problems = down.length + stopped.length;
      return [
        problems ? 'bad' : images.length || data.error ? 'warn' : 'good',
        problems ? n('st_stopped', problems) : images.length ? n('st_available', images.length) : this._t('st_all_running'),
        join([...down.map((c) => c.container || c.name), ...stopped.map((p) => shProcess(p)), `${running}/${list.length}`]),
      ];
    }
    if (tab === 'marketplace') {
      var market = s.marketplace;
      // Home Assistant, the add-ons and the devices when the module reads them; else Core and OS alone
      var others = s.system_updates
        ? (s.system_updates.available || []).map((u) => `${u.title} ${u.latest}`)
        : (s.updates || []).filter((u) => u.state === 'on').map((u) => `${u.key === 'core' ? 'Core' : 'OS'} ${u.latest}`);
      if (!market && !others.length) return null;
      var repos = market?.list || [];
      var count = repos.length + others.length;
      return [
        market?.state === 'error' ? 'bad' : count ? 'warn' : 'good',
        count ? n('st_available', count) : this._t('up_to_date'),
        join([...others, ...repos.map((u) => `${u.title} ${u.latest}`)]),
      ];
    }
    if (tab === 'database') {
      var db = this._db?.data;
      if (!s.database || !db) return null;
      var dbTone = this._dbTone(db.size);
      return [
        dbTone === 'bad' ? 'warn' : dbTone || 'good',
        typeof db.size === 'number' ? shBytes(db.size) : this._t('db_days', { n: db.keep_days }),
        join([
          dbTone === 'bad' ? this._t('db_over', { n: s.database.max_size }) : '',
          this._t('db_days', { n: db.keep_days }),
          this._t('db_n_states', { n: (db.total_day ?? 0).toLocaleString(this._hass?.language) }),
          db.top?.[0] ? `${db.top[0].name} ×${db.top[0].count}` : '',
        ]),
      ];
    }
    if (tab === 'security') {
      var sc = s.security && this._scSummary();
      if (!sc) return null;
      var refusedN = sc.refused.reduce((sum, r) => sum + r.day, 0);
      return [
        sc.tone,
        sc.refused.length ? n('sc_n_refused', refusedN) : sc.unprotected.length ? n('sc_n_unprotected', sc.unprotected.length) : sc.warn ? n('sc_n_points', sc.warn) : this._t('sc_all_good'),
        join([
          ...sc.refused.slice(0, 2).map((r) => `${r.ip} ×${r.day}`),
          sc.refused.length && sc.unprotected.length ? n('sc_n_unprotected', sc.unprotected.length) : '',
          sc.noMfa.length ? n('sc_n_no_mfa', sc.noMfa.length) : '',
          sc.clear.length ? n('sc_n_in_clear', sc.clear.length) : '',
          sc.unused.length ? n('sc_n_unused', sc.unused.length) : '',
          sc.http ? this._t('sc_https_no') : '',
        ]),
      ];
    }
    if (tab === 'logs') {
      if (!s.logs || !this._lg?.entries) return null;
      // Only the frequent errors make a problem (an integration at the threshold in 24 h): an occasional error is
      // part of a normal day and stays in the Logs tab, without lowering the score
      var day = this._lgGroups('error', 'day');
      var worst = day.filter((g) => g.errors >= (s.logs.error_threshold ?? 10));
      var frequent = worst.reduce((sum, g) => sum + g.errors, 0);
      var occasional = day.reduce((sum, g) => sum + g.errors, 0) - frequent;
      if (!worst.length) return ['good', this._t('lg_no_frequent'), occasional ? n('lg_n_occasional', occasional) : ''];
      return ['bad', n('lg_n_errors', frequent), join(worst.slice(0, 3).map((g) => `${shIntegration(g.domain)} ×${g.errors}`))];
    }
    if (tab === 'silent') {
      var sl = s.silent;
      if (!sl) return null;
      var quiet = (sl.devices || []).filter((d) => d.silent);
      var weak = (sl.devices || []).filter((d) => !d.silent && d.signal?.weak);
      return [
        quiet.length ? 'warn' : weak.length ? 'info' : 'good',
        quiet.length ? n('sl_n_silent', quiet.length) : weak.length ? n('sl_n_weak', weak.length) : this._t('sl_all_heard'),
        join([...quiet.map((d) => d.name), weak.length && quiet.length ? n('sl_n_weak', weak.length) : '', quiet.length ? '' : this._t('sl_followed', { n: sl.tracked ?? 0 })]),
      ];
    }
    if (tab === 'backups') {
      if (!s.backups) return null;
      var bk = this._bkSummary();
      if (!bk) return null;
      return [
        bk.tone,
        bk.lastOk ? this._t('bk_ago', { when: this._rel(bk.lastOk) }) : this._t('bk_none'),
        join([bk.failed ? this._t('backup_failed') : '', ...bk.failing.map((a) => a.name), bk.next ? `${this._t('next_backup')} ${this._rel(bk.next)}` : '']),
      ];
    }
    if (tab === 'watchdog') {
      var wd = s.watchdog;
      if (!wd) return null;
      var unavailable = wd.unavailable || [];
      var gaveUp = unavailable.filter((u) => u.gave_up);
      return [
        gaveUp.length ? 'bad' : unavailable.length || wd.paused ? 'warn' : 'good',
        gaveUp.length ? n('st_gave_up', gaveUp.length) : unavailable.length ? n('st_unavailable', unavailable.length) : this._t('all_available'),
        join(unavailable.map((u) => `${u.title}${u.gave_up ? '' : ` ${u.reloads ?? 0}/${wd.max_reloads ?? ''}`}`)),
      ];
    }
    if (tab === 'automations') {
      var au = s.automations;
      if (!au?.available) return null;
      var failures = au.failures || [];
      var linked = au.linked || [];
      var repeated = failures.some((f) => f.consecutive_failures > 1);
      return [
        repeated ? 'bad' : failures.length || linked.length ? 'warn' : 'good',
        failures.length ? n('st_failing', failures.length) : linked.length ? n('st_unavailable', linked.length) : this._t('auto_all_ok'),
        join([...failures.map((f) => `${f.name}${f.consecutive_failures > 1 ? ` ×${f.consecutive_failures}` : ''}`), linked.length ? n('st_linked', linked.length) : '']),
      ];
    }
    if (tab === 'batteries') {
      var bat = s.batteries;
      if (!bat) return null;
      var low = (bat.batteries || []).filter((b) => b.low).sort((a, b) => (shNum(a.level) ?? 0) - (shNum(b.level) ?? 0));
      return [
        low.length ? 'warn' : bat.unavailable ? 'info' : 'good',
        low.length ? n('st_to_replace', low.length) : bat.unavailable ? n('st_unavailable', bat.unavailable) : this._t('st_all_good'),
        join(low.map((b) => `${b.name} ${Math.round(shNum(b.level) ?? 0)} %`)),
      ];
    }
    if (tab === 'git_sync') {
      var git = s.git_sync;
      if (!git || git.available === false) return null;
      // With several repositories, the one most in need of action speaks for all
      var gitRepos = (s.git_sync_repos || []).filter((r) => r.available !== false);
      var weight = (r) => (r.last_error || r.status === 'error' || (r.ahead && r.behind) ? 2 : r.changed || r.ahead || r.behind ? 1 : 0);
      if (gitRepos.length > 1) git = gitRepos.reduce((a, b) => (weight(b) > weight(a) ? b : a));
      var error = git.last_error || git.status === 'error' || (git.ahead && git.behind);
      var changed = git.changed || 0;
      return [
        error ? 'bad' : changed || git.ahead || git.behind ? 'warn' : 'good',
        error ? this._t('st_error') : changed ? n('st_changed', changed) : git.ahead ? n('st_to_push', git.ahead) : git.behind ? this._t('behind', { n: git.behind }) : this._t('clean'),
        join([git.branch, git.ahead ? this._t('ahead', { n: git.ahead }) : '', git.last_push ? this._t('st_pushed', { when: this._rel(git.last_push) }) : '']),
      ];
    }
    if (tab === 'orphans') {
      var orph = s.orphans;
      if (!orph) return null;
      var total = orph.total ?? Object.values(orph.counts || {}).reduce((a, b) => a + b, 0);
      var devices = orph.devices ?? 0;
      return [
        total || devices ? 'info' : 'good',
        total ? n('st_entities', total) : devices ? n(devices === 1 ? 'st_device' : 'st_devices', devices) : this._t('st_none'),
        join([devices ? n(devices === 1 ? 'st_device' : 'st_devices', devices) : '', orph.last_scan ? this._t('st_scanned', { when: this._rel(orph.last_scan) }) : '']),
      ];
    }
    return null;
  },

  // The areas of the Status tab, how many of each tone, the score and its tone (the ring, the emblem, the sidebar icon)
  _stTone() {
    var areas = this._tabs()
      .filter((t) => t !== 'status' && t !== 'settings')
      .map((tab) => [tab, this._stArea(tab)])
      .filter(([, a]) => a);
    var counts = { bad: 0, warn: 0, info: 0, good: 0 };
    for (var [, [tone]] of areas) counts[tone] += 1;
    var score = Math.max(0, 100 - Object.entries(counts).reduce((sum, [tone, k]) => sum + SH_STATUS_WEIGHTS[tone] * k, 0));
    return { areas, counts, score, tone: score >= 80 ? 'good' : score >= 50 ? 'warn' : 'bad' };
  },

  // The sidebar icon and its badge follow the Status tab: drawn again in this browser when they change
  // (system-hub-icons.js). Both take the overall tone (the ring): the icon its shape, the badge its colour, so the
  // badge matches the Status emblem. The badge counts the points to check (critical, to watch and info together).
  _reportTone() {
    if (!this._state?.loaded) return;
    var { counts, tone } = this._stTone();
    globalThis.systemHubSetTone?.(tone);
    globalThis.systemHubSetBadge?.(counts.bad + counts.warn + counts.info, tone);
  },

  // The version of Home Assistant and how long it has been up: the Status header's subtitle
  _stMeta() {
    var core = (this._state.updates || []).find((u) => u.key === 'core');
    var os = (this._state.updates || []).find((u) => u.key === 'os');
    var boot = (this._state.system || []).find((x) => x.key === 'last_boot');
    var bootAt = boot ? Date.parse(boot.state) : NaN;
    return [
      core?.installed ? `Home Assistant ${core.installed}` : '',
      os?.installed ? `OS ${os.installed}` : '',
      Number.isNaN(bootAt) ? '' : this._t('st_up', { time: this._uptime(Date.now() - bootAt).replace(/<[^>]+>/g, '') }),
    ].filter(Boolean);
  },

  // The Status tab, as its mockup: the counts as tiles (in the header card), the critical areas to handle first, then
  // one compact tile per area, in four columns by group
  _status() {
    var { areas, counts, score, tone: ringTone } = this._stTone();
    var word = (key) => this._t(key, { n: '' }).replace(/\s+/g, ' ').trim();
    var kpis = [
      this._tile('mdi:heart-pulse', `<b>${score} / 100</b>`, this._t('st_score').replace(/\s*\/\s*100\s*/, '').trim() || this._t('st_score'), ringTone),
      this._tile('mdi:alert-circle-outline', `<b>${counts.bad}</b>`, word('st_n_bad'), counts.bad ? 'bad' : ''),
      this._tile('mdi:alert-outline', `<b>${counts.warn}</b>`, word('st_n_warn'), counts.warn ? 'warn' : ''),
      this._tile('mdi:layers-outline', `<b>${counts.info}</b>`, word('st_n_info'), ''),
      this._tile('mdi:check-circle-outline', `<b>${counts.good}</b>`, word('st_n_good'), ''),
    ];
    var head = `<div class="tiles stkpis">${kpis.join('')}</div>`;
    // The areas to handle first: the critical ones, else those to watch
    var worst = areas.filter(([, [tone]]) => tone === 'bad');
    if (!worst.length) worst = areas.filter(([, [tone]]) => tone === 'warn');
    var priority = worst.length
      ? `<ha-card class="list stprio"><div class="lhead"><ha-icon icon="mdi:alert-outline"></ha-icon><span class="lname">${shEsc(this._t('st_priority'))} · ${worst.length}</span><span class="muted">${shEsc(this._t('st_priority_hint'))}</span></div>
        ${worst
          .map(
            ([tab, [tone, value, details]]) => `<div class="item ${tone}"><ha-icon icon="${SH_MODULE_ICONS[tab]}"></ha-icon>
          <div class="who"><div class="n">${shEsc(value)}</div>${details ? `<div class="s">${shEsc(details.split(' · ').slice(0, 3).join(' · '))}</div>` : ''}</div>
          <span class="muted stwhere">${shEsc(this._tabName(tab))}</span><button class="act quiet" data-action="st_open" data-tab="${tab}"><ha-icon icon="mdi:chevron-right"></ha-icon>${shEsc(this._t('st_view'))}</button></div>`,
          )
          .join('')}</ha-card>`
      : '';
    var tile = ([tab, [tone, value, details]]) => `<button class="sttile ${tone}" data-action="st_open" data-tab="${tab}" aria-label="${shEsc(`${this._tabName(tab)}: ${value}`)}">
        <span class="stic"><ha-icon icon="${SH_MODULE_ICONS[tab]}"></ha-icon></span><span class="sttxt"><span class="stname">${shEsc(this._tabName(tab))}</span>
        <span class="stval">${shEsc(value)}</span>${details ? `<span class="stdet">${shEsc(details)}</span>` : ''}</span><span class="stdot"></span></button>`;
    var rank = { bad: 3, warn: 2, info: 1, good: 0 };
    // The tiles by group, under the group's name with its worst tone and its count, in the order of the tabs
    var groups = this._groups()
      .map((group) => {
        var mine = areas.filter(([tab]) => shGroupOf(tab) === group);
        if (!mine.length) return '';
        var gtone = mine.reduce((w, [, [t]]) => (rank[t] > rank[w] ? t : w), 'good');
        return `<section class="stgroup"><h2 class="stsec"><span class="stgdot ${gtone}"></span>${shEsc(this._groupName(group))}<span class="muted">${mine.length}</span></h2><div class="stgrid">${mine.map(tile).join('')}</div></section>`;
      })
      .join('');
    return `${head}${priority}<div class="stgroups">${groups}</div>`;
  },
};

Object.assign(SystemHubPanel.prototype, SH_STATUS_METHODS);
// For the status cards (system-hub-card.js), which read the panel without showing it
SystemHubPanel.ICONS = SH_MODULE_ICONS;
SystemHubPanel.groupOf = shGroupOf;

// ── Illustrated header ─────────────────────────────────────────────────────────────────────────────────────────────
// Each tab opens on a 90 px header drawn like the ha-* cards' (ha-room-card's scene.js): the module's icon, its name
// and its status pill on a wall, a 360 × 80 scene at the right (some furniture, then the module's own piece, which
// follows its status) and a 10 px floor. Night (darker walls, stars, a lit lamp) with Home Assistant's dark theme.
// The scenes hold no id (no gradient, no mask) and stop moving with prefers-reduced-motion.
var SH_TONE_HEX = { good: '#43a047', warn: '#f5b400', bad: '#e5484d', info: '#2f80ed', idle: '#8a96a6' };
// The wall [day, night] and floor of each tab
var SH_WALLS = {
  status: ['#eef1f6', '#262c3a', 'parquet'],
  system: ['#eef1f6', '#262c3a', 'concrete'],
  containers: ['#e4e6ea', '#22262e', 'concrete'],
  database: ['#f2efe9', '#2a2b33', 'parquet'],
  security: ['#f3ede4', '#2b2a33', 'parquet'],
  logs: ['#eef1f6', '#262c3a', 'parquet'],
  watchdog: ['#f4ede3', '#2a2f3d', 'parquet'],
  automations: ['#eef3f4', '#283040', 'tiles'],
  marketplace: ['#f3f1ec', '#23262f', 'concrete'],
  backups: ['#e4e6ea', '#22262e', 'concrete'],
  git_sync: ['#eef1f6', '#262c3a', 'parquet'],
  silent: ['#f4ede3', '#2a2f3d', 'parquet'],
  batteries: ['#f2efe9', '#2a2b33', 'parquet'],
  orphans: ['#eef2f5', '#262c36', 'tiles'],
  settings: ['#e4e6ea', '#22262e', 'concrete'],
};
// The furniture at the left of each scene: window and lamp (A), frames and sideboard (B), shelf and chair (C),
// pipes, fuse box, pallet and cone (D)
var SH_DECOR = {
  status: 'A', system: 'D', containers: 'D', database: 'C', security: 'B', logs: 'A', watchdog: 'C', automations: 'B',
  marketplace: 'D', backups: 'D', git_sync: 'A', silent: 'B', batteries: 'C', orphans: 'A', settings: 'D',
};
var SH_COG =
  'M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.21,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.21,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.67 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z';

// A potted plant standing on the floor at x
function shPlant(x, k, n) {
  return `<g transform="translate(${x} 80) scale(${k})"><path d="M-7 0 l-2 -11 h18 l-2 11z" fill="#c0603a"/><path class="sh-leaf" d="M0 -11 q-10 -6 -11 -20 q8 4 11 15 q2 -14 10 -18 q1 12 -10 23z" fill="${n ? '#3e7a4a' : '#5aa83d'}"/></g>`;
}
function shCloud(x, y, k, fill) {
  return `<g transform="translate(${x} ${y}) scale(${k})"><path class="sh-cloud" d="M-14,4 C-17,4 -18,0 -14.5,-1 C-14,-5 -8,-6 -6,-3 C-4,-8 4,-8 5,-2 C9,-3 12,0 10,4 Z" fill="${fill || '#fff'}"/></g>`;
}

// The furniture of the left part (0–160)
function shDecor(kind, n) {
  var p = (day, night) => (n ? night : day);
  var frame = p('#fff', '#4a5568');
  var glass = p('#cfe8f8', '#1b2f52');
  var wood = p('#b98a5c', '#5c4836');
  var woodd = p('#a2744a', '#4a3a2c');
  var ink = p('#8a8478', '#4a4f60');
  if (kind === 'A') {
    var sky = n
      ? '<circle cx="66" cy="22" r="3" fill="#f3eed2"/><g fill="#fff" opacity=".8"><circle cx="40" cy="18" r=".7"/><circle cx="52" cy="40" r=".6"/><circle cx="72" cy="38" r=".6"/></g>'
      : `<circle cx="68" cy="22" r="5" fill="#ffd65a"/>${shCloud(44, 28, 0.8)}`;
    return `<rect x="28" y="10" width="52" height="46" rx="1.5" fill="${glass}" stroke="${frame}" stroke-width="2"/>${sky}<path d="M28 44 C40 38 60 40 80 36 V56 H28Z" fill="${p('#a7d39f', '#1d3a4a')}"/>
      <line x1="54" y1="10" x2="54" y2="56" stroke="${frame}" stroke-width="1.6"/><line x1="28" y1="33" x2="80" y2="33" stroke="${frame}" stroke-width="1.6"/><rect x="24" y="56" width="60" height="3" rx="1" fill="${frame}"/>
      <path d="M122 80 V30" stroke="${ink}" stroke-width="1.6"/><path d="M113 30 h18 l-4 -12 h-10z" fill="${p('#efe3c8', '#ffd27a')}"/><ellipse cx="122" cy="79" rx="7" ry="1.6" fill="${ink}"/>${n ? '<path d="M114 30 L100 80 H144 L130 30Z" fill="#ffd27a" opacity=".14"/>' : ''}`;
  }
  if (kind === 'B') {
    return `<rect x="26" y="14" width="40" height="28" rx="1" fill="${glass}" stroke="${p('#3a414c', '#20252e')}" stroke-width="2.4"/><path d="M28 38 L40 26 L48 33 L54 28 L64 38Z" fill="${p('#86c27f', '#2a5a3a')}"/><circle cx="56" cy="21" r="3" fill="#ffd65a"/>
      <rect x="74" y="20" width="22" height="30" rx="1" fill="${p('#fff', '#3d475c')}" stroke="${p('#3a414c', '#20252e')}" stroke-width="2.4"/><circle cx="85" cy="32" r="6" fill="${p('#f2b8a2', '#8a5a4a')}"/><rect x="79" y="40" width="12" height="3" rx="1" fill="${p('#9cc3e6', '#3a5a7a')}"/>
      <rect x="20" y="60" width="96" height="20" rx="2" fill="${p('#c9bfae', '#6b7586')}"/><rect x="24" y="64" width="42" height="12" rx="1" fill="${p('#d8cfc0', '#7a8496')}"/><rect x="70" y="64" width="42" height="12" rx="1" fill="${p('#d8cfc0', '#7a8496')}"/>
      <circle cx="62" cy="70" r="1" fill="${woodd}"/><circle cx="74" cy="70" r="1" fill="${woodd}"/><path d="M40 60 v-6 h8 v6" fill="${p('#e8f0fd', '#4a5568')}"/><path d="M44 54 q-4 -8 0 -12 q4 4 0 12z" fill="${p('#5aa83d', '#3e7a4a')}"/>`;
  }
  if (kind === 'C') {
    var books = [[34, 5, 16, '#2f80ed'], [40, 4, 13, '#e5484d'], [45, 6, 18, '#43a047'], [52, 4, 14, '#f5b400'], [57, 5, 16, '#7f77dd']]
      .map(([x, w, h, c]) => `<rect x="${x}" y="${34 - h}" width="${w}" height="${h}" rx=".8" fill="${c}"/>`)
      .join('');
    return `<rect x="28" y="34" width="74" height="3" rx="1" fill="${wood}"/><path d="M36 37 v5 h3 M94 37 v5 h-3" stroke="${woodd}" stroke-width="1.2" fill="none"/>${books}
      <path d="M76 34 l-2 -10 h10 l-2 10z" fill="${p('#9cc3e6', '#3a5a7a')}"/><path d="M79 24 q-6 -8 -2 -14 M79 24 q4 -10 8 -12" stroke="${p('#5aa83d', '#3e7a4a')}" stroke-width="1.4" fill="none"/>
      <g fill="${p('#c08a5a', '#5c4836')}"><rect x="104" y="60" width="26" height="5" rx="2"/><rect x="104" y="40" width="5" height="22" rx="2"/><rect x="106" y="65" width="3" height="15"/><rect x="125" y="65" width="3" height="15"/></g>`;
  }
  return `<path d="M0 12 H150" stroke="${p('#b5bbc2', '#3a414c')}" stroke-width="5"/><path d="M30 12 V40" stroke="${p('#b5bbc2', '#3a414c')}" stroke-width="5"/><rect x="26" y="40" width="8" height="5" fill="${p('#9aa1a9', '#2c323b')}"/><circle cx="90" cy="12" r="5" fill="${p('#e5484d', '#8a3a3a')}"/>
    <rect x="52" y="22" width="22" height="28" rx="2" fill="${p('#fff', '#3d475c')}" stroke="${p('#c9ced6', '#55617a')}"/><path d="M60 30 l-3 6 h4 l-2 6 l6 -8 h-4 l2 -4z" fill="#f5b400"/>
    <g fill="${p('#c9a06a', '#6a5236')}"><rect x="94" y="72" width="40" height="3"/><rect x="94" y="77" width="40" height="3"/><rect x="96" y="75" width="4" height="2"/><rect x="112" y="75" width="4" height="2"/><rect x="128" y="75" width="4" height="2"/></g>
    <rect x="98" y="54" width="32" height="18" rx="1" fill="${p('#c9a06a', '#7a6040')}"/><rect x="111" y="54" width="6" height="18" fill="${p('#e5c48f', '#9a8058')}"/>
    <path d="M140 80 l6 -20 h4 l6 20z" fill="#f57c00"/><rect x="143" y="68" width="10" height="3" fill="#fff"/><rect x="136" y="78" width="24" height="2" rx="1" fill="#e06a00"/>`;
}

// The module's own piece (0–200, drawn at x 160): its look follows the tone. `extra`: the Status tab's score and
// group tones, the failing backup locations, the installs running
function shScene(name, tone, n, extra = {}) {
  var p = (day, night) => (n ? night : day);
  var c = SH_TONE_HEX[tone] || SH_TONE_HEX.good;
  var ok = tone === 'good' || tone === 'info' || tone === 'idle';
  var bad = tone === 'bad';
  var blink = ok ? '' : 'sh-blink';
  var good = SH_TONE_HEX.good;
  var face = p('#fff', '#3d475c');
  var edge = p('#c9ced6', '#55617a');
  var ink = p('#5f6b7a', '#a9b4c2');
  var dark = p('#3a414c', '#20252e');
  var wood = p('#b98a5c', '#5c4836');
  var woodd = p('#a2744a', '#4a3a2c');
  var led = (x, y, col, cls = '') => `<circle class="${cls}" cx="${x}" cy="${y}" r="1.3" fill="${col}"/>`;
  var badge = (x, y, text) =>
    `<g class="${blink}"><circle cx="${x}" cy="${y}" r="5.5" fill="${c}"/><text x="${x}" y="${y + 2.3}" text-anchor="middle" font-size="6.5" font-weight="700" font-family="Roboto,sans-serif" fill="#fff">${text}</text></g>`;
  var shelf = (x, y, w) =>
    `<rect x="${x}" y="${y}" width="${w}" height="3" rx="1" fill="${wood}"/><path d="M${x + 6} ${y + 3} v6 h3 M${x + w - 6} ${y + 3} v6 h-3" stroke="${woodd}" stroke-width="1.2" fill="none"/>`;
  var up = (x, y, col) =>
    `<g transform="translate(${x} ${y})"><g class="sh-up"><circle r="8" fill="${col}"/><path d="M0 4 v-8 m-3.5 3.5 l3.5 -3.5 l3.5 3.5" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g></g>`;
  if (name === 'status') {
    var score = Math.max(0, Math.min(100, Number(extra.score ?? 100)));
    var mark = { bad: 'M-2.6 -2.6 l5.2 5.2 M2.6 -2.6 l-5.2 5.2', warn: 'M0 -3.4 v3.6 M0 2.6 v.3' }[tone] || 'M-3 0 l2 2.2 l4 -4.4';
    var groups = extra.groups || [];
    var bars = groups
      .slice(0, 4)
      .map((g, i) => {
        var col = SH_TONE_HEX[g] || good;
        return `<circle cx="52" cy="${11 + i * 8.5}" r="2" fill="${col}"${g === 'bad' ? ' class="sh-blink"' : ''}/><rect x="57" y="${9.3 + i * 8.5}" width="${[20, 14, 18, 12][i]}" height="3.4" rx="1.7" fill="${col}"/>`;
      })
      .join('');
    var beams = ok ? '' : `<g transform="translate(178 42)"><g class="sh-rot-fast"><path d="M0 0 L-30 -9 L-30 9Z M0 0 L30 -9 L30 9Z" fill="${c}" opacity=".35"/></g></g>`;
    return `<rect class="sh-glow" x="52" y="2" width="104" height="62" rx="12" fill="${c}" opacity="${ok ? '.10' : '.16'}"/>${beams}
      <g transform="translate(60 8)"><rect width="90" height="50" rx="5" fill="${p('#2a3038', '#14181f')}"/><rect x="3" y="3" width="84" height="44" rx="3" fill="${p('#1b2129', '#0d1117')}"/>
        <circle cx="24" cy="25" r="13" fill="none" stroke="#2e3a4e" stroke-width="4.5"/><circle cx="24" cy="25" r="13" fill="none" stroke="${c}" stroke-width="4.5" stroke-dasharray="${((2 * Math.PI * 13 * score) / 100).toFixed(1)} 100" transform="rotate(-90 24 25)" stroke-linecap="round"/>
        <text x="24" y="28.4" text-anchor="middle" font-size="10" font-weight="700" font-family="Roboto,sans-serif" fill="#fff">${score}</text>${bars}
        <g transform="translate(78 12)" class="${blink}"><circle r="6" fill="${c}"/><path d="${mark}" stroke="#fff" stroke-width="1.8" stroke-linecap="round" fill="none"/></g></g>
      <rect x="100" y="58" width="10" height="4" fill="${p('#2a3038', '#14181f')}"/>
      <g transform="translate(178 80)"><rect x="-14" y="-28" width="28" height="28" rx="2" fill="${p('#c9bfae', '#6b7586')}"/><rect x="-11" y="-24" width="22" height="20" rx="1.5" fill="${p('#d8cfc0', '#7a8496')}"/>
        <rect x="-7" y="-32" width="14" height="4" rx="1" fill="${p('#5f6b7a', '#3a414c')}"/><path d="M-6 -32 v-6 a6 6 0 0 1 12 0 v6z" fill="${c}" class="${ok ? '' : 'sh-blink'}"/><rect x="-4" y="-40" width="3" height="5" rx="1.5" fill="#fff" opacity=".6"/></g>
      ${ok ? `<g transform="translate(178 41)"><circle class="sh-ping" r="7" fill="none" stroke="${c}" stroke-width="1"/></g>` : ''}`;
  }
  if (name === 'system') {
    var fill = bad ? 92 : tone === 'warn' ? 70 : 38;
    var units = [0, 1, 2, 3, 4]
      .map((i) => {
        var y = 5 + i * 12;
        var vents = [0, 1, 2, 3, 4].map((j) => `<line x1="${8 + j * 3}" y1="${7 + i * 12}" x2="${8 + j * 3}" y2="${12 + i * 12}"/>`).join('');
        var hot = i === 2 && !ok;
        return `<rect x="4" y="${y}" width="32" height="9" rx="1.5" fill="${p('#4b5361', '#2c333e')}"/><g stroke="${p('#5d6676', '#3a4250')}" stroke-width=".8">${vents}</g>${led(28, 9.5 + i * 12, hot ? c : good, hot || i === 0 ? 'sh-blink' : '')}${led(32, 9.5 + i * 12, good)}`;
      })
      .join('');
    return `<g transform="translate(62 14)"><rect width="56" height="34" rx="3" fill="${face}" stroke="${edge}"/><path d="M6 26 l8 -6 l7 3 l8 -10 l7 5 l8 -8 l6 3" stroke="#2f80ed" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        <rect x="6" y="28" width="44" height="3" rx="1.5" fill="${p('#e3e8ef', '#2e3a4e')}"/><rect x="6" y="28" width="${(44 * fill) / 100}" height="3" rx="1.5" fill="${c}" class="${blink}"/></g>
      <g transform="translate(138 14)"><rect width="40" height="66" rx="3" fill="${dark}"/>${units}</g>${shPlant(110, 1.2, n)}`;
  }
  if (name === 'containers') {
    var box = (x, y, col, cls = '') =>
      `<g transform="translate(${x} ${y})" class="${cls}"><rect width="42" height="20" rx="1" fill="${col}"/><g stroke="#000" stroke-opacity=".14" stroke-width="1">${[0, 1, 2, 3, 4, 5, 6].map((k) => `<line x1="${4 + k * 4}" y1="2" x2="${4 + k * 4}" y2="18"/>`).join('')}</g><rect x="34" y="2" width="6" height="16" fill="#000" fill-opacity=".1"/></g>`;
    return `<rect x="184" y="6" width="4" height="74" fill="#f5b400"/><rect x="132" y="6" width="56" height="4" fill="#f5b400"/><path d="M136 10 l4 4 M144 10 l4 4 M152 10 l4 4 M160 10 l4 4 M168 10 l4 4 M176 10 l4 4" stroke="#c98d00" stroke-width="1"/>
      <line x1="150" y1="10" x2="150" y2="22" stroke="${ink}" stroke-width=".8"/><path d="M146 22 h8 v3 h-8z" fill="${ink}"/>
      ${box(76, 60, '#2f7fd1')}${box(120, 60, '#3e9b5f')}${box(98, 40, ok ? '#f2b632' : c, blink)}${ok ? '' : `<g transform="translate(110 30)">${badge(0, 0, '!')}</g>`}`;
  }
  if (name === 'database') {
    var cyl = [0, 1, 2]
      .map((i) => {
        var y = 66 - i * 17;
        return `<path d="M108 ${y - 14} v14 a22 6 0 0 0 44 0 v-14" fill="${p('#e8f0fd', '#2a3b5c')}" stroke="#2f80ed" stroke-width="1.2"/><ellipse cx="130" cy="${y - 14}" rx="22" ry="6" fill="${p('#f4f8fe', '#34486e')}" stroke="#2f80ed" stroke-width="1.2"/>`;
      })
      .join('');
    var drawers = [0, 1, 2]
      .map((i) => `<rect x="3" y="${3 + i * 15}" width="28" height="13" rx="1.5" fill="${p('#eef1f5', '#566074')}"/><rect x="13" y="${7 + i * 15}" width="8" height="2.4" rx="1.2" fill="${ink}"/>`)
      .join('');
    return `<g transform="translate(64 32)"><rect width="34" height="48" rx="2" fill="${p('#dfe4ea', '#4a5262')}" stroke="${edge}"/>${drawers}</g>${cyl}${led(146, 60, good)}${led(146, 43, good)}${led(146, 26, c, blink)}${ok ? '' : up(166, 18, c)}${shPlant(186, 1.2, n)}`;
  }
  if (name === 'security') {
    var mark2 = bad ? 'M-2.4 -3 l4.8 4.8 M2.4 -3 l-4.8 4.8' : 'M-3 -.5 l2 2 l4 -4';
    return `${ok ? '' : `<path class="sh-pir" d="M60 24 L40 78 H86Z" fill="${c}"/>`}
      <g transform="translate(70 12)"><rect x="-2" y="0" width="4" height="8" fill="${ink}"/><rect x="-14" y="6" width="24" height="12" rx="6" fill="${face}" stroke="${edge}"/><circle cx="-8" cy="12" r="4" fill="${dark}"/><circle cx="-8" cy="12" r="1.6" fill="#2f80ed"/>${led(5, 12, c, blink)}</g>
      <g transform="translate(116 14)"><rect width="34" height="66" fill="${p('#fff', '#4a5568')}"/><rect x="3" y="3" width="28" height="63" fill="${p('#8a5a3a', '#4a3a30')}"/><rect x="7" y="8" width="20" height="22" rx="1" fill="none" stroke="${p('#a8744f', '#5a4636')}"/><rect x="7" y="36" width="20" height="24" rx="1" fill="none" stroke="${p('#a8744f', '#5a4636')}"/><circle cx="26" cy="35" r="1.6" fill="#d4b26a"/></g>
      <g transform="translate(156 40)"><rect width="10" height="16" rx="2" fill="${face}" stroke="${edge}"/><rect x="2" y="2" width="6" height="4" rx="1" fill="${p('#cfe8f8', '#1b2f52')}"/>${led(5, 12, c, blink)}</g>
      <g transform="translate(184 22)"><path d="M0 -10 l8 3 v5.5 c0 5 -3.5 8.2 -8 10.2 c-4.5 -2 -8 -5.2 -8 -10.2 v-5.5z" fill="${c}"/><path d="${mark2}" stroke="#fff" stroke-width="1.6" stroke-linecap="round" fill="none"/></g>
      <rect x="112" y="78" width="42" height="2" rx="1" fill="${p('#9a8f7c', '#3a3f4c')}"/>`;
  }
  if (name === 'logs') {
    var lines = [[22, '#8fa3c4'], [16, c], [26, '#8fa3c4'], [12, c]]
      .map(([w, col], k) => `<rect x="6" y="${6 + k * 4}" width="${w}" height="2" rx="1" fill="${col}"/>`)
      .join('');
    var paper = [0, 1, 2, 3]
      .map((k) => `<rect x="6" y="${10 + k * 6}" width="14" height="2" rx="1" fill="${edge}"/>${k === 1 || k === 3 ? `<circle cx="22" cy="${11 + k * 6}" r="1.6" fill="${c}"/>` : ''}`)
      .join('');
    return `<rect x="52" y="54" width="96" height="4" rx="1" fill="${wood}"/><rect x="56" y="58" width="4" height="22" fill="${woodd}"/><rect x="140" y="58" width="4" height="22" fill="${woodd}"/>
      <g transform="translate(76 30)"><rect width="40" height="24" rx="2" fill="${dark}"/><rect x="3" y="3" width="34" height="18" rx="1" fill="${p('#1f262f', '#0f131a')}"/>${lines}<rect x="-4" y="24" width="48" height="3" rx="1.5" fill="${p('#9aa3ae', '#55617a')}"/></g>
      <g transform="translate(128 46)"><rect width="9" height="8" rx="1.5" fill="${p('#e8f0fd', '#4a5568')}"/><path d="M9 2 h2 a2 2 0 0 1 0 4 h-2" stroke="${p('#9aa3ae', '#55617a')}" fill="none"/></g>
      <g transform="translate(160 12)"><rect width="28" height="38" rx="2" fill="${wood}"/><rect x="3" y="4" width="22" height="31" fill="${face}"/><rect x="9" y="1" width="10" height="5" rx="1.5" fill="${ink}"/>${paper}</g>
      ${ok ? '' : `<g transform="translate(186 12)">${badge(0, 0, '!')}</g>`}`;
  }
  if (name === 'watchdog') {
    return `${shelf(92, 44, 80)}<g transform="translate(100 34)"><rect width="30" height="10" rx="2" fill="${face}"/><path d="M5 0 l-3 -10 M25 0 l3 -10" stroke="${ink}" stroke-width="1.4" stroke-linecap="round"/>${led(8, 5, good, 'sh-blink')}${led(14, 5, good)}${led(20, 5, good)}</g>
      <g transform="translate(146 30)"><rect width="18" height="14" rx="3" fill="${face}" stroke="${ok ? edge : c}"/>${led(14, 4, c, blink)}${ok ? '' : `<path class="sh-spin" d="M-4 -4 a8 8 0 1 1 -1 8" stroke="${c}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`}</g>
      <g transform="translate(128 58)"><rect width="16" height="16" rx="3" fill="${face}" stroke="${edge}"/><circle cx="5" cy="8" r="1.4" fill="${ink}"/><circle cx="11" cy="8" r="1.4" fill="${ink}"/></g><path d="M132 66 C120 66 120 50 110 44" stroke="${ink}" stroke-width="1.6" fill="none"/>
      <g transform="translate(64 50)"><path d="M0 -14 l10 4 v7 c0 6 -4.4 10 -10 12.4 c-5.6 -2.4 -10 -6.4 -10 -12.4 v-7z" fill="${c}"/><circle cy="-3" r="3.2" fill="#fff"/><circle cy="-3" r="1.5" fill="${p('#1f262f', '#0f131a')}"/></g>${shPlant(186, 1.25, n)}`;
  }
  if (name === 'automations') {
    var eye = ok ? '#7fd1ff' : c;
    return `<path d="M70 0 V22" stroke="${ink}" stroke-width=".8"/><path d="M62 28 Q62 20 70 20 Q78 20 78 28Z" fill="${dark}"/><circle cx="70" cy="30" r="3.4" fill="${ok ? '#ffd27a' : p('#d3cfc6', '#4a4f60')}"/>${ok ? '<circle class="sh-glow" cx="70" cy="32" r="14" fill="#ffd27a" opacity=".3"/>' : ''}
      <g transform="translate(128 80)"><rect x="-12" y="-10" width="6" height="10" rx="2" fill="${ink}"/><rect x="6" y="-10" width="6" height="10" rx="2" fill="${ink}"/><rect x="-16" y="-34" width="32" height="25" rx="5" fill="${face}" stroke="${edge}"/>
        <rect x="-8" y="-28" width="16" height="10" rx="2" fill="${p('#e3e8ef', '#2e3a4e')}"/><circle cx="-3" cy="-23" r="1.6" fill="${c}"/><circle cx="3" cy="-23" r="1.6" fill="${c}"/>
        <rect x="-12" y="-52" width="24" height="17" rx="5" fill="${face}" stroke="${edge}"/><circle cx="-5" cy="-44" r="2.6" fill="${dark}"/><circle cx="5" cy="-44" r="2.6" fill="${dark}"/><circle cx="-5" cy="-44" r="1.2" fill="${eye}"/><circle cx="5" cy="-44" r="1.2" fill="${eye}"/>
        <path d="M0 -52 v-6" stroke="${ink}" stroke-width="1.4"/><circle class="${blink}" cy="-60" r="2.6" fill="${c}"/><path d="M-16 -28 l-8 8 M16 -28 l8 -10" stroke="${edge}" stroke-width="3" stroke-linecap="round"/></g>
      <g transform="translate(176 40)"><rect width="10" height="16" rx="2" fill="${face}" stroke="${edge}"/><rect x="3" y="3" width="4" height="10" rx="1" fill="${p('#e3e8ef', '#2e3a4e')}"/></g>`;
  }
  if (name === 'marketplace') {
    var bx = (x, y, w, h) =>
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1" fill="${p('#c9a06a', '#7a6040')}"/><rect x="${x + w / 2 - 3}" y="${y}" width="6" height="2" fill="${p('#e5c48f', '#9a8058')}"/>`;
    var truck = extra.installing
      ? `<g transform="translate(160 57)"><g class="sh-drive"><rect width="24" height="17" rx="2" fill="#2f80ed"/><path d="M4 6 h10 M4 10 h7" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".8"/><path d="M24 7 h5 l3 4 v6 h-8z" fill="#1f63c7"/><rect x="26" y="8.5" width="3.5" height="3" rx=".6" fill="#cfe8f8"/><circle cx="6" cy="18" r="3" fill="${dark}"/><circle cx="27" cy="18" r="3" fill="${dark}"/></g></g>`
      : bx(158, 62, 26, 18);
    return `<g transform="translate(64 14)"><rect x="0" y="0" width="3" height="66" fill="${woodd}"/><rect x="81" y="0" width="3" height="66" fill="${woodd}"/><rect x="0" y="30" width="84" height="3" fill="${wood}"/><rect x="0" y="63" width="84" height="3" fill="${wood}"/></g>
      ${bx(70, 24, 18, 20)}${bx(90, 30, 14, 14)}${bx(108, 20, 24, 24)}${bx(70, 59, 22, 18)}${bx(96, 53, 20, 24)}${bx(120, 63, 24, 14)}${up(120, 12, '#2f80ed')}${truck}
      ${!ok && extra.count ? `<g transform="translate(128 6)">${badge(0, 0, extra.count > 9 ? '9+' : extra.count)}</g>` : ''}`;
  }
  if (name === 'backups') {
    var bays = [0, 1, 2]
      .map((k) => `<rect x="3" y="${4 + k * 8}" width="18" height="6" rx="1" fill="${p('#4b5361', '#2c333e')}"/>${led(17, 7 + k * 8, good, k === 0 ? 'sh-blink' : '')}`)
      .join('');
    var fail = Boolean(extra.failing);
    var sky = n ? '<circle cx="182" cy="20" r="2.4" fill="#f3eed2"/>' : '<circle cx="183" cy="20" r="3.5" fill="#ffd65a"/>';
    return `<g transform="translate(66 44)"><rect width="24" height="36" rx="2" fill="${dark}"/>${bays}</g>
      <g transform="translate(100 32)"><rect width="50" height="48" rx="3" fill="${p('#5b6470', '#2c333e')}"/><rect x="4" y="4" width="42" height="40" rx="2" fill="${p('#6b7480', '#3a4250')}"/><circle cx="25" cy="24" r="9" fill="${p('#8a939e', '#4a5262')}" stroke="${p('#4a525d', '#20252e')}" stroke-width="2"/>
        <path d="M25 17 v4 M25 27 v4 M18 24 h4 M28 24 h4" stroke="${p('#4a525d', '#20252e')}" stroke-width="1.4"/><rect x="38" y="18" width="3" height="12" rx="1.5" fill="${edge}"/>${led(8, 8, c, blink)}</g>
      <rect x="160" y="12" width="32" height="30" rx="1.5" fill="${p('#cfe8f8', '#1b2f52')}" stroke="${p('#fff', '#4a5568')}" stroke-width="2"/>${sky}${shCloud(176, 30, 0.8, fail ? '#fde2e2' : '#fff')}
      <line x1="176" y1="12" x2="176" y2="42" stroke="${p('#fff', '#4a5568')}" stroke-width="1.4"/>
      ${fail ? `<g transform="translate(186 20)"><circle r="4.5" fill="${SH_TONE_HEX.bad}"/><path d="M-1.8 -1.8 l3.6 3.6 M1.8 -1.8 l-3.6 3.6" stroke="#fff" stroke-width="1.3" stroke-linecap="round"/></g>` : ''}`;
  }
  if (name === 'git_sync') {
    var cm = (x, y, col) => `<circle cx="${x}" cy="${y}" r="3.6" fill="${col || p('#fff', '#3d475c')}" stroke="${col || ink}" stroke-width="1.4"/>`;
    return `<g transform="translate(52 6)"><rect width="118" height="52" rx="2" fill="${p('#fff', '#3d475c')}" stroke="${edge}" stroke-width="2"/><rect x="40" y="52" width="38" height="3" rx="1" fill="${ink}"/></g>
      <g stroke="${ink}" stroke-width="1.8" fill="none"><path d="M62 42 H160"/><path d="M84 42 C94 42 94 24 106 24 H130 C142 24 142 42 150 42"/></g>
      ${cm(68, 42)}${cm(84, 42)}${cm(104, 42)}${cm(126, 42)}${cm(106, 24, '#2f80ed')}<g class="${blink}">${cm(124, 24, c)}</g>${cm(150, 42)}
      <rect x="96" y="56" width="12" height="2.6" rx="1.3" fill="#2f80ed"/><rect x="110" y="56" width="10" height="2.6" rx="1.3" fill="${c}"/>${shPlant(186, 1.3, n)}`;
  }
  if (name === 'silent') {
    var sens = (x, y, col, off) =>
      `<g transform="translate(${x} ${y})"><circle r="7" fill="${face}" stroke="${off ? col : edge}"/>${
        off
          ? `<g class="${blink}"><path d="M-3 -3 l6 6" stroke="${col}" stroke-width="1.4" stroke-linecap="round"/><path d="M-3.4 1 a4 4 0 0 1 6.8 0" stroke="${col}" stroke-width="1.2" fill="none"/></g>`
          : `<circle r="2" fill="${good}"/>`
      }</g>`;
    return `<rect x="104" y="56" width="52" height="3.5" rx="1" fill="${wood}"/><rect x="110" y="59" width="3" height="21" fill="${woodd}"/><rect x="147" y="59" width="3" height="21" fill="${woodd}"/>
      <g transform="translate(116 46)"><rect width="28" height="10" rx="2" fill="${face}"/><path d="M5 0 l-3 -12 M23 0 l3 -12" stroke="${ink}" stroke-width="1.4" stroke-linecap="round"/>${led(9, 5, good, 'sh-blink')}${led(15, 5, good)}</g>
      <g class="sh-fade" stroke="#2f80ed" stroke-width="1.3" fill="none" stroke-linecap="round"><path d="M122 28 a10 10 0 0 1 16 0"/><path d="M117 23 a17 17 0 0 1 26 0"/></g>
      ${sens(72, 30, good, false)}${sens(80, 60, ok ? good : c, !ok)}${sens(178, 24, good, false)}<path d="M86 56 L116 48" stroke="${ok ? edge : c}" stroke-width="1" stroke-dasharray="3 3"/>`;
  }
  if (name === 'batteries') {
    var bat = (x, lv, col, cls = '') =>
      `<g transform="translate(${x} 52)"><rect x="-6" y="-24" width="12" height="24" rx="2" fill="${face}" stroke="${ink}" stroke-width="1.4"/><rect x="-2.5" y="-26.5" width="5" height="2.5" fill="${ink}"/><rect class="${cls}" x="-4" y="${-2 - lv}" width="8" height="${lv}" rx="1" fill="${col}"/></g>`;
    var level = bad ? 3 : tone === 'warn' ? 5 : 18;
    return `${shelf(64, 52, 116)}${bat(78, 17, good)}${bat(98, 12, good)}<g transform="translate(120 52) scale(1.25) translate(-120 -52)">${bat(120, level, ok ? good : c, blink)}</g>${bat(144, 14, good)}${bat(164, 9, good)}
      <g transform="translate(108 64)"><rect width="22" height="14" rx="3" fill="${face}" stroke="${edge}"/><path d="M12 3 l-4 5 h3 l-1 4 l4 -5 h-3z" fill="#f5b400"/></g><path d="M130 72 C150 72 150 80 170 80" stroke="${ink}" stroke-width="1.4" fill="none"/>`;
  }
  if (name === 'orphans') {
    return `<ellipse cx="96" cy="78" rx="12" ry="2" fill="#000" opacity=".08"/>
      <g class="sh-float"><g transform="translate(96 40)"><path d="M-14 16 V-4 a14 14 0 0 1 28 0 V16 l-4.7 -4 l-4.7 4 l-4.6 -4 l-4.7 4 l-4.6 -4z" fill="${p('#fff', '#e8ecf2')}" stroke="${ok ? edge : c}" stroke-width="1.2"/><circle cx="-5" cy="-3" r="2.2" fill="${dark}"/><circle cx="5" cy="-3" r="2.2" fill="${dark}"/><ellipse cy="5" rx="3" ry="2" fill="${dark}"/></g></g>
      <g transform="translate(136 80)"><path d="M-11 0 l-2 -18 h26 l-2 18z" fill="#3b8fd6"/><rect x="-14" y="-20" width="28" height="3" rx="1" fill="#2f78bd"/><path d="M-10 -20 q10 -12 20 0" stroke="${ink}" stroke-width="1.2" fill="none"/></g>
      <path d="M156 14 L174 66" stroke="${wood}" stroke-width="3" stroke-linecap="round"/><path d="M166 64 l18 -6 l6 20 h-18z" fill="#e1b44c"/><path d="M172 66 l4 12 M178 64 l4 13 M184 62 l3 14" stroke="#c99a2e" stroke-width="1"/>
      <g fill="${p('#b4b2a9', '#8a8f9a')}" opacity=".6"><circle class="sh-dust" cx="70" cy="70" r="2"/><circle class="sh-dust" cx="62" cy="74" r="1.4"/><circle class="sh-dust" cx="120" cy="56" r="1.2"/></g>`;
  }
  // settings
  var holes = [];
  for (var i = 0; i < 13; i++) for (var j = 0; j < 6; j++) holes.push(`<circle cx="${6 + i * 8}" cy="${6 + j * 8}" r=".9"/>`);
  var sw = (x, on) =>
    `<g transform="translate(${x} 46)"><rect x="-7" y="-3.5" width="14" height="7" rx="3.5" fill="${on ? '#2f80ed' : edge}"/><circle cx="${on ? 3.5 : -3.5}" r="2.6" fill="#fff"/></g>`;
  return `<g transform="translate(60 8)"><rect width="104" height="50" rx="2" fill="${p('#d6c3a3', '#5a4c3a')}"/><g fill="${p('#b49e7c', '#463b2e')}">${holes.join('')}</g></g>
    <g transform="translate(90 33)"><g class="sh-rot"><path transform="translate(-14 -14) scale(1.17)" d="${SH_COG}" fill="${ink}"/></g></g>
    <g transform="translate(110 22)"><g class="sh-rot-rev"><path transform="translate(-8 -8) scale(.67)" d="${SH_COG}" fill="#2f80ed"/></g></g>
    <path d="M128 14 l14 30" stroke="${p('#8a939e', '#9aa3ae')}" stroke-width="3.4" stroke-linecap="round"/><circle cx="127" cy="13" r="5" fill="none" stroke="${p('#8a939e', '#9aa3ae')}" stroke-width="2.6"/>${sw(132, true)}${sw(148, false)}
    <rect x="56" y="62" width="112" height="4" rx="1" fill="${wood}"/><rect x="60" y="66" width="4" height="14" fill="${woodd}"/><rect x="160" y="66" width="4" height="14" fill="${woodd}"/>${shPlant(186, 1.2, n)}`;
}

var SH_BANNER_STYLE = `
    .shtop { padding:0; overflow:hidden; }
    .shbanner { position:relative; height:90px; overflow:hidden; color:#1d2733; background:var(--sh-wall); --sh-sub:#4a5a6c; container-type:inline-size; }
    .shbanner.night { color:#fff; --sh-sub:rgba(255,255,255,.78); }
    .shscene { position:absolute; right:62px; bottom:10px; height:80px; width:min(360px, 44%); }
    .shground { position:absolute; left:0; right:0; bottom:0; height:10px; }
    .g-parquet { background:repeating-linear-gradient(90deg, #c99a6b 0 38px, #b98a5c 38px 40px); box-shadow:inset 0 2px 0 #a97c50; }
    .night .g-parquet { background:repeating-linear-gradient(90deg, #4a3a2c 0 38px, #3e3024 38px 40px); box-shadow:inset 0 2px 0 #5c4836; }
    .g-tiles { background:repeating-linear-gradient(90deg, #d9dfe3 0 18px, #c6cdd2 18px 19px); box-shadow:inset 0 2px 0 #b8c0c6; }
    .night .g-tiles { background:repeating-linear-gradient(90deg, #3a4250 0 18px, #2e3542 18px 19px); box-shadow:inset 0 2px 0 #4a5262; }
    .g-concrete { background:#9aa1a9; box-shadow:inset 0 2px 0 #b5bbc2; }
    .night .g-concrete { background:#2c323b; box-shadow:inset 0 2px 0 #3a414c; }
    .shhead { position:absolute; z-index:1; left:0; top:0; bottom:10px; right:calc(min(360px, 44%) + 66px); padding:6px 12px; box-sizing:border-box;
              display:flex; align-items:center; gap:10px; min-width:0; }
    .shbadge { width:40px; height:40px; flex:none; border-radius:50%; display:grid; place-items:center; --mdc-icon-size:24px; color:var(--tone);
               background:rgba(255,255,255,.62); box-shadow:inset 0 0 0 1px color-mix(in srgb, var(--tone) 24%, transparent); }
    .night .shbadge { background:rgba(255,255,255,.12); color:color-mix(in srgb, var(--tone) 78%, #fff); box-shadow:inset 0 0 0 1px rgba(255,255,255,.14); }
    .shtitles { flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; }
    .shtrow { display:flex; align-items:center; gap:8px; min-width:0; }
    .shtitle { flex:0 1 auto; min-width:0; font-size:16px; font-weight:500; line-height:1.25; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .shpill { flex:none; display:inline-flex; align-items:center; gap:4px; padding:1px 8px; border-radius:12px; font-size:11px; font-weight:500; line-height:16px;
              white-space:nowrap; max-width:60%; overflow:hidden; text-overflow:ellipsis;
              background:color-mix(in srgb, var(--tone) 18%, rgba(255,255,255,.78)); color:color-mix(in srgb, var(--tone) 45%, #0d2a45); }
    .shpill::before { content:""; flex:none; width:7px; height:7px; border-radius:50%; background:var(--tone); }
    .night .shpill { background:color-mix(in srgb, var(--tone) 30%, rgba(8,18,38,.55)); color:color-mix(in srgb, var(--tone) 35%, #fff); }
    .shsub { font-size:13px; line-height:18px; color:var(--sh-sub); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .idle { --tone:#8a96a6; }
    @container (max-width:560px) { .shscene { width:40%; right:34px; } .shhead { right:calc(40% + 34px); } .shtrow { flex-wrap:wrap; row-gap:2px; } .shpill { max-width:100%; } }
    @container (max-width:340px) { .shscene { display:none; } .shhead { right:0; } }
    .shtop .subtabs { gap:4px; padding:0 12px; border-bottom:1px solid var(--divider-color, rgba(127,127,127,.2)); overflow-x:auto; flex-wrap:nowrap; }
    .shtop .subtab { min-height:0; padding:8px 10px; border:0; border-bottom:2px solid transparent; border-radius:6px 6px 0 0; margin-bottom:-1px;
                     background:none; color:var(--secondary-text-color); font-size:13px; font-weight:500; white-space:nowrap; gap:6px; --mdc-icon-size:16px; }
    .shtop .subtab:hover { color:var(--primary-text-color); border-color:transparent; }
    .shtop .subtab.active { color:var(--primary-text-color); background:none; border-bottom-color:var(--primary-color); }
    .shtop .subtab.active ha-icon { color:var(--primary-color); }
    .shtop .subdot { width:6px; height:6px; }
    .shscene .sh-blink { animation:sh-bl 1.2s steps(2) infinite; }
    .shscene .sh-fade { animation:sh-bl 1.6s ease-in-out infinite; }
    .shscene .sh-leaf { transform-box:fill-box; transform-origin:50% 100%; animation:sh-sway 4s ease-in-out infinite; }
    .shscene .sh-up { animation:sh-up 1.4s ease-in-out infinite; }
    .shscene .sh-cloud { animation:sh-drift 4s ease-in-out infinite alternate; }
    .shscene .sh-pir { opacity:.14; animation:sh-pir 2s ease-in-out infinite; }
    .shscene .sh-glow { animation:sh-glow 3s ease-in-out infinite; }
    .shscene .sh-float, .shscene .sh-dust { animation:sh-float 3s ease-in-out infinite; }
    .shscene .sh-drive { animation:sh-drive 2s ease-in-out infinite; }
    .shscene :is(.sh-spin, .sh-rot, .sh-rot-rev, .sh-rot-fast, .sh-ping) { transform-box:fill-box; transform-origin:center; }
    .shscene .sh-spin { animation:sh-spin 1.6s linear infinite; }
    .shscene .sh-rot { animation:sh-spin 9s linear infinite; }
    .shscene .sh-rot-rev { animation:sh-spin 6s linear infinite reverse; }
    .shscene .sh-rot-fast { animation:sh-spin 1.4s linear infinite; }
    .shscene .sh-ping { animation:sh-ping 2s ease-out infinite; }
    @keyframes sh-bl { 50% { opacity:.2; } }
    @keyframes sh-sway { 0%, 100% { transform:rotate(-4deg); } 50% { transform:rotate(4deg); } }
    @keyframes sh-up { 50% { transform:translateY(-2px); } }
    @keyframes sh-drift { to { transform:translateX(4px); } }
    @keyframes sh-pir { 0%, 100% { opacity:.06; } 50% { opacity:.18; } }
    @keyframes sh-glow { 50% { opacity:.06; } }
    @keyframes sh-float { 50% { transform:translateY(-3px); } }
    @keyframes sh-drive { 0%, 100% { transform:translateX(2px); } 50% { transform:translate(-2px, -.5px); } }
    @keyframes sh-ping { from { transform:scale(1); opacity:.9; } to { transform:scale(2.6); opacity:0; } }
    @media (prefers-reduced-motion: reduce) { .shscene * { animation:none !important; } }
    /* The cards' charter, as the mockups: the tab's header card holds what opens it; tiles and rows are filled and
       rounded (tile B: a round icon, tinted unless all is well), an alert's row tinted and outlined; pill buttons;
       uppercase list titles */
    :host { --sh-sec: color-mix(in srgb, var(--primary-text-color) 6%, var(--card-background-color, #fff)); }
    .shtop .shbody { padding:12px 16px 16px; display:flex; flex-direction:column; gap:12px; }
    .tiles { gap:8px; }
    .tile { background:var(--sh-sec); box-shadow:none; border:1px solid transparent; border-radius:12px; min-height:56px; box-sizing:border-box;
            padding:8px 10px 8px 8px; gap:10px; }
    .tile .avatar { width:40px; height:40px; --mdc-icon-size:22px; }
    .tile:not(.warn):not(.bad):not(.info) .avatar { color:var(--primary-text-color); background:color-mix(in srgb, var(--secondary-text-color) 14%, transparent); }
    .tile .who .n b { font-weight:400; }
    .tile:is(.warn, .bad, .info) .who .n b { color:var(--tone-text); }
    ha-card.list { padding:12px 16px 14px; display:flex; flex-direction:column; gap:6px; }
    .list .lhead { padding:0 0 4px; min-height:30px; }
    .lhead .lname { font-size:12px; letter-spacing:.05em; text-transform:uppercase; color:var(--secondary-text-color); }
    .list .item { background:var(--sh-sec); border:1px solid transparent; border-radius:12px; min-height:56px; box-sizing:border-box; padding:8px 10px 8px 8px; gap:10px; }
    .list .item:is(.bad, .warn) { background:color-mix(in srgb, var(--tone) 9%, var(--sh-sec)); border-color:color-mix(in srgb, var(--tone) 22%, transparent); }
    .list .item.link:hover { background:color-mix(in srgb, var(--primary-color) 8%, var(--sh-sec)); }
    .list .item > :is(ha-icon:first-child, input[type='checkbox'] + ha-icon) { width:40px; height:40px; border-radius:50%; display:grid; place-items:center; --mdc-icon-size:22px;
                                        color:var(--tone-text, var(--primary-text-color));
                                        background:color-mix(in srgb, var(--tone, var(--secondary-text-color)) 16%, transparent); }
    .list .item.good > :is(ha-icon:first-child, input[type='checkbox'] + ha-icon) { color:var(--primary-text-color); background:color-mix(in srgb, var(--secondary-text-color) 14%, transparent); }
    .act { min-height:34px; box-sizing:border-box; padding:0 14px; border-radius:18px; }
    .lhead .act { min-height:30px; padding:0 12px; }
    .act.quiet { background:var(--sh-sec); }
    .sttile, .stic { border-radius:12px; }
    .stic { border-radius:50%; }
    /* Status: the counts in the header card, the areas to handle first, then a compact tile per area in four columns */
    .stkpis { grid-template-columns:repeat(5, minmax(0, 1fr)); }
    .stprio .stwhere { flex:none; font-size:12px; }
    .stgroups { display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:16px 12px; align-items:start; }
    .stgroup .stsec { display:flex; align-items:center; gap:8px; margin:0 4px 8px; font-size:14px; letter-spacing:0; text-transform:none; color:var(--primary-text-color); }
    .stgroup .stsec .muted { margin-left:auto; font-size:12px; font-weight:400; }
    .stgdot { width:8px; height:8px; border-radius:50%; flex:none; background:var(--tone); }
    .stgroup .stgrid { grid-template-columns:minmax(0, 1fr); gap:8px; }
    .sttile { flex-direction:row; align-items:center; gap:10px; min-height:56px; padding:8px 10px 8px 8px; border:1px solid transparent; background:var(--sh-sec); }
    .sttile:hover { border-color:transparent; background:color-mix(in srgb, var(--tone) 13%, var(--sh-sec)); }
    .sttile .stic { width:40px; height:40px; }
    .sttile.good .stic { color:var(--primary-text-color); background:color-mix(in srgb, var(--secondary-text-color) 14%, transparent); }
    .sttxt { flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; }
    .sttile .stname { font-size:14px; font-weight:500; line-height:1.25; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .sttile .stval { font-size:12px; line-height:1.25; color:var(--tone-text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .sttile.good .stval { color:var(--secondary-text-color); font-weight:400; }
    .sttile .stdet { font-size:12px; line-height:1.25; -webkit-line-clamp:1; }
    .sttile .stdot { position:absolute; top:8px; right:8px; width:7px; height:7px; box-shadow:none; }
    .sttile.good .stdot { display:none; }
    .shdots { display:inline-flex; gap:4px; margin-left:10px; vertical-align:middle; }
    .shdot { width:7px; height:7px; border-radius:50%; background:var(--tone); }
    /* Updates: kept as tiles, filled and rounded, each group in its card under an uppercase title */
    .mksec { padding:12px 16px 14px; display:flex; flex-direction:column; gap:10px; }
    .mksec > h2.stsec { margin:0; min-height:30px; display:flex; align-items:center; }
    .mksec .mkgrid { gap:8px; }
    .mksec .mkcard, .mksec .mkhead { background:var(--sh-sec); box-shadow:none; border:1px solid transparent; border-radius:12px; }
    .mksec .mkhead { padding:10px 12px; }
    .mksec .mkcard { padding:12px; }
    .mksec .mkcard.link:hover { background:color-mix(in srgb, var(--primary-color) 8%, var(--sh-sec)); }
    div.mklogo:not(.mkproj) { border-radius:50%; }
    .mksec :is(.mkcard, .mkhead) .act.quiet { background:var(--card-background-color, #fff); }
    /* System: the rings as tiles, the charts' titles as the sections' */
    .ring { background:var(--sh-sec); box-shadow:none; border:1px solid transparent; border-radius:12px; }
    .ctitle { font-size:12px; font-weight:500; letter-spacing:.05em; text-transform:uppercase; color:var(--secondary-text-color); }
    /* As the mockups: the page as wide, the rows and tiles denser, the status pills with their dot, two columns */
    main { max-width:1180px; }
    .list .item { min-height:48px; }
    .list .item .who .n { font-size:13.5px; font-weight:500; }
    .list .item .who .s { font-size:12px; }
    .tile .who .n { font-size:13.5px; }
    .tile .who .n b { font-size:20px; }
    .tile .who .s { font-size:12px; }
    .pill { display:inline-flex; align-items:center; gap:4px; padding:1px 8px; line-height:16px; }
    .pill::before { content:""; width:6px; height:6px; border-radius:50%; flex:none; background:var(--tone, var(--secondary-text-color)); }
    .shzooms { position:absolute; z-index:2; top:5px; right:5px; display:flex; gap:5px; }
    .shzoom { appearance:none; border:0; padding:0; cursor:pointer; width:24px; height:24px; border-radius:50%; display:grid; place-items:center;
              --mdc-icon-size:16px; color:#33506b; background:rgba(255,255,255,.55); box-shadow:inset 0 0 0 1px rgba(255,255,255,.7); }
    .shzoom:hover { background:rgba(255,255,255,.75); }
    .night .shzoom { color:#fff; background:rgba(255,255,255,.12); box-shadow:inset 0 0 0 1px rgba(255,255,255,.2); }
    .shcols { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:16px; align-items:start; }
    .shcols > * { min-width:0; margin:0; }
    ha-card.block > h2 { font-size:12px; font-weight:500; letter-spacing:.05em; text-transform:uppercase; color:var(--secondary-text-color); }
    @media (max-width:900px) { .shcols { grid-template-columns:minmax(0, 1fr); } }
    /* Settings, as its mockup: a card per group, two by two, its modules as filled rows */
    ha-card.block.cfg { background:none; box-shadow:none; border:0; padding:0; }
    .cfggrid { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:16px; align-items:start; margin-top:10px; }
    .cfgcard { background:var(--card-background-color, #fff); border:1px solid var(--divider-color, rgba(127,127,127,.15)); border-radius:var(--ha-card-border-radius, 12px);
               padding:12px 16px 14px; display:flex; flex-direction:column; gap:6px; min-width:0; }
    .cfgcard .cfggroup { display:flex; align-items:center; gap:6px; padding:0; min-height:30px; --mdc-icon-size:16px; }
    .cfgcard .cfggroup .icon-btn { --mdc-icon-size:18px; }
    .cfgcard .cfglist { gap:6px; }
    /* Settings → Display: the hint on as many lines as it needs, the choices under the row */
    .cfgcard .cfgrow.cfgdisplay .who .s { white-space:normal; }
    .cfgsegs { align-self:flex-start; margin-left:4px; }
    .cfgcard .cfgrow { border:0; padding:6px 10px 6px 4px; border-radius:12px; background:var(--sh-sec); align-items:center; }
    .cfgcard .cfgrow > ha-icon { width:40px; height:40px; border-radius:50%; display:grid; place-items:center; --mdc-icon-size:22px; flex:none;
                                 color:var(--primary-color); background:color-mix(in srgb, var(--primary-color) 14%, transparent); }
    .cfgcard .cfgrow.off > ha-icon { color:var(--secondary-text-color); background:color-mix(in srgb, var(--secondary-text-color) 14%, transparent); }
    .cfgcard .cfgrow .who .n { font-size:13.5px; font-weight:500; }
    .cfgcard .cfgrow .who .s { font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .cfgcard .cfgrow.open { margin:0; background:color-mix(in srgb, var(--primary-color) 8%, var(--sh-sec)); }
    .cfgcard .cfgbody { padding:8px 4px 12px; }
    .cfgcard:has(.cfgrow.open) { grid-column:1 / -1; }
    @media (max-width:900px) { .cfggrid { grid-template-columns:minmax(0, 1fr); } }
    /* Logs, as its mockup: the integration's name as is beside its round icon, each message in its box */
    .lggroup .lhead > ha-icon { width:40px; height:40px; border-radius:50%; display:grid; place-items:center; --mdc-icon-size:22px; flex:none;
                                color:var(--tone-text); background:color-mix(in srgb, var(--tone) 16%, transparent); }
    .lggroup .lhead .lname { font-family:var(--code-font-family, monospace); font-size:14px; letter-spacing:0; text-transform:none; color:var(--primary-text-color); }
    .lggroup .lgentry { border-top:0; padding:0; gap:6px; }
    .lgtop { display:flex; align-items:center; gap:8px; min-width:0; }
    .lgtop .s { flex:1; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .lggroup .lgmsg { background:var(--sh-sec); border-radius:10px; padding:8px 10px; font-size:12.5px; }
    .who .s.mono { font-size:12px; }
    .item .side.fixed + .pill { margin-left:4px; }
    /* Sub-tabs, as the mockups (the heating card's zones): under the banner with a margin, each icon in its module's
       tone, the one shown underlined in that tone */
    .shtop .subtabs { margin:0 16px; padding:0; }
    .shtop .subtab { --zc:var(--tone-good); padding:8px 10px; }
    .shtop .subtab:has(.subdot.warn) { --zc:var(--tone-warn); }
    .shtop .subtab:has(.subdot.bad) { --zc:var(--tone-bad); }
    .shtop .subtab:has(.subdot.info) { --zc:var(--info-color, #039be5); }
    .shtop .subtab ha-icon, .shtop .subtab.active ha-icon { color:var(--zc); }
    .shtop .subtab.active { border-bottom-color:var(--zc); }
    .shtop .subdot { display:none; }
    /* One look for the controls of every tab, as the mockups: segmented choices on a filled track, the one picked
       raised on the card's background; search fields and lists filled pills; round icon buttons */
    .btabs, .segs { display:inline-flex; gap:4px; padding:3px; border-radius:12px; background:var(--sh-sec); overflow:visible; }
    .btab, .seg { padding:6px 10px; border-radius:9px; font-size:12.5px; font-weight:500; color:var(--secondary-text-color); background:none; }
    .btab.on, .seg.active { background:var(--card-background-color, #fff); color:var(--primary-text-color); box-shadow:0 1px 3px rgba(0, 0, 0, .15); }
    .box { border:0; border-radius:18px; background:var(--sh-sec); min-height:34px; padding:0 4px 0 12px; box-sizing:border-box; --mdc-icon-size:18px; color:var(--secondary-text-color); }
    .box:focus-within { box-shadow:inset 0 0 0 2px var(--primary-color); }
    .box input { font-size:13px; padding:6px 8px; color:var(--primary-text-color); }
    .ofilters select { border:0; border-radius:18px; background:var(--sh-sec); padding:7px 12px; font-size:13px; min-height:34px; }
    .icon-btn { border-radius:50%; }
    .icon-btn:hover:not([disabled]) { background:color-mix(in srgb, var(--secondary-text-color) 16%, transparent); color:var(--primary-text-color); }
    .shtop .shbody .msg { font-size:12px; }
    .bgroup .ghead .gname { font-size:12px; font-weight:500; letter-spacing:.05em; text-transform:uppercase; color:var(--secondary-text-color); }
    .bgroup .ghead { --mdc-icon-size:16px; color:var(--secondary-text-color); min-height:30px; }
    /* The round icons in their tone itself, as the mockups (the text keeps its readable shade) */
    .list .item:is(.bad, .warn, .info) > :is(ha-icon:first-child, input[type='checkbox'] + ha-icon), .tile:is(.bad, .warn, .info) .avatar,
    .sttile:is(.bad, .warn, .info) .stic, .lggroup .lhead > ha-icon { color:var(--tone); }
    /* Settings: its title and how to order the tabs are in the banner */
    ha-card.block.cfg > h2, ha-card.block.cfg > .msg { display:none; }
    ha-card.block.cfg .cfggrid { margin-top:0; }
    /* Database, as its mockup: the checkbox then the bar beside the name, the counts small at the right */
    .tiles { grid-template-columns:repeat(auto-fit, minmax(170px, 1fr)); }
    .list .item.dbrow > ha-icon:first-child { width:auto; height:auto; background:none; --mdc-icon-size:20px; color:var(--secondary-text-color); }
    .dbrow.on > ha-icon:first-child { color:var(--primary-color); }
    :is(.dbrow, .dbtable) .who { display:grid; grid-template-columns:minmax(0, 1fr) minmax(80px, 38%); column-gap:16px; align-items:center; }
    :is(.dbrow, .dbtable) .who > :not(.dbbar) { grid-column:1; }
    :is(.dbrow, .dbtable) .who .dbbar { grid-column:2; grid-row:1 / span 2; margin:0; }
    .dbcount { font-size:12px; color:var(--secondary-text-color); min-width:64px; }
    .dbcount b { font-size:13px; font-weight:500; color:var(--primary-text-color); }
    .dbents { border-left:0; margin-left:28px; display:flex; flex-direction:column; gap:6px; }
    .dbdev { gap:6px; padding-right:0; border-radius:12px; }
    .dbdev.on { background:none; }
    .dbtable { padding-right:10px; }
    .dbtable .who .n { font-family:var(--code-font-family, monospace); font-size:13px; }
    /* System's rings, as its mockup: a compact 64 px ring, the name under it, the last 24 hours as a thin line below */
    .ring { padding:12px 10px 34px; gap:4px; }
    .ring .gauge { width:64px; height:64px; }
    .ring .gauge circle { stroke-width:8; }
    .ring .rv { top:12px; height:64px; }
    .ring .rv b { font-size:16px; }
    .ring .rv span { font-size:10px; margin-top:3px; }
    .ring .rl { font-size:13.5px; }
    .ring .behind { height:30px; }
    .ring .behind polygon { opacity:.08; }
    /* Logs, as its mockup: one row per integration (its name, the first message's count, time and logger, its pills,
       Reload and Ignore), the message in its box under it */
    .lggroup { padding:8px 10px 10px; gap:8px; }
    .lggroup .lgrow { background:none; border:0; padding:0; min-height:48px; }
    .lggroup .lgrow:is(.bad, .warn) { background:none; border:0; }
    .lggroup .lgname { font-family:var(--code-font-family, monospace); font-size:13.5px; }
    .lggroup .lgentry { margin-left:0; }
    .lggroup .lgrow .act { min-height:32px; }
    /* <ha-icon> is an inline element whose icon sits on the line's middle: as a box of its own, it is centred in its
       round badge instead of riding a few pixels high */
    ha-icon { display:inline-flex; align-items:center; justify-content:center; flex:none; line-height:0; }
    @media (max-width:900px) { .stgroups { grid-template-columns:repeat(2, minmax(0, 1fr)); } .stkpis { grid-template-columns:repeat(3, minmax(0, 1fr)); } }
    @media (max-width:600px) { .stgroups { grid-template-columns:minmax(0, 1fr); } .stkpis { grid-template-columns:repeat(2, minmax(0, 1fr)); } .shdots { display:none; } }
`;

var SH_BANNER_METHODS = {
  // The header of the tab shown: the module's status (its Status area) as its pill and subtitle, and the sub-tabs
  // of its group under it. `over` draws another tab's, or another title, pill, subtitle and corner buttons on it (the
  // diff viewer's header is Versioning's)
  _banner(over = {}) {
    if (!this._state?.loaded) return '';
    var tab = over.tab || this._tab;
    var night = Boolean(this._hass?.themes?.darkMode);
    var tone = 'good';
    var pill = '';
    var sub = '';
    var extra = {};
    var statusTitle = '';
    var dots = '';
    if (tab === 'status') {
      var { areas, counts, score, tone: ringTone } = this._stTone();
      var points = counts.bad + counts.warn + counts.info;
      tone = ringTone;
      // As its mockup: the points to check as the title, the critical and to-watch counts as the pill, Home Assistant's
      // version and uptime then one dot per area under it
      statusTitle = points ? this._t(points === 1 ? 'st_point' : 'st_points', { n: points }) : this._t('st_all_good');
      pill = [
        ['bad', 'st_n_bad'],
        ['warn', 'st_n_warn'],
      ]
        .filter(([t]) => counts[t])
        .map(([t, key]) => this._t(key, { n: counts[t] }))
        .join(' · ');
      if (!pill) pill = `${score} / 100`;
      sub = this._stMeta().join(' · ');
      dots = areas.map(([t, [areaTone]]) => `<span class="shdot ${areaTone}" title="${shEsc(this._tabName(t))}"></span>`).join('');
      // The worst tone of each group of modules: the lines of the screen
      var worst = (list) => (list.includes('bad') ? 'bad' : list.includes('warn') ? 'warn' : list.includes('info') ? 'info' : 'good');
      extra = { score, groups: Object.keys(SH_GROUPS).map((g) => worst(areas.filter(([t]) => shGroupOf(t) === g).map(([, a]) => a[0]))) };
    } else if (tab === 'settings') {
      // As its mockup: the modules turned on out of all of them as the pill, how to order them as the subtitle
      tone = 'idle';
      var all = Object.keys(SH_MODULE_ICONS).filter((t) => t !== 'status' && t !== 'settings');
      var on = all.filter((t) => t === 'system' || (this._state.modules || []).includes(t));
      pill = `${on.length} / ${all.length} · ${this._t('modules_tabs')}`;
      sub = this._t('modules_tabs_hint');
    } else {
      var area = this._stArea(tab);
      if (area) [tone, pill, sub] = area;
      if (tab === 'marketplace') {
        var mk = this._state.marketplace || {};
        // Installs running (the tab's Update all, or the Marketplace's): which one of how many as the pill, the
        // delivery truck at the shelves
        var run = this._updRunNow() || (mk.installing_updates || mk.backing_up ? this._mkRunNow(mk) : null);
        if (run) {
          tone = 'info';
          pill = run.backup ? this._t('mk_backing_up') : this._t('mk_installing', { n: run.n, total: run.total, name: run.name || '' });
        }
        extra = { installing: Boolean(run), count: (mk.list || []).length + (this._state.system_updates?.available || []).length };
      }
      if (tab === 'backups') extra = { failing: Boolean(this._bkSummary?.()?.failing?.length) };
    }
    var [day, dark, floor] = SH_WALLS[tab] || SH_WALLS.status;
    var hex = SH_TONE_HEX[tone] || SH_TONE_HEX.good;
    // The Status tab: its wall takes a little of the overall tone
    var wall = night ? dark : day;
    if (tab === 'status' && tone !== 'good') wall = `color-mix(in srgb, ${hex} ${night ? 14 : 9}%, ${wall})`;
    var title = over.title || (tab === 'status' ? statusTitle : this._tabName(tab));
    if (over.pill !== undefined) pill = over.pill;
    if (over.sub !== undefined) sub = over.sub;
    var buttons = over.buttons ?? `<button class="shzoom" data-action="reload" title="${shEsc(this._t('refresh'))}" aria-label="${shEsc(this._t('refresh'))}"><ha-icon icon="mdi:refresh"></ha-icon></button>`;
    var scene = `${shDecor(SH_DECOR[tab] || 'A', night)}<g transform="translate(160 0)">${shScene(tab, tone, night, extra)}</g>`;
    return `<div class="shbanner ${tone}${night ? ' night' : ''}" style="--sh-wall:${wall}">
      <svg class="shscene" viewBox="0 0 360 80" preserveAspectRatio="xMaxYMax slice" aria-hidden="true" focusable="false">${scene}</svg>
      <div class="shground g-${floor}"></div>
      <div class="shzooms">${buttons}</div>
      <div class="shhead"><span class="shbadge" aria-hidden="true"><ha-icon icon="${SH_MODULE_ICONS[tab] || SH_MODULE_ICONS.status}"></ha-icon></span>
        <div class="shtitles"><div class="shtrow"><span class="shtitle">${shEsc(title)}</span>${pill ? `<span class="shpill">${shEsc(pill)}</span>` : ''}</div>
          ${sub || dots ? `<span class="shsub">${shEsc(sub)}${dots ? `<span class="shdots">${dots}</span>` : ''}</span>` : ''}</div></div></div>`;
  },
};
Object.assign(SystemHubPanel.prototype, SH_BANNER_METHODS);
SystemHubPanel.STYLE += SH_BANNER_STYLE;
