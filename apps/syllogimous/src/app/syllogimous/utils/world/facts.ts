/**
 * Composed World — what can be said, and how it is read.
 *
 * Every premise is a statement by a speaker, who is a knight or a knave. A
 * statement carries one fact. Each kind of fact is a registry entry that says
 * how it is worded, whether it holds of a world, and what a knave saying it
 * actually tells you:
 *
 *   place   where one thing is relative to another (or the origin) at an hour,
 *           on every axis at once. Exact, so only a knight is given one: "not
 *           2 east" leaves too much open to be worth a premise.
 *   pace    how something moves every hour. Exact, knights only, for the same
 *           reason.
 *   size    one length of one thing, 1 (a point) to 3. A knave's version
 *           rules one length out and leaves the other two.
 *   sizes   several of one thing's lengths in one sentence; knights only, since
 *           a false list leaves too much open.
 *   cmp     whether one thing is longer, shorter or as long as another along a
 *           line, at an hour — a turn or a swap can change which.
 *   event   a transformation of the whole space at an hour. A turn has a
 *           direction, a shear and a shift a sign, and a knave's version of one
 *           of those is the other way round; the rest are knights' alone.
 *   rel     how two things' stretches lie along one axis at an hour: wholly to
 *           one side, overlapping, one within the other, identical. Where the
 *           lengths show, and checkable against what the trusted speakers
 *           establish, which is how a speaker nobody vouches for is unmasked.
 *   type    what a speaker says about speakers: the classic puzzle, which
 *           settles some of them before the space is touched.
 */

import { Claim, describeClaim, holds as claimHolds } from "../knaves.utils";
import { hi, own, subj } from "../phrasing";
import { Axis, Body, Frames, mod, reckon } from "./space";
import { TRANSFORMS, TransformSpec, canonicalT } from "./transforms";

/** Index of the Post among things a fact can name. */
export const POST = -1;

export type IntervalRel = "before" | "after" | "overlaps" | "within" | "spans" | "identical";

export type Fact =
    /* `round`: every ring said the other way round, "1 step anticlockwise" for 4 clockwise on a ring of five. */
    | { kind: "place"; hour: number; x: number; y: number; delta: number[]; bridge?: [number, number]; local?: boolean; round?: boolean }
    /* `every`: the same pace said over that many hours, "every 2 hours, … 2 north". */
    | { kind: "pace"; x: number; vel: number[]; every?: number }
    /* Two paces alike (1) or exactly opposite (-1). */
    | { kind: "pacelike"; x: number; y: number; sign: 1 | -1 }
    | { kind: "size"; x: number; axis: number; len: number }
    | { kind: "sizes"; x: number; lens: Array<[number, number]> }
    | { kind: "cmp"; hour: number; x: number; y: number; axis: number; cmp: Cmp }
    | { kind: "stands"; who: number; host: number; facing?: number; twin?: boolean; upside?: boolean }
    | { kind: "view"; hour: number; who: number; x: number; seen: Seen }
    | { kind: "not"; f: Fact }
    | { kind: "analog"; h1: number; h2: number; x: number; y: number; z: number; w: number; on: number[] }
    | { kind: "total"; hour: number; x: number; y: number; steps: number }
    | { kind: "ranked"; hour: number; by: number[]; order: number[] }
    | { kind: "signal"; hour: number; x: number; y: number; mode: "at" | "after" }
    | { kind: "level"; x: number; y: number; axis: number; hour: number }
    | { kind: "meet"; x: number; y: number; hour: number }
    | { kind: "event"; hour: number; t: TransformSpec }
    | { kind: "rel"; hour: number; x: number; y: number; axis: number; rel: IntervalRel }
    | { kind: "type"; claim: Claim };

/**
 * A fact, said by a speaker, about one of the card's two spaces: the one
 * outside the brackets (0, or absent) or the one inside them (1). The same
 * things are in both, arranged, sized and moving apart; the speakers and what
 * they are are the same in both, so a knave lies inside the brackets too.
 */
export interface Statement { speaker: number; fact: Fact; space?: number }

/** How long a thing can be along a line: 1, a point, up to this. */
export const MAX_LEN = 3;

/** How two lengths along one line compare. */
export type Cmp = "longer" | "shorter" | "same";
export const compareLengths = (a: number, b: number): Cmp => (a > b ? "longer" : a < b ? "shorter" : "same");

