// Purge tab (Purge module): the folders whose old files are deleted every night (mcp_backups by default). For each
// folder its files, those a purge would delete now and why a folder is left out; the last purge; Purge now once
// confirmed. The folders are read from system_hub/purge (a scan that deletes nothing) when the tab is shown.
// The folders are chosen in a picker drawn like a file explorer (address bar, tree, list with columns), which never
// goes above /config; from the tab it saves them at once, from the Settings tab it fills the form.
import { SH_DOMAIN, shErr, shEsc } from "./core.js";
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
    var remove = `<button class="pkx" data-action="pg_remove" data-dir="${shEsc(f.directory)}" title="${shEsc(this._t('pg_remove'))}" aria-label="${shEsc(`${this._t('pg_remove')} ${f.directory}`)}"><ha-icon icon="mdi:close"></ha-icon></button>`;
    return `<div class="item${why ? ' warn' : ''}"><ha-icon icon="${icon}"></ha-icon>
      <div class="who"><div class="n">${shEsc(f.directory)}</div><div class="s">${shEsc(bits.filter(Boolean).join(' · '))}</div></div>${pill}${remove}</div>`;
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
    var choose = this._button('pk_open', 'mdi:folder-search-outline', this._t('pg_choose'), { quiet: true, data: { origin: 'tab' } });
    var confirm =
      this._confirm === 'pg_purge'
        ? `<div class="confirm" role="alertdialog">${shEsc(this._t('pg_confirm', { n: pg.old, size: shBytes(pg.oldSize), days }))}
          ${this._button('pg_purge', 'mdi:delete-clock-outline', this._t('pg_now'), { danger: true })}${this._button('cancel', 'mdi:close', this._t('cancel'), { quiet: true })}</div>`
        : '';
    var actions = `<div class="actions">${state.last_errors ? `<span class="msg warn-text">${shEsc(this._t('pg_errors', { n: state.last_errors }))}</span>` : ''}${this._message('pg')}
      <span class="grow"></span>
      ${choose}${this._button('pg_refresh', 'mdi:refresh', this._t('refresh'), { quiet: true, busy: this._busy.pg_refresh })}
      ${this._button('pg_purge_confirm', 'mdi:delete-clock-outline', this._t('pg_now'), { quiet: true, busy: running, disabled: !pg.old })}${this._configure()}</div>${confirm}`;
    var list = pg.folders.map((f) => this._pgFolder(f, days)).join('');
    return `<div class="tiles">${tiles.join('')}</div>${actions}
      <ha-card class="list"><div class="lhead"><ha-icon icon="mdi:folder-multiple-outline"></ha-icon><span class="lname">${shEsc(this._t('pg_folders'))}</span><span class="muted">${shEsc(this._t('pg_rule', { n: days }))}</span></div>
        ${list || `<div class="item"><div class="who"><div class="s">${shEsc(this._t('pg_none'))}</div></div></div>`}</ha-card>${this._pkDialog()}`;
  },

  // Saves the folders of the module (from the tab): no reload, the folders read again
  async _pgSave(directories) {
    try {
      await this._hass.callWS({ type: 'system_hub/purge_set_folders', directories });
    } catch (err) {
      var text = err?.code === 'purge_refused' ? this._t('pg_refused_protected') + ` (${err.message})` : shErr(err);
      if (this._pk) this._pk.error = text;
      else this._messages.pg = { text: this._t('failed', { error: text }), tone: 'bad' };
      this._render();
      return false;
    }
    await this._load();
    await this._pgLoad(true);
    return true;
  },

  // ── Folder picker ──
  // Opened from the tab (origin "tab") or from the Purge settings (origin "settings"), on /config, the folders
  // already chosen ticked
  _pkOpen(origin) {
    var cfg = origin === 'settings' ? this._cfgState() : null;
    var current = cfg ? cfg.data?.directories || [] : this._state.purge?.directories || [];
    this._pk = { origin, path: '', back: [], cache: {}, current: {}, roots: [{ path: '', name: 'config' }], selected: [...current], busy: false, error: null };
    this._draft.pk_q = '';
    this._pkGo('', false);
  },

  async _pkGo(path, push = true) {
    var pk = this._pk;
    if (!pk) return;
    if (push && pk.path !== path) pk.back.push(pk.path);
    this._draft.pk_q = '';
    var wanted = [...new Set(['', this._pkRoot(path), path])].filter((p) => !(p in pk.cache));
    pk.path = path;
    if (wanted.length) {
      pk.busy = true;
      this._render();
      try {
        for (var p of wanted) {
          var result = await this._hass.callWS({ type: `${SH_DOMAIN}/purge_browse`, path: p });
          pk.cache[result.path] = result.entries;
          pk.current[result.path] = result.current;
          if (result.roots) pk.roots = result.roots;
        }
        pk.error = null;
      } catch (err) {
        pk.error = shErr(err);
        pk.path = pk.back.pop() ?? '';
      }
      pk.busy = false;
    }
    if (this._pk === pk) this._render();
  },

  // The place a folder is in: /config ("") or /backup (its absolute path)
  _pkRoot(path) {
    return (this._pk.roots || []).find((r) => r.path && (path === r.path || path.startsWith(`${r.path}/`)))?.path || '';
  },

  // The parent of a folder, never above its place
  _pkParent(path) {
    var root = this._pkRoot(path);
    if (path === root) return root;
    var parent = path.split('/').slice(0, -1).join('/');
    return parent.length < root.length ? root : parent;
  },

  // The tree: /config, then the folders on the way to the one shown, unfolded
  _pkTree(path, depth) {
    var pk = this._pk;
    return (pk.cache[path] || [])
      .filter((e) => !e.protected)
      .map((e) => {
        var onWay = pk.path === e.path || pk.path.startsWith(`${e.path}/`);
        var open = onWay && pk.cache[e.path];
        var chevron = e.folders ? (open ? 'mdi:chevron-down' : 'mdi:chevron-right') : '';
        var chosen = pk.selected.includes(e.path);
        return `<button class="pktn${pk.path === e.path ? ' on' : ''}" style="padding-left:${8 + depth * 16}px" data-action="pk_go" data-path="${shEsc(e.path)}">
          <span class="pkch">${chevron ? `<ha-icon icon="${chevron}"></ha-icon>` : ''}</span><ha-icon class="pkfi" icon="${chosen ? 'mdi:folder-clock-outline' : 'mdi:folder-outline'}"></ha-icon><span class="pkn">${shEsc(e.name)}</span></button>${open ? this._pkTree(e.path, depth + 1) : ''}`;
      })
      .join('');
  },

  _pkDialog() {
    var pk = this._pk;
    if (!pk) return '';
    var days = this._state.purge?.max_age ?? 30;
    var root = this._pkRoot(pk.path);
    var rootName = root ? (pk.roots.find((r) => r.path === root)?.name ?? 'backup') : 'config';
    var rootIcon = root ? 'mdi:archive-outline' : 'mdi:home-assistant';
    var rest = pk.path.slice(root.length).replace(/^\//, '');
    var parts = rest ? rest.split('/') : [];
    var join = (i) => [root, ...parts.slice(0, i + 1)].filter(Boolean).join('/').replace(/^(?!\/)/, root ? '/' : '');
    var crumbs = [`<button class="pkc${parts.length ? '' : ' on'}" data-action="pk_go" data-path="${shEsc(root)}"><ha-icon icon="${rootIcon}"></ha-icon>${shEsc(rootName)}</button>`]
      .concat(parts.map((name, i) => `<span class="pksep">›</span><button class="pkc${i === parts.length - 1 ? ' on' : ''}" data-action="pk_go" data-path="${shEsc(join(i))}">${shEsc(name)}</button>`))
      .join('');
    // The folder shown, when it may be purged: ticked from the address bar (/backup itself, for its backups)
    var here = pk.path && pk.current[pk.path];
    var hereOn = pk.selected.includes(pk.path);
    var pickHere = here
      ? `<button class="pkhere${hereOn ? ' on' : ''}" data-action="pk_pick" data-path="${shEsc(pk.path)}" role="checkbox" aria-checked="${hereOn}"><span class="pkcb${hereOn ? ' on' : ''}">${hereOn ? '<ha-icon icon="mdi:check"></ha-icon>' : ''}</span>${shEsc(this._t('pk_this'))}${here.old_files ? ` <span class="pill warn">${shEsc(this._t('pk_old', { n: here.old_files, days }))}</span>` : ''}</button>`
      : '';
    var q = (this._draft.pk_q || '').trim().toLowerCase();
    var entries = (pk.cache[pk.path] || []).filter((e) => !q || e.name.toLowerCase().includes(q));
    var rows = entries
      .map((e) => {
        var chosen = pk.selected.includes(e.path);
        var content = e.protected ? '' : e.truncated ? this._t('pk_many', { n: (e.files || 0).toLocaleString(this._hass?.language) }) : this._t('pg_files', { n: (e.files || 0).toLocaleString(this._hass?.language), size: shBytes(e.size || 0) });
        var old = !e.protected && e.old_files ? `<span class="pill warn">${shEsc(this._t('pk_old', { n: e.old_files, days }))}</span>` : '';
        var name = e.protected
          ? `<span class="pkname"><ha-icon icon="mdi:folder-lock-outline"></ha-icon><span class="pkn">${shEsc(e.name)}</span><span class="pkprot">${shEsc(this._t('pk_protected'))}</span></span>`
          : `<button class="pkname" data-action="pk_go" data-path="${shEsc(e.path)}" title="${shEsc(this._t('pk_open'))}"${e.folders ? '' : ' data-leaf="1"'}><ha-icon icon="mdi:folder"></ha-icon><span class="pkn">${shEsc(e.name)}</span>${old}</button>`;
        return `<div class="pkrow${chosen ? ' sel' : ''}${e.protected ? ' prot' : ''}">
          <button class="pkcb${chosen ? ' on' : ''}" data-action="pk_pick" data-path="${shEsc(e.path)}" role="checkbox" aria-checked="${chosen}" aria-label="${shEsc(e.name)}"${e.protected ? ' disabled' : ''}>${chosen ? '<ha-icon icon="mdi:check"></ha-icon>' : ''}</button>
          ${name}<span class="pkd">${shEsc(content)}</span><span class="pkd pkmod">${shEsc(e.modified ? this._ago(new Date(e.modified * 1000).toISOString()) : '')}</span></div>`;
      })
      .join('');
    var body = pk.busy && !pk.cache[pk.path] ? this._spinner(this._t('loading'), true) : rows || `<div class="pkempty">${shEsc(this._t('pk_empty'))}</div>`;
    var chips = pk.selected
      .map((d) => `<button class="pkchip" data-action="pk_pick" data-path="${shEsc(d)}" aria-label="${shEsc(`${this._t('pg_remove')} ${d}`)}"><ha-icon icon="mdi:folder-clock-outline"></ha-icon>${shEsc(d)}<ha-icon icon="mdi:close"></ha-icon></button>`)
      .join('');
    return `<div class="ha-backdrop" data-action="pk_close"></div>
      <div class="pkdlg" role="dialog" aria-modal="true" aria-labelledby="pk-title">
        <div class="pkhd"><span class="pkav"><ha-icon icon="mdi:folder-search-outline"></ha-icon></span><div><div class="pkt" id="pk-title">${shEsc(this._t('pk_title'))}</div><div class="s">${shEsc(this._t('pk_sub'))}</div></div>
          <button class="pkrb pkclose" data-action="pk_close" title="${shEsc(this._t('cancel'))}" aria-label="${shEsc(this._t('cancel'))}"><ha-icon icon="mdi:close"></ha-icon></button></div>
        <div class="pkbar"><button class="pkrb" data-action="pk_back" title="${shEsc(this._t('pk_back'))}" aria-label="${shEsc(this._t('pk_back'))}"${pk.back.length ? '' : ' disabled'}><ha-icon icon="mdi:arrow-left"></ha-icon></button>
          <button class="pkrb" data-action="pk_up" title="${shEsc(this._t('pk_up'))}" aria-label="${shEsc(this._t('pk_up'))}"${pk.path && pk.path !== root ? '' : ' disabled'}><ha-icon icon="mdi:arrow-up"></ha-icon></button>
          <div class="pkaddr">${crumbs}</div>${pickHere}
          <label class="pksrch"><ha-icon icon="mdi:magnify"></ha-icon><input type="search" data-draft="pk_q" value="${shEsc(this._draft.pk_q || '')}" placeholder="${shEsc(this._t('pk_search'))}" aria-label="${shEsc(this._t('pk_search'))}"></label></div>
        <div class="pkbody"><nav class="pktree">${(pk.roots || [])
          .map((r) => {
            var open = this._pkRoot(pk.path) === r.path;
            return `<button class="pktn${pk.path === r.path ? ' on' : ''}" data-action="pk_go" data-path="${shEsc(r.path)}"><span class="pkch"><ha-icon icon="${open ? 'mdi:chevron-down' : 'mdi:chevron-right'}"></ha-icon></span><ha-icon class="pkfi" icon="${r.path ? 'mdi:archive-outline' : 'mdi:home-assistant'}"></ha-icon><span class="pkn">${shEsc(r.path ? r.name : 'config')}</span></button>${open ? this._pkTree(r.path, 1) : ''}`;
          })
          .join('')}</nav>
          <div class="pklist"><div class="pkth"><span></span><span>${shEsc(this._t('pk_name'))}</span><span>${shEsc(this._t('pk_content'))}</span><span class="pkmod">${shEsc(this._t('pk_modified'))}</span></div>${body}</div></div>
        ${pk.error ? `<div class="pkerr msg bad" role="alert">${shEsc(pk.error)}</div>` : ''}
        <div class="pkft"><div class="pkchips">${chips}</div>
          ${this._button('pk_close', 'mdi:close', this._t('cancel'), { quiet: true })}${this._button('pk_apply', 'mdi:check', this._t('pk_use', { n: pk.selected.length }), { busy: this._busy.pk_apply })}</div></div>`;
  },

  // The picker's buttons, and the tab's folder buttons
  async _pkClick(button, action) {
    var pk = this._pk;
    if (action === 'pk_open') return this._pkOpen(button.dataset.origin || 'tab');
    if (action === 'pg_remove') return this._pgSave((this._state.purge?.directories || []).filter((d) => d !== button.dataset.dir));
    if (!pk) return;
    if (action === 'pk_close') {
      this._pk = null;
      return this._render();
    }
    if (action === 'pk_go') return this._pkGo(button.dataset.path || '');
    if (action === 'pk_up') return this._pkGo(this._pkParent(pk.path));
    if (action === 'pk_back') return this._pkGo(pk.back.pop() ?? '', false);
    if (action === 'pk_pick') {
      var path = button.dataset.path;
      pk.selected = pk.selected.includes(path) ? pk.selected.filter((d) => d !== path) : [...pk.selected, path];
      return this._render();
    }
    if (action === 'pk_apply') {
      if (pk.origin === 'settings') {
        var cfg = this._cfgState();
        cfg.data = { ...(cfg.data || {}), directories: [...pk.selected] };
        if (cfg.haForm) cfg.haForm.data = cfg.data;
        this._pk = null;
        return this._render();
      }
      this._busy.pk_apply = true;
      this._render();
      var saved = await this._pgSave([...pk.selected]);
      delete this._busy.pk_apply;
      if (saved) this._pk = null;
      return this._render();
    }
  },

  // Purge now (once confirmed): the files deleted, then the folders read again
  async _pgPurge() {
    this._confirm = null;
    await this._run('purge_files', 'pg', {}, () => this._pgLoad(true), undefined, 'pg_purge');
  },
};

