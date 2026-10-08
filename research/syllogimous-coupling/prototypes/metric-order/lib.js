// Shared pieces for the metric/order coupling prototypes.
// A minimal port of the composed-space engine (unit steps per axis per edge,
// chain or branching tree), plain-text rendering in the app's wording, and an
// INDEPENDENT solver that reads only the rendered sentences and decides
// determinacy by exact Gaussian elimination over the rationals.

"use strict";

// ---------- seeded RNG ----------
function mulberry32(a) {
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
let rnd = Math.random;
const seed = s => { rnd = mulberry32(s); };
const R = () => rnd();
const pick = xs => xs[Math.floor(R() * xs.length)];
const shuffle = xs => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ---------- axes (wording copied from linear.utils SPATIAL_SCALES/LINEAR_SCALES) ----------
const AXES = [
    { id: "east", pos: "east", neg: "west", tie: "same longitude", rel: ["east of", "west of"] },
    { id: "north", pos: "north", neg: "south", tie: "same latitude", rel: ["north of", "south of"] },
    { id: "up", pos: "above", neg: "below", tie: "same height", rel: ["above", "below"] },
    { id: "temporal", pos: "later", neg: "earlier", tie: "same time", rel: ["later than", "earlier than"] },
];

const NAMES = ["Ash", "Bell", "Cork", "Dune", "Elm", "Fern", "Gale", "Hale", "Iris", "Jade"];

// ---------- layout ----------
function buildChain(words) {
    const edges = [];
    for (let i = 0; i < words.length - 1; i++) edges.push([words[i], words[i + 1]]);
    return edges;
}
function buildBranching(words) {
    const edges = [];
    const deg = { [words[0]]: 0 };
    for (let i = 1; i < words.length; i++) {
        const cands = Object.keys(deg).filter(w => deg[w] < 3);
        const src = pick(cands);
        edges.push(R() < 0.5 ? [src, words[i]] : [words[i], src]);
        deg[src]++; deg[words[i]] = 1;
    }
    return edges;
}

function buildLayout(words, dims, { branching = false, tieChance = 0.22 } = {}) {
    const shape = branching ? buildBranching(words) : buildChain(words);
    const edges = shape.map(([from, to]) => {
        let deltas;
        do { deltas = Array.from({ length: dims }, () => (R() < tieChance ? 0 : pick([-1, 1]))); }
        while (deltas.every(d => d === 0));
        return { from, to, deltas, stated: deltas.map(() => true) };
    });
    return { words, dims, edges, coords: coordsFromEdges(words, dims, edges) };
}

function coordsFromEdges(words, dims, edges) {
    const coords = { [words[0]]: Array(dims).fill(0) };
    const adj = {};
    for (const e of edges) {
        (adj[e.from] ??= []).push({ o: e.to, d: e.deltas, s: 1 });
        (adj[e.to] ??= []).push({ o: e.from, d: e.deltas, s: -1 });
    }
    const q = [words[0]];
    while (q.length) {
        const c = q.shift();
        for (const st of adj[c] ?? []) {
            if (coords[st.o]) continue;
            coords[st.o] = coords[c].map((v, i) => v + st.s * st.d[i]);
            q.push(st.o);
        }
    }
    return coords;
}

const neighborsOf = edges => {
    const n = {};
    for (const e of edges) { (n[e.from] ??= []).push(e.to); (n[e.to] ??= []).push(e.from); }
    return n;
};
function graphDistance(a, b, nb) {
    if (a === b) return 0;
    const seen = new Set([a]); let layer = [a], d = 0;
    while (layer.length) {
        d++; const next = [];
        for (const x of layer) for (const y of nb[x] ?? []) {
            if (seen.has(y)) continue; if (y === b) return d; seen.add(y); next.push(y);
        }
        layer = next;
    }
    return Infinity;
}

/** Components on one axis using only clauses that mention it (determinedOn's rule). */
function axisComponents(layout, axis) {
    const parent = {};
    const find = x => (parent[x] === x ? x : (parent[x] = find(parent[x])));
    for (const w of layout.words) parent[w] = w;
    for (const e of layout.edges) if (e.stated[axis]) parent[find(e.from)] = find(e.to);
    const comp = {};
    for (const w of layout.words) comp[w] = find(w);
    return comp;
}

// ---------- rendering ----------
function clause(axis, d) { return d === 0 ? AXES[axis].tie : d > 0 ? AXES[axis].pos : AXES[axis].neg; }
function joinClauses(cs) { return cs.length <= 1 ? cs.join("") : cs.slice(0, -1).join(", ") + " and " + cs[cs.length - 1]; }

function renderEdge(e, flip) {
    const [from, to] = flip ? [e.to, e.from] : [e.from, e.to];
    const s = flip ? -1 : 1;
    const cs = e.deltas.map((d, i) => ({ i, d: s * d })).filter(c => e.stated[c.i]).map(c => clause(c.i, c.d));
    return `${to} is ${joinClauses(cs)} relative to ${from}`;
}

// ---------- exact rationals ----------
const gcd = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a; };
class Q {
    constructor(n, d = 1n) { n = BigInt(n); d = BigInt(d); if (d < 0n) { n = -n; d = -d; } const g = gcd(n, d) || 1n; this.n = n / g; this.d = d / g; }
    add(o) { return new Q(this.n * o.d + o.n * this.d, this.d * o.d); }
    sub(o) { return new Q(this.n * o.d - o.n * this.d, this.d * o.d); }
    mul(o) { return new Q(this.n * o.n, this.d * o.d); }
    div(o) { return new Q(this.n * o.d, this.d * o.n); }
    isZero() { return this.n === 0n; }
    toNumber() { return Number(this.n) / Number(this.d); }
}
const Z = new Q(0);

