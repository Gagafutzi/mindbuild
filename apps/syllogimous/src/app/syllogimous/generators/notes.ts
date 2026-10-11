/**
 * Setup lines: the facts about an item that its premises do not state.
 *
 * Each one is stated *because* the item is not derivable without it — a reader
 * who does not know that later premises rewrite earlier relations will produce
 * a confidently wrong answer rather than a hesitant one. They live together
 * because several are shared between families, and because the wording matters
 * more than where it is used: these are the sentences that make an item fair.
 */

/**
 * Stated whenever a conclusion has to be *built*.
 *
 * Judging a claim only needs the direction, which the premises give directly.
 * Stating one needs the distance too, and that is only derivable if the reader
 * knows each premise is worth exactly one step. It is true of every layout the
 * engines produce — but true and *known* are different things, and an item
 * whose answer cannot be derived from what the player was shown is not an item.
 */
/**
 * Stated on every hierarchy item.
 *
 * Premises give *direct* links and the question asks about paths of any length,
 * which is the whole distinction the mode tests — and the two would otherwise
 * be told apart only by a verb.
 */
export const HIERARCHY_NOTE =
    "Premises are <b>direct</b> links. The question asks whether there is a path "
    + "from one to the other along <b>any number</b> of steps.";

/** Stated whenever axes with no difference are left out of the premises. */
export const COMPACT_NOTE =
    "A dimension <b>omitted from</b> a premise is the same for both.";

/**
 * Stated because the item is unfair without it.
 *
 * Every other mode guarantees the premises settle the question, so a reader who
 * cannot find the answer assumes they have missed a step and keeps looking.
 * Here not finding it is sometimes the answer, and nobody can be expected to
 * infer that from the item.
 */
export const INDETERMINATE_NOTE =
    "Some relations are left unstated. A claim counts as true only if it holds"
    + " in <b>every</b> arrangement the premises allow \u2014 if they leave it open,"
    + " the claim is false.";

/** Stated whenever later premises rewrite earlier relations. */
export const EDIT_NOTE =
    "Premises further down <b>change the relations themselves</b>, in order. "
    + "Answer about the relations as they end up.";

export const ONE_STEP_NOTE =
    "Each premise is <b>one step</b> on every dimension it names.";

/**
 * Stated wherever a premise can leave a dimension out without meaning "level".
 *
 * `COMPACT_NOTE` says the opposite, and the two never share an item. Without
 * one of them a missing clause is ambiguous, and on a bridged item the reading
 * matters: the cut is a clause left out, and taking it as "same" makes the
 * bridge look redundant.
 */
export const UNNAMED_NOTE =
    "A dimension a premise does <b>not name</b> is unknown.";

/**
 * Stated on every bridged item.
 *
 * "As many steps east as later" is the one premise shape that compares sizes
 * across dimensions, and its size is not written anywhere: it is the gap the
 * second pair turns out to have.
 */
/**
 * Stated on every clocked item, with the two direction words passed in marked
 * as relations, so a relabelled card names them the way its premises do.
 *
 * The rule is the whole item: a marked premise's time clause is a difference
 * of local readings, and a local reading is the station time plus the clock's
 * own offset. Without it the marks are noise.
 */
export const CLOCK_NOTE = (east: string, later: string) =>
    `Clocks are <b>local</b>: at the same moment, a clock one step ${east} of another reads`
    + ` one step ${later}. Premises marked <b>by local clocks</b> give each time as read where`
    + ` that thing is; the rest use the station clock.`;

/**
 * The light cone's rule, with the travel directions passed in marked as
 * relations. The boundary case is stated because it decides items: arriving
 * exactly on time is the commonest near miss, and either reading of it is
 * defensible until one is written down.
 */
export const CONE_NOTE = (travel: string, inert: string) =>
    "Each name is a bell ringing at a place and a moment. A ring travels <b>one step a"
    + ` minute</b>, only ${travel}, one step at a time${inert}. A ring reaches a bell if`
    + " it gets there by the moment that bell rings \u2014 <b>arriving exactly then counts</b>.";

/** The one-step convention, with the cone's minutes excepted. */
export const ONE_STEP_MINUTES_NOTE =
    "Each premise is <b>one step</b> on every dimension it names, except time, which it gives"
    + " in <b>minutes</b>.";

