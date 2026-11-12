"""Sidebar panel: registered for administrators, its state and settings commands."""

from __future__ import annotations

from homeassistant.components import frontend
from homeassistant.const import __version__ as HA_VERSION
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType
from homeassistant.helpers import entity_registry as er
from homeassistant.setup import async_setup_component
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.system_hub.config_flow import SystemHubOptionsFlow
from custom_components.system_hub.const import CONF_MODULES, DOMAIN
from custom_components.system_hub.panel import PANEL_PATH, tab_order

from .conftest import add_battery


async def _setup(hass: HomeAssistant, modules: list[str], **options) -> MockConfigEntry:
    assert await async_setup_component(hass, "frontend", {})
    entry = MockConfigEntry(domain=DOMAIN, title="System Hub", options={CONF_MODULES: modules, **options})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


def _system_monitor(hass: HomeAssistant) -> None:
    """Sensors of the System Monitor integration, as its entity registry entries name them."""
    entry = MockConfigEntry(domain="systemmonitor")
    entry.add_to_hass(hass)
    registry = er.async_get(hass)
    for key, object_id, state, unit in (
        ("processor_use", "processor_use", "12", "%"),
        ("memory_use_percent", "memory_usage", "48.5", "%"),
        ("disk_use_percent", "disk_usage", "71", "%"),
        ("throughput_network_in", "network_throughput_in_eth0", "1.5", "MB/s"),
        ("network_in", "network_in_eth0", "2048", "MiB"),
        ("ipv4_address", "ipv4_address_eth0", "192.168.1.2", None),
    ):
        item = registry.async_get_or_create(
            "sensor",
            "systemmonitor",
            key,
            config_entry=entry,
            suggested_object_id=f"system_monitor_{object_id}",
            translation_key=key,
        )
        hass.states.async_set(item.entity_id, state, {"unit_of_measurement": unit} if unit else {})
    process = registry.async_get_or_create(
        "binary_sensor", "systemmonitor", "process_python3", config_entry=entry, translation_key="process"
    )
    hass.states.async_set(process.entity_id, "on")
    backup = registry.async_get_or_create(
        "sensor", "backup", "last_ok", translation_key="last_successful_automatic_backup"
    )
    hass.states.async_set(backup.entity_id, "2026-11-10T04:45:00+00:00")
    files = MockConfigEntry(domain="filesize", data={"file_path": "/config/home-assistant_v2.db"})
    files.add_to_hass(hass)
    for key, path_entry in (("size", files),):
        db = registry.async_get_or_create("sensor", "filesize", "db", config_entry=path_entry, translation_key=key)
        hass.states.async_set(db.entity_id, "612.4", {"unit_of_measurement": "MB"})
    # A File Size sensor of another file is not the database
    other = MockConfigEntry(domain="filesize", data={"file_path": "/config/home-assistant.log"})
    other.add_to_hass(hass)
    log = registry.async_get_or_create("sensor", "filesize", "log", config_entry=other, translation_key="size")
    hass.states.async_set(log.entity_id, "2.1")


async def test_panel_is_registered_for_administrators(hass: HomeAssistant) -> None:
    await _setup(hass, [])
    panel = hass.data[frontend.DATA_PANELS][PANEL_PATH]
    assert panel.require_admin is True
    assert panel.config["_panel_custom"]["name"] == "system-hub-panel"
    assert panel.config["_panel_custom"]["module_url"].startswith("/system_hub_static/system-hub-panel.js?v=")


async def test_sidebar_icon_follows_the_status(hass: HomeAssistant, hass_ws_client) -> None:
    await _setup(hass, [])
    assert hass.data[frontend.DATA_PANELS][PANEL_PATH].sidebar_icon == "system-hub:good"
    assert any(
        "/system_hub_static/system-hub-icons.js?v=" in url for url in hass.data[frontend.DATA_EXTRA_MODULE_URL].urls
    )
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": "system_hub/sidebar_icon", "tone": "warn"})
    assert (await client.receive_json())["result"] == {"changed": True}
    assert hass.data[frontend.DATA_PANELS][PANEL_PATH].sidebar_icon == "system-hub:warn"
    await client.send_json({"id": 2, "type": "system_hub/sidebar_icon", "tone": "warn"})
    assert (await client.receive_json())["result"] == {"changed": False}
    await client.send_json({"id": 3, "type": "system_hub/sidebar_icon", "tone": "purple"})
    assert not (await client.receive_json())["success"]


