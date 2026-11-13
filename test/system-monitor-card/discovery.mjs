import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { devices, entities, states, updateAvailable } from "./mock-states.mjs";
import { load } from "./load.mjs";

const lib = load();
const hassWith = (overrides = {}) => ({ states: { ...states }, entities, devices, language: "en", ...overrides });

test("discovery is cached per registry, not per states object", () => {
  const hass = hassWith();
  const sm = lib.discover(hass);
  assert.ok(sm.found);
  assert.equal(sm.scalars.processor_use, "sensor.system_monitor_processor_use");
  // A new states object (any state change) with the same registries: same result object.
  const next = { ...hass, states: { ...hass.states, "sensor.other": { state: "1", attributes: {} } } };
  assert.equal(lib.discover(next), sm);
  assert.equal(lib.discoverDatabase(next), lib.discoverDatabase(hass));
  // New entity registry: discovered again.
  const reg = { ...hass, entities: { ...entities } };
  assert.notEqual(lib.discover(reg), sm);
  assert.equal(JSON.stringify(lib.discover(reg)), JSON.stringify(sm));
});

test("an entity of the registry that gets its state later is picked up", () => {
  const id = "sensor.system_monitor_processor_use";
  const without = { ...states };
  delete without[id];
  const reg = { ...entities };
  const first = lib.discover({ states: without, entities: reg, devices });
  assert.equal(first.scalars.processor_use, undefined);
  const later = lib.discover({ states: { ...states }, entities: reg, devices });
  assert.equal(later.scalars.processor_use, id);
});

/** Registry and states of System Monitor sensors: [object id, translation key, name, name given by the user]. */
const argHass = (sensors) => {
  const h = { states: {}, entities: {}, devices: {} };
  for (const [obj, translation_key, name, renamed] of sensors) {
    const id = `${translation_key === "process" ? "binary_sensor" : "sensor"}.system_monitor_${obj}`;
    // A name set in the entity settings is stored in the registry and follows the device name.
    const friendly_name = `System Monitor ${renamed ?? name}`;
    h.states[id] = { entity_id: id, state: "1", attributes: { friendly_name } };
    h.entities[id] = { entity_id: id, platform: "systemmonitor", translation_key, ...(renamed ? { name: renamed } : {}) };
  }
  return h;
};
/** The usual sensors of a mount point / an interface. */
const diskSensors = (slug, mount, rename = {}) =>
  [
    ["disk_use", "disk_use", "Disk use"],
    ["disk_free", "disk_free", "Disk free"],
    ["disk_usage", "disk_use_percent", "Disk usage"],
  ].map(([obj, key, label]) => [slug ? `${obj}_${slug}` : obj, key, `${label} ${mount}`, rename[key]]);
const netSensors = (iface, rename = {}) =>
  [
    ["network_in", "network_in", "Network in"],
    ["network_out", "network_out", "Network out"],
    ["network_throughput_in", "throughput_network_in", "Network throughput in"],
    ["network_throughput_out", "throughput_network_out", "Network throughput out"],
    ["ipv4_address", "ipv4_address", "IPv4 address"],
  ].map(([obj, key, label]) => [`${obj}_${iface.replace(/\W/g, "_").toLowerCase()}`, key, `${label} ${iface}`, rename[key]]);
const sorted = (o) => Object.keys(o).sort();

test("arguments with spaces are kept whole and alike endings do not collide", () => {
  const sm = lib.discover(
    argHass([
      ["disk_use", "disk_use", "Disk use /"],
      ["disk_free", "disk_free", "Disk free /"],
      ["disk_use_passport", "disk_use", "Disk use /mnt/My Passport"],
      ["disk_free_passport", "disk_free", "Disk free /mnt/My Passport"],
      ["disk_use_passport2", "disk_use", "Disk use /backup/My Passport"],
      ["process_a", "process", "Process home assistant"],
      ["process_b", "process", "Process node red"],
    ])
  );
  assert.deepEqual(Object.keys(sm.disks).sort(), ["/", "/backup/My Passport", "/mnt/My Passport"]);
  assert.equal(sm.disks["/mnt/My Passport"].disk_free, "sensor.system_monitor_disk_free_passport");
  assert.deepEqual(Object.keys(sm.procs).sort(), ["home assistant", "node red"]);
});

