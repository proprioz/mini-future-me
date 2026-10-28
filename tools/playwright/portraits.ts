// Ground truth for the test set in public/portraits (fictional AI-generated people; what each one
// shows is described in public/portraits/Personne_NN/fiche.md).
// The game only has common options and main colours: a rare trait is expected as its closest option
// (turban → beanie or cap, long beard → beard, thin moustache → moustache or none, teal → blue or
// green). Several options are acceptable when the photo is ambiguous for our chibi styles, once fitted
// to the estimated gender (options.ts: long hair on a man becomes short), or when the scan can't tell
// them apart (goatee or full beard: their frequencies decide).
// A person without an entry here is still shown by the comparison (pnpm portraits), without a score.
import { CLOTH_NAMES, HAIR_NAMES } from '/src/scan/classify.ts';
import { codedFor } from '/src/character/options.ts';
import type { Look } from '/src/character/Character.ts';

export const VIEWS = ['01_face', '02_profil_gauche', '03_profil_droit', '04_dos'];

/** What a person shows: the acceptable options (or colour names) of each checked look key. */
export type Truth = Partial<Record<keyof Look, string | string[]>>;

/** A field of a look that differs from the truth. */
export interface Miss {
  key: string;
  got: string;
  expected: string;
}

export const PEOPLE: Record<number, Truth> = {
  1: { hairStyle: ['bun'], hair: 'noir', glasses: 'none', beard: 'none', mustache: 'none', top: 'blanc' },
  2: { hairStyle: ['short'], hair: 'gris', glasses: 'none', beard: ['stubble'], mustache: 'none', top: 'marine' },
  3: { hairStyle: ['long', 'medium', 'bob'], hair: 'blond', glasses: 'none', beard: 'none', mustache: 'none', top: ['blanc', 'beige'] },
  4: { hairStyle: ['short'], hair: 'noir', glasses: ['square', 'bold', 'round'], beard: 'none', mustache: 'none', top: 'rouge' },
  5: { hairStyle: ['curlyLong', 'curly'], hair: 'brun', glasses: 'none', beard: 'none', mustache: 'none', top: 'beige' },
  6: { hairStyle: ['long'], hair: 'roux', glasses: 'none', beard: 'none', mustache: 'none', top: 'noir' },
  7: { hairStyle: ['short'], hair: 'brun', glasses: 'none', beard: ['none', 'stubble'], mustache: ['thick'], top: ['brun', 'noir'] },
  8: { hairStyle: ['any'], headwear: 'headscarf', hair: '-', glasses: 'none', beard: 'none', mustache: 'none', top: 'noir' },
  9: { hairStyle: ['short'], hair: 'gris', glasses: 'none', beard: 'none', mustache: 'none', top: ['noir', 'gris'] },
  10: { hairStyle: ['curly', 'curlyFade'], hair: 'noir', glasses: 'none', beard: ['none', 'stubble'], mustache: 'none', top: 'blanc' },
  11: { hairStyle: ['pixie', 'bob'], hair: 'gris', glasses: ['square', 'bold'], beard: 'none', mustache: 'none', top: 'bleu' },
  12: { hairStyle: ['curly', 'curlyFade', 'short'], hair: 'châtain', glasses: 'none', beard: ['stubble', 'short'], mustache: ['thick', 'none'], top: 'vert' },
  13: { hairStyle: ['ponytail', 'any'], headwear: 'cap', hair: 'brun', glasses: 'none', beard: 'none', mustache: 'none', top: 'gris' },
  14: { hairStyle: ['curly'], hair: 'gris', glasses: ['round', 'square', 'bold'], beard: 'none', mustache: 'none', top: 'noir' },
  15: { hairStyle: ['shaved', 'bald', 'buzz'], hair: '-', glasses: ['square', 'bold'], beard: ['short', 'stubble'], mustache: ['thick'], top: 'noir' },
  16: { hairStyle: ['locs', 'short', 'curly', 'curlyFade'], hair: 'noir', glasses: 'none', beard: ['goatee', 'stubble', 'short'], mustache: ['thick', 'none'], top: 'marine' },
  17: { hairStyle: ['locs', 'long', 'medium'], hair: 'noir', glasses: ['square', 'bold', 'round'], beard: 'none', mustache: 'none', top: 'noir' },
  18: { hairStyle: ['any'], headwear: ['beanie', 'cap'], hair: '-', glasses: 'none', beard: ['short'], mustache: ['thick'], top: 'bleu' },
  19: { hairStyle: ['long', 'medium'], hair: 'brun', glasses: 'none', beard: 'none', mustache: 'none', top: 'noir' },
  20: { hairStyle: ['buzz', 'short'], hair: 'noir', glasses: 'none', beard: ['short'], mustache: ['thick'], top: 'blanc' },
  // 21 (child): two plaits.
  21: { hairStyle: ['braids'], hair: 'noir', glasses: 'none', beard: 'none', mustache: 'none', top: 'jaune' },
  22: { hairStyle: ['curlyFade', 'curly'], hair: 'noir', glasses: 'none', beard: 'none', mustache: 'none', top: 'vert' },
  // 23: clear frames.
  23: { hairStyle: ['bob', 'medium'], hair: 'noir', glasses: ['square', 'round', 'bold'], beard: 'none', mustache: 'none', top: 'rouge' },
  24: { hairStyle: ['bald', 'shaved', 'buzz'], hair: '-', glasses: 'none', beard: ['short'], mustache: ['thick'], top: ['noir', 'gris'] },
  // 25: goatee and thin moustache, rust overshirt.
  25: { hairStyle: ['curlyFade'], hair: 'noir', glasses: 'none', beard: ['goatee', 'short', 'stubble'], mustache: ['thick', 'none'], top: ['rouge', 'brun'] },
  // 26: dark teal sweater.
  26: { hairStyle: ['curly', 'pixie'], hair: ['gris', 'blanc'], glasses: 'none', beard: 'none', mustache: 'none', top: ['bleu', 'vert'] },
  // 27: dark green headscarf.
  27: { hairStyle: ['any'], headwear: 'headscarf', hair: '-', glasses: 'none', beard: 'none', mustache: 'none', top: ['blanc', 'beige'] },
  // 28: turban (like 18) → beanie or cap; long white beard → beard.
  28: { hairStyle: ['any'], headwear: ['beanie', 'cap'], hair: '-', glasses: 'none', beard: ['short'], mustache: ['thick'], top: 'bleu' },
  // 29: clear frames.
  29: { hairStyle: ['curly'], hair: 'noir', glasses: ['square', 'bold', 'round'], beard: 'none', mustache: 'none', top: ['bleu', 'vert'] },
  30: { hairStyle: ['short', 'curly', 'curlyFade'], hair: 'noir', glasses: 'none', beard: 'none', mustache: 'none', top: 'vert' },
  // 31: clear frames, plum sweater.
  31: { hairStyle: ['curlyFade', 'curly'], hair: 'noir', glasses: ['square', 'bold', 'round'], beard: 'none', mustache: 'none', top: ['rouge', 'violet'] },
  32: { hairStyle: ['medium', 'long'], hair: 'roux', glasses: 'none', beard: 'none', mustache: 'none', top: 'marine' },
  // 33: two grey plaits.
  33: { hairStyle: ['braids'], hair: 'gris', glasses: 'none', beard: 'none', mustache: 'none', top: 'brun' },
  34: { hairStyle: ['curly', 'short'], hair: ['noir', 'gris'], glasses: 'none', beard: ['short'], mustache: ['thick'], top: ['beige', 'blanc'] },
  35: { hairStyle: ['curlyFade', 'curly'], hair: ['noir', 'brun'], glasses: 'none', beard: 'none', mustache: 'none', top: 'jaune' },
  // 36: thin metal frames; lavender cardigan.
  36: { hairStyle: ['pixie', 'short', 'bob'], hair: ['gris', 'blanc'], glasses: ['round', 'square'], beard: 'none', mustache: 'none', top: ['violet', 'rose', 'gris', 'bleu'] },
  // 37: long grey locs, short grey beard.
  37: { hairStyle: ['locs', 'long'], hair: 'gris', glasses: 'none', beard: ['short'], mustache: ['thick'], top: 'rouge' },
  // 38: clear frames.
  38: { hairStyle: ['curlyLong', 'long'], hair: 'blond', glasses: ['square', 'bold', 'round'], beard: 'none', mustache: 'none', top: 'bleu' },
  // 39: clear frames.
  39: { hairStyle: ['short', 'curly', 'medium'], hair: 'noir', glasses: ['square', 'bold'], beard: 'none', mustache: ['thick'], top: ['beige', 'blanc'] },
  40: { hairStyle: ['curlyFade', 'curly'], hair: ['brun', 'châtain'], glasses: 'none', beard: 'none', mustache: 'none', top: 'gris' },
};