async def test_panel_removed_with_the_integration(hass: HomeAssistant) -> None:
    entry = await _setup(hass, [])
    assert await hass.config_entries.async_remove(entry.entry_id)
    await hass.async_block_till_done()
    assert PANEL_PATH not in hass.data[frontend.DATA_PANELS]


async def test_panel_file_is_served(hass: HomeAssistant, hass_client) -> None:
    await _setup(hass, [])
    client = await hass_client()
    response = await client.get("/system_hub_static/system-hub-panel.js")
    assert response.status == 200
    assert "customElements.define('system-hub-panel'" in await response.text()


async def test_state_gathers_the_modules(hass: HomeAssistant, hass_ws_client) -> None:
    _system_monitor(hass)
    add_battery(hass, "Door", "12")
    hass.states.async_set(
        "update.home_assistant_core_update", "on", {"installed_version": "2026.10.4", "latest_version": "2026.11.1"}
    )
    await _setup(hass, ["watchdog", "batteries"])
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": "system_hub/state"})
    result = (await client.receive_json())["result"]
    assert result["loaded"] is True
    assert result["modules"] == ["watchdog", "batteries"]
    assert result["tabs"] == [
        "status",
        "system",
        "containers",
        "database",
        "logs",
        "watchdog",
        "marketplace",
        "backups",
        "silent",
        "batteries",
        "git_sync",
        "automations",
        "orphans",
    ]
    keys = {s["key"]: s for s in result["system"]}
    assert set(keys) == {
        "processor_use",
        "memory_use_percent",
        "disk_use_percent",
        "throughput_network_in",
        "network_in",
        "ipv4_address",
        "process",
        "backup_last_successful_automatic_backup",
        "database_size",
    }
    assert keys["process"]["state"] == "on"
    assert keys["memory_use_percent"]["state"] == "48.5"
    assert keys["memory_use_percent"]["unit"] == "%"
    assert result["watchdog"]["unavailable"] == []
    assert [b["name"] for b in result["batteries"]["batteries"]] == ["Door"]
    assert result["batteries"]["low"] == 1
    assert "containers" not in result
    assert "marketplace" not in result
    assert "automations" not in result
    assert result["git_sync_configured"] is False
    assert result["updates"] == [
        {
            "key": "core",
            "entity_id": "update.home_assistant_core_update",
            "state": "on",
            "installed": "2026.10.4",
            "latest": "2026.11.1",
        }
    ]
    assert result["thresholds"] == {
        "cpu": [70, 90],
        "ram": [70, 90],
        "disk": [80, 90],
        "temperature": [70, 85],
        "swap": [50, 80],
    }
    assert result["batteries"]["spares"] == {}


async def test_version_and_last_boot_whatever_the_language(hass: HomeAssistant, hass_ws_client) -> None:
    """The Supervisor's Core update found by its unique id (its entity id in French), and System Monitor's last boot of
    Home Assistant 2026: an uptime without a translation key."""
    registry = er.async_get(hass)
    core = registry.async_get_or_create(
        "update", "hassio", "home_assistant_core_version_latest", suggested_object_id="home_assistant_core_mise_a_jour"
    )
    hass.states.async_set(core.entity_id, "off", {"installed_version": "2026.11.1", "latest_version": "2026.11.1"})
    monitor = MockConfigEntry(domain="systemmonitor")
    monitor.add_to_hass(hass)
    boot = registry.async_get_or_create(
        "sensor",
        "systemmonitor",
        "last_boot",
        config_entry=monitor,
        suggested_object_id="system_monitor_dernier_demarrage",
        original_device_class="uptime",
    )
    hass.states.async_set(boot.entity_id, "2026-11-11T02:00:35+00:00", {"device_class": "uptime"})
    await _setup(hass, [])
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": "system_hub/state"})
    result = (await client.receive_json())["result"]
    assert core.entity_id == "update.home_assistant_core_mise_a_jour"
    assert result["updates"] == [
        {"key": "core", "entity_id": core.entity_id, "state": "off", "installed": "2026.11.1", "latest": "2026.11.1"}
    ]
    assert [s["entity_id"] for s in result["system"] if s["key"] == "last_boot"] == [boot.entity_id]


