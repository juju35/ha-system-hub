// Reference table of the mount points, interfaces and process names that discovery must find,
// whatever the language of the entity ids, the device name and the sensors the user renamed.
// Each case lists its sensors with their real argument; the expected result is built from them.

/** Home Assistant's slugify, as entity ids are made. */
export const slugify = (s) =>
  String(s)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const LABELS = {
  en: {
    disk_use: "Disk use",
    disk_free: "Disk free",
    disk_use_percent: "Disk usage",
    network_in: "Network in",
    network_out: "Network out",
    throughput_network_in: "Network throughput in",
    throughput_network_out: "Network throughput out",
    ipv4_address: "IPv4 address",
    process: "Process",
    processor_use: "Processor use",
    memory_use_percent: "Memory usage",
    swap_use_percent: "Swap usage",
  },
  fr: {
    disk_use: "Disque utilisé",
    disk_free: "Disque libre",
    disk_use_percent: "Utilisation du disque",
    network_in: "Réseau entrant",
    network_out: "Réseau sortant",
    throughput_network_in: "Débit réseau entrant",
    throughput_network_out: "Débit réseau sortant",
    ipv4_address: "Adresse IPv4",
    process: "Processus",
    processor_use: "Utilisation du processeur",
    memory_use_percent: "Utilisation de la mémoire",
    swap_use_percent: "Utilisation du swap",
  },
};
export const DISK = ["disk_use", "disk_free", "disk_use_percent"];
export const NET = ["network_in", "network_out", "throughput_network_in", "throughput_network_out", "ipv4_address"];
const SCALARS = ["processor_use", "memory_use_percent", "swap_use_percent"];
const groupOf = (key) => (DISK.includes(key) ? "disks" : NET.includes(key) ? "nets" : "procs");

/**
 * Sensors of a mount point / an interface / a process. Options: `keys` (the enabled ones),
 * `rename` / `custom` ({key: name}: a name given in the entity settings / a friendly_name set by
 * customize), `want` (the expected argument when it differs from the real one).
 */
const sensorsOf = (keys) => (arg, o = {}) =>
  (o.keys ?? keys).map((key) => ({ key, arg, rename: o.rename?.[key], custom: o.custom?.[key], want: o.want }));
export const disk = sensorsOf(DISK);
export const net = sensorsOf(NET);
export const proc = sensorsOf(["process"]);

/** Every sensor renamed in its entity settings. */
export const renamedAll = (sensors) => sensors.map((s, i) => ({ ...s, rename: `Renamed ${i}` }));

/**
 * The hass object of a case and the expected result. Options: `lang` of the names and entity ids,
 * `device` name in the friendly names, `prefix` of the entity ids (the slug of the original device
 * name; it differs from `device` when the device was renamed without its entity ids), `scalars`
 * (add a few sensors without argument, as every install has), `registry` (false: an older Home
 * Assistant without hass.entities), `ids` (entity ids chosen by the user: {index: id} or sensor → id).
 */
export const scenario = (sensors, opts = {}) => {
  const { lang = "en", device = "System Monitor", scalars = true, registry = true, ids = {} } = opts;
  const prefix = opts.prefix ?? slugify(device);
  const labels = LABELS[lang];
  const hass = { states: {}, entities: {}, devices: {} };
  const want = { disks: {}, nets: {}, procs: {} };
  const add = (key, name, id, extra = {}) => {
    hass.states[id] = { entity_id: id, state: "1", attributes: { friendly_name: name } };
    hass.entities[id] = { entity_id: id, platform: "systemmonitor", translation_key: key, ...extra };
  };
  sensors.forEach((s, i) => {
    const original = `${labels[s.key]} ${s.arg}`;
    const domain = s.key === "process" ? "binary_sensor" : "sensor";
    const id = (typeof ids === "function" ? ids(s) : ids[i]) ?? `${domain}.${prefix}_${slugify(original)}`;
    const name = s.custom ?? `${device} ${s.rename ?? original}`;
    add(s.key, name, id, s.rename ? { name: s.rename } : {});
    const g = groupOf(s.key);
    const arg = s.want ?? s.arg;
    if (g === "procs") want.procs[arg] ??= id;
    else (want[g][arg] ??= {})[s.key] ??= id;
  });
  if (scalars) for (const key of SCALARS) add(key, `${device} ${labels[key]}`, `sensor.${prefix}_${slugify(labels[key])}`);
  if (!registry) delete hass.entities;
  return { hass, want };
};

/** What is left of an argument when only its slug is known (every sensor of it renamed). */
export const fromSlugOnly = (group, arg) => {
  const s = slugify(arg);
  return group === "disks" ? `/${s.replace(/_/g, "/")}` : s;
};

