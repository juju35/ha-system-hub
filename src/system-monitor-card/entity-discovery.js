// ---------------------------------------------------------------------------
// Entity discovery
// ---------------------------------------------------------------------------
import { level, num, pct, threshold, toBytes } from "./helpers.js";

// Translation keys of the System Monitor sensors that carry an argument (mount point,
// interface or process name), shown at the end of their name.
export const ARG_KEYS = {
  disk_free: "disk",
  disk_use: "disk",
  disk_use_percent: "disk",
  network_in: "net",
  network_out: "net",
  throughput_network_in: "net",
  throughput_network_out: "net",
  packets_in: "net",
  packets_out: "net",
  ipv4_address: "net",
  ipv6_address: "net",
  process: "proc",
};
export const SCALAR_KEYS = [
  "processor_use",
  "processor_temperature",
  "memory_use_percent",
  "memory_use",
  "memory_free",
  "swap_use_percent",
  "swap_use",
  "swap_free",
  "load_1m",
  "load_5m",
  "load_15m",
  "last_boot",
];
// Alternative translation keys of the same sensors.
export const ALIASES = { uptime: "last_boot" };

// Fallback when the entity registry is not available: English entity ids
// (sensor.system_monitor_<name>), as created on an English install.
export const FALLBACK = [
  ["throughput_network_in", /^network_throughput_in_(.+)$/],
  ["throughput_network_out", /^network_throughput_out_(.+)$/],
  ["network_in", /^network_in_(.+)$/],
  ["network_out", /^network_out_(.+)$/],
  ["packets_in", /^packets_in_(.+)$/],
  ["packets_out", /^packets_out_(.+)$/],
  ["ipv4_address", /^ipv4_address_(.+)$/],
  ["ipv6_address", /^ipv6_address_(.+)$/],
  ["disk_use_percent", /^disk_usage(?:_(.+))?$/],
  ["disk_use", /^disk_use(?:_(.+))?$/],
  ["disk_free", /^disk_free(?:_(.+))?$/],
  ["processor_use", /^processor_use$/],
  ["processor_temperature", /^processor_temperature$/],
  ["memory_use_percent", /^memory_usage$/],
  ["memory_use", /^memory_use$/],
  ["memory_free", /^memory_free$/],
  ["swap_use_percent", /^swap_usage$/],
  ["swap_use", /^swap_use$/],
  ["swap_free", /^swap_free$/],
  ["load_1m", /^load_1m$/],
  ["load_5m", /^load_5m$/],
  ["load_15m", /^load_15m$/],
  ["last_boot", /^(?:last_boot|uptime)$/],
  ["process", /^process_(.+)$/],
];

// Virtual interfaces hidden by default from the network section.
export const VIRTUAL_IF = /^(lo|docker\d*|hassio|veth.*|br-.*|virbr\d*|tun\d*|tap\d*|wg\d*|vlan.*|dummy\d*|tailscale.*)$/;

/**
 * Caches a scan of the entity registry per hass.entities / hass.devices object: Home Assistant
 * replaces them only when a registry changes, whereas hass.states changes with every state.
 * `scan(hass, missing)` adds to `missing` the entities it skipped for lack of a state; the
 * cached result is dropped as soon as one of them gets one. Without the registry (very old
 * Home Assistant), the scan is cached per hass.states as before.
 */
export const registryCache = (scan) => {
  const cache = new WeakMap();
  return (hass) => {
    const key = hass.entities || hass.states;
    const hit = cache.get(key);
    if (hit && hit.devices === hass.devices && (hit.states === hass.states || !hit.missing.some((id) => hass.states[id])))
      return hit.value;
    const missing = [];
    const value = scan(hass, missing);
    cache.set(key, { devices: hass.devices, states: hass.states, missing, value });
    return value;
  };
};

/** Words shared at the start (resp. end) of two lists of words. */
export const commonPrefix = (a, b) => {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n++;
  return n;
};
export const commonSuffix = (a, b) => {
  let n = 0;
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++;
  return n;
};

