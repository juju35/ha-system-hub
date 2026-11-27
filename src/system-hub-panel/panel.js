// ── End of the folded top bar ──
import { SH_AUTO_MAX, SH_DOMAIN, SH_GIT_FILES_MAX, SH_GROUPS, SH_SUBTAB_ICONS, SH_SUBTABS, SH_MODULE_ICONS, SH_MODULE_NAMES, SH_REFRESH_MS, SH_RETRY_MS, SYSTEM_HUB_PANEL_VERSION, shChange, shErr, shEsc, shExcerpt, shFocusSelector, shGroupOf, shGroupTabs, shHue, shIntegration, shNum, shProject, shTabBase } from "./core.js";
import { SH_NET_RANK, shBytes, shMatterGraph, shNetBox, shNetForce, shNetTree, shSignal, shSpark, shTone, shZ2mGraph, shZhaGraph, shZwaveGraph } from "./network-graphs.js";
import { SH_BUTTONS, SH_DEFAULT_SHORTCUTS, SH_HIDE_BAR_KEY, SH_SHORTCUTS } from "./diff-dialog.js";
import { SH_BUCKETS, SH_COLORS, SH_ORPHANS_STYLE, SH_THRESHOLDS, SH_VIRTUAL_IF, shArea, shBuckets, shDiskPct, shDisks, shIface, shMount, shNiceMax, shPoints, shProcess, shRate, shRound } from "./monitor-helpers.js";
import { systemHubPanelFold } from "./fold.js";
import { SH_BANNER_STYLE } from "./banner-style.js";

export class SystemHubPanel extends HTMLElement {
  static VERSION = SYSTEM_HUB_PANEL_VERSION;

