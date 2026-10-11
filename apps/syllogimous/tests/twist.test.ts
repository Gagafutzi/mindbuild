/**
 * Twisted seam, held to a reader that lifts the ring to its cover.
 *
 * The generator steps in the chart: a column on the ring and offsets from the
 * centre line, mirroring at each crossing. The reader here does something else.
 * It unrolls the ring into a straight line where nothing is ever mirrored,
 * places each object at one lift there, converts each premise out of its
 * reference's frame (mirrored once per lap that lift is away from the first),
 * adds flat, and projects to the chart only at the end to see whether every
 * premise lands where it says. Two algorithms sharing nothing but the card.
 */

import { assert, equal, seeded, test } from "./harness";
import { ctxHolding, strip } from "./coupling.test";
import { Question } from "../src/app/syllogimous/models/question.models";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { createNdSpace } from "../src/app/syllogimous/generators/ndspace";
import { AXIS_CHOICES } from "../src/app/syllogimous/utils/ndspace.utils";
import { converse, land } from "../src/app/syllogimous/utils/twist.utils";
import { setSymbolRelations, symboliseStatement } from "../src/app/syllogimous/utils/phrasing";

const TYPES = [
    EnumQuestionType.Direction, EnumQuestionType.Space3D, EnumQuestionType.Space4D,
    EnumQuestionType.Space5D, EnumQuestionType.Space6D, EnumQuestionType.Space7D,
];
const CLAIM = "All of these can be true at once";
const isTwist = (q: Question) => q.conclusion === CLAIM;

/** Every word a clause can be, as a value: +1, −1, 0, or a kind (mod 2). */
const VALUE = new Map<string, number>();
for (const s of AXIS_CHOICES) {
    VALUE.set(s.direction[0], 1);
    VALUE.set(s.direction[1], -1);
    VALUE.set(s.tie, 0);
    if (s.parity) { VALUE.set(s.parity.same, 0); VALUE.set(s.parity.opposite, 1); }
}
const RING_CLAUSE = /^(\d+) steps? (clockwise|anticlockwise)$/;
const PLACED = /^(\S+) is (.+) relative to (\S+)$/;
const ANCHOR = /^(\S+) stands on the centre line, just clockwise of the twist$/;

interface Read { m: number; ring: number; acted: number; kinds: Set<number>; anchor: string;
    premises: Array<{ s: string; r: string; d: number[] }> }

function readCard(q: Question): Read {
    const setup = q.setup.map(strip).join(" ");
    const m = +/ring of (\d+) with a twist/.exec(setup)![1];
    const [, plus, minus] = /Carried across the twist, (.+?) and (.+?) trade places/.exec(setup)!;
    const actedWords = new Set([plus, minus, AXIS_CHOICES.find(a => a.direction[0] === plus)!.tie]);
    let anchor = "";
    const premises: Read["premises"] = [];
    let ring = -1, acted = -1;
    const kinds = new Set<number>();
    for (const line of q.premises.map(strip)) {
        const a = ANCHOR.exec(line);
        if (a) { anchor = a[1]; continue; }
        const p = PLACED.exec(line);
        if (!p) throw new Error(`unread premise "${line}"`);
        const clauses = p[2].split(", ");
        const d = clauses.map((c, i) => {
            const steps = RING_CLAUSE.exec(c);
            if (steps) { ring = i; return (steps[2] === "clockwise" ? 1 : -1) * +steps[1]; }
            if (actedWords.has(c)) acted = i;
            if (/kind$/.test(c)) kinds.add(i);
            if (!VALUE.has(c)) throw new Error(`unread clause "${c}"`);
            return VALUE.get(c)!;
        });
        premises.push({ s: p[1], r: p[3], d });
    }
    return { m, ring, acted, kinds, anchor, premises };
}

const mod = (n: number, m: number) => ((n % m) + m) % m;

/**
 * Whether every premise can hold, by lifting to the cover: the ring unrolled,
 * where (X, Y) and (X + m, −Y) are the same place. A premise is read in its
 * reference's frame, which is the cover's mirrored once per lap the reference's
 * lift sits from the first; added flat; and projected only to compare.
 * `flat` reads with no twist at all.
 */
