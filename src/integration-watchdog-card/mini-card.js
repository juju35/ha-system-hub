// ── Mini card ────────────────────────────────────────────────────────────────
// "A click elsewhere" is caught on the pointer, not only on the click event: on iOS (Safari and the companion app)
// a tap on something that is not clickable (the background, an empty spot, a card with no action) sends no click to
// the page. It counts when the press and the release are both outside (`isOut`; a slider dragged out of the card
// does not fold it), and a scroll does not count (the browser cancels the pointer). Keyboard clicks still go through
// the click event.
import { iwEsc, iwHistoryKind, iwHistoryLabel } from "./i18n-helpers.js";
import { shBanner } from "./illustrated-header.js";
import { IntegrationWatchdogCard } from "./card.js";

export const iwWatchOutside = (isOut, handler) => {
  let downOutside = false;
  const onDown = (ev) => {
    downOutside = isOut(ev);
  };
  const onUp = (ev) => {
    if (downOutside && isOut(ev)) handler(ev);
    downOutside = false;
  };
  const onClick = (ev) => {
    if (ev.detail === 0 && isOut(ev)) handler(ev);
  };
  return {
    on() {
      document.addEventListener?.('pointerdown', onDown, true);
      document.addEventListener?.('pointerup', onUp, true);
      document.addEventListener?.('click', onClick, true);
    },
    // A tap (press and release at the same spot), for the tests.
    tap(ev) {
      onDown(ev);
      onUp(ev);
    },
    off() {
      document.removeEventListener?.('pointerdown', onDown, true);
      document.removeEventListener?.('pointerup', onUp, true);
      document.removeEventListener?.('click', onClick, true);
    },
  };
};

// No rewrite of the card between a press and its click: Home Assistant updates the card several times a second, and a
// rewrite under the pointer replaces the element pressed, so that the click lands on the card itself and does nothing
// (a button or a row that does not react). While a press is in progress (`_pressing`), a render is left pending
// (`_dirty`): it is done at the click, or right after the release when no click follows (a drag, a scroll).
// `_byPointer` tells a mouse or touch use from the keyboard: after a rewrite, the focus is put back only for the
// keyboard (no focus ring after a click), and always in a text field.
export const iwHoldUnderPress = (card, render) => {
  const root = card.shadowRoot;
  card._onPressEnd = () => {
    window.removeEventListener?.('pointerup', card._onPressEnd, true);
    window.removeEventListener?.('pointercancel', card._onPressEnd, true);
    setTimeout(() => card._endPress(), 0);
  };
  card._endPress = () => {
    card._pressing = false;
    if (!card._dirty) return;
    card._dirty = false;
    render();
  };
  // Left in the middle of a press (see disconnectedCallback).
  card._dropPress = () => {
    card._pressing = false;
    card._dirty = false;
    window.removeEventListener?.('pointerup', card._onPressEnd, true);
    window.removeEventListener?.('pointercancel', card._onPressEnd, true);
  };
  root.addEventListener?.('pointerdown', () => {
    card._byPointer = true;
    card._pressing = true;
    window.addEventListener?.('pointerup', card._onPressEnd, true);
    window.addEventListener?.('pointercancel', card._onPressEnd, true);
  });
  root.addEventListener?.('keydown', () => {
    card._byPointer = false;
  });
  // At the click (capture: before the card acts on it) the press is over, and what the click changes is drawn at once.
  card._pressClick = (ev) => {
    card._pressing = false;
    if (ev.detail === 0) card._byPointer = false;
  };
  root.addEventListener?.('click', card._pressClick, true);
};

// Whether the focus goes back to `el` after a rewrite (see iwHoldUnderPress).
export const iwKeepsFocus = (card, el) => !card._byPointer || typeof el?.selectionStart === 'number';

// integration-watchdog-mini-card: the status on two lines — the badge, title and status pill, then a chip per
// unavailable integration (or the last reload while everything is available) and the time of the last check.
// Its detail button (top right, `zoom: false` removes it) switches it to the full card and back; a click anywhere
// else brings it back too, unless it lands in a dialog opened from the card (more-info).
export class IntegrationWatchdogMiniCard extends IntegrationWatchdogCard {
  static getConfigElement() {
    return document.createElement('sh-watchdog-mini-card-editor');
  }

