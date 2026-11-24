// A card of a module (its own card element), or the Status card
import { SH_CARD_GROUPS, SH_CARD_MODULES, SH_CARD_READ_MS, SH_CARD_TAG, SH_MINI_MODULES, shCardEsc, shCardOpen, shCardPill, shCardProbe, shCardStatus, shCardStrings, shCardT } from "./core.js";
import { shHubIsNight, shHubScene, shHubTones } from "./illustrated-header.js";
import { SH_CARD_PILL, SH_CARD_STYLE, SH_HUB_STYLE } from "./styles.js";

export class SystemHubCardBase extends HTMLElement {
  static get mini() {
    return false;
  }

  setConfig(config) {
    var module = config?.module || 'status';
    var modules = this.constructor.mini ? SH_MINI_MODULES : SH_CARD_MODULES;
    if (!modules.includes(module)) throw new Error(`Unknown System Hub module: ${module} (${modules.join(', ')})`);
    this._config = { ...config, module };
    // show_title / show_subtitle (status module): the header's title / subtitle, hidden by the stylesheet
    this.toggleAttribute?.('hide-title', config?.show_title === false);
    this.toggleAttribute?.('hide-subtitle', config?.show_subtitle === false);
    if (module === 'status') {
      this._inner = null;
      this.innerHTML = '';
      if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
      this._renderStatus();
      return;
    }
    if (this.shadowRoot) this.shadowRoot.innerHTML = '<slot></slot>';
    var tag = SH_CARD_TAG(module, this.constructor.mini);
    var inner = { ...config };
    delete inner.module;
    var mount = (Card) => {
      if (this._config?.module !== module) return;
      if (!(this._inner instanceof Card)) {
        this._inner = document.createElement(tag);
        this.replaceChildren(this._inner);
      }
      this._inner.setConfig(inner);
      if (this._hass) this._inner.hass = this._hass;
    };
    var Card = customElements.get(tag);
    if (Card) mount(Card);
    else {
      customElements.whenDefined(tag).then(mount);
      this._waitModule(module, tag);
    }
  }

  // A module turned off: its card is not loaded on the dashboards (cards.py), so it never comes. Said so after a
  // while, rather than an empty spot; replaced by the card if it comes after all.
  _waitModule(module, tag) {
    if (typeof setTimeout !== 'function') return;
    clearTimeout(this._moduleTimer);
    this._moduleTimer = setTimeout(() => {
      if (this._config?.module !== module || customElements.get(tag)) return;
      var note = document.createElement('ha-card');
      note.style.cssText = 'display:block;padding:12px 16px;color:var(--secondary-text-color)';
      note.textContent = shCardT(this._hass, 'card_module_off', 'System Hub: turn the {module} module on to show this card', {
        module: shCardT(this._hass, `tab_${module}`, module),
      });
      this._inner = null;
      this.replaceChildren(note);
    }, 5000);
  }

  set hass(hass) {
    var first = !this._hass;
    this._hass = hass;
    if (this._inner) this._inner.hass = hass;
    else if (this._config?.module === 'status' && (first || Date.now() - (this._readAt || 0) > SH_CARD_READ_MS)) this._read();
    else if (this._config?.module === 'status' && this._night !== undefined && this._night !== shHubIsNight(hass, this._config)) this._renderStatus();
  }

  connectedCallback() {
    if (this._config?.module !== 'status') return;
    this._timer ??= setInterval(() => !document.hidden && this._read(), SH_CARD_READ_MS);
  }

  disconnectedCallback() {
    clearInterval(this._timer);
    this._timer = null;
    this._unwatchPill();
  }

