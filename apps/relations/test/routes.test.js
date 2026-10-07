/* node apps/relations/test/routes.test.js — routes on a cube: the walker
   against geometry, symmetry and the pose group, and every trial read back
   from the code it shows, by a reader that knows nothing of how it was made. */
"use strict";
const A = require("../algebra.js");
const R = require("../routes.js");
const assert = require("assert");
let checks = 0;
const ok = (c, m) => { checks++; assert.ok(c, m); };
const BAD = /undefined|null|NaN|\[object/;
const MOVES = "^v<>qQh";

function randomWalk(rng, len) { let w = ""; for (let i = 0; i < len; i++) w += MOVES[Math.floor(rng.next() * MOVES.length)]; return w; }
function randomPose(rng, N) {
  /* Anywhere on the cube: a square on any face, any facing along that face. */
  const M = 2 * N, axis = Math.floor(rng.next() * 3), side = rng.next() < 0.5 ? 0 : M;
  const P = [0, 0, 0].map(() => 1 + 2 * Math.floor(rng.next() * N)); P[axis] = side;
  const n = [0, 0, 0]; n[axis] = side ? 1 : -1;
  const others = [0, 1, 2].filter((a) => a !== axis), f = [0, 0, 0];
  f[others[Math.floor(rng.next() * 2)]] = rng.next() < 0.5 ? 1 : -1;
  return R.pose(N, P, f, n);
}
const unit = (v) => v.reduce((a, x) => a + x * x, 0) === 1;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/* ── The walker ── */
{
  const rng = A.Rng(11);
  for (let i = 0; i < 3000; i++) {
    const N = i % 2 ? 3 : 2, M = 2 * N, s = randomPose(rng, N), w = randomWalk(rng, 1 + (i % 20));
    for (const t of R.walk(s, w).trail) {
      ok(unit(t.f) && unit(t.n) && dot(t.f, t.n) === 0, "a facing is a unit vector along the face");
      const axis = t.n.findIndex((x) => x !== 0);
      ok(t.P[axis] === (t.n[axis] > 0 ? M : 0), "a pose sits on the face its normal names");
      ok(t.P.every((x, a) => a === axis || (x % 2 === 1 && x > 0 && x < M)), "a pose sits on a square's centre");
    }
    const end = R.walk(s, w).end;
    ok(R.samePose(R.walk(end, R.inverse(w)).end, s), "a walk undone comes back");
    ok(R.samePose(R.walk(s, R.normalize(w)).end, end), "normalising a walk does not change where it goes");
    ok(R.normalize(R.normalize(w)) === R.normalize(w), "normalising is idempotent");
    const f1 = R.flat(w), f2 = R.flat(R.normalize(w));
    ok(f1.x === f2.x && f1.y === f2.y && f1.r === f2.r, "normalising a walk does not change it on a grid");
  }
  const s = R.fromDigit(2, 9, 6);
  ok(R.samePose(R.walk(s, "qqqq").end, s) && R.samePose(R.walk(s, "QQQQ").end, s) && R.samePose(R.walk(s, "hh").end, s), "four quarter turns, or two halves, are nothing");
}

/* ── The three facts the mode is built on ── */
{
  const ne = R.fromDigit(2, 9, 6);                 /* on top, north-east square, facing east */
  const corner = R.walk(ne, "^Q^Q^").end;
  ok(R.samePose({ P: corner.P, f: ne.f }, ne) && R.turnBetween(ne.n, ne.f, corner.f) === 1, "^Q^Q^ round a corner: back, turned a quarter right");
  const belt = R.walk(ne, "^^^^^^^^");
  ok(R.samePose(belt.end, ne) && belt.crossings === 4, "eight steps straight round the cube: back, facing the same way");
  const se = R.fromDigit(2, 3, 8);                 /* south-east square, facing north */
  ok(R.samePose(R.walk(se, "^^q^^^q^").end, se), "^^q^^^q^ round an edge: back, facing the same way, with two right turns");
  { const c = R.flat("^Q^Q^"); ok(c.x || c.y, "the corner walk does not close on a grid"); }
  const sq = R.flat("^Q^Q^Q^Q");
  ok(!sq.x && !sq.y && !sq.r && !R.samePose(R.walk(ne, "^Q^Q^Q^Q").end, ne), "^Q^Q^Q^Q closes on a grid but not round the corner");
}

/* ── Symmetry: turning or mirroring the whole cube turns or mirrors every walk ── */
{
  const mul = (m, v) => [0, 1, 2].map((i) => m[i][0] * v[0] + m[i][1] * v[1] + m[i][2] * v[2] || 0);
  const mm = (a, b) => [0, 1, 2].map((i) => [0, 1, 2].map((j) => a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j] || 0));
  const RX = [[1, 0, 0], [0, 0, -1], [0, 1, 0]], RY = [[0, 0, 1], [0, 1, 0], [-1, 0, 0]];
  const rots = [[[1, 0, 0], [0, 1, 0], [0, 0, 1]]];
  for (let i = 0; i < rots.length; i++) for (const g of [RX, RY]) { const r = mm(g, rots[i]); if (!rots.some((x) => JSON.stringify(x) === JSON.stringify(r))) rots.push(r); }
  ok(rots.length === 24, "the cube has 24 rotations");
  const apply = (m, s) => { const c = [s.N, s.N, s.N], d = s.P.map((x, i) => x - c[i]), P = mul(m, d).map((x, i) => x + c[i]); return R.pose(s.N, P, mul(m, s.f), mul(m, s.n)); };
  const MIRROR = { "<": ">", ">": "<", q: "Q", Q: "q" };
  const mirrored = (w) => w.split("").map((c) => MIRROR[c] || c).join("");
  const rng = A.Rng(5);
  for (let i = 0; i < 1500; i++) {
    const N = i % 2 ? 3 : 2, s = randomPose(rng, N), w = randomWalk(rng, 1 + (i % 16)), m = rots[i % 24];
    ok(R.samePose(R.walk(apply(m, s), w).end, apply(m, R.walk(s, w).end)), "a turned cube turns the walk with it");
    const X = [[-1, 0, 0], [0, 1, 0], [0, 0, 1]];
    ok(R.samePose(R.walk(apply(X, s), mirrored(w)).end, apply(X, R.walk(s, w).end)), "a mirrored cube mirrors the walk: left for right");
  }
}

