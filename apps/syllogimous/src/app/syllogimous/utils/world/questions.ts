/**
 * Composed World — the questions, every one an analogy.
 *
 * A relation between two things is read on a chosen set of axes at an hour:
 * how their stretches lie on each line, how many steps round a ring, same kind
 * or not. Every question asks for that relation carried somewhere else — to
 * another pair, another hour, another side of a transformation — so its answer
 * needs the places, the motion, the lengths, the seams and the events at both
 * hours, and the speakers that established them.
 *
 * Each kind defines its answer as a function of a reconstruction, which is what
 * lets the same function score the full reading and every shortcut one: the
 * item is kept only if every shortcut lands on a different answer or none.
 *
 * To add one: an entry in QUESTIONS with `draw` (choose its parameters from
 * the true world) and `answer` (compute it from any reconstruction).
 */

import { Axis, Body } from "./space";
import { IntervalRel, TIME, intervalRel, spaceSteps } from "./facts";
import { Reconstruction, World, spaceOf, thingAt } from "./reader";
import { mod } from "./space";

/** One axis's part of a relation. */
export type Part = IntervalRel | number | "same" | "opposite" | "reaches" | "short";

/**
 * Not an axis but read like one: whether a ring from the first, spreading a
 * step later per step through space, reaches the second by its time — the
 * light cone, as a relation an analogy can carry.
 */
export const REACH = -2;

export function relation(axes: Axis[], a: Body, b: Body, on: number[]): Part[] {
    return on.map(i => {
        if (i === REACH) return b.pos[TIME] - a.pos[TIME] >= spaceSteps(axes, b, a) ? "reaches" : "short";
        const ax = axes[i];
        if (ax.kind === "ring") return mod(a.pos[i] - b.pos[i], ax.modulus!);
        if (ax.kind === "parity") return mod(a.pos[i] - b.pos[i], 2) === 0 ? "same" : "opposite";
        return intervalRel(a, b, i);
    });
}
const sameRel = (p: Part[], q: Part[]) => p.length === q.length && p.every((v, i) => v === q[i]);

export type Answer = number | boolean | number[] | null;
export const answerKey = (a: Answer) => (a === null ? "none" : JSON.stringify(a));

export interface Ask {
    kind: string;
    /** Things by index. */
    x: number; y: number; z: number;
    /** For judge: the proposed counterpart. */
    w?: number;
    h1: number; h2: number;
    /** The space each relation is read in: 0 outside the brackets, 1 inside. */
    s1?: number; s2?: number;
    on: number[];
    /** Candidates offered (things or speakers), for choice and select. */
    options?: number[];
}

/**
 * The things a question reads, by space: its first pair where the first
 * relation is read, the rest where the second is. A card cut for one question
 * has to place these, and nothing else.
 */
export function askNeed(q: Ask): number[][] {
    const out: number[][] = [[], []];
    if (q.kind === "speakers") return out;
    out[q.s1 ?? 0].push(q.x, q.y);
    out[q.s2 ?? 0].push(q.z, ...(q.w !== undefined ? [q.w] : []), ...(q.options ?? []));
    return out.map(s => [...new Set(s)]);
}

export interface QuestionKind {
    id: string;
    answerMode: "choice" | "boolean" | "select" | "construct";
    /** Whether a card with this many things and speakers can ask it at all. */
    fits?(things: number, speakers: number): boolean;
    /** Asked only where the card leaves something open, and answered over every world it allows. */
    open?: boolean;
    /** Parameters for an item on these spaces, or null if they offer none; hours within `span`. */
    draw(spaces: Spaces, things: number, speakers: number, types: boolean[], rnd: () => number, span?: Span): Ask | null;
    answer(q: Ask, rec: Reconstruction): Answer;
}

const pick = <T>(xs: T[], rnd: () => number): T => xs[Math.floor(rnd() * xs.length)];
function shuffle<T>(xs: T[], rnd: () => number): T[] {
    const out = [...xs];
    for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
    return out;
}

/** Which axes a relation is read on: one to three, mixing lines with a ring or kinds. */
function drawAxes(axes: Axis[], rnd: () => number): number[] {
    const n = 1 + Math.floor(rnd() * 3);
    const on = shuffle(axes.map((_, i) => i), rnd).slice(0, n).sort((a, b) => a - b);
    /* Where time is a line, now and then the light cone besides. */
    return axes[TIME]?.kind === "line" && rnd() < 0.25 ? [...on, REACH] : on;
}

