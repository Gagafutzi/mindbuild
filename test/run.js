"use strict";

/*
 * Tests for the shell, run under node over the very file the browser loads —
 * the archive's convention, and for its reason: a suite that runs against a
 * transpiled copy is a suite about a copy.
 *
 *   node test/run.js
 *
 * What is tested is the meter, because the meter is the whole promise. The
 * shell's claim is that seven trainers can be counted without any of them
 * knowing this page exists; if the count is wrong the gate locks a machine over
 * a number nobody can defend.
 */

const assert = require("assert");
const path = require("path");
const { readFileSync } = require("fs");

/* `today.js` reads a global `localStorage` and calls the global `readFile` that
   `adapters.js` defines. Under node both have to be put where it will look —
   which is the same wiring the browser does with two script tags. */
const store = {};
global.localStorage = {
  get length() { return Object.keys(store).length; },
  key(i) { return Object.keys(store)[i]; },
  getItem(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
  setItem(k, v) { store[k] = String(v); },
  removeItem(k) { delete store[k]; },
};
global.readFile = require("../apps/archive/js/adapters.js").readFile;

const Today = require("../shell/js/today.js");

function reset() { for (const k of Object.keys(store)) delete store[k]; }

/* Fixed days rather than "now": a suite that passes only between 00:00 and
   23:00 UTC is a suite that fails on someone else's afternoon. */
const DAY = "2026-09-10";
const at = (h, m) => Date.parse(`${DAY}T${String(h).padStart(2, "0")}:${String(m || 0).padStart(2, "0")}:00Z`);

let passed = 0;
const cases = [];
const test = (name, fn) => cases.push([name, fn]);

/* ------------------------------------------------------------------ *
 * Fixtures — each in the shape its own trainer writes                 *
 * ------------------------------------------------------------------ */

function precision(sessions) {
  store["nback-performance"] = JSON.stringify(sessions.map((s) => ({
    date: new Date(s.at).toISOString(),
    duration: s.minutes * 60 * 1000,
    settings: { nLevel: 2 },
    totalMatches: 10,
    hits: 8,
    falseAlarms: 1,
  })));
}

function rotation(sessions) {
  store["spatial-rotation.progress.v1"] = JSON.stringify({
    history: sessions.map((s) => ({
      ts: s.at,
      seconds: s.minutes * 60,
      attempts: 20,
      accuracy: 0.8,
      mode: "molecule",
    })),
  });
}

/* ------------------------------------------------------------------ *
 * The count                                                           *
 * ------------------------------------------------------------------ */

test("an empty browser is an empty day, not an error", () => {
  reset();
  assert.deepStrictEqual(Today.minutesOn(DAY), {});
  assert.strictEqual(Today.totalMinutes(DAY), 0);
});

test("a trainer's own storage becomes that day's minutes", () => {
  reset();
  precision([{ at: at(9), minutes: 12 }]);
  assert.strictEqual(Math.round(Today.minutesOn(DAY).precision), 12);
});

test("two trainers on one day add up", () => {
  reset();
  precision([{ at: at(9), minutes: 12 }]);
  rotation([{ at: at(18), minutes: 8 }]);
  assert.strictEqual(Math.round(Today.totalMinutes(DAY)), 20);
});

test("another day's sessions do not count toward this one", () => {
  reset();
  precision([{ at: at(9), minutes: 12 }, { at: at(9) - 86400000, minutes: 40 }]);
  assert.strictEqual(Math.round(Today.totalMinutes(DAY)), 12,
    "yesterday's training was counted toward today's quota");
});

test("a source with nothing today is absent rather than zero", () => {
  reset();
  precision([{ at: at(9), minutes: 12 }]);
  rotation([{ at: at(9) - 86400000, minutes: 40 }]);
  const by = Today.minutesOn(DAY);
  assert.ok(!("rotation" in by), "a source with no time today appeared in the day");
});

test("garbage under a trainer's key does not take the day down with it", () => {
  reset();
  store["nback-performance"] = "{ this is not json";
  store["spatial-rotation.progress.v1"] = JSON.stringify({ history: "not an array" });
  assert.doesNotThrow(() => Today.minutesOn(DAY));
  assert.strictEqual(Today.totalMinutes(DAY), 0);
});

test("a chunked Syllogimous history reaches the meter", () => {
  reset();
  const q = { answeredAt: at(9), createdAt: at(9) - 30000, answered: true, type: "Syllogism" };
  store.SYL_HISTORY_IDX = JSON.stringify([0]);
  store["SYL_HISTORY_C:0"] = JSON.stringify([q, { ...q, answeredAt: at(9) + 60000, createdAt: at(9) + 30000 }]);
  assert.strictEqual(Math.round(Today.minutesOn(DAY).syllogimous * 60), 60,
    "the meter still asked for SYL_HISTORY and saw no Syllogimous");
});

test("Isomorph reaches the meter, and does not arrive as Syllogimous", () => {
  reset();
  const q = (at) => ({ answeredAt: at, createdAt: at - 30000, answered: true,
                       type: "RCC8 Regions", userAnswer: true, isValid: true });
  store["ISO/SYL_APP"] = "isomorph";
  store["ISO/SYL_HISTORY_IDX"] = JSON.stringify([0]);
  store["ISO/SYL_HISTORY_C:0"] = JSON.stringify([q(at(9)), q(at(9) + 60000)]);
  const by = Today.minutesOn(DAY);
  assert.strictEqual(Math.round(by.isomorph * 60), 60);
  assert.ok(!("syllogimous" in by), "Isomorph's answers were credited to Syllogimous");
});

test("both builds in one browser are two trainers, not one", () => {
  /* Isomorph and Syllogimous write the same key names and share this origin.
     The prefix on Isomorph's keys is the only thing between them, and the
     failure it prevents is silent: one app's day swallowing the other's, with
     a plausible total either way. */
  reset();
  const q = (at, type) => ({ answeredAt: at, createdAt: at - 30000, answered: true,
                             type: type, userAnswer: true, isValid: true });
  store["ISO/SYL_APP"] = "isomorph";
  store["ISO/SYL_HISTORY_IDX"] = JSON.stringify([0]);
  store["ISO/SYL_HISTORY_C:0"] = JSON.stringify([q(at(9), "Frames")]);
  store.SYL_HISTORY_IDX = JSON.stringify([0]);
  store["SYL_HISTORY_C:0"] = JSON.stringify([q(at(10), "Syllogism")]);

  const by = Today.minutesOn(DAY);
  assert.strictEqual(Math.round(by.isomorph * 60), 30);
  assert.strictEqual(Math.round(by.syllogimous * 60), 30);
  assert.strictEqual(Math.round(Today.totalMinutes(DAY) * 60), 60);
});

/* ------------------------------------------------------------------ *
 * The file a player shares                                            *
 * ------------------------------------------------------------------ */

const Share = require("../shell/js/share.js");

test("the shared file keeps the numbers and none of the words", () => {
  /* The whole promise on the hub card: per answer, how hard, how shown,
     whether right — and nothing a player wrote, read or configured. */
  reset();
  const q = (t, type, extra) => ({
    answeredAt: t, createdAt: t - 20000, answered: true, type,
    userAnswer: true, isValid: true, answerMode: "boolean",
    premises: ["<span class=\"subject\">Wallet</span> is left of Scale", "Scale is left of Puppy"],
    conclusion: "Wallet is left of Puppy",
    timerTypeOnAnswer: "2", gameModeOnAnswer: "1",
    difficulty: { level: 6.2, premises: 2, rungs: ["negation"], seconds: 40, carousel: true },
    ...extra,
  });
  store.SYL_HISTORY_IDX = JSON.stringify([0]);
  store["SYL_HISTORY_C:0"] = JSON.stringify([q(at(10), "Syllogism"), q(at(9), "Linear Arrangement", { userAnswer: false })]);
  store.SYL_KEYBINDS = JSON.stringify({ answerTrue: "ArrowUp" });
  store["ISO/SYL_APP"] = "isomorph";
  store["ISO/SYL_HISTORY_IDX"] = JSON.stringify([0]);
  store["ISO/SYL_HISTORY_C:0"] = JSON.stringify([q(at(11), "Frames", { gameModeOnAnswer: undefined })]);

  const file = Share.build(localStorage, Date.parse(DAY));
  const text = JSON.stringify(file);
  for (const leak of ["Wallet", "Puppy", "ArrowUp", "subject", String(at(9))]) {
    assert.ok(!text.includes(leak), `the shared file carries ${JSON.stringify(leak)}`);
  }

  assert.strictEqual(file.answers, 3);
  assert.deepStrictEqual(file.apps, { syllogimous: 2, isomorph: 1 });
  assert.deepStrictEqual(file.rows.map((r) => [r.mode, r.seq]),
    [["Linear Arrangement", 1], ["Syllogism", 2], ["Frames", 3]], "not in the order answered");
  const [wrong, right, iso] = file.rows;
  assert.deepStrictEqual(right, {
    app: "syllogimous", mode: "Syllogism", level: 6.2, premises: 2, rungs: ["negation"],
    clock: 40, presentation: "1", timer: "2", answerMode: "boolean", correct: 1,
    seconds: 20, day: DAY, seq: 2,
  });
  assert.strictEqual(wrong.correct, 0);
  assert.strictEqual(iso.app, "isomorph");
  assert.strictEqual(iso.presentation, null, "an unrecorded presentation was guessed");
});

test("the participant id is made once and kept", () => {
  reset();
  const a = Share.build(localStorage).participant;
  assert.match(a, /^[0-9a-f]{16}$/);
  assert.strictEqual(Share.build(localStorage).participant, a,
    "a second file got a new id, so one player's files cannot be joined or deleted together");
});

const Kit = require("../shared/share-kit/share-kit.js");

function kitFile(answers, participant) {
  return Kit.makeFile(answers, { tool: "test", participant: participant || "0123456789abcdef", now: at(23) }).file;
}
const ans = (h, mode, extra) => ({ app: "demo", mode, at: at(h), correct: true, seconds: 12.34, ...extra });

test("share-kit writes only files its own validator accepts", () => {
  const { file, skipped } = Kit.makeFile([
    ans(9, "Linear Arrangement", { level: 5.678, rungs: ["third-axis", "<b>"] }),
    ans(10, "=cmd()"),                   // would open as a formula in a spreadsheet
    ans(11, "Frames", { secret: "me" }), // an unknown field is dropped, not carried
  ], { tool: "test", participant: "0123456789abcdef", now: at(23) });
  assert.strictEqual(skipped, 1);
  assert.deepStrictEqual(Kit.validate(file), { ok: true, errors: [] });
  assert.deepStrictEqual(file.rows[0].rungs, ["third-axis"]);
  assert.strictEqual(file.rows[0].level, 5.68);
  assert.ok(!JSON.stringify(file).includes("secret"));
});

test("share-kit turns away every way a file can be tampered with", () => {
  const good = kitFile([ans(9, "Syllogism"), ans(10, "Syllogism")]);
  const bad = (edit) => { const f = JSON.parse(JSON.stringify(good)); edit(f); return Kit.validate(f).ok; };
  assert.ok(bad(() => {}), "the untouched file was rejected");
  assert.ok(!bad((f) => { f.rows[0].name = "Jo"; }), "an extra field in a row");
  assert.ok(!bad((f) => { f.email = "a@b.c"; }), "an extra top-level field");
  assert.ok(!bad((f) => { f.rows[0].mode = "<img onerror=x>"; }), "markup in a mode");
  assert.ok(!bad((f) => { f.rows[0].correct = 7; }), "a score out of range");
  assert.ok(!bad((f) => { f.rows.pop(); }), "counts that no longer match the rows");
  assert.ok(!bad((f) => { f.participant = "jo@example.com"; }), "an identifying participant");
  assert.ok(!bad((f) => { f.rows[0].day = "2999-01-01"; }), "a day after the file was made");
  /* JSON.parse makes these ordinary keys, and a bare lookup in an object
     literal finds them on the prototype — the bug this line exists for. */
  assert.ok(!Kit.validate(JSON.parse(JSON.stringify(good).replace('"rows":[{', '"rows":[{"constructor":1,'))).ok);
  assert.ok(!Kit.validate(JSON.parse(JSON.stringify(good).replace("{", '{"__proto__":{"x":1},'))).ok);
});

test("uploading twice counts each answer once", () => {
  const morning = kitFile([ans(9, "A"), ans(10, "B")]);
  const evening = kitFile([ans(9, "A"), ans(10, "B"), ans(20, "C")]);
  const other = kitFile([ans(9, "A")], "fedcba9876543210");
  const rows = Kit.merge([evening, morning, other]);
  assert.strictEqual(rows.length, 4);
  assert.deepStrictEqual(rows.filter((r) => r.participant === "0123456789abcdef").map((r) => r.mode), ["A", "B", "C"]);
});

/* ------------------------------------------------------------------ *
 * What the quota may not include                                      *
 * ------------------------------------------------------------------ */

test("the archive contributes no minutes", () => {
  reset();
  /* The archive's own keys, as `app.js` writes them. They must be invisible to
     the meter: maintaining the record is not training, and a gate that could be
     satisfied by tidying is a gate that will be. */
  store["archive.unsaved"] = "3";
  store["archive.savedAt"] = new Date(at(12)).toISOString();
  store["mindbuild.quota.minutes"] = "20";
  assert.strictEqual(Today.totalMinutes(DAY), 0);
});

/* ------------------------------------------------------------------ *
 * The streak                                                          *
 * ------------------------------------------------------------------ */

test("a streak counts back from the last day trained", () => {
  reset();
  const today = new Date();
  const days = [0, 1, 2].map((back) => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - back);
    return d.getTime();
  });
  precision(days.map((t) => ({ at: t, minutes: 10 })));
  assert.strictEqual(Today.streak(), 3);
});

