// Security tab (Security module): refused logins, accounts and 2FA, long-lived tokens (Revoke), exposure, add-ons,
// credentials written in clear and, when tracked, the outbound connections by integration. Everything comes from
// system_hub/security, read when the tab is shown (every 5 minutes at most); its commands go through _scCall.
import { shErr, shEsc, shTabBase } from "./core.js";
import { SystemHubPanel } from "./panel.js";

export var SH_SECURITY_METHODS = {
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
    if (shTabBase(this._tab) === 'security' || rescan) this._render();
  },

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
    // Outbound connections (when tracked): a host new for an integration, until marked as known
    var obNew = (d.outbound?.integrations || []).reduce((n, g) => n + g.new, 0);
    var bad = refused.length + bans.length + unprotected.length;
    var warn = noMfa.length + unused.length + clear.length + (http ? 1 : 0) + obNew;
    return { refused, bans, unprotected, noMfa, admins, unused, clear, http, obNew, bad, warn, tone: bad ? 'bad' : warn ? 'warn' : 'good' };
  },

  _scWhen(ts) {
    return ts ? this._rel(new Date(ts * 1000).toISOString()) : this._t('never');
  },

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
  },

  _scIgnore(ip, ignore) {
    return this._scCall(`sc_ignore:${ip}`, { type: 'system_hub/security_ignore', ip, ignore });
  },

  _scRevoke(token) {
    this._confirm = null;
    return this._scCall(`sc_revoke:${token}`, { type: 'system_hub/security_revoke', token_id: token }, true);
  },

  _scList(icon, title, count, rows, note) {
    return `<ha-card class="list"><div class="lhead"><ha-icon icon="${icon}"></ha-icon><span class="lname">${shEsc(title)}</span><span class="muted">${shEsc(count)}</span></div>${rows}${
      note ? `<div class="scnote">${note}</div>` : ''
    }</ha-card>`;
  },

  _scRow(icon, name, sub, tone = '', end = '') {
    return `<div class="item${tone ? ` ${tone}` : ''}"><ha-icon icon="${icon}"></ha-icon><div class="who"><div class="n">${name}</div><div class="s">${sub}</div></div>${end}</div>`;
  },

  // The tone of a sub-tab of Security (its dot): Logins — refusals from the Internet, bans, an external URL without
  // HTTPS; Accounts — admins without 2FA, unused tokens; Add-ons & config — add-ons not protected, credentials in
  // clear; Outbound — new hosts
  _scSubTone(sub) {
    var s = this._scSummary();
    if (!s) return null;
    var tone = (bad, warn) => (bad ? 'bad' : warn ? 'warn' : 'good');
    if (sub === 'security_accounts') return tone(0, s.noMfa.length + s.unused.length);
    if (sub === 'security_system') return tone(s.unprotected.length, s.clear.length);
    if (sub === 'security_outbound') return tone(0, s.obNew);
    return tone(s.refused.length + s.bans.length, s.http ? 1 : 0);
  },

  // Security, by sub-tab: Logins (refused logins, exposure), Accounts (accounts, long-lived tokens with Revoke),
  // Add-ons & config (add-ons, credentials in clear), Outbound (the hosts contacted by integration). Each opens on its
  // tiles, then Scan now and Configure
  _security(sub = 'security') {
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
    var tile = {
      refused: this._tile('mdi:shield-alert-outline', `<b>${day}</b>`, this._t('sc_refused_day'), sum.refused.length || sum.bans.length ? 'bad' : day ? 'warn' : 'good'),
      mfa: this._tile('mdi:account-key-outline', shEsc(this._t('sc_n_of', { n: sum.noMfa.length, total: sum.admins.length })), this._t('sc_admins_no_mfa'), sum.noMfa.length ? 'warn' : 'good'),
      tokens: this._tile(
        'mdi:key-chain-variant',
        `<b>${(d.tokens || []).length}</b>${sum.unused.length ? ` · ${shEsc(this._t('sc_tokens_unused', { n: sum.unused.length }))}` : ''}`,
        this._t('sc_tokens'),
        sum.unused.length ? 'warn' : '',
      ),
      exposure: this._tile(
        'mdi:web',
        shEsc(ex.external_url ? (ex.https ? 'HTTPS' : 'HTTP') : '—'),
        ex.external_url ? ex.external_url.replace(/^https?:\/\//, '') : this._t('sc_no_external'),
        ex.external_url ? (ex.https ? 'good' : 'warn') : '',
      ),
      outbound: d.outbound
        ? this._tile(
            'mdi:lan-connect',
            `<b>${d.outbound.hosts}</b>${sum.obNew ? ` · ${shEsc(this._t('sc_ob_new_n', { n: sum.obNew }))}` : ''}`,
            this._t('sc_ob_hosts'),
            sum.obNew ? 'warn' : '',
          )
        : '',
    };
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

    var tilesOf = (...keys) => {
      var shown = keys.map((k) => tile[k]).filter(Boolean);
      return shown.length ? `<div class="tiles">${shown.join('')}</div>` : '';
    };
    var two = (a, b) => `<div class="sctwo">${a}${b}</div>`;
    var accountsCard = this._scList('mdi:account-group-outline', this._t('sc_accounts'), String((d.users || []).length), users);
    var tokensCard = (d.tokens || []).length ? this._scList('mdi:key-chain-variant', this._t('sc_tokens'), String(d.tokens.length), tokens, shEsc(this._t('sc_tokens_note'))) : '';
    if (sub === 'security_accounts') return `${tilesOf('mfa', 'tokens')}${actions}${two(accountsCard, tokensCard)}`;
    if (sub === 'security_system') return `${actions}${two(addonsCard, configCard)}`;
    if (sub === 'security_outbound') return `${tilesOf('outbound')}${actions}${this._scOutbound(d.outbound, pill)}`;
    return `${tilesOf('refused', 'exposure')}${actions}${two(refusedCard, this._scList('mdi:web', this._t('sc_exposure'), '', exposure))}`;
  },

  // The integrations whose hosts are unfolded: as chosen, else those with a new host
  _scObOpen(ob) {
    return (this._scOb ??= { filter: 'all', open: null }).open ?? new Set((ob?.integrations || []).filter((g) => g.new).map((g) => g.domain));
  },

  // Outbound connections, by integration (folded, those with a new host unfolded): its hosts, the new ones first, each
  // marked as known or ignored; a filter on the new ones, the custom integrations or the ignored hosts. Not tracked:
  // where to turn it on
  _scOutbound(ob, pill) {
    var head = (extra = '') =>
      `<div class="lhead"><ha-icon icon="mdi:lan-connect"></ha-icon><span class="lname">${shEsc(this._t('sc_outbound'))}</span>${extra}</div>`;
    if (!ob) return `<ha-card class="list">${head()}<div class="scnote">${shEsc(this._t('sc_ob_off'))}</div></ha-card>`;
    var st = (this._scOb ??= { filter: 'all', open: null });
    var open = this._scObOpen(ob);
    var all = ob.integrations;
    var count = (test) => all.reduce((n, g) => n + g.hosts.filter(test).length, 0);
    var newN = count((h) => h.new);
    var ignoredN = count((h) => h.ignored);
    var filters = [
      ['all', this._t('sc_ob_all')],
      ['new', `${this._t('sc_ob_new')} · ${newN}`],
      ['custom', this._t('sc_ob_custom_only')],
      ['ignored', `${this._t('sc_ignored')} · ${ignoredN}`],
    ]
      .map(([key, label]) => `<button class="seg${st.filter === key ? ' active' : ''}" data-action="sc_ob_filter" data-filter="${key}" aria-pressed="${st.filter === key}">${shEsc(label)}</button>`)
      .join('');
    var markAll = newN
      ? this._button('sc_ob_mark', 'mdi:check-all', this._t('sc_ob_all_known'), { quiet: true, busy: this._busy['sc_ob:'], data: { mark: 'known' } })
      : '';
    var groups = all
      .filter((g) => st.filter !== 'custom' || g.custom)
      .map((g) => ({ ...g, shown: g.hosts.filter((h) => (st.filter === 'ignored' ? h.ignored : !h.ignored && (st.filter !== 'new' || h.new))) }))
      .filter((g) => g.shown.length);
    var rows = groups
      .map((g) => {
        var isOpen = open.has(g.domain);
        // Asked from no integration's code (a library's background task, say): neither custom nor core
        var none = g.domain === '_unattributed';
        if (none) g = { ...g, name: this._t('sc_ob_unattributed') };
        var label = this._t(isOpen ? 'sc_ob_fold' : 'sc_ob_unfold', { name: g.name });
        var sub = this._t('sc_ob_group_sub', { hosts: g.hosts.filter((h) => !h.ignored).length, n: g.count.toLocaleString(this._hass?.language), when: this._scWhen(g.last) });
        var end = (g.new ? pill(this._t('sc_ob_new_n', { n: g.new }), 'warn') : '') + (none ? '' : pill(this._t(g.custom ? 'sc_ob_custom' : 'sc_ob_core'), g.custom ? 'info' : ''));
        var row = `<div class="item obgrp${g.new ? ' warn' : ''}"><button class="icon-btn" data-action="sc_ob_open" data-domain="${shEsc(g.domain)}" aria-expanded="${isOpen}" title="${shEsc(label)}" aria-label="${shEsc(label)}"><ha-icon icon="mdi:chevron-${isOpen ? 'down' : 'right'}"></ha-icon></button>
          <div class="avatar${g.custom ? ' info' : ''}"><ha-icon icon="${none ? 'mdi:help-circle-outline' : 'mdi:puzzle-outline'}"></ha-icon></div><div class="who"><div class="n">${shEsc(g.name)}</div><div class="s">${shEsc(sub)}</div></div>${end}</div>`;
        var hosts = isOpen
          ? g.shown
              .map((h) => {
                var hsub = [
                  h.ports.join(', '),
                  h.local ? this._t('sc_local') : '',
                  this._t('sc_ob_connections', { n: h.count.toLocaleString(this._hass?.language) }),
                  h.new ? this._t('sc_ob_first', { when: this._scWhen(h.first) }) : this._t('sc_last', { when: this._scWhen(h.last) }),
                ].filter(Boolean);
                var key = `sc_ob:${g.domain}|${h.host}`;
                var hend =
                  (h.new
                    ? pill(this._t('sc_ob_new'), 'warn') +
                      this._button('sc_ob_mark', 'mdi:check', this._t('sc_ob_known'), { quiet: true, busy: this._busy[key], data: { mark: 'known', host: h.host, domain: g.domain } })
                    : '') +
                  this._button('sc_ob_mark', h.ignored ? 'mdi:eye-outline' : 'mdi:eye-off-outline', this._t(h.ignored ? 'sc_unignore' : 'sc_ignore'), {
                    quiet: true,
                    busy: this._busy[`sc_ob:${h.host}`],
                    data: { mark: h.ignored ? 'unignore' : 'ignore', host: h.host },
                  });
                var icon = h.new ? 'mdi:alert-outline' : h.local ? 'mdi:lan' : 'mdi:web';
                return `<div class="item obhost${h.new ? ' warn' : ''}"><ha-icon icon="${icon}"></ha-icon><div class="who"><div class="n"><code>${shEsc(h.host)}</code></div><div class="s">${shEsc(hsub.join(' · '))}</div></div>${hend}</div>`;
              })
              .join('')
          : '';
        return `${row}${hosts}`;
      })
      .join('<div class="obsep"></div>');
    var notes = [
      ob.aiohttp === false ? this._t('sc_ob_partial') : '',
      ob.learning_until ? this._t('sc_ob_learning', { when: this._scWhen(ob.learning_until) }) : '',
      this._t('sc_ob_note', { ms: (ob.cost_us / 1000).toLocaleString(this._hass?.language, { maximumFractionDigits: 1 }), n: ob.connections.toLocaleString(this._hass?.language) }),
    ].filter(Boolean);
    var countLabel = this._t('sc_ob_summary', { integrations: all.length, hosts: ob.hosts });
    return `<ha-card class="list">${head(`<span class="muted">${shEsc(countLabel)}</span>`)}
      <div class="obsegs"><div class="segs" role="group" aria-label="${shEsc(this._t('sc_outbound'))}">${filters}</div><span class="grow"></span>${markAll}</div>
      ${rows || this._scRow('mdi:check-circle-outline', '', shEsc(this._t('sc_ob_none')))}<div class="scnote">${notes.map(shEsc).join(' ')}</div></ha-card>`;
  },

  // A Security action (a button whose action starts with sc_): its result, or false when the action is not one of them
  _scClick(button, action) {
    if (action === 'sc_scan') return this._scLoad(true, true);
    if (action === 'sc_ignore') return this._scIgnore(button.dataset.ip, button.dataset.ignore !== 'false');
    if (action === 'sc_revoke_confirm') {
      this._confirm = `sc_revoke:${button.dataset.token}`;
      return this._render();
    }
    if (action === 'sc_revoke') return this._scRevoke(button.dataset.token);
    if (action === 'sc_ob_filter') {
      (this._scOb ??= { filter: 'all', open: null }).filter = button.dataset.filter;
      return this._render();
    }
    if (action === 'sc_ob_open') {
      // Read before it is set: _scObOpen creates this._scOb when there is none yet
      var obOpen = new Set(this._scObOpen(this._sc?.data?.outbound));
      this._scOb.open = obOpen;
      if (obOpen.has(button.dataset.domain)) obOpen.delete(button.dataset.domain);
      else obOpen.add(button.dataset.domain);
      return this._render();
    }
    if (action === 'sc_ob_mark') {
      var obMsg = { type: 'system_hub/security_outbound', action: button.dataset.mark };
      if (button.dataset.host) obMsg.host = button.dataset.host;
      if (button.dataset.domain) obMsg.domain = button.dataset.domain;
      var obKey = button.dataset.mark === 'known' && obMsg.host ? `${obMsg.domain}|${obMsg.host}` : obMsg.host || '';
      return this._scCall(`sc_ob:${obKey}`, obMsg);
    }
    if (action === 'sc_allow') {
      var allow = button.dataset.allow !== 'false';
      return this._scCall(`sc_allow:${button.dataset.slug}`, { type: 'system_hub/security_allow_addon', slug: button.dataset.slug, allow });
    }
    return false;
  },
};

Object.assign(SystemHubPanel.prototype, SH_SECURITY_METHODS);
