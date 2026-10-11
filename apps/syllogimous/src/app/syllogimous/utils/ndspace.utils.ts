/**
 * N-dimensional relational space.
 *
 * v4 had a 3D spatial mode and a 3D-plus-time mode, each written as its own
 * generator with its vocabulary baked in. This replaces that idea with a
 * composition: a space is a *list of axes*, each axis is a `LinearScale`, and
 * the dimension count is however many you name. Four dimensions is the three
 * spatial ones plus time; five adds containment; six adds quantity; nothing
 * stops it going further.
 *
 * That is the whole point of building it this way. "4D" is not a mode someone
 * wrote — it is a configuration, so the axes can be swapped, reordered or
 * extended without touching the generator.
 *
 * ── Structure ──
 *
 * One shared tree over the objects, with an independent step on every axis per
 * edge. So a premise fixes two objects' relationship on *all* axes at once —
 * "Ash is east, same latitude, above and later relative to Bell" — and the
 * difficulty is carrying several independent accumulations through the same
 * chain rather than reading several separate puzzles.
 *
 * Every axis is therefore fully determined by the premises, which is what makes
 * an item answerable. A premise that quietly left an axis out would leave the
 * reader unable to derive a relation the item then asks about.
 *
 * ── Circular axes ──
 *
 * An axis can be bent into a loop of size `modulus`. That changes the *kind* of
 * question it can answer, not just the arithmetic: on a ring nothing is
 * "greater" than anything else, because you can reach it going either way. So a
 * circular axis drops ordering and asks about displacement instead — how many
 * steps round, whether two things coincide, whether they sit opposite each
 * other. Wrap-around is what makes it worth having: positions accumulate mod
 * `modulus`, so a long chain comes back on itself.
 *
 * Pure — no Angular, no settings, no storage. Positions are integers and every
 * claim is decided by comparing them.
 */

import { ConstructClaim } from "../models/question.models";
import { LINEAR_SCALES, LinearLayout, LinearScale, SPATIAL_SCALES, buildBranching, buildChain } from "./linear.utils";
import { Transform, TransformVocab, drawTransforms, replay } from "./transformations.utils";
import { hi, own, PAIR_RELATION_WORDS, rel, subj } from "./phrasing";

/* ------------------------------------------------------------------ *
 * Axes                                                                *
 * ------------------------------------------------------------------ */

export interface AxisSpec {
    scale: LinearScale;
    /**
     * Loop size. Absent or under 3 means a straight axis.
     *
     * Three is the floor because a loop of two has every pair both one step
     * forward and one step back, so no displacement claim distinguishes
     * anything.
     */
    modulus?: number;
    /**
     * This axis is read on local clocks set by another one: a marked premise
     * states `value + rate × zone(source)` rather than the value itself.
     *
     * The one axis property that is not a relabelling. Every map elsewhere —
     * rotations, axis maps, frames — sends one source axis to one target, so
     * after undoing it the columns are independent again. A shear feeds one
     * stated clause into two axes, and only on the premises that are marked,
     * so no global change of basis separates them. See `zoneOf`.
     */
    local?: { source: number; rate: number };
    /**
     * Steps on this axis are stated as counts of `unit` rather than as one
     * step each: "3 min later". The light cone needs it — time is a budget
     * the spatial steps are paid out of, and a budget of one is no budget.
     */
    stride?: { unit: string };
}

export function isCircular(axis: AxisSpec): boolean {
    return !!axis.modulus && axis.modulus >= 3 && !!axis.scale.cyclic;
}

/**
 * An axis with two classes and no order.
 *
 * Handled alongside the circular ones because the arithmetic is the same shape
 * — positions reduced modulo something — but the *questions* differ: a ring
 * asks how far round, and this asks only whether two things match. It is a loop
 * of two, which is exactly the case `isCircular` excludes, and for the same
 * reason: on a two-loop no displacement claim distinguishes anything, so
 * displacement is not what gets asked.
 */
export function isParity(axis: AxisSpec): boolean {
    return !!axis.scale.parity;
}

/** Same class or not. Meaningless on an ordered axis. */
export function sameClass(layout: NdLayout, axis: number, a: string, b: string): boolean {
    return mod(layout.coords[a][axis] - layout.coords[b][axis], 2) === 0;
}

/**
 * Default axis stacks by dimension count.
 *
 * Three is ordinary space. Four adds time, which is the usual next dimension
 * and the one v4 already had. Five adds containment and six quantity — both
 * chosen because they are *not* spatial, so the extra load is holding a
 * different kind of relation rather than one more direction.
 */
export const DIMENSION_AXES: Record<number, LinearScale[]> = {
    /* The compass, which is what Direction has always been. Swappable for
       up/down and left/right from the axis picker, which is the whole reason
       this is a preset rather than a hardcoded pair. */
    2: [SPATIAL_SCALES["east"], SPATIAL_SCALES["north"]],
    3: [SPATIAL_SCALES["east"], SPATIAL_SCALES["north"], SPATIAL_SCALES["up"]],
    4: [SPATIAL_SCALES["east"], SPATIAL_SCALES["north"], SPATIAL_SCALES["up"],
        LINEAR_SCALES["temporal"]],
    5: [SPATIAL_SCALES["east"], SPATIAL_SCALES["north"], SPATIAL_SCALES["up"],
        LINEAR_SCALES["temporal"], LINEAR_SCALES["contains"]],
    6: [SPATIAL_SCALES["east"], SPATIAL_SCALES["north"], SPATIAL_SCALES["up"],
        LINEAR_SCALES["temporal"], LINEAR_SCALES["contains"], LINEAR_SCALES["quantity"]],
    /*
     * Seven adds Distinction, which is the only axis here that is not a line.
     * Six ordered scales all ask "how far"; this asks a question with no
     * distance in it, so it cannot be carried the same way as the rest — which
     * is the whole reason for adding it rather than a seventh line.
     */
    7: [SPATIAL_SCALES["east"], SPATIAL_SCALES["north"], SPATIAL_SCALES["up"],
        LINEAR_SCALES["temporal"], LINEAR_SCALES["contains"], LINEAR_SCALES["quantity"],
        LINEAR_SCALES["distinction"]],
};

/** Every scale that can serve as an axis, for the configuration UI. */
export const AXIS_CHOICES: LinearScale[] = [
    SPATIAL_SCALES["east"], SPATIAL_SCALES["north"], SPATIAL_SCALES["up"],
    LINEAR_SCALES["temporal"], LINEAR_SCALES["contains"],
    LINEAR_SCALES["quantity"], LINEAR_SCALES["distinction"],
    LINEAR_SCALES["temperature"], LINEAR_SCALES["vertical"], LINEAR_SCALES["horizontal"],
];

export function axesForDimensions(dims: number): LinearScale[] {
    if (DIMENSION_AXES[dims]) return DIMENSION_AXES[dims];
    // Beyond the named presets, keep extending from the choice list so a
    // seven-dimensional space is a configuration rather than an error.
    const out = [...DIMENSION_AXES[7]];
    for (const s of AXIS_CHOICES) {
        if (out.length >= dims) break;
        if (!out.includes(s)) out.push(s);
    }
    return out.slice(0, Math.max(1, dims));
}

/* ------------------------------------------------------------------ *
 * Axis order                                                          *
 * ------------------------------------------------------------------ */

/**
 * Which end of a premise an axis is read at.
 *
 * A premise states every axis at once, in axis-list order, so that order is
 * the order the clauses are read in: "east, same latitude, above and later".
 * Which one comes first is not neutral — the first clause is the one that gets
 * a whole mind to itself, and the last is the one being held while the rest are
 * placed. Anyone who spatialises these has a habitual order, and an item that
 * states them the other way round is measurably harder for no reason connected
 * to the reasoning.
 *
 * So it is a setting rather than a constant. These are the orders worth having
 * as one click; anything else is reachable by moving axes individually.
 */
export type AxisOrdering = "spatial-first" | "spatial-last" | "longitude-last" | "reverse";

export const AXIS_ORDERINGS: Array<{ id: AxisOrdering; label: string; hint: string }> = [
    { id: "spatial-first", label: "Spatial first",
      hint: "The default: east–west, north–south, up–down, then the rest" },
    { id: "spatial-last", label: "Spatial last",
      hint: "The non-spatial dimensions first, the three spatial ones after them" },
    { id: "longitude-last", label: "Longitude last",
      hint: "East–west moved to the very end, wherever the others sit" },
    { id: "reverse", label: "Reverse", hint: "Flip the order end for end" },
];

/** The three axes of ordinary space, by id. */
const SPATIAL_IDS = new Set(["east", "north", "up"]);

/** Rank in the canonical stack, for restoring the preset order. */
const CANONICAL_RANK = new Map(AXIS_CHOICES.map((s, i) => [s.id, i]));

export function reorderAxisIds(ids: string[], how: AxisOrdering): string[] {
    const out = [...ids];
    switch (how) {
        case "spatial-first":
            // Stable on rank rather than a fixed list, so a stack containing
            // scales the presets never use still comes out in a sane order.
            return out.sort((a, b) =>
                (CANONICAL_RANK.get(a) ?? 99) - (CANONICAL_RANK.get(b) ?? 99));
        case "spatial-last":
            return [...out.filter(id => !SPATIAL_IDS.has(id)), ...out.filter(id => SPATIAL_IDS.has(id))];
        case "longitude-last":
            return [...out.filter(id => id !== "east"), ...out.filter(id => id === "east")];
        case "reverse":
            return out.reverse();
    }
}

/* ------------------------------------------------------------------ *
 * Axis colour                                                         *
 * ------------------------------------------------------------------ */

/**
 * Palette slot per axis, so a dimension keeps its colour between items.
 *
 * Assigned by *identity*, not by position. Position would be simpler, but it
 * would repaint every axis the moment the order is changed and would give east
 * one colour in a 4D item and another in a 6D one — and the whole value of the
 * colour is the association it builds up over many items. Time is violet
 * wherever it sits in the premise.
 *
 * The numbers are slots into `--th-dim-N`, which the theme resolves; nothing
 * here knows what colour anything actually is.
 */
const AXIS_COLOR_SLOT: Record<string, number> = {
    east: 1, north: 2, up: 3, temporal: 4, contains: 5, quantity: 6,
    vertical: 7, horizontal: 8,
};

/** How many slots the stylesheet defines. */
export const DIM_SLOTS = 8;

/**
 * A colour class per axis, distinct within the stack.
 *
 * Two passes for the same reason `ndAxisLabels` needs two: the preferred slot
 * may be taken by an axis this stack also contains, and two dimensions sharing
 * a colour is worse than either of them being off its usual one.
 */
export function ndAxisColors(axes: AxisSpec[]): string[] {
    const taken = new Set<number>();
    const preferred = axes.map(a => {
        const want = AXIS_COLOR_SLOT[a.scale.id];
        if (want && !taken.has(want)) { taken.add(want); return want; }
        return 0;
    });

    let next = 1;
    return preferred.map(slot => {
        if (slot) return dimClass(slot);
        while (next <= DIM_SLOTS && taken.has(next)) next++;
        const free = next <= DIM_SLOTS ? next : 1;
        taken.add(free);
        return dimClass(free);
    });
}

/** The class pair for a slot: the generic hook, then the slot itself. */
export function dimClass(slot: number): string {
    return `dim dim-${slot}`;
}

/* ------------------------------------------------------------------ *
 * Layout                                                              *
 * ------------------------------------------------------------------ */

export interface NdEdge {
    from: string;
    to: string;
    /** Step taken on each axis going from -> to; -1, 0 or +1. */
    deltas: number[];
    /**
     * Which axes this premise actually mentions. Absent means all of them.
     *
     * This is what makes an item *under*-determined. The stated pairs form a
     * tree, and any assignment of vectors to a tree's edges yields exactly one
     * layout — which is why every composed-space item so far has been solvable
     * by propagation: scan, intersect, repeat, and it closes. Withholding a
     * clause breaks the tree *on that axis only*, so the objects split into
     * groups with no stated relation between them and several arrangements
     * satisfy the premises.
     *
     * Note this is not `compact`, which drops clauses where the delta is zero
     * and therefore states, by omission, that the two are level. This drops
     * clauses that carry a real difference, and says nothing in their place.
     */
    stated?: boolean[];
    /**
     * Stated by local clocks: the clause on an axis with `local` set gives the
     * reading where each thing is, not the station clock's. `deltas` stay the
     * real ones, so everything that walks the edges — positions, determinacy,
     * depth — is unchanged; only what is printed differs.
     */
    local?: boolean;
    /**
     * A light-cone premise whose time is not stated but derived from the
     * distance: `signal` rang the moment the other's ring arrived (the gap is
     * the distance exactly), `reach` rang only after it had (the gap is at
     * least the distance). The hearer is whichever end rang later.
     */
    form?: "signal" | "reach";
    /**
     * Which end the premise is said relative to, when that has to be fixed at
     * build time rather than drawn as it is printed: under kind frames the
     * reference's reckoning decides what the words mean, and the derivation
     * has to name the same reference the card did.
     */
    flip?: boolean;
}

export interface NdLayout {
    words: string[];
    axes: AxisSpec[];
    /** Position on every axis, already reduced mod modulus where circular. */
    coords: Record<string, number[]>;
    edges: NdEdge[];
    neighbors: Record<string, string[]>;
    branching: boolean;
    /**
     * Premises that tie one axis to another. Absent on every layout that is
     * not built for a coupling rung, which is what keeps the axes independent
     * — and what anything reasoning about determinacy must read, or it will
     * call a coupled pair open.
     */
    couplings?: NdCoupling[];
    /**
     * Which clock the coordinates on a `local` axis are read on. Absent means
     * the station clock, which is what the edges sum to; "local" adds each
     * object's own zone, and is what a question asked by local clocks is
     * answered from.
     */
    reading?: "station" | "local";
    /**
     * Two kinds that reckon directions differently. Every relation is in the
     * reckoning of the object it is relative to, and an object of kind 1 reads
     * every displacement through `rule` — `mirror` reverses `axes[0]`, `swap`
     * exchanges `axes[0]` and `axes[1]`. Kind is the object's class on the
     * `parity` axis. `fixed` makes every reference that kind, which is how a
     * reader who ignores kinds is modelled.
     *
     * Coordinates and edges stay in kind 0's reckoning throughout, so width,
     * colours, determinacy and the map are untouched; only what a relation
     * *says* passes through `relDelta`.
     */
    frames?: { parity: number; rule: "mirror" | "swap"; axes: number[]; fixed?: 0 | 1 };
}

