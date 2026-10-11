/**
 * Cross-dimensional coupling in the composed spaces, and the three fixes it
 * stands on.
 *
 * The plan is `research/syllogimous-coupling/README.md`. Every rung there is
 * held to the same four checks: an independent solver agrees with the marked
 * answer, the rung is delivered when held, the per-axis reading fails on a
 * meaningful share of items, and what it writes renders through the real mode.
 */

import { assert, equal, seeded, test } from "./harness";
import { GeneratorContext } from "../src/app/syllogimous/generators/context";
import { ProgressionService } from "../src/app/syllogimous/services/progression.service";
import { SettingsOverrideService } from "../src/app/syllogimous/services/settings-override.service";
import { Question } from "../src/app/syllogimous/models/question.models";
import { Settings } from "../src/app/syllogimous/models/settings.models";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { Logger } from "../src/app/syllogimous/utils/logger";
import { createDistinction } from "../src/app/syllogimous/generators/distinction";
import { createNdSpace } from "../src/app/syllogimous/generators/ndspace";
import { ND_LADDER_AT_SPLIT, ladderFor } from "../src/app/syllogimous/utils/progression.utils";
import {
    AxisSpec, axesForDimensions, buildNdLayout, determinedOn, drawBridge, indeterminatePairs,
    isCircular, ndAxisColors, renderNdCoupling, renderNdPremises, withholdClauses,
} from "../src/app/syllogimous/utils/ndspace.utils";

export const strip = (h: string) => h.replace(/<[^>]+>/g, "");

/** A context holding exactly `held`, with nothing forced. */
export function ctxHolding(held: string[], forced: Record<string, unknown> = {}): GeneratorContext {
    const settings = new Settings();
    for (const t of Object.values(EnumQuestionType)) settings.question[t].enabled = true;
    const has = (_t: string, r: string) => held.includes(r);
    const ctx: GeneratorContext = {
        settings,
        logger: new Logger("error", false),
        settingsOverrideService: {
            linearOverride: (k: string) => (k in forced ? forced[k] : null),
            axesFor: () => null, circularAxes: () => null,
            spread: () => null, depthFor: () => 0, scramble: 100, rungOverride: () => null,
        } as unknown as SettingsOverrideService,
        progressionService: {
            hasRung: has, depthBonusFor: () => 0, dialFor: () => 0, mergeTarget: () => null,
        } as unknown as ProgressionService,
        forceConstruction: "off",
        hasRung: has,
        dialFor: () => 0,
        mergeTarget: () => null,
        random: (n?: number) => createDistinction(ctx, n ?? 2),
    };
    return ctx;
}

/** Up to `count` items, skipping the configurations that throw. */
export function build(ctx: GeneratorContext, type: EnumQuestionType, premises: number,
                      count: number, seed: number): Question[] {
    const out: Question[] = [];
    seeded(seed, () => {
        for (let i = 0; i < count; i++) {
            try { out.push(createNdSpace(ctx, premises, type)); } catch { /* skip */ }
        }
    });
    return out;
}

/** Everything a player has reached by the end of today's ladder. */
const fullLadder = (type: EnumQuestionType) =>
    ladderFor(type).slice(0, ladderFor(type).indexOf("mirror-twins") + 1);

const hasFacing = (q: Question) => q.premises.some(p => p.includes(">faces<"));

/* ------------------------------------------------------------------ *
 * Prerequisite 1: facing is delivered, and charged only when it is     *
 * ------------------------------------------------------------------ */

test("facing is delivered once analogy is held, and charged only where it is", () => {
    for (const type of [EnumQuestionType.Space3D, EnumQuestionType.Space4D, EnumQuestionType.Space6D]) {
        const items = build(ctxHolding(fullLadder(type)), type, 6, 160, 4401);
        assert(items.length > 100, `${type}: only ${items.length} items built`);

        const faced = items.filter(hasFacing);
        assert(faced.length > items.length * 0.2,
            `${type}: ${faced.length}/${items.length} items carried a facing with the whole `
            + "ladder held — the facing branch sits below forms that always return first");

        for (const q of items) {
            equal(q.undelivered.includes("facing"), !hasFacing(q),
                `${type}: an item ${hasFacing(q) ? "with" : "without"} a facing premise `
                + `lists facing as ${hasFacing(q) ? "undelivered" : "delivered"}`);
        }

        // Twins ride on a facing: the rule premise appears exactly when the
        // item is a twin item, and is charged exactly then.
        const twins = items.filter(q => q.premises.some(p => /mirror twin/.test(strip(p))));
        assert(twins.length > 0, `${type}: no mirror-twin items with the rung held`);
        for (const q of items) {
            const twin = q.premises.some(p => /mirror twin/.test(strip(p)));
            equal(q.undelivered.includes("mirror-twins"), !twin,
                `${type}: mirror-twins charged on an item that ${twin ? "carries" : "lacks"} one`);
        }
    }
});