  constructor() {
    super();
    this._zoomed = false;
    this._unzoom = iwWatchOutside(
      (ev) => {
        const path = ev.composedPath();
        return !path.includes(this) && !path.some((n) => ['ha-more-info-dialog', 'ha-dialog', 'dialog'].includes(n.localName));
      },
      () => {
        if (!this._zoomed) return;
        this._zoomed = false;
        this._render();
      },
    );
  }

  connectedCallback() {
    this._unzoom.on();
    // Back on the page after leaving it: rendered again in the compact view.
    if (this._hass && this._config) this._render();
  }

  disconnectedCallback() {
    // Left in the middle of a press: nothing stays held.
    this._dropPress?.();
    this._unzoom.off();
    // Left (another dashboard view, a conditional card hidden): back to the compact view on return.
    this._zoomed = false;
  }

  setConfig(config) {
    if (config?.zoom != null && typeof config.zoom !== 'boolean') throw new Error('zoom must be true or false');
    super.setConfig(config);
  }

  getCardSize() {
    if (this.hidden) return 0;
    return this._zoomed ? super.getCardSize() : 2;
  }

  // 6 columns of a phone section (~156 px) still hold the header once the badge has given way.
  getGridOptions() {
    return { columns: 6, min_columns: 6, rows: 'auto' };
  }

  _headExtra() {
    if (this._config.zoom === false) return '';
    const label = iwEsc(this._t(this._zoomed ? 'zoom_out' : 'zoom_in'));
    const icon = this._zoomed ? 'mdi:arrow-collapse' : 'mdi:arrow-expand';
    return `<button class="zoom" data-focus="zoom" title="${label}" aria-label="${label}" aria-expanded="${this._zoomed}"><ha-icon icon="${icon}"></ha-icon></button>`;
  }

  _draw(m) {
    if (this._zoomed) {
      super._draw(m);
      return;
    }
    const { st, items, givenUp, checking, level, icon } = m;
    this.shadowRoot.innerHTML = shBanner(`
      <style>${this.constructor.styles}</style>
      <ha-card class="lvl-${level}">
        <div class="mini">
          <div class="badge"><ha-icon icon="${icon}"></ha-icon></div>
          <div class="body">
            <div class="head">
              <div class="heading"><div class="title-row"><div class="title">${iwEsc(this._config.title || this._t('title'))}</div>${this._pill(this._status(st, items, givenUp, checking))}</div></div>
              ${this._checkButton(checking)}
              ${this._headExtra()}
            </div>
            <div class="rs">${this._chips(m)}</div>
          </div>
        </div>
      </ha-card>`, { hass: this._hass, config: this._config, scene: 'watchdog', pad: '12px' });
  }

