/**
 * Composed World — the clock, and the reader.
 *
 * The reader rebuilds the world from the statements alone, the way a player
 * has to. It is the definition of the answer: the generator's world is kept
 * only if the full reading rebuilds exactly it, and the item only if every
 * shortcut reading (`SHORTCUTS`) answers it wrongly or cannot answer it at all.
 *
 * ── How it reads ──
 *
 *   1. Types first from what speakers say about each other, by brute force over
 *      every assignment — the classic puzzle, which settles some of them.
 *   2. Then, over and over until nothing changes: rebuild what the settled
 *      speakers establish (paces, the events, places at hour 0, and lengths —
 *      every way of giving each thing its one long side that what they say
 *      allows, searched thing by thing), and
 *      unmask any unsettled speaker one of whose statements that already
 *      decides — a knight if it holds, a knave if not. Each speaker unmasked
 *      adds their statements, true as said or, for a knave's two-valued one,
 *      the other way round.
 *
 * A place stated at hour τ is carried back to hour 0 through every hour of
 * motion and every event in between. Paces can flip at a twist, so the pace a
 * thing has at τ is not known in advance: each sign pattern is tried, run back,
 * and kept if running it forward again lands where the statement says.
 */

import { Claim, holds as claimHolds } from "../knaves.utils";
import { Axis, Body, FULL, Reading, copyBody, mod, moveHour } from "./space";
import { TRANSFORMS, TransformSpec } from "./transforms";
import { Fact, MAX_LEN, Observer, POST, Statement, TIME, View, holds, negate } from "./facts";

export interface WorldEvent { hour: number; t: TransformSpec }

export interface World {
    axes: Axis[];
    /** Every thing's body at hour 0. */
    start: Body[];
    events: WorldEvent[];
    /** Where each speaker stands and faces, on a card with perspective. */
    observers?: Observer[];
}

export const postBody = (axes: Axis[]): Body => ({ pos: axes.map(() => 0), size: axes.map(() => 1), vel: axes.map(() => 0) });

function applyEvents(b: Body, events: WorldEvent[], hour: number, dir: 1 | -1) {
    const now = events.filter(e => e.hour === hour);
    if (dir < 0) now.reverse();
    for (const e of now) TRANSFORMS[e.t.id].apply(b, e.t, dir);
}

/** A body at an hour: each hour, the motion and then whatever happens on it. */
export function bodyAt(axes: Axis[], start: Body, events: WorldEvent[], hour: number, reading: Reading = FULL): Body {
    const b = copyBody(start);
    for (let h = 1; h <= hour; h++) {
        moveHour(b, axes, 1, reading);
        if (reading.events) applyEvents(b, events, h, 1);
    }
    return b;
}

/** The same, for a thing by index; the Post never moves and nothing moves it. */
export function thingAt(w: World, x: number, hour: number, reading: Reading = FULL): Body {
    return x === POST ? postBody(w.axes) : bodyAt(w.axes, w.start[x], w.events, hour, reading);
}

/* ------------------------------------------------------------------ *
 * Running a statement back to hour 0                                  *
 * ------------------------------------------------------------------ */

const posKey = (b: Body) => b.pos.join(",");

/**
 * The hour-0 body whose place at `tau` is `posTau`, given its hour-0 lengths
 * and pace, or null if there is not exactly one.
 */
export function solveStart(
    axes: Axis[], events: WorldEvent[], size0: number[], vel0: number[], tau: number, posTau: number[], reading: Reading,
): Body | null {
    /* Lengths and the deterministic part of the pace at tau: events alone change
       those, so a run without motion gives them. A twist can still flip a pace
       component, so every flip of the non-zero ones is tried. */
    const still = bodyAt(axes, { pos: axes.map(() => 0), size: size0, vel: vel0 }, events, tau, { ...reading, motion: false });
    const free = still.vel.map((v, i) => (v !== 0 ? i : -1)).filter(i => i >= 0);
    const found = new Map<string, Body>();
    for (let mask = 0; mask < (1 << free.length); mask++) {
        const vel = [...still.vel];
        free.forEach((i, j) => { if (mask & (1 << j)) vel[i] = -vel[i]; });
        const b: Body = { pos: [...posTau], size: [...still.size], vel };
        for (let h = tau; h >= 1; h--) {
            if (reading.events) applyEvents(b, events, h, -1);
            moveHour(b, axes, -1, reading);
        }
        if (!b.pos.every(Number.isInteger)) continue;
        if (!b.vel.every((v, i) => v === vel0[i]) || !b.size.every((v, i) => v === size0[i])) continue;
        const again = bodyAt(axes, b, events, tau, reading);
        if (!again.pos.every((v, i) => v === posTau[i])) continue;
        found.set(posKey(b), b);
    }
    return found.size === 1 ? [...found.values()][0] : null;
}

