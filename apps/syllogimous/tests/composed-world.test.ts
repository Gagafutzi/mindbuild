/**
 * Composed World, held to a reader that works from the card alone.
 *
 * The reader parses the rendered setup, premises and question back into facts,
 * rebuilds the world from them with the engine's reader, and answers the
 * question from that — so a wording that drops a sign, a seam's target or a
 * knave's turn direction shows up as a wrong answer, not as a sentence that
 * merely reads oddly. The same parsed card is then read with each shortcut,
 * and every one has to miss.
 *
 * Beside that: the clock and every transformation run backwards exactly (the
 * reader depends on it), the seams do what the setup says, every part of the
 * structure turns up in shipped items, and the guards that make an item fair
 * are each checked against the failure they exist to stop.
 */

import { assert, equal, seeded, test } from "./harness";
import { ctxHolding, strip } from "./coupling.test";
import { createComposedWorld, worldSize } from "../src/app/syllogimous/generators/composed-world";
import { Question } from "../src/app/syllogimous/models/question.models";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { QUESTION_TYPE_SETTING_PARAMS } from "../src/app/syllogimous/constants/settings.constants";
import { LINEAR_SCALES, SPATIAL_SCALES } from "../src/app/syllogimous/utils/linear.utils";
import { Axis, Body, FULL, Frames, SHORTCUTS, copyBody, moveHour, sameBody } from "../src/app/syllogimous/utils/world/space";
import { TRANSFORMS, TransformSpec, canTransform } from "../src/app/syllogimous/utils/world/transforms";
import { Fact, IntervalRel, MAX_LEN, POST, Seen, Statement, intervalRel, negate, otherKind } from "../src/app/syllogimous/utils/world/facts";
const LONG = MAX_LEN;
import { Card, OPEN_MAX, Reconstruction, read, settleTypes, thingAt, worlds } from "../src/app/syllogimous/utils/world/reader";
import { selfContradicts, wordBreach } from "../src/app/syllogimous/utils/world/words";
import { hasNextClaim, takeSeriesAnswer } from "../src/app/syllogimous/utils/answer.utils";
import { missedReview } from "../src/app/syllogimous/utils/review.utils";
import { TYPES_PROMPT_NAMES, TYPES_PROMPT_PAIRS } from "../src/app/syllogimous/utils/world/render";
import { Ask, QUESTIONS, REACH, answerFollows, answerKey } from "../src/app/syllogimous/utils/world/questions";
import { BuildOptions, Item, build, buildStaged, fitting, makeAxes, tryBuild } from "../src/app/syllogimous/utils/world/build";

const TYPE = EnumQuestionType.ComposedWorld;
const RANGE = QUESTION_TYPE_SETTING_PARAMS[TYPE];
const KINDS = Object.keys(QUESTIONS);

/* ------------------------------------------------------------------ *
 * The text reader                                                     *
 * ------------------------------------------------------------------ */

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const axisLabel = (a: Axis) => a.scale.name.toLowerCase().replace("-", "–");