test("a gap ends the streak", () => {
  reset();
  const today = new Date();
  const days = [0, 1, 3].map((back) => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - back);
    return d.getTime();
  });
  precision(days.map((t) => ({ at: t, minutes: 10 })));
  assert.strictEqual(Today.streak(), 2, "a missed day did not end the streak");
});

/* ------------------------------------------------------------------ *
 * Every trainer is reachable                                          *
 * ------------------------------------------------------------------ */

test("every key the shell watches is one an adapter recognises", () => {
  /* The failure this catches is silence: a trainer renames its storage key, the
     adapter stops matching, and the meter reports a smaller day rather than an
     error. Here the shape is known good, so a null means the wiring broke. */
  const probes = [
    ["nback-performance", JSON.stringify([{ date: new Date(at(9)).toISOString(), duration: 60000, settings: {}, totalMatches: 5, hits: 4, falseAlarms: 0 }])],
    ["spatial-rotation.progress.v1", JSON.stringify({ history: [{ ts: at(9), seconds: 60, attempts: 20, accuracy: 0.8, mode: "m" }] })],
  ];
  /* Isomorph needs two keys to be recognised at all — the index and the chunk
     it names — so it cannot be a one-key probe like the rest. */
  reset();
  store["ISO/SYL_HISTORY_IDX"] = JSON.stringify([0]);
  store["ISO/SYL_HISTORY_C:0"] = JSON.stringify([{ answeredAt: at(9), createdAt: at(9) - 60000,
    answered: true, type: "Frames", userAnswer: true, isValid: true }]);
  assert.ok(Today.totalMinutes(DAY) > 0,
    "Isomorph produced no minutes — its adapter stopped matching");

  for (const [key, value] of probes) {
    reset();
    store[key] = value;
    assert.ok(Today.totalMinutes(DAY) > 0, `${key} produced no minutes — its adapter stopped matching`);
  }
});

