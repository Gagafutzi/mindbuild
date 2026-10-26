/**
 * Composed World — an item, worded: the premises, the setup lines that say the
 * rules of this particular space, the analogy asked, and how it follows.
 */

import { hi, subj } from "../phrasing";
import { Axis, Frames } from "./space";
import { Fact, POST, POST_NAME, Statement, Wording, clause, clock, describeFact, describeStatement, placeClauses, ringWay, towards } from "./facts";
import { Item, StagedItem } from "./build";
import { ConstructClaim } from "../../models/question.models";
import { Answer, Ask, Part, QUESTIONS, REACH, openLength, relation } from "./questions";
import { Reconstruction, spaceOf, thingAt } from "./reader";
import { Breach, wordBreach } from "./words";

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
 * What is particular to this card's space: its rings and their seams, and how
 * the other kind reckons. Composed World prints them first among the premises,
 * since they change from item to item as the premises do.
 *
 * The rules every card shares — knights and knaves, lengths, paces, the hour a
 * statement holds at, the origin, local clocks, how a ring spreads, places
 * leaving out what they are level on — are the tutorial's, given once.
 * Printed on every card they took half the screen above the premises, read
 * once and then scrolled past on every item after.
 */
export function setupLines(axes: Axis[], colors: string[] = [], frames?: Frames): string[] {
    const out: string[] = [];
    if (frames) {
        const k = axes.findIndex(a => a.kind === "parity"), line = (i: number) => hi(axisWord(axes[i]), colors[i]);
        const how = frames.rule === "mirror" ? `${line(frames.axes[0])} reversed` : `${line(frames.axes[0])} and ${line(frames.axes[1])} swapped`;
        out.push(`From a thing of the ${hi("opposite kind", colors[k])}, places are in its reckoning: ${how}.`);
    }
    axes.forEach((a, i) => {
        if (a.kind !== "ring") return;
        const seam = a.seam!;
        /* Lower case inside the marked span: minimal mode converts what is marked,
           and a capitalised "East" was left in words over premises using marks. */
        let line = `${hi(axisWord(a), colors[i])}: a ring of ${a.modulus}, counted ${hi(ringWay(a, false), colors[i])}`;
        if (seam.type === "twist") {
            line += `; crossing round mirrors ${hi(axisWord(axes[seam.target]), colors[seam.target])}, pace too`;
        }
        if (seam.type === "portal") {
            const t = axes[seam.target].scale.direction, c = colors[seam.target];
            line += `; crossing round ${hi(ringWay(a, false), colors[i])} moves a thing ${hi(`${seam.shift} ${t[0]}`, c)}`
                + ` (back: ${hi(`${seam.shift} ${t[1]}`, c)})`;
        }
        out.push(line + ".");
    });
    return out;
}

/**
 * One part of a relation, said of the other thing: "4 clockwise from Feed",
 * "wholly below Feed", "within Feed in quantity". Each part names the other
 * thing in its own way: as "(up–down) from Feed" for all of them it read
 * "wholly north of (north–south) from Knot".
 */
function partWords(axes: Axis[], i: number, p: Part, colors: string[], ref: string): string {
    if (i === REACH) return hi(p === "reaches" ? "in its ring's reach" : "beyond its ring", colors[3]) + ` from ${ref}`;
    const ax = axes[i];
    if (ax.kind === "ring") {
        const n = p as number;
        return n === 0 ? `${hi(ax.scale.tie, colors[i])} as ${ref}` : `${hi(`${n} ${ringWay(ax, false)}`, colors[i])} from ${ref}`;
    }
    if (ax.kind === "parity") return p === "same" ? `${hi(ax.scale.parity!.same, colors[i])} as ${ref}` : `${hi(ax.scale.parity!.opposite, colors[i])} from ${ref}`;
    const along = ` in ${hi(axisWord(ax), colors[i])}`;
    if (p === "before" || p === "after") return `${hi(`wholly ${towards(ax, p === "before" ? 1 : 0)}`, colors[i])} ${ref}`;
    return `${hi(({ overlaps: "overlapping", within: "within", spans: "spanning", identical: "matching" } as Record<string, string>)[p as string], colors[i])} ${ref}${along}`;
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
            + `${u.space === 1 ? " inside" : ""} is ${rec.types[u.speaker] ? "true" : "false"}`]);
}

