"""Settings of the Security module: notifications of refused logins, unused tokens, ignored addresses, add-ons allowed
to run unprotected."""

from __future__ import annotations

from typing import Any

import voluptuous as vol
from homeassistant.core import HomeAssistant
from homeassistant.helpers.selector import (
    BooleanSelector,
    NumberSelector,
    NumberSelectorConfig,
    NumberSelectorMode,
    SelectSelector,
    SelectSelectorConfig,
    SelectSelectorMode,
)

from ..notify import notify_choices
from . import CONF_ALLOWED_ADDONS, CONF_IGNORED_IPS, CONF_NOTIFY, CONF_NOTIFY_SERVICES, CONF_TOKEN_DAYS, settings


def settings_schema(
    hass: HomeAssistant, current: dict[str, Any], addons: list[tuple[str, str]] | None = None
) -> vol.Schema:
    """The settings; `addons` the installed add-ons (slug, name), to choose those allowed to run unprotected."""
    chosen = settings(current)
    known = dict(addons or [])
    addon_choices = [
        {"value": slug, "label": known.get(slug, slug)} for slug in sorted({*known, *chosen[CONF_ALLOWED_ADDONS]})
    ]
    return vol.Schema(
        {
            vol.Required(CONF_NOTIFY, default=chosen[CONF_NOTIFY]): BooleanSelector(),
            vol.Optional(CONF_NOTIFY_SERVICES, default=chosen[CONF_NOTIFY_SERVICES]): SelectSelector(
                SelectSelectorConfig(
                    options=notify_choices(hass, chosen[CONF_NOTIFY_SERVICES]),
                    multiple=True,
                    mode=SelectSelectorMode.DROPDOWN,
                )
            ),
            vol.Required(CONF_TOKEN_DAYS, default=chosen[CONF_TOKEN_DAYS]): NumberSelector(
                NumberSelectorConfig(min=7, max=3650, step=1, mode=NumberSelectorMode.BOX, unit_of_measurement="d")
            ),
            vol.Optional(CONF_IGNORED_IPS, default=chosen[CONF_IGNORED_IPS]): SelectSelector(
                SelectSelectorConfig(options=[], multiple=True, custom_value=True, mode=SelectSelectorMode.DROPDOWN)
            ),
            vol.Optional(CONF_ALLOWED_ADDONS, default=chosen[CONF_ALLOWED_ADDONS]): SelectSelector(
                SelectSelectorConfig(
                    options=addon_choices, multiple=True, custom_value=True, mode=SelectSelectorMode.DROPDOWN
                )
            ),
        }
    )


async def installed_addons(hass: HomeAssistant) -> list[tuple[str, str]]:
    """The installed add-ons (slug, name), from the Supervisor; none without it or when it does not answer."""
    if "hassio" not in hass.config.components:
        return []
    from homeassistant.components.hassio import get_supervisor_client  # noqa: PLC0415

    try:
        return [(item.slug, item.name) for item in await get_supervisor_client(hass).addons.list()]
    except Exception:  # noqa: BLE001 - the Supervisor busy: the slugs can still be typed
        return []


def settings_options(user_input: dict[str, Any]) -> dict[str, Any]:
    return settings(user_input)
