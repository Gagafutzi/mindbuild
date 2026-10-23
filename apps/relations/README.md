# Relation Algebra

Nested relations, combined in your head. The same task works in seven
materials: places on a grid, numbers, notes, days of the week, compass
headings, a tile's orientation, and poses (place, facing and handedness
together). From level 21, premises can be either/or. Routes on a cube walk
the poses over a cube's surface, where going round a corner turns you. Glued
spaces walk them over fields whose edges are joined straight, with a twist
(which mirrors whatever crosses, as a Möbius band does), or onto a second
sheet: a new space every trial, and six kinds of question about it.
Inspired by IMAGI-WORLD, a structure
n-back of spoken spatial premises; rebuilt so the answer depends on what a
sentence means, never on its wording.

## What it trains

Relational integration: combining several relations, some of them nested,
into one model, and reading answers off it. Each trial describes objects
(Red, Blue, Green, Gold, Violet, White) by how they relate:

- **Plain:** "Gold is two steps north of Red."
- **Nested:** "The place one step east of Gold is north of the place two
  steps west of Red." Both sides are places built from an object.
- **Marks:** the same thing as definitions, "Let P be the place one step east
  of Gold."
- **Perspective:** "Standing at Blue and facing west, Red is two steps ahead
  and one to the left."

**Tasks:**
- **Questions:** "Is Gold one step south-east of Violet?" Yes, No, or Can't
  tell when nothing links the two.
- **Possible?** Can every premise be true at once?
- **How far?** Steps apart, along the grid or in king's moves.
- **Structure n-back:** is this the same arrangement as the one n
  descriptions back? It usually comes back worded quite differently, and
  optionally turned (up to rotation).
- **Routes on a cube:** poses walked on the surface of a cube, where a walk
  is no longer a fixed relation (below). Which walks bring Red home? Can a
  loop of walks close? Does a walk take Red to where another object stands?
- **Glued spaces:** a field whose edges are joined, drawn with its seams,
  a new one every trial. Where does a walk end? Is Red home, back but
  mirrored, back but turned, or away? Where are things that drift by a
  velocity after k ticks, and do two ever meet? Which field is it, from walks
  seen in it? Can a loop of walks close? As Blue is to Red, which pose is to
  Gold? (Below.)

## Sessions and rounds

A session is a run of **rounds** and lasts as long as you set: 10, 15, 20,
30 or 45 minutes, or 1, 1½, 2, 3, 4 or 5 hours. A round is a set number of
trials (4 to 100, 12 by default) of one task in one material.

- **Task** and **Material** can each be fixed or set to change every round.
  With both changing, one round in nine is routes on a cube and one in nine
  glued spaces, and every other task comes up in every material within 36
  rounds (How far? asks a question instead in the four materials with no
  distance). Choosing routes as the task, or the cube as the material, chooses
  both; so does choosing spaces or the glued field. A session picks up the rotation
  where the last one stopped.
- **The level moves after every round**, not just at the end of the session.
- **Any level can be played without earning it.** Settings → Level picks one;
  unless **Hold the level** is on, it moves from there as usual and becomes
  yours. Held, it stays put for the whole session and your earned level is
  left as it was.
- **Benchmark rounds** (off, every 5th or every 10th round): a round of glued
  spaces at one fixed level (Benchmark level, 12 by default), in fresh items,
  that never moves the level and does not use up a place in the rotation.
  Marked `⊙` in the round summary, and `bench` in the record.
- **Long sessions are saved as they go.** Every trial is checkpointed. If
  the tab is closed or crashes, the next time the page opens the unfinished
  session is filed in the record, marked as not completed, and its level is
  kept.
- Between rounds a line sums up the round and names the next one.
  The next round starts after 8 seconds, or straight away on Space.

## Compact notation

By default every text is in a short code that has to be learnt. It is not
meant to be guessed: write this table down, or keep the Chimera Hub guide
open, until it reads like words. Set **Text** to *Words* to have every
premise written out instead.

**Objects:** R Red, B Blue, G Green, **O Gold**, V Violet, W White.

