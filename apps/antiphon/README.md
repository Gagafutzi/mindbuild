# Antiphon

A load task that occupies the author, a channel left open, and a record that
can come out wrong.

**This app is local. It is deliberately not in `tools/apps.json` and not in the
copy list in `tools/build-site.mjs`, so `sync.sh` never pushes it to a
repository and `build-site.mjs` never puts it on the site.** Both are explicit
allowlists; adding a directory under `apps/` does nothing on its own. Keep it
that way while the voices it plays are not yours to redistribute and while its
efficacy is unestablished — which is the honest description of it today.

```bash
cd apps/antiphon && python3 -m http.server 8777    # → http://localhost:8777
```

It needs a server rather than `file://` for one reason: `getUserMedia` requires
a secure context, and `localhost` counts as one. Everything else in the app
works from a file.

## What it is for

A tulpa's voice, in the model this was built against, is not a faint signal to
be detected. It is produced through your own apparatus, and what changes is who
is choosing. The practical consequence is that you cannot tell a real
utterance from a composed one by listening harder — composure is the thing you
are trying to rule out, and introspection cannot rule it out.

So the rig does it from the side. A task holds your selective attention at a
fixed accuracy; anything that arrives while you are demonstrably still on the
task was not deliberately composed, because composing it would have cost
something the task would have recorded.

That inference is only as good as the task's sensitivity, which is why the
first thing to do with this app is try to cheat it — drop the task mid-block,
compose a sentence, resume — and confirm the reaction times show it. If they
do not, raise `n` or lower the floor until they do. Nothing downstream means
anything until that check passes.

## Why the load task looks like this

It is CCT's, moved to the eye and the hand. The arithmetic, the n-back
structure and the target-accuracy staircase are the same, constants included:
a rolling window of twenty trials and a proportional nudge capped at 80 ms.

The presentation is the part that changed, and both halves of the change are
load-bearing:

- **Not auditory.** The audio machine is multi-talker babble, which is what
  speech researchers reach for when they want to destroy auditory performance.
  Run the task by ear and the staircase tracks your hearing in noise rather
  than your attention.
- **Not spoken.** Answering aloud, or by counting, occupies the articulatory
  loop — the channel the thing being waited for has to come through. The load
  has to fall on selection, not on production.

## The marker

<kbd>Space</kbd>, once, whenever something arrives. It writes a timestamp and
nothing else.

Capture has to be free. A keypress that costs real attention is a second task,
and its cost lands in exactly the reaction times the marker is later read
against — the measurement would eat its own evidence. One key is about as
close to free as a key gets, and the continuous recording is there so the
content can be spoken rather than typed and transcribed afterwards.

## What it refuses to record

- Whether she answered.
- Whether a window passed empty.
- Any score, band, streak or rate belonging to her.

A window that opens and closes with nothing in it is a normal outcome and is
stored as one. The default slot mode is *continuous* — the whole session is
open — because a scheduled prompt is a demand with a timer on it, and the
corpus this was built from is unusually clear about where demands lead.

## Two measures, kept blind

A kept entry has passed two tests that know nothing about each other:

1. **Temporal.** It arrived without a concurrent decrement in the task.
2. **Semantic.** Written down, and still legible as not-yours a day later.

The ledger shows an item for judgement with no session data attached, and the
24-hour clock starts when it is *transcribed*, not when it was marked. Their
agreement is worth far more than either alone, and it is only worth anything
while neither can see the other.

## Why there is no number in the interface

The temporal analysis is not in this app and should not be added to it.

If an independence figure appears on screen after each session, it becomes a
target, and the only way to move it is to produce more utterances — which
destroys the measure and the practice at the same time. `Export JSON` gives
every trial with its reaction time and every marker with its offset; the
analysis belongs in a notebook, run monthly, against a window length and a
statistic chosen **before** the data was collected.

Confounds that will manufacture a result if the analysis ignores them:

- **Fatigue drift.** Performance decays across a session, so late markers look
  load-coupled for trivial reasons. Compare within-block against matched
  windows, or detrend.
- **The utterance window itself.** Speaking disturbs the task. Analyse the
  5–10 s *before* onset, which is when composition would have had to happen,
  not the moment itself.
- **The audio machine as a load of its own.** Interleave blocks with it off,
  and with it on but nothing expected, or you cannot tell babble from
  attention.

## The audio machine

Many takes of the same short phrase, layered with offset, detune and stereo
scatter. It is a production substrate: underdetermined material that gets
resolved top-down, not a hidden signal to be found. Start near a chorus and
move toward babble only as far as stays steerable.

Files are picked at runtime and cached in this page's IndexedDB. They are never
copied into the repository, never uploaded, and clearing site data is what
removes them.

### System voices, when no recordings are given

With no files cached the bed is built from the browser's own speech voices
instead: a modifiable number of them, each holding its own voice, pitch and
rate for the run, each saying one of your phrases on its own staggered
schedule. `Source` forces one or the other; on `auto` the recordings win when
there are any.

