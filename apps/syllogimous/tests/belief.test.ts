/**
 * Belief-conflict syllogisms: valid but unbelievable, or believable but invalid.
 *
 * Rendered through the real generator and checked against the taxonomy they are
 * built from, writer and reader both: an item marked as a conflict has to be one
 * (its conclusion's truth in the world opposite to whether it follows), and the
 * mark has to say which way round.
 */

import { assert, seeded, test } from "./harness";
import { Settings } from "../src/app/syllogimous/models/settings.models";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { Logger } from "../src/app/syllogimous/utils/logger";
import { GeneratorContext } from "../src/app/syllogimous/generators/context";
import { SettingsOverrideService } from "../src/app/syllogimous/services/settings-override.service";
import { ProgressionService } from "../src/app/syllogimous/services/progression.service";
import {
    BELIEF_TAXONOMY, believable, beliefConflict, createSyllogismCanyon,
} from "../src/app/syllogimous/generators/syllogism";
import { createDistinction } from "../src/app/syllogimous/generators/distinction";

function context(meaningful: boolean): GeneratorContext {
    const settings = new Settings();
    for (const type of Object.values(EnumQuestionType)) settings.question[type].enabled = true;
    settings.setEnable("meaningfulWords", meaningful);
    settings.setEnable("negation", true);
    const ctx: GeneratorContext = {
        settings,
        logger: new Logger("error", false),
        settingsOverrideService: {
            linearOverride: () => null, axesFor: () => null, circularAxes: () => 0,
            spread: () => null, depthFor: () => 0, scramble: 100, deepConclusions: true,
        } as unknown as SettingsOverrideService,
        progressionService: {
            hasRung: () => false, depthBonusFor: () => 0, dialFor: () => 0, mergeTarget: () => null,
        } as unknown as ProgressionService,
        forceConstruction: "off",
        hasRung: () => false, dialFor: () => 0, mergeTarget: () => null,
        random: (n?: number) => createDistinction(ctx, n ?? 2),
    };
    return ctx;
}

test("the taxonomy reads the world the way a person would", () => {
    assert(believable(["Rose", "all", "Plant"]), "all roses are plants");
    assert(!believable(["Plant", "all", "Rose"]), "all plants are roses");
    assert(believable(["Whale", "no", "Fish"]), "no whale is a fish");
    assert(believable(["Mammal", "some", "Whale"]), "some mammals are whales");
    assert(!believable(["Car", "some", "Bird"]), "some cars are birds");
    assert(believable(["Animal", "some_not", "Bird"]), "some animals are not birds");
    assert(!believable(["Eagle", "some_not", "Animal"]), "some eagles are not animals");
});

test("a belief item is one, and is marked the right way round", () => {
    seeded(2026, () => {
        const ctx = context(true);
        let seen = 0, valid = 0;
        for (let n = 2; n <= 5; n++) for (let rep = 0; rep < 60; rep++) {
            const q = createSyllogismCanyon(ctx, n);
            if (!q.beliefConflict) continue;
            seen++;
            const terms = q.bucket;
            assert(terms.every(t => t in BELIEF_TAXONOMY), `a belief item used ${terms.join(", ")}`);
            assert(q.premises.every(p => !p.includes("is-negated")), "a belief item was struck through");
            if (q.isValid) valid++;
            assert(q.beliefConflict === (q.isValid ? "valid-unbelievable" : "invalid-believable"),
                `marked ${q.beliefConflict} on an item that ${q.isValid ? "follows" : "does not follow"}`);
            assert(q.explanation[0].startsWith("Belief conflict"), "the explanation does not say so");
        }
        assert(seen > 40 && seen < 120, `${seen} of 240 items were belief items, not about a third`);
        assert(valid > seen * 0.25 && valid < seen * 0.75, `${valid} of ${seen} were valid; both kinds should come up`);
    });
});

test("the conflict is checked, not hoped for", () => {
    seeded(7, () => {
        for (let i = 0; i < 200; i++) {
            const want = i % 2 === 0;
            const b = beliefConflict(3, 3, 4, want);
            assert(!!b, "no belief item could be drawn for a three-premise chain");
            assert(believable(b!.result.conclusion) !== b!.result.conclusionIsTrue,
                "an item whose belief and validity agree was returned as a conflict");
        }
    });
});

test("without meaningful words there are no belief items", () => {
    seeded(3, () => {
        const ctx = context(false);
        for (let i = 0; i < 120; i++) {
            assert(!createSyllogismCanyon(ctx, 3).beliefConflict, "a belief item from random strings");
        }
    });
});