test("before the rivals arrive, a facing item is still a facing item", () => {
    const held = ["branching", "indeterminate", "facing"];
    const items = build(ctxHolding(held), EnumQuestionType.Space4D, 5, 120, 4402);
    const faced = items.filter(hasFacing).length;
    assert(faced > items.length * 0.8,
        `only ${faced}/${items.length} items at the facing rung asked a facing`);
});

/* ------------------------------------------------------------------ *
 * Prerequisite 2: the one-step convention is always stated             *
 * ------------------------------------------------------------------ */

test("every composed-space item states that a premise is one step", () => {
    for (const type of [EnumQuestionType.Direction, EnumQuestionType.Space3D,
                        EnumQuestionType.Space4D, EnumQuestionType.Space7D]) {
        // Nothing held at all, which is where it used to go missing: the note
        // was tied to construct-distance, and the coupling rungs need it long
        // before that.
        const items = build(ctxHolding([]), type, 4, 20, 4403);
        assert(items.length >= 15, `${type}: only ${items.length} items built`);
        for (const q of items) {
            assert(q.setup.some(l => /one step/.test(strip(l))),
                `${type}: an item with no rungs does not say each premise is one step`);
        }
    }
});

/* ------------------------------------------------------------------ *
 * Prerequisite 3: one ladder per family, each beginning as it was      *
 * ------------------------------------------------------------------ */

test("the composed-space ladder is forked per family without renaming a rung", () => {
    const families = {
        direction: ladderFor(EnumQuestionType.Direction),
        space3d: ladderFor(EnumQuestionType.Space3D),
        spaceNd: ladderFor(EnumQuestionType.Space4D),
    };
    for (const [name, ladder] of Object.entries(families)) {
        equal(ladder.slice(0, ND_LADDER_AT_SPLIT.length), [...ND_LADDER_AT_SPLIT],
            `the ${name} ladder no longer begins with the ladder it was forked from, `
            + "so a stored rung count now names different rungs");
        assert(Object.isFrozen(ladder), `the ${name} ladder can be mutated at runtime`);
    }
    // Three separate arrays: a shared reference would let one family's
    // appended rung appear on another's ladder.
    assert(families.direction !== families.space3d && families.space3d !== families.spaceNd
        && families.direction !== families.spaceNd, "two families share one ladder array");
    for (const type of [EnumQuestionType.Space5D, EnumQuestionType.Space6D, EnumQuestionType.Space7D]) {
        assert(ladderFor(type) === families.spaceNd, `${type} is not on the 4D–7D ladder`);
    }
});

/* ------------------------------------------------------------------ *
 * An independent reader                                                *
 * ------------------------------------------------------------------ */

/*
 * Sees only the rendered card. Each clause is assigned to its axis by its
 * colour class, as a player does, and every premise becomes a linear equation
 * over (object, axis) positions; exact rational Gaussian elimination then says
 * which gaps the premises settle and what they are. Nothing here calls the
 * generator's own determinacy code — that is what it is checking.
 */

type Q = [number, number];
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a) || 1);
const norm = ([n, d]: Q): Q => { const g = gcd(n, d) * (d < 0 ? -1 : 1); return [n / g, d / g]; };
const qsub = (a: Q, b: Q): Q => norm([a[0] * b[1] - b[0] * a[1], a[1] * b[1]]);
const qmul = (a: Q, b: Q): Q => norm([a[0] * b[0], a[1] * b[1]]);
const qdiv = (a: Q, b: Q): Q => norm([a[0] * b[1], a[1] * b[0]]);
const zero = (a: Q) => a[0] === 0;

/** Rows kept reduced: each has a pivot column with coefficient 1. */
export class Solver {
    private rows: Array<{ coef: Map<string, Q>; rhs: Q; pivot: string }> = [];
    inconsistent = false;

