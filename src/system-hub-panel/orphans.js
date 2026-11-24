// Orphans tab (Orphans module): the entities their integration no longer provides and the orphan devices. Counters by
// reason, search and filters, selection one by one or of every match, Remove and Ignore in bulk once confirmed, and
// what still uses each orphan. The whole list comes from system_hub/orphans (the sensor's attributes are capped).
import { SH_DOMAIN, shErr, shEsc } from "./core.js";
import { SystemHubPanel } from "./panel.js";

export var SH_ORPH_REASONS = ['entry_removed', 'integration_missing', 'not_provided', 'unavailable', 'unknown'];
export var SH_ORPH_ICONS = {
  entry_removed: 'mdi:puzzle-remove-outline',
  integration_missing: 'mdi:puzzle-remove-outline',
  not_provided: 'mdi:ghost-outline',
  unavailable: 'mdi:lan-disconnect',
  unknown: 'mdi:help-circle-outline',
};
export var SH_ORPH_REF_ICONS = {
  automation: 'mdi:robot-outline',
  script: 'mdi:script-text-outline',
  scene: 'mdi:palette-outline',
  group: 'mdi:google-circles-communities',
  dashboard: 'mdi:view-dashboard-outline',
};
// Rows shown before "Show all"
export var SH_ORPH_ROWS = 100;

// No longer provided: red; still provided but stale: orange
export function shOrphTone(reason) {
  return reason === 'unavailable' || reason === 'unknown' ? 'warn' : 'bad';
}

