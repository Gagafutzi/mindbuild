# Veridical Mapping (experimental)

The Veridical Mapping Training Engine, experimental build: pairs of perceptual
dimensions — prothetic ("how much": size, loudness, duration…) and metathetic
("which kind": pitch, hue, contour…) — and exercises that map a value on one
onto the other. Brought in as the single page it was, unchanged except for the
section marked "ACTIVE TIME + THE CHIMERA RECORD".

That section is what lets the hub count it. The page kept its own sessions
under `vmt2:` but no times, so it now measures active time — the time between
answers, any one gap counted as 60 s at most, nothing while the tab is hidden —
and appends each session to `chimera.vmt.record.v1` in the Chimera record
format (`../relations/harness/FORMAT.md`), which the meter, the archive and the
gate read. Sessions played before this have no time and are not counted.

It has no single difficulty number, so the record carries no `level`; the
median mapping threshold is in each session's `extra`.
