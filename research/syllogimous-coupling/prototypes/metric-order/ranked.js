// Proposal 3 — Ranked lists: lexicographic premises whose meaning on one axis
// depends on the value of another.
//
//   "The list runs in order of time; things at the same time are listed lowest first."
//   "Ash is listed before Dune."
//
// If Ash and Dune turn out to be at the same time, that premise says Ash is lower.
// If Ash is earlier, it says nothing about height at all. Which case holds is
// only known once the time axis has been carried — so the up axis cannot be
// solved on its own, and the same sentence carries information in one item and
// none in the next.
//
// The up axis is cut (one withheld clause) so the ranking premises are its only
// bridge. One ranking premise is informative (time tie), one is idle (time
// differs, and its height reading is FALSE). The question is answered by bound
// propagation; the independent reader solves time by Gaussian elimination and
// height by difference constraints (Floyd-Warshall), from the text alone.
//
// Run: node ranked.js [seed] [count]

"use strict";
const L = require("./lib");
const SEED = Number(process.argv[2] ?? 13);
const COUNT = Number(process.argv[3] ?? 400);
const UP = 2, T = 3;

/** Bounds on x[q] - x[p] from equalities and x[j]-x[i] >= w constraints. */
function bounds(words, eqs, geqs, p, q) {
    const n = words.length, id = new Map(words.map((w, i) => [w, i]));
    const INF = Infinity;
    const D = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 0 : INF)));
    // x_j - x_i <= c  ->  edge i->j weight c
    const le = (i, j, c) => { if (c < D[i][j]) D[i][j] = c; };
    for (const { a, b, d } of eqs) { le(id.get(a), id.get(b), d); le(id.get(b), id.get(a), -d); }   // x_b - x_a = d
    for (const { a, b, w } of geqs) le(id.get(b), id.get(a), -w);                                       // x_b - x_a >= w  <=>  x_a - x_b <= -w
    for (let k = 0; k < n; k++) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++)
        if (D[i][k] + D[k][j] < D[i][j]) D[i][j] = D[i][k] + D[k][j];
    if (words.some((_, i) => D[i][i] < 0)) return { inconsistent: true };
    const hi = D[id.get(p)][id.get(q)];               // max(x_q - x_p)
    const lo = -D[id.get(q)][id.get(p)];              // min(x_q - x_p)
    return { lo, hi };
}

const verdict = b => (b.inconsistent ? "contradiction" : b.lo >= 1 ? "above" : b.hi <= -1 ? "below" : b.lo === 0 && b.hi === 0 ? "level" : "can't tell");

function generate(dims = 4, objects = 7) {
    for (let attempt = 0; attempt < 500; attempt++) {
        const words = L.shuffle(L.NAMES).slice(0, objects);
        const lay = L.buildLayout(words, dims, { branching: true });
        const c = lay.coords, nb = L.neighborsOf(lay.edges);
        // cut the up axis once, both sides >= 2
        let sides = null;
        for (const e of L.shuffle(lay.edges.filter(e => e.deltas[UP] !== 0))) {
            e.stated[UP] = false;
            const comp = L.axisComponents(lay, UP);
            const roots = [...new Set(Object.values(comp))];
            const s = roots.map(r => words.filter(w => comp[w] === r));
            if (s.length === 2 && s.every(x => x.length >= 2)) { sides = s; break; }
            e.stated[UP] = true;
        }
        if (!sides) continue;
        const across = (a, b) => sides[0].includes(a) !== sides[0].includes(b);
        const pairs = [];
        for (const a of words) for (const b of words) if (a !== b && across(a, b) && L.graphDistance(a, b, nb) >= 2) pairs.push([a, b]);
        const informative = pairs.filter(([a, b]) => c[a][T] === c[b][T] && c[a][UP] < c[b][UP]);
        const idle = pairs.filter(([a, b]) => c[b][T] - c[a][T] === 1 && c[a][UP] > c[b][UP]);
        if (!informative.length || !idle.length) continue;
        const [A, B] = L.pick(informative), [Cc, Dd] = L.pick(idle);
        if (new Set([A, B, Cc, Dd]).size < 4) continue;

        // height equalities within the stated clauses (the solver recomputes these from text)
        const eqs = lay.edges.filter(e => e.stated[UP]).map(e => ({ a: e.from, b: e.to, d: e.deltas[UP] }));
        for (const P of L.shuffle(words)) for (const Q of L.shuffle(words)) {
            if (P === Q || !across(P, Q) || L.graphDistance(P, Q, nb) < 2) continue;
            if (new Set([P, Q]).size === new Set([P, Q, A, B]).size - 2 && ((P === A && Q === B) || (P === B && Q === A))) continue;
            const truth = verdict(bounds(words, eqs, [{ a: A, b: B, w: 1 }], P, Q));
            if (truth !== "above" && truth !== "below") continue;
            const misread = verdict(bounds(words, eqs, [{ a: A, b: B, w: 1 }, { a: Cc, b: Dd, w: 1 }], P, Q));
            const ignored = verdict(bounds(words, eqs, [], P, Q));
            const idleOnly = verdict(bounds(words, eqs, [{ a: Cc, b: Dd, w: 1 }], P, Q));
            if (misread === truth || ignored !== "can't tell") continue;
            // the item is strongest when reading the idle premise as height gives the opposite answer outright
            const opposite = truth === "above" ? "below" : "above";
            if (idleOnly !== opposite && misread !== "contradiction" && misread !== opposite) continue;
            return { lay, sides, A, B, C: Cc, D: Dd, P, Q, truth, misread, ignored, idleOnly };
        }
    }
    return null;
}

