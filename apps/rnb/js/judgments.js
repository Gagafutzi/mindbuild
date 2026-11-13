"use strict";

/* ============================================================
   9. JUDGMENTS
   ============================================================ */

/* Cardinal direction between two cells as [axis, sign], or null if not axis-aligned. */
function cardinalOf(a, b) {
  /*
   * The same vector the meta judgement uses, so a move can never be named on
   * one axis here and measured on another there.
   *
   * A cardinal move stays on exactly one axis — the invariant this function has
   * always enforced by returning null otherwise — so a spatial move leaves the
   * coordinates alone and a coordinate move leaves the cell alone. `trials.js`
   * draws them that way rather than filtering afterwards.
   */
  const d = moveVectorOf(a, b);
  const nz = d.map((v, i) => [v, i]).filter(([v]) => v !== 0);
  return nz.length === 1 ? [nz[0][1], Math.sign(nz[0][0])] : null;
}

/* [axis, sign] → the axis id everything else in the app speaks. Mirrors the axisJ()
   calls below exactly: +x east, +y south (CSS +Y points DOWN), +z above. If those
   ever disagree the deck would light one arrow and the trace name another. */
const CUBE_CARDINAL_IDS = [['west', 'east'], ['north', 'south'], ['below', 'above']];

/*
 * The axes a move can happen on, named. Three cube pairs and one per
 * coordinate, in the order the coordinates were chosen — the same order
 * `moveVectorOf` builds the vector in.
 *
 * A getter rather than a constant now, because which axes exist is a setting.
 */
function cardinalIds() {
  return CUBE_CARDINAL_IDS.concat(coordAxes().map(k => {
    const poles = coordPoles(k);
    /* [negative, positive], to match the cube pairs above. */
    return [poles[1], poles[0]];
  }));
}
const cardinalId = c => c ? cardinalIds()[c[0]][c[1] > 0 ? 1 : 0] : null;


/**
 * The same move as the eye saw it: projected into the screen frame, then
 * quantised to the six screen directions.
 *
 * Quantised, and at the same `EPS` the first-order screen judgement uses,
 * because the relation has to be derivable from what the player can actually
 * name. A projected vector is floats — two moves that are plainly "the same
 * direction" on screen come back a degree or two apart, and an exact test would
 * call almost every pair oblique. Rounding to the directions the screen deck
 * already answers in makes the second-order question the same question as the
 * first-order one, asked of two moves instead of one.
 *
 * `matrix` is the destination trial's own: the orientation the cube was at when
 * that move was shown, which is the only frame the player could have read it in.
 * The previous move is therefore projected through the previous trial's matrix,
 * not through this one — re-projecting it now would ask about a picture nobody
 * was ever shown.
 *
 * Spatial only. A coordinate axis is a property of the stimulus, not a place in
 * the room, so there is nothing for a rotation to do to it — the cube frame is
 * where those live.
 */
function screenVectorOf(a, b) {
  const ca = state.cells[a.cellIdx], cb = state.cells[b.cellIdx];
  const v = normalise(projectScreen([cb.x - ca.x, cb.y - ca.y, cb.z - ca.z], b.matrix));
  return v.map(c => c > EPS ? 1 : c < -EPS ? -1 : 0);
}



/* The position's step on a cross stream's reference axis, as -1, 0 or +1 (east and
   above are +1, as in CUBE_CARDINAL_IDS). Read off the cells, in the cube frame. */
function crossPositionStep(a, b, key) {
  if (a.cellIdx == null || b.cellIdx == null) return 0;
  const ca = state.cells[a.cellIdx], cb = state.cells[b.cellIdx];
  const d = [cb.x - ca.x, cb.y - ca.y, cb.z - ca.z][crossRef(key)];
  return Math.sign(d);
}

/** Every axis a move happened on, named — so a diagonal can be spelled out. */
function moveNames(v) {
  if (!v) return [];
  const out = [];
  const ids = cardinalIds();
  v.forEach((c, i) => {
    if (c && ids[i]) out.push(ids[i][c > 0 ? 1 : 0]);
  });
  return out;
}

/* The direction this trial's stimulus arrived from — the move you just made, as an
   axis id. Not the pair it was compared against: where the sequence came FROM is
   already spent, and what you need to carry forward is where it is now heading,
   because this move is the one the trial n ahead will be measured against.

   Recomputed from the trial rather than read off the judgement so it stays correct
   for a late press, where the judgement being scored belongs to the interval that
   already closed. Null when there is nothing to draw: the opening trials of a block
   have no partner, and a diagonal has no cardinal direction. */