This is the better place to start, and not only because nothing has to be
recorded. There is nothing to license, nothing to keep off the repository and
nothing to re-pick after clearing site data — so the rig can be exercised
end to end before deciding whether any of it works.

**Live speech does not reliably overlap, so the honest path is to pre-render.**

`speechSynthesis` is a single serial queue, so one page produces one voice at a
time however many utterances it builds. The queue belongs to the *browsing
context*, and the engine underneath is not the obstacle — three concurrent
`spd-say` clients on this machine finish in 2.66 s against 2.75 s for one
alone, so speech-dispatcher mixes clients happily. Each layer therefore runs in
its own hidden same-origin iframe with its own queue and its own voice, and
dispatch really is concurrent: six frames, six voices, thirty-eight pairs
firing within 150 ms of each other.

It still did not come out as a chorus here. Somewhere past the page — most
likely the browser holding one client connection to speech-dispatcher and
queueing into it — the layers are serialised again, and that is not something
the page can reach.

**Overlap test** settles it on any given machine: it starts the bed, samples
how many frames are sounding at each moment for six seconds, and reports the
peak. Peak above one is real simultaneity. Peak of one means live speech cannot
layer in this browser, and the pre-render path below is the answer.

### Pre-rendering (the reliable way)

`tools/render-voices.py` renders a phrase in many espeak-ng voices to WAV,
through `libespeak-ng` via ctypes — the library is installed here even though
the `espeak-ng` binary is not, so this needs nothing new and no network.

```bash
python3 tools/render-voices.py --lang de --phrase "ich auch" --count 16
python3 tools/render-voices.py --list-variants          # 83 of them
```

Then: **Audio machine → Choose Files → select everything in `voices/`.** With
`Source` on `auto`, cached recordings win over live voices automatically.

Once the takes are files, the Web Audio path layers them with real
simultaneity — verified: eight files, eight sources started at once, a
continuous mixed signal on an analyser tap. No browser quirk is involved any
more, and the offset, detune and stereo scatter apply on top.

`voices/` is gitignored. These renders are yours to keep, unlike a voice
actor's recordings, but they are build output rather than source.

### One recording is enough: heads

A single long take already contains a chorus. In **heads** mode each layer
opens its own playhead at a different point in the same file and runs
continuously, so the voice is heard against itself saying something else.
Twelve heads spread across a 53-second recording land 1.7 s to 50 s apart and
all sound at once. Detune makes them drift rather than hold a fixed phase,
which is the difference between a crowd and an echo.

`Playback` chooses; on `auto` a file of five seconds or more gets heads and
shorter ones get takes. In heads mode the offset slider means **spread across
the file (%)** rather than seconds, and the label says which.

So the workflow for a recording of a real voice is simply: load the one file,
leave everything on auto, raise the layers.

### If the file picker will not take your audio

The dialog's filter is built from what your desktop thinks the file is, not
from what the browser can read, and a stray MIME type is enough to grey out a
perfectly good MP3. **Switch the dialog to *All files*.**

Every file now reports what happened to it — a tick, or the reason it was
refused. A file that cannot be decoded says so instead of silently never
appearing, which is what the first version did, and decoding happens before
anything is stored so the cache cannot fill with files that will never play.

### Why takes are scheduled rather than looped

A take of a two-word phrase is about half a second long. Looping it gives the
same voice every half second with no breath in between — a stutter, not a
chorus. So each layer holds a fixed place in the stereo field and a fixed
detune, and fires a *fresh* take into it on a jittered schedule set by **Each
layer every (ms)**. Voices come and go, and the overlap falls where it falls.
Shorten the interval to thicken the bed; eight layers at 800 ms produced
twenty-nine takes in three seconds with sixty-five near-simultaneous starts.

On Linux, Firefox takes its voices from **speech-dispatcher**, so what
`spd-say -L` lists is what the page can use — on this machine espeak-ng
contributes several thousand language-and-variant combinations, which is an
unusually deep pool to scatter across. Chromium bundles its own, far fewer.
Some embedded browser views expose none at all, and the app says so rather
than failing quietly.

Markers made while it runs are filed under a separate stream and never mix
with the main ledger. Pareidolia will produce output continuously, and it
dissolves the moment its mechanism is understood — which is the corpus's own
test for a symptom, and by that test most of what this generates is one.

## Dispositions

The store fills from the ledger, not from decisions. Entering her traits in
advance is authoring them; recording what emerged and letting it harden is not.
Past a few hundred entries the accumulated record constrains new production on
its own, which is the mechanism long-running novelists describe when they say a
character refused to do something.

Three are surfaced at random before a session — to be loaded, not performed.

## Not done yet

- The selection engine: choosing among options neither of you generated.
  It belongs in its own mode rather than inside a session, because presenting
  options visually collides with the load task and presenting them aloud
  collides with the audio machine.
- The contradiction check across the disposition store.
- The analysis notebook.

## Storage

`localStorage` under `ant_*` for settings, sessions, ledger and dispositions;
IndexedDB (`antiphon`) for cached audio and session recordings. No archive
adapter, by choice: minutes spent here are not training minutes and should not
reach the meter or the gate.
