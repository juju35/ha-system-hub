"""Settings of the Database module: the size from which the Status tab warns."""

from __future__ import annotations

from typing import Any

import voluptuous as vol
from homeassistant.helpers.selector import NumberSelector, NumberSelectorConfig, NumberSelectorMode

from . import CONF_MAX_SIZE, settings


def settings_schema(current: dict[str, Any]) -> vol.Schema:
    chosen = settings(current)
    return vol.Schema(
        {
            vol.Required(CONF_MAX_SIZE, default=chosen[CONF_MAX_SIZE]): NumberSelector(
                NumberSelectorConfig(min=0.1, max=500, step=0.1, mode=NumberSelectorMode.BOX, unit_of_measurement="GiB")
            )
        }
    )


def settings_options(user_input: dict[str, Any]) -> dict[str, Any]:
    return {CONF_MAX_SIZE: float(user_input[CONF_MAX_SIZE])}
