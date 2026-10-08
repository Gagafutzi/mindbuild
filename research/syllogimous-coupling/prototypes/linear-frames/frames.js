"use strict";
/*
 * Proposal A: turned frames — per-object orientation in B_n, the n-dimensional
 * facing rung.
 *
 * Some objects are TURNED: each carries an element of the hyperoctahedral
 * group (a signed permutation of the axes). A premise spoken "by Ash's
 * reckoning" uses the world's words in Ash's own axes: if Ash is turned a
 * quarter from east toward later, Ash's "east" is our later and Ash's "later"
 * is our west. The question is asked in a third object's reckoning.
 *
 *   rung `frames`           frames stated against ours ("turned a quarter from
 *                           east toward later")
 *   rung `relative-frames`  frames stated against another object's own axes
 *                           ("turned as Ash is, then a further quarter from its
 *                           own north toward its own above") — intrinsic
 *                           composition g_A ∘ R, which does not commute with the
 *                           extrinsic reading R ∘ g_A
 *
 * Run:  node frames.js            (worked examples + 3000-item sweep)
 */
const C = require("./common");

/* ---- B_n: body axis i points along world axis p[i] with sign s[i] ---- */
const ident = n => ({ p: [...Array(n).keys()], s: Array(n).fill(1) });
const apply = (g, d) => { const w = Array(d.length).fill(0); d.forEach((v, i) => { w[g.p[i]] += g.s[i] * v; }); return w.map(v => v || 0); };
const inverse = g => { const h = { p: [], s: [] }; g.p.forEach((pi, i) => { h.p[pi] = i; h.s[pi] = g.s[i]; }); return h; };
/** (g ∘ h)(d) = g(h(d)). */
const compose = (g, h) => ({ p: h.p.map(j => g.p[j]), s: h.s.map((sj, i) => sj * g.s[h.p[i]]) });
const sameG = (g, h) => C.eq(g.p, h.p) && C.eq(g.s, h.s);
/** Determinant: sign of the permutation times the product of signs (handedness). */
function det(g) {
    let parity = 1; const seen = new Set();
    for (let i = 0; i < g.p.length; i++) {
        if (seen.has(i)) continue;
        let len = 0; for (let j = i; !seen.has(j); j = g.p[j]) { seen.add(j); len++; }
        if (len % 2 === 0) parity = -parity;
    }
    return parity * g.s.reduce((a, b) => a * b, 1);
}
/** A quarter turn from (a, sa) toward (b, sb): body sa·e_a ↦ sb·e_b, body sb·e_b ↦ −sa·e_a. */
function quarter(n, a, sa, b, sb) {
    const g = ident(n);
    g.p[a] = b; g.s[a] = sa * sb;
    g.p[b] = a; g.s[b] = -sa * sb;
    return g;
}

const word = (axes, a, s) => (s > 0 ? axes[a].dir[0] : axes[a].dir[1]);

/**
 * One item. Returns null when the drawn frames do not bite (the answer would be
 * the same read literally), which is the generator's analogue of `axisBites`.
 */