/* ------------------------------------------------------------------ *
 * Relations between bodies                                            *
 * ------------------------------------------------------------------ */

/** How `a`'s stretch lies against `b`'s on line axis `i`. */
export function intervalRel(a: Body, b: Body, i: number): IntervalRel {
    const a0 = a.pos[i], a1 = a.pos[i] + a.size[i] - 1, b0 = b.pos[i], b1 = b.pos[i] + b.size[i] - 1;
    if (a1 < b0) return "before";
    if (a0 > b1) return "after";
    if (a0 === b0 && a1 === b1) return "identical";
    if (a0 >= b0 && a1 <= b1) return "within";
    if (a0 <= b0 && a1 >= b1) return "spans";
    return "overlaps";
}

/** `x` relative to `y` on every axis: low ends' gap on a line, steps round a ring, kind. */
export function displacement(axes: Axis[], x: Body, y: Body): number[] {
    return axes.map((ax, i) => ax.kind === "ring" ? mod(x.pos[i] - y.pos[i], ax.modulus!)
        : ax.kind === "parity" ? mod(x.pos[i] - y.pos[i], 2)
        : x.pos[i] - y.pos[i]);
}

/* ------------------------------------------------------------------ *
 * Truth and negation                                                  *
 * ------------------------------------------------------------------ */

/** What a fact needs to be judged: bodies at an hour, and the speakers' types. */
/**
 * Where a speaker is: standing in a thing, at its low end, carried with it,
 * and facing one of four ways — 0 north, 1 east, 2 south, 3 west — with up
 * staying up. Speakers are not things, and the space's turns do not turn them.
 */
export interface Observer {
    host: number;
    facing: number;
    /** A mirror twin: left and right swapped, ahead and behind not. */
    twin?: boolean;
    /** Hanging head down: left and right swapped, and above and below. */
    upside?: boolean;
}

/** The parts of a frame a facing does not settle. */
export interface Frame { facing: number; twin?: boolean; upside?: boolean }

/**
 * A thing as a speaker sees it: on each dimension, how far its nearest edge is
 * from where they stand — 0 where they stand within its stretch. Ahead and
 * left are the speaker's, taken on north–south and round east–west; every
 * other dimension is the space's own.
 */
export interface Seen { ahead: number; left: number; rest: number[] }

/** The two dimensions a heading turns: east–west (a ring) and north–south. */
export const PLANE: [number, number] = [0, 1];
export const FACINGS = ["north", "east", "south", "west"];

/** How far `t`'s nearest edge is from point `p` along a line: 0 inside it. */
const edgeFrom = (p: number, lo: number, len: number) => (p < lo ? lo - p : p > lo + len - 1 ? lo + len - 1 - p : 0);

/** What a speaker standing at `from`'s low end, in frame `frame`, sees of `t`. */
export function seenFrom(axes: Axis[], from: Body, t: Body, frame: Frame | number): Seen {
    const { facing, twin, upside } = typeof frame === "number" ? { facing: frame } as Frame : frame;
    const rest = axes.map((ax, i) => {
        if (ax.kind === "ring") {
            /* Round the heading's ring the shorter way, so ahead and behind are
               both sayable and a ring of five has no tie; round any other ring,
               counted the ring's own way, as every place on it is. */
            const d = mod(t.pos[i] - from.pos[i], ax.modulus!);
            return PLANE.includes(i) && d > ax.modulus! / 2 ? d - ax.modulus! : d;
        }
        if (ax.kind === "parity") return mod(t.pos[i] - from.pos[i], 2);
        return edgeFrom(from.pos[i], t.pos[i], t.size[i]);
    });
    const [e, n] = [rest[PLANE[0]], rest[PLANE[1]]];
    const [ahead, left] = facing === 0 ? [n, -e] : facing === 1 ? [e, n] : facing === 2 ? [-n, e] : [-e, -n];
    /* Head down turns left to right and above to below; a mirror twin turns
       left to right again, so a twin hanging head down has them back. */
    const flipLeft = !!twin !== !!upside;
    return {
        ahead, left: flipLeft ? -left : left,
        rest: rest.map((v, i) => (PLANE.includes(i) ? 0 : upside && i === UP ? -v : v)),
    };
}

/** The up–down axis, which a head-down speaker reads the other way. */
export const UP = 2;

