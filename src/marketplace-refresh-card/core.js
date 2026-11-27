/**
 * marketplace-refresh-card — the update check of Marketplace Refresh: status and progress, the last and next check, the updates
 * available for the repositories installed from the Marketplace, and the ones that couldn't be checked.
 * Served and added to the dashboard resources by the integration.
 * https://github.com/juju35/ha-system-hub (Marketplace module, from ha-marketplace-refresh)
 */
// Requests left under which the card says the checks may wait for GitHub's limit to reset.
export const MR_RATE_LOW = 1500;
export var MARKETPLACE_REFRESH_CARD_VERSION = '3.15.3';
// System Hub: its entities (platform system_hub, translation keys marketplace_*) and actions (system_hub.marketplace_*)
export var HR_DOMAIN = 'system_hub';
export var HR_PREFIX = 'marketplace_';
