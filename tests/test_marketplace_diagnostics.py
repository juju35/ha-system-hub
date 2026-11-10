"""Tests for the diagnostics of Marketplace Refresh."""

from __future__ import annotations

from homeassistant.components.diagnostics import REDACTED
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.system_hub.const import DOMAIN
from custom_components.system_hub.diagnostics import async_get_config_entry_diagnostics
from custom_components.system_hub.marketplace.const import CONF_SCAN_INTERVAL


async def test_diagnostics(hass, fake_marketplace):
    entry = MockConfigEntry(
        domain=DOMAIN,
        unique_id=DOMAIN,
        data={"token": "ghp_secret", "username": "juju35"},
        options={"modules": ["marketplace"], "marketplace": {CONF_SCAN_INTERVAL: 12, "api_key": "abc"}},
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    await hass.services.async_call(DOMAIN, "marketplace_check_updates", {"wait": True}, blocking=True)
    await hass.async_block_till_done()

    diag = await async_get_config_entry_diagnostics(hass, entry)

    assert diag["entry"] == {
        "data": {"token": REDACTED, "username": REDACTED},
        "options": {"modules": ["marketplace"], "marketplace": {CONF_SCAN_INTERVAL: 12, "api_key": REDACTED}},
    }
    assert "ghp_secret" not in str(diag)
    refresher = diag["marketplace_refresher"]
    assert refresher["state"] == "idle"
    assert refresher["total"] == 3
    assert refresher["updates"] == 1
    assert refresher["pending"] == ["juju35/ha-parcel"]
    assert refresher["github_connected"] is True
    assert refresher["last_check"] is not None
    assert diag["marketplace_integration"] == {
        "loaded": True,
        "github_connected": True,
        "disabled": False,
        "disabled_reason": None,
        "installed": 3,
    }
