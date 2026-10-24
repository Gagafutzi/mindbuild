/**
 * Composed World — an item, worded: the premises, the setup lines that say the
 * rules of this particular space, the analogy asked, and how it follows.
 */

import { hi, subj } from "../phrasing";
import { Axis } from "./space";
import { POST, POST_NAME, Wording, clause, clock, describeFact, describeStatement, LONG, towards } from "./facts";
import { Item } from "./build";
import { Part, relation } from "./questions";
import { thingAt } from "./reader";

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

/** The rules of this space, in the order they are needed. */
export function setupLines(axes: Axis[], colors: string[] = []): string[] {
    const out = [
        `Everyone speaking is a ${hi("knight")}, who only says true things, or a ${hi("knave")}, who only says false ones.`,
        `A thing's place on each line is its low end, and it runs on from there for its length: ${LONG} where a length is said, otherwise it is a point. The Post stands at 0 on every axis, never moves and is a point.`,
        `Everything keeps its pace all day; anything nobody says moves stays still. A statement holds at the hour it names, after anything that happens on that hour. Every turn, mirror and stretch is about ${POST_NAME}.`,
    ];
    /* Every relation word in a marked span, so that minimal mode and fresh
       labels convert the rule along with the premises it governs. */
    axes.forEach((a, i) => {
        if (a.kind !== "ring") return;
        const cyc = a.scale.cyclic!, seam = a.seam!;
        let line = `Along ${hi(axisWord(a), colors[i])}, things go round a ring of ${a.modulus} ${cyc.step}s, counted ${hi(cyc.direction[0], colors[i])}`
            + ` from ${POST_NAME}'s place; past the last they come back round to ${POST_NAME}'s`;
        if (seam.type === "twist") {
            line += `, and crossing there mirrors ${hi(axisWord(axes[seam.target]), colors[seam.target])} through ${POST_NAME}'s line, pace included`;
        }
        if (seam.type === "portal") {
            const t = axes[seam.target].scale.direction, c = colors[seam.target];
            line += `, and crossing there ${hi(cyc.direction[0], colors[i])} carries a thing ${hi(`${seam.shift} ${t[0]}`, c)}`
                + ` (${hi(`${seam.shift} ${t[1]}`, c)} when crossed the other way)`;
        }
        out.push(line + ".");
    });
    return out;
}

function partWords(axes: Axis[], i: number, p: Part, colors: string[]): string {
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

export function render(item: Item, things: string[], speakers: string[], colors: string[]): Rendered {
    const axes = item.world.axes, w: Wording = { axes, colors, things, speakers };
    const name = (x: number) => (x === POST ? POST_NAME : subj(things[x]));
    const q = item.ask;
    const on = q.on.map(i => hi(axisWord(axes[i]), colors[i])).join(", ");
    const out: Rendered = {
        setup: setupLines(axes, colors),
        premises: item.card.statements.map(s => describeStatement(w, s)),
        conclusion: "", choices: [], correctChoice: -1, selectAnswer: [], prompt: "", explanation: [],
    };

    /* How the answer follows: who was unmasked how, then the relation read at
       one hour and looked for at the other. */
    const rec = item.reconstruction;
    out.explanation.push(...rec.unmasked.map(u => u.by === "claims"
        ? `${subj(speakers[u.speaker])} is a ${hi(rec.types[u.speaker] ? "knight" : "knave")}, from what the speakers say of each other`
        : `${subj(speakers[u.speaker])} is a ${hi(rec.types[u.speaker] ? "knight" : "knave")}: "${describeFact(w, u.by)}" is ${rec.types[u.speaker] ? "true" : "false"}`));

    if (q.kind === "speakers") {
        const kindOf = (i: number) => (rec.types[i] ? "knight" : "knave");
        out.prompt = `${subj(speakers[q.x])} stands to ${subj(speakers[q.y])} as ${subj(speakers[q.z])} stands to which speaker, in being alike or unalike in what they are?`;
        out.choices = q.options!.map(i => subj(speakers[i]));
        out.correctChoice = q.options!.indexOf(item.answer as number);
        out.explanation.push(`${subj(speakers[q.x])} is a ${kindOf(q.x)} and ${subj(speakers[q.y])} a ${kindOf(q.y)}, so ${subj(speakers[q.z])}, a ${kindOf(q.z)}, goes with ${subj(speakers[item.answer as number])}, a ${kindOf(item.answer as number)}`);
        return out;
    }

    const at = (x: number, h: number) => thingAt(rec.world, x, h);
    const relText = (a: number, b: number, h: number) =>
        relation(axes, at(a, h), at(b, h), q.on).map((p, k) => partWords(axes, q.on[k], p, colors)).join(", ");
    /* "Stands to", not "is to": the prompt is not read for the key under fresh
       labels, and "is to" is in the relation table, so it was printed as a
       label nothing on the card decoded. The analogy's frame is the question's
       own wording, not a relation of the space. */
    const head = `At ${clock(q.h1)}, ${name(q.x)} stands to ${name(q.y)} on ${on} as ${name(q.z)} stands to`;
    if (q.kind === "which") {
        out.prompt = `${head} which of these at ${clock(q.h2)}?`;
        out.choices = q.options!.map(name);
        out.correctChoice = q.options!.indexOf(item.answer as number);
    } else if (q.kind === "every") {
        out.prompt = `${head} which of these at ${clock(q.h2)}? Select every one that fits, or none.`;
        out.choices = q.options!.map(name);
        out.selectAnswer = (item.answer as number[]).map(a => q.options!.indexOf(a)).sort((a, b) => a - b);
    } else {
        out.conclusion = `${head} ${name(q.w!)} at ${clock(q.h2)}`;
    }
    out.explanation.push(`at ${clock(q.h1)}, ${name(q.x)} is ${relText(q.x, q.y, q.h1)} relative to ${name(q.y)}`);
    const among = q.kind === "judge" ? [q.w!] : q.options!;
    for (const o of among) out.explanation.push(`at ${clock(q.h2)}, ${name(q.z)} is ${relText(q.z, o, q.h2)} relative to ${name(o)}`);
    /* Places at the two hours, the bodies the relations were read off. */
    const where = (x: number, h: number) => `${name(x)}: ${at(x, h).pos.map((v, i) => clause(w, i, v)).join(", ")}`
        + (at(x, h).size.some(s => s > 1) ? ` (${at(x, h).size.map((s, i) => (s > 1 ? hi(`${s} long ${axisWord(axes[i])}`, colors[i]) : "")).filter(Boolean).join(", ")})` : "");
    out.explanation.push(`from ${POST_NAME} at ${clock(q.h1)} — ${[q.x, q.y].filter(x => x !== POST).map(x => where(x, q.h1)).join("; ")}`);
    return out;
}
