// How often does a Mobius chart claim turn on the route convention ("on the band, without crossing the twist")?
// For the asked pair, compare the chart verdict with the verdict read the other way round the ring (across the twist once).
const L = '../loops/';
const { generate } = require(L + 'twist.js');
const { rng, sign } = require(L + 'lib.js');
let n = 0, differ = 0, adjAcross = 0, adjDiffer = 0;
for (let seed = 1; seed <= 2000; seed++) {
  const it = generate(rng(seed * 13), { kind: 'flip', m: 5, n: 5, question: 'chart' });
  if (!it) continue; n++;
  const { a, b, ax } = it.meta; const A = it.pos[a], B = it.pos[b];
  const chart = sign(B.w[ax] - A.w[ax]);
  const across = sign(-B.w[ax] - A.w[ax]);           // b seen from a the other way round (one crossing)
  const claimedRel = it.isValid ? chart : it.meta.flat;
  if (chart !== across) differ++;
  // pairs whose SHORTER route crosses the twist
  const d = Math.abs(B.c - A.c), shortCrosses = (5 - d) < d;
  if (shortCrosses) { adjAcross++; if (chart !== across) adjDiffer++; }
}
console.log(`flip/chart items ${n}: verdict differs between the two routes on ${differ} (${(100*differ/n).toFixed(0)}%)`);
console.log(`  asked pair's SHORTER route crosses the twist on ${adjAcross}; of those the short-route reading contradicts the chart on ${adjDiffer}`);
