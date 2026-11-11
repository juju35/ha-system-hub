import assert from "node:assert/strict";
import { test } from "node:test";
import { devices, entities, states } from "./mock-states.mjs";
import { load } from "./load.mjs";

const lib = load();
const LANGS = Object.keys(lib.STRINGS);
// Languages with more than two plural forms (Serbian, Polish, Russian, Ukrainian, Slovak, Czech, Slovenian: 1, 2-4,
// 5+; Romanian "de" from 20; Latvian): their counts other than 1 are turned into "label: {n}"
// (or "label ({n})"), which reads right for every number.
const ROTATED = ["sr", "sr-Latn", "pl", "ro", "ru", "uk", "sk", "cs", "sl", "lv"];
const rotated = (s, n) => s.endsWith(`: ${n}`) || s.includes(`(${n})`);

/** n processes stopped. */
const hassWith = (n, language) => ({ states: { ...states }, entities, devices, language, locale: { language }, __n: n });

const card = (hass) => {
  const c = new lib.SystemMonitorCard();
  c._hass = hass;
  c._config = {};
  c._stopped = () => Array.from({ length: hass.__n }, (_, i) => `p${i}`);
  return c;
};

/** Every count the card writes, for n: the processes tile's value and title. */
const counts = (n, language) => {
  const hass = hassWith(n, language);
  const c = card(hass);
  const x = c._procsStat(lib.discover(hass));
  return { "procs value": x.html.match(/<div class="v">([^<]*)</)[1], "procs title": x.html.match(/title="([^"]*)"/)[1] };
};

for (const language of LANGS) {
  test(`${language}: 1 is singular everywhere`, () => {
    for (const [k, v] of Object.entries(counts(1, language))) assert.match(v, /1/, `${k}: "${v}"`);
  });
}

for (const language of ROTATED)
  for (const n of [2, 5, 21, 22])
    test(`${language}: counts of ${n} use the "label: {n}" form`, () => {
      for (const [k, v] of Object.entries(counts(n, language))) assert.ok(rotated(v, n), `${k}: "${v}"`);
    });

test("English counts (reference)", () => {
  assert.deepEqual(counts(1, "en"), { "procs value": "1 stopped", "procs title": "1 process stopped" });
  assert.equal(counts(5, "en")["procs title"], "5 processes stopped");
});
