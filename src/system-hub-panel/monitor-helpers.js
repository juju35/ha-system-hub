// Interfaces left out of the network figures: loopback, containers, bridges, tunnels and VPNs (as the old card did)
export var SH_VIRTUAL_IF = /^(lo|docker\d*|hassio|veth.*|br-.*|virbr\d*|tun\d*|tap\d*|wg\d*|vlan.*|dummy\d*|tailscale.*)$/;
// The System tab's thresholds (orange, red) when the integration sends none: Configure → System: thresholds
export var SH_THRESHOLDS = { cpu: [70, 90], ram: [70, 90], disk: [80, 90], temperature: [70, 85], swap: [50, 80] };

// One colour per kind of data, the same in the rings, the charts and their legends
export var SH_COLORS = {
  cpu: '#03a9f4',
  ram: '#8e24aa',
  temp: '#ff7043',
  download: '#43a047',
  upload: '#1e88e5',
  disks: ['#00897b', '#5c6bc0', '#f4511e', '#6d4c41', '#c0ca33'],
};
export var SH_BUCKETS = 120;

// [[ms, value]] → `n` averages over [start, end]; a bucket without a reading keeps the last value known before it
export function shBuckets(points, start, end, n) {
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
export function shPoints(values, w, h, max) {
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
export function shArea(values, max) {
  return shPoints(values, 100, 30, max)
    .map((seg) => `<svg class="behind" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
      <polygon points="${seg[0].split(',')[0]},30 ${seg.join(' ')} ${seg[seg.length - 1].split(',')[0]},30"/><polyline points="${seg.join(' ')}"/></svg>`)
    .join('');
}

// A round top for a rate axis: 1, 2 or 5 times a power of ten
export function shNiceMax(values) {
  var top = Math.max(0, ...values.filter((v) => v !== null && v !== undefined));
  if (!top) return 1;
  var p = 10 ** Math.floor(Math.log10(top));
  return [1, 2, 5, 10].map((m) => m * p).find((m) => m >= top);
}

export function shRate(v) {
  return v < 10 ? Number(v.toFixed(1)).toString() : String(Math.round(v));
}

export function shRound(n) {
  return Number.isInteger(n) ? n : Number(n.toFixed(1));
}

// "Disk usage /media" → "/media"; "Network throughput in eth0" → "eth0"
export function shMount(sensor) {
  var m = String(sensor.name || '').match(/(\/\S*)\s*$/);
  return m ? m[1] : sensor.name;
}

// "System Monitor Process python3" → "python3"
export function shProcess(sensor) {
  var name = String(sensor.name || '');
  var i = name.toLowerCase().lastIndexOf('process ');
  return i < 0 ? name : name.slice(i + 8);
}

export function shIface(sensor) {
  return String(sensor.name || '').split(' ').pop();
}

// Orphans tab: its styles (its methods are added to the panel at the end of the file)
export var SH_ORPHANS_STYLE = `
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
