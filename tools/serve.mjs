#!/usr/bin/env node
/*
 * The built site, on this machine, with nothing else running.
 *
 *   node tools/serve.mjs              → http://127.0.0.1:8080/mindbuild/
 *   node tools/serve.mjs 9000         → another port
 *   node tools/serve.mjs --open       → and open it in your browser
 *
 * WHY THIS EXISTS SEPARATELY FROM THE GATE
 * ----------------------------------------
 * The gate serves `dist/` too, on 127.0.0.1:8787, so that a day's quota can be
 * met with no network. That is a good thing for the gate and a bad thing to
 * depend on: the hub is then only reachable while a training-quota daemon
 * happens to be running, and `systemctl --user stop mindbuild-gate` takes the
 * site down with it. Reading the record should not require the thing that
 * nags you to add to it.
 *
 * So this is the same directory over the same loopback, owned by nothing.
 *
 * WHY NOT file://
 * ---------------
 * Because two trainers would break and it would not be obvious why. The build
 * bakes its base into three files absolutely — the shell's `data-base`,
 * Precision's module `src`, Syllogimous's `<base href>` — so under `file://`
 * those resolve against the filesystem root and 404. The same reason the gate
 * serves under the built base rather than at `/`, and the base is read back
 * out of the build here too rather than assumed.
 */

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");

const args = process.argv.slice(2);
const port = Number(args.find(a => /^\d+$/.test(a))) || 8080;
const open = args.includes("--open");

if (!fs.existsSync(path.join(DIST, "index.html"))) {
  console.error("No build in dist/. Build it first:\n\n    node tools/build-site.mjs\n");
  process.exit(1);
}

/* The prefix the build was made with, read back rather than assumed — a
   `BASE=/` build is served at `/` without anything here needing to know. */
function mount() {
  const head = fs.readFileSync(path.join(DIST, "index.html"), "utf8").slice(0, 4096);
  const m = /data-base="([^"]*)"/.exec(head);
  let base = (m ? m[1] : "/").trim() || "/";
  if (!base.startsWith("/")) base = "/" + base;
  return base.endsWith("/") ? base : base + "/";
}
const MOUNT = mount();

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif",
  ".webp": "image/webp", ".ico": "image/x-icon", ".woff2": "font/woff2", ".woff": "font/woff",
  ".ttf": "font/ttf", ".otf": "font/otf", ".mp3": "audio/mpeg", ".wav": "audio/wav",
  ".ogg": "audio/ogg", ".webm": "video/webm", ".mp4": "video/mp4", ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8", ".wasm": "application/wasm",
};

const server = http.createServer((req, res) => {
  let urlPath;
  try { urlPath = decodeURIComponent(new URL(req.url, "http://127.0.0.1").pathname); }
  catch { res.writeHead(400).end("bad request"); return; }

  if (MOUNT !== "/" && !urlPath.startsWith(MOUNT)) {
    /* Nobody types the prefix. */
    res.writeHead(302, { Location: MOUNT }).end();
    return;
  }
  const rel = MOUNT === "/" ? urlPath : urlPath.slice(MOUNT.length - 1);

  /* Resolved, then checked against DIST. Normalising first and comparing
     after is what stops `..` walking out of the build and serving the
     checkout — the whole repository sits one directory up. */
  let file = path.resolve(DIST, "." + rel);
  if (file !== DIST && !file.startsWith(DIST + path.sep)) {
    res.writeHead(403).end("forbidden");
    return;
  }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    if (!urlPath.endsWith("/")) { res.writeHead(302, { Location: urlPath + "/" }).end(); return; }
    file = path.join(file, "index.html");
  }
  fs.readFile(file, (err, body) => {
    if (err) { res.writeHead(404, { "Content-Type": "text/plain" }).end("not found"); return; }
    res.writeHead(200, {
      "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream",
      /* Nothing here should outlive a rebuild. */
      "Cache-Control": "no-store",
    });
    res.end(body);
  });
});

/* 127.0.0.1, never 0.0.0.0: this is a laptop that joins other people's
   networks, and the whole training record is in here. */
server.listen(port, "127.0.0.1", () => {
  const url = `http://127.0.0.1:${port}${MOUNT}`;
  console.log(`mindbuild: ${DIST}\n           ${url}\n\nCtrl-C to stop.`);
  if (open) {
    import("node:child_process").then(({ spawn }) => {
      spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
    });
  }
});

server.on("error", (e) => {
  if (e.code === "EADDRINUSE") {
    console.error(`Port ${port} is busy. Something else is on it — the gate uses 8787.\n` +
                  `Pick another:  node tools/serve.mjs ${port + 1}`);
    process.exit(1);
  }
  throw e;
});
