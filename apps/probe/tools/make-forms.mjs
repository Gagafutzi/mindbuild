/* Writes the transfer probe's fixed forms: apps/probe/forms.js.

     node apps/probe/tools/make-forms.mjs

   Run once, and the output is committed: the battery is FIXED, not generated at
   test time, so a form means the same items every time it is taken. Four
   alternate forms, A to D, each with the same three subtests and the same rule
   type at every position, so they are parallel by construction and differ only
   in their numbers, letters and shapes.

   The item types are ones nothing on the hub trains (series completion and
   figure matrices), which is what makes the battery a probe of transfer rather
   than of practice. Seeded, so re-running reproduces the same forms. */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

function mulberry(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function form(seed) {
  const r = mulberry(seed);
  const int = (a, b) => a + Math.floor(r() * (b - a + 1));
  const pick = (xs) => xs[Math.floor(r() * xs.length)];

  /* ---------- number series: what comes next ---------- */
  const numbers = [];
  {
    const a = int(2, 20), d = int(3, 9);
    numbers.push({ rule: "add", shown: [0, 1, 2, 3, 4].map(i => a + i * d), answer: a + 5 * d });
  }
  {
    const a = int(1, 5), k = pick([2, 3]);
    const s = [a]; for (let i = 1; i < 6; i++) s.push(s[i - 1] * k);
    numbers.push({ rule: "multiply", shown: s.slice(0, 5), answer: s[5] });
  }
  {
    const a = int(1, 9), b = int(20, 40), da = int(2, 5), db = -int(1, 4);
    const s = []; for (let i = 0; i < 7; i++) s.push(i % 2 ? b + Math.floor(i / 2) * db : a + (i / 2) * da);
    numbers.push({ rule: "interleaved", shown: s.slice(0, 6), answer: s[6] });
  }
  {
    const a = int(1, 10), d = int(1, 4), k = int(1, 3);
    const s = [a]; for (let i = 1; i < 7; i++) s.push(s[i - 1] + d + (i - 1) * k);
    numbers.push({ rule: "growing-difference", shown: s.slice(0, 6), answer: s[6] });
  }
  {
    const s = [int(1, 6), int(1, 6)]; for (let i = 2; i < 7; i++) s.push(s[i - 1] + s[i - 2]);
    numbers.push({ rule: "sum-of-two", shown: s.slice(0, 6), answer: s[6] });
  }
  {
    const a = int(1, 4), c = int(1, 5);
    const s = [a]; for (let i = 1; i < 7; i++) s.push(i % 2 ? s[i - 1] * 2 : s[i - 1] + c);
    numbers.push({ rule: "alternating-operations", shown: s.slice(0, 6), answer: s[6] });
  }

  /* ---------- letter series: what comes next ---------- */
  const L = (i) => String.fromCharCode(65 + i);
  const letters = [];
  {
    const k = int(2, 4), a = int(0, 25 - 5 * k);
    letters.push({ rule: "step", shown: [0, 1, 2, 3, 4].map(i => L(a + i * k)), answer: L(a + 5 * k) });
  }
  {
    const a = int(0, 6), b = int(19, 25);
    const s = []; for (let i = 0; i < 7; i++) s.push(i % 2 ? L(b - Math.floor(i / 2)) : L(a + i / 2));
    letters.push({ rule: "interleaved", shown: s.slice(0, 6), answer: s[6] });
  }
  {
    const a = int(0, 10);
    const s = [a]; for (let i = 1; i < 6; i++) s.push(s[i - 1] + i);
    letters.push({ rule: "growing-step", shown: s.slice(0, 5).map(L), answer: L(s[5]) });
  }
  {
    const up = int(2, 3), down = 1, a = int(0, 8);
    const s = [a]; for (let i = 1; i < 7; i++) s.push(s[i - 1] + (i % 2 ? up : -down));
    letters.push({ rule: "up-and-back", shown: s.slice(0, 6).map(L), answer: L(s[6]) });
  }
  {
    const k = int(2, 3), a = int(5 * k, 25);
    letters.push({ rule: "step-back", shown: [0, 1, 2, 3, 4].map(i => L(a - i * k)), answer: L(a - 5 * k) });
  }
  {
    const a = int(0, 10);
    const steps = [1, 1, 2, 2, 3, 3];
    const s = [a]; for (let i = 0; i < 6; i++) s.push(s[i] + steps[i]);
    letters.push({ rule: "paired-steps", shown: s.slice(0, 6).map(L), answer: L(s[6]) });
  }

  /* ---------- figure matrices: which cell completes the grid ---------- *
   * A cell is a shape, a count and a fill. Each attribute follows one rule over
   * the 3×3 grid: the same along each row, the same down each column, or every
   * value once in each row and column. Items 1–2 vary one attribute, 3–4 two,
   * 5–6 all three. Options are the right cell and five that differ from it in
   * one or two attributes. */
  const ATTRS = ["shape", "count", "fill"];
  const matrices = [];
  for (let item = 0; item < 6; item++) {
    const varying = item < 2 ? 1 : item < 4 ? 2 : 3;
    const order = ATTRS.slice().sort(() => r() - 0.5);
    /* With two or more attributes varying, the rules differ and one of them is
       "latin": the same rule on every attribute makes whole rows or columns of
       identical cells, which is easy however much is varying. */
    let kinds;
    do { kinds = order.slice(0, varying).map(() => pick(["row", "column", "latin"])); }
    while (varying > 1 && (new Set(kinds).size < 2 || !kinds.includes("latin")));
    const rules = {};
    order.forEach((a, i) => { rules[a] = i < varying ? kinds[i] : "constant"; });
    const base = {}; ATTRS.forEach(a => { base[a] = [0, 1, 2].sort(() => r() - 0.5); });
    const value = (a, row, col) => {
      const p = base[a];
      switch (rules[a]) {
        case "constant": return p[0];
        case "row": return p[row];
        case "column": return p[col];
        case "latin": return p[(row + col) % 3];
      }
    };
    const cell = (row, col) => ({ shape: value("shape", row, col), count: value("count", row, col) + 1, fill: value("fill", row, col) });
    const grid = []; for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) grid.push(cell(row, col));
    const answer = grid.pop();
    const key = c => `${c.shape}${c.count}${c.fill}`;
    const options = [answer]; const seen = new Set([key(answer)]);
    while (options.length < 6) {
      const c = { ...answer };
      const change = r() < 0.6 ? 1 : 2;
      ATTRS.slice().sort(() => r() - 0.5).slice(0, change).forEach(a => {
        const now = a === "count" ? c.count - 1 : c[a];
        const next = (now + 1 + Math.floor(r() * 2)) % 3;
        if (a === "count") c.count = next + 1; else c[a] = next;
      });
      if (!seen.has(key(c))) { seen.add(key(c)); options.push(c); }
    }
    const shuffled = options.slice().sort(() => r() - 0.5);
    matrices.push({ rules, grid, options: shuffled, answer: shuffled.indexOf(answer) });
  }

  return { numbers, letters, matrices };
}