async def test_version_without_the_supervisor(hass: HomeAssistant, hass_ws_client) -> None:
    """A container or a Python install: Core's version running, without an update to tell."""
    await _setup(hass, [])
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": "system_hub/state"})
    result = (await client.receive_json())["result"]
    assert result["updates"] == [
        {"key": "core", "entity_id": None, "state": "off", "installed": HA_VERSION, "latest": None}
    ]


async def test_state_without_the_integration(hass: HomeAssistant, hass_ws_client) -> None:
    entry = await _setup(hass, [])
    assert await hass.config_entries.async_unload(entry.entry_id)
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": "system_hub/state"})
    assert (await client.receive_json())["result"] == {"loaded": False}


async def test_commands_are_for_administrators(
    hass: HomeAssistant, hass_ws_client, hass_read_only_access_token
) -> None:
    await _setup(hass, [])
    client = await hass_ws_client(hass, hass_read_only_access_token)
    for command in ("system_hub/state", "system_hub/update_settings"):
        await client.send_json_auto_id({"type": command})
        response = await client.receive_json()
        assert response["success"] is False
        assert response["error"]["code"] == "unauthorized"


async def test_update_settings(hass: HomeAssistant, hass_ws_client) -> None:
    entry = await _setup(hass, ["watchdog"])
    client = await hass_ws_client(hass)
    await client.send_json_auto_id(
        {"type": "system_hub/update_settings", "modules": ["batteries", "watchdog"], "tabs": ["batteries", "system"]}
    )
    response = await client.receive_json()
    assert response["success"] is True
    await hass.async_block_till_done()
    assert entry.options[CONF_MODULES] == ["watchdog", "batteries"]
    assert entry.options["tabs"] == [
        "status",
        "batteries",
        "system",
        "containers",
        "database",
        "logs",
        "watchdog",
        "marketplace",
        "backups",
        "silent",
        "git_sync",
        "automations",
        "orphans",
    ]
    assert entry.runtime_data.batteries is not None


async def test_git_sync_needs_its_repository(hass: HomeAssistant, hass_ws_client) -> None:
    entry = await _setup(hass, [])
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "system_hub/update_settings", "modules": ["git_sync"]})
    response = await client.receive_json()
    assert response["error"]["code"] == "git_sync_needs_repository"
    assert entry.options[CONF_MODULES] == []


def test_tab_order() -> None:
    assert tab_order({}) == [
        "status",
        "system",
        "containers",
        "database",
        "logs",
        "watchdog",
        "marketplace",
        "backups",
        "silent",
        "batteries",
        "git_sync",
        "automations",
        "orphans",
    ]
    # An order saved before the Status tab: it comes first
    assert tab_order({"tabs": ["git_sync", "unknown", "git_sync", "system"]}) == [
        "status",
        "git_sync",
        "system",
        "containers",
        "database",
        "logs",
        "watchdog",
        "marketplace",
        "backups",
        "silent",
        "batteries",
        "automations",
        "orphans",
    ]
    # Moved by hand: kept where it is
    assert tab_order({"tabs": ["system", "status"]})[:2] == ["system", "status"]