  static STYLE = `
    :host { display:block; min-height:100%; background:var(--primary-background-color); color:var(--primary-text-color);
            --tone-good: var(--success-color, #43a047); --tone-warn: var(--warning-color, #ffa600); --tone-bad: var(--error-color, #db4437); }
    /* The top bar: the tab's illustrated banner, full width, the menu button before its icon */
    .topbar:empty { display:none; }
    .topbar .shhead { padding-left:4px; gap:6px; right:calc(min(360px, 44%) + var(--acts) + 8px); }
    .topbar .bmenu { flex:none; color:inherit; }
    /* As the other ha-* panels: a neutral wall and the wooden floor (the status is the badge's and the pill's), the
       title at 20 px, the buttons as frosted rounds at the right, centred on the wall, the scene left of them */
    .topbar .shbanner { --acts:96px; background:#f2efe9; }
    .topbar .shbanner.night { background:#2a2b33; }
    .topbar .shbanner:has(.shzooms > :nth-child(3)) { --acts:136px; }
    .topbar .shground { background:repeating-linear-gradient(90deg, #c99a6b 0 38px, #b98a5c 38px 40px); box-shadow:inset 0 2px 0 #a97c50; }
    .topbar .night .shground { background:repeating-linear-gradient(90deg, #4a3a2c 0 38px, #3e3024 38px 40px); box-shadow:inset 0 2px 0 #5a4634; }
    .topbar .shscene { right:var(--acts); }
    .topbar .shtitle { font-size:20px; }
    .topbar .shzooms { top:calc((100% - 10px) / 2 - 17px); right:12px; gap:6px; }
    .topbar .shzoom { width:34px; height:34px; --mdc-icon-size:20px; }
    .topbar .shzoom:hover { background:rgba(255,255,255,.82); }
    @container (max-width:560px) { .topbar .shscene { display:none; } .topbar .shhead { right:var(--acts); } }
    /* The tabs under it, on the page's background */
    .tabsbar { display:flex; background:var(--primary-background-color); color:var(--primary-text-color); position:sticky; top:0; z-index:2;
               border-bottom:1px solid var(--divider-color, rgba(127,127,127,.2)); }
    .tabs { flex:1; min-width:0; display:flex; gap:4px; padding:0 12px; overflow-x:auto; }
    /* Settings → Hide the top bar: the tabs at the top; on a phone, the menu button beside them */
    .tabmenu { display:none !important; }
    :host([hide-bar]) .topbar { display:none; }
    :host([hide-bar][narrow]) .tabmenu { display:flex !important; align-self:center; margin-left:4px; }
    :host([hide-bar][narrow]) .tabs { padding-left:0; }
    .tab { background:none; border:none; border-bottom:2px solid transparent; color:var(--secondary-text-color);
           padding:12px 14px; font:inherit; font-size:14px; font-weight:500; cursor:pointer; white-space:nowrap; }
    .tab:hover, .tab:focus-visible { color:var(--primary-text-color); outline:none; }
    .tab.active { color:var(--primary-text-color); border-bottom-color:var(--primary-color); }
    .tbadge { display:inline-flex; align-items:center; justify-content:center; min-width:18px; height:18px; padding:0 6px; margin-left:6px;
              box-sizing:border-box; border-radius:9px; font-size:11px; font-weight:500; line-height:1;
              color:color-mix(in srgb, var(--tone-warn) 70%, var(--primary-text-color)); background:color-mix(in srgb, var(--tone-warn) 20%, transparent); }
    .tbadge.bad { color:var(--tone-bad); background:color-mix(in srgb, var(--tone-bad) 15%, transparent); }
    .tbadge.info { color:var(--info-color, #039be5); background:color-mix(in srgb, var(--info-color, #039be5) 15%, transparent); }
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
    .note.shstale { flex-direction:row; flex-wrap:wrap; align-items:center; margin-bottom:12px; color:var(--primary-text-color);
                    border-left:3px solid var(--tone-warn); }
    .note.shstale > ha-icon { color:var(--tone-warn); }
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
    .act.sc { text-decoration:none; padding-inline:9px; }
    .act[disabled] { opacity:.5; cursor:default; }
    .act[aria-busy="true"] { opacity:.8; cursor:progress; }
    .act.danger { color:var(--error-color, #db4437); background:color-mix(in srgb, var(--error-color, #db4437) 12%, transparent); }
    .act.danger:hover:not([disabled]) { background:color-mix(in srgb, var(--error-color, #db4437) 20%, transparent); }
    .spin { animation:sh-spin 1s linear infinite; }
    .stgrid { display:grid; grid-template-columns:repeat(auto-fill, minmax(230px, 1fr)); gap:12px; }
    .sttile { position:relative; overflow:hidden; display:flex; flex-direction:column; align-items:stretch; gap:8px; text-align:left; cursor:pointer;
              padding:16px; border-radius:var(--ha-card-border-radius, 12px); border:1px solid var(--divider-color, rgba(127,127,127,.15));
              background:var(--card-background-color, #fff); color:var(--primary-text-color); font:inherit; }
    .sttile:hover { border-color:color-mix(in srgb, var(--tone) 50%, transparent); }
    .sttile:focus-visible { outline:2px solid var(--primary-color); outline-offset:2px; }
    .stic { width:38px; height:38px; border-radius:11px; display:flex; align-items:center; justify-content:center; flex:none; --mdc-icon-size:22px;
            color:var(--tone); background:color-mix(in srgb, var(--tone) 16%, transparent); }
    .stname { flex:1; font-size:14px; font-weight:500; }
    .stdot { width:9px; height:9px; border-radius:50%; background:var(--tone); box-shadow:0 0 8px var(--tone); }
    .stval { position:relative; font-size:19px; font-weight:500; }
    .stdet { position:relative; font-size:12px; color:var(--secondary-text-color); line-height:1.4;
             display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
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
    .obgrp .avatar { width:36px; height:36px; --mdc-icon-size:20px; }
    .obgrp .who .n { font-weight:500; }
    .obhost { padding-left:62px; }
    .obsegs { padding:2px 14px 8px; display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
    .obsep { height:1px; margin:0 14px; background:var(--divider-color, rgba(127,127,127,.15)); }
    .sctwo { display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:12px; align-items:start; }
    .list code { font-family:var(--code-font-family, monospace); font-size:12px; }
    .dbrow { width:100%; border:0; background:none; font:inherit; color:inherit; text-align:left; cursor:pointer; }
    .dbrow.on { background:rgba(var(--rgb-primary-color, 3,169,244), .08); }
    .dbrow .who { flex:1; min-width:0; }
    .dbdev { display:flex; align-items:center; padding-right:6px; }
    .dbdev.on { background:rgba(var(--rgb-primary-color, 3,169,244), .08); }
    .dbdev .dbrow { flex:1; min-width:0; }
    .dbdev .dbfold-space { width:36px; flex:none; }
    /* A table of the database: aligned with the devices' counts above (their chevron's room kept) */
    .dbtable { padding-right:56px; }
    .dbtable .who { flex:1; min-width:0; }
    .dbtable .dbcount { flex:none; }
    .dbents { border-left:2px solid var(--divider-color, rgba(127,127,127,.2)); margin-left:24px; padding-right:42px; }
    .dbent { padding-left:14px; }
    .dbent .n { font-size:13px; }
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
    .mkcard { position:relative; overflow:hidden; }
    .mkbar { position:absolute; left:0; right:0; bottom:0; height:3px; border-radius:0; }
    .mkbar > span { border-radius:0; }
    .mkpct { font-size:13px; font-weight:500; font-variant-numeric:tabular-nums; color:var(--primary-text-color); }
    .mkpct.muted { font-weight:400; color:var(--secondary-text-color); }
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
    .bgroups.bylevel { columns:2 300px; column-gap:16px; }
    .bgroups.bylevel .glist { grid-template-columns:minmax(0, 1fr); }
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
    .nviews { margin-bottom:12px; width:fit-content; }
    .nbar { display:flex; flex-wrap:wrap; gap:6px; align-items:center; }
    .nmap { position:relative; padding:0; overflow:hidden; }
    .nsvg { display:block; width:100%; height:min(720px, 72vh); cursor:grab; user-select:none; touch-action:none; }
    .nsvg:active { cursor:grabbing; }
    .nsearch { position:absolute; top:12px; left:12px; z-index:1; display:flex; align-items:center; gap:6px; padding:0 10px; height:36px;
               width:min(260px, calc(100% - 80px)); box-sizing:border-box; border:1px solid var(--divider-color, rgba(127,127,127,.3)); border-radius:8px;
               background:var(--card-background-color, #fff); --mdc-icon-size:18px; color:var(--secondary-text-color); }
    .nsearch input { flex:1; min-width:0; border:0; outline:none; background:none; font:inherit; font-size:14px; color:var(--primary-text-color); }
    .ntools { position:absolute; top:12px; right:12px; z-index:1; display:flex; flex-direction:column; gap:6px; }
    .ntool { width:36px; height:36px; display:flex; align-items:center; justify-content:center; border-radius:8px; cursor:pointer; font:inherit; font-size:16px;
             border:1px solid var(--divider-color, rgba(127,127,127,.3)); background:var(--card-background-color, #fff); color:var(--secondary-text-color); --mdc-icon-size:20px; }
    .ntool.on { color:var(--primary-color); border-color:var(--primary-color); }
    .ntool ha-icon[icon="mdi:loading"] { animation:sh-spin 1s linear infinite; }
    .nl { stroke:var(--disabled-text-color, #9e9e9e); stroke-width:1.5; fill:none; vector-effect:non-scaling-stroke; }
    .nl.end { stroke-dasharray:8 6; }
    .nl.mesh { stroke-dasharray:2 5; opacity:.5; stroke-width:1.5; }
    .nl.good { stroke:var(--tone-good); } .nl.warn { stroke:var(--tone-warn); } .nl.bad { stroke:var(--tone-bad); }
    .nl.thread { stroke:#8e6fd6; } .nl.ip { stroke:#f2a03d; }
    .nl.gone { stroke:var(--tone-bad); stroke-dasharray:4 6; }
    .na { fill:var(--disabled-text-color, #9e9e9e); } .na.good { fill:var(--tone-good); } .na.warn { fill:var(--tone-warn); }
    .na.bad, .na.gone { fill:var(--tone-bad); } .na.thread { fill:#8e6fd6; } .na.ip { fill:#f2a03d; }
    .nn { cursor:pointer; } .nn circle, .nn rect { fill:#26a69a; stroke:var(--card-background-color, #fff); stroke-width:2; }
    .nn.coordinator rect, .nn.coordinator circle { fill:var(--primary-color); } .nn.thread rect { fill:#8e6fd6; } .nn.ip rect { fill:#f2a03d; }
    .nn.router circle { fill:#4fb3e0; } .nn.silent circle, .nn.silent rect { fill:var(--tone-bad); }
    .nn .nring { fill:none; stroke:none; }
    .nn.sel .nring, .nn.hit .nring { stroke:var(--primary-color); stroke-width:3; }
    .nn text { font-size:16px; fill:var(--primary-text-color); pointer-events:none; paint-order:stroke;
               stroke:var(--card-background-color, #fff); stroke-width:4px; stroke-linejoin:round; }
    .nn text.sub { font-size:13px; fill:var(--secondary-text-color); }
    .nn.silent text { fill:var(--tone-bad); }
    .nsvg.dense text.sub { display:none; }
    .nsvg.crowded .nn.end:not(.sel):not(.hit):not(.near):not(.silent) text { display:none; }
    .nl.dim, .nn.dim { opacity:.12; }
    .nsvg.focusing .nn:not(.near), .nsvg.focusing .nl:not(.near) { opacity:.1; }
    .nsvg.focusing .nl.near { opacity:1; }
    .ntip { position:absolute; z-index:2; pointer-events:none; max-width:280px; padding:10px 12px; border-radius:8px; font-size:12px; line-height:1.5;
            background:var(--card-background-color, #fff); color:var(--primary-text-color); border:1px solid var(--divider-color, rgba(127,127,127,.3));
            box-shadow:0 4px 16px rgba(0,0,0,.25); }
    .ntip b { display:block; font-size:13px; margin-bottom:2px; }
    .ntip span { color:var(--secondary-text-color); margin-right:6px; }
    .ntip span::after { content:':'; }
    .nlegend { display:flex; flex-wrap:wrap; justify-content:center; gap:6px 16px; padding:8px 12px 12px; font-size:12px; color:var(--secondary-text-color); }
    .nlegend span { display:inline-flex; align-items:center; gap:6px; }
    .nlegend .nd { width:11px; height:11px; border-radius:50%; background:#26a69a; }
    .nlegend .nd.sq { border-radius:3px; } .nlegend .nd.coordinator { background:var(--primary-color); } .nlegend .nd.thread { background:#8e6fd6; }
    .nlegend .nd.ip { background:#f2a03d; } .nlegend .nd.router { background:#4fb3e0; } .nlegend .nd.silent { background:var(--tone-bad); }
    .nlegend .nlq { flex-basis:100%; justify-content:center; }
    .ntree { margin-top:12px; padding:4px 6px; }
    .ntoggle { display:flex; align-items:center; gap:6px; width:100%; border:0; background:none; font:inherit; font-size:14px; font-weight:500;
               color:var(--primary-text-color); padding:8px; cursor:pointer; --mdc-icon-size:20px; }
    .nrows { display:flex; flex-direction:column; gap:1px; padding-bottom:6px; }
    .nrow ha-icon { color:var(--secondary-text-color); } .nrow.silent ha-icon { color:var(--tone-bad); }
    .nrow { display:flex; align-items:center; gap:6px; width:100%; border:0; background:none; font:inherit; font-size:13px; text-align:left;
            color:var(--primary-text-color); padding:6px 8px; border-radius:8px; cursor:pointer; --mdc-icon-size:18px; }
    .nrow:hover { background:color-mix(in srgb, var(--primary-color) 8%, transparent); }
    .nrow.sel { background:color-mix(in srgb, var(--primary-color) 16%, transparent); }
    .nrow.silent { color:var(--tone-bad); }
    .nrow .nn-name { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .nrow .s { font-size:12px; color:var(--secondary-text-color); }
    .ndetail { display:flex; flex-wrap:wrap; align-items:center; gap:10px; padding:10px 14px; margin-top:12px; }
    .ndetail .who { flex:1; min-width:200px; } .ndetail .ndact { display:flex; gap:6px; }
    .ndetail.silent .n { color:var(--tone-bad); }
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
    // By level: the view chosen lasts while the Batteries tab is shown (see _resetTabState)
    this._battView = 'level';
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
    this._menus?.forEach((menu) => {
      menu.hass = hass;
    });
    if (first) this._start();
    else if (hass.language !== language) this._loadStrings();
    else this._updLiveChanged();
  }

  // The Updates tab shown: drawn again when an update starts, moves on (update_percentage) or ends, between two reads
  // of the state, so the progress of each install follows the entity (issue #109)
  _updLiveChanged() {
    if (this._tab !== 'marketplace' || !this._state) return;
    var ids = [...(this._state.marketplace?.list || []), ...(this._state.system_updates?.available || [])].map((u) => u.entity_id);
    var key = ids
      .map((id) => {
        var attrs = this._hass.states?.[id]?.attributes || {};
        return `${id}:${attrs.in_progress ?? ''}:${attrs.update_percentage ?? ''}`;
      })
      .join('|');
    if (key === this._updLiveKey) return;
    var seen = this._updLiveKey !== undefined;
    this._updLiveKey = key;
    if (seen) this._render();
  }

  // An update as its entity says now: installing (in_progress) and the share done (update_percentage, else a number in
  // in_progress as before Home Assistant 2024.11), null when it doesn't report its progress
  _updLive(entityId) {
    var attrs = this._hass?.states?.[entityId]?.attributes || {};
    var installing = Boolean(attrs.in_progress);
    var raw = attrs.update_percentage ?? (typeof attrs.in_progress === 'number' ? attrs.in_progress : null);
    var pct = installing && typeof raw === 'number' && Number.isFinite(raw) ? Math.max(0, Math.min(100, Math.round(raw))) : null;
    return { installing, pct };
  }

  // Installs started: the state read again soon, after which it is read every 2 seconds while they run
  _kickLoad() {
    clearTimeout(this._kick);
    this._kick = setTimeout(() => this.isConnected && this._load(), 1000);
  }

  set narrow(narrow) {
    this._narrow = narrow;
    this.toggleAttribute('narrow', Boolean(narrow));
    this._menus?.forEach((menu) => {
      menu.narrow = narrow;
    });
  }

  // Settings → Hide the top bar: for no one (off), everyone (all) or the users who are not administrators (non_admin)
  // Until the state is read, the choice last seen in this browser: the bar does not show for a moment on load, then go
  _applyHeader() {
    var hidden;
    if (this._state?.loaded) {
      var mode = this._state.hide_header || 'off';
      hidden = mode === 'all' || (mode === 'non_admin' && !this._hass?.user?.is_admin);
      try {
        localStorage.setItem(SH_HIDE_BAR_KEY, hidden ? '1' : '0');
      } catch (_err) {
        // no storage (private mode): the bar may show for a moment on the next load
      }
    } else {
      try {
        hidden = localStorage.getItem(SH_HIDE_BAR_KEY) === '1';
      } catch (_err) {
        hidden = false;
      }
    }
    this.toggleAttribute('hide-bar', hidden);
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
    if (!this._fold && this.shadowRoot?.querySelector?.(".topbar")) this._attachFold();
      if (!document.hidden) this._load();
    }, SH_REFRESH_MS);
    if (this._hass && this._state) this._load();
    document.addEventListener?.('visibilitychange', this._onVisible);
  }

  disconnectedCallback() {
    clearInterval(this._timer);
    this._fold?.detach();
    this._fold = null;
    clearTimeout(this._fast);
    clearTimeout(this._kick);
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
      // A check or installs running on the Marketplace tab: their progress every 2 seconds rather than every 10
      clearTimeout(this._fast);
      var mkBusy = this._state?.marketplace?.state === 'running' || this._state?.marketplace?.installing_updates;
      if (mkBusy && this._tab === 'marketplace' && this.isConnected) {
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
      // The Purge tab shown: its folders scanned again every minute at most
      if (this._state?.purge && (this._routeTab || this._tab) === 'purge') await this._pgLoad();
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
    var shown = shGroupTabs(this._state.tabs).filter((t) => t === 'status' || t === 'system' || modules.includes(t));
    // A module whose sections are sub-tabs: its sub-tabs in its place
    return [...shown.flatMap((t) => SH_SUBTABS[t] || [t]), 'settings'];
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
    // A group of one module (its sections as sub-tabs, or none) goes by the module's name
    if (SH_GROUPS[group].length === 1 || SH_SUBTABS[group]) return this._tabName(group);
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

  // A tab, or a group (its first sub-tab)
  _selectTab(tab, focus) {
    var tabs = this._tabs();
    if (!tabs.includes(tab) && SH_GROUPS[tab]) tab = this._groupTabs(tab)[0];
    var chosen = tabs.includes(tab) ? tab : tabs[0];
    if (chosen !== this._tab) {
      if (this._tab) this._resetTabState();
      this._tab = chosen;
      this._render();
    }
    if (focus) this.shadowRoot.querySelector(focus === 'sub' ? `[data-subtab="${chosen}"]` : `[data-group="${shGroupOf(chosen)}"]`)?.focus({ preventScroll: true });
  }

  // Another tab shown: what was typed, chosen, sorted, ticked, unfolded or asked in the one left goes, so that every tab
  // opens in its default state. Kept: what was read (the data and their caches) and the actions still running.
  _resetTabState() {
    // Search fields, filters, the commit message, the stock form, unsaved Settings orders
    this._draft = {};
    this._messages = {};
    this._confirm = null;
    this._haCheck = null;
    // Database: devices ticked and unfolded
    this._dbSel = null;
    this._dbOpen = null;
    // Automations: lists folded and shortened again
    this._autoFolds = {};
    // Security: the outbound connections' filter and integrations unfolded
    this._scOb = null;
    this._autoMore = {};
    // Silent devices: the filter, the list view, the device picked and Silent only on a network; Batteries: the view (by level); Resources: the curves' periods
    this._slFilter = null;
    this._slView = 'list';
    this._slSel = null;
    this._slOnly = false;
    this._slBox = null;
    this._slLabels = true;
    this._slTreeOpen = false;
    this._battView = 'level';
    this._periods = {};
    // Updates: Back up before installing back to its setting
    this._updBackup = undefined;
    // Versioning: the first repository, the changed files folded as by default; the stock form closed
    this._gitRepo = undefined;
    this._gitFilesOpen = undefined;
    this._stockForm = false;
    // Cleanup: nothing ticked, the list shortened, no question
    if (this._orphState) Object.assign(this._orphState, { sel: new Set(), dsel: new Set(), all: false, confirm: null });
    // Settings: a module's settings form closed (its flow aborted)
    if (this._cfg?.module) {
      this._cfgAbort();
      Object.assign(this._cfg, { module: null, step: null, error: null, haForm: null });
    }
  }

  // A group's tab clicked: its first sub-tab, whichever was shown last in it
  _goGroup(group, focus) {
    this._goTab(this._groupTabs(group)[0], focus);
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

  /** The top bar folds on scroll into one bar with the tabs as icon pills (see systemHubPanelFold). */
  _attachFold() {
    this._fold?.detach();
    this._fold = systemHubPanelFold(this, {
      top: ".topbar",
      tabs: ".tabsbar",
      tab: ".tab",
      key: (b) => b.dataset.group,
      icons: {
        status: "mdi:heart-pulse",
        system: "mdi:server",
        security: "mdi:shield-lock-outline",
        reliability: "mdi:shield-check-outline",
        maintenance: "mdi:update",
        devices: "mdi:devices",
        settings: "mdi:cog",
      },
      badge: ".tbadge",
      name: ".topbar .shtitle",
      sub: ".topbar .shsub",
      icon: ".topbar .shbadge",
      status: ".topbar .shpill",
      acts: ".topbar .shzooms > *",
      subtab: "main .shtop .subtab",
      badgeColors: true,
      accent: "var(--primary-color, #03a9f4)",
      menu: () => ({ hass: this._hass, narrow: this._narrow, show: true }),
    });
  }

  _renderShell() {
    var root = this.shadowRoot;
    if (root.querySelector('.tabsbar')) return;
    root.innerHTML = `<style>${SystemHubPanel.STYLE}</style>
      <header class="topbar"></header><ha-menu-button class="bmenu" hidden></ha-menu-button>
      <div class="tabsbar"><ha-menu-button class="tabmenu"></ha-menu-button><nav class="tabs" role="tablist"></nav></div>
      <main></main>`;
    this._menus = [...root.querySelectorAll('ha-menu-button')];
    this._menu = this._menus[0];
    this._menus.forEach((menu) => {
      menu.hass = this._hass;
      menu.narrow = this._narrow;
    });
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
    // The top bar's buttons (the banner is out of main): Refresh, Settings, the tab's own settings
    root.querySelector('.topbar').addEventListener('click', (ev) => this._onClick(ev));
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
      if (ev.key === 'Escape' && this._pk) {
        this._pk = null;
        return this._render();
      }
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
    // The network map: zoomed with the wheel, moved by dragging
    root.querySelector('main').addEventListener('wheel', (ev) => this._slWheel(ev), { passive: false });
    root.querySelector('main').addEventListener('pointerdown', (ev) => this._slPanStart(ev));
    root.querySelector('main').addEventListener('pointermove', (ev) => this._slPanMove(ev));
    root.querySelector('main').addEventListener('pointerup', () => this._slPanEnd());
    root.querySelector('main').addEventListener('pointerleave', () => this._slPanEnd());
    root.querySelector('main').addEventListener('pointerover', (ev) => this._slHoverAt(ev));
    root.querySelector('main').addEventListener('pointerout', (ev) => !ev.relatedTarget?.closest?.('svg.nsvg') && this._slHoverEnd(ev.target.closest?.('.nmap')));
    root.querySelector('main').addEventListener('input', (ev) => {
      if (ev.target.dataset?.draft) this._draft[ev.target.dataset.draft] = ev.target.value;
      // The Orphans search and filters narrow the list as they change
      if (ev.target.dataset?.draft?.startsWith('orph_')) this._render();
      if (ev.target.dataset?.draft === 'batt_search' || ev.target.dataset?.draft === 'sl_search' || ev.target.dataset?.draft === 'pk_q') this._render();
    });
    this._attachFold();
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
    this._applyHeader();
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
    main.innerHTML = this._top() + this._content();
    // As the mockups: what opens the tab (its tiles, actions, rings) sits in the header card, under the banner
    var top = main.querySelector(':scope > .shtop');
    if (top) {
      var body = document.createElement('div');
      body.className = 'shbody';
      var next = top.nextElementSibling;
      while (next && next.tagName !== 'HA-CARD' && next.tagName !== 'H2' && next.tagName !== 'SECTION' && !next.matches('.stgroups, .mkgrid, .pair, .sctwo')) {
        var after = next.nextElementSibling;
        body.append(next);
        next = after;
      }
      if (body.children.length) top.append(body);
      // The module's settings: a round frosted button in the banner's corner, as on the cards
      var corner = top.querySelector('.shbanner');
      // The tab's own module (the first of its buttons that opens a module's settings, wherever the tab puts it)
      var settings = main.querySelector(`[data-action="open_settings:${shTabBase(this._tab)}"]`);
      if (corner && settings) {
        // The spacer _configure put before it goes with it
        if (settings.previousElementSibling?.matches('span.grow')) settings.previousElementSibling.remove();
        var label = settings.textContent.trim();
        settings.className = 'shzoom';
        settings.title = label;
        settings.setAttribute('aria-label', label);
        for (var t of [...settings.childNodes]) if (t.nodeType === 3) t.remove();
        // The same cog as the other ha-* panels' top bars
        settings.querySelector('ha-icon')?.setAttribute('icon', 'mdi:cog');
        corner.querySelector('.shzooms')?.append(settings);
      }
    }
    // Sections side by side, as the mockups lay them out: the cards after the first ones go in two columns
    var span = { watchdog: [1, 3], backups: [0, 2] }[this._tab];
    if (span) {
      var cards = [...main.querySelectorAll(':scope > ha-card:not(.shtop), :scope > .sctwo')];
      var rest = cards.slice(...span);
      if (rest.length > 1) {
        var cols = document.createElement('div');
        cols.className = 'shcols';
        rest[0].before(cols);
        for (var c of rest) {
          if (c.matches('.sctwo')) cols.append(...c.children);
          else cols.append(c);
          if (c.matches('.sctwo')) c.remove();
        }
      }
    }
    // The Updates tab: each heading and its tiles (and the Marketplace's status) in one card, as the other sections
    if (this._tab === 'marketplace') {
      for (var h2 of [...main.querySelectorAll(':scope > h2.stsec')]) {
        var sec = document.createElement('ha-card');
        sec.className = 'mksec';
        h2.before(sec);
        var node = h2;
        while (node && (node === h2 || (node.tagName !== 'H2' && !node.matches('ha-card.list')))) {
          var following = node.nextElementSibling;
          sec.append(node);
          node = following;
        }
      }
    }
    this._mountBanner(main);
    var netSvg = main.querySelector('svg.nsvg');
    if (netSvg) this._slFixZoom(netSvg);
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

  // The tab's banner goes up as the top bar, full width, the menu button before its icon; the header card keeps the
  // sub-tabs and what opens the tab, and goes when nothing is left in it
  _mountBanner(main) {
    var bar = this.shadowRoot.querySelector('.topbar');
    var top = main.querySelector(':scope > .shtop');
    var banner = top?.querySelector(':scope > .shbanner');
    if (!banner) {
      bar.replaceChildren();
      return;
    }
    var menu = this._menus[0];
    menu.hidden = false;
    banner.querySelector('.shhead')?.prepend(menu);
    // Settings as a cog beside Refresh, where the tab has no settings of its own (and not on Settings itself)
    var acts = banner.querySelector('.shzooms');
    if (acts && this._tab !== 'settings' && !acts.querySelector('[data-action^="open_settings"]')) {
      var label = shEsc(this._tabName('settings'));
      acts.insertAdjacentHTML('beforeend', `<button class="shzoom" data-action="go_settings" title="${label}" aria-label="${label}"><ha-icon icon="mdi:cog"></ha-icon></button>`);
    }
    bar.replaceChildren(banner);
    if (!top.children.length) top.remove();
  }

  // The tab's header card: its illustrated banner, then the sub-tabs of its group
  _top() {
    var banner = this._banner();
    var subtabs = this._subtabs();
    return banner || subtabs ? `<ha-card class="shtop">${banner}${subtabs}</ha-card>` : '';
  }

  // The sub-tabs of the group shown, when it has more than one module turned on
  _subtabs() {
    var subs = this._state?.loaded ? this._groupTabs(shGroupOf(this._tab)) : [];
    if (subs.length < 2) return '';
    return `<nav class="subtabs" role="tablist" aria-label="${shEsc(this._groupName(shGroupOf(this._tab)))}">${subs
      .map((tab) => {
        var selected = tab === this._tab;
        // A module's section: its own tone, icon and name
        var section = SH_SUBTABS[shTabBase(tab)];
        var tone = section ? this._scSubTone(tab) : this._stArea(tab)?.[0];
        var dot = tone && tone !== 'good' ? `<span class="subdot ${tone}" aria-hidden="true"></span>` : '';
        var name = section ? this._t(`sub_${tab}`) : this._tabName(tab);
        return `<button class="subtab${selected ? ' active' : ''}" role="tab" data-subtab="${tab}" aria-selected="${selected}" tabindex="${selected ? 0 : -1}"><ha-icon icon="${section ? SH_SUBTAB_ICONS[tab] : SH_MODULE_ICONS[tab]}"></ha-icon>${shEsc(name)}${dot}</button>`;
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
    // Updated while this page was open: the panel shown is still the one loaded before, until the page is reloaded
    var stale = this._state.version && this._state.version !== SYSTEM_HUB_PANEL_VERSION
      ? `<ha-card class="note warn shstale" role="alert"><ha-icon icon="mdi:update"></ha-icon><span class="grow">${shEsc(this._t('panel_outdated', { version: this._state.version }))}</span>
        <button class="act" data-action="page_reload"><ha-icon icon="mdi:refresh"></ha-icon>${shEsc(this._t('panel_reload'))}</button></ha-card>`
      : '';
    var html = {
      status: () => this._status(),
      system: () => this._system(),
      containers: () => this._containers(),
      watchdog: () => this._watchdog(),
      marketplace: () => this._marketplace(),
      backups: () => this._backups(),
      purge: () => this._purge(),
      database: () => this._database(),
      security: () => this._security('security'),
      security_accounts: () => this._security('security_accounts'),
      security_system: () => this._security('security_system'),
      security_outbound: () => this._security('security_outbound'),
      logs: () => this._logs(),
      silent: () => this._silent(),
      batteries: () => this._batteries(),
      git_sync: () => this._gitSync(),
      automations: () => this._automations(),
      orphans: () => this._orphans(),
      settings: () => this._settings(),
    }[this._tab];
    return stale + (html ? html() : '');
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
    return `<span class="grow"></span>${this._button(`open_settings:${shTabBase(this._tab)}`, 'mdi:cog-outline', this._t('configure'), { quiet: true })}`;
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
    // Usage in %, worked out from the space used and free where the percentage sensor is off
    var disks = shDisks(sensors);
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
    var ringHist = this._history(ringDefs.flatMap(([s]) => s.derive?.slice(0, 2) || [s.entity_id]), 24);
    var rings = ringDefs.map(([s, label, color, unit, key]) => this._ring(s, label, color, unit, this._values(ringHist, s), level(shNum(s.state), key))).join('');
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

  // The shortcuts chosen in Settings → Display (#133, #144), before the buttons below: a round icon each, shown only
  // when its page is in Home Assistant (the File editor, else Studio Code Server, and the Marketplace in the sidebar)
  _haShortcuts() {
    var panels = this._hass?.panels || {};
    var chosen = this._state?.shortcuts || SH_DEFAULT_SHORTCUTS;
    return Object.entries(SH_SHORTCUTS)
      .filter(([key]) => chosen.includes(key))
      .map(([key, sc]) => {
        var panel = sc.panels.find((p) => panels[p]);
        if (!panel) return '';
        var path = sc.path || `/${panel}`;
        var label = shEsc(this._t(`sc_${key}`));
        return `<a class="act quiet sc" href="${path}" data-nav="${path}" title="${label}" aria-label="${label}"><ha-icon icon="${sc.icon}"></ha-icon></a>`;
      })
      .join('');
  }

  // Reload the YAML configuration, restart Home Assistant and reboot the host (with the Supervisor only), each once
  // confirmed in a dialog; the restart checks the configuration first, as Home Assistant's own dialog does, and is
  // refused while it is invalid
  _haControls() {
    var chosen = this._haButtons();
    var reload = chosen.includes('reload') ? this._button('ha_ask:reload', SH_BUTTONS.reload, this._t('ha_reload'), { quiet: true, busy: this._busy.ha_reload }) : '';
    var restart = chosen.includes('restart') ? this._button('ha_ask:restart', SH_BUTTONS.restart, this._t('ha_restart'), { danger: true }) : '';
    var reboot = chosen.includes('reboot') ? this._button('ha_ask:reboot', SH_BUTTONS.reboot, this._t('ha_reboot'), { danger: true }) : '';
    var shortcuts = this._haShortcuts();
    var message = this._message('ha');
    // Nothing chosen (#146): no bar at all
    if (!reload && !restart && !reboot && !shortcuts && !message) return '';
    return `<div class="actions ha-ctl">${message}<span class="grow"></span>${shortcuts}
      ${reload}${restart}${reboot}</div>${this._haDialog()}`;
  }

  // The System tab's buttons that can show: the ones chosen in Settings → Display (#146), the reboot with the Supervisor
  _haButtons() {
    var chosen = this._state?.buttons || Object.keys(SH_BUTTONS);
    var supervisor = this._hass?.config?.components?.includes('hassio');
    return Object.keys(SH_BUTTONS).filter((k) => chosen.includes(k) && (k !== 'reboot' || supervisor));
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
      lines.flatMap(([s]) => s.derive?.slice(0, 2) || [s.entity_id]),
      hours,
    );
    var periods = [1, 6, 24, 168]
      .map((h) => {
        var label = h < 168 ? this._t('period_h', { n: h }) : this._t('period_d', { n: 7 });
        return `<button class="seg${h === hours ? ' active' : ''}" data-action="period" data-chart="${id}" data-hours="${h}" aria-pressed="${h === hours}">${shEsc(label)}</button>`;
      })
      .join('');
    var series = lines.map(([s, , color]) => ({ color, values: this._values(data, s) || [] }));
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

  // The recorded values of a sensor in `data` (from _history); a disk worked out from its space used and free gets
  // its usage in % bucket by bucket
  _values(data, sensor) {
    if (!data) return undefined;
    if (!sensor.derive) return data[sensor.entity_id];
    var [useId, freeId, factor] = sensor.derive;
    var free = data[freeId] || [];
    return (data[useId] || []).map((u, i) => (u === null || free[i] == null ? null : shDiskPct(u, free[i], factor)));
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
        // As its mockup: what it is as the title, then the container's name and its image (or its version)
        var sub = [c.container || this._t(c.kind), c.image || c.version].filter(Boolean);
        var update = c.update_available ? `<span class="pill warn" title="${shEsc(this._t('update', { version: c.version_latest }))}"><ha-icon icon="mdi:arrow-up-circle-outline"></ha-icon>${shEsc(c.version_latest || '')}</span>` : '';
        return `<div class="item ${tone}"><ha-icon icon="${icons[c.kind] || 'mdi:docker'}"></ha-icon>
          <div class="who"><div class="n">${shEsc(c.name || c.container)}</div><div class="s mono" title="${shEsc(sub.join(' · '))}">${shEsc(sub.join(' · '))}</div></div>${update}
          ${spark ? `<div class="trend ${tone}">${spark}</div>` : ''}
          <div class="side fixed">${
            on
              ? `<span>CPU ${cpu === null ? '—' : `${Math.round(cpu)}%`} · RAM ${mem === null ? '—' : `${Math.round(mem)}%`}</span>
            <div class="meter ${shTone(mem)}"><span style="width:${Math.min(mem || 0, 100)}%"></span></div>
            <span class="muted">${shBytes(c.memory_usage)}</span>`
              : ''
          }</div><span class="pill ${tone}">${shEsc(c.down ? this._t('down') : on ? this._t('running') : this._t('stopped'))}</span></div>`;
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
    var installFailed = data.install_failed || [];
    var installing = data.installing_updates || this._busy.marketplace_install_updates;
    var title = n ? this._t(n === 1 ? 'mk_title_one' : 'mk_title', { n }) : running ? this._t('checking') : this._t('no_updates');
    var tone = data.state === 'error' ? 'bad' : n || failedNames.length || installFailed.length ? 'warn' : 'good';
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
    // The installs that failed (after their retries), "name: error" — from this panel or the automatic updates
    var notInstalled = installFailed
      .map((text) => {
        var i = String(text).indexOf(': ');
        var name = i > 0 ? text.slice(0, i) : text;
        var why = i > 0 ? text.slice(i + 2) : '';
        return `<div class="item warn"><ha-icon icon="mdi:package-variant-remove"></ha-icon><div class="who"><div class="n">${shEsc(name)}</div><div class="s">${shEsc(this._t('could_not_install'))}${why ? ` · ${shEsc(why)}` : ''}</div></div></div>`;
      })
      .join('');
    if (list.length) this._mkFetchNotes(list);
    var system = this._state.system_updates;
    return `${system ? this._sysUpdates(system) : ''}${system ? `<h2 class="stsec">${shEsc(this._t('upd_marketplace'))}</h2>` : ''}${header}${running ? this._progress(data) : ''}${installing && !this._updRun ? this._mkRunProgress(data) : ''}${confirm}
      ${this._messages.marketplace_check_updates || this._messages.marketplace_install_updates ? `<div class="actions">${this._message('marketplace_check_updates')}${this._message('marketplace_install_updates')}</div>` : ''}
      ${cards ? `<div class="mkgrid">${cards}</div>` : ''}
      ${notInstalled && !installing ? `<ha-card class="list">${notInstalled}</ha-card>` : ''}
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
        var head = {};
        var tone = g.errors >= threshold ? 'bad' : g.errors ? 'warn' : 'info';
        var counts = [g.errors ? this._t('lg_n_errors', { n: g.errors }) : '', g.warnings ? this._t('lg_n_warnings', { n: g.warnings }) : ''].filter(Boolean).join(' · ');
        var reload = g.domain !== 'homeassistant' ? this._button('lg_reload', 'mdi:reload', this._t('lg_reload'), { quiet: true, data: { domain: g.domain }, busy: this._busy[`lg_reload:${g.domain}`] }) : '';
        var entries = g.entries
          .map((e, i) => {
            var first = String(e.message?.[0] ?? '');
            var source = Array.isArray(e.source) ? `${String(e.source[0]).split('/').slice(-2).join('/')}:${e.source[1]}` : '';
            var trace = e.exception ? `<details><summary class="s">${shEsc(this._t('lg_traceback'))}</summary><pre class="lgpre">${shEsc(e.exception)}</pre></details>` : '';
            // As its mockup: how often and where, Ignore as an icon at the right, then the message in its box
            var key = this._lgKey(e);
            var busy = this._busy[`lg_ignore:${key}`];
            var ignore = `<button class="icon-btn lgignore" data-action="lg_ignore" data-key="${shEsc(key)}" title="${shEsc(this._t('sl_ignore'))}" aria-label="${shEsc(this._t('sl_ignore'))}"${busy ? ' disabled aria-busy="true"' : ''}><ha-icon${busy ? ' class="spin"' : ''} icon="${busy ? 'mdi:loading' : 'mdi:eye-off-outline'}"></ha-icon></button>`;
            var meta = [`×${e.count || 1}`, this._rel(new Date(e.timestamp * 1000).toISOString()), e.name].filter(Boolean).join(' · ');
            // As its mockup: the first message's count, time and logger under the integration's name, its Ignore in the
            // row; the next messages with their own line
            if (i === 0) {
              head = { meta, ignore, source };
              return `<div class="lgentry"><div class="lgmsg" title="${shEsc(source)}">${shEsc(first)}</div>${trace}</div>`;
            }
            return `<div class="lgentry"><div class="lgtop"><div class="s">${shEsc([meta, source].filter(Boolean).join(' · '))}</div>${ignore}</div>
              <div class="lgmsg">${shEsc(first)}</div>${trace}</div>`;
          })
          .join('');
        var frequent = g.errors >= threshold ? `<span class="pill bad">${shEsc(this._t('lg_frequent'))}</span>` : '';
        return `<ha-card class="list lggroup ${tone}"><div class="item lgrow ${tone}"><ha-icon icon="${g.custom ? 'mdi:puzzle-outline' : 'mdi:home-assistant'}"></ha-icon>
          <div class="who"><div class="n lgname">${shEsc(shIntegration(g.domain))}</div><div class="s">${shEsc(head.meta || '')}</div></div>
          ${frequent}<span class="pill ${tone}">${shEsc(counts)}</span>${reload}${head.ignore || ''}</div>${entries}</ha-card>`;
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
    this._slRegLoad();
    var nets = this._slNets();
    var view = nets.includes(this._slView) ? this._slView : 'list';
    var vtab = (v, label) =>
      `<button class="btab${v === view ? ' on' : ''}" data-action="sl_view" data-view="${v}" aria-pressed="${v === view}">${shEsc(label)}</button>`;
    var views = nets.length
      ? `<div class="btabs nviews" role="group">${vtab('list', this._t('sl_view_list'))}${nets.map((v) => vtab(v, this._t(`sl_view_${v}`))).join('')}</div>`
      : '';
    if (view !== 'list') return views + this._slNetwork(view);
    return this._silentList(views);
  }

  // As its mockup: the counts, then the views and the integrations on one row, the devices to look at in their card
  // with what silent and weak mean under them
  _silentList(views = '') {
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
          <a class="icon-btn" href="/config/devices/device/${encodeURIComponent(d.device_id)}" title="${shEsc(this._t('open_device'))}" aria-label="${shEsc(`${this._t('open_device')} · ${d.name}`)}"><ha-icon icon="mdi:open-in-new"></ha-icon></a>
          <button class="icon-btn" data-action="sl_ignore" data-device="${shEsc(d.device_id)}" data-name="${shEsc(d.name)}" title="${shEsc(this._t('sl_ignore'))}" aria-label="${shEsc(`${this._t('sl_ignore')} · ${d.name}`)}"${this._busy[`sl_ignore:${d.device_id}`] ? ' disabled aria-busy="true"' : ''}><ha-icon icon="mdi:eye-off-outline"></ha-icon></button></div>`;
      })
      .join('');
    var hint = this._t('sl_hint', { battery: data.battery_hours ?? 24, mains: data.mains_hours ?? 24 });
    return `<div class="tiles">${tiles.join('')}</div>
      <div class="actions">${views}<span class="grow"></span>${filters}${this._message('sl')}${this._configure()}</div>
      <ha-card class="list"><div class="lhead"><ha-icon icon="mdi:access-point-off"></ha-icon><span class="lname">${shEsc(this._tabName('silent'))} · ${list.length}</span></div>
      ${rows || `<div class="empty good"><ha-icon icon="mdi:check-circle-outline"></ha-icon>${shEsc(this._t('sl_none'))}</div>`}<span class="msg slhint">${shEsc(hint)}</span></ha-card>`;
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

  // The device registry, read once when the Silent devices tab is shown: which networks can be drawn (ZHA or
  // Zigbee2MQTT devices, Matter devices), the Zigbee2MQTT and Matter devices' Home Assistant ids
  _slRegLoad() {
    if (this._slReg || !this._hass?.callWS) return;
    this._slReg = { devices: [], loading: true };
    this._hass
      .callWS({ type: 'config/device_registry/list' })
      .then((devices) => (this._slReg = { devices: Array.isArray(devices) ? devices : [] }))
      .catch(() => (this._slReg = { devices: [] }))
      .then(() => this._tab === 'silent' && this._render());
  }

  _slNets() {
    var has = (test) => (this._slReg?.devices || []).some((d) => !d.disabled_by && (d.identifiers || []).some(test));
    var nets = [];
    if (has(([dom, id]) => dom === 'zha' || (dom === 'mqtt' && /^zigbee2mqtt_0x/i.test(String(id))))) nets.push('zigbee');
    if (has(([dom, id]) => dom === 'zwave_js' && /^\d+-\d+$/.test(String(id)))) nets.push('zwave');
    if (has(([dom]) => dom === 'matter')) nets.push('matter');
    return nets;
  }

  // A network read when its view is shown, again after 5 minutes or on Read again
  async _slNetLoad(net, force) {
    var had = this._slMap?.[net];
    if (!this._hass?.callWS || had?.loading || (had && !force && Date.now() - had.at < 300000)) return;
    this._slMap = { ...(this._slMap || {}), [net]: { ...(had || {}), loading: true, error: null, at: Date.now() } };
    if (force) this._render();
    try {
      var graph = net === 'zigbee' ? await this._slZigbee() : net === 'zwave' ? await this._slZwave() : await this._slMatter();
      this._slMap[net] = { ...graph, loading: false, error: null, at: Date.now() };
    } catch (err) {
      this._slMap[net] = { ...(had || {}), loading: false, error: shErr(err), at: Date.now() };
    }
    if (this._tab === 'silent') this._render();
  }

  async _slZigbee() {
    if ((this._hass.config?.components || []).includes('zha')) return shZhaGraph(await this._hass.callWS({ type: 'zha/devices' }));
    return this._slZ2m();
  }

  // Zigbee2MQTT scans its network when asked (up to a minute or more): its answer on bridge/response/networkmap
  async _slZ2m() {
    var base = 'zigbee2mqtt';
    var timer;
    var unsub;
    try {
      var answer = new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(new Error(this._t('sl_net_timeout', { topic: `${base}/bridge` }))), 120000);
        unsub = this._hass.connection.subscribeMessage(
          (msg) => {
            var data;
            try {
              data = JSON.parse(msg.payload);
            } catch (_err) {
              return;
            }
            if (data?.data?.type !== 'raw') return;
            if (data.status === 'ok') resolve(data.data.value);
            else reject(new Error(data.error || 'networkmap'));
          },
          { type: 'mqtt/subscribe', topic: `${base}/bridge/response/networkmap` },
        );
      });
      await unsub;
      await this._hass.callService('mqtt', 'publish', { topic: `${base}/bridge/request/networkmap`, payload: JSON.stringify({ type: 'raw', routes: false }) });
      return shZ2mGraph(await answer, this._slReg?.devices);
    } finally {
      clearTimeout(timer);
      Promise.resolve(unsub)
        .then((stop) => stop?.())
        .catch(() => {});
    }
  }

  // Each Z-Wave network's status (one of its devices names it), then each node's statistics: the first message of their
  // subscription, read a few at a time (none after 10 s: the node is drawn under its controller)
  async _slZwave() {
    var registry = this._slReg?.devices || [];
    var homes = new Map();
    for (var dev of registry) {
      if (dev.disabled_by) continue;
      for (var [dom, id] of dev.identifiers || []) {
        var m = dom === 'zwave_js' && /^(\d+)-\d+$/.exec(String(id));
        if (m && !homes.has(m[1])) homes.set(m[1], dev.id);
      }
    }
    var networks = (await Promise.all([...homes.values()].map((device_id) => this._hass.callWS({ type: 'zwave_js/network_status', device_id }).catch(() => null))))
      .map((s) => s?.controller)
      .filter(Boolean);
    if (!networks.length) throw new Error('zwave_js/network_status');
    var graph = shZwaveGraph(networks, registry, []);
    var devices = graph.nodes.filter((n) => n.device_id && n.role !== 'coordinator').map((n) => n.device_id);
    var stats = [];
    for (var i = 0; i < devices.length; i += 8) {
      stats.push(...(await Promise.all(devices.slice(i, i + 8).map(async (d) => [d, await this._slZwaveStats(d)]))));
    }
    return shZwaveGraph(networks, registry, stats);
  }

  _slZwaveStats(device_id) {
    var conn = this._hass.connection;
    if (!conn?.subscribeMessage) return Promise.resolve(null);
    return new Promise((resolve) => {
      var unsub;
      var settled = false;
      // Once only: the timeout, the first message, a failed subscription or a message already on its way after it
      // would otherwise unsubscribe again (an error from Home Assistant for an unknown subscription)
      var done = (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
        // Read once the call has returned: a message delivered while subscribing still finds the subscription
        Promise.resolve()
          .then(() => unsub)
          .then((stop) => stop?.())
          .catch(() => {});
      };
      var timer = setTimeout(() => done(null), 10000);
      unsub = conn.subscribeMessage((msg) => done(msg || null), { type: 'zwave_js/subscribe_node_statistics', device_id });
      Promise.resolve(unsub).catch(() => done(null));
    });
  }

  // Each Matter node's diagnostics (its network and whether it routes); the devices it bridges come with it
  async _slMatter() {
    var registry = this._slReg?.devices || [];
    var mine = registry.filter((d) => !d.disabled_by && (d.identifiers || []).some(([dom]) => dom === 'matter'));
    var ids = new Set(mine.map((d) => d.id));
    var tops = mine.filter((d) => !ids.has(d.via_device_id));
    var diags = await Promise.all(tops.map((d) => this._hass.callWS({ type: 'matter/node_diagnostics', device_id: d.id }).catch(() => null)));
    return shMatterGraph(registry, tops.map((d, i) => [d.id, diags[i]]));
  }

  // The view of a network: its map beside its tree by router, the silent devices in red with their last link, a
  // device picked on either side shown on both and detailed below
  _slNetwork(net) {
    this._slNetLoad(net);
    var map = this._slMap?.[net];
    if (!map?.nodes) {
      var reload = this._button('sl_net_reload', 'mdi:refresh', this._t('sl_net_reload'), { quiet: true, data: { net }, busy: map?.loading });
      var wait = this._spinner(this._t(net === 'zigbee' && !(this._hass?.config?.components || []).includes('zha') ? 'sl_net_scanning' : 'sl_net_loading'));
      var failed = map?.error ? `<span class="msg bad" role="status">${shEsc(this._t('sl_net_failed', { error: map.error }))}</span>${reload}` : '';
      return `<ha-card class="note">${failed || wait}</ha-card>`;
    }
    var rows = new Map((this._state.silent?.devices || []).map((d) => [d.device_id, d]));
    var reg = new Map((this._slReg?.devices || []).map((d) => [d.id, d]));
    var nodes = map.nodes.map((n) => {
      var row = n.device_id ? rows.get(n.device_id) : null;
      var dev = reg.get(n.device_id);
      var area = row?.area || this._hass?.areas?.[dev?.area_id]?.name || null;
      var maker = [dev?.manufacturer, dev?.model].filter(Boolean).join(' ');
      return { ...n, row, area, maker, silent: Boolean(row?.silent) || (n.role !== 'hub' && !n.available) };
    });
    var byId = new Map(nodes.map((n) => [n.id, n]));
    // Silent only: the silent devices and the nodes they hang from
    var keep = new Set();
    for (var n of nodes.filter((x) => x.silent)) {
      for (var at = n; at && !keep.has(at.id); at = byId.get(at.parent)) keep.add(at.id);
    }
    // The search: the devices whose name or room holds it
    var query = (this._draft.sl_search || '').trim().toLowerCase();
    var found = (x) => !query || `${this._slName(x)} ${x.area || ''}`.toLowerCase().includes(query);
    var shown = (x) => (!this._slOnly || keep.has(x.id) || x.role === 'coordinator') && found(x);
    var sel = byId.get(this._slSel) ? this._slSel : null;
    var devices = nodes.filter((x) => x.role !== 'hub' && x.role !== 'coordinator');
    var silentCount = devices.filter((x) => x.silent).length;
    var counts = `<span class="pill good">${shEsc(this._t('sl_net_heard', { n: devices.length - silentCount }))}</span>
      <span class="pill ${silentCount ? 'warn' : 'good'}">${shEsc(this._t('sl_n_silent', { n: silentCount }))}</span>
      <span class="pill">${shEsc({ zha: 'ZHA', z2m: 'Zigbee2MQTT', zwave: 'Z-Wave JS' }[map.source] || 'Matter')}</span>`;
    var hint = net === 'matter' || net === 'zwave' ? `<span class="msg">${shEsc(this._t(`sl_net_${net}_hint`))}</span>` : '';
    var treeOpen = Boolean(this._slTreeOpen);
    var tree = `<ha-card class="ntree"><button class="ntoggle" data-action="sl_tree" aria-expanded="${treeOpen}">
        <ha-icon icon="mdi:chevron-${treeOpen ? 'up' : 'down'}"></ha-icon>${shEsc(this._t('sl_net_tree'))}</button>
      ${treeOpen ? `<div class="nrows">${this._slTree(nodes, sel, shown)}</div>` : ''}</ha-card>`;
    return `<div class="actions"><div class="nbar">${counts}</div></div>${hint}
      ${this._slMapSvg(net, map, nodes, sel, shown, query)}${this._slDetail(sel && byId.get(sel), byId)}${tree}`;
  }

  // The name of a node: a network's (Thread and its name, Wi-Fi, Ethernet) or the device's
  _slName(n) {
    if (n.role !== 'hub') return n.name;
    if (n.hub === 'thread') return n.name ? `Thread · ${n.name}` : 'Thread';
    return this._t(`sl_net_${n.hub}`);
  }

  // The map: laid out as a graph of forces once per reading, zoomed with the wheel and moved by dragging; each node
  // with its name and room beside it, the networks and the coordinator as squares, the routers as circles, the devices
  // as small circles, the silent ones red; a device's link points to its parent, coloured by its LQI (Zigbee)
  _slMapSvg(net, map, nodes, sel, shown, query) {
    var W = 1000;
    var H = 640;
    if (!map.pos) map.pos = shNetForce(map.nodes, map.links, W, H);
    var pos = map.pos;
    // Fitted to the map's size on screen (read once it is drawn, 1000 × 640 until then)
    this._slPxUsed = this._slPx || [1000, 640];
    var box = this._slBox?.net === net ? this._slBox.box : shNetBox(pos, ...this._slPxUsed);
    var byId = new Map(nodes.map((x) => [x.id, x]));
    var labels = this._slLabels !== false;
    var fade = (x) => (shown(x) ? '' : ' dim');
    var lines = [];
    for (var l of map.links || []) {
      var a = byId.get(l.a);
      var b = byId.get(l.b);
      if (!a || !b || a.role === 'end' || b.role === 'end' || a.parent === b.id || b.parent === a.id || !pos[a.id] || !pos[b.id]) continue;
      lines.push(`<line class="nl mesh${shown(a) && shown(b) ? '' : ' dim'}" data-a="${shEsc(a.id)}" data-b="${shEsc(b.id)}" x1="${pos[a.id][0].toFixed(1)}" y1="${pos[a.id][1].toFixed(1)}" x2="${pos[b.id][0].toFixed(1)}" y2="${pos[b.id][1].toFixed(1)}"/>`);
    }
    var size = { coordinator: 20, hub: 20, router: 13, bridge: 13, end: 9 };
    for (var x of nodes) {
      var p = byId.get(x.parent);
      if (!p || !pos[x.id] || !pos[p.id]) continue;
      // From the device to its parent, the arrow halfway (the nodes keep their size whatever the zoom)
      var [x1, y1] = pos[x.id];
      var [x2, y2] = pos[p.id];
      var mid = `${((x1 + x2) / 2).toFixed(1)},${((y1 + y2) / 2).toFixed(1)}`;
      var signal = shSignal(x);
      var tone = x.silent ? 'gone' : net === 'matter' ? (p.hub === 'thread' || byId.get(p.parent)?.hub === 'thread' ? 'thread' : p.role === 'hub' ? 'ip' : '') : signal?.tone || '';
      var width = signal ? 1.5 + signal.level * 2.5 : 2;
      var dash = x.role === 'end' ? ' end' : '';
      lines.push(`<polyline class="nl ${tone}${dash}${fade(x)}" data-a="${shEsc(x.id)}" data-b="${shEsc(p.id)}" style="stroke-width:${width.toFixed(1)}px" ${pos[x.id][3] ? '' : `marker-mid="url(#sh-arrow-${tone || 'n'})" `}points="${x1.toFixed(1)},${y1.toFixed(1)} ${mid} ${x2.toFixed(1)},${y2.toFixed(1)}"/>`);
    }
    // For the pointer over a node: its neighbours (parent, children, mesh) and its details
    var adj = new Map(nodes.map((z) => [z.id, new Set([z.id])]));
    var tie = (u, v) => {
      if (!adj.has(u) || !adj.has(v)) return;
      adj.get(u).add(v);
      adj.get(v).add(u);
    };
    for (var z of nodes) tie(z.id, z.parent);
    for (var m of map.links || []) tie(m.a, m.b);
    var roles = { coordinator: 'sl_role_coordinator', hub: 'sl_role_hub', router: 'sl_role_router', bridge: 'sl_role_bridge', end: 'sl_role_end' };
    var tips = new Map(
      nodes.map((z) => {
        var parent = byId.get(z.parent);
        var heard = z.row?.last_heard || z.seen;
        var facts = [
          [this._t('sl_net_role'), this._t(roles[z.role])],
          [this._t('sl_net_status'), z.silent ? this._t('sl_silent') + (heard ? ` · ${this._rel(heard)}` : '') : heard ? this._t('sl_heard', { when: this._rel(heard) }) : ''],
          ['LQI', z.lqi ?? ''],
          ['RSSI', z.rssi !== null && z.rssi !== undefined ? `${z.rssi} dBm` : ''],
          [this._t('sl_net_parent'), parent && z.role !== 'hub' ? this._slName(parent) : ''],
          [this._t('sl_net_model'), z.maker],
          [this._t('sl_net_area'), z.area],
        ].filter(([, v]) => v !== '' && v !== null && v !== undefined);
        return [z.id, `<b>${shEsc(this._slName(z))}</b>${facts.map(([k, v]) => `<div><span>${shEsc(k)}</span>${shEsc(v)}</div>`).join('')}`];
      }),
    );
    this._slHover = { adj, tips };
    var dots = [];
    var texts = [];
    // Shapes and names drawn at the node in screen pixels: scaled by the map's units per pixel (_slFixZoom)
    var unit = (this._slU || 1).toFixed(4);
    for (var y of nodes) {
      if (!pos[y.id]) continue;
      var [cx, cy] = pos[y.id];
      var r = size[y.role] || 9;
      var kind = y.role === 'hub' ? (y.hub === 'thread' ? 'thread' : 'ip') : y.role === 'bridge' ? 'router' : y.role;
      var hit = query && shown(y) ? ' hit' : '';
      var cls = `nn ${kind}${y.silent ? ' silent' : ''}${y.id === sel ? ' sel' : ''}${hit}${fade(y)}`;
      var name = this._slName(y);
      var shape =
        y.role === 'coordinator' || y.role === 'hub'
          ? `<rect class="nring" x="${-r - 4}" y="${-r - 4}" width="${2 * r + 8}" height="${2 * r + 8}" rx="10"/><rect x="${-r}" y="${-r}" width="${2 * r}" height="${2 * r}" rx="8"/>`
          : `<circle class="nring" r="${r + 4}"/><circle r="${r}"/>`;
      var at = `transform="translate(${cx.toFixed(1)} ${cy.toFixed(1)})"`;
      dots.push(`<g class="${cls}" data-action="sl_pick" data-node="${shEsc(y.id)}" ${at}><title>${shEsc([name, y.area].filter(Boolean).join(' · '))}</title><g class="nz" transform="scale(${unit})">${shape}</g></g>`);
      if (labels || y.id === sel || hit) {
        var text = name.length > 24 ? `${name.slice(0, 23)}…` : name;
        var sub = y.silent && y.row?.last_heard ? `${this._t('sl_silent')} · ${this._rel(y.row.last_heard)}` : y.area || '';
        // A device's name on its right; the coordinator's or a network's centred under it, clear of its neighbours
        var under = y.role === 'coordinator' || y.role === 'hub';
        var left = !under && pos[y.id][2] === -1;
        var tx = under ? 0 : left ? -r - 8 : r + 8;
        var ty = under ? r + 20 : sub ? -2 : 5;
        var anchor = under ? ' text-anchor="middle"' : left ? ' text-anchor="end"' : '';
        texts.push(`<g class="${cls}" data-action="sl_pick" data-node="${shEsc(y.id)}" ${at}><g class="nz" transform="scale(${unit})"><text x="${tx}" y="${ty}"${anchor}>${shEsc(text)}</text>${sub ? `<text class="sub" x="${tx}" y="${ty + 17}"${anchor}>${shEsc(sub)}</text>` : ''}</g></g>`);
      }
    }
    var tool = (action, icon, label, on) =>
      `<button class="ntool${on ? ' on' : ''}" data-action="${action}" data-net="${net}" title="${shEsc(label)}" aria-label="${shEsc(label)}"${on === undefined ? '' : ` aria-pressed="${Boolean(on)}"`}>${icon.startsWith('mdi:') ? `<ha-icon icon="${icon}"></ha-icon>` : icon}</button>`;
    var tools = `<div class="ntools">${tool('sl_net_reload', map.loading ? 'mdi:loading' : 'mdi:refresh', this._t('sl_net_reload'))}
      ${tool('sl_fit', 'mdi:magnify-scan', this._t('sl_net_fit'))}${tool('sl_labels', '<b>A</b>', this._t('sl_net_labels'), labels)}
      ${tool('sl_only', 'mdi:access-point-off', this._t('sl_net_only'), Boolean(this._slOnly))}</div>`;
    var search = `<div class="nsearch"><ha-icon icon="mdi:magnify"></ha-icon><input type="search" data-draft="sl_search" value="${shEsc(this._draft.sl_search || '')}" placeholder="${shEsc(this._t('sl_net_search'))}" aria-label="${shEsc(this._t('sl_net_search'))}"></div>`;
    var key = (cls, label) => `<span><i class="nd ${cls}"></i>${shEsc(label)}</span>`;
    var legend = `<div class="nlegend">${net === 'matter' ? key('thread sq', 'Thread') + key('ip sq', this._t('sl_net_ip')) : key('coordinator sq', this._t('sl_role_coordinator'))}
      ${key('router', this._t('sl_role_router'))}${key('end', this._t('sl_role_end'))}${key('silent', this._t('sl_silent'))}
      ${net === 'zigbee' || net === 'zwave' ? `<span class="nlq">${shEsc(this._t('sl_net_legend'))}</span>` : ''}</div>`;
    return `<ha-card class="nmap">${search}${tools}<div class="ntip" hidden></div>
      <svg class="nsvg" data-net="${net}" viewBox="${box.map((v) => v.toFixed(1)).join(' ')}" role="img" aria-label="${shEsc(this._t('sl_net_map'))}">
        <defs>${['n', 'good', 'warn', 'bad', 'thread', 'ip', 'gone'].map((t) => `<marker id="sh-arrow-${t}" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="${(3 * unit).toFixed(2)}" markerHeight="${(3 * unit).toFixed(2)}" orient="auto"><path class="na ${t}" d="M0,0 L10,5 L0,10 z"/></marker>`).join('')}</defs>
        ${lines.join('')}${dots.join('')}${texts.join('')}</svg>${legend}</ha-card>`;
  }

  // The map zoomed around the pointer with the wheel, moved by dragging; a drag is not a click on a node
  _slWheel(ev) {
    var svg = ev.target.closest?.('svg.nsvg');
    if (!svg) return;
    ev.preventDefault();
    var box = svg.getAttribute('viewBox').split(' ').map(Number);
    var rect = svg.getBoundingClientRect();
    var scale = Math.min(box[2] / rect.width, box[3] / rect.height);
    var fx = box[0] + (ev.clientX - rect.left - (rect.width - box[2] / scale) / 2) * scale;
    var fy = box[1] + (ev.clientY - rect.top - (rect.height - box[3] / scale) / 2) * scale;
    var k = ev.deltaY > 0 ? 1.15 : 1 / 1.15;
    var w = Math.min(Math.max(box[2] * k, 150), 6000);
    var h = (box[3] * w) / box[2];
    var next = [fx - ((fx - box[0]) * w) / box[2], fy - ((fy - box[1]) * h) / box[3], w, h];
    this._slBox = { net: svg.dataset.net, box: next };
    svg.setAttribute('viewBox', next.map((v) => v.toFixed(1)).join(' '));
    this._slFixZoom(svg);
  }

  // The map's units per screen pixel, given to the shapes and names (which keep their size) and to the arrows
  _slFixZoom(svg) {
    var rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    // The map fitted for another size than its own: fitted again once
    this._slPx = [Math.round(rect.width), Math.round(rect.height)];
    var used = this._slPxUsed || [];
    if (!this._slBox && (this._slPx[0] !== used[0] || this._slPx[1] !== used[1])) {
      this._slPxUsed = this._slPx;
      requestAnimationFrame(() => this._render());
    }
    var box = svg.getAttribute('viewBox').split(' ').map(Number);
    var unit = Math.max(box[2] / rect.width, box[3] / rect.height);
    this._slU = unit;
    // Zoomed out, the names would run into each other: the rooms go first, then the end devices' names (still shown
    // for the device pointed at, picked or found)
    svg.classList.toggle('dense', unit > 1.4);
    svg.classList.toggle('crowded', unit > 2.2);
    for (var g of svg.querySelectorAll('.nz')) g.setAttribute('transform', `scale(${unit.toFixed(4)})`);
    for (var m of svg.querySelectorAll('marker')) {
      m.setAttribute('markerWidth', (3 * unit).toFixed(2));
      m.setAttribute('markerHeight', (3 * unit).toFixed(2));
    }
  }

  _slPanStart(ev) {
    var svg = ev.target.closest?.('svg.nsvg');
    if (!svg || ev.button !== 0) return;
    var box = svg.getAttribute('viewBox').split(' ').map(Number);
    var rect = svg.getBoundingClientRect();
    this._slPan = { svg, x: ev.clientX, y: ev.clientY, box, scale: Math.max(box[2] / rect.width, box[3] / rect.height), moved: false };
  }

  _slPanMove(ev) {
    var pan = this._slPan;
    if (!pan) return;
    var dx = ev.clientX - pan.x;
    var dy = ev.clientY - pan.y;
    if (!pan.moved && Math.hypot(dx, dy) < 4) return;
    pan.moved = true;
    var next = [pan.box[0] - dx * pan.scale, pan.box[1] - dy * pan.scale, pan.box[2], pan.box[3]];
    this._slBox = { net: pan.svg.dataset.net, box: next };
    pan.svg.setAttribute('viewBox', next.map((v) => v.toFixed(1)).join(' '));
  }

  _slPanEnd() {
    if (this._slPan?.moved) this._slDragged = Date.now();
    this._slPan = null;
  }

  // The pointer over a node: it and its neighbours stand out, the rest fades, its details beside it
  _slHoverAt(ev) {
    var svg = ev.target.closest?.('svg.nsvg');
    var g = svg && !this._slPan?.moved ? ev.target.closest('[data-node]') : null;
    var card = (svg || ev.target).closest?.('.nmap');
    var tip = card?.querySelector('.ntip');
    if (!g || !this._slHover?.adj.has(g.dataset.node)) {
      if (svg || ev.type === 'pointerleave') this._slHoverEnd(card);
      return;
    }
    var id = g.dataset.node;
    var near = this._slHover.adj.get(id);
    svg.classList.add('focusing');
    for (var el of svg.querySelectorAll('[data-node]')) el.classList.toggle('near', near.has(el.dataset.node));
    for (var line of svg.querySelectorAll('.nl[data-a]')) line.classList.toggle('near', line.dataset.a === id || line.dataset.b === id);
    if (!tip) return;
    tip.innerHTML = this._slHover.tips.get(id) || '';
    tip.hidden = false;
    var box = card.getBoundingClientRect();
    var x = ev.clientX - box.left + 16;
    var y = ev.clientY - box.top + 16;
    tip.style.left = `${Math.min(x, box.width - tip.offsetWidth - 8)}px`;
    tip.style.top = `${Math.min(y, box.height - tip.offsetHeight - 8)}px`;
  }

  _slHoverEnd(card) {
    var svg = card?.querySelector('svg.nsvg');
    svg?.classList.remove('focusing');
    for (var el of svg?.querySelectorAll('.near') || []) el.classList.remove('near');
    var tip = card?.querySelector('.ntip');
    if (tip) tip.hidden = true;
  }

  // The tree: the coordinator (or each network), its routers, their devices; the silent ones say since when
  _slTree(nodes, sel, shown) {
    var { kids, roots } = shNetTree(nodes);
    var order = (a, b) => SH_NET_RANK[a.role] - SH_NET_RANK[b.role] || b.silent - a.silent || a.name.localeCompare(b.name);
    var icons = { coordinator: 'mdi:access-point', hub: 'mdi:access-point', router: 'mdi:google-circles-communities', bridge: 'mdi:link-variant', end: 'mdi:chip' };
    var out = [];
    var walk = (node, depth, seen) => {
      if (seen.has(node.id)) return;
      seen.add(node.id);
      if (shown(node)) {
        var side = '';
        if (node.silent) {
          side = `<span class="pill warn">${shEsc(this._t('sl_silent'))}${node.row?.last_heard ? ` · ${shEsc(this._rel(node.row.last_heard))}` : ''}</span>`;
        } else if (shSignal(node)) {
          var signal = shSignal(node);
          side = `<span class="pill ${signal.tone === 'good' ? 'good' : signal.tone === 'warn' ? 'info' : 'warn'}">${shEsc(signal.text)}</span>`;
        } else if (node.seen) side = `<span class="s">${shEsc(this._rel(node.seen))}</span>`;
        var icon = node.role === 'hub' && (node.hub === 'wifi' || node.hub === 'ethernet') ? 'mdi:ip-network-outline' : icons[node.role];
        out.push(`<button class="nrow${node.silent ? ' silent' : ''}${node.id === sel ? ' sel' : ''}" style="padding-left:${8 + depth * 18}px" data-action="sl_pick" data-node="${shEsc(node.id)}" aria-pressed="${node.id === sel}">
          <ha-icon icon="${node.silent ? 'mdi:access-point-off' : icon}"></ha-icon><span class="nn-name">${shEsc(this._slName(node))}</span>${side}</button>`);
      }
      for (var c of (kids.get(node.id) || []).sort(order)) walk(c, depth + 1, seen);
    };
    var seen = new Set();
    for (var r of roots.sort(order)) walk(r, 0, seen);
    return out.join('') || `<div class="empty">${shEsc(this._t('sl_net_empty'))}</div>`;
  }

  // The device picked: its role, its room, when it was last heard, its parent and link, its battery; its page, Ignore
  _slDetail(n, byId) {
    if (!n) return '';
    var row = n.row;
    var role = { coordinator: 'sl_role_coordinator', hub: 'sl_role_hub', router: 'sl_role_router', bridge: 'sl_role_bridge', end: 'sl_role_end' }[n.role];
    var parent = byId.get(n.parent);
    var heard = row
      ? row.unavailable
        ? this._t('sl_unavailable_since', { when: this._rel(row.last_heard) })
        : this._t('sl_heard', { when: this._rel(row.last_heard) })
      : n.seen
        ? this._t('sl_heard', { when: this._rel(n.seen) })
        : '';
    var power = row?.battery ? (row.level === null || row.level === undefined ? this._t('sl_battery_unknown') : this._t('sl_battery', { n: row.level })) : '';
    var via = parent && n.role !== 'hub' ? this._t('sl_net_via', { name: this._slName(parent) }) + (shSignal(n) ? ` (${shSignal(n).text})` : '') : '';
    var bits = [this._t(role), row?.area, heard, via, power].filter(Boolean).join(' · ');
    var open = n.device_id ? `<a class="act quiet" href="/config/devices/device/${encodeURIComponent(n.device_id)}"><ha-icon icon="mdi:open-in-new"></ha-icon>${shEsc(this._t('open_device'))}</a>` : '';
    var ignore = row ? this._button('sl_ignore', 'mdi:eye-off-outline', this._t('sl_ignore'), { quiet: true, data: { device: row.device_id, name: row.name }, busy: this._busy[`sl_ignore:${row.device_id}`] }) : '';
    return `<ha-card class="ndetail${n.silent ? ' silent' : ''}"><div class="who"><div class="n">${shEsc(this._slName(n))}</div><div class="s">${shEsc(bits)}</div></div>
      <span class="ndact">${open}${ignore}</span></ha-card>`;
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
      await this._dbGrowthLoad(this._db.data?.entity_id);
    } catch (err) {
      this._db = { ...this._db, error: shErr(err) };
    }
    delete this._busy.db_refresh;
    if (this._tab === 'database' || recount) this._render();
  }

  // The growth: the daily means of the size sensor over 30 days (recorder statistics, in bytes), read once an hour
  async _dbGrowthLoad(entityId) {
    if (!entityId || (this._dbStats?.id === entityId && Date.now() - this._dbStats.at < 3600000)) return;
    try {
      var start = new Date(Date.now() - 30 * 86400e3).toISOString();
      var stats = await this._hass.callWS({
        type: 'recorder/statistics_during_period',
        start_time: start,
        statistic_ids: [entityId],
        period: 'day',
        types: ['mean'],
        units: { information: 'B' },
      });
      var points = (stats?.[entityId] || [])
        .map((p) => [typeof p.start === 'number' ? p.start : Date.parse(p.start), shNum(p.mean)])
        .filter((p) => p[1] !== null);
      this._dbStats = { id: entityId, at: Date.now(), points };
    } catch (_err) {
      // No statistics yet (or the recorder's API refused): no growth tile
      this._dbStats = { id: entityId, at: Date.now(), points: [] };
    }
  }

  // The change of size over the last 7 days (or since the first day kept, when fewer), and the line of the 30 days
  _dbGrowth(size) {
    var points = this._dbStats?.points || [];
    if (!points.length) return null;
    var now = typeof size === 'number' ? size : points[points.length - 1][1];
    var since = Date.now() - 7 * 86400e3;
    var from = points.find((p) => p[0] >= since - 43200e3) || points[0];
    var days = Math.max(1, Math.round((Date.now() - from[0]) / 86400e3));
    var values = points.map((p) => p[1]);
    var lo = Math.min(...values, now);
    var hi = Math.max(...values, now);
    var spark = shSpark([...values, now].map((v) => (hi > lo ? ((v - lo) / (hi - lo)) * 100 : 50)));
    return { delta: now - from[1], days, spark };
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

  // Database: its size, its retention, the states of the day; the devices that wrote the most, each unfolding to its
  // entities that wrote the most, to purge their history or to leave them out of the recorder; Purge and repack
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
    var counted = new Set(top.flatMap((d) => d.entity_ids || []));
    for (var id of [...sel]) if (!counted.has(id)) sel.delete(id);
    var tone = this._dbTone(data.size);
    var tiles = [
      this._tile('mdi:database-outline', shEsc(typeof data.size === 'number' ? shBytes(data.size) : '—'), this._t('db_size'), tone, {
        title: typeof data.size === 'number' ? this._t('db_limit', { n: max }) : this._t('db_no_size'),
      }),
    ];
    var growth = this._dbGrowth(data.size);
    if (growth) {
      var sign = growth.delta > 0 ? '+' : growth.delta < 0 ? '−' : '';
      tiles.push(
        this._tile('mdi:chart-line-variant', shEsc(`${sign}${shBytes(Math.abs(growth.delta))}`), this._t('db_growth', { n: growth.days }), '', {
          spark: growth.spark,
          title: this._t('db_growth_title'),
          entity: data.entity_id,
        })
      );
    }
    // What a repack would give back: the free pages of SQLite, the free space of the MariaDB / MySQL tables
    if (typeof data.free === 'number' && data.free >= 1048576) {
      tiles.push(this._tile('mdi:broom', shEsc(shBytes(data.free)), this._t('db_free'), '', { title: this._t('db_free_title') }));
    }
    tiles.push(
      this._tile('mdi:calendar-range', shEsc(this._t('db_days', { n: data.keep_days })), this._t(data.auto_purge ? 'db_retention' : 'db_no_auto_purge'), data.auto_purge ? '' : 'warn'),
      this._tile('mdi:chart-timeline-variant', `<b>${(data.total_day ?? 0).toLocaleString(this._hass?.language)}</b>`, this._t('db_states_day'), ''),
      this._tile('mdi:database-cog-outline', shEsc(data.engine === 'sqlite' ? 'SQLite' : data.engine === 'postgresql' ? 'PostgreSQL' : data.engine === 'mysql' ? 'MariaDB / MySQL' : data.engine), this._t('db_engine'), '')
    );
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
    var share = (n) => (total ? Math.round((n / total) * 100) : 0);
    var count = (n, pct) =>
      `<span class="dbcount"><b>${n.toLocaleString(this._hass?.language)}</b><span class="s">${pct} %</span></span>`;
    var open = (this._dbOpen ??= new Set());
    var rows = top.map((d) => this._dbDevice(d, sel, open, share, count)).join('');
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
        <span class="muted">${shEsc(this._t('db_counted', { when: this._rel(new Date(data.counted_at * 1000).toISOString()) }))}</span></div>${rows}${picked}</ha-card>
      ${this._dbTables(data)}`;
  }

  // The tables: their rows and their size, the biggest first, each bar its share of the size (of the rows when the
  // engine cannot tell the sizes); MariaDB / MySQL and PostgreSQL estimate the rows
  _dbTables(data) {
    var tables = data.tables || [];
    if (!tables.length) return '';
    var sized = tables.some((t) => typeof t.size === 'number' && t.size > 0);
    var key = sized ? 'size' : 'rows';
    var total = tables.reduce((sum, t) => sum + (t[key] || 0), 0);
    var approx = data.engine !== 'sqlite' ? '≈ ' : '';
    var lang = this._hass?.language;
    var rows = tables
      .map((t) => {
        var pct = total ? Math.round(((t[key] || 0) / total) * 100) : 0;
        var sub = `${approx}${this._t(t.rows === 1 ? 'db_rows_one' : 'db_rows', { n: (t.rows || 0).toLocaleString(lang) })}`;
        var value = sized ? shBytes(t.size || 0) : (t.rows || 0).toLocaleString(lang);
        return `<div class="item dbtable"><ha-icon icon="mdi:table"></ha-icon>
          <div class="who"><div class="n">${shEsc(t.name)}</div><div class="s">${shEsc(sub)}</div>
            <div class="dbbar"><span style="width:${Math.max(pct, 1)}%"></span></div></div>
          <span class="dbcount"><b>${shEsc(value)}</b><span class="s">${pct} %</span></span></div>`;
      })
      .join('');
    return `<ha-card class="list"><div class="lhead"><ha-icon icon="mdi:table-multiple"></ha-icon><span class="lname">${shEsc(this._t('db_tables'))}</span>
      <span class="muted">${tables.length}</span></div>${rows}</ha-card>`;
  }

  // A device of the Database tab: its row picks all its entities that wrote (a box half ticked when some are), its
  // chevron unfolds them, the ones that wrote the most first, each picked on its own. An entity without a device is a
  // row of its own, with nothing to unfold.
  _dbDevice(d, sel, open, share, count) {
    var ids = d.entity_ids || [];
    var key = d.device_id || ids[0] || d.name;
    var picked = ids.filter((id) => sel.has(id)).length;
    var box = picked && picked === ids.length ? 'marked' : picked ? 'intermediate' : 'blank-outline';
    var excluded =
      d.excluded && d.excluded === ids.length
        ? ` <span class="pill">${shEsc(this._t('db_excluded'))}</span>`
        : d.excluded
          ? ` <span class="pill">${shEsc(this._t('db_excluded_some', { n: d.excluded }))}</span>`
          : '';
    var sub = d.device_id
      ? [d.area, this._t(ids.length === 1 ? 'db_entities_one' : 'db_entities_many', { n: ids.length })].filter(Boolean).join(' · ')
      : [ids[0], this._t('db_no_device')].filter(Boolean).join(' · ');
    var pct = share(d.count);
    var isOpen = Boolean(d.device_id) && open.has(key);
    var label = `${this._t('db_unfold')} · ${d.name}`;
    var fold = d.device_id
      ? `<button class="icon-btn" data-action="db_open" data-key="${shEsc(key)}" aria-expanded="${isOpen}" title="${shEsc(label)}" aria-label="${shEsc(label)}"><ha-icon icon="mdi:chevron-${isOpen ? 'up' : 'down'}"></ha-icon></button>`
      : '<span class="dbfold-space"></span>';
    var row = `<div class="dbdev${picked ? ' on' : ''}">
      <button class="item dbrow" data-action="db_pick_device" data-key="${shEsc(key)}" aria-pressed="${picked === ids.length && picked > 0}">
        <ha-icon icon="mdi:checkbox-${box}"></ha-icon>
        <div class="who"><div class="n">${shEsc(d.name)}${excluded}</div><div class="s">${shEsc(sub)}</div>
          <div class="dbbar"><span style="width:${Math.max(pct, 1)}%"></span></div></div>
        ${count(d.count, pct)}</button>${fold}</div>`;
    if (!isOpen) return row;
    var entities = (d.entities || [])
      .map((e) => {
        var on = sel.has(e.entity_id);
        var ep = share(e.count);
        return `<button class="item dbrow dbent${on ? ' on' : ''}" data-action="db_pick" data-entity="${shEsc(e.entity_id)}" aria-pressed="${on}">
          <ha-icon icon="mdi:checkbox-${on ? 'marked' : 'blank-outline'}"></ha-icon>
          <div class="who"><div class="n">${shEsc(e.name)}${e.excluded ? ` <span class="pill">${shEsc(this._t('db_excluded'))}</span>` : ''}</div>
            <div class="s">${shEsc(e.entity_id)}</div><div class="dbbar"><span style="width:${Math.max(ep, 1)}%"></span></div></div>
          ${count(e.count, ep)}</button>`;
      })
      .join('');
    var more = ids.length - (d.entities || []).length;
    var rest = more > 0 ? `<div class="item dbent"><div class="who"><div class="s">${shEsc(this._t(more === 1 ? 'db_more_one' : 'db_more', { n: more }))}</div></div></div>` : '';
    return `${row}<div class="dbents" role="group" aria-label="${shEsc(label)}">${entities}${rest}</div>`;
  }

  // The Marketplace's installs running (its Update all, or one card's Update): the backup first, then which one of how
  // many, with the share done of the current one
  _mkRunProgress(data) {
    var run = this._mkRunNow(data);
    return run ? this._instProgress(run) : '';
  }

  // Where the Marketplace's installs are: the backup first, then which one of how many
  _mkRunNow(data) {
    if (!data.backing_up && !data.install_total) return null;
    return {
      backup: Boolean(data.backing_up),
      n: Math.min(data.install_total, (data.install_done || 0) + 1),
      total: data.install_total,
      name: data.install_current,
      entity: data.installing?.[0],
    };
  }

  // The tab's Update all running: the Marketplace's repositories first (their progress from the server), then the
  // other updates one by one
  _updRunNow() {
    var run = this._updRun;
    if (!run) return null;
    if (run.item) return { n: run.base + 1, total: run.total, name: run.item.title, entity: run.item.entity_id, backup: false };
    var mk = this._state.marketplace || {};
    return {
      n: Math.min(run.total, (mk.install_done || 0) + 1),
      total: run.total,
      name: mk.install_current || run.first,
      entity: mk.installing?.[0],
      backup: Boolean(mk.backing_up),
    };
  }

  // Installs running: "Backing up Home Assistant…", then "Installing 2 / 5: name" with the share done of the whole run:
  // the updates finished plus the share done of the current one when its entity reports it (update_percentage; its
  // card shows it too). A moving bar while backing up, or for a single update that doesn't report its progress
  _instProgress(run) {
    var current = run.backup || !run.entity ? null : this._updLive(run.entity).pct;
    var pct = run.backup || (current === null && !(run.total > 1))
      ? null
      : Math.round((Math.max(0, run.n - 1) + (current ?? 0) / 100) / Math.max(1, run.total) * 100);
    var title = run.backup ? this._t('mk_backing_up') : this._t('mk_installing', { n: run.n, total: run.total, name: run.name || '' });
    var value = pct === null ? '' : ` aria-valuenow="${pct}"`;
    return `<ha-card class="progress inst" role="progressbar" aria-label="${shEsc(title)}" aria-valuemin="0" aria-valuemax="100"${value}>
      <div class="phead"><ha-icon icon="${run.backup ? 'mdi:backup-restore' : 'mdi:autorenew'}"></ha-icon><span class="ptitle">${shEsc(title)}</span>${pct === null ? '' : `<span class="ppct">${pct} %</span>`}</div>
      <div class="pbar${pct === null ? ' busy' : ''}"><span style="width:${pct ?? 30}%"></span></div>
    </ha-card>`;
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
    var now = this._updRunNow();
    var head = `<div class="actions"><span class="s grow" title="${shEsc(detail.join('\n'))}">${shEsc(summary.join(' · '))}</span>${toggle}${all}</div>${confirm}${now ? this._instProgress(now) : ''}${this._message('upd')}`;
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
    var first = (this._state.marketplace?.list || []).find((u) => u.entity_id === plan.repos[0]);
    this._updRun = { total: plan.count, base: 0, item: null, first: first?.title };
    this._render();
    try {
      if (plan.repos.length) {
        this._kickLoad();
        await this._hass.callService(SH_DOMAIN, 'marketplace_install_updates', { entity_id: plan.repos, wait: true, backup });
      }
      for (var [i, u] of plan.items.entries()) {
        this._updRun = { ...this._updRun, base: plan.repos.length + i, item: u };
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
    this._updRun = null;
    await this._load();
    this._render();
  }

  // One update: its logo (else its initial), the versions and the size of the change, the start of its release notes.
  // A Marketplace repository is installed by System Hub (one at a time with the others); any other update by Home
  // Assistant's update.install, asked first (Home Assistant itself restarts), with a backup when `backup` and supported
  _mkCard(u, backup) {
    var change = shChange(u.installed, u.latest);
    var system = Boolean(u.kind);
    var live = this._updLive(u.entity_id);
    var busy = u.installing || live.installing || this._busy[`${system ? 'upd' : 'mk'}_install:${u.entity_id}`];
    // Next in the Marketplace's queue (the first one is installing): waiting, not moving yet
    var queued = !system && !live.installing && (this._state.marketplace?.installing || []).indexOf(u.entity_id) > 0;
    // The share done when its entity reports it (update_percentage), next to the button, and a thin bar along the card
    var status = live.pct !== null ? `<span class="mkpct">${live.pct} %</span>` : queued ? `<span class="mkpct muted">${shEsc(this._t('mk_queued'))}</span>` : '';
    var bar = busy && !queued ? `<div class="pbar mkbar${live.pct === null ? ' busy' : ''}" aria-hidden="true"><span style="width:${live.pct ?? 30}%"></span></div>` : '';
    var restart = { core: 'upd_restart_core', supervisor: 'upd_restart_supervisor', os: 'upd_restart_os' }[u.kind];
    var install = system
      ? this._confirm === `upd:${u.entity_id}`
        ? `${this._button('upd_install', 'mdi:package-down', this._t('mk_install'), { data: { entity: u.entity_id, backup: backup && u.backup ? '1' : '' }, busy })}
           ${this._button('cancel', 'mdi:close', this._t('cancel'), { quiet: true })}`
        : this._button('upd_confirm', 'mdi:package-down', this._t('mk_install'), { data: { entity: u.entity_id }, busy })
      : this._button('mk_install', 'mdi:package-down', this._t('mk_install'), { data: { entity: u.entity_id }, busy, disabled: this._state.marketplace?.installing_updates });
    var notes = u.release_summary || this._mkNotes?.[`${u.entity_id}@${u.latest}`];
    var tone = change === 'major' ? 'bad' : change === 'minor' ? 'warn' : 'good';
    // Without a picture, the project's icon when it is one of juju35's (the showcase site's badge), else a card's or a
    // theme's icon in the tone of its row, else the initial
    var project = shProject(u.release_url);
    var kindIcon = { plugin: 'mdi:view-dashboard', theme: 'mdi:palette' }[u.category];
    var initial = project
      ? `<div class="mklogo mkproj" style="--logo:${shEsc(project.accent)}"><ha-icon icon="${shEsc(project.icon)}"></ha-icon></div>`
      : kindIcon
        ? `<div class="mklogo mkproj ${tone}" style="--logo:var(--tone)"><ha-icon icon="${kindIcon}"></ha-icon></div>`
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
        ${change ? `<span class="pill ${tone}">${shEsc(this._t(`mk_${change}`))}</span>` : ''}</div>
      <div class="mkver"><span class="muted">${shEsc(u.installed || '—')}</span><ha-icon icon="mdi:arrow-right"></ha-icon><b>${shEsc(u.latest || '—')}</b></div>
      ${typeof notes === 'string' && notes ? `<div class="s mknotes">${shEsc(notes)}</div>` : ''}
      ${restart ? `<div class="mkrestart"><ha-icon icon="mdi:restart"></ha-icon>${shEsc(this._t(restart))}</div>` : ''}
      ${this._confirm === `upd:${u.entity_id}` ? `<div class="s" role="alert">${shEsc(this._t('upd_confirm', { name: u.title, version: u.latest || '' }))}</div>` : ''}
      <div class="actions">${link}<span class="grow"></span>${status}${install}</div>${bar}</ha-card>`;
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
      ? `<div class="bgroups${view === 'level' ? ' bylevel' : ''}">${groups}</div>`
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
    // By level, as its mockup: what to replace (the batteries in error first, then the lowest) beside the ones that
    // are fine
    if (view === 'level') {
      var item = (b) => ({ b, context: [b.area, this._battTypeName(b.battery_type || '')].filter(Boolean).join(' · ') });
      var sorted = [...list].sort(byLevel);
      var due = sorted.filter((b) => b.unavailable || b.alert || b.low);
      var fine = sorted.filter((b) => !(b.unavailable || b.alert || b.low));
      return [
        { key: 'replace', name: this._t('to_replace'), icon: 'mdi:battery-alert-variant-outline', items: due.map(item) },
        { key: 'fine', name: this._t('batt_fine'), icon: 'mdi:battery-check-outline', items: fine.map(item) },
      ].filter((g) => g.items.length);
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
    var changed = Boolean(this._draft.modules || this._draft.tabs || this._draft.hide_header || this._draft.shortcuts || this._draft.buttons);
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

  // Settings → Display: who the top bar is hidden for
  _settingsDisplay() {
    var mode = this._draft.hide_header || this._state.hide_header || 'off';
    var choices = ['off', 'all', 'non_admin']
      .map((value) => {
        var on = value === mode;
        return `<button class="seg${on ? ' active' : ''}" data-action="hide_header" data-value="${value}" aria-pressed="${on}">${shEsc(this._t(`hide_header_${value}`))}</button>`;
      })
      .join('');
    var hint = mode === 'non_admin' ? `${this._t('hide_header_hint')} ${this._t('hide_header_non_admin_note')}` : this._t('hide_header_hint');
    return `<section class="cfgcard"><div class="cfgsec cfggroup"><ha-icon icon="mdi:monitor-dashboard"></ha-icon><span class="grow">${shEsc(this._t('settings_display'))}</span></div>
      <div class="cfglist"><div class="row cfgrow cfgdisplay"><span class="cfgpad"></span><ha-icon icon="mdi:dock-top"></ha-icon>
        <div class="who"><div class="n">${shEsc(this._t('hide_header'))}</div><div class="s">${shEsc(hint)}</div></div></div>
        <div class="segs cfgsegs" role="group" aria-label="${shEsc(this._t('hide_header'))}">${choices}</div>${this._settingsShortcuts()}${this._settingsButtons()}</div></section>`;
  }

  // Settings → Display: the System tab's buttons (#146), each turned on or off; the reboot with the Supervisor only
  _settingsButtons() {
    var chosen = this._draft.buttons || this._state.buttons || Object.keys(SH_BUTTONS);
    var supervisor = this._hass?.config?.components?.includes('hassio');
    var chips = Object.entries(SH_BUTTONS)
      .filter(([key]) => key !== 'reboot' || supervisor)
      .map(([key, icon]) => {
        var on = chosen.includes(key);
        return `<button class="seg${on ? ' active' : ''}" data-action="ha_button" data-value="${key}" aria-pressed="${on}"><ha-icon icon="${icon}"></ha-icon>${shEsc(this._t(`ha_${key}`))}</button>`;
      })
      .join('');
    return `<div class="row cfgrow cfgdisplay"><span class="cfgpad"></span><ha-icon icon="mdi:restart"></ha-icon>
        <div class="who"><div class="n">${shEsc(this._t('buttons'))}</div><div class="s">${shEsc(this._t('buttons_hint'))}</div></div></div>
        <div class="segs cfgsegs scsegs" role="group" aria-label="${shEsc(this._t('buttons'))}">${chips}</div>`;
  }

  // Settings → Display: the System tab's shortcuts, each turned on or off
  _settingsShortcuts() {
    var chosen = this._draft.shortcuts || this._state.shortcuts || SH_DEFAULT_SHORTCUTS;
    var chips = Object.entries(SH_SHORTCUTS)
      .map(([key, sc]) => {
        var on = chosen.includes(key);
        return `<button class="seg${on ? ' active' : ''}" data-action="shortcut" data-value="${key}" aria-pressed="${on}"><ha-icon icon="${sc.icon}"></ha-icon>${shEsc(this._t(`sc_${key}`))}</button>`;
      })
      .join('');
    return `<div class="row cfgrow cfgdisplay"><span class="cfgpad"></span><ha-icon icon="mdi:gesture-tap-button"></ha-icon>
        <div class="who"><div class="n">${shEsc(this._t('shortcuts'))}</div><div class="s">${shEsc(this._t('shortcuts_hint'))}</div></div></div>
        <div class="segs cfgsegs scsegs" role="group" aria-label="${shEsc(this._t('shortcuts'))}">${chips}</div>`;
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
    if (action.startsWith('pk_') || action === 'pg_remove') return this._pkClick(button, action);
    if (action.startsWith('sc_')) {
      var handled = this._scClick(button, action);
      if (handled !== false) return handled;
    }
    if (action === 'reload') return this._load();
    if (action === 'page_reload') return location.reload();
    if (action === 'go_settings') return this._goTab('settings');
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
      return this._render();
    }
    if (action === 'save') return this._save();
    if (action === 'discard') {
      this._draft.modules = null;
      this._draft.tabs = null;
      this._draft.hide_header = null;
      this._draft.shortcuts = null;
      this._draft.buttons = null;
      return this._render();
    }
    if (action === 'ha_button') {
      var btSaved = Object.keys(SH_BUTTONS).filter((k) => (this._state.buttons || Object.keys(SH_BUTTONS)).includes(k));
      var btNow = this._draft.buttons || btSaved;
      var btNext = Object.keys(SH_BUTTONS).filter((k) => (k === button.dataset.value ? !btNow.includes(k) : btNow.includes(k)));
      this._draft.buttons = btNext.join() === btSaved.join() ? null : btNext;
      return this._render();
    }
    if (action === 'shortcut') {
      var scSaved = Object.keys(SH_SHORTCUTS).filter((k) => (this._state.shortcuts || SH_DEFAULT_SHORTCUTS).includes(k));
      var scNow = this._draft.shortcuts || scSaved;
      var scNext = Object.keys(SH_SHORTCUTS).filter((k) => (k === button.dataset.value ? !scNow.includes(k) : scNow.includes(k)));
      this._draft.shortcuts = scNext.join() === scSaved.join() ? null : scNext;
      return this._render();
    }
    if (action === 'hide_header') {
      var hideValue = button.dataset.value;
      this._draft.hide_header = hideValue === (this._state.hide_header || 'off') ? null : hideValue;
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
    if (action === 'git_sync_commit_push') return this._commitPush();
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
    if (action === 'sl_view') {
      this._slView = button.dataset.view;
      this._slSel = null;
      return this._render();
    }
    if (action === 'sl_pick' && Date.now() - (this._slDragged || 0) < 300) return;
    if (action === 'sl_fit') {
      this._slBox = null;
      return this._render();
    }
    if (action === 'sl_labels') {
      this._slLabels = this._slLabels === false;
      return this._render();
    }
    if (action === 'sl_tree') {
      this._slTreeOpen = !this._slTreeOpen;
      return this._render();
    }
    if (action === 'sl_pick') {
      this._slSel = this._slSel === button.dataset.node ? null : button.dataset.node;
      return this._render();
    }
    if (action === 'sl_only') {
      this._slOnly = !this._slOnly;
      return this._render();
    }
    if (action === 'sl_net_reload') return this._slNetLoad(button.dataset.net, true);
    if (action === 'sl_ignore') return this._slIgnore(button.dataset.device, button.dataset.name);
    if (action === 'db_pick_device') {
      var dev = (this._db?.data?.top || []).find((d) => (d.device_id || d.entity_ids?.[0] || d.name) === button.dataset.key);
      var all = dev?.entity_ids || [];
      var set = (this._dbSel ??= new Set());
      // All ticked: untick them; otherwise tick the rest
      if (all.length && all.every((id) => set.has(id))) for (var one of all) set.delete(one);
      else for (var one2 of all) set.add(one2);
      if (this._confirm === 'db_purge') this._confirm = null;
      return this._render();
    }
    if (action === 'db_open') {
      var opened = (this._dbOpen ??= new Set());
      if (opened.has(button.dataset.key)) opened.delete(button.dataset.key);
      else opened.add(button.dataset.key);
      return this._render();
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
    if (action === 'pg_refresh') return this._pgLoad(true);
    if (action === 'pg_purge_confirm') {
      this._confirm = 'pg_purge';
      return this._render();
    }
    if (action === 'pg_purge') return this._pgPurge();
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
      this._kickLoad();
      return this._run('marketplace_install_updates', 'marketplace_install_updates', { entity_id: [target], wait: true }, null, SH_DOMAIN, `mk_install:${target}`);
    }
    if (action === 'marketplace_install_updates') {
      this._confirm = null;
      // wait: the service answers once the installs have ended, so a failed one shows next to the buttons
      this._kickLoad();
      return this._run(action, action, { wait: true });
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

  // The changes a commit would include, in the full screen diff viewer: Versioning's banner as its header, the
  // panel's message as its message, and Commit and push from it
  _openDiff() {
    if (!this._diffDialog) {
      this._diffDialog = document.createElement('system-hub-diff-dialog');
      document.body?.appendChild?.(this._diffDialog);
    }
    var state = this._gitData() || {};
    var target = this._gitTarget();
    var sub = [state.ahead ? this._t('ahead', { n: state.ahead }) : '', state.behind ? this._t('behind', { n: state.behind }) : ''].filter(Boolean).join(' · ');
    this._diffDialog.open({
      t: (key, vars) => this._t(key, vars),
      locale: this._hass?.locale?.language || this._hass?.language || undefined,
      branch: state.branch,
      commitLabel: this._entityName('button', 'git_sync_commit_push'),
      lastPush: { value: this._rel(state.last_push), label: this._entityName('sensor', 'git_sync_last_push') },
      message: this._draft.message || '',
      style: SH_BANNER_STYLE,
      banner: (over) => this._banner({ tab: 'git_sync', sub: sub || state.remote_url || '', ...over }),
      request: async () =>
        (await this._hass.callWS({ type: 'call_service', domain: SH_DOMAIN, service: 'git_sync_get_diff', service_data: target, return_response: true }))?.response,
      generate: state.ai_task ? () => this._generate() : null,
      onCommit: (message) => {
        this._draft.message = message;
        this._commitPush();
      },
    });
  }

  // Commit and push, with the message typed (none: the integration writes one)
  _commitPush() {
    var message = (this._draft.message || '').trim();
    return this._run('git_sync_commit_push', 'git_sync', { ...(message ? { message } : {}), ...this._gitTarget() }, () => {
      this._draft.message = '';
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
    // The diff viewer puts it in its own field
    return message;
  }

  async _save() {
    this._busy.save = true;
    this._render();
    var msg = { type: 'system_hub/update_settings' };
    if (this._draft.modules) msg.modules = this._draft.modules;
    if (this._draft.tabs) msg.tabs = this._draft.tabs;
    if (this._draft.hide_header) msg.hide_header = this._draft.hide_header;
    if (this._draft.shortcuts) msg.shortcuts = this._draft.shortcuts;
    if (this._draft.buttons) msg.buttons = this._draft.buttons;
    delete this._messages.save;
    try {
      await this._hass.callWS(msg);
      // The entry reloads with the new modules: the button spins until they are read
      await new Promise((resolve) => setTimeout(resolve, 1500));
      this._draft.modules = null;
      this._draft.tabs = null;
      this._draft.hide_header = null;
      this._draft.shortcuts = null;
      this._draft.buttons = null;
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
