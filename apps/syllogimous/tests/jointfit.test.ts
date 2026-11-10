/**
 * Every cost fitted at once, checked the only way a fit can be: plant values the
 * fitter is never told, generate answers from them, and see whether they come
 * back.
 *
 * The case the joint fit exists for is the prefix. Rungs are claimed in order, so
 * an item carrying the second rung always carries the first, and fitting the
 * first alone soaks up whatever is wrong with the second. Here the first rung's
 * table cost is right and the second's is a level and a half short, and the
 * one-at-a-time fit blames the first.
 */

import { assert, seeded, test } from "./harness";
import {
    DEFAULT_ABILITY, RUNG_COST, Trial, fitJointCosts, fitRungCosts, pCorrect, timeCost,
} from "../src/app/syllogimous/utils/ability.utils";
import { MODE_SCALE } from "../src/app/syllogimous/utils/calibration.utils";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";

const TYPE = EnumQuestionType.Space4D;
const FIRST = "branching", SECOND = "mirror-twins";

function world(count: number, truth: { weight: number; second: number; halving: number; shift: number }) {
    const out: Array<Trial & { player?: string }> = [];
    for (let i = 0; i < count; i++) {
        const premises = 3 + (i % 5);
        const depth = i % 3;                              // none, first, first + second
        const rungs = [FIRST, SECOND].slice(0, depth);
        const seconds = i % 4 === 0 ? 20 : null;
        const level = truth.weight * premises
            + (depth >= 1 ? RUNG_COST[FIRST] : 0)
            + (depth >= 2 ? truth.second : 0)
            + timeCost(seconds, { ...DEFAULT_ABILITY, perTimeHalving: truth.halving });
        /* Abilities spread, so every difficulty is answered sometimes right and sometimes wrong. */
        const estimate = 6 + (i % 7) * 1.5;
        const p = pCorrect(DEFAULT_ABILITY, estimate + truth.shift, level, 0.5);
        out.push({ type: TYPE, premises, rungs, seconds, estimate, guess: 0.5, correct: Math.random() < p });
    }
    return out;
}

test("the joint fit recovers planted costs, the second rung's included", () => {
    const truth = { weight: (MODE_SCALE[TYPE]?.weight ?? 1) + 0.25, second: RUNG_COST[SECOND] + 1.5,
                    halving: 1.8, shift: 0 };
    const trials = seeded(4242, () => world(9000, truth));
    const fit = fitJointCosts(trials, DEFAULT_ABILITY, { iterations: 400 })!;
    assert(!!fit, "no fit from nine thousand answers");

    const first = fit.rungs[FIRST].fitted, second = fit.rungs[SECOND].fitted;
    assert(Math.abs(first - RUNG_COST[FIRST]) < 0.35,
        `the first rung was right and was fitted ${first.toFixed(2)} against ${RUNG_COST[FIRST]}`);
    assert(Math.abs(second - truth.second) < 0.45,
        `the second rung was planted at ${truth.second} and fitted ${second.toFixed(2)}`);
    assert(Math.abs(fit.modeWeights[TYPE].fitted - truth.weight) < 0.12,
        `the mode weight was planted at ${truth.weight} and fitted ${fit.modeWeights[TYPE].fitted.toFixed(2)}`);
    assert(Math.abs(fit.perTimeHalving.fitted - truth.halving) < 0.4,
        `the clock was planted at ${truth.halving} per halving and fitted ${fit.perTimeHalving.fitted.toFixed(2)}`);
    assert(fit.logLikAfter > fit.logLikBefore, "the fit made the answers less likely");

    /* And the reason for it: fitted one at a time, the first rung absorbs the second's error. */
    const alone = seeded(4242, () => fitRungCosts(world(9000, truth), DEFAULT_ABILITY))
        .find(f => f.rung === FIRST)!;
    assert(alone.fitted - RUNG_COST[FIRST] > Math.abs(first - RUNG_COST[FIRST]) + 0.3,
        `one at a time the first rung came out ${alone.fitted.toFixed(2)}, no worse than jointly`);
});

test("each player's offset is fitted apart from the costs", () => {
    const base = { weight: MODE_SCALE[TYPE]?.weight ?? 1, second: RUNG_COST[SECOND], halving: 1.1 };
    const a = seeded(11, () => world(4000, { ...base, shift: 1.5 })).map(t => ({ ...t, player: "a" }));
    const b = seeded(12, () => world(4000, { ...base, shift: -1.0 })).map(t => ({ ...t, player: "b" }));
    const fit = fitJointCosts([...a, ...b], DEFAULT_ABILITY, { iterations: 400 })!;
    assert(fit.players === 2, `${fit.players} players`);
    assert(fit.playerShift.a - fit.playerShift.b > 1.8,
        `players planted 2.5 levels apart came out ${(fit.playerShift.a - fit.playerShift.b).toFixed(2)} apart`);
    assert(Math.abs(fit.rungs[SECOND].fitted - base.second) < 0.45,
        "a player's offset leaked into the rung costs");
});

test("a term seen too rarely stays where it was", () => {
    const trials = seeded(5, () => world(400, { weight: 1.6, second: 5, halving: 1.1, shift: 0 }));
    const fit = fitJointCosts(trials, DEFAULT_ABILITY, { minTrials: 200 })!;
    assert(fit.rungs[SECOND].fitted === RUNG_COST[SECOND],
        "a rung carried by 133 answers was moved with a 200-answer floor");
    assert(fitJointCosts(trials.slice(0, 30), DEFAULT_ABILITY) === null, "a fit from thirty answers");
});
