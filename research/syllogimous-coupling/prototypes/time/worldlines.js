// Worldlines prototype: things move, and each premise is true at its own hour.
//
// Each object has a constant velocity (blocks per hour on each spatial axis).
// Each relation premise is the ordinary unit-step composed-space premise with
// an hour stamped on it: "At 3 o'clock, Bell is east, south relative to Ash."
// Positions at hour 0 follow from
//
//     p_to(0) - p_from(0) = delta - (v_to - v_from) * tau
//
// so every premise needs its own correction before it can be chained — the
// time stamp drives every spatial axis, per premise.
//
// Three question forms, one per proposed rung:
//   at     "At 6 o'clock, how does Dune stand relative to Ash?"     (time given)
//   level  "When Ash draws level with Bell east-west, is Cane north or south of Dune?"
//          (the hour is fixed by ONE axis and the answer read on ANOTHER)
//   meet   "Do Ash and Cane ever meet? If so, at what hour?"  (all axes at once)
//
// `solve` re-reads only the rendered text.

const C = require("./common");
const { SPATIAL, sub, add, sign } = C;

const RULE = "Each relation holds at the hour it names, one block per direction named. "
    + "Anything that moves keeps the same pace all day, before and after the hours mentioned.";

function velocityText(name, v, axes) {
    const parts = v.map((x, i) => x === 0 ? null : `${Math.abs(x)} ${x > 0 ? axes[i].pos : axes[i].neg}`).filter(Boolean);
    if (!parts.length) return `${name} does not move.`;
    return `${name} moves ${parts.join(" and ")} every hour.`;
}

const at = (pos0, vel, i, t) => pos0[i].map((x, k) => x + vel[i][k] * t);

