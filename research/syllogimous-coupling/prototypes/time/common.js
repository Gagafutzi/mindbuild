// Shared bits for the time-coupling prototypes. Plain node, no build.
// Mirrors the shape of ndspace.utils (a tree of unit-step premises) closely
// enough that the prototypes say something about the real engine.

function rng(seed) {
    // mulberry32: deterministic so worked examples can be regenerated.
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const WORDS = ["Ash", "Bell", "Cane", "Dune", "Elm", "Fern", "Gale", "Hive", "Iris", "Jade"];

const SPATIAL = [
    { id: "east", pos: "east", neg: "west", tie: "same longitude" },
    { id: "north", pos: "north", neg: "south", tie: "same latitude" },
    { id: "up", pos: "above", neg: "below", tie: "same height" },
];

const pickFrom = (R, xs) => xs[Math.floor(R() * xs.length)];
const sign = n => (n > 0 ? 1 : n < 0 ? -1 : 0);
const mod = (n, m) => ((n % m) + m) % m;
const l1 = v => v.reduce((t, x) => t + Math.abs(x), 0);
const linf = v => v.reduce((t, x) => Math.max(t, Math.abs(x)), 0);
const sub = (a, b) => a.map((x, i) => x - b[i]);
const add = (a, b) => a.map((x, i) => x + b[i]);

/** Tree over n objects: each new one hangs off a random earlier one (branching) or the last (chain). */
function tree(R, n, branching) {
    const edges = [];
    for (let i = 1; i < n; i++) {
        const from = branching ? Math.floor(R() * i) : i - 1;
        edges.push([from, i]);
    }
    return edges;
}

/** Unit step on each of `d` axes, never all zero (as buildNdLayout does). */
function unitStep(R, d, tieChance = 0.22) {
    let v;
    do { v = Array.from({ length: d }, () => (R() < tieChance ? 0 : (R() < 0.5 ? 1 : -1))); }
    while (v.every(x => x === 0));
    return v;
}

/** The path of edge indices between two nodes in a tree, with orientation. */
function treePath(n, edges, a, b) {
    const adj = Array.from({ length: n }, () => []);
    edges.forEach(([u, v], i) => { adj[u].push([v, i, 1]); adj[v].push([u, i, -1]); });
    const prev = Array(n).fill(null);
    const seen = new Set([a]);
    const q = [a];
    while (q.length) {
        const u = q.shift();
        for (const [v, i, s] of adj[u]) if (!seen.has(v)) { seen.add(v); prev[v] = [u, i, s]; q.push(v); }
    }
    const out = [];
    for (let x = b; x !== a; x = prev[x][0]) out.unshift({ edge: prev[x][1], sign: prev[x][2] });
    return out;
}

function spatialClauses(axes, delta) {
    return axes.map((ax, i) => delta[i] === 0 ? ax.tie : delta[i] > 0 ? ax.pos : ax.neg);
}

module.exports = {
    rng, WORDS, SPATIAL, pickFrom, sign, mod, l1, linf, sub, add, tree, unitStep, treePath, spatialClauses,
};