/** Presentation the test photos show (to measure the gender estimate, never displayed). */
export const PRESENTATION = { 1: 'F', 2: 'M', 3: 'F', 4: 'M', 5: 'F', 6: 'F', 7: 'M', 8: 'F', 9: 'M', 10: 'M', 11: 'F', 12: 'M', 13: 'F', 14: 'F', 15: 'M', 16: 'M', 17: 'F', 18: 'M', 19: 'F', 20: 'M',
  21: 'F', 22: 'M', 23: 'F', 24: 'M', 25: 'M', 26: 'F', 27: 'F', 28: 'M', 29: 'F', 30: 'M', 31: 'M', 32: 'F', 33: 'F', 34: 'M', 35: 'F', 36: 'F', 37: 'M', 38: 'F', 39: 'M', 40: 'M' };

export function photoUrl(person: number, view: string) {
  return `/portraits/Personne_${String(person).padStart(2, '0')}/${view}.jpg`;
}

const COLOR_NAMES: Partial<Record<string, Record<string, string>>> = { hair: HAIR_NAMES, top: CLOTH_NAMES };
const CHECKED: (keyof Look)[] = ['hairStyle', 'headwear', 'hair', 'glasses', 'beard', 'mustache', 'top'];

/** Colour names of the truth are short: 'noir' for 'noirs', 'marine' for 'bleu marine'. */
function matches(key: string, value: string, expected: string) {
  if (!COLOR_NAMES[key]) return value === expected;
  const name = COLOR_NAMES[key][value] ?? value;
  return name === expected || name === `${expected}s` || name.endsWith(` ${expected}`);
}

