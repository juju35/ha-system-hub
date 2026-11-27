/**
 * git-sync-card — the Git status of a Home Assistant configuration (changes, last commit, last push, last
 * dashboard export), with Commit & push and Export dashboards actions.
 * git-sync-mini-card — the same in a compact card, with a zoom button that switches it to the full card.
 * Served and added to the dashboard resources by System Hub (its Git Sync module), the card of the former Git Sync
 * integration, same card types: dashboards using it keep working.
 * https://github.com/juju35/ha-system-hub
 */
export var GIT_SYNC_CARD_VERSION = '3.15.3';
// System Hub: its entities (platform system_hub, translation keys git_sync_*) and actions (system_hub.git_sync_*)
export var GS_DOMAIN = 'system_hub';
export var GS_PREFIX = 'git_sync_';
