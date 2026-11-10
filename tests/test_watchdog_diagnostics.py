"""Diagnostics of Integration Watchdog: the watchdog's state, without titles nor notify actions."""

from __future__ import annotations

import json
from datetime import timedelta
from unittest.mock import AsyncMock, patch

from freezegun.api import FrozenDateTimeFactory
from homeassistant.components.diagnostics import REDACTED
from homeassistant.const import STATE_UNAVAILABLE
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.system_hub.const import DOMAIN
from custom_components.system_hub.diagnostics import async_get_config_entry_diagnostics
from custom_components.system_hub.watchdog.const import (
    CONF_GRACE_PERIOD,
    CONF_IGNORED,
    CONF_MAX_RELOADS,
    CONF_NOTIFY,
    CONF_SCAN_INTERVAL,
)

from .conftest import add_integration


async def test_diagnostics(hass: HomeAssistant, freezer: FrozenDateTimeFactory):
    dead = add_integration(hass, "dead", [STATE_UNAVAILABLE])
    hass.config_entries.async_update_entry(dead, title="julien@example.com")
    entry = MockConfigEntry(
        domain=DOMAIN,
        unique_id=DOMAIN,
        options={
            "modules": ["watchdog"],
            "watchdog": {
                CONF_SCAN_INTERVAL: 5,
                CONF_GRACE_PERIOD: 15,
                CONF_MAX_RELOADS: 3,
                CONF_IGNORED: ["zha"],
                CONF_NOTIFY: ["notify.mobile_app_julien_phone"],
            },
        },
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    freezer.tick(timedelta(minutes=15))
    with patch.object(hass.config_entries, "async_reload", AsyncMock(return_value=True)):
        await hass.services.async_call(DOMAIN, "watchdog_check", {}, blocking=True)
        await hass.async_block_till_done()

    diagnostics = await async_get_config_entry_diagnostics(hass, entry)

    # Serializable, and no personal data left anywhere.
    dumped = json.dumps(diagnostics)
    assert "julien" not in dumped
    assert diagnostics["entry"]["options"]["watchdog"][CONF_NOTIFY] == REDACTED
    assert diagnostics["entry"]["options"]["watchdog"][CONF_IGNORED] == ["zha"]
    watchdog = diagnostics["watchdog"]
    assert watchdog["max_reloads"] == 3
    assert watchdog["grace_period"] == 900
    assert watchdog["reloads"] == 1
    assert watchdog["last_reload"]["entry_id"] == dead.entry_id
    assert watchdog["last_reload"]["title"] == REDACTED
    assert watchdog["last_reload"]["success"] is True
    assert watchdog["unavailable"][0]["domain"] == "dead"
    assert watchdog["unavailable"][0]["title"] == REDACTED
    assert watchdog["attempts"][dead.entry_id]["count"] == 1
    assert watchdog["attempts"][dead.entry_id]["gave_up"] is False
    assert watchdog["history"][0]["kind"] == "reloaded"
    assert watchdog["history"][0]["title"] == REDACTED
    # The watchdog's own history is left untouched.
    assert (
        hass.config_entries.async_get_entry(entry.entry_id).runtime_data.watchdog.history[0]["title"]
        == "julien@example.com"
    )