async def test_system_thresholds_step(hass: HomeAssistant, hass_ws_client) -> None:
    entry = await _setup(hass, [])
    result = await hass.config_entries.options.async_init(entry.entry_id, context={"source": "system_hub_panel"})
    assert "system" in result["menu_options"]
    result = await hass.config_entries.options.async_configure(result["flow_id"], {"next_step_id": "system"})
    assert result["step_id"] == "system"
    values = {
        "cpu_warning": 60,
        "cpu_critical": 80,
        "ram_warning": 70,
        "ram_critical": 90,
        "disk_warning": 85,
        "disk_critical": 95,
        "temperature_warning": 65,
        "temperature_critical": 80,
        "swap_warning": 50,
        "swap_critical": 50,
    }
    # Red must be above orange
    result = await hass.config_entries.options.async_configure(result["flow_id"], values)
    assert result["errors"] == {"swap_critical": "critical_below_warning"}
    result = await hass.config_entries.options.async_configure(result["flow_id"], {**values, "swap_critical": 75.0})
    assert result["type"] is FlowResultType.CREATE_ENTRY
    await hass.async_block_till_done()
    assert entry.options["system"]["swap_critical"] == 75
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": "system_hub/state"})
    thresholds = (await client.receive_json())["result"]["thresholds"]
    assert thresholds["cpu"] == [60, 80]
    assert thresholds["swap"] == [50, 75]
    assert thresholds["temperature"] == [65, 80]


async def test_marketplace_updates_for_the_panel(hass: HomeAssistant) -> None:
    from homeassistant.helpers import entity_registry as er  # noqa: PLC0415

    from custom_components.system_hub.panel import _marketplace_updates  # noqa: PLC0415

    registry = er.async_get(hass)
    for uid, title, on in (("1", "Mushroom", True), ("2", "card-mod", True), ("3", "Up to date", False)):
        entry = registry.async_get_or_create("update", "marketplace", uid, suggested_object_id=f"repo_{uid}")
        attrs = {"title": title, "installed_version": "v1.0.0", "latest_version": "v2.0.0" if on else "v1.0.0"}
        if uid == "1":
            attrs |= {"release_url": "https://github.com/x/mushroom/releases/v2.0.0", "entity_picture": "/p.png"}
        hass.states.async_set(entry.entity_id, "on" if on else "off", attrs)
    # Another integration's update entities are left out: an add-on, a container image of Dockhand
    other = registry.async_get_or_create("update", "hassio", "x", suggested_object_id="addon")
    hass.states.async_set(other.entity_id, "on", {"title": "Add-on"})
    image = registry.async_get_or_create("update", "dockhand", "nas_1", suggested_object_id="nas_containers_dockhand")
    hass.states.async_set(image.entity_id, "on", {"title": "dockhand", "installed_version": "1", "latest_version": "2"})

    updates = _marketplace_updates(hass, ["update.repo_2"])
    assert [u["title"] for u in updates] == ["card-mod", "Mushroom"]
    assert updates[0]["installing"] is True
    assert updates[1] == {
        "entity_id": "update.repo_1",
        "title": "Mushroom",
        "installed": "v1.0.0",
        "latest": "v2.0.0",
        "release_url": "https://github.com/x/mushroom/releases/v2.0.0",
        "release_summary": None,
        "picture": "/p.png",
        "installing": False,
    }


async def test_system_updates_for_the_panel(hass: HomeAssistant) -> None:
    """Home Assistant, the add-ons and the devices: the ones with an update in order, the others counted."""
    from homeassistant.helpers import entity_registry as er  # noqa: PLC0415

    from custom_components.system_hub.panel import _system_updates  # noqa: PLC0415

    registry = er.async_get(hass)
    entities = (
        ("zha", "lamp", "Lamp", "on", 0),
        ("hassio", "mosquitto_version_latest", "Mosquitto broker", "on", 9),
        ("hassio", "home_assistant_os_version_latest", "Home Assistant Operating System", "on", 9),
        ("hassio", "home_assistant_core_version_latest", "Home Assistant Core", "on", 9),
        ("hassio", "home_assistant_supervisor_version_latest", "Home Assistant Supervisor", "off", 0),
        ("hassio", "samba_version_latest", "Samba share", "off", 0),
        ("esphome", "node", "Node", "off", 0),
        ("marketplace", "1", "Mushroom", "on", 0),
        ("hacs", "2", "card-mod", "on", 0),
    )
    for platform, uid, title, state, features in entities:
        entry = registry.async_get_or_create("update", platform, uid, suggested_object_id=f"{platform}_{uid}")
        attrs = {"title": title, "installed_version": "1.0", "latest_version": "1.1", "supported_features": features}
        hass.states.async_set(entry.entity_id, state, attrs)
    # Unavailable: left out
    gone = registry.async_get_or_create("update", "zha", "gone", suggested_object_id="gone")
    hass.states.async_set(gone.entity_id, "unavailable", {"title": "Gone"})

    result = _system_updates(hass)
    assert [(u["kind"], u["title"]) for u in result["available"]] == [
        ("core", "Home Assistant Core"),
        ("os", "Home Assistant Operating System"),
        ("addon", "Mosquitto broker"),
        ("device", "Lamp"),
    ]
    assert result["available"][0]["backup"] is True
    assert result["available"][3]["backup"] is False
    assert result["up_to_date"] == {"system": 1, "addon": 1, "device": 1}


