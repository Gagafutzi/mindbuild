#!/usr/bin/env python3
"""
Render the whole-word recordings: public/words/len<L>.bin and syllableWords.ts.

    python3 tools/render-words.py path/to/en-us-libritts-high.onnx

Same voice, same environment as render-syllables.py (see there); run that one
first if the syllable set has changed, since the words are built from it.

WHY WHOLE WORDS. A pseudoword spliced from syllables recorded one at a time is
heard as a list however tight the joins: each syllable keeps the pitch it had
alone, falling to rest. Said as one utterance, the voice runs the word through
the way a word is said — stress on the first syllable, one pitch contour,
consonants carried across the joins. Every word cannot be rendered (six
syllables from 49 is 49^6 of them), so a fixed vocabulary is: WORDS_AT_FULL per
length, which is still far more than a block can make familiar.

NESTED BY VARIETY. The variety setting keeps only the first P syllables of the
inventory in play, P from 4 to 49, and a word may only be heard at P if all its
syllables are among them. So the vocabulary is grown P by P: at each P, words
whose highest syllable is exactly P-1 are added until the words usable at P
number target(P). Every P has its own words, and none sits idle at a larger P.
The app weights its pick by how often a word with that highest syllable would
turn up by chance, so the syllables are heard at the rates free combination
would give them — the low ones are not overused for having been there first.

Each word is said from phonemes, like the syllables: primary stress on the
first, secondary on every other one after it, no syllable break between them
(a "." here is a full stop to this voice, and a pause). Three takes, the median
length kept; trimmed, faded and levelled exactly as the syllables are. A word
still over OUTLIER times its length's median — the voice now and then holds a
syllable or pauses inside a long word — is taken again, up to RETAKES times,
keeping the take nearest the median.

    python3 tools/render-words.py voice.onnx --outliers

re-takes only those, in the files already written.
"""

import importlib.util
import random
import struct
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("render_syllables", HERE / "render-syllables.py")
R = importlib.util.module_from_spec(spec)
spec.loader.exec_module(R)

LENGTHS = range(2, 7)
POOL_MIN = 4
WORDS_AT_FULL = 240
# A word at speaking speed, not the slowed rate the lone syllables have.
LENGTH_SCALE = 1.0
SEED = 20261023
OUTLIER = 1.4
RETAKES = 8

APP = HERE.parent
OUT_DIR = APP / "public" / "words"
INDEX = APP / "syllableWords.ts"

INVENTORY = R.SYLLABLES          # [(spelling, phonemes)], phonemes as "onset ˈ vowel coda ."
K = len(INVENTORY)


def target(pool, length):
    """How many words may be heard with `pool` syllables in play."""
    return min(pool ** length, max(16, round(WORDS_AT_FULL * pool / K)))


def vocabulary(length, rng):
    words, seen = [], set()
    for pool in range(POOL_MIN, K + 1):
        top = pool - 1
        while sum(1 for w in words if max(w) < pool) < target(pool, length):
            if pool == POOL_MIN:
                w = tuple(rng.randrange(pool) for _ in range(length))
            else:
                # At least one syllable is the newly admitted one.
                w = [rng.randrange(pool) for _ in range(length)]
                w[rng.randrange(length)] = top
                w = tuple(w)
            if w not in seen:
                seen.add(w)
                words.append(w)
    return words


def phonemes(word):
    out = []
    for k, sid in enumerate(word):
        p = [x for x in INVENTORY[sid][1] if x not in ("ˈ", ".")]
        stress = "ˈ" if k == 0 else ("ˌ" if k % 2 == 0 else None)
        # The vowel follows the onset: one onset phoneme in this inventory.
        out += p[:1] + ([stress] if stress else []) + p[1:]
    return out + ["."]


def render(voice, phones):
    from piper.config import SynthesisConfig
    ids = voice.phonemes_to_ids(phones)
    audio = voice.phoneme_ids_to_audio(
        ids, SynthesisConfig(speaker_id=R.SPEAKER, length_scale=LENGTH_SCALE,
                             noise_scale=0.5, noise_w_scale=0.6))
    return voice.config.sample_rate, [float(x) for x in audio]


def mp3(samples, rate):
    import lameenc
    enc = lameenc.Encoder()
    enc.set_bit_rate(R.BITRATE)
    enc.set_in_sample_rate(rate)
    enc.set_channels(1)
    enc.set_quality(2)
    pcm = struct.pack(f"<{len(samples)}h", *[int(round(max(-1.0, min(1.0, x)) * 32767)) for x in samples])
    return enc.encode(pcm) + enc.flush()


def take(voice, word):
    rate, raw = render(voice, phonemes(word))
    return rate, R.trim(raw, rate)