/** The time dimension, which local clocks and rings of sound are reckoned on. */
export const TIME = 3;
const EAST = 0;

/**
 * A place's time gap as local clocks read it: one step later per step
 * clockwise from the origin round east–west, so a thing further round reads
 * later than the same moment does at the origin.
 */
export function localTime(axes: Axis[], delta: number[], x: Body, y: Body): number {
    const d = delta[TIME] + (mod(x.pos[EAST], axes[EAST].modulus!) - mod(y.pos[EAST], axes[EAST].modulus!));
    return axes[TIME].kind === "ring" ? mod(d, axes[TIME].modulus!) : d;
}

/** Steps through space between two low ends, the way a ring of sound spreads: round east–west, along north–south and up–down. */
export function spaceSteps(axes: Axis[], a: Body, b: Body): number {
    return [0, 1, 2].reduce((n, i) => {
        const d = a.pos[i] - b.pos[i];
        if (axes[i].kind === "ring") { const m = mod(d, axes[i].modulus!); return n + Math.min(m, axes[i].modulus! - m); }
        return n + Math.abs(d);
    }, 0);
}

/** The first hour, 0 to `last`, two low ends are level along a line; null if never. */
export function firstLevel(at: (k: number, h: number) => Body | null, x: number, y: number, axis: number, last: number): number | null | undefined {
    for (let h = 0; h <= last; h++) {
        const a = at(x, h), b = at(y, h);
        if (!a || !b) return undefined;
        if (a.pos[axis] === b.pos[axis]) return h;
    }
    return null;
}

/**
 * Whether two things share ground: the same place round east–west, and
 * stretches that overlap along north–south and up–down. Lengths are what make
 * a meeting — two points meet only where their low ends do.
 */
export function together(axes: Axis[], a: Body, b: Body): boolean {
    return [0, 1, 2].every(i => i >= axes.length
        || (axes[i].kind === "ring" ? mod(a.pos[i] - b.pos[i], axes[i].modulus!) === 0 : !["before", "after"].includes(intervalRel(a, b, i))));
}

/** The first hour, 0 to `last`, two things share ground; null if never. */
export function firstMeet(axes: Axis[], at: (k: number, h: number) => Body | null, x: number, y: number, last: number): number | null | undefined {
    for (let h = 0; h <= last; h++) {
        const a = at(x, h), b = at(y, h);
        if (!a || !b) return undefined;
        if (together(axes, a, b)) return h;
    }
    return null;
}

/** Low ends' gaps added up over every line and the shorter way round every ring: steps in all. */
export function stepsBetween(axes: Axis[], a: Body, b: Body): number {
    return axes.reduce((n, ax, i) => {
        if (ax.kind === "parity") return n;
        const d = a.pos[i] - b.pos[i];
        if (ax.kind === "ring") { const m = mod(d, ax.modulus!); return n + Math.min(m, ax.modulus! - m); }
        return n + Math.abs(d);
    }, 0);
}

/** Things in order by their low ends on `by[0]`, ties by `by[1]`; null if two tie on both. */
export function rankBy(axes: Axis[], bodies: Body[], ids: number[], by: number[]): number[] | null {
    const key = (k: number) => by.map(a => (axes[a].kind === "ring" ? mod(bodies[k].pos[a], axes[a].modulus!) : bodies[k].pos[a]));
    const sorted = [...ids].sort((p, q) => { const a = key(p), b = key(q); return a[0] - b[0] || a[1] - b[1]; });
    for (let i = 1; i < sorted.length; i++) if (key(sorted[i]).every((v, j) => v === key(sorted[i - 1])[j])) return null;
    return sorted;
}
const sameSeen = (a: Seen, b: Seen) => a.ahead === b.ahead && a.left === b.left && a.rest.every((v, i) => v === b.rest[i]);

export interface View {
    axes: Axis[];
    /** Where a speaker stands, and every way they may be facing; null where unknown. */
    observer(who: number): { host: number; facings: number[]; twin?: boolean; upside?: boolean } | null;
    /** A thing's body at an hour, or null where the view cannot say. */
    at(x: number, hour: number): Body | null;
    /** Hour-0 body, for the facts that are about a thing rather than a moment. */
    start(x: number): Body | null;
    /** Whether the events are known up to and including this hour. */
    eventsKnownThrough(hour: number): boolean;
    events(): Array<{ hour: number; t: TransformSpec }> | null;
    types: Array<boolean | undefined>;
    /** How the other kind reckons, on a card that has kinds and a reading that honours them. */
    frames?: Frames;
}

