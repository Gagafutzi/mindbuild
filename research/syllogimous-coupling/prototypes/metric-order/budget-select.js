// Proposal 2, Form B as a selection item: "select every relation that could hold".
// Searches for items where each budget axis on its own can take all three signs
// (so per-axis reasoning selects all nine cells) but only a diagonal survives.
// Verified by the text-reading enumerator in walking.js.
"use strict";
const L = require("./lib");
const W = require("./walking");
const sign = n => (n > 0 ? 1 : n < 0 ? -1 : 0);

L.seed(Number(process.argv[2] ?? 21));
let tried = 0, found = 0, ex = null;
const stats = { perAxisProduct: 0, jointCells: [] };
for (let i = 0; i < 2000; i++) {
    const it = W.generateB(4);
    if (!it) continue;
    tried++;
    const { premises } = W.renderB(it);
    const outs = W.possibleOutcomesFromText(premises, it.A, it.far, 4);
    const [a0, a1] = it.axes;
    const s0 = new Set(outs.map(o => sign(o[a0]))), s1 = new Set(outs.map(o => sign(o[a1])));
    const joint = new Set(outs.map(o => `${sign(o[a0])},${sign(o[a1])}`));
    stats.perAxisProduct += s0.size * s1.size;
    stats.jointCells.push(joint.size);
    if (s0.size === 3 && s1.size === 3 && joint.size === 3) { found++; ex ??= { it, premises, outs, joint }; }
}
const mean = xs => (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2);
console.log(`items ${tried}; mean cells a per-axis reader would select ${(stats.perAxisProduct / tried).toFixed(2)}, mean cells actually possible ${mean(stats.jointCells)}; full 3x3-vs-diagonal items ${found}`);
if (ex) {
    const { it, premises, outs, joint } = ex;
    const [a0, a1] = it.axes;
    const name = (ax, r) => (r === 0 ? L.AXES[ax].tie : r > 0 ? L.AXES[ax].pos : L.AXES[ax].neg);
    premises.forEach((p, i) => console.log(`${i + 1}. ${p}.`));
    console.log(`Q: Select every description that could be true of ${it.far} relative to ${it.A}:`);
    for (const r0 of [1, 0, -1]) for (const r1 of [1, 0, -1]) {
        const k = `${r0},${r1}`;
        console.log(`  [${joint.has(k) ? "x" : " "}] ${name(a0, r0)}, ${name(a1, r1)}`);
    }
    console.log("possible vectors:", outs.map(o => `(${o.join(",")})`).join(" "));
}