**A premise is an equation.** Each side is a *term*: an object, then moves
applied to it. `R6=B4488` says "one east of Red is two west and two north
of Blue".

| Material | A move is written | Example |
| --- | --- | --- |
| Space | one keypad digit per step | `R=B99` Red is two steps north-east of Blue |
| Numbers | a signed step | `R+2=B−7` |
| Notes, days, headings | a signed step that wraps; the first line names the modulus (`mod 12`, `mod 7`, `mod 8`) | `mod 8` / `R=B+3`: a heading three 45° steps clockwise of Blue's |
| Orientations | one letter per operation, applied left to right | `R=Bmq` Red is Blue mirrored, then turned a quarter right |
| Poses | a walk from the other object, in the walker's own frame: `^ v < >` a step ahead, back, left, right; the orientation letters turn or mirror the walker | `R=B^^<q` start at Blue, two ahead, one left, turn a quarter right: that is Red |

**Space digits**, laid out as on a keypad:

```
7 8 9      7 north-west  8 north  9 north-east
4 · 6      4 west                 6 east
1 2 3      1 south-west  2 south  3 south-east
```

**Perspective:** `R=B@2<<` reads "standing at Blue facing 2 (south), Red is
two steps to the left". After `@` and a facing digit:

- `^` ahead
- `v` behind
- `<` left
- `>` right

**Orientation letters:**

- `q` a quarter turn right, `Q` a quarter turn left, `h` a half turn;
- `m` mirror left-right, `M` mirror top-bottom;
- `d` flip on the rising diagonal, `D` on the falling one.

Order matters here: `mq` is not `qm`.

**Poses** put the grid and the orientations together. Each object stands
on a square, faces north, east, south or west, and may be mirrored (its left
and right swapped). A relation is a walk from the other object, read left to
right in the walker's own frame:

- `R=B^^<q`: stand where Blue stands, facing Blue's way; two steps ahead, one
  step left, turn a quarter right. That is where Red stands and how it faces.
- Every turn changes what "ahead" means for the steps after it, so `^q` (a
  step, then a turn) is not `q^` (a turn, then a step).
- `R=B` alone means Red stands exactly where Blue does, facing the same way.

**Either/or** premises come in at level 21: `R=B(6|9)` says Red is either
one east or one north-east of Blue, and only one of them is true. A question
is then answered over every reading of the either/or premises that still
holds together:

- `=` when every such reading gives the asked relation (the either/or is
  off the path, or another route through the premises rules one option out);
- `≠` when none does;
- `?` when some do and some don't.

In *Possible?*, the premises are possible when some choice of readings makes
every loop close.

**Marks** name places, so a long nested term can be built in steps:
`P=R6`, then `B=P88`. Mark letters are P S T U X Y Z A C E F J K L N; after
the fifteenth they double (PP, SS, …). A mark never contains a digit or a
lower-case letter, so it can't be mistaken for a move.

**Routes on a cube** are poses walked over the surface of a cube of two or
three squares a side; the first line says which, `cube 2`. One object is
placed: `R=⊤9@6` is Red on top (`⊤`), in square 9 (the keypad, north up; on a
cube of two the squares are 7 9 above 1 3), facing 6 (east). Walks are the
poses code without mirrors, `^ v < >` steps and `q Q h` turns, and a premise
reads as it does in poses: `B=R^^q^` is where Red ends after the walk, facing
the way Red then faces.

- A step off an edge carries on down the next face, and the facing tips over
  the edge with the walker: walking east off the top, you face down the east
  side.
- Three squares meet at each corner where four would on a flat grid, so a
  walk round a corner comes back turned. `^Q^Q^` from the north-east square
  facing east ends on the same square facing south. Straight round the
  middle, 8 steps on a cube of two or 12 on a cube of three, comes back facing
  the same way.
- So a walk is not a fixed relation: what `^^q` does depends on where it
  starts, and the premises have to be walked.

