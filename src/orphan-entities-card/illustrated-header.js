// ── Illustrated header (same as the Status card's, system-hub-card.js) ──
// A 90 px banner wraps the card's own header (icon, title, status pill, subtitle, buttons): the card's picture at its
// right (this card's part of the Status picture, large, in the card's tone), a 10 px concrete floor edge to
// edge under it, the header on the open background at its left and its buttons as small frosted buttons in the top
// right corner. Night: illustration_theme, else the dark theme. `illustration: false`
// keeps the classic header. Applied to the rendered markup, so that it fits every card's own render.
export var SHB_COLORS = { good: '#43a047', warn: '#f5a623', bad: '#e5484d', info: '#2f80ed', idle: '#8a96a6' };
export var SHB_TONES = { ok: 'good', good: 'good', clean: 'good', success: 'good', up_to_date: 'good', warn: 'warn', warning: 'warn', pending: 'warn', dirty: 'warn',
  alert: 'bad', crit: 'bad', critical: 'bad', error: 'bad', bad: 'bad', failed: 'bad', fail: 'bad', na: 'idle', muted: 'idle', unknown: 'idle', idle: 'idle', info: 'info' };
export var SHB_GLYPHS = {
  git: 'M13,14C9.64,14 8.54,15.35 8.18,16.24C9.25,16.7 10,17.76 10,19A3,3 0 0,1 7,22A3,3 0 0,1 4,19C4,17.69 4.83,16.58 6,16.17V7.83C4.83,7.42 4,6.31 4,5A3,3 0 0,1 7,2A3,3 0 0,1 10,5C10,6.31 9.17,7.42 8,7.83V13.12C8.88,12.47 10.16,12 12,12C14.67,12 15.56,10.66 15.85,9.77C14.77,9.32 14,8.25 14,7A3,3 0 0,1 17,4A3,3 0 0,1 20,7C20,8.34 19.12,9.5 17.91,9.86C17.65,11.29 16.68,14 13,14M7,18A1,1 0 0,0 6,19A1,1 0 0,0 7,20A1,1 0 0,0 8,19A1,1 0 0,0 7,18M7,4A1,1 0 0,0 6,5A1,1 0 0,0 7,6A1,1 0 0,0 8,5A1,1 0 0,0 7,4M17,6A1,1 0 0,0 16,7A1,1 0 0,0 17,8A1,1 0 0,0 18,7A1,1 0 0,0 17,6Z',
  orphans: 'M13.04 19.61C12.67 18.55 11.68 17.8 10.5 17.8C9 17.8 7.8 19 7.8 20.5V22H4C2.9 22 2 21.11 2 20V16.2H3.5C5 16.2 6.2 15 6.2 13.5S5 10.8 3.5 10.8H2V7C2 5.9 2.9 5 4 5H8V3.5C8 2.12 9.12 1 10.5 1S13 2.12 13 3.5V5H17C18.1 5 19 5.89 19 7V11H20.5C21.88 11 23 12.12 23 13.5C23 13.82 22.94 14.12 22.83 14.39C21.79 13.53 20.46 13 19 13C15.69 13 13 15.69 13 19C13 19.2 13 19.41 13.04 19.61M21.12 15.46L19 17.59L16.88 15.46L15.47 16.88L17.59 19L15.47 21.12L16.88 22.54L19 20.41L21.12 22.54L22.54 21.12L20.41 19L22.54 16.88L21.12 15.46Z',
  automations: 'M17.5 15.5C17.5 16.61 16.61 17.5 15.5 17.5S13.5 16.61 13.5 15.5 14.4 13.5 15.5 13.5 17.5 14.4 17.5 15.5M8.5 13.5C7.4 13.5 6.5 14.4 6.5 15.5S7.4 17.5 8.5 17.5 10.5 16.61 10.5 15.5 9.61 13.5 8.5 13.5M23 15V18C23 18.55 22.55 19 22 19H21V20C21 21.11 20.11 22 19 22H5C3.9 22 3 21.11 3 20V19H2C1.45 19 1 18.55 1 18V15C1 14.45 1.45 14 2 14H3C3 10.13 6.13 7 10 7H11V5.73C10.4 5.39 10 4.74 10 4C10 2.9 10.9 2 12 2S14 2.9 14 4C14 4.74 13.6 5.39 13 5.73V7H14C17.87 7 21 10.13 21 14H22C22.55 14 23 14.45 23 15M21 16H19V14C19 11.24 16.76 9 14 9H10C7.24 9 5 11.24 5 14V16H3V17H5V20H19V17H21V16Z',
};

