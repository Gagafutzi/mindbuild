#!/usr/bin/env node
/*
 * sRGB fallbacks for colours an older engine cannot parse.
 *
 *   node tools/css-fallbacks.mjs dist        # the build runs this
 *   node tools/css-fallbacks.mjs dist --check
 *
 * WHAT THIS IS FOR
 * ----------------
 * qutebrowser on Ubuntu 22.04 is QtWebEngine 5.15, which is Chromium 87 —
 * December 2020. `oklch()` arrived in Chrome 111. An engine that cannot parse
 * a colour does not fall back to something sensible; it discards the whole
 * declaration, and a palette defined entirely in oklch leaves every element
 * using it with no colour at all. DorsalFlow is unreadable there, which is how
 * this was found.
 *
 * WHAT IT DOES NOT DO
 * -------------------
 * `color-mix()` is left alone, because Tailwind already handles it and handles
 * it the right way:
 *
 *     .bg-amber-950\/20{background-color:#46190133}
 *     @supports (color:color-mix(in lab,red,red)){
 *       .bg-amber-950\/20{background-color:color-mix(in oklab,…)}
 *     }
 *
 * An old engine takes the hex and skips the block; a current one takes the
 * mix. All 224 uses in this build are already inside such a guard, so there is
 * nothing to add and adding anything would be fighting the generator.
 *
 * WHY CUSTOM PROPERTIES CANNOT USE THE SAME TRICK IN PLACE
 * --------------------------------------------------------
 * The obvious move — write the hex first and let the oklch override it — is
 * wrong, and silently so. A custom property is not parsed when it is declared:
 * to any engine with custom-property support, including Chromium 87, the value
 * is an arbitrary token stream and `--x:oklch(…)` is perfectly valid. It wins
 * on source order, and only fails later, at the point of `var(--x)`, where it
 * is invalid at computed-value time — so the element ends up with no colour
 * and the hex never gets a chance.
 *
 * So the declaration itself is rewritten to hex, and the originals are
 * restated inside `@supports (color:oklch(0 0 0))`, which an old engine skips
 * whole. Nothing is lost on a current browser: it reads the hex, then the
 * supported block puts the authored oklch back. Exactly Tailwind's shape,
 * applied one level up.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/* Imported by tools/test-css-fallbacks.mjs for the colour maths, so the CLI
   runs only when this file is the one that was invoked. */
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
const dir = process.argv[2];
const checkOnly = process.argv.includes("--check");
if (isMain && !dir) { console.error("usage: node tools/css-fallbacks.mjs <dir> [--check]"); process.exit(2); }

/* ------------------------------------------------------------ the colour */

/* OKLCh → linear sRGB. Björn Ottosson's matrices. */
function oklchToLinear(L, C, H) {
  const h = H * Math.PI / 180;
  const a = C * Math.cos(h), b = C * Math.sin(h);
  const l_ = L + 0.3963377774*a + 0.2158037573*b;
  const m_ = L - 0.1055613458*a - 0.0638541728*b;
  const s_ = L - 0.0894841775*a - 1.2914855480*b;
  const l = l_*l_*l_, m = m_*m_*m_, s = s_*s_*s_;
  return [
     4.0767416621*l - 3.3077115913*m + 0.2309699292*s,
    -1.2684380046*l + 2.6097574011*m - 0.3413193965*s,
    -0.0041960863*l - 0.7034186147*m + 1.7076147010*s,
  ];
}

const EPS = 1e-5;
const inGamut = lin => lin.every(v => v >= -EPS && v <= 1 + EPS);

/* OKLCh → sRGB, reducing chroma rather than clamping channels.
 *
 * The vivid end of the palette sits outside sRGB, and the two ways of dealing
 * with that are not equally good. Clamping each channel at the end changes the
 * ratios between them, which is to say it changes the hue: red-600 came out
 * #e7000b against the #e40014 Tailwind emits for the same colour, visibly
 * oranger. Holding L and H and binary-searching C down to the gamut boundary —
 * what CSS Color 4 asks for — keeps the hue and gives up only the saturation
 * the display could not have shown anyway.
 *
 * Checked against Tailwind's own fallback hexes for the entries it also
 * publishes: see the comparison in tools/test-css-fallbacks.mjs.
 */