/** Most frequent of non-zero lengths (the smallest on a tie), or 0 when there is none. */
export const modeOf = (lengths) => {
  const count = new Map();
  for (const n of lengths) if (n > 0) count.set(n, (count.get(n) || 0) + 1);
  let best = 0;
  for (const [n, c] of count) if (!best || c > count.get(best) || (c === count.get(best) && n < best)) best = n;
  return best;
};

/** Home Assistant's slugify, which entity ids are made of: lowercase ASCII words joined by "_". */
export const slugify = (s) =>
  String(s)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
export const objectId = (id) => id.slice(id.indexOf(".") + 1);

// The English entity ids of the sensors with an argument, wherever the device name puts them.
export const ENGLISH_IDS = Object.fromEntries(
  FALLBACK.filter(([key]) => ARG_KEYS[key]).map(([key, re]) => [key, new RegExp(`(?:^|_)${re.source.slice(1)}`)])
);

/**
 * Arguments (mount point, interface, process name) of the System Monitor sensors: entity id → argument.
 * `args` are the sensors with an argument ({key, group, id, tokens: words of the friendly name,
 * renamed: a name given in the entity settings}), `plain` the other ones ({id, tokens, renamed}).
 *
 * 1. The name. A friendly name is "<device> <label> <argument>", and the device name is what it
 *    shares with the sensors of the other groups. A mount point starts at the first word starting
 *    with "/" (it may contain spaces: "/mnt/My Passport"), an interface is the last word (Linux
 *    forbids spaces in them), a process is what follows the one-word label ("Process") or the
 *    label the other processes share. A name renamed in the entity settings is not read, nor one
 *    that does not start with the device name (customized: "WAN up").
 * 2. The entity id. Home Assistant made it from the original name, "<base>_<slug of the argument>"
 *    (the base alone for "/"), and renaming a sensor keeps it. The names whose slug ends their id
 *    give the base of their key and the known arguments of their group, by slug.
 * 3. A name is kept unless its id names another known argument: the base of its key followed by
 *    that slug, or, without a base, an id ending with it. So an entity id changed by the user
 *    does not override a right name.
 * 4. A sensor without a name to read takes the argument of its id, mapped back to the known
 *    argument of that slug (the slug is lossy: "/mnt/My Passport" → "mnt_my_passport", "eth0.100"
 *    → "eth0_100"): the rest after the base of its key; without a base (every sensor of the key
 *    renamed), the English id, else the base that makes the most ids of the key end with a known
 *    argument, else the structure of the ids (the words they do not share with the other ids of
 *    the key, or share at their end with the ids of the other keys), else "/" for a mount point,
 *    the last word for an interface, what follows the device and the label for a process.
 */
