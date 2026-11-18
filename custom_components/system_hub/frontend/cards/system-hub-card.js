// System Hub's Lovelace cards: one card and one mini card, `module:` picking what they show.
//   type: custom:system-hub-card        module: status (default), system, watchdog, marketplace, batteries, git_sync,
//                                       automations, orphans
//   type: custom:system-hub-mini-card   module: status (default), system, watchdog, batteries, git_sync, automations,
//                                       orphans
// A module's card is the one its own file defines (sh-<module>-card, sh-<module>-mini-card), with its options
// unchanged. The status cards show the Status tab of the panel: they read it with the panel's own code (its module,
// without showing it), as the sidebar icon does, so the three always agree. Administrators only, as the panel.

var SYSTEM_HUB_CARD_VERSION = '2.10.3';
var SH_CARD_MODULES = ['status', 'system', 'watchdog', 'marketplace', 'batteries', 'git_sync', 'automations', 'orphans'];
var SH_MINI_MODULES = ['status', 'system', 'watchdog', 'batteries', 'git_sync', 'automations', 'orphans'];
var SH_CARD_GROUPS = ['system', 'reliability', 'maintenance', 'devices'];
var SH_CARD_TAG = (module, mini) => `sh-${module.replace('_', '-')}${mini ? '-mini' : ''}-card`;
// The status read again every 30 seconds at most, whichever card asks
var SH_CARD_READ_MS = 30000;

function shCardEsc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

// The panel's strings (selector.panel), loaded once
async function shCardStrings(hass) {
  try {
    await hass.loadBackendTranslation?.('selector', 'system_hub');
  } catch (_err) {
    // the English fallbacks below
  }
}

function shCardT(hass, key, fallback, vars) {
  try {
    var text = hass?.localize?.(`component.system_hub.selector.panel.options.${key}`, vars || {});
    if (text) return text;
  } catch (_err) {
    // the fallback
  }
  return String(fallback).replace(/\{(\w+)\}/g, (_m, name) => String(vars?.[name] ?? ''));
}

// The panel read without being shown: one for the page, shared with the sidebar icon (system-hub-icons.js)
async function shCardProbe(hass) {
  var panel = hass?.panels?.['system-hub'];
  if (!hass?.user?.is_admin || !panel) throw new Error('admin');
  if (!customElements.get('system-hub-panel')) await import(panel.config._panel_custom.module_url);
  var Panel = customElements.get('system-hub-panel');
  var probe = (window.__systemHubProbe ??= new Panel());
  probe._headless = true;
  probe._hass = hass;
  if (!probe._cardRead || Date.now() - probe._cardAt > SH_CARD_READ_MS) {
    probe._cardAt = Date.now();
    probe._cardRead = (async () => {
      if (!probe._localize) await probe._loadStrings();
      await probe._load();
    })();
  }
  await probe._cardRead;
  return probe;
}

// The areas of the Status tab, by group, the ones not wanted left out
function shCardStatus(probe, config) {
  var Panel = probe.constructor;
  var { areas, counts, score, tone } = probe._stTone();
  var groups = Array.isArray(config.groups) && config.groups.length ? config.groups : SH_CARD_GROUPS;
  var shown = areas.filter(([tab, [t]]) => groups.includes(Panel.groupOf(tab)) && !(config.hide_ok && t === 'good'));
  var points = counts.bad + counts.warn + counts.info;
  return { areas: shown, all: areas, counts, score, tone, points };
}

// The status pill after the title: a dot and the health score, in the overall tone (the header icon's colour).
function shCardPill(status) {
  var text = `${status.score}/100`;
  return `<span class="chip ${status.tone}" title="${shCardEsc(text)}" aria-label="${shCardEsc(text)}"><span class="cdot"></span><span class="ct">${shCardEsc(text)}</span></span>`;
}

function shCardOpen(tab) {
  history.pushState(null, '', `/system-hub/${tab}`);
  window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: false } }));
}

// The illustrated header: a home server's dashboard on a 200 × 80 picture at the right of a 90 px banner (the host,
// the health score ring, the containers, the batteries, the updates and the watchdog, each in the tone of its Status
// area), a 10 px concrete floor edge to edge under it, and the title on the open background at its left.
var SH_HUB_COLORS = { good: '#43a047', warn: '#f5a623', bad: '#e5484d', info: '#2f80ed' };
var SH_HUB_LED = { good: '#43c463', warn: '#f5a623', bad: '#e5484d', info: '#43c463' };

