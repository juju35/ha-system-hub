"""System Hub: system health, Home Assistant containers, Marketplace updates and integration watchdog in one place.

Each feature is a module the options turn on or off. A module turned off is not set up: no checks, no entities
(those it had are removed from the registry), its actions refuse to run.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

import voluptuous as vol
from homeassistant.config_entries import ConfigEntry, ConfigEntryState
from homeassistant.const import ATTR_ENTITY_ID, Platform
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.exceptions import HomeAssistantError, ServiceValidationError
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.service import async_register_admin_service
from homeassistant.helpers.typing import ConfigType

from .const import CONF_MODULES, DOMAIN, MODULE_MARKETPLACE, MODULE_WATCHDOG, MODULES
from .marketplace import async_options_changed, async_remove_marketplace, async_setup_marketplace
from .marketplace.const import SERVICE_CHECK_REPOSITORY, SERVICE_CHECK_UPDATES, SERVICE_INSTALL_UPDATES
from .marketplace.refresher import MarketplaceNotAvailableError, MarketplaceRefresher
from .watchdog import async_disable_watchdog, async_remove_watchdog, async_setup_watchdog, async_wait_idle
from .watchdog.const import ATTR_ENTRY_ID, SERVICE_CHECK, SERVICE_RESET
from .watchdog.core import IntegrationWatchdog

_LOGGER = logging.getLogger(__name__)

PLATFORMS = [Platform.BUTTON, Platform.SENSOR]
CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)

ATTR_WAIT = "wait"
ATTR_BACKUP = "backup"
CHECK_UPDATES_SCHEMA = vol.Schema({vol.Optional(ATTR_WAIT, default=False): cv.boolean})
CHECK_REPOSITORY_SCHEMA = vol.Schema({vol.Required(ATTR_ENTITY_ID): cv.entity_ids})
INSTALL_UPDATES_SCHEMA = vol.Schema(
    {
        vol.Optional(ATTR_ENTITY_ID): cv.entity_ids,
        vol.Optional(ATTR_WAIT, default=False): cv.boolean,
        vol.Optional(ATTR_BACKUP): cv.boolean,
    }
)


@dataclass
class SystemHubData:
    """The modules set up for the entry; None when turned off."""

    watchdog: IntegrationWatchdog | None = None
    marketplace: MarketplaceRefresher | None = None


type SystemHubConfigEntry = ConfigEntry[SystemHubData]


def enabled_modules(entry: ConfigEntry) -> list[str]:
    """The modules turned on in the options; every module when the options don't say."""
    modules = entry.options.get(CONF_MODULES)
    return [m for m in MODULES if m in modules] if isinstance(modules, list) else list(MODULES)


def module_options(entry: ConfigEntry, module: str) -> dict[str, Any]:
    options = entry.options.get(module)
    return dict(options) if isinstance(options, dict) else {}


def _loaded_data(hass: HomeAssistant) -> SystemHubData:
    entries = [e for e in hass.config_entries.async_entries(DOMAIN) if e.state is ConfigEntryState.LOADED]
    if not entries:
        raise ServiceValidationError(translation_domain=DOMAIN, translation_key="not_loaded")
    return entries[0].runtime_data


def loaded_watchdog(hass: HomeAssistant) -> IntegrationWatchdog:
    """The watchdog of the loaded entry, for the actions and the Repairs flow."""
    if (watchdog := _loaded_data(hass).watchdog) is None:
        raise ServiceValidationError(
            translation_domain=DOMAIN,
            translation_key="module_disabled",
            translation_placeholders={"module": "Watchdog"},
        )
    return watchdog


def loaded_refresher(hass: HomeAssistant) -> MarketplaceRefresher:
    if (refresher := _loaded_data(hass).marketplace) is None:
        raise ServiceValidationError(
            translation_domain=DOMAIN,
            translation_key="module_disabled",
            translation_placeholders={"module": "Marketplace"},
        )
    return refresher