/** A clash among a few speakers' words, and the kinds it rules out for them. */
export interface Clash { breach: Breach; kinds: Map<number, boolean> }

/**
 * The fewest clashes that rule out every guess in `bad`. A clash involves a
 * speaker or two, so it rules out every guess that has them so, whatever it
 * makes of the rest: listed guess by guess, one clash came round four times
 * and the explanation ran to twenty lines.
 */
export function guessCover(item: StagedItem, words: Statement[], bad: boolean[][]): Clash[] {
    const matches = (c: Clash, t: boolean[]) => [...c.kinds].every(([i, k]) => t[i] === k);
    const key = (c: Clash) => [...c.kinds].sort((p, q) => p[0] - q[0]).join(";");
    const found: Clash[] = [];
    for (const t of bad) {
        const breach = wordBreach(item.card.axes, item.card.things, words, t);
        if (!breach) continue;
        const c: Clash = { breach, kinds: new Map(breach.parts.map(p => [p.s.speaker, t[p.s.speaker]] as [number, boolean])) };
        if (!found.some(f => key(f) === key(c))) found.push(c);
    }
    const out: Clash[] = [];
    let left = bad.filter(t => found.some(c => matches(c, t)));
    while (left.length) {
        /* The clash ruling out most of what is left, the one naming fewer speakers on a tie. */
        const best = found.map(c => [c, left.filter(t => matches(c, t)).length] as const)
            .sort((p, q) => q[1] - p[1] || p[0].kinds.size - q[0].kinds.size)[0][0];
        out.push(best);
        left = left.filter(t => !matches(best, t));
    }
    return out;
}

/**
 * How the words and the answer settle the speakers: what the words rule out,
 * each clash once, the readings they leave open for the question to settle,
 * and how the answer settles them.
 */
function guessLines(item: StagedItem, w: Wording): string[] {
    const all = item.types.map((_, i) => i), answer = item.asking.answer;
    const kind = (t: boolean) => hi(t ? "knight" : "knave");
    const name = (i: number) => subj(w.speakers[i]);
    const guessWords = (t: boolean[]) => all.map(i => `${name(i)} ${kind(t[i])}`).join(", ");
    const said = (s: Statement) => `${name(s.speaker)}'s "${describeFact(w, s.fact)}"`;
    /* "Ham isn't a knave", "Bee and Cog aren't both knights", "Bee isn't a knight with Cog a knave". */
    const ruled = (c: Clash) => {
        const ks = [...c.kinds];
        if (ks.length === 1) return `${name(ks[0][0])} isn't a ${kind(ks[0][1])}`;
        if (ks.every(([, k]) => k === ks[0][1])) return `${ks.map(([i]) => name(i)).join(" and ")} aren't ${ks.length > 2 ? "all" : "both"} ${kind(ks[0][1])}s`;
        const [[i, k], ...rest] = ks;
        return `${name(i)} isn't a ${kind(k)} with ${rest.map(([j, l]) => `${name(j)} a ${kind(l)}`).join(" and ")}`;
    };
    /* The words a knight's would make true and a knave's false, which nothing can make so together. */
    const why = (c: Clash) => {
        const ps = c.breach.parts, same = ps.every(p => c.kinds.get(p.s.speaker) === c.kinds.get(ps[0].s.speaker));
        const each = ps.map(p => `${said(p.s)}${same ? "" : ` ${c.kinds.get(p.s.speaker) ? "true" : "false"}`}`).join(" and ");
        const all2 = ps.length > 2 ? "all" : "both";
        return `${ruled(c)}: ${each} can't ${all2} be${same ? ` ${c.kinds.get(ps[0].s.speaker) ? "true" : "false"}` : ""}`;
    };
    const words = item.words.filter(s => s !== answer);
    const guesses = Array.from({ length: 1 << all.length }, (_, m) => all.map(i => (m & (1 << i)) !== 0))
        .filter(t => !t.every((v, i) => v === item.types[i]));
    const open = guesses.filter(t => !wordBreach(item.card.axes, item.card.things, words, t));
    const out = guessCover(item, words, guesses.filter(t => !open.includes(t))).map(why);
    out.push(`The words leave ${[item.types, ...open].map(guessWords).join("; or ")}`);
    out.push(answerLine(item, w));
    out.push(...guessCover(item, item.words, open).map(why));
    return out;
}