// Night picture: forced by illustration_theme, else Home Assistant's dark mode alone (a light theme keeps the day
// picture after sunset; a day picture on a dark card would glare).
function shHubIsNight(hass, config) {
  if (config?.illustration_theme === 'night') return true;
  if (config?.illustration_theme === 'day') return false;
  return !!hass?.themes?.darkMode;
}

// The tone of each part of the picture: its Status area when the module is on (whatever groups the card shows),
// else fine. `score` (0–100) fills the ring, in the overall tone.
function shHubTones(status) {
  var of = (tab) => status.all.find(([t]) => t === tab)?.[1] || ['good', ''];
  return { tone: status.tone, score: status.score, system: of('system'), containers: of('containers'), batteries: of('batteries'), updates: of('marketplace'), watchdog: of('watchdog') };
}

function shHubScene(t, n) {
  var c = (tone) => SH_HUB_COLORS[tone] || SH_HUB_COLORS.good;
  var line = n ? '#2e3a4e' : '#c9d2de';
  var [sys] = t.system;
  var [cont] = t.containers;
  var [bat] = t.batteries;
  var [upd, updValue] = t.updates;
  var [dog] = t.watchdog;
  var score = Math.max(0, Math.min(100, Number(t.score) || 0));
  var level = bat === 'bad' ? 3 : bat === 'warn' ? 6 : 14;
  var count = Number.parseInt(updValue, 10);
  var updBadge =
    upd === 'good' || upd === 'info'
      ? ''
      : `<g class="sh-pop"><circle cx="6" cy="-6" r="3.6" fill="${c(upd)}"/><text x="6" y="-4.3" text-anchor="middle" font-size="5" font-weight="700" fill="#fff" font-family="sans-serif">${count > 0 && count < 100 ? count : '!'}</text></g>`;
  var dogMark = dog === 'bad' ? 'M-2 -2.6 l4 4 M2 -2.6 l-4 4' : dog === 'warn' ? 'M0 -3 v2.8 M0 2 v.2' : 'M-2.2 -.4 l1.6 1.6 l3 -3.2';
  var bar = cont === 'bad' ? c('bad') : cont === 'warn' ? c('warn') : '#7f77dd';
  return `<svg class="sh-scene" viewBox="0 0 200 80" preserveAspectRatio="xMaxYMax meet" aria-hidden="true" focusable="false">
    <rect width="200" height="80" fill="${n ? '#1c2230' : '#eef2f7'}"/>
    <g stroke="${line}" stroke-width="1" stroke-dasharray="2 2"><line x1="110" y1="44" x2="102" y2="28"/><line x1="142" y1="40" x2="154" y2="28"/><line x1="142" y1="48" x2="160" y2="50"/><line x1="110" y1="50" x2="104" y2="58"/><line x1="130" y1="58" x2="138" y2="62"/></g>
    <g transform="translate(126 44)"><rect x="-16" y="-14" width="32" height="28" rx="5" fill="${n ? '#3a4456' : '#fff'}" stroke="${sys === 'bad' ? c('bad') : n ? '#55617a' : '#c9d2de'}"/><path d="M0 -8 l8 7 h-3 v8 h-10 v-8 h-3z" fill="#2f80ed"/><circle class="sh-blink" cx="11" cy="9" r="1.4" fill="${SH_HUB_LED[sys] || SH_HUB_LED.good}"/></g>
    <g transform="translate(166 22)"><circle r="12" fill="none" stroke="${n ? '#2e3a4e' : '#dfe6ef'}" stroke-width="4"/><circle class="sh-gauge" r="12" fill="none" stroke="${c(t.tone)}" stroke-width="4" stroke-dasharray="${((score * 75.4) / 100).toFixed(1)} 100" transform="rotate(-90)"/><text y="2.6" text-anchor="middle" font-size="7.4" font-weight="700" font-family="sans-serif" fill="${n ? '#e6e9ee' : '#2a3038'}">${score}</text></g>
    <g transform="translate(172 52)">${[0, 1, 2]
      .map((i) => `<rect x="${-12 + i * 8}" y="${-6 - (i % 2) * 6}" width="7" height="6" fill="${['#2496ed', '#43a047', '#f5b400'][i]}" stroke="#fff" stroke-width=".4"/>`)
      .join('')}<rect class="${cont === 'bad' ? 'sh-blink' : ''}" x="-12" y="0" width="23" height="6" fill="${bar}" stroke="#fff" stroke-width=".4"/></g>
    <g transform="translate(96 22)"><rect x="-6" y="-10" width="12" height="20" rx="2" fill="none" stroke="${n ? '#8fa3c4' : '#5f6b7a'}" stroke-width="1.4"/><rect x="-2" y="-12" width="4" height="2" fill="${n ? '#8fa3c4' : '#5f6b7a'}"/><rect class="${bat === 'bad' ? 'sh-blink' : ''}" x="-4" y="${8 - level}" width="8" height="${level}" rx="1" fill="${c(bat === 'info' ? 'good' : bat)}"/></g>
    <g transform="translate(98 62)"><circle r="7" fill="${n ? '#2a3446' : '#fff'}" stroke="#2f80ed"/><path class="sh-up" d="M0 3 v-6 m-3 3 l3 -3 l3 3" stroke="#2f80ed" stroke-width="1.4" fill="none"/>${updBadge}</g>
    <g transform="translate(146 66)"><path d="M0 -8 l6.4 2.4 v4.4 c0 4 -2.8 6.6 -6.4 8.2 c-3.6 -1.6 -6.4 -4.2 -6.4 -8.2 v-4.4z" fill="${c(dog === 'info' ? 'good' : dog)}" stroke="${n ? '#1c2230' : '#fff'}" stroke-width=".8"/><path d="${dogMark}" stroke="#fff" stroke-width="1.5" stroke-linecap="round" fill="none"/>${dog === 'good' || dog === 'info' ? '<circle class="sh-ping" r="9" fill="none" stroke="#43a047" stroke-width=".8"/>' : ''}</g>
  </svg>`;
}