/** The axes, from the setup lines and the first place: which seams the rings have, and how many axes. */
function readAxes(setup: string[], dims: number): Axis[] {
    const lines = setup.map(strip);
    const base: Axis[] = [
        { scale: SPATIAL_SCALES["east"], kind: "line" },
        { scale: SPATIAL_SCALES["north"], kind: "line" },
        { scale: SPATIAL_SCALES["up"], kind: "line" },
        { scale: LINEAR_SCALES["temporal"], kind: "line" },
        { scale: LINEAR_SCALES["contains"], kind: "line" },
        { scale: LINEAR_SCALES["quantity"], kind: "line" },
        { scale: LINEAR_SCALES["distinction"], kind: "parity" },
    ].slice(0, dims) as Axis[];
    for (const ax of base) {
        if (ax.kind !== "line") continue;
        const line = lines.find(l => l.startsWith(`${axisLabel(ax)}: a ring of `));
        if (!line) continue;
        ax.kind = "ring";
        ax.modulus = +/ring of (\d+),/.exec(line)![1];
        const twist = /crossing round mirrors (.+?), pace too/.exec(line);
        const portal = /crossing round .+? moves a thing (\d+) (\S+) \(/.exec(line);
        if (twist) ax.seam = { type: "twist", target: base.findIndex(b => axisLabel(b) === twist[1]) };
        else if (portal) ax.seam = { type: "portal", target: base.findIndex(b => b.scale.direction[0] === portal[2]), shift: +portal[1] };
        else ax.seam = { type: "plain" };
    }
    return base;
}

/** How the other kind reckons, from its setup line, where the card has one. */
function readFrames(setup: string[], axes: Axis[]): Frames | undefined {
    const line = setup.map(strip).find(l => l.startsWith("From a thing of the opposite kind, places are in its reckoning: "));
    if (!line) return undefined;
    const by = (label: string) => axes.findIndex(a => axisLabel(a) === label);
    const m = /: (.+) reversed\.$/.exec(line), s = /: (.+) and (.+) swapped\.$/.exec(line);
    if (m) return { rule: "mirror", axes: [by(m[1])] };
    if (s) return { rule: "swap", axes: [by(s[1]), by(s[2])] };
    throw new Error(`unread setup "${line}"`);
}

/** One clause of a place or a pace on axis `ax`, or null if it is not that axis's. */
function readClause(ax: Axis, c: string): number | null {
    const s = ax.scale;
    if (c === s.tie) return 0;
    if (ax.kind === "parity") return c === s.parity!.same ? 0 : c === s.parity!.opposite ? 1 : null;
    if (ax.kind === "ring") {
        /* Round a ring, "2 clockwise", "1 later": no steps, no "in the cycle". */
        const way = (k: 0 | 1) => s.cyclic!.direction[k].replace(/ in the cycle$/, "");
        const m = new RegExp(`^(\\d+) (${esc(way(0))}|${esc(way(1))})$`).exec(c);
        return m ? (m[2] === way(0) ? +m[1] : -m[1]) : null;
    }
    const m = new RegExp(`^(\\d+) (${esc(s.direction[0])}|${esc(s.direction[1])})$`).exec(c);
    return m ? (m[2] === s.direction[0] ? +m[1] : -m[1]) : null;
}

/* The question stage parses to the facts it would ask about, null for "Are you a knight?". */
interface Parsed { card: Card; ask: Ask; kind: string; questions?: Array<Fact | null>; asked?: number }

/** What the screen shows for the claim that is up. */
interface Shown { setup: string[]; premises: string[]; prompt: string; choices: string[]; dims: number }
const shown = (q: Question, dims: number): Shown => ({
    setup: q.setup, premises: q.premises, prompt: strip(q.choicePrompt || (q.conclusion as string)), choices: q.choices.map(strip), dims,
});

/** A whole card back from its words. `things` and `speakers` are the names, in index order. */
function parse(q: Shown, things: string[], speakers: string[]): Parsed {
    const axes = readAxes(q.setup, q.dims);
    const thing = new Map<string, number>([["the origin", POST], ...things.map((n, i) => [n, i] as [string, number])]);
    const who = new Map(speakers.map((n, i) => [n, i] as [string, number]));
    const T = `(the origin|${things.map(esc).join("|")})`;
    const P = `(${speakers.map(esc).join("|")})`;
    /* A speaker on themselves says "I", or "me". */
    const PI = `(${speakers.map(esc).join("|")}|I|me)`;
    let speakingNow = -1;
    const whoIs = (n: string) => (n === "I" || n === "me" ? speakingNow : who.get(n)!);
    const axisBy = (label: string) => {
        const i = axes.findIndex(a => axisLabel(a) === label);
        if (i < 0) throw new Error(`unknown axis "${label}"`);
        return i;
    };
    const dirAxis = (word: string): [number, 0 | 1] => {
        for (let i = 0; i < axes.length; i++) {
            if (axes[i].kind !== "line") continue;
            const k = axes[i].scale.direction.indexOf(word);
            if (k >= 0) return [i, k as 0 | 1];
        }
        throw new Error(`unknown direction "${word}"`);
    };

    /* A place's clauses, matched to their dimensions by their words: a compact
       place leaves out what it is level on, and "as many above as north" takes
       its size from the other line's. */
    const clauses = (text: string, body: string): number[] => {
        const delta = axes.map(() => 0);
        const bridges: Array<[number, number, number]> = [];
        if (text === "level everywhere") return delta;
        for (let c of text.split(", ")) {
            if (c.endsWith(" by local clocks")) { c = c.slice(0, -" by local clocks".length); local = true; }
            const br = /^as many (\S+(?: in the cycle)?) as (\S+)$/.exec(c);
            if (br) { const [b, side] = dirAxis(br[1]), [a] = dirAxis(br[2]); bridges.push([a, b, side === 0 ? 1 : -1]); continue; }
            const i = axes.findIndex(ax => readClause(ax, c) !== null);
            if (i < 0) throw new Error(`unread clause "${c}" in "${body}"`);
            const v = readClause(axes[i], c)!;
            /* Counted the other way round the ring: the whole place is said so. */
            if (axes[i].kind === "ring" && v < 0) round = true;
            delta[i] = axes[i].kind === "ring" ? ((v % axes[i].modulus!) + axes[i].modulus!) % axes[i].modulus! : v;
        }
        for (const [a, b, sign] of bridges) delta[b] = sign * Math.abs(delta[a]);
        return delta;
    };
    let local = false, round = false;
    const placed = (hour: number, x: number, y: number, text: string, body: string): Fact => {
        local = false; round = false;
        const delta = clauses(text, body);
        return { kind: "place", hour, x, y, delta, ...(local ? { local: true } : {}), ...(round ? { round: true } : {}) };
    };

    const fact = (speaker: number, body: string): Fact => {
        let m: RegExpExecArray | null;
        if ((m = /^I am a (knight|knave)$/.exec(body))) return { kind: "type", claim: { kind: "is", who: speaker, knight: m[1] === "knight" } };
        if ((m = new RegExp(`^${P} is a (knight|knave)$`).exec(body))) return { kind: "type", claim: { kind: "is", who: who.get(m[1])!, knight: m[2] === "knight" } };
        if ((m = new RegExp(`^at least one of ${P} and ${P} is a (knight|knave)$`).exec(body))) {
            return { kind: "type", claim: { kind: "any", who: [who.get(m[1])!, who.get(m[2])!], knight: m[3] === "knight" } };
        }
        if ((m = new RegExp(`^${P} and ${P} are both (knight|knave)s$`).exec(body))) {
            return { kind: "type", claim: { kind: "all", who: [who.get(m[1])!, who.get(m[2])!], knight: m[3] === "knight" } };
        }
        if ((m = new RegExp(`^${PI} and ${PI} are (the same kind|different kinds)$`).exec(body))) {
            return { kind: "type", claim: { kind: m[3] === "the same kind" ? "same" : "differ", a: whoIs(m[1]), b: whoIs(m[2]) } };
        }
        if ((m = new RegExp(`^at (\\d+), ${T} is (.+) from ${T}$`).exec(body))) {
            return placed(+m[1], thing.get(m[2])!, thing.get(m[4])!, m[3], body);
        }
        if ((m = new RegExp(`^${T} never moves$`).exec(body))) return { kind: "pace", x: thing.get(m[1])!, vel: axes.map(() => 0) };
        if ((m = new RegExp(`^${T} moves (.+) (hourly|every (\\d+) hours)$`).exec(body))) {
            /* Over several hours, the same pace that many times over. */
            const every = m[4] ? +m[4] : 1, vel = axes.map(() => 0);
            for (const c of m[2].split(", ")) {
                const i = axes.findIndex(a => readClause(a, c) !== null && c !== a.scale.tie);
                if (i < 0) throw new Error(`unread pace "${c}"`);
                vel[i] = readClause(axes[i], c)! / every;
            }
            return { kind: "pace", x: thing.get(m[1])!, vel, ...(every > 1 ? { every } : {}) };
        }
        if ((m = new RegExp(`^${T} moves as ${T} does$`).exec(body))) return { kind: "pacelike", x: thing.get(m[1])!, y: thing.get(m[2])!, sign: 1 };
        if ((m = new RegExp(`^${T} moves opposite to ${T}$`).exec(body))) return { kind: "pacelike", x: thing.get(m[1])!, y: thing.get(m[2])!, sign: -1 };
        /* Any word denied, as an answer of "no" is said. */
        if ((m = /^not so: (.+)$/.exec(body))) return { kind: "not", f: fact(speaker, m[1]) };
        if ((m = new RegExp(`^${T} is ((?:\\d+ long|a point) in .+)$`).exec(body))) {
            /* "3 long along up–down and time, 2 along north–south, and a point
               along quantity": a run of lengths, each along a list of lines. One
               length alone reads the same, and means the same said by anyone. */
            const lens: Array<[number, number]> = [];
            const groups = m[2].split(/(?:^|, )(\d+ long|\d+|a point) in /).slice(1);
            for (let k = 0; k < groups.length; k += 2) {
                const len = groups[k] === "a point" ? 1 : parseInt(groups[k], 10);
                for (const label of groups[k + 1].split(/, | and /)) lens.push([axisBy(label), len]);
            }
            return { kind: "sizes", x: thing.get(m[1])!, lens };
        }
        if ((m = new RegExp(`^${PI} (?:is|am) in ${T}(?:, facing (north|east|south|west))?(, a mirror twin)?(, head down)?$`).exec(body))) {
            const facing = m[3] ? ["north", "east", "south", "west"].indexOf(m[3]) : undefined;
            return { kind: "stands", who: whoIs(m[1]), host: thing.get(m[2])!, ...(facing === undefined ? {} : { facing }),
                ...(m[4] ? { twin: true } : {}), ...(m[5] ? { upside: true } : {}) };
        }
        if ((m = new RegExp(`^at (\\d+), I see ${T}: (.+)$`).exec(body))) {
            /* Ahead, left, then every other dimension in order. */
            const parts = m[3].split(", ");
            const ahead = parts[0] === "level ahead" ? 0 : /^(\d+) (ahead|behind)$/.exec(parts[0])!;
            const left = parts[1] === "level sideways" ? 0 : /^(\d+) (left|right)$/.exec(parts[1])!;
            const seen: Seen = {
                ahead: ahead === 0 ? 0 : +ahead[1] * (ahead[2] === "behind" ? -1 : 1),
                left: left === 0 ? 0 : +left[1] * (left[2] === "right" ? -1 : 1),
                rest: axes.map(() => 0),
            };
            let k = 2;
            axes.forEach((ax, i) => {
                if (i === 0 || i === 1) return;
                const c = parts[k++];
                if (c.startsWith("level in ")) return;
                const v = readClause(ax, c);
                if (v === null) throw new Error(`unread view clause "${c}" on ${axisLabel(ax)}`);
                seen.rest[i] = ax.kind === "ring" ? ((v % ax.modulus!) + ax.modulus!) % ax.modulus! : v;
            });
            if (k !== parts.length) throw new Error(`a view with ${parts.length} parts for ${axes.length} axes: "${body}"`);
            return { kind: "view", hour: +m[1], who: speakingNow, x: thing.get(m[2])!, seen };
        }
        if ((m = new RegExp(`^at (\\d+), ${T} (is longer than|is shorter than|is as long as) ${T} in (.+)$`).exec(body))) {
            const cmp = ({ "is longer than": "longer", "is shorter than": "shorter", "is as long as": "same" } as const)[m[3] as "is longer than"];
            return { kind: "cmp", hour: +m[1], x: thing.get(m[2])!, y: thing.get(m[4])!, axis: axisBy(m[5]), cmp };
        }
        if ((m = new RegExp(`^at (\\d+), ${T} is wholly (\\S+)(?: of| than)? ${T}$`).exec(body))) {
            const [axis, side] = dirAxis(m[3]);
            return { kind: "rel", hour: +m[1], x: thing.get(m[2])!, y: thing.get(m[4])!, axis, rel: side === 0 ? "after" : "before" };
        }
        if ((m = new RegExp(`^at (\\d+), ${T} (overlaps|is within|spans|matches) ${T} in (.+)$`).exec(body))) {
            const rel = ({ overlaps: "overlaps", "is within": "within", spans: "spans", matches: "identical" } as const)[m[3] as "is within"];
            return { kind: "rel", hour: +m[1], x: thing.get(m[2])!, y: thing.get(m[4])!, axis: axisBy(m[5]), rel };
        }
        if ((m = new RegExp(`^at (\\d+), a ring from ${T} (just reaches|has passed) ${T}$`).exec(body))) {
            return { kind: "signal", hour: +m[1], x: thing.get(m[4])!, y: thing.get(m[2])!, mode: m[3] === "just reaches" ? "at" : "after" };
        }
        if ((m = new RegExp(`^${T} first levels with ${T} in (.+) at (\\d+)$`).exec(body))) {
            return { kind: "level", x: thing.get(m[1])!, y: thing.get(m[2])!, axis: axisBy(m[3]), hour: +m[4] };
        }
        if ((m = new RegExp(`^${T} and ${T} first meet at (\\d+)$`).exec(body))) {
            return { kind: "meet", x: thing.get(m[1])!, y: thing.get(m[2])!, hour: +m[3] };
        }
        if ((m = new RegExp(`^at (\\d+), ${T} and ${T} are (\\d+) steps? apart$`).exec(body))) {
            return { kind: "total", hour: +m[1], x: thing.get(m[2])!, y: thing.get(m[3])!, steps: +m[4] };
        }
        if ((m = new RegExp(`^at (\\d+), (?:fewest to most (\\S+)|least to most (\\S+)), ties by (.+): (.+)$`).exec(body))) {
            const first = m[3] ? dirAxis(m[3])[0] : axes.findIndex(a => a.kind === "ring" && a.scale.cyclic!.direction[0].replace(/ in the cycle$/, "") === m![2]);
            return { kind: "ranked", hour: +m[1], by: [first, axisBy(m[4])], order: m[5].split(", ").map(n => thing.get(n)!) };
        }
        /* A knight's denial: the statement's own verb, denied. */
        const denials: Array<[RegExp, (m: RegExpExecArray) => Fact]> = [
            [new RegExp(`^at (\\d+), ${T} is not wholly (\\S+)(?: of| than)? ${T}$`), m => {
                const [axis, side] = dirAxis(m[3]);
                return { kind: "rel", hour: +m[1], x: thing.get(m[2])!, y: thing.get(m[4])!, axis, rel: side === 0 ? "after" : "before" };
            }],
            [new RegExp(`^at (\\d+), ${T} (does not overlap|is not within|does not span|does not match) ${T} in (.+)$`), m => ({
                kind: "rel", hour: +m[1], x: thing.get(m[2])!, y: thing.get(m[4])!, axis: axisBy(m[5]),
                rel: ({ "does not overlap": "overlaps", "is not within": "within", "does not span": "spans", "does not match": "identical" } as const)[m[3] as "is not within"],
            })],
            [new RegExp(`^at (\\d+), ${T} (is not longer than|is not shorter than|is not as long as) ${T} in (.+)$`), m => ({
                kind: "cmp", hour: +m[1], x: thing.get(m[2])!, y: thing.get(m[4])!, axis: axisBy(m[5]),
                cmp: ({ "is not longer than": "longer", "is not shorter than": "shorter", "is not as long as": "same" } as const)[m[3] as "is not longer than"],
            })],
            [new RegExp(`^${T} is not (\\d+ long|a point) in (.+)$`), m => ({ kind: "size", x: thing.get(m[1])!, axis: axisBy(m[3]), len: m[2] === "a point" ? 1 : parseInt(m[2], 10) })],
        ];
        for (const [re, make] of denials) if ((m = re.exec(body))) return { kind: "not", f: make(m) };
        if ((m = /^at (\d+), (.+)$/.exec(body))) return { kind: "event", hour: +m[1], t: transform(m[2]) };
        throw new Error(`unread statement "${body}"`);
    };

    const transform = (text: string): TransformSpec => {
        let m: RegExpExecArray | null;
        if ((m = /^all turns a quarter, (\S+) round to (\S+)$/.exec(text))) {
            const [a] = dirAxis(m[1]), [b, side] = dirAxis(m[2]);
            return { id: "rotate", axes: [a, b], k: side === 0 ? 1 : 3 };
        }
        if ((m = /^all is mirrored along (.+)$/.exec(text))) return { id: "mirror", axes: [axisBy(m[1])] };
        if ((m = /^(.+?) and (.+?) swap, /.exec(text))) return { id: "swap", axes: [axisBy(m[1]), axisBy(m[2])] };
        if ((m = /^all slides 1 (\S+) per step (\S+), 1/.exec(text))) {
            const [a, side] = dirAxis(m[1]), [b] = dirAxis(m[2]);
            return { id: "shear", axes: [a, b], k: side === 0 ? 1 : -1 };
        }
        if ((m = /^all shifts (\d+) (\S+)$/.exec(text))) {
            const [a, side] = dirAxis(m[2]);
            return { id: "translate", axes: [a], k: side === 0 ? +m[1] : -m[1] };
        }
        if ((m = /^(.+) distances double$/.exec(text))) return { id: "stretch", axes: [axisBy(m[1])] };
        if ((m = new RegExp(`^${T} jumps (\\d+) (\\S+)$`).exec(text))) {
            const [a, side] = dirAxis(m[3]);
            return { id: "jump", axes: [a], who: thing.get(m[1])!, k: side === 0 ? +m[2] : -m[2] };
        }
        if ((m = new RegExp(`^${T} turns back$`).exec(text))) return { id: "turn", axes: [], who: thing.get(m[1])! };
        throw new Error(`unread transformation "${text}"`);
    };

    /* "Ash says: A (where B; and C)": A is about the space outside the brackets,
       B and C, said by the same speaker, about the one inside. */
    const statements: Statement[] = q.premises.map(strip).flatMap(line => {
        /* The asked speaker's answer: the fact as asked, or denied. */
        const a = new RegExp(`^Asked "(.+)\\?", ${P} says (yes|no)$`).exec(line);
        if (a) {
            const speaker = speakingNow = who.get(a[2])!, f = fact(speaker, a[1]);
            return [{ speaker, fact: a[3] === "yes" ? f : { kind: "not", f } as Fact }];
        }
        const m = new RegExp(`^${P}: (.+)$`).exec(line);
        if (!m) throw new Error(`unread premise "${line}"`);
        const speaker = speakingNow = who.get(m[1])!;
        const [outer, bracket] = m[2].split(" (where ");
        const inside = bracket === undefined ? [] : bracket.replace(/\)$/, "").split("; and ");
        /* "A is … relative to B, which is … relative to C": two places, one hour. */
        const [first, second] = outer.split(", which is ");
        const head = fact(speaker, first);
        const linked = second === undefined || head.kind !== "place" ? [] : (() => {
            const t = new RegExp(`^(.+) from ${T}$`).exec(second)!;
            return [{ speaker, fact: placed(head.hour, head.y, thing.get(t[2])!, t[1], second) }];
        })();
        return [{ speaker, fact: head }, ...linked, ...inside.map(b => ({ speaker, fact: fact(speaker, b), space: 1 }))];
    });
    const frames = readFrames(q.setup, axes);
    const card: Card = { axes, things: things.length, speakers: speakers.length, statements, ...(frames ? { frames } : {}) };

    /* The question. */
    const prompt = q.prompt, options = q.choices;
    let m: RegExpExecArray | null;
    if ((m = new RegExp(`^${P} is silent\\. Which questions would tell what ${P} is\\? Select all that would\\.$`).exec(prompt))) {
        const asked = who.get(m[1])!;
        const questions = options.map(o => {
            if (o === "Are you a knight?") return null;
            const f = /^(.+)\?$/.exec(o);
            if (!f) throw new Error(`unread question "${o}"`);
            return fact(asked, f[1]);
        });
        return { card, ask: { kind: "asking", x: 0, y: 0, z: 0, h1: 0, h2: 0, on: [] }, kind: "asking", questions, asked };
    }
    if (prompt === TYPES_PROMPT_NAMES) {
        /* Ticked by name, knights only: coded as the knight option of the pair form. */
        const coded = options.map(o => { if (!who.has(o)) throw new Error(`unread option "${o}"`); return 2 * who.get(o)!; });
        return { card, ask: { kind: "types", x: 0, y: 0, z: 0, h1: 0, h2: 0, on: [], options: coded }, kind: "types" };
    }
    if (prompt === TYPES_PROMPT_PAIRS) {
        /* Each option is a speaker and a type, as index 2·speaker + (knave ? 1 : 0). */
        const coded = options.map(o => {
            const t = new RegExp(`^${P} is a (knight|knave)$`).exec(o);
            if (!t) throw new Error(`unread option "${o}"`);
            return 2 * who.get(t[1])! + (t[2] === "knave" ? 1 : 0);
        });
        return { card, ask: { kind: "types", x: 0, y: 0, z: 0, h1: 0, h2: 0, on: [], options: coded }, kind: "types" };
    }
    if ((m = new RegExp(`^In kind, ${P} stands to ${P} as ${P} to which speaker\\?$`).exec(prompt))) {
        const ask: Ask = { kind: "speakers", x: who.get(m[1])!, y: who.get(m[2])!, z: who.get(m[3])!, h1: 0, h2: 0, on: [], options: options.map(o => who.get(o)!) };
        return { card, ask, kind: "speakers" };
    }
    /* Which side of the brackets each relation is on: named for the first,
       and for the second only where it differs. */
    /* A verdict says "as Z stands to W"; a question, "as Z to which". */
    const head = `^At (\\d+)( outside| inside)?, ${T} stands to ${T} on (.+?) as ${T} (?:stands )?to`;
    const on = (s: string) => s.split(", ").map(l => (l === "ring reach" ? REACH : axisBy(l)));
    const sides = (first?: string, second?: string) => {
        if (!first) return {};
        const s1 = first.includes("inside") ? 1 : 0;
        return { s1, s2: second ? (second.includes("inside") ? 1 : 0) : s1 };
    };
    if ((m = new RegExp(`^At (\\d+)( outside| inside)?, ${T} stands to ${T} as ${T} to P at (\\d+)( outside| inside)?\\. Where is P from ${T}\\?$`).exec(prompt))) {
        const ask: Ask = { kind: "build", x: thing.get(m[3])!, y: thing.get(m[4])!, z: thing.get(m[5])!, w: thing.get(m[8])!, h1: +m[1], h2: +m[6], on: axes.map((_, i) => i), ...sides(m[2], m[7]) };
        return { card, ask, kind: "build" };
    }
    if ((m = new RegExp(`${head} which at (\\d+)( outside| inside)?\\? Something is open: select all that could\\.$`).exec(prompt))) {
        const ask: Ask = { kind: "could", x: thing.get(m[3])!, y: thing.get(m[4])!, z: thing.get(m[6])!, h1: +m[1], h2: +m[7], on: on(m[5]), ...sides(m[2], m[8]), options: options.map(o => thing.get(o)!) };
        return { card, ask, kind: "could" };
    }
    if ((m = new RegExp(`${head} which at (\\d+)( outside| inside)?\\?( Select all that fit, or none\\.)?$`).exec(prompt))) {
        const kind = m[9] ? "every" : "which";
        const ask: Ask = { kind, x: thing.get(m[3])!, y: thing.get(m[4])!, z: thing.get(m[6])!, h1: +m[1], h2: +m[7], on: on(m[5]), ...sides(m[2], m[8]), options: options.map(o => thing.get(o)!) };
        return { card, ask, kind };
    }
    if ((m = new RegExp(`${head} ${T} at (\\d+)( outside| inside)?$`).exec(prompt))) {
        const ask: Ask = { kind: "judge", x: thing.get(m[3])!, y: thing.get(m[4])!, z: thing.get(m[6])!, w: thing.get(m[7])!, h1: +m[1], h2: +m[8], on: on(m[5]), ...sides(m[2], m[9]) };
        return { card, ask, kind: "judge" };
    }
    throw new Error(`unread question "${prompt}"`);
}

