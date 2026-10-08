// Local Clocks prototype: the time axis is read on clocks that depend on east.
//
// East is a ring of m zones (a circular axis, as `isCircular` already allows
// for east). Each zone east is one hour ahead, and the date line sits between
// the last zone and the first. Every premise states a time gap as read on the
// two local clocks, so the real gap is
//
//     real = local - (zone_to - zone_from),   zones taken in [0, m)
//
// On a straight east axis that is a shear: carry the clock sum and the east
// sum, subtract at the end. On the ring the zone difference is NOT the east
// displacement: it is the displacement minus m times the number of times the
// chain winds across the date line, so the reader needs absolute zones (east
// POSITION relative to the line), not displacements. probes.js confirms the
// answer still telescopes to "clock sum minus endpoint zone difference" in
// every item — this is end-of-chain coupling through absolute position, not
// per-premise coupling. Shallower than Light Cone's signal premises.
//
// The generator renders text; `solve` re-reads only that text.

const C = require("./common");
const { mod } = C;

function generate(seed, { n = 5, m = 4, branching = false } = {}) {
    const R = C.rng(seed);
    for (let attempt = 0; attempt < 20000; attempt++) {
        const names = C.WORDS.slice(0, n);
        const edges = C.tree(R, n, branching).map(([a, b]) => ({
            a, b,
            dz: C.pickFrom(R, [1, 1, -1, 0]),      // zone step, mostly eastward so chains wrap
            realDt: Math.floor(R() * 5) - 1,       // real hours, -1..3
        }));
        if (edges.every(e => e.dz === 0)) continue;

        // Absolute zone of every object, anchored by naming where one of them sits.
        const anchor = Math.floor(R() * n);
        const anchorZone = Math.floor(R() * m);
        const zone = Array(n).fill(null), t = Array(n).fill(null);
        zone[anchor] = anchorZone; t[anchor] = 0;
        for (let changed = true; changed;) {
            changed = false;
            for (const e of edges) {
                if (zone[e.a] !== null && zone[e.b] === null) { zone[e.b] = mod(zone[e.a] + e.dz, m); t[e.b] = t[e.a] + e.realDt; changed = true; }
                if (zone[e.b] !== null && zone[e.a] === null) { zone[e.a] = mod(zone[e.b] - e.dz, m); t[e.a] = t[e.b] - e.realDt; changed = true; }
            }
        }
        // The local-clock gap each premise states.
        for (const e of edges) e.localDt = e.realDt + (zone[e.b] - zone[e.a]);

        const E = edges.map(e => [e.a, e.b]);
        const pairs = [];
        for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) {
            if (x === y) continue;
            const path = C.treePath(n, E, x, y);
            if (path.length < 2) continue;
            pairs.push([x, y, path]);
        }
        const [x, y, path] = C.pickFrom(R, pairs);
        const truth = t[y] - t[x];
        const sumLocal = path.reduce((s, p) => s + p.sign * edges[p.edge].localDt, 0);
        const sumSteps = path.reduce((s, p) => s + p.sign * edges[p.edge].dz, 0);
        const crossings = path.filter(p => {
            const e = edges[p.edge];
            return Math.abs(zone[e.b] - zone[e.a]) > 1; // the step went over the line
        }).length;
        const lures = {
            // Read the clocks as if they were one clock.
            "local-clocks": sumLocal,
            // Correct for the zones as a displacement, ignoring the line (the straight-axis shear).
            "no-date-line": sumLocal - sumSteps,
            // Correct with the wrong sign.
            "wrong-sign": sumLocal + (zone[y] - zone[x]),
        };
        // The date line has to matter: the path must cross it, and both readings must be wrong.
        if (!crossings) continue;
        if (Object.values(lures).includes(truth)) continue;

        const zw = k => (k === 0 ? "in the same zone as" : `${Math.abs(k)} zone${Math.abs(k) > 1 ? "s" : ""} ${k > 0 ? "east" : "west"} of`);
        const hw = k => (k === 0 ? "the same time" : `${Math.abs(k)} hour${Math.abs(k) > 1 ? "s" : ""} ${k > 0 ? "later" : "earlier"}`);
        const premises = [
            `There are ${m} zones in a ring; each zone east is one hour ahead. `
            + `The date line runs along the west edge of ${["the first", "the second", "the third", "the fourth", "the fifth", "the sixth"][0]} zone, `
            + `and ${names[anchor]} is in zone ${anchorZone + 1} of ${m}, counting east from the line.`,
            ...edges.map(e => {
                const flip = R() < 0.5;
                const [from, to] = flip ? [e.b, e.a] : [e.a, e.b];
                const s = flip ? -1 : 1;
                const gap = s * e.localDt;
                return `${names[to]} is ${zw(s * e.dz)} ${names[from]}; ${names[to]}'s call read ${hw(gap)} on its clock ${gap === 0 ? "as" : "than"} ${names[from]}'s did on ${names[from]}'s.`;
            }),
        ];
        return {
            premises, names, zone, t, edges, crossings, path,
            question: `In real hours, how long after ${names[x]}'s call was ${names[y]}'s? (negative if before)`,
            answer: truth, lures,
        };
    }
    throw new Error("no item");
}

