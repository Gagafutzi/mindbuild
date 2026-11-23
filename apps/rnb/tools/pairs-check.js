#!/usr/bin/env node
/*
 * Pairs mode: second order taken a layer further (model.js, pairPlan).
 *
 * Moves come in fours. After move 2 the question is how move 1 relates to move 2;
 * after move 4, how 3 relates to 4, and how the sum 1 + 2 relates to the sum 3 + 4.
 * Checked here, from positions alone: that the cycle is counted from the block's
 * first move, that all three relations come up about evenly, that the app's own
 * judgments ask exactly these and nothing on moves 1 and 3, and that the sums
 * cannot be answered from a pair's single moves — a player comparing the second
 * moves of the pairs, or the first ones, or reusing the pair's own relation,
 * scores little on them.
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

const CELLS = [];
for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) for (let z = 0; z < 3; z++) CELLS.push({ x, y, z });

function run({ pairs = true, length = 60000 } = {}) {
  const cfg = { n: 1, nest: 0, meta: true, metaPairs: pairs, frame: 'cube', lureRate: 0.2, varN: 0, retro: 0,
                gate: 0, magnitudeCap: 2, coordAxes: [], streams: { position: 'relational' } };
  const state = { cells: CELLS, chain: [], metaDrawn: null, nest: null };
  const POOL = [0, 0, 0];
  const M = createSampler({
    cfg, state,
    STREAM_KEYS: ['position'],
    TARGET_RATE: 0.28, META_SHARE: { same: .25, opp: .25, diff: .25, obl: .25 }, META_FLOOR: 0.05,
    PANS: POOL, LETTER_KEYS: [0, 0, 0, 0], GLYPH_SET_KEYS: [],
    dimCount: () => 3, magnitudeCap: () => 2, coordAxes: () => [],
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
  return { blocks, M };
}

/* Independent of the sampler: positions to vectors, vectors to a relation. */
const vec = (a, b) => { const p = CELLS[a.cellIdx], q = CELLS[b.cellIdx]; return [q.x - p.x, q.y - p.y, q.z - p.z]; };
const add = (u, v) => u.map((x, i) => x + v[i]);
function relation(A, B) {
  const d = A[0] * B[0] + A[1] * B[1] + A[2] * B[2];
  const na = Math.hypot(...A), nb = Math.hypot(...B);
  if (!na || !nb) return null;
  if (d === 0) return 'diff';
  const c = d / (na * nb);
  return c > 1 - 1e-9 ? 'same' : c < -1 + 1e-9 ? 'opp' : 'obl';
}

const { blocks, M } = run();

console.log('the cycle\n');
{
  let wrong = 0, total = 0;
  blocks.forEach(b => b.forEach((t, k) => {
    total++;
    const want = k >= 1 ? ((k - 1) % 4) + 1 : undefined;
    if (t.pairStep !== want) wrong++;
  }));
  ok('moves are counted 1 2 3 4 from the block\'s first move', wrong === 0, `${wrong} of ${total}`);
  const off = run({ pairs: false, length: 2000 });
  ok('with pairs off nothing is counted', off.blocks.every(b => b.every(t => t.pairStep == null)));
}

