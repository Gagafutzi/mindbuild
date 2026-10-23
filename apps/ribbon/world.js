"use strict";
/*
 * Ribbon World: the engine. No page code, so it runs (and is tested) in Node
 * as well as in the trainer.
 *
 * ── The world ──
 *
 * Two loops, side by side, touching at one point: the Gate. Flat shapes ride
 * round them one slot per tick. Along each loop sit fixtures, and a shape
 * passing one is changed by it:
 *
 *   mirror   the twist: a half-twisted band hands a flat shape back as its
 *            mirror image, which is the one thing a Möbius strip does to
 *            something living in it
 *   cw, ccw  a turnstile: a quarter turn, clockwise or anticlockwise
 *   half     a half turn
 *
 * At the Gate, shapes of one kind cross to the other loop and the rest stay
 * on their own. Which kind crosses is the world's rule: one hand (the shape
 * or its mirror image), or one axis (lying along the loop or across it). The
 * Gate is sometimes shut, and then nothing crosses.
 *
 * Crossing rather than sorting is deliberate. A Gate that sent each hand to
 * a loop of its own would empty the twisted loop within a lap or two — a
 * shape on the plain loop never changes hand, so it would never be sent
 * back — and every question after that would be "it stays where it is".
 * With crossing, a shape is mirrored on one loop, crosses, crosses back, and
 * the two loops keep trading.
 *
 * An orientation is one of the square's eight symmetries, kept as a 2×2
 * integer matrix acting on the shape's cells in screen coordinates (y down).
 * Its determinant is its hand: -1 is the mirror image of the shape as drawn.
 * The shapes have no symmetry of their own, so all eight look different.
 *
 * ── An episode ──
 *
 *   clip        a run of the world long enough that every fixture has been
 *               seen to act and only one Gate rule fits what the Gate did
 *   predict     ×2: where and how a shape will be the h-th time it leaves the
 *               Gate, from four pictures; three are the answers of particular
 *               mistakes (a fixture forgotten, a mirror taken for a half turn,
 *               the Gate's rule ignored, the wrong loop)
 *   impossible  four frames of one shape's trip, each with the path since the
 *               last; one frame has been altered, and only one frame's removal
 *               leaves a trip that could have happened
 *   fog         a shape goes into fog over the Gate; which loop is it on, and
 *               how sure? Sure when it was never going to cross; otherwise as
 *               sure as the Gate is often open, which the clip showed
 *   analogy     a second world drawn differently, run on the same rules or
 *               with one structural change; same or different?
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Ribbon = factory();
})(typeof self !== "undefined" ? self : this, function () {

  /* ---- randomness ---- */

  function Rng(seed) {
    var s = seed >>> 0;
    return {
      next: function () {
        s = (s + 0x6D2B79F5) >>> 0;
        var t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      },
    };
  }
  function int(rng, a, b) { return a + Math.floor(rng.next() * (b - a + 1)); }
  function pick(rng, arr) { return arr[Math.floor(rng.next() * arr.length)]; }
  function shuffle(rng, arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rng.next() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  /* ---- orientations ---- */

  /** (x, y) → (a x + b y, c x + d y), screen coordinates. */
  var I = [1, 0, 0, 1];
  /** m ∘ n: n first, then m. */
  function mul(m, n) {
    return [m[0] * n[0] + m[1] * n[2], m[0] * n[1] + m[1] * n[3],
            m[2] * n[0] + m[3] * n[2], m[2] * n[1] + m[3] * n[3]];
  }
  function det(m) { return m[0] * m[3] - m[1] * m[2]; }
  function same(m, n) { return m[0] === n[0] && m[1] === n[1] && m[2] === n[2] && m[3] === n[3]; }
  /** The shape's long axis runs down the screen when drawn as is, so it still
      does exactly when (0, 1) goes to (0, ±1). */
  function upright(m) { return m[1] === 0; }

  var OPS = {
    mirror: [-1, 0, 0, 1],
    cw: [0, -1, 1, 0],          // (x, y) → (−y, x): right goes to down
    ccw: [0, 1, -1, 0],
    half: [-1, 0, 0, -1],
  };
  var ROTATIONS = ["cw", "ccw", "half"];
  /** What each change is most easily taken for. */
  var CONFUSE = { mirror: "half", half: "mirror", cw: "ccw", ccw: "cw" };

  var ALL = (function () {
    var out = [], r = I;
    for (var k = 0; k < 4; k++) { out.push(r); out.push(mul(OPS.mirror, r)); r = mul(OPS.cw, r); }
    return out;
  })();

  /* ---- shapes as drawn ---- */

  /** Cell centres, about the shape's middle; long axis down the screen. */
  var GLYPHS = {
    L: [[-0.5, -1], [-0.5, 0], [-0.5, 1], [0.5, 1]],
    Y: [[0, -1.5], [0, -0.5], [0, 0.5], [0, 1.5], [1, -0.5]],
  };
  function cells(glyph, m) {
    return GLYPHS[glyph].map(function (c) { return [m[0] * c[0] + m[1] * c[1], m[2] * c[0] + m[3] * c[1]]; });
  }

  /* ---- the Gate ---- */

  /** Does this orientation cross, under this rule? */
  function crosses(rule, m) {
    return rule.kind === "hand" ? det(m) === rule.value : upright(m) === rule.value;
  }
  function rulesFor(kinds) {
    var out = [];
    if (kinds.indexOf("hand") >= 0) out.push({ kind: "hand", value: 1 }, { kind: "hand", value: -1 });
    if (kinds.indexOf("axis") >= 0) out.push({ kind: "axis", value: true }, { kind: "axis", value: false });
    return out;
  }
  function sameRule(a, b) { return a.kind === b.kind && a.value === b.value; }

  /* ---- difficulty ---- */

  function params(level) {
    var L = Math.max(1, Math.round(level));
    return {
      level: L,
      shapes: L >= 8 ? 4 : L >= 3 ? 3 : 2,
      turnstile: L >= 2,
      rotations: L >= 5 ? ROTATIONS : ["cw"],
      gateKinds: L >= 5 ? ["hand", "axis"] : ["hand"],
      extra: L >= 10 ? 2 : L >= 6 ? 1 : 0,
      horizon: L >= 10 ? 3 : L >= 4 ? 2 : 1,
      coverage: L >= 7 ? 1 : 2,
      icons: L < 9,
      flash: L < 11,
      tickMs: L >= 11 ? 450 : L >= 7 ? 550 : 650,
    };
  }

  /* ---- worlds ---- */

  function freeSlot(rng, loop, lo, hi) {
    for (var tries = 0; tries < 40; tries++) {
      var at = int(rng, lo, hi);
      if (loop.fixtures.every(function (f) { return Math.abs(f.at - at) >= 2; })) return at;
    }
    return null;
  }

  /**
   * Loop 0 carries the twist, loop 1 the turnstile, and extras go anywhere.
   * Fixtures sit between slot `at` and `at + 1`, never on either side of the
   * Gate (slot 0), so what crosses is what arrived.
   */
  function makeWorld(rng, P, sizes) {
    sizes = sizes || [14, 10];
    var loops = sizes.map(function (n) { return { n: n, fixtures: [] }; });
    loops[0].fixtures.push({ at: int(rng, 3, sizes[0] - 3), op: "mirror" });
    if (P.turnstile) loops[1].fixtures.push({ at: int(rng, 2, sizes[1] - 3), op: pick(rng, P.rotations) });
    for (var e = 0; e < P.extra; e++) {
      var li = int(rng, 0, 1), at = freeSlot(rng, loops[li], 1, loops[li].n - 2);
      if (at !== null) loops[li].fixtures.push({ at: at, op: pick(rng, ["mirror"].concat(P.rotations)) });
    }
    loops.forEach(function (l) { l.fixtures.sort(function (a, b) { return a.at - b.at; }); });
    var kind = pick(rng, P.gateKinds);
    var rule = kind === "hand" ? { kind: "hand", value: pick(rng, [1, -1]) } : { kind: "axis", value: pick(rng, [true, false]) };
    var pOpen = Math.round((0.55 + rng.next() * 0.35) * 20) / 20;
    var taken = {}, shapes = [];
    for (var i = 0; i < P.shapes; i++) {
      var loop, slot;
      do { loop = int(rng, 0, 1); slot = int(rng, 1, loops[loop].n - 1); } while (taken[loop + ":" + slot]);
      taken[loop + ":" + slot] = true;
      shapes.push({ loop: loop, slot: slot, m: pick(rng, ALL) });
    }
    return { loops: loops, rule: rule, pOpen: pOpen, shapes: shapes };
  }

  function copyShape(s) { return { loop: s.loop, slot: s.slot, m: s.m.slice() }; }

  /**
   * One tick for one shape. `open` is the Gate this tick. `variant`, for the
   * answers of mistakes: `op(op, k)` replaces a fixture's change (null skips
   * it), `cross(m)` replaces the rule.
   */
  function advance(world, s, open, variant) {
    var out = copyShape(s), events = [];
    if (s.slot === 0) {
      var wants = variant && variant.cross ? variant.cross(s.m) : crosses(world.rule, s.m);
      var go = open && wants;
      events.push({ kind: "gate", loop: s.loop, wants: wants, open: open, crossed: go });
      if (go) out.loop = 1 - s.loop;
      out.slot = 1;
      return { shape: out, events: events };
    }
    var loop = world.loops[s.loop];
    loop.fixtures.forEach(function (f, fi) {
      if (f.at !== s.slot) return;
      var op = variant && variant.op ? variant.op(f.op, events.length) : f.op;
      events.push({ kind: "fixture", loop: s.loop, at: f.at, index: fi, op: f.op, applied: op });
      if (op) out.m = mul(OPS[op], out.m);
    });
    out.slot = (s.slot + 1) % loop.n;
    return { shape: out, events: events };
  }

  /* ---- the clip ---- */

  /**
   * Frames of the whole world. `frames[t].open` is the Gate for the tick
   * *after* frame t — what a shape standing on it is about to meet — and
   * `frames[t].events` what happened on the way into frame t.
   *
   * Long enough that every fixture has acted `coverage` times, a shape has
   * been seen to cross, one to stay at an open Gate, one to be held by a shut
   * one, and only one of `candidates` fits every open-Gate decision. Null
   * when the world will not show all that within the limit.
   */
  function makeClip(rng, world, coverage, candidates, minTicks, maxTicks) {
    minTicks = minTicks || 16; maxTicks = maxTicks || 70;
    var shapes = world.shapes.map(copyShape);
    var fired = world.loops.map(function (l) { return l.fixtures.map(function () { return 0; }); });
    var seen = [], blocked = 0, crossed = 0, stayed = 0;
    var open = rng.next() < world.pOpen;
    var frames = [{ shapes: shapes.map(copyShape), open: open, events: [] }];
    for (var t = 1; t <= maxTicks; t++) {
      var events = [];
      shapes = shapes.map(function (s, i) {
        var r = advance(world, s, open);
        r.events.forEach(function (e) {
          e.shape = i;
          events.push(e);
          if (e.kind === "fixture") fired[e.loop][e.index]++;
          if (e.kind === "gate") {
            if (e.open) { seen.push({ m: s.m, crossed: e.crossed }); if (e.crossed) crossed++; else stayed++; }
            else if (e.wants) blocked++;
          }
        });
        return r.shape;
      });
      open = rng.next() < world.pOpen;
      frames.push({ shapes: shapes.map(copyShape), open: open, events: events });
      var covered = fired.every(function (l) { return l.every(function (c) { return c >= coverage; }); })
        && crossed > 0 && stayed > 0 && blocked > 0
        && fitting(seen, candidates).length === 1;
      if (t >= minTicks && covered) return { frames: frames, fits: fitting(seen, candidates) };
    }
    return null;
  }

  /** The rules among `candidates` that every open-Gate decision agrees with. */
  function fitting(seen, candidates) {
    return candidates.filter(function (r) {
      return seen.every(function (x) { return crosses(r, x.m) === x.crossed; });
    });
  }

  /* ---- predict ---- */

  /** Run one shape, Gate open, until it has left the Gate `h` times. */
  function exitAfter(world, s, h, variant) {
    var cur = copyShape(s), exits = 0, trip = [];
    for (var guard = 0; guard < 400 && exits < h; guard++) {
      var r = advance(world, cur, true, variant);
      r.events.forEach(function (e) { trip.push(e); if (e.kind === "gate") exits++; });
      cur = r.shape;
    }
    return { shape: cur, trip: trip };
  }
  function stateKey(s) { return s.loop + ":" + s.m.join(","); }

  function predictQuestion(rng, world, now, i, h) {
    var truth = exitAfter(world, now[i], h);
    var right = { loop: truth.shape.loop, m: truth.shape.m };
    var lures = [
      { why: "forgot", variant: { op: (function () { var skipped = false; return function (op) { if (!skipped) { skipped = true; return null; } return op; }; })() } },
      { why: "confused", variant: { op: function (op) { return CONFUSE[op]; } } },
      { why: "never-crosses", variant: { cross: function () { return false; } } },
      { why: "always-crosses", variant: { cross: function () { return true; } } },
    ].map(function (l) {
      var r = exitAfter(world, now[i], h, l.variant);
      return { loop: r.shape.loop, m: r.shape.m, why: l.why };
    });
    lures.push({ loop: 1 - right.loop, m: right.m, why: "wrong-loop" });
    lures.push({ loop: right.loop, m: mul(OPS.mirror, right.m), why: "mirrored" });
    var options = [{ loop: right.loop, m: right.m, why: "right" }], keys = {};
    keys[stateKey(right)] = true;
    shuffle(rng, lures).forEach(function (l) {
      if (options.length < 4 && !keys[stateKey(l)]) { keys[stateKey(l)] = true; options.push(l); }
    });
    while (options.length < 4) {
      var o = { loop: int(rng, 0, 1), m: pick(rng, ALL), why: "random" };
      if (!keys[stateKey(o)]) { keys[stateKey(o)] = true; options.push(o); }
    }
    options = shuffle(rng, options);
    return {
      shape: i, horizon: h, options: options,
      answer: options.findIndex(function (o) { return o.why === "right"; }),
      trip: truth.trip,
    };
  }

  /* ---- impossible ---- */

  /** Does `b` follow from `a` along `len` ticks, Gate open? */
  function follows(world, a, b, len) {
    var cur = copyShape(a);
    for (var k = 0; k < len; k++) cur = advance(world, cur, true).shape;
    return cur.loop === b.loop && cur.slot === b.slot && same(cur.m, b.m);
  }

  function impossibleQuestion(rng, world, now, i) {
    var path = [copyShape(now[i])], evAt = [[]];
    for (var t = 1; t <= 60; t++) {
      var r = advance(world, path[t - 1], true);
      path.push(r.shape); evAt.push(r.events);
    }
    var maxLen = Math.min(world.loops[0].n, world.loops[1].n) - 1;
    var times = [0];
    for (var j = 0; j < 3; j++) {
      var t0 = times[times.length - 1], ok = [];
      for (var len = 3; len <= maxLen; len++) {
        var any = false;
        for (var k = t0 + 1; k <= t0 + len; k++) if (evAt[k].length) any = true;
        if (any) ok.push(len);
      }
      if (!ok.length) return null;
      times.push(t0 + pick(rng, ok));
    }
    var frames = times.map(function (t, j) {
      var trail = [];
      if (j > 0) for (var k = times[j - 1]; k <= t; k++) trail.push({ loop: path[k].loop, slot: path[k].slot });
      return { loop: path[t].loop, slot: path[t].slot, m: path[t].m.slice(), trail: trail, ticks: j ? t - times[j - 1] : 0 };
    });
    var wrong = int(rng, 1, 3);
    var passed = [];
    for (var k2 = times[wrong - 1] + 1; k2 <= times[wrong]; k2++) evAt[k2].forEach(function (e) { if (e.kind === "fixture") passed.push(e.op); });
    var alteration = passed.length ? CONFUSE[pick(rng, passed)] : pick(rng, ["mirror", "cw", "half"]);
    var altered = mul(OPS[alteration], frames[wrong].m);
    if (same(altered, frames[wrong].m)) return null;
    frames[wrong].was = frames[wrong].m;
    frames[wrong].m = altered;
    return { shape: i, frames: frames, wrong: wrong, alteration: alteration };
  }

  /** The frames whose removal leaves a trip that could have happened. */
  function removable(world, q) {
    var out = [];
    for (var drop = 1; drop < q.frames.length; drop++) {
      var kept = q.frames.filter(function (f, j) { return j !== drop; });
      var lens = [];
      for (var j = 1; j < q.frames.length; j++) {
        if (j === drop) continue;
        lens.push(q.frames[j].ticks + (j === drop + 1 ? q.frames[drop].ticks : 0));
      }
      var fine = true;
      for (var k = 1; k < kept.length; k++) if (!follows(world, kept[k - 1], kept[k], lens[k - 1])) fine = false;
      if (fine) out.push(drop);
    }
    return out;
  }

  /* ---- fog ---- */

  /** The slots the fog covers on each loop: the Gate and a slot either side. */
  function fogged(world, loop, slot) {
    return slot === world.loops[loop].n - 1 || slot === 0 || slot === 1;
  }

  function fogQuestion(rng, world, now) {
    var want = rng.next() < 0.6, best = null;
    shuffle(rng, now.map(function (s, i) { return i; })).forEach(function (i) {
      var s = now[i], n = world.loops[s.loop].n;
      if (best || s.slot < 2 || s.slot > n - 2) return;
      var toGate = n - s.slot, cur = copyShape(s);
      for (var k = 0; k < toGate; k++) cur = advance(world, cur, true).shape;
      if (crosses(world.rule, cur.m) === want) best = { i: i, toGate: toGate };
    });
    if (!best) return null;
    var shapes = now.map(copyShape), frames = [{ shapes: shapes.map(copyShape) }];
    var ticks = best.toGate + 1, gateOpen = null, wants = null;
    for (var t = 0; t < ticks; t++) {
      var open = rng.next() < world.pOpen;
      shapes = shapes.map(function (s, j) {
        var r = advance(world, s, open);
        if (j === best.i) r.events.forEach(function (e) { if (e.kind === "gate") { gateOpen = e.open; wants = e.wants; } });
        return r.shape;
      });
      frames.push({ shapes: shapes.map(copyShape) });
    }
    return {
      shape: best.i, frames: frames, startLoop: now[best.i].loop,
      outcome: shapes[best.i].loop, wants: wants, open: gateOpen,
      /** The chance it crossed, as the world stands: what a perfect judge would say. */
      pCross: wants ? world.pOpen : 0,
    };
  }

  /* ---- analogy ---- */

  var CHANGES = {
    "twist-turns": "the twist turns shapes a quarter instead of mirroring them",
    "turnstile-mirrors": "the turnstile mirrors shapes instead of turning them",
    "quarter-half": "a turnstile turns shapes half way round instead of a quarter",
    "half-quarter": "a turnstile turns shapes a quarter instead of half way round",
    "gate-axis": "the Gate goes by which way a shape lies, not by its hand",
    "gate-hand": "the Gate goes by a shape's hand, not by which way it lies",
    "missing": "one of the fixtures is not there",
  };

  /**
   * The same structure in new positions and sizes, or that with one change
   * that no relabelling can undo. Turning clockwise against anticlockwise is
   * never the change: mirroring the whole world swaps them, and the Gate's
   * hand with them, so that difference is not one of structure.
   */
  function analogyQuestion(rng, world, P) {
    var same = rng.next() < 0.5;
    var sizes = [int(rng, 9, 11), int(rng, 8, 10)];
    var loops = sizes.map(function (n) { return { n: n, fixtures: [] }; });
    world.loops.forEach(function (l, li) {
      l.fixtures.forEach(function (f) {
        var at = freeSlot(rng, loops[li], 2, loops[li].n - 2);
        if (at === null) at = freeSlot(rng, loops[li], 1, loops[li].n - 2);
        loops[li].fixtures.push({ at: at, op: f.op });
      });
    });
    if (loops.some(function (l) { return l.fixtures.some(function (f) { return f.at === null; }); })) return null;
    var rule = { kind: world.rule.kind, value: world.rule.value }, change = null;
    if (!same) {
      var options = [];
      loops.forEach(function (l, li) {
        l.fixtures.forEach(function (f, fi) {
          if (f.op === "mirror") options.push({ id: "twist-turns", apply: function () { loops[li].fixtures[fi].op = pick(rng, ["cw", "ccw"]); } });
          else options.push({ id: "turnstile-mirrors", apply: function () { loops[li].fixtures[fi].op = "mirror"; } });
          if (f.op === "half") options.push({ id: "half-quarter", apply: function () { loops[li].fixtures[fi].op = pick(rng, ["cw", "ccw"]); } });
          if (f.op === "cw" || f.op === "ccw") options.push({ id: "quarter-half", apply: function () { loops[li].fixtures[fi].op = "half"; } });
        });
      });
      options.push(rule.kind === "hand"
        ? { id: "gate-axis", apply: function () { rule = { kind: "axis", value: pick(rng, [true, false]) }; } }
        : { id: "gate-hand", apply: function () { rule = { kind: "hand", value: pick(rng, [1, -1]) }; } });
      var count = loops[0].fixtures.length + loops[1].fixtures.length;
      if (count >= 3) options.push({ id: "missing", apply: function () {
        var li = loops[1].fixtures.length > 1 ? 1 : 0;
        loops[li].fixtures.splice(int(rng, 0, loops[li].fixtures.length - 1), 1);
      } });
      var c = pick(rng, options);
      c.apply();
      change = c.id;
    }
    loops.forEach(function (l) { l.fixtures.sort(function (a, b) { return a.at - b.at; }); });
    var w2 = { loops: loops, rule: rule, pOpen: Math.max(world.pOpen, 0.75), shapes: [] };
    var taken = {};
    for (var i = 0; i < Math.max(3, P.shapes); i++) {
      var lp, sl;
      do { lp = int(rng, 0, 1); sl = int(rng, 1, loops[lp].n - 1); } while (taken[lp + ":" + sl]);
      taken[lp + ":" + sl] = true;
      w2.shapes.push({ loop: lp, slot: sl, m: pick(rng, ALL) });
    }
    var clip = makeClip(rng, w2, 1, rulesFor(["hand", "axis"]), 14, 70);
    if (!clip) return null;
    return { world: w2, clip: clip, same: same, change: change };
  }

  /** Is the structure the same: each loop's changes, as a set, and the Gate's kind? */
  function sameStructure(a, b) {
    function sig(w) {
      var loops = w.loops.map(function (l) {
        return l.fixtures.map(function (f) { return f.op === "ccw" ? "cw" : f.op; }).sort().join("+");
      }).sort();
      return loops.join("|") + "/" + w.rule.kind;
    }
    return sig(a) === sig(b);
  }

  /* ---- the episode ---- */

  function makeEpisode(rng, P) {
    for (var tries = 0; tries < 200; tries++) {
      var world = makeWorld(rng, P);
      var clip = makeClip(rng, world, P.coverage, rulesFor(P.gateKinds));
      if (!clip) continue;
      var now = clip.frames[clip.frames.length - 1].shapes;
      var order = shuffle(rng, now.map(function (s, i) { return i; }));
      var predicts = [predictQuestion(rng, world, now, order[0], P.horizon),
                      predictQuestion(rng, world, now, order[1], P.horizon)];
      var impossible = impossibleQuestion(rng, world, now, order[order.length > 2 ? 2 : 0]);
      var fog = fogQuestion(rng, world, now);
      var analogy = analogyQuestion(rng, world, P);
      if (!impossible || !fog || !analogy) continue;
      if (removable(world, impossible).length !== 1) continue;
      return { world: world, clip: clip, now: now, predicts: predicts, impossible: impossible, fog: fog, analogy: analogy };
    }
    throw new Error("Ribbon World: no episode could be made at level " + P.level);
  }

  return {
    Rng: Rng, OPS: OPS, ALL: ALL, GLYPHS: GLYPHS, CHANGES: CHANGES,
    mul: mul, det: det, same: same, upright: upright, cells: cells,
    crosses: crosses, rulesFor: rulesFor, sameRule: sameRule, params: params,
    makeWorld: makeWorld, advance: advance, makeClip: makeClip, fitting: fitting,
    exitAfter: exitAfter, predictQuestion: predictQuestion,
    impossibleQuestion: impossibleQuestion, removable: removable, follows: follows,
    fogged: fogged, fogQuestion: fogQuestion, analogyQuestion: analogyQuestion,
    sameStructure: sameStructure, makeEpisode: makeEpisode,
  };
});
