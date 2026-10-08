"use strict";
/*
 * Proposal C: heading — the facing rung with a head, in the three spatial axes.
 *
 * Today's facing (utils/facing.utils.ts) judges left/right by the sign of a 2×2
 * cross product in the first two straight axes, even in 7D. In three axes one
 * facing does not fix a frame: you also need which way the head points. Both are
 * stated relationally and fixed at statement, as the facing rung already does:
 *
 *     Ash faces Bell.  Ash's head points toward Cole.
 *     Claim: Dell is on Ash's left.
 *
 * left  = sign det[h, f, v]           (h × f is "left" for head h, forward f)
 * above = sign (h·(f·f) − f·(h·f))·v   (the head direction with its forward part removed)
 * ahead = sign f·v
 *
 * All three are integer-exact, so there is no rounding and no compass. The
 * determinant is the coupling: it reads every coordinate of three vectors at
 * once, and no single axis says anything about it.
 *
 * Run:  node heading.js
 */
const C = require("./common");

const det3 = (a, b, c) => a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const s3 = v => v.slice(0, 3);

/** Body-frame signs of v for a viewer facing f with head toward h: [ahead, left, above]. */
function bodySigns(f, h, v) {
    const up = h.map((hi, i) => hi * dot(f, f) - f[i] * dot(h, f));
    return [C.sign(dot(f, v)), C.sign(det3(h, f, v)), C.sign(dot(up, v))];
}

function generate(r, { n = 4, objects = 6, need2d = true, needUp = true, wantFlat = false } = {}) {
    const axes = C.axesFor(n);
    const words = C.NAMES.slice(0, objects);
    const edges = C.tree(r, words);
    const world = edges.map(() => C.unitDelta(r, n));
    const coords = C.walk(words[0], n, edges.map(([f, t], i) => [f, t, world[i]]));
    const at = w => s3(coords[w]);

    const options = [];
    for (const A of words) for (const B of words) for (const Cc of words) for (const Dd of words) {
        if (new Set([A, B, Cc, Dd]).size < 4) continue;
        const f = C.sub(at(B), at(A)), h = C.sub(at(Cc), at(A)), v = C.sub(at(Dd), at(A));
        if (cross(h, f).every(x => x === 0)) continue;          // head along the facing: no frame
        const [ahead, left, above] = bodySigns(f, h, v);
        if (left === 0) continue;                               // only sideways claims, as mirror-twins does
        // Lures: today's planar reading; the head assumed to be world-up; hands swapped.
        const f2 = [f[0], f[1]], v2 = [v[0], v[1]];
        const flat = (f2[0] || f2[1]) ? C.sign(f2[0] * v2[1] - f2[1] * v2[0]) : null;
        // The head assumed to point above is the SAME lure: det[(0,0,1), f, v]
        // is the planar cross product. Kept to show that, and to cover a vertical
        // facing, where the planar rule has no answer at all.
        const headUp = C.sign(det3([0, 0, 1], f, v));
        if (need2d && flat === left) continue;
        if (needUp && headUp === left) continue;
        if (wantFlat && flat === null) continue;
        options.push({ A, B, Cc, Dd, f, h, v, ahead, left, above, flat, headUp });
    }
    if (!options.length) return null;
    const o = r.pick(options);
    const claimTrue = r.coin();
    const claimed = claimTrue ? o.left : -o.left;
    const rendered = edges.map(([f, t], i) => (r.coin()
        ? `${t} is ${C.clauses(axes, world[i])} relative to ${f}.`
        : `${f} is ${C.clauses(axes, C.neg(world[i]))} relative to ${t}.`));
    return {
        axes, o, claimTrue,
        premises: [...r.shuffle(rendered), `${o.A} faces ${o.B}.`, `${o.A}'s head points toward ${o.Cc}.`],
        claim: `${o.Dd} is on ${o.A}'s ${claimed > 0 ? "left" : "right"}.`,
        options: options.length,
    };
}

/* Independent reader: rebuild positions from text, then judge with a rotation
   matrix built by Gram–Schmidt in floating point — a different method from the
   generator's integer determinant, so the two can disagree if either is wrong. */
