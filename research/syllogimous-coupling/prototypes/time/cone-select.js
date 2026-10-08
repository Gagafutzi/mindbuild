// Light Cone, select form: "Which of these could X's ring have reached in time?"
// Uses the app's existing `select` answer mode (selectAnswer may be empty).
// Each lure produces its own wrong subset, so one item tests all three.
const C = require("./common");
const { l1, linf, sub } = C;
const CONE = require("./cone");

function generateSelect(seed, n = 6) {
    const R = C.rng(seed);
    for (let attempt = 0; attempt < 5000; attempt++) {
        // Borrow the boolean generator's layout (exact premises) and re-ask it.
        let it; try { it = CONE.generate(seed * 7919 + attempt, { kind: "cone", n }); } catch { continue; }
        const x = Math.floor(R() * n);
        const E = it.edges.map(e => [e.a, e.b]);
        const cands = [...Array(n).keys()].filter(y => y !== x && C.treePath(n, E, x, y).length >= 1);
        const rows = cands.map(y => {
            const d = sub(it.pos[y], it.pos[x]);
            const space = d.slice(0, 3), dt = d[3];
            const route = C.treePath(n, E, x, y).reduce((t, p) => t + l1(it.edges[p.edge].d), 0);
            return { y, truth: dt >= l1(space), perAxis: dt >= linf(space), route: dt >= route, timeOnly: dt >= 0 };
        });
        const set = k => rows.filter(r => r[k]).map(r => r.y).join(",");
        const truth = set("truth");
        // Not empty, not everything; every lure's set differs from the truth.
        if (!truth || rows.every(r => r.truth)) continue;
        if (["perAxis", "route", "timeOnly"].some(k => set(k) === truth)) continue;
        return { ...it, x, rows, question: `Which of these could ${it.names[x]}'s ring have reached by the moment each rang?`,
            choices: rows.map(r => it.names[r.y]), answer: rows.filter(r => r.truth).map(r => it.names[r.y]),
            lureSets: Object.fromEntries(["perAxis", "route", "timeOnly"].map(k => [k, rows.filter(r => r[k]).map(r => it.names[r.y])])) };
    }
    throw new Error("no item");
}

// Independent check, from text only: re-ask the boolean solver once per choice.
function solveSelect(it) {
    return it.choices.filter(y => CONE.solve(it.premises, `${it.names[it.x]}'s ring can have reached ${y} by the moment ${y} rang.`).answer);
}

const it = generateSelect(2);
it.premises.forEach(p => console.log("  - " + p));
console.log("Q:", it.question, "choices:", it.choices.join(", "));
console.log("A:", JSON.stringify(it.answer), " lures:", JSON.stringify(it.lureSets));
console.log("solver:", JSON.stringify(solveSelect(it)));

let agree = 0, total = 0; const sizes = {};
for (let seed = 100; seed < 400; seed++) {
    let s; try { s = generateSelect(seed); } catch { continue; }
    total++;
    if (JSON.stringify(solveSelect(s)) === JSON.stringify(s.answer)) agree++;
    sizes[s.answer.length + "/" + s.choices.length] = (sizes[s.answer.length + "/" + s.choices.length] ?? 0) + 1;
}
console.log(`select: ${agree}/${total} solver-agree; answer sizes:`, JSON.stringify(sizes));
