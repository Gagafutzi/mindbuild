// The zigzag measurement against the real engine, through createNdSpace with a
// stub context (the same stub tests/indeterminacy.test.ts uses).
import { GeneratorContext } from "/home/user/mindbuild/apps/syllogimous/src/app/syllogimous/generators/context";
import { Settings } from "/home/user/mindbuild/apps/syllogimous/src/app/syllogimous/models/settings.models";
import { EnumQuestionType } from "/home/user/mindbuild/apps/syllogimous/src/app/syllogimous/constants/question.constants";
import { Logger } from "/home/user/mindbuild/apps/syllogimous/src/app/syllogimous/utils/logger";
import { createDistinction } from "/home/user/mindbuild/apps/syllogimous/src/app/syllogimous/generators/distinction";
import { createNdSpace } from "/home/user/mindbuild/apps/syllogimous/src/app/syllogimous/generators/ndspace";

function context(): GeneratorContext {
    const settings = new Settings();
    for (const type of Object.values(EnumQuestionType)) (settings.question as any)[type].enabled = true;
    const ctx: any = {
        settings,
        logger: new Logger("error", false),
        settingsOverrideService: {
            linearOverride: (k: string) => (k === "multiConclusion" ? false : null),
            spread: () => null, axesFor: () => null, circularAxes: () => 0, depthFor: () => 0, scramble: 100,
        },
        progressionService: { hasRung: () => false, depthBonusFor: () => 0, dialFor: () => 0, mergeTarget: () => null },
        forceConstruction: "off",
        hasRung: () => false, dialFor: () => 0, mergeTarget: () => null,
        random: (n?: number) => createDistinction(ctx, n ?? 2),
    };
    return ctx;
}

const ctx = context();
let shown = 0, oneStepNote = 0, total = 0;
for (let i = 0; i < 300; i++) {
    const q = createNdSpace(ctx, 5, EnumQuestionType.Space4D);
    total++;
    if (q.setup.some(l => l.includes("one step"))) oneStepNote++;
    if (shown < 2) {
        shown++;
        const strip = (s: string) => s.replace(/<[^>]+>/g, "");
        console.log("SETUP:", q.setup.map(strip));
        console.log("PREMISES:\n  " + q.premises.map(strip).join("\n  "));
        console.log("CONCLUSION:", strip(String(q.conclusion)), "->", q.isValid);
        console.log("EXPLANATION:\n  " + q.explanation.map(strip).join("\n  "));
        console.log();
    }
}
console.log(`ONE_STEP_NOTE on ${oneStepNote}/${total} plain Space 4D items`);
