// Feasibility at the real premise caps (Space 3D 10, 4D 8, 5D 7, 6D/7D 6).
// Premises shown = tree edges + coupling premises; this is what the cap limits.
"use strict";
const L = require("./lib");
const B = require("./bridges");
const C = require("./bridges-cascade");
const W = require("./walking");
const M = require("./metric");

const N = 300;
function rate(fn) {
    let ok = 0;
    for (let i = 0; i < N; i++) if (fn()) ok++;
    return `${Math.round((100 * ok) / N)}%`;
}
L.seed(99);
const rows = [];
for (const [dims, cap] of [[3, 10], [4, 8], [5, 7], [6, 6]]) {
    for (let premises = 4; premises <= cap; premises++) {
        rows.push({
            dims, premises,
            "1 bridge": rate(() => B.generate(dims, premises, true)),          // premises-1 edges + 1 bridge => objects = premises
            "2 bridges": dims >= 3 && premises >= 6 ? rate(() => C.generate(dims, premises - 1)) : "-",
            "walk total": rate(() => W.generateA(dims, premises)),
            "nearest": rate(() => M.nearest(dims, premises + 1)),
        });
    }
}
console.table(rows);
