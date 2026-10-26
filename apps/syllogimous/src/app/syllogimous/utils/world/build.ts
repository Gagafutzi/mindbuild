/**
 * Composed World — building an item: a world, the testimony that pins it down,
 * and an analogy question that needs all of it.
 *
 * Built forwards and kept only if it reads backwards:
 *
 *   1. a world: the seven axes of Space 7D, with east–west a ring whose seam
 *      twists north–south or leads up, and time a line, a plain ring or a ring
 *      that leads into containment; things with lengths and paces; one or two
 *      transformations of the whole space on the hour
 *   2. speakers: some settled by what they say of each other, the rest only
 *      by one checkable report each. The knights carry the places, paces and
 *      events; the knaves' word is on lengths and turn directions, false, so
 *      their version has to be undone to be used
 *   3. a question from every kind in QUESTIONS, drawn evenly
 *   4. the checks: the full reading rebuilds exactly this world and these
 *      types, and every shortcut reading answers differently or not at all
 */

import { LINEAR_SCALES, SPATIAL_SCALES } from "../linear.utils";
import { Axis, Body, FULL, Frames, SHORTCUTS, Seam, mod, reckon, sameBody } from "./space";
import { TRANSFORMS, TransformSpec, canTransform, canonicalT } from "./transforms";
import { Cmp, Fact, IntervalRel, PLANE, POST, Seen, Statement, TIME, compareLengths, displacement, firstLevel, firstMeet, holds, intervalRel, localTime, otherKind, rankBy, seenFrom, spaceSteps, stepsBetween } from "./facts";
import { Card, Reconstruction, World, bodyAt, clearReaderCache, read, settleTypes, thingAt, worlds } from "./reader";
import { selfContradicts, wordBreach, wordIn } from "./words";
import { Answer, Ask, QUESTIONS, QuestionKind, Span, answerFollows, answerKey, askNeed } from "./questions";

export interface Item {
    world: World;
    /** Everything said, the words that tell the speakers apart among it. */
    card: Card;
    /** The knights' words that make the world, which the question is asked on. */
    plain: Card;
    types: boolean[];
    ask: Ask;
    kind: QuestionKind;
    answer: Answer;
    /** What each shortcut reading answers: never the answer. */
    shortcuts: Record<string, Answer>;
    reconstruction: Reconstruction;
}

export interface BuildOptions {
    things: number;
    speakers: number;
    /** How many of the seven axes, in their fixed order; all seven by default. */
    dims?: number;
    /** Whether the card has a second space in brackets; drawn when unset. */
    nested?: boolean;
    /** Whether the card leaves a length open, to ask what could be; drawn when unset. */
    open?: boolean;
    /** Whether the other kind has a reckoning of its own, on a space with kinds; drawn when unset. */
    kinds?: boolean;
    /** Ask this kind only; otherwise every kind that fits the card, evenly. */
    kind?: string;
    /**
     * Staged items only: the knights and knaves as ever, then a world small
     * enough to show whole — three things, no brackets, nothing left open, no
     * reckoning of the other kind — asked about only true or false.
     */
    easy?: boolean;
    rnd?: () => number;
}

const RING = 5;
const TIME_RING = 6;
/**
 * The day in two parts. Everything the card first states, and every question
 * asked before the last stage, is at hour 7 or before; the transformations the
 * last stage announces happen at 8, 9 or 10, after all of it, so announcing
 * them never changes what an earlier premise meant or an earlier answer was.
 */
const FIRST_HOURS = 7;
const LATER_HOURS = [8, 9, 10];
const LAST_HOUR = 11;

/* ------------------------------------------------------------------ *
 * The world                                                           *
 * ------------------------------------------------------------------ */

/**
 * The first `dims` of the seven, in a fixed order so that the smallest space
 * still has what everything needs: the ring with its seam and the two lines it
 * can twist or lead into, which are also the plane a turn or a shear acts in.
 * Time's portal leads into containment, so it waits until containment is there.
 */
export function makeAxes(rnd: () => number, dims = 7): Axis[] {
    const east: Seam = rnd() < 0.5 ? { type: "twist", target: 1 } : { type: "portal", target: 2, shift: 1 + Math.floor(rnd() * 2) };
    const t = rnd();
    const time: Axis = t < 0.4 ? { scale: LINEAR_SCALES["temporal"], kind: "line" }
        : t < 0.7 ? { scale: LINEAR_SCALES["temporal"], kind: "ring", modulus: TIME_RING, seam: { type: "plain" } }
        : { scale: LINEAR_SCALES["temporal"], kind: "ring", modulus: TIME_RING, seam: { type: "portal", target: 4, shift: 1 } };
    if (dims < 5 && time.seam?.type === "portal") time.seam = { type: "plain" };
    return [
        { scale: SPATIAL_SCALES["east"], kind: "ring", modulus: RING, seam: east },
        { scale: SPATIAL_SCALES["north"], kind: "line" },
        { scale: SPATIAL_SCALES["up"], kind: "line" },
        time,
        { scale: LINEAR_SCALES["contains"], kind: "line" },
        { scale: LINEAR_SCALES["quantity"], kind: "line" },
        { scale: LINEAR_SCALES["distinction"], kind: "parity" },
    ].slice(0, dims) as Axis[];
}

