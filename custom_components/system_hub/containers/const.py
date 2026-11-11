"""Constants of the Containers module."""

from __future__ import annotations

from datetime import timedelta
from typing import Final

# Seconds between two reads of the Supervisor.
CONF_SCAN_INTERVAL: Final = "scan_interval"
DEFAULT_SCAN_INTERVAL: Final = 60
MIN_SCAN_INTERVAL: Final = 10
MAX_SCAN_INTERVAL: Final = 3600
# Notify when a container that should run (Core, the Supervisor, an add-on started at boot) stops, and when it is back.
CONF_NOTIFY: Final = "notify"
CONF_NOTIFY_SERVICES: Final = "notify_services"

KIND_CORE: Final = "core"
KIND_SUPERVISOR: Final = "supervisor"
KIND_ADDON: Final = "addon"
# The Supervisor's plugins: containers of their own (hassio_audio, hassio_cli…), always running.
KIND_PLUGIN: Final = "plugin"
PLUGINS: Final = {"audio": "Audio", "cli": "CLI", "dns": "DNS", "multicast": "Multicast", "observer": "Observer"}
# Docker names: the add-ons' containers are app_<slug> since Supervisor 2026.07.4, addon_<slug> before.
CONTAINER_CORE: Final = "homeassistant"
CONTAINER_PREFIX: Final = "hassio_"
APP_PREFIX_SINCE: Final = (2026, 7, 4)
# Slugs of the two containers that are not add-ons.
SLUG_CORE: Final = "homeassistant"
SLUG_SUPERVISOR: Final = "supervisor"

STATE_STARTED: Final = "started"
STATE_STARTUP: Final = "startup"

# CPU and memory kept for the panel: one point every HISTORY_STEP over HISTORY_SPAN, in memory only.
HISTORY_STEP: Final = timedelta(minutes=5)
HISTORY_SPAN: Final = timedelta(hours=24)
# A Supervisor call that doesn't answer in this time counts as failed: the next refresh tries again.
REQUEST_TIMEOUT: Final = 20

SERVICE_REFRESH: Final = "containers_refresh"
