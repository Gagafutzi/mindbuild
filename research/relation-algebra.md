# Relations beyond the seven groups — research notes for Relation Algebra

Notes towards extending `apps/relations`, the Relation Algebra trainer.
Concepts about relations from mathematics, physics, music theory,
anthropology, biology, computer science and cognitive science, with one
rule for what gets in.

**The floor is Syllogimous's hardest modes.** Every proposal here has to
be at least as hard as the top band of that app, in the same sense that
those modes are hard, and each says which mode it is measured against and
what it adds. A new group for the same old task does not clear that bar:
Relation Algebra at level 30 in a new material is exactly as hard as in an
old one. So new materials appear only at the end, as
[substrates](#substrates-materials-the-proposals-run-on) the proposals run
on, with a list of what was [considered and left out](#considered-and-left-below-the-floor).

Relation Algebra's source lives upstream in Chimera Hub, so anything here
that is built belongs there first (see the README). Claims worked out for
these notes, rather than quoted from a source, are checked by brute force:

```bash
node research/relation-algebra-checks.js     # 29 claims, about five seconds
```

## The floor

Syllogimous prices every mode on one scale (`MODE_SCALE` in
`utils/calibration.utils.ts`: the weight is how many plain linear premises
one premise is worth; the ceiling is the highest level at which the mode
still tells you anything) and opens modes by row (`TIERS_MATRIX` in
`constants/game.constants.ts`). Its top band, by ceiling and weight:

| Mode | Weight | Ceiling | Opens at row | What has to be held | The general problem |
| --- | --- | --- | --- | --- | --- |
| Common Subsystem | 2.8 | 28 | 14 | the largest structure two systems share, with nothing pointing at it | maximum common induced subgraph: NP-hard |
| Cross Analogy | 2.5 | 28 | 15 | a dictionary between two vocabularies, then an analogy across it | a search over signed permutations of the axes |
| Context Shifts | 2.7 | 27 | 14 | a relation as a value, carried through operations that do not commute | composition in the hyperoctahedral group, with projections |
| Partial Isomorphism | 2.6 | 27 | 12 | two systems alike but for one entity each | isomorphism after a deletion on each side |
| Second-Order | 2.6 | 27 | 13 | an operation found from one example, then applied | induction over a catalogue |
| Structure Match | 3.0 | 26 | 9 | the same structure renamed, against a decoy one arrow off | graph isomorphism (quasi-polynomial, Babai 2016) |
| Concave Regions | 2.8 | 26 | 13 | which of 32 region relations survive, each by a proof | qualitative spatial calculi: NP-complete in general (Renz & Nebel 1999, for RCC8) |
| Motif Search | 2.5 | 26 | 10 | a pattern hidden in a larger system | induced subgraph isomorphism: NP-complete |
| Pivot Transforms | 2.5 | 26 | 12 | a model updated mid-read, so early premises stop holding | non-monotonic: nothing read earlier can be kept as is |
| Betweenness | 2.3 | 26 | 15 | who must lie between, over every arrangement and its mirror | betweenness: NP-complete (Opatrny 1979) |
| Interval Algebra | 2.4 | 26 | 8 | every Allen relation still possible | Allen satisfiability: NP-complete (Vilain & Kautz 1986) |

Five properties make these hard, and together they define the floor:

1. **Held whole.** Nothing follows from one premise and nothing accumulates
   along a chain (Syllogimous's own words for its isomorphism family). The
   whole item has to be held at once.
2. **No efficient general method.** In general form most are NP-hard. At
   card size the only way through is search.
3. **Answers that are sets or constructions**, with guess floors as low as
   one subset in 2ⁿ, not a verdict out of three.
4. **Two levels at once.** Induce a law, a dictionary or an operation, then
   use it.
5. **Exactness checked, not arranged.** Every alternative is tried, so "the
   only" and "the largest" are true.

A proposal clears the floor when it has properties 1 and 2 and at least one
of 3 and 4, and builds 5 into its generator.

## Where Relation Algebra stands against it

At level 30 Relation Algebra gives six objects, nesting three deep on each
side, three-step moves and four either/or premises with two settling loops,
in any of seven materials, the hardest being poses (`ℤ² ⋊ D₄`). It has property 2: either/or premises put the honest
algorithm at 2ᵏ readings. It also has a strength none of the floor modes
have: **integration through nesting in a non-abelian group**. Syllogimous's
arrows are stated; Relation Algebra's relations have to be computed.

It lacks property 1 (the path between the asked pair is still everything
that matters), property 3 (answers are `=`, `≠`, `?`) and property 4. So
most proposals below **stack**: Relation Algebra's integration underneath,
the floor's whole-structure search on top. That combination exists in
neither app.

## What the engine already is

The engine's structure has a name in at least six fields. The names are
worth knowing because several proposals below come from reading the engine
in one of these languages.

| Field | Its name for the engine | What the parts are called there |
| --- | --- | --- |
| Algebra | a **torsor** | objects are points with no origin; only `rel(X, Y) = X·Y⁻¹` means anything |
| Music theory | a **Generalized Interval System** (Lewin 1987) | a group of intervals with `int(r, s)·int(s, t) = int(r, t)`; all seven materials are one |
| Graph theory | a **gain graph** | premises are group-labelled edges; *Possible?* asks whether the graph is **balanced** (Harary 1953; Zaslavsky 1989) |
| Topology | a **1-cochain** | an impossible description is a non-zero class in H¹ of the premise graph, one dimension per independent loop |
| Physics | a **lattice gauge field** | "every loop closes" is zero curvature; a pose's own frame is a choice of gauge |
| Computer science | a **unique game** | `x_u − x_v = c (mod q)`; with every premise true, propagation solves it (`solve()`); with some false, finding the best assignment is Khot's Unique Games problem |

Two consequences shape the proposals:

- **Exact premises between pairs are easy; either/or premises are not.** A
  premise `X = g·Y` is closed under the Mal'tsev operation `x·y⁻¹·z`, which
  makes it tractable (Bulatov & Dalmau 2006). A union of two such premises
  generally is not.
- **Premises over three or more objects split the materials.** Over abelian
  groups they are linear algebra. Over non-abelian groups, solving systems
  of equations is NP-complete (Goldmann & Russell 2002). Proposals with
  many-object premises (7) stay abelian for that reason.

---

## The proposals

Each says what it is and the theory behind it; **against the floor**, which
mode it is measured against and why it clears it; how it fits the engine;
and the mistakes it invites (lures). *Checked* marks a claim settled by
the check script.

### 1. The fewest false premises — frustration

An impossible description with several loops and more than one wrong
premise. **Select the smallest set of premises whose removal makes it
possible.**

- **Theory.** In a gain graph the smallest impossible sets are exactly the
  loops that do not close. Reiter's theory of diagnosis (1987) says a
  *diagnosis* is a smallest set that touches every such conflict: a minimum
  hitting set. For signed premises (with/against) the size of that set is
  Harary's **frustration index**. Computing it is NP-hard, since for an
  all-"against" network it is the number of links minus the maximum cut.
  Over ℤ_q it is the Unique Games problem.
- **When one false premise can be found at all:** exactly when its two
  objects are still joined by two routes sharing no premise once it is
  removed. *Checked on every connected arrangement of four and five
  objects: 4,284 cases.* So a generator knows in advance which errors the
  description can expose.
- **Against the floor.** Minimal Premises (2.1, ceiling 24) asks for the
  smallest *settling* set, a spanning path, which is polynomial.
  Contradiction (2.2, 25) finds one clash. This asks for the smallest
  *correcting* set, which is NP-hard in general, and each loop's verdict
  first has to be integrated through nested, non-abelian premises. It
  clears 1, 2, 3 and 5.
- **In the engine.** `possibleTrial` already alters a premise and records
  which (`altered`). Alter one to three. Keep the item only when exactly one
  smallest correcting set exists, checked over every subset up to that size
  (twelve premises, three altered: 298 subsets). The subset check cannot be
  `consistent()` as it stands: that checks only premises linked to the
  first name it is given, which is always everything in today's tasks, but
  striking premises can split the graph and hide a broken loop in the other
  part. It needs a check over every component. A second question can
  follow: what should each have said? Ask it only where the condition above
  holds.
- **Where the trap is.** Measured on generated items with two false
  premises, counting *every* broken loop and striking the premise on most of
  them never led to a true premise outright: 911 of 911 items with five
  objects, 555 of 555 with six, though 69 of the six-object items had a tie
  that included one. Counting broken *triangles*, which is what a person
  checks first, is trapped in 52 of 555 six-object items: a true premise
  sits on more broken triangles than either false one. Those are the items
  worth serving at the top.
- **Lures:** the premise on the most broken triangles when it is true; the
  right count with one premise swapped for its neighbour on the loop.

### 2. Rigid or flexible — distances alone

Premises give only how far apart two objects are: "Red is five from Blue".
Pythagorean triples keep the numbers whole. Three questions:

1. Is the shape settled, up to sliding, turning and mirroring?
2. Select every pair whose distance is settled.
3. Select the one more distance that would settle the shape.

- **Theory.** Distances settle a shape *locally* by **Laman's theorem**
  (1970). With 2n − 3 distances, the shape is rigid exactly when every k of
  the objects carry at most 2k − 3 distances among themselves. The pebble
  game (Jacobs & Hendrickson 1997) decides it in polynomial time. They
  settle it *uniquely* exactly when the graph is 3-connected and stays
  rigid without any one distance (Hendrickson 1992; Connelly 2005; Jackson &
  Jordán 2005). Equivalently, some stress matrix has rank n − 3 (Gortler,
  Healy & Thurston 2010). *Both checked: Laman's count against generic rank
  on all 5,131 graphs with 2n − 3 edges on four to six objects, and
  Jackson–Jordán against the stress test on all 33,856 graphs on four to
  six.* Deciding whether given distances can be drawn in the plane at all
  is NP-hard (Saxe 1979).
- **The mirror, and the flip.** The whole shape's mirror image always fits,
  as in Betweenness. But a *part* can also flip across two objects that cut
  it off from the rest, which is why a rigid shape can still fail to be
  unique. That is *Can't tell* for distances.
- **Against the floor.** Relation Algebra's *Can't tell* is a rank question
  about whether two objects are linked, which a chain answers. This is the
  rank of the **rigidity matroid**. No route settles anything, and the
  count runs over every subset of objects (property 1). Betweenness (2.3,
  26) has the mirror; this has the mirror, partial flips and flex. Answers
  2 and 3 are selections (property 3).
- **In the engine.** A new material (points in the plane), with questions
  computed by the pebble game, or by rank at random coordinates as the
  check script does.
- **Lures:** counting 2n − 3 distances without the subset condition (a
  square with both diagonals, one distance too many, beside a hinge left
  floppy); the partial flip forgotten; a distance that is settled locally
  but not uniquely.

### 3. One group, two vocabularies — the dictionary is an automorphism

The same arrangement described twice. Once in the trainer's code, once in
invented words that name the same group's elements through an unknown
relabelling **that respects composition**: an automorphism.

- **Theory.** For notes, the automorphisms of ℤ₁₂ multiply by 1, 5, 7 or
  11, and ×7 sends a semitone to a fifth. *Checked.* The chromatic circle
  and the circle of fifths are one group relabelled, which pitch-class set
  theory knows as the M7 operation. For orientations, D₄ has eight
  automorphisms. Four are **inner**, a change of viewpoint: turn or mirror
  the observer. Four are **outer**, and every one of them swaps the edge
  mirrors with the diagonal flips, which no way of looking at the tile can
  do. *Checked.*
- **The task.** A few stated correspondences, given as composed relations
  ("Gold's word for how Red stands to Blue is *vesk*"), pin down the
  dictionary. Then complete an analogy or answer a question that crosses
  the two vocabularies. Keep the item only when exactly one automorphism
  fits.
- **Against the floor.** Cross Analogy (2.5, 28) builds a signed
  permutation of axes from entities said to correspond. Here the
  dictionary must preserve a **non-abelian composition law**, the evidence
  is relations computed through nesting rather than pairs of entities, and
  the right dictionary may be **outer**, so spatial intuition cannot
  shortcut it. It clears 1, 4 and 5.
- **In the engine.** Find Aut(G) by brute force once (at most 8! maps for
  D₄), then relabel `say` and `code`.
- **Lures:** the inner automorphism nearest the outer one; the dictionary
  applied backwards (φ⁻¹ for φ).

### 4. Relations as values, in a non-abelian material

Context Shifts with poses. "Context A is how Red stands to Blue" names a
walk. Later contexts operate on it:

- seen from the other end (the inverse);
- **as context B sees it** (conjugation, `B·A·B⁻¹`);
- followed by context C (composition);
- seen in a mirror (an automorphism from 3).

At the end, say where Gold lands if it starts at White and walks the final
context. The Second-Order version gives one example of A becoming A′ and
asks which operation did it: conjugation by which derived context, the
inverse, or which mirror. The item is kept only when exactly one operation
in the catalogue fits.

- **Against the floor.** In Context Shifts (2.7, 27) the values are vectors
  (abelian) and the operations are signed permutations. Here **both layers
  are non-abelian**: the operations do not commute and neither do the
  values. Some operations are themselves defined by another derived
  relation ("as B sees it"), so there is integration inside the operations.
  It clears 1, 2 and 4.
- **In the engine.** Every operation is already `pose.op` and `pose.inv`.
- **Lures:** conjugation the wrong way round (`B⁻¹·A·B`); the inverse taken
  for the mirror; two operations swapped.

### 5. Routes on a curved surface — holonomy

**Built:** Relation Algebra's *Routes on a cube* task (`apps/relations/routes.js`,
tested in `apps/relations/test/routes.test.js`), with all three tasks below.
The walks there use the trainer's poses code, where `<` and `>` are steps to
the side and `q Q` the turns, so the walks below read `^Q^Q^` and `^^q^^^q^`
in it.

Poses on the **surface of a cube**. A walker carries its facing over each
edge onto the next face. Three facts, *checked by simulating the walker*:

- `^<^<^`, three steps and two left turns round one corner, brings it back
  where it started, **facing a quarter turn right of how it began**.
- `^^>^^^>^`, round one edge, brings it back facing as it began, with only
  two right turns. On a flat grid, two turns with steps between them never
  close a route.
- Eight steps straight round the middle bring it back facing as it began,
  **with no turn at all**.

The rule: a closed route's change of facing is its own turns, plus a
quarter turn for each corner it goes round (counted with the direction of
travel). Each of the eight corners is missing a quarter turn of angle,
which totals two full turns: Descartes' theorem, the discrete Gauss–Bonnet.

- **What changes.** Relations stop being group elements. "Red is Blue `^^<`"
  depends on where Blue stands, because the walk may cross an edge. The
  structure is a connection with curvature, not a gauge field that can be
  flattened away.
- **Tasks:**
  - select every offered route that brings Red back facing the way it
    started;
  - *Possible?*, where loops must close up to the corners they go round;
  - how many corners does this loop go round, read from its turning.
- **Against the floor.** Pivot Transforms (2.5, 26) changes the frame
  once, at a stated moment. Here the frame changes wherever a route crosses
  an edge, by an amount set by which corners the route has gone round, so
  no frame can ever be fixed. Whether two premises can be combined at all
  depends on their routes (property 1). Nothing in either app trains this.
- **In the engine.** Premises are walks; `solve` simulates them (the walker
  in the check script is about 20 lines).
- **Lures:** the flat-grid answer (corners ignored); a corner counted the
  wrong way; the turn applied before crossing an edge instead of after.
- *Next rungs:* Möbius and Klein-bottle boards, where a loop flips
  handedness. Poses already carry handedness.

### 6. Ranges with either/or — disjunctive temporal networks

"Red is two to four from Blue, either way round; Gold is one to two after
Red; Gold is at most five after Blue." The possible values of Gold − Blue
are −3 to 0 and 3 to 5: **two stretches with a hole between them**.
*Checked.*

- **Theory.** Without either/or, a set of range premises is a simple
  temporal network (Dechter, Meiri & Pearl 1991). It is possible when no
  loop has a negative total, and the tightest range is a shortest path. With
  either/or it becomes the disjunctive temporal problem, which is
  NP-complete (Stergiou & Koubarakis 2000).
- **The task.** Select every possible value of X − Y in a window of
  thirteen (−6 to +6), the same size as Interval Algebra's menu of Allen
  relations.
- **Against the floor.** Interval Algebra (2.4, 26) selects possible
  relations from qualitative premises. This does the same with quantities.
  Each reading is a weighted graph whose negative loops must be found, and
  the answer can have holes. It clears 2, 3 and 5, and 1 wherever loops
  settle readings.
- **In the engine.** Per reading, Floyd–Warshall on at most six objects,
  then the union over readings. In two dimensions, per axis, or octagons
  (Miné 2006) for diagonal ranges.
- **Lures:** the hole filled in (the outer bounds read as one range);
  interval subtraction done naïvely (`[a, b] − [c, d]` is `[a − d, b − c]`);
  a reading that a loop rules out kept.

### 7. Impossible only as a whole — parity and contextuality

Premises over three objects at once, in ℤ₂ ("an odd number of Red, Blue
and Gold vote against") or ℤ₃.

- **Theory.** The **Mermin–Peres magic square**: fill nine cells with +1 or
  −1 so that every row multiplies to +1 and the columns to +1, +1 and −1.
  It is impossible, but drop any one of the six constraints and it can be
  done. *Checked.* Penrose (1992) read his impossible triangle as a
  cohomology class: fine at every corner, impossible as a whole. Abramsky
  and Brandenburger (2011) showed quantum contextuality has the same shape.
- **Tasks:** *Possible?*; then select the fewest constraints that are
  already impossible together. That set is a *certificate*: constraints
  whose left sides cancel and whose right sides do not.
- **Against the floor.** Contradiction (2.2, 25) finds two premises that
  clash. Betweenness's three-place premises can be met by holding
  arrangements. Here, by construction, **no pair and no proper subset shows
  anything**; the certificate is global. A computer finds it by elimination
  over ℤ₂; a person has to find the parity argument. It clears 1, 2 and 3.
- **In the engine.** Needs premises over three objects (elimination over
  ℤ₂ or ℤ₃). Small enough to enumerate: 512 fillings of the square.
- **Lures:** a certificate one constraint short; a pair that looks like a
  clash and isn't.

### 8. Complete the law, then reason in it

Six invented words name a group's elements. A few products are stated
("*vesk* then *dor* is *mim*"), and the player is told it is a group and
nothing else.

- **How little it takes.** Three of a non-abelian law's 36 products can
  pin it down among all 480 group laws on six symbols; two never can.
  *Checked exhaustively.* So a card can state almost nothing and still
  determine everything, and everything else has to be **derived from the
  axioms**: each row a permutation, associativity, an identity, inverses.
  Then answer a nested relational question in the law just found.
- **Theory.** A group's table is a Latin square. Completing a partial Latin
  square is NP-complete (Colbourn 1984), and the Latin Square Task (Birney,
  Halford & Andrews 2006) is relational complexity's psychometric probe.
  Associativity is the constraint a Latin square lacks.
- **Kinship variant.** A small genealogy gives some people's sections;
  induce which permutation is "child of a man" and which is "child of a
  woman", then reckon a mother's mother's brother's daughter's daughter.
  The eight-subsection model is D₄. *Checked*; see the substrates table.
- **Against the floor.** Hidden Algebra (2.3, 26) picks one of a handful of
  known relation systems from a complete table. Here the table is nearly
  empty and the law is **derived, not picked**, then used for nested
  composition. It clears 1, 2, 4 and 5.
- **In the engine.** Enumerate every labelled group law of the order: 480
  for six elements, 22,080 for eight. Keep only partial tables with a
  single completion, and run the trainer's question generator in the law
  found.
- **Lures:** the abelian completion; a completion that is a Latin square
  but not associative.

### 9. The largest shared arrangement, after integration

Two descriptions of six objects each, different objects in each, both given
by nested premises along a tree, so most pairwise relations have to be
composed. **Select the largest group of the first whose relations are
exactly those of some group in the second**, up to sliding (and, at higher
rungs, turning).

- **Against the floor.** Common Subsystem (2.8, 28) compares *stated*
  arrows. Here no relation being compared is stated: every one has to be
  integrated through nesting before the search starts. That is
  Syllogimous's hardest search on top of Relation Algebra's hardest
  integration. It clears 1, 3 and 5.
- **An honest note on property 2.** For arrangements in a group the search
  has a trick: every matched pair votes for one shift (`b·a⁻¹`), and the
  largest shared group is the most-voted shift. That is point-pattern
  matching, which is polynomial. The trick is worth teaching in the
  explanation. Without it the task is a search over subsets.
- **In the engine.** `rel()` for every pair; votes.
- **Lures:** a group that matches up to turning when turning doesn't count;
  a near-match one object larger.

### 10. Relatedness through every path

Pedigrees with loops. Sewall Wright's (1922) coefficient of relationship
sums `(½)^L` over every pair of ancestral paths that meet at a common
ancestor and share nobody else. Siblings are ½, half-siblings ¼, first
cousins ⅛ and double first cousins ¼. *Checked by enumerating paths.* An
inbred ancestor multiplies its paths by `1 + F`.

- **Against the floor.** Every path must be found, and counting simple
  paths is #P-complete in general (Valiant 1979). The whole pedigree is the
  unit (property 1), and the lure is exact: one forgotten path halves or
  quarters the answer. It clears 1 and 2, with four fractional options.
- **In the engine.** A path algebra: sum over paths of products (a
  semiring, Carré 1971; Mohri 2002) in place of the group's single
  composite.
- **Lures:** one path only; a path through someone who is not an ancestor
  of both; an inbred ancestor's `1 + F` forgotten.

### 11. A network of lenses — what survives

Objects of several materials at once, linked by maps that forget:

| Map | What it forgets |
| --- | --- |
| pose → heading | the place |
| just interval → piano note | the commas (see substrates) |
| date → weekday | the week |
| shuffle → odd or even | everything else |

**Select every pair whose relation is settled.**

- **Theory.** A cellular sheaf (Hansen & Ghrist 2019; Robinson 2014): a
  space of values at each object, a map on each link, and the possible
  worlds as global sections. The current engine is the special case where
  every object holds the same group and every map is a translation.
- **Against the floor.** Projection (2.1, 24) asks who coincides through
  one lens. Here there is a network of lenses with kernels, and information
  flows only the way the maps point, so what is settled depends on the
  direction of every map along every route. That is integration with
  one-way links, answered as a set. It clears 1, 3 and 5.
- **Lures:** settled in the image read as settled in the source; a kernel
  element missed (the comma that vanishes on the piano and not in tune).

### 12. Beliefs about beliefs (frontier)

"Blue thinks Red is two north of Gold; Gold thinks Blue is one step off."
Each agent holds its own premises, which makes a Kripke structure in
epistemic logic. The questions are about what one agent's model says about
another's. Adults manage about fifth-order intentionality before failing
(Kinderman, Dunbar & Bentall 1998), a ready ceiling. It clears the floor on
paper, but phrasing it cleanly by ear is unsolved, so it stays a frontier
item.

---

## Substrates: materials the proposals run on

On their own these are below the floor. They give the proposals
non-abelian groups with real content, which is what 3, 4, 8 and 11 need.

| Material | Group | Why it is interesting | Checked |
| --- | --- | --- | --- |
| Chords | PLR and T/I, both dihedral of order 24 | neo-Riemannian P, L, R act on the 24 triads; the two groups commute and are each other's centralizers (Crans, Fiore & Satyendra 2009); PL cycles through 6 triads, PR 8, LR all 24 | yes |
| Kinship sections | Klein four-group (Kariera); D₄ (Aranda-type) | Weil (1949) and White (1963) modelled section systems as groups; the eight-subsection model is D₄, the Orientations group, and gives mother's-mother's-brother's-daughter's-daughter marriage | yes |
| Ratios and just intervals | ℤ³ (exponents of 2, 3, 5) | exchange rates (an impossible loop is arbitrage); 12-tone equal temperament maps it onto ℤ₁₂ and sends the syntonic comma, the Pythagorean comma and the diesis to zero | yes |
| Turning a die | the cube's rotations, order 24 | non-abelian without mirrors; turns about the die's own axes equal turns about fixed axes in reverse order | yes |
| Card stacks | S₃, S₄ | shuffles; odd and even shuffles never meet (the 15-puzzle's parity) | — |
| Allies and rivals | ℤ₂ | Heider's balance theory (Cartwright & Harary 1956); either/or carries no information here | — |
| Hexagons | ℤ² with six directions | the grid-cell lattice (Hafting et al. 2005; Constantinescu et al. 2016) | — |
| Stems and branches | ℤ₆₀ inside ℤ₁₀ × ℤ₁₂ | only 60 of the 120 pairs occur | yes |

Kinship sections are living cultural systems that vary (McConvell 2017).
Use abstract section labels, and say where the structure comes from.

## Considered and left below the floor

Kept here so the reasoning is not lost and the ideas are not proposed
again:

- **A new material for the existing tasks** (every row of the table
  above): same task, same difficulty.
- **One false premise only**, **the missing premise** (abduction),
  **shortest code** (Cayley-graph distance), **does the order matter**
  (commutators), **n-back up to renaming**: each is a single composition
  or a single isomorphism of three or four objects. Missing Premise and
  Structure Match already exist in Syllogimous at lower weight.
- **Ranges without either/or**: polynomial (shortest paths), so folded into
  6.
- **Tree distances** (ultrametrics: the larger distance wins unless the two
  are equal): a Possibility-Sets-sized idea, below the band.
- **One-way relations** (monoids): folded into 11, where maps that cannot
  be undone are the point.
- **Tarski's relation algebra**, the namesake (converse, composition,
  residuals, Schröder's rules): vocabulary rather than a task here; set-
  valued relations are Syllogimous's territory.
- **Qualitative poses** (OPRA, Moratz 2006): comparable to Region
  Connection, and close enough to the band to revisit if 2 or 5 is built.

---

## What cognitive science says

- **Relational complexity** (Halford, Wilson & Phillips 1998): the load of a
  step is how many things must be related *at once*. Adults top out around
  four unless the problem can be split (segmentation) or compressed
  (chunking). The floor's property 1 is the case where it can't be split.
  *Suggestion:* log, per item, the largest number of terms combined in one
  step that cannot be split, and check from the records whether errors
  follow that more closely than path length. The Latin Square Task (in 8)
  is the standard probe of exactly this.
- **Structure factored from content.** The Tolman–Eichenbaum Machine
  (Whittington et al. 2020) models the hippocampal formation as a code for
  structure (a group of actions, path-integrated) bound to a code for
  content: "one engine, seven groups" stated as a theory of the brain. Grid
  cells have been modelled as representations of a group of translations
  (Gao et al. 2021). Bellmund et al. (2018) review the case that spatial
  codes organise thought generally.
- **Binding is a group operation.** In holographic reduced representations
  (Plate 1995), binding is circular convolution and unbinding its inverse,
  so `rel(X, Y) = X·Y⁻¹` is literally an unbinding.
- **The honest caveat** the README already makes: none of this shows that
  practising relations trains anything beyond itself. Large meta-analyses
  of working-memory training find near transfer and little or no far
  transfer (Melby-Lervåg, Redick & Hulme 2016). Proposals 3 and 8 are how
  the trainer could test its own hope on its own records: the same group
  in new words, and a law never seen before.

## A suggested order

Ranked by what each adds against what it costs.

| # | Proposal | Cost | Why this early |
| --- | --- | --- | --- |
| 1 | The fewest false premises (1) | small: `altered`, `consistent()`, subset search | the natural successor to *Possible?*, with exact theory for the generator |
| 2 | Ranges with either/or (6) | small: Floyd–Warshall per reading | the trainer's either/or machinery reused; answers with holes |
| 3 | Relations as values (4) | small: the pose group's own operations | Context Shifts' lesson, both layers non-abelian |
| 4 | Two vocabularies (3) | medium: Aut(G), invented-word rendering | outer automorphisms are a dictionary no viewpoint gives |
| 5 | Complete the law (8) | medium: enumerate laws, filter | induction from axioms; the transfer probe |
| 6 | The largest shared arrangement (9) | medium | the hardest search on the hardest integration |
| 7 | Rigid or flexible (2) | medium: new material, pebble game | a new kind of *Can't tell* |
| 8 | Parity (7) | medium: three-object premises | the only proposal where nothing short of the whole shows anything |
| 9 | Relatedness (10) | medium: pedigree material, path sums | real science, an exact lure |
| 10 | Network of lenses (11) | large: several materials at once | one-way integration |
| 11 | Curved surface (5) | built | the most original item here |
| 12 | Beliefs (12) | unknown | phrasing unsolved |

---

## Sources

**Read from this repository:** Syllogimous's `MODE_SCALE`
(`src/app/syllogimous/utils/calibration.utils.ts`), `ORDERED_QUESTION_TYPES`
and `TIERS_MATRIX` (`constants/game.constants.ts`), and the headers of
`generators/isomorphism.ts`, `cross-analogy.ts`, `context-shifts.ts`,
`concave-regions.ts`, `betweenness.ts`, `intervals.ts`, `rcc8.ts`,
`hidden-algebra.ts`, `projection.ts`, `minimal-premises.ts`,
`second-order.ts` and `pivot-transforms.ts`.

**Computed for these notes** (`research/relation-algebra-checks.js`, which
uses the trainer's own `square` group where it applies):

- A false premise is locatable exactly when its objects keep two
  premise-disjoint routes without it: 4,284 cases.
- Laman's count against generic rank: 5,131 graphs. Jackson–Jordán against
  the stress-rank test: 33,856 graphs.
- D₄ has four inner and four outer automorphisms, and the outer ones swap
  the edge mirrors with the diagonal flips. Aut(ℤ₁₂) is ×1, ×5, ×7, ×11.
- The cube walker: a quarter turn round one corner; no change round one
  edge with two right turns, or round the middle with none.
- Wright's coefficient for siblings, half-siblings, first and double first
  cousins.
- The either/or range example's answer, with its hole.
- 480 group laws on six symbols; three products can pin a non-abelian one,
  two never can.
- The Mermin–Peres square is impossible, and minimally so.
- PLR and T/I; Kariera and the Aranda-type model; the commas; the cube's
  rotation group; D₄'s commutators; the sexagenary cycle.

**Found and checked in this pass:**

- Weil's appendix: [BnF, "Des lois du mariage"](https://bnf.fr/fr/mediatheque/des-lois-du-mariage-bourbaki) · [arXiv 2002.12813](https://arxiv.org/pdf/2002.12813)
- Crans, Fiore & Satyendra 2009: [arXiv 0711.1873](https://arxiv.org/pdf/0711.1873)
- Khot, Kindler, Mossel & O'Donnell 2007: [paper](https://cs.nyu.edu/~khot/papers/maxcut.pdf)
- Whittington et al. 2020: [PMC7707106](https://pmc.ncbi.nlm.nih.gov/articles/PMC7707106/)
- Constantinescu, O'Reilly & Behrens 2016: [PMC5248972](https://pmc.ncbi.nlm.nih.gov/articles/PMC5248972/)
- Hansen & Ghrist: [arXiv 1808.01513](https://ar5iv.labs.arxiv.org/html/1808.01513)
- Moratz 2006, OPRA: [Qualitative reasoning about relative direction](https://ar5iv.arxiv.org/html/1011.0098)
- Birney, Halford & Andrews 2006: [Latin Square Task](https://hal-amu.archives-ouvertes.fr/hal-01772235)
- McConvell 2017: [Oceania](https://onlinelibrary.wiley.com/doi/abs/10.1002/ocea.5155)

**Cited from the literature but not re-checked in this pass** (the
rigidity theorems were checked computationally above): Babai 2016; Renz &
Nebel 1999; Opatrny 1979; Vilain & Kautz 1986; Lewin 1987; Harary 1953;
Zaslavsky 1989; Khot 2002; Bulatov & Dalmau 2006; Goldmann & Russell 2002;
Reiter 1987; Laman 1970; Jacobs & Hendrickson 1997; Hendrickson 1992;
Connelly 2005; Jackson & Jordán 2005; Gortler, Healy & Thurston 2010; Saxe
1979; M5/M7 in pitch-class set theory; Dechter, Meiri & Pearl 1991;
Stergiou & Koubarakis 2000; Miné 2006; Mermin 1990; Peres 1990; Penrose
1992; Abramsky & Brandenburger 2011; Colbourn 1984; Wright 1922; Valiant
1979; Carré 1971; Mohri 2002; Robinson 2014; Kinderman, Dunbar & Bentall
1998; Heider 1946; Cartwright & Harary 1956; Hafting et al. 2005; White
1963; Halford, Wilson & Phillips 1998; Gao et al. 2021; Bellmund et al.
2018; Plate 1995; Melby-Lervåg, Redick & Hulme 2016.