/** The answer the claim on screen was shipped with, in the engine's terms. */
function shipped(q: Question, p: Parsed): string {
    if (p.kind === "build") {
        /* The slots back into a displacement: forward, back, or level, a dimension each. */
        return answerKey(q.construct[0].slots.map(sl => {
            const v = sl.answerDirection === 2 ? 0 : sl.answerDirection === 0 ? sl.answerMagnitude : -sl.answerMagnitude;
            if (!sl.asksDistance) return sl.answerDirection;
            return sl.modulus ? ((v % sl.modulus) + sl.modulus) % sl.modulus : v;
        }));
    }
    if (p.kind === "asking") return answerKey([...q.selectAnswer].sort((a, b) => a - b));
    if (p.kind === "types" || p.kind === "could" || p.kind === "every") return answerKey([...q.selectAnswer].map(i => p.ask.options![i]).sort((a, b) => a - b));
    if (p.kind === "judge") return answerKey(q.isValid);
    return answerKey(p.ask.options![q.correctChoice]);
}

/** The reader's own answer to a parsed claim. */
function answered(p: Parsed, rec: Reconstruction): string {
    if (p.kind === "types") {
        const offered = new Set(p.ask.options);
        return answerKey(rec.types.map((t, i) => 2 * i + (t ? 0 : 1)).filter(k => offered.has(k)).sort((a, b) => a - b));
    }
    return answerKey(answerFollows(QUESTIONS[p.kind], p.ask, rec));
}