test("a single mount with spaces is recovered from its sibling sensors", () => {
  const sm = lib.discover(
    argHass([
      ["disk_use", "disk_use", "Disk use /mnt/My Passport"],
      ["disk_free", "disk_free", "Disk free /mnt/My Passport"],
      ["network_in_eth0", "network_in", "Network in eth0"],
      ["network_throughput_in_eth0", "throughput_network_in", "Network throughput in eth0"],
      ["network_throughput_out_eth0", "throughput_network_out", "Network throughput out eth0"],
    ])
  );
  assert.deepEqual(Object.keys(sm.disks), ["/mnt/My Passport"]);
  assert.deepEqual(Object.keys(sm.nets), ["eth0"]);
  assert.equal(sm.nets.eth0.network_in, "sensor.system_monitor_network_in_eth0");
});

test("a renamed sensor does not change the arguments of the others of its key", () => {
  const h = argHass([
    ["disk_free", "disk_free", "Disk free /"],
    ["disk_free_data", "disk_free", "Disk free /data"],
    ["disk_free_boot", "disk_free", "Disk free /boot"],
    ["disk_use", "disk_use", "Disk use /"],
    ["disk_use_data", "disk_use", "Disk use /data"],
    ["disk_use_boot", "disk_use", "Disk use /boot"],
    ["network_throughput_out_eth0", "throughput_network_out", "Network throughput out eth0"],
    ["network_throughput_out_wlan0", "throughput_network_out", "Network throughput out wlan0"],
    ["network_throughput_out_lo", "throughput_network_out", "Network throughput out lo"],
    ["network_throughput_in_eth0", "throughput_network_in", "Network throughput in eth0"],
    ["network_throughput_in_wlan0", "throughput_network_in", "Network throughput in wlan0"],
  ]);
  h.states["sensor.system_monitor_disk_free"].attributes.friendly_name = "Root free";
  h.states["sensor.system_monitor_network_throughput_out_eth0"].attributes.friendly_name = "WAN up";
  const sm = lib.discover(h);
  assert.equal(sm.disks["/data"].disk_free, "sensor.system_monitor_disk_free_data");
  assert.equal(sm.disks["/boot"].disk_free, "sensor.system_monitor_disk_free_boot");
  assert.ok(!Object.keys(sm.disks).some((k) => k.startsWith("System Monitor")));
  assert.equal(sm.nets.wlan0.throughput_network_out, "sensor.system_monitor_network_throughput_out_wlan0");
  assert.ok(!Object.keys(sm.nets).some((k) => k.startsWith("System Monitor")));
  // The renamed sensors themselves stay with their mount point / interface: no "free" disk, no "up" interface.
  assert.deepEqual(sorted(sm.disks), ["/", "/boot", "/data"]);
  assert.equal(sm.disks["/"].disk_free, "sensor.system_monitor_disk_free");
  assert.deepEqual(sorted(sm.nets), ["eth0", "lo", "wlan0"]);
  assert.equal(sm.nets.eth0.throughput_network_out, "sensor.system_monitor_network_throughput_out_eth0");
});

test("a sensor renamed in its entity settings stays with its mount point or interface", () => {
  const sm = lib.discover(
    argHass([
      ...diskSensors("", "/", { disk_free: "Root free" }),
      ...diskSensors("data", "/data"),
      ...netSensors("eth0", { throughput_network_out: "WAN up" }),
      ...netSensors("wlan0"),
    ])
  );
  assert.deepEqual(sorted(sm.disks), ["/", "/data"]);
  assert.equal(sm.disks["/"].disk_free, "sensor.system_monitor_disk_free");
  assert.equal(sm.disks["/data"].disk_free, "sensor.system_monitor_disk_free_data");
  assert.deepEqual(sorted(sm.nets), ["eth0", "wlan0"]);
  assert.equal(sm.nets.eth0.throughput_network_out, "sensor.system_monitor_network_throughput_out_eth0");
  assert.equal(sm.nets.wlan0.throughput_network_out, "sensor.system_monitor_network_throughput_out_wlan0");
});

