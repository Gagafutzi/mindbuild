"use strict";

/* ============================================================
   MORE DORSAL PROGRAMS — the logic, without the screen
   ============================================================

   DorsalFlow trains one thing: which way a faint grating drifts in noise.
   These programs train the rest of the dorsal pathway, one function each:

     coherence   global motion: how many dots must move together to be seen (MT)
     ufov        useful field of view: centre and periphery at once, briefly
     flow        heading from optic flow: where is the expansion's centre (MST)
     speed       which of two motions is faster
     mot         tracking several moving objects among identical ones
     walker      which way a point-light walker faces, in scrambled-walker noise
     contact     time to contact: when would a looming object arrive

   Everything here is arithmetic on numbers — dot positions, staircase steps,
   walker joints — with the random source passed in, so the tests can run it
   in node with a seeded draw. programs.js puts it on a canvas.

   Plain script, no dependencies: a <script> tag in the page, `require` in the
   tests (test/run.js). */

var DorsalPlus = (function () {

  /* ---------- the staircase ---------- */

  /**
   * A weighted up/down staircase (Kaernbach 1991), in log units: a correct
   * answer steps `step` toward harder, an error steps step·p/(1−p) toward
   * easier, so it settles where p of answers are right. Before the first
   * error it steps twice as far, to get from an easy start to threshold fast.
   *
   * `harder` is −1 where a smaller value is harder (coherence, duration,
   * offset, speed difference, timing gap) and +1 where a larger one is
   * (tracking speed, noise dots).
   */
  function Staircase(o) {
    this.value = o.start;
    this.min = o.min; this.max = o.max;
    this.step = o.step || 0.12;
    this.target = o.target || 0.75;
    this.harder = o.harder || -1;
    this.erred = false;
    this.last = 0;              // direction of the last move: −1 harder, +1 easier
    this.reversals = [];
    this.trials = 0;
    this.right = 0;
  }
  Staircase.prototype.update = function (correct) {
    var x = Math.log(this.value), d = this.step;
    var move;
    if (correct) move = -1;
    else { move = +1; this.erred = true; }
    var size = correct ? (this.erred ? d : 2 * d) : d * this.target / (1 - this.target);
    if (this.last && move !== this.last) this.reversals.push(this.value);
    this.last = move;
    /* "Harder" in value terms: −1 means shrink the value, +1 grow it. */
    x += move === -1 ? this.harder * size : -this.harder * size;
    this.value = Math.min(this.max, Math.max(this.min, Math.exp(x)));
    this.trials++;
    if (correct) this.right++;
  };
  /** The geometric mean of the reversals after the first two, or of where it ended. */
  Staircase.prototype.threshold = function () {
    var r = this.reversals.length > 4 ? this.reversals.slice(2) : this.reversals;
    if (!r.length) return this.value;
    return Math.exp(r.reduce(function (a, v) { return a + Math.log(v); }, 0) / r.length);
  };

  /* ---------- global motion: random dots ---------- */

  /**
   * A field of dots in a circular aperture. Each frame a fresh `coherence`
   * share of them steps the signal way and the rest step a random way (the
   * "white noise" form: no dot is a signal dot for long, so following one
   * dot does not answer). Dots live a few frames and are reborn anywhere, so
   * no dot's path is long enough to track either.
   */
  function makeDots(n, radius, rand) {
    var dots = [];
    for (var i = 0; i < n; i++) dots.push(bornDot(radius, rand, Math.floor(rand() * 6)));
    return dots;
  }
  function bornDot(radius, rand, age) {
    var r = radius * Math.sqrt(rand()), a = 2 * Math.PI * rand();
    return { x: r * Math.cos(a), y: r * Math.sin(a), age: age || 0 };
  }
  function stepDots(dots, o, rand) {
    var signal = 0;
    for (var i = 0; i < dots.length; i++) {
      var d = dots[i];
      /* Reborn somewhere new, and stepping like the rest: skipping its step would thin the signal. */
      if (++d.age > (o.lifetime || 6)) d = dots[i] = bornDot(o.radius, rand, 0);
      var a;
      if (rand() < o.coherence) { a = o.direction; signal++; } else a = 2 * Math.PI * rand();
      d.x += o.speed * Math.cos(a); d.y += o.speed * Math.sin(a);
      /* Out of the aperture: back in on the far side, along the line through the centre, as far in as it went out. */
      var r = Math.hypot(d.x, d.y);
      if (r > o.radius) { var k = Math.max(0, 2 * o.radius - r) / r; d.x = -d.x * k; d.y = -d.y * k; }
    }
    return signal;
  }

  /* ---------- useful field of view ---------- */

  /**
   * Eight peripheral places on spokes at one eccentricity, and the
   * distractors on two rings and the spokes between. Durations are whole
   * frames: a display shorter than one refresh cannot be shown, and one that
   * is not a whole number of them is shown as the next one up anyway.
   */
  function ufovPlaces(ecc) {
    var out = [];
    for (var k = 0; k < 8; k++) out.push({ k: k, x: ecc * Math.cos(k * Math.PI / 4), y: -ecc * Math.sin(k * Math.PI / 4) });
    return out;
  }
  function ufovDistractors(ecc) {
    var out = [];
    [ecc / 3, 2 * ecc / 3, ecc].forEach(function (r, ring) {
      for (var k = 0; k < 16; k++) {
        if (ring === 2 && k % 2 === 0) continue;          // the target spokes stay clear at its own ring
        var a = k * Math.PI / 8;
        out.push({ x: r * Math.cos(a), y: -r * Math.sin(a) });
      }
    });
    return out;
  }
  function framesFor(ms, frameMs) { return Math.max(1, Math.round(ms / frameMs)); }

  /* ---------- heading from optic flow ---------- */

  /**
   * Radial flow from a focus of expansion: every dot moves away from it at a
   * speed growing with its distance, as the ground ahead does when you move
   * toward that point. A share of dots move randomly, so no one dot settles it.
   */
  function stepFlow(dots, o, rand) {
    for (var i = 0; i < dots.length; i++) {
      var d = dots[i];
      if (rand() < o.noise) {
        /* As fast as a flow dot here would go, in a random direction: speed alone says nothing. */
        var a = 2 * Math.PI * rand(), v = o.rate * Math.hypot(d.x - o.foe, d.y);
        d.x += v * Math.cos(a); d.y += v * Math.sin(a);
      } else {
        d.x += (d.x - o.foe) * o.rate; d.y += d.y * o.rate;
      }
      if (++d.age > (o.lifetime || 12) || d.x * d.x + d.y * d.y > o.radius * o.radius) {
        var r = o.radius * Math.sqrt(rand()), b = 2 * Math.PI * rand();
        d.x = r * Math.cos(b); d.y = r * Math.sin(b); d.age = 0;
      }
    }
  }

  /* ---------- speed ---------- */

  /**
   * The two speeds of a trial: around a base drawn afresh each time, apart by
   * the Weber fraction `diff`, and each shown for a duration jittered ±20%, so
   * that neither how far the dots went nor the base itself says which was faster.
   */
  function speedPair(diff, rand) {
    var base = 3 + 5 * rand(), faster = rand() < 0.5 ? 0 : 1;
    var s = [base / Math.sqrt(1 + diff), base * Math.sqrt(1 + diff)];
    if (faster === 0) s.reverse();
    return { speeds: s, faster: faster, durations: [0, 1].map(function () { return 400 * (0.8 + 0.4 * rand()); }) };
  }

  /* ---------- multiple object tracking ---------- */

  /** Discs moving at one speed, turning a little now and then, bouncing off the walls and each other. */
  function makeDiscs(n, w, h, size, rand) {
    var out = [];
    while (out.length < n) {
      var d = { x: size + rand() * (w - 2 * size), y: size + rand() * (h - 2 * size), a: 2 * Math.PI * rand() };
      if (out.every(function (o) { return Math.hypot(o.x - d.x, o.y - d.y) > 3 * size; })) out.push(d);
    }
    return out;
  }
  function stepDiscs(discs, o, rand) {
    discs.forEach(function (d) {
      if (rand() < 0.03) d.a += (rand() - 0.5) * 1.2;
      d.x += o.speed * Math.cos(d.a); d.y += o.speed * Math.sin(d.a);
      if (d.x < o.size || d.x > o.w - o.size) { d.a = Math.PI - d.a; d.x = Math.min(o.w - o.size, Math.max(o.size, d.x)); }
      if (d.y < o.size || d.y > o.h - o.size) { d.a = -d.a; d.y = Math.min(o.h - o.size, Math.max(o.size, d.y)); }
    });
    /* Never overlapping: two too close turn away from each other. */
    for (var i = 0; i < discs.length; i++) for (var j = i + 1; j < discs.length; j++) {
      var p = discs[i], q = discs[j], dx = q.x - p.x, dy = q.y - p.y, dist = Math.hypot(dx, dy);
      if (dist < 2.4 * o.size && dist > 0) {
        var away = Math.atan2(dy, dx);
        p.a = away + Math.PI; q.a = away;
        var push = (2.4 * o.size - dist) / 2;
        p.x -= push * dx / dist; p.y -= push * dy / dist; q.x += push * dx / dist; q.y += push * dy / dist;
      }
    }
    /* A push apart near a wall must not carry a disc through it. */
    discs.forEach(function (d) {
      d.x = Math.min(o.w - o.size, Math.max(o.size, d.x)); d.y = Math.min(o.h - o.size, Math.max(o.size, d.y));
    });
  }

  /* ---------- the point-light walker ---------- */

  /**
   * Thirteen dots of a walker in profile, after Cutting's (1978) synthetic
   * walker: the limbs swing sinusoidally, arms against legs, knees and elbows
   * bending in their own phase, and the body bobbing twice a stride. Walking
   * in place, so where it is says nothing; facing +1 is rightward, −1 leftward.
   * Units are body heights; y grows downward, as on a canvas.
   */
  var JOINTS = ["head", "shoulderL", "shoulderR", "elbowL", "elbowR", "wristL", "wristR", "hipL", "hipR", "kneeL", "kneeR", "ankleL", "ankleR"];
  function walker(phase, facing) {
    var p = 2 * Math.PI * phase, f = facing;
    var bob = 0.012 * Math.cos(2 * p);
    var hip = { x: 0, y: -0.5 + bob }, shoulder = { x: 0.01 * f, y: -0.82 + bob };
    var out = { head: { x: 0.02 * f, y: -0.94 + bob } };
    [["L", 0], ["R", Math.PI]].forEach(function (side) {
      var s = side[0], q = p + side[1];
      /* Legs: thigh swings ±25°, the knee bends more as the leg comes forward. */
      var thigh = 0.44 * Math.sin(q), knee = 0.6 * Math.max(0, Math.sin(q + 1.2));
      var kx = hip.x + 0.25 * Math.sin(thigh) * f, ky = hip.y + 0.25 * Math.cos(thigh);
      var shin = thigh - knee;
      out["hip" + s] = { x: hip.x + 0.015 * (s === "L" ? -1 : 1) * f, y: hip.y };
      out["knee" + s] = { x: kx, y: ky };
      out["ankle" + s] = { x: kx + 0.24 * Math.sin(shin) * f, y: ky + 0.24 * Math.cos(shin) };
      /* Arms: against the leg on the same side, the elbow bending a little forward. */
      var upper = -0.35 * Math.sin(q), elbow = 0.3 + 0.2 * Math.max(0, -Math.sin(q));
      var ex = shoulder.x + 0.16 * Math.sin(upper) * f, ey = shoulder.y + 0.16 * Math.cos(upper);
      out["shoulder" + s] = { x: shoulder.x + 0.012 * (s === "L" ? -1 : 1) * f, y: shoulder.y };
      out["elbow" + s] = { x: ex, y: ey };
      out["wrist" + s] = { x: ex + 0.14 * Math.sin(upper + elbow) * f, y: ey + 0.14 * Math.cos(upper + elbow) };
    });
    return out;
  }
  /**
   * Scrambled-walker noise: each noise dot takes one joint's own motion, from
   * a walker of either facing at its own phase, but starts somewhere random in
   * the field. Locally it moves exactly as a walker's dot does, so only the
   * walker's arrangement, not any dot's motion, tells which way it faces.
   */
  function makeNoiseDots(n, extent, rand) {
    var out = [];
    for (var i = 0; i < n; i++) {
      out.push({ joint: JOINTS[Math.floor(rand() * JOINTS.length)], phase: rand(), facing: rand() < 0.5 ? 1 : -1,
        x: (rand() - 0.5) * extent, y: (rand() - 0.5) * extent });
    }
    return out;
  }
  function noiseDotAt(d, t) {
    var j = walker((d.phase + t) % 1, d.facing)[d.joint], rest = walker(d.phase, d.facing)[d.joint];
    return { x: d.x + (j.x - rest.x), y: d.y + (j.y - rest.y) };
  }

  /* ---------- time to contact ---------- */

  /**
   * A disc approaching at constant speed: its visual size grows as 1/distance,
   * so it is the angular size, and how fast that grows, that say when it
   * arrives (tau = θ / dθ/dt). `size(t)` is the visual size at time t of a disc
   * that arrives at `contact`, having been `size0` at t = 0.
   */
  function loomSize(size0, contact, t) {
    return size0 * contact / Math.max(1e-6, contact - t);
  }

  return {
    Staircase: Staircase,
    makeDots: makeDots, stepDots: stepDots,
    ufovPlaces: ufovPlaces, ufovDistractors: ufovDistractors, framesFor: framesFor,
    stepFlow: stepFlow,
    speedPair: speedPair,
    makeDiscs: makeDiscs, stepDiscs: stepDiscs,
    JOINTS: JOINTS, walker: walker, makeNoiseDots: makeNoiseDots, noiseDotAt: noiseDotAt,
    loomSize: loomSize,
  };
})();

if (typeof module !== "undefined") module.exports = DorsalPlus;
