/**
 * Twisted seam, the loop-closure form: "can all of these be true at once?"
 *
 * One ring axis with a twist in it, an anchor that pins both the column and the
 * centre line, a tree of placements, and one closing placement that goes the
 * other way round the ring. The closing placement is true to the twist or states
 * what the arrangement would give without it, and the question is whether the
 * whole set holds together.
 *
 * Only this form, as the judge ruled: a claim about one pair in the chart
 * depends on which way round the pair is taken, a convention a player has no
 * geometric reason to prefer. Whether a set of placements can all hold needs no
 * convention — each one names its own way round.
 *
 * ── What makes an item well-formed ──
 *
 * The closing placement's true clause on the mirrored axis differs from the
 * clause the flat reading expects, and both are single steps. So the flat
 * reader — every clause added as written — calls the true set contradictory
 * and the false one consistent, on every item.
 */

import { EnumQuestionType } from "../constants/question.constants";
import { Question } from "../models/question.models";
import { getRandomSymbols, shuffle } from "../utils/question.utils";
import { hi, rel, subj } from "../utils/phrasing";
import { LinearScale } from "../utils/linear.utils";
import { AxisSpec, isParity, ndAxisColors, renderNdDirection } from "../utils/ndspace.utils";
import { TwistSpec, converse, flatStep, land, lapsOf, stepBetween } from "../utils/twist.utils";
import { TWIST_NOTE, TWIST_STEP_NOTE } from "./notes";
import { GeneratorContext } from "./context";

/** A ring of five: long enough that a step of two need not cross the twist. */
const RING = 5;

/** Which axis is the ring and which the twist mirrors, or null when the stack has neither. */
export function twistAxes(scales: LinearScale[]): { ring: number; acted: number } | null {
    const loops = scales.map((s, i) => (s.cyclic ? i : -1)).filter(i => i >= 0);
    if (!loops.length) return null;
    const ring = loops.find(i => scales[i].id === "east") ?? loops[0];
    const straight = scales
        .map((s, i) => i)
        .filter(i => i !== ring && !isParity({ scale: scales[i] }));
    if (!straight.length) return null;
    const acted = straight.find(i => scales[i].id === "north") ?? straight[0];
    return { ring, acted };
}

interface Statement { subject: string; reference: string; delta: number[] }

