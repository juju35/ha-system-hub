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
var SYSTEM_HUB_PANEL_VERSION = '0.2.0';
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

// One colour per kind of data, the same in the rings, the charts and their legends
var SH_COLORS = {
  cpu: '#03a9f4',
  ram: '#8e24aa',
  temp: '#ff7043',
  download: '#43a047',
  upload: '#1e88e5',
  disks: ['#00897b', '#5c6bc0', '#f4511e', '#6d4c41', '#c0ca33'],
};
var SH_BUCKETS = 120;

// [[ms, value]] → `n` averages over [start, end]; a bucket without a reading keeps the last value known before it
function shBuckets(points, start, end, n) {
  var sums = new Array(n).fill(0);
  var counts = new Array(n).fill(0);
  var before = null;
  var step = (end - start) / n;
  (points || []).forEach(([t, v]) => {
    if (v === null || v === undefined || Number.isNaN(v)) return;
    if (t < start) {
      before = v;
      return;
    }
    var i = Math.min(n - 1, Math.floor((t - start) / step));
    sums[i] += v;
    counts[i] += 1;
  });
  var last = before;
  return sums.map((sum, i) => {
    if (counts[i]) last = sum / counts[i];
    return last;
  });
}

// The polyline points of a series, split where it has no value
function shPoints(values, w, h, max) {
  var segs = [];
  var cur = [];
  var step = values.length > 1 ? w / (values.length - 1) : w;
  values.forEach((v, i) => {
    if (v === null || v === undefined) {
      if (cur.length) segs.push(cur);
      cur = [];
      return;
    }
    var y = h - (Math.min(Math.max(v, 0), max) / max) * h;
    cur.push(`${(i * step).toFixed(1)},${y.toFixed(1)}`);
  });
  if (cur.length) segs.push(cur);
  return segs.filter((seg) => seg.length > 1);
}

// The last 24 hours behind a ring: an area at 12 % and its line at 50 %, on a 0-100 scale
function shArea(values, max) {
  return shPoints(values, 100, 30, max)
    .map((seg) => `<svg class="behind" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
      <polygon points="${seg[0].split(',')[0]},30 ${seg.join(' ')} ${seg[seg.length - 1].split(',')[0]},30"/><polyline points="${seg.join(' ')}"/></svg>`)
    .join('');
}

// A round top for a rate axis: 1, 2 or 5 times a power of ten
function shNiceMax(values) {
  var top = Math.max(0, ...values.filter((v) => v !== null && v !== undefined));
  if (!top) return 1;
  var p = 10 ** Math.floor(Math.log10(top));
  return [1, 2, 5, 10].map((m) => m * p).find((m) => m >= top);
}

function shRate(v) {
  return v < 10 ? Number(v.toFixed(1)).toString() : String(Math.round(v));
}

function shRound(n) {
  return Number.isInteger(n) ? n : Number(n.toFixed(1));
}

// "Disk usage /media" → "/media"; "Network throughput in eth0" → "eth0"
function shMount(sensor) {
  var m = String(sensor.name || '').match(/(\/\S*)\s*$/);
  return m ? m[1] : sensor.name;
}

// "System Monitor Process python3" → "python3"
function shProcess(sensor) {
  var name = String(sensor.name || '');
  var i = name.toLowerCase().lastIndexOf('process ');
  return i < 0 ? name : name.slice(i + 8);
}

