// Proposal 2 — Walking totals: one step budget shared across dimensions.
//
// Form A (exact): a premise gives a pair's directions on every axis and ONE
// total, "Dune is east, south, above and later relative to Bell, 6 steps in all".
// One axis is cut (withheld clause), so its gap is only reachable as
// total - (sum of |gap| on the others), each of which is its own chain.
//
// Form B (open): a premise gives a total and the directions it was spent in but
// not the split, "Bell is 3 steps from Ash, each step east or north". The set of
// possible arrangements is then NOT a product of per-axis ranges, so a claim can
// be possible on each axis separately and impossible jointly.
//
// Run: node walking.js [seed] [count]

"use strict";
const L = require("./lib");
const SEED = Number(process.argv[2] ?? 11);
const COUNT = Number(process.argv[3] ?? 400);
const sign = n => (n > 0 ? 1 : n < 0 ? -1 : 0);

/* ------------------------------ Form A ------------------------------ */

function generateA(dims = 4, objects = 7) {
    for (let attempt = 0; attempt < 300; attempt++) {
        const words = L.shuffle(L.NAMES).slice(0, objects);
        const layout = L.buildLayout(words, dims, { branching: true });
        const X = Math.floor(L.R() * dims);
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
        const c = layout.coords, nb = L.neighborsOf(layout.edges);

        for (const P of L.shuffle(K1)) for (const Qn of L.shuffle(K2)) {
            if (L.graphDistance(P, Qn, nb) < 2) continue;
            const gap = c[Qn].map((v, i) => v - c[P][i]);
            const others = gap.filter((_, i) => i !== X);
            const total = gap.reduce((t, g) => t + Math.abs(g), 0);
            const named = others.filter(g => g !== 0).length;
            if (others.reduce((t, g) => t + Math.abs(g), 0) <= named) continue;   // some other leg must be > 1
            if (gap[X] === 0) continue;
            for (const A of L.shuffle(K1)) for (const C of L.shuffle(K2)) {
                if (A === P && C === Qn) continue;
                const truth = c[C][X] - c[A][X];
                const unitGap = sign(gap[X]) * (total - named);          // every named leg read as one step
                const unit = truth - gap[X] + unitGap;
                const whole = truth - gap[X] + sign(gap[X]) * total;     // total read as the cut axis's gap
                const plain = truth - gap[X] + sign(gap[X]);             // walk premise read as an ordinary one-step premise
                const set = new Set([truth, unit, whole, plain]);
                if (set.size < 4) continue;
                if (L.graphDistance(A, C, nb) < 2) continue;
                return { layout, X, P, Q: Qn, gap, total, A, C, truth, unit, whole, plain };
            }
        }
    }
    return null;
}

function renderA(item) {
    const { layout, P, Q, gap, total } = item;
    const lines = layout.edges.map(e => L.renderEdge(e, L.R() < 0.5));
    const cs = gap.map((g, i) => L.clause(i, g));
    const walk = `${Q} is ${L.joinClauses(cs)} relative to ${P}, ${total} steps in all`;
    return { premises: L.shuffle([...lines, walk]), walk };
}

/* ------------------------------ Form B ------------------------------ */

