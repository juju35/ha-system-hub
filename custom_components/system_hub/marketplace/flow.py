"""Settings of the Marketplace module: interval of the automatic check, backup before installing."""

from __future__ import annotations

from typing import Any

import voluptuous as vol
from homeassistant.helpers.selector import BooleanSelector, NumberSelector, NumberSelectorConfig, NumberSelectorMode

from .const import CONF_BACKUP_BEFORE_INSTALL, CONF_SCAN_INTERVAL, DEFAULT_SCAN_INTERVAL, MAX_SCAN_INTERVAL


def settings_schema(current: dict[str, Any]) -> vol.Schema:
    return vol.Schema(
        {
            vol.Required(
                CONF_SCAN_INTERVAL, default=int(current.get(CONF_SCAN_INTERVAL, DEFAULT_SCAN_INTERVAL))
            ): NumberSelector(
                NumberSelectorConfig(
                    min=0, max=MAX_SCAN_INTERVAL, step=1, mode=NumberSelectorMode.BOX, unit_of_measurement="h"
                )
            ),
            vol.Required(
                CONF_BACKUP_BEFORE_INSTALL, default=bool(current.get(CONF_BACKUP_BEFORE_INSTALL, False))
            ): BooleanSelector(),
        }
    )


def settings_options(user_input: dict[str, Any]) -> dict[str, Any]:
    return {
        CONF_SCAN_INTERVAL: int(user_input[CONF_SCAN_INTERVAL]),
        CONF_BACKUP_BEFORE_INSTALL: bool(user_input.get(CONF_BACKUP_BEFORE_INSTALL, False)),
    }
