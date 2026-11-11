#!/usr/bin/env node
/*
 * Nested levels: the stream is a stack, and depth is the load.
 *
 * Two things here could be wrong without anything on screen looking wrong.
 *
 * The first is the bookkeeping. The partner of an item is "the last item of its
 * own level", and the sampler plants its matches and lures against whatever it
 * believes that is. A sampler that pops a level too late, or hands an item that
 * opens a level a partner, still produces a stream that plays — the answers are
 * simply about a different item from the one the marks point at. So the partner
 * is recomputed here from the marks alone, by a second stack that shares no
 * code with the sampler's, and the two have to name the same item every time.
 *
 * The second is the one this file exists for. The first version of the stream
 * turned round freely, so it hovered near the top of the stack, where only the
 * innermost suspended item is ever returned to. A simulated player who could
 * hold ONE suspended item scored 95% at any depth: depth was a number on the
 * HUD and not a load. Dives and climbs now come in runs. What is asserted is
 * the property that buys — each level past what a player can hold has to cost —
 * and the two shortcuts that need no stack at all have to score nothing.
 *
 * The sampler is required, not sandboxed: `js/model.js` is the app's own code
 * with its world handed to it.
 *
 *   node tools/nest-check.js
 */

const path = require('path');
const createSampler = require(path.join(__dirname, '..', 'js/model.js'));

let bad = 0;
const ok = (name, cond, extra = '') => {
  console.log((cond ? '  ok   ' : '  FAIL ') + name + (cond ? '' : '  ' + extra));
  if (!cond) bad++;
};
const pct = x => (100 * x).toFixed(0) + '%';

function cells(dim) {
  const out = [];
  for (let x = 0; x < dim; x++) for (let y = 0; y < dim; y++) for (let z = 0; z < dim; z++)
    out.push({ x, y, z });
  return out;
}

/* A stream of `length` trials at this depth, with position as the only stream. */
function stream({ depth, width = 1, mode = 'identity', length = 60000, lureRate = 0.2 }) {
  const cfg = { n: 1, nest: depth, nestWidth: width, meta: false, lureRate, varN: 0, retro: 0, gate: 0,
                magnitudeCap: 2, coordAxes: [], streams: { position: mode } };
  const state = { cells: cells(3), chain: [], metaDrawn: null, nest: null };
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
    /* Blocks, as the app plays them: the stack is the block's. */
    if (i % 40 === 0) { state.chain = []; state.nest = null; }
    const t = M.sampleTrial();
    state.chain.push(t);
    out.push(t);
  }
  return out;
}

/*
 * The stack, a second time, from the marks alone.
 *
 * `first` opens the outermost level. Nothing here looks at `t.partner` or at
 * the sampler's own stack; it returns what the partner HAS to be if the marks
 * mean what the settings page says they mean.
 */
function replay(trials, visit) {
  /* A level is its current branch's last item and, at width 2, its side's. */
  let stack = [], anchor = null, side = null;
  trials.forEach(t => {
    if (t.nest === 'first') { stack = []; anchor = null; side = null; }
    let partner = null, closed = null;
    if (t.nest === 'in') { stack.push({ anchor, side }); side = null; }
    else if (t.nest === 'stay') partner = anchor;
    else if (t.nest === 'out') { closed = anchor; const l = stack.pop(); partner = l.anchor; side = l.side; }
    else if (t.nest === 'switch') { closed = anchor; partner = side; side = anchor; }
    visit(t, partner, { closed, pending: stack.map(l => l.anchor), sides: [side, ...stack.map(l => l.side)].filter(x => x),
                        prev: anchor, side });
    anchor = t;
  });
}

/* ---- ways of playing, on an identity stream: say "match" or not ---- */

/* Plain 1-back: the item is the same as the one before it. No stack. */
const oneBack = () => ({ say: (t, ctx) => !!ctx.prev && t.cellIdx === ctx.prev.cellIdx });

/* Everything is remembered, nothing is filed: a match is anything still held or
   only just let go of. This is what holding the items without the levels gives. */
const noLevels = () => ({
  say: (t, ctx) => [ctx.prev, ctx.closed, ...ctx.pending].some(x => x && x.cellIdx === t.cellIdx),
});

/* Keeps the structure, but can hold only `c` suspended items; the outermost — the
   one suspended longest — is the one that goes. A lost item is answered "no". */