/**
 * "R is as many steps east of B as G is later than H."
 *
 * The gap on `axis` between `r` and `b` equals, in size, the gap on `via`
 * between `g` and `h`, with `g` always on the positive side of `h`. So
 * x_r − x_b = sign · (y_g − y_h). The size is never stated: it is whatever the
 * `via` axis accumulates to, so that axis has to be finished before this one
 * can use it.
 */
export interface NdBridge {
    kind: "bridge";
    r: string;
    b: string;
    axis: number;
    g: string;
    h: string;
    via: number;
    sign: 1 | -1;
}

/**
 * "A is same longitude, south, above and earlier relative to B, 6 steps in
 * all": a direction on every axis and one total across the straight ones.
 *
 * The signs are stated and the sizes are not, so the total is one linear
 * equation, Σ |a_i − b_i| = total over the straight axes. Once every straight
 * axis but one is settled between the pair, the last is what the total has
 * left — so `axis` (the one the item cuts) is closed through all the others.
 */
export interface NdTotal {
    kind: "total";
    a: string;
    b: string;
    total: number;
    axis: number;
}

/** Every premise kind that couples axes; `closeAxes` reads them all. */
/**
 * "A is listed before B", on a list sorted by `key` and then by `tie`.
 *
 * A lexicographic premise: if A and B differ on the key it says only that, and
 * if they are level on it, it says how they stand on the tiebreak. Which of
 * the two it means is known only once the key axis has been carried — the
 * meaning on one axis depends on the value of another. An inequality, never
 * an equality, so `closeAxes` passes over it and `boundsOn` reads it.
 *
 * `keyDir` and `tieDir` are +1 where the list runs low to high on that axis
 * and −1 where it runs high to low. `axis` is the tiebreak, the axis whose
 * order the ranking can carry.
 */
export interface NdRank {
    kind: "rank";
    a: string;
    b: string;
    key: number;
    keyDir: 1 | -1;
    axis: number;
    tieDir: 1 | -1;
}

export type NdCoupling = NdBridge | NdTotal | NdRank;

/** Axes a total counts: ordered, unbounded lines. */
export function countedAxes(axes: AxisSpec[]): number[] {
    return axes.map((a, i) => (isCircular(a) || isParity(a) ? -1 : i)).filter(i => i >= 0);
}

const pick = <T>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)];

/** Positive remainder — JavaScript's % keeps the sign of the dividend. */
export function mod(n: number, m: number): number {
    return ((n % m) + m) % m;
}

export interface NdBuildOptions {
    branching?: boolean;
    /** Chance an axis takes no step on a given edge, producing ties. */
    tieChance?: number;
}

export function buildNdLayout(
    words: string[],
    axes: AxisSpec[],
    options: NdBuildOptions = {},
): NdLayout {
    const tieChance = options.tieChance ?? 0.22;
    const shape: LinearLayout = options.branching ? buildBranching(words) : buildChain(words);

    const edges: NdEdge[] = shape.edges.map(([from, to]) => {
        let deltas: number[];
        do {
            deltas = axes.map(() => (Math.random() < tieChance ? 0 : pick([-1, 1])));
            // All zero would put two objects at the same point on every axis,
            // which states nothing and cannot be asked about.
        } while (deltas.every(d => d === 0));
        return { from, to, deltas };
    });

    // Walk the tree from an arbitrary root, accumulating each axis.
    const coords: Record<string, number[]> = { [words[0]]: axes.map(() => 0) };
    const byNode = new Map<string, Array<{ other: string; deltas: number[]; sign: number }>>();
    for (const e of edges) {
        if (!byNode.has(e.from)) byNode.set(e.from, []);
        if (!byNode.has(e.to)) byNode.set(e.to, []);
        byNode.get(e.from)!.push({ other: e.to, deltas: e.deltas, sign: 1 });
        byNode.get(e.to)!.push({ other: e.from, deltas: e.deltas, sign: -1 });
    }

    const queue = [words[0]];
    while (queue.length) {
        const cur = queue.shift()!;
        for (const step of byNode.get(cur) ?? []) {
            if (coords[step.other]) continue;
            coords[step.other] = coords[cur].map((v, i) => v + step.sign * step.deltas[i]);
            queue.push(step.other);
        }
    }

    // Reduce circular axes once, at the end: accumulating first and wrapping
    // after is the same result and keeps the walk above axis-agnostic.
    for (const w of words) {
        axes.forEach((axis, i) => {
            if (isCircular(axis)) coords[w][i] = mod(coords[w][i], axis.modulus!);
            if (isParity(axis)) coords[w][i] = mod(coords[w][i], 2);
        });
    }

    return { words, axes, coords, edges, neighbors: shape.neighbors, branching: !!options.branching };
}

/* ------------------------------------------------------------------ *
 * Editing the premises                                                *
 * ------------------------------------------------------------------ */

/**
 * Operations that rewrite a *stated relation* rather than move an object.
 *
 * Every other modifier in the app mutates the model: things change place and
 * you re-derive. These mutate the premise set itself, which is a different
 * task — you have to hold the statements as data and edit them, then read the
 * model off the result.
 *
 * All three are arithmetic on the delta vector an edge already carries, which
 * is what makes them cheap here:
 *
 *   reverse   negate one edge's vector
 *   swap      exchange two edges' vectors
 *   copy      overwrite one edge's vector with another's
 *
 * None can produce an unsatisfiable premise set. The stated pairs form a tree,
 * and *any* assignment of vectors to a tree's edges yields exactly one
 * consistent layout — so an edit always leaves something well-formed to answer
 * about. That is not obvious, and it is what makes premise-rewriting safe here
 * where an arbitrary mechanism would not be.
 */
export type NdEditKind = "reverse" | "swap" | "copy" | "exchange";

export interface NdEdit {
    kind: NdEditKind;
    /** Index into `layout.edges` of the relation being changed. */
    target: number;
    /** The other relation, for swap and copy. */
    other?: number;
}

/** Apply edits in order and re-derive the layout they describe. */
export function applyNdEdits(layout: NdLayout, edits: NdEdit[]): NdLayout {
    const edges = layout.edges.map(e => ({ ...e, deltas: [...e.deltas] }));

    for (const edit of edits) {
        const t = edges[edit.target];
        if (!t) continue;
        if (edit.kind === "reverse" || edit.kind === "exchange") {
            // One operation. Exchanging the arguments of a relation and
            // reversing the relation are the same negation of its vector.
            t.deltas = t.deltas.map(d => -d);
            continue;
        }
        const o = edges[edit.other!];
        if (!o) continue;
        if (edit.kind === "copy") {
            t.deltas = [...o.deltas];
        } else {
            const keep = t.deltas;
            t.deltas = o.deltas;
            o.deltas = keep;
        }
    }

    return { ...layout, edges, coords: coordsFromEdges(layout, edges) };
}

/** Walk the tree from an arbitrary root, accumulating each axis. */
export function coordsFromEdges(layout: NdLayout, edges: NdEdge[]): Record<string, number[]> {
    const { words, axes } = layout;
    const coords: Record<string, number[]> = { [words[0]]: axes.map(() => 0) };
    const byNode = new Map<string, Array<{ other: string; deltas: number[]; sign: number }>>();

    for (const e of edges) {
        if (!byNode.has(e.from)) byNode.set(e.from, []);
        if (!byNode.has(e.to)) byNode.set(e.to, []);
        byNode.get(e.from)!.push({ other: e.to, deltas: e.deltas, sign: 1 });
        byNode.get(e.to)!.push({ other: e.from, deltas: e.deltas, sign: -1 });
    }

    const queue = [words[0]];
    while (queue.length) {
        const cur = queue.shift()!;
        for (const step of byNode.get(cur) ?? []) {
            if (coords[step.other]) continue;
            coords[step.other] = coords[cur].map((v, i) => v + step.sign * step.deltas[i]);
            queue.push(step.other);
        }
    }

    for (const w of words) {
        axes.forEach((axis, i) => {
            if (isCircular(axis)) coords[w][i] = mod(coords[w][i], axis.modulus!);
            if (isParity(axis)) coords[w][i] = mod(coords[w][i], 2);
        });
    }
    return coords;
}

/**
 * Draw a list of edits.
 *
 * A relation is never edited twice: the second edit would silently undo or
 * mask the first, and the reader has no way to tell which of two statements
 * about the same pair is meant to win.
 */
export function drawNdEdits(layout: NdLayout, count: number): NdEdit[] {
    const n = layout.edges.length;
    if (n < 2 || count < 1) return [];

    const free = [...Array(n).keys()];
    const out: NdEdit[] = [];

    for (let guard = 0; out.length < count && free.length && guard < count * 20; guard++) {
        const kinds: NdEditKind[] = free.length >= 2
            ? ["reverse", "exchange", "swap", "copy"]
            : ["reverse", "exchange"];
        const kind = pick(kinds);

        const ti = Math.floor(Math.random() * free.length);
        const target = free.splice(ti, 1)[0];

        if (kind === "reverse" || kind === "exchange") { out.push({ kind, target }); continue; }

        const oi = Math.floor(Math.random() * free.length);
        // Swap consumes both relations; copy only rewrites the target, so its
        // source stays editable — but not by a later edit, or the value copied
        // would no longer be the one the player was shown.
        const other = kind === "swap" ? free.splice(oi, 1)[0] : free[oi];
        if (kind === "copy") free.splice(oi, 1);
        out.push({ kind, target, other });
    }

    return out;
}

export function renderNdEdit(layout: NdLayout, edit: NdEdit): string {
    const t = layout.edges[edit.target];
    const pair = (e: NdEdge) => `${subj(e.from)} ${hi("→")} ${subj(e.to)}`;

    if (edit.kind === "reverse") {
        return `the relation ${pair(t)} is ${hi("reversed")}`;
    }
    if (edit.kind === "exchange") {
        return `in the premise about ${subj(t.from)} and ${subj(t.to)},`
            + ` the two ${hi("trade places")}`;
    }
    const o = layout.edges[edit.other!];
    if (edit.kind === "swap") {
        return `the relations ${pair(t)} and ${pair(o)} are ${hi("exchanged")}`;
    }
    return `${pair(t)} becomes ${hi("the same relation as")} ${pair(o)}`;
}

/* ------------------------------------------------------------------ *
 * Transforming the space                                              *
 * ------------------------------------------------------------------ */

/**
 * Short axis labels, for operation names like "XT-rotated".
 *
 * The spatial scales carry their own ("X", "Y", "Z"); the rest deliberately do
 * not, because a one-axis mode labelling its only axis adds a word and no
 * information. Composed spaces need one per axis regardless, so the missing
 * ones are supplied here rather than by changing what a scale means elsewhere.
 */
const AXIS_LETTERS: Record<string, string> = {
    temporal: "T", contains: "C", quantity: "Q", vertical: "H", horizontal: "L",
};

export function ndAxisLabels(axes: AxisSpec[]): string[] {
    const used = new Set<string>();
    return axes.map(a => {
        const base = a.scale.axisName || AXIS_LETTERS[a.scale.id] || a.scale.id[0].toUpperCase();
        let label = base;
        for (let n = 2; used.has(label); n++) label = base + n;
        used.add(label);
        return label;
    });
}

/**
 * Words the transformation engine should use for this axis stack.
 *
 * Circular axes hand over their cyclic wording rather than their linear
 * wording. The premises already describe a looped east axis as
 * clockwise/anticlockwise, and a transformation premise saying "moves 2 east"
 * about the same axis would be describing a different space than the one being
 * reasoned about.
 */
export function ndTransformVocab(axes: AxisSpec[]): TransformVocab {
    return {
        axisNames: ndAxisLabels(axes),
        axisWords: axes.map(a => isCircular(a) ? a.scale.cyclic!.direction : a.scale.direction),
        link: axes.map(a => isCircular(a) ? a.scale.cyclic!.link : a.scale.link),
        // So an operation premise paints "2 east" the same as the relation
        // premises do. Without it the two halves of a transformed item would
        // use the same words in different colours, which is worse than none.
        axisClasses: ndAxisColors(axes),
    };
}

/**
 * Draw transformations over a composed space.
 *
 * The interesting operation here is `rotate`, and it is interesting for a
 * reason that only exists once axes stop being spatial: a quarter turn in the
 * XT plane exchanges displacement along east/west with displacement along
 * later/earlier, so *west becomes earlier*. There is no spatial intuition to
 * fall back on and no crystallised relation to recall — the mapping has to be
 * applied as a mapping. That is the whole argument for putting transformations
 * in here rather than leaving them in the 3D modes.
 *
 * Circular axes are excluded from rotation planes but not from anything else;
 * see `rotationAxes`.
 */
export function drawNdTransforms(layout: NdLayout, count: number): Transform[] {
    // A parity axis has classes rather than positions, so nothing can be moved
    // along it; a circular one can be moved but not turned against a straight.
    const movable = layout.axes.map((a, i) => (isParity(a) ? -1 : i)).filter(i => i >= 0);
    const straight = layout.axes
        .map((a, i) => (isCircular(a) || isParity(a) ? -1 : i))
        .filter(i => i >= 0);

    /*
     * The axes this pair actually differ on, widest first, minus the one just
     * used. v3's `directionize` measured accumulated spread along a chain; the
     * operations here are pairwise, so the same idea is the gap between the two
     * objects involved.
     */
    const rankAxes = (a: string, b: string, lastAxis: number) => {
        const spread = movable
            .map(i => ({ i, gap: Math.abs(layout.coords[a][i] - layout.coords[b][i]) }))
            .filter(({ i }) => i !== lastAxis)
            .sort((x, y) => y.gap - x.gap);

        // All flat means the ranking has nothing to say; let the caller draw.
        return spread.some(({ gap }) => gap > 0) ? spread.map(({ i }) => i) : [];
    };

    return drawTransforms(layout.words, count, {
        dims: layout.axes.length,
        axes: movable,
        rankAxes,
        rotationAxes: straight,
        // Premise steps are one unit, so a stated jump of three reads as a
        // different order of magnitude from everything around it.
        maxOffset: 2,
        multiAxisChance: 0.3,
    }, ndTransformVocab(layout.axes));
}

/** Replay operations over the positions and re-derive the space. */
export function applyNdTransforms(layout: NdLayout, transforms: Transform[]): NdLayout {
    const coords = replay(layout.coords, transforms);

    // Operations are ordinary integer arithmetic and know nothing about loops,
    // so anything that wrapped is brought back onto the ring afterwards —
    // the same order buildNdLayout uses, and for the same reason.
    for (const w of layout.words) {
        layout.axes.forEach((axis, i) => {
            if (isCircular(axis)) coords[w][i] = mod(coords[w][i], axis.modulus!);
            if (isParity(axis)) coords[w][i] = mod(coords[w][i], 2);
        });
    }

    return { ...layout, coords };
}

