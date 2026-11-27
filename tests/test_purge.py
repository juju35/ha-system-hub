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
    browse,
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


def test_resolve_keeps_to_the_configuration_folder(tmp_path: Path) -> None:
    config = tmp_path / "config"
    config.mkdir()
    assert resolve(str(config), "mcp_backups") == (config / "mcp_backups", None)
    assert resolve(str(config), str(config / "exports"))[1] is None
    assert resolve(str(config), "x/../mcp_backups")[1] is None
    assert resolve(str(config), ".")[1] == REFUSED_ROOT
    assert resolve(str(config), "mcp_backups/..")[1] == REFUSED_ROOT
    assert resolve(str(config), str(tmp_path))[1] == REFUSED_ROOT
    assert resolve(str(config), "/")[1] == REFUSED_ROOT
    assert resolve(str(config), ".storage")[1] == REFUSED_PROTECTED
    assert resolve(str(config), ".ssh/old")[1] == REFUSED_PROTECTED
    assert resolve(str(config), "custom_components/system_hub")[1] == REFUSED_PROTECTED
    assert resolve(str(config), "backups")[1] == REFUSED_PROTECTED
    assert resolve(str(config), "www/community")[1] == REFUSED_PROTECTED
    assert resolve(str(config), "www/snapshots")[1] is None
    assert resolve(str(config), "../elsewhere")[1] == REFUSED_OUTSIDE
    assert resolve(str(config), str(tmp_path / "media"))[1] == REFUSED_OUTSIDE
    # A symbolic link is judged by where it leads
    (config / "loop").symlink_to(config)
    assert resolve(str(config), "loop")[1] == REFUSED_ROOT
    (config / ".storage").mkdir()
    (config / "store").symlink_to(config / ".storage")
    assert resolve(str(config), "store")[1] == REFUSED_PROTECTED
    (config / "out").symlink_to(tmp_path)
    assert resolve(str(config), "out/media")[1] == REFUSED_OUTSIDE


def test_resolve_accepts_backup(tmp_path: Path) -> None:
    config, backup = tmp_path / "config", tmp_path / "backup"
    config.mkdir()
    backup.mkdir()
    assert resolve(str(config), str(backup), str(backup)) == (backup, None)
    assert resolve(str(config), str(backup / "old"), str(backup))[1] is None
    assert resolve(str(config), str(tmp_path / "backup2"), str(backup))[1] == REFUSED_OUTSIDE
    # The default: Home Assistant OS's /backup
    assert resolve(str(config), "/backup")[1] is None
    assert resolve(str(config), "/backups")[1] == REFUSED_OUTSIDE


def test_browse_lists_the_folders_of_the_configuration_folder(tmp_path: Path) -> None:
    config = tmp_path / "config"
    _snapshots(config)
    (config / ".storage").mkdir()
    (config / "custom_components" / "x").mkdir(parents=True)
    _file(config / "configuration.yaml", 1)
    (config / "link").symlink_to(tmp_path)
    top = browse(str(config), "", 30)
    assert top["path"] == ""
    entries = {e["name"]: e for e in top["entries"]}
    assert set(entries) == {".storage", "custom_components", "mcp_backups"}
    assert entries[".storage"]["protected"] is True
    assert "files" not in entries["custom_components"]
    mcp = entries["mcp_backups"]
    assert (mcp["protected"], mcp["files"], mcp["old_files"], mcp["size"], mcp["folders"]) == (False, 3, 2, 50, True)
    inside = browse(str(config), "mcp_backups/", 30)
    assert inside["path"] == "mcp_backups"
    assert [e["path"] for e in inside["entries"]] == [
        "mcp_backups/2026-10-01_10-00-00",
        "mcp_backups/2026-11-26_10-00-00",
    ]
    for outside in ("..", "../..", "link", "missing", str(tmp_path)):
        with pytest.raises(ValueError):
            browse(str(config), outside, 30, str(tmp_path / "backup"))
    assert top["roots"] == [{"path": "", "name": "config"}] or top["roots"][1]["path"] == "/backup"
    assert top["current"] is None
    assert inside["current"]["files"] == 3


def test_browse_backup(tmp_path: Path) -> None:
    config, backup = tmp_path / "config", tmp_path / "backup"
    config.mkdir()
    _file(backup / "a1b2c3d4.tar", 40, 100)
    _file(backup / "tmp" / "x.tar", 1, 5)
    result = browse(str(config), str(backup), 30, str(backup))
    assert result["path"] == str(backup)
    assert result["roots"] == [{"path": "", "name": "config"}, {"path": str(backup), "name": "backup"}]
    assert result["current"] == {"files": 2, "size": 105, "old_files": 1, "truncated": False}
    assert [(e["path"], e["protected"]) for e in result["entries"]] == [(str(backup / "tmp"), False)]


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


@pytest.fixture
def config(hass: HomeAssistant, tmp_path: Path) -> Path:
    """A configuration folder of the test's own, so that nothing is written in the shared testing config."""
    folder = tmp_path / "config"
    folder.mkdir()
    (folder / "custom_components").symlink_to(Path(hass.config.config_dir) / "custom_components")
    hass.config.config_dir = str(folder)
    return folder


async def _setup(hass: HomeAssistant, **purge_options) -> MockConfigEntry:
    options = {CONF_MODULES: ["purge"]} | ({"purge": purge_options} if purge_options else {})
    entry = MockConfigEntry(domain=DOMAIN, title="System Hub", options=options)
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


def test_off_unless_turned_on() -> None:
    assert "purge" not in enabled_modules(MockConfigEntry(domain=DOMAIN, options={}))


async def test_purge_at_start_action_and_entities(hass: HomeAssistant, config: Path) -> None:
    old, new = _snapshots(config)
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

    _file(config / "mcp_backups" / "2026-10-02_10-00-00" / "scenes.yaml", 45, 7)
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


async def test_settings_step_refuses_the_configuration_folder(hass: HomeAssistant, config: Path) -> None:
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


async def test_panel_scans_without_deleting(hass: HomeAssistant, hass_ws_client, config: Path) -> None:
    assert await async_setup_component(hass, "frontend", {})
    entry = await _setup(hass, directories=["mcp_backups", ".storage"], max_age=30)
    old, _new = _snapshots(config)
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


async def test_panel_browses_and_saves_the_folders(hass: HomeAssistant, hass_ws_client, config: Path) -> None:
    assert await async_setup_component(hass, "frontend", {})
    entry = await _setup(hass, directories=["mcp_backups"], max_age=30)
    _snapshots(config)
    (config / "exports").mkdir()
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "system_hub/purge_browse", "path": ""})
    names = [e["name"] for e in (await client.receive_json())["result"]["entries"]]
    assert {"exports", "mcp_backups"} <= set(names)
    await client.send_json_auto_id({"type": "system_hub/purge_browse", "path": ".."})
    assert (await client.receive_json())["error"]["code"] == "outside"

    data = entry.runtime_data
    await client.send_json_auto_id({"type": "system_hub/purge_set_folders", "directories": ["mcp_backups", ".storage"]})
    response = await client.receive_json()
    assert response["error"] == {"code": "purge_refused", "message": ".storage"}
    await client.send_json_auto_id({"type": "system_hub/purge_set_folders", "directories": ["mcp_backups", "exports/"]})
    assert (await client.receive_json())["result"]["directories"] == ["mcp_backups", "exports"]
    await hass.async_block_till_done()
    # Saved without a reload
    assert entry.runtime_data is data
    assert entry.options["purge"] == {"directories": ["mcp_backups", "exports"], "max_age": 30}
    assert data.purge.directories == ["mcp_backups", "exports"]
