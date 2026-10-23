"use strict";
/*
 * Ribbon World: the page. The engine (world.js) decides what happens and what
 * is right; this draws it and asks. Everything here is flat SVG: two bands,
 * shapes made of four or five squares, a mark for each fixture, a bar for the
 * Gate. Nothing to read off but where things are and which way round.
 */

(function () {
  var R = window.Ribbon;
  /* What the hub's meter reads; the harness writes it under exactly this. */
  var RECORD_KEY = "chimera.ribbon.record.v1";
  if (ChimeraRecord.key("ribbon") !== RECORD_KEY) throw new Error("record key out of step");

  /* ---- the two looks ---- */

  var SKINS = {
    /* Side by side, both running down at the Gate. */
    ribbon: {
      glyph: "L", icons: "a",
      loops: [
        { cx: 122, cy: 120, rx: 100, ry: 82, p: 2, gate: 0, dir: 1, colour: "#d4af37", name: "gold" },
        { cx: 311, cy: 120, rx: 72, ry: 62, p: 2, gate: Math.PI, dir: -1, colour: "#9fb0c3", name: "silver" },
      ],
      shapes: [
        { colour: "#ff6b5e", name: "Red" }, { colour: "#58a6ff", name: "Blue" },
        { colour: "#56d364", name: "Green" }, { colour: "#e8e1ff", name: "White" },
      ],
    },
    /* One above the other, squarer, both running right at the Gate. */
    belts: {
      glyph: "Y", icons: "b",
      loops: [
        { cx: 200, cy: 64, rx: 160, ry: 48, p: 4, gate: Math.PI / 2, dir: -1, colour: "#3fb8a8", name: "upper" },
        { cx: 200, cy: 178, rx: 120, ry: 48, p: 4, gate: -Math.PI / 2, dir: 1, colour: "#a88ce0", name: "lower" },
      ],
      shapes: [
        { colour: "#ffa657", name: "Orange" }, { colour: "#79c0ff", name: "Sky" },
        { colour: "#f778ba", name: "Pink" }, { colour: "#c9e86b", name: "Lime" },
      ],
    },
  };

  var WORDS = {
    mirror: "mirrored", cw: "turned a quarter clockwise", ccw: "turned a quarter anticlockwise", half: "turned half way round",
  };

  /* ---- geometry ---- */

  function sgnpow(v, e) { return (v < 0 ? -1 : 1) * Math.pow(Math.abs(v), e); }
  function point(L, t) { var e = 2 / L.p; return [L.cx + L.rx * sgnpow(Math.cos(t), e), L.cy + L.ry * sgnpow(Math.sin(t), e)]; }
  function angle(L, n, k) { return L.gate + L.dir * 2 * Math.PI * k / n; }
  function slotPos(skin, world, loop, slot) { var L = skin.loops[loop]; return point(L, angle(L, world.loops[loop].n, slot)); }
  function f1(v) { return Math.round(v * 10) / 10; }

  /* ---- drawing ---- */

  function band(L) {
    var d = "";
    for (var i = 0; i <= 96; i++) { var p = point(L, 2 * Math.PI * i / 96); d += (i ? "L" : "M") + f1(p[0]) + " " + f1(p[1]); }
    return '<path d="' + d + 'Z" class="rw-band" stroke="' + L.colour + '"/>';
  }

  function glyph(skin, m, at, unit, colour) {
    return R.cells(skin.glyph, m).map(function (c) {
      var x = at[0] + c[0] * unit - unit / 2, y = at[1] + c[1] * unit - unit / 2;
      return '<rect x="' + f1(x) + '" y="' + f1(y) + '" width="' + f1(unit) + '" height="' + f1(unit) + '" fill="' + colour + '" class="rw-cell"/>';
    }).join("");
  }

  function arc(dir) {
    var r = 5.5, a0 = -Math.PI * 0.8, a1 = Math.PI * 0.55;
    var p0 = [r * Math.cos(a0), r * Math.sin(a0)], p1 = [r * Math.cos(a1), r * Math.sin(a1)];
    var tx = -Math.sin(a1), ty = Math.cos(a1);                  // clockwise tangent at the end
    var head = [[p1[0] + tx * 3.5, p1[1] + ty * 3.5], [p1[0] - ty * 2.6, p1[1] + tx * 2.6], [p1[0] + ty * 2.6, p1[1] - tx * 2.6]];
    return '<g' + (dir < 0 ? ' transform="scale(-1,1)"' : "") + '><path d="M' + f1(p0[0]) + " " + f1(p0[1]) + " A" + r + " " + r
      + " 0 1 1 " + f1(p1[0]) + " " + f1(p1[1]) + '" class="rw-ico-line"/><polygon points="'
      + head.map(function (p) { return f1(p[0]) + "," + f1(p[1]); }).join(" ") + '" class="rw-ico"/></g>';
  }

  var ICONS = {
    a: {
      mirror: '<polygon points="-6,-5 6,5 6,-5 -6,5" class="rw-ico"/>',
      cw: arc(1), ccw: arc(-1),
      half: arc(1) + '<circle r="1.6" class="rw-ico"/>',
    },
    b: {
      mirror: '<rect x="-4.5" y="-6" width="3" height="12" class="rw-ico"/><rect x="1.5" y="-6" width="3" height="12" class="rw-ico"/>',
      cw: '<polygon points="-4,-5.5 5.5,0 -4,5.5" class="rw-ico"/>',
      ccw: '<polygon points="4,-5.5 -5.5,0 4,5.5" class="rw-ico"/>',
      half: '<polygon points="0,-6.5 6.5,0 0,6.5 -6.5,0" class="rw-ico"/>',
    },
  };

  function gatePoints(skin, world) { return [slotPos(skin, world, 0, 0), slotPos(skin, world, 1, 0)]; }

  /**
   * One picture of the world.
   *   shapes  [{ s: {loop, slot, m}, colour, ring }]
   *   gate    true open, false shut, null not drawn
   *   icons   draw the fixtures' marks
   *   fire    fixtures that just acted: [{loop, index}]; lit, or pulsed where unmarked
   *   pulse   pulse an unmarked fixture that fired
   *   fog     cover the Gate and its approaches, and hide what is under it
   *   trail   [{loop, slot}], the way a shape came
   *   unit    size of one square
   */
  function map(skin, world, o) {
    o = o || {};
    var unit = o.unit || 6.5, view = "0 0 420 240";
    if (o.zoom) {
      /* Just the Gate and the first slot on each side of it: where a shape
         leaving the Gate is, large enough to see which way round it is. */
      var pts = gatePoints(skin, world).concat([slotPos(skin, world, 0, 1), slotPos(skin, world, 1, 1)]);
      var xs = pts.map(function (q) { return q[0]; }), ys = pts.map(function (q) { return q[1]; });
      var x0 = Math.min.apply(null, xs) - 30, x1 = Math.max.apply(null, xs) + 30, y0 = Math.min.apply(null, ys) - 30, y1 = Math.max.apply(null, ys) + 30;
      var w = Math.max(x1 - x0, (y1 - y0) * 1.4), h = w / 1.4;
      view = f1((x0 + x1 - w) / 2) + " " + f1((y0 + y1 - h) / 2) + " " + f1(w) + " " + f1(h);
    }
    var out = '<svg class="rw-map' + (o.cls ? " " + o.cls : "") + '" viewBox="' + view + '">';
    out += '<defs><filter id="rwblur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="5"/></filter></defs>';
    skin.loops.forEach(function (L) { out += band(L); });

    var g = gatePoints(skin, world), mid = [(g[0][0] + g[1][0]) / 2, (g[0][1] + g[1][1]) / 2];
    var dx = g[1][0] - g[0][0], dy = g[1][1] - g[0][1], len = Math.sqrt(dx * dx + dy * dy) || 1, px = -dy / len, py = dx / len;
    if (o.gate === true) {
      out += '<line x1="' + f1(g[0][0]) + '" y1="' + f1(g[0][1]) + '" x2="' + f1(g[1][0]) + '" y2="' + f1(g[1][1]) + '" class="rw-gate-open"/>';
    } else if (o.gate === false) {
      out += '<line x1="' + f1(mid[0] - px * 13) + '" y1="' + f1(mid[1] - py * 13) + '" x2="' + f1(mid[0] + px * 13) + '" y2="' + f1(mid[1] + py * 13) + '" class="rw-gate-shut"/>';
    }

    var lit = {};
    (o.fire || []).forEach(function (f) { lit[f.loop + ":" + f.index] = true; });
    world.loops.forEach(function (l, li) {
      var L = skin.loops[li];
      l.fixtures.forEach(function (f, fi) {
        var p = point(L, angle(L, l.n, f.at + 0.5)), on = lit[li + ":" + fi];
        if (o.icons) {
          out += '<g transform="translate(' + f1(p[0]) + "," + f1(p[1]) + ')" class="rw-fix' + (on ? " rw-lit" : "") + '">'
            + '<circle r="9" class="rw-fix-bg"/>' + ICONS[skin.icons][f.op] + "</g>";
        } else if (on && o.pulse) {
          out += '<circle cx="' + f1(p[0]) + '" cy="' + f1(p[1]) + '" r="10" class="rw-pulse"/>';
        }
      });
    });

    if (o.trail && o.trail.length > 1) {
      out += '<polyline points="' + o.trail.map(function (t) { var p = slotPos(skin, world, t.loop, t.slot); return f1(p[0]) + "," + f1(p[1]); }).join(" ")
        + '" class="rw-trail" stroke="' + (o.trailColour || "#fff") + '"/>';
      var s0 = slotPos(skin, world, o.trail[0].loop, o.trail[0].slot);
      out += '<circle cx="' + f1(s0[0]) + '" cy="' + f1(s0[1]) + '" r="3" fill="' + (o.trailColour || "#fff") + '"/>';
    }

    var crowd = {};
    (o.shapes || []).forEach(function (sh) {
      if (o.fog && R.fogged(world, sh.s.loop, sh.s.slot)) return;
      var k = sh.s.loop + ":" + sh.s.slot, j = crowd[k] = (crowd[k] || 0) + 1;
      var p = slotPos(skin, world, sh.s.loop, sh.s.slot);
      p = [p[0] + (j - 1) * unit * 2.6, p[1] - (j - 1) * unit * 1.2];
      if (sh.ring) out += '<circle cx="' + f1(p[0]) + '" cy="' + f1(p[1]) + '" r="' + f1(unit * 2.9) + '" class="rw-ring"/>';
      out += glyph(skin, sh.s.m, p, unit, sh.colour);
    });

    if (o.fog) {
      var r = 0;
      world.loops.forEach(function (l, li) {
        [l.n - 1, 0, 1].forEach(function (k) {
          var p = slotPos(skin, world, li, k), d = Math.sqrt((p[0] - mid[0]) * (p[0] - mid[0]) + (p[1] - mid[1]) * (p[1] - mid[1]));
          r = Math.max(r, d);
        });
      });
      out += '<circle cx="' + f1(mid[0]) + '" cy="' + f1(mid[1]) + '" r="' + f1(r + 16) + '" class="rw-fog" filter="url(#rwblur)"/>';
      out += '<circle cx="' + f1(mid[0]) + '" cy="' + f1(mid[1]) + '" r="' + f1(r + 6) + '" class="rw-fog"/>';
    }
    if (o.label) out += '<text x="8" y="20" class="rw-label">' + o.label + "</text>";
    return out + "</svg>";
  }

  function shapesOf(skin, list, ring) {
    return list.map(function (s, i) { return { s: s, colour: skin.shapes[i].colour, ring: i === ring }; });
  }
  function nameOf(skin, i) { return '<b style="color:' + skin.shapes[i].colour + '">' + skin.shapes[i].name + "</b>"; }
  function loopName(skin, li) { return '<b style="color:' + skin.loops[li].colour + '">' + skin.loops[li].name + "</b>"; }

  function head(level, text) {
    return '<div class="rw-head"><span class="rw-lv">level ' + level + "</span><p>" + text + "</p></div>";
  }

  /** A trip, in words: what changed it, in order. */
  function tripWords(skin, trip) {
    return trip.map(function (e) {
      if (e.kind === "fixture") return WORDS[e.op] + " on " + skin.loops[e.loop].name;
      return e.crossed ? "crossed at the Gate to " + skin.loops[1 - e.loop].name : "stayed on " + skin.loops[e.loop].name + " at the Gate";
    }).join(" → ") || "nothing changed it";
  }

  var ORDINAL = ["", "next", "second", "third", "fourth"];

  /* ---- the session ---- */

  Harness.start({
    id: "ribbon",
    name: "Ribbon World",
    unit: "level",
    version: "1",
    what: "Shapes ride two loops. A twist mirrors them, a turnstile turns them, a Gate lets one kind across. "
      + "Watch, predict, spot the frame that cannot be, judge through fog, and tell whether two worlds share their rules.",
    level: { start: 1, min: 1, max: 12 },
    instructions:
      "<p>Two loops touch at the <b>Gate</b>. Small shapes ride round them. Things on the loops change a shape as it passes: "
      + "the <b>twist</b> (⋈) hands it back as its mirror image, as a half-twisted ribbon does, and a <b>turnstile</b> turns it.</p>"
      + "<p>At the Gate, one kind of shape crosses to the other loop and the rest stay where they are. Which kind is for you to "
      + "find out by watching: one hand, or the ones lying one way. A bar across the Gate means it is shut: nothing crosses.</p>"
      + "<p>Each episode starts with a clip. Watch it until you know what every part does (Replay as often as you like), then:</p>"
      + "<ul><li><b>Predict</b>: pick where a shape will be, and which way round, when it leaves the Gate.</li>"
      + "<li><b>Impossible</b>: four moments of one shape's trip, each with the way it came. One frame is wrong.</li>"
      + "<li><b>Fog</b>: a shape goes into fog over the Gate. Which loop is it on? Say how sure you are: "
      + "sure when it could not have crossed, otherwise as sure as the Gate is usually open.</li>"
      + "<li><b>Analogy</b>: a second world that looks different. Same rules, or one thing different?</li></ul>"
      + "<p>There is nothing to count or calculate. Picture the shape going round. Higher levels add shapes, kinds of turn, "
      + "a Gate that goes by which way a shape lies, more fixtures, longer trips, and then hide the fixtures' marks.</p>",
    settings: [
      { key: "minutes", label: "Session length", type: "select", default: 15,
        options: [10, 15, 20, 30, 45, 60, 90, 120].map(function (m) { return { value: m, label: m + " min" }; }) },
      { key: "speed", label: "Clip speed", type: "select", default: 1,
        options: [{ value: 1.5, label: "Slow" }, { value: 1, label: "Normal" }, { value: 0.7, label: "Fast" }] },
    ],
    buttons: [],

    session: async function (s) {
      var level = Math.round(s.level), rng = R.Rng((Date.now() ^ (Math.random() * 1e9)) >>> 0);
      var endAt = s.settings.minutes * 60000, episodes = 0, fogs = [];

      async function next() {
        s.buttons([{ id: "next", label: "Next", key: "Enter" }]);
        await s.respond({ accept: ["next"] });
      }

      async function play(skin, world, clip, P, text) {
        var replays = 0;
        s.buttons([]);
        for (;;) {
          for (var t = 0; t < clip.frames.length; t++) {
            var fr = clip.frames[t];
            var fire = fr.events.filter(function (e) { return e.kind === "fixture"; }).map(function (e) {
              return { loop: e.loop, index: e.index };
            });
            s.show(head(level, text) + map(skin, world, {
              shapes: shapesOf(skin, fr.shapes), gate: fr.open, icons: P.icons, fire: P.flash ? fire : [], pulse: P.flash,
            }));
            await s.wait(P.tickMs * s.settings.speed);
          }
          s.buttons([{ id: "replay", label: "Replay", key: "r" }, { id: "ready", label: "Ready", key: "Enter" }]);
          var r = await s.respond({ accept: ["replay", "ready"] });
          s.buttons([]);
          if (r.id === "ready") return replays;
          replays++;
        }
      }

      while (s.now() < endAt) {
        var P = R.params(level), skin = SKINS.ribbon, ep = R.makeEpisode(rng, P), score = 0;
        var nowShapes = shapesOf(skin, ep.now);

        var replays = await play(skin, ep.world, ep.clip, P,
          "Watch what each part does, and who the Gate lets across.");
        s.log({ block: episodes, modality: "watch", level: level, extra: { ticks: ep.clip.frames.length, replays: replays } });

        /* ---- predict ---- */
        for (var qi = 0; qi < ep.predicts.length; qi++) {
          var q = ep.predicts[qi];
          var prompt = nameOf(skin, q.shape) + ": where will it be, and which way round, the " + ORDINAL[q.horizon]
            + " time it leaves the Gate? The Gate stays open.";
          var board = map(skin, ep.world, { shapes: shapesOf(skin, ep.now, q.shape), gate: true, icons: P.icons });
          var grid = function (mark) {
            return '<div class="rw-grid">' + q.options.map(function (o, k) {
              var cls = mark ? (k === q.answer ? "ok" : k === mark.chosen ? "bad" : "") : "";
              return '<div class="rw-opt ' + cls + '"><span class="rw-n">' + (k + 1) + "</span>"
                + map(skin, ep.world, { shapes: [{ s: { loop: o.loop, slot: 1, m: o.m }, colour: skin.shapes[q.shape].colour }], gate: null, unit: 7, zoom: true })
                + "</div>";
            }).join("") + "</div>";
          };
          s.show(head(level, prompt) + board + grid(null));
          s.buttons([1, 2, 3, 4].map(function (k) { return { id: String(k - 1), label: String(k), key: String(k) }; }));
          var r = await s.respond({});
          var chosen = Number(r.id), ok = chosen === q.answer;
          if (ok) score++;
          s.log({ block: episodes, modality: "predict", level: level, correct: ok, rtMs: r.rtMs, response: chosen,
                  extra: { why: q.options[chosen].why, horizon: q.horizon } });
          s.feedback(ok);
          s.show(head(level, (ok ? "✓ " : "✗ ") + nameOf(skin, q.shape) + ": " + tripWords(skin, q.trip) + ".")
            + board + grid({ chosen: chosen }));
          await next();
        }

        /* ---- impossible ---- */
        var iq = ep.impossible, col = skin.shapes[iq.shape].colour;
        var frames = function (reveal) {
          return '<div class="rw-grid rw-two">' + iq.frames.map(function (f, k) {
            var shown = reveal && k === iq.wrong ? f.was : f.m;
            return '<div class="rw-opt ' + (reveal && k === iq.wrong ? "ok" : "") + '"><span class="rw-n">' + (k ? k + 1 : "1 · start") + "</span>"
              + map(skin, ep.world, { shapes: [{ s: { loop: f.loop, slot: f.slot, m: shown }, colour: col }], trail: f.trail,
                    trailColour: col, icons: P.icons, gate: null, unit: 8 })
              + "</div>";
          }).join("") + "</div>";
        };
        s.show(head(level, "Four moments of " + nameOf(skin, iq.shape) + "'s trip, each with the way it came since the one before "
          + "(the Gate open). One of frames 2–4 cannot be. Which?") + frames(false));
        s.buttons([2, 3, 4].map(function (k) { return { id: String(k - 1), label: String(k), key: String(k) }; }));
        var ri = await s.respond({});
        var iok = Number(ri.id) === iq.wrong;
        if (iok) score++;
        s.log({ block: episodes, modality: "impossible", level: level, correct: iok, rtMs: ri.rtMs, response: Number(ri.id),
                extra: { wrong: iq.wrong, alteration: iq.alteration } });
        s.feedback(iok);
        s.show(head(level, (iok ? "✓ " : "✗ ") + "Frame " + (iq.wrong + 1) + " was the wrong one; here it is as it really was.") + frames(true));
        await next();

        /* ---- fog ---- */
        var fq = ep.fog, fname = nameOf(skin, fq.shape);
        s.buttons([]);
        for (var t = 0; t < fq.frames.length; t++) {
          s.show(head(level, "Follow " + fname + " into the fog.")
            + map(skin, ep.world, { shapes: shapesOf(skin, fq.frames[t].shapes, fq.shape), fog: true, icons: P.icons }));
          await s.wait(P.tickMs * s.settings.speed);
        }
        var fogBoard = map(skin, ep.world, { shapes: shapesOf(skin, fq.frames[fq.frames.length - 1].shapes, fq.shape), fog: true, icons: P.icons });
        s.show(head(level, "Which loop is " + fname + " on now?") + fogBoard);
        s.buttons([{ id: "0", label: "Gold", key: "g" }, { id: "1", label: "Silver", key: "s" }]);
        var rl = await s.respond({});
        s.show(head(level, "How sure are you that " + fname + " is on " + loopName(skin, Number(rl.id)) + "?") + fogBoard);
        s.buttons([{ id: "0.95", label: "Sure", key: "1" }, { id: "0.75", label: "Likely", key: "2" }, { id: "0.5", label: "Guess", key: "3" }]);
        var rc = await s.respond({});
        var said = Number(rl.id), conf = Number(rc.id), hit = said === fq.outcome;
        var pSaidTrue = hit ? conf : 1 - conf, brier = Math.round((1 - pSaidTrue) * (1 - pSaidTrue) * 1000) / 1000;
        /* The chance the lane chosen was where it would be, for a judge who knew the world. */
        var pIdeal = said === fq.startLoop ? 1 - fq.pCross : fq.pCross;
        fogs.push({ brier: brier, ideal: pIdeal, conf: conf, hit: hit });
        /* Not `correct`: a right "likely" is still wrong three times in ten,
           and accuracy should not punish that. The Brier score is the grade. */
        s.log({ block: episodes, modality: "fog", level: level, rtMs: rl.rtMs, response: said,
                extra: { confidence: conf, outcome: fq.outcome, hit: hit, brier: brier,
                         pChosen: Math.round(pIdeal * 100) / 100, wants: fq.wants, open: fq.open } });
        var opens = ep.clip.frames.filter(function (f) { return f.open; }).length, tenths = Math.round(10 * opens / ep.clip.frames.length);
        var why = !fq.wants
          ? "It was never going to cross: the Gate does not let its kind across, open or shut. That one was certain."
          : "It was the kind that crosses, so it went wherever the Gate was: " + (fq.open ? "open" : "shut") + " this time. "
            + "In the clip the Gate stood open about " + tenths + " times in 10 — that is how sure to be.";
        s.show(head(level, (hit ? "✓ " : "✗ ") + fname + " is on " + loopName(skin, fq.outcome) + ". " + why)
          + map(skin, ep.world, { shapes: shapesOf(skin, fq.frames[fq.frames.length - 1].shapes, fq.shape), icons: P.icons }));
        await next();

        /* ---- analogy ---- */
        var aq = ep.analogy, other = SKINS.belts;
        var areplays = await play(other, aq.world, aq.clip, P, "A different-looking world. Watch what each part does here.");
        s.show(head(level, "Does this world run on the same rules as the first one, or is one thing different?")
          + map(other, aq.world, { shapes: shapesOf(other, aq.clip.frames[aq.clip.frames.length - 1].shapes), gate: null, icons: P.icons }));
        s.buttons([{ id: "same", label: "Same", key: "s" }, { id: "diff", label: "Different", key: "d" }]);
        var ra = await s.respond({});
        var aok = (ra.id === "same") === aq.same;
        if (aok) score++;
        s.log({ block: episodes, modality: "analogy", level: level, correct: aok, rtMs: ra.rtMs, response: ra.id,
                extra: { same: aq.same, change: aq.change, replays: areplays } });
        s.feedback(aok);
        s.show(head(level, (aok ? "✓ " : "✗ ") + (aq.same
          ? "Same: the same parts doing the same things, under another look."
          : "Different: here " + R.CHANGES[aq.change] + ".")));
        await next();

        /* ---- the level, every episode ---- */
        episodes++;
        var was = level;
        if (score === 4) level = Math.min(12, level + 1);
        else if (score <= 2) level = Math.max(1, level - 1);
        s.show('<div class="rw-card"><p class="rw-big">' + score + " / 4</p><p>"
          + (level > was ? "Up to level " + level + "." : level < was ? "Back to level " + level + "." : "Level " + level + " again.")
          + "</p></div>");
        s.buttons([{ id: "next", label: "Next episode", key: "Enter" }]);
        await s.respond({ accept: ["next"], timeoutMs: 8000 });
      }

      var mean = function (k) { return fogs.length ? Math.round(1000 * fogs.reduce(function (a, f) { return a + f[k]; }, 0) / fogs.length) / 1000 : null; };
      return {
        levelEnd: level, mode: "Ribbon World",
        extra: { episodes: episodes, fog: { trials: fogs.length, brierMean: mean("brier"), sureShare: fogs.length ? fogs.filter(function (f) { return f.conf === 0.95; }).length / fogs.length : null } },
      };
    },
  });
})();
