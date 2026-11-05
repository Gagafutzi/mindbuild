/* Renders the spoken letters into js/letter-audio.js.

     node apps/rnb/tools/render-letters.mjs

   Needs flite (with its CMU voices) and ffmpeg (with libmp3lame) on the PATH.
   flite's voices are permissively licensed; nothing is downloaded.

   Each letter is rendered as flite says it on its own, then only the silence
   around it is trimmed: from 45 dB under the clip's peak, with 40 ms kept on
   either side and a 10 ms fade at each edge. The earlier clips were cut at
   35 dB, which reached into the sound itself — the Synthetic voice's Y lost
   half its length — and the Synthetic voice was the 8 kHz kal, which has no
   energy above 4 kHz, where the hiss of S, F and X is. It is kal16 now, kept
   under the key "kal" so a saved choice still finds it.

   The letters themselves are LETTER_KEYS in js/constants.js, which says why
   these eight. */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const constants = readFileSync(path.join(here, "..", "js", "constants.js"), "utf8");
const LETTERS = JSON.parse(constants.match(/const LETTER_KEYS = (\[[^\]]*\]);/)[1].replace(/'/g, '"'));
/* Key in LETTER_AUDIO (and in saved settings) → flite voice. */
const VOICES = { slt: "slt", rms: "rms", awb: "awb", kal: "kal16" };
const SR = 16000;

const tmp = mkdtempSync(path.join(tmpdir(), "letters-"));
const out = {};
const report = [];
for (const [key, voice] of Object.entries(VOICES)) {
  out[key] = {};
  for (const L of LETTERS) {
    const wav = path.join(tmp, `${key}-${L}.wav`), pcm = path.join(tmp, `${key}-${L}.f32`), mp3 = path.join(tmp, `${key}-${L}.mp3`);
    execFileSync("flite", ["-voice", voice, "-t", L, "-o", wav]);
    execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", wav, "-ac", "1", "-ar", String(SR), "-f", "f32le", pcm]);
    const b = readFileSync(pcm), x = new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.length));
    /* 10 ms frames; the sound is every frame within 45 dB of the loudest. */
    const F = SR / 100, db = [];
    for (let s = 0; s < x.length; s += F) {
      let e = 0;
      for (let i = s; i < Math.min(x.length, s + F); i++) e += x[i] * x[i];
      db.push(10 * Math.log10(e / F + 1e-12));
    }
    const peak = Math.max(...db), on = db.findIndex((v) => v > peak - 45), off = db.length - 1 - [...db].reverse().findIndex((v) => v > peak - 45);
    const a = Math.max(0, (on - 4) * F), z = Math.min(x.length, (off + 5) * F);
    const y = x.slice(a, z), fade = SR / 100;
    for (let i = 0; i < fade && i < y.length; i++) { y[i] *= i / fade; y[y.length - 1 - i] *= i / fade; }
    writeFileSync(pcm, Buffer.from(y.buffer));
    execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-f", "f32le", "-ar", String(SR), "-ac", "1", "-i", pcm, "-c:a", "libmp3lame", "-b:a", "32k", mp3]);
    out[key][L] = readFileSync(mp3).toString("base64");
    report.push(`${key}-${L} ${(y.length / SR).toFixed(2)}s`);
  }
}
rmSync(tmp, { recursive: true, force: true });

const header = readFileSync(path.join(here, "..", "js", "letter-audio.js"), "utf8").split("const LETTER_AUDIO = ")[0];
const body = "const LETTER_AUDIO = {\n" + Object.entries(out).map(([v, ls]) =>
  `  ${v}: {${Object.entries(ls).map(([L, s]) => `${L}:"${s}"`).join(",")}},`).join("\n") + "\n};\n";
writeFileSync(path.join(here, "..", "js", "letter-audio.js"), header + body);
console.log(report.join("\n"));
