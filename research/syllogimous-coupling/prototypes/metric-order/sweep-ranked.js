"use strict";
const L = require("./lib");
const Rk = require("./ranked");
L.seed(5);
const rows = [];
for (const [dims, cap] of [[4, 8], [5, 7], [6, 6]]) {
    for (let premises = 5; premises <= cap; premises++) {
        // two ranking premises + (objects - 1) edges = premises  =>  objects = premises - 1
        let ok = 0; const n = 200;
        for (let i = 0; i < n; i++) if (Rk.generate(dims, premises - 1)) ok++;
        rows.push({ dims, premises, built: `${Math.round(100 * ok / n)}%` });
    }
}
console.table(rows);
