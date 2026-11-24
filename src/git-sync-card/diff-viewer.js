// ── Diff viewer ──────────────────────────────────────────────────────────────
// A full-screen dialog showing the changes a commit would include, file by file, like an editor's diff view:
// the files on the left (status letter, name, added and removed lines), the selected file's hunks on the right
// with the line numbers of both sides. It lives in document.body, so that no card, section or transform clips it.
// jscpd:ignore-start (the panel's own copy of the diff viewer: a dashboard card loads without the panel)
import { GS_DIFF_STATUS, gsEsc, gsN, gsSplitPath, gsT } from "./i18n-helpers.js";

export class GitSyncDiffDialog extends HTMLElement {
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
  async open({ lang, locale, branch, request, onCommit }) {
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    this._lang = lang;
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
    return gsT(this._lang, key, vars);
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
    } catch {
      return String(n);
    }
  }

  _fileItem(file, index) {
    const st = GS_DIFF_STATUS[file.status] || GS_DIFF_STATUS.modified;
    const [name, dir] = gsSplitPath(file.path);
    const label = this._t(st.key);
    return `<button class="d-file${index === this._selected ? ' selected' : ''}" data-i="${index}" role="option" aria-selected="${index === this._selected}"
        title="${gsEsc(file.path)}">
      <span class="d-st" style="--c:${st.color}" title="${gsEsc(label)}" aria-label="${gsEsc(label)}">${st.letter}</span>
      <span class="d-name"><span class="d-base">${gsEsc(name)}</span>${dir ? `<span class="d-dir">${gsEsc(dir)}</span>` : ''}</span>
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
        return `<tr class="${cls}"><td class="ln">${line.old ?? ''}</td><td class="ln">${line.new ?? ''}</td><td class="sg">${sign}</td><td class="tx">${gsEsc(line.text)}</td></tr>`;
      })
      .join('');
    return `<tr class="hunk"><td class="ln"></td><td class="ln"></td><td class="sg"></td><td class="tx">${gsEsc(hunk.header)}</td></tr>${rows}`;
  }

  _fileView(file) {
    const st = GS_DIFF_STATUS[file.status] || GS_DIFF_STATUS.modified;
    const rename = file.old_path ? `<span class="d-old">${gsEsc(file.old_path)}</span><ha-icon icon="mdi:arrow-right"></ha-icon>` : '';
    let body;
    if (file.binary) body = `<div class="d-note"><ha-icon icon="mdi:file-outline"></ha-icon>${gsEsc(this._t('diff_binary'))}</div>`;
    else if (!file.hunks.length) body = `<div class="d-note">${gsEsc(this._t(st.key))}</div>`;
    else {
      body = `<table class="d-table" aria-label="${gsEsc(file.path)}"><tbody>${file.hunks.map((h) => this._hunk(h)).join('')}</tbody></table>`;
      if (file.truncated) body += `<div class="d-note">${gsEsc(this._t('diff_truncated', { n: this._fmt(file.truncated) }))}</div>`;
    }
    return `<div class="d-head">
        <span class="d-st big" style="--c:${st.color}" title="${gsEsc(this._t(st.key))}">${st.letter}</span>
        <span class="d-path">${rename}<span>${gsEsc(file.path)}</span></span>
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
    if (this._loading) main = `<div class="d-note d-center"><ha-icon class="spin" icon="mdi:loading"></ha-icon>${gsEsc(this._t('diff_loading'))}</div>`;
    else if (this._error) main = `<div class="d-note d-center d-error">${gsEsc(this._t('failed', { e: this._error }))}</div>`;
    else if (!files.length) main = `<div class="d-note d-center">${gsEsc(this._t('diff_empty'))}</div>`;
    else {
      main = this._fileView(selected);
      summary = `${gsEsc(gsN(this._lang, 'files', files.length + (diff.more_files || 0)))} · <span class="d-add">+${this._fmt(diff.additions)}</span> <span class="d-del">−${this._fmt(diff.deletions)}</span>`;
    }
    const list = files.length
      ? `<div class="d-list" role="listbox" aria-label="${gsEsc(this._t('changed_files'))}">${files.map((f, i) => this._fileItem(f, i)).join('')}${
          diff.more_files ? `<div class="d-more">${gsEsc(this._t('diff_more_files', { n: this._fmt(diff.more_files) }))}</div>` : ''
        }</div>`
      : '';
    const commit = this._onCommit && files.length
      ? `<button class="d-btn primary" id="commit"><ha-icon icon="mdi:source-commit-end"></ha-icon>${gsEsc(this._t('commit'))}</button>`
      : '';
    this.shadowRoot.innerHTML = `<style>${this._css()}</style>
      <div class="d-backdrop"></div>
      <div class="d-dialog" role="dialog" aria-modal="true" aria-label="${gsEsc(this._t('diff_title', { branch: this._branch || 'HEAD' }))}">
        <div class="d-top">
          <div class="badge"><ha-icon icon="mdi:file-compare"></ha-icon></div>
          <div class="d-titles">
            <div class="d-title">${gsEsc(this._t('diff_title', { branch: this._branch || 'HEAD' }))}</div>
            <div class="d-sub">${summary}</div>
          </div>
          <button class="d-x" id="close" title="${gsEsc(this._t('close'))}" aria-label="${gsEsc(this._t('close'))}"><ha-icon icon="mdi:close"></ha-icon></button>
        </div>
        <div class="d-body${files.length ? '' : ' alone'}">
          ${list}
          <div class="d-main" tabindex="0">${main}</div>
        </div>
        <div class="d-foot">
          <button class="d-btn" id="close2"><ha-icon icon="mdi:close"></ha-icon>${gsEsc(this._t('close'))}</button>
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
      :host { --gs-ok: var(--success-color, #43a047); --gs-warn: var(--warning-color, #ffa600);
              --gs-info: var(--info-color, #039be5); --gs-alert: var(--error-color, #db4437);
              --gs-off: var(--disabled-text-color, #9e9e9e); --gs-accent: var(--primary-color, #03a9f4);
              --gs-mono: var(--code-font-family, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
              --gs-bg: var(--card-background-color, var(--ha-card-background, #fff));
              --gs-line: var(--divider-color, rgba(127,127,127,.2)); }
      .d-backdrop { position: fixed; inset: 0; z-index: 1000; background: rgba(0,0,0,.45); backdrop-filter: blur(2px); }
      /* Full screen on a phone; a large centred window elsewhere. */
      .d-dialog { position: fixed; inset: 0; z-index: 1001; display: flex; flex-direction: column; min-height: 0;
                  background: var(--gs-bg); color: var(--primary-text-color); font-family: var(--paper-font-body1_-_font-family, inherit); }
      @media (min-width: 900px) and (min-height: 600px) {
        .d-dialog { inset: 24px; max-width: 1280px; margin: 0 auto; border-radius: 16px;
                    box-shadow: 0 12px 40px rgba(0,0,0,.35); border: 1px solid var(--gs-line); }
      }
      .d-top { flex: none; display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--gs-line); }
      .badge { flex: none; width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center;
               color: var(--gs-accent); background: color-mix(in srgb, var(--gs-accent) 18%, transparent); }
      .badge ha-icon { --mdc-icon-size: 24px; }
      .d-titles { flex: 1 1 auto; min-width: 0; }
      .d-title { font-size: 16px; font-weight: 500; line-height: 22px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .d-sub { font-size: 12px; line-height: 16px; color: var(--secondary-text-color); }
      .d-x { flex: none; width: 36px; height: 36px; border: none; border-radius: 50%; padding: 0; display: grid; place-items: center;
             cursor: pointer; background: transparent; color: var(--secondary-text-color); }
      .d-x:hover { background: color-mix(in srgb, var(--secondary-text-color) 16%, transparent); color: var(--primary-text-color); }
      .d-x:focus-visible, .d-btn:focus-visible, .d-file:focus-visible { outline: 2px solid var(--gs-accent); outline-offset: 1px; }

      .d-body { flex: 1 1 auto; min-height: 0; display: flex; }
      .d-body.alone .d-main { width: 100%; }
      /* Files: a column on the left; on a narrow screen, a row of chips above the diff. */
      .d-list { flex: none; width: 280px; overflow-y: auto; border-right: 1px solid var(--gs-line); padding: 6px; display: flex; flex-direction: column; gap: 2px;
                background: var(--secondary-background-color, color-mix(in srgb, var(--primary-text-color) 4%, transparent)); }
      .d-file { display: flex; align-items: center; gap: 8px; width: 100%; min-width: 0; padding: 6px 8px; border: none; border-radius: 8px;
                cursor: pointer; text-align: left; font: inherit; font-size: 13px; color: var(--primary-text-color); background: transparent; }
      .d-file:hover { background: color-mix(in srgb, var(--gs-accent) 8%, transparent); }
      .d-file.selected { background: color-mix(in srgb, var(--gs-accent) 16%, transparent); }
      .d-st { flex: none; width: 20px; height: 20px; border-radius: 5px; display: grid; place-items: center; font-family: var(--gs-mono);
              font-size: 11px; font-weight: 700; color: var(--c); background: color-mix(in srgb, var(--c) 18%, transparent); }
      .d-st.big { width: 24px; height: 24px; font-size: 12px; }
      .d-name { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; line-height: 16px; }
      .d-base { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .d-dir { font-size: 11px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; direction: rtl; text-align: left; }
      .d-counts { flex: none; display: inline-flex; gap: 6px; font-family: var(--gs-mono); font-size: 11px; }
      .d-add { color: var(--gs-ok); }
      .d-del { color: var(--gs-alert); }
      .d-more { padding: 8px; font-size: 12px; color: var(--secondary-text-color); }
      @media (max-width: 719px) {
        .d-body { flex-direction: column; }
        .d-list { width: auto; max-height: 34%; flex-direction: row; flex-wrap: nowrap; overflow-x: auto; overflow-y: hidden;
                  border-right: none; border-bottom: 1px solid var(--gs-line); }
        .d-file { width: auto; flex: none; max-width: 220px; }
        .d-dir { display: none; }
        .d-more { white-space: nowrap; align-self: center; }
      }

      .d-main { flex: 1 1 auto; min-width: 0; overflow: auto; outline: none; }
      .d-head { position: sticky; top: 0; z-index: 1; display: flex; align-items: center; gap: 10px; padding: 8px 12px; font-size: 13px;
                background: var(--gs-bg); border-bottom: 1px solid var(--gs-line); }
      .d-path { flex: 1 1 auto; min-width: 0; display: flex; align-items: center; gap: 6px; font-family: var(--gs-mono); font-size: 12px;
                white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .d-path ha-icon { --mdc-icon-size: 14px; color: var(--secondary-text-color); }
      .d-old { color: var(--secondary-text-color); }
      .d-note { display: flex; align-items: center; gap: 8px; padding: 16px; font-size: 13px; color: var(--secondary-text-color); }
      .d-note.d-center { justify-content: center; padding: 48px 16px; }
      .d-note.d-error { color: var(--gs-alert); }
      .d-note ha-icon { --mdc-icon-size: 20px; }
      .spin { animation: gs-spin 1s linear infinite; }

      /* The diff itself: old and new line numbers, sign, text; additions tinted green, deletions red. */
      .d-table { width: 100%; border-collapse: collapse; font-family: var(--gs-mono); font-size: 12px; line-height: 20px; tab-size: 4; }
      .d-table td { padding: 0 6px; vertical-align: top; white-space: pre; }
      .d-table .ln { width: 1%; min-width: 3.5ch; text-align: right; color: var(--secondary-text-color); opacity: .7; user-select: none;
                     background: color-mix(in srgb, var(--primary-text-color) 3%, transparent); }
      .d-table .sg { width: 1%; padding: 0 4px; user-select: none; }
      .d-table .tx { white-space: pre-wrap; word-break: break-all; }
      .d-table tr.add td { background: color-mix(in srgb, var(--gs-ok) 14%, transparent); }
      .d-table tr.add .ln, .d-table tr.add .sg { color: var(--gs-ok); opacity: 1; }
      .d-table tr.del td { background: color-mix(in srgb, var(--gs-alert) 14%, transparent); }
      .d-table tr.del .ln, .d-table tr.del .sg { color: var(--gs-alert); opacity: 1; }
      .d-table tr.hunk td { color: var(--gs-info); background: color-mix(in srgb, var(--gs-info) 8%, transparent); }

      .d-foot { flex: none; display: flex; justify-content: flex-end; gap: 8px; padding: 10px 16px; border-top: 1px solid var(--gs-line); }
      .d-btn { display: inline-flex; align-items: center; gap: 6px; min-height: 38px; padding: 4px 14px; border-radius: 10px; cursor: pointer;
               font: inherit; font-size: 14px; font-weight: 500; color: var(--secondary-text-color); background: transparent;
               border: 1px solid color-mix(in srgb, var(--secondary-text-color) 35%, transparent); }
      .d-btn.primary { color: var(--gs-accent); border-color: color-mix(in srgb, var(--gs-accent) 45%, transparent); }
      .d-btn:hover { background: color-mix(in srgb, var(--gs-accent) 10%, transparent); }
      .d-btn ha-icon { --mdc-icon-size: 18px; }
      @keyframes gs-spin { to { transform: rotate(360deg); } }
      @media (prefers-reduced-motion: reduce) { .spin { animation: none; } }
    `;
  }
}
// jscpd:ignore-end