/* ------------------------------------------------------------------ *
 * The reader                                                          *
 * ------------------------------------------------------------------ */

export interface Card {
    axes: Axis[];
    things: number;
    speakers: number;
    statements: Statement[];
    /** How this card is worded: places compact, and two links to a sentence where they chain. */
    style?: { compact?: boolean; wide?: boolean };
}

export interface Reconstruction {
    world: World;
    /** The space inside the brackets, where the card has one. */
    inner?: World;
    /** Where each speaker stands and which ways they may face, where the card says. */
    observers?: Placed[];
    types: boolean[];
    /** The order speakers were unmasked in, for the explanation. */
    unmasked: Array<{ speaker: number; by: "claims" | Fact; space?: number }>;
}

/** A reconstruction's world for one space: 0 outside the brackets, 1 inside. */
export const spaceOf = (rec: { world: World; inner?: World }, space = 0): World => (space === 1 ? rec.inner! : rec.world);

/** Types settled by what speakers say about each other alone. */
export function settleByClaims(card: Card): Map<number, boolean> {
    const n = card.speakers;
    const claims: Array<{ speaker: number; claim: Claim }> = card.statements
        .filter(s => s.fact.kind === "type").map(s => ({ speaker: s.speaker, claim: (s.fact as { claim: Claim }).claim }));
    const solutions: boolean[][] = [];
    for (let mask = 0; mask < (1 << n); mask++) {
        const world = Array.from({ length: n }, (_, i) => (mask & (1 << i)) !== 0);
        if (claims.every(c => claimHolds(c.claim, world) === world[c.speaker])) solutions.push(world);
    }
    /* Anyone the same in every solution is settled — a speaker who is only
       spoken about included: "at least one of us is a knave", said by a knight,
       settles the other. One nobody mentions takes both values and is not. */
    const out = new Map<number, boolean>();
    if (!solutions.length) return out;
    for (let i = 0; i < n; i++) {
        if (solutions.every(s => s[i] === solutions[0][i])) out.set(i, solutions[0][i]);
    }
    return out;
}

/** A settled speaker's statement, with what their type makes of it. */
export interface Claimed {
    fact: Fact;
    /** Whether the fact is so: a knight's word, or the true version of a knave's two-valued one. */
    want: boolean;
}

/**
 * The lengths a thing can have, as far as the settled speakers say: 1 to 3
 * along each line, fixed where a knight gives it and narrowed where a knave
 * gives a length it is not. Rings and kinds have none.
 */
export function sizeOptions(axes: Axis[], x: number, claimed: Claimed[]): number[][] {
    let out: number[][] = [[]];
    axes.forEach((ax, a) => {
        let lens = ax.kind === "line" ? Array.from({ length: MAX_LEN }, (_, i) => i + 1) : [1];
        for (const c of claimed) {
            const f = c.fact;
            const said = f.kind === "size" && f.x === x && f.axis === a ? f.len
                : f.kind === "sizes" && f.x === x ? f.lens.find(([b]) => b === a)?.[1] : undefined;
            if (said === undefined) continue;
            lens = c.want ? lens.filter(l => l === said) : lens.filter(l => l !== said);
        }
        out = out.flatMap(prefix => lens.map(l => [...prefix, l]));
    });
    return out;
}

/** Past this many readings of the lengths, the card is too open to be worth enumerating. */
const SOLUTION_CAP = 32;

/** Where a speaker stands, and the ways they may be facing, in one reading. */
export type Placed = { host: number; facings: number[]; twin?: boolean; upside?: boolean } | null;