/* ---------- independent reader ---------- */
function solveFromText(premises, words, P, Q) {
    const lexRe = /^(\w+) is listed before (\w+)$/;
    const plain = premises.filter(p => !lexRe.test(p));
    const { sys } = L.solveText(plain);
    const eqs = [], geqs = [];
    // height equalities: any pair whose up-difference the plain premises fix, read off one premise at a time
    for (const p of plain) {
        const m = /^(\w+) is (.+) relative to (\w+)$/.exec(p);
        const cl = m[2].split(/, | and /);
        for (const x of cl) {
            if (x === "above") eqs.push({ a: m[3], b: m[1], d: 1 });
            if (x === "below") eqs.push({ a: m[3], b: m[1], d: -1 });
            if (x === "same height") eqs.push({ a: m[3], b: m[1], d: 0 });
        }
    }
    for (const p of premises.filter(p => lexRe.test(p))) {
        const [, a, b] = lexRe.exec(p);
        const dt = sys.query(new Map([[L.v(b, T), 1], [L.v(a, T), -1]]));
        if (!dt.determined) throw new Error("time not determined for a ranking premise");
        if (dt.value < 0) throw new Error("ranking premise contradicts time");
        if (dt.value === 0) geqs.push({ a, b, w: 1 });       // same time: a is lower
        // dt > 0: listed first because earlier; says nothing about height
    }
    return verdict(bounds(words, eqs, geqs, P, Q));
}

module.exports = { generate };
if (require.main === module) {
    L.seed(SEED);
    let built = 0, agreed = 0, ex = null;
    for (let i = 0; i < COUNT; i++) {
        const it = generate();
        if (!it) continue;
        built++;
        const premises = L.shuffle([
            ...it.lay.edges.map(e => L.renderEdge(e, L.R() < 0.5)),
            `${it.A} is listed before ${it.B}`,
            `${it.C} is listed before ${it.D}`,
        ]);
        const v = solveFromText(premises, it.lay.words, it.P, it.Q);
        if (v !== it.truth) throw new Error(`reader says ${v}, generator ${it.truth}`);
        // mutation: without the informative ranking the reader must find the question open
        const without = solveFromText(premises.filter(p => p !== `${it.A} is listed before ${it.B}`), it.lay.words, it.P, it.Q);
        if (without !== "can't tell") throw new Error("answerable without the informative ranking: " + without);
        // mutation: drop the idle ranking and the answer must not change (it carries no height)
        const noIdle = solveFromText(premises.filter(p => p !== `${it.C} is listed before ${it.D}`), it.lay.words, it.P, it.Q);
        if (noIdle !== it.truth) throw new Error("the idle ranking changed the answer");
        agreed++;
        if (!ex || it.lay.words.length < ex.it.lay.words.length) ex = { it, premises };
    }
    console.log(`ranked: built ${built}/${COUNT}, independent reader agreed ${agreed}`);
    const { it, premises } = ex;
    console.log("\nNote: the list runs in order of time; things at the same time are listed lowest first. A dimension a premise does not name is unknown.");
    premises.forEach((p, i) => console.log(`${i + 1}. ${p}.`));
    console.log(`Q: Where is ${it.Q} relative to ${it.P}, above or below?`);
    console.log(`Answer: ${it.truth}`);
    console.log(`Lure, both rankings read as height: ${it.misread}; the idle one alone read as height: ${it.idleOnly}; rankings ignored: ${it.ignored}`);
    console.log(`informative: ${it.A} before ${it.B} (same time); idle: ${it.C} before ${it.D} (earlier by 1, but higher)`);
    console.log("coords", Object.fromEntries(it.lay.words.map(w => [w, it.lay.coords[w].join(",")])));
}
