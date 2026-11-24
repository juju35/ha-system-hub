// ---------------------------------------------------------------------------
// Registry-based resolution
// ---------------------------------------------------------------------------
import { PLATFORM } from "./core.js";

export const KEYS = { failed: "failed_automations", linked: "linked_entities_unavailable" };

/**
 * Find the two sensors of the integration: { failed, linked } entity ids. The entity registry is used
 * first (platform + translation_key); the default entity ids are a fallback.
 */
export const _resolved = new WeakMap();

export const resolve = (hass) => {
  if (!hass.entities) return null;
  // The registry scan is cached on the hass.entities object, which Home Assistant replaces only
  // when the registry changes (not on every state change).
  let registry = _resolved.get(hass.entities);
  if (!registry) {
    registry = {};
    for (const e of Object.values(hass.entities)) {
      if (e.platform !== PLATFORM) continue;
      for (const [k, key] of Object.entries(KEYS)) if (e.translation_key === key && !registry[k]) registry[k] = e.entity_id;
    }
    _resolved.set(hass.entities, registry);
  }
  const found = { ...registry };
  for (const [k, key] of Object.entries(KEYS)) if (!found[k] && hass.states[`sensor.${key}`]) found[k] = `sensor.${key}`;
  return found;
};

export const findSensors = (hass, config) => {
  const found = resolve(hass);
  if (!found) return { error: "no_registry" };
  const failed = config.failed_entity || found.failed;
  const linked = config.linked_entity || found.linked;
  if (!failed && !linked) return { error: "no_integration" };
  return { failed, linked };
};

// Device of an item: the device_id given by the integration, else the entity registry.
export const deviceOf = (hass, item) => item.device_id || hass.entities?.[item.entity_id]?.device_id || null;

export const _excluded = new WeakMap();

/**
 * Devices to ignore, from exclude_devices: device ids (as the visual editor writes them) or device
 * names, so the YAML can stay readable. Returns a Set of device ids.
 */
export const excludedDevices = (hass, config) => {
  // Cached on the hass.devices object (replaced only when the device registry changes), one entry
  // per exclude_devices value, instead of scanning every device on each update. A Map per value, so
  // two cards with different exclusions on the same dashboard do not evict each other's entry.
  if (!hass.devices) return computeExcluded(hass, config);
  const key = JSON.stringify(config.exclude_devices ?? null);
  let byKey = _excluded.get(hass.devices);
  if (!byKey) _excluded.set(hass.devices, (byKey = new Map()));
  if (!byKey.has(key)) byKey.set(key, computeExcluded(hass, config));
  return byKey.get(key);
};

export const computeExcluded = (hass, config) => {
  const wanted = [].concat(config.exclude_devices ?? []).map((v) => String(v).trim()).filter(Boolean);
  if (!wanted.length) return null;
  const ids = new Set(wanted);
  const names = new Set(wanted.map((v) => v.toLowerCase()));
  for (const d of Object.values(hass.devices || {})) {
    const name = (d.name_by_user || d.name || "").toLowerCase();
    if (name && names.has(name)) ids.add(d.id);
  }
  return ids;
};

// Entities to ignore, from exclude_entities: entity ids or patterns with * (any characters) and ? (one
// character), case-insensitive. Returns a predicate on an entity id, or null when nothing is excluded; only
// the one for the last exclude_entities value is cached, so editing the option does not pile up matchers.
export const _entityMatcherCache = { key: undefined, matcher: null };
export const excludedEntities = (config) => {
  const key = JSON.stringify(config.exclude_entities ?? null);
  if (_entityMatcherCache.key !== key) {
    _entityMatcherCache.key = key;
    _entityMatcherCache.matcher = entityMatcher(config.exclude_entities);
  }
  return _entityMatcherCache.matcher;
};

export const entityMatcher = (value) => {
  const wanted = [].concat(value ?? []).map((v) => String(v).trim().toLowerCase()).filter(Boolean);
  if (!wanted.length) return null;
  const ids = new Set(wanted.filter((v) => !/[*?]/.test(v)));
  const globs = wanted
    .filter((v) => /[*?]/.test(v))
    .map((v) => new RegExp(`^${v.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".")}$`));
  return (id) => {
    const s = String(id ?? "").toLowerCase();
    return ids.has(s) || globs.some((re) => re.test(s));
  };
};

// Editor page of an automation, script or scene, when it was created in the UI.
export const editorPath = (hass, entityId, uniqueId) => {
  const [domain, objectId] = String(entityId).split(".");
  const s = hass.states[entityId];
  if (domain === "automation") {
    const id = s?.attributes?.id ?? uniqueId;
    return id ? `/config/automation/edit/${encodeURIComponent(id)}` : null;
  }
  // The script editor is keyed by the script key (its unique_id), which differs from the object_id
  // once the entity_id has been renamed.
  if (domain === "script") {
    const key = uniqueId ?? objectId;
    return key ? `/config/script/edit/${encodeURIComponent(key)}` : null;
  }
  if (domain === "scene") {
    const id = s?.attributes?.id ?? uniqueId;
    return id ? `/config/scene/edit/${encodeURIComponent(id)}` : null;
  }
  return null;
};

// Number of automation entities, computed once per hass.states object (the signature and the
// subtitle both need it).
export const _automationCount = new WeakMap();
export const automationCount = (hass) => {
  let n = _automationCount.get(hass.states);
  if (n === undefined) {
    n = Object.keys(hass.states).filter((id) => id.startsWith("automation.")).length;
    _automationCount.set(hass.states, n);
  }
  return n;
};

export const tracePath = (hass, entityId, uniqueId) => {
  const id = hass.states[entityId]?.attributes?.id ?? uniqueId;
  return id ? `/config/automation/trace/${encodeURIComponent(id)}` : null;
};