/** The kinds the first stage's words settle, every speaker or null. */
function kindsFrom(card: Card): boolean[] | null {
    const settled = settleTypes(card);
    const out = Array.from({ length: card.speakers }, (_, i) => settled.get(i));
    return out.every(t => t !== undefined) ? (out as boolean[]) : null;
}

/**
 * Which questions tell, read from the card on screen: those where, whatever
 * the asked speaker answers, the words leave exactly one kind standing for
 * them. Everyone else is settled already, by the words.
 */
function telling(p: Parsed): string {
    const settled = settleTypes(p.card), asked = p.asked!;
    const kinds = Array.from({ length: p.card.speakers }, (_, i) => settled.get(i) ?? false);
    const standing = (f: Fact, knight: boolean) => !wordBreach(p.card.axes, p.card.things, [...p.card.statements, { speaker: asked, fact: f }],
        kinds.map((t, i) => (i === asked ? knight : t)));
    return answerKey(p.questions!.map((f, i) => {
        if (!f) return -1;
        const tells = [f, { kind: "not", f } as Fact].every(g => standing(g, true) !== standing(g, false));
        return tells ? i : -1;
    }).filter(i => i >= 0));
}

function names(q: Question, n: number) {
    const { things } = worldSize(n);
    return { things: q.bucket.slice(0, things), speakers: q.bucket.slice(things) };
}

/**
 * Every claim of an item as the screen shows it, in order, advanced by the
 * game's own series code — answered right, so the next claim comes up.
 */
function walk(q: Question, premises: number, each: (p: Parsed, at: number, first: Parsed, known?: boolean[]) => void): string[] {
    const { things, speakers } = names(q, premises);
    const modes: string[] = [];
    /* The first card past the first stage, and the kinds the first stage settled. */
    let first: Parsed | null = null, known: boolean[] | undefined;
    for (;;) {
        const p = parse(shown(q, worldSize(premises).dims), things, speakers);
        if (p.kind === "types") known = kindsFrom(p.card) ?? undefined;
        else if (p.kind !== "asking") first = first ?? p;
        modes.push(q.answerMode);
        each(p, q.seriesAt, first ?? p, known);
        if (!hasNextClaim(q)) break;
        takeSeriesAnswer(q, q.answerMode === "boolean" ? q.isValid : true);
    }
    return modes;
}

/* ------------------------------------------------------------------ *
 * The writer, read back                                               *
 * ------------------------------------------------------------------ */

