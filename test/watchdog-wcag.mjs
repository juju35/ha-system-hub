// WCAG contrast of the card's CSS colours: resolves var(), color-mix(in srgb, …) and alpha, without a browser.

const hex = (h) => {
  const s = h.slice(1);
  const f = s.length === 3 ? [...s].map((c) => c + c).join('') : s;
  return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16)).concat(1);
};

// Splits "a, b(c, d), e" on the top-level commas.
const args = (s) => {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && !depth) {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
};

// An RGBA colour [r, g, b, a] (0-255, alpha 0-1) from a CSS colour expression and the custom properties in `vars`.
export function resolve(expr, vars) {
  const e = expr.trim();
  if (e === 'transparent') return [0, 0, 0, 0];
  if (e.startsWith('#')) return hex(e);
  const fn = e.match(/^([a-z-]+)\((.*)\)$/s);
  if (!fn) throw new Error(`unsupported colour: ${e}`);
  const [, name, body] = fn;
  const a = args(body);
  if (name === 'var') {
    if (a[0] in vars) return resolve(vars[a[0]], vars);
    if (a.length > 1) return resolve(a.slice(1).join(', '), vars);
    throw new Error(`undefined ${a[0]}`);
  }
  if (name === 'rgba' || name === 'rgb') return [...a.slice(0, 3).map(Number), a.length > 3 ? Number(a[3]) : 1];
  if (name === 'color-mix') {
    if (a[0] !== 'in srgb') throw new Error(`unsupported space: ${a[0]}`);
    const part = (s) => {
      const m = s.match(/^(.*?)\s+([\d.]+)%$/s);
      return m ? [m[1], Number(m[2]) / 100] : [s, null];
    };
    let [c1, p1] = part(a[1]);
    let [c2, p2] = part(a[2]);
    if (p1 == null && p2 == null) p1 = p2 = 0.5;
    else if (p1 == null) p1 = 1 - p2;
    else if (p2 == null) p2 = 1 - p1;
    const x = resolve(c1, vars);
    const y = resolve(c2, vars);
    // Premultiplied interpolation, as CSS Color 5 specifies.
    const alpha = x[3] * p1 + y[3] * p2;
    const rgb = [0, 1, 2].map((i) => (alpha ? (x[i] * x[3] * p1 + y[i] * y[3] * p2) / alpha : 0));
    return [...rgb, alpha];
  }
  throw new Error(`unsupported function: ${name}`);
}

// `top` painted over the opaque `bottom`.
export const over = (top, bottom) => [0, 1, 2].map((i) => top[i] * top[3] + bottom[i] * (1 - top[3])).concat(1);

const lum = (c) => {
  const [r, g, b] = c.slice(0, 3).map((v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export function contrast(fg, bg) {
  const [a, b] = [lum(over(fg, bg)), lum(bg)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

// { selector: { property: value } } from a stylesheet (no media queries).
export function rules(css) {
  const out = {};
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const decls = {};
    for (const d of m[2].split(';')) {
      const i = d.indexOf(':');
      if (i > 0) decls[d.slice(0, i).trim()] = d.slice(i + 1).trim();
    }
    for (const sel of m[1].split(',')) {
      const key = sel.trim().replace(/\s+/g, ' ');
      out[key] = { ...out[key], ...decls };
    }
  }
  return out;
}
