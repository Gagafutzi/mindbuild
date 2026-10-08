// Exact linear solver over the rationals (BigInt), independent of the tree walk.
//
// Variables are (object, axis) coordinates. Every premise that is an equation
// becomes a row. A queried difference is *determined* exactly when its row lies
// in the row space of the premises; then its value is the matching combination
// of right-hand sides. No enumeration, no knowledge of how the item was built.

const gcd = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a; };
const Q = (n, d = 1n) => {
    n = BigInt(n); d = BigInt(d);
    if (d < 0n) { n = -n; d = -d; }
    const g = gcd(n, d) || 1n;
    return [n / g, d / g];
};
const add = (a, b) => Q(a[0] * b[1] + b[0] * a[1], a[1] * b[1]);
const mul = (a, b) => Q(a[0] * b[0], a[1] * b[1]);
const neg = a => [-a[0], a[1]];
const div = (a, b) => Q(a[0] * b[1], a[1] * b[0]);
const isZero = a => a[0] === 0n;

export class LinearSystem {
    constructor() { this.vars = new Map(); this.rows = []; }
    v(name) { if (!this.vars.has(name)) this.vars.set(name, this.vars.size); return this.vars.get(name); }
    /** terms: [[varName, coeff], ...], sum(coeff*var) = rhs */
    equation(terms, rhs) {
        const row = new Map();
        for (const [name, c] of terms) {
            const k = this.v(name);
            row.set(k, add(row.get(k) ?? Q(0), Q(c)));
        }
        this.rows.push({ row, rhs: Q(rhs) });
    }
    /** Reduced echelon form, built once per query set. */
    reduce() {
        const pivots = []; // {col, row:Map, rhs}
        for (const { row, rhs } of this.rows) {
            let r = new Map(row), b = rhs;
            for (const p of pivots) {
                const c = r.get(p.col);
                if (!c || isZero(c)) continue;
                for (const [k, v] of p.row) r.set(k, add(r.get(k) ?? Q(0), neg(mul(c, v))));
                b = add(b, neg(mul(c, p.rhs)));
            }
            for (const [k, v] of [...r]) if (isZero(v)) r.delete(k);
            if (!r.size) {
                if (!isZero(b)) return { inconsistent: true };
                continue;
            }
            const col = [...r.keys()][0];
            const lead = r.get(col);
            const norm = new Map([...r].map(([k, v]) => [k, div(v, lead)]));
            const nb = div(b, lead);
            // keep earlier pivots reduced too
            for (const p of pivots) {
                const c = p.row.get(col);
                if (!c || isZero(c)) continue;
                for (const [k, v] of norm) p.row.set(k, add(p.row.get(k) ?? Q(0), neg(mul(c, v))));
                for (const [k, v] of [...p.row]) if (isZero(v)) p.row.delete(k);
                p.rhs = add(p.rhs, neg(mul(c, nb)));
            }
            pivots.push({ col, row: norm, rhs: nb });
        }
        this.pivots = pivots;
        return { inconsistent: false };
    }
    /** Value of sum(coeff*var) if determined, else null. */
    query(terms) {
        if (!this.pivots) this.reduce();
        let r = new Map(), b = Q(0);
        for (const [name, c] of terms) {
            const k = this.v(name);
            r.set(k, add(r.get(k) ?? Q(0), Q(c)));
        }
        for (const p of this.pivots) {
            const c = r.get(p.col);
            if (!c || isZero(c)) continue;
            for (const [k, v] of p.row) r.set(k, add(r.get(k) ?? Q(0), neg(mul(c, v))));
            b = add(b, mul(c, p.rhs));
        }
        for (const [, v] of r) if (!isZero(v)) return null;
        return Number(b[0]) / Number(b[1]);
    }
}
