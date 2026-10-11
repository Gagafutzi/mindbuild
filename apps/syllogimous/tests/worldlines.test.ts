/**
 * Worldlines, held to a reader that works from the card alone.
 *
 * The reader parses the stamped placements and the paces out of the rendered
 * text, places everything at hour 0, and then *scans* hours rather than solving
 * the generator's closed form: an event is found by stepping the clock, and is
 * required to happen exactly once. Two routes to one answer, sharing nothing but
 * the words on the card.
 *
 * Beside agreement: each rung is delivered when held and only then, the readings
 * that skip a correction fail where the design says they must, and the hour the
 * question names actually decides the answer.
 */

import { assert, equal, seeded, test } from "./harness";
import { ctxHolding, strip } from "./coupling.test";
import { createWorldlines } from "../src/app/syllogimous/generators/worldlines";
import { Question } from "../src/app/syllogimous/models/question.models";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { QUESTION_TYPE_SETTING_PARAMS } from "../src/app/syllogimous/constants/settings.constants";
import { setSymbolRelations, symboliseStatement } from "../src/app/syllogimous/utils/phrasing";

const TYPE = EnumQuestionType.Worldlines;
const RANGE = QUESTION_TYPE_SETTING_PARAMS[TYPE];

/* ------------------------------------------------------------------ *
 * The reader                                                          *
 * ------------------------------------------------------------------ */

const WORDS: Record<string, [number, number]> = {
    "east": [0, 1], "west": [0, -1], "same longitude": [0, 0],
    "north": [1, 1], "south": [1, -1], "same latitude": [1, 0],
    "above": [2, 1], "below": [2, -1], "same height": [2, 0],
};

/** "east, same latitude, below" → [1, 0, -1], reading each clause by its words. */
function readPattern(text: string, dims: number): number[] {
    const out = Array(dims).fill(NaN);
    for (const clause of text.split(",").map(c => c.trim())) {
        const hit = WORDS[clause];
        if (!hit) throw new Error(`unread clause "${clause}" in "${text}"`);
        out[hit[0]] = hit[1];
    }
    if (out.some(Number.isNaN)) throw new Error(`incomplete pattern "${text}"`);
    return out;
}

interface Reading {
    dims: number;
    pos0: Map<string, number[]>;
    pace: Map<string, number[]>;
    /** Where `y` stands from `x` at hour `t`. */
    rel: (x: string, y: string, t: number) => number[];
}

const PLACED = /^At (\d+) o'clock, (\S+) is (.+) relative to (\S+)$/;
const PACED = /^Every hour, (\S+) ends up (.+) relative to where it was the hour before$/;

function read(q: Question, override?: (pace: Map<string, number[]>) => void): Reading {
    const lines = q.premises.map(strip);
    const dims = lines.map(l => PLACED.exec(l) ?? PACED.exec(l))
        .map(m => m![m!.length === 5 ? 3 : 2].split(",").length)[0];
    const pace = new Map<string, number[]>();
    const placed: Array<{ hour: number; a: string; b: string; d: number[] }> = [];
    for (const line of lines) {
        const p = PLACED.exec(line);
        if (p) { placed.push({ hour: +p[1], a: p[2], d: readPattern(p[3], dims), b: p[4] }); continue; }
        const v = PACED.exec(line);
        if (v) { pace.set(v[1], readPattern(v[2], dims)); continue; }
        throw new Error(`unread premise "${line}"`);
    }
    override?.(pace);
    const v = (w: string) => pace.get(w) ?? Array(dims).fill(0);

    /* p_a(τ) − p_b(τ) = d, so at hour 0: p_a − p_b = d − (v_a − v_b)·τ. */
    const pos0 = new Map<string, number[]>([[placed[0].b, Array(dims).fill(0)]]);
    for (let grew = true; grew;) {
        grew = false;
        for (const { hour, a, b, d } of placed) {
            const off = d.map((di, k) => di - (v(a)[k] - v(b)[k]) * hour);
            if (pos0.has(b) && !pos0.has(a)) { pos0.set(a, pos0.get(b)!.map((p, k) => p + off[k])); grew = true; }
            if (pos0.has(a) && !pos0.has(b)) { pos0.set(b, pos0.get(a)!.map((p, k) => p - off[k])); grew = true; }
        }
    }
    const at = (w: string, t: number) => pos0.get(w)!.map((p, k) => p + v(w)[k] * t);
    return { dims, pos0, pace, rel: (x, y, t) => at(y, t).map((p, k) => p - at(x, t)[k]) };
}

