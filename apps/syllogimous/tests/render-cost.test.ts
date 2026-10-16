/**
 * What a render costs, and that it does not grow with play.
 *
 * The skill number, the tier, the settings and the unlocked row are getters
 * that templates read on every change-detection pass. Each pass used to parse
 * every mode's posterior out of storage and refit the aggregate (and `tier`
 * did it once per tier), so the app slowed down the more modes had been played.
 * The fix keeps parsed ledgers beside the string they came from and remembers
 * the aggregate until a ledger changes. These tests hold it to both halves:
 * reads cost nothing once warm, and a changed ledger is never missed.
 */

import { assert, equal, test } from "./harness";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { ProgressionService } from "../src/app/syllogimous/services/progression.service";

const MODES = [
    EnumQuestionType.Distinction,
    EnumQuestionType.ComparisonNumerical,
    EnumQuestionType.LinearVertical,
    EnumQuestionType.Direction,
];

function played(service: ProgressionService, answers: number) {
    for (let i = 0; i < answers; i++) {
        service.record(MODES[i % MODES.length], i % 3 ? "right" : "wrong", 6);
    }
}

function countParses(fn: () => void): number {
    const real = JSON.parse;
    let n = 0;
    (JSON as any).parse = (...args: any[]) => { n++; return (real as any)(...args); };
    try { fn(); } finally { (JSON as any).parse = real; }
    return n;
}

/* Through key()/length, which both the browser and the harness's shim have. */
function abilityKeys(): string[] {
    const out: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("syllogimous-ability:")) out.push(k);
    }
    return out;
}

test("reading the skill number, again and again, parses nothing once warm", () => {
    localStorage.clear();
    const service = new ProgressionService();
    played(service, 40);
    service.skillPoints;
    service.unlockEvidence();

    const parses = countParses(() => {
        for (let i = 0; i < 200; i++) {
            service.skillPoints;
            service.skill;
            service.unlockEvidence();
        }
    });
    equal(parses, 0, `200 renders' worth of reads parsed storage ${parses} times`);
});

test("an answer moves the skill number straight away", () => {
    localStorage.clear();
    const service = new ProgressionService();
    played(service, 12);
    const before = service.skillPoints;
    for (let i = 0; i < 20; i++) service.record(EnumQuestionType.Distinction, "right", 4);
    const after = service.skillPoints;
    assert(after !== before, `twenty right answers left the skill number at ${before}`);
});

test("a ledger written straight into storage is read, not the remembered one", () => {
    localStorage.clear();
    const service = new ProgressionService();
    played(service, 8);
    const early: Record<string, string> = {};
    for (const k of abilityKeys()) early[k] = localStorage.getItem(k)!;
    assert(Object.keys(early).length > 0, "no ledger was written to import");

    played(service, 60);
    const late = service.skillPoints;

    // What an import does: put other ledgers in place without telling anyone.
    for (const k of abilityKeys()) localStorage.removeItem(k);
    for (const k of Object.keys(early)) localStorage.setItem(k, early[k]);

    const fresh = new ProgressionService().skillPoints;
    assert(fresh !== late, "the early ledgers score the same as the late ones; the test proves nothing");
    const seen = service.skillPoints;
    equal(seen, fresh, `after an import the running app read ${seen}, a fresh one ${fresh} (before: ${late})`);
});

test("a cleared ledger is seen as cleared", () => {
    localStorage.clear();
    const service = new ProgressionService();
    played(service, 30);
    assert(service.skill.modes > 0, "no mode was measured after thirty answers");
    for (const k of abilityKeys()) localStorage.removeItem(k);
    equal(service.skill.modes, 0, "the remembered aggregate outlived its ledgers");
});
