/**
 * An item asks only about relations the premises settle.
 *
 * With the under-specification rung held, premises leave dimensions unnamed and
 * the card says a claim is true only if it holds in every arrangement they
 * allow. Analogies were keyed off the layout's coordinates regardless, so a
 * true one could rest on an axis no premise links: measured on the full
 * pre-coupling ladder, 66 of 82 Direction analogy items and 61 of 70 in Space
 * 4D. Both options of such a choice are then open, and the one marked right
 * is right only in the arrangement the generator happened to draw.
 *
 * Built claims had the same fault and more of it. A built claim asks every
 * dimension, and the checkpoint's final claim is the most distant pair — the
 * one most likely to cross a withheld clause — so it asked a dimension no
 * premise linked on 70 of 72 Direction checkpoint items and 69 of 72 in Space
 * 4D. The construction offers no "can't tell", so that slot had no answer.
 *
 * Read from the card alone: a dimension links two things only through
 * premises that name it, so a pair is settled on a dimension exactly when such
 * premises connect it.
 */

import { assert, seeded, test } from "./harness";
import { GeneratorContext } from "../src/app/syllogimous/generators/context";
import { ProgressionService } from "../src/app/syllogimous/services/progression.service";
import { SettingsOverrideService } from "../src/app/syllogimous/services/settings-override.service";
import { Settings } from "../src/app/syllogimous/models/settings.models";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { Logger } from "../src/app/syllogimous/utils/logger";
import { createDistinction } from "../src/app/syllogimous/generators/distinction";
import { createNdSpace } from "../src/app/syllogimous/generators/ndspace";
import { ladderFor } from "../src/app/syllogimous/utils/progression.utils";

const strip = (h: string) => h.replace(/<[^>]+>/g, "");

const WORDS: Record<string, RegExp> = {
    "East-west": /\b(east|west|same longitude)\b/,
    "North-south": /\b(north|south|same latitude)\b/,
    "Up-down": /\b(above|below|same height)\b/,
    "Time": /\b(earlier|later|same time)\b/,
};

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

/** Which pairs the card links on each dimension, from the premises that name it. */
function reader(premises: string[], dims: readonly string[]) {
    const links: Record<string, Record<string, string[]>> = {};
    for (const p of premises) {
        const m = p.match(/^(\w+) is (.*) relative to (\w+)$/);
        if (!m) continue;
        for (const d of dims) {
            if (!WORDS[d].test(m[2])) continue;
            ((links[d] ??= {})[m[1]] ??= []).push(m[3]);
            (links[d][m[3]] ??= []).push(m[1]);
        }
    }
    return (d: string, a: string, b: string) => {
        const seen = new Set([a]), todo = [a];
        while (todo.length) {
            const n = todo.pop()!;
            if (n === b) return true;
            for (const k of links[d]?.[n] ?? []) if (!seen.has(k)) { seen.add(k); todo.push(k); }
        }
        return false;
    };
}

const SPACES = [
    [EnumQuestionType.Direction, ["East-west", "North-south"]],
    [EnumQuestionType.Space4D, ["East-west", "North-south", "Up-down", "Time"]],
] as const;

test("no analogy marked true rests on a dimension the premises leave open", () => {
    for (const [type, dims] of SPACES) {
        const ladder = ladderFor(type);
        const ctx = holding(ladder.slice(0, ladder.indexOf("mirror-twins") + 1));
        let analogies = 0;
        seeded(7201, () => {
            for (let i = 0; i < 500; i++) {
                let q;
                try { q = createNdSpace(ctx, 6, type); } catch { continue; }
                const premises = q.premises.map(strip);
                if (premises.some(p => /says|report|knight|knave|faces|twin/i.test(p))) continue;
                const marked = q.answerMode === "choice"
                    ? [strip(q.choices[q.correctChoice!])]
                    : q.isValid ? [q.conclusion].flat().map(c => strip(String(c))) : [];
                const claims = marked.map(c => c.match(/^(\w+) to (\w+) is the \w+ relation (?:as|to) (\w+) to (\w+)/))
                    .filter((m): m is RegExpMatchArray => !!m);
                if (!claims.length) continue;
                analogies++;

                const linked = reader(premises, dims);
                for (const m of claims) {
                    const open = dims.filter(d => !linked(d, m[1], m[2]) || !linked(d, m[3], m[4]));
                    assert(!open.length, `${type}: "${m[0]}" is marked true, but no premise links it on `
                        + `${open.join(", ")}:\n  ${premises.join("\n  ")}`);
                }
            }
        });
        assert(analogies >= 10, `${type}: only ${analogies} analogy items to check`);
    }
});

test("no built claim asks a dimension the premises leave open", () => {
    for (const [type, dims] of SPACES) {
        const ladder = ladderFor(type);
        const ctx = holding(ladder.slice(0, ladder.indexOf("mirror-twins") + 1));
        let claims = 0, checkpoints = 0;
        seeded(7202, () => {
            for (let i = 0; i < 500; i++) {
                let q;
                try { q = createNdSpace(ctx, 6, type); } catch { continue; }
                if (q.answerMode !== "construct") continue;
                const premises = q.premises.map(strip);
                if (premises.some(p => /says|report|knight|knave/i.test(p))) continue;
                const linked = reader(premises, dims);
                if (q.construct.some(c => c.fromPremises != null)) checkpoints++;
                for (const c of q.construct) {
                    // The checkpoint's first claim is answered from the first
                    // half, which a premise further down cannot unsettle.
                    if (c.fromPremises != null && c.fromPremises < q.premises.length) continue;
                    const open = dims.filter(d => !linked(d, c.a, c.b));
                    assert(!open.length, `${type}: a built claim asks ${c.a} against ${c.b}, but no premise links `
                        + `them on ${open.join(", ")}:\n  ${premises.join("\n  ")}`);
                    claims++;
                }
            }
        });
        assert(claims >= 40, `${type}: only ${claims} built claims to check`);
        assert(checkpoints >= 10, `${type}: only ${checkpoints} checkpoint items — the fix should not stop them`);
    }
});
