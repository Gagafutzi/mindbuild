// Light Cone prototype: time is a budget the spatial axes draw on together.
//
// Layout: the Space 4D tree (east, north, up as unit steps; time as a stated
// number of minutes). Rule: a ring travels one block per minute, one axis at a
// time (taxicab). "Can X's ring have reached Y by Y's moment?" is
//
//     t_Y - t_X  >=  |dx| + |dy| + |dz|
//
// which no per-axis carrying can answer: each axis passing on its own
// (|d_i| <= dt for every i) is the Chebyshev test, and it says yes to items
// whose true answer is no — the time budget is shared, not per axis.
//
// Three premise forms, one per proposed rung:
//   exact   "... 2 min later relative to Ash"            dt stated
//   signal  "... and rang the moment Ash's ring reached it"   dt = |delta|_1 (derived from space)
//   reach   "... and rang only after Ash's ring reached it"   dt >= |delta|_1 (a bound)
//
// The generator renders text; `solve` re-reads ONLY that text and re-derives
// the answer (brute force over free time offsets for `reach`), as the app's
// independent solvers do.

const C = require("./common");
const { SPATIAL, sub, l1, linf, sign } = C;

const RULE = "Each name is a bell ringing at a place and a moment. A ring travels one block per minute, "
    + "and only east-west, north-south or up-down, one block at a time. A ring reaches a bell if it can "
    + "get there by the moment that bell rings (arriving exactly then counts).";

function timeClause(dt) {
    if (dt === 0) return "same moment";
    return `${Math.abs(dt)} min ${dt > 0 ? "later" : "earlier"}`;
}

/** Build one item. kind: "cone" | "signal" | "reach". */
function generate(seed, { n = 6, kind = "cone", branching = true, k = 2, form = "boolean" } = {}) {
    const R = C.rng(seed);
    for (let attempt = 0; attempt < 5000; attempt++) {
        const names = C.WORDS.slice(0, n);
        const edges = C.tree(R, n, branching).map(([a, b]) => {
            const d = C.unitStep(R, 3);
            // dt drawn to sit near the taxicab length, so cone answers are not all "no".
            const dt = Math.floor(R() * 6) - 1; // -1..4
            return { a, b, d, dt, form: "exact" };
        });

        // Promote k edges to signal / reach premises.
        if (kind !== "cone") {
            const idx = [...edges.keys()].sort(() => R() - 0.5).slice(0, k);
            for (const i of idx) {
                const e = edges[i];
                // The hearer is whichever end the premise names as hearing.
                e.form = kind;
                e.hearerIsB = R() < 0.5;
                const len = l1(e.d);
                if (kind === "signal") e.dt = e.hearerIsB ? len : -len;
                else {
                    // reach: the true gap is at least len; pick the actual value above it.
                    const slack = Math.floor(R() * 3);
                    e.dt = e.hearerIsB ? len + slack : -(len + slack);
                }
            }
        }

        // Coordinates: [x, y, z, t] by walking the tree.
        const pos = Array(n).fill(null);
        pos[0] = [0, 0, 0, 0];
        let changed = true;
        while (changed) {
            changed = false;
            for (const e of edges) {
                const step = [...e.d, e.dt];
                if (pos[e.a] && !pos[e.b]) { pos[e.b] = pos[e.a].map((v, i) => v + step[i]); changed = true; }
                if (pos[e.b] && !pos[e.a]) { pos[e.a] = pos[e.b].map((v, i) => v - step[i]); changed = true; }
            }
        }

        const premises = edges.map(e => render(names, e, R));

        if (form === "boolean") {
            // A pair two or more premises apart.
            const pairs = [];
            for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) {
                if (x === y) continue;
                if (C.treePath(n, edges.map(e => [e.a, e.b]), x, y).length < 2) continue;
                pairs.push([x, y]);
            }
            const [x, y] = C.pickFrom(R, pairs);
            const verdict = analyse(edges, pos, n, x, y, kind);
            if (!verdict) continue;
            // The new premise form has to be on the asked path, or it is decoration.
            const path = C.treePath(n, edges.map(e => [e.a, e.b]), x, y);
            if (kind !== "cone" && !path.some(p => edges[p.edge].form === kind)) continue;
            // Balance yes/no by seed parity, and give each answer its own trap:
            //   no  -> every axis passes on its own (the per-axis reader says yes)
            //   yes -> the premises' route is longer than the time (the route reader says no)
            // so each single shortcut scores exactly chance.
            const wantYes = (seed % 2) === 0;
            if (verdict.truth !== wantYes) continue;
            const lure = name => verdict.lures.find(l => l.name === name).answer;
            if (!wantYes && lure("per-axis") !== true) continue;
            if (wantYes && lure("route-length") !== false) continue;
            return {
                rule: RULE, premises,
                question: `${names[x]}'s ring can have reached ${names[y]} by the moment ${names[y]} rang.`,
                answer: verdict.truth, verdict, names, edges, pos, x, y, kind,
            };
        }
    }
    throw new Error("no item");
}

