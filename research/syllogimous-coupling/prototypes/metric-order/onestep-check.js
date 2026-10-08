// Independent re-check: share of composed-space sign claims (diameter pair, random axis)
// that are decided only under the one-step convention, i.e. the path mixes + and - steps
// on the asked axis. Without the convention such a claim is open (Gaussian reader with
// unknown positive magnitudes would find it undetermined).
"use strict";
const L = require("./lib");
L.seed(1);
for (const dims of [2, 4, 6]) for (const branching of [false, true]) {
    let total = 0, mixed = 0;
    for (let i = 0; i < 3000; i++) {
        const words = L.NAMES.slice(0, 6);
        const lay = L.buildLayout(words, dims, { branching });
        const nb = L.neighborsOf(lay.edges);
        let best = [], max = 0;
        for (const a of words) for (const b of words) { if (a >= b) continue; const d = L.graphDistance(a, b, nb); if (d > max) { max = d; best = []; } if (d === max) best.push([a, b]); }
        const [a, b] = L.pick(best);
        const axis = Math.floor(L.R() * dims);
        // walk the tree path a -> b collecting signed steps on axis
        const prev = { [a]: null }; const q = [a];
        while (q.length) { const x = q.shift(); for (const y of nb[x]) if (!(y in prev)) { prev[y] = x; q.push(y); } }
        const steps = []; for (let x = b; prev[x] !== null; x = prev[x]) { const p = prev[x]; const e = lay.edges.find(e => (e.from === p && e.to === x) || (e.from === x && e.to === p)); steps.push((e.from === p ? 1 : -1) * e.deltas[axis]); }
        total++; if (steps.some(s => s > 0) && steps.some(s => s < 0)) mixed++;
    }
    console.log(`${dims}D ${branching ? "branching" : "chain    "}: ${(100 * mixed / total).toFixed(1)}% of sign claims rest on the one-step convention`);
}
