/**
 * Speed and reasoning, kept apart.
 *
 * The clock used to be priced into the same number as structure, and every
 * answer under a tight clock moved the reasoning estimate. Now a tight clock
 * moves only the speed estimate (what a halving of the time costs this player,
 * fitted from timed answers), and the reasoning estimate reads generous-deadline
 * answers alone.
 */

import { assert, seeded, test } from "./harness";
import {
    DEFAULT_ABILITY, Trial, fitSpeed, generousDeadline, levelOf, pCorrect, timeCost,
} from "../src/app/syllogimous/utils/ability.utils";
import { ProgressionService } from "../src/app/syllogimous/services/progression.service";
import { SettingsOverrideService } from "../src/app/syllogimous/services/settings-override.service";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";

const TYPE = EnumQuestionType.Distinction;

test("a deadline is generous when it costs under a quarter of a level", () => {
    assert(generousDeadline(null), "an untimed item is not generous");
    assert(generousDeadline(DEFAULT_ABILITY.referenceSeconds), "a deadline at the reference is not generous");
    assert(!generousDeadline(DEFAULT_ABILITY.referenceSeconds / 2), "half the reference time is generous");
    assert(timeCost(DEFAULT_ABILITY.referenceSeconds * 0.9) < 0.25 && generousDeadline(DEFAULT_ABILITY.referenceSeconds * 0.9),
        "a deadline a tenth short of the reference is not generous");
});

function timedWorld(halving: number, count: number): Trial[] {
    const out: Trial[] = [];
    for (let i = 0; i < count; i++) {
        const premises = 3 + (i % 4);
        const seconds = [10, 15, 20, 30, 40][i % 5];
        const estimate = 7 + (i % 6);
        const level = levelOf({ type: TYPE, premises, rungs: [], seconds: null })
            + halving * Math.log2(DEFAULT_ABILITY.referenceSeconds / seconds);
        out.push({ type: TYPE, premises, rungs: [], seconds, estimate, guess: 0.5,
                   correct: Math.random() < pCorrect(DEFAULT_ABILITY, estimate, level, 0.5) });
    }
    return out;
}

test("the speed estimate recovers what a halving of the clock costs", () => {
    for (const planted of [0.6, 1.5, 2.6]) {
        const fit = seeded(Math.round(planted * 1000), () => fitSpeed(timedWorld(planted, 5000)))!;
        assert(!!fit, "no speed estimate from five thousand timed answers");
        assert(Math.abs(fit.perTimeHalving - planted) < 0.3,
            `planted ${planted} levels per halving, fitted ${fit.perTimeHalving.toFixed(2)}`);
    }
    assert(fitSpeed(timedWorld(1, 20)) === null, "a speed estimate from twenty answers");
    const untimed = timedWorld(1, 400).map(t => ({ ...t, seconds: null }));
    assert(fitSpeed(untimed) === null, "a speed estimate from answers that had no clock");
});

/* Drives the real service with its configuration pinned, so the clock can be set. */
function serviceAt(seconds: number | null) {
    localStorage.clear();
    const prog = new ProgressionService(new SettingsOverrideService());
    prog.set("enabled", true);
    prog.applyCalibration(10, 60);
    (prog as any).configFor = () => ({ premises: 4, rungs: 0, dials: {}, seconds, level: 10 });
    return prog;
}

test("a tight clock moves the speed evidence, not the reasoning estimate", () => {
    const tight = serviceAt(8);
    const before = tight.estimateFor(TYPE).level;
    for (let i = 0; i < 12; i++) tight.record(TYPE, "wrong", 7);
    const after = tight.estimateFor(TYPE).level;
    assert(Math.abs(after - before) < 1e-9,
        `twelve misses under an eight-second clock moved reasoning from ${before.toFixed(2)} to ${after.toFixed(2)}`);
    assert(tight.trials().length === 12, "the timed answers were not logged for the speed estimate");

    const generous = serviceAt(null);
    const g0 = generous.estimateFor(TYPE).level;
    for (let i = 0; i < 12; i++) generous.record(TYPE, "wrong", 30);
    assert(generous.estimateFor(TYPE).level < g0 - 0.5,
        "twelve untimed misses did not move the reasoning estimate");
});