const lineAxes = (axes: Axis[]) => axes.map((a, i) => (a.kind === "line" ? i : -1)).filter(i => i >= 0);
const int = (rnd: () => number, a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const pick = <T>(xs: T[], rnd: () => number): T => xs[Math.floor(rnd() * xs.length)];
function shuffle<T>(xs: T[], rnd: () => number): T[] {
    const out = [...xs];
    for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
    return out;
}
const sign = (rnd: () => number) => (rnd() < 0.5 ? 1 : -1);

function makeBody(axes: Axis[], rnd: () => number): Body {
    const lines = lineAxes(axes);
    const pos = axes.map(a => (a.kind === "ring" ? int(rnd, 0, a.modulus! - 1) : a.kind === "parity" ? int(rnd, 0, 1) : int(rnd, -3, 3)));
    /* A length of its own along every line, 1 to 3 — no pattern to lean on:
       a point here, a stretch there, the same along two lines or along none. */
    const size = axes.map(a => (a.kind === "line" ? pick([1, 1, 2, 3], rnd) : 1));
    const vel = axes.map(() => 0);
    /* Round the ring often, so the seams come into it; one or two lines besides,
       or at most one on the smallest space, where every clause is first-card reading. */
    if (rnd() < 0.7) vel[0] = sign(rnd);
    if (axes[3]?.kind === "ring" && rnd() < 0.4) vel[3] = sign(rnd);
    const moving = lines.length <= 2 ? Math.floor(rnd() * 2) : 1 + Math.floor(rnd() * 2);
    for (const a of shuffle(lines, rnd).slice(0, moving)) vel[a] = sign(rnd);
    return { pos, size, vel };
}

/* Given the things, an event may happen to one of them alone — never a turn
   back to one that has no pace to reverse. */
function makeEvents(axes: Axis[], rnd: () => number, within = [2, 3, 4, 5, 6], start?: Body[]): Array<{ hour: number; t: TransformSpec }> {
    const lines = lineAxes(axes), out: Array<{ hour: number; t: TransformSpec }> = [];
    /* Two only where there is room for them to be told apart from one. */
    const count = axes.length >= 5 && rnd() < 0.5 ? 2 : 1, hours = shuffle(within, rnd).slice(0, count).sort((a, b) => a - b);
    for (const hour of hours) {
        for (let guard = 0; guard < 20; guard++) {
            const id = pick(Object.keys(TRANSFORMS).filter(k => start || !TRANSFORMS[k].single), rnd);
            const t: TransformSpec = { id, axes: shuffle(lines, rnd).slice(0, TRANSFORMS[id].needs) };
            if (TRANSFORMS[id].single) t.who = int(rnd, 0, start!.length - 1);
            if (id === "turn" && start![t.who!].vel.every(v => v === 0)) continue;
            if (id === "jump") t.k = sign(rnd) * int(rnd, 1, 2);
            if (id === "rotate") t.k = rnd() < 0.5 ? 1 : 3;
            if (id === "shear") t.k = sign(rnd);
            if (id === "translate") t.k = sign(rnd) * int(rnd, 1, 2);
            if (canTransform(t, axes)) { out.push({ hour, t }); break; }
        }
    }
    return out;
}

/**
 * Half the time, on a space with kinds, the other kind reckons one line the
 * other way round or two lines traded — the same in both spaces, which are
 * the same kind of space.
 */
function makeFrames(axes: Axis[], rnd: () => number, want?: boolean): Frames | undefined {
    if (!axes.some(a => a.kind === "parity") || !(want ?? rnd() < 0.5)) return undefined;
    const straight = [1, 2, 4, 5].filter(i => axes[i]?.kind === "line");
    return rnd() < 0.5 ? { rule: "mirror", axes: [pick(straight, rnd)] } : { rule: "swap", axes: shuffle(straight, rnd).slice(0, 2).sort((a, b) => a - b) };
}

/* ------------------------------------------------------------------ *
 * The testimony                                                       *
 * ------------------------------------------------------------------ */

/**
 * Words from the speakers until every guess at what they are is ruled out but
 * the truth and some with the asked speaker wrong (`words.ts`): on how things
 * move, what happens on the hour, and where a thing is from the origin, each
 * said or denied, true from a knight and false from a knave.
 *
 * Only logic rules a guess out — words that cannot be so and not so together
 * — so it takes words that bear on each other: two on one topic, from one
 * speaker or two, in forms of their own (a pace over several hours, a quarter
 * turn from its other side, a place the other way round the ring or by local
 * clocks, one gap given by another). Two speakers who agree in different
 * words are of a kind; two denials nothing can make both false cannot both
 * come from a knave. Nobody contradicts themselves: that would give a knave
 * away at a glance. Each candidate is the one, of a few dozen drawn, that
 * rules out the most guesses.
 */
function puzzleWords(world: World, types: boolean[], voices: number[], rnd: () => number, asked: number): Statement[] | null {
    const axes = world.axes, n = world.start.length, vel = world.start.map(b => b.vel);
    const ids = Array.from({ length: n }, (_, k) => k);
    /* Every wrong guess at what the speakers are. Those that have the asked
       speaker right have to go; of those that have them wrong, some must stay,
       for the question to settle — and with them whoever the asked speaker's
       words tie to theirs. */
    const guesses = Array.from({ length: 1 << voices.length }, (_, m) => {
        const t = [...types];
        voices.forEach((i, j) => (t[i] = (m & (1 << j)) !== 0));
        return t;
    }).filter(t => !t.every((v, i) => v === types[i]));
    /* Everyone the other kind has to go as well: every word then flips with
       them, and no question can tell that reading from the truth. */
    const flipped = (t: boolean[]) => voices.every(i => t[i] !== types[i]);
    /* And one other speaker is the same kind in every reading left open: what
       they pin is pinned alike in all of them, so a question about it can
       tell. Others may still be tied to the asked one. */
    const anchor = pick(voices.filter(i => i !== asked), rnd);
    const bad = guesses.filter(t => t[asked] === types[asked] || flipped(t) || t[anchor] !== types[anchor]), good = guesses.filter(t => !bad.includes(t));
    const out: Statement[] = [];
    const standingIn = (among: boolean[][], extra: Statement[]) => among.filter(t => !wordBreach(axes, n, [...out, ...extra], t));
    /* Ties: a reading left standing that has another speaker wrong besides the asked one. */
    const tied = (left: boolean[][]) => left.some(t => t.some((v, i) => i !== asked && v !== types[i]));
    /* What is still standing, worked out once a round: a candidate only has to be checked against that. */
    let leftBad: boolean[][] = bad, leftGood: boolean[][] = good;
    const owns = (extra: Statement[]) => extra.some(st => selfContradicts(axes, [...out, ...extra], st.speaker));
    const said = (f: Fact) => out.some(o => JSON.stringify(o.fact) === JSON.stringify(f));
    const free = axes.map((ax, i) => (ax.kind === "parity" ? -1 : i)).filter(i => i >= 0);
    const deny = (f: Fact): Fact => ({ kind: "not", f });
    /* A pace not so: one dimension's pace changed, by a step or to nothing. */
    const skewed = (v: number[]) => {
        const o = [...v], a = pick(free, rnd);
        o[a] = pick([-1, 0, 1].filter(u => u !== v[a]), rnd);
        return o;
    };
    const paceSaid = (x: number, v: number[]): Fact => ({ kind: "pace", x, vel: v, ...(v.some(u => u !== 0) && rnd() < 0.35 ? { every: pick([2, 3], rnd) } : {}) });
    /* Where a thing is from the origin at an hour, and that place a step off on one dimension. */
    const from = (x: number, h: number) => displacement(axes, thingAt(world, x, h), thingAt(world, POST, h));
    const nudged = (d: number[]) => {
        const o = [...d], a = pick(free, rnd);
        o[a] = axes[a].kind === "ring" ? mod(o[a] + pick([1, -1], rnd), axes[a].modulus!) : o[a] + pick([1, -1], rnd);
        return o;
    };
    /* A place in a form of its own: round the ring the other way, by local clocks, or one gap by another. */
    const placeSaid = (px: number, h: number, d: number[]): Fact => {
        const rings = axes.some((ax, i) => ax.kind === "ring" && d[i] !== 0);
        const lines = lineAxes(axes).filter(i => d[i] !== 0);
        const pairs = lines.flatMap(a => lines.filter(b => b > a && Math.abs(d[b]) === Math.abs(d[a])).map(b => [a, b] as [number, number]));
        const form = pick(["plain", ...(rings ? ["round", "round"] : []), ...(axes.length > TIME ? ["local"] : []), ...(pairs.length ? ["bridge"] : [])], rnd);
        const said = [...d];
        if (form === "local") said[TIME] = localTime(axes, d, thingAt(world, px, h), thingAt(world, POST, h));
        return { kind: "place", hour: h, x: px, y: POST, delta: said, ...(form === "round" ? { round: true } : {}),
            ...(form === "local" ? { local: true } : {}), ...(form === "bridge" ? { bridge: pick(pairs, rnd) } : {}) };
    };
    /* A transformation from its other side, where it has one. */
    const otherSide = (t: TransformSpec): TransformSpec => (t.id === "rotate" || t.id === "swap") && t.axes.length === 2
        ? { ...t, axes: [t.axes[1], t.axes[0]], ...(t.id === "rotate" ? { k: 4 - (t.k ?? 1) } : {}) } : t;
    const early = world.events.filter(e => e.hour <= FIRST_HOURS && TRANSFORMS[e.t.id].opposite);
    /* A word on a topic from a speaker: so from a knight, not so from a knave — said, or the other way denied. */
    type Topic = { kind: "pace"; x: number } | { kind: "place"; x: number; h: number } | { kind: "event"; e: (typeof early)[number] } | { kind: "like"; x: number; y: number; sign: 1 | -1 };
    const wordOn = (k: number, tp: Topic): Fact => {
        const so = types[k], asSaid = rnd() < 0.6;
        if (tp.kind === "pace") {
            const v = vel[tp.x], off = v.some(u => u !== 0) && rnd() < 0.4 ? v.map(() => 0) : skewed(v);
            return so ? (asSaid ? paceSaid(tp.x, [...v]) : deny(paceSaid(tp.x, off))) : (asSaid ? paceSaid(tp.x, off) : deny(paceSaid(tp.x, [...v])));
        }
        if (tp.kind === "place") {
            const d = from(tp.x, tp.h), off = nudged(d);
            return so ? (asSaid ? placeSaid(tp.x, tp.h, d) : deny(placeSaid(tp.x, tp.h, off))) : (asSaid ? placeSaid(tp.x, tp.h, off) : deny(placeSaid(tp.x, tp.h, d)));
        }
        if (tp.kind === "event") {
            const t = rnd() < 0.5 ? otherSide(tp.e.t) : tp.e.t, opp = TRANSFORMS[t.id].opposite!(t)!;
            const happens: Fact = { kind: "event", hour: tp.e.hour, t }, not: Fact = { kind: "event", hour: tp.e.hour, t: opp };
            return so ? (asSaid ? happens : deny(not)) : (asSaid ? not : deny(happens));
        }
        const like: Fact = { kind: "pacelike", x: tp.x, y: tp.y, sign: tp.sign };
        const truth = vel[tp.x].every((v, i) => v === tp.sign * vel[tp.y][i]);
        return truth === so ? like : deny(like);
    };
    /* A kind of word not yet used is worth a little more than its kills, so a
       card's congruences come from places and turns as well as paces; so is one
       that keeps another speaker's kind tied to the asked one's, and the asked
       speaker's first word, which needs no kills to be worth saying. */
    const used = new Set<string>();
    const worth = (extra: Statement[], family: string, goodAfter: boolean[][]) => {
        const kills = leftBad.length - standingIn(leftBad, extra).length;
        const first = !out.some(st => st.speaker === asked) && extra.some(st => st.speaker === asked);
        if (!kills && !first) return 0;
        return kills + (used.has(family) ? 0 : 0.6) + (voices.length > 2 && tied(goodAfter) ? 0.4 : 0) + (first ? 1 : 0);
    };
    /* Topics already spoken of, so a second word can land on one. */
    const spoken: Topic[] = [];
    for (let guard = 0; guard < 18; guard++) {
        const heard = out.some(st => st.speaker === asked);
        leftBad = standingIn(leftBad, []); leftGood = standingIn(leftGood, []);
        if (!leftGood.length) return null;
        if (!leftBad.length && heard) return out;
        let best: Statement[] | null = null, bestScore = 0, bestFamily = "", bestTopic: Topic | null = null;
        for (let g = 0; g < 60; g++) {
            const family = pick(["pace", "pace", "place", "place", "event", "like"], rnd);
            const x = pick(ids, rnd), y = pick(ids.filter(k => k !== x), rnd);
            const again = spoken.length && rnd() < 0.4 ? pick(spoken, rnd) : null;
            const tp: Topic | null = again ?? (family === "pace" ? { kind: "pace", x }
                : family === "place" ? { kind: "place", x, h: int(rnd, 1, FIRST_HOURS) }
                : family === "event" ? (early.length ? { kind: "event", e: pick(early, rnd) } : null)
                : { kind: "like", x, y, sign: rnd() < 0.6 ? 1 : -1 });
            if (!tp) continue;
            /* One word on a topic already spoken of; two on a new one, from one speaker or two. The asked speaker speaks until they have. */
            const who = () => (!heard && rnd() < 0.4 ? asked : pick(voices, rnd));
            const first = who(), speakers = again ? [first] : [first, rnd() < 0.25 ? first : who()];
            const group = speakers.map(k => ({ speaker: k, fact: wordOn(k, tp) }));
            /* Two things alike or opposite say something only once both paces are said: they come together. */
            if (tp.kind === "like" && !again) {
                const [k2, k3] = [who(), who()];
                group.splice(1, 1, { speaker: k2, fact: wordOn(k2, { kind: "pace", x: tp.x }) }, { speaker: k3, fact: wordOn(k3, { kind: "pace", x: tp.y }) });
            }
            if (group.some(st => said(st.fact)) || new Set(group.map(st => JSON.stringify(st.fact))).size < group.length) continue;
            if (owns(group)) continue;
            const goodAfter = standingIn(leftGood, group);
            if (!goodAfter.length) continue;
            const score = worth(group, tp.kind, goodAfter);
            if (score > bestScore) { best = group; bestScore = score; bestFamily = tp.kind; bestTopic = tp; }
        }
        if (!best) return null;
        out.push(...best);
        used.add(bestFamily);
        if (bestTopic && !spoken.includes(bestTopic)) spoken.push(bestTopic);
    }
    return null;
}

/**
 * The statements that pin one space down: `space` 0 outside the brackets, with
 * the speakers' claims about each other, or 1 inside them, without — the same
 * speakers, already settled or not. Each speaker the claims leave open gives
 * `reports` checkable reports here.
 */
function makeCard(world: World, types: boolean[], firsts: number[], rnd: () => number, space = 0, leaveOpen = false): Statement[] | null {
    const axes = world.axes, n = world.start.length, S = types.length;
    /* Paces and events from the speakers who tell each other apart, since the
       first stage shows them; the rest of the world from any knight, the
       one who was asked included. */
    /* Every knight gives part of the world, whoever has said least so far
       taking the next: with one voice for all of it, nothing on the card is
       said from anywhere but one place. */
    const anyKnight = types.map((t, i) => (t ? i : -1)).filter(i => i >= 0);
    if (!anyKnight.length) return null;
    const statements: Statement[] = [];
    const share = () => {
        const said = (k: number) => statements.filter(st => st.speaker === k).length;
        const least = Math.min(...anyKnight.map(said));
        return pick(anyKnight.filter(k => said(k) === least), rnd);
    };
    /* Never the same sentence twice: it adds nothing, and reads as a slip —
       whoever says it, since past the first stage nobody is named and two
       knights saying one thing would print one line twice. */
    const say = (speaker: number, fact: Fact) => {
        if (statements.some(st => JSON.stringify(st.fact) === JSON.stringify(fact))) return;
        statements.push({ speaker, fact, ...(space ? { space } : {}) });
    };

    /* Places: a tree out from the Post, each at an hour of its own. */
    const order = shuffle(Array.from({ length: n }, (_, i) => i), rnd), placed: number[] = [POST];
    /* Half the time a place shares its hour and speaker with the one before it
       in the chain, so the two can be said in one sentence. */
    const placedBy = new Map<number, { hour: number; speaker: number }>();
    for (const x of order) {
        const y = rnd() < 0.3 ? POST : pick(placed, rnd);
        const chained = placedBy.get(y) && rnd() < 0.5 ? placedBy.get(y)! : null;
        const hour = chained ? chained.hour : int(rnd, 1, FIRST_HOURS), speaker = chained ? chained.speaker : share();
        placedBy.set(x, { hour, speaker });
        let delta = displacement(axes, thingAt(world, x, hour), thingAt(world, y, hour));
        /* Relative to a thing of the other kind, said as it reckons. */
        if (world.frames && otherKind(axes, thingAt(world, y, hour))) delta = reckon(world.frames, delta);
        /* Sometimes the time gap as local clocks read it, one step later per
           step clockwise round east–west. */
        const local = axes.length > TIME && rnd() < 0.3;
        if (local) delta[TIME] = localTime(axes, delta, thingAt(world, x, hour), thingAt(world, y, hour));
        /* Now and then the gap on one line given by another's: "as many above as north". */
        const lines = lineAxes(axes).filter(i => delta[i] !== 0 && !(local && i === TIME));
        const pairs = lines.flatMap(a => lines.filter(b => b > a && Math.abs(delta[b]) === Math.abs(delta[a])).map(b => [a, b] as [number, number]));
        const bridge = pairs.length && rnd() < 0.6 ? { bridge: pick(pairs, rnd) } : {};
        say(speaker, { kind: "place", hour, x, y, delta, ...bridge, ...(local ? { local: true } : {}) });
        placed.push(x);
    }
    /* Paces, for whatever moves. */
    for (let x = 0; x < n; x++) if (world.start[x].vel.some(v => v !== 0)) say(share(), { kind: "pace", x, vel: [...world.start[x].vel] });

    /* Where everyone stands, outside the brackets, from a knight: the thing
       they stand in, and, on the smaller cards or half the time, which way they
       face. A heading left out is worked out from what they say they see. A
       speaker the claims leave open always has theirs said, since their views
       are what unmasks them. */
    const obs = space === 0 ? world.observers : undefined;
    if (obs) obs.forEach((o, who) => {
        const faced = axes.length <= 4 || !firsts.includes(who) || rnd() < 0.5;
        say(share(), { kind: "stands", who, host: o.host, ...(faced ? { facing: o.facing } : {}),
            ...(o.twin ? { twin: true } : {}), ...(o.upside ? { upside: true } : {}) });
    });

    /* Everything that makes the world comes from knights: the card past its
       first stage keeps only what knights said, and has to pin the world down
       with that. A knave's word on a length or an event would go with them.
       (An unsettled speaker's word on either would also leave every report
       that was to unmask them unreadable; allowed to anyone, nine cards in
       ten deadlocked.) */
    for (const e of world.events) say(share(), { kind: "event", hour: e.hour, t: e.t });
    /* Lengths. Some are stated: a knight gives several of a thing's lengths in
       one sentence, leaving the rest out. The rest are told other ways, one
       statement at a time, while the card still allows a wrong set of lengths
       — each the one, of a few dozen drawn, that rules out the most wrong
       readings: how two stretches lie, which of two things is the longer, or
       a knave's length, which rules out only what it names. */
    const ids = Array.from({ length: n }, (_, k) => k);
    /* All but at most one line each: one length to work out per thing keeps
       what a card leaves open to a few hundred readings, where every line open
       was tens of thousands and a seven-axis card took a minute to build. */
    /* One length, of one thing, may be left open on purpose: told about no
       more than to narrow it, never to settle it — what is asked then has to
       follow however it falls, or be asked as what could be. */
    const openThing = leaveOpen ? int(rnd, 0, n - 1) : -1;
    let openLine = -1;
    for (let x = 0; x < n; x++) {
        const lines = lineAxes(axes), open = x === openThing || rnd() < 0.8 ? pick(lines, rnd) : -1;
        if (x === openThing) openLine = open;
        const told = lines.filter(a => a !== open);
        if (told.length) say(share(), { kind: "sizes", x, lens: told.map(a => [a, world.start[x].size[a]] as [number, number]) });
    }
    /* A reading that differs from the world only in that one length is not wrong. */
    /* Every knight says what they see from where they stand, outside the
       brackets: the reasoning from someone's place and heading is the point of
       having speakers stand anywhere, and one voice gave it one viewpoint. Of
       something they do not stand in, and not the thing whose length is left
       open, which a view would settle. */
    if (obs) for (const k of anyKnight) {
        const seeable = ids.filter(x => x !== obs[k].host && x !== openThing);
        if (!seeable.length) continue;
        const x = pick(seeable, rnd), hour = int(rnd, 1, FIRST_HOURS);
        say(k, { kind: "view", hour, who: k, x, seen: seenFrom(axes, thingAt(world, obs[k].host, hour), thingAt(world, x, hour), obs[k]) });
    }
    const onlyOpen = (st: Array<Body | null>) => openThing >= 0 && st.every((b, x) => b && (x === openThing
        ? sameBody({ ...b, size: b.size.map((l, a) => (a === openLine ? world.start[x].size[a] : l)) }, world.start[x])
        : sameBody(b, world.start[x])));
    /* The world is read with every kind known: from the second stage on, it is. */
    const known = types;
    const hourly = new WeakMap<Array<Body | null>, Map<number, Body | null>>();
    /* The world's own bodies by the hour, for the reports that look at every hour. */
    const seenAt = new Map<number, Body>();
    const truly = (k: number, h: number) => {
        const key = k * 100 + h;
        if (!seenAt.has(key)) seenAt.set(key, thingAt(world, k, h));
        return seenAt.get(key)!;
    };
    for (let guard = 0; ; guard++) {
        const sols = worlds({ axes, things: n, speakers: S, statements, ...(world.frames ? { frames: world.frames } : {}) }, known, space);
        const wrong = sols.filter(st => !st.every((b, x) => b && sameBody(b, world.start[x])) && !onlyOpen(st));
        /* The readings left open on purpose, which no statement may rule out. */
        const kept = sols.filter(st => onlyOpen(st) && !st.every((b, x) => b && sameBody(b, world.start[x])));
        if (sols.length && !wrong.length) break;
        if (!sols.length || guard >= 6 * n) return null;
        /* Bodies by the hour, worked out once a reading: a meeting is looked for
           at every hour of the day, and each of those ran the clock from 0. */
        const bodyIn = (st: Array<Body | null>, k: number, h: number) => {
            let m = hourly.get(st);
            if (!m) hourly.set(st, (m = new Map()));
            const key = k * 100 + h;
            if (!m.has(key)) m.set(key, st[k] ? bodyAt(axes, st[k]!, world.events, h, undefined, k) : null);
            return m.get(key)!;
        };
        const s = share();
        let best: Fact | null = null, bestKills = 0;
        for (let g = 0; g < 96; g++) {
            const x = int(rnd, 0, n - 1), y = pick(ids.filter(k => k !== x), rnd);
            const a = pick(lineAxes(axes), rnd), hour = int(rnd, 1, FIRST_HOURS);
            /* The hour two first meet tells lengths too: stretches meet where points would not. */
            const form = pick(obs ? ["rel", "rel", "cmp", "size", "view", "view", "meet"] : ["rel", "rel", "cmp", "size", "meet"], rnd);
            /* A speaker's view is their own, of something they do not stand in. */
            if (form === "view" && obs![s].host === x) continue;
            /* What the statement says in each reading, the true one first. */
            const value = (st: Array<Body | null> | null): string | number | null => {
                if (form === "meet") {
                    const h = firstMeet(axes, (k, t) => bodyIn(st ?? world.start, k, t), x, y, LAST_HOUR);
                    return h === undefined ? null : h ?? -1;
                }
                const bx = st ? bodyIn(st, x, hour) : thingAt(world, x, hour), by = st ? bodyIn(st, y, hour) : thingAt(world, y, hour);
                if (!bx || !by) return null;
                if (form === "rel") return intervalRel(bx, by, a);
                if (form === "cmp") return compareLengths(bx.size[a], by.size[a]);
                if (form === "view") {
                    const from = st ? bodyIn(st, obs![s].host, hour) : thingAt(world, obs![s].host, hour);
                    return from ? JSON.stringify(seenFrom(axes, from, bx, obs![s])) : null;
                }
                return (st ? st[x]!.size[a] : world.start[x].size[a]);
            };
            if (form === "size" && types[s] && rnd() < 0.7) continue;
            /* A meeting is said only as the hour it happens, and never at the start:
               checked before the wrong readings are, since most pairs never meet. */
            const truth = value(null);
            if (form === "meet" && (typeof truth !== "number" || truth < 1)) continue;
            const there = wrong.map(value);
            /* A knight says how it is, or now and then denies how a wrong reading
               has it; a knave says how a wrong reading has it, or denies the truth. */
            const denied = form !== "view" && form !== "meet" && rnd() < 0.25;
            const others = there.filter(r => r !== null && r !== truth);
            const said = types[s] === denied ? pick(others, rnd) : truth;
            if (said === null || said === undefined) continue;
            /* So from the speaker in every reading left open, or it settles what was to stay open. */
            if (kept.some(st => ((value(st) === said) !== denied) !== types[s])) continue;
            /* A reading is ruled out where it makes the statement's claim come out other than the speaker's type does. */
            const kills = there.filter(r => ((r === said) !== denied) !== types[s]).length;
            if (kills <= bestKills) continue;
            bestKills = kills;
            const plain: Fact = form === "rel" ? { kind: "rel", hour, x, y, axis: a, rel: said as IntervalRel }
                : form === "cmp" ? { kind: "cmp", hour, x, y, axis: a, cmp: said as Cmp }
                : form === "view" ? { kind: "view", hour, who: s, x, seen: JSON.parse(said as string) as Seen }
                : form === "meet" ? { kind: "meet", x, y, hour: said as number }
                : { kind: "size", x, axis: a, len: said as number };
            best = denied ? { kind: "not", f: plain } : plain;
        }
        if (!best) return null;
        say(s, best);
    }
    /* And outside the brackets one report more from a knight, in one of the
       forms nothing above needs — what they see, steps in all, a ranked list,
       a ring's reach, the hour two first meet or draw level — so every form
       of the world turns up. True, since a knight says it. Preferably on an
       axis where the pair moves apart and one of them has a length, so that
       ignoring the motion or the lengths misreads it. */
    /* On a card meant to leave a length open, only in a form no length bears
       on — a ring's reach, steps apart, a ranked list, drawing level — since
       the others would as often as not settle it. */
    const reporters = space === 0 ? [share()] : [];
    const startOf = (k: number) => (k === POST ? { vel: axes.map(() => 0), size: axes.map(() => 1) } : world.start[k]);
    const telling = (x: number, y: number, a: number) =>
        startOf(x).vel[a] !== startOf(y).vel[a] && (startOf(x).size[a] > 1 || startOf(y).size[a] > 1);
    for (const i of reporters) {
        const hour = int(rnd, 1, FIRST_HOURS);
        const pairs: Array<[number, number, number]> = [];
        for (let x = 0; x < n; x++) for (const y of Array.from({ length: n }, (_, k) => k)) {
            if (y !== x) for (const a of lineAxes(axes)) pairs.push([x, y, a]);
        }
        /* The second report about some other pair or line than the first, so the
           two are never one sentence twice. */
        const fresh = pairs.filter(([x, y, a]) => !statements.some(st => st.speaker === i && st.fact.kind === "rel"
            && st.fact.x === x && st.fact.y === y && st.fact.axis === a));
        const good = fresh.filter(([x, y, a]) => telling(x, y, a));
        const [x, y, a] = pick(good.length && rnd() < 0.85 ? good : fresh, rnd);
        /* Every knight already says what they see (above), so the report is in
           another form — drawn evenly among those the card allows. Stacked dice
           starved whichever form came last each time another was added. */
        const bx = thingAt(world, x, hour), by = thingAt(world, y, hour);
        const at = (k: number, h: number) => (k === POST ? thingAt(world, POST, h) : truly(k, h));
        const wrongHour = (h: number) => pick(Array.from({ length: LAST_HOUR }, (_, k) => k + 1).filter(k => k !== h), rnd);
        const rels = ["before", "after", "overlaps", "within", "spans", "identical"] as const;
        const forms: Record<string, () => Fact | null> = {
            /* Where time is a line, whether a ring from one reaches the other by
               its time: just as it arrives, or only after. */
            signal: () => {
                if (axes[TIME]?.kind !== "line") return null;
                const ring = (p: number, q: number) => {
                    const bp = thingAt(world, p, hour), bq = thingAt(world, q, hour);
                    const late = bp.pos[TIME] - bq.pos[TIME], far = spaceSteps(axes, bp, bq);
                    return late === far ? "at" : late > far ? "after" : null;
                };
                const sayable = ids.flatMap(p => ids.filter(q => q !== p).map(q => [p, q] as [number, number]))
                    .filter(([p, q]) => ring(p, q) !== null);
                if (!sayable.length) return null;
                const [p, q] = pick(sayable, rnd), truth = ring(p, q)!;
                return { kind: "signal", hour, x: p, y: q, mode: types[i] ? truth : truth === "at" ? "after" : "at" };
            },
            /* The hour one first draws level with another along a line. */
            level: () => {
                const level = pairs.map(([p, q, b]) => [p, q, b, firstLevel(at, p, q, b, LAST_HOUR)] as const)
                    .filter(([, , , h]) => typeof h === "number" && h >= 1);
                if (!level.length) return null;
                const [p, q, b, first] = pick(level, rnd);
                return { kind: "level", x: p, y: q, axis: b, hour: types[i] ? first! : wrongHour(first!) };
            },
            /* The hour two first meet, sharing ground — most pairs never do. A
               knave names an hour they do not. */
            meet: () => {
                if (leaveOpen) return null;
                const meeting = ids.flatMap(p => ids.filter(q => q > p).map(q => [p, q, firstMeet(axes, at, p, q, LAST_HOUR)] as const))
                    .filter(([, , h]) => typeof h === "number" && h >= 1);
                if (!meeting.length) return null;
                const [p, q, first] = pick(meeting, rnd);
                return { kind: "meet", x: p, y: q, hour: types[i] ? first! : wrongHour(first!) };
            },
            /* Steps in all — false from a knave by a little. */
            total: () => {
                const steps = stepsBetween(axes, bx, by);
                return { kind: "total", hour, x, y, steps: types[i] ? steps : Math.max(0, steps + pick([-2, -1, 1, 2], rnd)) };
            },
            /* A ranked list; a knave's has two neighbours the wrong way round. */
            ranked: () => {
                if (n < 3) return null;
                const by2 = pick(lineAxes(axes).filter(b => b !== a), rnd) ?? a;
                const order = rankBy(axes, world.start.map((_, k) => thingAt(world, k, hour)), ids, [a, by2]);
                if (!order) return null;
                const said = [...order];
                if (!types[i]) { const j = int(rnd, 0, said.length - 2); [said[j], said[j + 1]] = [said[j + 1], said[j]]; }
                return { kind: "ranked", hour, by: [a, by2], order: said };
            },
            /* A denial is checkable too: a knight denies a way they do not lie, a knave the way they do. */
            notRel: () => {
                if (leaveOpen) return null;
                const truth = intervalRel(bx, by, a);
                return { kind: "not", f: { kind: "rel", hour, x, y, axis: a, rel: types[i] ? pick(rels.filter(q => q !== truth), rnd) : truth } };
            },
            rel: () => {
                if (leaveOpen) return null;
                const truth = intervalRel(bx, by, a);
                return { kind: "rel", hour, x, y, axis: a, rel: types[i] ? truth : pick(rels.filter(q => q !== truth), rnd) };
            },
        };
        /* Tried in a shuffled order, so each form that fits is equally likely —
           but a ring's reach and a meeting first, the two a card can seldom say
           at all: drawn evenly with the rest, each shipped on one card in thirty. */
        const rare = ["signal", "meet"];
        const order = [...shuffle(rare, rnd), ...shuffle(Object.keys(forms).filter(k => !rare.includes(k)), rnd)].map(k => forms[k]);
        for (const form of order) {
            const fact = form();
            if (fact) { say(i, fact); break; }
        }
    }
    return statements;
}

/* ------------------------------------------------------------------ *
 * The checks                                                          *
 * ------------------------------------------------------------------ */

const sameWorld = (a: World, b: World) =>
    a.start.length === b.start.length && a.start.every((x, i) => sameBody(x, b.start[i]))
    && a.events.length === b.events.length
    && a.events.every(e => b.events.some(f => f.hour === e.hour && canonicalT(f.t) === canonicalT(e.t)));

/**
 * The question put to the one speaker the first stage leaves unsaid: yes-or-no
 * questions about the world, some of which the first stage's words settle —
 * those are the ones whose answer tells a knight from a knave — and the one
 * that was asked, answered.
 */
export interface Asking {
    who: number;
    /** A fact to ask whether it is so. Never "Are you a knight?": both kinds say yes, so it
       was a free wrong answer every player saw through, and only took a slot. */
    options: Array<{ fact: Fact; tells: boolean }>;
    /** The speaker's answer to a question that tells: the fact, or the fact denied. */
    answer: Statement;
}

/** A world, the card that pins it down, and the reading of that card. */
interface Base {
    world: World;
    /** The space inside the brackets, on a nested card. */
    inner?: World;
    /** Everything said, the first stage's words and the answer among them. */
    card: Card;
    /** The first stage: the words that tell the speakers apart, and nothing else. */
    words: Statement[];
    asking: Asking;
    /** From the second stage on: the knights' words that make the world. */
    plain: Card;
    types: boolean[];
    firsts: number[];
    /** The reading of `plain`, with the kinds known. */
    rec: Reconstruction;
}

/**
 * Questions for the asked speaker: some the words settle, some they cannot —
 * a place nobody has given at that hour, how two stretches lie, where two
 * things first meet, what happens at an hour (when that is not settled), or
 * whether they are a knight — and the answer to one that tells.
 */
function makeAsking(world: World, types: boolean[], who: number, words: Statement[], rnd: () => number): Asking | null {
    const axes = world.axes, n = world.start.length, ids = Array.from({ length: n }, (_, k) => k);
    /* What the words leave standing: the truth, and readings with the asked speaker the other kind. */
    const standing = Array.from({ length: 1 << types.length }, (_, m) => types.map((_, i) => (m & (1 << i)) !== 0))
        .filter(t => !wordBreach(axes, n, words, t));
    /* A question tells when, whichever way the asked speaker answers, every reading still standing has them one kind. */
    const settles = (f: Fact) => [f, { kind: "not", f } as Fact].every(a => {
        const kinds = new Set(standing.filter(t => !wordBreach(axes, n, [...words, { speaker: who, fact: a }], t)).map(t => t[who]));
        return kinds.size <= 1;
    });
    const tells: Fact[] = [], blind: Fact[] = [];
    /* The topics the words speak of: only there can a question be settled — and
       best those spoken of by someone every open reading has the same kind,
       whose word pins the same thing in all of them. */
    const fixed = types.map((_, i) => standing.every(t => t[i] === types[i]));
    const topics = (ws: Statement[]) => ws.map(st => wordIn(st.fact)?.f).filter((f): f is NonNullable<typeof f> => !!f);
    const anchored = topics(words.filter(st => fixed[st.speaker]));
    const spoken = anchored.length && rnd() < 0.8 ? anchored : topics(words);
    for (let g = 0; g < 160 && (tells.length < 3 || blind.length < 4); g++) {
        const x = pick(ids, rnd), y = pick(ids.filter(k => k !== x), rnd), h = int(rnd, 1, FIRST_HOURS);
        const r = rnd();
        let f: Fact;
        /* Most of the time a topic spoken of, asked another way or of another value. */
        const on = spoken.length && rnd() < 0.65 ? pick(spoken, rnd) : null;
        const off = (v: number[]) => { const o = [...v], a = pick(axes.map((ax, i) => (ax.kind === "parity" ? -1 : i)).filter(i => i >= 0), rnd); o[a] = pick([-1, 0, 1].filter(u => u !== v[a]), rnd); return o; };
        if (on?.kind === "pace" || on?.kind === "pacelike") {
            const px = on.x, v = world.start[px].vel;
            f = rnd() < 0.5 ? { kind: "pace", x: px, vel: rnd() < 0.5 ? [...v] : off(v) }
                : { kind: "pacelike", x: px, y: on.kind === "pacelike" ? on.y : y === px ? x : y, sign: rnd() < 0.6 ? 1 : -1 };
        } else if (on?.kind === "place") {
            const d = displacement(axes, thingAt(world, on.x, on.hour), thingAt(world, POST, on.hour));
            if (rnd() < 0.5) { const a = pick(lineAxes(axes), rnd); d[a] += pick([1, -1], rnd); }
            f = { kind: "place", hour: on.hour, x: on.x, y: POST, delta: d };
        } else if (on?.kind === "event") {
            const opp = TRANSFORMS[on.t.id].opposite?.(on.t);
            f = { kind: "event", hour: on.hour, t: opp && rnd() < 0.5 ? opp : on.t };
        }
        else if (r < 0.25) f = { kind: "pace", x, vel: rnd() < 0.6 ? [...world.start[x].vel] : off(world.start[x].vel) };
        else if (r < 0.4) f = { kind: "pacelike", x, y, sign: rnd() < 0.6 ? 1 : -1 };
        else if (r < 0.6) f = { kind: "place", hour: h, x, y: POST, delta: displacement(axes, thingAt(world, x, h), thingAt(world, POST, h)) };
        else if (r < 0.75) f = { kind: "rel", hour: h, x, y, axis: pick(lineAxes(axes), rnd), rel: intervalRel(thingAt(world, x, h), thingAt(world, y, h), pick(lineAxes(axes), rnd)) };
        else if (r < 0.9) f = { kind: "meet", x, y, hour: h };
        else if (world.events.length) { const e = pick(world.events, rnd); f = { kind: "event", hour: e.hour, t: e.t }; }
        else continue;
        const key = JSON.stringify(f);
        if ([...tells, ...blind].some(o => JSON.stringify(o) === key) || words.some(w => JSON.stringify(w.fact) === key)) continue;
        if (settles(f)) { if (tells.length < 3) tells.push(f); }
        else if (blind.length < 4) blind.push(f);
    }
    if (!tells.length || !blind.length) return null;
    /* Four questions, one to three that tell. */
    const k = int(rnd, 1, Math.min(3, tells.length, 3));
    const options = shuffle([...tells.slice(0, k).map(fact => ({ fact, tells: true })),
        ...shuffle(blind, rnd).slice(0, 4 - k).map(fact => ({ fact, tells: false }))], rnd);
    /* The answer to one that tells: the fact as it is from a knight, the other way from a knave
       — and never one that contradicts what the asked speaker has already said. */
    const view = { axes, at: (x: number, h: number) => thingAt(world, x, h), start: (x: number) => (x === POST ? thingAt(world, POST, 0) : world.start[x]),
        observer: () => null, eventsKnownThrough: () => true, events: () => world.events, types };
    const answers = options.filter(o => o.tells).map(o => {
        const truth = holds(o.fact, view);
        return truth === null ? null : { speaker: who, fact: truth === types[who] ? o.fact : { kind: "not", f: o.fact } as Fact };
    }).filter((a): a is Statement => !!a && !selfContradicts(axes, [...words, a], who));
    if (!answers.length) return null;
    return { who, options, answer: pick(answers, rnd) };
}

/**
 * The first stage's words less every one that changes nothing: a word goes
 * when, without it, each guess at the kinds stands or falls as it did — on
 * the words alone, and with either answer to each question offered. "Not so:
 * Chest moves opposite to Hammer" beside Chest's pace and nothing pinning
 * Hammer's could never clash with anything, and only made the card longer.
 * The asked speaker keeps a word, so their kind stays tied to the others'.
 */
export function pruneWords(axes: Axis[], n: number, words: Statement[], speakers: number, asking: Pick<Asking, "who" | "options">, rnd: () => number): Statement[] {
    const guesses = Array.from({ length: 1 << speakers }, (_, m) => Array.from({ length: speakers }, (_, i) => (m & (1 << i)) !== 0));
    const asks: Statement[][] = [[], ...asking.options.flatMap(o => [o.fact, { kind: "not", f: o.fact } as Fact])
        .map(fact => [{ speaker: asking.who, fact }])];
    const sign = (ws: Statement[]) => asks.map(a => guesses.map(t => (wordBreach(axes, n, [...ws, ...a], t) ? 1 : 0)).join("")).join("|");
    const whole = sign(words);
    let kept = words;
    for (const w of shuffle(words, rnd)) {
        const rest = kept.filter(k => k !== w);
        if (w.speaker === asking.who && !rest.some(k => k.speaker === asking.who)) continue;
        if (sign(rest) === whole) kept = rest;
    }
    return kept;
}

function makeBase(opts: BuildOptions, rnd: () => number): Base | null {
    clearReaderCache();
    const axes = makeAxes(rnd, opts.dims ?? 7);
    const start = Array.from({ length: opts.things }, () => makeBody(axes, rnd));
    const frames = makeFrames(axes, rnd, opts.kinds);
    const world: World = { axes, start, events: makeEvents(axes, rnd, undefined, start), ...(frames ? { frames } : {}) };
    /* Every speaker stands in a thing and faces one of four ways — each in a
       thing of their own where there are things enough, so that past the
       first stage, where nobody is named, a view is told by where it is seen
       from: "from Driver, facing west". */
    /* Now and then a mirror twin, or one hanging head down. */
    const grounds = shuffle(Array.from({ length: opts.things }, (_, i) => i), rnd);
    world.observers = Array.from({ length: opts.speakers }, (_, who) => ({
        host: grounds[who % grounds.length], facing: int(rnd, 0, 3),
        ...(rnd() < 0.2 ? { twin: true } : {}), ...(rnd() < 0.2 ? { upside: true } : {}),
    }));
    /* One speaker says nothing until asked; the rest tell each other apart,
       and at least one of them is a knight, since knights make the world. */
    const types = Array.from({ length: opts.speakers }, () => rnd() < 0.5);
    const asked = int(rnd, 0, opts.speakers - 1);
    const firsts = Array.from({ length: opts.speakers }, (_, i) => i).filter(i => i !== asked);
    if (!firsts.some(i => types[i])) types[pick(firsts, rnd)] = true;
    /* Two knights at least, so the world has two voices once the knaves' words go. */
    while (opts.speakers > 2 && types.filter(Boolean).length < 2) types[pick(types.map((t, i) => (t ? -1 : i)).filter(i => i >= 0), rnd)] = true;
    /* Nested on most cards: a second space in brackets, the same things in
       the same kind of space, arranged, sized, moving and turned apart. */
    const nested = opts.nested ?? rnd() < 0.75;
    const inner: World | undefined = nested
        ? (s => ({ axes, start: s, events: makeEvents(axes, rnd, undefined, s), ...(frames ? { frames } : {}) }))(Array.from({ length: opts.things }, () => makeBody(axes, rnd)))
        : undefined;
    /* Now and then a card that leaves a length open, where there are enough things to ask what could be. */
    const leaveOpen = opts.things >= 4 && (opts.open ?? rnd() < 0.7);
    /* The words first: they cost little, and a world they will not go on is
       given up before its premises, which cost far more, are made. */
    /* The first stage: the words that tell the speakers apart, and nothing else. */
    const drafted = puzzleWords(world, types, types.map((_, i) => i), rnd, asked);
    if (!drafted) return null;
    const asking = makeAsking(world, types, asked, drafted, rnd);
    if (!asking) return null;
    const extra = pruneWords(world.axes, world.start.length, drafted, types.length, asking, rnd);
    const outside = makeCard(world, types, firsts, rnd, 0, leaveOpen);
    const inside = inner ? makeCard(inner, types, firsts, rnd, 1) : [];
    if (!outside || !inside) return null;
    const words = shuffle([...extra, asking.answer], rnd);
    const style = { compact: rnd() < 0.4, wide: rnd() < 0.7 };
    const plain: Card = {
        axes, things: opts.things, speakers: opts.speakers, statements: shuffle([...outside, ...inside], rnd), style,
        ...(frames ? { frames } : {}),
    };
    /* Everything said, each sentence once: a word of the first stage may be a knight's word on the world too. */
    const once = (st: Statement) => !plain.statements.some(o => o.speaker === st.speaker && JSON.stringify(o.fact) === JSON.stringify(st.fact) && !o.space);
    const card: Card = { ...plain, statements: [...plain.statements, ...[...extra, asking.answer].filter(once)] };
    /* The words alone settle everyone, the answer included. */
    const settled = settleTypes({ ...plain, statements: words });
    if (types.some((t, i) => settled.get(i) !== t)) return null;
    const rec = read(plain, FULL, types);
    if (!rec) return null;
    /* The world itself among those the card allows, and the reading's world taken to be it. */
    const truth = (rec.alternatives ?? [rec.world]).find(a => sameWorld(a, world));
    if (!truth) return null;
    rec.world = truth;
    if (inner && (!rec.inner || !sameWorld(rec.inner, inner))) return null;
    return { world, ...(inner ? { inner } : {}), card, words, asking, plain, types, firsts, rec };
}

/** One question with its answer, and what each way of going wrong answers instead. */
export interface Stage {
    kind: QuestionKind;
    ask: Ask;
    answer: Answer;
    /** What each shortcut reading answers: never the answer. */
    shortcuts: Record<string, Answer>;
    /** The part of the world this stage shows, alone: what came before is to be remembered. */
    shown?: Statement[];
    /** The reading of everything shown up to this stage. */
    rec?: Reconstruction;
}

/** Whether two readings agree on every thing a part needs, at every hour, and on how much they leave open. */
function sameReading(a: Reconstruction, b: Reconstruction, need: number[][]): boolean {
    if ((a.alternatives?.length ?? 1) !== (b.alternatives?.length ?? 1)) return false;
    return need.every((ts, sp) => ts.every(t => {
        const wa = sp ? a.inner : a.world, wb = sp ? b.inner : b.world;
        if (!wa?.start[t] || !wb?.start[t]) return false;
        for (let h = 0; h <= LAST_HOUR; h++) if (!sameBody(thingAt(wa, t, h), thingAt(wb, t, h))) return false;
        return true;
    }));
}

/** Whether every thing a question reads is placed where it reads it. */
const placed = (ask: Ask, rec: Reconstruction) =>
    askNeed(ask).every((ts, sp) => ts.every(t => !!(sp ? rec.inner : rec.world)?.start[t]));

/**
 * A question of this kind that the full reading answers and every given wrong
 * reading misses, or null. Questions are cheap once the world and its readings
 * are built, so many are tried against one world before it is given up: a
 * yes-or-no question has every shortcut to beat, and each lands on the right
 * verdict half the time by accident.
 */
function fairStage(
    kind: QuestionKind, base: Base, rec: Reconstruction, wrongs: Array<readonly [string, Reconstruction | null]>,
    rnd: () => number, span?: Span, wantTrue?: boolean, unlike: Ask[] = [],
    among?: number[][], allow?: (ask: Ask) => boolean,
): Stage | null {
    const { world, types } = base, things = world.start.length;
    for (let guard = 0; guard < 400; guard++) {
        const ask = kind.draw(among ? { ...rec, among } : rec, things, types.length, types, rnd, span);
        if (!ask || (allow && !allow(ask)) || unlike.some(u => JSON.stringify({ ...u, options: [] }) === JSON.stringify({ ...ask, options: [] }))) continue;
        const answer = answerFollows(kind, ask, rec);
        if (answer === null) continue;
        /* What could be has to be more than what is: the open length must matter. */
        if (kind.open) {
            const settled = kind.answer(ask, { ...rec, alternatives: undefined });
            if (answerKey(settled) === answerKey(answer) || !(answer as number[]).length || (answer as number[]).length === ask.options!.length) continue;
        }
        if (kind.answerMode === "boolean" && wantTrue !== undefined && answer !== wantTrue) continue;
        const shortcuts: Record<string, Answer> = {};
        let fair = true;
        for (const [name, r] of wrongs) {
            const a = r ? answerFollows(kind, ask, r) : null;
            shortcuts[name] = a;
            if (answerKey(a) === answerKey(answer)) { fair = false; break; }
        }
        /* On a nested card, which side of the brackets each relation is read
           on has to matter: read both on one side, or each on the other, and
           the answer is another. */
        if (fair && rec.inner && ask.s1 !== undefined) {
            const s1 = ask.s1, s2 = ask.s2!;
            for (const [a, b] of [[s1, s1], [s2, s2], [1 - s1, 1 - s2]]) {
                if (a === s1 && b === s2) continue;
                /* On a card shown in parts a side may not have the things yet: that misreading cannot be made at all. */
                const swapped = { ...ask, s1: a, s2: b };
                const other = placed(swapped, rec) ? answerFollows(kind, swapped, rec) : null;
                shortcuts[`spaces ${a}${b}`] = other;
                if (answerKey(other) === answerKey(answer)) { fair = false; break; }
            }
        }
        if (fair) return { kind, ask, answer, shortcuts };
    }
    return null;
}

/* Forgetting the kinds is a shortcut only on a card that has them; trusting
   everyone, only on one where somebody lies — past the first stage, with the
   kinds known and only knights left on the card, nobody does. */
const shortcutReads = (card: Card, known?: boolean[], need?: number[][]) => Object.entries(SHORTCUTS)
    .filter(([name]) => (name !== "kinds" || card.frames) && (name !== "liars" || !known)
        /* Nor headings, on a card where nobody says what they see. */
        && (name !== "perspective" || card.statements.some(s => s.fact.kind === "view")))
    .map(([name, r]) => [name, read(card, r, known, need)] as const);

/**
 * The world card less what the rest of it already says, read to the same
 * world. Any view, relation or report the card reads the same without goes:
 * a view restating where a thing is, from a speaker whose facing is given,
 * made the reader check it and told them nothing, and the report of steps
 * apart or a ranked list was there so every form turned up, not because a
 * question needed it. Then where a speaker stands, if nothing is seen from
 * there. Last, a thing's lengths in one line, where they took two.
 *
 * Lengths stay as given. Taken out where a view would pin them instead, the
 * card read the same, but a reading with a length unpinned searches every
 * length on seven axes before it fails, and an item took half a minute.
 */
function lean(plain: Card, rec: Reconstruction, types: boolean[], rnd: () => number): Card {
    const alts = (r: Reconstruction) => r.alternatives?.length ?? 1;
    const same = (statements: Statement[]) => {
        const r = read({ ...plain, statements }, FULL, types);
        return !!r && alts(r) === alts(rec) && sameWorld(r.world, rec.world) && (!rec.inner || (!!r.inner && sameWorld(r.inner, rec.inner)));
    };
    let kept = plain.statements;
    /* Views, relations and reports the card reads the same without. */
    const skeleton = new Set<Fact["kind"]>(["place", "pace", "event", "stands", "sizes", "size"]);
    for (const st of shuffle(kept.filter(k => !skeleton.has(k.fact.kind)), rnd)) {
        const next = kept.filter(k => k !== st);
        if (same(next)) kept = next;
    }
    /* Where a speaker stands, only where something is seen from there. */
    kept = kept.filter(st => st.fact.kind !== "stands"
        || kept.some(v => v.fact.kind === "view" && v.fact.who === (st.fact as { who: number }).who && (v.space ?? 0) === (st.space ?? 0)));
    /* A thing's lengths in one line. */
    const merged: Statement[] = [];
    for (const st of kept) {
        const f = st.fact;
        if (f.kind !== "size" && f.kind !== "sizes") { merged.push(st); continue; }
        const lens: Array<[number, number]> = f.kind === "size" ? [[f.axis, f.len]] : f.lens;
        const into = merged.find(m => m.fact.kind === "sizes" && m.fact.x === f.x && (m.space ?? 0) === (st.space ?? 0));
        if (!into) { merged.push({ ...st, fact: { kind: "sizes", x: f.x, lens: [...lens] } }); continue; }
        const g = into.fact as Extract<Fact, { kind: "sizes" }>;
        for (const l of lens) if (!g.lens.some(m => m[0] === l[0])) g.lens.push(l);
        g.lens.sort((a, b) => a[0] - b[0]);
    }
    return { ...plain, statements: merged };
}

/** The things a fact is about, besides the origin; all of a ranked list. */
function thingsOf(f: Fact): number[] {
    switch (f.kind) {
        case "not": return thingsOf(f.f);
        case "ranked": return f.order;
        case "event": return f.t.who === undefined ? [] : [f.t.who];
        case "stands": return [f.host];
        case "type": return [];
        default: return ("y" in f ? [f.x, f.y] : [f.x]).filter(t => t !== POST);
    }
}

/** A part of the world card: some things on one side of the brackets, and what is said of them. */
export interface Part { space: number; things: number[]; statements: Statement[] }

/**
 * The world card in parts: outside the brackets first, then inside; on each
 * side the things in the order the places reach them from the origin, three
 * first where there are five or more and then two at a time, a lone last one
 * joining the ones before. A sentence goes in the part
 * of the latest thing it names — a view, of the thing seen or the ground it
 * is seen from — so each part is read on what came before it.
 */
export function partsOf(card: Card, n: number): Part[] {
    const parts: Part[] = [];
    for (const sp of card.statements.some(st => st.space === 1) ? [0, 1] : [0]) {
        const here = card.statements.filter(st => (st.space ?? 0) === sp);
        const order: number[] = [], placed = new Set<number>([POST]);
        for (let grew = true; grew;) {
            grew = false;
            for (const { fact: f } of here) {
                if (f.kind !== "place") continue;
                const next = placed.has(f.y) && !placed.has(f.x) ? f.x : placed.has(f.x) && !placed.has(f.y) ? f.y : null;
                if (next !== null) { order.push(next); placed.add(next); grew = true; }
            }
        }
        for (let x = 0; x < n; x++) if (!placed.has(x)) order.push(x);
        /* Three first where there are five or more, so the first part has a question of its own to ask; then two at a time. */
        const groups: number[][] = [order.slice(0, order.length >= 5 ? 3 : 2)];
        for (let i = groups[0].length; i < order.length; i += 2) groups.push(order.slice(i, i + 2));
        if (groups.length > 1 && groups[groups.length - 1].length === 1) groups[groups.length - 2].push(...groups.pop()!);
        const from = parts.length;
        for (const g of groups) parts.push({ space: sp, things: g, statements: [] });
        const groupOf = (t: number) => Math.max(0, groups.findIndex(g => g.includes(t)));
        for (const st of here) {
            const f = st.fact;
            let ts = thingsOf(f);
            if (f.kind === "view") {
                const ground = here.find(o => o.fact.kind === "stands" && o.fact.who === f.who);
                if (ground) ts = [...ts, (ground.fact as { host: number }).host];
            }
            parts[from + (ts.length ? Math.max(...ts.map(groupOf)) : 0)].statements.push(st);
        }
    }
    /* In the order a reader builds the part: what happens, then each thing —
       where, how it moves, how long — then how things lie to each other, then
       who stands where and what they see. Shuffled, a thing's place and its
       pace were ten lines apart. */
    const rank: Partial<Record<Fact["kind"], number>> = { event: 0, place: 1, pace: 2, sizes: 3, size: 3, stands: 5, view: 6 };
    for (const p of parts) {
        const order = new Map(p.things.map((t, i) => [t, i]));
        const key = (st: Statement) => {
            const f = st.fact.kind === "not" ? st.fact.f : st.fact, r = rank[f.kind] ?? 4;
            const t = thingsOf(f).map(x => order.get(x) ?? -1);
            return [r === 1 || r === 2 || r === 3 ? 1 : r, r <= 3 && t.length ? Math.max(...t) : 0, r, f.kind === "event" ? f.hour : 0];
        };
        p.statements.sort((a, b) => { const ka = key(a), kb = key(b); return ka.reduce((d, v, i) => d || v - kb[i], 0); });
    }
    return parts;
}

/**
 * One item, or null when this attempt's world would not make one; callers retry.
 */
export function tryBuild(opts: BuildOptions): Item | null {
    const rnd = opts.rnd ?? Math.random;
    const base = makeBase(opts, rnd);
    if (!base) return null;
    const kinds = opts.kind ? [opts.kind] : fitting(opts);
    const kind = QUESTIONS[pick(kinds, rnd)];
    const stage = fairStage(kind, base, base.rec, shortcutReads(base.plain, base.types), rnd, undefined, rnd() < 0.5);
    if (!stage) return null;
    return { world: base.world, card: base.card, plain: base.plain, types: base.types, ...stage, reconstruction: base.rec };
}

/* ------------------------------------------------------------------ *
 * The staged item                                                     *
 * ------------------------------------------------------------------ */

/**
 * One card asked about in three stages, each needing what the one before
 * settled:
 *
 *   1. who is a knight and who a knave, ticked off speaker by speaker
 *   2. two or three analogies to finish — X is to Y as Z is to which? — read
 *      within the first part of the day
 *   3. one or two transformations announced, later in the day than anything
 *      yet, and two or three analogies to judge true or false across them
 *
 * Every analogy is held to every shortcut, and each judged in the last stage
 * also to the reading that ignores what was just announced: its verdict has to
 * be the other one without the new transformations.
 */
export interface StagedItem {
    world: World;
    /** The card as first shown. */
    card: Card;
    /** The first stage: the words that tell the speakers apart, the answer among them. */
    words: Statement[];
    /** The question put to the speaker the words leave unsaid. */
    asking: Asking;
    /** The card from the second stage on: the knights' words that make the world. */
    plain: Card;
    /** The statements the last stage adds: the transformations, said by someone. */
    later: Statement[];
    types: boolean[];
    reconstruction: Reconstruction;
    /** The reading of the card with the later statements. */
    laterReconstruction: Reconstruction;
    analogies: Stage[];
    judgements: Stage[];
    /**
     * Last, one analogy to build across what was announced: a verdict can be
     * guessed half the time, a point on every dimension cannot, and it is
     * built in the world the announcement changed. None on an easy item.
     */
    closing?: Stage;
    /** Easy: one small world shown whole, and true or false only. */
    easy?: boolean;
}

export function tryBuildStaged(opts: BuildOptions): StagedItem | null {
    const rnd = opts.rnd ?? Math.random;
    const base = makeBase(opts, rnd);
    if (!base) return null;
    /* Once the first stage has told the knights from the knaves, the rest of
       the item is asked on the knights' words that make the world: the
       knaves' are gone, and so are the words that only told who is what. */
    const { world, card, words, asking, types, firsts } = base;
    /* The world card without what repeats what the rest already says. */
    const plain = lean(base.plain, base.rec, types, rnd), rec = read(plain, FULL, types);
    if (!rec) return null;

    /* Stage 2: the world in parts, an analogy to finish on each, in the first
       part of the day. Each part is shown on its own and then taken away: the
       questions on later parts read things from earlier ones, which have to
       be remembered. The whole world on one card ran to fifty lines no one
       could take in, and nearly every line was needed to pin it down. */
    const early: Span = { h1: [1, FIRST_HOURS], h2: [1, FIRST_HOURS] };
    if (opts.open && !rec.alternatives) return null;
    const analogies: Stage[] = [];
    /* Easy: the whole world at once, and two verdicts on it, one each way, in either order. */
    if (opts.easy) {
        /* Three things for up to four speakers: two seen from in one thing would read as one viewer, unnamed. Drawn again. */
        const grounds = plain.statements.filter(st => st.fact.kind === "stands").map(st => (st.fact as { host: number }).host);
        if (new Set(grounds).size !== grounds.length) return null;
        const reads = shortcutReads(plain, types);
        for (const wantTrue of shuffle([true, false], rnd)) {
            const stage = fairStage(QUESTIONS.judge, base, rec, reads, rnd, early, wantTrue, analogies.map(a => a.ask));
            if (!stage) return null;
            /* In the order a reader builds it: one part, since the world is three things on one side. */
            analogies.push({ ...stage, ...(analogies.length ? {} : { shown: partsOf(plain, world.start.length).flatMap(p => p.statements) }), rec });
        }
        return announce(base, plain, rec, analogies, rnd, true);
    }
    /* About the speakers themselves, straight after they are told apart, on the words that told them. */
    if (QUESTIONS.speakers.fits!(opts.things, opts.speakers) && rnd() < 0.5) {
        const stage = fairStage(QUESTIONS.speakers, base, rec, shortcutReads(plain, types), rnd, early);
        if (stage) analogies.push(stage);
    }
    const parts = partsOf(plain, world.start.length);
    let shown: Statement[] = [], pending: Statement[] = [];
    const seen = parts.map(() => false);
    for (let k = 0; k < parts.length; k++) {
        pending = [...pending, ...parts[k].statements];
        seen[k] = true;
        const sofar = [...shown, ...pending], card: Card = { ...plain, statements: sofar };
        const need = [0, 1].map(sp => parts.filter((p, j) => seen[j] && p.space === sp).flatMap(p => p.things));
        const among = need, most = Math.max(...need.map(ts => ts.length));
        const last = k === parts.length - 1, lastOutside = !parts.slice(k + 1).some(p => p.space === 0);
        if (most < 2 && !last) continue;
        const r = read(card, FULL, types, need);
        if (!r) { if (last) return null; continue; }
        /* Something new and, past the first part asked on, something from before. */
        const fresh = new Set(pending.flatMap(st => thingsOf(st.fact).map(t => `${st.space ?? 0}:${t}`)));
        const old = new Set(shown.flatMap(st => thingsOf(st.fact).map(t => `${st.space ?? 0}:${t}`)));
        const allow = (ask: Ask) => {
            const used = askNeed(ask).flatMap((ts, sp) => ts.map(t => `${sp}:${t}`));
            if (!used.every(u => need[+u[0]].includes(+u.slice(2)))) return false;
            return used.some(u => fresh.has(u)) && (!old.size || used.some(u => old.has(u) && !fresh.has(u)));
        };
        /* A shortcut is one only where it misreads the part: ignoring the kinds
           where no place on it is in the other kind's reckoning reads the
           same world, and no question could tell it from the truth. Asked to
           beat it anyway, nine parts in ten found no question at all. The
           stages across the whole world, at the end, still beat every one. */
        const wrongs = shortcutReads(card, types, need).filter(([, w]) => !w || !sameReading(w, r, need));
        const kinds = [...(opts.open && lastOutside && !analogies.some(a => a.kind.open) ? ["could"] : []),
            ...shuffle(["which", "which", "build"], rnd)];
        let stage: Stage | null = null;
        for (const id of kinds) {
            if (id === "which" && most < 3) continue;
            if ((stage = fairStage(QUESTIONS[id], base, r, wrongs, rnd, early, undefined, analogies.map(a => a.ask), among, id === "could" ? undefined : allow))) break;
            if (id === "could") break;
        }
        if (opts.open && lastOutside && !analogies.some(a => a.kind.open) && stage?.kind.id !== "could") { if (last) return null; continue; }
        if (!stage) { if (last) return null; continue; }
        analogies.push({ ...stage, shown: pending, rec: r });
        shown = sofar; pending = [];
    }
    /* One more from memory alone where the world came in a single part. */
    if (analogies.filter(a => a.shown).length < 2) {
        const reads = shortcutReads(plain, types);
        let stage: Stage | null = null;
        for (const id of shuffle(["which", "build"], rnd)) if ((stage = fairStage(QUESTIONS[id], base, rec, reads, rnd, early, undefined, analogies.map(a => a.ask)))) break;
        if (!stage) return null;
        analogies.push({ ...stage, shown: [], rec });
    }

    return announce(base, plain, rec, analogies, rnd, false);
}

/**
 * The last stage: transformations announced after the first part of the day,
 * and analogies judged across them; then, but for easy items, one built.
 */
function announce(base: Base, plain: Card, rec: Reconstruction, analogies: Stage[], rnd: () => number, easy: boolean): StagedItem | null {
    const { world, card, words, asking, types, firsts } = base;
    /* Stage 3: transformations announced, by knights — the knaves are gone by
       then, and nobody is named, so a knave's turn the other way round would
       read as the world's — and analogies judged across them. */
    const knights = firsts.filter(i => types[i]);
    /* A few draws of what to announce before the world is given up: whether a
       verdict turns on the new transformation depends on which one it is. */
    for (let tries = 0; tries < 6; tries++) {
        const added = makeEvents(world.axes, rnd, LATER_HOURS, world.start);
        if (!added.length) continue;
        const later: Statement[] = added.map(e => ({ speaker: pick(knights, rnd), fact: { kind: "event", hour: e.hour, t: e.t } }));
        const whole: World = { ...world, events: [...world.events, ...added] };
        const card2: Card = { ...plain, statements: [...plain.statements, ...later] };
        const rec2 = read(card2, FULL, types);
        if (!rec2 || !sameWorld(rec2.world, whole)) continue;
        const across: Span = { h1: [1, LAST_HOUR], h2: [Math.min(...added.map(e => e.hour)), LAST_HOUR] };
        const reads2 = [...shortcutReads(card2, types), ["announced", rec] as const];
        let judgements: Stage[] = [];
        /* One verdict false and one true, a third either way. Drawn either way
           each, three in four shipped true: a false verdict is fair far less
           often (every shortcut has to make the analogy hold), and a draw that
           found none cut the list short on the true ones before it. */
        for (let k = 0, want = easy ? 2 : int(rnd, 2, 3); k < want; k++) {
            const stage = fairStage(QUESTIONS.judge, base, rec2, reads2, rnd, across, k < 2 ? k === 1 : rnd() < 0.5, judgements.map(j => j.ask));
            if (!stage) break;
            judgements.push(stage);
        }
        if (judgements.length < 2) continue;
        judgements = shuffle(judgements, rnd);
        /* Easy ends on the verdicts; otherwise one built last. */
        if (easy) return { world: whole, card, plain, words, asking, later, types, reconstruction: rec, laterReconstruction: rec2, analogies, judgements, easy };
        const closing = fairStage(QUESTIONS.build, base, rec2, reads2, rnd, across, undefined, [...analogies, ...judgements].map(j => j.ask));
        if (!closing) continue;
        return { world: whole, card, plain, words, asking, later, types, reconstruction: rec, laterReconstruction: rec2, analogies, judgements, closing };
    }
    return null;
}

/**
 * What a card is made of is drawn once, outside the retries, as `build` draws
 * its kind: drawn afresh on each attempt, the parts that build easily shipped
 * far more than their share — a card left open in one item in five where it
 * was meant for most, kinds on a quarter of the cards meant to have them on
 * half.
 */
export function buildStaged(opts: BuildOptions, attempts = 400): StagedItem | null {
    const rnd = opts.rnd ?? Math.random;
    opts = opts.easy
        ? { ...opts, things: Math.min(opts.things, 3), nested: false, open: false, kinds: false }
        : {
            ...opts,
            nested: opts.nested ?? rnd() < 0.75,
            open: opts.open ?? (opts.things >= 4 && rnd() < 0.6),
            kinds: opts.kinds ?? rnd() < 0.5,
        };
    for (let i = 0; i < attempts; i++) {
        const item = tryBuildStaged(opts);
        if (item) return item;
    }
    return null;
}

/** The kinds of question a card of this size can ask. */
export const fitting = (opts: BuildOptions) =>
    Object.keys(QUESTIONS).filter(k => !QUESTIONS[k].open && (QUESTIONS[k].fits?.(opts.things, opts.speakers) ?? true));

/**
 * The kind is drawn once, outside the retries: drawn afresh on each attempt, the
 * kinds that build easily would come up far more than their share.
 */
export function build(opts: BuildOptions, attempts = 400): Item | null {
    const rnd = opts.rnd ?? Math.random;
    const kind = opts.kind ?? pick(fitting(opts), rnd);
    for (let i = 0; i < attempts; i++) {
        const item = tryBuild({ ...opts, kind });
        if (item) return item;
    }
    return null;
}
