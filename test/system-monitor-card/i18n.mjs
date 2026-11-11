import assert from "node:assert/strict";
import { test } from "node:test";
import { load } from "./load.mjs";

const { STRINGS } = load();
const placeholders = (s) => (String(s).match(/\{\w+\}/g) || []).sort();
const LANGS = ["fr", "de", "es", "sr", "sr-Latn", "it", "nl", "pt", "pl", "ro", "da", "sv", "bg", "ru", "uk", "hu", "sk", "cs", "sl", "lv", "el"];

test("I18N parity: every language has exactly the English keys and placeholders", () => {
  const ref = Object.keys(STRINGS.en).sort();
  for (const l of LANGS) {
    assert.ok(STRINGS[l], `missing language ${l}`);
    assert.deepEqual(Object.keys(STRINGS[l]).sort(), ref, `keys of ${l}`);
    for (const k of ref) {
      assert.deepEqual(placeholders(STRINGS[l][k]), placeholders(STRINGS.en[k]), `placeholders of ${l}.${k}`);
      assert.ok(String(STRINGS[l][k]).trim(), `empty value ${l}.${k}`);
    }
  }
});

// Key paths of a dictionary, with array lengths, so nested objects and lists are compared too.
const shape = (v, p = "") =>
  Array.isArray(v)
    ? [`${p}[${v.length}]`, ...v.flatMap((x, i) => shape(x, `${p}[${i}]`))]
    : v && typeof v === "object"
      ? Object.keys(v).flatMap((k) => shape(v[k], p ? `${p}.${k}` : k))
      : [p];

test("I18N parity: every language has exactly the English key paths, arrays of the same length", () => {
  const ref = shape(STRINGS.en).sort();
  for (const l of LANGS) {
    assert.ok(STRINGS[l], `missing language ${l}`);
    assert.deepEqual(shape(STRINGS[l]).sort(), ref, `key paths of ${l}`);
  }
});

test("the language resolves to the full code, then the part before the dash, then English", () => {
  const { lang } = load();
  assert.equal(lang({ language: "fr-FR" }, {}), "fr");
  assert.equal(lang({ language: "sr-Latn" }, {}), "sr-Latn");
  assert.equal(lang({ locale: { language: "sr-Latn" } }, {}), "sr-Latn");
  assert.equal(lang({ language: "sr" }, {}), "sr");
  assert.equal(lang({ language: "sr" }, { language: "sr-Latn" }), "sr-Latn");
});

test("the language resolves to de and es, with an English fallback", () => {
  const { lang } = load();
  assert.equal(lang({ language: "de" }, {}), "de");
  assert.equal(lang({ locale: { language: "es-ES" } }, {}), "es");
  assert.equal(lang({ language: "fr" }, { language: "de" }), "de");
  assert.equal(lang({ language: "xx" }, {}), "en");
});

test("the language resolves to it, nl, pt and pl, pt-BR falling back to European Portuguese", () => {
  const { lang } = load();
  assert.equal(lang({ language: "it-IT" }, {}), "it");
  assert.equal(lang({ language: "nl-BE" }, {}), "nl");
  assert.equal(lang({ language: "pt" }, {}), "pt");
  assert.equal(lang({ language: "pt-BR" }, {}), "pt");
  assert.equal(lang({ locale: { language: "pl-PL" } }, {}), "pl");
  assert.equal(lang({ language: "sr-Latn" }, {}), "sr-Latn");
  assert.equal(lang({ language: "ja" }, {}), "en");
  assert.equal(lang({ language: "en" }, { language: "pl" }), "pl");
});

test("the language resolves to the 12 languages added in 1.21.11, with regional variants", () => {
  const { lang } = load();
  for (const l of ["ro", "da", "sv", "bg", "ru", "uk", "hu", "sk", "cs", "sl", "lv", "el"]) assert.equal(lang({ language: l }, {}), l);
  assert.equal(lang({ language: "ro-RO" }, {}), "ro");
  assert.equal(lang({ language: "sv-FI" }, {}), "sv");
  assert.equal(lang({ locale: { language: "ru-RU" } }, {}), "ru");
  assert.equal(lang({ language: "cs-CZ" }, {}), "cs");
  assert.equal(lang({ language: "el-GR" }, {}), "el");
  assert.equal(lang({ language: "en" }, { language: "uk" }), "uk");
  assert.equal(lang({ language: "sr" }, {}), "sr");
  assert.equal(lang({ language: "sr-Latn" }, {}), "sr-Latn");
});

test("the editor offers every language", () => {
  const { SystemMonitorMiniCardEditor } = load();
  const editor = new SystemMonitorMiniCardEditor();
  editor._config = {};
  const field = editor._schema().find((f) => f.name === "language");
  const values = field.selector.select.options.map((o) => o.value);
  for (const l of ["en", ...LANGS]) assert.ok(values.includes(l), `editor option ${l}`);
  assert.equal(field.selector.select.options.find((o) => o.value === "pt").label, "Português (Portugal)");
  assert.equal(field.selector.select.options.find((o) => o.value === "el").label, "Ελληνικά");
});
