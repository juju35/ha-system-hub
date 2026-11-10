"""Fixtures for System Hub tests."""

from __future__ import annotations

import logging
import os
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers import frame
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.system_hub.const import DOMAIN


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(request: pytest.FixtureRequest):
    """Load custom_components/ in every test (after the recorder, for the tests that use it)."""
    if "recorder_mock" in request.fixturenames:
        request.getfixturevalue("recorder_mock")
    request.getfixturevalue("enable_custom_integrations")
    yield


class _DeprecationRecorder(logging.Handler):
    """Collects Home Assistant deprecation reports that name this integration."""

    def __init__(self) -> None:
        super().__init__(logging.WARNING)
        self.messages: list[str] = []

    def emit(self, record: logging.LogRecord) -> None:
        message = record.getMessage()
        lowered = message.lower()
        reported = record.name == frame.__name__ or "deprecated" in lowered or "will stop working" in lowered
        if reported and (f"'{DOMAIN}'" in message or f"custom_components/{DOMAIN}/" in message):
            self.messages.append(message)


@pytest.fixture(autouse=True)
def no_deprecated_calls():
    """Fail a test whose code path makes Home Assistant report a deprecated call of this integration.

    Silent on Home Assistant versions without the deprecation; on newer ones, catches what is left.
    Messages also go to $DEPRECATIONS_LOG (if set), which CI turns into annotations.
    """
    # The frame helper reports each call site once per process: forget them so every test sees its own.
    getattr(frame, "_REPORTED_INTEGRATIONS", set()).clear()
    recorder = _DeprecationRecorder()
    root = logging.getLogger()
    root.addHandler(recorder)
    try:
        yield
    finally:
        root.removeHandler(recorder)
    if recorder.messages and (path := os.environ.get("DEPRECATIONS_LOG")):
        with open(path, "a", encoding="utf-8") as log:
            log.writelines(f"{m}\n" for m in recorder.messages)
    assert not recorder.messages, "\n".join(recorder.messages)


def add_integration(
    hass: HomeAssistant,
    domain: str,
    states: list[str],
    state: ConfigEntryState = ConfigEntryState.LOADED,
) -> MockConfigEntry:
    """A config entry in `state` with one sensor per item of `states`."""
    entry = MockConfigEntry(domain=domain, title=domain.title())
    entry.add_to_hass(hass)
    entry.mock_state(hass, state)
    registry = er.async_get(hass)
    for i, value in enumerate(states):
        entity = registry.async_get_or_create(
            "sensor",
            domain,
            f"{domain}_{i}",
            config_entry=entry,
            suggested_object_id=f"{domain}_{i}",
        )
        hass.states.async_set(entity.entity_id, value)
    return entry


def make_repo(
    full_name: str, category: str = "integration", pending: bool = False, fail: bool = False, custom: bool = False
):
    """A stand-in for a Marketplace repository; `custom` for one added from a link (not in the catalog)."""
    repo = SimpleNamespace(
        data=SimpleNamespace(id=str(abs(hash(full_name)) % 10**9), full_name=full_name, category=category),
        pending_update=pending,
        custom=custom,
        update_repository=AsyncMock(side_effect=RuntimeError("GitHub down") if fail else None),
    )
    return repo


@pytest.fixture
def fake_marketplace(hass):
    """The Marketplace manager with the attributes Marketplace Refresh uses, GitHub connected, marked as loaded."""
    repos = [
        make_repo("juju35/ha-git-sync"),
        make_repo("juju35/ha-parcel", pending=True),
        make_repo("piitaya/lovelace-mushroom", category="plugin"),
    ]

    def is_default(repo_id: str) -> bool:
        return not any(repo.custom for repo in repos if repo.data.id == repo_id)

    marketplace = SimpleNamespace(
        repositories=SimpleNamespace(list_installed=repos, is_default=is_default),
        data=SimpleNamespace(async_write=AsyncMock()),
        coordinators={"integration": MagicMock(), "plugin": MagicMock()},
        system=SimpleNamespace(disabled=False, disabled_reason=None),
        common=SimpleNamespace(categories={"integration", "plugin", "theme"}),
        github_connected=True,
        async_get_all_category_repositories=AsyncMock(),
    )
    hass.config.components.add("marketplace")
    with patch("custom_components.system_hub.marketplace.refresher._loaded_marketplace", return_value=marketplace):
        yield marketplace


def add_battery(
    hass: HomeAssistant,
    name: str,
    state: str,
    *,
    domain: str = "sensor",
    platform: str = "zha",
    device: str | None = None,
    area: str | None = None,
) -> str:
    """A battery entity of `platform`, on a device named `device` (or `name`), placed in `area`."""
    # One config entry per platform: since 2026.8 a device belongs to a single config entry, so the
    # same identifiers under another entry would make another device.
    entry = next(iter(hass.config_entries.async_entries(platform)), None)
    if entry is None:
        entry = MockConfigEntry(domain=platform)
        entry.add_to_hass(hass)
    devices = dr.async_get(hass)
    dev = devices.async_get_or_create(
        config_entry_id=entry.entry_id,
        identifiers={(platform, device or name)},
        name=device or name,
    )
    if area:
        from homeassistant.helpers import area_registry as ar

        area_id = ar.async_get(hass).async_get_or_create(area).id
        devices.async_update_device(dev.id, area_id=area_id)
    entity = er.async_get(hass).async_get_or_create(
        domain,
        platform,
        f"{name}_{domain}",
        config_entry=entry,
        device_id=dev.id,
        suggested_object_id=f"{name.lower().replace(' ', '_')}_battery",
    )
    attributes = {"device_class": "battery"}
    if domain == "sensor":
        attributes["unit_of_measurement"] = "%"
    hass.states.async_set(entity.entity_id, state, attributes)
    return entity.entity_id