const HOURS = Array.from({ length: 101 }, (_, i) => i - 50);
const sgn = (n: number) => Math.sign(n) || 0;

type Form = "at" | "level" | "meet";
const AT = /^At (\d+) o'clock, how does (\S+) stand to (\S+)\?$/;
const LEVEL = /^When (\S+) and (\S+) reach the (.+), how does (\S+) stand to (\S+)\?$/;
const MEET = /^Do (\S+) and (\S+) ever stand in the same place\? If so, when\?$/;

function formOf(q: Question): Form {
    const p = strip(q.choicePrompt ?? "");
    if (AT.test(p)) return "at";
    if (LEVEL.test(p)) return "level";
    if (MEET.test(p)) return "meet";
    throw new Error(`unread prompt "${p}"`);
}

/** The option the reader picks, or a reason it could not. */
function solve(q: Question, override?: (pace: Map<string, number[]>) => void): number | string {
    const r = read(q, override);
    const prompt = strip(q.choicePrompt ?? "");
    const options = q.choices.map(strip);

    const at = AT.exec(prompt);
    if (at) {
        const rel = r.rel(at[3], at[2], +at[1]).map(sgn);
        return options.findIndex(o => readPattern(o, r.dims).join() === rel.join());
    }
    const level = LEVEL.exec(prompt);
    if (level) {
        const [, y, x, tie, y2, x2] = level;
        if (y !== y2 || x !== x2) return "the prompt changes pair";
        const e = WORDS[tie][0];
        const hours = HOURS.filter(t => r.rel(x, y, t)[e] === 0);
        if (hours.length !== 1) return `level on axis ${e} at ${hours.length} hours`;
        const rel = r.rel(x, y, hours[0]);
        return options.findIndex(o => {
            const [k, s] = WORDS[o];
            return s !== 0 && sgn(rel[k]) === s;
        });
    }
    const meet = MEET.exec(prompt);
    if (meet) {
        const [, y, x] = meet;
        const hours = HOURS.filter(t => r.rel(x, y, t).every(c => c === 0));
        if (hours.length > 1) return "they share a place at several hours";
        const want = hours.length ? `At ${hours[0]} o'clock` : "They never meet";
        return options.indexOf(want);
    }
    return "unread prompt";
}

/** Items of one holding, across every length. */
function items(held: string[], seed: number, perLength = 12): Question[] {
    const out: Question[] = [];
    let failed = 0;
    for (let n = RANGE.minNumOfPremises; n <= RANGE.maxNumOfPremises; n++) {
        seeded(seed + n, () => {
            for (let i = 0; i < perLength; i++) {
                try { out.push(createWorldlines(ctxHolding(held), n)); } catch { failed++; }
            }
        });
    }
    assert(failed <= out.length / 10, `${failed} draws threw against ${out.length} built`);
    return out;
}

/* ------------------------------------------------------------------ *
 * Agreement                                                           *
 * ------------------------------------------------------------------ */

for (const held of [[], ["level"], ["meet"]]) {
    test(`Worldlines: a reader scanning hours agrees with the marked answer (${held[0] ?? "at"})`, () => {
        const qs = items(held, 81000);
        assert(qs.length >= 60, `only ${qs.length} items built`);
        const wrong: string[] = [];
        for (const q of qs) {
            const pick = solve(q);
            if (pick !== q.correctChoice) {
                wrong.push(`${pick} vs ${q.correctChoice}: ${strip(q.choicePrompt!)} | `
                    + q.premises.map(strip).join(" / "));
            }
        }
        equal(wrong.length, 0, `${wrong.length}/${qs.length} disagree:\n  ${wrong.slice(0, 3).join("\n  ")}`);
    });
}