function holds(c) {
  let st = [], anchor = null;
  return {
    say(t) {
      let said = false;
      if (t.nest === 'first') { st = []; }
      else if (t.nest === 'in') {
        st.push(anchor);
        if (st.filter(x => x).length > c) st[st.findIndex(x => x)] = null;
      } else if (t.nest === 'out') { const p = st.pop(); said = !!p && p.cellIdx === t.cellIdx; }
      else said = !!anchor && anchor.cellIdx === t.cellIdx;
      anchor = t;
      return said;
    },
  };
}

/* Chance-corrected as the app scores it: 0 is never pressing, 1 is perfect. */
function score(trials, make) {
  const p = make();
  let right = 0, base = 0, n = 0;
  replay(trials, (t, partner, ctx) => {
    const said = p.say(t, ctx);
    if (!partner) return;
    const answer = partner.cellIdx === t.cellIdx;
    n++; if (said === answer) right++; if (!answer) base++;
  });
  return Math.max(0, (right / n - base / n) / (1 - base / n));
}

/* ------------------------------------------------------------------ */

console.log('the bookkeeping\n');
for (const depth of [1, 2, 3, 5]) {
  const s = stream({ depth });
  let wrongPartner = 0, inWithPartner = 0, tooDeep = 0, depthOff = 0, judged = 0;
  replay(s, (t, partner, ctx) => {
    if (t.partner !== partner) wrongPartner++;
    if (t.nest === 'in' && t.partner) inWithPartner++;
    if (ctx.pending.length > depth) tooDeep++;
    if (t.depth !== ctx.pending.length) depthOff++;
    if (partner) judged++;
  });
  ok(`depth ${depth}: the partner is the last item of the item's own level`,
     wrongPartner === 0, `${wrongPartner} items judged against something else`);
  ok(`depth ${depth}: an item that opens a level is asked nothing`, inWithPartner === 0,
     `${inWithPartner} had a partner`);
  ok(`depth ${depth}: never more than ${depth} suspended`, tooDeep === 0 && depthOff === 0,
     `${tooDeep} over the cap, ${depthOff} with the wrong depth recorded`);
  ok(`depth ${depth}: most items are judged`, judged / s.length > 0.45,
     `only ${pct(judged / s.length)} are`);
}

console.log('\nmatches and lures\n');
for (const depth of [1, 3]) {
  const s = stream({ depth, lureRate: 0.3 });
  let judged = 0, match = 0, lures = 0, lureMatch = 0, recency = 0, returns = 0, pending = 0;
  replay(s, (t, partner, ctx) => {
    if (!partner) return;
    judged++;
    const m = partner.cellIdx === t.cellIdx;
    if (m) match++;
    if (t.isLure) { lures++; if (m) lureMatch++; }
    if (t.nest === 'out') {
      returns++;
      if (!m && ctx.closed && ctx.closed.cellIdx === t.cellIdx) recency++;
    } else if (!m && ctx.pending.some(x => x && x.cellIdx === t.cellIdx)) pending++;
  });
  ok(`depth ${depth}: matches come at about the target rate`,
     match / judged > 0.18 && match / judged < 0.34, pct(match / judged));
  ok(`depth ${depth}: a lure is never a match`, lureMatch === 0, `${lureMatch} were`);
  ok(`depth ${depth}: returns are lured with the item just left behind`,
     recency / returns > 0.08, `only ${pct(recency / returns)} of returns`);
  ok(`depth ${depth}: stays are lured with an item still suspended`,
     pending / (judged - returns) > 0.03, `only ${pct(pending / (judged - returns))} of stays`);
}

console.log('\nthe cube moves when the level changes\n');
{
  const s = stream({ depth: 3, mode: 'relational' });
  let still = 0, n = 0;
  replay(s, (t, partner, ctx) => {
    if (t.nest !== 'in' && t.nest !== 'out') return;
    n++; if (ctx.prev && ctx.prev.cellIdx === t.cellIdx) still++;
  });
  ok('relational position: never the same cell on the way in or out', still === 0,
     `${still} of ${n} stood still`);
  const id = stream({ depth: 3, mode: 'identity' });
  let stillIn = 0;
  replay(id, (t, partner, ctx) => {
    if (t.nest === 'in' && ctx.prev && ctx.prev.cellIdx === t.cellIdx) stillIn++;
  });
  ok('identity position: a level never opens on the cell just shown', stillIn === 0,
     `${stillIn} did`);
}