export const SIGNAL_NOTE =
    "\u201cRang the moment X\u2019s ring reached it\u201d means it rang exactly when a ring"
    + " from X, travelling as above, would arrive.";

export const REACH_NOTE =
    "\u201cRang only after X\u2019s ring had reached it\u201d means it rang then or later"
    + " \u2014 how much later is not said. A claim counts as true only if it holds"
    + " <b>however much later</b>.";

/**
 * Kind frames: the rule, with the words it exchanges passed in marked as
 * relations, and the reckoning convention without which the rule is moot.
 */
export const KIND_NOTE = (exchange: string, same: string, opposite: string) =>
    `Everything is one of two kinds \u2014 the premises say ${same} or ${opposite} \u2014 and`
    + ` the two reckon directions differently: ${exchange}. Every relation is in the`
    + ` <b>reckoning of the one it is relative to</b>.`;

/**
 * A total breaks the one-step rule for its own premise, and has to say so —
 * otherwise "6 steps in all" reads as a contradiction of the note above it.
 */
export const WALK_NOTE = (uncounted: boolean) =>
    "\u201cN steps in all\u201d counts every step on every dimension, whichever way it goes;"
    + " that premise is <b>not</b> one step per dimension, and gives each one\u2019s direction only."
    + (uncounted ? " A loop or a kind is stated as usual and not counted in the total." : "");

/** What the nearer question counts, where the stack has axes it does not. */
export const NEAREST_NOTE = (parity: boolean, loop: boolean) =>
    "Every step on every dimension counts towards being near, whichever way it goes."
    + (loop ? " On a loop, count the short way round." : "")
    + (parity ? " Kind is not a distance and does not count." : "");

/**
 * The list's order, and the strictness without which "listed before" between
 * two things level on both keys would mean nothing — and the item would rest
 * on a convention nobody stated.
 */
export const RANK_NOTE = (key: string, keyFirst: string, tie: string, tieFirst: string,
                          keyLevel: string, tieLevel: string) =>
    `Everything is on one list, in order of ${key}, ${keyFirst} first; things level on ${key}`
    + ` are listed by ${tie}, ${tieFirst} first. <b>No two things are at both the ${keyLevel}`
    + ` and the ${tieLevel}</b>, so the order is never a tie.`;

export const BRIDGE_NOTE =
    "A premise saying one pair is <b>as many steps</b> apart on one dimension as"
    + " another pair is on a different one means the two gaps are the same size"
    + " \u2014 however large the second one turns out to be.";

/**
 * Stated whenever operations move objects around a composed space.
 *
 * Distinct from EDIT_NOTE on purpose — the two look similar and mean opposite
 * things. An edit rewrites what a premise *said*; a transformation leaves every
 * premise true of the arrangement it described and then moves things out of it.
 */
export const ND_TRANSFORM_NOTE =
    "Premises further down <b>move things</b> around the space, in order. Answer "
    + "about where they end up.";

/**
 * Stated whenever a conclusion compares two relations.
 *
 * "The same relation" is genuinely ambiguous between direction and distance,
 * and the item is undecidable rather than merely hard if the reader picks the
 * other one.
 */
export const ND_ANALOGY_NOTE =
    "Two relations are <b>the same</b> when they point the same way on every "
    + "dimension, and <b>opposite</b> when every direction is reversed. How far "
    + "apart things are does not matter.";

/**
 * A twisted ring's placements count columns, so the one-step rule is stated
 * with its exception rather than left to contradict the card.
 */
export const TWIST_STEP_NOTE =
    "Each premise is <b>one step</b> on every dimension it names, except round the ring,"
    + " where it says how many.";

/**
 * The twist, and how a placement is read across it. The mirror is about the
 * centre line, which is why the anchor names it: a reader who mirrors the step
 * rather than the position carried across lands somewhere else.
 */
export const TWIST_NOTE = (plus: string, minus: string) =>
    `Carried across the twist, ${plus} and ${minus} trade places, mirrored about the centre line;`
    + " nothing else changes. A premise is walked from its reference, the way round it names,"
    + ` and read where it lands — so one thing can be ${minus} of another one way round and`
    + ` ${plus} of it the other.`;
