"use strict";
/*
 * Relation Algebra: glued spaces. Poses walked on a field whose edges are
 * joined, and joined in ways a flat grid cannot be. No page code, so it runs
 * (and is tested) in Node as well as in the trainer.
 *
 * ── The field ──
 *
 * A W×H field of squares, columns a.. from the west, rows 1.. from the south.
 * Each axis has its own seam, where the field's opposite edges are joined:
 *
 *   straight  ○  off the east edge, on at the west, the same row: a cylinder's
 *                seam; both axes straight make a torus
 *   twisted   ⋈  off the east edge, on at the west in the mirrored row (row r
 *                of H comes back as row H+1−r), and the walker comes back
 *                mirrored: its left and right are swapped, as for anything
 *                that goes once round a Möbius band
 *   sheet     ⁺  either seam may also lead onto the other of two sheets: the
 *                same field again, a second layer of the space
 *
 * One twisted axis makes a Klein bottle, two a projective plane; with a sheet
 * seam the space is two fields long in that direction. A field is drawn the
 * way topology draws a glued square: arrows on the joined edges, the same way
 * round for a straight seam and opposite ways for a twisted one.
 *
 * ── Walking ──
 *
 * The poses code, read in the walker's own frame: ^ v < > a step ahead,
 * back, left, right; q Q h a turn right, left, about. A mirrored walker's left
 * is the other side, and its right turn turns the other way: after a twisted
 * seam the same walk goes somewhere else. A walk can always be undone (reverse
 * it, swap ^ v, < >, q Q), so "X is Y walked w" can be stated either way.
 *
 * ── Tasks ──
 *
 *   where     a walk from Red: which of four poses does it end in?
 *   home      a walk from Red: home, back but mirrored, back but turned, away?
 *   drift     objects moving a step (or two) each tick by a velocity, which a
 *             twisted seam reflects. Where is one after k ticks, or do two
 *             ever land on the same square? From level 21 a velocity may be
 *             either/or, and "can't tell" is an answer
 *   space     walks and where they ended: which field is this? (the seams are
 *             not shown: they are what is being found)
 *   possible  a loop of walks between objects: can it close?
 *   transfer  Blue is Red walked w. As Blue is to Red, which pose is to Gold?
 *             The relation is the walk, in Gold's own frame and across Gold's
 *             seams, not the offset Red and Blue have on the page
 *
 * ── Traps ──
 *
 *   plain     every seam read as straight
 *   noHand    the square and the facing mirrored at a twist, the walker not
 *   portal    the change of sheet missed
 *   velocity  (drift) a position mirrored at a twist, its velocity not
 *   tick      (drift) one tick too few or too many
 *   screen    (transfer) the offset on the page copied instead of walked
 *   step, turn  one move changed
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./algebra.js"), require("./routes.js"));
  else root.Spaces = factory(root.Algebra, root.Routes);
})(typeof self !== "undefined" ? self : this, function (Algebra, Routes) {

  function int(rng, a, b) { return a + Math.floor(rng.next() * (b - a + 1)); }
  function pick(rng, arr) { return arr[Math.floor(rng.next() * arr.length)]; }
  function shuffle(rng, arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rng.next() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  var mod = function (a, m) { return ((a % m) + m) % m; };
  function attempt(fn, n) { for (var i = 0; i < (n || 400); i++) { var x = fn(); if (x) return x; } return null; }

  /* ------------------------------------------------------------------ *
   * The field                                                            *
   * ------------------------------------------------------------------ */

  /** Facings: 0 north, 1 east, 2 south, 3 west; y grows northwards. */
  var DIRS = [[0, 1], [1, 0], [0, -1], [-1, 0]];
  var COMPASS = ["north", "east", "south", "west"];
  var FACING_DIGIT = ["8", "6", "2", "4"];
  var COLS = "abcdefgh";

  function space(W, H, x, y) { return { W: W, H: H, x: x, y: y }; }
  function axis(twist, sheet) { return { twist: !!twist, sheet: !!sheet }; }
  function hasSheet(sp) { return sp.x.sheet || sp.y.sheet; }
  function spaceKey(sp) { return sp.W + "x" + sp.H + ":" + +sp.x.twist + +sp.x.sheet + +sp.y.twist + +sp.y.sheet; }

  function pose(x, y, f, m, s) { return { x: x, y: y, f: f, m: m || 0, s: s || 0 }; }
  function samePose(a, b) { return a.x === b.x && a.y === b.y && a.f === b.f && a.m === b.m && a.s === b.s; }
  function sameSquare(a, b) { return a.x === b.x && a.y === b.y && a.s === b.s; }
  function key(p) { return p.x + "," + p.y + "," + p.f + "," + p.m + "," + p.s; }
  function leftOf(p) { return p.m ? (p.f + 1) % 4 : (p.f + 3) % 4; }
  function rightOf(p) { return p.m ? (p.f + 3) % 4 : (p.f + 1) % 4; }

  /**
   * A unit move from (x, y) by d, over whatever seams it crosses. `opt.plain`
   * reads every seam as straight, `opt.noPortal` ignores the sheets. Returns
   * the square, which axes mirrored it, whether the sheet changed, and the
   * seams crossed (two only for a diagonal through a corner).
   */
  function cross(sp, x, y, d, opt) {
    opt = opt || {};
    var nx = x + d[0], ny = y + d[1], refl = [], sheet = false, seams = [];
    if (nx < 0 || nx >= sp.W) {
      nx = mod(nx, sp.W); seams.push("x");
      if (sp.x.twist && !opt.plain && ny >= 0 && ny < sp.H) { ny = sp.H - 1 - ny; refl.push("x"); }
      else if (sp.x.twist && !opt.plain) refl.push("x");
      if (sp.x.sheet && !opt.noPortal) sheet = !sheet;
    }
    if (ny < 0 || ny >= sp.H) {
      ny = mod(ny, sp.H); seams.push("y");
      if (sp.y.twist && !opt.plain) { nx = sp.W - 1 - nx; refl.push("y"); }
      if (sp.y.sheet && !opt.noPortal) sheet = !sheet;
    }
    return { x: nx, y: ny, refl: refl, sheet: sheet, seams: seams };
  }

  /** A facing seen in a mirror: an x seam mirrors north and south, a y seam east and west. */
  function reflectFacing(f, ax) { return ax === "x" ? (f % 2 === 0 ? (f + 2) % 4 : f) : (f % 2 === 1 ? (f + 2) % 4 : f); }

  /** One move. `opt.noHand`: a twist mirrors the square and the facing but not the walker. */
  function move(sp, p, c, opt) {
    opt = opt || {};
    if (c === "q") return { pose: pose(p.x, p.y, rightOf(p), p.m, p.s), step: null };
    if (c === "Q") return { pose: pose(p.x, p.y, leftOf(p), p.m, p.s), step: null };
    if (c === "h") return { pose: pose(p.x, p.y, (p.f + 2) % 4, p.m, p.s), step: null };
    var dirIx = c === "^" ? p.f : c === "v" ? (p.f + 2) % 4 : c === "<" ? leftOf(p) : c === ">" ? rightOf(p) : -1;
    if (dirIx < 0) throw new Error("not a move: " + c);
    var d = DIRS[dirIx], r = cross(sp, p.x, p.y, d, opt), f = p.f, m = p.m;
    r.refl.forEach(function (ax) { f = reflectFacing(f, ax); if (!opt.noHand) m = 1 - m; });
    var q = pose(r.x, r.y, f, m, r.sheet ? 1 - p.s : p.s);
    return { pose: q, step: { from: p, to: q, d: d, seams: r.seams, twist: r.refl.length > 0, sheet: r.sheet } };
  }

  /** Walk w from p: the end, every pose on the way, and each step with the seams it crossed. */
  function walk(sp, p, w, opt) {
    var cur = p, trail = [p], steps = [], crossings = [];
    for (var i = 0; i < w.length; i++) {
      var r = move(sp, cur, w[i], opt);
      if (r.step) { steps.push(r.step); if (r.step.seams.length) crossings.push(r.step); }
      cur = r.pose; trail.push(cur);
    }
    return { end: cur, trail: trail, steps: steps, crossings: crossings };
  }

  /** The shortest walk in the allowed moves from p to a pose passing `isTarget`,
      never stepping on a square in `avoid` (keys "x,y,s") unless it is the target. */
  function shortest(sp, p, isTarget, moves, opt, avoid) {
    var seen = {}, queue = [{ p: p, w: "" }];
    seen[key(p)] = true;
    while (queue.length) {
      var cur = queue.shift();
      if (isTarget(cur.p)) return cur.w;
      for (var i = 0; i < moves.length; i++) {
        var nx = move(sp, cur.p, moves[i], opt).pose, k = key(nx);
        if (avoid && avoid[nx.x + "," + nx.y + "," + nx.s] && !isTarget(nx)) continue;
        if (!seen[k]) { seen[k] = true; queue.push({ p: nx, w: cur.w + moves[i] }); }
      }
    }
    return null;
  }

  /** Out and back over the same squares comes home on any field, and tests nothing. */
  function retrace(sp, p, w) {
    var sq = [];
    walk(sp, p, w).trail.forEach(function (t) { var k = t.x + "," + t.y + "," + t.s; if (sq[sq.length - 1] !== k) sq.push(k); });
    for (var i = 0, j = sq.length - 1; i < j; i++, j--) if (sq[i] !== sq[j]) return false;
    return true;
  }

  /** Where a walk leaves the walker, as one of four: home, mirrored, turned, away. */
  function classify(sp, p, w, opt) {
    var e = walk(sp, p, w, opt).end;
    if (!sameSquare(e, p)) return "away";
    if (e.m !== p.m) return "mirrored";
    return e.f === p.f ? "home" : "turned";
  }

  /* ------------------------------------------------------------------ *
   * Difficulty                                                           *
   * ------------------------------------------------------------------ */

  /** Level 1..30 → the fields and the walks. */
  function difficulty(level) {
    var L = Math.max(1, Math.min(30, Math.round(level)));
    return {
      level: L,
      moves: "^qQ" + (L >= 5 ? "hv" : "") + (L >= 9 ? "<>" : ""),
      sizes: L < 8 ? [4] : L < 16 ? [4, 5] : [5, 6],
      bothTwisted: L >= 6,                  /* both seams may twist: a projective plane */
      sheets: L >= 10,                      /* a seam may lead onto the second sheet */
      twistedSheets: L >= 18,               /* … and twist on the way */
      minLen: 3 + Math.floor(L / 10),       /* moves in a walk: 3..6 at least */
      maxLen: 6 + Math.floor((L - 1) / 5),  /* … 6..11 at most */
      segMax: 3 + Math.floor(L / 8),        /* moves in one premise's walk */
      objects: L <= 8 ? 3 : L <= 18 ? 4 : 5,
      ticks: [2 + Math.floor(L / 8), 3 + Math.floor(L / 6)],
      movers: L < 12 ? 2 : 3,
      fast: L >= 14,                        /* velocities of two steps a tick */
      either: L >= 21,                      /* a velocity known only as one of two */
    };
  }
  function half(o) { return o.moves.indexOf("h") >= 0 ? "h" : "qq"; }

  /** A field for a level. At least one seam is twisted: that is what the task is about. */
  function randomSpace(rng, o) {
    var W = pick(rng, o.sizes), H = pick(rng, o.sizes), tx, ty;
    if (o.bothTwisted) { do { tx = rng.next() < 0.6; ty = rng.next() < 0.6; } while (!tx && !ty); }
    else { tx = rng.next() < 0.5; ty = !tx; }
    var sx = false, sy = false;
    if (o.sheets && rng.next() < 0.4) {
      var onX = rng.next() < 0.5, twisted = onX ? tx : ty;
      if (!twisted || o.twistedSheets) { if (onX) sx = true; else sy = true; }
    }
    return space(W, H, axis(tx, sx), axis(ty, sy));
  }
  /** Every field a level could make on these sides, for the space task's options. */
  function allSpaces(o, W, H) {
    var out = [];
    [false, true].forEach(function (tx) {
      [false, true].forEach(function (ty) {
        out.push(space(W, H, axis(tx, false), axis(ty, false)));
        if (o.sheets) {
          if (!tx || o.twistedSheets) out.push(space(W, H, axis(tx, true), axis(ty, false)));
          if (!ty || o.twistedSheets) out.push(space(W, H, axis(tx, false), axis(ty, true)));
        }
      });
    });
    return out;
  }
  function randomStart(rng, sp, sheet) { return pose(int(rng, 0, sp.W - 1), int(rng, 0, sp.H - 1), int(rng, 0, 3), 0, sheet || 0); }

  var WEIGHT = { "^": 6, v: 1, "<": 1, ">": 1, q: 2, Q: 2, h: 1 };
  function randomWalk(rng, o, lo, hi) {
    var pool = [];
    o.moves.split("").forEach(function (c) { for (var i = 0; i < WEIGHT[c]; i++) pool.push(c); });
    return attempt(function () {
      var len = int(rng, lo, hi), w = "";
      while (w.length < len) w += pick(rng, pool);
      w = Routes.normalize(w, half(o));
      return w.length >= lo && w.length <= hi && /[\^v<>]/.test(w) ? w : null;
    }, 60);
  }
  /** A walk from p that goes over a seam that matters, a twist or a sheet, and, when
      `hand` is given, ends with that hand (0 as it started, 1 mirrored). */
  function seamWalk(rng, o, sp, p, lo, hi, hand) {
    return attempt(function () {
      var w = randomWalk(rng, o, lo, hi);
      if (!w) return null;
      var r = walk(sp, p, w);
      if (hand !== undefined && r.end.m !== (p.m ^ hand)) return null;
      return r.crossings.some(function (c) { return c.twist || c.sheet; }) ? w : null;
    }, 300);
  }
  /** Mirrored at the end or not, even odds: walks that must cross a twist would otherwise
      end mirrored four times in five, and "pick a mirrored option" would pay. */
  function handWanted(rng) { return rng.next() < 0.5 ? 1 : 0; }
  /** One move changed: a turn the other way, or a step added or dropped. */
  function perturb(rng, w, o) {
    var i = int(rng, 0, w.length - 1), c = w[i];
    if (c === "q" || c === "Q") return { w: w.slice(0, i) + (c === "q" ? "Q" : "q") + w.slice(i + 1), kind: "turn" };
    if ("^v<>".indexOf(c) >= 0 && w.replace(/[^\^v<>]/g, "").length > 1 && rng.next() < 0.5) return { w: Routes.normalize(w.slice(0, i) + w.slice(i + 1), half(o)), kind: "step" };
    return { w: Routes.normalize(w.slice(0, i + 1) + "^" + w.slice(i + 1), half(o)), kind: "step" };
  }

  /*
   * Four options, picked so that the right one can only be found by working it out.
   *
   * Wrong options made as mistakes on the true answer cluster round it, and the
   * mistakes a seam invites mostly undo its mirroring. Shown as they come, the right
   * pose is then the mirrored one more often than not, and the one most like the
   * other three: a reader who never walks a step but picks the mirrored option, or
   * the most typical one, beats chance by a wide margin (measured: 53% and 44% on a
   * four-way choice). So a pool is made of mistakes and of mistakes upon mistakes
   * (each turned and each mirrored), and three are chosen from it such that:
   *
   *   - every feature in `balance` (a pose's hand) splits two and two across the
   *     four, and each in `soft` (its sheet) does where the pool allows;
   *   - at least one option is a mistake from `need`, the ones the task is about;
   *   - the truth's typicality is drawn by lot: a quarter of the time it is the
   *     single most typical of the four (most features shared with the other
   *     three), a quarter the single least, and otherwise neither — in the most
   *     typical and in the least typical place stand wrong options. "Pick the most
   *     typical" and "pick the odd one out" then score a quarter each, which is
   *     chance; never letting the truth be either would be a tell of its own. The
   *     lot (`typicality`) is drawn once per trial, outside its retries: drawn
   *     afresh each time, the place hardest to fill would be redrawn most often
   *     and come up least.
   *
   * The truth's own hand is a coin toss (see `handWanted`), or the split would only
   * say that the answer is one of the two mirrored ones.
   *
   * test/spaces.test.js holds those strategies to chance.
   */
  function chooseFour(rng, truth, pool, feat, balance, soft, need, role) {
    var keyOf = function (v) { return feat(v).join(","); }, seen = {}, cands = [];
    seen[keyOf(truth)] = true;
    shuffle(rng, pool).forEach(function (c) { if (c.value && !seen[keyOf(c.value)]) { seen[keyOf(c.value)] = true; cands.push(c); } });
    var share = function (a, b) { var fa = feat(a), fb = feat(b), n = 0; for (var i = 0; i < fa.length; i++) if (fa[i] === fb[i]) n++; return n; };
    var split = function (set, f) { return set.filter(function (x) { return f(x.value); }).length === 2; };
    var best = null, bestScore = -1;
    for (var i = 0; i < cands.length; i++) for (var j = i + 1; j < cands.length; j++) for (var k = j + 1; k < cands.length; k++) {
      var set = [{ value: truth, lure: null }, cands[i], cands[j], cands[k]];
      if (need && !set.some(function (x) { return need.indexOf(x.lure) >= 0; })) continue;
      if (!balance.every(function (f) { return split(set, f); })) continue;
      var sc = set.map(function (x, a) { return set.reduce(function (n, y, b) { return n + (a === b ? 0 : share(x.value, y.value)); }, 0); });
      var mx = Math.max.apply(null, sc), mn = Math.min.apply(null, sc);
      var only = function (v) { return sc.filter(function (x) { return x === v; }).length === 1; };
      var top = sc[0] === mx && only(mx), bottom = sc[0] === mn && only(mn);
      if (role === "top" ? !top : role === "bottom" ? !bottom : sc[0] === mx || sc[0] === mn) continue;
      var score = soft.filter(function (f) { return split(set, f); }).length + rng.next() * 0.5;
      if (score > bestScore) { bestScore = score; best = set; }
    }
    if (!best) return null;
    var options = shuffle(rng, best);
    return { options: options, answer: options.findIndex(function (x) { return x.lure === null; }) };
  }

  function typicality(rng) { return pick(rng, ["top", "bottom", "middle", "middle"]); }
  var poseFeat = function (p) { return [p.x, p.y, p.f, p.m, p.s]; };
  var flipHand = function (p) { return pose(p.x, p.y, p.f, 1 - p.m, p.s); };
  var turnBy = function (p, t) { return pose(p.x, p.y, (p.f + t) % 4, p.m, p.s); };
  var TURN_LURE = ["", "rotate90", "rotate180", "rotate270"];
  /** Mistakes, and each one mirrored and turned: the pool the options are chosen from. */
  function posePool(truth, base) {
    var pool = base.slice();
    [{ value: truth, lure: null }].concat(base).forEach(function (b) {
      pool.push({ value: flipHand(b.value), lure: b.lure || "hand" });
      for (var t = 1; t < 4; t++) pool.push({ value: turnBy(b.value, t), lure: b.lure || TURN_LURE[t] });
    });
    return pool;
  }
  function asPoses(four) { return four && { options: four.options.map(function (x) { return { pose: x.value, lure: x.lure }; }), answer: four.answer }; }

  var OTHERS = ["Blue", "Green", "Gold", "Violet", "White"];

  /* ------------------------------------------------------------------ *
   * Tasks                                                                *
   * ------------------------------------------------------------------ */

  /** Where: a walk from Red, four poses, one of them where it ends. */
  function whereTrial(rng, o) {
    var hand = handWanted(rng), role = typicality(rng);
    return attempt(function () {
      var sp = randomSpace(rng, o), s0 = randomStart(rng, sp), w = seamWalk(rng, o, sp, s0, o.minLen, o.maxLen, hand);
      if (!w) return null;
      var truth = walk(sp, s0, w).end, p1 = perturb(rng, w, o), p2 = perturb(rng, w, o);
      var base = [
        { value: walk(sp, s0, w, { plain: true }).end, lure: "plain" },
        { value: walk(sp, s0, w, { noHand: true }).end, lure: "noHand" },
        { value: walk(sp, s0, p1.w).end, lure: p1.kind }, { value: walk(sp, s0, p2.w).end, lure: p2.kind },
      ];
      if (hasSheet(sp)) base.push({ value: walk(sp, s0, w, { noPortal: true }).end, lure: "portal" });
      var four = asPoses(chooseFour(rng, truth, posePool(truth, base), poseFeat,
        [function (q) { return q.m === 1; }], hasSheet(sp) ? [function (q) { return q.s === 1; }] : [], ["plain", "noHand", "portal"], role));
      if (!four) return null;
      return { task: "spaces", kind: "where", space: sp, start: s0, X: "Red", walk: w, options: four.options, answer: four.answer, end: truth };
    });
  }

  /** Home: one walk, and whether it brings Red home, back mirrored, back turned, or away. */
  function homeTrial(rng, o) {
    /* A quarter each, so no answer is a better guess than another. */
    var want = ["home", "mirrored", "turned", "away"][Math.floor(rng.next() * 4)];
    var targets = {
      home: function (s0) { return function (q) { return samePose(q, s0); }; },
      mirrored: function (s0) { return function (q) { return sameSquare(q, s0) && q.m !== s0.m; }; },
      turned: function (s0) { return function (q) { return sameSquare(q, s0) && q.m === s0.m && q.f !== s0.f; }; },
    };
    return attempt(function () {
      var sp = randomSpace(rng, o), s0 = randomStart(rng, sp), w;
      if (want === "away" && rng.next() < 0.3) w = seamWalk(rng, o, sp, s0, o.minLen, o.maxLen);
      else if (want === "away") {
        /* Mostly the trap built in: a walk that would come home if the seams were straight,
           as the cube's routes offer walks that close on a flat grid. */
        var pre = seamWalk(rng, o, sp, s0, 2, Math.max(2, o.maxLen - 3));
        if (!pre) return null;
        var home = shortest(sp, walk(sp, s0, pre, { plain: true }).end, function (q) { return samePose(q, s0); }, o.moves, { plain: true });
        if (home === null) return null;
        w = Routes.normalize(pre + home, half(o));
      } else {
        var prefix = seamWalk(rng, o, sp, s0, 2, Math.max(2, o.maxLen - 3));
        if (!prefix) return null;
        /* The way back keeps off the squares the way out used: stepping back over
           them comes home on any field, so the loop has to go round. */
        var avoid = {}, out = walk(sp, s0, prefix);
        out.trail.forEach(function (q) { avoid[q.x + "," + q.y + "," + q.s] = true; });
        delete avoid[s0.x + "," + s0.y + "," + s0.s];
        var back = shortest(sp, out.end, targets[want](s0), o.moves, null, avoid);
        if (back === null) return null;
        w = Routes.normalize(prefix + back, half(o));
      }
      if (!w || w.length < o.minLen || w.length > o.maxLen + 4 || retrace(sp, s0, w)) return null;
      if (!walk(sp, s0, w).crossings.some(function (c) { return c.twist || c.sheet; })) return null;
      var answer = classify(sp, s0, w);
      if (answer !== want) return null;
      var plain = classify(sp, s0, w, { plain: true });
      /* Mostly walks a straight-seam reading gets wrong; the rest are controls. */
      if (plain === answer && rng.next() < 0.75) return null;
      return { task: "spaces", kind: "home", space: sp, start: s0, X: "Red", walk: w, answer: answer, end: walk(sp, s0, w).end,
        plainAnswer: plain, lure: plain !== answer ? "plain" : null };
    });
  }

  /* ---- drift: things that move by themselves ---- */

  var VEL = { 8: [0, 1], 9: [1, 1], 6: [1, 0], 3: [1, -1], 2: [0, -1], 1: [-1, -1], 4: [-1, 0], 7: [-1, 1] };
  var VEL_DIGIT = { "0,1": "8", "1,1": "9", "1,0": "6", "1,-1": "3", "0,-1": "2", "-1,-1": "1", "-1,0": "4", "-1,1": "7" };

  /**
   * One mover for `ticks` ticks: a velocity is a direction and a number of
   * steps a tick. A twisted seam mirrors the position and the velocity both.
   * `opt.noVelocity` mirrors the position only. Null if any step goes through
   * a corner, where two seams would be crossed at once.
   */
  function drift(sp, m, ticks, opt) {
    opt = opt || {};
    var x = m.x, y = m.y, s = m.s, d = m.d.slice(), at = [{ x: x, y: y, s: s }], twists = 0, steps = [];
    for (var t = 0; t < ticks; t++) {
      for (var k = 0; k < m.k; k++) {
        var r = cross(sp, x, y, d, opt), from = { x: x, y: y, s: s }, was = d;
        if (r.seams.length > 1) return null;
        x = r.x; y = r.y; if (r.sheet) s = 1 - s;
        r.refl.forEach(function (ax) {
          twists++;
          if (opt.noVelocity) return;
          d = ax === "x" ? [d[0], -d[1]] : [-d[0], d[1]];
        });
        steps.push({ from: from, to: { x: x, y: y, s: s }, d: was, d2: d, seams: r.seams });
      }
      at.push({ x: x, y: y, s: s });
    }
    return { at: at, twists: twists, steps: steps };
  }
  function randomMover(rng, o, sp, name) {
    var digit = pick(rng, Object.keys(VEL));
    return { name: name, x: int(rng, 0, sp.W - 1), y: int(rng, 0, sp.H - 1), s: 0, d: VEL[digit].slice(), k: o.fast && rng.next() < 0.35 ? 2 : 1 };
  }
  function squareKey(q) { return q.x + "," + q.y + "," + q.s; }

  /** Where is X after k ticks: four squares. Or do X and Y meet within k ticks? */
  function driftTrial(rng, o) {
    var asMeet = rng.next() < 0.5, roll = rng.next(), role = typicality(rng);
    return attempt(function () {
      var sp = randomSpace(rng, o), ticks = int(rng, o.ticks[0], o.ticks[1]);
      var names = ["Red"].concat(shuffle(rng, OTHERS).slice(0, o.movers - 1));
      var movers = names.map(function (n) { return randomMover(rng, o, sp, n); });
      var taken = {};
      for (var i = 0; i < movers.length; i++) { var k0 = squareKey(movers[i]); if (taken[k0]) return null; taken[k0] = true; }
      var runs = movers.map(function (m) { return drift(sp, m, ticks); });
      if (runs.some(function (r) { return !r; })) return null;
      if (!asMeet) {
        if (!runs[0].twists) return null;
        var truth = runs[0].at[ticks], pool = [];
        /* Each mistake at the tick asked, and a tick either side of it. */
        [[{ plain: true }, "plain"], [{ noVelocity: true }, "velocity"], [{}, "tick"]].forEach(function (m) {
          var run = drift(sp, movers[0], ticks + 1, m[0]);
          if (!run) return;
          [ticks - 1, ticks, ticks + 1].forEach(function (k) { if (k >= 1 && (m[1] !== "tick" || k !== ticks)) pool.push({ value: run.at[k], lure: k === ticks ? m[1] : m[1] === "tick" ? "tick" : m[1] }); });
        });
        var four = chooseFour(rng, truth, pool, function (q) { return [q.x, q.y, q.s]; }, [],
          hasSheet(sp) ? [function (q) { return q.s === 1; }] : [], ["plain", "velocity"], role);
        if (!four) return null;
        return { task: "spaces", kind: "drift", ask: "where", space: sp, movers: movers, ticks: ticks, X: "Red", runs: runs,
          options: four.options.map(function (x) { return { sq: x.value, lure: x.lure }; }), answer: four.answer };
      }
      /* Meet: Red and one other. With either/or, the other's velocity is one of two. */
      var Y = movers[1], meets = function (a, b) {
        for (var t = 1; t <= ticks; t++) if (squareKey(a.at[t]) === squareKey(b.at[t])) return t;
        return 0;
      };
      var alt = null, met = meets(runs[0], runs[1]), metAlt = null;
      if (o.either && rng.next() < 0.5) {
        var digits = Object.keys(VEL).filter(function (dg) { return VEL[dg].join() !== Y.d.join(); });
        alt = VEL[pick(rng, digits)].slice();
        var altRun = drift(sp, { x: Y.x, y: Y.y, s: Y.s, d: alt, k: Y.k }, ticks);
        if (!altRun) return null;
        metAlt = meets(runs[0], altRun);
      }
      var answer = alt ? (met && metAlt ? "yes" : !met && !metAlt ? "no" : "cant") : met ? "yes" : "no";
      /* Half the time they meet; with either/or, "can't tell" a third of the time. */
      var want = alt ? (roll < 0.34 ? "yes" : roll < 0.67 ? "cant" : "no") : roll < 0.5 ? "yes" : "no";
      if (answer !== want) return null;
      if (!runs[0].twists && !runs[1].twists) return null;
      var plainMet = meets(drift(sp, movers[0], ticks, { plain: true }) || runs[0], drift(sp, Y, ticks, { plain: true }) || runs[1]);
      /* As in possible: mostly meetings the straight-seam reading gets wrong. */
      if (!alt && !!plainMet === !!met && rng.next() < 0.75) return null;
      return { task: "spaces", kind: "drift", ask: "meet", space: sp, movers: movers, ticks: ticks, X: "Red", Y: Y.name, runs: runs,
        alt: alt, met: met, metAlt: metAlt, answer: answer, lure: !alt && !!plainMet !== !!met ? "plain" : null };
    });
  }

  /** Space: walks and where they ended. Which field is it? Exactly one option fits them all. */
  function spaceTrial(rng, o) {
    return attempt(function () {
      /* The truth is any field the options could be, the plain torus included: drawn only
         from twisted ones, "never the torus" would be a free elimination. */
      var cands = allSpaces(o, pick(rng, o.sizes), pick(rng, o.sizes)), truth = pick(rng, cands), seen = [];
      for (var n = 0; n < 3; n++) {
        var s0 = randomStart(rng, truth), w = attempt(function () {
          var ww = randomWalk(rng, o, o.minLen, o.maxLen + 2);
          return ww && walk(truth, s0, ww).crossings.length ? ww : null;
        }, 200);
        if (!w) return null;
        seen.push({ start: s0, walk: w, end: walk(truth, s0, w).end });
        var fit = cands.filter(function (c) { return seen.every(function (ob) { return samePose(walk(c, ob.start, ob.walk).end, ob.end); }); });
        if (fit.length === 1) {
          if (spaceKey(fit[0]) !== spaceKey(truth)) return null;
          var score = function (c) { return seen.filter(function (ob) { return samePose(walk(c, ob.start, ob.walk).end, ob.end); }).length; };
          var others = shuffle(rng, cands.filter(function (c) { return spaceKey(c) !== spaceKey(truth); }))
            .sort(function (a, b) { return score(b) - score(a); }).slice(0, 3);
          if (others.length < 3) return null;
          var options = shuffle(rng, [truth].concat(others));
          return { task: "spaces", kind: "space", space: truth, observations: seen, options: options, X: "Red",
            answer: options.findIndex(function (c) { return spaceKey(c) === spaceKey(truth); }),
            near: others.filter(function (c) { return score(c) === seen.length - 1; }).length };
        }
      }
      return null;
    });
  }

  /** A premise "X is Y walked w", either way round when back steps are in use. */
  function premise(rng, o, X, Y, w) {
    return o.moves.indexOf("v") >= 0 && rng.next() < 0.5 ? { X: Y, Y: X, w: Routes.normalize(Routes.inverse(w), half(o)) } : { X: X, Y: Y, w: w };
  }

  /** Possible: a loop of walks from Red round to Red. Possible when walking it comes back exactly. */
  function possibleTrial(rng, o) {
    var possible = rng.next() < 0.5;
    return attempt(function () {
      var sp = randomSpace(rng, o), s0 = randomStart(rng, sp), names = ["Red"].concat(shuffle(rng, OTHERS).slice(0, o.objects - 1));
      var walks = [], cur = s0, all = "";
      for (var i = 1; i < names.length; i++) {
        var w = randomWalk(rng, o, 2, o.segMax);
        if (!w) return null;
        walks.push(w); all += w; cur = walk(sp, cur, w).end;
      }
      var truth = shortest(sp, cur, function (q) { return samePose(q, s0); }, o.moves);
      var plainClose = shortest(sp, walk(sp, s0, all, { plain: true }).end, function (q) { return samePose(q, s0); }, o.moves, { plain: true });
      var close, lure = null;
      if (possible) close = truth;
      else if (plainClose && !samePose(walk(sp, cur, plainClose).end, s0) && rng.next() < 0.85) { close = plainClose; lure = "plain"; }
      else { if (!truth) return null; var p = perturb(rng, truth, o); close = p.w; lure = p.kind; }
      if (!close || !/[\^v<>]/.test(close) || close.length > o.segMax + 4) return null;
      var loop = all + close, closes = samePose(walk(sp, s0, loop).end, s0);
      if (closes !== possible) return null;
      if (!walk(sp, s0, loop).crossings.some(function (c) { return c.twist || c.sheet; })) return null;
      if (retrace(sp, s0, Routes.normalize(loop, half(o)))) return null;
      var plainSays = samePose(walk(sp, s0, loop, { plain: true }).end, s0);
      /* Mostly loops the straight-seam reading gets wrong: where it gets them right,
         the twist could be ignored and the answer would still come out. Some are kept
         as controls. */
      if (plainSays === closes && rng.next() < 0.75) return null;
      if (possible && !plainSays) lure = "plain";
      var premises = walks.map(function (w, i) { return premise(rng, o, names[i + 1], names[i], w); });
      premises.push(premise(rng, o, "Red", names[names.length - 1], close));
      return { task: "spaces", kind: "possible", space: sp, start: s0, X: "Red", names: names, premises: shuffle(rng, premises),
        loop: Routes.normalize(loop, half(o)), end: walk(sp, s0, loop).end, answer: possible ? "possible" : "impossible",
        lure: lure, plainAnswer: plainSays ? "possible" : "impossible" };
    });
  }

  /**
   * Transfer: Blue is Red walked w, shown with both standing. Gold stands
   * elsewhere, facing its own way. As Blue is to Red, which pose is to Gold?
   * Red's walk stays clear of the seams and Gold's does not, so copying the
   * offset on the page (the trap) and walking in Gold's frame part ways.
   */
  function transferTrial(rng, o) {
    var hand = handWanted(rng), role = typicality(rng);
    return attempt(function () {
      var sp = randomSpace(rng, o), r0 = randomStart(rng, sp), w = randomWalk(rng, o, o.minLen, o.maxLen);
      if (!w) return null;
      var rr = walk(sp, r0, w);
      if (rr.crossings.length || (rr.end.x === r0.x && rr.end.y === r0.y)) return null;
      var g0 = randomStart(rng, sp, hasSheet(sp) && rng.next() < 0.5 ? 1 : 0);
      if (sameSquare(g0, r0) || sameSquare(g0, rr.end)) return null;
      var gr = walk(sp, g0, w);
      /* Mirrored, it must have crossed a twist; unmirrored, a twist twice, a sheet, or (on
         a small field where neither fits in a short walk) a straight seam: going round
         still parts walking from copying the page. */
      if (!gr.crossings.length || gr.end.m !== hand) return null;
      var b0 = rr.end, dx = b0.x - r0.x, dy = b0.y - r0.y;
      var screen = pose(mod(g0.x + dx, sp.W), mod(g0.y + dy, sp.H), mod(g0.f + b0.f - r0.f, 4), g0.m, g0.s);
      var p = perturb(rng, w, o);
      if (samePose(screen, gr.end)) return null;
      var base = [{ value: screen, lure: "screen" }, { value: walk(sp, g0, w, { plain: true }).end, lure: "plain" },
        { value: walk(sp, g0, w, { noHand: true }).end, lure: "noHand" }, { value: walk(sp, g0, p.w).end, lure: p.kind }];
      var four = asPoses(chooseFour(rng, gr.end, posePool(gr.end, base), poseFeat,
        [function (q) { return q.m === 1; }], hasSheet(sp) ? [function (q) { return q.s === 1; }] : [], ["screen"], role));
      if (!four) return null;
      return { task: "spaces", kind: "transfer", space: sp, start: r0, blue: b0, gold: g0, X: "Gold", walk: w,
        options: four.options, answer: four.answer, end: gr.end };
    });
  }

  /*
   * What makes an item hard, as numbers, for the record: enough to fit a difficulty
   * model to one's own trials later (which features cost accuracy and time), where
   * the level alone mixes them all together.
   *
   *   moves, turns     in the walk(s) the item asks about
   *   seams, twists, sheetsCrossed   crossings of any seam, of twisted ones, onto the
   *                    other sheet
   *   mirroredMoves    moves made while mirrored: where left and right are swapped
   *   field            squares in the field; sheets 1 or 2; twistedSeams 0..2
   *   ticks, movers, fast, either      (drift)
   *   observations     (space), premises (possible)
   */
  function features(t) {
    var sp = t.space, f = { field: sp.W * sp.H, sheets: hasSheet(sp) ? 2 : 1, twistedSeams: +sp.x.twist + +sp.y.twist };
    var walks = [];
    if (t.kind === "where" || t.kind === "home") walks.push([t.start, t.walk]);
    if (t.kind === "transfer") walks.push([t.gold, t.walk]);
    if (t.kind === "possible") walks.push([t.start, t.loop]);
    if (t.kind === "space") t.observations.forEach(function (ob) { walks.push([ob.start, ob.walk]); });
    if (walks.length) {
      f.moves = 0; f.turns = 0; f.seams = 0; f.twists = 0; f.sheetsCrossed = 0; f.mirroredMoves = 0;
      walks.forEach(function (wk) {
        var r = walk(sp, wk[0], wk[1]);
        f.moves += wk[1].length;
        f.turns += wk[1].replace(/[^qQh]/g, "").length;
        r.crossings.forEach(function (c) { f.seams++; if (c.twist) f.twists++; if (c.sheet) f.sheetsCrossed++; });
        for (var i = 0; i < wk[1].length; i++) if (r.trail[i].m) f.mirroredMoves++;
      });
    }
    if (t.kind === "drift") {
      f.ticks = t.ticks; f.movers = t.movers.length; f.fast = t.movers.filter(function (m) { return m.k === 2; }).length;
      f.either = !!t.alt; f.twists = t.runs.reduce(function (n, r) { return n + r.twists; }, 0);
    }
    if (t.kind === "space") f.observations = t.observations.length;
    if (t.kind === "possible") f.premises = t.premises.length;
    return f;
  }

  var KINDS = ["where", "home", "drift", "space", "possible", "transfer"];
  function trial(kind, rng, o) {
    return { where: whereTrial, home: homeTrial, drift: driftTrial, space: spaceTrial, possible: possibleTrial, transfer: transferTrial }[kind](rng, o);
  }

  /* ------------------------------------------------------------------ *
   * Saying it                                                            *
   * ------------------------------------------------------------------ */

  var LETTER = Algebra.LETTER;
  var nw = function (k) { return ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"][k] || String(k); };

  function squareName(q) { return COLS[q.x] + (q.y + 1); }
  function poseCode(q) { return squareName(q) + (q.s ? "⁺" : "") + "@" + FACING_DIGIT[q.f] + (q.m ? "m" : ""); }
  function poseWords(q) { return squareName(q) + (q.s ? " on the second sheet" : "") + ", facing " + COMPASS[q.f] + (q.m ? ", mirrored" : ""); }
  function squareCode(q) { return squareName(q) + (q.s ? "⁺" : ""); }
  function squareWords(q) { return squareName(q) + (q.s ? " on the second sheet" : ""); }

  function seamCode(a) { return (a.twist ? "⋈" : "○") + (a.sheet ? "⁺" : ""); }
  function spaceCode(sp, hidden) { return "▦" + sp.W + "×" + sp.H + (hidden ? " x? y?" : " x" + seamCode(sp.x) + " y" + seamCode(sp.y)); }
  function seamWords(a, edges) {
    return edges + " are joined " + (a.twist ? "with a twist" : "straight") + (a.sheet ? ", onto the other sheet" : "");
  }
  function spaceWords(sp, hidden) {
    var s = "A field " + nw(sp.W) + " wide and " + nw(sp.H) + " tall.";
    if (hidden) return s + " How its edges are joined is to be found.";
    return s + " Its east and west edges " + seamWords(sp.x, "").trim() + "; its north and south edges " + seamWords(sp.y, "").trim() + ".";
  }
  function optionSpaceCode(sp) { return "x" + seamCode(sp.x) + " y" + seamCode(sp.y); }
  function optionSpaceWords(sp) {
    return "east–west " + (sp.x.twist ? "twisted" : "straight") + (sp.x.sheet ? " to the other sheet" : "")
      + ", north–south " + (sp.y.twist ? "twisted" : "straight") + (sp.y.sheet ? " to the other sheet" : "");
  }
  function velCode(m, d) { var dg = VEL_DIGIT[(d || m.d).join()]; return m.k === 2 ? dg + dg : dg; }
  var VEL_WORDS = { 8: "north", 9: "north-east", 6: "east", 3: "south-east", 2: "south", 1: "south-west", 4: "west", 7: "north-west" };
  function velWords(m, d) { return (m.k === 2 ? "two steps " : "one step ") + VEL_WORDS[VEL_DIGIT[(d || m.d).join()]]; }

  var ANSWER_CODE = { home: "⌂", mirrored: "⇋", turned: "↻", away: "→" };
  var ANSWER_WORDS = { home: "home", mirrored: "back, but mirrored", turned: "back, but turned", away: "away" };

  /** What the trial shows: its lines and its question, in code or in words, each spoken as words. */
  function card(t, compact) {
    var lines = [], spoken = [];
    function line(code, words) { lines.push(compact ? code : words); spoken.push(words); }
    line(spaceCode(t.space, t.kind === "space"), spaceWords(t.space, t.kind === "space"));
    var q, qs;
    if (t.kind === "where" || t.kind === "home") {
      line("R=" + poseCode(t.start), "Red stands on " + poseWords(t.start) + ".");
      if (t.kind === "where") {
        t.options.forEach(function (op, i) { line((i + 1) + " " + poseCode(op.pose), (i + 1) + ". " + poseWords(op.pose) + "."); });
        q = "R" + t.walk + "⌖?"; qs = "Red walks: " + Routes.walkWords(t.walk) + ". Where does Red end?";
      } else { q = "R" + t.walk + "⌂?"; qs = "Red walks: " + Routes.walkWords(t.walk) + ". Is Red home, back but mirrored, back but turned, or away?"; }
    } else if (t.kind === "drift") {
      t.movers.forEach(function (m, i) {
        var either = t.alt && i === 1;
        line(LETTER[m.name] + "=" + squareCode(m) + "→" + (either ? "(" + velCode(m) + "|" + velCode(m, t.alt) + ")" : velCode(m)),
          m.name + " is on " + squareWords(m) + " and moves " + (either ? velWords(m) + " or " + velWords(m, t.alt) : velWords(m)) + " each tick.");
      });
      if (t.ask === "where") {
        t.options.forEach(function (op, i) { line((i + 1) + " " + squareCode(op.sq), (i + 1) + ". " + squareWords(op.sq) + "."); });
        q = "R+" + t.ticks + "t⌖?"; qs = "Where is Red after " + nw(t.ticks) + " ticks?";
      } else {
        q = "R⋂" + LETTER[t.Y] + "≤" + t.ticks + "t?"; qs = "Do Red and " + t.Y + " land on the same square within " + nw(t.ticks) + " ticks?";
      }
    } else if (t.kind === "space") {
      t.observations.forEach(function (ob) {
        line(poseCode(ob.start) + " " + ob.walk + " ⇒ " + poseCode(ob.end),
          "From " + poseWords(ob.start) + ", " + Routes.walkWords(ob.walk) + ": ends on " + poseWords(ob.end) + ".");
      });
      t.options.forEach(function (sp, i) { line((i + 1) + " " + optionSpaceCode(sp), (i + 1) + ". " + optionSpaceWords(sp) + "."); });
      q = "▦?"; qs = "Which field is it?";
    } else if (t.kind === "possible") {
      line("R=" + poseCode(t.start), "Red stands on " + poseWords(t.start) + ".");
      t.premises.forEach(function (p) { line(LETTER[p.X] + "=" + LETTER[p.Y] + p.w, p.X + " is " + p.Y + " walked: " + Routes.walkWords(p.w) + "."); });
      q = "∃?"; qs = "Can all of this be true at once?";
    } else {
      line("R=" + poseCode(t.start), "Red stands on " + poseWords(t.start) + ".");
      line("B=" + poseCode(t.blue) + " =R" + t.walk, "Blue stands on " + poseWords(t.blue) + ": Red walked " + Routes.walkWords(t.walk) + ".");
      line("O=" + poseCode(t.gold), "Gold stands on " + poseWords(t.gold) + ".");
      t.options.forEach(function (op, i) { line((i + 1) + " " + poseCode(op.pose), (i + 1) + ". " + poseWords(op.pose) + "."); });
      q = "R:B=O:?"; qs = "As Blue is to Red, which pose is to Gold?";
    }
    lines.spoken = spoken;
    var question = new String(compact ? q : qs);
    question.spoken = qs;
    return { lines: lines, question: question };
  }

  return {
    DIRS: DIRS, COMPASS: COMPASS, KINDS: KINDS, VEL: VEL, ANSWER_CODE: ANSWER_CODE, ANSWER_WORDS: ANSWER_WORDS,
    space: space, axis: axis, pose: pose, samePose: samePose, sameSquare: sameSquare, key: key, spaceKey: spaceKey, hasSheet: hasSheet,
    cross: cross, move: move, walk: walk, shortest: shortest, retrace: retrace, classify: classify, drift: drift,
    difficulty: difficulty, randomSpace: randomSpace, allSpaces: allSpaces,
    whereTrial: whereTrial, homeTrial: homeTrial, driftTrial: driftTrial, spaceTrial: spaceTrial,
    possibleTrial: possibleTrial, transferTrial: transferTrial, trial: trial,
    features: features, card: card, poseCode: poseCode, poseWords: poseWords, squareCode: squareCode, squareWords: squareWords,
    spaceCode: spaceCode, optionSpaceCode: optionSpaceCode, optionSpaceWords: optionSpaceWords, squareName: squareName,
  };
});