/* ── On one face the cube is the flat grid, and the flat grid is the pose group ── */
const P = A.GROUPS.pose;
const ELEMENT = { "^": [0, 1, 0, 0], v: [0, -1, 0, 0], "<": [-1, 0, 0, 0], ">": [1, 0, 0, 0], q: [0, 0, 1, 0], Q: [0, 0, 3, 0], h: [0, 0, 2, 0] };
/** A walk as a pose-group element: each move taken from where the last one ended. */
function element(w) { let v = P.id(); for (const c of w) v = P.op(ELEMENT[c], v); return v; }
{
  const rng = A.Rng(17);
  for (let i = 0; i < 3000; i++) {
    const w = randomWalk(rng, 1 + (i % 18)), f = R.flat(w), e = element(w);
    ok(P.eq(e, [f.x, f.y, f.r, 0]), "the flat walker agrees with the trainer's pose group");
    const s = R.fromDigit(3, 5, 8), run = R.walk(s, w);
    if (run.crossings) continue;
    const right = [s.f[1], -s.f[0], 0], d = run.end.P.map((x, k) => (x - s.P[k]) / 2);
    ok(dot(d, right) === f.x && dot(d, s.f) === f.y && R.turnBetween(s.n, s.f, run.end.f) === f.r, "a walk that stays on one face is the flat walk");
  }
}

/* ── A reader: everything a trial says, from its compact code alone ── */
function read(lines, question) {
  const out = { premises: [], options: [] };
  for (const l of lines) {
    let m;
    if ((m = l.match(/^cube (\d)$/))) out.N = +m[1];
    else if ((m = l.match(/^R=⊤(\d)@(\d)$/))) out.start = R.fromDigit(out.N, +m[1], +m[2]);
    else if ((m = l.match(/^(\d) ([\^v<>qQh]+)$/))) out.options.push(m[2]);
    else if ((m = l.match(/^([RBGOVW])=([RBGOVW])([\^v<>qQh]+)$/))) out.premises.push({ X: m[1], Y: m[2], w: m[3] });
    else throw new Error("unreadable line: " + l);
  }
  const q = String(question);
  let m;
  if (q === "R⌂?") out.q = { kind: "home" };
  else if ((m = q.match(/^R([\^v<>qQh]+)⌂\?$/))) out.q = { kind: "homeOne", w: m[1] };
  else if (q === "∃?") out.q = { kind: "loop" };
  else if ((m = q.match(/^([BGOVW])=R([\^v<>qQh]+)\?$/))) out.q = { kind: "meet", X: m[1], w: m[2] };
  else throw new Error("unreadable question: " + q);
  return out;
}
/** Place every object linked to Red, on the cube or (flat) in the pose group; and whether every premise holds. */
function place(r, flat) {
  const at = { R: flat ? P.id() : r.start };
  const go = (s, w) => (flat ? P.op(element(w), s) : R.walk(s, w).end);
  for (let changed = true; changed;) {
    changed = false;
    for (const p of r.premises) {
      if (at[p.Y] && !at[p.X]) { at[p.X] = go(at[p.Y], p.w); changed = true; }
      else if (at[p.X] && !at[p.Y]) { at[p.Y] = go(at[p.X], R.inverse(p.w)); changed = true; }
    }
  }
  const eq = (a, b) => (flat ? P.eq(a, b) : R.samePose(a, b));
  return { at, holds: r.premises.every((p) => !at[p.X] || !at[p.Y] || eq(go(at[p.Y], p.w), at[p.X])), eq, go };
}
function answerOf(r, flat) {
  if (r.q.kind === "loop") return place(r, flat).holds ? "possible" : "impossible";
  if (r.q.kind === "meet") {
    const pl = place(r, flat);
    if (!pl.at[r.q.X]) return "cant";
    return pl.eq(pl.go(pl.at.R, r.q.w), pl.at[r.q.X]) ? "yes" : "no";
  }
  const kindOf = (w) => {
    if (flat) { const e = element(w); return e[0] || e[1] ? "away" : e[2] ? "turned" : "home"; }
    const end = R.walk(r.start, w).end;
    return R.samePose(end, r.start) ? "home" : end.P.join() === r.start.P.join() ? "turned" : "away";
  };
  if (r.q.kind === "homeOne") return kindOf(r.q.w);
  return r.options.map((w, i) => (kindOf(w) === "home" ? i : -1)).filter((i) => i >= 0);
}

