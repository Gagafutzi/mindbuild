/** A guide in sections, for a mode too large for one paragraph. */
export interface GuideSection { title: string; text: string[]; example?: string[] }

/**
 * Composed World, as a guide rather than a blurb.
 *
 * It was one paragraph of some six hundred words with every rule in it, in no
 * order a player meets them. Now in the order of play, a section a topic, each
 * with a line as the card prints it. Every rule of the old paragraph is in here
 * (tests/world-help.test.ts holds that), so nothing was lost to the reorder.
 */
export const GUIDES: Record<string, GuideSection[]> = {
    "Composed World": [
        { title: "How an item runs", text: [
            "1. Speakers make claims. Pick every question to the open speaker that would tell what they are.",
            "2. With that speaker's answer, tick every knight.",
            "3. The knaves' words go, and the knights' words give the world, unnamed since all of it is true. It comes in parts, a few things at a time, outside the brackets and then inside, each part with an analogy to finish. A part is taken away once answered: later analogies use things from earlier parts, which you have to remember.",
            "4. Last, events are announced on their own: judge two or three analogies across them, true or false, and build one, all from memory.",
            "The first premises of every stage say what is particular to the item: which axes are rings, what crossing round does, and how the other kind reckons.",
            "Hint, under the question, gives one step at a time: the method, then what to look at, then the first result, never the step that decides the answer. Hints taken are kept with the answer.",
        ] },
        { title: "Knights and knaves", text: [
            "Each premise is said by a knight, always true, or a knave, always false. The first stage shows only the words that tell the speakers apart, judged by logic alone: nothing is assumed about what nobody says, and a speaker who never contradicts anyone is not thereby a knight.",
            "Congruent words (4 clockwise and 1 anticlockwise on a ring of 5) mean the same kind. Words that can't both be so mean not both knights. Denials that can't both be false mean not both knaves.",
            "The words leave one speaker open, and maybe others tied to them. Pick every question to that speaker that would tell what they are: one the words settle, true in every reading they leave or false in every one, never one they leave open. Then nothing but the speaker's kind can change the answer.",
        ], example: [
            "Cane: Scarf moves 1 clockwise, 1 north hourly",
            "Avocado: not so: Scarf moves 3 clockwise, 3 north every 3 hours",
            "→ the same pace, said and denied: one of Cane and Avocado is a knight, the other a knave",
        ] },
        { title: "Places, lengths and paces", text: [
            "Places are measured from the origin, a point at 0 on every axis. A place may leave out what it is level on.",
            "A thing is 1 to 3 long on every line, its place being its low end, so two things can overlap, nest or match. A point is 1 long.",
            "Things keep their pace all day. A pace names every axis a thing moves along: \u201c1 clockwise, 1 north hourly\u201d means still along every other, so it is false of a thing that also moves 1 later. In the world the knights give, what they don\u2019t say moves stays still, and nothing happens that they don\u2019t say.",
            "A statement holds at its hour, after that hour\u2019s events.",
        ], example: [
            "at 1, Radio is same longitude, 1 south, 3 above, 2 earlier from the origin",
            "Radio moves 1 anticlockwise, 1 earlier hourly",
            "Radio is 3 long in north\u2013south, 2 in time",
        ] },
        { title: "Rings, seams and clocks", text: [
            "An axis can be a ring: counting round it comes back to the start. Its first premise says how many steps it has and what crossing round does \u2014 mirror another axis, pace too, or move a thing along one.",
            "Local clocks run 1 later per step clockwise; a ring spreads 1 step per step later. \u201cBy local clocks\u201d gives a time as the clock where the thing stands reads it.",
            "Ring reach is about time: a ring spreads from a thing 1 step for each step later. Another thing is in its ring\u2019s reach when it is at least as many steps later as it is steps away; beyond its ring when not. \u201cA ring from Bee just reaches Ash\u201d says exactly that many.",
        ], example: [
            "east\u2013west: a ring of 5, counted clockwise; crossing round mirrors north\u2013south, pace too.",
            "at 7, Scarf is 1 clockwise, 4 north, 6 above, 1 earlier by local clocks from the origin",
        ] },
        { title: "Events", text: [
            "Turns, mirrors, shears and stretches are about the origin and move everything; a jump or a turn back moves one thing only.",
        ], example: [
            "at 5, Scarf jumps 1 below",
            "at 5, all turns a quarter, later round to below",
            "at 10, up\u2013down and time swap, above becomes later",
            "at 3, Needle turns back",
        ] },
        { title: "Speakers and what they see", text: [
            "Each speaker stands in a thing, facing a way, and says what they see from there. Past the first stage that is told from the thing, and \u201cAsh sees Bee\u201d keeps who sees.",
            "Distances are to its nearest edges, ahead and left as seen facing that way. A mirror twin has left and right swapped, one hanging head down up and down as well; with no facing given, it is worked out from what is seen.",
        ], example: [
            "at 1, from Hump, facing east, head down: Scarf is 1 ahead, 5 right, level in up\u2013down, level in time",
        ] },
        { title: "Kinds, meeting, and the second space", text: [
            "On seven axes things come in two kinds, and some cards give the opposite kind its own reckoning: places measured from such a thing are read its way, as its first premise says.",
            "Two things meet where they share ground.",
            "There is sometimes a second space, inside the brackets, with the same things and speakers: its lines come under \u201cInside:\u201d, or in brackets, (where \u2026), after a line about the first.",
        ] },
        { title: "Analogies, verdicts and building", text: [
            "\u201cX stands to Y on up\u2013down as Z to which?\u201d: work out how X stands to Y on the named axes only, at its hour and side, then find what Z stands to the same way at the second hour. An analogy says which side of the brackets each relation is on, and may use ring reach.",
            "Pick the term, or build the point. On an open card, where a length is not settled, select every term that could.",
            "To build P: P is Z moved by the step that takes X to Y. Say where P is from the named thing, axis by axis.",
        ] },
        { title: "Easy", text: [
            "Easy, on the Experimental page, keeps the knights and knaves and then shows one small world whole \u2014 three things, fewer axes and speakers, no brackets \u2014 with only true-or-false questions, before and after the announcement.",
        ] },
    ],
};