test("composed world: in stages — ticks, analogies to finish, verdicts across what is announced, then one to build across it", () => {
    for (let premises = RANGE.minNumOfPremises; premises <= RANGE.maxNumOfPremises; premises++) seeded(1000 + premises, () => {
        const q = createComposedWorld(ctxHolding([]), premises);
        const modes = walk(q, premises, () => undefined).join(" ");
        /* A card left open asks what could be — a second select — before the analogies to finish. */
        /* And one built last, across the announcement. */
        /* First which question tells, then who is what. */
        const finish = /^select select ((?:select )?(?:(?:choice|construct) )+)(?:boolean ){2,3}construct$/.exec(modes);
        assert(!!finish && [2, 3].includes(finish[1].trim().split(" ").length), `the stages run ${modes}`);
        assert(q.premises.length > q.series[2].premises!.length, "the last stage announces nothing new");
    });
});

test("composed world: the card alone answers every claim of every stage as shipped", () => {
    for (let premises = RANGE.minNumOfPremises; premises <= RANGE.maxNumOfPremises; premises++) for (let r = 0; r < 3; r++) {
        seeded(1100 + 10 * premises + r, () => {
            const q = createComposedWorld(ctxHolding([]), premises);
            walk(q, premises, (p, _at, _first, known) => {
                if (p.kind === "asking") { equal(telling(p), shipped(q, p), "the questions that tell are not the ones shipped"); return; }
                if (p.kind === "types") {
                    const kinds = kindsFrom(p.card);
                    assert(!!kinds, `the first stage's words, with the answer, leave a speaker unsettled:\n${q.premises.map(strip).join("\n")}`);
                    equal(answered(p, { types: kinds } as Reconstruction), shipped(q, p), "types: the words' answer is not the one shipped");
                    return;
                }
                const rec = read(p.card, FULL, known);
                assert(rec, `the full reading of the card fails:\n${q.premises.map(strip).join("\n")}`);
                equal(answered(p, rec!), shipped(q, p), `${p.kind}: the card's answer is not the one shipped`);
            });
        });
    }
});

test("composed world: read from the text, every shortcut misses every analogy, and ignoring the announcement misses every verdict", () => {
    for (let s = 0; s < 8; s++) seeded(2000 + s, () => {
        const premises = 4 + (s % 5);
        const q = createComposedWorld(ctxHolding([]), premises);
        walk(q, premises, (p, at, first, known) => {
            if (p.kind === "types" || p.kind === "asking") return;
            const truth = shipped(q, p);
            for (const [name, reading] of Object.entries(SHORTCUTS)) {
                /* Past the first stage nobody on the card lies; kinds and headings, only on a card that has them. */
                if (name === "liars" || (name === "kinds" && !p.card.frames)
                    || (name === "perspective" && !p.card.statements.some(s => s.fact.kind === "view"))) continue;
                const rec = read(p.card, reading, known);
                assert((rec ? answered(p, rec) : answerKey(null)) !== truth, `claim ${at}, ${p.kind}: ignoring ${name} still gives ${truth}`);
            }
            /* The verdicts and the closing build are both across the announcement. */
            if (p.kind === "judge" || (p.kind === "build" && at === q.series.length - 1)) {
                const before = read(first.card, FULL, known)!;
                assert(answered(p, before) !== truth, `claim ${at}: the verdict is the same without what was announced`);
            }
        });
    });
});

test("composed world: nothing in an item is left unworded", () => {
    for (let s = 0; s < 16; s++) seeded(3000 + s, () => {
        const q = createComposedWorld(ctxHolding([]), 4 + (s % 5));
        const claims = q.series.flatMap(c => [c.text, c.prompt ?? "", ...(c.choices ?? []), ...(c.explanation ?? []), ...(c.premises ?? [])]);
        const text = [...q.setup, ...q.premises, q.conclusion as string, q.choicePrompt ?? "", ...q.choices, ...q.explanation, ...claims].map(strip).join("\n");
        for (const bad of ["undefined", "NaN", "null", "[object", "-0 "]) assert(!text.includes(bad), `"${bad}" in:\n${text}`);
        equal(new Set(q.bucket).size, q.bucket.length, "every name is distinct");
    });
});

/* ------------------------------------------------------------------ *
 * The engine                                                          *
 * ------------------------------------------------------------------ */

const randBody = (axes: Axis[], r: () => number): Body => ({
    pos: axes.map(a => (a.kind === "ring" ? Math.floor(r() * a.modulus!) : a.kind === "parity" ? Math.floor(r() * 2) : Math.floor(r() * 9) - 4)),
    size: axes.map(a => (a.kind === "line" ? 1 + Math.floor(r() * MAX_LEN) : 1)),
    vel: axes.map(a => (a.kind === "parity" ? 0 : Math.floor(r() * 3) - 1)),
});

test("composed world: an hour of motion runs backwards exactly, through every kind of seam", () => {
    seeded(4000, () => {
        let crossings = 0;
        for (let i = 0; i < 400; i++) {
            const axes = makeAxes(Math.random), b = randBody(axes, Math.random), c = copyBody(b);
            for (let h = 0; h < 6; h++) moveHour(c, axes, 1, FULL);
            if (c.pos[1] !== b.pos[1] || c.pos[2] !== b.pos[2]) crossings++;
            for (let h = 0; h < 6; h++) moveHour(c, axes, -1, FULL);
            assert(sameBody(b, c), `six hours there and back moved ${JSON.stringify(b)} to ${JSON.stringify(c)} (seam ${JSON.stringify(axes[0].seam)})`);
        }
        assert(crossings > 50, "the walks rarely touched another axis, so the seams went untested");
    });
});

test("composed world: a twist mirrors its target and its pace; a portal carries along its target", () => {
    const axes = makeAxes(() => 0.1);
    equal(axes[0].seam, { type: "twist", target: 1 });
    const b: Body = { pos: [4, 1, 0, 0, 0, 0, 0], size: [1, LONG, 1, 1, 1, 1, 1], vel: [1, 1, 0, 0, 0, 0, 0] };
    moveHour(b, axes, 1, FULL);
    /* East past the last column: back to 0, north–south [1, 3] mirrored to [-3, -1], pace reversed — and then that reversed pace applied. */
    equal(b.pos.slice(0, 2), [0, -4], "the twist mirrors the stretch, then the flipped pace carries it south");
    equal(b.vel[1], -1, "the twist flips the pace along its target");

    const portal = makeAxes(() => 0.6);
    assert(portal[0].seam!.type === "portal", "a high draw gives the portal seam");
    const s = (portal[0].seam as { shift: number }).shift;
    const p: Body = { pos: [4, 0, 0, 0, 0, 0, 0], size: [1, 1, 1, 1, 1, 1, 1], vel: [1, 0, 0, 0, 0, 0, 0] };
    moveHour(p, portal, 1, FULL);
    equal(p.pos.slice(0, 3), [0, 0, s], "crossing clockwise carries it up by the shift");
    moveHour(p, portal, -1, FULL);
    equal(p.pos.slice(0, 3), [4, 0, 0], "and crossing back carries it down again");
});

