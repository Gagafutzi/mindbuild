import { SYLLABLES, SYLLABLE_AUDIO, SYLLABLE_MAX_MS } from './syllableAudio';

/*
 * Playing the spoken syllables, at a chosen speed.
 *
 * Decoded once and held, not decoded per trial: decoding is asynchronous, and a
 * stimulus arriving after its own trial has ended is worse than one that never
 * played — the response window has already closed on it. The stretched copies
 * are built the same way, when the rate changes rather than when a trial fires.
 */

/** Slowest and fastest the speech may be played, as a multiple of the render. */
export const SYLLABLE_RATE_MIN = 0.5;
export const SYLLABLE_RATE_MAX = 1.6;

export const clampSyllableRate = (rate: number) =>
  Math.min(SYLLABLE_RATE_MAX, Math.max(SYLLABLE_RATE_MIN, rate || 1));

let ctx: AudioContext | null = null;
/** As decoded, at the rate the clips were rendered. */
const sourceBuffers: (AudioBuffer | null)[] = [];
/** What actually gets played: `sourceBuffers` stretched to `playbackRate`. */
let playBuffers: (AudioBuffer | null)[] = [];
/** The same, said quicker, for every syllable of a word but its last. */
let innerBuffers: (AudioBuffer | null)[] = [];
let playbackRate = 1;
/** The rate `playBuffers` was built at, or null when they need rebuilding. */
let stretchedRate: number | null = null;
let playing: AudioBufferSourceNode | null = null;

/*
 * Time-stretched rather than resampled.
 *
 * Playing the buffer faster is one line — `source.playbackRate` — but it drags
 * the pitch along with it, and at the ends of the range that stops being a
 * speed control and becomes a different voice: a growl at 0.5, a chipmunk at
 * 1.6. Worse, pitch is already a channel here. The tone is a pitch
 * discrimination, and a speed setting that also transposes the speech would
 * quietly change what the two audio channels have in common.
 *
 * So: SOLA. Cut the clip into overlapping frames, lay them down at a different
 * spacing than they were taken at, and cross-fade the overlaps, nudging each
 * frame by up to a few milliseconds to whichever alignment correlates best with
 * what is already written. Periods land on periods, so the pitch survives; only
 * the number of them changes. A handful of milliseconds per clip, spent when
 * the rate is set rather than when a trial fires.
 */
function timeStretch(buffer: AudioBuffer, speed: number): AudioBuffer {
  if (!ctx || Math.abs(speed - 1) < 0.01) return buffer;

  const rate = buffer.sampleRate;
  const input = buffer.getChannelData(0);
  const frame = Math.round(rate * 0.04);      // 40 ms: long enough to hold a pitch period
  const hop = frame >> 1;                     // half-frame overlap, so every sample is faded once
  const search = Math.round(rate * 0.006);    // ±6 ms of alignment freedom
  if (input.length < frame * 2) return buffer;

  const out = new Float32Array(Math.ceil(input.length / speed) + frame);
  out.set(input.subarray(0, frame), 0);
  let written = frame;

  const analysisHop = Math.round(hop * speed);
  for (let m = 1; ; m++) {
    const ideal = m * analysisHop;
    const synth = m * hop;
    if (synth + frame > out.length) break;

    /* Best alignment: the shift whose overlap correlates most with the output
       written so far. Normalised, or loud frames win on volume alone. Coarse
       pass then a fine one around the winner — a full search at every shift is
       four times the arithmetic for a sample or two of difference. */
    let bestShift = 0;
    let bestScore = -Infinity;
    const score = (shift: number) => {
      const start = ideal + shift;
      if (start < 0 || start + frame > input.length) return -Infinity;
      let dot = 0;
      let energy = 0;
      for (let i = 0; i < hop; i += 2) {
        const s = input[start + i];
        dot += out[synth + i] * s;
        energy += s * s;
      }
      return dot / Math.sqrt(energy + 1e-9);
    };
    for (let shift = -search; shift <= search; shift += 4) {
      const sc = score(shift);
      if (sc > bestScore) { bestScore = sc; bestShift = shift; }
    }
    for (let shift = bestShift - 3; shift <= bestShift + 3; shift++) {
      const sc = score(shift);
      if (sc > bestScore) { bestScore = sc; bestShift = shift; }
    }

    const start = ideal + bestShift;
    if (start < 0 || start + frame > input.length) break;
    for (let i = 0; i < hop; i++) {
      const w = i / hop;
      out[synth + i] = out[synth + i] * (1 - w) + input[start + i] * w;
    }
    for (let i = hop; i < frame; i++) out[synth + i] = input[start + i];
    written = synth + frame;
  }

  const stretched = ctx.createBuffer(1, written, rate);
  stretched.copyToChannel(out.subarray(0, written), 0);
  return stretched;
}