/**
 * The axis key, for the setup block.
 *
 * Required rather than decorative once rotation is in play: "XT-rotated" is
 * unreadable without knowing which axes X and T are, and unlike every other
 * operation name it cannot be inferred from the direction words in the
 * premises.
 */
export function describeNdAxes(axes: AxisSpec[]): string {
    const labels = ndAxisLabels(axes);
    const colors = ndAxisColors(axes);
    // Carries the colours too, which makes the same line a key for them —
    // free, since it is already a list with one entry per axis.
    const parts = axes.map((a, i) => {
        if (isParity(a)) {
            return hi(`<b>${labels[i]}</b> ${a.scale.parity!.same}/${a.scale.parity!.opposite}`, colors[i]);
        }
        const [pos, neg] = isCircular(a) ? a.scale.cyclic!.direction : a.scale.direction;
        return hi(`<b>${labels[i]}</b> ${pos}/${neg}`, colors[i]);
    });
    return `Axis labels: ${parts.join(", ")}.`;
}

/* ------------------------------------------------------------------ *
 * Reading a layout                                                    *
 * ------------------------------------------------------------------ */

/** -1, 0 or 1 on a straight axis. Meaningless on a circular one. */
/* ------------------------------------------------------------------ *
 * Indeterminacy                                                       *
 * ------------------------------------------------------------------ */

/**
 * Whether the premises pin down how `a` and `b` sit on one axis.
 *
 * Determined exactly when a path of premises that all *mention* that axis runs
 * between them: offsets along such a path add up to a single number, so there
 * is one answer. With no such path the two sit in separate groups that nothing
 * ties together, and — the axes being unbounded, or a ring with no stated
 * offset — every relation between them is satisfiable by some arrangement.
 *
 * So the whole question is connectivity, which is why this needs no model
 * enumeration. Under-specification is usually expensive to reason about; here
 * the structure of the premise set does the work. It is per-axis connectivity
 * *plus the couplings*: a bridge joins two groups on one axis through a gap on
 * another, and `closeAxes` is where that is read.
 */
export function determinedOn(layout: NdLayout, axis: number, a: string, b: string): boolean {
    if (a === b) return true;
    const closed = closeAxes(layout)[axis];
    return closed.find(a) === closed.find(b);
}

/** Union-find over one axis's objects. */
export class AxisGroups {
    private parent = new Map<string, string>();
    constructor(words: string[]) { for (const w of words) this.parent.set(w, w); }
    find(w: string): string {
        let p = this.parent.get(w) ?? w;
        while (p !== (this.parent.get(p) ?? p)) p = this.parent.get(p) ?? p;
        this.parent.set(w, p);
        return p;
    }
    /** True when this joined two groups that were apart. */
    join(a: string, b: string): boolean {
        const ra = this.find(a), rb = this.find(b);
        if (ra === rb) return false;
        this.parent.set(ra, rb);
        return true;
    }
}

/**
 * Which objects each axis ties together, couplings included.
 *
 * Per axis first: a premise that names the axis joins its two objects on it.
 * Then a fixpoint over the couplings, because a bridge is conditional — it
 * joins `r` and `b` on its axis only once `g` and `h` are joined on `via`, and
 * that may itself depend on another bridge (the cascade form). Loop until
 * nothing changes; each pass joins at least two groups or stops, so it ends.
 *
 * The one reader of determinacy. `determinedOn`, and through it
 * `indeterminatePairs` and the strict conclusion pickers, all ask this — a
 * second copy that ignored couplings would call a bridged pair open and grade
 * a true claim false under the indeterminate rung.
 */
export function closeAxes(layout: NdLayout): AxisGroups[] {
    const groups = layout.axes.map(() => new AxisGroups(layout.words));
    for (const e of layout.edges) {
        layout.axes.forEach((_, ax) => {
            if (!e.stated || e.stated[ax]) groups[ax].join(e.from, e.to);
        });
    }
    for (let changed = true; changed;) {
        changed = false;
        for (const c of layout.couplings ?? []) {
            // A ranking is an inequality and joins nothing.
            if (c.kind === "rank") continue;
            if (c.kind === "bridge") {
                if (groups[c.via].find(c.g) !== groups[c.via].find(c.h)) continue;
                if (groups[c.axis].join(c.r, c.b)) changed = true;
                continue;
            }
            // A total: its stated facts first — a tie on a counted axis is a
            // gap of nothing, and a loop's or a kind's clause is stated whole —
            // then whichever counted axis alone is left open.
            const counted = countedAxes(layout.axes);
            layout.axes.forEach((_, i) => {
                const level = relDelta(layout, c.a, c.b)[i] === 0;
                if ((!counted.includes(i) || level) && groups[i].join(c.a, c.b)) changed = true;
            });
            const open = counted.filter(i => groups[i].find(c.a) !== groups[i].find(c.b));
            if (open.length === 1 && groups[open[0]].join(c.a, c.b)) changed = true;
        }
    }
    return groups;
}

/**
 * Withhold clauses until some pair is left undetermined on some axis.
 *
 * Withheld one at a time, checking after each, so the item loses the least
 * information that still makes it an under-specification item. A clause is only
 * withheld where the delta is non-zero: dropping a zero would be
 * indistinguishable from `compact`, which states levelness by omission, and the
 * two modifiers would then contradict each other in the same premise.
 *
 * Never withholds the last mention of an axis — an axis nothing states is not
 * under-determined, it is absent, and an item that asks about it is asking
 * about a dimension the premises never raised.
 */
export function withholdClauses(layout: NdLayout, count: number): NdLayout {
    const edges = layout.edges.map(e => ({
        ...e,
        deltas: [...e.deltas],
        stated: e.stated ? [...e.stated] : layout.axes.map(() => true),
    }));
    const next: NdLayout = { ...layout, edges };

    const candidates: Array<[number, number]> = [];
    edges.forEach((e, ei) => {
        layout.axes.forEach((_, ai) => {
            if (e.deltas[ai] !== 0) candidates.push([ei, ai]);
        });
    });
    shuffleInPlace(candidates);

    let taken = 0;
    for (const [ei, ai] of candidates) {
        if (taken >= count) break;
        const mentions = edges.filter(e => e.stated![ai]).length;
        if (mentions <= 1) continue;
        edges[ei].stated![ai] = false;
        taken++;
    }

    return next;
}

/** Pairs and axes this layout leaves open, and those it pins down. */
export function indeterminatePairs(layout: NdLayout): Array<{ a: string; b: string; axis: number }> {
    const out: Array<{ a: string; b: string; axis: number }> = [];
    // Closed once rather than per pair; `determinedOn` is the same reading.
    const closed = closeAxes(layout);
    for (let i = 0; i < layout.words.length; i++) {
        for (let j = i + 1; j < layout.words.length; j++) {
            layout.axes.forEach((_, ax) => {
                if (closed[ax].find(layout.words[i]) !== closed[ax].find(layout.words[j])) {
                    out.push({ a: layout.words[i], b: layout.words[j], axis: ax });
                }
            });
        }
    }
    return out;
}

/* ------------------------------------------------------------------ *
 * Bridges — one axis's gap given by another's                         *
 * ------------------------------------------------------------------ */

/** Axes a bridge may use at either end: ordered, unbounded lines. */
function bridgeableAxes(layout: NdLayout): number[] {
    return layout.axes
        .map((a, i) => (isCircular(a) || isParity(a) ? -1 : i))
        .filter(i => i >= 0);
}

/**
 * Cut one axis in two and join it again through another axis.
 *
 * The cut is one withheld clause — the indeterminate rung's machinery, put to
 * the opposite use: the axis *looks* open to anyone carrying it on its own, and
 * is in fact closed through a second axis. Both sides keep at least two
 * objects, or there is no pair across the cut except the bridge's own.
 *
 * The bridge spans at least two steps on its own axis, so that reading it as
 * one ordinary step gives a different answer, and its source gap is at least
 * two premises long, so that gap has to be derived rather than read off one
 * sentence. Circular and parity axes are excluded at both ends: a ring has no
 * size of gap to equal and a parity axis has no gap at all.
 *
 * Returns null when this layout has no such bridge; the caller draws another.
 */
export function drawBridge(layout: NdLayout): NdLayout | null {
    const straight = bridgeableAxes(layout);
    if (straight.length < 2) return null;
    const c = layout.coords;

    for (const X of shuffled(straight)) {
        const edges = layout.edges.map(e => ({
            ...e,
            deltas: [...e.deltas],
            stated: e.stated ? [...e.stated] : layout.axes.map(() => true),
        }));
        const cuttable = shuffled(edges.filter(e => e.deltas[X] !== 0 && e.stated[X]));

        for (const cut of cuttable) {
            cut.stated[X] = false;
            const groups = closeAxes({ ...layout, edges, couplings: [] })[X];
            const side = (w: string) => groups.find(w) === groups.find(cut.from);
            const near = layout.words.filter(side);
            const far = layout.words.filter(w => !side(w));
            // A tree loses exactly one link on X, so exactly two sides — unless
            // the layout had withheld something already, which this does not
            // stack on.
            const roots = new Set(layout.words.map(w => groups.find(w)));
            if (roots.size !== 2 || near.length < 2 || far.length < 2) {
                cut.stated[X] = true;
                continue;
            }

            const options: NdBridge[] = [];
            for (const r of layout.words) {
                for (const b of side(r) ? far : near) {
                    const d = c[r][X] - c[b][X];
                    if (Math.abs(d) < 2) continue;
                    for (const Y of straight) {
                        if (Y === X) continue;
                        for (const g of layout.words) {
                            for (const h of layout.words) {
                                if (g === h || c[g][Y] - c[h][Y] !== Math.abs(d)) continue;
                                if (graphDistance(g, h, layout.neighbors) < 2) continue;
                                if (new Set([r, b, g, h]).size < 3) continue;
                                options.push({ kind: "bridge", r, b, axis: X, g, h, via: Y,
                                    sign: d > 0 ? 1 : -1 });
                            }
                        }
                    }
                }
            }
            if (!options.length) {
                cut.stated[X] = true;
                continue;
            }
            return { ...layout, edges, couplings: [pick(options)] };
        }
    }
    return null;
}

/**
 * The layout as a reader would build it who misread the bridge.
 *
 * `one-step` takes the bridge as an ordinary premise — one step in the
 * direction it names — and `reversed` takes its direction the wrong way round.
 * Either moves the far side of the cut as a block, so every pair across it
 * comes out shifted and every pair within a side is untouched. These are what
 * the conclusion is required to disagree with, which is what makes every form
 * of question need the bridge rather than only the one that names its pair.
 */
export function bridgeReading(layout: NdLayout, how: "one-step" | "reversed"): NdLayout {
    const bridge = layout.couplings?.find((c): c is NdBridge => c.kind === "bridge");
    if (!bridge) return layout;
    const X = bridge.axis;
    const d = layout.coords[bridge.r][X] - layout.coords[bridge.b][X];
    const shift = how === "one-step" ? bridge.sign - d : -2 * d;

    // The side of the cut `r` is on, by the stated premises alone.
    const groups = closeAxes({ ...layout, couplings: [] })[X];
    const coords: Record<string, number[]> = {};
    for (const w of layout.words) {
        coords[w] = [...layout.coords[w]];
        if (groups.find(w) === groups.find(bridge.r)) coords[w][X] += shift;
    }
    return { ...layout, coords };
}

/**
 * A coupling premise, each half painted in its own axis's colour.
 *
 * The direction words sit in spans of their own, exactly as a premise clause
 * does, so a reader finds the two axes by colour and the relabelling pass
 * rewrites them like any other — "as many steps" is the one new phrase, and it
 * names no axis.
 */
export function renderNdCoupling(layout: NdLayout, coupling: NdCoupling): string {
    const colors = ndAxisColors(layout.axes);
    if (coupling.kind === "rank") return `${subj(coupling.a)} is <b>listed before</b> ${subj(coupling.b)}`;
    if (coupling.kind === "total") {
        // The relation as a premise words it, every axis named, then the total.
        return `${subj(coupling.a)} is ${relationClauses(layout, coupling.a, coupling.b).join(", ")}`
            + ` relative to ${subj(coupling.b)}, <b>${coupling.total} steps in all</b>`;
    }
    const x = layout.axes[coupling.axis].scale;
    const y = layout.axes[coupling.via].scale;
    const linked = (scale: LinearScale, word: string, color: string) =>
        hi(word, color) + (scale.link ? ` ${scale.link}` : "");
    const xWord = x.direction[coupling.sign > 0 ? 0 : 1];
    return `${subj(coupling.r)} is as many ${x.unit}s `
        + `${linked(x, xWord, colors[coupling.axis])} ${subj(coupling.b)}`
        + ` as ${subj(coupling.g)} is ${linked(y, y.direction[0], colors[coupling.via])} ${subj(coupling.h)}`;
}

/**
 * How many relations the derivation of `a` against `b` composes, on one axis
 * or — with none named — the deepest axis.
 *
 * On an uncoupled layout this is the tree distance. A bridge is one premise,
 * but using it means first deriving its source gap, so crossing it costs one
 * plus that gap's own derivation: the X path, the bridge, and the Y path.
 */
export function ndPairDepth(layout: NdLayout, a: string, b: string, axis?: number): number {
    if (axis == null) {
        return Math.max(...layout.axes.map((_, i) => ndPairDepth(layout, a, b, i)));
    }
    if (a === b) return 0;
    const links = (w: string): Array<[string, number]> => {
        const out: Array<[string, number]> = [];
        for (const e of layout.edges) {
            if (e.stated && !e.stated[axis]) continue;
            if (e.from === w) out.push([e.to, 1]);
            if (e.to === w) out.push([e.from, 1]);
        }
        for (const c of layout.couplings ?? []) {
            if (c.axis !== axis || c.kind === "rank") continue;
            const [p, q] = c.kind === "bridge" ? [c.r, c.b] : [c.a, c.b];
            const other = p === w ? q : q === w ? p : null;
            if (!other) continue;
            const without = { ...layout, couplings: layout.couplings!.filter(k => k !== c) };
            // A bridge needs its source gap first; a total needs every other
            // counted axis between the same pair.
            const source = c.kind === "bridge"
                ? ndPairDepth(without, c.g, c.h, c.via)
                : Math.max(0, ...countedAxes(layout.axes).filter(i => i !== axis)
                    .map(i => ndPairDepth(without, c.a, c.b, i)));
            if (Number.isFinite(source)) out.push([other, 1 + source]);
        }
        return out;
    };

    // Dijkstra over a handful of objects; a linear scan for the minimum is fine.
    const dist = new Map<string, number>([[a, 0]]);
    const done = new Set<string>();
    while (true) {
        let cur: string | null = null;
        for (const [w, d] of dist) if (!done.has(w) && (cur == null || d < dist.get(cur)!)) cur = w;
        if (cur == null) return Infinity;
        if (cur === b) return dist.get(b)!;
        done.add(cur);
        for (const [n, cost] of links(cur)) {
            const via = dist.get(cur)! + cost;
            if (via < (dist.get(n) ?? Infinity)) dist.set(n, via);
        }
    }
}