function oklchToRgb(L, C, H) {
  let lin = oklchToLinear(L, C, H);
  if (!inGamut(lin)) {
    let lo = 0, hi = C;
    for (let i = 0; i < 32; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(oklchToLinear(L, mid, H))) lo = mid; else hi = mid;
    }
    lin = oklchToLinear(L, lo, H);
  }
  return lin.map(v => {
    v = Math.max(0, Math.min(1, v));            // the last 1e-5 of slack
    const c = v <= 0.0031308 ? 12.92*v : 1.055*Math.pow(v, 1/2.4) - 0.055;
    return Math.max(0, Math.min(255, Math.round(c * 255)));
  });
}

const hex2 = n => n.toString(16).padStart(2, "0");

/* `oklch(62.3% .214 259.8)` and `oklch(62.3% .214 259.8 / 50%)`. `none` is
 * accepted as the zero it means here; a value this cannot read is left alone
 * rather than guessed at, and reported at the end. */
const OKLCH = /oklch\(\s*([^)]*)\)/gi;

function num(tok, pct) {
  if (tok == null || tok === "none") return 0;
  const m = /^(-?[\d.]+)(%)?$/.exec(tok.trim());
  if (!m) return null;
  const v = parseFloat(m[1]);
  return m[2] ? v / 100 * (pct || 1) : v;
}

function oklchToHex(whole, inner) {
  const [coords, alphaRaw] = inner.split("/");
  const parts = coords.trim().split(/[\s,]+/).filter(Boolean);
  if (parts.length < 3) return null;
  const L = num(parts[0], 1), C = num(parts[1], 0.4), H = num(parts[2], 360);
  if (L == null || C == null || H == null) return null;
  const [r, g, b] = oklchToRgb(L, C, H);
  let out = "#" + hex2(r) + hex2(g) + hex2(b);
  if (alphaRaw != null) {
    const A = num(alphaRaw.trim(), 1);
    if (A == null) return null;
    if (A < 1) out += hex2(Math.max(0, Math.min(255, Math.round(A * 255))));
  }
  return out;
}

/* -------------------------------------------------------------- the file */

/* Custom property declarations whose value contains an oklch(), with the rule
 * they sit in. Deliberately small: it reads declarations and tracks the
 * enclosing prelude, and anything it is not sure about it leaves untouched. */
/* Comments blanked to spaces, not removed, so every offset still points at the
 * same character of the original. Removing them would mean mapping positions
 * back, and the parsing below is all offsets.
 *
 * It matters more than it sounds: a comment sitting between two declarations
 * made the second one fail the "what was declared just before this" test, so a
 * property that already had a hand-written fallback looked as though it had
 * none and got a second one. */
function maskComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, m => " ".repeat(m.length));
}

/* Every declaration in the sheet, with the rule it sits in. */
function declarations(src) {
  const css = maskComments(src);
  const out = [];
  let depth = 0, preludes = [], mark = 0;
  function flush(end) {
    if (depth <= 0) return;
    const m = /^\s*([-a-zA-Z][-\w]*)\s*:([\s\S]*)$/.exec(css.slice(mark, end));
    /* Matched against the masked text so a comment cannot look like a
       declaration, but the value is taken from the original: offsets are
       identical, and what gets written out has to be what was written in. */
    if (m) out.push({ prop: m[1], value: src.slice(mark, end).replace(/^\s*[-a-zA-Z][-\w]*\s*:/, "").trim(),
                      start: mark, end, depth,
                      prelude: preludes.slice(0, depth).filter(Boolean) });
  }
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === "{") { preludes[depth] = css.slice(mark, i).trim(); depth++; mark = i + 1; }
    else if (c === "}") { flush(i); depth--; preludes.length = Math.max(depth, 0); mark = i + 1; }
    else if (c === ";") { flush(i); mark = i + 1; }
  }
  return out;
}

/* The ranges covered by `@supports (… color-mix …)`, which an engine without
 * color-mix skips whole — so anything inside one already has its fallback
 * sitting outside it, which is how Tailwind emits them. */
