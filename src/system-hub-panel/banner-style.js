import { SH_GROUPS, SH_MODULE_ICONS, shEsc, shGroupOf } from "./core.js";
import { SystemHubPanel } from "./panel.js";
import { SH_DECOR, SH_TONE_HEX, SH_WALLS, shDecor, shScene } from "./illustrated-header.js";

export var SH_BANNER_STYLE = `
    .shtop { padding:0; overflow:hidden; }
    .shbanner { position:relative; height:90px; overflow:hidden; color:#1d2733; background:var(--sh-wall); --sh-sub:#4a5a6c; container-type:inline-size; }
    .shbanner.night { color:#fff; --sh-sub:rgba(255,255,255,.78); }
    .shscene { position:absolute; right:62px; bottom:10px; height:80px; width:min(360px, 44%); }
    .shground { position:absolute; left:0; right:0; bottom:0; height:10px; }
    .g-parquet { background:repeating-linear-gradient(90deg, #c99a6b 0 38px, #b98a5c 38px 40px); box-shadow:inset 0 2px 0 #a97c50; }
    .night .g-parquet { background:repeating-linear-gradient(90deg, #4a3a2c 0 38px, #3e3024 38px 40px); box-shadow:inset 0 2px 0 #5c4836; }
    .g-tiles { background:repeating-linear-gradient(90deg, #d9dfe3 0 18px, #c6cdd2 18px 19px); box-shadow:inset 0 2px 0 #b8c0c6; }
    .night .g-tiles { background:repeating-linear-gradient(90deg, #3a4250 0 18px, #2e3542 18px 19px); box-shadow:inset 0 2px 0 #4a5262; }
    .g-concrete { background:#9aa1a9; box-shadow:inset 0 2px 0 #b5bbc2; }
    .night .g-concrete { background:#2c323b; box-shadow:inset 0 2px 0 #3a414c; }
    .shhead { position:absolute; z-index:1; left:0; top:0; bottom:10px; right:calc(min(360px, 44%) + 66px); padding:6px 12px; box-sizing:border-box;
              display:flex; align-items:center; gap:10px; min-width:0; }
    .shbadge { width:40px; height:40px; flex:none; border-radius:50%; display:grid; place-items:center; --mdc-icon-size:24px; color:var(--tone);
               background:rgba(255,255,255,.62); box-shadow:inset 0 0 0 1px color-mix(in srgb, var(--tone) 24%, transparent); }
    .night .shbadge { background:rgba(255,255,255,.12); color:color-mix(in srgb, var(--tone) 78%, #fff); box-shadow:inset 0 0 0 1px rgba(255,255,255,.14); }
    .shtitles { flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; }
    .shtrow { display:flex; align-items:center; gap:8px; min-width:0; }
    .shtitle { flex:0 1 auto; min-width:0; font-size:16px; font-weight:500; line-height:1.25; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .shpill { flex:none; display:inline-flex; align-items:center; gap:4px; padding:1px 8px; border-radius:12px; font-size:11px; font-weight:500; line-height:16px;
              white-space:nowrap; max-width:60%; overflow:hidden; text-overflow:ellipsis;
              background:color-mix(in srgb, var(--tone) 18%, rgba(255,255,255,.78)); color:color-mix(in srgb, var(--tone) 45%, #0d2a45); }
    .shpill::before { content:""; flex:none; width:7px; height:7px; border-radius:50%; background:var(--tone); }
    .night .shpill { background:color-mix(in srgb, var(--tone) 30%, rgba(8,18,38,.55)); color:color-mix(in srgb, var(--tone) 35%, #fff); }
    .shsub { font-size:13px; line-height:18px; color:var(--sh-sub); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .idle { --tone:#8a96a6; }
    @container (max-width:560px) { .shscene { width:40%; right:34px; } .shhead { right:calc(40% + 34px); } .shtrow { flex-wrap:wrap; row-gap:2px; } .shpill { max-width:100%; } }
    @container (max-width:340px) { .shscene { display:none; } .shhead { right:0; } }
    .shtop .subtabs { gap:4px; padding:0 12px; border-bottom:1px solid var(--divider-color, rgba(127,127,127,.2)); overflow-x:auto; flex-wrap:nowrap; }
    .shtop .subtab { min-height:0; padding:8px 10px; border:0; border-bottom:2px solid transparent; border-radius:6px 6px 0 0; margin-bottom:-1px;
                     background:none; color:var(--secondary-text-color); font-size:13px; font-weight:500; white-space:nowrap; gap:6px; --mdc-icon-size:16px; }
    .shtop .subtab:hover { color:var(--primary-text-color); border-color:transparent; }
    .shtop .subtab.active { color:var(--primary-text-color); background:none; border-bottom-color:var(--primary-color); }
    .shtop .subtab.active ha-icon { color:var(--primary-color); }
    .shtop .subdot { width:6px; height:6px; }
    .shscene .sh-blink { animation:sh-bl 1.2s steps(2) infinite; }
    .shscene .sh-fade { animation:sh-bl 1.6s ease-in-out infinite; }
    .shscene .sh-leaf { transform-box:fill-box; transform-origin:50% 100%; animation:sh-sway 4s ease-in-out infinite; }
    .shscene .sh-up { animation:sh-up 1.4s ease-in-out infinite; }
    .shscene .sh-cloud { animation:sh-drift 4s ease-in-out infinite alternate; }
    .shscene .sh-pir { opacity:.14; animation:sh-pir 2s ease-in-out infinite; }
    .shscene .sh-glow { animation:sh-glow 3s ease-in-out infinite; }
    .shscene .sh-float, .shscene .sh-dust { animation:sh-float 3s ease-in-out infinite; }
    .shscene .sh-drive { animation:sh-drive 2s ease-in-out infinite; }
    .shscene :is(.sh-spin, .sh-rot, .sh-rot-rev, .sh-rot-fast, .sh-ping) { transform-box:fill-box; transform-origin:center; }
    .shscene .sh-spin { animation:sh-spin 1.6s linear infinite; }
    .shscene .sh-rot { animation:sh-spin 9s linear infinite; }
    .shscene .sh-rot-rev { animation:sh-spin 6s linear infinite reverse; }
    .shscene .sh-rot-fast { animation:sh-spin 1.4s linear infinite; }
    .shscene .sh-ping { animation:sh-ping 2s ease-out infinite; }
    @keyframes sh-bl { 50% { opacity:.2; } }
    @keyframes sh-sway { 0%, 100% { transform:rotate(-4deg); } 50% { transform:rotate(4deg); } }
    @keyframes sh-up { 50% { transform:translateY(-2px); } }
    @keyframes sh-drift { to { transform:translateX(4px); } }
    @keyframes sh-pir { 0%, 100% { opacity:.06; } 50% { opacity:.18; } }
    @keyframes sh-glow { 50% { opacity:.06; } }
    @keyframes sh-float { 50% { transform:translateY(-3px); } }
    @keyframes sh-drive { 0%, 100% { transform:translateX(2px); } 50% { transform:translate(-2px, -.5px); } }
    @keyframes sh-ping { from { transform:scale(1); opacity:.9; } to { transform:scale(2.6); opacity:0; } }
    @media (prefers-reduced-motion: reduce) { .shscene * { animation:none !important; } }
    /* The cards' charter, as the mockups: the tab's header card holds what opens it; tiles and rows are filled and
       rounded (tile B: a round icon, tinted unless all is well), an alert's row tinted and outlined; pill buttons;
       uppercase list titles */
    :host { --sh-sec: color-mix(in srgb, var(--primary-text-color) 6%, var(--card-background-color, #fff)); }
    .shtop .shbody { padding:12px 16px 16px; display:flex; flex-direction:column; gap:12px; }
    .tiles { gap:8px; }
    .tile { background:var(--sh-sec); box-shadow:none; border:1px solid transparent; border-radius:12px; min-height:56px; box-sizing:border-box;
            padding:8px 10px 8px 8px; gap:10px; }
    .tile .avatar { width:40px; height:40px; --mdc-icon-size:22px; }
    .tile:not(.warn):not(.bad):not(.info) .avatar { color:var(--primary-text-color); background:color-mix(in srgb, var(--secondary-text-color) 14%, transparent); }
    .tile .who .n b { font-weight:400; }
    .tile:is(.warn, .bad, .info) .who .n b { color:var(--tone-text); }
    ha-card.list { padding:12px 16px 14px; display:flex; flex-direction:column; gap:6px; }
    .list .lhead { padding:0 0 4px; min-height:30px; }
    .lhead .lname { font-size:12px; letter-spacing:.05em; text-transform:uppercase; color:var(--secondary-text-color); }
    .list .item { background:var(--sh-sec); border:1px solid transparent; border-radius:12px; min-height:56px; box-sizing:border-box; padding:8px 10px 8px 8px; gap:10px; }
    .list .item:is(.bad, .warn) { background:color-mix(in srgb, var(--tone) 9%, var(--sh-sec)); border-color:color-mix(in srgb, var(--tone) 22%, transparent); }
    .list .item.link:hover { background:color-mix(in srgb, var(--primary-color) 8%, var(--sh-sec)); }
    .list .item > :is(ha-icon:first-child, input[type='checkbox'] + ha-icon) { width:40px; height:40px; border-radius:50%; display:grid; place-items:center; --mdc-icon-size:22px;
                                        color:var(--tone-text, var(--primary-text-color));
                                        background:color-mix(in srgb, var(--tone, var(--secondary-text-color)) 16%, transparent); }
    .list .item.good > :is(ha-icon:first-child, input[type='checkbox'] + ha-icon) { color:var(--primary-text-color); background:color-mix(in srgb, var(--secondary-text-color) 14%, transparent); }
    .act { min-height:34px; box-sizing:border-box; padding:0 14px; border-radius:18px; }
    .lhead .act { min-height:30px; padding:0 12px; }
    .act.quiet { background:var(--sh-sec); }
    .sttile, .stic { border-radius:12px; }
    .stic { border-radius:50%; }
    /* Status: the counts in the header card, the areas to handle first, then a compact tile per area in four columns */
    .stkpis { grid-template-columns:repeat(5, minmax(0, 1fr)); }
    .stprio .stwhere { flex:none; font-size:12px; }
    .stgroups { display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:16px 12px; align-items:start; }
    .stgroup .stsec { display:flex; align-items:center; gap:8px; margin:0 4px 8px; font-size:14px; letter-spacing:0; text-transform:none; color:var(--primary-text-color); }
    .stgroup .stsec .muted { margin-left:auto; font-size:12px; font-weight:400; }
    .stgdot { width:8px; height:8px; border-radius:50%; flex:none; background:var(--tone); }
    .stgroup .stgrid { grid-template-columns:minmax(0, 1fr); gap:8px; }
    .sttile { flex-direction:row; align-items:center; gap:10px; min-height:56px; padding:8px 10px 8px 8px; border:1px solid transparent; background:var(--sh-sec); }
    .sttile:hover { border-color:transparent; background:color-mix(in srgb, var(--tone) 13%, var(--sh-sec)); }
    .sttile .stic { width:40px; height:40px; }
    .sttile.good .stic { color:var(--primary-text-color); background:color-mix(in srgb, var(--secondary-text-color) 14%, transparent); }
    .sttxt { flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; }
    .sttile .stname { font-size:14px; font-weight:500; line-height:1.25; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .sttile .stval { font-size:12px; line-height:1.25; color:var(--tone-text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .sttile.good .stval { color:var(--secondary-text-color); font-weight:400; }
    .sttile .stdet { font-size:12px; line-height:1.25; -webkit-line-clamp:1; }
    .sttile .stdot { position:absolute; top:8px; right:8px; width:7px; height:7px; box-shadow:none; }
    .sttile.good .stdot { display:none; }
    .shdots { display:inline-flex; gap:4px; margin-left:10px; vertical-align:middle; }
    .shdot { width:7px; height:7px; border-radius:50%; background:var(--tone); }
    /* Updates: kept as tiles, filled and rounded, each group in its card under an uppercase title */
    .mksec { padding:12px 16px 14px; display:flex; flex-direction:column; gap:10px; }
    .mksec > h2.stsec { margin:0; min-height:30px; display:flex; align-items:center; }
    .mksec .mkgrid { gap:8px; }
    .mksec .mkcard, .mksec .mkhead { background:var(--sh-sec); box-shadow:none; border:1px solid transparent; border-radius:12px; }
    .mksec .mkhead { padding:10px 12px; }
    .mksec .mkcard { padding:12px; }
    .mksec .mkcard.link:hover { background:color-mix(in srgb, var(--primary-color) 8%, var(--sh-sec)); }
    div.mklogo:not(.mkproj) { border-radius:50%; }
    .mksec :is(.mkcard, .mkhead) .act.quiet { background:var(--card-background-color, #fff); }
    /* System: the rings as tiles, the charts' titles as the sections' */
    .ring { background:var(--sh-sec); box-shadow:none; border:1px solid transparent; border-radius:12px; }
    .ctitle { font-size:12px; font-weight:500; letter-spacing:.05em; text-transform:uppercase; color:var(--secondary-text-color); }
    /* As the mockups: the page as wide, the rows and tiles denser, the status pills with their dot, two columns */
    main { max-width:1180px; }
    .list .item { min-height:48px; }
    .list .item .who .n { font-size:13.5px; font-weight:500; }
    .list .item .who .s { font-size:12px; }
    .tile .who .n { font-size:13.5px; }
    .tile .who .n b { font-size:20px; }
    .tile .who .s { font-size:12px; }
    .pill { display:inline-flex; align-items:center; gap:4px; padding:1px 8px; line-height:16px; }
    .pill::before { content:""; width:6px; height:6px; border-radius:50%; flex:none; background:var(--tone, var(--secondary-text-color)); }
    .shzooms { position:absolute; z-index:2; top:5px; right:5px; display:flex; gap:5px; }
    .shzoom { appearance:none; border:0; padding:0; cursor:pointer; width:24px; height:24px; border-radius:50%; display:grid; place-items:center;
              --mdc-icon-size:16px; color:#33506b; background:rgba(255,255,255,.55); box-shadow:inset 0 0 0 1px rgba(255,255,255,.7); }
    .shzoom:hover { background:rgba(255,255,255,.75); }
    .night .shzoom { color:#fff; background:rgba(255,255,255,.12); box-shadow:inset 0 0 0 1px rgba(255,255,255,.2); }
    .shcols { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:16px; align-items:start; }
    .shcols > * { min-width:0; margin:0; }
    ha-card.block > h2 { font-size:12px; font-weight:500; letter-spacing:.05em; text-transform:uppercase; color:var(--secondary-text-color); }
    @media (max-width:900px) { .shcols { grid-template-columns:minmax(0, 1fr); } }
    /* Settings, as its mockup: a card per group, two by two, its modules as filled rows */
    ha-card.block.cfg { background:none; box-shadow:none; border:0; padding:0; }
    .cfggrid { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:16px; align-items:start; margin-top:10px; }
    .cfgcard { background:var(--card-background-color, #fff); border:1px solid var(--divider-color, rgba(127,127,127,.15)); border-radius:var(--ha-card-border-radius, 12px);
               padding:12px 16px 14px; display:flex; flex-direction:column; gap:6px; min-width:0; }
    .cfgcard .cfggroup { display:flex; align-items:center; gap:6px; padding:0; min-height:30px; --mdc-icon-size:16px; }
    .cfgcard .cfggroup .icon-btn { --mdc-icon-size:18px; }
    .cfgcard .cfglist { gap:6px; }
    /* Settings → Display: the hint on as many lines as it needs, the choices under the row */
    .cfgcard .cfgrow.cfgdisplay .who .s { white-space:normal; }
    .cfgsegs { align-self:flex-start; margin-left:4px; }
    .scsegs { flex-wrap:wrap; --mdc-icon-size:16px; }
    .cfgcard .cfgrow { border:0; padding:6px 10px 6px 4px; border-radius:12px; background:var(--sh-sec); align-items:center; }
    .cfgcard .cfgrow > ha-icon { width:40px; height:40px; border-radius:50%; display:grid; place-items:center; --mdc-icon-size:22px; flex:none;
                                 color:var(--primary-color); background:color-mix(in srgb, var(--primary-color) 14%, transparent); }
    .cfgcard .cfgrow.off > ha-icon { color:var(--secondary-text-color); background:color-mix(in srgb, var(--secondary-text-color) 14%, transparent); }
    .cfgcard .cfgrow .who .n { font-size:13.5px; font-weight:500; }
    .cfgcard .cfgrow .who .s { font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .cfgcard .cfgrow.open { margin:0; background:color-mix(in srgb, var(--primary-color) 8%, var(--sh-sec)); }
    .cfgcard .cfgbody { padding:8px 4px 12px; }
    .cfgcard:has(.cfgrow.open) { grid-column:1 / -1; }
    @media (max-width:900px) { .cfggrid { grid-template-columns:minmax(0, 1fr); } }
    /* Logs, as its mockup: the integration's name as is beside its round icon, each message in its box */
    .lggroup .lhead > ha-icon { width:40px; height:40px; border-radius:50%; display:grid; place-items:center; --mdc-icon-size:22px; flex:none;
                                color:var(--tone-text); background:color-mix(in srgb, var(--tone) 16%, transparent); }
    .lggroup .lhead .lname { font-family:var(--code-font-family, monospace); font-size:14px; letter-spacing:0; text-transform:none; color:var(--primary-text-color); }
    .lggroup .lgentry { border-top:0; padding:0; gap:6px; }
    .lgtop { display:flex; align-items:center; gap:8px; min-width:0; }
    .lgtop .s { flex:1; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .lggroup .lgmsg { background:var(--sh-sec); border-radius:10px; padding:8px 10px; font-size:12.5px; }
    .who .s.mono { font-size:12px; }
    .item .side.fixed + .pill { margin-left:4px; }
    /* Sub-tabs, as the mockups (the heating card's zones): under the banner with a margin, each icon in its module's
       tone, the one shown underlined in that tone */
    .shtop .subtabs { margin:0 16px; padding:0; }
    .shtop .subtab { --zc:var(--tone-good); padding:8px 10px; }
    .shtop .subtab:has(.subdot.warn) { --zc:var(--tone-warn); }
    .shtop .subtab:has(.subdot.bad) { --zc:var(--tone-bad); }
    .shtop .subtab:has(.subdot.info) { --zc:var(--info-color, #039be5); }
    .shtop .subtab ha-icon, .shtop .subtab.active ha-icon { color:var(--zc); }
    .shtop .subtab.active { border-bottom-color:var(--zc); }
    .shtop .subdot { display:none; }
    /* One look for the controls of every tab, as the mockups: segmented choices on a filled track, the one picked
       raised on the card's background; search fields and lists filled pills; round icon buttons */
    .btabs, .segs { display:inline-flex; gap:4px; padding:3px; border-radius:12px; background:var(--sh-sec); overflow:visible; }
    .btab, .seg { padding:6px 10px; border-radius:9px; font-size:12.5px; font-weight:500; color:var(--secondary-text-color); background:none; }
    .btab.on, .seg.active { background:var(--card-background-color, #fff); color:var(--primary-text-color); box-shadow:0 1px 3px rgba(0, 0, 0, .15); }
    .box { border:0; border-radius:18px; background:var(--sh-sec); min-height:34px; padding:0 4px 0 12px; box-sizing:border-box; --mdc-icon-size:18px; color:var(--secondary-text-color); }
    .box:focus-within { box-shadow:inset 0 0 0 2px var(--primary-color); }
    .box input { font-size:13px; padding:6px 8px; color:var(--primary-text-color); }
    .ofilters select { border:0; border-radius:18px; background:var(--sh-sec); padding:7px 12px; font-size:13px; min-height:34px; }
    .icon-btn { border-radius:50%; }
    .icon-btn:hover:not([disabled]) { background:color-mix(in srgb, var(--secondary-text-color) 16%, transparent); color:var(--primary-text-color); }
    .shtop .shbody .msg { font-size:12px; }
    .bgroup .ghead .gname { font-size:12px; font-weight:500; letter-spacing:.05em; text-transform:uppercase; color:var(--secondary-text-color); }
    .bgroup .ghead { --mdc-icon-size:16px; color:var(--secondary-text-color); min-height:30px; }
    /* The round icons in their tone itself, as the mockups (the text keeps its readable shade) */
    .list .item:is(.bad, .warn, .info) > :is(ha-icon:first-child, input[type='checkbox'] + ha-icon), .tile:is(.bad, .warn, .info) .avatar,
    .sttile:is(.bad, .warn, .info) .stic, .lggroup .lhead > ha-icon { color:var(--tone); }
    /* Settings: its title and how to order the tabs are in the banner */
    ha-card.block.cfg > h2, ha-card.block.cfg > .msg { display:none; }
    ha-card.block.cfg .cfggrid { margin-top:0; }
    /* Database, as its mockup: the checkbox then the bar beside the name, the counts small at the right */
    .tiles { grid-template-columns:repeat(auto-fit, minmax(170px, 1fr)); }
    .list .item.dbrow > ha-icon:first-child { width:auto; height:auto; background:none; --mdc-icon-size:20px; color:var(--secondary-text-color); }
    .dbrow.on > ha-icon:first-child { color:var(--primary-color); }
    :is(.dbrow, .dbtable) .who { display:grid; grid-template-columns:minmax(0, 1fr) minmax(80px, 38%); column-gap:16px; align-items:center; }
    :is(.dbrow, .dbtable) .who > :not(.dbbar) { grid-column:1; }
    :is(.dbrow, .dbtable) .who .dbbar { grid-column:2; grid-row:1 / span 2; margin:0; }
    .dbcount { font-size:12px; color:var(--secondary-text-color); min-width:64px; }
    .dbcount b { font-size:13px; font-weight:500; color:var(--primary-text-color); }
    .dbents { border-left:0; margin-left:28px; display:flex; flex-direction:column; gap:6px; }
    .dbdev { gap:6px; padding-right:0; border-radius:12px; }
    .dbdev.on { background:none; }
    .dbtable { padding-right:10px; }
    .dbtable .who .n { font-family:var(--code-font-family, monospace); font-size:13px; }
    /* System's rings, as its mockup: a compact 64 px ring, the name under it, the last 24 hours as a thin line below */
    .ring { padding:12px 10px 34px; gap:4px; }
    .ring .gauge { width:64px; height:64px; }
    .ring .gauge circle { stroke-width:8; }
    .ring .rv { top:12px; height:64px; }
    .ring .rv b { font-size:16px; }
    .ring .rv span { font-size:10px; margin-top:3px; }
    .ring .rl { font-size:13.5px; }
    .ring .behind { height:30px; }
    .ring .behind polygon { opacity:.08; }
    /* Logs, as its mockup: one row per integration (its name, the first message's count, time and logger, its pills,
       Reload and Ignore), the message in its box under it */
    .lggroup { padding:8px 10px 10px; gap:8px; }
    .lggroup .lgrow { background:none; border:0; padding:0; min-height:48px; }
    .lggroup .lgrow:is(.bad, .warn) { background:none; border:0; }
    .lggroup .lgname { font-family:var(--code-font-family, monospace); font-size:13.5px; }
    .lggroup .lgentry { margin-left:0; }
    .lggroup .lgrow .act { min-height:32px; }
    /* <ha-icon> is an inline element whose icon sits on the line's middle: as a box of its own, it is centred in its
       round badge instead of riding a few pixels high */
    ha-icon { display:inline-flex; align-items:center; justify-content:center; flex:none; line-height:0; }
    @media (max-width:900px) { .stgroups { grid-template-columns:repeat(2, minmax(0, 1fr)); } .stkpis { grid-template-columns:repeat(3, minmax(0, 1fr)); } }
    @media (max-width:600px) { .stgroups { grid-template-columns:minmax(0, 1fr); } .stkpis { grid-template-columns:repeat(2, minmax(0, 1fr)); } .shdots { display:none; } }
`;

