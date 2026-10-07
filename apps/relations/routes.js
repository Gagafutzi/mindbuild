"use strict";
/*
 * Relation Algebra: routes on a cube. The poses material walked on the
 * surface of a cube instead of a flat grid. No page code, so it runs (and is
 * tested) in Node as well as in the trainer.
 *
 * ── Why a cube ──
 *
 * On a flat grid a walk is a group element: what it does does not depend on
 * where it starts, so premises can be combined by algebra. On a cube's
 * surface that stops being true. Three squares meet at each corner where
 * four would on a plane, so a quarter turn of angle is missing there, and a
 * walk that goes round a corner comes back turned by it: ^Q^Q^ round one
 * corner ends on the square it started from, facing a quarter turn right.
 * Eight steps straight round the middle come back facing the same way
 * without a single turn. The eight missing quarters total two full turns
 * (Descartes' theorem, the discrete Gauss–Bonnet).
 *
 * So a walk is no longer a relation in the group sense: what a premise says
 * depends on where it is walked, and the only way to combine premises is to
 * walk them. The flat-grid answer is always on offer, as the trap.
 *
 * ── Geometry ──
 *
 * A cube of N squares a side (2 or 3), in doubled coordinates so that every
 * square's centre is whole: [0, 2N]³, x east, y north, z up. A pose is a
 * square's centre P, a facing f and the face's outward normal n (unit
 * vectors). A step in direction d stays on the face, or goes over an edge:
 * it lands half a square down the next face, the new normal is d, and the
 * facing tips over the edge with the walker (what pointed along d now points
 * along −n, what pointed along −d along n, and a facing along the edge is
 * unchanged).
 *
 * ── Walks ──
 *
 * The poses code without mirrors, read left to right in the walker's own
 * frame: ^ v < > a step ahead, back, left, right; q Q h a turn right, left,
 * about. "B=R^^q^": Blue stands where Red ends after two steps ahead, a
 * right turn and a step ahead, facing the way it then faces. Every walk can
 * be undone: reverse it and swap ^ v, < >, q Q.
 *
 * ── Tasks ──
 *
 *   home  Which of four walks bring Red back to its square, facing the way
 *         it began? Every one that does is to be selected. By ear: one
 *         walk, and whether it comes home, comes back turned, or ends away.
 *   loop  Possible? The premises close a loop of walks. Possible when
 *         walking the whole loop from Red comes back to Red exactly.
 *   meet  Is X Red walked w? Yes, no, or can't tell when nothing links them.
 *
 * ── Traps ──
 *
 *   flat    the cube read as a flat grid, where the answer would differ
 *   turned  (home) back on the square, but facing another way
 *   step, turn  the true walk with one step or one turn changed
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./algebra.js"));
  else root.Routes = factory(root.Algebra);
})(typeof self !== "undefined" ? self : this, function (Algebra) {

  var NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
  var nw = function (k) { return NUMBER_WORDS[k] || String(k); };
  function int(rng, a, b) { return a + Math.floor(rng.next() * (b - a + 1)); }
  function pick(rng, arr) { return arr[Math.floor(rng.next() * arr.length)]; }
  function shuffle(rng, arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rng.next() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  var mod = function (a, m) { return ((a % m) + m) % m; };
  function attempt(fn, n) { for (var i = 0; i < (n || 300); i++) { var x = fn(); if (x) return x; } return null; }

  /* ------------------------------------------------------------------ *
   * Vectors and poses                                                    *
   * ------------------------------------------------------------------ */

  var add = function (a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; };
  var scale = function (a, k) { return [a[0] * k || 0, a[1] * k || 0, a[2] * k || 0]; };
  var dot = function (a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; };
  var cross = function (a, b) { return [a[1] * b[2] - a[2] * b[1] || 0, a[2] * b[0] - a[0] * b[2] || 0, a[0] * b[1] - a[1] * b[0] || 0]; };
  var same = function (a, b) { return a[0] === b[0] && a[1] === b[1] && a[2] === b[2]; };
  var vkey = function (a) { return a.join(","); };

  function pose(N, P, f, n) { return { N: N, P: P, f: f, n: n }; }
  /** Two poses are the same when they share a square and a facing. */
  function key(s) { return vkey(s.P) + "|" + vkey(s.f); }
  function samePose(a, b) { return same(a.P, b.P) && same(a.f, b.f); }
  function leftOf(s) { return cross(s.n, s.f); }

  /** The direction a step goes in, or null for a turn. */
  function stepDir(s, c) {
    if (c === "^") return s.f;
    if (c === "v") return scale(s.f, -1);
    if (c === "<") return leftOf(s);
    if (c === ">") return scale(leftOf(s), -1);
    return null;
  }

  /** One move. A step off the face goes over the edge, and the facing tips with it. */
  function move(s, c) {
    var d = stepDir(s, c);
    if (d) {
      var M = 2 * s.N, Q = add(s.P, scale(d, 2));
      if (Q[0] >= 0 && Q[0] <= M && Q[1] >= 0 && Q[1] <= M && Q[2] >= 0 && Q[2] <= M) return pose(s.N, Q, s.f, s.n);
      var k = dot(s.f, d);
      return pose(s.N, add(add(s.P, d), scale(s.n, -1)), add(s.f, scale(add(d, s.n), -k)), d);
    }
    if (c === "q") return pose(s.N, s.P, scale(leftOf(s), -1), s.n);
    if (c === "Q") return pose(s.N, s.P, leftOf(s), s.n);
    if (c === "h") return pose(s.N, s.P, scale(s.f, -1), s.n);
    throw new Error("not a move: " + c);
  }

  /** Walk w from s: the end pose, every pose on the way, and how many edges were crossed. */
  function walk(s, w) {
    var cur = s, trail = [s], crossings = 0;
    for (var i = 0; i < w.length; i++) {
      var nx = move(cur, w[i]);
      if (!same(nx.n, cur.n)) crossings++;
      trail.push(nx);
      cur = nx;
    }
    return { end: cur, trail: trail, crossings: crossings };
  }

  /* ------------------------------------------------------------------ *
   * Walks as strings                                                    *
   * ------------------------------------------------------------------ */

  var STEPS = "^v<>", TURNS = "qQh", UNDO = { "^": "v", v: "^", "<": ">", ">": "<", q: "Q", Q: "q", h: "h" };
  var TURN_VALUE = { q: 1, h: 2, Q: 3 };

  /** The same walk, said shortest: turns merged, a step and its reverse cancelled. A half
      turn is written h, or qq where h is not yet in use. */
  function normalize(w, halfAs) {
    var out = [];
    for (var i = 0; i < w.length; i++) {
      var c = w[i];
      if (TURN_VALUE[c]) {
        var t = TURN_VALUE[c];
        while (out.length && typeof out[out.length - 1] === "number") t += out.pop();
        t = mod(t, 4);
        if (t) out.push(t);
      } else if (out.length && out[out.length - 1] === UNDO[c]) {
        out.pop();
      } else out.push(c);
    }
    return out.map(function (x) { return typeof x === "number" ? ({ 1: "q", 2: halfAs || "h", 3: "Q" })[x] : x; }).join("");
  }
  /** The walk back: reversed, every move undone. */
  function inverse(w) { return w.split("").reverse().map(function (c) { return UNDO[c]; }).join(""); }
  /** The walk back in the moves a level allows. Before back steps are in use, a walk is
      undone by turning round, walking it backwards with its turns the other way, and
      turning round again: a back step is a forward step between two about-turns. */
  function undoWalk(w, o) {
    if (o.moves.indexOf("v") >= 0) return normalize(inverse(w), half(o));
    var swap = { q: "Q", Q: "q" };
    return normalize("h" + w.split("").reverse().map(function (c) { return swap[c] || c; }).join("") + "h", half(o));
  }

  /** The same walk on a flat grid: where it ends, in the walker's starting frame (x to the
      right, y ahead), and how many quarter turns right it ends turned. */
  function flat(w) {
    var x = 0, y = 0, fx = 0, fy = 1;
    for (var i = 0; i < w.length; i++) {
      var c = w[i], t;
      if (c === "^") { x += fx; y += fy; }
      else if (c === "v") { x -= fx; y -= fy; }
      else if (c === "<") { x -= fy; y += fx; }
      else if (c === ">") { x += fy; y -= fx; }
      else if (c === "q") { t = fx; fx = fy; fy = -t; }
      else if (c === "Q") { t = fx; fx = -fy; fy = t; }
      else if (c === "h") { fx = -fx; fy = -fy; }
    }
    var r = fy === 1 ? 0 : fx === 1 ? 1 : fy === -1 ? 2 : 3;
    return { x: x || 0, y: y || 0, r: r };
  }
  /** A walk that does `e` on a flat grid, in the moves allowed: straight ahead (or back),
      then across, then the last turn. */
  function flatWalk(e, o) {
    var turn = function (t) { t = mod(t, 4); return t === 1 ? "q" : t === 3 ? "Q" : t === 2 ? (o.moves.indexOf("h") >= 0 ? "h" : "qq") : ""; };
    var w = "", head = 0, i;
    if (e.y > 0) for (i = 0; i < e.y; i++) w += "^";
    else if (e.y < 0) {
      if (o.moves.indexOf("v") >= 0) for (i = 0; i < -e.y; i++) w += "v";
      else { w += turn(2); head = 2; for (i = 0; i < -e.y; i++) w += "^"; }
    }
    if (e.x) { var to = e.x > 0 ? 1 : 3; w += turn(to - head); head = to; for (i = 0; i < Math.abs(e.x); i++) w += "^"; }
    w += turn(e.r - head);
    return normalize(w, o.moves.indexOf("h") >= 0 ? "h" : "qq");
  }

  /** The shortest walk, in the allowed moves, from s to a pose that passes `isTarget`. */
  function shortest(s, isTarget, moves) {
    var seen = {}, queue = [{ s: s, w: "" }];
    seen[key(s)] = true;
    while (queue.length) {
      var cur = queue.shift();
      if (isTarget(cur.s)) return cur.w;
      for (var i = 0; i < moves.length; i++) {
        var nx = move(cur.s, moves[i]), k = key(nx);
        if (!seen[k]) { seen[k] = true; queue.push({ s: nx, w: cur.w + moves[i] }); }
      }
    }
    return null;
  }

  /** Quarter turns right from facing a to facing b, on one square; null if not on one face. */
  function turnBetween(n, a, b) {
    if (same(a, b)) return 0;
    if (same(b, scale(cross(n, a), -1))) return 1;
    if (same(b, scale(a, -1))) return 2;
    if (same(b, cross(n, a))) return 3;
    return null;
  }

  /* ------------------------------------------------------------------ *
   * Saying where                                                         *
   * ------------------------------------------------------------------ */

  var FACE = { "0,0,1": "top", "0,0,-1": "bottom", "1,0,0": "the east side", "-1,0,0": "the west side", "0,1,0": "the north side", "0,-1,0": "the south side" };
  var DIRECTION = { "0,1,0": "north", "1,0,0": "east", "0,-1,0": "south", "-1,0,0": "west", "0,0,1": "up", "0,0,-1": "down" };
  var DIRECTION_DIGIT = { "0,1,0": "8", "1,0,0": "6", "0,-1,0": "2", "-1,0,0": "4" };
  var DIGIT_DIRECTION = { 8: [0, 1, 0], 6: [1, 0, 0], 2: [0, -1, 0], 4: [-1, 0, 0] };
  var KEYPAD = { 2: [["7", "9"], ["1", "3"]], 3: [["7", "8", "9"], ["4", "5", "6"], ["1", "2", "3"]] };
  var SQUARE_WORDS = {
    2: { 7: "the north-west square", 9: "the north-east square", 1: "the south-west square", 3: "the south-east square" },
    3: { 7: "the north-west corner", 8: "the middle of the north edge", 9: "the north-east corner", 4: "the middle of the west edge", 5: "the centre",
      6: "the middle of the east edge", 1: "the south-west corner", 2: "the middle of the south edge", 3: "the south-east corner" },
  };

  /** A top square as a keypad digit, north up. */
  function squareDigit(s) {
    var col = (s.P[0] - 1) / 2, row = s.N - 1 - (s.P[1] - 1) / 2;
    return KEYPAD[s.N][row][col];
  }
  function fromDigit(N, digit, facing) {
    var grid = KEYPAD[N];
    for (var row = 0; row < N; row++) for (var col = 0; col < N; col++) {
      if (grid[row][col] === String(digit)) return pose(N, [2 * col + 1, 2 * (N - 1 - row) + 1, 2 * N], DIGIT_DIRECTION[facing].slice(), [0, 0, 1]);
    }
    throw new Error("no such square: " + digit);
  }
  /** "on top, in the north-east square, facing east", or "on the east side, facing north". */
  function where(s) {
    var face = FACE[vkey(s.n)], dir = DIRECTION[vkey(s.f)];
    if (face === "top") return "on top, in " + SQUARE_WORDS[s.N][squareDigit(s)] + ", facing " + dir;
    return "on " + face + ", facing " + dir;
  }
  var TURN_WORDS = ["facing the same way", "turned a quarter right", "turned round", "turned a quarter left"];

  /* ------------------------------------------------------------------ *
   * Difficulty                                                           *
   * ------------------------------------------------------------------ */

  /** Level 1..30 → the cube and the walks. */
  function difficulty(level) {
    var L = Math.max(1, Math.min(30, Math.round(level)));
    return {
      level: L,
      N: L < 16 ? 2 : 3,
      moves: "^qQ" + (L >= 5 ? "hv" : "") + (L >= 9 ? "<>" : ""),
      /* Moves in a home walk: 4..7 at least, 8..15 at most. Eight is the floor because the
         smallest loop that closes on a flat grid, ^Q^Q^Q^Q, is eight moves: below it no flat
         trap can be built at all. */
      minLen: 4 + Math.floor(L / 10),
      maxLen: 8 + Math.floor((L - 1) / 4),
      segMax: 3 + Math.floor(L / 8),                   /* moves in one premise's walk: 2..6 */
      objects: L <= 8 ? 3 : L <= 18 ? 4 : 5,           /* in a loop; a meet chain has one fewer premise */
    };
  }

  /* ------------------------------------------------------------------ *
   * Making walks                                                         *
   * ------------------------------------------------------------------ */

  var WEIGHT = { "^": 5, v: 1, "<": 1, ">": 1, q: 2, Q: 2, h: 1 };
  function randomWalk(rng, o, lo, hi) {
    var pool = [];
    o.moves.split("").forEach(function (c) { for (var i = 0; i < WEIGHT[c]; i++) pool.push(c); });
    return attempt(function () {
      var len = int(rng, lo, hi), w = "";
      while (w.length < len) w += pick(rng, pool);
      w = normalize(w, half(o));
      return w.length >= lo && w.length <= hi && /[\^v<>]/.test(w) ? w : null;
    }, 60);
  }
  function half(o) { return o.moves.indexOf("h") >= 0 ? "h" : "qq"; }
  function randomStart(rng, N) {
    var M = 2 * N, cs = [];
    for (var i = 1; i < M; i += 2) cs.push(i);
    return pose(N, [pick(rng, cs), pick(rng, cs), M], pick(rng, [[0, 1, 0], [1, 0, 0], [0, -1, 0], [-1, 0, 0]]).slice(), [0, 0, 1]);
  }
  /** Out and back over the same squares: home on any surface, and no test of anything. */
  function retrace(s, w) {
    var sq = [];
    walk(s, w).trail.forEach(function (t) { var k = vkey(t.P); if (sq[sq.length - 1] !== k) sq.push(k); });
    for (var i = 0, j = sq.length - 1; i < j; i++, j--) if (sq[i] !== sq[j]) return false;
    return true;
  }
  /** One move changed: a step added or dropped, or a turn the other way. */
  function perturb(rng, w, o) {
    var i = int(rng, 0, w.length - 1), c = w[i], out;
    if (TURN_VALUE[c] && c !== "h") out = w.slice(0, i) + UNDO[c] + w.slice(i + 1);
    else if (rng.next() < 0.5 && STEPS.indexOf(c) >= 0 && w.replace(/[^\^v<>]/g, "").length > 1) out = w.slice(0, i) + w.slice(i + 1);
    else out = w.slice(0, i + 1) + "^" + w.slice(i + 1);
    return { w: normalize(out, half(o)), kind: TURN_VALUE[c] && c !== "h" ? "turn" : "step" };
  }

  /** What a walk does from s on the cube, and what it would do on a flat grid. */
  function classify(s, w) {
    var r = walk(s, w), e = r.end, f = flat(w);
    var cube = samePose(e, s) ? "home" : same(e.P, s.P) ? "turned" : "away";
    var grid = !f.x && !f.y ? (f.r ? "turned" : "home") : "away";
    var kind = cube === "home" ? (grid === "home" ? "control" : "surprise")
      : grid === "home" ? "flat" : cube;
    return { w: w, cube: cube, grid: grid, kind: kind, end: e, crossings: r.crossings,
      turn: cube === "away" ? null : turnBetween(s.n, s.f, e.f) };
  }

  /* ------------------------------------------------------------------ *
   * Tasks                                                                *
   * ------------------------------------------------------------------ */

  var OTHERS = ["Blue", "Green", "Gold", "Violet", "White"];

  /** Candidate walks for a home trial, in four kinds: home by the shortest way back, back
      turned, closed on a flat grid (the trap's source), and anything at all. */
  function candidates(rng, o, s0) {
    var pools = { surprise: [], control: [], turned: [], flat: [], away: [] }, seen = {};
    for (var t = 0; t < 160; t++) {
      var how = t % 4, w = null;
      if (how === 3) w = randomWalk(rng, o, o.minLen, o.maxLen);
      else {
        var prefix = randomWalk(rng, o, 2, Math.max(2, o.maxLen - 3));
        if (!prefix) continue;
        var end = walk(s0, prefix).end, back;
        if (how === 0) back = shortest(end, function (s) { return samePose(s, s0); }, o.moves);
        else if (how === 1) back = shortest(end, function (s) { return same(s.P, s0.P) && !same(s.f, s0.f); }, o.moves);
        else back = flatWalk(flat(inverse(prefix)), o);
        if (back === null) continue;
        w = normalize(prefix + back, half(o));
      }
      if (!w || w.length < o.minLen || w.length > o.maxLen || seen[w] || retrace(s0, w)) continue;
      seen[w] = true;
      var c = classify(s0, w);
      if (!c.crossings) { if (c.kind === "control") pools.control.push(c); continue; }   /* one face only: a flat control at most */
      pools[c.kind].push(c);
    }
    return pools;
  }

  /**
   * Home, on screen: four walks from Red; select every one that brings Red back to its
   * square facing the way it began. The answer is the set; nothing is guessed better than
   * one subset in sixteen.
   */
  function homeTrial(rng, o) {
    return attempt(function () {
      var s0 = randomStart(rng, o.N), pools = candidates(rng, o, s0);
      var roll = rng.next(), k = roll < 0.08 ? 0 : roll < 0.42 ? 1 : roll < 0.78 ? 2 : roll < 0.95 ? 3 : 4;
      /* A surprise (home on the cube, not on a grid) leads the right ones and a flat trap
         (home on a grid, not on the cube) the wrong ones, wherever there is one; then one of
         each other kind before any repeats. At least one option must be one the grid gets
         wrong, or the item could be answered without the cube. */
      var first = k && pools.surprise.length ? [pick(rng, pools.surprise)] : [];
      var right = first.concat(shuffle(rng, pools.surprise.concat(pools.control).filter(function (c) { return first.indexOf(c) < 0; })));
      var lead = [];
      [pools.flat, pools.turned, pools.away].forEach(function (p) { if (p.length) lead.push(pick(rng, p)); });
      var wrong = (pools.flat.length ? [lead[0]].concat(shuffle(rng, lead.slice(1))) : shuffle(rng, lead))
        .concat(shuffle(rng, pools.flat.concat(pools.turned, pools.away).filter(function (c) { return lead.indexOf(c) < 0; })));
      if (right.length < k || wrong.length < 4 - k) return null;
      var options = shuffle(rng, right.slice(0, k).concat(wrong.slice(0, 4 - k)));
      if (!options.some(function (c) { return c.kind === "surprise" || c.kind === "flat"; })) return null;
      return {
        task: "routes", kind: "home", start: s0, X: "Red", options: options,
        answer: options.map(function (c, i) { return c.cube === "home" ? i : -1; }).filter(function (i) { return i >= 0; }),
      };
    });
  }

  /** Home, by ear: one walk. Home, back turned, or away. */
  function homeOneTrial(rng, o) {
    return attempt(function () {
      var s0 = randomStart(rng, o.N), pools = candidates(rng, o, s0), roll = rng.next(), c;
      if (roll < 0.34) c = pick(rng, pools.surprise.length && rng.next() < 0.7 ? pools.surprise : pools.surprise.concat(pools.control));
      else if (roll < 0.67) c = pick(rng, pools.flat.filter(function (x) { return x.cube === "turned"; }).concat(pools.turned));
      else c = pick(rng, pools.flat.length && rng.next() < 0.6 ? pools.flat.filter(function (x) { return x.cube === "away"; }) : pools.away);
      if (!c) return null;
      return { task: "routes", kind: "homeOne", start: s0, X: "Red", walk: c.w, option: c, answer: c.cube, lure: c.grid !== c.cube ? "flat" : null };
    });
  }

  /** A premise "X is Y walked w", stated either way round. */
  function premise(rng, o, X, Y, w) { return rng.next() < 0.5 ? { X: X, Y: Y, w: w } : { X: Y, Y: X, w: undoWalk(w, o) }; }

  /**
   * Loop: a chain of walks from Red round to Red again. Possible when the whole loop,
   * walked from Red, ends exactly where Red stands, facing Red's way.
   */
  function loopTrial(rng, o) {
    return attempt(function () {
      var s0 = randomStart(rng, o.N), names = ["Red"].concat(shuffle(rng, OTHERS).slice(0, o.objects - 1));
      var walks = [], cur = s0, all = "";
      for (var i = 1; i < names.length; i++) {
        var w = randomWalk(rng, o, 2, o.segMax);
        if (!w) return null;
        walks.push(w); all += w; cur = walk(cur, w).end;
      }
      if (walk(s0, all).crossings < 1) return null;
      var truth = shortest(cur, function (s) { return samePose(s, s0); }, o.moves);
      var gridClose = flatWalk(flat(inverse(all)), o);
      var possible = rng.next() < 0.5, close, lure = null;
      if (possible) {
        close = truth;
        if (!close || close.length > o.segMax + 3) return null;
      } else if (gridClose && !samePose(walk(cur, gridClose).end, s0) && rng.next() < 0.9) {
        close = gridClose; lure = "flat";
      } else {
        /* The flat trap is the point, so a loop that cannot carry one is usually drawn again. */
        if (rng.next() < 0.6) return null;
        var p = perturb(rng, truth, o);
        close = p.w; lure = p.kind;
      }
      if (!close || !/[\^v<>]/.test(close) || close.length > o.segMax + 3) return null;
      /* The answer, from the loop as it will be read. */
      var loop = all + close, closes = samePose(walk(s0, loop).end, s0), fl = flat(loop);
      if (closes !== possible) return null;
      /* A loop that only goes out and back over the same squares closes on any surface. */
      if (retrace(s0, normalize(loop, half(o)))) return null;
      var gridSays = !fl.x && !fl.y && !fl.r;
      if (possible && !gridSays) lure = "flat";
      var premises = walks.map(function (w, i) { return premise(rng, o, names[i + 1], names[i], w); });
      premises.push(premise(rng, o, "Red", names[names.length - 1], close));
      return { task: "routes", kind: "loop", start: s0, X: "Red", names: names, premises: shuffle(rng, premises),
        loop: normalize(loop, half(o)), end: walk(s0, loop).end, answer: possible ? "possible" : "impossible", lure: lure, gridAnswer: gridSays ? "possible" : "impossible" };
    });
  }

  /**
   * Meet: a chain of walks from Red, and "Is the last one Red walked w?". The walk asked
   * about is the shortest true one, or the flat grid's answer where that is wrong on the
   * cube, or the true one with one move changed. Can't tell when the chain is broken.
   */
  function meetTrial(rng, o) {
    return attempt(function () {
      var s0 = randomStart(rng, o.N), names = ["Red"].concat(shuffle(rng, OTHERS).slice(0, o.objects - 1));
      var poses = [s0], walks = [], all = "";
      for (var i = 1; i < names.length; i++) {
        var w = randomWalk(rng, o, 2, o.segMax);
        if (!w) return null;
        walks.push(w); all += w; poses.push(walk(poses[i - 1], w).end);
      }
      if (walk(s0, all).crossings < 1) return null;
      var X = names[names.length - 1], target = poses[poses.length - 1];
      var truth = shortest(s0, function (s) { return samePose(s, target); }, o.moves);
      if (!truth || truth === normalize(all, half(o))) return null;
      var roll = rng.next(), answer, asked, lure = null;
      var premises = walks.map(function (w, i) { return premise(rng, o, names[i + 1], names[i], w); });
      if (roll < 0.15) {
        /* Break the chain: one link goes, and Red's group and X's group stand apart. */
        var cut = int(rng, 0, premises.length - 1);
        premises.splice(cut, 1);
        if (!premises.length) return null;
        answer = "cant"; asked = rng.next() < 0.5 ? truth : flatWalk(flat(all), o);
      } else if (roll < 0.58) {
        answer = "yes"; asked = truth;
      } else {
        var gw = flatWalk(flat(all), o);
        if (gw && /[\^v<>]/.test(gw) && !samePose(walk(s0, gw).end, target) && rng.next() < 0.9) { asked = gw; lure = "flat"; }
        else if (rng.next() < 0.6) return null;
        else { var p = perturb(rng, truth, o); asked = p.w; lure = p.kind; }
        answer = "no";
      }
      if (!asked || !/[\^v<>]/.test(asked) || asked.length > o.maxLen) return null;
      /* The answer, from what is asked. */
      var reaches = samePose(walk(s0, asked).end, target);
      if (answer !== "cant" && reaches !== (answer === "yes")) return null;
      var fa = flat(asked), fl = flat(all), gridSays = fa.x === fl.x && fa.y === fl.y && fa.r === fl.r;
      if (answer === "yes" && !gridSays) lure = "flat";
      return { task: "routes", kind: "meet", start: s0, X: X, names: names, premises: shuffle(rng, premises), asked: asked, truth: truth,
        target: target, answer: answer, lure: lure, gridAnswer: answer === "cant" ? "cant" : gridSays ? "yes" : "no" };
    });
  }

  /* ------------------------------------------------------------------ *
   * Saying it                                                            *
   * ------------------------------------------------------------------ */

  var LETTER = Algebra.LETTER;
  var OBJECT = { R: "Red", B: "Blue", G: "Green", O: "Gold", V: "Violet", W: "White" };
  var DIGIT = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
  var EAR_MOVE = { "^": "front", v: "back", "<": "left", ">": "right", q: "clock", Q: "counter", h: "half" };
  var EAR_RUN = ["", "", "double", "triple", "quad"];

  /** A walk in words: "two ahead, right turn, one ahead". */
  function walkWords(w) {
    var parts = [];
    for (var i = 0; i < w.length;) {
      var j = i;
      while (j < w.length && w[j] === w[i]) j++;
      var c = w[i], k = j - i;
      if (STEPS.indexOf(c) >= 0) parts.push(nw(k) + " " + { "^": "ahead", v: "back", "<": "left", ">": "right" }[c]);
      else for (var t = 0; t < k; t++) parts.push({ q: "right turn", Q: "left turn", h: "about turn" }[c]);
      i = j;
    }
    return parts.join(", ");
  }
  /** A walk in the spoken code: runs of two, three and four are double, triple, quad. */
  function walkEar(w) {
    var out = [];
    for (var i = 0; i < w.length;) {
      var j = i;
      while (j < w.length && w[j] === w[i]) j++;
      var n = j - i;
      out.push(n === 1 ? EAR_MOVE[w[i]] : (EAR_RUN[n] || DIGIT[n] || String(n)) + (n > 4 ? " times " : " ") + EAR_MOVE[w[i]]);
      i = j;
    }
    return out.join(" ");
  }

  /** A line of the routes code, spoken; anything else is the trainer's own code. */
  function ear(line) {
    line = String(line);
    var m;
    if ((m = line.match(/^cube (\d)$/))) return "cube " + DIGIT[m[1]];
    if ((m = line.match(/^([RBGOVW])=⊤(\d)@(\d)$/))) return OBJECT[m[1]] + " is top " + DIGIT[m[2]] + ", face " + DIGIT[m[3]];
    if ((m = line.match(/^(\d) ([\^v<>qQh]+)$/))) return DIGIT[m[1]].charAt(0).toUpperCase() + DIGIT[m[1]].slice(1) + ": " + walkEar(m[2]);
    if ((m = line.match(/^([RBGOVW])([\^v<>qQh]+)⌂\?$/))) return OBJECT[m[1]] + " " + walkEar(m[2]) + ". Home?";
    if ((m = line.match(/^([RBGOVW])⌂\?$/))) return "Which bring " + OBJECT[m[1]] + " home?";
    return Algebra.ear(line);
  }

  function anchorCode(X, s) { return LETTER[X] + "=⊤" + squareDigit(s) + "@" + DIRECTION_DIGIT[vkey(s.f)]; }
  function anchorWords(X, s) { return X + " stands " + where(s) + "."; }
  function premiseCode(p) { return LETTER[p.X] + "=" + LETTER[p.Y] + p.w; }
  function premiseWords(p) { return p.X + " is " + p.Y + " walked: " + walkWords(p.w) + "."; }

  /**
   * What the trial shows: its lines and its question, in code or in words. Each comes
   * with `.spoken`, how it is read aloud.
   */
  function card(trial, compact) {
    var lines = [], spoken = [], q, qs;
    function line(code, words) { lines.push(compact ? code : words); spoken.push(compact ? ear(code) : words); }
    line("cube " + trial.start.N, "A cube, " + nw(trial.start.N) + " squares to a side.");
    line(anchorCode("Red", trial.start), anchorWords("Red", trial.start));
    if (trial.kind === "home") {
      trial.options.forEach(function (c, i) { line((i + 1) + " " + c.w, (i + 1) + ". " + walkWords(c.w).replace(/^./, function (x) { return x.toUpperCase(); }) + "."); });
      q = compact ? "R⌂?" : "Which walks bring Red back to its square, facing the way it began?";
      qs = compact ? ear(q) : q;
    } else if (trial.kind === "homeOne") {
      q = compact ? "R" + trial.walk + "⌂?" : "Red walks: " + walkWords(trial.walk) + ". Is Red home, back but turned, or away?";
      qs = compact ? ear(q) : q;
    } else {
      trial.premises.forEach(function (p) { line(premiseCode(p), premiseWords(p)); });
      if (trial.kind === "loop") { q = compact ? "∃?" : "Can all of this be true at once?"; qs = compact ? ear(q) : q; }
      else { q = compact ? LETTER[trial.X] + "=R" + trial.asked + "?" : "Is " + trial.X + " Red walked: " + walkWords(trial.asked) + "?"; qs = compact ? ear(q) : q; }
    }
    lines.spoken = spoken;
    var question = new String(q);
    question.spoken = qs;
    return { lines: lines, question: question };
  }

  /* ------------------------------------------------------------------ *
   * Drawing: the cube unfolded                                          *
   * ------------------------------------------------------------------ */
  /*
   * The net is a cross: north above the top, west and east beside it, south
   * below it and the bottom below the south. Units are half squares, so a
   * net is 3·2N wide and 4·2N tall. Edges the net keeps whole are top–north,
   * top–south, top–east, top–west and south–bottom; a walk over any other
   * edge leaves one face and comes back on another, and `trace` marks both
   * ends of the jump.
   */
  function netXY(P, n, N) {
    var M = 2 * N, x = P[0], y = P[1], z = P[2];
    switch (vkey(n)) {
      case "0,0,1": return [M + x, 2 * M - y];
      case "0,1,0": return [M + x, z];
      case "0,-1,0": return [M + x, 3 * M - z];
      case "0,0,-1": return [M + x, 3 * M + y];
      case "1,0,0": return [3 * M - z, 2 * M - y];
      case "-1,0,0": return [z, 2 * M - y];
    }
    throw new Error("not a face: " + n);
  }
  /** Each face's corner in the net, in half squares, and its name. */
  function netFaces(N) {
    var M = 2 * N;
    return [{ id: "top", u: M, v: M }, { id: "north", u: M, v: 0 }, { id: "south", u: M, v: 2 * M }, { id: "bottom", u: M, v: 3 * M },
      { id: "east", u: 2 * M, v: M }, { id: "west", u: 0, v: M }];
  }
  /** A walk as lines on the net: segments, and the pairs of points where it jumps a cut edge. */
  function trace(s, w) {
    var segs = [], jumps = [], cur = s, N = s.N;
    for (var i = 0; i < w.length; i++) {
      var d = stepDir(cur, w[i]), nx = move(cur, w[i]);
      if (d) {
        var a = netXY(cur.P, cur.n, N), b = netXY(nx.P, nx.n, N);
        if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 2) segs.push([a, b]);
        else {
          var edge = add(cur.P, d), a2 = netXY(edge, cur.n, N), b2 = netXY(edge, nx.n, N);
          segs.push([a, a2]); segs.push([b2, b]); jumps.push([a2, b2]);
        }
      }
      cur = nx;
    }
    return { segs: segs, jumps: jumps, end: cur };
  }
  /** Where a pose sits on the net, and which way its facing points there. */
  function netPose(s) {
    var a = netXY(s.P, s.n, s.N), b = netXY(add(s.P, s.f), s.n, s.N);
    return { at: a, dir: [b[0] - a[0], b[1] - a[1]] };
  }

  return {
    move: move, walk: walk, key: key, samePose: samePose, normalize: normalize, inverse: inverse, undoWalk: undoWalk, flat: flat, flatWalk: flatWalk,
    shortest: shortest, turnBetween: turnBetween, classify: classify, retrace: retrace, pose: pose, fromDigit: fromDigit,
    squareDigit: squareDigit, where: where, TURN_WORDS: TURN_WORDS, difficulty: difficulty, randomWalk: randomWalk,
    homeTrial: homeTrial, homeOneTrial: homeOneTrial, loopTrial: loopTrial, meetTrial: meetTrial,
    walkWords: walkWords, walkEar: walkEar, ear: ear, card: card, anchorCode: anchorCode, premiseCode: premiseCode,
    netXY: netXY, netFaces: netFaces, trace: trace, netPose: netPose,
  };
});
