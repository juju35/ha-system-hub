"""Actions of the Git Sync module, for administrators only (the diff can show secrets.yaml)."""

from __future__ import annotations

from collections.abc import Callable

import voluptuous as vol
from homeassistant.core import HomeAssistant, ServiceCall, ServiceResponse, SupportsResponse
from homeassistant.helpers import config_validation as cv

from ..admin import admin_only
from ..const import DOMAIN
from .const import (
    ATTR_MESSAGE,
    SERVICE_COMMIT_PUSH,
    SERVICE_EXPORT_DASHBOARDS,
    SERVICE_GENERATE_MESSAGE,
    SERVICE_GENERATE_SSH_KEY,
    SERVICE_GET_DIFF,
    SERVICE_PULL,
)
from .coordinator import GitSyncCoordinator

_EMPTY_SCHEMA = vol.Schema({})
_COMMIT_SCHEMA = vol.Schema({vol.Optional(ATTR_MESSAGE): cv.string})


def async_setup_git_sync_services(hass: HomeAssistant, coordinator: Callable[[], GitSyncCoordinator]) -> None:
    """Register the actions; `coordinator` returns the module's coordinator or raises when it is turned off."""

    async def commit_push(call: ServiceCall) -> ServiceResponse:
        result = await coordinator().async_commit_push(call.data.get(ATTR_MESSAGE))
        return {"committed": result.committed, "pushed": result.pushed, "message": result.message}

    async def export(_call: ServiceCall) -> ServiceResponse:
        return {"files": await coordinator().async_export_dashboards()}

    async def pull(_call: ServiceCall) -> ServiceResponse:
        return {"pulled": await coordinator().async_pull()}

    async def ssh_key(_call: ServiceCall) -> ServiceResponse:
        return {"public_key": await coordinator().async_generate_ssh_key()}

    async def generate_message(_call: ServiceCall) -> ServiceResponse:
        return {"message": await coordinator().async_generate_message()}

    async def get_diff(_call: ServiceCall) -> ServiceResponse:
        return (await coordinator().async_get_diff()).as_dict()

    for service, handler, schema, response in (
        (SERVICE_GENERATE_MESSAGE, generate_message, _EMPTY_SCHEMA, SupportsResponse.ONLY),
        (SERVICE_GET_DIFF, get_diff, _EMPTY_SCHEMA, SupportsResponse.ONLY),
        (SERVICE_COMMIT_PUSH, commit_push, _COMMIT_SCHEMA, SupportsResponse.OPTIONAL),
        (SERVICE_EXPORT_DASHBOARDS, export, _EMPTY_SCHEMA, SupportsResponse.OPTIONAL),
        (SERVICE_PULL, pull, _EMPTY_SCHEMA, SupportsResponse.OPTIONAL),
        (SERVICE_GENERATE_SSH_KEY, ssh_key, _EMPTY_SCHEMA, SupportsResponse.ONLY),
    ):
        hass.services.async_register(
            DOMAIN, service, admin_only(hass, handler), schema=schema, supports_response=response
        )
