// WCAG contrast of the card's CSS, evaluated for Home Assistant's default light and dark themes.
// A minimal evaluator: rules are looked up by exact selector, then var(), color-mix(in srgb, …), hex,
// rgb()/rgba() and transparent are resolved, and semi-transparent backgrounds composited over the surface.

export const THEMES = {
  light: {
    "--primary-text-color": "#212121",
    "--secondary-text-color": "#727272",
    "--card-background-color": "#ffffff",
    "--secondary-background-color": "#e5e5e5",
    "--success-color": "#43a047",
    "--warning-color": "#ffa600",
    "--error-color": "#db4437",
    "--primary-color": "#03a9f4",
  },
  dark: {
    "--primary-text-color": "#e1e1e1",
    "--secondary-text-color": "#9b9b9b",
    "--card-background-color": "#1c1c1c",
    "--secondary-background-color": "#282828",
    "--success-color": "#43a047",
    "--warning-color": "#ffa600",
    "--error-color": "#db4437",
    "--primary-color": "#03a9f4",
  },
};

// Rules outside at-rules, as [selector, declarations] in source order.
const rules = (css) => {
  let flat = css.replace(/\/\*[\s\S]*?\*\//g, "");
  // Drop @media / @keyframes blocks (one level of nesting).
  flat = flat.replace(/@[a-z-]+[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, "");
  const out = [];
  for (const m of flat.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const decls = {};
    for (const d of m[2].split(";")) {
      const i = d.indexOf(":");
      if (i > 0) decls[d.slice(0, i).trim()] = d.slice(i + 1).trim();
    }
    for (const sel of m[1].split(",")) out.push([sel.trim().replace(/\s+/g, " "), decls]);
  }
  return out;
};

// Declarations of the given selectors, merged in order (later selectors win).
export const declarations = (css, selectors) => {
  const all = rules(css);
  const merged = {};
  for (const s of selectors) {
    const found = all.filter(([sel]) => sel === s);
    if (!found.length) throw new Error(`no rule for ${s}`);
    for (const [, d] of found) Object.assign(merged, d);
  }
  return merged;
};

const splitArgs = (s) => {
  const out = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
};

const hex = (h) => {
  let s = h.slice(1);
  if (s.length === 3) s = [...s].map((c) => c + c).join("");
  return [Number.parseInt(s.slice(0, 2), 16), Number.parseInt(s.slice(2, 4), 16), Number.parseInt(s.slice(4, 6), 16), 1];
};

// Resolves a CSS colour expression to [r, g, b, a].
export const color = (expr, vars) => {
  const e = expr.trim();
  if (e === "transparent") return [0, 0, 0, 0];
  if (e.startsWith("#")) return hex(e);
  const fn = e.match(/^([a-z-]+)\((.*)\)$/s);
  if (!fn) throw new Error(`unsupported colour: ${e}`);
  const args = splitArgs(fn[2]);
  if (fn[1] === "var") {
    const v = vars[args[0]];
    if (v !== undefined) return color(v, vars);
    if (args.length > 1) return color(args.slice(1).join(", "), vars);
    throw new Error(`undefined variable ${args[0]}`);
  }
  if (fn[1] === "rgb" || fn[1] === "rgba") {
    const [r, g, b, a = "1"] = args.map((x) => x.trim());
    return [+r, +g, +b, +a];
  }
  if (fn[1] === "color-mix") {
    if (args[0] !== "in srgb") throw new Error(`unsupported colour space: ${args[0]}`);
    const part = (s) => {
      const m = s.match(/^(.*?)(?:\s+([\d.]+)%)?$/s);
      return [color(m[1], vars), m[2] === undefined ? undefined : +m[2] / 100];
    };
    const [[c1, p1], [c2, p2]] = [part(args[1]), part(args[2])];
    const w1 = p1 ?? 1 - p2;
    const w2 = p2 ?? 1 - w1;
    const a = w1 * c1[3] + w2 * c2[3];
    if (a === 0) return [0, 0, 0, 0];
    const ch = (i) => (w1 * c1[3] * c1[i] + w2 * c2[3] * c2[i]) / a;
    return [ch(0), ch(1), ch(2), a];
  }
  throw new Error(`unsupported colour function: ${fn[1]}`);
};

const over = ([r, g, b, a], [R, G, B]) => [r * a + R * (1 - a), g * a + G * (1 - a), b * a + B * (1 - a), 1];

const luminance = (c) => {
  const [r, g, b] = c.slice(0, 3).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const ratio = (fg, bg) => {
  const [l1, l2] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

// Contrast of the text of an element: `selectors` gives the cascade (variables first, then the element's
// rules), `surface` the opaque colour behind the element's own background.
export const textContrast = (css, selectors, theme, surface = "var(--card-background-color)") => {
  const d = declarations(css, selectors);
  const vars = { ...(typeof theme === "string" ? THEMES[theme] : theme), ...Object.fromEntries(Object.entries(d).filter(([k]) => k.startsWith("--"))) };
  const base = color(surface, vars);
  const bg = d.background ? over(color(d.background, vars), base) : base;
  const fg = over(color(d.color ?? "var(--primary-text-color)", vars), bg);
  return ratio(fg, bg);
};