function restretch() {
  if (!ctx || stretchedRate === playbackRate) return;
  playBuffers = sourceBuffers.map(b => (b ? timeStretch(b, playbackRate) : null));
  innerBuffers = sourceBuffers.map(b => (b ? timeStretch(b, playbackRate * INNER_SPEEDUP) : null));
  stretchedRate = playbackRate;
}

/** Decode the set, and stretch it, before any trial asks for it. */
export async function primeSyllables(rate?: number) {
  if (rate !== undefined) playbackRate = clampSyllableRate(rate);
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') { try { await ctx.resume(); } catch (e) { /* awaits a gesture */ } }

  await Promise.all(SYLLABLES.map(async (name, i) => {
    if (sourceBuffers[i]) return;
    stretchedRate = null;  // something new to stretch
    const b64 = SYLLABLE_AUDIO[name];
    if (!b64) return;
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
    try { sourceBuffers[i] = await ctx!.decodeAudioData(bytes.buffer); } catch (e) { sourceBuffers[i] = null; }
  }));

  restretch();
}

/** Cheap while the rate is unchanged, so callers may set it whenever. */
export function setSyllableRate(rate: number) {
  playbackRate = clampSyllableRate(rate);
  restretch();
}

/*
 * A pseudoword: `length` syllables said one after another, as one stimulus.
 *
 * The trial's stimulus is a single number, the word's syllables written as
 * digits in base `pool`, so everything that compares stimuli — matches, lures,
 * "not the same as n back" — compares whole words without knowing they are
 * words. A word of one syllable is the syllable itself, so length 1 is exactly
 * the channel as it was.
 */
export const MAX_WORD_SYLLABLES = 6;

export function wordSyllables(code: number, pool: number, length: number): number[] {
  const out: number[] = [];
  let c = code;
  for (let i = 0; i < length; i++) { out.push(c % pool); c = Math.floor(c / pool); }
  return out;
}

/*
 * Said as one word, not as syllables in a row.
 *
 * Each clip is a syllable said on its own: a full release at the end, the
 * pitch falling to rest. Laid end to end they are a list, however short the
 * gap. Every word cannot be rendered ahead — six syllables from 49 is 49^6 of
 * them — so the joins are made to behave the way speech joins:
 *
 * - No gap: each syllable begins under the end of the one before, the two
 *   cross-faded over WORD_OVERLAP_S.
 * - No breath: a clip said alone trails off for up to 200 ms after its last
 *   sound, at -30 to -36 dB. At a junction that is cut, and so is the faint
 *   lead-in before the next onset, though not the onset itself: f and sh
 *   begin quietly and are the cue.
 * - A stop coda unreleased. Said alone, p, t and k close, wait, and burst;
 *   before another consonant inside a word they only close — "bahp-teek" is
 *   said bah(p)teek. So a stop is cut where the vowel ends, its place heard
 *   in the vowel's last transition, and the next onset follows at once. Other
 *   codas (n, ng, l, ss) are sounds of their own and are kept whole.
 * - Onsets at speaking speed. Said alone, an l or sh takes 120-200 ms to rise
 *   into its vowel; inside a word the run-up is held to ONSET_MAX_S, its last
 *   part, where the consonant is clearest. A coda that is kept is held to
 *   CODA_MAX_S past the vowel the same way: an ss said alone hisses for
 *   200 ms.
 * - What closures remain — a stop onset's — held to QUIET_MAX_S.
 * - Every syllable but the last is said INNER_SPEEDUP quicker, the last at
 *   full length: words end long and run through their middle.
 *
 * The level of each syllable is untouched: the clips were matched in loudness
 * so that none is harder to identify than another, and that has to hold
 * inside a word too.
 */