test("a renamed sensor of the only mount point / interface stays with it", () => {
  const sm = lib.discover(
    argHass([...diskSensors("", "/", { disk_free: "Root free" }), ...netSensors("eth0", { throughput_network_out: "WAN up" })])
  );
  assert.deepEqual(sorted(sm.disks), ["/"]);
  assert.equal(sm.disks["/"].disk_free, "sensor.system_monitor_disk_free");
  assert.deepEqual(sorted(sm.nets), ["eth0"]);
  assert.equal(sm.nets.eth0.throughput_network_out, "sensor.system_monitor_network_throughput_out_eth0");
});

test("every sensor of a kind renamed: the arguments come from the entity ids", () => {
  const all = { disk_use: "Used", disk_free: "Free", disk_use_percent: "Usage" };
  const sm = lib.discover(
    argHass([
      ...diskSensors("", "/", { disk_free: "Root free" }),
      ...diskSensors("data", "/data", { disk_free: "Data free" }),
      ...netSensors("eth0", { throughput_network_out: "WAN up", throughput_network_in: "WAN down" }),
      ...netSensors("wlan0", { throughput_network_out: "WiFi up", throughput_network_in: "WiFi down" }),
    ])
  );
  assert.deepEqual(sorted(sm.disks), ["/", "/data"]);
  assert.equal(sm.disks["/data"].disk_free, "sensor.system_monitor_disk_free_data");
  assert.equal(sm.disks["/"].disk_free, "sensor.system_monitor_disk_free");
  assert.deepEqual(sorted(sm.nets), ["eth0", "wlan0"]);
  assert.equal(sm.nets.eth0.throughput_network_in, "sensor.system_monitor_network_throughput_in_eth0");
  assert.equal(sm.nets.wlan0.throughput_network_out, "sensor.system_monitor_network_throughput_out_wlan0");
  // All the sensors renamed, a single mount point and interface.
  const one = lib.discover(argHass([...diskSensors("", "/", all), ...netSensors("eth0", { throughput_network_out: "Up", throughput_network_in: "Down", network_in: "In", network_out: "Out", ipv4_address: "IP" })]));
  assert.deepEqual(sorted(one.disks), ["/"]);
  assert.equal(one.disks["/"].disk_use_percent, "sensor.system_monitor_disk_usage");
  assert.deepEqual(sorted(one.nets), ["eth0"]);
  assert.equal(one.nets.eth0.ipv4_address, "sensor.system_monitor_ipv4_address_eth0");
});

test("a renamed sensor keeps an argument with spaces or sharing its start with another one", () => {
  const sm = lib.discover(
    argHass([
      ...diskSensors("", "/"),
      ...diskSensors("data", "/data", { disk_free: "Data free" }),
      ...diskSensors("mnt_data", "/mnt/data", { disk_use: "Backup used" }),
      ...diskSensors("mnt_my_passport", "/mnt/My Passport", { disk_free: "Passport free", disk_use: "My Passport" }),
      ...netSensors("eth0", { throughput_network_out: "WAN up" }),
      ...netSensors("eth0.100", { throughput_network_out: "VLAN up" }),
      ...netSensors("veth0", { throughput_network_in: "eth0 in" }),
    ])
  );
  assert.deepEqual(sorted(sm.disks), ["/", "/data", "/mnt/My Passport", "/mnt/data"]);
  assert.equal(sm.disks["/data"].disk_free, "sensor.system_monitor_disk_free_data");
  assert.equal(sm.disks["/mnt/data"].disk_use, "sensor.system_monitor_disk_use_mnt_data");
  assert.equal(sm.disks["/mnt/My Passport"].disk_free, "sensor.system_monitor_disk_free_mnt_my_passport");
  assert.equal(sm.disks["/mnt/My Passport"].disk_use, "sensor.system_monitor_disk_use_mnt_my_passport");
  assert.deepEqual(sorted(sm.nets), ["eth0", "eth0.100", "veth0"]);
  assert.equal(sm.nets.eth0.throughput_network_out, "sensor.system_monitor_network_throughput_out_eth0");
  assert.equal(sm.nets["eth0.100"].throughput_network_out, "sensor.system_monitor_network_throughput_out_eth0_100");
  assert.equal(sm.nets.veth0.throughput_network_in, "sensor.system_monitor_network_throughput_in_veth0");
});

