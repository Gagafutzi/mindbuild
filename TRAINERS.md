# The hub's trainers, and the research behind them

What each trainer on the hub asks you to do, what it is meant to load, and the
research it rests on. **Sources marked †** are cited in this repository (in a
trainer's own README, code comments or `research/`). The rest are background
added for this summary — the standard references for each task family — and
are not claims any trainer's code makes about itself.

One caveat applies to every trainer here and is worth reading first: large
meta-analyses of working-memory and cognitive training find reliable gains on
the trained task and closely related ones, and little or no transfer to broad
abilities such as fluid intelligence (Melby-Lervåg, Redick & Hulme 2016 †;
Au et al. 2015 found a small effect for n-back specifically, and its size is
disputed). Several trainers say so in their own docs. What the hub can honestly
claim is that it keeps each task at the edge of your capacity and measures it
cleanly.

---

## Main grid — counted toward the day

### Syllogimous
**Task.** Read a handful of premises — "A is above B", "C is later than A" —
and judge, choose or build a conclusion that was never stated. Dozens of modes:
linear orders, composed N-dimensional spaces, hierarchies, analogies, graph and
structure matching, transformations, knights and knaves, light cones, Möbius
strips.
**Loads.** Relational integration: composing several relations held at once
into one that is not on the page.
**Research.**
- Mental models and relational integration are the rationale now: building
  one model from several relations and reading off an unstated one. Reasoning
  training has better near-transfer evidence than memory training (Guerin et
  al. 2021); transfer to academic outcomes is less clear.
- Relational Frame Theory — relating stimuli is the basic operation of
  language and cognition (Hayes, Barnes-Holmes & Roche 2001) — was the
  original rationale and is the weakest part. A 2022 meta-analysis found
  g = 0.57 on non-verbal IQ from five studies (N = 195), all at high risk of
  bias; a preregistered trial (Cummins et al. 2026, 107 children, n-back
  control) found no advantage on relational ability, fluid intelligence,
  reading or maths. The intro says so.
- A rising level is skill at these items, not necessarily rising ability: in
  Hayes et al. (2015) about a third of retest gains on Raven's tracked a change
  of strategy. So the level is kept apart from speed (the reasoning estimate
  moves only on generous-deadline items; a separate speed estimate prices the
  clock), all difficulty costs are fitted jointly from the answers rather than
  one at a time, and a third of syllogisms with meaningful words are
  belief-conflict items (valid but unbelievable, or believable but invalid;
  Evans, Barston & Pollard 1983).
- Relational complexity — difficulty is how many relations must be bound at
  once, with adults topping out near four (Halford, Wilson & Phillips 1998).
- Item difficulty from rule count rather than element count (Carpenter, Just &
  Shell 1990 †), generative grammars for reasoning items (Barrett et al. 2018 †),
  mental models (Johnson-Laird), conceptual spaces (Gärdenfors) — the reading
  list in `apps/syllogimous/READING.md` † goes through each.

### Composed World
**Task.** One item in stages. Speakers make claims; find which question tells
what an open speaker is, then who is a knight and who a knave. With the knaves'
words gone, the knights' words make a world of moving, sized, nested things
seen from where each speaker stands: finish analogies across it, a part at a
time with the earlier parts to be remembered, then judge claims after
transformations are announced. Easy: three things, fewer axes and speakers,
the world shown whole, true or false only.
**Loads.** Logical deduction about speakers, then relational integration across
several axes, frames of reference and time, with recall of what was taken away.
**Research.** As for Syllogimous, whose engine it is (`apps/world` opens it
pinned to this mode); knights and knaves after Smullyan.

### Relational N-back
**Task.** An n-back where the streams are judged as relations — which way did
the position move, did the tone rise — rather than "same as n ago?". A
progression ladder adds rotation, N, stimuli and, at second order, extra axes.
Streams after position join as cross-stream relations ("did the tone move the
same way as the position?"), not as plain identity streams, so the higher
rungs stay relational;
a Bayesian staircase sets the pace.
**Loads.** Updating plus relational judgement. The tiers are named for what they
ask: first-order (which way a move went), second-order (how it relates to the
move before) and two frames (the same, against cube and screen). They were once
named by Halford's relational complexity (ternary, quaternary, quinary) †, but
Halford counts what must be processed together after chunking and serial
steps, and both judgements here can be split axis by axis, except the angle
between two diagonal moves.
**Research.** N-back training (Jaeggi et al. 2008, dual n-back); relational
complexity (Halford et al. 1998) †; the adaptive staircase is, in its code's
words, a "QUEST/ZEST-style" grid posterior † — QUEST is Watson & Pelli (1983),
ZEST King-Smith et al. (1994).

### Precision N-back
**Task.** N-back with a tighter response window. (Chimera Hub calls it Threshold
N-back.)
**Research.** The n-back family (Kirchner 1958; Jaeggi et al. 2008). Its
repository has no research notes of its own.

### 3D Rotation
**Task.** Decide whether two molecules are the same structure rotated, or
mirror images.
**Research.** Mental rotation (Shepard & Metzler 1971): response time grows
linearly with the angle, as if the object were turned in the mind. Chirality —
telling a molecule from its mirror image — is the classic hard case.

### eWMT (Attentional Shield)
**Task.** An n-back with affective faces as distractors to be ignored.
**Research.** Affective (emotional) working-memory training (Schweizer,
Hampshire & Dalgleish 2011; Schweizer et al. 2013): n-back with emotional
material, aimed at the control of attention under emotional interference.

### Running Order
**Task.** A board of symbols in ranks; each card moves one symbol, addressed
only by a reference symbol and a distance, so the board must be held and
rewritten card after card.
**Loads.** Relational *updating* — keeping a structure of bindings current — as
distinct from relational integration.
**Research** (all †, from `apps/rrt/README.md`): Ackerman on consistent mapping
(a task with fixed meanings is learned as a lookup table, so no card contains
its own answer); Oberauer and colleagues on which working-memory functions
predict intelligence; Halford on relational complexity; Chuderski on time
pressure. Its README is explicit that updating has the thinnest transfer
evidence of the families, and makes no claim that training it raises anything.

### Synaesthesia colours
**Task.** Learn a colour (and shape) for every letter and digit until reading
them becomes automatic.
**Research.** Adults can be trained into synaesthesia-like grapheme–colour
associations (Bor, Rothen, Schwartzman, Clayton & Seth 2014). The trainer
measures automaticity rather than accuracy, with a Stroop interference score
and a visual-search slope † (after Stroop 1935, and Treisman's work on
pop-out).

### Relation Algebra
**Task.** Nested relations — "the place north of the place east of Red" — in
space, numbers, notes, days, headings, orientations and poses, judged, checked
for consistency, measured, or held as n-back; routes walked on a cube; and
glued spaces: fields whose edges join straight, with a twist (crossing mirrors
you, as on a Möbius band) or onto a second sheet, a new one every trial, with
six kinds of question (where a walk ends, home or back mirrored, things
drifting by velocities, which field it is from walks seen in it, whether a
loop can close, and carrying a relation from one object to another).
**Research** (all †, `apps/relations/README.md`,
`research/relation-algebra.md`): every material is a group, a relation is
`X·Y⁻¹`; relational complexity (Halford et al. 1998); structure factored from
content in the Tolman–Eichenbaum Machine (Whittington et al. 2020) and grid
cells as a translation group (Gao et al. 2021); binding as a group operation in
holographic reduced representations (Plate 1995); spatial codes organising
thought (Bellmund et al. 2018). The notes end with Melby-Lervåg et al. (2016)
and propose how the trainer could test transfer on its own records.

### aPOSNER
**Task.** A voice says digits at a steady pace; combine each with the one heard
n digits before it (+ or −) and pick the answer on a four-way cross. Bayesian,
streak or manual pace; 1- to 6-back; up to three hours.
**Research.** The Paced Auditory Serial Addition Test (Gronwall 1977) — paced
spoken arithmetic on consecutive digits — and its use as training in Cognitive
Control Training (Siegle, Ghinassi & Thase 2007). The Bayesian staircase is
CCT's (QUEST/ZEST family) with a guess rate of ¼ for four tiles †.

## Other trainers

### CCT — counted
**Task.** Spoken numbers; apply an operation to each and the one n back, typed
before the next arrives.
**Research.** PASAT-based Cognitive Control Training (Siegle et al. 2007), with
the same Bayesian staircase as aPOSNER † and a level of answers a minute at the
80% threshold, weighted by 1 + log₂ n †.

### Listening Integration — counted
**Task.** Spoken numbers at a place and a pitch; compare two relations between
them, across qualities, with nothing to press — for a walk with a locked
screen.
**Research.** Built on Dark's Relational Integration Training and its
Integration program † (lures included); relational integration across
dimensions.

### Veridical Mapping — counted
**Task.** Map a value on one perceptual dimension onto another — size onto
loudness, pitch onto position — across many pairs, with discrimination and
interference exercises.
**Research.** Stevens's split of sensory continua into prothetic ("how much":
loudness, size) and metathetic ("which kind": pitch, hue) (Stevens 1957) †, and
cross-modal correspondences (Spence 2011). Includes the Shepard tone (Shepard
1964) as an endless-glide dimension †.

### Loci Span — counted
**Task.** Words one at a time; set each, as a picture, at the next place on a
route you know, then type them back in order. Choose how readily the words
picture themselves, from vivid (dragon, gnome, knight) to purely abstract
(notion, essence); the list length adapts.
**Loads.** Serial recall through imagery: turning a word into an image and
binding it to a place, which is the hard part on abstract words.
**Research** (all †, `apps/loci/README.md`): the method of loci (Yates 1966;
Bower 1970); the imagery advantage and dual coding (Paivio 1971; norms by
Paivio, Yuille & Madigan 1968 and Scott et al. 2019); memory champions use the
method rather than different brains (Maguire et al. 2003); six weeks of loci
training more than doubled word-list recall in naive adults (Dresler et al.
2017).

### DorsalFlow — not counted yet
**Task.** Detect motion direction in visual noise, or — as AudioFlow — by ear.
Two mixed programs put the senses together: in Mixed Discrimination a Gabor
drifts while a sound sweeps through pink static, and you answer whether they
went the same way or opposite ways; Mixed Memory plays a run of such pairs
(2–8, set on its start screen), and the run's same-or-opposite answers are
given afterwards from memory, in order — each pair scored as a trial of its
own.
**Visual programs, as set here** (edits to the bundled build, not upstream):
blocks start at 0.5% contrast and never go above it; the staircase is
weighted to settle at about 65% correct (Kaernbach 1991), below the conscious
boundary near 0.4% and in the range where discrimination is still above chance
(about 0.15–0.39%); a block runs to 12 reversals or 22 trials. The background
is always 1px grain, moving static by default, since coarse grain never blends
with the Gabor.
**Research** (†, in the page): contrast sensitivity (Campbell & Robson 1968),
psychophysical thresholds (Pelli 1985), perceptual learning and noise exclusion
(Lu & Dosher 1999). Targets dorsal-stream motion sensitivity.
**Rotation** (a dashboard card): every mode in turns of a set number of
trials, 10 by default (4–40), each mode resuming exactly where it stopped.
That means DorsalFlow's five modes and the seven more dorsal programs below;
the programs run in an embedded copy of their page.
Each mode's own session restarts every block at the easy end (0.5% for
sight, 5% for sound) and spends its first trials walking down; the rotation
spends none that way. A turn resumes its staircase as it stood. A new block
starts at the player's last threshold for that condition (this rotation's,
else the latest session's, by condition and then by band) past the fast
first descent. Between rotations, each mode keeps its place in its list of
conditions. Each mode still aims at its own target: 65% for sight, 79% for
sound and the mixed modes. In the test suite's model observer, 50% of
rotation trials fall within 25% of the ideal contrast, against 37% in
standard blocks. Ending a rotation saves each mode's blocks as a session of
that mode, including a block in progress if it ran 6 trials.
**More dorsal programs** (`more/dorsalflow/programs/`, linked from the
dashboard): seven programs for what the dorsal stream builds on seeing motion.
Each runs one adaptive staircase (75% correct), sizes its stimuli in degrees
through DorsalFlow's screen calibration and times them in measured frames.
- Global motion: the share of coherent dots needed to tell left from right,
  the classic MT measure (Newsome & Paré 1988).