  _bind() {
    super._bind();
    this.shadowRoot.querySelector('.zoom')?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      this._zoomed = !this._zoomed;
      this._render();
      // The button was replaced: keyboard use (Enter / Space, no click count) keeps the focus on the new one.
      if (ev.detail === 0) this.shadowRoot.querySelector('.zoom')?.focus({ preventScroll: true });
    });
    for (const el of this.shadowRoot.querySelectorAll('.r')) {
      el.addEventListener('click', () => {
        if (el.dataset.domain) this._openIntegration(el.dataset.domain, el.dataset.entry);
        else if (el.dataset.entity) {
          this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId: el.dataset.entity }, bubbles: true, composed: true }));
        }
      });
    }
  }

  // A chip: an administrator's opens the integration's page in Settings, the others open the sensor's more-info.
  _chip(cls, icon, text, title, focus, domain, entity, entry) {
    const target =
      domain && this._admin
        ? ` data-domain="${iwEsc(domain)}"${entry ? ` data-entry="${iwEsc(entry)}"` : ''}`
        : entity
          ? ` data-entity="${iwEsc(entity)}"`
          : '';
    return `<button class="r ${cls}"${target} data-focus="${iwEsc(focus)}" title="${iwEsc(title)}"><ha-icon icon="${icon}"></ha-icon><span class="rt">${iwEsc(text)}</span></button>`;
  }

  _chips({ st, items, max, history, checkedAt }) {
    if (!st) return '';
    const ids = this._ids;
    // The unavailable integrations, tinted: given up in red, the others in orange.
    const chips = items.map((i) => {
      const value = i.gave_up ? this._t('gave_up') : i.reloads && max ? this._t('attempts', { n: i.reloads, max }) : this._t('waiting');
      return this._chip(
        `${i.gave_up ? 'alert' : 'warn'} pill`,
        i.gave_up ? 'mdi:cancel' : 'mdi:puzzle-remove-outline',
        `${i.title} · ${value}`,
        `${i.title} (${i.domain}) — ${value}`,
        `m:u:${i.entry_id || i.domain}`,
        i.domain,
        ids.unavailable,
        i.entry_id,
      );
    });
    // Everything available: the last reload, failed reload or give-up, plain with its coloured icon.
    const last = !items.length && history[0];
    if (last) {
      const kind = iwHistoryKind(last.kind);
      const label = this._t(iwHistoryLabel(last.kind));
      chips.push(
        this._chip(
          kind,
          { ok: 'mdi:check-circle', warn: 'mdi:alert-circle', alert: 'mdi:cancel' }[kind],
          `${label} · ${last.title}`,
          `${label} — ${last.title} (${last.domain}) — ${this._absolute(last.at)}`,
          'm:h',
          last.domain,
          ids.last_reload,
          last.entry_id,
        ),
      );
    }
    const checked = checkedAt ? this._t('checked', { d: this._ago(checkedAt) }) : this._t('never_checked');
    chips.push(this._chip('idle', 'mdi:clock-check-outline', checked, checkedAt ? this._absolute(checkedAt) : checked, 'm:c', null, ids.last_check));
    return chips.join('');
  }

  static get styles() {
    return `${IntegrationWatchdogCard.styles}
      :host { --iw-natural-width: 300px; }
      /* Badge, then the two lines; the badge keeps the full card's size (40 px), top-aligned */
      .mini { display: flex; align-items: flex-start; gap: 10px; container-type: inline-size; }
      .body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
      .mini .head { min-height: 40px; }
      .rs { display: flex; flex-wrap: wrap; gap: 2px 4px; margin-left: -4px; }
      .rs:empty { display: none; }
      /* A chip never gets wider than the card: its text ends in an ellipsis (full text in the tooltip) */
      .r { --t: var(--secondary-text-color); all: unset; box-sizing: border-box; cursor: pointer;
           display: inline-flex; align-items: center; gap: 3px; max-width: 100%; min-width: 0;
           padding: 0 6px 0 4px; border-radius: 999px; font-size: 12px; font-weight: 500; line-height: 18px;
           white-space: nowrap; color: var(--primary-text-color); }
      .r.ok    { --t: var(--iw-ok); }
      .r.warn  { --t: var(--iw-warn); }
      .r.alert { --t: var(--iw-alert); }
      .r.idle  { color: var(--iw-muted); }
      .r ha-icon { flex: none; display: inline-flex; --mdc-icon-size: 13px; color: var(--t); }
      .r .rt { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
      .r.pill { color: color-mix(in srgb, var(--t) 40%, var(--primary-text-color)); background: color-mix(in srgb, var(--t) 14%, transparent); }
      .r:hover { background: color-mix(in srgb, var(--t) 16%, var(--secondary-background-color, transparent)); }
      /* A pill keeps a light tint on hover, so its darkened text stays readable */
      .r.pill:hover { background: color-mix(in srgb, var(--t) 22%, transparent); }
      .r:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
      /* Detail button, top right in both views */
      .zoom { all: unset; cursor: pointer; flex: none; width: 26px; height: 26px; border-radius: 50%;
              display: grid; place-items: center; color: var(--secondary-text-color); }
      .zoom:hover { background: color-mix(in srgb, var(--secondary-text-color) 14%, transparent); color: var(--primary-text-color); }
      .zoom:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
      .zoom ha-icon { --mdc-icon-size: 16px; }
      /* A narrow mini card (6 columns of a phone section): the badge gives way, the header tightens */
      @container (max-width: 150px) {
        .mini > .badge { display: none; }
        .mini .head { gap: 4px; }
      }
    `;
  }
}
