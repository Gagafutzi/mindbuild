/**
 * The explanation after a miss can always be read to its end and left.
 *
 * It is a full-screen overlay with Continue at the bottom. Centred and not
 * scrolling, a Composed World review on a phone — four thousand pixels in a
 * window of seven hundred — ran off both ends, Continue with it, and nothing
 * could bring either back: the player was stuck on a panel there was no way
 * out of. Two things keep it reachable, and each fails alone: the overlay
 * scrolls, and it is centred only while it fits, since plain `center` pushes
 * the head of a tall panel above the top, where no scroll reaches.
 *
 * Read off the template and the stylesheet the game is built from, because
 * that is where the fix lives and where it would be undone.
 */

import { readFileSync } from "fs";
import { assert, test } from "./harness";

const DIR = "src/app/syllogimous/pages/game/";
const uncommented = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/<!--[\s\S]*?-->/g, "");

test("the explanation overlay scrolls, and a tall one starts at its top", () => {
    const html = uncommented(readFileSync(DIR + "game.component.html", "utf8"));
    const css = uncommented(readFileSync(DIR + "game.component.css", "utf8"));
    const tag = /<div class="([^"]*\breview\b[^"]*)"[^>]*\*ngIf="game\.review\.length"/.exec(html);
    assert(!!tag, "the review overlay is not where it was");
    assert(/\boverflow-(auto|y-auto)\b/.test(tag![1]), `the review overlay does not scroll: class="${tag![1]}"`);
    const rule = /(^|\})\s*\.review\s*\{([^}]*)\}/.exec(css);
    assert(!!rule, "no .review rule in the game's stylesheet");
    assert(!/overflow\s*:\s*(hidden|visible|clip)/.test(rule![2]), "the review overlay's own rule stops it scrolling");
    const align = /align-content\s*:\s*([^;]+);/.exec(rule![2]);
    assert(!align || /\bsafe\b|start|normal/.test(align[1]), `a tall review is centred past the top of the screen: align-content: ${align?.[1]}`);
});