Object.assign(SystemHubPanel.prototype, SH_PURGE_METHODS);

// A file explorer's dialog: tree at the left, columns at the right; on a phone, the list alone with its two first
// columns
SystemHubPanel.STYLE += `
    .pkdlg { position:fixed; z-index:1001; left:50%; top:50%; transform:translate(-50%, -50%); width:min(820px, calc(100vw - 32px));
             max-height:calc(100vh - 48px); display:flex; flex-direction:column; box-sizing:border-box; border-radius:16px; overflow:hidden;
             background:var(--card-background-color, #fff); color:var(--primary-text-color); box-shadow:0 12px 40px rgba(0,0,0,.35); }
    .pkhd { display:flex; align-items:center; gap:12px; padding:16px 18px 12px; }
    .pkav { width:40px; height:40px; border-radius:50%; display:grid; place-items:center; color:var(--primary-color);
            background:color-mix(in srgb, var(--primary-color) 14%, transparent); flex:none; }
    .pkt { font-size:18px; font-weight:500; }
    .pkhd .s { font-size:13px; color:var(--secondary-text-color); }
    .pkclose { margin-left:auto; }
    .pkbar { display:flex; align-items:center; gap:6px; padding:8px 14px; border-block:1px solid var(--divider-color);
             background:color-mix(in srgb, var(--primary-text-color) 3%, transparent); }
    .pkrb { width:32px; height:32px; flex:none; border-radius:50%; display:grid; place-items:center; padding:0; cursor:pointer;
            color:var(--secondary-text-color); background:var(--card-background-color, #fff); border:1px solid var(--divider-color); }
    .pkrb[disabled] { opacity:.4; cursor:default; }
    .pkrb ha-icon { --mdc-icon-size:18px; }
    .pkaddr { flex:1; min-width:0; display:flex; align-items:center; gap:2px; height:34px; padding:0 8px; overflow-x:auto; white-space:nowrap;
              border:1px solid var(--divider-color); border-radius:8px; background:var(--card-background-color, #fff); font-size:14px; }
    .pkc { display:inline-flex; align-items:center; gap:4px; padding:3px 6px; border:0; border-radius:5px; background:none; cursor:pointer;
           color:var(--primary-text-color); font:inherit; }
    .pkc ha-icon { --mdc-icon-size:16px; color:var(--primary-color); }
    .pkc.on { color:var(--primary-color); background:color-mix(in srgb, var(--primary-color) 12%, transparent); }
    .pksep { color:var(--secondary-text-color); }
    .pkhere { display:inline-flex; align-items:center; gap:8px; height:34px; padding:0 10px; flex:none; border-radius:8px; cursor:pointer; font:inherit;
              font-size:14px; color:var(--primary-text-color); background:var(--card-background-color, #fff); border:1px solid var(--divider-color); }
    .pkhere.on { border-color:var(--primary-color); color:var(--primary-color); }
    .pksrch { display:flex; align-items:center; gap:6px; width:170px; height:34px; padding:0 10px; box-sizing:border-box; flex:none;
              border:1px solid var(--divider-color); border-radius:8px; background:var(--card-background-color, #fff); color:var(--secondary-text-color); }
    .pksrch ha-icon { --mdc-icon-size:18px; }
    .pksrch input { border:0; outline:0; background:none; min-width:0; flex:1; font:inherit; font-size:14px; color:var(--primary-text-color); }
    .pkbody { display:flex; min-height:0; height:min(400px, 55vh); }
    .pktree { width:220px; flex:none; overflow:auto; padding:8px 6px; border-right:1px solid var(--divider-color);
              background:color-mix(in srgb, var(--primary-text-color) 2%, transparent); }
    .pktn { display:flex; align-items:center; gap:6px; width:100%; padding:5px 8px; border:0; border-radius:7px; background:none; cursor:pointer;
            color:var(--primary-text-color); font:inherit; font-size:14px; text-align:left; }
    .pktn.on { color:var(--primary-color); font-weight:500; background:color-mix(in srgb, var(--primary-color) 12%, transparent); }
    .pkch { width:14px; flex:none; color:var(--secondary-text-color); }
    .pkch ha-icon { --mdc-icon-size:14px; }
    .pkfi { --mdc-icon-size:18px; color:#d9a520; flex:none; }
    .pktn.on .pkfi { color:var(--primary-color); }
    .pkn { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .pklist { flex:1; min-width:0; overflow:auto; }
    .pkth, .pkrow { display:grid; grid-template-columns:28px minmax(0, 1fr) 150px 120px; gap:8px; align-items:center; padding:7px 14px; }
    .pkth { position:sticky; top:0; z-index:1; font-size:12px; font-weight:500; text-transform:uppercase; letter-spacing:.4px;
            color:var(--secondary-text-color); background:var(--card-background-color, #fff); border-bottom:1px solid var(--divider-color); }
    .pkrow { font-size:14px; }
    .pkrow.sel { background:color-mix(in srgb, var(--primary-color) 8%, transparent); }
    .pkrow.prot { color:var(--secondary-text-color); opacity:.7; }
    .pkcb { width:18px; height:18px; padding:0; border-radius:4px; border:2px solid var(--secondary-text-color); background:none; cursor:pointer;
            display:grid; place-items:center; }
    .pkcb.on { background:var(--primary-color); border-color:var(--primary-color); color:#fff; }
    .pkcb ha-icon { --mdc-icon-size:14px; }
    .pkcb[disabled] { opacity:.35; cursor:default; }
    .pkname { display:flex; align-items:center; gap:8px; min-width:0; border:0; padding:0; background:none; font:inherit; color:inherit; text-align:left; }
    button.pkname { cursor:pointer; }
    .pkname ha-icon { --mdc-icon-size:20px; color:#e8b23a; flex:none; }
    .pkrow.prot .pkname ha-icon { color:var(--secondary-text-color); }
    .pkname .pill { white-space:nowrap; }
    .pkprot { font-size:12px; color:var(--secondary-text-color); }
    .pkd { color:var(--secondary-text-color); font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .pkempty { padding:24px 14px; color:var(--secondary-text-color); font-size:14px; }
    .pkerr { margin:8px 16px 0; }
    .pkft { display:flex; align-items:center; gap:10px; padding:12px 16px; border-top:1px solid var(--divider-color); }
    .pkchips { flex:1; min-width:0; display:flex; flex-wrap:wrap; gap:6px; }
    .pkchip { display:inline-flex; align-items:center; gap:6px; padding:5px 10px; border:0; border-radius:16px; cursor:pointer; font:inherit; font-size:13px;
              color:var(--primary-color); background:color-mix(in srgb, var(--primary-color) 12%, transparent); }
    .pkchip ha-icon { --mdc-icon-size:16px; }
    .pkx { width:30px; height:30px; flex:none; display:grid; place-items:center; padding:0; border:0; border-radius:50%; background:none;
           cursor:pointer; color:var(--secondary-text-color); margin-left:4px; }
    .pkx ha-icon { --mdc-icon-size:18px; }
    @media (max-width: 600px) {
      .pkdlg { width:calc(100vw - 16px); max-height:calc(100vh - 16px); }
      .pktree, .pksrch, .pkmod { display:none; }
      .pkbar { flex-wrap:wrap; }
      .pkname { flex-wrap:wrap; row-gap:2px; }
      .pkname .pill { flex-basis:auto; margin-left:28px; }
      .pkhere { order:5; flex-basis:100%; }
      .pkth, .pkrow { grid-template-columns:28px minmax(0, 1fr) auto; padding:9px 12px; }
      .pkft { flex-wrap:wrap; }
      .pkchips { flex-basis:100%; }
    }`;