/**
 * Linear system over variables "Name#axis". rows: {coef: Map var->number, rhs:number}
 * Returns a function that decides whether a query (Map var->coef) is determined, and its value.
 */
function makeSystem(rows) {
    const vars = [...new Set(rows.flatMap(r => [...r.coef.keys()]))];
    const idx = new Map(vars.map((v, i) => [v, i]));
    let M = rows.map(r => {
        const a = Array(vars.length + 1).fill(Z);
        for (const [v, c] of r.coef) a[idx.get(v)] = a[idx.get(v)].add(new Q(c));
        a[vars.length] = new Q(r.rhs);
        return a;
    });
    // RREF
    const pivots = [];
    let row = 0;
    for (let col = 0; col < vars.length && row < M.length; col++) {
        let p = -1;
        for (let r = row; r < M.length; r++) if (!M[r][col].isZero()) { p = r; break; }
        if (p < 0) continue;
        [M[row], M[p]] = [M[p], M[row]];
        const inv = M[row][col];
        M[row] = M[row].map(x => x.div(inv));
        for (let r = 0; r < M.length; r++) {
            if (r === row || M[r][col].isZero()) continue;
            const f = M[r][col];
            M[r] = M[r].map((x, j) => x.sub(f.mul(M[row][j])));
        }
        pivots.push({ row, col }); row++;
    }
    // inconsistency check: a zero row with nonzero rhs
    const inconsistent = M.some(r => r.slice(0, vars.length).every(x => x.isZero()) && !r[vars.length].isZero());
    function query(qcoef) {
        const q = Array(vars.length).fill(Z);
        for (const [v, c] of qcoef) {
            if (!idx.has(v)) return { determined: false };
            q[idx.get(v)] = q[idx.get(v)].add(new Q(c));
        }
        let val = Z;
        for (const { row: r, col } of pivots) {
            if (q[col].isZero()) continue;
            const f = q[col];
            for (let j = 0; j < vars.length; j++) q[j] = q[j].sub(f.mul(M[r][j]));
            val = val.add(f.mul(M[r][vars.length]));
        }
        return q.every(x => x.isZero()) ? { determined: true, value: val.toNumber() } : { determined: false };
    }
    return { query, inconsistent, vars };
}

// ---------- parsing rendered premises (the independent reader) ----------
const WORD = {};
AXES.forEach((a, i) => { WORD[a.pos] = [i, 1]; WORD[a.neg] = [i, -1]; WORD[a.tie] = [i, 0]; });
const REL = {};
AXES.forEach((a, i) => { REL[a.rel[0]] = [i, 1]; REL[a.rel[1]] = [i, -1]; });
const v = (name, axis) => `${name}#${axis}`;

function splitClauses(s) { return s.split(/, | and /).map(x => x.trim()).filter(Boolean); }

/** Returns {rows, inequalities} from one rendered premise, or null if not understood. */
function parsePremise(text) {
    let m;
    // walking total with directions: "Q is east, north and later relative to P, 6 steps in all"
    if ((m = /^(\w+) is (.+) relative to (\w+), (\d+) steps in all$/.exec(text))) {
        const [, to, body, from, total] = m;
        const rows = [], ineq = [], terms = new Map();
        for (const c of splitClauses(body)) {
            const [axis, s] = WORD[c];
            if (s === 0) rows.push({ coef: new Map([[v(to, axis), 1], [v(from, axis), -1]]), rhs: 0 });
            else {
                ineq.push({ to, from, axis, s });
                terms.set(v(to, axis), (terms.get(v(to, axis)) ?? 0) + s);
                terms.set(v(from, axis), (terms.get(v(from, axis)) ?? 0) - s);
            }
        }
        rows.push({ coef: terms, rhs: Number(total) });
        return { rows, ineq };
    }
    // bridge: "R is as many steps east of B as G is later than H"
    if ((m = /^(\w+) is as many steps (.+?) (\w+) as (\w+) is (.+?) (\w+)$/.exec(text))) {
        const [, r, rel1, b, g, rel2, h] = m;
        const [ax1, s1] = REL[rel1], [ax2, s2] = REL[rel2];
        // s1*(r - b) on ax1 == s2*(g - h) on ax2, and both positive
        const coef = new Map();
        const add = (k, c) => coef.set(k, (coef.get(k) ?? 0) + c);
        add(v(r, ax1), s1); add(v(b, ax1), -s1); add(v(g, ax2), -s2); add(v(h, ax2), s2);
        return { rows: [{ coef, rhs: 0 }], ineq: [{ to: g, from: h, axis: ax2, s: s2 }] };
    }
    // ordinary premise: "Q is east, same latitude and later relative to P" (one step per named axis)
    if ((m = /^(\w+) is (.+) relative to (\w+)$/.exec(text))) {
        const [, to, body, from] = m;
        const rows = [];
        for (const c of splitClauses(body)) {
            const [axis, s] = WORD[c];
            rows.push({ coef: new Map([[v(to, axis), 1], [v(from, axis), -1]]), rhs: s });
        }
        return { rows, ineq: [] };
    }
    return null;
}

function solveText(premises) {
    const rows = [], ineq = [];
    for (const p of premises) {
        const r = parsePremise(p);
        if (!r) throw new Error("unparsed premise: " + p);
        rows.push(...r.rows); ineq.push(...r.ineq);
    }
    return { sys: makeSystem(rows), ineq };
}

module.exports = {
    seed, R, pick, shuffle, AXES, NAMES, buildLayout, coordsFromEdges, neighborsOf, graphDistance,
    axisComponents, renderEdge, clause, joinClauses, solveText, makeSystem, v,
};
