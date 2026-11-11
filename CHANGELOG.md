# Changelog

## Unreleased

### New
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
