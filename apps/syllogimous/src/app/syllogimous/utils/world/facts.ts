/**
 * Composed World — what can be said, and how it is read.
 *
 * Every premise is a statement by a speaker, who is a knight or a knave. A
 * statement carries one fact. Each kind of fact is a registry entry that says
 * how it is worded, whether it holds of a world, and what a knave saying it
 * actually tells you:
 *
 *   place   where one thing is relative to another (or the Post) at an hour,
 *           on every axis at once. Exact, so only a knight is given one: "not
 *           2 east" leaves too much open to be worth a premise.
 *   pace    how something moves every hour. Exact, knights only, for the same
 *           reason.
 *   size    one length of one thing: 3, or a point. Two-valued, so a knave's
 *           version is information — it is the other one.
 *   event   a transformation of the whole space at an hour. A turn has a
 *           direction, a shear and a shift a sign, and a knave's version of one
 *           of those is the other way round; the rest are knights' alone.
 *   rel     how two things' stretches lie along one axis at an hour: wholly to
 *           one side, overlapping, one within the other, identical. Checkable
 *           against what the trusted speakers establish, which is how a speaker
 *           nobody vouches for is unmasked.
 *   type    what a speaker says about speakers: the classic puzzle, which
 *           settles some of them before the space is touched.
 */

import { Claim, describeClaim, holds as claimHolds } from "../knaves.utils";
import { hi, own, subj } from "../phrasing";
import { Axis, Body, mod } from "./space";
import { TRANSFORMS, TransformSpec } from "./transforms";

/** Index of the Post among things a fact can name. */
export const POST = -1;

export type IntervalRel = "before" | "after" | "overlaps" | "within" | "spans" | "identical";

export type Fact =
    | { kind: "place"; hour: number; x: number; y: number; delta: number[] }
    | { kind: "pace"; x: number; vel: number[] }
    | { kind: "size"; x: number; axis: number; long: boolean }
    | { kind: "event"; hour: number; t: TransformSpec }
    | { kind: "rel"; hour: number; x: number; y: number; axis: number; rel: IntervalRel }
    | { kind: "type"; claim: Claim };

export interface Statement { speaker: number; fact: Fact }

/** The one length a thing can have besides being a point, stated in the setup. */
export const LONG = 3;

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
export interface View {
    axes: Axis[];
    /** A thing's body at an hour, or null where the view cannot say. */
    at(x: number, hour: number): Body | null;
    /** Hour-0 body, for the facts that are about a thing rather than a moment. */
    start(x: number): Body | null;
    /** Whether the events are known up to and including this hour. */
    eventsKnownThrough(hour: number): boolean;
    events(): Array<{ hour: number; t: TransformSpec }> | null;
    types: Array<boolean | undefined>;
}

const sameVec = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i]);
const sameT = (a: TransformSpec, b: TransformSpec) => a.id === b.id && sameVec(a.axes, b.axes) && (a.k ?? 1) === (b.k ?? 1);

