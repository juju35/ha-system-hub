# Changelog

## 3.11.1 - 2026-11-22

### Performance
- Card picker: the cards no longer ask Home Assistant for a live preview (`preview: false` in `window.customCards`). The picker drew every card at once (history requests, animations), which made the list slow to open; it now shows each card's description instead.

## 3.11.0 - 2026-11-22

### Features
- **Marketplace Refresh card: `show_system_updates`** ([#140](https://github.com/juju35/ha-system-hub/issues/140), thanks @thomasfav28): `true` (also in the visual editor) adds a *System updates* section above the Marketplace ones — Home Assistant (Core, Supervisor, OS) and the apps first, then the device and service firmware — counted in the status pill and in `hide_when_ok`. A row opens the update's own dialog to install it (with a backup when it offers one); *Update all* stays the Marketplace's, and the panel's *Updates* tab still installs everything in one go. Default `false`, so nothing changes for existing dashboards.

## 3.10.0 - 2026-11-21

### Features
- **Marketplace Refresh card: `show_next_check`** ([#137](https://github.com/juju35/ha-system-hub/issues/137), thanks @thomasfav28): `false` (also in the visual editor) leaves *next in …* out of the subtitle, which keeps only the last check — for a phone, where the subtitle was cut.

## 3.9.0 - 2026-11-21

### Features
- **Shortcuts to the File editor and the Marketplace** ([#133](https://github.com/juju35/ha-system-hub/issues/133), thanks @thomasfav28): next to *Reload configuration*, *Restart* and *Reboot the host* — in the panel's System tab and in the System Monitor card's `show_actions` — a round icon opens the File editor (`/core_configurator`, else Studio Code Server) and another the Marketplace (`/marketplace`), with Home Assistant's own navigation. Each shows only when its panel is in the sidebar.

## 3.8.0 - 2026-11-21

### Features
- **System Monitor card** ([#131](https://github.com/juju35/ha-system-hub/issues/131), thanks @thomasfav28):
  - `gauge_style: bar` (also in the visual editor): the System section shows the CPU, RAM, disk and temperature as lines with a bar, close together like the mini card's, the used / total size before the value (it gives way on a narrow card); on the mini card, in its zoomed view. Rings stay the default.
  - `ok_color`, `warning_color` and `critical_color` (also in the visual editor): the colour of each level of the thresholds — a Home Assistant colour, an `[r, g, b]` list or any CSS colour — on the full card and the mini card.

## 3.7.0 - 2026-11-21

### Features
- **System Monitor card** ([#129](https://github.com/juju35/ha-system-hub/issues/129), thanks @thomasfav28):
  - `tap_action: none` (also in the visual editor): a click on a gauge, tile, line or pill no longer opens the entity's details; the folds, the zoom button and the reload / restart / reboot buttons still work.
  - `show_uptime`, `show_load` and `show_ip` (on by default, in the visual editor): each line of the System section can be left out; `show_uptime: false` also removes the uptime from the mini card's footer.
  - The reload, restart and reboot buttons (`show_actions`) stay on one line: when their labels do not fit (a phone), they show their icon only, the label in their tooltip.

## 3.6.0 - 2026-11-21

### Features
- Panel: past 24 px of scroll the top bar folds into one sticky bar, as on the dashboards' illustrated headers (ha-dashboard-header) — the icon, title and line, the tabs as round icon pills with their counts, the status pill and the round buttons; back at the top it unfolds. The content does not move. On a narrow panel the pills get a row of their own under the bar, the status turns to a dot and only the first round button is kept. The sub-tabs of the group shown get a row under the folded bar.

## 3.5.1 - 2026-11-21

### Fixes
- Silent devices → Z-Wave network: each node's statistics subscription is closed once only — a second message, or the timeout after the first one, no longer asks Home Assistant to close it again — and a message delivered while subscribing still closes it.

## 3.5.0 - 2026-11-21

### Features
- **Silent devices → Z-Wave network**: a third network view beside Zigbee and Matter, offered when Z-Wave JS devices are in the device registry. Each network (one per controller) is read with `zwave_js/network_status`, then each node's statistics: a node hangs from the last repeater of its last working route, else from the controller, the hops of its last two working routes drawn as the mesh between repeaters; the controller as a square, the routing nodes as circles, the others as small circles, a dead node red. Each link is coloured by the node's RSSI (green −70 dBm and over, amber −80 to −71, red below −80) and thicker when stronger; the RSSI is in the tooltip, the tree and the detail. The radio is never turned off to read neighbour tables.

## 3.4.1 - 2026-11-20

### Fixes
- Sidebar: the panel's icon no longer stays blank on a page's first load (until a reload). Home Assistant draws an icon whose set is not registered yet in a legacy mode it never leaves; the icon module now clears it and draws the icon again once the sidebar is there.

## 3.4.0 - 2026-11-20

### Features
- **Status mini card, expand button**: a 24 px round button in the top right corner of its header (smoked glass on the illustrated header), as on the Watchdog, Orphans and Git Sync mini cards, shows the full Status card's areas by group under the header and turns into a collapse button; a click anywhere else (a tap on iOS included) or leaving the page brings the compact view back. `zoom: false` removes it; `hide_ok` applies to that view and is in the mini card's editor.

### Fixes
- **Security module**: its watch on refused logins is removed with a setup that fails half-way, instead of staying behind (and counting each refused login twice after the next setup).
- **Status card, classic header** (`illustration: false`): the status pastille is round and 40 px, the same size on the mini card and the full card, as the other ha-* headers.

### Performance
- **Cards**: only the cards of the modules turned on are loaded on the dashboards; the Watchdog, Batteries, Marketplace, Git Sync and Orphans cards are no longer downloaded with their module off (such a card says which module to turn on).
- **Security → credentials in clear**: the folders left out (`www`, `node_modules`, `deps`, `.storage`, `.git`, backups…) are no longer walked at all, only skipped afterwards: a large `www` folder costs nothing.

### Maintenance
- **CI**: the version consistency check also reads the panel's version (as the Release job does), and the translations split the release makes is tried before merging (`split-frontend.mjs --check`).
- **README**: the Status card's example lists `module`, `show_title` and `show_subtitle`.
- **Brand**: `brand/logo.png` in the common style, and the Home Assistant logo row under the repository's logo in the README.

## 3.3.1 - 2026-11-19

### Fixes
- **Top bar, as the other ha-* panels**: a neutral wall (day and night) and the wooden floor on every tab, the status carried by the round badge and the pill; the title at 20 px; Refresh and Settings as frosted round buttons at the right, centred on the wall, the scene left of them (hidden on a phone). The cog opens the Settings tab, or the tab's own settings where it has some.
- **Top bar buttons**: Refresh and a module's settings work again from the top bar (3.3.0 moved the banner out of the area listening to clicks).
- **Tabs**: every tab in medium weight, as in the other panels.

## 3.3.0 - 2026-11-19

### Features
- **Panel, the illustrated banner as the top bar**: the blue bar with the title gives way to the tab's illustrated banner, full width, with the menu button before its icon (on Status, its points to check, pill and versions; on a module, its own banner, status pill and buttons), as in the other ha-* panels. The tabs sit under it on the page's background, the active one underlined, their badges tinted. The content of each tab is unchanged. **Hide the top bar** now hides the banner and keeps the tabs.

## 3.2.1 - 2026-11-19

### Fixes
- **Hide the top bar**: the bar no longer shows for a moment on load before going; the choice last seen in the browser applies from the first paint, until the settings are read.

## 3.2.0 - 2026-11-19

### Features
- **Settings → Display → Hide the top bar**: the bar with the title and the menu button above the tabs can be hidden for everyone, or only for users who are not administrators (the panel is only open to administrators for now: that choice applies if it is opened to others). The tabs then sit at the top; on a phone, the menu button moves beside them.

## 3.1.0 - 2026-11-18

### Features
- **Versioning, the changes viewer as its mockup**: Versioning's illustrated banner as its header (the branch, the files changed as its pill, what is left to push, a round close button in its corner); the changed files, lines added, lines removed and last push as tiles; the files as filled rows with their round A/M/D badge, the selected one tinted and outlined; the diff in a filled panel. At its foot, the commit message, **Write with AI** and **Commit and push**: a commit is written and sent from the viewer, its message shared with the tab's field. On a phone, the files as chips above the diff and the tiles two by two.

## 3.0.0 - 2026-11-18

### Features
- **Panel, as its mockups**: what opens a tab (its tiles, actions, rings) now sits in the header card, under the illustrated banner and the sub-tabs. Tiles and list rows are filled and rounded with a round icon (neutral when all is well), the rows of a problem tinted and outlined, buttons are pills and list titles uppercase; the System tab's rings are tiles and its charts' titles the sections'.
- **Status tab**: the header says how many points need a look, with the critical and to-watch counts as its pill and a dot per area; the score and the counts are tiles; the critical areas come next under *To handle first*, each with **View** to open its tab; then a compact tile per area in four columns by group, each group with its worst tone and its count. The large score ring and emblem are gone.
- **Every tab, as its mockup**: the page as wide (1180 px), rows and tiles denser, status pills with their dot; **Refresh** and the module's settings as round buttons in the banner's corner, the scene beside them as in the mockups; sections side by side where the mockups put them (Security, Sentinel's power cycles and recent reloads, Backups' locations and last 30 days).
- **Settings tab**: a card per group, two by two, each module a filled row with its round icon, switch and settings (a group with a module's settings open takes the whole width).
- **Consistency across the tabs**: one look for the segmented choices (the one picked raised on a filled track), search fields and lists as filled pills, round icon buttons; every tab's module settings in the banner's corner (Versioning and the Marketplace included); the battery groups' titles as the other sections'.
- **Database**: each device and table with its checkbox, its bar beside the name and its counts small at the right; **Settings**: the modules turned on and how to order the tabs in the banner; **Resources**: compact 64 px rings; round icons in their tone itself; *To handle first* keeps the first details of each area.
- **Icons centred**: in Home Assistant, an icon sat a few pixels high in its round badge (an inline `<ha-icon>` on the text's line); every icon is now a box of its own, centred. The screenshot script draws `<ha-icon>` as Home Assistant does, so its shots show it.
- **Cards, icons centred** too (checkmarks of the selection boxes, badges, buttons); the screenshot scripts draw `<ha-icon>` as Home Assistant does.
- **Mini cards**: folded, a card ends on its banner's ground strip (no blank band under it); a chip that does not fit on the banner's line is left out instead of being cut (the full view has them all).
- **Orphan Entities card**: the *Used by N* badge sits in its row, at its right, so every row has the list's width.
- **Sub-tabs**: as the heating card's zones — each icon in its module's tone, the tab shown underlined in that tone, with the header card's margins.
- **Containers & process**: each container by its name (*Matter Server*), the container and its image under it in monospace, its state as the last pill.
- **Silent devices**: the views and the integration filters on one row, the devices in their card with what *silent* and *weak* mean under them, **Device** and **Ignore** as icons.
- **Batteries**: *By level* shows what to replace beside the batteries that are fine.
- **Logs**: one row per integration — its round icon, its name, the first message's count, time and logger, *Frequent* when it reaches the threshold, its count, **Reload** and **Ignore** — then each message in its box (its source file in the tooltip).
- **Updates tab**: kept as tiles, in the new style — filled, rounded, each group (Home Assistant, add-ons and devices; Marketplace) in its own card under an uppercase title; an initial's logo is round.

## 2.13.0 - 2026-11-18

### Features
- **Panel: the cards' illustrated look**. Each tab opens on a header drawn like the ha-* cards (ha-room-card, heating, safety…): the module's icon in a frosted badge, its name and its status as a pill with the details under it, on a wall with a floor and a scene at the right — a rack of servers, containers on a crane, a vault, a wall screen with the health score… — whose look follows the module's status (blinking LEDs, a beacon turning on the Status tab when something is wrong). While updates install, the Updates header says which one of how many and a delivery truck comes to its shelves. The Status tab's wall takes the overall tone, and its screen shows the score and one line per group. The night picture follows Home Assistant's dark theme; the scenes stop moving with *reduce motion*. The sub-tabs sit under the header, buttons are pills, icons round and the section titles uppercase. Nothing else changes: the same tabs, data, actions, install progress and diff viewer.
- **Updates tab**: a Marketplace card or theme without a picture shows a dashboard or a palette icon, round and in the tone of its release (patch, minor, major), instead of its initial; a Marketplace integration without a picture shows its logo from Home Assistant's brands. The panel's Marketplace updates carry their repository's `category`.

### Maintenance
- **Screenshots**: the screenshot script records each tab's animated header as a GIF, light and dark (the Status tab critical, to watch and all good, the Updates tab installing), shown in the README; the panel's shots get the night picture of the dark theme.

## 2.12.1 - 2026-11-18

### Fixes
- **Updates tab**: the install progress card's bar and percentage now show the progress of the whole run (the updates done plus the share done of the current one) instead of starting over at each update; the current update's own percentage stays on its card (#109).

## 2.12.0 - 2026-11-18

### Features
- **Updates tab: install progress** instead of a bare spinner (#109). While installs run, a progress card says *Backing up Home Assistant…* during the backup before installing, then *Installing 2 / 5: name* — for the Marketplace's **Update all**, one card's **Update**, and the tab's **Update all** (Marketplace repositories and the other updates counted together) — with the share done of the current update when its entity reports it (`update_percentage`), else a moving bar. Each card being installed shows its percentage next to its button and a thin bar along its bottom; the next Marketplace updates in the queue say *Waiting*. The progress follows the update entities live, and the state is read every 2 seconds while the installs run. The Marketplace status sensor gains the `install_total` and `backing_up` attributes.

## 2.11.1 - 2026-11-18

### Fixes
- **Updates tab**: a Marketplace update that could not be installed is now reported. *Update* on an update card and *Update all* wait for the installs to end, so the error shows next to the buttons instead of a success toast, and the updates whose install failed (after the retries, including those started by the automatic updates) are listed with their error, as on the Marketplace refresh card (#101).

## 2.11.0 - 2026-11-18

### Features
- **Illustrated header on every module card**, as on the Status cards: the Watchdog, Batteries, Marketplace, System Monitor, Git Sync, Orphans and Automations cards (and their mini cards) open on a 90 px header with a small animated scene of their own, drawn like the Status one — the main piece in the colour of the card's status (the shield, the battery, the store, the gauge, the branch head, the puzzle, the robot) with what it watches around it on dashed links (integrations being reloaded, the other batteries, updates, CPU and charts, commits, loose entities, triggers and actions), over the concrete floor; the top right corner stays clear for the header's buttons (check now, notify, details, zoom…), which become small frosted buttons. Night with a dark Home Assistant theme; `illustration_theme: day | night` forces it, `illustration: false` keeps the classic header. Both options are in each card's visual editor (labels from the integration's translations, in every language). Reduced motion stops the animations.

## 2.10.4 - 2026-11-18

### Fixes
- **Database tab**: the growth chart reads the size statistics with the recorder's `information` unit class, so Home Assistant no longer logs `not a valid option at 'units.data_size'. Got 'B'` each time the panel opens, and the chart shows again.

## 2.10.3 - 2026-11-18

### Fixes
- Hidden cards (`hide_when_ok`, `hide_when_empty`) no longer leave an empty slot in a sections view; they stay visible in the card editor preview.

## 2.10.2 - 2026-11-18

### Fixes
- Illustrated header: `auto` now follows the Home Assistant theme alone — a light theme keeps the day picture after sunset, a dark theme still shows the night one.

## 2.10.1 - 2026-11-17

### Fixes
- **Database module**: no more `Unable to remove unknown job listener` error in the log when the module stops (reload, disable, restart) after Home Assistant has started — the first read now waits for the start with `async_at_started`, whose unsubscribe stays safe once fired.

## 2.10.0 - 2026-11-17

### Features
- **Illustrated header on the Status cards.** `system-hub-card` and `system-hub-mini-card` (`module: status`) open on a 90 px animated banner: a home server's dashboard (host, health score ring, containers, batteries, updates, watchdog), each part in the colour of its Status area, over a 10 px concrete floor, with the title on the left and a server icon in the colour of the status (green, amber or red). Night picture when `sun.sun` is below the horizon or the theme is dark, forced with `illustration_theme: day | night`; `illustration: false` keeps the classic header. Both options are in the visual editor of both cards, translated in every language; animations stop under `prefers-reduced-motion`.
- **Status pill right after the title** on the Status cards (the health score, its dot in the status colour; the score left the subtitle) and on the Automation Monitor, Watchdog, Orphan Entities, Batteries, Git Sync, System Monitor and Marketplace Refresh cards (always with its coloured dot). On every card the pill sits on the title row only when the whole title and its whole label fit there (measured, in every language); otherwise on its own line under the subtitle (then kept to one line), and only its dot when even that does not fit, or on a card 200 px wide or less. The compact System Monitor mini card shows its pill again, red with the number of stopped processes when its icon turns red.
- **Mini cards**: the expand / collapse button sits in the card's top right corner (24 px, round), the header's other buttons (refresh, check, scan, full screen, notify) on the same top line at its left.

## 2.9.0 - 2026-11-17

### Features
- **Database volume, MariaDB / MySQL and PostgreSQL included.** The Database tab now shows the size of an external database too — the schema's for MariaDB / MySQL (`information_schema`), the database's for PostgreSQL (`pg_database_size`) — so the size limit, the Status tab and the sidebar count work whatever the engine.
- **A size sensor to follow the growth.** `sensor.system_hub_database_database_size` (bytes, shown in MiB, its engine in the attributes) is read every 15 minutes, so the recorder keeps its history and statistics; the tab shows the growth over the last 7 days with the line of the last 30, and the System tab shows the size even without the File Size integration.
- **The tables and the space to free.** The tab lists the database's tables, the biggest first, with their rows (estimated by MariaDB / MySQL and PostgreSQL) and their size, and tells how much a **Purge and repack** would free (SQLite's free pages, MariaDB / MySQL's free space).

## 2.8.3 - 2026-11-15

### Maintenance
- Document the sidebar count badge in the README, with a light and dark screenshot of the sidebar entry.
- Document the Status health score in the README, with a light and dark screenshot of the hero ring at a mid score.

## 2.8.2 - 2026-11-15

### Fixed
- **Sidebar badge no longer pushes the panel label out of line.** Home Assistant's recent sidebar places the collapsed badge over the icon with a `ha-svg-icon + .badge` rule, but a custom panel's sidebar icon is an `<ha-icon>`, so the rule did not match and the badge sat in the leading slot and shifted the "System Hub" label to the right when the sidebar was expanded. The badge is now positioned over the icon by the integration itself, so the label stays aligned with the other panels.

## 2.8.1 - 2026-11-15

### Fixed
- **The sidebar count badge now appears on the recent sidebar.** Home Assistant's recent sidebar draws each item as an `<ha-list-item-button>` whose address is a property, not an attribute, so the badge was never placed and nothing showed. The item is now found by its id, and the badge mirrors Home Assistant's own notifications count — a mark over the icon when the sidebar is collapsed, a number at the end of the row when it is expanded — in the Status tone.

## 2.8.0 - 2026-11-15

### Features
- **A count of the points to check on the sidebar.** The System Hub item in the sidebar now carries a badge with the number of points to check — the same count as the Status tab's hero (critical, to watch and info together), like the notifications count. It takes the overall tone, the same colour as the Status emblem it sits beside (green when healthy, amber to watch, red for a problem), and disappears when there is nothing to check. It is read for every administrator every 5 minutes, even with the panel closed.

## 2.7.1 - 2026-11-14

### Fixed
- **Network map: names and nodes keep their size when zooming.** Zooming in spreads the nodes apart without enlarging the shapes, the names or the arrows; zoomed out, the rooms then the end devices' names are left out (the device pointed at, picked, found or silent keeps its name). A small network is no longer blown up to fill the map.
- **Arrows in colour** in every browser (they were black where the browser does not take the line's colour), halfway along each link.
- **End devices round their parent**: a crown, past 8 of them two columns on its left and right with the routers on an arc above, the names on the outer side; the coordinator's and a network's name centred under it, a few devices on an arc above. Several Matter networks stay together, and a large network no longer piles its devices and names on its network.

## 2.7.0 - 2026-11-14

### Features
- **The network map made interactive**, in the spirit of Home Assistant's Matter map. The Zigbee and Matter networks of the Silent devices tab are laid out as a graph of forces over the whole width, each node with its name and room beside it (since when, for a silent one); the coordinator and the networks as squares, the routers as circles, the end devices as small circles. Each link points to the parent, thicker when its LQI is stronger, dashed for an end device. The wheel zooms and a drag moves the map; the pointer over a node leaves it and its neighbours standing out and shows its details (role, status, LQI, parent, model, room). A **Search** field fades the other devices; buttons read again, fit to the screen, show or hide the names and keep only the silent devices. The tree by router is now **List by router**, folded under the map; the details of a device show once it is clicked.

## 2.6.0 - 2026-11-14

### Features
- **Zigbee and Matter networks in the Silent devices tab.** Beside **List**, **Zigbee network** and **Matter network** (offered when such devices are in the device registry) draw the network as a map beside a tree by router. The map puts the coordinator (or each Matter network) in the middle, the routers around it and their devices beyond, each link coloured by its LQI, the mesh between routers dotted; a silent device is red, on a dashed line to its last parent. The tree gives each router and device its LQI or, when silent, since when. A device picked on the map or in the tree is shown on both and detailed below: role, room, last heard, parent and LQI, battery, **Device** and **Ignore**. **Silent only** keeps the silent devices and the routers they hang from; **Read again** reads the network again (by itself after 5 minutes). Zigbee comes from ZHA (`zha/devices`) or Zigbee2MQTT (its network map, asked on the default `zigbee2mqtt` base topic); Matter gives no neighbour table, so each node is shown under its network (Thread, Wi-Fi, Ethernet), a bridge's devices under it.

## 2.5.2 - 2026-11-14

### Fixed
- **Each tab opens in its default state.** What was typed, chosen or sorted in a tab stayed there when coming back to it after another tab. Leaving a tab now clears its search fields and filters (Cleanup, Batteries, Silent devices), its selections (Database devices and entities, Cleanup entities and devices), its folds and "show all" lists (Database, Automations, Cleanup, Versioning files), the Batteries view (back to by level, no longer remembered by the browser), the curves' periods, the commit message, the stock form, **Back up before installing**, the repository shown, the questions and the messages; a module's settings form left open in the Settings tab is closed. What was read and the actions still running are kept.

## 2.5.1 - 2026-11-14

### Fixed
- **A group's tab opens its first sub-tab.** Going back to a group (System, say) showed the sub-tab last shown in it (Database) instead of its first one (Resources). A group's tab now always opens its first sub-tab, also when clicked again while one of its sub-tabs is shown; the sub-tabs and the Status tab's tiles still open the tab they name.

## 2.5.0 - 2026-11-14

### Features
- **Database tab by device.** The list shows the devices that wrote the most states in 24 hours, the states of their entities added up (an entity without a device on its own row), with their room, how many of their entities wrote, their share and how many the recorder already leaves out. A device unfolds to its entities that wrote the most (10 at most, then how many more), each with its count and share. Ticking a device picks all its entities that wrote, the ones not shown included (half ticked when only some are); its entities can also be picked one by one, for **Purge their history** and the `recorder: exclude:` lines.

## 2.4.0 - 2026-11-14

### Features
- **Reload, restart and reboot from the System Monitor card** ([#82](https://github.com/juju35/ha-system-hub/issues/82), thanks @Matssa56): `show_actions: true` (also in the visual editor, off by default) adds **Reload configuration**, **Restart Home Assistant** and **Reboot the host** at the bottom of the full card (`module: system`) and of the mini card's zoomed view, for administrators only. Each is confirmed in the card itself; the restart checks the configuration first and is refused while it is invalid, as in the panel. Until now, these buttons were only in the panel's System tab.
- **Reboot the host** in the panel's System tab too, next to **Restart Home Assistant**: with Home Assistant OS or Supervised only (`hassio.host_reboot`), confirmed first.

## 2.3.5 - 2026-11-14

### Fixed
- Visual editors completed. Automation Monitor cards: the `failed_entity` and `linked_entity` sensors can be picked; the mini card's editor also offers the full card's options its detail view uses (`expand_failed`, `expand_linked`, `show_details`, `show_controls`, `max_items`). Battery Monitor cards: `expanded` and `csv_button` are in the editor. System Monitor Mini Card: `show_system`, `show_disk` and `show_processes`, used by its zoomed view, are in its editor.
- Status mini card editor: `show_title`, `show_subtitle` and `hide_ok`, which change nothing on its single line, are no longer offered.

## 2.3.4 - 2026-11-13

### Features
- **Updates tab: the projects' icons.** An update of one of juju35's projects without a picture of its own (the Lovelace cards, which have no brand icon) shows its project's icon, the round badge of the showcase site in its accent colour, instead of its initial; the renamed repositories are known by their former names too. An integration keeps its brand icon, the project's icon taking over if it does not load. Other repositories keep their initial.
- **Updates tab: the integrations' logos.** An update without a picture of its own (the firmware of a Zigbee device, through ZHA or MQTT, say) shows the logo of its integration from Home Assistant's brands, instead of its initial (kept if the logo does not load).

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