test("composed world: every transformation undoes exactly, and a knave's version of it is its opposite", () => {
    seeded(5000, () => {
        const axes = makeAxes(Math.random), lines = axes.map((a, i) => (a.kind === "line" ? i : -1)).filter(i => i >= 0);
        for (const id of Object.keys(TRANSFORMS)) for (let i = 0; i < 60; i++) {
            const pickLines = [...lines].sort(() => Math.random() - 0.5).slice(0, TRANSFORMS[id].needs);
            const t: TransformSpec = { id, axes: pickLines, k: id === "rotate" ? (Math.random() < 0.5 ? 1 : 3) : id === "translate" ? 2 : Math.random() < 0.5 ? 1 : -1 };
            assert(canTransform(t, axes), `${id} on line axes is allowed`);
            const b = randBody(axes, Math.random), c = copyBody(b);
            TRANSFORMS[id].apply(c, t, 1);
            TRANSFORMS[id].apply(c, t, -1);
            assert(sameBody(b, c), `${id} ${JSON.stringify(t)} does not undo exactly`);
            const opp = TRANSFORMS[id].opposite?.(t);
            if (opp) {
                const d = copyBody(b), e = copyBody(b);
                TRANSFORMS[id].apply(d, t, 1);
                TRANSFORMS[id].apply(e, opp, -1);
                assert(sameBody(d, e), `${id}: the opposite is not the inverse`);
                equal(negate({ kind: "event", hour: 3, t }), { kind: "event", hour: 3, t: opp }, "a false event is its opposite");
            }
        }
        assert(!canTransform({ id: "mirror", axes: [0] }, axes), "a ring is never transformed");
        assert(!canTransform({ id: "mirror", axes: [6] }, axes), "nor is a kind");
    });
    /* A quarter turn swaps the lengths and turns the pace with the place. */
    const b: Body = { pos: [0, 1, 0, 0, 0, 0, 0], size: [1, LONG, 1, 1, 1, 1, 1], vel: [0, 1, 0, 0, 0, 0, 0] };
    TRANSFORMS.rotate.apply(b, { id: "rotate", axes: [1, 2], k: 1 }, 1);
    equal([b.pos[1], b.pos[2], b.size[1], b.size[2], b.vel[1], b.vel[2]], [0, 1, 1, LONG, 0, 1], "north [1, 3] turns to up [1, 3]");
});

test("composed world: stretches relate both ways round", () => {
    const flip: Record<IntervalRel, IntervalRel> = { before: "after", after: "before", within: "spans", spans: "within", overlaps: "overlaps", identical: "identical" };
    seeded(6000, () => {
        const axes = makeAxes(Math.random);
        for (let i = 0; i < 300; i++) {
            const a = randBody(axes, Math.random), b = randBody(axes, Math.random);
            equal(intervalRel(b, a, 1), flip[intervalRel(a, b, 1)], "the relation reversed");
        }
    });
    const pt = (p: number, s: number): Body => ({ pos: [p], size: [s], vel: [0] });
    equal(intervalRel(pt(1, 1), pt(0, LONG), 0), "within");
    equal(intervalRel(pt(0, LONG), pt(0, LONG), 0), "identical");
    equal(intervalRel(pt(2, LONG), pt(0, LONG), 0), "overlaps");
    equal(intervalRel(pt(3, 1), pt(0, LONG), 0), "after");
});

/* ------------------------------------------------------------------ *
 * The items                                                           *
 * ------------------------------------------------------------------ */

function items(count: number, seed: number, opts: BuildOptions = { dims: 7, things: 4, speakers: 4 }): Item[] {
    const kinds = fitting(opts);
    return seeded(seed, () => {
        const out: Item[] = [];
        for (let i = 0; i < count; i++) {
            const it = build({ ...opts, kind: kinds[i % kinds.length] }, 1500);
            assert(it, `no ${kinds[i % kinds.length]} item built on ${JSON.stringify(opts)}`);
            out.push(it!);
        }
        return out;
    });
}

test("composed world: every shipped item reads back to its world, and no shortcut gets its answer", () => {
    for (const it of [...items(24, 7000), ...items(12, 7100, worldSize(4)), ...items(12, 7200, worldSize(6))]) {
        const rec = read(it.card, FULL)!;
        assert(rec && rec.types.every((t, i) => t === it.types[i]), "the reading unmasks the speakers as they are");
        assert((rec.alternatives ?? [rec.world]).some(w => w.start.every((b, i) => sameBody(b, it.world.start[i]))), "the reading places everything where it is");
        equal(answerKey(answerFollows(it.kind, it.ask, rec)), answerKey(it.answer), "the full reading answers as shipped");
        /* The origin is where places are measured from, never a term of an analogy. */
        if (it.kind.id !== "speakers") assert(![it.ask.x, it.ask.y, it.ask.z, it.ask.w ?? 0, ...(it.ask.options ?? [])].includes(POST), "the origin stands in an analogy");
        /* Asked on the knights' words with the kinds known, as the stages ask it. */
        for (const [name, r] of Object.entries(SHORTCUTS)) {
            if (name === "liars" || (name === "kinds" && !it.card.frames)
                || (name === "perspective" && !it.plain.statements.some(s => s.fact.kind === "view"))) continue;
            const s = read(it.plain, r, it.types);
            assert(answerKey(s ? answerFollows(it.kind, it.ask, s) : null) !== answerKey(it.answer), `${it.kind.id}: ignoring ${name} gives the answer`);
        }
        /* On a nested card, reading a relation on the wrong side of the brackets misses too. */
        if (rec.inner && it.ask.s1 !== undefined) for (const [a, b] of [[it.ask.s1, it.ask.s1], [it.ask.s2!, it.ask.s2!], [1 - it.ask.s1, 1 - it.ask.s2!]]) {
            if (a === it.ask.s1 && b === it.ask.s2) continue;
            assert(answerKey(answerFollows(it.kind, { ...it.ask, s1: a, s2: b }, rec)) !== answerKey(it.answer), `${it.kind.id}: the other side of the brackets gives the answer`);
        }
    }
});

test("composed world: every part of the structure turns up in what ships", () => {
    const seen = new Set<string>();
    for (const it of items(48, 8000)) {
        seen.add(`kind:${it.kind.id}`);
        seen.add(`seam:${it.world.axes[0].seam!.type}`);
        seen.add(`time:${it.world.axes[3].kind}${it.world.axes[3].seam ? "/" + it.world.axes[3].seam.type : ""}`);
        for (const e of it.world.events) seen.add(`event:${e.t.id}`);
        for (const b of it.world.start) for (const l of b.size) seen.add(`length:${l}`);
        if (it.world.start.some(b => new Set(b.size.filter((_, a) => it.world.axes[a].kind === "line")).size > 1)) seen.add("lengths differ along a thing");
        for (const s of it.card.statements) {
            if (!it.types[s.speaker]) seen.add(`knave:${s.fact.kind}`);
            seen.add(`fact:${s.fact.kind}`);
            if (s.space === 1) seen.add("inside the brackets");
            if (s.fact.kind === "pace" && s.fact.every) seen.add("a pace over several hours");
            if (s.fact.kind === "pace" && s.fact.vel.every(v => v === 0)) seen.add("a thing that never moves");
            if (s.fact.kind === "place" && s.fact.round) seen.add("the ring counted the other way round");
            if (s.fact.kind === "place" && s.fact.y === POST && it.card.statements.some(o => o !== s && o.fact.kind === "place" && o.fact.y === POST
                && o.fact.x === (s.fact as { x: number }).x && o.fact.hour === (s.fact as { hour: number }).hour)) seen.add("two words on one place");
            if (s.fact.kind === "event" && it.card.statements.some(o => o !== s && o.fact.kind === "event" && o.fact.hour === (s.fact as { hour: number }).hour
                && JSON.stringify(o.fact.t) !== JSON.stringify((s.fact as { t: unknown }).t))) seen.add("a turn said from both sides");
            if (s.fact.kind === "stands" && s.fact.facing === undefined) seen.add("a heading left to work out");
            if (s.fact.kind === "stands" && s.fact.twin) seen.add("a mirror twin");
            if (s.fact.kind === "stands" && s.fact.upside) seen.add("head down");
            if (s.fact.kind === "place" && s.fact.bridge) seen.add("an equal gap");
            if (s.fact.kind === "place" && s.fact.local) seen.add("local clocks");
            if (it.card.frames && s.fact.kind === "place" && s.fact.y !== POST && !s.space
                && otherKind(it.world.axes, thingAt(it.world, s.fact.y, s.fact.hour))) seen.add("a place in the other kind's reckoning");
        }
        if (it.card.style?.compact) seen.add("compact places");
        if (it.card.frames) seen.add(`kinds:${it.card.frames.rule}`);
        if (it.card.style?.wide && it.card.statements.some(a => a.fact.kind === "place" && it.card.statements.some(b => b !== a && b.speaker === a.speaker
            && b.fact.kind === "place" && b.fact.hour === (a.fact as { hour: number }).hour && b.fact.x === (a.fact as { y: number }).y))) seen.add("two links in a sentence");
        if (it.ask.h1 !== it.ask.h2) seen.add("two hours");
        if (it.ask.on.length > 1) seen.add("several axes");
        if (it.ask.on.includes(REACH)) seen.add("the light cone in an analogy");
        if (it.ask.s1 !== undefined && it.ask.s1 !== it.ask.s2) seen.add("an analogy across the brackets");
    }
    const want = [
        ...KINDS.filter(k => !QUESTIONS[k].open).map(k => `kind:${k}`), "seam:twist", "seam:portal", "time:line", "time:ring/plain", "time:ring/portal",
        ...Object.keys(TRANSFORMS).map(t => `event:${t}`), "length:1", "length:2", "length:3", "lengths differ along a thing",
                    "fact:sizes", "fact:cmp", "fact:rel", "fact:stands", "fact:view", "fact:pacelike", "knave:pace", "knave:pacelike", "knave:place",
            "a pace over several hours", "a thing that never moves", "the ring counted the other way round", "two words on one place", "a turn said from both sides",
            "a heading left to work out", "fact:not", "fact:total", "fact:ranked", "a mirror twin", "head down", "an equal gap",
            "compact places", "two links in a sentence", "local clocks", "fact:signal", "fact:level", "fact:meet", "the light cone in an analogy", "an analogy to build", "an analogy left open",
            "kinds:mirror", "kinds:swap", "a place in the other kind's reckoning",
        "two hours", "several axes", "inside the brackets", "an analogy across the brackets", "knave:event",
    ];
    /* And what actually ships: staged items, whose analogies are drawn from the same kinds. */
    seeded(8100, () => {
        for (let k = 0; k < 8; k++) {
            const st = buildStaged({ dims: 7, things: 4, speakers: 4 }, 300);
            if (st) for (const s of st.later) if (!st.types[s.speaker]) seen.add(`knave:${s.fact.kind}`);
            if (st) for (const stage of [...st.analogies, ...st.judgements, st.closing]) {
                if (stage.ask.on.includes(REACH)) seen.add("the light cone in an analogy");
                if (stage.kind.id === "build") seen.add("an analogy to build");
                if (stage.kind.id === "could") seen.add("an analogy left open");
            }
        }
    });
    const missing = want.filter(w => !seen.has(w));
    assert(!missing.length, `never shipped: ${missing.join(", ")}`);
});

