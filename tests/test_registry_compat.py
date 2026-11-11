"""Device attributes read through the parent for a sub-device."""

from types import SimpleNamespace

from homeassistant.helpers import device_registry as dr

from custom_components.system_hub.registry_compat import device_attr


class _Devices:
    def __init__(self, *devices):
        self._devices = {d.id: d for d in devices}

    def async_get(self, device_id):
        return self._devices.get(device_id)


def test_device_attr_full_device() -> None:
    device = dr.DeviceEntry(id="d", model="M1", manufacturer="ACME")
    assert device_attr(_Devices(device), device, "model") == "M1"


def test_device_attr_sub_device_reads_parent() -> None:
    parent = dr.DeviceEntry(id="p", model="Hub", manufacturer="ACME")
    child = SimpleNamespace(id="c", parent_device_id="p")
    devices = _Devices(parent)
    assert device_attr(devices, child, "model") == "Hub"
    assert device_attr(devices, child, "manufacturer") == "ACME"


def test_device_attr_missing() -> None:
    assert device_attr(_Devices(), None, "model") is None
    assert device_attr(_Devices(), SimpleNamespace(id="c", parent_device_id="gone"), "model") is None
