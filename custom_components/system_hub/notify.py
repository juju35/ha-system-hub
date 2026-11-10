"""Notify actions shared by the modules: the choices offered in the options, and sending to them."""

from __future__ import annotations

import logging

from homeassistant.core import HomeAssistant

_LOGGER = logging.getLogger(__name__)


def notify_choices(hass: HomeAssistant, current: list[str]) -> list[str]:
    """The notify actions to offer (`notify.…`), the ones already chosen kept even when gone since."""
    return sorted(
        {f"notify.{name}" for name in hass.services.async_services_for_domain("notify")}
        - {"notify.send_message", "notify.persistent_notification"}
        | set(current)
    )


async def async_send_notify(hass: HomeAssistant, services: list[str], title: str, message: str) -> None:
    """Send to every notify action chosen; a missing or broken one is logged and skipped."""
    for service in services:
        name = service.removeprefix("notify.")
        if not hass.services.has_service("notify", name):
            _LOGGER.warning("Notify action notify.%s not found", name)
            continue
        try:
            await hass.services.async_call("notify", name, {"title": title, "message": message}, blocking=True)
        except Exception:  # noqa: BLE001 - a broken notifier must not stop the others
            _LOGGER.exception("Sending the notification with notify.%s failed", name)
