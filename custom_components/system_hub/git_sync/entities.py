"""Entities of the Git Sync module: status, changed files, last commit, push and export, branch; commit and export."""

from __future__ import annotations

from collections.abc import Awaitable, Callable, Mapping
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from homeassistant.components.button import ButtonEntity, ButtonEntityDescription
from homeassistant.components.sensor import (
    SensorDeviceClass,
    SensorEntity,
    SensorEntityDescription,
    SensorStateClass,
)
from homeassistant.const import EntityCategory
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.util import dt as dt_util

from ..const import DOMAIN, MODULE_GIT_SYNC
from ..entity import DEVICE_NAMES, SystemHubEntity, unique_id
from .const import STATUSES
from .coordinator import GitSyncCoordinator, GitSyncData
from .git import truncate_files


def device_key(entry_id: str, repo_id: str = "") -> str:
    """The identifier of a repository's device: the module's device for the first one."""
    return f"{entry_id}_{MODULE_GIT_SYNC}" + (f"_{repo_id}" if repo_id else "")


class GitSyncEntity(SystemHubEntity):
    """An entity of the Git Sync module: unavailable while the repository can't be read."""

    def __init__(self, coordinator: GitSyncCoordinator, entry_id: str, key: str) -> None:
        super().__init__(coordinator, entry_id, MODULE_GIT_SYNC, key)
        self.coordinator = coordinator
        if repo_id := coordinator.repo_id:
            # A further repository: its own device ("System Hub Git Sync (folder)") and unique ids, the same
            # translation keys as the first one's entities.
            self._attr_unique_id = unique_id(entry_id, f"{MODULE_GIT_SYNC}_{repo_id}", key)
            self._attr_device_info = DeviceInfo(
                identifiers={(DOMAIN, device_key(entry_id, repo_id))},
                name=f"{DEVICE_NAMES[MODULE_GIT_SYNC]} ({coordinator.title})",
                manufacturer=self._attr_device_info["manufacturer"],
                entry_type=self._attr_device_info["entry_type"],
                configuration_url=self._attr_device_info["configuration_url"],
            )

    @property
    def available(self) -> bool:
        return self.coordinator.last_update_success


def _status_attrs(data: GitSyncData) -> dict[str, Any]:
    return {
        "repository": data.repository,
        "branch": data.git.branch,
        "upstream": data.git.upstream,
        "remote_url": data.remote_url,
        "ahead": data.git.ahead,
        "behind": data.git.behind,
        "changed_count": len(data.git.files),
        "changed_files": truncate_files(data.git.files),
        "last_error": data.last_error,
        "ai_task": data.ai_task,
    }


def _last_commit(data: GitSyncData) -> datetime | None:
    return dt_util.utc_from_timestamp(data.head.timestamp) if data.head else None


def _last_commit_attrs(data: GitSyncData) -> dict[str, Any]:
    head = data.head
    return {
        "message": head.message if head else None,
        "sha": head.sha if head else None,
        "short_sha": head.sha[:7] if head else None,
    }


@dataclass(frozen=True, kw_only=True)
class GitSyncSensorDescription(SensorEntityDescription):
    """Describe a Git Sync sensor."""

    value_fn: Callable[[GitSyncData], Any]
    attrs_fn: Callable[[GitSyncData], Mapping[str, Any]] | None = None


SENSORS: tuple[GitSyncSensorDescription, ...] = (
    GitSyncSensorDescription(
        key="status",
        device_class=SensorDeviceClass.ENUM,
        options=STATUSES,
        value_fn=lambda data: data.status,
        attrs_fn=_status_attrs,
    ),
    GitSyncSensorDescription(
        key="changed_files",
        state_class=SensorStateClass.MEASUREMENT,
        value_fn=lambda data: len(data.git.files),
    ),
    GitSyncSensorDescription(
        key="last_commit",
        device_class=SensorDeviceClass.TIMESTAMP,
        value_fn=_last_commit,
        attrs_fn=_last_commit_attrs,
    ),
    GitSyncSensorDescription(
        key="last_push",
        device_class=SensorDeviceClass.TIMESTAMP,
        value_fn=lambda data: data.last_push,
        attrs_fn=lambda data: {"message": data.last_push_message},
    ),
    GitSyncSensorDescription(
        key="last_export",
        device_class=SensorDeviceClass.TIMESTAMP,
        value_fn=lambda data: data.last_export,
        attrs_fn=lambda data: {"files": data.last_export_files},
    ),
    GitSyncSensorDescription(
        key="branch",
        entity_category=EntityCategory.DIAGNOSTIC,
        value_fn=lambda data: data.git.branch,
        attrs_fn=lambda data: {"remote_url": data.remote_url, "upstream": data.git.upstream},
    ),
)


class GitSyncSensor(GitSyncEntity, SensorEntity):
    """A sensor reading from the coordinator snapshot."""

    entity_description: GitSyncSensorDescription

    def __init__(self, coordinator: GitSyncCoordinator, entry_id: str, description: GitSyncSensorDescription) -> None:
        """Initialise the sensor."""
        super().__init__(coordinator, entry_id, description.key)
        self.entity_description = description

    @property
    def native_value(self) -> Any:
        """Return the sensor value."""
        if self.coordinator.data is None:
            return None
        return self.entity_description.value_fn(self.coordinator.data)

    @property
    def extra_state_attributes(self) -> Mapping[str, Any] | None:
        """Return the extra attributes."""
        if self.entity_description.attrs_fn is None or self.coordinator.data is None:
            return None
        return self.entity_description.attrs_fn(self.coordinator.data)


@dataclass(frozen=True, kw_only=True)
class GitSyncButtonDescription(ButtonEntityDescription):
    """Describe a Git Sync button."""

    press_fn: Callable[[GitSyncCoordinator], Awaitable[Any]]


BUTTONS: tuple[GitSyncButtonDescription, ...] = (
    GitSyncButtonDescription(
        key="commit_push",
        press_fn=lambda coordinator: coordinator.async_commit_push(),
    ),
    GitSyncButtonDescription(
        key="export_dashboards",
        press_fn=lambda coordinator: coordinator.async_export_dashboards(),
    ),
)


class GitSyncButton(GitSyncEntity, ButtonEntity):
    """Trigger a commit/push or a dashboard export."""

    entity_description: GitSyncButtonDescription

    def __init__(self, coordinator: GitSyncCoordinator, entry_id: str, description: GitSyncButtonDescription) -> None:
        """Initialise the button."""
        super().__init__(coordinator, entry_id, description.key)
        self.entity_description = description

    async def async_press(self) -> None:
        """Run the action."""
        await self.entity_description.press_fn(self.coordinator)
