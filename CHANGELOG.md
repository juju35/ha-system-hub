# Changelog

## 2.3.4 - 2026-11-13

### Features
- **Updates tab: the projects' icons.** An update of one of juju35's projects without a picture of its own (the Lovelace cards, which have no brand icon) shows its project's icon, the round badge of the showcase site in its accent colour, instead of its initial; the renamed repositories are known by their former names too. An integration keeps its brand icon, the project's icon taking over if it does not load. Other repositories keep their initial.

## 2.3.3 - 2026-11-13

### Fixed
- Folding back on a tap elsewhere now works on iOS (Safari and the companion app): a tap on something that is not clickable sent no click to the page, so the detailed view of the mini cards, the unfolded lists and processes, and the Automation Monitor popup stayed open. The press and the release are caught instead; a slider dragged out of the card and a scroll do not fold anything.
- Leaving the card (another dashboard view, a conditional card hidden) brings it back in its default state.
- Clicks lost under an update: Home Assistant updates the card several times a second, and an update that rewrote the card between the press and the release replaced the element pressed, so that the click landed on the card itself and did nothing. The card is no longer rewritten while a press is in progress; the pending update is drawn at the click, or right after the release.
- Focus ring after a mouse click: the focus was put back on the clicked element after each update, which drew the focus ring. It is now kept across updates only for the keyboard (and in a text field).

## 2.3.2 - 2026-11-13

### Fixed
- **Occasional errors in the log lowered the status**: on the Status tab (and so the score, the sidebar icon and the status cards), any error of the last 24 hours made the Logs area orange. Only frequent errors are now a problem: an integration with at least **Errors that make a problem** of **Settings → Logs ⚙** (10 by default) in 24 hours turns the area red, with its errors and integrations alone; below it, the area stays in good health, **No frequent errors**, with the occasional errors counted in its details. The Logs tab still lists every error.

## 2.3.1 - 2026-11-13

### Fixed
- **Every other tab took two clicks (or taps)**: since 2.0.2, the route Home Assistant gives back after a tab chosen was kept and applied again at the next drawing, which brought that tab back over the one just chosen. It is now applied once, and a tab chosen in the panel always wins. Checked in a real Home Assistant, on a phone and on a computer.

## 2.3.0 - 2026-11-12