/** A question about the world, as put to a speaker. */
export const questionWords = (w: Wording, f: Fact) => `${describeFact(w, f)}?`;

/** The asked speaker's answer, as the card shows it. */
export function answerLine(item: StagedItem, w: Wording): string {
    const a = item.asking.answer.fact, asked = a.kind === "not" ? a.f : a;
    return `Asked "${describeFact(w, asked)}?", ${subj(w.speakers[item.asking.who])} says ${hi(a.kind === "not" ? "no" : "yes")}`;
}

/**
 * The question stage: which questions, put to the speaker the words leave
 * unsaid, would tell what they are. Those whose answer the words already
 * settle; not one they leave open.
 */
export function renderQuestion(item: StagedItem, w: Wording): RenderedAsk {
    const who = subj(w.speakers[item.asking.who]), opts = item.asking.options, q = item.asking.who;
    /* The readings the words leave, and what the asked speaker would answer in each. */
    const words = item.words.filter(s => s !== item.asking.answer), axes = item.card.axes, n = item.card.things;
    const open = Array.from({ length: 1 << item.types.length }, (_, m) => item.types.map((_, i) => (m & (1 << i)) !== 0))
        .filter(t => !wordBreach(axes, n, words, t));
    /* What each kind could answer, over every reading the words leave. A
       question that does not tell is not always one nothing settles: asked
       what a knave's false denial makes so, both kinds say no — and "nothing
       settles it yet" sent a player looking for a mistake that was not there. */
    const could = (f: Fact, knight: boolean) => (["yes", "no"] as const).filter(a => open.some(t => t[q] === knight
        && !wordBreach(axes, n, [...words, { speaker: q, fact: a === "yes" ? f : { kind: "not", f } as Fact }], t)));
    const says = (f: Fact) => {
        const k = could(f, true), v = could(f, false);
        const shared = k.filter(a => v.includes(a)).map(a => hi(a)).join(" or ");
        if (!shared) return `as the words leave things, a knight says ${hi(k[0])}, a knave ${hi(v[0])}`;
        if (k.length === 1 && v.length === 1) return `a knight and a knave would both say ${shared}, so the answer tells nothing`;
        if (k.length === 2 && v.length === 2) return `nothing settles it yet, so either kind could say yes or no`;
        return `a knight could say ${k.map(a => hi(a)).join(" or ")}, a knave ${v.map(a => hi(a)).join(" or ")}, so a ${shared} could come from either`;
    };
    return {
        prompt: `Which questions to ${who} would tell what ${who} is? Select all that would.`,
        conclusion: "", correctChoice: -1,
        choices: opts.map(o => questionWords(w, o.fact)),
        selectAnswer: opts.map((o, i) => (o.tells ? i : -1)).filter(i => i >= 0),
        explanation: opts.map(o => `"${describeFact(w, o.fact)}?": ${says(o.fact)}`),
    };
}

/** Where a relation is read, on a nested card; nothing on a flat one. */
const sideWords = (rec: Reconstruction, s: number | undefined) =>
    !rec.inner ? "" : s === 1 ? " inside" : " outside";

/**
 * The premises as printed. On a nested card every statement about the space
 * inside the brackets rides in brackets on one of the same speaker's statements
 * about the space outside: "Ash says: at 3 o'clock, Bee lies within Cog along
 * up–down (where Cog lies within Bee along up–down)". The words collide; the
 * brackets say which space each part is about.
 */