def _validation_error(err: MarketplaceNotAvailableError) -> ServiceValidationError:
    """The same translated message, as a validation error of the action."""
    return ServiceValidationError(
        translation_domain=err.translation_domain,
        translation_key=err.translation_key,
        translation_placeholders=err.translation_placeholders,
    )


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Register the actions of every module (administrators only); those of a module turned off refuse to run."""

    async def watchdog_check(_call: ServiceCall) -> None:
        # Waits for a check already running, then runs its own.
        await loaded_watchdog(hass).async_check(wait=True)

    async def watchdog_reset(call: ServiceCall) -> None:
        """Start over for an integration given up (or still being reloaded) and reload it now."""
        watchdog = loaded_watchdog(hass)
        entry_id = call.data[ATTR_ENTRY_ID]
        target = hass.config_entries.async_get_entry(entry_id)
        if target is None or target.domain == DOMAIN:
            raise ServiceValidationError(
                translation_domain=DOMAIN,
                translation_key="watchdog_unknown_entry",
                translation_placeholders={"entry_id": entry_id},
            )
        if not await watchdog.async_reset(entry_id):
            raise HomeAssistantError(
                translation_domain=DOMAIN,
                translation_key="watchdog_reload_failed",
                translation_placeholders={"title": target.title},
            )

    async_register_admin_service(hass, DOMAIN, SERVICE_CHECK, watchdog_check)
    async_register_admin_service(
        hass, DOMAIN, SERVICE_RESET, watchdog_reset, vol.Schema({vol.Required(ATTR_ENTRY_ID): cv.string})
    )

    async def check_updates(call: ServiceCall) -> None:
        refresher = loaded_refresher(hass)
        try:
            refresher.async_start()
        except MarketplaceNotAvailableError as err:
            raise _validation_error(err) from err
        if call.data[ATTR_WAIT]:
            await refresher.async_wait()
            # Like check_repository: fail when the check failed or could not check some repositories.
            refresher.raise_for_result()

    # Each call asks GitHub again for every repository: administrators only, so that any user can't spend
    # the Marketplace's GitHub rate limit (the button, which starts at most one check at a time, stays open).
    async_register_admin_service(hass, DOMAIN, SERVICE_CHECK_UPDATES, check_updates, CHECK_UPDATES_SCHEMA)

    async def check_repository(call: ServiceCall) -> None:
        try:
            await loaded_refresher(hass).async_check_repositories(call.data[ATTR_ENTITY_ID])
        except MarketplaceNotAvailableError as err:
            raise _validation_error(err) from err

    async_register_admin_service(hass, DOMAIN, SERVICE_CHECK_REPOSITORY, check_repository, CHECK_REPOSITORY_SCHEMA)

    async def install_updates(call: ServiceCall) -> None:
        refresher = loaded_refresher(hass)
        try:
            refresher.async_start_install(call.data.get(ATTR_ENTITY_ID), call.context, call.data.get(ATTR_BACKUP))
        except MarketplaceNotAvailableError as err:
            raise _validation_error(err) from err
        if call.data[ATTR_WAIT]:
            await refresher.async_wait_install()

    # Installing code on the server: administrators only, like the Marketplace itself.
    async_register_admin_service(hass, DOMAIN, SERVICE_INSTALL_UPDATES, install_updates, INSTALL_UPDATES_SCHEMA)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: SystemHubConfigEntry) -> bool:
    """Set up the modules turned on; drop the entities and the device of those turned off."""
    modules = enabled_modules(entry)
    data = SystemHubData()
    if MODULE_WATCHDOG in modules:
        data.watchdog = await async_setup_watchdog(hass, entry, module_options(entry, MODULE_WATCHDOG))
    else:
        await async_disable_watchdog(hass)
    if MODULE_MARKETPLACE in modules:
        data.marketplace = await async_setup_marketplace(hass, entry, module_options(entry, MODULE_MARKETPLACE))
    entry.runtime_data = data
    _async_remove_disabled(hass, entry, modules)

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    entry.async_on_unload(entry.add_update_listener(_async_reload))
    return True


def _async_remove_disabled(hass: HomeAssistant, entry: ConfigEntry, modules: list[str]) -> None:
    """Remove the entities and the device of the modules turned off, so that nothing is left unavailable."""
    entities = er.async_get(hass)
    devices = dr.async_get(hass)
    for module in MODULES:
        if module in modules:
            continue
        prefix = f"{entry.entry_id}_{module}_"
        for item in er.async_entries_for_config_entry(entities, entry.entry_id):
            if item.unique_id.startswith(prefix):
                entities.async_remove(item.entity_id)
        # Looked up among the entry's devices: async_get_device by identifiers is deprecated from 2026.11.
        for device in dr.async_entries_for_config_entry(devices, entry.entry_id):
            if (DOMAIN, f"{entry.entry_id}_{module}") in device.identifiers:
                devices.async_remove_device(device.id)


async def async_unload_entry(hass: HomeAssistant, entry: SystemHubConfigEntry) -> bool:
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)


async def async_remove_entry(hass: HomeAssistant, entry: SystemHubConfigEntry) -> None:
    """Forget what the modules saved: the Watchdog's history and counts, the Marketplace's last check.

    Done once a check still running has ended.
    """
    await async_wait_idle(hass)
    # Added back meanwhile (single entry): keep everything. The entry being removed is skipped: before Home
    # Assistant 2025.3 it is still registered while this runs.
    if any(e.entry_id != entry.entry_id for e in hass.config_entries.async_entries(DOMAIN)):
        return
    await async_remove_watchdog(hass)
    await async_remove_marketplace(hass)


async def _async_reload(hass: HomeAssistant, entry: SystemHubConfigEntry) -> None:
    """Reload with the new options."""
    if (refresher := entry.runtime_data.marketplace) is not None:
        await async_options_changed(refresher, module_options(entry, MODULE_MARKETPLACE))
    await hass.config_entries.async_reload(entry.entry_id)