    /** Σ coef·x = rhs. */
    add(terms: Array<[string, number]>, rhs: number) {
        let coef = new Map<string, Q>();
        for (const [v, c] of terms) {
            const cur = coef.get(v) ?? [0, 1] as Q;
            coef.set(v, norm([cur[0] + c * cur[1], cur[1]]));
        }
        let value: Q = [rhs, 1];
        ({ coef, value } = this.reduce(coef, value));
        const pivot = [...coef.keys()].find(k => !zero(coef.get(k)!));
        if (!pivot) { if (!zero(value)) this.inconsistent = true; return; }
        const p = coef.get(pivot)!;
        for (const [k, c] of coef) coef.set(k, qdiv(c, p));
        value = qdiv(value, p);
        // Keep the others reduced against the new pivot.
        for (const row of this.rows) {
            const f = row.coef.get(pivot);
            if (!f || zero(f)) continue;
            for (const [k, c] of coef) row.coef.set(k, qsub(row.coef.get(k) ?? [0, 1], qmul(f, c)));
            row.rhs = qsub(row.rhs, qmul(f, value));
        }
        this.rows.push({ coef, rhs: value, pivot });
    }

    private reduce(coef: Map<string, Q>, value: Q) {
        const out = new Map(coef);
        let v = value;
        for (const row of this.rows) {
            const f = out.get(row.pivot);
            if (!f || zero(f)) continue;
            for (const [k, c] of row.coef) out.set(k, qsub(out.get(k) ?? [0, 1], qmul(f, c)));
            v = qsub(v, qmul(f, row.rhs));
        }
        return { coef: out, value: v };
    }

    /** x_a − x_b on one axis, if the equations settle it. */
    gap(a: string, b: string, axis: number): number | null {
        if (a === b) return 0;
        const { coef, value } = this.reduce(new Map([[`${a}|${axis}`, [1, 1] as Q], [`${b}|${axis}`, [-1, 1] as Q]]), [0, 1]);
        if ([...coef.values()].some(c => !zero(c))) return null;
        const v = qsub([0, 1], value);
        return v[0] / v[1];
    }
}

const subjectsOf = (html: string) =>
    [...html.matchAll(/<span class="subject">([^<]+)<\/span>/g)].map(m => m[1]);

export interface Read {
    kind: "edge" | "bridge";
    words: string[];
    /** Per clause: axis and the signed step it names. */
    clauses: Array<{ axis: number; delta: number }>;
}

/** One premise, from its HTML. */
export function readPremise(html: string, axes: AxisSpec[]): Read {
    const colors = ndAxisColors(axes).map(c => c.split(" ").pop()!);
    const clauses = [...html.matchAll(/<span class="highlight dim (dim-\d+)">([^<]+)<\/span>/g)].map(m => {
        const axis = colors.indexOf(m[1]);
        assert(axis >= 0, `a clause in a colour no axis has: ${m[0]}`);
        const s = axes[axis].scale;
        const delta = m[2] === s.direction[0] ? 1 : m[2] === s.direction[1] ? -1 : m[2] === s.tie ? 0 : NaN;
        assert(!Number.isNaN(delta), `"${m[2]}" is not a word of the ${s.name} axis`);
        return { axis, delta };
    });
    return { kind: /as many/.test(strip(html)) ? "bridge" : "edge", words: subjectsOf(html), clauses };
}

/** How the reader takes a bridge: as written, or one of the misreadings. */
export type Reading = "true" | "one-step" | "reversed" | "per-axis";

export function solve(premises: string[], axes: AxisSpec[], reading: Reading = "true"): Solver {
    const sys = new Solver();
    for (const html of premises) {
        const r = readPremise(html, axes);
        if (r.kind === "edge") {
            const [to, from] = r.words;
            for (const c of r.clauses) sys.add([[`${to}|${c.axis}`, 1], [`${from}|${c.axis}`, -1]], c.delta);
            continue;
        }
        const [R, B, G, H] = r.words;
        const [x, y] = r.clauses;
        if (reading === "per-axis") continue;
        if (reading === "one-step") {
            sys.add([[`${R}|${x.axis}`, 1], [`${B}|${x.axis}`, -1]], x.delta);
            continue;
        }
        // sx·(R − B) = ±sy·(G − H)
        const flip = reading === "reversed" ? -1 : 1;
        sys.add([[`${R}|${x.axis}`, x.delta], [`${B}|${x.axis}`, -x.delta],
                 [`${G}|${y.axis}`, -flip * y.delta], [`${H}|${y.axis}`, flip * y.delta]], 0);
    }
    return sys;
}

