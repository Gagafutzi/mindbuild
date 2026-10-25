/**
 * Composed World — an item, worded: the premises, the setup lines that say the
 * rules of this particular space, the analogy asked, and how it follows.
 */

import { hi, subj } from "../phrasing";
import { Axis, Frames } from "./space";
import { Fact, POST, POST_NAME, Statement, View, Wording, clause, clock, describeFact, describeStatement, holds, placeClauses, towards } from "./facts";
import { Item, StagedItem } from "./build";
import { ConstructClaim } from "../../models/question.models";
import { Answer, Ask, Part, QUESTIONS, REACH, openLength, relation } from "./questions";
import { Reconstruction, spaceOf, thingAt } from "./reader";
import { wordBreach } from "./words";

export interface Rendered {
    setup: string[];
    premises: string[];
    /** The analogy, for a true-or-false item. */
    conclusion: string;
    choices: string[];
    correctChoice: number;
    selectAnswer: number[];
    prompt: string;
    explanation: string[];
}

const axisWord = (a: Axis) => a.scale.name.toLowerCase().replace("-", "–");

/**
 * What is particular to this card's space: its rings and their seams.
 *
 * The rules every card shares — knights and knaves, lengths, paces, the hour a
 * statement holds at, the origin — are the tutorial's, given once. Printed on
 * every card they took half the screen above the premises, read once and then
 * scrolled past on every item after.
 */
export function setupLines(axes: Axis[], colors: string[] = [], compact = false, statements: Statement[] = [], frames?: Frames): string[] {
    const out: string[] = compact ? ["A place leaves out every dimension it is level on."] : [];
    if (frames) {
        const k = axes.findIndex(a => a.kind === "parity"), line = (i: number) => hi(axisWord(axes[i]), colors[i]);
        const how = frames.rule === "mirror" ? `${line(frames.axes[0])} the other way round` : `${line(frames.axes[0])} and ${line(frames.axes[1])} traded`;
        out.push(`A place said relative to a thing of the ${hi("opposite kind", colors[k])} to ${POST_NAME} is in its reckoning: ${how}.`);
    }
    /* The rule a card leans on, on the cards that lean on it. */
    if (statements.some(st => st.fact.kind === "place" && st.fact.local)) {
        out.push(`Local clocks read one step ${hi("later", colors[3])} per step ${hi("clockwise", colors[0])} from ${POST_NAME}.`);
    }
    if (statements.some(st => st.fact.kind === "signal")) {
        out.push(`A ring spreads one step ${hi("later", colors[3])} for every step it travels round ${hi("east–west", colors[0])}, along ${hi("north–south", colors[1])} and ${hi("up–down", colors[2])}.`);
    }
    axes.forEach((a, i) => {
        if (a.kind !== "ring") return;
        const cyc = a.scale.cyclic!, seam = a.seam!;
        /* Lower case inside the marked span: minimal mode converts what is marked,
           and a capitalised "East" was left in words over premises using marks. */
        let line = `Along ${hi(axisWord(a), colors[i])}, a ring of ${a.modulus} steps counted ${hi(cyc.direction[0], colors[i])} from ${POST_NAME}`;
        if (seam.type === "twist") {
            line += `; crossing back round mirrors ${hi(axisWord(axes[seam.target]), colors[seam.target])} through ${POST_NAME}, pace included`;
        }
        if (seam.type === "portal") {
            const t = axes[seam.target].scale.direction, c = colors[seam.target];
            line += `; crossing back round ${hi(cyc.direction[0], colors[i])} carries a thing ${hi(`${seam.shift} ${t[0]}`, c)}`
                + ` (${hi(`${seam.shift} ${t[1]}`, c)} the other way)`;
        }
        out.push(line + ".");
    });
    return out;
}