function consistent(q: Question, reading: "cover" | "flat" = "cover"): boolean {
    const c = readCard(q);
    const dims = c.premises[0].d.length;
    const sigma = (X: number) => (reading === "flat" || Math.floor(X / c.m) % 2 === 0 ? 1 : -1);
    const proj = (p: number[]) => p.map((v, i) =>
        i === c.ring ? mod(v, c.m)
        : i === c.acted ? sigma(p[c.ring]) * v
        : c.kinds.has(i) ? mod(v, 2) : v).join();
    const cover = (refX: number, d: number[]) => d.map((v, i) => (i === c.acted ? sigma(refX) * v : v));

    const lift = new Map<string, number[]>([[c.anchor, Array(dims).fill(0)]]);
    for (let grew = true; grew;) {
        grew = false;
        for (const p of c.premises) {
            const r = lift.get(p.r), s = lift.get(p.s);
            if (r && !s) {
                lift.set(p.s, r.map((v, i) => v + cover(r[c.ring], p.d)[i]));
                grew = true;
            } else if (s && !r) {
                const X = s[c.ring] - p.d[c.ring];
                lift.set(p.r, s.map((v, i) => v - cover(X, p.d)[i]));
                grew = true;
            }
        }
    }
    return c.premises.every(p => {
        const r = lift.get(p.r)!, s = lift.get(p.s)!;
        return proj(r.map((v, i) => v + cover(r[c.ring], p.d)[i])) === proj(s);
    });
}

/**
 * The lure that mirrors the crossing *step* rather than the position carried
 * across, stepping in the chart: right only when the reference sits on the
 * centre line.
 */
function flipStepConsistent(q: Question): boolean {
    const c = readCard(q);
    const dims = c.premises[0].d.length;
    const crosses = (col: number, k: number) => Math.floor((col + k) / c.m) % 2 !== 0;
    const walk = (r: number[], d: number[]) => r.map((v, i) =>
        i === c.ring ? mod(v + d[i], c.m) : v + (i === c.acted && crosses(r[c.ring], d[c.ring]) ? -d[i] : d[i]));
    const norm = (p: number[]) => p.map((v, i) => (c.kinds.has(i) ? mod(v, 2) : v)).join();
    const at = new Map<string, number[]>([[c.anchor, Array(dims).fill(0)]]);
    for (let grew = true; grew;) {
        grew = false;
        for (const p of c.premises) {
            const r = at.get(p.r), s = at.get(p.s);
            if (r && !s) { at.set(p.s, walk(r, p.d)); grew = true; }
            else if (s && !r) {
                const col = mod(s[c.ring] - p.d[c.ring], c.m);
                const x = crosses(col, p.d[c.ring]);
                at.set(p.r, s.map((v, i) => (i === c.ring ? col : v - (i === c.acted && x ? -p.d[i] : p.d[i]))));
                grew = true;
            }
        }
    }
    return c.premises.every(p => norm(walk(at.get(p.r)!, p.d)) === norm(at.get(p.s)!));
}

function twistItems(type: EnumQuestionType, seed: number, perLength = 30, held = ["twisted-seam", "branching"]): Question[] {
    const out: Question[] = [];
    seeded(seed, () => {
        for (let n = 4; n <= 7; n++) {
            for (let i = 0; i < perLength; i++) {
                let q: Question;
                try { q = createNdSpace(ctxHolding(held), n, type); } catch { continue; }
                if (isTwist(q)) out.push(q);
            }
        }
    });
    return out;
}

/* ------------------------------------------------------------------ *
 * The writer, on its own                                              *
 * ------------------------------------------------------------------ */

test("Twisted seam: a converse walks back to where it started, across the twist or not", () => {
    seeded(4401, () => {
        for (let t = 0; t < 2000; t++) {
            const spec = { m: 5, ring: 0, acted: 1, dims: 3 };
            const from = [Math.floor(Math.random() * 5), Math.floor(Math.random() * 7) - 3, Math.floor(Math.random() * 3) - 1];
            const d = [Math.floor(Math.random() * 11) - 5, Math.floor(Math.random() * 3) - 1, Math.floor(Math.random() * 3) - 1];
            const to = land(spec, from, d);
            equal(land(spec, to, converse(spec, from, d)).join(), from.join(),
                `from ${from} by ${d} and back by ${converse(spec, from, d)}`);
        }
    });
});

/* ------------------------------------------------------------------ *
 * Agreement                                                           *
 * ------------------------------------------------------------------ */