/** Every thing (and the Post) standing to `z` at `h` as the relation says. */
function matches(world: World, things: number, z: number, h: number, on: number[], rel: Part[], among: number[]): number[] {
    const zb = thingAt(world, z, h);
    return among.filter(w => w !== z && sameRel(relation(world.axes, zb, thingAt(world, w, h), on), rel));
}

/* Things only: the origin is a point the places are measured from, not
   something that stands in a relation. */
const everyone = (things: number) => Array.from({ length: things }, (_, i) => i);

/* The things a question may be drawn from on a side of the brackets: on a card shown in parts, those shown there so far. */
const drawable = (sp: Spaces, things: number, side?: number) => sp.among?.[side ?? 0] ?? everyone(things);

/* The first pair from the first relation's side, the third term from the second's; null where a side has too few. */
function drawPairs(first: number[], second: number[], rnd: () => number) {
    const x = pick(first, rnd);
    const y = pick(first.filter(t => t !== x), rnd);
    const z = pick(second.filter(t => t !== x), rnd);
    return y === undefined || z === undefined ? null : { x, y, z };
}

/** The hours a question may read its two relations at, inclusive. */
export interface Span { h1: [number, number]; h2: [number, number] }
export const ALL_DAY: Span = { h1: [1, 11], h2: [1, 11] };

function hours(rnd: () => number, span: Span) {
    const within = ([lo, hi]: [number, number]) => lo + Math.floor(rnd() * (hi - lo + 1));
    const h1 = within(span.h1);
    const same = h1 >= span.h2[0] && h1 <= span.h2[1] && rnd() < 0.25;
    return { h1, h2: same ? h1 : within(span.h2) };
}

/** The space outside the brackets and, where the card has one, the space inside. */
export interface Spaces {
    world: World; inner?: World; alternatives?: World[];
    /** On a card shown in parts, the things shown so far on each side of the brackets, which alone a question may be drawn from. */
    among?: number[][];
}

/** The one length the worlds a card allows disagree on, and the values it takes in them. */
export function openLength(sp: Spaces): { thing: number; axis: number; values: number[] } | null {
    const alts = sp.alternatives;
    if (!alts || alts.length < 2) return null;
    for (let k = 0; k < alts[0].start.length; k++) for (let a = 0; a < alts[0].axes.length; a++) {
        const values = [...new Set(alts.map(w => w.start[k].size[a]))];
        if (values.length > 1) return { thing: k, axis: a, values: values.sort() };
    }
    return null;
}

/**
 * What follows from the card: the answer every world it allows gives, or none
 * where they differ. A kind asked about what could be answers over them itself.
 */
export function answerFollows(kind: QuestionKind, q: Ask, rec: Reconstruction): Answer {
    if (kind.open) return kind.answer(q, rec);
    const worlds = rec.alternatives ?? [rec.world];
    const answers = worlds.map(world => kind.answer(q, { ...rec, world }));
    return answers.every(a => answerKey(a) === answerKey(answers[0])) ? answers[0] : null;
}

/** Which space each relation of an analogy is read in, where there are two. */
function drawSpaces(spaces: Spaces, rnd: () => number) {
    if (!spaces.inner) return {};
    return { s1: rnd() < 0.5 ? 1 : 0, s2: rnd() < 0.5 ? 1 : 0 };
}

/** The relation an analogy reads first, and where the second is looked for. */
const firstRel = (sp: Spaces, q: Ask) => {
    const w = spaceOf(sp, q.s1);
    return relation(w.axes, thingAt(w, q.x, q.h1), thingAt(w, q.y, q.h1), q.on);
};