- Useful field of view: a shape at the centre plus, at one of eight places,
  one shape unlike the 47 identical distractors around it, then masked. Each
  is then picked out of four by number. Every shape is generated for that
  trial, so there is no set to learn, and all nine in a trial are clearly
  apart. The display time is the staircase, down to one frame, and the centre
  and periphery are scored apart. This is the speed-of-processing task from
  the ACTIVE trial (Ball et al. 2002), with generated shapes in place of its
  car, truck and triangles.
- Heading from optic flow: the offset of the focus of expansion
  (Warren & Hannon 1988).
- Speed discrimination: the Weber fraction between two bursts. The base speed
  and the durations rove, so only speed answers (McKee 1981).
- Multiple object tracking: 4 of 8 discs. The speed is the staircase and each
  pick counts on its own (Pylyshyn & Storm 1988).
- Biological motion: which way a point-light walker faces (Johansson 1973;
  Cutting 1978) among scrambled-walker noise dots. The staircase is the number
  of noise dots.
- Time to contact: a looming disc vanishes, and you judge whether a flash came
  before or after it would have arrived (Lee 1976). The staircase is the gap.

Sessions are kept under `dorsalflow_programs_v1`. Their arithmetic is in
`programs/engine.js`, which `test/run.js` tests.

### Controlled Hallucination — not counted yet
**Task.** Induce visual hallucinations (Ganzfeld, flicker, bistable figures)
and steer them top-down.
**Research** (†, in the page): seeing faces and letters in pure noise
(Gosselin & Schyns 2003, "Superstitious perceptions"); imagery biasing a
following binocular rivalry (Pearson, Clifford & Tong 2008). A companion for
emotion is sketched in `research/emotional-control.md` †, on predictive
accounts of emotion (Barrett 2017; Seth and Critchley) — notes, not a trainer.

