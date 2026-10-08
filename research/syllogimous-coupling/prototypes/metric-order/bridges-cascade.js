// Proposal 1, second turn of the dial: two bridges in series.
// X is cut and bridged from Y; Y is ALSO cut, and the Y gap the first bridge
// needs is only reachable through a second bridge from Z. So the order of work
// is forced across three axes: Z, then Y, then X.
//
// Also measures how small an item the one-bridge form can be built at.
//
// Run: node bridges-cascade.js [seed] [count]

"use strict";
const L = require("./lib");
const SEED = Number(process.argv[2] ?? 5);
const COUNT = Number(process.argv[3] ?? 300);
const sign = n => (n > 0 ? 1 : n < 0 ? -1 : 0);

function cutAxis(layout, X, avoid = new Set()) {
    const words = layout.words;
    for (const e of L.shuffle(layout.edges.filter(e => e.deltas[X] !== 0 && !avoid.has(e)))) {
        e.stated[X] = false;
        const comp = L.axisComponents(layout, X);
        const roots = [...new Set(Object.values(comp))];
        const sides = roots.map(r => words.filter(w => comp[w] === r));
        if (sides.length === 2 && sides.every(s => s.length >= 2)) return { edge: e, sides };
        e.stated[X] = true;
    }
    return null;
}

function across(sides, a, b) { return sides[0].includes(a) !== sides[0].includes(b); }

function generate(dims = 4, objects = 8) {
    for (let attempt = 0; attempt < 400; attempt++) {
        const words = L.shuffle(L.NAMES).slice(0, objects);
        const layout = L.buildLayout(words, dims, { branching: true });
        const [X, Y, Z] = L.shuffle([...Array(dims).keys()]);
        const cx = cutAxis(layout, X); if (!cx) continue;
        const cy = cutAxis(layout, Y, new Set([cx.edge])); if (!cy) continue;
        const c = layout.coords, nb = L.neighborsOf(layout.edges);

        // bridge 2: a Y gap across the Y cut, matched by a Z gap (Z is whole)
        const b2s = [];
        for (const R of words) for (const B of words) {
            if (!across(cy.sides, R, B)) continue;
            const d = c[R][Y] - c[B][Y]; if (d <= 0) continue;
            for (const G of words) for (const H of words) {
                if (G === H || c[G][Z] - c[H][Z] !== d || L.graphDistance(G, H, nb) < 2) continue;
                b2s.push({ R, B, X: Y, d, G, H, Y: Z });
            }
        }
        // bridge 1: an X gap across the X cut (|d| >= 2), matched by a Y gap that is ALSO across the Y cut
        const b1s = [];
        for (const R of words) for (const B of words) {
            if (!across(cx.sides, R, B)) continue;
            const d = c[R][X] - c[B][X]; if (Math.abs(d) < 2) continue;
            for (const G of words) for (const H of words) {
                if (G === H || !across(cy.sides, G, H)) continue;
                if (c[G][Y] - c[H][Y] !== Math.abs(d)) continue;
                b1s.push({ R, B, X, d, G, H, Y });
            }
        }
        if (!b1s.length || !b2s.length) continue;
        const b1 = L.pick(b1s), b2 = L.pick(b2s);
        for (const P of L.shuffle(words)) for (const Qn of L.shuffle(words)) {
            if (!across(cx.sides, P, Qn) || (P === b1.B && Qn === b1.R) || (P === b1.R && Qn === b1.B)) continue;
            const truth = c[Qn][X] - c[P][X];
            const sideOfQ = cx.sides[0].includes(Qn) === cx.sides[0].includes(b1.R) ? 1 : -1;
            const unit = truth + sideOfQ * (sign(b1.d) - b1.d);
            if (sign(unit) === sign(truth)) continue;
            return { layout, b1, b2, P, Q: Qn, X, truth, unit, attempts: attempt + 1 };
        }
    }
    return null;
}

const bridgeText = br => `${br.R} is as many steps ${L.AXES[br.X].rel[br.d > 0 ? 0 : 1]} ${br.B} as ${br.G} is ${L.AXES[br.Y].rel[0]} ${br.H}`;

L.seed(SEED);
module.exports = { generate, bridgeText };
if (require.main === module) {
let built = 0, ok = 0, ex = null, att = 0;
for (let i = 0; i < COUNT; i++) {
    const it = generate();
    if (!it) continue;
    built++; att += it.attempts;
    const premises = L.shuffle([...it.layout.edges.map(e => L.renderEdge(e, L.R() < 0.5)), bridgeText(it.b1), bridgeText(it.b2)]);
    const q = new Map([[L.v(it.Q, it.X), 1], [L.v(it.P, it.X), -1]]);
    const full = L.solveText(premises).sys.query(q);
    if (!full.determined || full.value !== it.truth) throw new Error("cascade: solver disagrees");
    const no2 = L.solveText(premises.filter(p => p !== bridgeText(it.b2))).sys.query(q);
    const no1 = L.solveText(premises.filter(p => p !== bridgeText(it.b1))).sys.query(q);
    if (no2.determined || no1.determined) throw new Error("cascade: answerable with one bridge missing");
    ok++;
    ex ??= { it, premises };
}
console.log(`cascade (8 objects, 4D): built ${built}/${COUNT}, mean attempts ${(att / built).toFixed(1)}, solver agreed + each bridge necessary on ${ok}`);
if (ex) {
    const { it, premises } = ex;
    const ax = L.AXES[it.X];
    const w = n => (n === 0 ? ax.tie : `${Math.abs(n)} ${n > 0 ? ax.pos : ax.neg}`);
    premises.forEach((p, i) => console.log(`${i + 1}. ${p}.`));
    console.log(`Q: ${it.Q} relative to ${it.P} on ${ax.pos}/${ax.neg}? Answer ${w(it.truth)}; unit-step lure ${w(it.unit)}`);
}

// ---- how small can the one-bridge form be? (reuse bridges.js logic inline) ----

}