/* ── Every trial, every level ── */
const tally = {};
for (let level = 1; level <= 30; level++) {
  const o = R.difficulty(level);
  for (let seed = 0; seed < 25; seed++) {
    const rng = A.Rng(level * 1000 + seed);
    for (const make of ["homeTrial", "homeOneTrial", "loopTrial", "meetTrial"]) {
      const t = R[make](rng, o);
      ok(t, `${make} L${level}: a trial was made`);
      const code = R.card(t, true), words = R.card(t, false);
      for (const c of [code, words]) {
        for (const l of c.lines) ok(!BAD.test(l), `${make} L${level}: a clean line: ${l}`);
        for (const l of c.lines.spoken) ok(l && !BAD.test(l), `${make} L${level}: a clean spoken line: ${l}`);
        ok(!BAD.test(String(c.question)) && !BAD.test(c.question.spoken), `${make} L${level}: a clean question`);
      }
      ok(code.lines.every((l) => R.ear(l) === code.lines.spoken[code.lines.indexOf(l)]), `${make}: every line is spoken from its code`);
      const r = read(code.lines, code.question);
      ok(r.N === o.N, `${make} L${level}: the cube is the level's`);
      const truth = answerOf(r, false), grid = answerOf(r, true);
      ok(JSON.stringify(truth) === JSON.stringify(t.answer), `${make} L${level}: the answer read from the code is the trial's answer`);
      /* Every walk in the moves the level allows (a half turn may be written qq). */
      const walks = r.premises.map((p) => p.w).concat(r.options, r.q.w ? [r.q.w] : []);
      for (const w of walks) ok(w.split("").every((c) => o.moves.indexOf(c) >= 0), `${make} L${level}: ${w} uses only ${o.moves}`);
      if (t.kind === "home") {
        ok(r.options.length === 4 && new Set(r.options).size === 4, "home: four different walks");
        for (const w of r.options) ok(w.length >= o.minLen && w.length <= o.maxLen && !R.retrace(r.start, w), `home L${level}: ${w} is a real walk of the level's length`);
        const gridSet = grid, cubeSet = truth;
        ok(r.options.some((w, i) => gridSet.includes(i) !== cubeSet.includes(i)), "home: the grid gets at least one option wrong");
        t.options.forEach((c, i) => {
          if (c.kind === "flat") ok(gridSet.includes(i) && !cubeSet.includes(i), "home: a flat trap is home on a grid and not on the cube");
          if (c.kind === "surprise") ok(!gridSet.includes(i) && cubeSet.includes(i), "home: a surprise is home on the cube and not on a grid");
        });
      } else if (t.lure === "flat") {
        ok(JSON.stringify(grid) !== JSON.stringify(truth), `${make} L${level}: a flat trap is one the grid gets wrong`);
      }
      if (t.kind === "loop") ok(!R.retrace(r.start, t.loop), `loop L${level}: the loop is more than out and back`);
      if (t.kind === "loop" || t.kind === "meet") {
        ok(r.premises.length >= o.objects - 2, `${make} L${level}: enough premises`);
        ok(Object.keys(place(r, false).at).length === (t.kind === "loop" ? t.names.length : Object.keys(place(r, false).at).length), "loop: every object is placed");
      }
      const k = make + ":" + (Array.isArray(t.answer) ? t.answer.length : t.answer) + (t.lure === "flat" ? "/flat" : "");
      tally[k] = (tally[k] || 0) + 1;
    }
  }
}
/* Every answer and trap comes up. */
for (const k of ["homeTrial:0", "homeTrial:1", "homeTrial:2", "homeTrial:3", "homeOneTrial:home", "homeOneTrial:turned", "homeOneTrial:away",
  "loopTrial:possible/flat", "loopTrial:impossible/flat", "loopTrial:impossible", "meetTrial:yes/flat", "meetTrial:no/flat", "meetTrial:cant"]) {
  ok(Object.keys(tally).some((t) => t === k || t.startsWith(k + "/")), "comes up: " + k);
}
/* The same seed, the same trial. */
ok(JSON.stringify(R.card(R.loopTrial(A.Rng(9), R.difficulty(14)), true)) === JSON.stringify(R.card(R.loopTrial(A.Rng(9), R.difficulty(14)), true)), "seeded trials repeat");

console.log(checks + " checks passed");
console.log(JSON.stringify(tally));
