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
 *      speakers establish (paces, lengths, the events, places at hour 0), and
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
import { Fact, POST, Statement, View, holds, negate } from "./facts";

export interface WorldEvent { hour: number; t: TransformSpec }

export interface World {
    axes: Axis[];
    /** Every thing's body at hour 0, the Post excepted. */
    start: Body[];
    events: WorldEvent[];
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
}

export interface Reconstruction {
    world: World;
    types: boolean[];
    /** The order speakers were unmasked in, for the explanation. */
    unmasked: Array<{ speaker: number; by: "claims" | Fact }>;
}

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
    const out = new Map<number, boolean>();
    if (!solutions.length) return out;
    const mentioned = new Set(claims.flatMap(c => [c.speaker]));
    for (let i = 0; i < n; i++) {
        if (!mentioned.has(i)) continue;
        if (solutions.every(s => s[i] === solutions[0][i])) out.set(i, solutions[0][i]);
    }
    return out;
}

interface Derived {
    view: View;
    start: Array<Body | null>;
    events: WorldEvent[];
    /** Events are known up to, not including, this hour. */
    horizon: number;
    consistent: boolean;
}

/** Everything the settled speakers establish, under a reading. */
function derive(card: Card, types: Array<boolean | undefined>, reading: Reading): Derived {
    const axes = card.axes, n = card.things;
    const settled = (s: Statement) => types[s.speaker] !== undefined;
    const usable: Fact[] = [];
    for (const s of card.statements) {
        if (!settled(s) || s.fact.kind === "type") continue;
        if (types[s.speaker]) usable.push(s.fact);
        else { const f = negate(s.fact); if (f) usable.push(f); }
    }
    const pending = card.statements.filter(s => !settled(s) && s.fact.kind !== "type");
    let consistent = true;

    /* Events: known up to the first hour an unsettled speaker says something happens. */
    let horizon = Infinity;
    if (reading.events) for (const s of pending) if (s.fact.kind === "event") horizon = Math.min(horizon, s.fact.hour);
    const events: WorldEvent[] = reading.events
        ? usable.filter(f => f.kind === "event").map(f => ({ hour: (f as { hour: number }).hour, t: (f as { t: TransformSpec }).t }))
        : [];

    /* Paces and lengths: unknown while an unsettled speaker has a word on them. */
    const vel: Array<number[] | null> = [], size: Array<number[] | null> = [];
    for (let x = 0; x < n; x++) {
        if (!reading.motion) vel.push(axes.map(() => 0));
        else if (pending.some(s => s.fact.kind === "pace" && s.fact.x === x)) vel.push(null);
        else {
            const said = usable.filter(f => f.kind === "pace" && f.x === x) as Array<{ vel: number[] }>;
            if (said.length > 1 && said.some(p => p.vel.join() !== said[0].vel.join())) consistent = false;
            vel.push(said.length ? [...said[0].vel] : axes.map(() => 0));
        }
        const sz: number[] = [];
        let known = true;
        for (let a = 0; a < axes.length; a++) {
            if (!reading.sizes) { sz.push(1); continue; }
            if (pending.some(s => s.fact.kind === "size" && s.fact.x === x && s.fact.axis === a)) { known = false; sz.push(1); continue; }
            const said = usable.filter(f => f.kind === "size" && f.x === x && f.axis === a) as Array<{ long: boolean }>;
            if (said.length > 1 && said.some(p => p.long !== said[0].long)) consistent = false;
            sz.push(said.length && said[0].long ? 3 : 1);
        }
        size.push(known ? sz : null);
    }

    /* Places: carried back to hour 0 one statement at a time, outwards from the Post. */
    const start: Array<Body | null> = Array(n).fill(null);
    const post = postBody(axes);
    const at = (x: number, hour: number): Body | null => {
        if (x === POST) return post;
        if (!start[x] || hour >= horizon) return null;
        return bodyAt(axes, start[x]!, events, hour, reading);
    };
    const places = usable.filter(f => f.kind === "place") as Array<Extract<Fact, { kind: "place" }>>;
    for (let grew = true; grew;) {
        grew = false;
        for (const p of places) {
            if (p.hour >= horizon) continue;
            const known = (x: number) => x === POST || !!start[x];
            const fill = (target: number, from: number, sign: 1 | -1) => {
                if (!vel[target] || !size[target]) return;
                const ref = at(from, p.hour)!;
                const posTau = axes.map((ax, i) => {
                    const v = ref.pos[i] + sign * p.delta[i];
                    return ax.kind === "ring" ? mod(v, ax.modulus!) : ax.kind === "parity" ? mod(v, 2) : v;
                });
                const b = solveStart(axes, events, size[target]!, vel[target]!, p.hour, posTau, reading);
                if (b) { start[target] = b; grew = true; }
                else consistent = false;
            };
            if (known(p.y) && !known(p.x)) fill(p.x, p.y, 1);
            else if (known(p.x) && !known(p.y)) fill(p.y, p.x, -1);
        }
    }

    const view: View = {
        axes,
        at,
        start: x => (x === POST ? post : start[x] ?? null),
        eventsKnownThrough: h => h < horizon,
        events: () => (horizon === Infinity ? events : null),
        types,
    };
    /* Everything usable has to hold of what was built from it. A reader who takes
       everyone at their word is not checking anyone, so the checkable reports are
       not checked either: that reader builds on the knaves' versions instead of
       stopping at the first contradiction, which would make "the liars matter"
       true of every item for no reason to do with the item. */
    for (const f of usable) {
        if (!reading.liars && (f.kind === "rel" || f.kind === "type")) continue;
        /* A shortcut reader sets aside what its shortcut ignores and reasons on with
           the rest: a reader who ignores motion has not refuted the paces. */
        if ((!reading.motion && f.kind === "pace") || (!reading.sizes && f.kind === "size") || (!reading.events && f.kind === "event")) continue;
        if (holds(f, view) === false) consistent = false;
    }
    return { view, start, events, horizon, consistent };
}

