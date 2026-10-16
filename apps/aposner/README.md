# aPOSNER

Paced auditory arithmetic with a four-way answer cross. A voice says a digit
at a steady pace; each new digit is combined, by the **+** or **−** in the
centre, with the digit heard **n** digits before it, and the answer is picked
from four tiles with the arrow keys, WASD/ZQSD, or a tap.

One page, no build step, nothing fetched from the network. Speech is the
browser's own synthesis.

## Speed

Three modes:

- **Bayesian** (the default). CCT's staircase with this task's guess rate: a
  posterior over T, the interval (log₁₀ ms) at which you score the target,
  on a grid from 150 ms to 8 s. One answer at interval x is right with
  probability `γ + (1 − γ − λ) · logistic(β(x − T) + c)`, with γ = 0.25 (four
  tiles), λ = 0.04, β = 10 per log₁₀ unit, and c set so the curve passes
  through the target at x = T. Before each update the log-posterior is scaled
  by `1 − 1/memory`, so the estimate rests on roughly the last `memory`
  answers. Each digit is placed at the posterior mean, moving at most 15%.
- **Streaks**: n right in a row → faster, n wrong → slower, by a fixed step.
- **Manual**: − / + during play.

## Level

A second posterior runs in every mode at a fixed 80%, so the level a session
records does not depend on the controller or the target. As in CCT, the level
is answers a minute at the best 80% threshold of the session (once it has 20
answers), times `1 + log₂ n` for the depth held.

## Record

Sessions are written in the Chimera record format
(`../relations/harness/FORMAT.md`) under `chimera.aposner.record.v1`, which is
what the hub's meter, the archive and the gate read — no adapter of its own.
Trial logs are kept on the five latest sessions; a three-hour session is
thousands of answers. `test/sample-record.json` is a real one, trimmed.
