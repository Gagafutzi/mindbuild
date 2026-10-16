import { Component, Input } from "@angular/core";
import { LinearFeatureFlags, SettingsOverrideService } from "../../services/settings-override.service";
import { ORDERED_QUESTION_TYPES } from "../../constants/game.constants";
import { settableRungsFor } from "../../utils/progression.utils";
import {
    AXIS_CHOICES, AXIS_ORDERINGS, AxisOrdering, axesForDimensions, axisWordConflicts,
    ndAxisColors, reorderAxisIds,
} from "../../utils/ndspace.utils";

/** The boolean members of LinearFeatureFlags; `transforms` is a count. */
type LinearToggle = Exclude<keyof LinearFeatureFlags, "transforms" | "edits">;

/**
 * How an item is built, as opposed to which items appear.
 *
 * Lifted out of the Customise page because it was only reachable from
 * there, while the settings it writes are read by the generators directly — so
 * they were already in force during Free Play, with no way to see or change
 * them from the screen that is *about* configuring a session. Two pages, one
 * control surface, one place to change the wording.
 *
 * `enabled` greys the controls without hiding them: a disabled control still
 * says the option exists, where a hidden one says the app cannot do it.
 */
@Component({
    selector: "app-mode-modifiers",
    templateUrl: "./mode-modifiers.component.html",
    styleUrls: ["./mode-modifiers.component.css"],
})
export class ModeModifiersComponent {
    @Input() enabled = true;

    /* ---- per-mode rungs ---- */

    /**
     * Rungs the family flags above do not already cover.
     *
     * Listing every rung would put two controls on one setting for the scale
     * modes, where "branching" is both a rung and a family flag. These are the
     * ones that had no control at all: earned or nothing.
     */
    private static readonly COVERED = new Set([
        // Tombstones. They hold a ladder slot so existing profiles keep their
        // earned rungs lined up, and no generator asks for them — so showing a
        // control would be offering a switch wired to nothing. The features
        // themselves are still reachable, as ordinary rows above.
        "retired-compact",
        "branching", "overlap", "compact", "indeterminate", "facing", "analogy",
        "multi-conclusion", "choose-conclusion", "construct-conclusion",
        "construct-distance", "wide-premises", "incorrect-directions",
        "transform-1", "transform-2", "edit-1", "edit-2", "circular", "circular-2",
        // The same six after the split, plus the two that went with them. They
        // are dials now, reached by the controls above rather than by a rung
        // switch, and the tombstones they left behind are wired to nothing.
        "retired-transform-1", "retired-transform-2",
        "retired-edit-1", "retired-edit-2",
        "retired-circular", "retired-circular-2",
        "retired-transform-depth-1", "retired-transform-depth-2",
    ]);

    /** Every mode that has a rung worth showing, with those rungs. */
    rungRows = ORDERED_QUESTION_TYPES
        .map(type => ({
            type,
            // Off-ladder rungs included: they cannot be earned, so a row here
            // is the only way to reach them at all.
            rungs: settableRungsFor(type)
                .filter(r => !ModeModifiersComponent.COVERED.has(r))
                // A tombstone only holds a retired rung's slot; it does nothing,
                // has no name, and printed its id here as one more row.
                .filter(r => !r.startsWith("retired-")),
        }))
        .filter(row => row.rungs.length > 0);

    rungOf(type: string, rung: string): boolean | null {
        return this.overrides.state.rungs?.[type]?.[rung] ?? null;
    }

    setRung(type: string, rung: string, value: boolean | null) {
        this.overrides.setRung(type, rung, value);
    }