export const resolveArgs = (args, plain = []) => {
  const named = [...args, ...plain].filter((e) => !e.renamed);
  for (const e of args) e.words = objectId(e.id).split("_");

  /** The argument read from the name, or null. */
  const fromName = (e) => {
    if (e.renamed) return null;
    const t = e.tokens;
    const others = named.filter((o) => o.id !== e.id && o.group !== e.group);
    const mates = named.filter((o) => o.id !== e.id && o.group === e.group && o.key !== e.key);
    const device = modeOf(others.map((o) => commonPrefix(t, o.tokens)));
    // A name that does not start like the others was customized ("WAN up"): it says nothing.
    if (!device && (others.length || (mates.length && !modeOf(mates.map((o) => commonPrefix(t, o.tokens)))))) return null;
    const start = device ? device + 1 : 1;
    if (e.group === "disk") {
      const i = t.findIndex((w, j) => j >= start && w.startsWith("/"));
      return i < 0 ? null : t.slice(i).join(" ");
    }
    if (e.group === "net") return t.length > start ? t[t.length - 1] : null;
    const procs = named.filter((o) => o.group === "proc" && o.id !== e.id && o.tokens.join(" ") !== t.join(" "));
    let label = modeOf(procs.map((o) => commonPrefix(t, o.tokens)));
    if (device && (!label || device + 1 < label)) label = device + 1;
    return label && label < t.length ? t.slice(label).join(" ") : null;
  };
  for (const e of args) e.name = fromName(e);

  // Base of each key: the one most of its names agree on (the shortest on a tie).
  const votes = {};
  for (const e of args) {
    if (e.name === null) continue;
    const s = slugify(e.name);
    const o = objectId(e.id);
    const base = !s ? o : o.endsWith(`_${s}`) ? o.slice(0, -s.length - 1) : null;
    if (base === null) continue;
    const m = (votes[e.key] ??= new Map());
    m.set(base, (m.get(base) || 0) + 1);
  }
  const bases = {};
  for (const [key, m] of Object.entries(votes)) bases[key] = [...m].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)[0][0];
  /** The slug of the argument after the base of the key in the entity id, or null when it does not start with it. */
  const restOf = (e) => {
    const b = bases[e.key];
    const o = objectId(e.id);
    if (b === undefined) return null;
    const r = o === b ? "" : o.startsWith(`${b}_`) ? o.slice(b.length + 1) : null;
    return r === "" && e.group !== "disk" ? null : r;
  };
  // Known arguments of each group, by slug: the names that their id confirms.
  const known = {};
  for (const e of args) {
    if (e.name === null || restOf(e) !== slugify(e.name)) continue;
    const k = (known[e.group] ??= new Map());
    if (!k.has(slugify(e.name))) k.set(slugify(e.name), e.name);
  }
  const isKnown = (e, r) => !!known[e.group]?.has(r) && (r !== "" || e.group === "disk");

  /** An argument from its slug: the known one, else the end of the sensor's own name of that slug, else the slug itself ("/" and its words for a mount). */
  const fromSlug = (e, r) => {
    const a = known[e.group]?.get(r);
    if (a !== undefined) return a;
    // A name given in the entity settings is not the original one.
    for (let i = e.tokens.length - 1; i >= 0 && !e.renamed; i--) {
      const tail = e.tokens.slice(i).join(" ");
      if (slugify(tail) === r && (e.group !== "disk" || tail.startsWith("/"))) return tail;
    }
    return e.group === "disk" ? `/${r.replace(/_/g, "/")}` : r;
  };

  /** The slug of the argument in an id without the base of its key that only an English id or a known argument tells for sure, or null. */
  const sureSlug = (e) => {
    const m = objectId(e.id).match(ENGLISH_IDS[e.key]);
    if (m) return m[1] ?? "";
    // The base (a start of this id) that makes the most ids of the key end with a known argument; on a tie, the longest argument.
    const ids = args.filter((x) => x.key === e.key);
    let best = null;
    for (let n = 0; n <= e.words.length; n++) {
      const base = e.words.slice(0, n);
      const r = e.words.slice(n).join("_");
      if (!isKnown(e, r)) continue;
      const score = ids.filter((x) => commonPrefix(x.words, base) === n && isKnown(e, x.words.slice(n).join("_"))).length;
      if (!best || score > best.score || (score === best.score && r.length > best.r.length)) best = { score, r };
    }
    return best ? best.r : null;
  };

  /** The slug of the argument read from the structure of the ids, or null. */
  const shapeSlug = (e) => {
    const w = e.words;
    // The words the id does not share with the other ids of its key ("" for "/", the only argument without slug).
    const p = args.filter((x) => x.key === e.key && x.id !== e.id).map((x) => commonPrefix(w, x.words));
    let r1 = null;
    if (p.length && Math.min(...p) > 0) {
      const n = Math.min(...p);
      if (n < w.length || e.group === "disk") r1 = w.slice(n).join("_");
    }
    // The words it shares at its end with the ids of the other keys of its group, the most of them agree on.
    const n2 = modeOf(
      [...new Set(args.filter((x) => x.group === e.group && x.key !== e.key).map((x) => x.key))].map((k) =>
        Math.max(0, ...args.filter((x) => x.key === k).map((x) => commonSuffix(w, x.words)))
      )
    );
    const r2 = n2 && n2 < w.length ? w.slice(-n2).join("_") : null;
    if (r1 === null) return r2;
    return r2 !== null && r2.length > r1.length ? r2 : r1;
  };

  /** The last resort: "/" for a mount, the last word for an interface, what follows the device and the label for a process. */
  const lastSlug = (e) => {
    if (e.group === "disk") return "";
    if (e.group === "net") return e.words[e.words.length - 1];
    const device = modeOf([...args, ...plain].filter((o) => o.group !== "proc").map((o) => commonPrefix(e.words, objectId(o.id).split("_"))));
    return device && device + 1 < e.words.length ? e.words.slice(device + 1).join("_") : e.words[e.words.length - 1];
  };

  const out = new Map();
  for (const e of args) {
    const r = restOf(e);
    let arg;
    if (e.name !== null) {
      // The name, unless its id names another known argument (the name was customized but still reads like one).
      const id = r ?? (bases[e.key] === undefined ? sureSlug(e) : null);
      arg = id !== null && id !== slugify(e.name) && isKnown(e, id) ? fromSlug(e, id) : e.name;
    } else arg = fromSlug(e, r ?? sureSlug(e) ?? shapeSlug(e) ?? lastSlug(e));
    out.set(e.id, arg);
  }
  return out;
};

