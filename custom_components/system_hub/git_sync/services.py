"""Actions of the Git Sync module, for administrators only (the diff can show secrets.yaml).

Every action takes an optional `repository`: the path of one of the module's repositories (or its id). Without it,
commit and push, pull and the dashboard export run on every repository, the others on the first one. The response
keeps the first repository's fields at its top; with several repositories, `results` lists each one's, with its path.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any

import voluptuous as vol
from homeassistant.core import HomeAssistant, ServiceCall, ServiceResponse, SupportsResponse
from homeassistant.exceptions import ServiceValidationError
from homeassistant.helpers import config_validation as cv

from ..admin import admin_only
from ..const import DOMAIN
from .const import (
    ATTR_MESSAGE,
    ATTR_REPOSITORY,
    SERVICE_COMMIT_PUSH,
    SERVICE_EXPORT_DASHBOARDS,
    SERVICE_GENERATE_MESSAGE,
    SERVICE_GENERATE_SSH_KEY,
    SERVICE_GET_DIFF,
    SERVICE_PULL,
)
from .coordinator import GitSyncCoordinator

_REPOSITORY = {vol.Optional(ATTR_REPOSITORY): cv.string}
_SCHEMA = vol.Schema(_REPOSITORY)
_COMMIT_SCHEMA = vol.Schema({vol.Optional(ATTR_MESSAGE): cv.string, **_REPOSITORY})


def _path(value: str) -> str:
    return value.strip().rstrip("/") or "/"


def find_repository(coordinators: list[GitSyncCoordinator], value: str) -> GitSyncCoordinator:
    """The repository an action names: by path (a trailing slash allowed) or id; an error naming the known ones."""
    wanted = _path(value)
    for coordinator in coordinators:
        if wanted in (_path(coordinator.repo.path), coordinator.repo_id):
            return coordinator
    raise ServiceValidationError(
        translation_domain=DOMAIN,
        translation_key="unknown_repository",
        translation_placeholders={
            "repository": value,
            "repositories": ", ".join(c.repo.path for c in coordinators),
        },
    )


def async_setup_git_sync_services(hass: HomeAssistant, coordinators: Callable[[], list[GitSyncCoordinator]]) -> None:
    """Register the actions; `coordinators` returns the module's repositories or raises when it is turned off."""

    def targets(call: ServiceCall, every: bool) -> list[GitSyncCoordinator]:
        known = coordinators()
        if repository := call.data.get(ATTR_REPOSITORY):
            return [find_repository(known, repository)]
        return known if every else known[:1]

    def respond(results: list[tuple[GitSyncCoordinator, dict[str, Any]]]) -> ServiceResponse:
        response = dict(results[0][1])
        if len(coordinators()) > 1:
            response["results"] = [{ATTR_REPOSITORY: c.repo.path, **result} for c, result in results]
        return response

    async def run(
        call: ServiceCall, every: bool, action: Callable[[GitSyncCoordinator], Awaitable[dict[str, Any]]]
    ) -> ServiceResponse:
        # One repository after the other: an error stops the action (as for a single repository) and is raised.
        return respond([(coordinator, await action(coordinator)) for coordinator in targets(call, every)])

    async def commit_push(call: ServiceCall) -> ServiceResponse:
        async def one(coordinator: GitSyncCoordinator) -> dict[str, Any]:
            result = await coordinator.async_commit_push(call.data.get(ATTR_MESSAGE))
            return {"committed": result.committed, "pushed": result.pushed, "message": result.message}

        return await run(call, True, one)

    async def export(call: ServiceCall) -> ServiceResponse:
        async def one(coordinator: GitSyncCoordinator) -> dict[str, Any]:
            return {"files": await coordinator.async_export_dashboards()}

        return await run(call, True, one)

    async def pull(call: ServiceCall) -> ServiceResponse:
        async def one(coordinator: GitSyncCoordinator) -> dict[str, Any]:
            return {"pulled": await coordinator.async_pull()}

        return await run(call, True, one)

    async def ssh_key(call: ServiceCall) -> ServiceResponse:
        async def one(coordinator: GitSyncCoordinator) -> dict[str, Any]:
            return {"public_key": await coordinator.async_generate_ssh_key()}

        return await run(call, False, one)

    async def generate_message(call: ServiceCall) -> ServiceResponse:
        async def one(coordinator: GitSyncCoordinator) -> dict[str, Any]:
            return {"message": await coordinator.async_generate_message()}

        return await run(call, False, one)

    async def get_diff(call: ServiceCall) -> ServiceResponse:
        async def one(coordinator: GitSyncCoordinator) -> dict[str, Any]:
            return (await coordinator.async_get_diff()).as_dict()

        return await run(call, False, one)

    for service, handler, schema, response in (
        (SERVICE_GENERATE_MESSAGE, generate_message, _SCHEMA, SupportsResponse.ONLY),
        (SERVICE_GET_DIFF, get_diff, _SCHEMA, SupportsResponse.ONLY),
        (SERVICE_COMMIT_PUSH, commit_push, _COMMIT_SCHEMA, SupportsResponse.OPTIONAL),
        (SERVICE_EXPORT_DASHBOARDS, export, _SCHEMA, SupportsResponse.OPTIONAL),
        (SERVICE_PULL, pull, _SCHEMA, SupportsResponse.OPTIONAL),
        (SERVICE_GENERATE_SSH_KEY, ssh_key, _SCHEMA, SupportsResponse.ONLY),
    ):
        hass.services.async_register(
            DOMAIN, service, admin_only(hass, handler), schema=schema, supports_response=response
        )
