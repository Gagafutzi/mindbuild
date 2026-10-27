# Loci Span

Word span, trained with the method of loci. A list of words comes one at a
time; you walk a route you know well and set each word, as a picture, at the
next place along it. Then you walk the route again and type the words back in
order.

What sets it apart from an ordinary span task is the **imagery** control. The
method works by turning each word into an image, and how hard that is depends
almost entirely on the word:

| Tier | Name | What it is | e.g. |
|---|---|---|---|
| 5 | Vivid | fantastical or striking — they picture themselves | dragon, gnome, knight, volcano |
| 4 | Concrete | everyday objects, animals, food | hammer, kettle, frog |
| 3 | Technical | real things that are hard to picture | molecule, fraction, document |
| 2 | Abstract | ideas and processes | method, policy, outcome |
| 1 | Very abstract | pure concepts with nothing to see | notion, essence, validity |
| ∗ | Mixed | every list draws from all five | |

A dragon places itself. A "notion" has to be turned into something first — a
pun, a symbol, a scene — and that conversion is the skill the lower tiers
train. Start high, where the route itself is the thing being learned, and move
down as placing becomes automatic.

## How it runs

- **Words per list**, **seconds per word**, **lists per session**; words
  **shown**, **spoken** (the browser's own voice) or both. The place number is
  shown with each word, so you know which locus it goes on.
- **Length adapts**: one word more after a perfect list, one fewer after two
  misses in a row, and the next session starts where this one ended. Or fixed.
- **Recall is typed, in order.** Enter places a word and moves on; Enter on an
  empty line skips a place; Backspace on an empty line takes the last one back.
  One slip is forgiven on words of five letters or more.
- **Feedback per list**: each place marked ✓ (right word, right place), ~ (a
  word from the list, at another place) or ✗.
- No word repeats within a session, so a word is never recalled from an
  earlier list's route.
- **Goal: 30 words** recalled perfectly in one list. The setup screen and the
  session summary show the best span so far against it, taken from every
  session in the record.

## Record

Sessions are written in the Chimera record format
(`apps/relations/harness/FORMAT.md`) under `chimera.loci.record.v1`, so the
hub's meter counts them with no adapter: `activeSeconds` excludes time the page
was hidden. Each list is a row of `trialLog`: the words, what was typed, the
tier of each word, how many were in place and how many in the list at all.
`level` and `levelEnd` are the list length at the start and end; `score` is the
longest perfect list; `accuracy` is the share of words recalled in place.

## Research

- **The method of loci** is the classical memory art: places along a familiar
  route as a fixed sequence of hooks (Yates, *The Art of Memory*, 1966; its
  effectiveness for ordered word lists, Bower 1970).
- **Imagery and concreteness**: words rated high in imagery are remembered
  better than abstract ones, which dual-coding theory explains as a second,
  pictorial code (Paivio 1971). The tiers here are sorted by hand by category,
  not taken from rated norms — those exist (Paivio, Yuille & Madigan 1968;
  the Glasgow norms, Scott et al. 2019) and are coarser than this needs.
- **Training**: memory champions are not born with different brains — they use
  the method of loci (Maguire et al. 2003). In naive adults, six weeks of
  loci training raised word-list recall from about 26 to about 62 words,
  with brain connectivity shifting towards the champions' pattern, and the
  gain held four months later (Dresler et al. 2017).

The gain is in the method. Transfer to memory tasks the method does not apply
to is not what these studies show.
