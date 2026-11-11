"""Orphans module (formerly Orphan Entities): scans, reasons, removal, ignore, used by, orphan devices."""

from __future__ import annotations

import inspect
from datetime import timedelta
from unittest.mock import patch

import pytest
import voluptuous as vol
from freezegun.api import FrozenDateTimeFactory
from homeassistant.config_entries import ConfigEntryState
from homeassistant.const import EVENT_HOMEASSISTANT_STARTED, STATE_UNAVAILABLE, STATE_UNKNOWN
from homeassistant.core import CoreState, HomeAssistant
from homeassistant.data_entry_flow import FlowResultType
from homeassistant.exceptions import ServiceValidationError
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.service import async_register_admin_service
from homeassistant.setup import async_setup_component
from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.common import MockConfigEntry, async_capture_events, async_fire_time_changed

from custom_components.system_hub.const import DOMAIN
from custom_components.system_hub.orphans.const import (
    CONF_GRACE_PERIOD,
    CONF_IGNORED_ENTITIES,
    CONF_IGNORED_INTEGRATIONS,
    CONF_INCLUDE_UNKNOWN,
    CONF_SCAN_INTERVAL,
    CONF_STALE_HOURS,
    EVENT_REMOVED,
    REGISTRY_DEBOUNCE,
)

ORPHANS = "sensor.system_hub_orphans_orphaned_entities"
LAST_SCAN = "sensor.system_hub_orphans_last_scan"
BUTTON = "button.system_hub_orphans_scan_now"
OPTIONS = {
    CONF_SCAN_INTERVAL: 15,
    CONF_GRACE_PERIOD: 10,
    CONF_STALE_HOURS: 24,
    CONF_INCLUDE_UNKNOWN: True,
    CONF_IGNORED_INTEGRATIONS: [],
    CONF_IGNORED_ENTITIES: [],
}
# Admin actions return a response from Home Assistant 2025.1.
RESPONSE = "supports_response" in inspect.signature(async_register_admin_service).parameters
RESTORED = {"restored": True, "supported_features": 0}


def _integration(
    hass: HomeAssistant, domain: str, state: ConfigEntryState = ConfigEntryState.LOADED
) -> MockConfigEntry:
    entry = MockConfigEntry(domain=domain, title=domain.title())
    entry.add_to_hass(hass)
    entry.mock_state(hass, state)
    return entry


def _entity(
    hass: HomeAssistant,
    platform: str,
    key: str,
    value: str | None,
    entry: MockConfigEntry | None = None,
    domain: str = "sensor",
    attributes: dict | None = None,
    **kwargs,
) -> str:
    """A registry entity of `platform`, with the state `value` (None: no state)."""
    entity = er.async_get(hass).async_get_or_create(
        domain, platform, key, config_entry=entry, suggested_object_id=key, **kwargs
    )
    if value is not None:
        hass.states.async_set(entity.entity_id, value, attributes)
    return entity.entity_id