/** Whether a body is of the other kind from the origin, on a space with kinds. */
export const otherKind = (axes: Axis[], b: Body) => {
    const k = axes.findIndex(a => a.kind === "parity");
    return k >= 0 && mod(b.pos[k], 2) === 1;
};

const sameVec = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i]);
const sameT = (a: TransformSpec, b: TransformSpec) => canonicalT(a) === canonicalT(b);

/** Whether `f` holds in the view, or null when the view does not settle it. */
export function holds(f: Fact, v: View): boolean | null {
    switch (f.kind) {
        case "place": {
            const x = v.at(f.x, f.hour), y = v.at(f.y, f.hour);
            if (!x || !y) return null;
            let d = displacement(v.axes, x, y);
            if (f.local) d[TIME] = localTime(v.axes, d, x, y);
            if (v.frames && otherKind(v.axes, y)) d = reckon(v.frames, d);
            return sameVec(d, f.delta);
        }
        case "signal": {
            const x = v.at(f.x, f.hour), y = v.at(f.y, f.hour);
            if (!x || !y) return null;
            const late = x.pos[TIME] - y.pos[TIME], far = spaceSteps(v.axes, x, y);
            return f.mode === "at" ? late === far : late > far;
        }
        case "level": {
            const h = firstLevel(v.at, f.x, f.y, f.axis, f.hour);
            return h === undefined ? null : h === f.hour;
        }
        case "meet": {
            const h = firstMeet(v.axes, v.at, f.x, f.y, f.hour);
            return h === undefined ? null : h === f.hour;
        }
        case "pace": { const s = v.start(f.x); return s ? sameVec(s.vel, f.vel) : null; }
        case "pacelike": {
            const a = v.start(f.x), b = v.start(f.y);
            return a && b ? sameVec(a.vel, b.vel.map(u => f.sign * u)) : null;
        }
        case "size": { const s = v.start(f.x); return s ? s.size[f.axis] === f.len : null; }
        case "sizes": { const s = v.start(f.x); return s ? f.lens.every(([a, l]) => s.size[a] === l) : null; }
        case "cmp": {
            const x = v.at(f.x, f.hour), y = v.at(f.y, f.hour);
            return x && y ? compareLengths(x.size[f.axis], y.size[f.axis]) === f.cmp : null;
        }
        case "stands": {
            const o = v.observer(f.who);
            if (!o) return null;
            if (o.host !== f.host) return false;
            if (f.facing === undefined) return true;
            const hs = o.facings.map(g => g === f.facing);
            return hs.every(h => h === hs[0]) ? hs[0] : null;
        }
        case "view": {
            const o = v.observer(f.who);
            const from = o ? v.at(o.host, f.hour) : null, t = v.at(f.x, f.hour);
            if (!o || !from || !t) return null;
            const hs = o.facings.map(g => sameSeen(seenFrom(v.axes, from, t, { facing: g, twin: o.twin, upside: o.upside }), f.seen));
            return hs.length && hs.every(h => h === hs[0]) ? hs[0] : null;
        }
        case "not": { const h = holds(f.f, v); return h === null ? null : !h; }
        case "analog": {
            const b = (k: number, h: number) => v.at(k, h);
            const [x, y, z, w] = [b(f.x, f.h1), b(f.y, f.h1), b(f.z, f.h2), b(f.w, f.h2)];
            if (!x || !y || !z || !w) return null;
            const part = (p: Body, q: Body, i: number) => {
                const ax = v.axes[i];
                return ax.kind === "ring" ? String(mod(p.pos[i] - q.pos[i], ax.modulus!)) : ax.kind === "parity" ? String(mod(p.pos[i] - q.pos[i], 2)) : intervalRel(p, q, i);
            };
            return f.on.every(i => part(x, y, i) === part(z, w, i));
        }
        case "total": {
            const x = v.at(f.x, f.hour), y = v.at(f.y, f.hour);
            return x && y ? stepsBetween(v.axes, x, y) === f.steps : null;
        }
        case "ranked": {
            const bodies = f.order.map(k => v.at(k, f.hour));
            if (bodies.some(b => !b)) return null;
            const all: Body[] = []; f.order.forEach((k, i) => (all[k] = bodies[i]!));
            const order = rankBy(v.axes, all, [...f.order].sort((a, b) => a - b), f.by);
            return order ? order.join() === f.order.join() : false;
        }
        case "rel": {
            const x = v.at(f.x, f.hour), y = v.at(f.y, f.hour);
            return x && y ? intervalRel(x, y, f.axis) === f.rel : null;
        }
        case "event": {
            const ev = v.events();
            return ev ? ev.some(e => e.hour === f.hour && sameT(e.t, f.t)) : null;
        }
        case "type": {
            if (v.types.some(t => t === undefined)) return null;
            return claimHolds(f.claim, v.types as boolean[]);
        }
    }
}

