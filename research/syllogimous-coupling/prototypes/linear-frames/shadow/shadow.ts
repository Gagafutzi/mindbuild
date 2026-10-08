// Does the facing / mirror-twins rung fire for a player who holds the ladder
// prefix up to it? Rungs are a prefix (progression.service rungsFor), so holding
// mirror-twins means holding everything before it, construct-conclusion included.
import { GeneratorContext } from "/home/user/mindbuild/apps/syllogimous/src/app/syllogimous/generators/context";
import { Settings } from "/home/user/mindbuild/apps/syllogimous/src/app/syllogimous/models/settings.models";
import { EnumQuestionType } from "/home/user/mindbuild/apps/syllogimous/src/app/syllogimous/constants/question.constants";
import { Logger } from "/home/user/mindbuild/apps/syllogimous/src/app/syllogimous/utils/logger";
import { createDistinction } from "/home/user/mindbuild/apps/syllogimous/src/app/syllogimous/generators/distinction";
import { createNdSpace } from "/home/user/mindbuild/apps/syllogimous/src/app/syllogimous/generators/ndspace";
import { ladderFor } from "/home/user/mindbuild/apps/syllogimous/src/app/syllogimous/utils/progression.utils";

function ctxWith(prefix: number): GeneratorContext {
    const settings = new Settings();
    for (const type of Object.values(EnumQuestionType)) (settings as any).question[type].enabled = true;
    const held = (t: string) => ladderFor(t).slice(0, prefix);
    const ctx: any = {
        settings, logger: new Logger("error", false),
        settingsOverrideService: {
            linearOverride: () => null, spread: () => null, axesFor: () => null,
            circularAxes: () => null, depthFor: () => 0, scramble: 100, rungOverride: () => null,
        },
        progressionService: { hasRung: () => false, depthBonusFor: () => 0, dialFor: () => 0, mergeTarget: () => null },
        forceConstruction: "off",
        hasRung: (t: string, r: string) => held(t).includes(r),
        dialFor: () => 0,
        mergeTarget: () => null,
    };
    ctx.random = (n?: number) => createDistinction(ctx, n ?? 2);
    return ctx;
}

const ladder = ladderFor(EnumQuestionType.Space4D);
for (const upTo of ["facing", "speakers", "testimony", "analogy", "choose-conclusion", "construct-conclusion", "mirror-twins"]) {
    const prefix = ladder.indexOf(upTo) + 1;
    const ctx = ctxWith(prefix);
    let facing = 0, twins = 0, n = 0, notes = 0, constructs = 0;
    for (let i = 0; i < 300; i++) {
        try {
            const q = createNdSpace(ctx, 6, EnumQuestionType.Space4D);
            n++;
            const prem = q.premises.join(" ");
            const setup = (q.setup ?? []).join(" ");
            if (/faces/.test(prem.replace(/<[^>]+>/g, ""))) facing++;
            if (/mirror twin/.test(prem.replace(/<[^>]+>/g, ""))) twins++;
            if (/mirror twins/.test(setup)) notes++;
            if (q.answerMode === "construct") constructs++;
        } catch { /* cannot generate */ }
    }
    console.log(`ladder prefix through ${upTo.padEnd(20)} items ${n}: carry a facing premise ${facing}, a twin premise ${twins}; twin NOTE in setup ${notes}; construct answers ${constructs}`);
}