/** Map the System Monitor entities to a structured object of entity ids. */
export const discovered = registryCache((hass, missing) => {
  const sm = { scalars: {}, disks: {}, nets: {}, procs: {}, found: false };
  const args = []; // Sensors with an argument, resolved once all the names are known.
  const plain = []; // The other ones, whose names tell the device name.
  const add = (key, id) => {
    sm.found = true;
    const group = ARG_KEYS[key];
    const name = hass.states[id]?.attributes?.friendly_name || "";
    // A name given in the entity settings: it no longer says the argument.
    const sensor = { key, group: group || "scalar", id, tokens: name.split(" "), renamed: !!hass.entities?.[id]?.name };
    if (group) args.push(sensor);
    else {
      sm.scalars[key] ??= id;
      plain.push(sensor);
    }
  };

  const registry = hass.entities ? Object.values(hass.entities).filter((e) => e.platform === "systemmonitor") : [];
  if (registry.length) {
    for (const e of registry.sort((a, b) => a.entity_id.localeCompare(b.entity_id))) {
      if (e.hidden) continue;
      if (!hass.states[e.entity_id]) {
        missing.push(e.entity_id);
        continue;
      }
      const key = ALIASES[e.translation_key] || e.translation_key;
      if (ARG_KEYS[key] || SCALAR_KEYS.includes(key)) add(key, e.entity_id);
      // The "Last boot" sensor has no translation key (it is named after its "uptime" device class).
      else if (!e.translation_key && hass.states[e.entity_id].attributes.device_class === "uptime") add("last_boot", e.entity_id);
    }
  } else {
    for (const id of Object.keys(hass.states).sort()) {
      const m = id.match(/^(?:sensor|binary_sensor)\.system_monitor_(.+)$/);
      if (!m) continue;
      for (const [key, re] of FALLBACK) {
        const f = m[1].match(re);
        if (f) {
          add(key, id);
          break;
        }
      }
    }
  }

  const resolved = resolveArgs(args, plain);
  for (const e of args) {
    const a = resolved.get(e.id);
    if (e.group === "proc") sm.procs[a] ??= e.id;
    else ((e.group === "disk" ? sm.disks : sm.nets)[a] ??= {})[e.key] ??= e.id;
  }

  // Home Assistant update entities, for the header (Core / OS versions).
  // From the states as before, and from the registry so that one without a state yet is picked up when it gets one.
  for (const id of new Set([...Object.keys(hass.states), ...Object.keys(hass.entities || {})])) {
    const key = /^update\.home_assistant_core(_|$)/.test(id) ? "core_update" : /^update\.home_assistant_operating_system(_|$)/.test(id) ? "os_update" : null;
    if (!key) continue;
    if (!hass.states[id]) missing.push(id);
    else sm[key] ??= id;
  }

  return sm;
});