/**
 * What a knave saying `f` tells you: the fact that is true instead, where
 * there is exactly one, or null where a false statement leaves several open.
 */
export function negate(f: Fact): Fact | null {
    switch (f.kind) {
        case "event": {
            const opp = TRANSFORMS[f.t.id]?.opposite?.(f.t);
            return opp ? { ...f, t: opp } : null;
        }
        default: return null;
    }
}

/* ------------------------------------------------------------------ *
 * Wording                                                             *
 * ------------------------------------------------------------------ */

export interface Wording {
    axes: Axis[];
    colors: string[];
    things: string[];
    speakers: string[];
    /** Places leave out every dimension they are level on. */
    compact?: boolean;
    /** Once the knaves are gone every word is true, so nobody need be named
       as saying it: "Ash sees Bee: …" for "Ash: I see Bee: …". */
    unvoiced?: boolean;
    /** Unvoiced, where each speaker stands: a view is then told from the thing
       and the way it faces — "from Driver, facing west: Twine is …" — and the
       line saying where they stand goes. */
    vantage?: (who: number) => Extract<Fact, { kind: "stands" }> | undefined;
}

/**
 * A place's clauses: one per dimension, or, compact, only those it is not
 * level on; and where the fact bridges two lines, the second as "as many
 * above as north" — the gap on one given by the other's.
 */
export function placeClauses(w: Wording, f: Extract<Fact, { kind: "place" }>): string {
    const parts = f.delta.map((d, i) => {
        if (f.bridge && f.bridge[1] === i) {
            const [a] = f.bridge, sa = w.axes[a].scale, sb = w.axes[i].scale;
            return hi(`as many ${sb.direction[d > 0 ? 0 : 1]} as ${sa.direction[f.delta[a] > 0 ? 0 : 1]}`, w.colors[i]);
        }
        if (f.local && i === TIME) return `${clause(w, i, d, f.round)} ${hi("by local clocks", w.colors[i])}`;
        return w.compact && d === 0 ? "" : clause(w, i, d, f.round);
    }).filter(Boolean);
    return parts.length ? parts.join(", ") : "level everywhere";
}

/** Where places are measured from: a point, not a thing, and named as one. */
export const POST_NAME = "the origin";
/* "at 7", not "at 7 o'clock": every hour on a card is one of the day's. */
export const clock = (h: number) => `${h}`;

/* Round a ring, the steps go without saying, and so does "in the cycle". */
export const ringWay = (a: Axis, back: boolean) => a.scale.cyclic!.direction[back ? 1 : 0].replace(/ in the cycle$/, "");

const nameOf = (w: Wording, x: number) => x === POST ? POST_NAME : subj(w.things[x]);
const axisName = (a: Axis) => a.scale.name.toLowerCase().replace("-", "–");

/** One axis of a displacement, in that axis's colour. */
export function clause(w: Wording, i: number, d: number, round = false): string {
    const ax = w.axes[i], s = ax.scale;
    let text: string;
    /* The other way round a ring, where asked: as far as is left of the ring. */
    const back = round && ax.kind === "ring" && d !== 0, n = back ? ax.modulus! - d : d;
    if (ax.kind === "parity") text = d % 2 === 0 ? s.parity!.same : s.parity!.opposite;
    else if (ax.kind === "ring") text = d === 0 ? s.tie : `${n} ${ringWay(ax, back)}`;
    else text = d === 0 ? s.tie : `${Math.abs(d)} ${s.direction[d > 0 ? 0 : 1]}`;
    return hi(text, w.colors[i]);
}