/*
 * The two trainers from Chimera Hub, through the sample records each one
 * exported from a session actually played, under the key its own source
 * writes. Read out of the trainer rather than typed here, because the way
 * this breaks is a key renamed on one side and not the other — and then the
 * meter shows a smaller day, not an error.
 */
test("Relation Algebra, Listening Integration, aPOSNER, Veridical Mapping and Loci Span reach the meter", () => {
  const fs = require("fs");
  for (const [id, src] of [["relations", "trainer.js"], ["listening", "listening.js"], ["aposner", "index.html"], ["vmt", "index.html"], ["loci", "index.html"]]) {
    const code = fs.readFileSync(path.join(__dirname, "..", "apps", id, src), "utf8");
    const key = (code.match(/RECORD_KEY\s*=\s*"([^"]+)"/) || [])[1];
    assert.strictEqual(key, `chimera.${id}.record.v1`,
      `${id} writes its record under ${key}, which the meter's pattern does not match`);

    const sample = fs.readFileSync(path.join(__dirname, "..", "apps", id, "test", "sample-record.json"), "utf8");
    const day = new Date(JSON.parse(sample).sessions[0].start).toISOString().slice(0, 10);
    reset();
    store[key] = sample;
    store[`chimera.${id}.settings.v1`] = "{}";        // a neighbour key, not a record
    assert.ok(Today.minutesOn(day)[id] > 0, `${id}'s session produced no minutes`);
  }
});

test("every trainer on the hub is in the site", () => {
  const fs = require("fs");
  const shell = fs.readFileSync(path.join(__dirname, "..", "shell", "js", "shell.js"), "utf8");
  const build = fs.readFileSync(path.join(__dirname, "..", "tools", "build-site.mjs"), "utf8");
  const listed = shell.slice(shell.indexOf("var TRAINERS"), shell.indexOf("var ARCHIVE"));
  const ids = [...listed.matchAll(/id: "([a-z]+)"/g)].map((m) => m[1]);
  assert.ok(["relations", "listening", "aposner", "vmt", "loci"].every((id) => ids.includes(id)), "the hub does not offer them");
  /* Two are built by their own toolchain and named in the build by path. */
  for (const id of ids) {
    assert.ok(new RegExp(`"${id}"`).test(build) || build.includes(`apps", "${id}"`),
      `${id} is on the hub's menu and never copied into the site — a dead card`);
  }
});

/* ------------------------------------------------------------------ *
 * The quota's caps                                                    *
 * ------------------------------------------------------------------ *
 *
 * A cap is a share of the *counted* day, not the raw one. Every case below
 * turns on that distinction, and getting it backwards is the difference
 * between "synth can never carry a quota" and "synth can carry one slowly".
 */

const Q = require("../shared/quota.js");
const near = (a, b, what) => assert.ok(Math.abs(a - b) < 0.01, `${what}: ${a} ≠ ${b}`);

test("an uncapped day counts every minute of itself", () => {
  near(Q.apply({ rnb: 12, rotation: 8 }).total, 20, "uncapped total");
});

test("synth alone can never satisfy a quota, however long it runs", () => {
  near(Q.apply({ synth: 600 }).total, 0, "ten hours of synth");
});

test("cct alone can never satisfy a quota either", () => {
  near(Q.apply({ cct: 600 }).total, 0, "ten hours of cct");
});

test("a capped source under its ceiling is counted whole", () => {
  const r = Q.apply({ rnb: 20, synth: 1 });
  near(r.total, 21, "total");
  near(r.counted.synth, 1, "synth");
  assert.deepStrictEqual(r.capped, [], "an uncapped source was reported as capped");
});

test("both caps at their ceiling supply a quarter of the day", () => {
  /* 15 uncapped, both capped sources effectively unlimited: the fixed point is
     15 / (1 - 0.25) = 20, of which synth may be 5% and cct 20%. */
  const r = Q.apply({ rnb: 15, synth: 600, cct: 600 });
  near(r.total, 20, "total");
  near(r.counted.synth, 1, "synth at 5% of 20");
  near(r.counted.cct, 4, "cct at 20% of 20");
});

test("a capped source keeps its raw figure alongside the counted one", () => {
  const r = Q.apply({ rnb: 15, cct: 600 });
  near(r.raw.cct, 600, "raw cct");
  assert.ok(r.counted.cct < r.raw.cct, "counted was not below raw");
  assert.deepStrictEqual(r.capped, ["cct"]);
});