// Directly: Ash at origin; Bell = Ash + split of N over two named directions;
// then a unit-step chain onwards. Possibility claims about a far pair.
function generateB(dims = 4) {
    for (let attempt = 0; attempt < 500; attempt++) {
        const words = L.shuffle(L.NAMES).slice(0, 5);
        const [A, B, ...rest] = words;
        const N = 3 + Math.floor(L.R() * 2);                    // 3 or 4 steps
        const axes = L.shuffle([...Array(dims).keys()]).slice(0, 2).sort();
        const signs = axes.map(() => L.pick([-1, 1]));
        // chain B -> rest, unit steps
        const edges = [];
        let prev = B;
        for (const w of rest) {
            let d; do { d = Array.from({ length: dims }, () => (L.R() < 0.22 ? 0 : L.pick([-1, 1]))); } while (d.every(x => x === 0));
            edges.push({ from: prev, to: w, deltas: d, stated: d.map(() => true) });
            prev = w;
        }
        const far = rest[rest.length - 1];
        // offset of far from B
        const off = Array(dims).fill(0);
        for (const e of edges) e.deltas.forEach((d, i) => { off[i] += d; });
        // possible far - A vectors: split k on axes[0], N-k on axes[1]
        const outcomes = [];
        for (let k = 0; k <= N; k++) {
            const v = Array(dims).fill(0);
            v[axes[0]] = signs[0] * k; v[axes[1]] = signs[1] * (N - k);
            outcomes.push(v.map((x, i) => x + off[i]));
        }
        // Look for a joint claim on the two budget axes that is possible per axis but impossible jointly.
        const rels = [-1, 0, 1];
        const claims = [];
        for (const r0 of rels) for (const r1 of rels) {
            const per0 = outcomes.some(o => sign(o[axes[0]]) === r0);
            const per1 = outcomes.some(o => sign(o[axes[1]]) === r1);
            const joint = outcomes.some(o => sign(o[axes[0]]) === r0 && sign(o[axes[1]]) === r1);
            claims.push({ r0, r1, per0, per1, joint });
        }
        const trap = claims.filter(cl => cl.per0 && cl.per1 && !cl.joint);
        const fine = claims.filter(cl => cl.joint);
        if (!trap.length || fine.length < 2) continue;
        // Also want the per-axis possibility to be non-trivial (each axis has >1 possible sign).
        const signs0 = new Set(outcomes.map(o => sign(o[axes[0]])));
        const signs1 = new Set(outcomes.map(o => sign(o[axes[1]])));
        if (signs0.size < 2 || signs1.size < 2) continue;
        return { A, B, rest, far, N, axes, signs, edges, outcomes, trap, fine, dims };
    }
    return null;
}

function renderB(item) {
    const { A, B, N, axes, signs, edges, dims } = item;
    const d0 = signs[0] > 0 ? L.AXES[axes[0]].pos : L.AXES[axes[0]].neg;
    const d1 = signs[1] > 0 ? L.AXES[axes[1]].pos : L.AXES[axes[1]].neg;
    const level = [...Array(dims).keys()].filter(i => !axes.includes(i)).map(i => L.AXES[i].tie);
    const budget = `${B} is ${N} steps from ${A}, each step ${d0} or ${d1} (${L.joinClauses(level)})`;
    const lines = edges.map(e => L.renderEdge(e, L.R() < 0.5));
    return { premises: [budget, ...lines], budget };
}

/** Independent reader for form B: enumerate the split the budget premise leaves open. */
function possibleOutcomesFromText(premises, A, far, dims) {
    const budgetRe = /^(\w+) is (\d+) steps from (\w+), each step (\w+) or (\w+) \((.+)\)$/;
    const WORD = {};
    L.AXES.forEach((a, i) => { WORD[a.pos] = [i, 1]; WORD[a.neg] = [i, -1]; WORD[a.tie] = [i, 0]; });
    const b = premises.map(p => budgetRe.exec(p)).find(Boolean);
    const [, to, Ns, from, w0, w1, levels] = b;
    const [ax0, s0] = WORD[w0], [ax1, s1] = WORD[w1];
    const others = premises.filter(p => !budgetRe.test(p));
    const out = [];
    for (let k = 0; k <= Number(Ns); k++) {
        const extra = [];
        const steps = Array(dims).fill(null);
        steps[ax0] = s0 * k; steps[ax1] = s1 * (Number(Ns) - k);
        for (const lv of levels.split(/, | and /)) steps[WORD[lv][0]] = 0;
        // encode the budget leg as linear rows directly
        const rows = steps.map((d, i) => ({ coef: new Map([[L.v(to, i), 1], [L.v(from, i), -1]]), rhs: d }));
        const parsed = others.map(p => {
            const m = /^(\w+) is (.+) relative to (\w+)$/.exec(p);
            return m[2].split(/, | and /).map(cl => {
                const [ax, s] = WORD[cl];
                return { coef: new Map([[L.v(m[1], ax), 1], [L.v(m[3], ax), -1]]), rhs: s };
            });
        }).flat();
        const sys = L.makeSystem([...rows, ...parsed]);
        const vec = [...Array(dims).keys()].map(i => sys.query(new Map([[L.v(far, i), 1], [L.v(A, i), -1]])));
        if (vec.some(x => !x.determined)) throw new Error("not determined under a fixed split");
        out.push(vec.map(x => x.value));
    }
    return out;
}