function partWords(axes: Axis[], i: number, p: Part, colors: string[]): string {
    if (i === REACH) return hi(p === "reaches" ? "reached by a ring from it" : "out of a ring's reach", colors[3]);
    const ax = axes[i];
    if (ax.kind === "ring") {
        const n = p as number, cyc = ax.scale.cyclic!;
        return hi(n === 0 ? ax.scale.tie : `${n} ${n === 1 ? cyc.step : cyc.step + "s"} ${cyc.direction[0]}`, colors[i]);
    }
    if (ax.kind === "parity") return hi(p === "same" ? ax.scale.parity!.same : ax.scale.parity!.opposite, colors[i]);
    const words: Record<string, string> = {
        before: `wholly ${towards(ax, 1)}`, after: `wholly ${towards(ax, 0)}`, overlaps: "partly overlapping",
        within: "within", spans: "taking in all of", identical: "the same stretch",
    };
    return hi(`${words[p as string]} (${axisWord(ax)})`, colors[i]);
}

/** One question, worded: what it asks, its options, and how the answer follows. */
export interface RenderedAsk {
    /** For a build: the one claim to build, a slot a dimension. */
    construct?: ConstructClaim[];
    prompt: string;
    conclusion: string;
    choices: string[];
    correctChoice: number;
    selectAnswer: number[];
    explanation: string[];
}

/** How each speaker was unmasked, in the order the reading found them. */
export function unmaskingLines(rec: Reconstruction, w: Wording): string[] {
    return rec.unmasked.flatMap(u => u.by === "claims" ? []
        : [`${subj(w.speakers[u.speaker])} is a ${hi(rec.types[u.speaker] ? "knight" : "knave")}: "${describeFact(w, u.by)}"`
            + `${u.space === 1 ? " inside the brackets" : ""} is ${rec.types[u.speaker] ? "true" : "false"}`]);
}

/**
 * How the words settle the first speakers: every other guess at what they
 * are, and the words that guess cannot survive.
 */
function guessLines(item: StagedItem, w: Wording): string[] {
    const firsts = item.types.map((_, i) => i).filter(i => i !== item.asking.who);
    const kind = (t: boolean) => hi(t ? "knight" : "knave");
    const guessWords = (t: boolean[]) => firsts.map(i => `${subj(w.speakers[i])} a ${kind(t[i])}`).join(" and ");
    const said = (s: Statement) => `${subj(w.speakers[s.speaker])}'s "${describeFact(w, s.fact)}"`;
    const words = item.words.filter(s => s !== item.asking.answer);
    const out: string[] = [];
    for (let m = 0; m < 1 << firsts.length; m++) {
        const t = [...item.types];
        firsts.forEach((i, j) => (t[i] = (m & (1 << j)) !== 0));
        if (t.every((v, i) => v === item.types[i])) continue;
        const b = wordBreach(item.card.axes, item.card.things, words, t);
        if (!b) continue;
        const why = b.kind === "clash" ? `${said(b.a)} and ${said(b.b)} could not both be true`
            : b.kind === "false" ? `${said(b.s)} would be false, from a knight`
            : `${said(b.s)} would be true, from a knave`
                + (b.still.length ? `: with no knight saying ${b.still.map(x => subj(w.things[x])).join(" or ")} moves, ${b.still.length > 1 ? "they stay" : "it stays"} still` : "")
                + (b.none ? ": nothing happens that no knight says does" : "");
        out.push(`Were ${guessWords(t)}, ${why}`);
    }
    return [...out, `Only ${guessWords(item.types)} leaves every word as its speaker's kind needs it`];
}

/** A question about the world, as put to a speaker. */
export const questionWords = (w: Wording, f: Fact | null) => (f ? `Is it so that ${describeFact(w, f)}?` : "Are you a knight?");

/** The asked speaker's answer, as the card shows it. */
export function answerLine(item: StagedItem, w: Wording): string {
    const a = item.asking.answer.fact, asked = a.kind === "not" ? a.f : a;
    return `Asked whether ${describeFact(w, asked)}, ${subj(w.speakers[item.asking.who])} answers ${hi(a.kind === "not" ? "no" : "yes")}`;
}