/** Whether `f` holds in the view, or null when the view does not settle it. */
export function holds(f: Fact, v: View): boolean | null {
    switch (f.kind) {
        case "place": {
            const x = v.at(f.x, f.hour), y = v.at(f.y, f.hour);
            return x && y ? sameVec(displacement(v.axes, x, y), f.delta) : null;
        }
        case "pace": { const s = v.start(f.x); return s ? sameVec(s.vel, f.vel) : null; }
        case "size": { const s = v.start(f.x); return s ? (s.size[f.axis] === LONG) === f.long : null; }
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
        case "size": return { ...f, long: !f.long };
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
}

export const POST_NAME = "the Post";
export const clock = (h: number) => `${h} o'clock`;

const nameOf = (w: Wording, x: number) => x === POST ? POST_NAME : subj(w.things[x]);
const axisName = (a: Axis) => a.scale.name.toLowerCase().replace("-", "–");

/** One axis of a displacement, in that axis's colour. */
export function clause(w: Wording, i: number, d: number): string {
    const ax = w.axes[i], s = ax.scale;
    let text: string;
    if (ax.kind === "parity") text = d % 2 === 0 ? s.parity!.same : s.parity!.opposite;
    else if (ax.kind === "ring") text = d === 0 ? s.tie : `${d} ${d === 1 ? s.cyclic!.step : s.cyclic!.step + "s"} ${s.cyclic!.direction[0]}`;
    else text = d === 0 ? s.tie : `${Math.abs(d)} ${s.direction[d > 0 ? 0 : 1]}`;
    return hi(text, w.colors[i]);
}

function paceWords(w: Wording, vel: number[]): string {
    const parts = vel.map((v, i) => {
        if (v === 0) return null;
        const ax = w.axes[i];
        if (ax.kind === "ring") return hi(`1 ${ax.scale.cyclic!.step} ${ax.scale.cyclic!.direction[v > 0 ? 0 : 1]}`, w.colors[i]);
        return hi(`${Math.abs(v)} ${ax.scale.direction[v > 0 ? 0 : 1]}`, w.colors[i]);
    }).filter(Boolean);
    return parts.join(", ");
}

/** "north of", "above", "wider than": a direction with the scale's own connector. */
export const towards = (a: Axis, side: 0 | 1) => [a.scale.direction[side], a.scale.link].filter(Boolean).join(" ");

const REL_WORDS: Record<IntervalRel, (w: Wording, i: number) => string> = {
    before: (w, i) => `lies wholly ${towards(w.axes[i], 1)}`,
    after: (w, i) => `lies wholly ${towards(w.axes[i], 0)}`,
    overlaps: () => "partly overlaps",
    within: () => "lies within",
    spans: () => "takes in all of",
    identical: () => "covers exactly the same stretch as",
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
            return `the whole space turns a quarter about ${POST_NAME}, taking ${col(a, ax(a).direction[0])} round to ${col(b, to)}`;
        }
        case "mirror":
            return `the whole space is ${own("cs-mirror")} ${col(t.axes[0], axisName(w.axes[t.axes[0]]))} through ${POST_NAME}`;
        case "swap":
            return `${col(t.axes[0], axisName(w.axes[t.axes[0]]))} and ${col(t.axes[1], axisName(w.axes[t.axes[1]]))} trade places through ${POST_NAME}`
                + ` (${col(t.axes[0], ax(t.axes[0]).direction[0])} becomes ${col(t.axes[1], ax(t.axes[1]).direction[0])})`;
        case "shear": {
            const [a, b] = t.axes;
            return `everything slides 1 ${col(a, ax(a).direction[k > 0 ? 0 : 1])} per step its low end lies ${col(b, towards(w.axes[b], 0))} ${POST_NAME}`
                + ` (the other way per step ${col(b, ax(b).direction[1])})`;
        }
        case "translate":
            return `everything but ${POST_NAME} shifts ${Math.abs(k)} ${col(t.axes[0], ax(t.axes[0]).direction[k > 0 ? 0 : 1])}`;
        case "stretch":
            return `every ${col(t.axes[0], axisName(w.axes[t.axes[0]]))} distance from ${POST_NAME} doubles`;
    }
    return t.id;
}

/** What the fact says, without the speaker. */
export function describeFact(w: Wording, f: Fact): string {
    switch (f.kind) {
        case "place":
            return `at ${clock(f.hour)}, ${nameOf(w, f.x)} is ${f.delta.map((d, i) => clause(w, i, d)).join(", ")} relative to ${nameOf(w, f.y)}`;
        case "pace": {
            const p = paceWords(w, f.vel);
            return p ? `every hour, ${nameOf(w, f.x)} moves ${p}` : `${nameOf(w, f.x)} never moves`;
        }
        case "size":
            return `${nameOf(w, f.x)} is ${f.long ? `${LONG} long` : "a point"} along ${hi(axisName(w.axes[f.axis]), w.colors[f.axis])}`;
        case "rel":
            return `at ${clock(f.hour)}, ${nameOf(w, f.x)} ${REL_WORDS[f.rel](w, f.axis)} ${nameOf(w, f.y)} along ${hi(axisName(w.axes[f.axis]), w.colors[f.axis])}`;
        case "event":
            return `at ${clock(f.hour)}, ${describeTransform(w, f.t)}`;
        case "type":
            return describeClaim(f.claim, w.speakers);
    }
}

/** "Ash says: at 3 o'clock, …" — a speaker on themselves says "I". */
export function describeStatement(w: Wording, s: Statement): string {
    let body = describeFact(w, s.fact);
    if (s.fact.kind === "type" && s.fact.claim.kind === "is" && s.fact.claim.who === s.speaker) {
        body = `I am a ${hi(s.fact.claim.knight ? "knight" : "knave")}`;
    }
    return `${subj(w.speakers[s.speaker])} says: ${body}`;
}
