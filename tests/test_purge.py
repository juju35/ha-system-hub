"""Purge module: old files deleted from the folders set, folders refused, the action, the entities, the panel."""

from __future__ import annotations

import os
import time
from pathlib import Path

import pytest
from homeassistant import config_entries
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType
from homeassistant.exceptions import ServiceValidationError
from homeassistant.setup import async_setup_component
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.system_hub import enabled_modules
from custom_components.system_hub.const import CONF_MODULES, DOMAIN
from custom_components.system_hub.purge import (
    REFUSED_OUTSIDE,
    REFUSED_PROTECTED,
    REFUSED_ROOT,
    purge,
    resolve,
    settings,
)

DAY = 86400


def _file(path: Path, days: float, size: int = 10) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(b"x" * size)
    stamp = time.time() - days * DAY
    os.utime(path, (stamp, stamp))
    return path


def _age(path: Path, days: float) -> None:
    stamp = time.time() - days * DAY
    os.utime(path, (stamp, stamp))


def _snapshots(root: Path) -> tuple[Path, Path]:
    """mcp_backups as the MCP server writes it: one sub-folder per snapshot, an old one and a recent one."""
    old = root / "mcp_backups" / "2026-10-01_10-00-00"
    new = root / "mcp_backups" / "2026-11-26_10-00-00"
    _file(old / "configuration.yaml", 40)
    _file(old / "automations.yaml", 40, 30)
    _file(new / "configuration.yaml", 1)
    _age(old, 40)
    return old, new


def test_settings_defaults() -> None:
    assert settings(None) == {"directories": ["mcp_backups"], "max_age": 30}
    # Emptied on purpose: nothing purged
    assert settings({"directories": [], "max_age": 7}) == {"directories": [], "max_age": 7}
    assert settings({"directories": [" a ", "a", ""], "max_age": 0}) == {"directories": ["a"], "max_age": 30}


def test_resolve_refuses_the_configuration_and_its_own_folders(tmp_path: Path) -> None:
    config = tmp_path / "config"
    config.mkdir()
    never = lambda _path: False  # noqa: E731
    assert resolve(str(config), "mcp_backups", never) == (config / "mcp_backups", None)
    assert resolve(str(config), ".", never)[1] == REFUSED_ROOT
    assert resolve(str(config), "mcp_backups/..", never)[1] == REFUSED_ROOT
    assert resolve(str(config), str(tmp_path), never)[1] == REFUSED_ROOT
    assert resolve(str(config), "/", never)[1] == REFUSED_ROOT
    assert resolve(str(config), ".storage", never)[1] == REFUSED_PROTECTED
    assert resolve(str(config), "custom_components/system_hub", never)[1] == REFUSED_PROTECTED
    assert resolve(str(config), "../elsewhere", never)[1] == REFUSED_OUTSIDE
    assert resolve(str(config), str(tmp_path / "media"), lambda _path: True)[1] is None
    # A symbolic link to the configuration folder is the configuration folder
    (config / "loop").symlink_to(config)
    assert resolve(str(config), "loop", never)[1] == REFUSED_ROOT


def test_purge_deletes_the_old_files_and_their_empty_folders(tmp_path: Path) -> None:
    old, new = _snapshots(tmp_path)
    folder = tmp_path / "mcp_backups"
    preview = purge(folder, 30, dry_run=True)
    assert (preview["files"], preview["old_files"], preview["old_size"], preview["deleted"]) == (3, 2, 40, 0)
    assert old.exists()

    result = purge(folder, 30, dry_run=False)
    assert (result["deleted"], result["freed"], result["folders_removed"], result["errors"]) == (2, 40, 1, [])
    assert not old.exists()
    assert (new / "configuration.yaml").exists()
    assert folder.exists()


def test_purge_keeps_a_recent_empty_folder_and_follows_no_link(tmp_path: Path) -> None:
    folder = tmp_path / "keep"
    (folder / "empty").mkdir(parents=True)
    outside = _file(tmp_path / "outside" / "old.txt", 90)
    (folder / "link").symlink_to(outside.parent)
    result = purge(folder, 30, dry_run=False)
    assert result["deleted"] == 0
    assert (folder / "empty").exists()
    assert outside.exists()
    assert purge(tmp_path / "missing", 30, dry_run=False)["exists"] is False