export const QUESTIONS: Record<string, QuestionKind> = {
    /* "At h1, X is to Y as Z is to which of these at h2?" Two offered, one
       fits — and it is the only one anywhere, so the other is not ruled out by
       being the wrong one of several that would do. Two rather than every
       candidate, because a longer menu can be shortened by looking. */
    which: {
        id: "which",
        answerMode: "choice",
        /* Two to offer besides the third term. */
        fits: things => things >= 3,
        draw(sp, things, _s, _t, rnd, span = ALL_DAY) {
            const sides = drawSpaces(sp, rnd), first = drawable(sp, things, sides.s1), second = drawable(sp, things, sides.s2);
            const pair = drawPairs(first, second, rnd);
            if (!pair) return null;
            const { x, y, z } = pair, { h1, h2 } = hours(rnd, span), on = drawAxes(sp.world.axes, rnd);
            const q: Ask = { kind: "which", x, y, z, h1, h2, on, ...sides };
            const pool = second.filter(w => w !== z);
            const fit = matches(spaceOf(sp, q.s2), things, z, h2, on, firstRel(sp, q), pool);
            if (fit.length !== 1 || pool.length < 2) return null;
            /* The other option a near miss where there is one: the candidate
               whose relation to Z differs from the asked one on fewest dimensions,
               so it cannot be ruled out at a glance. */
            const w2 = spaceOf(sp, q.s2), want = firstRel(sp, q);
            const misses = (c: number) => relation(w2.axes, thingAt(w2, z, h2), thingAt(w2, c, h2), on).filter((p, k) => p !== want[k]).length;
            const rest = pool.filter(w => w !== fit[0]);
            const fewest = Math.min(...rest.map(misses));
            const other = pick(rest.filter(c => misses(c) === fewest), rnd);
            return { ...q, options: shuffle([fit[0], other], rnd) };
        },
        answer(q, rec) {
            const w = spaceOf(rec, q.s2);
            const m = matches(w, w.start.length, q.z, q.h2, q.on, firstRel(rec, q), q.options!);
            return m.length === 1 ? m[0] : null;
        },
    },
    /* "At h1, X is to Y as Z is to W at h2": true or false, half each. */
    judge: {
        id: "judge",
        answerMode: "boolean",
        draw(sp, things, _s, _t, rnd, span = ALL_DAY) {
            const sides = drawSpaces(sp, rnd), second = drawable(sp, things, sides.s2), pair = drawPairs(drawable(sp, things, sides.s1), second, rnd);
            if (!pair) return null;
            const { x, y, z } = pair, { h1, h2 } = hours(rnd, span), on = drawAxes(sp.world.axes, rnd);
            const w = pick(second.filter(t => t !== z), rnd);
            return { kind: "judge", x, y, z, w, h1, h2, on, ...sides };
        },
        answer(q, rec) {
            const s = spaceOf(rec, q.s2);
            return sameRel(relation(s.axes, thingAt(s, q.z, q.h2), thingAt(s, q.w!, q.h2), q.on), firstRel(rec, q));
        },
    },
    /* "At h1, X is to Y as Z is to which of these at h2?" Every one that fits, or none. */
    every: {
        id: "every",
        answerMode: "select",
        /* Three to choose among at least: two would be a choice with a submit button. */
        fits: things => things >= 4,
        draw(sp, things, _s, _t, rnd, span = ALL_DAY) {
            const sides = drawSpaces(sp, rnd), second = drawable(sp, things, sides.s2), pair = drawPairs(drawable(sp, things, sides.s1), second, rnd);
            if (!pair) return null;
            const { x, y, z } = pair, { h1, h2 } = hours(rnd, span), on = drawAxes(sp.world.axes, rnd).slice(0, 2);
            return { kind: "every", x, y, z, h1, h2, on, ...sides, options: second.filter(w => w !== z) };
        },
        answer(q, rec) {
            const w = spaceOf(rec, q.s2);
            return matches(w, w.start.length, q.z, q.h2, q.on, firstRel(rec, q), q.options!).sort((a, b) => a - b);
        },
    },
    /* "At h1, X stands to Y as Z stands to which of these at h2? Select every
       one that could": on a card that leaves a length open, every candidate
       that fits in some world the card allows. Outside the brackets only, where
       the openness is. */
    could: {
        id: "could",
        answerMode: "select",
        open: true,
        fits: things => things >= 4,
        draw(sp, things, _s, _t, rnd, span = ALL_DAY) {
            /* About what is open: the thing whose length differs between the
               worlds allowed, on the line it differs along, as a term on one side
               of the analogy or the other. */
            const open = openLength(sp);
            if (!open) return null;
            const out = drawable(sp, things, 0), pair = drawPairs(out, out, rnd);
            if (!pair) return null;
            let { x, y, z } = pair;
            if (rnd() < 0.5) { x = open.thing; if (y === x) y = pick(out.filter(t => t !== x), rnd); if (z === x) z = pick(out.filter(t => t !== x), rnd); }
            else { z = open.thing; if (x === z) x = pick(out.filter(t => t !== z), rnd); if (y === x) y = pick(out.filter(t => t !== x), rnd); }
            const { h1, h2 } = hours(rnd, span);
            const on = [...new Set([open.axis, ...drawAxes(sp.world.axes, rnd).filter(i => i !== REACH).slice(0, rnd() < 0.5 ? 0 : 1)])].sort((a, b) => a - b);
            return { kind: "could", x, y, z, h1, h2, on, ...(sp.inner ? { s1: 0, s2: 0 } : {}), options: out.filter(w => w !== z) };
        },
        answer(q, rec) {
            const fit = new Set<number>();
            for (const world of rec.alternatives ?? [rec.world]) {
                const r = { ...rec, world };
                for (const m of matches(world, world.start.length, q.z, q.h2, q.on, firstRel(r, q), q.options!)) fit.add(m);
            }
            return [...fit].sort((a, b) => a - b);
        },
    },
    /* "At h1, X stands to Y as Z stands to a point P at h2: build where P is
       relative to W." The missing term found by moving Z as Y lies from X —
       low ends, on every dimension — and read off from a fourth thing, so all
       four places at both hours go into it. */
    build: {
        id: "build",
        answerMode: "construct",
        fits: things => things >= 3,
        draw(sp, things, _s, _t, rnd, span = ALL_DAY) {
            const sides = drawSpaces(sp, rnd), second = drawable(sp, things, sides.s2), pair = drawPairs(drawable(sp, things, sides.s1), second, rnd);
            if (!pair) return null;
            const { x, y, z } = pair, { h1, h2 } = hours(rnd, span);
            const w = pick(second.filter(t => t !== z), rnd);
            return { kind: "build", x, y, z, w, h1, h2, on: sp.world.axes.map((_, i) => i), ...sides };
        },
        answer(q, rec) {
            const a = spaceOf(rec, q.s1), b = spaceOf(rec, q.s2);
            const X = thingAt(a, q.x, q.h1), Y = thingAt(a, q.y, q.h1), Z = thingAt(b, q.z, q.h2), W = thingAt(b, q.w!, q.h2);
            return b.axes.map((ax, i) => {
                const d = Z.pos[i] - (X.pos[i] - Y.pos[i]) - W.pos[i];
                return ax.kind === "ring" ? mod(d, ax.modulus!) : ax.kind === "parity" ? mod(d, 2) : d;
            });
        },
    },
    /* "Speaker X is to Y as Z is to which speaker?" — same kind of speaker or not.
       Only worth asking where unmasking them needed the space, which the
       shortcut check enforces: a speaker settled by claims alone survives every
       shortcut and kills the item. */
    speakers: {
        id: "speakers",
        answerMode: "choice",
        fits: (_things, speakers) => speakers >= 3,
        draw(_spaces, _things, speakers, types, rnd) {
            const ids = Array.from({ length: speakers }, (_, i) => i);
            /* A third speaker of their own: "x is to y as x is to ?" only asks who is x's kind. */
            const x = pick(ids, rnd), y = pick(ids.filter(i => i !== x), rnd), z = pick(ids.filter(i => i !== x && i !== y), rnd);
            const pool = ids.filter(i => i !== z);
            const fit = pool.filter(w => (types[z] === types[w]) === (types[x] === types[y]));
            const miss = pool.filter(w => !fit.includes(w));
            if (!fit.length || !miss.length) return null;
            return { kind: "speakers", x, y, z, h1: 0, h2: 0, on: [], options: shuffle([pick(fit, rnd), pick(miss, rnd)], rnd) };
        },
        answer(q, rec) {
            const t = rec.types;
            const fit = q.options!.filter(w => (t[q.z] === t[w]) === (t[q.x] === t[q.y]));
            return fit.length === 1 ? fit[0] : null;
        },
    },
};
