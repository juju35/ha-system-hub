"""Constants for System Hub."""

from __future__ import annotations

from typing import Final

DOMAIN: Final = "system_hub"
# Same as manifest.json: the frontend URLs carry it, so that browsers load a new release.
VERSION: Final = "0.3.0"

# Options: the modules turned on, then one dict of settings per module ({"watchdog": {...}}).
CONF_MODULES: Final = "modules"
MODULE_CONTAINERS: Final = "containers"
MODULE_WATCHDOG: Final = "watchdog"
MODULE_MARKETPLACE: Final = "marketplace"
MODULE_BATTERIES: Final = "batteries"
MODULE_GIT_SYNC: Final = "git_sync"
MODULE_ORPHANS: Final = "orphans"
MODULES: Final = (
    MODULE_CONTAINERS,
    MODULE_WATCHDOG,
    MODULE_MARKETPLACE,
    MODULE_BATTERIES,
    MODULE_GIT_SYNC,
    MODULE_ORPHANS,
)

# Panel: the order of its tabs (the System tab and the modules; Settings always comes last).
CONF_TABS: Final = "tabs"
TAB_SYSTEM: Final = "system"

# Home Assistant's own Marketplace integration, which the Marketplace module drives.
MARKETPLACE_DOMAIN: Final = "marketplace"
