/**
 * Worldlines — things move, and each placement holds at its own hour.
 *
 * Every object keeps one constant pace all day, and every placement is stamped
 * with the hour it describes: "At 5 o'clock, Ash is west, south relative to
 * Bell." Chaining two placements stamped at different hours means carrying one
 * of them to the other's hour first, for every mover on the way — the asked
 * pair's motion alone is not enough, and neither is reading every stamp as the
 * same moment.
 *
 * ── Three forms, and only two of them couple ──
 *
 *   at     how does y stand to x at hour T. Each axis still decomposes once the
 *          stamps are applied, so this is the on-ramp and not a rung.
 *   level  the hour is set by one axis — when the pair draws level on it — and
 *          the answer is read on another. The asked axis cannot be carried
 *          alone, because *when* it is read is decided elsewhere.
 *   meet   do they ever share a place. Level on every axis at some hour is not
 *          meeting; the hours must coincide.
 *
 * A mode rather than a rung on the composed spaces because every piece of
 * `fillNdConclusion` — analogy, checkpoint, testimony, edits — reads a static
 * layout, which is the same reason Pivot Transforms and Mutual Moves stand apart.
 *
 * ── What makes an item well-formed ──
 *
 * The motion has to bite, checked on the shipped answer rather than assumed from
 * the construction: in `at`, the static chain, chain-then-move and endpoints-only
 * readings are all wrong; in `level`, the static reading is wrong and the asked
 * relation turns over during the day, so the hour the question names matters.
 */

import { EnumQuestionType } from "../constants/question.constants";
import { Question } from "../models/question.models";
import { canGenerateQuestion, clampPremises } from "../models/settings.models";
import { getRandomSymbols, shuffle } from "../utils/question.utils";
import { hi, subj } from "../utils/phrasing";
import {
    AxisSpec, axesForDimensions, ndAxisColors, renderNdDirection, renderNdPattern,
} from "../utils/ndspace.utils";
import {
    Stamped, Vec, World, chainThenMove, endpointsOnly, levelHour, meetHour,
    pathOf, relAt, relVelocity, sign, startsOf, staticChain,
} from "../utils/worldlines.utils";
import { GeneratorContext } from "./context";

/** The hours a card names. A twelve-hour face, so nothing past eleven. */
const FIRST_HOUR = 1;
const LAST_HOUR = 11;
const STAMP_HOURS = 6;

/* Axes are bought by premises, as in Pivot Transforms; a third axis is the
   width lever. Kept to the spatial three: a pace on "later" or "inside" is
   not something anything does. */
const axisCount = (numOfPremises: number) => (numOfPremises >= 6 ? 3 : 2);

const pick = <T>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)];
const unit = () => (Math.random() < 0.5 ? 1 : -1);
const clock = (h: number) => `${h} o'clock`;

export type WorldlineForm = "at" | "level" | "meet";

