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
 * Asked in stages, one card and five to seven conclusions: who is a knight
 * and who a knave, ticked; two or three analogies to finish; then one or two
 * transformations announced later in the day, and two or three analogies to
 * judge across them. Played from the Experimental page, unscored, its time
 * counted towards the daily goal.
 *
 * The engine is in `utils/world/`, built from registries (seams,
 * transformations, kinds of fact, kinds of question) so that each is extended
 * by adding an entry. This file only words an item and hands it over.
 */

import { EnumQuestionType } from "../constants/question.constants";
import { Question, SeriesClaim } from "../models/question.models";
import { canGenerateQuestion, clampPremises } from "../models/settings.models";
import { getRandomSymbols } from "../utils/question.utils";
import { ndAxisColors } from "../utils/ndspace.utils";
import { StagedItem, buildStaged } from "../utils/world/build";
import { describeStatement, Wording } from "../utils/world/facts";
import { renderAsk, renderPremises, renderTypes, setupLines } from "../utils/world/render";
import { GeneratorContext } from "./context";

/**
 * What premises buy: axes, things and speakers, one step at a time. Every part
 * of the structure — motion, lengths, a seam, a turn of the whole space, a
 * knave, an analogy — is on every card; what grows is how much of each there
 * is to hold. Three things at least, since an analogy needs a pair and a third
 * term with two to choose between, and the origin is no thing.
 */
const LADDER: Record<number, { dims: number; things: number; speakers: number }> = {
    4: { dims: 3, things: 3, speakers: 2 },
    5: { dims: 4, things: 3, speakers: 3 },
    6: { dims: 5, things: 4, speakers: 3 },
    7: { dims: 6, things: 4, speakers: 4 },
    8: { dims: 7, things: 5, speakers: 4 },
};
export const worldSize = (numOfPremises: number) => LADDER[Math.max(4, Math.min(8, numOfPremises))];

export function createComposedWorld(ctx: GeneratorContext, numOfPremises: number): Question {
    ctx.logger.info("createComposedWorld");
    const type = EnumQuestionType.ComposedWorld;
    if (!canGenerateQuestion(type, numOfPremises, ctx.settings)) throw new Error("Cannot generate.");
    numOfPremises = clampPremises(type, numOfPremises);

    const size = worldSize(numOfPremises), { things } = size;
    let best: { item: StagedItem; names: string[]; premises: string[] } | null = null;
    for (let t = 0; t < 3 && !best; t++) {
        const item = buildStaged(size, 300);
        if (!item) continue;
        /* Distinct, and none that reads as the origin. Drawn again rather than given up on. */
        let names: string[] = [];
        for (let d = 0; d < 8; d++) {
            names = getRandomSymbols(ctx.settings, things + size.speakers);
            if (new Set(names).size === names.length && !names.some(n => /\borigin\b/i.test(n))) break;
            names = [];
        }
        if (!names.length) continue;
        const w = wording(item, names, things);
        const premises = renderPremises(item.card.statements, w, item.card.style?.wide);
        if (premises.length) best = { item, names, premises };
    }
    if (!best) throw new Error("Cannot generate.");
    const { item, names, premises } = best;
    const w = wording(item, names, things);

    const ticks = renderTypes(item, w);
    const finishes = item.analogies.map(a => renderAsk(item.reconstruction, a, w));
    const verdicts = item.judgements.map(j => renderAsk(item.laterReconstruction, j, w));
    /* The announcement goes at the end of the card, where the carousel lands
       when the last stage begins. */
    const announced = [...premises, ...item.later.map(st => describeStatement(w, st))];

    const series: SeriesClaim[] = [
        { text: "", isValid: true, answerMode: "select", choices: ticks.choices, selectAnswer: ticks.selectAnswer,
            prompt: ticks.prompt, explanation: ticks.explanation, premises },
        ...finishes.map((f): SeriesClaim => f.construct
            ? { text: "", isValid: true, answerMode: "construct", construct: f.construct, prompt: f.prompt, explanation: f.explanation }
            : { text: "", isValid: true, answerMode: "choice", choices: f.choices, correctChoice: f.correctChoice, prompt: f.prompt, explanation: f.explanation }),
        ...verdicts.map((v, i): SeriesClaim => ({ text: v.conclusion, isValid: item.judgements[i].answer === true,
            answerMode: "boolean", explanation: v.explanation, ...(i === 0 ? { premises: announced } : {}) })),
    ];

    const question = new Question(type);
    question.bucket = [...names];
    question.setup = setupLines(item.world.axes, w.colors, w.compact, item.card.statements);
    question.premises = premises;
    question.explanation = ticks.explanation;
    question.answerMode = "select";
    question.choices = ticks.choices;
    question.selectAnswer = ticks.selectAnswer;
    question.selectAsked = true;
    question.choicePrompt = ticks.prompt;
    question.conclusion = "";
    question.isValid = true;
    question.series = series;
    /* Experimental: kept out of the ability model, as the stream and the delay
       line are, but timed and counted towards the daily goal like any item. */
    question.playgroundMode = true;
    return question;
}

function wording(item: StagedItem, names: string[], things: number): Wording {
    const axes = item.world.axes;
    return {
        axes, colors: ndAxisColors(axes.map(a => ({ scale: a.scale }))), things: names.slice(0, things), speakers: names.slice(things),
        compact: item.card.style?.compact,
    };
}