/* Independent solver: text only, and it tracks absolute zones by brute force
   over every zone assignment consistent with the premises. */
function solve(premises, question, m = 4) {
    const head = premises[0].match(/and (\w+) is in zone (\d+) of (\d+)/);
    const anchor = head[1], az = +head[2] - 1;
    const facts = premises.slice(1).map(line => {
        const r = line.match(/^(\w+) is (in the same zone as|(\d+) zones? (east|west) of) (\w+); \w+'s call read (the same time|(\d+) hours? (later|earlier)) on its clock (?:than|as) (\w+)'s did/);
        if (!r) throw new Error("unparsed " + line);
        const dz = r[2].startsWith("in the same") ? 0 : +r[3] * (r[4] === "east" ? 1 : -1);
        const dl = r[6] === "the same time" ? 0 : +r[7] * (r[8] === "later" ? 1 : -1);
        return { to: r[1], from: r[5], dz, dl };
    });
    const names = [...new Set(facts.flatMap(f => [f.to, f.from]))];
    // Brute force: every zone assignment, keep those matching each stated step mod m.
    const sols = [];
    const z = {};
    const rec = i => {
        if (i === names.length) {
            if (z[anchor] !== az) return;
            if (facts.every(f => mod(z[f.to] - z[f.from], m) === mod(f.dz, m))) sols.push({ ...z });
            return;
        }
        for (let k = 0; k < m; k++) { z[names[i]] = k; rec(i + 1); }
    };
    rec(0);
    if (sols.length !== 1) return { error: "zones not unique", count: sols.length };
    const Z = sols[0];
    // Real time by propagation: real = local - (Z_to - Z_from).
    const T = { [anchor]: 0 };
    for (let changed = true; changed;) {
        changed = false;
        for (const f of facts) {
            const real = f.dl - (Z[f.to] - Z[f.from]);
            if (T[f.from] !== undefined && T[f.to] === undefined) { T[f.to] = T[f.from] + real; changed = true; }
            if (T[f.to] !== undefined && T[f.from] === undefined) { T[f.from] = T[f.to] - real; changed = true; }
        }
    }
    const q = question.match(/after (\w+)'s call was (\w+)'s/);
    return T[q[2]] - T[q[1]];
}

module.exports = { generate, solve };

if (require.main === module) {
    for (const seed of [5, 9]) {
        const it = generate(seed, { n: 4, m: 4 });
        console.log(`\n=== local clocks (seed ${seed}) ===`);
        it.premises.forEach(p => console.log("  - " + p));
        console.log("Q: " + it.question);
        console.log("A: " + it.answer, "  zones:", JSON.stringify(it.zone), " real times:", JSON.stringify(it.t), " crossings on path:", it.crossings);
        for (const [k, v] of Object.entries(it.lures)) console.log(`   lure ${k}: ${v}   <-- WRONG`);
        console.log("   solver:", JSON.stringify(solve(it.premises, it.question, 4)));
    }
    for (const m of [4, 5]) {
        let agree = 0, total = 0;
        for (let seed = 100; seed < 500; seed++) {
            const it = generate(seed, { n: 5, m, branching: seed % 2 === 0 });
            total++;
            if (solve(it.premises, it.question, m) === it.answer) agree++;
        }
        console.log(`\nm=${m}: ${agree}/${total} solver-agree; every item crosses the line and all three lures are wrong by construction`);
    }
}