/* ------------------------------------------------------------------ *
 * Local clocks — a shear between two axes                             *
 * ------------------------------------------------------------------ */

/** The axis read on local clocks, if any, and what sets them. */
export function clockAxes(layout: { axes: AxisSpec[] }): { target: number; source: number; rate: number } | null {
    const target = layout.axes.findIndex(a => a.local);
    if (target < 0) return null;
    return { target, ...layout.axes[target].local! };
}

/**
 * Which zone an object's clock is set by.
 *
 * On a straight source axis, its position: only differences ever matter, so
 * where zero sits is immaterial. On a looped one, its position counted from
 * the date line, 1 to m — absolute, because crossing the line is where a
 * clock jumps back, and a difference of positions cannot see that.
 */
export function zoneOf(layout: NdLayout, w: string, source: number): number {
    const v = layout.coords[w][source];
    return isCircular(layout.axes[source]) ? mod(v, layout.axes[source].modulus!) + 1 : v;
}

/** What a premise states on one axis: the real step, or its local reading. */
export function statedDelta(layout: NdLayout, edge: NdEdge, axis: number): number {
    const clock = layout.axes[axis].local;
    if (!edge.local || !clock) return edge.deltas[axis];
    return edge.deltas[axis]
        + clock.rate * (zoneOf(layout, edge.to, clock.source) - zoneOf(layout, edge.from, clock.source));
}

/**
 * Re-read some of a layout's premises as local-clock readings.
 *
 * The drawn unit steps become what the marked premises *say*, and the real
 * steps are worked back from them: real = stated − rate × (zone change). So
 * every printed clause stays one step, as the one-step note promises, and the
 * real arrangement is whatever those readings imply. The literal reader's
 * model — every clause taken at face value — is then exactly the layout that
 * was drawn, which is what makes it a lure that can be checked.
 *
 * Marked and unmarked premises are mixed, at least one of each where there
 * are two: if every premise were marked the correction would telescope to the
 * two ends of the question, and the item would be one subtraction at the end
 * rather than a running total carried through the marked premises only.
 */
export function skewEdges(drawn: NdLayout, target: number, source: number, rate = 1): NdLayout {
    const axes = drawn.axes.map((a, i) => (i === target ? { ...a, local: { source, rate } } : a));
    const marks = drawn.edges.map(() => Math.random() < 0.5);
    if (drawn.edges.length >= 2) {
        if (marks.every(m => !m)) marks[Math.floor(Math.random() * marks.length)] = true;
        if (marks.every(m => m)) marks[Math.floor(Math.random() * marks.length)] = false;
    }
    // Zones come from the source axis, which the skew never changes.
    const zones = (w: string) => zoneOf({ ...drawn, axes }, w, source);
    const edges: NdEdge[] = drawn.edges.map((e, i) => {
        if (!marks[i]) return { ...e, deltas: [...e.deltas] };
        const deltas = [...e.deltas];
        deltas[target] = e.deltas[target] - rate * (zones(e.to) - zones(e.from));
        return { ...e, deltas, local: true };
    });
    const layout: NdLayout = { ...drawn, axes, edges };
    return { ...layout, coords: coordsFromEdges(layout, edges) };
}

/**
 * A clocked layout as some reader would build it.
 *
 * `literal` takes every clause at face value — the per-axis reading, which
 * never lets the time column see the east one. `wrong-way` corrects in the
 * wrong direction; `no-date-line` corrects by the step on the source axis, as
 * though the loop had no line on it; `all-corrected` corrects the unmarked
 * premises too. The coordinates are real-time ones, so `inReading` can put
 * any of them into the clock the question asks about.
 */
export type ClockMisreading = "literal" | "wrong-way" | "no-date-line" | "all-corrected";

export function clockModel(layout: NdLayout, how: ClockMisreading): NdLayout {
    const clock = clockAxes(layout);
    if (!clock) return layout;
    const { target, source, rate } = clock;
    const zones = (w: string) => zoneOf(layout, w, source);
    const edges = layout.edges.map(e => {
        const said = statedDelta(layout, e, target);
        const shift = zones(e.to) - zones(e.from);
        const deltas = [...e.deltas];
        deltas[target] =
            how === "literal" ? said
            : how === "all-corrected" ? said - rate * shift
            : !e.local ? said
            : how === "wrong-way" ? said + rate * shift
            : said - rate * e.deltas[source];
        return { ...e, deltas };
    });
    return { ...layout, edges, coords: coordsFromEdges(layout, edges) };
}

/** The same layout with the clocked axis read on the clock asked about. */
export function inReading(layout: NdLayout, reading: "station" | "local"): NdLayout {
    const clock = clockAxes(layout);
    if (!clock || reading === "station") return { ...layout, reading: "station" };
    const coords: Record<string, number[]> = {};
    for (const w of layout.words) {
        coords[w] = [...layout.coords[w]];
        coords[w][clock.target] += clock.rate * zoneOf(layout, w, clock.source);
    }
    return { ...layout, coords, reading: "local" };
}

/**
 * Where the date line is, as one object's zone.
 *
 * Steps fix every zone relative to every other, and only up to the loop; one
 * absolute zone pins them all. Without it a clocked premise that crosses the
 * line cannot be told from one that does not.
 */
export function renderZoneAnchor(layout: NdLayout, source: number): string {
    const w = layout.words[Math.floor(Math.random() * layout.words.length)];
    const axis = layout.axes[source];
    const color = ndAxisColors(layout.axes)[source];
    return `${subj(w)} is in zone ${zoneOf(layout, w, source)} of ${axis.modulus},`
        + ` counting ${hi(axis.scale.cyclic!.direction[0], color)} from the date line`;
}

/* ------------------------------------------------------------------ *
 * The light cone — time as a travel budget                            *
 * ------------------------------------------------------------------ */

/** Axes a ring travels along. Height counts; size, amount and kind do not. */
const TRAVEL_IDS = new Set(["east", "north", "up", "vertical", "horizontal"]);

/**
 * The time axis and the axes a ring travels along, if this stack has a cone.
 *
 * A straight time axis and at least two straight travel axes. Any travel axis
 * bent into a loop rules it out: distance on a ring is the short way round,
 * and a rule stated in steps east would then be wrong on the item it governs.
 */
export function coneAxes(axes: AxisSpec[]): { time: number; space: number[] } | null {
    const time = axes.findIndex(a => a.scale.id === "temporal" && !isCircular(a) && !isParity(a));
    const travel = axes.map((a, i) => (TRAVEL_IDS.has(a.scale.id) ? i : -1)).filter(i => i >= 0);
    if (time < 0 || travel.length < 2 || travel.some(i => isCircular(axes[i]))) return null;
    return { time, space: travel };
}

/** Steps a ring needs from `a` to `b`: taxicab, one travel axis at a time. */
export function travelSteps(layout: NdLayout, a: string, b: string): number {
    const cone = coneAxes(layout.axes)!;
    return cone.space.reduce((t, i) => t + Math.abs(layout.coords[b][i] - layout.coords[a][i]), 0);
}

/** The objects along the route the premises give, ends included. */
export function routePath(layout: NdLayout, a: string, b: string): string[] {
    return pathBetween(layout, a, b) ?? [];
}

/** Steps summed premise by premise along the route the premises give. */
export function routeSteps(layout: NdLayout, a: string, b: string): number {
    const path = pathBetween(layout, a, b) ?? [];
    let total = 0;
    for (let i = 0; i < path.length - 1; i++) total += edgeSteps(layout, edgeBetween(layout, path[i], path[i + 1])!.edge);
    return total;
}

/** The premise forms on that route. */
export function routeForms(layout: NdLayout, a: string, b: string): Array<NdEdge["form"]> {
    const path = pathBetween(layout, a, b) ?? [];
    return path.slice(1).map((w, i) => edgeBetween(layout, path[i], w)!.edge.form);
}

/** The same along one premise, from its own steps. */
export function edgeSteps(layout: NdLayout, edge: NdEdge): number {
    const cone = coneAxes(layout.axes)!;
    return cone.space.reduce((t, i) => t + Math.abs(edge.deltas[i]), 0);
}

/**
 * A layout re-timed for the cone.
 *
 * Time steps are drawn from −1 to 4 minutes rather than ±1, so a gap sits near
 * the distance it is compared with and the answers are not all "no". Then
 * `kind` turns some premises into signal or reach premises, whose time is the
 * distance exactly or at least the distance, on the hearer's side. Those need
 * a premise that actually moves along a travel axis; a ring arriving from the
 * same spot says nothing.
 *
 * A reach premise's time clause is withheld (`stated` false on time), which is
 * exactly what makes it a bound: `closeAxes` then reads time across it as
 * open, and the conclusion has to be settled from one side.
 */
export function coneLayout(
    drawn: NdLayout, kind: "cone" | "signal" | "reach", count: number,
): NdLayout | null {
    const cone = coneAxes(drawn.axes);
    if (!cone) return null;
    const axes = drawn.axes.map((a, i) => (i === cone.time ? { ...a, stride: { unit: "min" } } : a));
    const edges: NdEdge[] = drawn.edges.map(e => {
        const deltas = [...e.deltas];
        deltas[cone.time] = Math.floor(Math.random() * 6) - 1;
        return { ...e, deltas, stated: e.stated ? [...e.stated] : undefined };
    });
    if (kind !== "cone") {
        const movers = shuffled(edges.filter(e => cone.space.some(i => e.deltas[i] !== 0)));
        // Never every premise: one stated time at least, or the item has no
        // clock to read anything against.
        const take = Math.min(count, movers.length, edges.length - 1);
        if (take < 1) return null;
        for (const e of movers.slice(0, take)) {
            const len = cone.space.reduce((t, i) => t + Math.abs(e.deltas[i]), 0);
            const gap = kind === "signal" ? len : len + Math.floor(Math.random() * 3);
            e.deltas[cone.time] = Math.random() < 0.5 ? gap : -gap;
            e.form = kind;
            if (kind === "reach") {
                e.stated = (e.stated ?? axes.map(() => true)).map((v, i) => (i === cone.time ? false : v));
            }
        }
    }
    const layout: NdLayout = { ...drawn, axes, edges };
    return { ...layout, coords: coordsFromEdges(layout, edges) };
}

/**
 * How much later `b` rang than `a`, as far as the premises say: a range.
 *
 * Along the one route the premises give, a stated or signal time adds a fixed
 * amount, and a reach premise adds "at least its distance" when the route runs
 * towards its hearer and "at most minus it" when it runs away. So a route with
 * reach premises all one way round has one finite end; one with both ways has
 * none, and nothing about the pair's timing is settled.
 */
export function timeBounds(layout: NdLayout, a: string, b: string): { lo: number; hi: number } {
    const cone = coneAxes(layout.axes)!;
    const path = pathBetween(layout, a, b);
    if (!path) return { lo: -Infinity, hi: Infinity };
    let lo = 0, hi = 0;
    for (let i = 0; i < path.length - 1; i++) {
        const found = edgeBetween(layout, path[i], path[i + 1])!;
        const dt = found.sign * found.edge.deltas[cone.time];
        if (found.edge.form !== "reach") { lo += dt; hi += dt; continue; }
        const len = edgeSteps(layout, found.edge);
        if (dt > 0) { lo += len; hi = Infinity; } else { hi -= len; lo = -Infinity; }
    }
    return { lo, hi };
}

/* ------------------------------------------------------------------ *
 * Kind frames — a direction word read by its speaker's kind           *
 * ------------------------------------------------------------------ */

/** An object's kind under frames: its class on the parity axis. */
export function kindOf(layout: NdLayout, w: string): 0 | 1 {
    const f = layout.frames!;
    return f.fixed ?? (mod(layout.coords[w][f.parity], 2) as 0 | 1);
}

/** The frame change itself: an involution, so applying it twice is nothing. */
function frameMap(f: NonNullable<NdLayout["frames"]>, d: number[]): number[] {
    const out = [...d];
    if (f.rule === "mirror") out[f.axes[0]] = -d[f.axes[0]];
    else { out[f.axes[0]] = d[f.axes[1]]; out[f.axes[1]] = d[f.axes[0]]; }
    return out;
}

/** A displacement as `ref` would state it. */
export function reckon(layout: NdLayout, ref: string, d: number[]): number[] {
    if (!layout.frames) return d;
    return kindOf(layout, ref) ? frameMap(layout.frames, d) : d;
}

/**
 * Where `a` is relative to `b`, as `b` reckons it — what any claim "a is …
 * relative to b" is checked against. On a layout without frames, simply the
 * difference of positions. Every conclusion builder reads through this, so a
 * claim, a construction slot and an analogy key can never disagree about
 * whose reckoning they are in.
 */
export function relDelta(layout: NdLayout, a: string, b: string): number[] {
    return reckon(layout, b, layout.coords[a].map((v, i) => v - layout.coords[b][i]));
}

/**
 * Kind frames over a drawn layout that already has a parity axis.
 *
 * Each premise is said from a fixed end, in that end's reckoning. The frame
 * axes must be straight lines: a ring has no east to mirror into west, and a
 * swap between a line and a loop would carry a position onto an axis that
 * wraps.
 */
export function kindsLayout(drawn: NdLayout, rule: "mirror" | "swap"): NdLayout | null {
    const parity = drawn.axes.findIndex(a => isParity(a));
    const straight = drawn.axes.map((a, i) => (isCircular(a) || isParity(a) ? -1 : i)).filter(i => i >= 0);
    if (parity < 0 || straight.length < (rule === "swap" ? 2 : 1)) return null;
    const axes = shuffled(straight).slice(0, rule === "swap" ? 2 : 1);
    const edges = drawn.edges.map(e => ({ ...e, flip: Math.random() < 0.5 }));
    return { ...drawn, edges, frames: { parity, rule, axes } };
}

/**
 * The layout a reader would build who took every premise at face value.
 *
 * Positions are the stated words summed as though every reference were kind
 * 0; `fixed` then says how that reader reads a claim — at face value (0), or
 * with the frame change applied to the whole result (1), the two kind-blind
 * readings the item has to defeat.
 */
