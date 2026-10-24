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
import { Fact, IntervalRel, LONG, POST, Statement, displacement, intervalRel } from "./facts";
import { Card, Reconstruction, World, bodyAt, postBody, read, settleByClaims, thingAt, worlds } from "./reader";
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
    /* Long along exactly one line, which the setup states as the rule: the
       lengths are told by how things lie against each other, and one unknown
       per thing is what a few such statements can pin down. */
    size[pick(lines, rnd)] = LONG;
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
function claimsFor(types: boolean[], firsts: number[], rnd: () => number, single: number): Statement[] | null {
    /* Some of the time — always on the smallest card — one claim that settles
       them all, "at least one of us is a knave", "we are both knaves": the
       classic opening, and one statement where the round of claims takes one each. */
    if (rnd() < single) {
        const settles = (st: Statement[]) => {
            const settled = settleByClaims({ axes: [], things: 0, speakers: types.length, statements: st });
            return firsts.every(i => settled.get(i) === types[i]);
        };
        for (const i of shuffle(firsts, rnd)) for (const kind of shuffle<"any" | "all">(["any", "all"], rnd)) for (const knight of shuffle([false, true], rnd)) {
            const claim: Claim = { kind, who: [...firsts].sort((a, b) => a - b), knight };
            const st: Statement[] = [{ speaker: i, fact: { kind: "type", claim } }];
            if (claimHolds(claim, types) === types[i] && settles(st)) return st;
        }
    }
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
    const claims = claimsFor(types, firsts, rnd, axes.length <= 3 ? 1 : 0.5);
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
    /* Events: a knight as they happened, or a knave the other way round where there is one. */
    for (const e of world.events) {
        const opp = TRANSFORMS[e.t.id].opposite?.(e.t);
        const s = opp && rnd() < 0.6 ? pick(firsts, rnd) : pick(knights, rnd);
        say(s, { kind: "event", hour: e.hour, t: types[s] ? e.t : opp! });
    }
    /* Lengths, told by how things lie against each other. While the card still
       allows a wrong set of lengths, one statement is added that is true of the
       world and false of that reading: from a knight, how two stretches lie;
       from a knave, how they would lie in the wrong reading — or, now and then,
       a length said outright and false. Nobody ever says a length truly. */
    const known = types.map((t, i) => (firsts.includes(i) ? t : undefined));
    const ids = [POST, ...Array.from({ length: n }, (_, k) => k)];
    for (let guard = 0; ; guard++) {
        const sols = worlds({ axes, things: n, speakers: S, statements }, known);
        const wrong = sols.filter(st => !st.every((b, x) => b && sameBody(b, world.start[x])));
        if (sols.length && !wrong.length) break;
        if (!sols.length || guard >= 4 * n) return null;
        /* Of a few dozen candidates, the one that rules out the most wrong
           readings: every statement here is first-card reading. */
        const relIn = (st: Array<Body | null>, x: number, y: number, a: number, h: number) => {
            const at = (k: number) => (k === POST ? postBody(axes) : st[k] ? bodyAt(axes, st[k]!, world.events, h) : null);
            const bx = at(x), by = at(y);
            return bx && by ? intervalRel(bx, by, a) : null;
        };
        const s = pick(firsts, rnd);
        let best: Fact | null = null, bestKills = 0;
        for (let g = 0; g < 40; g++) {
            const x = int(rnd, 0, n - 1), y = pick(ids.filter(k => k !== x), rnd);
            const a = pick(lineAxes(axes), rnd), hour = int(rnd, 1, LAST_HOUR - 1);
            const truth = intervalRel(thingAt(world, x, hour), thingAt(world, y, hour), a);
            const there = wrong.map(st => relIn(st, x, y, a, hour));
            /* A knight says how it is; a knave, how one wrong reading would have it. */
            const said = types[s] ? truth : pick(there.filter((r): r is IntervalRel => !!r && r !== truth), rnd);
            if (!said) continue;
            const kills = there.filter(r => (r === said) !== (said === truth)).length;
            if (kills > bestKills) { best = { kind: "rel", hour, x, y, axis: a, rel: said }; bestKills = kills; }
        }
        /* Now and then a knave says a length outright, falsely: "a point" along
           the line it is long on — more often on the smallest card, where it is
           the shorter way to say as much. */
        const unsaid = Array.from({ length: n }, (_, x) => x)
            .filter(x => !statements.some(st => st.fact.kind === "size" && st.fact.x === x));
        /* Only once a relation has been said: a card must show its lengths in
           how things lie, not only in a knave's word. */
        if (!types[s] && unsaid.length && statements.some(st => st.fact.kind === "rel") && rnd() < (axes.length <= 3 ? 0.5 : 0.3)) {
            const x = pick(unsaid, rnd);
            best = { kind: "size", x, axis: world.start[x].size.indexOf(LONG), long: false };
        }
        if (!best) return null;
        /* Never the same sentence twice: it adds nothing, and reads as a slip. */
        if (!statements.some(st => st.speaker === s && JSON.stringify(st.fact) === JSON.stringify(best))) say(s, best);
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
        /* The second report about some other pair or line than the first, so the
           two are never one sentence twice. */
        const fresh = pairs.filter(([x, y, a]) => !statements.some(st => st.speaker === i && st.fact.kind === "rel"
            && st.fact.x === x && st.fact.y === y && st.fact.axis === a));
        const good = fresh.filter(([x, y, a]) => telling(x, y, a));
        const [x, y, a] = pick(good.length && rnd() < 0.85 ? good : fresh, rnd);
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
