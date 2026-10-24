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
import { getRandomSymbols, shuffle } from "../utils/question.utils";
import { ndAxisColors } from "../utils/ndspace.utils";
import { Item, build, fitting } from "../utils/world/build";
import { Rendered, render } from "../utils/world/render";
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

/** Characters of premises a first card may run to; the suite's cap is 650, and names vary. */
const FLOOR_BUDGET = 600;

export function createComposedWorld(ctx: GeneratorContext, numOfPremises: number, kind?: string): Question {
    ctx.logger.info("createComposedWorld");
    const type = EnumQuestionType.ComposedWorld;
    if (!canGenerateQuestion(type, numOfPremises, ctx.settings)) throw new Error("Cannot generate.");
    numOfPremises = clampPremises(type, numOfPremises);

    const size = worldSize(numOfPremises), { things } = size;
    /* The first card is held to a reading budget of its own: the world is the
       same size every time, but long names can make one draw half as long again
       as the next. So on the smallest space a long draw is drawn again, and the
       shortest of a few kept. */
    const tries = size.dims <= 3 ? 6 : 1;
    let best: { item: Item; names: string[]; r: Rendered; length: number } | null = null;
    for (let t = 0; t < tries && !(best && best.length <= FLOOR_BUDGET); t++) {
        /* A kind that will not build on this card's size gives way to the
           others, each tried once, rather than costing the player an error. */
        let item: Item | null = null;
        for (const k of kind ? [kind] : shuffle(fitting(size))) if ((item = build({ ...size, kind: k }, 1500))) break;
        if (!item) continue;
        /* Distinct, and none that reads as the landmark: a speaker called Post
           says "Post says: … the Post …". Drawn again rather than given up on. */
        let names: string[] = [];
        for (let d = 0; d < 8; d++) {
            names = getRandomSymbols(ctx.settings, things + size.speakers);
            if (new Set(names).size === names.length && !names.some(n => /\bpost\b/i.test(n))) break;
            names = [];
        }
        if (!names.length) continue;
        const colors = ndAxisColors(item.world.axes.map(a => ({ scale: a.scale })));
        const r = render(item, names.slice(0, things), names.slice(things), colors);
        const length = r.premises.reduce((n, l) => n + l.replace(/<[^>]+>/g, "").length, 0);
        if (!best || length < best.length) best = { item, names, r, length };
    }
    if (!best) throw new Error("Cannot generate.");
    const { item, names, r } = best;

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
