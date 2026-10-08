// How often does a plain composed-space sign claim already depend on magnitude?
//
// The engine accumulates -1/0/+1 per edge. A sign claim about a pair whose path
// mixes + and - steps on the asked axis ("Bell is east of Ash, Cole is west of
// Bell" -> Ash vs Cole) is only decided if each premise is worth one step. The
// ONE_STEP_NOTE is stated only on construct-distance items. This measures the
// share of plain sign claims that silently rely on it, because every metric
// proposal below needs that convention stated and the existing items need it too.
import { rng, buildLayout, pathEdges, NAMES, makeTools } from "./nd.mjs";

for (const dims of [2, 4, 6]) {
    for (const branching of [false, true]) {
        let total = 0, mixed = 0, mixedSameClaim = 0;
        for (let seed = 1; seed <= 4000; seed++) {
            const r = rng(seed * 7919 + dims);
            const { pick } = makeTools(r);
            const words = NAMES.slice(0, 6);
            const L = buildLayout(r, words, dims, { branching });
            // diameter pair, as pickDistantPair(slack 0)
            let best = [], max = 0;
            for (let i = 0; i < words.length; i++) for (let j = i + 1; j < words.length; j++) {
                const len = pathEdges(L, words[i], words[j]).length;
                if (len > max) { max = len; best = []; }
                if (len === max) best.push([words[i], words[j]]);
            }
            const [a, b] = pick(best);
            const axis = Math.floor(r() * dims);
            const steps = pathEdges(L, b, a).map(s => s.sign * L.edges[s.idx].deltas[axis]);
            total++;
            if (steps.some(s => s > 0) && steps.some(s => s < 0)) {
                mixed++;
                if (steps.reduce((x, y) => x + y, 0) === 0) mixedSameClaim++;
            }
        }
        console.log(`${dims}D ${branching ? "branching" : "chain    "}: ${(100 * mixed / total).toFixed(1)}% of sign claims sit on a mixed-sign path`
            + ` (${(100 * mixedSameClaim / total).toFixed(1)}% have truth "same", decided only by equal steps)`);
    }
}