/**
 * The question stage: which questions, put to the speaker the words leave
 * unsaid, would tell what they are. Those whose answer the words already
 * settle; not one they leave open, and never "Are you a knight?".
 */
export function renderQuestion(item: StagedItem, w: Wording): RenderedAsk {
    const who = subj(w.speakers[item.asking.who]), opts = item.asking.options;
    const so = (f: Fact) => holds(f, worldView(item.reconstruction)) === true;
    return {
        prompt: `${who} has said nothing yet. Which of these questions, put to ${who}, would tell you whether ${who} is a knight or a knave? Select every one that would.`,
        conclusion: "", correctChoice: -1,
        choices: opts.map(o => questionWords(w, o.fact)),
        selectAnswer: opts.map((o, i) => (o.tells ? i : -1)).filter(i => i >= 0),
        explanation: opts.map(o => !o.fact ? `"Are you a knight?": a knight and a knave both answer yes`
            : o.tells ? `Whether ${describeFact(w, o.fact)}: the words already settle it — it is ${so(o.fact) ? "so" : "not so"} — so a knight answers ${so(o.fact) ? "yes" : "no"} and a knave ${so(o.fact) ? "no" : "yes"}`
            : `Whether ${describeFact(w, o.fact)}: nothing said yet settles it, so either answer could come from either`),
    };
}

/** The world a reconstruction settles on, to judge a fact in. */
function worldView(rec: Reconstruction): View {
    return {
        axes: rec.world.axes, at: (x, h) => thingAt(rec.world, x, h), start: x => (x === POST ? thingAt(rec.world, POST, 0) : rec.world.start[x]),
        observer: () => null, eventsKnownThrough: () => true, events: () => rec.world.events, types: rec.types,
    };
}

/** Where a relation is read, on a nested card; nothing on a flat one. */
const sideWords = (rec: Reconstruction, s: number | undefined, again = false) =>
    !rec.inner ? "" : s === 1 ? (again ? " inside them" : " inside the brackets") : (again ? " outside them" : " outside the brackets");

/**
 * The premises as printed. On a nested card every statement about the space
 * inside the brackets rides in brackets on one of the same speaker's statements
 * about the space outside: "Ash says: at 3 o'clock, Bee lies within Cog along
 * up–down (where Cog lies within Bee along up–down)". The words collide; the
 * brackets say which space each part is about.
 */
export function renderPremises(statements: Statement[], w: Wording, wide = false): string[] {
    const inner = statements.filter(st => st.space === 1);
    /* Two links in one sentence, where a speaker's two places chain at one hour:
       "at 3 o'clock, Ash is 2 north relative to Bee, which is 1 above relative to Cog". */
    const linked = new Map<Statement, Statement>();
    if (wide) for (const a of statements) {
        if (a.space || a.fact.kind !== "place" || linked.has(a) || [...linked.values()].includes(a)) continue;
        const fa = a.fact;
        const b = statements.find(c => c !== a && !c.space && c.speaker === a.speaker && c.fact.kind === "place"
            && c.fact.hour === fa.hour && c.fact.x === fa.y && !linked.has(c) && ![...linked.values()].includes(c));
        if (b) linked.set(a, b);
    }
    const tails = new Set(linked.values());
    const outer = statements.filter(st => !st.space && !tails.has(st));
    const riders = new Map<Statement, Statement[]>();
    for (const st of inner) {
        const hosts = outer.filter(o => o.speaker === st.speaker && !tails.has(o));
        /* The fewest riders first, so the brackets spread over the speaker's lines. */
        const host = hosts.sort((a, b) => (riders.get(a)?.length ?? 0) - (riders.get(b)?.length ?? 0))[0];
        if (!host) return [];
        riders.set(host, [...(riders.get(host) ?? []), st]);
    }
    return outer.map(o => {
        const tail = linked.get(o);
        const line = tail && tail.fact.kind === "place"
            ? `${describeStatement(w, o)}, which is ${placeClauses(w, tail.fact)} relative to ${tail.fact.y === POST ? POST_NAME : subj(w.things[tail.fact.y])}`
            : describeStatement(w, o);
        const on = riders.get(o);
        return on ? `${line} ${hi(`(where ${on.map(st => describeFact(w, st.fact)).join("; and ")})`)}` : line;
    });
}