/* Every four from each block: the relations asked. */
const fours = [];
blocks.forEach(b => {
  for (let k = 1; k + 3 < b.length; k += 4) {
    const P = [b[k - 1], b[k], b[k + 1], b[k + 2], b[k + 3]];
    const m = [vec(P[0], P[1]), vec(P[1], P[2]), vec(P[2], P[3]), vec(P[3], P[4])];
    fours.push({ P, m, r12: relation(m[0], m[1]), r34: relation(m[2], m[3]),
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
  ['same', 'opp', 'diff', 'obl'].forEach(k => { pairsC[k] += p34[k]; });
  const tot = Object.values(pairsC).reduce((s, v) => s + v, 0);
  console.log('   inside the pairs: ' + ['same', 'opp', 'diff', 'obl'].map(k => `${k} ${pct(pairsC[k] / tot)}`).join(', '));
  ok('inside the pairs, the four relations come up about evenly',
     ['same', 'opp', 'diff', 'obl'].every(k => pairsC[k] / tot > 0.15),
     ['same', 'opp', 'diff', 'obl'].map(k => `${k} ${pct(pairsC[k] / tot)}`).join(', '));
  const s = share('rs'), st = fours.length;
  /* A sum can be nothing (a move and its reverse); then the answer is to press
     nothing, as for an oblique pair. */
  const noneish = (s.obl + s.none) / st;
  ok('between the sums, same, opposite, right angles and "press nothing" all come up',
     s.same / st > 0.15 && s.opp / st > 0.15 && s.diff / st > 0.15 && noneish > 0.15 && noneish < 0.4,
     `same ${pct(s.same / st)}, opp ${pct(s.opp / st)}, right angles ${pct(s.diff / st)}, oblique ${pct(s.obl / st)}, a sum of nothing ${pct(s.none / st)}`);
}

{
  /* The running tally is what spreads the sums' relations across a block, not
     just over many: without it each block's commonest relation takes more. */
  let tot = 0, n = 0;
  blocks.forEach(b => {
    const c = {};
    let m = 0;
    for (let k = 1; k + 3 < b.length; k += 4) {
      const v = (i, j) => vec(b[k - 1 + i], b[k - 1 + j]);
      const r = relation(add(v(0, 1), v(1, 2)), add(v(2, 3), v(3, 4))) || 'none';
      c[r] = (c[r] || 0) + 1; m++;
    }
    if (m) { tot += Math.max(...Object.values(c)) / m; n++; }
  });
  console.log(`   commonest sums' relation per block, on average: ${pct(tot / n)}`);
  ok('within a block the sums\' relations are spread out', tot / n < 0.39, pct(tot / n));
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
  let wrong = 0, asked1or3 = 0, checked = 0;
  blocks.slice(0, 600).forEach(b => b.forEach((t, k) => {
    if (k < 1) return;
    /* block.js, as written there. */
    const role = (k - 1) % 4;
    const extra = { role, cycle: b.slice(k - 1 - role, k).concat([t]) };
    const js = geo.buildJudgments(b[k - 1], t, extra);
    const pos = js.filter(j => j.stream === 'position'), sum = js.filter(j => j.stream === 'position3');
    if (role === 0 || role === 2) { if (pos.length || sum.length) asked1or3++; return; }
    checked++;
    const c = extra.cycle;
    const want = role === 1 ? relation(vec(c[0], c[1]), vec(c[1], c[2])) : relation(vec(c[2], c[3]), vec(c[3], c[4]));
    if (!pos.length || JSON.stringify(pos[0].correct) !== JSON.stringify(ID[want] ? [ID[want]] : [])) wrong++;
    if (role === 3) {
      const ws = relation(add(vec(c[0], c[1]), vec(c[1], c[2])), add(vec(c[2], c[3]), vec(c[3], c[4])));
      if (!sum.length || JSON.stringify(sum[0].correct) !== JSON.stringify(SID[ws] ? [SID[ws]] : [])) wrong++;
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
  console.log(`   holding the sums ${pct(full)} | the second moves only ${pct(seconds)} | the first moves only ${pct(firsts)} | the pair's own relation ${pct(reuse)}`);
  ok('holding the sums is perfect', full > 0.999);
  ok('comparing a pair\'s single moves instead scores little', seconds < 0.5 && firsts < 0.5, `${pct(seconds)} / ${pct(firsts)}`);
  ok('reusing the pair\'s own relation scores little', reuse < 0.4, pct(reuse));
}

console.log(bad ? `\n${bad} FAILED` : '\nall checks passed');
process.exit(bad ? 1 : 0);
