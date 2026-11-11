"""Device registry across Home Assistant versions."""

from __future__ import annotations

from typing import Any

from homeassistant.helpers import device_registry as dr


def device_attr(devices: dr.DeviceRegistry, device: Any, name: str) -> Any:
    """An attribute only a full device has (model, manufacturer…), read from the parent for a sub-device.

    Since 2026.11 the registry can return a sub-device (`ChildDeviceEntry`), which has none of these: reading one
    logs a deprecation warning and fails from 2027.9, `getattr` included.
    """
    for _ in range(5):
        if device is None or isinstance(device, dr.DeviceEntry):
            break
        parent_id = getattr(device, "parent_device_id", None)
        device = devices.async_get(parent_id) if parent_id else None
    return getattr(device, name, None) if isinstance(device, dr.DeviceEntry) else None
