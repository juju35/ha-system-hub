"""System Hub: system health, Home Assistant containers, Marketplace updates and integration watchdog in one place.

Each feature is a module the options turn on or off. A module turned off is not set up: no checks, no entities
(those it had are removed from the registry), its actions refuse to run.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

import voluptuous as vol
from homeassistant.config_entries import ConfigEntry, ConfigEntryState
from homeassistant.const import ATTR_ENTITY_ID, EVENT_HOMEASSISTANT_STARTED, Platform
from homeassistant.core import CoreState, Event, HomeAssistant, ServiceCall, ServiceResponse, SupportsResponse
from homeassistant.exceptions import HomeAssistantError, ServiceValidationError
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.service import async_register_admin_service
from homeassistant.helpers.typing import ConfigType

from .admin import admin_only
from .batteries import async_disable_batteries, async_remove_batteries, async_setup_batteries
from .batteries.const import ATTR_BATTERY_TYPE, ATTR_COUNT, ATTR_PATH, SERVICE_EXPORT, SERVICE_NOTIFY, SERVICE_SET_STOCK
from .batteries.export import async_export
from .batteries.monitor import BatteryMonitor
from .cards import async_register_cards, async_remove_cards
from .const import (
    CONF_MODULES,
    DOMAIN,
    MODULE_BATTERIES,
    MODULE_CONTAINERS,
    MODULE_GIT_SYNC,
    MODULE_MARKETPLACE,
    MODULE_ORPHANS,
    MODULE_WATCHDOG,
    MODULES,
)
from .containers import async_setup_containers
from .containers.const import SERVICE_REFRESH
from .containers.monitor import ContainerMonitor
from .git_sync import async_remove_git_sync, async_setup_git_sync, configured, further_repositories
from .git_sync.const import CONF_REPO_ID
from .git_sync.coordinator import GitSyncCoordinator
from .git_sync.entities import device_key as git_sync_device_key
from .git_sync.services import async_setup_git_sync_services
from .marketplace import async_options_changed, async_remove_marketplace, async_setup_marketplace
from .marketplace.const import SERVICE_CHECK_REPOSITORY, SERVICE_CHECK_UPDATES, SERVICE_INSTALL_UPDATES
from .marketplace.refresher import MarketplaceNotAvailableError, MarketplaceRefresher
from .orphans import async_setup_orphans
from .orphans.scanner import OrphanScanner
from .orphans.services import NO_RELOAD_KEY, async_setup_orphans_services
from .panel import async_register_panel, async_remove_panel
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

    containers: ContainerMonitor | None = None
    watchdog: IntegrationWatchdog | None = None
    marketplace: MarketplaceRefresher | None = None
    batteries: BatteryMonitor | None = None
    git_sync: GitSyncCoordinator | None = None
    # Every repository of the Git Sync module: the first one (git_sync), then the further ones.
    git_syncs: list[GitSyncCoordinator] = field(default_factory=list)
    orphans: OrphanScanner | None = None


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


def loaded_monitor(hass: HomeAssistant) -> ContainerMonitor:
    if (monitor := _loaded_data(hass).containers) is None:
        raise ServiceValidationError(
            translation_domain=DOMAIN,
            translation_key="module_disabled",
            translation_placeholders={"module": "Containers"},
        )
    return monitor


def loaded_batteries(hass: HomeAssistant) -> BatteryMonitor:
    if (monitor := _loaded_data(hass).batteries) is None:
        raise ServiceValidationError(
            translation_domain=DOMAIN,
            translation_key="module_disabled",
            translation_placeholders={"module": "Batteries"},
        )
    return monitor


def loaded_git_sync(hass: HomeAssistant) -> GitSyncCoordinator:
    if (coordinator := _loaded_data(hass).git_sync) is None:
        raise ServiceValidationError(
            translation_domain=DOMAIN,
            translation_key="module_disabled",
            translation_placeholders={"module": "Versioning"},
        )
    return coordinator


def loaded_git_syncs(hass: HomeAssistant) -> list[GitSyncCoordinator]:
    """Every repository of the Git Sync module, the first one first."""
    loaded_git_sync(hass)
    return list(_loaded_data(hass).git_syncs)


def loaded_orphans(hass: HomeAssistant) -> tuple[ConfigEntry, OrphanScanner]:
    """The loaded entry and its orphans scanner, for the Orphans actions."""
    entry = next((e for e in hass.config_entries.async_entries(DOMAIN) if e.state is ConfigEntryState.LOADED), None)
    if entry is None:
        raise ServiceValidationError(translation_domain=DOMAIN, translation_key="not_loaded")
    if (scanner := entry.runtime_data.orphans) is None:
        raise ServiceValidationError(
            translation_domain=DOMAIN,
            translation_key="module_disabled",
            translation_placeholders={"module": "Cleanup"},
        )
    return entry, scanner


def loaded_watchdog(hass: HomeAssistant) -> IntegrationWatchdog:
    """The watchdog of the loaded entry, for the actions and the Repairs flow."""
    if (watchdog := _loaded_data(hass).watchdog) is None:
        raise ServiceValidationError(
            translation_domain=DOMAIN,
            translation_key="module_disabled",
            translation_placeholders={"module": "Sentinel"},
        )
    return watchdog


def loaded_refresher(hass: HomeAssistant) -> MarketplaceRefresher:
    if (refresher := _loaded_data(hass).marketplace) is None:
        raise ServiceValidationError(
            translation_domain=DOMAIN,
            translation_key="module_disabled",
            translation_placeholders={"module": "Updates"},
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

    # The Lovelace cards, on every dashboard once Home Assistant has started (the resources are loaded by then).
    async def _register_cards(_event: Event | None = None) -> None:
        await async_register_cards(hass)

    if hass.state is CoreState.running:
        await _register_cards()
    else:
        hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STARTED, _register_cards)

    async def containers_refresh(_call: ServiceCall) -> None:
        """Read the containers now; fails when the Supervisor could not be read."""
        monitor = loaded_monitor(hass)
        await monitor.async_refresh()
        if monitor.error is not None:
            raise HomeAssistantError(
                translation_domain=DOMAIN,
                translation_key="containers_read_failed",
                translation_placeholders={"error": monitor.error},
            )

    async_register_admin_service(hass, DOMAIN, SERVICE_REFRESH, containers_refresh)

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

    async def batteries_notify(_call: ServiceCall) -> None:
        await loaded_batteries(hass).async_notify(manual=True)

    # Like the button: any user may ask for the low-battery notification now.
    hass.services.async_register(DOMAIN, SERVICE_NOTIFY, batteries_notify)

    async def batteries_set_stock(call: ServiceCall) -> None:
        loaded_batteries(hass).async_set_stock(call.data[ATTR_BATTERY_TYPE], call.data.get(ATTR_COUNT))

    # Counting the spare batteries is household bookkeeping, not configuration: open to every user.
    hass.services.async_register(
        DOMAIN,
        SERVICE_SET_STOCK,
        batteries_set_stock,
        schema=vol.Schema(
            {
                vol.Required(ATTR_BATTERY_TYPE): vol.All(cv.string, vol.Length(min=1, max=40)),
                vol.Optional(ATTR_COUNT): vol.Any(None, vol.All(vol.Coerce(int), vol.Range(min=0, max=999))),
            }
        ),
    )

    async def batteries_export(call: ServiceCall) -> ServiceResponse:
        return await async_export(hass, loaded_batteries(hass), call.data.get(ATTR_PATH))

    # Writes a file on the server: administrators only.
    hass.services.async_register(
        DOMAIN,
        SERVICE_EXPORT,
        admin_only(hass, batteries_export),
        schema=vol.Schema({vol.Optional(ATTR_PATH): cv.string}),
        supports_response=SupportsResponse.OPTIONAL,
    )

    async_setup_git_sync_services(hass, lambda: loaded_git_syncs(hass))
    async_setup_orphans_services(hass, lambda: loaded_orphans(hass))
    return True


async def async_setup_entry(hass: HomeAssistant, entry: SystemHubConfigEntry) -> bool:
    """Set up the modules turned on; drop the entities and the device of those turned off."""
    modules = enabled_modules(entry)
    data = SystemHubData()
    if MODULE_CONTAINERS in modules:
        data.containers = await async_setup_containers(hass, entry, module_options(entry, MODULE_CONTAINERS))
        entry.async_on_unload(data.containers.async_dismiss_all)
    if MODULE_WATCHDOG in modules:
        data.watchdog = await async_setup_watchdog(hass, entry, module_options(entry, MODULE_WATCHDOG))
    else:
        await async_disable_watchdog(hass)
    if MODULE_MARKETPLACE in modules:
        data.marketplace = await async_setup_marketplace(hass, entry, module_options(entry, MODULE_MARKETPLACE))
    if MODULE_BATTERIES in modules:
        data.batteries = await async_setup_batteries(hass, entry, module_options(entry, MODULE_BATTERIES))
    else:
        async_disable_batteries(hass)
    if MODULE_GIT_SYNC in modules:
        settings = module_options(entry, MODULE_GIT_SYNC)
        if configured(settings):
            data.git_sync = await async_setup_git_sync(hass, entry, settings)
            data.git_syncs = [data.git_sync]
            for further in further_repositories(entry.options):
                repo_id = further.pop(CONF_REPO_ID)
                data.git_syncs.append(await async_setup_git_sync(hass, entry, further, repo_id))
        else:
            _LOGGER.warning("Git Sync module turned on without a repository: set it up in Configure → Git Sync")
    if MODULE_ORPHANS in modules:
        data.orphans = await async_setup_orphans(hass, entry, module_options(entry, MODULE_ORPHANS))
    entry.runtime_data = data
    # Added again after a removal (which drops the panel and the cards) without a restart: they come back.
    await async_register_panel(hass)
    if hass.state is CoreState.running:
        await async_register_cards(hass)
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
    # The devices of the further Git Sync repositories removed (all of them with the module turned off), and
    # their entities.
    kept = {
        git_sync_device_key(entry.entry_id, item[CONF_REPO_ID])
        for item in (further_repositories(entry.options) if MODULE_GIT_SYNC in modules else [])
    }
    further = f"{entry.entry_id}_{MODULE_GIT_SYNC}_"
    for device in dr.async_entries_for_config_entry(devices, entry.entry_id):
        idents = {i for d, i in device.identifiers if d == DOMAIN and i.startswith(further)}
        if idents and not idents & kept:
            for item in er.async_entries_for_device(entities, device.id, include_disabled_entities=True):
                entities.async_remove(item.entity_id)
            devices.async_remove_device(device.id)


async def async_unload_entry(hass: HomeAssistant, entry: SystemHubConfigEntry) -> bool:
    if (batteries := entry.runtime_data.batteries) is not None:
        await batteries.async_save()
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
    async_remove_panel(hass)
    await async_remove_cards(hass)
    await async_remove_watchdog(hass)
    await async_remove_marketplace(hass)
    await async_remove_batteries(hass)
    await async_remove_git_sync(hass, [item[CONF_REPO_ID] for item in further_repositories(entry.options)])


async def _async_reload(hass: HomeAssistant, entry: SystemHubConfigEntry) -> None:
    """Reload with the new options."""
    # Ignored from the Orphans module (panel, card, action): already applied, no reload needed.
    if hass.data.get(DOMAIN, {}).pop(NO_RELOAD_KEY, None) == entry.options:
        return
    if (refresher := entry.runtime_data.marketplace) is not None:
        await async_options_changed(refresher, module_options(entry, MODULE_MARKETPLACE))
    await hass.config_entries.async_reload(entry.entry_id)
