"use strict";

/* ============================================================
   THE HUB'S COLOUR, as one number
   ============================================================

   A hue, 0–360, kept under one localStorage key. The hub's look is sage on
   near-black; this turns the same look to any hue by moving every colour's
   hue by the same amount and leaving saturation and lightness exactly where
   the stylesheet put them. So a pick is a different colour of the same theme
   — contrast, and therefore readability, does not change with it.

   Nothing stored means nothing is set: the stylesheet's own values stand, to
   the last digit. "Reset" removes the key rather than writing sage back.

   Read by the shell, which owns the slider, and by trainers that wear the
   hub's tokens (aPOSNER). Each passes its own variable map, since their
   stylesheets name the same colours differently. A trainer opened inside the
   hub hears a change through the storage event and repaints at once.

   Plain ES5, no dependencies; works as a script tag (`HubTheme`).
*/

var HubTheme = (function () {

  var KEY = "mindbuild.theme.hue";
  /* The hue the stylesheets were written in: sage. */
  var BASE = 147;

  /* The palette, in HSL, at the base hue. Each entry is [hue offset from
     BASE, saturation %, lightness %], measured off the stylesheet's hex values
     so that the base hue reproduces them. */
  var TONES = {
    bg:        [8,  24,  4.1],
    bg2:       [11, 24,  6.7],
    panel:     [3,  21,  7.5],
    panelHi:   [3,  21, 13.0],
    ink:       [-1, 30, 83.3],
    inkStrong: [-1, 41, 92.9],
    dim:       [-1, 12, 54.9],
    accent:    [0,  28, 65.1],
    accent2:   [-2, 32, 78.2],
    ok:        [-1, 33, 74.3],
  };

  function hue() {
    try {
      var v = localStorage.getItem(KEY);
      if (v === null || v === "") return null;
      var n = Number(v);
      return isFinite(n) ? ((Math.round(n) % 360) + 360) % 360 : null;
    } catch (e) {
      return null;
    }
  }

  function setHue(h) {
    try {
      if (h === null) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, String(((Math.round(h) % 360) + 360) % 360));
    } catch (e) { /* storage refused: the change still applies to this page */ }
  }

  function rgb(h, s, l) {
    s /= 100; l /= 100;
    var k = function (n) { return (n + h / 30) % 12; };
    var a = s * Math.min(l, 1 - l);
    var f = function (n) {
      return Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
    };
    return [f(0), f(8), f(4)];
  }

  /** Every tone at hue `h`, as [r, g, b]. */
  function palette(h) {
    var out = {};
    for (var name in TONES) {
      var t = TONES[name];
      out[name] = rgb(((h + t[0]) % 360 + 360) % 360, t[1], t[2]);
    }
    return out;
  }

  var hex = function (c) {
    return "#" + c.map(function (v) { return (v < 16 ? "0" : "") + v.toString(16); }).join("");
  };
  var rgba = function (c, a) { return "rgba(" + c.join(", ") + ", " + a + ")"; };
  var triple = function (c) { return c.join(", "); };

  /**
   * Paint `root` (a document's <html>) at the stored hue, or clear what an
   * earlier call set. `map` takes the palette and returns the custom
   * properties to set, so each page can name its own.
   */
  function apply(root, map) {
    var h = hue();
    var set = map(palette(h === null ? BASE : h), h === null ? 0 : h - BASE);
    for (var prop in set) {
      if (h === null) root.style.removeProperty(prop);
      else root.style.setProperty(prop, set[prop]);
    }
    return h;
  }

  /** Repaint whenever another page on this origin moves the slider. */
  function follow(root, map) {
    apply(root, map);
    window.addEventListener("storage", function (e) {
      if (e.key === KEY || e.key === null) apply(root, map);
    });
  }

  return {
    KEY: KEY, BASE: BASE,
    hue: hue, setHue: setHue, palette: palette,
    apply: apply, follow: follow,
    hex: hex, rgba: rgba, triple: triple,
  };
})();

if (typeof module !== "undefined") module.exports = HubTheme;