// Options and colours coded for a gender (options.ts): a look picked by the game never mixes them.
const GENDERED: (keyof Look)[] = ['hairStyle', 'beard', 'mustache', 'outfit', 'headwear', 'glasses', 'earrings', 'top', 'bottom', 'shoes', 'headwearColor', 'earringColor'];

/**
 * Fields of `look` that differ from the truth of `person`: [{ key, got, expected }], or null without
 * truth. Also a miss: options of both genders in the same look (`genre`).
 */
export function check(person: number, look: Partial<Look>): Miss[] | null {
  const truth = PEOPLE[person];
  if (!truth) return null;
  const misses: Miss[] = [];
  const coded = GENDERED.map((key) => [key, codedFor(key, look[key] as string)]).filter(([, gender]) => gender);
  if (new Set(coded.map(([, gender]) => gender)).size > 1) {
    misses.push({ key: 'genre', got: coded.map(([key, gender]) => `${key} ${gender}`).join(' + '), expected: 'un seul genre' });
  }
  for (const key of CHECKED) {
    const expected = [truth[key] ?? 'none'].flat();
    if (expected.includes('any') || expected.includes('-')) continue;
    const got = look[key] ?? 'none';
    if (!expected.some((e) => matches(key, got, e))) {
      misses.push({ key, got: COLOR_NAMES[key]?.[got] ?? got, expected: expected.join(' | ') });
    }
  }
  return misses;
}
