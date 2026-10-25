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
import { wordBreach } from "./words";
import { Answer, Ask, QUESTIONS, QuestionKind, Span, answerFollows, answerKey } from "./questions";

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
 * Words from the first speakers, until exactly one guess at what they are
 * survives them (`words.ts`): on how things move, on what happens on the hour,
 * and on where a thing is from the origin. A knight says again what another
 * knight said, in another form — a pace over several hours, or alike or
 * opposite to another thing's; a quarter turn from its other side; a place the
 * other way round the ring, by local clocks, or with one gap given by another
 * — or says a still thing never moves. A knave says a pace, a stillness, a
 * likeness, a turn or a place that is not so, and may contradict themselves
 * doing it. Each is the one, of a few dozen drawn, that rules out the most
 * guesses.
 *
 * In place of the claims about each other ("Bee and I are the same kind"),
 * which settled a card without a word about the world: two knights show
 * themselves the same kind by saying congruent things, never the same thing.
 */
function puzzleWords(world: World, types: boolean[], firsts: number[], said0: Statement[], rnd: () => number): Statement[] | null {
    const axes = world.axes, n = world.start.length, vel = world.start.map(b => b.vel);
    const ids = Array.from({ length: n }, (_, k) => k);
    const moving = ids.filter(x => vel[x].some(v => v !== 0));
    const guesses = Array.from({ length: 1 << firsts.length }, (_, m) => {
        const t = [...types];
        firsts.forEach((i, j) => (t[i] = (m & (1 << j)) !== 0));
        return t;
    }).filter(t => !t.every((v, i) => v === types[i]));
    const out: Statement[] = [];
    const standing = (extra: Statement[]) => guesses.filter(t => !wordBreach(axes, n, [...said0, ...out, ...extra], t));
    const key = (f: Fact) => (f.kind === "event" ? `e${f.hour}|${canonicalT(f.t)}` : JSON.stringify(f));
    const said = (f: Fact) => [...said0, ...out].some(o => key(o.fact) === key(f) && JSON.stringify(o.fact) === JSON.stringify(f));
    const free = axes.map((ax, i) => (ax.kind === "parity" ? -1 : i)).filter(i => i >= 0);
    /* A pace not so: one dimension's pace changed, by a step or to nothing. */
    const skewed = (v: number[]) => {
        const out = [...v], a = pick(free, rnd);
        out[a] = pick([-1, 0, 1].filter(u => u !== v[a]), rnd);
        return out;
    };
    /* Where a thing is from the origin at an hour, and that place a step off on one dimension. */
    const from = (x: number, h: number) => displacement(axes, thingAt(world, x, h), thingAt(world, POST, h));
    const nudged = (d: number[]) => {
        const out = [...d], a = pick(free, rnd);
        out[a] = axes[a].kind === "ring" ? mod(out[a] + pick([1, -1], rnd), axes[a].modulus!) : out[a] + pick([1, -1], rnd);
        return out;
    };
    /* A word on where a thing is from the origin at an hour: true from a knight, a step off from a knave, in a form of its own — round the ring the other way, by local clocks, or one gap by another. */
    const placeWord = (px: number, h: number, knight: boolean): Fact => {
        const d = from(px, h), rings = axes.some((ax, i) => ax.kind === "ring" && d[i] !== 0);
        const lines = lineAxes(axes).filter(i => d[i] !== 0);
        const pairs = lines.flatMap(a => lines.filter(b => b > a && Math.abs(d[b]) === Math.abs(d[a])).map(b => [a, b] as [number, number]));
        const delta = knight ? d : nudged(d);
        const form = pick(["plain", ...(rings ? ["round", "round"] : []), ...(axes.length > TIME ? ["local"] : []), ...(pairs.length && knight ? ["bridge"] : [])], rnd);
        const said = [...delta];
        if (form === "local") said[TIME] = localTime(axes, delta, thingAt(world, px, h), thingAt(world, POST, h));
        return { kind: "place", hour: h, x: px, y: POST, delta: said, ...(form === "round" ? { round: true } : {}),
            ...(form === "local" ? { local: true } : {}), ...(form === "bridge" ? { bridge: pick(pairs, rnd) } : {}) };
    };
    /* The places already spoken of, so a second word lands on the same one. */
    const spoken = () => [...said0, ...out].flatMap(o => (o.fact.kind === "place" ? [[o.fact.x, o.fact.hour] as [number, number]] : []));
    const early = world.events.filter(e => e.hour <= FIRST_HOURS);
    /* A kind of word not yet used is worth a little more than its kills, so
       a card's congruences come from places and turns as well as paces. */
    const used = new Set<string>();
    for (let guard = 0; guard < 14; guard++) {
        const left = standing([]);
        if (!left.length) return out;
        let best: Statement[] | null = null, bestKills = 0, bestFamily = "";
        for (let g = 0; g < 48; g++) {
            const s = pick(firsts, rnd), x = pick(ids, rnd), y = pick(ids.filter(k => k !== x), rnd);
            const family = pick(["pace", "pace", "place", "place", "event"], rnd), r = rnd();
            let fact: Fact | null = null;
            if (family === "pace") {
                const sign = rnd() < 0.6 ? 1 : -1 as const;
                const alike = vel[x].every((v, i) => v === sign * vel[y][i]);
                if (types[s]) {
                    if (r < 0.4 && moving.includes(x)) fact = { kind: "pace", x, vel: [...vel[x]], every: pick([2, 3], rnd) };
                    else if (r < 0.65 && !moving.includes(x)) fact = { kind: "pace", x, vel: vel[x].map(() => 0) };
                    else if (alike && (moving.includes(x) || moving.includes(y))) fact = { kind: "pacelike", x, y, sign };
                } else if (r < 0.65) {
                    const v = moving.includes(x) && rnd() < 0.4 ? vel[x].map(() => 0) : skewed(vel[x]);
                    fact = { kind: "pace", x, vel: v, ...(v.some(u => u !== 0) && rnd() < 0.4 ? { every: pick([2, 3], rnd) } : {}) };
                } else if (!alike) fact = { kind: "pacelike", x, y, sign };
            } else if (family === "place") {
                /* A place on its own rules nothing out: a second word on it does.
                   So a new place comes as two words from two speakers, each in
                   a form of its own; one already spoken of takes a single word. */
                const old = spoken(), again = old.length > 0 && rnd() < 0.5;
                const [px, h] = again ? pick(old, rnd) : [x, int(rnd, 1, FIRST_HOURS)];
                const second = again ? [] : [pick(firsts.filter(k => k !== s), rnd)].filter(k => k !== undefined);
                if (!again && !second.length) continue;
                const both = [s, ...second].map(k => ({ speaker: k, fact: placeWord(px, h, types[k]) }));
                if (both.some(b => said(b.fact)) || (both.length > 1 && JSON.stringify(both[0].fact) === JSON.stringify(both[1].fact))) continue;
                const kills = left.length - standing(both).length, score = kills ? kills + (used.has(family) ? 0 : 0.6) : 0;
                if (score > bestKills) { best = both; bestKills = score; bestFamily = family; }
                continue;
            } else if (early.length) {
                const e = pick(early, rnd), opp = TRANSFORMS[e.t.id].opposite?.(e.t);
                /* The same transformation from its other side, where it has one. */
                const other = (e.t.id === "rotate" || e.t.id === "swap") && e.t.axes.length === 2
                    ? { ...e.t, axes: [e.t.axes[1], e.t.axes[0]], ...(e.t.id === "rotate" ? { k: 4 - (e.t.k ?? 1) } : {}) } : e.t;
                if (types[s]) fact = { kind: "event", hour: e.hour, t: rnd() < 0.7 ? other : e.t };
                else if (opp) fact = { kind: "event", hour: e.hour, t: rnd() < 0.5 ? opp : { ...opp, axes: [...opp.axes].reverse(), ...(opp.id === "rotate" ? { k: 4 - (opp.k ?? 1) } : {}) } };
            }
            if (!fact || said(fact)) continue;
            const st: Statement = { speaker: s, fact };
            const kills = left.length - standing([st]).length, score = kills ? kills + (used.has(family) ? 0 : 0.6) : 0;
            if (score > bestKills) { best = [st]; bestKills = score; bestFamily = family; }
        }
        if (!best) return null;
        out.push(...best);
        used.add(bestFamily);
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
    const knights = firsts.filter(i => types[i]), anyKnight = types.map((t, i) => (t ? i : -1)).filter(i => i >= 0);
    if (!knights.length) return null;
    const statements: Statement[] = [];
    const say = (speaker: number, fact: Fact) => statements.push({ speaker, fact, ...(space ? { space } : {}) });

    /* Places: a tree out from the Post, each at an hour of its own. */
    const order = shuffle(Array.from({ length: n }, (_, i) => i), rnd), placed: number[] = [POST];
    /* Half the time a place shares its hour and speaker with the one before it
       in the chain, so the two can be said in one sentence. */
    const placedBy = new Map<number, { hour: number; speaker: number }>();
    for (const x of order) {
        const y = rnd() < 0.3 ? POST : pick(placed, rnd);
        const chained = placedBy.get(y) && rnd() < 0.5 ? placedBy.get(y)! : null;
        const hour = chained ? chained.hour : int(rnd, 1, FIRST_HOURS), speaker = chained ? chained.speaker : pick(anyKnight, rnd);
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
    for (let x = 0; x < n; x++) if (world.start[x].vel.some(v => v !== 0)) say(pick(knights, rnd), { kind: "pace", x, vel: [...world.start[x].vel] });

    /* Where everyone stands, outside the brackets, from a knight: the thing
       they stand in, and, on the smaller cards or half the time, which way they
       face. A heading left out is worked out from what they say they see. A
       speaker the claims leave open always has theirs said, since their views
       are what unmasks them. */
    const obs = space === 0 ? world.observers : undefined;
    if (obs) obs.forEach((o, who) => {
        const faced = axes.length <= 4 || !firsts.includes(who) || rnd() < 0.5;
        say(pick(anyKnight, rnd), { kind: "stands", who, host: o.host, ...(faced ? { facing: o.facing } : {}),
            ...(o.twin ? { twin: true } : {}), ...(o.upside ? { upside: true } : {}) });
    });

    /* Everything that makes the world comes from knights: the card past its
       first stage keeps only what knights said, and has to pin the world down
       with that. A knave's word on a length or an event would go with them.
       (An unsettled speaker's word on either would also leave every report
       that was to unmask them unreadable; allowed to anyone, nine cards in
       ten deadlocked.) */
    for (const e of world.events) say(pick(knights, rnd), { kind: "event", hour: e.hour, t: e.t });
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
        if (told.length) say(pick(anyKnight, rnd), { kind: "sizes", x, lens: told.map(a => [a, world.start[x].size[a]] as [number, number]) });
    }
    /* A reading that differs from the world only in that one length is not wrong. */
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
        const s = pick(anyKnight, rnd);
        let best: Fact | null = null, bestKills = 0;
        for (let g = 0; g < 48; g++) {
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
        /* Never the same sentence twice: it adds nothing, and reads as a slip. */
        if (!statements.some(st => st.speaker === s && JSON.stringify(st.fact) === JSON.stringify(best))) say(s, best);
    }
    /* And outside the brackets one report more from a knight, in one of the
       forms nothing above needs — what they see, steps in all, a ranked list,
       a ring's reach, the hour two first meet or draw level — so every form
       of the world turns up. True, since a knight says it. Preferably on an
       axis where the pair moves apart and one of them has a length, so that
       ignoring the motion or the lengths misreads it. */
    const reporters = space === 0 ? [pick(anyKnight, rnd)] : [];
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
        /* Or, a third of the time, what they see from where they stand. One
           report a card, so each form gets its share of them. */
        if (obs && obs[i].host !== x && rnd() < 0.3) {
            const truth = seenFrom(axes, thingAt(world, obs[i].host, hour), thingAt(world, x, hour), obs[i]);
            const seen = types[i] ? truth : skew(truth, axes, rnd);
            say(i, { kind: "view", hour, who: i, x, seen });
            continue;
        }
        /* Or steps in all, or a ranked list — false from a knave by a little. */
        const roll = rnd(), bx = thingAt(world, x, hour), by = thingAt(world, y, hour);
        /* Or, where time is a line, whether a ring from one would reach the
           other in time: just as it arrives, or only after. */
        if (roll < 0.35 && axes[TIME]?.kind === "line") {
            /* Of the pairs, one a knight could say it of: a ring from the second
               reaches the first by its time, just then or before. */
            const ring = (p: number, q: number) => {
                const bp = thingAt(world, p, hour), bq = thingAt(world, q, hour);
                const late = bp.pos[TIME] - bq.pos[TIME], far = spaceSteps(axes, bp, bq);
                return late === far ? "at" : late > far ? "after" : null;
            };
            const pairsOf = ids.flatMap(p => ids.filter(q => q !== p).map(q => [p, q] as [number, number]));
            const sayable = pairsOf.filter(([p, q]) => ring(p, q) !== null);
            if (sayable.length) {
                const [p, q] = pick(sayable, rnd), truth = ring(p, q)!;
                say(i, { kind: "signal", hour, x: p, y: q, mode: types[i] ? truth : truth === "at" ? "after" : "at" });
                continue;
            }
        }
        /* Or the hour one first draws level with another along a line, searched over the pairs. */
        if (roll > 0.82) {
            const at = (k: number, h: number) => (k === POST ? thingAt(world, POST, h) : truly(k, h));
            const level = pairs.map(([p, q, b]) => [p, q, b, firstLevel(at, p, q, b, LAST_HOUR)] as const).filter(([, , , h]) => typeof h === "number" && h >= 1);
            if (level.length) {
                const [p, q, b, first] = pick(level, rnd);
                const hourSaid = types[i] ? first! : pick(Array.from({ length: LAST_HOUR }, (_, k) => k + 1).filter(h => h !== first), rnd);
                say(i, { kind: "level", x: p, y: q, axis: b, hour: hourSaid });
                continue;
            }
        }
        /* Or the hour two first meet, sharing ground — searched over the pairs,
           since most pairs never do. A knave names an hour they do not. */
        if (roll > 0.62 && roll <= 0.82) {
            const at = (k: number, h: number) => (k === POST ? thingAt(world, POST, h) : truly(k, h));
            const meeting = ids.flatMap(p => ids.filter(q => q > p).map(q => [p, q, firstMeet(axes, at, p, q, LAST_HOUR)] as const))
                .filter(([, , h]) => typeof h === "number" && h >= 1);
            if (meeting.length) {
                const [p, q, first] = pick(meeting, rnd);
                const hourSaid = types[i] ? first! : pick(Array.from({ length: LAST_HOUR }, (_, k) => k + 1).filter(h => h !== first), rnd);
                say(i, { kind: "meet", x: p, y: q, hour: hourSaid });
                continue;
            }
        }
        if (roll < 0.2) {
            const steps = stepsBetween(axes, bx, by);
            say(i, { kind: "total", hour, x, y, steps: types[i] ? steps : Math.max(0, steps + pick([-2, -1, 1, 2], rnd)) });
            continue;
        }
        if (roll < 0.35 && n >= 3) {
            const by2 = pick(lineAxes(axes).filter(b => b !== a), rnd) ?? a;
            const truly = rankBy(axes, world.start.map((_, k) => thingAt(world, k, hour)), ids, [a, by2]);
            if (truly) {
                /* A knave's list has two neighbours the wrong way round. */
                const said = [...truly];
                if (!types[i]) { const j = int(rnd, 0, said.length - 2); [said[j], said[j + 1]] = [said[j + 1], said[j]]; }
                say(i, { kind: "ranked", hour, by: [a, by2], order: said });
                continue;
            }
        }
        const truth = intervalRel(bx, by, a);
        const rels = ["before", "after", "overlaps", "within", "spans", "identical"] as const;
        /* A denial is checkable too: a knight denies a way they do not lie, a knave the way they do. */
        if (roll < 0.5) {
            const rel = types[i] ? pick(rels.filter(q => q !== truth), rnd) : truth;
            say(i, { kind: "not", f: { kind: "rel", hour, x, y, axis: a, rel } });
            continue;
        }
        const rel = types[i] ? truth : pick(rels.filter(q => q !== truth), rnd);
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
    && a.events.every(e => b.events.some(f => f.hour === e.hour && canonicalT(f.t) === canonicalT(e.t)));

/** A view wrong by one step on one dimension: what a knave says they see. */
function skew(s: Seen, axes: Axis[], rnd: () => number): Seen {
    const out: Seen = { ahead: s.ahead, left: s.left, rest: [...s.rest] };
    const dims = ["ahead", "left", ...axes.map((a, i) => (PLANE.includes(i) || a.kind === "parity" ? -1 : i)).filter(i => i >= 0)];
    const d = pick(dims, rnd), by = rnd() < 0.5 ? 1 : -1;
    if (d === "ahead") out.ahead += by; else if (d === "left") out.left += by;
    else { const i = d as number; out.rest[i] = axes[i].kind === "ring" ? mod(out.rest[i] + by, axes[i].modulus!) : out.rest[i] + by; }
    return out;
}

/**
 * The question put to the one speaker the first stage leaves unsaid: yes-or-no
 * questions about the world, some of which the first stage's words settle —
 * those are the ones whose answer tells a knight from a knave — and the one
 * that was asked, answered.
 */
export interface Asking {
    who: number;
    /** A fact to ask whether it is so, or null for "Are you a knight?", which both answer yes. */
    options: Array<{ fact: Fact | null; tells: boolean }>;
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
    const settles = (f: Fact) => {
        /* Settled when a guess at the asked speaker either way is thrown out by an answer: ask, both ways. */
        const yes: Statement = { speaker: who, fact: f }, no: Statement = { speaker: who, fact: { kind: "not", f } };
        const t = [...types], u = [...types];
        t[who] = true; u[who] = false;
        const ok = (st: Statement, kinds: boolean[]) => !wordBreach(axes, n, [...words, st], kinds);
        /* It tells when each answer leaves exactly one kind standing. */
        return ok(yes, t) !== ok(yes, u) && ok(no, t) !== ok(no, u);
    };
    const tells: Fact[] = [], blind: Array<Fact | null> = [null];
    for (let g = 0; g < 80 && (tells.length < 3 || blind.length < 4); g++) {
        const x = pick(ids, rnd), y = pick(ids.filter(k => k !== x), rnd), h = int(rnd, 1, FIRST_HOURS);
        const r = rnd();
        let f: Fact;
        if (r < 0.3) f = { kind: "pace", x, vel: rnd() < 0.6 ? [...world.start[x].vel] : axes.map((ax, i) => (ax.kind === "parity" ? 0 : pick([-1, 0, 1], rnd))) };
        else if (r < 0.45) f = { kind: "pacelike", x, y, sign: rnd() < 0.6 ? 1 : -1 };
        else if (r < 0.7) {
            /* Half the time about a place the words do speak of, which they then settle. */
            const spokenOf = words.flatMap(st => (st.fact.kind === "place" ? [[st.fact.x, st.fact.hour] as [number, number]] : []));
            const [px, ph] = spokenOf.length && rnd() < 0.5 ? pick(spokenOf, rnd) : [x, h];
            const d = displacement(axes, thingAt(world, px, ph), thingAt(world, POST, ph));
            if (rnd() < 0.4) { const a = pick(lineAxes(axes), rnd); d[a] += pick([1, -1], rnd); }
            f = { kind: "place", hour: ph, x: px, y: POST, delta: d };
        }
        else if (r < 0.8) f = { kind: "rel", hour: h, x, y, axis: pick(lineAxes(axes), rnd), rel: intervalRel(thingAt(world, x, h), thingAt(world, y, h), pick(lineAxes(axes), rnd)) };
        else if (r < 0.9) f = { kind: "meet", x, y, hour: h };
        else if (world.events.length) { const e = pick(world.events, rnd); f = { kind: "event", hour: e.hour, t: e.t }; }
        else continue;
        const key = JSON.stringify(f);
        if ([...tells, ...blind].some(o => JSON.stringify(o) === key) || words.some(w => JSON.stringify(w.fact) === key)) continue;
        if (settles(f)) { if (tells.length < 3) tells.push(f); }
        else if (blind.length < 4 && f.kind !== "pace" && f.kind !== "pacelike" && f.kind !== "event") blind.push(f);
    }
    if (!tells.length || blind.length < 2) return null;
    /* Four questions, one to three that tell. */
    const k = int(rnd, 1, Math.min(3, tells.length, 3));
    const options = shuffle([...tells.slice(0, k).map(fact => ({ fact, tells: true })),
        ...shuffle(blind, rnd).slice(0, 4 - k).map(fact => ({ fact, tells: false }))], rnd);
    /* The answer to one that tells: the fact as it is from a knight, the other way from a knave. */
    const asked = pick(options.filter(o => o.tells), rnd).fact!;
    const view = { axes, at: (x: number, h: number) => thingAt(world, x, h), start: (x: number) => (x === POST ? thingAt(world, POST, 0) : world.start[x]),
        observer: () => null, eventsKnownThrough: () => true, events: () => world.events, types };
    const truth = holds(asked, view);
    if (truth === null) return null;
    return { who, options, answer: { speaker: who, fact: truth === types[who] ? asked : { kind: "not", f: asked } } };
}

function makeBase(opts: BuildOptions, rnd: () => number): Base | null {
    clearReaderCache();
    const axes = makeAxes(rnd, opts.dims ?? 7);
    const start = Array.from({ length: opts.things }, () => makeBody(axes, rnd));
    const frames = makeFrames(axes, rnd, opts.kinds);
    const world: World = { axes, start, events: makeEvents(axes, rnd, undefined, start), ...(frames ? { frames } : {}) };
    /* Every speaker stands in a thing and faces one of four ways. */
    /* Now and then a mirror twin, or one hanging head down. */
    world.observers = Array.from({ length: opts.speakers }, () => ({
        host: int(rnd, 0, opts.things - 1), facing: int(rnd, 0, 3),
        ...(rnd() < 0.2 ? { twin: true } : {}), ...(rnd() < 0.2 ? { upside: true } : {}),
    }));
    /* One speaker says nothing until asked; the rest tell each other apart,
       and at least one of them is a knight, since knights make the world. */
    const types = Array.from({ length: opts.speakers }, () => rnd() < 0.5);
    const asked = int(rnd, 0, opts.speakers - 1);
    const firsts = Array.from({ length: opts.speakers }, (_, i) => i).filter(i => i !== asked);
    if (!firsts.some(i => types[i])) types[pick(firsts, rnd)] = true;
    /* Nested on most cards: a second space in brackets, the same things in
       the same kind of space, arranged, sized, moving and turned apart. */
    const nested = opts.nested ?? rnd() < 0.75;
    const inner: World | undefined = nested
        ? (s => ({ axes, start: s, events: makeEvents(axes, rnd, undefined, s), ...(frames ? { frames } : {}) }))(Array.from({ length: opts.things }, () => makeBody(axes, rnd)))
        : undefined;
    /* Now and then a card that leaves a length open, where there are enough things to ask what could be. */
    const leaveOpen = opts.things >= 4 && (opts.open ?? rnd() < 0.7);
    const outside = makeCard(world, types, firsts, rnd, 0, leaveOpen);
    const inside = inner ? makeCard(inner, types, firsts, rnd, 1) : [];
    if (!outside || !inside) return null;
    /* The first stage: every pace and event the knights give outside the
       brackets — what nobody gives does not move or happen, so they all have
       to be there — and the words that tell the speakers apart. */
    const given = outside.filter(st => st.fact.kind === "pace" || st.fact.kind === "event");
    const extra = puzzleWords(world, types, firsts, given, rnd);
    if (!extra) return null;
    const asking = makeAsking(world, types, asked, [...given, ...extra], rnd);
    if (!asking) return null;
    const words = shuffle([...given, ...extra, asking.answer], rnd);
    const style = { compact: rnd() < 0.4, wide: rnd() < 0.7 };
    const plain: Card = {
        axes, things: opts.things, speakers: opts.speakers, statements: shuffle([...outside, ...inside], rnd), style,
        ...(frames ? { frames } : {}),
    };
    const card: Card = { ...plain, statements: [...plain.statements, ...extra, asking.answer] };
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
                const other = answerFollows(kind, { ...ask, s1: a, s2: b }, rec);
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
const shortcutReads = (card: Card, known?: boolean[]) => Object.entries(SHORTCUTS)
    .filter(([name]) => (name !== "kinds" || card.frames) && (name !== "liars" || !known)
        /* Nor headings, on a card where nobody says what they see. */
        && (name !== "perspective" || card.statements.some(s => s.fact.kind === "view")))
    .map(([name, r]) => [name, read(card, r, known)] as const);

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
     * built in the world the announcement changed.
     */
    closing: Stage;
}

export function tryBuildStaged(opts: BuildOptions): StagedItem | null {
    const rnd = opts.rnd ?? Math.random;
    const base = makeBase(opts, rnd);
    if (!base) return null;
    /* Once the first stage has told the knights from the knaves, the rest of
       the item is asked on the knights' words that make the world: the
       knaves' are gone, and so are the words that only told who is what. */
    const { world, card, plain, words, asking, types, firsts, rec } = base;

    /* Stage 2: analogies to finish, in the first part of the day. */
    const early: Span = { h1: [1, FIRST_HOURS], h2: [1, FIRST_HOURS] };
    /* Picked, built, or about the speakers themselves. */
    const finishing = ["which", "which", "build", ...(QUESTIONS.speakers.fits!(opts.things, opts.speakers) ? ["speakers"] : [])];
    const reads = shortcutReads(plain, types);
    const analogies: Stage[] = [];
    /* A card left open asks what could be, first; one meant to be open that came out settled is drawn again. */
    if (opts.open && !rec.alternatives) return null;
    if (rec.alternatives) {
        const could = fairStage(QUESTIONS.could, base, rec, reads, rnd, early);
        if (!could) return null;
        analogies.push(could);
    }
    for (let k = analogies.length, want = int(rnd, 2, 3); k < want; k++) {
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
        const added = makeEvents(world.axes, rnd, LATER_HOURS, world.start);
        if (!added.length) continue;
        const later: Statement[] = added.map(e => {
            const opp = TRANSFORMS[e.t.id].opposite?.(e.t);
            const s = opp && rnd() < 0.6 ? pick(firsts, rnd) : pick(knights, rnd);
            return { speaker: s, fact: { kind: "event", hour: e.hour, t: types[s] ? e.t : opp! } };
        });
        const whole: World = { ...world, events: [...world.events, ...added] };
        const card2: Card = { ...plain, statements: [...plain.statements, ...later] };
        const rec2 = read(card2, FULL, types);
        if (!rec2 || !sameWorld(rec2.world, whole)) continue;
        const across: Span = { h1: [1, LAST_HOUR], h2: [Math.min(...added.map(e => e.hour)), LAST_HOUR] };
        const reads2 = [...shortcutReads(card2, types), ["announced", rec] as const];
        const judgements: Stage[] = [];
        for (let k = 0, want = int(rnd, 2, 3); k < want; k++) {
            const stage = fairStage(QUESTIONS.judge, base, rec2, reads2, rnd, across, rnd() < 0.5, judgements.map(j => j.ask));
            if (!stage) break;
            judgements.push(stage);
        }
        if (judgements.length < 2) continue;
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
    opts = {
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
