// Assembles the frontend's ES modules: every src/<stem>/index.js becomes the classic script Home Assistant serves,
// custom_components/system_hub/frontend/<stem>.js for the panel and frontend/cards/<stem>.js for a Lovelace card
// (a stem ending in -card), through scripts/bundle.mjs (modules concatenated in the order of the entry file, import
// lines removed, `export` keywords dropped, translation tables rebuilt as one literal). The assembled files are not
// committed: run this before the tests, the screenshots, scripts/split-frontend.mjs and the release zip.
// Usage: node scripts/build-frontend.mjs (needs acorn: npm install --no-save --no-package-lock acorn@8.19.0)
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "./bundle.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const frontend = "custom_components/system_hub/frontend";

for (const stem of readdirSync(`${root}src`).sort()) {
  if (!existsSync(`${root}src/${stem}/index.js`)) continue;
  const out = `${frontend}${stem.endsWith("-card") ? "/cards" : ""}/${stem}.js`;
  const code = bundle(`src/${stem}/index.js`);
  mkdirSync(dirname(`${root}${out}`), { recursive: true }); // frontend/cards/ holds no committed file
  writeFileSync(`${root}${out}`, code);
  console.log(`src/${stem}/ → ${out} (${(code.length / 1024).toFixed(1)} KB)`);
}