    /**
     * What a rung is called, and what it is.
     *
     * The name is the shortest one that says it, and where the rung is a real
     * concept — a Möbius strip, a light cone, knights and knaves — it is called
     * what that concept is called, so it can be looked up. The sentence that
     * used to be the name is kept as the hint under it.
     *
     * Forty-three of the fifty-seven settable rungs used to fall through to the
     * fallback and print their own id — `checkpoint`, `min-span-3`,
     * `as-relations`, `dim-6`. A control whose name is an internal identifier is
     * a control nobody can find, which is how it was reported: *"I can't find
     * any option for the halfway conclusions"*. It was there. It was called
     * `checkpoint`, one unlabelled row among forty-two others.
     *
     * `tests/registries.test.ts` now fails on a settable rung with no label, so
     * the next one added is named before it ships rather than after somebody
     * goes looking for it.
     */
    private static RUNGS: Record<string, [string, string]> = {
        /* --- everywhere --- */
        "negation": ["Negation", "Negated premises — “is not above”, here only"],
        "meta": ["Meta-relations", "Relations about relations, here only"],

        /* --- how the conclusion is asked --- */
        "checkpoint": ["Halfway conclusion", ""],
        "choose-conclusion": ["Choose the conclusion", "Pick which conclusion follows, instead of true or false"],
        "construct-conclusion": ["Build the conclusion", "Build the conclusion yourself, one slot per dimension"],
        "construct-distance": ["Build with distances", "Build it with distances, not only directions"],
        "analogy": ["Analogies", "One pair against another"],
        "near-miss": ["Near misses", "The wrong pair differs on one axis only"],
        "five": ["Rock paper scissors lizard Spock", "Five kinds round the circle, not three"],

        /* --- shape of the premise network --- */
        "branching": ["Branching", "Branching premises, not a single chain"],
        "wide-premises": ["Two links per premise", "Two links in one sentence — “A is above B, which is above C”"],
        "overlap": ["Ties", "Ties allowed — two things can share a place"],
        "min-span-3": ["Longer routes", ""],
        "cycles": ["Cycles", "Cycles in the hierarchy"],
        "reaches": ["Reachability", "Reachability, not just direct links"],
        "180": ["Backtracking", "Backtracking arrangements"],
        "hierarchy": ["Set hierarchies", "Set hierarchies, not only two-premise syllogisms"],

        /* --- composed spaces --- */
        "circular": ["Cylinder", "One axis wraps around"],
        "circular-2": ["Torus", "A second axis wraps around"],
        "indeterminate": ["Undetermined pairs", "Some pairs are left undetermined"],
        "facing": ["Intrinsic frame", "Relations from an object’s own facing, not the map’s"],
        "mirror-twins": ["Chirality", "Some have their left and right swapped"],
        "bridges": ["Equal gaps", "One dimension’s gap given by another’s — “as many steps east as later”"],
        "local-clocks": ["Time zones", "Some times read on local clocks, one step later per step east"],
        "cone": ["Light cone", "Could one bell’s ring have reached another in time? Distance is a shared budget"],
        "signals": ["Lightlike", "Some times given only as “rang the moment the ring arrived”"],
        "reach": ["Causal future", "Some times only bounded — “rang only after the ring arrived”"],
        "kinds": ["Parity", "Two kinds reckon directions differently — east for one is west for the other"],
        "walking-totals": ["Taxicab distance", "Totals of steps across every dimension — “6 steps in all”, and which is nearer"],
        "ranked": ["Lexicographic order", "One sorted list — “listed before” means height only for things at the same time"],
        "twisted-seam": ["Möbius strip", "A loop with a twist in it — crossing it swaps two directions"],
        "level": ["Drawing level", "The hour is set by one direction, and the answer read on another"],
        "meet": ["Collision", "Whether two movers ever share a place, not just a line"],
        "heading": ["Attitude", "Facing with a head — left and right for someone lying down or upside down"],
        "speakers": ["Knights and knaves", "Premises reported by speakers, and some of them lie"],
        "testimony": ["Testimony", "Reports that have to be checked against each other"],
        "transform-1": ["1 transformation", ""],
        "transform-2": ["2 transformations", ""],
        "transform-depth-1": ["1 extra transformation", ""],
        "transform-depth-2": ["2 extra transformations", ""],
        "edit-1": ["1 rewritten premise", "One premise rewritten, so the first arrangement never existed"],
        "edit-2": ["2 rewritten premises", "Two premises rewritten"],
        "collide": ["Shared vocabulary", "The two spaces share their vocabulary"],

        /* --- graph matching --- */
        "which-differs": ["Odd one out", "Which group is the odd one out"],
        "distance": ["Edit distance", "How many changes apart the two are"],
        "as-relations": ["Links in words", "Links stated as relations rather than drawn"],
        "structure-match": ["Whole structure", "Match the whole structure, not one node"],
        "structural": ["No arrow counting", "Structural matching — no counting arrows"],
        "match-3": ["Third node", "Match a third node, not just two"],

        /* --- transformation matching --- */
        "identify": ["Identify the change", "Work out which change was applied"],
        "apply": ["Apply the change", "Apply the change to a different structure"],
        "compose": ["Two changes at once", ""],
        "sequence": ["Continue the sequence", "Continue the sequence of changes"],

        /* --- structure match --- */
        "same-degrees": ["Same degree sequence", "The wrong system has every entity's arrow counts, so counting cannot rule it out"],
        "five-entities": ["Five entities", "A fifth entity per system, at the same number of arrows"],
        "converse": ["Converse arrows", "Some arrows are stated from the far end"],

        /* --- axis maps --- */
        "compose-2": ["2 composed changes", ""],
        "compose-3": ["3 composed changes", ""],
        "compose-4": ["4 composed changes", ""],
        "compose-5": ["5 composed changes", ""],
        "offset": ["Translation", "A change that shifts everything"],
        "dense-examples": ["Dense examples", "Examples share axes, so which went where has to be worked out"],
        "op-join": ["Move onto", "An object may move onto its reference, not only past it"],
        "op-follow": ["Follow", "An object may move by however far its reference stands out"],
        "op-mirror": ["Point reflection", "An object may hop over its reference and land beyond it"],
        "role-next": ["Next up the list", "The rule may point up the list as well as back down it"],
        "role-extremes": ["Nearest or farthest", "The reference may be whichever began nearest or farthest"],
        "axes-3": ["3 axes", ""],
        "axes-4": ["4 axes", ""],
        "dim-3": ["3 dimensions", ""],
        "dim-4": ["4 dimensions", ""],
        "dim-5": ["5 dimensions", ""],
        "dim-6": ["6 dimensions", ""],
        "dim-7": ["7 dimensions", ""],

        /* --- widest group --- */
        "margin-1": ["Margin of one", "A margin of one between the groups, not two"],
        "rank": ["Rank all", "Rank every candidate, not just the furthest"],
        "groups-2": ["Second group", "A second group, with its own change"],
        "groups-3": ["3 groups", ""],
        "groups-4": ["4 groups", ""],

        /* --- the rest --- */
        "state-rule": ["State the rule", "State the rule, rather than pick the odd one out"],
        "solo-turns": ["Solo turns", "An object steps round the shape on its own"],
        "incorrect-directions": ["Near-miss distractors", "Near-miss distractors, wrong in one attribute at a time"],
        "compound": ["Compound statements", "Compound statements — “A and not B”"],
        "undetermined": ["Undecidable cases", "Some cases cannot be decided either way"],
    };

