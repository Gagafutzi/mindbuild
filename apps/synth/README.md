# Synth

A grapheme–colour synesthesia trainer. One self-contained HTML file, no build
step and no network: **https://gagafutzi.github.io/Synth-v2/**

Every letter and digit carries a colour (its identity) and a shape (its type —
square for uppercase, circle for lowercase, triangle for digits). The goal is to
move from conscious decoding to automatic recognition.

## Modes

**Learn** browses all 36 symbols. **Decode**, **Find colour** and
**Multi-sensory** drill single symbols; **Tone ID** tests the pitch channel on
its own. **Word**, **Phrase**, **Flash recall** and **Match check** read whole
strings. **Memory** holds a growing sequence. **Logic** continues a coloured
sequence, **Confusions** drills only the pairs you actually mix up, and
**Automaticity** and **Pop-out** measure whether any of it has stuck.

## German

Tools → Preferences → Language. German adds **Ä Ö Ü**: each takes its base
letter's hue and saturation with the lightness moved by a tenth, and is drawn
with two dots, as the letter is written. The colour says which letter it comes
from and the dots say it is the umlaut; the dots are needed because every
direction out of A's red runs into M or R. The 36 colours already learned are
not touched, an umlaut sounds as its base letter (the tones stay a 6 × 6 code),
and a saved palette that predates the umlauts derives them from its own A, O
and U. Words and phrases come from `words-de.js`, with nouns capitalised; there
is no ß, which has no capital for the stats to file it under.

## Word mode

Advanced vocabulary only, in either language: a curated list (perspicacious,
palimpsest, verisimilitude; Fernweh, Zwielicht, Unergründlichkeit) and every
word of the phrase banks. Five to seven letters at the start of a streak,
lengthening by one every three answers, as far as sixteen; every word that
fits the current length is equally likely. Flash and Match keep everyday words:
they train reading at a glance.

## Phrases

Built from banks of advanced vocabulary (luminous, cartographer,
imperceptibly; ehrwürdig, Kartograf, unmerklich) in twenty English and sixteen
German templates, 16 to 46 characters, no punctuation. No template comes back
within five phrases and no content word within forty words. The German
templates choose articles and adjective endings by gender and case, and weak
masculines take -en after den and dem.

## The two measurements

Accuracy cannot tell you whether the training worked, because the adaptive timer
holds it at 85% by construction. These can:

- **Stroop interference** — a letter is printed in a colour that matches or
  clashes with its trained one, and you name the ink. If the association has
  become involuntary you cannot ignore the letter, and clashing trials get
  slower. The gap in milliseconds is the score.
- **Search slope** — find one symbol in a field of 6, 12 or 20. A flat slope
  means the target pops out regardless of field size: parallel search, which is
  what an automatic colour looks like. A climbing slope means you are still
  scanning one symbol at a time.

Both are withheld until they have ~30 trials, because a difference off six
trials is noise.

## The timer

The window is `base + unit × demand + typing`. Demand counts every symbol,
weighted by how well you know it; a symbol already met in the same item costs
half, since its colour was decoded moments ago but it still has to be found and
read in place. Typing is a fixed 220 ms per character, so `unit` stays the time
a symbol takes to *read*. Typing modes may run to 120 s; the rest stop at 40 s.

It used to count distinct symbols only (`sees` as two lookups, not four). That
held for single words, but a 46-character phrase has barely more distinct
letters than a long word, so long phrases timed out however well they were
read. Moving to every symbol reset the learned unit of Word, Phrase, Flash and
Match once; the other modes kept theirs.

A weighted staircase moves `unit` until you sit at the target accuracy; the
steps satisfy `down/up = (1 − P)/P`, which is what makes it settle at P rather
than wherever equal steps happen to balance.

## Your data

Everything lives in this browser's localStorage. Tools → Data → Export writes a
JSON file; the [training archive](https://github.com/Gagafutzi/training-archive)
reads it, or reads `synth5_en` straight out of storage.