console.log('\ndepth is the load  (score: 0% = never pressing, 100% = perfect)\n');
const table = {};
for (const depth of [1, 2, 3, 4, 5]) {
  const s = stream({ depth, length: 120000 });
  let returns = 0, second = 0, judged = 0, run = 0;
  replay(s, (t, partner) => {
    if (partner) judged++;
    if (t.nest === 'out') { returns++; run++; if (run >= 2) second++; } else run = 0;
  });
  const row = table[depth] = {
    oneBack: score(s, oneBack), noLevels: score(s, noLevels),
    h: [1, 2, 3, 4, 5].map(c => score(s, () => holds(c))),
    deep: second / returns, returns: returns / judged,
  };
  console.log(`   depth ${depth}: returns ${pct(row.returns)} of judged, ${pct(row.deep)} of them a second climb or more` +
    ` | plain 1-back ${pct(row.oneBack)} | no levels ${pct(row.noLevels)} | holds 1..5: ` +
    row.h.map(pct).join(' '));
}
console.log('');
ok('plain 1-back scores nothing at any depth',
   Object.values(table).every(r => r.oneBack < 0.08),
   Object.values(table).map(r => pct(r.oneBack)).join(' '));
ok('holding the items without the levels scores nothing',
   Object.values(table).every(r => r.noLevels < 0.08),
   Object.values(table).map(r => pct(r.noLevels)).join(' '));
ok('a player who can hold the whole depth is perfect',
   [1, 2, 3, 4, 5].every(d => table[d].h[d - 1] > 0.999),
   [1, 2, 3, 4, 5].map(d => pct(table[d].h[d - 1])).join(' '));
ok('one level too few costs, at every depth',
   [2, 3, 4, 5].every(d => table[d].h[d - 2] < 0.93),
   [2, 3, 4, 5].map(d => `depth ${d}: ${pct(table[d].h[d - 2])}`).join(', '));
/* The regression test proper. The stream this replaced gave a one-item player
   95% at depth four; anything above 80% at depth two means the stack is once
   again only ever read from the top. */
ok('one suspended item is not enough at depth two', table[2].h[0] < 0.80, pct(table[2].h[0]));
ok('and worth less the deeper the stream goes',
   table[3].h[0] < table[2].h[0] - 0.04 && table[4].h[0] < table[3].h[0],
   [2, 3, 4].map(d => pct(table[d].h[0])).join(' → '));
ok('the stream unwinds several levels in a row', table[3].deep > 0.35, pct(table[3].deep));
/* What the nested track's default target has to stay above (state.js). */
ok('a target of 85% is out of reach one level short, up to depth three',
   table[2].h[0] < 0.85 && table[3].h[1] < 0.85,
   `depth 2 holding 1: ${pct(table[2].h[0])}, depth 3 holding 2: ${pct(table[3].h[1])}`);

/* ------------------------------------------------------------------ *
 * Width: a side branch per level                                      *
 * ------------------------------------------------------------------ */
