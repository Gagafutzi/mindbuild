# Synth Reader

An EPUB reader that draws every letter and digit in its colour from Synth's
default palette (`apps/synth`, `DEFAULT_COLORS`), so ordinary reading becomes
practice of the same associations. Lowercase takes its uppercase letter's
colour and accented letters read as their base letter, as in Synth.

- **Built on [epub.js](https://github.com/futurepress/epub.js) 0.3.93**
  (BSD-2-Clause) and **[JSZip](https://stuk.github.io/jszip/) 3.10.1**
  (MIT or GPLv3), vendored in `vendor/` with their licences, so the reader
  runs offline. Neither is modified.
- **Colouring** happens per chapter in epub.js's content hook: every text node
  is split so each A–Z / 0–9 is a span with one class per symbol, and one
  stylesheet colours the classes — switching colours off empties that
  stylesheet without re-reading the book. Near-black colours get Synth's faint
  white halo, which is display only.
- **The page** is Synth's dark surface, forced inside each chapter so a book's
  own white background cannot hide U and Y.
- **My palette** appears when Synth has custom colours saved in this browser
  (`synth_colors_en`), and uses those instead of the defaults.
- The last book is kept in IndexedDB (`mindbuild.reader`) and the place in it
  in localStorage, so it reopens where you left it.

It keeps no session record, so the hub does not count its time.
