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
 * Why a guess at the speakers' kinds fails on the words, or null if it holds
 * up: two words a knight would vouch for that disagree, a knight's word that
 * comes out false, or a knave's that comes out true. `still` names the things
 * no knight gives a pace to, which the guess makes stand still; `none`, that
 * no knight says anything happens at that hour.
 */
export type Breach =
    | { kind: "clash"; a: Statement; b: Statement }
    | { kind: "false"; s: Statement }
    | { kind: "true"; s: Statement; still: number[]; none?: boolean };

export function wordBreach(axes: Axis[], things: number, statements: Statement[], types: boolean[]): Breach | null {
    for (const space of [0, 1]) {
        const words = statements.filter(s => (s.space ?? 0) === space && wordIn(s.fact));
        /* Paces: a knight's, or still. */
        const given: Array<Statement | null> = Array(things).fill(null);
        for (const s of words) {
            if (s.fact.kind !== "pace" || !types[s.speaker]) continue;
            const had = given[s.fact.x];
            if (had && !sameVec((had.fact as { vel: number[] }).vel, s.fact.vel)) return { kind: "clash", a: had, b: s };
            given[s.fact.x] = had ?? s;
        }
        const vel = (x: number) => (given[x] ? (given[x]!.fact as { vel: number[] }).vel : axes.map(() => 0));
        /* Events: what knights say happens, and nothing else. */
        const happens = new Set(words.filter(s => s.fact.kind === "event" && types[s.speaker])
            .map(s => { const f = s.fact as Extract<Fact, { kind: "event" }>; return `${f.hour}|${canonicalT(f.t)}`; }));
        /* Places: where a word somebody's kind vouches for puts a thing at an hour. */
        const placed = new Map<string, { d: number[]; by: Statement }>();
        for (const s of words) {
            const { f, denied } = wordIn(s.fact)!;
            if (f.kind !== "place" || types[s.speaker] === denied) continue;
            const key = `${f.x}@${f.hour}`, d = fromOrigin(axes, f), had = placed.get(key);
            if (had && !sameVec(had.d, d)) return { kind: "clash", a: had.by, b: s };
            if (!had) placed.set(key, { d, by: s });
        }
        for (const s of words) {
            const { f, denied } = wordIn(s.fact)!;
            let holds: boolean;
            if (f.kind === "pace" || f.kind === "pacelike") holds = paceHolds(f, vel);
            else if (f.kind === "event") holds = happens.has(`${f.hour}|${canonicalT(f.t)}`);
            else {
                const at = placed.get(`${f.x}@${f.hour}`);
                /* Nothing settles it: either way is possible. */
                if (!at) continue;
                holds = sameVec(at.d, fromOrigin(axes, f));
            }
            const truth = holds !== denied;
            if (truth === types[s.speaker]) continue;
            if (!truth) return { kind: "false", s };
            const named = f.kind === "pace" ? [f.x] : f.kind === "pacelike" ? [f.x, f.y] : [];
            return { kind: "true", s, still: named.filter(x => !given[x]), ...(f.kind === "event" && denied ? { none: true } : {}) };
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
    for (const space of [0, 1]) {
        const own = words.filter(s => s.speaker === speaker && (s.space ?? 0) === space && wordIn(s.fact)).map(s => wordIn(s.fact)!);
        /* A word and its own denial. */
        const keys = own.map(o => JSON.stringify(o.f));
        if (own.some((o, i) => own.some((p, j) => j !== i && keys[i] === keys[j] && o.denied !== p.denied))) return true;
        const asserted = own.filter(o => !o.denied).map(o => o.f);
        const pace = new Map<number, number[]>();
        for (const f of asserted) {
            if (f.kind !== "pace") continue;
            const had = pace.get(f.x);
            if (had && !sameVec(had, f.vel)) return true;
            pace.set(f.x, f.vel);
        }
        for (const f of asserted) {
            if (f.kind !== "pacelike") continue;
            const a = pace.get(f.x), b = pace.get(f.y);
            if (a && b && !sameVec(a, b.map(v => f.sign * v))) return true;
        }
        const placed = new Map<string, number[]>();
        for (const f of asserted) {
            if (f.kind !== "place") continue;
            const key = `${f.x}@${f.hour}`, d = fromOrigin(axes, f), had = placed.get(key);
            if (had && !sameVec(had, d)) return true;
            placed.set(key, d);
        }
        /* A turn one way and the other on the same hour. */
        const turns = asserted.filter(f => f.kind === "event") as Array<Extract<Fact, { kind: "event" }>>;
        for (const a of turns) for (const b of turns) {
            if (a === b || a.hour !== b.hour || a.t.id !== b.t.id) continue;
            const opposite = TRANSFORMS[a.t.id].opposite?.(a.t);
            if (opposite && canonicalT(opposite) === canonicalT(b.t)) return true;
        }
    }
    return false;
}