// The `entities` option: sensors of the user's choice, for a value System Monitor does not give or gives under
// another name (a disk of another integration, a sensor of their own). Scalars by their key, disks by name
// (a usage % sensor, or { use_percent, use, free }), interfaces by name ({ in, out, ipv4 }). They replace the
// discovered ones of the same key or name, and are added to the others.
export const DISK_KEYS = { use_percent: "disk_use_percent", use: "disk_use", free: "disk_free" };
export const NET_KEYS = { in: "throughput_network_in", out: "throughput_network_out", ipv4: "ipv4_address" };
export const isEntityId = (v) => typeof v === "string" && /^[a-z_]+\.[a-z0-9_]+$/.test(v);

export const withEntities = (sm, entities) => {
  if (!entities || typeof entities !== "object") return sm;
  const out = { ...sm, scalars: { ...sm.scalars }, disks: { ...sm.disks }, nets: { ...sm.nets }, procs: { ...sm.procs } };
  for (const key of SCALAR_KEYS) if (isEntityId(entities[key])) out.scalars[key] = entities[key];
  const group = (value, keys, plain) => {
    if (isEntityId(value)) return { [plain]: value };
    if (!value || typeof value !== "object") return null;
    const ids = Object.fromEntries(Object.entries(keys).filter(([k]) => isEntityId(value[k])).map(([k, key]) => [key, value[k]]));
    return Object.keys(ids).length ? ids : null;
  };
  for (const [name, value] of Object.entries(entities.disks || {})) {
    const ids = group(value, DISK_KEYS, "disk_use_percent");
    if (ids) out.disks[name] = ids;
  }
  for (const [name, value] of Object.entries(entities.interfaces || {})) {
    const ids = group(value, NET_KEYS, "throughput_network_in");
    if (ids) out.nets[name] = ids;
  }
  out.found = sm.found || Object.keys(out.scalars).length > 0 || Object.keys(out.disks).length > 0;
  return out;
};

// The discovery with the card's `entities`, one result per discovery and option (a stable object while neither
// changes, as the discovery itself).
export const withEntitiesCache = new WeakMap();
export const discover = (hass, config) => {
  const sm = discovered(hass);
  const entities = config?.entities;
  if (!entities) return sm;
  const key = JSON.stringify(entities);
  const hit = withEntitiesCache.get(sm);
  if (hit?.key === key) return hit.result;
  const result = withEntities(sm, entities);
  withEntitiesCache.set(sm, { key, result });
  return result;
};

/** Network interfaces to display: the configured one, else the physical ones with a throughput sensor. */
export const interfaces = (sm, config) => {
  const all = Object.keys(sm.nets).filter((i) => sm.nets[i].throughput_network_in || sm.nets[i].throughput_network_out);
  if (config.interface) return all.includes(config.interface) ? [config.interface] : [];
  const physical = all.filter((i) => !VIRTUAL_IF.test(i));
  return physical.length ? physical : all;
};

/** Main IPv4 address: the one of the first displayed interface, else the first physical one. */
export const mainIp = (hass, sm, config) => {
  const order = [...interfaces(sm, config), ...Object.keys(sm.nets).filter((i) => !VIRTUAL_IF.test(i))];
  for (const i of order) {
    const s = hass.states[sm.nets[i]?.ipv4_address];
    if (s?.state && !["unknown", "unavailable"].includes(s.state)) return s;
  }
  return null;
};

/** Used/total bytes and percentage of a mount point. */
export const diskUsage = (hass, d) => {
  const used = toBytes(hass.states[d.disk_use]);
  const free = toBytes(hass.states[d.disk_free]);
  const p = num(hass.states[d.disk_use_percent]) ?? pct(used, free);
  return { used, total: used !== null && free !== null ? used + free : null, pct: p };
};