const INNER_SPEEDUP = 1.3;
const WORD_OVERLAP_S = 0.05;
/* All against the clip's loudest 10 ms. */
const TAIL_DB = -28;          // the last sound a junction keeps: a coda clears this, breath does not
const STOP_TAIL_DB = -18;     // a stop coda's: the vowel's end, not the closure after it
const HEAD_DB = -45;          // the first: under any onset, over the render's padding
const QUIET_DB = -30;         // a closure, or a pause
const QUIET_MAX_S = 0.025;    // the longest one kept inside a word
const NUCLEUS_DB = -12;       // where a syllable's vowel has begun
const ONSET_MAX_S = 0.08;     // the longest run-up to it kept inside a word
const CODA_MAX_S = 0.08;      // and the longest run-on after it

/** A clip ready to be joined: trimmed at the ends asked for, its quiet runs
    shortened. Measured on a 10 ms envelope, since single samples of breath
    noise peak far above its loudness. */
function wordPiece(data: Float32Array, rate: number, trimHead: boolean, trimTail: boolean, stopCoda: boolean): Float32Array {
  const win = Math.round(rate * 0.01);
  const env: number[] = [];
  for (let i = 0; i + win <= data.length; i += win) {
    let e = 0;
    for (let j = 0; j < win; j++) e += data[i + j] * data[i + j];
    env.push(Math.sqrt(e / win));
  }
  const peak = Math.max(...env, 1e-9);
  const over = (db: number) => peak * Math.pow(10, db / 20);
  const n = env.length;

  let first = 0, last = n - 1;
  if (trimHead) {
    while (first < last && env[first] < over(HEAD_DB)) first++;
    let nucleus = first;
    while (nucleus < last && env[nucleus] < over(NUCLEUS_DB)) nucleus++;
    first = Math.max(first, nucleus - Math.round(ONSET_MAX_S / 0.01));
  }
  const tailDb = stopCoda ? STOP_TAIL_DB : TAIL_DB;
  if (trimTail) {
    while (last > first && env[last] < over(tailDb)) last--;
    let nucleusEnd = last;
    while (nucleusEnd > first && env[nucleusEnd] < over(NUCLEUS_DB)) nucleusEnd--;
    last = Math.min(last, nucleusEnd + Math.round(CODA_MAX_S / 0.01));
  }
  const a = trimHead ? Math.max(0, first - 1) * win : 0;               // 10 ms before the onset
  const z = trimTail ? Math.min(data.length, (last + (stopCoda ? 2 : 3)) * win) : data.length;  // 10-20 ms after the coda
  if (z - a < data.length / 4) return data;                            // not a clip this understands

  /* Quiet runs inside the kept span, longer than a word would hold them, lose
     their middles. A fade either side of each cut keeps it from clicking. */
  const keepFrames = Math.round(QUIET_MAX_S / 0.01);
  const cuts: [number, number][] = [];
  let run = -1;
  for (let f = Math.ceil(a / win); f <= Math.floor(z / win); f++) {
    const quiet = f < n && env[f] < over(QUIET_DB) && f * win >= a && (f + 1) * win <= z;
    if (quiet && run < 0) run = f;
    if (!quiet && run >= 0) {
      if (f - run > keepFrames) {
        const half = keepFrames >> 1;
        cuts.push([(run + half) * win, (f - (keepFrames - half)) * win]);
      }
      run = -1;
    }
  }
  if (!cuts.length) return data.slice(a, z);

  const fade = Math.round(rate * 0.004);
  const out: number[] = [];
  let at = a;
  for (const [c0, c1] of cuts) {
    for (let i = at; i < c0; i++) out.push(data[i]);
    /* Join the two sides of the cut over `fade` samples. */
    const base = out.length - fade;
    for (let i = 0; i < fade; i++) {
      const w = (i + 0.5) / fade;
      out[base + i] = out[base + i] * (1 - w) + data[c1 - fade + i] * w;
    }
    at = c1;
  }
  for (let i = at; i < z; i++) out.push(data[i]);
  return Float32Array.from(out);
}

