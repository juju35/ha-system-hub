"""Settings of the Watchdog module: the schema of its options step and of its power cycles."""

from __future__ import annotations

import re
from typing import Any

import voluptuous as vol
from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.selector import (
    DeviceSelector,
    DeviceSelectorConfig,
    EntitySelector,
    EntitySelectorConfig,
    NumberSelector,
    NumberSelectorConfig,
    NumberSelectorMode,
    SelectOptionDict,
    SelectSelector,
    SelectSelectorConfig,
    SelectSelectorMode,
    TextSelector,
    TextSelectorConfig,
)
from homeassistant.loader import async_get_integrations

from ..const import DOMAIN
from ..notify import notify_choices
from .const import (
    CONF_DELAY,
    CONF_DEVICE,
    CONF_GRACE_OVERRIDES,
    CONF_GRACE_PERIOD,
    CONF_IGNORED,
    CONF_IGNORED_ENTRIES,
    CONF_MAX_RELOADS,
    CONF_NOTIFY,
    CONF_OFF_TIME,
    CONF_PAUSE_ENTITY,
    CONF_SCAN_INTERVAL,
    CONF_SWITCH,
    DEFAULT_CYCLE_DELAY,
    DEFAULT_GRACE_PERIOD,
    DEFAULT_MAX_RELOADS,
    DEFAULT_OFF_TIME,
    DEFAULT_SCAN_INTERVAL,
    MAX_MAX_RELOADS,
    MAX_MINUTES,
    MAX_OFF_TIME,
    PAUSE_DOMAINS,
)

_OVERRIDE_LINE = re.compile(r"^\s*([a-z0-9_]+)\s*[:=]\s*(\d+)\s*$")


def parse_overrides(text: str) -> dict[str, int]:
    """One "domain: minutes" per line (or comma separated); raises ValueError on a line that isn't."""
    overrides: dict[str, int] = {}
    for line in re.split(r"[\n,]", text or ""):
        if not line.strip():
            continue
        match = _OVERRIDE_LINE.match(line.strip().lower())
        if not match or not 1 <= int(match[2]) <= MAX_MINUTES:
            raise ValueError(line.strip())
        overrides[match[1]] = int(match[2])
    return dict(sorted(overrides.items()))


def format_overrides(overrides: dict[str, int]) -> str:
    return "\n".join(f"{domain}: {minutes}" for domain, minutes in sorted(overrides.items()))


def _minutes() -> NumberSelector:
    return NumberSelector(
        NumberSelectorConfig(min=1, max=MAX_MINUTES, step=1, mode=NumberSelectorMode.BOX, unit_of_measurement="min")
    )


async def settings_schema(hass: HomeAssistant, current: dict[str, Any]) -> vol.Schema:
    """Interval, grace period, reload limit, integrations to ignore and notify actions."""
    ignored: list[str] = list(current.get(CONF_IGNORED, []))
    domains = {e.domain for e in hass.config_entries.async_entries() if e.domain != DOMAIN} | set(ignored)
    integrations = await async_get_integrations(hass, domains)
    options = sorted(
        (
            SelectOptionDict(
                value=domain,
                label=f"{getattr(integrations.get(domain), 'name', domain)} ({domain})",
            )
            for domain in domains
        ),
        key=lambda o: o["label"].casefold(),
    )
    # Single config entries: "Title (domain)", the ones already ignored kept even when removed since.
    ignored_entries: list[str] = list(current.get(CONF_IGNORED_ENTRIES, []))
    entries = {e.entry_id: e for e in hass.config_entries.async_entries() if e.domain != DOMAIN}
    entry_options = sorted(
        (
            SelectOptionDict(
                value=entry_id,
                label=f"{entries[entry_id].title} ({entries[entry_id].domain})" if entry_id in entries else entry_id,
            )
            for entry_id in set(entries) | set(ignored_entries)
        ),
        key=lambda o: o["label"].casefold(),
    )
    notify: list[str] = list(current.get(CONF_NOTIFY, []))
    notify_options = notify_choices(hass, notify)
    return vol.Schema(
        {
            vol.Required(
                CONF_SCAN_INTERVAL, default=current.get(CONF_SCAN_INTERVAL, DEFAULT_SCAN_INTERVAL)
            ): _minutes(),
            vol.Required(CONF_GRACE_PERIOD, default=current.get(CONF_GRACE_PERIOD, DEFAULT_GRACE_PERIOD)): _minutes(),
            vol.Optional(
                CONF_GRACE_OVERRIDES,
                description={"suggested_value": format_overrides(current.get(CONF_GRACE_OVERRIDES, {}))},
            ): TextSelector(TextSelectorConfig(multiline=True)),
            vol.Required(CONF_MAX_RELOADS, default=current.get(CONF_MAX_RELOADS, DEFAULT_MAX_RELOADS)): NumberSelector(
                NumberSelectorConfig(min=1, max=MAX_MAX_RELOADS, step=1, mode=NumberSelectorMode.BOX)
            ),
            vol.Optional(CONF_IGNORED, default=ignored): SelectSelector(
                SelectSelectorConfig(
                    options=options,
                    multiple=True,
                    custom_value=True,
                    mode=SelectSelectorMode.DROPDOWN,
                )
            ),
            vol.Optional(CONF_IGNORED_ENTRIES, default=ignored_entries): SelectSelector(
                SelectSelectorConfig(options=entry_options, multiple=True, mode=SelectSelectorMode.DROPDOWN)
            ),
            vol.Optional(
                CONF_PAUSE_ENTITY, description={"suggested_value": current.get(CONF_PAUSE_ENTITY)}
            ): EntitySelector(EntitySelectorConfig(domain=PAUSE_DOMAINS)),
            vol.Optional(CONF_NOTIFY, default=notify): SelectSelector(
                SelectSelectorConfig(
                    options=notify_options,
                    multiple=True,
                    custom_value=True,
                    mode=SelectSelectorMode.DROPDOWN,
                )
            ),
        }
    )


