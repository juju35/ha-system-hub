/*
 * System Hub sidebar panel (administrators): Status, the modules in four groups (System, Reliability, Maintenance,
 * Devices), and Settings.
 *
 * Tabs under the toolbar, as in Smart Comfort: text, the active one underlined, Settings last; a group's modules turned
 * on are sub-tabs under it. The module shown is in the address (/system-hub/<module>, or a group's name for its first). The panel draws its own content from the system_hub/state WebSocket command, read
 * again every 10 seconds while it is shown and after each action; its buttons call the integration's own actions.
 * Settings turns modules on or off and orders the tabs (system_hub/update_settings).
 *
 * Every string comes from the integration's translations (loaded with hass.loadBackendTranslation): the panel's
 * own under selector.panel, the buttons from the entity and action names, the modules from the config flow.
 *
 * https://github.com/juju35/ha-system-hub
 */
var SYSTEM_HUB_PANEL_VERSION = '2.4.0';
var SH_DOMAIN = 'system_hub';
var SH_REFRESH_MS = 10000;
// A state that could not be read (Home Assistant restarting, connection lost): read again after
var SH_RETRY_MS = 3000;
var SH_MODULE_ICONS = {
  status: 'mdi:heart-pulse',
  system: 'mdi:chip',
  containers: 'mdi:docker',
  watchdog: 'mdi:shield-search',
  marketplace: 'mdi:storefront-outline',
  database: 'mdi:database-outline',
  security: 'mdi:shield-lock-outline',
  backups: 'mdi:backup-restore',
  logs: 'mdi:text-box-search-outline',
  silent: 'mdi:access-point-off',
  batteries: 'mdi:battery-heart-variant',
  git_sync: 'mdi:source-branch-sync',
  automations: 'mdi:robot-confused-outline',
  orphans: 'mdi:ghost-outline',
  settings: 'mdi:cog-outline',
};
// The modules (their names when the translations are not loaded yet; the panel shows tab_<module>)
var SH_MODULE_NAMES = {
  containers: 'Containers',
  database: 'Database',
  security: 'Security',
  watchdog: 'Watchdog',
  marketplace: 'Marketplace',
  backups: 'Backups',
  logs: 'Logs',
  silent: 'Silent devices',
  batteries: 'Batteries',
  git_sync: 'Git Sync',
  automations: 'Automations',
  orphans: 'Orphans',
};
// The tabs under the toolbar: Status, one per group of modules (its modules as sub-tabs), Settings last
var SH_GROUPS = {
  system: ['system', 'containers', 'database', 'security'],
  reliability: ['logs', 'watchdog', 'automations'],
  maintenance: ['marketplace', 'backups', 'git_sync'],
  devices: ['silent', 'batteries', 'orphans'],
};
// The group of a tab; Status and Settings are groups of their own
function shGroupOf(tab) {
  return Object.keys(SH_GROUPS).find((g) => SH_GROUPS[g].includes(tab)) || tab;
}
// The tabs with the ones of a group side by side: the groups in the order of their first tab
function shGroupTabs(tabs) {
  var order = [...new Set(tabs || [])];
  return [...new Set(order.map(shGroupOf))].flatMap((g) => order.filter((t) => shGroupOf(t) === g));
}
// Every tab in its order, the ones not in it yet after (each in its group)
function shAllTabs(tabs) {
  var order = [...(tabs || [])];
  return shGroupTabs([...order, ...['status', 'system', ...Object.keys(SH_MODULE_NAMES)].filter((t) => !order.includes(t))]);
}
// Automations tab: the items shown per list before "Show more", as in the Automation Monitor card
var SH_AUTO_MAX = 5;
// Git Sync tab: the list of changed files is folded beyond this many
var SH_GIT_FILES_MAX = 5;

// The size of an update from its versions (v1.2.3 → v1.3.0: minor); null when they are not numbers
function shChange(from, to) {
  var parse = (v) => String(v || '').replace(/^v/i, '').split(/[.+-]/).slice(0, 3).map(Number);
  var a = parse(from);
  var b = parse(to);
  if (a.length < 2 || b.length < 2 || [...a, ...b].some((x) => Number.isNaN(x))) return null;
  if (b[0] !== a[0]) return 'major';
  if (b[1] !== a[1]) return 'minor';
  return 'patch';
}