export function shbIsNight(hass, config) {
  if (config?.illustration_theme === 'night') return true;
  if (config?.illustration_theme === 'day') return false;
  return !!hass?.themes?.darkMode;
}

// The card's part of the Status picture as a small scene of its own, drawn like the Status one: a main piece in the
// colour of the card's status, the pieces it watches around it on dashed links. The top right corner stays clear
// for the header's buttons.
export function shbScene(scene, tone, n) {
  var c = SHB_COLORS[tone] || SHB_COLORS.good;
  var good = SHB_COLORS.good;
  var blue = '#2f80ed';
  var ok = tone === 'good' || tone === 'info';
  var bad = tone === 'bad';
  var line = n ? '#2e3a4e' : '#c9d2de';
  var face = n ? '#3a4456' : '#fff';
  var edge = n ? '#55617a' : '#c9d2de';
  var ink = n ? '#e6e9ee' : '#2a3038';
  var dim = n ? '#2e3a4e' : '#dfe6ef';
  var cell = n ? '#8fa3c4' : '#5f6b7a';
  var at = (x, y, body, s) => `<g transform="translate(${x} ${y})${s ? ` scale(${s})` : ''}">${body}</g>`;
  var tile = (w, h, inner, stroke) => `<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="${Math.min(5, h / 4)}" fill="${face}" stroke="${stroke || edge}"/>${inner || ''}`;
  var icon = (d, col, size) => `<path transform="translate(${-size / 2} ${-size / 2}) scale(${size / 24})" d="${d}" fill="${col}"/>`;
  var led = (x, y, col, blink) => `<circle${blink ? ' class="shb-blink"' : ''} cx="${x}" cy="${y}" r="1.5" fill="${col}"/>`;
  var links = (...l) => `<g stroke="${line}" stroke-width="1" stroke-dasharray="2 2">${l.map(([a, b, x, y]) => `<line x1="${a}" y1="${b}" x2="${x}" y2="${y}"/>`).join('')}</g>`;
  var ping = (r) => (ok ? `<circle class="shb-ping" r="${r}" fill="none" stroke="${good}" stroke-width=".8"/>` : '');
  var pop = (x, y, text) => `<g class="shb-pop"><circle cx="${x}" cy="${y}" r="4" fill="${c}"/><text x="${x}" y="${y + 1.8}" text-anchor="middle" font-size="5.4" font-weight="700" fill="#fff" font-family="sans-serif">${text}</text></g>`;
  var battery = (lv, col, blink) =>
    `<rect x="-6" y="-10" width="12" height="20" rx="2" fill="${face}" stroke="${cell}" stroke-width="1.4"/><rect x="-2" y="-12" width="4" height="2" fill="${cell}"/><rect${blink ? ' class="shb-blink"' : ''} x="-4" y="${8 - lv}" width="8" height="${lv}" rx="1" fill="${col}"/>`;
  var mark = bad ? 'M-2 -2.6 l4 4 M2 -2.6 l-4 4' : tone === 'warn' ? 'M0 -3 v2.8 M0 2 v.2' : 'M-2.2 -.4 l1.6 1.6 l3 -3.2';
  var shield = `<path d="M0 -8 l6.4 2.4 v4.4 c0 4 -2.8 6.6 -6.4 8.2 c-3.6 -1.6 -6.4 -4.2 -6.4 -8.2 v-4.4z" fill="${c}" stroke="${n ? '#1c2230' : '#fff'}" stroke-width=".8"/><path d="${mark}" stroke="#fff" stroke-width="1.5" stroke-linecap="round" fill="none"/>`;
  // The pieces around the main one: left top, left bottom, right bottom; the main one sits at (142 50).
  var hub = (inner, w = 34, h = 30) => at(142, 50, tile(w, h, inner, bad ? c : edge));
  var around = links([125, 44, 110, 30], [125, 56, 112, 60], [159, 54, 168, 57]);
  var body;
  if (scene === 'watchdog') {
    var piece = (col, blink, spin) =>
      tile(20, 18, `${icon(SHB_PUZZLE, n ? '#8fa3c4' : '#7a8899', 10)}${led(6.5, 5, col, blink)}${spin ? `<path class="shb-spin" d="M-10 -13.5 a4.5 4.5 0 1 1 -4.5 4.5" stroke="${col}" stroke-width="1.3" fill="none" stroke-linecap="round"/>` : ''}`);
    body = `${around}${at(100, 26, piece(good))}${at(100, 60, piece(ok ? good : c, !ok, !ok))}${at(178, 58, piece(good))}${at(142, 50, `${shield}${ping(10)}`, 1.9)}`;
  } else if (scene === 'batteries') {
    var level = bad ? 3 : tone === 'warn' ? 6 : 14;
    body = `${at(98, 61, battery(15, good), 0.75)}${at(118, 58, battery(11, good), 0.95)}${at(146, 50, battery(level, c, bad), 1.45)}${at(176, 59, battery(13, good), 0.85)}${ok ? at(146, 50, ping(16)) : ''}`;
  } else if (scene === 'marketplace') {
    var arrow = (col) => `<circle r="7" fill="${face}" stroke="${col}"/><path class="shb-up" d="M0 3 v-6 m-3 3 l3 -3 l3 3" stroke="${col}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`;
    body = `${around}${at(100, 26, arrow(blue))}${at(100, 60, arrow(ok ? blue : c))}${at(178, 58, arrow(blue))}${hub(`${icon(SHB_STORE, blue, 18)}${ok ? '' : pop(15, -13, '!')}`)}${ok ? at(142, 50, ping(19)) : ''}`;
  } else if (scene === 'system') {
    var fill = bad ? 92 : tone === 'warn' ? 70 : 38;
    var chip = tile(18, 18, `<rect x="-4.5" y="-4.5" width="9" height="9" rx="1.5" fill="${blue}"/><g stroke="${edge}" stroke-width="1">${[-3, 0, 3].map((v) => `<line x1="${v}" y1="-9" x2="${v}" y2="-11"/><line x1="${v}" y1="9" x2="${v}" y2="11"/>`).join('')}</g>`);
    var spark = tile(24, 15, `<path d="M-9 3 l4 -3 l3 2 l4 -6 l3 4 l4 -2" stroke="${blue}" stroke-width="1.3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`);
    var bars = [6, 10, 7].map((h, i) => `<rect x="${-8 + i * 6}" y="${-h}" width="4.4" height="${h}" rx="1" fill="${i === 1 ? c : blue}"/>`).join('');
    body = `${links([128, 42, 110, 30], [126, 56, 113, 60], [158, 54, 168, 57])}${at(100, 26, chip)}${at(100, 60, spark)}${at(178, 64, bars)}${at(142, 50, `<circle r="15" fill="${face}" stroke="${dim}" stroke-width="4.5"/><circle class="shb-gauge" r="15" fill="none" stroke="${c}" stroke-width="4.5" stroke-dasharray="${((fill * 94.2) / 100).toFixed(1)} 100" transform="rotate(-90)"/><path d="M-6 3 l3.5 -4 l3 2.5 l5 -6.5" stroke="${ink}" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`)}`;
  } else if (scene === 'git') {
    var commit = (x, y, col, r = 3.2) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${col || face}" stroke="${col || cell}" stroke-width="1.2"/>`;
    var file = tile(18, 21, `<g stroke="${edge}" stroke-width="1.2" stroke-linecap="round"><line x1="-4.5" y1="-4" x2="4.5" y2="-4"/><line x1="-4.5" y1="0" x2="2.5" y2="0"/><line x1="-4.5" y1="4" x2="3.5" y2="4"/></g>`);
    body = `<g stroke="${cell}" stroke-width="1.4" fill="none"><path d="M92 62 H186"/><path d="M122 62 C130 62 130 42 140 42 H152 C162 42 162 62 170 62"/></g>${commit(98, 62)}${commit(122, 62)}${commit(146, 62)}${commit(170, 62)}${commit(140, 42, blue)}${at(156, 42, `<circle class="${ok ? '' : 'shb-blink'}" r="4.6" fill="${c}" stroke="${n ? '#1c2230' : '#fff'}" stroke-width="1"/>${ping(7)}`)}${links([108, 32, 132, 41])}${at(100, 26, `${file}${ok ? '' : pop(8, -9, '±')}`)}`;
  } else if (scene === 'orphans') {
    var loose = (col, blink) => `<rect x="-10" y="-9" width="20" height="18" rx="4.5" fill="none" stroke="${edge}" stroke-dasharray="2 2"/><g${blink ? ' class="shb-blink"' : ''}>${icon(SHB_PUZZLE, col, 11)}</g>`;
    body = `${around}${at(100, 26, loose(ok ? good : c, !ok))}${at(100, 60, loose(ok ? good : c))}${at(178, 58, loose(good))}${hub(`${icon(SHB_PUZZLE, blue, 18)}${led(12, 10, ok ? good : c, !ok)}`)}${ok ? at(142, 50, ping(19)) : ''}`;
  } else {
    var bolt = tile(16, 16, `<path d="M1.5 -5.5 L-3 1 H0 L-1.5 5.5 L3 -1 H0z" fill="#f5b400"/>`);
    var gear = tile(16, 16, `<circle r="3.6" fill="none" stroke="${cell}" stroke-width="2.4" stroke-dasharray="1.6 1.2"/><circle r="1.4" fill="${cell}"/>`);
    var bulb = tile(16, 16, `<circle cy="-1" r="3.4" fill="${ok ? '#f5b400' : face}" stroke="${ok ? '#f5b400' : cell}"/><rect x="-1.6" y="2.6" width="3.2" height="2.2" fill="${cell}"/>`);
    body = `${around}${at(100, 26, bolt)}${at(100, 60, gear)}${at(178, 58, bulb)}${hub(`${icon(SHB_GLYPHS[scene] || SHB_GLYPHS.automations, blue, 18)}${led(12, 10, ok ? good : c, !ok)}`)}${ok ? at(142, 50, ping(19)) : ''}`;
  }
  return `<svg class="shb-scene" viewBox="0 0 200 80" preserveAspectRatio="xMaxYMax meet" aria-hidden="true" focusable="false">${body}</svg>`;
}
export var SHB_PUZZLE =
  'M20.5,11H19V7C19,5.89 18.1,5 17,5H13V3.5A2.5,2.5 0 0,0 10.5,1A2.5,2.5 0 0,0 8,3.5V5H4A2,2 0 0,0 2,7V10.8H3.5C5,10.8 6.2,12 6.2,13.5C6.2,15 5,16.2 3.5,16.2H2V20A2,2 0 0,0 4,22H7.8V20.5C7.8,19 9,17.8 10.5,17.8C12,17.8 13.2,19 13.2,20.5V22H17A2,2 0 0,0 19,20V16H20.5A2.5,2.5 0 0,0 23,13.5A2.5,2.5 0 0,0 20.5,11Z';
