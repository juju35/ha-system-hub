/*
 * System Hub sidebar panel (administrators): the System tab, one tab per module turned on, and Settings.
 *
 * Tabs under the toolbar, as in Smart Comfort: text, the active one underlined, Settings last; the tab is in the
 * address (/system-hub/<tab>). The panel draws its own content from the system_hub/state WebSocket command, read
 * again every 10 seconds while it is shown and after each action; its buttons call the integration's own actions.
 * Settings turns modules on or off and orders the tabs (system_hub/update_settings).
 *
 * Every string comes from the integration's translations (loaded with hass.loadBackendTranslation): the panel's
 * own under selector.panel, the buttons from the entity and action names, the modules from the config flow.
 *
 * https://github.com/juju35/ha-system-hub
 */
var SYSTEM_HUB_PANEL_VERSION = '0.1.0';
var SH_DOMAIN = 'system_hub';
var SH_REFRESH_MS = 10000;
var SH_MODULE_ICONS = {
  system: 'mdi:chip',
  containers: 'mdi:docker',
  watchdog: 'mdi:shield-search',
  marketplace: 'mdi:storefront-outline',
  batteries: 'mdi:battery-heart-variant',
  git_sync: 'mdi:source-branch-sync',
  settings: 'mdi:cog-outline',
};
var SH_MODULE_NAMES = {
  containers: 'Containers',
  watchdog: 'Watchdog',
  marketplace: 'Marketplace',
  batteries: 'Batteries',
  git_sync: 'Git Sync',
};

