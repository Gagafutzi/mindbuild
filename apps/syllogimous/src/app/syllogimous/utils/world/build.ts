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
import { Claim, holds as claimHolds } from "../knaves.utils";
import { Axis, Body, FULL, SHORTCUTS, Seam, sameBody } from "./space";
import { TRANSFORMS, TransformSpec, canTransform } from "./transforms";
import { Fact, LONG, POST, Statement, displacement, intervalRel } from "./facts";
import { Card, Reconstruction, World, read, settleByClaims, thingAt } from "./reader";
import { Answer, Ask, QUESTIONS, QuestionKind, answerKey } from "./questions";

export interface Item {
    world: World;
    card: Card;
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
    /** Ask this kind only; otherwise every kind that fits the card, evenly. */
    kind?: string;
    rnd?: () => number;
}

const RING = 5;
const TIME_RING = 6;
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
    const size = axes.map(() => 1);
    /* One long side or two, but never every line: something has to stay a
       point for "within" and "takes in all of" to come apart. On the smallest
       space, one at most — every long side is a statement on the first card. */
    const longs = lines.length <= 2 ? (rnd() < 0.6 ? 1 : 0) : 1 + Math.floor(rnd() * 2);
    for (const a of shuffle(lines, rnd).slice(0, longs)) size[a] = LONG;
    const vel = axes.map(() => 0);
    /* Round the ring often, so the seams come into it; one or two lines besides,
       or at most one on the smallest space, where every clause is first-card reading. */
    if (rnd() < 0.7) vel[0] = sign(rnd);
    if (axes[3]?.kind === "ring" && rnd() < 0.4) vel[3] = sign(rnd);
    const moving = lines.length <= 2 ? Math.floor(rnd() * 2) : 1 + Math.floor(rnd() * 2);
    for (const a of shuffle(lines, rnd).slice(0, moving)) vel[a] = sign(rnd);
    return { pos, size, vel };
}

function makeEvents(axes: Axis[], rnd: () => number): Array<{ hour: number; t: TransformSpec }> {
    const lines = lineAxes(axes), out: Array<{ hour: number; t: TransformSpec }> = [];
    /* Two only where there is room for them to be told apart from one. */
    const count = axes.length >= 5 && rnd() < 0.5 ? 2 : 1, hours = shuffle([2, 3, 4, 5, 6, 7, 8, 9], rnd).slice(0, count).sort((a, b) => a - b);
    for (const hour of hours) {
        for (let guard = 0; guard < 20; guard++) {
            const id = pick(Object.keys(TRANSFORMS), rnd);
            const t: TransformSpec = { id, axes: shuffle(lines, rnd).slice(0, TRANSFORMS[id].needs) };
            if (id === "rotate") t.k = rnd() < 0.5 ? 1 : 3;
            if (id === "shear") t.k = sign(rnd);
            if (id === "translate") t.k = sign(rnd) * int(rnd, 1, 2);
            if (canTransform(t, axes)) { out.push({ hour, t }); break; }
        }
    }
    return out;
}

/* ------------------------------------------------------------------ *
 * The testimony                                                       *
 * ------------------------------------------------------------------ */

/** Claims among the first speakers that settle exactly them. */
function claimsFor(types: boolean[], firsts: number[], rnd: () => number): Statement[] | null {
    for (let guard = 0; guard < 60; guard++) {
        const out: Statement[] = [];
        for (const i of firsts) {
            for (let g = 0; g < 30; g++) {
                const others = firsts.filter(k => k !== i);
                const r = rnd();
                const claim: Claim = r < 0.35 || !others.length ? { kind: "is", who: i, knight: rnd() < 0.5 }
                    : r < 0.65 ? { kind: "is", who: pick(others, rnd), knight: rnd() < 0.5 }
                    : { kind: rnd() < 0.5 ? "same" : "differ", a: i, b: pick(others, rnd) };
                if (claimHolds(claim, types) === types[i]) { out.push({ speaker: i, fact: { kind: "type", claim } }); break; }
            }
        }
        if (out.length !== firsts.length) continue;
        const settled = settleByClaims({ axes: [], things: 0, speakers: types.length, statements: out });
        if (firsts.every(i => settled.get(i) === types[i])) return out;
    }
    return null;
}