export function kindsFaceValue(layout: NdLayout, fixed: 0 | 1): NdLayout {
    const edges = layout.edges.map(e => {
        // What the card says, from its reference, turned back into from → to.
        const sign = e.flip ? -1 : 1;
        const said = reckon(layout, e.flip ? e.to : e.from, e.deltas.map(d => sign * d));
        return { ...e, deltas: said.map(d => sign * d) };
    });
    const faced = { ...layout, edges, frames: { ...layout.frames!, fixed } };
    return { ...faced, coords: coordsFromEdges(faced, edges) };
}

/* ------------------------------------------------------------------ *
 * Walking totals — one step budget across every dimension             *
 * ------------------------------------------------------------------ */

/** A relation as a premise words it, every axis named: a's relation to b. */
export function relationClauses(layout: NdLayout, a: string, b: string): string[] {
    const colors = ndAxisColors(layout.axes);
    const d = relDelta(layout, a, b);
    return layout.axes.map((axis, i) => hi(
        isCircular(axis)
            ? displacementClause(displacementOn(layout, i, a, b), axis.modulus!, axis.scale.cyclic!, axis.scale.tie)
            : axisClause(axis, isParity(axis) ? mod(d[i], 2) : Math.sign(d[i])),
        colors[i]));
}

/**
 * Cut one straight axis and close it again with a total.
 *
 * As a bridge does, but through the same pair's other gaps rather than a
 * different axis between a different pair: the cut axis's gap is whatever the
 * total leaves once every other straight gap is subtracted. The pair crosses
 * the cut and differs on the cut axis — a level pair would read its gap off
 * the tie word — and on some other straight axis too, or the total is just the
 * gap restated.
 */
export function drawWalk(layout: NdLayout): NdLayout | null {
    const counted = countedAxes(layout.axes);
    if (counted.length < 2) return null;
    const c = layout.coords;

    for (const X of shuffled(counted)) {
        const edges = layout.edges.map(e => ({
            ...e,
            deltas: [...e.deltas],
            stated: e.stated ? [...e.stated] : layout.axes.map(() => true),
        }));
        for (const cut of shuffled(edges.filter(e => e.deltas[X] !== 0 && e.stated[X]))) {
            cut.stated[X] = false;
            const groups = closeAxes({ ...layout, edges, couplings: [] })[X];
            const side = (w: string) => groups.find(w) === groups.find(cut.from);
            const near = layout.words.filter(side);
            const far = layout.words.filter(w => !side(w));
            if (near.length < 2 || far.length < 2) { cut.stated[X] = true; continue; }

            const options: NdTotal[] = [];
            for (const a of layout.words) {
                for (const b of side(a) ? far : near) {
                    if (graphDistance(a, b, layout.neighbors) < 2 || c[a][X] === c[b][X]) continue;
                    const others = counted.filter(i => i !== X).reduce((t, i) => t + Math.abs(c[a][i] - c[b][i]), 0);
                    if (others === 0) continue;
                    options.push({ kind: "total", a, b, axis: X, total: others + Math.abs(c[a][X] - c[b][X]) });
                }
            }
            if (!options.length) { cut.stated[X] = true; continue; }
            return { ...layout, edges, couplings: [pick(options)] };
        }
    }
    return null;
}

/**
 * The walked layout as a reader would build it who misread the total.
 *
 * `one-step` takes the premise as an ordinary one: one step on every axis it
 * names. `legs` counts each named leg as one step and gives the cut axis the
 * rest. `whole` hands the cut axis the entire total. Each sets the pair's gap
 * on the cut axis and moves the far side of the cut with it.
 */
export function walkReading(layout: NdLayout, how: "one-step" | "legs" | "whole"): NdLayout {
    const walk = layout.couplings?.find((c): c is NdTotal => c.kind === "total");
    if (!walk) return layout;
    const X = walk.axis;
    const d = layout.coords[walk.a][X] - layout.coords[walk.b][X];
    const others = countedAxes(layout.axes).filter(i => i !== X)
        .map(i => layout.coords[walk.a][i] - layout.coords[walk.b][i]);
    const size = how === "one-step" ? 1
        : how === "whole" ? walk.total
        : walk.total - others.filter(g => g !== 0).length;
    const shift = Math.sign(d) * size - d;
    const groups = closeAxes({ ...layout, couplings: [] })[X];
    const coords: Record<string, number[]> = {};
    for (const w of layout.words) {
        coords[w] = [...layout.coords[w]];
        if (groups.find(w) === groups.find(walk.a)) coords[w][X] += shift;
    }
    return { ...layout, coords };
}

/**
 * Counting every step on every dimension: straight gaps in full, a loop the
 * short way round. A kind is not a distance and is not counted.
 */
export function walkDistance(layout: NdLayout, a: string, b: string): number {
    return layout.axes.reduce((t, axis, i) => {
        if (isParity(axis)) return t;
        if (isCircular(axis)) {
            const m = axis.modulus!, s = displacementOn(layout, i, a, b);
            return t + Math.min(s, m - s);
        }
        return t + Math.abs(layout.coords[a][i] - layout.coords[b][i]);
    }, 0);
}

/** The per-axis stand-ins: dimensions differing, and the longest one leg. */
export function walkLures(layout: NdLayout, a: string, b: string): { hamming: number; widest: number } {
    const legs = layout.axes.map((axis, i) => {
        if (isParity(axis)) return 0;
        if (isCircular(axis)) {
            const m = axis.modulus!, s = displacementOn(layout, i, a, b);
            return Math.min(s, m - s);
        }
        return Math.abs(layout.coords[a][i] - layout.coords[b][i]);
    });
    return { hamming: legs.filter(l => l !== 0).length, widest: Math.max(...legs) };
}

/* ------------------------------------------------------------------ *
 * Ranked lists — lexicographic premises                               *
 * ------------------------------------------------------------------ */

/**
 * Which list a stack can carry: a key axis and a tiebreak, both straight,
 * with an order people already sort by. A timetable — time, then height, low
 * first — where there is time to sort by; otherwise reading order — the
 * northernmost row first, then west to east — which every stack from two
 * axes up has.
 */
export function rankOrder(axes: AxisSpec[]): { key: number; keyDir: 1 | -1; tie: number; tieDir: 1 | -1 } | null {
    const at = (id: string) => axes.findIndex(a => a.scale.id === id && !isCircular(a) && !isParity(a));
    const [time, up, north, east] = ["temporal", "up", "north", "east"].map(at);
    if (time >= 0 && up >= 0) return { key: time, keyDir: 1, tie: up, tieDir: 1 };
    if (north >= 0 && east >= 0) return { key: north, keyDir: -1, tie: east, tieDir: 1 };
    return null;
}

/** Whether `a` comes before `b` on the list, by the layout's own positions. */
function listedBefore(layout: NdLayout, o: NonNullable<ReturnType<typeof rankOrder>>, a: string, b: string): boolean {
    const k = o.keyDir * (layout.coords[a][o.key] - layout.coords[b][o.key]);
    if (k !== 0) return k < 0;
    return o.tieDir * (layout.coords[a][o.tie] - layout.coords[b][o.tie]) < 0;
}

/**
 * Two rankings across a cut tiebreak.
 *
 * No two things may share both a key and a tiebreak position — the setup
 * says so, because "listed before" between two things level on both would
 * otherwise be undefined, and the item would rest on a convention nobody
 * stated. The key axis is never cut, so every ranking's case can be decided.
 *
 * One ranking is informative: a pair level on the key, across the cut, at
 * least two premises apart, so it carries the tiebreak across. The other is
 * idle: a pair one step apart on the key, so it says nothing about the
 * tiebreak, chosen so that reading it as a tiebreak statement anyway is false.
 */
export function drawRanks(layout: NdLayout): NdLayout | null {
    const o = rankOrder(layout.axes);
    if (!o) return null;
    const c = layout.coords;
    const cell = new Set(layout.words.map(w => `${c[w][o.key]},${c[w][o.tie]}`));
    if (cell.size < layout.words.length) return null;

    const edges = layout.edges.map(e => ({
        ...e,
        deltas: [...e.deltas],
        stated: e.stated ? [...e.stated] : layout.axes.map(() => true),
    }));
    for (const cut of shuffled(edges.filter(e => e.deltas[o.tie] !== 0))) {
        cut.stated[o.tie] = false;
        const groups = closeAxes({ ...layout, edges, couplings: [] })[o.tie];
        const side = (w: string) => groups.find(w) === groups.find(cut.from);
        const near = layout.words.filter(side), far = layout.words.filter(w => !side(w));
        if (near.length < 2 || far.length < 2) { cut.stated[o.tie] = true; continue; }

        const across: Array<[string, string]> = [];
        for (const a of layout.words) for (const b of side(a) ? far : near) {
            if (listedBefore(layout, o, a, b)) across.push([a, b]);
        }
        const informative = across.filter(([a, b]) =>
            c[a][o.key] === c[b][o.key] && graphDistance(a, b, layout.neighbors) >= 2);
        // Read as a tiebreak statement, "a before b" would put a first on the
        // tiebreak; idle, it is the other way round.
        const idle = across.filter(([a, b]) => Math.abs(c[a][o.key] - c[b][o.key]) === 1
            && o.tieDir * (c[a][o.tie] - c[b][o.tie]) > 0);
        if (!informative.length || !idle.length) { cut.stated[o.tie] = true; continue; }
        const rank = ([a, b]: [string, string]): NdRank =>
            ({ kind: "rank", a, b, key: o.key, keyDir: o.keyDir, axis: o.tie, tieDir: o.tieDir });
        return { ...layout, edges, couplings: [rank(pick(informative)), rank(pick(idle))] };
    }
    return null;
}

/**
 * Bounds on `a − b` along one axis, from what the premises say exactly and
 * what the rankings say at least. Difference constraints, closed by
 * Floyd–Warshall over a handful of objects; `null` where they contradict.
 *
 * `how` models the readers: `true` takes a ranking as a tiebreak statement
 * only where its pair is level on the key; `all` takes every ranking that way;
 * `none` ignores the rankings; `flipped` reads the tiebreak the wrong way.
 */
export function boundsOn(
    layout: NdLayout, axis: number, a: string, b: string,
    how: "true" | "all" | "none" | "flipped" = "true",
): { lo: number; hi: number } | null {
    const words = layout.words;
    const ix = new Map(words.map((w, i) => [w, i]));
    const n = words.length;
    // d[u][v] is the most x_v − x_u can be.
    const d = words.map((_, i) => words.map((__, j) => (i === j ? 0 : Infinity)));
    const most = (u: string, v: string, w: number) => {
        const [i, j] = [ix.get(u)!, ix.get(v)!];
        d[i][j] = Math.min(d[i][j], w);
    };
    for (const e of layout.edges) {
        if (e.stated && !e.stated[axis]) continue;
        most(e.from, e.to, e.deltas[axis]);
        most(e.to, e.from, -e.deltas[axis]);
    }
    for (const c of layout.couplings ?? []) {
        if (c.kind !== "rank" || c.axis !== axis || how === "none") continue;
        const level = layout.coords[c.a][c.key] === layout.coords[c.b][c.key];
        if (!level && how !== "all") continue;
        // a before b: tieDir·(x_a − x_b) ≤ −1, so x_b − x_a ≥ 1 along tieDir.
        const dir = how === "flipped" ? -c.tieDir : c.tieDir;
        if (dir > 0) most(c.b, c.a, -1); else most(c.a, c.b, -1);
    }
    for (let k = 0; k < n; k++) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        if (d[i][k] + d[k][j] < d[i][j]) d[i][j] = d[i][k] + d[k][j];
    }
    if (words.some((_, i) => d[i][i] < 0)) return null;
    const [i, j] = [ix.get(a)!, ix.get(b)!];
    return { lo: -d[i][j], hi: d[j][i] };
}

function shuffled<T>(xs: T[]): T[] {
    const out = [...xs];
    shuffleInPlace(out);
    return out;
}

function shuffleInPlace<T>(xs: T[]) {
    for (let i = xs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [xs[i], xs[j]] = [xs[j], xs[i]];
    }
}

export function compareOn(layout: NdLayout, axis: number, a: string, b: string): -1 | 0 | 1 {
    const d = relDelta(layout, a, b)[axis];
    return d === 0 ? 0 : (d > 0 ? 1 : -1);
}

/** Steps from b forward to a, on a circular axis. */
export function displacementOn(layout: NdLayout, axis: number, a: string, b: string): number {
    const m = layout.axes[axis].modulus!;
    return mod(layout.coords[a][axis] - layout.coords[b][axis], m);
}

/** Steps between two objects through the stated premises. */
export function graphDistance(a: string, b: string, neighbors: Record<string, string[]>): number {
    if (a === b) return 0;
    const seen = new Set([a]);
    let layer = [a], dist = 0;
    while (layer.length) {
        dist++;
        const next: string[] = [];
        for (const node of layer) {
            for (const n of neighbors[node] ?? []) {
                if (seen.has(n)) continue;
                if (n === b) return dist;
                seen.add(n);
                next.push(n);
            }
        }
        layer = next;
    }
    return Infinity;
}

/**
 * The pair furthest apart, so the answer has to compose the whole premise set.
 *
 * `slack` is how many steps below the diameter may be drawn from; zero, the
 * default, means the diameter exactly. It replaces a flat 30% chance of drawing
 * from *every* pair including span 2 — so on a five-premise item roughly one
 * conclusion in three could be answered from two premises, which is the
 * complaint this whole change comes from. See `pickDistantPair` in
 * `linear.utils` for the longer version of the argument.
 *
 * `legacy` is that flat 30% draw, put back for the player who has switched the
 * deep conclusions off. Written as the old rule rather than as a wide `slack`,
 * because the two are not the same shape: slack widens by bands from the
 * diameter, and what v3 did was ignore the diameter entirely, three times in
 * ten, in favour of every pair equally.
 */
export function pickDistantPair(
    layout: NdLayout, minSpan = 2, slack = 0, legacy = false,
): [string, string] | null {
    const pairs: Array<[string, string, number]> = [];
    for (let i = 0; i < layout.words.length; i++) {
        for (let j = i + 1; j < layout.words.length; j++) {
            const d = graphDistance(layout.words[i], layout.words[j], layout.neighbors);
            if (Number.isFinite(d) && d >= minSpan) pairs.push([layout.words[i], layout.words[j], d]);
        }
    }
    if (!pairs.length) return null;

    const max = Math.max(...pairs.map(p => p[2]));
    const anyPair = legacy && Math.random() < 0.3;
    const floor = anyPair ? minSpan : Math.max(minSpan, max - Math.max(0, slack));
    const chosen = pick(pairs.filter(p => p[2] >= floor));
    return [chosen[0], chosen[1]];
}