/** One question about a reconstruction, with the relations its answer was read off. */
export function renderAsk(rec: Reconstruction, stage: { ask: Ask; answer: Answer }, w: Wording): RenderedAsk {
    const axes = rec.world.axes, { things, speakers, colors } = w, q = stage.ask, answer = stage.answer;
    const name = (x: number) => (x === POST ? POST_NAME : subj(things[x]));
    const out: RenderedAsk = { prompt: "", conclusion: "", choices: [], correctChoice: -1, selectAnswer: [], explanation: [] };

    if (q.kind === "speakers") {
        const kindOf = (i: number) => (rec.types[i] ? "knight" : "knave");
        out.prompt = `${subj(speakers[q.x])} stands to ${subj(speakers[q.y])} as ${subj(speakers[q.z])} stands to which speaker, in being alike or unalike in what they are?`;
        out.choices = q.options!.map(i => subj(speakers[i]));
        out.correctChoice = q.options!.indexOf(answer as number);
        out.explanation.push(`${subj(speakers[q.x])} is a ${kindOf(q.x)} and ${subj(speakers[q.y])} a ${kindOf(q.y)}, so ${subj(speakers[q.z])}, a ${kindOf(q.z)}, goes with ${subj(speakers[answer as number])}, a ${kindOf(answer as number)}`);
        return out;
    }

    const on = q.on.map(i => (i === REACH ? hi("whether a ring reaches", colors[3]) : hi(axisWord(axes[i]), colors[i]))).join(", ");
    const at = (x: number, h: number, s?: number) => thingAt(spaceOf(rec, s), x, h);
    const relText = (a: number, b: number, h: number, s?: number) =>
        relation(axes, at(a, h, s), at(b, h, s), q.on).map((p, k) => partWords(axes, q.on[k], p, colors)).join(", ");
    const side1 = sideWords(rec, q.s1), side2 = q.s2 === q.s1 ? "" : sideWords(rec, q.s2, true);
    /* "Stands to", not "is to": the prompt is not read for the key under fresh
       labels, and "is to" is in the relation table, so it was printed as a
       label nothing on the card decoded. The analogy's frame is the question's
       own wording, not a relation of the space. */
    const head = `At ${clock(q.h1)}${side1}, ${name(q.x)} stands to ${name(q.y)} on ${on} as ${name(q.z)} stands to`;
    if (q.kind === "build") {
        /* Where the missing term is, from the fourth thing: a direction and a
           distance a dimension, judged round a ring the way any dial is. */
        const d = answer as number[];
        out.prompt = `At ${clock(q.h1)}${side1}, ${name(q.x)} stands to ${name(q.y)} as ${name(q.z)} stands to a point ${hi("P")} at ${clock(q.h2)}${side2}`
            + ` — where is ${hi("P")}, relative to ${name(q.w!)}?`;
        out.construct = [{ a: hi("P"), b: name(q.w!), slots: axes.map((ax, i) => {
            const s = ax.scale, colorClass = colors[i];
            if (ax.kind === "parity") return { label: s.name, colorClass, directions: [s.parity!.sameRelation, s.parity!.oppositeRelation], answerDirection: d[i] === 0 ? 0 : 1, answerMagnitude: 0, asksDistance: false };
            if (ax.kind === "ring") {
                const m = ax.modulus!, forward = d[i] <= m / 2;
                return { label: s.name, colorClass, directions: [s.cyclic!.direction[0], s.cyclic!.direction[1], s.cyclic!.same], modulus: m,
                    answerDirection: d[i] === 0 ? 2 : forward ? 0 : 1, answerMagnitude: d[i] === 0 ? 0 : forward ? d[i] : m - d[i], asksDistance: true };
            }
            return { label: s.name, colorClass, directions: [s.direction[0], s.direction[1], s.same], answerDirection: d[i] === 0 ? 2 : d[i] > 0 ? 0 : 1, answerMagnitude: Math.abs(d[i]), asksDistance: true };
        }) }];
        const where = (x: number, h: number, s?: number) => `${name(x)} at ${clock(h)}: ${thingAt(spaceOf(rec, s), x, h).pos.map((v, i) => clause(w, i, v)).join(", ")}`;
        out.explanation.push(
            `from ${POST_NAME}, ${where(q.x, q.h1, q.s1)}; ${where(q.y, q.h1, q.s1)}`,
            /* The list is where P ends up from the fourth thing, not the pair's relation: said so, or it read as the latter. */
            `so ${hi("P")} is ${name(q.z)} moved the way ${name(q.y)} lies from ${name(q.x)}, which puts ${hi("P")} ${d.map((v, i) => clause(w, i, v)).join(", ")} relative to ${name(q.w!)}`,
            `${where(q.z, q.h2, q.s2)}; ${where(q.w!, q.h2, q.s2)}`);
        return out;
    }
    if (q.kind === "which") {
        out.prompt = `${head} which of these at ${clock(q.h2)}${side2}?`;
        out.choices = q.options!.map(name);
        out.correctChoice = q.options!.indexOf(answer as number);
    } else if (q.kind === "could") {
        out.prompt = `${head} which of these at ${clock(q.h2)}${side2}? The card leaves something open: select every one that could.`;
        out.choices = q.options!.map(name);
        out.selectAnswer = (answer as number[]).map(a => q.options!.indexOf(a)).sort((a, b) => a - b);
        /* What is open, and what fits in each world it leaves. */
        const open = openLength(rec);
        if (open) {
            out.explanation.push(`nothing settles ${name(open.thing)}'s length along ${hi(axisWord(axes[open.axis]), colors[open.axis])}: it could be ${open.values.length > 2 ? `${open.values.slice(0, -1).join(", ")} or ${open.values[open.values.length - 1]}` : open.values.join(" or ")}`);
            for (const world of rec.alternatives!) {
                const r = { ...rec, world };
                const fits = q.options!.filter(o => QUESTIONS.judge.answer({ ...q, kind: "judge", w: o }, r) === true);
                out.explanation.push(`if it is ${world.start[open.thing].size[open.axis]}, ${fits.length ? fits.map(name).join(" and ") : "none of them"} ${fits.length === 1 ? "fits" : "fit"}`);
            }
        }
    } else if (q.kind === "every") {
        out.prompt = `${head} which of these at ${clock(q.h2)}${side2}? Select every one that fits, or none.`;
        out.choices = q.options!.map(name);
        out.selectAnswer = (answer as number[]).map(a => q.options!.indexOf(a)).sort((a, b) => a - b);
    } else {
        out.conclusion = `${head} ${name(q.w!)} at ${clock(q.h2)}${side2}`;
    }
    out.explanation.push(`at ${clock(q.h1)}${sideWords(rec, q.s1)}, ${name(q.x)} is ${relText(q.x, q.y, q.h1, q.s1)} relative to ${name(q.y)}`);
    const among = q.kind === "judge" ? [q.w!] : q.options!;
    for (const o of among) out.explanation.push(`at ${clock(q.h2)}${sideWords(rec, q.s2)}, ${name(q.z)} is ${relText(q.z, o, q.h2, q.s2)} relative to ${name(o)}`);
    /* Places at the first hour, the bodies the first relation was read off. */
    const where = (x: number, h: number, s?: number) => `${name(x)}: ${at(x, h, s).pos.map((v, i) => clause(w, i, v)).join(", ")}`
        + (at(x, h, s).size.some(l => l > 1) ? ` (${at(x, h, s).size.map((l, i) => (l > 1 ? hi(`${l} long ${axisWord(axes[i])}`, colors[i]) : "")).filter(Boolean).join(", ")})` : "");
    out.explanation.push(`from ${POST_NAME} at ${clock(q.h1)}${sideWords(rec, q.s1)} — ${[q.x, q.y].map(x => where(x, q.h1, q.s1)).join("; ")}`);
    return out;
}

