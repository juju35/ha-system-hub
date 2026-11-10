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

Go to **Settings → Devices & services → Add integration** and search for **System Hub**.

## License

[MIT](https://github.com/juju35/ha-system-hub/blob/main/LICENSE)

## Support

If you find this project useful, you can support its development:

<a href="https://buymeacoffee.com/julienstep9"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me a Coffee" height="50"></a>