/* ------------------------------------------------------------------ *
 * Delivery                                                            *
 * ------------------------------------------------------------------ */

test("Worldlines: a held rung is the form served, and an unheld one never is", () => {
    for (const [held, want] of [[[], "at"], [["level"], "level"], [["meet"], "meet"]] as Array<[string[], Form]>) {
        const qs = items(held, 82000, 6);
        assert(qs.length > 0, `nothing built holding ${held.join() || "nothing"}`);
        for (const q of qs) {
            equal(formOf(q), want, `holding ${held.join() || "nothing"}`);
            equal(q.undelivered.length, 0, `holding ${held.join() || "nothing"}, recorded as undelivered`);
        }
    }

    /* Both held: one per item, and the other recorded so it is not charged. */
    const both = items(["level", "meet"], 83000, 10);
    const forms = new Set(both.map(formOf));
    assert(forms.has("level") && forms.has("meet"), `holding both served only ${[...forms]}`);
    for (const q of both) {
        const other = formOf(q) === "level" ? "meet" : "level";
        assert(q.undelivered.length === 1 && q.undelivered[0] === other,
            `served ${formOf(q)} and recorded [${q.undelivered}] as undelivered`);
    }
});

/* ------------------------------------------------------------------ *
 * The readings that skip a correction                                 *
 * ------------------------------------------------------------------ */

/**
 * The reading with every pace left out: the placements chained as if they held
 * at once. For `level` there is then no hour at which anything draws level, so
 * the static reader reads the asked axis as it stands — which is all it has.
 */
function stillRead(q: Question): number | string {
    const level = LEVEL.exec(strip(q.choicePrompt!));
    if (!level) return solve(q, pace => pace.clear());
    const [, y, x] = level;
    const rel = read(q, pace => pace.clear()).rel(x, y, 0);
    return q.choices.map(strip).findIndex(o => {
        const [k, s] = WORDS[o];
        return sgn(rel[k]) === s;
    });
}

test("Worldlines: chaining as if every placement held at once never passes", () => {
    for (const held of [[], ["level"]]) {
        const qs = items(held, 84000);
        const passed = qs.filter(q => stillRead(q) === q.correctChoice);
        equal(passed.length, 0,
            `${passed.length}/${qs.length} ${held[0] ?? "at"} items are passed by the static chain`);
    }
});

test("Worldlines: moving only the asked pair never passes the base form", () => {
    let checked = 0;
    for (const q of items([], 85000)) {
        const [, , y, x] = AT.exec(strip(q.choicePrompt!))!;
        const pick = solve(q, pace => {
            for (const w of [...pace.keys()]) if (w !== x && w !== y) pace.delete(w);
        });
        assert(pick !== q.correctChoice,
            `the asked pair's motion alone answers: ${q.premises.map(strip).join(" / ")}`);
        checked++;
    }
    assert(checked >= 60, `only ${checked} items checked`);
});

/**
 * The hour comes from another axis, so changing only that axis's pace has to be
 * able to change the answer. The design's probe found it flips in 82 of 195; a
 * rung whose answer the event axis never moved would be per-axis after all.
 */
test("Worldlines: in `level`, the event axis's pace alone can flip the answer", () => {
    let eligible = 0, flipped = 0;
    for (const q of items(["level"], 86000)) {
        const [, y, x, tie] = LEVEL.exec(strip(q.choicePrompt!))!;
        const e = WORDS[tie][0];
        const base = read(q);
        const asked = WORDS[strip(q.choices[0])][0];
        const before = sgn(base.rel(x, y, HOURS.find(t => base.rel(x, y, t)[e] === 0)!)[asked]);
        let moved = false, any = false;
        for (const s of [-1, 0, 1]) {
            const r = read(q, pace => {
                const v = [...(pace.get(y) ?? Array(base.dims).fill(0))];
                v[e] = s;
                pace.set(y, v);
            });
            const hours = HOURS.filter(t => r.rel(x, y, t)[e] === 0);
            if (hours.length !== 1 || s === (base.pace.get(y)?.[e] ?? 0)) continue;
            any = true;
            if (sgn(r.rel(x, y, hours[0])[asked]) === -before) moved = true;
        }
        if (any) eligible++;
        if (moved) flipped++;
    }
    assert(eligible >= 30, `only ${eligible} items could be perturbed`);
    assert(flipped / eligible >= 0.25,
        `the event axis flipped the answer in ${flipped}/${eligible}: the hour barely matters`);
});

