"""Config flow for System Hub: a single entry; the options choose the modules and set each one."""

from __future__ import annotations

from typing import Any

import voluptuous as vol
from homeassistant.config_entries import ConfigEntry, ConfigFlow, ConfigFlowResult, OptionsFlow
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers.selector import (
    BooleanSelector,
    SelectOptionDict,
    SelectSelector,
    SelectSelectorConfig,
    SelectSelectorMode,
)

from .const import (
    CONF_MODULES,
    DOMAIN,
    MARKETPLACE_DOMAIN,
    MODULE_CONTAINERS,
    MODULE_MARKETPLACE,
    MODULE_WATCHDOG,
    MODULES,
)
from .containers import flow as containers_flow
from .containers.monitor import supervisor_available
from .marketplace import flow as marketplace_flow
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
    ]


def _chosen(user_input: dict[str, Any]) -> list[str]:
    return [module for module in MODULES if user_input.get(module)]


class SystemHubConfigFlow(ConfigFlow, domain=DOMAIN):
    """Creates the single System Hub entry with the modules chosen."""

    VERSION = 1

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        """Choose the modules; each one keeps its default settings until changed in the options."""
        errors = _modules_errors(self.hass, user_input) if user_input is not None else {}
        if user_input is not None and not errors:
            return self.async_create_entry(title="System Hub", data={}, options={CONF_MODULES: _chosen(user_input)})
        schema = _modules_schema(_available(self.hass))
        if user_input is not None:
            schema = self.add_suggested_values_to_schema(schema, user_input)
        return self.async_show_form(step_id="user", data_schema=schema, errors=errors)

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: ConfigEntry) -> OptionsFlow:
        return SystemHubOptionsFlow()


class SystemHubOptionsFlow(OptionsFlow):
    """The modules turned on, then the settings of each one; a module turned off keeps its settings."""

    def _modules(self) -> list[str]:
        modules = self.config_entry.options.get(CONF_MODULES)
        return [m for m in MODULES if m in modules] if isinstance(modules, list) else list(MODULES)

    def _module(self, module: str) -> dict[str, Any]:
        options = self.config_entry.options.get(module)
        return dict(options) if isinstance(options, dict) else {}

    def _save(self, **changes: Any) -> ConfigFlowResult:
        return self.async_create_entry(data={**self.config_entry.options, CONF_MODULES: self._modules(), **changes})

    async def async_step_init(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        menu = ["modules"]
        modules = self._modules()
        if MODULE_CONTAINERS in modules:
            menu.append("containers")
        if MODULE_WATCHDOG in modules:
            menu += ["watchdog", "watchdog_add_power_cycle"]
            if self._cycles():
                menu.append("watchdog_remove_power_cycle")
        if MODULE_MARKETPLACE in modules:
            menu.append("marketplace")
        return self.async_show_menu(step_id="init", menu_options=menu)

    async def async_step_modules(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        """Turn modules on or off."""
        errors = _modules_errors(self.hass, user_input) if user_input is not None else {}
        if user_input is not None and not errors:
            return self._save(**{CONF_MODULES: _chosen(user_input)})
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
