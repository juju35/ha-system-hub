"""Containers module: Core, the Supervisor and the add-ons read from the Supervisor, monitoring only."""

from __future__ import annotations

from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from freezegun.api import FrozenDateTimeFactory
from homeassistant.components import persistent_notification
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType
from homeassistant.exceptions import HomeAssistantError
from pytest_homeassistant_custom_component.common import MockConfigEntry, async_fire_time_changed, async_mock_service

from custom_components.system_hub.const import CONF_MODULES, DOMAIN

RUNNING = "sensor.system_hub_containers_running_containers"
DOWN = "sensor.system_hub_containers_stopped_containers"
LAST_UPDATE = "sensor.system_hub_containers_last_update"


def _stats(cpu: float, memory: float) -> SimpleNamespace:
    return SimpleNamespace(
        cpu_percent=cpu,
        memory_usage=int(memory * 10_000_000),
        memory_limit=1_000_000_000,
        memory_percent=memory,
        network_rx=1000,
        network_tx=2000,
        blk_read=3000,
        blk_write=4000,
    )


def _addon(slug: str, name: str, state: str, boot: str = "auto", update: bool = False) -> dict:
    return {"slug": slug, "name": name, "state": state, "boot": boot, "update": update}


class FakeSupervisor:
    """The parts of the Supervisor client the module reads; `addons` can be changed between refreshes."""

    def __init__(self) -> None:
        self.addons = [
            _addon("core_mosquitto", "Mosquitto broker", "started"),
            _addon("a0d7b954_vscode", "Studio Code Server", "stopped", boot="manual", update=True),
        ]
        self.fail = False
        info = SimpleNamespace(version="2026.11.0", version_latest="2026.11.1", update_available=True)
        sup = SimpleNamespace(version="2026.11.2", version_latest="2026.11.2", update_available=False)
        self.homeassistant = SimpleNamespace(info=AsyncMock(return_value=info), stats=AsyncMock(side_effect=self._core))
        self.supervisor = SimpleNamespace(
            info=AsyncMock(return_value=sup), stats=AsyncMock(return_value=_stats(1.5, 4.0))
        )
        self.addons_client = SimpleNamespace(
            list=AsyncMock(side_effect=self._list),
            addon_info=AsyncMock(side_effect=self._info),
            addon_stats=AsyncMock(side_effect=lambda slug: _stats(0.5, 2.0)),
        )

    async def _core(self) -> SimpleNamespace:
        if self.fail:
            raise ConnectionError("Supervisor restarting")
        return _stats(12.0, 30.0)

    async def _list(self) -> list[SimpleNamespace]:
        return [
            SimpleNamespace(
                slug=a["slug"],
                name=a["name"],
                state=a["state"],
                version="1.0",
                version_latest="1.1" if a["update"] else "1.0",
                update_available=a["update"],
            )
            for a in self.addons
        ]

    async def _info(self, slug: str) -> SimpleNamespace:
        return SimpleNamespace(boot=next(a["boot"] for a in self.addons if a["slug"] == slug))

    @property
    def client(self) -> SimpleNamespace:
        return SimpleNamespace(homeassistant=self.homeassistant, supervisor=self.supervisor, addons=self.addons_client)


@pytest.fixture
def supervisor(hass: HomeAssistant):
    fake = FakeSupervisor()
    hass.config.components.add("hassio")
    with patch("custom_components.system_hub.containers.monitor._client", side_effect=lambda _hass: fake.client):
        yield fake


async def _tick(hass: HomeAssistant, freezer: FrozenDateTimeFactory, delta: timedelta) -> None:
    """Move the clock past a refresh and wait for it: the scheduled refresh runs as a background task."""
    freezer.tick(delta)
    async_fire_time_changed(hass)
    await hass.async_block_till_done(wait_background_tasks=True)


