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

function run({ open, mode = 'relational', n = 2, meta = false, nest = 0, length = 30000 }) {
  const cfg = { n, nest, meta, frame: 'cube', lureRate: 0.2, varN: 0, retro: 0, gate: 0,
                magnitudeCap: 2, coordAxes: [], streams: { position: mode } };
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
    if (i % 40 === 0) { state.chain = []; state.nest = null; }
    const t = M.sampleTrial();
    t.pair = state.chain.length >= n ? [state.chain[state.chain.length - n], t] : null;
    state.chain.push(t);
    out.push(t);
  }
  return { out, cells: state.cells };
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

console.log(bad ? `\n${bad} FAILED` : '\nall checks passed');
process.exit(bad ? 1 : 0);
