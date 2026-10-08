"use strict";
/*
 * HELIX: a circular axis whose wrap carries into a straight one.
 *
 * Time is a ring of four watches (dawn, noon, dusk, night) and the step after
 * night is the next day's dawn. Underneath it is one integer t; watch = t mod 4,
 * day = floor(t / 4). Premises state every watch step; only SOME premises say
 * which day. A stated day clause is not a free fact about days -- "1 watch later,
 * on the next day" can only be true if the reference is at night -- so stated
 * day clauses pin the absolute phase, and the phase decides where unstated
 * premises carry.
 *
 * generate() builds from the cover; solve() reads only the rendered text.
 */
const { rng, mod, pick, shuffle, WORDS, buildTree, treePath, sign } = require("./lib");

const WATCHES = ["dawn", "noon", "dusk", "night"];
const M = WATCHES.length;
const SPATIAL = [
  { pos: "east", neg: "west", tie: "same longitude" },
  { pos: "north", neg: "south", tie: "same latitude" },
];
const DAY = { "-1": "on the day before", "0": "on the same day", "1": "on the next day" };

function watchClause(k) {
  const n = Math.abs(k);
  return `${n} watch${n === 1 ? "" : "es"} ${k > 0 ? "later" : "earlier"}`;
}

function render(e, T, stated, flip) {
  const [subj, ref, s] = flip ? [e.from, e.to, -1] : [e.to, e.from, 1];
  const cl = SPATIAL.map((ax, i) => {
    const d = s * e.sp[i];
    return d === 0 ? ax.tie : d > 0 ? ax.pos : ax.neg;
  });
  let w = watchClause(s * e.k);
  if (stated) {
    const dd = Math.floor(T[subj] / M) - Math.floor(T[ref] / M);
    w += `, ${DAY[dd]}`;
  }
  cl.push(w);
  return `${subj} is ${cl.join(", ")} relative to ${ref}`;
}

function generate(R, n = 5, kind = "day") {
  for (let attempt = 0; attempt < 200; attempt++) {
    const words = shuffle(R, WORDS).slice(0, n);
    const edges = buildTree(R, words, R() < 0.4);
    const p0 = Math.floor(R() * M);
    for (const e of edges) {
      e.sp = SPATIAL.map(() => (R() < 0.25 ? 0 : R() < 0.5 ? -1 : 1));
      e.k = pick(R, [-2, -1, 1, 2]);
    }
    // Cover coordinate: an unbounded integer, watch and day both read off it.
    const T = { [words[0]]: p0 };
    for (let changed = true; changed;) {
      changed = false;
      for (const e of edges) {
        if (e.from in T && !(e.to in T)) { T[e.to] = T[e.from] + e.k; changed = true; }
        if (e.to in T && !(e.from in T)) { T[e.from] = T[e.to] - e.k; changed = true; }
      }
    }
    const day = (w, p) => Math.floor((T[w] - p0 + p) / M);
    const dDay = (e, p) => day(e.to, p) - day(e.from, p);

    const options = [];
    const E = edges.length;
    for (let mask = 1; mask < (1 << E) - 1; mask++) {
      const S = edges.map((_, i) => !!(mask & (1 << i)));
      const nStated = S.filter(Boolean).length;
      if (nStated > Math.ceil(E / 2)) continue;
      const phases = [];
      for (let p = 0; p < M; p++) if (edges.every((e, i) => !S[i] || dDay(e, p) === dDay(e, p0))) phases.push(p);

      if (kind === "watch") {
        if (phases.length !== 1) continue;
        // Ask about an object no stated clause touches directly, so the phase
        // has to be carried along watch steps to reach it.
        const touched = new Set(edges.flatMap((e, i) => (S[i] ? [e.from, e.to] : [])));
        for (const x of words) if (!touched.has(x)) options.push({ S, phases, x });
        continue;
      }
      for (const a of words) for (const b of words) {
        if (a >= b) continue;
        const path = treePath(edges, a, b);
        if (path.length < 2) continue;
        const truthAt = p => sign(day(b, p) - day(a, p));
        const truth = truthAt(p0);
        if (!phases.every(p => truthAt(p) === truth)) continue;          // determined
        if ([0, 1, 2, 3].every(p => truthAt(p) === truth)) continue;    // day clauses load-bearing
        // Per-axis lure: add up the day clauses that are stated, unstated = same day.
        const lure = sign(path.reduce((t, st) => t + (S[st.i] ? st.s * dDay(edges[st.i], p0) : 0), 0));
        if (lure === truth) continue;
        options.push({ S, phases, a, b, truth, lure });
      }
    }
    if (!options.length) continue;
    const o = pick(R, options);
    const premises = shuffle(R, edges.map((e, i) => render(e, T, o.S[i], R() < 0.5)));
    let conclusion, isValid;
    if (kind === "watch") {
      const truthW = WATCHES[mod(T[o.x], M)];
      isValid = R() < 0.5;
      const claimed = isValid ? truthW : pick(R, WATCHES.filter(w => w !== truthW));
      conclusion = `${o.x} is at ${claimed}`;
    } else {
      const words3 = { "1": "on a later day than", "0": "on the same day as", "-1": "on an earlier day than" };
      isValid = R() < 0.5;
      // The false claim offered is the per-axis lure, so a reader who adds day
      // clauses column-wise is tempted by exactly the claim that is wrong.
      const claimed = isValid ? o.truth : o.lure;
      conclusion = `${o.b} is ${words3[claimed]} ${o.a}`;
    }
    return { premises, conclusion, isValid, truth: { p0, T, phases: o.phases }, meta: o, words, edges };
  }
  return null;
}

