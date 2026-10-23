"use strict";
/*
 * Ribbon World's engine, in Node: the symmetries, the topology, the Gate, and
 * that every question an episode asks has the answer it says it has.
 *
 *   node apps/ribbon/test/run.js
 */

const assert = require("assert");
const R = require("../world.js");

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log("  ok  " + name); }
  catch (e) { failed++; console.log("FAIL  " + name + "\n      " + (e && e.message)); }
}
const key = (m) => m.join(",");

test("the eight orientations are distinct, closed, and half of them mirrored", () => {
  assert.strictEqual(new Set(R.ALL.map(key)).size, 8);
  for (const a of R.ALL) for (const op of Object.values(R.OPS)) {
    assert.ok(R.ALL.some((b) => R.same(b, R.mul(op, a))), "not closed");
  }
  assert.strictEqual(R.ALL.filter((m) => R.det(m) === -1).length, 4);
});

test("the changes compose as they should", () => {
  const I = [1, 0, 0, 1], { mirror, cw, ccw, half } = R.OPS;
  assert.ok(R.same(R.mul(mirror, mirror), I));
  assert.ok(R.same(R.mul(cw, ccw), I));
  assert.ok(R.same(R.mul(cw, cw), half));
  assert.ok(R.same(R.mul(cw, R.mul(cw, R.mul(cw, cw))), I));
  /* Turning then mirroring is not mirroring then turning. */
  assert.ok(!R.same(R.mul(mirror, cw), R.mul(cw, mirror)));
  /* A quarter turn clockwise on screen sends right to down. */
  assert.deepStrictEqual([cw[0] * 1 + cw[1] * 0, cw[2] * 1 + cw[3] * 0], [0, 1]);
});

test("once round the twisted loop hands a shape back mirrored, twice restores it", () => {
  const world = { loops: [{ n: 10, fixtures: [{ at: 4, op: "mirror" }] }, { n: 8, fixtures: [] }],
                  rule: { kind: "hand", value: 2 }, pOpen: 1, shapes: [] };   // a rule nothing meets: never crosses
  let s = { loop: 0, slot: 1, m: [1, 0, 0, 1] };
  for (let k = 0; k < 10; k++) s = R.advance(world, s, true).shape;
  assert.deepStrictEqual([s.loop, s.slot, R.det(s.m)], [0, 1, -1]);
  for (let k = 0; k < 10; k++) s = R.advance(world, s, true).shape;
  assert.ok(R.same(s.m, [1, 0, 0, 1]));
});

test("the Gate lets one kind across, and only when it is open", () => {
  const world = { loops: [{ n: 6, fixtures: [] }, { n: 6, fixtures: [] }], rule: { kind: "hand", value: -1 }, pOpen: 1, shapes: [] };
  const mirrored = R.OPS.mirror, plain = [1, 0, 0, 1];
  assert.strictEqual(R.advance(world, { loop: 0, slot: 0, m: mirrored }, true).shape.loop, 1);
  assert.strictEqual(R.advance(world, { loop: 1, slot: 0, m: mirrored }, true).shape.loop, 0);
  assert.strictEqual(R.advance(world, { loop: 0, slot: 0, m: plain }, true).shape.loop, 0);
  assert.strictEqual(R.advance(world, { loop: 0, slot: 0, m: mirrored }, false).shape.loop, 0);
  const axis = { kind: "axis", value: true };
  assert.ok(R.crosses(axis, plain) && R.crosses(axis, R.OPS.half) && !R.crosses(axis, R.OPS.cw));
});

test("every episode, at every level, asks what it says it asks", () => {
  for (let L = 1; L <= 12; L++) {
    const P = R.params(L);
    for (let seed = 1; seed <= 60; seed++) {
      const where = `level ${L}, seed ${seed}`;
      const ep = R.makeEpisode(R.Rng(seed * 104729 + L), P);

      assert.strictEqual(ep.clip.fits.length, 1, `${where}: the clip fits ${ep.clip.fits.length} rules`);
      assert.ok(R.sameRule(ep.clip.fits[0], ep.world.rule), `${where}: the clip fits the wrong rule`);

      for (const q of ep.predicts) {
        assert.strictEqual(q.options.length, 4);
        assert.strictEqual(new Set(q.options.map((o) => o.loop + ":" + key(o.m))).size, 4, `${where}: two options alike`);
        const truth = R.exitAfter(ep.world, ep.now[q.shape], q.horizon).shape;
        const right = q.options[q.answer];
        assert.ok(right.loop === truth.loop && R.same(right.m, truth.m), `${where}: the marked answer is not what happens`);
      }

      assert.deepStrictEqual(R.removable(ep.world, ep.impossible), [ep.impossible.wrong], `${where}: impossible frame not unique`);

      const f = ep.fog;
      assert.ok(f.pCross === 0 ? f.outcome === f.startLoop : f.pCross === ep.world.pOpen, `${where}: fog odds inconsistent`);
      if (f.wants && f.open) assert.strictEqual(f.outcome, 1 - f.startLoop);
      for (const fr of [f.frames[f.frames.length - 1]]) {
        const s = fr.shapes[f.shape];
        assert.ok(R.fogged(ep.world, s.loop, s.slot), `${where}: the fog shape ends in plain sight`);
      }

      assert.strictEqual(ep.analogy.same, R.sameStructure(ep.world, ep.analogy.world), `${where}: analogy mislabelled (${ep.analogy.change})`);
    }
  }
});

test("a world that differs is never only clockwise for anticlockwise", () => {
  const a = { loops: [{ fixtures: [{ op: "mirror" }] }, { fixtures: [{ op: "cw" }] }], rule: { kind: "hand" } };
  const b = { loops: [{ fixtures: [{ op: "mirror" }] }, { fixtures: [{ op: "ccw" }] }], rule: { kind: "hand" } };
  assert.ok(R.sameStructure(a, b));
});

console.log("\n" + passed + "/" + (passed + failed) + " passed");
process.exit(failed ? 1 : 0);