export var SHB_STORE = 'M12,18H6V14H12M21,14V12L20,7H4L3,12V14H4V20H14V14H18V20H20V14M20,4H4V6H20V4Z';

// The editor's two fields for the illustrated header, labelled with the integration's strings (the Status card's).
export function shbLocal(hass, key, fallback) {
  try {
    return hass?.localize?.(`component.system_hub.selector.panel.options.${key}`) || fallback;
  } catch (_err) {
    return fallback;
  }
}
export function shbFields(hass) {
  var themes = { auto: 'Automatic (sun or dark theme)', day: 'Day', night: 'Night' };
  return [
    { name: 'illustration', selector: { boolean: {} } },
    { name: 'illustration_theme', selector: { select: { mode: 'dropdown', options: ['auto', 'day', 'night'].map((v) => ({ value: v, label: shbLocal(hass, `card_theme_${v}`, themes[v]) })) } } },
  ];
}
export function shbLabel(hass, name) {
  if (name === 'illustration') return shbLocal(hass, 'card_illustration', 'Illustration');
  if (name === 'illustration_theme') return shbLocal(hass, 'card_illustration_theme', 'Illustration theme');
  return null;
}

export function shbData(data) {
  return { illustration: true, illustration_theme: 'auto', ...data };
}
// Keeps the YAML minimal: the illustrated header's options left at their default are dropped.
export function shbClean(config) {
  if (config && config.illustration === true) delete config.illustration;
  if (config && (!config.illustration_theme || config.illustration_theme === 'auto')) delete config.illustration_theme;
  return config;
}

