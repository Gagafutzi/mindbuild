/**
 * Composed World's help: hints in the game, and the guide.
 *
 * A hint is worse than none if it is the answer, so the test is read off the
 * shipped item: every hint against the explanation the same claim carries, and
 * no hint may hold a line of it that decides the answer. And a hint only helps
 * if it reaches the screen, so it is followed through the claim swap the game
 * itself does.
 */

import { assert, equal, seeded, test } from "./harness";
import { ctxHolding, strip } from "./coupling.test";
import { createComposedWorld } from "../src/app/syllogimous/generators/composed-world";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { QUESTION_TYPE_SETTING_PARAMS } from "../src/app/syllogimous/constants/settings.constants";
import { takeSeriesAnswer } from "../src/app/syllogimous/utils/answer.utils";
import { GUIDES } from "../src/app/syllogimous/constants/guides.constants";

const RANGE = QUESTION_TYPE_SETTING_PARAMS[EnumQuestionType.ComposedWorld];

/** The lines of a claim's explanation that settle it, which no hint may carry. */
function deciding(claim: { explanation?: string[]; answerMode?: string; prompt?: string }, stage: number): string[] {
    const lines = (claim.explanation ?? []).map(strip);
    if (stage === 0) return lines.filter(l => !/nothing settles it yet|tells nothing|could come from either/.test(l));
    if (stage === 1) return lines.slice(lines.findIndex(l => l.startsWith("The words leave")));
    if (claim.answerMode === "construct") return lines.filter(l => l.startsWith("so P is"));
    if (lines.some(l => / is a (knight|knave) and /.test(l))) return lines;          // the speakers analogy: one line, the answer
    /* Past any open-length lines: the first relation, then the candidates, then the places. */
    const first = lines.findIndex(l => !l.startsWith("nothing settles") && !l.startsWith("if it is"));
    return [...lines.slice(first + 1, -1), ...lines.filter(l => l.startsWith("if it is"))];
}

test("composed world: every claim has hints, and none of them is the answer", () => {
    for (const easy of [false, true]) for (let premises = RANGE.minNumOfPremises; premises <= RANGE.maxNumOfPremises; premises++) {
        for (let r = 0; r < 2; r++) seeded(4100 + 10 * premises + r + (easy ? 500 : 0), () => {
            const q = createComposedWorld(ctxHolding([]), premises, easy);
            q.series.forEach((c, i) => {
                const hints = (c.hints ?? []).map(strip);
                assert(hints.length >= 1, `claim ${i + 1} at ${premises}${easy ? " easy" : ""} has no hints`);
                for (const line of deciding(c, i)) {
                    assert(!hints.some(h => h.includes(line)), `claim ${i + 1} at ${premises}${easy ? " easy" : ""}: a hint gives away "${line}"`);
                }
            });
        });
    }
});

test("composed world: the hints on screen are the claim's own, from the first to the last", () => {
    seeded(4300, () => {
        const q = createComposedWorld(ctxHolding([]), 6);
        equal(q.hints.join("|"), (q.series[0].hints ?? []).join("|"), "the first claim's hints are not on screen");
        for (let i = 1; i < q.series.length; i++) {
            q.hintsShown = 2;
            takeSeriesAnswer(q, true);
            equal(q.hints.join("|"), (q.series[i].hints ?? []).join("|"), `claim ${i + 1} shows another claim's hints`);
            equal(q.hintsShown, 0, `claim ${i + 1} opened with the last claim's hints already showing`);
        }
    });
});

test("composed world: the guide keeps every rule the paragraph had, in sections", () => {
    const guide = GUIDES[EnumQuestionType.ComposedWorld];
    assert(!!guide && guide.length >= 6, "the tutorial does not find the guide under the mode's own name");
    /* Apostrophes folded: the paragraph mixed curly and straight ones. */
    const fold = (t: string) => t.replace(/\u2019/g, "'");
    const all = fold(guide.flatMap(s => [s.title, ...s.text, ...(s.example ?? [])]).join(" "));
    for (const rule of ["nothing is assumed about what nobody says", "Congruent words", "can’t both be so",
        "Denials that can’t both be false", "its place being its low end", "A pace names every axis",
        "what they don’t say moves stays still", "A statement holds at its hour", "about the origin",
        "a jump or a turn back moves one thing only", "two kinds", "meet where they share ground", "nearest edges",
        "mirror twin", "head down", "Local clocks run 1 later per step clockwise", "a ring spreads 1 step per step later",
        "A place may leave out what it is level on", "which axes are rings", "keeps who sees", "Inside:", "(where",
        "taken away once answered", "select every term that could", "may use ring reach", "Easy"]) {
        assert(all.includes(fold(rule)), `the guide lost a rule: "${rule}"`);
    }
});