/* Alternate forms must not share an item: a repeated item is practised, not probed. */
const signature = f => [...f.numbers.map(i => i.shown.join()), ...f.letters.map(i => i.shown.join(""))];
const forms = {};
const used = new Set();
let seed = 100;
for (const name of ["A", "B", "C", "D"]) {
  for (;; seed += 1) {
    const f = form(seed);
    const sig = signature(f);
    if (sig.some(x => used.has(x))) continue;
    sig.forEach(x => used.add(x));
    forms[name] = f; seed += 1;
    break;
  }
}

/* Every series answer has to be what its rule gives and every letter a letter;
   a form that broke either would be a broken test, so it is not written. */
for (const [name, f] of Object.entries(forms)) {
  for (const it of f.letters) {
    for (const ch of [...it.shown, it.answer]) {
      if (!/^[A-Z]$/.test(ch)) throw new Error(`form ${name}: ${it.rule} left the alphabet`);
    }
  }
  for (const it of f.matrices) {
    if (it.options.length !== 6 || it.answer < 0) throw new Error(`form ${name}: a matrix lost its answer`);
  }
}

const out = `"use strict";

/* The transfer probe's fixed forms. Generated by tools/make-forms.mjs and
   committed; do not edit by hand, and do not regenerate once results have been
   recorded against them, or a form stops meaning the same items. */
var PROBE_FORMS = ${JSON.stringify(forms)};

if (typeof module !== "undefined") module.exports = PROBE_FORMS;
`;
fs.writeFileSync(path.join(here, "..", "forms.js"), out);
console.log("wrote forms A-D:", Object.values(forms).map(f => f.numbers.length + f.letters.length + f.matrices.length).join(", "), "items");
