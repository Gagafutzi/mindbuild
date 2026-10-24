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
import { Axis, Body, mod } from "./space";
import { TRANSFORMS, TransformSpec } from "./transforms";

/** Index of the Post among things a fact can name. */
export const POST = -1;

export type IntervalRel = "before" | "after" | "overlaps" | "within" | "spans" | "identical";

export type Fact =
    | { kind: "place"; hour: number; x: number; y: number; delta: number[] }
    | { kind: "pace"; x: number; vel: number[] }
    | { kind: "size"; x: number; axis: number; len: number }
    | { kind: "sizes"; x: number; lens: Array<[number, number]> }
    | { kind: "cmp"; hour: number; x: number; y: number; axis: number; cmp: Cmp }
    | { kind: "stands"; who: number; host: number; facing?: number }
    | { kind: "view"; hour: number; who: number; x: number; seen: Seen }
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
export interface Observer { host: number; facing: number }

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

/** What a speaker standing at `from`'s low end, facing `facing`, sees of `t`. */
export function seenFrom(axes: Axis[], from: Body, t: Body, facing: number): Seen {
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
    return { ahead, left, rest: rest.map((v, i) => (PLANE.includes(i) ? 0 : v)) };
}
const sameSeen = (a: Seen, b: Seen) => a.ahead === b.ahead && a.left === b.left && a.rest.every((v, i) => v === b.rest[i]);

export interface View {
    axes: Axis[];
    /** Where a speaker stands, and every way they may be facing; null where unknown. */
    observer(who: number): { host: number; facings: number[] } | null;
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
            const hs = o.facings.map(g => sameSeen(seenFrom(v.axes, from, t, g), f.seen));
            return hs.length && hs.every(h => h === hs[0]) ? hs[0] : null;
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
}

/** Where places are measured from: a point, not a thing, and named as one. */
export const POST_NAME = "the origin";
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
    identical: () => "covers the same stretch as",
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
            return `everything turns a quarter about ${POST_NAME}, ${col(a, ax(a).direction[0])} round to ${col(b, to)}`;
        }
        case "mirror":
            return `everything is ${own("cs-mirror")} ${col(t.axes[0], axisName(w.axes[t.axes[0]]))} through ${POST_NAME}`;
        case "swap":
            return `${col(t.axes[0], axisName(w.axes[t.axes[0]]))} and ${col(t.axes[1], axisName(w.axes[t.axes[1]]))} swap through ${POST_NAME},`
                + ` ${col(t.axes[0], ax(t.axes[0]).direction[0])} becoming ${col(t.axes[1], ax(t.axes[1]).direction[0])}`;
        case "shear": {
            const [a, b] = t.axes;
            return `everything slides 1 ${col(a, ax(a).direction[k > 0 ? 0 : 1])} per step its low end lies ${col(b, towards(w.axes[b], 0))} ${POST_NAME}`
                + `, 1 ${col(a, ax(a).direction[k > 0 ? 1 : 0])} per step ${col(b, ax(b).direction[1])}`;
        }
        case "translate":
            return `everything shifts ${Math.abs(k)} ${col(t.axes[0], ax(t.axes[0]).direction[k > 0 ? 0 : 1])}`;
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
            return `${nameOf(w, f.x)} is ${lengthWords(f.len)} along ${hi(axisName(w.axes[f.axis]), w.colors[f.axis])}`;
        case "sizes": {
            /* Several lines in one sentence, longest first and equal lengths
               together: "3 long along north–south and time, and a point along
               up–down". */
            const and = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}` : xs[0]);
            const lens = [...new Set(f.lens.map(([, l]) => l))].sort((p, q) => q - p);
            const parts = lens.map((l, i) => {
                const on = and(f.lens.filter(([, m]) => m === l).map(([a]) => hi(axisName(w.axes[a]), w.colors[a])));
                return `${i === 0 ? lengthWords(l) : l === 1 ? "a point" : String(l)} along ${on}`;
            });
            return `${nameOf(w, f.x)} is ${parts.length > 1 ? `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}` : parts[0]}`;
        }
        case "cmp": {
            const words = { longer: "is longer than", shorter: "is shorter than", same: "is as long as" }[f.cmp];
            return `at ${clock(f.hour)}, ${nameOf(w, f.x)} ${words} ${nameOf(w, f.y)} along ${hi(axisName(w.axes[f.axis]), w.colors[f.axis])}`;
        }
        case "rel": {
            /* "Wholly north of" names its axis already; the others need telling which. */
            const along = f.rel === "before" || f.rel === "after" ? "" : ` along ${hi(axisName(w.axes[f.axis]), w.colors[f.axis])}`;
            return `at ${clock(f.hour)}, ${nameOf(w, f.x)} ${REL_WORDS[f.rel](w, f.axis)} ${nameOf(w, f.y)}${along}`;
        }
        case "event":
            return `at ${clock(f.hour)}, ${describeTransform(w, f.t)}`;
        case "type":
            return describeClaim(f.claim, w.speakers);
        case "stands":
            return `${subj(w.speakers[f.who])} stands in ${nameOf(w, f.host)}${f.facing === undefined ? "" : `, facing ${hi(FACINGS[f.facing])}`}`;
        case "view":
            return `at ${clock(f.hour)}, ${seenWords(w, f.seen, nameOf(w, f.x), subj(w.speakers[f.who]))}`;
    }
}

/**
 * "Farm's nearest edges are 2 ahead of me, 1 to my left, 3 above, level
 * along time, 2 wider and the same kind" — from the speaker's own place; as a
 * third party would put it, "of Willow" for "of me".
 */
function seenWords(w: Wording, s: Seen, target: string, viewer: string, self = true): string {
    const me = self ? "me" : viewer, my = self ? "my" : `${viewer}'s`;
    const parts: string[] = [];
    parts.push(s.ahead === 0 ? "level ahead and behind" : `${Math.abs(s.ahead)} ${s.ahead > 0 ? "ahead of" : "behind"} ${me}`);
    parts.push(s.left === 0 ? `level to ${my} left and right` : `${Math.abs(s.left)} to ${my} ${s.left > 0 ? "left" : "right"}`);
    w.axes.forEach((ax, i) => {
        if (PLANE.includes(i)) return;
        const c = w.colors[i];
        if (ax.kind === "parity") parts.push(hi(s.rest[i] === 0 ? ax.scale.parity!.same : ax.scale.parity!.opposite, c));
        else if (s.rest[i] === 0) parts.push(`level along ${hi(axisName(ax), c)}`);
        else parts.push(clause(w, i, s.rest[i]));
    });
    return `${target}'s nearest edges are ${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
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

/** "Ash says: at 3 o'clock, …" — a speaker on themselves says "I". */
export function describeStatement(w: Wording, s: Statement): string {
    const f = s.fact;
    const body = f.kind === "type" ? describeClaimBy(w, s.speaker, f.claim)
        : f.kind === "stands" && f.who === s.speaker
            ? `I stand in ${nameOf(w, f.host)}${f.facing === undefined ? "" : `, facing ${hi(FACINGS[f.facing])}`}`
            : describeFact(w, f);
    return `${subj(w.speakers[s.speaker])} says: ${body}`;
}
