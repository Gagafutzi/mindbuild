#!/usr/bin/env node
/*
 * Open space: the lattice one layer wider on every side, drawn as nothing but the
 * three coordinate axes through the middle (geometry.js, buildCube).
 *
 * The thing that could go quietly wrong is where the cube goes. 98 of the 125
 * places around a 3-cube are outside the old one, so an even draw put the cube
 * outside nine trials in ten and the old cube stopped being the frame anything
 * happened in. The sampler draws an outer place about a third of the time instead;
 * this holds it there in every mode, keeps the rules the lattice already had (no
 * standing still above lag one, matches at the target rate), and checks that a
 * lattice with no outer places is still drawn evenly.
 *
 * And moves on every axis (model.js, everyAxis), on by default there: the cube is
 * too small out there to tell a step on an axis from none, so in every mode the
 * new place differs in x, y and z from the place it is judged against and from
 * the one it just left (a match aside, being the same place); second order steps
 * diagonally, so it states same, opposite or neither and never a right angle; a
 * relational lure still answers differently on some axis; and switched off,
 * moves on fewer axes come back.
 *
 *   node tools/open-space-check.js
 */

const path = require('path');
const createSampler = require(path.join(__dirname, '..', 'js/model.js'));

let bad = 0;
const ok = (name, cond, extra = '') => {
  console.log((cond ? '  ok   ' : '  FAIL ') + name + (cond ? '' : '  ' + extra));
  if (!cond) bad++;
};
const pct = x => (100 * x).toFixed(0) + '%';

/* As buildCube makes them: dim + 2 a side, the outer layer flagged. */
function lattice(dim, open) {
  const grid = dim + (open ? 2 : 0), out = [];
  for (let x = 0; x < grid; x++) for (let y = 0; y < grid; y++) for (let z = 0; z < grid; z++) {
    const outside = open && [x, y, z].some(c => c === 0 || c === grid - 1);
    out.push(outside ? { x, y, z, outside: true } : { x, y, z });
  }
  return out;
}

function run({ open, mode = 'relational', n = 2, meta = false, nest = 0, length = 30000, everyAxis = true,
               nestFrames = false }) {
  const cfg = { n, nest, meta, frame: 'cube', lureRate: 0.2, varN: 0, retro: 0, gate: 0, nestFrames,
                magnitudeCap: 2, coordAxes: [], streams: { position: mode }, openSpace: open, everyAxis };
  const state = { cells: lattice(3, open), chain: [], metaDrawn: null, nest: null };
  const POOL = [0, 0, 0];
  const M = createSampler({
    cfg, state,
    STREAM_KEYS: ['position', 'pitch', 'timbre', 'pan', 'color', 'size', 'quantity', 'letter'],
    TARGET_RATE: 0.28, META_SHARE: { same: .25, opp: .25, diff: .25, obl: .25 }, META_FLOOR: 0.05,
    PANS: POOL, LETTER_KEYS: [0, 0, 0, 0], GLYPH_SET_KEYS: [],
    dimCount: () => 3, magnitudeCap: () => 2, coordAxes: () => [],
    poolFor: () => POOL, voiceSet: () => ({ voices: POOL }),
  });
  const out = [];
  for (let i = 0; i < length; i++) {
    if (i % 40 === 0) { state.chain = []; state.nest = null; state.metaDrawn = null; }
    const t = M.sampleTrial();
    /* block.js: nested, the partner the sampler settled; else n back. */
    const partner = nest ? t.partner : (state.chain.length >= n ? state.chain[state.chain.length - n] : null);
    t.pair = partner ? [partner, t] : null;
    state.chain.push(t);
    out.push(t);
  }
  return { out, cells: state.cells, M };
}

console.log('where the cube goes\n');
for (const [label, opts] of [
  ['relational', { mode: 'relational' }],
  ['identity', { mode: 'identity' }],
  ['nested', { mode: 'relational', nest: 2 }],
]) {
  const { out, cells } = run({ open: true, ...opts });
  const share = out.filter(t => cells[t.cellIdx].outside).length / out.length;
  ok(`${label}: the cube is outside the old lattice about a third of the time`,
     share > 0.25 && share < 0.45, pct(share));
}
{
  /* Second order picks moves by relation, a step at a time, so its share is the
     walk's own; it only has to reach the outside and come back. */
  const { out, cells } = run({ open: true, mode: 'relational', n: 1, meta: true });
  const share = out.filter(t => cells[t.cellIdx].outside).length / out.length;
  ok('second order: the walk reaches the outer layer and the old lattice both',
     share > 0.1 && share < 0.9, pct(share));
}