/** A claim of the "A is c1, c2 … relative to B" shape, or a one-axis claim. */
function claimHolds(text: string, sys: Solver, axes: AxisSpec[]): boolean {
    const [a, b] = subjectsOf(text);
    const wide = readPremise(text, axes).clauses;
    if (wide.length) {
        // Necessity semantics: an unsettled gap makes the claim false.
        return wide.every(c => {
            const g = sys.gap(a, b, c.axis);
            return g != null && Math.sign(g) === c.delta;
        });
    }
    const colors = ndAxisColors(axes).map(c => c.split(" ").pop()!);
    const m = /<span class="relation dim (dim-\d+)">([^<]+)<\/span>/.exec(text);
    assert(!!m, `no claim could be read from: ${strip(text)}`);
    const axis = colors.indexOf(m![1]);
    const s = axes[axis].scale;
    const want = m![2] === s.above ? 1 : m![2] === s.below ? -1 : 0;
    const g = sys.gap(a, b, axis);
    return g != null && Math.sign(g) === want;
}

function analogyHolds(text: string, sys: Solver, axes: AxisSpec[]): boolean {
    const [a, b, c, d] = subjectsOf(text);
    const same = /same relation/.test(strip(text));
    return axes.every((_, i) => {
        const one = sys.gap(b, a, i), two = sys.gap(d, c, i);
        if (one == null || two == null) return false;
        return Math.sign(two) === (same ? 1 : -1) * Math.sign(one);
    });
}

/**
 * Whether a reader taking the bridge this way gives the keyed answer.
 *
 * A boolean is judged by necessity; a choice is right only if exactly the keyed
 * option holds; a construction only if every slot is settled and matches.
 */
export function readerAgrees(q: Question, axes: AxisSpec[], reading: Reading): boolean {
    const sys = solve(q.premises, axes, reading);
    if (sys.inconsistent) return false;
    const holds = (t: string) => /pair-to/.test(t) ? analogyHolds(t, sys, axes) : claimHolds(t, sys, axes);

    if (q.answerMode === "construct") {
        return q.construct.every(claim => claim.slots.every((slot, i) => {
            const g = sys.gap(claim.a, claim.b, i);
            if (g == null) return false;
            const dir = g === 0 ? 2 : g > 0 ? 0 : 1;
            return dir === slot.answerDirection && (!slot.asksDistance || Math.abs(g) === slot.answerMagnitude);
        }));
    }
    if (q.answerMode === "choice") {
        const judged = q.choices.map(holds);
        return judged.filter(Boolean).length === 1 && judged[q.correctChoice];
    }
    if (q.series.length > 1) return q.series.every(c => holds(c.text) === c.isValid);
    // Several claims in one conclusion: true only if every one holds.
    if (Array.isArray(q.conclusion)) return q.conclusion.every(holds) === q.isValid;
    return holds(String(q.conclusion)) === q.isValid;
}

/** The pairs an item asks about, in whatever form it asks. */
function askedPairs(q: Question): Array<[string, string]> {
    if (q.answerMode === "construct") return q.construct.map(c => [c.a, c.b]);
    const texts = q.answerMode === "choice" ? q.choices
        : q.series.length > 1 ? q.series.map(s => s.text)
        : Array.isArray(q.conclusion) ? q.conclusion : [String(q.conclusion)];
    return texts.flatMap(t => {
        const s = subjectsOf(t);
        return s.length === 4 ? [[s[0], s[1]], [s[2], s[3]]] as Array<[string, string]> : [[s[0], s[1]]];
    });
}

/* ------------------------------------------------------------------ *
 * Bridges                                                              *
 * ------------------------------------------------------------------ */

const isBridged = (q: Question) => q.premises.some(p => /as many/.test(strip(p)));
const bridgePremise = (q: Question) => q.premises.find(p => /as many/.test(strip(p)))!;

/** Bridged items under several answer forms, with the axes they were built on. */
function bridgedItems(type: EnumQuestionType, held: string[], count: number, seed: number) {
    const axes = axesForDimensions(dimsOf[type]).map(scale => ({ scale }) as AxisSpec);
    const items = build(ctxHolding(held), type, 6, count, seed).filter(isBridged);
    return { axes, items };
}
const dimsOf: Record<string, number> = {
    [EnumQuestionType.Direction]: 2, [EnumQuestionType.Space3D]: 3, [EnumQuestionType.Space4D]: 4,
    [EnumQuestionType.Space5D]: 5, [EnumQuestionType.Space6D]: 6, [EnumQuestionType.Space7D]: 7,
};

