"""Constants for System Hub."""

from __future__ import annotations

from typing import Final

DOMAIN: Final = "system_hub"
# Same as manifest.json: the frontend URLs carry it, so that browsers load a new release.
VERSION: Final = "0.1.0"

# Options: the modules turned on, then one dict of settings per module ({"watchdog": {...}}).
CONF_MODULES: Final = "modules"
MODULE_WATCHDOG: Final = "watchdog"
MODULE_MARKETPLACE: Final = "marketplace"
MODULES: Final = (MODULE_WATCHDOG, MODULE_MARKETPLACE)

# Home Assistant's own Marketplace integration, which the Marketplace module drives.
MARKETPLACE_DOMAIN: Final = "marketplace"
