import { GS_DOMAIN, GS_PREFIX } from "./core.js";
import { GS_DEFAULTS, GS_FILES_SHOWN, GS_PILL, GS_STATUSES, gsDevices, gsEsc, gsHoldUnderPress, gsInDialog, gsKeepsFocus, gsLang, gsLocale, gsMinutes, gsN, gsPullable, gsRepo, gsT, gsWatchOutside } from "./i18n-helpers.js";
import { shBanner, shbIsNight } from "./illustrated-header.js";

export class GitSyncCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement('sh-git-sync-card-editor');
  }

  static getStubConfig() {
    return {};
  }

  constructor() {
    super();
    this._filesOpen = false;
    this._confirm = false;
    this._busy = null;
    this._draft = '';
    this._generating = false;
    // A click elsewhere folds the changed files (and brings the mini card back to its compact view).
    this._outside = gsWatchOutside(
      (ev) => !ev.composedPath?.().includes(this) && !gsInDialog(ev),
      () => {
        if (this._collapse()) this._render();
      },
    );
  }

  connectedCallback() {
    this._outside.on();
    this._watchPill();
    // Back on the page after leaving it: rendered again folded.
    if (this._hass && this._config) this._render();
  }

  // The status pill goes on the title row, right after the title, only when the whole title and the pill's whole
  // label fit there; otherwise it takes its own line under the subtitle (the subtitle then on one line). Its dot
  // alone on a card 200 px wide or less, or when its label is wider than the title block (or, in a banner, would not
  // fit above the ground strip). Measured after each render and on every new width (or once the web font is loaded),
  // never by a fixed width; $GS_PILL names the parts.
  _fitPill() {
    const S = GS_PILL;
    for (const t of this.shadowRoot?.querySelectorAll?.(S.block) || []) {
      const row = [...(t.children || [])].find((n) => n.matches?.(S.row));
      const name = row && [...row.children].find((n) => n.matches?.(S.name));
      const chips = row ? [...row.children].filter((n) => n.matches?.(S.chip)) : [];
      if (!name?.getBoundingClientRect || !chips.length) continue;
      t.classList.remove("pill-below", "pill-dot");
      if (this.getBoundingClientRect().width <= 200) t.classList.add("pill-dot");
      // The title's whole width (scrollWidth is rounded: 1 px more, so that a title that fits is never cut).
      const need = chips.reduce((w, c) => w + 8 + c.getBoundingClientRect().width, name.scrollWidth + 1);
      if (need <= row.getBoundingClientRect().width + 0.5) continue;
      t.classList.add("pill-below");
      const box = t.closest(".banner")?.getBoundingClientRect();
      const right = t.getBoundingClientRect().right;
      const out = [name, ...chips, ...[...t.children].filter((n) => n.matches?.(S.sub))].some((n) => {
        const r = n.getBoundingClientRect();
        return r.height > 0 && (r.right > right + 0.5 || (box && (r.top < box.top - 0.5 || r.bottom > box.bottom - 10.5)));
      });
      if (out) t.classList.add("pill-dot");
    }
  }

  // Fitted again on a new width, a new content (a render) and once the web font is loaded, in the next frame.
  _watchPill() {
    if (this._pillWatch || typeof ResizeObserver !== "function") return;
    const fit = () => {
      cancelAnimationFrame(this._pillFrame);
      this._pillFrame = requestAnimationFrame(() => this._fitPill());
    };
    this._pillWatch = [new ResizeObserver(fit), typeof MutationObserver === "function" ? new MutationObserver(fit) : null];
    this._pillWatch[0].observe(this);
    if (this.shadowRoot) this._pillWatch[1]?.observe(this.shadowRoot, { childList: true, subtree: true, characterData: true });
    document.fonts?.ready?.then(fit);
    fit();
  }

  _unwatchPill() {
    for (const o of this._pillWatch || []) o?.disconnect();
    this._pillWatch = null;
  }

  disconnectedCallback() {
    this._unwatchPill();
    // Left in the middle of a press: nothing stays held.
    this._dropPress?.();
    this._outside.off();
    // Left (another dashboard view, a conditional card hidden): back folded (and compact for the mini card).
    this._collapse();
    this._diffDialog?.close?.();
    this._diffDialog?.remove?.();
    this._diffDialog = null;
  }

  // Folds what a click elsewhere folds; true when something changed.
  _collapse() {
    if (!this._filesOpen) return false;
    this._filesOpen = false;
    return true;
  }

  // The mini card's compact view (see GitSyncMiniCard).
  _compact() {
    return false;
  }

  // Button at the far right of the header: only the mini card has one.
  _zoomButton() {
    return '';
  }

  // jscpd:ignore-start (each card is its own dashboard resource: the card boilerplate is theirs)
  setConfig(config) {
    this._config = { ...GS_DEFAULTS, ...config };
    // show_title / show_subtitle: the header's title / subtitle, hidden by the stylesheet
    this.toggleAttribute?.('hide-title', config.show_title === false);
    this.toggleAttribute?.('hide-subtitle', config.show_subtitle === false);
    if (!this.shadowRoot) {
      this.attachShadow({ mode: 'open' });
      gsHoldUnderPress(this, () => this._render());
    }
    this._sig = null;
    this._render();
  }
  // jscpd:ignore-end

  set hass(hass) {
    const old = this._hass;
    this._hass = hass;
    // Nothing the card shows changed: same state objects, registry, language and minute ("3 min ago").
    const ids = this._ids;
    if (
      old &&
      this._sig &&
      ids &&
      hass.entities === old.entities &&
      Object.values(ids).every((id) => !id || hass.states[id] === old.states[id]) &&
      gsLang(hass, this._config) === gsLang(old, this._config) &&
      shbIsNight(hass, this._config) === shbIsNight(old, this._config) &&
      !!hass.user?.is_admin === !!old.user?.is_admin &&
      Math.floor(Date.now() / 60000) === this._sigMinute
    ) {
      return;
    }
    // Typing a commit message: keep the popup as it is.
    if (this._confirm) return;
    this._render();
  }

  getCardSize() {
    return this._filesOpen ? 7 : 5;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6, rows: 'auto' };
  }

  _t(key, vars) {
    return gsT(gsLang(this._hass, this._config), key, vars);
  }

  _n(key, n, vars) {
    return gsN(gsLang(this._hass, this._config), key, n, vars);
  }

  // "3 minutes ago", "yesterday"… in the card's language.
  _ago(iso) {
    const m = gsMinutes(iso);
    let rtf;
    try {
      rtf = new Intl.RelativeTimeFormat(gsLocale(this._hass, this._config), { numeric: 'auto' });
    } catch {
      return '';
    }
    if (m < 1) return rtf.format(0, 'second');
    if (m < 60) return rtf.format(-Math.floor(m), 'minute');
    if (m < 1440) return rtf.format(-Math.floor(m / 60), 'hour');
    return rtf.format(-Math.floor(m / 1440), 'day');
  }

  _absolute(iso) {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return '';
    try {
      return d.toLocaleString(gsLocale(this._hass, this._config), { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
      return d.toISOString();
    }
  }

  // The entities of the chosen sensor's device, or of the first Git Sync device.
  _resolve() {
    const hass = this._hass;
    const devices = gsDevices(hass?.entities);
    if (this._config.entity) {
      const device = hass?.entities?.[this._config.entity]?.device_id || '';
      // Any sensor of the Git Sync module leads to its status sensor; one of another System Hub module (or of the
      // former Git Sync integration, from a dashboard written for it) falls back to finding it
      if (devices[device]?.status) return { ...devices[device], device };
    }
    const [device, ids] = Object.entries(devices).find(([, d]) => d.status) || [];
    return ids ? { ...ids, device } : null;
  }

  _toast(message) {
    this.dispatchEvent(new CustomEvent('hass-notification', { detail: { message }, bubbles: true, composed: true }));
  }

  // The repository the card shows, named in its actions when System Hub has several (else the only one is meant)
  _target() {
    const devices = Object.values(gsDevices(this._hass?.entities)).filter((d) => d.status);
    const repository = this._hass?.states?.[this._ids?.status]?.attributes?.repository;
    return devices.length > 1 && repository ? { repository } : {};
  }

  async _call(service) {
    const data = this._target();
    if (service === 'commit_push') {
      const message = this._draft.trim();
      if (message) data.message = message;
    }
    this._busy = service;
    this._confirm = false;
    this._draft = '';
    this._render();
    try {
      // callService(domain, service, data, target, notifyOnError, returnResponse)
      const result = await this._hass.callService(GS_DOMAIN, GS_PREFIX + service, data, undefined, false, true);
      const first = result?.response;
      if (service === 'commit_push') {
        if (first?.committed) this._toast(this._t('committed', { m: first.message }));
        else this._toast(this._t(first?.pushed ? 'pushed' : 'nothing'));
      } else if (service === 'pull') this._toast(first?.pulled ? this._n('pulled', first.pulled) : this._t('clean'));
      else this._toast(this._n('exported', first?.files?.length ?? 0));
    } catch (err) {
      this._toast(this._t('failed', { e: err?.message || String(err) }));
    } finally {
      this._busy = null;
      this._render();
    }
  }

  // Asks the AI task for a message describing the current changes, without committing, and puts it in the field.
  async _generate() {
    if (this._generating) return;
    const data = this._target();
    this._generating = true;
    this._render();
    try {
      const result = await this._hass.callService(GS_DOMAIN, `${GS_PREFIX}generate_message`, data, undefined, false, true);
      const message = result?.response?.message;
      // The popup may have been closed meanwhile: a late message must not come back at the next opening.
      if (message) {
        if (this._confirm) this._draft = message;
      } else this._toast(this._t('generated_none'));
    } catch (err) {
      this._toast(this._t('failed', { e: err?.message || String(err) }));
    } finally {
      this._generating = false;
      if (this._confirm) {
        this._render();
        this.shadowRoot.querySelector('#message')?.focus?.({ preventScroll: true });
      }
    }
  }

  // Opens the full-screen diff viewer on the changes a commit would include.
  _openDiff() {
    const data = this._target();
    if (!this._diffDialog) {
      this._diffDialog = document.createElement('git-sync-diff-dialog');
      document.body?.appendChild?.(this._diffDialog);
    }
    const branch = this._hass?.states?.[this._ids?.status]?.attributes?.branch;
    this._diffDialog.open({
      lang: gsLang(this._hass, this._config),
      locale: gsLocale(this._hass, this._config),
      branch,
      request: async () => (await this._hass.callService(GS_DOMAIN, `${GS_PREFIX}get_diff`, data, undefined, false, true))?.response,
      onCommit: () => {
        this._confirm = true;
        this._render();
        this.shadowRoot.querySelector('#message')?.focus?.({ preventScroll: true });
      },
    });
  }

  _bind() {
    const root = this.shadowRoot;
    const on = (sel, fn) => root.querySelector(sel)?.addEventListener('click', fn);
    on('#diff', () => this._openDiff());
    const toggleFiles = () => {
      this._filesOpen = !this._filesOpen;
      this._render();
    };
    on('.toggle', toggleFiles);
    root.querySelector('.toggle')?.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      ev.preventDefault();
      toggleFiles();
    });
    on('#commit', () => {
      this._confirm = true;
      this._render();
      root.querySelector('#message')?.focus?.({ preventScroll: true });
    });
    on('#export', () => this._call('export_dashboards'));
    on('#pull', () => this._call('pull'));
    on('.zoom', () => this._toggleZoom?.());
    const close = () => {
      this._confirm = false;
      this._draft = '';
      this._render();
    };
    on('#cancel', close);
    on('.overlay', close);
    on('#confirm', () => {
      if (!this._generating) this._call('commit_push');
    });
    on('#generate', () => this._generate());
    root.querySelector('#message')?.addEventListener('input', (ev) => {
      this._draft = ev.target?.value ?? '';
    });
    root.querySelector('#message')?.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' && !this._generating) this._call('commit_push');
      if (ev.key === 'Escape') close();
    });
  }

  // The element with the keyboard focus, as a selector to find it again after a render replaced the DOM.
  _focused() {
    const el = this.shadowRoot?.activeElement;
    if (!el || !gsKeepsFocus(this, el)) return null;
    if (el.id) return `#${el.id}`;
    if (el.classList?.contains('zoom')) return '.zoom';
    if (el.classList?.contains('link')) return '.link';
    return el.classList?.contains('toggle') ? '.toggle' : null;
  }

  _render() {
    // Held under a press (see gsHoldUnderPress), drawn after its click.
    if (this._pressing) {
      this._dirty = true;
      return;
    }
    this._dirty = false;
    const focused = this._focused();
    this._paint();
    if (focused) this.shadowRoot.querySelector(focused)?.focus?.({ preventScroll: true });
  }

  _paint() {
    if (!this._config || !this.shadowRoot) return;
    const hass = this._hass;
    if (!hass) return;
    const ids = this._resolve();
    this._ids = ids;
    this._sigMinute = Math.floor(Date.now() / 60000);
    this._sig = true;
    const statusObj = ids && hass.states[ids.status];
    if (!statusObj) {
      this.shadowRoot.innerHTML = `<style>${this._css()}</style><ha-card><div class="empty">${gsEsc(this._t('not_loaded'))}</div></ha-card>`;
      return;
    }

    const c = this._config;
    const a = statusObj.attributes || {};
    const status = GS_STATUSES.includes(statusObj.state) ? statusObj.state : 'unavailable';
    const files = Array.isArray(a.changed_files) ? a.changed_files : [];
    const count = Number(a.changed_count ?? files.length) || 0;
    const valid = (s) => s && !['unknown', 'unavailable'].includes(s.state);
    const commitObj = hass.states[ids.last_commit];
    const pushObj = hass.states[ids.last_push];
    const exportObj = hass.states[ids.last_export];
    const busy = this._busy;
    const compact = this._compact();
    // The actions (commit, pull, export, diff, AI message) are for administrators only: others see the status.
    const admin = hass.user?.is_admin === true;
    const pullable = gsPullable(a);
    // Compact view: the branch alone, the remote repository is in the full card.
    const subtitle = [a.branch, compact ? '' : gsRepo(a.remote_url)].filter(Boolean).map(gsEsc).join(' → ');

    const commit = valid(commitObj)
      ? `<div class="commit">
          <div class="lbl">${gsEsc(this._t('last_commit'))}</div>
          <div class="msg">${gsEsc(commitObj.attributes?.message)}</div>
          <div class="meta"><span class="sha">${gsEsc(commitObj.attributes?.short_sha)}</span>
            <span title="${gsEsc(this._absolute(commitObj.state))}">${gsEsc(this._ago(commitObj.state))}</span></div>
        </div>`
      : '';

    const timeRow = (icon, label, obj, extra = '') => `
      <div class="row">
        <ha-icon icon="${icon}"></ha-icon>
        <span class="label">${gsEsc(label)}</span>
        <span class="value" title="${valid(obj) ? gsEsc(this._absolute(obj.state)) : ''}">${
          valid(obj) ? gsEsc(this._ago(obj.state)) : gsEsc(this._t('never'))
        }${extra}</span>
      </div>`;

    let changes;
    if (c.show_files && count > 0) {
      const list = this._filesOpen
        ? `<ul class="files">${files
            .slice(0, GS_FILES_SHOWN)
            .map((f) => `<li title="${gsEsc(f)}">${gsEsc(f)}</li>`)
            .join('')}${count > GS_FILES_SHOWN ? `<li>${gsEsc(this._t('more', { n: count - GS_FILES_SHOWN }))}</li>` : ''}</ul>`
        : '';
      changes = `<div class="row toggle" role="button" tabindex="0" aria-expanded="${this._filesOpen}">
          <ha-icon class="chevron${this._filesOpen ? ' open' : ''}" icon="mdi:chevron-right"></ha-icon>
          <span class="label">${gsEsc(this._t('changed_files'))}</span>
          <span class="value">${gsEsc(this._n('files', count))}</span>
        </div>${list}`;
    } else {
      changes = `<div class="row">
          <ha-icon icon="mdi:file-document-multiple-outline"></ha-icon>
          <span class="label">${gsEsc(this._t('changes'))}</span>
          <span class="value">${gsEsc(count > 0 ? this._n('files', count) : this._t('no_changes'))}</span>
        </div>`;
    }

    const exportCount = exportObj?.attributes?.files?.length || 0;
    const exportRow = c.show_export
      ? timeRow(
          'mdi:view-dashboard-outline',
          this._t('last_export'),
          exportObj,
          valid(exportObj) && exportCount ? ` · ${gsEsc(this._n('files', exportCount))}` : '',
        )
      : '';

    // Compact view: the confirmation takes the place of the content (no room for a popup over it).
    const popup =
      this._confirm && admin
        ? `${compact ? '' : '<div class="overlay"></div>'}
        <div class="popup${compact ? ' inline' : ''}" role="dialog" aria-modal="true">
          <div class="p-title">${gsEsc(this._t('confirm_title'))}</div>
          <div class="p-text">${gsEsc(count > 0 ? this._n('confirm_text', count) : this._t('confirm_push'))}</div>
          <div class="field${this._generating ? ' generating' : ''}">
            <input id="message" type="text" maxlength="100" autocomplete="off" aria-label="${gsEsc(this._t('message', { branch: a.branch || 'HEAD' }))}"
              placeholder="${gsEsc(this._t('message', { branch: a.branch || 'HEAD' }))}" value="${gsEsc(this._draft)}"${this._generating ? ' disabled' : ''} />
            ${
              a.ai_task
                ? `<button class="gen" id="generate" title="${gsEsc(this._t('generate'))}" aria-label="${gsEsc(this._t('generate'))}"${this._generating ? ' disabled' : ''}>
                    <ha-icon icon="${this._generating ? 'mdi:loading' : 'mdi:creation-outline'}"></ha-icon></button>`
                : ''
            }
          </div>
          ${a.ai_task ? `<div class="hint">${gsEsc(this._t('message_hint'))}</div>` : ''}
          ${count > 0 ? `<button class="link" id="diff"><ha-icon icon="mdi:file-compare"></ha-icon>${gsEsc(this._t('diff'))}</button>` : ''}
          <div class="actions">
            <button class="action" id="cancel"><ha-icon icon="mdi:close"></ha-icon>${gsEsc(this._t('cancel'))}</button>
            <button class="action" id="confirm"${this._generating ? ' disabled' : ''}><ha-icon icon="mdi:source-commit-end"></ha-icon>${gsEsc(this._t('commit'))}</button>
          </div>
        </div>`
      : '';

    const canCommit = ['dirty', 'ahead', 'error'].includes(status) && !busy;
    const pullAllowed = admin && pullable;
    const button = (id, service, icon, label, enabled) =>
      `<button class="action${busy === service ? ' busy' : ''}" id="${id}" ${enabled ? '' : 'disabled'}>
        <ha-icon icon="${busy === service ? 'mdi:loading' : icon}"></ha-icon>${gsEsc(label)}</button>`;

    const pillText = busy ? this._t('working') : this._t(status);
    const error = a.last_error ? `<div class="err">${gsEsc(a.last_error)}</div>` : '';
    // Opens the full-screen diff viewer; only when something changed (the popup has its own link).
    const diffButton = `<button class="icon-btn" id="diff" title="${gsEsc(this._t('diff'))}" aria-label="${gsEsc(this._t('diff'))}">
        <ha-icon icon="mdi:file-compare"></ha-icon></button>`;
    // Behind: bring in the remote commits (the next commit would pull them too).
    const pullLabel = busy === 'pull' ? this._t('working') : this._t('pull');
    const pullIcon = `<button class="icon-btn${busy === 'pull' ? ' busy' : ''}" id="pull" title="${gsEsc(pullLabel)}" aria-label="${gsEsc(pullLabel)}" ${busy ? 'disabled' : ''}>
        <ha-icon icon="${busy === 'pull' ? 'mdi:loading' : 'mdi:source-pull'}"></ha-icon></button>`;
    let body;
    if (compact && this._confirm && admin) body = popup;
    else if (compact) {
      // Compact view: the last commit on one line, the changes and the last push, Commit & push as an icon.
      const commitLine = valid(commitObj)
        ? `<div class="m-commit" title="${gsEsc(this._absolute(commitObj.state))}">
            <span class="m-msg">${gsEsc(commitObj.attributes?.message)}</span>
            <span class="m-ago">${gsEsc(this._ago(commitObj.state))}</span>
          </div>`
        : '';
      const pushText = valid(pushObj) ? this._ago(pushObj.state) : this._t('never');
      // "0 files" rather than "Working tree clean": fits beside the last push on a 6-column card.
      const changesText = this._n('files', count);
      const commitLabel = busy === 'commit_push' ? this._t('working') : this._t('commit');
      body = `${commitLine}${error}
        <div class="m-foot">
          <span class="m-chip${count > 0 ? ' changed' : ''}" title="${gsEsc(this._t('changes'))}: ${gsEsc(changesText)}">
            <ha-icon icon="mdi:file-document-multiple-outline"></ha-icon><span class="m-txt">${gsEsc(changesText)}</span></span>
          <span class="m-chip" title="${gsEsc(this._t('last_push'))}: ${gsEsc(pushText)}">
            <ha-icon icon="mdi:cloud-check-outline"></ha-icon><span class="m-txt">${gsEsc(pushText)}</span></span>
          ${admin && count > 0 ? diffButton : ''}
          ${pullAllowed ? pullIcon : ''}
          ${
            admin
              ? `<button class="icon-btn${busy === 'commit_push' ? ' busy' : ''}" id="commit" title="${gsEsc(commitLabel)}" aria-label="${gsEsc(commitLabel)}" ${canCommit ? '' : 'disabled'}>
            <ha-icon icon="${busy === 'commit_push' ? 'mdi:loading' : 'mdi:source-commit-end'}"></ha-icon></button>`
              : ''
          }
        </div>`;
    } else {
      body = `${commit}
        <div class="rows">
          ${changes}
          ${timeRow('mdi:cloud-check-outline', this._t('last_push'), pushObj)}
          ${exportRow}
        </div>
        ${error}
        ${
          admin
            ? `<div class="actions">
          ${pullAllowed ? button('pull', 'pull', 'mdi:source-pull', this._t('pull'), !busy) : ''}
          ${button('commit', 'commit_push', 'mdi:source-commit-end', this._t('commit'), canCommit)}
          ${c.show_export ? button('export', 'export_dashboards', 'mdi:export', this._t('export'), !busy) : ''}
          ${count > 0 && !this._confirm ? diffButton : ''}
        </div>`
            : ''
        }
        ${popup}`;
    }
    this.shadowRoot.innerHTML = shBanner(`
      <style>${this._css()}</style>
      <ha-card class="st-${status}${compact ? ' compact' : ''}">
        <div class="header">
          <div class="badge"><ha-icon icon="mdi:git"></ha-icon></div>
          <div class="titles">
            <div class="title-row"><div class="title">${gsEsc(c.title || this._t('title'))}</div><span class="pill${busy ? ' busy' : ''}" title="${gsEsc(pillText)}" aria-label="${gsEsc(pillText)}"><span class="pill-text">${gsEsc(pillText)}</span></span></div>
            <div class="subtitle" title="${subtitle}">${subtitle}</div>
          </div>
          ${this._zoomButton()}
        </div>
        ${body}
      </ha-card>`, { hass: this._hass, config: this._config, scene: 'git', pad: '16px' });
    this._bind();
  }

  _css() {
    return `
      /* Home Assistant's <ha-icon> is inline: as a box of its own, its icon is centred in its badge */
      ha-icon { display: inline-flex; align-items: center; justify-content: center; vertical-align: middle; line-height: 0; }
      :host { display: block; --gs-ok: var(--success-color, #43a047); --gs-warn: var(--warning-color, #ffa600);
              --gs-info: var(--info-color, #039be5); --gs-alert: var(--error-color, #db4437);
              --gs-off: var(--disabled-text-color, #9e9e9e); --gs-accent: var(--primary-color, #03a9f4); }
      /* No size container on ha-card itself: its intrinsic width would drop to its padding in an inline-block
         parent, a grid column sized auto, layout-card or button-card. Only the header is one (see .header). */
      ha-card { position: relative; overflow: hidden; padding: 16px; --s: var(--gs-off); }
      ha-card.st-clean { --s: var(--gs-ok); }
      ha-card.st-dirty { --s: var(--gs-warn); }
      ha-card.st-ahead { --s: var(--gs-info); }
      ha-card.st-error, ha-card.st-diverged { --s: var(--gs-alert); }
      ha-card.st-behind { --s: var(--gs-info); }
      .empty { padding: 8px 0; color: var(--secondary-text-color); }

      /* Same header as the other cards: the title keeps a few letters, the pill shrinks, nothing leaves the card. */
      /* Gap 6px on the narrowest cards (6 columns of a phone): room for four letters of the title. */
      .header { display: flex; align-items: center; gap: clamp(6px, 100% - 140px, 10px); min-width: 0;
                container-type: inline-size; }
      .badge { flex: none; width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center;
               color: var(--s); background: color-mix(in srgb, var(--s) 18%, transparent); }
      .badge ha-icon { --mdc-icon-size: 24px; }
      /* Basis 0: the title takes what the pill leaves, the pill keeps its whole label while there is room. */
      /* 5ch: four letters and the ellipsis of a proportional font ("Git S…"). */
      .titles { flex: 1 1 0; min-width: 5ch; font-size: 16px; }
      .title { min-width: 4ch; font-size: 16px; font-weight: 500; line-height: 22px; color: var(--primary-text-color);
               white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .subtitle { font-size: 12px; line-height: 16px; color: var(--secondary-text-color);
                  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      /* Text: the state colour mixed with the text colour, readable on the tinted background in both themes. */
      .pill { flex: 0 1 auto; min-width: 0; box-sizing: border-box; align-self: flex-start; margin-top: 2px;
              display: inline-flex; align-items: center; gap: 6px; padding: 1px 8px; border-radius: 999px;
              font-size: 11px; line-height: 18px; font-weight: 500;
              color: color-mix(in srgb, var(--s) 40%, var(--primary-text-color));
              background: color-mix(in srgb, var(--s) 14%, transparent); }
      .pill::before { content: ''; flex: none; width: 6px; height: 6px; border-radius: 50%; background: var(--s); }
      .pill-text { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .pill.busy::before { animation: gs-pulse 1s ease-in-out infinite; }
      /* The status pill: on the title row, 8 px after the title, only when the whole title and the pill's whole label fit
         there; otherwise on its own line under the subtitle, which then keeps one line; its dot alone at 200 px or less
         or when its label does not fit the title block (its text stays in its title and for screen readers). Measured
         after each render (_fitPill), in every language, never by a fixed width. */
      .title-row { display: flex; flex-wrap: nowrap; align-items: center; gap: 8px; min-width: 0; }
      .title-row > .title { flex: 0 1 auto; min-width: 0; }
      .title-row > .pill { flex: none; min-width: auto; max-width: none; overflow: visible; align-self: center; margin-top: 0; }
      .title-row > .pill .pill-text { min-width: auto; overflow: visible; white-space: nowrap; display: inline; -webkit-line-clamp: none; line-clamp: none; }
      .titles.pill-below { display: flex; flex-direction: column; align-items: stretch; }
      .titles.pill-below > * { order: 3; }
      .titles.pill-below > .title-row { display: contents; }
      .titles.pill-below > .subtitle { order: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .titles.pill-below > .title-row > .pill { order: 2; align-self: flex-start; margin-top: 2px; }
      .titles.pill-dot > .title-row > .pill { padding: 4px; gap: 0; }
      .titles.pill-dot > .title-row > .pill .dot { display: block; }
      .titles.pill-dot > .title-row > .pill .pill-text { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }

      .commit { margin-top: 14px; padding: 10px 12px; border-radius: 12px;
                background: var(--secondary-background-color, rgba(127,127,127,.08)); }
      .commit .lbl { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: var(--secondary-text-color); }
      .commit .msg { margin-top: 2px; font-size: 14px; line-height: 20px; color: var(--primary-text-color); word-break: break-word; }
      .commit .meta { margin-top: 4px; font-size: 12px; color: var(--secondary-text-color); display: flex; gap: 8px; flex-wrap: wrap; }
      .sha { font-family: var(--code-font-family, monospace); }

      .rows { margin-top: 10px; display: flex; flex-direction: column; }
      /* A value that does not fit beside its label goes under it, and wraps: never cut by the card. */
      /* The gap narrows to 4px on the narrowest cards (6 columns of a phone) so a long word fits beside the icon. */
      .row { display: flex; flex-wrap: wrap; align-items: center; column-gap: clamp(4px, 100% - 120px, 10px);
             min-height: 36px; font-size: 14px; }
      .row ha-icon { --mdc-icon-size: 20px; color: var(--secondary-text-color); flex: none; }
      .row .label { flex: 1 1 0; min-width: min(7em, 100% - 24px); overflow-wrap: break-word; color: var(--primary-text-color); }
      .row .value { flex: 0 1 auto; min-width: 0; margin-left: auto; overflow-wrap: anywhere;
                    color: var(--secondary-text-color); text-align: right; }
      .row.toggle { cursor: pointer; user-select: none; }
      .row.toggle:focus-visible { outline: 2px solid var(--gs-accent); outline-offset: 2px; border-radius: 6px; }
      .chevron { transition: transform .2s ease; }
      .chevron.open { transform: rotate(90deg); }
      .files { margin: 2px 0 6px 30px; padding: 0; list-style: none; max-height: 180px; overflow-y: auto;
               font-family: var(--code-font-family, monospace); font-size: 12px; line-height: 18px; color: var(--secondary-text-color); }
      .files li { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

      .err { margin-top: 8px; padding: 8px 10px; border-radius: 10px; font-size: 12px; word-break: break-word;
             color: color-mix(in srgb, var(--gs-alert) 40%, var(--primary-text-color));
             background: color-mix(in srgb, var(--gs-alert) 10%, transparent); }

      .actions { margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap; container-type: inline-size; }
      /* min-width 0 and wrapping: a long label (pl, sr) wraps instead of leaving a narrow card. */
      button.action { flex: 1 1 auto; min-width: 0; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
                      white-space: normal; overflow-wrap: anywhere; text-align: center; line-height: 18px;
                      min-height: 38px; padding: 4px 12px; border-radius: 10px; cursor: pointer;
                      font: inherit; font-size: 14px; font-weight: 500; color: var(--gs-accent); background: transparent;
                      border: 1px solid color-mix(in srgb, var(--gs-accent) 45%, transparent); transition: background .15s ease; }
      button.action ha-icon { --mdc-icon-size: 18px; flex: none; }
      /* Very narrow card (6 columns on a phone): less padding, so a word such as "dashboardy" fits on its line. */
      @container (max-width: 140px) {
        button.action { padding: 4px 6px; gap: 4px; }
      }
      button.action:hover:not([disabled]) { background: color-mix(in srgb, var(--gs-accent) 10%, transparent); }
      button.action:focus-visible { outline: 2px solid var(--gs-accent); outline-offset: 2px; }
      button.action[disabled] { cursor: default; opacity: .45; }
      button.action.busy ha-icon { animation: gs-spin 1s linear infinite; }

      .overlay { position: absolute; inset: 0; z-index: 2; backdrop-filter: blur(2px);
                 background: color-mix(in srgb, var(--card-background-color, #fff) 55%, transparent); }
      .popup { position: absolute; top: 12px; left: 12px; right: 12px; z-index: 3; padding: 16px; border-radius: 14px;
               background: var(--card-background-color, #fff); box-shadow: 0 8px 28px rgba(0,0,0,.25);
               border: 1px solid var(--divider-color, rgba(127,127,127,.2)); }
      .p-title { font-size: 16px; font-weight: 500; color: var(--primary-text-color); }
      .p-text { margin-top: 4px; font-size: 13px; color: var(--secondary-text-color); }
      /* VS Code-like message box: placeholder with the branch, sparkle button inside, on the right */
      .field { position: relative; margin-top: 12px; }
      .field input { box-sizing: border-box; width: 100%; padding: 9px 40px 9px 10px; border-radius: 8px;
                     font: inherit; font-size: 14px; color: var(--primary-text-color); outline: none;
                     background: var(--secondary-background-color, transparent);
                     border: 1px solid var(--divider-color, rgba(127,127,127,.3)); text-overflow: ellipsis; }
      .field input::placeholder { color: var(--secondary-text-color); opacity: .8; }
      .field input:focus { border-color: var(--gs-accent); }
      .field input[disabled] { opacity: .6; }
      .gen { position: absolute; top: 50%; right: 4px; transform: translateY(-50%); width: 32px; height: 32px;
             display: grid; place-items: center; padding: 0; border: none; border-radius: 6px; cursor: pointer;
             background: transparent; color: var(--secondary-text-color); transition: color .15s ease, background .15s ease; }
      .gen ha-icon { --mdc-icon-size: 18px; }
      .gen:hover:not([disabled]) { color: var(--gs-accent); background: color-mix(in srgb, var(--gs-accent) 10%, transparent); }
      .gen:focus-visible { outline: 2px solid var(--gs-accent); outline-offset: 1px; }
      .gen[disabled] { cursor: default; }
      .generating .gen ha-icon { animation: gs-spin 1s linear infinite; color: var(--gs-accent); }
      .hint { margin-top: 4px; font-size: 11px; color: var(--secondary-text-color); }
      .popup .actions { margin-top: 14px; }
      /* "View changes" in the commit popup: a text link with its icon, no border. */
      button.link { margin-top: 10px; display: inline-flex; align-items: center; gap: 6px; padding: 2px 0; border: none; cursor: pointer;
                    background: transparent; font: inherit; font-size: 13px; color: var(--gs-accent); }
      button.link ha-icon { --mdc-icon-size: 16px; }
      button.link:hover { text-decoration: underline; }
      button.link:focus-visible { outline: 2px solid var(--gs-accent); outline-offset: 2px; border-radius: 4px; }
      /* The diff button in the full card's action row keeps its square shape beside the wide buttons. */
      .actions button.icon-btn { flex: none; margin-left: 0; min-height: 38px; height: 38px; width: 38px; }

      /* Mini card: the expand / collapse button in the card's top right corner (24 px, round); the header keeps
         clear of it. */
      .zoom { position: absolute; z-index: 2; top: 5px; right: 5px; width: 24px; height: 24px; margin: 0; padding: 0;
              border: none; border-radius: 50%; display: grid; place-items: center; cursor: pointer;
              background: color-mix(in srgb, var(--secondary-text-color) 10%, transparent); color: var(--secondary-text-color);
              transition: background .15s ease; }
      .header:has(> .zoom) { padding-right: 18px; }
      .zoom ha-icon { --mdc-icon-size: 16px; }
      .zoom:hover { background: color-mix(in srgb, var(--secondary-text-color) 16%, transparent); color: var(--primary-text-color); }
      .zoom:focus-visible { outline: 2px solid var(--gs-accent); outline-offset: 1px; }

      /* Compact view: 32 px badge, the last commit on one line, the changes and the last push beside an icon button. */
      ha-card.compact { padding: 12px; }
      .compact .badge { width: 32px; height: 32px; }
      .compact .badge ha-icon { --mdc-icon-size: 20px; }
      .m-commit { margin-top: 10px; display: flex; align-items: baseline; gap: 8px; min-width: 0; font-size: 13px; }
      .m-msg { flex: 1 1 auto; min-width: 0; color: var(--primary-text-color);
               white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .m-ago { flex: none; font-size: 12px; color: var(--secondary-text-color); }
      .compact .err { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
      .m-foot { margin-top: 8px; display: flex; align-items: center; gap: 12px; min-width: 0; container-type: inline-size; }
      .m-chip { flex: 0 1 auto; min-width: 0; display: inline-flex; align-items: center; gap: 4px;
                font-size: 12px; color: var(--secondary-text-color); }
      .m-chip ha-icon { --mdc-icon-size: 16px; flex: none; }
      .m-chip.changed { color: color-mix(in srgb, var(--gs-warn) 40%, var(--primary-text-color)); }
      .m-chip.changed ha-icon { color: var(--gs-warn); }
      .m-txt { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      /* Very narrow mini card (6 columns on a phone): the chips keep their icon, their text stays in the tooltip. */
      @container (max-width: 150px) { .m-chip .m-txt { display: none; } }
      button.icon-btn { flex: none; margin-left: auto; width: 36px; height: 36px; padding: 0; border-radius: 10px;
                        display: grid; place-items: center; cursor: pointer; color: var(--gs-accent); background: transparent;
                        border: 1px solid color-mix(in srgb, var(--gs-accent) 45%, transparent); transition: background .15s ease; }
      button.icon-btn ha-icon { --mdc-icon-size: 18px; }
      button.icon-btn:hover:not([disabled]) { background: color-mix(in srgb, var(--gs-accent) 10%, transparent); }
      button.icon-btn:focus-visible { outline: 2px solid var(--gs-accent); outline-offset: 2px; }
      button.icon-btn[disabled] { cursor: default; opacity: .45; }
      button.icon-btn.busy ha-icon { animation: gs-spin 1s linear infinite; }
      /* The confirmation in the flow of the compact card, instead of a popup over its content. */
      .popup.inline { position: static; margin-top: 12px; padding: 0; border: none; border-radius: 0; box-shadow: none;
                      background: transparent; }

      @keyframes gs-spin { to { transform: rotate(360deg); } }
      @keyframes gs-pulse { 50% { opacity: .3; } }
      @media (prefers-reduced-motion: reduce) {
        .pill.busy::before, button.action.busy ha-icon, button.icon-btn.busy ha-icon, .generating .gen ha-icon { animation: none; }
        .chevron, button.action, button.icon-btn, .gen, .zoom { transition: none; }
      }
      :host([hide-title]) .titles > .title, :host([hide-subtitle]) .titles > .subtitle { display: none; }
    `;
  }
}
