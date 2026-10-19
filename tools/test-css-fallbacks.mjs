#!/usr/bin/env node
/*
 * Tests for the sRGB fallbacks.
 *
 *   node tools/test-css-fallbacks.mjs
 *
 * The interesting one is the last: Tailwind publishes its own hex for many of
 * the same palette entries, in the fallbacks it writes outside its @supports
 * guards. That makes this conversion checkable against the generator's own
 * answer rather than against itself.
 */

import fs from "node:fs";
import { oklchToHex, customPropsWithOklch, convert, unlayer,
         colorMixFallback, colorMixPass } from "./css-fallbacks.mjs";

let failed = 0;
function test(name, fn) {
  try { fn(); console.log("  ok  " + name); }
  catch (e) { failed++; console.log("FAIL  " + name + "\n      " + e.message); }
}
function eq(a, b, what) {
  if (a !== b) throw new Error((what || "") + " expected " + JSON.stringify(b) + ", got " + JSON.stringify(a));
}

const ok = (s) => oklchToHex(s, s.slice(s.indexOf("(") + 1, s.lastIndexOf(")")));

test("black, white and mid grey land where they should", () => {
  eq(ok("oklch(0% 0 0)"), "#000000", "black");
  eq(ok("oklch(100% 0 0)"), "#ffffff", "white");
  /* L is perceptual, so 50% is not #808080 — it is markedly darker, around
     #636363. A conversion that returned #808080 here would be treating L as an
     sRGB value and skipping the transfer function entirely, which is the most
     likely way for this to be wrong and still look plausible. */
  const grey = ok("oklch(50% 0 0)");
  eq(grey.slice(1, 3), grey.slice(3, 5), "grey is neutral");
  eq(grey.slice(3, 5), grey.slice(5, 7), "grey is neutral");
  const v = parseInt(grey.slice(1, 3), 16);
  if (v < 95 || v > 103) throw new Error("mid L came out " + grey + ", expected about #636363");
});

test("alpha is carried through", () => {
  eq(ok("oklch(0% 0 0 / 50%)").length, 9, "八 digits plus hash");
  eq(ok("oklch(0% 0 0 / 50%)").slice(7), "80");
  eq(ok("oklch(0% 0 0 / 1)"), "#000000", "opaque needs no alpha pair");
});

test("a value it cannot read is left alone rather than guessed", () => {
  eq(ok("oklch(from red l c h)"), null);
  eq(ok("oklch(50%)"), null);
});

test("out-of-gamut colours keep their hue", () => {
  /* Clamping each channel instead would pull this toward orange. The red
     channel saturates either way; what must not move is the ratio of the
     other two. */
  const hex = ok("oklch(57.7% 0.245 27.325)");
  const g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  if (Math.abs(g - b) > 24) throw new Error("hue shifted on an out-of-gamut red: " + hex);
});

test("only custom properties are picked up", () => {
  const found = customPropsWithOklch(":root{--a:oklch(50% .1 20);color:oklch(50% .1 20)}");
  eq(found.length, 1);
  eq(found[0].name, "--a");
});

test("the restatement is guarded and the declaration is rewritten", () => {
  const r = convert("x.css", ":root{--a:oklch(0% 0 0)}");
  if (!r.css.includes("--a:#000000")) throw new Error("the declaration was not rewritten: " + r.css);
  if (!r.css.includes("@supports (color:oklch(0 0 0)){:root{--a:oklch(0% 0 0);}}"))
    throw new Error("the original was not restated under @supports: " + r.css);
});

test("running it twice changes nothing the second time", () => {
  const once = convert("x.css", ":root{--a:oklch(0% 0 0)}").css;
  eq(convert("x.css", once).skipped, true);
});

test("cascade layers are unwrapped, contents kept, order kept", () => {
  /* The failure this is for: `@layer` is Chrome 99, an unknown at-rule is
     consumed with its whole block, and 94% of a Tailwind 4 sheet is inside
     one — so the page arrives with no styling at all. */
  const r = unlayer("@layer a,b;@layer a{.x{color:red}}@layer b{.y{color:blue}}");
  eq(r.css, ".x{color:red}.y{color:blue}");
  eq(r.removed, 3);
});

test("nested layers come out too, and nothing else moves", () => {
  const r = unlayer("@media screen{@layer a{.x{color:red}}}.z{color:lime}");
  eq(r.css, "@media screen{.x{color:red}}.z{color:lime}");
  eq(unlayer(".x{color:red}").removed, 0, "a sheet with no layers is untouched");
});

