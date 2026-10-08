// Proposal 3 — metric and order questions over the existing layouts.
//
//  (a) "Nearest on foot": which candidate is fewest steps from the anchor, counting
//      every step on every dimension (L1)? Built so that every other way of
//      measuring that a per-axis reader might use names a different object:
//      fewest dimensions differing (Hamming), longest single leg (L-inf), fewest
//      premises between (graph distance).
//  (b) Cross-axis magnitude claim: "Fern is further east of Bell than Dune is later
//      than Ash" — measured against the premise-count lure.
//  (c) Pareto front and lexicographic order — measured only, to see whether they
//      earn a place (see the summary printed at the end).
//
// Run: node metric.js [seed] [count]

"use strict";
const L = require("./lib");
const SEED = Number(process.argv[2] ?? 3);
const COUNT = Number(process.argv[3] ?? 2000);

const l1 = (a, b) => a.reduce((t, v, i) => t + Math.abs(v - b[i]), 0);
const linf = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
const ham = (a, b) => a.filter((v, i) => v !== b[i]).length;
const argminUnique = (xs, f) => {
    const vals = xs.map(f); const m = Math.min(...vals);
    return vals.filter(v => v === m).length === 1 ? xs[vals.indexOf(m)] : null;
};

/* ---------------- (a) nearest on foot ---------------- */
function nearest(dims = 4, objects = 7) {
    for (let attempt = 0; attempt < 60; attempt++) {
        const words = L.shuffle(L.NAMES).slice(0, objects);
        const lay = L.buildLayout(words, dims, { branching: true });
        const nb = L.neighborsOf(lay.edges), c = lay.coords;
        for (const A of L.shuffle(words)) {
            const pool = words.filter(w => w !== A && L.graphDistance(A, w, nb) >= 2);
            if (pool.length < 3) continue;
            for (let t = 0; t < 10; t++) {
                const cands = L.shuffle(pool).slice(0, 3);
                const ans = argminUnique(cands, w => l1(c[A], c[w]));
                if (!ans) continue;
                const lures = {
                    hamming: argminUnique(cands, w => ham(c[A], c[w])),
                    linf: argminUnique(cands, w => linf(c[A], c[w])),
                    premises: argminUnique(cands, w => L.graphDistance(A, w, nb)),
                };
                // every lure must point elsewhere or be undecided; at least two must point at a wrong object
                if (Object.values(lures).some(x => x === ans)) continue;
                if (Object.values(lures).filter(Boolean).length < 2) continue;
                return { lay, A, cands, ans, lures, attempts: attempt + 1 };
            }
        }
    }
    return null;
}

/* ---------------- (b) cross-axis magnitude claim ---------------- */
function crossClaim(dims = 4, objects = 7) {
    for (let attempt = 0; attempt < 60; attempt++) {
        const words = L.shuffle(L.NAMES).slice(0, objects);
        const lay = L.buildLayout(words, dims, { branching: true });
        const nb = L.neighborsOf(lay.edges), c = lay.coords;
        for (let t = 0; t < 40; t++) {
            const [P, Qn, G, H] = L.shuffle(words).slice(0, 4);
            const X = Math.floor(L.R() * dims);
            let Y; do { Y = Math.floor(L.R() * dims); } while (Y === X);
            const dx = c[Qn][X] - c[P][X], dy = c[G][Y] - c[H][Y];
            if (dx <= 0 || dy <= 0 || dx === dy) continue;
            const gx = L.graphDistance(P, Qn, nb), gy = L.graphDistance(G, H, nb);
            if (gx < 2 || gy < 2) continue;
            // premise-count lure must say the opposite
            if (Math.sign(gx - gy) !== -Math.sign(dx - dy)) continue;
            return { lay, P, Q: Qn, G, H, X, Y, dx, dy, gx, gy };
        }
    }
    return null;
}