// The end of the element opened at `start` (balanced <div>s), or -1.
export function shbClose(html, start) {
  var re = /<div\b|<\/div>/g;
  re.lastIndex = start;
  var depth = 0;
  var m;
  while ((m = re.exec(html))) {
    depth += m[0] === '</div>' ? -1 : 1;
    if (!depth) return m.index + 6;
  }
  return -1;
}

// Wraps the card's header in the banner. o: { hass, config, scene, tone?, pad? } — pad: the card's padding ('12px' or
// '12px 16px'), cancelled so that the banner runs edge to edge.
export function shBanner(html, o) {
  if (o.config?.illustration === false) return html;
  var card = /<ha-card\b[^>]*>/.exec(html);
  if (!card) return html;
  var head = /<div class="(head|header|mini)(?:\s[^"]*)?">/g;
  head.lastIndex = card.index + card[0].length;
  var m = head.exec(html);
  if (!m || /\bpopup\b/.test(card[0])) return html;
  var end = shbClose(html, m.index);
  if (end < 0) return html;
  var tone = o.tone;
  if (!tone) {
    var word = /\b(?:lvl|st)-(\w+)/.exec(card[0])?.[1] || /class="(?:logo|badge) (\w+)/.exec(html.slice(m.index, end))?.[1];
    tone = SHB_TONES[word] || 'good';
  }
  var night = shbIsNight(o.hass, o.config);
  var [py, px = py] = String(o.pad || '12px').split(/\s+/);
  var banner = `<div class="banner sh-banner shb-${tone}${night ? ' night' : ''}" style="--shb-py:${py};--shb-px:${px}">${shbScene(o.scene, tone, night)}<div class="shb-ground"></div><div class="shb-htext">${html.slice(m.index, end)}</div></div>`;
  return `${html.slice(0, m.index)}${banner}${html.slice(end)}<style>${SHB_STYLE}</style>`;
}

