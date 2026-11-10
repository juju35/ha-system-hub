"""Repairs: "Try again" on an integration the Watchdog gave up on; the missing .gitignore lines of Git Sync."""

from __future__ import annotations

from typing import Any

import voluptuous as vol
from homeassistant import data_entry_flow
from homeassistant.components.repairs import RepairsFlow
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResult
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import issue_registry as ir

from . import loaded_git_sync, loaded_watchdog
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


class GitignoreFixFlow(RepairsFlow):
    """Show the lines to add, append them once an admin confirms (repairs are admin only)."""

    async def async_step_init(self, user_input: dict[str, Any] | None = None) -> FlowResult:
        """Start with the confirmation."""
        return await self.async_step_confirm()

    async def async_step_confirm(self, user_input: dict[str, Any] | None = None) -> FlowResult:
        """Append the lines on submit."""
        try:
            coordinator = loaded_git_sync(self.hass)
        except HomeAssistantError:
            return self.async_abort(reason="not_loaded")
        if user_input is not None:
            await coordinator.async_fix_gitignore()
            return self.async_create_entry(data={})
        issue = ir.async_get(self.hass).async_get_issue(DOMAIN, self.issue_id)
        return self.async_show_form(
            step_id="confirm",
            data_schema=vol.Schema({}),
            description_placeholders=issue.translation_placeholders if issue else None,
        )


async def async_create_fix_flow(hass: HomeAssistant, issue_id: str, data: dict[str, Any] | None) -> RepairsFlow:
    if issue_id.startswith("git_sync_"):
        return GitignoreFixFlow()
    return GaveUpRepairFlow((data or {}).get(ATTR_ENTRY_ID) or issue_id.removeprefix("watchdog_gave_up_"))
