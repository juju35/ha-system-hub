"""Settings of the Security module: notifications of refused logins, unused tokens, ignored addresses."""

from __future__ import annotations

from typing import Any

import voluptuous as vol
from homeassistant.core import HomeAssistant
from homeassistant.helpers.selector import (
    BooleanSelector,
    NumberSelector,
    NumberSelectorConfig,
    NumberSelectorMode,
    SelectSelector,
    SelectSelectorConfig,
    SelectSelectorMode,
)

from ..notify import notify_choices
from . import CONF_IGNORED_IPS, CONF_NOTIFY, CONF_NOTIFY_SERVICES, CONF_TOKEN_DAYS, settings


def settings_schema(hass: HomeAssistant, current: dict[str, Any]) -> vol.Schema:
    chosen = settings(current)
    return vol.Schema(
        {
            vol.Required(CONF_NOTIFY, default=chosen[CONF_NOTIFY]): BooleanSelector(),
            vol.Optional(CONF_NOTIFY_SERVICES, default=chosen[CONF_NOTIFY_SERVICES]): SelectSelector(
                SelectSelectorConfig(
                    options=notify_choices(hass, chosen[CONF_NOTIFY_SERVICES]),
                    multiple=True,
                    mode=SelectSelectorMode.DROPDOWN,
                )
            ),
            vol.Required(CONF_TOKEN_DAYS, default=chosen[CONF_TOKEN_DAYS]): NumberSelector(
                NumberSelectorConfig(min=7, max=3650, step=1, mode=NumberSelectorMode.BOX, unit_of_measurement="d")
            ),
            vol.Optional(CONF_IGNORED_IPS, default=chosen[CONF_IGNORED_IPS]): SelectSelector(
                SelectSelectorConfig(options=[], multiple=True, custom_value=True, mode=SelectSelectorMode.DROPDOWN)
            ),
        }
    )


def settings_options(user_input: dict[str, Any]) -> dict[str, Any]:
    return settings(user_input)
