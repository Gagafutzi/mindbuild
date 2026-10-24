/**
 * Whether the explanation overlay opens, and what it carries.
 *
 * The overlay is the one deliberate interruption in a screen built to avoid
 * them: a wrong answer returns one bit about an item that took a minute to
 * read, and an error only teaches if the correction is read. That is the case
 * for showing it, and it is not everybody's case. Somebody drilling for speed
 * is stopped twice a minute by a panel they already understand, and the honest
 * answer to that is a switch rather than an argument.
 *
 * **A whole overlay, not a paragraph.** `game.review` is what the panel is
 * shown by, so emptying it takes the derivation, the map, the Venn, the stages
 * and the dimension breakdown with it. That is deliberate — those are the
 * explanation, in the modes where a picture explains better than prose — and it
 * is also already the behaviour of every mode that derives nothing, which shows
 * no panel and moves straight on. Turning this off makes every mode behave the
 * way those ones always have.
 *
 * **Nothing is discarded.** Only the interruption is suppressed. `explanation`
 * is still stored on the question and History still renders it for every item,
 * right or wrong, which is where it can be read without a clock running.
 *
 * Split out of the service so the rule can be tested. It is three lines that
 * decide whether a panel ever opens, which is exactly the kind of thing that
 * gets found by looking at the screen otherwise.
 */

import { LS_EXPLANATIONS_OFF } from "../constants/local-storage.constants";

/** Absence means shown, so an existing player is not migrated onto anything. */
export function explanationsOn(): boolean {
    try {
        return localStorage.getItem(LS_EXPLANATIONS_OFF) !== "1";
    } catch {
        // Private mode: the default stands rather than the feature vanishing.
        return true;
    }
}

export function setExplanationsOn(on: boolean): void {
    try {
        if (on) localStorage.removeItem(LS_EXPLANATIONS_OFF);
        else localStorage.setItem(LS_EXPLANATIONS_OFF, "1");
    } catch { /* private mode; the default stands */ }
}

/**
 * The steps the overlay should show, or none to move straight on.
 *
 * A correct answer never opens it — that has always been true and is not what
 * the switch is about. A timeout does: the clock ran out on an item that was
 * being worked on, which is the case the derivation is most use for.
 */
export function reviewSteps(
    kind: "correct" | "wrong" | "timeout",
    explanation: string[] | undefined,
    shown = explanationsOn(),
): string[] {
    if (kind === "correct" || !shown) return [];
    return explanation ?? [];
}

/**
 * The review for a series whose every claim explains itself: each conclusion
 * missed, under its own heading, with its own derivation — or null where the
 * claims lean on the item's one derivation, which keeps the review it had.
 *
 * The overlay used to open only when the last conclusion was wrong, and then
 * with whichever derivation was on the question last. On a staged card that
 * asks who the knights are, then analogies, then verdicts, a slip on the first
 * stage was never explained at all, and the note said it explained the first
 * conclusion while it showed the last one's.
 *
 * A timeout counts the conclusion that was on screen as missed.
 */
export function missedReview(
    q: { series: Array<{ explanation?: string[] }>; seriesAnswers: Array<boolean | undefined>; seriesAt: number },
    timedOut = false,
): { steps: string[]; note: string } | null {
    const n = q.series.length;
    if (n < 2 || !q.series.every(c => c.explanation?.length)) return null;
    const missed = q.series.map((_, k) => k).filter(k => q.seriesAnswers[k] === false || (timedOut && k === q.seriesAt && q.seriesAnswers[k] === undefined));
    return {
        /* The heading leads the conclusion's first step rather than taking a number of its own. */
        steps: missed.flatMap(k => {
            const [first, ...rest] = q.series[k].explanation!;
            return [`<strong>Conclusion ${k + 1} of ${n}:</strong> ${first}`, ...rest];
        }),
        note: missed.length ? `Every conclusion missed, each with how it follows.` : "",
    };
}
