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
import { Axis, Body, FULL, SHORTCUTS, copyBody, moveHour, sameBody } from "../src/app/syllogimous/utils/world/space";
import { TRANSFORMS, TransformSpec, canTransform } from "../src/app/syllogimous/utils/world/transforms";
import { Fact, IntervalRel, LONG, POST, Statement, intervalRel, negate } from "../src/app/syllogimous/utils/world/facts";
import { Card, read, settleByClaims } from "../src/app/syllogimous/utils/world/reader";
import { Ask, QUESTIONS, answerKey } from "../src/app/syllogimous/utils/world/questions";
import { BuildOptions, Item, build, fitting, makeAxes, tryBuild } from "../src/app/syllogimous/utils/world/build";

const TYPE = EnumQuestionType.ComposedWorld;
const RANGE = QUESTION_TYPE_SETTING_PARAMS[TYPE];
const KINDS = Object.keys(QUESTIONS);

/* ------------------------------------------------------------------ *
 * The text reader                                                     *
 * ------------------------------------------------------------------ */

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const axisLabel = (a: Axis) => a.scale.name.toLowerCase().replace("-", "–");

/** The axes, from the setup lines and the first place: which seams the rings have, and how many axes. */
function readAxes(setup: string[], premises: string[]): Axis[] {
    const lines = setup.map(strip);
    const place = premises.map(strip).map(l => / is (.+) relative to /.exec(l)).find(Boolean);
    if (!place) throw new Error("no place on the card to count the axes from");
    const base: Axis[] = [
        { scale: SPATIAL_SCALES["east"], kind: "line" },
        { scale: SPATIAL_SCALES["north"], kind: "line" },
        { scale: SPATIAL_SCALES["up"], kind: "line" },
        { scale: LINEAR_SCALES["temporal"], kind: "line" },
        { scale: LINEAR_SCALES["contains"], kind: "line" },
        { scale: LINEAR_SCALES["quantity"], kind: "line" },
        { scale: LINEAR_SCALES["distinction"], kind: "parity" },
    ].slice(0, place[1].split(", ").length) as Axis[];
    for (const ax of base) {
        if (ax.kind !== "line") continue;
        const line = lines.find(l => l.startsWith(`Along ${axisLabel(ax)}, things go round a ring of `));
        if (!line) continue;
        ax.kind = "ring";
        ax.modulus = +/ring of (\d+) /.exec(line)![1];
        const twist = /crossing there mirrors (.+?) through the Post's line/.exec(line);
        const portal = /crossing there .+? carries a thing (\d+) (\S+) \(/.exec(line);
        if (twist) ax.seam = { type: "twist", target: base.findIndex(b => axisLabel(b) === twist[1]) };
        else if (portal) ax.seam = { type: "portal", target: base.findIndex(b => b.scale.direction[0] === portal[2]), shift: +portal[1] };
        else ax.seam = { type: "plain" };
    }
    return base;
}

/** One clause of a place or a pace on axis `ax`, or null if it is not that axis's. */
function readClause(ax: Axis, c: string): number | null {
    const s = ax.scale;
    if (c === s.tie) return 0;
    if (ax.kind === "parity") return c === s.parity!.same ? 0 : c === s.parity!.opposite ? 1 : null;
    if (ax.kind === "ring") {
        const m = new RegExp(`^(\\d+) ${s.cyclic!.step}s? (${esc(s.cyclic!.direction[0])}|${esc(s.cyclic!.direction[1])})$`).exec(c);
        return m ? (m[2] === s.cyclic!.direction[0] ? +m[1] : -m[1]) : null;
    }
    const m = new RegExp(`^(\\d+) (${esc(s.direction[0])}|${esc(s.direction[1])})$`).exec(c);
    return m ? (m[2] === s.direction[0] ? +m[1] : -m[1]) : null;
}

interface Parsed { card: Card; ask: Ask; kind: string }

/** A whole card back from its words. `things` and `speakers` are the names, in index order. */
function parse(q: Question, things: string[], speakers: string[]): Parsed {
    const axes = readAxes(q.setup, q.premises);
    const thing = new Map<string, number>([["the Post", POST], ...things.map((n, i) => [n, i] as [string, number])]);
    const who = new Map(speakers.map((n, i) => [n, i] as [string, number]));
    const T = `(the Post|${things.map(esc).join("|")})`;
    const P = `(${speakers.map(esc).join("|")})`;
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

    const fact = (speaker: number, body: string): Fact => {
        let m: RegExpExecArray | null;
        if ((m = /^I am a (knight|knave)$/.exec(body))) return { kind: "type", claim: { kind: "is", who: speaker, knight: m[1] === "knight" } };
        if ((m = new RegExp(`^${P} is a (knight|knave)$`).exec(body))) return { kind: "type", claim: { kind: "is", who: who.get(m[1])!, knight: m[2] === "knight" } };
        if ((m = new RegExp(`^${P} and ${P} are (the same kind|different kinds)$`).exec(body))) {
            return { kind: "type", claim: { kind: m[3] === "the same kind" ? "same" : "differ", a: who.get(m[1])!, b: who.get(m[2])! } };
        }
        if ((m = new RegExp(`^at (\\d+) o'clock, ${T} is (.+) relative to ${T}$`).exec(body))) {
            const parts = m[3].split(", ");
            if (parts.length !== axes.length) throw new Error(`a place needs every axis: "${body}"`);
            const delta = parts.map((c, i) => {
                const v = readClause(axes[i], c);
                if (v === null) throw new Error(`unread clause "${c}" on ${axisLabel(axes[i])}`);
                return axes[i].kind === "ring" ? ((v % axes[i].modulus!) + axes[i].modulus!) % axes[i].modulus! : v;
            });
            return { kind: "place", hour: +m[1], x: thing.get(m[2])!, y: thing.get(m[4])!, delta };
        }
        if ((m = new RegExp(`^${T} never moves$`).exec(body))) return { kind: "pace", x: thing.get(m[1])!, vel: axes.map(() => 0) };
        if ((m = new RegExp(`^every hour, ${T} moves (.+)$`).exec(body))) {
            const vel = axes.map(() => 0);
            for (const c of m[2].split(", ")) {
                const i = axes.findIndex(a => readClause(a, c) !== null && c !== a.scale.tie);
                if (i < 0) throw new Error(`unread pace "${c}"`);
                vel[i] = readClause(axes[i], c)!;
            }
            return { kind: "pace", x: thing.get(m[1])!, vel };
        }
        if ((m = new RegExp(`^${T} is (${LONG} long|a point) along (.+)$`).exec(body))) {
            return { kind: "size", x: thing.get(m[1])!, axis: axisBy(m[3]), long: m[2] !== "a point" };
        }
        if ((m = new RegExp(`^at (\\d+) o'clock, ${T} (lies wholly (\\S+)(?: of| than)?|partly overlaps|lies within|takes in all of|covers exactly the same stretch as) ${T} along (.+)$`).exec(body))) {
            const axis = axisBy(m[6]);
            let rel: IntervalRel;
            if (m[4]) {
                const [i, side] = dirAxis(m[4]);
                if (i !== axis) throw new Error(`"${m[4]}" is not a direction of ${m[6]}`);
                rel = side === 0 ? "after" : "before";
            } else rel = ({ "partly overlaps": "overlaps", "lies within": "within", "takes in all of": "spans", "covers exactly the same stretch as": "identical" } as const)[m[3] as "lies within"];
            return { kind: "rel", hour: +m[1], x: thing.get(m[2])!, y: thing.get(m[5])!, axis, rel };
        }
        if ((m = /^at (\d+) o'clock, (.+)$/.exec(body))) return { kind: "event", hour: +m[1], t: transform(m[2]) };
        throw new Error(`unread statement "${body}"`);
    };

    const transform = (text: string): TransformSpec => {
        let m: RegExpExecArray | null;
        if ((m = /^the whole space turns a quarter about the Post, taking (\S+) round to (\S+)$/.exec(text))) {
            const [a] = dirAxis(m[1]), [b, side] = dirAxis(m[2]);
            return { id: "rotate", axes: [a, b], k: side === 0 ? 1 : 3 };
        }
        if ((m = /^the whole space is mirrored along (.+) through the Post$/.exec(text))) return { id: "mirror", axes: [axisBy(m[1])] };
        if ((m = /^(.+?) and (.+?) trade places through the Post \(/.exec(text))) return { id: "swap", axes: [axisBy(m[1]), axisBy(m[2])] };
        if ((m = /^everything slides 1 (\S+) per step its low end lies (\S+)(?: of| than)? the Post/.exec(text))) {
            const [a, side] = dirAxis(m[1]), [b] = dirAxis(m[2]);
            return { id: "shear", axes: [a, b], k: side === 0 ? 1 : -1 };
        }
        if ((m = /^everything but the Post shifts (\d+) (\S+)$/.exec(text))) {
            const [a, side] = dirAxis(m[2]);
            return { id: "translate", axes: [a], k: side === 0 ? +m[1] : -m[1] };
        }
        if ((m = /^every (.+) distance from the Post doubles$/.exec(text))) return { id: "stretch", axes: [axisBy(m[1])] };
        throw new Error(`unread transformation "${text}"`);
    };

    const statements: Statement[] = q.premises.map(strip).map(line => {
        const m = new RegExp(`^${P} says: (.+)$`).exec(line);
        if (!m) throw new Error(`unread premise "${line}"`);
        const speaker = who.get(m[1])!;
        return { speaker, fact: fact(speaker, m[2]) };
    });
    const card: Card = { axes, things: things.length, speakers: speakers.length, statements };

    /* The question. */
    const prompt = strip(q.choicePrompt || (q.conclusion as string));
    const options = q.choices.map(strip);
    let m: RegExpExecArray | null;
    if ((m = new RegExp(`^${P} stands to ${P} as ${P} stands to which speaker, in being alike or unalike in what they are\\?$`).exec(prompt))) {
        const ask: Ask = { kind: "speakers", x: who.get(m[1])!, y: who.get(m[2])!, z: who.get(m[3])!, h1: 0, h2: 0, on: [], options: options.map(o => who.get(o)!) };
        return { card, ask, kind: "speakers" };
    }
    const head = `^At (\\d+) o'clock, ${T} stands to ${T} on (.+?) as ${T} stands to`;
    const on = (s: string) => s.split(", ").map(axisBy);
    if ((m = new RegExp(`${head} which of these at (\\d+) o'clock\\?( Select every one that fits, or none\\.)?$`).exec(prompt))) {
        const kind = m[7] ? "every" : "which";
        const ask: Ask = { kind, x: thing.get(m[2])!, y: thing.get(m[3])!, z: thing.get(m[5])!, h1: +m[1], h2: +m[6], on: on(m[4]), options: options.map(o => thing.get(o)!) };
        return { card, ask, kind };
    }
    if ((m = new RegExp(`${head} ${T} at (\\d+) o'clock$`).exec(prompt))) {
        const ask: Ask = { kind: "judge", x: thing.get(m[2])!, y: thing.get(m[3])!, z: thing.get(m[5])!, w: thing.get(m[6])!, h1: +m[1], h2: +m[7], on: on(m[4]) };
        return { card, ask, kind: "judge" };
    }
    throw new Error(`unread question "${prompt}"`);
}

/** The answer the question was shipped with, in the engine's terms. */
function shipped(q: Question, p: Parsed): unknown {
    if (p.kind === "judge") return q.isValid;
    if (p.kind === "every") return q.selectAnswer.map(i => p.ask.options![i]).sort((a, b) => a - b);
    return p.ask.options![q.correctChoice];
}

function names(q: Question, n: number) {
    const { things } = worldSize(n);
    return { things: q.bucket.slice(0, things), speakers: q.bucket.slice(things) };
}

/* ------------------------------------------------------------------ *
 * The writer, read back                                               *
 * ------------------------------------------------------------------ */

test("composed world: the card alone rebuilds the world and answers every kind of question as shipped", () => {
    let n = 0;
    for (let premises = RANGE.minNumOfPremises; premises <= RANGE.maxNumOfPremises; premises++) for (const kind of fitting(worldSize(premises))) {
        seeded(1000 + n++, () => {
            const q = createComposedWorld(ctxHolding([]), premises, kind);
            const { things, speakers } = names(q, premises);
            const p = parse(q, things, speakers);
            equal(p.kind, kind, "the question read back is the kind asked for");
            const rec = read(p.card, FULL);
            assert(rec, `the full reading of the card fails:\n${q.premises.map(strip).join("\n")}`);
            const answer = QUESTIONS[kind].answer(p.ask, rec!);
            assert(answer !== null, `the card does not settle its question: ${strip(q.choicePrompt || (q.conclusion as string))}`);
            equal(answerKey(answer), answerKey(shipped(q, p) as never), `${kind}: the card's answer is not the one shipped`);
        });
    }
});

test("composed world: read from the text, every shortcut misses", () => {
    for (let s = 0; s < 24; s++) seeded(2000 + s, () => {
        const kind = KINDS[s % KINDS.length], premises = 8;
        const q = createComposedWorld(ctxHolding([]), premises, kind);
        const { things, speakers } = names(q, premises);
        const p = parse(q, things, speakers);
        const truth = answerKey(shipped(q, p) as never);
        for (const [name, reading] of Object.entries(SHORTCUTS)) {
            const rec = read(p.card, reading);
            const a = rec ? QUESTIONS[kind].answer(p.ask, rec) : null;
            assert(answerKey(a) !== truth, `${kind}: ignoring ${name} still gives the answer (${truth})`);
        }
    });
});

test("composed world: nothing in an item is left unworded", () => {
    for (let s = 0; s < 16; s++) seeded(3000 + s, () => {
        const q = createComposedWorld(ctxHolding([]), 4 + (s % 5));
        const text = [...q.setup, ...q.premises, q.conclusion as string, q.choicePrompt ?? "", ...q.choices, ...q.explanation].map(strip).join("\n");
        for (const bad of ["undefined", "NaN", "null", "[object", "-0 "]) assert(!text.includes(bad), `"${bad}" in:\n${text}`);
        equal(new Set(q.bucket).size, q.bucket.length, "every name is distinct");
    });
});

/* ------------------------------------------------------------------ *
 * The engine                                                          *
 * ------------------------------------------------------------------ */

const randBody = (axes: Axis[], r: () => number): Body => ({
    pos: axes.map(a => (a.kind === "ring" ? Math.floor(r() * a.modulus!) : a.kind === "parity" ? Math.floor(r() * 2) : Math.floor(r() * 9) - 4)),
    size: axes.map(a => (a.kind === "line" && r() < 0.4 ? LONG : 1)),
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
        assert(rec.world.start.every((b, i) => sameBody(b, it.world.start[i])), "the reading places everything where it is");
        equal(answerKey(it.kind.answer(it.ask, rec)), answerKey(it.answer), "the full reading answers as shipped");
        for (const [name, r] of Object.entries(SHORTCUTS)) {
            const s = read(it.card, r);
            assert(answerKey(s ? it.kind.answer(it.ask, s) : null) !== answerKey(it.answer), `${it.kind.id}: ignoring ${name} gives the answer`);
        }
    }
});

test("composed world: every part of the structure turns up in what ships", () => {
    const seen = new Set<string>();
    for (const it of items(60, 8000)) {
        seen.add(`kind:${it.kind.id}`);
        seen.add(`seam:${it.world.axes[0].seam!.type}`);
        seen.add(`time:${it.world.axes[3].kind}${it.world.axes[3].seam ? "/" + it.world.axes[3].seam.type : ""}`);
        for (const e of it.world.events) seen.add(`event:${e.t.id}`);
        if (it.world.start.some(b => b.size.some(s => s === LONG))) seen.add("long");
        for (const s of it.card.statements) {
            const liar = !it.types[s.speaker];
            if (liar) seen.add(`knave:${s.fact.kind}`);
            if (s.fact.kind === "type") seen.add(`claim:${s.fact.claim.kind}`);
        }
        if (it.ask.h1 !== it.ask.h2) seen.add("two hours");
        if (it.ask.on.length > 1) seen.add("several axes");
        if (it.ask.x === POST || it.ask.y === POST) seen.add("the Post in the analogy");
    }
    const want = [
        ...KINDS.map(k => `kind:${k}`), "seam:twist", "seam:portal", "time:line", "time:ring/plain", "time:ring/portal",
        ...Object.keys(TRANSFORMS).map(t => `event:${t}`), "long", "knave:size", "knave:event", "knave:rel", "knave:type",
        "claim:is", "claim:same", "claim:differ", "two hours", "several axes", "the Post in the analogy",
    ];
    const missing = want.filter(w => !seen.has(w));
    assert(!missing.length, `never shipped: ${missing.join(", ")}`);
});

test("composed world: a knave's length is the other length, and only lengths and turns are negated", () => {
    const f: Fact = { kind: "size", x: 0, axis: 1, long: true };
    equal(negate(f), { ...f, long: false });
    equal(negate({ kind: "place", hour: 1, x: 0, y: POST, delta: [0, 0, 0, 0, 0, 0, 0] }), null, "a false place leaves too much open to use");
    equal(negate({ kind: "event", hour: 2, t: { id: "mirror", axes: [1] } }), null, "a mirror has no other way round");
});

test("composed world: a speaker nobody vouches for gives two reports and nothing that hides a body", () => {
    /* A length or an event from an unsettled speaker leaves that thing's body
       (or every later hour) unknown, and with it the reports meant to unmask
       that same speaker: allowed, nine cards in ten deadlocked. One report
       each, a shortcut unmasked the speaker the same way the full reading did,
       and the speakers kind built about 1 time in 10. */
    for (const it of items(12, 9000)) {
        const vouched = settleByClaims(it.card);
        for (let i = 0; i < it.types.length; i++) {
            if (vouched.has(i)) continue;
            const said = it.card.statements.filter(s => s.speaker === i).map(s => s.fact.kind);
            assert(!said.includes("size") && !said.includes("event"), `an unvouched speaker says ${said.join(", ")}`);
            assert(said.filter(k => k === "rel").length >= 2, `an unvouched speaker gives ${said.filter(k => k === "rel").length} checkable report(s)`);
        }
    }
});

test("composed world: most cards read back, so items cost few attempts", () => {
    /* About one attempt in five ships an item; with the deadlock, one in forty. */
    const ok = seeded(9100, () => {
        let n = 0;
        for (let i = 0; i < 300; i++) if (tryBuild({ things: 4, speakers: 4, kind: "every" })) n++;
        return n;
    });
    assert(ok >= 30, `only ${ok} of 300 attempts shipped an item`);
});

test("composed world: premises buy axes, things and speakers, and every kind is asked by the top", () => {
    equal(worldSize(RANGE.minNumOfPremises), { dims: 3, things: 2, speakers: 2 });
    equal(worldSize(RANGE.maxNumOfPremises), { dims: 7, things: 4, speakers: 4 });
    for (let n = RANGE.minNumOfPremises; n < RANGE.maxNumOfPremises; n++) {
        const a = worldSize(n), b = worldSize(n + 1);
        assert(b.dims >= a.dims && b.things >= a.things && b.speakers >= a.speakers, `${n + 1} premises buy less than ${n}`);
        assert(b.dims + b.things + b.speakers > a.dims + a.things + a.speakers, `${n + 1} premises buy nothing over ${n}`);
    }
    equal(fitting(worldSize(RANGE.maxNumOfPremises)), KINDS, "every kind of question at the top");
    /* And the floor still has the whole structure: a seam, a line to turn in, motion, lengths. */
    for (const it of items(8, 9300, worldSize(RANGE.minNumOfPremises))) {
        assert(it.world.axes[0].seam && it.world.axes[0].seam.type !== "plain", "the floor's ring has a seam");
        assert(it.world.events.length >= 1, "the floor has a transformation");
        assert(it.types.some(t => !t), "the floor has a knave");
    }
});