function moveIntoTrial(trial) {
  const pair = trial && trial.pair;
  return pair ? cardinalId(cardinalOf(pair[0], pair[1])) : null;
}

function buildJudgments(a, b, extra) {
  const js = [];
  const mode = k => cfg.streams[k] || 'off';
  const push = (stream, options, correct) => js.push({ stream, options, correct });
  const axisJ = (stream, v, ids) => {
    push(stream, [ids[0], ids[1]], v > EPS ? [ids[0]] : v < -EPS ? [ids[1]] : []);
  };

  /* --- position --- */
  if (cfg.meta && mode('position') === 'relational') {
    /* Second order: how does this move relate to the previous one? Only defined
       once there IS a previous move, so the first comparison of a block is skipped. */
    const prev = extra && extra.metaPrev;
    if (prev) {
      /*
       * Oblique is asked, and answered by pressing nothing. The options list is
       * three buttons per frame, as it has always been — so the fourth relation
       * costs no response load, which is the only reason it can be added at all
       * at a complexity the deck is already the bottleneck of.
       *
       * It also fixes the base rates. With three relations there was always
       * exactly one correct answer, so a player who pressed nothing scored 0
       * and a player who always pressed the modal answer scored ~2/3; now the
       * empty answer is a real one and holding still has to be earned like the
       * rest.
       *
       * `null` asks nothing at all: that is a move that did not happen, not a
       * relation. In the screen frame it is also a move that went straight into
       * the screen, which quantises to no direction and so has none to relate.
       */
      const metaJ = (bucket, ids, A, B) => {
        const rel = metaRelationOf(A, B);
        if (!rel) return;
        const id = { same: ids[0], opp: ids[1], diff: ids[2] }[rel];
        push(bucket, ids, id ? [id] : []);
      };

      /*
       * The frame is read here now, rather than thrown away.
       *
       * This branch used to be the first arm of the chain and `cfg.frame` was
       * only consulted in the last one, so switching frames under meta changed
       * nothing at all — "both frames" asked the single cube-frame question and
       * the HUD called it quinary. Each frame that is on now asks its own
       * relation and is scored in its own bucket.
       */
      if (cfg.frame === 'cube' || cfg.frame === 'both') {
        /*
         * Vectors, not cardinals. A composite move has no single axis, and the
         * relation between two of them is a dot product — which is what
         * "orthogonal" meant all along and what a different axis was only ever a
         * special case of.
         */
        metaJ('position', ['meta-same', 'meta-opp', 'meta-diff'],
              moveVectorOf(prev[0], prev[1]), moveVectorOf(a, b));
      }
      if (cfg.frame === 'screen' || cfg.frame === 'both') {
        /*
         * The same relation over the same two moves, read off the screen instead
         * of off the cube — and a different answer only in so far as the cube
         * turned between them. That is the whole of what the second frame costs:
         * the cube-frame fact is no longer enough to recover it, so the picture
         * has to be held as well as the move.
         */
        metaJ('position2', ['s-meta-same', 's-meta-opp', 's-meta-diff'],
              screenVectorOf(prev[0], prev[1]), screenVectorOf(a, b));
      }
    }
  } else if (mode('position') === 'identity') {
    push('position', ['pos'], a.cellIdx === b.cellIdx ? ['pos'] : []);
  } else if (mode('position') === 'relational') {
    const ca = state.cells[a.cellIdx], cb = state.cells[b.cellIdx];
    const raw = [cb.x - ca.x, cb.y - ca.y, cb.z - ca.z];

    if (cfg.frame === 'cube' || cfg.frame === 'both') {
      /* Nested frames: the item is answered in the frame its levels set, so a
         mirrored axis is answered the other way round (see the sampler). Marked
         where the mirror changed the answer, for the report. */
      const flip = b.flip || [0, 0, 0];
      const v = normalise(raw).map((x, i) => flip[i] ? -x : x);
      const before = js.length;
      axisJ('position', v[0], ['east', 'west']);
      axisJ('position', v[1], ['south', 'north']);
      axisJ('position', v[2], ['above', 'below']);
      if (b.flip) [0, 1, 2].forEach(i => {
        js[before + i].framed = !!flip[i] && Math.abs(v[i]) > EPS;
      });
      /*
       * One more independent up/down/neither per coordinate axis, asked exactly
       * as the three cube axes are — never a widening list of options, which is
       * what keeps the response cost flat however many axes there are.
       *
       * The sign is passed rather than a normalised component: a step is ±1 in
       * an ordered pool, and normalising a single integer against the spatial
       * magnitude would put it under the movement threshold.
       */
      coordAxes().forEach(k => {
        const poles = coordPoles(k);
        if (!poles[0] || !poles[1]) return;
        axisJ('position', Math.sign((b[k] ?? 0) - (a[k] ?? 0)), poles);
      });
    }
    if (cfg.frame === 'screen' || cfg.frame === 'both') {
      const v = normalise(projectScreen(raw, b.matrix));
      axisJ('position2', v[0], ['s-east', 's-west']);
      axisJ('position2', v[1], ['s-south', 's-north']);
      axisJ('position2', v[2], ['s-near', 's-far']);
    }
  }

  /* --- ordered scalar features --- */
  const scalar = (key, idCommon, idUp, idDown) => {
    const m = mode(key);
    if (m === 'off' || a[key] == null || b[key] == null) return;
    if (m === 'identity') push(key, [idCommon], a[key] === b[key] ? [idCommon] : []);
    else if (m === 'cross') {
      /* The stream's step against the position's step on its reference axis; see
         CROSS_STREAMS. Nothing to press unless both moved in that sense. */
      const own = Math.sign(b[key] - a[key]) * crossUp(key);
      const pos = crossPositionStep(a, b, key);
      push(key, [key + '-xsame', key + '-xopp'],
        own && pos ? [own === pos ? key + '-xsame' : key + '-xopp'] : []);
    }
    else push(key, [idUp, idDown], b[key] > a[key] ? [idUp] : b[key] < a[key] ? [idDown] : []);
  };
  scalar('pitch',    'pitch',  'pitch-up',   'pitch-down');
  scalar('timbre',   'timbre', 'timbre-up',  'timbre-down');
  scalar('pan',      'pan',    'pan-right',  'pan-left');
  scalar('color',    'color',  'color-cool', 'color-warm');  // pool runs warm → cool
  scalar('size',     'size',   'size-up',    'size-down');
  scalar('quantity', 'qty',    'qty-up',     'qty-down');
  /* No up/down pair: `letter` is registered identity-only and its settings row offers
     no relational option, so the scalar helper's ordered branch is unreachable here. */
  if (mode('letter') === 'identity' && a.letter != null && b.letter != null)
    push('letter', ['letter'], a.letter === b.letter ? ['letter'] : []);

  /* --- glyph: identity, or movement across the 2×2 set map + rank --- */
  const gm = mode('glyph');
  if (gm !== 'off' && a.glyphSet != null && b.glyphSet != null) {
    if (gm === 'identity') {
      const same = a.glyphSet === b.glyphSet && a.glyphIdx === b.glyphIdx;
      push('glyph', ['glyph'], same ? ['glyph'] : []);
    } else if (glyphRankOnly()) {
      push('glyph', ['glyph-up','glyph-down'],
        b.glyphIdx > a.glyphIdx ? ['glyph-up'] : b.glyphIdx < a.glyphIdx ? ['glyph-down'] : []);
    } else {
      const pa = state.glyphMap[GLYPH_SET_KEYS[a.glyphSet]];
      const pb = state.glyphMap[GLYPH_SET_KEYS[b.glyphSet]];
      push('glyph', ['glyph-east','glyph-west'],
        pb.x > pa.x ? ['glyph-east'] : pb.x < pa.x ? ['glyph-west'] : []);
      push('glyph', ['glyph-south','glyph-north'],
        pb.y > pa.y ? ['glyph-south'] : pb.y < pa.y ? ['glyph-north'] : []);
      push('glyph', ['glyph-up','glyph-down'],
        b.glyphIdx > a.glyphIdx ? ['glyph-up'] : b.glyphIdx < a.glyphIdx ? ['glyph-down'] : []);
    }
  }
  return js;
}