/** One buffer for the whole word, so it plays as a single sound with no
    scheduling seams between its syllables. */
function wordBuffer(code: number, pool: number, length: number): AudioBuffer | null {
  if (!ctx) return null;
  const ids = wordSyllables(code, pool, length);
  const parts = ids
    .map((id, k) => ({ buf: k < ids.length - 1 ? innerBuffers[id] : playBuffers[id], stop: /[ptk]$/.test(SYLLABLES[id]) }))
    .filter(p => p.buf) as { buf: AudioBuffer; stop: boolean }[];
  if (!parts.length) return null;
  if (parts.length === 1) return parts[0].buf;
  const rate = parts[0].buf.sampleRate;

  const pieces = parts.map((p, k) =>
    wordPiece(p.buf.getChannelData(0), rate, k > 0, k < parts.length - 1, p.stop));
  /* The overlap scales with the speed, and never takes more than a third of
     either syllable, or a short one would vanish into its neighbours. */
  const want = Math.round((rate * WORD_OVERLAP_S) / playbackRate);
  const overlaps = pieces.slice(1).map((p, k) =>
    Math.max(0, Math.min(want, Math.floor(pieces[k].length / 3), Math.floor(p.length / 3))));

  const total = pieces.reduce((n, p) => n + p.length, 0) - overlaps.reduce((n, o) => n + o, 0);
  const out = ctx.createBuffer(1, total, rate);
  const data = out.getChannelData(0);
  let at = 0;
  pieces.forEach((p, k) => {
    if (k === 0) { data.set(p, 0); at = p.length; return; }
    const o = overlaps[k - 1];
    const from = at - o;
    /* Equal-power, so the junction does not dip in loudness halfway. */
    for (let i = 0; i < o; i++) {
      const w = (i + 0.5) / o;
      data[from + i] = data[from + i] * Math.cos(w * Math.PI / 2) + p[i] * Math.sin(w * Math.PI / 2);
    }
    data.set(p.subarray(o), at);
    at = from + p.length;
  });
  return out;
}

export function playSyllable(code: number, pool: number = SYLLABLES.length, length: number = 1) {
  if (!ctx) return;
  restretch();
  const buf = wordBuffer(code, pool, Math.max(1, Math.round(length)));
  if (!buf) return;
  if (ctx.state === 'suspended') ctx.resume();

  /* One voice at a time. Slow speech under a short interval can still be
     talking when the next trial opens, and two syllables overlapping is a
     trial whose stimulus cannot be named. */
  if (playing) { try { playing.stop(); } catch (e) { /* already finished */ } }

  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.value = 0.9;
  src.connect(g).connect(ctx.destination);
  src.onended = () => { if (playing === src) playing = null; };
  src.start();
  playing = src;
}

/** How long the longest word of `length` syllables runs at a given speed, in
    ms: an upper bound, taking no credit for the trims and overlaps. */
export const syllableMaxMs = (rate: number, length = 1) =>
  Math.round((SYLLABLE_MAX_MS * (1 + (length - 1) / INNER_SPEEDUP)) / clampSyllableRate(rate));

/** For the settings screen: decode if needed, then say one from the pool that
    is in play, at the rate being previewed. */
export async function previewSyllable(rate: number, pool = SYLLABLES.length, length = 1) {
  await primeSyllables(rate);
  const size = Math.min(SYLLABLES.length, Math.max(1, Math.round(pool || SYLLABLES.length)));
  playSyllable(randomWord(size, length), size, length);
}

/** A random word of `length` syllables from the first `pool`, as its code. */
export function randomWord(pool: number, length: number): number {
  let code = 0, place = 1;
  for (let i = 0; i < length; i++) { code += Math.floor(Math.random() * pool) * place; place *= pool; }
  return code;
}