    rungLabel(rung: string) { return ModeModifiersComponent.RUNGS[rung]?.[0] ?? rung; }

    /** The longer description, shown under the name. */
    rungHint(rung: string) { return ModeModifiersComponent.RUNGS[rung]?.[1] ?? ""; }

    get scramble() { return this.overrides.state.scrambleFactor ?? 100; }

    setScramble(raw: string) { this.overrides.setScramble(Number(raw)); }

    /* ---------------- how far apart things sit ---------------- */

    /**
     * A percentile of what the current configuration produces, not a number of
     * bits — "8.5 bits" means nothing until you know what 8.5 is wide *for*,
     * since it depends on the axis stack, the object count and the tie chance.
     *
     * Scoped to one dimension when asked, because spread is not one quantity: a
     * long time axis is a different demand from a tall vertical one, and
     * pooling them lets a narrow axis be paid for by a wide one.
     */
    get spread() { return this.overrides.state.space?.spread?.percentile ?? 50; }
    get spreadAxis() { return this.overrides.state.space?.spread?.axis ?? ""; }

    setSpread(raw: string) {
        this.overrides.setSpread({
            percentile: Math.max(0, Math.min(100, Number(raw) || 0)),
            axis: this.spreadAxis || null,
        });
    }

    setSpreadAxis(id: string) {
        this.overrides.setSpread({ percentile: this.spread, axis: id || null });
    }