function shIface(sensor) {
  return String(sensor.name || '').split(' ').pop();
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
    .warn-text { color:color-mix(in srgb, var(--tone-warn) 50%, var(--primary-text-color)) !important; }
    .lhead .act { font-size:12px; padding:4px 10px; }
    .mono { font-family:var(--code-font-family, monospace); font-size:15px; }
    .progress { padding:14px 16px; display:flex; flex-direction:column; gap:10px; }
    .phead { display:flex; align-items:center; gap:10px; --mdc-icon-size:20px; color:var(--primary-color); }
    .phead ha-icon { animation:sh-spin 2s linear infinite; }
    .ptitle { flex:1; font-size:15px; font-weight:500; color:var(--primary-text-color); }
    .ppct { font-size:20px; font-weight:500; font-variant-numeric:tabular-nums; color:var(--primary-text-color); }
    .pbar { height:8px; border-radius:4px; overflow:hidden; background:color-mix(in srgb, var(--primary-color) 15%, transparent); }
    .pbar > span { display:block; height:100%; border-radius:4px; background:var(--primary-color); transition:width .6s ease; }
    .pbar.busy > span { animation:sh-slide 1.4s ease-in-out infinite; }
    .pmeta { display:flex; flex-wrap:wrap; gap:6px 18px; font-size:13px; color:var(--secondary-text-color); font-variant-numeric:tabular-nums; }
    .pmeta .bad { color:color-mix(in srgb, var(--tone-bad) 50%, var(--primary-text-color)); }
    .notes { display:flex; flex-direction:column; gap:4px; }
    @keyframes sh-spin { to { transform:rotate(360deg) } }
    @keyframes sh-slide { 0% { transform:translateX(-100%) } 100% { transform:translateX(340%) } }
    @media (prefers-reduced-motion: reduce) { .phead ha-icon, .pbar.busy > span { animation:none; } }
    .bsheet { padding:14px 16px 16px; }
    .btop { display:flex; flex-wrap:wrap; align-items:center; gap:10px 20px; margin-bottom:16px; }
    .btabs { display:inline-flex; gap:4px; padding:3px; border-radius:12px; background:var(--secondary-background-color, rgba(128,128,128,.1)); }
    .btab { border:0; background:none; cursor:pointer; font:inherit; padding:6px 14px; border-radius:9px; font-size:13px; font-weight:500; color:var(--secondary-text-color); }
    .btab.on { background:color-mix(in srgb, var(--primary-color) 15%, transparent); color:color-mix(in srgb, var(--primary-color) 40%, var(--primary-text-color)); }
    .bline { display:flex; flex-wrap:wrap; align-items:center; gap:6px; font-size:12px; color:var(--secondary-text-color); }
    .rlabel { display:flex; align-items:center; gap:6px; font-size:12px; font-weight:500; text-transform:uppercase; letter-spacing:.04em; --mdc-icon-size:16px; }
    .buy { padding:2px 9px; border-radius:999px; color:var(--primary-text-color); background:color-mix(in srgb, var(--tone-warn) 16%, transparent); }
    .buy b { color:color-mix(in srgb, var(--tone-warn) 40%, var(--primary-text-color)); }
    .buy.unknown { background:color-mix(in srgb, var(--secondary-text-color) 18%, transparent); }
    .buy.unknown b { color:var(--secondary-text-color); }
    .none { color:color-mix(in srgb, var(--tone-good) 40%, var(--primary-text-color)); font-weight:500; }
    .nextb { border:0; cursor:pointer; font:inherit; font-size:12px; padding:2px 9px; border-radius:999px; color:var(--primary-text-color); background:color-mix(in srgb, var(--primary-color) 12%, transparent); }
    .nextb b { font-weight:500; }
    .bgroups { columns:3 300px; column-gap:28px; }
    .bgroup { break-inside:avoid; display:flex; flex-direction:column; gap:6px; margin-bottom:20px; }
    .bgroups.flat { columns:auto; }
    .bgroups.flat .glist { grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); }
    .ghead { display:flex; align-items:center; gap:8px; font-size:14px; font-weight:500; --mdc-icon-size:18px; }
    .ghead ha-icon { color:var(--secondary-text-color); }
    .gname { flex:1; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .gchip { font-size:11px; padding:1px 8px; border-radius:999px; color:color-mix(in srgb, var(--tone-warn) 40%, var(--primary-text-color)); background:color-mix(in srgb, var(--tone-warn) 14%, transparent); }
    .gcount { font-size:11px; font-weight:400; color:var(--secondary-text-color); }
    .glist { display:grid; gap:6px; }
    .ghint { font-size:11px; color:var(--secondary-text-color); margin-top:-2px; }
    .brow { --t:var(--tone-good); --tt:color-mix(in srgb, var(--t) 40%, var(--primary-text-color)); border:0; font:inherit; color:inherit; text-align:left; cursor:pointer;
            min-width:0; display:flex; align-items:center; gap:8px; padding:5px 10px 5px 5px; border-radius:10px; background:var(--secondary-background-color, rgba(127,127,127,.08)); }
    .brow.warn { --t:var(--tone-warn); }
    .brow.alert { --t:var(--tone-bad); }
    .brow.warn, .brow.alert { background:color-mix(in srgb, var(--t) 12%, var(--secondary-background-color, transparent)); }
    .brow:hover { filter:brightness(.97); }
    .brow .ic { flex:none; width:28px; height:28px; border-radius:50%; display:grid; place-items:center; color:var(--t); background:color-mix(in srgb, var(--t) 18%, transparent); --mdc-icon-size:16px; }
    .brow.due .ic { animation:sh-blink 1.5s ease-in-out infinite; }
    .brow .txt { flex:1; display:flex; flex-direction:column; min-width:0; }
    .brow .name { font-size:13px; font-weight:500; line-height:1.25; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .brow .sub { font-size:11px; line-height:1.25; color:var(--secondary-text-color); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .brow.warn .sub, .brow.alert .sub, .brow.warn .lvl, .brow.alert .lvl { color:var(--tt); }
    .brow .lvl { flex:none; display:flex; flex-direction:column; align-items:flex-end; gap:3px; font-size:12px; font-weight:500; font-variant-numeric:tabular-nums; }
    .track { width:44px; height:4px; border-radius:2px; overflow:hidden; background:color-mix(in srgb, var(--secondary-text-color) 22%, transparent); }
    .bar { display:block; height:100%; border-radius:2px; background:var(--t); }
    @keyframes sh-blink { 0%, 100% { opacity:1 } 50% { opacity:.35 } }
    @media (prefers-reduced-motion: reduce) { .brow.due .ic { animation:none; } }
    .segs { display:inline-flex; border-radius:8px; overflow:hidden; background:var(--secondary-background-color, rgba(127,127,127,.12)); }
    .seg { display:inline-flex; align-items:center; gap:6px; border:0; background:none; cursor:pointer; font:inherit; font-size:13px;
           padding:7px 12px; color:var(--secondary-text-color); --mdc-icon-size:16px; }
    .seg.active { color:var(--primary-color); background:color-mix(in srgb, var(--primary-color) 14%, transparent); font-weight:500; }
    .lhead .muted { font-size:12px; }
    .rings { display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:10px; }
    .ring { position:relative; overflow:hidden; display:flex; flex-direction:column; align-items:center; padding:14px 12px 44px; gap:6px; cursor:pointer; }
    .ring .behind { position:absolute; inset:auto 0 0 0; width:100%; height:34%; pointer-events:none; }
    .ring .behind polygon { fill:var(--ring); opacity:.12; }
    .ring .behind polyline { fill:none; stroke:var(--ring); stroke-width:1.5; opacity:.5; vector-effect:non-scaling-stroke; }
    .gauge { position:relative; width:104px; height:104px; }
    .gauge circle { fill:none; stroke-width:9; }
    .gauge .track { stroke:var(--divider-color, rgba(127,127,127,.2)); }
    .gauge .arc { stroke:var(--ring); stroke-linecap:round; }
    .rv { position:absolute; top:14px; height:104px; display:flex; align-items:center; justify-content:center; gap:2px; }
    .rv b { font-size:24px; font-weight:500; font-variant-numeric:tabular-nums; }
    .rv span { font-size:13px; color:var(--secondary-text-color); margin-top:6px; }
    .rl { position:relative; font-size:16px; font-weight:500; }
    .chart { padding:14px 16px 12px; display:flex; flex-direction:column; gap:8px; min-width:0; }
    .chead { display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
    .ctitle { flex:1; font-size:17px; font-weight:500; }
    .chart .seg { padding:5px 10px; font-size:12px; }
    .plot { position:relative; }
    .plot svg { width:100%; height:100%; display:block; overflow:visible; }
    .plot polyline { fill:none; stroke-width:2; vector-effect:non-scaling-stroke; stroke-linejoin:round; }
    .plot .grid line { stroke:var(--divider-color, rgba(127,127,127,.2)); stroke-width:1; vector-effect:non-scaling-stroke; }
    .ymax { position:absolute; top:-2px; left:0; font-size:11px; color:var(--secondary-text-color); background:var(--card-background-color); padding-right:4px; }
    .cnote { position:absolute; inset:0; display:grid; place-items:center; font-size:13px; color:var(--secondary-text-color); }
    .xaxis { position:relative; height:16px; font-size:12px; color:var(--secondary-text-color); }
    .xaxis span { position:absolute; transform:translateX(-50%); white-space:nowrap; }
    .xaxis span:first-child { transform:none; }
    .xaxis span:last-child { transform:translateX(-100%); }
    .legend { display:flex; flex-wrap:wrap; gap:6px 20px; font-size:14px; }
    .legend .lg { display:inline-flex; align-items:center; gap:8px; cursor:pointer; }
    .legend i { width:14px; height:4px; border-radius:2px; }
    .pair { display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:10px; }
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
      .rings { grid-template-columns:repeat(2, minmax(0, 1fr)); gap:8px; }
      .gauge { width:84px; height:84px; }
      .rv { height:84px; }
      .rv b { font-size:20px; }
      .pair { grid-template-columns:1fr; }
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
    this._hist = {};
    this._histBusy = {};
    this._periods = {};
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
    clearTimeout(this._fast);
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
      // A check running on the Marketplace tab: its progress every 2 seconds rather than every 10
      clearTimeout(this._fast);
      if (this._state?.marketplace?.state === 'running' && this._tab === 'marketplace' && this.isConnected) {
        this._fast = setTimeout(() => this._load(), 2000);
      }
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
    return `<ha-card class="tile ${tone || ''}${opts.entity ? ' link' : ''}"${opts.entity ? ` data-more="${shEsc(opts.entity)}"` : ''}${opts.title ? ` title="${shEsc(opts.title)}"` : ''}>
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
    var all = (key) => sensors.filter((s) => s.key === key);
    var cpu = one('processor_use');
    var ram = one('memory_use_percent');
    var temp = one('processor_temperature');
    var disks = all('disk_use_percent');
    var rx = all('throughput_network_in');
    var txs = all('throughput_network_out');
    // Rings: the value now, the last 24 hours behind it, each kind of data in its own colour
    var ringDefs = [
      [cpu, this._t('cpu'), SH_COLORS.cpu, '%'],
      [ram, this._t('ram'), SH_COLORS.ram, '%'],
      [temp, this._t('temperature'), SH_COLORS.temp, temp?.unit || '°C'],
      [disks[0], disks.length > 1 ? `${this._t('disk')} ${shMount(disks[0])}` : this._t('disk'), SH_COLORS.disks[0], '%'],
    ].filter(([s]) => s);
    var ringHist = this._history(ringDefs.map(([s]) => s.entity_id), 24);
    var rings = ringDefs.map(([s, label, color, unit]) => this._ring(s, label, color, unit, ringHist?.[s.entity_id])).join('');
    var tiles = [];
    // Swap: its percentage, else worked out from the swap used and free (the percentage sensor is off by default)
    var swap = one('swap_use_percent');
    var swapUse = one('swap_use');
    var swapFree = one('swap_free');
    if (swap || swapUse) {
      var used = shNum(swapUse?.state);
      var free = shNum(swapFree?.state);
      var v = swap ? shNum(swap.state) : used !== null && free !== null && used + free > 0 ? (used * 100) / (used + free) : null;
      var size = used === null ? '' : ` <span class="more">${shEsc(`${used} ${swapUse.unit || ''}`.trim())}</span>`;
      tiles.push(this._tile('mdi:swap-horizontal', v === null ? '—' : `<b>${Math.round(v)}</b>%${size}`, this._t('swap'), shTone(v, 50, 80), { entity: (swap || swapUse).entity_id }));
    }
    var loads = ['load_1m', 'load_5m', 'load_15m'].map(one).filter(Boolean);
    if (loads.length) {
      tiles.push(
        this._tile('mdi:speedometer', loads.map((s, i) => (i ? `<span class="more">${shEsc(shNum(s.state)?.toFixed(2) ?? '—')}</span>` : `<b>${shEsc(shNum(s.state)?.toFixed(2) ?? '—')}</b>`)).join(' '), this._t('load'), '', {
          entity: loads[0].entity_id,
        }),
      );
    }
    // Uptime: how long since the last boot (the date in the tile's title)
    var boot = one('last_boot');
    if (boot) {
      var bootAt = Date.parse(boot.state);
      var up = Number.isNaN(bootAt) ? '—' : this._uptime(Date.now() - bootAt);
      tiles.push(this._tile('mdi:clock-start', up, this._t('uptime_for'), '', { entity: boot.entity_id, title: this._day(boot.state) }));
    }
    var ip = one('ipv4_address');
    if (ip) tiles.push(this._tile('mdi:ip-network-outline', `<span class="mono">${shEsc(ip.state)}</span>`, this._t('ip_address'), '', { entity: ip.entity_id }));
    // The recorder's database, from the File Size integration
    var db = one('database_size');
    if (db) {
      var mb = shNum(db.state);
      tiles.push(this._tile('mdi:database-outline', mb === null ? '—' : `<b>${mb < 10 ? mb.toFixed(1) : Math.round(mb)}</b>${shEsc(db.unit || 'MB')}`, this._t('database'), '', { entity: db.entity_id }));
    }
    // Automatic backups (the Backup integration): the last one, orange after 2 days, red after 7 or when the last attempt
    // failed; the next one, or "Backing up…"
    var lastOk = one('backup_last_successful_automatic_backup');
    var lastTry = one('backup_last_attempted_automatic_backup');
    var nextBackup = one('backup_next_scheduled_automatic_backup');
    var manager = one('backup_backup_manager_state');
    if (lastOk || nextBackup) {
      var okAt = Date.parse(lastOk?.state);
      var tryAt = Date.parse(lastTry?.state);
      var failed = !Number.isNaN(tryAt) && (Number.isNaN(okAt) || tryAt > okAt + 60000);
      var age = Number.isNaN(okAt) ? null : (Date.now() - okAt) / 86400000;
      var tone = failed || age === null || age > 7 ? 'bad' : age > 2 ? 'warn' : 'good';
      var running = manager && manager.state !== 'idle';
      tiles.push(
        this._tile('mdi:backup-restore', shEsc(Number.isNaN(okAt) ? this._t('never') : this._ago(lastOk.state)), failed ? this._t('backup_failed') : this._t('last_backup'), tone, {
          entity: (lastOk || lastTry).entity_id,
        }),
      );
      if (nextBackup || running) {
        tiles.push(
          this._tile('mdi:calendar-clock', shEsc(running ? this._t('backing_up') : this._ago(nextBackup.state)), this._t('next_backup'), running ? 'warn' : '', {
            entity: (nextBackup || manager).entity_id,
          }),
        );
      }
    }
    var unit = (rx[0] || txs[0])?.unit || 'MB/s';
    var rate = (list) => {
      var v = list.reduce((sum, s) => sum + (shNum(s.state) || 0), 0);
      return v < 100 ? v.toFixed(1) : String(Math.round(v));
    };
    // Download and upload in one tile, in their chart colours
    if (rx.length || txs.length) {
      tiles.push(
        this._tile(
          'mdi:swap-vertical',
          `<b style="color:${SH_COLORS.download}">${rate(rx)}</b>/ <b style="color:${SH_COLORS.upload}">${rate(txs)}</b>${shEsc(unit)}`,
          `${this._t('download')} / ${this._t('upload')}`,
          '',
        ),
      );
    }
    // History charts: CPU, RAM and temperature; the network; the disks
    var charts = [];
    var systemLines = [
      [cpu, this._t('cpu'), SH_COLORS.cpu],
      [ram, this._t('ram'), SH_COLORS.ram],
      [temp, `${this._t('temperature')} (${temp?.unit || '°C'})`, SH_COLORS.temp],
    ].filter(([s]) => s);
    if (systemLines.length) charts.push(this._chart('system', this._t('chart_system'), systemLines, { max: 100, unit: '%', height: 180 }));
    var netLines = [
      ...rx.map((s) => [s, rx.length > 1 ? `${this._t('download')} · ${shIface(s)}` : this._t('download'), SH_COLORS.download]),
      ...txs.map((s) => [s, txs.length > 1 ? `${this._t('upload')} · ${shIface(s)}` : this._t('upload'), SH_COLORS.upload]),
    ];
    var diskLines = disks.map((s, i) => [s, shMount(s), SH_COLORS.disks[i % SH_COLORS.disks.length]]);
    var pair = [
      netLines.length ? this._chart('network', this._t('chart_network'), netLines, { unit, height: 130 }) : '',
      diskLines.length ? this._chart('disks', this._t('chart_disks'), diskLines, { max: 100, unit: '%', height: 130 }) : '',
    ].filter(Boolean);
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
    // The processes System Monitor watches: the stopped ones first
    var procs = all('process').sort((a, b) => (a.state === 'on') - (b.state === 'on') || a.name.localeCompare(b.name));
    var stopped = procs.filter((p) => p.state !== 'on').length;
    var procList = procs.length
      ? `<ha-card class="list"><div class="lhead"><ha-icon icon="mdi:application-cog-outline"></ha-icon><span class="lname">${shEsc(this._t('processes'))}</span>
        ${stopped ? `<span class="pill bad">${shEsc(`${stopped} ${this._t('stopped')}`)}</span>` : `<span class="pill good">${shEsc(this._t('running'))}</span>`}</div>
        ${procs
          .map((p) => {
            var on = p.state === 'on';
            return `<div class="item link ${on ? 'good' : 'bad'}" data-more="${shEsc(p.entity_id)}"><ha-icon icon="mdi:cog${on ? '' : '-off'}-outline"></ha-icon>
              <div class="who"><div class="n">${shEsc(shProcess(p))}</div></div><span class="pill ${on ? 'good' : 'bad'}">${shEsc(this._t(on ? 'running' : 'stopped'))}</span></div>`;
          })
          .join('')}</ha-card>`
      : '';
    var lists = [diskList, procList].filter(Boolean);
    return `${rings ? `<div class="rings">${rings}</div>` : ''}${tiles.length ? `<div class="tiles">${tiles.join('')}</div>` : ''}
      ${charts.join('')}${pair.length ? `<div class="pair">${pair.join('')}</div>` : ''}${lists.length ? `<div class="pair">${lists.join('')}</div>` : ''}`;
  }

  // "8 d 4 h", "5 h 12 min", "35 min"
  _uptime(ms) {
    var min = Math.max(0, Math.floor(ms / 60000));
    var d = Math.floor(min / 1440);
    var h = Math.floor((min % 1440) / 60);
    var m = min % 60;
    if (d) return `<b>${d}</b>${shEsc(this._t('days', { n: '' }).trim())} <b>${h}</b>${shEsc(this._t('hours', { n: '' }).trim())}`;
    if (h) return `<b>${h}</b>${shEsc(this._t('hours', { n: '' }).trim())} <b>${m}</b>${shEsc(this._t('min', { n: '' }).trim())}`;
    return `<b>${m}</b>${shEsc(this._t('min', { n: '' }).trim())}`;
  }

  // A ring: the value now over its scale (0-100, 0-100 °C for a temperature), the last 24 hours drawn behind it
  _ring(sensor, label, color, unit, values) {
    var v = shNum(sensor.state);
    var c = 2 * Math.PI * 40;
    var dash = v === null ? 0 : (c * Math.min(Math.max(v, 0), 100)) / 100;
    var shown = v === null ? '—' : Math.round(v);
    return `<ha-card class="ring link" data-more="${shEsc(sensor.entity_id)}" style="--ring:${color}">
      ${values ? shArea(values, 100) : ''}
      <svg class="gauge" viewBox="0 0 100 100" aria-hidden="true"><circle class="track" cx="50" cy="50" r="40"/>
        <circle class="arc" cx="50" cy="50" r="40" stroke-dasharray="${dash.toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 50 50)"/></svg>
      <div class="rv"><b>${shown}</b><span>${shEsc(unit)}</span></div>
      <div class="rl">${shEsc(label)}</div></ha-card>`;
  }

  // A history chart: its lines over the period chosen (1 h, 6 h, 24 h or 7 days), a legend in the lines' colours
  _chart(id, title, lines, opts) {
    var hours = this._periods[id] || 24;
    var data = this._history(
      lines.map(([s]) => s.entity_id),
      hours,
    );
    var periods = [1, 6, 24, 168]
      .map((h) => {
        var label = h < 168 ? this._t('period_h', { n: h }) : this._t('period_d', { n: 7 });
        return `<button class="seg${h === hours ? ' active' : ''}" data-action="period" data-chart="${id}" data-hours="${h}" aria-pressed="${h === hours}">${shEsc(label)}</button>`;
      })
      .join('');
    var series = lines.map(([s, , color]) => ({ color, values: data?.[s.entity_id] || [] }));
    var max = opts.max || shNiceMax(series.flatMap((x) => x.values));
    var w = 1000;
    var h = opts.height;
    var grid = [0.25, 0.5, 0.75, 1].map((f) => `<line x1="0" x2="${w}" y1="${(h - f * h).toFixed(1)}" y2="${(h - f * h).toFixed(1)}"/>`).join('');
    var plot = series
      .map((x) => {
        var pts = shPoints(x.values, w, h, max);
        if (!pts.length) return '';
        return pts
          .map((seg) => `<polygon points="${seg[0].split(',')[0]},${h} ${seg.join(' ')} ${seg[seg.length - 1].split(',')[0]},${h}" fill="${x.color}" opacity=".08"/>
            <polyline points="${seg.join(' ')}" stroke="${x.color}"/>`)
          .join('');
      })
      .join('');
    var empty = data && !series.some((x) => x.values.some((v) => v !== null));
    var ticks = hours < 168 ? [hours, (hours * 3) / 4, hours / 2, hours / 4] : [7, 5, 3, 1];
    var axis = [...ticks.map((n) => (hours < 168 ? this._t('ago_h', { n: shRound(n) }) : this._t('ago_d', { n }))), this._t('now')]
      .map((label, i, list) => `<span style="left:${(i * 100) / (list.length - 1)}%">${shEsc(label)}</span>`)
      .join('');
    var top = opts.max ? `${max} ${opts.unit}` : `${shRate(max)} ${opts.unit}`;
    return `<ha-card class="chart">
      <div class="chead"><span class="ctitle">${shEsc(title)}</span><div class="segs" role="group">${periods}</div></div>
      <div class="plot" style="height:${h}px"><span class="ymax">${shEsc(top)}</span>
        <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><g class="grid">${grid}</g>${plot}</svg>
        ${data === null ? `<span class="cnote">${shEsc(this._t('loading'))}</span>` : empty ? `<span class="cnote">${shEsc(this._t('chart_empty'))}</span>` : ''}</div>
      <div class="xaxis">${axis}</div>
      <div class="legend">${lines.map(([s, label, color]) => `<span class="lg link" data-more="${shEsc(s.entity_id)}"><i style="background:${color}"></i>${shEsc(label)}</span>`).join('')}</div>
    </ha-card>`;
  }

  // The recorded values of `ids` over the last `hours`, SH_BUCKETS averages each (null where nothing is known),
  // fetched once and kept a few minutes; null while the first read runs (the panel draws again once it is in)
  _history(ids, hours) {
    var now = Date.now();
    var fresh = hours <= 1 ? 60e3 : 300e3;
    var missing = ids.filter((id) => {
      var c = this._hist[`${hours}|${id}`];
      return !c || now - c.at > fresh;
    });
    var known = ids.every((id) => this._hist[`${hours}|${id}`]);
    if (missing.length && !this._histBusy[hours]) {
      this._histBusy[hours] = true;
      this._fetchHistory(missing, hours)
        .then((data) => {
          var at = Date.now();
          missing.forEach((id) => {
            this._hist[`${hours}|${id}`] = { at, values: data[id] || [] };
          });
        })
        .catch(() => {
          var at = Date.now();
          missing.forEach((id) => {
            this._hist[`${hours}|${id}`] ??= { at, values: [] };
          });
        })
        .finally(() => {
          delete this._histBusy[hours];
          if (this.isConnected && this._tab === 'system') this._render();
        });
    }
    if (!known) return null;
    return Object.fromEntries(ids.map((id) => [id, this._hist[`${hours}|${id}`].values]));
  }

  async _fetchHistory(ids, hours) {
    var end = Date.now();
    var startMs = end - hours * 3600e3;
    var start = new Date(startMs).toISOString();
    var points = {};
    if (hours > 24) {
      // A week: the recorder's hourly means
      var stats = await this._hass.callWS({ type: 'recorder/statistics_during_period', start_time: start, statistic_ids: ids, period: 'hour', types: ['mean'] });
      ids.forEach((id) => {
        points[id] = (stats?.[id] || []).map((p) => [typeof p.start === 'number' ? p.start : Date.parse(p.start), p.mean]);
      });
    } else {
      var res = await this._hass.callWS({
        type: 'history/history_during_period',
        start_time: start,
        entity_ids: ids,
        minimal_response: true,
        no_attributes: true,
        significant_changes_only: false,
      });
      ids.forEach((id) => {
        points[id] = (res?.[id] || []).map((p) => [(p.lu ?? p.lc ?? 0) * 1000, shNum(p.s)]);
      });
    }
    return Object.fromEntries(ids.map((id) => [id, shBuckets(points[id], startMs, end, SH_BUCKETS)]));
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
      ${this._powerCycles(data)}
      <ha-card class="list"><div class="lhead"><ha-icon icon="mdi:history"></ha-icon><span class="lname">${shEsc(this._t('history'))}</span></div>
      ${history || `<div class="empty">${shEsc(this._t('no_history'))}</div>`}</ha-card>`;
  }

  // The devices power cycled through their smart plug: room, plug, delays, status, count; set up in Configure
  _powerCycles(data) {
    var cycles = data.power_cycles || [];
    var rows = cycles
      .map((c) => {
        var tone = c.gave_up ? 'bad' : c.unavailable ? 'warn' : 'good';
        var status = c.gave_up ? this._t('gave_up') : c.unavailable ? this._t('pc_unavailable') : this._t('pc_available');
        var sub = [
          c.switch_name || c.switch,
          this._t('pc_line', { delay: c.delay, off: c.off_time }),
          c.count ? this._t('pc_count', { n: c.count, max: data.max_reloads ?? '' }) : '',
        ].filter(Boolean);
        var plug = c.switch_state === 'off' ? 'plug_off' : c.switch_state === 'unavailable' || c.switch_state === null ? 'plug_unavailable' : '';
        return `<div class="item ${tone}"><ha-icon icon="mdi:power-plug-outline"></ha-icon>
          <div class="who"><div class="n">${shEsc(c.device_name || this._t('unknown_device'))}${c.area ? ` <span class="muted">${shEsc(c.area)}</span>` : ''}</div>
            <div class="s">${shEsc(sub.join(' · '))}</div>${plug ? `<div class="s warn-text">${shEsc(this._t(plug))}</div>` : ''}</div>
          <span class="pill ${tone}">${shEsc(status)}</span>
          ${c.device_id ? `<a class="icon-btn" href="/config/devices/device/${shEsc(c.device_id)}" title="${shEsc(this._t('open_device'))}" aria-label="${shEsc(this._t('open_device'))}"><ha-icon icon="mdi:devices"></ha-icon></a>` : ''}</div>`;
      })
      .join('');
    return `<ha-card class="list"><div class="lhead"><ha-icon icon="mdi:power-plug-outline"></ha-icon><span class="lname">${shEsc(this._t('power_cycles'))}</span>
        <a class="act quiet" href="/config/integrations/integration/${SH_DOMAIN}"><ha-icon icon="mdi:cog-outline"></ha-icon>${shEsc(this._t('pc_configure'))}</a></div>
      ${rows || `<div class="empty">${shEsc(this._t('pc_none'))}</div>`}</ha-card>`;
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
        shEsc(this._ago(data.last_check)),
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
    var failed = (data.failed || [])
      .map((name) => `<div class="item bad"><ha-icon icon="mdi:alert-circle-outline"></ha-icon><div class="who"><div class="n">${shEsc(name)}</div></div></div>`)
      .join('');
    var notes = [
      data.not_checked ? this._t('not_checked', { n: data.not_checked }) : '',
      Number.isInteger(data.rate_limit_remaining) ? this._t('rate_limit', { n: data.rate_limit_remaining }) : '',
    ].filter(Boolean);
    return `<div class="tiles">${tiles.join('')}</div>${running ? this._progress(data) : ''}${confirm}
      <div class="actions">${this._button('marketplace_check_updates', 'mdi:archive-refresh', this._entityName('button', 'marketplace_check_updates'), {
        disabled: running || data.installing_updates,
      })}
      ${pending.length ? this._button('confirm_install', 'mdi:package-down', this._t('install_all'), { quiet: true, disabled: running || data.installing_updates }) : ''}
      ${this._message('marketplace_check_updates')}${this._message('marketplace_install_updates')}
      ${data.error ? `<span class="msg bad">${shEsc(data.error)}</span>` : ''}</div>
      <ha-card class="list">${rows || `<div class="empty good"><ha-icon icon="mdi:check-circle-outline"></ha-icon>${shEsc(this._t('no_updates'))}</div>`}</ha-card>
      ${
        failed && !running
          ? `<ha-card class="list"><div class="lhead"><ha-icon icon="mdi:alert-circle-outline"></ha-icon><span class="lname">${shEsc(this._t('could_not_check'))}</span><span class="muted">${(data.failed || []).length}</span></div>${failed}</ha-card>`
          : ''
      }
      ${notes.length ? `<div class="notes">${notes.map((n) => `<span class="msg">${shEsc(n)}</span>`).join('')}</div>` : ''}`;
  }

  // The check running: a bar of the repositories checked, the share done, the time left at the pace so far, the
  // failures; a moving bar while the list of repositories is still being read
  _progress(data) {
    var done = data.done ?? 0;
    var total = data.total ?? 0;
    var pct = total ? Math.min(100, Math.round((done * 100) / total)) : null;
    var meta = [];
    if (total) meta.push(this._t('progress', { done, total }));
    var started = data.started_at ? Date.parse(data.started_at) : Number.NaN;
    if (total && done && done < total && !Number.isNaN(started)) {
      var left = ((Date.now() - started) / done) * (total - done);
      meta.push(this._t('remaining', { t: this._duration(left) }));
    }
    var fails = (data.failed || []).length;
    return `<ha-card class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${done}">
      <div class="phead"><ha-icon icon="mdi:archive-sync"></ha-icon><span class="ptitle">${shEsc(this._t('checking'))}</span>${pct === null ? '' : `<span class="ppct">${pct} %</span>`}</div>
      <div class="pbar${pct === null ? ' busy' : ''}"><span style="width:${pct ?? 30}%"></span></div>
      <div class="pmeta">${meta.map((m) => `<span>${shEsc(m)}</span>`).join('')}${fails ? `<span class="bad">${shEsc(this._t('failed_count', { n: fails }))}</span>` : ''}</div>
    </ha-card>`;
  }

  // "45 s", "3 min"
  _duration(ms) {
    var s = Math.max(1, Math.round(ms / 1000));
    return s < 60 ? this._t('sec', { n: s }) : this._t('min', { n: Math.round(s / 60) });
  }

  // Batteries: as the Battery Monitor full screen view — the views, what to replace and the next replacement, then the
  // batteries in groups (by room, by battery type, by replacement date) laid out in columns, or one list by level
  _batteries() {
    var data = this._state.batteries || {};
    var view = this._battView || 'level';
    var all = data.batteries || [];
    // "Hide the batteries that are fine" (Configure → Batteries): only the low and unavailable ones
    var list = data.hide_ok ? all.filter((b) => b.low || b.unavailable) : all;
    var tiles = [
      this._tile('mdi:battery-alert-variant-outline', `<b>${data.low ?? 0}</b>`, this._t('low'), data.low ? 'warn' : 'good'),
      this._tile('mdi:battery-unknown', `<b>${data.unavailable ?? 0}</b>`, this._t('unavailable'), data.unavailable ? 'bad' : 'good'),
      this._tile('mdi:bell-check-outline', shEsc(this._ago(data.last_notification)), this._entityName('sensor', 'batteries_last_notification'), ''),
    ];
    var views = [
      ['level', 'by_level'],
      ['room', 'by_room'],
      ['type', 'by_type'],
      ['forecast', 'by_forecast'],
    ]
      .map(([key, label]) => `<button class="btab${key === view ? ' on' : ''}" data-action="batt_view" data-view="${key}" aria-pressed="${key === view}">${shEsc(this._t(label))}</button>`)
      .join('');
    var groups = this._battGroups(list, view)
      .map((g) => {
        var alerts = g.items.filter(({ b }) => b.low || b.unavailable).length;
        var head = g.name
          ? `<div class="ghead"><ha-icon icon="${g.icon}"></ha-icon><span class="gname">${shEsc(g.name)}</span>
            ${alerts ? `<span class="gchip">${shEsc(this._t('to_check', { n: alerts }))}</span>` : ''}
            <span class="gcount">${shEsc(this._battCount(g))}</span></div>`
          : '';
        return `<section class="bgroup">${head}${g.hint ? `<div class="ghint">${shEsc(g.hint)}</div>` : ''}<div class="glist">${g.items.map((x) => this._battRow(x.b, x.context)).join('')}</div></section>`;
      })
      .join('');
    var body = list.length
      ? `<div class="bgroups${view === 'level' ? ' flat' : ''}">${groups}</div>`
      : `<div class="empty good"><ha-icon icon="mdi:battery-check-outline"></ha-icon>${shEsc(this._t('all_good', { threshold: data.threshold ?? '' }))}</div>`;
    var buy = this._battToReplace(all);
    var next = this._battNext(all);
    return `<div class="tiles">${tiles.join('')}</div>
      <ha-card class="bsheet">
        <div class="btop">
          <div class="btabs" role="group">${views}</div>
          <div class="bline"><span class="rlabel"><ha-icon icon="mdi:cart-outline"></ha-icon>${shEsc(this._t('to_replace'))}</span>${buy || `<span class="none">${shEsc(this._t('nothing_to_replace'))}</span>`}</div>
          ${next}
          <span class="grow"></span>
          ${this._button('batteries_notify', 'mdi:bell-ring-outline', this._entityName('button', 'batteries_notify_now'), { quiet: true })}${this._message('batteries_notify')}
        </div>
        ${body}
      </ha-card>`;
  }

  // One battery as in the Battery Monitor card: its icon in a coloured bubble, its name, what it is and since when it
  // needs attention, its level over a small bar; a low or unavailable one is tinted
  _battRow(b, context) {
    var kind = b.unavailable || b.due ? 'alert' : b.low ? 'warn' : 'ok';
    var level = shNum(b.level);
    var value = b.unavailable ? this._t('unavailable') : level === null ? this._t('low') : `${Math.round(level)} %`;
    var since = b.below_since ? this._battSince(b.below_since, b.unavailable ? 'unavailable_for' : 'low_for') : '';
    var sub = [context, since].filter(Boolean).join(' · ');
    var bar = level === null ? '' : `<span class="track"><span class="bar" style="width:${Math.max(2, Math.min(100, level))}%"></span></span>`;
    return `<button class="brow ${kind}${b.due ? ' due' : ''}" data-more="${shEsc(b.entity_id)}" title="${shEsc(b.name)} — ${shEsc(value)}">
      <span class="ic"><ha-icon icon="${shEsc(b.icon || 'mdi:battery')}"></ha-icon></span>
      <span class="txt"><span class="name">${shEsc(b.name)}</span>${sub ? `<span class="sub">${shEsc(sub)}</span>` : ''}</span>
      <span class="lvl">${shEsc(value)}${bar}</span></button>`;
  }

  // "low for 3 d": "< 1 h" the first hour, hours up to two days, days beyond
  _battSince(iso, key) {
    var h = Math.max(0, (Date.now() - new Date(iso).getTime()) / 3600000);
    var d = h < 1 ? this._t('hours', { n: '< 1' }) : h < 48 ? this._t('hours', { n: Math.floor(h) }) : this._t('days', { n: Math.floor(h / 24) });
    return this._t(key, { d });
  }

  _battCount(g) {
    var n = g.cells ?? g.items.length;
    if (g.cells != null) return this._t(n === 1 ? 'cells_one' : 'cells_many', { n });
    return this._t(n === 1 ? 'count_one' : 'count_many', { n });
  }

  // What to buy: the types of the batteries needing attention, with how many of each
  _battToReplace(list) {
    var need = new Map();
    list
      .filter((b) => b.low || b.unavailable)
      .forEach((b) => {
        var m = /^(\d+)\s*[×x]\s*(.+)$/i.exec(b.battery_type || '');
        var key = m ? m[2] : b.battery_type || '';
        need.set(key, (need.get(key) || 0) + (m ? Number(m[1]) : 1));
      });
    return [...need.entries()]
      .sort((a, b) => !a[0] - !b[0] || b[1] - a[1])
      .map(([type, n]) => `<span class="buy${type ? '' : ' unknown'}"><b>${n}×</b> ${shEsc(type ? this._battTypeName(type) : this._t('unknown_type'))}</span>`)
      .join('');
  }

  // The next battery to replace by its forecast, with its date
  _battNext(list) {
    var next = list.filter((b) => !b.low && !b.unavailable && Number.isInteger(b.days_left)).sort((a, b) => a.days_left - b.days_left)[0];
    if (!next) return '';
    var when = next.replace_by ? this._battDate(next.replace_by) : this._t('forecast', { d: this._t('days', { n: next.days_left }) });
    return `<div class="bline"><span class="rlabel"><ha-icon icon="mdi:calendar-clock"></ha-icon>${shEsc(this._t('next_replacement'))}</span>
      <button class="nextb" data-more="${shEsc(next.entity_id)}"><b>${shEsc(next.name)}</b> · ${shEsc(when)}</button></div>`;
  }

  // A room's own icon, set in its area settings (no room: a house)
  _areaIcon(name) {
    if (!name) return 'mdi:home-outline';
    var area = Object.values(this._hass?.areas || {}).find((a) => a?.name === name);
    return area?.icon || 'mdi:door-open';
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
      var m = /^(\d+)\s*[×x]/.exec(b.battery_type || '');
      var cells = m ? Number(m[1]) : 1;
      var count = view === 'type' && b.battery_type && b.battery_type !== 'rechargeable' ? this._t(cells === 1 ? 'cells_one' : 'cells_many', { n: cells }) : '';
      var context = view === 'room' ? this._battTypeName(b.battery_type || '') : [b.area, count].filter(Boolean).join(' · ');
      map.get(key).push({ b, context, cells });
    });
    return [...map.entries()]
      .map(([key, items]) => ({
        key,
        items,
        name: key ? (view === 'type' ? this._battTypeName(key) : key) : this._t(view === 'room' ? 'no_area' : 'unknown_type'),
        icon: view === 'room' ? this._areaIcon(key) : key ? 'mdi:battery-outline' : 'mdi:battery-unknown',
        hint: view === 'type' && !key ? this._t('unknown_type_hint') : '',
        // By type, the batteries of that type in all (a remote with 2 AAA counts 2)
        cells: view === 'type' && key && key !== 'rechargeable' ? items.reduce((n, x) => n + x.cells, 0) : null,
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
    if (action === 'period') {
      this._periods[button.dataset.chart] = Number(button.dataset.hours);
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
