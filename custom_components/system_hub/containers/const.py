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