// The start of release notes in plain text: Markdown and HTML left out, about 160 characters
function shExcerpt(text) {
  var plain = String(text || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}(#{1,6}|[-*+]|\d+\.)\s+/gm, '')
    .replace(/[`*_>~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > 160 ? `${plain.slice(0, 157).trimEnd()}…` : plain;
}

// A hue of its own for a name, for the initials that stand in for a missing logo
// juju35's projects, as the showcase site draws them (homeassistant-projects, src/data/projects.yaml): the MDI icon and
// the accent of each repository, for the Updates tab's cards of those without a picture of their own (the cards).
// A project missing here keeps its initial; the former names of the renamed repositories point to the current ones.
var SH_PROJECTS = {
  'ha-weather-card': ['weather-partly-cloudy', '#f5a623'],
  'ha-uv-card': ['sun-wireless', '#f2b100'],
  'ha-climate-air-card': ['air-conditioner', '#039be5'],
  'ha-smart-comfort': ['home-thermometer', '#26a69a'],
  'ha-heating-card': ['radiator', '#ef6c00'],
  'ha-room-card': ['floor-plan', '#5b6cf0'],
  'ha-energy-card': ['solar-power-variant', '#f9a825'],
  'ha-zlinky-card': ['meter-electric', '#43a047'],
  'ha-cover-card': ['window-shutter', '#5c6bc0'],
  'ha-utility-meter-card': ['water-pump', '#0288d1'],
  'ha-tempo-card': ['calendar-blank-multiple', '#1e88e5'],
  'ha-pool-card': ['pool', '#00acc1'],
  'ha-garden-card': ['sprinkler-variant', '#43a047'],
  'ha-waste-card': ['trash-can', '#7cb342'],
  'ha-presence-card': ['home-account', '#5b6cf0'],
  'ha-alarm-card': ['shield-home', '#e5484d'],
  'ha-smartlock-card': ['lock-smart', '#43a047'],
  'ha-camera': ['cctv', '#e5484d'],
  'ha-tapo': ['cctv', '#4acbd6'],
  'ha-doorbell-card': ['doorbell-video', '#fb8c00'],
  'ha-smart-appliance-card': ['dishwasher', '#039be5'],
  'ha-vacuum-card': ['robot-vacuum', '#ea0029'],
  'ha-mower-card': ['robot-mower', '#5a9e3c'],
  'ha-printer-card': ['printer', '#0096d6'],
  'ha-hp': ['printer-wireless', '#0096d6'],
  'ha-3d-printer-card': ['printer-3d-nozzle', '#00ae42'],
  'ha-pet-card': ['paw', '#ff7043'],
  'ha-internet-box-card': ['router-wireless', '#cd1e25'],
  'ha-router-card': ['router-network', '#0277bd'],
  'ha-nas-card': ['nas', '#00b46e'],
  'ha-switch-card': ['switch', '#5b6cf0'],
  'ha-docker-card': ['docker', '#2496ed'],
  'ha-dns-filter-card': ['shield-check', '#68bc71'],
  'ha-reverse-proxy': ['server-network', '#5b6cf0'],
  'ha-proxmox': ['server', '#e57000'],
  'ha-ups-card': ['power-plug-battery', '#43a047'],
  'ha-uptime-card': ['server-network', '#26a69a'],
  'ha-certificate-card': ['certificate', '#5e35b1'],
  'ha-seedbox-card': ['download-network', '#2e7d32'],
  'ha-vehicle-card': ['car', '#e1b000'],
  'ha-renault-picture': ['car-info', '#e1b000'],
  'ha-orange-internet-on-the-move': ['car-wireless', '#ff7900'],
  'ha-vehicle-consumption': ['gauge-low', '#26a69a'],
  'ha-carburants-france': ['gas-station', '#43a047'],
  'ha-calendar-card': ['calendar-month', '#5b6cf0'],
  'ha-parcel': ['package-variant-closed', '#ff7a00'],
  'ha-wifi-card': ['qrcode-scan', '#039be5'],
  'ha-wero-card': ['qrcode', '#b8a400'],
  'ha-media-card': ['speaker-multiple', '#8e24aa'],
  'ha-public-transport': ['bus-clock', '#00897b'],
  'ha-saint-of-the-day': ['calendar-star', '#8e44ad'],
  'ha-pronote-card': ['school', '#2e7d32'],
  'ha-stock-card': ['chart-line', '#00897b'],
  'ha-automation-monitor-card': ['robot-confused-outline', '#e5484d'],
  'ha-github': ['github', '#8250df'],
  'ha-system-hub': ['home-analytics', '#03a9f4'],
  'ha-system-monitor-card': ['monitor-dashboard', '#039be5'],
  'ha-marketplace-refresh': ['cloud-refresh-variant', '#41bdf5'],
  'ha-integration-watchdog': ['shield-sync-outline', '#41bdf5'],
  'ha-battery-monitor': ['battery-alert', '#ffa600'],
  'ha-git-sync': ['source-branch-sync', '#f05032'],
  'ha-orphan-entities': ['ghost-outline', '#7e57c2'],
};
var SH_PROJECT_RENAMED = {
  'ha-freebox-card': 'ha-internet-box-card',
  'ha-dockhand-card': 'ha-docker-card',
  'ha-roborock-card': 'ha-vacuum-card',
  'ha-renault-card': 'ha-vehicle-card',
  'ha-ugreen-nas-card': 'ha-nas-card',
  'ha-hp-printer-card': 'ha-printer-card',
  'ha-home-connect-card': 'ha-smart-appliance-card',
  'ha-home-camera-card': 'ha-camera',
  'ha-zoraxy': 'ha-reverse-proxy',
  'ha-switch': 'ha-switch-card',
  'ha-github-card': 'ha-github',
  'ha-hacs-refresh': 'ha-marketplace-refresh',
};

// The project of an update, from its release notes' address on GitHub (github.com/juju35/<repository>/…)
function shProject(url) {
  var m = /^https:\/\/github\.com\/juju35\/([^/?#]+)/i.exec(String(url || ''));
  if (!m) return null;
  var slug = m[1].toLowerCase().replace(/\.git$/, '');
  var found = SH_PROJECTS[SH_PROJECT_RENAMED[slug] || slug];
  return found ? { icon: `mdi:${found[0]}`, accent: found[1] } : null;
}

function shHue(name) {
  var h = 0;
  for (var c of String(name || '')) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 55% 48%)`;
}

// A selector finding the same button or row again once the panel is drawn anew (null when nothing names it)
function shFocusSelector(el) {
  var attrs = ['data-subtab', 'data-action', 'data-more', 'data-entity', 'data-act', 'data-tab-move', 'data-dir', 'data-view', 'data-chart', 'data-hours', 'data-kind'];
  var esc = (v) => (typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(v) : String(v).replace(/["\\]/g, '\\$&'));
  var parts = attrs.filter((a) => el.hasAttribute?.(a)).map((a) => `[${a}="${esc(el.getAttribute(a))}"]`);
  return parts.length ? parts.join('') : null;
}

// The words of an error: a WebSocket one is {code, message}, or {error: {code, message}} when the connection was lost;
// a REST one carries its body
function shErr(err) {
  if (err == null) return '';
  if (typeof err !== 'object') return String(err);
  var text = err.message || err.error?.message || err.body?.message || err.error?.code || err.code;
  if (typeof text === 'string' && text) return text;
  // A form's errors by field (a 400 of a flow), never "[object Object]"
  var errors = err.body?.errors;
  if (errors && typeof errors === 'object') return Object.values(errors).flat().map(String).join(' · ');
  try {
    return JSON.stringify(text || err.body || err);
  } catch (_err) {
    return String(err);
  }
}

// An integration's name as its users know it
var SH_INTEGRATIONS = { zha: 'ZHA', mqtt: 'MQTT', zwave_js: 'Z-Wave', matter: 'Matter', esphome: 'ESPHome', deconz: 'deCONZ' };
function shIntegration(domain) {
  return SH_INTEGRATIONS[domain] || domain;
}

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

// Interfaces left out of the network figures: loopback, containers, bridges, tunnels and VPNs (as the old card did)
var SH_VIRTUAL_IF = /^(lo|docker\d*|hassio|veth.*|br-.*|virbr\d*|tun\d*|tap\d*|wg\d*|vlan.*|dummy\d*|tailscale.*)$/;
// The System tab's thresholds (orange, red) when the integration sends none: Configure → System: thresholds
var SH_THRESHOLDS = { cpu: [70, 90], ram: [70, 90], disk: [80, 90], temperature: [70, 85], swap: [50, 80] };

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

// Orphans tab: its styles (its methods are added to the panel at the end of the file)
var SH_ORPHANS_STYLE = `
    .tile.pick { cursor:pointer; }
    .tile.pick.on { box-shadow:inset 0 0 0 2px var(--tone, var(--primary-color)); }
    .ofilters { display:flex; flex-wrap:wrap; gap:8px; align-items:center; padding:4px 14px 10px; }
    .ofilters select { font:inherit; font-size:14px; padding:8px 10px; border-radius:8px; color:inherit; max-width:100%;
                       border:1px solid var(--divider-color, rgba(127,127,127,.3)); background:var(--secondary-background-color, rgba(127,127,127,.08)); }
    .obar { display:flex; flex-wrap:wrap; gap:8px; align-items:center; padding:4px 14px 8px; font-size:13px; color:var(--secondary-text-color); }
    .orow { align-items:flex-start; border-top:1px solid var(--divider-color, rgba(127,127,127,.15)); }
    .orow.on { background:color-mix(in srgb, var(--primary-color) 7%, transparent); }
    .orow > ha-icon { margin-top:2px; }
    .orow input[type=checkbox] { flex:none; width:18px; height:18px; margin:4px 0 0; accent-color:var(--primary-color); cursor:pointer; }
    .orow .who .s { white-space:normal; overflow-wrap:anywhere; }
    .uses { display:flex; flex-wrap:wrap; gap:4px 6px; margin-top:6px; align-items:center; font-size:12px; color:var(--secondary-text-color); }
    .use { display:inline-flex; align-items:center; gap:4px; padding:2px 8px; border-radius:10px; font-size:12px; --mdc-icon-size:14px;
           color:var(--primary-text-color); text-decoration:none; background:var(--secondary-background-color, rgba(127,127,127,.12)); }
    a.use:hover { color:var(--primary-color); }
    .orow .confirm { margin:0 14px 10px; }
    .omore { padding:8px 14px 12px; }
    @media (max-width: 600px) {
      .ofilters .box { min-width:0; flex-basis:100%; }
      .orow .pill { display:none; }
    }
  `;

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
    .tbadge { display:inline-flex; align-items:center; justify-content:center; min-width:18px; height:18px; padding:0 5px; margin-left:6px;
              box-sizing:border-box; border-radius:9px; font-size:11px; font-weight:600; line-height:1; color:rgba(0,0,0,.87); background:var(--tone-warn); }
    .tbadge.bad { color:#fff; background:var(--tone-bad); }
    .tbadge.info { background:var(--info-color, #039be5); }
    .subtabs { display:flex; flex-wrap:wrap; gap:8px; }
    .subtab { display:inline-flex; align-items:center; gap:8px; min-height:40px; padding:0 16px; border-radius:20px; cursor:pointer; font:inherit;
              font-size:14px; color:var(--primary-text-color); background:var(--card-background-color, #fff); --mdc-icon-size:18px;
              border:1px solid var(--divider-color, rgba(127,127,127,.2)); }
    .subtab ha-icon { color:var(--secondary-text-color); }
    .subtab:hover { border-color:color-mix(in srgb, var(--primary-color) 50%, transparent); }
    .subtab:focus-visible { outline:2px solid var(--primary-color); outline-offset:2px; }
    .subtab.active { font-weight:500; color:var(--primary-color); border-color:var(--primary-color);
                     background:color-mix(in srgb, var(--primary-color) 12%, var(--card-background-color, #fff)); }
    .subtab.active ha-icon { color:var(--primary-color); }
    .subdot { width:8px; height:8px; border-radius:50%; background:var(--tone-warn); }
    .subdot.bad { background:var(--tone-bad); }
    .subdot.info { background:var(--info-color, #039be5); }
    .stsec { margin:8px 0 -2px; font-size:12px; font-weight:500; letter-spacing:.06em; text-transform:uppercase; color:var(--secondary-text-color); }
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
    .good { --tone:var(--tone-good); } .warn { --tone:var(--tone-warn); } .bad { --tone:var(--tone-bad); } .info { --tone:var(--info-color, #039be5); }
    .good, .warn, .bad, .info { --tone-text: color-mix(in srgb, var(--tone) 50%, var(--primary-text-color)); }
    .pill { flex:none; font-size:11px; font-weight:500; padding:2px 10px; border-radius:12px; color:var(--tone-text, var(--primary-text-color));
            background:color-mix(in srgb, var(--tone, var(--secondary-text-color)) 15%, transparent); white-space:nowrap; }
    .list { padding:6px 0; overflow:hidden; }
    .lhead { display:flex; align-items:center; gap:10px; padding:8px 14px 6px; --mdc-icon-size:18px; color:var(--secondary-text-color); }
    .lhead .lname { flex:1; font-size:14px; font-weight:500; color:var(--primary-text-color); }
    .item { display:flex; align-items:center; gap:12px; padding:8px 14px; min-width:0; }
    .item.link { cursor:pointer; }
    a.item { color:inherit; text-decoration:none; }
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
    .act[aria-busy="true"] { opacity:.8; cursor:progress; }
    .act.danger { color:var(--error-color, #db4437); background:color-mix(in srgb, var(--error-color, #db4437) 12%, transparent); }
    .act.danger:hover:not([disabled]) { background:color-mix(in srgb, var(--error-color, #db4437) 20%, transparent); }
    .spin { animation:sh-spin 1s linear infinite; }
    .sthero { display:flex; align-items:center; gap:28px; padding:20px 28px; flex-wrap:wrap;
              background:linear-gradient(135deg, color-mix(in srgb, var(--tone, var(--primary-color)) 10%, var(--card-background-color, #fff)), var(--card-background-color, #fff)); }
        .stscore { position:relative; width:170px; height:170px; flex:none; }
    .stscore svg { width:100%; height:100%; }
    .sttrack { fill:none; stroke:var(--divider-color, rgba(127,127,127,.2)); stroke-width:14; }
    .starc { fill:none; stroke:var(--tone); stroke-width:14; stroke-linecap:round; transition:stroke-dashoffset .8s ease; }
    .stnum { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; }
    .stnum b { font-size:46px; font-weight:300; line-height:1; }
    .stnum span { font-size:12px; color:var(--secondary-text-color); margin-top:4px; }
    .stbadge { width:104px; height:104px; border-radius:50%; flex:none; display:flex; align-items:center; justify-content:center;
               color:var(--tone); background:color-mix(in srgb, var(--tone) 16%, transparent); }
    .sthero .who { flex:1; min-width:220px; }
    .sttitle { font-size:24px; font-weight:500; }
    .sthero .s { font-size:14px; margin:6px 0 12px; white-space:normal; }
    .stpills { display:flex; flex-wrap:wrap; gap:6px; }
    .stgrid { display:grid; grid-template-columns:repeat(auto-fill, minmax(230px, 1fr)); gap:12px; }
    .sttile { position:relative; overflow:hidden; display:flex; flex-direction:column; align-items:stretch; gap:8px; text-align:left; cursor:pointer;
              padding:16px; border-radius:var(--ha-card-border-radius, 12px); border:1px solid var(--divider-color, rgba(127,127,127,.15));
              background:var(--card-background-color, #fff); color:var(--primary-text-color); font:inherit; }
    .sttile:hover { border-color:color-mix(in srgb, var(--tone) 50%, transparent); }
    .sttile:focus-visible { outline:2px solid var(--primary-color); outline-offset:2px; }
    .stglow { position:absolute; inset:0; pointer-events:none; background:radial-gradient(circle at 100% 0, color-mix(in srgb, var(--tone) 20%, transparent), transparent 60%); }
    .sthead { position:relative; display:flex; align-items:center; gap:10px; }
    .stic { width:38px; height:38px; border-radius:11px; display:flex; align-items:center; justify-content:center; flex:none; --mdc-icon-size:22px;
            color:var(--tone); background:color-mix(in srgb, var(--tone) 16%, transparent); }
    .stname { flex:1; font-size:14px; font-weight:500; }
    .stdot { width:9px; height:9px; border-radius:50%; background:var(--tone); box-shadow:0 0 8px var(--tone); }
    .stval { position:relative; font-size:19px; font-weight:500; }
    .stdet { position:relative; font-size:12px; color:var(--secondary-text-color); line-height:1.4;
             display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
    @media (max-width:600px) { .sthero { gap:16px; padding:16px; } .stscore { width:130px; height:130px; } .stnum b { font-size:36px; }
      .stbadge { width:76px; height:76px; } }
    .stbadge svg { width:66%; height:66%; overflow:visible; }
    .cfg { gap:0; }
    .cfg h2 { margin-bottom:4px; }
    .cfgrow { padding:6px 0; border-top:1px solid var(--divider-color, rgba(127,127,127,.15)); }
    .cfgrow.open { background:color-mix(in srgb, var(--primary-color) 6%, transparent); margin:0 -16px; padding:6px 16px; }
    .cfgpad { width:36px; flex:none; }
    .cfgsec { font-size:12px; font-weight:500; letter-spacing:.06em; text-transform:uppercase; color:var(--secondary-text-color); padding:14px 0 4px; }
    .cfglist { display:flex; flex-direction:column; }
    .cfgrow.off > ha-icon, .cfgrow.off .who { opacity:.55; }
    .dragh { cursor:grab; touch-action:none; color:var(--secondary-text-color); }
    .cfgrow.dragging { background:var(--secondary-background-color, rgba(127,127,127,.12)); box-shadow:0 8px 24px rgba(0,0,0,.25);
                       border-radius:12px; position:relative; z-index:1; }
    .cfgrow.dragging .dragh { cursor:grabbing; }
    .cfgdef { margin-left:8px; vertical-align:2px; }
    .cfgbody { display:flex; flex-direction:column; gap:12px; padding:12px 0 16px 36px; }
    .cfgbody .loading { padding:12px 0; }
    .cfgtabs { align-self:flex-start; }
    .cfgdesc { white-space:pre-line; }
    @media (max-width:600px) { .cfgbody { padding-left:0; } }
    .lgentry { padding:10px 14px; border-top:1px solid var(--divider-color, rgba(127,127,127,.15)); display:flex; flex-direction:column; gap:4px; }
    .lgentry .actions { margin:0; }
    .lgentry .s, .lgentry summary { font-size:12px; color:var(--secondary-text-color); }
    .lgentry summary { cursor:pointer; }
    .lgmsg { font-family:var(--code-font-family, monospace); font-size:13px; white-space:pre-wrap; word-break:break-word; }
    .scnote { font-size:12.5px; color:var(--secondary-text-color); }
    .list .scnote { padding:6px 14px 12px; }
    .sctwo { display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:12px; align-items:start; }
    .list code { font-family:var(--code-font-family, monospace); font-size:12px; }
    .dbrow { width:100%; border:0; background:none; font:inherit; color:inherit; text-align:left; cursor:pointer; }
    .dbrow.on { background:rgba(var(--rgb-primary-color, 3,169,244), .08); }
    .dbrow .who { flex:1; min-width:0; }
    .dbbar { height:4px; margin-top:6px; border-radius:2px; background:var(--divider-color, rgba(127,127,127,.2)); overflow:hidden; }
    .dbbar span { display:block; height:100%; background:var(--primary-color); }
    .dbcount { display:flex; flex-direction:column; align-items:flex-end; gap:2px; }
    .dbpick { padding:8px 16px 14px; display:flex; flex-direction:column; gap:8px; }
    .dbyaml { display:flex; gap:8px; align-items:flex-start; }
    .dbyaml pre { flex:1; margin:0; }
    .lgpre { margin:6px 0 0; padding:10px; border-radius:8px; overflow-x:auto; font-size:12px; background:var(--secondary-background-color, rgba(127,127,127,.08)); }
    .bkdays { display:flex; flex-wrap:wrap; gap:5px; }
    .bkday { width:20px; height:20px; border-radius:5px; background:var(--divider-color, rgba(127,127,127,.2)); }
    .bkday.ok { background:var(--tone-good); }
    .bkday.bad { background:var(--tone-bad); }
    .mkrestart { display:flex; align-items:center; gap:6px; font-size:13px; --mdc-icon-size:16px;
                 color:color-mix(in srgb, var(--tone-warn) 50%, var(--primary-text-color)); }
    .mkhead { display:flex; align-items:center; gap:14px; padding:14px 16px; flex-wrap:wrap; }
    .mkhead .who { flex:1; min-width:220px; }
    .mkhead .who .n { font-size:16px; font-weight:500; }
    .mkhead .actions { flex:none; flex-wrap:wrap; }
    @media (max-width:700px) {
      .mkhead { align-items:flex-start; position:relative; }
      .mkhead .who { padding-right:44px; }
      .mkhead .actions { flex:1 1 100%; }
      .mkgear { position:absolute; top:10px; right:10px; }
    }
    .mkgh { display:flex; align-items:flex-start; gap:4px; --mdc-icon-size:14px; }
    .mkgh > ha-icon { flex:none; margin-top:1px; }
    .mkgh > span { min-width:0; }
    .mkgrid { display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:12px; }
    .mkcard { padding:14px; display:flex; flex-direction:column; gap:10px; cursor:pointer; }
    .mktop { display:flex; align-items:center; gap:12px; min-width:0; }
    .mktop .who { flex:1; min-width:0; }
    .mktop .who .n { font-weight:500; }
    .mklogo { width:40px; height:40px; border-radius:10px; flex:none; object-fit:contain; display:flex; align-items:center; justify-content:center;
              color:#fff; font-weight:600; font-size:18px; background:var(--logo, var(--primary-color)); }
    img.mklogo { background:var(--secondary-background-color, rgba(127,127,127,.08)); }
    .mklogo.mkproj { border-radius:50%; color:var(--logo); background:color-mix(in srgb, var(--logo) 18%, transparent); }
    .mklogo.mkproj ha-icon { --mdc-icon-size:24px; }
    .mklogos { display:contents; }
    .mklogos > div.mklogo, .mklogos.broken > img { display:none; }
    .mklogos.broken > div.mklogo { display:flex; }
    .mkhead .who .s { white-space:normal; }
    .mkver { display:flex; align-items:center; gap:8px; font-family:var(--sh-mono, monospace); font-size:14px; --mdc-icon-size:18px; }
    .mkver ha-icon { color:var(--primary-color); }
    .mkver b { font-size:15px; }
    .mknotes { font-size:13px; color:var(--secondary-text-color); line-height:1.4; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; white-space:normal; }
    .mkcard .actions { margin-top:auto; }
    .pill > ha-icon { --mdc-icon-size:14px; vertical-align:-2px; margin-right:2px; }
    .loading { display:flex; align-items:center; gap:10px; color:var(--secondary-text-color); --mdc-icon-size:20px; }
    .loading ha-icon { color:var(--primary-color); }
    .loading.small { font-size:12px; gap:6px; --mdc-icon-size:16px; }
    .savebar { position:sticky; bottom:12px; z-index:2; display:flex; flex-wrap:wrap; align-items:center; gap:8px; padding:10px 14px;
               border-radius:12px; background:var(--sh-card, var(--card-background-color, #fff)); box-shadow:0 4px 16px rgba(0,0,0,.18);
               border:1px solid color-mix(in srgb, var(--primary-color) 40%, transparent); }
    .savebar .grow { font-size:14px; font-weight:500; }
    [data-more]:focus-visible, .tilelink:focus-visible { outline:2px solid var(--primary-color); outline-offset:2px; }
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
    .tilelink { color:inherit; text-decoration:none; display:block; min-width:0; }
    .tilelink > .tile { height:100%; box-sizing:border-box; }
    .ver { white-space:nowrap; }
    .rv.warn b { color:color-mix(in srgb, var(--tone-warn) 60%, var(--primary-text-color)); }
    .rv.bad b { color:color-mix(in srgb, var(--tone-bad) 60%, var(--primary-text-color)); }
    .bsearch { flex:0 1 220px; min-width:160px; --mdc-icon-size:18px; padding-left:8px; color:var(--secondary-text-color); }
    .bsearch input { color:var(--primary-text-color); }
    .spare { border:0; cursor:pointer; font:inherit; font-size:12px; padding:2px 9px; border-radius:999px; color:var(--primary-text-color);
             background:color-mix(in srgb, var(--tone-good) 14%, transparent); display:inline-flex; align-items:center; gap:4px; --mdc-icon-size:14px; }
    .spare.short { background:color-mix(in srgb, var(--tone-warn) 16%, transparent); }
    .spare.add { background:var(--secondary-background-color, rgba(127,127,127,.12)); padding:2px 6px; }
    .stockform { display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin:-6px 0 14px; }
    .stockform .box { flex:0 1 200px; min-width:140px; }
    .stockform .box.count { flex:0 1 110px; min-width:90px; }
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
    @media (prefers-reduced-motion: reduce) { .phead ha-icon, .pbar.busy > span, .spin { animation:none; } }
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
    .gitrepos { display:flex; flex-wrap:wrap; width:max-content; max-width:100%; margin:0 0 12px; }
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
    .ha-ctl { margin-bottom:10px; }
    .ha-backdrop { position:fixed; inset:0; z-index:1000; background:rgba(0,0,0,.45); backdrop-filter:blur(2px); }
    .ha-dialog { position:fixed; z-index:1001; left:50%; top:50%; transform:translate(-50%, -50%); width:min(440px, calc(100vw - 32px));
                 box-sizing:border-box; padding:20px 20px 16px; border-radius:16px; background:var(--card-background-color, #fff);
                 color:var(--primary-text-color); box-shadow:0 12px 40px rgba(0,0,0,.35); }
    .ha-dhead { display:flex; align-items:center; gap:12px; font-size:18px; font-weight:500; }
    .ha-dhead ha-icon { --mdc-icon-size:22px; padding:8px; border-radius:50%; color:var(--primary-color);
                        background:color-mix(in srgb, var(--primary-color) 14%, transparent); }
    .ha-dhead.bad ha-icon { color:var(--error-color, #db4437); background:color-mix(in srgb, var(--error-color, #db4437) 14%, transparent); }
    .ha-dialog p { margin:14px 0; color:var(--secondary-text-color); line-height:1.45; font-size:14px; }
    .ha-check { display:flex; gap:8px; align-items:flex-start; padding:10px 12px; margin-bottom:14px; border-radius:8px; font-size:13px; }
    .ha-check.good { color:var(--tone-good); background:color-mix(in srgb, var(--tone-good) 12%, transparent); }
    .ha-check.bad { color:var(--tone-bad); background:color-mix(in srgb, var(--tone-bad) 12%, transparent); }
    .ha-check pre { margin:6px 0 0; white-space:pre-wrap; overflow-wrap:anywhere; max-height:160px; overflow:auto;
                    font-family:var(--code-font-family, monospace); font-size:12px; color:var(--primary-text-color); }
    .ha-dialog .loading { margin-bottom:14px; }
    .confirm { display:flex; flex-wrap:wrap; align-items:center; gap:8px; padding:10px 14px; border-radius:8px;
               background:color-mix(in srgb, var(--tone-warn) 12%, transparent); }
    code { font-family:var(--code-font-family, monospace); font-size:12px; }
    .who .s.wrap { white-space:normal; overflow-wrap:anywhere; display:flex; flex-wrap:wrap; align-items:center; gap:4px 6px; margin-top:4px; }
    a.pill { text-decoration:none; }
    .item .actions { margin-top:6px; }
    .more-row { justify-content:center; padding:6px 0; }
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
    ${SH_ORPHANS_STYLE}
  `;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    // The page shown again (the app back from the background): read again at once
    this._onVisible = () => {
      if (!document.hidden && this._hass) this._load();
    };
    this._tab = null;
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
    // The connection back (Home Assistant restarted, the app back from the background): read again at once
    if (hass?.connection && hass.connection !== this._conn) {
      this._conn = hass.connection;
      hass.connection.addEventListener?.('ready', () => this.isConnected && this._load());
    }
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
    var path = (route?.path || '').split('/').filter(Boolean)[0] || null;
    // Home Assistant gives the route again at each of its updates, the same one: only a new address is followed, so
    // that the panel stays on the tab shown (before 2.0.2, the address it kept was the one the panel opened with, and
    // its first tab came back by itself)
    if (this._routeSeen !== undefined && path === this._routeSeen) return;
    this._routeSeen = path;
    this._routeTab = path;
    if (this._state) {
      this._selectTab(path);
      // Followed: not applied again by the next drawing, which would bring this tab back over one chosen since (a
      // tab chosen after a route took two clicks)
      this._routeTab = null;
    }
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
    document.addEventListener?.('visibilitychange', this._onVisible);
  }

  disconnectedCallback() {
    clearInterval(this._timer);
    clearTimeout(this._fast);
    clearTimeout(this._retry);
    this._timer = null;
    document.removeEventListener?.('visibilitychange', this._onVisible);
  }

  async _start() {
    this._renderShell();
    await this._loadStrings();
    await this._load();
  }

  async _loadStrings() {
    try {
      var categories = ['selector', 'entity', 'services', 'config', 'options'];
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

  // Home Assistant's newest localize first: the one a translation load resolved with may lack the categories
  // loaded alongside (the module descriptions of `config`, the forms of `options`)
  _l(key, vars) {
    for (var localize of [this._hass?.localize, this._localize]) {
      if (!localize) continue;
      try {
        var text = localize(key, vars || {});
        if (text) return text;
      } catch (_err) {
        // the next one
      }
    }
    return '';
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
      // The Orphans tab shown: its whole list, read again with the state
      if (this._state?.orphans && (this._routeTab || this._tab) === 'orphans') await this._orphLoad();
      // The log, for the Logs tab and the Status tab: read again every minute at most
      if (this._state?.logs) await this._lgLoad();
      // The database count and the security scan can take seconds: the panel is drawn without waiting for them, then
      // again once they are read (read for the sidebar icon or a card, they are waited for)
      var slow = [this._state?.database && this._dbLoad(), this._state?.security && this._scLoad()].filter(Boolean);
      if (this._headless) await Promise.all(slow);
      else if (slow.length) Promise.all(slow).then(() => this._idleRender());
      // The Backups tab shown: Home Assistant's backups, read again every minute at most
      if (this._state?.backups && (this._routeTab || this._tab) === 'backups') await this._bkLoad();
      this._reportTone();
      clearTimeout(this._retry);
    } catch (err) {
      // Home Assistant restarting, the connection lost (the app back from the background): what is shown stays, read
      // again in a few seconds; the message only when nothing could be read yet
      if (!this._state?.loaded) this._error = shErr(err);
      clearTimeout(this._retry);
      if (this.isConnected) this._retry = setTimeout(() => this._load(), SH_RETRY_MS);
      if (this._state?.loaded) return;
    }
    this._idleRender();
  }

  // Drawn again, unless a settings form is open: left as it is, what is being typed included
  _idleRender() {
    if (this._tab === 'settings' && (this._cfg?.flow || this._drag)) return;
    this._render();
  }

  _tabs() {
    // Nothing read yet: no tab, so that none is picked before the configured order is known
    if (!this._state) return [];
    if (!this._state.loaded) return ['system', 'settings'];
    var modules = this._state.modules || [];
    return [...shGroupTabs(this._state.tabs).filter((t) => t === 'status' || t === 'system' || modules.includes(t)), 'settings'];
  }

  // The tabs under the toolbar: Status, the groups with a tab shown, Settings
  _groups() {
    return [...new Set(this._tabs().map(shGroupOf))];
  }

  // The sub-tabs of a group: its modules turned on
  _groupTabs(group) {
    return this._tabs().filter((t) => shGroupOf(t) === group);
  }

  _tabName(tab) {
    if (tab === 'settings') return this._t('settings');
    var key = `tab_${tab}`;
    var name = this._t(key);
    return name !== key ? name : SH_MODULE_NAMES[tab] || tab;
  }

  _groupName(group) {
    if (!SH_GROUPS[group]) return this._tabName(group);
    return group === 'system' ? this._t('system') : this._t(`group_${group}`);
  }

  // A group's badge: how many of its modules need a look, in the colour of the worst
  _groupBadge(group) {
    if (!SH_GROUPS[group] || !this._state?.loaded) return '';
    var tones = this._groupTabs(group)
      .map((t) => this._stArea(t)?.[0])
      .filter((t) => t && t !== 'good');
    if (!tones.length) return '';
    var tone = ['bad', 'warn', 'info'].find((t) => tones.includes(t));
    return `<span class="tbadge ${tone}" aria-label="${shEsc(this._t(tones.length === 1 ? 'st_point' : 'st_points', { n: tones.length }))}">${tones.length}</span>`;
  }

  // A tab, or a group (its sub-tab shown last, else its first)
  _selectTab(tab, focus) {
    var tabs = this._tabs();
    if (!tabs.includes(tab) && SH_GROUPS[tab]) tab = this._groupTabs(tab)[0];
    var chosen = tabs.includes(tab) ? tab : tabs[0];
    this._lastTab ??= {};
    this._lastTab[shGroupOf(chosen)] = chosen;
    if (chosen !== this._tab) {
      this._tab = chosen;
      this._render();
    }
    if (focus) this.shadowRoot.querySelector(focus === 'sub' ? `[data-subtab="${chosen}"]` : `[data-group="${shGroupOf(chosen)}"]`)?.focus({ preventScroll: true });
  }

  // A group's tab clicked: the sub-tab shown last in it
  _goGroup(group, focus) {
    var last = this._lastTab?.[group];
    this._goTab(last && this._tabs().includes(last) ? last : this._groupTabs(group)[0], focus);
  }

  _goTab(tab, focus) {
    // A tab chosen here wins over an address not yet applied
    this._routeTab = null;
    this._selectTab(tab, focus);
    var base = (this._panel?.url_path || 'system-hub').replace(/^\//, '');
    try {
      // Every tab in the address, the first one too: the panel's bare address opens the first tab of the order
      history.replaceState(history.state, '', `/${base}/${this._tab}`);
      // Home Assistant told, so that its route follows: a panel it builds again opens on this tab, not on the first one
      window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: true } }));
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
      var group = ev.target.closest?.('[data-group]')?.dataset.group;
      if (group) this._goGroup(group);
    });
    root.querySelector('.tabs').addEventListener('keydown', (ev) => {
      if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') return;
      var groups = this._groups();
      var i = groups.indexOf(shGroupOf(this._tab)) + (ev.key === 'ArrowRight' ? 1 : -1);
      this._goGroup(groups[(i + groups.length) % groups.length], 'group');
      ev.preventDefault();
    });
    root.querySelector('main').addEventListener('click', (ev) => {
      var sub = ev.target.closest?.('[data-subtab]')?.dataset.subtab;
      if (sub) return this._goTab(sub);
      this._onClick(ev);
    });
    root.querySelector('main').addEventListener('keydown', (ev) => {
      if ((ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') || !ev.target.dataset?.subtab) return;
      var subs = this._groupTabs(shGroupOf(this._tab));
      var i = subs.indexOf(this._tab) + (ev.key === 'ArrowRight' ? 1 : -1);
      this._goTab(subs[(i + subs.length) % subs.length], 'sub');
      ev.preventDefault();
    });
    root.querySelector('main').addEventListener('pointerdown', (ev) => this._cfgDragStart?.(ev));
    root.querySelector('main').addEventListener('keydown', (ev) => this._cfgDragKey?.(ev));
    root.querySelector('main').addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && this._confirm?.startsWith?.('ha_')) {
        this._confirm = null;
        this._haCheck = null;
        return this._render();
      }
      if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches?.('[role="button"][data-more]')) {
        ev.preventDefault();
        this._onClick(ev);
      }
    });
    root.querySelector('main').addEventListener('input', (ev) => {
      if (ev.target.dataset?.draft) this._draft[ev.target.dataset.draft] = ev.target.value;
      // The Orphans search and filters narrow the list as they change
      if (ev.target.dataset?.draft?.startsWith('orph_')) this._render();
      if (ev.target.dataset?.draft === 'batt_search') this._render();
    });
  }

  // The tab of an address not applied yet (the panel opened on /system-hub/<tab> before its state was read), once;
  // else a tab that is still there
  _applyRoute() {
    if (this._routeTab && this._state) {
      var wanted = this._routeTab;
      this._routeTab = null;
      // A group in the address (/system-hub/devices) opens its first sub-tab
      if (SH_GROUPS[wanted] && !this._tabs().includes(wanted)) wanted = this._groupTabs(wanted)[0];
      if (this._tabs().includes(wanted)) this._tab = wanted;
    }
    if (!this._tabs().includes(this._tab)) this._tab = this._tabs()[0];
  }

  _render() {
    // Read for the sidebar icon only (system-hub-icons.js): nothing shown
    if (this._headless) return;
    this._renderShell();
    var root = this.shadowRoot;
    this._applyRoute();
    var current = shGroupOf(this._tab);
    root.querySelector('.tabs').innerHTML = this._groups()
      .map((group) => {
        var selected = group === current;
        return `<button class="tab${selected ? ' active' : ''}" role="tab" data-group="${group}" aria-selected="${selected}" tabindex="${selected ? 0 : -1}">${shEsc(this._groupName(group))}${this._groupBadge(group)}</button>`;
      })
      .join('');
    var main = root.querySelector('main');
    var active = root.activeElement;
    var focusKey = active?.dataset?.draft;
    // The button or row with the focus keeps it through the refresh every few seconds
    var focusSel = !focusKey && active && main.contains(active) ? shFocusSelector(active) : null;
    main.innerHTML = this._subtabs() + this._content();
    if (this._tab === 'settings') this._cfgMount(main);
    // Rows and tiles that open the entity's dialog: reached and opened from the keyboard too
    main.querySelectorAll('[data-more]:not(button):not(a)').forEach((el) => {
      el.tabIndex = 0;
      el.setAttribute('role', 'button');
    });
    if (focusKey) {
      var field = main.querySelector(`[data-draft="${focusKey}"]`);
      field?.focus();
      field?.setSelectionRange?.(field.value.length, field.value.length);
    } else if (focusSel) {
      main.querySelector(focusSel)?.focus?.({ preventScroll: true });
    }
  }

  // The sub-tabs of the group shown, when it has more than one module turned on
  _subtabs() {
    var subs = this._state?.loaded ? this._groupTabs(shGroupOf(this._tab)) : [];
    if (subs.length < 2) return '';
    return `<nav class="subtabs" role="tablist" aria-label="${shEsc(this._groupName(shGroupOf(this._tab)))}">${subs
      .map((tab) => {
        var selected = tab === this._tab;
        var tone = this._stArea(tab)?.[0];
        var dot = tone && tone !== 'good' ? `<span class="subdot ${tone}" aria-hidden="true"></span>` : '';
        return `<button class="subtab${selected ? ' active' : ''}" role="tab" data-subtab="${tab}" aria-selected="${selected}" tabindex="${selected ? 0 : -1}"><ha-icon icon="${SH_MODULE_ICONS[tab]}"></ha-icon>${shEsc(this._tabName(tab))}${dot}</button>`;
      })
      .join('')}</nav>`;
  }

  _content() {
    if (this._state === null && this._error) {
      return `<ha-card class="note error" role="alert">${shEsc(this._t('load_failed', { error: this._error }))}
        <button class="act" data-action="reload"><ha-icon icon="mdi:refresh"></ha-icon>${shEsc(this._t('refresh'))}</button></ha-card>`;
    }
    if (this._state === null) return `<ha-card class="note">${this._spinner(this._t('loading'))}</ha-card>`;
    if (!this._state.loaded) return `<ha-card class="note">${shEsc(this._t('not_loaded'))}</ha-card>`;
    var html = {
      status: () => this._status(),
      system: () => this._system(),
      containers: () => this._containers(),
      watchdog: () => this._watchdog(),
      marketplace: () => this._marketplace(),
      backups: () => this._backups(),
      database: () => this._database(),
      security: () => this._security(),
      logs: () => this._logs(),
      silent: () => this._silent(),
      batteries: () => this._batteries(),
      git_sync: () => this._gitSync(),
      automations: () => this._automations(),
      orphans: () => this._orphans(),
      settings: () => this._settings(),
    }[this._tab];
    return html ? html() : '';
  }

  _message(key) {
    var m = this._messages[key];
    return m ? `<span class="msg ${m.tone || ''}" role="status">${shEsc(m.text)}</span>` : '';
  }

  // A button; while its action runs (opts.busy, else this._busy[action]) a spinner replaces its icon and it is disabled
  _button(action, icon, label, opts = {}) {
    var busy = 'busy' in opts ? Boolean(opts.busy) : Boolean(this._busy[action]);
    var attrs = Object.entries(opts.data || {})
      .map(([k, v]) => ` data-${k}="${shEsc(v)}"`)
      .join('');
    var cls = `act${opts.quiet ? ' quiet' : ''}${opts.danger ? ' danger' : ''}`;
    return `<button class="${cls}" data-action="${action}"${attrs}${busy || opts.disabled ? ' disabled' : ''}${busy ? ' aria-busy="true"' : ''}>
      <ha-icon${busy ? ' class="spin"' : ''} icon="${busy ? 'mdi:loading' : icon}"></ha-icon>${shEsc(label)}</button>`;
  }

  // The module settings (Configure), at the end of a tab's buttons
  _configure() {
    return `<span class="grow"></span>${this._button(`open_settings:${this._tab}`, 'mdi:cog-outline', this._t('configure'), { quiet: true })}`;
  }

  // Something being read: a spinner and what it is
  _spinner(text, small = false) {
    return `<div class="loading${small ? ' small' : ''}" role="status" aria-busy="true"><ha-icon class="spin" icon="mdi:loading"></ha-icon>${shEsc(text)}</div>`;
  }

  // A short message in Home Assistant's own toast
  _toast(message) {
    this.dispatchEvent(new CustomEvent('hass-notification', { detail: { message }, bubbles: true, composed: true }));
  }

  _tile(icon, value, label, tone, opts = {}) {
    var card = `<ha-card class="tile ${tone || ''}${opts.entity || opts.href ? ' link' : ''}"${opts.entity ? ` data-more="${shEsc(opts.entity)}"` : ''}${opts.title ? ` title="${shEsc(opts.title)}"` : ''}>
      ${opts.spark || ''}<div class="avatar"><ha-icon icon="${icon}"></ha-icon></div>
      <div class="who"><div class="n">${value}</div><div class="s">${shEsc(label)}</div></div></ha-card>`;
    return opts.href ? `<a class="tilelink" href="${shEsc(opts.href)}" data-nav="${shEsc(opts.href)}">${card}</a>` : card;
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

  // A time near now in words ("5 minutes ago", "in 3 hours"), the date beyond a week; _ago gives the date and time
  _rel(iso) {
    var date = new Date(iso);
    if (!iso || Number.isNaN(date.getTime())) return this._t('never');
    var secs = (date.getTime() - Date.now()) / 1000;
    var abs = Math.abs(secs);
    if (abs >= 7 * 86400) return this._ago(iso);
    var [value, unit] = abs < 45 ? [0, 'second'] : abs < 3600 ? [secs / 60, 'minute'] : abs < 48 * 3600 ? [secs / 3600, 'hour'] : [secs / 86400, 'day'];
    try {
      return new Intl.RelativeTimeFormat(this._hass?.locale?.language || this._hass?.language || undefined, { numeric: 'auto' }).format(Math.round(value), unit);
    } catch (_err) {
      return this._ago(iso);
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
      return `${this._haControls()}<ha-card class="note">${shEsc(this._t('no_system'))}
        <a class="act" href="/config/integrations/dashboard/add?domain=systemmonitor"><ha-icon icon="mdi:plus"></ha-icon>System Monitor</a></ha-card>`;
    }
    var one = (key) => sensors.find((s) => s.key === key);
    var all = (key) => sensors.filter((s) => s.key === key);
    var cpu = one('processor_use');
    var ram = one('memory_use_percent');
    var temp = one('processor_temperature');
    var disks = all('disk_use_percent');
    // Physical interfaces only: docker0, hassio, veth… would count the same traffic twice
    var physical = (s) => !SH_VIRTUAL_IF.test(shIface(s));
    var rx = all('throughput_network_in').filter(physical);
    var txs = all('throughput_network_out').filter(physical);
    var th = { ...SH_THRESHOLDS, ...(this._state.thresholds || {}) };
    var level = (v, key) => shTone(v, th[key][0], th[key][1]);
    // Rings: the value now, the last 24 hours behind it, each kind of data in its own colour
    var ringDefs = [
      [cpu, this._t('cpu'), SH_COLORS.cpu, '%', 'cpu'],
      [ram, this._t('ram'), SH_COLORS.ram, '%', 'ram'],
      [temp, this._t('temperature'), SH_COLORS.temp, temp?.unit || '°C', 'temperature'],
      [disks[0], disks.length > 1 ? `${this._t('disk')} ${shMount(disks[0])}` : this._t('disk'), SH_COLORS.disks[0], '%', 'disk'],
    ].filter(([s]) => s);
    var ringHist = this._history(ringDefs.map(([s]) => s.entity_id), 24);
    var rings = ringDefs.map(([s, label, color, unit, key]) => this._ring(s, label, color, unit, ringHist?.[s.entity_id], level(shNum(s.state), key))).join('');
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
      tiles.push(this._tile('mdi:swap-horizontal', v === null ? '—' : `<b>${Math.round(v)}</b>%${size}`, this._t('swap'), level(v, 'swap'), { entity: (swap || swapUse).entity_id }));
    }
    var loads = ['load_1m', 'load_5m', 'load_15m'].map(one).filter(Boolean);
    if (loads.length) {
      tiles.push(
        this._tile('mdi:speedometer', loads.map((s, i) => (i ? `<span class="more">${shEsc(shNum(s.state)?.toFixed(2) ?? '—')}</span>` : `<b>${shEsc(shNum(s.state)?.toFixed(2) ?? '—')}</b>`)).join(' '), this._t('load'), '', {
          entity: loads[0].entity_id,
        }),
      );
    }
    // Received and sent since the boot, physical interfaces summed (System Monitor gives MiB)
    var totIn = all('network_in').filter(physical);
    var totOut = all('network_out').filter(physical);
    if (totIn.length || totOut.length) {
      var total = (list) => shBytes(list.reduce((sum, x) => sum + (shNum(x.state) || 0), 0) * 1024 * 1024);
      tiles.push(
        this._tile('mdi:counter', `<b class="ver">${shEsc(total(totIn))}</b> <span class="more">/ ${shEsc(total(totOut))}</span>`, this._t('network_total'), '', {
          entity: (totIn[0] || totOut[0]).entity_id,
        }),
      );
    }
    // Home Assistant Core and OS versions, orange when an update is available; Settings → Updates on a click
    var updates = this._state.updates || [];
    if (updates.length) {
      var pending = updates.filter((u) => u.state === 'on');
      // Core's version first and larger, the OS's after it
      var versions = updates
        .map((u, i) => (i ? `<span class="more">${u.key === 'core' ? 'Core' : 'OS'} ${shEsc(u.installed || '—')}</span>` : `<b class="ver">${shEsc(u.installed || '—')}</b>`))
        .join(' ');
      var full = updates.map((u) => `${u.key === 'core' ? 'Core' : 'OS'} ${u.installed || '—'}`).join(' · ');
      // Without the Supervisor, only the version running: no update to tell
      var known = updates.some((u) => u.entity_id);
      var label = pending.length
        ? this._t('update_to', { versions: pending.map((u) => `${u.key === 'core' ? 'Core' : 'OS'} ${u.latest}`).join(', ') })
        : known
          ? this._t('up_to_date')
          : 'Home Assistant';
      tiles.push(this._tile('mdi:home-assistant', versions, label, pending.length ? 'warn' : known ? 'good' : '', { href: '/config/updates', title: full }));
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
        this._tile('mdi:backup-restore', shEsc(Number.isNaN(okAt) ? this._t('never') : this._rel(lastOk.state)), failed ? this._t('backup_failed') : this._t('last_backup'), tone, {
          entity: (lastOk || lastTry).entity_id,
        }),
      );
      if (nextBackup || running) {
        tiles.push(
          this._tile('mdi:calendar-clock', shEsc(running ? this._t('backing_up') : this._rel(nextBackup.state)), this._t('next_backup'), running ? 'warn' : '', {
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
            return `<div class="item link ${level(v, 'disk')}" data-more="${shEsc(s.entity_id)}"><ha-icon icon="mdi:harddisk"></ha-icon>
              <div class="who"><div class="n">${shEsc(s.name)}</div></div>
              <div class="side"><span>${v === null ? '—' : `${Math.round(v)}%`}</span><div class="meter"><span style="width:${Math.min(v || 0, 100)}%"></span></div></div></div>`;
          })
          .join('')}</ha-card>`
      : '';
    // With the Containers tab, the processes are listed there, next to the containers
    var procList = this._tabs().includes('containers') ? '' : this._processList();
    var lists = [diskList, procList].filter(Boolean);
    return `${this._haControls()}${rings ? `<div class="rings">${rings}</div>` : ''}${tiles.length ? `<div class="tiles">${tiles.join('')}</div>` : ''}
      ${charts.join('')}${pair.length ? `<div class="pair">${pair.join('')}</div>` : ''}${lists.length ? `<div class="pair">${lists.join('')}</div>` : ''}`;
  }

  // Reload the YAML configuration, restart Home Assistant and reboot the host (with the Supervisor only), each once
  // confirmed in a dialog; the restart checks the configuration first, as Home Assistant's own dialog does, and is
  // refused while it is invalid
  _haControls() {
    var reboot = this._hass?.config?.components?.includes('hassio')
      ? this._button('ha_ask:reboot', 'mdi:power-cycle', this._t('ha_reboot'), { danger: true })
      : '';
    return `<div class="actions ha-ctl">${this._message('ha')}<span class="grow"></span>
      ${this._button('ha_ask:reload', 'mdi:reload', this._t('ha_reload'), { quiet: true, busy: this._busy.ha_reload })}
      ${this._button('ha_ask:restart', 'mdi:restart', this._t('ha_restart'), { danger: true })}${reboot}</div>${this._haDialog()}`;
  }

  _haDialog() {
    var kind = { ha_reload: 'reload', ha_restart: 'restart', ha_reboot: 'reboot' }[this._confirm] || null;
    if (!kind) return '';
    var check = kind === 'restart' ? this._haCheck : null;
    var status = '';
    if (check?.checking) status = this._spinner(this._t('ha_checking'), true);
    else if (check?.invalid) {
      status = `<div class="ha-check bad"><ha-icon icon="mdi:alert-circle-outline"></ha-icon><div><b>${shEsc(this._t('ha_invalid'))}</b>
        ${check.errors ? `<pre>${shEsc(check.errors)}</pre>` : ''}</div></div>`;
    } else if (check?.valid) status = `<div class="ha-check good"><ha-icon icon="mdi:check-circle-outline"></ha-icon>${shEsc(this._t('ha_valid'))}</div>`;
    var blocked = Boolean(check?.checking || check?.invalid);
    var icon = { reload: 'mdi:reload', restart: 'mdi:restart', reboot: 'mdi:power-cycle' }[kind];
    var danger = kind !== 'reload';
    return `<div class="ha-backdrop" data-action="cancel"></div>
      <div class="ha-dialog" role="alertdialog" aria-modal="true" aria-labelledby="ha-dialog-title">
        <div class="ha-dhead ${danger ? 'bad' : ''}"><ha-icon icon="${icon}"></ha-icon><span id="ha-dialog-title">${shEsc(this._t(`ha_${kind}_title`))}</span></div>
        <p>${shEsc(this._t(`ha_${kind}_text`))}</p>${status}
        <div class="actions"><span class="grow"></span>${this._button('cancel', 'mdi:close', this._t('cancel'), { quiet: true })}
          ${this._button(`ha_ok:${kind}`, icon, this._t(`ha_${kind}`), { danger, disabled: blocked })}</div></div>`;
  }

  async _haAction(action) {
    var [name, kind] = action.split(':');
    if (name === 'ha_ask') {
      this._confirm = `ha_${kind}`;
      this._haCheck = kind === 'restart' ? { checking: true } : null;
      this._render();
      this.shadowRoot.querySelector('.ha-dialog [data-action="cancel"]')?.focus?.();
      if (kind === 'restart') {
        try {
          var result = await this._hass.callApi('POST', 'config/core/check_config');
          this._haCheck = result?.result === 'invalid' ? { invalid: true, errors: result.errors || '' } : { valid: result?.result === 'valid' };
        } catch (_err) {
          // No check (the configuration panel off): Home Assistant still checks before it restarts
          this._haCheck = {};
        }
        if (this._confirm === 'ha_restart') this._render();
      }
      return;
    }
    this._confirm = null;
    if (kind === 'reload') return this._run('reload_all', 'ha', {}, null, 'homeassistant', 'ha_reload');
    // The restart and the reboot drop the connection: no failure to report then, Home Assistant's own banner takes over
    this._render();
    this._toast(this._t(kind === 'reboot' ? 'ha_rebooting' : 'ha_restarting'));
    try {
      if (kind === 'reboot') await this._hass.callService('hassio', 'host_reboot', {});
      else await this._hass.callService('homeassistant', 'restart', {});
    } catch (err) {
      if (!/connection|lost|closed/i.test(String(err?.message || err?.code || err))) {
        this._messages.ha = { text: this._t('failed', { error: shErr(err) }), tone: 'bad' };
        this._render();
      }
    }
  }

  // The processes System Monitor watches: the stopped ones first (those that may be stopped after them, in grey)
  _processList() {
    var rank = (p) => (p.state === 'on' ? 2 : p.stoppable ? 1 : 0);
    var procs = (this._state.system || []).filter((x) => x.key === 'process').sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
    var stopped = procs.filter((p) => p.state !== 'on' && !p.stoppable).length;
    var procList = procs.length
      ? `<ha-card class="list"><div class="lhead"><ha-icon icon="mdi:application-cog-outline"></ha-icon><span class="lname">${shEsc(this._t('processes'))}</span>
        ${stopped ? `<span class="pill bad">${shEsc(`${stopped} ${this._t('stopped')}`)}</span>` : `<span class="pill good">${shEsc(this._t('running'))}</span>`}</div>
        ${procs
          .map((p) => {
            var on = p.state === 'on';
            // Stopped, as allowed in the System settings: no alert
            var tone = on ? 'good' : p.stoppable ? 'idle' : 'bad';
            var label = on ? this._t('running') : p.stoppable ? this._t('stopped_allowed') : this._t('stopped');
            return `<div class="item link ${tone}" data-more="${shEsc(p.entity_id)}"><ha-icon icon="mdi:cog${on ? '' : '-off'}-outline"></ha-icon>
              <div class="who"><div class="n">${shEsc(shProcess(p))}</div></div><span class="pill ${tone}">${shEsc(label)}</span></div>`;
          })
          .join('')}</ha-card>`
      : '';
    return procList;
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
  _ring(sensor, label, color, unit, values, tone) {
    var v = shNum(sensor.state);
    var c = 2 * Math.PI * 40;
    var dash = v === null ? 0 : (c * Math.min(Math.max(v, 0), 100)) / 100;
    var shown = v === null ? '—' : Math.round(v);
    return `<ha-card class="ring link" data-more="${shEsc(sensor.entity_id)}" style="--ring:${color}">
      ${values ? shArea(values, 100) : ''}
      <svg class="gauge" viewBox="0 0 100 100" aria-hidden="true"><circle class="track" cx="50" cy="50" r="40"/>
        <circle class="arc" cx="50" cy="50" r="40" stroke-dasharray="${dash.toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 50 50)"/></svg>
      <div class="rv ${tone === 'good' ? '' : tone || ''}"><b>${shown}</b><span>${shEsc(unit)}</span></div>
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
        ${data === null ? `<span class="cnote">${this._spinner(this._t('loading'), true)}</span>` : empty ? `<span class="cnote">${shEsc(this._t('chart_empty'))}</span>` : ''}</div>
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
      this._tile('mdi:clock-check-outline', shEsc(this._rel(data.last_update)), this._t('last_check'), data.error ? 'bad' : ''),
    ];
    var order = { core: 0, supervisor: 1, plugin: 2, addon: 3 };
    // Core, the Supervisor and the add-ons have their own icon; the others (the plugins), Docker's
    var icons = { core: 'mdi:home-assistant', supervisor: 'mdi:shield-home-outline', addon: 'mdi:puzzle-outline' };
    var rows = [...list]
      .sort((a, b) => (b.down ? 1 : 0) - (a.down ? 1 : 0) || order[a.kind] - order[b.kind] || (a.container || a.name).localeCompare(b.container || b.name))
      .map((c) => {
        var on = c.state === 'started' || c.state === 'startup';
        var tone = c.down ? 'bad' : on ? 'good' : '';
        var cpu = shNum(c.cpu_percent);
        var mem = shNum(c.memory_percent);
        var spark = shSpark((history[c.slug] || []).map((p) => p[1]));
        // As Docker lists it: the container's name, then what it is and its image (or its version)
        var sub = [c.container ? c.name : this._t(c.kind), c.image || c.version].filter(Boolean);
        var update = c.update_available ? `<span class="pill warn" title="${shEsc(this._t('update', { version: c.version_latest }))}"><ha-icon icon="mdi:arrow-up-circle-outline"></ha-icon>${shEsc(c.version_latest || '')}</span>` : '';
        return `<div class="item ${tone}"><ha-icon icon="${icons[c.kind] || 'mdi:docker'}"></ha-icon>
          <div class="who"><div class="n">${shEsc(c.container || c.name)}</div><div class="s" title="${shEsc(sub.join(' · '))}">${shEsc(sub.join(' · '))}</div></div>${update}
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
      ${data.error ? `<span class="msg bad">${shEsc(data.error)}</span>` : ''}${this._configure()}</div>
      <ha-card class="list"><div class="lhead"><ha-icon icon="mdi:docker"></ha-icon><span class="lname">${shEsc(this._t('containers'))}</span><span class="muted">${running}/${list.length}</span></div>
      ${rows || `<div class="empty"><ha-icon icon="mdi:docker"></ha-icon>${shEsc(this._t('no_containers'))}</div>`}</ha-card>
      ${this._processList()}`;
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
      this._tile('mdi:clock-check-outline', shEsc(data.running ? '…' : this._rel(data.last_check)), this._t('last_check'), data.paused ? 'warn' : ''),
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
          <div class="side muted">${shEsc(this._rel(h.at))}</div></div>`;
      })
      .join('');
    return `<div class="tiles">${tiles.join('')}</div>
      <div class="actions">${this._button('watchdog_check', 'mdi:shield-search', this._entityName('button', 'watchdog_check'), { busy: data.running || this._busy.watchdog_check })}
      ${data.paused ? `<span class="pill warn">${shEsc(this._t('paused'))}</span>` : ''}${this._message('watchdog_check')}${this._message('watchdog_reset')}${this._configure()}</div>
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
        ${this._button('open_settings:watchdog', 'mdi:cog-outline', this._t('pc_configure'), { quiet: true })}</div>
      ${rows || `<div class="empty">${shEsc(this._t('pc_none'))}</div>`}</ha-card>`;
  }

  // Marketplace: a header with the check (when, next, GitHub's account and quota) and the buttons, the check's
  // progress while it runs, then a card per update (logo, installed → latest with the size of the change, the start
  // of the release notes, Release notes and Update), and the repositories that could not be checked
  _marketplace() {
    var data = this._state.marketplace || {};
    var running = data.state === 'running';
    var list = data.list || [];
    // The updates waiting now (the Marketplace's update entities), not the count of the last check: one installed since
    // is gone from both the cards and the count
    var n = Array.isArray(data.list) ? list.length : data.updates || 0;
    var failedNames = data.failed || [];
    var installing = data.installing_updates || this._busy.marketplace_install_updates;
    var title = n ? this._t(n === 1 ? 'mk_title_one' : 'mk_title', { n }) : running ? this._t('checking') : this._t('no_updates');
    var tone = data.state === 'error' ? 'bad' : n || failedNames.length ? 'warn' : 'good';
    var meta = [
      data.last_check ? this._t('mk_checked', { when: this._rel(data.last_check) }) : '',
      data.scan_interval && data.next_due ? this._t('mk_next', { when: this._rel(data.next_due) }) : '',
      failedNames.length && !running ? this._t('mk_failed', { n: failedNames.length }) : '',
    ].filter(Boolean);
    // GitHub: the account connected to the Marketplace, the requests left, when it tries again after the limit
    var retry = data.retry_after && new Date(data.retry_after) > new Date() ? this._t('gh_retry', { when: this._rel(data.retry_after) }) : '';
    var github = [
      data.github_connected === false ? this._t('gh_not_connected') : data.github_connected ? this._t('gh_connected') : '',
      Number.isInteger(data.rate_limit_remaining) ? this._t('gh_requests', { n: data.rate_limit_remaining }) : '',
      data.not_checked ? this._t('not_checked', { n: data.not_checked }) : '',
    ].filter(Boolean);
    var confirm = this._confirm === 'install'
      ? `<div class="confirm" role="alertdialog">${shEsc(this._t('confirm_install'))}
          ${this._button('marketplace_install_updates', 'mdi:package-down', this._t('install_all'))}
          ${this._button('cancel', 'mdi:close', this._t('cancel'), { quiet: true })}</div>`
      : '';
    var header = `<ha-card class="mkhead ${tone}"><div class="avatar"><ha-icon icon="${running ? 'mdi:archive-sync' : n ? 'mdi:archive-alert-outline' : 'mdi:archive-check-outline'}"></ha-icon></div>
      <div class="who"><div class="n">${shEsc(title)}</div>
        ${meta.length ? `<div class="s">${shEsc(meta.join(' · '))}</div>` : ''}
        ${github.length || retry ? `<div class="s mkgh"><ha-icon icon="mdi:github"></ha-icon><span>${shEsc(github.join(' · '))}${retry ? `<span class="warn-text">${github.length ? ' · ' : ''}${shEsc(retry)}</span>` : ''}</span></div>` : ''}
        ${data.error ? `<div class="s warn-text">${shEsc(data.error)}</div>` : ''}</div>
      <div class="actions">${this._button('marketplace_check_updates', 'mdi:archive-refresh', this._entityName('button', 'marketplace_check_updates'), {
        quiet: Boolean(n),
        disabled: data.installing_updates,
        busy: running || this._busy.marketplace_check_updates,
      })}
      ${n ? this._button('confirm_install', 'mdi:package-down', `${this._t(this._state.system_updates ? 'mk_update_marketplace' : 'install_all')} (${n})`, { disabled: running, busy: installing }) : ''}
      <button class="act quiet mkgear" data-action="open_settings:marketplace" title="${shEsc(this._t('configure'))}" aria-label="${shEsc(this._t('configure'))}"><ha-icon icon="mdi:cog-outline"></ha-icon></button></div></ha-card>`;
    var cards = list.map((u) => this._mkCard(u)).join('');
    var failed = failedNames
      .map(
        (name) => `<div class="item warn"><ha-icon icon="mdi:alert-outline"></ha-icon><div class="who"><div class="n">${shEsc(name)}</div><div class="s">${shEsc(this._t('could_not_check'))}</div></div>
        ${name.includes('/') ? `<a class="act quiet" href="https://github.com/${shEsc(name)}" target="_blank" rel="noreferrer"><ha-icon icon="mdi:open-in-new"></ha-icon>GitHub</a>` : ''}</div>`,
      )
      .join('');
    if (list.length) this._mkFetchNotes(list);
    var system = this._state.system_updates;
    return `${system ? this._sysUpdates(system) : ''}${system ? `<h2 class="stsec">${shEsc(this._t('upd_marketplace'))}</h2>` : ''}${header}${running ? this._progress(data) : ''}${confirm}
      ${this._messages.marketplace_check_updates || this._messages.marketplace_install_updates ? `<div class="actions">${this._message('marketplace_check_updates')}${this._message('marketplace_install_updates')}</div>` : ''}
      ${cards ? `<div class="mkgrid">${cards}</div>` : ''}
      ${failed && !running ? `<ha-card class="list">${failed}</ha-card>` : ''}`;
  }

  // Home Assistant's log (system_log/list): the warnings and errors kept since it started, read every minute at most
  async _lgLoad(force) {
    if (!this._hass?.callWS || (!force && this._lg?.at && Date.now() - this._lg.at < 60000)) return;
    this._lg = { ...(this._lg || {}), at: Date.now() };
    try {
      this._lg = { entries: await this._hass.callWS({ type: 'system_log/list' }), at: Date.now(), error: null };
    } catch (err) {
      this._lg = { ...this._lg, error: shErr(err) };
    }
  }

  // A message's key for Ignore: its logger and the start of its first line
  _lgKey(e) {
    return `${e.name}|${String(e.message?.[0] ?? '').slice(0, 160)}`;
  }

  // The messages by integration (homeassistant.components.<x>, custom_components.<x>, else the logger's root), the
  // ones ignored left out: level 'error' (errors only), 'warning' or 'all'; period 'hour', 'day' or 'all' (since start)
  _lgGroups(level, period) {
    var ignored = new Set(this._state.logs?.ignored_messages || []);
    var since = { hour: 3600, day: 86400 }[period];
    var now = Date.now() / 1000;
    var isError = (e) => e.level === 'ERROR' || e.level === 'CRITICAL';
    var groups = {};
    for (var e of this._lg?.entries || []) {
      if (ignored.has(this._lgKey(e)) || (since && now - e.timestamp > since)) continue;
      if ((level === 'error' && !isError(e)) || (level === 'warning' && isError(e))) continue;
      var m = /^(?:homeassistant\.components|custom_components)\.([^.]+)/.exec(e.name || '');
      var domain = m ? m[1] : (e.name || '').split('.')[0] || '?';
      var g = (groups[domain] ??= { domain, errors: 0, warnings: 0, last: 0, entries: [], custom: (e.name || '').startsWith('custom_components.') });
      g[isError(e) ? 'errors' : 'warnings'] += e.count || 1;
      g.last = Math.max(g.last, e.timestamp);
      g.entries.push(e);
    }
    return Object.values(groups)
      .map((g) => ({ ...g, entries: g.entries.sort((a, b) => b.timestamp - a.timestamp) }))
      .sort((a, b) => b.errors - a.errors || b.warnings - a.warnings || b.last - a.last);
  }

  // Logs: the errors and warnings by integration, a level and a period; each message with how many times it came, its
  // source and its traceback; Reload an integration, Ignore a message, Clear the log
  _logs() {
    if (!this._lg?.entries) {
      if (this._lg?.error) return `<ha-card class="note error" role="alert">${shEsc(this._t('failed', { error: this._lg.error }))}</ha-card>`;
      if (!this._lg) this._lgLoad().then(() => this._render());
      return `<ha-card class="note">${this._spinner(this._t('loading'))}</ha-card>`;
    }
    var level = this._lgLevel || 'all';
    var period = this._lgPeriod || 'day';
    var groups = this._lgGroups(level, period);
    var all = this._lgGroups('all', period);
    var errors = all.reduce((sum, g) => sum + g.errors, 0);
    var warnings = all.reduce((sum, g) => sum + g.warnings, 0);
    var threshold = this._state.logs?.error_threshold ?? 10;
    var ignored = (this._state.logs?.ignored_messages || []).length;
    var tiles = [
      this._tile('mdi:alert-circle-outline', `<b>${errors}</b>`, this._t('lg_errors'), errors ? (all.some((g) => g.errors >= threshold) ? 'bad' : 'warn') : 'good'),
      this._tile('mdi:alert-outline', `<b>${warnings}</b>`, this._t('lg_warnings'), warnings ? 'warn' : 'good'),
      this._tile('mdi:puzzle-outline', `<b>${all.filter((g) => g.errors || g.warnings).length}</b>`, this._t('lg_integrations'), ''),
      this._tile('mdi:eye-off-outline', `<b>${ignored}</b>`, this._t('lg_ignored'), ''),
    ];
    var seg = (action, value, current, label) =>
      `<button class="btab${value === current ? ' on' : ''}" data-action="${action}" data-value="${value}" aria-pressed="${value === current}">${shEsc(label)}</button>`;
    var filters = `<div class="btabs" role="group" aria-label="${shEsc(this._t('lg_level'))}">${seg('lg_level', 'error', level, this._t('lg_errors'))}${seg('lg_level', 'warning', level, this._t('lg_warnings'))}${seg('lg_level', 'all', level, this._t('sl_all'))}</div>
      <div class="btabs" role="group" aria-label="${shEsc(this._t('lg_period'))}">${seg('lg_period', 'hour', period, this._t('lg_hour'))}${seg('lg_period', 'day', period, this._t('lg_day'))}${seg('lg_period', 'all', period, this._t('lg_since_start'))}</div>`;
    var confirm =
      this._confirm === 'lg_clear'
        ? `<div class="confirm" role="alertdialog">${shEsc(this._t('lg_clear_confirm'))}
          ${this._button('lg_clear', 'mdi:delete-sweep-outline', this._t('lg_clear'))}${this._button('cancel', 'mdi:close', this._t('cancel'), { quiet: true })}</div>`
        : '';
    var actions = `<div class="actions">${filters}${this._message('lg')}
      <a class="act quiet" href="/config/logs"><ha-icon icon="mdi:text-box-outline"></ha-icon>${shEsc(this._t('lg_full'))}</a>
      ${this._button('lg_clear_confirm', 'mdi:delete-sweep-outline', this._t('lg_clear'), { quiet: true, busy: this._busy.lg_clear })}${this._configure()}</div>${confirm}`;
    var cards = groups
      .map((g) => {
        var tone = g.errors >= threshold ? 'bad' : g.errors ? 'warn' : 'info';
        var counts = [g.errors ? this._t('lg_n_errors', { n: g.errors }) : '', g.warnings ? this._t('lg_n_warnings', { n: g.warnings }) : ''].filter(Boolean).join(' · ');
        var reload = g.domain !== 'homeassistant' ? this._button('lg_reload', 'mdi:reload', this._t('lg_reload'), { quiet: true, data: { domain: g.domain }, busy: this._busy[`lg_reload:${g.domain}`] }) : '';
        var entries = g.entries
          .map((e) => {
            var first = String(e.message?.[0] ?? '');
            var source = Array.isArray(e.source) ? `${String(e.source[0]).split('/').slice(-2).join('/')}:${e.source[1]}` : '';
            var trace = e.exception ? `<details><summary class="s">${shEsc(this._t('lg_traceback'))}</summary><pre class="lgpre">${shEsc(e.exception)}</pre></details>` : '';
            return `<div class="lgentry"><div class="lgmsg">${shEsc(first)}</div>
              <div class="s">${shEsc([`×${e.count || 1}`, this._rel(new Date(e.timestamp * 1000).toISOString()), e.name, source].filter(Boolean).join(' · '))}</div>${trace}
              <div class="actions">${this._button('lg_ignore', 'mdi:eye-off-outline', this._t('sl_ignore'), { quiet: true, data: { key: this._lgKey(e) }, busy: this._busy[`lg_ignore:${this._lgKey(e)}`] })}</div></div>`;
          })
          .join('');
        return `<ha-card class="list lggroup ${tone}"><div class="lhead"><ha-icon icon="${g.custom ? 'mdi:puzzle-outline' : 'mdi:home-assistant'}"></ha-icon><span class="lname">${shEsc(shIntegration(g.domain))} <span class="pill ${tone}">${shEsc(counts)}</span></span>${reload}</div>${entries}</ha-card>`;
      })
      .join('');
    return `<div class="tiles">${tiles.join('')}</div>${actions}
      ${cards || `<ha-card class="list"><div class="empty good"><ha-icon icon="mdi:check-circle-outline"></ha-icon>${shEsc(this._t('lg_none'))}</div></ha-card>`}`;
  }

  // A message left out: saved in the module's settings at once, gone from the list
  async _lgIgnore(key) {
    this._busy[`lg_ignore:${key}`] = true;
    this._render();
    try {
      await this._hass.callWS({ type: 'system_hub/logs_ignore', key });
    } catch (err) {
      this._messages.lg = { text: this._t('failed', { error: shErr(err) }), tone: 'bad' };
    }
    delete this._busy[`lg_ignore:${key}`];
    await this._load();
  }

  // Reloads every entry of an integration (its errors often come from a lost connection)
  async _lgReload(domain) {
    this._busy[`lg_reload:${domain}`] = true;
    this._render();
    try {
      var entries = await this._hass.callWS({ type: 'config_entries/get', domain });
      if (!entries?.length) throw new Error(this._t('lg_no_entry'));
      for (var entry of entries) await this._hass.callService('homeassistant', 'reload_config_entry', { entry_id: entry.entry_id });
      this._toast(this._t('done'));
    } catch (err) {
      this._messages.lg = { text: this._t('failed', { error: shErr(err) }), tone: 'bad' };
    }
    delete this._busy[`lg_reload:${domain}`];
    this._render();
  }

  // Silent devices: the devices of the radio integrations not heard from beyond the hours set, then the weak signals
  _silent() {
    var data = this._state.silent || {};
    var all = data.devices || [];
    var quiet = all.filter((d) => d.silent);
    var weak = all.filter((d) => !d.silent && d.signal?.weak);
    var kinds = data.integrations || [];
    var filter = kinds.includes(this._slFilter) ? this._slFilter : null;
    var list = filter ? all.filter((d) => d.integration === filter) : all;
    var tiles = [
      this._tile('mdi:access-point-off', `<b>${quiet.length}</b>`, this._t('sl_silent'), quiet.length ? 'warn' : 'good'),
      this._tile('mdi:wifi-strength-1-alert', `<b>${weak.length}</b>`, this._t('sl_weak'), weak.length ? 'info' : 'good'),
      this._tile('mdi:access-point', `<b>${data.tracked ?? 0}</b>`, this._t('sl_tracked'), ''),
      this._tile('mdi:eye-off-outline', `<b>${data.ignored ?? 0}</b>`, this._t('sl_ignored'), ''),
    ];
    var seg = (kind, label) =>
      `<button class="btab${(kind || null) === filter ? ' on' : ''}" data-action="sl_filter" data-kind="${shEsc(kind || '')}" aria-pressed="${(kind || null) === filter}">${shEsc(label)}</button>`;
    var filters = kinds.length > 1 ? `<div class="btabs" role="group">${seg('', this._t('sl_all'))}${kinds.map((k) => seg(k, shIntegration(k))).join('')}</div>` : '';
    var rows = list
      .map((d) => {
        var tone = d.silent ? 'warn' : 'info';
        var signal = d.signal ? `${d.signal.kind === 'lqi' ? 'LQI' : 'RSSI'} ${d.signal.value}${d.signal.kind === 'rssi' ? ' dBm' : ''}` : '';
        var power = d.battery ? (d.level === null || d.level === undefined ? this._t('sl_battery_unknown') : this._t('sl_battery', { n: d.level })) : this._t('sl_mains');
        var heard = d.unavailable ? this._t('sl_unavailable_since', { when: this._rel(d.last_heard) }) : this._t('sl_heard', { when: this._rel(d.last_heard) });
        return `<div class="item ${tone}"><ha-icon icon="${d.silent ? 'mdi:access-point-off' : 'mdi:wifi-strength-1-alert'}"></ha-icon>
          <div class="who"><div class="n">${shEsc(d.name)}</div><div class="s">${shEsc([d.area, shIntegration(d.integration), heard, signal, power].filter(Boolean).join(' · '))}</div></div>
          <span class="pill ${tone}">${shEsc(this._t(d.silent ? 'sl_silent' : 'sl_weak'))}</span>
          <a class="act quiet" href="/config/devices/device/${encodeURIComponent(d.device_id)}"><ha-icon icon="mdi:open-in-new"></ha-icon>${shEsc(this._t('open_device'))}</a>
          ${this._button('sl_ignore', 'mdi:eye-off-outline', this._t('sl_ignore'), { quiet: true, data: { device: d.device_id, name: d.name }, busy: this._busy[`sl_ignore:${d.device_id}`] })}</div>`;
      })
      .join('');
    var hint = this._t('sl_hint', { battery: data.battery_hours ?? 24, mains: data.mains_hours ?? 24 });
    return `<div class="tiles">${tiles.join('')}</div>
      <div class="actions">${filters}${this._message('sl')}${this._configure()}</div>
      <span class="msg">${shEsc(hint)}</span>
      <ha-card class="list">${rows || `<div class="empty good"><ha-icon icon="mdi:check-circle-outline"></ha-icon>${shEsc(this._t('sl_none'))}</div>`}</ha-card>`;
  }

  // A device left out of the module: saved in its settings at once, gone from the list
  async _slIgnore(device, name) {
    this._busy[`sl_ignore:${device}`] = true;
    this._render();
    try {
      await this._hass.callWS({ type: 'system_hub/silent_ignore', device_id: device });
      this._toast(this._t('sl_ignored_done', { name }));
    } catch (err) {
      this._messages.sl = { text: this._t('failed', { error: shErr(err) }), tone: 'bad' };
    }
    delete this._busy[`sl_ignore:${device}`];
    await this._load();
  }

  // Home Assistant's backups (the Backup integration's backup/info and its locations), read when the tab is shown
  async _bkLoad(force) {
    if (!this._hass?.callWS || (!force && this._bk?.at && Date.now() - this._bk.at < 60000)) return;
    this._bk = { ...(this._bk || {}), at: Date.now() };
    try {
      var [info, agents] = await Promise.all([
        this._hass.callWS({ type: 'backup/info' }),
        this._hass.callWS({ type: 'backup/agents/info' }).catch(() => ({ agents: [] })),
      ]);
      this._bk = { info, agents: agents?.agents || [], at: Date.now(), error: null };
    } catch (err) {
      this._bk = { ...this._bk, error: shErr(err) };
    }
    if (this._tab === 'backups') this._render();
  }

  // The last automatic backups and the locations: from backup/info once read, else from the Backup sensors
  _bkSummary() {
    var max = this._state.backups?.max_age ?? 3;
    var info = this._bk?.info;
    var sensor = (key) => (this._state.system || []).find((x) => x.key === key)?.state;
    var valid = (v) => (v && !Number.isNaN(Date.parse(v)) ? v : null);
    var lastOk = valid(info ? info.last_completed_automatic_backup : sensor('backup_last_successful_automatic_backup'));
    var lastTry = valid(info ? info.last_attempted_automatic_backup : sensor('backup_last_attempted_automatic_backup'));
    var next = valid(info ? info.next_automatic_backup : sensor('backup_next_scheduled_automatic_backup'));
    if (!info && !lastOk && !lastTry && !next) return null;
    var failed = Boolean(lastTry && (!lastOk || Date.parse(lastTry) > Date.parse(lastOk)));
    var old = !lastOk || Date.now() - Date.parse(lastOk) > max * 86400000;
    var backups = [...(info?.backups || [])].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
    var names = Object.fromEntries((this._bk?.agents || []).map((a) => [a.agent_id, a.name || a.agent_id]));
    var ids = [...new Set([...Object.keys(names), ...backups.flatMap((b) => Object.keys(b.agents || {}))])];
    var lastAuto = backups.find((b) => b.with_automatic_settings);
    var agents = ids.map((id) => {
      var mine = backups.filter((b) => b.agents?.[id]);
      var error = info?.agent_errors?.[id] || '';
      return { id, name: names[id] || id, last: mine[0]?.date || null, count: mine.length, error, failed: Boolean(error) || Boolean(lastAuto?.failed_agent_ids?.includes(id)) };
    });
    var failing = agents.filter((a) => a.failed);
    var tone = failed ? 'bad' : old || failing.length ? 'warn' : 'good';
    return { max, lastOk, lastTry, next, failed, old, backups, agents, failing, tone };
  }

  // The size of a backup: the largest copy among its locations
  _bkSize(b) {
    var sizes = Object.values(b?.agents || {}).map((a) => a?.size).filter((v) => typeof v === 'number');
    return sizes.length ? shBytes(Math.max(...sizes)) : '—';
  }

  // Backups: the last success, the next one, the size, each location and the last 30 days; Back up now
  _backups() {
    if (!this._bk?.info) {
      if (!this._bk) this._bkLoad();
      if (this._bk?.error) {
        return `<ha-card class="note error" role="alert">${shEsc(this._t('bk_read_failed', { error: this._bk.error }))}
          <button class="act" data-action="reload"><ha-icon icon="mdi:refresh"></ha-icon>${shEsc(this._t('refresh'))}</button></ha-card>`;
      }
      return `<ha-card class="note">${this._spinner(this._t('loading'))}</ha-card>`;
    }
    var bk = this._bkSummary();
    var running = this._bk.info.state && this._bk.info.state !== 'idle';
    var okAgents = bk.agents.filter((a) => !a.failed).length;
    var tiles = [
      this._tile('mdi:backup-restore', shEsc(bk.lastOk ? this._rel(bk.lastOk) : this._t('never')), bk.failed ? this._t('backup_failed') : this._t('last_backup'), bk.failed ? 'bad' : bk.old ? 'warn' : 'good'),
      this._tile('mdi:calendar-clock', shEsc(running ? this._t('backing_up') : bk.next ? this._rel(bk.next) : '—'), this._t('next_backup'), running ? 'warn' : ''),
      this._tile('mdi:harddisk', shEsc(this._bkSize(bk.backups[0])), this._t('bk_size'), ''),
      this._tile('mdi:server-network', shEsc(this._t('bk_locations_ok', { ok: okAgents, total: bk.agents.length })), this._t('bk_locations'), bk.failing.length ? 'warn' : bk.agents.length ? 'good' : ''),
    ];
    var actions = `<div class="actions">${bk.old && !bk.failed ? `<span class="msg warn-text">${shEsc(this._t('bk_old', { n: bk.max }))}</span>` : ''}${this._message('bk')}
      <span class="grow"></span>
      <a class="act quiet" href="/config/backup/settings"><ha-icon icon="mdi:cog-outline"></ha-icon>${shEsc(this._t('bk_settings'))}</a>
      ${this._button('bk_now', 'mdi:content-save-outline', this._t('bk_now'), { busy: running || this._busy.bk_now })}</div>`;
    var agents = bk.agents
      .map(
        (a) => `<div class="item${a.failed ? ' warn' : ''}"><ha-icon icon="${a.failed ? 'mdi:alert-outline' : 'mdi:check-circle-outline'}"></ha-icon>
        <div class="who"><div class="n">${shEsc(a.name)}</div><div class="s">${shEsc([a.last ? `${this._t('last_backup')} ${this._rel(a.last)}` : this._t('never'), this._t('bk_kept', { n: a.count }), a.error].filter(Boolean).join(' · '))}</div></div>
        <span class="pill ${a.failed ? 'bad' : 'good'}">${shEsc(this._t(a.failed ? 'bk_failed_location' : 'bk_ok_location'))}</span></div>`,
      )
      .join('');
    // The last 30 days, oldest first: a backup that day, the last attempt failed that day, or nothing
    var day = (v) => new Date(v).toDateString();
    var done = new Set(bk.backups.map((b) => day(b.date)));
    var days = Array.from({ length: 30 }, (_v, i) => {
      var d = new Date(Date.now() - (29 - i) * 86400000);
      var cls = done.has(d.toDateString()) ? 'ok' : bk.failed && day(bk.lastTry) === d.toDateString() ? 'bad' : '';
      return `<span class="bkday ${cls}" title="${shEsc(d.toLocaleDateString(this._hass?.language))}"></span>`;
    }).join('');
    var list = bk.backups
      .slice(0, 10)
      .map(
        (b) => `<a class="item link" href="/config/backup/details/${encodeURIComponent(b.backup_id)}"><ha-icon icon="mdi:archive-outline"></ha-icon>
        <div class="who"><div class="n">${shEsc(b.name || b.backup_id)}</div><div class="s">${shEsc(
          [this._rel(b.date), this._t(b.with_automatic_settings ? 'bk_auto' : 'bk_manual'), Object.keys(b.agents || {}).map((id) => bk.agents.find((a) => a.id === id)?.name || id).join(', ')].join(' · '),
        )}</div></div><span class="pill">${shEsc(this._bkSize(b))}</span></a>`,
      )
      .join('');
    return `<div class="tiles">${tiles.join('')}</div>${actions}
      ${agents ? `<ha-card class="list"><div class="lhead"><ha-icon icon="mdi:server-network"></ha-icon><span class="lname">${shEsc(this._t('bk_locations'))}</span></div>${agents}</ha-card>` : ''}
      <ha-card class="block"><h2>${shEsc(this._t('bk_days'))}</h2><div class="bkdays" role="img" aria-label="${shEsc(this._t('bk_days'))}">${days}</div></ha-card>
      <ha-card class="list"><div class="lhead"><ha-icon icon="mdi:archive-outline"></ha-icon><span class="lname">${shEsc(this._t('bk_list'))}</span><span class="muted">${bk.backups.length}</span></div>${list || `<div class="item"><div class="who"><div class="s">${shEsc(this._t('bk_none'))}</div></div></div>`}</ha-card>`;
  }

  // The recorder's database (system_hub/database): read every 5 minutes at most; the server counts the states once an
  // hour, force counts them again
  async _dbLoad(force, recount) {
    if (!this._hass?.callWS || (!force && this._db?.at && Date.now() - this._db.at < 300000)) return;
    this._db = { ...(this._db || {}), at: Date.now() };
    if (recount) this._busy.db_refresh = true;
    try {
      this._db = { data: await this._hass.callWS({ type: 'system_hub/database', force: Boolean(recount) }), at: Date.now(), error: null };
    } catch (err) {
      this._db = { ...this._db, error: shErr(err) };
    }
    delete this._busy.db_refresh;
    if (this._tab === 'database' || recount) this._render();
  }

  // The size against the limit set: bad beyond it, warn from 80 %
  _dbTone(size) {
    var max = (this._state.database?.max_size ?? 2) * 1073741824;
    return typeof size !== 'number' ? '' : size > max ? 'bad' : size > max * 0.8 ? 'warn' : 'good';
  }

  // The lines to add to configuration.yaml so that the recorder no longer records the entities chosen
  _dbYaml(entities) {
    return ['recorder:', '  exclude:', '    entities:', ...entities.map((e) => `      - ${e}`)].join('\n');
  }

  async _dbCopy() {
    try {
      await navigator.clipboard.writeText(this._dbYaml([...(this._dbSel || [])]));
      this._toast(this._t('db_copied'));
    } catch (err) {
      this._messages.db = { text: this._t('failed', { error: shErr(err) }), tone: 'bad' };
      this._render();
    }
  }

  // Database: its size, its retention, the states of the day; the entities that wrote the most, to purge their history
  // or to leave out of the recorder; Purge and repack
  _database() {
    var data = this._db?.data;
    if (!data) {
      if (this._db?.error) {
        return `<ha-card class="note error" role="alert">${shEsc(this._t('failed', { error: this._db.error }))}
          <button class="act" data-action="db_refresh"><ha-icon icon="mdi:refresh"></ha-icon>${shEsc(this._t('refresh'))}</button></ha-card>`;
      }
      if (!this._db) this._dbLoad();
      return `<ha-card class="note">${this._spinner(this._t('loading'))}</ha-card>`;
    }
    var max = this._state.database?.max_size ?? 2;
    var sel = (this._dbSel ??= new Set());
    var top = data.top || [];
    for (var id of [...sel]) if (!top.some((e) => e.entity_id === id)) sel.delete(id);
    var tone = this._dbTone(data.size);
    var tiles = [
      this._tile('mdi:database-outline', shEsc(typeof data.size === 'number' ? shBytes(data.size) : '—'), this._t('db_size'), tone, {
        title: typeof data.size === 'number' ? this._t('db_limit', { n: max }) : this._t('db_no_size'),
      }),
      this._tile('mdi:calendar-range', shEsc(this._t('db_days', { n: data.keep_days })), this._t(data.auto_purge ? 'db_retention' : 'db_no_auto_purge'), data.auto_purge ? '' : 'warn'),
      this._tile('mdi:chart-timeline-variant', `<b>${(data.total_day ?? 0).toLocaleString(this._hass?.language)}</b>`, this._t('db_states_day'), ''),
      this._tile('mdi:database-cog-outline', shEsc(data.engine === 'sqlite' ? 'SQLite' : data.engine === 'postgresql' ? 'PostgreSQL' : data.engine === 'mysql' ? 'MariaDB / MySQL' : data.engine), this._t('db_engine'), ''),
    ];
    var confirm =
      this._confirm === 'db_repack'
        ? `<div class="confirm" role="alertdialog">${shEsc(this._t('db_repack_confirm', { n: data.keep_days }))}
          ${this._button('db_repack', 'mdi:database-refresh-outline', this._t('db_repack'))}${this._button('cancel', 'mdi:close', this._t('cancel'), { quiet: true })}</div>`
        : '';
    var actions = `<div class="actions">${tone === 'bad' ? `<span class="msg warn-text">${shEsc(this._t('db_over', { n: max }))}</span>` : ''}${this._message('db')}
      <span class="grow"></span>
      ${this._button('db_refresh', 'mdi:refresh', this._t('db_recount'), { quiet: true, busy: this._busy.db_refresh })}
      ${this._button('db_repack_confirm', 'mdi:database-refresh-outline', this._t('db_repack'), { quiet: true, busy: this._busy.db_repack })}${this._configure()}</div>${confirm}`;
    var total = data.total_day || 0;
    var rows = top
      .map((e) => {
        var on = sel.has(e.entity_id);
        var share = total ? Math.round((e.count / total) * 100) : 0;
        return `<button class="item dbrow${on ? ' on' : ''}" data-action="db_pick" data-entity="${shEsc(e.entity_id)}" aria-pressed="${on}">
          <ha-icon icon="mdi:checkbox-${on ? 'marked' : 'blank-outline'}"></ha-icon>
          <div class="who"><div class="n">${shEsc(e.name)}${e.excluded ? ` <span class="pill">${shEsc(this._t('db_excluded'))}</span>` : ''}</div>
            <div class="s">${shEsc(e.entity_id)}</div><div class="dbbar"><span style="width:${Math.max(share, 1)}%"></span></div></div>
          <span class="dbcount"><b>${e.count.toLocaleString(this._hass?.language)}</b><span class="s">${share} %</span></span></button>`;
      })
      .join('');
    var chosen = [...sel];
    var purge =
      this._confirm === 'db_purge'
        ? `<div class="confirm" role="alertdialog">${shEsc(this._t('db_purge_confirm', { n: chosen.length }))}
          ${this._button('db_purge', 'mdi:delete-clock-outline', this._t('db_purge'))}${this._button('cancel', 'mdi:close', this._t('cancel'), { quiet: true })}</div>`
        : '';
    var picked = chosen.length
      ? `<div class="dbpick"><div class="actions">${this._button('db_purge_confirm', 'mdi:delete-clock-outline', `${this._t('db_purge')} (${chosen.length})`, { busy: this._busy.db_purge })}</div>${purge}
        <div class="s">${shEsc(this._t('db_exclude'))}</div>
        <div class="dbyaml"><pre class="lgpre">${shEsc(this._dbYaml(chosen))}</pre>${this._button('db_copy', 'mdi:content-copy', this._t('db_copy'), { quiet: true })}</div></div>`
      : `<div class="item"><div class="who"><div class="s">${shEsc(this._t(top.length ? 'db_pick_hint' : 'db_none'))}</div></div></div>`;
    return `<div class="tiles">${tiles.join('')}</div>${actions}
      <ha-card class="list"><div class="lhead"><ha-icon icon="mdi:chart-bar"></ha-icon><span class="lname">${shEsc(this._t('db_top'))}</span>
        <span class="muted">${shEsc(this._t('db_counted', { when: this._rel(new Date(data.counted_at * 1000).toISOString()) }))}</span></div>${rows}${picked}</ha-card>`;
  }

  // Security (system_hub/security): read every 5 minutes at most; the add-ons and the YAML files are read again by the
  // server once an hour, force (Scan now) reads them at once
  async _scLoad(force, rescan) {
    if (!this._hass?.callWS || (!force && this._sc?.at && Date.now() - this._sc.at < 300000)) return;
    this._sc = { ...(this._sc || {}), at: Date.now() };
    if (rescan) this._busy.sc_scan = true;
    try {
      this._sc = { data: await this._hass.callWS({ type: 'system_hub/security', force: Boolean(rescan) }), at: Date.now(), error: null };
    } catch (err) {
      this._sc = { ...this._sc, error: shErr(err) };
    }
    delete this._busy.sc_scan;
    if (this._tab === 'security' || rescan) this._render();
  }

  // What needs a look: refusals from the Internet in 24 h, recent bans, add-ons not protected (bad); administrators
  // without 2FA, credentials in clear, an external URL without HTTPS, unused tokens (warn)
  _scSummary() {
    var d = this._sc?.data;
    if (!d) return null;
    var day = Date.now() / 1000 - 86400;
    var refused = (d.refused || []).filter((r) => r.internet && !r.ignored && r.day > 0);
    var bans = (d.bans || []).filter((b) => b.at > day);
    // An add-on allowed to run unprotected (Settings → Security, or Allow here) is not a problem
    var unprotected = (d.addons || []).filter((a) => !a.protected && !a.allowed);
    var noMfa = (d.users || []).filter((u) => u.admin && u.active && !u.mfa);
    var admins = (d.users || []).filter((u) => u.admin && u.active);
    var unused = (d.tokens || []).filter((t) => t.unused);
    var clear = d.config || [];
    var http = d.exposure?.https === false;
    var bad = refused.length + bans.length + unprotected.length;
    var warn = noMfa.length + unused.length + clear.length + (http ? 1 : 0);
    return { refused, bans, unprotected, noMfa, admins, unused, clear, http, bad, warn, tone: bad ? 'bad' : warn ? 'warn' : 'good' };
  }

  _scWhen(ts) {
    return ts ? this._rel(new Date(ts * 1000).toISOString()) : this._t('never');
  }

  // A Security command (Ignore, Revoke): its button spins until the tab is read again; a failure next to the buttons
  async _scCall(busyKey, msg, done) {
    this._busy[busyKey] = true;
    this._render();
    try {
      await this._hass.callWS(msg);
      if (done) this._toast(this._t('done'));
      await this._scLoad(true);
    } catch (err) {
      this._messages.sc = { text: this._t('failed', { error: shErr(err) }), tone: 'bad' };
    }
    delete this._busy[busyKey];
    await this._load();
  }

  _scIgnore(ip, ignore) {
    return this._scCall(`sc_ignore:${ip}`, { type: 'system_hub/security_ignore', ip, ignore });
  }

  _scRevoke(token) {
    this._confirm = null;
    return this._scCall(`sc_revoke:${token}`, { type: 'system_hub/security_revoke', token_id: token }, true);
  }

  _scList(icon, title, count, rows, note) {
    return `<ha-card class="list"><div class="lhead"><ha-icon icon="${icon}"></ha-icon><span class="lname">${shEsc(title)}</span><span class="muted">${shEsc(count)}</span></div>${rows}${
      note ? `<div class="scnote">${note}</div>` : ''
    }</ha-card>`;
  }

  _scRow(icon, name, sub, tone = '', end = '') {
    return `<div class="item${tone ? ` ${tone}` : ''}"><ha-icon icon="${icon}"></ha-icon><div class="who"><div class="n">${name}</div><div class="s">${sub}</div></div>${end}</div>`;
  }

  // Security: refused logins, accounts, long-lived tokens (Revoke), exposure, add-ons and credentials in clear
  _security() {
    var d = this._sc?.data;
    if (!d) {
      if (this._sc?.error) {
        return `<ha-card class="note error" role="alert">${shEsc(this._t('failed', { error: this._sc.error }))}
          <button class="act" data-action="sc_scan"><ha-icon icon="mdi:refresh"></ha-icon>${shEsc(this._t('refresh'))}</button></ha-card>`;
      }
      if (!this._sc) this._scLoad();
      return `<ha-card class="note">${this._spinner(this._t('loading'))}</ha-card>`;
    }
    var sum = this._scSummary();
    var pill = (text, tone = '') => `<span class="pill${tone ? ` ${tone}` : ''}">${shEsc(text)}</span>`;
    var day = (d.refused || []).filter((r) => !r.ignored).reduce((n, r) => n + r.day, 0);
    var ex = d.exposure || {};
    var tiles = [
      this._tile('mdi:shield-alert-outline', `<b>${day}</b>`, this._t('sc_refused_day'), sum.refused.length || sum.bans.length ? 'bad' : day ? 'warn' : 'good'),
      this._tile('mdi:account-key-outline', shEsc(this._t('sc_n_of', { n: sum.noMfa.length, total: sum.admins.length })), this._t('sc_admins_no_mfa'), sum.noMfa.length ? 'warn' : 'good'),
      this._tile(
        'mdi:key-chain-variant',
        `<b>${(d.tokens || []).length}</b>${sum.unused.length ? ` · ${shEsc(this._t('sc_tokens_unused', { n: sum.unused.length }))}` : ''}`,
        this._t('sc_tokens'),
        sum.unused.length ? 'warn' : '',
      ),
      this._tile(
        'mdi:web',
        shEsc(ex.external_url ? (ex.https ? 'HTTPS' : 'HTTP') : '—'),
        ex.external_url ? ex.external_url.replace(/^https?:\/\//, '') : this._t('sc_no_external'),
        ex.external_url ? (ex.https ? 'good' : 'warn') : '',
      ),
    ];
    var actions = `<div class="actions">${this._message('sc')}<span class="grow"></span>
      <span class="scnote">${shEsc(this._t('sc_scanned', { when: this._scWhen(d.scanned_at) }))}</span>
      ${this._button('sc_scan', 'mdi:magnify-scan', this._t('sc_scan'), { quiet: true, busy: this._busy.sc_scan })}${this._configure()}</div>`;

    var banned = new Set((d.bans || []).map((b) => b.ip));
    var refused = (d.refused || [])
      .map((r) => {
        var tone = r.ignored ? '' : banned.has(r.ip) ? 'bad' : r.internet ? 'warn' : '';
        var sub = [r.host, this._t(r.internet ? 'sc_internet' : 'sc_local'), this._t('sc_attempts', { n: r.count }), this._t('sc_last', { when: this._scWhen(r.last) }), r.url].filter(Boolean);
        var end = banned.has(r.ip) ? pill(this._t('sc_banned'), 'bad') : r.ignored ? pill(this._t('sc_ignored')) : r.internet ? pill(this._t('sc_internet'), 'warn') : '';
        var button = this._button('sc_ignore', r.ignored ? 'mdi:eye-outline' : 'mdi:eye-off-outline', this._t(r.ignored ? 'sc_unignore' : 'sc_ignore'), {
          quiet: true,
          busy: this._busy[`sc_ignore:${r.ip}`],
          data: { ip: r.ip, ignore: String(!r.ignored) },
        });
        return this._scRow(r.internet ? 'mdi:shield-alert-outline' : 'mdi:lan', shEsc(r.ip), shEsc(sub.join(' · ')), tone, end + button);
      })
      .join('');
    var banNote = [ex.ip_ban ? this._t('sc_ban_on', { n: ex.login_threshold }) : this._t('sc_ban_off'), (d.bans || []).length ? this._t('sc_n_bans', { n: d.bans.length }) : ''].filter(Boolean).join(' ');
    var refusedCard = this._scList('mdi:login-variant', this._t('sc_refused'), this._t('sc_days7'), refused || this._scRow('mdi:check-circle-outline', '', shEsc(this._t('sc_none_refused'))), shEsc(banNote));

    var users = (d.users || [])
      .map((u) => {
        var role = this._t(u.owner ? 'sc_owner' : u.admin ? 'sc_admin' : 'sc_user');
        var sub = [role, u.local_only ? this._t('sc_local_only') : '', u.last_used ? this._t('sc_active_when', { when: this._scWhen(u.last_used) }) : this._t('sc_never_active'), this._t('sc_sessions', { n: u.sessions })].filter(Boolean);
        var warn = u.admin && u.active && !u.mfa;
        var end = !u.active ? pill(this._t('sc_disabled')) : u.mfa ? pill(this._t('sc_mfa'), 'good') : warn ? pill(this._t('sc_no_mfa'), 'warn') : u.local_only ? pill(this._t('sc_local_pill')) : '';
        var icon = !u.active ? 'mdi:account-off-outline' : warn ? 'mdi:account-alert-outline' : 'mdi:account-circle-outline';
        return this._scRow(icon, shEsc(u.name), shEsc(sub.join(' · ')), warn ? 'warn' : '', end);
      })
      .join('');

    var tokens = (d.tokens || [])
      .map((t) => {
        var used = t.last_used ? (t.last_ip ? this._t('sc_used_from', { when: this._scWhen(t.last_used), ip: t.last_ip }) : this._t('sc_used', { when: this._scWhen(t.last_used) })) : this._t('sc_never_used');
        var confirm = this._confirm === `sc_revoke:${t.id}`;
        var end = (t.unused ? pill(this._t('sc_unused'), 'warn') : '') + this._button('sc_revoke_confirm', 'mdi:delete-outline', this._t('sc_revoke'), {
          quiet: true,
          busy: this._busy[`sc_revoke:${t.id}`],
          data: { token: t.id },
        });
        var row = this._scRow(t.unused ? 'mdi:key-alert-outline' : 'mdi:key-outline', shEsc(t.name), shEsc([t.user, this._t('sc_created', { when: this._scWhen(t.created) }), used].join(' · ')), t.unused ? 'warn' : '', end);
        return confirm
          ? `${row}<div class="confirm" role="alertdialog">${shEsc(this._t('sc_revoke_confirm', { name: t.name }))}${this._button('sc_revoke', 'mdi:delete-outline', this._t('sc_revoke'), { danger: true, data: { token: t.id } })}${this._button('cancel', 'mdi:close', this._t('cancel'), { quiet: true })}</div>`
          : row;
      })
      .join('');

    var check = (ok, title, sub, tone) =>
      this._scRow(ok === null ? 'mdi:information-outline' : ok ? 'mdi:check-circle-outline' : 'mdi:alert-outline', shEsc(title), shEsc(sub), ok === false ? tone || 'warn' : '', pill(this._t(ok === null ? 'sc_info' : ok ? 'sc_ok' : 'sc_check'), ok === null ? 'info' : ok ? 'good' : tone || 'warn'));
    var exposure = [
      ex.external_url ? check(ex.https, this._t(ex.https ? 'sc_https_ok' : 'sc_https_no'), ex.external_url) : check(null, this._t('sc_no_external'), ex.cloud ? this._t('sc_cloud') : ''),
      check(ex.trusted_proxies?.length ? true : null, this._t(ex.trusted_proxies?.length ? 'sc_proxy' : 'sc_no_proxy'), (ex.trusted_proxies || []).join(', ')),
      check(ex.ip_ban, this._t('sc_ip_ban'), ex.ip_ban ? this._t('sc_on_n', { n: ex.login_threshold }) : this._t('sc_off')),
      check(null, this._t('sc_cloud'), this._t(ex.cloud ? 'sc_connected' : 'sc_not_connected')),
    ].join('');

    var addons = d.addons
      ? d.addons
          .filter((a) => !a.protected || a.full_access || a.host_network)
          .sort((a, b) => (a.protected || a.allowed) - (b.protected || b.allowed) || (a.rating ?? 9) - (b.rating ?? 9))
          .map((a) => {
            var risky = !a.protected && !a.allowed;
            var tone = risky ? 'bad' : a.full_access ? 'warn' : '';
            var sub = [
              !a.protected ? this._t('sc_protection_off') : '',
              a.full_access ? this._t('sc_full_access_s') : '',
              a.host_network ? this._t('sc_host_network_s') : '',
              a.rating != null ? this._t('sc_rating', { n: a.rating }) : '',
            ].filter(Boolean);
            var end = risky
              ? pill(this._t('sc_unprotected'), 'bad')
              : !a.protected
                ? pill(this._t('sc_allowed'), 'info')
                : a.full_access
                  ? pill(this._t('sc_full_access'), 'warn')
                  : pill(this._t('sc_host_network'), 'info');
            // Unprotected: allowed from here (saved at once), or no longer
            if (!a.protected) {
              end += this._button('sc_allow', a.allowed ? 'mdi:shield-off-outline' : 'mdi:shield-check-outline', this._t(a.allowed ? 'sc_disallow' : 'sc_allow'), {
                quiet: true,
                busy: this._busy[`sc_allow:${a.slug}`],
                data: { slug: a.slug, allow: String(!a.allowed) },
              });
            }
            return this._scRow(risky ? 'mdi:alert-circle-outline' : 'mdi:alert-outline', shEsc(a.name), shEsc(sub.join(' · ')), tone, end);
          })
          .join('')
      : '';
    var flagged = d.addons ? d.addons.filter((a) => !a.protected || a.full_access || a.host_network).length : 0;
    var addonsCard = d.addons ? this._scList('mdi:puzzle-outline', this._t('sc_addons'), this._t('sc_addons_ok', { total: d.addons.length, ok: d.addons.length - flagged }), addons) : '';

    var clear = (d.config || [])
      .map((c) => this._scRow('mdi:form-textbox-password', shEsc(this._t('sc_in_clear')), `<code>${shEsc(c.file)}</code> ${shEsc(this._t('sc_line', { n: c.line }))} · <code>${shEsc(c.key)}</code>`, 'warn', pill('!secret', 'warn')))
      .join('');
    var configCard = this._scList(
      'mdi:file-lock-outline',
      this._t('sc_config'),
      String((d.config || []).length),
      clear || this._scRow('mdi:check-circle-outline', '', shEsc(this._t('sc_config_none'))),
      clear ? shEsc(this._t('sc_config_note')) : '',
    );

    return `<div class="tiles">${tiles.join('')}</div>${actions}${refusedCard}
      ${this._scList('mdi:account-group-outline', this._t('sc_accounts'), String((d.users || []).length), users)}
      ${(d.tokens || []).length ? this._scList('mdi:key-chain-variant', this._t('sc_tokens'), String(d.tokens.length), tokens, shEsc(this._t('sc_tokens_note'))) : ''}
      <div class="sctwo">${this._scList('mdi:web', this._t('sc_exposure'), '', exposure)}${addonsCard}</div>${configCard}`;
  }

  // The updates outside the Marketplace: Home Assistant (Core, Supervisor, OS), the add-ons, the devices and services;
  // one card each, installed one at a time with Home Assistant's update.install, a backup first when chosen
  _sysUpdates(data) {
    var available = data.available || [];
    var backupDefault = Boolean(this._state.marketplace?.backup_before_install);
    var backup = this._updBackup ?? backupDefault;
    if (available.length) this._mkFetchNotes(available);
    var ok = data.up_to_date || {};
    var toggle = available.some((u) => u.backup)
      ? `<button class="act quiet" data-action="upd_backup" aria-pressed="${backup}"><ha-icon icon="mdi:checkbox-${backup ? 'marked' : 'blank-outline'}"></ha-icon>${shEsc(this._t('upd_backup'))}</button>`
      : '';
    // Every update of the tab: these and the Marketplace's
    var repos = (this._state.marketplace?.list || []).length;
    // Short on one line; the detail by kind in its tooltip
    var total = available.length + repos;
    var summary = [total ? this._t('upd_available', { n: total }) : '', this._t('upd_uptodate_short', { n: (ok.system ?? 0) + (ok.addon ?? 0) + (ok.device ?? 0) })].filter(Boolean);
    var detail = [
      total ? this._t('upd_available_detail', { n: total, system: available.length, marketplace: repos }) : '',
      this._t('upd_uptodate', { system: ok.system ?? 0, addons: ok.addon ?? 0, devices: ok.device ?? 0 }),
    ].filter(Boolean);
    // Update all: every update of the tab, the Marketplace's included, in the order of _updPlan
    var plan = this._updPlan();
    var running = Boolean(this._busy.upd_all);
    var all = plan.count
      ? this._button('upd_all_confirm', 'mdi:package-down', `${this._t('install_all')} (${plan.count})`, {
          busy: running,
          disabled: this._state.marketplace?.state === 'running' || this._state.marketplace?.installing_updates,
        })
      : '';
    var confirm =
      this._confirm === 'upd_all'
        ? `<div class="confirm" role="alertdialog">${shEsc(
            [this._t('upd_all_confirm', { n: plan.count }), plan.restarts ? this._t('upd_all_restart') : '', plan.osLater ? this._t('upd_all_os_later') : '']
              .filter(Boolean)
              .join(' '),
          )}
          ${this._button('upd_all', 'mdi:package-down', this._t('install_all'))}
          ${this._button('cancel', 'mdi:close', this._t('cancel'), { quiet: true })}</div>`
        : '';
    var head = `<div class="actions"><span class="s grow" title="${shEsc(detail.join('\n'))}">${shEsc(summary.join(' · '))}</span>${toggle}${all}</div>${confirm}${this._message('upd')}`;
    // One grid, in the order of the server (Core, Supervisor, OS, add-ons, devices); each card says what it is
    return `${head}${available.length ? `<h2 class="stsec">${shEsc(this._t('upd_heading'))}</h2><div class="mkgrid">${available.map((u) => this._mkCard(u, backup)).join('')}</div>` : ''}`;
  }

  // What an update outside the Marketplace is: Core, Supervisor, OS, an add-on, a device or service
  _updKind(kind) {
    return { core: this._t('core'), supervisor: this._t('supervisor'), os: 'OS', addon: this._t('addon'), device: this._t('upd_device') }[kind] || kind;
  }

  // Update all, one step after the other: the Marketplace repositories (System Hub's own install, waited for), the
  // add-ons, the devices and services, the Supervisor, then Home Assistant itself last as it restarts: Core, or OS when
  // Core is up to date (both would need two restarts, so OS is left for afterwards)
  _updPlan() {
    var available = this._state.system_updates?.available || [];
    var repos = (this._state.marketplace?.list || []).map((u) => u.entity_id);
    var of = (kind) => available.filter((u) => u.kind === kind);
    var core = of('core');
    var last = core.length ? core : of('os');
    var items = [...of('addon'), ...of('device'), ...of('supervisor'), ...last];
    return {
      repos,
      items,
      count: repos.length + items.length,
      restarts: last.length > 0,
      osLater: core.length > 0 && of('os').length > 0,
    };
  }

  async _updAll() {
    var plan = this._updPlan();
    var backup = this._updBackup ?? Boolean(this._state.marketplace?.backup_before_install);
    this._confirm = null;
    this._busy.upd_all = true;
    delete this._messages.upd;
    this._render();
    try {
      if (plan.repos.length) {
        await this._hass.callService(SH_DOMAIN, 'marketplace_install_updates', { entity_id: plan.repos, wait: true, backup });
      }
      for (var u of plan.items) {
        this._busy[`upd_install:${u.entity_id}`] = true;
        this._render();
        await this._hass.callService('update', 'install', { entity_id: u.entity_id, ...(backup && u.backup ? { backup: true } : {}) });
        delete this._busy[`upd_install:${u.entity_id}`];
      }
      this._toast(this._t('done'));
    } catch (err) {
      this._messages.upd = { text: this._t('failed', { error: shErr(err) }), tone: 'bad' };
    }
    for (var key of Object.keys(this._busy)) if (key.startsWith('upd_install:')) delete this._busy[key];
    delete this._busy.upd_all;
    await this._load();
    this._render();
  }

  // One update: its logo (else its initial), the versions and the size of the change, the start of its release notes.
  // A Marketplace repository is installed by System Hub (one at a time with the others); any other update by Home
  // Assistant's update.install, asked first (Home Assistant itself restarts), with a backup when `backup` and supported
  _mkCard(u, backup) {
    var change = shChange(u.installed, u.latest);
    var system = Boolean(u.kind);
    var busy = u.installing || this._busy[`${system ? 'upd' : 'mk'}_install:${u.entity_id}`];
    var restart = { core: 'upd_restart_core', supervisor: 'upd_restart_supervisor', os: 'upd_restart_os' }[u.kind];
    var install = system
      ? this._confirm === `upd:${u.entity_id}`
        ? `${this._button('upd_install', 'mdi:package-down', this._t('mk_install'), { data: { entity: u.entity_id, backup: backup && u.backup ? '1' : '' }, busy })}
           ${this._button('cancel', 'mdi:close', this._t('cancel'), { quiet: true })}`
        : this._button('upd_confirm', 'mdi:package-down', this._t('mk_install'), { data: { entity: u.entity_id }, busy })
      : this._button('mk_install', 'mdi:package-down', this._t('mk_install'), { data: { entity: u.entity_id }, busy, disabled: this._state.marketplace?.installing_updates });
    var notes = u.release_summary || this._mkNotes?.[`${u.entity_id}@${u.latest}`];
    // Without a picture, the project's icon when it is one of juju35's (the showcase site's badge), else the initial
    var project = shProject(u.release_url);
    var initial = project
      ? `<div class="mklogo mkproj" style="--logo:${shEsc(project.accent)}"><ha-icon icon="${shEsc(project.icon)}"></ha-icon></div>`
      : `<div class="mklogo" style="--logo:${shHue(u.title)}">${shEsc(String(u.title || '?').charAt(0).toUpperCase())}</div>`;
    // Without a picture, the logo of its integration (a device's firmware: ZHA, MQTT…), from Home Assistant's brands
    var brand = u.integration && /^[a-z0-9_]+$/.test(u.integration) ? `/api/brands/integration/${u.integration}/icon.png` : null;
    var picture = this._mkPicture(u.picture || brand);
    // A picture that doesn't load gives way to the project's icon or the initial
    var logo = picture ? `<span class="mklogos"><img class="mklogo" src="${shEsc(picture)}" alt="" loading="lazy" onerror="this.parentNode.classList.add('broken')">${initial}</span>` : initial;
    // Release notes on the web only (an integration's release_url could be any link)
    var link = /^https?:\/\//i.test(u.release_url || '')
      ? `<a class="act quiet" href="${shEsc(u.release_url)}" target="_blank" rel="noreferrer"><ha-icon icon="mdi:text-box-outline"></ha-icon>${shEsc(this._t('mk_notes'))}</a>`
      : `<button class="act quiet" data-more="${shEsc(u.entity_id)}"><ha-icon icon="mdi:text-box-outline"></ha-icon>${shEsc(this._t('mk_notes'))}</button>`;
    return `<ha-card class="mkcard link" data-more="${shEsc(u.entity_id)}">
      <div class="mktop">${logo}<div class="who"><div class="n">${shEsc(u.title)}</div><div class="s">${shEsc(system ? `${this._updKind(u.kind)} · ${u.entity_id}` : u.entity_id)}</div></div>
        ${change ? `<span class="pill ${change === 'major' ? 'bad' : change === 'minor' ? 'warn' : 'good'}">${shEsc(this._t(`mk_${change}`))}</span>` : ''}</div>
      <div class="mkver"><span class="muted">${shEsc(u.installed || '—')}</span><ha-icon icon="mdi:arrow-right"></ha-icon><b>${shEsc(u.latest || '—')}</b></div>
      ${typeof notes === 'string' && notes ? `<div class="s mknotes">${shEsc(notes)}</div>` : ''}
      ${restart ? `<div class="mkrestart"><ha-icon icon="mdi:restart"></ha-icon>${shEsc(this._t(restart))}</div>` : ''}
      ${this._confirm === `upd:${u.entity_id}` ? `<div class="s" role="alert">${shEsc(this._t('upd_confirm', { name: u.title, version: u.latest || '' }))}</div>` : ''}
      <div class="actions">${link}<span class="grow"></span>${install}</div></ha-card>`;
  }

  // A brand image of Home Assistant (/api/brands/…) needs its access token, read once (brands/access_token)
  _mkPicture(url) {
    if (!url) return null;
    if (!url.startsWith('/api/brands/')) return url;
    if (this._brandsToken === undefined && this._hass?.callWS) {
      this._brandsToken = null;
      this._hass
        .callWS({ type: 'brands/access_token' })
        .then((res) => {
          this._brandsToken = res?.token || '';
          if (this._tab === 'marketplace') this._render();
        })
        .catch(() => {
          this._brandsToken = '';
        });
    }
    if (!this._brandsToken) return this._brandsToken === '' ? url : null;
    return `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(this._brandsToken)}`;
  }

  // The release notes of each update, read once per version (Home Assistant's update/release_notes): their start
  _mkFetchNotes(list) {
    this._mkNotes ??= {};
    for (const u of list) {
      // One key per update: kept for its own answer
      const key = `${u.entity_id}@${u.latest}`;
      if (u.release_summary || key in this._mkNotes || !this._hass?.callWS) continue;
      this._mkNotes[key] = null;
      this._hass
        .callWS({ type: 'update/release_notes', entity_id: u.entity_id })
        .then((text) => {
          // No notes (null) for many devices: nothing shown
          this._mkNotes[key] = typeof text === 'string' ? shExcerpt(text) : '';
          if (this._tab === 'marketplace') this._render();
        })
        .catch(() => {});
    }
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
    // The search: name, room or type
    var query = (this._draft.batt_search || '').trim().toLowerCase();
    if (query) list = list.filter((b) => [b.name, b.area, b.battery_type].some((v) => String(v || '').toLowerCase().includes(query)));
    var tiles = [
      this._tile('mdi:battery-alert-variant-outline', `<b>${data.low ?? 0}</b>`, this._t('low'), data.low ? 'warn' : 'good'),
      this._tile('mdi:battery-unknown', `<b>${data.unavailable ?? 0}</b>`, this._t('unavailable'), data.unavailable ? 'bad' : 'good'),
      this._tile('mdi:bell-check-outline', shEsc(this._rel(data.last_notification)), this._entityName('sensor', 'batteries_last_notification'), ''),
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
      : query
        ? `<div class="empty">${shEsc(this._t('no_match'))}</div>`
        : `<div class="empty good"><ha-icon icon="mdi:battery-check-outline"></ha-icon>${shEsc(this._t('all_good', { threshold: data.threshold ?? '' }))}</div>`;
    var buy = this._battToReplace(all);
    var next = this._battNext(all);
    return `<div class="tiles">${tiles.join('')}</div>
      <ha-card class="bsheet">
        <div class="btop">
          <div class="btabs" role="group">${views}</div>
          <div class="bline"><span class="rlabel"><ha-icon icon="mdi:cart-outline"></ha-icon>${shEsc(this._t('to_replace'))}</span>${buy || `<span class="none">${shEsc(this._t('nothing_to_replace'))}</span>`}</div>
          ${next}
          ${this._battSpares(data.spares || {})}
          <span class="grow"></span>
          <label class="box bsearch"><ha-icon icon="mdi:magnify"></ha-icon><input data-draft="batt_search" placeholder="${shEsc(this._t('search_batteries'))}" value="${shEsc(this._draft.batt_search || '')}"></label>
          ${this._button('batt_csv', 'mdi:file-delimited-outline', this._t('export_csv'), { quiet: true })}
          ${this._button('batteries_notify', 'mdi:bell-ring-outline', this._entityName('button', 'batteries_notify_now'), { quiet: true })}${this._message('batteries_notify')}
        </div>
        ${this._stockForm ? this._battStockForm() : ''}
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

  // The spare batteries counted by type: in stock, and how many to buy for the batteries low or due within 30 days
  _battSpares(spares) {
    var chips = Object.entries(spares)
      .map(([kind, s]) => {
        var buy = s.short ? ` · ${this._t('to_buy', { n: s.short })}` : '';
        return `<button class="spare${s.short ? ' short' : ''}" data-action="stock_edit" data-kind="${shEsc(kind)}"><b>${s.stock}×</b> ${shEsc(this._battTypeName(kind))}${shEsc(buy)}</button>`;
      })
      .join('');
    return `<div class="bline"><span class="rlabel"><ha-icon icon="mdi:archive-outline"></ha-icon>${shEsc(this._t('spares'))}</span>${chips}
      <button class="spare add" data-action="stock_edit" data-kind="" title="${shEsc(this._t('set_stock'))}" aria-label="${shEsc(this._t('set_stock'))}"><ha-icon icon="mdi:plus"></ha-icon></button>${this._message('batteries_set_stock')}</div>`;
  }

  // Set the spare batteries of a type (0 keeps counting it, empty stops counting it)
  _battStockForm() {
    return `<div class="stockform"><label class="box"><input data-draft="stock_type" placeholder="${shEsc(this._t('stock_type'))}" value="${shEsc(this._draft.stock_type || '')}"></label>
      <label class="box count"><input data-draft="stock_count" type="number" min="0" max="999" placeholder="${shEsc(this._t('stock_count'))}" value="${shEsc(this._draft.stock_count ?? '')}"></label>
      ${this._button('set_stock', 'mdi:content-save-outline', this._t('save'))}${this._button('stock_cancel', 'mdi:close', this._t('cancel'), { quiet: true })}</div>`;
  }

  // Every battery as a CSV file, downloaded by the browser (as the Battery Monitor card)
  _battCsv() {
    var cell = (v) => {
      var text = String(v ?? '');
      return /[",;\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    var head = ['name', 'area', 'type', 'level', 'status', 'drain_per_day', 'days_left', 'replace_by', 'below_since', 'entity_id'];
    var rows = (this._state.batteries?.batteries || []).map((b) => [
      b.name,
      b.area || '',
      b.battery_type || '',
      b.level ?? '',
      b.unavailable ? 'unavailable' : b.low ? 'low' : 'ok',
      b.drain_per_day ?? '',
      b.days_left ?? '',
      b.replace_by ? String(b.replace_by).slice(0, 10) : '',
      b.below_since || '',
      b.entity_id,
    ]);
    return [head, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
  }

  _battDownload() {
    var blob = new Blob([`\ufeff${this._battCsv()}\r\n`], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = `batteries-${new Date().toISOString().slice(0, 10)}.csv`;
    this.shadowRoot.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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

  // Git Sync: every repository (the first one first), and the one the tab shows (a chip per repository)
  _gitRepos() {
    return this._state.git_sync_repos || [];
  }

  _gitData() {
    var repos = this._gitRepos();
    return repos.find((r) => r.id === this._gitRepo) || repos[0] || this._state.git_sync;
  }

  // The repository the tab's actions run on: named only when there are several
  _gitTarget() {
    var repos = this._gitRepos();
    return repos.length > 1 ? { repository: this._gitData().path } : {};
  }

  // Git Sync: status, changed files, commit and push
  _gitSync() {
    var data = this._gitData();
    if (!data) return `<ha-card class="note">${shEsc(this._t('git_needs_repo'))}</ha-card>`;
    var repos = this._gitRepos();
    var picker =
      repos.length > 1
        ? `<div class="segs gitrepos" role="group" aria-label="${shEsc(this._entityName('sensor', 'git_sync_status'))}">${repos
            .map((r) => {
              var on = r.id === data.id;
              return `<button class="seg${on ? ' active' : ''}" data-action="git_repo" data-id="${shEsc(r.id)}" aria-pressed="${on}" title="${shEsc(r.path)}">${shEsc(r.title)}</button>`;
            })
            .join('')}</div>`
        : '';
    var tone = { clean: 'good', dirty: 'warn', ahead: 'warn', behind: 'warn', diverged: 'bad', error: 'bad' }[data.status] || '';
    var commit = data.last_commit;
    var tiles = [
      this._tile('mdi:source-branch', `<b>${shEsc(data.branch || '—')}</b>`, this._l(`component.${SH_DOMAIN}.entity.sensor.git_sync_status.state.${data.status}`) || data.status, tone),
      this._tile('mdi:file-document-edit-outline', `<b>${data.changed ?? 0}</b>`, this._entityName('sensor', 'git_sync_changed_files'), data.changed ? 'warn' : 'good'),
      this._tile('mdi:source-commit', shEsc(commit ? this._rel(new Date(commit.timestamp * 1000).toISOString()) : this._t('never')), commit ? commit.message : this._entityName('sensor', 'git_sync_last_commit'), ''),
      this._tile('mdi:cloud-check-outline', shEsc(this._rel(data.last_push)), this._entityName('sensor', 'git_sync_last_push'), ''),
    ];
    var sync = [data.ahead ? this._t('ahead', { n: data.ahead }) : '', data.behind ? this._t('behind', { n: data.behind }) : ''].filter(Boolean).join(' · ');
    // The changed files: their count always; folded beyond SH_GIT_FILES_MAX until opened
    var list = data.files || [];
    var count = Math.max(data.changed ?? 0, list.length);
    var open = this._gitFilesOpen ?? count <= SH_GIT_FILES_MAX;
    var files = list
      .map((f) => `<div class="item"><ha-icon icon="mdi:file-outline"></ha-icon><div class="who"><div class="n"><code>${shEsc(f)}</code></div></div></div>`)
      .join('');
    var fold = count
      ? `<button class="icon-btn" data-action="git_files_fold" aria-expanded="${open}" title="${shEsc(this._t('changed'))}" aria-label="${shEsc(this._t('changed'))}"><ha-icon icon="mdi:chevron-${open ? 'up' : 'down'}"></ha-icon></button>`
      : '';
    return `${picker}<div class="tiles">${tiles.join('')}</div>
      <ha-card class="block"><div class="actions"><label class="box"><input data-draft="message" placeholder="${shEsc(this._t('message'))}" value="${shEsc(this._draft.message || '')}"></label>
        ${data.ai_task ? this._button('git_sync_generate_message', 'mdi:creation-outline', this._t('generate'), { quiet: true }) : ''}</div>
        <div class="actions">${this._button('git_sync_commit_push', 'mdi:source-commit-end', this._entityName('button', 'git_sync_commit_push'))}
        ${this._button('git_sync_diff', 'mdi:file-compare', this._t('diff'), { quiet: true, disabled: !data.changed && !data.ahead })}
        ${this._button('git_sync_pull', 'mdi:source-pull', this._serviceName('git_sync_pull'), { quiet: true })}
        ${this._button('git_sync_export_dashboards', 'mdi:export', this._entityName('button', 'git_sync_export_dashboards'), { quiet: true })}
        ${sync ? `<span class="pill warn">${shEsc(sync)}</span>` : ''}${this._message('git_sync')}${this._configure()}</div>
        ${data.last_error ? `<span class="msg bad">${shEsc(data.last_error)}</span>` : ''}
        ${data.remote_url ? `<span class="msg"><code>${shEsc(data.remote_url)}</code></span>` : ''}</ha-card>
      <ha-card class="list"><div class="lhead"><ha-icon icon="mdi:file-multiple-outline"></ha-icon><span class="lname">${shEsc(this._t('changed'))}</span>
        <span class="muted">${count}</span>${fold}</div>
      ${count ? (open ? files : '') : `<div class="empty good"><ha-icon icon="mdi:check-circle-outline"></ha-icon>${shEsc(this._t('clean'))}</div>`}</ha-card>`;
  }

  // Settings: the modules turned on, and the order of the tabs
  _settings() {
    var modules = this._draft.modules || this._state.modules || [];
    var changed = Boolean(this._draft.modules || this._draft.tabs);
    return `${this._settingsModules(modules)}
      ${
        changed || this._busy.save
          ? `<div class="savebar" role="region" aria-label="${shEsc(this._t('unsaved'))}"><span class="grow">${shEsc(this._t('unsaved'))}</span>
          ${this._button('discard', 'mdi:undo', this._t('discard'), { quiet: true, disabled: this._busy.save })}
          ${this._button('save', 'mdi:content-save-outline', this._t('save'))}</div>`
          : ''
      }
      <div class="actions">${this._message('save')}</div>`;
  }

  _onClick(ev) {
    if (this._orphClick(ev)) return;
    // A link inside Home Assistant: its own navigation, without reloading the page
    var nav = ev.target.closest?.('[data-nav]');
    if (nav && !ev.ctrlKey && !ev.metaKey && !ev.shiftKey && ev.button !== 1) {
      ev.preventDefault?.();
      history.pushState(null, '', nav.dataset.nav);
      window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: false } }));
      return;
    }
    // A row or a button that opens its entity's dialog; a button or a link inside such a row does its own thing
    var more = ev.target.closest?.('[data-more]');
    var control = ev.target.closest?.('button, a, input, select');
    if (more && (!control || control.hasAttribute('data-more'))) {
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
    if ((action.startsWith('cfg_') || action.startsWith('open_settings')) && this._cfgClick(button)) return;
    if (action === 'reload') return this._load();
    if (action === 'cancel' || action === 'confirm_install') {
      this._haCheck = null;
      this._confirm = action === 'confirm_install' ? 'install' : null;
      return this._render();
    }
    if (action === 'period') {
      this._periods[button.dataset.chart] = Number(button.dataset.hours);
      return this._render();
    }
    if (action === 'batt_csv') return this._battDownload();
    if (action === 'st_open') return this._goTab(button.dataset.tab);
    if (action === 'git_files_fold') {
      var shown = this._gitData() || {};
      var shownNow = this._gitFilesOpen ?? Math.max(shown.changed ?? 0, (shown.files || []).length) <= SH_GIT_FILES_MAX;
      this._gitFilesOpen = !shownNow;
      return this._render();
    }
    if (action === 'stock_edit' || action === 'stock_cancel') {
      this._stockForm = action === 'stock_edit';
      if (this._stockForm) {
        var kind = button.dataset.kind || '';
        this._draft.stock_type = kind;
        this._draft.stock_count = kind ? String(this._state.batteries?.spares?.[kind]?.stock ?? '') : '';
      }
      return this._render();
    }
    if (action === 'set_stock') {
      var type = (this._draft.stock_type || '').trim();
      if (!type) return;
      var count = String(this._draft.stock_count ?? '').trim();
      var data = { battery_type: type };
      if (count !== '') data.count = Math.max(0, Math.round(Number(count)));
      return this._run(
        'batteries_set_stock',
        'batteries_set_stock',
        data,
        () => {
          this._stockForm = false;
        },
        SH_DOMAIN,
        action,
      );
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
    if (action === 'discard') {
      this._draft.modules = null;
      this._draft.tabs = null;
      return this._render();
    }
    if (action.startsWith('auto_')) return this._autoAction(action, button);
    if (action.startsWith('ha_ask:') || action.startsWith('ha_ok:')) return this._haAction(action);
    if (action.startsWith('watchdog_reset:')) return this._run('watchdog_reset', 'watchdog_reset', { entry_id: action.split(':')[1] }, null, SH_DOMAIN, action);
    if (action === 'git_sync_generate_message') return this._generate();
    if (action === 'git_sync_diff') return this._openDiff();
    if (action === 'git_repo') {
      this._gitRepo = button.dataset.id;
      return this._render();
    }
    if (action === 'git_sync_commit_push') {
      var message = (this._draft.message || '').trim();
      return this._run(action, 'git_sync', { ...(message ? { message } : {}), ...this._gitTarget() }, () => {
        this._draft.message = '';
      });
    }
    if (action === 'git_sync_pull' || action === 'git_sync_export_dashboards') return this._run(action, 'git_sync', this._gitTarget(), null, SH_DOMAIN, action);
    if (action === 'lg_level' || action === 'lg_period') {
      this[action === 'lg_level' ? '_lgLevel' : '_lgPeriod'] = button.dataset.value;
      return this._render();
    }
    if (action === 'lg_ignore') return this._lgIgnore(button.dataset.key);
    if (action === 'lg_reload') return this._lgReload(button.dataset.domain);
    if (action === 'lg_clear_confirm') {
      this._confirm = 'lg_clear';
      return this._render();
    }
    if (action === 'lg_clear') {
      this._confirm = null;
      return this._run('clear', 'lg', {}, () => this._lgLoad(true), 'system_log', 'lg_clear');
    }
    if (action === 'sl_filter') {
      this._slFilter = button.dataset.kind || null;
      return this._render();
    }
    if (action === 'sl_ignore') return this._slIgnore(button.dataset.device, button.dataset.name);
    if (action === 'sc_scan') return this._scLoad(true, true);
    if (action === 'sc_ignore') return this._scIgnore(button.dataset.ip, button.dataset.ignore !== 'false');
    if (action === 'sc_revoke_confirm') {
      this._confirm = `sc_revoke:${button.dataset.token}`;
      return this._render();
    }
    if (action === 'sc_revoke') return this._scRevoke(button.dataset.token);
    if (action === 'sc_allow') {
      var allow = button.dataset.allow !== 'false';
      return this._scCall(`sc_allow:${button.dataset.slug}`, { type: 'system_hub/security_allow_addon', slug: button.dataset.slug, allow });
    }
    if (action === 'db_pick') {
      var picked = (this._dbSel ??= new Set());
      if (picked.has(button.dataset.entity)) picked.delete(button.dataset.entity);
      else picked.add(button.dataset.entity);
      if (this._confirm === 'db_purge') this._confirm = null;
      return this._render();
    }
    if (action === 'db_refresh') return this._dbLoad(true, true);
    if (action === 'db_copy') return this._dbCopy();
    if (action === 'db_purge_confirm' || action === 'db_repack_confirm') {
      this._confirm = action.replace('_confirm', '');
      return this._render();
    }
    if (action === 'db_purge') {
      this._confirm = null;
      var entities = [...(this._dbSel || [])];
      this._dbSel = new Set();
      return this._run('purge_entities', 'db', { entity_id: entities, keep_days: 0 }, () => this._dbLoad(true, true), 'recorder', 'db_purge');
    }
    if (action === 'db_repack') {
      this._confirm = null;
      return this._run('purge', 'db', { keep_days: this._db?.data?.keep_days ?? 10, repack: true }, () => this._dbLoad(true, true), 'recorder', 'db_repack');
    }
    if (action === 'bk_now') return this._run('create_automatic', 'bk', {}, () => this._bkLoad(true), 'backup', 'bk_now');
    if (action === 'upd_backup') {
      this._updBackup = !(this._updBackup ?? Boolean(this._state.marketplace?.backup_before_install));
      return this._render();
    }
    if (action === 'upd_all_confirm') {
      this._confirm = 'upd_all';
      return this._render();
    }
    if (action === 'upd_all') return this._updAll();
    if (action === 'upd_confirm') {
      this._confirm = `upd:${button.dataset.entity}`;
      return this._render();
    }
    if (action === 'upd_install') {
      var entity = button.dataset.entity;
      this._confirm = null;
      return this._run('install', 'upd', { entity_id: entity, ...(button.dataset.backup ? { backup: true } : {}) }, null, 'update', `upd_install:${entity}`);
    }
    if (action === 'mk_install') {
      var target = button.dataset.entity;
      return this._run('marketplace_install_updates', 'marketplace_install_updates', { entity_id: [target] }, null, SH_DOMAIN, `mk_install:${target}`);
    }
        if (action === 'marketplace_install_updates') {
      this._confirm = null;
      return this._run(action, action, {});
    }
    return this._run(action, action, {});
  }

  // An action: its button spins (busyKey, the clicked button's action) until the state is read again; done in a toast, a
  // failure next to the buttons
  // A list of data calls the action once per item, one after the other (an action that takes a single target).
  async _run(service, messageKey, data, done, domain = SH_DOMAIN, busyKey = service) {
    this._busy[busyKey] = true;
    delete this._messages[messageKey];
    this._render();
    try {
      for (var item of Array.isArray(data) ? data : [data]) await this._hass.callService(domain, service, item);
      this._toast(this._t('done'));
      done?.();
    } catch (err) {
      this._messages[messageKey] = { text: this._t('failed', { error: shErr(err) }), tone: 'bad' };
    }
    await this._load();
    delete this._busy[busyKey];
    this._render();
  }

  // Automations: what Automation Monitor reports (its sensors, read on the server), as in the Automation Monitor card
  _automations() {
    var data = this._state.automations || {};
    if (!data.available) {
      return `<ha-card class="note">${shEsc(this._t('auto_not_found'))}
        <a class="act" href="/config/integrations/dashboard/add?domain=automation_monitor"><ha-icon icon="mdi:plus"></ha-icon>Automation Monitor</a></ha-card>`;
    }
    var failures = data.failures || [];
    var linked = data.linked || [];
    var count = (n, na) => (na ? '<b>—</b>' : `<b>${n}</b>`);
    var tone = (n, na, bad) => (na ? '' : n ? bad : 'good');
    var naTitle = this._t('auto_sensor_unavailable');
    var tiles = [
      this._tile('mdi:robot-confused-outline', count(failures.length, data.failed_na), this._t('auto_failed'), tone(failures.length, data.failed_na, 'bad'), {
        entity: data.failed_entity,
        title: data.failed_na ? naTitle : '',
      }),
      this._tile('mdi:link-variant-off', count(linked.length, data.linked_na), this._t('auto_linked'), tone(linked.length, data.linked_na, 'warn'), {
        entity: data.linked_entity,
        title: data.linked_na ? naTitle : '',
      }),
      this._tile('mdi:clock-alert-outline', shEsc(failures.length ? this._rel(failures[0].last_error_time) : '—'), this._t('auto_last_failure'), ''),
      this._tile('mdi:robot-outline', `<b>${data.automations ?? 0}</b>`, SH_MODULE_NAMES.automations, ''),
    ];
    var confirm = '';
    if (this._confirm === 'auto_clear_all' || this._confirm?.startsWith?.('auto_clear:')) {
      var all = this._confirm === 'auto_clear_all';
      var entity = all ? '' : this._confirm.slice('auto_clear:'.length);
      var name = failures.find((f) => f.entity_id === entity)?.name || entity;
      confirm = `<div class="confirm" role="alertdialog">${shEsc(all ? this._t('auto_confirm_clear_all') : this._t('auto_confirm_clear', { name }))}
        ${this._button(all ? 'auto_clear_all_ok' : 'auto_clear_ok', 'mdi:notification-clear-all', this._t(all ? 'auto_clear_all' : 'auto_clear'), { data: { entity }, danger: true })}
        ${this._button('cancel', 'mdi:close', this._t('cancel'), { quiet: true })}</div>`;
    }
    var both = data.failed_na && data.linked_na;
    return `<div class="tiles">${tiles.join('')}</div>${confirm}
      <div class="actions"><span title="${shEsc(this._t('auto_rebuild_title'))}">${this._button('auto_rebuild', 'mdi:refresh', this._t('auto_rebuild'))}</span>
      ${failures.length ? this._button('auto_clear_all', 'mdi:notification-clear-all', this._t('auto_clear_all'), { quiet: true, busy: this._busy.auto_clear_all }) : ''}
      ${this._message('auto')}${both ? `<span class="msg bad">${shEsc(this._t('auto_unavailable'))}</span>` : ''}${this._configure()}</div>
      ${this._autoSection('failed', 'mdi:robot-confused-outline', this._t('auto_failed'), failures, (f) => this._autoFailure(f))}
      ${this._autoSection('linked', 'mdi:link-variant-off', this._t('auto_linked'), linked, (e) => this._autoLinked(e))}`;
  }

  // A list that folds from its title, cut to SH_AUTO_MAX items with "Show more"
  _autoSection(key, icon, label, items, row) {
    this._autoFolds = this._autoFolds || {};
    this._autoMore = this._autoMore || {};
    var open = !this._autoFolds[key];
    var all = this._autoMore[key];
    var shown = open ? (all ? items : items.slice(0, SH_AUTO_MAX)) : [];
    var more =
      open && items.length > SH_AUTO_MAX
        ? `<div class="actions more-row">${this._button(`auto_more:${key}`, all ? 'mdi:chevron-up' : 'mdi:chevron-down', all ? this._t('auto_show_less') : this._t('auto_show_more', { n: items.length - SH_AUTO_MAX }), { quiet: true })}</div>`
        : '';
    var empty = `<div class="empty good"><ha-icon icon="mdi:check-circle-outline"></ha-icon>${shEsc(this._t('auto_all_ok'))}</div>`;
    return `<ha-card class="list"><div class="lhead"><ha-icon icon="${icon}"></ha-icon><span class="lname">${shEsc(label)}</span>
        <span class="muted">${shown.length}/${items.length}</span>
        <button class="icon-btn" data-action="auto_fold:${key}" aria-expanded="${open}" title="${shEsc(label)}" aria-label="${shEsc(label)}"><ha-icon icon="${open ? 'mdi:chevron-up' : 'mdi:chevron-down'}"></ha-icon></button></div>
      ${open ? (items.length ? shown.map(row).join('') + more : empty) : ''}</ha-card>`;
  }

  _autoFailure(f) {
    var tags = [
      f.error_step ? `<span class="pill" title="${shEsc(this._t('auto_step'))}">${shEsc(f.error_step)}</span>` : '',
      f.consecutive_failures > 1 ? `<span class="pill bad">${shEsc(this._t('auto_streak', { n: f.consecutive_failures }))}</span>` : '',
    ].join('');
    var links = [
      f.trace ? `<a class="act quiet" href="${shEsc(f.trace)}"><ha-icon icon="mdi:chart-timeline-variant"></ha-icon>${shEsc(this._t('auto_trace'))}</a>` : '',
      f.edit ? `<a class="act quiet" href="${shEsc(f.edit)}"><ha-icon icon="mdi:pencil"></ha-icon>${shEsc(this._t('auto_edit'))}</a>` : '',
      this._button('auto_clear', 'mdi:restore', this._t('auto_clear'), { quiet: true, data: { entity: f.entity_id }, busy: this._busy[`auto_clear:${f.entity_id}`] }),
    ].join('');
    return `<div class="item bad link" data-more="${shEsc(f.entity_id)}"><ha-icon icon="mdi:robot-confused-outline"></ha-icon>
      <div class="who"><div class="n">${shEsc(f.name)}</div><div class="s">${shEsc(f.entity_id)}</div>
        ${f.error_message ? `<div class="s wrap"><code>${shEsc(f.error_message)}</code></div>` : ''}
        ${tags ? `<div class="s wrap">${tags}</div>` : ''}
        <div class="actions">${links}</div></div>
      <div class="side muted">${shEsc(this._rel(f.last_error_time))}</div></div>`;
  }

  _autoLinked(e) {
    var used = (e.used_by || [])
      .map((u) =>
        u.edit
          ? `<a class="pill" href="${shEsc(u.edit)}" title="${shEsc(u.entity_id)}">${shEsc(u.name)}</a>`
          : `<span class="pill" title="${shEsc(u.entity_id)}">${shEsc(u.name)}</span>`,
      )
      .join(' ');
    return `<div class="item warn link" data-more="${shEsc(e.entity_id)}"><ha-icon icon="mdi:link-variant-off"></ha-icon>
      <div class="who"><div class="n">${shEsc(e.name)}</div><div class="s">${shEsc(e.entity_id)} · ${shEsc(this._t('unavailable_since', { date: this._ago(e.unavailable_since) }))}</div>
        ${used ? `<div class="s wrap">${shEsc(this._t('auto_used_by'))} ${used}</div>` : ''}</div></div>`;
  }

  // The Automations tab's buttons: Automation Monitor's own actions (Clear asks first), the folds and "Show more"
  _autoAction(action, button) {
    var [name, key] = action.split(':');
    if (name === 'auto_fold') {
      this._autoFolds = { ...this._autoFolds, [key]: !this._autoFolds?.[key] };
      return this._render();
    }
    if (name === 'auto_more') {
      this._autoMore = { ...this._autoMore, [key]: !this._autoMore?.[key] };
      return this._render();
    }
    if (name === 'auto_clear' || name === 'auto_clear_all') {
      this._confirm = name === 'auto_clear_all' ? name : `auto_clear:${button.dataset.entity}`;
      return this._render();
    }
    this._confirm = null;
    if (name === 'auto_clear_ok') return this._run('reset', 'auto', { entity_id: button.dataset.entity }, null, 'automation_monitor', `auto_clear:${button.dataset.entity}`);
    if (name === 'auto_clear_all_ok') {
      // Failures left out by the settings stay: then only the listed ones are cleared, one call each (the action takes a
      // single entity_id); otherwise one call clears them all.
      var auto = this._state.automations || {};
      if (!auto.failures_hidden) return this._run('reset', 'auto', {}, null, 'automation_monitor', 'auto_clear_all');
      return this._run('reset', 'auto', (auto.failures || []).map((f) => ({ entity_id: f.entity_id })), null, 'automation_monitor', 'auto_clear_all');
    }
    if (name === 'auto_rebuild') return this._run('rebuild_linked_entities', 'auto', {}, null, 'automation_monitor', 'auto_rebuild');
  }

  // The changes a commit would include, in the full screen diff viewer
  _openDiff() {
    if (!this._diffDialog) {
      this._diffDialog = document.createElement('system-hub-diff-dialog');
      document.body?.appendChild?.(this._diffDialog);
    }
    var state = this._gitData() || {};
    var target = this._gitTarget();
    this._diffDialog.open({
      t: (key, vars) => this._t(key, vars),
      locale: this._hass?.locale?.language || this._hass?.language || undefined,
      branch: state.branch,
      commitLabel: this._entityName('button', 'git_sync_commit_push'),
      request: async () =>
        (await this._hass.callWS({ type: 'call_service', domain: SH_DOMAIN, service: 'git_sync_get_diff', service_data: target, return_response: true }))?.response,
      onCommit: () => this.shadowRoot.querySelector('[data-draft="message"]')?.focus?.({ preventScroll: true }),
    });
  }


  async _generate() {
    var service = 'git_sync_generate_message';
    this._busy[service] = true;
    this._render();
    try {
      var res = await this._hass.callWS({ type: 'call_service', domain: SH_DOMAIN, service, service_data: this._gitTarget(), return_response: true });
      var message = res?.response?.message;
      if (message) this._draft.message = message;
      else this._messages.git_sync = { text: this._t('clean'), tone: '' };
    } catch (err) {
      this._messages.git_sync = { text: this._t('failed', { error: shErr(err) }), tone: 'bad' };
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
    delete this._messages.save;
    try {
      await this._hass.callWS(msg);
      // The entry reloads with the new modules: the button spins until they are read
      await new Promise((resolve) => setTimeout(resolve, 1500));
      this._draft.modules = null;
      this._draft.tabs = null;
      await this._load();
      this._toast(this._t('saved'));
    } catch (err) {
      if (err?.code === 'git_sync_needs_repository') {
        // Its repository first, checked by the flow: the Modules form, with the modules chosen, then the repository
        var chosen = this._draft.modules || [];
        this._draft.modules = null;
        delete this._busy.save;
        this._messages.save = { text: this._t('git_needs_repo'), tone: 'bad' };
        await this._cfgOpen('git_sync', 'modules');
        if (this._cfg?.step === 'modules') {
          for (var m of Object.keys(SH_MODULE_NAMES)) if (m in this._cfg.data) this._cfg.data[m] = chosen.includes(m);
          this._cfg.haForm = null;
          this._render();
        }
        return;
      }
      this._messages.save = { text: this._t('failed', { error: shErr(err) }), tone: 'bad' };
    }
    delete this._busy.save;
    this._render();
  }
}

// Orphans tab (Orphans module): the entities their integration no longer provides and the orphan devices. Counters by
// reason, search and filters, selection one by one or of every match, Remove and Ignore in bulk once confirmed, and
// what still uses each orphan. The whole list comes from system_hub/orphans (the sensor's attributes are capped).
var SH_ORPH_REASONS = ['entry_removed', 'integration_missing', 'not_provided', 'unavailable', 'unknown'];
var SH_ORPH_ICONS = {
  entry_removed: 'mdi:puzzle-remove-outline',
  integration_missing: 'mdi:puzzle-remove-outline',
  not_provided: 'mdi:ghost-outline',
  unavailable: 'mdi:lan-disconnect',
  unknown: 'mdi:help-circle-outline',
};
var SH_ORPH_REF_ICONS = {
  automation: 'mdi:robot-outline',
  script: 'mdi:script-text-outline',
  scene: 'mdi:palette-outline',
  group: 'mdi:google-circles-communities',
  dashboard: 'mdi:view-dashboard-outline',
};
// Rows shown before "Show all"
var SH_ORPH_ROWS = 100;

// No longer provided: red; still provided but stale: orange
function shOrphTone(reason) {
  return reason === 'unavailable' || reason === 'unknown' ? 'warn' : 'bad';
}

// The orphans matching every search word (name, entity ID, integration, device, config entry), integration and reason
function shOrphFilter(items, filters = {}, names = {}) {
  var words = String(filters.q || '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  return (items || []).filter((i) => {
    if (filters.platform && i.platform !== filters.platform) return false;
    if (filters.reason && i.reason !== filters.reason) return false;
    var hay = [i.name, i.entity_id, i.platform, names[i.platform], i.device, i.entry_title].filter(Boolean).join(' ').toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

var SH_ORPHANS_METHODS = {
  _orph() {
    this._orphState ??= { data: null, error: null, loading: false, sel: new Set(), dsel: new Set(), all: false, confirm: null };
    return this._orphState;
  },

  async _orphLoad() {
    var o = this._orph();
    if (o.loading || !this._hass) return;
    o.loading = true;
    try {
      o.data = await this._hass.callWS({ type: 'system_hub/orphans' });
      o.error = null;
      // Only what is still listed stays selected
      var ids = new Set((o.data.entities || []).map((e) => e.entity_id));
      var devices = new Set((o.data.devices || []).map((d) => d.device_id));
      o.sel = new Set([...o.sel].filter((id) => ids.has(id)));
      o.dsel = new Set([...o.dsel].filter((id) => devices.has(id)));
    } catch (err) {
      o.error = shErr(err);
    }
    o.loading = false;
  },

  // "{n} entity" / "{n} entities": the key's _one or _many string
  _orphN(key, n) {
    return this._t(`${key}_${n === 1 ? 'one' : 'many'}`, { n });
  },

  _orphFilters() {
    return { q: this._draft.orph_q || '', platform: this._draft.orph_platform || '', reason: this._draft.orph_reason || '' };
  },

  // "for 3 d": "< 1 h" the first hour, hours up to two days, days beyond
  _orphFor(iso) {
    var t = new Date(iso).getTime();
    if (!iso || !Number.isFinite(t)) return '';
    var h = Math.max(0, (Date.now() - t) / 3600000);
    var d = h < 1 ? this._t('hours', { n: '< 1' }) : h < 48 ? this._t('hours', { n: Math.floor(h) }) : this._t('days', { n: Math.floor(h / 24) });
    return this._t('orph_for', { d });
  },

  // What still uses an orphan: automations, scripts, scenes, groups and dashboards, each a link to its editor
  _orphUses(refs) {
    if (!refs?.length) return '';
    var chips = refs
      .map((r) => {
        var inner = `<ha-icon icon="${SH_ORPH_REF_ICONS[r.type] || 'mdi:link-variant'}"></ha-icon>${shEsc(r.name)}`;
        var title = shEsc(this._t(`orph_ref_${r.type}`));
        return r.path ? `<a class="use" href="${shEsc(r.path)}" title="${title}">${inner}</a>` : `<span class="use" title="${title}">${inner}</span>`;
      })
      .join('');
    return `<div class="uses"><span>${shEsc(this._t('orph_used_by', { n: refs.length }))}</span>${chips}</div>`;
  },

  _orphTile(reason, n, on) {
    var tone = n ? shOrphTone(reason) : 'good';
    return `<ha-card class="tile pick ${tone}${on ? ' on' : ''}" data-action="orph_reason" data-reason="${reason}" aria-pressed="${on}">
      <div class="avatar"><ha-icon icon="${SH_ORPH_ICONS[reason]}"></ha-icon></div>
      <div class="who"><div class="n"><b>${n}</b></div><div class="s">${shEsc(this._t(`orph_reason_${reason}`))}</div></div></ha-card>`;
  },

  _orphConfirm(kind, n, used) {
    var title = {
      remove: this._orphN('orph_confirm_remove', n),
      ignore: this._orphN('orph_confirm_ignore', n),
      remove_devices: this._t('orph_confirm_devices'),
      ignore_devices: this._t('orph_confirm_ignore_devices'),
    }[kind];
    var text = { remove: 'orph_confirm_remove_text', ignore: 'orph_confirm_ignore_text', remove_devices: 'orph_confirm_devices_text' }[kind];
    var warn = used ? (kind === 'remove' ? this._orphN('orph_confirm_used', used) : kind === 'remove_devices' ? this._t('orph_confirm_devices_used', { n: used }) : '') : '';
    var label = kind.startsWith('ignore') ? this._t('orph_ignore') : warn ? this._t('orph_remove_anyway') : this._t('orph_remove');
    return `<div class="confirm" role="alertdialog"><div class="who"><div class="n">${shEsc(title)}</div>
        ${text ? `<div class="s">${shEsc(this._t(text))}</div>` : ''}${warn ? `<div class="s warn-text">${shEsc(warn)}</div>` : ''}</div>
      ${this._button('orph_do', kind.startsWith('ignore') ? 'mdi:eye-off-outline' : 'mdi:delete-outline', label, { danger: !kind.startsWith('ignore') })}
      ${this._button('orph_cancel', 'mdi:close', this._t('cancel'), { quiet: true })}</div>`;
  },

  _orphRow(e, names, on) {
    var sub = [e.entity_id, names[e.platform] || e.platform, e.device, e.entry_title].filter(Boolean);
    var why = [this._t(`orph_reason_${e.reason}`), this._orphFor(e.since)].filter(Boolean).join(' · ');
    var tone = shOrphTone(e.reason);
    return `<div class="item orow ${tone}${on ? ' on' : ''}">
      <input type="checkbox" data-orph-sel="${shEsc(e.entity_id)}"${on ? ' checked' : ''} aria-label="${shEsc(e.name)}">
      <ha-icon icon="${SH_ORPH_ICONS[e.reason] || 'mdi:ghost-outline'}"></ha-icon>
      <div class="who"><div class="n">${shEsc(e.name)}${e.disabled ? ` <span class="muted">(${shEsc(this._t('orph_disabled'))})</span>` : ''}</div>
        <div class="s">${shEsc(sub.join(' · '))}</div><div class="s">${shEsc(why)}</div>${this._orphUses(e.used_by)}</div>
      <span class="pill ${tone}">${shEsc(this._t(`orph_reason_${e.reason}`))}</span></div>`;
  },

  _orphDevices(devices, o) {
    if (!devices.length) return '';
    var rows = devices
      .map((d) => {
        var on = o.dsel.has(d.device_id);
        var sub = [[d.manufacturer, d.model].filter(Boolean).join(' '), this._t('orph_dev_entities', { n: d.entities ?? 0 }), this._orphFor(d.since)].filter(Boolean);
        return `<div class="item orow bad${on ? ' on' : ''}">
          <input type="checkbox" data-orph-dsel="${shEsc(d.device_id)}"${on ? ' checked' : ''} aria-label="${shEsc(d.name)}">
          <ha-icon icon="mdi:devices"></ha-icon>
          <div class="who"><div class="n">${shEsc(d.name)}</div><div class="s">${shEsc(sub.join(' · '))}</div>${this._orphUses(d.used_by)}</div>
          <a class="icon-btn" href="/config/devices/device/${shEsc(d.device_id)}" title="${shEsc(this._t('open_device'))}" aria-label="${shEsc(this._t('open_device'))}"><ha-icon icon="mdi:open-in-new"></ha-icon></a></div>`;
      })
      .join('');
    var targets = o.dsel.size ? devices.filter((d) => o.dsel.has(d.device_id)) : devices;
    var used = targets.filter((d) => d.used_by?.length).length;
    var confirm = o.confirm === 'remove_devices' || o.confirm === 'ignore_devices' ? this._orphConfirm(o.confirm, targets.length, used) : '';
    var bar = `<div class="obar">${o.dsel.size ? `<span>${shEsc(this._orphN('orph_selected', o.dsel.size))}</span>` : ''}
      ${this._button('orph_confirm', 'mdi:delete-outline', this._t('orph_remove_devices'), { data: { act: 'remove_devices' }, disabled: this._busy.orph, busy: this._busy.orph === 'remove_devices', danger: true })}
      ${this._button('orph_confirm', 'mdi:eye-off-outline', this._t('orph_ignore'), { quiet: true, data: { act: 'ignore_devices' }, disabled: !o.dsel.size || this._busy.orph, busy: this._busy.orph === 'ignore_devices' })}
      ${o.dsel.size ? this._button('orph_dclear', 'mdi:close', this._t('orph_clear'), { quiet: true }) : ''}</div>`;
    return `<ha-card class="list"><div class="lhead"><ha-icon icon="mdi:devices"></ha-icon><span class="lname">${shEsc(this._t('orph_devices_title'))}</span>
        <span class="muted">${devices.length}</span></div>
      <div class="obar">${shEsc(this._t('orph_devices_hint'))}</div>${bar}${confirm}${rows}</ha-card>`;
  },

  _orphans() {
    var summary = this._state.orphans || {};
    var o = this._orph();
    if (!o.data && !o.loading && !o.error) {
      this._orphLoad().then(() => this._tab === 'orphans' && this._render());
    }
    var data = o.data || {};
    var counts = data.counts || summary.counts || {};
    var names = data.integrations || {};
    var f = this._orphFilters();
    var entities = data.entities || [];
    var devices = data.devices || [];
    var tiles = [
      ...SH_ORPH_REASONS.map((r) => this._orphTile(r, counts[r] ?? 0, f.reason === r)),
      this._tile('mdi:devices', `<b>${summary.devices ?? devices.length}</b>`, this._t('orph_devices_title'), summary.devices ? 'bad' : 'good'),
      this._tile('mdi:delete-sweep-outline', `<b>${summary.removed ?? 0}</b>`, this._t('orph_stat_removed'), '', { title: this._t('orph_stat_removed_hint') }),
      this._tile('mdi:clock-check-outline', shEsc(summary.last_scan ? this._rel(summary.last_scan) : this._t('orph_never_scanned')), this._entityName('sensor', 'orphans_last_scan'), ''),
    ];
    var waiting = summary.next_scan ? `<span class="pill warn">${shEsc(this._t('orph_waiting'))} · ${shEsc(this._rel(summary.next_scan))}</span>` : '';
    var actions = `<div class="actions">${this._button('orphans_scan', 'mdi:magnify-scan', this._entityName('button', 'orphans_scan'))}
      ${waiting}${summary.ignored ? `<span class="pill">${shEsc(this._t('orph_stat_ignored'))} ${summary.ignored}</span>` : ''}
      ${this._message('orphans_scan')}${this._message('orphans')}
      ${this._configure()}</div>`;
    if (!o.data) {
      var note = o.error ? shEsc(this._t('failed', { error: o.error })) : this._spinner(this._t('loading'));
      return `<div class="tiles">${tiles.join('')}</div>${actions}<ha-card class="note">${note}</ha-card>`;
    }
    var platforms = [...new Set(entities.map((e) => e.platform))].sort((a, b) => (names[a] || a).localeCompare(names[b] || b));
    var matches = shOrphFilter(entities, f, names);
    var shown = o.all ? matches : matches.slice(0, SH_ORPH_ROWS);
    var selected = entities.filter((e) => o.sel.has(e.entity_id));
    var used = selected.filter((e) => e.used_by?.length).length;
    var filters = `<div class="ofilters">
      <label class="box"><input data-draft="orph_q" type="search" placeholder="${shEsc(this._t('orph_search'))}" aria-label="${shEsc(this._t('orph_search'))}" value="${shEsc(f.q)}"></label>
      <select data-draft="orph_platform" aria-label="${shEsc(this._t('orph_all_integrations'))}"><option value="">${shEsc(this._t('orph_all_integrations'))}</option>
        ${platforms.map((p) => `<option value="${shEsc(p)}"${p === f.platform ? ' selected' : ''}>${shEsc(names[p] || p)}</option>`).join('')}</select>
      <select data-draft="orph_reason" aria-label="${shEsc(this._t('orph_all'))}"><option value="">${shEsc(this._t('orph_all'))}</option>
        ${SH_ORPH_REASONS.filter((r) => counts[r])
          .map((r) => `<option value="${r}"${r === f.reason ? ' selected' : ''}>${shEsc(this._t(`orph_reason_${r}`))} (${counts[r]})</option>`)
          .join('')}</select></div>`;
    var unselected = matches.filter((e) => !o.sel.has(e.entity_id)).length;
    var bar = o.sel.size
      ? `<div class="obar"><span>${shEsc(this._orphN('orph_selected', o.sel.size))}</span>
          ${this._button('orph_confirm', 'mdi:delete-outline', this._t('orph_remove'), { data: { act: 'remove' }, disabled: this._busy.orph, busy: this._busy.orph === 'remove', danger: true })}
          ${this._button('orph_confirm', 'mdi:eye-off-outline', this._t('orph_ignore'), { quiet: true, data: { act: 'ignore' }, disabled: this._busy.orph, busy: this._busy.orph === 'ignore' })}
          ${unselected ? this._button('orph_select_all', 'mdi:checkbox-multiple-marked-outline', this._t('orph_select_all', { n: matches.length }), { quiet: true }) : ''}
          ${this._button('orph_clear', 'mdi:close', this._t('orph_clear'), { quiet: true })}</div>`
      : matches.length
        ? `<div class="obar">${this._button('orph_select_all', 'mdi:checkbox-multiple-marked-outline', this._t('orph_select_all', { n: matches.length }), { quiet: true })}</div>`
        : '';
    var confirm = o.confirm === 'remove' || o.confirm === 'ignore' ? this._orphConfirm(o.confirm, o.sel.size, used) : '';
    var rows = shown.map((e) => this._orphRow(e, names, o.sel.has(e.entity_id))).join('');
    var empty = entities.length
      ? `<div class="empty">${shEsc(this._t('orph_no_match'))}</div>`
      : `<div class="empty good"><ha-icon icon="mdi:check-circle-outline"></ha-icon>${shEsc(this._t('orph_empty'))}</div>`;
    var more = shown.length < matches.length ? `<div class="omore">${this._button('orph_all', 'mdi:chevron-down', this._t('orph_show_all', { n: matches.length }), { quiet: true })}</div>` : '';
    return `<div class="tiles">${tiles.join('')}</div>${actions}
      <ha-card class="list"><div class="lhead"><ha-icon icon="mdi:ghost-outline"></ha-icon><span class="lname">${shEsc(this._entityName('sensor', 'orphans_orphans'))}</span>
        <span class="muted">${matches.length === entities.length ? entities.length : `${matches.length} / ${entities.length}`}</span></div>
        ${entities.length ? filters : ''}${bar}${confirm}${rows || empty}${more}</ha-card>
      ${this._orphDevices(devices, o)}`;
  },

  // Checkboxes, filters by reason, selection and the confirmed actions; false: not an Orphans control
  _orphClick(ev) {
    var o = this._orph();
    var pick = ev.target.closest?.('[data-orph-sel], [data-orph-dsel]');
    if (pick) {
      var set = pick.dataset.orphSel ? o.sel : o.dsel;
      var id = pick.dataset.orphSel || pick.dataset.orphDsel;
      if (set.has(id)) set.delete(id);
      else set.add(id);
      o.confirm = null;
      this._render();
      return true;
    }
    var el = ev.target.closest?.('[data-action^="orph_"]');
    if (!el) return false;
    if (el.disabled) return true;
    var action = el.dataset.action;
    if (action === 'orph_reason') {
      this._draft.orph_reason = this._draft.orph_reason === el.dataset.reason ? '' : el.dataset.reason;
    } else if (action === 'orph_select_all') {
      for (var e of shOrphFilter(o.data?.entities, this._orphFilters(), o.data?.integrations)) o.sel.add(e.entity_id);
    } else if (action === 'orph_clear') {
      o.sel.clear();
      o.confirm = null;
    } else if (action === 'orph_dclear') {
      o.dsel.clear();
      o.confirm = null;
    } else if (action === 'orph_confirm') {
      o.confirm = el.dataset.act;
    } else if (action === 'orph_cancel') {
      o.confirm = null;
    } else if (action === 'orph_all') {
      o.all = true;
    } else if (action === 'orph_do') {
      this._orphRun(o.confirm);
      return true;
    }
    this._render();
    return true;
  },

  // An admin action of the module, with its response (what was removed, what was kept as no longer orphaned)
  async _orphCall(service, data) {
    var res = await this._hass.callWS({ type: 'call_service', domain: SH_DOMAIN, service, service_data: data, return_response: true });
    return res?.response || {};
  },

  async _orphRun(act) {
    var o = this._orph();
    o.confirm = null;
    var entities = [...o.sel];
    var devices = [...o.dsel];
    this._busy.orph = act;
    delete this._messages.orphans;
    this._render();
    try {
      var text;
      if (act === 'remove') {
        var res = await this._orphCall('orphans_remove', { entities });
        text = this._orphN('orph_removed', (res.removed || entities).length);
        if (res.skipped?.length) text += ` · ${this._t('orph_kept', { n: res.skipped.length })}`;
        o.sel.clear();
      } else if (act === 'ignore') {
        await this._hass.callService(SH_DOMAIN, 'orphans_ignore', { entities });
        text = this._orphN('orph_ignored', entities.length);
        o.sel.clear();
      } else if (act === 'remove_devices') {
        // Without a selection: every orphan device of the last scan
        var dres = await this._orphCall('orphans_remove_devices', devices.length ? { devices } : {});
        text = this._t('orph_devices_removed', { n: (dres.removed || []).length });
        if (dres.skipped?.length) text += ` · ${this._t('orph_kept', { n: dres.skipped.length })}`;
        o.dsel.clear();
      } else if (act === 'ignore_devices') {
        await this._hass.callService(SH_DOMAIN, 'orphans_ignore', { devices });
        text = this._t('orph_devices_ignored', { n: devices.length });
        o.dsel.clear();
      }
      if (text) this._toast(text);
    } catch (err) {
      this._messages.orphans = { text: this._t('failed', { error: shErr(err) }), tone: 'bad' };
    }
    await this._load();
    delete this._busy.orph;
    this._render();
  },
};

Object.assign(SystemHubPanel.prototype, SH_ORPHANS_METHODS);

if (!customElements.get('system-hub-diff-dialog')) {
  customElements.define('system-hub-diff-dialog', SystemHubDiffDialog);
}
if (!customElements.get('system-hub-panel')) {
  customElements.define('system-hub-panel', SystemHubPanel);
}

// Settings tab: each module's settings, edited in the panel. The panel drives System Hub's own options flow (the
// form Configure shows) through Home Assistant's flow API, so the fields, their checks and their errors are the same;
// the forms are Home Assistant's <ha-form>. A module's further steps (power cycles, battery types, the import, the Git
// repository) open from its section the same way.
var SH_SETTINGS_STEPS = {
  system: ['system'],
  containers: ['containers'],
  watchdog: ['watchdog', 'watchdog_add_power_cycle', 'watchdog_remove_power_cycle'],
  marketplace: ['marketplace'],
  backups: ['backups'],
  database: ['database'],
  security: ['security'],
  logs: ['logs'],
  silent: ['silent'],
  batteries: ['batteries', 'batteries_types', 'batteries_import'],
  git_sync: ['git_sync', 'git_sync_repository', 'git_sync_add_repository', 'git_sync_other', 'git_sync_remove_repository'],
  automations: ['automations'],
  orphans: ['orphans'],
};
var SH_SETTINGS_ICONS = { system: 'mdi:chip' };

// Home Assistant loads <ha-form> with its config pages: loaded here through them when no page has needed it yet
async function shLoadHaForm() {
  if (customElements.get('ha-form')) return true;
  try {
    await customElements.whenDefined('partial-panel-resolver');
    var resolver = document.createElement('partial-panel-resolver');
    resolver.hass = { panels: [{ url_path: 'tmp', component_name: 'config' }] };
    resolver._updateRoutes();
    await resolver.routerOptions.routes.tmp.load();
    await customElements.whenDefined('ha-panel-config');
    var config = document.createElement('ha-panel-config');
    await config.routerOptions.routes.automation.load();
  } catch (_err) {
    // Not loaded: the section links to Configure instead
  }
  return Boolean(customElements.get('ha-form'));
}

// The values a form starts from: those it suggests, else its defaults
// A form's values to start with: its suggested values, else its defaults; an empty suggestion (an entity not chosen)
// is left out, as Home Assistant's own forms do: sent as null, it would not pass the field's check (#63)
function shFormData(schema) {
  var data = {};
  for (var field of schema || []) {
    var suggested = field.description?.suggested_value;
    if (suggested !== undefined && suggested !== null) data[field.name] = suggested;
    else if (field.default !== undefined && field.default !== null) data[field.name] = field.default;
  }
  return data;
}

// The values sent: the empty ones left out, as Home Assistant's own forms do: null or undefined, and an empty string
// but in a text field (an entity or a device picker cleared gives one, which its check refuses)
function shFormSubmit(data, schema) {
  var text = new Set((schema || []).filter((f) => f.selector && ('text' in f.selector || 'template' in f.selector)).map((f) => f.name));
  return Object.fromEntries(Object.entries(data || {}).filter(([key, value]) => value !== null && value !== undefined && (value !== '' || text.has(key))));
}

// A form refused by Home Assistant (400: the values did not pass the checks): its errors by field, as the form shows
// them; "base" for those of the whole form
function shFormErrors(err) {
  var errors = err?.body?.errors;
  if (!errors || typeof errors !== 'object') return { base: shErr(err) };
  return Object.fromEntries(Object.entries(errors).map(([key, value]) => [key, Array.isArray(value) ? value.join(' · ') : String(value)]));
}

var SH_SETTINGS_METHODS = {
  _cfgState() {
    this._cfg ??= { module: null, step: null, flow: null, data: {}, errors: {}, menu: [], busy: false, error: null, haForm: null };
    return this._cfg;
  },

  // One row per module (and the System thresholds): its switch, what it does, and its settings once opened
  // The modules and the tabs in one list, as Home Assistant's sidebar editor: the ones turned on in the order of the
  // tabs (dragged by their handle, or moved with ↑ ↓ from it), each with its switch and its settings opened in place;
  // the ones turned off below
  _settingsModules(modules) {
    var cfg = this._cfgState();
    var tabs = shAllTabs(this._draft.tabs || this._state.tabs);
    var on = (t) => t === 'status' || t === 'system' || modules.includes(t);
    var row = (tab, enabled) => {
      var fixed = tab === 'status' || tab === 'system';
      var steps = SH_SETTINGS_STEPS[tab] || [];
      var saved = tab === 'system' || (this._state.modules || []).includes(tab);
      var open = cfg.module === tab;
      var name = this._tabName(tab);
      var hint =
        tab === 'status'
          ? this._t('st_hint')
          : tab === 'system'
            ? this._t('settings_system_hint')
            : this._l(`component.${SH_DOMAIN}.config.step.user.data_description.${tab}`);
      var first = enabled && tabs.find(on) === tab;
      // A handle only where there is something to order: two modules or more of the group turned on
      var handle = enabled && tabs.filter((t) => on(t) && shGroupOf(t) === shGroupOf(tab)).length > 1
        ? `<button class="icon-btn dragh" data-tab="${tab}" title="${shEsc(this._t('drag'))}" aria-label="${shEsc(`${this._t('drag')} · ${name}`)}"><ha-icon icon="mdi:drag-horizontal-variant"></ha-icon></button>`
        : '<span class="cfgpad"></span>';
      var head = `<div class="row cfgrow${open ? ' open' : ''}${enabled ? '' : ' off'}" data-row-tab="${tab}">${handle}<ha-icon icon="${SH_MODULE_ICONS[tab]}"></ha-icon>
        <div class="who"><div class="n">${shEsc(name)}${first ? `<span class="pill cfgdef">${shEsc(this._t('tab_default'))}</span>` : ''}</div>${hint ? `<div class="s">${shEsc(hint)}</div>` : ''}</div>
        ${fixed ? '' : `<ha-switch data-module="${tab}"${enabled ? ' checked' : ''} aria-label="${shEsc(name)}"></ha-switch>`}
        ${
          steps.length && saved
            ? `<button class="icon-btn" data-action="cfg_toggle" data-module="${tab}" aria-expanded="${open}" title="${shEsc(this._t('settings'))}" aria-label="${shEsc(`${this._t('settings')} · ${name}`)}"><ha-icon icon="mdi:cog${open ? '' : '-outline'}"></ha-icon></button>`
            : '<span class="cfgpad"></span>'
        }</div>`;
      return head + (open ? this._cfgBody(tab) : '');
    };
    // One section per group, moved with ↑ ↓; its modules turned on (dragged among themselves), then the ones turned off
    var groups = [...new Set(tabs.map(shGroupOf))];
    var sections = groups.map((group, i) => {
      var mine = tabs.filter((t) => shGroupOf(t) === group);
      var gname = this._groupName(group);
      var arrow = (dir, icon, disabled) =>
        `<button class="icon-btn" data-action="cfg_group" data-group="${group}" data-dir="${dir}"${disabled ? ' disabled' : ''} title="${shEsc(this._t(dir < 0 ? 'move_up' : 'move_down'))}" aria-label="${shEsc(`${this._t(dir < 0 ? 'move_up' : 'move_down')} · ${gname}`)}"><ha-icon icon="${icon}"></ha-icon></button>`;
      var enabledRows = mine.filter(on).map((t) => row(t, true)).join('');
      var disabledRows = mine.filter((t) => !on(t)).map((t) => row(t, false)).join('');
      return `<div class="cfgsec cfggroup"><span class="grow">${shEsc(gname)}</span>${arrow(-1, 'mdi:arrow-up', i === 0)}${arrow(1, 'mdi:arrow-down', i === groups.length - 1)}</div>
        ${enabledRows ? `<div class="cfglist" data-group="${group}">${enabledRows}</div>` : ''}${disabledRows ? `<div class="cfglist off">${disabledRows}</div>` : ''}`;
    });
    return `<ha-card class="block cfg"><h2>${shEsc(this._t('modules_tabs'))}</h2><span class="msg">${shEsc(this._t('modules_tabs_hint'))}</span>
      ${sections.join('')}</ha-card>`;
  },

  // Moves a tab among the ones of its group turned on (the ones turned off keep their place): to the index `to` of that list
  _cfgMove(tab, to) {
    var modules = this._draft.modules || this._state.modules || [];
    var tabs = shAllTabs(this._draft.tabs || this._state.tabs);
    var on = (t) => t === 'status' || t === 'system' || modules.includes(t);
    var group = shGroupOf(tab);
    var mine = tabs.filter((t) => shGroupOf(t) === group);
    var enabled = mine.filter(on).filter((t) => t !== tab);
    enabled.splice(Math.max(0, Math.min(to, enabled.length)), 0, tab);
    var block = [...enabled, ...mine.filter((t) => !on(t))];
    var next = [...new Set(tabs.map(shGroupOf))].flatMap((g) => (g === group ? block : tabs.filter((t) => shGroupOf(t) === g)));
    if (next.join() !== tabs.join()) this._draft.tabs = next;
    this._render();
  },

  // Moves a whole group one place up (-1) or down (1) among the tabs
  _cfgMoveGroup(group, dir) {
    var tabs = shAllTabs(this._draft.tabs || this._state.tabs);
    var groups = [...new Set(tabs.map(shGroupOf))];
    var i = groups.indexOf(group);
    var j = i + dir;
    if (i < 0 || j < 0 || j >= groups.length) return;
    [groups[i], groups[j]] = [groups[j], groups[i]];
    this._draft.tabs = groups.flatMap((g) => tabs.filter((t) => shGroupOf(t) === g));
    this._render();
    this.shadowRoot.querySelector(`[data-action="cfg_group"][data-group="${group}"][data-dir="${dir}"]:not([disabled])`)?.focus();
  },

  // Dragging a row by its handle (mouse, finger, pen): the row follows among those turned on, the order is kept once
  // let go. Followed on the window: a row moved in the page loses the pointer capture
  _cfgDragStart(ev) {
    var handle = ev.target.closest?.('.dragh');
    if (!handle || ev.button > 0) return;
    var list = handle.closest('.cfglist');
    var row = handle.closest('[data-row-tab]');
    if (!list || !row) return;
    ev.preventDefault();
    var cfg = this._cfgState();
    if (cfg.module) {
      this._cfgAbort();
      Object.assign(cfg, { module: null, step: null, error: null, haForm: null });
    }
    this._drag = { tab: row.dataset.rowTab };
    row.classList.add('dragging');
    var move = (e) => {
      var over = this.shadowRoot.elementFromPoint?.(e.clientX, e.clientY)?.closest?.('[data-row-tab]');
      if (!over || over === row || over.parentNode !== list) return;
      var box = over.getBoundingClientRect();
      list.insertBefore(row, e.clientY > box.top + box.height / 2 ? over.nextSibling : over);
    };
    var end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      var order = [...list.querySelectorAll('[data-row-tab]')].map((el) => el.dataset.rowTab);
      this._drag = null;
      this._cfgMove(row.dataset.rowTab, order.indexOf(row.dataset.rowTab));
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  },

  // ↑ ↓ on a handle: the row one place up or down
  _cfgDragKey(ev) {
    var handle = ev.target.closest?.('.dragh');
    if (!handle || (ev.key !== 'ArrowUp' && ev.key !== 'ArrowDown')) return;
    ev.preventDefault();
    var tab = handle.dataset.tab;
    var modules = this._draft.modules || this._state.modules || [];
    var enabled = shAllTabs(this._draft.tabs || this._state.tabs).filter(
      (t) => shGroupOf(t) === shGroupOf(tab) && (t === 'status' || t === 'system' || modules.includes(t)),
    );
    this._cfgMove(tab, enabled.indexOf(tab) + (ev.key === 'ArrowUp' ? -1 : 1));
    this.shadowRoot.querySelector(`.dragh[data-tab="${tab}"]`)?.focus();
  },

  // An open section: the step's form, its further steps, Save
  _cfgBody(m) {
    var cfg = this._cfgState();
    if (cfg.error) {
      return `<div class="cfgbody"><span class="msg bad">${shEsc(cfg.error)}</span>
        <a class="act quiet" href="/config/integrations/integration/${SH_DOMAIN}"><ha-icon icon="mdi:cog-outline"></ha-icon>${shEsc(this._t('configure'))}</a></div>`;
    }
    if (!cfg.flow) return `<div class="cfgbody">${this._spinner(this._t('loading'))}</div>`;
    var others = (SH_SETTINGS_STEPS[m] || []).filter((s) => cfg.menu.includes(s));
    var tabs = others.length > 1
      ? `<div class="btabs cfgtabs" role="group">${others
          .map((s) => `<button class="btab${s === cfg.step ? ' on' : ''}" data-action="cfg_step" data-step="${s}" aria-pressed="${s === cfg.step}">${shEsc(this._cfgTitle(s))}</button>`)
          .join('')}</div>`
      : '';
    var description = this._l(`component.${SH_DOMAIN}.options.step.${cfg.step}.description`, cfg.flow.description_placeholders || {});
    var base = cfg.errors?.base ? this._l(`component.${SH_DOMAIN}.options.error.${cfg.errors.base}`) || cfg.errors.base : '';
    return `<div class="cfgbody">${tabs}
      ${description ? `<div class="s cfgdesc">${shEsc(description)}</div>` : ''}
      <div class="cfgform" data-step="${shEsc(cfg.step)}"></div>
      ${base ? `<span class="msg bad">${shEsc(base)}</span>` : ''}
      <div class="actions"><span class="grow"></span>${this._button('cfg_close', 'mdi:close', this._t('cancel'), { quiet: true, disabled: cfg.busy })}
        ${this._button('cfg_submit', 'mdi:content-save-outline', this._t('save'), { busy: cfg.busy })}</div></div>`;
  },

  _cfgTitle(step) {
    return this._l(`component.${SH_DOMAIN}.options.step.${step}.title`) || step;
  },

  // The form of the open step, put in its place after each drawing (the same element: what is typed stays)
  _cfgMount(main) {
    var cfg = this._cfgState();
    var slot = main.querySelector('.cfgform');
    if (!slot || !cfg.flow) return;
    if (!customElements.get('ha-form')) {
      slot.textContent = this._t('loading');
      return;
    }
    var form = cfg.haForm || document.createElement('ha-form');
    if (!cfg.haForm) {
      form.addEventListener('value-changed', (ev) => {
        cfg.data = ev.detail.value;
      });
      cfg.haForm = form;
    }
    var step = cfg.step;
    form.hass = this._hass;
    form.schema = cfg.flow.data_schema || [];
    form.data = cfg.data;
    form.error = Object.fromEntries(
      Object.entries(cfg.errors || {})
        .filter(([key]) => key !== 'base')
        .map(([key, value]) => [key, this._l(`component.${SH_DOMAIN}.options.error.${value}`) || value]),
    );
    form.computeLabel = (field) => this._l(`component.${SH_DOMAIN}.options.step.${step}.data.${field.name}`) || field.name;
    form.computeHelper = (field) => this._l(`component.${SH_DOMAIN}.options.step.${step}.data_description.${field.name}`);
    form.computeError = (error) => this._l(`component.${SH_DOMAIN}.options.error.${error}`) || error;
    form.disabled = cfg.busy;
    slot.appendChild(form);
  },

  // Opens a module's section on its first step (the one Configure would show), or closes it
  async _cfgOpen(module, step) {
    var cfg = this._cfgState();
    await this._cfgAbort();
    Object.assign(cfg, { module, step: step || SH_SETTINGS_STEPS[module][0], flow: null, data: {}, errors: {}, menu: [], error: null, busy: false });
    this._render();
    var ready = await shLoadHaForm();
    if (!ready) {
      cfg.error = this._t('settings_unavailable');
      return this._render();
    }
    try {
      var menu = await this._hass.callWS({ type: 'system_hub/options_flow' });
      cfg.menu = menu.menu_options || [];
      cfg.flowId = menu.flow_id;
      await this._cfgGo(cfg.step);
    } catch (err) {
      cfg.error = this._t('failed', { error: shErr(err) });
      this._render();
    }
  },

  async _cfgGo(step) {
    var cfg = this._cfgState();
    if (!cfg.menu.includes(step)) step = cfg.menu.find((s) => (SH_SETTINGS_STEPS[cfg.module] || []).includes(s)) || step;
    // A flow goes one way: another step starts it again from its menu
    if (cfg.flow) {
      await this._cfgAbort();
      var menu = await this._hass.callWS({ type: 'system_hub/options_flow' });
      cfg.menu = menu.menu_options || [];
      cfg.flowId = menu.flow_id;
    }
    var form = await this._hass.callApi('POST', `config/config_entries/options/flow/${cfg.flowId}`, { next_step_id: step });
    this._cfgShow(form);
  },

  // What the flow answered: a form (the first time, or with its errors), the settings saved, or an abort
  _cfgShow(result) {
    var cfg = this._cfgState();
    cfg.busy = false;
    if (result.type === 'form') {
      var first = !cfg.flow || cfg.step !== result.step_id;
      cfg.flow = result;
      cfg.step = result.step_id;
      cfg.errors = result.errors || {};
      if (first) {
        cfg.data = shFormData(result.data_schema);
        cfg.haForm = null;
      }
      return this._render();
    }
    if (result.type === 'create_entry') {
      this._toast(this._t('saved'));
      Object.assign(cfg, { module: null, step: null, flow: null, flowId: null, haForm: null });
      this._render();
      // The entry reloads with its new options: read them once it has
      setTimeout(() => this._load(), 1500);
      return;
    }
    cfg.flow = null;
    cfg.flowId = null;
    cfg.error = this._l(`component.${SH_DOMAIN}.options.abort.${result.reason}`) || result.reason || this._t('settings_unavailable');
    this._render();
  },

  async _cfgSubmit() {
    var cfg = this._cfgState();
    if (!cfg.flowId) return;
    cfg.busy = true;
    this._render();
    try {
      this._cfgShow(await this._hass.callApi('POST', `config/config_entries/options/flow/${cfg.flowId}`, shFormSubmit(cfg.data, cfg.flow?.data_schema)));
    } catch (err) {
      cfg.busy = false;
      cfg.errors = shFormErrors(err);
      this._render();
    }
  },

  async _cfgAbort() {
    var cfg = this._cfgState();
    var id = cfg.flowId;
    cfg.flowId = null;
    cfg.flow = null;
    if (id) await this._hass.callApi('DELETE', `config/config_entries/options/flow/${id}`).catch(() => {});
  },

  // The Settings tab's buttons for the sections; true when the click was one of them
  _cfgClick(button) {
    var action = button.dataset.action;
    var cfg = this._cfgState();
    if (action === 'cfg_group') {
      this._cfgMoveGroup(button.dataset.group, Number(button.dataset.dir));
      return true;
    }
    if (action === 'cfg_toggle') {
      var module = button.dataset.module;
      if (cfg.module === module) {
        this._cfgAbort();
        Object.assign(cfg, { module: null, step: null, error: null, haForm: null });
        this._render();
      } else this._cfgOpen(module);
      return true;
    }
    if (action === 'cfg_step') {
      this._cfgGo(button.dataset.step).catch((err) => {
        cfg.error = this._t('failed', { error: shErr(err) });
        this._render();
      });
      return true;
    }
    if (action === 'cfg_submit') {
      this._cfgSubmit();
      return true;
    }
    if (action === 'cfg_close') {
      this._cfgAbort();
      Object.assign(cfg, { module: null, step: null, error: null, haForm: null });
      this._render();
      return true;
    }
    if (action.startsWith('open_settings')) {
      var target = action.split(':')[1];
      this._selectTab('settings');
      if (target && SH_SETTINGS_STEPS[target]) this._cfgOpen(target);
      return true;
    }
    return false;
  },
};

Object.assign(SystemHubPanel.prototype, SH_SETTINGS_METHODS);

// Status tab: the health of the instance at a glance. A score out of 100 (100, less 15 per area needing action, 5 per
// area to watch, 1 per area with something to know), then one tile per area in the order of the tabs: its level, what
// it says in a few words, its details; a click opens its tab. Worked out here from what the panel already reads.
var SH_STATUS_WEIGHTS = { bad: 15, warn: 5, info: 1, good: 0 };

// The emblem beside the score, drawn after System Hub's logo in the colour of the ring: the house with its hub (the
// modules around a centre) and a badge cut out of its roof, a pulse in good health, "!" to watch, "×" with a problem
var SH_STATUS_GLYPHS = {
  good: '<polyline points="-34,3 -16,3 -7,-20 6,24 15,-4 34,-4" fill="none" stroke="#fff" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>',
  warn: '<line x1="0" y1="-24" x2="0" y2="6" stroke="#fff" stroke-width="12" stroke-linecap="round"/><circle cx="0" cy="25" r="7.5" fill="#fff"/>',
  bad: '<path d="M-18 -18 L18 18 M18 -18 L-18 18" stroke="#fff" stroke-width="12" stroke-linecap="round"/>',
};

function shStatusEmblem(tone) {
  var nodes = [
    [196, 250],
    [316, 250],
    [196, 352],
    [316, 352],
  ];
  var links = nodes.map(([x, y]) => `<line x1="256" y1="300" x2="${x}" y2="${y}" stroke-width="12" stroke-linecap="round"/>`).join('');
  var dots = nodes.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="17" stroke="none"/>`).join('');
  return `<svg viewBox="64 56 412 380" aria-hidden="true"><defs><mask id="st-cut"><rect x="0" y="0" width="512" height="512" fill="#fff"/><circle cx="398" cy="128" r="66" fill="#000"/></mask></defs>
    <g mask="url(#st-cut)" fill="none" stroke="currentColor"><path d="M96 236 L256 104 L416 236" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M138 214 V388 Q138 404 154 404 H358 Q374 404 374 388 V214" stroke-width="26" stroke-linejoin="round"/>
      ${links}<g fill="currentColor">${dots}<circle cx="256" cy="300" r="27" stroke="none"/></g></g>
    <g transform="translate(398 128)"><circle r="52" fill="currentColor"/>${SH_STATUS_GLYPHS[tone] || SH_STATUS_GLYPHS.good}</g></svg>`;
}

var SH_STATUS_METHODS = {
  // One area: [tone, value, details] or null when there is nothing to show (module off, nothing read yet)
  _stArea(tab) {
    var s = this._state;
    var n = (key, count) => this._t(key, { n: count });
    var join = (parts) => parts.filter(Boolean).join(' · ');
    if (tab === 'system') {
      var sensors = s.system || [];
      if (!sensors.length) return null;
      var one = (key) => sensors.find((x) => x.key === key);
      var th = { ...SH_THRESHOLDS, ...(s.thresholds || {}) };
      var disks = sensors.filter((x) => x.key === 'disk_use_percent');
      var disk = disks.map((d) => shNum(d.state)).filter((v) => v !== null);
      var checks = [
        ['cpu', shNum(one('processor_use')?.state), 'CPU', '%'],
        ['ram', shNum(one('memory_use_percent')?.state), 'RAM', '%'],
        ['temperature', shNum(one('processor_temperature')?.state), '', '°C'],
        ['disk', disk.length ? Math.max(...disk) : null, this._t('disk'), '%'],
      ].filter(([, v]) => v !== null);
      var tones = checks.map(([key, v]) => shTone(v, th[key][0], th[key][1]));
      var tone = tones.includes('bad') ? 'bad' : tones.includes('warn') ? 'warn' : 'good';
      var high = checks.filter((_c, i) => tones[i] !== 'good').map(([, , label]) => label || this._t('temperature'));
      return [tone, tone === 'good' ? this._t('st_normal') : this._t('st_high', { what: high.join(', ') }), join(checks.map(([, v, label, unit]) => `${label ? `${label} ` : ''}${Math.round(v)} ${unit}`))];
    }
    if (tab === 'containers') {
      var data = s.containers;
      if (!data) return null;
      var list = data.containers || [];
      var down = list.filter((c) => c.down);
      var procs = (s.system || []).filter((x) => x.key === 'process');
      // The processes that may be stopped (System settings) are no problem
      var stopped = procs.filter((p) => p.state !== 'on' && !p.stoppable);
      var images = list.filter((c) => c.update_available);
      var running = list.filter((c) => c.state === 'started' || c.state === 'startup').length;
      var problems = down.length + stopped.length;
      return [
        problems ? 'bad' : images.length || data.error ? 'warn' : 'good',
        problems ? n('st_stopped', problems) : images.length ? n('st_available', images.length) : this._t('st_all_running'),
        join([...down.map((c) => c.container || c.name), ...stopped.map((p) => shProcess(p)), `${running}/${list.length}`]),
      ];
    }
    if (tab === 'marketplace') {
      var market = s.marketplace;
      // Home Assistant, the add-ons and the devices when the module reads them; else Core and OS alone
      var others = s.system_updates
        ? (s.system_updates.available || []).map((u) => `${u.title} ${u.latest}`)
        : (s.updates || []).filter((u) => u.state === 'on').map((u) => `${u.key === 'core' ? 'Core' : 'OS'} ${u.latest}`);
      if (!market && !others.length) return null;
      var repos = market?.list || [];
      var count = repos.length + others.length;
      return [
        market?.state === 'error' ? 'bad' : count ? 'warn' : 'good',
        count ? n('st_available', count) : this._t('up_to_date'),
        join([...others, ...repos.map((u) => `${u.title} ${u.latest}`)]),
      ];
    }
    if (tab === 'database') {
      var db = this._db?.data;
      if (!s.database || !db) return null;
      var dbTone = this._dbTone(db.size);
      return [
        dbTone === 'bad' ? 'warn' : dbTone || 'good',
        typeof db.size === 'number' ? shBytes(db.size) : this._t('db_days', { n: db.keep_days }),
        join([
          dbTone === 'bad' ? this._t('db_over', { n: s.database.max_size }) : '',
          this._t('db_days', { n: db.keep_days }),
          this._t('db_n_states', { n: (db.total_day ?? 0).toLocaleString(this._hass?.language) }),
          db.top?.[0] ? `${db.top[0].name} ×${db.top[0].count}` : '',
        ]),
      ];
    }
    if (tab === 'security') {
      var sc = s.security && this._scSummary();
      if (!sc) return null;
      var refusedN = sc.refused.reduce((sum, r) => sum + r.day, 0);
      return [
        sc.tone,
        sc.refused.length ? n('sc_n_refused', refusedN) : sc.unprotected.length ? n('sc_n_unprotected', sc.unprotected.length) : sc.warn ? n('sc_n_points', sc.warn) : this._t('sc_all_good'),
        join([
          ...sc.refused.slice(0, 2).map((r) => `${r.ip} ×${r.day}`),
          sc.refused.length && sc.unprotected.length ? n('sc_n_unprotected', sc.unprotected.length) : '',
          sc.noMfa.length ? n('sc_n_no_mfa', sc.noMfa.length) : '',
          sc.clear.length ? n('sc_n_in_clear', sc.clear.length) : '',
          sc.unused.length ? n('sc_n_unused', sc.unused.length) : '',
          sc.http ? this._t('sc_https_no') : '',
        ]),
      ];
    }
    if (tab === 'logs') {
      if (!s.logs || !this._lg?.entries) return null;
      // Only the frequent errors make a problem (an integration at the threshold in 24 h): an occasional error is
      // part of a normal day and stays in the Logs tab, without lowering the score
      var day = this._lgGroups('error', 'day');
      var worst = day.filter((g) => g.errors >= (s.logs.error_threshold ?? 10));
      var frequent = worst.reduce((sum, g) => sum + g.errors, 0);
      var occasional = day.reduce((sum, g) => sum + g.errors, 0) - frequent;
      if (!worst.length) return ['good', this._t('lg_no_frequent'), occasional ? n('lg_n_occasional', occasional) : ''];
      return ['bad', n('lg_n_errors', frequent), join(worst.slice(0, 3).map((g) => `${shIntegration(g.domain)} ×${g.errors}`))];
    }
    if (tab === 'silent') {
      var sl = s.silent;
      if (!sl) return null;
      var quiet = (sl.devices || []).filter((d) => d.silent);
      var weak = (sl.devices || []).filter((d) => !d.silent && d.signal?.weak);
      return [
        quiet.length ? 'warn' : weak.length ? 'info' : 'good',
        quiet.length ? n('sl_n_silent', quiet.length) : weak.length ? n('sl_n_weak', weak.length) : this._t('sl_all_heard'),
        join([...quiet.map((d) => d.name), weak.length && quiet.length ? n('sl_n_weak', weak.length) : '', quiet.length ? '' : this._t('sl_followed', { n: sl.tracked ?? 0 })]),
      ];
    }
    if (tab === 'backups') {
      if (!s.backups) return null;
      var bk = this._bkSummary();
      if (!bk) return null;
      return [
        bk.tone,
        bk.lastOk ? this._t('bk_ago', { when: this._rel(bk.lastOk) }) : this._t('bk_none'),
        join([bk.failed ? this._t('backup_failed') : '', ...bk.failing.map((a) => a.name), bk.next ? `${this._t('next_backup')} ${this._rel(bk.next)}` : '']),
      ];
    }
    if (tab === 'watchdog') {
      var wd = s.watchdog;
      if (!wd) return null;
      var unavailable = wd.unavailable || [];
      var gaveUp = unavailable.filter((u) => u.gave_up);
      return [
        gaveUp.length ? 'bad' : unavailable.length || wd.paused ? 'warn' : 'good',
        gaveUp.length ? n('st_gave_up', gaveUp.length) : unavailable.length ? n('st_unavailable', unavailable.length) : this._t('all_available'),
        join(unavailable.map((u) => `${u.title}${u.gave_up ? '' : ` ${u.reloads ?? 0}/${wd.max_reloads ?? ''}`}`)),
      ];
    }
    if (tab === 'automations') {
      var au = s.automations;
      if (!au?.available) return null;
      var failures = au.failures || [];
      var linked = au.linked || [];
      var repeated = failures.some((f) => f.consecutive_failures > 1);
      return [
        repeated ? 'bad' : failures.length || linked.length ? 'warn' : 'good',
        failures.length ? n('st_failing', failures.length) : linked.length ? n('st_unavailable', linked.length) : this._t('auto_all_ok'),
        join([...failures.map((f) => `${f.name}${f.consecutive_failures > 1 ? ` ×${f.consecutive_failures}` : ''}`), linked.length ? n('st_linked', linked.length) : '']),
      ];
    }
    if (tab === 'batteries') {
      var bat = s.batteries;
      if (!bat) return null;
      var low = (bat.batteries || []).filter((b) => b.low).sort((a, b) => (shNum(a.level) ?? 0) - (shNum(b.level) ?? 0));
      return [
        low.length ? 'warn' : bat.unavailable ? 'info' : 'good',
        low.length ? n('st_to_replace', low.length) : bat.unavailable ? n('st_unavailable', bat.unavailable) : this._t('st_all_good'),
        join(low.map((b) => `${b.name} ${Math.round(shNum(b.level) ?? 0)} %`)),
      ];
    }
    if (tab === 'git_sync') {
      var git = s.git_sync;
      if (!git || git.available === false) return null;
      // With several repositories, the one most in need of action speaks for all
      var gitRepos = (s.git_sync_repos || []).filter((r) => r.available !== false);
      var weight = (r) => (r.last_error || r.status === 'error' || (r.ahead && r.behind) ? 2 : r.changed || r.ahead || r.behind ? 1 : 0);
      if (gitRepos.length > 1) git = gitRepos.reduce((a, b) => (weight(b) > weight(a) ? b : a));
      var error = git.last_error || git.status === 'error' || (git.ahead && git.behind);
      var changed = git.changed || 0;
      return [
        error ? 'bad' : changed || git.ahead || git.behind ? 'warn' : 'good',
        error ? this._t('st_error') : changed ? n('st_changed', changed) : git.ahead ? n('st_to_push', git.ahead) : git.behind ? this._t('behind', { n: git.behind }) : this._t('clean'),
        join([git.branch, git.ahead ? this._t('ahead', { n: git.ahead }) : '', git.last_push ? this._t('st_pushed', { when: this._rel(git.last_push) }) : '']),
      ];
    }
    if (tab === 'orphans') {
      var orph = s.orphans;
      if (!orph) return null;
      var total = orph.total ?? Object.values(orph.counts || {}).reduce((a, b) => a + b, 0);
      var devices = orph.devices ?? 0;
      return [
        total || devices ? 'info' : 'good',
        total ? n('st_entities', total) : devices ? n(devices === 1 ? 'st_device' : 'st_devices', devices) : this._t('st_none'),
        join([devices ? n(devices === 1 ? 'st_device' : 'st_devices', devices) : '', orph.last_scan ? this._t('st_scanned', { when: this._rel(orph.last_scan) }) : '']),
      ];
    }
    return null;
  },

  // The areas of the Status tab, how many of each tone, the score and its tone (the ring, the emblem, the sidebar icon)
  _stTone() {
    var areas = this._tabs()
      .filter((t) => t !== 'status' && t !== 'settings')
      .map((tab) => [tab, this._stArea(tab)])
      .filter(([, a]) => a);
    var counts = { bad: 0, warn: 0, info: 0, good: 0 };
    for (var [, [tone]] of areas) counts[tone] += 1;
    var score = Math.max(0, 100 - Object.entries(counts).reduce((sum, [tone, k]) => sum + SH_STATUS_WEIGHTS[tone] * k, 0));
    return { areas, counts, score, tone: score >= 80 ? 'good' : score >= 50 ? 'warn' : 'bad' };
  },

  // The sidebar icon follows the Status tab: drawn again in this browser when its tone changes (system-hub-icons.js)
  _reportTone() {
    if (this._state?.loaded) globalThis.systemHubSetTone?.(this._stTone().tone);
  },

  _status() {
    var { areas, counts, score, tone: ringTone } = this._stTone();
    var points = counts.bad + counts.warn + counts.info;
    var r = 84;
    var circ = 2 * Math.PI * r;
    var core = (this._state.updates || []).find((u) => u.key === 'core');
    var boot = (this._state.system || []).find((x) => x.key === 'last_boot');
    var bootAt = boot ? Date.parse(boot.state) : NaN;
    var meta = [
      core?.installed ? `Home Assistant ${core.installed}` : '',
      Number.isNaN(bootAt) ? '' : this._t('st_up', { time: this._uptime(Date.now() - bootAt).replace(/<[^>]+>/g, '') }),
    ].filter(Boolean);
    var pills = [
      ['bad', 'st_n_bad'],
      ['warn', 'st_n_warn'],
      ['info', 'st_n_info'],
      ['good', 'st_n_good'],
    ]
      .filter(([tone]) => counts[tone])
      .map(([tone, key]) => `<span class="pill ${tone}">${shEsc(this._t(key, { n: counts[tone] }))}</span>`)
      .join('');
    var hero = `<ha-card class="sthero ${ringTone}">
      <div class="stscore" role="img" aria-label="${shEsc(`${score} / 100`)}"><svg viewBox="0 0 200 200" aria-hidden="true">
        <circle cx="100" cy="100" r="${r}" class="sttrack"></circle>
        <circle cx="100" cy="100" r="${r}" class="starc" stroke-dasharray="${circ}" stroke-dashoffset="${circ * (1 - score / 100)}" transform="rotate(-90 100 100)"></circle></svg>
        <div class="stnum"><b>${score}</b><span>${shEsc(this._t('st_score'))}</span></div></div>
      <div class="stbadge ${ringTone}" aria-hidden="true">${shStatusEmblem(ringTone)}</div>
      <div class="who"><div class="sttitle">${shEsc(points ? this._t(points === 1 ? 'st_point' : 'st_points', { n: points }) : this._t('st_all_good'))}</div>
        ${meta.length ? `<div class="s">${shEsc(meta.join(' · '))}</div>` : ''}<div class="stpills">${pills}</div></div></ha-card>`;
    var tile = ([tab, [tone, value, details]]) => `<button class="sttile ${tone}" data-action="st_open" data-tab="${tab}" aria-label="${shEsc(`${this._tabName(tab)}: ${value}`)}">
        <span class="stglow"></span>
        <span class="sthead"><span class="stic"><ha-icon icon="${SH_MODULE_ICONS[tab]}"></ha-icon></span><span class="stname">${shEsc(this._tabName(tab))}</span><span class="stdot"></span></span>
        <span class="stval">${shEsc(value)}</span>${details ? `<span class="stdet">${shEsc(details)}</span>` : ''}</button>`;
    // The tiles by group, under the group's name, in the order of the tabs
    var sections = this._groups()
      .map((group) => {
        var mine = areas.filter(([tab]) => shGroupOf(tab) === group);
        return mine.length ? `<h2 class="stsec">${shEsc(this._groupName(group))}</h2><div class="stgrid">${mine.map(tile).join('')}</div>` : '';
      })
      .join('');
    return `${hero}${sections}`;
  },
};

Object.assign(SystemHubPanel.prototype, SH_STATUS_METHODS);
// For the status cards (system-hub-card.js), which read the panel without showing it
SystemHubPanel.ICONS = SH_MODULE_ICONS;
SystemHubPanel.groupOf = shGroupOf;
