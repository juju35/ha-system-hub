"""Repairs: "Try again" on an integration the Watchdog module gave up on."""

from __future__ import annotations

from typing import Any

from homeassistant import data_entry_flow
from homeassistant.components.repairs import RepairsFlow
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import issue_registry as ir

from . import loaded_watchdog
from .const import DOMAIN
from .watchdog.const import ATTR_ENTRY_ID


class GaveUpRepairFlow(RepairsFlow):
    """Confirm, then start over for the integration and reload it now."""

    def __init__(self, entry_id: str) -> None:
        self._entry_id = entry_id

    async def async_step_init(self, user_input: dict[str, str] | None = None) -> data_entry_flow.FlowResult:
        return await self.async_step_confirm()

    async def async_step_confirm(self, user_input: dict[str, str] | None = None) -> data_entry_flow.FlowResult:
        if user_input is None:
            issue = ir.async_get(self.hass).async_get_issue(DOMAIN, self.issue_id)
            return self.async_show_form(
                step_id="confirm", description_placeholders=issue.translation_placeholders if issue else None
            )
        try:
            watchdog = loaded_watchdog(self.hass)
        except HomeAssistantError:
            return self.async_abort(reason="not_loaded")
        # In the background: the reset waits for a check still running, and the reload itself may take minutes.
        # The flow closes at once, telling that the reload was started; the reset deletes the issue (and the
        # notification) and starts over even when the reload fails, which is logged.
        self.hass.async_create_background_task(watchdog.async_reset(self._entry_id), f"{DOMAIN} reset {self._entry_id}")
        entry = self.hass.config_entries.async_get_entry(self._entry_id)
        return self.async_abort(
            reason="reload_started", description_placeholders={"title": entry.title if entry else self._entry_id}
        )


async def async_create_fix_flow(hass: HomeAssistant, issue_id: str, data: dict[str, Any] | None) -> RepairsFlow:
    return GaveUpRepairFlow((data or {}).get(ATTR_ENTRY_ID) or issue_id.removeprefix("watchdog_gave_up_"))