function generate(seed, { n = 5, d = 2, kind = "at", branching = true } = {}) {
    const R = C.rng(seed);
    const axes = SPATIAL.slice(0, d);
    for (let attempt = 0; attempt < 20000; attempt++) {
        const names = C.WORDS.slice(0, n);
        const vel = names.map(() => axes.map(() => (R() < 0.45 ? 0 : (R() < 0.5 ? 1 : -1))));
        // At least two movers and one thing standing still, so "moves" is a contrast.
        const movers = vel.filter(v => v.some(x => x)).length;
        if (movers < 2 || movers === n) continue;

        const edges = C.tree(R, n, branching).map(([a, b]) => ({
            a, b, d: C.unitStep(R, d), tau: 1 + Math.floor(R() * 5), // 1..5 o'clock
        }));
        // Premises at different hours, or the stamps teach nothing.
        if (new Set(edges.map(e => e.tau)).size < 2) continue;

        // Positions at hour 0.
        const pos0 = Array(n).fill(null);
        pos0[0] = axes.map(() => 0);
        for (let changed = true; changed;) {
            changed = false;
            for (const e of edges) {
                const corr = e.d.map((x, k) => x - (vel[e.b][k] - vel[e.a][k]) * e.tau);
                if (pos0[e.a] && !pos0[e.b]) { pos0[e.b] = add(pos0[e.a], corr); changed = true; }
                if (pos0[e.b] && !pos0[e.a]) { pos0[e.a] = sub(pos0[e.b], corr); changed = true; }
            }
        }

        const E = edges.map(e => [e.a, e.b]);
        const statics = (x, y) => C.treePath(n, E, x, y).reduce((acc, p) =>
            add(acc, edges[p.edge].d.map(v => v * p.sign)), axes.map(() => 0));

        const premises = [
            ...edges.map(e => {
                const flip = R() < 0.5;
                const [from, to] = flip ? [e.b, e.a] : [e.a, e.b];
                const dd = e.d.map(v => (flip ? -v : v));
                return `At ${e.tau} o'clock, ${names[to]} is ${C.spatialClauses(axes, dd).join(", ")} relative to ${names[from]}.`;
            }),
            ...names.map((nm, i) => velocityText(nm, vel[i], axes)),
        ];

        const pairs = [];
        for (let x = 0; x < n; x++) for (let y = 0; y < n; y++)
            if (x !== y && C.treePath(n, E, x, y).length >= 2) pairs.push([x, y]);
        if (!pairs.length) continue;

        if (kind === "at") {
            const T = 6 + Math.floor(R() * 3); // after every stamp, so extrapolation is needed
            const [x, y] = C.pickFrom(R, pairs);
            const truth = sub(at(pos0, vel, y, T), at(pos0, vel, x, T)).map(sign);
            if (truth.some(v => v === 0)) continue; // keep the answer a direction on every axis
            const lures = {
                // Every premise chained as if stated at one moment, and nothing moved.
                static: statics(x, y).map(sign),
                // Chained as if simultaneous, then moved from the latest stamp to T.
                "chain-then-move": add(statics(x, y), sub(vel[y], vel[x]).map(v => v * (T - Math.max(...edges.map(e => e.tau))))).map(sign),
                // Only the asked pair's motion applied, intermediate movers ignored.
                "endpoints-only": add(statics(x, y), sub(vel[y], vel[x]).map(v => v * T)).map(sign),
            };
            const key = v => v.join(",");
            // Motion must bite: the static reading and its two repairs all wrong.
            if (Object.values(lures).some(l => key(l) === key(truth))) continue;
            return {
                rule: RULE, premises, kind, names, vel, pos0, edges,
                question: `At ${T} o'clock, how does ${names[y]} stand relative to ${names[x]}?`,
                answer: C.spatialClauses(axes, truth).join(", "),
                lures: Object.fromEntries(Object.entries(lures).map(([k, v]) => [k, C.spatialClauses(axes, v).join(", ")])),
            };
        }

        if (kind === "level") {
            // Event pair (x, y) on axis i; asked pair (p, q) on axis j != i.
            const [x, y] = C.pickFrom(R, pairs);
            const i = Math.floor(R() * d);
            const j = (i + 1 + Math.floor(R() * (d - 1))) % d;
            const g = pos0[y][i] - pos0[x][i], w = vel[y][i] - vel[x][i];
            if (w === 0) continue;                        // never level, or always: no event
            if (g % w !== 0) continue;                     // level between hours: keep it whole
            const tStar = -g / w;
            if (tStar < 1 || tStar > 10) continue;
            // Asked pair: the event pair itself half the time, another pair otherwise.
            const [p, q] = R() < 0.5 ? [x, y] : C.pickFrom(R, pairs);
            const north = T => sign(at(pos0, vel, q, T)[j] - at(pos0, vel, p, T)[j]);
            const truth = north(tStar);
            if (truth === 0) continue;
            const stamps = [...new Set(edges.map(e => e.tau))];
            // Hour at which the event pair is level on the OTHER axis, if any: the cross-axis lure.
            const gj = pos0[y][j] - pos0[x][j], wj = vel[y][j] - vel[x][j];
            const otherLevel = wj !== 0 && gj % wj === 0 ? -gj / wj : null;
            const lures = {
                static: sign(statics(p, q)[j]),
                "wrong-axis-hour": otherLevel !== null && otherLevel !== tStar ? north(otherLevel) : null,
                "latest-stamp": north(Math.max(...stamps)),
                "hour-zero": north(0),
            };
            // The hour has to matter: the asked relation must change sign across the day,
            // and the static chain must get it wrong.
            if (lures.static === truth) continue;
            if (north(0) === north(10) && north(0) === truth) continue;
            const word = s => (s > 0 ? axes[j].pos : s < 0 ? axes[j].neg : axes[j].tie);
            return {
                rule: RULE, premises, kind, names, vel, pos0, edges, tStar,
                question: `When ${names[x]} draws level with ${names[y]} ${axes[i].pos}-${axes[i].neg}, `
                    + `is ${names[q]} ${axes[j].pos} or ${axes[j].neg} of ${names[p]}?`,
                answer: word(truth),
                lures: Object.fromEntries(Object.entries(lures).filter(([, v]) => v !== null).map(([k, v]) => [k, word(v)])),
            };
        }

        if (kind === "meet") {
            const [x, y] = C.pickFrom(R, pairs);
            const g = sub(pos0[y], pos0[x]), w = sub(vel[y], vel[x]);
            // Hour each axis is level, per axis: "always", "never", or one hour.
            const perAxis = g.map((gi, k) => w[k] === 0 ? (gi === 0 ? "always" : "never")
                : (gi % w[k] === 0 && -gi / w[k] >= 0 ? -gi / w[k] : "never"));
            if (perAxis.includes("never")) continue;        // trivially never: no coupling in it
            const hours = perAxis.filter(h => h !== "always");
            if (!hours.length) continue;                    // same place all day
            const meets = hours.every(h => h === hours[0]);
            // Balance by seed: half meet, half pass each other on every axis at different hours.
            if (meets !== (seed % 2 === 0)) continue;
            if (hours.length < 2) continue;                 // one moving axis is a 1D problem
            if (hours.some(h => h > 10)) continue;
            return {
                rule: RULE, premises, kind, names, vel, pos0, edges,
                question: `Do ${names[x]} and ${names[y]} ever meet? If so, at what hour?`,
                answer: meets ? `yes, at ${hours[0]} o'clock` : "never",
                lures: {
                    // Level on every axis at some hour, so "they meet": the per-axis reading.
                    "per-axis": `yes, at ${hours[0]} o'clock`,
                    // Or the hour from the first axis alone.
                    "first-axis": `yes, at ${hours[0]} o'clock`,
                },
                perAxis,
            };
        }
    }
    throw new Error("no item");
}

/* ------------------------------------------------------------------ *
 * Independent solver: reads only the rendered text.                   *
 * ------------------------------------------------------------------ */