console.log('\na side branch per level\n');
for (const depth of [1, 3]) {
  const s = stream({ depth, width: 2 });
  let wrongPartner = 0, switches = 0, openSwitch = 0, openWithPartner = 0, judged = 0, tooDeep = 0;
  replay(s, (t, partner, ctx) => {
    if (t.partner !== partner) wrongPartner++;
    if (partner) judged++;
    if (ctx.pending.length > depth) tooDeep++;
    if (t.nest === 'switch') { switches++; if (!partner) { openSwitch++; if (t.partner) openWithPartner++; } }
  });
  ok(`width 2, depth ${depth}: every partner is the last item of the item's own branch`,
     wrongPartner === 0, `${wrongPartner} judged against something else`);
  ok(`width 2, depth ${depth}: a switch onto an empty branch asks nothing`, openWithPartner === 0);
  ok(`width 2, depth ${depth}: switches come up, and most return to a waiting branch`,
     switches / s.length > 0.12 && openSwitch / switches < 0.6,
     `${pct(switches / s.length)} switches, ${pct(openSwitch / switches)} of them onto an empty branch`);
  ok(`width 2, depth ${depth}: never more than ${depth} levels suspended`, tooDeep === 0);
}
{
  /* A switch is sideways, not a step: a run of dives (or climbs) carries on
     through it. Were the switch to reset the run, a branch would cut every dive
     short and depth would come up less often at width 2 than at width 1. */
  const s = stream({ depth: 3, width: 2 });
  const rate = (across) => {
    let runs = 0, kept = 0;
    for (let i = 2; i < s.length; i++) {
      if (i % 40 < 2) continue;
      const before = across ? s[i - 2].nest : s[i - 1].nest;
      if (across && s[i - 1].nest !== 'switch') continue;
      if (!across && s[i - 1].nest === 'switch') continue;
      if (before !== 'in' || s[i].nest === 'switch') continue;
      runs++; if (s[i].nest === 'in') kept++;
    }
    return kept / runs;
  };
  const direct = rate(false), through = rate(true);
  ok('width 2: a run of dives carries on through a switch', Math.abs(direct - through) < 0.08,
     `${pct(direct)} dive again straight after a dive, ${pct(through)} after a dive and a switch`);
}
{
  /* A switch is lured with the branch just left: answering it as a stay. */
  const s = stream({ depth: 2, width: 2, lureRate: 0.3 });
  let lured = 0, returns = 0, lureMatch = 0;
  replay(s, (t, partner, ctx) => {
    if (t.nest !== 'switch' || !partner) return;
    returns++;
    const m = partner.cellIdx === t.cellIdx;
    if (!m && ctx.closed && ctx.closed.cellIdx === t.cellIdx) lured++;
    if (t.isLure && m) lureMatch++;
  });
  ok('a switch is lured with the branch just left', lured / returns > 0.08, pct(lured / returns));
  ok('and a lure is never a match', lureMatch === 0, `${lureMatch} were`);
}
{
  /* The side branch is load. A player who keeps the levels but never the side
     branch (says "no" to every switch) loses; one who holds it all is perfect;
     the two shortcuts still score nothing. */
  const fullW = () => {
    let st = [], anchor = null, side = null;
    return { say(t) {
      let said = false;
      if (t.nest === 'first') { st = []; side = null; }
      else if (t.nest === 'in') { st.push({ anchor, side }); side = null; }
      else if (t.nest === 'out') { const l = st.pop(); said = !!l.anchor && l.anchor.cellIdx === t.cellIdx; side = l.side; }
      else if (t.nest === 'switch') { said = !!side && side.cellIdx === t.cellIdx; side = anchor; }
      else said = !!anchor && anchor.cellIdx === t.cellIdx;
      anchor = t; return said;
    } };
  };
  const noSide = () => {
    let st = [], anchor = null;
    return { say(t) {
      let said = false;
      if (t.nest === 'first') st = [];
      else if (t.nest === 'in') st.push(anchor);
      else if (t.nest === 'out') { const p = st.pop(); said = !!p && p.cellIdx === t.cellIdx; }
      else if (t.nest === 'stay') said = !!anchor && anchor.cellIdx === t.cellIdx;
      anchor = t; return said;
    } };
  };
  for (const depth of [1, 2]) {
    const s = stream({ depth, width: 2, length: 120000 });
    const full = score(s, fullW), side = score(s, noSide), one = score(s, oneBack), none = score(s, noLevels);
    console.log(`   width 2, depth ${depth}: holds it all ${pct(full)} | no side branch ${pct(side)} | plain 1-back ${pct(one)} | no levels ${pct(none)}`);
    ok(`width 2, depth ${depth}: holding every branch is perfect`, full > 0.999, pct(full));
    ok(`width 2, depth ${depth}: dropping the side branch costs`, side < 0.80, pct(side));
    ok(`width 2, depth ${depth}: the shortcuts still score nothing`, one < 0.08 && none < 0.08, `${pct(one)} / ${pct(none)}`);
  }
  /* Width must not undo depth: at width 2 a player holding one suspended level
     still loses at depth two. */
  const s2 = stream({ depth: 2, width: 2, length: 120000 });
  ok('width 2 still makes depth cost', score(s2, () => holds(1)) < 0.75, pct(score(s2, () => holds(1))));
}

console.log(bad ? `\n${bad} FAILED` : '\nall checks passed');
process.exit(bad ? 1 : 0);
