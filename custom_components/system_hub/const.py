"""Constants for System Hub."""

from __future__ import annotations

from typing import Final

DOMAIN: Final = "system_hub"
# Same as manifest.json: the frontend URLs carry it, so that browsers load a new release.
VERSION: Final = "2.7.1"

# Options: the modules turned on, then one dict of settings per module ({"watchdog": {...}}).
CONF_MODULES: Final = "modules"
MODULE_CONTAINERS: Final = "containers"
MODULE_WATCHDOG: Final = "watchdog"
# Home Assistant's log grouped by integration; no entities of its own.
MODULE_LOGS: Final = "logs"
# The recorder's database: size, retention, the entities that write the most; no entities of its own.
MODULE_DATABASE: Final = "database"
# Refused logins, accounts, tokens, exposure, add-ons, credentials in clear; no entities of its own.
MODULE_SECURITY: Final = "security"
MODULE_MARKETPLACE: Final = "marketplace"
# Reads Home Assistant's own backups (the Backup integration); no entities of its own.
MODULE_BACKUPS: Final = "backups"
# The devices of the radio integrations not heard from for a while; no entities of its own.
MODULE_SILENT: Final = "silent"
MODULE_BATTERIES: Final = "batteries"
MODULE_GIT_SYNC: Final = "git_sync"
# Shows what Automation Monitor reports; no entities of its own.
MODULE_AUTOMATIONS: Final = "automations"
MODULE_ORPHANS: Final = "orphans"
MODULES: Final = (
    MODULE_CONTAINERS,
    MODULE_DATABASE,
    MODULE_SECURITY,
    MODULE_LOGS,
    MODULE_WATCHDOG,
    MODULE_MARKETPLACE,
    MODULE_BACKUPS,
    MODULE_SILENT,
    MODULE_BATTERIES,
    MODULE_GIT_SYNC,
    MODULE_AUTOMATIONS,
    MODULE_ORPHANS,
)

# Panel: the order of its tabs (the System tab and the modules; Settings always comes last).
CONF_TABS: Final = "tabs"
TAB_STATUS: Final = "status"
TAB_SYSTEM: Final = "system"
# The System tab's thresholds (orange, red) in %, °C for the temperature, in the options under "system".
CONF_SYSTEM: Final = "system"
# System settings: the System Monitor processes that may be stopped (entity ids), not counted as a problem
CONF_STOPPABLE_PROCESSES: Final = "stoppable_processes"
DEFAULT_THRESHOLDS: Final = {
    "cpu": (70, 90),
    "ram": (70, 90),
    "disk": (80, 90),
    "temperature": (70, 85),
    "swap": (50, 80),
}

# Backups: the age from which the last successful backup is a problem, in days.
CONF_BACKUP_MAX_AGE: Final = "max_age"
DEFAULT_BACKUP_MAX_AGE: Final = 3
BACKUP_DOMAIN: Final = "backup"

# Home Assistant's own Marketplace integration, which the Marketplace module drives.
MARKETPLACE_DOMAIN: Final = "marketplace"

# The sidebar panel's path: /system-hub, its Settings tab /system-hub/settings.
PANEL_PATH: Final = "system-hub"
# The source the Settings tab starts the options flow with (Configure, started by the frontend, links to it).
SOURCE_PANEL: Final = "system_hub_panel"