def settings_options(user_input: dict[str, Any]) -> dict[str, Any]:
    overrides = parse_overrides(user_input.get(CONF_GRACE_OVERRIDES, ""))
    # Ignored single entries only when some are chosen: existing entries keep the options they had.
    entries = sorted(set(user_input.get(CONF_IGNORED_ENTRIES, [])))
    return (
        ({CONF_IGNORED_ENTRIES: entries} if entries else {})
        | {
            CONF_SCAN_INTERVAL: int(user_input[CONF_SCAN_INTERVAL]),
            CONF_GRACE_PERIOD: int(user_input[CONF_GRACE_PERIOD]),
            CONF_MAX_RELOADS: int(user_input[CONF_MAX_RELOADS]),
            CONF_IGNORED: sorted({d.strip() for d in user_input.get(CONF_IGNORED, []) if d.strip()}),
            CONF_NOTIFY: sorted(
                {f"notify.{n.strip().removeprefix('notify.')}" for n in user_input.get(CONF_NOTIFY, []) if n.strip()}
            ),
        }
        | ({CONF_PAUSE_ENTITY: user_input[CONF_PAUSE_ENTITY]} if user_input.get(CONF_PAUSE_ENTITY) else {})
        | ({CONF_GRACE_OVERRIDES: overrides} if overrides else {})
    )


def settings_errors(user_input: dict[str, Any]) -> dict[str, str]:
    try:
        parse_overrides(user_input.get(CONF_GRACE_OVERRIDES, ""))
    except ValueError:
        return {CONF_GRACE_OVERRIDES: "invalid_overrides"}
    return {}


def cycle_schema() -> vol.Schema:
    """A device, the plug that powers it, how long it must be unavailable and how long the plug stays off."""
    return vol.Schema(
        {
            vol.Required(CONF_DEVICE): DeviceSelector(DeviceSelectorConfig()),
            vol.Required(CONF_SWITCH): EntitySelector(EntitySelectorConfig(domain="switch")),
            vol.Required(CONF_DELAY, default=DEFAULT_CYCLE_DELAY): _minutes(),
            vol.Required(CONF_OFF_TIME, default=DEFAULT_OFF_TIME): NumberSelector(
                NumberSelectorConfig(
                    min=1, max=MAX_OFF_TIME, step=1, mode=NumberSelectorMode.BOX, unit_of_measurement="s"
                )
            ),
        }
    )


def cycle_errors(hass: HomeAssistant, cycles: list[dict[str, Any]], user_input: dict[str, Any]) -> dict[str, str]:
    device_id, switch = user_input[CONF_DEVICE], user_input[CONF_SWITCH]
    if any(c.get(CONF_DEVICE) == device_id for c in cycles):
        return {CONF_DEVICE: "device_already_cycled"}
    entities = er.async_get(hass)
    # Its own plug (a smart plug that reports its power, say) would be unavailable with it: no way to switch it on.
    if (plug := entities.async_get(switch)) is not None and plug.device_id == device_id:
        return {CONF_SWITCH: "switch_on_device"}
    if not any(e.entity_id != switch for e in er.async_entries_for_device(entities, device_id)):
        return {CONF_DEVICE: "device_without_entities"}
    return {}