export var SHB_STYLE = `
  .sh-banner { position:relative; overflow:hidden; height:90px; flex:none; box-sizing:border-box; display:flex; align-items:center;
               margin:calc(-1 * var(--shb-py)) calc(-1 * var(--shb-px)) 8px; padding:0 calc(min(200px, 62%) * .62) 10px 14px;
               border-radius:var(--ha-card-border-radius, 12px) var(--ha-card-border-radius, 12px) 0 0;
               background:linear-gradient(90deg, #f4f7fb 0%, #eef2f7 45%, #e4eaf2 100%); color:#0d2a45; container:shb / inline-size; --shb-tone:${SHB_COLORS.good}; }
  /* Nothing under the banner (a mini card folded): the card ends on its ground strip */
  .sh-banner:last-child { margin-bottom:calc(-1 * var(--shb-py)); }
  .sh-banner.night { background:linear-gradient(90deg, #222a3a 0%, #1c2230 50%, #161b27 100%); color:#fff; }
  .sh-banner.shb-warn { --shb-tone:${SHB_COLORS.warn}; } .sh-banner.shb-bad { --shb-tone:${SHB_COLORS.bad}; }
  .sh-banner.shb-info { --shb-tone:${SHB_COLORS.info}; } .sh-banner.shb-idle { --shb-tone:${SHB_COLORS.idle}; }
  .shb-scene { position:absolute; right:0; bottom:10px; height:80px; width:min(200px, 62%); pointer-events:none;
               -webkit-mask-image:linear-gradient(90deg, transparent 0, #000 18%); mask-image:linear-gradient(90deg, transparent 0, #000 18%); }
  .shb-ground { position:absolute; left:0; right:0; bottom:0; height:10px; background:#9aa1a9; box-shadow:inset 0 2px 0 #b5bbc2; }
  .night .shb-ground { background:#2c323b; box-shadow:none; }
  .shb-htext { flex:1 1 auto; min-width:0; }
  .shb-htext > *, .sh-banner .head, .sh-banner .header { position:static !important; margin:0 !important; padding:0 !important; min-height:0 !important;
               background:none !important; border:0 !important; box-shadow:none !important; }
  .sh-banner :is(.badge, .logo) { width:40px !important; height:40px !important; flex:none; border-radius:50% !important; display:grid !important; place-items:center;
               background:rgba(255,255,255,.62) !important; box-shadow:inset 0 0 0 1px color-mix(in srgb, var(--shb-tone) 22%, transparent) !important;
               color:var(--shb-tone) !important; fill:var(--shb-tone) !important; --mdc-icon-size:24px; }
  .sh-banner.night :is(.badge, .logo) { background:rgba(255,255,255,.12) !important; }
  .sh-banner :is(.title, .name) { color:inherit !important; }
  .sh-banner :is(.subtitle, .sub) { color:#3b5b78 !important; }
  .sh-banner.night :is(.subtitle, .sub) { color:rgba(255,255,255,.78) !important; }
  .sh-banner :is(.head, .header, .mini) > :is(button, ha-icon-button, a.btn), .sh-banner .mini .head > :is(button, ha-icon-button) {
               position:absolute !important; z-index:2; top:5px; right:5px; width:24px !important; height:24px !important; min-width:0 !important; margin:0 !important;
               padding:0 !important; border:0 !important; border-radius:50% !important; display:grid !important; place-items:center; cursor:pointer;
               background:rgba(255,255,255,.55) !important; box-shadow:inset 0 0 0 1px rgba(255,255,255,.7) !important; backdrop-filter:blur(4px);
               color:#33506b !important; fill:#33506b !important; --mdc-icon-size:16px; }
  .sh-banner :is(button, ha-icon-button) :is(svg, ha-icon) { width:16px !important; height:16px !important; }
  .sh-banner :is(.head, .header, .mini) > :is(button, ha-icon-button):nth-last-of-type(2) { right:33px; }
  .sh-banner :is(.head, .header, .mini) > :is(button, ha-icon-button):nth-last-of-type(3) { right:61px; }
  .sh-banner.night :is(.head, .header, .mini) > :is(button, ha-icon-button) { background:rgba(255,255,255,.12) !important; box-shadow:inset 0 0 0 1px rgba(255,255,255,.2) !important; color:#fff !important; fill:#fff !important; }
  /* The chips on one line: one that does not fit wraps out of sight instead of being cut (the full view has them all);
     a single chip too long for the line ends in an ellipsis */
  .sh-banner .rs { flex-wrap:wrap !important; align-items:center; row-gap:40px !important; max-height:22px; overflow:hidden; margin-top:3px !important; }
  .sh-banner .rs > * { flex:none; max-width:100%; }
  @container shb (max-width: 170px) { .shb-scene { display:none; } .sh-banner { padding-right:14px; } }
  .shb-blink { animation:shb-bl 1.2s steps(2) infinite; }
  .shb-gauge, .shb-pop { animation:shb-bl 3s ease-in-out infinite; }
  .shb-up { animation:shb-up 1.4s ease-in-out infinite; }
  .shb-spin { transform-box:fill-box; transform-origin:center; animation:shb-spin 2s linear infinite; }
  @keyframes shb-spin { to { transform:rotate(360deg); } }
  .shb-ping { transform-box:fill-box; transform-origin:center; animation:shb-ping 2.4s ease-out infinite; }
  @keyframes shb-bl { 50% { opacity:.3; } }
  @keyframes shb-up { 50% { transform:translateY(-1.5px); } }
  @keyframes shb-ping { from { opacity:.8; transform:scale(.7); } to { opacity:0; transform:scale(1.25); } }
  @media (prefers-reduced-motion: reduce) { .shb-scene * { animation:none !important; } }
`;
