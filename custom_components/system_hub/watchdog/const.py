"""Constants of the Watchdog module."""

from __future__ import annotations

from typing import Final

from ..const import DOMAIN

CONF_SCAN_INTERVAL: Final = "scan_interval"
CONF_GRACE_PERIOD: Final = "grace_period"
CONF_IGNORED: Final = "ignored_integrations"
CONF_IGNORED_ENTRIES: Final = "ignored_entries"
CONF_MAX_RELOADS: Final = "max_reloads"
CONF_NOTIFY: Final = "notify_services"
# An entity that pauses the reloads while it is on (an input_boolean for maintenance, a schedule for the night…).
CONF_PAUSE_ENTITY: Final = "pause_entity"
# Grace period per integration domain, in minutes ({"zha": 30}), instead of the global one.
CONF_GRACE_OVERRIDES: Final = "grace_overrides"
PAUSE_DOMAINS: Final = ["input_boolean", "switch", "binary_sensor", "schedule"]
# Devices powered by a smart plug: switched off then on again when all their entities stay unavailable.
# A list of {"device_id", "switch", "delay" (minutes), "off_time" (seconds)}.
CONF_POWER_CYCLES: Final = "power_cycles"
CONF_DEVICE: Final = "device_id"
CONF_SWITCH: Final = "switch"
CONF_DELAY: Final = "delay"
CONF_OFF_TIME: Final = "off_time"
DEFAULT_CYCLE_DELAY: Final = 10
DEFAULT_OFF_TIME: Final = 10
MAX_OFF_TIME: Final = 300

# Minutes between two checks.
DEFAULT_SCAN_INTERVAL: Final = 5
# Minutes every entity of an integration must have been unavailable before it is reloaded.
DEFAULT_GRACE_PERIOD: Final = 15
MAX_MINUTES: Final = 1440
# Reloads in a row of an integration that stays unavailable, before giving up until it recovers.
# The delay between two of them doubles each time: grace, 2 x grace, 4 x grace...
DEFAULT_MAX_RELOADS: Final = 3
MAX_MAX_RELOADS: Final = 10

SERVICE_CHECK: Final = "watchdog_check"
SERVICE_RESET: Final = "watchdog_reset"
ATTR_ENTRY_ID: Final = "entry_id"
EVENT_RELOADED: Final = f"{DOMAIN}_integration_reloaded"
EVENT_POWER_CYCLED: Final = f"{DOMAIN}_device_power_cycled"


# Recent reloads (and give-ups) kept for the card, newest first, saved across restarts with the reload counts.
HISTORY_SIZE: Final = 20
STORAGE_KEY: Final = f"{DOMAIN}.watchdog"
STORAGE_VERSION: Final = 1