/* The tally update is written as a signed fold so it can also be run backwards.
   A press that lands just after the stimulus changed was aimed at the trial that
   just left the screen (see press()); crediting it means unapplying the closed
   interval, adding the press, and applying it again. */
function applyInterval(snap, sign) {
  const { judgments, presses, isLure } = snap;
  judgments.forEach(j => {
    const t = state.tally[j.stream] ||
      (state.tally[j.stream] = { ok:0, total:0, empty:0, sigs:{}, hit:0, miss:0, fa:0, cr:0,
                                 key: chanceKey(j.stream) });
    if (!j.correct.length) t.empty += sign;
    /* Histogram of correct-answer patterns. Chance is the best CONSTANT strategy,
       which is "always answer the most common thing" — that equals the never-press
       rate only when a never-press answer exists. Meta-relations had no empty
       answer while it drew only the three relations a button names, so its true
       chance was the modal answer's share (~2/3) rather than 0; with oblique
       drawn as a fourth relation the empty pattern is one of the four and the
       histogram picks up the change without being told. */
    const sig = j.correct.slice().sort().join('|');
    t.sigs[sig] = (t.sigs[sig] || 0) + sign;
    let exact = true;
    j.options.forEach(o => {
      const target = j.correct.includes(o);
      const pressed = presses.has(o);
      if (target && pressed) t.hit += sign;
      else if (target && !pressed) { t.miss += sign; exact = false; }
      else if (!target && pressed) { t.fa += sign; exact = false; }
      else t.cr += sign;
    });
    t.total += sign;
    if (exact) t.ok += sign;
  });

  /* Nested levels: returns and stays, counted apart per item (every judgment
     of the item answered exactly). Signed like the rest, so a late press that
     reopens the interval takes its count back out before putting it in again. */
  const tr = snap.trial_;
  if (tr && (tr.nest === 'out' || tr.nest === 'stay' || tr.nest === 'switch') && judgments.length) {
    const nt = state.nestTally || (state.nestTally = { out: [0, 0], stay: [0, 0], switch: [0, 0] });
    if (!nt.switch) nt.switch = [0, 0];
    const exact = judgments.every(j =>
      j.options.every(o => j.correct.includes(o) === presses.has(o)));
    nt[tr.nest][1] += sign;
    if (exact) nt[tr.nest][0] += sign;
  }

  /* Nested frames: judgments the mirror changed the answer of, apart from the
     rest. The second figure is plain direction; the first is the frame. */
  if (tr && tr.flip) {
    const ft = state.frameTally || (state.frameTally = { framed: [0, 0], plain: [0, 0] });
    judgments.forEach(j => {
      if (j.framed == null) return;
      const exact = j.options.every(o => j.correct.includes(o) === presses.has(o));
      const row = ft[j.framed ? 'framed' : 'plain'];
      row[1] += sign; if (exact) row[0] += sign;
    });
  }

  /* Lure trials get their own tally. Adapting the lure rate on OVERALL accuracy
     would just re-measure what the interval staircase already measures, and the two
     would fight over the same evidence; lure resistance is a separate signal. */
  if (isLure) {
    const lt = state.lureTally || (state.lureTally = { ok:0, total:0, empty:0, sigs:{} });
    judgments.forEach(j => {
      if (!j.correct.length) lt.empty += sign;
      const sig = j.correct.slice().sort().join('|');
      lt.sigs[sig] = (lt.sigs[sig] || 0) + sign;
      const exact = j.options.every(o => j.correct.includes(o) === presses.has(o));
      lt.total += sign;
      if (exact) lt.ok += sign;
    });
  }
  state.scored += sign;
}

