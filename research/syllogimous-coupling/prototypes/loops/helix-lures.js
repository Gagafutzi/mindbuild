"use strict";
// Lure rates for helix day items, measured from the TEXT, and the control:
// with every day clause stated, column-wise addition of day clauses is exact.
const { rng, sign } = require("./lib");
const { generate } = require("./helix");

function readers(premises, conclusion) {
  const rx = /^(\w+) is (.+) relative to (\w+)$/;
  const facts = premises.map(p => {
    const [, subj, body, ref] = p.match(rx);
    const wm = body.match(/(\d+) watch(?:es)? (later|earlier)(?:, on (the same day|the next day|the day before))?/);
    return { subj, ref, k: Number(wm[1]) * (wm[2] === "later" ? 1 : -1),
      dd: wm[3] == null ? null : { "the same day": 0, "the next day": 1, "the day before": -1 }[wm[3]] };
  });
  const T = { [facts[0].ref]: 0 }, D = { [facts[0].ref]: 0 };
  for (let ch = true; ch;) {
    ch = false;
    for (const f of facts) {
      const dd = f.dd ?? 0; // per-axis: an unstated day clause adds nothing
      if (f.ref in T && !(f.subj in T)) { T[f.subj] = T[f.ref] + f.k; D[f.subj] = D[f.ref] + dd; ch = true; }
      if (f.subj in T && !(f.ref in T)) { T[f.ref] = T[f.subj] - f.k; D[f.ref] = D[f.subj] - dd; ch = true; }
    }
  }
  const m = conclusion.match(/^(\w+) is on (a later day than|the same day as|an earlier day than) (\w+)$/);
  const want = { "a later day than": 1, "the same day as": 0, "an earlier day than": -1 }[m[2]];
  const total = T[m[1]] - T[m[3]];
  return {
    columnwise: sign(D[m[1]] - D[m[3]]) === want,
    phaseFree: sign(Math.trunc(total / 4)) === want, // "five watches is a day and one"
  };
}

let n = 0, colWrong = 0, pfWrong = 0;
for (let seed = 1; seed <= 3000; seed++) {
  const it = generate(rng(seed * 7 + 1), 5, "day");
  if (!it) continue;
  n++;
  const r = readers(it.premises, it.conclusion);
  if (r.columnwise !== it.isValid) colWrong++;
  if (r.phaseFree !== it.isValid) pfWrong++;
}
console.log(`day items ${n}: column-wise day sum wrong ${colWrong}, phase-free total/4 wrong ${pfWrong}`);

// Control: state every day clause, ask the same kind of pair.
const { mod } = require("./lib");
let ctl = 0, ctlRight = 0;
for (let seed = 1; seed <= 3000; seed++) {
  const R = rng(seed * 101);
  const p0 = Math.floor(R() * 4), ks = [1, 2, 3, 4].map(() => [-2, -1, 1, 2][Math.floor(R() * 4)]);
  let t = p0, colSum = 0;
  for (const k of ks) { colSum += Math.floor((t + k) / 4) - Math.floor(t / 4); t += k; }
  ctl++;
  if (sign(colSum) === sign(Math.floor(t / 4) - Math.floor(p0 / 4))) ctlRight++;
}
console.log(`control, all day clauses stated: column-wise right ${ctlRight}/${ctl}`);