### Synth Reader — not counted
**Task.** Read any EPUB with every letter and digit drawn in its colour from
Synth's default palette, so ordinary reading rehearses the same associations.
**Research.** As for Synaesthesia colours: grapheme–colour associations can
be trained in adults (Bor et al. 2014). Built on epub.js and JSZip.

---

## Not a trainer: the archive

The archive reads every trainer's record and places each on six bands, α to ζ,
calibrated from the Guanxinandu S11 benchmark †, each trainer in its own units.
It counts no minutes of its own.

---

## References

**Cited in this repository (†)**

- Ackerman, P. L. (1988). Determinants of individual differences during skill
  acquisition. *Journal of Experimental Psychology: General*, 117(3), 288–318.
- Barrett, D., Hill, F., Santoro, A., Morcos, A., & Lillicrap, T. (2018).
  Measuring abstract reasoning in neural networks. *ICML*.
- Barrett, L. F. (2017). *How Emotions Are Made*.
- Bellmund, J. L. S., et al. (2018). Navigating cognition. *Science*, 362.
- Campbell, F. W., & Robson, J. G. (1968). Application of Fourier analysis to
  the visibility of gratings. *Journal of Physiology*, 197, 551–566.
- Carpenter, P. A., Just, M. A., & Shell, P. (1990). What one intelligence test
  measures. *Psychological Review*, 97(3), 404–431.