interface Derived {
    /** Every world the settled speakers allow, as hour-0 bodies (null where a thing cannot be placed). */
    solutions: Array<Array<Body | null>>;
    /** For each, where each speaker stands and the facings left open. */
    observers: Placed[][];
    /** Whether a fact holds in every world allowed, fails in every one, or is open. */
    decide(f: Fact): boolean | null;
    events: WorldEvent[];
    /** Events are known up to, not including, this hour. */
    horizon: number;
    consistent: boolean;
}

/* Kept across readings: a body solved under some events is only ever moved
   under those, so its places by the hour can hang off the body itself. */
const SOLVED = new Map<string, Map<string, Body | null>>();
const LATER = new WeakMap<Body, Map<number, Body>>();
/** Forget what earlier cards' readings worked out; the builder calls it per world. */
export function clearReaderCache() { SOLVED.clear(); }

/** Everything the settled speakers establish, under a reading. */
function derive(card: Card, types: Array<boolean | undefined>, reading: Reading, space = 0): Derived {
    const axes = card.axes, n = card.things;
    const claimed: Claimed[] = [];
    const here = card.statements.filter(s => (s.space ?? 0) === space);
    for (const s of here) {
        if (types[s.speaker] === undefined || s.fact.kind === "type") continue;
        if (types[s.speaker]) { claimed.push({ fact: s.fact, want: true }); continue; }
        const f = negate(s.fact);
        claimed.push(f ? { fact: f, want: true } : { fact: s.fact, want: false });
    }
    const said = (kind: Fact["kind"]) => claimed.filter(c => c.want && c.fact.kind === kind).map(c => c.fact);
    const pending = here.filter(s => types[s.speaker] === undefined && s.fact.kind !== "type");
    let consistent = true;

    /* Events: known up to the first hour an unsettled speaker says something happens. */
    let horizon = Infinity;
    if (reading.events) for (const s of pending) if (s.fact.kind === "event") horizon = Math.min(horizon, s.fact.hour);
    const events: WorldEvent[] = reading.events
        ? (said("event") as Array<Extract<Fact, { kind: "event" }>>).map(f => ({ hour: f.hour, t: f.t }))
        : [];

    /* Paces: unknown while an unsettled speaker has a word on them. */
    const vel: Array<number[] | null> = [];
    for (let x = 0; x < n; x++) {
        if (!reading.motion) { vel.push(axes.map(() => 0)); continue; }
        if (pending.some(s => s.fact.kind === "pace" && s.fact.x === x)) { vel.push(null); continue; }
        const paces = (said("pace") as Array<Extract<Fact, { kind: "pace" }>>).filter(f => f.x === x);
        if (paces.some(p => p.vel.join() !== paces[0].vel.join())) consistent = false;
        vel.push(paces.length ? [...paces[0].vel] : axes.map(() => 0));
    }

    /* The order things are placed in: outwards from the Post, each by the first
       place that ties it to something already placed. */
    const places = (said("place") as Array<Extract<Fact, { kind: "place" }>>).filter(p => p.hour < horizon);
    const order: Array<{ x: number; from: number; p: Extract<Fact, { kind: "place" }>; sign: 1 | -1 }> = [];
    const placed = new Set<number>([POST]);
    for (let grew = true; grew;) {
        grew = false;
        for (const p of places) {
            if (placed.has(p.y) && !placed.has(p.x)) { order.push({ x: p.x, from: p.y, p, sign: 1 }); placed.add(p.x); grew = true; }
            else if (placed.has(p.x) && !placed.has(p.y)) { order.push({ x: p.y, from: p.x, p, sign: -1 }); placed.add(p.y); grew = true; }
        }
    }

    const post = postBody(axes);
    /* The search meets the same bodies on branch after branch, and one card is
       read many times over, so where a body is at an hour and what a place runs
       back to are each worked out once for a given set of events and way of
       reading. Without it a seven-axis card took twenty seconds. */
    const key = `${JSON.stringify(events)}|${reading.motion}${reading.seams}${reading.events}`;
    let solved = SOLVED.get(key);
    if (!solved) SOLVED.set(key, (solved = new Map()));
    const whereAt = (b: Body, hour: number) => {
        let m = LATER.get(b);
        if (!m) LATER.set(b, (m = new Map()));
        let at = m.get(hour);
        if (!at) m.set(hour, (at = bodyAt(axes, b, events, hour, reading)));
        return at;
    };
    const solve = (size: number[], v: number[], tau: number, posTau: number[]) => {
        const k = `${size}|${v}|${tau}|${posTau}`;
        if (!solved!.has(k)) solved!.set(k, solveStart(axes, events, size, v, tau, posTau, reading));
        return solved!.get(k)!;
    };
    /* Where the speakers stand, as the settled speakers say: in a thing, and
       facing a way where that is said too. A reader who ignores headings takes
       ahead for north and left for west, whoever is speaking. */
    const stood: Placed[] = Array.from({ length: card.speakers }, () => null);
    for (const c of claimed) {
        const f = c.fact;
        if (!c.want || f.kind !== "stands") continue;
        const was = stood[f.who];
        const facings = (was?.facings ?? [0, 1, 2, 3]).filter(g => f.facing === undefined || g === f.facing);
        if (was && was.host !== f.host) consistent = false;
        stood[f.who] = reading.perspective
            ? { host: f.host, facings, twin: f.twin, upside: f.upside }
            : { host: f.host, facings: [0] };
    }
    /* Each speaker's facing, narrowed by what they say they see. */
    const facedIn = (start: Array<Body | null>): Placed[] | null => {
        const out: Placed[] = [];
        for (let who = 0; who < stood.length; who++) {
            const o = stood[who];
            if (!o) { out.push(null); continue; }
            const own = checked.filter(c => c.fact.kind === "view" && c.fact.who === who);
            const facings = o.facings.filter(g => {
                const v = viewOf(start, stood.map((p, i) => (i === who ? { ...o, facings: [g] } : p)));
                return own.every(c => !fails(c, v));
            });
            if (!facings.length) return null;
            out.push({ ...o, facings });
        }
        return out;
    };
    const viewOf = (start: Array<Body | null>, obs: Placed[] = []): View => {
        const at = (x: number, hour: number): Body | null => {
            if (x === POST) return post;
            if (!start[x] || hour >= horizon) return null;
            return whereAt(start[x]!, hour);
        };
        return {
            axes, at,
            start: x => (x === POST ? post : start[x] ?? null),
            eventsKnownThrough: h => h < horizon,
            events: () => (horizon === Infinity ? events : null),
            types,
            observer: who => obs[who] ?? null,
        };
    };
    /* A shortcut reader sets aside what its shortcut ignores and reasons on with
       the rest: a reader who ignores motion has not refuted the paces, and one
       who takes everything for a point has not refuted the statements that say
       how stretches lie — those are where the lengths are told, so holding that
       reader to them would only stop it at the first. It still judges the
       unsettled speakers by them, as points, which is where it goes wrong. */
    const checked = claimed.filter(c => !((!reading.motion && c.fact.kind === "pace") || (!reading.events && c.fact.kind === "event")
        || (!reading.sizes && (c.fact.kind === "rel" || c.fact.kind === "size" || c.fact.kind === "sizes" || c.fact.kind === "cmp"))));
    const things = (f: Fact) => ("x" in f ? [f.x, ...("y" in f ? [f.y] : [])] : []).filter(t => t !== POST);
    /* Each check is made as soon as everything it names is placed. */
    const due = order.map((_, k) => checked.filter(c => {
        const ts = things(c.fact);
        return ts.length > 0 && ts.includes(order[k].x) && ts.every(t => order.slice(0, k + 1).some(o => o.x === t));
    }));
    const fails = (c: Claimed, v: View) => { const h = holds(c.fact, v); return h !== null && h !== c.want; };

    /* Every way of giving each placed thing its one long side that the
       settled speakers allow, placed thing by placed thing, each checked as
       soon as it can be. */
    const options = Array.from({ length: n }, (_, x) => (reading.sizes ? sizeOptions(axes, x, claimed) : [axes.map(() => 1)]));
    const solutions: Array<Array<Body | null>> = [];
    const observers: Placed[][] = [];
    const start: Array<Body | null> = Array(n).fill(null);
    const search = (k: number) => {
        if (solutions.length > SOLUTION_CAP) return;
        if (k === order.length) {
            const obs = facedIn(start);
            if (!obs) return;
            const v = viewOf(start, obs);
            if (!checked.some(c => fails(c, v))) { solutions.push([...start]); observers.push(obs); }
            return;
        }
        const { x, from, p, sign } = order[k];
        const ref = viewOf(start).at(from, p.hour);
        if (!vel[x] || !ref) { search(k + 1); return; }
        const posTau = axes.map((ax, i) => {
            const v = ref.pos[i] + sign * p.delta[i];
            return ax.kind === "ring" ? mod(v, ax.modulus!) : ax.kind === "parity" ? mod(v, 2) : v;
        });
        /* Read on local clocks, the time gap is the clocks' and not the world's:
           take off the step per step clockwise that the two clocks differ by. */
        if (p.local) {
            const t = ref.pos[TIME] + sign * p.delta[TIME] - (mod(posTau[0], axes[0].modulus!) - mod(ref.pos[0], axes[0].modulus!));
            posTau[TIME] = axes[TIME].kind === "ring" ? mod(t, axes[TIME].modulus!) : t;
        }
        for (const size of options[x]) {
            const b = solve(size, vel[x]!, p.hour, posTau);
            if (!b) continue;
            start[x] = b;
            const v = viewOf(start);
            if (!due[k].some(c => fails(c, v))) search(k + 1);
        }
        start[x] = null;
    };
    search(0);
    if (!solutions.length || solutions.length > SOLUTION_CAP) consistent = false;

    const views = solutions.map((st, k) => viewOf(st, observers[k]));
    const decide = (f: Fact): boolean | null => {
        const hs = views.map(v => holds(f, v));
        return hs.length && hs.every(h => h !== null && h === hs[0]) ? hs[0] : null;
    };
    return { solutions, observers, decide, events, horizon, consistent };
}

