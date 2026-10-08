"use strict";
/*
 * KIND FRAMES: what a direction word means depends on where the reference
 * object sits on another axis -- here the Distinction (parity) axis.
 *
 * Convention (the same one the app already uses): every premise, and the claim,
 * is in the reckoning of the object it is "relative to". New rule: the two kinds
 * reckon differently -- the other kind's frame is P applied to this kind's.
 *   mirror  P = east and west exchanged
 *   swap    P = north and up exchanged
 * P is an involution, so only RELATIVE kind matters: a premise stated from an
 * object of the other kind than the claim's reference is read through P. No
 * anchor is needed -- the parity axis is already relative.
 *
 * generate() builds absolute positions; solve() reads only the text.
 */
const { rng, pick, shuffle, WORDS, buildTree, sign } = require("./lib");

const P = {
  mirror: ([x, y, z]) => [-x, y, z],
  swap: ([x, y, z]) => [x, z, y],
  none: v => v,
};
const add = (a, b) => a.map((v, i) => v + b[i]);
const neg = a => a.map(v => -v);
const AX = [
  { pos: "east", neg: "west", tie: "same longitude", rel: ["west of", "at the same longitude as", "east of"] },
  { pos: "north", neg: "south", tie: "same latitude", rel: ["south of", "at the same latitude as", "north of"] },
  { pos: "above", neg: "below", tie: "same height", rel: ["below", "at the same height as", "above"] },
];
/** Frame of an object of `kind`: kind 1 reckons through P. */
const frame = (rule, kind, v) => (kind ? P[rule](v) : v);

function render(subj, ref, d, sameKind) {
  return `${subj} is ${[...AX.map((ax, i) => (d[i] === 0 ? ax.tie : d[i] > 0 ? ax.pos : ax.neg)),
    sameKind ? "same kind" : "opposite kind"].join(", ")} relative to ${ref}`;
}

/* ---------------- text reader with three readings ---------------- */
const RX = /^(\w+) is (east|west|same longitude), (north|south|same latitude), (above|below|same height), (same kind|opposite kind) relative to (\w+)$/;
const VAL = { east: 1, west: -1, "same longitude": 0, north: 1, south: -1, "same latitude": 0, above: 1, below: -1, "same height": 0 };
function place(how, rule, premises) {
  const facts = premises.map(p => {
    const x = p.match(RX);
    return { subj: x[1], ref: x[6], d: [VAL[x[2]], VAL[x[3]], VAL[x[4]]], flipKind: x[5] === "opposite kind" ? 1 : 0 };
  });
  const root = facts[0].ref;
  const kind = { [root]: 0 }, pos = { [root]: [0, 0, 0] };
  // how: "true" decodes by the reference's kind; "flat" ignores kinds;
  // "subject" decodes by the subject's kind (the wrong end of the premise).
  const decode = (f, kRef, kSubj) =>
    how === "flat" ? f.d : frame(rule, how === "subject" ? kSubj : kRef, f.d);
  for (let changed = true; changed;) {
    changed = false;
    for (const f of facts) {
      if (f.ref in pos && !(f.subj in pos)) {
        kind[f.subj] = kind[f.ref] ^ f.flipKind;
        pos[f.subj] = add(pos[f.ref], decode(f, kind[f.ref], kind[f.subj]));
        changed = true;
      } else if (f.subj in pos && !(f.ref in pos)) {
        kind[f.ref] = kind[f.subj] ^ f.flipKind;
        pos[f.ref] = add(pos[f.subj], neg(decode(f, kind[f.ref], kind[f.subj])));
        changed = true;
      }
    }
  }
  return { pos, kind };
}
function verdict(how, rule, premises, conclusion) {
  // "uniform": every premise converted the same way (all through P) -- with
  // "flat" (none through P) these are the two readings that need no kind
  // carried per premise. An item must defeat both, so the chain has to mix
  // premises stated from both kinds.
  const { pos, kind } = place(how === "uniform" ? "flat" : how, rule, premises);
  const c = conclusion.match(/^(\w+) is (.+) (\w+)$/);
  const [b, relw, a] = [c[1], c[2], c[3]];
  const ax = AX.findIndex(A => A.rel.includes(relw));
  const want = AX[ax].rel.indexOf(relw) - 1;
  // In a's reckoning: P is an involution, so applying it converts either way.
  const raw = pos[b].map((v, i) => v - pos[a][i]);
  const delta = how === "flat" ? raw : how === "uniform" ? P[rule](raw) : frame(rule, kind[a], raw);
  return sign(delta[ax]) === want;
}
const solve = (rule, premises, conclusion) => verdict("true", rule, premises, conclusion);