- Gao, R., et al. (2021). On path integration of grid cells. *NeurIPS*.
- Gosselin, F., & Schyns, P. G. (2003). Superstitious perceptions reveal
  properties of internal representations. *Psychological Science*, 14(5).
- Halford, G. S., Wilson, W. H., & Phillips, S. (1998). Processing capacity
  defined by relational complexity. *Behavioral and Brain Sciences*, 21(6).
- Lu, Z.-L., & Dosher, B. A. (1999). Characterizing human perceptual
  inefficiencies with equivalent internal noise. *JOSA A*, 16(3).
- Melby-Lervåg, M., Redick, T. S., & Hulme, C. (2016). Working memory training
  does not improve performance on measures of intelligence or other measures of
  "far transfer". *Perspectives on Psychological Science*, 11(4), 512–534.
- Pearson, J., Clifford, C. W. G., & Tong, F. (2008). The functional impact of
  mental imagery on conscious perception. *Current Biology*, 18(13).
  (The page cites it as "Clifford and Tong, 2008".)
- Pelli, D. G. (1985). Uncertainty explains many aspects of visual contrast
  detection and discrimination. *JOSA A*, 2(9).
- Plate, T. A. (1995). Holographic reduced representations. *IEEE Transactions
  on Neural Networks*, 6(3).
