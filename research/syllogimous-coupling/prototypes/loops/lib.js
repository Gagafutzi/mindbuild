"use strict";
// Shared helpers for the coupled-loop prototypes. Plain node, no deps.

function rng(seed) {
  // mulberry32
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const mod = (n, m) => ((n % m) + m) % m;
const pick = (R, xs) => xs[Math.floor(R() * xs.length)];
function shuffle(R, xs) {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const WORDS = ["Ash", "Bell", "Cole", "Dune", "Elm", "Fern", "Gale", "Hart", "Iris", "Jade"];

/** A random tree over the words: a chain, or each new word hung off an earlier one. */
function buildTree(R, words, branching) {
  const edges = [];
  for (let i = 1; i < words.length; i++) {
    const parent = branching ? words[Math.floor(R() * i)] : words[i - 1];
    edges.push({ from: parent, to: words[i] });
  }
  return edges;
}

/** Edges on the unique tree path a -> b, each with the direction it is walked (+1 from->to). */
function treePath(edges, a, b) {
  const adj = {};
  edges.forEach((e, i) => {
    (adj[e.from] ??= []).push({ n: e.to, i, s: 1 });
    (adj[e.to] ??= []).push({ n: e.from, i, s: -1 });
  });
  const prev = { [a]: null }, q = [a];
  while (q.length) {
    const c = q.shift();
    if (c === b) break;
    for (const st of adj[c] ?? []) if (!(st.n in prev)) { prev[st.n] = { c, st }; q.push(st.n); }
  }
  if (!(b in prev)) return null;
  const out = [];
  for (let c = b; prev[c]; c = prev[c].c) out.unshift(prev[c].st);
  return out;
}
const sign = n => (n > 0 ? 1 : n < 0 ? -1 : 0);
const strip = s => s.replace(/<[^>]+>/g, "");

module.exports = { rng, mod, pick, shuffle, WORDS, buildTree, treePath, sign, strip };