async def test_configure_and_the_panel_drive_the_same_flow(hass: HomeAssistant, hass_ws_client) -> None:
    """Configure on the integration's page and the Settings tab start the same options flow."""
    from homeassistant.data_entry_flow import FlowResultType  # noqa: PLC0415
    from pytest_homeassistant_custom_component.common import MockConfigEntry  # noqa: PLC0415

    from custom_components.system_hub.const import DOMAIN  # noqa: PLC0415

    entry = MockConfigEntry(domain=DOMAIN, unique_id=DOMAIN, options={"modules": []})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    # Configure on the integration's page: the same menu as the Settings tab
    assert entry.supports_options is True
    # As the frontend starts it, with or without show_advanced_options (Home Assistant 2026.11 no longer sends it)
    for context in ({"show_advanced_options": False}, {}):
        result = await hass.config_entries.options.async_init(entry.entry_id, context=context)
        assert result["type"] is FlowResultType.MENU
        assert result["menu_options"][:2] == ["modules", "system"]
        hass.config_entries.options.async_abort(result["flow_id"])

    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "system_hub/options_flow"})
    answer = (await client.receive_json())["result"]
    assert answer["type"] == "menu"
    assert "modules" in answer["menu_options"]
    result = await hass.config_entries.options.async_configure(answer["flow_id"], {"next_step_id": "system"})
    assert result["step_id"] == "system"


async def test_processes_that_may_be_stopped(hass: HomeAssistant, hass_ws_client, hass_read_only_access_token) -> None:
    """Chosen in the Containers & process settings (in the System settings in 1.0.3, still read until saved there):
    flagged in the panel's state and read by the cards of any user."""
    _system_monitor(hass)
    process = "binary_sensor.systemmonitor_process_python3"
    assert hass.states.get(process) is not None
    # Saved in the System settings by 1.0.3
    entry = await _setup(hass, [], system={"cpu_warning": 70, "stoppable_processes": [process]})
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "system_hub/state"})
    system = (await client.receive_json())["result"]["system"]
    assert next(s for s in system if s["entity_id"] == process)["stoppable"] is True
    # Not an administrator: the cards still read them
    user = await hass_ws_client(hass, hass_read_only_access_token)
    await user.send_json_auto_id({"type": "system_hub/stoppable_processes"})
    assert (await user.receive_json())["result"] == [process]
    # The Containers & process settings show them, and keep them once saved: the copy in the System settings goes
    flow = SystemHubOptionsFlow()
    flow.hass = hass
    flow.handler = entry.entry_id
    flow.flow_id = "test"
    flow.context = {"source": "system_hub_panel"}
    form = await flow.async_step_containers()
    shown = {str(k): k.default() for k in form["data_schema"].schema if hasattr(k, "default")}
    assert shown["stoppable_processes"] == [process]
    result = await flow.async_step_containers(
        {"scan_interval": 30, "notify": True, "notify_services": [], "stoppable_processes": [process]}
    )
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert result["data"]["containers"]["stoppable_processes"] == [process]
    assert result["data"]["system"] == {"cpu_warning": 70}
    # The System settings no longer ask for them
    form = await flow.async_step_system()
    assert "stoppable_processes" not in {str(k) for k in form["data_schema"].schema}