/**
 * Rebuild the world from the card under a reading, or null when that reading
 * cannot: speakers left unmasked, things left unplaced, or a contradiction.
 */
export function read(card: Card, reading: Reading = FULL): Reconstruction | null {
    const types: Array<boolean | undefined> = Array(card.speakers).fill(undefined);
    const unmasked: Reconstruction["unmasked"] = [];
    if (!reading.liars) for (let i = 0; i < card.speakers; i++) types[i] = true;
    else for (const [i, t] of settleByClaims(card)) { types[i] = t; unmasked.push({ speaker: i, by: "claims" }); }

    for (let guard = 0; guard < card.speakers + 2; guard++) {
        const d = derive(card, types, reading);
        if (!d.consistent) return null;
        let changed = false;
        for (let i = 0; i < card.speakers; i++) {
            if (types[i] !== undefined) continue;
            for (const s of card.statements) {
                if (s.speaker !== i || s.fact.kind === "type") continue;
                const h = holds(s.fact, d.view);
                if (h === null) continue;
                types[i] = h;
                unmasked.push({ speaker: i, by: s.fact });
                changed = true;
                break;
            }
        }
        if (!changed) break;
    }

    if (types.some(t => t === undefined)) return null;
    const d = derive(card, types, reading);
    if (!d.consistent || d.horizon !== Infinity || d.start.some(b => !b)) return null;
    /* The speakers' own claims about each other have to hold of the types arrived at. */
    if (reading.liars) for (const s of card.statements) {
        if (s.fact.kind === "type" && claimHolds(s.fact.claim, types as boolean[]) !== types[s.speaker]) return null;
    }
    return { world: { axes: card.axes, start: d.start as Body[], events: d.events }, types: types as boolean[], unmasked };
}
