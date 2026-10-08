"use strict";
// Mutation check: break the coupling in each SOLVER and count disagreements
// with the generator. A check that stays green against these is not a check.
const fs = require("fs");
const { rng } = require("./lib");
function load(file, from, to) {
  const src = fs.readFileSync(file, "utf8");
  if (!src.includes(from)) throw new Error(`mutation anchor missing in ${file}: ${from}`);
  const tmp = file.replace(".js", ".mut.js");
  fs.writeFileSync(tmp, src.split(from).join(to));
  delete require.cache[require.resolve("./" + tmp)];
  return require("./" + tmp);
}
// helix: day computed without carry (day of t = 0 always -> "same day")
{
  const H = load("helix.js", "Math.floor(t(f.subj) / 4) - Math.floor(t(f.ref) / 4) === f.dd", "true");
  let bad = 0, n = 0;
  for (let s = 1; s <= 500; s++) { const it = H.generate(rng(s * 7 + 2), 5, "watch"); n++; if (H.solve(it.premises, it.conclusion) !== it.isValid) bad++; }
  console.log(`helix, solver ignores day clauses: ${bad}/${n} watch items disagree`);
}
// twist: seam action removed from the solver's step
{
  // Mutate the cover solver only: forget to convert a premise out of its reference's frame.
  const T = load("twist.js", "cover[f.subj] = { c: U.c + f.k, w: add(U.w, gPow(kind, -laps(U.c), f.d)) };", "cover[f.subj] = { c: U.c + f.k, w: add(U.w, f.d) };");
  let bad = 0, n = 0;
  for (let s = 1; s <= 500; s++) { const it = T.generate(rng(s * 13), { kind: "flip", question: "chart" }); n++; if (T.solve(it.premises, it.conclusion, "flip", 5) !== it.isValid) bad++; }
  console.log(`twist, solver steps without the seam: ${bad}/${n} chart items disagree (generator also self-checks render/parse)`);
}
// kinds: frame chosen by subject instead of reference
{
  const K = load("kinds.js", 'how === "subject" ? kSubj : kRef', "kSubj");
  let bad = 0, n = 0;
  for (let s = 1; s <= 500; s++) { const it = K.generate(rng(s * 31), { rule: "mirror" }); n++; if (K.solve("mirror", it.premises, it.conclusion) !== it.isValid) bad++; }
  console.log(`kinds, solver decodes by the subject's kind: ${bad}/${n} items disagree`);
}
for (const f of fs.readdirSync(".")) if (f.endsWith(".mut.js")) fs.unlinkSync(f);
