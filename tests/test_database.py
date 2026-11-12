"""Database module: the recorder's database, its retention and the entities that wrote the most states."""

from __future__ import annotations

from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry
from pytest_homeassistant_custom_component.components.recorder.common import async_wait_recording_done

from custom_components.system_hub.const import CONF_MODULES, DOMAIN
from custom_components.system_hub.database import _size, settings


async def _setup(hass: HomeAssistant) -> MockConfigEntry:
    entry = MockConfigEntry(domain=DOMAIN, title="System Hub", options={CONF_MODULES: ["database"]})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


async def test_top_writers(recorder_mock, hass: HomeAssistant, hass_ws_client) -> None:
    await _setup(hass)
    for value in range(5):
        hass.states.async_set("sensor.chatty", str(value))
    hass.states.async_set("sensor.quiet", "1")
    await async_wait_recording_done(hass)
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": "system_hub/database"})
    result = (await client.receive_json())["result"]
    assert result["engine"] == "sqlite"
    assert result["keep_days"] == 10
    assert result["top"][0] == {"entity_id": "sensor.chatty", "count": 5, "name": "chatty", "excluded": False}
    assert result["total_day"] >= 6
    # Kept for an hour: a new state is not counted until asked again with force
    hass.states.async_set("sensor.chatty", "9")
    await async_wait_recording_done(hass)
    await client.send_json({"id": 2, "type": "system_hub/database"})
    assert (await client.receive_json())["result"]["top"][0]["count"] == 5
    await client.send_json({"id": 3, "type": "system_hub/database", "force": True})
    assert (await client.receive_json())["result"]["top"][0]["count"] == 6
    await client.send_json({"id": 4, "type": "system_hub/state"})
    assert (await client.receive_json())["result"]["database"] == {"max_size": 2.0}


async def test_not_enabled(hass: HomeAssistant, hass_ws_client) -> None:
    hass.config.components.add("system_log")
    entry = MockConfigEntry(domain=DOMAIN, title="System Hub", options={CONF_MODULES: ["logs"]})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": "system_hub/database"})
    assert (await client.receive_json())["error"]["code"] == "not_enabled"


def test_size(tmp_path) -> None:
    db = tmp_path / "home-assistant_v2.db"
    db.write_bytes(b"x" * 100)
    (tmp_path / "home-assistant_v2.db-wal").write_bytes(b"x" * 20)
    assert _size(f"sqlite:///{db}") == 120
    assert _size("sqlite://") is None
    assert _size("postgresql://ha@db/ha") is None
    assert settings(None) == {"max_size": 2.0}


async def test_settings_step(recorder_mock, hass: HomeAssistant) -> None:
    entry = await _setup(hass)
    result = await hass.config_entries.options.async_init(entry.entry_id)
    assert "database" in result["menu_options"]
    result = await hass.config_entries.options.async_configure(result["flow_id"], {"next_step_id": "database"})
    result = await hass.config_entries.options.async_configure(result["flow_id"], {"max_size": 5})
    assert entry.options["database"] == {"max_size": 5.0}
