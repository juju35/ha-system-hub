"""Settings of the Logs module: the errors that make a problem, the messages ignored."""

from __future__ import annotations

from typing import Any

import voluptuous as vol
from homeassistant.helpers.selector import (
    NumberSelector,
    NumberSelectorConfig,
    NumberSelectorMode,
    SelectSelector,
    SelectSelectorConfig,
    SelectSelectorMode,
)

from . import CONF_ERROR_THRESHOLD, CONF_IGNORED_MESSAGES, settings


def settings_schema(current: dict[str, Any]) -> vol.Schema:
    chosen = settings(current)
    return vol.Schema(
        {
            vol.Required(CONF_ERROR_THRESHOLD, default=chosen[CONF_ERROR_THRESHOLD]): NumberSelector(
                NumberSelectorConfig(min=1, max=1000, step=1, mode=NumberSelectorMode.BOX)
            ),
            # The messages ignored from the panel, to bring one back: a list that can be emptied
            vol.Optional(
                CONF_IGNORED_MESSAGES, description={"suggested_value": chosen[CONF_IGNORED_MESSAGES]}
            ): SelectSelector(
                SelectSelectorConfig(
                    options=chosen[CONF_IGNORED_MESSAGES],
                    multiple=True,
                    custom_value=True,
                    mode=SelectSelectorMode.DROPDOWN,
                )
            ),
        }
    )


def settings_options(user_input: dict[str, Any]) -> dict[str, Any]:
    return {
        CONF_ERROR_THRESHOLD: int(user_input[CONF_ERROR_THRESHOLD]),
        CONF_IGNORED_MESSAGES: [str(m) for m in user_input.get(CONF_IGNORED_MESSAGES) or [] if str(m).strip()],
    }