function makeCard(world: World, types: boolean[], firsts: number[], rnd: () => number): Card | null {
    const axes = world.axes, n = world.start.length, S = types.length;
    const knights = firsts.filter(i => types[i]);
    if (!knights.length) return null;
    const statements: Statement[] = [];
    const say = (speaker: number, fact: Fact) => statements.push({ speaker, fact });
    const claims = claimsFor(types, firsts, rnd);
    if (!claims) return null;
    statements.push(...claims);

    /* Places: a tree out from the Post, each at an hour of its own. */
    const order = shuffle(Array.from({ length: n }, (_, i) => i), rnd), placed: number[] = [POST];
    for (const x of order) {
        const y = rnd() < 0.3 ? POST : pick(placed, rnd), hour = int(rnd, 1, LAST_HOUR - 1);
        const delta = displacement(axes, thingAt(world, x, hour), thingAt(world, y, hour));
        say(pick(knights, rnd), { kind: "place", hour, x, y, delta });
        placed.push(x);
    }
    /* Paces, for whatever moves. */
    for (let x = 0; x < n; x++) if (world.start[x].vel.some(v => v !== 0)) say(pick(knights, rnd), { kind: "pace", x, vel: [...world.start[x].vel] });

    const rest = Array.from({ length: S }, (_, i) => i).filter(i => !firsts.includes(i));
    /* Lengths and events come from the speakers the claims settle, knights and
       knaves both. An unsettled speaker's word on a length leaves that thing's
       body unknown, and with it every report about it — including the ones that
       were to unmask that same speaker; on an event it hides every hour after.
       Allowed to anyone, nine cards in ten deadlocked. */
    /* Lengths: every long side is said, by a knight as it is or a knave as a point,
       and a few point sides too, so a knave's "3 long" has to be seen through. */
    for (let x = 0; x < n; x++) for (const a of lineAxes(axes)) {
        const long = world.start[x].size[a] === LONG;
        /* A point side said is a knave's "3 long" to see through, but on the
           smallest spaces it is reading the first card cannot afford. */
        if (!long && (axes.length < 4 || rnd() < 0.8)) continue;
        const s = pick(firsts, rnd);
        say(s, { kind: "size", x, axis: a, long: types[s] ? long : !long });
    }
    /* Events: a knight as they happened, or a knave the other way round where there is one. */
    for (const e of world.events) {
        const opp = TRANSFORMS[e.t.id].opposite?.(e.t);
        const s = opp && rnd() < 0.6 ? pick(firsts, rnd) : pick(knights, rnd);
        say(s, { kind: "event", hour: e.hour, t: types[s] ? e.t : opp! });
    }
    /* Two checkable reports for each speaker nobody else's claims settle: true
       from a knight, false from a knave, at any hour, since everything they are
       judged against comes from settled speakers. Two, because whichever one
       unmasks the speaker, the other is then checked against the world that
       follows, so a shortcut reading that misjudges either finds a contradiction
       instead of quietly unmasking the speaker the same way. Preferably on an
       axis where the pair moves apart and one of them has a length, so that
       ignoring the motion or the lengths does misjudge them. */
    const startOf = (k: number) => (k === POST ? { vel: axes.map(() => 0), size: axes.map(() => 1) } : world.start[k]);
    const telling = (x: number, y: number, a: number) =>
        startOf(x).vel[a] !== startOf(y).vel[a] && (startOf(x).size[a] === LONG || startOf(y).size[a] === LONG);
    for (const i of rest) for (let r = 0; r < 2; r++) {
        const hour = int(rnd, 1, LAST_HOUR - 1);
        const pairs: Array<[number, number, number]> = [];
        for (let x = 0; x < n; x++) for (const y of [POST, ...Array.from({ length: n }, (_, k) => k)]) {
            if (y !== x) for (const a of lineAxes(axes)) pairs.push([x, y, a]);
        }
        const good = pairs.filter(([x, y, a]) => telling(x, y, a));
        const [x, y, a] = pick(good.length && rnd() < 0.85 ? good : pairs, rnd);
        const truth = intervalRel(thingAt(world, x, hour), thingAt(world, y, hour), a);
        const rels = ["before", "after", "overlaps", "within", "spans", "identical"] as const;
        const rel = types[i] ? truth : pick(rels.filter(r => r !== truth), rnd);
        say(i, { kind: "rel", hour, x, y, axis: a, rel });
    }
    return { axes, things: n, speakers: S, statements: shuffle(statements, rnd) };
}