const MOUNTS = ["/", "/data", "/mnt/data", "/mnt/My Passport"];
const IFACES = ["eth0", "eth0.100", "veth0", "wlan0"];
const PROCS = ["python3", "home assistant", "Plex Media Server"];
/** A full install: mount points and interfaces sharing their start, names with spaces, processes. */
export const full = () => [...MOUNTS.flatMap((m) => disk(m)), ...IFACES.flatMap((i) => net(i)), ...PROCS.flatMap((p) => proc(p))];

/** [name, sensors, options] */
export const CASES = [];
const add = (name, sensors, opts = {}) => CASES.push([name, sensors, opts]);

for (const lang of ["en", "fr"]) {
  const base = full();
  add(`${lang}: nothing renamed`, base, { lang });
  // One sensor renamed, in its entity settings or by customize, for each sensor in turn.
  // A process has no other sensor to tell its name: once renamed, only its slug is left.
  const lossy = (s) => (s.key === "process" ? { ...s, want: fromSlugOnly("procs", s.arg) } : s);
  base.forEach((s, i) => {
    add(`${lang}: only ${s.key} ${s.arg} renamed`, base.map((x, j) => (j === i ? lossy({ ...x, rename: "Renamed sensor" }) : x)), { lang });
    add(`${lang}: only ${s.key} ${s.arg} customized`, base.map((x, j) => (j === i ? lossy({ ...x, custom: "Custom name" }) : x)), { lang });
  });
  // Every sensor of a key renamed.
  for (const key of new Set(base.map((s) => s.key)))
    add(`${lang}: every ${key} renamed`, base.map((x, i) => (x.key === key ? lossy({ ...x, rename: `Renamed ${i}` }) : x)), { lang });
  // Everything renamed: only the slug of the arguments is left, where it is lossy.
  add(
    `${lang}: everything renamed`,
    renamedAll(base).map((s) => ({ ...s, want: fromSlugOnly(groupOf(s.key), s.arg) })),
    { lang }
  );
  add(
    `${lang}: everything renamed but one mount point and interface`,
    base.map((s, i) => (s.arg === "/mnt/My Passport" || s.arg === "eth0.100" ? s : lossy({ ...s, rename: `Renamed ${i}` }))),
    { lang }
  );
  // A single disk sensor, alone of its key and of its group.
  add(`${lang}: Disk usage /config alone`, disk("/config", { keys: ["disk_use_percent"] }), { lang });
  add(`${lang}: Disk usage /config alone, no other sensor`, disk("/config", { keys: ["disk_use_percent"] }), { lang, scalars: false });
  add(`${lang}: Disk free / and Disk usage /config`, [...disk("/", { keys: ["disk_free"] }), ...disk("/config", { keys: ["disk_use_percent"] })], {
    lang,
  });
  add(`${lang}: Disk usage /mnt/data alone`, disk("/mnt/data", { keys: ["disk_use_percent"] }), { lang });
  add(`${lang}: Disk usage /mnt/My Passport alone`, disk("/mnt/My Passport", { keys: ["disk_use_percent"] }), { lang });
  add(`${lang}: a lone mount point and a full one`, [...disk("/"), ...disk("/config", { keys: ["disk_use_percent"] }), ...net("eth0")], { lang });
  add(`${lang}: one sensor of each mount point, of different keys`, [...disk("/data", { keys: ["disk_free"] }), ...disk("/config", { keys: ["disk_use"] })], {
    lang,
  });
  add(`${lang}: a lone interface`, net("eth0", { keys: ["throughput_network_out"] }), { lang });
  // The arguments "/" and "eth0".
  add(`${lang}: Root free and WAN up, the only mount point and interface`, [...disk("/", { rename: { disk_free: "Root free" } }), ...net("eth0", { rename: { throughput_network_out: "WAN up" } })], { lang });
  add(`${lang}: Root free and WAN up customized, the only mount point and interface`, [...disk("/", { custom: { disk_free: "Root free" } }), ...net("eth0", { custom: { throughput_network_out: "WAN up" } })], { lang });
  add(
    `${lang}: Root free and WAN up next to others`,
    [
      ...disk("/", { rename: { disk_free: "Root free" } }),
      ...disk("/data"),
      ...disk("/boot"),
      ...net("eth0", { rename: { throughput_network_out: "WAN up" } }),
      ...net("wlan0"),
      ...net("lo"),
    ],
    { lang }
  );
  add(`${lang}: every sensor of / and eth0 renamed`, renamedAll([...disk("/"), ...net("eth0")]), { lang });
  add(`${lang}: the only sensor of / and of eth0, renamed`, renamedAll([...disk("/", { keys: ["disk_free"] }), ...net("eth0", { keys: ["throughput_network_out"] })]), {
    lang,
  });
  // Arguments sharing their start.
  add(`${lang}: /mnt/My Passport and /mnt/My Book`, [...disk("/mnt/My Passport"), ...disk("/mnt/My Book")], { lang });
  add(`${lang}: /mnt/a and /mnt/b, everything renamed`, renamedAll([...disk("/mnt/a"), ...disk("/mnt/b")]), { lang });
  add(`${lang}: /data and /mnt/data, everything renamed`, renamedAll([...disk("/data"), ...disk("/mnt/data")]), { lang });
  add(`${lang}: /mnt/data with only a renamed sensor`, [...disk("/data"), ...disk("/mnt/data", { keys: ["disk_free"], rename: { disk_free: "Backup free" } })], {
    lang,
  });
  add(`${lang}: eth0, eth0.100 and veth0, one renamed each`, [
    ...net("eth0", { rename: { throughput_network_out: "WAN up" } }),
    ...net("eth0.100", { rename: { throughput_network_out: "VLAN up" } }),
    ...net("veth0", { rename: { throughput_network_in: "eth0 in" } }),
  ], { lang });
  add(`${lang}: eth0 and eth0.100, everything renamed`, renamedAll([...net("eth0"), ...net("eth0.100", { want: "eth0_100" })]), { lang });
  // Processes.
  add(`${lang}: processes sharing their first word`, [...proc("Plex Media Server"), ...proc("Plex Tuner Service"), ...disk("/")], { lang });
  add(`${lang}: a lone process with spaces`, proc("Plex Media Server"), { lang });
  add(`${lang}: a renamed process`, [...proc("python3", { rename: { process: "My Python" } }), ...proc("home assistant"), ...proc("node")], { lang });
  add(`${lang}: every process renamed`, renamedAll([...proc("python3"), ...proc("home assistant", { want: "home_assistant" }), ...proc("node")]), { lang });
  // Renamed device, with or without its entity ids.
  add(`${lang}: device renamed with its entity ids`, full(), { lang, device: "NAS" });
  add(`${lang}: device renamed without its entity ids`, full(), { lang, device: "NAS", prefix: "system_monitor" });
  add(
    `${lang}: device renamed, Root free and WAN up`,
    [...disk("/", { rename: { disk_free: "Root free" } }), ...disk("/data"), ...net("eth0", { rename: { throughput_network_out: "WAN up" } }), ...net("wlan0")],
    { lang, device: "NAS" }
  );
  add(`${lang}: device renamed without its ids, Disk usage /config alone`, disk("/config", { keys: ["disk_use_percent"] }), {
    lang,
    device: "NAS",
    prefix: "system_monitor",
  });
}

