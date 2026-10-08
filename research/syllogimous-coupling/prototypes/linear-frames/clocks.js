"use strict";
/*
 * Proposal B: a skewed axis — a Galilean shear between two axes of the space.
 *
 * Two presets of the same machinery (target += rate * source):
 *
 *   clocks  local clocks run one step later for every step east (time zones):
 *           τ = t + x.  A premise marked "by local clocks" states Δτ, so the
 *           real time difference is Δt = Δτ − Δx: its TIME clause depends on
 *           its EAST clause.
 *   drift   measured aboard a barge drifting one step east per step of time
 *           (a Galilean boost): x_b = x − t, so Δx = Δx_b + Δt: its EAST
 *           clause depends on its TIME clause.
 *
 * Premises are mixed — some by the station clock (or from the bank), some by
 * local clocks (or aboard) — and the question names one of the two readings.
 * Every clause is one step (ONE_STEP_NOTE), which is what makes the shear exact.
 *
 * Run:  node clocks.js
 */
const C = require("./common");

const PRESETS = {
    clocks: {
        target: 3, source: 0, rate: 1,
        note: "Clocks are local: one step east, a clock reads one step later than a clock one step west of it at the same moment. "
            + "Premises marked <i>by local clocks</i> give the time as the clocks where the two things are read it; the rest use the station clock.",
        tag: "By local clocks, ", plain: "By the station clock, ",
        ask: { true: "By the station clock", false: "By local clocks" },
    },
    drift: {
        // x_b = x − t, so x = x_b + t: the correction ADDS, which is rate −1 here.
        target: 0, source: 3, rate: -1,
        note: "A barge drifts one step east for every step of time. Premises marked <i>aboard</i> measure east and west on the barge; the rest measure from the bank.",
        tag: "Aboard, ", plain: "From the bank, ",
        ask: { true: "From the bank", false: "Aboard" },
    },
};

/** Stated (in the skewed reading) to world: target -= rate * source. */
const toWorld = (p, d) => { const w = d.slice(); w[p.target] = d[p.target] - p.rate * d[p.source]; return w; };
/** World to the skewed reading. */
const toSkew = (p, w) => { const d = w.slice(); d[p.target] = w[p.target] + p.rate * w[p.source]; return d; };

function generate(r, preset = "clocks", { n = 4, objects = 6, skewed = [2, 3] } = {}) {
    const p = PRESETS[preset];
    const axes = C.axesFor(n);
    const words = C.NAMES.slice(0, objects);
    const edges = C.tree(r, words);

    /* Which premises are read on the skewed instruments. */
    const k = r.int(skewed[0], skewed[1]);
    const marked = new Set(r.shuffle(edges.map((_, i) => i)).slice(0, k));

    /* Stated deltas are unit steps in whichever reading the premise uses. */
    const spoken = edges.map(([f, t], i) => {
        const stated = C.unitDelta(r, n);
        const skew = marked.has(i);
        const flip = r.coin();
        const [ref, subj] = flip ? [t, f] : [f, t];
        return { ref, subj, stated, skew, world: skew ? toWorld(p, stated) : stated };
    });
    const coords = C.walk(words[0], n, spoken.map(s => [s.ref, s.subj, s.world]));

    const [x, y] = C.farPair(r, words, edges);
    const D = C.sub(coords[y], coords[x]);
    const askWorld = r.coin();                    // station clock / from the bank, or the skewed reading
    const truthVec = askWorld ? D : toSkew(p, D);
    const truth = C.sign(truthVec[p.target]);

    /* Lures, computed the way each reader would. */
    const sumWith = conv => {
        const c = C.walk(words[0], n, spoken.map(s => [s.ref, s.subj, conv(s)]));
        return C.sub(c[y], c[x]);
    };
    const finish = v => C.sign((askWorld ? v : toSkew(p, v))[p.target]);
    const lures = {
        // Every column carried as stated, and the question's reading ignored.
        literal: C.sign(sumWith(s => s.stated)[p.target]),
        // The correction made, but the wrong way round (clocks east read EARLIER;
        // the barge drifting west).
        "wrong way": finish(sumWith(s => s.skew ? (() => { const w = s.stated.slice(); w[p.target] += p.rate * s.stated[p.source]; return w; })() : s.stated)),
        // Every premise corrected, marked or not.
        "all marked": finish(sumWith(s => toWorld(p, s.stated))),
        // Premises right, but answered in the other reading.
        "other reading": C.sign((askWorld ? toSkew(p, D) : D)[p.target]),
    };
    if (lures.literal === truth || lures["wrong way"] === truth) return null;
    /* The marks have to matter on the path, not just somewhere. */

    const render = s => `${s.skew ? p.tag : (r.coin() ? "" : p.plain)}${s.subj} is ${C.clauses(axes, s.stated)} relative to ${s.ref}.`;
    const tw = axes[p.target];
    const question = `${p.ask[askWorld]}, is ${y} ${tw.dir[0]} or ${tw.dir[1]} relative to ${x}, or at the ${tw.tie.replace("same ", "same ")}?`;
    return {
        preset, axes, p, x, y, askWorld, truth, truthVec, lures, question,
        premises: r.shuffle(spoken.map(render)),
        depth: C.graphDist(edges, x, y),
        derivation: spoken.map(s => `${s.subj} - ${s.ref}: stated [${s.stated}]${s.skew ? ` (marked) -> world [${s.world}]` : ""}`),
        D,
    };
}

