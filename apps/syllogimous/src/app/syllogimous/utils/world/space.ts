/**
 * Composed World — the space: axes, the topology of their seams, bodies, and
 * the clock.
 *
 * ── Why a separate engine ──
 *
 * The composed spaces (`ndspace.utils.ts`) treat an object as a point with one
 * position, and every coupling rung there rewrites the premises in a way the
 * others cannot share, so an item carries one of them at most. This engine is
 * built so that everything composes in every item: objects with a length on
 * each axis, moving on a clock, through seams that wrap, twist or lead onto
 * another axis, while the whole space is turned, mirrored or sheared at stated
 * hours. Each of those is a registry entry rather than a branch, so a new seam,
 * a new transformation or a new kind of statement is one entry and not a thread
 * through a generator.
 *
 * ── The frame ──
 *
 * A body's place on an axis is its low end — the west, south, lower, earlier,
 * narrower, smaller end — and it runs on from there for its length. Nothing
 * else needs an absolute frame except the seams and the transformations, and
 * both are pinned to one landmark, the Post: it stands at 0 on every axis, never
 * moves and is a point. The ring's seam lies between its last column and the
 * Post's, a twist mirrors about the Post's line, and every transformation turns
 * or mirrors about the Post. So "where" is always answerable, and every step of
 * the clock can be run backwards exactly, which is what the reader needs.
 *
 * Pure: no Angular, no settings.
 */

import { LinearScale } from "../linear.utils";

/* ------------------------------------------------------------------ *
 * Axes and seams                                                      *
 * ------------------------------------------------------------------ */

export type AxisKind = "line" | "ring" | "parity";

/**
 * What crossing a ring's seam does, besides wrapping.
 *
 *   plain    nothing: a cylinder's seam
 *   twist    mirrors `target` about the Post's line, and the pace along it:
 *            a Möbius band's seam
 *   portal   carries the crossing body `shift` along `target`, back again when
 *            crossed the other way: the ring leads into another axis
 */
export type Seam =
    | { type: "plain" }
    | { type: "twist"; target: number }
    | { type: "portal"; target: number; shift: number };

export interface Axis {
    scale: LinearScale;
    kind: AxisKind;
    /** Ring size; ring axes only. */
    modulus?: number;
    /** Ring axes only. */
    seam?: Seam;
}

/* ------------------------------------------------------------------ *
 * Bodies                                                              *
 * ------------------------------------------------------------------ */

/** One thing at one moment: low ends, lengths and paces, one entry per axis. */
export interface Body {
    pos: number[];
    size: number[];
    vel: number[];
}

export const copyBody = (b: Body): Body => ({ pos: [...b.pos], size: [...b.size], vel: [...b.vel] });
export const sameBody = (a: Body, b: Body) =>
    a.pos.every((v, i) => v === b.pos[i]) && a.size.every((v, i) => v === b.size[i]) && a.vel.every((v, i) => v === b.vel[i]);

export const mod = (n: number, m: number) => ((n % m) + m) % m;

/* ------------------------------------------------------------------ *
 * How a reading takes the world                                       *
 * ------------------------------------------------------------------ */

/**
 * What a reading of the card honours. The full reading honours all of it; each
 * shortcut a reader might take drops one, and an item is kept only if every
 * shortcut gets its answer wrong — which is what "the question needs the whole
 * structure" means, checked rather than hoped.
 */
export interface Reading {
    /** Speakers' types worked out; off means every statement taken at its word. */
    liars: boolean;
    /** Paces honoured; off means nothing moves. */
    motion: boolean;
    /** Seams honoured; off means every ring wraps plainly. */
    seams: boolean;
    /** Lengths honoured; off means everything is a point. */
    sizes: boolean;
    /** Transformations honoured; off means they never happened. */
    events: boolean;
    /** Headings honoured; off means "ahead" and "left" are read as north and west whoever says them. */
    perspective: boolean;
}

export const FULL: Reading = { liars: true, motion: true, seams: true, sizes: true, events: true, perspective: true };

/** The shortcut readings, each with one part of the structure left out. */
export const SHORTCUTS: Record<string, Reading> = {
    liars: { ...FULL, liars: false },
    motion: { ...FULL, motion: false },
    seams: { ...FULL, seams: false },
    sizes: { ...FULL, sizes: false },
    events: { ...FULL, events: false },
    perspective: { ...FULL, perspective: false },
};

/* ------------------------------------------------------------------ *
 * The seam registry                                                   *
 * ------------------------------------------------------------------ */

export interface SeamKind {
    /** Apply a crossing in direction `dir` (+1 forwards past the seam, -1 back) to `b`. */
    cross(b: Body, axes: Axis[], seam: Seam, dir: 1 | -1): void;
}

export const SEAMS: Record<Seam["type"], SeamKind> = {
    plain: { cross: () => undefined },
    twist: {
        /* Mirrored about the Post's line: [p, p+s-1] becomes [-(p+s-1), -p]. Its own inverse. */
        cross(b, _axes, seam) {
            const t = (seam as { target: number }).target;
            b.pos[t] = -b.pos[t] - b.size[t] + 1;
            b.vel[t] = -b.vel[t];
        },
    },
    portal: {
        cross(b, _axes, seam, dir) {
            const s = seam as { target: number; shift: number };
            b.pos[s.target] += dir * s.shift;
        },
    },
};

/* ------------------------------------------------------------------ *
 * Motion                                                              *
 * ------------------------------------------------------------------ */

/**
 * One unit step along axis `a` in direction `d`.
 *
 * A ring wraps, and a body that wraps forwards past the last column crosses
 * the seam forwards; wrapping back past column 0 crosses it back.
 */
function unitStep(b: Body, axes: Axis[], a: number, d: number, reading: Reading) {
    const axis = axes[a];
    if (axis.kind === "parity") return;
    if (axis.kind === "line") { b.pos[a] += d; return; }
    const m = axis.modulus!, next = b.pos[a] + d;
    b.pos[a] = mod(next, m);
    if ((next >= m || next < 0) && reading.seams && axis.seam) SEAMS[axis.seam.type].cross(b, axes, axis.seam, next >= m ? 1 : -1);
}

/**
 * One hour of motion, forwards (`dir` 1) or backwards (`dir` -1).
 *
 * Axis by axis, a unit at a time, in axis order forwards and the reverse order
 * backwards: the undoing of a sequence of steps is the reverse sequence of
 * their undoings. Today's seams happen not to need it — a twist's mirror and a
 * portal's shift commute with a step along their target, so either order undoes
 * the hour (mutation-tested: dropping the reversal passes) — but a seam onto
 * another ring, whose crossing would itself depend on where that ring had got
 * to, would not commute, and the reader runs every hour backwards.
 */
export function moveHour(b: Body, axes: Axis[], dir: 1 | -1, reading: Reading) {
    if (!reading.motion) return;
    const order = axes.map((_, i) => i);
    if (dir < 0) order.reverse();
    for (const a of order) {
        const v = b.vel[a];
        if (v === 0) continue;
        for (let k = 0; k < Math.abs(v); k++) unitStep(b, axes, a, dir * Math.sign(v), reading);
    }
}