test("composed world: lengths are told every way, and the card pins them on both sides of the brackets", () => {
    /* One length along one line and points elsewhere was a pattern to lean
       on; lengths now vary freely, and are told outright by knights, compared,
       shown in how stretches lie, or lied about by knaves. */
    for (const it of [...items(16, 9400, worldSize(4)), ...items(16, 9500)]) {
        /* Some word on lengths, in whichever form: the forms vary card to card,
           and every one of them turns up across cards (the test above). */
        assert(it.card.statements.some(s => ["rel", "cmp", "size", "sizes"].includes(s.fact.kind)), "a card that says nothing of lengths");
        for (const s of it.card.statements) if (s.fact.kind === "sizes") assert(it.types[s.speaker], "a knave lists lengths");
        /* Outside the brackets a card may leave one length of one thing open, on purpose, and nothing else. */
        const open = worlds(it.card, it.types);
        assert(open.length >= 1 && open.length <= OPEN_MAX, `the card leaves ${open.length} worlds open outside the brackets`);
        const differ = new Set<string>();
        for (const st of open) st.forEach((b, x) => b!.size.forEach((l, a) => { if (l !== open[0][x]!.size[a]) differ.add(`${x}/${a}`); }));
        assert(differ.size <= 1, `the worlds left open differ in ${differ.size} lengths`);
        for (const st of open) assert(st.every((b, x) => b!.pos.every((v, a) => v === open[0][x]!.pos[a])), "the worlds left open differ in more than a length");
        if (it.card.statements.some(s => s.space === 1)) equal(worlds(it.card, it.types, 1).length, 1, "and inside them");
    }
});

test("composed world: no card says the same thing twice", () => {
    /* A knave's false length was drawn for any thing, including one already
       lied about, and printed the same line twice. */
    for (const it of [...items(40, 9600, worldSize(4)), ...items(16, 9700, worldSize(6))]) {
        const said = it.card.statements.map(st => JSON.stringify(st));
        equal(new Set(said).size, said.length, `a statement repeated: ${said.find((x, i) => said.indexOf(x) !== i)}`);
    }
});

test("composed world: the reader finds lengths from relations and comparisons", () => {
    /* Two things side by side, still; only the up–down lengths given. Taking
       in all of the other along north–south leaves three readings, and saying
       which is longer narrows them. */
    const axes = makeAxes(() => 0.1, 3);
    const base: Statement[] = [
        { speaker: 0, fact: { kind: "type", claim: { kind: "is", who: 0, knight: true } } },
        { speaker: 0, fact: { kind: "place", hour: 1, x: 0, y: POST, delta: [0, 0, 0] } },
        { speaker: 0, fact: { kind: "place", hour: 1, x: 1, y: 0, delta: [0, 1, 0] } },
        { speaker: 0, fact: { kind: "sizes", x: 0, lens: [[2, 1]] } },
        { speaker: 0, fact: { kind: "sizes", x: 1, lens: [[2, 1]] } },
        { speaker: 0, fact: { kind: "rel", hour: 2, x: 0, y: 1, axis: 1, rel: "spans" } },
    ];
    const lens = (extra: Statement[]) => worlds({ axes, things: 2, speakers: 1, statements: [...base, ...extra] }, [true])
        .map(st => [st[0]!.size[1], st[1]!.size[1]].join("")).sort();
    equal(lens([]), ["21", "31", "32"], "north–south: the first takes in all of the second, one step on");
    equal(lens([{ speaker: 0, fact: { kind: "cmp", hour: 3, x: 1, y: 0, axis: 1, cmp: "shorter" } }]), ["21", "31", "32"], "shorter, as every reading has it");
    equal(lens([{ speaker: 0, fact: { kind: "size", x: 1, axis: 1, len: 2 } }]), ["32"], "and the second's length said");
    equal(lens([{ speaker: 1, fact: { kind: "size", x: 0, axis: 1, len: 3 } }]).length, 3, "a speaker nobody has settled says nothing yet");
});

test("composed world: only a turn's direction, a shear's or a shift's sign is negated", () => {
    equal(negate({ kind: "size", x: 0, axis: 1, len: 2 }), null, "a false length leaves two others");
    equal(negate({ kind: "place", hour: 1, x: 0, y: POST, delta: [0, 0, 0, 0, 0, 0, 0] }), null, "a false place leaves too much open to use");
    equal(negate({ kind: "event", hour: 2, t: { id: "mirror", axes: [1] } }), null, "a mirror has no other way round");
});

test("composed world: the first stage is the words that tell the speakers apart, one speaker silent until asked", () => {
    /* The first stage used to print the whole world above "who is a knight?":
       twenty-odd premises, most of them nothing to do with the question. */
    seeded(9000, () => {
        for (let k = 0; k < 10; k++) {
            const st = buildStaged(worldSize(4 + (k % 5)), 300)!;
            const n = st.card.things, axes = st.card.axes, who = st.asking.who;
            const words = st.words.filter(s => s !== st.asking.answer);
            assert(words.every(s => ["pace", "pacelike", "event"].includes(s.fact.kind) || (s.fact.kind === "place" && s.fact.y === POST)),
                "the first stage carries a premise that tells nobody apart");
            assert(!words.some(s => s.speaker === who), "the asked speaker spoke before being asked");
            /* The words settle everyone else and not the asked speaker; the answer settles them too. */
            const without = settleTypes({ ...st.card, statements: words }), withAnswer = settleTypes({ ...st.card, statements: st.words });
            assert(st.types.every((t, i) => (i === who ? !without.has(i) : without.get(i) === t)), "the words alone do not settle exactly the others");
            assert(st.types.every((t, i) => withAnswer.get(i) === t), "the answer does not settle the asked speaker");
            for (const s of st.plain.statements) assert(st.types[s.speaker], "a knave's word survives the first stage");
            /* What no knight gives does not move: so every pace a knight gives is there in the first stage. */
            for (const s of st.plain.statements.filter(s => s.fact.kind === "pace" && !s.space))
                assert(words.includes(s), "a knight's pace is missing from the first stage, which then says the thing stands still");
            assert(st.asking.options.some(o => o.tells) && st.asking.options.some(o => !o.tells), "the questions all tell, or none does");
            assert(st.asking.options.length <= 4, "more than four questions");
            assert(!wordBreach(axes, n, st.words, st.types), "the true kinds do not survive the words");
        }
    });
});

