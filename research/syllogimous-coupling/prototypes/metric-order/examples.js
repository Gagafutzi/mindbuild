// Picks small, readable worked examples for the write-up and re-verifies each
// one with the text-only reader (Gaussian elimination over the rendered premises).
"use strict";
const L = require("./lib");
const B = require("./bridges");
const W = require("./walking");
const M = require("./metric");

const word = (axis, n) => (n === 0 ? L.AXES[axis].tie : `${Math.abs(n)} step${Math.abs(n) > 1 ? "s" : ""} ${n > 0 ? L.AXES[axis].pos : L.AXES[axis].neg}`);

L.seed(Number(process.argv[2] ?? 4));

// --- bridge: east bridged from time, 6 premises in 4D ---
for (let i = 0; i < 5000; i++) {
    const it = B.generate(4, 6, true);
    if (!it || it.X !== 0 || it.br.Y !== 3) continue;
    const { premises, bridge } = B.render(it);
    const q = new Map([[L.v(it.Q, it.X), 1], [L.v(it.P, it.X), -1]]);
    const a = L.solveText(premises).sys.query(q);
    const open = L.solveText(premises.filter(p => p !== bridge)).sys.query(q);
    if (!a.determined || a.value !== it.truth || open.determined) throw new Error("bridge example fails");
    console.log("=== BRIDGE (Space 4D, 6 premises) ===");
    premises.forEach((p, k) => console.log(`${k + 1}. ${p}.`));
    console.log(`Q: Where is ${it.Q} relative to ${it.P}, east or west?`);
    console.log(`A: ${word(0, it.truth)} | lures: one-step bridge -> ${word(0, it.unit)}; reversed bridge -> ${word(0, it.flip)}; per-axis connectivity -> can't tell`);
    console.log("coords", JSON.stringify(Object.fromEntries(it.layout.words.map(w => [w, it.layout.coords[w]]))));
    break;
}

// --- walk total: 6 premises in 4D ---
for (let i = 0; i < 5000; i++) {
    const it = W.generateA(4, 6);
    if (!it) continue;
    const { premises, walk } = W.renderA(it);
    const q = new Map([[L.v(it.C, it.X), 1], [L.v(it.A, it.X), -1]]);
    const a = L.solveText(premises).sys.query(q);
    const open = L.solveText(premises.filter(p => p !== walk)).sys.query(q);
    if (!a.determined || a.value !== it.truth || open.determined) throw new Error("walk example fails");
    if (it.truth === 0) continue;
    console.log("\n=== WALK TOTAL (Space 4D, 6 premises) ===");
    premises.forEach((p, k) => console.log(`${k + 1}. ${p}.`));
    console.log(`Q: Where is ${it.C} relative to ${it.A} on ${L.AXES[it.X].pos}/${L.AXES[it.X].neg}?`);
    console.log(`A: ${word(it.X, it.truth)} | lures: named legs read as one step -> ${word(it.X, it.unit)}; total read as this axis's gap -> ${word(it.X, it.whole)}; walk premise read as an ordinary one-step premise -> ${word(it.X, it.plain)}; can't tell`);
    console.log("coords", JSON.stringify(Object.fromEntries(it.layout.words.map(w => [w, it.layout.coords[w]]))), "gap", JSON.stringify(it.gap), "total", it.total);
    break;
}

// --- nearest on foot, every lure decided and wrong, 5 premises in 4D ---
const l1 = (a, b) => a.reduce((t, v, i) => t + Math.abs(v - b[i]), 0);
for (let i = 0; i < 5000; i++) {
    const r = M.nearest(4, 6);
    if (!r || Object.values(r.lures).some(x => !x)) continue;
    if (new Set(Object.values(r.lures)).size < 2) continue;
    const premises = L.shuffle(r.lay.edges.map(e => L.renderEdge(e, L.R() < 0.5)));
    const { sys } = L.solveText(premises);
    const vec = w => [0, 1, 2, 3].map(k => sys.query(new Map([[L.v(w, k), 1], [L.v(r.A, k), -1]])).value);
    console.log("\n=== NEAREST ON FOOT (Space 4D, 5 premises) ===");
    premises.forEach((p, k) => console.log(`${k + 1}. ${p}.`));
    console.log(`Q: Counting every step on every dimension, which is nearest to ${r.A}: ${r.cands.join(", ")}?`);
    for (const w of r.cands) {
        const d = vec(w);
        console.log(`  ${w}: gap ${JSON.stringify(d)} L1=${d.reduce((t, x) => t + Math.abs(x), 0)} Linf=${Math.max(...d.map(Math.abs))} dims-differing=${d.filter(x => x).length} premises=${L.graphDistance(r.A, w, L.neighborsOf(r.lay.edges))}`);
    }
    console.log(`A: ${r.ans} | lures: fewest dimensions differ -> ${r.lures.hamming}; shortest longest-leg -> ${r.lures.linf}; fewest premises -> ${r.lures.premises}`);
    break;
}
