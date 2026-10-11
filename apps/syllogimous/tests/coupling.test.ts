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
    AXIS_CHOICES, AxisSpec, axesForDimensions, buildNdLayout, determinedOn, drawBridge, indeterminatePairs,
    isCircular, ndAxisColors, renderNdCoupling, renderNdPremises, withholdClauses,
} from "../src/app/syllogimous/utils/ndspace.utils";

export const strip = (h: string) => h.replace(/<[^>]+>/g, "");

/** A context holding exactly `held`, with nothing forced. */
export function ctxHolding(held: string[], forced: Record<string, unknown> = {},
                           loops: number | null = null, stack: string[] | null = null): GeneratorContext {
    const settings = new Settings();
    for (const t of Object.values(EnumQuestionType)) settings.question[t].enabled = true;
    const has = (_t: string, r: string) => held.includes(r);
    const ctx: GeneratorContext = {
        settings,
        logger: new Logger("error", false),
        settingsOverrideService: {
            linearOverride: (k: string) => (k in forced ? forced[k] : null),
            axesFor: () => stack && stack.map(id => AXIS_CHOICES.find(a => a.id === id)!),
            circularAxes: () => loops,
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
    kind: "edge" | "bridge" | "anchor";
    words: string[];
    /** Per clause: axis and the signed step it names (steps round, on a loop). */
    clauses: Array<{ axis: number; delta: number }>;
    /** Stated by local clocks. */
    local: boolean;
}

/** A clause's signed step, or on a loop its displacement round. */
function clauseValue(word: string, axis: AxisSpec): number {
    const s = axis.scale;
    // Classes, not positions: any representative of the parity will do, since
    // the reader only ever compares it mod 2.
    if (s.parity) return word === s.parity.same ? 0 : word === s.parity.opposite ? 1 : NaN;
    if (word === s.tie) return 0;
    if (isCircular(axis)) {
        const c = s.cyclic!, m = axis.modulus!;
        if (word === c.direction[0]) return 1;
        if (word === c.direction[1]) return m - 1;
        if (word === c.oppositeClause) return m / 2;
        const n = /^(\d+) steps? (\S+)$/.exec(word);
        assert(!!n, `"${word}" is not a word of the looped ${s.name} axis`);
        return n![2] === c.direction[0] ? Number(n![1]) : mod(-Number(n![1]), m);
    }
    // A counted clause, on an axis that states its unit: "3 min later".
    const counted = /^(\d+) \S+ (\S+)$/.exec(word);
    if (counted) return Number(counted[1]) * (counted[2] === s.direction[0] ? 1 : -1);
    const d = word === s.direction[0] ? 1 : word === s.direction[1] ? -1 : NaN;
    assert(!Number.isNaN(d), `"${word}" is not a word of the ${s.name} axis`);
    return d;
}

/** One premise, from its HTML. */
export function readPremise(html: string, axes: AxisSpec[]): Read {
    const colors = ndAxisColors(axes).map(c => c.split(" ").pop()!);
    const plain = strip(html);
    const clauses = [...html.matchAll(/<span class="highlight dim (dim-\d+)">([^<]+)<\/span>/g)].map(m => {
        const axis = colors.indexOf(m[1]);
        assert(axis >= 0, `a clause in a colour no axis has: ${m[0]}`);
        return { axis, delta: /date line/.test(plain) ? 0 : clauseValue(m[2], axes[axis]) };
    });
    return {
        kind: /date line/.test(plain) ? "anchor" : /as many/.test(plain) ? "bridge" : "edge",
        words: subjectsOf(html),
        clauses,
        local: /^By local clocks/.test(plain),
    };
}

/** How the reader takes a bridge: as written, or one of the misreadings. */
export type Reading = "true" | "one-step" | "reversed" | "per-axis";

export function solve(premises: string[], axes: AxisSpec[], reading: Reading = "true"): Solver {
    const sys = new Solver();
    for (const html of premises) {
        const r = readPremise(html, axes);
        if (r.kind === "anchor") continue;
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

/** What any reader settles: a gap per pair and axis, or nothing. */
export interface Gaps { gap(a: string, b: string, axis: number): number | null; inconsistent?: boolean }

const mod = (n: number, m: number) => ((n % m) + m) % m;

/** Whether a gap matches a claimed clause value, on a line or a loop. */
const matches = (g: number | null, want: number, axis: AxisSpec) =>
    g != null && (axis.scale.parity ? mod(g, 2) === mod(want, 2)
        : isCircular(axis) ? mod(g, axis.modulus!) === mod(want, axis.modulus!) : Math.sign(g) === want);

/** A claim of the "A is c1, c2 … relative to B" shape, or a one-axis claim. */
function claimHolds(text: string, sys: Gaps, axes: AxisSpec[]): boolean {
    const [a, b] = subjectsOf(text);
    const wide = readPremise(text, axes).clauses;
    if (wide.length) {
        // Necessity semantics: an unsettled gap makes the claim false.
        return wide.every(c => matches(sys.gap(a, b, c.axis), c.delta, axes[c.axis]));
    }
    const colors = ndAxisColors(axes).map(c => c.split(" ").pop()!);
    const m = /<span class="relation dim (dim-\d+)">([^<]+)<\/span>/.exec(text);
    assert(!!m, `no claim could be read from: ${strip(text)}`);
    const axis = colors.indexOf(m![1]);
    const s = axes[axis].scale;
    assert(!isCircular(axes[axis]), `a one-axis claim on a loop: ${strip(text)}`);
    if (s.parity) return matches(sys.gap(a, b, axis), m![2] === s.parity.sameRelation ? 0 : 1, axes[axis]);
    const want = m![2] === s.above ? 1 : m![2] === s.below ? -1 : 0;
    return matches(sys.gap(a, b, axis), want, axes[axis]);
}

function analogyHolds(text: string, sys: Gaps, axes: AxisSpec[]): boolean {
    const [a, b, c, d] = subjectsOf(text);
    const same = /same relation/.test(strip(text));
    return axes.every((axis, i) => {
        const one = sys.gap(b, a, i), two = sys.gap(d, c, i);
        if (one == null || two == null) return false;
        if (axis.scale.parity) return mod(two, 2) === mod(one, 2);
        if (isCircular(axis)) return mod(two, axis.modulus!) === mod(same ? one : -one, axis.modulus!);
        return Math.sign(two) === (same ? 1 : -1) * Math.sign(one);
    });
}

/**
 * Whether a reader that settles these gaps gives the keyed answer.
 *
 * A boolean is judged by necessity; a choice is right only if exactly the keyed
 * option holds; a construction only if every slot is settled and matches.
 */
export function judge(q: Question, axes: AxisSpec[], sys: Gaps): boolean {
    if (sys.inconsistent) return false;
    const holds = (t: string) => /pair-to/.test(t) ? analogyHolds(t, sys, axes) : claimHolds(t, sys, axes);

    if (q.answerMode === "construct") {
        return q.construct.every(claim => claim.slots.every((slot, i) => {
            const g = sys.gap(claim.a, claim.b, i);
            if (g == null) return false;
            if (axes[i].scale.parity) return (mod(g, 2) === 0 ? 0 : 1) === slot.answerDirection;
            if (isCircular(axes[i])) {
                const m = axes[i].modulus!, steps = mod(g, m), forward = steps <= m / 2;
                const dir = steps === 0 ? 2 : forward ? 0 : 1;
                return dir === slot.answerDirection
                    && (!slot.asksDistance || (forward ? steps : m - steps) === slot.answerMagnitude);
            }
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

export function readerAgrees(q: Question, axes: AxisSpec[], reading: Reading): boolean {
    return judge(q, axes, solve(q.premises, axes, reading));
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

/* ------------------------------------------------------------------ *
 * Local clocks                                                         *
 * ------------------------------------------------------------------ */

export type ClockReading = "true" | "literal" | "wrong-way" | "no-date-line" | "all-corrected" | "other-reading";

/**
 * The clock rule applied exactly as the setup states it.
 *
 * Positions off the time axis come from the clauses as written. Zones are the
 * east positions — on a loop, counted round from the anchored object and
 * numbered 1 to m. A marked premise's time clause is a difference of local
 * readings, so its real gap is the clause minus the zone change; the answer
 * is then read on whichever clock the setup says the question uses.
 */
export function readClocks(q: Question, axes: AxisSpec[], how: ClockReading = "true"): Gaps {
    const T = axes.findIndex(a => a.scale.id === "temporal");
    const S = axes.findIndex(a => a.scale.id === "east");
    const ring = isCircular(axes[S]);
    const asked = q.setup.some(l => /Answer <b>by local clocks/.test(l)) ? "local" : "station";
    const reading = how === "other-reading" ? (asked === "local" ? "station" : "local") : asked;
    const reads = q.premises.map(p => readPremise(p, axes));

    const space = new Solver();
    for (const r of reads) {
        if (r.kind !== "edge") continue;
        const [to, from] = r.words;
        for (const c of r.clauses) {
            if (c.axis === T) continue;
            // A loop's clause is one step either way round; carried unwrapped.
            const step = ring && c.axis === S && c.delta === axes[S].modulus! - 1 ? -1 : c.delta;
            space.add([[`${to}|${c.axis}`, 1], [`${from}|${c.axis}`, -1]], step);
        }
    }
    const anchor = reads.find(r => r.kind === "anchor");
    const ref = anchor?.words[0] ?? reads[0].words[0];
    const at = anchor ? Number(/zone (\d+) of/.exec(strip(q.premises[reads.indexOf(anchor)]))![1]) : 0;
    const zone = (w: string) => {
        const g = space.gap(w, ref, S)!;
        return ring ? mod(at - 1 + g, axes[S].modulus!) + 1 : g;
    };

    const time = new Solver();
    for (const r of reads) {
        if (r.kind !== "edge") continue;
        const [to, from] = r.words;
        const said = r.clauses.find(c => c.axis === T)!.delta;
        const shift = zone(to) - zone(from);
        const eastStep = space.gap(to, from, S)!;
        const real =
            how === "literal" ? said
            : how === "all-corrected" ? said - shift
            : !r.local ? said
            : how === "wrong-way" ? said + shift
            : how === "no-date-line" ? said - eastStep
            : said - shift;
        time.add([[`${to}|${T}`, 1], [`${from}|${T}`, -1]], real);
    }
    return {
        inconsistent: space.inconsistent || time.inconsistent,
        gap(a, b, axis) {
            if (axis !== T) return space.gap(a, b, axis);
            const g = time.gap(a, b, T);
            if (g == null) return null;
            return reading === "local" ? g + zone(a) - zone(b) : g;
        },
    };
}

const isClocked = (q: Question) => q.premises.some(p => /^By local clocks/.test(strip(p)));

function clockedItems(type: EnumQuestionType, held: string[], count: number, seed: number, loops: number | null = null) {
    const ctx = ctxHolding(held, {}, loops);
    const items = build(ctx, type, 6, count, seed).filter(isClocked);
    // The axes as the generator drew them: loops go on cyclic axes, east first.
    const axes = axesForDimensions(dimsOf[type]).map(scale => ({ scale }) as AxisSpec);
    return { items, axesFor: (q: Question) => {
        const looped = q.setup.find(l => /is a loop of|zones/.test(strip(l)));
        const m = looped ? Number(/(?:loop of|is) (\d+)/.exec(strip(looped))?.[1]) : 0;
        return axes.map(a => (a.scale.id === "east" && m ? { ...a, modulus: m } : a));
    } };
}

const CLOCK_FORMS: Record<string, string[]> = {
    plain: ["branching", "indeterminate", "local-clocks"],
    choice: ["branching", "indeterminate", "choose-conclusion", "local-clocks"],
    construct: ["branching", "indeterminate", "construct-conclusion", "construct-distance", "local-clocks"],
    analogy: ["branching", "indeterminate", "analogy", "local-clocks"],
};

test("local clocks: the marked answer is what the setup's rule gives, on a line and on a loop", () => {
    let checked = 0;
    for (const loops of [null, 1]) {
        for (const [form, held] of Object.entries(CLOCK_FORMS)) {
            for (const type of [EnumQuestionType.Space4D, EnumQuestionType.Space5D, EnumQuestionType.Space7D]) {
                const { items, axesFor } = clockedItems(type, held, 40, 5201, loops);
                assert(items.length >= 8, `${form} ${type} loops=${loops}: only ${items.length} clocked items`);
                for (const q of items) {
                    const axes = axesFor(q);
                    const marked = q.premises.filter(p => /^By local clocks/.test(strip(p))).length;
                    const plain = q.premises.filter(p => readPremise(p, axes).kind === "edge").length - marked;
                    assert(marked >= 1 && plain >= 1,
                        `${form} ${type}: ${marked} marked and ${plain} unmarked — the correction telescopes`);
                    if (loops) {
                        assert(q.premises.some(p => /date line/.test(strip(p))),
                            `${form} ${type}: a looped east axis and no zone anchor`);
                    }
                    assert(judge(q, axes, readClocks(q, axes)),
                        `${form} ${type} loops=${loops}: the clocks run the wrong way — the setup's rule `
                        + `disagrees with the key on\n  `
                        + [...q.setup, ...q.premises, String(q.conclusion), ...q.choices].map(strip).join("\n  "));
                    checked++;
                }
            }
        }
    }
    assert(checked > 200, `only ${checked} items checked`);
});

test("local clocks: reading the time column alone fails, and so does correcting the wrong way", () => {
    for (const loops of [null, 1]) {
        for (const [form, held] of Object.entries(CLOCK_FORMS)) {
            const { items, axesFor } = clockedItems(EnumQuestionType.Space4D, held, 80, 5202, loops);
            const fails = (how: ClockReading) =>
                items.filter(q => !judge(q, axesFor(q), readClocks(q, axesFor(q), how))).length / items.length;
            // A choice or a construction states the time answer outright, so the
            // enforced misreadings are wrong on every one. A true/false claim can
            // lie with only one misreading's value, so each is wrong on part.
            const enforced = form === "choice" || form === "construct" ? 1 : 0.4;
            const shares = {
                literal: fails("literal"), "wrong-way": fails("wrong-way"),
                ...(loops ? { "no-date-line": fails("no-date-line") } : {}),
            };
            for (const [how, share] of Object.entries(shares)) {
                assert(share >= enforced, `${form} loops=${loops}: the ${how} reading fails only `
                    + `${Math.round(share * 100)}% of ${items.length}`);
            }
            // Measured, not enforced: correcting every premise, and answering on
            // the other clock.
            for (const how of ["all-corrected", "other-reading"] as ClockReading[]) {
                assert(fails(how) >= 0.25, `${form} loops=${loops}: the ${how} reading fails only `
                    + `${Math.round(fails(how) * 100)}%`);
            }
        }
    }
});

test("local clocks: time answers are not mostly 'same time'", () => {
    const { items } = clockedItems(EnumQuestionType.Space4D, CLOCK_FORMS.construct, 150, 5203);
    const T = axesForDimensions(4).findIndex(s => s.id === "temporal");
    const counts = [0, 0, 0];
    for (const q of items) for (const c of q.construct) counts[c.slots[T].answerDirection]++;
    const total = counts.reduce((a, b) => a + b, 0);
    for (const [i, n] of counts.entries()) {
        const share = n / total;
        assert(share > 0.2 && share < 0.47,
            `time answer class ${["later", "earlier", "same"][i]} is ${Math.round(share * 100)}% of ${total}`);
    }
});

test("local clocks: delivered on 4D–7D when held, charged only where delivered, never in 2D or 3D", () => {
    for (const type of [EnumQuestionType.Space4D, EnumQuestionType.Space6D, EnumQuestionType.Space7D]) {
        const held = [...fullLadder(type), "bridges", "local-clocks"];
        const items = build(ctxHolding(held), type, 6, 160, 5204);
        const clocked = items.filter(isClocked);
        assert(clocked.length > items.length * 0.15,
            `${type}: ${clocked.length}/${items.length} items read clocks with the rung held`);
        for (const q of items) {
            equal(q.undelivered.includes("local-clocks"), !isClocked(q),
                `${type}: local-clocks charged on an item that ${isClocked(q) ? "reads" : "lacks"} clocks`);
            assert(!(isClocked(q) && isBridged(q)), `${type}: one item carries two couplings`);
        }
        for (const q of clocked) {
            equal(q.premises.length, 6, `${type}: a clocked item has ${q.premises.length} premises`);
            assert(q.undelivered.includes("indeterminate"),
                `${type}: a clocked item withholds nothing and is still charged for under-specification`);
        }
    }
    for (const type of [EnumQuestionType.Direction, EnumQuestionType.Space3D]) {
        assert(!ladderFor(type).includes("local-clocks"), `${type} offers local clocks with no time axis`);
    }
    // A stack the picker left without time: held, never delivered, never charged.
    const timeless = build(ctxHolding(["local-clocks"], {}, null, ["east", "north", "up", "contains"]),
        EnumQuestionType.Space4D, 6, 40, 5205);
    assert(timeless.length > 30, `only ${timeless.length} timeless items built`);
    for (const q of timeless) {
        assert(!isClocked(q), "clocks on a stack with no time axis");
        assert(q.undelivered.includes("local-clocks"), "local clocks charged on a stack with no time axis");
    }
});

test("local clocks: the marks, the rule and the clock asked are all on the card", () => {
    for (const loops of [null, 1]) {
        const { items, axesFor } = clockedItems(EnumQuestionType.Space5D, CLOCK_FORMS.plain, 60, 5206, loops);
        for (const q of items) {
            const setup = q.setup.map(strip).join(" ");
            assert(/Clocks are local/.test(setup), "the clock rule is not stated");
            assert(/by local clocks/.test(setup), "the mark is not explained");
            assert(/Answer by (the station clock|local clocks)/.test(setup), "the clock asked is not named");
            assert(/one step/.test(setup), "the one-step convention is not stated");
            if (loops) assert(/date line/.test(setup) && /sets a clock back/.test(setup),
                "the date line, and the jump it makes, are not stated");
            const marked = q.premises.filter(p => /^By local clocks/.test(strip(p)));
            for (const p of marked) {
                const r = readPremise(p, axesFor(q));
                equal(r.clauses.length, axesFor(q).length, `a marked premise drops a clause: ${strip(p)}`);
            }
        }
        const walked = items.filter(q => q.explanation.some(l => /by local clocks/.test(strip(l))));
        assert(walked.length > items.length * 0.3,
            `loops=${loops}: only ${walked.length}/${items.length} derivations correct a local reading`);
    }
});

/* ------------------------------------------------------------------ *
 * The light cone                                                       *
 * ------------------------------------------------------------------ */

const TRAVEL = new Set(["east", "north", "up", "vertical", "horizontal"]);

type ConeRead = {
    gapsAt(slack: number[]): Solver;
    reaches: number;
    space: Solver;
    travel: number[];
    T: number;
    route(a: string, b: string): number;
    reads: Read[];
    forms: Array<"exact" | "signal" | "reach">;
};

/**
 * The cone's premises, from the card.
 *
 * Space from the clauses as written. Time: a stated clause is a fixed gap, a
 * signal premise's gap is its own taxicab length on the hearer's side, and a
 * reach premise's is that length plus some slack the card does not give —
 * `gapsAt` solves for one choice of every slack.
 */
function readCone(q: Question, axes: AxisSpec[]): ConeRead {
    const T = axes.findIndex(a => a.scale.id === "temporal");
    const travel = axes.map((a, i) => (TRAVEL.has(a.scale.id) ? i : -1)).filter(i => i >= 0);
    const reads = q.premises.map(p => readPremise(p, axes));
    const forms = q.premises.map(p => /rang the moment/.test(strip(p)) ? "signal" as const
        : /rang only after/.test(strip(p)) ? "reach" as const : "exact" as const);
    const space = new Solver();
    for (const r of reads) {
        const [to, from] = r.words;
        for (const c of r.clauses) if (c.axis !== T) space.add([[`${to}|${c.axis}`, 1], [`${from}|${c.axis}`, -1]], c.delta);
    }
    const len = (a: string, b: string) => travel.reduce((t, i) => t + Math.abs(space.gap(a, b, i)!), 0);
    const gapsAt = (slack: number[]) => {
        const time = new Solver();
        let k = 0;
        reads.forEach((r, i) => {
            const [to, from] = r.words;
            const gap = forms[i] === "exact" ? r.clauses.find(c => c.axis === T)!.delta
                : forms[i] === "signal" ? len(to, from)
                : len(to, from) + slack[k++];
            time.add([[`${to}|${T}`, 1], [`${from}|${T}`, -1]], gap);
        });
        return time;
    };
    // Premise-by-premise steps along the one route the premises give.
    const route = (a: string, b: string): number => {
        const prev = new Map<string, [string, number]>([[a, [a, 0]]]);
        const queue = [a];
        while (queue.length) {
            const cur = queue.shift()!;
            for (const r of reads) {
                const [to, from] = r.words;
                const next = to === cur ? from : from === cur ? to : null;
                if (!next || prev.has(next)) continue;
                prev.set(next, [cur, prev.get(cur)![1] + len(to, from)]);
                queue.push(next);
            }
        }
        return prev.get(b)![1];
    };
    return { gapsAt, reaches: forms.filter(f => f === "reach").length, space, travel, T, route, reads, forms };
}

/**
 * Whether `x`'s ring can have reached `y`: by necessity over every slack, so
 * a reach item is true only if it holds however late the bounded bells rang.
 * Brute force over each slack from 0 to 6 — wide enough that any pair the
 * bounds leave open shows both answers.
 */
function coneAnswer(c: ConeRead, x: string, y: string,
                    test: (dt: number, need: number) => boolean = (dt, need) => dt >= need): boolean | null {
    const need = c.travel.reduce((t, i) => t + Math.abs(c.space.gap(x, y, i)!), 0);
    const seen = new Set<boolean>();
    const slack = Array(c.reaches).fill(0);
    const visit = (k: number) => {
        if (k === c.reaches) { seen.add(test(c.gapsAt(slack).gap(y, x, c.T)!, need)); return; }
        for (let v = 0; v <= 6; v++) { slack[k] = v; visit(k + 1); }
    };
    visit(0);
    // Necessity: true only if every slack agrees it is.
    return !seen.has(false);
}

/** The pair a boolean cone claim names, and the select form's viewer and options. */
const coneClaimOf = (q: Question) => {
    const claim = q.answerMode === "select" ? q.choicePrompt : String(q.conclusion);
    return subjectsOf(claim);
};

const isConed = (q: Question) => /ring can have reached/.test(strip(String(q.conclusion)))
    || /ring can have reached/.test(strip(q.choicePrompt ?? ""));

function conedItems(type: EnumQuestionType, held: string[], count: number, seed: number) {
    const axes = axesForDimensions(dimsOf[type]).map(scale => ({ scale }) as AxisSpec);
    const items = build(ctxHolding(held), type, 6, count, seed).filter(isConed);
    return { axes, items };
}

const kindOf = (q: Question) => q.premises.some(p => /rang only after/.test(strip(p))) ? "reach"
    : q.premises.some(p => /rang the moment/.test(strip(p))) ? "signal" : "cone";

/** Every answer the item asks for, as [viewer, target, keyed answer]. */
function coneQuestions(q: Question): Array<[string, string, boolean]> {
    if (q.answerMode === "select") {
        const [x] = coneClaimOf(q);
        return q.choices.map((ch, i) => [x, subjectsOf(ch)[0], q.selectAnswer.includes(i)]);
    }
    const [x, y] = coneClaimOf(q);
    return [[x, y, q.isValid]];
}

const CONE_HELD = {
    boolean: ["branching", "cone", "signals", "reach"],
    select: ["branching", "cone", "signals", "reach", "choose-conclusion"],
};

test("cone: the marked answer is what the rule gives, read from the card alone", () => {
    const kinds = { cone: 0, signal: 0, reach: 0 };
    let checked = 0;
    for (const [form, held] of Object.entries(CONE_HELD)) {
        for (const type of [EnumQuestionType.Space4D, EnumQuestionType.Space5D, EnumQuestionType.Space7D]) {
            const { axes, items } = conedItems(type, held, 60, 5301);
            assert(items.length >= 15, `${form} ${type}: only ${items.length} cone items`);
            for (const q of items) {
                kinds[kindOf(q)]++;
                const c = readCone(q, axes);
                assert(!c.space.inconsistent, `${form} ${type}: the spatial premises contradict each other`);
                for (const [x, y, keyed] of coneQuestions(q)) {
                    const solved = coneAnswer(c, x, y);
                    equal(solved, keyed, `${form} ${type}: ${x}'s ring reaching ${y} is keyed ${keyed} on\n  `
                        + [...q.premises, q.choicePrompt, String(q.conclusion)].map(t => strip(t ?? "")).join("\n  "));
                    checked++;
                }
            }
        }
    }
    assert(checked > 300 && kinds.cone > 20 && kinds.signal > 20 && kinds.reach > 20,
        `too little checked: ${checked} answers, kinds ${JSON.stringify(kinds)}`);
});

test("cone: every shortcut is right about half the time, and no more", () => {
    const { axes, items } = conedItems(EnumQuestionType.Space4D, CONE_HELD.boolean, 300, 5302);
    const shortcut = {
        "per-axis": 0, "route": 0, "time-only": 0, "wrong direction": 0, "bound as equality": 0,
    } as Record<string, number>;
    const tried = { ...shortcut };
    for (const q of items) {
        const c = readCone(q, axes);
        const [x, y] = coneClaimOf(q);
        const dx = c.travel.map(i => Math.abs(c.space.gap(x, y, i)!));
        const lie = (name: string, answer: boolean | null) => {
            tried[name]++;
            if (answer !== q.isValid) shortcut[name]++;
        };
        // Each travel axis held against the time on its own.
        lie("per-axis", coneAnswer(c, x, y, dt => dt >= Math.max(...dx)));
        lie("route", coneAnswer(c, x, y, dt => dt >= c.route(x, y)));
        lie("time-only", coneAnswer(c, x, y, dt => dt >= 0));
        if (kindOf(q) === "signal") {
            // The gap's sign taken from the speaker rather than the hearer.
            const flipped = { ...c, gapsAt: () => {
                const time = new Solver();
                c.reads.forEach((r, i) => {
                    const [to, from] = r.words;
                    const len = c.travel.reduce((t, k) => t + Math.abs(c.space.gap(to, from, k)!), 0);
                    const gap = c.forms[i] === "signal" ? -len : r.clauses.find(cl => cl.axis === c.T)!.delta;
                    time.add([[`${to}|${c.T}`, 1], [`${from}|${c.T}`, -1]], gap);
                });
                return time;
            } };
            lie("wrong direction", coneAnswer(flipped, x, y));
        }
        if (kindOf(q) === "reach") lie("bound as equality", coneAnswer({ ...c, reaches: 0, gapsAt: () => c.gapsAt(Array(c.reaches).fill(0)) }, x, y));
    }
    for (const name of ["per-axis", "route"]) {
        const share = shortcut[name] / tried[name];
        assert(share > 0.35 && share < 0.65,
            `the ${name} shortcut is wrong on ${Math.round(share * 100)}% of ${tried[name]} — a giveaway, or a trap gone`);
    }
    for (const name of ["time-only", "wrong direction", "bound as equality"]) {
        const share = shortcut[name] / tried[name];
        assert(tried[name] > 20 && share > 0.2,
            `the ${name} shortcut is wrong on only ${Math.round(share * 100)}% of ${tried[name]}`);
    }
});

test("cone: the select form's shortcuts each pick a wrong subset", () => {
    const { axes, items } = conedItems(EnumQuestionType.Space5D, CONE_HELD.select, 80, 5303);
    const selects = items.filter(q => q.answerMode === "select");
    assert(selects.length > 15, `only ${selects.length} select items`);
    for (const q of selects) {
        const c = readCone(q, axes);
        const asked = coneQuestions(q);
        const subset = (test: (dt: number, need: number, x: string, y: string) => boolean) =>
            asked.map(([x, y]) => coneAnswer(c, x, y, (dt, need) => test(dt, need, x, y)));
        const truth = asked.map(a => a[2]);
        assert(truth.some(t => t) && truth.some(t => !t), "a select item where every option or none is right");
        const lures = {
            "per-axis": subset((dt, _n, x, y) => dt >= Math.max(...c.travel.map(i => Math.abs(c.space.gap(x, y, i)!)))),
            "route": subset((dt, _n, x, y) => dt >= c.route(x, y)),
            "time-only": subset(dt => dt >= 0),
        };
        for (const [name, set] of Object.entries(lures)) {
            assert(JSON.stringify(set) !== JSON.stringify(truth), `the ${name} shortcut picks the right subset`);
        }
    }
});

test("cone: delivered on 4D–7D when the stack allows it, each form charged only where used", () => {
    for (const type of [EnumQuestionType.Space4D, EnumQuestionType.Space7D]) {
        const held = [...fullLadder(type), "bridges", "local-clocks", "cone", "signals", "reach"];
        const items = build(ctxHolding(held), type, 6, 200, 5304);
        const coned = items.filter(isConed);
        assert(coned.length > items.length * 0.1, `${type}: ${coned.length}/${items.length} cone items`);
        for (const q of items) {
            equal(q.undelivered.includes("cone"), !isConed(q), `${type}: cone charged wrongly`);
            const kind = isConed(q) ? kindOf(q) : null;
            equal(q.undelivered.includes("signals"), kind !== "signal", `${type}: signals charged wrongly`);
            equal(q.undelivered.includes("reach"), kind !== "reach", `${type}: reach charged wrongly`);
        }
        for (const q of coned) {
            assert(q.undelivered.includes("analogy") && q.undelivered.includes("construct-conclusion"),
                `${type}: a cone item is still charged for the conclusion forms it replaced`);
            equal(q.undelivered.includes("choose-conclusion"), q.answerMode !== "select",
                `${type}: choice charged on a cone item that ${q.answerMode === "select" ? "is" : "is not"} a select`);
        }
    }
    for (const type of [EnumQuestionType.Direction, EnumQuestionType.Space3D]) {
        assert(!ladderFor(type).includes("cone"), `${type} offers the cone with no time axis`);
    }
    // A looped east axis has no taxicab distance to speak of.
    const looped = build(ctxHolding(["cone"], {}, 1), EnumQuestionType.Space4D, 6, 40, 5305);
    assert(looped.length > 30 && looped.every(q => !isConed(q) && q.undelivered.includes("cone")),
        "the cone is served, or charged, on a looped travel axis");
});

test("cone: rule, minutes and forms are on the card, and forms lie on the asked route", () => {
    const { axes, items } = conedItems(EnumQuestionType.Space6D, CONE_HELD.boolean, 80, 5306);
    for (const q of items) {
        const setup = q.setup.map(strip).join(" ");
        assert(/arriving exactly then counts/.test(setup), "the boundary case is not stated");
        assert(/except time, which it gives in minutes/.test(setup), "the one-step note has no minutes exception");
        assert(/cost no travel/.test(setup), "the axes that cost no travel are not named");
        const kind = kindOf(q);
        if (kind === "signal") assert(/rang exactly when/.test(setup), "signal premises with no note");
        if (kind === "reach") assert(/however much later/.test(setup), "reach premises with no note");
        const c = readCone(q, axes);
        q.premises.forEach((p, i) => {
            if (c.forms[i] === "exact") {
                assert(/\d+ min (later|earlier)|same time/.test(strip(p)), `a cone premise without minutes: ${strip(p)}`);
                return;
            }
            // Said from the hearer's side: the subject rang later.
            const [to, from] = c.reads[i].words;
            const t = c.gapsAt(Array(c.reaches).fill(0)).gap(to, from, c.T)!;
            assert(t > 0, `a ${c.forms[i]} premise whose subject did not ring later: ${strip(p)}`);
        });
        if (kind !== "cone") {
            // The form has to be on the route asked about, or it is decoration.
            const [x, y] = coneClaimOf(q);
            const onRoute = (() => {
                const prev = new Map<string, number>([[x, -1]]);
                const queue = [x];
                while (queue.length) {
                    const cur = queue.shift()!;
                    c.reads.forEach((r, i) => {
                        const [to, from] = r.words;
                        const next = to === cur ? from : from === cur ? to : null;
                        if (next && !prev.has(next)) { prev.set(next, i); queue.push(next); }
                    });
                }
                const used: number[] = [];
                for (let w = y; w !== x;) {
                    const i = prev.get(w)!;
                    used.push(i);
                    const [to, from] = c.reads[i].words;
                    w = to === w ? from : to;
                }
                return used.some(i => c.forms[i] === kind);
            })();
            assert(onRoute, `a ${kind} item whose ${kind} premises are all off the asked route`);
        }
    }
});

/* ------------------------------------------------------------------ *
 * Kind frames                                                          *
 * ------------------------------------------------------------------ */

export type KindReading = "true" | "face-value" | "convert-all" | "wrong-end";

/**
 * The setup's rule applied exactly: kind carried by parity from any one
 * object (relative kind is all there is, and all that matters), each premise
 * decoded through the frame change when its reference is the other kind, and
 * each claim read in its own reference's reckoning.
 */
export function readKinds(q: Question, axes: AxisSpec[], how: KindReading = "true"): Gaps {
    const note = q.setup.find(l => /two kinds/.test(strip(l)))!;
    const said = [...note.matchAll(/<span class="relation ">([^<]+)<\/span>/g)].map(m => m[1]);
    // "what one kind calls X the other calls Y": X's axis, and Y's.
    const axisOf = (w: string) => axes.findIndex(a => a.scale.direction.includes(w) || a.scale.tie === w);
    const [x, y] = [axisOf(said[2]), axisOf(said[3])];
    const P = (d: number[]) => {
        const out = [...d];
        if (x === y) out[x] = -d[x];
        else { out[x] = d[y]; out[y] = d[x]; }
        return out;
    };
    const parity = axes.findIndex(a => a.scale.parity);
    const reads = q.premises.map(p => readPremise(p, axes));
    // Relative kind, by parity from the first object named.
    const kinds = new Solver();
    for (const r of reads) {
        const c = r.clauses.find(c => c.axis === parity)!;
        kinds.add([[`${r.words[0]}|${parity}`, 1], [`${r.words[1]}|${parity}`, -1]], c.delta);
    }
    const root = reads[0].words[0];
    const kindOf = (w: string) =>
        how === "face-value" || how === "convert-all" ? 0 : mod(kinds.gap(w, root, parity)!, 2);
    const pos = new Solver();
    for (const r of reads) {
        const [S, R] = r.words;
        const d = axes.map((_, i) => r.clauses.find(c => c.axis === i)?.delta ?? 0);
        const abs = kindOf(how === "wrong-end" ? S : R) ? P(d) : d;
        axes.forEach((_, i) => {
            if (i !== parity) pos.add([[`${S}|${i}`, 1], [`${R}|${i}`, -1]], abs[i]);
        });
    }
    return {
        inconsistent: pos.inconsistent,
        gap(a, b, axis) {
            if (axis === parity) return kinds.gap(a, b, parity);
            const d = axes.map((_, i) => (i === parity ? 0 : pos.gap(a, b, i) ?? 0));
            const inB = how === "convert-all" || kindOf(b) ? P(d) : d;
            return inB[axis];
        },
    };
}

const isKinded = (q: Question) => q.setup.some(l => /two kinds/.test(strip(l)));

function kindedItems(type: EnumQuestionType, held: string[], count: number, seed: number) {
    const items = build(ctxHolding(held), type, 6, count, seed).filter(isKinded);
    // The stack as drawn: the default one, with Distinction appended if absent.
    const axesFor = (q: Question) => {
        const base = axesForDimensions(dimsOf[type]).map(scale => ({ scale }) as AxisSpec);
        return (q.axisNames ?? []).length > base.length
            ? [...base, { scale: AXIS_CHOICES.find(a => a.id === "distinction")! }]
            : base;
    };
    return { items, axesFor };
}

const KIND_FORMS: Record<string, string[]> = {
    plain: ["branching", "kinds"],
    choice: ["branching", "choose-conclusion", "kinds"],
    construct: ["branching", "construct-conclusion", "construct-distance", "kinds"],
};

test("kinds: the marked answer is what decoding each premise by its reference's kind gives", () => {
    let checked = 0;
    for (const [form, held] of Object.entries(KIND_FORMS)) {
        for (const type of [EnumQuestionType.Direction, EnumQuestionType.Space3D,
                            EnumQuestionType.Space4D, EnumQuestionType.Space7D]) {
            const { items, axesFor } = kindedItems(type, held, 40, 5401);
            assert(items.length >= 12, `${form} ${type}: only ${items.length} kinds items`);
            for (const q of items) {
                assert(judge(q, axesFor(q), readKinds(q, axesFor(q))),
                    `${form} ${type}: decoded by the wrong end of the premise, or not at all — the `
                    + `rule disagrees with the key on\n  `
                    + [...q.setup, ...q.premises, String(q.conclusion), ...q.choices].map(strip).join("\n  "));
                checked++;
            }
        }
    }
    assert(checked > 150, `only ${checked} items checked`);
});

test("kinds: face value and converting everything both fail; so does decoding by the subject", () => {
    for (const [form, held] of Object.entries(KIND_FORMS)) {
        const { items, axesFor } = kindedItems(EnumQuestionType.Space4D, held, 80, 5402);
        const fails = (how: KindReading) =>
            items.filter(q => !judge(q, axesFor(q), readKinds(q, axesFor(q), how))).length / items.length;
        const enforced = form === "plain" ? 0.4 : 1;
        for (const how of ["face-value", "convert-all"] as KindReading[]) {
            assert(fails(how) >= enforced,
                `${form}: the ${how} reading fails only ${Math.round(fails(how) * 100)}% of ${items.length}`);
        }
        assert(fails("wrong-end") >= 0.25,
            `${form}: decoding by the subject's kind fails only ${Math.round(fails("wrong-end") * 100)}%`);
    }
});

test("kinds: delivered on every family, the added axis priced, analogy and facing kept off", () => {
    for (const type of [EnumQuestionType.Direction, EnumQuestionType.Space3D,
                        EnumQuestionType.Space4D, EnumQuestionType.Space7D]) {
        assert(ladderFor(type).includes("kinds"), `${type} does not offer kinds`);
        const held = [...fullLadder(type), "bridges", "local-clocks", "cone", "signals", "reach", "kinds"]
            .filter(r => ladderFor(type).includes(r));
        const items = build(ctxHolding(held), type, 6, 200, 5403);
        const kinded = items.filter(isKinded);
        assert(kinded.length > items.length * 0.08, `${type}: ${kinded.length}/${items.length} kinds items`);
        const appended = type !== EnumQuestionType.Space7D;
        for (const q of items) {
            equal(q.undelivered.includes("kinds"), !isKinded(q), `${type}: kinds charged wrongly`);
            equal(q.surcharge, isKinded(q) && appended ? 1.2 : 0,
                `${type}: surcharge ${q.surcharge} on a${isKinded(q) ? "" : " non"}-kinds item`);
            equal((q.axisNames ?? []).includes("Distinction"), type === EnumQuestionType.Space7D || isKinded(q),
                `${type}: the parity axis is ${(q.axisNames ?? []).includes("Distinction") ? "added where it should not be" : "missing"}`);
        }
        for (const q of kinded) {
            assert(!hasFacing(q) && !/pair-to/.test(JSON.stringify(q.conclusion)),
                `${type}: a kinds item also carries a facing or an analogy`);
            if (held.includes("analogy")) assert(q.undelivered.includes("analogy"),
                `${type}: a kinds item is charged for the analogy it set aside`);
        }
    }
});

test("kinds: the rule is stated, kinds are on every premise, and the derivation converts", () => {
    const { items, axesFor } = kindedItems(EnumQuestionType.Space5D, KIND_FORMS.plain, 60, 5404);
    for (const q of items) {
        assert(q.setup.some(l => /reckoning of the one it is relative to/.test(strip(l))),
            "the reckoning convention is not stated");
        const parity = axesFor(q).findIndex(a => a.scale.parity);
        for (const p of q.premises) {
            assert(readPremise(p, axesFor(q)).clauses.some(c => c.axis === parity),
                `a premise that does not say its kind: ${strip(p)}`);
        }
    }
    const converted = items.filter(q => q.explanation.some(l => /is the other kind from/.test(strip(l))));
    assert(converted.length > items.length * 0.5,
        `only ${converted.length}/${items.length} derivations show a premise being converted`);
});
