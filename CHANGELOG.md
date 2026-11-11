# Changelog

## 0.4.0 - 2026-11-11

### New
- **Lovelace cards**, served by System Hub and added to the dashboard resources by itself (removed with the integration; loaded on every page with the resources in YAML mode), with the card types of the integrations they replace so their dashboards keep working:
  - the **System Monitor Card** and **Mini Card** (replaces [ha-system-monitor-card](https://github.com/juju35/ha-system-monitor-card));
  - the **Watchdog Card** and **Mini Card** (a card still pointing at Integration Watchdog's sensor finds System Hub's);
  - the **Marketplace Refresh Card**;
  - the **Battery Monitor Card** and **Mini Card**, with the battery types set in **Configure**;
  - the **Git Sync Card** and **Mini Card**, with the diff viewer.
- **System tab**: received and sent since the boot (System Monitor's network in and out, physical interfaces summed); the Home Assistant Core and OS versions, orange with the version available when an update is, opening Settings → Updates.
- **Thresholds** in **Configure → System: thresholds**: when CPU, RAM, disk, temperature and swap turn orange and red in the System tab (the rings, the tiles and the disks); the red one must be above the orange one.
- **Batteries tab**: **Export CSV** (every battery with its room, type, level, status, drain, days left and replacement date, made by the browser), the spare batteries by type with how many to buy and a form to set a type's stock, and a search by name, room or type.
- **Automations module and tab**: the failed automations and the unavailable linked entities reported by Automation Monitor, as in the Automation Monitor card: last failure, error, failed step and failures in a row, **Trace** and **Edit**, the automations, scripts and scenes using each entity, **Clear** and **Clear all** (asked first), **Refresh**, folded lists and **Show more**. On by default when Automation Monitor is loaded; no entities of its own; without Automation Monitor the tab links to adding it.
- **Orphans module** (replaces [ha-orphan-entities](https://github.com/juju35/ha-orphan-entities)): the entities their integration no longer provides — integration removed, integration not loaded, not provided, unavailable or unknown for longer than a delay (24 hours) — and the orphan devices, scanned every 15 minutes and shortly after the registries change, after a grace period at start (10 minutes); what still uses each one (automations, scripts, scenes, groups, dashboards); removal in bulk with each entity checked again; ignored integrations, entities and devices. Sensors **Orphaned entities** and **Last scan**, button **Scan now**, actions `system_hub.orphans_scan`, `orphans_remove`, `orphans_remove_devices` and `orphans_ignore` (administrators only), events `system_hub_orphans_removed` and `system_hub_orphans_devices_removed`. On by default; its settings in **Configure → Orphans**.
- **Orphans tab** in the panel: counters by reason, the list with a search, integration and reason filters, selection one by one or of every match, **Remove** and **Ignore** in bulk once confirmed, what uses each orphan with links, and the orphan devices; read from the new `system_hub/orphans` WebSocket command.
- The **Orphan Entities card** and mini card, served by System Hub with the Orphans module's entities and actions.

### Fixed
- **System tab**: the virtual interfaces (loopback, Docker, `hassio`, `veth…`, bridges, tunnels, VPNs) no longer count in the download and upload tile and the Network chart, as in the old System Monitor card.

## 0.3.0 - 2026-11-11

### New
- **Watchdog tab**: the power cycles set up, as in the Integration Watchdog panel: each device with its room, its plug and the plug's state, the delays, available or unavailable, the power cycles in a row, a link to the device; **Add or remove in Configure**.
- **Battery types** in **Configure → Batteries: Battery types**: the type and number of batteries of a battery, or of every device of its model, as in the Battery Monitor card; they come before Battery Notes. Untick one to remove it.
- **Import from Battery Monitor** in **Configure → Batteries: Import from Battery Monitor** (shown when Battery Monitor left something): its settings, the battery types set in its cards and its spare batteries.
- **Hide the batteries that are fine** in **Configure → Batteries**: the panel shows only the low and unavailable ones.
- **System tab**: the swap worked out from its use and free when its percentage sensor is off, the uptime as a duration, the IP address, the database size (File Size integration), the last and next automatic backups (Backup integration) and the processes watched by System Monitor.
- **Marketplace tab**: while a check runs, a progress bar with the share done, the repositories checked, the time left at the pace so far and the failures, read every 2 seconds; afterwards the repositories that could not be checked, those left out without a GitHub account, and GitHub's requests left.
- **Batteries tab** laid out as the Battery Monitor full screen view: the views as tabs, what to replace and the next replacement, the groups in columns with their batteries to check, compact rows tinted when low or unavailable, how long a battery has been low.

### Fixed
- **Batteries tab**: each room has its own icon (the one set in its area), as in the Battery Monitor card.

### Documentation
- Screenshots of every **Configure** form (the **Module settings** button of the panel), light and dark, taken from a running Home Assistant by `scripts/config-screenshots.mjs`.

## 0.2.0 - 2026-11-11

### New
- **System tab**: CPU, RAM, temperature and disk as rings with their last 24 hours behind them, and history charts of CPU, RAM and temperature, of the network and of the disks over 1 hour, 6 hours, 24 hours or 7 days, read from the recorder (hourly means for 7 days); each kind of data has its own colour. Download and upload share one tile.
- **Batteries tab**: every battery by level (the ones in error first, then the lowest), by room, by battery type or by replacement date (with the days left, the date and the daily drain), as in the Battery Monitor full screen view; the view chosen is remembered by the browser.
- **Git Sync tab**: **View changes** opens the diff viewer of the Git Sync card again: the changed files with their status and counts, each file's diff with old and new line numbers, and **Commit and push** from it.

## 0.1.0 - 2026-11-11

### New
- Repository set up: the System Hub integration (single entry), its CI and its icon.
- **Modules**: each feature is a module turned on or off in the setup and in **Configure → Modules**. A module turned off stops its checks, its entities and its device are removed and its actions refuse to run; its settings and saved state are kept.
- **Containers module** (new): Home Assistant Core, the Supervisor and every add-on read from the Supervisor at the interval chosen: state, version and update, CPU, memory, network and disk, 24 hours of CPU and memory for the panel. Monitoring only. An add-on started at boot that stops is notified (persistent notification and notify actions), and its return too. Sensors of the running and stopped containers, action `system_hub.containers_refresh`.
- **Watchdog module** (from Integration Watchdog 1.10.0): reloads the integrations whose entities are all unavailable, power cycles devices through their smart plug, notifications, Repairs issue with **Try again**, history kept across restarts. Actions `system_hub.watchdog_check` and `system_hub.watchdog_reset`, events `system_hub_integration_reloaded` and `system_hub_device_power_cycled`.
- **Marketplace module** (from Marketplace Refresh 2.6.1): server-side check of the Marketplace updates at the interval chosen, installs on demand with an optional backup first. Actions `system_hub.marketplace_check_updates`, `marketplace_check_repository` and `marketplace_install_updates`, event `system_hub_marketplace_updates_found`.
- **Batteries module** (from Battery Monitor 1.19.0): low batteries notified at two times a day after a duration below the threshold, unavailable batteries to check, replacement forecast from the history, spare batteries per type. Actions `system_hub.batteries_notify`, `batteries_set_stock` and `batteries_export` (CSV), events `system_hub_battery_low` and `system_hub_battery_replaced`.
- **Git Sync module** (from Git Sync 1.7.1, one repository): commits and pushes the configuration with AI commit messages, pulls, diff, dashboard export, secret guard, Repairs. The repository is checked with Git when the module is turned on. Actions `system_hub.git_sync_*`, events `system_hub_git_committed` and `system_hub_dashboards_exported`.
- **Sidebar panel** (administrators): System tab from the System Monitor sensors, a tab per module turned on with its actions, Settings to turn modules on or off and order the tabs; the tab in the address. WebSocket commands `system_hub/state` and `system_hub/update_settings`.
- Screenshots of every panel tab, light and dark and on a phone, rendered by `scripts/screenshots.py` with mock data; the **Screenshots** workflow refreshes them on the pull requests.
- Diagnostics of every module turned on; 23 languages.
