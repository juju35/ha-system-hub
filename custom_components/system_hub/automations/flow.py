"""Settings of the Automations module: devices and entities left out, as the Automation Monitor card's options."""

from __future__ import annotations

from typing import Any

import voluptuous as vol
from homeassistant.helpers.selector import (
    DeviceSelector,
    DeviceSelectorConfig,
    TextSelector,
    TextSelectorConfig,
)

from . import CONF_EXCLUDE_DEVICES, CONF_EXCLUDE_ENTITIES, _values


def settings_schema(current: dict[str, Any]) -> vol.Schema:
    # Lists that can be emptied: a suggested value, not a default that would come back once emptied.
    return vol.Schema(
        {
            vol.Optional(
                CONF_EXCLUDE_DEVICES, description={"suggested_value": _values(current.get(CONF_EXCLUDE_DEVICES))}
            ): DeviceSelector(DeviceSelectorConfig(multiple=True)),
            vol.Optional(
                CONF_EXCLUDE_ENTITIES, description={"suggested_value": _values(current.get(CONF_EXCLUDE_ENTITIES))}
            ): TextSelector(TextSelectorConfig(multiple=True)),
        }
    )


def settings_options(user_input: dict[str, Any]) -> dict[str, Any]:
    return {
        CONF_EXCLUDE_DEVICES: _values(user_input.get(CONF_EXCLUDE_DEVICES)),
        CONF_EXCLUDE_ENTITIES: _values(user_input.get(CONF_EXCLUDE_ENTITIES)),
    }