const bare = (f: Fact): Fact => (f.kind === "not" ? bare(f.f) : f);

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
    const riders = new Map<Statement, Statement[]>(), alone: Statement[] = [];
    for (const st of inner) {
        const hosts = outer.filter(o => o.speaker === st.speaker && !tails.has(o));
        /* The fewest riders first, so the brackets spread over the speaker's lines;
           and not on a line of the same kind about the same thing, where
           "Knot is a point (where Knot is not a point)" read as a slip. */
        const alike = (o: Statement) => +(bare(o.fact).kind === bare(st.fact).kind && "x" in bare(o.fact) && "x" in bare(st.fact)
            && (bare(o.fact) as { x: number }).x === (bare(st.fact) as { x: number }).x);
        const host = hosts.sort((a, b) => alike(a) - alike(b) || (riders.get(a)?.length ?? 0) - (riders.get(b)?.length ?? 0))[0];
        if (!host) { alone.push(st); continue; }
        riders.set(host, [...(riders.get(host) ?? []), st]);
    }
    return [...outer.map(o => {
        const tail = linked.get(o);
        const line = tail && tail.fact.kind === "place"
            ? `${describeStatement(w, o)}, which is ${placeClauses(w, tail.fact)} from ${tail.fact.y === POST ? POST_NAME : subj(w.things[tail.fact.y])}`
            : describeStatement(w, o);
        const on = riders.get(o);
        return on ? `${line} ${hi(`(where ${on.map(st => describeFact(w, st.fact)).join("; and ")})`)}` : line;
    }),
    /* Inside the brackets with nothing outside to ride on — a part of the world
       shown on its own — under one heading: "(where …)" on every line was a
       word of noise a line. */
    ...(alone.length ? [hi("Inside:"), ...alone.map(st => describeFact(w, st.fact))] : [])];
}