export const memUsage = (hass, sc, prefix) => {
  const used = toBytes(hass.states[sc[`${prefix}_use`]]);
  const free = toBytes(hass.states[sc[`${prefix}_free`]]);
  const p = num(hass.states[sc[`${prefix}_use_percent`]]) ?? pct(used, free);
  return { used, total: used !== null && free !== null ? used + free : null, pct: p };
};

/** A state that tells nothing: the entity is unavailable (integration failed or unloaded) or not reported yet. */
export const isUnknown = (s) => !s || s.state === "unavailable" || s.state === "unknown";

/**
 * Core / OS update status: the update entity with a pending update, else the first one that is unavailable
 * (Supervisor unreachable, for example), which tells nothing: neither "up to date" nor "running".
 */
export const updateStatus = (core, os) => {
  const pending = [core, os].find((s) => s && s.state === "on");
  return { pending, unknown: !pending && [core, os].find((s) => s && isUnknown(s)) };
};

/** Registry entries of a platform that have a state; the others are listed in `missing`. */
export const platformEntities = (hass, platform, missing) =>
  Object.values(hass.entities || {}).filter((e) => {
    if (e.platform !== platform) return false;
    if (!hass.states[e.entity_id]) missing.push(e.entity_id);
    return !!hass.states[e.entity_id];
  });

/**
 * Size of the Home Assistant database (recorder), from the File Size integration
 * (platform "filesize") watching the "home-assistant_v2.db" file: its size sensor, in MB.
 */
export const discoverDatabase = registryCache((hass, missing) => {
  for (const e of platformEntities(hass, "filesize", missing)) {
    if (!e.entity_id.startsWith("sensor.") || e.hidden) continue;
    const s = hass.states[e.entity_id];
    // The size sensor ("size"), not the one in bytes ("size_bytes") nor the timestamps.
    if (e.translation_key ? e.translation_key !== "size" : s.attributes.device_class !== "data_size" || s.attributes.unit_of_measurement === "B") continue;
    const dev = hass.devices?.[e.device_id];
    const name = `${dev?.name || ""} ${e.entity_id} ${s.attributes.friendly_name || ""}`;
    if (/home.assistant_v2[._]db/i.test(name)) return e.entity_id;
  }
  return null;
});

/**
 * Home Assistant's own backup sensors (platform "backup", Home Assistant 2025.2+): the manager's state and the
 * last successful, last attempted and next scheduled automatic backups, by translation key.
 */
export const BACKUP_KEYS = ["backup_manager_state", "last_successful_automatic_backup", "last_attempted_automatic_backup", "next_scheduled_automatic_backup"];
export const discoverBackup = registryCache((hass, missing) => {
  const found = {};
  for (const e of platformEntities(hass, "backup", missing)) {
    if (e.entity_id.startsWith("sensor.") && BACKUP_KEYS.includes(e.translation_key)) found[e.translation_key] = e.entity_id;
  }
  return found.last_successful_automatic_backup || found.next_scheduled_automatic_backup ? found : null;
});

/** Relative time of a date ("2 days ago", "in 5 hours"), in minutes, hours or days. */
export const fmtRelative = (ms, loc) => {
  const sec = (ms - Date.now()) / 1000;
  const abs = Math.abs(sec);
  const [v, unit] = abs < 3600 ? [sec / 60, "minute"] : abs < 172800 ? [sec / 3600, "hour"] : [sec / 86400, "day"];
  try {
    return new Intl.RelativeTimeFormat(loc, { numeric: "auto" }).format(Math.round(v), unit);
  } catch {
    return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(Math.round(v), unit);
  }
};

export const dateOf = (s) => {
  const ms = isUnknown(s) ? Number.NaN : Date.parse(s.state);
  return Number.isFinite(ms) ? ms : null;
};

/**
 * Where the automatic backups stand: the entity to open, the level ("ok", "warn", "crit") and what to show. A backup
 * older than `backup_warning` days is a warning, older than `backup_critical` days (or never made, or the last attempt
 * failed) is critical; one running is neither.
 */