/* ---------------- (c) Pareto / lexicographic, measured ---------------- */
function paretoStats(dims, objects, n = 2000) {
    let frontSizes = [], maxSumAlone = 0, lexDiffers = 0;
    for (let i = 0; i < n; i++) {
        const words = L.shuffle(L.NAMES).slice(0, objects);
        const lay = L.buildLayout(words, dims, { branching: true });
        const c = lay.coords;
        const dominates = (a, b) => c[a].every((v, k) => v >= c[b][k]) && c[a].some((v, k) => v > c[b][k]);
        const front = words.filter(w => !words.some(o => o !== w && dominates(o, w)));
        frontSizes.push(front.length);
        const sum = w => c[w].reduce((t, v) => t + v, 0);
        const best = Math.max(...words.map(sum));
        if (front.length === 1 && words.filter(w => sum(w) === best).length === 1) maxSumAlone++;
        // lexicographic (axis 0, then 1) top vs top on axis 0 alone, when axis 0 ties at the top
        const top0 = Math.max(...words.map(w => c[w][0]));
        if (words.filter(w => c[w][0] === top0).length > 1) lexDiffers++;
    }
    const mean = frontSizes.reduce((a, b) => a + b, 0) / n;
    return { mean: mean.toFixed(2), objects, dims, frontOfAll: (frontSizes.filter(s => s === objects).length / n).toFixed(2), singleFrontEqualsMaxSum: (maxSumAlone / n).toFixed(2), lexTieAtTop: (lexDiffers / n).toFixed(2) };
}

/* ---------------- run ---------------- */
module.exports = { nearest, crossClaim };
if (require.main === module) {
L.seed(SEED);
let built = 0, ex = null, att = 0;
for (let i = 0; i < COUNT; i++) {
    const r = nearest();
    if (!r) continue;
    built++; att += r.attempts;
    // independent check from text: parse premises, solve every candidate's vector, recompute metrics
    const premises = r.lay.edges.map(e => L.renderEdge(e, L.R() < 0.5));
    const { sys } = L.solveText(premises);
    const vec = w => [...Array(4).keys()].map(k => sys.query(new Map([[L.v(w, k), 1], [L.v(r.A, k), -1]])).value);
    const dists = r.cands.map(w => vec(w).reduce((t, x) => t + Math.abs(x), 0));
    const m = Math.min(...dists);
    if (dists.filter(d => d === m).length !== 1 || r.cands[dists.indexOf(m)] !== r.ans) throw new Error("nearest: solver disagrees");
    if (!ex) ex = { r, premises };
}
console.log(`(a) nearest-on-foot: built ${built}/${COUNT}, mean layout attempts ${(att / built).toFixed(2)}; solver agreed on all`);
if (ex) {
    const { r, premises } = ex;
    const c = r.lay.coords, nb = L.neighborsOf(r.lay.edges);
    console.log("\n--- (a) worked example ---");
    console.log(L.shuffle(premises).map((p, i) => `${i + 1}. ${p}.`).join("\n"));
    console.log(`Q: Counting every step on every dimension, which is nearest to ${r.A}: ${r.cands.join(", ")}?`);
    for (const w of r.cands) {
        const d = c[w].map((v, i) => v - c[r.A][i]);
        console.log(`  ${w}: gap ${JSON.stringify(d)}  L1=${l1(c[w], c[r.A])} Linf=${linf(c[w], c[r.A])} dims-differing=${ham(c[w], c[r.A])} premises=${L.graphDistance(r.A, w, nb)}`);
    }
    console.log(`Answer: ${r.ans}; lures:`, r.lures);
}

let builtB = 0, exB = null;
for (let i = 0; i < 500; i++) { const r = crossClaim(); if (r) { builtB++; exB ??= r; } }
console.log(`\n(b) cross-axis claim with premise-count lure reversed: built ${builtB}/500`);
if (exB) {
    const r = exB;
    const premises = L.shuffle(r.lay.edges.map(e => L.renderEdge(e, L.R() < 0.5)));
    console.log(premises.map((p, i) => `${i + 1}. ${p}.`).join("\n"));
    const claim = `${r.Q} is further ${L.AXES[r.X].rel[0]} ${r.P} than ${r.G} is ${L.AXES[r.Y].rel[0]} ${r.H}`;
    console.log(`Claim: ${claim}. -> ${r.dx > r.dy} (gaps ${r.dx} vs ${r.dy}; premises between ${r.gx} vs ${r.gy})`);
    const { sys } = L.solveText(premises);
    const dx = sys.query(new Map([[L.v(r.Q, r.X), 1], [L.v(r.P, r.X), -1]])).value;
    const dy = sys.query(new Map([[L.v(r.G, r.Y), 1], [L.v(r.H, r.Y), -1]])).value;
    if (dx !== r.dx || dy !== r.dy) throw new Error("cross claim: solver disagrees");
}

console.log("\n(c) Pareto front / lexicographic over ordinary layouts:");
for (const [d, o] of [[3, 6], [4, 6], [4, 7], [6, 7]]) console.log(paretoStats(d, o));
}
