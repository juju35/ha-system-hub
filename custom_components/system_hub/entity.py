"""Base entity: one service device per module, entities refreshed when their module changes."""

from __future__ import annotations

from collections.abc import Callable
from typing import Protocol

from homeassistant.helpers.device_registry import DeviceEntryType, DeviceInfo
from homeassistant.helpers.entity import Entity

from .const import DOMAIN, PANEL_PATH


class Listenable(Protocol):
    def async_add_listener(self, update: Callable[[], None]) -> Callable[[], None]: ...


def unique_id(entry_id: str, module: str, key: str) -> str:
    return f"{entry_id}_{module}_{key}"


class SystemHubEntity(Entity):
    """Device of the module, translation key and unique id prefixed with the module's name."""

    _attr_has_entity_name = True
    _attr_should_poll = False

    def __init__(self, source: Listenable, entry_id: str, module: str, key: str) -> None:
        self._source = source
        self._attr_translation_key = f"{module}_{key}"
        self._attr_unique_id = unique_id(entry_id, module, key)
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, f"{entry_id}_{module}")},
            # Its name translated (device.<module>.name): Sentinel, Updates, Versioning, Cleanup…
            translation_key=module,
            manufacturer="juju35",
            entry_type=DeviceEntryType.SERVICE,
            # "Visit" on the device page: the panel's Settings tab
            configuration_url=f"homeassistant://{PANEL_PATH}/settings",
        )

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(self._source.async_add_listener(self.async_write_ha_state))
