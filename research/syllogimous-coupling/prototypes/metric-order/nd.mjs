// Shared scaffolding for the coupling prototypes. Mirrors the shape of
// buildNdLayout in apps/syllogimous/src/app/syllogimous/utils/ndspace.utils.ts:
// a tree over the objects (chain or branching), one step of -1/0/+1 per axis
// per edge, coordinates by accumulation. Plain node, seeded, no deps.

export function rng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export const AXES = [
    { id: "east", pos: "east", neg: "west", tie: "same longitude", above: "is east of", below: "is west of", same: "is at the same longitude as", noun: "east-west" },
    { id: "north", pos: "north", neg: "south", tie: "same latitude", above: "is north of", below: "is south of", same: "is at the same latitude as", noun: "north-south" },
    { id: "up", pos: "above", neg: "below", tie: "same height", above: "is above", below: "is below", same: "is at the same height as", noun: "height" },
    { id: "time", pos: "later", neg: "earlier", tie: "same time", above: "is later than", below: "is earlier than", same: "is at the same time as", noun: "time" },
    { id: "contains", pos: "wider", neg: "narrower", tie: "same size", above: "contains", below: "is within", same: "is the same size as", noun: "size" },
    { id: "quantity", pos: "greater", neg: "smaller", tie: "same amount", above: "is more than", below: "is less than", same: "is equal to", noun: "amount" },
];

export const NAMES = ["Ash", "Bell", "Cole", "Dune", "Elm", "Fern", "Gale", "Hull", "Iris", "Jade"];

export function makeTools(r) {
    const pick = xs => xs[Math.floor(r() * xs.length)];
    const shuffle = xs => {
        const out = [...xs];
        for (let i = out.length - 1; i > 0; i--) {
            const j = Math.floor(r() * (i + 1));
            [out[i], out[j]] = [out[j], out[i]];
        }
        return out;
    };
    return { pick, shuffle };
}

/** Tree shape: chain, or branching with a simple attach rule. */
export function buildShape(r, words, branching) {
    const edges = [];
    if (!branching) {
        for (let i = 0; i < words.length - 1; i++) edges.push([words[i], words[i + 1]]);
    } else {
        for (let i = 1; i < words.length; i++) {
            const deg = {};
            for (const [a, b] of edges) { deg[a] = (deg[a] ?? 0) + 1; deg[b] = (deg[b] ?? 0) + 1; }
            const options = words.slice(0, i).filter(w => (deg[w] ?? 0) < 3);
            const src = options[Math.floor(r() * options.length)];
            edges.push(r() < 0.5 ? [src, words[i]] : [words[i], src]);
        }
    }
    return edges;
}

export function buildLayout(r, words, dims, { branching = false, tieChance = 0.22 } = {}) {
    const { pick } = makeTools(r);
    const shape = buildShape(r, words, branching);
    const edges = shape.map(([from, to]) => {
        let deltas;
        do {
            deltas = Array.from({ length: dims }, () => (r() < tieChance ? 0 : pick([-1, 1])));
        } while (deltas.every(d => d === 0));
        return { from, to, deltas };
    });
    const layout = { words, dims, axes: AXES.slice(0, dims), edges };
    layout.coords = coordsFrom(layout);
    return layout;
}

export function coordsFrom(layout) {
    const { words, dims, edges } = layout;
    const coords = { [words[0]]: Array(dims).fill(0) };
    const queue = [words[0]];
    while (queue.length) {
        const cur = queue.shift();
        for (const e of edges) {
            let other = null, sign = 0;
            if (e.from === cur) { other = e.to; sign = 1; }
            else if (e.to === cur) { other = e.from; sign = -1; }
            if (!other || coords[other]) continue;
            coords[other] = coords[cur].map((v, i) => v + sign * e.deltas[i]);
            queue.push(other);
        }
    }
    return coords;
}

/** Edges (with orientation) on the tree path from a to b. */
export function pathEdges(layout, a, b) {
    const prev = { [a]: null };
    const queue = [a];
    while (queue.length) {
        const cur = queue.shift();
        if (cur === b) break;
        layout.edges.forEach((e, idx) => {
            const nxt = e.from === cur ? e.to : e.to === cur ? e.from : null;
            if (!nxt || nxt in prev) return;
            prev[nxt] = { node: cur, idx, sign: e.from === cur ? 1 : -1 };
            queue.push(nxt);
        });
    }
    const out = [];
    let cur = b;
    while (prev[cur]) { out.unshift(prev[cur]); cur = prev[cur].node; }
    return out; // each step: {idx, sign}: walking a->b, coord changes by sign*deltas
}

export const clause = (axis, d) => d === 0 ? axis.tie : d > 0 ? axis.pos : axis.neg;

/** "To is <clauses> relative to From", with optional replacement clauses per axis. */
export function renderPremise(layout, e, replace = {}) {
    const parts = layout.axes.map((axis, i) => (i in replace ? replace[i] : clause(axis, e.deltas[i])))
        .filter(p => p !== null);
    return `${e.to} is ${parts.join(", ")} relative to ${e.from}`;
}

export const diff = (layout, a, b, i) => layout.coords[a][i] - layout.coords[b][i];
export const sgn = x => (x > 0 ? 1 : x < 0 ? -1 : 0);
export function relWord(axis, d) { return d === 0 ? axis.same : d > 0 ? axis.above : axis.below; }