test("capping never invents time", () => {
  for (const day of [{ rnb: 3, cct: 99 }, { synth: 7, cct: 7 }, { rotation: 1, synth: 40 }]) {
    const r = Q.apply(day);
    const rawTotal = Object.values(day).reduce((a, b) => a + b, 0);
    assert.ok(r.total <= rawTotal + 1e-9, `counted ${r.total} exceeded raw ${rawTotal}`);
    for (const s of Object.keys(r.counted)) {
      assert.ok(r.counted[s] <= day[s] + 1e-9, `${s} counted above its raw minutes`);
    }
  }
});

test("an empty day survives the policy", () => {
  const r = Q.apply({});
  near(r.total, 0, "total");
  assert.deepStrictEqual(r.capped, []);
});

test("removing the caps counts everything", () => {
  near(Q.apply({ synth: 50, cct: 50 }, {}).total, 100, "uncapped by configuration");
});

test("the archive cannot be rescued by a cap it is not in", () => {
  /* The archive never reaches the policy, but if it ever did it must not add
     minutes: it is not in the caps and would be treated as uncapped training. */
  const r = Q.apply({ rnb: 10 });
  assert.ok(!("archive" in r.counted), "the archive appeared in a counted day");
});

/* ------------------------------------------------------------------ *
 * Pausing the trainer the hub has covered                             *
 * ------------------------------------------------------------------ *
 *
 * Returning to the hub left the trainer running: the frame is hidden and its
 * `src` is deliberately not reassigned, so trials went on being presented and
 * clocks went on counting behind a menu. The shell meanwhile stops its own
 * session clock when the stage is hidden and recounts the day on the grounds
 * that nothing is being timed — an assertion that was true of the shell and
 * false of the thing it framed, while the meter credited the minutes to
 * whichever trainer was open.
 *
 * What is tested is the signal, not a trainer's reaction to it. The shell's
 * whole claim here is that it delivers the *browser's* own signal and injects
 * nothing, so a trainer that honours the standard API and knows nothing about
 * this page pauses correctly — which means the thing worth pinning down is that
 * a document behaving as the browser's does sees exactly what a real tab switch
 * would show it.
 */

const Pause = require("../shell/js/pause.js");

/**
 * A frame whose document answers visibility the way a real one does.
 *
 * `hidden` and `visibilityState` are prototype getters in the browser, so they
 * are prototype getters here: the shadow-and-delete this module turns on is
 * only correct against that shape, and a fake with own data properties would
 * pass while the real thing broke.
 */
function fakeFrame() {
  const proto = {
    get hidden() { return false; },
    get visibilityState() { return "visible"; },
  };
  const doc = Object.create(proto);
  const seen = [];
  doc.dispatchEvent = (e) => { seen.push(["doc", e.type, doc.visibilityState]); return true; };

  const win = { Event: class { constructor(type) { this.type = type; } } };
  win.dispatchEvent = (e) => { seen.push(["win", e.type, doc.visibilityState]); return true; };

  return { frame: { contentWindow: win, contentDocument: doc }, doc, seen };
}

test("covering the stage tells the frame it is hidden, as a tab switch would", () => {
  const { frame, doc, seen } = fakeFrame();
  assert.strictEqual(Pause.setFrameHidden(frame, true), true, "the signal was not delivered");

  assert.strictEqual(doc.hidden, true, "the document still reports itself showing");
  assert.strictEqual(doc.visibilityState, "hidden", "visibilityState was not changed");
  /* And the state is already right when the event arrives: a listener reads
     `document.hidden` rather than the event, so firing first would have it read
     the old answer. */
  assert.deepStrictEqual(seen, [
    ["doc", "visibilitychange", "hidden"],
    ["win", "blur", "hidden"],
  ], "the frame saw the wrong signal, or saw it in the wrong state");
});

test("re-opening the trainer hands the frame back to the browser", () => {
  const { frame, doc, seen } = fakeFrame();
  Pause.setFrameHidden(frame, true);
  seen.length = 0;

  assert.strictEqual(Pause.setFrameHidden(frame, false), true);
  assert.deepStrictEqual(seen, [
    ["doc", "visibilitychange", "visible"],
    ["win", "focus", "visible"],
  ], "the frame was not told it is showing again");
});

test("resuming uncovers the native getters rather than answering for them", () => {
  /* The failure this catches is the obvious implementation. Setting `hidden` to
     false leaves an own property that goes on saying false when the browser
     hides the tab for real — so the trainer stops pausing on a genuine tab
     switch, which is the case the API exists for and the one rnb's clock
     depends on. */
  const { frame, doc } = fakeFrame();
  Pause.setFrameHidden(frame, true);
  Pause.setFrameHidden(frame, false);

  assert.ok(!Object.prototype.hasOwnProperty.call(doc, "hidden"),
    "the shell is still answering for `hidden`, so a real tab switch is masked");
  assert.ok(!Object.prototype.hasOwnProperty.call(doc, "visibilityState"),
    "the shell is still answering for `visibilityState`");
  assert.strictEqual(doc.hidden, false, "the native getter did not come back");
});

test("pausing twice is the same as pausing once", () => {
  /* `home()` runs on every hash change, including one that does not move. */
  const { frame, doc } = fakeFrame();
  Pause.setFrameHidden(frame, true);
  Pause.setFrameHidden(frame, true);
  assert.strictEqual(doc.hidden, true);
  Pause.setFrameHidden(frame, false);
  assert.strictEqual(doc.hidden, false, "two pauses took two resumes to undo");
});

test("an empty frame is not an error", () => {
  /* The hub is the first thing shown, so `home()` runs before anything is
     loaded, and a frame between documents is an ordinary state. Throwing out of
     a navigation handler would take the hub down with it. */
  for (const frame of [null, {}, { contentWindow: null, contentDocument: null }]) {
    assert.strictEqual(Pause.setFrameHidden(frame, true), false,
      "an empty frame reported a delivered signal");
  }
});

test("the shell states the frame's visibility on both paths", () => {
  /* Read off the shipped file: the wiring is what makes the module do anything,
     and a module with no call site is the failure this whole area started as. */
  const src = require("fs").readFileSync(
    path.join(__dirname, "..", "shell", "js", "shell.js"), "utf8");

  const home = src.slice(src.indexOf("function home()"));
  assert.ok(/Pause\.setFrameHidden\(\$\("frame"\), true\)/.test(home.slice(0, 600)),
    "home() does not pause the trainer it is covering");

  const show = src.slice(src.indexOf("function show("), src.indexOf("function home()"));
  assert.ok(/Pause\.setFrameHidden\(\$\("frame"\), false\)/.test(show),
    "show() does not un-pause the trainer it is opening");

  /* And the page has to load it, or both calls are a ReferenceError that takes
     out navigation entirely. */
  const html = require("fs").readFileSync(
    path.join(__dirname, "..", "shell", "index.html"), "utf8");
  assert.ok(html.includes("js/pause.js"), "shell/index.html does not load pause.js");
  assert.ok(html.indexOf("js/pause.js") < html.indexOf("js/shell.js"),
    "pause.js loads after shell.js, so `Pause` is undefined when the shell runs");
});

