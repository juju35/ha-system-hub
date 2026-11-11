"""Constants for System Hub."""

from __future__ import annotations

from typing import Final

DOMAIN: Final = "system_hub"
# Same as manifest.json: the frontend URLs carry it, so that browsers load a new release.
VERSION: Final = "0.5.4"

# Options: the modules turned on, then one dict of settings per module ({"watchdog": {...}}).
CONF_MODULES: Final = "modules"
MODULE_CONTAINERS: Final = "containers"
MODULE_WATCHDOG: Final = "watchdog"
MODULE_MARKETPLACE: Final = "marketplace"
MODULE_BATTERIES: Final = "batteries"
MODULE_GIT_SYNC: Final = "git_sync"
# Shows what Automation Monitor reports; no entities of its own.
MODULE_AUTOMATIONS: Final = "automations"
MODULE_ORPHANS: Final = "orphans"
MODULES: Final = (
    MODULE_CONTAINERS,
    MODULE_WATCHDOG,
    MODULE_MARKETPLACE,
    MODULE_BATTERIES,
    MODULE_GIT_SYNC,
    MODULE_AUTOMATIONS,
    MODULE_ORPHANS,
)

# Panel: the order of its tabs (the System tab and the modules; Settings always comes last).
CONF_TABS: Final = "tabs"
TAB_SYSTEM: Final = "system"
# The System tab's thresholds (orange, red) in %, °C for the temperature, in the options under "system".
CONF_SYSTEM: Final = "system"
DEFAULT_THRESHOLDS: Final = {
    "cpu": (70, 90),
    "ram": (70, 90),
    "disk": (80, 90),
    "temperature": (70, 85),
    "swap": (50, 80),
}

# Home Assistant's own Marketplace integration, which the Marketplace module drives.
MARKETPLACE_DOMAIN: Final = "marketplace"

# The sidebar panel's path: /system-hub, its Settings tab /system-hub/settings.
PANEL_PATH: Final = "system-hub"
# The source the Settings tab starts the options flow with (Configure, started by the frontend, links to it).
SOURCE_PANEL: Final = "system_hub_panel"