function generate(r, { n = 4, objects = 6, turned = 2, relative = false } = {}) {
    const axes = C.axesFor(n);
    const words = C.NAMES.slice(0, objects);
    const edges = C.tree(r, words);
    const world = edges.map(() => C.unitDelta(r, n));
    const coords = C.walk(words[0], n, edges.map(([f, t], i) => [f, t, world[i]]));

    /* Frames: `turned` objects, each a quarter turn; under `relative`, the
       second and later are stated against an earlier one's own axes. */
    const who = r.shuffle(words).slice(0, turned);
    const frame = Object.fromEntries(words.map(w => [w, ident(n)]));
    const extrinsic = { ...frame };         // the order lure, rung 2 only
    const framePremises = [];
    const randomTurn = () => {
        const a = r.int(0, n - 1); let b; do { b = r.int(0, n - 1); } while (b === a);
        return { a, b, sb: r.coin() ? 1 : -1 };
    };
    who.forEach((w, k) => {
        const t = randomTurn();
        const R = quarter(n, t.a, 1, t.b, t.sb);
        if (relative && k > 0) {
            const base = who[k - 1];
            frame[w] = compose(frame[base], R);          // turned about its OWN axes
            extrinsic[w] = compose(R, frame[base]);      // the lure: about ours
            framePremises.push(`${w} is turned as ${base} is, then a further quarter from its own ${word(axes, t.a, 1)} toward its own ${word(axes, t.b, t.sb)}.`);
        } else {
            frame[w] = R; extrinsic[w] = R;
            framePremises.push(`${w} is turned a quarter from ${word(axes, t.a, 1)} toward ${word(axes, t.b, t.sb)}.`);
        }
    });
    const isTurned = w => who.includes(w);

    /* Relations: a turned endpoint reckons in its own axes. */
    const relPremises = [];
    const spoken = [];   // [speaker|null, subject, ref, stated] — what the reader sees
    edges.forEach(([f, t], i) => {
        const cands = [f, t].filter(isTurned);
        const speaker = cands.length ? r.pick(cands) : null;
        // The speaker is the reference object; plain premises flip at random.
        const ref = speaker ?? (r.coin() ? f : t);
        const subj = ref === f ? t : f;
        const d = C.sub(coords[subj], coords[ref]);
        const stated = speaker ? apply(inverse(frame[speaker]), d) : d;
        spoken.push([speaker, subj, ref, stated]);
        relPremises.push(speaker
            ? `By ${speaker}'s reckoning, ${subj} is ${C.clauses(axes, stated)} relative to ${speaker}.`
            : `${subj} is ${C.clauses(axes, stated)} relative to ${ref}.`);
    });

    /* Question: the far pair, read by a turned viewer. */
    let [x, y] = C.farPair(r, words, edges);
    // The viewer is one end of the pair when it can be: "where is Cole, by Fay's
    // reckoning" is the egocentric question; a third party is the fallback.
    const ends = [x, y].filter(isTurned);
    const viewer = ends.length ? r.pick(ends) : r.pick(who);
    if (viewer === y) [x, y] = [y, x];
    const D = C.sub(coords[y], coords[x]);
    const truth = apply(inverse(frame[viewer]), D).map(C.sign);

    /* Lures, each computed the way that reader would compute it. */
    const walkWith = toWorld => {
        const c = C.walk(words[0], n, spoken.map(([sp, s, rf, st]) => [rf, s, toWorld(sp, st)]));
        return C.sub(c[y], c[x]);
    };
    const literalD = walkWith((sp, st) => st);
    const inverseD = walkWith((sp, st) => (sp ? apply(inverse(frame[sp]), st) : st));
    const lures = {
        literal: literalD.map(C.sign),                                  // every column carried as stated
        "viewer only": apply(inverse(frame[viewer]), literalD).map(C.sign),
        "our frame": D.map(C.sign),                                     // converted the premises, not the answer
        inverse: apply(frame[viewer], inverseD).map(C.sign),            // g for g⁻¹ throughout
    };
    if (relative) {
        const extD = walkWith((sp, st) => (sp ? apply(extrinsic[sp], st) : st));
        lures["outer order"] = apply(inverse(extrinsic[viewer]), extD).map(C.sign);
    }

    /* Bites: the habitual answers must all be wrong. */
    const required = ["literal", "our frame", ...(relative ? ["outer order"] : [])];
    if (required.some(k => C.eq(lures[k], truth))) return null;
    if (relative && who.slice(1).every(w => sameG(frame[w], extrinsic[w]))) return null;

    const question = `By ${viewer}'s reckoning, how does ${y} stand to ${x}?`;
    return {
        axes, words, n, framePremises, relPremises: r.shuffle(relPremises), question,
        truth, lures, viewer, x, y, frames: who.map(w => [w, frame[w], det(frame[w])]),
        depth: C.graphDist(edges, x, y),
        derivation: spoken.map(([sp, s, rf, st]) => `${s} - ${rf}: stated [${st}]` + (sp ? ` in ${sp}'s axes -> ours [${apply(frame[sp], st)}]` : ` (ours)`)),
        worldD: D,
    };
}

