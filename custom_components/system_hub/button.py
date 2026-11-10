"""Buttons of the modules: Watchdog check, Marketplace check, low-battery notification."""

from __future__ import annotations

from homeassistant.components.button import ButtonEntity
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from . import SystemHubConfigEntry
from .git_sync.entities import BUTTONS, GitSyncButton
from .sensor import BatteriesEntity, MarketplaceEntity, WatchdogEntity


async def async_setup_entry(
    hass: HomeAssistant,
    entry: SystemHubConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    data = entry.runtime_data
    entities: list[ButtonEntity] = []
    if data.watchdog is not None:
        entities.append(WatchdogCheckButton(data.watchdog, entry.entry_id, "check"))
    if data.marketplace is not None:
        entities.append(MarketplaceCheckButton(data.marketplace, entry.entry_id, "check_updates"))
    if data.batteries is not None:
        entities.append(BatteriesNotifyButton(data.batteries, entry.entry_id, "notify_now"))
    if data.git_sync is not None:
        entities += [GitSyncButton(data.git_sync, entry.entry_id, description) for description in BUTTONS]
    async_add_entities(entities)


class WatchdogCheckButton(WatchdogEntity, ButtonEntity):
    """Check the integrations now and reload those past the grace period."""

    @property
    def available(self) -> bool:
        return not self.watchdog.running

    async def async_press(self) -> None:
        await self.watchdog.async_check()


class MarketplaceCheckButton(MarketplaceEntity, ButtonEntity):
    """Check every repository installed from the Marketplace for updates."""

    @property
    def available(self) -> bool:
        # Greyed out while a check runs, so it can't be pressed twice, and while updates are installed.
        return not self.refresher.running and not self.refresher.installing_updates

    async def async_press(self) -> None:
        # MarketplaceNotAvailableError is a HomeAssistantError with a translated message.
        self.refresher.async_start()


class BatteriesNotifyButton(BatteriesEntity, ButtonEntity):
    """Every low battery right away, whatever the duration."""

    async def async_press(self) -> None:
        await self.monitor.async_notify(manual=True)
