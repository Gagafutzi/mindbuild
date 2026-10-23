import { SYLLABLES, SYLLABLE_AUDIO, SYLLABLE_MAX_MS } from './syllableAudio';
import { WORD_SETS } from './syllableWords';

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
export async function primeSyllables(rate?: number, length = 1) {
  if (rate !== undefined) playbackRate = clampSyllableRate(rate);
  /* At the rate the voice was rendered: nothing is lost, and a length's worth
     of decoded words takes half the memory it would at 48 kHz. */
  if (!ctx) {
    try { ctx = new AudioContext({ sampleRate: 22050 }); } catch (e) { ctx = new AudioContext(); }
  }
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
  if (length >= 2) await primeWords(length);
}

/** Cheap while the rate is unchanged, so callers may set it whenever. Words
    already loaded are re-stretched in the background, spliced until then. */
export function setSyllableRate(rate: number) {
  playbackRate = clampSyllableRate(rate);
  restretch();
  for (const length of Object.keys(loadedWords)) void primeWords(Number(length));
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
 * Whole words, recorded as words.
 *
 * Spliced syllables are heard as a list however tight the joins — each keeps
 * the pitch it had said alone — so words of two or more syllables come from
 * a fixed vocabulary said whole by the same voice: tools/render-words.py, which
 * explains the vocabulary. One file per length, fetched when that length is
 * first primed and decoded all at once, for the same reason the syllables are:
 * a decode is asynchronous, and a stimulus has to start on time.
 *
 * Where a length's file is missing or will not load, everything falls back to
 * free combination and splicing (below), which is how the channel worked
 * before the recordings existed.
 */
interface LoadedWords {
  bytes: ArrayBuffer | null;
  /** Decoded and stretched to `rate`; empty until the first load is done. */
  buffers: (AudioBuffer | null)[];
  rate: number | null;
  index: Map<string, number>;
  loading: Promise<void> | null;
}
const loadedWords: Record<number, LoadedWords> = {};
const wordKey = (ids: number[]) => ids.join('.');

async function primeWords(length: number): Promise<void> {
  const set = WORD_SETS[length];
  if (!set || !ctx) return;
  const w = (loadedWords[length] ||= {
    bytes: null, buffers: [], rate: null, loading: null,
    index: new Map(set.words.map((ids, i) => [wordKey(ids), i])),
  });
  while (w.loading) await w.loading;
  if (w.rate === playbackRate) return;
  w.loading = (async () => {
    try {
      if (!w.bytes) {
        /* Relative to the page, which sits at the app's base in every build. */
        const res = await fetch(`words/len${length}.bin`);
        if (!res.ok) throw new Error(String(res.status));
        w.bytes = await res.arrayBuffer();
      }
      const rate = playbackRate;
      let at = 0;
      const spans = set.bytes.map(n => { const a = at; at += n; return [a, at] as const; });
      const bytes = w.bytes;
      w.buffers = await Promise.all(spans.map(async ([a, z]) => {
        try { return timeStretch(await ctx!.decodeAudioData(bytes.slice(a, z)), rate); } catch (e) { return null; }
      }));
      w.rate = rate;
    } catch (e) {
      /* No recordings for this length: it stays spliced. */
    } finally {
      w.loading = null;
    }
  })();
  await w.loading;
  if (w.rate !== null && w.rate !== playbackRate) await primeWords(length);  // the rate moved while loading
}

const wordsReady = (length: number) => {
  const w = loadedWords[length];
  return !!w && w.rate !== null && w.buffers.length > 0;
};

function recordedWord(code: number, pool: number, length: number): AudioBuffer | null {
  const w = loadedWords[length];
  if (!w || w.rate !== playbackRate) return null;
  const i = w.index.get(wordKey(wordSyllables(code, pool, length)));
  return i === undefined ? null : w.buffers[i] ?? null;
}

/*
 * Picking from the vocabulary as if picking freely.
 *
 * Usable with `pool` syllables in play: the words whose syllables are all
 * below it. They were not drawn uniformly — the vocabulary was grown pool by
 * pool, so a word made only of the first ten syllables is far commoner in it
 * than in free combination. Each word is weighted by how likely a free word
 * is to have its highest syllable, shared among the recorded words that do:
 * then the highest syllable, and with it every syllable's rate, comes out as
 * free combination would give it.
 */
const pickTables = new Map<string, { codes: number[]; cumulative: number[] }>();

function pickTable(pool: number, length: number) {
  const key = `${pool}/${length}`;
  let t = pickTables.get(key);
  if (t) return t;
  const words = WORD_SETS[length].words.filter(ids => Math.max(...ids) < pool);
  const perTop = new Map<number, number>();
  words.forEach(ids => { const m = Math.max(...ids); perTop.set(m, (perTop.get(m) || 0) + 1); });
  const codes: number[] = [], cumulative: number[] = [];
  let total = 0;
  for (const ids of words) {
    const m = Math.max(...ids);
    total += (Math.pow(m + 1, length) - Math.pow(m, length)) / perTop.get(m)!;
    codes.push(ids.reduce((c, id, k) => c + id * Math.pow(pool, k), 0));
    cumulative.push(total);
  }
  t = { codes, cumulative };
  pickTables.set(key, t);
  return t;
}

/*
 * Said as one word, not as syllables in a row — the fallback, where there is
 * no recording.
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
  const len = Math.max(1, Math.round(length));
  const buf = (len >= 2 ? recordedWord(code, pool, len) : null) || wordBuffer(code, pool, len);
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
  Math.round(Math.max(
    length >= 2 && WORD_SETS[length] ? WORD_SETS[length].maxMs : 0,
    SYLLABLE_MAX_MS * (1 + (length - 1) / INNER_SPEEDUP),
  ) / clampSyllableRate(rate));

/** For the settings screen: decode if needed, then say one from the pool that
    is in play, at the rate being previewed. */
export async function previewSyllable(rate: number, pool = SYLLABLES.length, length = 1) {
  await primeSyllables(rate, length);
  const size = Math.min(SYLLABLES.length, Math.max(1, Math.round(pool || SYLLABLES.length)));
  playSyllable(randomWord(size, length), size, length);
}

/** A random word of `length` syllables from the first `pool`, as its code:
    from the recorded vocabulary once it is loaded, freely otherwise. */
export function randomWord(pool: number, length: number): number {
  if (length >= 2 && wordsReady(length)) {
    const { codes, cumulative } = pickTable(pool, length);
    if (codes.length) {
      const r = Math.random() * cumulative[cumulative.length - 1];
      let lo = 0, hi = cumulative.length - 1;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (cumulative[mid] > r) hi = mid; else lo = mid + 1; }
      return codes[lo];
    }
  }
  let code = 0, place = 1;
  for (let i = 0; i < length; i++) { code += Math.floor(Math.random() * pool) * place; place *= pool; }
  return code;
}