test("any single renamed sensor, or all the sensors of a kind renamed, keep every mount point and interface", () => {
  const setup = (rename) => [
    ...diskSensors("", "/", rename("/")),
    ...diskSensors("data", "/data", rename("/data")),
    ...diskSensors("mnt_data", "/mnt/data", rename("/mnt/data")),
    ...diskSensors("mnt_my_passport", "/mnt/My Passport", rename("/mnt/My Passport")),
    ...netSensors("eth0", rename("eth0")),
    ...netSensors("eth0.100", rename("eth0.100")),
    ...netSensors("veth0", rename("veth0")),
    ...netSensors("wlan0", rename("wlan0")),
  ];
  const expected = (sensors) => {
    const out = { disks: {}, nets: {} };
    for (const [obj, key, name] of sensors) {
      const group = key.startsWith("disk") ? out.disks : out.nets;
      const arg = name.split(" ").slice(key === "disk_use_percent" || key.startsWith("disk") ? 2 : key.startsWith("throughput") ? 3 : 2).join(" ");
      (group[arg] ??= {})[key] = `sensor.system_monitor_${obj}`;
    }
    return out;
  };
  const check = (rename, what) => {
    const sensors = setup(rename);
    const sm = lib.discover(argHass(sensors));
    const want = expected(sensors);
    assert.equal(JSON.stringify({ disks: sm.disks, nets: sm.nets }, Object.keys(sm.disks).sort()), JSON.stringify(want, Object.keys(want.disks).sort()), what);
    for (const [g, all] of [["disks", want.disks], ["nets", want.nets]])
      assert.deepEqual(JSON.parse(JSON.stringify(sm[g])), all, `${what} (${g})`);
  };
  const base = setup(() => ({}));
  for (const [, key, name] of base) {
    const arg = expected([["x", key, name]]);
    const target = Object.keys(arg.disks)[0] ?? Object.keys(arg.nets)[0];
    check((a) => (a === target ? { [key]: "Renamed" } : {}), `${name} renamed`);
  }
  for (const key of new Set(base.map((x) => x[1]))) check(() => ({ [key]: "Renamed" }), `every ${key} renamed`);
  const everything = Object.fromEntries(base.map((x) => [x[1], "Renamed"]));
  check((a) => (a === "/mnt/My Passport" || a === "eth0.100" ? {} : everything), "everything renamed but one mount point and interface");
  // Everything renamed: the slug of the entity ids is all that is left of "/mnt/My Passport" and "eth0.100".
  const sm = lib.discover(argHass(setup(() => everything)));
  assert.deepEqual(sorted(sm.disks), ["/", "/data", "/mnt/data", "/mnt/my/passport"]);
  assert.equal(sm.disks["/mnt/my/passport"].disk_free, "sensor.system_monitor_disk_free_mnt_my_passport");
  for (const d of Object.values(sm.disks)) assert.equal(Object.keys(d).length, 3);
  assert.deepEqual(sorted(sm.nets), ["eth0", "eth0_100", "veth0", "wlan0"]);
  for (const n of Object.values(sm.nets)) assert.equal(Object.keys(n).length, 5);
});

test("a renamed sensor with French entity ids and a renamed device", () => {
  const h = argHass([
    ["disque_libre", "disk_free", "Disque libre /", "Racine libre"],
    ["disque_libre_data", "disk_free", "Disque libre /data"],
    ["disque_utilise", "disk_use", "Disque utilisé /"],
    ["disque_utilise_data", "disk_use", "Disque utilisé /data"],
    ["debit_reseau_sortant_eth0", "throughput_network_out", "Débit réseau sortant eth0", "Montant box"],
    ["debit_reseau_sortant_wlan0", "throughput_network_out", "Débit réseau sortant wlan0"],
    ["debit_reseau_entrant_eth0", "throughput_network_in", "Débit réseau entrant eth0"],
    ["debit_reseau_entrant_wlan0", "throughput_network_in", "Débit réseau entrant wlan0"],
  ]);
  // Device renamed "NAS" with its entity ids.
  const moved = { states: {}, entities: {}, devices: {} };
  for (const [id, st] of Object.entries(h.states)) {
    const to = id.replace("system_monitor_", "nas_");
    moved.states[to] = { ...st, entity_id: to, attributes: { friendly_name: st.attributes.friendly_name.replace("System Monitor", "NAS") } };
    moved.entities[to] = { ...h.entities[id], entity_id: to };
  }
  const sm = lib.discover(moved);
  assert.deepEqual(sorted(sm.disks), ["/", "/data"]);
  assert.equal(sm.disks["/"].disk_free, "sensor.nas_disque_libre");
  assert.deepEqual(sorted(sm.nets), ["eth0", "wlan0"]);
  assert.equal(sm.nets.eth0.throughput_network_out, "sensor.nas_debit_reseau_sortant_eth0");
});