- Stevens, S. S. (1957). On the psychophysical law. *Psychological Review*,
  64(3), 153–181.
- Whittington, J. C. R., et al. (2020). The Tolman–Eichenbaum Machine.
  *Cell*, 183(5).
- Oberauer; Chuderski — cited by name in `apps/rrt/README.md` without a
  specific paper.

**Background added for this summary**

- Au, J., et al. (2015). Improving fluid intelligence with training on working
  memory: a meta-analysis. *Psychonomic Bulletin & Review*, 22(2), 366–377.
- Bor, D., Rothen, N., Schwartzman, D. J., Clayton, S., & Seth, A. K. (2014).
  Adults can be trained to acquire synesthetic experiences. *Scientific
  Reports*, 4, 7089.
- Gronwall, D. M. A. (1977). Paced Auditory Serial-Addition Task: a measure of
  recovery from concussion. *Perceptual and Motor Skills*, 44(2), 367–373.
- Hayes, S. C., Barnes-Holmes, D., & Roche, B. (2001). *Relational Frame
  Theory*.
- Jaeggi, S. M., Buschkuehl, M., Jonides, J., & Perrig, W. J. (2008). Improving
  fluid intelligence with training on working memory. *PNAS*, 105(19).
- King-Smith, P. E., et al. (1994). Efficient and unbiased modifications of the
  QUEST threshold method. *Vision Research*, 34(7), 885–912.
- Kirchner, W. K. (1958). Age differences in short-term retention of rapidly
  changing information. *Journal of Experimental Psychology*, 55(4).
- Schweizer, S., Hampshire, A., & Dalgleish, T. (2011). Extending brain-training
  to the affective domain. *PLoS ONE*, 6(9).
- Schweizer, S., et al. (2013). Training the emotional brain. *Journal of
  Neuroscience*, 33(12).
- Shepard, R. N. (1964). Circularity in judgments of relative pitch. *JASA*,
  36(12).
- Shepard, R. N., & Metzler, J. (1971). Mental rotation of three-dimensional
  objects. *Science*, 171(3972), 701–703.
- Siegle, G. J., Ghinassi, F., & Thase, M. E. (2007). Neurobehavioral therapies
  in the 21st century: summary of an emerging field and an extended example of
  cognitive control training for depression. *Cognitive Therapy and Research*,
  31(2), 235–262.
- Spence, C. (2011). Crossmodal correspondences: a tutorial review. *Attention,
  Perception, & Psychophysics*, 73(4), 971–995.
- Stroop, J. R. (1935). Studies of interference in serial verbal reactions.
  *Journal of Experimental Psychology*, 18(6).
- Watson, A. B., & Pelli, D. G. (1983). QUEST: A Bayesian adaptive
  psychometric method. *Perception & Psychophysics*, 33(2), 113–120.
