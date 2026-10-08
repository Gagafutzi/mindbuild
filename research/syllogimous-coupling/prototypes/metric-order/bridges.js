// Proposal 1 — Cross-axis bridges.
// One axis is cut in two (a withheld clause, exactly the `indeterminate` machinery),
// and the only thing joining the halves is a premise equating a gap on that axis
// with a gap on ANOTHER axis between other objects:
//   "Fern is as many steps east of Bell as Dune is later than Ash."
// The east answer then needs a time accumulation as an input.
//
// Run: node bridges.js [seed] [count]

"use strict";
const L = require("./lib");

const SEED = Number(process.argv[2] ?? 7);
const COUNT = Number(process.argv[3] ?? 400);

function sign(n) { return n > 0 ? 1 : n < 0 ? -1 : 0; }

function generate(dims = 4, objects = 7, branching = true) {
    for (let attempt = 0; attempt < 200; attempt++) {
        const words = L.shuffle(L.NAMES).slice(0, objects);
        const layout = L.buildLayout(words, dims, { branching });
        const X = Math.floor(L.R() * dims);

        // Cut an edge on X that leaves at least two objects on each side.
        const cuts = L.shuffle(layout.edges.filter(e => e.deltas[X] !== 0));
        let K1 = null, K2 = null;
        for (const e of cuts) {
            e.stated[X] = false;
            const comp = L.axisComponents(layout, X);
            const roots = [...new Set(Object.values(comp))];
            const sides = roots.map(r => words.filter(w => comp[w] === r));
            if (sides.length === 2 && sides.every(s => s.length >= 2)) { [K1, K2] = sides; break; }
            e.stated[X] = true;
        }
        if (!K1) continue;

        const c = layout.coords;
        const nb = L.neighborsOf(layout.edges);

        // Bridge candidates: a cross pair on X of magnitude >= 2 matched by a pair on Y != X
        // at least two premises apart, so the Y gap has to be derived, not read.
        const bridges = [];
        for (const R of K2) for (const B of K1) {
            const d = c[R][X] - c[B][X];
            if (Math.abs(d) < 2) continue;
            for (let Y = 0; Y < dims; Y++) {
                if (Y === X) continue;
                for (const G of words) for (const H of words) {
                    if (G === H) continue;
                    const e = c[G][Y] - c[H][Y];
                    if (e <= 0 || e !== Math.abs(d)) continue;          // state Y positively
                    if (L.graphDistance(G, H, nb) < 2) continue;
                    if (new Set([R, B, G, H]).size < 3) continue;
                    bridges.push({ R, B, X, d, G, H, Y, e });
                }
            }
        }
        if (!bridges.length) continue;

        // Question pairs across the cut, not the bridge pair itself.
        for (const br of L.shuffle(bridges)) {
            for (const P of L.shuffle(K1)) for (const Qn of L.shuffle(K2)) {
                if (P === br.B && Qn === br.R) continue;
                const truth = c[Qn][X] - c[P][X];
                // The bridge read as a single step in its stated direction.
                const unit = truth - br.d + sign(br.d);
                // The bridge read with its direction reversed.
                const flip = truth - 2 * br.d;
                if (sign(truth) === sign(unit)) continue;                 // must discriminate the unit lure
                if (sign(truth) === sign(flip)) continue;
                if (L.graphDistance(P, Qn, nb) < 2) continue;
                return { layout, K1, K2, br, P, Q: Qn, truth, unit, flip, X, attempts: attempt + 1 };
            }
        }
    }
    return null;
}

function render(item) {
    const { layout, br } = item;
    const lines = layout.edges.map(e => L.renderEdge(e, L.R() < 0.5));
    const rel1 = L.AXES[br.X].rel[br.d > 0 ? 0 : 1];
    const rel2 = L.AXES[br.Y].rel[0];
    const bridge = `${br.R} is as many steps ${rel1} ${br.B} as ${br.G} is ${rel2} ${br.H}`;
    return { premises: L.shuffle([...lines, bridge]), bridge };
}

// ---------- run ----------
module.exports = { generate, render };
if (require.main === module) {
L.seed(SEED);
let built = 0, failed = 0, verified = 0, withoutBridgeOpen = 0, attemptsTotal = 0;
let example = null;
for (let i = 0; i < COUNT; i++) {
    const item = generate();
    if (!item) { failed++; continue; }
    built++; attemptsTotal += item.attempts;
    const { premises, bridge } = render(item);
    const X = item.X;
    const qv = new Map([[L.v(item.Q, X), 1], [L.v(item.P, X), -1]]);

    // Independent reader: parse the text, Gaussian-eliminate, query Q - P on X.
    const { sys, ineq } = L.solveText(premises);
    const ans = sys.query(qv);
    if (sys.inconsistent) throw new Error("inconsistent premises");
    if (!ans.determined || ans.value !== item.truth) throw new Error(`solver disagrees: ${JSON.stringify(ans)} vs ${item.truth}`);
    verified++;

    // Mutation check: drop the bridge and the same query must be open ("can't tell" is the lure, not the answer).
    const without = L.solveText(premises.filter(p => p !== bridge)).sys.query(qv);
    if (!without.determined) withoutBridgeOpen++;
    else throw new Error("question answerable without the bridge");

    if (!example && item.layout.words.length === 7) example = { item, premises, bridge };
}

console.log(`built ${built}/${COUNT}, failed ${failed}, mean layout attempts ${(attemptsTotal / built).toFixed(2)}`);
console.log(`independent solver agreed on ${verified}; open without the bridge on ${withoutBridgeOpen}`);

if (example) {
    const { item, premises } = example;
    const ax = L.AXES[item.X];
    const word = n => (n === 0 ? `level (${ax.tie})` : `${Math.abs(n)} step${Math.abs(n) > 1 ? "s" : ""} ${n > 0 ? ax.pos : ax.neg}`);
    console.log("\n--- worked example ---");
    console.log("Note: each ordinary premise is one step on every dimension it names; a dimension a premise does not name is unknown.");
    premises.forEach((p, i) => console.log(`${i + 1}. ${p}.`));
    console.log(`\nQ: Where is ${item.Q} relative to ${item.P} on ${ax.pos}/${ax.neg}?`);
    console.log(`Answer: ${word(item.truth)}`);
    console.log(`Lure, can't tell (per-axis connectivity: no ${ax.pos}/${ax.neg} path joins them)`);
    console.log(`Lure, bridge read as one step: ${word(item.unit)}`);
    console.log(`Lure, bridge direction reversed: ${word(item.flip)}`);
    const c = item.layout.coords;
    console.log("\ncoords:", Object.fromEntries(item.layout.words.map(w => [w, c[w].join(",")])));
    console.log("cut sides on", ax.id, item.K1, item.K2, "bridge", item.br);
}
}