test("Worldlines: in `level`, the asked relation turns over during the day", () => {
    for (const q of items(["level"], 87000)) {
        const [, y, x] = LEVEL.exec(strip(q.choicePrompt!))!;
        const r = read(q);
        const asked = WORDS[strip(q.choices[0])][0];
        const signs = new Set(Array.from({ length: 12 }, (_, t) => sgn(r.rel(x, y, t)[asked])));
        assert(signs.has(1) && signs.has(-1) || signs.has(0),
            `${strip(q.choicePrompt!)} reads the same at every hour: the hour asked never matters`);
    }
});

/**
 * Level on every axis is not meeting. A reader who takes one axis's level hour
 * as the meeting should be right only when the hours coincide — half the items.
 */
test("Worldlines: in `meet`, the per-axis meeting is right half the time", () => {
    const qs = items(["meet"], 88000, 20);
    let hourRight = 0;
    for (const q of qs) {
        const [, y, x] = MEET.exec(strip(q.choicePrompt!))!;
        const r = read(q);
        // Every axis is level once, on the clock: no axis decides it alone.
        for (let k = 0; k < r.dims; k++) {
            const hours = HOURS.filter(t => r.rel(x, y, t)[k] === 0);
            equal(hours.length, 1, `axis ${k} is level at ${hours.length} hours`);
        }
        const hourOption = q.choices.findIndex(c => strip(c).startsWith("At "));
        if (hourOption === q.correctChoice) hourRight++;
    }
    const share = hourRight / qs.length;
    assert(share > 0.35 && share < 0.65,
        `the per-axis meeting is right on ${(share * 100).toFixed(0)}% of ${qs.length} items`);
});

/* ------------------------------------------------------------------ *
 * Rendering                                                           *
 * ------------------------------------------------------------------ */

test("Worldlines: the card states the rule, colours every direction, and states only movers' paces", () => {
    for (const q of items(["level", "meet"], 89000, 4).concat(items([], 89500, 4))) {
        assert(q.setup.some(l => strip(l).includes("same pace")), "the card never states the pace rule");
        for (const line of q.premises) {
            const clauses = (line.match(/<span class="highlight dim dim-\d+">[^<]*<\/span>/g) ?? []).length;
            assert(clauses >= 2, `a premise without coloured clauses: ${line}`);
            if (PACED.test(strip(line))) {
                assert(/east|west|north|south|above|below/.test(strip(line)),
                    `a pace line for something that does not move: ${strip(line)}`);
            }
        }
        // Symbolised, the stamp and the pace survive and the directions do not.
        setSymbolRelations(true);
        try {
            for (const line of [...q.premises, ...q.choices].map(l => strip(symboliseStatement(l)))) {
                assert(!/\b(east|west|north|south|above|below|same)\b/.test(line), `a word survives: ${line}`);
            }
        } finally {
            setSymbolRelations(false);
        }
        assert(q.explanation.length >= 3, "no working shown");
    }
});

test("Worldlines: the asked pair is never one a placement states", () => {
    for (const held of [[], ["level"], ["meet"]]) {
        for (const q of items(held, 90000, 8)) {
            const p = strip(q.choicePrompt!);
            const m = AT.exec(p) ?? MEET.exec(p) ?? LEVEL.exec(p)!;
            const [x, y] = AT.test(p) ? [m[3], m[2]] : [m[2], m[1]];
            const stated = q.premises.map(strip).some(l => {
                const s = PLACED.exec(l);
                return s && ((s[2] === x && s[4] === y) || (s[2] === y && s[4] === x));
            });
            assert(!stated, `"${p}" is answered by a premise on the card`);
        }
    }
});
