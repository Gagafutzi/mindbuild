/*
 * The whole-word recordings: which words there are, and where each one's
 * MP3 sits in public/words/len<L>.bin. Written by tools/render-words.py.
 * Empty until that has been run: every length falls back to splicing.
 */

export interface WordSet {
  /** Each word as syllable indices into SYLLABLES, in the order said. */
  words: number[][];
  /** Each word's MP3 length in bytes, laid end to end in the file. */
  bytes: number[];
  /** The longest word, as rendered. */
  maxMs: number;
}

export const WORD_SETS: Record<number, WordSet> = {};