function render(names, e, R) {
    // Flip the stated direction half the time, as renderNdPremises does.
    const flip = e.form === "exact" ? R() < 0.5 : !e.hearerIsB;
    const [from, to] = flip ? [e.b, e.a] : [e.a, e.b];
    const s = flip ? -1 : 1;
    const d = e.d.map(v => s * v);
    const space = C.spatialClauses(SPATIAL, d).join(", ");
    if (e.form === "exact") return `${names[to]} is ${space}, ${timeClause(s * e.dt)} relative to ${names[from]}.`;
    // signal / reach: the hearer is `to` by construction of `flip`.
    if (e.form === "signal") return `${names[to]} is ${space} relative to ${names[from]}, and rang the moment ${names[from]}'s ring reached it.`;
    return `${names[to]} is ${space} relative to ${names[from]}, and rang only after ${names[from]}'s ring had reached it.`;
}

/** Truth and lures, computed from the generator's own coordinates (the solver below is independent). */
function analyse(edges, pos, n, x, y, kind) {
    const dX = sub(pos[y], pos[x]);
    const space = dX.slice(0, 3), dt = dX[3];
    const path = C.treePath(n, edges.map(e => [e.a, e.b]), x, y);
    const routeLen = path.reduce((t, p) => t + l1(edges[p.edge].d), 0);

    if (kind === "reach") {
        // Truth must hold in every arrangement the bounds allow; the solver checks that.
        // Here: lower/upper bound on dt along the path, using only what is stated.
        let lo = 0, hi = 0;
        for (const p of path) {
            const e = edges[p.edge];
            if (e.form === "exact" || e.form === "signal") { lo += p.sign * e.dt; hi += p.sign * e.dt; continue; }
            const len = l1(e.d);
            // e.dt is b-minus-a in time; the bound is |dt| >= len in the hearer's direction.
            const forward = (e.hearerIsB ? 1 : -1) * p.sign; // +1: bound is a lower bound on the path's dt
            if (forward > 0) { lo += len; hi = Infinity; } else { hi -= len; lo = -Infinity; }
        }
        const need = l1(space);
        let truth;
        if (lo >= need) truth = true;
        else if (hi < need) truth = false;
        else return null; // undetermined: rebuild
        return {
            truth, need, lo, hi, dt, space, routeLen,
            // A bound settles the item from one side only, so each lure is read
            // against whichever side is finite: "at least lo" or "at most hi".
            lures: [
                { name: "per-axis", answer: Number.isFinite(lo) ? lo >= linf(space) : hi >= linf(space) },
                { name: "route-length", answer: Number.isFinite(lo) ? lo >= routeLen : hi >= routeLen },
                { name: "time-only", answer: Number.isFinite(lo) ? lo >= 0 : hi >= 0 },
            ],
        };
    }

    const truth = dt >= l1(space);
    return {
        truth, need: l1(space), dt, space, routeLen,
        lures: [
            // Each axis checked on its own: Chebyshev.
            { name: "per-axis", answer: dt >= linf(space) },
            // The premises' route rather than the straight line: sums every step taken.
            { name: "route-length", answer: dt >= routeLen },
            // Newtonian: later is enough.
            { name: "time-only", answer: dt >= 0 },
        ],
    };
}

/* ------------------------------------------------------------------ *
 * Independent solver: reads the rendered text only.                   *
 * ------------------------------------------------------------------ */