export function createTwistedSeam(
    ctx: GeneratorContext,
    type: EnumQuestionType,
    scales: LinearScale[],
    numOfPremises: number,
    branching: boolean,
    wantTrue: boolean,
): Question | null {
    const picked = twistAxes(scales);
    if (!picked) return null;
    const { ring, acted } = picked;
    const dims = scales.length;
    const spec: TwistSpec = { m: RING, ring, acted, dims };
    const axes: AxisSpec[] = scales.map((scale, i) => ({ scale, modulus: i === ring ? RING : undefined }));
    const straight: AxisSpec[] = scales.map(scale => ({ scale }));
    const colors = ndAxisColors(axes);
    const cyc = scales[ring].cyclic!;

    const clause = (i: number, d: number) => {
        if (i !== ring) return renderNdDirection(straight, i, d);
        if (d === 0) return hi(scales[ring].tie, colors[ring]);
        const n = Math.abs(d);
        return hi(`${n} ${n === 1 ? cyc.step : cyc.step + "s"} ${cyc.direction[d > 0 ? 0 : 1]}`, colors[ring]);
    };
    const pattern = (d: number[]) => d.map((v, i) => clause(i, v)).join(", ");
    const say = (s: Statement) => `${subj(s.subject)} is ${pattern(s.delta)} relative to ${subj(s.reference)}`;
    const unit = () => (Math.random() < 0.5 ? 1 : -1);

    // An anchor, a tree of placements between the rest, and the closing one.
    const objects = Math.max(3, numOfPremises - 1);

    for (let attempt = 0; attempt < 400; attempt++) {
        const words = getRandomSymbols(ctx.settings, objects);
        if (new Set(words).size !== words.length) continue;

        const chart = new Map<string, number[]>([[words[0], Array(dims).fill(0)]]);
        const stated: Statement[] = [];
        const parentOf = new Map<string, string>();
        for (let i = 1; i < words.length; i++) {
            const parent = branching ? words[Math.floor(Math.random() * i)] : words[i - 1];
            const delta = Array.from({ length: dims }, (_, k) =>
                k === ring ? Math.floor(Math.random() * 5) - 2 : (Math.random() < 0.25 ? 0 : unit()));
            if (delta.every(v => v === 0)) delta[acted] = unit();
            const at = land(spec, chart.get(parent)!, delta);
            if (Math.abs(at[acted]) > 3) break;
            chart.set(words[i], at);
            parentOf.set(words[i], parent);
            /*
             * Stated from either end. From the far end it is the converse, and
             * across the twist that is −g^L(d), not −d: the writer the tests
             * check, because a reader that negates a converse gets these wrong.
             */
            stated.push(Math.random() < 0.5
                ? { subject: words[i], reference: parent, delta }
                : { subject: parent, reference: words[i], delta: converse(spec, chart.get(parent)!, delta) });
        }
        if (chart.size !== words.length) continue;

        /* The flat reading, from the placements as written. */
        const flat = new Map<string, number[]>([[words[0], Array(dims).fill(0)]]);
        for (let grew = true; grew;) {
            grew = false;
            for (const s of stated) {
                const r = flat.get(s.reference), t = flat.get(s.subject);
                if (r && !t) { flat.set(s.subject, flatStep(spec, r, s.delta)); grew = true; }
                if (t && !r) { flat.set(s.reference, flatStep(spec, t, s.delta.map(v => -v))); grew = true; }
            }
        }

        /* The closing placement: a pair no placement states, walked a stated way round. */
        const pairs: Array<[string, string]> = [];
        for (const a of words) for (const b of words) {
            if (a === b || parentOf.get(a) === b || parentOf.get(b) === a) continue;
            pairs.push([a, b]);
        }
        const closings: Array<{ a: string; b: string; step: number[]; flatClause: number }> = [];
        for (const [a, b] of pairs) {
            const ca = chart.get(a)!, cb = chart.get(b)!;
            const r = ((ca[ring] - cb[ring]) % RING + RING) % RING;
            for (const k of [r - RING, r, r + RING]) {
                if (k === 0 || Math.abs(k) > RING) continue;
                const step = stepBetween(spec, cb, ca, k);
                if (!step || step.some((v, i) => i !== ring && Math.abs(v) > 1)) continue;
                const flatClause = flat.get(a)![acted] - flat.get(b)![acted];
                if (Math.abs(flatClause) > 1 || flatClause === step[acted]) continue;
                closings.push({ a, b, step, flatClause });
            }
        }
        if (!closings.length) continue;
        const close = closings[Math.floor(Math.random() * closings.length)];
        const closingDelta = wantTrue
            ? close.step
            : close.step.map((v, i) => (i === acted ? close.flatClause : v));
        const closing: Statement = { subject: close.a, reference: close.b, delta: closingDelta };

        const question = new Question(type);
        question.bucket = [...words];
        question.premises = [
            `${subj(words[0])} stands on the centre line, just ${hi(cyc.direction[0], colors[ring])} of the twist`,
            ...shuffle([...stated, closing].map(say)),
        ];
        question.conclusion = "All of these can be true at once";
        question.isValid = wantTrue;
        question.setup = [
            TWIST_STEP_NOTE,
            `The ${rel(cyc.direction[0])}/${rel(cyc.direction[1])} axis is a ring of <b>${RING}</b>`
            + " with a <b>twist</b> in it.",
            TWIST_NOTE(rel(scales[acted].direction[0]), rel(scales[acted].direction[1])),
        ];

        const where = (p: number[]) => [
            `column ${p[ring] + 1}`,
            ...p.map((v, i) => (i === ring ? "" : v === 0 ? scales[i].tie
                : `${Math.abs(v)} ${scales[i].direction[v > 0 ? 0 : 1]}`)).filter(Boolean),
        ].join(", ");
        const laps = Math.abs(lapsOf(spec, chart.get(close.b)![ring], close.step[ring]));
        question.explanation = [
            `counting columns ${cyc.direction[0]} from the twist, ${subj(words[0])} is in column 1, `
            + "on the centre line",
            ...words.slice(1).map(w => `${subj(w)}: ${where(chart.get(w)!)}`),
            `walking from ${subj(close.b)} the way the closing placement names `
            + (laps === 0 ? "does not cross the twist" : `crosses the twist ${laps === 1 ? "once" : `${laps} times`}`)
            + `, so ${subj(close.a)} is ${hi(pattern(close.step))} from there`,
            wantTrue
                ? "which is what it says, so every placement holds"
                : `it says ${pattern(closingDelta)} — the flat reading, which adds every clause as written`,
        ];
        return question;
    }
    return null;
}
