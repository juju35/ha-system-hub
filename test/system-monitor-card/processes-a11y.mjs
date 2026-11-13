import assert from "node:assert/strict";
import { test } from "node:test";
import { devices, entities, states } from "./mock-states.mjs";
import { load } from "./load.mjs";

const lib = load();
const hassWith = (overrides = {}) => ({ states: { ...states }, entities, devices, language: "en", ...overrides });

const withStates = (hass, ids, state) => {
  const next = { ...hass.states };
  for (const id of ids) next[id] = { entity_id: id, state, attributes: {} };
  return { ...hass, states: next };
};

const card = (Cls, hass, config = {}) => {
  const c = new Cls();
  c._hass = hass;
  c._config = config;
  return c;
};

const procIds = (hass) => Object.values(lib.discover(hass).procs);
/** The mock with every process running. */
const running = () => {
  const hass = hassWith();
  return withStates(hass, procIds(hass), "on");
};

for (const state of ["unavailable", "unknown"]) {
  test(`process sensor ${state}: grey chip, not counted as stopped, list not forced open`, () => {
    const base = running();
    const [id] = procIds(base);
    const hass = withStates(base, [id], state);
    const c = card(lib.SystemMonitorCard, hass);
    const sm = lib.discover(hass);
    assert.equal(c._stopped(sm).length, 0);
    assert.equal(c._procsKo(), false);
    assert.equal(c._procsUnfolded(), false);
    const tile = c._procsStat(sm);
    assert.equal(tile.cls, "muted");
    assert.match(tile.html, /Unknown/);
    c._procsOpen = true;
    const html = c._processes(sm);
    assert.match(html, new RegExp(`class="chip clickable muted" data-entity="${id}"`));
    assert.doesNotMatch(html, /chip crit/);
  });
}

test("process sensor off: still red and counted, list forced open", () => {
  const base = running();
  const [id] = procIds(base);
  const hass = withStates(base, [id], "off");
  const c = card(lib.SystemMonitorCard, hass);
  const sm = lib.discover(hass);
  assert.deepEqual([...c._stopped(sm)], [id]);
  assert.equal(c._procsUnfolded(), true);
  assert.equal(c._procsStat(sm).cls, "crit");
  assert.match(c._processes(sm), new RegExp(`class="chip clickable crit" data-entity="${id}"`));
});

/** Every element opening an entity or an action can be reached and used with the keyboard. */
const assertKeyboard = (html) => {
  const tags = html.match(/<(span|div)\b[^>]*\bdata-(entity|action)="[^"]+"[^>]*>/g) || [];
  assert.ok(tags.length > 0);
  for (const tag of tags) {
    assert.match(tag, /role="button"/, tag);
    assert.match(tag, /tabindex="0"/, tag);
  }
};

test("full card: update pill, facts, processes header and chips are keyboard buttons", () => {
  const base = hassWith();
  const hass = withStates(base, [procIds(base)[0]], "off");
  const html = card(lib.SystemMonitorCard, hass)._render();
  assert.match(html, /data-action="procs" role="button" tabindex="0"/);
  assertKeyboard(html);
});

test("mini card: footer items are keyboard buttons (with and without the rate tiles)", () => {
  for (const config of [{}, { show_history: false }]) assertKeyboard(card(lib.SystemMonitorMiniCard, hassWith(), config)._compactRender());
});

test("a click in a dialog (more-info) does not fold the processes list", () => {
  const listeners = [];
  const doc = lib.document;
  const add = doc.addEventListener;
  doc.addEventListener = (_type, fn) => listeners.push(fn);
  const c = card(lib.SystemMonitorCard, hassWith());
  c.connectedCallback();
  doc.addEventListener = add;
  c._procsOpen = true;
  c._update = () => {};
  const dialog = { localName: "ha-more-info-dialog" };
  for (const fn of listeners) fn({ composedPath: () => [{ localName: "div" }, dialog] });
  assert.equal(c._procsOpen, true);
  for (const fn of listeners) fn({ composedPath: () => [{ localName: "div" }] });
  assert.equal(c._procsOpen, false);
});

test("numbers use the card language's decimal separator", () => {
  const hass = hassWith({ language: "fr", locale: { language: "fr" } });
  const html = card(lib.SystemMonitorCard, hass)._render();
  assert.match(html, /1,3 MB\/s/);
  assert.match(html, /0,42 · 0,37 · 0,31/);
  assert.match(card(lib.SystemMonitorCard, hassWith())._render(), /0\.42 · 0\.37 · 0\.31/);
  assert.equal(lib.fmtBytes(1536, "de"), "1,5 KiB");
  assert.equal(lib.fmtBytes(1536), "1.5 KiB");
  assert.equal(lib.fmtBytes(2 * 1024 ** 3 - 1, "fr"), "2 GiB");
});

test("no rewrite under a press: drawn after its release, and at once by its click", () => {
  const c = card(lib.SystemMonitorCard, running());
  c._update();
  const before = c.shadowRoot.innerHTML;
  c._pressing = true;
  c._procsOpen = true;
  c._update();
  assert.equal(c.shadowRoot.innerHTML, before, "no rewrite under the pointer");
  c._endPress(); // what the release runs, on the next task (no timers in this sandbox)
  assert.notEqual(c.shadowRoot.innerHTML, before, "drawn right after the release");
  const open = c.shadowRoot.innerHTML;
  c._pressing = true;
  c._pressClick({ detail: 1 });
  c._procsOpen = false;
  c._update();
  assert.equal(c.shadowRoot.innerHTML, before, "the click draws at once");
  assert.notEqual(open, before);
  c.disconnectedCallback();
  assert.equal(c._pressing, false);
});
