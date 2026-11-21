#!/usr/bin/env node
/*
 * Nested frames: the levels have to depend on each other, and depth has to be
 * what that dependency costs.
 *
 * Under frames, the item that opens a level mirrors an axis (its mark names
 * which), and every move inside the level is answered in the frame all the open
 * levels set together. So the first thing checked is the bookkeeping: the frame
 * is recomputed here from the marks alone — a second stack that shares no code
 * with the sampler — and has to be the one the sampler answered in.
 *
 * The second is the point of the feature. If the frame did not matter, a player
 * who ignored it would score as well as one who held it; if only the innermost
 * level mattered, holding one mirror would do at any depth; and if the frame were
 * a running total, three flip flags would do without the stack. Each of those
 * players is simulated, and each has to lose, by more the deeper the stream goes.
 *
 *   node tools/frame-check.js
 */

const path = require('path');
const createSampler = require(path.join(__dirname, '..', 'js/model.js'));

let bad = 0;
const ok = (name, cond, extra = '') => {
  console.log((cond ? '  ok   ' : '  FAIL ') + name + (cond ? '' : '  ' + extra));
  if (!cond) bad++;
};
const pct = x => (100 * x).toFixed(0) + '%';

const CELLS = [];
for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) for (let z = 0; z < 3; z++) CELLS.push({ x, y, z });

function stream({ depth, width = 1, frames = true, meta = false, length = 60000, lureRate = 0.2 }) {
  const cfg = { n: 1, nest: depth, nestWidth: width, nestFrames: frames, meta, frame: 'cube',
                lureRate, varN: 0, retro: 0, gate: 0, magnitudeCap: 2, coordAxes: [],
                streams: { position: 'relational' } };
  const state = { cells: CELLS, chain: [], metaDrawn: null, nest: null };
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
    state.chain.push(t);
    out.push(t);
  }
  return out;
}

/* The partner and the frame, from the marks alone. A level carries its item, its
   side branch and the frame it was opened in; an opener's mark names its axis. */
function replay(trials, visit) {
  let stack = [], anchor = null, side = null, flip = [0, 0, 0];
  trials.forEach(t => {
    if (t.nest === 'first') {
      stack = []; anchor = null; side = null; flip = [0, 0, 0];
      if (t.mirror != null) flip[t.mirror] ^= 1;
    }
    let partner = null;
    if (t.nest === 'in') {
      stack.push({ anchor, side, flip }); side = null;
      flip = flip.slice(); if (t.mirror != null) flip[t.mirror] ^= 1;
    } else if (t.nest === 'stay') partner = anchor;
    else if (t.nest === 'out') { const l = stack.pop(); partner = l.anchor; side = l.side; flip = l.flip; }
    else if (t.nest === 'switch') { partner = side; side = anchor; }
    visit(t, partner, flip.slice());
    anchor = t;
  });
}

/* The three axis answers of a move, in a frame: +1, -1 or 0 per axis. */
const answers = (a, b, f) => {
  const ca = CELLS[a.cellIdx], cb = CELLS[b.cellIdx];
  return [cb.x - ca.x, cb.y - ca.y, cb.z - ca.z].map((d, i) => Math.sign(d) * (f[i] ? -1 : 1));
};

/* ---- ways of holding the frame. Each knows the partner (the levels are not
   what is tested here, see nest-check.js) and says which frame it answers in. */

const full = () => ({ frame: (t, f) => f });

const ignores = () => ({ frame: () => [0, 0, 0] });

/* Keeps the mirrors of the `c` innermost open levels; older ones are lost and
   read as unflipped. Like nest-check's holds(c), but for frames. */
function holdsFrames(c) {
  let st = [];
  return {
    frame(t) {
      if (t.nest === 'first') st = [t.mirror];
      else if (t.nest === 'in') { st.push(t.mirror); if (st.filter(x => x != null).length > c) st[st.findIndex(x => x != null)] = null; }
      else if (t.nest === 'out') st.pop();
      const f = [0, 0, 0];
      st.forEach(m => { if (m != null) f[m] ^= 1; });
      return f;
    },
  };
}

