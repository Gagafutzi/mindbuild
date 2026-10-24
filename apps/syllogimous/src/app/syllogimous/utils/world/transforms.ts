/**
 * Composed World — transformations of the whole space, on the hour.
 *
 * Every one acts about the Post, so none of them needs to know where anything
 * else is, and each has an exact inverse — the reader runs the clock backwards
 * through them. They move lengths and paces as well as places: a quarter turn
 * of the north–up plane makes a thing that was long north–south long up–down,
 * and turns its pace with it.
 *
 * Only line axes are transformed. A ring has no "about the Post" to mirror in a
 * way that keeps its seam where it was, and a kind has no direction at all.
 *
 * To add one: an entry here with `apply`, its inverse, `valid` for the axes it
 * can act on, and `describe`. Nothing else changes.
 */

import { Axis, Body } from "./space";

export interface TransformSpec {
    id: string;
    /** The axes acted on, by index. */
    axes: number[];
    /** Quarter turns (rotate: 1 or 3), factor (shear: ±1), steps (translate, jump). */
    k?: number;
    /** The one thing it happens to, for a kind that is `single`; everything otherwise. */
    who?: number;
}

export interface TransformKind {
    id: string;
    /** Apply to one body; `dir` -1 undoes it. Mutates. */
    apply(b: Body, t: TransformSpec, dir: 1 | -1): void;
    /** How many line axes it needs. */
    needs: number;
    /** Two-valued statements a knave can make about it: the opposite version, or null. */
    opposite?(t: TransformSpec): TransformSpec | null;
    /**
     * Happens to one thing, not to the space: it changes how that thing stands
     * to every other, the way an edit to a relation does, where a turn of the
     * whole space changes none of them.
     */
    single?: boolean;
}

/* A quarter turn about the Post in the plane (a, b): (x, y) -> (-y, x) for a
   box, so the new a-range is the old b-range negated and the new b-range the
   old a-range. Lengths swap; the pace turns the same way. */
function quarter(b: Body, a: number, c: number) {
    const x0 = b.pos[a], y0 = b.pos[c], sx = b.size[a], sy = b.size[c];
    b.pos[a] = -(y0 + sy - 1);
    b.pos[c] = x0;
    b.size[a] = sy; b.size[c] = sx;
    const vx = b.vel[a];
    b.vel[a] = -b.vel[c];
    b.vel[c] = vx;
}

export const TRANSFORMS: Record<string, TransformKind> = {
    rotate: {
        id: "rotate",
        needs: 2,
        apply(b, t, dir) {
            const turns = ((dir * (t.k ?? 1)) % 4 + 4) % 4;
            for (let i = 0; i < turns; i++) quarter(b, t.axes[0], t.axes[1]);
        },
        /* "Clockwise" said by a knave is the other way round: the one two-valued
           thing about a quarter turn. */
        opposite: t => ({ ...t, k: (t.k ?? 1) === 1 ? 3 : 1 }),
    },
    mirror: {
        id: "mirror",
        needs: 1,
        /* About the Post: [x0, x1] becomes [-x1, -x0]. Its own inverse. */
        apply(b, t) {
            const a = t.axes[0];
            b.pos[a] = -(b.pos[a] + b.size[a] - 1);
            b.vel[a] = -b.vel[a];
        },
    },
    swap: {
        id: "swap",
        needs: 2,
        /* Two axes exchanged: the mirror in the diagonal between them. Its own inverse. */
        apply(b, t) {
            const [a, c] = t.axes;
            for (const f of ["pos", "size", "vel"] as const) {
                const v = b[f][a]; b[f][a] = b[f][c]; b[f][c] = v;
            }
        },
    },
    shear: {
        id: "shear",
        needs: 2,
        /* Each thing slides k along the first axis for every step its low end
           stands from the Post along the second. Lengths and paces stay. */
        apply(b, t, dir) {
            const [a, c] = t.axes;
            b.pos[a] += dir * (t.k ?? 1) * b.pos[c];
        },
        opposite: t => ({ ...t, k: -(t.k ?? 1) }),
    },
    translate: {
        id: "translate",
        needs: 1,
        /* Everything shifts k along one axis — the Post excepted, which is what
           makes it a translation of the things and not a relabelling. */
        apply(b, t, dir) { b.pos[t.axes[0]] += dir * (t.k ?? 1); },
        opposite: t => ({ ...t, k: -(t.k ?? 1) }),
    },
    stretch: {
        id: "stretch",
        needs: 1,
        /* Distances from the Post along one axis double; lengths and paces stay. */
        apply(b, t, dir) {
            const a = t.axes[0];
            b.pos[a] = dir > 0 ? 2 * b.pos[a] : b.pos[a] / 2;
        },
    },
    jump: {
        id: "jump",
        needs: 1,
        single: true,
        /* One thing jumps k along a line; its length and pace go with it. */
        apply(b, t, dir) { b.pos[t.axes[0]] += dir * (t.k ?? 1); },
        opposite: t => ({ ...t, k: -(t.k ?? 1) }),
    },
    turn: {
        id: "turn",
        needs: 0,
        single: true,
        /* One thing turns back: every pace it has reversed, where it stands. Its own inverse. */
        apply(b) { b.vel = b.vel.map(v => -v); },
    },
};

/** Whether a transformation can act on these axes of this space. */
export function canTransform(t: TransformSpec, axes: Axis[]): boolean {
    const kind = TRANSFORMS[t.id];
    return !!kind && t.axes.length === kind.needs && new Set(t.axes).size === t.axes.length
        && t.axes.every(a => axes[a] && axes[a].kind === "line");
}
