/**
 * The line above a set of options — `choicePrompt` — rendered as markup.
 *
 * Premises, conclusions, options and build claims are all bound with
 * innerHTML, because a subject is a coloured span and an emoji or
 * visual-noise stimulus is an HTML fragment. The prompt was the one field
 * still interpolated, and it was harmless only while every prompt was plain
 * text. The light cone's "Select every one X's ring can have reached", the
 * walking totals' "which is nearer to X" and Worldlines' "When X and Y reach
 * the same longitude" name their subjects the way premises do, so the player
 * read `<span class="subject">` on the card.
 *
 * Checked on the template rather than per mode: any prompt may name a
 * stimulus, so the binding has to be right everywhere it is shown.
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { assert, test } from "./harness";

function templates(dir: string): string[] {
    return readdirSync(dir).flatMap(name => {
        const path = join(dir, name);
        return statSync(path).isDirectory() ? templates(path) : path.endsWith(".html") ? [path] : [];
    });
}

test("a choice prompt is bound as markup wherever it is shown", () => {
    let bound = 0;
    for (const file of templates("src/app")) {
        const html = readFileSync(file, "utf8");
        const interpolated = html.match(/\{\{[^}]*choicePrompt[^}]*\}\}/);
        assert(!interpolated, `${file} interpolates the prompt, so its markup shows as text: ${interpolated?.[0]}`);
        bound += (html.match(/\[innerHTML\]="[^"]*choicePrompt/g) ?? []).length;
    }
    assert(bound >= 4, `only ${bound} prompt bindings found; the game screen shows the prompt in four answer modes`);
});