async def _setup(hass: HomeAssistant, **purge_options) -> MockConfigEntry:
    options = {CONF_MODULES: ["purge"]} | ({"purge": purge_options} if purge_options else {})
    entry = MockConfigEntry(domain=DOMAIN, title="System Hub", options=options)
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


def test_off_unless_turned_on() -> None:
    assert "purge" not in enabled_modules(MockConfigEntry(domain=DOMAIN, options={}))


async def test_purge_at_start_action_and_entities(hass: HomeAssistant) -> None:
    old, new = _snapshots(Path(hass.config.config_dir))
    entry = await _setup(hass)
    # Never purged: purged once Home Assistant runs
    assert not old.exists()
    assert (new / "configuration.yaml").exists()
    purger = entry.runtime_data.purge
    assert (purger.last_files, purger.last_bytes) == (2, 40)
    sensor = hass.states.get("sensor.system_hub_purge_last_purge")
    assert sensor is not None
    assert sensor.attributes["files"] == 2
    assert hass.states.get("button.system_hub_purge_purge_now") is not None

    _file(Path(hass.config.config_dir) / "mcp_backups" / "2026-10-02_10-00-00" / "scenes.yaml", 45, 7)
    preview = await hass.services.async_call(
        DOMAIN, "purge_files", {"dry_run": True}, blocking=True, return_response=True
    )
    assert (preview["dry_run"], preview["files"], preview["bytes"]) == (True, 1, 7)
    assert purger.last_files == 2
    done = await hass.services.async_call(DOMAIN, "purge_files", {}, blocking=True, return_response=True)
    assert (done["files"], done["bytes"]) == (1, 7)
    assert purger.last_files == 1


async def test_action_refused_with_the_module_off(hass: HomeAssistant) -> None:
    entry = MockConfigEntry(domain=DOMAIN, title="System Hub", options={CONF_MODULES: []})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    with pytest.raises(ServiceValidationError):
        await hass.services.async_call(DOMAIN, "purge_files", {}, blocking=True)


async def test_settings_step_refuses_the_configuration_folder(hass: HomeAssistant) -> None:
    entry = await _setup(hass, directories=[], max_age=30)
    flow = await hass.config_entries.options.async_init(entry.entry_id)
    result = await hass.config_entries.options.async_configure(flow["flow_id"], {"next_step_id": "purge"})
    assert result["step_id"] == "purge"
    result = await hass.config_entries.options.async_configure(
        result["flow_id"], {"directories": [".", "mcp_backups/"], "max_age": 14}
    )
    assert result["type"] is FlowResultType.FORM
    assert result["errors"] == {"directories": "purge_refused"}
    assert result["description_placeholders"]["refused"] == "."
    result = await hass.config_entries.options.async_configure(
        result["flow_id"], {"directories": ["mcp_backups/", "tmp/exports"], "max_age": 14}
    )
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert entry.options["purge"] == {"directories": ["mcp_backups", "tmp/exports"], "max_age": 14}


async def test_panel_scans_without_deleting(hass: HomeAssistant, hass_ws_client) -> None:
    assert await async_setup_component(hass, "frontend", {})
    entry = await _setup(hass, directories=["mcp_backups", ".storage"], max_age=30)
    old, _new = _snapshots(Path(hass.config.config_dir))
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "system_hub/purge"})
    result = (await client.receive_json())["result"]
    folders = {f["directory"]: f for f in result["folders"]}
    assert folders["mcp_backups"]["old_files"] == 2
    assert folders[".storage"]["refused"] == "protected"
    assert old.exists()
    await client.send_json_auto_id({"type": "system_hub/state"})
    state = (await client.receive_json())["result"]
    assert state["purge"]["directories"] == ["mcp_backups", ".storage"]
    assert entry.runtime_data.purge is not None


async def test_user_flow_leaves_it_off(hass: HomeAssistant) -> None:
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
    defaults = {str(key): key.default() for key in result["data_schema"].schema}
    assert defaults["purge"] is False
