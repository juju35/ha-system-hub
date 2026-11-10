# ha-system-hub

[![Marketplace](https://img.shields.io/badge/Marketplace-Custom-41BDF5.svg)](https://www.home-assistant.io/integrations/marketplace/)
[![HACS Validation](https://github.com/juju35/ha-system-hub/actions/workflows/hacs.yml/badge.svg)](https://github.com/juju35/ha-system-hub/actions/workflows/hacs.yml)
[![Validate](https://github.com/juju35/ha-system-hub/actions/workflows/validate.yml/badge.svg)](https://github.com/juju35/ha-system-hub/actions/workflows/validate.yml)
[![Lint](https://github.com/juju35/ha-system-hub/actions/workflows/lint.yml/badge.svg)](https://github.com/juju35/ha-system-hub/actions/workflows/lint.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/juju35/ha-system-hub/blob/main/LICENSE)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-FFDD00?logo=buymeacoffee&logoColor=black)](https://buymeacoffee.com/julienstep9)

<p align="center"><img src="https://raw.githubusercontent.com/juju35/ha-system-hub/main/custom_components/system_hub/brand/icon.png" alt="System Hub" width="120"></p>

Home Assistant integration that brings the care of your Home Assistant system together in one configurable admin panel: system resources, Home Assistant's own containers, Marketplace updates, the integration watchdog, battery levels and Git sync of your configuration. Each feature is a module you can turn on or off.

> **Work in progress.** System Hub replaces [ha-system-monitor-card](https://github.com/juju35/ha-system-monitor-card), [ha-marketplace-refresh](https://github.com/juju35/ha-marketplace-refresh), [ha-integration-watchdog](https://github.com/juju35/ha-integration-watchdog), [ha-battery-monitor](https://github.com/juju35/ha-battery-monitor) and [ha-git-sync](https://github.com/juju35/ha-git-sync). Their features are being brought in; keep using them until the first release.

## Features

- **System**: CPU, memory, disks, network and temperatures from the System Monitor integration.
- **Containers**: Home Assistant Core, the Supervisor and every add-on, monitored on their own — state, version, CPU and memory, with their history. Monitoring only: nothing is restarted.
- **Marketplace**: server-side check of the Marketplace updates, at an interval you choose.
- **Watchdog**: reloads the integrations whose entities are all unavailable, with ignored integrations, power cycles through a smart plug and a notification on each reload.
- **Batteries**: battery levels of every device, low-battery notifications.
- **Git sync**: commit and push your configuration and export the dashboards to a Git repository.
- **Modules**: Containers, Marketplace, Watchdog, Batteries and Git sync can each be turned on or off; a module turned off stops its checks, removes its entities and hides its tab.
- **Admin panel**: one sidebar panel with a tab per enabled module, which you can order.

## Supported integrations

| Integration | Used for |
| --- | --- |
| [System Monitor](https://www.home-assistant.io/integrations/systemmonitor/) | System tab |
| [Supervisor](https://www.home-assistant.io/integrations/hassio/) | Containers module (Home Assistant OS and Supervised installations) |
| [Marketplace](https://www.home-assistant.io/integrations/marketplace/) | Marketplace module |

## Prerequisites

- Home Assistant 2026.11 or newer

## Installation

### Via the Marketplace (recommended)

Click the button below to add the repository directly:

[![Add to the Marketplace](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/marketplace_repository/?owner=juju35&repository=ha-system-hub&category=integration)

Then click **Install** and restart Home Assistant.

Or manually:

1. Open **Settings → Marketplace → Add from link** (top right; this needs a GitHub account connected)
2. Add `https://github.com/juju35/ha-system-hub` — Type: **Integration**
3. Open **System Hub** and click **Install**
4. Restart Home Assistant

### Manual

Copy `custom_components/system_hub/` to `/config/custom_components/system_hub/`, then restart Home Assistant.

## Configuration

[![Add integration](https://my.home-assistant.io/badges/config_flow_start.svg)](https://my.home-assistant.io/redirect/config_flow_start/?domain=system_hub)

**Settings → Devices & services → Add integration → System Hub**, then choose the modules to turn on. The Containers module needs the Supervisor (Home Assistant OS or a Supervised installation), the Marketplace module Home Assistant's Marketplace.

**Configure** opens a menu: **Modules** turns modules on or off, then one entry per module turned on sets it up (**Containers**, **Watchdog**, **Watchdog: Add a power cycle**, **Watchdog: Remove power cycles**, **Marketplace**, **Batteries**).

### Modules

| Module | Default | What it does |
|---|---|---|
| Containers | on with Home Assistant OS or Supervised | Monitors Home Assistant Core, the Supervisor and the add-ons: state, version, CPU, memory. Monitoring only, nothing is restarted |
| Watchdog | on | Reloads the integrations whose entities are all unavailable, power cycles devices through their smart plug |
| Marketplace | on when the Marketplace is loaded | Checks every repository installed from the Marketplace for updates, on the server, and installs them on demand |
| Batteries | on | Notifies the low batteries twice a day, forecasts the replacements, counts the spare batteries |

A module turned off is not set up: its checks stop, its entities and its device are removed, its actions fail with *The … module is turned off*, and the Watchdog's Repairs issues and notifications are dismissed. Its settings and saved state (the Watchdog's history and reload counts, the Marketplace's last check, the Batteries' low-battery times and spare stock) are kept, so turning it back on picks up where it left off.

Every module has its own device (**System Hub Containers**, **System Hub Watchdog**, **System Hub Marketplace**, **System Hub Batteries**) holding its entities.

### Diagnostics

**Settings → Devices & services → System Hub → ⋮ → Download diagnostics** gives the options, the modules turned on and the state of each one. Integration titles (often an e-mail address or a host), notify actions and tokens are redacted; domains and entry ids are kept.

## Containers

Home Assistant's own containers, read from the Supervisor: **Home Assistant Core**, the **Supervisor** and every **add-on**. **Monitoring only**: the module never starts, stops or restarts anything.

| Option | Default | Description |
|---|---|---|
| Refresh interval | 60 s | Seconds between two reads of the Supervisor, from 10 to 3600. The first read is done once Home Assistant has started |
| Notify | on | Notify when a container that should run stops, and when it is back |
| Notify actions | none | Also send each notification with these actions (`notify.mobile_app_phone`…). A persistent notification is always created |

A container **should run** when it is Core, the Supervisor, or an add-on set to start at boot. It is **down** when it should run and is stopped or in error; an add-on started by hand only is never down. Going down creates a persistent notification (one per container, replaced) and coming back dismisses it. Nothing is notified at the first read, nor while Home Assistant is starting, when the add-ons are starting too. If the Supervisor can't be read (busy, restarting), the last figures are kept and the error is shown in the attributes; the next refresh tries again.

For every container: state and since when, version, latest version and whether an update is available, CPU %, memory (used, limit, %), network (received, sent) and disk (read, written) since it started. The panel also gets their CPU and memory over the last 24 hours (one point every 5 minutes, in memory only).

#### Entities

| Entity | Description |
|---|---|
| `sensor.system_hub_containers_running_containers` | Containers running. Attributes: `total`, `error` (why the last read failed, else `null`), `containers` (every container: `slug`, `name`, `kind` = `core` / `supervisor` / `addon`, `state`, `since`, `version`, `version_latest`, `update_available`, `boot`, `expected`, `down`, `cpu_percent`, `memory_usage`, `memory_limit`, `memory_percent`, `network_rx`, `network_tx`, `blk_read`, `blk_write`; not recorded in the database) |
| `sensor.system_hub_containers_stopped_containers` | Containers that should run and don't. Attribute: `containers` (`slug`, `name`, `state`) |
| `sensor.system_hub_containers_last_update` | End of the last successful read |

#### Action `system_hub.containers_refresh`

Reads the containers now. Fails with the reason if the Supervisor could not be read. For administrators.

```yaml
action: system_hub.containers_refresh
```

Get a notification on the phone when an add-on stays stopped:

```yaml
triggers:
  - trigger: numeric_state
    entity_id: sensor.system_hub_containers_stopped_containers
    above: 0
    for: "00:10:00"
actions:
  - action: notify.mobile_app_phone
    data:
      message: >-
        Stopped: {{ state_attr('sensor.system_hub_containers_stopped_containers', 'containers')
        | map(attribute='name') | join(', ') }}
```

## Watchdog

| Option | Default | Description |
|---|---|---|
| Check interval | 5 min | Minutes between two checks, from 1 to 1440 |
| Grace period | 15 min | Minutes every entity of an integration must have been unavailable before it is reloaded. Nothing is reloaded during this time after Home Assistant has started |
| Grace period per integration | — | One line per integration, `domain: minutes` (`zha: 30`): its own grace period and delays between reloads, for an integration that takes longer (a big Zigbee network) or should be reloaded sooner. Right after Home Assistant starts, the global grace period still applies to all |
| Reloads in a row | 3 | Reloads of an integration that stays unavailable before giving up on it, from 1 to 10 |
| Ignored entries | none | Single entries never reloaded ("Title (domain)"); the other entries of their integration are still watched |
| Ignored integrations | none | Integrations never reloaded. The list offers the integrations set up; type a domain (`zha`, `mqtt`…) to add another one |
| Pause entity | none | An `input_boolean`, `switch`, `binary_sensor` or `schedule`: while it is on, nothing is reloaded (maintenance of the network, a planned outage, the night). The checks still run and list the unavailable integrations, and the *Unavailable integrations* sensor has `paused: true`; reloads start again at the first check after it turns off, the grace period counted from when each integration became unavailable |
| Notify actions | none | Also send each notification with these actions (`notify.mobile_app_phone`…). A persistent notification is always created |

#### Power cycles

A device that hangs (a router, a hub, a camera) often only comes back once its power is cut. Associate it with the smart plug that powers it, in **Configure → Watchdog: Add a power cycle**:

| Field | Default | Description |
|---|---|---|
| Device | — | The device to restart. All its enabled entities (the plug left out) must be `unavailable` |
| Smart plug | — | The `switch` that powers it. It can't be an entity of the device itself |
| Unavailable for | 10 min | Minutes all the device's entities must have been unavailable before its plug is switched off, from 1 to 1440 |
| Off for | 10 s | Seconds the plug stays off before being switched on again, from 1 to 300 |

The plug is only switched off when it is **on**: a plug you switched off on purpose, or that is unavailable itself, is left alone. Power cycles follow the reload rules: none while Home Assistant starts or during the grace period after it has started, none while the pause entity is on, at most **Reloads in a row** in a row with a delay that doubles each time (10, 10, then 20 minutes…), then the watchdog gives up on the device until one of its entities has been available again for the current delay. Each power cycle, failed power cycle and give-up is notified (one persistent notification per device), recorded in the history, and fires the `system_hub_device_power_cycled` event.

The plug is always switched on again, even when switching it off failed. If Home Assistant stops while it is off, it is switched on at the first check after the next start. The integration of the device is still watched as usual: if all its entities are unavailable too, it is also reloaded after its grace period.

#### What counts as unavailable

An integration (config entry) is reloaded when:

- it is loaded, or its setup failed (`setup_retry`, `setup_error`): a reload retries it right away instead of waiting for Home Assistant's next retry. Disabled integrations are left alone
- it is not ignored, and it is not a helper (template, group, utility meter, derivative…): their entities follow their sources, so reloading them can't fix anything
- it has at least one enabled entity, and **every** enabled entity is `unavailable`
- the most recent of these entities has been unavailable for at least the grace period
- Home Assistant has been running for at least the grace period

Disabled entities are left out. Entities the integration didn't create, for example because the device was off or unreachable when it loaded (shown as "not provided" in Home Assistant), count as unavailable. An integration with a single entity still available is not reloaded.

The check is per integration entry, not per device: an entry with one device down and another one working is left alone.

#### Limiting reloads

An integration that stays unavailable after a reload is reloaded again after the grace period, then after twice the grace period, and so on, up to the **Reloads in a row** option. With the defaults: after 15 minutes, then 15 minutes later, then 30 minutes later. If it is still unavailable once the delay after the last one has passed (60 minutes with the defaults), the watchdog gives up on it, sends a notification, and doesn't touch it again until one of its entities has been available for the current delay, counted from its return. An integration that comes back for a moment and falls again keeps its count. Leaving the list is not a recovery: an integration whose setup or unload is still in progress (a reload that went past its timeout), or that has no enabled entity with a state keeps its count until one of its entities is actually available. Disabling an integration resets its count right away, even if you enable it again a few seconds later: once enabled again, it starts over.

A reload that doesn't finish within 5 minutes, or a notify action that doesn't answer within 30 seconds, counts as failed, so that a hung integration can't block the following checks.

The count is saved with the history (`.storage/system_hub.watchdog`): after a restart of Home Assistant, an integration given up stays so, and one being reloaded keeps its count and delay. Entries removed while Home Assistant was stopped are dropped when it starts. Changing the options keeps the count too, so an integration given up stays so (until a higher **Reloads in a row** allows more reloads). To start over on an integration, use **Try again** on its Repairs issue, the `system_hub.watchdog_reset` action.

#### Notifications

Each reload, failed reload and give-up creates a persistent notification, one per integration (the next one replaces it), in the language of Home Assistant. It is dismissed once the watchdog starts over for the integration (recovered, reset, disabled or removed), and when System Hub is removed. The same title and message are sent to the notify actions chosen in the options.

#### Repairs

Giving up on an integration also raises an issue in **Settings → System → Repairs**, one per integration. It goes away by itself once the integration has recovered (available again for its current delay), is disabled or removed, or gets more reloads after **Reloads in a row** was raised. An integration still given up when Home Assistant restarts gets its issue back.

Opening the issue offers **Try again**: submitting it forgets the reloads of the integration, deletes the issue and reloads the integration now (like the `system_hub.watchdog_reset` action). The reload runs in the background: the dialog closes at once, saying that it was started, and a failed reload is logged. If it is still unavailable afterwards, the watchdog starts over: reloads up to **Reloads in a row**, then gives up again.

#### Entities

| Entity | Description |
|---|---|
| `button.system_hub_watchdog_check_now` | Runs a check now. Unavailable while one is running |
| `sensor.system_hub_watchdog_unavailable_integrations` | Number of integrations whose entities are all unavailable. Attributes: `integrations` (list of `domain`, `title`, `entry_id`, `since`, `reloads`, `gave_up`), `ignored`, `max_reloads`, `paused` (the pause entity is on) |
| `sensor.system_hub_watchdog_last_reload` | Time of the last reload. Attributes: `domain`, `title`, `entry_id`, `success`, `reloads` (since Home Assistant started), `history` (the last 20 reloads, power cycles and give-ups, newest first: `kind` = `reloaded` / `reload_failed` / `gave_up` / `power_cycled` / `power_cycle_failed` / `power_cycle_gave_up`, `at`, `domain`, `title`, `entry_id`, `attempt`, `max_reloads`, `unavailable_since`, plus `device_id`, `switch` and `switch_name` for a power cycle, whose `title` is the device name and `entry_id` / `domain` those of its integration; kept across restarts, not recorded in the database) |
| `sensor.system_hub_watchdog_last_check` | End of the last check |
| `sensor.system_hub_watchdog_reloads_in_24_h` | Reloads and failed reloads of the last 24 hours (from the history). Attributes: `failed`, `integrations` (count per integration) |

#### Action `system_hub.watchdog_check`

Runs a check now and waits for the reloads. If a check is already running, waits for it to end, then runs its own. For administrators. Does nothing while Home Assistant is starting.

```yaml
action: system_hub.watchdog_check
```

#### Action `system_hub.watchdog_reset`

Starts over for one integration entry: forgets its reloads (given up or not), deletes its Repairs issue and reloads it now. Waits for a check still running. Fails if the entry doesn't exist or the reload fails (the count is reset anyway). For administrators.

| Field | Description |
|---|---|
| `entry_id` | The integration entry (config entry ID), e.g. from the `entry_id` of the **Unavailable integrations** sensor |

```yaml
action: system_hub.watchdog_reset
data:
  entry_id: 01JABCDEF0123456789ABCDEFG
```

#### Event `system_hub_integration_reloaded`

| Field | Description |
|---|---|
| `entry_id` | Config entry reloaded |
| `domain` | Integration domain |
| `title` | Config entry title |
| `success` | `true` if the integration loaded again |
| `unavailable_since` | When its last entity became unavailable |
| `attempt` | Reload number in a row (1, 2…) |
| `max_reloads` | Reloads in a row before giving up |

Log each reload in the logbook:

```yaml
triggers:
  - trigger: event
    event_type: system_hub_integration_reloaded
actions:
  - action: logbook.log
    data:
      name: System Hub Watchdog
      message: >
        reloaded {{ trigger.event.data.title }} ({{ trigger.event.data.domain }}),
        attempt {{ trigger.event.data.attempt }}/{{ trigger.event.data.max_reloads }}
```

#### Event `system_hub_device_power_cycled`

| Field | Description |
|---|---|
| `device_id` | Device power cycled |
| `name` | Device name |
| `switch` | Plug switched off and on |
| `success` | `true` if both went through |
| `unavailable_since` | When its last entity became unavailable |
| `attempt` | Power cycle number in a row (1, 2…) |
| `max_reloads` | Power cycles in a row before giving up |

## Marketplace

| Option | Default | Description |
|---|---|---|
| Check interval | 24 h | Hours between two automatic checks, from 1 to 168. `0` turns the automatic check off. Counted from the end of the last check (or from the installation before the first one), across restarts |
| Back up before installing updates | off | Before **Update all** (and `install_updates` without `backup`), create Home Assistant's automatic backup — what it holds, where it goes and how many are kept follow **Settings → System → Backups**. If the backup fails, nothing is installed and the failure is listed with the updates that couldn't be installed |

#### Entities

| Entity | Description |
|---|---|
| `button.system_hub_marketplace_check_for_updates` | Starts a check. Unavailable while one is running |
| `sensor.system_hub_marketplace_status` | `idle`, `running` or `error`. Attributes: `done`, `total`, `updates`, `failed` (list of `owner/repo`), `not_checked` (`owner/repo` of the repositories added from a link that the last check couldn't check because no GitHub account is connected to the Marketplace), `error`, `checking` (update entities being checked by `marketplace_check_repository`), `installing` (update entities left to install, the current one first), `install_failed` (`title: error` of the updates that couldn't be installed), `github_connected` (whether a GitHub account was connected to the Marketplace at the last check), `rate_limit_remaining` and `rate_limit_reset` (GitHub requests left and when the limit resets, as read at the last check; empty without a GitHub account) |
| `sensor.system_hub_marketplace_last_check` | End of the last check. Attributes: `scan_interval` (hours, `0` = automatic check off), `next_check` (when the next automatic check is due, within the hour after a failed or skipped one, kept across restarts; `null` when it is off) |

#### Action `system_hub.marketplace_check_updates`

| Field | Default | Description |
|---|---|---|
| `wait` | `false` | Wait until every repository has been checked before the action ends. The action then fails if the check failed or could not check a repository (the error lists them), so the steps after it only run on a complete check. The repositories added from a link that couldn't be checked because no GitHub account is connected don't make it fail: they are in the status sensor's `not_checked` attribute |

Check every night and get notified of the updates found:

```yaml
triggers:
  - trigger: time
    at: "04:00:00"
actions:
  - action: system_hub.marketplace_check_updates
    data:
      wait: true
  - condition: template
    value_template: "{{ state_attr('sensor.system_hub_marketplace_status', 'updates') | int(0) > 0 }}"
  - action: notify.mobile_app_phone
    data:
      message: "{{ state_attr('sensor.system_hub_marketplace_status', 'updates') }} Marketplace update(s) available"
```

#### Action `system_hub.marketplace_check_repository`

| Field | Description |
|---|---|
| `entity_id` | Marketplace update entities (`update.*` of platform `marketplace`) of the repositories to check |

The action ends once the repositories are checked, and fails with the reason if one could not be. It doesn't change the status or the last check, which belong to the full check. While a full check runs, it waits for that check to end and fails if that check failed or could not check one of these repositories; a repository already being checked by another call is not checked twice: the action waits for that call's result, and checks it itself if that call is cancelled first. A full check started meanwhile waits for these repositories too instead of checking them again. If System Hub is reloaded or removed while the action waits (here or with `wait: true`), it fails with "The check was cancelled".

```yaml
action: system_hub.marketplace_check_repository
data:
  entity_id: update.mushroom_update
```

#### Action `system_hub.marketplace_install_updates`

| Field | Default | Description |
|---|---|---|
| `entity_id` | every Marketplace update entity with an update | Marketplace update entities to install |
| `wait` | `false` | Wait until every update is installed; the action then fails if one couldn't be |
| `backup` | the *Back up before installing updates* option | Create Home Assistant's automatic backup (`backup.create_automatic`) first; nothing is installed if it fails |

Installs the updates one after the other with `update.install`, in the background (a check running ends first). One failing update doesn't stop the others; the failures are in the status sensor's `install_failed` attribute. Administrators only, like the Marketplace, and the Marketplace warning must have been accepted once in **Settings → Marketplace** (an install from an automation runs without a user); it can't run twice at the same time. Meanwhile, no full check starts: the **Check for updates** button is greyed out, `system_hub.marketplace_check_updates` fails with "Updates are being installed", and an automatic check that falls due runs once the installs are done. Integrations need a restart of Home Assistant afterwards, which the Marketplace asks for in **Settings → Repairs**.

```yaml
action: system_hub.marketplace_install_updates
data:
  wait: true
```

#### Event `system_hub_marketplace_updates_found`

Fired at the end of a full check (button, `marketplace_check_updates` or automatic) when updates are available that the previous full check didn't find: only when the set of repositories with an update grows, not when it stays the same or shrinks (an update installed, then found again later, fires again). The first check after installing the integration only records the updates available; the list is kept across restarts. `marketplace_check_repository` doesn't fire it.

| Data | Description |
|---|---|
| `entry_id` | Config entry of System Hub |
| `count` | Number of new updates |
| `updates` | The new updates, as `owner/repo` |
| `total` | Number of updates available, new or not |

```yaml
triggers:
  - trigger: event
    event_type: system_hub_marketplace_updates_found
actions:
  - action: notify.mobile_app_phone
    data:
      title: "Marketplace"
      message: >-
        {{ trigger.event.data.count }} new update(s): {{ trigger.event.data.updates | join(', ') }}
        ({{ trigger.event.data.total }} available)
```

## Batteries

Every battery of the house: low batteries notified twice a day, replacement forecast and spare batteries to buy.

| Option | Default | Description |
|---|---|---|
| Low battery threshold | `20` % | A battery is low below this level |
| Low for at least | `24` h | Hours a battery must have stayed below the threshold before it is notified (`0`: at the next notification) |
| Morning notification | `09:00` | First of the two daily notifications |
| Evening notification | `19:00` | Second of the two daily notifications |
| Notify actions | — | Also send the notifications with these actions (`notify.mobile_app_…`); a persistent notification is always created |
| Ignored batteries | — | Batteries never monitored |
| Ignored integrations | `mobile_app` | Integrations whose batteries are never monitored |

#### Notifications

At each notification time, the batteries that have been below the threshold for the duration are listed, the lowest first:

```text
3 low batteries
• Front door (Entrance): 8 % · CR2032
• Kitchen leak sensor (Kitchen): 17 % · 2× AAA
• Smoke detector (Hallway): low
```

As soon as one of them is unavailable, the title becomes *N batteries to check* and its line says *unavailable*. The battery type ends the line when [Battery Notes](https://github.com/andrew-codechimp/HA-Battery-Notes) knows it (the `battery_type` and `battery_quantity` of the battery, or its device's *Battery type* sensor).

When no battery is due, nothing is sent and the persistent notification is cleared.

#### Entities

| Entity | Description |
|---|---|
| `sensor.system_hub_battery_low_batteries` | Number of batteries below the threshold. Attributes: `unavailable` (number of unavailable batteries), `due` (number needing attention for the duration), `threshold`, `duration` (h), `batteries` (every monitored battery: `entity_id`, `device_id`, `name`, `area`, `level`, `icon`, `low`, `alert` (low or unavailable), `due`, `unavailable`, `below_since`, `drain_per_day` (% per day measured on the history, `0` when stable, `null` when unknown), `days_left` (before the threshold, `null` when stable, unknown, or already low or unavailable), `replace_by` (that date), `battery_type` (from Battery Notes, `2× AA`, `null` when unknown)) |
| `sensor.system_hub_batteries_last_notification` | Time of the last notification; attribute `notified` (number of batteries notified) |
| `sensor.system_hub_batteries_spare_batteries` | Number of battery types short of spares (`0`: enough). Attributes: `stock` (spares per type counted), `needed` (batteries of that type low, unavailable or forecast to reach the threshold within 30 days, with their quantity: a `2× AA` device needs 2), `short` (the types missing some, and how many). Only the types set with `system_hub.batteries_set_stock` |
| `sensor.system_hub_batteries_next_replacement` | Date the first battery is forecast to reach the threshold; a battery already low or unavailable comes first (since when it has been). Attributes: `entity_id`, `name`, `level`, `days_left` (`0` for one already low), `forecast_at` (last measure of the drains) |
| `button.system_hub_batteries_notify_now` | Sends every low battery right away, whatever the duration (or *No low battery*) |

#### Action `system_hub.batteries_notify`

Sends every battery below the threshold right away, whatever the duration, or a *No low battery* message when none is low (the scheduled notifications only list the batteries low for the duration). For example from an automation when you leave on holiday:

```yaml
action: system_hub.batteries_notify
```

#### Action `system_hub.batteries_set_stock`

Sets how many spare batteries of a type you keep, by the type Battery Notes gives without the quantity (`AA`, `AAA`, `CR2032`…). Each replacement detected for a battery of that type (a rise of 15 points, the `system_hub_battery_replaced` event) then takes its quantity out of the count, never below 0. Without `count`, the type is no longer counted. When spares are missing, the notification ends with *Spare batteries to buy: 1 AA, 2 CR2032*. Open to every user, like `system_hub.batteries_notify`.

```yaml
action: system_hub.batteries_set_stock
data:
  battery_type: AA
  count: 8
```

#### Action `system_hub.batteries_export`

Writes every monitored battery to a CSV file (`entity_id`, `name`, `area`, `level`, `low`, `unavailable`, `due`, `below_since`, `drain_per_day`, `days_left`, `replace_by`, `battery_type` (from Battery Notes)), for a spreadsheet or a report. Administrators only. `path` is optional: `system_hub_batteries.csv` in the configuration folder by default; a relative path is inside the configuration folder, an absolute one must be in the configuration folder or in `allowlist_external_dirs`. The file name must end in `.csv`, and hidden folders such as `.storage` are refused. Returns the path and the number of batteries.

```yaml
action: system_hub.batteries_export
data:
  path: exports/batteries.csv
response_variable: result  # {"path": "/config/exports/batteries.csv", "batteries": 23}
```

#### Events

The module fires two events on the Home Assistant bus, on a change only (never for a battery already low at start-up, after a reload or when first found):

| Event | When | Data |
|---|---|---|
| `system_hub_battery_low` | A battery goes below the threshold (or a low-battery binary sensor turns `on`); a battery that goes unavailable and comes back still low does not fire it again | `entry_id`, `entity_id`, `device_id`, `name`, `level` (`null` for a binary sensor), `threshold` |
| `system_hub_battery_replaced` | A battery's level rises by 15 points or more since its last reading (the same rule that restarts the replacement forecast), even with an unavailable gap while the battery was out | `entry_id`, `entity_id`, `device_id`, `name`, `level`, `previous_level` |

For example, a notification on your phone as soon as a battery goes low, and a logbook entry when one is replaced:

```yaml
automation:
  - alias: Battery low
    triggers:
      - trigger: event
        event_type: system_hub_battery_low
    actions:
      - action: notify.mobile_app_phone
        data:
          title: Low battery
          message: "{{ trigger.event.data.name }}: {{ trigger.event.data.level }} %"
  - alias: Battery replaced
    triggers:
      - trigger: event
        event_type: system_hub_battery_replaced
    actions:
      - action: logbook.log
        data:
          name: "{{ trigger.event.data.name }}"
          message: "battery replaced ({{ trigger.event.data.previous_level }} % → {{ trigger.event.data.level }} %)"
          entity_id: "{{ trigger.event.data.entity_id }}"
```

#### How it works

A battery is a `sensor` with the `battery` device class (its level in %) or a `binary_sensor` with the `battery` device class (`on` means low). When a device has both, its level sensor is used. Hidden entities, the ignored batteries and the batteries of the ignored integrations are left out.

When a battery goes below the threshold, System Hub writes down the time. For a battery that is already low when it is first seen (right after turning the module on, say), that time is read from the history, up to 30 days back. It is kept while the battery is unavailable (a dead battery often makes its device unavailable) and across restarts, and forgotten once the battery is back above the threshold (replaced or recharged). A battery is notified once that time is older than the duration.

The list is updated whenever a battery changes, and every 10 minutes.

Once a day (and at start), the drain of each level battery is measured on its recorded history over the last 30 days: a least-squares slope of the level, counted from the last replacement (a rise of 15 points or more), when at least three days and three points are recorded. From that drain and the current level come the days left before the threshold and the replacement date; a stable level (less than 0.05 % a day) gives none. The days left follow the level between two measures.

## Migrating

System Hub replaces Integration Watchdog, Marketplace Refresh and Battery Monitor: remove them once System Hub is set up, so that nothing is checked twice. Their options are not imported; set them again in **Configure**. Rename in your automations:

| Before | System Hub |
|---|---|
| `integration_watchdog.check` / `.reset` | `system_hub.watchdog_check` / `.watchdog_reset` |
| `integration_watchdog_reloaded` / `_power_cycled` events | `system_hub_integration_reloaded` / `system_hub_device_power_cycled` |
| `sensor.integration_watchdog_*`, `button.integration_watchdog_check_now` | `sensor.system_hub_watchdog_*`, `button.system_hub_watchdog_check_now` |
| `marketplace_refresh.check_updates` / `.check_repository` / `.install_updates` | `system_hub.marketplace_check_updates` / `.marketplace_check_repository` / `.marketplace_install_updates` |
| `marketplace_refresh_updates_found` event | `system_hub_marketplace_updates_found` |
| `sensor.marketplace_refresh_*`, `button.marketplace_refresh_check_for_updates` | `sensor.system_hub_marketplace_*`, `button.system_hub_marketplace_check_for_updates` |
| `battery_monitor.notify` / `.set_stock` / `.export` | `system_hub.batteries_notify` / `.batteries_set_stock` / `.batteries_export` |
| `battery_monitor_low` / `_replaced` events | `system_hub_battery_low` / `system_hub_battery_replaced` |
| `sensor.battery_monitor_*`, `button.battery_monitor_notify_now` | `sensor.system_hub_batteries_*`, `button.system_hub_batteries_notify_now` |

## Translations

English, French, German, Spanish, Italian, Dutch, Portuguese (Portugal and Brazil), Polish, Romanian, Danish, Swedish, Bulgarian, Russian, Ukrainian, Hungarian, Slovak, Czech, Slovenian, Latvian, Greek and Serbian (Cyrillic and Latin).

## License

[MIT](https://github.com/juju35/ha-system-hub/blob/main/LICENSE)

## Support

If you find this project useful, you can support its development:

<a href="https://buymeacoffee.com/julienstep9"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me a Coffee" height="50"></a>