/** One question about a reconstruction, with the relations its answer was read off. */
export function renderAsk(rec: Reconstruction, stage: { ask: Ask; answer: Answer }, w: Wording): RenderedAsk {
    const axes = rec.world.axes, { things, speakers, colors } = w, q = stage.ask, answer = stage.answer;
    const name = (x: number) => (x === POST ? POST_NAME : subj(things[x]));
    const out: RenderedAsk = { prompt: "", conclusion: "", choices: [], correctChoice: -1, selectAnswer: [], explanation: [] };

    if (q.kind === "speakers") {
        const kindOf = (i: number) => (rec.types[i] ? "knight" : "knave");
        out.prompt = `In kind, ${subj(speakers[q.x])} stands to ${subj(speakers[q.y])} as ${subj(speakers[q.z])} to which speaker?`;
        out.choices = q.options!.map(i => subj(speakers[i]));
        out.correctChoice = q.options!.indexOf(answer as number);
        out.explanation.push(`${subj(speakers[q.x])} is a ${kindOf(q.x)} and ${subj(speakers[q.y])} a ${kindOf(q.y)}, so ${subj(speakers[q.z])}, a ${kindOf(q.z)}, goes with ${subj(speakers[answer as number])}, a ${kindOf(answer as number)}`);
        return out;
    }

    const on = q.on.map(i => (i === REACH ? hi("ring reach", colors[3]) : hi(axisWord(axes[i]), colors[i]))).join(", ");
    const at = (x: number, h: number, s?: number) => thingAt(spaceOf(rec, s), x, h);
    /* The other thing named once, then "it": "4 clockwise from Feed and wholly below it". */
    const relText = (a: number, b: number, h: number, s?: number) => {
        const parts = relation(axes, at(a, h, s), at(b, h, s), q.on).map((p, k) => partWords(axes, q.on[k], p, colors, k === 0 ? name(b) : "it"));
        return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts[0];
    };
    /* Both sides said: "as Broth to which at 5?" after "At 5 inside" left the
       reader to guess that the second was inside too. */
    const side1 = sideWords(rec, q.s1), side2 = sideWords(rec, q.s2);
    /* "Stands to", not "is to": the prompt is not read for the key under fresh
       labels, and "is to" is in the relation table, so it was printed as a
       label nothing on the card decoded. The analogy's frame is the question's
       own wording, not a relation of the space. */
    const head = `At ${clock(q.h1)}${side1}, ${name(q.x)} stands to ${name(q.y)} on ${on} as ${name(q.z)} to`;
    if (q.kind === "build") {
        /* Where the missing term is, from the fourth thing: a direction and a
           distance a dimension, judged round a ring the way any dial is. */
        const d = answer as number[];
        out.prompt = `At ${clock(q.h1)}${side1}, ${name(q.x)} stands to ${name(q.y)} as ${name(q.z)} to ${hi("P")} at ${clock(q.h2)}${side2}.`
            + ` Where is ${hi("P")} from ${name(q.w!)}?`;
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
            `so ${hi("P")} is ${name(q.z)} moved as ${name(q.y)} lies from ${name(q.x)}: ${d.map((v, i) => clause(w, i, v)).join(", ")} from ${name(q.w!)}`,
            `${where(q.z, q.h2, q.s2)}; ${where(q.w!, q.h2, q.s2)}`);
        return out;
    }
    if (q.kind === "which") {
        out.prompt = `${head} which at ${clock(q.h2)}${side2}?`;
        out.choices = q.options!.map(name);
        out.correctChoice = q.options!.indexOf(answer as number);
    } else if (q.kind === "could") {
        out.prompt = `${head} which at ${clock(q.h2)}${side2}? Something is open: select all that could.`;
        out.choices = q.options!.map(name);
        out.selectAnswer = (answer as number[]).map(a => q.options!.indexOf(a)).sort((a, b) => a - b);
        /* What is open, and what fits in each world it leaves. */
        const open = openLength(rec);
        if (open) {
            out.explanation.push(`nothing settles ${name(open.thing)}'s length in ${hi(axisWord(axes[open.axis]), colors[open.axis])}: it could be ${open.values.length > 2 ? `${open.values.slice(0, -1).join(", ")} or ${open.values[open.values.length - 1]}` : open.values.join(" or ")}`);
            for (const world of rec.alternatives!) {
                const r = { ...rec, world };
                const fits = q.options!.filter(o => QUESTIONS.judge.answer({ ...q, kind: "judge", w: o }, r) === true);
                out.explanation.push(`if it is ${world.start[open.thing].size[open.axis]}, ${fits.length ? fits.map(name).join(" and ") : "none of them"} ${fits.length === 1 ? "fits" : "fit"}`);
            }
        }
    } else if (q.kind === "every") {
        out.prompt = `${head} which at ${clock(q.h2)}${side2}? Select all that fit, or none.`;
        out.choices = q.options!.map(name);
        out.selectAnswer = (answer as number[]).map(a => q.options!.indexOf(a)).sort((a, b) => a - b);
    } else {
        /* "as Z stands to W", not "as Z to W": a bare "to" between two names is
           how the mapping modes word their own rule, and minimal mode reads it so. */
        out.conclusion = `${head.replace(/ to$/, " stands to")} ${name(q.w!)} at ${clock(q.h2)}${side2}`;
    }
    out.explanation.push(`at ${clock(q.h1)}${sideWords(rec, q.s1)}, ${name(q.x)} is ${relText(q.x, q.y, q.h1, q.s1)}`);
    const among = q.kind === "judge" ? [q.w!] : q.options!;
    for (const o of among) out.explanation.push(`at ${clock(q.h2)}${sideWords(rec, q.s2)}, ${name(q.z)} is ${relText(q.z, o, q.h2, q.s2)}`);
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

export const TYPES_PROMPT_PAIRS = "Who is a knight, who a knave? Select every true one.";
export const TYPES_PROMPT_NAMES = "Select every knight; the rest are knaves.";

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
        explanation: [...guessLines(item, w), typesLine(item.types, w)],
    };
}

/** "So Ash and Cog are knights, and Bee is a knave." */
function typesLine(types: boolean[], w: Wording): string {
    const and = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}` : xs[0]);
    const group = (k: boolean) => types.map((t, i) => (t === k ? subj(w.speakers[i]) : "")).filter(Boolean);
    const say = (xs: string[], k: string) => `${and(xs)} ${xs.length > 1 ? `are ${k}s` : `is a ${k}`}`;
    const knights = group(true), knaves = group(false);
    return `So ${[knights.length ? say(knights, "knight") : "", knaves.length ? say(knaves, "knave") : ""].filter(Boolean).join(", and ")}`;
}