| Code | Asks | Answers |
| --- | --- | --- |
| `R⌂?`, after four walks `1 …` to `4 …` | Which walks bring Red back to its square, facing the way it began? | select every one (1–4), then `»` |
| `R^Q^Q^⌂?` (eyes closed) | Does this walk bring Red home? | `⌂` home, `↻` back but turned, `→` away |
| `∃?` | Can this loop of walks close? | `∃` possible, `∅` impossible |
| `G=R^^q?` | Is Gold where this walk takes Red, facing Gold's way? | `=`, `≠`, `?` |

**Glued spaces** are poses walked on a field of squares whose opposite edges
are joined. The first line is the field: `▦5×4 x⋈ y○` is five columns (a to
e, from the west) by four rows (1 to 4, from the south), its east and west
edges joined with a twist, its north and south edges straight.

- `○` **straight**: off the east edge, on at the west in the same row.
  Both seams straight make a torus.
- `⋈` **twisted**: off the east edge in row 1 of 4, on at the west in row 4,
  and **mirrored**: the walker's left and right swap, so its later `<` and
  `>` steps, and its `q` and `Q` turns, go the other way. One twisted seam
  makes a Klein bottle, two a projective plane.
- `⁺` on a seam: crossing it also goes onto the other of two **sheets**, the
  same field again (from level 10; twisted as well from 18).

Poses are written as squares: `R=c2@6` is Red on c2 facing east (6 on the
keypad); `c2⁺@6m` is on the second sheet, mirrored. On screen the field is
drawn as topology draws a glued square: arrows on joined edges, the same way
round for a straight seam and opposite ways for a twist, one arrowhead east
and west, two north and south; a seam onto the other sheet is dashed, and the
second sheet is drawn beside the first. The question shows where things
stand, never a path.

The six kinds take turns, trial by trial, and every trial draws its own field:

| Code | Asks | Answers |
| --- | --- | --- |
| `R^^q^⌖?`, after four poses `1 …` to `4 …` | Where does Red end? | 1–4 |
| `R^^q^⌂?` | Where does the walk leave Red? | `⌂` home, `⇋` back but mirrored, `↻` back but turned, `→` away |
| `R=b2→9` … `R+3t⌖?` | Red moves one step north-east each tick (`→99` two steps); a twisted seam mirrors the velocity too. Where is Red after 3 ticks? | 1–4 |
| `R⋂B≤4t?` | Do Red and Blue land on the same square within 4 ticks? `→(6\|9)` is one of two velocities (from level 21) | `=`, `≠`, `?` when it depends on the velocity |
| `a2@6 ^^^^ ⇒ a3@6m` … `▦?` | Walks seen in an unknown field, and where they ended: which field is it? | 1–4 |
| `∃?` | Can this loop of walks close? | `∃` possible, `∅` impossible |
| `B=a1@4 =R^^q^` … `R:B=O:?` | Blue is Red walked so. Which pose is Gold walked the same way? | 1–4 |

The last is an analogy, and its trap is the obvious one: the offset Blue has
from Red on the page, copied onto Gold. The relation is the walk, made in
Gold's own frame and over Gold's seams; Red's walk never meets a seam, and
Gold's always does.

**Questions and answers:**

| Code | Asks | Answers |
| --- | --- | --- |
| `R=B6?` | Is this true? | `=` it must be, `≠` it can't be, `?` not settled (nothing links them, or it depends on how an either/or is read) |
| `∃?` | Can every premise be true at once? | `∃` possible, `∅` impossible |
| `\|R−B\|₁?` | Steps apart along the grid (or by number) | the distance |
| `\|R−B\|∞?` | Steps apart in king's moves | the distance |
| `≡3?` | The same arrangement as 3 back? | `≡` same, `≢` different |
| `≅3?` | The same up to rotation? | `≡` same, `≢` different |
| `⊢1/3` | Hold this: the first of the 3 before scoring starts | `»` go on |

**Explanations** start with ✓ or ✗ and the true relation (`≠ · O=B7`). `⇒`
opens each premise reduced to a single move. The trap the offered answer
belongs to is a symbol:

| Symbol | Trap |
| --- | --- |
| `∅n` | nesting ignored |
| `−L`, `−R` | the left or right side's moves dropped |
| `±` | wrong sign |
| `⇄` | composed in the wrong order |
| `@8` | perspective read as if facing north |
| `±1` | one step off |
| `↻`, `↻↻`, `↺` | turned a quarter, half way, a quarter back |
| `⇋`, `⇅`, `⤡` | mirrored east-west, north-south, on a diagonal |
| `⁻¹` | undone instead of done |
| `m·m` | seen in a mirror |
| `−` | reversed |
| `⇆` | two objects swapped (n-back) |
| `∅q` | (poses) the turn left out |
| `q→` | (poses) turned before stepping instead of after |
| `≠` | a new arrangement (n-back) |
| `▭` | (cube) the cube read as a flat grid |
| `↻⌂` | (cube) back on the square, but turned |
| `q⇄Q` | (cube) a turn the wrong way |
| `○` | (spaces) every seam read as straight |
| `∅m` | (spaces) the square and facing mirrored at a twist, the walker not |
| `∅⁺` | (spaces) the change of sheet missed |
| `∅v` | (spaces) a drifting position mirrored, its velocity not |
| `±t` | (spaces) one tick too few or too many |
| `⧉` | (spaces) the page offset copied instead of walked |
| `∓m` | (spaces) mirrored once too many or too few times |

The round summary reads `#3 · 75% · L4→5 · → nback/days · 41m`: round 3,
75% right, level 4 to 5, next round structure n-back in days, 41 minutes
left.

## Glued spaces: what they are for, and what is known