function shEsc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function shNum(value) {
  var n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

// Tone of a percentage: good below 70, warn below 90, bad above
function shTone(pct, warn = 70, bad = 90) {
  if (pct === null || pct === undefined) return '';
  return pct >= bad ? 'bad' : pct >= warn ? 'warn' : 'good';
}

// Sizes in base 1024 (KiB, MiB, GiB), 2/1/0 decimals, as the other ha-* cards
function shBytes(bytes) {
  var n = shNum(bytes);
  if (n === null) return '—';
  var units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  var i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  var digits = i === 0 ? 0 : n < 10 ? 2 : n < 100 ? 1 : 0;
  return `${n.toFixed(digits)} ${units[i]}`;
}

// A small line of the last values (0-100 scale), behind a gauge: SVG, no library
function shSpark(values) {
  var points = (values || []).filter((v) => v !== null && v !== undefined);
  if (points.length < 2) return '';
  var w = 100;
  var step = w / (points.length - 1);
  var d = points.map((v, i) => `${(i * step).toFixed(1)},${(30 - (Math.min(Math.max(v, 0), 100) * 30) / 100).toFixed(1)}`);
  return `<svg class="spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><polyline points="${d.join(' ')}"/></svg>`;
}

// Status letter and colour of a file in the diff viewer, as in an editor's source control view.
var SH_DIFF_STATUS = {
  added: { letter: 'A', key: 'diff_added', color: 'var(--sh-ok)' },
  modified: { letter: 'M', key: 'diff_modified', color: 'var(--sh-warn)' },
  deleted: { letter: 'D', key: 'diff_deleted', color: 'var(--sh-alert)' },
  renamed: { letter: 'R', key: 'diff_renamed', color: 'var(--sh-info)' },
  copied: { letter: 'C', key: 'diff_added', color: 'var(--sh-info)' },
  mode: { letter: 'T', key: 'diff_mode', color: 'var(--sh-off)' },
};

// "config/packages/lights.yaml" → ["lights.yaml", "config/packages"].
var shSplitPath = (path) => {
  const i = String(path || '').lastIndexOf('/');
  return i < 0 ? [path, ''] : [path.slice(i + 1), path.slice(0, i)];
};


// The diff viewer of Git Sync, as in an editor's source control view (from the Git Sync card)
class SystemHubDiffDialog extends HTMLElement {
  constructor() {
    super();
    this._open = false;
    this._loading = false;
    this._diff = null;
    this._error = null;
    this._selected = 0;
    this._onKey = (ev) => {
      if (!this._open) return;
      if (ev.key === 'Escape') {
        ev.preventDefault();
        this.close();
      } else if ((ev.key === 'ArrowDown' || ev.key === 'ArrowUp') && !(ev.target?.closest?.('.d-main'))) {
        const files = this._diff?.files || [];
        if (!files.length) return;
        ev.preventDefault();
        this._select((this._selected + (ev.key === 'ArrowDown' ? 1 : files.length - 1)) % files.length);
      }
    };
  }

  // Opens the viewer for a card: `request` fetches the diff, `onCommit` (optional) adds a Commit & push button.
  async open({ t, locale, branch, commitLabel, request, onCommit }) {
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    this._tr = t;
    this._commitLabel = commitLabel;
    this._locale = locale;
    this._branch = branch;
    this._onCommit = onCommit;
    this._open = true;
    this._loading = true;
    this._diff = null;
    this._error = null;
    this._selected = 0;
    this._restore = document.activeElement;
    document.addEventListener?.('keydown', this._onKey);
    this._render();
    try {
      this._diff = await request();
    } catch (err) {
      this._error = err?.message || String(err);
    } finally {
      this._loading = false;
      if (this._open) {
        this._render();
        this.shadowRoot.querySelector('.d-main')?.focus?.({ preventScroll: true });
      }
    }
  }

  close() {
    if (!this._open) return;
    this._open = false;
    document.removeEventListener?.('keydown', this._onKey);
    this._render();
    this._restore?.focus?.({ preventScroll: true });
  }

  _t(key, vars) {
    return this._tr(key, vars);
  }

  _select(index) {
    this._selected = index;
    this._render();
    this.shadowRoot.querySelector('.d-main')?.scrollTo?.(0, 0);
    this.shadowRoot.querySelector(`.d-file[data-i="${index}"]`)?.focus?.({ preventScroll: true });
  }

  _fmt(n) {
    try {
      return Number(n).toLocaleString(this._locale);
    } catch (_err) {
      return String(n);
    }
  }

  _fileItem(file, index) {
    const st = SH_DIFF_STATUS[file.status] || SH_DIFF_STATUS.modified;
    const [name, dir] = shSplitPath(file.path);
    const label = this._t(st.key);
    return `<button class="d-file${index === this._selected ? ' selected' : ''}" data-i="${index}" role="option" aria-selected="${index === this._selected}"
        title="${shEsc(file.path)}">
      <span class="d-st" style="--c:${st.color}" title="${shEsc(label)}" aria-label="${shEsc(label)}">${st.letter}</span>
      <span class="d-name"><span class="d-base">${shEsc(name)}</span>${dir ? `<span class="d-dir">${shEsc(dir)}</span>` : ''}</span>
      <span class="d-counts">${file.additions ? `<span class="d-add">+${this._fmt(file.additions)}</span>` : ''}${
        file.deletions ? `<span class="d-del">−${this._fmt(file.deletions)}</span>` : ''
      }</span>
    </button>`;
  }

  _hunk(hunk) {
    const rows = hunk.lines
      .map((line) => {
        const cls = line.kind === 'add' ? 'add' : line.kind === 'del' ? 'del' : 'ctx';
        const sign = line.kind === 'add' ? '+' : line.kind === 'del' ? '−' : ' ';
        return `<tr class="${cls}"><td class="ln">${line.old ?? ''}</td><td class="ln">${line.new ?? ''}</td><td class="sg">${sign}</td><td class="tx">${shEsc(line.text)}</td></tr>`;
      })
      .join('');
    return `<tr class="hunk"><td class="ln"></td><td class="ln"></td><td class="sg"></td><td class="tx">${shEsc(hunk.header)}</td></tr>${rows}`;
  }

  _fileView(file) {
    const st = SH_DIFF_STATUS[file.status] || SH_DIFF_STATUS.modified;
    const rename = file.old_path ? `<span class="d-old">${shEsc(file.old_path)}</span><ha-icon icon="mdi:arrow-right"></ha-icon>` : '';
    let body;
    if (file.binary) body = `<div class="d-note"><ha-icon icon="mdi:file-outline"></ha-icon>${shEsc(this._t('diff_binary'))}</div>`;
    else if (!file.hunks.length) body = `<div class="d-note">${shEsc(this._t(st.key))}</div>`;
    else {
      body = `<table class="d-table" aria-label="${shEsc(file.path)}"><tbody>${file.hunks.map((h) => this._hunk(h)).join('')}</tbody></table>`;
      if (file.truncated) body += `<div class="d-note">${shEsc(this._t('diff_truncated', { n: this._fmt(file.truncated) }))}</div>`;
    }
    return `<div class="d-head">
        <span class="d-st big" style="--c:${st.color}" title="${shEsc(this._t(st.key))}">${st.letter}</span>
        <span class="d-path">${rename}<span>${shEsc(file.path)}</span></span>
        <span class="d-counts">${file.additions ? `<span class="d-add">+${this._fmt(file.additions)}</span>` : ''}${
          file.deletions ? `<span class="d-del">−${this._fmt(file.deletions)}</span>` : ''
        }</span>
      </div>${body}`;
  }

  _render() {
    if (!this.shadowRoot) return;
    if (!this._open) {
      this.shadowRoot.innerHTML = '';
      return;
    }
    const diff = this._diff;
    const files = diff?.files || [];
    const selected = files[this._selected];
    let main;
    let summary = '';
    if (this._loading) main = `<div class="d-note d-center"><ha-icon class="spin" icon="mdi:loading"></ha-icon>${shEsc(this._t('diff_loading'))}</div>`;
    else if (this._error) main = `<div class="d-note d-center d-error">${shEsc(this._t('failed', { error: this._error }))}</div>`;
    else if (!files.length) main = `<div class="d-note d-center">${shEsc(this._t('diff_empty'))}</div>`;
    else {
      main = this._fileView(selected);
      summary = `${shEsc(this._t(files.length + (diff.more_files || 0) === 1 ? 'diff_files_one' : 'diff_files_many', { n: this._fmt(files.length + (diff.more_files || 0)) }))} · <span class="d-add">+${this._fmt(diff.additions)}</span> <span class="d-del">−${this._fmt(diff.deletions)}</span>`;
    }
    const list = files.length
      ? `<div class="d-list" role="listbox" aria-label="${shEsc(this._t('changed'))}">${files.map((f, i) => this._fileItem(f, i)).join('')}${
          diff.more_files ? `<div class="d-more">${shEsc(this._t('diff_more_files', { n: this._fmt(diff.more_files) }))}</div>` : ''
        }</div>`
      : '';
    const commit = this._onCommit && files.length
      ? `<button class="d-btn primary" id="commit"><ha-icon icon="mdi:source-commit-end"></ha-icon>${shEsc(this._commitLabel)}</button>`
      : '';
    this.shadowRoot.innerHTML = `<style>${this._css()}</style>
      <div class="d-backdrop"></div>
      <div class="d-dialog" role="dialog" aria-modal="true" aria-label="${shEsc(this._t('diff_title', { branch: this._branch || 'HEAD' }))}">
        <div class="d-top">
          <div class="badge"><ha-icon icon="mdi:file-compare"></ha-icon></div>
          <div class="d-titles">
            <div class="d-title">${shEsc(this._t('diff_title', { branch: this._branch || 'HEAD' }))}</div>
            <div class="d-sub">${summary}</div>
          </div>
          <button class="d-x" id="close" title="${shEsc(this._t('diff_close'))}" aria-label="${shEsc(this._t('diff_close'))}"><ha-icon icon="mdi:close"></ha-icon></button>
        </div>
        <div class="d-body${files.length ? '' : ' alone'}">
          ${list}
          <div class="d-main" tabindex="0">${main}</div>
        </div>
        <div class="d-foot">
          <button class="d-btn" id="close2"><ha-icon icon="mdi:close"></ha-icon>${shEsc(this._t('diff_close'))}</button>
          ${commit}
        </div>
      </div>`;
    this._bind();
  }

  _bind() {
    const root = this.shadowRoot;
    const on = (sel, fn) => root.querySelector(sel)?.addEventListener('click', fn);
    on('.d-backdrop', () => this.close());
    on('#close', () => this.close());
    on('#close2', () => this.close());
    on('#commit', () => {
      const cb = this._onCommit;
      this.close();
      cb?.();
    });
    root.querySelector('.d-list')?.addEventListener('click', (ev) => {
      const item = ev.target?.closest?.('.d-file');
      if (item) this._select(Number(item.dataset.i));
    });
  }

  _css() {
    return `
      :host { --sh-ok: var(--success-color, #43a047); --sh-warn: var(--warning-color, #ffa600);
              --sh-info: var(--info-color, #039be5); --sh-alert: var(--error-color, #db4437);
              --sh-off: var(--disabled-text-color, #9e9e9e); --sh-accent: var(--primary-color, #03a9f4);
              --sh-mono: var(--code-font-family, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
              --sh-bg: var(--card-background-color, var(--ha-card-background, #fff));
              --sh-line: var(--divider-color, rgba(127,127,127,.2)); }
      .d-backdrop { position: fixed; inset: 0; z-index: 1000; background: rgba(0,0,0,.45); backdrop-filter: blur(2px); }
      /* Full screen on a phone; a large centred window elsewhere. */
      .d-dialog { position: fixed; inset: 0; z-index: 1001; display: flex; flex-direction: column; min-height: 0;
                  background: var(--sh-bg); color: var(--primary-text-color); font-family: var(--paper-font-body1_-_font-family, inherit); }
      @media (min-width: 900px) and (min-height: 600px) {
        .d-dialog { inset: 24px; max-width: 1280px; margin: 0 auto; border-radius: 16px;
                    box-shadow: 0 12px 40px rgba(0,0,0,.35); border: 1px solid var(--sh-line); }
      }
      .d-top { flex: none; display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--sh-line); }
      .badge { flex: none; width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center;
               color: var(--sh-accent); background: color-mix(in srgb, var(--sh-accent) 18%, transparent); }
      .badge ha-icon { --mdc-icon-size: 24px; }
      .d-titles { flex: 1 1 auto; min-width: 0; }
      .d-title { font-size: 16px; font-weight: 500; line-height: 22px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .d-sub { font-size: 12px; line-height: 16px; color: var(--secondary-text-color); }
      .d-x { flex: none; width: 36px; height: 36px; border: none; border-radius: 50%; padding: 0; display: grid; place-items: center;
             cursor: pointer; background: transparent; color: var(--secondary-text-color); }
      .d-x:hover { background: color-mix(in srgb, var(--secondary-text-color) 16%, transparent); color: var(--primary-text-color); }
      .d-x:focus-visible, .d-btn:focus-visible, .d-file:focus-visible { outline: 2px solid var(--sh-accent); outline-offset: 1px; }

      .d-body { flex: 1 1 auto; min-height: 0; display: flex; }
      .d-body.alone .d-main { width: 100%; }
      /* Files: a column on the left; on a narrow screen, a row of chips above the diff. */
      .d-list { flex: none; width: 280px; overflow-y: auto; border-right: 1px solid var(--sh-line); padding: 6px; display: flex; flex-direction: column; gap: 2px;
                background: var(--secondary-background-color, color-mix(in srgb, var(--primary-text-color) 4%, transparent)); }
      .d-file { display: flex; align-items: center; gap: 8px; width: 100%; min-width: 0; padding: 6px 8px; border: none; border-radius: 8px;
                cursor: pointer; text-align: left; font: inherit; font-size: 13px; color: var(--primary-text-color); background: transparent; }
      .d-file:hover { background: color-mix(in srgb, var(--sh-accent) 8%, transparent); }
      .d-file.selected { background: color-mix(in srgb, var(--sh-accent) 16%, transparent); }
      .d-st { flex: none; width: 20px; height: 20px; border-radius: 5px; display: grid; place-items: center; font-family: var(--sh-mono);
              font-size: 11px; font-weight: 700; color: var(--c); background: color-mix(in srgb, var(--c) 18%, transparent); }
      .d-st.big { width: 24px; height: 24px; font-size: 12px; }
      .d-name { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; line-height: 16px; }
      .d-base { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .d-dir { font-size: 11px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; direction: rtl; text-align: left; }
      .d-counts { flex: none; display: inline-flex; gap: 6px; font-family: var(--sh-mono); font-size: 11px; }
      .d-add { color: var(--sh-ok); }
      .d-del { color: var(--sh-alert); }
      .d-more { padding: 8px; font-size: 12px; color: var(--secondary-text-color); }
      @media (max-width: 719px) {
        .d-body { flex-direction: column; }
        .d-list { width: auto; max-height: 34%; flex-direction: row; flex-wrap: nowrap; overflow-x: auto; overflow-y: hidden;
                  border-right: none; border-bottom: 1px solid var(--sh-line); }
        .d-file { width: auto; flex: none; max-width: 220px; }
        .d-dir { display: none; }
        .d-more { white-space: nowrap; align-self: center; }
      }

      .d-main { flex: 1 1 auto; min-width: 0; overflow: auto; outline: none; }
      .d-head { position: sticky; top: 0; z-index: 1; display: flex; align-items: center; gap: 10px; padding: 8px 12px; font-size: 13px;
                background: var(--sh-bg); border-bottom: 1px solid var(--sh-line); }
      .d-path { flex: 1 1 auto; min-width: 0; display: flex; align-items: center; gap: 6px; font-family: var(--sh-mono); font-size: 12px;
                white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .d-path ha-icon { --mdc-icon-size: 14px; color: var(--secondary-text-color); }
      .d-old { color: var(--secondary-text-color); }
      .d-note { display: flex; align-items: center; gap: 8px; padding: 16px; font-size: 13px; color: var(--secondary-text-color); }
      .d-note.d-center { justify-content: center; padding: 48px 16px; }
      .d-note.d-error { color: var(--sh-alert); }
      .d-note ha-icon { --mdc-icon-size: 20px; }
      .spin { animation: sh-spin 1s linear infinite; }

      /* The diff itself: old and new line numbers, sign, text; additions tinted green, deletions red. */
      .d-table { width: 100%; border-collapse: collapse; font-family: var(--sh-mono); font-size: 12px; line-height: 20px; tab-size: 4; }
      .d-table td { padding: 0 6px; vertical-align: top; white-space: pre; }
      .d-table .ln { width: 1%; min-width: 3.5ch; text-align: right; color: var(--secondary-text-color); opacity: .7; user-select: none;
                     background: color-mix(in srgb, var(--primary-text-color) 3%, transparent); }
      .d-table .sg { width: 1%; padding: 0 4px; user-select: none; }
      .d-table .tx { white-space: pre-wrap; word-break: break-all; }
      .d-table tr.add td { background: color-mix(in srgb, var(--sh-ok) 14%, transparent); }
      .d-table tr.add .ln, .d-table tr.add .sg { color: var(--sh-ok); opacity: 1; }
      .d-table tr.del td { background: color-mix(in srgb, var(--sh-alert) 14%, transparent); }
      .d-table tr.del .ln, .d-table tr.del .sg { color: var(--sh-alert); opacity: 1; }
      .d-table tr.hunk td { color: var(--sh-info); background: color-mix(in srgb, var(--sh-info) 8%, transparent); }

      .d-foot { flex: none; display: flex; justify-content: flex-end; gap: 8px; padding: 10px 16px; border-top: 1px solid var(--sh-line); }
      .d-btn { display: inline-flex; align-items: center; gap: 6px; min-height: 38px; padding: 4px 14px; border-radius: 10px; cursor: pointer;
               font: inherit; font-size: 14px; font-weight: 500; color: var(--secondary-text-color); background: transparent;
               border: 1px solid color-mix(in srgb, var(--secondary-text-color) 35%, transparent); }
      .d-btn.primary { color: var(--sh-accent); border-color: color-mix(in srgb, var(--sh-accent) 45%, transparent); }
      .d-btn:hover { background: color-mix(in srgb, var(--sh-accent) 10%, transparent); }
      .d-btn ha-icon { --mdc-icon-size: 18px; }
      @keyframes sh-spin { to { transform: rotate(360deg); } }
      @media (prefers-reduced-motion: reduce) { .spin { animation: none; } }
    `;
  }
}

class SystemHubPanel extends HTMLElement {
  static VERSION = SYSTEM_HUB_PANEL_VERSION;

  static STYLE = `
    :host { display:block; min-height:100%; background:var(--primary-background-color); color:var(--primary-text-color);
            --tone-good: var(--success-color, #43a047); --tone-warn: var(--warning-color, #ffa600); --tone-bad: var(--error-color, #db4437); }
    .toolbar { height:var(--header-height, 56px); display:flex; align-items:center; gap:8px; padding:0 12px; box-sizing:border-box;
               background:var(--app-header-background-color, var(--primary-color)); color:var(--app-header-text-color, #fff);
               font-size:20px; position:sticky; top:0; z-index:2; }
    .toolbar .grow { flex:1; }
    .tabs { display:flex; gap:4px; padding:0 12px; overflow-x:auto; background:var(--app-header-background-color, var(--primary-color));
            position:sticky; top:var(--header-height, 56px); z-index:2; }
    .tab { background:none; border:none; border-bottom:2px solid transparent; color:var(--app-header-text-color, #fff); opacity:.75;
           padding:12px 14px; font:inherit; font-size:14px; cursor:pointer; white-space:nowrap; }
    .tab:hover, .tab:focus-visible { opacity:1; outline:none; }
    .tab.active { opacity:1; border-bottom-color:var(--app-header-text-color, #fff); }
    main { max-width:1040px; margin:0 auto; padding:16px; box-sizing:border-box; display:flex; flex-direction:column; gap:12px; }
    .note { padding:16px; color:var(--secondary-text-color); display:flex; flex-direction:column; gap:10px; align-items:flex-start; }
    .note.error { color:var(--primary-text-color); border-left:3px solid var(--tone-bad); }
    .tiles { display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:10px; }
    .tile { position:relative; overflow:hidden; padding:12px 14px; display:flex; align-items:center; gap:12px; min-width:0; }
    .tile.link { cursor:pointer; }
    .tile .spark { position:absolute; inset:auto 0 0 0; width:100%; height:45%; opacity:.5; pointer-events:none; }
    .spark polyline { fill:none; stroke:var(--tone, var(--primary-color)); stroke-width:1.5; vector-effect:non-scaling-stroke; }
    .avatar { position:relative; width:40px; height:40px; flex:none; border-radius:50%; display:grid; place-items:center; --mdc-icon-size:22px;
              color:var(--tone-text, var(--primary-color)); background:color-mix(in srgb, var(--tone, var(--primary-color)) 15%, transparent); }
    .who { position:relative; flex:1; min-width:0; }
    .who .n { font-size:15px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .who .n b { font-size:20px; font-weight:500; margin-right:4px; font-variant-numeric:tabular-nums; }
    .who .s { font-size:12px; color:var(--secondary-text-color); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .good { --tone:var(--tone-good); } .warn { --tone:var(--tone-warn); } .bad { --tone:var(--tone-bad); }
    .good, .warn, .bad { --tone-text: color-mix(in srgb, var(--tone) 50%, var(--primary-text-color)); }
    .pill { flex:none; font-size:11px; font-weight:500; padding:2px 10px; border-radius:12px; color:var(--tone-text, var(--primary-text-color));
            background:color-mix(in srgb, var(--tone, var(--secondary-text-color)) 15%, transparent); white-space:nowrap; }
    .list { padding:6px 0; overflow:hidden; }
    .lhead { display:flex; align-items:center; gap:10px; padding:8px 14px 6px; --mdc-icon-size:18px; color:var(--secondary-text-color); }
    .lhead .lname { flex:1; font-size:14px; font-weight:500; color:var(--primary-text-color); }
    .item { display:flex; align-items:center; gap:12px; padding:8px 14px; min-width:0; }
    .item.link { cursor:pointer; }
    .item.link:hover { background:var(--secondary-background-color, rgba(127,127,127,.08)); }
    .item > ha-icon { flex:none; --mdc-icon-size:22px; color:var(--tone-text, var(--secondary-text-color)); }
    .side { flex:none; display:flex; flex-direction:column; align-items:flex-end; gap:4px; font-size:12px; text-align:right; min-width:90px; }
    .side.fixed { width:150px; min-width:0; }
    .trend { flex:none; width:90px; height:22px; }
    .trend .spark { width:100%; height:100%; display:block; }
    .meter { width:90px; height:6px; border-radius:3px; background:var(--divider-color, rgba(127,127,127,.25)); overflow:hidden; }
    .meter > span { display:block; height:100%; background:var(--tone, var(--primary-color)); }
    .muted { color:var(--secondary-text-color); }
    .empty { padding:18px 14px; color:var(--secondary-text-color); display:flex; align-items:center; gap:10px; --mdc-icon-size:20px; }
    .empty.good ha-icon { color:var(--tone-text); }
    .actions { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
    .act { display:inline-flex; align-items:center; gap:6px; border:0; cursor:pointer; font:inherit; font-size:13px; font-weight:500;
           padding:7px 12px; border-radius:8px; --mdc-icon-size:16px; color:var(--primary-color); text-decoration:none;
           background:color-mix(in srgb, var(--primary-color) 14%, transparent); }
    .act:hover:not([disabled]) { background:color-mix(in srgb, var(--primary-color) 22%, transparent); }
    .act.quiet { color:var(--primary-text-color); background:var(--secondary-background-color, rgba(127,127,127,.12)); }
    .act[disabled] { opacity:.5; cursor:default; }
    .msg { font-size:12px; color:var(--secondary-text-color); overflow-wrap:anywhere; }
    .msg.bad, .msg.good { color:var(--tone-text); }
    .box { display:flex; align-items:center; flex:1; min-width:200px; border-radius:8px; border:1px solid var(--divider-color, rgba(127,127,127,.3));
           background:var(--secondary-background-color, rgba(127,127,127,.08)); }
    .box:focus-within { border-color:var(--primary-color); }
    .box input { flex:1; min-width:0; border:0; outline:0; background:none; color:inherit; font:inherit; font-size:14px; padding:8px 10px; }
    .block { padding:14px 16px; display:flex; flex-direction:column; gap:12px; }
    .block h2 { margin:0; font-size:16px; font-weight:500; }
    .row { display:flex; align-items:center; gap:12px; min-height:40px; }
    .row .who .n { font-size:14px; }
    .row .who .s { white-space:normal; }
    .icon-btn { border:0; background:none; cursor:pointer; color:var(--secondary-text-color); padding:8px; border-radius:50%; display:flex; --mdc-icon-size:20px; }
    .icon-btn:hover:not([disabled]) { background:var(--secondary-background-color); color:var(--primary-color); }
    .icon-btn[disabled] { opacity:.3; cursor:default; }
    .grow { flex:1; }
    .segs { display:inline-flex; border-radius:8px; overflow:hidden; background:var(--secondary-background-color, rgba(127,127,127,.12)); }
    .seg { display:inline-flex; align-items:center; gap:6px; border:0; background:none; cursor:pointer; font:inherit; font-size:13px;
           padding:7px 12px; color:var(--secondary-text-color); --mdc-icon-size:16px; }
    .seg.active { color:var(--primary-color); background:color-mix(in srgb, var(--primary-color) 14%, transparent); font-weight:500; }
    .lhead .muted { font-size:12px; }
    .confirm { display:flex; flex-wrap:wrap; align-items:center; gap:8px; padding:10px 14px; border-radius:8px;
               background:color-mix(in srgb, var(--tone-warn) 12%, transparent); }
    code { font-family:var(--code-font-family, monospace); font-size:12px; }
    @media (max-width: 600px) {
      main { padding:12px 8px; }
      .tiles { grid-template-columns:repeat(2, minmax(0, 1fr)); gap:8px; }
      .tile { padding:10px 12px; gap:10px; }
      .avatar { width:32px; height:32px; --mdc-icon-size:18px; }
      .side { min-width:70px; }
      .meter { width:70px; }
      .side.fixed { width:auto; }
      .trend { display:none; }
      .tile .more { display:none; }
    }
  `;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._tab = 'system';
    this._state = null;
    this._error = null;
    this._busy = {};
    this._messages = {};
    this._draft = {};
    this._localize = null;
    try {
      this._battView = localStorage.getItem('system_hub_batteries_view') || 'level';
    } catch (_err) {
      this._battView = 'level';
    }
  }

  set hass(hass) {
    var first = !this._hass;
    var language = this._hass?.language;
    this._hass = hass;
    if (this._menu) this._menu.hass = hass;
    if (first) this._start();
    else if (hass.language !== language) this._loadStrings();
  }

  set narrow(narrow) {
    this._narrow = narrow;
    if (this._menu) this._menu.narrow = narrow;
  }

  set panel(panel) {
    this._panel = panel;
  }

  set route(route) {
    var path = (route?.path || '').split('/').filter(Boolean)[0];
    this._routeTab = path || 'system';
    if (this._state) this._selectTab(this._routeTab);
  }

  // Values set before the element was defined land as plain properties and hide the setters: passed through them
  _upgradeProperties() {
    ['panel', 'narrow', 'route', 'hass'].forEach((name) => {
      if (!Object.hasOwn(this, name)) return;
      var value = this[name];
      delete this[name];
      this[name] = value;
    });
  }

  connectedCallback() {
    this._upgradeProperties();
    this._timer ??= setInterval(() => {
      if (!document.hidden) this._load();
    }, SH_REFRESH_MS);
    if (this._hass && this._state) this._load();
  }

  disconnectedCallback() {
    clearInterval(this._timer);
    this._timer = null;
  }

  async _start() {
    this._renderShell();
    await this._loadStrings();
    await this._load();
  }

  async _loadStrings() {
    try {
      var categories = ['selector', 'entity', 'services', 'config'];
      var results = await Promise.all(categories.map((c) => this._hass.loadBackendTranslation?.(c, SH_DOMAIN)));
      this._localize = results.find(Boolean) || this._hass.localize;
    } catch (_err) {
      this._localize = this._hass.localize;
    }
    this._render();
  }

  // The panel's own strings (selector.panel), the names of the entities and actions, the module descriptions
  _t(key, vars) {
    return this._l(`component.${SH_DOMAIN}.selector.panel.options.${key}`, vars) || key;
  }

  _l(key, vars) {
    var localize = this._localize || this._hass?.localize;
    if (!localize) return '';
    try {
      return localize(key, vars || {}) || '';
    } catch (_err) {
      return '';
    }
  }

  _entityName(platform, key) {
    return this._l(`component.${SH_DOMAIN}.entity.${platform}.${key}.name`) || key;
  }

  _serviceName(service) {
    return this._l(`component.${SH_DOMAIN}.services.${service}.name`) || service;
  }

  async _load() {
    if (!this._hass) return;
    try {
      this._state = await this._hass.callWS({ type: 'system_hub/state' });
      this._error = null;
    } catch (err) {
      this._error = err?.message || String(err);
    }
    this._render();
  }

  _tabs() {
    if (!this._state?.loaded) return ['system', 'settings'];
    var modules = this._state.modules || [];
    return [...(this._state.tabs || []).filter((t) => t === 'system' || modules.includes(t)), 'settings'];
  }

  _tabName(tab) {
    if (tab === 'system' || tab === 'settings') return this._t(tab);
    return SH_MODULE_NAMES[tab] || tab;
  }

  _selectTab(tab, focus) {
    var tabs = this._tabs();
    var chosen = tabs.includes(tab) ? tab : tabs[0];
    if (chosen !== this._tab) {
      this._tab = chosen;
      this._render();
    }
    if (focus) this.shadowRoot.querySelector(`[data-tab="${chosen}"]`)?.focus({ preventScroll: true });
  }

  _goTab(tab, focus) {
    this._selectTab(tab, focus);
    var base = (this._panel?.url_path || 'system-hub').replace(/^\//, '');
    try {
      history.replaceState(history.state, '', `/${base}${this._tab === 'system' ? '' : `/${this._tab}`}`);
    } catch (_err) {
      // no history (a test): the tab still shows
    }
  }

  _renderShell() {
    var root = this.shadowRoot;
    if (root.querySelector('.toolbar')) return;
    root.innerHTML = `<style>${SystemHubPanel.STYLE}</style>
      <div class="toolbar"><ha-menu-button></ha-menu-button><span class="grow">System Hub</span></div>
      <nav class="tabs" role="tablist"></nav>
      <main></main>`;
    this._menu = root.querySelector('ha-menu-button');
    if (this._menu) {
      this._menu.hass = this._hass;
      this._menu.narrow = this._narrow;
    }
    root.querySelector('.tabs').addEventListener('click', (ev) => {
      var tab = ev.target.closest?.('[data-tab]')?.dataset.tab;
      if (tab) this._goTab(tab);
    });
    root.querySelector('.tabs').addEventListener('keydown', (ev) => {
      if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') return;
      var tabs = this._tabs();
      var i = tabs.indexOf(this._tab) + (ev.key === 'ArrowRight' ? 1 : -1);
      this._goTab(tabs[(i + tabs.length) % tabs.length], true);
      ev.preventDefault();
    });
    root.querySelector('main').addEventListener('click', (ev) => this._onClick(ev));
    root.querySelector('main').addEventListener('input', (ev) => {
      if (ev.target.dataset?.draft) this._draft[ev.target.dataset.draft] = ev.target.value;
    });
  }

  _render() {
    this._renderShell();
    var root = this.shadowRoot;
    if (this._routeTab && this._state) {
      var wanted = this._routeTab;
      this._routeTab = null;
      if (this._tabs().includes(wanted)) this._tab = wanted;
    }
    if (!this._tabs().includes(this._tab)) this._tab = this._tabs()[0];
    root.querySelector('.tabs').innerHTML = this._tabs()
      .map((tab) => {
        var selected = tab === this._tab;
        return `<button class="tab${selected ? ' active' : ''}" role="tab" data-tab="${tab}" aria-selected="${selected}" tabindex="${selected ? 0 : -1}">${shEsc(this._tabName(tab))}</button>`;
      })
      .join('');
    var main = root.querySelector('main');
    var active = root.activeElement;
    var focusKey = active?.dataset?.draft;
    main.innerHTML = this._content();
    if (focusKey) {
      var field = main.querySelector(`[data-draft="${focusKey}"]`);
      field?.focus();
      field?.setSelectionRange?.(field.value.length, field.value.length);
    }
  }

  _content() {
    if (this._state === null && this._error) {
      return `<ha-card class="note error" role="alert">${shEsc(this._t('load_failed', { error: this._error }))}
        <button class="act" data-action="reload"><ha-icon icon="mdi:refresh"></ha-icon>${shEsc(this._t('refresh'))}</button></ha-card>`;
    }
    if (this._state === null) return `<ha-card class="note" aria-busy="true">${shEsc(this._t('loading'))}</ha-card>`;
    if (!this._state.loaded) return `<ha-card class="note">${shEsc(this._t('not_loaded'))}</ha-card>`;
    var html = {
      system: () => this._system(),
      containers: () => this._containers(),
      watchdog: () => this._watchdog(),
      marketplace: () => this._marketplace(),
      batteries: () => this._batteries(),
      git_sync: () => this._gitSync(),
      settings: () => this._settings(),
    }[this._tab];
    return html ? html() : '';
  }

  _message(key) {
    var m = this._messages[key];
    return m ? `<span class="msg ${m.tone || ''}" role="status">${shEsc(m.text)}</span>` : '';
  }

  _button(action, icon, label, opts = {}) {
    var busy = this._busy[action];
    var attrs = Object.entries(opts.data || {})
      .map(([k, v]) => ` data-${k}="${shEsc(v)}"`)
      .join('');
    return `<button class="act${opts.quiet ? ' quiet' : ''}" data-action="${action}"${attrs}${busy || opts.disabled ? ' disabled' : ''}>
      <ha-icon icon="${busy ? 'mdi:loading' : icon}"></ha-icon>${shEsc(label)}</button>`;
  }

  _tile(icon, value, label, tone, opts = {}) {
    return `<ha-card class="tile ${tone || ''}${opts.entity ? ' link' : ''}"${opts.entity ? ` data-more="${shEsc(opts.entity)}"` : ''}>
      ${opts.spark || ''}<div class="avatar"><ha-icon icon="${icon}"></ha-icon></div>
      <div class="who"><div class="n">${value}</div><div class="s">${shEsc(label)}</div></div></ha-card>`;
  }

  _ago(iso) {
    if (!iso) return this._t('never');
    var date = new Date(iso);
    if (Number.isNaN(date.getTime())) return this._t('never');
    try {
      return date.toLocaleString(this._hass?.locale?.language || this._hass?.language || undefined, {
        dateStyle: 'short',
        timeStyle: 'short',
      });
    } catch (_err) {
      return date.toISOString();
    }
  }

  _day(iso) {
    var date = new Date(iso);
    if (!iso || Number.isNaN(date.getTime())) return '—';
    try {
      return date.toLocaleDateString(this._hass?.locale?.language || this._hass?.language || undefined, { dateStyle: 'medium' });
    } catch (_err) {
      return iso.slice(0, 10);
    }
  }

  // System: the System Monitor sensors
  _system() {
    var sensors = this._state.system || [];
    if (!sensors.length) {
      return `<ha-card class="note">${shEsc(this._t('no_system'))}
        <a class="act" href="/config/integrations/dashboard/add?domain=systemmonitor"><ha-icon icon="mdi:plus"></ha-icon>System Monitor</a></ha-card>`;
    }
    var one = (key) => sensors.find((s) => s.key === key);
    var tiles = [];
    var pct = (key, icon, label) => {
      var s = one(key);
      if (!s) return;
      var v = shNum(s.state);
      tiles.push(this._tile(icon, v === null ? '—' : `<b>${Math.round(v)}</b>%`, label, shTone(v), { entity: s.entity_id }));
    };
    pct('processor_use', 'mdi:cpu-64-bit', this._t('cpu'));
    pct('memory_use_percent', 'mdi:memory', this._t('ram'));
    pct('swap_use_percent', 'mdi:swap-horizontal', this._t('swap'));
    var temp = one('processor_temperature');
    if (temp) {
      var t = shNum(temp.state);
      tiles.push(
        this._tile('mdi:thermometer', t === null ? '—' : `<b>${Math.round(t)}</b>${shEsc(temp.unit || '°C')}`, this._t('temperature'), shTone(t, 70, 85), {
          entity: temp.entity_id,
        }),
      );
    }
    var loads = ['load_1m', 'load_5m', 'load_15m'].map(one).filter(Boolean);
    if (loads.length) {
      tiles.push(
        this._tile('mdi:speedometer', loads.map((s, i) => (i ? `<span class="more">${shEsc(shNum(s.state)?.toFixed(2) ?? '—')}</span>` : `<b>${shEsc(shNum(s.state)?.toFixed(2) ?? '—')}</b>`)).join(' '), this._t('load'), '', {
          entity: loads[0].entity_id,
        }),
      );
    }
    var boot = one('last_boot');
    if (boot) tiles.push(this._tile('mdi:clock-start', shEsc(this._day(boot.state)), this._t('uptime'), '', { entity: boot.entity_id }));
    var rates = ['throughput_network_in', 'throughput_network_out']
      .map((key) => sensors.filter((s) => s.key === key))
      .map((list) => list.reduce((sum, s) => sum + (shNum(s.state) || 0), 0));
    if (sensors.some((s) => s.key.startsWith('throughput'))) {
      var unit = sensors.find((s) => s.key.startsWith('throughput'))?.unit || 'MB/s';
      var rate = (v) => `<b>${v < 100 ? v.toFixed(1) : Math.round(v)}</b>${shEsc(unit)}`;
      tiles.push(this._tile('mdi:download', rate(rates[0]), this._t('download'), 'good'));
      tiles.push(this._tile('mdi:upload', rate(rates[1]), this._t('upload'), ''));
    }
    var disks = sensors.filter((s) => s.key === 'disk_use_percent');
    var diskList = disks.length
      ? `<ha-card class="list"><div class="lhead"><ha-icon icon="mdi:harddisk"></ha-icon><span class="lname">${shEsc(this._t('disks'))}</span></div>
        ${disks
          .map((s) => {
            var v = shNum(s.state);
            return `<div class="item link ${shTone(v, 80, 90)}" data-more="${shEsc(s.entity_id)}"><ha-icon icon="mdi:harddisk"></ha-icon>
              <div class="who"><div class="n">${shEsc(s.name)}</div></div>
              <div class="side"><span>${v === null ? '—' : `${Math.round(v)}%`}</span><div class="meter"><span style="width:${Math.min(v || 0, 100)}%"></span></div></div></div>`;
          })
          .join('')}</ha-card>`
      : '';
    return `<div class="tiles">${tiles.join('')}</div>${diskList}`;
  }

  // Containers: Core, the Supervisor and the add-ons (monitoring only)
  _containers() {
    var data = this._state.containers || {};
    var list = data.containers || [];
    var running = list.filter((c) => c.state === 'started' || c.state === 'startup').length;
    var down = list.filter((c) => c.down);
    var history = data.history || {};
    var tiles = [
      this._tile('mdi:docker', `<b>${running}</b>/ ${list.length}`, this._t('running'), down.length ? 'warn' : 'good'),
      this._tile('mdi:alert-circle-outline', `<b>${down.length}</b>`, this._t('down'), down.length ? 'bad' : 'good'),
      this._tile('mdi:clock-check-outline', shEsc(this._ago(data.last_update)), this._t('last_check'), data.error ? 'bad' : ''),
    ];
    var order = { core: 0, supervisor: 1, addon: 2 };
    var rows = [...list]
      .sort((a, b) => (b.down ? 1 : 0) - (a.down ? 1 : 0) || order[a.kind] - order[b.kind] || a.name.localeCompare(b.name))
      .map((c) => {
        var on = c.state === 'started' || c.state === 'startup';
        var tone = c.down ? 'bad' : on ? 'good' : '';
        var cpu = shNum(c.cpu_percent);
        var mem = shNum(c.memory_percent);
        var spark = shSpark((history[c.slug] || []).map((p) => p[1]));
        var kind = this._t(c.kind);
        var version = c.update_available ? this._t('update', { version: c.version_latest }) : c.version || '';
        return `<div class="item ${tone}"><ha-icon icon="${c.kind === 'addon' ? 'mdi:puzzle-outline' : c.kind === 'core' ? 'mdi:home-assistant' : 'mdi:shield-home-outline'}"></ha-icon>
          <div class="who"><div class="n">${shEsc(c.name)}</div><div class="s">${shEsc(kind)}${version ? ` · ${shEsc(version)}` : ''}</div></div>
          ${spark ? `<div class="trend ${tone}">${spark}</div>` : ''}
          <span class="pill ${tone}">${shEsc(c.down ? this._t('down') : on ? this._t('running') : this._t('stopped'))}</span>
          <div class="side fixed">${
            on
              ? `<span>CPU ${cpu === null ? '—' : `${Math.round(cpu)}%`} · RAM ${mem === null ? '—' : `${Math.round(mem)}%`}</span>
            <div class="meter ${shTone(mem)}"><span style="width:${Math.min(mem || 0, 100)}%"></span></div>
            <span class="muted">${shBytes(c.memory_usage)}</span>`
              : ''
          }</div></div>`;
      })
      .join('');
    return `<div class="tiles">${tiles.join('')}</div>
      <div class="actions">${this._button('containers_refresh', 'mdi:refresh', this._serviceName('containers_refresh'))}${this._message('containers_refresh')}
      ${data.error ? `<span class="msg bad">${shEsc(data.error)}</span>` : ''}</div>
      <ha-card class="list">${rows || `<div class="empty"><ha-icon icon="mdi:docker"></ha-icon>${shEsc(this._t('no_containers'))}</div>`}</ha-card>`;
  }

  // Watchdog: the unavailable integrations and the recent reloads
  _watchdog() {
    var data = this._state.watchdog || {};
    var unavailable = data.unavailable || [];
    var gaveUp = unavailable.filter((u) => u.gave_up);
    var tiles = [
      this._tile('mdi:puzzle-remove-outline', `<b>${unavailable.length}</b>`, this._entityName('sensor', 'watchdog_unavailable'), unavailable.length ? 'warn' : 'good'),
      this._tile('mdi:cancel', `<b>${gaveUp.length}</b>`, this._t('gave_up'), gaveUp.length ? 'bad' : 'good'),
      this._tile('mdi:restart', `<b>${data.reloads ?? 0}</b>`, this._l(`component.${SH_DOMAIN}.entity.sensor.watchdog_last_reload.state_attributes.reloads.name`) || 'Reloads', ''),
      this._tile('mdi:clock-check-outline', shEsc(data.running ? '…' : this._ago(data.last_check)), this._t('last_check'), data.paused ? 'warn' : ''),
    ];
    var rows = unavailable
      .map(
        (u) => `<div class="item ${u.gave_up ? 'bad' : 'warn'}"><ha-icon icon="mdi:puzzle-remove-outline"></ha-icon>
        <div class="who"><div class="n">${shEsc(u.title)}</div><div class="s">${shEsc(u.domain)} · ${shEsc(this._t('unavailable_since', { date: this._ago(u.since) }))}</div></div>
        ${u.gave_up ? `<span class="pill bad">${shEsc(this._t('gave_up'))}</span>` : `<span class="pill warn">${u.reloads ?? 0}/${data.max_reloads ?? ''}</span>`}
        ${this._button(`watchdog_reset:${u.entry_id}`, 'mdi:restart', this._t('try_again'), { quiet: true })}</div>`,
      )
      .join('');
    var history = (data.history || [])
      .slice(0, 50)
      .map((h) => {
        var bad = h.kind.endsWith('failed') || h.kind.endsWith('gave_up');
        var icon = h.kind.startsWith('power_cycle') ? 'mdi:power-plug-outline' : 'mdi:restart';
        return `<div class="item ${bad ? 'bad' : 'good'}"><ha-icon icon="${icon}"></ha-icon>
          <div class="who"><div class="n">${shEsc(h.title)}</div><div class="s">${shEsc(h.domain)} · ${shEsc(h.kind.replaceAll('_', ' '))}</div></div>
          <div class="side muted">${shEsc(this._ago(h.at))}</div></div>`;
      })
      .join('');
    return `<div class="tiles">${tiles.join('')}</div>
      <div class="actions">${this._button('watchdog_check', 'mdi:shield-search', this._entityName('button', 'watchdog_check'), { disabled: data.running })}
      ${data.paused ? `<span class="pill warn">${shEsc(this._t('paused'))}</span>` : ''}${this._message('watchdog_check')}${this._message('watchdog_reset')}</div>
      <ha-card class="list">${rows || `<div class="empty good"><ha-icon icon="mdi:check-circle-outline"></ha-icon>${shEsc(this._t('all_available'))}</div>`}</ha-card>
      <ha-card class="list"><div class="lhead"><ha-icon icon="mdi:history"></ha-icon><span class="lname">${shEsc(this._t('history'))}</span></div>
      ${history || `<div class="empty">${shEsc(this._t('no_history'))}</div>`}</ha-card>`;
  }

  // Marketplace: the server-side check and the updates found
  _marketplace() {
    var data = this._state.marketplace || {};
    var running = data.state === 'running';
    var pending = data.pending || [];
    var tiles = [
      this._tile('mdi:package-up', `<b>${data.updates ?? 0}</b>`, this._t('updates'), data.updates ? 'warn' : 'good'),
      this._tile(
        'mdi:archive-sync',
        running ? shEsc(this._t('progress', { done: data.done ?? 0, total: data.total ?? 0 })) : shEsc(this._ago(data.last_check)),
        this._t('last_check'),
        data.state === 'error' ? 'bad' : '',
      ),
      this._tile('mdi:calendar-clock', shEsc(data.scan_interval ? this._ago(data.next_due) : '—'), this._t('next_check'), ''),
    ];
    var confirm = this._confirm === 'install'
      ? `<div class="confirm" role="alertdialog">${shEsc(this._t('confirm_install'))}
          ${this._button('marketplace_install_updates', 'mdi:package-down', this._t('install_all'))}
          ${this._button('cancel', 'mdi:close', this._t('cancel'), { quiet: true })}</div>`
      : '';
    var rows = pending
      .map((name) => `<div class="item warn"><ha-icon icon="mdi:package-up"></ha-icon><div class="who"><div class="n">${shEsc(name)}</div></div></div>`)
      .join('');
    return `<div class="tiles">${tiles.join('')}</div>${confirm}
      <div class="actions">${this._button('marketplace_check_updates', 'mdi:archive-refresh', this._entityName('button', 'marketplace_check_updates'), {
        disabled: running || data.installing_updates,
      })}
      ${pending.length ? this._button('confirm_install', 'mdi:package-down', this._t('install_all'), { quiet: true, disabled: running || data.installing_updates }) : ''}
      ${this._message('marketplace_check_updates')}${this._message('marketplace_install_updates')}
      ${data.error ? `<span class="msg bad">${shEsc(data.error)}</span>` : ''}</div>
      <ha-card class="list">${rows || `<div class="empty good"><ha-icon icon="mdi:check-circle-outline"></ha-icon>${shEsc(this._t('no_updates'))}</div>`}</ha-card>`;
  }

  // Batteries: by level (the ones in error first), or in groups by room, by battery type or by replacement date (as the
  // Battery Monitor full screen view)
  _batteries() {
    var data = this._state.batteries || {};
    var view = this._battView || 'level';
    var tiles = [
      this._tile('mdi:battery-alert-variant-outline', `<b>${data.low ?? 0}</b>`, this._t('low'), data.low ? 'warn' : 'good'),
      this._tile('mdi:battery-unknown', `<b>${data.unavailable ?? 0}</b>`, this._t('unavailable'), data.unavailable ? 'bad' : 'good'),
      this._tile('mdi:bell-check-outline', shEsc(this._ago(data.last_notification)), this._entityName('sensor', 'batteries_last_notification'), ''),
    ];
    var views = [
      ['level', 'mdi:sort-ascending', 'by_level'],
      ['room', 'mdi:sofa-outline', 'by_room'],
      ['type', 'mdi:battery-outline', 'by_type'],
      ['forecast', 'mdi:calendar-clock', 'by_forecast'],
    ]
      .map(
        ([key, icon, label]) =>
          `<button class="seg${key === view ? ' active' : ''}" data-action="batt_view" data-view="${key}" aria-pressed="${key === view}"><ha-icon icon="${icon}"></ha-icon>${shEsc(this._t(label))}</button>`,
      )
      .join('');
    var list = data.batteries || [];
    var groups = list.length
      ? this._battGroups(list, view)
          .map(
            (g) => `<ha-card class="list">${g.name ? `<div class="lhead"><ha-icon icon="${g.icon}"></ha-icon><span class="lname">${shEsc(g.name)}</span><span class="muted">${g.items.length}</span></div>` : ''}
            ${g.items.map((x) => this._battRow(x.b, x.context)).join('')}</ha-card>`,
          )
          .join('')
      : `<ha-card class="list"><div class="empty good"><ha-icon icon="mdi:battery-check-outline"></ha-icon>${shEsc(this._t('all_good', { threshold: data.threshold ?? '' }))}</div></ha-card>`;
    return `<div class="tiles">${tiles.join('')}</div>
      <div class="actions">${this._button('batteries_notify', 'mdi:bell-ring-outline', this._entityName('button', 'batteries_notify_now'))}${this._message('batteries_notify')}
      <span class="grow"></span><div class="segs" role="group">${views}</div></div>
      ${groups}`;
  }

  _battRow(b, context) {
    var tone = b.unavailable ? 'bad' : b.low ? 'warn' : 'good';
    var level = shNum(b.level);
    return `<div class="item link ${tone}" data-more="${shEsc(b.entity_id)}"><ha-icon icon="${shEsc(b.icon || 'mdi:battery')}"></ha-icon>
      <div class="who"><div class="n">${shEsc(b.name)}</div>${context ? `<div class="s">${shEsc(context)}</div>` : ''}</div>
      <div class="side"><span>${b.unavailable ? shEsc(this._t('unavailable')) : level === null ? shEsc(this._t('low')) : `${Math.round(level)} %`}</span>
      ${level === null ? '' : `<div class="meter"><span style="width:${Math.min(level, 100)}%"></span></div>`}</div></div>`;
  }

  // "2× AA" → AA; a built-in rechargeable battery is its own type
  _battType(b) {
    var raw = (b.battery_type || '').trim();
    if (!raw) return '';
    return raw.replace(/^\d+\s*[×x]\s*/i, '');
  }

  _battTypeName(type) {
    return type === 'rechargeable' ? this._t('rechargeable') : type;
  }

  // [{ key, name, icon, items: [{ b, context }] }]: rooms by name, types by how many batteries use them, the
  // room-less and the unknown last; by replacement date, the bands from now to later, then the ones without forecast
  _battGroups(list, view) {
    var rank = (b) => (b.unavailable ? 0 : b.alert || b.low ? 1 : 2);
    var byLevel = (a, b) => rank(a) - rank(b) || (a.level ?? 101) - (b.level ?? 101) || a.name.localeCompare(b.name);
    if (view === 'forecast') return this._battForecast(list);
    // By level: one list, the batteries in error (unavailable) first, then the lowest
    if (view === 'level') {
      return [
        {
          key: '',
          name: '',
          icon: '',
          items: [...list].sort(byLevel).map((b) => ({ b, context: [b.area, this._battTypeName(b.battery_type || '')].filter(Boolean).join(' · ') })),
        },
      ];
    }
    var map = new Map();
    [...list].sort(byLevel).forEach((b) => {
      var key = view === 'room' ? b.area || '' : this._battType(b);
      if (!map.has(key)) map.set(key, []);
      var context = view === 'room' ? this._battTypeName(b.battery_type || '') : b.area || '';
      map.get(key).push({ b, context });
    });
    return [...map.entries()]
      .map(([key, items]) => ({
        key,
        items,
        name: key ? (view === 'type' ? this._battTypeName(key) : key) : this._t(view === 'room' ? 'no_area' : 'unknown_type'),
        icon: view === 'room' ? 'mdi:sofa-outline' : key ? 'mdi:battery-outline' : 'mdi:battery-unknown',
      }))
      .sort((a, b) => !a.key - !b.key || (view === 'type' ? b.items.length - a.items.length : 0) || a.name.localeCompare(b.name));
  }

  _battForecast(list) {
    var bands = [
      ['now', 'mdi:battery-alert-variant-outline', (b) => b.low || b.unavailable],
      ['month', 'mdi:calendar-alert', (b) => Number.isInteger(b.days_left) && b.days_left <= 30],
      ['quarter', 'mdi:calendar-clock', (b) => Number.isInteger(b.days_left) && b.days_left <= 92],
      ['later', 'mdi:calendar-check', (b) => Number.isInteger(b.days_left)],
      ['none', 'mdi:help-circle-outline', () => true],
    ];
    var items = new Map(bands.map(([key]) => [key, []]));
    var order = (a, b) =>
      (a.days_left ?? Number.POSITIVE_INFINITY) - (b.days_left ?? Number.POSITIVE_INFINITY) || (a.level ?? 101) - (b.level ?? 101) || a.name.localeCompare(b.name);
    [...list].sort(order).forEach((b) => {
      var key = bands.find(([, , test]) => test(b))[0];
      var drain = Number(b.drain_per_day) > 0 ? this._t('drain', { n: this._battNum(b.drain_per_day) }) : '';
      var when =
        key === 'now' || key === 'none'
          ? ''
          : [this._t('forecast', { d: this._t('days', { n: b.days_left }) }), b.replace_by ? this._t('replace_on', { date: this._battDate(b.replace_by) }) : '']
              .filter(Boolean)
              .join(' ');
      items.get(key).push({ b, context: [b.area, when, drain].filter(Boolean).join(' · ') });
    });
    return bands
      .filter(([key]) => items.get(key).length)
      .map(([key, icon]) => ({ key, icon, items: items.get(key), name: this._t(`fc_${key}`) }));
  }

  _battNum(n) {
    var lang = this._hass?.locale?.language || this._hass?.language || undefined;
    try {
      return new Intl.NumberFormat(lang, { maximumFractionDigits: n < 1 ? 2 : 1 }).format(n);
    } catch (_err) {
      return String(Math.round(n * 100) / 100);
    }
  }

  // Day and month; the year only for a date beyond the next eleven months
  _battDate(iso) {
    var date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    var far = date - Date.now() > 330 * 864e5;
    try {
      return date.toLocaleDateString(this._hass?.locale?.language || this._hass?.language || undefined, {
        day: 'numeric',
        month: 'short',
        ...(far ? { year: 'numeric' } : {}),
      });
    } catch (_err) {
      return iso.slice(0, 10);
    }
  }

  // Git Sync: status, changed files, commit and push
  _gitSync() {
    var data = this._state.git_sync;
    if (!data) return `<ha-card class="note">${shEsc(this._t('git_needs_repo'))}</ha-card>`;
    var tone = { clean: 'good', dirty: 'warn', ahead: 'warn', behind: 'warn', diverged: 'bad', error: 'bad' }[data.status] || '';
    var commit = data.last_commit;
    var tiles = [
      this._tile('mdi:source-branch', `<b>${shEsc(data.branch || '—')}</b>`, this._l(`component.${SH_DOMAIN}.entity.sensor.git_sync_status.state.${data.status}`) || data.status, tone),
      this._tile('mdi:file-document-edit-outline', `<b>${data.changed ?? 0}</b>`, this._entityName('sensor', 'git_sync_changed_files'), data.changed ? 'warn' : 'good'),
      this._tile('mdi:source-commit', shEsc(commit ? this._ago(new Date(commit.timestamp * 1000).toISOString()) : this._t('never')), commit ? commit.message : this._entityName('sensor', 'git_sync_last_commit'), ''),
      this._tile('mdi:cloud-check-outline', shEsc(this._ago(data.last_push)), this._entityName('sensor', 'git_sync_last_push'), ''),
    ];
    var sync = [data.ahead ? this._t('ahead', { n: data.ahead }) : '', data.behind ? this._t('behind', { n: data.behind }) : ''].filter(Boolean).join(' · ');
    var files = (data.files || [])
      .map((f) => `<div class="item"><ha-icon icon="mdi:file-outline"></ha-icon><div class="who"><div class="n"><code>${shEsc(f)}</code></div></div></div>`)
      .join('');
    return `<div class="tiles">${tiles.join('')}</div>
      <ha-card class="block"><div class="actions"><label class="box"><input data-draft="message" placeholder="${shEsc(this._t('message'))}" value="${shEsc(this._draft.message || '')}"></label>
        ${data.ai_task ? this._button('git_sync_generate_message', 'mdi:creation-outline', this._t('generate'), { quiet: true }) : ''}</div>
        <div class="actions">${this._button('git_sync_commit_push', 'mdi:source-commit-end', this._entityName('button', 'git_sync_commit_push'))}
        ${this._button('git_sync_diff', 'mdi:file-compare', this._t('diff'), { quiet: true, disabled: !data.changed && !data.ahead })}
        ${this._button('git_sync_pull', 'mdi:source-pull', this._serviceName('git_sync_pull'), { quiet: true })}
        ${this._button('git_sync_export_dashboards', 'mdi:export', this._entityName('button', 'git_sync_export_dashboards'), { quiet: true })}
        ${sync ? `<span class="pill warn">${shEsc(sync)}</span>` : ''}${this._message('git_sync')}</div>
        ${data.last_error ? `<span class="msg bad">${shEsc(data.last_error)}</span>` : ''}
        ${data.remote_url ? `<span class="msg"><code>${shEsc(data.remote_url)}</code></span>` : ''}</ha-card>
      <ha-card class="list"><div class="lhead"><ha-icon icon="mdi:file-multiple-outline"></ha-icon><span class="lname">${shEsc(this._t('changed'))}</span></div>
      ${files || `<div class="empty good"><ha-icon icon="mdi:check-circle-outline"></ha-icon>${shEsc(this._t('clean'))}</div>`}</ha-card>`;
  }

  // Settings: the modules turned on, and the order of the tabs
  _settings() {
    var modules = this._draft.modules || this._state.modules || [];
    var tabs = this._draft.tabs || this._state.tabs || [];
    var all = Object.keys(SH_MODULE_NAMES);
    var moduleRows = all
      .map((m) => {
        var on = modules.includes(m);
        var hint = this._l(`component.${SH_DOMAIN}.config.step.user.data_description.${m}`);
        return `<label class="row"><ha-icon icon="${SH_MODULE_ICONS[m]}"></ha-icon>
          <div class="who"><div class="n">${shEsc(SH_MODULE_NAMES[m])}</div>${hint ? `<div class="s">${shEsc(hint)}</div>` : ''}</div>
          <ha-switch data-module="${m}"${on ? ' checked' : ''}></ha-switch></label>`;
      })
      .join('');
    var tabRows = tabs
      .map(
        (tab, i) => `<div class="row"><ha-icon icon="${SH_MODULE_ICONS[tab]}"></ha-icon><div class="who"><div class="n">${shEsc(this._tabName(tab))}</div></div>
        <button class="icon-btn" data-action="move" data-tab-move="${tab}" data-dir="-1" title="${shEsc(this._t('move_up'))}" aria-label="${shEsc(this._t('move_up'))}"${i === 0 ? ' disabled' : ''}><ha-icon icon="mdi:arrow-up"></ha-icon></button>
        <button class="icon-btn" data-action="move" data-tab-move="${tab}" data-dir="1" title="${shEsc(this._t('move_down'))}" aria-label="${shEsc(this._t('move_down'))}"${i === tabs.length - 1 ? ' disabled' : ''}><ha-icon icon="mdi:arrow-down"></ha-icon></button></div>`,
      )
      .join('');
    var changed = Boolean(this._draft.modules || this._draft.tabs);
    return `<ha-card class="block"><h2>${shEsc(this._t('modules'))}</h2><span class="msg">${shEsc(this._t('modules_hint'))}</span>${moduleRows}</ha-card>
      <ha-card class="block"><h2>${shEsc(this._t('tabs'))}</h2>${tabRows}</ha-card>
      <div class="actions">${this._button('save', 'mdi:content-save-outline', this._t('save'), { disabled: !changed })}
      <a class="act quiet" href="/config/integrations/integration/${SH_DOMAIN}"><ha-icon icon="mdi:cog-outline"></ha-icon>${shEsc(this._t('configure'))}</a>
      ${this._message('save')}</div>`;
  }

  _onClick(ev) {
    var more = ev.target.closest?.('[data-more]');
    if (more && !ev.target.closest('button, a, input')) {
      this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId: more.dataset.more }, bubbles: true, composed: true }));
      return;
    }
    var toggle = ev.target.closest?.('ha-switch[data-module]');
    if (toggle) {
      // The switch flips after the click: read it once it has
      setTimeout(() => {
        var current = this._draft.modules || [...(this._state.modules || [])];
        var module = toggle.dataset.module;
        var next = toggle.checked ? [...new Set([...current, module])] : current.filter((m) => m !== module);
        this._draft.modules = Object.keys(SH_MODULE_NAMES).filter((m) => next.includes(m));
        this._render();
      });
      return;
    }
    var button = ev.target.closest?.('[data-action]');
    if (!button || button.disabled) return;
    var action = button.dataset.action;
    if (action === 'reload') return this._load();
    if (action === 'cancel' || action === 'confirm_install') {
      this._confirm = action === 'confirm_install' ? 'install' : null;
      return this._render();
    }
    if (action === 'move') {
      var tabs = [...(this._draft.tabs || this._state.tabs || [])];
      var i = tabs.indexOf(button.dataset.tabMove);
      var j = i + Number(button.dataset.dir);
      if (i < 0 || j < 0 || j >= tabs.length) return;
      [tabs[i], tabs[j]] = [tabs[j], tabs[i]];
      this._draft.tabs = tabs;
      return this._render();
    }
    if (action === 'batt_view') {
      this._battView = button.dataset.view;
      try {
        localStorage.setItem('system_hub_batteries_view', this._battView);
      } catch (_err) {
        // no storage: the view stays for this visit
      }
      return this._render();
    }
    if (action === 'save') return this._save();
    if (action.startsWith('watchdog_reset:')) return this._run('watchdog_reset', 'watchdog_reset', { entry_id: action.split(':')[1] });
    if (action === 'git_sync_generate_message') return this._generate();
    if (action === 'git_sync_diff') return this._openDiff();
    if (action === 'git_sync_commit_push') {
      var message = (this._draft.message || '').trim();
      return this._run(action, 'git_sync', message ? { message } : {}, () => {
        this._draft.message = '';
      });
    }
    if (action === 'git_sync_pull' || action === 'git_sync_export_dashboards') return this._run(action, 'git_sync', {});
    if (action === 'marketplace_install_updates') {
      this._confirm = null;
      return this._run(action, action, {});
    }
    return this._run(action, action, {});
  }

  async _run(service, messageKey, data, done) {
    this._busy[service] = true;
    delete this._messages[messageKey];
    this._render();
    try {
      await this._hass.callService(SH_DOMAIN, service, data);
      this._messages[messageKey] = { text: this._t('done'), tone: 'good' };
      done?.();
    } catch (err) {
      this._messages[messageKey] = { text: this._t('failed', { error: err?.message || String(err) }), tone: 'bad' };
    }
    delete this._busy[service];
    await this._load();
  }

  // The changes a commit would include, in the full screen diff viewer
  _openDiff() {
    if (!this._diffDialog) {
      this._diffDialog = document.createElement('system-hub-diff-dialog');
      document.body?.appendChild?.(this._diffDialog);
    }
    var state = this._state?.git_sync || {};
    this._diffDialog.open({
      t: (key, vars) => this._t(key, vars),
      locale: this._hass?.locale?.language || this._hass?.language || undefined,
      branch: state.branch,
      commitLabel: this._entityName('button', 'git_sync_commit_push'),
      request: async () =>
        (await this._hass.callWS({ type: 'call_service', domain: SH_DOMAIN, service: 'git_sync_get_diff', service_data: {}, return_response: true }))?.response,
      onCommit: () => this.shadowRoot.querySelector('[data-draft="message"]')?.focus?.({ preventScroll: true }),
    });
  }


  async _generate() {
    var service = 'git_sync_generate_message';
    this._busy[service] = true;
    this._render();
    try {
      var res = await this._hass.callWS({ type: 'call_service', domain: SH_DOMAIN, service, service_data: {}, return_response: true });
      var message = res?.response?.message;
      if (message) this._draft.message = message;
      else this._messages.git_sync = { text: this._t('clean'), tone: '' };
    } catch (err) {
      this._messages.git_sync = { text: this._t('failed', { error: err?.message || String(err) }), tone: 'bad' };
    }
    delete this._busy[service];
    this._render();
  }

  async _save() {
    this._busy.save = true;
    this._render();
    var msg = { type: 'system_hub/update_settings' };
    if (this._draft.modules) msg.modules = this._draft.modules;
    if (this._draft.tabs) msg.tabs = this._draft.tabs;
    try {
      await this._hass.callWS(msg);
      this._draft.modules = null;
      this._draft.tabs = null;
      this._messages.save = { text: this._t('saved'), tone: 'good' };
    } catch (err) {
      var text = err?.code === 'git_sync_needs_repository' ? this._t('git_needs_repo') : this._t('failed', { error: err?.message || String(err) });
      this._messages.save = { text, tone: 'bad' };
    }
    delete this._busy.save;
    // The entry reloads with the new modules: read them once it has
    setTimeout(() => this._load(), 1500);
    this._render();
  }
}

if (!customElements.get('system-hub-diff-dialog')) {
  customElements.define('system-hub-diff-dialog', SystemHubDiffDialog);
}
if (!customElements.get('system-hub-panel')) {
  customElements.define('system-hub-panel', SystemHubPanel);
}