/* Three flip flags and no stack: toggles on the way in, and on the way out cannot
   know which axis to put back, so leaves the flags as they are. */
function parity() {
  let f = [0, 0, 0];
  return {
    frame(t) {
      if (t.nest === 'first') { f = [0, 0, 0]; if (t.mirror != null) f[t.mirror] ^= 1; }
      else if (t.nest === 'in' && t.mirror != null) f[t.mirror] ^= 1;
      return f.slice();
    },
  };
}

/* Chance-corrected as the app scores it: each axis is a judgment, chance is the
   commonest correct answer's share. */
function score(trials, make, only) {
  const p = make();
  let right = 0, n = 0;
  const counts = { '-1': 0, 0: 0, 1: 0 };
  replay(trials, (t, partner, f) => {
    const said = p.frame(t, f);
    if (!partner || (only && !only(t))) return;
    const truth = answers(partner, t, f), guess = answers(partner, t, said);
    truth.forEach((v, i) => { n++; counts[v]++; if (v === guess[i]) right++; });
  });
  const chance = Math.max(...Object.values(counts)) / n;
  return Math.max(0, (right / n - chance) / (1 - chance));
}

/* ------------------------------------------------------------------ */

console.log('the bookkeeping\n');
for (const depth of [1, 2, 3]) for (const width of [1, 2]) {
  const s = stream({ depth, width });
  let wrongFrame = 0, wrongPartner = 0, openers = 0, named = 0, framed = 0, axisMoves = 0;
  replay(s, (t, partner, f) => {
    if (t.partner !== partner) wrongPartner++;
    if (JSON.stringify(t.flip) !== JSON.stringify(f)) wrongFrame++;
    if (t.nest === 'in' || t.nest === 'first') { openers++; if (t.mirror != null) named++; }
    if (partner) answers(partner, t, [0, 0, 0]).forEach((v, i) => { if (v) { axisMoves++; if (f[i]) framed++; } });
  });
  const tag = `depth ${depth}, width ${width}`;
  ok(`${tag}: every item is answered in the frame its marks set`, wrongFrame === 0 && wrongPartner === 0,
     `${wrongFrame} in another frame, ${wrongPartner} against another partner`);
  ok(`${tag}: every level's opener, the block's first item included, names the axis it mirrors`, named === openers, `${named} of ${openers}`);
  if (depth === 1 && width === 1)
    ok(`${tag}: the frame decides a good share of the answers`, framed / axisMoves > 0.25,
       `${pct(framed / axisMoves)} of axis answers fall on a mirrored axis`);
}
{
  /* The same axis mirrored twice reads straight: the composition is a real one. */
  const s = stream({ depth: 3, length: 20000 });
  let doubled = 0, straight = 0;
  replay(s, (t, partner, f) => {
    if (t.nest !== 'in' || t.mirror == null) return;
    /* f is the frame inside the new level; it is straight on the mirrored axis
       exactly when an enclosing level had mirrored the same axis. */
    if (!f[t.mirror]) straight++;
    doubled++;
  });
  ok('a level that mirrors an axis already mirrored straightens it', straight > 0 && straight < doubled,
     `${straight} of ${doubled} openers`);
}
{
  const off = stream({ depth: 2, frames: false, length: 4000 });
  ok('frames off: no item carries a frame or a mirror', off.every(t => t.flip == null && t.mirror == null));
  const meta = stream({ depth: 2, meta: true, length: 4000 });
  ok('under meta-relations frames are not asked', meta.every(t => t.flip == null));
}

/* ---- the reader: the app's own judgments, on the sampler's own items ---- *
 * Everything above computes the answer here. This is the half that scores a
 * press, so the frame has to be read there too, from the item the sampler wrote. */