/* ---- Independent reader: parses the TEXT, uses explicit integer matrices. ---- */
function solveFromText(axes, lines, question) {
    const n = axes.length;
    const find = w => { for (let i = 0; i < n; i++) { if (axes[i].dir[0] === w) return [i, 1]; if (axes[i].dir[1] === w) return [i, -1]; } throw new Error("word " + w); };
    const I = () => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => +(i === j)));
    const mul = (A, B) => A.map((row, i) => B[0].map((_, j) => row.reduce((s, v, k) => s + v * B[k][j], 0)));
    const mv = (A, v) => A.map(row => row.reduce((s, x, k) => s + x * v[k], 0));
    const T = A => A[0].map((_, j) => A.map(row => row[j]));   // orthogonal: inverse = transpose
    // A quarter turn as a matrix built from first principles: rotate the plane
    // spanned by unit vectors u (from) and w (toward): u -> w, w -> -u.
    const turn = (from, toward) => {
        const [a, sa] = find(from), [b, sb] = find(toward);
        const M = I(); M[a][a] = 0; M[b][b] = 0;
        // column a (image of e_a): sa*(image of sa e_a) = sa*sb e_b
        M[b][a] = sa * sb; M[a][b] = -sa * sb;
        return M;
    };
    const M = {};
    const links = [];
    for (const line of lines) {
        let m;
        if ((m = /^(\w+) is turned a quarter from (\w+) toward (\w+)\.$/.exec(line))) M[m[1]] = turn(m[2], m[3]);
        else if ((m = /^(\w+) is turned as (\w+) is, then a further quarter from its own (\w+) toward its own (\w+)\.$/.exec(line))) M[m[1]] = mul(M[m[2]], turn(m[3], m[4]));
        else if ((m = /^By (\w+)'s reckoning, (\w+) is (.+) relative to (\w+)\.$/.exec(line))) links.push([m[4], m[2], mv(M[m[1]], C.parseClauses(axes, m[3]))]);
        else if ((m = /^(\w+) is (.+) relative to (\w+)\.$/.exec(line))) links.push([m[3], m[1], C.parseClauses(axes, m[2])]);
        else throw new Error("unparsed: " + line);
    }
    const q = /^By (\w+)'s reckoning, how does (\w+) stand to (\w+)\?$/.exec(question);
    const coords = C.walk(links[0][0], n, links);
    return mv(T(M[q[1]]), C.sub(coords[q[2]], coords[q[3]])).map(C.sign);
}

function show(item) {
    console.log("Setup: Some objects are TURNED. A turned object reckons with the usual words, but along its own axes.");
    console.log("Premises:");
    [...item.framePremises, ...item.relPremises].forEach(l => console.log("  " + l));
    console.log("Question: " + item.question);
    console.log("Answer:   " + C.clauses(item.axes, item.truth));
    for (const [k, v] of Object.entries(item.lures)) {
        console.log(`  lure ${k.padEnd(12)} ${C.clauses(item.axes, v)}${C.eq(v, item.truth) ? "   (= answer, does not bite here)" : ""}`);
    }
    console.log("  frames: " + item.frames.map(([w, g, d]) => `${w} p=[${g.p}] s=[${g.s}] det=${d}`).join("; "));
    console.log("  depth (premises between the pair): " + item.depth);
    console.log("  derivation:"); item.derivation.forEach(l => console.log("    " + l));
    console.log(`  ${item.y} - ${item.x} in our axes: [${item.worldD}] -> in ${item.viewer}'s axes: [${apply(inverse(item.frames.find(f => f[0] === item.viewer)[1]), item.worldD)}]`);
}

function sweep(label, opts, count = 3000) {
    let built = 0, tries = 0, agree = 0; const differs = {}; let depth = 0;
    const r = C.rng(12345 + opts.n * 7 + (opts.relative ? 1 : 0));
    while (built < count) {
        tries++;
        const it = generate(r, opts);
        if (!it) continue;
        built++; depth += it.depth;
        const solved = solveFromText(it.axes, [...it.framePremises, ...it.relPremises], it.question);
        if (C.eq(solved, it.truth)) agree++;
        for (const [k, v] of Object.entries(it.lures)) differs[k] = (differs[k] ?? 0) + (C.eq(v, it.truth) ? 0 : 1);
    }
    console.log(`${label}: ${built} items from ${tries} draws (${(100 * built / tries).toFixed(0)}% kept); independent text solver agrees on ${agree}/${built}; mean depth ${(depth / built).toFixed(2)}`);
    console.log("   lure differs from answer: " + Object.entries(differs).map(([k, v]) => `${k} ${(100 * v / built).toFixed(0)}%`).join(", "));
}

if (require.main === module) {
    // Non-commutativity check that the relative rung relies on.
    const a = quarter(4, 0, 1, 3, 1), b = quarter(4, 1, 1, 2, 1), c = quarter(4, 3, 1, 1, 1);
    console.log("XT∘YZ == YZ∘XT ?", sameG(compose(a, b), compose(b, a)), " (disjoint planes commute)");
    console.log("XT∘TY == TY∘XT ?", sameG(compose(a, c), compose(c, a)), " (shared axis: they do not)");
    console.log("det of a quarter turn:", det(a), "; of a single-axis mirror:", det({ p: [0, 1, 2, 3], s: [-1, 1, 1, 1] }));
    console.log();

    console.log("=== Worked example, rung `frames` (4D, two turned objects) ===");
    let r = C.rng(+(process.env.SEED1 ?? 20261008)), it = null;
    while (!it) it = generate(r, { n: 4, turned: 2 });
    show(it);
    console.log();
    console.log("=== Worked example, rung `relative-frames` (4D) ===");
    r = C.rng(+(process.env.SEED2 ?? 777)); it = null;
    while (!it) it = generate(r, { n: 4, turned: 2, relative: true });
    show(it);
    console.log();
    sweep("frames 4D, 2 turned", { n: 4, turned: 2 });
    sweep("frames 5D, 2 turned", { n: 5, turned: 2 });
    sweep("frames 4D, 3 turned", { n: 4, turned: 3 });
    sweep("relative 4D, 2 turned", { n: 4, turned: 2, relative: true });
    sweep("relative 5D, 3 turned", { n: 5, turned: 3, relative: true, objects: 7 });
}

module.exports = { generate, solveFromText, quarter, compose, inverse, apply, det };