test("without the registry (older Home Assistant), a renamed sensor still stays with its interface", () => {
  const h = argHass([...diskSensors("", "/"), ...diskSensors("data", "/data"), ...netSensors("eth0"), ...netSensors("wlan0")]);
  h.states["sensor.system_monitor_network_throughput_out_eth0"].attributes.friendly_name = "WAN up";
  const sm = lib.discover({ states: h.states });
  assert.deepEqual(sorted(sm.nets), ["eth0", "wlan0"]);
  assert.equal(sm.nets.eth0.throughput_network_out, "sensor.system_monitor_network_throughput_out_eth0");
  assert.deepEqual(sorted(sm.disks), ["/", "/data"]);
});

test("a renamed process does not change the name of the others", () => {
  const sm = lib.discover(
    argHass([
      ["process_python3", "process", "Process python3", "My Python"],
      ["process_home_assistant", "process", "Process home assistant"],
      ["process_node", "process", "Process node"],
    ])
  );
  assert.deepEqual(sorted(sm.procs), ["home assistant", "node", "python3"]);
  assert.equal(sm.procs.python3, "binary_sensor.system_monitor_process_python3");
});

test("a name changed outside the registry (customize) or a changed entity id are handled too", () => {
  const h = argHass([...diskSensors("", "/"), ...diskSensors("data", "/data"), ...netSensors("eth0"), ...netSensors("wlan0")]);
  // friendly_name customized (customize.yaml), so no name in the registry.
  h.states["sensor.system_monitor_network_throughput_out_eth0"].attributes.friendly_name = "WAN up";
  // A new entity id but the original name: the name is right.
  const id = "sensor.system_monitor_disk_free_data";
  const moved = "sensor.data_free_space";
  h.states[moved] = { ...h.states[id], entity_id: moved };
  h.entities[moved] = { ...h.entities[id], entity_id: moved };
  delete h.states[id];
  delete h.entities[id];
  const sm = lib.discover(h);
  assert.deepEqual(sorted(sm.nets), ["eth0", "wlan0"]);
  assert.equal(sm.nets.eth0.throughput_network_out, "sensor.system_monitor_network_throughput_out_eth0");
  assert.deepEqual(sorted(sm.disks), ["/", "/data"]);
  assert.equal(sm.disks["/data"].disk_free, moved);
});

test("a disk sensor alone of its key keeps its mount point instead of falling back to /", () => {
  // The only disk sensor enabled.
  const one = lib.discover(argHass([["disk_usage_config", "disk_use_percent", "Disk usage /config"]]));
  assert.deepEqual(sorted(one.disks), ["/config"]);
  // Next to the free space of "/": two mount points, nothing merged under "/".
  const two = lib.discover(
    argHass([
      ["disk_free", "disk_free", "Disk free /"],
      ["disk_usage_config", "disk_use_percent", "Disk usage /config"],
    ])
  );
  assert.deepEqual(sorted(two.disks), ["/", "/config"]);
  assert.equal(two.disks["/"].disk_free, "sensor.system_monitor_disk_free");
  assert.equal(two.disks["/config"].disk_use_percent, "sensor.system_monitor_disk_usage_config");
  // Translated entity ids.
  const fr = lib.discover(argHass([["utilisation_du_disque_mnt_data", "disk_use_percent", "Utilisation du disque /mnt/data"]]));
  assert.deepEqual(sorted(fr.disks), ["/mnt/data"]);
});

test("arguments starting alike keep their first words", () => {
  const sm = lib.discover(
    argHass([
      ["disk_use_passport", "disk_use", "Disk use /mnt/My Passport"],
      ["disk_use_book", "disk_use", "Disk use /mnt/My Book"],
      ["disk_free_passport", "disk_free", "Disk free /mnt/My Passport"],
      ["disk_free_book", "disk_free", "Disk free /mnt/My Book"],
      ["process_a", "process", "Process Plex Media Server"],
      ["process_b", "process", "Process Plex Tuner Service"],
    ])
  );
  assert.deepEqual(Object.keys(sm.disks).sort(), ["/mnt/My Book", "/mnt/My Passport"]);
  assert.deepEqual(Object.keys(sm.procs).sort(), ["Plex Media Server", "Plex Tuner Service"]);
});