### Features
- System Monitor cards (#74): the CPU temperature gets its 24 h curve behind its gauge (and its bar on the mini card), like the CPU and RAM, on a 0–100 °C scale (212 °F in Fahrenheit); `show_disk: false` (also in the visual editor) removes the disk gauge of the System section when the Storage section already shows it.

### Documentation
- Using only the Lovelace cards (#73): the cards are served by the integration, so System Hub must stay added; add it with every module turned off to use only the cards (nothing monitored, no entity). Said in the integration's setup form, in every language, and in the README's Lovelace cards section, with how to hide the sidebar item.

## 2.2.0 - 2026-11-12

### New
- **Security: add-ons allowed unprotected.** An add-on that needs its protection mode off (an SSH terminal, say) can be allowed, with **Allow** in the add-ons of the Security tab (saved at once, no reload) or in **Add-ons allowed unprotected** of **Settings → Security ⚙** (the installed add-ons by name). It stays listed, marked **Allowed**, with **Withdraw**, and is no longer a problem on the Status tab, the sidebar icon and the status cards; its other flags (full hardware access, host network) are still shown.

## 2.1.0 - 2026-11-12

### Features
- `show_title` and `show_subtitle` options (also in the visual editors) hide a card header's title and its subtitle, separately, for a card placed under a section heading of its own (asked in juju35/ha-vehicle-card#72): System Monitor, Integration Watchdog, Marketplace, Orphan Entities, Automation Monitor, Git Sync and System Hub (status) cards; the Batteries card gets `show_title`.

## 2.0.2 - 2026-11-12

### Fixed
- **The panel went back to the Status tab by itself**, after an action that changed the status (a problem fixed, a message ignored, a token revoked…): to change the sidebar icon, System Hub registered its panel again, and Home Assistant built the open panel again, on its first tab. The icon now changes in each browser only (the status it reads, kept by the browser for the next page), and the panel is never registered again for it. It also went back to it with no action at all: Home Assistant gives the panel its route again at each of its updates, and that route was still the address the panel was opened with, as a tab chosen in the panel did not tell it. Home Assistant is now told of each tab chosen, and the panel only follows a route that changed.

## 2.0.1 - 2026-11-12

### Fixed
- **Settings: saving the Sentinel settings failed with "[object Object]"** ([#63](https://github.com/juju35/ha-system-hub/issues/63), thanks @tschoiss): the *Pause entity*, when none was chosen, was sent back empty and refused by Home Assistant. An empty field (null, or an entity or device picker cleared) is now left out, as in Home Assistant's own forms, and the Sentinel no longer suggests an empty pause entity; a form refused anyway shows each error under its field instead of "[object Object]", and no error message anywhere in the panel shows "[object Object]" any more.
- **Sidebar icon slow to show**: drawn before its icon set was loaded, it stayed blank until the sidebar was drawn again (its redraw changed the wrong element). It is now drawn again as soon as the set is loaded, the status is read 5 seconds after the page instead of 20, and the last status is kept across restarts, so the sidebar shows it at once.
- **Cards in sections**: a module's card whose file was still loading took the whole width (and a mini card a single row) until the page was reloaded; it now asks for the size its card asks for.
- **Panel**: the database count and the security scan no longer hold up the panel when it opens; it is drawn at once, then again once they are read.
- **Security**: refused logins from the Internet make one persistent notification, replaced by the latest, instead of one per address (a scan from many addresses piled them up); the notify actions chosen still get each one. `!input` (a blueprint's input) is no longer taken for a credential in clear.
- **Updates**: a release link that is not a web address is not offered as a link.

## 2.0.0 - 2026-11-12

### Breaking changes
- **One card and one mini card**: `custom:system-hub-card` and `custom:system-hub-mini-card`, `module:` picking what they show (`status` by default, `system`, `watchdog`, `marketplace` — card only —, `batteries`, `git_sync`, `automations`, `orphans`). The options of each module's card stay the same. The 13 types before 2.0 (`custom:battery-monitor-card`, `custom:integration-watchdog-mini-card`…) no longer exist.
- **Migration at every start**: the cards of the dashboards edited from the UI are moved to the new type and their module, wherever they are (a view, a section, a stack, a conditional card, a popup), their options kept; each dashboard changed is saved first in `.storage/system_hub.dashboards_backup`. A dashboard written in YAML is not rewritten (its comments would be lost): a repair lists its cards to change, and goes away once none is left.
- **Device names** in the language of Home Assistant and with the new module names: **System Hub Sentinel**, **Updates**, **Versioning**, **Cleanup** (Containers and Batteries unchanged). The entities of an existing installation keep their IDs; a new installation names them after the device (`sensor.system_hub_sentinel_…`). A device renamed by hand keeps its name.

### New
- **Status cards**: `system-hub-card` shows the **Status** tab — the emblem, the points to check, the score, each area by group (a click opens its tab in the panel); `groups:` keeps some groups, `hide_ok:` hides what is fine. `system-hub-mini-card` puts it on one line, with a dot per area to look at. They read the status as the panel and the sidebar icon do, so all three agree. Administrators only.
- **Visual editor**: the module first, then the options of its card.

## 1.10.0 - 2026-11-12

### New
- **Security** module, in the **System** group (Resources · Containers · Database · Security):
  - **Refused logins** over 7 days by address (Internet or local network, how many, the last one, banned or not), recorded as Home Assistant logs them; **Ignore** an address. Each refusal from the Internet makes a notification (once an hour per address, also to the notify actions chosen), which can be turned off.
  - **Accounts** with their role, 2FA, local login only, last activity and sessions.
  - **Long-lived tokens** with their last use and where from, the unused ones flagged (90 days by default); **Revoke** from the panel, asked first.
  - **Exposure**: external URL over HTTPS, trusted proxies, IP ban, Home Assistant Cloud.
  - **Add-ons** not protected, with full hardware access or on the host network (Home Assistant OS and Supervised).
  - **Configuration**: credentials written in clear in the YAML files (the file, the line and the key, never the value).
  - On the **Status** tab, a problem for refusals from the Internet, recent bans and add-ons not protected; to watch for administrators without 2FA, credentials in clear, an external URL without HTTPS and unused tokens. No entities of its own; on by default.

## 1.9.0 - 2026-11-12

### New
- **Logs** module, in the **Reliability** group (Logs · Sentinel · Automations): Home Assistant's log grouped by integration. The errors and warnings, by level (errors, warnings, all) and period (1 h, 24 h, since start), the most errors first; each message with how many times it came, when, its logger and source, its traceback; **Reload** the integration, **Ignore** a message (saved at once, no reload), **Full log**, **Clear the log** (asked first). On the **Status** tab, the errors of the last 24 hours, a problem from **Errors that make a problem** (10 by default) for one integration. No entities of its own; on by default.
- **Database** module, in the **System** group (Resources · Containers · Database): the recorder's database. Its size (SQLite) against **Size that makes a warning** (2 GiB by default), the retention, the states written in 24 hours and the engine; the entities that wrote the most in 24 hours with their share; tick some to **Purge their history** or copy the `recorder: exclude:` lines for `configuration.yaml`; **Purge and repack**. On the **Status** tab, the size, the retention and the top writer. No entities of its own; turn it on in **Settings**.
- **Sidebar icon**: the **Status** tab's emblem, its badge following the status (pulse, **!**, **×**), instead of a generic icon.

## 1.8.0 - 2026-11-12

### New
- **Silent devices** module, in the **Devices** group (Silent devices · Batteries · Cleanup): the devices of ZHA, Zigbee2MQTT (MQTT), Z-Wave, Matter, ESPHome and deCONZ not heard from for a while, then the weak signals. A device was last heard when one of its entities last reported a state, even an unchanged one; it is silent beyond **Silent after** (24 h by default, one value on a battery and one on mains) or with every entity unavailable; its signal is weak with an LQI below 50 or an RSSI below −80 dBm. Each one with its room, its integration, when it was last heard, its signal and its battery, **Device** and **Ignore** (saved at once, no reload); a filter per integration. On the **Status** tab, the silent devices to watch and the weak signals to know. Settings: the integrations followed, the hours on a battery and on mains, the devices ignored. No entities of its own; turn it on in **Settings**.

## 1.7.0 - 2026-11-12

### New
- **Backups** module, in the **Maintenance** group: Home Assistant's own backups at a glance. The last successful automatic backup, the next one, the size of the last one and the locations up to date; each location (local, network storage, cloud…) with its last copy, the backups it keeps and its error; the last 30 days, a square per day with a backup; the 10 latest backups, each opening its page in **Settings → Backups**; **Back up now** runs Home Assistant's automatic backup. On the **Status** tab, a problem when the last attempt failed, and to watch when a location fails or the last success is older than **Alert after** (**Settings → Backups ⚙**, 3 days by default). It needs the Backup integration and has no entities of its own; turn it on in **Settings**.

### Changed
- **Updates** tab: the updates outside the Marketplace in one grid instead of a section each, every card saying what it is (Core, Supervisor, OS, Add-on, Device · its entity); the count at the top covers the Marketplace too and fits on one line (`Available: 6 · Up to date: 34`, the detail by kind in its tooltip); the Marketplace's own button reads **Update the Marketplace (3)**, next to **Update all** at the top.

## 1.6.0 - 2026-11-12

### New
- **Updates** tab: every update, not only the Marketplace's. **Home Assistant** (Core, Supervisor, OS), **Add-ons** and **Devices and services** (every other update entity: the firmware of a Zigbee, ESPHome or Matter device, an integration's software…) come first, a card each with its versions, the size of the change, the start of its release notes and what it restarts. **Install** asks first and runs Home Assistant's `update.install`, with a backup first when **Back up before installing** is ticked and the update can make one; the box starts as the Updates settings' **Back up before installing**. A line counts the ones up to date. The Marketplace repositories follow, as before.
- **Update all** at the top of the **Updates** tab, asked first: every update of the tab one after the other — the Marketplace repositories, the add-ons, the devices and services, the Supervisor, then Home Assistant itself last as it restarts (Core, or OS when Core is up to date; with both, OS is left for afterwards).
- **Status** tab: the **Updates** tile counts the add-ons and devices too, not only Core and OS.

## 1.5.0 - 2026-11-12

### Changed
- **Panel in four groups**: under the toolbar, **Status**, **System** (Resources, Containers), **Reliability** (Sentinel, Automations), **Maintenance** (Updates, Versioning), **Devices** (Batteries, Cleanup) and **Settings**, instead of a tab per module. A group shows only when one of its modules is turned on; with two or more, they are sub-tabs under it, and the group's tab has a badge with how many of them need a look, in the colour of the worst. The address still names the module (`/system-hub/watchdog`), or a group for its first module (`/system-hub/devices`).
- **Status** tab: the tiles are grouped under the name of their group.
- **Settings**: the modules by group; ↑ ↓ move a group, the handle ═ orders the modules inside it. The order saved before is kept, each module brought next to the others of its group.
- **New names**, in every language: **Watchdog** is now **Sentinel**, **Marketplace** is **Updates**, **Git Sync** is **Versioning**, **Orphans** is **Cleanup**, the **System** tab is **Resources**; **Automations** and **Batteries** are translated. Only the names shown change: the modules' ids, options, entities, actions and cards stay the same.

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
