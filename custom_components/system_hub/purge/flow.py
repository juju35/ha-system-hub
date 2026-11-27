"""Settings of the Purge module: the folders purged and the age of the files deleted."""

from __future__ import annotations

from typing import Any

import voluptuous as vol
from homeassistant.core import HomeAssistant
from homeassistant.helpers.selector import (
    NumberSelector,
    NumberSelectorConfig,
    NumberSelectorMode,
    SelectSelector,
    SelectSelectorConfig,
    SelectSelectorMode,
)

from . import CONF_DIRECTORIES, CONF_MAX_AGE, MAX_AGE_LIMIT, resolve, settings


def settings_schema(current: dict[str, Any]) -> vol.Schema:
    chosen = settings(current)
    return vol.Schema(
        {
            # A list that can be emptied (nothing purged), each folder typed in
            vol.Optional(CONF_DIRECTORIES, description={"suggested_value": chosen[CONF_DIRECTORIES]}): SelectSelector(
                SelectSelectorConfig(
                    options=chosen[CONF_DIRECTORIES],
                    multiple=True,
                    custom_value=True,
                    mode=SelectSelectorMode.DROPDOWN,
                )
            ),
            vol.Required(CONF_MAX_AGE, default=chosen[CONF_MAX_AGE]): NumberSelector(
                NumberSelectorConfig(
                    min=1, max=MAX_AGE_LIMIT, step=1, mode=NumberSelectorMode.BOX, unit_of_measurement="d"
                )
            ),
        }
    )


def settings_options(user_input: dict[str, Any]) -> dict[str, Any]:
    directories = [str(d).strip().rstrip("/") or "/" for d in user_input.get(CONF_DIRECTORIES) or [] if str(d).strip()]
    return {CONF_DIRECTORIES: list(dict.fromkeys(directories)), CONF_MAX_AGE: int(user_input[CONF_MAX_AGE])}


async def async_refused(hass: HomeAssistant, options: dict[str, Any]) -> list[str]:
    """The folders that may not be purged: the configuration folder, a protected one, one not allowed."""

    def _refused() -> list[str]:
        config_dir = hass.config.config_dir
        return [
            d for d in options[CONF_DIRECTORIES] if resolve(config_dir, d, hass.config.is_allowed_path)[1] is not None
        ]

    return await hass.async_add_executor_job(_refused)
