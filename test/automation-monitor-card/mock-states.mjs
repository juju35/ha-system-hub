// Mock Home Assistant registry and states shaped like the Automation Monitor integration, used to
// render screenshots. The sensor entity ids are in French on purpose: the cards never rely on them.
export const states = {};
export const entities = {};

// The epoch the mock timestamps are relative to: the page clock is frozen to it for the GIF, so the
// relative times it shows ("12 minutes ago") stay right whenever the screenshots are generated.
export const NOW = Date.now();
const minutesAgo = (m) => new Date(NOW - m * 60e3).toISOString();
const state = (entity_id, value, attributes = {}) => (states[entity_id] = { entity_id, state: String(value), attributes });

// Automations, scripts and scenes referenced by the sensors (with their editor id).
const automations = {
  "automation.garden_watering": ["Garden watering", "1712345678901"],
  "automation.shutters_at_sunset": ["Shutters at sunset", "1712345678902"],
  "automation.washing_machine_done": ["Washing machine done notification", "1712345678903"],
  "automation.hallway_light": ["Hallway light", "1712345678904"],
  "automation.morning_heating": ["Morning heating", "1712345678905"],
  "automation.arm_alarm_on_leaving": ["Arm alarm on leaving", "1712345678906"],
};
for (const [id, [name, uid]] of Object.entries(automations)) state(id, "on", { id: uid, friendly_name: name });
for (let i = 1; i <= 18; i++) state(`automation.other_${i}`, "on", { id: `17000000000${i}`, friendly_name: `Automation ${i}` });
state("script.evening_mood", "off", { friendly_name: "Evening mood" });
state("scene.movie_night", "2026-10-19T20:00:00+00:00", { id: "1712345600001", friendly_name: "Movie night" });

const failure = (entity_id, minutes, error_step, error_message, consecutive_failures = 1) => ({
  entity_id,
  name: automations[entity_id][0],
  unique_id: automations[entity_id][1],
  last_error_time: minutesAgo(minutes),
  error_message,
  error_step,
  consecutive_failures,
});

const source = (entity_id) => ({
  entity_id,
  name: states[entity_id].attributes.friendly_name,
  unique_id: states[entity_id].attributes.id || null,
  domain: entity_id.split(".")[0],
});

const linked = (entity_id, name, minutes, referenced_by) => ({
  entity_id,
  name,
  state: "unavailable",
  device_id: null,
  unavailable_since: minutesAgo(minutes),
  referenced_by,
  referenced_by_details: referenced_by.map(source),
});

export const failures = [
  failure("automation.garden_watering", 12, "action/1", "Error calling service: valve.open_valve - Timeout while communicating with the device", 3),
  failure("automation.shutters_at_sunset", 95, "action/0/choose/1/sequence/0", "Template error: float got invalid input 'unavailable' when rendering '{{ states(\"sensor.outdoor_illuminance\") | float < 50 }}'"),
  failure("automation.washing_machine_done", 60 * 26, "action/2", "Action notify.mobile_app_iphone not found"),
];

export const unavailable = [
  linked("light.hallway", "Hallway ceiling light", 45, ["automation.hallway_light", "automation.arm_alarm_on_leaving", "scene.movie_night"]),
  linked("climate.living_room_radiator", "Living room radiator", 60 * 5, ["automation.morning_heating", "script.evening_mood"]),
];

const sensor = (entity_id, translation_key, list, key, icon) => {
  entities[entity_id] = { entity_id, device_id: null, platform: "automation_monitor", translation_key };
  state(entity_id, list.length, { [key]: list, icon });
};
sensor("sensor.automatisations_en_echec", "failed_automations", failures, "automations", "mdi:robot-confused");
sensor("sensor.entites_liees_indisponibles", "linked_entities_unavailable", unavailable, "entities", "mdi:lan-disconnect");

// Everything fine: both sensors at 0.
export const allGood = {
  "sensor.automatisations_en_echec": { state: "0", attributes: { automations: [], icon: "mdi:robot-confused" } },
  "sensor.entites_liees_indisponibles": { state: "0", attributes: { entities: [], icon: "mdi:lan-disconnect" } },
};
