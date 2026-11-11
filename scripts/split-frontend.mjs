// Splits the translations of the integration's frontend files (scripts/i18n-split.mjs): English stays in each
// file, every other language goes to `<file>.i18n.<lang>.js` next to it. The release runs it before building the
// zip, so the repository keeps every language in the sources; with --check it splits a copy and changes nothing.
// The sidebar panel keeps every language: split, it would only be defined once its language file is in (up to
// 1.5 s at its first opening), and Home Assistant does not wait for a panel as it does for a card. It is loaded
// only when the panel is opened, then cached by the browser.
// The Lovelace cards (frontend/cards/*.js) are split the same way, their language files next to them, and their
// "__VERSION__" placeholder becomes the version.
// Usage: node scripts/split-frontend.mjs [--check]
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { splitI18n } from "./i18n-split.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const [domain] = readdirSync(`${root}custom_components`);
const { version } = JSON.parse(readFileSync(`${root}custom_components/${domain}/manifest.json`, "utf8"));
const check = process.argv.includes("--check");
const source = `${root}custom_components/${domain}/frontend`;
const dir = check ? mkdtempSync(`${tmpdir()}/split-frontend-`) : source;
if (check) cpSync(source, dir, { recursive: true });

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
// The frontend folder, then its cards folder (when there is one)
const folders = [dir, ...(existsSync(`${dir}/cards`) ? [`${dir}/cards`] : [])];
try {
  for (const folder of folders) splitFolder(folder);
} finally {
  if (check) rmSync(dir, { recursive: true, force: true });
}

function splitFolder(dir) {
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".js") && !f.includes(".i18n."))) {
    if (file.endsWith("-panel.js")) {
      console.log(`${file}: kept whole (the panel is drawn at once, without waiting for a language file)`);
      continue;
    }
    const stem = file.replace(/\.js$/, "");
    for (const f of readdirSync(dir)) if (f.startsWith(`${stem}.i18n.`)) rmSync(`${dir}/${f}`);
    // A card's "__VERSION__" placeholder becomes the integration's version
    const code = readFileSync(`${dir}/${file}`, "utf8").replaceAll('"__VERSION__"', JSON.stringify(version));
    const r = splitI18n(code, { stem, version, outDir: dir });
    if (!r.tables) {
      writeFileSync(`${dir}/${file}`, code);
      console.log(`${file}: no translation table to split`);
      continue;
    }
    writeFileSync(`${dir}/${file}`, r.code);
    console.log(`${file}: ${r.tables} tables split into ${r.langs.length} language files, ${kb(code.length)} → ${kb(r.code.length)}`);
  }
}
