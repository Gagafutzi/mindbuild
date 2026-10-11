/**
 * Cross-dimensional coupling in the composed spaces, and the three fixes it
 * stands on.
 *
 * The plan is `research/syllogimous-coupling/README.md`. Every rung there is
 * held to the same four checks: an independent solver agrees with the marked
 * answer, the rung is delivered when held, the per-axis reading fails on a
 * meaningful share of items, and what it writes renders through the real mode.
 */

import { assert, equal, seeded, test } from "./harness";
import { GeneratorContext } from "../src/app/syllogimous/generators/context";
import { ProgressionService } from "../src/app/syllogimous/services/progression.service";
import { SettingsOverrideService } from "../src/app/syllogimous/services/settings-override.service";
import { Question } from "../src/app/syllogimous/models/question.models";
import { Settings } from "../src/app/syllogimous/models/settings.models";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { Logger } from "../src/app/syllogimous/utils/logger";
import { createDistinction } from "../src/app/syllogimous/generators/distinction";
import { createNdSpace } from "../src/app/syllogimous/generators/ndspace";
import { ND_LADDER_AT_SPLIT, ladderFor } from "../src/app/syllogimous/utils/progression.utils";

export const strip = (h: string) => h.replace(/<[^>]+>/g, "");

/** A context holding exactly `held`, with nothing forced. */
export function ctxHolding(held: string[], forced: Record<string, unknown> = {}): GeneratorContext {
    const settings = new Settings();
    for (const t of Object.values(EnumQuestionType)) settings.question[t].enabled = true;
    const has = (_t: string, r: string) => held.includes(r);
    const ctx: GeneratorContext = {
        settings,
        logger: new Logger("error", false),
        settingsOverrideService: {
            linearOverride: (k: string) => (k in forced ? forced[k] : null),
            axesFor: () => null, circularAxes: () => null,
            spread: () => null, depthFor: () => 0, scramble: 100, rungOverride: () => null,
        } as unknown as SettingsOverrideService,
        progressionService: {
            hasRung: has, depthBonusFor: () => 0, dialFor: () => 0, mergeTarget: () => null,
        } as unknown as ProgressionService,
        forceConstruction: "off",
        hasRung: has,
        dialFor: () => 0,
        mergeTarget: () => null,
        random: (n?: number) => createDistinction(ctx, n ?? 2),
    };
    return ctx;
}

/** Up to `count` items, skipping the configurations that throw. */
export function build(ctx: GeneratorContext, type: EnumQuestionType, premises: number,
                      count: number, seed: number): Question[] {
    const out: Question[] = [];
    seeded(seed, () => {
        for (let i = 0; i < count; i++) {
            try { out.push(createNdSpace(ctx, premises, type)); } catch { /* skip */ }
        }
    });
    return out;
}

/** Everything a player has reached by the end of today's ladder. */
const fullLadder = (type: EnumQuestionType) =>
    ladderFor(type).slice(0, ladderFor(type).indexOf("mirror-twins") + 1);

const hasFacing = (q: Question) => q.premises.some(p => p.includes(">faces<"));

/* ------------------------------------------------------------------ *
 * Prerequisite 1: facing is delivered, and charged only when it is     *
 * ------------------------------------------------------------------ */

test("facing is delivered once analogy is held, and charged only where it is", () => {
    for (const type of [EnumQuestionType.Space3D, EnumQuestionType.Space4D, EnumQuestionType.Space6D]) {
        const items = build(ctxHolding(fullLadder(type)), type, 6, 160, 4401);
        assert(items.length > 100, `${type}: only ${items.length} items built`);

        const faced = items.filter(hasFacing);
        assert(faced.length > items.length * 0.2,
            `${type}: ${faced.length}/${items.length} items carried a facing with the whole `
            + "ladder held — the facing branch sits below forms that always return first");

        for (const q of items) {
            equal(q.undelivered.includes("facing"), !hasFacing(q),
                `${type}: an item ${hasFacing(q) ? "with" : "without"} a facing premise `
                + `lists facing as ${hasFacing(q) ? "undelivered" : "delivered"}`);
        }

        // Twins ride on a facing: the rule premise appears exactly when the
        // item is a twin item, and is charged exactly then.
        const twins = items.filter(q => q.premises.some(p => /mirror twin/.test(strip(p))));
        assert(twins.length > 0, `${type}: no mirror-twin items with the rung held`);
        for (const q of items) {
            const twin = q.premises.some(p => /mirror twin/.test(strip(p)));
            equal(q.undelivered.includes("mirror-twins"), !twin,
                `${type}: mirror-twins charged on an item that ${twin ? "carries" : "lacks"} one`);
        }
    }
});

test("before the rivals arrive, a facing item is still a facing item", () => {
    const held = ["branching", "indeterminate", "facing"];
    const items = build(ctxHolding(held), EnumQuestionType.Space4D, 5, 120, 4402);
    const faced = items.filter(hasFacing).length;
    assert(faced > items.length * 0.8,
        `only ${faced}/${items.length} items at the facing rung asked a facing`);
});

/* ------------------------------------------------------------------ *
 * Prerequisite 2: the one-step convention is always stated             *
 * ------------------------------------------------------------------ */

test("every composed-space item states that a premise is one step", () => {
    for (const type of [EnumQuestionType.Direction, EnumQuestionType.Space3D,
                        EnumQuestionType.Space4D, EnumQuestionType.Space7D]) {
        // Nothing held at all, which is where it used to go missing: the note
        // was tied to construct-distance, and the coupling rungs need it long
        // before that.
        const items = build(ctxHolding([]), type, 4, 20, 4403);
        assert(items.length >= 15, `${type}: only ${items.length} items built`);
        for (const q of items) {
            assert(q.setup.some(l => /one step/.test(strip(l))),
                `${type}: an item with no rungs does not say each premise is one step`);
        }
    }
});

/* ------------------------------------------------------------------ *
 * Prerequisite 3: one ladder per family, each beginning as it was      *
 * ------------------------------------------------------------------ */

test("the composed-space ladder is forked per family without renaming a rung", () => {
    const families = {
        direction: ladderFor(EnumQuestionType.Direction),
        space3d: ladderFor(EnumQuestionType.Space3D),
        spaceNd: ladderFor(EnumQuestionType.Space4D),
    };
    for (const [name, ladder] of Object.entries(families)) {
        equal(ladder.slice(0, ND_LADDER_AT_SPLIT.length), [...ND_LADDER_AT_SPLIT],
            `the ${name} ladder no longer begins with the ladder it was forked from, `
            + "so a stored rung count now names different rungs");
        assert(Object.isFrozen(ladder), `the ${name} ladder can be mutated at runtime`);
    }
    // Three separate arrays: a shared reference would let one family's
    // appended rung appear on another's ladder.
    assert(families.direction !== families.space3d && families.space3d !== families.spaceNd
        && families.direction !== families.spaceNd, "two families share one ladder array");
    for (const type of [EnumQuestionType.Space5D, EnumQuestionType.Space6D, EnumQuestionType.Space7D]) {
        assert(ladderFor(type) === families.spaceNd, `${type} is not on the 4D–7D ladder`);
    }
});
