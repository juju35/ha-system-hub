// Settings → Hide the top bar, as last seen in this browser: applied before the state is read
import { shErr, shEsc } from "./core.js";
import { SH_TONE_HEX } from "./illustrated-header.js";

export var SH_HIDE_BAR_KEY = 'system_hub_hide_bar';
// The System tab's shortcuts, in their order: the panels that open them (the first one in Home Assistant) and, for a
// page inside one, its path (#133, #144); the ones shown until a choice is saved in Settings → Display
export var SH_SHORTCUTS = {
  file_editor: { panels: ['core_configurator', 'a0d7b954_vscode'], icon: 'mdi:file-document-edit-outline' },
  marketplace: { panels: ['marketplace'], icon: 'mdi:storefront-outline' },
  settings: { panels: ['config'], path: '/config/dashboard', icon: 'mdi:cog' },
  integrations: { panels: ['config'], path: '/config/integrations/dashboard', icon: 'mdi:puzzle-outline' },
  logs: { panels: ['config'], path: '/config/logs', icon: 'mdi:math-log' },
  developer_tools: { panels: ['developer-tools'], path: '/developer-tools/state', icon: 'mdi:hammer' },
};
export var SH_DEFAULT_SHORTCUTS = ['file_editor', 'marketplace', 'settings'];
// The System tab's buttons, in their order, with their icon; all of them until a choice is saved in Settings → Display
// (#146); the reboot with the Supervisor only
export var SH_BUTTONS = { reload: 'mdi:reload', restart: 'mdi:restart', reboot: 'mdi:power-cycle' };

// Status letter and colour of a file in the diff viewer, as in an editor's source control view.
export var SH_DIFF_STATUS = {
  added: { letter: 'A', key: 'diff_added', color: 'var(--sh-ok)' },
  modified: { letter: 'M', key: 'diff_modified', color: 'var(--sh-warn)' },
  deleted: { letter: 'D', key: 'diff_deleted', color: 'var(--sh-alert)' },
  renamed: { letter: 'R', key: 'diff_renamed', color: 'var(--sh-info)' },
  copied: { letter: 'C', key: 'diff_added', color: 'var(--sh-info)' },
  mode: { letter: 'T', key: 'diff_mode', color: 'var(--sh-off)' },
};

// "config/packages/lights.yaml" → ["lights.yaml", "config/packages"].
export var shSplitPath = (path) => {
  const i = String(path || '').lastIndexOf('/');
  return i < 0 ? [path, ''] : [path.slice(i + 1), path.slice(0, i)];
};