export function render(item: Item, things: string[], speakers: string[], colors: string[]): Rendered {
    const axes = item.world.axes, w: Wording = { axes, colors, things, speakers };
    const asked = renderAsk(item.reconstruction, item, w);
    return {
        setup: setupLines(axes, colors),
        premises: item.card.statements.map(s => describeStatement(w, s)),
        conclusion: asked.conclusion, choices: asked.choices, correctChoice: asked.correctChoice,
        selectAnswer: asked.selectAnswer, prompt: asked.prompt,
        /* How the answer follows: who was unmasked how, then the relation read
           at one hour and looked for at the other. */
        explanation: [...unmaskingLines(item.reconstruction, w), ...asked.explanation],
    };
}

export const TYPES_PROMPT_PAIRS = "Who is a knight and who is a knave? Select every one that is true.";
export const TYPES_PROMPT_NAMES = "Who is a knight? Select every knight; everyone else is a knave.";

/**
 * The staged item's first stage: who is a knight and who a knave, ticked.
 *
 * Two speakers are ticked as "is a knight" or "is a knave" each — four
 * options, and a selection needs three at least. Three or four are ticked by
 * name, knights only, since every menu here stops at four.
 */
export function renderTypes(item: StagedItem, w: Wording): RenderedAsk {
    const pairs = w.speakers.length * 2 <= 4;
    const choices = pairs
        ? w.speakers.flatMap(s => [`${subj(s)} is a ${hi("knight")}`, `${subj(s)} is a ${hi("knave")}`])
        : w.speakers.map(s => subj(s));
    return {
        prompt: pairs ? TYPES_PROMPT_PAIRS : TYPES_PROMPT_NAMES,
        conclusion: "", choices, correctChoice: -1,
        selectAnswer: pairs
            ? item.types.map((t, i) => 2 * i + (t ? 0 : 1))
            : item.types.map((t, i) => (t ? i : -1)).filter(i => i >= 0),
        /* Closed on the verdict, which names only the speakers asked about. */
        explanation: [...guessLines(item, w), `${answerLine(item, w)}: ${asked(item, w)}`, typesLine(item.types, w)],
    };
}

/** Why the answer settles the asked speaker. */
function asked(item: StagedItem, w: Wording): string {
    const t = item.types[item.asking.who];
    return `which is ${t ? "true" : "false"}, so ${subj(w.speakers[item.asking.who])} is a ${hi(t ? "knight" : "knave")}`;
}

/** "So Ash and Cog are knights, and Bee is a knave." */
function typesLine(types: boolean[], w: Wording): string {
    const and = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}` : xs[0]);
    const group = (k: boolean) => types.map((t, i) => (t === k ? subj(w.speakers[i]) : "")).filter(Boolean);
    const say = (xs: string[], k: string) => `${and(xs)} ${xs.length > 1 ? `are ${k}s` : `is a ${k}`}`;
    const knights = group(true), knaves = group(false);
    return `So ${[knights.length ? say(knights, "knight") : "", knaves.length ? say(knaves, "knave") : ""].filter(Boolean).join(", and ")}`;
}
