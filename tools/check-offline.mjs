#!/usr/bin/env node
/*
 * Fails the build if anything in it would be fetched from another server.
 *
 *   node tools/check-offline.mjs dist
 *
 * The archive's thesis is that this still runs in five years, from a USB
 * stick, with no toolchain — and the gate now serves the hub on loopback so
 * that a day's quota can be met with no network at all. Both are claims about
 * what the built site asks for, and neither survives one `<script src="https://…">`
 * that nobody noticed.
 *
 * So it is checked rather than remembered. Three of the trainers depended on a
 * CDN until the libraries were vendored (see tools/fetch-vendor.mjs), and the
 * way that happened was not carelessness — it is what every example in every
 * library's own documentation looks like. The next one will arrive the same
 * way, so this is the thing that notices.
 *
 * WHAT COUNTS
 * -----------
 * Subresources: what the page fetches on its own, without being clicked.
 * Scripts, stylesheets, images, iframes, fonts, preloads, importmap entries,
 * `url()` and `@import` in CSS.
 *
 * `<a href>` is not one of them. A link to a Discord invite or a Nature paper
 * is a link; following it is the reader's choice and needs the network the way
 * anything on the internet does. Flagging those would mean the only way to
 * pass is to have no links, which is not what offline means.
 */

import fs from "node:fs";
import path from "node:path";

const dir = process.argv[2];
if (!dir) { console.error("usage: node tools/check-offline.mjs <dir>"); process.exit(2); }

/* Hosts a build is still allowed to reach, each with the reason it is here.
 * Empty is the goal; every entry is a thing that should eventually move or go.
 *
 * googletagmanager: Google Analytics, baked into the upstream Syllogimous fork
 * at apps/syllogimous/src/index.html. It is `async` and its failure is silent,
 * so it costs nothing offline — but it contradicts this project's own rule
 * that analytics go in the hub's build and never inside a trainer, and it is a
 * request to Google on every load of that trainer. Removing it means touching
 * the Angular sub-project and rebuilding its docs/, which is its own piece of
 * work. */
const ALLOWED = new Set(["www.googletagmanager.com"]);

const findings = [];

function flag(file, how, url) {
  let host;
  try { host = new URL(url).host; } catch { return; }
  if (ALLOWED.has(host)) return;
  findings.push({ file, how, url, host });
}

function scanHtml(file, s) {
  /* Every element that fetches by itself. `a` is deliberately not here. */
  const tag = /<(script|link|img|iframe|audio|video|source|embed|track)\b([^>]*)>/gi;
  for (const m of s.matchAll(tag)) {
    const attrs = m[2];
    for (const a of attrs.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
      if (/^https?:\/\//i.test(a[1])) flag(file, m[1].toLowerCase(), a[1]);
    }
  }
  for (const im of s.matchAll(/<script[^>]*type=["']importmap["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    for (const u of im[1].matchAll(/"(https?:\/\/[^"]+)"/g)) flag(file, "importmap", u[1]);
  }
  scanCss(file, s);          // inline <style> blocks live in the same file
}

function scanCss(file, s) {
  for (const m of s.matchAll(/url\(\s*["']?(https?:\/\/[^"')]+)/gi)) flag(file, "css url()", m[1]);
  for (const m of s.matchAll(/@import\s+(?:url\()?\s*["'](https?:\/\/[^"']+)/gi)) flag(file, "@import", m[1]);
}

function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (e.name !== "node_modules") walk(p); continue; }
    const rel = path.relative(dir, p);
    if (/\.html?$/i.test(e.name)) scanHtml(rel, fs.readFileSync(p, "utf8"));
    else if (/\.css$/i.test(e.name)) scanCss(rel, fs.readFileSync(p, "utf8"));
  }
}

walk(dir);

if (findings.length) {
  console.error(`\n${findings.length} thing(s) in ${dir}/ would be fetched from another server:\n`);
  for (const f of findings) {
    console.error(`  ${f.file}\n    [${f.how}] ${f.url}`);
  }
  console.error(`
Vendor it: add it to LIBRARIES in tools/fetch-vendor.mjs, run that, and point
the app's source at the local copy — apps/more/reader/vendor is the shape.

If it genuinely has to stay remote, add its host to ALLOWED in this file with
the reason, so the next person reads an argument rather than a surprise.`);
  process.exit(1);
}

console.log(`[offline] ${dir}/ fetches nothing from another server.`);