async def _setup(hass: HomeAssistant, **options) -> MockConfigEntry:
    entry = MockConfigEntry(
        domain=DOMAIN, title="System Hub", options={CONF_MODULES: ["containers"], "containers": options}
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


async def test_containers_are_read(hass: HomeAssistant, supervisor: FakeSupervisor) -> None:
    await _setup(hass)
    running = hass.states.get(RUNNING)
    assert running.state == "3"
    assert running.attributes["total"] == 4
    assert running.attributes["error"] is None
    by_slug = {c["slug"]: c for c in running.attributes["containers"]}
    assert by_slug["homeassistant"]["kind"] == "core"
    assert by_slug["homeassistant"]["cpu_percent"] == 12.0
    assert by_slug["homeassistant"]["update_available"] is True
    assert by_slug["supervisor"]["memory_percent"] == 4.0
    assert by_slug["core_mosquitto"]["boot"] == "auto"
    assert by_slug["core_mosquitto"]["memory_usage"] == 20_000_000
    # A stopped add-on has no statistics, and one started by hand only is not expected to run.
    assert by_slug["a0d7b954_vscode"]["cpu_percent"] is None
    assert by_slug["a0d7b954_vscode"]["expected"] is False
    assert by_slug["a0d7b954_vscode"]["down"] is False
    supervisor.addons_client.addon_stats.assert_awaited_once_with("core_mosquitto")
    assert hass.states.get(DOWN).state == "0"
    assert hass.states.get(LAST_UPDATE).state != "unknown"


async def test_nothing_is_restarted(hass: HomeAssistant, supervisor: FakeSupervisor) -> None:
    """Monitoring only: no start, stop or restart call."""
    calls = async_mock_service(hass, "hassio", "addon_restart")
    supervisor.addons[0]["state"] = "error"
    await _setup(hass)
    assert hass.states.get(DOWN).state == "1"
    assert not calls
    assert not hasattr(supervisor.addons_client, "restart_addon")


async def test_down_and_back_are_notified(
    hass: HomeAssistant, supervisor: FakeSupervisor, freezer: FrozenDateTimeFactory
) -> None:
    notify = async_mock_service(hass, "notify", "mobile_app_phone")
    await _setup(hass, notify_services=["notify.mobile_app_phone"])
    notifications = persistent_notification._async_get_or_create_notifications(hass)
    assert not notifications

    supervisor.addons[0]["state"] = "stopped"
    await _tick(hass, freezer, timedelta(seconds=61))
    down = hass.states.get(DOWN)
    assert down.state == "1"
    assert down.attributes["containers"] == [{"slug": "core_mosquitto", "name": "Mosquitto broker", "state": "stopped"}]
    notification = notifications[f"{DOMAIN}_containers_core_mosquitto"]
    assert notification["title"] == "Container stopped"
    assert notification["message"] == "Mosquitto broker should be running but is stopped."
    assert notify[-1].data == {"title": "Container stopped", "message": notification["message"]}

    supervisor.addons[0]["state"] = "started"
    await _tick(hass, freezer, timedelta(seconds=61))
    assert hass.states.get(DOWN).state == "0"
    assert f"{DOMAIN}_containers_core_mosquitto" not in notifications
    assert notify[-1].data["title"] == "Container back"


async def test_no_notification_when_turned_off(
    hass: HomeAssistant, supervisor: FakeSupervisor, freezer: FrozenDateTimeFactory
) -> None:
    await _setup(hass, notify=False)
    supervisor.addons[0]["state"] = "error"
    await _tick(hass, freezer, timedelta(seconds=61))
    assert hass.states.get(DOWN).state == "1"
    assert not persistent_notification._async_get_or_create_notifications(hass)


async def test_already_down_at_the_first_refresh_is_not_notified(
    hass: HomeAssistant, supervisor: FakeSupervisor
) -> None:
    supervisor.addons[0]["state"] = "stopped"
    await _setup(hass)
    assert hass.states.get(DOWN).state == "1"
    assert not persistent_notification._async_get_or_create_notifications(hass)


async def test_supervisor_error_keeps_the_last_figures(
    hass: HomeAssistant, supervisor: FakeSupervisor, freezer: FrozenDateTimeFactory
) -> None:
    await _setup(hass)
    supervisor.fail = True
    await _tick(hass, freezer, timedelta(seconds=61))
    running = hass.states.get(RUNNING)
    assert running.state == "3"
    assert running.attributes["error"] == "Supervisor restarting"

    with pytest.raises(HomeAssistantError) as err:
        await hass.services.async_call(DOMAIN, "containers_refresh", {}, blocking=True)
    assert err.value.translation_key == "containers_read_failed"

    supervisor.fail = False
    await hass.services.async_call(DOMAIN, "containers_refresh", {}, blocking=True)
    assert hass.states.get(RUNNING).attributes["error"] is None


async def test_state_since_and_history(
    hass: HomeAssistant, supervisor: FakeSupervisor, freezer: FrozenDateTimeFactory
) -> None:
    entry = await _setup(hass, scan_interval=60)
    monitor = entry.runtime_data.containers
    since = monitor.containers["core_mosquitto"].since
    assert len(monitor.history["homeassistant"]) == 1
    # A refresh within the history step adds no point; the state's `since` is kept while it doesn't change.
    await _tick(hass, freezer, timedelta(seconds=61))
    assert len(monitor.history["homeassistant"]) == 1
    assert monitor.containers["core_mosquitto"].since == since
    await _tick(hass, freezer, timedelta(minutes=5, seconds=1))
    assert len(monitor.history["homeassistant"]) == 2
    assert monitor.history["homeassistant"][-1][1:] == (12.0, 30.0)
    # An add-on uninstalled drops out, with its history.
    supervisor.addons.pop(1)
    await hass.services.async_call(DOMAIN, "containers_refresh", {}, blocking=True)
    assert "a0d7b954_vscode" not in monitor.history
    assert hass.states.get(RUNNING).attributes["total"] == 3


async def test_options(hass: HomeAssistant, supervisor: FakeSupervisor) -> None:
    entry = await _setup(hass)
    result = await hass.config_entries.options.async_init(entry.entry_id)
    assert result["menu_options"] == ["modules", "containers"]
    result = await hass.config_entries.options.async_configure(result["flow_id"], {"next_step_id": "containers"})
    assert result["type"] is FlowResultType.FORM
    result = await hass.config_entries.options.async_configure(
        result["flow_id"],
        {"scan_interval": 30, "notify": False, "notify_services": ["mobile_app_phone", " "]},
    )
    assert result["type"] is FlowResultType.CREATE_ENTRY
    await hass.async_block_till_done()
    assert entry.options["containers"] == {
        "scan_interval": 30,
        "notify": False,
        "notify_services": ["notify.mobile_app_phone"],
    }
    assert entry.runtime_data.containers.notify is False


async def test_needs_the_supervisor(hass: HomeAssistant) -> None:
    """Without the Supervisor (a Container or Core installation), the module can't be turned on."""
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": "user"})
    defaults = {str(key): key.default() for key in result["data_schema"].schema}
    assert defaults["containers"] is False
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], {"containers": True, "watchdog": True, "marketplace": False}
    )
    assert result["errors"] == {"containers": "supervisor_not_available"}


async def test_diagnostics(hass: HomeAssistant, supervisor: FakeSupervisor) -> None:
    from custom_components.system_hub.diagnostics import async_get_config_entry_diagnostics  # noqa: PLC0415

    entry = await _setup(hass)
    diagnostics = await async_get_config_entry_diagnostics(hass, entry)
    assert diagnostics["modules"] == ["containers"]
    assert len(diagnostics["containers"]["containers"]) == 4
    assert diagnostics["containers"]["error"] is None
