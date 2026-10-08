# Coupling designs, in full

Generated from `designs.json`: every proposal the design panel wrote, with the judge's verdict and binding fixes. Order is build order; the last two were rejected as coupling. See `README.md` for the plan.

---

## Bridges: one axis's gap given by another axis's gap

*Angle: metric. Judge: coupled, score 18. Designer cost: medium.*

### Idea

A premise equates a gap on one axis between one pair with a gap on a different axis between another pair: "Ash is as many steps east of Bell as Ash is later than Hale." The bridged axis is cut elsewhere by one withheld clause, using the `stated` machinery the indeterminate rung already has. The bridge is then the only route across the cut, and its size is known only after the other axis has been accumulated. The time result is an arithmetic input to the east result, so neither axis can be carried on its own.

- **Second turn (cascade).** The source axis is itself cut and bridged from a third axis, which forces the order Z, then Y, then X.
- **Cheaper claim-side variant.** The same sentence shape works as a conclusion: "Gale is more steps later than Bell than Fern is east of Ash." That would be the ND engine's first relation-between-relations, and the first to compare magnitudes across axes. It couples only at the question.

### Example

Space 4D, 6 premises (scratchpad examples.js, seed 4). Setup lines: "Each premise is one step on every dimension it names; a dimension a premise does not name is unknown. 'As many steps east of Bell as Ash is later than Hale' means the two gaps are the same size."
1. Hale is south, above and earlier relative to Iris.
2. Hale is east, same latitude, above and later relative to Fern.
3. Ash is as many steps east of Bell as Ash is later than Hale.
4. Iris is east, north, same height and earlier relative to Ash.
5. Bell is west, same latitude, below and earlier relative to Fern.
6. Hale is same longitude, south, above and earlier relative to Gale.

Q: Where is Ash relative to Hale, east or west?
A: Same longitude.

Derivation:
- Time: Fern = Bell+1, Hale = Fern+1, Iris = Hale+1, Ash = Iris+1, so Ash is 2 later than Hale.
- By premise 3, Ash is therefore 2 east of Bell.
- East: Fern = Bell+1 and Hale = Fern+1, so Hale is also 2 east of Bell. Ash and Hale are level.

Why per-axis reasoning fails: premise 1 omits east/west. On that axis {Ash, Iris} and {Bell, Fern, Hale, Gale} are joined by no east-west clause, so a reader carrying each axis separately answers "can't tell". Reading the bridge as one ordinary step east gives "1 step west". Reading it reversed gives "4 steps west".

Cascade (bridges-cascade.js, 9 premises, 4D):
- "Dune is as many steps north of Elm as Gale is later than Fern"
- "Fern is as many steps above Dune as Gale is north of Elm"
The question "Jade relative to Elm on above/below" answers 1 above. It needs time, then north, then up. The one-step lure says same height.

Claim-side variant (metric.js b): "Gale is more steps later than Bell than Fern is east of Ash" is true (gaps 2 vs 1). Counting premises between each pair (2 vs 3) says the opposite.

### Where it plugs in

**Ladder.** New rung 'bridges' appended to ND_LADDER (utils/progression.utils.ts) after 'mirror-twins'. 'bridges-2' (cascade) is appended later, or kept as an OFF_LADDER rung until measured.

**utils/ndspace.utils.ts:**
- NdLayout.couplings?: NdCoupling[], with a bridge as {r, b, axis, g, h, via, sign}.
- New closeAxes(layout): a weighted union-find per axis over stated clauses, then a fixpoint over couplings. A bridge merges the X components once its (g, h) pair shares a Y component.
- determinedOn and indeterminatePairs must read closeAxes. **Hazard:** with the indeterminate rung on, an unchanged determinedOn would call a bridged pair open and grade a true claim false. That is the CLAUDE.md writer/reader bug class.
- drawBridge(layout): cut a non-zero clause leaving both sides with at least 2 objects, then search for a cross pair with |dx| = dy ≥ 2 on another straight axis, at least 2 premises apart.
- renderNdBridge, painting each half in its axis colour.
- explainNdAxis gets a bridge step ("Dune is 2 east of Cork, so Elm is 2 below Bell").
- Circular and parity axes are excluded from both X and Y.

**generators/ndspace.ts:**
- ndFeatures.bridges = ladder('bridges') && no edits, transforms, compact, speakers, testimony or facing.
- createNdSpace charges the bridge against objectCount, as edits are charged.
- canCheckpoint = false.
- fillNdConclusion asks a pair across the cut on the bridged axis. It requires sign(truth) to differ from the one-step and reversed readings.
- question.depth = X path + 1 + Y path.

**Other files:**
- generators/notes.ts: BRIDGE_NOTE, and ONE_STEP_NOTE stated unconditionally.
- utils/ability.utils.ts: RUNG_COST and RUNG_MIN_PREMISES entries.
- components/mode-modifiers label.
- tests/coupling.test.ts, imported in tests/index.ts.

### Solver

**Generator.** It decides determinacy with per-axis union-find plus the coupling fixpoint, and takes the truth from coordinates.

**Independent check.** A reader sees only the rendered HTML: tags stripped, and each clause assigned to its axis by its colour class, as tests/widest-group.test.ts does. It turns every stated clause into x_to - x_from = ±1 or 0, and every bridge into s1(x_r - x_b) - s2(y_g - y_h) = 0. It then runs exact rational Gaussian elimination. The asked gap is determined exactly when its vector lies in the row space, and the resulting value must equal the marked answer.

Ambiguity is excluded by these checks:
1. The query is in the row space.
2. With the bridge deleted, the query is not in the row space. This is the mutation test, and it goes red if the bridge is decorative.
3. The bridge's own direction words hold in the solved arrangement.
4. The bridge's source gap is at least 2 premises long, so it has to be derived rather than read off.
5. The one-step and reversed readings give a different sign from the truth.

The test must also assert that closeAxes agrees with Gaussian rank on around 1,000 generated items, because the generator and the reader are separate implementations.

### Lures

1. **"Can't tell".** Per-axis connectivity finds no east-west path across the cut. This is the strongest lure, and it is the correct answer on an indeterminate item, so a reader cannot dismiss it by habit.
2. **Bridge read as one step.** The bridge is read as "Ash is east of Bell", one step, giving 1 west in the example.
3. **Bridge direction reversed**, giving 4 west.
4. **Source gap read from one premise** instead of derived along its chain. Excluded structurally, since G and H are at least 2 premises apart.
5. **Cascade:** solving the axes in the wrong order stalls on "can't tell".

### Pricing

- **RUNG_COST:** bridges 1.6, between indeterminate (1.3) and facing (1.8). One axis must wait for another axis's finished accumulation, and "can't tell" has to be resisted rather than noticed. bridges-2 costs about 1.2 marginal.
- **RUNG_MIN_PREMISES:** bridges 5 (it builds at 4, but asking a pair at least 2 premises apart is cramped there); bridges-2 6. Space 4D and 5D, capped at 8 and 7, hold it comfortably. 6D and 7D, capped at 6, only just.
- **Guess floor:** 25% as a choice among truth, one-step lure, reversed lure and can't tell; 50% as a boolean.
- Refit with fitRungCosts (ability.utils.ts) once trials exist.

### Overlap

- **Transforms (rotate):** a frame operation that relabels every object's values at once; per-axis carrying works again after the turn. A bridge is a static premise about two different pairs whose size is a derived value, not a relabeling.
- **Oblique Basis:** each word is a fixed codex vector; once decoded, the columns add independently. A bridge's size is not fixed, it is whatever the other axis's chain produces.
- **Axis Maps:** an induced permutation applied per object.
- **Indeterminate rung:** bridges reuse its withheld clause, but invert it: the axis looks open per-axis and is in fact closed through another axis.
- **Linear meta:** compares signs on one scale, and is not load-bearing for determinacy.
- **Widest Group:** compares magnitudes across dimensions, but of stated coordinates, with no derivation.
- **Walking Totals (proposal 2):** its open-budget invariant is exactly a bridge-shaped fact, so the two share a solver and phrasing.

### Everyday reading

- **Time zones:** a gap in longitude converts into a gap in clock time ("as many hours ahead as it is zones east").
- **Exchange rates and equivalences** ("as many floors up as stops down the line").
- **Recipes that scale one ingredient by another.**

### Prototype