/* ------------------------------------------------------------------ *
 * Phrasing                                                            *
 * ------------------------------------------------------------------ */

/** `color` is an axis colour class, for a phrase that belongs to one axis. */

/** The clause one axis contributes to a premise. */
function axisClause(axis: AxisSpec, delta: number): string {
    if (isParity(axis)) {
        // Any odd number of steps is a change of class; any even number is not.
        return mod(delta, 2) === 0 ? axis.scale.parity!.same : axis.scale.parity!.opposite;
    }
    if (isCircular(axis)) {
        const c = axis.scale.cyclic!;
        if (delta === 0) return axis.scale.tie;
        return delta > 0 ? c.direction[0] : c.direction[1];
    }
    if (delta === 0) return axis.scale.tie;
    const word = delta > 0 ? axis.scale.direction[0] : axis.scale.direction[1];
    return axis.stride ? `${Math.abs(delta)} ${axis.stride.unit} ${word}` : word;
}

export interface NdRenderOptions {
    /**
     * Leave out the axes with no difference.
     *
     * Sound only because the convention is stated with the item: an axis that
     * goes unmentioned means no difference on it, so the layout is still fully
     * determined. Without that line "not mentioned" and "no difference" are
     * indistinguishable and the axis the conclusion asks about may not be
     * derivable at all.
     *
     * Worth having because a six-axis premise naming every axis is six clauses
     * long, and most of them are usually "same". Shorter to read, and slightly
     * harder: you can no longer tick the axes off as you go.
     */
    compact?: boolean;
}

/** One premise, naming the axes this pair differs on. */
export function renderNdPremise(
    layout: NdLayout,
    edge: NdEdge,
    flip: boolean,
    options: NdRenderOptions = {},
): string {
    const cone = edge.form ? coneAxes(layout.axes) : null;
    // A signal or reach premise is said from the hearer's side, so its
    // subject is always the one that rang later.
    if (cone) flip = edge.deltas[cone.time] < 0;
    const [from, to] = flip ? [edge.to, edge.from] : [edge.from, edge.to];
    const sign = flip ? -1 : 1;
    const colors = ndAxisColors(layout.axes);

    /*
     * One span per axis rather than one around the lot.
     *
     * The clause list is the whole premise, and at five or six dimensions it is
     * a run of similar-looking phrases that have to be split apart before any
     * of them can be used. Colouring each by its axis does that splitting for
     * the reader, and does it the same way in every premise — so the three
     * mentions of the time axis across three premises are found by colour
     * instead of by re-reading. Position cannot do this job once the order is
     * configurable, and `compact` already removes clauses from the middle.
     */
    // In the reference's reckoning, which is only ever not kind 0's under frames.
    const said = reckon(layout, from, layout.axes.map((_, i) => sign * statedDelta(layout, edge, i)));
    const clauses = layout.axes
        .map((axis, i) => ({ axis, i, delta: said[i] }))
        .filter(c => edge.stated ? edge.stated[c.i] : true)
        // The time a signal or reach premise implies is not printed; it is
        // what the reader derives from the distance.
        .filter(c => !cone || c.i !== cone.time)
        .filter(c => !options.compact || c.delta !== 0)
        .map(c => hi(axisClause(c.axis, c.delta), colors[c.i]));

    // Every edge moves on at least one axis, so this cannot be empty — but a
    // hand-built layout could be, and an empty clause list reads as a bug.
    if (!clauses.length) return `${subj(to)} is at the same point as ${subj(from)}`;

    // Named in front, so the reading is known before any clause is.
    const by = edge.local ? `<b>By local clocks</b>, ` : "";
    const heard = edge.form === "signal"
        ? `, and rang the moment ${subj(from)}'s ring reached it`
        : edge.form === "reach"
        ? `, and rang only after ${subj(from)}'s ring had reached it`
        : "";
    return `${by}${subj(to)} is ${clauses.join(", ")} relative to ${subj(from)}${heard}`;
}

/**
 * A displacement's clauses with no objects attached — a pattern, not a premise.
 *
 * Wanted by any mode that has to show a *rule* rather than an instance of one.
 * Same clause wording and same per-axis colours as a real premise, so the two
 * can be compared line by line, which is the only way a pattern is legible
 * against the relations it is meant to describe.
 */
export function renderNdPattern(axes: AxisSpec[], deltas: number[]): string {
    const colors = ndAxisColors(axes);
    return axes
        .map((axis, i) => hi(axisClause(axis, deltas[i]), colors[i]))
        .join(", ");
}

/**
 * One direction of one axis, in that axis's colour — "east", not "east, same
 * latitude". For naming a direction on its own, where a whole pattern would
 * state a position on every other axis that nobody meant.
 */
export function renderNdDirection(axes: AxisSpec[], axis: number, delta: number): string {
    return hi(axisClause(axes[axis], delta), ndAxisColors(axes)[axis]);
}

export function renderNdPremises(layout: NdLayout, options: NdRenderOptions = {}): string[] {
    return layout.edges.map(e => renderNdPremise(layout, e, e.flip ?? Math.random() > 0.5, options));
}

/**
 * The arrangement the first `count` premises determine, on their own.
 *
 * The composed-space twin of `prefixLayout` in `linear.utils`, and it exists
 * for the same reason: a checkpoint claim has to be answerable *at that point
 * in the reading*, so it must follow from a prefix of the premises as
 * displayed, not from any subset of that size. "Any five of ten" is not
 * answerable halfway down the page, because which five is not known until the
 * tenth has been read.
 *
 * Coordinates come from the finished layout rather than being re-walked. The
 * prefix fixes the *shape*; where that shape sits is arbitrary and the same
 * either way. What the prefix does decide is which pairs are connected at all,
 * and that is carried by `neighbors` — so a pair the prefix leaves in separate
 * components is at infinite distance and the pair picker will not ask about it,
 * which is exactly the pair whose relation the prefix has not yet fixed.
 */
export function ndPrefixLayout(layout: NdLayout, count: number): NdLayout {
    const edges = layout.edges.slice(0, count);
    const neighbors: Record<string, string[]> = {};
    for (const e of edges) {
        (neighbors[e.from] ??= []).push(e.to);
        (neighbors[e.to] ??= []).push(e.from);
    }

    const words = Object.keys(neighbors);
    const coords: Record<string, number[]> = {};
    for (const w of words) coords[w] = layout.coords[w];

    return { ...layout, words, coords, edges, neighbors };
}

export interface NdConclusion {
    text: string;
    isValid: boolean;
    axis: number;
    /** The pair asked about, so callers can check an edit changed it. */
    a: string;
    b: string;
}

/**
 * A claim about one axis, true or false by construction.
 *
 * Straight axes get an ordering claim. Circular axes get a displacement claim,
 * because ordering has no meaning on a ring — asking whether one point is
 * "east of" another when you can travel either way round is not a question with
 * an answer, and generating it would produce items whose stated answer is
 * arbitrary.
 */
export function buildNdConclusion(
    layout: NdLayout,
    a: string,
    b: string,
    axisIndex: number,
    wantValid: boolean,
): NdConclusion {
    const axis = layout.axes[axisIndex];
    // The conclusion names one axis, so it is painted like that axis's clauses
    // — which says *which* dimension is being asked about before the sentence
    // is read, and matters most in the modes that ask about several.
    const color = ndAxisColors(layout.axes)[axisIndex];

    if (isParity(axis)) {
        /*
         * Two possible claims, so a false one is fully determined: there is no
         * "wrong by how much" to choose. That also makes this the one axis
         * where a false conclusion carries as much information as a true one.
         */
        const truth = sameClass(layout, axisIndex, a, b);
        const claim = wantValid ? truth : !truth;
        const p = axis.scale.parity!;
        return {
            text: `${subj(a)} ${rel(claim ? p.sameRelation : p.oppositeRelation, color)} ${subj(b)}`,
            isValid: claim === truth,
            axis: axisIndex,
            a, b,
        };
    }

    if (isCircular(axis)) {
        const c = axis.scale.cyclic!;
        const m = axis.modulus!;
        const truth = displacementOn(layout, axisIndex, a, b);

        const claim = wantValid ? truth : pickWrongDisplacement(truth, m);
        return { text: displacementText(a, b, claim, m, c, color), isValid: claim === truth, axis: axisIndex, a, b };
    }

    const truth = compareOn(layout, axisIndex, a, b);
    const kinds: Array<-1 | 0 | 1> = [-1, 0, 1];
    const claim = wantValid ? truth : pick(kinds.filter(k => k !== truth));
    const word = claim === 0 ? axis.scale.same : (claim > 0 ? axis.scale.above : axis.scale.below);

    return {
        text: `${subj(a)} ${rel(word, color)} ${subj(b)}`,
        isValid: claim === truth,
        axis: axisIndex,
        a, b,
    };
}

/**
 * A claim naming **every** axis the item is built on, true or false.
 *
 * `buildNdConclusion` names one. On a seven-axis item that means three premises
 * stating twenty-one relations and a conclusion about one of them, so
 * six-sevenths of every premise is there to be read and discarded — and which
 * axis got picked was arbitrary, because no answer to "which one" is better
 * than any other. A 2-D map deserves a 2-D conclusion and a 7-D map all seven.
 *
 * Worded exactly like a premise, through the same `axisClause`, so the claim
 * and the statements it has to be checked against read the same way round.
 *
 * **A false claim is wrong on exactly one axis.** Wrong on five out of seven is
 * spotted from whichever axis the reader happens to check first, which turns a
 * seven-dimensional item back into a one-dimensional one by the back door.
 *
 * Returns null when the item cannot carry a wide claim, and the caller falls
 * back to the single-axis form. One case is left: a pair the premises do not
 * settle on every axis, which the under-specification rungs produce
 * deliberately — a claim about an axis nobody stated is unanswerable rather
 * than hard.
 *
 * **A circular axis used to be the other case, and is not any more.** Its
 * relation is a displacement in steps rather than a direction word, so it had
 * no clause of this shape and any item carrying one fell back to a claim about
 * a single axis — which meant the modes that make a ring the interesting
 * dimension were exactly the modes that never got a wide conclusion.
 * `displacementClause` is that missing shape.
 */
export function buildNdWideConclusion(
    layout: NdLayout,
    a: string,
    b: string,
    wantValid: boolean,
    mustBeDetermined: boolean,
    /**
     * Where a false claim may lie, and what it may say there. Absent, any axis
     * and any wrong value. A bridged item passes the misreadings' own values on
     * the bridged axis, so the claim is false exactly where a misreader would
     * call it true — a lie on an axis the bridge never touched is caught
     * without the bridge, and the item would not need it.
     */
    lies?: Array<{ axis: number; value: number }>,
): NdConclusion | null {
    if (mustBeDetermined
        && layout.axes.some((_, i) => !determinedOn(layout, i, a, b))) return null;

    const colors = ndAxisColors(layout.axes);
    /*
     * A ring's fact about a pair is how far round, so its entry here is the
     * displacement rather than a coordinate difference. The two are different
     * numbers — on a loop of five, coordinates 0 and 4 differ by -4 and sit one
     * step apart — and mixing them up would state the long way round as though
     * it were the short one.
     */
    const said = relDelta(layout, a, b);
    const truth = layout.axes.map((axis, i) => isCircular(axis)
        ? displacementOn(layout, i, a, b)
        : said[i]);
    const claim = [...truth];

    /*
     * Which axis carries the lie, and what a lie is on it.
     *
     * A parity axis has exactly one other thing it could say, so one extra step
     * flips it. Everything else reads the sign, so any delta of a different
     * sign — including zero, which reads as "the same" — is a different claim.
     */
    let flipped = -1;
    if (!wantValid && lies?.length) {
        const lie = pick(lies);
        flipped = lie.axis;
        claim[flipped] = lie.value;
    } else if (!wantValid) {
        const candidates = layout.axes.map((_, i) => i);
        flipped = pick(candidates);
        const axis = layout.axes[flipped];
        if (isCircular(axis)) {
            // Off by one where it can be: a near miss on a ring is the claim
            // worth having to check, and a wild one is dismissed on sight.
            claim[flipped] = pickWrongDisplacement(truth[flipped], axis.modulus!);
        } else if (isParity(axis)) {
            claim[flipped] = truth[flipped] + 1;
        } else {
            const kinds = [-1, 0, 1].filter(k => k !== Math.sign(truth[flipped]));
            claim[flipped] = pick(kinds);
        }
    }

    const clauses = layout.axes.map((axis, i) => hi(
        isCircular(axis)
            ? displacementClause(claim[i], axis.modulus!, axis.scale.cyclic!, axis.scale.tie)
            : axisClause(axis, claim[i]),
        colors[i]));
    return {
        text: `${subj(a)} is ${clauses.join(", ")} relative to ${subj(b)}`,
        isValid: wantValid,
        // The axis the answer turns on: the lie, or — on a true claim — nothing
        // in particular, since every axis has to hold.
        axis: flipped,
        a, b,
    };
}

/** Wrong by a genuine amount — off by one is the interesting near miss. */
function pickWrongDisplacement(truth: number, m: number): number {
    const options: number[] = [];
    for (let d = 0; d < m; d++) if (d !== truth) options.push(d);
    if (!options.length) return truth;
    const near = options.filter(d => mod(d - truth, m) === 1 || mod(truth - d, m) === 1);
    return near.length && Math.random() < 0.6 ? pick(near) : pick(options);
}

/**
 * A displacement as a clause: no subjects, no verb, no link word.
 *
 * The sentence form below states one axis and so can be a whole relation —
 * *"Amber is 2 steps clockwise from Neck"*. A conclusion naming every axis
 * cannot: it is a comma-joined list sitting between one subject and the other,
 * so each entry has to be a phrase rather than a claim. Same three cases and
 * the same short-way-round rule, said the other way.
 */
function displacementClause(
    steps: number,
    m: number,
    c: NonNullable<LinearScale["cyclic"]>,
    tie: string,
): string {
    if (steps === 0) return tie;
    if (m % 2 === 0 && steps === m / 2) return c.oppositeClause;
    const forward = steps <= m / 2;
    const n = forward ? steps : m - steps;
    const dir = forward ? c.direction[0] : c.direction[1];
    return `${n} ${n === 1 ? c.step : c.step + "s"} ${dir}`;
}

