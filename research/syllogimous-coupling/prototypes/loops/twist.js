"use strict";
/*
 * TWIST: a circular axis whose seam acts on other axes.
 *
 * The ring has m columns. Crossing the seam clockwise applies g to the other
 * coordinates:
 *   flip     g(y, z) = (-y, z)      Moebius band: north becomes south
 *   quarter  g(y, z) = (-z, y)      a square tube joined with a quarter twist:
 *                                   north becomes up, up becomes south
 * g acts on POSITIONS, about the band's centre line (y = z = 0) -- that is what
 * the identification (c + m, w) ~ (c, g w) means. So the anchor has to pin the
 * column AND the centre line; pinning the column alone (first draft of this
 * script) left ~40% of items undetermined, which the independent solver caught.
 *
 * Positions are stored in the CHART (the band cut at the twist). A premise
 * "V is k clockwise, j north, i above relative to U" is measured from U:
 *   V = (mod(cU + k, m), g^L (wU + d)),   L = floor((cU + k) / m)
 *
 * generate() builds in the chart; every verdict and every lure is computed by
 * reading the rendered text back.
 */
const { rng, mod, pick, shuffle, WORDS, buildTree, sign } = require("./lib");

const G = {
  flip: { f: ([y, z]) => [-y, z], inv: ([y, z]) => [-y, z] },
  quarter: { f: ([y, z]) => [-z, y], inv: ([y, z]) => [z, -y] },
  none: { f: w => w, inv: w => w },
};
function gPow(kind, L, w) {
  let v = w.slice();
  for (let i = 0; i < Math.abs(L); i++) v = L > 0 ? G[kind].f(v) : G[kind].inv(v);
  return v;
}
const add = (a, b) => a.map((v, i) => v + b[i]);
const subv = (a, b) => a.map((v, i) => v - b[i]);
const eq = (a, b) => a.every((v, i) => v === b[i]);

/* Three readers. "true" is the space; "flat" ignores the twist (per-axis
   addition, the ring mod m); "local" applies g to the crossing step only. */
function step(how, kind, m, U, k, d) {
  const c = U.c + k, L = Math.floor(c / m);
  if (how === "flat") return { c: mod(c, m), w: add(U.w, d) };
  if (how === "local") return { c: mod(c, m), w: add(U.w, gPow(kind, L, d)) };
  return { c: mod(c, m), w: gPow(kind, L, add(U.w, d)) };
}
function unstep(how, kind, m, V, k, d) {
  const c = mod(V.c - k, m), L = Math.floor((c + k) / m);
  if (how === "flat") return { c, w: subv(V.w, d) };
  if (how === "local") return { c, w: subv(V.w, gPow(kind, L, d)) };
  return { c, w: subv(gPow(kind, -L, V.w), d) };
}

const AX = [
  { pos: "north", neg: "south", tie: "same latitude" },
  { pos: "above", neg: "below", tie: "same height" },
];
function clause(k, d) {
  const n = Math.abs(k);
  const ring = `${n} step${n === 1 ? "" : "s"} ${k > 0 ? "clockwise" : "anticlockwise"}`;
  return [ring, ...AX.map((ax, i) => (d[i] === 0 ? ax.tie : d[i] > 0 ? ax.pos : ax.neg))].join(", ");
}

/* ---------------- text reader, used by the solver and the lures ---------------- */
const RX = /^(\w+) is (\d+) steps? (clockwise|anticlockwise), (north|south|same latitude), (above|below|same height) relative to (\w+)$/;
function parse(premises) {
  const an = premises[0].match(/^(\w+) stands on the centre line, just (clockwise|anticlockwise) of the twist$/);
  const facts = premises.slice(1).map(p => {
    const x = p.match(RX);
    return {
      subj: x[1], ref: x[6], k: Number(x[2]) * (x[3] === "clockwise" ? 1 : -1),
      d: [{ north: 1, south: -1, "same latitude": 0 }[x[4]], { above: 1, below: -1, "same height": 0 }[x[5]]],
    };
  });
  return { anchor: an[1], side: an[2], facts };
}
function place(how, kind, m, parsed) {
  const pos = { [parsed.anchor]: { c: parsed.side === "clockwise" ? 0 : m - 1, w: [0, 0] } };
  for (let changed = true; changed;) {
    changed = false;
    for (const f of parsed.facts) {
      if (f.ref in pos && !(f.subj in pos)) { pos[f.subj] = step(how, kind, m, pos[f.ref], f.k, f.d); changed = true; }
      else if (f.subj in pos && !(f.ref in pos)) { pos[f.ref] = unstep(how, kind, m, pos[f.subj], f.k, f.d); changed = true; }
    }
  }
  const consistent = parsed.facts.every(f => {
    const v = step(how, kind, m, pos[f.ref], f.k, f.d);
    return v.c === pos[f.subj].c && eq(v.w, pos[f.subj].w);
  });
  return { pos, consistent };
}
const REL = {
  "north of": [0, 1], "south of": [0, -1], "at the same latitude as": [0, 0],
  above: [1, 1], below: [1, -1], "at the same height as": [1, 0],
};
function verdict(how, kind, m, premises, conclusion) {
  const { pos, consistent } = place(how, kind, m, parse(premises));
  if (conclusion === "All of these can be true at once") return consistent;
  if (!consistent) return "inconsistent";
  const c = conclusion.match(/^(\w+) is (north of|south of|at the same latitude as|above|below|at the same height as) (\w+)$/);
  const [ax, want] = REL[c[2]];
  return sign(pos[c[1]].w[ax] - pos[c[3]].w[ax]) === want;
}
/*
 * The independent solver: a different algorithm, not the generator's step().
 * Lift everything to the universal cover (ring unrolled, no seam), where the
 * space is flat and premises just add -- after converting each premise out of
 * its reference's chart frame (g^-laps). Project to the chart only at the end;
 * a loop closes when both ends project to the same chart point.
 */
