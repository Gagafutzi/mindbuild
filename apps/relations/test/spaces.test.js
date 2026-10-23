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

console.log(`spaces: ${checks} checks passed`);
