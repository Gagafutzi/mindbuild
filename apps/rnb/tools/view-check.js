#!/usr/bin/env node
/*
 * The view stream: each trial the space is seen from one of nine viewpoints
 * (constants.js, STREAMS.view), after 3D Hyper N-back's camera.
 *
 * Three things could be wrong without anything looking wrong. The labels: "the
 * viewpoint moved right" has to be what the angles do on screen, not what the
 * index says. The sampler: identity needs matches at the target rate, and second
 * order needs its four relations at even shares, which a 3 × 3 grid drawn freely
 * does not give. And the reader: the app's judgments have to relate the same two
 * changes of view the sampler planted against, in plain N-back and in nesting,
 * where the changes are the ones seen.
 *
 *   node tools/view-check.js
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

const CELLS = [];
for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) for (let z = 0; z < 3; z++) CELLS.push({ x, y, z });

/* The app's constants and judgments, as the page loads them. */
const geo = vm.createContext({ console, Math, Array, Object, JSON });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/constants.js'), 'utf8').replace(/^"use strict";/, ''), geo);
const C = k => vm.runInContext(k, geo);

function stream({ mode, n = 2, nest = 0, length = 40000, position = 'relational' }) {
  const cfg = { n, nest, meta: false, frame: 'cube', lureRate: 0.25, varN: 0, retro: 0, gate: 0,
                magnitudeCap: 2, coordAxes: [], streams: { position, view: mode } };
  const state = { cells: CELLS, chain: [], metaDrawn: null, nest: null };
  const POOL = [0, 0, 0];
  const M = createSampler({
    cfg, state,
    STREAM_KEYS: ['position', 'view'],
    TARGET_RATE: 0.28, META_SHARE: { same: .25, opp: .25, diff: .25, obl: .25 }, META_FLOOR: 0.05,
    PANS: POOL, LETTER_KEYS: [0, 0, 0, 0], GLYPH_SET_KEYS: [],
    dimCount: () => 3, magnitudeCap: () => 2, coordAxes: () => [],
    poolFor: () => POOL, voiceSet: () => ({ voices: POOL }),
  });
  const out = [];
  for (let i = 0; i < length; i++) {
    if (i % 40 === 0) { state.chain = []; state.nest = null; }
    const t = M.sampleTrial();
    /* block.js: the pair is the partner and the item. */
    const partner = nest ? t.partner : state.chain[state.chain.length - n];
    t.pair = partner ? [partner, t] : null;
    state.chain.push(t);
    out.push(t);
  }
  return { out, M };
}

/* ---- the labels ---- */
console.log('what the views are\n');
{
  const YAW = C('VIEW_YAW'), PITCH = C('VIEW_PITCH');
  /* rotateY(θ) carries the space's +x (east) to z = −sin θ: toward you as θ falls. */
  const eastTowardYou = YAW.map(a => -Math.sin(a * Math.PI / 180));
  ok('a view further right turns more of the right side toward you',
     eastTowardYou[0] < eastTowardYou[1] && eastTowardYou[1] < eastTowardYou[2], eastTowardYou.map(v => v.toFixed(2)).join(' '));
  /* rotateX(φ) with φ < 0 tips the top toward you: more negative is from higher up. */
  ok('a view further up looks down on more of the top', PITCH[0] > PITCH[1] && PITCH[1] > PITCH[2], PITCH.join(' '));
  ok('the usual view is the middle one', YAW[1] === -28 && PITCH[1] === -24);
  const v = C('viewVec(0, 8)');
  ok('from the lowest left view to the highest right one is right and up', v[0] === 2 && v[1] === 2, JSON.stringify(v));
}

/* ---- the sampler ---- */
console.log('\nthe sampler\n');
{
  /* Position off, so every lure the sampler plants is the view's. */
  const { out } = stream({ mode: 'identity', n: 2, position: 'off' });
  let match = 0, judged = 0, lures = 0, lureMatch = 0;
  out.forEach((t, i) => {
    if (i % 40 < 2) return;
    judged++;
    const m = out[i - 2].view === t.view;
    if (m) match++;
    if (t.isLure) { lures++; if (m) lureMatch++; }
  });
  ok('identity: matches at about the target rate', match / judged > 0.2 && match / judged < 0.36, pct(match / judged));
  ok('identity: lures come up, and a lure is never a match', lures > 100 && lureMatch === 0, `${lures} lures, ${lureMatch} matches`);
}
{
  const { out } = stream({ mode: 'relational', n: 2 });
  const counts = new Array(9).fill(0);
  out.forEach(t => counts[t.view]++);
  const even = out.length / 9;
  ok('relational: every view comes up about as often', counts.every(c => c > even * 0.85 && c < even * 1.15),
     counts.map(c => (c / even).toFixed(2)).join(' '));
}
for (const [label, opts] of [['plain N-back, N 2', { n: 2 }], ['nested, depth 2', { nest: 2 }]]) {
  const { out, M } = stream({ mode: 'meta', ...opts });
  geo.metaRelationOf = M.metaRelationOf;
  /* The two changes of view, rebuilt here: the one into the partner, and the one
     being judged (from the partner, or in nesting from the item shown before). */
  const shares = { same: 0, opp: 0, diff: 0, obl: 0 };
  let asked = 0, prevTrialRight = 0, prevTrialN = 0;
  out.forEach((t, i) => {
    const p = t.pair && t.pair[0];
    if (!p) return;
    const ref = opts.nest ? (p.visMove ? [p.visMove[0].view, p.visMove[1].view] : null)
                          : (p.pair ? [p.pair[0].view, p.pair[1].view] : null);
    const cur = opts.nest ? (t.visMove ? [t.visMove[0].view, t.view] : null) : [p.view, t.view];
    if (!ref || !cur) return;
    const r = M.metaRelationOf(C(`viewVec(${ref[0]}, ${ref[1]})`), C(`viewVec(${cur[0]}, ${cur[1]})`));
    if (!r) return;
    asked++; shares[r]++;
    /* Plain second order's habit: relate to the change just before. */
    if (i % 40 >= 2) {
      const r2 = M.metaRelationOf(C(`viewVec(${out[i - 2].view}, ${out[i - 1].view})`), C(`viewVec(${cur[0]}, ${cur[1]})`));
      prevTrialN++; if (r2 === r) prevTrialRight++;
    }
  });
  ok(`second order, ${label}: the four relations come up about evenly`,
     Object.values(shares).every(v => v / asked > 0.15), Object.entries(shares).map(([k, v]) => `${k} ${pct(v / asked)}`).join(', '));
  if (opts.n === 2)
    ok(`second order, ${label}: relating to the change just before is wrong most of the time`,
       prevTrialRight / prevTrialN < 0.5, pct(prevTrialRight / prevTrialN));
}