export function createWorldlines(ctx: GeneratorContext, numOfPremises: number): Question {
    ctx.logger.info("createWorldlines");

    const type = EnumQuestionType.Worldlines;
    const settings = ctx.settings;
    if (!canGenerateQuestion(type, numOfPremises, settings)) throw new Error("Cannot generate.");
    numOfPremises = clampPremises(type, numOfPremises);

    const dims = axisCount(numOfPremises);
    const axes: AxisSpec[] = axesForDimensions(dims).map(scale => ({ scale }));
    const colors = ndAxisColors(axes);
    const pattern = (v: Vec) => renderNdPattern(axes, v.map(sign));

    /*
     * One form per item, decided once rather than per attempt: a coin redrawn on
     * every retry is weighted by how often each form builds, which is not a
     * half. With both rungs held the other is recorded as not delivered, so it
     * is not charged.
     */
    const held = (["level", "meet"] as const).filter(r => ctx.hasRung(type, r));
    const form: WorldlineForm = held.length ? pick([...held]) : "at";
    /* The answer class, also decided once: east or west for `level`, a meeting
       or none for `meet`. */
    const wantPositive = Math.random() < 0.5;

    for (let attempt = 0; attempt < 600; attempt++) {
        const words = getRandomSymbols(settings, numOfPremises + 1);
        if (new Set(words).size !== words.length) continue;

        /* A tree of stamped unit placements, each new word against an earlier one. */
        const edges: Stamped[] = [];
        for (let i = 1; i < words.length; i++) {
            const delta: Vec = axes.map(() => (Math.random() < 0.25 ? 0 : unit()));
            if (delta.every(v => v === 0)) delta[Math.floor(Math.random() * dims)] = unit();
            edges.push({
                from: words[Math.floor(Math.random() * i)], to: words[i], delta,
                hour: FIRST_HOUR + Math.floor(Math.random() * STAMP_HOURS),
            });
        }
        const velocity = new Map<string, Vec>(words.map(w => {
            if (Math.random() < 0.3) return [w, Array(dims).fill(0)];
            const v: Vec = axes.map(() => (Math.random() < 0.3 ? 0 : unit()));
            return [w, v];
        }));
        const world: World = { words, dims, velocity, edges };

        /*
         * The asked pair: never one a premise states, so getting from one to the
         * other is a chain of corrections. `y` is a leaf, so its pace can be
         * chosen last — it moves y's own start and nothing else.
         */
        const leaves = words.filter(w => edges.filter(e => e.from === w || e.to === w).length === 1);
        const y = pick(leaves);
        const x = pick(words.filter(w => w !== y && pathOf(world, w, y).length >= 2));
        if (!x) continue;

        const paces = velocityChoices(dims);
        const built = shuffle(paces).map(v => {
            velocity.set(y, v);
            return form === "at" ? atItem(world, x, y)
                : form === "level" ? levelItem(world, x, y, wantPositive)
                : meetItem(world, x, y, wantPositive);
        }).find(item => item !== null);
        if (!built) continue;
        velocity.set(y, built.pace);

        const starts = startsOf(world);
        const question = new Question(type);
        question.bucket = [...words];

        /*
         * Order-free, and so scrambled: each placement carries its own hour, so
         * where it sits on the card says nothing. Pivot Transforms keeps its
         * order because its move is the clock; here the stamp is.
         */
        const placements = edges.map(e => Math.random() < 0.5
            ? `At ${clock(e.hour)}, ${subj(e.to)} is ${pattern(e.delta)} relative to ${subj(e.from)}`
            : `At ${clock(e.hour)}, ${subj(e.from)} is ${pattern(e.delta.map(d => -d))} relative to ${subj(e.to)}`);
        const paceLines = words
            .filter(w => velocity.get(w)!.some(c => c !== 0))
            .map(w => `Every hour, ${subj(w)} ends up ${pattern(velocity.get(w)!)} `
                + `relative to where it was the hour before`);
        question.premises = shuffle([...placements, ...paceLines]);

        question.setup = [
            "Each placement holds at the hour it names, one block per direction named.",
            `Anything that moves keeps the same pace ${hi("all day")}, before and after the `
            + "hours mentioned. Anything not said to move stays where it is.",
        ];

        const shown = shuffle([
            { text: built.right, right: true },
            { text: built.wrong, right: false },
        ]);
        question.choices = shown.map(c => c.text);
        question.correctChoice = shown.findIndex(c => c.right);
        question.answerMode = "choice";
        question.choicePrompt = built.prompt;
        question.conclusion = "";
        question.isValid = true;
        question.undelivered.push(...held.filter(r => r !== form));

        const at0 = words.filter(w => w !== words[0])
            .map(w => `${subj(w)} ${measured(starts.get(w)!)}`);
        question.explanation = [
            `carry every placement back to hour 0 by undoing the moves since its stamp; `
            + `from ${subj(words[0])} then: ${at0.join("; ")}`,
            `${subj(y)} gains ${measured(relVelocity(world, x, y))} on ${subj(x)} every hour`,
            ...built.explain,
        ];
        return question;
    }
    throw new Error("Cannot generate.");

    /** A displacement with its size, in each axis's colour: "2 east, same latitude". */
    function measured(v: Vec): string {
        return axes.map((axis, i) => hi(v[i] === 0
            ? axis.scale.tie
            : `${Math.abs(v[i])} ${axis.scale.direction[v[i] > 0 ? 0 : 1]}`, colors[i])).join(", ");
    }

    interface Built { pace: Vec; prompt: string; right: string; wrong: string; explain: string[] }

    function atItem(world: World, x: string, y: string): Built | null {
        const t = FIRST_HOUR + Math.floor(Math.random() * (LAST_HOUR - FIRST_HOUR + 1));
        const starts = startsOf(world);
        const answer = relAt(world, starts, x, y, t).map(sign);
        if (answer.every(v => v === 0)) return null;
        const key = (v: Vec) => v.map(sign).join(",");

        /* Every shortcut has to land somewhere else, or it passes the item. */
        const lures = [
            staticChain(world, x, y),
            chainThenMove(world, x, y, t),
            endpointsOnly(world, x, y, t),
        ].map(v => v.map(sign));
        if (lures.some(l => key(l) === key(answer))) return null;

        /* A near miss when there is one: wrong on one axis, so every axis has
           to be checked before either is ruled out. */
        const near = lures.filter(l => l.filter((c, i) => c !== answer[i]).length === 1);
        const wrong = pick(near.length ? near : lures);
        /* No length thinning, unlike Pivot Transforms: the lures carry ties as
           often as the answer does, and measured unthinned the longer option is
           right on 47% of the items where the two differ. Pivot's 0.69 here
           pushed it to 37%, a rule the other way. */
        return {
            pace: world.velocity.get(y)!,
            prompt: `At ${clock(t)}, how does ${y} stand to ${x}?`,
            right: pattern(answer),
            wrong: pattern(wrong),
            explain: [
                `at ${clock(t)} that puts ${subj(y)} ${measured(relAt(world, starts, x, y, t))} `
                + `of ${subj(x)}: ${hi(pattern(answer))}`,
                `added up as if every placement held at once it would read `
                + `${pattern(staticChain(world, x, y))}`,
            ],
        };
    }

    function levelItem(world: World, x: string, y: string, positive: boolean): Built | null {
        const starts = startsOf(world);
        const dv = relVelocity(world, x, y);
        const options: Array<{ e: number; a: number; h: number }> = [];
        for (let e = 0; e < dims; e++) {
            const h = levelHour(world, starts, x, y, e);
            if (h === null || h < FIRST_HOUR || h > LAST_HOUR) continue;
            for (let a = 0; a < dims; a++) {
                if (a === e || dv[a] === 0) continue;
                const s = sign(relAt(world, starts, x, y, h)[a]);
                if (s !== (positive ? 1 : -1)) continue;
                /* The static reading is wrong, and the asked relation turns over
                   during the day — so reading it at the wrong hour can flip it. */
                if (sign(staticChain(world, x, y)[a]) === s) continue;
                const turns = -relAt(world, starts, x, y, 0)[a] / dv[a];
                if (turns < 0 || turns > LAST_HOUR) continue;
                options.push({ e, a, h });
            }
        }
        if (!options.length) return null;
        const { e, a, h } = pick(options);
        const at = relAt(world, starts, x, y, h);
        const level = `the ${renderNdDirection(axes, e, 0)}`;
        return {
            pace: world.velocity.get(y)!,
            prompt: `When ${y} and ${x} reach ${level}, how does ${y} stand to ${x}?`,
            right: renderNdDirection(axes, a, sign(at[a])),
            wrong: renderNdDirection(axes, a, -sign(at[a])),
            explain: [
                `they reach ${level} at ${clock(h)}, decided on that axis alone`,
                `at ${clock(h)}, ${subj(y)} is ${measured(at)} of ${subj(x)}: `
                + `${hi(renderNdDirection(axes, a, sign(at[a])))}`,
                `added up as if every placement held at once it would read `
                + `${pattern(staticChain(world, x, y))}`,
            ],
        };
    }

    function meetItem(world: World, x: string, y: string, meets: boolean): Built | null {
        const starts = startsOf(world);
        /* Every axis has its own level hour, on the clock; whether they coincide
           is the item. An axis on which they never part has none (`levelHour` is
           null for it), and would make the meeting a question about fewer axes
           than the card has. */
        const hours: number[] = [];
        for (let k = 0; k < dims; k++) {
            const h = levelHour(world, starts, x, y, k);
            if (h === null || h < FIRST_HOUR || h > LAST_HOUR) return null;
            hours.push(h);
        }
        const hour = meetHour(world, starts, x, y);
        if ((hour !== null) !== meets) return null;
        const never = "They never meet";
        const atHour = (h: number) => `At ${clock(h)}`;
        const perAxis = hours.map((h, k) =>
            `they reach the ${renderNdDirection(axes, k, 0)} at ${clock(h)}`);
        if (hour !== null) {
            return {
                pace: world.velocity.get(y)!,
                prompt: `Do ${y} and ${x} ever stand in the same place? If so, when?`,
                right: atHour(hour), wrong: never,
                explain: [...perAxis, `every axis at ${hi(clock(hour))}, so they meet then`],
            };
        }
        /* The lure is one axis's own level hour: what a reader who finds the
           pair level on one axis and stops there would answer. */
        return {
            pace: world.velocity.get(y)!,
            prompt: `Do ${y} and ${x} ever stand in the same place? If so, when?`,
            right: never, wrong: atHour(pick(hours)),
            explain: [...perAxis, `level on each, but ${hi("never on all at once")}`],
        };
    }
}

/** Every pace a mover can have: one block or none on each axis. */
function velocityChoices(dims: number): Vec[] {
    let out: Vec[] = [[]];
    for (let k = 0; k < dims; k++) out = out.flatMap(v => [[...v, -1], [...v, 0], [...v, 1]]);
    return out;
}