test("an unbalanced @layer is left alone rather than cut in half", () => {
  const broken = "@layer a{.x{color:red}";          // never closed
  eq(unlayer(broken).css, broken);
});

test("color-mix falls back to its first colour, at full strength", () => {
  eq(colorMixFallback("color-mix(in srgb, var(--bg) 74%, transparent)"), "var(--bg)");
  eq(colorMixFallback("color-mix(in oklab,var(--color-amber-950) 20%,transparent)"), "var(--color-amber-950)");
  /* The proportion can be a calc(), and the colour can itself be a var() with
     a fallback — both full of commas and parens that a split on "," would
     wreck. */
  eq(colorMixFallback("color-mix(in srgb, var(--th-panel) calc(var(--th-panel-alpha) * 100%), transparent)"),
     "var(--th-panel)");
  eq(colorMixFallback("color-mix(in srgb, var(--mod, var(--cyan)) 45%, var(--border))"),
     "var(--mod, var(--cyan))");
  /* Inside a larger value, and more than once. */
  eq(colorMixFallback("1px solid color-mix(in srgb, red 50%, blue)"), "1px solid red");
  eq(colorMixFallback("linear-gradient(color-mix(in srgb, red 1%, blue), color-mix(in srgb, lime 2%, blue))"),
     "linear-gradient(red, lime)");
  eq(colorMixFallback("rgba(0,0,0,.5)"), null, "nothing to do");
});

test("a declaration that already has a fallback is left alone", () => {
  const already = "a{background:rgba(0,0,0,.5);background:color-mix(in srgb, var(--x) 50%, transparent)}";
  eq(colorMixPass(already).added, 0);
  const bare = "a{background:color-mix(in srgb, var(--x) 50%, transparent)}";
  eq(colorMixPass(bare).added, 1);
});

test("a comment between the two does not hide the fallback", () => {
  /* This is a real bug this suite caught: the comment made the color-mix line
     look like the first declaration in its rule, and it got a second fallback
     on top of the hand-written one. */
  const withComment = "a{background:rgba(0,0,0,.5);/* why */background:color-mix(in srgb, var(--x) 50%, transparent)}";
  eq(colorMixPass(withComment).added, 0);
});

test("a custom property using color-mix is reported, not paired", () => {
  /* Pairing would not work — see the header — so it has to be visible rather
     than silently skipped. */
  const r = colorMixPass("a{--x:color-mix(in srgb, red 50%, blue)}");
  eq(r.added, 0);
  eq(r.customProps, 1);
});

test("matches Tailwind's own fallback hexes for the same colours", () => {
  const f = "dist/more/dorsalflow/assets/index-p7QK8ZAL.css";
  if (!fs.existsSync(f)) { console.log("      (no build; skipped)"); return; }
  const css = fs.readFileSync(f, "utf8");
  const twRe = new RegExp("\\.bg-([a-z]+-\\d+)\\\\/\\d+\\{background-color:#([0-9a-f]{6})[0-9a-f]{2}\\}", "g");
  const theirs = new Map();
  for (const m of css.matchAll(twRe)) theirs.set(m[1], m[2]);
  const mine = new Map();
  for (const m of css.matchAll(/--color-([a-z]+-\d+):\s*(oklch\([^)]*\))/g)) {
    const hex = ok(m[2]);
    if (hex) mine.set(m[1], hex.slice(1));
  }
  let compared = 0, worst = 0, worstName = "";
  for (const [name, t] of theirs) {
    const o = mine.get(name); if (!o) continue;
    compared++;
    for (let i = 0; i < 6; i += 2) {
      const d = Math.abs(parseInt(o.substr(i, 2), 16) - parseInt(t.substr(i, 2), 16));
      if (d > worst) { worst = d; worstName = `${name}: ours #${o}, tailwind #${t}`; }
    }
  }
  if (!compared) throw new Error("nothing to compare — the fallbacks may already have been applied");
  console.log(`      ${compared} palette entries compared, worst channel off by ${worst}`);
  /* Not zero: Tailwind gamut-maps in its own way and rounds its own way. A
     couple of levels out of 255 is invisible; a dozen would mean the maths
     is wrong rather than merely rounded differently. */
  if (worst > 4) throw new Error("too far from Tailwind's own answer — " + worstName);
});

console.log(failed ? `\n${failed} failed` : "\nall passed");
process.exit(failed ? 1 : 0);