function displacementText(
    a: string,
    b: string,
    steps: number,
    m: number,
    c: NonNullable<LinearScale["cyclic"]>,
    color = "",
): string {
    if (steps === 0) return `${subj(a)} ${rel(c.same, color)} ${subj(b)}`;
    if (m % 2 === 0 && steps === m / 2) return `${subj(a)} ${rel(c.opposite, color)} ${subj(b)}`;
    // Say it the short way round, which is how anyone reads a dial.
    const forward = steps <= m / 2;
    const n = forward ? steps : m - steps;
    const dir = forward ? c.direction[0] : c.direction[1];
    const noun = n === 1 ? c.step : c.step + "s";
    return `${subj(a)} ${rel(`is ${n} ${noun} ${dir} ${c.link}`, color)} ${subj(b)}`;
}

/* ------------------------------------------------------------------ *
 * Analogy — relations between relations                               *
 * ------------------------------------------------------------------ */

/**
 * "A to B is the same relation as C to D."
 *
 * Every other claim in this file is first-order: it names two objects and asks
 * where one sits relative to the other. This one takes two *relations* as its
 * terms, which is a different operation — the relation has to be held as an
 * object before it can be compared to another one. That is what analogy is, and
 * it is why this belongs as a question form available to every layout rather
 * than as a mode of its own.
 *
 * Matching is on **direction per axis, not distance**. Two reasons: the premises
 * state directions, so this is the sense of "same relation" the item's own
 * language establishes; and exact vector equality between derived pairs is rare
 * enough in six dimensions to be unusable. The convention is stated with the
 * item either way, because "same relation" is otherwise ambiguous.
 */
export interface NdAnalogy {
    text: string;
    isValid: boolean;
    /** a→b compared against c→d. */
    pairs: [string, string, string, string];
    claimSame: boolean;
}

/**
 * Sign per axis, as a comparable key. Circular axes compare by displacement.
 *
 * Exported because two modes now compare pair relations rather than one:
 * Analogy judges a stated match, and Analogy Completion asks for the pair that
 * makes one. A second copy of this would be a second answer to "are these the
 * same relation", and the two would drift the first time an axis kind changed.
 */
export function relationKey(layout: NdLayout, a: string, b: string): string {
    return layout.axes.map((axis, i) => isParity(axis)
        ? (sameClass(layout, i, a, b) ? 0 : 1)
        : isCircular(axis)
        ? displacementOn(layout, i, b, a)
        : Math.sign(relDelta(layout, b, a)[i])).join(",");
}

/** The key a relation would have if every direction were reversed. */
function reversedKey(layout: NdLayout, key: string): string {
    return key.split(",").map((v, i) => {
        const axis = layout.axes[i];
        // On a ring, reversing is going the other way round, which is not
        // negation of a signed step but the complement modulo the loop.
        // Its own reverse: swapping the pair does not change same or opposite.
        if (isParity(layout.axes[i])) return Number(v);
        if (isCircular(axis)) return mod(-Number(v), axis.modulus!);
        return -Number(v);
    }).join(",");
}

/**
 * Ordered pairs whose relation has to be derived rather than read.
 *
 * A pair stated as a premise makes the analogy a comparison of two sentences.
 * All-zero relations are dropped too: a relation with no direction on any axis
 * is its own reverse, so "same" and "opposite" stop being different claims.
 */
export function derivedPairs(layout: NdLayout): Array<{ a: string; b: string; key: string }> {
    const out: Array<{ a: string; b: string; key: string }> = [];
    const zero = layout.axes.map(() => 0).join(",");
    for (const a of layout.words) {
        for (const b of layout.words) {
            if (a === b) continue;
            if (graphDistance(a, b, layout.neighbors) < 2) continue;
            const key = relationKey(layout, a, b);
            if (key === zero) continue;
            out.push({ a, b, key });
        }
    }
    return out;
}

export function buildNdAnalogy(
    layout: NdLayout,
    wantValid: boolean,
    claimSame = Math.random() < 0.5,
    /**
     * Extra condition every candidate must meet — used to require that the
     * item's operations actually change this claim's truth.
     *
     * A filter over the whole candidate set rather than a test applied to one
     * drawn claim, and the difference is not cosmetic. There are typically
     * dozens of matching pairs and only some are touched by an operation, so
     * drawing first and testing after fails almost always; filtering finds one
     * whenever one exists.
     */
    accept?: (candidate: { pairs: [string, string, string, string]; claimSame: boolean }) => boolean,
): NdAnalogy | null {
    const pairs = derivedPairs(layout);
    if (pairs.length < 2) return null;

    const candidates: Array<[typeof pairs[0], typeof pairs[0]]> = [];
    for (const first of pairs) {
        // What the second relation must be for the claim to hold.
        const target = claimSame ? first.key : reversedKey(layout, first.key);
        for (const second of pairs) {
            // Four distinct objects: sharing one makes the claim a statement
            // about two objects coinciding rather than about two relations.
            if (second.a === first.a || second.a === first.b) continue;
            if (second.b === first.a || second.b === first.b) continue;
            if ((second.key === target) !== wantValid) continue;
            if (accept && !accept({ pairs: [first.a, first.b, second.a, second.b], claimSame })) continue;
            candidates.push([first, second]);
        }
    }
    if (!candidates.length) return null;

    const [first, second] = pick(candidates);
    const word = claimSame ? PAIR_RELATION_WORDS.same : PAIR_RELATION_WORDS.opposite;
    return {
        text: `${subj(first.a)} ${own("pair-to")} ${subj(first.b)} ${rel(word)} ${subj(second.a)} ${own("pair-to")} ${subj(second.b)}`,
        isValid: wantValid,
        pairs: [first.a, first.b, second.a, second.b],
        claimSame,
    };
}

/** Distinct analogy claims, for the multi-conclusion and choice modes. */
export function buildNdAnalogySet(
    layout: NdLayout,
    wantValid: boolean[],
    accept?: (candidate: { pairs: [string, string, string, string]; claimSame: boolean }) => boolean,
    /**
     * A condition per claim, by position, replacing `accept`. A coupled item
     * needs it: the set is true only if every claim is, so which claims must
     * need the bridge depends on which one is false — see the caller.
     */
    acceptAt?: (index: number) => ((candidate: { pairs: [string, string, string, string]; claimSame: boolean }) => boolean) | undefined,
): NdAnalogy[] {
    const used = new Set<string>();
    const out: NdAnalogy[] = [];

    for (let guard = 0; out.length < wantValid.length && guard < wantValid.length * 60; guard++) {
        // Only the first claim carries the "operations must matter" condition:
        // requiring it of every claim in a set is a much stronger demand than
        // the item needs, and one that most layouts cannot meet.
        const claim = buildNdAnalogy(layout, wantValid[out.length], undefined,
            acceptAt ? acceptAt(out.length) : out.length === 0 ? accept : undefined);
        if (!claim) break;
        const key = claim.pairs.join(" ") + "#" + claim.claimSame;
        if (used.has(key)) continue;
        used.add(key);
        out.push(claim);
    }
    return out;
}

/**
 * The full relation between a pair, one slot per dimension.
 *
 * Every axis has to be filled, which is what makes this worth having: judging a
 * single claim tests one dimension and can be got right by luck, whereas
 * stating all of them tests whether the whole structure was actually carried.
 * A six-axis item has a one-in-729 guess floor.
 *
 * Circular axes offer every displacement rather than three orderings, since
 * ordering has no meaning on a ring — so they are harder slots, correctly.
 */
export function buildNdConstructClaim(
    layout: NdLayout,
    a: string,
    b: string,
    withDistance: boolean,
): ConstructClaim {
    const colors = ndAxisColors(layout.axes);

    const slots = layout.axes.map((axis, i) => {
        const scale = axis.scale;

        if (isParity(axis)) {
            // Two options, not three, and no distance: the construct slots
            // stopped assuming three when ranking needed five.
            const p = scale.parity!;
            return {
                label: scale.name,
                colorClass: colors[i],
                directions: [p.sameRelation, p.oppositeRelation],
                answerDirection: sameClass(layout, i, a, b) ? 0 : 1,
                answerMagnitude: 0,
                asksDistance: false,
            };
        }

        if (isCircular(axis)) {
            const c = scale.cyclic!;
            const m = axis.modulus!;
            const steps = displacementOn(layout, i, a, b);
            // Stated the short way round, which is how anyone reads a dial —
            // but judged modulo the loop, so the long way round also passes.
            const forward = steps <= m / 2;
            return {
                label: scale.name,
                colorClass: colors[i],
                directions: [c.direction[0], c.direction[1], c.same] as [string, string, string],
                answerDirection: (steps === 0 ? 2 : (forward ? 0 : 1)) as 0 | 1 | 2,
                answerMagnitude: steps === 0 ? 0 : (forward ? steps : m - steps),
                asksDistance: withDistance,
                modulus: m,
            };
        }

        const delta = relDelta(layout, a, b)[i];
        return {
            label: scale.name,
            colorClass: colors[i],
            directions: [scale.above, scale.below, scale.same] as [string, string, string],
            answerDirection: (delta === 0 ? 2 : (delta > 0 ? 0 : 1)) as 0 | 1 | 2,
            answerMagnitude: Math.abs(delta),
            asksDistance: withDistance,
        };
    });

    return { a, b, slots };
}

/** The bare relation phrase for a displacement, without the subjects. */
function displacementPhrase(steps: number, m: number, c: NonNullable<LinearScale["cyclic"]>): string {
    if (steps === 0) return c.same;
    if (m % 2 === 0 && steps === m / 2) return c.opposite;
    const forward = steps <= m / 2;
    const n = forward ? steps : m - steps;
    const dir = forward ? c.direction[0] : c.direction[1];
    return `is ${n} ${n === 1 ? c.step : c.step + "s"} ${dir} ${c.link}`;
}

/**
 * Distinct claims, for the multi-conclusion and choice modes.
 *
 * Distinct in *pair and axis together*, so a set can ask about the same two
 * objects along different dimensions — which is the interesting case in a space
 * with several, and the one that rewards having tracked all of them.
 */
export function buildNdConclusionSet(
    layout: NdLayout,
    count: number,
    wantValid: boolean[],
    legacy = false,
): NdConclusion[] {
    const used = new Set<string>();
    const out: NdConclusion[] = [];

    for (let guard = 0; out.length < count && guard < count * 60; guard++) {
        const pair = pickDistantPair(layout, 2, 0, legacy);
        if (!pair) break;
        const axisIndex = Math.floor(Math.random() * layout.axes.length);
        const key = [...pair].sort().join(" ") + "#" + axisIndex;
        if (used.has(key)) continue;
        used.add(key);
        out.push(buildNdConclusion(layout, pair[0], pair[1], axisIndex, wantValid[out.length]));
    }

    return out;
}

/**
 * Whether a set of axes can be told apart in a premise.
 *
 * Clauses are read by their words, not their position, so two axes sharing a
 * direction word would make a premise ambiguous to a reader even though the
 * generator knows what it meant. The defaults are clean; this exists because
 * the axis list is configurable.
 *
 * It used to have a standing example: "higher" belonged to both quantity and
 * vertical. That turned out to be a mistake in the data rather than a fact
 * about the vocabulary — quantity compares *amounts* and its relations say "is
 * more than", so its direction words are now "greater"/"smaller" and the two
 * axes can be stacked. The check stays; what it guards against is a
 * configuration nobody has built yet rather than one shipped by accident.
 */
export function axisWordConflicts(scales: LinearScale[]): string[] {
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const s of scales) {
        for (const w of [...s.direction, s.tie]) {
            const owner = seen.get(w);
            if (owner && owner !== s.id) clashes.push(`"${w}" is used by both ${owner} and ${s.id}`);
            else seen.set(w, s.id);
        }
    }
    return clashes;
}

/* ------------------------------------------------------------------ *
 * Explaining an answer                                                *
 * ------------------------------------------------------------------ */

/** Steps between two objects through the stated premises, as a path. */
/**
 * A route between two objects using only relations the reader actually has.
 *
 * `axis` matters because a relation can be stated on some axes and not others:
 * a withheld clause, or a report from someone who turned out to be lying,
 * leaves the pair joined in the layout but not in anything the player was told.
 *
 * Walking `neighbors` regardless — which this did — produced derivations that
 * reached the right answer through a premise the item had just finished saying
 * was false. Correct arithmetic, and a proof the reader could not follow, which
 * is worse than showing nothing.
 */
function pathBetween(layout: NdLayout, a: string, b: string, axis?: number): string[] | null {
    if (a === b) return [a];

    const usable = (x: string, y: string) => {
        if (axis == null) return true;
        const found = edgeBetween(layout, x, y);
        return !found || !found.edge.stated || found.edge.stated[axis];
    };

    /*
     * A bridge on this axis is a route too, once its source gap is settled —
     * on a bridged item it is the only route across the cut, and a derivation
     * that could not take it would have nothing to show.
     */
    const bridged = (w: string) => axis == null ? [] : (layout.couplings ?? [])
        .filter((c): c is NdBridge | NdTotal => c.axis === axis && c.kind !== "rank")
        .map(c => (c.kind === "bridge" ? { c, p: c.r, q: c.b } : { c, p: c.a, q: c.b }))
        .filter(({ p, q }) => p === w || q === w)
        .filter(({ c }) => {
            const without = { ...layout, couplings: layout.couplings!.filter(k => k !== c) };
            return c.kind === "bridge"
                ? determinedOn(without, c.via, c.g, c.h)
                : countedAxes(layout.axes).filter(i => i !== axis).every(i => determinedOn(without, i, c.a, c.b));
        })
        .map(({ p, q }) => (p === w ? q : p));

    const prev: Record<string, string> = {};
    const seen = new Set([a]);
    const queue = [a];

    while (queue.length) {
        const cur = queue.shift()!;
        const across = bridged(cur);
        for (const n of [...(layout.neighbors[cur] ?? []), ...across]) {
            if (seen.has(n)) continue;
            if (!usable(cur, n) && !across.includes(n)) continue;
            seen.add(n);
            prev[n] = cur;
            if (n === b) {
                const out = [b];
                let step = b;
                while (step !== a) { step = prev[step]; out.unshift(step); }
                return out;
            }
            queue.push(n);
        }
    }
    return null;
}

/** The edge joining two adjacent objects, and which way round it was stored. */
function edgeBetween(layout: NdLayout, u: string, v: string): { edge: NdEdge; sign: number } | null {
    for (const edge of layout.edges) {
        if (edge.from === u && edge.to === v) return { edge, sign: 1 };
        if (edge.from === v && edge.to === u) return { edge, sign: -1 };
    }
    return null;
}