const snapMissed = snap =>
  snap.judgments.some(j => j.correct.some(o => !snap.presses.has(o)));

function scoreInterval() {
  /* Reset before the guard: a priming trial with no judgments must not inherit the
     previous interval's result. */
  state.lastSnap = null;
  if (!state.judgments.length) return;
  /* The press set is copied — the live one is cleared for the incoming trial, but
     this one has to stay editable for the length of the grace window. */
  const snap = {
    judgments: state.judgments,
    presses: new Set(state.presses),
    trial: state.trial,
    stimAt: state.stimAt,
    isLure: !!(state.currentTrial && state.currentTrial.isLure),
    /* The trial these judgements belong to. A press inside the grace window is
       scored against this interval, so the trace it triggers has to explain this
       trial's moves and not the one already on screen. */
    trial_: state.currentTrial,
  };
  applyInterval(snap, 1);
  state.lastSnap = snap;
}

/* Chance-corrected accuracy restricted to lure trials. */
function lureScore() {
  const lt = state.lureTally;
  if (!lt || lt.total < LURE_MIN_TRIALS) return null;
  const chance = chanceOf(lt);
  if (chance >= 0.999) return 0;
  return Math.max(0, (lt.ok / lt.total - chance) / (1 - chance));
}

/* Raw accuracy: the fraction of judgments answered exactly right. Intuitive, but its
   chance level moves with the stream — pressing nothing scores ~72% on an identity
   stream (28% target rate) and ~33% on a 3-way relational axis. */
const rawAcc = t => t.total ? t.ok / t.total : 0;

