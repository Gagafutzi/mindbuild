#!/usr/bin/env python3
"""
Render a phrase in many voices to WAV, for Antiphon's audio machine.

Why this exists
---------------
The audio machine wants many takes of one short phrase playing *at the same
time*. The browser cannot reliably do that with live speech: `speechSynthesis`
is one serial queue per browsing context, and while separate frames get
separate queues, Firefox funnels them all into a single speech-dispatcher
client, which queues them again. Pre-rendering sidesteps the question entirely
— once the takes are audio files, the app's Web Audio path layers them with
real simultaneity, plus the offset, detune and stereo scatter it already has.

It talks to libespeak-ng through ctypes rather than shelling out, because the
espeak-ng *binary* is not installed here while the library is. Nothing new to
install, no network, nothing that belongs to anyone else.

Usage
-----
    python3 tools/render-voices.py --lang de --phrase "ich auch" --count 16
    python3 tools/render-voices.py --lang de --phrases-file phrases.txt \\
        --count 24 --takes 2 --out voices/

Then open the app, Audio machine → Choose Files → select everything in the
output directory. Source can stay on `auto`: cached recordings win over the
live voices.

The output directory is gitignored. These are espeak-ng renders, so unlike a
voice actor's recordings they are yours to keep — but they are build output,
not source, and the repository has no reason to carry them.
"""

import argparse
import ctypes
import os
import random
import re
import sys
import wave

LIB_CANDIDATES = [
    "libespeak-ng.so.1",
    "/usr/lib/x86_64-linux-gnu/libespeak-ng.so.1",
    "libespeak-ng.so",
]
VARIANT_DIRS = [
    "/usr/lib/x86_64-linux-gnu/espeak-ng-data/voices/!v",
    "/usr/share/espeak-ng-data/voices/!v",
]

AUDIO_OUTPUT_SYNCHRONOUS = 2
ESPEAK_CHARS_UTF8 = 1
# espeak_SetParameter ids
RATE, VOLUME, PITCH, RANGE = 1, 2, 3, 4


def load_lib():
    for name in LIB_CANDIDATES:
        try:
            return ctypes.CDLL(name)
        except OSError:
            continue
    sys.exit("libespeak-ng not found. Install libespeak-ng1, or edit LIB_CANDIDATES.")


def variants():
    for d in VARIANT_DIRS:
        if os.path.isdir(d):
            # Names with spaces ("Mr serious") are skipped: they are not
            # addressable as `lang+name` without quoting games that differ
            # between espeak builds, and there are eighty others.
            return sorted(v for v in os.listdir(d) if " " not in v)
    return []


class Espeak:
    """One process-wide espeak instance, captured through the synth callback."""

    def __init__(self):
        self.lib = load_lib()
        self.rate_hz = self.lib.espeak_Initialize(AUDIO_OUTPUT_SYNCHRONOUS, 0, None, 0)
        if self.rate_hz < 1:
            sys.exit("espeak_Initialize failed.")
        self._buf = bytearray()

        cb_type = ctypes.CFUNCTYPE(
            ctypes.c_int, ctypes.POINTER(ctypes.c_short), ctypes.c_int, ctypes.c_void_p
        )

        def _cb(wav, numsamples, events):
            # wav NULL marks the end of this utterance; numsamples 0 is a
            # progress tick with nothing attached.
            if wav and numsamples > 0:
                self._buf += ctypes.string_at(wav, numsamples * 2)
            return 0

        # Held on the instance so the trampoline is not collected mid-synthesis,
        # which segfaults rather than failing politely.
        self._cb = cb_type(_cb)
        self.lib.espeak_SetSynthCallback(self._cb)

    def set_voice(self, name):
        return self.lib.espeak_SetVoiceByName(name.encode()) == 0

    def set_params(self, rate=None, pitch=None, rng=None, volume=None):
        for pid, val in ((RATE, rate), (PITCH, pitch), (RANGE, rng), (VOLUME, volume)):
            if val is not None:
                self.lib.espeak_SetParameter(pid, int(val), 0)

    def render(self, text):
        self._buf = bytearray()
        data = text.encode("utf-8")
        self.lib.espeak_Synth(
            data, len(data) + 1, 0, 0, 0, ESPEAK_CHARS_UTF8, None, None
        )
        self.lib.espeak_Synchronize()
        return bytes(self._buf)


def write_wav(path, pcm, rate_hz):
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate_hz)
        w.writeframes(pcm)


def slug(s, n=24):
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return (s[:n] or "phrase")


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("Usage")[0].strip())
    ap.add_argument("--lang", default="de", help="espeak language code (default: de)")
    ap.add_argument("--phrase", action="append", default=[],
                    help="phrase to render; repeatable")
    ap.add_argument("--phrases-file", help="file with one phrase per line")
    ap.add_argument("--count", type=int, default=16,
                    help="how many distinct voices (default: 16)")
    ap.add_argument("--takes", type=int, default=1,
                    help="renders per voice per phrase (default: 1)")
    ap.add_argument("--out", default="voices", help="output directory")
    ap.add_argument("--rate", type=int, default=160, help="base words/min")
    ap.add_argument("--rate-jitter", type=int, default=25)
    ap.add_argument("--pitch", type=int, default=50, help="base pitch 0-99")
    ap.add_argument("--pitch-jitter", type=int, default=20)
    ap.add_argument("--seed", type=int, default=None)
    ap.add_argument("--list-variants", action="store_true")
    args = ap.parse_args()

    pool = variants()
    if args.list_variants:
        print(f"{len(pool)} variants:")
        print(" ".join(pool))
        return

    phrases = list(args.phrase)
    if args.phrases_file:
        with open(args.phrases_file, encoding="utf-8") as f:
            phrases += [ln.strip() for ln in f if ln.strip()]
    if not phrases:
        sys.exit("Give at least one --phrase or a --phrases-file.")

    if args.seed is not None:
        random.seed(args.seed)

    if not pool:
        print("No variant voices found; rendering the plain language voice only.",
              file=sys.stderr)
        chosen = [None]
    else:
        # Spread across the pool rather than sampling it, so sixteen voices are
        # sixteen different ones instead of a lucky dip with repeats.
        step = max(1, len(pool) // max(1, args.count))
        chosen = pool[::step][: args.count]

    os.makedirs(args.out, exist_ok=True)
    eng = Espeak()
    written = skipped = 0

    for phrase in phrases:
        for variant in chosen:
            name = args.lang if variant is None else f"{args.lang}+{variant}"
            if not eng.set_voice(name):
                skipped += 1
                continue
            for take in range(args.takes):
                eng.set_params(
                    rate=args.rate + random.randint(-args.rate_jitter, args.rate_jitter),
                    pitch=max(0, min(99, args.pitch
                                     + random.randint(-args.pitch_jitter, args.pitch_jitter))),
                    rng=random.randint(40, 90),
                )
                pcm = eng.render(phrase)
                if not pcm:
                    skipped += 1
                    continue
                fn = f"{slug(phrase)}_{variant or 'plain'}_{take}.wav"
                write_wav(os.path.join(args.out, fn), pcm, eng.rate_hz)
                written += 1

    print(f"{written} file(s) in {args.out}/ at {eng.rate_hz} Hz"
          + (f", {skipped} skipped" if skipped else ""))
    if written:
        print("Load them in the app: Audio machine → Choose Files → select all.")


if __name__ == "__main__":
    main()