export var SH_BANNER_METHODS = {
  // The header of the tab shown: the module's status (its Status area) as its pill and subtitle, and the sub-tabs
  // of its group under it. `over` draws another tab's, or another title, pill, subtitle and corner buttons on it (the
  // diff viewer's header is Versioning's)
  _banner(over = {}) {
    if (!this._state?.loaded) return '';
    var tab = over.tab || this._tab;
    var night = Boolean(this._hass?.themes?.darkMode);
    var tone = 'good';
    var pill = '';
    var sub = '';
    var extra = {};
    var statusTitle = '';
    var dots = '';
    if (tab === 'status') {
      var { areas, counts, score, tone: ringTone } = this._stTone();
      var points = counts.bad + counts.warn + counts.info;
      tone = ringTone;
      // As its mockup: the points to check as the title, the critical and to-watch counts as the pill, Home Assistant's
      // version and uptime then one dot per area under it
      statusTitle = points ? this._t(points === 1 ? 'st_point' : 'st_points', { n: points }) : this._t('st_all_good');
      pill = [
        ['bad', 'st_n_bad'],
        ['warn', 'st_n_warn'],
      ]
        .filter(([t]) => counts[t])
        .map(([t, key]) => this._t(key, { n: counts[t] }))
        .join(' · ');
      if (!pill) pill = `${score} / 100`;
      sub = this._stMeta().join(' · ');
      dots = areas.map(([t, [areaTone]]) => `<span class="shdot ${areaTone}" title="${shEsc(this._tabName(t))}"></span>`).join('');
      // The worst tone of each group of modules: the lines of the screen
      var worst = (list) => (list.includes('bad') ? 'bad' : list.includes('warn') ? 'warn' : list.includes('info') ? 'info' : 'good');
      extra = { score, groups: Object.keys(SH_GROUPS).map((g) => worst(areas.filter(([t]) => shGroupOf(t) === g).map(([, a]) => a[0]))) };
    } else if (tab === 'settings') {
      // As its mockup: the modules turned on out of all of them as the pill, how to order them as the subtitle
      tone = 'idle';
      var all = Object.keys(SH_MODULE_ICONS).filter((t) => t !== 'status' && t !== 'settings');
      var on = all.filter((t) => t === 'system' || (this._state.modules || []).includes(t));
      pill = `${on.length} / ${all.length} · ${this._t('modules_tabs')}`;
      sub = this._t('modules_tabs_hint');
    } else {
      var area = this._stArea(tab);
      if (area) [tone, pill, sub] = area;
      if (tab === 'marketplace') {
        var mk = this._state.marketplace || {};
        // Installs running (the tab's Update all, or the Marketplace's): which one of how many as the pill, the
        // delivery truck at the shelves
        var run = this._updRunNow() || (mk.installing_updates || mk.backing_up ? this._mkRunNow(mk) : null);
        if (run) {
          tone = 'info';
          pill = run.backup ? this._t('mk_backing_up') : this._t('mk_installing', { n: run.n, total: run.total, name: run.name || '' });
        }
        extra = { installing: Boolean(run), count: (mk.list || []).length + (this._state.system_updates?.available || []).length };
      }
      if (tab === 'backups') extra = { failing: Boolean(this._bkSummary?.()?.failing?.length) };
    }
    var [day, dark, floor] = SH_WALLS[tab] || SH_WALLS.status;
    var hex = SH_TONE_HEX[tone] || SH_TONE_HEX.good;
    // The Status tab: its wall takes a little of the overall tone
    var wall = night ? dark : day;
    if (tab === 'status' && tone !== 'good') wall = `color-mix(in srgb, ${hex} ${night ? 14 : 9}%, ${wall})`;
    var title = over.title || (tab === 'status' ? statusTitle : this._tabName(tab));
    if (over.pill !== undefined) pill = over.pill;
    if (over.sub !== undefined) sub = over.sub;
    var buttons = over.buttons ?? `<button class="shzoom" data-action="reload" title="${shEsc(this._t('refresh'))}" aria-label="${shEsc(this._t('refresh'))}"><ha-icon icon="mdi:refresh"></ha-icon></button>`;
    var scene = `${shDecor(SH_DECOR[tab] || 'A', night)}<g transform="translate(160 0)">${shScene(tab, tone, night, extra)}</g>`;
    return `<div class="shbanner ${tone}${night ? ' night' : ''}" style="--sh-wall:${wall}">
      <svg class="shscene" viewBox="0 0 360 80" preserveAspectRatio="xMaxYMax slice" aria-hidden="true" focusable="false">${scene}</svg>
      <div class="shground g-${floor}"></div>
      <div class="shzooms">${buttons}</div>
      <div class="shhead"><span class="shbadge" aria-hidden="true"><ha-icon icon="${SH_MODULE_ICONS[tab] || SH_MODULE_ICONS.status}"></ha-icon></span>
        <div class="shtitles"><div class="shtrow"><span class="shtitle">${shEsc(title)}</span>${pill ? `<span class="shpill">${shEsc(pill)}</span>` : ''}</div>
          ${sub || dots ? `<span class="shsub">${shEsc(sub)}${dots ? `<span class="shdots">${dots}</span>` : ''}</span>` : ''}</div></div></div>`;
  },
};
Object.assign(SystemHubPanel.prototype, SH_BANNER_METHODS);
SystemHubPanel.STYLE += SH_BANNER_STYLE;