/**
 * And the trainers honour it.
 *
 * The shell delivers the browser's own hidden signal and nothing more, so a
 * trainer only pauses if it listens. Two of them already did — rnb stops the
 * block and says so, synth stops its timer — and the rest were re-plumbed to
 * stop the clock and the pace while leaving the trial on screen alone.
 *
 * Checked statically, against the shipped file. Whether the clock actually
 * freezes is a browser question and was verified by driving both trainers in
 * one: the countdown held across two and a half seconds hidden and resumed
 * after, and with both stop paths removed it kept counting. What a
 * dependency-free suite can own is that the wiring is still there at all,
 * which is the way this would regress — a handler deleted in a refactor, and
 * a trainer quietly running behind the menu again.
 */
const PAUSED_TRAINERS = [
  ["cct", "apps/cct/index.html", "pauseSession", "sessionPaused"],
  ["rrt", "apps/rrt/index.html", "pauseSession", "paused"],
];

for (const [name, file, fn, flag] of PAUSED_TRAINERS) {
  test(`${name} pauses when the page it is in goes hidden`, () => {
    const src = require("fs").readFileSync(path.join(__dirname, "..", file), "utf8");

    assert.ok(/addEventListener\(\s*['"]visibilitychange['"]/.test(src),
      `${name} does not listen for the signal the shell sends`);
    assert.ok(src.includes("document.hidden"),
      `${name} listens but never asks whether it is hidden`);
    assert.ok(new RegExp(`function ${fn}\\s*\\(`).test(src),
      `${name} has no ${fn}()`);

    /* The clock has to be stopped, not merely flagged. A flag alone leaves the
       interval firing, which is what the browser does to a background tab
       anyway — the point of pausing here is that the hub is not a background
       tab, so nothing throttles it. */
    const body = src.slice(src.indexOf(`function ${fn}`));
    assert.ok(/clearInterval/.test(body.slice(0, 900)),
      `${name}'s pause does not stop its countdown`);
    assert.ok(body.slice(0, 900).includes(flag),
      `${name}'s pause does not record that it is paused`);

    /* And it has to come back. A pause with no resume is a trainer that stops
       for good the first time you look at the menu. */
    assert.ok(/function resumeSession\s*\(/.test(src),
      `${name} pauses and never resumes`);
  });
}

/**
 * Rotation gates its clocks instead of clearing them.
 *
 * Both of its timers are intervals set up inside long blocks, and re-arming
 * one from outside would mean a second copy of that setup drifting from the
 * first — so a flag the ticks read is the same freeze with nothing to keep in
 * step. That makes the shape different from cct's and rrt's, which is why it
 * is asserted separately rather than bent into the same table.
 *
 * Static only, and unusually so: this trainer's script is a module that
 * imports `three` from a CDN, so it does not execute at all without network
 * and cannot be driven here the way cct and rrt were.
 */
test("rotation stops both its clocks when the page goes hidden", () => {
  const src = require("fs").readFileSync(
    path.join(__dirname, "..", "apps", "rotation", "index.html"), "utf8");

  assert.ok(/addEventListener\(\s*\n?\s*['"]visibilitychange['"]/.test(src),
    "rotation does not listen for the signal the shell sends");
  assert.ok(/trainerPaused\s*=\s*document\.hidden/.test(src),
    "rotation listens but does not record being hidden");

  /* Both ticks have to read the flag. The trial countdown had no guard of any
     kind before this — not even the `sessionActive` one the session clock
     had — so it is the half that would silently go back to ticking. */
  const gates = src.match(/trainerPaused/g) || [];
  assert.ok(gates.length >= 4,
    `only ${gates.length} mentions of the pause flag: one clock is ungated`);
  assert.ok(/!sessionActive \|\|\s*\n?\s*trainerPaused/.test(src),
    "rotation's session clock does not read the pause flag");
});

/**
 * ewmt routes the signal into the pause it already had.
 *
 * Its `togglePause` clears the trial timeouts, cancels the speech queue, stops
 * the audio and puts the PAUSED overlay up — so reaching into the engine to
 * stop a clock beside all that would be the quieter pause that forgets the
 * sound. The thing worth asserting is therefore that it goes through the
 * existing one, and that it only un-pauses what the hiding paused: the same
 * button is on screen, and auto-resuming would restart a session the player
 * had deliberately stopped before looking away.
 */
test("ewmt pauses through its own pause, and resumes only its own", () => {
  const src = require("fs").readFileSync(
    path.join(__dirname, "..", "apps", "ewmt", "js", "08-app.js"), "utf8");

  /* Anchored on the listener rather than on the word: the comment above it
     names the event too, and a window measured from there is all prose. */
  const at = src.indexOf("addEventListener('visibilitychange'");
  assert.ok(at > 0, "ewmt does not listen for the signal the shell sends");
  const handler = src.slice(at, at + 700);

  assert.ok(/this\.togglePause\(\)/.test(handler),
    "ewmt stops something other than its own pause, which would skip the audio");
  assert.ok(/_pausedByHiding\s*=\s*true/.test(handler),
    "ewmt does not record that the hiding is what paused it");
  assert.ok(/if \(!this\._pausedByHiding\) return/.test(handler),
    "ewmt would resume a session the player paused by hand");

  /* And the flag is cleared when a session ends, or coming back would toggle a
     pause onto the next session's first trial. */
  const ended = src.slice(src.indexOf("endSession(reason"));
  assert.ok(/_pausedByHiding\s*=\s*false/.test(ended.slice(0, 400)),
    "a session ended while hidden leaves the flag armed");
});

/**
 * precision pauses its transport and does not bill the interruption.
 *
 * Two halves, and the second is the one that reaches the meter. `display: none`
 * stops `requestAnimationFrame`, so this trainer's 3D rotation freezes on its
 * own — but the trials are scheduled on `Tone.Transport`, which runs on the Web
 * Audio clock, and nothing about being hidden stops that. And the session's
 * recorded duration is wall-clock, so time in the hub menu was being written
 * into the very figure the archive's adapters turn into minutes trained today.
 */
test("precision pauses its transport and discounts the time it was hidden", () => {
  const src = require("fs").readFileSync(
    path.join(__dirname, "..", "apps", "precision", "components", "NBackGame.tsx"), "utf8");

  const at = src.indexOf('addEventListener("visibilitychange"');
  assert.ok(at > 0, "precision does not listen for the signal the shell sends");

  const effect = src.slice(src.indexOf("const onVisibility"), at);
  assert.ok(/Tone\.Transport\.pause\(\)/.test(effect),
    "precision does not stop the transport, so trials keep advancing");
  assert.ok(/Tone\.Transport\.start\(\)/.test(effect),
    "precision stops the transport and never starts it again");
  /* `pause`, not `stop`: the transport keeps its position, so the
     self-scheduling loop resumes inside the ISI it had reached rather than
     firing the next trial the moment you come back. */
  assert.ok(!/Tone\.Transport\.stop\(\)/.test(effect),
    "precision stops the transport instead of pausing it, losing its position");

  /* And the duration that reaches the record has the interruption taken off. */
  assert.ok(/const duration = Date\.now\(\) - startTimeRef\.current - awayMsRef\.current/.test(src),
    "precision still records wall-clock duration, so the hub menu counts as training");
  assert.ok(src.includes("removeEventListener(\"visibilitychange\"", ),
    "the handler outlives the component");
});

/* ------------------------------------------------------------------ *
 * The archive wears the hub's theme, and the copy cannot drift         *
 * ------------------------------------------------------------------ *
 *
 * The archive is published as its own repository and has no build step, so it
 * cannot import the hub's stylesheet — the theme is a *copy*, including the
 * 24 kB drawing of the forest. A copy nobody checks is how two pages one click
 * apart end up looking like two applications, which is the thing the shared
 * look exists to prevent.
 *
 * So the values are not asserted against a third list kept here. They are read
 * out of both stylesheets and compared, which is the only arrangement where
 * "they agree" cannot rot. The names differ on purpose: the archive keeps the
 * tracker's vocabulary (`--bg-card`) because every rule in its file is written
 * against it, and only the values moved. The mapping is written out below, so
 * a rename on either side fails here rather than silently stopping the check.
 */

const SHELL_CSS = path.join(__dirname, "..", "shell", "css", "shell.css");
const ARCHIVE_CSS = path.join(__dirname, "..", "apps", "archive", "css", "base.css");

/**
 * The custom properties a stylesheet's `:root` sets.
 *
 * Read to the matching `}` rather than to the first one: `--bg-image` is an
 * SVG data URI with braces nowhere in it but semicolons everywhere, and the
 * naive split takes the picture apart.
 */
function rootTokens(file) {
  const src = readFileSync(file, "utf8");
  const at = src.indexOf(":root {");
  assert.ok(at >= 0, `${path.basename(file)} has no :root block`);
  const body = src.slice(at + ":root {".length, src.indexOf("\n}", at));

  const out = {};
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([\s\S]*?);\s*(?=\n|$)/g)) {
    out[m[1]] = m[2].replace(/\s+/g, " ").trim();
  }
  return out;
}

/* Same name on both sides, and the same value. */
const SHARED = [
  "--bg", "--accent", "--accent-2", "--accent-rgb", "--ok", "--bad",
  "--radius", "--shadow", "--font-display", "--font-body", "--bg-image",
];

/* Different name, same value: the archive's own vocabulary over the hub's. */
const RENAMED = {
  "--bg-card": "--panel",
  "--bg-hover": "--panel-hi",
  "--text-primary": "--ink-strong",
  "--text-secondary": "--ink",
  "--text-muted": "--dim",
};

test("the archive's theme is the hub's, value for value", () => {
  const hub = rootTokens(SHELL_CSS);
  const archive = rootTokens(ARCHIVE_CSS);

  for (const name of SHARED) {
    assert.ok(name in hub, `the hub no longer defines ${name}`);
    assert.ok(name in archive, `the archive no longer defines ${name}`);
    assert.strictEqual(archive[name], hub[name],
      `${name} differs between the hub and the archive, so the two pages read`
      + " as two applications one click apart");
  }

  for (const [here, there] of Object.entries(RENAMED)) {
    assert.ok(here in archive, `the archive no longer defines ${here}`);
    assert.ok(there in hub, `the hub no longer defines ${there}`);
    assert.strictEqual(archive[here], hub[there],
      `the archive's ${here} is no longer the hub's ${there}`);
  }

  /* The picture is the expensive half of the copy, and the one a careless edit
     would truncate rather than change — so it is checked for being there at
     full length as well as for matching. */
  assert.ok(archive["--bg-image"].length > 20000,
    "the archive's forest is a fraction of its size — the copy was truncated");
});

/**
 * And the shapes came over with the colours.
 *
 * The theme's own rule is that nothing is rounded, and a stylesheet keeps a
 * `--radius: 0` token so the rules that used it still read as shape decisions.
 * A rule that hard-codes its own radius slips straight past that, which is how
 * the tracker's 10px cards would come back one panel at a time.
 */
test("nothing in the archive rounds a corner behind the token's back", () => {
  const src = readFileSync(ARCHIVE_CSS, "utf8");
  const hard = [...src.matchAll(/border-radius:\s*([^;]+);/g)]
    .map(m => m[1].trim())
    /* The source dot is round, and the hub's own is too: six colours telling
       six trainers apart is data rather than decoration. */
    .filter(v => v !== "50%" && !v.startsWith("var(--radius"));

  assert.deepStrictEqual(hard, [],
    `the archive rounds a corner the theme does not: ${hard.join(", ")}`);
});

/*
 * Loci Span's words: a tier is how readily a word pictures itself, so a word
 * in two tiers would be both easy and hard to place, and a tier too small
 * would repeat itself within a session, where a word already set on the route
 * is recalled from there.
 */
test("Loci Span's words: five tiers, each word in one, enough for a session without repeats", () => {
  const W = require("../apps/loci/words.js");
  const where = new Map();
  for (const level of [1, 2, 3, 4, 5]) {
    const t = W.tiers[level];
    assert.strictEqual(t.level, level, `tier ${level} is out of place`);
    assert.ok(t.words.length >= 100, `tier ${level} has only ${t.words.length} words`);
    for (const w of t.words) {
      assert.ok(/^[a-z]+$/.test(w), `"${w}" is not one lower-case word`);
      assert.ok(!where.has(w), `"${w}" is in tiers ${where.get(w)} and ${level}`);
      where.set(w, level);
    }
  }
  /* The examples the trainer was asked for, where they were asked to be. */
  for (const w of ["dragon", "gnome", "knight", "fire"]) assert.strictEqual(where.get(w), 5, `${w} is not vivid`);
  for (const w of ["molecule", "fraction", "document"]) assert.strictEqual(where.get(w), 3, `${w} is not among the hard to picture`);
});

/*
 * Loci Span in any order: a word counts wherever it is written, once however
 * often, and a word never shown counts against nothing but is named. Run on
 * the page's own matching code, cut out of it, so the test reads what ships.
 */
test("Loci Span's any-order scoring ignores order, counts a word once, and names what was never shown", () => {
  const vm = require("vm");
  const html = readFileSync(path.join(__dirname, "..", "apps", "loci", "index.html"), "utf8");
  const code = html.slice(html.indexOf("/* ---------- matching ---------- */"), html.indexOf("/* ---------- the session ---------- */"));
  const L = vm.runInNewContext(code + "; ({ score: score, scoreFree: scoreFree, same: same })",
    { LOCI_WORDS: require("../apps/loci/words.js") });
  const list = ["dragon", "gnome", "knight", "fire"].map((word) => ({ word }));

  const back = L.scoreFree(list, ["fire", "knight", "gnome", "dragon"]);
  assert.ok(back.perfect && back.recalled === 4, "every word, written backwards, is not a perfect list");
  assert.ok(!L.score(list, ["fire", "knight", "gnome", "dragon"]).perfect, "in order, backwards should not be perfect");

  const again = L.scoreFree(list, ["fire", "fire", "fire", "pizza"]);
  assert.strictEqual(again.recalled, 1, "a word typed three times counted more than once");
  assert.deepStrictEqual([...again.wrong], ["pizza"], "a repeat was named as a word never shown, or the stranger was not");

  /* An exact spelling is not lost to a slip that also fits it: "witer" is one
     letter from both "water" and "wider", and typed first it would take
     "water" from the exact "water" typed after it, which is two letters from
     "wider" and would then find nothing. */
  const slips = L.scoreFree([{ word: "water" }, { word: "wider" }], ["witer", "water"]);
  assert.strictEqual(slips.recalled, 2, "a slip took the place of an exact spelling");
});

/*
 * Loci Span's typos: a slip is forgiven where it cannot be another word —
 * by length, and never when what was typed is itself a word of the lists.
 */
test("Loci Span forgives typos, swapped letters included, but not another word", () => {
  const vm = require("vm");
  const html = readFileSync(path.join(__dirname, "..", "apps", "loci", "index.html"), "utf8");
  const code = html.slice(html.indexOf("/* ---------- matching ---------- */"), html.indexOf("/* ---------- the session ---------- */"));
  const L = vm.runInNewContext(code + "; ({ same: same, scoreFree: scoreFree })", { LOCI_WORDS: require("../apps/loci/words.js") });
  for (const [typed, word] of [["fier", "fire"], ["Fire!", "fire"], ["dragons", "dragon"], ["lighthose", "lighthouse"], ["ligthose", "lighthouse"], ["gnmoe", "gnome"]]) {
    assert.ok(L.same(typed, word), `"${typed}" is not forgiven as ${word}`);
  }
  for (const [typed, word] of [["bta", "bat"], ["skull", "skill"], ["vanity", "sanity"], ["attitude", "aptitude"], ["ligthos", "lighthouse"], ["knight", ""]]) {
    assert.ok(!L.same(typed, word), `"${typed}" was taken for ${word}`);
  }
  const r = L.scoreFree([{ word: "fire" }, { word: "lighthouse" }], ["ligthose", "fier"]);
  assert.ok(r.perfect, "two typos, in any order, did not make a perfect list");
  assert.deepStrictEqual([...r.as], ["fier", "ligthose"], "what was typed for each word was not kept to show");
});

/*
 * Loci Span in German: the same five tiers, each word in one, enough of each
 * for a session; and the matcher folds umlauts, so "Baer" is Bär.
 */
test("Loci Span's German lists, and umlauts typed either way", () => {
  const W = require("../apps/loci/words-de.js");
  const where = new Map();
  for (const level of [1, 2, 3, 4, 5]) {
    const t = W.tiers[level];
    assert.ok(t.words.length >= 100, `German tier ${level} has only ${t.words.length} words`);
    for (const w of t.words) {
      assert.ok(/^[a-zäöü]+$/.test(w), `"${w}" is not one lower-case German word without ß`);
      assert.ok(!where.has(w), `"${w}" is in German tiers ${where.get(w)} and ${level}`);
      where.set(w, level);
    }
  }
  const vm = require("vm");
  const html = readFileSync(path.join(__dirname, "..", "apps", "loci", "index.html"), "utf8");
  const code = html.slice(html.indexOf("/* ---------- matching ---------- */"), html.indexOf("/* ---------- the session ---------- */"));
  const L = vm.runInNewContext(code + "; ({ same: same })", { LOCI_WORDS: require("../apps/loci/words.js"), LOCI_WORDS_DE: W });
  for (const [typed, word] of [["Baer", "Bär"], ["bär", "Bär"], ["Tuer", "Tür"], ["Krokodiel", "Krokodil"], ["Schmetterlnig", "Schmetterling"]]) {
    assert.ok(L.same(typed, word), `"${typed}" is not taken as ${word}`);
  }
  assert.ok(!L.same("Hai", "Hut"), "a different short word was forgiven");
});

/*
 * Synaesthesia in German: Ä Ö Ü each take their base letter's colour a shade
 * off, the 36 colours already learned are not touched, and the German words
 * and phrases are all writable with the symbols there are.
 */
test("Synaesthesia's German keeps the palette and shades the umlauts off their letters", () => {
  const vm = require("vm");
  const html = readFileSync(path.join(__dirname, "..", "apps", "synth", "index.html"), "utf8");
  const pick = (from, to) => html.slice(html.indexOf(from), html.indexOf(to));
  const ctx = { Math, Set };
  vm.runInNewContext(pick("const LETTERS =", "/* Label for a symbol's colour") + "; this.DC = DEFAULT_COLORS; this.shade = umlautShade;", ctx);
  const was = { A: "255,0,0", O: "255,162,0", U: "242,242,131", Z: "131,131,131", "0": "0,0,0" };
  for (const [k, v] of Object.entries(was)) assert.strictEqual(ctx.DC[k], v, `${k} changed colour`);
  assert.strictEqual(Object.keys(ctx.DC).length, 39, "not 36 colours and three umlauts");
  const hue = (rgb) => { const [r, g, b] = rgb.split(",").map(Number); return Math.atan2(Math.sqrt(3) * (g - b), 2 * r - g - b); };
  for (const [u, base] of [["Ä", "A"], ["Ö", "O"], ["Ü", "U"]]) {
    assert.notStrictEqual(ctx.DC[u], ctx.DC[base], `${u} is ${base}'s colour exactly`);
    assert.ok(Math.abs(hue(ctx.DC[u]) - hue(ctx.DC[base])) < 0.05, `${u} is not ${base}'s hue`);
  }

  const D = require("../apps/synth/words-de.js");
  for (const w of D.words) assert.ok(/^[A-Za-zÄÖÜäöü]+$/.test(w), `German word "${w}" has a symbol the trainer has not got`);

  /* The phrases, from the page's own grammar, in both languages. */
  for (const lang of ["en", "de"]) {
    const g = { Math, Set, SYNTH_DE: D, german: () => lang === "de", streak: 0, LEXICON: { 5: ["x"] } };
    vm.runInNewContext(pick("/* ---- Sentence grammar", "const RANKS").replace(/^(const|let) /gm, "var ") + "; this.draw = drawSentence;", g);
    const seen = [];
    for (let i = 0; i < 400; i++) {
      const p = g.draw();
      assert.ok(/^[A-Za-zÄÖÜäöü ]+$/.test(p), `${lang} phrase "${p}" has a symbol the trainer has not got`);
      assert.ok(p.length >= 16 && p.length <= 46, `${lang} phrase "${p}" is outside the length window`);
      /* A weak masculine after den or dem takes -en: "den Kometen", not "den Komet". */
      if (lang === "de") assert.ok(!/\b(den|dem|Im)( [a-zäöü]+)? (Komet|Obelisk|Falke|Astronom|Philosoph|Alchemist|Kartograf|Sextant)\b/.test(p), `"${p}" leaves a weak noun bare`);
      seen.push(p);
    }
    assert.ok(new Set(seen).size >= 395, `${lang}: only ${new Set(seen).size} distinct phrases in 400`);
  }

  /* Word mode: advanced vocabulary only, short at the start of a streak and
     long further in — read through the mode's own call, not just the drawer. */
  assert.ok(/mode === 'game-word'\)\s+qTyping\(drawAdvancedWord\(\)\)/.test(html), "word mode does not draw advanced vocabulary");
  for (const lang of ["en", "de"]) {
    const lengths = (streak) => {
      const g = { Math, Set, SYNTH_DE: D, german: () => lang === "de", streak, LEXICON: { 5: ["x"] } };
      vm.runInNewContext(pick("/* ---- Sentence grammar", "const RANKS").replace(/^(const|let) /gm, "var ") + "; this.draw = drawAdvancedWord; this.ADV = ADVANCED_EN;", g);
      const words = Array.from({ length: 200 }, () => g.draw());
      for (const w of words) assert.ok(/^[A-Za-zÄÖÜäöü]{5,16}$/.test(w), `${lang} word mode drew "${w}"`);
      if (lang === "en") assert.ok(words.some((w) => g.ADV.includes(w)), "word mode never drew from the advanced list");
      return words.map((w) => w.length);
    };
    assert.ok(Math.max(...lengths(0)) <= 7, `${lang}: a fresh streak already draws long words`);
    assert.ok(Math.max(...lengths(30)) >= 11, `${lang}: a long streak never reaches long words`);
  }
});

/*
 * Synaesthesia's time window pays for every symbol, a repeat at half, and
 * typing on top. It used to pay distinct symbols only, so a long phrase
 * earned what a short word did and timed out however well it was read.
 */
test("Synaesthesia's window grows with every symbol of a phrase, not only the distinct ones", () => {
  const vm = require("vm");
  const html = readFileSync(path.join(__dirname, "..", "apps", "synth", "index.html"), "utf8");
  const code = html.slice(html.indexOf("/* Every symbol in the current question"), html.indexOf("function startTimer"));
  const g = { Math, Set, String, accOf: () => 0.8, seenOf: () => 10, cur: null, maxTime: 800,
    modeCfg: { kind: "typing", base: 5000 } };
  vm.runInNewContext(code.replace(/^const /gm, "var ") + "; this.win = windowFor; this.demand = itemDemand;", g);
  const win = (text) => { g.cur = { answer: text, meta: null }; return g.win(); };

  assert.ok(win("abcabc") > win("abc"), "repeating letters bought no time");
  assert.ok(win("abcabc") - win("abc") < win("abcdef") - win("abc"), "a repeat cost as much as a new letter");
  const phrase = "Through ingenuity we reconcile the vineyards";
  /* Distinct letters and typing alone: what the old window paid, plus typing. Repeats must add to it. */
  const distinct = new Set(phrase.toUpperCase().replace(/[^A-Z]/g, "")).size;
  const alone = 5000 + 800 * distinct + phrase.length * 220;
  assert.ok(win(phrase) > alone, `a ${phrase.length}-character phrase gets ${win(phrase)} ms, no more than its ${distinct} distinct letters and typing (${alone})`);
  assert.ok(win(phrase) <= 120000, "the window has no ceiling");
  /* Typing is paid only where something is typed. */
  g.modeCfg = { kind: "quiz", base: 400 };
  g.cur = { answer: "A", meta: { char: "A" } };
  assert.strictEqual(g.win(), 400 + 800, "a single symbol is paid exactly one unit, no typing");
});

/*
 * The trainers that wear the hub's look over their own: each carries a
 * hub-skin.css, and it only works loaded last — the skin redefines the page's
 * own tokens, and a page style after it would quietly win them back. The
 * colour slider reaches them through theme.js, at a depth that differs for
 * apps/more.
 */
test("every skinned trainer loads its hub skin after its own styles, and the hub's colour", () => {
  for (const app of ["cct", "rrt", "vmt", "relations", "listening", "more/dorsalflow"]) {
    const dir = path.join(__dirname, "..", "apps", app);
    const html = readFileSync(path.join(dir, "index.html"), "utf8");
    const head = html.slice(0, html.indexOf("</head>"));
    const skin = head.search(/<link[^>]*href="(\.\/)?hub-skin\.css"/);
    assert.ok(skin >= 0, `${app} does not load hub-skin.css in its head`);
    readFileSync(path.join(dir, "hub-skin.css"), "utf8");

    const later = head.slice(skin + 1);
    assert.ok(!/<style|<link[^>]*stylesheet/.test(later.slice(later.indexOf(">"))),
      `${app} has a stylesheet after hub-skin.css, which would win back what the skin set`);

    const theme = html.match(/<script src="([^"]*shared\/theme\.js)[^"]*"/);
    assert.ok(theme, `${app} does not load the hub's colour`);
    /* Resolved as the built site lays it out: apps/<app> becomes <app>, and
       the site's shared/ is this repo's. */
    readFileSync(path.join(__dirname, "..", app, theme[1]), "utf8");
    assert.ok(/HubTheme\.follow\(/.test(html), `${app} loads theme.js and never follows it`);
  }
});

/* ------------------------------------------------------------------ */

for (const [name, fn] of cases) {
  try { fn(); passed++; console.log(`  ok  ${name}`); }
  catch (e) { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; }
}
console.log(`\n${passed}/${cases.length} passed`);
