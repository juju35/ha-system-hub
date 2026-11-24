// The illustrated header: a home server's dashboard on a 200 × 80 picture at the right of a 90 px banner (the host,
// the health score ring, the containers, the batteries, the updates and the watchdog, each in the tone of its Status
// area), a 10 px concrete floor edge to edge under it, and the title on the open background at its left.
export var SH_HUB_COLORS = { good: '#43a047', warn: '#f5a623', bad: '#e5484d', info: '#2f80ed' };
export var SH_HUB_LED = { good: '#43c463', warn: '#f5a623', bad: '#e5484d', info: '#43c463' };

// Night picture: forced by illustration_theme, else Home Assistant's dark mode alone (a light theme keeps the day
// picture after sunset; a day picture on a dark card would glare).
export function shHubIsNight(hass, config) {
  if (config?.illustration_theme === 'night') return true;
  if (config?.illustration_theme === 'day') return false;
  return !!hass?.themes?.darkMode;
}

// The tone of each part of the picture: its Status area when the module is on (whatever groups the card shows),
// else fine. `score` (0–100) fills the ring, in the overall tone.
export function shHubTones(status) {
  var of = (tab) => status.all.find(([t]) => t === tab)?.[1] || ['good', ''];
  return { tone: status.tone, score: status.score, system: of('system'), containers: of('containers'), batteries: of('batteries'), updates: of('marketplace'), watchdog: of('watchdog') };
}

export function shHubScene(t, n) {
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