def word_mp3(voice, word, takes=3, near=None):
    """The word's MP3 and its length in seconds: the median of `takes`, or the
    take nearest `near` seconds when given."""
    got = [take(voice, word) for _ in range(takes)]
    rate = got[0][0]
    clips = [c for _, c in got]
    if near is None:
        clips.sort(key=len)
        pick = clips[len(clips) // 2]
    else:
        pick = min(clips, key=lambda c: abs(len(c) / rate - near))
    samples = R.level(R.fade(pick, rate))
    return mp3(samples, rate), len(samples) / rate


def fix_outliers(voice, length, words, clips, secs):
    """Re-take every word over OUTLIER x the median, in place."""
    med = sorted(secs)[len(secs) // 2]
    for i, w in enumerate(words):
        if secs[i] > OUTLIER * med:
            before = secs[i]
            clips[i], secs[i] = word_mp3(voice, w, RETAKES, near=med)
            name = "".join(INVENTORY[s][0] for s in w)
            print(f"  len {length}  retook {name}: {before:.2f}s -> {secs[i]:.2f}s (median {med:.2f})", file=sys.stderr)


def write_set(length, clips):
    (OUT_DIR / f"len{length}.bin").write_bytes(b"".join(clips))


def write_index(sets):
    lines = [
        "/*",
        " * The whole-word recordings: which words there are, and where each one's",
        " * MP3 sits in public/words/len<L>.bin. Written by tools/render-words.py,",
        " * which says why and how; re-run it rather than editing this by hand.",
        " * Same voice and licence as syllableAudio.ts (LibriTTS, CC BY 4.0).",
        " */",
        "",
        "export interface WordSet {",
        "  /** Each word as syllable indices into SYLLABLES, in the order said. */",
        "  words: number[][];",
        "  /** Each word's MP3 length in bytes, laid end to end in the file. */",
        "  bytes: number[];",
        "  /** The longest word, as rendered. */",
        "  maxMs: number;",
        "}",
        "",
        "export const WORD_SETS: Record<number, WordSet> = {",
    ]
    for length, words, clips, secs in sets:
        sizes = [len(c) for c in clips]
        lines.append(f"  {length}: {{")
        lines.append(f"    maxMs: {round(1000 * max(secs))},")
        lines.append("    words: [")
        for i in range(0, len(words), 12):
            lines.append("      " + " ".join("[" + ",".join(map(str, w)) + "]," for w in words[i:i + 12]))
        lines.append("    ],")
        lines.append("    bytes: [")
        for i in range(0, len(sizes), 16):
            lines.append("      " + " ".join(f"{s}," for s in sizes[i:i + 16]))
        lines.append("    ],")
        lines.append("  },")
    lines.append("};")
    INDEX.write_text("\n".join(lines) + "\n")
    print(f"wrote {INDEX}", file=sys.stderr)


def read_written():
    """The sets as last written: words, per-word MP3s, and their lengths
    (from size, the encoding being constant-bitrate)."""
    import json, re
    src = INDEX.read_text()
    sets = []
    for m in re.finditer(r"  (\d+): \{\n    maxMs: \d+,\n    words: \[(.*?)\],\n    bytes: \[(.*?)\],", src, re.S):
        length = int(m.group(1))
        words = [tuple(w) for w in json.loads("[" + m.group(2).strip().rstrip(",") + "]")]
        sizes = json.loads("[" + m.group(3).strip().rstrip(",") + "]")
        blob = (OUT_DIR / f"len{length}.bin").read_bytes()
        clips, at = [], 0
        for n in sizes:
            clips.append(blob[at:at + n])
            at += n
        sets.append((length, words, clips, [n * 8 / (R.BITRATE * 1000) for n in sizes]))
    return sets


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__, file=sys.stderr)
        return 2
    voice = R.load_voice(sys.argv[1])
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    if "--outliers" in sys.argv:
        sets = read_written()
        for length, words, clips, secs in sets:
            fix_outliers(voice, length, words, clips, secs)
            write_set(length, clips)
        write_index(sets)
        return 0

    rng = random.Random(SEED)
    sets = []
    for length in LENGTHS:
        words = vocabulary(length, rng)
        clips, secs = [], []
        for n, w in enumerate(words):
            data, sec = word_mp3(voice, w)
            clips.append(data)
            secs.append(sec)
            if n % 40 == 0:
                name = "".join(INVENTORY[s][0] for s in w)
                print(f"  len {length}  {n:>3}/{len(words)}  {name:<24} {sec:.2f}s", file=sys.stderr)
        fix_outliers(voice, length, words, clips, secs)
        write_set(length, clips)
        print(f"len {length}: {len(words)} words, {sum(map(len, clips)) / 1024:.0f}KB, longest {max(secs):.2f}s", file=sys.stderr)
        sets.append((length, words, clips, secs))
    write_index(sets)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
