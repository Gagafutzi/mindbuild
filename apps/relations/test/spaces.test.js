/* node apps/relations/test/spaces.test.js — glued spaces: the walker against
   what a torus, a Klein bottle and a projective plane do, and every trial's
   answer worked out again from what its card gives. */
"use strict";
const A = require("../algebra.js");
const S = require("../spaces.js");
const assert = require("assert");
let checks = 0;
const ok = (c, m) => { checks++; assert.ok(c, m); };
const BAD = /undefined|null|NaN|\[object/;
const MOVES = "^v<>qQh";

const torus = S.space(4, 5, S.axis(false), S.axis(false));
const klein = S.space(4, 5, S.axis(true), S.axis(false));
const plane = S.space(5, 4, S.axis(true), S.axis(true));
const sheets = S.space(4, 4, S.axis(false, true), S.axis(true));
const ALL = [torus, klein, plane, sheets];
const rep = (c, n) => c.repeat(n);

/* ── Geometry ── */
{
  /* Straight round a straight seam: home after W steps, unchanged. */
  const p = S.pose(1, 2, 1, 0, 0);
  ok(S.samePose(S.walk(torus, p, rep("^", 4)).end, p), "torus: once round east is home");

  /* Once across a twisted seam: the mirrored row, mirrored; twice: home. */
  const k1 = S.walk(klein, p, rep("^", 4)).end;
  ok(k1.x === 1 && k1.y === 5 - 1 - 2 && k1.m === 1 && k1.f === 1, "klein: once round east comes back in the mirrored row, mirrored");
  ok(S.samePose(S.walk(klein, p, rep("^", 8)).end, p), "klein: twice round east is home");
  /* The middle row of an odd field is its own mirror: once round is back on the square, mirrored. */
  const mid = S.pose(0, 2, 1, 0, 0);
  ok(S.classify(klein, mid, rep("^", 4)) === "mirrored", "klein: the middle row comes back mirrored on its own square");

  /* A mirrored walker's left is the other way: after the twist, < goes south, not north. */
  const after = S.walk(klein, S.pose(3, 1, 1, 0, 0), "^<").end;
  ok(after.m === 1 && after.x === 0 && after.y === 5 - 1 - 1 - 1, "a mirrored walker's left is its right as was");

  /* Going north across a straight seam never mirrors; across a twisted one does. */
  ok(S.walk(klein, S.pose(2, 4, 0, 0, 0), "^").end.m === 0, "klein: the straight seam does not mirror");
  ok(S.walk(plane, S.pose(2, 3, 0, 0, 0), "^").end.m === 1, "plane: both seams mirror");

  /* A sheet seam: once across onto the other sheet, twice back. */
  const s1 = S.walk(sheets, S.pose(3, 0, 1, 0, 0), "^").end;
  ok(s1.s === 1 && s1.x === 0 && s1.m === 0, "sheets: east off the edge, onto the second sheet, unmirrored");
  ok(S.walk(sheets, S.pose(3, 0, 1, 0, 0), rep("^", 8)).end.s === 0, "sheets: round twice is back on the first sheet");

  /* Every walk can be undone, on every field, from anywhere. */
  const rng = A.Rng(3);
  for (let i = 0; i < 3000; i++) {
    const sp = ALL[i % ALL.length];
    const q = S.pose(Math.floor(rng.next() * sp.W), Math.floor(rng.next() * sp.H), Math.floor(rng.next() * 4), rng.next() < 0.5 ? 1 : 0, sp.x.sheet || sp.y.sheet ? (rng.next() < 0.5 ? 1 : 0) : 0);
    let w = ""; for (let j = 0; j < 1 + (i % 14); j++) w += MOVES[Math.floor(rng.next() * MOVES.length)];
    const back = w.split("").reverse().map((c) => ({ "^": "v", v: "^", "<": ">", ">": "<", q: "Q", Q: "q", h: "h" })[c]).join("");
    const e = S.walk(sp, q, w).end;
    ok(e.x >= 0 && e.x < sp.W && e.y >= 0 && e.y < sp.H, "stays on the field");
    ok(S.samePose(S.walk(sp, e, back).end, q), "walk then its undoing is home: " + w);
  }
}

/* ── Every trial, from its card ── */
{
  const counts = {};
  for (let L = 1; L <= 30; L++) {
    const o = S.difficulty(L);
    for (const kind of S.KINDS) {
      for (let i = 0; i < 12; i++) {
        const t = S.trial(kind, A.Rng(L * 7919 + i * 31 + kind.length), o);
        ok(t, `level ${L}: no ${kind} trial`);
        counts[kind] = (counts[kind] || 0) + 1;
        const c = S.card(t, true), w = S.card(t, false);
        ok(!BAD.test(c.lines.join("\n") + c.question) && !BAD.test(w.lines.join("\n") + w.question), `${kind}: a card says nothing sensible`);
        ok(c.lines.spoken.length === c.lines.length, `${kind}: every line is spoken`);
        const where = `level ${L}, ${kind} #${i}`;

        if (kind === "where" || kind === "transfer") {
          const from = kind === "where" ? t.start : t.gold;
          const truth = S.walk(t.space, from, t.walk).end;
          ok(t.options.length === 4 && new Set(t.options.map((op) => S.key(op.pose))).size === 4, `${where}: four distinct poses`);
          ok(t.options.filter((op) => S.samePose(op.pose, truth)).length === 1, `${where}: exactly one option is where it ends`);
          ok(S.samePose(t.options[t.answer].pose, truth), `${where}: the marked answer is not where it ends`);
          if (kind === "transfer") {
            ok(S.samePose(S.walk(t.space, t.start, t.walk).end, t.blue), `${where}: Blue is not Red walked`);
            ok(!S.walk(t.space, t.start, t.walk).crossings.length, `${where}: Red's walk crosses a seam`);
          }
        }
        if (kind === "home") {
          const e = S.walk(t.space, t.start, t.walk).end;
          const truth = !S.sameSquare(e, t.start) ? "away" : e.m !== t.start.m ? "mirrored" : e.f === t.start.f ? "home" : "turned";
          ok(truth === t.answer, `${where}: home answer ${t.answer}, the walk says ${truth}`);
          ok(!S.retrace(t.space, t.start, t.walk), `${where}: a retrace`);
        }
        if (kind === "possible") {
          /* Walk the premises as stated, objects placed as they are reached. */
          const at = { Red: t.start };
          for (let pass = 0; pass < 6; pass++) for (const p of t.premises) {
            if (at[p.Y] && !at[p.X]) at[p.X] = S.walk(t.space, at[p.Y], p.w).end;
            else if (at[p.X] && !at[p.Y]) {
              const back = p.w.split("").reverse().map((c) => ({ "^": "v", v: "^", "<": ">", ">": "<", q: "Q", Q: "q", h: "h" })[c]).join("");
              at[p.Y] = S.walk(t.space, at[p.X], back).end;
            }
          }
          const holds = t.premises.every((p) => at[p.X] && at[p.Y] && S.samePose(S.walk(t.space, at[p.Y], p.w).end, at[p.X]));
          ok((holds ? "possible" : "impossible") === t.answer, `${where}: possible says ${t.answer}, the premises say ${holds}`);
        }
        if (kind === "space") {
          const fits = t.options.filter((sp) => t.observations.every((ob) => S.samePose(S.walk(sp, ob.start, ob.walk).end, ob.end)));
          ok(fits.length === 1 && S.spaceKey(fits[0]) === S.spaceKey(t.options[t.answer]), `${where}: not exactly one field fits`);
          ok(new Set(t.options.map(S.spaceKey)).size === 4, `${where}: two options alike`);
        }
        if (kind === "drift") {
          const run = (m, d) => S.drift(t.space, { x: m.x, y: m.y, s: m.s, d: d || m.d, k: m.k }, t.ticks);
          if (t.ask === "where") {
            const end = run(t.movers[0]).at[t.ticks];
            ok(t.options.filter((op) => op.sq.x === end.x && op.sq.y === end.y && op.sq.s === end.s).length === 1, `${where}: drift where not unique`);
            ok(t.options[t.answer].sq.x === end.x && t.options[t.answer].sq.y === end.y, `${where}: drift where answer wrong`);
          } else {
            const Y = t.movers.find((m) => m.name === t.Y), a = run(t.movers[0]);
            const meet = (b) => { for (let k = 1; k <= t.ticks; k++) if (a.at[k].x === b.at[k].x && a.at[k].y === b.at[k].y && a.at[k].s === b.at[k].s) return true; return false; };
            const m1 = meet(run(Y)), m2 = t.alt ? meet(run(Y, t.alt)) : m1;
            const truth = m1 && m2 ? "yes" : !m1 && !m2 ? "no" : "cant";
            ok(truth === t.answer, `${where}: drift meet says ${t.answer}, the runs say ${truth}`);
          }
        }
      }
    }
  }
  ok(Object.keys(counts).length === S.KINDS.length, "every kind was made");
}

/* ── The traps are there ── */
{
  let plainSeen = 0, screenSeen = 0;
  for (let i = 0; i < 300; i++) {
    const t = S.whereTrial(A.Rng(900 + i), S.difficulty(1 + (i % 30)));
    if (t.options.some((op) => ["plain", "noHand", "portal"].includes(op.lure))) plainSeen++;
    const u = S.transferTrial(A.Rng(1900 + i), S.difficulty(1 + (i % 30)));
    if (u.options.some((op) => op.lure === "screen")) screenSeen++;
  }
  ok(plainSeen === 300, "every where trial offers a seam mistake");
  ok(screenSeen > 200, "most transfer trials offer the page-offset copy: " + screenSeen);
}

/* ── No answer without the reasoning ──
   A task trains what it takes to answer it. If a reader who never walks a step can
   beat chance — by picking the mirrored option, the most typical one, the odd one out,
   or by reading every seam as straight — then that is what gets trained. Each of these
   strategies is run over 1,200 trials and held to chance (a four-way choice: 25%, with
   a margin of about four standard errors). */
{
  const feats = (p) => p.pose ? [p.pose.x, p.pose.y, p.pose.f, p.pose.m, p.pose.s] : [p.sq.x, p.sq.y, p.sq.s];
  const shared = (a, b) => feats(a).reduce((n, v, i) => n + (v === feats(b)[i] ? 1 : 0), 0);
  const typical = (t, sign) => {
    let best = -Infinity, bi = 0;
    t.options.forEach((o, i) => { const sc = sign * t.options.reduce((n, q, j) => n + (j === i ? 0 : shared(o, q)), 0); if (sc > best) { best = sc; bi = i; } });
    return bi;
  };
  const firstWhere = (t, f) => Math.max(0, t.options.findIndex(f));
  const STRATEGIES = {
    "the most typical option": (t) => typical(t, 1),
    "the odd one out": (t) => typical(t, -1),
    "the first mirrored option": (t) => firstWhere(t, (o) => o.pose && o.pose.m),
    "the first unmirrored option": (t) => firstWhere(t, (o) => o.pose && !o.pose.m),
    "the first option on the second sheet": (t) => firstWhere(t, (o) => (o.pose || o.sq).s),
  };
  const lo = 0.2, hi = 0.31, N = 1200;
  for (const kind of ["where", "transfer", "drift"]) {
    const won = {}; let n = 0;
    for (let i = 0; n < N && i < 5 * N; i++) {
      const t = S.trial(kind, A.Rng(424242 + i * 13), S.difficulty(1 + (i % 30)));
      if (!t.options || (kind === "drift" && t.ask !== "where")) continue;
      n++;
      for (const [name, f] of Object.entries(STRATEGIES)) won[name] = (won[name] || 0) + (f(t) === t.answer ? 1 : 0);
    }
    for (const [name, w] of Object.entries(won)) ok(w / n >= lo && w / n <= hi, `${kind}: picking ${name} scores ${(w / n).toFixed(2)}`);
  }

  const share = (f) => { let yes = 0; for (let i = 0; i < N; i++) if (f(i)) yes++; return yes / N; };
  const lv = (i) => S.difficulty(1 + (i % 30));
  /* Home: each answer a quarter of the time; the straight-seam reading right well under half. */
  const homes = Array.from({ length: N }, (_, i) => S.homeTrial(A.Rng(515151 + i), lv(i)));
  for (const a of ["home", "mirrored", "turned", "away"]) {
    const f = homes.filter((t) => t.answer === a).length / N;
    ok(f >= 0.19 && f <= 0.31, `home: "${a}" is the answer ${(f * 100).toFixed(0)}% of the time`);
  }
  ok(homes.filter((t) => t.plainAnswer === t.answer).length / N <= 0.5, "home: reading the seams as straight is right too often");
  /* Possible: either answer about half the time, and the straight reading mostly wrong. */
  const loops = Array.from({ length: N }, (_, i) => S.possibleTrial(A.Rng(616161 + i), lv(i)));
  const pos = loops.filter((t) => t.answer === "possible").length / N;
  ok(pos >= 0.4 && pos <= 0.6, `possible: "possible" is the answer ${(pos * 100).toFixed(0)}% of the time`);
  ok(loops.filter((t) => t.plainAnswer === t.answer).length / N <= 0.5, "possible: reading the seams as straight is right too often");
  /* Meet: yes and no about even; the straight reading mostly wrong. */
  const meets = Array.from({ length: 3 * N }, (_, i) => S.driftTrial(A.Rng(717171 + i), lv(i))).filter((t) => t.ask === "meet" && !t.alt);
  const yes = meets.filter((t) => t.answer === "yes").length / meets.length;
  ok(yes >= 0.4 && yes <= 0.6, `drift: they meet in ${(yes * 100).toFixed(0)}% of meet trials`);
  ok(meets.filter((t) => !t.lure).length / meets.length <= 0.5, "drift: reading the seams as straight settles meetings too often");
  /* Which field: no shortcut through how twisted or how many sheets the options are. */
  const fields = Array.from({ length: N }, (_, i) => S.spaceTrial(A.Rng(818181 + i), lv(i)));
  const twists = (x) => +x.x.twist + +x.y.twist, sheets = (x) => +x.x.sheet + +x.y.sheet;
  const by = (t, f) => t.options.reduce((bi, x, j) => (f(x) > f(t.options[bi]) ? j : bi), 0);
  for (const [name, f] of [["most twisted", twists], ["least twisted", (x) => -twists(x)], ["fewest sheets", (x) => -sheets(x)], ["most sheets", sheets]]) {
    const w = fields.filter((t) => by(t, f) === t.answer).length / N;
    ok(w <= hi, `space: picking the ${name} field scores ${w.toFixed(2)}`);
  }
}

console.log(`spaces: ${checks} checks passed`);
