"""Config flow for System Hub: a single entry; the options choose the modules and set each one."""

from __future__ import annotations

from typing import Any

import voluptuous as vol
from homeassistant.config_entries import ConfigEntry, ConfigFlow, ConfigFlowResult, OptionsFlow
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers.selector import (
    BooleanSelector,
    NumberSelector,
    NumberSelectorConfig,
    NumberSelectorMode,
    SelectOptionDict,
    SelectSelector,
    SelectSelectorConfig,
    SelectSelectorMode,
)

from .batteries import flow as batteries_flow
from .batteries import importer as batteries_importer
from .batteries.const import CONF_BATTERY_MODELS, CONF_BATTERY_TYPES
from .const import (
    CONF_MODULES,
    CONF_SYSTEM,
    DEFAULT_THRESHOLDS,
    DOMAIN,
    MARKETPLACE_DOMAIN,
    MODULE_BATTERIES,
    MODULE_CONTAINERS,
    MODULE_GIT_SYNC,
    MODULE_MARKETPLACE,
    MODULE_ORPHANS,
    MODULE_WATCHDOG,
    MODULES,
)
from .containers import flow as containers_flow
from .containers.monitor import supervisor_available
from .git_sync import configured as git_sync_configured
from .git_sync import flow as git_sync_flow
from .git_sync.const import CONF_REPO_PATH
from .marketplace import flow as marketplace_flow
from .orphans import flow as orphans_flow
from .watchdog import flow as watchdog_flow
from .watchdog.const import CONF_DELAY, CONF_DEVICE, CONF_OFF_TIME, CONF_POWER_CYCLES, CONF_SWITCH


def _modules_schema(current: list[str]) -> vol.Schema:
    return vol.Schema({vol.Required(module, default=module in current): BooleanSelector() for module in MODULES})


def _modules_errors(hass: HomeAssistant, user_input: dict[str, Any]) -> dict[str, str]:
    errors = {}
    if user_input.get(MODULE_CONTAINERS) and not supervisor_available(hass):
        errors[MODULE_CONTAINERS] = "supervisor_not_available"
    if user_input.get(MODULE_MARKETPLACE) and MARKETPLACE_DOMAIN not in hass.config.components:
        errors[MODULE_MARKETPLACE] = "marketplace_not_loaded"
    return errors


def _available(hass: HomeAssistant) -> list[str]:
    """The modules that can run here, turned on by default."""
    return [
        m
        for m in MODULES
        if (m != MODULE_MARKETPLACE or MARKETPLACE_DOMAIN in hass.config.components)
        and (m != MODULE_CONTAINERS or supervisor_available(hass))
        # Needs a repository set up first: turned on by choice.
        and m != MODULE_GIT_SYNC
    ]


async def _repository_errors(user_input: dict[str, Any]) -> dict[str, str]:
    """Normalize the repository settings submitted, then check the repository."""
    user_input[CONF_REPO_PATH] = user_input[CONF_REPO_PATH].rstrip("/") or "/"
    git_sync_flow.fill_empty(user_input, git_sync_flow.REPOSITORY_OPTIONAL)
    return await git_sync_flow.validate(user_input)


def _chosen(user_input: dict[str, Any]) -> list[str]:
    return [module for module in MODULES if user_input.get(module)]


class SystemHubConfigFlow(ConfigFlow, domain=DOMAIN):
    """Creates the single System Hub entry with the modules chosen."""

    VERSION = 1
    _chosen_modules: list[str]

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        """Choose the modules; each one keeps its default settings until changed in the options."""
        errors = _modules_errors(self.hass, user_input) if user_input is not None else {}
        if user_input is not None and not errors:
            self._chosen_modules = _chosen(user_input)
            if MODULE_GIT_SYNC in self._chosen_modules:
                return await self.async_step_git_sync_repository()
            return self.async_create_entry(title="System Hub", data={}, options={CONF_MODULES: self._chosen_modules})
        schema = _modules_schema(_available(self.hass))
        if user_input is not None:
            schema = self.add_suggested_values_to_schema(schema, user_input)
        return self.async_show_form(step_id="user", data_schema=schema, errors=errors)

    async def async_step_git_sync_repository(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        """The Git Sync module was chosen: its repository, checked before the entry is created."""
        errors: dict[str, str] = {}
        if user_input is not None:
            errors = await _repository_errors(user_input)
            if not errors:
                settings = user_input | git_sync_flow.default_options(self.hass)
                return self.async_create_entry(
                    title="System Hub",
                    data={},
                    options={CONF_MODULES: self._chosen_modules, MODULE_GIT_SYNC: settings},
                )
        return self.async_show_form(
            step_id="git_sync_repository",
            data_schema=self.add_suggested_values_to_schema(git_sync_flow.repository_schema({}), user_input or {}),
            errors=errors,
        )

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: ConfigEntry) -> OptionsFlow:
        return SystemHubOptionsFlow()


