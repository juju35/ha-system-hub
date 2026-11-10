# Changelog

## 0.1.0 - Unreleased

### New
- Repository set up: the System Hub integration (single entry), its CI and its icon.
- **Modules**: each feature is a module turned on or off in the setup and in **Configure → Modules**. A module turned off stops its checks, its entities and its device are removed and its actions refuse to run; its settings and saved state are kept.
- **Containers module** (new): Home Assistant Core, the Supervisor and every add-on read from the Supervisor at the interval chosen: state, version and update, CPU, memory, network and disk, 24 hours of CPU and memory for the panel. Monitoring only. An add-on started at boot that stops is notified (persistent notification and notify actions), and its return too. Sensors of the running and stopped containers, action `system_hub.containers_refresh`.
- **Watchdog module** (from Integration Watchdog 1.10.0): reloads the integrations whose entities are all unavailable, power cycles devices through their smart plug, notifications, Repairs issue with **Try again**, history kept across restarts. Actions `system_hub.watchdog_check` and `system_hub.watchdog_reset`, events `system_hub_integration_reloaded` and `system_hub_device_power_cycled`.
- **Marketplace module** (from Marketplace Refresh 2.6.1): server-side check of the Marketplace updates at the interval chosen, installs on demand with an optional backup first. Actions `system_hub.marketplace_check_updates`, `marketplace_check_repository` and `marketplace_install_updates`, event `system_hub_marketplace_updates_found`.
- **Batteries module** (from Battery Monitor 1.19.0): low batteries notified at two times a day after a duration below the threshold, unavailable batteries to check, replacement forecast from the history, spare batteries per type. Actions `system_hub.batteries_notify`, `batteries_set_stock` and `batteries_export` (CSV), events `system_hub_battery_low` and `system_hub_battery_replaced`.
- Diagnostics of every module turned on; 23 languages.
