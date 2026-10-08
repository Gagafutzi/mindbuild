// Triangle inequality on the integer lattice, by enumeration: given d(A,B)=a and
// d(B,C)=b, which d(A,C) are possible? Shows the answer set depends on the
// number of dimensions and on the metric — the budget is shared across axes.
"use strict";
function sphere(dims, r, metric) {
    const out = [];
    const rec = (prefix) => {
        if (prefix.length === dims) {
            const d = metric === "L1" ? prefix.reduce((t, x) => t + Math.abs(x), 0) : Math.max(...prefix.map(Math.abs));
            if (d === r) out.push(prefix);
            return;
        }
        for (let x = -r; x <= r; x++) rec([...prefix, x]);
    };
    rec([]);
    return out;
}
const dist = (v, metric) => (metric === "L1" ? v.reduce((t, x) => t + Math.abs(x), 0) : Math.max(...v.map(Math.abs)));
for (const metric of ["L1", "Linf"]) {
    for (const [a, b] of [[3, 2], [3, 3], [4, 1]]) {
        const row = [];
        for (let dims = 1; dims <= 4; dims++) {
            const S = new Set();
            for (const u of sphere(dims, a, metric)) for (const w of sphere(dims, b, metric)) S.add(dist(u.map((x, i) => x + w[i]), metric));
            row.push(`${dims}D {${[...S].sort((x, y) => x - y).join(",")}}`);
        }
        console.log(`${metric} a=${a} b=${b}: ${row.join("  ")}`);
    }
}
// With a direction constraint: B->C is 2 steps all north; A->B is 3 steps, directions unknown (L1).
for (let dims = 2; dims <= 4; dims++) {
    const S = new Set();
    for (const u of sphere(dims, 3, "L1")) { const w = Array(dims).fill(0); w[1] = 2; S.add(dist(u.map((x, i) => x + w[i]), "L1")); }
    console.log(`L1, A-B 3 any way, B-C 2 north, ${dims}D: d(A,C) in {${[...S].sort((x, y) => x - y).join(",")}}`);
}