// The diff viewer of Git Sync, as in an editor's source control view: Versioning's illustrated banner, the counts as
// tiles, the files and the selected file's diff, then the commit message, Write with AI and Commit and push
export class SystemHubDiffDialog extends HTMLElement {
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
        return;
      }
      if (ev.key !== 'ArrowDown' && ev.key !== 'ArrowUp') return;
      // The event comes retargeted to this element: its first target tells the diff or the message field apart
      var el = ev.composedPath?.()[0] || ev.target;
      if (el?.closest?.('.d-main, input')) return;
      const files = this._diff?.files || [];
      if (!files.length) return;
      ev.preventDefault();
      this._select((this._selected + (ev.key === 'ArrowDown' ? 1 : files.length - 1)) % files.length);
    };
  }

  // Opens the viewer: `request` fetches the diff; `banner(diff)` draws the header; `generate` (optional) writes a
  // commit message; `onCommit(message)` (optional) adds the message field and Commit and push.
  async open({ t, locale, branch, commitLabel, lastPush, message, style, banner, request, generate, onCommit }) {
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    this._tr = t;
    this._commitLabel = commitLabel;
    this._locale = locale;
    this._branch = branch;
    this._lastPush = lastPush;
    this._message = message || '';
    this._style = style || '';
    this._bannerFn = banner;
    this._generate = generate;
    this._onCommit = onCommit;
    this._generating = false;
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
      this._error = shErr(err);
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

  _counts(file) {
    return `<span class="d-counts">${file.additions ? `<span class="d-add">+${this._fmt(file.additions)}</span>` : ''}${
      file.deletions ? `<span class="d-del">−${this._fmt(file.deletions)}</span>` : ''
    }</span>`;
  }

  _fileItem(file, index) {
    const st = SH_DIFF_STATUS[file.status] || SH_DIFF_STATUS.modified;
    const [name, dir] = shSplitPath(file.path);
    const label = this._t(st.key);
    return `<button class="d-file${index === this._selected ? ' selected' : ''}" data-i="${index}" role="option" aria-selected="${index === this._selected}"
        title="${shEsc(file.path)}">
      <span class="d-st" style="--c:${st.color}" title="${shEsc(label)}" aria-label="${shEsc(label)}">${st.letter}</span>
      <span class="d-name"><span class="d-base">${shEsc(name)}</span>${dir ? `<span class="d-dir">${shEsc(dir)}</span>` : ''}</span>
      ${this._counts(file)}
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
        <span class="d-st" style="--c:${st.color}" title="${shEsc(this._t(st.key))}">${st.letter}</span>
        <span class="d-path">${rename}<span>${shEsc(file.path)}</span></span>
        ${this._counts(file)}
      </div><div class="d-code">${body}</div>`;
  }

  // A tile of the charter: its round icon in its tone, the value, the label under it
  _tile(icon, value, label, tone) {
    return `<div class="d-tile ${tone}"><span class="d-av"><ha-icon icon="${icon}"></ha-icon></span>
      <span class="d-who"><b>${value}</b><span>${shEsc(label)}</span></span></div>`;
  }

  _render() {
    if (!this.shadowRoot) return;
    if (!this._open) {
      this.shadowRoot.innerHTML = '';
      return;
    }
    const diff = this._diff;
    const files = diff?.files || [];
    const total = files.length + (diff?.more_files || 0);
    const selected = files[this._selected];
    const title = this._t('diff_title', { branch: this._branch || 'HEAD' });
    let main;
    if (this._loading) main = `<div class="d-note d-center"><ha-icon class="spin" icon="mdi:loading"></ha-icon>${shEsc(this._t('diff_loading'))}</div>`;
    else if (this._error) main = `<div class="d-note d-center d-error">${shEsc(this._t('failed', { error: this._error }))}</div>`;
    else if (!files.length) main = `<div class="d-note d-center">${shEsc(this._t('diff_empty'))}</div>`;
    else main = this._fileView(selected);
    const close = `<button class="shzoom" id="close" title="${shEsc(this._t('diff_close'))}" aria-label="${shEsc(this._t('diff_close'))}"><ha-icon icon="mdi:close"></ha-icon></button>`;
    const pill = files.length ? this._t(total === 1 ? 'diff_files_one' : 'diff_files_many', { n: this._fmt(total) }) : '';
    const banner = this._bannerFn?.({ title, pill, buttons: close }) || '';
    const tiles = files.length
      ? `<div class="d-tiles">
          ${this._tile('mdi:file-document-edit-outline', this._fmt(total), this._t('changed'), 'warn')}
          ${this._tile('mdi:plus', this._fmt(diff.additions || 0), this._t('diff_lines_added'), diff.additions ? 'good' : '')}
          ${this._tile('mdi:minus', this._fmt(diff.deletions || 0), this._t('diff_lines_deleted'), diff.deletions ? 'bad' : '')}
          ${this._lastPush ? this._tile('mdi:cloud-check-outline', shEsc(this._lastPush.value), this._lastPush.label, '') : ''}
        </div>`
      : '';
    const list = files.length
      ? `<div class="d-side"><div class="d-lt">${shEsc(this._t('changed'))}</div>
          <div class="d-list" role="listbox" aria-label="${shEsc(this._t('changed'))}">${files.map((f, i) => this._fileItem(f, i)).join('')}${
            diff.more_files ? `<div class="d-more">${shEsc(this._t('diff_more_files', { n: this._fmt(diff.more_files) }))}</div>` : ''
          }</div></div>`
      : '';
    const commit = this._onCommit && files.length;
    const foot = commit
      ? `<label class="d-msg"><input id="message" placeholder="${shEsc(this._t('message'))}" aria-label="${shEsc(this._t('message'))}" value="${shEsc(this._message)}"></label>
        ${this._generate ? `<button class="d-btn" id="generate"${this._generating ? ' disabled' : ''}><ha-icon class="${this._generating ? 'spin' : ''}" icon="${this._generating ? 'mdi:loading' : 'mdi:creation-outline'}"></ha-icon><span>${shEsc(this._t('generate'))}</span></button>` : ''}
        <button class="d-btn primary" id="commit"><ha-icon icon="mdi:source-commit-end"></ha-icon><span>${shEsc(this._commitLabel)}</span></button>`
      : `<span class="grow"></span><button class="d-btn" id="close2"><ha-icon icon="mdi:close"></ha-icon><span>${shEsc(this._t('diff_close'))}</span></button>`;
    this.shadowRoot.innerHTML = `<style>${this._style}${this._css()}</style>
      <div class="d-backdrop"></div>
      <div class="d-dialog" role="dialog" aria-modal="true" aria-label="${shEsc(title)}">
        <div class="d-top">${banner}</div>
        ${tiles}
        <div class="d-body${files.length ? '' : ' alone'}">
          ${list}
          <div class="d-main" tabindex="0">${main}</div>
        </div>
        <div class="d-foot${commit ? ' commit' : ''}">${foot}</div>
      </div>`;
    this._bind();
  }

  _bind() {
    const root = this.shadowRoot;
    const on = (sel, fn) => root.querySelector(sel)?.addEventListener('click', fn);
    on('.d-backdrop', () => this.close());
    on('#close', () => this.close());
    on('#close2', () => this.close());
    root.querySelector('#message')?.addEventListener('input', (ev) => {
      this._message = ev.target.value;
    });
    on('#generate', async () => {
      if (this._generating) return;
      this._generating = true;
      this._render();
      try {
        const message = await this._generate();
        if (message) this._message = message;
      } finally {
        this._generating = false;
        if (this._open) {
          this._render();
          root.querySelector('#message')?.focus?.({ preventScroll: true });
        }
      }
    });
    on('#commit', () => {
      const cb = this._onCommit;
      const message = this._message;
      this.close();
      cb?.(message);
    });
    root.querySelector('.d-list')?.addEventListener('click', (ev) => {
      const item = ev.target?.closest?.('.d-file');
      if (item) this._select(Number(item.dataset.i));
    });
  }

  _css() {
    return `
      ha-icon { display:inline-flex; align-items:center; justify-content:center; flex:none; line-height:0; }
      :host { --sh-ok: var(--success-color, #43a047); --sh-warn: var(--warning-color, #ffa600);
              --sh-info: var(--info-color, #039be5); --sh-alert: var(--error-color, #db4437);
              --sh-off: var(--disabled-text-color, #9e9e9e); --sh-accent: var(--primary-color, #03a9f4);
              --sh-mono: var(--code-font-family, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
              --sh-bg: var(--card-background-color, var(--ha-card-background, #fff));
              --sh-sec: color-mix(in srgb, var(--primary-text-color) 6%, var(--sh-bg));
              --sh-line: var(--divider-color, rgba(127,127,127,.2)); }
      /* The banner's and the tiles' tones, as the panel's */
      .good { --tone: ${SH_TONE_HEX.good}; } .warn { --tone: ${SH_TONE_HEX.warn}; } .bad { --tone: ${SH_TONE_HEX.bad}; } .info { --tone: ${SH_TONE_HEX.info}; }
      .d-backdrop { position: fixed; inset: 0; z-index: 1000; background: rgba(0,0,0,.45); backdrop-filter: blur(2px); }
      /* Full screen on a phone; a large centred window elsewhere. */
      .d-dialog { position: fixed; inset: 0; z-index: 1001; display: flex; flex-direction: column; min-height: 0; overflow: hidden;
                  background: var(--sh-bg); color: var(--primary-text-color); font-family: var(--paper-font-body1_-_font-family, inherit); }
      @media (min-width: 900px) and (min-height: 600px) {
        .d-dialog { inset: 24px; max-width: 1280px; margin: 0 auto; border-radius: 16px; box-shadow: 0 12px 40px rgba(0,0,0,.35); }
      }
      .d-top { flex: none; }
      .shzooms { position: absolute; z-index: 2; top: 8px; right: 8px; display: flex; gap: 5px; }
      .shzoom { appearance: none; border: 0; padding: 0; cursor: pointer; width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center;
                --mdc-icon-size: 18px; color: #33506b; background: rgba(255,255,255,.62); box-shadow: inset 0 0 0 1px rgba(255,255,255,.7); }
      .shzoom:hover { background: rgba(255,255,255,.8); }
      .night .shzoom { color: #fff; background: rgba(255,255,255,.12); box-shadow: inset 0 0 0 1px rgba(255,255,255,.2); }
      .shzoom:focus-visible, .d-btn:focus-visible, .d-file:focus-visible { outline: 2px solid var(--sh-accent); outline-offset: 1px; }

      /* The counts: tiles of the charter, filled and rounded, their icon neutral unless it says something */
      .d-tiles { flex: none; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; padding: 12px 16px 0; }
      .d-tile { display: flex; align-items: center; gap: 10px; min-width: 0; min-height: 56px; box-sizing: border-box; padding: 8px 10px 8px 8px;
                border-radius: 12px; background: var(--sh-sec); }
      .d-av { flex: none; width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; --mdc-icon-size: 22px;
              color: var(--primary-text-color); background: color-mix(in srgb, var(--secondary-text-color) 14%, transparent); }
      .d-tile:is(.good, .warn, .bad) .d-av { color: color-mix(in srgb, var(--tone) 70%, var(--primary-text-color)); background: color-mix(in srgb, var(--tone) 18%, transparent); }
      .d-who { min-width: 0; display: flex; flex-direction: column; line-height: 1.25; }
      .d-who b { font-size: 20px; font-weight: 400; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .d-tile:is(.good, .warn, .bad) .d-who b { color: color-mix(in srgb, var(--tone) 70%, var(--primary-text-color)); }
      .d-who span { font-size: 12px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

      .d-body { flex: 1 1 auto; min-height: 0; display: flex; gap: 12px; padding: 12px 16px 0; }
      .d-body.alone .d-main { width: 100%; }
      /* Files: a column on the left; on a narrow screen, a row of chips above the diff. */
      .d-side { flex: none; width: 290px; min-height: 0; display: flex; flex-direction: column; gap: 6px; }
      .d-lt { flex: none; min-height: 24px; padding: 0 4px; display: flex; align-items: center; font-size: 12px; font-weight: 500;
              letter-spacing: .05em; text-transform: uppercase; color: var(--secondary-text-color); }
      .d-list { flex: 1 1 auto; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; }
      .d-file { display: flex; align-items: center; gap: 10px; width: 100%; min-width: 0; min-height: 52px; box-sizing: border-box; padding: 6px 10px 6px 7px;
                border: 1px solid transparent; border-radius: 12px; cursor: pointer; text-align: left; font: inherit; font-size: 13.5px;
                color: var(--primary-text-color); background: var(--sh-sec); }
      .d-file:hover { background: color-mix(in srgb, ${SH_TONE_HEX.warn} 8%, var(--sh-sec)); }
      .d-file.selected { background: color-mix(in srgb, ${SH_TONE_HEX.warn} 12%, var(--sh-sec)); border-color: color-mix(in srgb, ${SH_TONE_HEX.warn} 40%, transparent); }
      .d-st { flex: none; width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; font-family: var(--sh-mono);
              font-size: 12px; font-weight: 700; color: var(--c); background: color-mix(in srgb, var(--c) 18%, transparent); }
      .d-head .d-st { width: 28px; height: 28px; }
      .d-name { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; line-height: 17px; }
      .d-base { font-family: var(--sh-mono); font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .d-dir { font-size: 12px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; direction: rtl; text-align: left; }
      .d-counts { flex: none; display: inline-flex; gap: 6px; font-family: var(--sh-mono); font-size: 12px; }
      .d-add { color: var(--sh-ok); }
      .d-del { color: var(--sh-alert); }
      .d-more { padding: 8px; font-size: 12px; color: var(--secondary-text-color); }

      /* The selected file's diff, in a filled panel: its header strip, then the code on the card's background */
      .d-main { flex: 1 1 auto; min-width: 0; overflow: auto; outline: none; border-radius: 12px; background: var(--sh-sec); }
      .d-head { position: sticky; top: 0; z-index: 1; display: flex; align-items: center; gap: 10px; padding: 8px 12px 8px 8px; font-size: 13px;
                background: color-mix(in srgb, var(--primary-text-color) 9%, var(--sh-bg)); }
      .d-code { margin: 0 1px 1px; border-radius: 0 0 11px 11px; background: var(--sh-bg); min-height: calc(100% - 46px); }
      .d-path { flex: 1 1 auto; min-width: 0; display: flex; align-items: center; gap: 6px; font-family: var(--sh-mono); font-size: 13px;
                white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .d-path ha-icon { --mdc-icon-size: 14px; color: var(--secondary-text-color); }
      .d-old { color: var(--secondary-text-color); }
      .d-note { display: flex; align-items: center; gap: 8px; padding: 16px; font-size: 13px; color: var(--secondary-text-color); }
      .d-note.d-center { justify-content: center; padding: 48px 16px; }
      .d-note.d-error { color: var(--sh-alert); }
      .d-note ha-icon { --mdc-icon-size: 20px; }
      .spin { animation: sh-spin 1s linear infinite; }

      /* The diff itself: old and new line numbers, sign, text; additions tinted green, deletions red. */
      .d-table { width: 100%; border-collapse: collapse; font-family: var(--sh-mono); font-size: 12.5px; line-height: 21px; tab-size: 4; }
      .d-table td { padding: 0 8px; vertical-align: top; white-space: pre; }
      .d-table .ln { width: 1%; min-width: 3.5ch; text-align: right; color: var(--secondary-text-color); opacity: .8; user-select: none; }
      .d-table .sg { width: 1%; padding: 0 4px; user-select: none; }
      .d-table .tx { white-space: pre-wrap; word-break: break-all; }
      .d-table tr.add td { background: color-mix(in srgb, var(--sh-ok) 12%, transparent); }
      .d-table tr.add .ln, .d-table tr.add .sg { color: var(--sh-ok); opacity: 1; }
      .d-table tr.del td { background: color-mix(in srgb, var(--sh-alert) 11%, transparent); }
      .d-table tr.del .ln, .d-table tr.del .sg { color: var(--sh-alert); opacity: 1; }
      .d-table tr.hunk td { color: var(--sh-info); background: color-mix(in srgb, var(--sh-info) 7%, transparent); }

      /* The commit: the message as a filled pill field, Write with AI, Commit and push (pill buttons, none filled) */
      .d-foot { flex: none; display: flex; align-items: center; gap: 8px; padding: 12px 16px 16px; }
      .d-foot .grow { flex: 1; }
      .d-msg { flex: 1 1 auto; min-width: 0; display: flex; }
      .d-msg input { flex: 1; min-width: 0; min-height: 40px; box-sizing: border-box; padding: 0 18px; border: 1px solid transparent; border-radius: 20px;
                     font: inherit; font-size: 14px; color: var(--primary-text-color); background: var(--sh-sec); outline: none; }
      .d-msg input:focus { border-color: color-mix(in srgb, var(--sh-accent) 55%, transparent); }
      .d-btn { flex: none; display: inline-flex; align-items: center; gap: 7px; min-height: 40px; padding: 0 16px; border: 0; border-radius: 20px; cursor: pointer;
               font: inherit; font-size: 14px; font-weight: 500; color: var(--primary-text-color); background: var(--sh-sec); white-space: nowrap; }
      .d-btn:hover { background: color-mix(in srgb, var(--sh-accent) 10%, var(--sh-sec)); }
      .d-btn[disabled] { cursor: default; opacity: .7; }
      .d-btn.primary { color: color-mix(in srgb, var(--sh-accent) 75%, var(--primary-text-color)); background: color-mix(in srgb, var(--sh-accent) 16%, transparent); }
      .d-btn.primary:hover { background: color-mix(in srgb, var(--sh-accent) 24%, transparent); }
      .d-btn ha-icon { --mdc-icon-size: 18px; }

      @media (max-width: 719px) {
        .d-tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); padding: 10px 12px 0; }
        .d-body { flex-direction: column; gap: 10px; padding: 10px 12px 0; }
        .d-side { width: auto; flex: none; }
        .d-lt { display: none; }
        .d-list { flex-direction: row; flex-wrap: nowrap; overflow-x: auto; overflow-y: hidden; }
        .d-file { width: auto; flex: none; max-width: 220px; min-height: 40px; padding: 4px 12px 4px 4px; }
        .d-file .d-st { width: 28px; height: 28px; }
        .d-dir, .d-file .d-counts { display: none; }
        .d-more { white-space: nowrap; align-self: center; }
        .d-foot { padding: 12px; }
        .d-foot.commit { flex-wrap: wrap; }
        .d-foot.commit .d-msg { flex-basis: calc(100% - 48px); }
        .d-foot.commit #generate { width: 40px; padding: 0; justify-content: center; }
        .d-foot.commit #generate span { display: none; }
        .d-foot.commit #commit { flex: 1 1 100%; justify-content: center; }
      }
      @keyframes sh-spin { to { transform: rotate(360deg); } }
      @media (prefers-reduced-motion: reduce) { .spin { animation: none; } }
    `;
  }
}