var SH_HUB_STYLE = `
  ha-card.illus { padding:0; overflow:hidden; }
  .banner { position:relative; height:90px; overflow:hidden; cursor:pointer; background:#eef2f7; color:#0d2a45; }
  .banner.night { background:#1c2230; color:#fff; }
  .sh-scene { position:absolute; right:0; bottom:10px; height:80px; width:min(200px, 62%);
              -webkit-mask-image:linear-gradient(90deg, transparent 0, #000 14%); mask-image:linear-gradient(90deg, transparent 0, #000 14%); }
  .ground { position:absolute; left:0; right:0; bottom:0; height:10px; background:#9aa1a9; box-shadow:inset 0 2px 0 #b5bbc2; }
  .night .ground { background:#2c323b; box-shadow:none; }
  .htext { position:absolute; z-index:1; left:0; top:0; bottom:10px; right:min(200px, 62%); display:flex; align-items:center; gap:10px;
           padding:8px 8px 8px 14px; min-width:0; }
  .hicon { width:40px; height:40px; flex:none; border-radius:50%; display:grid; place-items:center; --mdc-icon-size:24px; color:var(--sh-tone);
           background:rgba(255,255,255,.62); box-shadow:inset 0 0 0 1px color-mix(in srgb, var(--sh-tone) 22%, transparent); }
  .night .hicon { background:rgba(255,255,255,.12); }
  .htext .who { flex:1; min-width:0; }
  .htext .title { font-size:16px; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:inherit; }
  .htext .sub { font-size:13px; color:#3b5b78; }
  .night .htext .sub { color:rgba(255,255,255,.78); }
  .htext .dots { justify-content:flex-start; max-width:none; margin-top:4px; flex-wrap:nowrap; overflow:hidden; }
  /* The pill under the subtitle (see _fitPill): the area dots beside it, on the same line. */
  .htext .who.pill-below { flex-direction:row; flex-wrap:wrap; align-items:center; align-content:center; column-gap:8px; }
  .htext .who.pill-below > .trow > .title, .htext .who.pill-below > .sub { flex:1 0 100%; min-width:0; }
  .htext .who.pill-below > .dots { order:3; margin-top:2px; flex:0 1 auto; min-width:0; }
  /* A narrow card: no room for the picture beside the text, the background alone stays. */
  .banner { container:sh-banner / inline-size; }
  @container sh-banner (max-width: 300px) { .sh-scene { display:none; } .htext { right:0; } }
  .banner .chip { background:color-mix(in srgb, var(--c) 18%, rgba(255,255,255,.78)); color:color-mix(in srgb, var(--c) 45%, #0d2a45); }
  .banner.night .chip { background:color-mix(in srgb, var(--c) 30%, rgba(8,18,38,.55)); color:color-mix(in srgb, var(--c) 35%, #ffffff); }
  .body { padding:0 16px 14px; }
  .sh-blink { animation:sh-bl 1.2s steps(2) infinite; }
  .sh-gauge { animation:sh-bl 3s ease-in-out infinite; }
  .sh-up { animation:sh-up 1.4s ease-in-out infinite; }
  .sh-ping { transform-box:fill-box; transform-origin:center; animation:sh-ping 2.4s ease-out infinite; }
  .sh-pop { animation:sh-bl 1.6s ease-in-out infinite; }
  @keyframes sh-bl { 50% { opacity:.25; } }
  @keyframes sh-up { 50% { transform:translateY(-1.5px); } }
  @keyframes sh-ping { from { opacity:.8; transform:scale(.7); } to { opacity:0; transform:scale(1.25); } }
  @media (prefers-reduced-motion: reduce) { .sh-scene * { animation:none !important; } }
`;

