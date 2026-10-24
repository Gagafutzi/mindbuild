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
import { Cmp, Fact, IntervalRel, POST, Statement, compareLengths, displacement, intervalRel } from "./facts";
import { Card, Reconstruction, World, bodyAt, clearReaderCache, read, settleByClaims, thingAt, worlds } from "./reader";
import { Answer, Ask, QUESTIONS, QuestionKind, Span, answerKey } from "./questions";

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
    /** Whether the card has a second space in brackets; drawn when unset. */
    nested?: boolean;
    /** Ask this kind only; otherwise every kind that fits the card, evenly. */
    kind?: string;
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

function makeEvents(axes: Axis[], rnd: () => number, within = [2, 3, 4, 5, 6]): Array<{ hour: number; t: TransformSpec }> {
    const lines = lineAxes(axes), out: Array<{ hour: number; t: TransformSpec }> = [];
    /* Two only where there is room for them to be told apart from one. */
    const count = axes.length >= 5 && rnd() < 0.5 ? 2 : 1, hours = shuffle(within, rnd).slice(0, count).sort((a, b) => a - b);
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
/**
 * Claims among the first speakers that settle exactly them. Nobody counts
 * themselves among the knaves — "Copy and I are both knaves" settles a card in
 * one line, and reads as a trick of the wording rather than a puzzle.
 */
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

/**
 * The statements that pin one space down: `space` 0 outside the brackets, with
 * the speakers' claims about each other, or 1 inside them, without — the same
 * speakers, already settled or not. Each speaker the claims leave open gives
 * `reports` checkable reports here.
 */
function makeCard(world: World, types: boolean[], firsts: number[], rnd: () => number, space = 0, reports = 2): Statement[] | null {
    const axes = world.axes, n = world.start.length, S = types.length;
    const knights = firsts.filter(i => types[i]);
    if (!knights.length) return null;
    const statements: Statement[] = [];
    const say = (speaker: number, fact: Fact) => statements.push({ speaker, fact, ...(space ? { space } : {}) });
    if (space === 0) {
        const claims = claimsFor(types, firsts, rnd);
        if (!claims) return null;
        statements.push(...claims);
    }

    /* Places: a tree out from the Post, each at an hour of its own. */
    const order = shuffle(Array.from({ length: n }, (_, i) => i), rnd), placed: number[] = [POST];
    for (const x of order) {
        const y = rnd() < 0.3 ? POST : pick(placed, rnd), hour = int(rnd, 1, FIRST_HOURS);
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
    for (let x = 0; x < n; x++) {
        const lines = lineAxes(axes), open = rnd() < 0.8 ? pick(lines, rnd) : -1;
        const told = lines.filter(a => a !== open);
        if (told.length) say(pick(knights, rnd), { kind: "sizes", x, lens: told.map(a => [a, world.start[x].size[a]] as [number, number]) });
    }
    const known = types.map((t, i) => (firsts.includes(i) ? t : undefined));
    for (let guard = 0; ; guard++) {
        const sols = worlds({ axes, things: n, speakers: S, statements }, known, space);
        const wrong = sols.filter(st => !st.every((b, x) => b && sameBody(b, world.start[x])));
        if (sols.length && !wrong.length) break;
        if (!sols.length || guard >= 6 * n) return null;
        const bodyIn = (st: Array<Body | null>, k: number, h: number) => (st[k] ? bodyAt(axes, st[k]!, world.events, h) : null);
        const s = pick(firsts, rnd);
        let best: Fact | null = null, bestKills = 0;
        for (let g = 0; g < 48; g++) {
            const x = int(rnd, 0, n - 1), y = pick(ids.filter(k => k !== x), rnd);
            const a = pick(lineAxes(axes), rnd), hour = int(rnd, 1, FIRST_HOURS);
            const form = pick(["rel", "rel", "cmp", "size"], rnd);
            /* What the statement says in each reading, the true one first. */
            const value = (st: Array<Body | null> | null): string | number | null => {
                const bx = st ? bodyIn(st, x, hour) : thingAt(world, x, hour), by = st ? bodyIn(st, y, hour) : thingAt(world, y, hour);
                if (!bx || !by) return null;
                if (form === "rel") return intervalRel(bx, by, a);
                if (form === "cmp") return compareLengths(bx.size[a], by.size[a]);
                return (st ? st[x]!.size[a] : world.start[x].size[a]);
            };
            if (form === "size" && types[s]) continue;
            const truth = value(null), there = wrong.map(value);
            /* A knight says how it is; a knave, how one wrong reading would have it. */
            const said = types[s] ? truth : pick(there.filter(r => r !== null && r !== truth), rnd);
            if (said === null || said === undefined) continue;
            const kills = there.filter(r => (r === said) !== (said === truth)).length;
            if (kills <= bestKills) continue;
            bestKills = kills;
            best = form === "rel" ? { kind: "rel", hour, x, y, axis: a, rel: said as IntervalRel }
                : form === "cmp" ? { kind: "cmp", hour, x, y, axis: a, cmp: said as Cmp }
                : { kind: "size", x, axis: a, len: said as number };
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
        startOf(x).vel[a] !== startOf(y).vel[a] && (startOf(x).size[a] > 1 || startOf(y).size[a] > 1);
    for (const i of rest) for (let r = 0; r < reports; r++) {
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
        const truth = intervalRel(thingAt(world, x, hour), thingAt(world, y, hour), a);
        const rels = ["before", "after", "overlaps", "within", "spans", "identical"] as const;
        const rel = types[i] ? truth : pick(rels.filter(r => r !== truth), rnd);
        say(i, { kind: "rel", hour, x, y, axis: a, rel });
    }
    return statements;
}

/* ------------------------------------------------------------------ *
 * The checks                                                          *
 * ------------------------------------------------------------------ */

const sameWorld = (a: World, b: World) =>
    a.start.length === b.start.length && a.start.every((x, i) => sameBody(x, b.start[i]))
    && a.events.length === b.events.length
    && a.events.every(e => b.events.some(f => f.hour === e.hour && f.t.id === e.t.id && f.t.axes.join() === e.t.axes.join() && (f.t.k ?? 1) === (e.t.k ?? 1)));

/** A world, the card that pins it down, and the reading of that card. */
interface Base {
    world: World;
    /** The space inside the brackets, on a nested card. */
    inner?: World;
    card: Card;
    types: boolean[];
    firsts: number[];
    rec: Reconstruction;
}

function makeBase(opts: BuildOptions, rnd: () => number): Base | null {
    clearReaderCache();
    const axes = makeAxes(rnd, opts.dims ?? 7);
    const world: World = { axes, start: Array.from({ length: opts.things }, () => makeBody(axes, rnd)), events: makeEvents(axes, rnd) };
    const types = Array.from({ length: opts.speakers }, () => rnd() < 0.5);
    if (types.every(t => t) || types.every(t => !t)) types[int(rnd, 0, types.length - 1)] = !types[0];
    const firsts = shuffle(Array.from({ length: opts.speakers }, (_, i) => i), rnd).slice(0, Math.max(2, opts.speakers - 2));
    /* Nested on most cards: a second space in brackets, the same things in
       the same kind of space, arranged, sized, moving and turned apart. Each
       unsettled speaker reports once in each, so unmasking them needs both. */
    const nested = opts.nested ?? rnd() < 0.75;
    const inner: World | undefined = nested
        ? { axes, start: Array.from({ length: opts.things }, () => makeBody(axes, rnd)), events: makeEvents(axes, rnd) }
        : undefined;
    const outside = makeCard(world, types, firsts, rnd, 0, nested ? 1 : 2);
    const inside = inner ? makeCard(inner, types, firsts, rnd, 1, 1) : [];
    if (!outside || !inside) return null;
    const card: Card = { axes, things: opts.things, speakers: opts.speakers, statements: shuffle([...outside, ...inside], rnd) };
    const rec = read(card, FULL);
    if (!rec || !sameWorld(rec.world, world) || rec.types.some((t, i) => t !== types[i])) return null;
    if (inner && (!rec.inner || !sameWorld(rec.inner, inner))) return null;
    return { world, ...(inner ? { inner } : {}), card, types, firsts, rec };
}

/** One question with its answer, and what each way of going wrong answers instead. */
export interface Stage {
    kind: QuestionKind;
    ask: Ask;
    answer: Answer;
    /** What each shortcut reading answers: never the answer. */
    shortcuts: Record<string, Answer>;
}

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
): Stage | null {
    const { world, types } = base, things = world.start.length;
    for (let guard = 0; guard < 400; guard++) {
        const ask = kind.draw(rec, things, types.length, types, rnd, span);
        if (!ask || unlike.some(u => JSON.stringify({ ...u, options: [] }) === JSON.stringify({ ...ask, options: [] }))) continue;
        const answer = kind.answer(ask, rec);
        if (answer === null) continue;
        if (kind.answerMode === "boolean" && wantTrue !== undefined && answer !== wantTrue) continue;
        const shortcuts: Record<string, Answer> = {};
        let fair = true;
        for (const [name, r] of wrongs) {
            const a = r ? kind.answer(ask, r) : null;
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
                const other = kind.answer({ ...ask, s1: a, s2: b }, rec);
                shortcuts[`spaces ${a}${b}`] = other;
                if (answerKey(other) === answerKey(answer)) { fair = false; break; }
            }
        }
        if (fair) return { kind, ask, answer, shortcuts };
    }
    return null;
}

const shortcutReads = (card: Card) => Object.entries(SHORTCUTS).map(([name, r]) => [name, read(card, r)] as const);

/**
 * One item, or null when this attempt's world would not make one; callers retry.
 */
export function tryBuild(opts: BuildOptions): Item | null {
    const rnd = opts.rnd ?? Math.random;
    const base = makeBase(opts, rnd);
    if (!base) return null;
    const kinds = opts.kind ? [opts.kind] : fitting(opts);
    const kind = QUESTIONS[pick(kinds, rnd)];
    const stage = fairStage(kind, base, base.rec, shortcutReads(base.card), rnd, undefined, rnd() < 0.5);
    if (!stage) return null;
    return { world: base.world, card: base.card, types: base.types, ...stage, reconstruction: base.rec };
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
    /** The statements the last stage adds: the transformations, said by someone. */
    later: Statement[];
    types: boolean[];
    reconstruction: Reconstruction;
    /** The reading of the card with the later statements. */
    laterReconstruction: Reconstruction;
    analogies: Stage[];
    judgements: Stage[];
}

export function tryBuildStaged(opts: BuildOptions): StagedItem | null {
    const rnd = opts.rnd ?? Math.random;
    const base = makeBase(opts, rnd);
    if (!base) return null;
    const { world, card, types, firsts, rec } = base;

    /* Stage 2: analogies to finish, in the first part of the day. */
    const early: Span = { h1: [1, FIRST_HOURS], h2: [1, FIRST_HOURS] };
    const finishing = ["which", ...(QUESTIONS.speakers.fits!(opts.things, opts.speakers) ? ["speakers"] : [])];
    const reads = shortcutReads(card);
    const analogies: Stage[] = [];
    for (let k = 0, want = int(rnd, 2, 3); k < want; k++) {
        /* A kind that will not go on this world gives way to the other, rather
           than the world — which cost far more to build than a question. */
        let stage: Stage | null = null;
        for (const id of shuffle(finishing, rnd)) {
            if ((stage = fairStage(QUESTIONS[id], base, rec, reads, rnd, early, undefined, analogies.map(a => a.ask)))) break;
        }
        if (!stage) { if (analogies.length >= 2) break; return null; }
        analogies.push(stage);
    }

    /* Stage 3: transformations announced, by settled speakers — a knave's the
       other way round where there is one — and analogies judged across them. */
    const knights = firsts.filter(i => types[i]);
    /* A few draws of what to announce before the world is given up: whether a
       verdict turns on the new transformation depends on which one it is. */
    for (let tries = 0; tries < 6; tries++) {
        const added = makeEvents(world.axes, rnd, LATER_HOURS);
        if (!added.length) continue;
        const later: Statement[] = added.map(e => {
            const opp = TRANSFORMS[e.t.id].opposite?.(e.t);
            const s = opp && rnd() < 0.6 ? pick(firsts, rnd) : pick(knights, rnd);
            return { speaker: s, fact: { kind: "event", hour: e.hour, t: types[s] ? e.t : opp! } };
        });
        const whole: World = { ...world, events: [...world.events, ...added] };
        const card2: Card = { ...card, statements: [...card.statements, ...later] };
        const rec2 = read(card2, FULL);
        if (!rec2 || !sameWorld(rec2.world, whole)) continue;
        const across: Span = { h1: [1, LAST_HOUR], h2: [Math.min(...added.map(e => e.hour)), LAST_HOUR] };
        const reads2 = [...shortcutReads(card2), ["announced", rec] as const];
        const judgements: Stage[] = [];
        for (let k = 0, want = int(rnd, 2, 3); k < want; k++) {
            const stage = fairStage(QUESTIONS.judge, base, rec2, reads2, rnd, across, rnd() < 0.5, judgements.map(j => j.ask));
            if (!stage) break;
            judgements.push(stage);
        }
        if (judgements.length < 2) continue;
        return { world: whole, card, later, types, reconstruction: rec, laterReconstruction: rec2, analogies, judgements };
    }
    return null;
}

export function buildStaged(opts: BuildOptions, attempts = 400): StagedItem | null {
    for (let i = 0; i < attempts; i++) {
        const item = tryBuildStaged(opts);
        if (item) return item;
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