function solveFromText(axes, lines, claim) {
    const links = []; let A, B, Cc;
    for (const l of lines) {
        let m;
        if ((m = /^(\w+) faces (\w+)\.$/.exec(l))) { A = m[1]; B = m[2]; }
        else if ((m = /^(\w+)'s head points toward (\w+)\.$/.exec(l))) Cc = m[2];
        else if ((m = /^(\w+) is (.+) relative to (\w+)\.$/.exec(l))) links.push([m[3], m[1], C.parseClauses(axes, m[2])]);
        else throw new Error("unparsed " + l);
    }
    const coords = C.walk(links[0][0], axes.length, links);
    const m = /^(\w+) is on (\w+)'s (left|right)\.$/.exec(claim);
    const p = w => s3(coords[w]).map(Number);
    const f = C.sub(p(B), p(A)), h = C.sub(p(Cc), p(A)), v = C.sub(p(m[1]), p(A));
    const norm = x => { const l = Math.hypot(...x); return x.map(y => y / l); };
    const F = norm(f);
    const U = norm(h.map((hi, i) => hi - dot(h, F) * F[i]));
    const L = cross(U, F);                       // up × forward = left (east, up -> north)
    const side = dot(L, v);
    return (side > 1e-9 ? "left" : side < -1e-9 ? "right" : "none") === m[3];
}

if (require.main === module) {
    // Sanity: facing east with head up, north is on the left.
    console.log("east/up/north ->", bodySigns([1, 0, 0], [0, 0, 1], [0, 1, 0]), "(expect [0, 1, 0])");
    console.log("east/up/above ->", bodySigns([1, 0, 0], [0, 0, 1], [0, 0, 1]), "(expect [0, 0, 1])");
    // Head pointing north instead: now 'above' (world) is on the RIGHT.
    console.log("east/north/above ->", bodySigns([1, 0, 0], [0, 1, 0], [0, 0, 1]), "(expect [0, -1, 0])");
    console.log();

    const r = C.rng(+(process.env.SEED ?? 31));
    let it = null; while (!it) it = generate(r, { wantFlat: !!process.env.FLAT });
    console.log("=== Worked example, heading (4D) ===");
    console.log("Setup: A facing is fixed when stated, and so is where the head points. Left and right are judged from both.");
    console.log("Premises:"); it.premises.forEach(l => console.log("  " + l));
    console.log("Claim:    " + it.claim + "   ->  " + (it.claimTrue ? "TRUE" : "FALSE"));
    const o = it.o;
    console.log(`  f = ${o.B}-${o.A} = [${o.f}]   h = ${o.Cc}-${o.A} = [${o.h}]   v = ${o.Dd}-${o.A} = [${o.v}]  (east, north, up)`);
    console.log(`  det[h,f,v] = ${det3(o.h, o.f, o.v)} -> ${o.left > 0 ? "left" : "right"}; body signs ahead/left/above = [${o.ahead}, ${o.left}, ${o.above}]`);
    console.log(`  lure flat (today's facing rung, plane only): ${o.flat === null ? "no answer" : o.flat > 0 ? "left" : o.flat < 0 ? "right" : "ahead/behind"}`);
    console.log(`  lure head-up (head assumed to point above):  ${o.headUp > 0 ? "left" : o.headUp < 0 ? "right" : "neither"}`);
    console.log();

    for (const [label, opts] of [["planar lure must be wrong", {}], ["no lure required", { need2d: false, needUp: false }]]) {
        const rr = C.rng(5); let built = 0, tries = 0, agree = 0, opt = 0, flatSame = 0, upSame = 0;
        while (built < 2000) {
            tries++; const x = generate(rr, opts); if (!x) continue;
            built++; opt += x.options;
            if (solveFromText(x.axes, x.premises, x.claim) === x.claimTrue) agree++;
            if (x.o.flat === x.o.left) flatSame++;
            if (x.o.headUp === x.o.left) upSame++;
        }
        console.log(`${label}: ${built} items from ${tries} layouts; float solver agrees ${agree}/${built}; mean usable quadruples per layout ${(opt / built).toFixed(1)}; flat lure right ${(100 * flatSame / built).toFixed(0)}%, head-up lure right ${(100 * upSame / built).toFixed(0)}%`);
    }
}

module.exports = { generate, bodySigns, det3 };
