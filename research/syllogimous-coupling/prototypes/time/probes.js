// Probes for what each proposal's coupling actually is.
const C = require("./common");
const LC = require("./localclocks");
const WL = require("./worldlines");
const CONE = require("./cone");

// 1. Local clocks: does the answer telescope to an endpoint formula?
//    real = sum(local) - (zone_y - zone_x), zones absolute in [0, m).
{
    let tele = 0, total = 0;
    for (let seed = 100; seed < 600; seed++) {
        const it = LC.generate(seed, { n: 5, m: 4, branching: seed % 2 === 0 });
        const [x, y] = it.question.match(/after (\w+)'s call was (\w+)'s/).slice(1).map(nm => it.names.indexOf(nm));
        const sumLocal = it.path.reduce((s, p) => s + p.sign * it.edges[p.edge].localDt, 0);
        if (sumLocal - (it.zone[y] - it.zone[x]) === it.answer) tele++;
        total++;
    }
    console.log(`local clocks: endpoint formula (time sum minus absolute zone difference) matches ${tele}/${total}`);
}

// 2. Cone `signal`: is the time gap a function of the endpoints' displacement? (It should not be.)
{
    const byDisp = new Map();
    let clash = 0, total = 0;
    for (let seed = 100; seed < 2100; seed++) {
        let it; try { it = CONE.generate(seed, { kind: "signal", n: 5, k: 2 }); } catch { continue; }
        const v = it.verdict;
        // Only the derived part: the time gap along the path, against the path's net spatial displacement.
        const key = JSON.stringify(v.space) + "|" + it.edges.map(e => e.form).join("");
        total++;
        if (byDisp.has(JSON.stringify(v.space)) && byDisp.get(JSON.stringify(v.space)) !== v.dt) clash++;
        byDisp.set(JSON.stringify(v.space), v.dt);
    }
    console.log(`cone/signal: same endpoint displacement, different time gap in ${clash} of ${total} items (non-telescoping)`);
}

// 3. Worldlines `level`: perturb ONLY the event axis (velocity of the event pair on axis i);
//    how often does the answer on axis j flip?
{
    let flips = 0, total = 0;
    for (let seed = 100; seed < 600; seed++) {
        const it = WL.generate(seed, { kind: "level", d: 2, n: 5 });
        const m = it.question.match(/^When (\w+) draws level with (\w+) (\w+)-(\w+), is (\w+) (\w+) or (\w+) of (\w+)\?$/);
        const i = C.SPATIAL.findIndex(a => a.pos === m[3]);
        const base = WL.solve(it.premises, it.question, 2);
        // Re-render the velocity line of the second event object with a different speed on axis i only.
        const y = m[2];
        const alt = it.premises.map(line => {
            if (!line.startsWith(y + " ")) return line;
            if (/does not move|moves/.test(line) && !line.startsWith("At ")) {
                const v = it.vel[it.names.indexOf(y)].slice();
                v[i] = v[i] === 0 ? 1 : (v[i] === 1 ? -1 : 0);
                const axes = C.SPATIAL.slice(0, 2);
                const parts = v.map((x, k) => x === 0 ? null : `${Math.abs(x)} ${x > 0 ? axes[k].pos : axes[k].neg}`).filter(Boolean);
                return parts.length ? `${y} moves ${parts.join(" and ")} every hour.` : `${y} does not move.`;
            }
            return line;
        });
        const r = WL.solve(alt, it.question, 2);
        if (typeof r !== "string") continue; // event no longer happens once
        total++;
        if (r !== base) flips++;
    }
    console.log(`worldlines/level: changing only the event axis flips the other axis's answer in ${flips}/${total}`);
}

// 4. Worldlines `meet`: per-axis level hours exist on every axis in every item; the answer is whether they agree.
{
    let never = 0, total = 0;
    for (let seed = 100; seed < 600; seed++) {
        const it = WL.generate(seed, { kind: "meet", d: 3, n: 4 });
        total++;
        if (it.answer === "never") never++;
    }
    console.log(`worldlines/meet 3D: ${never}/${total} are 'never' although every axis is level at some hour`);
}