// English entity ids only.
add("en: Disk usage /config renamed, next to Disk free /", [...disk("/", { keys: ["disk_free"] }), ...disk("/config", { keys: ["disk_use_percent"], rename: { disk_use_percent: "Config" } })]);
add("en: changed entity id with the original name, and WAN up customized", [...disk("/"), ...disk("/data"), ...net("eth0", { custom: { throughput_network_out: "WAN up" } }), ...net("wlan0")], {
  ids: { 4: "sensor.data_free_space" },
});

add("en: a customized name keeping the device name", [...disk("/"), ...net("eth0", { custom: { throughput_network_out: "System Monitor WAN up" } }), ...net("wlan0")]);
add("en: interfaces with dashes, one sensor renamed each", [
  ...net("br-1a2b3c", { rename: { network_in: "Bridge in" } }),
  ...net("docker0", { rename: { ipv4_address: "Docker IP" } }),
  ...net("enp0s3", { rename: { throughput_network_in: "LAN down" } }),
]);
// Entity ids kept from the YAML configuration of System Monitor (before 2024.2): no device name, older labels.
const legacy = (s) => `sensor.${s.key === "disk_use_percent" ? "disk_use_percent" : s.key}${slugify(s.arg) ? `_${slugify(s.arg)}` : ""}`;
add("en: entity ids kept from the YAML configuration", full(), { ids: legacy });
add("fr: entity ids kept from the YAML configuration, one sensor of each kind renamed", [
  ...disk("/", { rename: { disk_free: "Racine libre" } }),
  ...disk("/home"),
  ...net("eth0", { rename: { throughput_network_out: "Montant box" } }),
  ...net("wlan0"),
], { lang: "fr", ids: legacy });

// Older Home Assistant without the registry: English entity ids.
const old = { registry: false };
add("no registry: nothing renamed", full(), old);
add("no registry: WAN up and Root free customized", [...disk("/", { custom: { disk_free: "Root free" } }), ...disk("/data"), ...net("eth0", { custom: { throughput_network_out: "WAN up" } }), ...net("wlan0")], old);
add("no registry: WAN up customized, the only sensor", net("eth0", { keys: ["throughput_network_out"], custom: { throughput_network_out: "WAN up" } }), old);
add("no registry: Root free customized, the only sensor", disk("/", { keys: ["disk_free"], custom: { disk_free: "Root free" } }), old);
add("no registry: Disk usage /config alone", disk("/config", { keys: ["disk_use_percent"] }), old);
add("no registry: Disk free / and Disk usage /config", [...disk("/", { keys: ["disk_free"] }), ...disk("/config", { keys: ["disk_use_percent"] })], old);
add("no registry: a lone process with spaces", proc("Plex Media Server"), old);
