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
import { IntervalRel, POST, intervalRel } from "./facts";
import { Reconstruction, World, thingAt } from "./reader";
import { mod } from "./space";

/** One axis's part of a relation. */
export type Part = IntervalRel | number | "same" | "opposite";

export function relation(axes: Axis[], a: Body, b: Body, on: number[]): Part[] {
    return on.map(i => {
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
    /** Things by index, the Post as POST. */
    x: number; y: number; z: number;
    /** For judge: the proposed counterpart. */
    w?: number;
    h1: number; h2: number;
    on: number[];
    /** Candidates offered (things or speakers), for choice and select. */
    options?: number[];
}

export interface QuestionKind {
    id: string;
    answerMode: "choice" | "boolean" | "select";
    /** Whether a card with this many things and speakers can ask it at all. */
    fits?(things: number, speakers: number): boolean;
    /** Parameters for an item on this world, or null if it offers none; hours within `span`. */
    draw(world: World, things: number, speakers: number, types: boolean[], rnd: () => number, span?: Span): Ask | null;
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
    return shuffle(axes.map((_, i) => i), rnd).slice(0, n).sort((a, b) => a - b);
}

/** Every thing (and the Post) standing to `z` at `h` as the relation says. */
function matches(world: World, things: number, z: number, h: number, on: number[], rel: Part[], among: number[]): number[] {
    const zb = thingAt(world, z, h);
    return among.filter(w => w !== z && sameRel(relation(world.axes, zb, thingAt(world, w, h), on), rel));
}

const everyone = (things: number) => [POST, ...Array.from({ length: things }, (_, i) => i)];

function drawPairs(things: number, rnd: () => number) {
    const all = everyone(things);
    const x = pick(all.filter(t => t !== POST), rnd);
    const y = pick(all.filter(t => t !== x), rnd);
    const z = pick(all.filter(t => t !== POST && t !== x), rnd);
    return { x, y, z };
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

export const QUESTIONS: Record<string, QuestionKind> = {
    /* "At h1, X is to Y as Z is to which of these at h2?" Two offered, one
       fits — and it is the only one anywhere, so the other is not ruled out by
       being the wrong one of several that would do. Two rather than every
       candidate, because a longer menu can be shortened by looking. */
    which: {
        id: "which",
        answerMode: "choice",
        draw(world, things, _s, _t, rnd, span = ALL_DAY) {
            const { x, y, z } = drawPairs(things, rnd), { h1, h2 } = hours(rnd, span), on = drawAxes(world.axes, rnd);
            const rel = relation(world.axes, thingAt(world, x, h1), thingAt(world, y, h1), on);
            const pool = everyone(things).filter(w => w !== z);
            const fit = matches(world, things, z, h2, on, rel, pool);
            if (fit.length !== 1) return null;
            const other = pick(pool.filter(w => w !== fit[0]), rnd);
            return { kind: "which", x, y, z, h1, h2, on, options: shuffle([fit[0], other], rnd) };
        },
        answer(q, rec) {
            const rel = relation(rec.world.axes, thingAt(rec.world, q.x, q.h1), thingAt(rec.world, q.y, q.h1), q.on);
            const m = matches(rec.world, rec.world.start.length, q.z, q.h2, q.on, rel, q.options!);
            return m.length === 1 ? m[0] : null;
        },
    },
    /* "At h1, X is to Y as Z is to W at h2": true or false, half each. */
    judge: {
        id: "judge",
        answerMode: "boolean",
        draw(world, things, _s, _t, rnd, span = ALL_DAY) {
            const { x, y, z } = drawPairs(things, rnd), { h1, h2 } = hours(rnd, span), on = drawAxes(world.axes, rnd);
            const w = pick(everyone(things).filter(t => t !== z), rnd);
            return { kind: "judge", x, y, z, w, h1, h2, on };
        },
        answer(q, rec) {
            const rel = relation(rec.world.axes, thingAt(rec.world, q.x, q.h1), thingAt(rec.world, q.y, q.h1), q.on);
            return sameRel(relation(rec.world.axes, thingAt(rec.world, q.z, q.h2), thingAt(rec.world, q.w!, q.h2), q.on), rel);
        },
    },
    /* "At h1, X is to Y as Z is to which of these at h2?" Every one that fits, or none. */
    every: {
        id: "every",
        answerMode: "select",
        /* Three to choose among at least: two would be a choice with a submit button. */
        fits: things => things >= 3,
        draw(world, things, _s, _t, rnd, span = ALL_DAY) {
            const { x, y, z } = drawPairs(things, rnd), { h1, h2 } = hours(rnd, span), on = drawAxes(world.axes, rnd).slice(0, 2);
            return { kind: "every", x, y, z, h1, h2, on, options: everyone(things).filter(w => w !== z) };
        },
        answer(q, rec) {
            const rel = relation(rec.world.axes, thingAt(rec.world, q.x, q.h1), thingAt(rec.world, q.y, q.h1), q.on);
            return matches(rec.world, rec.world.start.length, q.z, q.h2, q.on, rel, q.options!).sort((a, b) => a - b);
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
        draw(_world, _things, speakers, types, rnd) {
            const ids = Array.from({ length: speakers }, (_, i) => i);
            const x = pick(ids, rnd), y = pick(ids.filter(i => i !== x), rnd), z = pick(ids, rnd);
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