/* ---- Independent reader: parses the text, applies the stated rule. ---- */
function solveFromText(preset, axes, lines, question) {
    const p = PRESETS[preset];
    const links = [];
    for (const line of lines) {
        const skew = line.startsWith(p.tag);
        const body = line.replace(p.tag, "").replace(p.plain, "");
        const m = /^(\w+) is (.+) relative to (\w+)\.$/.exec(body);
        if (!m) throw new Error("unparsed: " + line);
        const d = C.parseClauses(axes, m[2]);
        // From the note, independently: a marked reading includes rate × source.
        if (skew) d[p.target] -= p.rate * d[p.source];
        links.push([m[3], m[1], d]);
    }
    const q = /^(.+), is (\w+) .+ relative to (\w+), or/.exec(question);
    const coords = C.walk(links[0][0], axes.length, links);
    const D = C.sub(coords[q[2]], coords[q[3]]);
    const v = q[1] === p.ask[true] ? D : (() => { const s = D.slice(); s[p.target] += p.rate * D[p.source]; return s; })();
    return C.sign(v[p.target]);
}

const word = (axes, i, s) => (s === 0 ? axes[i].tie : s > 0 ? axes[i].dir[0] : axes[i].dir[1]);

function show(it) {
    console.log("Setup: " + it.p.note.replace(/<[^>]+>/g, ""));
    console.log("       Each premise is one step on every dimension it names.");
    console.log("Premises:"); it.premises.forEach(l => console.log("  " + l));
    console.log("Question: " + it.question);
    const ax = it.p.target;
    console.log("Answer:   " + word(it.axes, ax, it.truth) + `   (vector in the asked reading [${it.truthVec}])`);
    for (const [k, v] of Object.entries(it.lures)) console.log(`  lure ${k.padEnd(13)} ${word(it.axes, ax, v)}${v === it.truth ? "   (= answer)" : ""}`);
    console.log("  derivation:"); it.derivation.forEach(l => console.log("    " + l));
    console.log(`  ${it.y} - ${it.x} in world: [${it.D}]; depth ${it.depth}`);
}

function sweep(preset, opts = {}, count = 3000) {
    const r = C.rng(99 + preset.length);
    let built = 0, tries = 0, agree = 0, depth = 0; const differs = {}; const answers = { "-1": 0, 0: 0, 1: 0 };
    while (built < count) {
        tries++;
        const it = generate(r, preset, opts);
        if (!it) continue;
        built++; depth += it.depth; answers[it.truth]++;
        if (solveFromText(preset, it.axes, it.premises, it.question) === it.truth) agree++;
        for (const [k, v] of Object.entries(it.lures)) differs[k] = (differs[k] ?? 0) + (v === it.truth ? 0 : 1);
    }
    console.log(`${preset} ${JSON.stringify(opts)}: ${built} items from ${tries} draws (${(100 * built / tries).toFixed(0)}% kept); text solver agrees ${agree}/${built}; mean depth ${(depth / built).toFixed(2)}`);
    console.log("   answer balance earlier/same/later: " + [-1, 0, 1].map(k => answers[k]).join("/"));
    console.log("   lure differs: " + Object.entries(differs).map(([k, v]) => `${k} ${(100 * v / built).toFixed(0)}%`).join(", "));
}

if (require.main === module) {
    // The two shears do not commute; together they generate SL(2,Z), which is
    // why stacking both is the ceiling rather than a rung.
    const S1 = [[1, 0], [1, 1]], S2 = [[1, 1], [0, 1]];
    const mul = (A, B) => A.map((row, i) => B[0].map((_, j) => row.reduce((s, v, k) => s + v * B[k][j], 0)));
    console.log("clocks∘drift =", JSON.stringify(mul(S1, S2)), " drift∘clocks =", JSON.stringify(mul(S2, S1)));
    console.log();
    for (const preset of ["clocks", "drift"]) {
        console.log(`=== Worked example, ${preset} (4D) ===`);
        const r = C.rng(+(process.env.SEED ?? 4242) + preset.length); let it = null;
        while (!it) it = generate(r, preset);
        show(it); console.log();
    }
    sweep("clocks"); sweep("drift");
    sweep("clocks", { n: 5, objects: 7, skewed: [3, 4] });
}

module.exports = { generate, solveFromText, PRESETS };
