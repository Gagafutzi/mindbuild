# Relations beyond the seven groups — research notes for Relation Algebra

Notes towards extending `apps/relations`. The trainer does one thing
thoroughly: objects hold elements of a group, premises fix the differences
between them, and the player composes those differences along paths and
round loops. This collects what mathematics, physics, music theory,
anthropology, biology, computer science and cognitive science know about
relations that could be built on that, sorted by how much of the engine each
would have to change.

The name says *relation algebra*, but the engine is not Tarski's relation
algebra (that is in [3.11](#311-tarskis-relation-algebra-for-the-record)),
and most of the useful ideas come from elsewhere. Relation Algebra's source
lives upstream in Chimera Hub, so anything here that is built belongs there
first (see the README).

Claims worked out for these notes rather than quoted from a source are
checked by brute force in `research/relation-algebra-checks.js`:

```bash
node research/relation-algebra-checks.js
```

## What the engine already is

The same structure has a name in at least six fields. Each name points to a
different family of extensions, which is the reason to list them.

| Field | Its name for the engine | What the engine's parts are called there |
| --- | --- | --- |
| Algebra | a **torsor** (principal homogeneous space) | objects are points with no origin; only `rel(X, Y) = X·Y⁻¹` means anything; sliding every object by one element changes nothing (the n-back's "slid" match) |
| Music theory | a **Generalized Interval System** (David Lewin, *Generalized Musical Intervals and Transformations*, 1987) | a set, a group of intervals, and `int(r, s)·int(s, t) = int(r, t)`, with exactly one `t` at each interval from each `s`. All seven materials are GISes; Lewin built the definition for notes |
| Graph theory | a **gain graph** (voltage graph) | premises are edges labelled with group elements, the reverse direction with the inverse; *Possible?* asks whether the graph is **balanced** (Harary 1953 for signs; Zaslavsky's biased graphs, 1989, for any group) |
| Topology | a **1-cochain** and its **cohomology** | for an abelian group the premises are possible exactly when they are a coboundary: the differences of some placement of the objects. The obstruction lives in H¹ of the premise graph, with one independent loop per premise beyond a spanning tree (m − n + c of them) |
| Physics | a **flat lattice gauge field** | labels are a connection; "every loop closes" is zero curvature (trivial Wilson loops); a pose's own frame is a choice of gauge |
| Computer science | a **unique game**, solved exactly | constraints `x_u − x_v = c (mod q)` are linear unique games. With every premise true, propagation solves them, which is what `solve()` does. Finding an assignment that satisfies *most* of them is Khot's Unique Games problem (2002); Khot, Kindler, Mossel and O'Donnell (2007) show it hard to approximate under his conjecture |

Two consequences shape everything below.

- **Exact premises between pairs are easy; either/or premises are not.** A
  premise `X = g·Y` is a coset of the diagonal, closed under the Mal'tsev
  operation `x·y⁻¹·z`, and constraint languages with a Mal'tsev polymorphism
  are tractable (Bulatov & Dalmau 2006; the same algebraic theory settled
  the general CSP dichotomy, Bulatov and Zhuk, 2017). A union of two cosets, an either/or, generally
  is not, so the 2ᵏ enumeration in `readings()` is the honest algorithm, not a
  shortcut waiting to be found. Levels 21–30 ask humans to do something with
  no efficient general method.
- **Abelian and non-abelian materials split once premises link three or more
  objects.** Systems of equations over a finite non-abelian group are
  NP-complete to solve (Goldmann & Russell 2002), while over abelian groups
  they are linear algebra. Anything in Part 3 that adds many-object premises
  should stay with the abelian materials.

## How the menu is sorted

1. **New materials:** a new group object. The engine, the tasks and the lures
   run unchanged, and the test battery (`test/algebra.test.js` loops over
   `GROUPS`: group laws, every task at all thirty levels, parsed-back code)
   covers it for free. The compact and spoken codes are written per material
   in `codeTok` and `ear`, so each needs its notation added there.
2. **New tasks:** a new generator over the same solver.
3. **Generalising the solver:** relations that are not group elements.

Each item says what it is, what it would train that the trainer does not
already, how it fits the engine, and the mistakes it invites (lures).

---

## Part 1 — New materials (a new group)

### 1.1 Allies and rivals — ℤ₂ and structural balance

Fritz Heider's balance theory (1946), made exact by Cartwright and Harary
(1956): in a network of "with" and "against", the network is *balanced*
exactly when every loop has an even number of "against"s, which is when
everyone splits into two camps. "The enemy of my enemy is my friend" is the
composition law of ℤ₂.

- **Why here:** the most familiar relational structure there is, and it has
  a documented bias to train against. De Soto (1960) found people learn
  balanced social structures faster and misremember unbalanced ones as
  balanced, so the natural lure is the balanced completion.
- **In the engine:** `cyclic("teams", "Teams", 2, …)` with "on Blue's side"
  / "against Blue" phrasing. *Possible?* becomes "Is this group of people
  possible?"
- **Watch out:** ℤ₂ has one non-identity element, so an either/or premise
  ("Red is either with or against Blue") says nothing, and `eitherOf` will
  find no decoy. Leave Teams out of levels 21–30, or use ℤ₂ × ℤ₂ (two
  independent splits: team and shift), where either/or still carries
  information. The sign and order lures vanish, since every element is its
  own inverse.

### 1.2 Hexagonal space

Grid cells in the entorhinal cortex fire on a hexagonal lattice (Hafting et
al. 2005), and Constantinescu, O'Reilly and Behrens (2016) found the same
six-fold signal while people navigated an abstract two-dimensional space of
bird shapes. Hexagons are the brain's own grid; squares are ours.

- **Why here:** a new 2-D metric with no "diagonal" escape. Three axes, all
  equal, so the square-grid habit of splitting a move into north and east
  fails.
- **In the engine:** axial coordinates `(q, r)`, six unit steps, the twelve
  symmetries of the hexagon (D₆) as n-back lures, distance
  `(|dq| + |dr| + |dq + dr|) / 2`. Code by clock hours (12, 2, 4, 6, 8, 10)
  rather than the keypad. Hex poses are `ℤ² ⋊ D₆`: a frame turns in 60°
  steps.
- **Lures:** the move read on a square grid; a 60° turn taken as 90°.

### 1.3 Wrapping space — the torus ℤₘ × ℤₙ

A board where walking off one edge comes back on the opposite one. Still an
abelian group, so nothing else changes, but two routes can now differ by a
whole lap: on a board five wide, three east *is* two west.

- **Why here:** the smallest step from flat space into topology. Notes, days
  and headings are already one-dimensional tori; this is the
  two-dimensional one.
- **In the engine:** `space` with `op` taken mod m and n, and the metric
  taken as the shorter way round.
- **Lures:** the answer as on the open plane (the wrap forgotten).
- A **Klein-bottle board** (off the top, back on the bottom mirrored) is not
  a group on places. It belongs with curved spaces in
  [3.8](#38-curved-and-twisted-spaces--holonomy).

### 1.4 Card stacks — the symmetric group S₃

Each object holds an order of three cards. A relation is a shuffle: "swap
the top two", "move the top card to the bottom". S₃ is the smallest
non-abelian group (six elements, the same as the triangle's symmetries).

- **Why here:** Orientations is non-abelian because of mirrors; this one is
  non-abelian because of what shuffling *is*. It also brings in an
  invariant you can check without computing anything: a shuffle is odd or
  even, every swap flips that, and no odd number of swaps equals an even
  number. That kills whole classes of options at a glance, as the parity
  argument for the 15-puzzle does (Johnson & Story 1879).
- **In the engine:** permutations as arrays, `op` = composition. Code in
  lower case (`s` swap, `c` cut), avoiding the mark letters.
- **Lures:** the same shuffle in the other order; the inverse (cutting
  back); the same swap at the wrong position (a conjugate).
- S₄ (24 elements) is the next rung. It is also the rotation group of the
  cube in 1.6.

### 1.5 Chords — the T/I and PLR groups

Notes are ℤ₁₂: transposition only. Music theory has two richer groups, each
dihedral of order 24, and each the exact commuting partner of the other.

- **T/I:** transpose (`x ↦ x + n`) and invert (`x ↦ n − x`). Inversion
  turns a major chord into a minor one; C major becomes F minor under
  inversion about C.
- **PLR** (neo-Riemannian theory, after Hugo Riemann; Cohn 1998): on the 24
  major and minor triads, **P**arallel (C major ↔ C minor), **L**eading-tone
  exchange (C major ↔ E minor), **R**elative (C major ↔ A minor). Each is
  its own inverse; together they generate a dihedral group of order 24. PL
  cycles through six triads (the hexatonic cycle), PR through eight (the
  octatonic), LR through all 24.
- **Duality:** every T/I element commutes with every PLR element. Each group
  is the other's centralizer in the permutations of the triads (Crans, Fiore
  & Satyendra 2009). *Checked.*
- **Why here:** a non-abelian material that can be *heard*. The hub already
  plays audio, and a chord-relations round with eyes closed would be
  relational reasoning by ear on real musical objects.
- **In the engine:** triads as `[root, major]`, the three generators as
  permutations. Code `p l r` in lower case (upper-case L and P are mark
  letters, R is Red). Spoken: *parallel, leading, relative*.
- **Lures:** the order swapped (LR is not RL); a T/I move confused with its
  PLR twin (I about C and P both turn C major minor, but to different
  chords).

### 1.6 Turning in three dimensions — the cube's rotation group

Rotations in a plane commute; rotations in space do not, even without
mirrors. A die's orientation is an element of the cube's rotation group
(order 24, isomorphic to S₄; 48 with mirrors). *Checked.* Mental rotation of
3-D shapes is the most studied spatial task in psychology (Shepard & Metzler
1971).

- **Intrinsic or extrinsic:** the concept this material exists for. Turning
  about the *die's own* axes, one after another, gives the same result as
  turning about *fixed* world axes in the reverse order: right
  multiplication against left. An aircraft's yaw, pitch and roll are about
  its own axes; many robotics and graphics conventions turn about fixed
  ones. The engine already marks this distinction with `leftNesting`.
- **In the engine:** 3×3 signed permutation matrices, or a lookup table.
  Code `x y z` for quarter turns about each axis (Rubik's R U F clash with
  Red and the marks).
- **Lures:** right turns in the wrong frame (order reversed); a quarter turn
  the wrong way; a mirror image.
- **3-D poses** (`ℤ³ ⋊ O`, a drone or a diver: "two ahead, pitch up, one
  ahead") would be the hardest material here, and need a drawing the page
  does not yet have.
- *Further out:* unit quaternions, which pilots' software and game engines
  use for orientation, form the double cover SU(2): a full turn is not the
  identity there, only two are (Dirac's belt trick). A material where that
  matters exists, the binary octahedral group, but it is a curiosity.

### 1.7 Ratios — exchange rates, gears and just intervals

Positive fractions under multiplication form a free abelian group, one
coordinate per prime. Restricted to 2, 3 and 5, it is ℤ³: "a Red is worth
three Blues; two Blues buy a Green" is space with multiplicative words.

- **Why here:** multiplicative reasoning is a different skill from additive,
  and proportional-reasoning research has long documented the *additive
  error*: answering "three more" for "three times".
- **Possible?** becomes **arbitrage**: a loop of exchanges that returns more
  than it started with is exactly a loop whose product is not 1 (in
  logarithms, a negative cycle, which Bellman–Ford finds).
- **Lures:** additive for multiplicative; divided instead of multiplied.
- **The musical version is the best example in this whole document of a map
  losing information.** In just intonation an interval is a ratio (a fifth
  is 3/2, a major third 5/4), and Euler's *Tonnetz* is this lattice with
  octaves set aside. Twelve-
  tone equal temperament maps it onto ℤ₁₂: 2 ↦ 12 ≡ 0, 3 ↦ 19 ≡ 7,
  5 ↦ 28 ≡ 4 semitones (regular temperament theory calls such a map a
  *val*). The **syntonic comma** 81/80, the **Pythagorean comma**
  3¹²/2¹⁹ and the **diesis** 128/125 all go to 0. *Checked.* So a chain of
  intervals can close on a piano and fail to close in tune: the comma is
  the loop's holonomy. See [2.6](#26-through-a-lens--homomorphisms-between-materials).

### 1.8 Units — dimensional analysis

Physical dimensions form a free abelian group: length^a mass^b time^c, and
so on. Velocity is length per time, force is mass times length per time
squared. A formula is dimensionally possible exactly when both sides are the
same element.

- **Why here:** the same group as space (ℤ³ or ℤ⁴), with real semantics and
  multiplicative phrasing. It is a *transfer* test: a player fluent in ℤ²
  moves meets ℤ³ in a domain that does not look like a grid.
- **Buckingham's π theorem** (1914) is the rank argument in the README in
  physics' clothing: the number of independent dimensionless combinations
  is the number of quantities minus the rank of their dimension matrix.
- **Lures:** "per" read as "times"; an exponent one off.

### 1.9 Kinship sections — the Klein group and D₄

André Weil's appendix to Lévi-Strauss's *Elementary Structures of Kinship*
(1949) and Harrison White's *An Anatomy of Kinship* (1963) modelled
Australian section systems as groups. Everyone belongs to a section. "The
section of a man's children" and "the section of a woman's children" are
permutations of the sections, and they generate a group.

- Worked out for these notes: Kariera's four sections give the **Klein
  four-group** (ℤ₂ × ℤ₂). The standard eight-subsection (Aranda-type) model
  gives a non-abelian group of order 8 with five involutions, which is
  **D₄**, the group of the Orientations material. In that model every
  man's spouse is his mother's mother's brother's daughter's daughter, the
  Aranda rule. *Checked.*
- **Why here:** a non-abelian group that real marriage rules are built
  on, answering questions like "what section is my mother's mother's
  brother's daughter's daughter in?" The same group as tile orientations,
  with completely different content, is a clean transfer probe.
- **Care:** these are living systems, they vary (McConvell 2017 maps the
  variation), and subsection names belong to the people who use them. Use
  abstract section labels and say where the structure comes from.

### 1.10 Cycles that run together — the Chinese remainder theorem

The Chinese sexagenary calendar pairs ten heavenly stems with twelve earthly
branches. Because 10 and 12 share a factor of 2, only 60 of the 120 pairs
ever occur. *Checked.* The Maya calendar round ran a 260-day count against
a 365-day year and repeated every 18,980 days (52 years).

- **In the engine:** ℤ₆₀ phrased as two components ("three stems and five
  branches later"). Premises that give only one component need the solver
  to accept a set of answers (a coset); see [3.1](#31-linear-premises--analogies-midpoints-and-parity).
- **Lures:** a pair that never occurs (the parity constraint missed); the
  answer worked in one cycle only.

### 1.11 Laps — the heading that counts its turns

Compass headings are ℤ₈. Count total turning instead, in eighths, and the
group is ℤ: "three full turns right and a quarter". This is the circle's
universal cover, and it is a real engineering problem. A camera on a
turntable has to unwind its cable, so it needs the lap count, not just where
it points.

- **Why here:** the smallest example of a covering space, and the pair
  (laps, compass) is the smallest example of a map that forgets something.
- **Lures:** full turns dropped.

### 1.12 Hidden groups — a new law every round

Not one material but a generator of them. Each round draws a small group
the player has never been told about (ℤ₂ × ℤ₂, ℤ₆, S₃, D₅, the quaternion
group Q₈, ℤ₃ ⋊ ℤ₄ …). It is given only by its defining laws, in invented
words: "blick twice is nothing; blick, frob, blick is frob backwards."

- **Why here:** this is the cheapest way to *test* the README's hope. If
  "one engine, seven groups" trains something general, performance in a
  group never seen before should show it. Q₈ is the instructive outlier:
  non-abelian, yet every element but ±1 has order 4 and every subgroup is
  normal.
- **In the engine:** a Cayley table and `op` as a lookup. Tables come from
  Todd–Coxeter enumeration of the presentation, or are written out by hand
  for a short catalogue.
- Syllogimous's Hidden Algebra has the player infer a relation's
  *properties*. This would hand over the full law and ask the player to
  reason in it.

---

## Part 2 — New tasks on the same engine

### 2.1 Which premise is false?

*Possible?* asks whether the premises fit together. The next question is
which one doesn't, and the theory behind it is exact.

- A false premise shows on every loop through it. It can be pinned down
  from consistency alone **exactly when the two objects it links are still
  joined by two routes sharing no premise once it is removed**, which is
  Menger's theorem in this setting. *Checked by brute force on every
  connected arrangement of four and five objects: 4,284 cases.* When that
  holds for every premise, the premise graph is 3-edge-connected, so it
  needs at least 3n/2 premises: all six pairs for four objects.
- In coding terms, the loops that fail are the **syndrome**, and the premise
  graph's cycle space is the code. Robot mapping does the same thing when it
  throws out a false loop closure.
- With more than one false premise, finding the largest set that fits is the
  Unique Games problem again: hard in general, easy at trainer sizes by
  enumeration.
- **In the engine:** `possibleTrial` already alters one premise and records
  which (`altered`). A new generator adds loops until the altered premise
  passes the condition above, then asks which premise it was. A second
  question can follow: what should it have said?
- **Lures:** a premise on the same loop that a second loop clears; the right
  premise with the wrong correction.

### 2.2 What must the missing premise say?

The question is given as a fact, one premise is blank, and the player
supplies it. That is backward chaining (abduction) rather than forward. In a
group the blank has exactly one value, the remaining path's composite undone
against the goal. In Tarski's relation algebra this is **residuation**: the
largest S with R;S ⊆ T, written R\T.

- **Lures:** the forward answer (the goal itself); the blank's inverse;
  nesting dropped on one side.
- Syllogimous's Missing Premise picks a premise from a list. Here the answer
  is a relation, which is a harder thing to supply.

### 2.3 Shortest code

"Write `Bmqmqh` in fewest letters." Every group has a **Cayley
graph**: the elements, with an edge for each sayable single move. The
shortest code is a shortest path in it (the *word metric*). For ℤ² the
keypad rule the code already uses (diagonals first) is that path.

- **Why here:** the explanation line `⇒` already reduces each premise to a
  single move. This makes that reduction the task, which is chunking.
- **In the engine:** breadth-first search over the group once, at load.
- **Lures:** letters cancelled that do not commute (`mq` is not `qm`); a
  quarter turn left read as right.

### 2.4 Does the order matter here?

For the non-abelian materials, ask whether two moves give the same result in
either order. The **commutator** `aba⁻¹b⁻¹` measures how far they don't. In
D₄ it is always either nothing or a half turn, so swapping any two moves
changes the result by a half turn at most. *Checked.* That is a learnable
fact which turns a computation into a recognition.

**Conjugation**, `g·h·g⁻¹`, is the same move described from another frame:
a quarter turn right, seen in a mirror, is a quarter turn left. A task
asking "Blue's move, as Green would describe it" makes explicit the change
of frame that poses do silently.

### 2.5 n-back up to renaming

The current n-back asks whether this is the same arrangement, exactly or
turned. Next: the same *shape* with the colours permuted. That is structure
without identity, Gentner's (1983) structure-mapping account of analogy,
where relations are mapped and objects ignored.

- **In the engine:** `same()` tries every bijection of names as well as
  every rotation. With three or four objects that is at most 24 × 4 checks.
- **Lures:** the mirror image when mirrors don't count; a shape with the
  same set of distances but different connections.
- **Watch out:** a symmetric arrangement matches itself in several ways.
  That is harmless for a yes/no task, but it matters if the round asks
  *which* object corresponds to which.

### 2.6 Through a lens — homomorphisms between materials

Premises in one material, the question in another, joined by a map that
forgets something:

| Map | What it forgets | Everyday version |
| --- | --- | --- |
| pose → heading | place | "Where is Red facing?" from walks |
| laps → compass | whole turns | the turntable's cable |
| just intervals → piano notes | the commas | why a choir drifts in pitch |
| shuffles → parity | everything but odd/even | the 15-puzzle |
| dates → weekdays (ℤ → ℤ₇) | the week number | "if the 3rd is a Monday, what is the 24th?" |
| units → "is it a speed?" | the other dimensions | checking a formula |

The answer is the image of the relation. Going the other way, from the
poorer material back to the richer, gives *Can't tell* unless the map loses
nothing (its **kernel**). That is the first isomorphism theorem as a task.
Syllogimous's Projection asks who coincides once some directions are
ignored, which is the same idea inside one space. This version crosses
materials.

### 2.7 Analogies between pairs

"Red is to Blue as Green is to …?" In an abelian group this is the
parallelogram, `X = G·(R·B⁻¹)`: Rumelhart and Abrahamson's (1973) model of
analogy, and the arithmetic behind word vectors' king − man + woman ≈
queen (Mikolov et al. 2013).

With poses **"as" has two readings, and they disagree**. The engine's
relation `R·B⁻¹` is Red as Blue sees it, in Blue's own frame ("two ahead,
one left"), so the trainer's analogy is `G·O⁻¹ = R·B⁻¹`: Green stands to
Gold as each sees its partner. A player can equally read it on the map: the
same compass offset between the places, which is the Space relation. When
Blue and Gold face different ways the two answers differ, and the map
reading is a precise, nameable lure. (Algebraically, a non-abelian group
acts on itself from the left and from the right, so "the same relation"
always needs a side; the README's poses already pick one.) As a question
this needs no new solver. As a premise it needs 3.1.

---

## Part 3 — Generalising the solver

### 3.1 Linear premises — analogies, midpoints and parity

Today every premise links two objects. Allow any linear equation over an
abelian material:

- **Midpoints:** "Gold is halfway between Red and Blue." In an affine space
  you cannot add points, but you can take combinations whose weights sum to
  1, so this keeps the typing discipline the README describes.
- **Analogies as premises:** `R − B = G − O`, one premise about four
  objects.
- **Parity constraints** over ℤ₂, which lead to the Mermin–Peres square in
  [3.9](#39-locally-fine-globally-impossible--contextuality-and-impossible-figures).

**Solver:** Gaussian elimination over the rationals for space and numbers;
Hermite or Smith normal form for ℤ and ℤₙ (ℤ₁₂ is not a field, so plain
elimination fails). *Can't tell* becomes exactly the README's rank argument:
the asked combination is not in the span of the premises. This is also what
lets premises give a *set* of answers (a coset), as 1.10 needs. Keep it to
abelian materials (Goldmann & Russell, above).

**The dual task: flows.** Potentials (where things are) and flows (how much
moves along each link, conserved at every junction: Kirchhoff's current law)
are dual. Potentials live on the cycle space and flows on the cut space, a
duality Tutte made central to graph theory. "Three litres a minute go from
Red to Blue…; how much from Gold to White?" A flow is settled exactly when
no loop of unknown links passes through it. One material can carry both
tasks.

### 3.2 Bounds instead of values — simple temporal networks

"Red is two to five more than Blue." A set of difference bounds
`x − y ≤ c` is a weighted graph (Dechter, Meiri & Pearl 1991). It is
consistent exactly when no loop has negative total. The tightest bound on
`X − Y` is a shortest path. Everything is polynomial (Floyd–Warshall).

- **Why here:** the trainer's three answers already fit exactly. **Must**
  when the asked value is the only one left, **can't** when it lies outside
  the interval, **not settled** when it is inside but not alone. *How far?*
  becomes "at least … at most". Scheduling, project planning (the critical
  path) and timetables are the everyday version.
- **In two dimensions:** per axis for grid moves; *octagons* (Miné 2006)
  for diagonal bounds.
- **Lures:** interval subtraction done naïvely (`[a, b] − [c, d]` is
  `[a − d, b − c]`, not `[a − c, b − d]`); bounds intersected where they
  should be added.

### 3.3 Path algebras — one solver, many questions

Replace "compose along a path, compare for equality" with a **semiring**: ⊗
along a path, ⊕ across alternative paths (Carré 1971; Gondran & Minoux
2008; Mohri 2002).

| ⊕, ⊗ | Question | Example |
| --- | --- | --- |
| min, + | fastest route | "Red to Blue is three hours…; how soon can Gold reach White?" |
| max, min | widest route | the heaviest lorry that can make the trip |
| +, × | **coefficient of relationship** | Sewall Wright (1922): sum (½)^L over every path through a common ancestor. Siblings ½, half-siblings ¼, first cousins ⅛ (two paths of four) |
| or, and | reachability | Syllogimous's ordering and hierarchy modes |

Wright's coefficient is the strongest candidate: a real scientific quantity,
computed by exactly this algebra, and the lure is precise. People take one
path to a common ancestor and forget the second, so they halve the answer.
Cousin marriage adds loops, and loops add paths.

### 3.4 Tree distances — ultrametrics

"Red and Blue share a grandparent; Blue and Green only a great-grandparent."
The depth of the most recent common ancestor is an **ultrametric**:
`d(X, Z) ≤ max(d(X, Y), d(Y, Z))`, and every triangle is isosceles with its
two longest sides equal.

- **Why here:** composition is exact when the two distances differ (the
  answer is the larger) and leaves a range when they are equal (anything up
  to that value). One rule decides whether the answer is settled at all,
  which is a cleaner version of the *Can't tell* lesson than any in the
  trainer today.
- Distances with branch lengths (additive tree metrics) satisfy Buneman's
  four-point condition (1971), the basis of phylogenetic reconstruction.
- **Material:** family trees, or a taxonomy of animals.

### 3.5 One-way relations — monoids

Groups make every premise reversible. Many real relations are not: "Red is
Blue's shadow at noon"; "Red is Blue rounded down to the hour"; a lift that
stops at the top floor. From `X = m·Y` you cannot get Y back, so information
flows one way, and *Can't tell* appears where a group would answer.

- **Material:** saturating arithmetic (the lift), or the 27 maps of three
  positions to themselves (the full transformation monoid T₃: "copy the top
  card onto the second").
- Green's relations in semigroup theory classify which elements can reach
  which: the monoid version of "linked". Inverse semigroups (partial
  bijections) cover "the place east of X, *if* it is on the board".

### 3.6 Mixed materials — groupoids and sheaves

Today one trial uses one group. A trial where Red is a pose and Blue is a
note needs arrows only between compatible kinds (a **groupoid**). Most
generally it needs a **cellular sheaf**: a space of values at each object, a
map on each premise, and the possible worlds as its global sections (Hansen
& Ghrist 2019; Robinson 2014). The current engine is the special case where
every object holds the same group and every map is a translation.

Sheaves also say *how* inconsistent a description is, not just whether: the
sheaf Laplacian's energy, or Robinson's consistency radius. That suggests a
graded "how far from possible is this?" task.

### 3.7 Noise — synchronisation

"Red is about five steps north of Blue." **Group synchronisation** (Singer
2011) recovers each object's element from noisy pairwise relations. Cryo-EM
uses it to align images of molecules, and robot mapping (pose-graph SLAM)
uses it to stitch odometry and loop closures into one map. For a trainer,
bounded noise is 3.2 and occasional outright errors are 2.1. Together they
are the realistic case.

### 3.8 Curved and twisted spaces — holonomy

The deepest generalisation of "every loop closes": spaces where it fails
even when every premise is true.

- **The surface of a cube.** Walk across the faces, carrying your facing
  over each edge. A small loop round a corner returns you turned a quarter:
  three right angles meet there, so a quarter turn is missing (the angle
  deficit). The eight corners' deficits total two full turns (Descartes'
  theorem, the discrete Gauss–Bonnet). Relations become **path-dependent**:
  "two ahead of Blue" says how to walk, and two routes to the same square
  can disagree about which way you end up facing. A natural rung after
  poses (`ℤ² ⋊ D₄`) for players who have mastered them.
- **Möbius and Klein-bottle boards.** Walk off an edge and come back
  mirrored, so a loop flips handedness. Poses already carry handedness.
- **The sphere.** The bear riddle (ten km south, ten east, ten north, and
  back where you started) is the classic loop that closes on a sphere and
  not on a plane.

In physics this is parallel transport, the geometric (Berry) phase and the
Foucault pendulum.

### 3.9 Locally fine, globally impossible — contextuality and impossible figures

Penrose's impossible triangle is a sound drawing at every corner and
impossible as a whole. Roger Penrose (1992) described it as a non-zero
class in first cohomology, the same obstruction *Possible?* asks about.
Abramsky and Brandenburger (2011) showed that quantum contextuality has the
same shape (every local view consistent, no global assignment), and
Abramsky et al. (2015) treat Liar-type paradox cycles the same way.

A concrete item: the **Mermin–Peres magic square**. Fill nine cells with +1
or −1 so that every row multiplies to +1 and the columns to +1, +1, −1. It
is impossible (the product of all nine cells would have to be both +1 and
−1), but drop any one of the six constraints and it can be done. *Checked.*
No local check finds the fault, which makes it the hardest kind of
*Possible?* item there is. It needs three-object premises (3.1).

### 3.10 Qualitative calculi

Relations taken from a fixed vocabulary, composed by table, answered as
sets. Allen's thirteen interval relations (1983) and RCC8 are already
Syllogimous modes. Two fit this trainer's materials:

- **OPRAₘ** (Moratz 2006): relations between *oriented points* at
  granularity m, the qualitative cousin of poses ("ahead-left of me, facing
  roughly towards me").
- **The double-cross calculus** (Freksa 1992): a three-place relation, where
  C is relative to the line from A to B. That is Levinson's (2003)
  "relative frame of reference" (viewer, figure, ground), the frame the
  trainer's perspective premises use.

The solver is path consistency. For Allen's relations it is incomplete in
general, because the full problem is NP-complete (Vilain & Kautz 1986), but
it is complete on the ORD-Horn subclass (Nebel & Bürckert 1995). A
"qualitative poses" task would bridge Syllogimous's set-valued modes and
this trainer's exact ones.

### 3.11 Tarski's relation algebra, for the record

The namesake, from De Morgan, Peirce and Schröder, axiomatised by Tarski
(1941): binary relations under union, intersection, complement, composition
(;), converse (˘) and identity. The engine already obeys two of its laws:
`(R;S)˘ = S˘;R˘` (undoing a composite reverses its order, the `order` lure)
and `R˘˘ = R`. The Schröder equivalences,
`(R;S) ∩ T = ∅ ⟺ (R˘;T) ∩ S = ∅ ⟺ (T;S˘) ∩ R = ∅`, are three ways of
stating one relational syllogism. They only become tasks when relations are
sets of pairs ("parent ; child" contains "sibling"), which is Syllogimous's
territory. Codd's relational algebra for databases (1970) descends from
it: a join is a composition and a projection is 2.6. Its value here is
vocabulary, not a material.

### 3.12 Beliefs — perspectives inside perspectives

"Blue thinks Red is two north of Gold; Gold thinks Blue is one step off."
Each agent holds its own model, and epistemic logic gives each agent an
accessibility relation (a Kripke structure). The modal axioms correspond to
properties of that relation: reflexive to T, transitive to 4, Euclidean to
5. Adults manage about fifth-order intentionality ("I think you believe she
wants…") before failing (Kinderman, Dunbar & Bentall 1998), which is a ready
ceiling to calibrate against. The trainer's perspective premises are first
order; nesting them across agents is new, and the hard part is phrasing it
cleanly.

---

## Part 4 — Already elsewhere in this repository

Not worth porting into Relation Algebra unless the point is to put them in
its notation:

| Concept | Where |
| --- | --- |
| Allen's interval algebra | Syllogimous, Interval Algebra |
| RCC8 (as the rectangle algebra) | Syllogimous, Region Connection |
| Rock–paper–scissors dominance | Syllogimous, Cyclic Dominance |
| Inferring a relation's properties | Syllogimous, Hidden Algebra |
| Ignoring directions (projection) | Syllogimous, Projection |
| Operations on relations | Syllogimous, Second-Order |
| Which premises were needed | Syllogimous, Minimal Premises |
| Graph isomorphism | Syllogimous, Graph Matching, Structure Match |
| Moves in a skewed basis | Syllogimous, Oblique Basis |
| Relational frames, stimulus functions | Syllogimous, Stimulus Function |

---

## Part 5 — What cognitive science says about difficulty, and about hope

- **Relational complexity** (Halford, Wilson & Phillips 1998): the load of a
  step is how many things must be related *at once*. Adults top out around
  four (a quaternary relation) unless the problem can be split
  (segmentation) or compressed (chunking). Its psychometric probe, the Latin
  Square Task (Birney, Halford & Andrews 2006), is fitting here: a Latin
  square is the multiplication table of a quasigroup, and every group's
  table is one. *Suggestion:* the level climbs by path length and nesting
  depth. Log, per item, the largest number of terms that must be combined
  in one step that cannot be split, and check from the records whether
  errors follow that more closely than path length.
- **Structure factored from content.** The Tolman–Eichenbaum Machine
  (Whittington et al. 2020) models the hippocampal formation as a code for
  structure (a group of actions, path-integrated) bound to a code for
  content. That is the trainer's "one engine, seven groups" stated as a
  theory of the brain. Grid cells have been modelled as representations of
  the group of translations (Gao et al. 2021). Bellmund et al. (2018) review
  the case that spatial codes organise thought generally.
- **Binding is a group operation.** In holographic reduced representations
  (Plate 1995), binding is circular convolution and unbinding its inverse.
  `rel(X, Y) = X·Y⁻¹` is, literally, an unbinding.
- **The honest caveat** the README already makes: none of this shows that
  practising group relations trains anything beyond itself. Large
  meta-analyses of working-memory training find near transfer and little
  or no far transfer (Melby-Lervåg, Redick & Hulme 2016). The Hidden groups
  of 1.12 and the transfer materials (Units after Space; Kinship after
  Orientations) are how this trainer could test its own hope on its own
  records.

---

## Part 6 — A suggested order

Ranked by what each adds against what it costs.

| # | Item | Kind | Cost | Why this early |
| --- | --- | --- | --- | --- |
| 1 | Which premise is false (2.1) | task | small: `altered` exists; one graph condition | the natural next question after *Possible?*, with an exact theory |
| 2 | Teams, Hex, Wrapping space (1.1–1.3) | materials | small each | new structure for almost no code; Teams needs either/or turned off |
| 3 | Ratios, then Through a lens (1.7, 2.6) | material + task | small, then medium | multiplicative reasoning; the comma is the best kernel example there is |
| 4 | Missing premise, Shortest code (2.2, 2.3) | tasks | small | backward chaining and chunking, on every material at once |
| 5 | n-back up to renaming (2.5) | task | small | structure without identity |
| 6 | Card stacks, Chords, Kinship (1.4, 1.5, 1.9) | materials | medium (notation, drawings, audio for chords) | three non-abelian groups with real content; Kinship is D₄ in disguise |
| 7 | Bounds (3.2) | solver | medium | the first step past exact values, and the 3-valued answers already fit |
| 8 | Linear premises (3.1) | solver | medium | midpoints, analogies as premises, flows, the magic square |
| 9 | Hidden groups (1.12) | material generator | medium | the transfer probe the README's hope needs |
| 10 | 3-D orientations (1.6) | material | large (3-D drawing) | intrinsic against extrinsic |
| 11 | Cube-surface poses (3.8) | solver | large: relations become paths | the most original item here; nothing else trains holonomy |

---

## Sources

**Computed for these notes** (`research/relation-algebra-checks.js`, which
uses the trainer's own `square` group where it applies):

- PLR and T/I: both dihedral of order 24, commuting; the orders of PL, PR
  and LR.
- Kariera gives the Klein four-group; the Aranda-type model gives D₄,
  isomorphic to the Orientations material, with MMBDD marriage.
- A false premise is locatable exactly when its objects keep two
  premise-disjoint routes without it (all 4,284 cases on four and five
  objects).
- 12-tone equal temperament sends the syntonic and Pythagorean commas and
  the diesis to zero.
- The cube's rotation group has order 24 and is non-abelian; in D₄, ab and
  ba differ by at most a half turn.
- The sexagenary cycle uses 60 of 120 pairs.
- The Mermin–Peres square is impossible, and minimally so.

**Found and checked in this pass:**

- Weil's appendix: [BnF, "Des lois du mariage"](https://bnf.fr/fr/mediatheque/des-lois-du-mariage-bourbaki) · [arXiv 2002.12813](https://arxiv.org/pdf/2002.12813)
- Crans, Fiore & Satyendra 2009, *Musical actions of dihedral groups*: [arXiv 0711.1873](https://arxiv.org/pdf/0711.1873)
- Khot, Kindler, Mossel & O'Donnell 2007: [paper](https://cs.nyu.edu/~khot/papers/maxcut.pdf)
- Whittington et al. 2020, the Tolman–Eichenbaum Machine: [PMC7707106](https://pmc.ncbi.nlm.nih.gov/articles/PMC7707106/)
- Constantinescu, O'Reilly & Behrens 2016: [PMC5248972](https://pmc.ncbi.nlm.nih.gov/articles/PMC5248972/)
- Hansen & Ghrist, *Toward a spectral theory of cellular sheaves*: [arXiv 1808.01513](https://ar5iv.labs.arxiv.org/html/1808.01513)
- Moratz 2006, OPRA: [Qualitative reasoning about relative direction](https://ar5iv.arxiv.org/html/1011.0098)
- Birney, Halford & Andrews 2006, the Latin Square Task: [Educational and Psychological Measurement 66, 146–171](https://hal-amu.archives-ouvertes.fr/hal-01772235)
- McConvell 2017, variation in Australian section systems: [Oceania](https://onlinelibrary.wiley.com/doi/abs/10.1002/ocea.5155)

**Cited from the literature but not re-checked in this pass:** Lewin 1987;
Harary 1953; Zaslavsky 1989; Khot 2002; Bulatov & Dalmau 2006; Bulatov
2017 and Zhuk 2017 on the CSP dichotomy; Goldmann & Russell 2002; Heider 1946; Cartwright & Harary
1956; De Soto 1960; Hafting et al. 2005; Johnson & Story 1879; Cohn 1998;
Shepard & Metzler 1971; Buckingham 1914; White 1963; Gentner 1983;
Rumelhart & Abrahamson 1973; Mikolov et al. 2013; Dechter, Meiri & Pearl
1991; Miné 2006; Carré 1971; Gondran & Minoux 2008; Mohri 2002; Wright
1922; Buneman 1971; Robinson 2014; Singer 2011; Penrose 1992; Abramsky &
Brandenburger 2011; Abramsky et al. 2015; Mermin 1990 and Peres 1990;
Allen 1983; Freksa 1992; Levinson 2003; Vilain & Kautz 1986; Nebel &
Bürckert 1995; Tarski 1941; Codd 1970; Kinderman, Dunbar & Bentall 1998;
Halford, Wilson & Phillips 1998; Gao et al. 2021; Bellmund et al. 2018;
Plate 1995; Melby-Lervåg, Redick & Hulme 2016.