console.log('\nthe rules the lattice already had\n');
{
  const { out } = run({ open: true, mode: 'relational', n: 2 });
  let still = 0;
  out.forEach((t, i) => { if (i % 40 && out[i - 1].cellIdx === t.cellIdx) still++; });
  ok('above lag one the cube never stands still', still === 0, `${still} times`);
}
{
  const { out } = run({ open: true, mode: 'identity', n: 2 });
  let match = 0, judged = 0;
  out.forEach((t, i) => { if (i % 40 >= 2) { judged++; if (out[i - 2].cellIdx === t.cellIdx) match++; } });
  ok('identity matches still come at about the target rate', match / judged > 0.18 && match / judged < 0.34,
     pct(match / judged));
}
{
  /* Without open space nothing changes: every place equally likely. */
  const { out, cells } = run({ open: false, mode: 'relational', length: 54000 });
  const counts = new Array(cells.length).fill(0);
  out.forEach(t => counts[t.cellIdx]++);
  const lo = Math.min(...counts) / (out.length / cells.length), hi = Math.max(...counts) / (out.length / cells.length);
  ok('a plain lattice is still drawn evenly', lo > 0.85 && hi < 1.15, `${lo.toFixed(2)}–${hi.toFixed(2)} of the even share`);
}

console.log('\nmoves on every axis\n');
{
  const apart = (cells, a, b) => { const p = cells[a], q = cells[b]; return p.x !== q.x && p.y !== q.y && p.z !== q.z; };
  for (const [label, opts] of [
    ['relational, N 2', { mode: 'relational', n: 2 }],
    ['relational, N 1', { mode: 'relational', n: 1 }],
    ['identity, N 2', { mode: 'identity', n: 2 }],
    ['nested relational', { mode: 'relational', nest: 2 }],
    ['nested identity', { mode: 'identity', nest: 2 }],
    ['nested, mirror frames', { mode: 'relational', nest: 2, nestFrames: true }],
    ['second order, N 1', { mode: 'relational', n: 1, meta: true }],
  ]) {
    const { out, cells } = run({ open: true, length: 20000, ...opts });
    let seen = 0, seenBad = 0, judged = 0, judgedBad = 0;
    out.forEach((t, i) => {
      const p = t.pair && t.pair[0];
      const same = p && p.cellIdx === t.cellIdx;          // a match: the same place by definition
      if (p && !same) { judged++; if (!apart(cells, p.cellIdx, t.cellIdx)) judgedBad++; }
      /* The place just left; into a match the place is set. */
      if (i % 40 && !same) {
        seen++; if (!apart(cells, out[i - 1].cellIdx, t.cellIdx)) seenBad++;
      }
    });
    ok(`${label}: every move, and every comparison, differs on all three axes`,
       judgedBad === 0 && seenBad / seen < 0.005,
       `judged ${judgedBad} of ${judged}, moves seen ${seenBad} of ${seen}`);
  }
  {
    /* Second order above lag one: the move judged starts at the partner, not at
       the place just left, and by a wall the diagonal that clears that place on
       every axis can be off the grid. The judged move is diagonal always. */
    const { out, cells } = run({ open: true, mode: 'relational', n: 2, meta: true, length: 20000 });
    let judgedBad = 0, judged = 0, seen = 0, seenAll = 0, seenTwo = 0;
    out.forEach((t, i) => {
      const p = t.pair && t.pair[0];
      if (p) { judged++; if (!apart(cells, p.cellIdx, t.cellIdx)) judgedBad++; }
      if (i % 40) {
        seen++;
        const a = cells[out[i - 1].cellIdx], b = cells[t.cellIdx];
        const k = ['x', 'y', 'z'].filter(c => a[c] !== b[c]).length;
        if (k === 3) seenAll++; if (k >= 2) seenTwo++;
      }
    });
    console.log(`   second order, N 2: moves seen on all three axes ${pct(seenAll / seen)}, on two or more ${pct(seenTwo / seen)}`);
    ok('second order, N 2: every judged move is diagonal, and the moves seen are on every axis mostly',
       judgedBad === 0 && seenAll / seen > 0.8 && seenTwo / seen > 0.96,
       `judged ${judgedBad} of ${judged}; seen on all three ${pct(seenAll / seen)}, on two ${pct(seenTwo / seen)}`);
  }
  {
    /* Identity still has its matches, and they stay where they were. */
    const { out } = run({ open: true, mode: 'identity', n: 2 });
    let match = 0, judged = 0;
    out.forEach((t, i) => { if (i % 40 >= 2) { judged++; if (out[i - 2].cellIdx === t.cellIdx) match++; } });
    ok('identity: matches still come at about the target rate', match / judged > 0.18 && match / judged < 0.34, pct(match / judged));
    const { out: o2, cells: c2 } = run({ open: true, mode: 'relational', n: 2 });
    const share = o2.filter(t => c2[t.cellIdx].outside).length / o2.length;
    ok('relational: the cube is still outside the old lattice about a third of the time', share > 0.25 && share < 0.45, pct(share));
  }
  {
    const { out, M } = run({ open: true, mode: 'relational', n: 1, meta: true });
    const c = { same: 0, opp: 0, diff: 0, obl: 0 };
    let n = 0;
    out.forEach(t => {
      const p = t.pair && t.pair[0];
      if (!p || !p.pair) return;
      const r = M.metaRelationOf(M.moveVectorOf(...p.pair), M.moveVectorOf(p, t));
      if (r) { c[r]++; n++; }
    });
    console.log('   second order: ' + Object.keys(c).map(k => `${k} ${pct(c[k] / n)}`).join(', '));
    /* `same` runs a little short: carrying on along a diagonal meets a wall within
       a few steps in a space five wide. */
    ok('second order: never at right angles; same, opposite and neither about a third each',
       c.diff === 0 && ['same', 'opp', 'obl'].every(k => c[k] / n > 0.26 && c[k] / n < 0.40),
       Object.keys(c).map(k => `${k} ${pct(c[k] / n)}`).join(', '));
  }
  {
    /* The lure: a place a lag short of the partner, answered differently. */
    const { out, cells } = run({ open: true, mode: 'relational', n: 3, length: 40000 });
    const sg = (a, b) => ['x', 'y', 'z'].map(k => Math.sign(cells[b][k] - cells[a][k])).join();
    let lures = 0, bad = 0;
    out.forEach((t, i) => {
      if (!t.isLure || i % 40 < 3) return;
      lures++;
      const nb = out[i - 3].cellIdx, la = out[i - 2].cellIdx;
      if (!apart(cells, nb, t.cellIdx) || !apart(cells, la, t.cellIdx) || sg(la, t.cellIdx) === sg(nb, t.cellIdx)) bad++;
    });
    ok('relational lures: apart from both items, and a lag short answers differently', lures > 300 && bad === 0,
       `${bad} of ${lures}`);
  }
  {
    const { out, cells } = run({ open: true, mode: 'relational', n: 1, everyAxis: false });
    const fewer = out.filter((t, i) => i % 40 && !apart(cells, out[i - 1].cellIdx, t.cellIdx)).length / out.length;
    ok('switched off, moves on fewer axes come back', fewer > 0.3, pct(fewer));
    const { out: m, cells: mc } = run({ open: true, mode: 'relational', n: 1, meta: true, everyAxis: false });
    const anyDiff = m.some(t => t.pair && t.pair[0].pair &&
      (() => { const a = t.pair[0].pair, b = t.pair; const v = (x, y) => ['x','y','z'].map(k => mc[y.cellIdx][k] - mc[x.cellIdx][k]);
               const A = v(a[0], a[1]), B = v(b[0], b[1]); return A[0]*B[0] + A[1]*B[1] + A[2]*B[2] === 0; })());
    ok('switched off, second order has its right angles back', anyDiff);
  }
}

console.log(bad ? `\n${bad} FAILED` : '\nall checks passed');
process.exit(bad ? 1 : 0);
