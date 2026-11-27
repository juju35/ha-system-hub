// Purge tab (Purge module): the folders whose old files are deleted every night (mcp_backups by default). For each
// folder its files, those a purge would delete now and why a folder is left out; the last purge; Purge now once
// confirmed. The folders are read from system_hub/purge (a scan that deletes nothing) when the tab is shown.
import { shErr, shEsc } from "./core.js";
import { shBytes } from "./network-graphs.js";
import { SystemHubPanel } from "./panel.js";

export var SH_PURGE_METHODS = {
  // Read again every minute at most, or at once (force) after a purge
  async _pgLoad(force) {
    if (!this._hass?.callWS || (!force && this._pg?.at && Date.now() - this._pg.at < 60000)) return;
    this._pg = { ...(this._pg || {}), at: Date.now() };
    try {
      this._pg = { data: await this._hass.callWS({ type: 'system_hub/purge' }), at: Date.now(), error: null };
    } catch (err) {
      this._pg = { ...this._pg, error: shErr(err) };
    }
    if (this._tab === 'purge') this._render();
  },

  // What the folders hold and what a purge would delete now, once read
  _pgSummary() {
    var folders = this._pg?.data?.folders;
    if (!folders) return null;
    var sum = (key) => folders.reduce((total, f) => total + (f[key] || 0), 0);
    var refused = folders.filter((f) => f.refused);
    var missing = folders.filter((f) => !f.refused && !f.exists);
    var errors = folders.reduce((total, f) => total + (f.errors || []).length, 0);
    return { folders, refused, missing, errors, files: sum('files'), size: sum('size'), old: sum('old_files'), oldSize: sum('old_size') };
  },

  // A folder's line: where it is, what it holds, what would go; why it is left out
  _pgFolder(f, days) {
    var why = f.refused ? this._t(`pg_refused_${f.refused}`) : !f.exists ? this._t('pg_missing') : '';
    var bits = why
      ? [f.path !== f.directory ? f.path : '', why]
      : [
          f.path !== f.directory ? f.path : '',
          this._t('pg_files', { n: (f.files || 0).toLocaleString(this._hass?.language), size: shBytes(f.size || 0) }),
          f.oldest ? this._t('pg_oldest', { when: this._rel(new Date(f.oldest * 1000).toISOString()) }) : '',
          ...(f.errors || []).slice(0, 1),
        ];
    var pill = why
      ? `<span class="pill ${f.refused ? 'bad' : 'warn'}">${shEsc(this._t(f.refused ? 'pg_left_out' : 'pg_missing_short'))}</span>`
      : `<span class="pill ${f.old_files ? 'warn' : 'good'}">${shEsc(f.old_files ? this._t('pg_n_old', { n: f.old_files, size: shBytes(f.old_size || 0) }) : this._t('pg_nothing'))}</span>`;
    var icon = f.refused ? 'mdi:folder-cancel-outline' : !f.exists ? 'mdi:folder-question-outline' : f.old_files ? 'mdi:folder-clock-outline' : 'mdi:folder-check-outline';
    return `<div class="item${why ? ' warn' : ''}"><ha-icon icon="${icon}"></ha-icon>
      <div class="who"><div class="n">${shEsc(f.directory)}</div><div class="s">${shEsc(bits.filter(Boolean).join(' · '))}</div></div>${pill}</div>`;
  },

  // Purge: what the folders hold, what the night's purge (or Purge now) deletes, the last purge, each folder
  _purge() {
    var state = this._state.purge || {};
    var days = state.max_age ?? 30;
    var pg = this._pgSummary();
    if (!pg) {
      if (!this._pg) this._pgLoad();
      if (this._pg?.error) {
        return `<ha-card class="note error" role="alert">${shEsc(this._t('failed', { error: this._pg.error }))}
          <button class="act" data-action="pg_refresh"><ha-icon icon="mdi:refresh"></ha-icon>${shEsc(this._t('refresh'))}</button></ha-card>`;
      }
      return `<ha-card class="note">${this._spinner(this._t('loading'))}</ha-card>`;
    }
    var running = Boolean(state.running) || Boolean(this._busy.pg_purge);
    var tiles = [
      this._tile('mdi:folder-multiple-outline', `<b>${pg.folders.length - pg.refused.length}</b>`, this._t('pg_folders'), pg.refused.length || pg.missing.length ? 'warn' : pg.folders.length ? 'good' : ''),
      this._tile('mdi:file-clock-outline', `<b>${pg.old.toLocaleString(this._hass?.language)}</b>`, this._t('pg_to_delete', { n: days }), pg.old ? 'warn' : 'good'),
      this._tile('mdi:harddisk-remove', shEsc(shBytes(pg.oldSize)), this._t('pg_reclaim'), ''),
      this._tile(
        'mdi:delete-clock-outline',
        shEsc(state.last_run ? this._rel(state.last_run) : this._t('never')),
        state.last_run ? this._t('pg_last_done', { n: state.last_files ?? 0, size: shBytes(state.last_bytes || 0) }) : this._t('pg_last'),
        state.last_errors ? 'bad' : state.last_run ? 'good' : '',
      ),
    ];
    var confirm =
      this._confirm === 'pg_purge'
        ? `<div class="confirm" role="alertdialog">${shEsc(this._t('pg_confirm', { n: pg.old, size: shBytes(pg.oldSize), days }))}
          ${this._button('pg_purge', 'mdi:delete-clock-outline', this._t('pg_now'), { danger: true })}${this._button('cancel', 'mdi:close', this._t('cancel'), { quiet: true })}</div>`
        : '';
    var actions = `<div class="actions">${state.last_errors ? `<span class="msg warn-text">${shEsc(this._t('pg_errors', { n: state.last_errors }))}</span>` : ''}${this._message('pg')}
      <span class="grow"></span>
      ${this._button('pg_refresh', 'mdi:refresh', this._t('refresh'), { quiet: true, busy: this._busy.pg_refresh })}
      ${this._button('pg_purge_confirm', 'mdi:delete-clock-outline', this._t('pg_now'), { quiet: true, busy: running, disabled: !pg.old })}${this._configure()}</div>${confirm}`;
    var list = pg.folders.map((f) => this._pgFolder(f, days)).join('');
    return `<div class="tiles">${tiles.join('')}</div>${actions}
      <ha-card class="list"><div class="lhead"><ha-icon icon="mdi:folder-multiple-outline"></ha-icon><span class="lname">${shEsc(this._t('pg_folders'))}</span><span class="muted">${shEsc(this._t('pg_rule', { n: days }))}</span></div>
        ${list || `<div class="item"><div class="who"><div class="s">${shEsc(this._t('pg_none'))}</div></div></div>`}</ha-card>`;
  },

  // Purge now (once confirmed): the files deleted, then the folders read again
  async _pgPurge() {
    this._confirm = null;
    await this._run('purge_files', 'pg', {}, () => this._pgLoad(true), undefined, 'pg_purge');
  },
};

Object.assign(SystemHubPanel.prototype, SH_PURGE_METHODS);
