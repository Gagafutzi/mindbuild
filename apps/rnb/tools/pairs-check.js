#!/usr/bin/env node
/*
 * Pairs mode: second order taken a layer further (model.js, pairPlan).
 *
 * Moves come in fours, counted from the block's first. After move 2 the question
 * is how move 1 relates to move 2; after move 4, how 3 relates to 4, and how the
 * sum 1 + 2 relates to the sum 3 + 4. Each move is a vector of its own, from a
 * start of its own (`fromIdx`) to the lit place: where one ended is not where the
 * next begins.
 *
 * Checked here, from positions alone: that every move is a real vector inside the
 * lattice; that the cycle is counted from the block's first move; that all the
 * relations come up about evenly; that the app's own judgments ask exactly these
 * and nothing on moves 1 and 3; and that the sums cannot be answered without
 * adding — not from a pair's single moves, not by reusing the pair's own
 * relation, and not off positions, which is what chained moves allowed (a pair's
 * sum was then just where it ended less where it started).
 *
 *   node tools/pairs-check.js
 */

const path = require('path'), fs = require('fs'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const createSampler = require(path.join(ROOT, 'js/model.js'));

let bad = 0;
const ok = (name, cond, extra = '') => {
  console.log((cond ? '  ok   ' : '  FAIL ') + name + (cond ? '' : '  ' + extra));
  if (!cond) bad++;
};
const pct = x => (100 * x).toFixed(0) + '%';
const BLOCK = 40;

/* The cube, and open space as buildCube makes it: two wider, the outer layer flagged. */
function lattice(grid, open) {
  const out = [];
  for (let x = 0; x < grid; x++) for (let y = 0; y < grid; y++) for (let z = 0; z < grid; z++)
    out.push(open && [x, y, z].some(c => c === 0 || c === grid - 1) ? { x, y, z, outside: true } : { x, y, z });
  return out;
}
const CELLS = lattice(3, false);

function run({ pairs = true, length = 60000, cells = CELLS, coordAxes = [], openSpace = false, everyAxis = true } = {}) {
  const cfg = { n: 1, nest: 0, meta: true, metaPairs: pairs, frame: 'cube', lureRate: 0.2, varN: 0, retro: 0,
                gate: 0, magnitudeCap: 2, coordAxes, streams: { position: 'relational' }, openSpace, everyAxis };
  const state = { cells, chain: [], metaDrawn: null, nest: null };
  const POOL = [0, 0, 0];
  const M = createSampler({
    cfg, state,
    STREAM_KEYS: ['position'],
    TARGET_RATE: 0.28, META_SHARE: { same: .25, opp: .25, diff: .25, obl: .25 }, META_FLOOR: 0.05,
    PANS: POOL, LETTER_KEYS: [0, 0, 0, 0], GLYPH_SET_KEYS: [],
    dimCount: () => 3 + coordAxes.length, magnitudeCap: () => 2, coordAxes: () => coordAxes,
    poolFor: () => POOL, voiceSet: () => ({ voices: POOL }),
  });
  const blocks = [];
  for (let i = 0; i < length; i++) {
    if (i % BLOCK === 0) { state.chain = []; state.metaDrawn = null; state.sumDrawn = null; state.pairQueue = null; blocks.push([]); }
    const t = M.sampleTrial();
    t.pair = state.chain.length ? [state.chain[state.chain.length - 1], t] : null;
    state.chain.push(t);
    blocks[blocks.length - 1].push(t);
  }
  return { blocks, M, cells };
}

/* Independent of the sampler: a move's vector, vectors to a relation. */
const at = (cells, i) => cells[i];
const vecOf = (cells, t) => {
  const p = at(cells, t.fromIdx), q = at(cells, t.cellIdx);
  return [q.x - p.x, q.y - p.y, q.z - p.z];
};
const vec = t => vecOf(CELLS, t);
const add = (u, v) => u.map((x, i) => x + v[i]);
const sub = (u, v) => u.map((x, i) => x - v[i]);
const P = i => [CELLS[i].x, CELLS[i].y, CELLS[i].z];
function relation(A, B) {
  const d = A[0] * B[0] + A[1] * B[1] + A[2] * B[2];
  const na = Math.hypot(...A), nb = Math.hypot(...B);
  if (!na || !nb) return null;
  if (d === 0) return 'diff';
  const c = d / (na * nb);
  return c > 1 - 1e-9 ? 'same' : c < -1 + 1e-9 ? 'opp' : 'obl';
}
const KINDS = ['same', 'opp', 'diff', 'obl'];

const { blocks, M } = run();

console.log('the moves\n');
{
  let broken = 0, total = 0, chained = 0, follow = 0;
  blocks.forEach(b => b.forEach((t, k) => {
    total++;
    const ok1 = t.fromIdx != null && CELLS[t.fromIdx] && CELLS[t.cellIdx] && t.fromIdx !== t.cellIdx &&
                vec(t).every(c => Math.abs(c) <= 2);
    if (!ok1) broken++;
    if (k) { follow++; if (t.fromIdx === b[k - 1].cellIdx) chained++; }
  }));
  ok('every move has a start of its own, inside the lattice, at most two places on any axis',
     broken === 0, `${broken} of ${total}`);
  console.log(`   a move starting where the one before ended: ${pct(chained / follow)}`);
  ok('moves do not carry on from where the last one ended', chained / follow < 0.15, pct(chained / follow));
  const off = run({ pairs: false, length: 2000 });
  ok('with pairs off a move has no start of its own', off.blocks.every(b => b.every(t => t.fromIdx == null)));
  const coords = run({ coordAxes: ['pitch'], length: 2000 });
  ok('with a coordinate axis on, pairs stay off', coords.blocks.every(b => b.every(t => t.fromIdx == null)));
}

console.log('\nthe cycle\n');
{
  let wrong = 0, total = 0;
  blocks.forEach(b => b.forEach((t, k) => { total++; if (t.pairStep !== (k % 4) + 1) wrong++; }));
  ok('moves are counted 1 2 3 4 from the block\'s first move', wrong === 0, `${wrong} of ${total}`);
}

/* Every four from each block: the relations asked. */
const fours = [];
blocks.forEach(b => {
  for (let k = 0; k + 3 < b.length; k += 4) {
    const T = b.slice(k, k + 4), m = T.map(vec);
    fours.push({ T, m, r12: relation(m[0], m[1]), r34: relation(m[2], m[3]),
                 rs: relation(add(m[0], m[1]), add(m[2], m[3])) });
  }
});

console.log('\nthe relations\n');
{
  const share = key => {
    const c = { same: 0, opp: 0, diff: 0, obl: 0, none: 0 };
    fours.forEach(f => c[f[key] || 'none']++);
    return c;
  };
  const pairsC = share('r12'), p34 = share('r34');
  KINDS.forEach(k => { pairsC[k] += p34[k]; });
  const tot = Object.values(pairsC).reduce((s, v) => s + v, 0);
  const line = c => KINDS.map(k => `${k} ${pct(c[k] / tot)}`).join(', ');
  console.log('   inside the pairs: ' + line(pairsC));
  ok('inside the pairs, the four relations come up about evenly', KINDS.every(k => pairsC[k] / tot > 0.15), line(pairsC));
  const s = share('rs'), st = fours.length;
  console.log(`   between the sums: same ${pct(s.same / st)}, opp ${pct(s.opp / st)}, right angles ${pct(s.diff / st)}, oblique ${pct(s.obl / st)}`);
  ok('between the sums, same, opposite, right angles and "press nothing" all come up',
     KINDS.every(k => s[k] / st > 0.15) && s.obl / st < 0.4,
     KINDS.map(k => `${k} ${pct(s[k] / st)}`).join(', '));
  ok('a pair never sums to nothing', s.none === 0, `${s.none} of ${st}`);
}

{
  /* The running tally is what spreads the sums' relations across a block, not
     just over many: without it each block's commonest relation takes more. */
  let tot = 0, n = 0;
  blocks.forEach(b => {
    const c = {};
    let m = 0;
    for (let k = 0; k + 3 < b.length; k += 4) {
      const v = b.slice(k, k + 4).map(vec);
      const r = relation(add(v[0], v[1]), add(v[2], v[3])) || 'none';
      c[r] = (c[r] || 0) + 1; m++;
    }
    if (m) { tot += Math.max(...Object.values(c)) / m; n++; }
  });
  console.log(`   commonest sums' relation per block, on average: ${pct(tot / n)}`);
  ok('within a block the sums\' relations are spread out', tot / n < 0.39, pct(tot / n));
}

{
  /* Open space: 125 places, the same rules, and every vector on every axis
     (model.js, everyAxis). */
  const open = run({ cells: lattice(5, true), length: 12000, openSpace: true });
  let broken = 0, n = 0;
  const c = { same: 0, opp: 0, diff: 0, obl: 0 };
  open.blocks.forEach(b => {
    b.forEach(t => {
      const v = vecOf(open.cells, t);
      if (t.fromIdx === t.cellIdx || v.some(x => Math.abs(x) > 2)) broken++;
    });
    for (let k = 0; k + 3 < b.length; k += 4) {
      const v = b.slice(k, k + 4).map(t => vecOf(open.cells, t));
      const r = relation(add(v[0], v[1]), add(v[2], v[3]));
      if (r) c[r]++;
      n++;
    }
  });
  ok('open space: every move fits, and the sums\' relations come up about evenly',
     broken === 0 && KINDS.every(k => c[k] / n > 0.15), `${broken} broken; ` + KINDS.map(k => `${k} ${pct(c[k] / n)}`).join(', '));
  const zeros = os => os.blocks.flat().filter(t => vecOf(os.cells, t).some(x => x === 0)).length;
  const pc = { same: 0, opp: 0, diff: 0, obl: 0 };
  let pn = 0;
  open.blocks.forEach(b => { for (let k = 0; k + 3 < b.length; k += 4) {
    const v = b.slice(k, k + 4).map(t => vecOf(open.cells, t));
    [relation(v[0], v[1]), relation(v[2], v[3])].forEach(r => { pc[r]++; pn++; });
  } });
  ok('open space: no move has a zero on any axis, and inside the pairs all four relations still come up',
     zeros(open) === 0 && KINDS.every(k => pc[k] / pn > 0.15),
     `${zeros(open)} with a zero; ` + KINDS.map(k => `${k} ${pct(pc[k] / pn)}`).join(', '));
  const offRun = run({ cells: lattice(5, true), length: 4000, openSpace: true, everyAxis: false });
  ok('open space with every axis off: moves with a zero come back', zeros(offRun) > 400, String(zeros(offRun)));
}

console.log('\nthe judgments the app scores\n');
{
  const geo = vm.createContext({ console, Math, Array, Object, JSON });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/constants.js'), 'utf8').replace(/^"use strict";/, ''), geo);
  geo.CELLS = CELLS; geo.moveVectorOf = M.moveVectorOf; geo.metaRelationOf = M.metaRelationOf;
  vm.runInContext(`
    var cfg = { coordAxes: [], magnitudeCap: 2, frame: 'cube', nest: 0, meta: true, metaPairs: true,
                streams: { position: 'relational' } };
    var state = { cells: CELLS };
    var normalise = function (v) { var m = Math.sqrt(v[0]*v[0]+v[1]*v[1]+v[2]*v[2]); return m < 1e-6 ? [0,0,0] : [v[0]/m, v[1]/m, v[2]/m]; };
    var projectScreen = function (d) { return d; };
  `, geo);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/judgments.js'), 'utf8').replace(/^"use strict";/, ''), geo);
  const ID = { same: 'meta-same', opp: 'meta-opp', diff: 'meta-diff' };
  const SID = { same: 'sum-same', opp: 'sum-opp', diff: 'sum-orth' };
  const want = (ids, r) => JSON.stringify(ids[r] ? [ids[r]] : []);
  let wrong = 0, asked1or3 = 0, checked = 0;
  blocks.slice(0, 600).forEach(b => b.forEach((t, k) => {
    if (k < 1) return;
    /* block.js, as written there. */
    const role = k % 4;
    const extra = { role, cycle: b.slice(k - role, k).concat([t]) };
    const js = geo.buildJudgments(b[k - 1], t, extra);
    const pos = js.filter(j => j.stream === 'position'), sum = js.filter(j => j.stream === 'position3');
    if (role === 0 || role === 2) { if (pos.length || sum.length) asked1or3++; return; }
    checked++;
    const m = extra.cycle.map(vec);
    const r = role === 1 ? relation(m[0], m[1]) : relation(m[2], m[3]);
    if (!pos.length || JSON.stringify(pos[0].correct) !== want(ID, r)) wrong++;
    if (role === 3) {
      const rs = relation(add(m[0], m[1]), add(m[2], m[3]));
      if (!sum.length || JSON.stringify(sum[0].correct) !== want(SID, rs)) wrong++;
    } else if (sum.length) wrong++;
  }));
  ok('moves 2 and 4 are asked exactly the pair\'s relation, and move 4 the sums\' too', wrong === 0 && checked > 1000,
     `${wrong} wrong of ${checked}`);
  ok('moves 1 and 3 ask nothing of position', asked1or3 === 0, `${asked1or3} did`);
}

console.log('\nthe sums are their own question\n');
{
  const score = guess => {
    let right = 0;
    const counts = {};
    fours.forEach(f => {
      const truth = f.rs === 'same' || f.rs === 'opp' || f.rs === 'diff' ? f.rs : 'none';
      counts[truth] = (counts[truth] || 0) + 1;
      let g = guess(f); g = g === 'same' || g === 'opp' || g === 'diff' ? g : 'none';
      if (g === truth) right++;
    });
    const chance = Math.max(...Object.values(counts)) / fours.length;
    return Math.max(0, (right / fours.length - chance) / (1 - chance));
  };
  const full = score(f => f.rs);
  const seconds = score(f => relation(f.m[1], f.m[3]));
  const firsts = score(f => relation(f.m[0], f.m[2]));
  const reuse = score(f => f.r34);
  /* What chained moves allowed: a pair's sum read as where it ended less where it began. */
  const positions = score(f => relation(sub(P(f.T[1].cellIdx), P(f.T[0].fromIdx)), sub(P(f.T[3].cellIdx), P(f.T[2].fromIdx))));
  console.log(`   holding the sums ${pct(full)} | the second moves only ${pct(seconds)} | the first moves only ${pct(firsts)} | ` +
              `the pair's own relation ${pct(reuse)} | off the positions ${pct(positions)}`);
  ok('holding the sums is perfect', full > 0.999);
  ok('comparing a pair\'s single moves instead scores little', seconds < 0.5 && firsts < 0.5, `${pct(seconds)} / ${pct(firsts)}`);
  ok('reusing the pair\'s own relation scores little', reuse < 0.4, pct(reuse));
  ok('reading a sum off where the pair began and ended scores little', positions < 0.4, pct(positions));
}

console.log(bad ? `\n${bad} FAILED` : '\nall checks passed');
process.exit(bad ? 1 : 0);
