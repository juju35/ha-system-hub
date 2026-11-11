import assert from "node:assert/strict";
import { test } from "node:test";
import { CASES, scenario } from "./argument-cases.mjs";
import { load } from "./load.mjs";

const lib = load();
/** Plain objects (the card runs in another realm) with sorted keys. */
const plain = (o) => JSON.parse(JSON.stringify(o));

test("reference table: every mount point, interface and process is found", async (t) => {
  for (const [name, sensors, opts] of CASES) {
    await t.test(name, () => {
      const { hass, want } = scenario(sensors, opts);
      const sm = lib.discover(hass);
      assert.deepEqual(plain({ disks: sm.disks, nets: sm.nets, procs: sm.procs }), want);
    });
  }
});