export const backupStatus = (hass, config, b) => {
  const st = (k) => (b[k] ? hass.states[b[k]] : undefined);
  const last = dateOf(st("last_successful_automatic_backup"));
  const attempt = dateOf(st("last_attempted_automatic_backup"));
  const next = dateOf(st("next_scheduled_automatic_backup"));
  const running = ["create_backup", "receive_backup", "restore_backup"].includes(st("backup_manager_state")?.state);
  // An attempt more than a minute after the last success did not succeed (the success is stamped at its end).
  const failed = !running && attempt !== null && (last === null || attempt - last > 60000);
  const days = last === null ? null : (Date.now() - last) / 86400000;
  const lvl = running ? "ok" : failed || last === null ? "crit" : level(days, threshold(config, "backup_warning"), threshold(config, "backup_critical"));
  return { id: b.last_successful_automatic_backup || b.next_scheduled_automatic_backup, last, next, running, failed, level: lvl };
};

/** Entity ids a card reads its states from: a change of any other state doesn't re-render it. */
export const trackedIds = (hass, config) => {
  const sm = discover(hass, config);
  const ids = [...Object.values(sm.scalars), ...Object.values(sm.procs), sm.core_update, sm.os_update];
  for (const group of [sm.disks, sm.nets]) for (const g of Object.values(group)) ids.push(...Object.values(g));
  ids.push(discoverDatabase(hass), ...Object.values(discoverBackup(hass) || {}));
  return ids;
};

/**
 * What a render depends on besides the card's own state: the tracked states (compared by
 * identity, Home Assistant replaces a state object when it changes), the registries, the user,
 * the language, and the current minute for the uptime and the relative times ("2 minutes ago").
 */
export const renderSignature = (hass, config) => [
  hass.entities,
  !!hass.themes?.darkMode,
  hass.devices,
  hass.user,
  hass.language,
  hass.locale,
  hass.config,
  Math.floor(Date.now() / 60000),
  ...trackedIds(hass, config).map((id) => hass.states[id]),
];

export const sameSignature = (a, b) => !!a && a.length === b.length && a.every((v, i) => v === b[i]);


/** CSS attribute selector matching an attribute value exactly. */
export const attrSel = (name, value) => `[${name}="${String(value).replace(/["\\]/g, "\\$&")}"]`;

/** Selector finding the same clickable element again after a re-render, from its data-* attributes. */
export const focusSelector = (el) => {
  const d = el?.dataset;
  // Buttons, and rows or tiles that open an entity from the keyboard.
  const entityButton = d?.entity && el.getAttribute?.("role") === "button";
  if (!d?.action && !entityButton) return null;
  const sel = ["action", "target", "path", "entity"]
    .filter((k) => d[k] !== undefined)
    .map((k) => attrSel(`data-${k}`, d[k]))
    .join("");
  return d.action ? sel : `[role="button"]${sel}`;
};

export const fireMoreInfo = (node, entityId) => {
  if (!entityId) return;
  node.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId }, bubbles: true, composed: true }));
};

/** `tap_action: none` (or `{ action: none }`, as the visual editor saves it): a click on the card opens no entity. */
export const tapNone = (config) => (config?.tap_action?.action ?? config?.tap_action) === "none";

/**
 * With `tap_action: none`, the elements that only open an entity (gauges, tiles, rows, pills) are no longer buttons:
 * no entity to open, no role, no tab stop, no pointer. The ones that also act (a fold, the zoom) keep their action.
 */
export const inertHtml = (html) =>
  html.replace(/<[a-z][\w-]*\s[^>]*\bdata-entity="[^"]*"[^>]*>/g, (tag) =>
    /\bdata-action="/.test(tag)
      ? tag.replace(/\s*\bdata-entity="[^"]*"/, "")
      : tag
          .replace(/\s*\bdata-entity="[^"]*"/, "")
          .replace(/\s*\brole="button"/, "")
          .replace(/\s*\btabindex="0"/, "")
          .replace(/(\bclass="[^"]*?)\bclickable\b ?/, "$1")
  );
