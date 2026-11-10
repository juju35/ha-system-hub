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
| [Supervisor](https://www.home-assistant.io/integrations/hassio/) | Containers tab (Home Assistant OS and Supervised installations) |
| [Marketplace](https://www.home-assistant.io/integrations/marketplace/) | Marketplace tab |

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

**Settings → Devices & services → Add integration → System Hub**, then choose the modules to turn on. The Marketplace module can only be turned on when Home Assistant's Marketplace is loaded.

**Configure** opens a menu: **Modules** turns modules on or off, then one entry per module turned on sets it up (**Watchdog**, **Watchdog: Add a power cycle**, **Watchdog: Remove power cycles**, **Marketplace**).

### Modules

| Module | Default | What it does |
|---|---|---|
| Watchdog | on | Reloads the integrations whose entities are all unavailable, power cycles devices through their smart plug |
| Marketplace | on when the Marketplace is loaded | Checks every repository installed from the Marketplace for updates, on the server, and installs them on demand |

A module turned off is not set up: its checks stop, its entities and its device are removed, its actions fail with *The … module is turned off*, and the Watchdog's Repairs issues and notifications are dismissed. Its settings and saved state (the Watchdog's history and reload counts, the Marketplace's last check) are kept, so turning it back on picks up where it left off.

Every module has its own device (**System Hub Watchdog**, **System Hub Marketplace**) holding its entities.

### Diagnostics

**Settings → Devices & services → System Hub → ⋮ → Download diagnostics** gives the options, the modules turned on and the state of each one. Integration titles (often an e-mail address or a host), notify actions and tokens are redacted; domains and entry ids are kept.

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

## Migrating

System Hub replaces Integration Watchdog and Marketplace Refresh: remove them once System Hub is set up, so that nothing is checked twice. Their options are not imported; set them again in **Configure**. Rename in your automations:

| Before | System Hub |
|---|---|
| `integration_watchdog.check` / `.reset` | `system_hub.watchdog_check` / `.watchdog_reset` |
| `integration_watchdog_reloaded` / `_power_cycled` events | `system_hub_integration_reloaded` / `system_hub_device_power_cycled` |
| `sensor.integration_watchdog_*`, `button.integration_watchdog_check_now` | `sensor.system_hub_watchdog_*`, `button.system_hub_watchdog_check_now` |
| `marketplace_refresh.check_updates` / `.check_repository` / `.install_updates` | `system_hub.marketplace_check_updates` / `.marketplace_check_repository` / `.marketplace_install_updates` |
| `marketplace_refresh_updates_found` event | `system_hub_marketplace_updates_found` |
| `sensor.marketplace_refresh_*`, `button.marketplace_refresh_check_for_updates` | `sensor.system_hub_marketplace_*`, `button.system_hub_marketplace_check_for_updates` |

## Translations

English, French, German, Spanish, Italian, Dutch, Portuguese (Portugal and Brazil), Polish, Romanian, Danish, Swedish, Bulgarian, Russian, Ukrainian, Hungarian, Slovak, Czech, Slovenian, Latvian, Greek and Serbian (Cyrillic and Latin).

## License

[MIT](https://github.com/juju35/ha-system-hub/blob/main/LICENSE)

## Support

If you find this project useful, you can support its development:

<a href="https://buymeacoffee.com/julienstep9"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me a Coffee" height="50"></a>