function supportsRanges(src, what) {
  const css = maskComments(src);
  const out = [];
  const re = new RegExp("@supports[^{]*" + what + "[^{]*\\{", "gi");
  for (const m of css.matchAll(re)) {
    let d = 0, i = m.index + m[0].length - 1;
    for (; i < css.length; i++) { if (css[i] === "{") d++; else if (css[i] === "}") { d--; if (!d) break; } }
    out.push([m.index, i]);
  }
  return out;
}

/* Split on a separator that is not inside parentheses. These values are full
 * of nested var() and calc(), both of which carry their own commas and
 * spaces, so a plain `.split(",")` or `.split(" ")` takes them apart in the
 * middle — which is how `var(--th-panel) calc(var(--a) * 100%)` first came out
 * as the two halves of a calc. */
function splitTop(str, sep) {
  const parts = []; let d = 0, mark = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (c === "(") d++;
    else if (c === ")") d--;
    else if (d === 0 && (sep === " " ? /\s/.test(c) : c === sep)) {
      parts.push(str.slice(mark, i)); mark = i + 1;
    }
  }
  parts.push(str.slice(mark));
  return parts.map(x => x.trim()).filter(x => x !== "");
}
const splitArgs = (inner) => splitTop(inner, ",");

/* `color-mix(in srgb, var(--bg) 74%, transparent)` → `var(--bg)`.
 *
 * The first colour, at full strength. It is not the same colour — the
 * transparency is gone — but it is the right thing to lose: the alternative
 * on an engine with no color-mix is no declaration at all, which means no
 * background rather than a slightly solid one. This is the same substitution
 * the hand-written sheets here already make for themselves, which is where
 * the shape was taken from.
 */
function colorMixFallback(value) {
  let out = "", at = 0, ok = false;
  for (let i = value.toLowerCase().indexOf("color-mix("); i >= 0;
       i = value.toLowerCase().indexOf("color-mix(", i + 1)) {
    let d = 0, j = i + "color-mix(".length - 1;
    for (; j < value.length; j++) { if (value[j] === "(") d++; else if (value[j] === ")") { d--; if (!d) break; } }
    if (d) return null;                                   // unbalanced; leave it alone
    const args = splitArgs(value.slice(i + "color-mix(".length, j));
    if (args.length < 3 || !/^in\s/i.test(args[0])) return null;
    /* Drop the trailing proportion, which may be a plain percentage or a
       calc() of one. What is left is the colour itself. */
    const toks = splitTop(args[1], " ");
    const last = toks[toks.length - 1];
    const colour = (toks.length > 1 && /^(calc\(.*\)|[\d.]+%)$/i.test(last)
                    ? toks.slice(0, -1) : toks).join(" ").trim();
    if (!colour) return null;
    out += value.slice(at, i) + colour;
    at = j + 1; ok = true;
    i = j;
  }
  return ok ? out + value.slice(at) : null;
}

/* Cascade layers, unwrapped.
 *
 * `@layer` is Chrome 99. An at-rule an engine does not know is not ignored
 * politely — the spec says it is consumed whole, block and all — so on
 * Chromium 87 a Tailwind 4 stylesheet loses 94% of itself, including the
 * palette, the reset and every utility class. The page renders as unstyled
 * text. That is a bigger hole than any colour function, and it sits above
 * them: the colour fallbacks below were landing inside blocks that were being
 * thrown away before anything looked at a colour.
 *
 * Flattening gives up what layers are for — a later layer beating an earlier
 * one regardless of specificity — and keeps everything else. It is survivable
 * here because of how this particular sheet is built: the layers are emitted
 * in their intended order, so "later wins" still holds for equal specificity,
 * and Tailwind's reset is element selectors (0,0,1) against utilities that are
 * classes (0,1,0), so the utilities still win where it matters. This is how
 * Tailwind 3 worked, before layers existed.
 *
 * It is done for every engine rather than duplicated behind a feature query,
 * because there is no honest query to use: `@supports` cannot ask about an
 * at-rule, and testing a colour function instead would hand the flattened copy
 * to Chrome 99–110 as well, which support layers perfectly well. One copy that
 * every engine reads the same way is easier to be sure of than two.
 */