function paceWords(w: Wording, vel: number[]): string {
    const parts = vel.map((v, i) => {
        if (v === 0) return null;
        const ax = w.axes[i];
        const n = Math.abs(v);
        if (ax.kind === "ring") return hi(`${n} ${ringWay(ax, v < 0)}`, w.colors[i]);
        return hi(`${Math.abs(v)} ${ax.scale.direction[v > 0 ? 0 : 1]}`, w.colors[i]);
    }).filter(Boolean);
    return parts.join(", ");
}

/** "north of", "above", "wider than": a direction with the scale's own connector. */
export const towards = (a: Axis, side: 0 | 1) => [a.scale.direction[side], a.scale.link].filter(Boolean).join(" ");

const REL_WORDS: Record<IntervalRel, (w: Wording, i: number) => string> = {
    before: (w, i) => `is wholly ${towards(w.axes[i], 1)}`,
    after: (w, i) => `is wholly ${towards(w.axes[i], 0)}`,
    overlaps: () => "overlaps",
    within: () => "is within",
    spans: () => "spans",
    identical: () => "matches",
};

/** The wording of a transformation, for an event statement. */
export function describeTransform(w: Wording, t: TransformSpec): string {
    const ax = (i: number) => w.axes[i].scale;
    const col = (i: number, s: string) => hi(s, w.colors[i]);
    const k = t.k ?? 1;
    switch (t.id) {
        case "rotate": {
            const [a, b] = t.axes;
            const to = k === 1 ? ax(b).direction[0] : ax(b).direction[1];
            return `all turns a quarter, ${col(a, ax(a).direction[0])} round to ${col(b, to)}`;
        }
        case "mirror":
            return `all is ${own("cs-mirror")} ${col(t.axes[0], axisName(w.axes[t.axes[0]]))}`;
        case "swap":
            return `${col(t.axes[0], axisName(w.axes[t.axes[0]]))} and ${col(t.axes[1], axisName(w.axes[t.axes[1]]))} swap,`
                + ` ${col(t.axes[0], ax(t.axes[0]).direction[0])} becomes ${col(t.axes[1], ax(t.axes[1]).direction[0])}`;
        case "shear": {
            const [a, b] = t.axes;
            return `all slides 1 ${col(a, ax(a).direction[k > 0 ? 0 : 1])} per step ${col(b, ax(b).direction[0])}`
                + `, 1 ${col(a, ax(a).direction[k > 0 ? 1 : 0])} per step ${col(b, ax(b).direction[1])}`;
        }
        case "translate":
            return `all shifts ${Math.abs(k)} ${col(t.axes[0], ax(t.axes[0]).direction[k > 0 ? 0 : 1])}`;
        case "stretch":
            return `${col(t.axes[0], axisName(w.axes[t.axes[0]]))} distances double`;
        case "jump":
            return `${nameOf(w, t.who!)} jumps ${Math.abs(k)} ${col(t.axes[0], ax(t.axes[0]).direction[k > 0 ? 0 : 1])}`;
        case "turn":
            return `${nameOf(w, t.who!)} turns back`;
    }
    return t.id;
}