All scripts are in /tmp/claude-0/-home-user-mindbuild/5171ceae-af4f-5c1f-ba03-e9bbb2dee24a/scratchpad/coupling-metric-order/.
- **lib.js:** a minimal port of the engine (unit steps, chain or branching tree, the app's clause wording) plus a text-only reader. The reader parses rendered sentences into linear equations and does exact rational Gaussian elimination.
- **bridges.js:** built 400/400 items (mean 1.17 layouts drawn). The reader agreed with the marked answer on 400/400. With the bridge sentence deleted, the queried gap was undetermined on 400/400, so the bridge is load-bearing every time.
- **bridges-cascade.js:** built 300/300 at 8 objects in 4D. On every item, deleting either bridge leaves the question open.
- **sweep.js:** one bridge builds 100% from 4 premises in 3D to 6D at every premise cap. Two bridges build 100% from 6 premises.
- **metric.js (b):** the claim form built 500/500 with the premise-count lure reversed.
- **examples.js:** prints and re-verifies the worked example.

### Judge: attempt to split it per axis

Re-solved in coupling-judge/metric-judge.js. Premise 1 omits east, so per-axis connectivity on east finds no path between {Ash, Iris} and {Bell, Fern, Hale, Gale}, and the per-axis answer is 'can't tell'. The bridge can only be used once the time axis is finished. Time gives Ash−Hale = 2, so east Ash−Bell = 2. East Hale−Bell = 2, so Ash and Hale are level, which is the designer's answer. The east answer is an arithmetic function of a completed time accumulation, so no per-axis carry can use it. Re-ran bridges.js: 400/400 agreement, and the question is open without the bridge on 400/400. The cascade built 300/300, and each bridge is necessary.

### Judge: verdict

Clean premise-level linear coupling. It can be delivered in every composed space, Direction included, because any two straight axes will do. It is decided exactly by Gaussian elimination, and it lays down the NdCoupling/closeAxes layer that Walking Totals, Ranked and the clocks shear can all reuse. It is the best first build despite a slightly lower total.

### Judge: fixes (binding)

(1) determinedOn and indeterminatePairs must read closeAxes. Otherwise a bridged pair counts as open under the indeterminate rung and a true claim is graded false. Add a mutation test for it. (2) As proposed, only the pair choice in fillNdConclusion changes, and the analogy form fires before it (useAnalogy), so it bypasses that choice. Pass the layout with the bridge read as one ordinary step as `initial`, so that pairBites and analogyBites force every form to need the bridge. (3) Show ONE_STEP_NOTE unconditionally and add a 'a dimension a premise does not name is unknown' line. (4) RUNG_MIN_PREMISES 5. At 6D and 7D, with a cap of 6, it only just fits.

---

## B. Skewed axis: Galilean shear (rung `local-clocks`, with a barge-drift variant)

*Angle: frames. Judge: coupled, score 19. Designer cost: small.*

### Idea

A shear between two straight axes: target' = target + rate·source. Two presets of the same machinery:

- **Local clocks (time zones):** a clock reads one step later for each step east, so τ = t + x. A premise marked "by local clocks" states Δτ, so the real Δt = Δτ − Δx. Its time clause depends on its own east clause.
- **Barge drift (Galilean boost):** east is measured aboard a barge drifting one step east per step of time. Then Δx = Δx_aboard + Δt: the east clause depends on the time clause.

Premises are mixed: some marked, some by the station clock or from the bank. The question names which reading it wants. Every clause is one step (ONE_STEP_NOTE is required), which makes the correction exact.

This is the only proposal that is not a signed permutation. One stated clause feeds two axes in proportion (determinant 1, unimodular), so the reader must keep an extra running total: the source clauses of the marked premises only.

### Example

4D, prototype default seed.

Setup: "Clocks are local: one step east, a clock reads one step later than a clock one step west of it at the same moment. Premises marked by local clocks give the time as the clocks where the two things are read it; the rest use the station clock. Each premise is one step on every dimension it names."

Premises:
- By local clocks, Eve is west, south, below and later relative to Fay.
- Cole is east, south, above and earlier relative to Ash.
- Dell is west, south, below and earlier relative to Ash.
- By local clocks, Eve is west, same latitude, same height and earlier relative to Bell.
- By local clocks, Ash is east, south, above and earlier relative to Bell.

Question: By the station clock, is Fay later or earlier relative to Dell, or at the same time?
Answer: later.

Why: each local premise's true Δt is Δτ − Δx:
- Ash−Bell = −1−1 = −2.
- Eve−Bell = −1+1 = 0.
- Eve−Fay = +1+1 = +2.
- Along Fay→Eve→Bell→Ash→Dell: −2 + 0 + 2 + 1 = +1.

The per-axis reader adds the stated time clauses (−1 −1 +1 +1) and says "same time". Correcting the wrong way (clocks east read earlier) gives "earlier".

Barge variant (same run):
- Aboard, Dell is west, north, below and earlier relative to Cole.
- Dell is west, north, below and earlier relative to Fay.
- Bell is west, south, below and earlier relative to Cole.
- Aboard, Eve is west, south, below and same time relative to Ash.
- From the bank, Bell is same longitude, south, above and later relative to Ash.

Question: Aboard, is Eve east or west relative to Fay?
Answer: east. In bank terms Eve−Fay = [−1,−1,−3,−2], and aboard Δx = −1 − (−2) = +1.

Every shortcut says west: the literal reading, the wrong-way correction, correcting every premise, and answering from the bank.

### Where it plugs in

AxisSpec (utils/ndspace.utils.ts:50) gains `local?: {source: number; rate: number}` on the target axis: the local reading is value + rate × (position on `source`). Presets:
- clocks: temporal ← east, rate +1.
- barge: east ← temporal, rate −1.

NdEdge (:247) gains `local?: boolean`.

New skewEdges(layout, target, k): reinterprets k of the drawn unit edges as local readings, rewrites their world deltas, and recomputes coordinates with coordsFromEdges (:406, exported). The unskewed layout is then exactly the literal reader's model.

renderNdPremise (:845): a local edge is prefixed "By local clocks," or "Aboard," and prints toLocal(deltas).

generators/ndspace.ts:
- ndFeatures adds `localClocks` from ladder("local-clocks"). Only when both axes are straight: loops are excluded for the same reason rotationAxes excludes them. Exclusive with indeterminate, edits, transforms, speakers, testimony and frames.
- createNdSpace: skew, then fillNdConclusion(ctx, q, unskewed, asked), where `asked` is the world layout or its local view. The existing mutated/axisBites path enforces that the marks matter.
- Prefix the conclusion with the reading's name.
- ndSetup adds CLOCK_NOTE or BARGE_NOTE and always adds ONE_STEP_NOTE.

Also: ND_LADDER gets "local-clocks", RUNG_COST gets an entry, and tests/skew.test.ts is added.

### Solver

Integer arithmetic throughout. The premises form a tree. Each marked premise's local reading is a unit step on every axis, so the words state it exactly. World delta = toWorld(stated), so the layout is unique.

The asked reading is a fixed linear map of world coordinates, so the existing conclusion builders run on the mapped layout unchanged.

Verification (tests/skew.test.ts): parse the rendered card, apply the rule exactly as the setup states it (marked: target −= rate·source), walk the tree, and compare with the item.

Mutation test: flip the sign of `rate` in the renderer. The test must go red, naming "wrong way".

Indeterminate is excluded: withholding a source clause would leave the target undetermined on a marked edge.

### Lures

1. Literal: the stated columns carried independently. Wrong on 100%.
2. Wrong way: east clocks read earlier, or the barge drifting west. Wrong on 100%.
3. Every premise corrected, not just the marked ones. Wrong on about 60%.
4. Premises right, but answered in the other reading. Wrong on about 66%.

All four fail in the barge example.

### Pricing

`local-clocks` at 1.4. It is one linear correction and one extra running total over the marked premises: dearer than `indeterminate` (1.3), cheaper than `facing` (1.8). The barge preset is the same rung and alternates with clocks wherever both axes are straight.

Raise it if play shows the quantitative step (it needs magnitudes, not just signs) is harder than the sign-only rungs. Estimate for fitRungCosts.

### Overlap

- **Every existing map (rotatePoint, applyAxisMap, Context Shifts, Pivot Transforms, the frames in A)** is a signed permutation: one source axis to one target. After relabelling, the columns are independent again. A shear is not.
- **Oblique Basis:** also moves two axes per word, but by a fixed codex vector with no clauses. Here the premise carries per-axis clauses, and the correction depends on the premise's own other clause and on whether it is marked.
- **Transforms:** move objects. Here nothing moves; a reading convention changes.

### Everyday reading

Time zones: "left at 10, landed at 9 local; how long was the flight?" Walking on a moving train or walkway. Rowing against a river current. Prices in "1990 dollars", a shear between money and time.

### Prototype

scratchpad/coupling-linear-frames/clocks.js. Run with `node clocks.js`; the output is saved in clocks.out.

- 9,000 items (clocks 4D, drift 4D, clocks 5D).
- An independent reader parses the tags and clauses and applies the setup's rule. It agreed on 9,000/9,000.
- About 23% of draws are kept. Draws are cheap.
- The literal and wrong-way lures are wrong on 100% (enforced). Correcting every premise is wrong on 58–62%; answering in the other reading on 65–67%.
- The answers lean toward "same time" (about 43%) because of the two bite constraints. The real generator should draw the answer class first, then reject until it fits.
- The two shears do not commute: clocks∘drift = [[1,1],[1,2]] and drift∘clocks = [[2,1],[1,1]]. Together they generate SL(2,ℤ). That is the ceiling (any unimodular map); stacking both is not offered as a rung.

### Judge: attempt to split it per axis

Re-solved in coupling-judge/time-judge.js. Carrying the stated time column alone gives Fay−Dell = 0 ('same time'), which is wrong. Carrying stated time and stated east separately and converting once at the endpoints (τ − x) also gives 0, also wrong. The true answer is +1 ('later'). Getting it means subtracting each marked premise's own east clause, which is a third running total kept over the marked premises only. Marking is per premise, so no global basis makes the columns independent. Of the linear maps proposed, this is the only one that is not a signed permutation. Barge example re-solved: Eve−Fay = [−1,−1,−3,−2] in world terms, so +1 east aboard, and every shortcut says west. Re-ran clocks.js: 9000/9000 agreement.

### Judge: verdict

Real premise-level coupling at small cost: one AxisSpec property, skewEdges, and a prefix in the renderer. It is checked exactly with integer arithmetic. Passing the unskewed layout as `initial` through the existing mutated/axisBites/pairBites/analogyBites path makes every conclusion form need the shear, so it does not hit the facing delivery trap. Of the shear, the light cone and the bridges, this is the cheapest.

### Judge: fixes (binding)

(1) Both presets need a temporal axis. ND_LADDER is shared with Direction and Space 3D, which have none, and the axis picker can drop time in 4D+. As proposed, the rung would be charged and never delivered there. Add a spatial preset (for example 'above the ramp floor', which rises one step per step east) for 3D and gate Direction off, or fork the ladder. (2) 43% of answers are 'same time': draw the answer class first, then reject until it fits. (3) Set canCheckpoint=false, or assert that ndPrefixLayout uses world deltas. (4) ONE_STEP_NOTE must be shown unconditionally; today it is gated on constructDistance in ndSetup. (5) Ship clocks first and barge later. 'Aboard' east between events at different moments is the less intuitive preset. (6) Absorb the dynamics designer's date-line ring as a variant of this rung.

---

## Local Clocks: the time axis read on clocks set by east, with a date line

*Angle: dynamics. Judge: coupled, score 15. Designer cost: small.*

### Idea

Time clauses are stated as local-clock readings. Each zone east is one hour ahead, so the real gap = the local gap − (zone_to − zone_from). This is the meaning of the temporal axis depending on the east axis.

- **Straight east axis:** a shear. Carry the clock sum and the east sum, then subtract.
- **Looped east axis** (the existing `modulus`, with a date line between the last zone and the first): the zone difference is the east displacement minus m × the number of times the chain winds across the line. So the reader needs absolute zones, meaning east position relative to the line, not displacements.

An honest classification: probes.js shows the answer still telescopes to "clock sum minus endpoint zone difference" in 500/500 items. This is question-level coupling through absolute position (a winding count), not per-premise coupling. It is the shallowest and cheapest of the three: render-only, and every existing temporal conclusion becomes coupled for free.

### Example

localclocks.js seed 5, m = 4.

Premises:
- There are 4 zones in a ring; each zone east is one hour ahead. The date line runs along the west edge of the first zone, and Dune is in zone 2 of 4, counting east from the line.
- Ash is in the same zone as Bell; Ash's call read the same time on its clock as Bell's did on Bell's.
- Cane is 1 zone east of Bell; Cane's call read the same time on its clock as Bell's did on Bell's.
- Dune is 1 zone east of Cane; Dune's call read 2 hours later on its clock than Cane's did on Cane's.

Q: In real hours, how long after Bell's call was Dune's?
A: **4.** Dune is in zone 2, so Cane is in zone 1 and Bell, one further west across the line, is in zone 4. Cane's clock runs 3 hours behind Bell's, so Cane's call came 3 real hours after Bell's even though the clocks read the same. Cane to Dune is +2 on the clock and +1 zone, which is 1 real hour. Total: 4.

Wrong answers:
- Per-axis, carrying the east displacement (+2 zones) and subtracting it from the clock sum (+2) gives 0. This ignores the date line.
- Reading the clocks as one clock gives 2.
- Applying the zone correction with the wrong sign gives 0.

### Where it plugs in

**AxisSpec** (utils/ndspace.utils.ts) gains `clockOf?: number` on the temporal axis: the index of the axis whose position sets local time. It is set by a new rung, "local-clocks", appended to the 4D–7D ladder proposed under Light Cone.

**Rendering only.** renderNdPremise/axisClause prints an edge's time clause as Δt + (zone(to) − zone(from)). Zone is the coordinate on the clock axis, which buildNdLayout already reduces mod modulus on a ring; the date line falls out of that existing reduction. Coordinates are unchanged, so buildNdConclusion and buildNdConstructClaim keep asking about real time.

**generators/ndspace.ts**
- ndFeatures gates the rung on a straight time axis plus an east axis.
- The strong form needs east looped. circularCapable loops east first, but with the circular dial at 2 or more it loops time too, and that must switch this off.
- On a ring, an anchor line naming one object's zone is added through `extraPremises`, the mechanism facing already uses.
- A bites check like axisBites: the asked temporal answer must differ from the "one clock" reading, and on a ring from the "no date line" reading.
- ndSetup gets LOCAL_CLOCK_NOTE.

**Phrasing cost.** East's cyclic wording is clockwise/anticlockwise (a compass ring). Zones need "east/west round the globe" wording.

### Solver

The generator keeps real-time coordinates as now; only the rendering changes, so items stay exactly determined.

Zones are unique given the anchor, because the steps fix them mod m. The answer is stated as whole hours, or as an order claim ("Ash's call was earlier than Dune's") through the existing conclusion builders.

Independent check (tests): a text-only solver as in localclocks.js, which enumerates zone assignments mod m and asserts exactly one survives. Also assert the bites rate, and a rung-delivery mark: /on its clock/.

### Lures

- **One clock.** Local readings compared directly: the per-axis time reading.
- **No date line.** The zone change treated as the east displacement. This is the straight-axis shear: correct off the ring, wrong on it, and it is the winding error.
- **Wrong sign.** Adding the zone offset instead of subtracting it (east is ahead).

### Pricing

RUNG_COST "local-clocks" about 1.2 as a guess. Off the ring it is one subtraction per pair; on the ring there is a winding count, but the loop itself is already priced by the circular dial (1.2, then 0.8). RUNG_MIN_PREMISES 3.

This is cheaper than the other two because the coupling is applied once, at the end of the chain.

### Overlap

- **XT rotation** (drawNdTransforms) moves one object's coordinates once, uniformly. Local clocks re-read every time clause according to where it is stated.
- **Circular axes** today only reduce positions mod m; they never carry an offset into another axis. This is the first axis property that does.
- **Relation Algebra's routes on a cube** (apps/relations/routes.js) share the idea that meaning depends on where something is stated. There the holonomy is per-premise; here it telescopes, so it is the weaker form.

### Everyday reading

- **Time zones and flight times:** "leaves Tokyo 5pm Tuesday, lands Honolulu 5am Tuesday".
- **Calls across offices.**
- **The date line:** "fly east and arrive the day before".
- **Jet lag arithmetic.**

### Prototype

All in /tmp/claude-0/-home-user-mindbuild/5171ceae-af4f-5c1f-ba03-e9bbb2dee24a/scratchpad/coupling-time/.

- **localclocks.js:** a generator plus a text-only solver. The solver brute-forces every zone assignment mod m consistent with the steps, requires it to be unique given the anchor, then propagates real time.
  - Agreement: 400/400 at m = 4 and 400/400 at m = 5. Every item's path crosses the line, and all three lures are wrong by construction.
- **probes.js:** the endpoint formula matches 500/500. That is the evidence it is end-of-chain coupling, and the header comment in the script now says so.

### Judge: attempt to split it per axis

Solved in coupling-judge/time-judge.js by carrying each axis separately and combining once. East, carried from the anchor mod 4, gives zones Bell 4 and Dune 2. The clock column sums to +2. Real gap = 2 − (2 − 4) = 4, the designer's answer. Only the endpoints' zones enter; the designer's own probe shows the endpoint formula matches 500/500. No premise needs another axis. Real time is a linear combination of two totals carried separately, so it passes the definition only through its 'the question couples axes' clause, and only just.

### Judge: verdict

The weakest coupling in the set: end-of-chain, one subtraction. It is the case of the frames designer's clocks shear in which every premise is marked, plus a ring. The shear does not telescope; this does. It does not justify a rung of its own.

### Judge: fixes (binding)

Fold it into the clocks shear (frames B) as that rung's ring/date-line variant, with marked and unmarked premises mixed so the correction no longer telescopes. The m-hour 'day' implied by m zones must be stated, not left to be inferred. If kept on its own, price it at or below a circular-dial step.

---

## Light Cone: time is a travel budget the spatial axes share

*Angle: dynamics. Judge: coupled, score 19. Designer cost: medium.*

### Idea

In 4D–7D stacks each object is an event: a bell ringing at a place and a moment. The card states a speed limit: a ring travels one block per minute, along east–west, north–south or up–down, one block at a time (taxicab distance).

"Can X's ring have reached Y by the moment Y rang?" is true exactly when t_Y − t_X ≥ |dx| + |dy| + |dz|. The time gap is one budget spent across every spatial axis together, so passing each axis on its own is not passing. This is a non-linear coupling: an absolute-value sum across axes, compared against another axis.

Three rungs:
1. **cone.** The question couples the axes. Answered true/false, or with the existing `select` mode: "which of these could X's ring have reached?"
2. **signals.** In some premises the time clause is replaced by "... and rang the moment X's ring reached it". That premise's time gap is then its own taxicab length, so time is derived from space one premise at a time. It does not telescope: in probes.js, items with the same endpoint displacement had different time gaps in 1252 of 2000 cases.
3. **reach.** Bound premises: "rang only after X's ring had reached it" means Δt ≥ length. The asked claim must then be settled from one side (must, or cannot). Causal order becomes a partial order coupling time to space.

The metric has to be taxicab (or Euclidean). Under king-move (Chebyshev) distance, "within the cone" is exactly "every axis within budget", which decomposes per axis.

### Example

**Rule shown on the card:** "Each name is a bell ringing at a place and a moment. A ring travels one block per minute, and only east-west, north-south or up-down, one block at a time. A ring reaches a bell if it can get there by the moment that bell rings (arriving exactly then counts)."

**(a) Rung cone** (cone.js seed 3)
- Ash is east, north, above, 1 min earlier relative to Bell.
- Cane is west, south, below, 1 min later relative to Bell.
- Ash is east, north, below, 1 min later relative to Dune.
- Ash is same longitude, north, below, 3 min earlier relative to Elm.

Q: Dune's ring can have reached Cane by the moment Cane rang.
A: **False.** Cane − Dune is 1 west, 1 south, 3 below, and 3 minutes later. The taxicab distance is 5 blocks, which is more than 3 minutes.
Per-axis reading: every axis needs at most 3 blocks, which is ≤ 3 minutes, so "true". Wrong. The time-only reading ("Cane is later") also says true.

**(b) Rung signals** (seed 12)
- Ash is east, south, above relative to Bell, and rang the moment Bell's ring reached it.
- Bell is same longitude, north, below relative to Cane, and rang the moment Cane's ring reached it.
- Dune is west, north, above, 1 min later relative to Bell.
- Elm is east, north, below, same moment relative to Dune.

Q: Cane's ring can have reached Dune by the moment Dune rang.
A: **True.** Bell rang 2 minutes after Cane (2 blocks), and Dune 1 minute after Bell, so the gap is 3. Dune − Cane is 1 west and 2 north: 3 blocks, arriving exactly on time.
Route reading: summing the premises' steps gives 2 + 3 = 5 > 3, so "false". Wrong.

**(c) Rung reach** (seed 21)
- Ash is same longitude, same latitude, below relative to Bell, and rang only after Bell's ring had reached it.
- Bell is east, south, above relative to Cane, and rang only after Cane's ring had reached it.
- Dune is east, north, above, 3 min later relative to Bell.
- Bell is east, north, above, same moment relative to Elm.

Q: Ash's ring can have reached Dune by the moment Dune rang.
A: **False, necessarily.** Ash rang at least 1 minute after Bell, and Dune exactly 3 minutes after Bell, so Dune − Ash is at most 2 minutes. Dune − Ash is 1 east, 1 north, 2 above: 4 blocks.
Per-axis reading: each axis is ≤ 2, so "could". Wrong.

**(d) Select form** (cone-select.js seed 2): "Which could Bell's ring have reached?"
- Answer: {Fern}
- Per-axis reading: {Ash, Cane, Dune, Fern}
- Route reading: {}
- Time-only reading: all five.

### Where it plugs in

**Ladder.** New rungs "cone", "signals" and "reach" go on a 4D–7D ladder: ND_TIME_LADDER = the current ND_LADDER entries + these three, in utils/progression.utils.ts RUNG_LADDERS for Space 4D–7D. Direction and Space 3D keep ND_LADDER, because they have no time axis and rung-delivery.test.ts would catch an undeliverable rung. Both lists stay append-only from then on.

**utils/ndspace.utils.ts**
- AxisSpec gains `stride?: number`, the largest step a premise may state on that axis. Time gets 3–4 under cone.
- buildNdLayout draws ±stride on that axis, and axisClause renders "3 min later".
- NdEdge gains `form?: 'signal' | 'reach'` and a hearer side.
- For a signal edge, the edge's time delta is set to ±|spatial|₁ before coordinates are walked; coordsFromEdges already re-derives them.
- renderNdPremise gets a branch for signal and reach premises.
- New pure helpers: taxicab(layout, a, b, spatialAxes) and timeBounds(layout, a, b) (lo/hi along the unique tree path).

**generators/ndspace.ts**
- ndFeatures gets cone, signals and reach. They are gated on a straight temporal axis plus at least two straight spatial axes in the actual stack (the axis picker can remove them), and exclusive with edits, transforms, speakers, testimony, indeterminate and facing in version 1.
- fillNdConclusion gets a cone branch, like the facing branch: boolean, or answerMode 'select' with selectAnswer.
- ndSetup adds the speed-rule note (new CONE_NOTE in generators/notes.ts). ONE_STEP_NOTE needs a "time states its minutes" exception.

**Pricing and floors.** RUNG_COST and RUNG_MIN_PREMISES entries in utils/ability.utils.ts.

I would not use a DIAL for the number of signal or bound premises. dialsFor only discovers dials from `retired-*` tombstones, so derive the count from the premise count instead, e.g. 1 + floor(premises / 4).

### Solver

**In the generator.**
- Exact integer coordinates from the tree, as today.
- For reach, determinacy is structural. Walk the unique tree path: if every bound on it points the same way relative to the question, the answer is fixed by the longest-path lower bound (or the shortest-path upper bound). If the bounds point both ways, nothing ties the two times together, and the item is rejected rather than shipped.
- Truth is decided before the pair is drawn, and each answer gets its own trap: every "no" item passes per-axis, every "yes" item fails the route-length test. Those rejection rules are what put each shortcut at exactly chance.
- Signal and reach premises must lie on the asked path, or they are decoration. This is the same principle as axisBites, and the prototype initially lacked the check.

**Independent check (tests/cone.test.ts).** Strip the HTML, parse the clauses, and solve as cone.js `solve` does. Assert agreement, assert the 50% lure rates (a regression there means a giveaway has crept in), and add a rung-delivery mark: /ring can have reached/.

**Ambiguity excluded:**
- The boundary is stated ("arriving exactly then counts").
- Loops are off on the axes the metric uses. A looped spatial axis would need ring distance, and a looped time has no future.
- Non-spatial axes (contains, quantity, distinction) are named as not counting for travel.

### Lures

- **Per-axis / Chebyshev (the decomposition lure).** "Every axis is within the time, so it's reachable." This ignores that the minutes are shared.
- **Route length.** Summing every premise's steps instead of the straight-line taxicab displacement: a triangle-inequality error, the same one the research note's "route" lures describe.
- **Time-only / Newtonian.** "Later means reachable."
- **Bound read as equality** (reach): taking "rang only after" to mean "rang the moment".
- **Boundary.** Exactly-on-time arrivals counted as late.
- **Wrong direction** (signals): the time gap's sign taken from the speaker rather than the hearer.

### Pricing

Hand-written guesses, as the RUNG_COST header says all of them are, to be checked with fitRungCosts once trials exist. For comparison, construct-distance costs 1.2.

- **cone 1.5.** Every axis has to be carried with its magnitude, as construct-distance demands, then summed and compared.
- **signals +1.2** marginal. Time is no longer stated on those premises and has to be computed from their spatial clause count, with direction from who heard whom.
- **reach +1.6** marginal. Bounds, one-sided reasoning, and a must/cannot claim. Dearer than indeterminate (1.3), because the bounds come from distances.

RUNG_MIN_PREMISES: cone 3, signals 4, reach 4. The select form's guess rate is about 1 in 2^4 subsets, against 1 in 2 for boolean, and the model already reads option counts.

### Overlap

- **Transforms (XT rotate), Oblique Basis, Axis Maps.** These are linear maps; a reader can carry the axes in the right basis and convert. The cone is a norm across the axes compared against time, which no linear change of basis decomposes.
- **construct-distance.** Asks for per-axis magnitudes, which decompose. The cone asks whether their sum fits a budget held on a different axis.
- **indeterminate.** Per-axis connectivity (determinedOn). The reach rung's indeterminacy is cross-axis: spatial distances set the width of the time bounds.
- **facing.** A sign in one spatial plane, fixed at statement. Time plays no part.
- **The research note's #6** (disjunctive temporal networks). Ranges on one axis. Here the ranges on time are spatial distances.

### Everyday reading

- **Alibis.** "Seen at the bakery at 2:00 and at the station at 2:10, twelve blocks away: possible on foot?" On a street grid you cannot cut diagonally.
- **Lightning to thunder.** Time gives distance.
- **"Could the message have arrived in time?"** in scheduling.
- **Relativity's light cone**, which defines causal order.

### Prototype

All in /tmp/claude-0/-home-user-mindbuild/5171ceae-af4f-5c1f-ba03-e9bbb2dee24a/scratchpad/coupling-time/.

- **cone.js** generates all three rungs as rendered text. Its `solve` re-reads only that text: it parses the clauses, takes BFS positions for space, groups exact and signal time gaps with union-find, then brute-forces every free group offset in ±30 and requires the answer to be the same across every consistent assignment.
  - Agreement with the generator: 600/600 for each of cone, signal and reach, with exactly 300 true.
  - Each shortcut is wrong on exactly 0.50 of items: per-axis (Chebyshev), route length and time-only. Every single heuristic therefore scores chance.
- **cone-select.js:** 300/300 agreement. Answer sizes are spread (1/5: 121, 2/5: 82, 3/5: 72, 4/5: 25), and every lure produces its own wrong subset.
- **probes.js** shows signal premises are path-dependent (1252/2000), as above.

### Judge: attempt to split it per axis

Re-solved in coupling-judge/time-judge.js. (a) Cane−Dune = [−1,−1,−3] with 3 minutes to spare. The per-axis reading (each axis within budget, i.e. Chebyshev) says reachable. The true taxicab distance is 5, which is more than 3, so it is not reachable. (b) Signals: Dune−Cane = [−1,2,0] with a gap of 3, and the taxicab distance is 3, so it is reachable. Summing the route's steps gives 5, which says it is not. The question compares Σ|Δi| over the spatial axes with a different axis. That is nonlinear, so no change of basis splits it into per-axis problems. Signal premises put the coupling inside each premise: in probes.js, items with the same endpoint displacement had different time gaps in 1252 of 2000. Re-ran cone.js: 600/600 agreement for each of cone, signal and reach, and every single shortcut is wrong on exactly 50%.

### Judge: verdict

Coupled, and it has the highest training value in the set. It moves from a shared budget and a nonlinear norm to times derived per premise and then one-sided bounds, and every single heuristic stays at chance. The rule is fully stated on the card, including the boundary case. The integration plan has two concrete defects, listed below.

### Judge: fixes (binding)

(1) ND_TIME_LADDER = [...ND_LADDER, 'cone', ...] breaks the append-only rule. The next rung appended to ND_LADDER would shift cone's position for every 4D–7D profile. Freeze a literal copy at the fork, append shared rungs to both lists by hand, and add a test for it. (2) A cone branch placed 'like the facing branch' would sit after analogy, checkpoint, construct and choose, so it would never be delivered. That is exactly the confirmed facing bug. Put it ahead of those branches or make it their claim form. (3) The axis picker can remove time from a 4D+ stack, so gate per item and keep rung-delivery.test green. (4) Multi-minute time steps (stride) need an explicit exception to ONE_STEP_NOTE. (5) Agree with Walking Totals on which rung owns the L1 budget, so one skill is not priced twice.

---

## Kind frames: a direction word is read by where its speaker sits on another axis

*Angle: loops. Judge: coupled, score 18. Designer cost: medium.*

### Idea

A frame change with no seam. Every relation is in the reckoning of the object it is relative to — the app's convention already. The two kinds of the Distinction (parity) axis reckon differently: the other kind's frame is P.
- **mirror:** east and west exchanged.
- **swap:** north and up exchanged.

Kind is itself carried through the chain by same-kind and opposite-kind clauses. So to read any premise, the reader must first carry the kind of its reference object relative to the claim's reference, then decode the premise through P or not.

P is an involution and parity is already relative, so **no anchor is needed**. This is the anchor-free member of the family. Geometrically it is Proposal 2's twist placed on every change of kind: two objects of different kinds are each east of the other.

**Extension ("tide"):** make the selector the helix's pinned phase, e.g. the river runs east by day and west by night.

**Design finding.** A "convert only the viewer" lure (the mirror-twins reading) is ill-defined when only relative kind exists: its answer depended on an arbitrary root. The well-defined requirement is that converting nothing and converting everything both fail. That forces a chain mixing premises stated from both kinds.

### Example

Generated by kinds.js with the mirror rule, and checked by its text-only solver.

**Setup:** "Two kinds reckon east and west oppositely. Every relation is in the reckoning of the object it is relative to."

**Premises:**
- Hart is same longitude, south, same height, same kind relative to Bell
- Cole is east, same latitude, same height, same kind relative to Fern
- Fern is east, south, below, opposite kind relative to Dune
- Fern is west, south, below, same kind relative to Hart

**Claim:** Dune is at the same longitude as Cole. **Answer: TRUE.**

Why, in Cole's reckoning:
- Fern is Cole's kind, so "Cole is east of Fern" stands as stated: Cole = Fern + 1.
- Dune is the other kind, so Dune's "Fern is east" means west for Cole: Fern = Dune − 1.
- So Dune = Fern + 1 = Cole.

Why kind-blind readings fail:
- At face value, Dune is 2 west of Cole.
- Converting everything (P on the sum) gives east.
- Only decoding each premise by its own reference's kind gives "same longitude".

**Swap rule:**
- Dune is west, south, same height, opposite kind relative to Iris
- Bell is west, south, same height, opposite kind relative to Fern
- Dune is same longitude, same latitude, above, same kind relative to Gale
- Iris is east, south, same height, same kind relative to Bell

**Claim:** Bell is at the same latitude as Gale. **Answer: TRUE** — in Gale's reckoning Bell is 3 above, at the same latitude. Face value says 2 north; converting everything says 1 north.

### Where it plugs in

**New rung `kind-frames`**, appended to ND_LADDER.

**utils/ndspace.utils.ts:**
- `AxisSpec.frames?: { rule: "mirror" | "swap"; axes: number[] }`, set on the parity axis.
- Keep `coords` and `edge.deltas` absolute, in the kind-0 frame. Then edits, width, colours and `wordCoordMap` work unchanged, and conversion happens only at the edges:
  - `renderNdPremise` writes F_ref(Δ). Across kinds the converse is −P(d), not −d.
  - `buildNdConclusion`, `buildNdWideConclusion` and `buildNdConstructClaim` compare F_a(coords[b] − coords[a]) through a new `compareInFrame`.
  - `explainNdAxis` says, line by line, which premises were converted.

**generators/ndspace.ts:**
- `ndFeatures`: `kindFrames` is live only with no facing, twins, transforms or analogy.
- `createNdSpace` appends `distinction` when the stack has no parity axis. Only the 7D default has one, so without this the rung would be charged and never delivered on 2D–6D — the "rungs charged but never delivered" bug class.
- The conclusion filter requires both face value and convert-all to fail.

**Elsewhere:**
- notes.ts: KIND_FRAME_NOTE.
- `RUNG_COST['kind-frames']` 1.6 and `RUNG_MIN_PREMISES` 4.
- A mode-modifiers label.
- tests/kind-frames.test.ts, with a mutation that decodes by the subject's kind.

### Solver

**Generation.** Absolute positions are built in the kind-0 frame. Each premise is rendered from a random end, in that end's reckoning. The claim is in the reckoning of the claim's reference.

A (pair, axis) is offered only where face value and convert-all both give a different relation. The false claim is the face-value reading.

**Verification.** A text-only solver:
- carries relative kind by parity;
- places each object by decoding each premise through P exactly when its reference is the other kind;
- evaluates the claim in the claim reference's reckoning.

The answer is unique by structure (a tree of premises plus an involution), so no enumeration is needed.

### Lures

- **Face value:** wrong on 100% of items.
- **Convert everything the same way:** wrong on about 70–74%.
- **Wrong end of the premise:** decoding by the subject's kind. Wrong on about 66–72%.
- **"Across kinds the converse is the negation":** it isn't. Each object is east of the other.

### Pricing

1.6, between indeterminate (1.3) and facing (1.8).

- There is one frame decode per premise. That is cheaper than facing, because the frame is a fixed P rather than a bearing derived from a target.
- Where the rung appends a parity axis, the price includes it; compare MODE_SCALE's step from 6D (2.2) to 7D (2.4).

### Overlap

- **Mirror-twins** swaps one stated viewer's vocabulary, at the conclusion only. Here the frame is derived from a carried coordinate and applies to every premise.
- **Facing** derives a bearing from a stated facing, in one plane.
- **Axis Maps and Oblique Basis** apply one dictionary uniformly. Here which dictionary applies depends on position on another axis.
- **Nested Spaces** deliberately shares nothing between its spaces.
- **Against Proposal 2:** this is the twist with trivial holonomy, since any loop changes kind an even number of times. So it can be gauged away by re-expressing every premise in one reckoning, and that re-expression is exactly the skill trained. The twist cannot be gauged away.

### Everyday reading

- Stage left versus house left, between performers and audience.
- A river's left bank, which is named facing downstream.
- Port and starboard versus an observer on the dock.
- Inbound and outbound on either side of a city centre.
- Mirror writing.

### Prototype

Scripts are in /tmp/claude-0/-home-user-mindbuild/5171ceae-af4f-5c1f-ba03-e9bbb2dee24a/scratchpad/coupling-loops/.

- **kinds.js** covers the mirror and swap rules. Each builds 2000/2000 at 5 objects, and the text-only solver agrees on 2000/2000.
- **Filter.** Items are kept only where both kind-blind readings — face value, and P applied to the whole sum — reach the wrong relation.
- **Lure rates on the true/false verdict:**
  - face value: wrong 2000/2000
  - convert all: wrong 1487 (mirror) and 1403 (swap)
  - decoding by the subject's kind (the wrong end of the premise): wrong 1320 and 1437
- **mutate.js.** A solver that decodes by the subject's kind disagrees on 337/500.

### Judge: attempt to split it per axis

Re-solved in coupling-judge/helix-twist-kinds-judge.js. Kind is carried by parity from Cole: Fern is the same kind, Dune the opposite. Each east clause is then decoded by its reference's kind: Fern = Cole − 1, Dune = Fern + 1 = Cole, so 'same longitude' is TRUE. Taking each clause at face value, one axis at a time, gives Dune−Cole = −2 (west). The east solver needs the parity value of every reference on the path. No reparametrisation removes that: w = (−1)^k·x fails across kinds, because x_S + x_R appears. Turned Frames lacks exactly this: here the frame is chosen by a carried coordinate, not stated per object. Re-ran kinds.js: 4000/4000 agreement, and convert-all is wrong on 70–74%.

### Judge: verdict

Real premise-level coupling with a single involution and no anchor needed. It is the cleanest member of the 'meaning depends on another axis' family, and it is what Turned Frames would need to become coupling.

### Judge: fixes (binding)

(1) Only the 7D stack has a parity axis. Appending 'distinction' to the 2D–6D stacks changes the mode's width and its MODE_SCALE price. Restrict the rung to stacks with a parity axis, or price the added axis explicitly and cover it in rung-delivery. (2) compareInFrame must also reach analogy's relationKey and the checkpoint prefix, because a relation's sign vector depends on whose reckoning it is read in. (3) Pass the face-value layout as `initial` through the mutated path so every conclusion form needs the decode. (4) Keep it exclusive with facing and mirror-twins.

---

## Walking totals: one step budget shared by every dimension (L1)

*Angle: metric. Judge: coupled, score 18. Designer cost: medium.*

### Idea

A premise gives a total number of steps across all dimensions rather than one step per dimension. The budget is shared, so what one axis spends another cannot. There are three forms.

- **Form A (exact).** The premise names a pair's direction on every axis plus one total: "Gale is same longitude, south, above and earlier relative to Dune, 6 steps in all." One axis is cut elsewhere, so that axis's gap = total - sum of |gap| on the others. Each of those gaps is its own chain.
- **Form B (open budget, a selection item).** The premise gives a total and the two directions it was spent in, but not the split: "Elm is 4 steps from Fern, each step above or earlier." The arrangements still possible lie on a diagonal line in the up-by-time plane, not in a box. Each axis on its own can take every sign while most combinations are impossible.
- **Question side.** "Counting every step on every dimension, which is nearest to Fern?" Items are built so that every per-axis way of measuring names a different object.

### Example

**Form A** (Space 4D, 6 premises, examples.js seed 4). Setup lines: one-step note; "a dimension a premise does not name is unknown"; "'N steps in all' counts every step on every dimension, whichever way it goes; such a premise is not one step per dimension".
1. Jade is west, north, below and same time relative to Fern.
2. Gale is same longitude, south, above and earlier relative to Ash.
3. Fern is east, south, above and same time relative to Iris.
4. Ash is same longitude, south and above relative to Jade.
5. Dune is west, north, below and same time relative to Fern.
6. Gale is same longitude, south, above and earlier relative to Dune, 6 steps in all.

Q: Where is Gale relative to Iris, later or earlier?
A: 2 steps earlier.

Derivation:
- The Gale-Dune north gap is 2 (Gale = Ash-1, Ash = Jade-1, Jade = Fern+1, Dune = Fern+1).
- The up gap is 2, and east is 0.
- So the time gap is 6 - 4 = 2, earlier. Iris is at the same time as Fern and Dune.

Why per-axis reasoning fails: premise 4 omits time, so per-axis reasoning gives "can't tell". Reading premise 6 as an ordinary one-step premise gives 1 earlier. Counting each named leg as one step gives 4 earlier. Taking 6 as the time gap gives 6 earlier.

**Form B** (budget-select.js seed 21).
1. Elm is 4 steps from Fern, each step above or earlier (same longitude and same latitude).
2. Gale is east, south, above and later relative to Elm.
3. Gale is east, north, above and earlier relative to Ash.
4. Iris is east, south, below and later relative to Ash.

Q: Select every description that could be true of Iris relative to Fern, from the 3x3 grid of up/same height/below by later/same time/earlier.
A: Three cells: above and later; same height and same time; below and earlier. Iris - Fern = (1, -3, k-1, k-1) for k = 0..4, so up always equals time.

A per-axis reader sees that up can be -1..3 and time can be -1..3, so ticks all 9 cells. Reading premise 1 as an ordinary premise gives "same height, later", which is an impossible cell.

**Nearest** (5 premises, 4D).
1. Cork is east, same latitude, above and earlier relative to Iris.
2. Hale is west, south, same height and later relative to Dune.
3. Cork is same longitude, south, same height and later relative to Gale.
4. Fern is same longitude, south, above and earlier relative to Cork.
5. Hale is east, north, above and later relative to Gale.

Q: Which is nearest to Fern: Iris, Dune or Hale?
A: Hale. Its gap is (1,3,0,1), 5 steps. Iris is (-1,1,-2,2), 6 steps, and Dune is (2,4,0,0), 6 steps.

Fewest dimensions differing names Dune. Smallest longest leg names Iris. Fewest premises apart names Iris.

### Where it plugs in

**Ladder.** Rung 'walk-totals' (Form A plus the nearest question) appended to ND_LADDER; 'open-budget' (Form B) appended after it.

**utils/ndspace.utils.ts:**
- NdCoupling kind 'total' {a, b, total}, with directions taken from coordinates, closed by the same closeAxes fixpoint as Bridges. A total closes axis X once the pair shares a component on every other axis.
- renderNdPremise gets a `total` option that appends ", N steps in all".
- Kind 'budget' {a, b, n, axes:[i,j], signs}. buildNdLayout lets one edge's two-axis split be drawn.
- buildNdNearestChoice(layout, anchor).
- Totals count straight axes only. In 7D the kind clause is stated as usual and is not counted.

**generators/ndspace.ts:**
- ndFeatures flags, with the same exclusions as Bridges.
- The Form B question uses Possibility Sets' select plumbing: question.answerMode = 'select', choices = the 3x3 sign cells, selectAnswer, selectAsked.
- Nearest uses answerMode 'choice'.

**Other files:**
- notes.ts: WALK_NOTE, and ONE_STEP_NOTE unconditional.
- ability.utils.ts: RUNG_COST and RUNG_MIN_PREMISES entries. guessRateForRungs must learn select (Form B) and 1-of-3 choice (nearest).
- tests/coupling.test.ts.

### Solver

**Form A.** Once the signs are stated, the total is linear: sum of s_i(q_i - p_i) = N. The same Gaussian text reader decides it, then checks that every stated sign holds in the solution. Mutation tests:
- Deleting the total leaves the query open.
- Replacing N with N+2 changes the answer.

**Form B.** The reader enumerates the N+1 splits named by the sentence and solves the linear system for each; every split is fully determined. It collects the realised sign cells, and the select answer is that set. The generator requires each budget axis to take at least 2 signs and the set not to be a product of per-axis sets. That condition is what makes it coupling.

**Nearest.** The reader solves every candidate's vector and takes L1. The generator requires a unique L1 minimum. The Hamming, L-infinity and premise-count minima must each name a different object or tie, and at least two must name a wrong object.

### Lures

**Form A:**
- The walk premise read as an ordinary one-step premise.
- Each named leg of the total counted as one step.
- The whole total taken as the cut axis's gap.
- "Can't tell" (per-axis connectivity).

The generator requires all four to differ from the truth.

**Form B:**
- The per-axis product: tick every cell each axis allows.
- The budget read as one step each way, which lands on an impossible cell.

**Nearest:**
- Fewest dimensions differing (Hamming).
- Smallest longest leg (L-infinity).
- Fewest premises apart.
- Nearest on whichever axis was read first.

### Pricing

- **walk-totals:** 1.4, min premises 5. A subtraction across axes on top of indeterminacy's cut; cheaper than a bridge, because the other axes' gaps belong to the same pair.
- **Nearest question:** about 1.1 if split out, near construct-distance's 1.2. It needs magnitudes on every axis plus a sum. Guess floor 1/3.
- **open-budget:** 1.6, min premises 4. A selection over 9 cells, so the guess floor is negligible. The reader has to hold a set of arrangements, not one.
- Refit with fitRungCosts.

### Overlap

- **Mutual Moves:** uses L1 only to choose a reference object, over stated coordinates.
- **Widest Group:** L-infinity of stated spreads.
- **Oddest Relation:** Hamming over sign patterns.
- **construct-distance:** asks per-axis magnitudes but never sums them.
- **Possibility Sets:** the same select UI, but over relation systems rather than a lattice with a shared budget.
- **Bridges:** Form B's invariant ("Iris is exactly as far above Fern as it is later") is a bridge-shaped fact. The open budget produces it; a bridge states it.

### Everyday reading

- **City blocks and taxi distance**, compared with as the crow flies or number of stops.
- **Budgets split between two categories** ("£4, each pound on rent or food").
- **Step counts across moves.**
- **"Which shop is the shortest walk?"**

### Prototype

All scripts are in /tmp/claude-0/-home-user-mindbuild/5171ceae-af4f-5c1f-ba03-e9bbb2dee24a/scratchpad/coupling-metric-order/.
- **walking.js, Form A:** built 400/400; the Gaussian text reader agreed 400/400; with the total deleted the question was open 400/400; every lure was distinct from the truth by construction.
- **walking.js, Form B:** built 400/400. A separate text reader enumerates the budget split from the sentence and reproduced the generator's outcome set every time.
- **budget-select.js:** over 2,000 items, a per-axis reader would tick 6.86 cells on average against 3.65 actually possible. 247 items were the full 3x3-versus-diagonal case.
- **metric.js (a):** nearest built 2000/2000 (mean 4.7 layouts), with the reader re-deriving every candidate's vector.
- **sweep.js:** the walk total builds 100% from 4 premises at 3D to 6D. Nearest builds 55-92% at 4 premises and 93-100% from 5.
- **triangle.js:** distance-only premises without directions stop changing past 2D, so only budgets with named directions are proposed.

### Judge: attempt to split it per axis

Re-solved in coupling-judge/metric-judge.js. Form A: premise 4 omits time, so per-axis gives 'can't tell'. Gale−Dune on the other axes is [0,−2,2], so time = −(6−4) = −2, and Gale is 2 earlier than Iris, as stated. The time gap is whatever budget the other axes' magnitudes leave. Form B: enumerating the 5 splits gives exactly 3 diagonal cells, (−,−), (0,0) and (+,+), where a per-axis reader allows all 9. Nearest: L1 distances of 5, 6 and 6 name Hale, while Hamming names Dune and L∞ names Iris. All three forms fail axis by axis. Re-ran walking.js: 400/400 for each form. Re-ran budget-select.js: per-axis readers tick 6.86 cells on average against 3.65 possible.

### Judge: verdict

Coupled in three ways. Form B, an outcome set that is not a product of per-axis sets, is the most distinctive idea in the metric batch. It overlaps the light cone, since both share an L1 budget, and it reuses Bridges' solver, so it is a cheap follow-on rather than a first build.

### Judge: fixes (binding)

(1) Ship Form A and the nearest question first, on Bridges' closeAxes. Form B needs the select plumbing and a two-axis split edge in buildNdLayout. (2) The 'N steps in all' premise breaks the one-step rule for that one premise, and the setup must say so. (3) guessRateForRungs must learn select and 1-of-3 choice. (4) Use the same delivery hook as Bridges: the literal reading as `initial`. (5) Agree with the light cone on who owns the budget skill.

---

## Ranked lists: lexicographic premises whose height content depends on time

*Angle: metric. Judge: coupled, score 16. Designer cost: medium.*

### Idea

A setup line fixes a sort order: "The list runs in order of time; things at the same time are listed lowest first." Premises then say "Ash is listed before Dune." The same sentence means different things depending on the other axis:
- If the two objects turn out to be at the same time, it states a height inequality.
- If one is earlier, it says nothing about height at all.

Which case holds is known only after the time axis has been carried. The meaning on one axis therefore depends on the value of another, the purest form of coupling in the definition.

The up axis is cut (one withheld clause), so rankings are its only bridge. Each item carries two rankings:
- **Informative:** a time tie across the cut.
- **Idle:** the pair is one step apart in time, and its height reading would be false.

Variant, not prototyped: "Ash does not beat Bell on every count" (non-dominance) is a disjunction across axes. It pins the cut axis only when every other axis shows Ash ahead, and needs the same bounds machinery.

### Example

Space 4D, 8 premises (ranked.js seed 13). Setup lines: "The list runs in order of time; things at the same time are listed lowest first. A dimension a premise does not name is unknown."
1. Jade is west, north, above and later relative to Dune.
2. Bell is east, south and later relative to Iris.
3. Hale is listed before Iris.
4. Fern is west, same latitude, same height and later relative to Iris.
5. Hale is west, same latitude, below and earlier relative to Bell.
6. Iris is west, north, below and later relative to Gale.
7. Gale is listed before Jade.
8. Jade is east, south, same height and earlier relative to Bell.

Q: Where is Iris relative to Dune, above or below?
A: Above.

Derivation:
- Time: Bell = Iris+1, Hale = Bell-1, Jade = Bell-1, Gale = Iris-1.
- Premise 3 joins two things at the same time, so Hale is lower than Iris.
- Premise 7: Gale is earlier than Jade, so it is explained by time and says nothing about height.
- Height: Dune = Jade-1 = Bell-1 = Hale, which is below Iris.

Why per-axis reasoning fails: premise 2 omits height, the only height link between {Iris, Fern, Gale} and {Bell, Hale, Jade, Dune}. Ignoring the rankings gives "can't tell". Reading premise 7 as height (Gale lower than Jade) gives Iris = Gale-1 < Jade-1 = Dune, so "below" outright. Together with premise 3 that reading is a contradiction.

### Where it plugs in

**Ladder.** New rung 'ranked' appended to ND_LADDER.

**Wording.** Ranked needs a key axis and a tiebreak axis, both straight, with natural wording. A RANK_ORDERS table in ndspace.utils, keyed by axis ids:
- (temporal, then up) as a timetable, for Space 4D to 7D.
- (north, then east) as reading order ("northernmost row first, then west to east") for Direction and Space 3D, which have no time axis.

**utils/ndspace.utils.ts:**
- NdCoupling kind 'rank' {a, b, key, tiebreak}.
- The key axis must be fully stated, so every ranking's case is decided.
- Rankings add inequalities, not equalities, so a new boundsOn(layout, axis, a, b) is needed: difference constraints, Floyd-Warshall over at most 10 objects.
- determinedOn stays equality-only. The conclusion uses boundsOn.
- drawRanks picks one informative pair (time tie, across the up cut, at least 2 premises apart) and one idle pair (time differs by 1, height reading false).

**generators/ndspace.ts:**
- ndFeatures.ranked, with the same exclusions as Bridges.
- fillNdConclusion asks a pair across the cut. The truth must be strictly above or below. Reading the idle ranking as height must give the opposite answer or a contradiction. Without rankings the answer must be open.
- The answer is a choice of above / level / below / can't tell, or a necessity claim worded with INDETERMINATE_NOTE.

**Other files:**
- notes.ts: RANK_NOTE.
- ability.utils.ts: cost entries.
- tests/coupling.test.ts.

### Solver

**Generator.** Coordinates, plus bounds computed over the generator's own equalities.

**Independent reader**, from text only:
1. Solve the time axis by Gaussian elimination. The time axis is fully stated, so every ranking's time gap is determined.
2. Classify each ranking: time gap > 0 is idle; = 0 means h_b - h_a ≥ 1; < 0 is impossible and must never occur.
3. Build difference constraints on height from the stated clauses plus the informative inequalities, and run Floyd-Warshall.
4. min(h_Q - h_P) ≥ 1 gives above; max ≤ -1 gives below; both 0 gives level; anything else is can't tell.

The result must equal the generator's verdict. The two mutation tests above are asserted. The answer is exact in sign; the magnitude is never asked, because inequalities leave it open.

### Lures

1. **Every ranking read as a height statement.** The idle one then gives the opposite answer outright here, "below", or a contradiction when read together with the informative ranking.
2. **Rankings ignored**, giving "can't tell".
3. **The informative ranking read as a time statement.** That clashes with the derived tie, and the reader may decide the premises are inconsistent.
4. **The tiebreak direction flipped.** Reading "lowest first" as highest first flips the answer.

### Pricing

- **RUNG_COST:** ranked 1.7, just under facing's 1.8 and for the same reason: one premise costs two steps (compare the times, then read the height). The idle ranking also removes the shortcut of treating every ranking as height.
- **RUNG_MIN_PREMISES:** 5.
- **Guess floor:** 25% as a four-option choice.
- Refit with fitRungCosts.

### Overlap

- **Facing:** a premise's meaning depends on a facing stated once per item, so it is resolved by one lookup. Here each ranking's meaning depends on a derived value of its own pair, decided premise by premise.
- **Knaves / Testimony:** premises carry no information because the speaker lies, which is decided by consistency. An idle ranking is true but carries no height information, decided by arithmetic on another axis.
- **Relation Algebra's routes (holonomy):** the closest relative in spirit; the meaning depends on where it is said.
- **Pareto dominance:** a per-axis conjunction, which decomposes. A lexicographic premise is a case split across axes, which does not.
- **Lexicographic questions:** decompose, so the coupling lives only in the premise form proposed here.

### Everyday reading

- **Timetables** sorted by time, then by platform or floor.
- **Spreadsheets** sorted by two columns.
- **Reading order** on a page: row, then column.
- **League tables:** points, then goal difference.
- **Queues ordered by arrival time, then by priority.**

### Prototype

/tmp/claude-0/-home-user-mindbuild/5171ceae-af4f-5c1f-ba03-e9bbb2dee24a/scratchpad/coupling-metric-order/ranked.js built 400/400, and the independent text reader agreed 400/400. Two mutations pass on every item:
- Deleting the informative ranking makes the reader say "can't tell" (400/400).
- Deleting the idle ranking leaves the answer unchanged (400/400).

sweep-ranked.js: 99-100% built from 5 premises in 4D, 5D and 6D, at every cap.

### Judge: attempt to split it per axis

Re-solved in coupling-judge/metric-judge.js. Time first: Hale−Iris = 0 and Jade−Gale = 1. So 'Hale before Iris' constrains height and 'Gale before Jade' says nothing about it. Height with the rankings ignored is open, and reading both as height is a contradiction. Whether a premise carries height information depends on the derived value of another axis, so it is coupled. However, the example only reaches 'above' under an unstated convention. ranked.js's reader adds h_Iris − h_Hale ≥ 1 for a time tie. 'Things at the same time are listed lowest first' says nothing about order when time and height are both equal, so the fair constraint is ≥ 0. Then Iris−Dune ≥ 0, which means 'above or level': can't tell (verified).

### Judge: verdict

Real, everyday coupling (sorting by two keys), but the worked example rests on a hidden strictness convention. One sentence fixes it.

### Judge: fixes (binding)

(1) State strictness, e.g. 'no two things share both a time and a height', or ask 'at least as high'. Re-run ranked.js with the ≥0 reading to confirm items stay determined. (2) It needs inequality bounds (boundsOn, Floyd–Warshall) as a new reader path beside determinedOn. (3) Keep RANK_ORDERS per stack (reading order for 2D and 3D), so it can be delivered on all six ND modes. (4) Assert that the key axis is never cut.

---

## C. Heading: facing with a head, decided by a 3×3 determinant (rung `heading`)

*Angle: frames. Judge: coupled, score 16. Designer cost: small.*

### Idea

In three axes one facing does not fix a frame; you also need the direction of the head. Both are stated relationally and fixed at statement, as the facing rung already does: "A faces B" and "A's head points toward C".

The body-frame answers are exact integer signs:
- left = sign det[h, f, v]
- above = sign((h(f·f) − f(h·f))·v)
- ahead = sign(f·v)

The determinant reads every coordinate of three vectors at once, so no single axis tells you anything.

It runs in the first three straight axes of any Space 3D–7D stack (the extension of bearingPlane), with time and the other axes as distractors. Mirror twins compose with it unchanged (MIRRORED). With the construct form, the item asks for all three body slots: ahead/behind, left/right, overhead/underfoot.

### Example

4D, prototype seed 7. Setup: "A facing is fixed when stated, and so is where the head points. Left and right are judged from both."

Premises:
- Bell is east, south, above and same time relative to Ash.
- Cole is west, same latitude, above and later relative to Ash.
- Fay is west, south, same height and same time relative to Cole.
- Eve is west, north, below and earlier relative to Cole.
- Cole is west, south, same height and same time relative to Dell.
- Cole faces Dell.
- Cole's head points toward Ash.

Claim: Bell is on Cole's left. Answer: TRUE.

Why: f = Dell−Cole = [1,1,0], h = Ash−Cole = [1,0,−1], v = Bell−Cole = [2,−1,0]. Then h×f = [1,−1,1] and its dot product with v is 3, which is positive, so Bell is on the left. Cole's head points east and down, so Cole is nearly upside down.

Planar reasoning, which is today's facing rung: Cole faces north-east and Bell lies east-south-east, so "right". That is wrong. Assuming the head points up gives the identical wrong answer, since det[(0,0,1), f, v] is exactly the planar cross product.

### Where it plugs in

utils/facing.utils.ts: bearingSpace(axes) (first three straight, non-parity axes, alongside bearingPlane :46); heading(f, h, v) returning {ahead, left, above}; describeHead ("A's head points toward C"); HEADING_NOTE.

generators/ndspace.ts:
- ndFeatures: heading = facing && ladder("heading") && bearingSpace.
- fillFacingConclusion (:1093) gets a 3D branch. It enumerates quadruples where h×f ≠ 0, det ≠ 0 and the planar answer differs from the 3D answer, and pushes the two relational premises into extraPremises.
- Required with it: move the facing branch (:807) ahead of analogy, construct and choose (:674–767), or let it take those forms (construct as three body slots; choose as the truth against the planar lure). Otherwise heading goes undelivered, as facing and mirror-twins already are. That move also fixes their delivery.

Also: ND_LADDER gets "heading", RUNG_COST gets an entry, and tests/heading.test.ts recomputes the answer from wordCoordMap.

### Solver

Pure integer arithmetic on the layout's coordinates: one determinant and two dot products. No compass and no rounding, which matches facing.utils' own rationale.

Ambiguity is excluded by refusing three cases:
- a head parallel to the facing (h×f = 0, no frame);
- a target in the forward–head plane (det = 0), so only sideways claims are asked, as mirror-twins already restricts;
- for the above/below slot, U·v = 0.

Verification: recompute from the coordinates with a different method (floating-point Gram–Schmidt), as the prototype does, using only the names the card shows.

Mutation test: swap h and f in the determinant. The test must go red.

### Lures

1. The planar reading: today's facing skill, identical to assuming the head points up. Wrong on 100% after the filter; 63% wrong even unfiltered.
2. Left and right swapped (f×h instead of h×f).
3. For above/below, not removing the forward part of the head direction, i.e. sign(h·v) instead of sign(U·v).

### Pricing

`heading` at 2.4. That is facing (1.8) plus one more relational premise and a 3D frame, and above mirror-twins (2.0), which only swaps a word at the end. Estimate for fitRungCosts.

### Overlap

- **Facing:** the 2D special case. Its skill becomes this rung's lure.
- **A (turned frames):** quantised and stated per object. Heading is continuous and derived from positions, exactly as facing's "A faces C" is.
- **Mirror twins:** the handedness flip is stated. Here it comes out of the geometry: an inverted head swaps left and right.
- **Transforms, Axis Maps and Oblique Basis:** none of them produce a frame from three positions.

### Everyday reading

Lying on your side, or hanging upside down in gymnastics or on a climbing wall: which hand is the door on? Divers and astronauts orienting themselves. Rolling a camera or a phone held sideways: "left in the picture" versus left in the room.

### Prototype

scratchpad/coupling-linear-frames/heading.js. Run with `node heading.js`; the output is saved in heading.out.

- 2,000 items. An independent floating-point solver (Gram–Schmidt basis, left = up × forward) agreed with the generator's integer determinant on 2,000/2,000.
- 96% of layouts yield an item whose planar answer is wrong, with about 158 usable (viewer, faced, head, target) quadruples per layout.
- Unconstrained, today's planar rule gives the right sideways answer on only 37% of 3D items.
- Sanity checks pass: facing east with the head up, north is on the left. Facing east with the head pointing north, "above" is on the right.

### Judge: attempt to split it per axis

Recomputed: f = [1,1,0], h = [1,0,−1], v = [2,−1,0]. h×f = [1,−1,1] and det[h,f,v] = 3, so Bell is on the left. Today's planar facing reading says right, and assuming the head points up gives the same wrong answer. The sign of a 3×3 determinant multiplies coordinates of different axes, so no per-axis total carries it. The premises still decompose; the coupling is entirely in the question, as with facing, but here it is nonlinear. Re-ran heading.js: 2000/2000 agreement with the float Gram–Schmidt solver, and the planar lure is right on 37% of unfiltered items.

### Judge: verdict

Coupled, and the natural successor to facing. But at the oblique vectors the engine produces (facing north-east with the head pointing east and down) it is a determinant puzzle more than a perspective task. It is also blocked behind a confirmed delivery bug.

### Judge: fixes (binding)

(1) Prerequisite: the facing branch in fillNdConclusion sits after analogy, checkpoint, construct and choose. Re-running the designer's shadow bundle against the engine (generators/ndspace.ts, utils/ndspace.utils.ts last changed Oct 4): 300/300 items carry a facing premise through `testimony`, and 0/300 from `analogy` onward. Facing (1.8) and mirror-twins (2.0) are charged and never delivered. Fix that first. (2) It needs three straight axes, and Direction shares ND_LADDER, so fork or gate. (3) Left/right is convention-free, because the determinant is unchanged by projecting h off f. Above/below depends on that projection, so state it in HEADING_NOTE or ask left/right only. (4) Start with an axis-aligned facing and head, and price oblique frames as a second step.

---

## Worldlines: things move, and each premise holds at its own hour

*Angle: dynamics. Judge: coupled, score 15. Designer cost: large.*

### Idea

Objects have constant velocities (blocks per hour on each spatial axis). Each relation premise is the ordinary unit-step composed-space premise with an hour stamped on it: "At 3 o'clock, Bell is east, south relative to Ash." The velocities are stated once ("Ash moves 1 east and 1 north every hour").

Hour-0 positions satisfy p_to − p_from = δ − (v_to − v_from)·τ. Every premise needs its own correction before it can be chained. With different stamps the corrections do not telescope, so intermediate movers matter.

Three forms:
1. **at** (base form): "At 8 o'clock, how does Cane stand to Elm?" I am flagging this honestly: given the stamps, each spatial axis still decomposes. It is the on-ramp, not the coupling.
2. **level** (rung): the query hour is fixed by an event on one axis ("When Cane draws level with Ash north–south…") and the answer is read on a different axis ("…is Ash east or west of Cane?"). The asked axis cannot be carried alone, because when it is read is decided by another axis.
3. **meet** (rung): "Do X and Y ever meet? If so, when?" Being level on every axis at some hour is not meeting; the hours must coincide.

Unprototyped extensions:
- Rates on non-spatial axes in 5D/6D ("Ash's tank fills 1 unit an hour"), so a quantity event times a spatial question.
- An "intercept" capstone fusing this with the Light Cone budget.

### Example

**Rule shown on the card:** "Each relation holds at the hour it names, one block per direction named. Anything that moves keeps the same pace all day, before and after the hours mentioned."

**(a) Rung level** (worldlines.js level seed 3, n=4)
- At 5 o'clock, Ash is west, south relative to Bell.
- At 4 o'clock, Cane is same longitude, north relative to Bell.
- At 5 o'clock, Dune is west, south relative to Cane.
- Ash moves 1 east and 1 north every hour.
- Bell moves 1 east every hour.
- Cane does not move.
- Dune does not move.

Q: When Cane draws level with Ash north-south, is Ash east or west of Cane?
A: **East.** Put Ash at (0,0) at hour 0, so Ash(t) = (t, t). Bell(5) = (6,6), so Bell(t) = (1+t, 6). Cane = Bell(4) + (0,1) = (5,7), fixed. Ash is level with Cane north–south at hour 7, when Ash = (7,7) is east of Cane (5,7).

Wrong answers:
- The static chain (all premises as if simultaneous) gives (−1,−2): west.
- Reading at the latest stamp, 5 o'clock, gives same longitude. That is the hour they are level east–west, which is the other axis's event.
- Hour 0 gives west.
- Per axis: east–west alone shows Ash passing Cane at 5, but only the north–south axis says whether the asked hour falls before or after that.

**(b) Rung meet** (seed 11)
- At 3 o'clock, Bell is east, south relative to Ash.
- At 2 o'clock, Ash is east, north relative to Cane.
- At 3 o'clock, Ash is west, south relative to Dune.
- Ash moves 1 south every hour.
- Bell moves 1 west and 1 south every hour.
- Cane does not move.
- Dune moves 1 east every hour.

Q: Do Bell and Cane ever meet? If so, at what hour?
A: **Never.** Bell(t) = (5−t, 2−t) and Cane stays at (0,0). They are level north–south at 2 and east–west at 5, never both at once.
Per-axis reading: "yes, at 5" (or at 2). Wrong.

**(c) Form at** (seed 4, 2D, 5 objects)
Q: At 8 o'clock, how does Cane stand relative to Elm?
A: **west, south.**
Wrong answers:
- Static chain: east, north.
- Chain, then move from the last stamp: west, north.
- Only the asked pair's motion applied: west, north.

### Where it plugs in

A new mode, 'Worldlines', not a rung on ND_LADDER. Every piece of fillNdConclusion (analogy, checkpoint via ndPrefixLayout, testimony, edits and transforms) reads static `layout.coords`; that is the same reason Pivot Transforms and Mutual Moves are separate modes built on ndspace.utils.

Files:
- **utils/worldlines.utils.ts** (pure): velocities, stamped edges, hour-0 positions, levelHour, meetHour, and the lure readings.
- **generators/worldlines.ts**: axis count from the premise count, like pivot-transforms' axisCount. It reuses axesForDimensions, ndAxisColors, renderNdPattern and renderNdDirection from ndspace.utils, and buildChain/buildBranching from linear.utils.
- **Ladder:** RUNG_LADDERS['Worldlines'] = ['level', 'meet'].
- **Answer modes:** at uses construct claims, or choice with a one-axis near miss. level uses choice. meet uses choice among 'never' plus each axis's level hour as distractors.
- **The five registries** in ROADMAP.md's "five-registry hazard": EnumQuestionType, QUESTION_TYPE_SETTING_PARAMS, TypeBasedStats, ORDERED_QUESTION_TYPES plus every TIERS_MATRIX row, and the Settings initQuestionSettings list.
- **Elsewhere:** MODE_SCALE, RUNG_COST and RUNG_MIN_PREMISES; dispatch in services/game.service.ts (~line 563); tests/modes.ts BUILD; tests/index.ts.

Premises can go through orderPremises and be scrambled. Unlike Pivot Transforms, each premise carries its own hour, so order is not information.

### Solver

**In the generator.** Integer hour-0 positions follow exactly from the tree and the corrections. Uniqueness is enforced:
- level: the event pair's relative velocity on the event axis is non-zero (one crossing, by linearity), the gap divides it (a whole hour within 1–10), and the asked sign is non-zero.
- meet: every axis's level hour exists, at 0–10. The item is "yes" only when all coincide, and yes/no is balanced before drawing.

"Motion has to bite" is checked on the shipped answer, like Pivot Transforms' naive check:
- at: the static chain and both partial repairs must be wrong.
- level: the static reading must be wrong, and the asked relation must actually change over the day.

**Independent check (tests/worldlines.test.ts).** A text-only solver as in worldlines.js, scanning hours rather than solving equations. Add the perturbation test from probes.js (changing the event axis must move the answer in a healthy fraction of items) and a test that the per-axis meet lure scores 50%.

### Lures

- **Static chain.** Stamps ignored and premises added as if simultaneous: the per-axis, no-time reading.
- **Endpoints only.** Motion applied to the asked pair but not to the intermediate movers that carried the chain.
- **Chain-then-move.** The stamps collapsed into the last one.
- **Latest stamp, or hour zero,** read as the query time.
- **Wrong-axis hour.** The hour the pair is level on the asked axis used as the event (level).
- **Per-axis meeting.** "Level east–west at 5 and north–south at 2, so they meet" (meet).

### Pricing

MODE_SCALE guess: weight about 1.9 at 2D, ceiling about 22, to be checked by placement. Each premise needs its own Δv·(T−τ) correction, which is heavier than Space 3D's 1.35 per premise. It is lighter than Pivot Transforms' 2.5, which holds two phases of the arrangement.

RUNG_COST:
- **level 1.6.** Solve one axis for the hour, then evaluate another axis at it: two chains in sequence.
- **meet 1.3.** Every axis's level hour, then compare them.

RUNG_MIN_PREMISES: level 4, meet 3. Axes are bought by premises, as in Pivot Transforms and Context Shifts. A third axis is the width lever.

### Overlap

- **Transforms, Pivot Transforms, Mutual Moves, edits.** Discrete moves in an order that is itself the clock; Pivot's premises are "never scrambled". Here change is continuous and proportional to elapsed time, applies to every mover at once, and extrapolates forwards and backwards. Each premise carries its own hour, so premises are order-free and each must be converted on its own; the endpoints-only lure fails on every item.
- **level and meet** define the query time from an axis. Nothing existing lets one axis decide when another is read.
- **meet's simultaneity** is a conjunction across all axes at one time.
- **Stream and Delay Line.** Presentation time, not world time.
- **Interval Algebra.** One temporal axis.

### Everyday reading

- **"Two trains" problems** and catching a bus.
- **Collision avoidance at sea and in air traffic.** Converging on each axis is not a collision course unless the closing times match. Mariners' "constant bearing, decreasing range" rule is exactly the meet coupling.
- **Overtaking.** Who is ahead when the other car draws level.

### Prototype

All in /tmp/claude-0/-home-user-mindbuild/5171ceae-af4f-5c1f-ba03-e9bbb2dee24a/scratchpad/coupling-time/.

- **worldlines.js** generates the at, level and meet forms in 2D and 3D. Its `solve` reads only the text. It parses velocities and stamped relations, takes BFS hour-0 positions, then finds events by scanning hours −50..50 rather than solving the generator's closed form, and asserts the event and the meeting are unique.
  - Agreement: 400/400 for every form at both 2D and 3D. No unbuildable seeds.
  - at: the static, chain-then-move and endpoints-only lures are wrong on 1.00 of items. That is by construction, analogous to axisBites; endpoints-only failing everywhere shows intermediate movers matter.
  - level: the static lure is wrong on 1.00 of items; wrong-axis hour on 0.57–0.64, hour zero on 0.54–0.59, latest stamp on 0.46–0.48.
  - meet: per-axis is wrong on 0.50 of items (chance).
- **probes.js**
  - level: changing ONLY the event axis's velocity flips the other axis's answer in 82/195 items (where the event still happens exactly once). The answer depends on a second axis.
  - meet (3D): 250/500 items are "never" although every axis is level at some hour.

### Judge: attempt to split it per axis

Re-solved in coupling-judge/time-judge.js by scanning hours. Ash(t) = (t,t), Bell(t) = (1+t, 6), Cane = (5,7). They are level north–south at hour 7, when Ash is 2 east of Cane, which matches 'east'. The static chain says west. Carrying the east axis alone gives Ash's trajectory relative to Cane but not when to read it, because the hour comes from the north axis. In probes.js, changing only the event axis's velocity flips the other axis's answer in 82/195 items. Meet: they are level east–west at 5 and north–south at 2, never both at once. As the designer says, the 'at' form decomposes per axis. Only level and meet couple, and both couple at the question.

### Judge: verdict

Coupled in its level and meet forms, and well checked. But it is a new mode with the five-registry cost and its own MODE_SCALE entry, and its coupling is question-level only. The light cone gets more coupling out of the existing engine.

### Judge: fixes (binding)

Treat 'at' as a plain on-ramp, not as coupling. Build after the light cone and reuse its time-stride machinery. Follow the full five-registry checklist (EnumQuestionType, QUESTION_TYPE_SETTING_PARAMS, TypeBasedStats, ORDERED_QUESTION_TYPES/TIERS_MATRIX, Settings) and add a tests/modes.ts BUILD entry.

---

## Twisted seam: Möbius band, quarter-twisted tube, Klein bottle

*Angle: loops. Judge: coupled, score 13. Designer cost: large.*

### Idea

A circular axis whose seam acts on the other axes, about a centre line. Crossing the seam clockwise applies g:
- **flip:** north and south exchange. This is a Möbius band.
- **quarter turn:** north becomes up, and up becomes south. This is a square tube joined with a quarter twist.
- **Klein:** g reverses a second ring.

**Premise and claim semantics.** Each premise is measured from its reference object, the way round it states. So a premise that crosses the twist means something different from one that does not. A claim's "north of" means on the band, without crossing the twist.

**Holonomy.** The connection has real holonomy: once round the ring you come back flipped, so there is no global north. Two true premises about the same pair can say "south" (one step across the twist) and "north" (the long way round). Across the twist each of two objects is south of the other, so the converse is not the negation.

Two question forms: a chart claim, and a loop-closure check, "Can all these be true at once?", which is the holonomy question proper.

**Design finding.** g acts on positions about a centre line. So the anchor must pin the column AND the centre line. The first draft pinned only the column, and the independent solver found about 40% of items undetermined. The anchor is phrased relationally: "Hart stands on the centre line, just clockwise of the twist."

**One property for both seam proposals.** The helix is the same thing with g a translation. So a single `AxisSpec.seam = { carry?, flip?, turn? }` covers Proposals 1 and 2.

### Example

Generated by twist.js (5 columns), and checked by its independent cover solver.

**Chart form (Möbius):**
- Hart stands on the centre line, just clockwise of the twist
- Elm is 2 steps anticlockwise, south, above relative to Hart
- Elm is 2 steps anticlockwise, north, above relative to Cole
- Iris is 2 steps anticlockwise, same latitude, below relative to Hart
- Cole is 1 step clockwise, north, below relative to Dune

**Claim:** Dune is south of Hart. **Answer: FALSE** — Dune is north of Hart.

Why:
- Hart is in column 1, on the line.
- Elm is 2 steps anticlockwise, which crosses the twist, so Hart's "south" lands north: Elm is in column 4, 1 north.
- Cole to Elm also crosses the twist: −(y_Cole + 1) = +1, so Cole is 2 south.
- From Dune (column 5), 1 step clockwise to Cole crosses again: −(y_Dune + 1) = −2, so Dune is 1 north.
- Adding the north clauses separately gives Elm −1, Cole −2, Dune −3, i.e. "south". That is the false claim offered.

**Loop form (holonomy):**
- Jade stands on the centre line, just anticlockwise of the twist
- Ash is 1 step clockwise, south, same height relative to Jade
- (three premises about Elm, Gale and Fern)
- Ash is 4 steps anticlockwise, north, same height relative to Jade

**Claim:** All of these can be true at once. **Answer: TRUE.** One step clockwise crosses the twist, so "south" lands north of the line. Four steps anticlockwise reach the same column without crossing it, and plain "north" agrees. Read flat, south and north of the same object contradict each other.

**Quarter-twisted tube:**
- Iris stands on the centre line, just anticlockwise of the twist
- Jade is 2 steps clockwise, south, same height relative to Iris
- (three more premises)

**Claim:** Jade is below Iris. **Answer: TRUE.** Across a quarter twist, south becomes down. The flat reading says same height.

### Where it plugs in

**New rungs**, appended to ND_LADDER in this order:
- `twist`
- `twist-turn` — 3D+, since it needs two straight axes
- `klein` — needs two loops, with north itself a ring

**utils/ndspace.utils.ts:**
- `AxisSpec.seam?: { carry?: number; flip?: number[]; turn?: [number, number] }`, allowed only on circular axes. This one property also expresses the helix.
- `NdLayout` keeps `cover` coordinates. `coords` becomes the chart projection: mod m on the ring, g^laps on the axes the seam acts on. This replaces "reduce once at the end" in `buildNdLayout`, `coordsFromEdges` and `applyNdTransforms`.
- `NdEdge.deltas` stay cover displacements. `renderNdPremise` converts into the reference's frame (g^laps_ref) instead of writing `sign * edge.deltas[i]`. Across the seam the converse is −g^L(d), not −d; this is the writer the tests must hit.
- `explainNdAxis` applies g to the running total at each crossing.
- `bearingPlane` (utils/facing.utils.ts) and the rotation planes in `drawNdTransforms` exclude axes the seam acts on.
- The g step can reuse Axis Maps' signed-permutation code.

**generators/ndspace.ts:**
- `ndFeatures`: `twist` is live only with no edits, transforms, facing, analogy, indeterminate, speakers or testimony.
- `createNdSpace` forces one loop (east, horizontal or temporal) and needs one straight axis to act on. Direction (2D) is the Möbius band itself.
- The anchor premise goes in via `extraPremises`.
- New `buildTwistLoop` adds the closing premise and the "All of these can be true at once" claim. `buildNdConclusion` on chart coordinates works unchanged.

**Elsewhere:**
- notes.ts: TWIST_NOTE.
- `RUNG_COST`: twist 1.8, twist-turn 0.9, klein 0.8. `RUNG_MIN_PREMISES.twist` 4.
- tests/twist.test.ts using the cover solver, with a mutation that renders the converse as −d.

### Solver

**Generation.** Positions are built in the chart from the anchor, which sits on the centre line, so the layout is unique.

- **Chart form:** only (pair, axis) combinations where the flat per-axis reading gives a different relation are offered. The false claim is always the flat reading.
- **Loop form:**
  - The closing premise winds once round the ring: its step is k_c = Δ ± m.
  - It is kept only if the true clause differs from what the flat reading expects, and both are unit steps.
  - The false variant states the flat expectation.

**Verification.** The independent solver (described under the prototype) unrolls the ring, converts each premise by g^−laps of its reference, adds flat, and projects. It then checks that every premise closes and reads the claim off the chart. It shares no stepping code with the generator, and the generator also checks every item by rendering and parsing it back.

### Lures

- **Flat:** add the north clauses up separately. Wrong on 100% of items.
- **"The twist flips the step that crosses it"**, rather than the position carried across. Wrong on about 30%.
- **Converse as negation:** "Elm is south of Hart, so Hart is north of Elm". Across the twist each is south of the other.
- **Loop form, denying holonomy:** "south and north of the same thing can't both hold".
- **Quarter turn:** turning the wrong way, north to down.

### Pricing

- `twist` 1.8, the same as facing. A frame change must be located before it can be applied, and the layout is held twice: as stated, and as charted.
- `twist-turn` +0.9. The monodromy has order 4, so two crossings no longer cancel.
- `klein` +0.8. The acted axis is itself a ring, so its displacement claims reverse too.
- `RUNG_MIN_PREMISES` 4.

These are guesses until rungfit measures them.

### Overlap

- **Transforms and Pivot Transforms** rotate the whole space once, at a stated moment. Here the frame changes with where a relation is walked, and no global frame exists.
- **Axis Maps** applies one signed permutation to everything. g is the same kind of object, but it is applied g^laps, per crossing.
- **Facing and mirror-twins** change one stated viewer's frame, at the conclusion only.
- **Relation Algebra's cube routes** get holonomy from curvature at the corners, for poses. This is holonomy from topology on a flat band, inside the composed space. It fulfils research/relation-algebra.md §5's "Möbius and Klein-bottle boards" rung for this app.

### Everyday reading

Rare in daily life, and that should be said plainly. The nearest experiences are walking over a pole, after which east and west swap, and a twisted belt or Möbius ribbon. The value is the frame-tracking skill itself, and the fact that it cannot be done one axis at a time.

### Prototype

Scripts are in /tmp/claude-0/-home-user-mindbuild/5171ceae-af4f-5c1f-ba03-e9bbb2dee24a/scratchpad/coupling-loops/.

- **twist.js** covers flip and quarter turn, each with the chart and loop forms, at 5 objects and 5 columns. Each of the four builds 2000/2000.
- **Independent solver.** It lifts to the universal cover (ring unrolled), converts each premise by g^−laps of its reference, adds flat there, and projects only at the end. That is a different algorithm from the generator's stepping in the chart. It agrees on 2000/2000 in all four variants.
- **Lures.** The flat per-axis reader is wrong 2000/2000 (by construction). The reader who flips only the crossing step is wrong on 584, 610, 607 and 582 items.
- **Writer against reader.** Every item is rendered, parsed back, and checked to place each object where it was built.
- **mutate.js.** A cover solver that forgets to convert a premise out of its reference's frame disagrees on 198/500.

### Judge: attempt to split it per axis

Re-solved the Möbius chart item in the cover (coupling-judge/helix-twist-kinds-judge.js): Hart (col 1, 0), Elm (4, +1), Cole (1, −2), Dune (5, +1). Dune is north of Hart, so the claim 'south' is FALSE, as stated. The flat per-axis north sum puts Dune at −3, i.e. south. A premise's north reading depends on how many times its reference's ring coordinate has wrapped and on absolute north, because the flip is about the centre line. So north cannot be carried without the ring axis. The holonomy is real. Re-ran twist.js: 2000/2000 agreement in all four variants. Fairness check (coupling-judge/twist-route.js): on 2000 flip chart items, the verdict differs between the two routes round the ring on 57%. On 540 (27%), the asked pair's shorter route crosses the twist and gives the opposite answer to the chart. The worked example is one of these: Dune (col 5) and Hart (col 1) are one step apart across the twist, and seen from Hart that way, Dune is south.

### Judge: verdict

The most novel proposal and the only one with true holonomy. But its chart form depends on a route convention a player has no geometric reason to prefer, and it rewrites the coordinate model across buildNdLayout, coordsFromEdges, applyNdTransforms and renderNdPremise. Build it last, and only in the loop form.

### Judge: fixes (binding)

(1) Drop the chart form, or make every claim name its route ('going anticlockwise from Hart, without passing the twist, ...'). The loop-closure form ('can all of these be true at once') needs no convention. (2) It forces a loop independent of the circular dial, so charge the dial or exclude it. (3) Store cover coordinates and write the writer/reader test the designer names: across the seam the converse is −g^L(d). (4) Leave twist-turn and klein until play has been measured.

---

## A. Turned frames: per-object orientation in B_n (rungs `frames`, `relative-frames`)

*Angle: frames. Judge: **not coupled — do not build**, score 0. Designer cost: medium.*

### Idea

The n-dimensional version of facing. Some objects are TURNED, and each turned object carries a signed permutation of the straight axes (an element of B_n). A premise spoken "by Ash's reckoning" uses the ordinary words along Ash's own axes. If Ash is turned a quarter from east toward later, Ash's "east" is our later and Ash's "later" is our west.

The question is asked in a turned viewer's reckoning, so solving it takes three steps: convert each reckoned premise with the speaker's frame, accumulate in our axes, then express the result through the inverse of the viewer's frame.

The second rung states frames relative to another object's own axes: "Bell is turned as Ash is, then a further quarter from its own north toward its own above". That is the intrinsic composition g_Ash∘R. It does not commute with the extrinsic reading R∘g_Ash (a quarter turn about our axes) whenever the two planes share an axis.

A handedness extension is free from the same code: a mirrored frame has det −1, so mirror twins generalise to n dimensions.

### Example

4D (east-west, north-south, up-down, time). Prototype seed 5. Setup line: "Some objects are turned. A turned object reckons with the usual words, but along its own axes."

Premises:
1. Eve is turned a quarter from above toward west.
2. Bell is turned a quarter from north toward later.
3. Dell is east, north, above and earlier relative to Ash.
4. By Bell's reckoning, Cole is same longitude, south, above and earlier relative to Bell.
5. Fay is same longitude, south, below and earlier relative to Ash.
6. By Bell's reckoning, Ash is east, north, above and earlier relative to Bell.
7. By Eve's reckoning, Cole is east, south, above and earlier relative to Eve.

Question (construct, or a wide claim): By Eve's reckoning, how does Dell stand to Eve?
Answer: east, same latitude, below and same time.

Why:
- Bell's north is our later and Bell's later is our south. So Ash−Bell = [1,1,1,1] and Cole−Bell = [0,1,1,−1] in our axes.
- Eve's east is our above and Eve's above is our west. So Cole−Eve = [−1,−1,1,−1].
- Dell−Eve = [1,0,2,0] in our axes, which is [2,0,−1,0] in Eve's axes.

The per-axis reader adds each stated column (east +3, north +2, up +2, time −2) and answers "east, north, above and earlier". That is wrong on three of four axes. Other wrong answers:
- Premises converted but the answer left in our frame: "east, same latitude, above and same time".
- The frame applied where its inverse belongs (g for g⁻¹): "same longitude, same latitude, above and earlier".

Relative rung (seed 5):
- Cole is turned a quarter from north toward later.
- Eve is turned as Cole is, then a further quarter from its own later toward its own west.
- By Cole's reckoning, Ash is east, same latitude, above and earlier relative to Cole.
- By Cole's reckoning, Eve is same longitude, same latitude, above and later relative to Cole.
- Bell is west, same latitude, below and earlier relative to Ash.
- Two distractor premises.

Question: By Eve's reckoning, how does Bell stand to Eve?
Answer: west, south, below and same time.
Wrong answers: the literal reading gives "same longitude, same latitude, below and earlier". Turning Eve about our axes instead of its own gives "west, same latitude, below and earlier".

### Where it plugs in

Rungs: append "frames" and "relative-frames" to ND_LADDER (utils/progression.utils.ts:272), after "mirror-twins". The ladder is append-only. RUNG_COST entries go in utils/ability.utils.ts.

Optional dial "turned" (turned objects beyond two). dialsFor finds dials only through `retired-<was>` entries in the ladder, so it would also need a `retired-turned-1` tombstone appended. The simpler option is to tie the count to the object count.

New utils/frames.utils.ts:
- Frame {p, s}, quarterTurn, compose, inverse, applyFrame, det.
- describeTurn / describeRelativeTurn, FRAMES_NOTE.
- Straight, non-parity axes only, the same restriction rotationAxes already applies.

utils/ndspace.utils.ts:
- Export coordsFromEdges (:406).
- Give renderNdPremise (:845) a `reckoner: {name, frame}` option. It prefixes "By X's reckoning," and prints applyFrame(inverse(frame), sign·deltas). The existing `flip` puts the turned endpoint in the reference slot.
- Add viewLayout(layout, g), which maps every coordinate through g.

generators/ndspace.ts:
- ndFeatures (~395): add `frames` and `relativeFrames`, exclusive with facing, speakers, testimony, edits, transforms and indeterminate. An item that wants frames sets those aside for itself, as wantCheckpoint does (~95). Without that, the rung at the end of the ladder is unreachable.
- createNdSpace: draw the frames after buildNdLayout. Build `literal` (the stated deltas walked as if in our axes) and `viewed` (viewLayout(final, inverse(g_viewer))). Call fillNdConclusion(ctx, question, literal, viewed, …).
- The existing mutation path (`mutated`, :548) then enforces axisBites, pairBites and analogyBites against the literal reading, and suppresses explainNdAxis.
- Prefix the conclusion, series texts, choices and construct prompt with "By V's reckoning,".
- ndSetup (:1008) adds FRAMES_NOTE and describeNdAxes.

Because frames change how the layout is read rather than adding a conclusion branch, they compose with analogy, construct, choose and multi. That avoids the delivery bug facing has.

Also: a Customise flag in settings-override LinearFeatureFlags, a label in mode-modifiers.component.ts, tests/frames.test.ts imported in tests/index.ts, and a /reckoning/ mark in rung-delivery.

### Solver

Computed in integers.
- Positions come from a premise tree, so there is one layout.
- Every reckoner's frame is stated: absolutely, or relative to an object whose frame is stated. The relative frames therefore form a forest rooted in absolute frames.
- Signed permutations are invertible, so each reckoned premise pins exactly one relation in our axes.
- The viewer's answer is g_v⁻¹(coords[y]−coords[x]).

Verification (tests/frames.test.ts, mirroring the prototype): parse the rendered card only (frame lines, "By X's reckoning" lines, plain lines). Rebuild the frames as integer matrices with code independent of frames.utils. Walk the tree, apply the transpose of the viewer's matrix, and compare with question.isValid or the construct slots.

Mutation test: render with g instead of g⁻¹. The test must go red, naming the inverse.

No under-specification is allowed (indeterminate is excluded). The bites check stops an item being answerable by ignoring the frames.

### Lures

1. Literal: every stated column carried as written. This is the habit the mode exists to break, and it is wrong on 100% of items by construction.
2. Our frame: premises converted correctly but the answer given in our axes. Wrong on 100%.
3. Inverse confusion: "Ash's east is our later" read as "our east is Ash's later". Wrong on 94–98%.
4. Viewer only: premise frames ignored, only the final conversion done. Wrong on 76–93%.
5. Relative rung: turned about our axes instead of its own (R∘g for g∘R). Wrong on 100%.

Caveat: because the literal answer is never right, a choice whose decoy is always the literal answer can be beaten by computing the literal answer and picking the other option. Most false claims should therefore be near misses (the existing buildNdWideConclusion false path), with the lure used only some of the time. The construct form has no such leak.

### Pricing

`frames` at 2.2. That is above facing (1.8): facing is one planar perspective applied once at the end. Here every reckoned premise is a quarter-turn conversion, comparable to a rotate transform (the transforms dial starts at 1.5), and the answer goes back through an inverse. It sits level with `speakers` (2.2).

`relative-frames` at +1.2: composition order is real extra work, priced like Axis Maps' compose-2 (1.1).

Optional `turned` dial at [0.8, 0.6] per extra turned object.

All are estimates for fitRungCosts to correct. MODE_SCALE weights are unchanged, because a placement clears rungs.

### Overlap

- **Facing:** planar, one frame derived from a target and used only to read the answer. Here frames span all straight axes, and they decide how the premises themselves are read.
- **Transforms 'rotate':** moves one object, once. Here nothing moves, and every relation stays true in its speaker's axes.
- **Axis Maps:** one global signed permutation induced from examples. Here several frames are stated per object inside an integration chain, and the answer goes through an inverse into a third frame.
- **Context Shifts:** signed permutations applied to a relation value in sequence. Here frames belong to objects, and the same word means a different axis depending on who speaks.
- **Oblique Basis:** fixed vectors from a codex. Same contrast: there a word always means the same thing.
- **Relation Algebra's poses (ℤ²⋊D₄):** the 2D cousin of the relative rung. This is the n-dimensional version inside the composed spaces, with all their answer forms.

### Everyday reading

"My left or yours?" when facing someone. Stage left versus house left. Reading a map held upside down. A pilot's or astronaut's body axes. Robot-arm joint frames, where each link's frame is stated relative to the previous one: the intrinsic versus extrinsic Euler-angle confusion is exactly the relative-frames lure.

### Prototype

scratchpad/coupling-linear-frames/frames.js (uses common.js). Run with `node frames.js`; the output is saved in frames.out.

- 15,000 items over five configurations (4D and 5D, 2 or 3 turned objects, absolute or relative frames).
- An independent reader parses the rendered text and rebuilds every frame as an explicit integer matrix, using the transpose as the inverse. It agreed with the generator on 15,000/15,000 items.
- Share of draws kept: 82–84% for absolute frames, 40–60% for relative frames.
- The literal reading and the answer-left-in-our-frame reading are wrong on 100% of items (both enforced).
- g in place of g⁻¹ is wrong on 94–98%. The extrinsic order is wrong on 100% (enforced).
- Checked directly: quarter turns in disjoint planes commute (XT with YZ), and turns sharing an axis do not (XT with TY). The generator rejects relative frames whose two readings coincide.

### Judge: attempt to split it per axis

Solved one world axis at a time in coupling-judge/frames-judge.js. For each axis the solver keeps one number per object. For each premise it only looks up which stated column, with which sign, the speaker's frame sends to that axis: Bell's north to our later and Bell's later to our south; Eve's east to our up and Eve's above to our west. Result: Dell−Eve = [1,0,2,0] in our axes, which is [2,0,−1,0] in Eve's, i.e. 'east, same latitude, below, same time', the designer's answer. No axis ever reads another axis's value. The frame is a stated lookup per object, and the relative rung only composes two permutations into a bigger lookup, once. The designer's own 'existing' section states the refutation: a signed permutation 'sends each source axis to exactly one target axis... once a reader relabels the columns, the axes are independent again.' This proposal is such a permutation, applied per speaker.

### Judge: verdict

Not coupling. It is relabeling per speaker: Axis Maps, Oblique Basis and Context Shifts applied per object. The 100% literal-lure rate measures how hard relabeling is, not integration, so pricing it as coupling would overstate it. Its real contributions are the confirmed delivery bug and the integration pattern: passing the literal reading as `initial` through the mutated/pairBites path, which every coupled proposal here should copy.

### Judge: fixes (binding)

Do not build it under the coupling banner. If it is wanted as a perspective rung, price it as an n-dimensional facing with stated frames. To make it coupled, choose the frame from a carried axis value instead of a stated turn, which is what Kind Frames does.

---

## Helix: a loop whose wrap carries into a second axis (watches into days)

*Angle: loops. Judge: **not coupled — do not build**, score 0. Designer cost: medium.*

### Idea

Time becomes a ring of m watches (dawn, noon, dusk, night) whose wrap carries into a derived straight axis. Underneath is one integer t: watch = t mod m and day = floor(t / m).

- Every premise states its watch step. Only some premises say which day.
- A stated day clause is not a free fact about days. It constrains the absolute phase: "1 watch later, on the next day" can only hold if the reference object is at night. So relative premises can locate the seam (midnight).
- The phase then decides where each unstated premise carries over into the next day.

Two question forms:
- **day:** a day comparison across an unstated carry.
- **watch:** the absolute watch of an object, derived from purely relative premises.

On stacks with no time axis, the spatial version uses east as a ring of bays on a spiral ramp, carrying into levels.

**Control.** With every day clause stated, adding the day clauses up separately is always right (3000/3000), so that case is not coupling. The generator therefore always withholds day clauses, or asks for the absolute watch.

### Example

Generated by helix.js and checked by its text-only solver.

**Setup:** "Each day runs dawn, noon, dusk, night; the watch after night is the next day's dawn. Where a premise does not say which day, work it out."

**Premises:**
1. Ash is west, north, 1 watch earlier relative to Hart
2. Gale is west, south, 1 watch later, on the same day relative to Bell
3. Ash is same longitude, north, 1 watch later, on the same day relative to Iris
4. Bell is east, south, 1 watch later relative to Hart

**Claim:** Iris is on the same day as Bell. **Answer: FALSE.**

Why:
- Premise 3 is +1 watch on the same day, so Iris is not at night.
- Iris→Ash→Hart→Bell totals +3 watches.
- Premise 2 puts Gale one watch after Bell on the same day, so Bell is not at night, so Iris is not at dawn.
- So Iris is at noon or dusk, and Bell, 3 watches on, lands at dawn or noon of the NEXT day. Both survivors agree.

Why per-axis reasoning fails:
- The only day clause on the path says "same day", so adding the clauses up gives "same day". That is the claim offered.
- The phase-free reading ("3 watches is less than a day") also says same day.

**Watch form:**
1. Dune is same longitude, south, 2 watches later relative to Elm
2. Elm is west, south, 1 watch later relative to Gale
3. Jade is east, same latitude, 2 watches later, on the next day relative to Gale
4. Bell is same longitude, same latitude, 1 watch later, on the next day relative to Elm

**Claim:** Dune is at dusk. **Answer: FALSE.** Bell is one watch after Elm yet on the next day, so Elm is at night, and Dune (Elm + 2) is at noon. A per-axis reader has only relative watch steps and answers "can't tell".

### Where it plugs in

**New rung `helix`**, appended to ND_LADDER after "mirror-twins" in utils/progression.utils.ts.

- **utils/linear.utils.ts:**
  - `LinearScale.cyclic.names?: string[]` for absolute positions (dawn…night, or bays).
  - New scales `day` ("on the next day / on the day before / on the same day"; relations "is on a later day than" etc.) and `level` for the ramp.
- **utils/ndspace.utils.ts:**
  - `AxisSpec.carryInto?: number` on the ring and `carriedFrom?: number` on the derived axis.
  - `buildNdLayout` draws a phase p0, adds up the ring unwrapped, sets the derived coordinate to floor((p0 + T) / m), and recomputes that axis's edge deltas. The "wrap at the end" shortcut no longer holds for the pair.
  - Reuse `NdEdge.stated` to withhold day clauses; `renderNdPremise` already filters on it.
  - New: `helixPhases`, `helixDetermined`, `withholdDayClauses(layout, pair)`, `buildHelixWatchClaim`.
  - `buildNdWideConclusion` and `buildNdConclusionSet` must use `helixDetermined` instead of `determinedOn` for the derived axis.
  - `explainNdAxis`: derive the phase first, then the carries.
  - Render watch and day as one clause ("1 watch later, on the next day") in the temporal colour.
- **generators/ndspace.ts:**
  - `ndFeatures`: `helix = ladder("helix") && edits===0 && transforms===0 && !indeterminate && !compact && !speakers && !testimony`. All of those also use `stated` or rewrite the premise set.
  - `createNdSpace`: make temporal the ring (east or horizontal if there is no temporal), force it circular with m=4, insert the derived axis, and set `canCheckpoint` false (a prefix need not pin the phase).
- **generators/notes.ts:** HELIX_NOTE.
- **utils/ability.utils.ts:** `RUNG_COST.helix` 1.4 and `RUNG_MIN_PREMISES.helix` 4.
- **components/mode-modifiers:** a label for the rung.
- **tests:** tests/helix.test.ts (imported in tests/index.ts) with a text solver run over `createNdSpace` output, and a mutation test that drops the carry.

### Solver

**Generation.** The generator works in the cover coordinate t. It enumerates every subset of day clauses (at most 2^(premises)) against all m phases, and keeps a (subset, pair) only when:
1. The claimed relation is the same in every phase consistent with the stated clauses, so it is determined.
2. It is NOT the same across all m phases, so the stated clauses are load-bearing.
3. Adding up the stated day clauses gives a different relation, so the coupling bites.

The watch form also needs exactly one surviving phase, and the object asked about must be touched by no stated clause. That way the phase has to be carried to it along watch steps.

**Verification.** An independent solver reads only the rendered text:
- It propagates relative watch offsets along the premises.
- It tries the m phases and keeps those consistent with every stated day clause.
- It requires one verdict across all survivors. Anything else returns "undetermined", which counts as a generator bug.

The search costs at most 2^7 × 4 per draw at the premise cap.

### Lures

- **Adding the day clauses up separately**, counting an unstated clause as "same day". This is offered as the false claim and is wrong on 100% of items by construction.
- **The phase-free reading**: "3 watches is less than a day, so same day" or "5 watches is a day and one". Wrong on about 70%.
- **Watch form:** "can't tell", because every watch step is relative. The stated day clauses are an anchor nobody notices.
- **Earlier steps across dawn**: forgetting that they carry into the day before.

### Pricing

`RUNG_COST.helix` 1.4.

- It sits just above indeterminate (1.3). It starts from the same move — the premises do not state it — but the answer must then be derived through a second quantity (phase, then carry) rather than recognised as missing.
- It sits below facing (1.8), which re-expresses the whole layout from a derived bearing.
- `RUNG_MIN_PREMISES` is 4: it needs one stated clause, one unstated carry, and a pair at distance 2 or more.

These are guesses until rungfit measures them, like the other entries in RUNG_COST.

### Overlap

- **Circular axes today** wrap onto themselves. Here the wrap writes into a second axis.
- **Indeterminate** treats a withheld clause as disconnected (`determinedOn`). Here the withheld day clause is derivable, through the other axis.
- **Transforms and Pivot Transforms** are operations at a stated moment. Here nothing is an operation; the dependence is on position.
- **Oblique Basis and Axis Maps** decode the same way everywhere.
- **Shape and Rotation** states absolute ring positions. Here absolute position is inferred from relative premises.

### Everyday reading

- An overnight flight or shift rota: leave at 22:00, travel 5 hours, land tomorrow.
- Calendar carries: week into month.
- Spiral car parks and spiral staircases, where each full turn is a level.
- Clock arithmetic across midnight.

### Prototype

Scripts are in /tmp/claude-0/-home-user-mindbuild/5171ceae-af4f-5c1f-ba03-e9bbb2dee24a/scratchpad/coupling-loops/.

- **helix.js.** At 5 objects, 3000/3000 day items and 3000/3000 watch items were built. The text-only solver agrees on every one. On average 1.65 of 4 day clauses are stated. The phase is pinned to a single value in 1387/3000 day items; in the rest the answer is the same across the 2–3 phases that survive.
- **helix-lures.js.** Adding stated day clauses (unstated = same day) is wrong on 3000/3000, by construction. The phase-free "total ÷ 4" reading is wrong on 2104/3000. The control, with every clause stated, is right on 3000/3000.
- **helix-unit.js.** With the engine's existing ±1 steps, 4, 5 and 6 objects each build 2000/2000, and the solver agrees on all.
- **mutate.js.** A solver that ignores day clauses disagrees on 500/500 watch items.

### Judge: attempt to split it per axis

Solved the worked day item in coupling-judge/helix-twist-kinds-judge.js with time as one unrolled integer t: watch = t mod 4 and day = floor(t/4) are two readings of the same coordinate. Take relative t offsets from the watch steps, try the four phases for Iris, keep those consistent with the stated day clauses (Iris and Bell are not at night), and every survivor says different days, so FALSE, the designer's answer. East and north never enter the computation. The item splits into east, north and one time problem. The derived 'day' axis has no freedom of its own, so there is no second dimension to couple to: this is carry arithmetic, hours into days. The designer's own control agrees: with every day clause stated, adding the day column is right 3000/3000. The difficulty comes from withholding information on one axis.

### Judge: verdict

Not cross-dimensional coupling. It is a good phase-inference puzzle on a looped time axis, but it would be priced and reported as coupling while exercising a single axis.

### Judge: fixes (binding)

If built, build it as a looped-time rung in the circular family and price it against indeterminate, not as coupling. Note that it inserts a derived axis, so a Space 4D item would show five columns. Keep the shared AxisSpec.seam idea for the twist.

---

## Panel recommendation (verbatim)

Fix three things before any coupling rung. All three were confirmed independently of the proposals.
(a) Facing and mirror-twins are charged but never delivered. The facing branch sits after analogy, checkpoint, construct and choose in fillNdConclusion. Re-running the designer's shadow bundle (the engine files have not changed since Oct 4): 300/300 items carry a facing premise through `testimony`, and 0/300 from `analogy` onward.
(b) ONE_STEP_NOTE is shown only when constructDistance is on (ndSetup). Bridges, Walking Totals and the clocks shear all depend on magnitudes, so it must be shown always.
(c) Decide how a 4D–7D ladder forks: a frozen literal copy, never `[...ND_LADDER, ...]`.

Every coupled rung should copy Turned Frames' integration pattern: pass the literal reading as `initial` so that pairBites and analogyBites force every conclusion form to need the coupling. A new conclusion branch competing after analogy is never reached.

Build order:
1. Bridges. Premise-level coupling, deliverable in all six composed spaces (any two straight axes), and exactly decidable by Gaussian elimination. It lays down the NdCoupling/closeAxes layer and the text reader that 2, 5 and 6 reuse.
2. Clocks shear (frames B). Small cost, and the only coupling that is a linear map but not a permutation. Its per-premise marking stops it telescoping. It needs a spatial ramp preset or the ladder fork, and it absorbs the dynamics Local Clocks as its date-line variant.
3. Light Cone, as cone, then signals, then reach. Highest training value, with every single shortcut at chance. It goes on the frozen 4D–7D fork, with its branch placed ahead of analogy.
4. Kind Frames. Premise-level, anchor-free. Restrict it to stacks that already have a parity axis, or price the axis it adds.
5. Walking Totals. Form A and the nearest question on Bridges' solver first, then Form B on the select plumbing. Settle the shared budget skill with the Light Cone.
6. Ranked, after stating that no two things share both a time and a height.
7. Heading, after fix (a), for Space 3D and up only.
8. Worldlines (a new mode) and Twisted Seam (a coordinate-model rewrite; loop form only) last.

Do not build Turned Frames or Helix as coupling. One is relabeling per speaker; the other is one time axis read in two units. Both split into per-axis problems, and pricing them as coupling would overstate their difficulty.

Judge scripts are in `prototypes/judge/`: frames-judge.js, helix-twist-kinds-judge.js, twist-route.js, metric-judge.js and time-judge.js. Nothing under /home/user/mindbuild was modified.