class SystemHubOptionsFlow(OptionsFlow):
    """The modules turned on, then the settings of each one; a module turned off keeps its settings."""

    _pending_modules: list[str] | None = None

    def _modules(self) -> list[str]:
        modules = self.config_entry.options.get(CONF_MODULES)
        return [m for m in MODULES if m in modules] if isinstance(modules, list) else list(MODULES)

    def _module(self, module: str) -> dict[str, Any]:
        options = self.config_entry.options.get(module)
        return dict(options) if isinstance(options, dict) else {}

    def _save(self, **changes: Any) -> ConfigFlowResult:
        return self.async_create_entry(data={**self.config_entry.options, CONF_MODULES: self._modules(), **changes})

    async def async_step_init(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        menu = ["modules", "system"]
        modules = self._modules()
        if MODULE_CONTAINERS in modules:
            menu.append("containers")
        if MODULE_WATCHDOG in modules:
            menu += ["watchdog", "watchdog_add_power_cycle"]
            if self._cycles():
                menu.append("watchdog_remove_power_cycle")
        if MODULE_MARKETPLACE in modules:
            menu.append("marketplace")
        if MODULE_BATTERIES in modules:
            menu += ["batteries", "batteries_types"]
            if await batteries_importer.async_find(self.hass):
                menu.append("batteries_import")
        if MODULE_GIT_SYNC in modules:
            menu += ["git_sync_repository", "git_sync"]
        if MODULE_ORPHANS in modules:
            menu.append("orphans")
        return self.async_show_menu(step_id="init", menu_options=menu)

    async def async_step_system(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        """The System tab's thresholds: orange from the first value, red from the second."""
        errors: dict[str, str] = {}
        if user_input is not None:
            values = {key: int(value) for key, value in user_input.items()}
            for key in DEFAULT_THRESHOLDS:
                if values[f"{key}_warning"] >= values[f"{key}_critical"]:
                    errors[f"{key}_critical"] = "critical_below_warning"
            if not errors:
                return self._save(**{CONF_SYSTEM: values})
        current = self._module(CONF_SYSTEM)
        fields: dict[Any, Any] = {}
        for key, (warn, crit) in DEFAULT_THRESHOLDS.items():
            unit = "°C" if key == "temperature" else "%"
            number = NumberSelector(
                NumberSelectorConfig(
                    min=1,
                    max=120 if key == "temperature" else 100,
                    step=1,
                    mode=NumberSelectorMode.BOX,
                    unit_of_measurement=unit,
                )
            )
            fields[vol.Required(f"{key}_warning", default=current.get(f"{key}_warning", warn))] = number
            fields[vol.Required(f"{key}_critical", default=current.get(f"{key}_critical", crit))] = number
        schema = vol.Schema(fields)
        if user_input:
            schema = self.add_suggested_values_to_schema(schema, user_input)
        return self.async_show_form(step_id="system", data_schema=schema, errors=errors)

    async def async_step_modules(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        """Turn modules on or off."""
        errors = _modules_errors(self.hass, user_input) if user_input is not None else {}
        if user_input is not None and not errors:
            chosen = _chosen(user_input)
            if MODULE_GIT_SYNC in chosen and not git_sync_configured(self._module(MODULE_GIT_SYNC)):
                # Turned on for the first time: its repository first, saved with the modules.
                self._pending_modules = chosen
                return await self.async_step_git_sync_repository()
            return self._save(**{CONF_MODULES: chosen})
        schema = _modules_schema(self._modules())
        if user_input is not None:
            schema = self.add_suggested_values_to_schema(schema, user_input)
        return self.async_show_form(step_id="modules", data_schema=schema, errors=errors)

    # Containers

    async def async_step_containers(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        """Refresh interval and notifications."""
        if user_input is not None:
            return self._save(**{MODULE_CONTAINERS: containers_flow.settings_options(user_input)})
        schema = containers_flow.settings_schema(self.hass, self._module(MODULE_CONTAINERS))
        return self.async_show_form(step_id="containers", data_schema=schema)

    # Watchdog

    def _cycles(self) -> list[dict[str, Any]]:
        return [dict(c) for c in self._module(MODULE_WATCHDOG).get(CONF_POWER_CYCLES, []) if isinstance(c, dict)]

    def _save_cycles(self, cycles: list[dict[str, Any]]) -> ConfigFlowResult:
        options = {k: v for k, v in self._module(MODULE_WATCHDOG).items() if k != CONF_POWER_CYCLES}
        return self._save(**{MODULE_WATCHDOG: options | ({CONF_POWER_CYCLES: cycles} if cycles else {})})

    async def async_step_watchdog(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        """Interval, grace periods, reload limit, ignored integrations, pause entity and notify actions."""
        errors = watchdog_flow.settings_errors(user_input) if user_input is not None else {}
        if user_input is not None and not errors:
            cycles = self._cycles()
            options = watchdog_flow.settings_options(user_input) | ({CONF_POWER_CYCLES: cycles} if cycles else {})
            return self._save(**{MODULE_WATCHDOG: options})
        schema = await watchdog_flow.settings_schema(self.hass, self._module(MODULE_WATCHDOG))
        if user_input is not None:
            schema = self.add_suggested_values_to_schema(schema, user_input)
        return self.async_show_form(step_id="watchdog", data_schema=schema, errors=errors)

    async def async_step_watchdog_add_power_cycle(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        cycles = self._cycles()
        errors = watchdog_flow.cycle_errors(self.hass, cycles, user_input) if user_input is not None else {}
        if user_input is not None and not errors:
            cycles.append(
                {
                    CONF_DEVICE: user_input[CONF_DEVICE],
                    CONF_SWITCH: user_input[CONF_SWITCH],
                    CONF_DELAY: int(user_input[CONF_DELAY]),
                    CONF_OFF_TIME: int(user_input[CONF_OFF_TIME]),
                }
            )
            return self._save_cycles(cycles)
        schema = watchdog_flow.cycle_schema()
        if user_input is not None:
            schema = self.add_suggested_values_to_schema(schema, user_input)
        return self.async_show_form(step_id="watchdog_add_power_cycle", data_schema=schema, errors=errors)

    async def async_step_watchdog_remove_power_cycle(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        cycles = self._cycles()
        if user_input is not None:
            removed = set(user_input.get(CONF_POWER_CYCLES, []))
            return self._save_cycles([c for c in cycles if c.get(CONF_DEVICE) not in removed])
        devices = dr.async_get(self.hass)
        options = []
        for cycle in cycles:
            device = devices.async_get(cycle.get(CONF_DEVICE, ""))
            name = (device.name_by_user or device.name) if device else None
            state = self.hass.states.get(cycle.get(CONF_SWITCH, ""))
            plug = state.name if state else cycle.get(CONF_SWITCH)
            label = (
                f"{name or cycle.get(CONF_DEVICE)} → {plug} ({cycle.get(CONF_DELAY)} min, {cycle.get(CONF_OFF_TIME)} s)"
            )
            options.append(SelectOptionDict(value=cycle.get(CONF_DEVICE, ""), label=label))
        schema = vol.Schema(
            {
                vol.Optional(CONF_POWER_CYCLES, default=[]): SelectSelector(
                    SelectSelectorConfig(options=options, multiple=True, mode=SelectSelectorMode.LIST)
                )
            }
        )
        return self.async_show_form(step_id="watchdog_remove_power_cycle", data_schema=schema)

    # Marketplace

    async def async_step_marketplace(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        """Interval between two automatic checks, and the backup before installing updates."""
        if user_input is not None:
            return self._save(**{MODULE_MARKETPLACE: marketplace_flow.settings_options(user_input)})
        schema = marketplace_flow.settings_schema(self._module(MODULE_MARKETPLACE))
        return self.async_show_form(step_id="marketplace", data_schema=schema)

    # Batteries

    async def async_step_batteries(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        """Threshold, duration, notification times and actions, batteries left out."""
        if user_input is not None:
            # The battery types are set in their own step: kept here
            settings = {**self._module(MODULE_BATTERIES), **batteries_flow.settings_options(user_input)}
            return self._save(**{MODULE_BATTERIES: settings})
        schema = await batteries_flow.settings_schema(self.hass, self._module(MODULE_BATTERIES))
        return self.async_show_form(step_id="batteries", data_schema=schema)

    async def async_step_batteries_types(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        """The battery types set by hand (unticked: removed), and one more for a battery or its whole model."""
        current = self._module(MODULE_BATTERIES)
        errors: dict[str, str] = {}
        if user_input is not None:
            types, models, errors = batteries_flow.types_options(self.hass, current, user_input)
            if not errors:
                return self._save(
                    **{MODULE_BATTERIES: {**current, CONF_BATTERY_TYPES: types, CONF_BATTERY_MODELS: models}}
                )
        schema = batteries_flow.types_schema(self.hass, current)
        if user_input:
            schema = self.add_suggested_values_to_schema(schema, user_input)
        return self.async_show_form(step_id="batteries_types", data_schema=schema, errors=errors)

    async def async_step_batteries_import(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        """Battery Monitor's settings, the battery types of its cards and its spare batteries, brought in."""
        found = await batteries_importer.async_find(self.hass)
        if not found:
            return self.async_abort(reason="nothing_to_import")
        if user_input is not None:
            data = getattr(self.config_entry, "runtime_data", None)
            monitor = data.batteries if data is not None else None
            if monitor is not None:
                for kind, count in found.stock.items():
                    monitor.async_set_stock(kind, count)
                await monitor.async_save()
            return self._save(**{MODULE_BATTERIES: batteries_importer.merged(self._module(MODULE_BATTERIES), found)})
        return self.async_show_form(
            step_id="batteries_import",
            data_schema=vol.Schema({}),
            description_placeholders={
                "settings": str(len(found.settings)),
                "types": str(len(found.battery_types) + len(found.battery_models)),
                "stock": str(len(found.stock)),
            },
        )

    # Git Sync

    async def async_step_git_sync_repository(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        """Path, remote, branch, SSH key and commit author, checked before they are saved."""
        current = self._module(MODULE_GIT_SYNC)
        errors: dict[str, str] = {}
        if user_input is not None:
            errors = await _repository_errors(user_input)
            if not errors:
                settings = (current or git_sync_flow.default_options(self.hass)) | user_input
                modules = self._pending_modules or self._modules()
                return self._save(**{CONF_MODULES: modules, MODULE_GIT_SYNC: settings})
        return self.async_show_form(
            step_id="git_sync_repository",
            data_schema=git_sync_flow.repository_schema(user_input or current),
            errors=errors,
        )

    async def async_step_git_sync(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        """Commit message, schedules, notifications and dashboard export."""
        current = self._module(MODULE_GIT_SYNC)
        errors: dict[str, str] = {}
        if user_input is not None:
            errors = await git_sync_flow.options_errors(self.hass, user_input)
            if not errors:
                return self._save(**{MODULE_GIT_SYNC: current | user_input})
        schema = git_sync_flow.options_schema(self.hass, current)
        return self.async_show_form(
            step_id="git_sync",
            data_schema=self.add_suggested_values_to_schema(schema, user_input) if user_input else schema,
            errors=errors,
        )

    # Orphans

    async def async_step_orphans(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        """Scan interval, grace period after a start, stale entities, integrations and entities ignored."""
        if user_input is not None:
            return self._save(**{MODULE_ORPHANS: orphans_flow.settings_options(user_input)})
        schema = await orphans_flow.settings_schema(self.hass, self._module(MODULE_ORPHANS))
        return self.async_show_form(step_id="orphans", data_schema=schema)
