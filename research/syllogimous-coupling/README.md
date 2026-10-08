# Cross-dimensional coupling for Syllogimous — build plan

Syllogimous's composed spaces (Direction 2D, Space 3D–7D) keep every axis
independent: each premise moves one axis, so any question splits into one
small problem per axis. The rungs below make two or more axes meet in the
reasoning itself, so solving them one axis at a time gets the item wrong.

A design panel wrote twelve proposals and a judge tried to split each one
back into per-axis problems. Ten survived as truly coupled. Two did not:
Turned Frames is relabelling per speaker, and Helix is one time axis read in
two units. Neither is built.

**Status (2026-10-08): nothing below is built yet.** This folder is the
hand-off. It holds:

- `designs.md` gives every proposal in full: idea, worked example, where it
  plugs in, solver, lures, pricing, and the judge's verdict and **binding
  fixes**.
- `designs.json` is the same content as raw data.
- `prototypes/` holds the plain-JS prototypes and the judge's scripts. Run
  them with `node` from their own folder. The two `.ts` "shadow" harnesses
  import the real engine from `/home/user/mindbuild/apps/syllogimous`.

## First, three prerequisite fixes

Each was confirmed independently of the proposals.

1. **Facing and mirror-twins are charged but never delivered** once analogy is
   held. In `fillNdConclusion` (`generators/ndspace.ts`), the facing branch
   comes after analogy, checkpoint, construct and choose. Measured: 300/300
   items carry a facing premise through `testimony`, and 0/300 from `analogy`
   on. Deliver them, and charge only when delivered. Add a regression test.
2. **`ONE_STEP_NOTE` must always show.** It currently shows only when
   constructDistance is on (`ndSetup`). Bridges, Walking Totals and the shear
   all depend on magnitudes.
3. **Fork the ladder per mode family as frozen literal copies**, never
   `[...ND_LADDER, ...]`: Direction, Space 3D, Space 4D–7D. Each fork starts
   as an exact copy of today's `ND_LADDER` (`utils/progression.utils.ts`) so
   saved progress keeps its meaning. Ladders are append-only.

## The integration pattern every rung uses

Pass the literal, per-axis reading as `initial` through `pairBites` and
`analogyBites`, so that every conclusion form, analogy included, needs the
coupling. A new conclusion branch added after analogy is never reached. Price
each rung in `RUNG_COST` / `DIALS` (`utils/ability.utils.ts`), expose it in
`ndFeatures()`, and charge only when the coupling is actually delivered.

Each rung needs tests for:

- solver correctness against brute force;
- delivery at the rung;
- **the per-axis reading failing** on a meaningful share of items;
- rendering.

## Build order

| # | Feature | Rung id(s) | Forks | Notes |
| --- | --- | --- | --- | --- |
| 1 | Bridges | `bridges` | all three | One axis's gap equals another's (any two straight axes). Exact by Gaussian elimination. Adds the `NdCoupling` / `closeAxes` layer that 5 and 6 reuse. `determinedOn` and `indeterminatePairs` must read `closeAxes`. |
| 2 | Clocks shear | `local-clocks` | 4D–7D | Galilean shear τ = t + x, with a barge-drift variant. Absorbs the "Local Clocks" proposal as its date-line variant. Mark it per premise so it cannot telescope. |
| 3 | Light Cone | `cone`, `signals`, `reach` | 4D–7D | Time is a taxicab travel budget shared by the spatial axes. Highest training value. Any branch it needs goes ahead of analogy. |
| 4 | Kind Frames | `kinds` | all three | The parity (distinction) axis picks a mirror or swap involution for direction words. On a stack without a parity axis, add one and price it. |
| 5 | Walking Totals | `walking-totals` | all three | One L1 step budget across all dimensions. Build Form A and the "nearest" question first, on the Bridges solver. Form B comes later. |
| 6 | Ranked Lists | `ranked` | all three | Lexicographic premises whose height content depends on time. **State strictness:** no two things share both a time and a height. |
| 7 | Heading | `heading` | 3D, 4D–7D | Facing with a head, decided by a 3×3 determinant. Comes after prerequisite 1. Never in Direction. |
| 8 | Worldlines | new mode | its own ladder | Things move, and each premise holds at its own hour. Register it in every place a new mode needs. |
| 9 | Twisted Seam | `twisted-seam` | all three | **Loop form only.** A Möbius seam on a circular axis: crossing it flips another axis. No Klein bottle, no coordinate-model rewrite. |

Final fork contents after today's last rung (`mirror-twins`):

- **4D–7D:** bridges, local-clocks, cone, signals, reach, kinds, walking-totals, ranked, heading, twisted-seam
- **3D:** bridges, kinds, walking-totals, ranked, heading, twisted-seam
- **Direction:** bridges, kinds, walking-totals, ranked, twisted-seam

## Where things are

All under `apps/syllogimous/src/app/syllogimous/`:

- `generators/ndspace.ts`: `ndFeatures()`, and `fillNdConclusion` (branches
  analogy, checkpoint, construct, choose, facing, in that order).
- `utils/ndspace.utils.ts`: `AxisSpec`, `DIMENSION_AXES`, `renderNdPremise`,
  `coordsFromEdges`, `buildNdLayout`, and the transforms.
- `utils/progression.utils.ts`: `ND_LADDER`.
- `utils/ability.utils.ts`: `RUNG_COST` and `DIALS`.
- `utils/calibration.utils.ts`: `MODE_SCALE`.
- `constants/game.constants.ts`.

To verify, run these in `apps/syllogimous`:

```
npm run test:utils
npx ng build --configuration production
```

Read `apps/syllogimous/CLAUDE.md` first. `docs/` is build output that CI
commits: never stage it.