  // The status pill goes on the title row, right after the title, only when the whole title and the pill's whole
  // label fit there; otherwise it takes its own line under the subtitle (the subtitle then on one line). Its dot
  // alone on a card 200 px wide or less, or when its label is wider than the title block (or, in a banner, would not
  // fit above the ground strip). Measured after each render and on every new width (or once the web font is loaded),
  // never by a fixed width; $SH_CARD_PILL names the parts.
  _fitPill() {
    const S = SH_CARD_PILL;
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

  async _read() {
    if (!this._hass) return;
    this._readAt = Date.now();
    try {
      await shCardStrings(this._hass);
      this._probe = await shCardProbe(this._hass);
      this._error = null;
    } catch (err) {
      this._error = err?.message === 'admin' ? 'admin' : String(err?.message || err);
    }
    this._renderStatus();
  }

  getCardSize() {
    if (this._inner?.getCardSize) return this._inner.getCardSize();
    return this.constructor.mini ? 1 : 6;
  }

  getGridOptions() {
    if (this._inner?.getGridOptions) return this._inner.getGridOptions();
    // Before a module's card is defined (its file still loading), the size it will ask for: half a section for a
    // module's mini card, the whole width otherwise; the height follows the content
    var half = this.constructor.mini && this._config?.module !== 'status';
    return { columns: half ? 6 : 12, min_columns: 6, rows: 'auto' };
  }

  _note(text) {
    return `<ha-card class="mini note">${shCardEsc(text)}</ha-card>`;
  }

  _renderStatus() {
    var root = this.shadowRoot;
    if (!root || this._config?.module !== 'status') return;
    var hass = this._hass;
    var body;
    if (this._error === 'admin') body = this._note(shCardT(hass, 'card_admin_only', 'System Hub: for administrators only'));
    else if (this._error) body = this._note(shCardT(hass, 'failed', 'Failed: {error}', { error: this._error }));
    else if (!this._probe?._state) body = this._note(shCardT(hass, 'loading', 'Loading…'));
    else body = this._statusCard(shCardStatus(this._probe, this._config));
    this._night = shHubIsNight(hass, this._config);
    var illus = this._config.illustration !== false ? SH_HUB_STYLE : '';
    root.innerHTML = `<style>${SH_CARD_STYLE}${illus}</style>${body}`;
    this._watchPill();
    this._fitPill();
    for (var el of root.querySelectorAll('[data-tab]')) {
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        shCardOpen(ev.currentTarget.dataset.tab);
      });
    }
    this._bindZoom?.();
  }

  _summary(status) {
    var p = this._probe;
    var title = status.points ? p._t(status.points === 1 ? 'st_point' : 'st_points', { n: status.points }) : p._t('st_all_good');
    var parts = [
      ['bad', 'st_n_bad'],
      ['warn', 'st_n_warn'],
      ['info', 'st_n_info'],
    ]
      .filter(([tone]) => status.counts[tone])
      .map(([tone, key]) => p._t(key, { n: status.counts[tone] }));
    // The score is in the pill after the title.
    return { title, sub: parts.join(' · ') };
  }

  // The areas of the Status tab by group, each opening its tab
  _groups(status) {
    var p = this._probe;
    var Panel = p.constructor;
    var area = ([tab, [tone, value]]) => `<button class="area ${tone}" data-tab="${tab}" title="${shCardEsc(p._tabName(tab))}">
        <ha-icon icon="${Panel.ICONS[tab]}"></ha-icon><div class="who"><div>${shCardEsc(p._tabName(tab))}</div><div>${shCardEsc(value)}</div></div><span class="dot"></span></button>`;
    return SH_CARD_GROUPS.map((g) => [g, status.areas.filter(([tab]) => Panel.groupOf(tab) === g)])
      .filter(([, list]) => list.length)
      .map(([g, list]) => `<div class="group">${shCardEsc(p._groupName(g))}</div><div class="areas">${list.map(area).join('')}</div>`)
      .join('');
  }

  _statusCard(status) {
    var { title, sub } = this._summary(status);
    var groups = this._groups(status);
    if (this._config.illustration === false) {
      return `<ha-card><div class="head ${status.tone}" data-tab="status"><div class="badge"><ha-icon icon="system-hub:${status.tone}"></ha-icon></div>
      <div class="who"><div class="trow"><div class="title">${shCardEsc(title)}</div>${shCardPill(status)}</div>${sub ? `<div class="sub" title="${shCardEsc(sub)}">${shCardEsc(sub)}</div>` : ''}</div><ha-icon class="open" icon="mdi:open-in-new"></ha-icon></div>${groups}</ha-card>`;
    }
    var head = `<div class="who"><div class="trow"><div class="title">${shCardEsc(title)}</div>${shCardPill(status)}</div>${sub ? `<div class="sub" title="${shCardEsc(sub)}">${shCardEsc(sub)}</div>` : ''}</div>`;
    return `<ha-card class="illus">${this._banner(status, head)}${groups ? `<div class="body">${groups}</div>` : ''}</ha-card>`;
  }

  // The illustrated header: the server icon in the overall tone, the text on the background at the left, the picture
  // at the right (each part in the tone of its area) and the floor under it. The whole banner opens the Status tab.
  _banner(status, head, extra = '') {
    var night = shHubIsNight(this._hass, this._config);
    return `<div class="banner ${status.tone}${night ? ' night' : ''}" data-tab="status">${shHubScene(shHubTones(status), night)}<div class="ground"></div>
      <div class="htext"><div class="hicon" title="System Hub"><ha-icon icon="mdi:nas"></ha-icon></div>${head}</div>${extra}</div>`;
  }
}