console.log('\nthe judgments the app scores\n');
{
  const fs = require('fs'), vm = require('vm');
  const ROOT = path.join(__dirname, '..');
  const geo = vm.createContext({ console, Math, Array, Object, JSON });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/constants.js'), 'utf8').replace(/^"use strict";/, ''), geo);
  geo.CELLS = CELLS;
  vm.runInContext(`
    var cfg = { coordAxes: [], magnitudeCap: 2, frame: 'cube', nest: 2, nestFrames: true, meta: false,
                streams: { position: 'relational' } };
    var state = { cells: CELLS };
    var normalise = function (v) {
      var m = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
      return m < 1e-6 ? [0,0,0] : [v[0]/m, v[1]/m, v[2]/m];
    };
    var projectScreen = function (d) { return d; };
  `, geo);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/judgments.js'), 'utf8').replace(/^"use strict";/, ''), geo);
  const IDS = [['east', 'west'], ['south', 'north'], ['above', 'below']];
  const s = stream({ depth: 2, width: 2, length: 20000 });
  let wrong = 0, wrongMark = 0, judged = 0, framed = 0;
  replay(s, (t, partner, f) => {
    if (!partner) return;
    judged++;
    const js = geo.buildJudgments(partner, t).filter(j => j.stream === 'position');
    const want = answers(partner, t, f);
    js.slice(0, 3).forEach((j, i) => {
      const id = want[i] > 0 ? IDS[i][0] : want[i] < 0 ? IDS[i][1] : null;
      if (JSON.stringify(j.correct) !== JSON.stringify(id ? [id] : [])) wrong++;
      const shouldMark = !!f[i] && want[i] !== 0;
      if (j.framed !== shouldMark) wrongMark++;
      if (j.framed) framed++;
    });
  });
  ok('every axis answer the app scores is the one the frame gives', wrong === 0, `${wrong} of ${judged * 3} differ`);
  ok('and the report counts as mirrored exactly the answers the mirror changed', wrongMark === 0 && framed > 0,
     `${wrongMark} marked wrongly`);
  const keyOn = vm.runInContext(`chanceKey('position')`, geo);
  const keyOff = vm.runInContext(`cfg.nestFrames = false; chanceKey('position')`, geo);
  ok('frames keep their own chance history', keyOn !== keyOff && keyOn.endsWith('f'), `${keyOn} / ${keyOff}`);
}

console.log('\nthe frame is the load  (score: 0% = constant answer, 100% = perfect)\n');
const T = {};
for (const depth of [1, 2, 3]) {
  const s = stream({ depth, length: 120000 });
  T[depth] = {
    full: score(s, full), ignores: score(s, ignores), parity: score(s, parity),
    h: [1, 2, 3, 4].map(c => score(s, () => holdsFrames(c))),
    parityOut: score(s, parity, t => t.nest === 'out'),
  };
  const r = T[depth];
  console.log(`   depth ${depth}: holds every frame ${pct(r.full)} | ignores frames ${pct(r.ignores)} | ` +
    `flags, no stack ${pct(r.parity)} (returns ${pct(r.parityOut)}) | holds 1..4 mirrors: ${r.h.map(pct).join(' ')}`);
}
console.log('');
ok('holding every level\'s mirror is perfect', [1, 2, 3].every(d => T[d].full > 0.999));
ok('ignoring the frame costs well below target, at every depth',
   [1, 2, 3].every(d => T[d].ignores < 0.65), [1, 2, 3].map(d => pct(T[d].ignores)).join(' '));
/* The block's first item mirrors the outermost level, so depth d has d + 1
   mirrors open at the deepest point, and all of them are needed. */
ok('every mirror in the chain is needed: one short costs, at every depth',
   [1, 2, 3].every(d => T[d].h[d - 1] < 0.8 && T[d].h[d] > 0.999),
   [1, 2, 3].map(d => `depth ${d} holding ${d}: ${pct(T[d].h[d - 1])}`).join(', '));
