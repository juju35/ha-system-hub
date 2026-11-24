// ── Illustrated header ─────────────────────────────────────────────────────────────────────────────────────────────
// Each tab opens on a 90 px header drawn like the ha-* cards' (ha-room-card's scene.js): the module's icon, its name
// and its status pill on a wall, a 360 × 80 scene at the right (some furniture, then the module's own piece, which
// follows its status) and a 10 px floor. Night (darker walls, stars, a lit lamp) with Home Assistant's dark theme.
// The scenes hold no id (no gradient, no mask) and stop moving with prefers-reduced-motion.
export var SH_TONE_HEX = { good: '#43a047', warn: '#f5b400', bad: '#e5484d', info: '#2f80ed', idle: '#8a96a6' };
// The wall [day, night] and floor of each tab
export var SH_WALLS = {
  status: ['#eef1f6', '#262c3a', 'parquet'],
  system: ['#eef1f6', '#262c3a', 'concrete'],
  containers: ['#e4e6ea', '#22262e', 'concrete'],
  database: ['#f2efe9', '#2a2b33', 'parquet'],
  security: ['#f3ede4', '#2b2a33', 'parquet'],
  logs: ['#eef1f6', '#262c3a', 'parquet'],
  watchdog: ['#f4ede3', '#2a2f3d', 'parquet'],
  automations: ['#eef3f4', '#283040', 'tiles'],
  marketplace: ['#f3f1ec', '#23262f', 'concrete'],
  backups: ['#e4e6ea', '#22262e', 'concrete'],
  git_sync: ['#eef1f6', '#262c3a', 'parquet'],
  silent: ['#f4ede3', '#2a2f3d', 'parquet'],
  batteries: ['#f2efe9', '#2a2b33', 'parquet'],
  orphans: ['#eef2f5', '#262c36', 'tiles'],
  settings: ['#e4e6ea', '#22262e', 'concrete'],
};
// The furniture at the left of each scene: window and lamp (A), frames and sideboard (B), shelf and chair (C),
// pipes, fuse box, pallet and cone (D)
export var SH_DECOR = {
  status: 'A', system: 'D', containers: 'D', database: 'C', security: 'B', logs: 'A', watchdog: 'C', automations: 'B',
  marketplace: 'D', backups: 'D', git_sync: 'A', silent: 'B', batteries: 'C', orphans: 'A', settings: 'D',
};
export var SH_COG =
  'M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.21,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.21,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.67 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z';

// A potted plant standing on the floor at x
export function shPlant(x, k, n) {
  return `<g transform="translate(${x} 80) scale(${k})"><path d="M-7 0 l-2 -11 h18 l-2 11z" fill="#c0603a"/><path class="sh-leaf" d="M0 -11 q-10 -6 -11 -20 q8 4 11 15 q2 -14 10 -18 q1 12 -10 23z" fill="${n ? '#3e7a4a' : '#5aa83d'}"/></g>`;
}
export function shCloud(x, y, k, fill) {
  return `<g transform="translate(${x} ${y}) scale(${k})"><path class="sh-cloud" d="M-14,4 C-17,4 -18,0 -14.5,-1 C-14,-5 -8,-6 -6,-3 C-4,-8 4,-8 5,-2 C9,-3 12,0 10,4 Z" fill="${fill || '#fff'}"/></g>`;
}