var SH_CARD_STYLE = `
  :host { display:block; }
  ha-card { padding:14px 16px; --sh-good: var(--success-color, #43a047); --sh-warn: var(--warning-color, #ffa600);
            --sh-bad: var(--error-color, #db4437); --sh-info: var(--info-color, #039be5); }
  .head { display:flex; align-items:center; gap:12px; cursor:pointer; }
  .badge { width:48px; height:48px; border-radius:50%; flex:none; display:flex; align-items:center; justify-content:center;
           --mdc-icon-size:30px; color:var(--sh-tone); background:color-mix(in srgb, var(--sh-tone) 14%, transparent); }
  .mini .badge { width:36px; height:36px; --mdc-icon-size:22px; }
  .good { --sh-tone: var(--sh-good); } .warn { --sh-tone: var(--sh-warn); } .bad { --sh-tone: var(--sh-bad); } .info { --sh-tone: var(--sh-info); }
  .who { flex:1; min-width:0; }
  .title { font-size:17px; color:var(--primary-text-color); }
  .mini .title { font-size:15px; }
  .sub { font-size:12.5px; color:var(--secondary-text-color); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  :host([hide-title]) .head .who > .trow > .title, :host([hide-subtitle]) .head .who > .sub,
  :host([hide-title]) .htext .who > .trow > .title, :host([hide-subtitle]) .htext .who > .sub { display:none; }
  .open { color:var(--secondary-text-color); --mdc-icon-size:20px; }
  .group { font-size:11px; letter-spacing:.08em; text-transform:uppercase; color:var(--secondary-text-color); margin:12px 0 6px; }
  .areas { display:grid; grid-template-columns:repeat(auto-fill, minmax(170px, 1fr)); gap:6px; }
  .area { display:flex; align-items:center; gap:8px; padding:6px 8px; border-radius:10px; cursor:pointer; text-align:left; font:inherit;
          border:0; color:inherit; background:color-mix(in srgb, var(--sh-tone, var(--secondary-text-color)) 9%, transparent); --mdc-icon-size:18px; }
  .area ha-icon { color:var(--sh-tone); flex:none; }
  .area .who div:first-child { font-size:12px; color:var(--secondary-text-color); }
  .area .who div:last-child { font-size:13.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .dot { width:8px; height:8px; border-radius:50%; flex:none; background:var(--sh-tone); }
  .mini { display:flex; align-items:center; gap:12px; padding:10px 14px; cursor:pointer; }
  .dots { display:flex; gap:3px; flex-wrap:wrap; justify-content:flex-end; max-width:40%; }
  .note { color:var(--secondary-text-color); }
  .trow > .title { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .chip { --c:var(--sh-tone); display:inline-flex; align-items:center; gap:5px; padding:1px 8px; border-radius:12px;
          font-size:11px; font-weight:500; line-height:16px; white-space:nowrap; color:color-mix(in srgb, var(--c) 50%, var(--primary-text-color));
          background:color-mix(in srgb, var(--c) 15%, transparent); }
  .chip .cdot { width:7px; height:7px; border-radius:50%; flex:none; background:var(--c); }
  .chip .ct { white-space:nowrap; }

  /* The status pill: on the title row, 8 px after the title, only when the whole title and the pill's whole label fit
     there; otherwise on its own line under the subtitle, which then keeps one line; its dot alone at 200 px or less
     or when its label does not fit the title block (its text stays in its title and for screen readers). Measured
     after each render (_fitPill), in every language, never by a fixed width. */
  .trow { display: flex; flex-wrap: nowrap; align-items: center; gap: 8px; min-width: 0; }
  .trow > .title { flex: 0 1 auto; min-width: 0; }
  .trow > .chip { flex: none; min-width: auto; max-width: none; overflow: visible; align-self: center; margin-top: 0; }
  .trow > .chip .ct { min-width: auto; overflow: visible; white-space: nowrap; display: inline; -webkit-line-clamp: none; line-clamp: none; }
  .who.pill-below { display: flex; flex-direction: column; align-items: stretch; }
  .who.pill-below > * { order: 3; }
  .who.pill-below > .trow { display: contents; }
  .who.pill-below > .sub { order: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .who.pill-below > .trow > .chip { order: 2; align-self: flex-start; margin-top: 2px; }
  .who.pill-dot > .trow > .chip { padding: 4px; gap: 0; }
  .who.pill-dot > .trow > .chip .dot { display: block; }
  .who.pill-dot > .trow > .chip .ct { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
`;

