# Changelog

## 1.4.1 - 2026-11-12

### Fixed
- **Uptime** in French (also Italian and Polish): the **System** tab's tile, the **Status** tab and the System Monitor card read "En marche depuis 22 h 10", which looks like the time of the last boot. They now read **Temps de fonctionnement** (`22 h 10 min de fonctionnement` on the **Status** tab).

## 1.4.0 - 2026-11-11

### New
- **System Monitor cards: sensors of your choice** ([#55](https://github.com/juju35/ha-system-hub/issues/55), thanks @Matssa56): `entities` sets the sensors for the CPU, temperature, RAM, swap, load and last boot (also in the visual editor, under **Sensors of your choice**), for disks (a usage % sensor, or used and free ones, by the name to show) and for network interfaces (download and upload rates, address). They replace the sensors found for the same value, disk or interface and are added to the others; without System Monitor, the cards show them alone.

## 1.3.1 - 2026-11-11

### Fixed
- **Home Assistant's version** on the **Status** tab and the **System** tab's version tile on an instance in another language than English: the Supervisor's update entities are found by their unique id, not by their English entity id (`update.home_assistant_core_mise_a_jour` in French). Without the Supervisor (a container or a Python install), the version running is shown, without an update to tell.
- **Uptime** on the **Status** tab and the **System** tab: System Monitor's last boot, an uptime without a translation key since Home Assistant 2026, was no longer recognised.

### Changed
- **Status** tab: the emblem beside the score is now drawn after System Hub's logo, larger (the house and its hub in the colour of the score, with a badge: a pulse, `!` or `×`), instead of a house with a heart.

## 1.3.0 - 2026-11-11

What the integrations System Hub replaces could do and System Hub could not yet.

### New
- **Git Sync, several repositories**, as the former Git Sync integration had one entry per repository: **Settings → Git Sync ⚙ → Add a repository**, **Another repository** (its repository settings, then its own options) and **Remove repositories**. Each further repository has its own device (**System Hub Git Sync (folder)**), entities named after its folder, repairs and saved state; the first one keeps the module's entities. The actions take an optional `repository` (path or id): without it, commit and push, pull and the export run on every repository, the others on the first one; the response keeps the first repository's result at its top and lists each one's in `results`. The panel's **Git Sync** tab has a chip per repository and the **Status** tab shows the one most in need of action; the card's actions run on the repository it shows. Turned on next to the former Git Sync, the module takes over every one of its repositories, not only the configuration folder's.
- **Automations**: settings to leave devices and entities out, as the Automation Monitor cards' `exclude_devices` and `exclude_entities`: **Ignored devices** (their unavailable linked entities and the failed automations attached to them) and **Ignored entities** (entity ids, or patterns with `*` and `?`, case-insensitive). They are left out of the tab, its counts and the Status tab; while some failures are left out, **Clear all** clears only the ones listed. In **Settings → Automations ⚙** or with ⚙ in the tab.
- **Restart Home Assistant** and **Reload configuration** at the top of the panel's **System** tab, each confirmed in a dialog. The restart checks the configuration first, as Home Assistant's own dialog does, shows the errors and is refused while it is invalid; the reload reads again every YAML configuration Home Assistant can reload (`homeassistant.reload_all`).
- **Configure** on the integration's page opens System Hub's settings as a menu, the same as the panel's **Settings** tab (it only pointed to the panel before).

### Improved
- **Home Assistant 2024.12 or newer**, as the integrations System Hub replaces, instead of 2026.11: only the **Marketplace** module needs 2026.11 (it is not offered without the Marketplace). Before 2026.11, System Hub is added as a custom repository of HACS. A CI job runs the tests on Home Assistant 2024.12.

## 1.2.0 - 2026-11-11

### New
- **Automation Monitor cards** (`custom:automation-monitor-card`, `custom:automation-monitor-mini-card`) served by System Hub, as the System Monitor cards: [ha-automation-monitor-card](https://github.com/juju35/ha-automation-monitor-card) is archived. Remove its dashboard resource so the cards are not registered twice.

## 1.1.1 - 2026-11-11

### Changed
- **README**: the Status tab as the main screenshot.
- **Processes that may be stopped**: chosen in **Settings → Containers & process ⚙**, with the processes they concern, instead of the System settings. Those saved there by 1.0.3 still apply, and move once the Containers & process settings are saved.

## 1.1.0 - 2026-11-11

### New
- A module turned on for the first time takes over the settings of the standalone integration it replaces, so that nothing has to be set again ([#49](https://github.com/juju35/ha-system-hub/issues/49), thanks @FredM67): Watchdog (ignored integrations, power cycles…), Marketplace Refresh, Battery Monitor and Orphan Entities (ignored integrations and entities). Git Sync's repository form is filled with the standalone integration's repository, remote, SSH key and author, and its schedule, export and notification settings are kept (the configuration folder's repository when it had several). A module already set keeps its settings.

### Improved
- **README**, *Migrating*: the standalone repositories are archived, raise a repair while they run next to System Hub, and their settings are taken over.

## 1.0.3 - 2026-11-11

### New
- **Status tab**: a Home Assistant home beside the score, with the colour of the ring: `home-heart` from 80, `home-alert` from 50, `home-remove` below.
- **Processes that may be stopped**: chosen in **Settings → System ⚙** among the processes System Monitor watches. Stopped, they are no problem: not counted on the Status tab, grey in the processes list ("Stopped (allowed)"), and no red status nor alert on the System Monitor cards.

## 1.0.2 - 2026-11-11

### Fixed
- **Batteries** and **Orphans**: no more deprecation warning `accesses ChildDeviceEntry.model` / `.manufacturer` in the log (it would fail from Home Assistant 2027.9) for a battery or an orphan on a sub-device: the model and manufacturer are read from its parent device (reported on juju35/ha-smart-comfort#58 by @FredM67).

## 1.0.1 - 2026-11-11

### Fixed
- **Panel**: it opened on the System tab instead of the first tab of the order (Status): the tab was picked before the order was read. Every tab is now in the address, the first one too, so the panel's bare address always opens the first tab.

## 1.0.0 - 2026-11-11

### New
- **Status tab**, the first tab: the health of the instance at a glance. A score out of 100 in a ring (100, less 15 per area needing action, 5 per area to watch, 1 per area with something to know), the points to check by level, the Home Assistant version and uptime; then one tile per area in the order of the tabs (System, Containers & process, Updates, Watchdog, Automations, Batteries, Git Sync, Orphans), each with its level, a few words, its details, and opening its tab. An order of the tabs saved before puts it first.

### Improved
- **Settings tab**: the modules and the tabs in one list, as Home Assistant's sidebar editor. **Enabled** then **Disabled**; each row enabled has a handle ═ to drag it (or ↑ ↓ from it with the keyboard) to set the order of the tabs, the first one opening by default; each module its switch and its settings ⚙ opened in place, the System thresholds in the System row.
- **README**: the settings described in the panel's Settings tab (the paths through **Configure** replaced); the screenshots of the old Configure forms replaced by each module's settings opened in the Settings tab, rendered by the CI from the options flow's own forms (`scripts/screenshot-forms.json`, checked against the flow by the tests).
- **Status tab**: the tiles take the icons of the modules, as in Settings.
- **README**: every card shown at the top, under the panel, and the Orphan Entities card's other states (selected, used, filtered, no orphan, mini card).

### Fixed
- **Configure** no longer shows the options menu (Home Assistant 2026.11 no longer tells the panel's flow apart from it): the integration page has no Configure anymore, the System Hub devices link to the panel's Settings tab, and an options flow started from anywhere but the panel stops with that link.
- **Panel**: "Unable to load: [object Object]" when the connection to Home Assistant was lost (Home Assistant restarting, the app back from the background). The error now says what happened, what is shown stays while the connection is back, and the panel reads its state again by itself (after 3 seconds, when the connection is back, and when the page is shown again).

## 0.5.5 - 2026-11-11

### Improved
- **Git Sync tab**: the list of changed files shows their count, and is folded when there are more than 5 (a click opens it).

## 0.5.4 - 2026-11-11

### Improved
- **Configure opens the panel**: on the integration's page, Configure no longer shows the menu of forms but a link to the panel's Settings tab, where every module's settings are (the same forms). The devices' **Visit** link opens it too. Turning Git Sync on without a repository opens its form in the Settings tab.

### Fixed
- **Marketplace tab**: the count of updates (and **Update all**) is that of the updates waiting now: an update installed since the last check no longer leaves "1 update available" without a card. The module counts its updates again as soon as one is installed or found outside a check (its status sensor too).
- **Marketplace tab on a phone**: the settings button sits in the header's corner instead of overflowing it, the GitHub icon stays next to its line, and "GitHub" is no longer written twice ("GitHub connected · 3555 requests left").

## 0.5.3 - 2026-11-11

### Fixed
- **Logos of the Marketplace updates** (panel and Marketplace Refresh card): Home Assistant's brand images (`/api/brands/…`, since 2026.3) need an access token: it is read once (`brands/access_token`) and added; a logo that still doesn't load gives way to the initial. The header's last and next check wrap instead of being cut.

## 0.5.2 - 2026-11-11

### Improved
- **Module settings in the panel**: the Settings tab lists every module (and the System thresholds) with its switch; opening one shows its settings in place, with its further steps (power cycles, battery types, the import from Battery Monitor, the Git repository). They are System Hub's own Configure forms, driven through Home Assistant's flow API: same fields, same checks and errors. **Module settings** in a module's tab opens its section.

### Fixed
- **Marketplace**: GitHub's account and requests left are read as soon as Home Assistant has started and every 15 minutes, not only during a check: after a restart, the panel showed them only after the next check. Up to date, the tab no longer repeats it in an empty list.
- The module descriptions and the forms' labels are read from Home Assistant's latest translations: the descriptions were missing from the Settings tab.

## 0.5.1 - 2026-11-11

### Improved
- **Marketplace tab**: a card per update, as in the Marketplace Refresh card: its logo, installed → latest version with the size of the change (major, minor, patch), the start of its release notes, **Release notes** and its own **Update** (spinning while it installs); a header with the check, the repositories that could not be checked and GitHub (account, requests left, next try after the limit); the repositories that could not be checked link to GitHub.
- **Containers & process** (the Containers tab, renamed): the processes System Monitor watches are listed below the containers, and no longer in the System tab while this tab is shown.

## 0.5.0 - 2026-11-11

### Improved
- **Containers tab**: the real Docker containers, by their name (`homeassistant`, `hassio_supervisor`, `app_<slug>`…) with their image and tag, the Supervisor's plugins too (audio, cli, dns, multicast, observer, down when they stop), the update available in a badge.
- **Spinners in the panel**: every button spins while its action runs, until the panel has read the result (Try again, Clear, Remove, Ignore, Pull, Export, Write with AI, set the spare batteries…); Check now and Check for updates spin while the check runs on the server, Update all while the updates install; the panel, the charts and the Orphans list show a spinner while they load.
- **Feedback**: a finished action says so in Home Assistant's toast; a failure stays next to the buttons.
- **Times in words** in the tiles and the lists ("5 minutes ago", "in 3 hours"), the date beyond a week.
- **Settings**: a bar with **Save** and **Discard** shows up as soon as something changed; Save spins until the modules have reloaded.
- **Module settings** at the end of every module tab's buttons; destructive actions (Remove, Remove devices, Clear all) in red.
- **Keyboard**: the rows and tiles that open an entity are reached with Tab and opened with Enter; the focused button keeps the focus through the refresh every 10 seconds.

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
