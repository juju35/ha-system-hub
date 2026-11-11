// Mock Home Assistant states and entity registry shaped like the System Monitor integration,
// used to render screenshots.
const boot = new Date(Date.now() - (3 * 86400 + 7 * 3600 + 12 * 60) * 1000).toISOString();

// [object id, translation key, state, attributes]
const raw = [
  ["processor_use", "processor_use", "23", { unit_of_measurement: "%" }],
  ["processor_temperature", "processor_temperature", "54.2", { unit_of_measurement: "°C", device_class: "temperature" }],
  ["memory_usage", "memory_use_percent", "38.6", { unit_of_measurement: "%" }],
  ["memory_use", "memory_use", "3091.2", { unit_of_measurement: "MiB", device_class: "data_size" }],
  ["memory_free", "memory_free", "4910.5", { unit_of_measurement: "MiB", device_class: "data_size" }],
  ["swap_use", "swap_use", "112.4", { unit_of_measurement: "MiB", device_class: "data_size" }],
  ["swap_free", "swap_free", "2335.6", { unit_of_measurement: "MiB", device_class: "data_size" }],
  ["load_1m", "load_1m", "0.42", {}],
  ["load_5m", "load_5m", "0.37", {}],
  ["load_15m", "load_15m", "0.31", {}],
  ["last_boot", null, boot, { device_class: "uptime" }],
  ["disk_use", "disk_use", "37.1", { unit_of_measurement: "GiB", device_class: "data_size" }, "/"],
  ["disk_free", "disk_free", "72.6", { unit_of_measurement: "GiB", device_class: "data_size" }, "/"],
  ["disk_use_media", "disk_use", "512.3", { unit_of_measurement: "GiB", device_class: "data_size" }, "/media"],
  ["disk_free_media", "disk_free", "1351.4", { unit_of_measurement: "GiB", device_class: "data_size" }, "/media"],
  ["ipv4_address_enp0s3", "ipv4_address", "192.168.1.162", {}, "enp0s3"],
  ["ipv4_address_hassio", "ipv4_address", "172.30.32.1", {}, "hassio"],
  ["network_in_enp0s3", "network_in", "67911.4", { unit_of_measurement: "MiB", device_class: "data_size" }, "enp0s3"],
  ["network_out_enp0s3", "network_out", "90474.5", { unit_of_measurement: "MiB", device_class: "data_size" }, "enp0s3"],
  ["network_throughput_in_enp0s3", "throughput_network_in", "1.284", { unit_of_measurement: "MB/s", device_class: "data_rate" }, "enp0s3"],
  ["network_throughput_out_enp0s3", "throughput_network_out", "0.236", { unit_of_measurement: "MB/s", device_class: "data_rate" }, "enp0s3"],
  ["network_throughput_in_hassio", "throughput_network_in", "0.012", { unit_of_measurement: "MB/s", device_class: "data_rate" }, "hassio"],
  ["network_throughput_out_hassio", "throughput_network_out", "0.009", { unit_of_measurement: "MB/s", device_class: "data_rate" }, "hassio"],
  ["process_python3", "process", "on", {}, "python3"],
  ["process_mosquitto", "process", "on", {}, "mosquitto"],
  ["process_zigbee2mqtt", "process", "off", {}, "zigbee2mqtt"],
];

const NAMES = {
  processor_use: "Processor use", processor_temperature: "Processor temperature", memory_use_percent: "Memory usage",
  memory_use: "Memory use", memory_free: "Memory free", swap_use: "Swap use", swap_free: "Swap free",
  load_1m: "Load (1m)", load_5m: "Load (5m)", load_15m: "Load (15m)", uptime: "Uptime",
  disk_use: "Disk use", disk_free: "Disk free", ipv4_address: "IPv4 address", network_in: "Network in",
  network_out: "Network out", throughput_network_in: "Network throughput in", throughput_network_out: "Network throughput out",
  process: "Process",
};

export const states = {};
export const entities = {};
export const devices = {};
for (const [obj, key, state, attributes, arg] of raw) {
  const id = `${key === "process" ? "binary_sensor" : "sensor"}.system_monitor_${obj}`;
  const friendly_name = `System Monitor ${NAMES[key || "uptime"]}${arg ? ` ${arg}` : ""}`;
  states[id] = { entity_id: id, state, attributes: { ...attributes, friendly_name } };
  // Like Home Assistant, the "Last boot" sensor has no translation key.
  entities[id] = { entity_id: id, platform: "systemmonitor", ...(key ? { translation_key: key } : {}) };
}
for (const [id, installed] of [
  ["update.home_assistant_core_update", "2026.10.2"],
  ["update.home_assistant_operating_system_update", "16.2"],
]) {
  states[id] = { entity_id: id, state: "off", attributes: { installed_version: installed, latest_version: installed } };
}
export const updateAvailable = {
  "update.home_assistant_core_update": {
    entity_id: "update.home_assistant_core_update",
    state: "on",
    attributes: { installed_version: "2026.10.2", latest_version: "2026.10.3" },
  },
};

// File Size integration watching the Home Assistant database.
devices.filesize_db = { id: "filesize_db", name: "home-assistant_v2.db" };
for (const [id, key, state, attributes] of [
  ["sensor.home_assistant_v2_db_size", "size", "2056.34", { unit_of_measurement: "MB", device_class: "data_size" }],
  ["sensor.home_assistant_v2_db_last_updated", "last_updated", new Date().toISOString(), { device_class: "timestamp" }],
]) {
  states[id] = { entity_id: id, state, attributes };
  entities[id] = { entity_id: id, platform: "filesize", device_id: "filesize_db", translation_key: key };
}

// Home Assistant's backup sensors: the last automatic backup yesterday morning, the next one tonight.
const at = (hours) => new Date(Date.now() + hours * 3600 * 1000).toISOString();
for (const [id, key, state, attributes] of [
  ["sensor.backup_backup_manager_state", "backup_manager_state", "idle", { device_class: "enum" }],
  ["sensor.backup_last_successful_automatic_backup", "last_successful_automatic_backup", at(-27), { device_class: "timestamp" }],
  ["sensor.backup_last_attempted_automatic_backup", "last_attempted_automatic_backup", at(-27.1), { device_class: "timestamp" }],
  ["sensor.backup_next_scheduled_automatic_backup", "next_scheduled_automatic_backup", at(10), { device_class: "timestamp" }],
]) {
  states[id] = { entity_id: id, state, attributes };
  entities[id] = { entity_id: id, platform: "backup", translation_key: key };
}

// Every monitored process running: the processes section stays folded.
const z2m = "binary_sensor.system_monitor_process_zigbee2mqtt";
export const procsRunning = { [z2m]: { ...states[z2m], state: "on" } };