/** Rung sets that put every conclusion form on a bridged item. */
const FORMS: Record<string, string[]> = {
    plain: ["branching", "indeterminate", "bridges"],
    choice: ["branching", "indeterminate", "choose-conclusion", "bridges"],
    construct: ["branching", "indeterminate", "construct-conclusion", "construct-distance", "bridges"],
    analogy: ["branching", "indeterminate", "analogy", "bridges"],
};

test("bridges: the marked answer is what an independent reader solves from the text", () => {
    let checked = 0;
    for (const [form, held] of Object.entries(FORMS)) {
        for (const type of [EnumQuestionType.Space3D, EnumQuestionType.Space4D, EnumQuestionType.Space6D]) {
            const { axes, items } = bridgedItems(type, held, 60, 5101);
            assert(items.length >= 15, `${form} ${type}: only ${items.length} bridged items`);
            for (const q of items) {
                const sys = solve(q.premises, axes);
                assert(!sys.inconsistent, `${form} ${type}: the premises contradict each other`);
                // The bridge's own words hold where the generator put things.
                const r = readPremise(bridgePremise(q), axes);
                const [R, B, G, H] = r.words;
                const at = q.wordCoordMap!;
                equal(r.clauses[0].delta * (at[R][r.clauses[0].axis] - at[B][r.clauses[0].axis]),
                    r.clauses[1].delta * (at[G][r.clauses[1].axis] - at[H][r.clauses[1].axis]),
                    `${form} ${type}: the bridge does not hold in the arrangement`);
                assert(readerAgrees(q, axes, "true"),
                    `${form} ${type}: the reader disagrees with the key on\n  `
                    + [...q.premises, String(q.conclusion), ...q.choices].map(strip).join("\n  "));
                checked++;
            }
        }
    }
    assert(checked > 150, `only ${checked} items checked`);
});

test("bridges: the bridge is load-bearing for every pair the item asks about", () => {
    for (const [form, held] of Object.entries(FORMS)) {
        const { axes, items } = bridgedItems(EnumQuestionType.Space4D, held, 60, 5102);
        for (const q of items) {
            const bridge = readPremise(bridgePremise(q), axes);
            const X = bridge.clauses[0].axis;
            const without = solve(q.premises, axes, "per-axis");
            const withIt = solve(q.premises, axes);
            const open = askedPairs(q).filter(([a, b]) => without.gap(a, b, X) == null);
            assert(open.length > 0,
                `${form}: no asked pair crosses the cut, so the bridge is decorative`);
            for (const [a, b] of open) {
                assert(withIt.gap(a, b, X) != null, `${form}: the bridge does not settle ${a}–${b}`);
            }
            // Its source gap is derived, never read off one premise.
            const [, , G, H] = bridge.words;
            const direct = q.premises.some(p => {
                const s = subjectsOf(p);
                return s.length === 2 && s.includes(G) && s.includes(H);
            });
            assert(!direct, `${form}: one premise states the bridge's source gap outright`);
        }
    }
});

test("bridges: reading the axes one at a time fails on a meaningful share", () => {
    for (const [form, held] of Object.entries(FORMS)) {
        const { axes, items } = bridgedItems(EnumQuestionType.Space4D, held, 80, 5103);
        const fails = (reading: Reading) => items.filter(q => !readerAgrees(q, axes, reading)).length;
        const share = (n: number) => n / items.length;
        const perAxis = fails("per-axis"), oneStep = fails("one-step"), reversed = fails("reversed");
        // Measured roughly 0.5 on booleans — a necessity claim the reader
        // cannot settle is called false, which is right whenever the claim
        // is — and 1.0 on constructions and choices.
        assert(share(perAxis) >= 0.4, `${form}: carrying each axis alone fails only ${perAxis}/${items.length}`);
        assert(share(oneStep) >= 0.4, `${form}: the bridge read as one step fails only ${oneStep}/${items.length}`);
        assert(share(reversed) >= 0.4, `${form}: the bridge read backwards fails only ${reversed}/${items.length}`);
    }
});