/**
 * Why the answer is what it is, one premise at a time.
 *
 * Walks the chain of stated relations joining the pair and accumulates the
 * queried axis along it, so the reader sees the same derivation they were meant
 * to perform rather than just the verdict.
 *
 * Only sound while positions are the sum of the stated steps. Edits keep that
 * property — they rewrite an edge's vector and the layout is re-derived from
 * edges — but transformations set coordinates directly, so a path no longer
 * accounts for where something ended up. Those items get nothing rather than a
 * confident fiction.
 */
export function explainNdAxis(
    layout: NdLayout,
    a: string,
    b: string,
    axisIndex: number,
): string[] {
    const path = pathBetween(layout, a, b, axisIndex);
    if (!path || path.length < 2) return [];

    const axis = layout.axes[axisIndex];
    // Every line of a derivation is about the one axis being explained, so it
    // is painted like that axis throughout — the same cue the premises use.
    const color = ndAxisColors(layout.axes)[axisIndex];
    const lines: string[] = [];
    let total = 0;

    const runningTotal = () => isParity(axis)
        ? `now ${mod(total, 2) === 0 ? "the same" : "opposite"}`
        : isCircular(axis)
        ? `running total ${mod(total, axis.modulus!)}`
        : `running total ${total > 0 ? "+" : ""}${total}`;

    for (let i = 0; i < path.length - 1; i++) {
        const found = edgeBetween(layout, path[i], path[i + 1]);
        if (!found || (found.edge.stated && !found.edge.stated[axisIndex])) {
            /*
             * Across a bridge: its source gap is derived first, on its own
             * axis, and then carried over. Shown in full, because that order —
             * the other axis finished before this one can continue — is the
             * whole of what the item asks.
             */
            const ends = (c: NdCoupling) => (c.kind === "bridge" ? [c.r, c.b] : [c.a, c.b]);
            const crossing = (layout.couplings ?? []).find((c): c is NdBridge | NdTotal =>
                c.kind !== "rank" && c.axis === axisIndex
                && ends(c).includes(path[i]) && ends(c).includes(path[i + 1]));
            if (!crossing) return [];
            if (crossing.kind === "total") {
                /*
                 * Across a total: the other dimensions' gaps between the pair,
                 * each derived, and what the total leaves for this one.
                 */
                const others = countedAxes(layout.axes).filter(k => k !== axisIndex);
                const colors = ndAxisColors(layout.axes);
                const spent = others.map(k => ({ k, d: relDelta(layout, crossing.a, crossing.b)[k] }));
                const used = spent.reduce((t, x) => t + Math.abs(x.d), 0);
                const delta = layout.coords[path[i + 1]][axisIndex] - layout.coords[path[i]][axisIndex];
                total += delta;
                const legs = spent.filter(x => x.d !== 0)
                    .map(x => hi(`${Math.abs(x.d)} ${axisClause(layout.axes[x.k], x.d)}`, colors[x.k]));
                lines.push(
                    `No premise joins ${subj(path[i])} and ${subj(path[i + 1])} on ${hi(axis.scale.name, color)}`
                    + ` except the total: ${subj(crossing.a)} is ${crossing.total} steps in all from`
                    + ` ${subj(crossing.b)}, and on the other dimensions it is`
                    + ` ${legs.length ? legs.join(", ") : "level"} \u2014 ${used} of them`,
                    `so ${crossing.total - used} remain for ${hi(axis.scale.name, color)}:`
                    + ` ${subj(path[i + 1])} is ${hi(`${Math.abs(delta)} ${axisClause(axis, delta)}`, color)}`
                    + ` relative to ${subj(path[i])} \u2014 ${rel(runningTotal())}`);
                continue;
            }
            const bridge = crossing;
            const via = layout.axes[bridge.via];
            const viaColor = ndAxisColors(layout.axes)[bridge.via];
            const gap = layout.coords[bridge.g][bridge.via] - layout.coords[bridge.h][bridge.via];
            const source = explainNdAxis(
                { ...layout, couplings: layout.couplings!.filter(c => c !== bridge) },
                bridge.h, bridge.g, bridge.via);
            lines.push(
                `No premise joins ${subj(path[i])} and ${subj(path[i + 1])} on ${hi(axis.scale.name, color)}`
                + ` except the bridge, so first ${subj(bridge.g)} against ${subj(bridge.h)}`
                + ` on ${hi(via.scale.name, viaColor)}:`,
                ...source.slice(0, -1));

            const delta = layout.coords[path[i + 1]][axisIndex] - layout.coords[path[i]][axisIndex];
            total += delta;
            const steps = (n: number) => `${n} ${n === 1 ? axis.scale.unit : axis.scale.unit + "s"}`;
            lines.push(
                `so ${subj(bridge.g)} is ${hi(`${gap} ${via.scale.direction[0]}`, viaColor)}`
                + `${via.scale.link ? " " + via.scale.link : ""} ${subj(bridge.h)}, and by the bridge`
                + ` ${subj(path[i + 1])} is ${hi(`${steps(Math.abs(delta))} ${axisClause(axis, delta)}`, color)}`
                + `${axis.scale.link ? " " + axis.scale.link : ""} ${subj(path[i])}`
                + ` — ${rel(runningTotal())}`);
            continue;
        }
        if (layout.frames && !isParity(axis)) {
            /*
             * Under kind frames the walk is in the claim reference's reckoning.
             * A premise said from a reference of the other kind is shown as the
             * card says it and then converted, because that conversion, premise
             * by premise, is the item.
             */
            const v = layout.axes.map((_, k) => found.sign * found.edge.deltas[k]);
            const step = reckon(layout, a, v)[axisIndex];
            total += step;
            const ref = found.edge.flip ? found.edge.to : found.edge.from;
            const other = ref === found.edge.from ? found.edge.to : found.edge.from;
            const word = step === 0 ? axis.scale.tie : axisClause(axis, step);
            if (kindOf(layout, ref) !== kindOf(layout, a) && layout.frames.axes.includes(axisIndex)) {
                const said = reckon(layout, ref, ref === path[i] ? v : v.map(x => -x));
                const colors = ndAxisColors(layout.axes);
                const words = layout.frames.axes
                    .map(k => hi(axisClause(layout.axes[k], said[k]), colors[k])).join(", ");
                lines.push(
                    `${subj(other)} is ${words} relative to ${subj(ref)} as ${subj(ref)} reckons it;`
                    + ` ${subj(ref)} is the other kind from ${subj(a)}, so for ${subj(a)}`
                    + ` ${subj(path[i + 1])} is ${hi(word, color)} relative to ${subj(path[i])}`
                    + ` — ${rel(runningTotal())}`);
            } else {
                lines.push(
                    `${subj(path[i + 1])} is ${hi(word, color)} relative to ${subj(path[i])}`
                    + ` — ${rel(runningTotal())}`);
            }
            continue;
        }

        const delta = found.sign * found.edge.deltas[axisIndex];
        total += delta;

        if (found.edge.form === "signal" && coneAxes(layout.axes)?.time === axisIndex) {
            // A signal's time is its distance, on the hearer's side.
            lines.push(
                `${subj(found.sign * found.edge.deltas[axisIndex] > 0 ? path[i + 1] : path[i])} rang the moment`
                + ` ${subj(found.sign * found.edge.deltas[axisIndex] > 0 ? path[i] : path[i + 1])}'s ring reached it,`
                + ` ${edgeSteps(layout, found.edge)} step${edgeSteps(layout, found.edge) === 1 ? "" : "s"} away,`
                + ` so ${subj(path[i + 1])} is`
                + ` ${hi(axisClause(axis, delta), color)} relative to ${subj(path[i])} — ${rel(runningTotal())}`);
            continue;
        }

        if (found.edge.local && axis.local) {
            /*
             * A local reading, corrected to the station clock. Shown as its own
             * step with the zone change spelled out, because the correction is
             * per premise — it is the running total over the marked premises
             * that the item is about.
             */
            const said = found.sign * statedDelta(layout, found.edge, axisIndex);
            const src = layout.axes[axis.local.source];
            const srcColor = ndAxisColors(layout.axes)[axis.local.source];
            const zFrom = zoneOf(layout, path[i], axis.local.source);
            const zTo = zoneOf(layout, path[i + 1], axis.local.source);
            const where = isCircular(src)
                ? `${subj(path[i + 1])} is in zone ${zTo} and ${subj(path[i])} in zone ${zFrom}`
                : zTo === zFrom
                ? `they are at the same ${hi(src.scale.tie, srcColor)}`
                : `${subj(path[i + 1])} is ${hi(`${Math.abs(zTo - zFrom)} ${src.scale.direction[zTo > zFrom ? 0 : 1]}`, srcColor)}`;
            lines.push(
                `<b>by local clocks</b> ${subj(path[i + 1])} is ${hi(axisClause(axis, said), color)}`
                + ` relative to ${subj(path[i])}; ${where}, so by the station clock it is`
                + ` ${hi(delta === 0 ? axis.scale.tie : `${Math.abs(delta)} ${axisClause(axis, delta)}`, color)}`
                + ` — ${rel(runningTotal())}`);
            continue;
        }

        const word = delta === 0 ? axis.scale.tie : axisClause(axis, delta);
        lines.push(
            `${subj(path[i + 1])} is ${hi(word, color)} relative to ${subj(path[i])}`
            + ` — ${rel(runningTotal())}`);
    }

    /*
     * Asked by local clocks: the real gap, then each end's own clock. The
     * conversion happens once, at the ends, which is the one place it does.
     */
    if (axis.local && layout.reading === "local") {
        const ahead = axis.local.rate
            * (zoneOf(layout, b, axis.local.source) - zoneOf(layout, a, axis.local.source));
        total += ahead;
        lines.push(ahead === 0
            ? `${subj(b)}'s clock and ${subj(a)}'s read alike — ${rel(runningTotal())}`
            : `${subj(b)}'s clock reads ${hi(`${Math.abs(ahead)} ${axisClause(axis, ahead)}`, color)}`
              + ` than ${subj(a)}'s — ${rel(runningTotal())}`);
    }

    /*
     * Phrased exactly as the conclusion is, by the same rule — `scale.above` and
     * friends are whole clauses ("is south of"), not adjectives, so nothing may
     * be prefixed to them. The walk runs from the *second* named object to the
     * first because `compareOn(a, b)` means "a relative to b", and accumulating
     * a → b gives the opposite sign.
     */
    /*
     * Closed with the *same* phrase builder the conclusion uses. Writing a
     * second wording here produced derivations that were true but did not look
     * like the claim they were explaining — "2 steps round" against a claim of
     * "diametrically opposite" — which makes the reader check two things
     * instead of one.
     */
    const word = isParity(axis)
        ? (mod(total, 2) === 0 ? axis.scale.parity!.sameRelation : axis.scale.parity!.oppositeRelation)
        : isCircular(axis)
        ? displacementPhrase(mod(total, axis.modulus!), axis.modulus!, axis.scale.cyclic!)
        : total === 0 ? axis.scale.same : (total > 0 ? axis.scale.above : axis.scale.below);

    lines.push(`so ${subj(b)} ${rel(word, color)} ${subj(a)}`);
    return lines;
}

/**
 * How much of the declared space an item actually uses, in bits.
 *
 * Two things vary between items the difficulty model treats as identical: how
 * many axes carry any difference at all, and how far apart things sit on the
 * ones that do. Both are "how much of this axis must be kept straight", and
 * summing log2 of the distinct positions per axis measures them as one quantity
 * — the bits needed to locate an object in the space. A dead axis contributes
 * nothing, three positions contribute 1.58, seven contribute 2.81.
 *
 * Measured over 3,000 layouts per configuration, six-dimensional items at six
 * objects range from 6.6 to 13.3 bits. That is a twofold spread in what the
 * player actually has to hold, and it currently lands in the ability posterior
 * as noise.
 *
 * Note this is *not* a substitute for premise count. Width grows logarithmically
 * with size while premises grow linearly: 3 to 7 premises at three dimensions
 * moves width 4.1 → 5.7 bits. Premises add chain to traverse, width adds state
 * to hold, and they are separate quantities.
 */
/**
 * Bits needed to locate an object on each axis, separately.
 *
 * "Width" is the aggregate, but it is not really one quantity: it is spread on
 * the east-west axis, height on the vertical one, how long a span the temporal
 * one covers. Those move independently and a reader feels them separately — six
 * positions on one axis is a different demand from two positions on three axes,
 * even where the totals match.
 *
 * log₂ of the number of distinct coordinates: a dead axis contributes 0, three
 * positions 1.58, seven 2.81. That makes a wide 3D item directly comparable to
 * a narrow 6D one.
 */
export function ndAxisWidths(layout: NdLayout): number[] {
    return layout.axes.map((_, i) =>
        Math.log2(new Set(layout.words.map(w => layout.coords[w][i])).size));
}

/**
 * Total width, or the total over just the axes named.
 *
 * Naming a subset is what makes the dial per-axis: asking for a wide *time*
 * axis says nothing about the others, and averaging it into a single figure
 * would let a narrow time axis be paid for by a wide vertical one.
 */
export function ndWidth(layout: NdLayout, axes?: number[]): number {
    const widths = ndAxisWidths(layout);
    const scope = axes?.length ? axes.filter(i => i >= 0 && i < widths.length) : null;
    return (scope ?? widths.map((_, i) => i)).reduce((total, i) => total + widths[i], 0);
}

/**
 * The candidate at a requested percentile of the batch's own width.
 *
 * A percentile rather than a number of bits, and that is the whole reason this
 * works without the missing bits-to-levels coefficient. "As wide as the widest
 * tenth of what this configuration produces" is meaningful for any axis stack,
 * any object count and any tie chance, with no table to keep in step — where
 * "8.5 bits" is meaningless until you know what 8.5 is wide *for*.
 *
 * 50 is the median, which is the noise fix: two items the model scores
 * identically used to differ twofold in how much had to be held, and keeping
 * the middle of a batch removes the tails without moving the centre.
 */
export function pickByWidth(
    candidates: NdLayout[],
    percentile = 50,
    axes?: number[],
): NdLayout {
    if (candidates.length < 2) return candidates[0];

    const ranked = candidates
        .map(layout => ({ layout, width: ndWidth(layout, axes) }))
        .sort((a, b) => a.width - b.width);

    const at = Math.round((Math.min(100, Math.max(0, percentile)) / 100) * (ranked.length - 1));
    return ranked[at].layout;
}

/** The middle of a batch — `pickByWidth` at the fiftieth percentile. */
export function medianByWidth(candidates: NdLayout[]): NdLayout {
    return pickByWidth(candidates, 50);
}

/** Axes carrying any difference at all; the rest are declared but inert. */
export function ndLiveAxes(layout: NdLayout): number {
    return layout.axes.filter((_, i) =>
        new Set(layout.words.map(w => layout.coords[w][i])).size > 1).length;
}