/* ---------------- independent solver: reads only the text ---------------- */
function solve(premises, conclusion) {
  const rx = /^(\w+) is (.+) relative to (\w+)$/;
  const facts = premises.map(p => {
    const [, subj, body, ref] = p.match(rx);
    const wm = body.match(/(\d+) watch(?:es)? (later|earlier)(?:, on (the same day|the next day|the day before))?/);
    const k = Number(wm[1]) * (wm[2] === "later" ? 1 : -1);
    const dd = wm[3] == null ? null : { "the same day": 0, "the next day": 1, "the day before": -1 }[wm[3]];
    return { subj, ref, k, dd };
  });
  // Relative watch offsets by propagation.
  const rel = { [facts[0].ref]: 0 };
  for (let changed = true; changed;) {
    changed = false;
    for (const f of facts) {
      if (f.ref in rel && !(f.subj in rel)) { rel[f.subj] = rel[f.ref] + f.k; changed = true; }
      if (f.subj in rel && !(f.ref in rel)) { rel[f.ref] = rel[f.subj] - f.k; changed = true; }
    }
  }
  const worlds = [];
  for (let p = 0; p < 4; p++) {
    const t = w => rel[w] + p;
    const ok = facts.every(f => f.dd == null || Math.floor(t(f.subj) / 4) - Math.floor(t(f.ref) / 4) === f.dd);
    if (ok) worlds.push(t);
  }
  const verdicts = worlds.map(t => {
    let m = conclusion.match(/^(\w+) is at (\w+)$/);
    if (m) return ["dawn", "noon", "dusk", "night"][mod(t(m[1]), 4)] === m[2];
    m = conclusion.match(/^(\w+) is on (a later day than|the same day as|an earlier day than) (\w+)$/);
    const want = { "a later day than": 1, "the same day as": 0, "an earlier day than": -1 }[m[2]];
    return sign(Math.floor(t(m[1]) / 4) - Math.floor(t(m[3]) / 4)) === want;
  });
  if (!verdicts.length) return "inconsistent";
  return verdicts.every(v => v === verdicts[0]) ? verdicts[0] : "undetermined";
}

if (require.main === module) {
  const N = 3000;
  const stats = { day: { built: 0, agree: 0, unique: 0, stated: [] }, watch: { built: 0, agree: 0 } };
  const samples = {};
  for (let seed = 1; seed <= N; seed++) {
    for (const kind of ["day", "watch"]) {
      const R = rng(seed * 7 + (kind === "day" ? 1 : 2));
      const item = generate(R, 5, kind);
      if (!item) continue;
      const s = stats[kind];
      s.built++;
      if (solve(item.premises, item.conclusion) === item.isValid) s.agree++;
      if (kind === "day") {
        if (item.meta.phases.length === 1) s.unique++;
        s.stated.push(item.meta.S.filter(Boolean).length);
      }
      if (!samples[kind] && seed >= 11) samples[kind] = item;
    }
  }
  const avg = xs => (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2);
  console.log(`day items:   built ${stats.day.built}/${N}, solver agrees ${stats.day.agree}, phase pinned uniquely ${stats.day.unique}, mean day clauses stated ${avg(stats.day.stated)} of 4`);
  console.log(`watch items: built ${stats.watch.built}/${N}, solver agrees ${stats.watch.agree}`);
  for (const [kind, it] of Object.entries(samples)) {
    console.log(`\n--- sample (${kind}) ---`);
    it.premises.forEach(p => console.log("  " + p));
    console.log(`  CLAIM: ${it.conclusion}   -> ${it.isValid}`);
    console.log(`  phases consistent: ${it.meta.phases.map(p => WATCHES[p]).join(",")} for ${it.words[0]}; true t: ${JSON.stringify(it.truth.T)}`);
    if (kind === "day") console.log(`  truth sign ${it.meta.truth}, per-axis lure sign ${it.meta.lure}`);
  }
}
module.exports = { generate, solve };
