import { KeyBindings, Modality, Settings } from './types';

/* The keys the app always had: A and F under the left hand, J K L under the right. */
export const DEFAULT_KEYS: KeyBindings = {
  spatial: 'a',
  color: 'f',
  shape: 'j',
  syllable: 'k',
  audio: 'l',
};

export const MODALITY_ORDER: Modality[] = ['spatial', 'color', 'audio', 'shape', 'syllable'];

export const MODALITY_LABEL: Record<Modality, string> = {
  spatial: 'Position',
  color: 'Color',
  audio: 'Audio',
  shape: 'Shape',
  syllable: 'Syllable',
};

/* Keys that cannot be an answer. Modifiers never arrive alone in a way a person
   means; Tab moves focus and Escape cancels the capture. */
const UNBINDABLE = new Set(['shift', 'control', 'alt', 'meta', 'altgraph', 'capslock', 'tab', 'escape',
  'dead', 'unidentified', 'process']);

/* KeyboardEvent.key, lowercased, so a binding does not depend on Shift or Caps Lock. */
export const keyOf = (e: KeyboardEvent): string => e.key.toLowerCase();

export const bindable = (key: string): boolean => !!key && !UNBINDABLE.has(key);

/* Saved settings are spread over the defaults one level deep (useLocalStorage),
   so a bindings object saved before a modality existed lacks that modality. Each
   one falls back to its default unless that key is already taken by another. */
export function resolveKeys(settings: Pick<Settings, 'keyBindings'>): KeyBindings {
  const saved = settings.keyBindings || ({} as Partial<KeyBindings>);
  const out = {} as KeyBindings;
  const used = new Set<string>();
  MODALITY_ORDER.forEach(m => { if (saved[m] && bindable(saved[m]!)) { out[m] = saved[m]!; used.add(saved[m]!); } });
  MODALITY_ORDER.forEach(m => {
    if (out[m]) return;
    out[m] = used.has(DEFAULT_KEYS[m]) ? '' : DEFAULT_KEYS[m];
    if (out[m]) used.add(out[m]);
  });
  return out;
}

/* Bind `key` to `m`. A key already used by another modality moves over, and that
   modality takes the old key of `m`, so two answers never share one key. */
export function rebind(keys: KeyBindings, m: Modality, key: string): KeyBindings {
  const next = { ...keys };
  const other = MODALITY_ORDER.find(o => o !== m && next[o] === key);
  if (other) next[other] = keys[m];
  next[m] = key;
  return next;
}

export function modalityForKey(keys: KeyBindings, key: string): Modality | null {
  return MODALITY_ORDER.find(m => keys[m] === key) || null;
}

const NAMED: Record<string, string> = {
  ' ': 'Space', arrowleft: '←', arrowright: '→', arrowup: '↑', arrowdown: '↓',
  enter: 'Enter', backspace: 'Bksp', delete: 'Del', home: 'Home', end: 'End',
  pageup: 'PgUp', pagedown: 'PgDn', insert: 'Ins',
};

/* How a key is written on a button: letters upper-case, named keys short. */
export function keyLabel(key: string): string {
  if (!key) return '—';
  if (NAMED[key]) return NAMED[key];
  if (key.length === 1) return key.toUpperCase();
  return key.charAt(0).toUpperCase() + key.slice(1);
}