// The parts of the header that hold the status pill (see _fitPill).
var SH_CARD_PILL = { block: '.who', row: '.trow', name: '.title', chip: '.chip', sub: '.sub' };

// A card of a module (its own card element), or the Status card
class SystemHubCardBase extends HTMLElement {
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
    else customElements.whenDefined(tag).then(mount);
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

  _statusCard(status) {
    var p = this._probe;
    var { title, sub } = this._summary(status);
    var Panel = p.constructor;
    var area = ([tab, [tone, value]]) => `<button class="area ${tone}" data-tab="${tab}" title="${shCardEsc(p._tabName(tab))}">
        <ha-icon icon="${Panel.ICONS[tab]}"></ha-icon><div class="who"><div>${shCardEsc(p._tabName(tab))}</div><div>${shCardEsc(value)}</div></div><span class="dot"></span></button>`;
    var groups = SH_CARD_GROUPS.map((g) => [g, status.areas.filter(([tab]) => Panel.groupOf(tab) === g)])
      .filter(([, list]) => list.length)
      .map(([g, list]) => `<div class="group">${shCardEsc(p._groupName(g))}</div><div class="areas">${list.map(area).join('')}</div>`)
      .join('');
    if (this._config.illustration === false) {
      return `<ha-card><div class="head ${status.tone}" data-tab="status"><div class="badge"><ha-icon icon="system-hub:${status.tone}"></ha-icon></div>
      <div class="who"><div class="trow"><div class="title">${shCardEsc(title)}</div>${shCardPill(status)}</div>${sub ? `<div class="sub" title="${shCardEsc(sub)}">${shCardEsc(sub)}</div>` : ''}</div><ha-icon class="open" icon="mdi:open-in-new"></ha-icon></div>${groups}</ha-card>`;
    }
    var head = `<div class="who"><div class="trow"><div class="title">${shCardEsc(title)}</div>${shCardPill(status)}</div>${sub ? `<div class="sub" title="${shCardEsc(sub)}">${shCardEsc(sub)}</div>` : ''}</div>`;
    return `<ha-card class="illus">${this._banner(status, head)}${groups ? `<div class="body">${groups}</div>` : ''}</ha-card>`;
  }

  // The illustrated header: the server icon in the overall tone, the text on the background at the left, the picture
  // at the right (each part in the tone of its area) and the floor under it. The whole banner opens the Status tab.
  _banner(status, head) {
    var night = shHubIsNight(this._hass, this._config);
    return `<div class="banner ${status.tone}${night ? ' night' : ''}" data-tab="status">${shHubScene(shHubTones(status), night)}<div class="ground"></div>
      <div class="htext"><div class="hicon" title="System Hub"><ha-icon icon="mdi:nas"></ha-icon></div>${head}</div></div>`;
  }
}

class SystemHubCard extends SystemHubCardBase {
  static getConfigElement() {
    return document.createElement('system-hub-card-editor');
  }