ok('holding only the innermost mirror is worth little, and no more the deeper it goes',
   [1, 2, 3].every(d => T[d].h[0] < 0.65) && T[3].h[0] <= T[2].h[0] + 0.02 && T[2].h[0] <= T[1].h[0] + 0.02,
   [1, 2, 3].map(d => pct(T[d].h[0])).join(' → '));
ok('flip flags without the stack lose on returns', [1, 2, 3].every(d => T[d].parityOut < 0.8),
   [1, 2, 3].map(d => pct(T[d].parityOut)).join(' '));

/* ------------------------------------------------------------------ *
 * Turn frames: quarter-turns, where the order of the levels counts     *
 * ------------------------------------------------------------------ */
console.log('\nturn frames\n');
{
  const fs = require('fs'), vm = require('vm');
  const ROOT = path.join(__dirname, '..');
  /* The names the marks show, read from the app; each is turned into a matrix
     here, by its own rule, so a name that does not do what it says is caught. */
  const geo = vm.createContext({ console, Math, Array, Object, JSON });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/constants.js'), 'utf8').replace(/^"use strict";/, ''), geo);
  const NAMES = vm.runInContext('TURN_NAME', geo);
  const DIRS = { E: [1, 0, 0], W: [-1, 0, 0], S: [0, 1, 0], N: [0, -1, 0], A: [0, 0, 1], B: [0, 0, -1] };
  const dot = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
  /* "u→v": u goes to v, v goes to −u, the third axis stays. As columns. */
  const fromName = name => {
    const [a, b] = name.split('\u2192'), u = DIRS[a], v = DIRS[b];
    const img = e => dot(e, u) ? v.map(x => x * dot(e, u)) : dot(e, v) ? u.map(x => -x * dot(e, v)) : e;
    const cols = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map(img);
    return [0, 1, 2].flatMap(i => [0, 1, 2].map(j => cols[j][i]));
  };
  const R = NAMES.map(fromName);
  const I = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const mul = (A, B) => [0, 1, 2].flatMap(i => [0, 1, 2].map(j => A[3 * i] * B[j] + A[3 * i + 1] * B[3 + j] + A[3 * i + 2] * B[6 + j]));
  const eq = (A, B) => A.every((x, i) => x === B[i]);
  const ansM = (a, b, M) => {
    const ca = CELLS[a.cellIdx], cb = CELLS[b.cellIdx];
    const d = [cb.x - ca.x, cb.y - ca.y, cb.z - ca.z].map(Math.sign);
    return [0, 1, 2].map(i => Math.sign(M[3 * i] * d[0] + M[3 * i + 1] * d[1] + M[3 * i + 2] * d[2]));
  };

  ok('the turns are six different quarter-turns, each four steps from straight',
     R.every(M => !eq(M, I) && !eq(mul(M, M), I) && eq(mul(mul(M, M), mul(M, M)), I)) &&
     R.every((M, i) => R.every((N, j) => i === j || !eq(M, N))));
  const nE = NAMES.indexOf('N\u2192E'), eA = NAMES.indexOf('E\u2192A');
  ok('order matters: N→E then E→A is not E→A then N→E (as the settings say)',
     !eq(mul(R[eA], R[nE]), mul(R[nE], R[eA])));

  /* Replay from the marks: each level holds the frame it was opened in. */
  function replayT(trials, visit) {
    let stack = [], anchor = null, side = null, M = I, turns = [];
    trials.forEach(t => {
      if (t.nest === 'first') { stack = []; anchor = null; side = null; M = t.turn != null ? R[t.turn] : I; turns = [t.turn]; }
      let partner = null;
      if (t.nest === 'in') {
        stack.push({ anchor, side, M, turns }); side = null;
        M = t.turn != null ? mul(R[t.turn], M) : M; turns = turns.concat([t.turn]);
      } else if (t.nest === 'stay') partner = anchor;
      else if (t.nest === 'out') { const l = stack.pop(); partner = l.anchor; side = l.side; M = l.M; turns = l.turns; }
      else if (t.nest === 'switch') { partner = side; side = anchor; }
      visit(t, partner, M, turns);
      anchor = t;
    });
  }
  /* Ways of holding the turns. Each is handed the open turns, oldest first. */
  const compose = (turns, newestFirst) => turns.filter(x => x != null)
    .reduce((M, k) => newestFirst ? mul(M, R[k]) : mul(R[k], M), I);
  const PLAYERS = {
    full: turns => compose(turns, false),
    ignores: () => I,
    wrongOrder: turns => compose(turns, true),
    innermost: turns => { const k = turns.filter(x => x != null).pop(); return k != null ? R[k] : I; },
  };
  function scoreT(trials, pick, only) {
    let right = 0, n = 0, held = I;
    const counts = { '-1': 0, 0: 0, 1: 0 };
    replayT(trials, (t, partner, M, turns) => {
      /* No stack: the frame so far, turned further on the way in and kept as it
         is on the way out, since it cannot know which turn to take off. */
      if (pick === 'noStack') {
        if (t.nest === 'first') held = t.turn != null ? R[t.turn] : I;
        else if (t.nest === 'in' && t.turn != null) held = mul(R[t.turn], held);
      }
      if (!partner || (only && !only(t))) return;
      const said = pick === 'noStack' ? held : PLAYERS[pick](turns);
      const truth = ansM(partner, t, M), guess = ansM(partner, t, said);
      truth.forEach((v, i) => { n++; counts[v]++; if (v === guess[i]) right++; });
    });
    const chance = Math.max(...Object.values(counts)) / n;
    return Math.max(0, (right / n - chance) / (1 - chance));
  }

  for (const depth of [1, 2, 3]) for (const width of [1, 2]) {
    const s = stream({ depth, width, frames: 'turn' });
    let wrong = 0, openers = 0, named = 0, mirrored = 0, changed = 0, axisMoves = 0, orderMatters = 0, judged = 0;
    replayT(s, (t, partner, M, turns) => {
      if (!t.frameMap || !eq(t.frameMap, M)) wrong++;
      if (t.flip || t.mirror != null) mirrored++;
      if (t.nest === 'in' || t.nest === 'first') { openers++; if (t.turn != null) named++; }
      if (!partner) return;
      judged++;
      const plain = ansM(partner, t, I), framed = ansM(partner, t, M);
      plain.forEach((v, i) => { if (v) { axisMoves++; if (framed[i] !== v) changed++; } });
      if (!eq(compose(turns, true), M)) orderMatters++;
    });
    const tag = `turns, depth ${depth}, width ${width}`;
    ok(`${tag}: every item is answered in the turn its marks set`, wrong === 0 && mirrored === 0,
       `${wrong} in another frame, ${mirrored} carrying a mirror`);
    ok(`${tag}: every opener names its turn`, named === openers, `${named} of ${openers}`);
    if (width === 1) {
      ok(`${tag}: the turn changes a large share of answers`, changed / axisMoves > 0.4, pct(changed / axisMoves));
      /* At depth one, only the few stays inside the one level have two turns open
         at once (a level at the ceiling mostly closes on the next item), so order
         is something depth two and up asks for. */
      if (depth >= 2)
        ok(`${tag}: the order of the turns decides a good share of items`, orderMatters / judged > 0.2,
           pct(orderMatters / judged));
    }
  }

  const TT = {};
  for (const depth of [1, 2, 3]) {
    const s = stream({ depth, frames: 'turn', length: 120000 });
    TT[depth] = {
      full: scoreT(s, 'full'), ignores: scoreT(s, 'ignores'), wrongOrder: scoreT(s, 'wrongOrder'),
      innermost: scoreT(s, 'innermost'), noStackOut: scoreT(s, 'noStack', t => t.nest === 'out'),
    };
    const r = TT[depth];
    console.log(`   depth ${depth}: holds every turn in order ${pct(r.full)} | ignores turns ${pct(r.ignores)} | ` +
      `right turns, wrong order ${pct(r.wrongOrder)} | innermost only ${pct(r.innermost)} | no stack, returns ${pct(r.noStackOut)}`);
  }
  ok('holding every turn in order is perfect', [1, 2, 3].every(d => TT[d].full > 0.999));
  ok('ignoring the turns scores well below target', [1, 2, 3].every(d => TT[d].ignores < 0.65),
     [1, 2, 3].map(d => pct(TT[d].ignores)).join(' '));
  ok('from depth two, the right turns in the wrong order fall short', [2, 3].every(d => TT[d].wrongOrder < 0.75),
     [2, 3].map(d => pct(TT[d].wrongOrder)).join(' '));
  ok('from depth two, holding only the innermost turn is worth little', [2, 3].every(d => TT[d].innermost < 0.65),
     [2, 3].map(d => pct(TT[d].innermost)).join(' '));
  ok('the frame so far, without the stack, loses on returns', [1, 2, 3].every(d => TT[d].noStackOut < 0.8),
     [1, 2, 3].map(d => pct(TT[d].noStackOut)).join(' '));

  /* The reader: the app's own judgments under turns. */
  geo.CELLS = CELLS;
  vm.runInContext(`
    var cfg = { coordAxes: [], magnitudeCap: 2, frame: 'cube', nest: 2, nestFrames: 'turn', meta: false,
                streams: { position: 'relational' } };
    var state = { cells: CELLS };
    var normalise = function (v) {
      var m = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
      return m < 1e-6 ? [0,0,0] : [v[0]/m, v[1]/m, v[2]/m];
    };
    var projectScreen = function (d) { return d; };
  `, geo);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/judgments.js'), 'utf8').replace(/^"use strict";/, ''), geo);
  const IDS = [['east', 'west'], ['south', 'north'], ['above', 'below']];
  let wrongJ = 0, wrongMark = 0, marked = 0, total = 0;
  replayT(stream({ depth: 2, width: 2, frames: 'turn', length: 20000 }), (t, partner, M) => {
    if (!partner) return;
    const js = geo.buildJudgments(partner, t).filter(j => j.stream === 'position');
    const want = ansM(partner, t, M), plain = ansM(partner, t, I);
    js.slice(0, 3).forEach((j, i) => {
      total++;
      const id = want[i] > 0 ? IDS[i][0] : want[i] < 0 ? IDS[i][1] : null;
      if (JSON.stringify(j.correct) !== JSON.stringify(id ? [id] : [])) wrongJ++;
      if (j.framed !== (want[i] !== plain[i])) wrongMark++;
      if (j.framed) marked++;
    });
  });
  ok('every axis answer the app scores is the one the turns give', wrongJ === 0, `${wrongJ} of ${total} differ`);
  ok('and the report counts as turned exactly the answers the turn changed', wrongMark === 0 && marked > 0,
     `${wrongMark} marked wrongly`);
  const keyT = vm.runInContext(`chanceKey('position')`, geo);
  const keyM = vm.runInContext(`cfg.nestFrames = true; chanceKey('position')`, geo);
  ok('turns keep a chance history of their own', keyT.endsWith('ft') && keyM.endsWith('f') && keyT !== keyM, `${keyT} / ${keyM}`);
  const meta = stream({ depth: 2, frames: 'turn', meta: true, length: 4000 });
  ok('under meta-relations turns are not asked', meta.every(t => t.frameMap == null && t.turn == null));
}

console.log(bad ? `\n${bad} FAILED` : '\nall checks passed');
process.exit(bad ? 1 : 0);
