"""Config flow for System Hub: a single entry."""

from __future__ import annotations

from typing import Any

from homeassistant.config_entries import ConfigFlow, ConfigFlowResult

from .const import DOMAIN


class SystemHubConfigFlow(ConfigFlow, domain=DOMAIN):
    """Creates the single System Hub entry."""

    VERSION = 1

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        """Confirm, then create the entry."""
        if user_input is not None:
            return self.async_create_entry(title="System Hub", data={})
        return self.async_show_form(step_id="user")