test("the render signature ignores untracked states and catches tracked ones", () => {
  const hass = hassWith();
  const sig = lib.renderSignature(hass);
  const untracked = { ...hass, states: { ...hass.states, "light.kitchen": { state: "on", attributes: {} } } };
  assert.ok(lib.sameSignature(sig, lib.renderSignature(untracked)));
  const id = "sensor.system_monitor_processor_use";
  const tracked = { ...hass, states: { ...hass.states, [id]: { ...hass.states[id], state: "99" } } };
  assert.ok(!lib.sameSignature(sig, lib.renderSignature(tracked)));
  for (const id of ["sensor.home_assistant_v2_db_size", "update.home_assistant_core_update"]) assert.ok(lib.trackedIds(hass).includes(id), id);
  assert.ok(!lib.sameSignature(sig, lib.renderSignature({ ...hass, language: "fr" })));
});

test("set hass renders only when a tracked state changed", () => {
  const card = new lib.SystemMonitorCard();
  let renders = 0;
  card._update = () => renders++;
  const hass = hassWith();
  card.hass = hass;
  assert.equal(renders, 1);
  card.hass = { ...hass, states: { ...hass.states, "light.kitchen": { state: "on", attributes: {} } } };
  assert.equal(renders, 1);
  const id = "sensor.home_assistant_v2_db_size";
  card.hass = { ...hass, states: { ...hass.states, [id]: { ...hass.states[id], state: "2100" } } };
  assert.equal(renders, 2);
});

test("focusSelector finds the same button again from its data attributes", () => {
  assert.equal(lib.focusSelector({ dataset: { action: "hacs-check" } }), '[data-action="hacs-check"]');
  assert.equal(
    lib.focusSelector({ dataset: { action: "hacs-check-ext", target: 'update.a"b' } }),
    '[data-action="hacs-check-ext"][data-target="update.a\\"b"]'
  );
  assert.equal(lib.focusSelector({ dataset: { entity: "sensor.x" } }), null);
  assert.equal(lib.focusSelector(null), null);
});

test("Core and OS update entities are found from their states, with or without a registry entry", () => {
  const sm = lib.discover(hassWith({ entities: { ...entities } }));
  assert.equal(sm.core_update, "update.home_assistant_core_update");
  assert.equal(sm.os_update, "update.home_assistant_operating_system_update");
});

test("fmtBytes divides by 1024 and says so with binary prefixes", () => {
  assert.equal(lib.fmtBytes(512), "512 B");
  assert.equal(lib.fmtBytes(1536), "1.5 KiB");
  assert.equal(lib.fmtBytes(20 * 1024 ** 3), "20 GiB");
  assert.equal(lib.fmtBytes(null), "—");
});

test("fmtBytesPair drops the used unit only when it matches the total's", () => {
  const GiB = 1024 ** 3;
  assert.equal(lib.fmtBytesPair(3.02 * GiB, 7.81 * GiB), "3.02 / 7.81 GiB");
  assert.equal(lib.fmtBytesPair(980 * 1024 ** 2, 62.5 * GiB), "980 MiB / 62.5 GiB");
  assert.equal(lib.fmtBytesPair(12.3 * GiB, 62.5 * GiB, "fr"), "12,3 / 62,5 GiB");
});

test("focusSelector finds an entity row again, but not a plain clickable span", () => {
  const row = { dataset: { entity: "update.parcel_update" }, getAttribute: (n) => (n === "role" ? "button" : null) };
  assert.equal(lib.focusSelector(row), '[role="button"][data-entity="update.parcel_update"]');
  const span = { dataset: { entity: "sensor.x" }, getAttribute: () => null };
  assert.equal(lib.focusSelector(span), null);
});