// The furniture of the left part (0–160)
export function shDecor(kind, n) {
  var p = (day, night) => (n ? night : day);
  var frame = p('#fff', '#4a5568');
  var glass = p('#cfe8f8', '#1b2f52');
  var wood = p('#b98a5c', '#5c4836');
  var woodd = p('#a2744a', '#4a3a2c');
  var ink = p('#8a8478', '#4a4f60');
  if (kind === 'A') {
    var sky = n
      ? '<circle cx="66" cy="22" r="3" fill="#f3eed2"/><g fill="#fff" opacity=".8"><circle cx="40" cy="18" r=".7"/><circle cx="52" cy="40" r=".6"/><circle cx="72" cy="38" r=".6"/></g>'
      : `<circle cx="68" cy="22" r="5" fill="#ffd65a"/>${shCloud(44, 28, 0.8)}`;
    return `<rect x="28" y="10" width="52" height="46" rx="1.5" fill="${glass}" stroke="${frame}" stroke-width="2"/>${sky}<path d="M28 44 C40 38 60 40 80 36 V56 H28Z" fill="${p('#a7d39f', '#1d3a4a')}"/>
      <line x1="54" y1="10" x2="54" y2="56" stroke="${frame}" stroke-width="1.6"/><line x1="28" y1="33" x2="80" y2="33" stroke="${frame}" stroke-width="1.6"/><rect x="24" y="56" width="60" height="3" rx="1" fill="${frame}"/>
      <path d="M122 80 V30" stroke="${ink}" stroke-width="1.6"/><path d="M113 30 h18 l-4 -12 h-10z" fill="${p('#efe3c8', '#ffd27a')}"/><ellipse cx="122" cy="79" rx="7" ry="1.6" fill="${ink}"/>${n ? '<path d="M114 30 L100 80 H144 L130 30Z" fill="#ffd27a" opacity=".14"/>' : ''}`;
  }
  if (kind === 'B') {
    return `<rect x="26" y="14" width="40" height="28" rx="1" fill="${glass}" stroke="${p('#3a414c', '#20252e')}" stroke-width="2.4"/><path d="M28 38 L40 26 L48 33 L54 28 L64 38Z" fill="${p('#86c27f', '#2a5a3a')}"/><circle cx="56" cy="21" r="3" fill="#ffd65a"/>
      <rect x="74" y="20" width="22" height="30" rx="1" fill="${p('#fff', '#3d475c')}" stroke="${p('#3a414c', '#20252e')}" stroke-width="2.4"/><circle cx="85" cy="32" r="6" fill="${p('#f2b8a2', '#8a5a4a')}"/><rect x="79" y="40" width="12" height="3" rx="1" fill="${p('#9cc3e6', '#3a5a7a')}"/>
      <rect x="20" y="60" width="96" height="20" rx="2" fill="${p('#c9bfae', '#6b7586')}"/><rect x="24" y="64" width="42" height="12" rx="1" fill="${p('#d8cfc0', '#7a8496')}"/><rect x="70" y="64" width="42" height="12" rx="1" fill="${p('#d8cfc0', '#7a8496')}"/>
      <circle cx="62" cy="70" r="1" fill="${woodd}"/><circle cx="74" cy="70" r="1" fill="${woodd}"/><path d="M40 60 v-6 h8 v6" fill="${p('#e8f0fd', '#4a5568')}"/><path d="M44 54 q-4 -8 0 -12 q4 4 0 12z" fill="${p('#5aa83d', '#3e7a4a')}"/>`;
  }
  if (kind === 'C') {
    var books = [[34, 5, 16, '#2f80ed'], [40, 4, 13, '#e5484d'], [45, 6, 18, '#43a047'], [52, 4, 14, '#f5b400'], [57, 5, 16, '#7f77dd']]
      .map(([x, w, h, c]) => `<rect x="${x}" y="${34 - h}" width="${w}" height="${h}" rx=".8" fill="${c}"/>`)
      .join('');
    return `<rect x="28" y="34" width="74" height="3" rx="1" fill="${wood}"/><path d="M36 37 v5 h3 M94 37 v5 h-3" stroke="${woodd}" stroke-width="1.2" fill="none"/>${books}
      <path d="M76 34 l-2 -10 h10 l-2 10z" fill="${p('#9cc3e6', '#3a5a7a')}"/><path d="M79 24 q-6 -8 -2 -14 M79 24 q4 -10 8 -12" stroke="${p('#5aa83d', '#3e7a4a')}" stroke-width="1.4" fill="none"/>
      <g fill="${p('#c08a5a', '#5c4836')}"><rect x="104" y="60" width="26" height="5" rx="2"/><rect x="104" y="40" width="5" height="22" rx="2"/><rect x="106" y="65" width="3" height="15"/><rect x="125" y="65" width="3" height="15"/></g>`;
  }
  return `<path d="M0 12 H150" stroke="${p('#b5bbc2', '#3a414c')}" stroke-width="5"/><path d="M30 12 V40" stroke="${p('#b5bbc2', '#3a414c')}" stroke-width="5"/><rect x="26" y="40" width="8" height="5" fill="${p('#9aa1a9', '#2c323b')}"/><circle cx="90" cy="12" r="5" fill="${p('#e5484d', '#8a3a3a')}"/>
    <rect x="52" y="22" width="22" height="28" rx="2" fill="${p('#fff', '#3d475c')}" stroke="${p('#c9ced6', '#55617a')}"/><path d="M60 30 l-3 6 h4 l-2 6 l6 -8 h-4 l2 -4z" fill="#f5b400"/>
    <g fill="${p('#c9a06a', '#6a5236')}"><rect x="94" y="72" width="40" height="3"/><rect x="94" y="77" width="40" height="3"/><rect x="96" y="75" width="4" height="2"/><rect x="112" y="75" width="4" height="2"/><rect x="128" y="75" width="4" height="2"/></g>
    <rect x="98" y="54" width="32" height="18" rx="1" fill="${p('#c9a06a', '#7a6040')}"/><rect x="111" y="54" width="6" height="18" fill="${p('#e5c48f', '#9a8058')}"/>
    <path d="M140 80 l6 -20 h4 l6 20z" fill="#f57c00"/><rect x="143" y="68" width="10" height="3" fill="#fff"/><rect x="136" y="78" width="24" height="2" rx="1" fill="#e06a00"/>`;
}