async def _setup(hass: HomeAssistant, **options) -> MockConfigEntry:
    entry = MockConfigEntry(
        domain=DOMAIN, unique_id=DOMAIN, options={"modules": ["orphans"], "orphans": {**OPTIONS, **options}}
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


async def _scan(hass: HomeAssistant) -> dict[str, str]:
    """Scan now; {entity_id: reason} of the listed entities."""
    await hass.services.async_call(DOMAIN, "orphans_scan", {}, blocking=True)
    await hass.async_block_till_done()
    return _listed(hass)


def _listed(hass: HomeAssistant) -> dict[str, str]:
    return {e["entity_id"]: e["reason"] for e in hass.states.get(ORPHANS).attributes["entities"]}


async def _options_step(hass: HomeAssistant, entry: MockConfigEntry):
    result = await hass.config_entries.options.async_init(entry.entry_id)
    assert "orphans" in result["menu_options"]
    return await hass.config_entries.options.async_configure(result["flow_id"], {"next_step_id": "orphans"})


async def test_options_flow(hass):
    entry = await _setup(hass)
    result = await _options_step(hass, entry)
    assert result["type"] is FlowResultType.FORM
    result = await hass.config_entries.options.async_configure(
        result["flow_id"], {**OPTIONS, CONF_STALE_HOURS: 48, CONF_IGNORED_INTEGRATIONS: ["acme"]}
    )
    assert result["type"] is FlowResultType.CREATE_ENTRY
    await hass.async_block_till_done()
    assert entry.options["orphans"][CONF_STALE_HOURS] == 48
    assert entry.state is ConfigEntryState.LOADED
    attrs = hass.states.get(ORPHANS).attributes
    assert attrs["ignored_integrations"] == ["acme"]
    assert attrs["stale_hours"] == 48


async def test_reasons(hass: HomeAssistant, freezer: FrozenDateTimeFactory):
    """Each kind of orphan is listed with its reason; live, disabled and failing entities are not."""
    acme = _integration(hass, "acme")
    failing = _integration(hass, "gamma", ConfigEntryState.SETUP_RETRY)
    gone = _integration(hass, "delta")
    removed = _entity(hass, "delta", "old_node", None, gone, disabled_by=er.RegistryEntryDisabler.USER)
    # The integration removed without its entities (a registry left behind).
    hass.config_entries._entries.pop(gone.entry_id)

    live = _entity(hass, "acme", "lamp", "21", acme)
    not_provided = _entity(hass, "acme", "old_lamp", STATE_UNAVAILABLE, acme, attributes=RESTORED)
    no_state = _entity(hass, "acme", "never_added", None, acme)
    yaml_missing = _entity(hass, "old_yaml", "pump", STATE_UNAVAILABLE, attributes=RESTORED)
    retrying = _entity(hass, "gamma", "plug", STATE_UNAVAILABLE, failing, attributes=RESTORED)
    disabled = _entity(hass, "acme", "disabled", None, acme, disabled_by=er.RegistryEntryDisabler.USER)
    stale = _entity(hass, "acme", "dead", STATE_UNAVAILABLE, acme)
    unknown = _entity(hass, "acme", "never_reported", STATE_UNKNOWN, acme)
    button = _entity(hass, "acme", "identify", STATE_UNKNOWN, acme, domain="button")
    recent = _entity(hass, "acme", "flaky", STATE_UNAVAILABLE, acme)

    freezer.tick(timedelta(hours=25))
    # Back for a moment, then down again: unavailable for less than the stale delay.
    hass.states.async_set(recent, "on")
    hass.states.async_set(recent, STATE_UNAVAILABLE)
    await _setup(hass)

    listed = _listed(hass)
    assert listed == {
        removed: "entry_removed",
        yaml_missing: "integration_missing",
        not_provided: "not_provided",
        no_state: "not_provided",
        stale: "unavailable",
        unknown: "unknown",
    }
    for entity_id in (live, retrying, disabled, button, recent):
        assert entity_id not in listed
    state = hass.states.get(ORPHANS)
    assert state.state == "6"
    assert state.attributes["counts"] == {
        "entry_removed": 1,
        "integration_missing": 1,
        "not_provided": 2,
        "unavailable": 1,
        "unknown": 1,
    }
    item = next(e for e in state.attributes["entities"] if e["entity_id"] == not_provided)
    assert item["platform"] == "acme"
    assert item["entry_title"] == "Acme"
    assert item["since"]
    assert next(e for e in state.attributes["entities"] if e["entity_id"] == removed)["disabled"] is True
    assert hass.states.get(LAST_SCAN).state != STATE_UNKNOWN


async def test_stale_options(hass: HomeAssistant, freezer: FrozenDateTimeFactory):
    acme = _integration(hass, "acme")
    stale = _entity(hass, "acme", "dead", STATE_UNAVAILABLE, acme)
    unknown = _entity(hass, "acme", "never_reported", STATE_UNKNOWN, acme)
    freezer.tick(timedelta(hours=2))
    await _setup(hass, **{CONF_STALE_HOURS: 1, CONF_INCLUDE_UNKNOWN: False})
    assert _listed(hass) == {stale: "unavailable"}
    assert unknown not in _listed(hass)


async def test_stale_disabled(hass: HomeAssistant, freezer: FrozenDateTimeFactory):
    acme = _integration(hass, "acme")
    _entity(hass, "acme", "dead", STATE_UNAVAILABLE, acme)
    not_provided = _entity(hass, "acme", "old", STATE_UNAVAILABLE, acme, attributes=RESTORED)
    freezer.tick(timedelta(days=30))
    await _setup(hass, **{CONF_STALE_HOURS: 0})
    assert _listed(hass) == {not_provided: "not_provided"}


async def test_ignored(hass: HomeAssistant):
    acme = _integration(hass, "acme")
    beta = _integration(hass, "beta")
    kept = _entity(hass, "acme", "kept", STATE_UNAVAILABLE, acme, attributes=RESTORED)
    other = _entity(hass, "acme", "other", STATE_UNAVAILABLE, acme, attributes=RESTORED)
    _entity(hass, "beta", "plug", STATE_UNAVAILABLE, beta, attributes=RESTORED)
    await _setup(hass, **{CONF_IGNORED_INTEGRATIONS: ["beta"], CONF_IGNORED_ENTITIES: [kept]})
    assert _listed(hass) == {other: "not_provided"}


async def test_no_scan_while_starting(hass: HomeAssistant, freezer: FrozenDateTimeFactory):
    """Nothing is listed while Home Assistant starts nor during the grace period after it has started."""
    acme = _integration(hass, "acme")
    orphan = _entity(hass, "acme", "old", STATE_UNAVAILABLE, acme, attributes=RESTORED)
    hass.set_state(CoreState.starting)
    await _setup(hass)
    assert hass.states.get(ORPHANS).state == STATE_UNKNOWN
    assert hass.states.get(ORPHANS).attributes["next_scan"] is None
    with pytest.raises(ServiceValidationError):
        await hass.services.async_call(DOMAIN, "orphans_scan", {}, blocking=True)
    await hass.services.async_call("button", "press", {"entity_id": BUTTON}, blocking=True)
    await hass.async_block_till_done()
    assert hass.states.get(ORPHANS).state == STATE_UNKNOWN

    hass.set_state(CoreState.running)
    hass.bus.async_fire(EVENT_HOMEASSISTANT_STARTED)
    await hass.async_block_till_done()
    # The sensor says when the first scan is due (end of the grace period), and the registry changes wait for it.
    assert hass.states.get(ORPHANS).attributes["next_scan"] == (dt_util.utcnow() + timedelta(minutes=10)).isoformat()
    freezer.tick(timedelta(minutes=5))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    assert hass.states.get(ORPHANS).state == STATE_UNKNOWN

    freezer.tick(timedelta(minutes=5))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    assert _listed(hass) == {orphan: "not_provided"}
    assert hass.states.get(ORPHANS).attributes["next_scan"] is None


async def test_manual_scan_within_grace_period(hass: HomeAssistant):
    """A scan the user asks for (button, action) runs within the grace period: only the start refuses it."""
    acme = _integration(hass, "acme")
    orphan = _entity(hass, "acme", "old", STATE_UNAVAILABLE, acme, attributes=RESTORED)
    hass.set_state(CoreState.starting)
    await _setup(hass)
    hass.set_state(CoreState.running)
    hass.bus.async_fire(EVENT_HOMEASSISTANT_STARTED)
    await hass.async_block_till_done()
    assert hass.states.get(ORPHANS).state == STATE_UNKNOWN

    await hass.services.async_call("button", "press", {"entity_id": BUTTON}, blocking=True)
    await hass.async_block_till_done()
    assert _listed(hass) == {orphan: "not_provided"}
    assert hass.states.get(ORPHANS).attributes["next_scan"] is not None

    hass.states.async_set(orphan, "on")
    await hass.services.async_call(DOMAIN, "orphans_scan", {}, blocking=True)
    await hass.async_block_till_done()
    assert _listed(hass) == {}


async def test_scheduled_scan_and_registry_changes(hass: HomeAssistant, freezer: FrozenDateTimeFactory):
    acme = _integration(hass, "acme")
    await _setup(hass)
    assert hass.states.get(ORPHANS).state == "0"

    # A new orphan is found by the next scan...
    orphan = _entity(hass, "acme", "old", STATE_UNAVAILABLE, acme, attributes=RESTORED)
    freezer.tick(timedelta(seconds=REGISTRY_DEBOUNCE))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    # ...the registry change already triggered one.
    assert _listed(hass) == {orphan: "not_provided"}

    hass.states.async_set(orphan, "on")
    freezer.tick(timedelta(minutes=15))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    assert _listed(hass) == {}


async def test_remove(hass: HomeAssistant):
    acme = _integration(hass, "acme")
    a = _entity(hass, "acme", "a", STATE_UNAVAILABLE, acme, attributes=RESTORED)
    b = _entity(hass, "acme", "b", STATE_UNAVAILABLE, acme, attributes=RESTORED)
    live = _entity(hass, "acme", "live", "on", acme)
    await _setup(hass)
    events = async_capture_events(hass, EVENT_REMOVED)

    # An entity that isn't listed refuses the whole request.
    with pytest.raises(ServiceValidationError):
        await hass.services.async_call(DOMAIN, "orphans_remove", {"entities": [a, live]}, blocking=True)
    assert er.async_get(hass).async_get(a) is not None

    if RESPONSE:
        response = await hass.services.async_call(
            DOMAIN, "orphans_remove", {"entities": [a, b, a]}, blocking=True, return_response=True
        )
        assert response == {"removed": [a, b], "skipped": []}
    else:
        await hass.services.async_call(DOMAIN, "orphans_remove", {"entities": [a, b, a]}, blocking=True)
    await hass.async_block_till_done()
    registry = er.async_get(hass)
    assert registry.async_get(a) is None
    assert registry.async_get(b) is None
    assert registry.async_get(live) is not None
    # The restored placeholder states are gone with them.
    assert hass.states.get(a) is None
    assert events[0].data == {"entities": [a, b]}
    state = hass.states.get(ORPHANS)
    assert state.state == "0"
    assert state.attributes["removed"] == 2


@pytest.mark.skipif(
    "name" not in {a.name for a in er.DeletedRegistryEntry.__attrs_attrs__},
    reason="Home Assistant keeps no settings of a removed entity before this version",
)
async def test_an_entity_provided_again_gets_its_settings_back(hass: HomeAssistant):
    """Home Assistant keeps a removed entity's settings: the integration providing it again restores them."""
    acme = _integration(hass, "acme")
    a = _entity(hass, "acme", "a", STATE_UNAVAILABLE, acme, attributes=RESTORED)
    registry = er.async_get(hass)
    registry.async_update_entity(a, new_entity_id="sensor.kitchen_temperature", name="Kitchen", icon="mdi:fridge")
    a = "sensor.kitchen_temperature"
    await _setup(hass)
    await hass.services.async_call(DOMAIN, "orphans_remove", {"entities": [a]}, blocking=True)
    await hass.async_block_till_done()
    assert registry.async_get(a) is None

    back = registry.async_get_or_create("sensor", "acme", "a", config_entry=acme, suggested_object_id="a")
    assert (back.entity_id, back.name, back.icon) == (a, "Kitchen", "mdi:fridge")


async def test_remove_validation(hass: HomeAssistant):
    await _setup(hass)
    for entities in ([], ["not an id"]):
        with pytest.raises(vol.Invalid):
            await hass.services.async_call(DOMAIN, "orphans_remove", {"entities": entities}, blocking=True)


async def test_ignore(hass: HomeAssistant):
    acme = _integration(hass, "acme")
    a = _entity(hass, "acme", "a", STATE_UNAVAILABLE, acme, attributes=RESTORED)
    b = _entity(hass, "acme", "b", STATE_UNAVAILABLE, acme, attributes=RESTORED)
    entry = await _setup(hass)
    await hass.services.async_call(DOMAIN, "orphans_ignore", {"entities": [a]}, blocking=True)
    await hass.async_block_till_done()
    assert entry.options["orphans"][CONF_IGNORED_ENTITIES] == [a]
    assert entry.state is ConfigEntryState.LOADED
    assert _listed(hass) == {b: "not_provided"}
    # The entity stays in the registry.
    assert er.async_get(hass).async_get(a) is not None

    with pytest.raises(ServiceValidationError):
        await hass.services.async_call(DOMAIN, "orphans_ignore", {"entities": ["sensor.nowhere"]}, blocking=True)


async def test_actions_not_loaded(hass: HomeAssistant):
    entry = await _setup(hass)
    assert await hass.config_entries.async_unload(entry.entry_id)
    for service, data in (("scan", {}), ("remove", {"entities": ["sensor.a"]}), ("ignore", {"entities": ["sensor.a"]})):
        with pytest.raises(ServiceValidationError) as err:
            await hass.services.async_call(DOMAIN, f"orphans_{service}", data, blocking=True)
        assert err.value.translation_key == "not_loaded"


async def test_unload(hass):
    entry = await _setup(hass)
    assert await hass.config_entries.async_unload(entry.entry_id)
    assert entry.state is ConfigEntryState.NOT_LOADED


async def test_orphan_devices(hass: HomeAssistant):
    """A device whose config entries are all gone is listed and can be removed, with its entities."""
    from homeassistant.exceptions import ServiceValidationError
    from homeassistant.helpers import device_registry as dr

    live = _integration(hass, "acme")
    gone = _integration(hass, "delta")
    devices = dr.async_get(hass)
    old = devices.async_get_or_create(config_entry_id=gone.entry_id, identifiers={("delta", "1")}, name="Old hub")
    kept = devices.async_get_or_create(config_entry_id=live.entry_id, identifiers={("acme", "1")}, name="Lamp")
    node = _entity(hass, "delta", "node", None, gone, device_id=old.id)
    hass.config_entries._entries.pop(gone.entry_id)
    await _setup(hass)
    await _scan(hass)

    attributes = hass.states.get(ORPHANS).attributes
    assert [(d["device_id"], d["name"], d["entities"]) for d in attributes["devices"]] == [(old.id, "Old hub", 1)]
    with pytest.raises(ServiceValidationError):
        await hass.services.async_call(DOMAIN, "orphans_remove_devices", {"devices": [kept.id]}, blocking=True)
    # Without return_response: before Home Assistant 2025.1 admin actions can't return one.
    await hass.services.async_call(DOMAIN, "orphans_remove_devices", {"devices": [old.id]}, blocking=True)
    await hass.async_block_till_done()
    assert devices.async_get(old.id) is None
    assert devices.async_get(kept.id) is not None
    assert er.async_get(hass).async_get(node) is None
    assert hass.states.get(ORPHANS).attributes["devices"] == []
    assert node not in _listed(hass)


async def test_used_by(hass: HomeAssistant, hass_storage):
    """Each orphan lists the automations, scripts, scenes, groups and dashboards (storage mode) still using it."""
    acme = _integration(hass, "acme")
    used = _entity(hass, "acme", "old_lamp", STATE_UNAVAILABLE, acme, attributes=RESTORED)
    unused = _entity(hass, "acme", "spare", STATE_UNAVAILABLE, acme, attributes=RESTORED)
    hass_storage["lovelace"] = {
        "version": 1,
        "key": "lovelace",
        # sensor.spare_part is another entity: sensor.spare is not used by this dashboard.
        "data": {"config": {"views": [{"cards": [{"type": "entities", "entities": [used, "sensor.spare_part"]}]}]}},
    }
    hass_storage["lovelace_dashboards"] = {
        "version": 1,
        "key": "lovelace_dashboards",
        "data": {
            "items": [
                {
                    "id": "dashboard_lamps",
                    "url_path": "dashboard-lamps",
                    "title": "Lamps",
                    "mode": "storage",
                    "require_admin": False,
                    "show_in_sidebar": True,
                    "icon": None,
                }
            ]
        },
    }
    hass_storage["lovelace.dashboard_lamps"] = {
        "version": 1,
        "key": "lovelace.dashboard_lamps",
        "data": {"config": {"views": [{"cards": [{"type": "tile", "entity": used}]}]}},
    }
    assert await async_setup_component(hass, "lovelace", {})
    assert await async_setup_component(
        hass,
        "automation",
        {
            "automation": {
                "id": "lamp_alert",
                "alias": "Lamp alert",
                "triggers": [{"trigger": "state", "entity_id": used}],
                "actions": [{"delay": 1}],
            }
        },
    )
    assert await async_setup_component(
        hass,
        "script",
        {
            "script": {
                "lamp_off": {
                    "alias": "Lamp off",
                    "sequence": [{"action": "homeassistant.turn_off", "target": {"entity_id": used}}],
                }
            }
        },
    )
    assert await async_setup_component(
        hass, "scene", {"scene": [{"id": "evening", "name": "Evening", "entities": {used: "on"}}]}
    )
    assert await async_setup_component(hass, "group", {"group": {"lamps": {"name": "Lamp group", "entities": [used]}}})
    await hass.async_block_till_done()
    await _setup(hass)
    await _scan(hass)

    entities = {e["entity_id"]: e for e in hass.states.get(ORPHANS).attributes["entities"]}
    assert entities[unused]["used_by"] == []
    assert [(r["type"], r["name"], r["path"]) for r in entities[used]["used_by"]] == [
        ("automation", "Lamp alert", "/config/automation/edit/lamp_alert"),
        ("script", "Lamp off", "/config/script/edit/lamp_off"),
        ("scene", "Evening", "/config/scene/edit/evening"),
        ("group", "Lamp group", None),
        ("dashboard", "Overview", "/lovelace"),
        ("dashboard", "Lamps", "/dashboard-lamps"),
    ]
    # Kept out of the recorder with the list itself.
    from custom_components.system_hub.orphans.entities import OrphansSensor  # noqa: PLC0415

    assert "entities" in OrphansSensor._unrecorded_attributes


async def test_used_by_without_integrations(hass: HomeAssistant):
    """No automation, script, scene or group loaded, no dashboard: nothing uses the orphans, the scan still works."""
    acme = _integration(hass, "acme")
    orphan = _entity(hass, "acme", "old", STATE_UNAVAILABLE, acme, attributes=RESTORED)
    await _setup(hass)
    await _scan(hass)
    assert hass.states.get(ORPHANS).attributes["entities"][0]["used_by"] == []
    assert _listed(hass) == {orphan: "not_provided"}


async def test_remove_skips_entities_no_longer_orphaned(hass: HomeAssistant):
    """An entity listed by the last scan but provided again since is kept, and dropped from the list."""
    acme = _integration(hass, "acme")
    back = _entity(hass, "acme", "back", STATE_UNAVAILABLE, acme, attributes=RESTORED)
    gone = _entity(hass, "acme", "gone", STATE_UNAVAILABLE, acme, attributes=RESTORED)
    await _setup(hass)
    assert set(await _scan(hass)) == {back, gone}
    # Its integration provides it again (a real state, not the restored placeholder).
    hass.states.async_set(back, "on")
    scanner = hass.config_entries.async_entries(DOMAIN)[0].runtime_data.orphans
    assert scanner.async_remove([back, gone]) == ([gone], [back])
    await hass.async_block_till_done()
    registry = er.async_get(hass)
    assert registry.async_get(back) is not None
    assert registry.async_get(gone) is None
    assert _listed(hass) == {}
    assert hass.states.get(ORPHANS).attributes["removed"] == 1


def _orphan_device(hass: HomeAssistant, domain: str, entities: int = 0):
    """A device of a config entry then removed, with `entities` entities; (device, entry, entity IDs)."""
    from homeassistant.helpers import device_registry as dr  # noqa: PLC0415

    entry = _integration(hass, domain)
    device = dr.async_get(hass).async_get_or_create(
        config_entry_id=entry.entry_id, identifiers={(domain, "1")}, name=domain.title()
    )
    ids = [_entity(hass, domain, f"{domain}_{n}", None, entry, device_id=device.id) for n in range(entities)]
    hass.config_entries._entries.pop(entry.entry_id)
    return device, entry, ids


async def test_remove_devices_checks_again_and_counts_entities(hass: HomeAssistant):
    """A device whose integration came back is kept; the entities removed with the others count and fire an event."""
    from homeassistant.helpers import device_registry as dr  # noqa: PLC0415

    from custom_components.system_hub.orphans.const import EVENT_DEVICES_REMOVED  # noqa: PLC0415

    old, _, nodes = _orphan_device(hass, "delta", entities=2)
    back, back_entry, _ = _orphan_device(hass, "omega")
    await _setup(hass)
    await _scan(hass)
    assert {d["device_id"] for d in hass.states.get(ORPHANS).attributes["devices"]} == {old.id, back.id}
    removed_events = async_capture_events(hass, EVENT_REMOVED)
    device_events = async_capture_events(hass, EVENT_DEVICES_REMOVED)
    # The integration of `back` is set up again before the removal.
    back_entry.add_to_hass(hass)

    scanner = hass.config_entries.async_entries(DOMAIN)[0].runtime_data.orphans
    removed, skipped, entities = scanner.async_remove_devices([old.id, back.id])
    await hass.async_block_till_done()
    assert (removed, skipped, sorted(entities)) == ([old.id], [back.id], sorted(nodes))
    devices = dr.async_get(hass)
    assert devices.async_get(old.id) is None
    assert devices.async_get(back.id) is not None
    assert device_events[0].data == {"devices": [old.id]}
    assert sorted(removed_events[0].data["entities"]) == sorted(nodes)
    attributes = hass.states.get(ORPHANS).attributes
    assert attributes["removed"] == 2
    assert attributes["devices"] == []


async def test_remove_devices_batch_limit(hass: HomeAssistant):
    first, _, _ = _orphan_device(hass, "delta")
    second, _, _ = _orphan_device(hass, "omega")
    await _setup(hass)
    await _scan(hass)
    with (
        patch("custom_components.system_hub.orphans.scanner.MAX_BATCH", 1),
        pytest.raises(ServiceValidationError) as err,
    ):
        await hass.services.async_call(
            DOMAIN, "orphans_remove_devices", {"devices": [first.id, second.id]}, blocking=True
        )
    assert err.value.translation_key == "orphans_too_many"


async def test_ignore_devices(hass: HomeAssistant):
    """`ignore` takes device IDs too: the device is no longer listed."""
    old, _, _ = _orphan_device(hass, "delta")
    entry = await _setup(hass)
    await _scan(hass)
    with pytest.raises(vol.Invalid):
        await hass.services.async_call(DOMAIN, "orphans_ignore", {}, blocking=True)
    with pytest.raises(ServiceValidationError) as err:
        await hass.services.async_call(DOMAIN, "orphans_ignore", {"devices": ["nowhere"]}, blocking=True)
    assert err.value.translation_key == "orphans_device_not_registered"

    await hass.services.async_call(DOMAIN, "orphans_ignore", {"devices": [old.id]}, blocking=True)
    await hass.async_block_till_done()
    assert entry.options["orphans"][CONF_IGNORED_ENTITIES] == [old.id]
    await _scan(hass)
    assert hass.states.get(ORPHANS).attributes["devices"] == []


async def test_entities_attribute_capped(hass: HomeAssistant):
    """The attribute lists at most MAX_LISTED entities; the state keeps the full count."""
    acme = _integration(hass, "acme")
    for key in ("a", "b", "c"):
        _entity(hass, "acme", key, STATE_UNAVAILABLE, acme, attributes=RESTORED)
    await _setup(hass)
    with patch("custom_components.system_hub.orphans.entities.MAX_LISTED", 2):
        await _scan(hass)
        state = hass.states.get(ORPHANS)
    assert state.state == "3"
    assert len(state.attributes["entities"]) == 2
    assert state.attributes["truncated"] == 1


async def test_dashboards_read_again_only_when_saved(hass: HomeAssistant, hass_storage):
    """The dashboards are read at the first scan, then only after `lovelace_updated`, not at every scan."""
    from custom_components.system_hub.orphans import scanner as scanner_module  # noqa: PLC0415

    acme = _integration(hass, "acme")
    used = _entity(hass, "acme", "old_lamp", STATE_UNAVAILABLE, acme, attributes=RESTORED)
    hass_storage["lovelace"] = {
        "version": 1,
        "key": "lovelace",
        "data": {"config": {"views": [{"cards": [{"type": "tile", "entity": used}]}]}},
    }
    assert await async_setup_component(hass, "lovelace", {})
    reads = []
    original = scanner_module.async_dashboards

    async def counted(hass_: HomeAssistant):
        reads.append(1)
        return await original(hass_)

    def used_by() -> list[str]:
        return [r["type"] for r in hass.states.get(ORPHANS).attributes["entities"][0]["used_by"]]

    with patch.object(scanner_module, "async_dashboards", counted):
        await _setup(hass)
        await _scan(hass)
        assert used_by() == ["dashboard"]
        await _scan(hass)
        assert len(reads) == 1

        lovelace = hass.data["lovelace"]
        dashboards = lovelace["dashboards"] if isinstance(lovelace, dict) else lovelace.dashboards
        # Newer releases also keep the default dashboard under "lovelace": every storage dashboard drops the lamp.
        for dashboard in list(dashboards.values()):
            if getattr(dashboard, "mode", None) == "storage":
                await dashboard.async_save({"views": []})
        await hass.async_block_till_done()
        assert len(reads) >= 2
        assert used_by() == []


async def test_options_show_ignored_devices_by_name(hass: HomeAssistant):
    """An ignored device ID is shown with its device's name in the options; an entity ID as it is."""
    old, _, _ = _orphan_device(hass, "delta")
    entry = await _setup(hass, **{CONF_IGNORED_ENTITIES: [old.id, "sensor.kept"]})
    result = await _options_step(hass, entry)
    selector = result["data_schema"].schema[next(k for k in result["data_schema"].schema if k == CONF_IGNORED_ENTITIES)]
    labels = {o["value"]: o["label"] for o in selector.config["options"]}
    assert labels == {old.id: f"Delta ({old.id})", "sensor.kept": "sensor.kept"}


async def test_remove_devices_without_ids_removes_every_orphan_device(hass: HomeAssistant):
    """`remove_devices` without `devices`: every orphan device of the last scan, also those the sensor leaves out."""
    from homeassistant.helpers import device_registry as dr  # noqa: PLC0415

    first, _, _ = _orphan_device(hass, "delta", entities=1)
    second, _, _ = _orphan_device(hass, "omega")
    with patch("custom_components.system_hub.orphans.entities.MAX_LISTED", 1):
        await _setup(hass)
        await _scan(hass)
        attributes = hass.states.get(ORPHANS).attributes
        assert len(attributes["devices"]) == 1
        assert attributes["devices_truncated"] == 1
        if RESPONSE:
            response = await hass.services.async_call(
                DOMAIN, "orphans_remove_devices", {}, blocking=True, return_response=True
            )
            assert sorted(response["removed"]) == sorted([first.id, second.id])
            assert response["skipped"] == []
        else:
            await hass.services.async_call(DOMAIN, "orphans_remove_devices", {}, blocking=True)
        await hass.async_block_till_done()
        devices = dr.async_get(hass)
        assert devices.async_get(first.id) is None
        assert devices.async_get(second.id) is None
        attributes = hass.states.get(ORPHANS).attributes
        assert attributes["devices"] == []
        assert attributes["devices_truncated"] == 0
        # Nothing left: nothing to do, no error.
        await hass.services.async_call(DOMAIN, "orphans_remove_devices", {}, blocking=True)
    from custom_components.system_hub.orphans.entities import OrphansSensor  # noqa: PLC0415

    assert "devices_truncated" in OrphansSensor._unrecorded_attributes


async def test_devices_used_by(hass: HomeAssistant):
    """Each orphan device lists the automations and scripts still using it."""
    used, _, _ = _orphan_device(hass, "delta")
    unused, _, _ = _orphan_device(hass, "omega")
    target = {"action": "homeassistant.turn_off", "target": {"device_id": used.id}}
    assert await async_setup_component(
        hass,
        "automation",
        {"automation": {"id": "hub_alert", "alias": "Hub alert", "triggers": [], "actions": [target]}},
    )
    assert await async_setup_component(
        hass, "script", {"script": {"hub_off": {"alias": "Hub off", "sequence": [target]}}}
    )
    await hass.async_block_till_done()
    await _setup(hass)
    await _scan(hass)
    devices = {d["device_id"]: d for d in hass.states.get(ORPHANS).attributes["devices"]}
    assert devices[unused.id]["used_by"] == []
    assert [(r["type"], r["name"], r["path"]) for r in devices[used.id]["used_by"]] == [
        ("automation", "Hub alert", "/config/automation/edit/hub_alert"),
        ("script", "Hub off", "/config/script/edit/hub_off"),
    ]