/*
 * Chance, as the share of the commonest correct answer: the best constant strategy.
 *
 * Measured over the LONG RUN for this configuration, not over the block alone.
 * The commonest answer within one 20-trial block is the maximum of a few noisy
 * shares, and a maximum of noisy shares is biased upward: with the four
 * second-order relations equally likely (0.25 each in the long run) a block's
 * commonest one averages about 0.30, which scores every block as if chance were
 * higher than it is and placed the threshold some 4–5% slow.
 *
 * So each stream's answer patterns are pooled across every block played under
 * the same configuration (`chanceKey`), the current block included, and chance
 * is the pooled commonest pattern's pooled share. Until a configuration has
 * history the block's own counts are all there is, which is the old behaviour.
 * A tally with no key (the lure tally) is scored on its own counts.
 */
const CHANCE_STORE = 'rnb_chance_book_v1';
let chanceBook = (() => {
  try { return JSON.parse(localStorage.getItem(CHANCE_STORE)) || {}; } catch (e) { return {}; }
})();

/* What the base rates depend on: the stream, what it is asked as, and the settings
   that change how answers are drawn. Pacing and assists do not change them, so a
   faster interval keeps its history. */
function chanceKey(stream) {
  const c = cfg;
  const pool = typeof poolFor === 'function' && stream !== 'position'
    ? (() => { try { return poolFor(stream, c).length; } catch (e) { return 0; } })() : 0;
  return [stream, c.streams[stream] || 'off', c.meta ? 'meta' : '', c.frame,
          (c.coordAxes || []).join('+'), c.magnitudeCap, c.lureRate, c.gate, c.retro,
          c.varN, pool].join('/') +
    /* Appended, and only when it is on, so that every key written before nested
       levels existed is still the key its configuration looks itself up under.
       Depth is part of it: the deeper the stream, the more of the judged items
       are returns, and the lures a return can carry are not the ones a stay can. */
    (nestDepth(c) ? '/nest' + nestDepth(c) + (nestWidth(c) > 1 ? 'w' + nestWidth(c) : '') +
      (nestFrames(c) ? 'f' : '') : '');
}

function chanceOf(t) {
  if (!t.total) return 1;
  const own = t.sigs || { '': t.empty };
  const past = t.key && chanceBook[t.key];
  if (!past) return Math.max(...Object.values(own)) / t.total;
  const sigs = { ...past.sigs };
  Object.entries(own).forEach(([k, v]) => { sigs[k] = (sigs[k] || 0) + v; });
  return Math.max(...Object.values(sigs)) / (past.total + t.total);
}

/* Fold a finished (or stopped) block's answer patterns into the long-run book. */
function foldChanceBook(tally) {
  Object.values(tally || {}).forEach(t => {
    if (!t.key || !t.total) return;
    const b = chanceBook[t.key] || (chanceBook[t.key] = { total: 0, sigs: {} });
    b.total += t.total;
    Object.entries(t.sigs || {}).forEach(([k, v]) => { b.sigs[k] = (b.sigs[k] || 0) + v; });
  });
  try { localStorage.setItem(CHANCE_STORE, JSON.stringify(chanceBook)); } catch (e) {}
}

/* The long-run chance of a stream under the current configuration, or null with no
   history yet: what the settings hint converts the target with. */
function longRunChance(stream) {
  const b = chanceBook[chanceKey(stream)];
  return b && b.total >= 60 ? Math.max(...Object.values(b.sigs)) / b.total : null;
}

function streamScore(t) {
  if (!t.total) return 0;
  const chance = chanceOf(t);
  if (chance >= 0.999) return 0;
  return Math.max(0, (rawAcc(t) - chance) / (1 - chance));
}

/* Mostly the mean, partly the weakest stream, so you can't win by abandoning one.
   When a stream is cued for priority this block, it carries extra weight — but the
   weakest-link term stays, because variable-priority training means "prioritise X
   WITHOUT dropping the rest", not "ignore the rest". */
function blockScore() {
  const entries = Object.entries(state.tally).filter(([, t]) => t.total);
  if (!entries.length) return 0;
  const scores = entries.map(([, t]) => streamScore(t));
  const mean = scores.reduce((s, a) => s + a, 0) / scores.length;
  const min = Math.min(...scores);

  const cued = state.priorityStream;
  const cuedEntry = cued && entries.find(([k]) => k === cued);
  if (!cuedEntry || entries.length < 2) return 0.6 * mean + 0.4 * min;

  return 0.40 * streamScore(cuedEntry[1]) + 0.35 * mean + 0.25 * min;
}

