"use strict";

/* ============================================================
   16b. SETTINGS: search, short hints, presets
   ============================================================
   Three things that make sixty-odd settings findable without moving any of them:
   a search box over the panel, hints cut to two lines with a "more", and Free Play
   presets for the setups people come back to. Nothing here owns a setting; every
   control keeps its id and its wiring, so saved profiles are untouched. */

/* ---- Search ----
   Filters the open mode's sections down to the groups whose text matches, and
   opens the sections that keep any. Cleared, every section goes back to the open
   or closed state it had before the search began. */
function initSettingsSearch() {
  const body = document.querySelector('#settingsPanel .settings-body');
  if (!body || $('settingsSearch')) return;
  const wrap = document.createElement('div');
  wrap.className = 'settings-search';
  wrap.innerHTML = `<input type="search" id="settingsSearch" placeholder="Search settings"
    aria-label="Search settings" autocomplete="off">`;
  body.insertBefore(wrap, body.firstChild);
  const input = wrap.querySelector('input');
  let saved = null;
  /* Keys typed here must not answer a trial or fire a shortcut. */
  input.addEventListener('keydown', e => e.stopPropagation());
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    const sects = [...body.querySelectorAll('details.sect')];
    if (!q) {
      sects.forEach(d => {
        d.classList.remove('search-hidden');
        d.querySelectorAll('.search-hidden').forEach(g => g.classList.remove('search-hidden'));
        if (saved && saved.has(d)) d.open = saved.get(d);
      });
      saved = null;
      return;
    }
    if (!saved) saved = new Map(sects.map(d => [d, d.open]));
    sects.forEach(d => {
      const title = (d.querySelector('summary') || {}).textContent || '';
      const groups = [...d.querySelectorAll('.setting-group')];
      let any = title.toLowerCase().includes(q);
      groups.forEach(g => {
        const hit = any || g.textContent.toLowerCase().includes(q);
        g.classList.toggle('search-hidden', !hit);
        if (hit) any = true;
      });
      /* A section built of other things (stream rows, key lists) is matched whole. */
      if (!groups.length && d.textContent.toLowerCase().includes(q)) any = true;
      d.classList.toggle('search-hidden', !any);
      if (any) d.open = true;
    });
  });
}

/* ---- Short hints ----
   A hint longer than a couple of lines is cut to two, with a "more" to open it.
   Hints the code rewrites (those with an id) are left whole: their length changes
   with the setting, and a cut that was right for one text is wrong for the next. */
const HINT_CUT = 170;
function initShortHints() {
  document.querySelectorAll('#settingsPanel .hint:not([id])').forEach(h => {
    if (h.dataset.cut || h.textContent.trim().length <= HINT_CUT) return;
    h.dataset.cut = '1';
    h.classList.add('clamp');
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'hint-more';
    more.textContent = 'more';
    more.setAttribute('aria-expanded', 'false');
    more.onclick = () => {
      const open = h.classList.toggle('clamp');
      more.textContent = open ? 'more' : 'less';
      more.setAttribute('aria-expanded', String(!open));
    };
    h.after(more);
  });
}

/* ---- Free Play presets ----
   Each sets the mechanics and the streams and leaves pacing, block length, the
   cube and everything on the display side as they were. The base clears every
   mechanic first, so a preset is the setup it names and not that setup on top of
   whatever was left on before. */
const PRESET_BASE = {
  meta: false, gate: 0, retro: 0, varN: 0, nest: 0, nestWidth: 1, nestFrames: false,
  openSpace: false, metaPairs: false, coordAxes: [], singleAxis: false,
};
const FREE_PRESETS = [
  { id: 'classic',  label: 'Classic dual n-back — position and letter, N 2',
    set: { n: 2, streams: { position: 'identity', letter: 'identity' } } },
  { id: 'relational', label: 'Relational — which way the cube moved, N 2',
    set: { n: 2, streams: { position: 'relational' } } },
  { id: 'second',   label: 'Second order — how this move relates to the last',
    set: { n: 1, meta: true, streams: { position: 'relational' } } },
  { id: 'nested',   label: 'Nested levels — depth 2',
    set: { nest: 2, streams: { position: 'relational' } } },
  { id: 'nested2',  label: 'Nested second order — depth 2',
    set: { nest: 2, meta: true, streams: { position: 'relational' } } },
  { id: 'turns',    label: 'Nested with turn frames — depth 2',
    set: { nest: 2, nestFrames: 'turn', streams: { position: 'relational' } } },
  { id: 'open',     label: 'Open space — relational, N 2, the cube can leave the lattice',
    set: { n: 2, openSpace: true, streams: { position: 'relational' } } },
  { id: 'pairs',    label: 'Pairs and their sums — 1 with 2, 3 with 4, then the sums',
    set: { meta: true, metaPairs: true, streams: { position: 'relational' } } },
  { id: 'openView', label: 'Open space with a changing view — position and view relational, N 2',
    set: { n: 2, openSpace: true, streams: { position: 'relational', view: 'relational' } } },
];

function applyFreePreset(id) {
  const p = FREE_PRESETS.find(x => x.id === id);
  if (!p) return;
  Object.assign(freeCfg, PRESET_BASE, p.set, {
    coordAxes: (p.set.coordAxes || []).slice(),
    streams: { ...p.set.streams },
  });
  applyFree();
  syncSettingsUI();
  updateHUD();
  saveProgress();
}

function initFreePresets() {
  const pane = $('freePane');
  if (!pane || $('freePreset')) return;
  const wrap = document.createElement('div');
  wrap.className = 'setting-group preset-group';
  wrap.innerHTML = `<label for="freePreset">Start from a preset</label>
    <select id="freePreset">
      <option value="">Choose one…</option>
      ${FREE_PRESETS.map(p => `<option value="${p.id}">${p.label}</option>`).join('')}
    </select>
    <div class="hint">Sets the streams and the mechanics and turns every other mechanic
      off. Speed, block length, the cube and the display stay as they are.</div>`;
  pane.insertBefore(wrap, pane.firstChild);
  const sel = wrap.querySelector('select');
  sel.onchange = () => { applyFreePreset(sel.value); sel.value = ''; };
}

function initSettingsTidy() {
  initFreePresets();
  initSettingsSearch();
  initShortHints();
}
