#!/usr/bin/env node
/*
 * Fetches the libraries the trainers load from other people's servers, into
 * each app's own vendor/ directory, so that nothing is fetched at play time.
 *
 *   node tools/fetch-vendor.mjs            fetch what is missing
 *   node tools/fetch-vendor.mjs --force    fetch everything again
 *   node tools/fetch-vendor.mjs --check    say what is missing, change nothing
 *
 * Needs the network, once. Like tools/fetch-pictures.mjs, the result is meant
 * to be committed: the site, the APK and a copy on a USB stick then carry the
 * files themselves.
 *
 * WHY
 * ---
 * The archive's thesis is that this still runs in five years, from a USB
 * stick, with no toolchain. A `<script src="https://cdn...">` is a hole in
 * that, and not a theoretical one — three of the trainers were unusable with
 * the network off, and two of them failed in ways that look like a bug rather
 * than a missing file:
 *
 *   EWMT        three.js never loads, so the cubes never appear.
 *   3D Rotation the same, through an importmap.
 *   Precision   Tailwind's JIT never runs, so every utility class in the app
 *               does nothing and the page renders as unstyled boxes; Tone
 *               never loads, so there is no audio; Chart never loads, so
 *               Performance is an empty frame.
 *
 * Fonts are the gentler case — a missing webfont falls back to a system one —
 * but a trainer that looks different on a train is still a trainer that was
 * not finished.
 *
 * WHERE THINGS GO
 * ---------------
 * Into the app's own `vendor/`, next to its index.html, exactly as
 * apps/more/reader already carries jszip and epub.js. Not into shared/: an app
 * that reaches up out of its own directory for a library stops working when
 * opened on its own, and every app here is supposed to survive being copied
 * somewhere by itself.
 *
 * PINS
 * ----
 * Every URL below names an exact version, including the two that did not. The
 * sources said `npm/chart.js` and `cdn.tailwindcss.com`, which are whatever
 * those hosts serve today — fine while the network is there to ask, useless as
 * a record of what the app was built against. They are pinned here at the
 * versions those URLs resolved to when this was written.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const force = process.argv.includes("--force");
const checkOnly = process.argv.includes("--check");

/* Google serves a different stylesheet per browser — woff2 only to something
 * recent enough to want it, and old formats to anything else. Asking as a
 * current Chrome is how you get the one file format every browser this project
 * runs in supports. */
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/* app:  where it lands, relative to the repo root
 * file: the path inside that app
 * url:  the exact version fetched
 * seen: the URLs in the app's source this replaces, including the unpinned
 *       aliases, so `--check` in the build can tell a vendored dependency from
 *       a new one somebody just added. */
const LIBRARIES = [
  {
    app: "apps/ewmt", file: "vendor/three-0.160.0.min.js",
    url: "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js",
    seen: ["https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"],
    licence: "MIT, mrdoob and three.js contributors",
  },
  {
    app: "apps/rotation", file: "vendor/three-0.160.0.module.js",
    url: "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
    seen: ["https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js"],
    licence: "MIT, mrdoob and three.js contributors",
  },
  {
    /* The importmap maps the whole `three/addons/` prefix, so this keeps the
       directory shape the prefix expects rather than being flattened. */
    app: "apps/rotation", file: "vendor/three-addons-0.160.0/controls/OrbitControls.js",
    url: "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js",
    seen: ["https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"],
    licence: "MIT, mrdoob and three.js contributors",
  },
  {
    /* Vite copies public/ to the output root untouched, which is the one place
       a file can sit in a Vite app without the bundler wanting to process it. */
    app: "apps/precision", file: "public/vendor/tone-14.7.77.js",
    url: "https://cdnjs.cloudflare.com/ajax/libs/tone/14.7.77/Tone.js",
    seen: ["https://cdnjs.cloudflare.com/ajax/libs/tone/14.7.77/Tone.js"],
    licence: "MIT, Yotam Mann",
  },
  {
    app: "apps/precision", file: "public/vendor/chart-4.5.1.umd.js",
    url: "https://cdn.jsdelivr.net/npm/chart.js@4.5.1/dist/chart.umd.js",
    seen: ["https://cdn.jsdelivr.net/npm/chart.js", "https://cdn.jsdelivr.net/npm/chart.js@4.5.1/dist/chart.umd.js"],
    licence: "MIT, Chart.js contributors",
  },
  {
    app: "apps/precision", file: "public/vendor/tailwind-3.4.17.js",
    url: "https://cdn.tailwindcss.com/3.4.17",
    seen: ["https://cdn.tailwindcss.com", "https://cdn.tailwindcss.com/3.4.17"],
    licence: "MIT, Tailwind Labs",
  },
];

/* The webfonts, which need two round trips: the stylesheet, and then the files
 * it points at. The stylesheet is rewritten to name the local copies. */
const FONT_CSS = "https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300&family=Outfit:wght@300;400;500;600;700&display=swap";
const FONTS = [
  { app: "apps/rrt", dir: "vendor/fonts", url: FONT_CSS },
  { app: "apps/cct", dir: "vendor/fonts", url: FONT_CSS },
];

async function get(url, binary) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return binary ? Buffer.from(await res.arrayBuffer()) : res.text();
}

function write(abs, data) {
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, data);
}

const missing = [];
let fetched = 0;

for (const lib of LIBRARIES) {
  const abs = path.join(ROOT, lib.app, lib.file);
  if (fs.existsSync(abs) && !force) { console.log(`  have  ${lib.app}/${lib.file}`); continue; }
  if (checkOnly) { missing.push(`${lib.app}/${lib.file}`); continue; }
  const body = await get(lib.url, true);
  write(abs, body);
  fetched++;
  console.log(`  got   ${lib.app}/${lib.file}  (${(body.length / 1024).toFixed(0)} KiB)`);
}

for (const font of FONTS) {
  const cssPath = path.join(ROOT, font.app, font.dir, "fonts.css");
  if (fs.existsSync(cssPath) && !force) { console.log(`  have  ${font.app}/${font.dir}/fonts.css`); continue; }
  if (checkOnly) { missing.push(`${font.app}/${font.dir}/fonts.css`); continue; }
  let css = await get(font.url, false);
  const urls = [...new Set([...css.matchAll(/url\((https:\/\/[^)]+)\)/g)].map(m => m[1]))];
  for (const u of urls) {
    /* The family and weight are already in the stylesheet around each url();
       the file name only has to be stable and unique, and the hash Google puts
       in its own path is both. */
    const name = path.basename(new URL(u).pathname) + (path.extname(u) ? "" : ".woff2");
    write(path.join(ROOT, font.app, font.dir, name), await get(u, true));
    css = css.split(u).join(`./${name}`);
  }
  write(cssPath, css);
  fetched++;
  console.log(`  got   ${font.app}/${font.dir}/fonts.css  (${urls.length} files)`);
}

if (checkOnly) {
  if (missing.length) {
    console.error("\nNot vendored yet:\n  " + missing.join("\n  ") +
                  "\n\nRun: node tools/fetch-vendor.mjs");
    process.exit(1);
  }
  console.log("\nEvery vendored library is present.");
} else {
  console.log(`\n${fetched} fetched. Commit them: nothing should be downloaded at play time.`);
}

export { LIBRARIES, FONTS };
