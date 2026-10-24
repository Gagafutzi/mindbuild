/**
 * Composed World — everything at once.
 *
 * The seven axes of Space 7D, where things have lengths and move all day on a
 * clock, east–west is a ring whose seam twists another axis or leads into one,
 * the whole space is turned, mirrored, swapped, sheared, shifted or stretched
 * on the hour, and every premise is said by a knight or a knave. Every
 * question is an analogy, and an item ships only when each shortcut — trusting
 * every speaker, ignoring the motion, the seams, the lengths or the events —
 * answers it wrongly or cannot answer it at all.
 *
 * The engine is in `utils/world/`, built from registries (seams,
 * transformations, kinds of fact, kinds of question) so that each is extended
 * by adding an entry. This file only words an item and hands it over. No
 * ladder: every kind of question and every variant is in play from the first
 * item.
 */

import { EnumQuestionType } from "../constants/question.constants";
import { Question } from "../models/question.models";
import { canGenerateQuestion, clampPremises } from "../models/settings.models";
import { getRandomSymbols } from "../utils/question.utils";
import { ndAxisColors } from "../utils/ndspace.utils";
import { build } from "../utils/world/build";
import { render } from "../utils/world/render";
import { GeneratorContext } from "./context";

/**
 * What premises buy: axes, things and speakers, one step at a time. Every part
 * of the structure — motion, lengths, a seam, a turn of the whole space, a
 * knave, an analogy — is on every card; what grows is how much of each there
 * is to hold. The floor is three axes (the ring and the two lines its seam and
 * the transformations need), two things and two speakers: under the first
 * card's reading budget, where seven axes from the start printed 1,500
 * characters.
 */
const LADDER: Record<number, { dims: number; things: number; speakers: number }> = {
    4: { dims: 3, things: 2, speakers: 2 },
    5: { dims: 4, things: 3, speakers: 2 },
    6: { dims: 5, things: 3, speakers: 3 },
    7: { dims: 6, things: 4, speakers: 3 },
    8: { dims: 7, things: 4, speakers: 4 },
};
export const worldSize = (numOfPremises: number) => LADDER[Math.max(4, Math.min(8, numOfPremises))];

export function createComposedWorld(ctx: GeneratorContext, numOfPremises: number, kind?: string): Question {
    ctx.logger.info("createComposedWorld");
    const type = EnumQuestionType.ComposedWorld;
    if (!canGenerateQuestion(type, numOfPremises, ctx.settings)) throw new Error("Cannot generate.");
    numOfPremises = clampPremises(type, numOfPremises);

    const size = worldSize(numOfPremises), { things, speakers } = size;
    /* A kind that will not build on this card's size gives way to any other
       rather than costing the player an error. */
    const item = build({ ...size, kind }, 1500) ?? (kind ? null : build(size, 1500));
    if (!item) throw new Error("Cannot generate.");

    const names = getRandomSymbols(ctx.settings, things + speakers);
    if (new Set(names).size !== names.length) throw new Error("Cannot generate.");
    const colors = ndAxisColors(item.world.axes.map(a => ({ scale: a.scale })));
    const r = render(item, names.slice(0, things), names.slice(things), colors);

    const question = new Question(type);
    question.bucket = [...names];
    question.setup = r.setup;
    question.premises = r.premises;
    question.explanation = r.explanation;
    if (item.kind.answerMode === "boolean") {
        question.conclusion = r.conclusion;
        question.isValid = item.answer === true;
    } else if (item.kind.answerMode === "choice") {
        question.answerMode = "choice";
        question.choices = r.choices;
        question.correctChoice = r.correctChoice;
        question.choicePrompt = r.prompt;
        question.conclusion = "";
        question.isValid = true;
    } else {
        question.answerMode = "select";
        question.choices = r.choices;
        question.selectAnswer = r.selectAnswer;
        question.selectAsked = true;
        question.choicePrompt = r.prompt;
        question.conclusion = "";
        question.isValid = true;
    }
    return question;
}
