"""Settings of the Containers module: refresh interval and notifications."""

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

from .const import (
    CONF_NOTIFY,
    CONF_NOTIFY_SERVICES,
    CONF_SCAN_INTERVAL,
    DEFAULT_SCAN_INTERVAL,
    MAX_SCAN_INTERVAL,
    MIN_SCAN_INTERVAL,
)


def settings_schema(hass: HomeAssistant, current: dict[str, Any]) -> vol.Schema:
    services: list[str] = list(current.get(CONF_NOTIFY_SERVICES, []))
    options = sorted(
        {f"notify.{name}" for name in hass.services.async_services_for_domain("notify")}
        - {"notify.send_message", "notify.persistent_notification"}
        | set(services)
    )
    return vol.Schema(
        {
            vol.Required(
                CONF_SCAN_INTERVAL, default=int(current.get(CONF_SCAN_INTERVAL, DEFAULT_SCAN_INTERVAL))
            ): NumberSelector(
                NumberSelectorConfig(
                    min=MIN_SCAN_INTERVAL,
                    max=MAX_SCAN_INTERVAL,
                    step=1,
                    mode=NumberSelectorMode.BOX,
                    unit_of_measurement="s",
                )
            ),
            vol.Required(CONF_NOTIFY, default=bool(current.get(CONF_NOTIFY, True))): BooleanSelector(),
            vol.Optional(CONF_NOTIFY_SERVICES, default=services): SelectSelector(
                SelectSelectorConfig(
                    options=options, multiple=True, custom_value=True, mode=SelectSelectorMode.DROPDOWN
                )
            ),
        }
    )


def settings_options(user_input: dict[str, Any]) -> dict[str, Any]:
    return {
        CONF_SCAN_INTERVAL: int(user_input[CONF_SCAN_INTERVAL]),
        CONF_NOTIFY: bool(user_input.get(CONF_NOTIFY, True)),
        CONF_NOTIFY_SERVICES: sorted(
            {
                f"notify.{n.strip().removeprefix('notify.')}"
                for n in user_input.get(CONF_NOTIFY_SERVICES, [])
                if n.strip()
            }
        ),
    }
