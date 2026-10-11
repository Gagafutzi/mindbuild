/**
 * Twisted seam — a ring axis whose seam mirrors another axis about its centre
 * line. A Möbius band in two dimensions; in more, the band with straight axes
 * alongside that the seam leaves alone.
 *
 * Positions are kept in the chart: a column 0..m−1 on the ring, counted
 * clockwise from the twist, and an offset from the centre line on every other
 * axis. The twist sits between column m−1 and column 0.
 *
 * A placement is walked from its reference, the way round it names: start at
 * the reference, go `k` columns, and add the other clauses as the reference
 * reads them. Each time the walk crosses the twist the acted axis is mirrored —
 * the position carried across, not the step — so where it lands depends on
 * where the reference stood and how far round it went. That is the coupling: no
 * clause on the acted axis can be added up without the ring.
 *
 * Self-contained on purpose. The composed spaces' layout code (`buildNdLayout`,
 * `coordsFromEdges`, the transforms) reduces a loop once at the end, which is
 * wrong across a twist; rewriting it for one rung would change every item, so
 * this rung builds its own small arrangement and asks only the loop-closure
 * question, which needs no route convention.
 */

export interface TwistSpec {
    /** Columns on the ring. */
    m: number;
    /** Which axis is the ring. */
    ring: number;
    /** Which axis the twist mirrors. */
    acted: number;
    dims: number;
}

const mod = (n: number, m: number) => ((n % m) + m) % m;

/** How many times a walk of `k` columns from column `col` crosses the twist, signed. */
export function lapsOf(spec: TwistSpec, col: number, k: number): number {
    return Math.floor((col + k) / spec.m);
}

/** Where a walk of `delta` from chart position `from` lands, in the chart. */
export function land(spec: TwistSpec, from: number[], delta: number[]): number[] {
    const laps = lapsOf(spec, from[spec.ring], delta[spec.ring]);
    return from.map((v, i) => {
        if (i === spec.ring) return mod(v + delta[i], spec.m);
        if (i === spec.acted) return (laps % 2 === 0 ? 1 : -1) * (v + delta[i]);
        return v + delta[i];
    });
}

/**
 * The same placement stated from the other end.
 *
 * If `to` is `delta` from `from`, then `from` is this from `to`: the ring step
 * reversed, and the acted clause −g^L(d) rather than −d, where L is the laps the
 * forward walk made. Across the twist each of two things can be south of the
 * other, which is the converse a reader must not take as the negation.
 */
export function converse(spec: TwistSpec, from: number[], delta: number[]): number[] {
    const laps = lapsOf(spec, from[spec.ring], delta[spec.ring]);
    return delta.map((d, i) => (i === spec.acted && laps % 2 !== 0 ? d : -d));
}

/**
 * The step a walk of `k` columns from `b` needs on the other axes to land on
 * `a`, or null if `k` does not reach `a`'s column.
 */
export function stepBetween(spec: TwistSpec, b: number[], a: number[], k: number): number[] | null {
    if (mod(b[spec.ring] + k, spec.m) !== a[spec.ring]) return null;
    const laps = lapsOf(spec, b[spec.ring], k);
    return a.map((v, i) => {
        if (i === spec.ring) return k;
        if (i === spec.acted) return (laps % 2 === 0 ? 1 : -1) * v - b[i];
        return v - b[i];
    });
}

/** The arrangement read without the twist: every clause added as written. */
export function flatStep(spec: TwistSpec, from: number[], delta: number[]): number[] {
    return from.map((v, i) => (i === spec.ring ? mod(v + delta[i], spec.m) : v + delta[i]));
}