function parse(premises) {
    const out = [];
    for (const line of premises) {
        let m = line.match(/^(\w+) is (.+), (same moment|(\d+) min (later|earlier)) relative to (\w+)\.$/);
        if (m) {
            const dt = m[3] === "same moment" ? 0 : Number(m[4]) * (m[5] === "later" ? 1 : -1);
            out.push({ to: m[1], from: m[6], d: parseSpace(m[2]), dt, form: "exact" });
            continue;
        }
        m = line.match(/^(\w+) is (.+) relative to (\w+), and rang (the moment|only after) (\w+)'s ring (reached|had reached) it\.$/);
        if (!m) throw new Error("unparsed: " + line);
        if (m[5] !== m[3]) throw new Error("hearer mismatch: " + line);
        out.push({ to: m[1], from: m[3], d: parseSpace(m[2]), form: m[4] === "the moment" ? "signal" : "reach" });
    }
    return out;
}

function parseSpace(text) {
    const words = text.split(", ");
    return SPATIAL.map((ax, i) => {
        const w = words[i];
        if (w === ax.pos) return 1;
        if (w === ax.neg) return -1;
        if (w === ax.tie) return 0;
        throw new Error("bad clause " + w);
    });
}

/** Must-hold answer, by brute force over every free time offset in a window. */
function solve(premises, question) {
    const facts = parse(premises);
    const q = question.match(/^(\w+)'s ring can have reached (\w+) by the moment (\w+) rang\.$/);
    const [X, Y] = [q[1], q[2]];
    const names = [...new Set(facts.flatMap(f => [f.from, f.to]))];

    // Space is always exact: BFS.
    const sp = { [names[0]]: [0, 0, 0] };
    for (let changed = true; changed;) {
        changed = false;
        for (const f of facts) {
            if (sp[f.from] && !sp[f.to]) { sp[f.to] = sp[f.from].map((v, i) => v + f.d[i]); changed = true; }
            if (sp[f.to] && !sp[f.from]) { sp[f.from] = sp[f.to].map((v, i) => v - f.d[i]); changed = true; }
        }
    }

    // Time: exact and signal premises fix a gap; reach premises bound one.
    // Group by exact gaps (union-find with offsets), then brute-force group offsets.
    const parent = {}, off = {};
    names.forEach(nm => { parent[nm] = nm; off[nm] = 0; });
    const find = nm => {
        if (parent[nm] === nm) return nm;
        const r = find(parent[nm]);
        off[nm] += off[parent[nm]];
        parent[nm] = r;
        return r;
    };
    const bounds = [];
    for (const f of facts) {
        const gap = f.form === "exact" ? f.dt : f.form === "signal" ? l1(f.d) : null;
        if (gap === null) { bounds.push({ from: f.from, to: f.to, min: l1(f.d) }); continue; }
        // t_to - t_from = gap
        const rf = find(f.from), rt = find(f.to);
        if (rf === rt) continue;
        parent[rt] = rf;
        off[rt] = off[f.from] + gap - off[f.to];
    }
    names.forEach(find);
    const roots = [...new Set(names.map(find))];
    const W = 30;
    const answers = new Set();
    const assign = (i, base) => {
        if (i === roots.length) {
            const t = nm => base[find(nm)] + off[nm];
            if (bounds.some(b => t(b.to) - t(b.from) < b.min)) return;
            const dSpace = l1(sp[Y].map((v, k) => v - sp[X][k]));
            answers.add(t(Y) - t(X) >= dSpace);
            return;
        }
        const range = i === 0 ? [0] : Array.from({ length: 2 * W + 1 }, (_, j) => j - W);
        for (const v of range) { base[roots[i]] = v; assign(i + 1, base); }
    };
    if (roots.length > 3) throw new Error("too many free groups for brute force");
    assign(0, {});
    if (answers.size !== 1) return { determined: false, answers: [...answers] };
    return { determined: true, answer: [...answers][0] };
}

module.exports = { generate, solve, analyse, RULE };

if (require.main === module) {
    // Worked examples, one per rung.
    for (const [kind, seed] of [["cone", 3], ["cone", 8], ["signal", 12], ["reach", 21]]) {
        const it = generate(seed, { kind, n: 5, k: 2 });
        console.log(`\n=== ${kind} (seed ${seed}) ===`);
        console.log(it.rule);
        it.premises.forEach(p => console.log("  - " + p));
        console.log("Q: " + it.question);
        console.log("A: " + it.answer);
        const v = it.verdict;
        console.log(`   space ${JSON.stringify(v.space)} taxicab ${v.need}, time gap ${kind === "reach" ? `[${v.lo}, ${v.hi}]` : v.dt}, route length ${v.routeLen}`);
        v.lures.forEach(l => console.log(`   lure ${l.name}: ${l.answer}${l.answer !== it.answer ? "   <-- WRONG" : ""}`));
        const s = solve(it.premises, it.question);
        console.log("   solver:", JSON.stringify(s));
    }

    // Sweep: solver agreement and lure bite rates.
    for (const kind of ["cone", "signal", "reach"]) {
        let agree = 0, total = 0, yes = 0;
        const bite = {};
        for (let seed = 100; seed < 700; seed++) {
            let it;
            try { it = generate(seed, { kind, n: 5 + (seed % 2), k: 2 }); } catch { continue; }
            const s = solve(it.premises, it.question);
            total++;
            if (s.determined && s.answer === it.answer) agree++;
            if (it.answer) yes++;
            for (const l of it.verdict.lures) bite[l.name] = (bite[l.name] ?? 0) + (l.answer !== it.answer ? 1 : 0);
        }
        console.log(`\n${kind}: ${agree}/${total} solver-agree, ${yes} true, lure wrong-rate:`,
            Object.fromEntries(Object.entries(bite).map(([k, v]) => [k, (v / total).toFixed(2)])));
    }
}