function unlayer(src) {
  let css = src, removed = 0;
  for (;;) {
    const masked = maskComments(css);
    const m = /@layer\b([^;{]*)([;{])/i.exec(masked);
    if (!m) break;
    if (m[2] === ";") {                       // `@layer a, b, c;` — an ordering
      css = css.slice(0, m.index) + css.slice(m.index + m[0].length);
      removed++;
      continue;
    }
    let d = 0, j = m.index + m[0].length - 1;
    for (; j < masked.length; j++) {
      if (masked[j] === "{") d++;
      else if (masked[j] === "}") { d--; if (!d) break; }
    }
    /* Unbalanced means this is not what it looks like — a `@layer` inside a
       string, most likely. Stop rather than cut the file in half. */
    if (d !== 0) break;
    css = css.slice(0, m.index) + css.slice(m.index + m[0].length, j) + css.slice(j + 1);
    removed++;
  }
  return { css, removed };
}

function customPropsWithOklch(src) {
  const css = maskComments(src);
  const found = [];
  let depth = 0, preludes = [], mark = 0;

  /* `}` ends a declaration as surely as `;` does. Minified CSS leaves the
     last semicolon of every block out, so treating only `;` as a terminator
     silently skips one declaration per rule — and the one it skips is
     wherever the generator happened to put it. */
  function flush(end) {
    if (depth <= 0) return;
    const m = /^\s*(--[\w-]+)\s*:([\s\S]*)$/.exec(css.slice(mark, end));
    if (m && /oklch\(/i.test(m[2])) {
      const value = src.slice(mark, end).replace(/^\s*--[\w-]+\s*:/, "").trim();
      found.push({ prelude: preludes.slice(0, depth).filter(Boolean),
                   name: m[1], value, start: mark, end });
    }
  }

  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === "{") {
      preludes[depth] = css.slice(mark, i).trim();
      depth++; mark = i + 1;
    } else if (c === "}") {
      flush(i);                       // before the depth drops: it is this rule's
      depth--; preludes.length = Math.max(depth, 0); mark = i + 1;
    } else if (c === ";") {
      flush(i); mark = i + 1;
    }
  }
  return found;
}

const GUARD_OPEN = "@supports (color:oklch(0 0 0)){";
const NOTE = "\n/* Restated for engines that can read oklch. See tools/css-fallbacks.mjs. */\n";

/* Pass two: a declaration using color-mix() with nothing to fall back on.
 *
 * Most already have one. Tailwind puts its uses inside @supports and writes a
 * hex outside; the hand-written sheets here repeat the property with an rgba()
 * first. What is left is the ones nobody did either for, and they are the ones
 * that leave a panel with no background on an old engine.
 *
 * A declaration is left alone if it is inside an @supports guard, if the same
 * property is set immediately before it without a color-mix, or if it is a
 * custom property — those cannot be given a fallback this way at all, for the
 * reason in the header, and are reported instead.
 */
function colorMixPass(css) {
  const guards = supportsRanges(css, "color-mix");
  const inGuard = (i) => guards.some(([a, b]) => i > a && i < b);
  const decls = declarations(css);
  const edits = [];
  let customProps = 0;
  for (let k = 0; k < decls.length; k++) {
    const d = decls[k];
    if (!/color-mix\(/i.test(d.value)) continue;
    if (inGuard(d.start)) continue;
    if (d.prop.startsWith("--")) { customProps++; continue; }
    const prev = decls[k - 1];
    if (prev && prev.depth === d.depth && prev.prop === d.prop && !/color-mix\(/i.test(prev.value)) continue;
    const fb = colorMixFallback(d.value);
    if (fb == null || fb === d.value) continue;
    edits.push({ at: d.start, text: " " + d.prop + ":" + fb + ";" });
  }
  if (!edits.length) return { css, added: 0, customProps };
  let out = "", at = 0;
  for (const e of edits) { out += css.slice(at, e.at) + e.text; at = e.at; }
  return { css: out + css.slice(at), added: edits.length, customProps };
}

function convert(file, css) {
  const hasOklch = /oklch\(/i.test(css);
  const hasMix = /color-mix\(/i.test(css);
  const hasLayer = /@layer\b/i.test(css);
  if (!hasOklch && !hasMix && !hasLayer) return null;
  if (css.includes(GUARD_OPEN)) return { skipped: true };   // already done

  /* First, because the colour passes below are pointless inside a block the
     engine has already discarded. */
  const layers = unlayer(css);
  css = layers.css;

  const mix = colorMixPass(css);
  css = mix.css;

  const decls = hasOklch ? customPropsWithOklch(css) : [];
  if (!decls.length) {
    const left = hasOklch ? (css.match(OKLCH) || []).length : 0;
    return mix.added || mix.customProps || layers.removed
      ? { css, converted: 0, added: mix.added, mixCustomProps: mix.customProps,
          layers: layers.removed, unreadable: left }
      : (layers.removed ? { css, converted: 0, added: 0, layers: layers.removed, unreadable: left }
                        : { unconverted: left });
  }

  let out = "", at = 0, unreadable = 0;
  const byRule = new Map();
  for (const d of decls) {
    const hexed = d.value.replace(OKLCH, (whole, inner) => {
      const hex = oklchToHex(whole, inner);
      if (hex == null) { unreadable++; return whole; }
      return hex;
    });
    if (hexed === d.value) continue;                        // nothing readable in it
    out += css.slice(at, d.start) + " " + d.name + ":" + hexed;
    at = d.end;
    /* Grouped by the rule they came from, so the restatement lands on the
       same selector inside the same at-rules rather than on a guess. */
    const key = JSON.stringify(d.prelude);
    if (!byRule.has(key)) byRule.set(key, { prelude: d.prelude, decls: [] });
    byRule.get(key).decls.push(d.name + ":" + d.value);
  }
  out += css.slice(at);
  if (!byRule.size) {
    return (mix.added || layers.removed)
      ? { css: out, converted: 0, added: mix.added, layers: layers.removed,
          mixCustomProps: mix.customProps, unreadable }
      : { unconverted: unreadable };
  }

  let restated = NOTE + GUARD_OPEN;
  for (const { prelude, decls: ds } of byRule.values()) {
    restated += prelude.join("{") + (prelude.length ? "{" : "")
             + ds.join(";") + ";"
             + "}".repeat(prelude.length);
  }
  restated += "}\n";

  const converted = decls.reduce((n, d) => n + (d.value.match(OKLCH) || []).length, 0) - unreadable;
  return { css: out + restated, converted, unreadable, layers: layers.removed,
           added: mix.added, mixCustomProps: mix.customProps };
}

/* -------------------------------------------------------------- the walk */

let changed = 0, total = 0, left = 0, mixed = 0, bareCustom = 0, layersFlattened = 0;
const pending = [];

function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (e.name !== "node_modules") walk(p); continue; }
    if (!/\.css$/i.test(e.name)) continue;
    const css = fs.readFileSync(p, "utf8");
    const r = convert(p, css);
    if (!r || r.skipped) continue;
    if (r.css) {
      total += r.converted || 0; mixed += r.added || 0; changed++; left += r.unreadable || 0;
      bareCustom += r.mixCustomProps || 0;
      if (!checkOnly) fs.writeFileSync(p, r.css);
      layersFlattened += r.layers || 0;
      const bits = [];
      if (r.layers) bits.push(`${r.layers} @layer`);
      if (r.converted) bits.push(`${r.converted} oklch`);
      if (r.added) bits.push(`${r.added} color-mix`);
      pending.push(`  ${path.relative(dir, p)}  ${bits.join(", ")}`);
    } else if (r.unconverted) {
      left += r.unconverted;
      pending.push(`  ${path.relative(dir, p)}  ${r.unconverted} oklch left as-is`);
    }
  }
}

if (isMain) {
  walk(dir);
  if (!changed) console.log("[fallbacks] nothing needed a fallback.");
  else {
    console.log(`[fallbacks] ${layersFlattened} @layer block(s) flattened, ${total} oklch and ${mixed} color-mix declaration(s) given an sRGB fallback, in ${changed} file(s)${checkOnly ? " (check only)" : ""}:`);
    for (const line of pending) console.log(line);
  }
  if (bareCustom) console.log(`[fallbacks] ${bareCustom} custom propert(ies) use color-mix and cannot be paired — see the header.`);
  if (left) console.log(`[fallbacks] ${left} oklch value(s) not in a custom property, or unreadable — left untouched.`);
}

export { oklchToRgb, oklchToHex, convert, customPropsWithOklch, unlayer,
         colorMixFallback, colorMixPass, declarations };