function solveCover(premises, conclusion, kind, m) {
  const { anchor, side, facts } = parse(premises);
  const laps = c => Math.floor(c / m);
  const cover = { [anchor]: { c: side === "clockwise" ? 0 : m - 1, w: [0, 0] } };
  for (let changed = true; changed;) {
    changed = false;
    for (const f of facts) {
      if (f.ref in cover && !(f.subj in cover)) {
        const U = cover[f.ref];
        cover[f.subj] = { c: U.c + f.k, w: add(U.w, gPow(kind, -laps(U.c), f.d)) };
        changed = true;
      } else if (f.subj in cover && !(f.ref in cover)) {
        const V = cover[f.subj], cU = V.c - f.k;
        cover[f.ref] = { c: cU, w: subv(V.w, gPow(kind, -laps(cU), f.d)) };
        changed = true;
      }
    }
  }
  const chart = x => ({ c: mod(cover[x].c, m), w: gPow(kind, laps(cover[x].c), cover[x].w) });
  const ok = facts.every(f => {
    const U = cover[f.ref], end = U.c + f.k;
    const w = add(U.w, gPow(kind, -laps(U.c), f.d));
    const proj = { c: mod(end, m), w: gPow(kind, laps(end), w) };
    const V = chart(f.subj);
    return proj.c === V.c && eq(proj.w, V.w);
  });
  if (conclusion === "All of these can be true at once") return ok;
  if (!ok) return "inconsistent";
  const c = conclusion.match(/^(\w+) is (north of|south of|at the same latitude as|above|below|at the same height as) (\w+)$/);
  const [ax, want] = REL[c[2]];
  return sign(chart(c[1]).w[ax] - chart(c[3]).w[ax]) === want;
}
const solve = solveCover;

