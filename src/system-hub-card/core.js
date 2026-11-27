// System Hub's Lovelace cards: one card and one mini card, `module:` picking what they show.
//   type: custom:system-hub-card        module: status (default), system, security, watchdog, marketplace, batteries,
//                                       git_sync, automations, orphans
//   type: custom:system-hub-mini-card   module: status (default), system, security, watchdog, batteries, git_sync,
//                                       automations, orphans
// A module's card is the one its own file defines (sh-<module>-card, sh-<module>-mini-card), with its options
// unchanged. The status cards show the Status tab of the panel: they read it with the panel's own code (its module,
// without showing it), as the sidebar icon does, so the three always agree. Administrators only, as the panel.

export var SYSTEM_HUB_CARD_VERSION = '3.15.3';
export var SH_CARD_MODULES = ['status', 'system', 'security', 'watchdog', 'marketplace', 'batteries', 'git_sync', 'automations', 'orphans'];
export var SH_MINI_MODULES = ['status', 'system', 'security', 'watchdog', 'batteries', 'git_sync', 'automations', 'orphans'];
export var SH_CARD_GROUPS = ['system', 'security', 'reliability', 'maintenance', 'devices'];
export var SH_CARD_TAG = (module, mini) => `sh-${module.replace('_', '-')}${mini ? '-mini' : ''}-card`;
// The status read again every 30 seconds at most, whichever card asks
export var SH_CARD_READ_MS = 30000;

export function shCardEsc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

// The panel's strings (selector.panel), loaded once
export async function shCardStrings(hass) {
  try {
    await hass.loadBackendTranslation?.('selector', 'system_hub');
  } catch (_err) {
    // the English fallbacks below
  }
}

export function shCardT(hass, key, fallback, vars) {
  try {
    var text = hass?.localize?.(`component.system_hub.selector.panel.options.${key}`, vars || {});
    if (text) return text;
  } catch (_err) {
    // the fallback
  }
  return String(fallback).replace(/\{(\w+)\}/g, (_m, name) => String(vars?.[name] ?? ''));
}

// The panel read without being shown: one for the page, shared with the sidebar icon (system-hub-icons.js)
export async function shCardProbe(hass) {
  var panel = hass?.panels?.['system-hub'];
  if (!hass?.user?.is_admin || !panel) throw new Error('admin');
  if (!customElements.get('system-hub-panel')) await import(panel.config._panel_custom.module_url);
  var Panel = customElements.get('system-hub-panel');
  var probe = (window.__systemHubProbe ??= new Panel());
  probe._headless = true;
  probe._hass = hass;
  if (!probe._cardRead || Date.now() - probe._cardAt > SH_CARD_READ_MS) {
    probe._cardAt = Date.now();
    probe._cardRead = (async () => {
      if (!probe._localize) await probe._loadStrings();
      await probe._load();
    })();
  }
  await probe._cardRead;
  return probe;
}

// The areas of the Status tab, by group, the ones not wanted left out
export function shCardStatus(probe, config) {
  var Panel = probe.constructor;
  var { areas, counts, score, tone } = probe._stTone();
  var groups = Array.isArray(config.groups) && config.groups.length ? [...config.groups] : SH_CARD_GROUPS;
  // Security was in the System group until 3.15: a card listing system still shows it
  if (groups.includes('system') && !groups.includes('security')) groups.push('security');
  var shown = areas.filter(([tab, [t]]) => groups.includes(Panel.groupOf(tab)) && !(config.hide_ok && t === 'good'));
  var points = counts.bad + counts.warn + counts.info;
  return { areas: shown, all: areas, counts, score, tone, points };
}

// The status pill after the title: a dot and the health score, in the overall tone (the header icon's colour).
export function shCardPill(status) {
  var text = `${status.score}/100`;
  return `<span class="chip ${status.tone}" title="${shCardEsc(text)}" aria-label="${shCardEsc(text)}"><span class="cdot"></span><span class="ct">${shCardEsc(text)}</span></span>`;
}

export function shCardOpen(tab) {
  history.pushState(null, '', `/system-hub/${tab}`);
  window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: false } }));
}