test("composed world: nobody claims a kind, and a speaker on themselves says I", () => {
    /* "Bee and I are the same kind" settled a card without a word about the
       world; the words that tell now are all about the world. */
    for (const it of items(24, 9800, worldSize(4))) assert(!it.card.statements.some(s => s.fact.kind === "type"), "a speaker claims a kind");
    seeded(9900, () => {
        for (let k = 0; k < 6; k++) {
            const q = createComposedWorld(ctxHolding([]), 4 + k % 5);
            const { speakers } = names(q, 4 + k % 5);
            for (const line of q.series.flatMap(c => c.premises ?? []).map(strip)) for (const sp of speakers) {
                assert(!new RegExp(`^${sp}: ${sp} is in`).test(line), `a speaker names themselves: ${line}`);
            }
        }
    });
});

test("composed world: most cards read back, so items cost few attempts", () => {
    /* About one attempt in five ships an item; with the deadlock, one in forty. */
    const ok = seeded(9100, () => {
        let n = 0;
        for (let i = 0; i < 300; i++) if (tryBuild({ things: 4, speakers: 4, kind: "which" })) n++;
        return n;
    });
    assert(ok >= 30, `only ${ok} of 300 attempts shipped an item`);
});

test("composed world: premises buy axes, things and speakers, and every kind is asked by the top", () => {
    equal(worldSize(RANGE.minNumOfPremises), { dims: 3, things: 3, speakers: 2 });
    equal(worldSize(RANGE.maxNumOfPremises), { dims: 7, things: 5, speakers: 4 });
    for (let n = RANGE.minNumOfPremises; n < RANGE.maxNumOfPremises; n++) {
        const a = worldSize(n), b = worldSize(n + 1);
        assert(b.dims >= a.dims && b.things >= a.things && b.speakers >= a.speakers, `${n + 1} premises buy less than ${n}`);
        assert(b.dims + b.things + b.speakers > a.dims + a.things + a.speakers, `${n + 1} premises buy nothing over ${n}`);
    }
    equal(fitting(worldSize(RANGE.maxNumOfPremises)), KINDS.filter(k => !QUESTIONS[k].open), "every kind of question at the top, the open ones on open cards");
    /* And the floor still has the whole structure: a seam, a line to turn in, motion, lengths. */
    for (const it of items(8, 9300, worldSize(RANGE.minNumOfPremises))) {
        assert(it.world.axes[0].seam && it.world.axes[0].seam.type !== "plain", "the floor's ring has a seam");
        assert(it.world.events.length >= 1, "the floor has a transformation");
    }
});

test("composed world: a speakers analogy names three speakers, so it asks more than who is x's kind", () => {
    seeded(9300, () => {
        for (let i = 0; i < 400; i++) {
            const n = 3 + (i % 3), types = Array.from({ length: n }, () => Math.random() < 0.5);
            const q = QUESTIONS.speakers.draw({} as never, 4, n, types, Math.random);
            if (q) assert(q.z !== q.x && q.z !== q.y, `x ${q.x}, y ${q.y}, z ${q.z}: the third term repeats one of the pair`);
        }
    });
});

test("composed world: a conclusion missed at any stage is explained, under its own number", () => {
    for (let s = 0; s < 6; s++) seeded(9400 + s, () => {
        const q = createComposedWorld(ctxHolding([]), 4 + (s % 5));
        const n = q.series.length, miss = s % n;
        const shownAt: string[][] = [];
        for (let k = 0; k < n; k++) {
            shownAt.push([...q.explanation]);
            const right = q.answerMode === "boolean" ? q.isValid : true;
            if (k < n - 1) takeSeriesAnswer(q, k === miss ? !right : right);
            else q.seriesAnswers[k] = k !== miss;
        }
        const review = missedReview(q)!;
        assert(!!review, "a staged card's claims each explain themselves");
        equal(review.steps[0], `<strong>Conclusion ${miss + 1} of ${n}:</strong> ${shownAt[miss][0]}`, "the review heads the conclusion that was missed");
        equal(review.steps.slice(1), shownAt[miss].slice(1), "the review carries that conclusion's own derivation");
        q.seriesAnswers = q.series.map(() => true);
        equal(missedReview(q)!.steps.length, 0, "nothing missed, nothing to stop for");
    });
    equal(missedReview({ series: [{ explanation: ["a"] }, {}], seriesAnswers: [false, true], seriesAt: 1 }), null,
        "claims that lean on the item's one derivation keep the review they had");
});

test("composed world: open cards and kinds ship their share, not what survives the retries", () => {
    seeded(9500, () => {
        let could = 0, kinds = 0;
        const n = 16;
        for (let i = 0; i < n; i++) {
            const it = buildStaged(worldSize(8), 300)!;
            if (it.analogies.some(a => a.kind.id === "could")) could++;
            if (it.card.frames) kinds++;
        }
        /* Drawn once an item: 0.6 and 0.5 of sixteen. Drawn on every attempt they came to a fifth and a quarter. */
        assert(could >= 6, `only ${could} of ${n} cards asked what could be`);
        assert(kinds >= 5, `only ${kinds} of ${n} cards had kinds`);
    });
});

test("composed world: nobody contradicts themselves, so no knave is found out at a glance", () => {
    /* A knave saying a thing never moves and, two lines on, that it moves
       every hour gave themselves away without a thought about the world. */
    const axes = makeAxes(() => 0.1, 3), still = [0, 0, 0];
    const say = (fact: Fact): Statement => ({ speaker: 0, fact });
    assert(selfContradicts(axes, [say({ kind: "pace", x: 0, vel: still }), say({ kind: "pace", x: 0, vel: [0, 1, 0], every: 2 })], 0), "never moves, and moves");
    assert(selfContradicts(axes, [say({ kind: "pace", x: 0, vel: [1, 0, 0] }), say({ kind: "pace", x: 1, vel: still }),
        say({ kind: "pacelike", x: 0, y: 1, sign: 1 })], 0), "moves exactly as a thing that never moves");
    assert(selfContradicts(axes, [say({ kind: "place", hour: 2, x: 0, y: POST, delta: [1, 0, 0] }), say({ kind: "place", hour: 2, x: 0, y: POST, delta: [2, 0, 0] })], 0), "two places at one hour");
    assert(!selfContradicts(axes, [say({ kind: "place", hour: 2, x: 0, y: POST, delta: [4, 0, 0] }), say({ kind: "place", hour: 2, x: 0, y: POST, delta: [4, 0, 0], round: true })], 0),
        "four steps clockwise and one anticlockwise are one place");
    assert(!selfContradicts(axes, [say({ kind: "pace", x: 0, vel: [0, 1, 0] }), { speaker: 1, fact: { kind: "pace", x: 0, vel: still } }], 0), "two speakers may disagree");
    seeded(9600, () => {
        for (let k = 0; k < 12; k++) {
            const st = buildStaged(worldSize(4 + (k % 5)), 300)!;
            for (let i = 0; i < st.types.length; i++) {
                assert(!selfContradicts(st.card.axes, st.words, i), `a speaker contradicts themselves: ${JSON.stringify(st.words.filter(s => s.speaker === i).map(s => s.fact))}`);
                assert(!selfContradicts(st.card.axes, st.card.statements, i), "a speaker contradicts themselves across the stages");
            }
        }
    });
});