/**
 * Every world the card allows once these speakers are settled, as hour-0
 * bodies — capped, so a card that leaves too much open says so by being long.
 * For the builder, which adds what tells the lengths until only one is left.
 */
export function worlds(card: Card, types: Array<boolean | undefined>, space = 0): Array<Array<Body | null>> {
    return derive(card, types, FULL, space).solutions;
}

/**
 * Rebuild the world from the card under a reading, or null when that reading
 * cannot: speakers left unmasked, things left unplaced, lengths left open, or a
 * contradiction.
 */
export function read(card: Card, reading: Reading = FULL): Reconstruction | null {
    const types: Array<boolean | undefined> = Array(card.speakers).fill(undefined);
    const unmasked: Reconstruction["unmasked"] = [];
    if (!reading.liars) for (let i = 0; i < card.speakers; i++) types[i] = true;
    else for (const [i, t] of settleByClaims(card)) { types[i] = t; unmasked.push({ speaker: i, by: "claims" }); }

    /* Both spaces read side by side: a speaker can be unmasked by what they say
       inside the brackets as well as outside, and what that settles is then
       used in both. */
    const spaces = card.statements.some(s => s.space === 1) ? [0, 1] : [0];
    for (let guard = 0; guard < card.speakers + 2; guard++) {
        const ds = spaces.map(sp => derive(card, types, reading, sp));
        if (ds.some(d => !d.consistent)) return null;
        let changed = false;
        for (let i = 0; i < card.speakers; i++) {
            if (types[i] !== undefined) continue;
            for (const s of card.statements) {
                if (s.speaker !== i || s.fact.kind === "type") continue;
                const h = ds[s.space ?? 0].decide(s.fact);
                if (h === null) continue;
                types[i] = h;
                unmasked.push({ speaker: i, by: s.fact, space: s.space });
                changed = true;
                break;
            }
        }
        if (!changed) break;
    }

    if (types.some(t => t === undefined)) return null;
    const ds = spaces.map(sp => derive(card, types, reading, sp));
    if (ds.some(d => !d.consistent || d.horizon !== Infinity || d.solutions.length !== 1 || d.solutions[0].some(b => !b))) return null;
    /* The speakers' own claims about each other have to hold of the types arrived at. */
    if (reading.liars) for (const s of card.statements) {
        if (s.fact.kind === "type" && claimHolds(s.fact.claim, types as boolean[]) !== types[s.speaker]) return null;
    }
    const worldOf = (d: Derived): World => ({ axes: card.axes, start: d.solutions[0] as Body[], events: d.events });
    return { world: worldOf(ds[0]), ...(ds[1] ? { inner: worldOf(ds[1]) } : {}), observers: ds[0].observers[0], types: types as boolean[], unmasked };
}