test("restoring the focus after a re-render does not scroll the page to the card", () => {
  const card = new lib.SystemMonitorCard();
  card._config = {};
  card._hass = hassWith();
  const calls = [];
  const active = { dataset: { entity: "sensor.system_monitor_processor_use" }, getAttribute: (n) => (n === "role" ? "button" : null) };
  card.shadowRoot = {
    activeElement: active,
    innerHTML: "",
    querySelector: () => ({ focus: (opts) => calls.push(opts) }),
  };
  card._render = () => "<ha-card>v1</ha-card>";
  card._update();
  card._render = () => "<ha-card>v2</ha-card>";
  card._update();
  assert.ok(calls.length > 0);
  for (const opts of calls) assert.equal(opts?.preventScroll, true);
});

test("every focus the cards give after a re-render (rows, zoom button) leaves the page where it is", () => {
  const src = readFileSync(new URL("../../custom_components/system_hub/frontend/cards/system-monitor-card.js", import.meta.url), "utf8");
  const calls = [...src.matchAll(/\.focus\(([^)]*)\)/g)];
  assert.ok(calls.length >= 2, `${calls.length} focus() calls`);
  for (const [call, args] of calls) assert.match(args, /^\{ preventScroll: true \}$/, call);
});

// ── Zoom (mini card) ─────────────────────────────────────────────

/** A connected zoomable card with a recording document listener and a shadow root that keeps its HTML. */
const zoomCard = (cls, config = {}) => {
  const listeners = [];
  lib.document.addEventListener = (type, fn, capture) => listeners.push({ type, fn, capture });
  lib.document.removeEventListener = (type, fn) => {
    const i = listeners.findIndex((l) => l.type === type && l.fn === fn);
    if (i >= 0) listeners.splice(i, 1);
  };
  const card = new cls();
  const focused = [];
  card.shadowRoot.querySelector = (sel) => (sel === ".zoom" ? { focus: (opts) => focused.push({ ...opts }) } : null);
  card.setConfig(config);
  card.hass = hassWith();
  card.connectedCallback();
  return { card, listeners, focused };
};
const click = (path, detail = 1) => ({ detail, composedPath: () => path, stopPropagation() {} });
// A tap: the press and the release (iOS sends no click for a tap on something that is not clickable).
const outside = (card, listeners, path = [{ localName: "div" }]) => {
  const ev = click(path);
  for (const type of ["pointerdown", "pointerup"]) for (const l of listeners.filter((x) => x.type === type)) l.fn(ev);
  return card;
};

for (const [name, cls, compactSize, compactPart] of [["mini", lib.SystemMonitorMiniCard, 3, 'class="metric']]) {
  test(`the ${name} card's zoom button shows the full card, then the compact view again`, () => {
    const { card } = zoomCard(cls);
    assert.match(card._html, /class="zoom" data-action="zoom"[^>]*title="Show the full card"/);
    // The zoom button is the header's last element.
    assert.match(card._html, /<button class="zoom"[^>]*>[\s\S]*?<\/button>\s*<\/div>/);
    assert.doesNotMatch(card._html, /class="gauges"/);
    if (compactPart) assert.ok(card._html.includes(compactPart));
    let stopped = false;
    card._zoomClick({ detail: 1, stopPropagation: () => (stopped = true) });
    assert.ok(stopped);
    assert.ok(card._zoomed);
    // Everything the full card shows, with the same config and the collapse button.
    for (const part of ['class="gauges"', 'class="net"', 'class="vol', 'class="stats"'])
      assert.ok(card._html.includes(part), part);
    if (compactPart) assert.ok(!card._html.includes(compactPart));
    assert.match(card._html, /title="Back to the compact view"/);
    assert.equal(card.getCardSize(), 7);
    assert.equal(card.getGridOptions().columns, 12);
    card._zoomClick(click([]));
    assert.ok(!card._zoomed);
    assert.doesNotMatch(card._html, /class="gauges"/);
    assert.equal(card.getCardSize(), compactSize);
    assert.equal(card.getGridOptions().columns, 6);
  });

  test(`the ${name} card's zoom button keeps the keyboard focus, not the mouse one`, () => {
    const { card, focused } = zoomCard(cls);
    card._zoomClick(click([], 1));
    assert.equal(focused.length, 0);
    card._zoomClick(click([], 0));
    assert.deepEqual(focused, [{ preventScroll: true }]);
  });

  test(`a click outside the zoomed ${name} card brings it back, a click inside or in a dialog does not`, () => {
    const { card, listeners } = zoomCard(cls);
    assert.ok(listeners.some((l) => l.type === "click" && l.capture === true));
    card._zoomClick(click([]));
    outside(card, listeners, [{ localName: "button" }, card]);
    assert.ok(card._zoomed, "inside the card");
    for (const localName of ["ha-more-info-dialog", "ha-dialog", "dialog"]) {
      outside(card, listeners, [{ localName: "div" }, { localName }]);
      assert.ok(card._zoomed, localName);
    }
    outside(card, listeners);
    assert.ok(!card._zoomed);
    card.disconnectedCallback();
    assert.equal(listeners.filter((l) => ["click", "pointerdown", "pointerup"].includes(l.type)).length, 0);
  });

  test(`zoom: false removes the ${name} card's zoom button`, () => {
    const { card } = zoomCard(cls, { zoom: false });
    assert.doesNotMatch(card._html, /data-action="zoom"/);
  });
}