/* ---------------- generator ---------------- */
function generate(R, { kind = "flip", m = 5, n = 5, question = "chart" } = {}) {
  for (let attempt = 0; attempt < 400; attempt++) {
    const words = shuffle(R, WORDS).slice(0, n);
    const edges = buildTree(R, words, R() < 0.4);
    for (const e of edges) {
      e.k = pick(R, m >= 5 ? [-2, -1, 1, 2] : [-1, 1]);
      e.d = [pick(R, [-1, 0, 1]), pick(R, [-1, 0, 1])];
    }
    // Rooted at the anchor, which sits on the centre line beside the twist.
    const anchor = pick(R, words);
    const side = R() < 0.5 ? "clockwise" : "anticlockwise";
    const pos = { [anchor]: { c: side === "clockwise" ? 0 : m - 1, w: [0, 0] } };
    for (let changed = true; changed;) {
      changed = false;
      for (const e of edges) {
        if (e.from in pos && !(e.to in pos)) { pos[e.to] = step("true", kind, m, pos[e.from], e.k, e.d); changed = true; }
        else if (e.to in pos && !(e.from in pos)) { pos[e.from] = unstep("true", kind, m, pos[e.to], e.k, e.d); changed = true; }
      }
    }
    if (Object.values(pos).some(p => p.w.some(v => Math.abs(v) > 3))) continue;
    const renderEdge = (e, flip) => {
      if (!flip) return `${e.to} is ${clause(e.k, e.d)} relative to ${e.from}`;
      // The converse is -g^L(d), not -d: across the twist both say "north".
      const L = Math.floor((pos[e.from].c + e.k) / m);
      const dConv = gPow(kind, L, e.d).map(v => -v);
      return `${e.from} is ${clause(-e.k, dConv)} relative to ${e.to}`;
    };
    const anchorText = `${anchor} stands on the centre line, just ${side} of the twist`;
    const body = edges.map(e => renderEdge(e, R() < 0.5));
    const premises = [anchorText, ...shuffle(R, body)];

    // Writer checked against reader: the text must place everything where it was built.
    const back = place("true", kind, m, parse(premises)).pos;
    for (const w of words) if (back[w].c !== pos[w].c || !eq(back[w].w, pos[w].w)) throw new Error("render/parse mismatch");

    if (question === "chart") {
      const flatPos = place("flat", kind, m, parse(premises)).pos;
      const localPos = place("local", kind, m, parse(premises)).pos;
      const opts = [];
      for (const a of words) for (const b of words) {
        if (a === b) continue;
        for (const ax of kind === "flip" ? [0] : [0, 1]) {
          const t = sign(pos[b].w[ax] - pos[a].w[ax]);
          const f = sign(flatPos[b].w[ax] - flatPos[a].w[ax]);
          if (f === t) continue; // the per-axis reading has to fail
          opts.push({ a, b, ax, truth: t, flat: f, local: sign(localPos[b].w[ax] - localPos[a].w[ax]) });
        }
      }
      if (!opts.length) continue;
      const o = pick(R, opts);
      const words3 = o.ax === 0 ? ["south of", "at the same latitude as", "north of"] : ["below", "at the same height as", "above"];
      const isValid = R() < 0.5;
      const conclusion = `${o.b} is ${words3[(isValid ? o.truth : o.flat) + 1]} ${o.a}`;
      return { premises, conclusion, isValid, meta: o, pos, kind, m };
    }

    // "loop": one more premise closes a loop that goes once round the ring.
    const flatTree = place("flat", kind, m, parse(premises)).pos;
    const opts = [];
    for (const a of words) for (const b of words) {
      if (a === b) continue;
      const kc0 = mod(pos[b].c - pos[a].c, m);
      for (const kc of [kc0, kc0 - m]) {
        if (kc === 0 || Math.abs(kc) > m - 1) continue;
        const L = Math.floor((pos[a].c + kc) / m);
        const dTrue = subv(gPow(kind, -L, pos[b].w), pos[a].w);
        const dFlat = subv(flatTree[b].w, flatTree[a].w); // what column-wise addition expects
        if (dTrue.some(v => Math.abs(v) > 1) || dFlat.some(v => Math.abs(v) > 1)) continue;
        if (eq(dTrue, dFlat)) continue; // this loop does not feel the twist
        opts.push({ a, b, kc, dTrue, dFlat });
      }
    }
    if (!opts.length) continue;
    const o = pick(R, opts);
    const isValid = R() < 0.5;
    const closing = `${o.b} is ${clause(o.kc, isValid ? o.dTrue : o.dFlat)} relative to ${o.a}`;
    return {
      premises: [anchorText, ...shuffle(R, [...body, closing])],
      conclusion: "All of these can be true at once", isValid, meta: o, pos, kind, m,
    };
  }
  return null;
}

if (require.main === module) {
  const N = 2000;
  for (const kind of ["flip", "quarter"]) for (const question of ["chart", "loop"]) {
    let built = 0, agree = 0, flatWrong = 0, localWrong = 0, shown = false;
    for (let seed = 1; seed <= N; seed++) {
      const R = rng(seed * 13 + (kind === "flip" ? 0 : 5) + (question === "loop" ? 1 : 0));
      const it = generate(R, { kind, m: 5, n: 5, question });
      if (!it) continue;
      built++;
      const t = solve(it.premises, it.conclusion, kind, 5);
      if (t === it.isValid) agree++;
      if (verdict("flat", kind, 5, it.premises, it.conclusion) !== t) flatWrong++;
      if (verdict("local", kind, 5, it.premises, it.conclusion) !== t) localWrong++;
      if (!shown && seed > 30) {
        shown = true;
        console.log(`\n--- sample ${kind}/${question} ---`);
        it.premises.forEach(p => console.log("  " + p));
        console.log(`  CLAIM: ${it.conclusion}  -> ${it.isValid}`);
        console.log(`  chart: ${Object.entries(it.pos).map(([w, p]) => `${w}(col ${p.c + 1}; y${p.w[0]} z${p.w[1]})`).join(" ")}`);
        console.log(`  meta: ${JSON.stringify(it.meta)}`);
      }
    }
    console.log(`${kind}/${question}: built ${built}/${N}, solver agrees ${agree}, flat reader wrong ${flatWrong}, step-only-flip reader wrong ${localWrong}`);
  }
}
module.exports = { generate, solve, verdict };