/** What the fact says, without the speaker. */
export function describeFact(w: Wording, f: Fact): string {
    switch (f.kind) {
        case "place":
            return `at ${clock(f.hour)}, ${nameOf(w, f.x)} is ${placeClauses(w, f)} from ${nameOf(w, f.y)}`;
        case "pace": {
            const k = f.every ?? 1, p = paceWords(w, f.vel.map(v => k * v));
            return p ? `${nameOf(w, f.x)} moves ${p} ${k === 1 ? "hourly" : `every ${k} hours`}` : `${nameOf(w, f.x)} never moves`;
        }
        case "pacelike":
            return f.sign === 1 ? `${nameOf(w, f.x)} moves as ${nameOf(w, f.y)} does` : `${nameOf(w, f.x)} moves opposite to ${nameOf(w, f.y)}`;
        case "size":
            return `${nameOf(w, f.x)} is ${lengthWords(f.len)} in ${hi(axisName(w.axes[f.axis]), w.colors[f.axis])}`;
        case "sizes": {
            /* Several lines in one sentence, longest first and equal lengths
               together: "3 long along north–south and time, and a point along
               up–down". */
            const and = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}` : xs[0]);
            const lens = [...new Set(f.lens.map(([, l]) => l))].sort((p, q) => q - p);
            const parts = lens.map((l, i) => {
                const on = and(f.lens.filter(([, m]) => m === l).map(([a]) => hi(axisName(w.axes[a]), w.colors[a])));
                return `${i === 0 ? lengthWords(l) : l === 1 ? "a point" : String(l)} in ${on}`;
            });
            return `${nameOf(w, f.x)} is ${parts.join(", ")}`;
        }
        case "cmp": {
            const words = { longer: "is longer than", shorter: "is shorter than", same: "is as long as" }[f.cmp];
            return `at ${clock(f.hour)}, ${nameOf(w, f.x)} ${words} ${nameOf(w, f.y)} in ${hi(axisName(w.axes[f.axis]), w.colors[f.axis])}`;
        }
        case "rel": {
            /* "Wholly north of" names its axis already; the others need telling which. */
            const along = f.rel === "before" || f.rel === "after" ? "" : ` in ${hi(axisName(w.axes[f.axis]), w.colors[f.axis])}`;
            return `at ${clock(f.hour)}, ${nameOf(w, f.x)} ${REL_WORDS[f.rel](w, f.axis)} ${nameOf(w, f.y)}${along}`;
        }
        case "event":
            return `at ${clock(f.hour)}, ${describeTransform(w, f.t)}`;
        case "type":
            return describeClaim(f.claim, w.speakers);
        case "stands":
            return `${subj(w.speakers[f.who])} is in ${nameOf(w, f.host)}${standsTail(f)}`;
        case "not":
            return negatedWords(w, f.f);
        case "analog":
            return `at ${clock(f.h1)}, ${nameOf(w, f.x)} stands to ${nameOf(w, f.y)} on ${f.on.map(i => hi(axisName(w.axes[i]), w.colors[i])).join(", ")}`
                + ` as ${nameOf(w, f.z)} stands to ${nameOf(w, f.w)} at ${clock(f.h2)}`;
        case "total":
            return `at ${clock(f.hour)}, ${nameOf(w, f.x)} and ${nameOf(w, f.y)} are ${f.steps} ${f.steps === 1 ? "step" : "steps"} apart`;
        case "signal":
            return `at ${clock(f.hour)}, a ring from ${nameOf(w, f.y)} ${f.mode === "at" ? "just reaches" : "has passed"} ${nameOf(w, f.x)}`;
        case "level":
            return `${nameOf(w, f.x)} first levels with ${nameOf(w, f.y)} in ${hi(axisName(w.axes[f.axis]), w.colors[f.axis])} at ${clock(f.hour)}`;
        case "meet":
            return `${nameOf(w, f.x)} and ${nameOf(w, f.y)} first meet at ${clock(f.hour)}`;
        case "ranked": {
            const [a, b] = f.by.map(i => w.axes[i]);
            const run = (ax: Axis, i: number) => ax.kind === "ring"
                ? `fewest to most ${hi(ringWay(ax, false), w.colors[i])}`
                : `least to most ${hi(ax.scale.direction[0], w.colors[i])}`;
            return `at ${clock(f.hour)}, ${run(a, f.by[0])}, ties by ${hi(axisName(b), w.colors[f.by[1]])}: ${f.order.map(k => nameOf(w, k)).join(", ")}`;
        }
        case "view": {
            const at = w.unvoiced ? w.vantage?.(f.who) : undefined;
            if (at) return `at ${clock(f.hour)}, from ${nameOf(w, at.host)}${standsTail(at)}: ${nameOf(w, f.x)} is ${seenParts(w, f.seen).join(", ")}`;
            return `at ${clock(f.hour)}, ${seenWords(w, f.seen, nameOf(w, f.x), subj(w.speakers[f.who]), !w.unvoiced)}`;
        }
    }
}

/**
 * "Farm's nearest edges are 2 ahead of me, 1 to my left, 3 above, level
 * along time, 2 wider and the same kind" — from the speaker's own place; as a
 * third party would put it, "of Willow" for "of me".
 */
function seenWords(w: Wording, s: Seen, target: string, viewer: string, self = true): string {
    /* Its nearest edges, from where the speaker stands. */
    return `${self ? "I see" : `${viewer} sees`} ${target}: ${seenParts(w, s).join(", ")}`;
}

/** Where a thing's nearest edges are from a viewer: ahead, left, then every other dimension. */
function seenParts(w: Wording, s: Seen): string[] {
    const parts: string[] = [];
    parts.push(s.ahead === 0 ? "level ahead" : `${Math.abs(s.ahead)} ${s.ahead > 0 ? "ahead" : "behind"}`);
    parts.push(s.left === 0 ? "level sideways" : `${Math.abs(s.left)} ${s.left > 0 ? "left" : "right"}`);
    w.axes.forEach((ax, i) => {
        if (PLANE.includes(i)) return;
        const c = w.colors[i];
        if (ax.kind === "parity") parts.push(hi(s.rest[i] === 0 ? ax.scale.parity!.same : ax.scale.parity!.opposite, c));
        else if (s.rest[i] === 0) parts.push(`level in ${hi(axisName(ax), c)}`);
        else parts.push(clause(w, i, s.rest[i]));
    });
    return parts;
}

/** What a speaker says of speakers, with "I" for themselves, named second. */
function describeClaimBy(w: Wording, speaker: number, claim: Claim): string {
    const kind = (k: boolean) => hi(k ? "knight" : "knave");
    const name = (i: number) => subj(w.speakers[i]);
    const pair = (a: number, b: number) => (a === speaker ? [b, a] : [a, b]);
    const said = (i: number, object = false) => (i === speaker ? (object ? "me" : "I") : name(i));
    switch (claim.kind) {
        case "is":
            return claim.who === speaker ? `I am a ${kind(claim.knight)}` : `${name(claim.who)} is a ${kind(claim.knight)}`;
        case "same": case "differ": {
            if (claim.a !== speaker && claim.b !== speaker) return describeClaim(claim, w.speakers);
            const [a, b] = pair(claim.a, claim.b);
            const k = claim.kind === "same" ? "kn-same" : "kn-differ";
            return `${said(a)} ${own(k)} ${said(b)} ${own(`${k}-tail` as "kn-same-tail")}`;
        }
        default:
            return describeClaim(claim, w.speakers);
    }
}

const lengthWords = (len: number) => (len === 1 ? "a point" : `${len} long`);

/** ", facing east, a mirror twin, head down" — what a frame has besides a place. */
function standsTail(f: Extract<Fact, { kind: "stands" }>): string {
    return [f.facing === undefined ? "" : `, facing ${hi(FACINGS[f.facing])}`, f.twin ? `, a ${hi("mirror twin")}` : "", f.upside ? `, ${hi("head down")}` : ""].join("");
}

/** A knight's "not": the fact's own words with the verb denied. */
function negatedWords(w: Wording, f: Fact): string {
    const along = (a: number) => hi(axisName(w.axes[a]), w.colors[a]);
    switch (f.kind) {
        case "rel": {
            const words: Record<IntervalRel, string> = {
                before: `is not wholly ${towards(w.axes[f.axis], 1)}`, after: `is not wholly ${towards(w.axes[f.axis], 0)}`,
                overlaps: "does not overlap", within: "is not within", spans: "does not span", identical: "does not match",
            };
            const tail = f.rel === "before" || f.rel === "after" ? "" : ` in ${along(f.axis)}`;
            return `at ${clock(f.hour)}, ${nameOf(w, f.x)} ${words[f.rel]} ${nameOf(w, f.y)}${tail}`;
        }
        case "cmp": {
            const words = { longer: "is not longer than", shorter: "is not shorter than", same: "is not as long as" }[f.cmp];
            return `at ${clock(f.hour)}, ${nameOf(w, f.x)} ${words} ${nameOf(w, f.y)} in ${along(f.axis)}`;
        }
        case "size":
            return `${nameOf(w, f.x)} is not ${lengthWords(f.len)} in ${along(f.axis)}`;
        default:
            return `not so: ${describeFact(w, f)}`;
    }
}

/** "Ash says: at 3 o'clock, …" — a speaker on themselves says "I". */
export function describeStatement(w: Wording, s: Statement): string {
    const f = s.fact;
    if (w.unvoiced) return describeFact(w, f);
    const body = f.kind === "type" ? describeClaimBy(w, s.speaker, f.claim)
        : f.kind === "stands" && f.who === s.speaker
            ? `I am in ${nameOf(w, f.host)}${standsTail(f)}`
            : describeFact(w, f);
    return `${subj(w.speakers[s.speaker])}: ${body}`;
}
