// Status tab: the health of the instance at a glance. A score out of 100 (100, less 15 per area needing action, 5 per
// area to watch, 1 per area with something to know), then one tile per area in the order of the tabs: its level, what
// it says in a few words, its details; a click opens its tab. Worked out here from what the panel already reads.
import { SH_MODULE_ICONS, shEsc, shGroupOf, shIntegration, shNum } from "./core.js";
import { shBytes, shTone } from "./network-graphs.js";
import { SH_THRESHOLDS, shDisks, shProcess } from "./monitor-helpers.js";
import { SystemHubPanel } from "./panel.js";

export var SH_STATUS_WEIGHTS = { bad: 15, warn: 5, info: 1, good: 0 };

// The emblem beside the score, drawn after System Hub's logo in the colour of the ring: the house with its hub (the
// modules around a centre) and a badge cut out of its roof, a pulse in good health, "!" to watch, "×" with a problem
export var SH_STATUS_GLYPHS = {
  good: '<polyline points="-34,3 -16,3 -7,-20 6,24 15,-4 34,-4" fill="none" stroke="#fff" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>',
  warn: '<line x1="0" y1="-24" x2="0" y2="6" stroke="#fff" stroke-width="12" stroke-linecap="round"/><circle cx="0" cy="25" r="7.5" fill="#fff"/>',
  bad: '<path d="M-18 -18 L18 18 M18 -18 L-18 18" stroke="#fff" stroke-width="12" stroke-linecap="round"/>',
};

export var SH_STATUS_METHODS = {
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
      var disks = shDisks(sensors);
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
          sc.obNew ? n('sc_n_outbound_new', sc.obNew) : '',
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

  // The sidebar icon and its badge follow the Status tab: drawn again in this browser when they change
  // (system-hub-icons.js). Both take the overall tone (the ring): the icon its shape, the badge its colour, so the
  // badge matches the Status emblem. The badge counts the points to check (critical, to watch and info together).
  _reportTone() {
    if (!this._state?.loaded) return;
    var { counts, tone } = this._stTone();
    globalThis.systemHubSetTone?.(tone);
    globalThis.systemHubSetBadge?.(counts.bad + counts.warn + counts.info, tone);
  },

  // The version of Home Assistant and how long it has been up: the Status header's subtitle
  _stMeta() {
    var core = (this._state.updates || []).find((u) => u.key === 'core');
    var os = (this._state.updates || []).find((u) => u.key === 'os');
    var boot = (this._state.system || []).find((x) => x.key === 'last_boot');
    var bootAt = boot ? Date.parse(boot.state) : NaN;
    return [
      core?.installed ? `Home Assistant ${core.installed}` : '',
      os?.installed ? `OS ${os.installed}` : '',
      Number.isNaN(bootAt) ? '' : this._t('st_up', { time: this._uptime(Date.now() - bootAt).replace(/<[^>]+>/g, '') }),
    ].filter(Boolean);
  },

  // The Status tab, as its mockup: the counts as tiles (in the header card), the critical areas to handle first, then
  // one compact tile per area, in four columns by group
  _status() {
    var { areas, counts, score, tone: ringTone } = this._stTone();
    var word = (key) => this._t(key, { n: '' }).replace(/\s+/g, ' ').trim();
    var kpis = [
      this._tile('mdi:heart-pulse', `<b>${score} / 100</b>`, this._t('st_score').replace(/\s*\/\s*100\s*/, '').trim() || this._t('st_score'), ringTone),
      this._tile('mdi:alert-circle-outline', `<b>${counts.bad}</b>`, word('st_n_bad'), counts.bad ? 'bad' : ''),
      this._tile('mdi:alert-outline', `<b>${counts.warn}</b>`, word('st_n_warn'), counts.warn ? 'warn' : ''),
      this._tile('mdi:layers-outline', `<b>${counts.info}</b>`, word('st_n_info'), ''),
      this._tile('mdi:check-circle-outline', `<b>${counts.good}</b>`, word('st_n_good'), ''),
    ];
    var head = `<div class="tiles stkpis">${kpis.join('')}</div>`;
    // The areas to handle first: the critical ones, else those to watch
    var worst = areas.filter(([, [tone]]) => tone === 'bad');
    if (!worst.length) worst = areas.filter(([, [tone]]) => tone === 'warn');
    var priority = worst.length
      ? `<ha-card class="list stprio"><div class="lhead"><ha-icon icon="mdi:alert-outline"></ha-icon><span class="lname">${shEsc(this._t('st_priority'))} · ${worst.length}</span><span class="muted">${shEsc(this._t('st_priority_hint'))}</span></div>
        ${worst
          .map(
            ([tab, [tone, value, details]]) => `<div class="item ${tone}"><ha-icon icon="${SH_MODULE_ICONS[tab]}"></ha-icon>
          <div class="who"><div class="n">${shEsc(value)}</div>${details ? `<div class="s">${shEsc(details.split(' · ').slice(0, 3).join(' · '))}</div>` : ''}</div>
          <span class="muted stwhere">${shEsc(this._tabName(tab))}</span><button class="act quiet" data-action="st_open" data-tab="${tab}"><ha-icon icon="mdi:chevron-right"></ha-icon>${shEsc(this._t('st_view'))}</button></div>`,
          )
          .join('')}</ha-card>`
      : '';
    var tile = ([tab, [tone, value, details]]) => `<button class="sttile ${tone}" data-action="st_open" data-tab="${tab}" aria-label="${shEsc(`${this._tabName(tab)}: ${value}`)}">
        <span class="stic"><ha-icon icon="${SH_MODULE_ICONS[tab]}"></ha-icon></span><span class="sttxt"><span class="stname">${shEsc(this._tabName(tab))}</span>
        <span class="stval">${shEsc(value)}</span>${details ? `<span class="stdet">${shEsc(details)}</span>` : ''}</span><span class="stdot"></span></button>`;
    var rank = { bad: 3, warn: 2, info: 1, good: 0 };
    // The tiles by group, under the group's name with its worst tone and its count, in the order of the tabs
    var shown = this._groups().filter((group) => areas.some(([tab]) => shGroupOf(tab) === group));
    var groups = shown
      .map((group) => {
        var mine = areas.filter(([tab]) => shGroupOf(tab) === group);
        var gtone = mine.reduce((w, [, [t]]) => (rank[t] > rank[w] ? t : w), 'good');
        return `<section class="stgroup"><h2 class="stsec"><span class="stgdot ${gtone}"></span>${shEsc(this._groupName(group))}<span class="muted">${mine.length}</span></h2><div class="stgrid">${mine.map(tile).join('')}</div></section>`;
      })
      .join('');
    // One column per group shown, five at most (narrow screens: their own columns)
    return `${head}${priority}<div class="stgroups" style="--stcols:${Math.min(5, Math.max(1, shown.length))}">${groups}</div>`;
  },
};

Object.assign(SystemHubPanel.prototype, SH_STATUS_METHODS);
// For the status cards (system-hub-card.js), which read the panel without showing it
SystemHubPanel.ICONS = SH_MODULE_ICONS;
SystemHubPanel.groupOf = shGroupOf;
