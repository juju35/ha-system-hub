"""Device attributes read through the parent for a sub-device."""

from types import SimpleNamespace

import attr
from homeassistant.helpers import device_registry as dr

from custom_components.system_hub.registry_compat import device_attr


def _device(**kwargs) -> dr.DeviceEntry:
    """A device entry; config_entry_id is required since 2026.10 (config_entries before)."""
    if "config_entry_id" in attr.fields_dict(dr.DeviceEntry):
        kwargs["config_entry_id"] = "entry"
    return dr.DeviceEntry(**kwargs)


class _Devices:
    def __init__(self, *devices):
        self._devices = {d.id: d for d in devices}

    def async_get(self, device_id):
        return self._devices.get(device_id)


def test_device_attr_full_device() -> None:
    device = _device(id="d", model="M1", manufacturer="ACME")
    assert device_attr(_Devices(device), device, "model") == "M1"


def test_device_attr_sub_device_reads_parent() -> None:
    parent = _device(id="p", model="Hub", manufacturer="ACME")
    child = SimpleNamespace(id="c", parent_device_id="p")
    devices = _Devices(parent)
    assert device_attr(devices, child, "model") == "Hub"
    assert device_attr(devices, child, "manufacturer") == "ACME"


def test_device_attr_missing() -> None:
    assert device_attr(_Devices(), None, "model") is None
    assert device_attr(_Devices(), SimpleNamespace(id="c", parent_device_id="gone"), "model") is None
