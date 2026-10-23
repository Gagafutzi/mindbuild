# Ribbon World

Shapes ride two loops that touch at a Gate. One loop has a half-twist: a flat
shape carried through it comes back as its mirror image, which is what a
Möbius strip does to anything living in it. The other has a turnstile that
turns shapes a quarter. At the Gate, one kind of shape crosses to the other
loop when the Gate is open: one hand, or (from level 5) the ones lying one
way. Everything is drawn flat: two bands, shapes of four or five squares, a
mark per fixture, a bar for a shut Gate.

## An episode

1. **Watch** a clip, as often as you like, until you know what each part does
   and who the Gate lets across. The clip is generated to be long enough that
   every fixture acts and only one Gate rule fits what the Gate did.
2. **Predict**, twice: where a shape will be, and which way round, the next
   (later: second, third) time it leaves the Gate. Four pictures; the wrong
   ones are the answers of particular mistakes: a fixture forgotten, a mirror
   taken for a half turn, the Gate's rule ignored, the wrong loop.
3. **Impossible**: four moments of a trip, each with the way it came. One
   frame was altered; it is the only one whose removal leaves a trip that
   could have happened.
4. **Fog**: a shape goes into fog over the Gate. Which loop is it on, and how
   sure? Sure when it was never the kind to cross; otherwise as sure as the
   Gate was usually open in the clip. Scored by Brier score, not accuracy.
5. **Analogy**: a world drawn differently (stacked belts, another shape, other
   marks). Same rules, or one structural change? Clockwise for anticlockwise
   is never the change, since mirroring the whole world swaps them.

There is nothing to count. The questions are answered by picturing the trip.

## Levels

Level 1 to 12, moved after every episode (4 of 4 up, 2 or fewer down):
three shapes from 3, the second exit from 4, half turns and a Gate that goes
by axis from 5, an extra fixture from 6, shorter clips and a faster pace from
7, four shapes from 8, unmarked fixtures from 9, the third exit and a second
extra fixture from 10, no flash when an unmarked fixture acts from 11.

## Files

- `world.js`: the engine (worlds, clips, questions, and their checks), page-free
- `trainer.js`, `trainer.css`: drawing and the episode, on the harness
- `harness/`: the Chimera harness, copied as it says to be
- `test/run.js`: `node apps/ribbon/test/run.js`
