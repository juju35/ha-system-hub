// ── Battery types ────────────────────────────────────────────────────────────
// The type comes from the card's `battery_types` (set in the editor), else from Battery Notes: the `battery_type` /
// `battery_quantity` attributes of the battery entity, or its "Battery type" sensor on the same device.
// "2× AA", "2x AA" or "AA x2" read as 2 AA batteries.
export const BM_TYPES = ['CR2032', 'CR2450', 'CR2477', 'CR2016', 'CR2025', 'CR1632', 'CR123A', 'CR2', 'AA', 'AAA', '2× AA',
  '2× AAA', '3× AA', '3× AAA', '4× AA', 'LR44', '9V', '18650', 'ER14505', 'rechargeable'];

export function bmParseType(value, quantity) {
  const s = String(value ?? '').trim();
  if (!s || s === 'unknown' || s === 'unavailable') return null;
  const m = /^(\d+)\s*[x×]\s*(.+)$/i.exec(s) || /^(.+?)\s*[x×]\s*(\d+)$/i.exec(s);
  if (m) {
    const [n, type] = /^\d+$/.test(m[1]) ? [m[1], m[2]] : [m[2], m[1]];
    return { type: type.trim(), quantity: Number(n) };
  }
  const q = Number(quantity);
  return { type: s, quantity: Number.isFinite(q) && q > 0 ? q : 1 };
}

// Battery Notes' "Battery type" sensors, by device, built once per entity registry object.
export const bmTypeSensors = new WeakMap();
export function bmTypeSensorOf(registry, deviceId) {
  if (!registry || !deviceId) return undefined;
  let index = bmTypeSensors.get(registry);
  if (!index) {
    index = new Map();
    for (const [id, e] of Object.entries(registry)) {
      if (e?.device_id && id.startsWith('sensor.') && (e.translation_key === 'battery_type' || /_battery_type$/.test(id))) {
        index.set(e.device_id, id);
      }
    }
    bmTypeSensors.set(registry, index);
  }
  return index.get(deviceId);
}

// The detected type of a battery (without the card's own setting), or null.
export function bmDetectedType(hass, b) {
  const a = hass?.states?.[b.entity_id]?.attributes || {};
  if (a.battery_type) return bmParseType(a.battery_type, a.battery_quantity);
  const sensor = hass?.states?.[bmTypeSensorOf(hass?.entities, b.device_id)];
  return sensor ? bmParseType(sensor.state, sensor.attributes?.battery_quantity) : null;
}

// The icon of a room, from the area registry (the battery list names its area): the area's own icon, else a door,
// and a house for the batteries without a room.
export function bmAreaIcon(hass, name) {
  if (!name) return 'mdi:home-outline';
  const area = Object.values(hass?.areas || {}).find((a) => a?.name === name);
  return area?.icon || 'mdi:door-open';
}

// The model of a battery's device ("Hue dimmer switch", "MYGGBETT door/window sensor"), from the device registry.
export const bmModelOf = (hass, b) => String(hass?.devices?.[b.device_id]?.model || '').trim();

// The type of a battery: set for this battery in the card, else set for its model, else detected.
export const bmTypeOf = (hass, config, b) => {
  const set = config?.battery_types?.[b.entity_id] || config?.battery_models?.[bmModelOf(hass, b)];
  return set ? bmParseType(set) : bmDetectedType(hass, b);
};

// A selector that finds a focused control of the full screen again once its markup is written anew: a battery,
// a tab, or a button by its class.
export function bmFocusKey(el) {
  if (!el) return null;
  const quote = (v) => `"${String(v).replace(/["\\]/g, '\\$&')}"`;
  if (el.dataset?.id) return `[data-id=${quote(el.dataset.id)}]`;
  if (el.dataset?.view) return `[data-view=${quote(el.dataset.view)}]`;
  const cls = el.classList?.[0];
  return cls ? `.${cls}` : null;
}

// The integration's sensors, from the entity registry.
export const bmCandidates = (registry) =>
  Object.keys(registry || {}).filter((id) => id.startsWith('sensor.') && registry[id]?.platform === 'system_hub');

// The integration's "Low batteries" sensor: the candidate whose state carries the battery list right now.
export const bmPick = (hass, candidates) => candidates.find((id) => Array.isArray(hass?.states?.[id]?.attributes?.batteries));

// The "Notify now" button of the sensor's device.
export const bmFindButton = (registry, entity) => {
  const device = entity && registry?.[entity]?.device_id;
  return device
    ? Object.keys(registry).find((id) => id.startsWith('button.') && registry[id].device_id === device)
    : undefined;
};

// The parts of the header that hold the status pill (see _fitPill).
export const BM_PILL = { block: '.mt', row: '.title-row', name: '.title', chip: '.pill', sub: '.sub' };