test("Twisted seam: a reader lifting to the cover agrees with the marked answer", () => {
    for (const type of TYPES) {
        const qs = twistItems(type, 4500 + TYPES.indexOf(type));
        assert(qs.length >= 20, `${type}: only ${qs.length} twist items`);
        const wrong = qs.filter(q => consistent(q) !== q.isValid);
        equal(wrong.length, 0, `${type}: ${wrong.length}/${qs.length} disagree, e.g. `
            + (wrong[0] ? wrong[0].premises.map(strip).join(" / ") + ` → ${wrong[0].isValid}` : ""));
        const yes = qs.filter(q => q.isValid).length / qs.length;
        assert(yes > 0.3 && yes < 0.7, `${type}: ${(yes * 100).toFixed(0)}% of twist items hold`);
    }
});

/* ------------------------------------------------------------------ *
 * Delivery                                                            *
 * ------------------------------------------------------------------ */

test("Twisted seam: served when held, recorded when not served, and the loop priced once", () => {
    for (const type of TYPES) {
        let served = 0, other = 0;
        seeded(4600 + TYPES.indexOf(type), () => {
            for (let i = 0; i < 60; i++) {
                let q: Question;
                try { q = createNdSpace(ctxHolding(["twisted-seam"]), 5, type); } catch { continue; }
                if (isTwist(q)) {
                    served++;
                    assert(!q.undelivered.includes("twisted-seam"), `${type}: served and recorded as not`);
                    // The loop dial is at zero here, so the forced ring is charged.
                    equal(q.surcharge, 1.2, `${type}: the forced loop is not charged`);
                } else {
                    other++;
                    assert(q.undelivered.includes("twisted-seam"), `${type}: held, not served, and charged`);
                }
            }
        });
        assert(served >= 10 && other >= 10, `${type}: ${served} twist items against ${other} others`);
    }

    /* A stack with no axis that can be a loop cannot carry it. */
    const stack = ["north", "up", "contains"];
    let built = 0;
    seeded(4700, () => {
        for (let i = 0; i < 30; i++) {
            let q: Question;
            try { q = createNdSpace(ctxHolding(["twisted-seam"], {}, null, stack), 5, EnumQuestionType.Space3D); }
            catch { continue; }
            built++;
            assert(!isTwist(q), "a twist on a stack with no ring");
            assert(q.undelivered.includes("twisted-seam"), "held on a ringless stack and charged");
        }
    });
    assert(built >= 25, `a ringless stack holding the rung built ${built}/30`);

    /* Everything else held is recorded, since the twist item carries none of it. */
    const full = ["branching", "indeterminate", "analogy", "choose-conclusion", "twisted-seam"];
    for (const q of twistItems(EnumQuestionType.Space3D, 4800, 20, full)) {
        equal(q.undelivered.sort().join(), ["analogy", "choose-conclusion", "indeterminate"].join(),
            "a twist item's undelivered rungs");
    }
});

/* ------------------------------------------------------------------ *
 * The readings that fail                                              *
 * ------------------------------------------------------------------ */

test("Twisted seam: adding every clause as written is wrong on every item", () => {
    for (const type of TYPES) {
        const qs = twistItems(type, 4900 + TYPES.indexOf(type), 15);
        const right = qs.filter(q => consistent(q, "flat") === q.isValid);
        equal(right.length, 0, `${type}: the flat reading passes ${right.length}/${qs.length}`);
    }
});

test("Twisted seam: mirroring the step instead of the position fails often", () => {
    let wrong = 0, total = 0;
    for (const type of TYPES) {
        for (const q of twistItems(type, 5000 + TYPES.indexOf(type), 15)) {
            total++;
            if (flipStepConsistent(q) !== q.isValid) wrong++;
        }
    }
    assert(wrong / total >= 0.15, `mirroring the step is wrong on only ${wrong}/${total}`);
});

/* ------------------------------------------------------------------ *
 * Rendering                                                           *
 * ------------------------------------------------------------------ */

test("Twisted seam: the anchor pins the line, and no relation word survives the symbol switch", () => {
    for (const type of TYPES) {
        for (const q of twistItems(type, 5100 + TYPES.indexOf(type), 5)) {
            equal(q.premises.map(strip).filter(l => ANCHOR.test(l)).length, 1, `${type}: anchors`);
            assert(q.setup.some(l => strip(l).includes("twist in it")), `${type}: the twist is never stated`);
            setSymbolRelations(true);
            try {
                for (const line of q.premises.map(l => strip(symboliseStatement(l)))) {
                    assert(!/\b(clockwise|anticlockwise|north|south)\b/.test(line), `${type}: a word survives: ${line}`);
                }
            } finally {
                setSymbolRelations(false);
            }
        }
    }
});