**What it aims at.** Holding a spatial model and carrying it through
transformations that break flat intuition: telling a mirror image from a
rotation, keeping a frame of reference (the walker's left) through a change
that reverses it, composing moves along a path when the result depends on the
path, and finding the rule of a space from what happens in it. Each twist a
walk crosses adds one more thing to carry (the walker's hand) to everything
after it, which is relational load in Halford's sense (Halford et al., 1998).

**What supports it.** Spatial skills are trainable: a meta-analysis of 217
training studies found reliable gains (g ≈ 0.47) that lasted and carried over
to untrained spatial tasks (Uttal et al., 2013). People do learn spaces that
are not Euclidean: in virtual worlds with wormholes, navigation shows
knowledge organised as a graph of places and links rather than a metric map
(Warren et al., 2017); glued fields ask for the links and the metric
together. The space kind is system identification, as in complex problem
solving (Greiff et al., 2012); transfer is structure mapping, a relation
carried from one object to another (Gentner, 1983).

**What is not known.** Whether practising this improves anything beyond
spatial tasks close to it. Training studies of working memory and brain
training find gains that mostly stay with the trained task (Melby-Lervåg et
al., 2016; Simons et al., 2016). That this mode reaches further is a
hypothesis; the record is built so it can be tested.

**How it is built to be a fair test of the skill.**

- *No answer without the reasoning.* A four-way choice whose wrong options
  are made from mistakes clusters round the truth, and test-wise strategies
  then beat chance without a step walked: in an early version, "pick the
  mirrored option" scored 53% and "pick the most typical one" 44%. The
  options are now chosen against that (a hand split two and two, the truth
  mirrored half the time, its typicality drawn by lot), and
  `test/spaces.test.js` holds five such strategies to chance (20–31% over
  1,200 trials each), as item-writing guidance asks (Haladyna et al., 2002).
- *The twist has to matter.* In most home, possible and meet items, reading
  every seam as straight gives the wrong answer (the rest are controls); the
  tests hold that share at least to half. Answers are balanced: each home
  answer a quarter of the time, possible and meet about half and half.
- *Every answer is checked* against its own givens, by the tests, at every
  level.
- *Wrong answers are diagnostic.* Each is a named mistake (`○ ∅m ∅⁺ ∅v ±t ⧉`),
  and the record counts which ones catch you.
- *Difficulty is recorded, not just the level.* Every spaces trial logs its
  features (moves, turns, seams, twists and sheets crossed, moves made while
  mirrored, field size, ticks, movers, observations), so which of them costs
  accuracy and time can be fitted to one's own trials.
- *Progress apart from the moving level.* The training level rises as you
  improve, so accuracy on it stays near the same; benchmark rounds at a fixed
  level are the curve that shows change.

**Testing it on yourself.** Before starting and every few weeks: an untrained
spatial test (mental rotation; paper folding from the ETS kit, Ekstrom et
al., 1976) and an untrained non-spatial reasoning test; keep benchmark rounds
on. Gains on the benchmark alone show learning the task. Gains on the
untrained spatial tests show near transfer. Gains on the non-spatial one, if
any, would be the interesting result. Better still, alternate training blocks
with blocks without it, so a change can be told from a trend.

**References**

- Ekstrom, R. B., French, J. W., Harman, H. H., & Dermen, D. (1976). *Manual
  for kit of factor-referenced cognitive tests*. ETS.
- Gentner, D. (1983). Structure-mapping: a theoretical framework for analogy.
  *Cognitive Science*, 7(2), 155–170.
- Greiff, S., Wüstenberg, S., & Funke, J. (2012). Dynamic problem solving: a
  new assessment perspective. *Applied Psychological Measurement*, 36(3).
- Halford, G. S., Wilson, W. H., & Phillips, S. (1998). Processing capacity
  defined by relational complexity. *Behavioral and Brain Sciences*, 21(6).
- Haladyna, T. M., Downing, S. M., & Rodriguez, M. C. (2002). A review of
  multiple-choice item-writing guidelines for classroom assessment. *Applied
  Measurement in Education*, 15(3), 309–333.
- Melby-Lervåg, M., Redick, T. S., & Hulme, C. (2016). Working memory training
  does not improve performance on measures of intelligence or other measures
  of "far transfer". *Perspectives on Psychological Science*, 11(4), 512–534.
- Simons, D. J., et al. (2016). Do "brain-training" programs work?
  *Psychological Science in the Public Interest*, 17(3), 103–186.
- Uttal, D. H., et al. (2013). The malleability of spatial skills: a
  meta-analysis of training studies. *Psychological Bulletin*, 139(2),
  352–402.
- Warren, W. H., Rothman, D. B., Schnapp, B. H., & Ericson, J. D. (2017).
  Wormholes in virtual space: from cognitive maps to cognitive graphs.
  *Cognition*, 166, 152–163.

## How difficulty is measured

One level, 1 to 30. It moves up a step after a round at 80% or better and
down after one under 60%. The level sets:

| Level | Objects | Nesting per side | Steps | Also |
| --- | --- | --- | --- | --- |
| 1–2 | 3 | none | 1 | |
| 3–6 | 3–4 | 1 | 1–2 | perspective from 3; offsets on both sides from 4; diagonals from 5 |
| 7–12 | 4–5 | 2 | 2–3 | two-part moves ("two north and one east") from 10; a second loop in Possible? from 10 |
| 13–20 | 5–6 | 3 | 3 | |
| 21–30 | 6 | 3 | 3 | as level 20, plus either/or premises: 1 at 21–23, 2 at 24–26, 3 at 27–29, 4 at 30; one extra link (21–25) or two (26–30) that may settle them |

In structure n-back, n is 1 at levels 1–5, 2 at 6–10, 3 at 11–15, 4 at
16–20 and 5 from 21. Its descriptions are never either/or: a match has to be
decidable.

The questions always ask about the two objects joined by the longest chain of
premises, so higher levels mean combining more of them.

Routes on a cube read the same level their own way:

- the cube has two squares a side below level 16, and three from 16;
- the moves are `^ q Q` from level 1, then `h v` from 5 and `< >` from 9;
- a home walk is 4 to 8 moves at level 1, growing to 7 to 15 at level 30, and
  each premise's walk 2 to 3 moves, growing to 6;
- a loop holds 3 objects to level 8, 4 to level 18 and 5 above it; a chain
  in "does it reach?" has one premise fewer.

Glued spaces read it their own way too:

- fields are 4×4 below level 8, 4 or 5 a side to 15, 5 or 6 from 16;
- below level 6 exactly one seam is twisted, from 6 either or both; from 10
  a seam may lead onto a second sheet, and from 18 a twisted one may;
- the moves arrive as on the cube (`h v` at 5, `< >` at 9); walks run 3 to 6
  moves at level 1 and up to 6 to 11 at 30;
- drift has two movers below level 12 and three from it, velocities of two
  steps a tick from 14, and either/or velocities from 21; it runs 2 to 3
  ticks at level 1, up to 5 to 8 at 30;
- every walk asked about crosses a seam that matters (a twist or a sheet),
  and a home walk never comes back over its own squares, which would bring it
  home on any field.

Eight moves is the floor for home walks because the smallest loop that closes
on a flat grid, `^Q^Q^Q^Q`, is eight moves; below it there is no flat trap to
offer. Before back steps arrive, a premise stated the other way round undoes
its walk by turning round, walking it backwards and turning round again.

## Controls

- **F:** Yes / Same / Possible (`=`, `≡`, `∃`).
- **J:** No / Different / Impossible (`≠`, `≢`, `∅`).
- **K:** Can't tell (`?`).
- **1–4:** the options in How far?; in routes' home trials, select or
  unselect a walk, then Space to hand the selection in.
- **Space:** go on (`»`).
- **Escape:** pause.

After a mistake (or always, if you set it), the answer is worked through:
- the true relation;
- which mistake the offered answer belongs to;
- each premise reduced to what it means;
- a drawing of the arrangement.

**Feedback sound** (a high tone when right, a low one when wrong) can be
turned off in Settings.

**Play** sets how a trial reaches you:

- **On screen:** read it.
- **On screen, read aloud:** read it and hear it.
- **Eyes closed (audio only):** hear it, and answer without looking (below).

## Eyes closed

Every premise and question is spoken in the spoken code (below), and the
whole screen under the bar becomes the answer pad:

| Answers | Pad | Keys |
| --- | --- | --- |
| 1 (go on) | anywhere | Space |
| 2 | left half, right half | F, J |
| 3 | left, middle, right: yes, can't tell, no | F, K, J |
| 4 | quarters: 1 2 above 3 4 | 1–4 |

- The phone buzzes on every touch, and the screen is kept on while the
  session runs.
- Two soft rising notes mean the question comes next. The answer is timed
  from the end of the question.
- How far? says its choices after the question, smallest first, in pad order.
- Routes' home trials are one walk by ear, with three answers: left home,
  middle back but turned, right away.
- Each round opens with its number, task and material ("Round 3. n-back,
  days, 2 back."). It closes with the score, the level and the minutes left,
  then goes straight on.
- Mistakes are explained in a few words: "Wrong. No. Red is Blue nine. Trap:
  one step off." Set Explain to *Always* to hear every answer explained.
  With Feedback sound off and Explain on *After mistakes*, a right answer is
  silent.
- **Speech rate** (0.8× to 1.75×) and **Silence between premises** (none to
  1.5 s) set the pace.
- Escape or Pause stops the voice. Resuming says the interrupted line again.

The voice is the most natural one the device has: voices named Natural or
Neural first, then Premium or Enhanced, then Google's, then the default.
On Windows that means Edge's or Windows' natural voices. On Apple devices,
download an Enhanced or Premium voice in the system's speech settings. On
Android, the Google voices are used. Without any speech engine, the trial
is shown on screen instead.

## The spoken code

The compact code said word for word, with words that are hard to mix up
by ear. Every spoken line stands for exactly one written line; the tests read
each one back.

| Written | Spoken |
| --- | --- |
| `=` | is |
| `R B G O V W` | Red, Blue, Green, Gold, Violet, White |
| space digits | the digit as a word; a run of 2 is *double*, 3 *triple*, 4 *quad*, more "*n* times" |
| `@4` | face four |
| `^ v < >` | front, back, left, right (runs as above; in poses, the steps of the walk) |
| `+n`, `−n` | up *n*, down *n* |
| `q Q h` | clock, counter, half |
| `m M d D` | mirror, flip, rise, fall |
| `mod 12` | mod 12 |
| marks `P S T U X Y Z A C E F J K L N` | Fox, Jar, Key, Lamp, Moon, Nest, Oak, Pond, Rope, Sun, Tent, Cup, Drum, Hat, Kite; a doubled letter adds *big* (`PP` is "big Fox") |
| `R=B(6\|9)` | Red is Blue either six or nine |
| `R=B6?` | Is Red Blue six? |
| `∃?` | Possible? |
| `\|R−B\|₁?`, `\|R−B\|∞?` | Red to Blue, grid? / king? (numbers: "Red to Blue?") |
| `≡2?`, `≅2?` | Same as 2 back? / Same as 2 back, any turn? |
| `⊢1/2` | Hold, 1 of 2 |
| `cube 2` | cube two |
| `R=⊤9@6` | Red is top nine, face six |
| `R^Q^Q^⌂?` | Red front counter front counter front. Home? |

Examples:

- `W1166=B666944` is "White double one double six is Blue triple six nine
  double four".
- `V=W@6vvv<<<` is "Violet is White face six triple back triple left".
- `W+5=O+1−5` is "White up 5 is Gold up 1 down 5".
- `R=BQdmm` is "Red is Blue counter rise double mirror".
- `R=B^^<q` is "Red is Blue double front left clock".

## The mathematics, and what each part does here

- **Points and vectors (affine space).** Objects and places are points;
  relations are vectors. The generator only ever writes point = vector +
  point, so every sentence is well-formed. Nested phrases branch to the right
  only ("the place … of the place … of Red"), so they can be followed by ear.
- **A premise is an equation.** "The place a of X is r of the place b of Y"
  means X + a = Y + b + r, so X − Y = b + r − a. The generator picks the
  world first and solves for r. It keeps a premise only when r can be said
  and the nesting changes the answer.
- **Free paraphrases.** These follow from commutativity, inverses and
  scalars: "north of X" is "X is south of …"; steps come in any order; a
  step and its reverse cancel. A match in n-back is the same arrangement
  described afresh, so remembered wording doesn't help.
- **Graphs.** Premises link objects. The answer is the sum of relations
  along a path, and the path's length is how many premises must be combined.
- **Loops (Kirchhoff).** Going round any loop must bring you back to where
  you started. *Possible?* rounds contain loops, and an impossible one has a
  single premise that breaks a loop.
- **Rank.** When a premise on the path is missing, the two objects aren't
  linked, and the answer is *Can't tell*. The objects are split into two
  groups of at least two, so the gap has to be noticed, not seen.
- **Symmetry (D₄).** The square's rotations and reflections give the n-back
  lures: turned, mirrored, flipped. "Up to rotation" makes turning count as
  the same.
- **Clock arithmetic.** Notes wrap at the octave (ℤ₁₂), days at the week
  (ℤ₇), and headings in 45° steps (ℤ₈). "Four semitones above" is "eight
  below".
- **Change of basis.** Perspective premises are rotations of the frame:
  ahead and right turned into compass directions.
- **Non-commutative composition.** Orientations (the group D₄) are where
  order matters: "turned a quarter right, then mirrored" is not "mirrored,
  then turned a quarter right". The lure is the same steps in the wrong
  order.
- **Semidirect product (poses).** A pose is a place and an orientation,
  ℤ² ⋊ D₄: the grid's own group of moves, turns and mirrors. Composing two
  walks turns the second by the first's orientation, which is why a step
  after a turn goes somewhere else than a step before it. Every relation is
  seen from the other object, so every premise is a change of frame. The
  lures are the mistakes particular to it: the walk seen from the wrong end,
  left and right swapped, the turn left out, the turn taken before the steps.
- **Curvature and holonomy (routes on a cube).** On a flat grid the poses
  are a group, so a walk is the same relation wherever it starts, and a loop
  that closes on paper closes anywhere. A cube's surface is flat everywhere
  but its eight corners, where a quarter turn of angle is missing (three
  right angles meet where a plane has four). A walk carried round a corner
  comes back turned by that quarter, round two corners by a half, and round
  four by a whole turn, which is no turn at all. The eight missing quarters
  total two full turns: Descartes' theorem, the discrete Gauss–Bonnet. So on
  the cube a walk is a path, not a group element, and premises can only be
  combined by walking them. The lure in every routes trial is the flat-grid
  answer, the one the algebra gives.
- **Sets of readings (either/or).** An either/or premise is two equations,
  one of them true. The engine tries every combination, keeps those whose
  loops all close (Kirchhoff again), and asks what all of them agree on. A
  loop through other premises is what can settle an either/or: only one of
  its readings fits.
- **One engine, seven groups.** The equations, paths, loops, lures and
  matching are written once for any group. Space, numbers, notes, days,
  headings, orientations and poses are only different groups. A different material
  each round (Material: "A different material each round") holds the
  operation constant and varies the material.
- **Lures are the answers of particular mistakes.** The wrong answers
  offered are what you'd get by:
  - ignoring the nesting;
  - dropping one side's offsets;
  - applying offsets with the wrong sign;
  - composing the steps in the wrong order;
  - reading a perspective premise as if facing north;
  - being one step off;
  - mirroring or turning the true answer.

  Each session records how often each trap was seen through.
- **Cognitive maps (a hope, not a finding).** Animals track position by
  adding displacement vectors (path integration). Some researchers argue the
  brain's spatial maps also hold abstract relations (Behrens et al., 2018).
  That is a reason to think vector composition might train something general.
  It is not evidence that it does.

## Files

- `algebra.js`: the engine. Groups, terms, premises, the solver, lures and
  tasks; no page code.
- `test/algebra.test.js`: `node apps/relations/test/algebra.test.js`. About
  180,000 checks across every material and level, 1 to 30:
  - the group laws;
  - every premise solves to the truth;
  - every answer and n-back target is right;
  - every sentence is clean;
  - every line of compact notation, parsed back, is true of the world;
  - every spoken line reads back to its written line;
  - the poses walk the right way (step then turn is not turn then step);
  - every either/or answer, checked by brute force over every reading.
- `routes.js`: routes on a cube. The walker (a step over an edge carries
  the facing with it), walks as strings (undone, normalised, read on a flat
  grid), shortest walks, the three trials, their code, words and spoken lines,
  and the cube's net for drawings; no page code.
- `spaces.js`: glued spaces. The field and its seams, the walker across them
  (a twist mirrors the square, the facing and the walker), drift by
  velocities, shortest walks, the six trials and their lures, their code,
  words and spoken lines; no page code.
- `test/spaces.test.js`: `node apps/relations/test/spaces.test.js`. About
  17,750 checks: once round a straight seam is home, once round a twisted
  one is the mirrored row mirrored and twice is home, the middle row of an
  odd field comes back on its own square mirrored, a mirrored walker's left
  is its old right, a sheet seam changes sheet and twice changes back, every
  walk undone comes home on every kind of field, and every trial of every
  kind at every level has the answer its own givens give (the possible loop
  walked premise by premise, the space options each tried against every
  observation, the drift runs replayed); and that no answer comes without the
  reasoning: five test-wise strategies held to chance over 1,200 trials each,
  answers balanced, and the straight-seam reading wrong in most items.
- `test/routes.test.js`: `node apps/relations/test/routes.test.js`. About
  218,000 checks:
  - the walker stays on the cube, on squares' centres, facing along the face;
  - every walk undone comes back, and normalising a walk changes nothing;
  - the facts the mode rests on: round a corner a quarter turn; round an
    edge with two right turns, and round the middle with none, no turn;
  - turning or mirroring the whole cube turns or mirrors every walk (all 24
    rotations, and left for right);
  - on one face the cube is the flat grid, and the flat grid is the
    trainer's own pose group;
  - every trial at every level, read back from the code it shows by a reader
    that knows nothing of how it was made, has the trial's answer; every flat
    trap is one the flat-grid reading gets wrong; and no walk uses a move the
    level has not reached.
- `trainer.js`: the page, on the hub's harness: rounds, checkpoints,
  explanations and drawings (for routes, the cube unfolded with each walk on
  it).
