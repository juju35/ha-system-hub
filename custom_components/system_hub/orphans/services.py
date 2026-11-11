"""Actions of the Orphans module, for administrators only (they change the registries)."""

from __future__ import annotations

from collections.abc import Callable

import voluptuous as vol
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall, ServiceResponse, SupportsResponse
from homeassistant.exceptions import ServiceValidationError
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.service import async_register_admin_service

from ..admin import admin_only
from ..const import DOMAIN
from .const import (
    ATTR_DEVICES,
    ATTR_ENTITIES,
    CONF_IGNORED_ENTITIES,
    MAX_BATCH,
    SERVICE_IGNORE,
    SERVICE_REMOVE,
    SERVICE_REMOVE_DEVICES,
    SERVICE_SCAN,
)
from .scanner import OrphanScanner

MODULE = "orphans"
# The options an ignore just saved: applied live, so the entry is not reloaded for them.
NO_RELOAD_KEY = "orphans_no_reload"

ENTITIES_SCHEMA = vol.Schema({vol.Required(ATTR_ENTITIES): vol.All(cv.ensure_list, [cv.entity_id], vol.Length(min=1))})
# Without `devices`: every orphan device of the last scan.
DEVICES_SCHEMA = vol.Schema({vol.Optional(ATTR_DEVICES): vol.All(cv.ensure_list, [cv.string], vol.Length(min=1))})
# Entities, devices or both.
IGNORE_SCHEMA = vol.All(
    vol.Schema(
        {
            vol.Optional(ATTR_ENTITIES): vol.All(cv.ensure_list, [cv.entity_id]),
            vol.Optional(ATTR_DEVICES): vol.All(cv.ensure_list, [cv.string]),
        }
    ),
    cv.has_at_least_one_key(ATTR_ENTITIES, ATTR_DEVICES),
)


def async_ignore(
    hass: HomeAssistant, entry: ConfigEntry, scanner: OrphanScanner, entities: set[str], devices: set[str]
) -> None:
    """Add entities and devices to the ignored ones: the scanner drops them now, the options keep them."""
    if len(entities) + len(devices) > MAX_BATCH:
        raise ServiceValidationError(
            translation_domain=DOMAIN,
            translation_key="orphans_too_many",
            translation_placeholders={"max": str(MAX_BATCH)},
        )
    registry = er.async_get(hass)
    if unknown := sorted(e for e in entities if registry.async_get(e) is None):
        raise ServiceValidationError(
            translation_domain=DOMAIN,
            translation_key="orphans_not_registered",
            translation_placeholders={"entities": ", ".join(unknown[:10])},
        )
    device_registry = dr.async_get(hass)
    if unknown := sorted(d for d in devices if device_registry.async_get(d) is None):
        raise ServiceValidationError(
            translation_domain=DOMAIN,
            translation_key="orphans_device_not_registered",
            translation_placeholders={"devices": ", ".join(unknown[:10])},
        )
    # Device IDs share the ignored entities option: the scan skips a device whose ID is there.
    wanted = entities | devices
    settings = entry.options.get(MODULE)
    settings = dict(settings) if isinstance(settings, dict) else {}
    current = set(settings.get(CONF_IGNORED_ENTITIES, []))
    scanner.async_ignore(entities, devices)
    if wanted <= current:
        return
    options = {**entry.options, MODULE: {**settings, CONF_IGNORED_ENTITIES: sorted(current | wanted)}}
    hass.data.setdefault(DOMAIN, {})[NO_RELOAD_KEY] = options
    hass.config_entries.async_update_entry(entry, options=options)


def async_setup_orphans_services(hass: HomeAssistant, loaded: Callable[[], tuple[ConfigEntry, OrphanScanner]]) -> None:
    """Register the actions; `loaded` returns the entry and its scanner, or raises when the module is turned off."""

    async def scan(_call: ServiceCall) -> None:
        # Asked for by the user: scans even within the grace period, only Home Assistant starting refuses.
        if not loaded()[1].async_scan(force=True):
            raise ServiceValidationError(translation_domain=DOMAIN, translation_key="orphans_starting")

    async def remove(call: ServiceCall) -> ServiceResponse:
        # `skipped`: listed by the last scan but no longer orphaned, kept.
        removed, skipped = loaded()[1].async_remove(call.data[ATTR_ENTITIES])
        return {"removed": removed, "skipped": skipped}

    async def remove_devices(call: ServiceCall) -> ServiceResponse:
        removed, skipped, entities = loaded()[1].async_remove_devices(call.data.get(ATTR_DEVICES))
        return {"removed": removed, "skipped": skipped, "entities": entities}

    async def ignore(call: ServiceCall) -> None:
        entry, scanner = loaded()
        async_ignore(hass, entry, scanner, set(call.data.get(ATTR_ENTITIES, [])), set(call.data.get(ATTR_DEVICES, [])))

    async_register_admin_service(hass, DOMAIN, SERVICE_SCAN, scan)
    async_register_admin_service(hass, DOMAIN, SERVICE_IGNORE, ignore, IGNORE_SCHEMA)
    for service, handler, schema in (
        (SERVICE_REMOVE, remove, ENTITIES_SCHEMA),
        (SERVICE_REMOVE_DEVICES, remove_devices, DEVICES_SCHEMA),
    ):
        hass.services.async_register(
            DOMAIN, service, admin_only(hass, handler), schema=schema, supports_response=SupportsResponse.OPTIONAL
        )