// The orphans matching every search word (name, entity ID, integration, device, config entry), integration and reason
export function shOrphFilter(items, filters = {}, names = {}) {
  var words = String(filters.q || '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  return (items || []).filter((i) => {
    if (filters.platform && i.platform !== filters.platform) return false;
    if (filters.reason && i.reason !== filters.reason) return false;
    var hay = [i.name, i.entity_id, i.platform, names[i.platform], i.device, i.entry_title].filter(Boolean).join(' ').toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

export var SH_ORPHANS_METHODS = {
  _orph() {
    this._orphState ??= { data: null, error: null, loading: false, sel: new Set(), dsel: new Set(), all: false, confirm: null };
    return this._orphState;
  },

  async _orphLoad() {
    var o = this._orph();
    if (o.loading || !this._hass) return;
    o.loading = true;
    try {
      o.data = await this._hass.callWS({ type: 'system_hub/orphans' });
      o.error = null;
      // Only what is still listed stays selected
      var ids = new Set((o.data.entities || []).map((e) => e.entity_id));
      var devices = new Set((o.data.devices || []).map((d) => d.device_id));
      o.sel = new Set([...o.sel].filter((id) => ids.has(id)));
      o.dsel = new Set([...o.dsel].filter((id) => devices.has(id)));
    } catch (err) {
      o.error = shErr(err);
    }
    o.loading = false;
  },

  // "{n} entity" / "{n} entities": the key's _one or _many string
  _orphN(key, n) {
    return this._t(`${key}_${n === 1 ? 'one' : 'many'}`, { n });
  },

  _orphFilters() {
    return { q: this._draft.orph_q || '', platform: this._draft.orph_platform || '', reason: this._draft.orph_reason || '' };
  },

  // "for 3 d": "< 1 h" the first hour, hours up to two days, days beyond
  _orphFor(iso) {
    var t = new Date(iso).getTime();
    if (!iso || !Number.isFinite(t)) return '';
    var h = Math.max(0, (Date.now() - t) / 3600000);
    var d = h < 1 ? this._t('hours', { n: '< 1' }) : h < 48 ? this._t('hours', { n: Math.floor(h) }) : this._t('days', { n: Math.floor(h / 24) });
    return this._t('orph_for', { d });
  },

  // What still uses an orphan: automations, scripts, scenes, groups and dashboards, each a link to its editor
  _orphUses(refs) {
    if (!refs?.length) return '';
    var chips = refs
      .map((r) => {
        var inner = `<ha-icon icon="${SH_ORPH_REF_ICONS[r.type] || 'mdi:link-variant'}"></ha-icon>${shEsc(r.name)}`;
        var title = shEsc(this._t(`orph_ref_${r.type}`));
        return r.path ? `<a class="use" href="${shEsc(r.path)}" title="${title}">${inner}</a>` : `<span class="use" title="${title}">${inner}</span>`;
      })
      .join('');
    return `<div class="uses"><span>${shEsc(this._t('orph_used_by', { n: refs.length }))}</span>${chips}</div>`;
  },

  _orphTile(reason, n, on) {
    var tone = n ? shOrphTone(reason) : 'good';
    return `<ha-card class="tile pick ${tone}${on ? ' on' : ''}" data-action="orph_reason" data-reason="${reason}" aria-pressed="${on}">
      <div class="avatar"><ha-icon icon="${SH_ORPH_ICONS[reason]}"></ha-icon></div>
      <div class="who"><div class="n"><b>${n}</b></div><div class="s">${shEsc(this._t(`orph_reason_${reason}`))}</div></div></ha-card>`;
  },

  _orphConfirm(kind, n, used) {
    var title = {
      remove: this._orphN('orph_confirm_remove', n),
      ignore: this._orphN('orph_confirm_ignore', n),
      remove_devices: this._t('orph_confirm_devices'),
      ignore_devices: this._t('orph_confirm_ignore_devices'),
    }[kind];
    var text = { remove: 'orph_confirm_remove_text', ignore: 'orph_confirm_ignore_text', remove_devices: 'orph_confirm_devices_text' }[kind];
    var warn = used ? (kind === 'remove' ? this._orphN('orph_confirm_used', used) : kind === 'remove_devices' ? this._t('orph_confirm_devices_used', { n: used }) : '') : '';
    var label = kind.startsWith('ignore') ? this._t('orph_ignore') : warn ? this._t('orph_remove_anyway') : this._t('orph_remove');
    return `<div class="confirm" role="alertdialog"><div class="who"><div class="n">${shEsc(title)}</div>
        ${text ? `<div class="s">${shEsc(this._t(text))}</div>` : ''}${warn ? `<div class="s warn-text">${shEsc(warn)}</div>` : ''}</div>
      ${this._button('orph_do', kind.startsWith('ignore') ? 'mdi:eye-off-outline' : 'mdi:delete-outline', label, { danger: !kind.startsWith('ignore') })}
      ${this._button('orph_cancel', 'mdi:close', this._t('cancel'), { quiet: true })}</div>`;
  },

  _orphRow(e, names, on) {
    var sub = [e.entity_id, names[e.platform] || e.platform, e.device, e.entry_title].filter(Boolean);
    var why = [this._t(`orph_reason_${e.reason}`), this._orphFor(e.since)].filter(Boolean).join(' · ');
    var tone = shOrphTone(e.reason);
    return `<div class="item orow ${tone}${on ? ' on' : ''}">
      <input type="checkbox" data-orph-sel="${shEsc(e.entity_id)}"${on ? ' checked' : ''} aria-label="${shEsc(e.name)}">
      <ha-icon icon="${SH_ORPH_ICONS[e.reason] || 'mdi:ghost-outline'}"></ha-icon>
      <div class="who"><div class="n">${shEsc(e.name)}${e.disabled ? ` <span class="muted">(${shEsc(this._t('orph_disabled'))})</span>` : ''}</div>
        <div class="s">${shEsc(sub.join(' · '))}</div><div class="s">${shEsc(why)}</div>${this._orphUses(e.used_by)}</div>
      <span class="pill ${tone}">${shEsc(this._t(`orph_reason_${e.reason}`))}</span></div>`;
  },

  _orphDevices(devices, o) {
    if (!devices.length) return '';
    var rows = devices
      .map((d) => {
        var on = o.dsel.has(d.device_id);
        var sub = [[d.manufacturer, d.model].filter(Boolean).join(' '), this._t('orph_dev_entities', { n: d.entities ?? 0 }), this._orphFor(d.since)].filter(Boolean);
        return `<div class="item orow bad${on ? ' on' : ''}">
          <input type="checkbox" data-orph-dsel="${shEsc(d.device_id)}"${on ? ' checked' : ''} aria-label="${shEsc(d.name)}">
          <ha-icon icon="mdi:devices"></ha-icon>
          <div class="who"><div class="n">${shEsc(d.name)}</div><div class="s">${shEsc(sub.join(' · '))}</div>${this._orphUses(d.used_by)}</div>
          <a class="icon-btn" href="/config/devices/device/${shEsc(d.device_id)}" title="${shEsc(this._t('open_device'))}" aria-label="${shEsc(this._t('open_device'))}"><ha-icon icon="mdi:open-in-new"></ha-icon></a></div>`;
      })
      .join('');
    var targets = o.dsel.size ? devices.filter((d) => o.dsel.has(d.device_id)) : devices;
    var used = targets.filter((d) => d.used_by?.length).length;
    var confirm = o.confirm === 'remove_devices' || o.confirm === 'ignore_devices' ? this._orphConfirm(o.confirm, targets.length, used) : '';
    var bar = `<div class="obar">${o.dsel.size ? `<span>${shEsc(this._orphN('orph_selected', o.dsel.size))}</span>` : ''}
      ${this._button('orph_confirm', 'mdi:delete-outline', this._t('orph_remove_devices'), { data: { act: 'remove_devices' }, disabled: this._busy.orph, busy: this._busy.orph === 'remove_devices', danger: true })}
      ${this._button('orph_confirm', 'mdi:eye-off-outline', this._t('orph_ignore'), { quiet: true, data: { act: 'ignore_devices' }, disabled: !o.dsel.size || this._busy.orph, busy: this._busy.orph === 'ignore_devices' })}
      ${o.dsel.size ? this._button('orph_dclear', 'mdi:close', this._t('orph_clear'), { quiet: true }) : ''}</div>`;
    return `<ha-card class="list"><div class="lhead"><ha-icon icon="mdi:devices"></ha-icon><span class="lname">${shEsc(this._t('orph_devices_title'))}</span>
        <span class="muted">${devices.length}</span></div>
      <div class="obar">${shEsc(this._t('orph_devices_hint'))}</div>${bar}${confirm}${rows}</ha-card>`;
  },

  _orphans() {
    var summary = this._state.orphans || {};
    var o = this._orph();
    if (!o.data && !o.loading && !o.error) {
      this._orphLoad().then(() => this._tab === 'orphans' && this._render());
    }
    var data = o.data || {};
    var counts = data.counts || summary.counts || {};
    var names = data.integrations || {};
    var f = this._orphFilters();
    var entities = data.entities || [];
    var devices = data.devices || [];
    var tiles = [
      ...SH_ORPH_REASONS.map((r) => this._orphTile(r, counts[r] ?? 0, f.reason === r)),
      this._tile('mdi:devices', `<b>${summary.devices ?? devices.length}</b>`, this._t('orph_devices_title'), summary.devices ? 'bad' : 'good'),
      this._tile('mdi:delete-sweep-outline', `<b>${summary.removed ?? 0}</b>`, this._t('orph_stat_removed'), '', { title: this._t('orph_stat_removed_hint') }),
      this._tile('mdi:clock-check-outline', shEsc(summary.last_scan ? this._rel(summary.last_scan) : this._t('orph_never_scanned')), this._entityName('sensor', 'orphans_last_scan'), ''),
    ];
    var waiting = summary.next_scan ? `<span class="pill warn">${shEsc(this._t('orph_waiting'))} · ${shEsc(this._rel(summary.next_scan))}</span>` : '';
    var actions = `<div class="actions">${this._button('orphans_scan', 'mdi:magnify-scan', this._entityName('button', 'orphans_scan'))}
      ${waiting}${summary.ignored ? `<span class="pill">${shEsc(this._t('orph_stat_ignored'))} ${summary.ignored}</span>` : ''}
      ${this._message('orphans_scan')}${this._message('orphans')}
      ${this._configure()}</div>`;
    if (!o.data) {
      var note = o.error ? shEsc(this._t('failed', { error: o.error })) : this._spinner(this._t('loading'));
      return `<div class="tiles">${tiles.join('')}</div>${actions}<ha-card class="note">${note}</ha-card>`;
    }
    var platforms = [...new Set(entities.map((e) => e.platform))].sort((a, b) => (names[a] || a).localeCompare(names[b] || b));
    var matches = shOrphFilter(entities, f, names);
    var shown = o.all ? matches : matches.slice(0, SH_ORPH_ROWS);
    var selected = entities.filter((e) => o.sel.has(e.entity_id));
    var used = selected.filter((e) => e.used_by?.length).length;
    var filters = `<div class="ofilters">
      <label class="box"><input data-draft="orph_q" type="search" placeholder="${shEsc(this._t('orph_search'))}" aria-label="${shEsc(this._t('orph_search'))}" value="${shEsc(f.q)}"></label>
      <select data-draft="orph_platform" aria-label="${shEsc(this._t('orph_all_integrations'))}"><option value="">${shEsc(this._t('orph_all_integrations'))}</option>
        ${platforms.map((p) => `<option value="${shEsc(p)}"${p === f.platform ? ' selected' : ''}>${shEsc(names[p] || p)}</option>`).join('')}</select>
      <select data-draft="orph_reason" aria-label="${shEsc(this._t('orph_all'))}"><option value="">${shEsc(this._t('orph_all'))}</option>
        ${SH_ORPH_REASONS.filter((r) => counts[r])
          .map((r) => `<option value="${r}"${r === f.reason ? ' selected' : ''}>${shEsc(this._t(`orph_reason_${r}`))} (${counts[r]})</option>`)
          .join('')}</select></div>`;
    var unselected = matches.filter((e) => !o.sel.has(e.entity_id)).length;
    var bar = o.sel.size
      ? `<div class="obar"><span>${shEsc(this._orphN('orph_selected', o.sel.size))}</span>
          ${this._button('orph_confirm', 'mdi:delete-outline', this._t('orph_remove'), { data: { act: 'remove' }, disabled: this._busy.orph, busy: this._busy.orph === 'remove', danger: true })}
          ${this._button('orph_confirm', 'mdi:eye-off-outline', this._t('orph_ignore'), { quiet: true, data: { act: 'ignore' }, disabled: this._busy.orph, busy: this._busy.orph === 'ignore' })}
          ${unselected ? this._button('orph_select_all', 'mdi:checkbox-multiple-marked-outline', this._t('orph_select_all', { n: matches.length }), { quiet: true }) : ''}
          ${this._button('orph_clear', 'mdi:close', this._t('orph_clear'), { quiet: true })}</div>`
      : matches.length
        ? `<div class="obar">${this._button('orph_select_all', 'mdi:checkbox-multiple-marked-outline', this._t('orph_select_all', { n: matches.length }), { quiet: true })}</div>`
        : '';
    var confirm = o.confirm === 'remove' || o.confirm === 'ignore' ? this._orphConfirm(o.confirm, o.sel.size, used) : '';
    var rows = shown.map((e) => this._orphRow(e, names, o.sel.has(e.entity_id))).join('');
    var empty = entities.length
      ? `<div class="empty">${shEsc(this._t('orph_no_match'))}</div>`
      : `<div class="empty good"><ha-icon icon="mdi:check-circle-outline"></ha-icon>${shEsc(this._t('orph_empty'))}</div>`;
    var more = shown.length < matches.length ? `<div class="omore">${this._button('orph_all', 'mdi:chevron-down', this._t('orph_show_all', { n: matches.length }), { quiet: true })}</div>` : '';
    return `<div class="tiles">${tiles.join('')}</div>${actions}
      <ha-card class="list"><div class="lhead"><ha-icon icon="mdi:ghost-outline"></ha-icon><span class="lname">${shEsc(this._entityName('sensor', 'orphans_orphans'))}</span>
        <span class="muted">${matches.length === entities.length ? entities.length : `${matches.length} / ${entities.length}`}</span></div>
        ${entities.length ? filters : ''}${bar}${confirm}${rows || empty}${more}</ha-card>
      ${this._orphDevices(devices, o)}`;
  },

  // Checkboxes, filters by reason, selection and the confirmed actions; false: not an Orphans control
  _orphClick(ev) {
    var o = this._orph();
    var pick = ev.target.closest?.('[data-orph-sel], [data-orph-dsel]');
    if (pick) {
      var set = pick.dataset.orphSel ? o.sel : o.dsel;
      var id = pick.dataset.orphSel || pick.dataset.orphDsel;
      if (set.has(id)) set.delete(id);
      else set.add(id);
      o.confirm = null;
      this._render();
      return true;
    }
    var el = ev.target.closest?.('[data-action^="orph_"]');
    if (!el) return false;
    if (el.disabled) return true;
    var action = el.dataset.action;
    if (action === 'orph_reason') {
      this._draft.orph_reason = this._draft.orph_reason === el.dataset.reason ? '' : el.dataset.reason;
    } else if (action === 'orph_select_all') {
      for (var e of shOrphFilter(o.data?.entities, this._orphFilters(), o.data?.integrations)) o.sel.add(e.entity_id);
    } else if (action === 'orph_clear') {
      o.sel.clear();
      o.confirm = null;
    } else if (action === 'orph_dclear') {
      o.dsel.clear();
      o.confirm = null;
    } else if (action === 'orph_confirm') {
      o.confirm = el.dataset.act;
    } else if (action === 'orph_cancel') {
      o.confirm = null;
    } else if (action === 'orph_all') {
      o.all = true;
    } else if (action === 'orph_do') {
      this._orphRun(o.confirm);
      return true;
    }
    this._render();
    return true;
  },

  // An admin action of the module, with its response (what was removed, what was kept as no longer orphaned)
  async _orphCall(service, data) {
    var res = await this._hass.callWS({ type: 'call_service', domain: SH_DOMAIN, service, service_data: data, return_response: true });
    return res?.response || {};
  },

  async _orphRun(act) {
    var o = this._orph();
    o.confirm = null;
    var entities = [...o.sel];
    var devices = [...o.dsel];
    this._busy.orph = act;
    delete this._messages.orphans;
    this._render();
    try {
      var text;
      if (act === 'remove') {
        var res = await this._orphCall('orphans_remove', { entities });
        text = this._orphN('orph_removed', (res.removed || entities).length);
        if (res.skipped?.length) text += ` · ${this._t('orph_kept', { n: res.skipped.length })}`;
        o.sel.clear();
      } else if (act === 'ignore') {
        await this._hass.callService(SH_DOMAIN, 'orphans_ignore', { entities });
        text = this._orphN('orph_ignored', entities.length);
        o.sel.clear();
      } else if (act === 'remove_devices') {
        // Without a selection: every orphan device of the last scan
        var dres = await this._orphCall('orphans_remove_devices', devices.length ? { devices } : {});
        text = this._t('orph_devices_removed', { n: (dres.removed || []).length });
        if (dres.skipped?.length) text += ` · ${this._t('orph_kept', { n: dres.skipped.length })}`;
        o.dsel.clear();
      } else if (act === 'ignore_devices') {
        await this._hass.callService(SH_DOMAIN, 'orphans_ignore', { devices });
        text = this._t('orph_devices_ignored', { n: devices.length });
        o.dsel.clear();
      }
      if (text) this._toast(text);
    } catch (err) {
      this._messages.orphans = { text: this._t('failed', { error: shErr(err) }), tone: 'bad' };
    }
    await this._load();
    delete this._busy.orph;
    this._render();
  },
};

Object.assign(SystemHubPanel.prototype, SH_ORPHANS_METHODS);