/* ------------------------------------------------------------------ *
 * The checks                                                          *
 * ------------------------------------------------------------------ */

const sameWorld = (a: World, b: World) =>
    a.start.length === b.start.length && a.start.every((x, i) => sameBody(x, b.start[i]))
    && a.events.length === b.events.length
    && a.events.every(e => b.events.some(f => f.hour === e.hour && f.t.id === e.t.id && f.t.axes.join() === e.t.axes.join() && (f.t.k ?? 1) === (e.t.k ?? 1)));

/**
 * One item, or null when this attempt's world would not make one; callers retry.
 */
export function tryBuild(opts: BuildOptions): Item | null {
    const rnd = opts.rnd ?? Math.random;
    const axes = makeAxes(rnd, opts.dims ?? 7);
    const world: World = { axes, start: Array.from({ length: opts.things }, () => makeBody(axes, rnd)), events: makeEvents(axes, rnd) };
    /* Things stay apart at hour 0 on the ring and in kind at least somewhere, so
       relations differ between them. */
    const types = Array.from({ length: opts.speakers }, () => rnd() < 0.5);
    if (types.every(t => t) || types.every(t => !t)) types[int(rnd, 0, types.length - 1)] = !types[0];
    const firsts = shuffle(Array.from({ length: opts.speakers }, (_, i) => i), rnd).slice(0, Math.max(2, opts.speakers - 2));
    const card = makeCard(world, types, firsts, rnd);
    if (!card) return null;

    const rec = read(card, FULL);
    if (!rec || !sameWorld(rec.world, world) || rec.types.some((t, i) => t !== types[i])) return null;

    const kinds = opts.kind ? [opts.kind] : fitting(opts);
    const kind = QUESTIONS[pick(kinds, rnd)];
    const wantTrue = rnd() < 0.5;
    const shortcutReads = Object.entries(SHORTCUTS).map(([name, r]) => [name, read(card, r)] as const);
    /* Questions are cheap once the world and its readings are built, so many are
       tried against one world before the world is given up: a yes-or-no question
       has five shortcuts to beat, each of which lands on the right verdict half
       the time by accident. */
    for (let guard = 0; guard < 400; guard++) {
        const ask = kind.draw(world, opts.things, opts.speakers, types, rnd);
        if (!ask) continue;
        const answer = kind.answer(ask, rec);
        if (answer === null) continue;
        if (kind.answerMode === "boolean" && answer !== wantTrue) continue;
        const shortcuts: Record<string, Answer> = {};
        let fair = true;
        for (const [name, r] of shortcutReads) {
            const a = r ? kind.answer(ask, r) : null;
            shortcuts[name] = a;
            if (answerKey(a) === answerKey(answer)) { fair = false; break; }
        }
        if (!fair) continue;
        return { world, card, types, ask, kind, answer, shortcuts, reconstruction: rec };
    }
    return null;
}

/** The kinds of question a card of this size can ask. */
export const fitting = (opts: BuildOptions) =>
    Object.keys(QUESTIONS).filter(k => QUESTIONS[k].fits?.(opts.things, opts.speakers) ?? true);

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