function solve(premises, question, d = 2) {
    const axes = SPATIAL.slice(0, d);
    const vel = {}, rels = [];
    for (const line of premises) {
        let m = line.match(/^(\w+) does not move\.$/);
        if (m) { vel[m[1]] = axes.map(() => 0); continue; }
        m = line.match(/^(\w+) moves (.+) every hour\.$/);
        if (m) {
            const v = axes.map(() => 0);
            for (const part of m[2].split(" and ")) {
                const [num, word] = part.split(" ");
                axes.forEach((ax, k) => { if (word === ax.pos) v[k] = +num; if (word === ax.neg) v[k] = -num; });
            }
            vel[m[1]] = v; continue;
        }
        m = line.match(/^At (\d+) o'clock, (\w+) is (.+) relative to (\w+)\.$/);
        if (!m) throw new Error("unparsed " + line);
        const words = m[3].split(", ");
        const dd = axes.map((ax, k) => words[k] === ax.pos ? 1 : words[k] === ax.neg ? -1 : 0);
        rels.push({ tau: +m[1], to: m[2], from: m[4], d: dd });
    }
    const names = Object.keys(vel);
    const p0 = { [names[0]]: axes.map(() => 0) };
    for (let changed = true; changed;) {
        changed = false;
        for (const r of rels) {
            // At hour tau: p_to + v_to tau - (p_from + v_from tau) = d
            const c = r.d.map((x, k) => x - (vel[r.to][k] - vel[r.from][k]) * r.tau);
            if (p0[r.from] && !p0[r.to]) { p0[r.to] = add(p0[r.from], c); changed = true; }
            if (p0[r.to] && !p0[r.from]) { p0[r.from] = sub(p0[r.to], c); changed = true; }
        }
    }
    const P = (nm, t) => p0[nm].map((x, k) => x + vel[nm][k] * t);

    let m = question.match(/^At (\d+) o'clock, how does (\w+) stand relative to (\w+)\?$/);
    if (m) return C.spatialClauses(axes, sub(P(m[2], +m[1]), P(m[3], +m[1])).map(sign)).join(", ");

    m = question.match(/^When (\w+) draws level with (\w+) (\w+)-(\w+), is (\w+) (\w+) or (\w+) of (\w+)\?$/);
    if (m) {
        const i = axes.findIndex(a => a.pos === m[3]);
        const j = axes.findIndex(a => a.pos === m[6]);
        // Search the hours rather than solving the equation: an independent route.
        const level = [];
        for (let t = -50; t <= 50; t++) if (P(m[1], t)[i] === P(m[2], t)[i]) level.push(t);
        if (level.length !== 1) return { error: "event not unique", level };
        const s = sign(P(m[5], level[0])[j] - P(m[8], level[0])[j]);
        return s > 0 ? axes[j].pos : s < 0 ? axes[j].neg : axes[j].tie;
    }

    m = question.match(/^Do (\w+) and (\w+) ever meet\? If so, at what hour\?$/);
    if (m) {
        const hits = [];
        for (let t = -50; t <= 50; t++) if (P(m[1], t).every((x, k) => x === P(m[2], t)[k])) hits.push(t);
        if (hits.length > 1) return { error: "meet not unique", hits };
        return hits.length ? `yes, at ${hits[0]} o'clock` : "never";
    }
    throw new Error("unparsed question");
}

module.exports = { generate, solve };

if (require.main === module) {
    for (const [kind, seed, d] of [["at", 4, 2], ["level", 7, 2], ["level", 30, 3], ["meet", 11, 2], ["meet", 12, 2]]) {
        const it = generate(seed, { kind, d, n: kind === "meet" ? 4 : 5 });
        console.log(`\n=== ${kind} (seed ${seed}, ${d}D) ===`);
        console.log(it.rule);
        it.premises.forEach(p => console.log("  - " + p));
        console.log("Q: " + it.question);
        console.log("A: " + it.answer);
        for (const [k, v] of Object.entries(it.lures)) console.log(`   lure ${k}: ${v}${v !== it.answer ? "   <-- WRONG" : ""}`);
        if (it.perAxis) console.log("   per-axis level hours:", JSON.stringify(it.perAxis));
        if (it.tStar !== undefined) console.log("   event hour:", it.tStar);
        console.log("   solver:", JSON.stringify(solve(it.premises, it.question, d)));
    }

    for (const kind of ["at", "level", "meet"]) for (const d of [2, 3]) {
        let agree = 0, total = 0, fails = 0;
        const wrong = {};
        for (let seed = 100; seed < 500; seed++) {
            let it;
            try { it = generate(seed, { kind, d, n: kind === "meet" ? 4 : 5 }); } catch { fails++; continue; }
            total++;
            const s = solve(it.premises, it.question, d);
            if (s === it.answer) agree++;
            for (const [k, v] of Object.entries(it.lures)) wrong[k] = (wrong[k] ?? 0) + (v !== it.answer ? 1 : 0);
        }
        console.log(`\n${kind} ${d}D: ${agree}/${total} solver-agree (${fails} unbuildable), lure wrong-rate:`,
            Object.fromEntries(Object.entries(wrong).map(([k, v]) => [k, (v / total).toFixed(2)])));
    }
}