function generate(R, { rule = "mirror", n = 5 } = {}) {
  for (let attempt = 0; attempt < 300; attempt++) {
    const words = shuffle(R, WORDS).slice(0, n);
    const edges = buildTree(R, words, R() < 0.4);
    const kind = { [words[0]]: 0 }, pos = { [words[0]]: [0, 0, 0] };
    for (const e of edges) {
      e.kd = R() < 0.5 ? 1 : 0;
      do e.d = [0, 1, 2].map(() => pick(R, [-1, 0, 1])); while (e.d.every(v => v === 0));
      kind[e.to] = kind[e.from] ^ e.kd;
      pos[e.to] = add(pos[e.from], frame(rule, kind[e.from], e.d)); // in the reference's frame
    }
    const premises = shuffle(R, edges.map(e => {
      if (R() < 0.5) return render(e.to, e.from, e.d, !e.kd);
      // From the other end, in the other end's reckoning.
      const dConv = frame(rule, kind[e.to], neg(frame(rule, kind[e.from], e.d)));
      return render(e.from, e.to, dConv, !e.kd);
    }));
    const opts = [];
    for (const a of words) for (const b of words) {
      if (a === b) continue;
      for (let ax = 0; ax < 3; ax++) {
        const t = sign(frame(rule, kind[a], pos[b].map((v, i) => v - pos[a][i]))[ax]);
        const word = x => AX[ax].rel[x + 1];
        const flatSays = [-1, 0, 1].find(x => verdict("flat", rule, premises, `${b} is ${word(x)} ${a}`));
        if (flatSays === t) continue;
        const uniformSays = [-1, 0, 1].find(x => verdict("uniform", rule, premises, `${b} is ${word(x)} ${a}`));
        if (uniformSays === t) continue; // coupling must bite inside the chain, not only at the claim
        opts.push({ a, b, ax, truth: t, flat: flatSays, uniform: uniformSays });
      }
    }
    if (!opts.length) continue;
    const o = pick(R, opts);
    const isValid = R() < 0.5;
    const conclusion = `${o.b} is ${AX[o.ax].rel[(isValid ? o.truth : o.flat) + 1]} ${o.a}`;
    return { premises, conclusion, isValid, meta: o, kind, pos };
  }
  return null;
}

if (require.main === module) {
  const N = 2000;
  for (const rule of ["mirror", "swap"]) {
    let built = 0, agree = 0, flatWrong = 0, subjWrong = 0, uniformWrong = 0, shown = false;
    for (let seed = 1; seed <= N; seed++) {
      const R = rng(seed * 31 + (rule === "swap" ? 3 : 0));
      const it = generate(R, { rule, n: 5 });
      if (!it) continue;
      built++;
      const t = solve(rule, it.premises, it.conclusion);
      if (t === it.isValid) agree++;
      if (verdict("flat", rule, it.premises, it.conclusion) !== t) flatWrong++;
      if (verdict("subject", rule, it.premises, it.conclusion) !== t) subjWrong++;
      if (verdict("uniform", rule, it.premises, it.conclusion) !== t) uniformWrong++;
      if (!shown && seed > 40) {
        shown = true;
        console.log(`\n--- sample ${rule} ---`);
        it.premises.forEach(p => console.log("  " + p));
        console.log(`  CLAIM: ${it.conclusion}  -> ${it.isValid}`);
        console.log(`  kinds: ${JSON.stringify(it.kind)}  positions (kind-0 frame): ${JSON.stringify(it.pos)}`);
        console.log(`  meta: ${JSON.stringify(it.meta)}`);
      }
    }
    console.log(`${rule}: built ${built}/${N}, solver agrees ${agree}, flat reader wrong ${flatWrong}, convert-all reader wrong ${uniformWrong}, wrong-end reader wrong ${subjWrong}`);
  }
}
module.exports = { generate, solve, verdict };