  static getStubConfig() {
    return { module: 'status' };
  }
}

class SystemHubMiniCard extends SystemHubCardBase {
  static get mini() {
    return true;
  }

  static getConfigElement() {
    return document.createElement('system-hub-mini-card-editor');
  }

  static getStubConfig() {
    return { module: 'status' };
  }

  // One line: the emblem, the summary, the details of the first areas to look at and a dot per area
  _statusCard(status) {
    var p = this._probe;
    var { title } = this._summary(status);
    var order = { bad: 0, warn: 1, info: 2 };
    var look = status.areas.filter(([, [tone]]) => tone !== 'good').sort((a, b) => order[a[1][0]] - order[b[1][0]]);
    var sub = look.length
      ? look
          .slice(0, 3)
          .map(([, [, value]]) => value)
          .join(' · ')
      : '';
    var dots = look.map(([tab, [tone]]) => `<span class="dot ${tone}" title="${shCardEsc(p._tabName(tab))}"></span>`).join('');
    if (this._config.illustration !== false) {
      var head = `<div class="who"><div class="trow"><div class="title">${shCardEsc(title)}</div>${shCardPill(status)}</div>${sub ? `<div class="sub" title="${shCardEsc(sub)}">${shCardEsc(sub)}</div>` : ''}${dots ? `<div class="dots">${dots}</div>` : ''}</div>`;
      return `<ha-card class="illus">${this._banner(status, head)}</ha-card>`;
    }
    return `<ha-card class="mini ${status.tone}" data-tab="status"><div class="badge"><ha-icon icon="system-hub:${status.tone}"></ha-icon></div>
      <div class="who"><div class="trow"><div class="title">${shCardEsc(title)}</div>${shCardPill(status)}</div>${sub ? `<div class="sub" title="${shCardEsc(sub)}">${shCardEsc(sub)}</div>` : ''}</div><div class="dots">${dots}</div></ha-card>`;
  }
}

// The editor: the module first, then the module's own editor (or the Status card's options)
class SystemHubCardEditorBase extends HTMLElement {
  static get mini() {
    return false;
  }

  setConfig(config) {
    this._config = { ...config, module: config?.module || 'status' };
    this._render();
  }

  set hass(hass) {
    var first = !this._hass;
    this._hass = hass;
    if (this._form) this._form.hass = hass;
    if (this._inner) this._inner.hass = hass;
    if (first) shCardStrings(hass).then(() => this._render());
  }

  set lovelace(lovelace) {
    this._lovelace = lovelace;
    if (this._inner) this._inner.lovelace = lovelace;
  }

  _t(key, fallback, vars) {
    return shCardT(this._hass, key, fallback, vars);
  }

  _schema() {
    var modules = this.constructor.mini ? SH_MINI_MODULES : SH_CARD_MODULES;
    var options = modules.map((m) => ({ value: m, label: this._t(`tab_${m}`, m) }));
    var schema = [{ name: 'module', selector: { select: { mode: 'dropdown', options } } }];
    if (this._config.module === 'status') {
      schema.push(
        {
          name: 'groups',
          selector: {
            select: {
              multiple: true,
              mode: 'list',
              options: SH_CARD_GROUPS.map((g) => ({ value: g, label: g === 'system' ? this._t('system', 'System') : this._t(`group_${g}`, g) })),
            },
          },
        },
        { name: 'illustration', selector: { boolean: {} } },
        {
          name: 'illustration_theme',
          selector: { select: { mode: 'dropdown', options: ['auto', 'day', 'night'].map((v) => ({ value: v, label: this._t(`card_theme_${v}`, { auto: 'Automatic (follows the theme)', day: 'Day', night: 'Night' }[v]) })) } },
        },
      );
      // The mini card shows only the summary and the areas to look at: these three change nothing there.
      if (!this.constructor.mini) {
        schema.push(
          { name: 'show_title', selector: { boolean: {} } },
          { name: 'show_subtitle', selector: { boolean: {} } },
          { name: 'hide_ok', selector: { boolean: {} } },
        );
      }
    }
    return schema;
  }

