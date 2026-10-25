/**
 * Composed World — who is a knight, from words that agree or cannot.
 *
 * The first stage tells the first speakers apart by words the card can check
 * against one another without first building the world: how things move,
 * what happens on the hour, and where a thing is from the origin. Two such
 * words can be congruent without being the same sentence — a pace and the
 * same pace over three hours, a quarter turn "north round to above" and
 * "above round to south", "4 steps clockwise" and "1 step anticlockwise" on a
 * ring of five, a time by local clocks and by the origin's — and two speakers
 * who say congruent things are of a kind, as two who say things that cannot
 * both be so are not both knights.
 *
 * What anchors it is the rule that nothing moves or happens that no knight
 * says does: were everyone a knave, nothing would move, and a knave who said
 * something never moves would be telling the truth.
 *
 * A guess at who is what is judged on the words alone, each topic by itself
 * — a thing's pace, an hour's events, a thing's place at an hour. That is
 * looser than the whole world, which ties the topics together, so it never
 * throws out a guess the world allows; a card is kept only when it throws out
 * every guess but the true one.
 */

import { Axis, mod } from "./space";
import { Fact, POST, Statement, TIME } from "./facts";
import { TRANSFORMS, canonicalT } from "./transforms";

export type Word = Extract<Fact, { kind: "pace" } | { kind: "pacelike" } | { kind: "event" } | { kind: "place" }>;
const EAST = 0;
const isWordFact = (f: Fact): f is Word =>
    f.kind === "pace" || f.kind === "pacelike" || f.kind === "event" || (f.kind === "place" && f.y === POST);
/* A word, or one denied — the answer "no" to a question about one. */
export const wordIn = (f: Fact): { f: Word; denied: boolean } | null =>
    isWordFact(f) ? { f, denied: false } : f.kind === "not" && isWordFact(f.f) ? { f: f.f, denied: true } : null;

const sameVec = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i]);

/** A place from the origin as the world has it: rings and kinds round, local clocks read back to the origin's. */
export function fromOrigin(axes: Axis[], f: Extract<Fact, { kind: "place" }>): number[] {
    const d = f.delta.map((v, i) => (axes[i].kind === "ring" ? mod(v, axes[i].modulus!) : axes[i].kind === "parity" ? mod(v, 2) : v));
    if (f.local) {
        const t = d[TIME] - d[EAST];
        d[TIME] = axes[TIME].kind === "ring" ? mod(t, axes[TIME].modulus!) : t;
    }
    return d;
}

/** Whether a pace word holds, given every thing's pace. */
export function paceHolds(f: Extract<Fact, { kind: "pace" } | { kind: "pacelike" }>, vel: (x: number) => number[]): boolean {
    return f.kind === "pace" ? sameVec(vel(f.x), f.vel) : sameVec(vel(f.x), vel(f.y).map(v => f.sign * v));
}

/**
 * Why a guess at the speakers' kinds cannot be, or null if some world fits
 * it: words that would have to be true (a knight's, or a knave's denial) and
 * words that would have to be false (a knave's, or a knight's denial) which
 * no one pace, place or hour's events can satisfy together.
 *
 * Plain logic, with no rule filling in what nobody says: a speaker whose
 * words merely agree with each other is not thereby a knight. Each topic — a
 * thing's pace, a thing's place at an hour, an hour's events — is judged by
 * itself, and two things alike or opposite only once both their paces are
 * pinned. That is looser than the whole world, so it never throws out a guess
 * the world allows; a card is kept only when it throws out every guess but
 * the ones it means to leave open.
 */
export interface Breach { parts: Array<{ s: Statement; holds: boolean }> }

/* Each word read once: its topic and value don't change from guess to guess. */
interface Read { space: number; f: Word; denied: boolean; key: string | null; value: number[] }
const READ = new WeakMap<Statement, Read | null>();
function readWord(axes: Axis[], s: Statement): Read | null {
    if (READ.has(s)) return READ.get(s)!;
    const w = wordIn(s.fact);
    let r: Read | null = null;
    if (w) {
        const f = w.f;
        const key = f.kind === "pace" ? `p${f.x}` : f.kind === "place" ? `l${f.x}@${f.hour}` : f.kind === "event" ? `e${f.hour}|${canonicalT(f.t)}` : null;
        const value = f.kind === "pace" ? f.vel : f.kind === "place" ? fromOrigin(axes, f) : [1];
        r = { space: s.space ?? 0, f, denied: w.denied, key, value };
    }
    READ.set(s, r);
    return r;
}

export function wordBreach(axes: Axis[], _things: number, statements: Statement[], types: boolean[]): Breach | null {
    const read = statements.map(s => [s, readWord(axes, s)] as const).filter((p): p is readonly [Statement, Read] => !!p[1]);
    for (const space of [0, 1]) {
        /* Each word, with whether this guess needs it so or not so. */
        const lits = read.filter(([, r]) => r.space === space).map(([s, r]) => ({ s, r, holds: types[s.speaker] !== r.denied }));
        /* Per topic, a value pinned by what must be so, and the values ruled out by what must not be. */
        const pinned = new Map<string, (typeof lits)[number]>();
        for (const l of lits) {
            if (l.r.key === null || !l.holds) continue;
            const had = pinned.get(l.r.key);
            if (had && !sameVec(had.r.value, l.r.value)) return { parts: [had, l].map(p => ({ s: p.s, holds: p.holds })) };
            if (!had) pinned.set(l.r.key, l);
        }
        for (const l of lits) {
            if (l.r.key === null || l.holds) continue;
            const at = pinned.get(l.r.key);
            if (at && sameVec(at.r.value, l.r.value)) return { parts: [at, l].map(p => ({ s: p.s, holds: p.holds })) };
        }
        /* Alike or opposite, once both paces are pinned. */
        for (const l of lits) {
            if (l.r.f.kind !== "pacelike") continue;
            const f = l.r.f, a = pinned.get(`p${f.x}`), b = pinned.get(`p${f.y}`);
            if (!a || !b) continue;
            if (sameVec(a.r.value, b.r.value.map(v => f.sign * v)) !== l.holds)
                return { parts: [a, b, l].map(p => ({ s: p.s, holds: p.holds })) };
        }
    }
    return null;
}

/**
 * Whether one speaker's own words contradict each other on their face: two
 * paces for one thing, a thing that never moves and moves, two things alike
 * whose paces the speaker gives differently, two places for one thing at one
 * hour, a turn and its opposite on one hour, or a word and its own denial.
 *
 * A knave who does that is found out at a glance, without a thought about the
 * world — the puzzle is meant to be in how speakers' words bear on each other.
 * Judged on the speaker's words alone: what nobody gives a pace to is not taken
 * to stand still here, since that rule is about knights, not about one voice.
 */
export function selfContradicts(axes: Axis[], words: Statement[], speaker: number): boolean {
    /* As though the speaker were a knight: could everything they say be so? */
    const own = words.filter(s => s.speaker === speaker);
    if (wordBreach(axes, 0, own, Array.from({ length: speaker + 1 }, () => true))) return true;
    /* A turn one way and the other on the same hour, which the events allow as two. */
    const turns = own.map(s => wordIn(s.fact)).filter(w => w && !w.denied && w.f.kind === "event").map(w => w!.f as Extract<Fact, { kind: "event" }>);
    return turns.some(a => turns.some(b => a !== b && a.hour === b.hour && a.t.id === b.t.id
        && (TRANSFORMS[a.t.id].opposite?.(a.t) ? canonicalT(TRANSFORMS[a.t.id].opposite!(a.t)!) === canonicalT(b.t) : false)));
}

