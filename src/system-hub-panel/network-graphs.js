// Tone of a percentage: good below 70, warn below 90, bad above
// Silent devices, network views. A Zigbee mesh as ZHA's zha/devices gives it (each device with its neighbour table):
// the nodes (coordinator, routers, end devices) and the links between them; an end device's parent is the router or
// coordinator whose table names it as a child, else its best neighbour among them; a router hangs from the coordinator
import { shNum } from "./core.js";

export function shZhaGraph(list) {
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
export function shZ2mGraph(value, registry) {
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
export function shMatterGraph(registry, diagnostics) {
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
export function shZwaveGraph(networks, registry, stats) {
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
export var SH_NET_RANK = { coordinator: 0, hub: 0, bridge: 1, router: 1, end: 2 };

// A network as a tree: each node's children (by its id), and the nodes without a parent among them
export function shNetTree(nodes) {
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
export function shNetLayout(nodes, size) {
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
export function shNetForce(nodes, links, width, height) {
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
export function shNetBox(pos, pxW, pxH) {
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
export function shLqiTone(lqi) {
  if (lqi === null || lqi === undefined) return '';
  return lqi >= 100 ? 'good' : lqi >= 50 ? 'warn' : 'bad';
}

// Tone of a Z-Wave RSSI (dBm): good from −70, warn from −80, weak below
export function shRssiTone(rssi) {
  if (rssi === null || rssi === undefined) return '';
  return rssi >= -70 ? 'good' : rssi >= -80 ? 'warn' : 'bad';
}

// A node's signal: its LQI (Zigbee) or its RSSI (Z-Wave), its tone and its strength from 0 to 1
export function shSignal(n) {
  if (n?.lqi !== null && n?.lqi !== undefined) return { text: `LQI ${n.lqi}`, tone: shLqiTone(n.lqi), level: Math.min(255, n.lqi) / 255 };
  if (n?.rssi !== null && n?.rssi !== undefined) return { text: `${n.rssi} dBm`, tone: shRssiTone(n.rssi), level: Math.max(0, Math.min(1, (n.rssi + 100) / 60)) };
  return null;
}

export function shTone(pct, warn = 70, bad = 90) {
  if (pct === null || pct === undefined) return '';
  return pct >= bad ? 'bad' : pct >= warn ? 'warn' : 'good';
}

// Sizes in base 1024 (KiB, MiB, GiB), 2/1/0 decimals, as the other ha-* cards
export function shBytes(bytes) {
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
export function shSpark(values) {
  var points = (values || []).filter((v) => v !== null && v !== undefined);
  if (points.length < 2) return '';
  var w = 100;
  var step = w / (points.length - 1);
  var d = points.map((v, i) => `${(i * step).toFixed(1)},${(30 - (Math.min(Math.max(v, 0), 100) * 30) / 100).toFixed(1)}`);
  return `<svg class="spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><polyline points="${d.join(' ')}"/></svg>`;
}