  _emit(config) {
    this._config = config;
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config }, bubbles: true, composed: true }));
  }

  _render() {
    if (!this._config) return;
    if (!this.shadowRoot) {
      this.attachShadow({ mode: 'open' });
      this.shadowRoot.innerHTML = '<div class="form"></div><div class="inner"></div>';
      this.shadowRoot.querySelector('.inner').addEventListener('config-changed', (ev) => {
        // The module's editor: its options, the type and the module kept
        if (ev.target === this) return;
        ev.stopPropagation();
        var inner = { ...ev.detail.config };
        delete inner.type;
        this._emit({ type: this._config.type, module: this._config.module, ...inner });
      });
    }
    if (!this._form) {
      this._form = document.createElement('ha-form');
      this._form.computeLabel = (s) =>
        ({ module: this._t('card_module', 'Module'), groups: this._t('card_groups', 'Groups'), hide_ok: this._t('card_hide_ok', 'Hide what is fine'), show_title: this._t('card_show_title', 'Show title'), show_subtitle: this._t('card_show_subtitle', 'Show subtitle'), illustration: this._t('card_illustration', 'Illustration'), illustration_theme: this._t('card_illustration_theme', 'Illustration theme') })[s.name] || s.name;
      this._form.addEventListener('value-changed', (ev) => {
        ev.stopPropagation();
        var value = ev.detail.value;
        if (value.module !== this._config.module) {
          // Another module: its own options start again
          this._emit({ type: this._config.type, module: value.module });
          this._render();
          return;
        }
        var config = { ...this._config, ...value };
        if (!config.groups?.length) delete config.groups;
        if (!config.hide_ok) delete config.hide_ok;
        if (config.show_title === true) delete config.show_title;
        if (config.show_subtitle === true) delete config.show_subtitle;
        if (config.illustration === true) delete config.illustration;
        if (!config.illustration_theme || config.illustration_theme === 'auto') delete config.illustration_theme;
        this._emit(config);
      });
      this.shadowRoot.querySelector('.form').appendChild(this._form);
    }
    this._form.hass = this._hass;
    this._form.schema = this._schema();
    this._form.data = this._config.module === 'status' ? { show_title: true, show_subtitle: true, illustration: true, illustration_theme: 'auto', ...this._config } : this._config;
    this._mountInner();
  }

  _mountInner() {
    var holder = this.shadowRoot.querySelector('.inner');
    var module = this._config.module;
    if (module === 'status') {
      this._inner = null;
      this._innerModule = null;
      holder.replaceChildren();
      return;
    }
    var tag = SH_CARD_TAG(module, this.constructor.mini);
    var Card = customElements.get(tag);
    if (!Card) {
      customElements.whenDefined(tag).then(() => this._mountInner());
      return;
    }
    if (this._innerModule !== module) {
      this._innerModule = module;
      this._inner = Card.getConfigElement ? Card.getConfigElement() : null;
      holder.replaceChildren(...(this._inner ? [this._inner] : []));
    }
    if (!this._inner) return;
    var inner = { ...this._config };
    delete inner.module;
    if (this._hass) this._inner.hass = this._hass;
    if (this._lovelace) this._inner.lovelace = this._lovelace;
    this._inner.setConfig(inner);
  }
}

class SystemHubCardEditor extends SystemHubCardEditorBase {}

class SystemHubMiniCardEditor extends SystemHubCardEditorBase {
  static get mini() {
    return true;
  }
}

if (!customElements.get('system-hub-card')) {
  customElements.define('system-hub-card', SystemHubCard);
  customElements.define('system-hub-card-editor', SystemHubCardEditor);
  customElements.define('system-hub-mini-card', SystemHubMiniCard);
  customElements.define('system-hub-mini-card-editor', SystemHubMiniCardEditor);
  window.customCards = window.customCards || [];
  window.customCards.push(
    {
      type: 'system-hub-card',
      name: 'System Hub',
      description: 'The status of Home Assistant at a glance, or one module of System Hub (module:)',
      preview: true,
      documentationURL: 'https://github.com/juju35/ha-system-hub#lovelace-cards',
    },
    {
      type: 'system-hub-mini-card',
      name: 'System Hub Mini',
      description: 'The status of Home Assistant on one line, or the mini card of one module of System Hub (module:)',
      preview: true,
      documentationURL: 'https://github.com/juju35/ha-system-hub#lovelace-cards',
    },
  );
  console.info(`%c SYSTEM-HUB-CARD %c v${SYSTEM_HUB_CARD_VERSION} `, 'background:#03a9f4;color:#fff;font-weight:700', '');
}
