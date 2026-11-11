"""Settings of the Containers module: refresh interval, notifications and the processes that may be stopped."""

from __future__ import annotations

from typing import Any

import voluptuous as vol
from homeassistant.core import HomeAssistant
from homeassistant.helpers.selector import (
    BooleanSelector,
    EntitySelector,
    EntitySelectorConfig,
    NumberSelector,
    NumberSelectorConfig,
    NumberSelectorMode,
    SelectSelector,
    SelectSelectorConfig,
    SelectSelectorMode,
)

from ..const import CONF_STOPPABLE_PROCESSES, CONF_SYSTEM, MODULE_CONTAINERS
from ..notify import notify_choices
from .const import (
    CONF_NOTIFY,
    CONF_NOTIFY_SERVICES,
    CONF_SCAN_INTERVAL,
    DEFAULT_SCAN_INTERVAL,
    MAX_SCAN_INTERVAL,
    MIN_SCAN_INTERVAL,
)


def stoppable_processes(options: Any) -> set[str]:
    """The processes that may be stopped: chosen in the Containers & process settings (in the System settings in 1.0.3,
    read until saved there)."""
    containers = options.get(MODULE_CONTAINERS) if isinstance(options.get(MODULE_CONTAINERS), dict) else {}
    if CONF_STOPPABLE_PROCESSES in containers:
        return {str(e) for e in containers.get(CONF_STOPPABLE_PROCESSES) or []}
    system = options.get(CONF_SYSTEM) if isinstance(options.get(CONF_SYSTEM), dict) else {}
    return {str(e) for e in system.get(CONF_STOPPABLE_PROCESSES) or []}


def settings_schema(hass: HomeAssistant, current: dict[str, Any], stoppable: set[str] | None = None) -> vol.Schema:
    services: list[str] = list(current.get(CONF_NOTIFY_SERVICES, []))
    options = notify_choices(hass, services)
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
            # The processes System Monitor watches that may be stopped: no stopped status, no alert for them
            vol.Optional(CONF_STOPPABLE_PROCESSES, default=sorted(stoppable or [])): EntitySelector(
                EntitySelectorConfig(domain="binary_sensor", integration="systemmonitor", multiple=True)
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
        CONF_STOPPABLE_PROCESSES: list(user_input.get(CONF_STOPPABLE_PROCESSES) or []),
    }
