"use strict";

/* ============================================================
   MORE DORSAL PROGRAMS — on the screen
   ============================================================

   One runner for seven programs. A program says how a trial is shown and
   answered, and what its staircase moves; the runner does the rest: the
   fixation, the trials, the staircase, the feedback, and the session kept in
   storage. The arithmetic lives in engine.js, where the tests reach it.

   Every program sizes its stimuli in degrees, through DorsalFlow's own screen
   calibration, and every duration is measured in real frames. */

(function () {
  var E = DorsalPlus;
  var STORE = "dorsalflow_programs_v1";
  var $ = function (id) { return document.getElementById(id); };
  var rand = Math.random;

  /* ---------- the stage ---------- */

  var cv = $("cv"), g = cv.getContext("2d");
  var dpr = 1, W = 0, H = 0, PPD = 38, frameMs = 1000 / 60;
  var abort = false, audio = null;

  function calibration() {
    try {
      var c = JSON.parse(localStorage.getItem("dorsalflow_screen_calibration"));
      if (c && c.pixelsPerDegree > 0) return c.pixelsPerDegree;
    } catch (e) {}
    return 38;
  }
  function resize() {
    dpr = window.devicePixelRatio || 1;
    W = cv.width = Math.round(window.innerWidth * dpr);
    H = cv.height = Math.round(window.innerHeight * dpr);
    PPD = calibration() * dpr;
  }
  window.addEventListener("resize", resize);

  /** The display's real frame time: the median of thirty frames. */
  function measureRefresh() {
    return new Promise(function (done) {
      var gaps = [], last = 0;
      function f(ts) {
        if (last) gaps.push(ts - last);
        last = ts;
        if (gaps.length < 30) return requestAnimationFrame(f);
        gaps.sort(function (a, b) { return a - b; });
        done(gaps[15]);
      }
      requestAnimationFrame(f);
    });
  }

  function clear() { g.fillStyle = "#808080"; g.fillRect(0, 0, W, H); }
  function fixation() {
    var a = 0.25 * PPD;
    g.strokeStyle = "#000"; g.lineWidth = Math.max(2, 2 * dpr);
    g.beginPath(); g.moveTo(W / 2 - a, H / 2); g.lineTo(W / 2 + a, H / 2);
    g.moveTo(W / 2, H / 2 - a); g.lineTo(W / 2, H / 2 + a); g.stroke();
  }
  function dot(x, y, r, colour) { g.fillStyle = colour; g.beginPath(); g.arc(x, y, r, 0, 2 * Math.PI); g.fill(); }

  /** Draw every frame for `ms`; `draw(t, n)` gets the time in and the frame count. */
  function play(ms, draw) {
    return new Promise(function (done) {
      var t0 = null, n = 0;
      function f(ts) {
        if (abort) return done();
        if (t0 === null) t0 = ts;
        var t = ts - t0;
        if (t >= ms) return done();
        draw(t, n++);
        requestAnimationFrame(f);
      }
      requestAnimationFrame(f);
    });
  }
  /** Exactly `frames` frames: for the brief displays, where a frame is a third of the time. */
  function playFrames(frames, draw) {
    return new Promise(function (done) {
      var n = 0;
      function f() {
        if (abort) return done();
        if (n >= frames) return done();
        draw(n++);
        requestAnimationFrame(f);
      }
      requestAnimationFrame(f);
    });
  }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function beep() {
    try {
      if (!audio) return;
      var o = audio.createOscillator(), v = audio.createGain(), t = audio.currentTime;
      o.frequency.value = 1000; v.gain.setValueAtTime(0.0001, t); v.gain.exponentialRampToValueAtTime(0.3, t + 0.005);
      v.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
      o.connect(v); v.connect(audio.destination); o.start(t); o.stop(t + 0.05);
    } catch (e) {}
  }

  /* ---------- answering ---------- */

  var pending = null;
  /** Buttons and keys for a choice; resolves with the chosen value, or null if the session ends. */
  function ask(prompt, options) {
    $("prompt").textContent = prompt;
    var box = $("answers"); box.innerHTML = "";
    return new Promise(function (done) {
      function finish(v) {
        document.removeEventListener("keydown", onKey);
        box.innerHTML = ""; $("prompt").textContent = ""; pending = null;
        done(v);
      }
      function onKey(e) {
        for (var i = 0; i < options.length; i++) {
          if (options[i].keys.indexOf(e.key) >= 0) { e.preventDefault(); return finish(options[i].value); }
        }
      }
      options.forEach(function (o) {
        var b = document.createElement("button");
        b.className = "btn"; b.type = "button"; b.textContent = o.label;
        b.onclick = function () { finish(o.value); };
        box.appendChild(b);
      });
      document.addEventListener("keydown", onKey);
      pending = function () { finish(null); };
    });
  }
  /** Clicks on the canvas, `n` of them, each picking what `pick(x, y)` returns (null: not a pick). */
  function clicks(prompt, n, pick, keys) {
    $("prompt").textContent = prompt;
    return new Promise(function (done) {
      var got = [];
      function finish(v) {
        cv.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey);
        $("prompt").textContent = ""; pending = null; done(v);
      }
      function take(id) {
        if (id === null || got.indexOf(id) >= 0) return;
        got.push(id);
        if (got.length >= n) finish(got);
      }
      function onDown(e) { take(pick(e.offsetX * dpr, e.offsetY * dpr, got)); }
      function onKey(e) { if (keys && keys[e.key] !== undefined) { e.preventDefault(); take(keys[e.key]); } }
      cv.addEventListener("pointerdown", onDown);
      document.addEventListener("keydown", onKey);
      pending = function () { finish(null); };
    });
  }
  var LEFT_RIGHT = [
    { label: "← Left", keys: ["ArrowLeft", "a", "A"], value: -1 },
    { label: "Right →", keys: ["ArrowRight", "d", "D"], value: 1 },
  ];

  /* ---------- the programs ---------- */

  var opts = { distractors: true };

  var PROGRAMS = [
    {
      id: "coherence", name: "Global motion", tag: "Motion coherence · MT",
      what: "Dots flow left or right, most of them at random. How few need to move together for the flow to be seen?",
      intro: ["A field of dots appears for about half a second. Some of them move together, left or right; the rest move every which way, and a different few carry the signal each moment, so following one dot does not help.",
        "Say which way the dots flowed (← → or A D). Right answers make fewer dots move together; a mistake makes more. It settles where you are right three times in four."],
      stair: { start: 0.8, min: 0.01, max: 1, harder: -1, target: 0.75, step: 0.15 }, trials: 60,
      show: function (v) { return (v * 100).toFixed(1) + "% coherent"; },
      run: async function (v) {
        var dir = rand() < 0.5 ? -1 : 1, R = Math.min(6 * PPD, 0.42 * Math.min(W, H));
        var dots = E.makeDots(220, R, rand), speed = 6 * PPD * frameMs / 1000, size = Math.max(1.5 * dpr, 0.07 * PPD);
        await play(650, function () {
          E.stepDots(dots, { coherence: v, direction: dir > 0 ? 0 : Math.PI, speed: speed, radius: R, lifetime: 6 }, rand);
          clear();
          dots.forEach(function (d, i) { dot(W / 2 + d.x, H / 2 + d.y, size, i % 2 ? "#000" : "#fff"); });
          fixation();
        });
        clear(); fixation();
        var a = await ask("Which way did the dots flow?", LEFT_RIGHT);
        return a === null ? null : { stair: [a === dir] };
      },
    },
    {
      id: "ufov", name: "Useful field of view", tag: "Speed of processing · divided attention",
      what: "A car or truck in the centre and a car out at one of eight places, shown for a moment and masked. Name the centre, find the outer car.",
      intro: ["Keep your eyes on the cross. For a moment the centre shows a car or a truck, and one more car appears at one of eight places around it, among triangles; then a mask covers everything.",
        "Say car or truck (1 or 2), then click where the outer car was (or press its number). Both have to be right for the display to get shorter; a mistake in either makes it longer. Each is also scored on its own.",
        "Display times are whole screen frames, and the shortest is one frame."],
      options: function () {
        return '<label class="opt"><input type="checkbox" id="optDistr"' + (opts.distractors ? " checked" : "") + '> Triangles in the periphery (the hardest form; off is easier)</label>';
      },
      readOptions: function () { opts.distractors = $("optDistr").checked; },
      stair: { start: 300, min: 1, max: 500, harder: -1, target: 0.75, step: 0.15 }, trials: 50,
      show: function (v) { return E.framesFor(v, frameMs) + " frames (" + Math.round(E.framesFor(v, frameMs) * frameMs) + " ms)"; },
      run: async function (v) {
        var ecc = Math.max(3 * PPD, Math.min(10 * PPD, 0.45 * W - 1.3 * PPD, H / 2 - 1.3 * PPD - 80 * dpr)), places = E.ufovPlaces(ecc);
        var distr = opts.distractors ? E.ufovDistractors(ecc) : [];
        var centre = rand() < 0.5 ? "car" : "truck", where = Math.floor(rand() * 8), unit = Math.max(1, 1.5 * PPD / 40);
        var frames = E.framesFor(v, frameMs);
        await playFrames(frames, function () {
          clear();
          vehicle(W / 2, H / 2, centre, unit);
          distr.forEach(function (d) { triangle(W / 2 + d.x, H / 2 + d.y, unit); });
          vehicle(W / 2 + places[where].x, H / 2 + places[where].y, "car", unit);
        });
        await play(300, function (t, n) { if (n % 3 === 0) mask(); });
        clear(); spokes(places);
        var c = await ask("In the centre: car or truck?", [
          { label: "Car (1)", keys: ["1"], value: "car" }, { label: "Truck (2)", keys: ["2"], value: "truck" }]);
        if (c === null) return null;
        clear(); spokes(places);
        var keys = {}; for (var k = 0; k < 8; k++) keys[String(k + 1)] = k;
        var p = await clicks("Where was the outer car? Click it, or press its number.", 1, function (x, y) {
          var best = null, d0 = 2.5 * PPD;
          places.forEach(function (q) { var d = Math.hypot(x - W / 2 - q.x, y - H / 2 - q.y); if (d < d0) { d0 = d; best = q.k; } });
          return best;
        }, keys);
        if (p === null) return null;
        var items = [c === centre, p[0] === where];
        return { stair: [items[0] && items[1]], items: items, labels: ["centre", "periphery"] };
      },
    },
    {
      id: "flow", name: "Heading from optic flow", tag: "Optic flow · MST",
      what: "Dots stream outward as if you were moving forward. Are you heading left or right of the cross?",
      intro: ["A field of dots expands from one point, as the world does when you move toward it; some dots move at random to keep any single dot from giving it away.",
        "Say whether the point it expands from — where you are heading — is left or right of the cross (← → or A D). It moves closer to the cross as you get it right."],
      stair: { start: 8, min: 0.15, max: 15, harder: -1, target: 0.75, step: 0.15 }, trials: 60,
      show: function (v) { return v.toFixed(2) + "° off centre"; },
      run: async function (v) {
        var side = rand() < 0.5 ? -1 : 1, R = Math.min(10 * PPD, 0.45 * W, H / 2 - 60 * dpr);
        var dots = [];
        for (var i = 0; i < 300; i++) { var r = R * Math.sqrt(rand()), a = 2 * Math.PI * rand(); dots.push({ x: r * Math.cos(a), y: r * Math.sin(a), age: Math.floor(rand() * 14) }); }
        var rate = 1.2 * frameMs / 1000, size = Math.max(1.5 * dpr, 0.07 * PPD);
        await play(750, function () {
          E.stepFlow(dots, { foe: side * v * PPD, rate: rate, noise: 0.3, radius: R, lifetime: 14 }, rand);
          clear();
          dots.forEach(function (d) { dot(W / 2 + d.x, H / 2 + d.y, size, "#fff"); });
          fixation();
        });
        clear(); fixation();
        var a = await ask("Heading left or right of the cross?", LEFT_RIGHT);
        return a === null ? null : { stair: [a === side] };
      },
    },
    {
      id: "speed", name: "Speed discrimination", tag: "Speed · MT",
      what: "Two bursts of moving dots, one after the other. Which was faster?",
      intro: ["Two bursts of dots move the same way, one after the other. Which was faster? (1 or ←, 2 or →)",
        "The base speed changes every trial and so do the durations, so how far the dots went says nothing: only the speed itself does. The difference shrinks as you get it right."],
      stair: { start: 0.6, min: 0.02, max: 1.5, harder: -1, target: 0.75, step: 0.15 }, trials: 60,
      show: function (v) { return (v * 100).toFixed(1) + "% faster"; },
      run: async function (v) {
        var pair = E.speedPair(v, rand), dir = 2 * Math.PI * rand(), R = Math.min(5 * PPD, 0.4 * Math.min(W, H));
        var size = Math.max(1.5 * dpr, 0.07 * PPD);
        for (var k = 0; k < 2; k++) {
          var dots = E.makeDots(160, R, rand), speed = pair.speeds[k] * PPD * frameMs / 1000;
          await play(pair.durations[k], function () {
            E.stepDots(dots, { coherence: 1, direction: dir, speed: speed, radius: R, lifetime: 30 }, rand);
            clear();
            dots.forEach(function (d, i) { dot(W / 2 + d.x, H / 2 + d.y, size, i % 2 ? "#000" : "#fff"); });
            fixation();
          });
          clear(); fixation();
          if (k === 0) await wait(500);
        }
        var a = await ask("Which was faster?", [
          { label: "First (1 / ←)", keys: ["1", "ArrowLeft"], value: 0 }, { label: "Second (2 / →)", keys: ["2", "ArrowRight"], value: 1 }]);
        return a === null ? null : { stair: [a === pair.faster] };
      },
    },
    {
      id: "mot", name: "Multiple object tracking", tag: "Tracking · divided attention",
      what: "Four of eight identical discs flash green, then all move. Keep track of the four and pick them out at the end.",
      intro: ["Eight discs; four of them are shown green, then all turn the same and move for six seconds, bouncing off the walls and each other.",
        "When they stop, click the four you were tracking. Each pick is scored on its own; right picks make the next trial faster, wrong ones slower."],
      stair: { start: 5, min: 1, max: 30, harder: 1, target: 0.75, step: 0.1 }, trials: 15,
      show: function (v) { return v.toFixed(1) + "°/s"; },
      run: async function (v) {
        var S = Math.min(W, H) * 0.78, ox = (W - S) / 2, oy = (H - S) / 2 + 20 * dpr, size = Math.max(6 * dpr, 0.5 * PPD);
        var discs = E.makeDiscs(8, S, S, size, rand), n = 4;
        function draw(marks) {
          clear();
          g.strokeStyle = "rgba(0,0,0,.35)"; g.lineWidth = dpr; g.strokeRect(ox, oy, S, S);
          discs.forEach(function (d, i) {
            dot(ox + d.x, oy + d.y, size, marks && marks(i) ? marks(i) : "#1a1a1a");
          });
        }
        await play(1600, function () { draw(function (i) { return i < n ? "#2fbf71" : null; }); });
        await play(400, function () { draw(); });
        var speed = v * PPD * frameMs / 1000;
        await play(6000, function () { E.stepDiscs(discs, { speed: speed, size: size, w: S, h: S }, rand); draw(); });
        draw();
        var picked = await clicks("Click the four you tracked.", n, function (x, y, got) {
          var best = null, d0 = 1.6 * size;
          discs.forEach(function (d, i) { var dd = Math.hypot(x - ox - d.x, y - oy - d.y); if (dd < d0 && got.indexOf(i) < 0) { d0 = dd; best = i; } });
          if (best !== null) { dot(ox + discs[best].x, oy + discs[best].y, size * 0.45, "#fff"); }
          return best;
        });
        if (picked === null) return null;
        var items = picked.map(function (i) { return i < n; });
        /* The answer, briefly: picks green if right, red if wrong; missed targets pale green. */
        await play(900, function () {
          draw(function (i) { return picked.indexOf(i) >= 0 ? (i < n ? "#2fbf71" : "#c0392b") : (i < n ? "#7a9" : null); });
        });
        return { stair: items, items: items };
      },
    },
    {
      id: "walker", name: "Biological motion", tag: "Point-light walker · STS",
      what: "A walker made of thirteen dots, hidden among dots that move just like its own. Which way is it facing?",
      intro: ["Thirteen dots walking in place — head, shoulders, elbows, wrists, hips, knees, ankles — among noise dots that each copy one of a walker's own dot motions, scattered.",
        "No single dot gives it away: only how the dots move together does. Say which way it faces (← → or A D). More noise dots join as you get it right."],
      stair: { start: 8, min: 1, max: 400, harder: 1, target: 0.75, step: 0.15 }, trials: 60,
      show: function (v) { return Math.round(v) + " noise dots"; },
      run: async function (v) {
        var facing = rand() < 0.5 ? -1 : 1, body = Math.min(6 * PPD, 0.5 * Math.min(W, H));
        var cx = W / 2 + (rand() - 0.5) * 0.6 * PPD, cy = H / 2 + 0.47 * body + (rand() - 0.5) * 0.6 * PPD;
        var noise = E.makeNoiseDots(Math.round(v), 1.6, rand), phase0 = rand(), size = Math.max(1.5 * dpr, 0.09 * PPD);
        await play(1200, function (t) {
          var ph = (phase0 + t / 1000) % 1, w = E.walker(ph, facing);
          clear();
          E.JOINTS.forEach(function (j) { dot(cx + w[j].x * body, cy + w[j].y * body, size, "#fff"); });
          noise.forEach(function (d) { var p = E.noiseDotAt(d, t / 1000); dot(cx + p.x * body, cy - 0.47 * body + p.y * body, size, "#fff"); });
        });
        clear(); fixation();
        var a = await ask("Which way was the walker facing?", LEFT_RIGHT);
        return a === null ? null : { stair: [a === facing] };
      },
    },
    {
      id: "contact", name: "Time to contact", tag: "Looming · visual timing",
      what: "A disc grows toward you and vanishes before it arrives. A flash comes: before or after it would have reached you?",
      intro: ["A disc approaches — it grows faster and faster, as anything coming at you does — and vanishes before it arrives. A flash and a click come either before or after the moment it would have reached you.",
        "Say which (← before, → after). How much it grew, and how fast, are what say when it arrives. The gap between flash and arrival shrinks as you get it right."],
      stair: { start: 350, min: 10, max: 800, harder: -1, target: 0.75, step: 0.15 }, trials: 60,
      show: function (v) { return Math.round(v) + " ms early or late"; },
      run: async function (v) {
        var contact = 1600 + 800 * rand(), occluded = 500 + 700 * rand(), shown = contact - occluded;
        var sign = rand() < 0.5 ? -1 : 1, flash = contact + sign * v, size0 = 0.6 * PPD, beeped = false;
        await play(Math.max(contact, flash) + 300, function (t) {
          clear();
          if (t < shown) dot(W / 2, H / 2, Math.min(E.loomSize(size0, contact, t), 0.45 * Math.min(W, H)), "#111");
          if (t >= flash && t < flash + 60) {
            g.strokeStyle = "#fff"; g.lineWidth = 6 * dpr; g.beginPath(); g.arc(W / 2, H / 2, 3 * PPD, 0, 2 * Math.PI); g.stroke();
            if (!beeped) { beeped = true; beep(); }
          }
        });
        clear();
        var a = await ask("The flash came before or after it would have arrived?", [
          { label: "← Before", keys: ["ArrowLeft", "a", "A"], value: -1 }, { label: "After →", keys: ["ArrowRight", "d", "D"], value: 1 }]);
        return a === null ? null : { stair: [a === sign] };
      },
    },
  ];

  /* ---------- drawing helpers for the field of view ---------- */

  /* A side-on car (low, long) or truck (tall cab, high box), in black: told apart by outline, not detail. */
  function vehicle(x, y, kind, u) {
    g.fillStyle = "#000";
    if (kind === "car") {
      g.fillRect(x - 20 * u, y - 4 * u, 40 * u, 10 * u);
      g.fillRect(x - 10 * u, y - 12 * u, 20 * u, 9 * u);
    } else {
      g.fillRect(x - 20 * u, y - 18 * u, 26 * u, 24 * u);
      g.fillRect(x + 7 * u, y - 10 * u, 13 * u, 16 * u);
    }
    dot(x - 12 * u, y + 7 * u, 4 * u, "#000"); dot(x + 12 * u, y + 7 * u, 4 * u, "#000");
  }
  function triangle(x, y, u) {
    g.strokeStyle = "#000"; g.lineWidth = Math.max(1, 2 * u);
    g.beginPath(); g.moveTo(x, y - 12 * u); g.lineTo(x + 12 * u, y + 9 * u); g.lineTo(x - 12 * u, y + 9 * u); g.closePath(); g.stroke();
  }
  function mask() {
    var b = Math.max(4, Math.round(0.4 * PPD));
    for (var y = 0; y < H; y += b) for (var x = 0; x < W; x += b) { g.fillStyle = rand() < 0.5 ? "#000" : "#fff"; g.fillRect(x, y, b, b); }
  }
  function spokes(places) {
    fixation();
    g.font = Math.round(0.6 * PPD) + "px ui-monospace, monospace"; g.textAlign = "center"; g.textBaseline = "middle";
    places.forEach(function (q) {
      g.strokeStyle = "rgba(0,0,0,.5)"; g.lineWidth = 2 * dpr; g.beginPath(); g.arc(W / 2 + q.x, H / 2 + q.y, 1.2 * PPD, 0, 2 * Math.PI); g.stroke();
      g.fillStyle = "#000"; g.fillText(String(q.k + 1), W / 2 + q.x, H / 2 + q.y);
    });
  }

  /* ---------- sessions ---------- */

  function load() { try { return JSON.parse(localStorage.getItem(STORE)) || { sessions: [] }; } catch (e) { return { sessions: [] }; } }
  function save(rec) { try { localStorage.setItem(STORE, JSON.stringify(rec)); } catch (e) {} }

  function show(id) { ["home", "intro", "summary"].forEach(function (s) { $(s).hidden = s !== id; }); $("stage").style.display = id === "stage" ? "block" : "none"; }

  function renderHome() {
    var rec = load(), box = $("cards"); box.innerHTML = "";
    PROGRAMS.forEach(function (p) {
      var last = rec.sessions.filter(function (s) { return s.program === p.id; }).pop();
      var c = document.createElement("div"); c.className = "card";
      c.innerHTML = '<span class="tag"></span><h3></h3><p></p><span class="muted small last"></span>';
      c.querySelector(".tag").textContent = p.tag; c.querySelector("h3").textContent = p.name;
      c.querySelector("p").textContent = p.what;
      c.querySelector(".last").textContent = last ? "Last: " + p.show(last.threshold) + ", " + Math.round(100 * last.right / Math.max(1, last.items)) + "% right" : "Not yet played";
      var b = document.createElement("button"); b.className = "btn primary"; b.type = "button"; b.textContent = "Open";
      b.onclick = function () { openIntro(p); };
      c.appendChild(b); box.appendChild(c);
    });
    var rows = $("history"); rows.innerHTML = "";
    rec.sessions.slice(-15).reverse().forEach(function (s) {
      var p = PROGRAMS.find(function (x) { return x.id === s.program; }); if (!p) return;
      var tr = document.createElement("tr");
      [new Date(s.start).toLocaleString(), p.name, p.show(s.threshold), Math.round(100 * s.right / Math.max(1, s.items)) + "%", String(s.trials)]
        .forEach(function (t) { var td = document.createElement("td"); td.textContent = t; tr.appendChild(td); });
      rows.appendChild(tr);
    });
    if (!rows.children.length) rows.innerHTML = '<tr><td colspan="5" class="muted">None yet.</td></tr>';
    show("home");
  }

  var current = null;
  function openIntro(p) {
    current = p;
    $("introTitle").textContent = p.name; $("introTag").textContent = p.tag;
    $("introText").innerHTML = ""; p.intro.forEach(function (t) { var e = document.createElement("p"); e.textContent = t; $("introText").appendChild(e); });
    $("introOpts").innerHTML = p.options ? p.options() : "";
    var last = load().sessions.filter(function (s) { return s.program === p.id; }).pop();
    $("introLast").textContent = last ? "Last time: " + p.show(last.threshold) : "";
    show("intro");
  }

  async function runSession(p) {
    if (p.readOptions) p.readOptions();
    try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); audio.resume(); } catch (e) {}
    abort = false;
    show("stage"); resize(); clear();
    frameMs = await measureRefresh();
    var st = new E.Staircase(p.stair), start = Date.now(), items = 0, right = 0, per = {}, done = 0;
    for (var i = 0; i < p.trials && !abort; i++) {
      $("hudLeft").innerHTML = "<b>" + p.name + "</b> · trial " + (i + 1) + " of " + p.trials;
      $("hudRight").textContent = p.show(st.value);
      clear(); fixation(); await wait(500);
      if (abort) break;
      var res = await p.run(st.value);
      if (!res || abort) break;
      done++;
      res.stair.forEach(function (ok) { st.update(ok); });
      var its = res.items || res.stair;
      its.forEach(function (ok, k) {
        items++; if (ok) right++;
        if (res.labels) { var l = res.labels[k]; per[l] = per[l] || [0, 0]; per[l][0] += ok ? 1 : 0; per[l][1]++; }
      });
      var good = its.filter(Boolean).length;
      $("feedback").innerHTML = its.length > 1
        ? '<span class="' + (good === its.length ? "ok" : "bad") + '">' + its.map(function (ok, k) { return (res.labels ? res.labels[k] + " " : "") + (ok ? "✓" : "✗"); }).join("  ") + "</span>"
        : '<span class="' + (its[0] ? "ok" : "bad") + '">' + (its[0] ? "✓ Right" : "✗ Wrong") + "</span>";
      await wait(450);
      $("feedback").innerHTML = "";
    }
    if (items > 0) {
      var rec = load();
      rec.sessions.push({ program: p.id, start: start, end: Date.now(), trials: done, items: items, right: right,
        threshold: st.threshold(), last: st.value, per: per, frameMs: frameMs, ppd: PPD / dpr, completed: !abort,
        settings: p.id === "ufov" ? { distractors: opts.distractors } : undefined });
      save(rec);
      summary(p, st, done, items, right, per, start);
    } else renderHome();
  }

  function summary(p, st, done, items, right, per, start) {
    $("sumTitle").textContent = p.name + (abort ? " — ended early" : "");
    var rows = [["Threshold", p.show(st.threshold())], ["Right", right + " of " + items + " (" + Math.round(100 * right / items) + "%)"],
      ["Trials", String(done)], ["Time", Math.round((Date.now() - start) / 60000 * 10) / 10 + " min"]];
    Object.keys(per).forEach(function (l) { rows.push([l.charAt(0).toUpperCase() + l.slice(1), per[l][0] + " of " + per[l][1]]); });
    $("sumRows").innerHTML = "";
    rows.forEach(function (r) { var tr = document.createElement("tr"); r.forEach(function (t, k) { var td = document.createElement(k ? "td" : "th"); td.textContent = t; tr.appendChild(td); }); $("sumRows").appendChild(tr); });
    show("summary");
  }

  $("startBtn").onclick = function () { runSession(current); };
  $("backBtn").onclick = renderHome;
  $("againBtn").onclick = function () { openIntro(current); };
  $("homeBtn").onclick = renderHome;
  $("quitBtn").onclick = function () { abort = true; if (pending) pending(); };
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && $("stage").style.display === "block") { abort = true; if (pending) pending(); } });

  /* Opened at #program, straight to that program's page. */
  var start = PROGRAMS.find(function (p) { return "#" + p.id === location.hash; });
  renderHome();
  if (start) openIntro(start);

  window.DorsalPrograms = { PROGRAMS: PROGRAMS };
})();