    /** Every axis a composed space can be built on, for the scope picker. */
    spreadAxes = AXIS_CHOICES.map(s => ({ id: s.id, label: s.name }));

    constructor(public overrides: SettingsOverrideService) { }

    /**
     * Tri-state, not a checkbox: "ladder" defers to what the mode has earned,
     * which is the default and the only setting that leaves progression
     * meaningful. On and off are for trying something out, or for a player who
     * already works at this level elsewhere and should not have to climb to it.
     */
    /*
     * Wide premises and compact relations are not here.
     *
     * Everything else on this list changes what has to be worked out; those two
     * change only how the same facts are worded, which makes them a display
     * choice. They live on Display & timer, and write to the same store.
     */
    linearRows: Array<{ key: LinearToggle; label: string; hint: string }> = [
        {
            key: "branching",
            label: "Branching",
            hint: "Not a chain: A–B, A–C, B–D",
        },
        {
            key: "overlap",
            label: "Ties",
            hint: "Two things can share a place, so “same” becomes a real answer. Needs branching",
        },
        {
            key: "multiConclusion",
            label: "Multiple conclusions",
            hint: "Two or three claims; true only if all of them follow",
        },
        {
            key: "chooseConclusion",
            label: "Choose the conclusion",
            hint: "Four claims, one follows. No coin to flip",
        },
        {
            key: "constructConclusion",
            label: "Build the conclusion",
            hint: "State the relation yourself, one dimension at a time",
        },
        {
            key: "constructDistance",
            label: "Build with distances",
            hint: "How far as well as which way",
        },
        {
            key: "facing",
            label: "Intrinsic frame",
            hint: "Someone in the layout faces something else, and the claim is judged from there. Composed spaces only",
        },
        {
            key: "indeterminate",
            label: "Undetermined pairs",
            hint: "Leave some relations unstated, and ask whether a claim *must* hold. Composed spaces only",
        },
        {
            key: "incorrectDirections",
            label: "Near-miss distractors",
            hint: "A false direction the item used elsewhere, so “I never saw that” stops working. Direction modes",
        },
        {
            key: "analogy",
            label: "Analogies",
            hint: "Does A→B match C→D? Direction only, not distance",
        },
        /*
         * Off the ladder as of fixes/6, and here so they are still reachable.
         *
         * Both were being handed out by progression while only sometimes doing
         * anything — wide premises merge only when two consecutive stored edges
         * share an endpoint, which branching makes rare, and branching is
         * earned first. A rung that the item does not visibly honour is worse
         * than no rung, because the player is told they climbed.
         */
        {
            key: "widePremises",
            label: "Two links per premise",
            hint: "“A is above B, which is above C”. Merges only where the chain allows it, so some items are unaffected",
        },
        {
            key: "compact",
            label: "Omit matching axes",
            hint: "An unmentioned axis means “the same” rather than one less thing to read. Composed spaces only",
        },
    ];

    get editCount(): number | null {
        return this.overrides.state.linear?.edits ?? null;
    }

    setEditCount(raw: string) {
        if (raw === "" || raw == null) return this.overrides.setLinear("edits", null);
        this.overrides.setLinear("edits", Math.max(0, Math.min(4, Number(raw) || 0)));
    }

    linearOf(key: LinearToggle): boolean | null {
        return this.overrides.state.linear?.[key] ?? null;
    }

    setLinear(key: LinearToggle, value: boolean | null) {
        this.overrides.setLinear(key, value);
    }