/* ------------------------------ run ------------------------------ */
module.exports = { generateA, renderA, generateB, renderB, possibleOutcomesFromText };
if (require.main === module) {

L.seed(SEED);
let builtA = 0, verifiedA = 0, openA = 0, exA = null;
for (let i = 0; i < COUNT; i++) {
    const item = generateA();
    if (!item) continue;
    builtA++;
    const { premises, walk } = renderA(item);
    const q = new Map([[L.v(item.C, item.X), 1], [L.v(item.A, item.X), -1]]);
    const { sys, ineq } = L.solveText(premises);
    const ans = sys.query(q);
    if (!ans.determined || ans.value !== item.truth) throw new Error("form A solver disagrees");
    // stated directions in the walk premise must hold in the solution
    for (const iq of ineq) {
        const r = sys.query(new Map([[L.v(iq.to, iq.axis), 1], [L.v(iq.from, iq.axis), -1]]));
        if (r.determined && sign(r.value) !== iq.s) throw new Error("walk premise direction violated");
    }
    verifiedA++;
    const w = L.solveText(premises.filter(p => p !== walk)).sys.query(q);
    if (!w.determined) openA++; else throw new Error("answerable without the walk total");
    if (!exA) exA = { item, premises };
}
console.log(`Form A: built ${builtA}/${COUNT}, solver agreed ${verifiedA}, open without the total ${openA}`);

let builtB = 0, verifiedB = 0, exB = null;
for (let i = 0; i < COUNT; i++) {
    const item = generateB();
    if (!item) continue;
    builtB++;
    const { premises } = renderB(item);
    const outs = possibleOutcomesFromText(premises, item.A, item.far, item.dims);
    const key = o => o.join(",");
    const genKeys = new Set(item.outcomes.map(key));
    if (outs.length !== genKeys.size || !outs.every(o => genKeys.has(key(o)))) throw new Error("form B outcome sets differ");
    for (const t of item.trap) {
        const joint = outs.some(o => sign(o[item.axes[0]]) === t.r0 && sign(o[item.axes[1]]) === t.r1);
        if (joint) throw new Error("trap claim is actually possible");
    }
    verifiedB++;
    if (!exB) exB = { item, premises, outs };
}
console.log(`Form B: built ${builtB}/${COUNT}, solver agreed ${verifiedB}`);

const word = (axis, n) => (n === 0 ? L.AXES[axis].tie : `${Math.abs(n)} step${Math.abs(n) > 1 ? "s" : ""} ${n > 0 ? L.AXES[axis].pos : L.AXES[axis].neg}`);

if (exA) {
    const { item, premises } = exA;
    console.log("\n--- Form A worked example ---");
    console.log("Note: an ordinary premise is one step on every dimension it names; an unnamed dimension is unknown. 'N steps in all' counts every step on every dimension, whichever way.");
    premises.forEach((p, i) => console.log(`${i + 1}. ${p}.`));
    console.log(`Q: Where is ${item.C} relative to ${item.A} on ${L.AXES[item.X].pos}/${L.AXES[item.X].neg}?`);
    console.log(`Answer: ${word(item.X, item.truth)}`);
    console.log(`Lure, every named leg of the total read as one step: ${word(item.X, item.unit)}`);
    console.log(`Lure, the total read as the cut axis's own gap: ${word(item.X, item.whole)}`);
    console.log(`Lure, can't tell (no ${L.AXES[item.X].id} path across the cut)`);
    console.log("coords", Object.fromEntries(item.layout.words.map(w => [w, item.layout.coords[w].join(",")])), "gap", item.gap, "total", item.total);
}
if (exB) {
    const { item, premises, outs } = exB;
    console.log("\n--- Form B worked example ---");
    premises.forEach((p, i) => console.log(`${i + 1}. ${p}.`));
    const [a0, a1] = item.axes;
    const fmt = (ax, r) => (r === 0 ? L.AXES[ax].tie : r > 0 ? L.AXES[ax].rel[0] : L.AXES[ax].rel[1]);
    console.log(`Possible ${item.far} - ${item.A} vectors (one per split):`, outs.map(o => `(${o.join(",")})`).join(" "));
    for (const t of item.trap) console.log(`TRAP (each half possible, jointly impossible): could ${item.far} be ${fmt(a0, t.r0)} and ${fmt(a1, t.r1)} ${item.A}? -> No`);
    for (const t of item.fine) console.log(`possible: ${item.far} ${fmt(a0, t.r0)} / ${fmt(a1, t.r1)} ${item.A}`);
}
}
