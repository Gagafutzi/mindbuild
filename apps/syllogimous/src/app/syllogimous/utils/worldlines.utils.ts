/**
 * Worldlines — the arithmetic, kept apart from the wording.
 *
 * Everything moves at a constant pace, and each placement holds at the hour it
 * names. A placement stamped τ says p_to(τ) − p_from(τ) = δ, so at hour 0 it says
 * p_to − p_from = δ − (v_to − v_from)·τ: every premise needs its own correction
 * before it can be chained, and with different stamps the corrections do not
 * telescope. That is why the intermediate movers matter, and why each reading
 * below that skips a correction lands somewhere else.
 *
 * Pure, so `tests/worldlines.test.ts` can hold the generator to a reader that
 * works from the card's text alone and scans hours instead of solving.
 */

export type Vec = number[];

/** One placement: at `hour`, `to` stands `delta` from `from`. */
export interface Stamped {
    from: string;
    to: string;
    delta: Vec;
    hour: number;
}

export interface World {
    words: string[];
    dims: number;
    velocity: Map<string, Vec>;
    edges: Stamped[];
}

export const sign = (n: number) => (n > 0 ? 1 : n < 0 ? -1 : 0);
const add = (a: Vec, b: Vec) => a.map((v, i) => v + b[i]);
const sub = (a: Vec, b: Vec) => a.map((v, i) => v - b[i]);
const scale = (a: Vec, k: number) => a.map(v => v * k);

/**
 * Hour-0 positions, measured from the first word.
 *
 * The velocities are a parameter so a lure can be computed as the same walk with
 * some of the motion left out — which is exactly what a reader who forgot it
 * does.
 */
export function startsOf(world: World, velocity: Map<string, Vec> = world.velocity): Map<string, Vec> {
    const zero = Array(world.dims).fill(0);
    const v = (w: string) => velocity.get(w) ?? zero;
    const out = new Map<string, Vec>([[world.words[0], zero]]);
    for (let grew = true; grew;) {
        grew = false;
        for (const e of world.edges) {
            const a = out.get(e.from), b = out.get(e.to);
            if (a && !b) {
                out.set(e.to, add(a, sub(e.delta, scale(sub(v(e.to), v(e.from)), e.hour))));
                grew = true;
            } else if (b && !a) {
                out.set(e.from, sub(b, sub(e.delta, scale(sub(v(e.to), v(e.from)), e.hour))));
                grew = true;
            }
        }
    }
    return out;
}

/** Where `y` stands from `x` at hour `t`. */
export function relAt(world: World, starts: Map<string, Vec>, x: string, y: string, t: number,
    velocity: Map<string, Vec> = world.velocity): Vec {
    const zero = Array(world.dims).fill(0);
    const dv = sub(velocity.get(y) ?? zero, velocity.get(x) ?? zero);
    return add(sub(starts.get(y)!, starts.get(x)!), scale(dv, t));
}

/** The pair's relative pace: how much `y` gains on `x` each hour. */
export function relVelocity(world: World, x: string, y: string): Vec {
    const zero = Array(world.dims).fill(0);
    return sub(world.velocity.get(y) ?? zero, world.velocity.get(x) ?? zero);
}

/**
 * The hour the pair is level on one axis, or null when there is no single one.
 *
 * Only whole hours count, because the card names hours as clock times; a pair
 * that crosses between two of them is never level at an hour anyone can say.
 */
export function levelHour(world: World, starts: Map<string, Vec>, x: string, y: string, axis: number): number | null {
    const gap = relAt(world, starts, x, y, 0)[axis];
    const dv = relVelocity(world, x, y)[axis];
    if (dv === 0) return null;
    if (gap % dv !== 0) return null;
    return -gap / dv;
}

/**
 * The hour they share a place, or null for never.
 *
 * Level on every axis at *one* hour. An axis on which they never move apart and
 * already stand together places no constraint; one where they never move apart
 * and stand apart rules a meeting out.
 */
export function meetHour(world: World, starts: Map<string, Vec>, x: string, y: string): number | null {
    let hour: number | null = null;
    const rel0 = relAt(world, starts, x, y, 0);
    const dv = relVelocity(world, x, y);
    for (let k = 0; k < world.dims; k++) {
        if (dv[k] === 0) {
            if (rel0[k] !== 0) return null;
            continue;
        }
        const h = levelHour(world, starts, x, y, k);
        if (h === null) return null;
        if (hour !== null && hour !== h) return null;
        hour = h;
    }
    return hour;
}

/** The placements on the tree path from `x` to `y`, each oriented along it. */
export function pathOf(world: World, x: string, y: string): Array<{ edge: Stamped; forward: boolean }> {
    const back = new Map<string, { prev: string; edge: Stamped; forward: boolean }>();
    const seen = new Set([x]);
    const queue = [x];
    while (queue.length) {
        const at = queue.shift()!;
        if (at === y) break;
        for (const e of world.edges) {
            const next = e.from === at ? e.to : e.to === at ? e.from : null;
            if (!next || seen.has(next)) continue;
            seen.add(next);
            back.set(next, { prev: at, edge: e, forward: e.from === at });
            queue.push(next);
        }
    }
    const out: Array<{ edge: Stamped; forward: boolean }> = [];
    for (let at = y; at !== x;) {
        const step = back.get(at);
        if (!step) return [];
        out.unshift({ edge: step.edge, forward: step.forward });
        at = step.prev;
    }
    return out;
}

/* ------------------------------------------------------------------ *
 * The readings that skip a correction                                *
 * ------------------------------------------------------------------ */

/** Every stamp ignored: the placements added up as if they held at once. */
export function staticChain(world: World, x: string, y: string): Vec {
    return pathOf(world, x, y).reduce(
        (acc, s) => add(acc, s.forward ? s.edge.delta : scale(s.edge.delta, -1)),
        Array(world.dims).fill(0));
}

/** The latest stamp on the path from `x` to `y`: where chain-then-move starts. */
export function latestStamp(world: World, x: string, y: string): number {
    return Math.max(...pathOf(world, x, y).map(s => s.edge.hour));
}

/**
 * The stamps collapsed into the last one: chain as if everything held then,
 * and move the asked pair on from there.
 */
export function chainThenMove(world: World, x: string, y: string, t: number): Vec {
    return add(staticChain(world, x, y), scale(relVelocity(world, x, y), t - latestStamp(world, x, y)));
}

/** Motion applied to the asked pair, and the movers that carried the chain held still. */
export function endpointsOnly(world: World, x: string, y: string, t: number): Vec {
    const zero = Array(world.dims).fill(0);
    const kept = new Map<string, Vec>(world.words.map(w =>
        [w, w === x || w === y ? world.velocity.get(w) ?? zero : zero]));
    return relAt(world, startsOf(world, kept), x, y, t, kept);
}
