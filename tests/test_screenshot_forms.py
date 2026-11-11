"""The settings forms the CI screenshots draw (scripts/screenshot-forms.json), as Home Assistant sends them.

The screenshots have no Home Assistant: they read the forms from that file. This test builds every form again from
the options flow and fails when the file no longer matches; `UPDATE_SCREENSHOT_FORMS=1 pytest
tests/test_screenshot_forms.py` writes it.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from unittest.mock import patch

from homeassistant.core import HomeAssistant
from homeassistant.helpers.data_entry_flow import _BaseFlowManagerView
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.system_hub.batteries.importer import Found
from custom_components.system_hub.config_flow import SystemHubOptionsFlow
from custom_components.system_hub.const import DOMAIN

FORMS = Path(__file__).parent.parent / "scripts/screenshot-forms.json"

# The steps the screenshots open, in the order of the Settings tab
STEPS = (
    "system",
    "containers",
    "watchdog",
    "watchdog_add_power_cycle",
    "marketplace",
    "batteries",
    "batteries_types",
    "batteries_import",
    "git_sync_repository",
    "git_sync",
    "orphans",
)

# A set-up instance, with nothing personal in it
OPTIONS = {
    "modules": ["containers", "watchdog", "marketplace", "batteries", "git_sync", "orphans"],
    "git_sync": {
        "repo_path": "/config",
        "remote": "origin",
        "branch": "main",
        "ssh_key": "/config/.ssh/id_ed25519",
        "author_name": "Home Assistant",
        "author_email": "home-assistant@example.com",
        "commit_language": "en",
    },
}

# What Battery Monitor knew, for its import step
FOUND = Found(
    settings={"threshold": 20},
    battery_types={"sensor.front_door_battery": "CR2032"},
    battery_models={"Aqara Door Sensor": "CR1632", "Hue Dimmer": "CR2032"},
    stock={"AA": 4, "CR2032": 2},
)


async def _forms(hass: HomeAssistant) -> dict:
    entry = MockConfigEntry(domain=DOMAIN, unique_id=DOMAIN, options=OPTIONS)
    entry.add_to_hass(hass)
    forms = {}
    with patch("custom_components.system_hub.batteries.importer.async_find", return_value=FOUND):
        for step in STEPS:
            flow = SystemHubOptionsFlow()
            flow.hass = hass
            flow.handler = entry.entry_id
            flow.flow_id = "screenshots"
            flow.context = {}
            result = await getattr(flow, f"async_step_{step}")()
            assert result["type"] == "form", step
            forms[step] = {
                "type": "form",
                "step_id": step,
                # Serialized by Home Assistant's own flow view, as the panel receives it
                "data_schema": _BaseFlowManagerView._prepare_result_json(None, result)["data_schema"],
                "errors": result.get("errors") or {},
                "description_placeholders": result.get("description_placeholders") or {},
            }
    return json.loads(json.dumps(forms))


async def test_screenshot_forms_match_the_options_flow(hass: HomeAssistant) -> None:
    """The file the screenshots read is the forms the options flow shows now."""
    forms = await _forms(hass)
    if os.environ.get("UPDATE_SCREENSHOT_FORMS"):
        FORMS.write_text(json.dumps(forms, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    assert json.loads(FORMS.read_text(encoding="utf-8")) == forms, (
        "scripts/screenshot-forms.json is out of date: UPDATE_SCREENSHOT_FORMS=1 pytest tests/test_screenshot_forms.py"
    )
