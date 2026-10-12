/**
 * Which coupling an item carries, weighted towards what has hardly been met.
 *
 * Drawn evenly, each coupling's share fell with every rung earned after it, so
 * at the top of the 4D-7D ladder a rung came up in five to eight items in a
 * hundred and heading in four — a player could be promoted past a rung having
 * met it a handful of times. A rung the trial log shows carried fewer than
 * thirty times now weighs up to three times as much, and the draw is even
 * again once everything has been met.
 */

import { assert, equal, seeded, test } from "./harness";
import { GeneratorContext } from "../src/app/syllogimous/generators/context";
import { ProgressionService } from "../src/app/syllogimous/services/progression.service";
import { SettingsOverrideService } from "../src/app/syllogimous/services/settings-override.service";
import { Settings } from "../src/app/syllogimous/models/settings.models";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { Logger } from "../src/app/syllogimous/utils/logger";
import { createDistinction } from "../src/app/syllogimous/generators/distinction";
import { createNdSpace } from "../src/app/syllogimous/generators/ndspace";
import { ladderFor } from "../src/app/syllogimous/utils/progression.utils";

/** A player at the top of the ladder who has met each rung `met(rung)` times. */
function veteran(type: EnumQuestionType, met: (rung: string) => number): GeneratorContext {
    const held = ladderFor(type);
    const settings = new Settings();
    for (const t of Object.values(EnumQuestionType)) settings.question[t].enabled = true;
    const has = (_t: string, r: string) => held.includes(r);
    const ctx: GeneratorContext = {
        settings,
        logger: new Logger("error", false),
        settingsOverrideService: {
            linearOverride: () => null, axesFor: () => null, circularAxes: () => null,
            spread: () => null, depthFor: () => 0, scramble: 100, rungOverride: () => null,
        } as unknown as SettingsOverrideService,
        progressionService: {
            hasRung: has, depthBonusFor: () => 0, dialFor: () => 0, mergeTarget: () => null,
            carriedCount: (_t: EnumQuestionType, r: string) => met(r),
        } as unknown as ProgressionService,
        forceConstruction: "off",
        hasRung: has,
        dialFor: () => 0,
        mergeTarget: () => null,
        random: (n?: number) => createDistinction(ctx, n ?? 2),
    };
    return ctx;
}

function carried(ctx: GeneratorContext, type: EnumQuestionType, count: number, seed: number) {
    const tally: Record<string, number> = {};
    seeded(seed, () => {
        for (let i = 0; i < count; i++) {
            try {
                const q = createNdSpace(ctx, 6, type);
                for (const r of ladderFor(type).slice(ladderFor(type).indexOf("bridges"))) {
                    if (!q.undelivered.includes(r)) tally[r] = (tally[r] ?? 0) + 1;
                }
            } catch { /* a configuration that cannot build */ }
        }
    });
    return tally;
}

test("a rung the player has hardly met is drawn more often than one they know", () => {
    const type = EnumQuestionType.Space4D;
    // Weight 3 against seven at 1 is about 2.4 times the even share; the floor
    // leaves room for the draw's own noise at this sample size.
    const fresh = carried(veteran(type, r => (r === "ranked" ? 0 : 100)), type, 800, 7301);
    const even = carried(veteran(type, () => 100), type, 800, 7301);
    assert((fresh["ranked"] ?? 0) >= 1.6 * (even["ranked"] ?? 0),
        `a ranked rung met 0 times came up ${fresh["ranked"] ?? 0} times, against ${even["ranked"] ?? 0} when met 100 times`);
    assert((fresh["ranked"] ?? 0) >= 1.6 * (fresh["kinds"] ?? 0),
        `the fresh rung (${fresh["ranked"] ?? 0}) is not drawn well ahead of a met one (${fresh["kinds"] ?? 0})`);
});

test("once everything has been met, the draw is even again", () => {
    const type = EnumQuestionType.Space4D;
    const even = carried(veteran(type, () => 100), type, 600, 7302);
    const shares = ["bridges", "kinds", "walking-totals", "ranked"].map(r => even[r] ?? 0);
    assert(Math.max(...shares) <= 2.2 * Math.min(...shares),
        `with every rung met, the couplings came up ${shares.join(", ")} times — not an even draw`);
});

test("heading, freshly earned, claims its share of items", () => {
    /*
     * Heading rides on the facing branch, which only an uncoupled item reached,
     * and there it gave way to a flat facing most of the time: 4% of items at
     * the rung on Space 3D. Drawn with the couplings, a fresh heading is a fair
     * share of everything served.
     */
    const type = EnumQuestionType.Space3D;
    const tally = carried(veteran(type, r => (r === "heading" ? 0 : 100)), type, 400, 7303);
    assert((tally["heading"] ?? 0) >= 0.12 * 400, `heading carried on only ${tally["heading"] ?? 0} of 400 items`);
});

test("carriedCount reads how often the log shows a rung carried, per mode", () => {
    localStorage.clear();
    const trial = (type: EnumQuestionType, rungs: string[]) => ({
        type, premises: 6, rungs, seconds: null, estimate: 0, guess: 0.5, correct: true,
    });
    localStorage.setItem("syllogimous-trials", JSON.stringify([
        trial(EnumQuestionType.Space4D, ["bridges", "cone"]),
        trial(EnumQuestionType.Space4D, ["bridges"]),
        trial(EnumQuestionType.Space5D, ["bridges"]),
        trial(EnumQuestionType.Space4D, []),
    ]));
    const service = new ProgressionService();
    equal(service.carriedCount(EnumQuestionType.Space4D, "bridges"), 2, "bridges on Space 4D");
    equal(service.carriedCount(EnumQuestionType.Space4D, "cone"), 1, "cone on Space 4D");
    equal(service.carriedCount(EnumQuestionType.Space5D, "cone"), 0, "cone on Space 5D");
    localStorage.clear();
});