/* ---- the reader: the app's own judgments ---- */
console.log('\nthe judgments the app scores\n');
{
  geo.CELLS = CELLS;
  vm.runInContext(`
    var cfg = { coordAxes: [], magnitudeCap: 2, frame: 'cube', nest: 0, meta: false,
                streams: { position: 'relational', view: 'relational' } };
    var state = { cells: CELLS };
    var normalise = function (v) {
      var m = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
      return m < 1e-6 ? [0,0,0] : [v[0]/m, v[1]/m, v[2]/m];
    };
    var projectScreen = function (d) { return d; };
  `, geo);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/judgments.js'), 'utf8').replace(/^"use strict";/, ''), geo);
  const viewJ = (a, b, extra) => geo.buildJudgments(a, b, extra).filter(j => j.stream === 'view');

  /* Identity and relational, over every pair of views. */
  let wrongId = 0, wrongRel = 0;
  for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) {
    const A = { cellIdx: 0, view: i }, B = { cellIdx: 1, view: j };
    vm.runInContext(`cfg.streams.view = 'identity'`, geo);
    const id = viewJ(A, B)[0];
    if (JSON.stringify(id.correct) !== JSON.stringify(i === j ? ['view'] : [])) wrongId++;
    vm.runInContext(`cfg.streams.view = 'relational'`, geo);
    const [h, v] = viewJ(A, B);
    const dx = j % 3 - i % 3, dy = Math.floor(j / 3) - Math.floor(i / 3);
    const wantH = dx > 0 ? ['view-right'] : dx < 0 ? ['view-left'] : [];
    const wantV = dy > 0 ? ['view-up'] : dy < 0 ? ['view-down'] : [];
    if (JSON.stringify(h.correct) !== JSON.stringify(wantH) || JSON.stringify(v.correct) !== JSON.stringify(wantV)) wrongRel++;
  }
  ok('identity: the same view, and only the same view, is a match', wrongId === 0, `${wrongId} of 81 pairs`);
  ok('relational: left/right and up/down are the way the viewpoint moved', wrongRel === 0, `${wrongRel} of 81 pairs`);

  /* Second order, through the pairing block.js builds. */
  vm.runInContext(`cfg.streams.view = 'meta'`, geo);
  for (const [label, opts] of [['plain', { n: 2 }], ['nested', { nest: 2 }]]) {
    const { out, M } = stream({ mode: 'meta', ...opts, length: 20000 });
    geo.metaRelationOf = M.metaRelationOf;
    let wrong = 0, total = 0;
    out.forEach(t => {
      if (!t.pair) return;
      const p = t.pair[0];
      const extra = { viewPrev: t.nest ? p.visMove : p.pair, viewCur: t.nest ? t.visMove : null };
      const js = viewJ(p, t, extra);
      const refP = extra.viewPrev, curP = extra.viewCur || [p, t];
      if (!refP) { if (js.length) wrong++; return; }
      const r = M.metaRelationOf(C(`viewVec(${refP[0].view}, ${refP[1].view})`), C(`viewVec(${curP[0].view}, ${curP[1].view})`));
      if (!r) { if (js.length) wrong++; return; }
      total++;
      const want = r === 'same' ? ['view-same'] : r === 'opp' ? ['view-opp'] : r === 'diff' ? ['view-orth'] : [];
      if (!js.length || JSON.stringify(js[0].correct) !== JSON.stringify(want)) wrong++;
    });
    ok(`second order, ${label}: the app relates the same two changes of view`, wrong === 0 && total > 1000,
       `${wrong} wrong of ${total}`);
  }
  const k1 = vm.runInContext(`chanceKey('view')`, geo);
  const k2 = vm.runInContext(`cfg.streams.view = 'relational'; chanceKey('view')`, geo);
  ok('each mode keeps its own chance history', k1 !== k2, `${k1} / ${k2}`);
}

console.log(bad ? `\n${bad} FAILED` : '\nall checks passed');
process.exit(bad ? 1 : 0);