/** An editor with a recording ha-form stub, so its schema and its config-changed events can be read. */
const editorFor = (cls, config = {}) => {
  const editor = new cls();
  const form = { listeners: {}, addEventListener: (type, fn) => (form.listeners[type] = fn) };
  const events = [];
  editor.appendChild = () => {};
  editor.dispatchEvent = (ev) => events.push(ev);
  const create = lib.document.createElement;
  lib.document.createElement = (tag) => (tag === "ha-form" ? form : create(tag));
  try {
    editor.setConfig(config);
    editor.hass = hassWith();
  } finally {
    lib.document.createElement = create;
  }
  return { editor, form, events };
};
const toggles = (schema) => schema.flatMap((s) => s.schema || [s]).filter((s) => s.selector?.boolean).map((s) => s.name);

for (const [name, card, editorCls, tag] of [["mini", lib.SystemMonitorMiniCard, lib.SystemMonitorMiniCardEditor, "sh-system-mini-card-editor"]]) {
  test(`the ${name} card's visual editor lists a zoom toggle, on by default and kept out of the YAML`, () => {
    const create = lib.document.createElement;
    lib.document.createElement = (t) => ({ tag: t });
    try {
      assert.equal(card.getConfigElement().tag, tag);
    } finally {
      lib.document.createElement = create;
    }
    const { editor, form, events } = editorFor(editorCls);
    assert.ok(toggles(form.schema).includes("zoom"));
    assert.equal(form.data.zoom, true);
    assert.equal(form.computeLabel({ name: "zoom" }), "Zoom button");
    assert.equal(form.computeHelper({ name: "zoom" }), "Switches the card to the full card and back");
    const change = (value) => form.listeners["value-changed"]({ detail: { value }, stopPropagation() {} });
    change({ ...form.data, zoom: false });
    assert.equal(editor._config.zoom, false);
    change({ ...form.data, zoom: true });
    assert.ok(!("zoom" in editor._config));
    assert.equal(events.length, 2);
  });
}

test("the status pill sits in the header row", () => {
  const hass = hassWith({ states: { ...states, ...updateAvailable } });
  const sm = lib.discover(hass);
  const full = new lib.SystemMonitorCard();
  full._hass = hass;
  full._config = {};
  // On the title's line, right of the title, above the subtitle.
  const head = full._header(sm);
  assert.match(head, /<div class="title-row"><div class="name">[^<]*<\/div><span class="chip clickable warn"[^>]*title="Update 2026.10.3"[^>]*><span class="dot"><\/span><span class="chip-text">Update 2026.10.3<\/span><\/span>/);
  assert.doesNotMatch(head, /class="chips"/);
});

test("the Home Assistant database size comes from the File Size integration", () => {
  const hass = hassWith();
  const id = "sensor.home_assistant_v2_db_size";
  assert.equal(lib.discoverDatabase(hass), id);
  assert.ok(lib.trackedIds(hass).includes(id));
  // Another file watched by File Size: not the database.
  const other = Object.fromEntries(Object.entries(entities).filter(([k]) => !k.startsWith("sensor.home_assistant_v2_db")));
  other["sensor.notes_txt_size"] = { entity_id: "sensor.notes_txt_size", platform: "filesize", translation_key: "size" };
  const states2 = { ...states, "sensor.notes_txt_size": { state: "1", attributes: { unit_of_measurement: "MB", device_class: "data_size" } } };
  assert.equal(lib.discoverDatabase({ states: states2, entities: other, devices }), null);
});
