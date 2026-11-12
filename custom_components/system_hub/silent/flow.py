"""Settings of the Silent devices module: the integrations followed, the hours of silence, the devices ignored."""

from __future__ import annotations

from typing import Any

import voluptuous as vol
from homeassistant.core import HomeAssistant
from homeassistant.helpers.selector import (
    DeviceSelector,
    DeviceSelectorConfig,
    NumberSelector,
    NumberSelectorConfig,
    NumberSelectorMode,
    SelectSelector,
    SelectSelectorConfig,
    SelectSelectorMode,
)

from . import (
    CONF_BATTERY_HOURS,
    CONF_IGNORED_DEVICES,
    CONF_INTEGRATIONS,
    CONF_MAINS_HOURS,
    DEFAULT_INTEGRATIONS,
    settings,
)


def _hours() -> Any:
    return NumberSelector(
        NumberSelectorConfig(min=1, max=720, step=1, mode=NumberSelectorMode.BOX, unit_of_measurement="h")
    )


def settings_schema(hass: HomeAssistant, current: dict[str, Any]) -> vol.Schema:
    chosen = settings(current)
    # The radio integrations, and any other one already chosen or set up with devices
    choices = sorted({*DEFAULT_INTEGRATIONS, *chosen[CONF_INTEGRATIONS]})
    return vol.Schema(
        {
            vol.Required(CONF_INTEGRATIONS, default=chosen[CONF_INTEGRATIONS]): SelectSelector(
                SelectSelectorConfig(
                    options=choices, multiple=True, custom_value=True, mode=SelectSelectorMode.DROPDOWN
                )
            ),
            vol.Required(CONF_BATTERY_HOURS, default=chosen[CONF_BATTERY_HOURS]): _hours(),
            vol.Required(CONF_MAINS_HOURS, default=chosen[CONF_MAINS_HOURS]): _hours(),
            # A list that can be emptied: a suggested value, not a default that would come back once emptied
            vol.Optional(
                CONF_IGNORED_DEVICES, description={"suggested_value": chosen[CONF_IGNORED_DEVICES]}
            ): DeviceSelector(DeviceSelectorConfig(multiple=True)),
        }
    )


def settings_options(user_input: dict[str, Any]) -> dict[str, Any]:
    return {
        CONF_INTEGRATIONS: [str(i).strip() for i in user_input.get(CONF_INTEGRATIONS) or [] if str(i).strip()]
        or list(DEFAULT_INTEGRATIONS),
        CONF_BATTERY_HOURS: int(user_input[CONF_BATTERY_HOURS]),
        CONF_MAINS_HOURS: int(user_input[CONF_MAINS_HOURS]),
        CONF_IGNORED_DEVICES: [str(d) for d in user_input.get(CONF_IGNORED_DEVICES) or []],
    }