test("bridges: closeAxes agrees with Gaussian rank", () => {
    let queries = 0, open = 0;
    seeded(5104, () => {
        for (let n = 0; n < 1000; n++) {
            const dims = 2 + (n % 5);
            const axes = axesForDimensions(dims).map(scale => ({ scale }) as AxisSpec);
            const words = ["A", "B", "C", "D", "E", "F", "G"].slice(0, 5 + (n % 3));
            const drawn = buildNdLayout(words, axes, { branching: n % 2 === 0 });
            const bridged = drawBridge(drawn);
            if (!bridged) continue;
            // Some with a further clause withheld, so a bridge's source can
            // itself be open and the fixpoint has something to refuse.
            const layout = n % 3 === 0 ? withholdClauses(bridged, 1) : bridged;
            const premises = [
                ...renderNdPremises(layout),
                ...layout.couplings!.map(c => renderNdCoupling(layout, c)),
            ];
            const sys = solve(premises, axes);
            for (const a of words) for (const b of words) {
                if (a >= b) continue;
                axes.forEach((_, ax) => {
                    const settled = sys.gap(a, b, ax) != null;
                    if (!settled) open++;
                    queries++;
                    equal(determinedOn(layout, ax, a, b), settled,
                        `determinedOn says ${a}–${b} on ${axes[ax].scale.name} is `
                        + `${settled ? "open" : "settled"}; the equations say otherwise`);
                });
            }
            for (const o of indeterminatePairs(layout)) {
                assert(sys.gap(o.a, o.b, o.axis) == null,
                    `indeterminatePairs calls ${o.a}–${o.b} open, and the bridge settles it`);
            }
        }
    });
    assert(queries > 20000 && open > 500, `too few checks: ${queries} queries, ${open} open`);
});

test("bridges: delivered when held, and charged only where delivered", () => {
    for (const type of [EnumQuestionType.Direction, EnumQuestionType.Space3D,
                        EnumQuestionType.Space4D, EnumQuestionType.Space7D]) {
        const held = [...fullLadder(type), "bridges"];
        assert(ladderFor(type).includes("bridges"), `${type}: bridges is not on its ladder`);
        const items = build(ctxHolding(held), type, 6, 120, 5105);
        assert(items.length > 80, `${type}: only ${items.length} items built`);
        const bridged = items.filter(isBridged);
        assert(bridged.length > items.length * 0.3,
            `${type}: ${bridged.length}/${items.length} items carried a bridge with the rung held`);
        for (const q of items) {
            equal(q.undelivered.includes("bridges"), !isBridged(q),
                `${type}: bridges charged on an item that ${isBridged(q) ? "carries" : "lacks"} one`);
        }
        // What stepped aside for the bridge is not charged either.
        for (const q of bridged) {
            equal(q.premises.length, 6, `${type}: the bridge was added on top of the premise count`);
            assert(q.undelivered.includes("testimony") && q.undelivered.includes("facing"),
                `${type}: a bridged item is still charged for testimony or facing`);
            assert(!hasFacing(q) && !q.premises.some(p => / says: /.test(strip(p))),
                `${type}: a bridged item also carries a facing or a report`);
        }
    }
});

test("bridges: rendered in the axes' own colours, with the notes it needs", () => {
    const { axes, items } = bridgedItems(EnumQuestionType.Space5D, FORMS.plain, 60, 5106);
    const colors = ndAxisColors(axes);
    assert(items.length > 10, `only ${items.length} bridged items`);
    for (const q of items) {
        const html = bridgePremise(q);
        const r = readPremise(html, axes);
        equal(r.words.length, 4, `the bridge names ${r.words.length} objects: ${strip(html)}`);
        equal(r.clauses.length, 2, `the bridge has ${r.clauses.length} coloured clauses: ${strip(html)}`);
        assert(r.clauses[0].axis !== r.clauses[1].axis, "both halves of the bridge are on one axis");
        for (const c of r.clauses) {
            assert(html.includes(`class="highlight ${colors[c.axis]}"`),
                `a half of the bridge is not painted as ${axes[c.axis].scale.name}`);
            assert(!isCircular(axes[c.axis]) && axes[c.axis].scale.parity == null,
                "a bridge on a loop or a parity axis");
        }
        const setup = q.setup.map(strip).join(" ");
        assert(/as many steps/.test(setup), "the bridge convention is not stated");
        assert(/does not name is unknown/.test(setup), "an omitted dimension is not said to be unknown");
        assert(/one step/.test(setup), "the one-step convention is not stated");
    }
    // The derivation crosses the bridge where it explains the bridged axis.
    const explained = items.filter(q => q.explanation.some(l => /by the bridge/.test(strip(l))));
    assert(explained.length > items.length * 0.3,
        `only ${explained.length}/${items.length} derivations show the bridge being used`);
});