// The module's own piece (0–200, drawn at x 160): its look follows the tone. `extra`: the Status tab's score and
// group tones, the failing backup locations, the installs running
export function shScene(name, tone, n, extra = {}) {
  var p = (day, night) => (n ? night : day);
  var c = SH_TONE_HEX[tone] || SH_TONE_HEX.good;
  var ok = tone === 'good' || tone === 'info' || tone === 'idle';
  var bad = tone === 'bad';
  var blink = ok ? '' : 'sh-blink';
  var good = SH_TONE_HEX.good;
  var face = p('#fff', '#3d475c');
  var edge = p('#c9ced6', '#55617a');
  var ink = p('#5f6b7a', '#a9b4c2');
  var dark = p('#3a414c', '#20252e');
  var wood = p('#b98a5c', '#5c4836');
  var woodd = p('#a2744a', '#4a3a2c');
  var led = (x, y, col, cls = '') => `<circle class="${cls}" cx="${x}" cy="${y}" r="1.3" fill="${col}"/>`;
  var badge = (x, y, text) =>
    `<g class="${blink}"><circle cx="${x}" cy="${y}" r="5.5" fill="${c}"/><text x="${x}" y="${y + 2.3}" text-anchor="middle" font-size="6.5" font-weight="700" font-family="Roboto,sans-serif" fill="#fff">${text}</text></g>`;
  var shelf = (x, y, w) =>
    `<rect x="${x}" y="${y}" width="${w}" height="3" rx="1" fill="${wood}"/><path d="M${x + 6} ${y + 3} v6 h3 M${x + w - 6} ${y + 3} v6 h-3" stroke="${woodd}" stroke-width="1.2" fill="none"/>`;
  var up = (x, y, col) =>
    `<g transform="translate(${x} ${y})"><g class="sh-up"><circle r="8" fill="${col}"/><path d="M0 4 v-8 m-3.5 3.5 l3.5 -3.5 l3.5 3.5" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g></g>`;
  if (name === 'status') {
    var score = Math.max(0, Math.min(100, Number(extra.score ?? 100)));
    var mark = { bad: 'M-2.6 -2.6 l5.2 5.2 M2.6 -2.6 l-5.2 5.2', warn: 'M0 -3.4 v3.6 M0 2.6 v.3' }[tone] || 'M-3 0 l2 2.2 l4 -4.4';
    var groups = extra.groups || [];
    var bars = groups
      .slice(0, 5)
      .map((g, i) => {
        var col = SH_TONE_HEX[g] || good;
        return `<circle cx="52" cy="${11 + i * 8.5}" r="2" fill="${col}"${g === 'bad' ? ' class="sh-blink"' : ''}/><rect x="57" y="${9.3 + i * 8.5}" width="${[20, 14, 18, 12, 16][i]}" height="3.4" rx="1.7" fill="${col}"/>`;
      })
      .join('');
    var beams = ok ? '' : `<g transform="translate(178 42)"><g class="sh-rot-fast"><path d="M0 0 L-30 -9 L-30 9Z M0 0 L30 -9 L30 9Z" fill="${c}" opacity=".35"/></g></g>`;
    return `<rect class="sh-glow" x="52" y="2" width="104" height="62" rx="12" fill="${c}" opacity="${ok ? '.10' : '.16'}"/>${beams}
      <g transform="translate(60 8)"><rect width="90" height="50" rx="5" fill="${p('#2a3038', '#14181f')}"/><rect x="3" y="3" width="84" height="44" rx="3" fill="${p('#1b2129', '#0d1117')}"/>
        <circle cx="24" cy="25" r="13" fill="none" stroke="#2e3a4e" stroke-width="4.5"/><circle cx="24" cy="25" r="13" fill="none" stroke="${c}" stroke-width="4.5" stroke-dasharray="${((2 * Math.PI * 13 * score) / 100).toFixed(1)} 100" transform="rotate(-90 24 25)" stroke-linecap="round"/>
        <text x="24" y="28.4" text-anchor="middle" font-size="10" font-weight="700" font-family="Roboto,sans-serif" fill="#fff">${score}</text>${bars}
        <g transform="translate(78 12)" class="${blink}"><circle r="6" fill="${c}"/><path d="${mark}" stroke="#fff" stroke-width="1.8" stroke-linecap="round" fill="none"/></g></g>
      <rect x="100" y="58" width="10" height="4" fill="${p('#2a3038', '#14181f')}"/>
      <g transform="translate(178 80)"><rect x="-14" y="-28" width="28" height="28" rx="2" fill="${p('#c9bfae', '#6b7586')}"/><rect x="-11" y="-24" width="22" height="20" rx="1.5" fill="${p('#d8cfc0', '#7a8496')}"/>
        <rect x="-7" y="-32" width="14" height="4" rx="1" fill="${p('#5f6b7a', '#3a414c')}"/><path d="M-6 -32 v-6 a6 6 0 0 1 12 0 v6z" fill="${c}" class="${ok ? '' : 'sh-blink'}"/><rect x="-4" y="-40" width="3" height="5" rx="1.5" fill="#fff" opacity=".6"/></g>
      ${ok ? `<g transform="translate(178 41)"><circle class="sh-ping" r="7" fill="none" stroke="${c}" stroke-width="1"/></g>` : ''}`;
  }
  if (name === 'system') {
    var fill = bad ? 92 : tone === 'warn' ? 70 : 38;
    var units = [0, 1, 2, 3, 4]
      .map((i) => {
        var y = 5 + i * 12;
        var vents = [0, 1, 2, 3, 4].map((j) => `<line x1="${8 + j * 3}" y1="${7 + i * 12}" x2="${8 + j * 3}" y2="${12 + i * 12}"/>`).join('');
        var hot = i === 2 && !ok;
        return `<rect x="4" y="${y}" width="32" height="9" rx="1.5" fill="${p('#4b5361', '#2c333e')}"/><g stroke="${p('#5d6676', '#3a4250')}" stroke-width=".8">${vents}</g>${led(28, 9.5 + i * 12, hot ? c : good, hot || i === 0 ? 'sh-blink' : '')}${led(32, 9.5 + i * 12, good)}`;
      })
      .join('');
    return `<g transform="translate(62 14)"><rect width="56" height="34" rx="3" fill="${face}" stroke="${edge}"/><path d="M6 26 l8 -6 l7 3 l8 -10 l7 5 l8 -8 l6 3" stroke="#2f80ed" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        <rect x="6" y="28" width="44" height="3" rx="1.5" fill="${p('#e3e8ef', '#2e3a4e')}"/><rect x="6" y="28" width="${(44 * fill) / 100}" height="3" rx="1.5" fill="${c}" class="${blink}"/></g>
      <g transform="translate(138 14)"><rect width="40" height="66" rx="3" fill="${dark}"/>${units}</g>${shPlant(110, 1.2, n)}`;
  }
  if (name === 'containers') {
    var box = (x, y, col, cls = '') =>
      `<g transform="translate(${x} ${y})" class="${cls}"><rect width="42" height="20" rx="1" fill="${col}"/><g stroke="#000" stroke-opacity=".14" stroke-width="1">${[0, 1, 2, 3, 4, 5, 6].map((k) => `<line x1="${4 + k * 4}" y1="2" x2="${4 + k * 4}" y2="18"/>`).join('')}</g><rect x="34" y="2" width="6" height="16" fill="#000" fill-opacity=".1"/></g>`;
    return `<rect x="184" y="6" width="4" height="74" fill="#f5b400"/><rect x="132" y="6" width="56" height="4" fill="#f5b400"/><path d="M136 10 l4 4 M144 10 l4 4 M152 10 l4 4 M160 10 l4 4 M168 10 l4 4 M176 10 l4 4" stroke="#c98d00" stroke-width="1"/>
      <line x1="150" y1="10" x2="150" y2="22" stroke="${ink}" stroke-width=".8"/><path d="M146 22 h8 v3 h-8z" fill="${ink}"/>
      ${box(76, 60, '#2f7fd1')}${box(120, 60, '#3e9b5f')}${box(98, 40, ok ? '#f2b632' : c, blink)}${ok ? '' : `<g transform="translate(110 30)">${badge(0, 0, '!')}</g>`}`;
  }
  if (name === 'database') {
    var cyl = [0, 1, 2]
      .map((i) => {
        var y = 66 - i * 17;
        return `<path d="M108 ${y - 14} v14 a22 6 0 0 0 44 0 v-14" fill="${p('#e8f0fd', '#2a3b5c')}" stroke="#2f80ed" stroke-width="1.2"/><ellipse cx="130" cy="${y - 14}" rx="22" ry="6" fill="${p('#f4f8fe', '#34486e')}" stroke="#2f80ed" stroke-width="1.2"/>`;
      })
      .join('');
    var drawers = [0, 1, 2]
      .map((i) => `<rect x="3" y="${3 + i * 15}" width="28" height="13" rx="1.5" fill="${p('#eef1f5', '#566074')}"/><rect x="13" y="${7 + i * 15}" width="8" height="2.4" rx="1.2" fill="${ink}"/>`)
      .join('');
    return `<g transform="translate(64 32)"><rect width="34" height="48" rx="2" fill="${p('#dfe4ea', '#4a5262')}" stroke="${edge}"/>${drawers}</g>${cyl}${led(146, 60, good)}${led(146, 43, good)}${led(146, 26, c, blink)}${ok ? '' : up(166, 18, c)}${shPlant(186, 1.2, n)}`;
  }
  if (name === 'security') {
    var mark2 = bad ? 'M-2.4 -3 l4.8 4.8 M2.4 -3 l-4.8 4.8' : 'M-3 -.5 l2 2 l4 -4';
    return `${ok ? '' : `<path class="sh-pir" d="M60 24 L40 78 H86Z" fill="${c}"/>`}
      <g transform="translate(70 12)"><rect x="-2" y="0" width="4" height="8" fill="${ink}"/><rect x="-14" y="6" width="24" height="12" rx="6" fill="${face}" stroke="${edge}"/><circle cx="-8" cy="12" r="4" fill="${dark}"/><circle cx="-8" cy="12" r="1.6" fill="#2f80ed"/>${led(5, 12, c, blink)}</g>
      <g transform="translate(116 14)"><rect width="34" height="66" fill="${p('#fff', '#4a5568')}"/><rect x="3" y="3" width="28" height="63" fill="${p('#8a5a3a', '#4a3a30')}"/><rect x="7" y="8" width="20" height="22" rx="1" fill="none" stroke="${p('#a8744f', '#5a4636')}"/><rect x="7" y="36" width="20" height="24" rx="1" fill="none" stroke="${p('#a8744f', '#5a4636')}"/><circle cx="26" cy="35" r="1.6" fill="#d4b26a"/></g>
      <g transform="translate(156 40)"><rect width="10" height="16" rx="2" fill="${face}" stroke="${edge}"/><rect x="2" y="2" width="6" height="4" rx="1" fill="${p('#cfe8f8', '#1b2f52')}"/>${led(5, 12, c, blink)}</g>
      <g transform="translate(184 22)"><path d="M0 -10 l8 3 v5.5 c0 5 -3.5 8.2 -8 10.2 c-4.5 -2 -8 -5.2 -8 -10.2 v-5.5z" fill="${c}"/><path d="${mark2}" stroke="#fff" stroke-width="1.6" stroke-linecap="round" fill="none"/></g>
      <rect x="112" y="78" width="42" height="2" rx="1" fill="${p('#9a8f7c', '#3a3f4c')}"/>`;
  }
  if (name === 'logs') {
    var lines = [[22, '#8fa3c4'], [16, c], [26, '#8fa3c4'], [12, c]]
      .map(([w, col], k) => `<rect x="6" y="${6 + k * 4}" width="${w}" height="2" rx="1" fill="${col}"/>`)
      .join('');
    var paper = [0, 1, 2, 3]
      .map((k) => `<rect x="6" y="${10 + k * 6}" width="14" height="2" rx="1" fill="${edge}"/>${k === 1 || k === 3 ? `<circle cx="22" cy="${11 + k * 6}" r="1.6" fill="${c}"/>` : ''}`)
      .join('');
    return `<rect x="52" y="54" width="96" height="4" rx="1" fill="${wood}"/><rect x="56" y="58" width="4" height="22" fill="${woodd}"/><rect x="140" y="58" width="4" height="22" fill="${woodd}"/>
      <g transform="translate(76 30)"><rect width="40" height="24" rx="2" fill="${dark}"/><rect x="3" y="3" width="34" height="18" rx="1" fill="${p('#1f262f', '#0f131a')}"/>${lines}<rect x="-4" y="24" width="48" height="3" rx="1.5" fill="${p('#9aa3ae', '#55617a')}"/></g>
      <g transform="translate(128 46)"><rect width="9" height="8" rx="1.5" fill="${p('#e8f0fd', '#4a5568')}"/><path d="M9 2 h2 a2 2 0 0 1 0 4 h-2" stroke="${p('#9aa3ae', '#55617a')}" fill="none"/></g>
      <g transform="translate(160 12)"><rect width="28" height="38" rx="2" fill="${wood}"/><rect x="3" y="4" width="22" height="31" fill="${face}"/><rect x="9" y="1" width="10" height="5" rx="1.5" fill="${ink}"/>${paper}</g>
      ${ok ? '' : `<g transform="translate(186 12)">${badge(0, 0, '!')}</g>`}`;
  }
  if (name === 'watchdog') {
    return `${shelf(92, 44, 80)}<g transform="translate(100 34)"><rect width="30" height="10" rx="2" fill="${face}"/><path d="M5 0 l-3 -10 M25 0 l3 -10" stroke="${ink}" stroke-width="1.4" stroke-linecap="round"/>${led(8, 5, good, 'sh-blink')}${led(14, 5, good)}${led(20, 5, good)}</g>
      <g transform="translate(146 30)"><rect width="18" height="14" rx="3" fill="${face}" stroke="${ok ? edge : c}"/>${led(14, 4, c, blink)}${ok ? '' : `<path class="sh-spin" d="M-4 -4 a8 8 0 1 1 -1 8" stroke="${c}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`}</g>
      <g transform="translate(128 58)"><rect width="16" height="16" rx="3" fill="${face}" stroke="${edge}"/><circle cx="5" cy="8" r="1.4" fill="${ink}"/><circle cx="11" cy="8" r="1.4" fill="${ink}"/></g><path d="M132 66 C120 66 120 50 110 44" stroke="${ink}" stroke-width="1.6" fill="none"/>
      <g transform="translate(64 50)"><path d="M0 -14 l10 4 v7 c0 6 -4.4 10 -10 12.4 c-5.6 -2.4 -10 -6.4 -10 -12.4 v-7z" fill="${c}"/><circle cy="-3" r="3.2" fill="#fff"/><circle cy="-3" r="1.5" fill="${p('#1f262f', '#0f131a')}"/></g>${shPlant(186, 1.25, n)}`;
  }
  if (name === 'automations') {
    var eye = ok ? '#7fd1ff' : c;
    return `<path d="M70 0 V22" stroke="${ink}" stroke-width=".8"/><path d="M62 28 Q62 20 70 20 Q78 20 78 28Z" fill="${dark}"/><circle cx="70" cy="30" r="3.4" fill="${ok ? '#ffd27a' : p('#d3cfc6', '#4a4f60')}"/>${ok ? '<circle class="sh-glow" cx="70" cy="32" r="14" fill="#ffd27a" opacity=".3"/>' : ''}
      <g transform="translate(128 80)"><rect x="-12" y="-10" width="6" height="10" rx="2" fill="${ink}"/><rect x="6" y="-10" width="6" height="10" rx="2" fill="${ink}"/><rect x="-16" y="-34" width="32" height="25" rx="5" fill="${face}" stroke="${edge}"/>
        <rect x="-8" y="-28" width="16" height="10" rx="2" fill="${p('#e3e8ef', '#2e3a4e')}"/><circle cx="-3" cy="-23" r="1.6" fill="${c}"/><circle cx="3" cy="-23" r="1.6" fill="${c}"/>
        <rect x="-12" y="-52" width="24" height="17" rx="5" fill="${face}" stroke="${edge}"/><circle cx="-5" cy="-44" r="2.6" fill="${dark}"/><circle cx="5" cy="-44" r="2.6" fill="${dark}"/><circle cx="-5" cy="-44" r="1.2" fill="${eye}"/><circle cx="5" cy="-44" r="1.2" fill="${eye}"/>
        <path d="M0 -52 v-6" stroke="${ink}" stroke-width="1.4"/><circle class="${blink}" cy="-60" r="2.6" fill="${c}"/><path d="M-16 -28 l-8 8 M16 -28 l8 -10" stroke="${edge}" stroke-width="3" stroke-linecap="round"/></g>
      <g transform="translate(176 40)"><rect width="10" height="16" rx="2" fill="${face}" stroke="${edge}"/><rect x="3" y="3" width="4" height="10" rx="1" fill="${p('#e3e8ef', '#2e3a4e')}"/></g>`;
  }
  if (name === 'marketplace') {
    var bx = (x, y, w, h) =>
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1" fill="${p('#c9a06a', '#7a6040')}"/><rect x="${x + w / 2 - 3}" y="${y}" width="6" height="2" fill="${p('#e5c48f', '#9a8058')}"/>`;
    var truck = extra.installing
      ? `<g transform="translate(160 57)"><g class="sh-drive"><rect width="24" height="17" rx="2" fill="#2f80ed"/><path d="M4 6 h10 M4 10 h7" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".8"/><path d="M24 7 h5 l3 4 v6 h-8z" fill="#1f63c7"/><rect x="26" y="8.5" width="3.5" height="3" rx=".6" fill="#cfe8f8"/><circle cx="6" cy="18" r="3" fill="${dark}"/><circle cx="27" cy="18" r="3" fill="${dark}"/></g></g>`
      : bx(158, 62, 26, 18);
    return `<g transform="translate(64 14)"><rect x="0" y="0" width="3" height="66" fill="${woodd}"/><rect x="81" y="0" width="3" height="66" fill="${woodd}"/><rect x="0" y="30" width="84" height="3" fill="${wood}"/><rect x="0" y="63" width="84" height="3" fill="${wood}"/></g>
      ${bx(70, 24, 18, 20)}${bx(90, 30, 14, 14)}${bx(108, 20, 24, 24)}${bx(70, 59, 22, 18)}${bx(96, 53, 20, 24)}${bx(120, 63, 24, 14)}${up(120, 12, '#2f80ed')}${truck}
      ${!ok && extra.count ? `<g transform="translate(128 6)">${badge(0, 0, extra.count > 9 ? '9+' : extra.count)}</g>` : ''}`;
  }
  if (name === 'backups') {
    var bays = [0, 1, 2]
      .map((k) => `<rect x="3" y="${4 + k * 8}" width="18" height="6" rx="1" fill="${p('#4b5361', '#2c333e')}"/>${led(17, 7 + k * 8, good, k === 0 ? 'sh-blink' : '')}`)
      .join('');
    var fail = Boolean(extra.failing);
    var sky = n ? '<circle cx="182" cy="20" r="2.4" fill="#f3eed2"/>' : '<circle cx="183" cy="20" r="3.5" fill="#ffd65a"/>';
    return `<g transform="translate(66 44)"><rect width="24" height="36" rx="2" fill="${dark}"/>${bays}</g>
      <g transform="translate(100 32)"><rect width="50" height="48" rx="3" fill="${p('#5b6470', '#2c333e')}"/><rect x="4" y="4" width="42" height="40" rx="2" fill="${p('#6b7480', '#3a4250')}"/><circle cx="25" cy="24" r="9" fill="${p('#8a939e', '#4a5262')}" stroke="${p('#4a525d', '#20252e')}" stroke-width="2"/>
        <path d="M25 17 v4 M25 27 v4 M18 24 h4 M28 24 h4" stroke="${p('#4a525d', '#20252e')}" stroke-width="1.4"/><rect x="38" y="18" width="3" height="12" rx="1.5" fill="${edge}"/>${led(8, 8, c, blink)}</g>
      <rect x="160" y="12" width="32" height="30" rx="1.5" fill="${p('#cfe8f8', '#1b2f52')}" stroke="${p('#fff', '#4a5568')}" stroke-width="2"/>${sky}${shCloud(176, 30, 0.8, fail ? '#fde2e2' : '#fff')}
      <line x1="176" y1="12" x2="176" y2="42" stroke="${p('#fff', '#4a5568')}" stroke-width="1.4"/>
      ${fail ? `<g transform="translate(186 20)"><circle r="4.5" fill="${SH_TONE_HEX.bad}"/><path d="M-1.8 -1.8 l3.6 3.6 M1.8 -1.8 l-3.6 3.6" stroke="#fff" stroke-width="1.3" stroke-linecap="round"/></g>` : ''}`;
  }
  if (name === 'git_sync') {
    var cm = (x, y, col) => `<circle cx="${x}" cy="${y}" r="3.6" fill="${col || p('#fff', '#3d475c')}" stroke="${col || ink}" stroke-width="1.4"/>`;
    return `<g transform="translate(52 6)"><rect width="118" height="52" rx="2" fill="${p('#fff', '#3d475c')}" stroke="${edge}" stroke-width="2"/><rect x="40" y="52" width="38" height="3" rx="1" fill="${ink}"/></g>
      <g stroke="${ink}" stroke-width="1.8" fill="none"><path d="M62 42 H160"/><path d="M84 42 C94 42 94 24 106 24 H130 C142 24 142 42 150 42"/></g>
      ${cm(68, 42)}${cm(84, 42)}${cm(104, 42)}${cm(126, 42)}${cm(106, 24, '#2f80ed')}<g class="${blink}">${cm(124, 24, c)}</g>${cm(150, 42)}
      <rect x="96" y="56" width="12" height="2.6" rx="1.3" fill="#2f80ed"/><rect x="110" y="56" width="10" height="2.6" rx="1.3" fill="${c}"/>${shPlant(186, 1.3, n)}`;
  }
  if (name === 'silent') {
    var sens = (x, y, col, off) =>
      `<g transform="translate(${x} ${y})"><circle r="7" fill="${face}" stroke="${off ? col : edge}"/>${
        off
          ? `<g class="${blink}"><path d="M-3 -3 l6 6" stroke="${col}" stroke-width="1.4" stroke-linecap="round"/><path d="M-3.4 1 a4 4 0 0 1 6.8 0" stroke="${col}" stroke-width="1.2" fill="none"/></g>`
          : `<circle r="2" fill="${good}"/>`
      }</g>`;
    return `<rect x="104" y="56" width="52" height="3.5" rx="1" fill="${wood}"/><rect x="110" y="59" width="3" height="21" fill="${woodd}"/><rect x="147" y="59" width="3" height="21" fill="${woodd}"/>
      <g transform="translate(116 46)"><rect width="28" height="10" rx="2" fill="${face}"/><path d="M5 0 l-3 -12 M23 0 l3 -12" stroke="${ink}" stroke-width="1.4" stroke-linecap="round"/>${led(9, 5, good, 'sh-blink')}${led(15, 5, good)}</g>
      <g class="sh-fade" stroke="#2f80ed" stroke-width="1.3" fill="none" stroke-linecap="round"><path d="M122 28 a10 10 0 0 1 16 0"/><path d="M117 23 a17 17 0 0 1 26 0"/></g>
      ${sens(72, 30, good, false)}${sens(80, 60, ok ? good : c, !ok)}${sens(178, 24, good, false)}<path d="M86 56 L116 48" stroke="${ok ? edge : c}" stroke-width="1" stroke-dasharray="3 3"/>`;
  }
  if (name === 'batteries') {
    var bat = (x, lv, col, cls = '') =>
      `<g transform="translate(${x} 52)"><rect x="-6" y="-24" width="12" height="24" rx="2" fill="${face}" stroke="${ink}" stroke-width="1.4"/><rect x="-2.5" y="-26.5" width="5" height="2.5" fill="${ink}"/><rect class="${cls}" x="-4" y="${-2 - lv}" width="8" height="${lv}" rx="1" fill="${col}"/></g>`;
    var level = bad ? 3 : tone === 'warn' ? 5 : 18;
    return `${shelf(64, 52, 116)}${bat(78, 17, good)}${bat(98, 12, good)}<g transform="translate(120 52) scale(1.25) translate(-120 -52)">${bat(120, level, ok ? good : c, blink)}</g>${bat(144, 14, good)}${bat(164, 9, good)}
      <g transform="translate(108 64)"><rect width="22" height="14" rx="3" fill="${face}" stroke="${edge}"/><path d="M12 3 l-4 5 h3 l-1 4 l4 -5 h-3z" fill="#f5b400"/></g><path d="M130 72 C150 72 150 80 170 80" stroke="${ink}" stroke-width="1.4" fill="none"/>`;
  }
  if (name === 'orphans') {
    return `<ellipse cx="96" cy="78" rx="12" ry="2" fill="#000" opacity=".08"/>
      <g class="sh-float"><g transform="translate(96 40)"><path d="M-14 16 V-4 a14 14 0 0 1 28 0 V16 l-4.7 -4 l-4.7 4 l-4.6 -4 l-4.7 4 l-4.6 -4z" fill="${p('#fff', '#e8ecf2')}" stroke="${ok ? edge : c}" stroke-width="1.2"/><circle cx="-5" cy="-3" r="2.2" fill="${dark}"/><circle cx="5" cy="-3" r="2.2" fill="${dark}"/><ellipse cy="5" rx="3" ry="2" fill="${dark}"/></g></g>
      <g transform="translate(136 80)"><path d="M-11 0 l-2 -18 h26 l-2 18z" fill="#3b8fd6"/><rect x="-14" y="-20" width="28" height="3" rx="1" fill="#2f78bd"/><path d="M-10 -20 q10 -12 20 0" stroke="${ink}" stroke-width="1.2" fill="none"/></g>
      <path d="M156 14 L174 66" stroke="${wood}" stroke-width="3" stroke-linecap="round"/><path d="M166 64 l18 -6 l6 20 h-18z" fill="#e1b44c"/><path d="M172 66 l4 12 M178 64 l4 13 M184 62 l3 14" stroke="#c99a2e" stroke-width="1"/>
      <g fill="${p('#b4b2a9', '#8a8f9a')}" opacity=".6"><circle class="sh-dust" cx="70" cy="70" r="2"/><circle class="sh-dust" cx="62" cy="74" r="1.4"/><circle class="sh-dust" cx="120" cy="56" r="1.2"/></g>`;
  }
  // settings
  var holes = [];
  for (var i = 0; i < 13; i++) for (var j = 0; j < 6; j++) holes.push(`<circle cx="${6 + i * 8}" cy="${6 + j * 8}" r=".9"/>`);
  var sw = (x, on) =>
    `<g transform="translate(${x} 46)"><rect x="-7" y="-3.5" width="14" height="7" rx="3.5" fill="${on ? '#2f80ed' : edge}"/><circle cx="${on ? 3.5 : -3.5}" r="2.6" fill="#fff"/></g>`;
  return `<g transform="translate(60 8)"><rect width="104" height="50" rx="2" fill="${p('#d6c3a3', '#5a4c3a')}"/><g fill="${p('#b49e7c', '#463b2e')}">${holes.join('')}</g></g>
    <g transform="translate(90 33)"><g class="sh-rot"><path transform="translate(-14 -14) scale(1.17)" d="${SH_COG}" fill="${ink}"/></g></g>
    <g transform="translate(110 22)"><g class="sh-rot-rev"><path transform="translate(-8 -8) scale(.67)" d="${SH_COG}" fill="#2f80ed"/></g></g>
    <path d="M128 14 l14 30" stroke="${p('#8a939e', '#9aa3ae')}" stroke-width="3.4" stroke-linecap="round"/><circle cx="127" cy="13" r="5" fill="none" stroke="${p('#8a939e', '#9aa3ae')}" stroke-width="2.6"/>${sw(132, true)}${sw(148, false)}
    <rect x="56" y="62" width="112" height="4" rx="1" fill="${wood}"/><rect x="60" y="66" width="4" height="14" fill="${woodd}"/><rect x="160" y="66" width="4" height="14" fill="${woodd}"/>${shPlant(186, 1.2, n)}`;
}
