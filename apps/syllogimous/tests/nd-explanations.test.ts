/**
 * Every composed-space item that asks a whole relation explains itself.
 *
 * Built claims, a choice between two wide claims and analogies had no
 * derivation, so a wrong answer on them opened nothing — not even the review's
 * by-dimension breakdown, which lives inside the same panel. Their only lines
 * came from reports and testimony, which explain who lied rather than where
 * anything is; and a coupled item sets those aside, so bridges, clocks and
 * kinds explained nothing at all (measured: 0 of 76, 0 of 49, 0 of 37).
 *
 * Three things are checked: that the explanation is there, that on a coupled
 * item it walks through the coupling, and that the totals it closes on are the
 * answer the item marks — a derivation that reaches a different answer from
 * the key is worse than none.
 */

import { assert, seeded, test } from "./harness";
import { GeneratorContext } from "../src/app/syllogimous/generators/context";
import { ProgressionService } from "../src/app/syllogimous/services/progression.service";
import { SettingsOverrideService } from "../src/app/syllogimous/services/settings-override.service";
import { Question } from "../src/app/syllogimous/models/question.models";
import { Settings } from "../src/app/syllogimous/models/settings.models";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { Logger } from "../src/app/syllogimous/utils/logger";
import { createDistinction } from "../src/app/syllogimous/generators/distinction";
import { createNdSpace } from "../src/app/syllogimous/generators/ndspace";
import { ladderFor } from "../src/app/syllogimous/utils/progression.utils";

const strip = (h: string) => h.replace(/<[^>]+>/g, "");

function holding(held: string[]): GeneratorContext {
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
        } as unknown as ProgressionService,
        forceConstruction: "off",
        hasRung: has,
        dialFor: () => 0,
        mergeTarget: () => null,
        random: (n?: number) => createDistinction(ctx, n ?? 2),
    };
    return ctx;
}

function items(type: EnumQuestionType, upTo: string, count: number, seed: number): Question[] {
    const ladder = ladderFor(type);
    const ctx = holding(ladder.slice(0, ladder.indexOf(upTo) + 1));
    const out: Question[] = [];
    seeded(seed, () => {
        for (let i = 0; i < count; i++) {
            try { out.push(createNdSpace(ctx, 6, type)); } catch { /* a configuration that cannot build */ }
        }
    });
    return out;
}

const wholeRelation = (q: Question) => q.answerMode === "construct" || q.answerMode === "choice"
    || [...q.choices, ...[q.conclusion].flat()].some(t => / relation (as|to) /.test(strip(String(t))));
/** Reports and testimony carry their own lines, so they cannot show the gap. */
const reported = (q: Question) => q.premises.some(p => /says|report|knight|knave/i.test(strip(p)));

test("a built claim, a choice and an analogy each come with a derivation", () => {
    for (const type of [EnumQuestionType.Direction, EnumQuestionType.Space3D,
        EnumQuestionType.Space4D, EnumQuestionType.Space6D]) {
        const asked = items(type, "mirror-twins", 200, 7101).filter(q => wholeRelation(q) && !reported(q));
        assert(asked.length >= 30, `${type}: only ${asked.length} whole-relation items to check`);
        const silent = asked.filter(q => !q.explanation.length);
        assert(!silent.length, `${type}: ${silent.length} of ${asked.length} whole-relation items explain nothing, e.g.\n  `
            + (silent[0] ? [...silent[0].premises, ...silent[0].choices].map(strip).join("\n  ") : ""));
    }
});

test("a coupled item's derivation goes through its coupling", () => {
    /*
     * What each coupling's walk says when it crosses the coupling. A bridge and
     * a total are crossed by every pair the coupling decides; clocks and kinds
     * only where the walk meets a marked premise, so those are asked of most
     * items rather than all.
     */
    const cases: Array<{ rung: string; type: EnumQuestionType; marker: RegExp; share: number }> = [
        { rung: "bridges", type: EnumQuestionType.Space4D, marker: /except the bridge/, share: 0.95 },
        { rung: "walking-totals", type: EnumQuestionType.Space3D, marker: /except the total|steps in all/, share: 0.95 },
        { rung: "local-clocks", type: EnumQuestionType.Space5D, marker: /by local clocks|clock reads|clocks? .*alike/, share: 0.8 },
        { rung: "kinds", type: EnumQuestionType.Space6D, marker: /reckons it|other kind/, share: 0.8 },
    ];
    for (const c of cases) {
        const delivered = items(c.type, c.rung, 200, 7102)
            .filter(q => !q.undelivered.includes(c.rung) && wholeRelation(q));
        assert(delivered.length >= 15, `${c.rung}: only ${delivered.length} delivered whole-relation items`);
        const explained = delivered.filter(q => q.explanation.length);
        assert(explained.length === delivered.length,
            `${c.rung}: ${delivered.length - explained.length} of ${delivered.length} delivered items explain nothing`);
        const through = explained.filter(q => q.explanation.some(l => c.marker.test(strip(l))));
        assert(through.length >= c.share * explained.length,
            `${c.rung}: only ${through.length} of ${explained.length} derivations go through the coupling`);
    }
});

test("a built claim's derivation closes on the answer the item marks", () => {
    let checked = 0;
    for (const [type, upTo] of [
        [EnumQuestionType.Space4D, "mirror-twins"], [EnumQuestionType.Space4D, "bridges"],
        [EnumQuestionType.Space5D, "local-clocks"], [EnumQuestionType.Space6D, "kinds"],
        [EnumQuestionType.Space3D, "walking-totals"],
    ] as const) {
        for (const q of items(type, upTo, 120, 7103).filter(q => q.answerMode === "construct" && !reported(q))) {
            const lines = q.explanation.map(strip);
            for (const claim of q.construct) {
                const closing = lines.find(l => new RegExp(`(^|, )${claim.a} is .* relative to ${claim.b}$`).test(l));
                assert(!!closing, `${type}/${upTo}: no closing totals for ${claim.a} against ${claim.b}:\n  ${lines.join("\n  ")}`);
                const clauses = closing!.replace(/^.*?\b(\w+) is /, "").replace(/ relative to \w+$/, "").split(", ");
                assert(clauses.length === claim.slots.length,
                    `${type}/${upTo}: ${clauses.length} clauses for ${claim.slots.length} dimensions: ${closing}`);
                claim.slots.forEach((slot, i) => {
                    // Kind and ring slots word their answers their own way; the
                    // magnitude is the part a derivation can get wrong.
                    if (slot.modulus || slot.directions.length === 2) return;
                    const n = clauses[i].match(/^(\d+) /);
                    const said = slot.answerDirection === 2 ? 0 : Number(n?.[1] ?? NaN);
                    assert(said === slot.answerMagnitude && (slot.answerDirection === 2) === !n,
                        `${type}/${upTo}: ${slot.label} closes on "${clauses[i]}" but the key is `
                        + `${slot.directions[slot.answerDirection]} ${slot.answerMagnitude}`);
                });
                checked++;
            }
        }
    }
    assert(checked >= 100, `only ${checked} built claims checked`);
});