    /* 2 is Direction, which is the two-axis case of the same engine. Picking
       its axes is how up/down and left/right replace the compass. */
    spaceDims = [2, 3, 4, 5, 6];

    axisChoices = AXIS_CHOICES.map(s => ({
        id: s.id,
        label: s.name,
        words: `${s.direction[0]}/${s.direction[1]}`,
        canLoop: !!s.cyclic,
    }));

    /** Current stack for a dimension count: the override if set, else the preset. */
    axesOf(dims: number): string[] {
        const saved = this.overrides.state.space?.axes?.[dims];
        if (saved?.length) return saved;
        return axesForDimensions(dims).map(s => s.id);
    }

    toggleAxis(dims: number, id: string) {
        const current = this.axesOf(dims);
        const next = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
        this.overrides.setAxes(dims, next);
    }

    resetAxes(dims: number) { this.overrides.setAxes(dims, []); }

    isPreset(dims: number) {
        return !this.overrides.state.space?.axes?.[dims]?.length;
    }

    /**
     * Why a stack will be ignored, if it will be.
     *
     * Silently falling back to the preset would look like the setting does
     * nothing, so the reason is stated: too few axes to be a space, or two axes
     * that use the same word and so cannot be told apart in a premise.
     */
    axisWarning(dims: number): string {
        const chosen = this.axesOf(dims)
            .map(id => AXIS_CHOICES.find(s => s.id === id))
            .filter((s): s is typeof AXIS_CHOICES[number] => !!s);

        if (chosen.length < 2) return "Needs at least two axes — using the default.";
        const clash = axisWordConflicts(chosen);
        if (clash.length) return clash[0] + " — using the default.";
        if (chosen.length !== dims) {
            return `${chosen.length} axes selected for a ${dims}D mode; the mode uses however many you pick.`;
        }
        return "";
    }

    get circularAxes(): number | null {
        return this.overrides.state.space?.circularAxes ?? null;
    }

    setCircularAxes(value: number | null) { this.overrides.setCircularAxes(value); }

    /** How many of the current axes could actually be looped. */
    loopableCount(dims: number): number {
        return this.axesOf(dims)
            .map(id => AXIS_CHOICES.find(s => s.id === id))
            .filter(s => s?.cyclic).length;
    }

    get linearTransforms(): number | null {
        return this.overrides.state.linear?.transforms ?? null;
    }

    setLinearTransforms(raw: string) {
        // Empty means "defer to the ladder"; a number forces that many.
        if (raw === "" || raw == null) return this.overrides.setLinear("transforms", null);
        this.overrides.setLinear("transforms", Math.max(0, Math.min(4, Number(raw) || 0)));
    }

    orderings = AXIS_ORDERINGS;

    /**
     * The stack in reading order, carrying the colour each axis is painted in.
     *
     * Colours come from the same function the generator uses, so the strip is
     * a legend for the premises rather than a second opinion about them.
     */
    orderedAxes(dims: number) {
        const scales = this.axesOf(dims)
            .map(id => AXIS_CHOICES.find(s => s.id === id))
            .filter((s): s is typeof AXIS_CHOICES[number] => !!s);
        const colors = ndAxisColors(scales.map(scale => ({ scale })));
        return scales.map((s, i) => ({ id: s.id, label: s.name, color: colors[i] }));
    }

    /**
     * Move one axis one place through the premise.
     *
     * Saves the whole list, including when nothing was overridden yet — the
     * preset order is a perfectly good starting point to nudge, and there is
     * no other way to express "the default, but time first".
     */
    moveAxis(dims: number, index: number, delta: number) {
        const ids = [...this.axesOf(dims)];
        const to = index + delta;
        if (to < 0 || to >= ids.length) return;
        [ids[index], ids[to]] = [ids[to], ids[index]];
        this.overrides.setAxes(dims, ids);
    }

    applyOrdering(dims: number, how: AxisOrdering) {
        this.overrides.setAxes(dims, reorderAxisIds(this.axesOf(dims), how));
    }
}
