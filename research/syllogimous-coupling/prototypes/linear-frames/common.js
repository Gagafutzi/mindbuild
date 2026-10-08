"use strict";
/*
 * Shared bits for the three prototypes: a seeded RNG, the default 4D/5D axis
 * stack with the wording ndspace.utils uses, a premise tree like buildNdLayout's,
 * and clause rendering/parsing so every prototype can check the WRITER (rendered
 * text) with an independent reader, not just the generator's own numbers.
 */

function rng(seed) {
    let a = seed >>> 0;
    const next = () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return {
        next,
        int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
        pick: xs => xs[Math.floor(next() * xs.length)],
        coin: () => next() < 0.5,
        shuffle: xs => { const a = xs.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
    };
}

/* Same words as SPATIAL_SCALES / LINEAR_SCALES in linear.utils.ts. */
const AXES = [
    { id: "east", dir: ["east", "west"], tie: "same longitude", label: "X" },
    { id: "north", dir: ["north", "south"], tie: "same latitude", label: "Y" },
    { id: "up", dir: ["above", "below"], tie: "same height", label: "Z" },
    { id: "temporal", dir: ["later", "earlier"], tie: "same time", label: "T" },
    { id: "contains", dir: ["wider", "narrower"], tie: "same size", label: "C" },
];
const axesFor = n => AXES.slice(0, n);

const NAMES = ["Ash", "Bell", "Cole", "Dell", "Eve", "Fay", "Gus", "Hal"];
const sign = x => (x > 0 ? 1 : x < 0 ? -1 : 0);
const add = (a, b) => a.map((v, i) => v + b[i]);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const neg = a => a.map(v => -v || 0);
const eq = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

/** A random tree over `words` (chain or branching), as buildChain/buildBranching do. */
function tree(r, words, branching = true) {
    const edges = [];
    for (let i = 1; i < words.length; i++) {
        const j = branching ? r.int(0, i - 1) : i - 1;
        edges.push([words[j], words[i]]);
    }
    return edges;
}

/** A unit step on every axis, not all zero (buildNdLayout's draw, tieChance 0.22). */
function unitDelta(r, n) {
    for (;;) {
        const d = Array.from({ length: n }, () => (r.next() < 0.22 ? 0 : r.coin() ? 1 : -1));
        if (d.some(v => v)) return d;
    }
}

function clause(axis, d) {
    if (d === 0) return axis.tie;
    return d > 0 ? axis.dir[0] : axis.dir[1];
}
function clauses(axes, d) {
    const parts = axes.map((a, i) => clause(a, d[i]));
    return parts.length > 1 ? parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1] : parts[0];
}
/** Inverse of `clauses`: the text back to a sign vector, by word. */
function parseClauses(axes, text) {
    const parts = text.split(/, | and /).map(s => s.trim());
    if (parts.length !== axes.length) throw new Error("clause count: " + text);
    return parts.map((p, i) => {
        const a = axes[i];
        if (p === a.dir[0]) return 1;
        if (p === a.dir[1]) return -1;
        if (p === a.tie) return 0;
        throw new Error(`unknown clause "${p}" on ${a.id}`);
    });
}

/** Coordinates by walking a tree of [from, to, worldDelta]. */
function walk(root, n, links) {
    const coords = { [root]: Array(n).fill(0) };
    let grew = true;
    while (grew) {
        grew = false;
        for (const [f, t, d] of links) {
            if (coords[f] && !coords[t]) { coords[t] = add(coords[f], d); grew = true; }
            else if (coords[t] && !coords[f]) { coords[f] = sub(coords[t], d); grew = true; }
        }
    }
    return coords;
}

function graphDist(edges, a, b) {
    const near = {};
    for (const [f, t] of edges) { (near[f] ??= []).push(t); (near[t] ??= []).push(f); }
    const seen = new Map([[a, 0]]); const q = [a];
    while (q.length) { const c = q.shift(); for (const x of near[c] ?? []) if (!seen.has(x)) { seen.set(x, seen.get(c) + 1); q.push(x); } }
    return seen.get(b) ?? Infinity;
}

/** The pair furthest apart in the premise graph (pickDistantPair, slack 0). */
function farPair(r, words, edges) {
    let best = -1, pairs = [];
    for (let i = 0; i < words.length; i++) for (let j = i + 1; j < words.length; j++) {
        const g = graphDist(edges, words[i], words[j]);
        if (g > best) { best = g; pairs = []; }
        if (g === best) pairs.push([words[i], words[j]]);
    }
    const p = r.pick(pairs);
    return r.coin() ? p : [p[1], p[0]];
}

module.exports = { rng, AXES, axesFor, NAMES, sign, add, sub, neg, eq, tree, unitDelta, clause, clauses, parseClauses, walk, graphDist, farPair };
