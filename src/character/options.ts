import { draw, skinGroup } from './population.ts';
import type { AgeGroup, Gender } from './population.ts';
import type { Look } from './Character.ts';

// Everything the visitor can pick on the "Crée ton perso" screen: few options, only traits common
// among people in Switzerland (see population.ts), so choosing is quick and the face scan always has
// a close match. A rare trait is drawn as its closest common option rather than added.
//
// Some options are coded feminine (`coded: 'f'`) or masculine (`coded: 'm'`), the others are
// neutral and go with both; `alt` is the closest option for the other gender. What the game picks
// on its own (face scan, characters of the welcome screen) never mixes the two genders; this is never
// displayed, and the visitor can still pick anything, or mix everything with « Au hasard ».

export const SKIN_TONES = ['#ffe3cf', '#f6d0b1', '#f1c7a5', '#e2ae86', '#c98f66', '#a8714d', '#86563a', '#5e3b27'];
export const EYE_COLORS = ['#5b3a29', '#2b1d17', '#8a6a2f', '#4f8f5a', '#3f7cbf'];
// Natural colours, in this order (black, brown, chestnut, red, blond, grey, white): the photo
// analysis picks them by position (scan/classify.ts).
export const HAIR_COLORS = ['#1f1612', '#4a3426', '#7a4a2a', '#b5672e', '#e8c27a', '#8f8a85', '#d9d4cf'];
// Only the main colours, the most worn first: black, grey, white, beige, brown, navy, then blue (also
// jeans), green, red, yellow, purple, pink. A measured colour takes the closest one (scan/classify.ts,
// which names them in CLOTH_NAMES): teal → blue or green, burgundy or rust → red or brown…
export const CLOTH_COLORS = [
  '#2b2b2e', '#8e9196', '#f7f3ee', '#cdb497', '#7a5236', '#2f3a56',
  '#5b7fb8', '#3f7a57', '#b83a44', '#f4c04e', '#8e72b8', '#ff9fb1',
];

// Black, tortoiseshell, gold, silver, clear plastic (see-through, accessories.ts).
export const CLEAR_FRAME = '#e4ecef';
export const GLASSES_COLORS = ['#2b2d42', '#6b4226', '#c9a227', '#b8bec6', CLEAR_FRAME];

export const METAL_COLORS = ['#ffcf4a', '#d6dde6', '#ff6fa5'];

// Pink (clothes, earrings) is coded feminine: closest colour of the same palette otherwise.
const FEMININE_COLORS: Record<string, string> = { '#ff9fb1': '#b83a44', '#ff6fa5': '#d6dde6' };

/** One choice of a list of « Crée ton perso »; `alt`: the closest option for the other gender. */
export interface Option {
  id: string;
  label: string;
  coded?: Gender;
  alt?: string;
}

export const FACE_SHAPES: Option[] = [
  { id: 'oval', label: 'Ovale' },
  { id: 'round', label: 'Rond' },
  { id: 'square', label: 'Carré' },
  { id: 'heart', label: 'En cœur' },
];

export const EYE_SHAPES: Option[] = [
  { id: 'round', label: 'Ronds' },
  { id: 'almond', label: 'En amande' },
];

export const SKIN_MARKS: Option[] = [
  { id: 'none', label: 'Aucune' },
  { id: 'freckles', label: 'Taches de rousseur' },
];

export const HAIR_STYLES: Option[] = [
  { id: 'short', label: 'Court', coded: 'm', alt: 'pixie' },
  { id: 'buzz', label: 'Rasé', coded: 'm', alt: 'pixie' },
  { id: 'shaved', label: 'Boule à zéro', coded: 'm', alt: 'pixie' },
  { id: 'bald', label: 'Chauve', coded: 'm', alt: 'pixie' },
  { id: 'curly', label: 'Bouclé' },
  { id: 'curlyFade', label: 'Boucles et dégradé', coded: 'm', alt: 'curly' },
  { id: 'pixie', label: 'Courte effilée', coded: 'f', alt: 'short' },
  { id: 'bob', label: 'Carré', coded: 'f', alt: 'short' },
  { id: 'medium', label: 'Mi-long', coded: 'f', alt: 'short' },
  { id: 'long', label: 'Long', coded: 'f', alt: 'short' },
  { id: 'curlyLong', label: 'Boucles longues', coded: 'f', alt: 'curly' },
  { id: 'locs', label: 'Locks / tresses' },
  { id: 'braids', label: 'Nattes', coded: 'f', alt: 'locs' },
  { id: 'ponytail', label: 'Queue', coded: 'f', alt: 'short' },
  { id: 'bun', label: 'Chignon', coded: 'f', alt: 'short' },
];

export const BEARDS: Option[] = [
  { id: 'none', label: 'Aucune' },
  { id: 'stubble', label: 'Barbe de 3 jours', coded: 'm', alt: 'none' },
  // A moustache, round the mouth and on the chin: always with the moustache.
  { id: 'goatee', label: 'Bouc', coded: 'm', alt: 'none' },
  // Between a short and a long beard.
  { id: 'short', label: 'Barbe', coded: 'm', alt: 'none' },
];

export const MUSTACHES: Option[] = [
  { id: 'none', label: 'Aucune' },
  { id: 'thick', label: 'Moustache', coded: 'm', alt: 'none' },
];

export const OUTFITS: Option[] = [
  { id: 'tshirt', label: 'T-shirt' },
  { id: 'hoodie', label: 'Sweat' },
  { id: 'sweater', label: 'Pull' },
  { id: 'shirt', label: 'Chemise' },
  { id: 'jacket', label: 'Veste' },
  { id: 'cardigan', label: 'Gilet' },
  { id: 'dress', label: 'Robe', coded: 'f', alt: 'tshirt' },
];

export const HEADWEAR: Option[] = [
  { id: 'none', label: 'Rien' },
  { id: 'cap', label: 'Casquette' },
  { id: 'beanie', label: 'Bonnet' },
  { id: 'headscarf', label: 'Foulard', coded: 'f', alt: 'beanie' },
];

export const GLASSES: Option[] = [
  { id: 'none', label: 'Aucune' },
  { id: 'square', label: 'Rectangles' },
  { id: 'bold', label: 'Épaisses' },
  { id: 'round', label: 'Rondes' },
  { id: 'catEye', label: 'Papillon', coded: 'f', alt: 'square' },
  { id: 'browline', label: 'Rétro', coded: 'm', alt: 'square' },
];

export const EARRINGS: Option[] = [
  { id: 'none', label: 'Aucune' },
  { id: 'studs', label: 'Puces' },
  { id: 'hoops', label: 'Anneaux', coded: 'f', alt: 'studs' },
  { id: 'drops', label: 'Pendants', coded: 'f', alt: 'studs' },
];

/** Look key → its list of options. */
const CHOICES: Record<string, Option[]> = {
  faceShape: FACE_SHAPES, eyeShape: EYE_SHAPES, skinMarks: SKIN_MARKS, hairStyle: HAIR_STYLES, beard: BEARDS, mustache: MUSTACHES,
  outfit: OUTFITS, headwear: HEADWEAR, glasses: GLASSES, earrings: EARRINGS,
};
const COLOR_KEYS = ['hair', 'beardColor', 'top', 'bottom', 'shoes', 'headwearColor', 'glassesColor', 'earringColor'];

/** Gender option `id` of look key `key` (an option or a colour) is coded for: 'f', 'm', or null (neutral). */
export function codedFor(key: string, id: string): Gender | null {
  if (COLOR_KEYS.includes(key)) return id in FEMININE_COLORS ? 'f' : null;
  return CHOICES[key]?.find((o) => o.id === id)?.coded ?? null;
}

/** `id` of option list `key` if it suits `gender` (neutral or coded for it), otherwise its alternative. */
function fitOption(key: string, id: string, gender: Gender | null): string {
  const option = CHOICES[key].find((o) => o.id === id);
  return option?.coded && gender && option.coded !== gender ? option.alt! : id;
}

// The options that show the gender most, first: what an unknown gender is taken from.
const GENDER_KEYS: (keyof Look)[] = ['beard', 'mustache', 'hairStyle', 'outfit', 'headwear', 'earrings', 'glasses'];

/** Gender of the most telling coded option of `look` ('f' | 'm'), or null when all are neutral. */
export function lookGender(look: Partial<Look>): Gender | null {
  for (const key of GENDER_KEYS) {
    const gender = key in look && codedFor(key, look[key]!);
    if (gender) return gender;
  }
  return null;
}

/**
 * Copy of `look` (or part of it) with only options and colours neutral or coded for `gender`; an
 * unknown gender is taken from the look itself, so the two genders are never mixed.
 */
export function fitLook<T extends Partial<Look>>(look: T, gender: Gender | null = null): T {
  gender ??= lookGender(look);
  const fitted: Record<string, string> = { ...look };
  for (const key of Object.keys(CHOICES)) if (key in fitted) fitted[key] = fitOption(key, fitted[key], gender);
  if (gender === 'm') for (const key of COLOR_KEYS) if (key in fitted) fitted[key] = FEMININE_COLORS[fitted[key]] ?? fitted[key];
  return fitted as T;
}

function pick(list: readonly (string | Option)[]): string {
  const item = list[Math.floor(Math.random() * list.length)];
  return (item as { id?: string }).id ?? (item as string);
}

/** A random but wearable look, anything goes: the visitor asked for a surprise (« Au hasard »). */
export function randomLook(): Look {
  const hair = pick(HAIR_COLORS);
  const top = pick(CLOTH_COLORS);
  let bottom = pick(CLOTH_COLORS);
  while (bottom === top) bottom = pick(CLOTH_COLORS);
  const facialHair = Math.random() < 0.2;
  return {
    skin: pick(SKIN_TONES),
    faceShape: pick(FACE_SHAPES),
    eyeColor: pick(EYE_COLORS),
    eyeShape: pick(EYE_SHAPES),
    skinMarks: Math.random() < 0.8 ? 'none' : 'freckles',
    hair,
    hairStyle: pick(HAIR_STYLES),
    beard: facialHair ? pick(BEARDS.slice(1)) : 'none',
    mustache: facialHair && Math.random() < 0.6 ? pick(MUSTACHES.slice(1)) : 'none',
    beardColor: hair,
    outfit: pick(OUTFITS),
    top,
    bottom,
    shoes: pick(CLOTH_COLORS),
    // Accessories are fun but shouldn't be on everyone.
    headwear: Math.random() < 0.5 ? 'none' : pick(HEADWEAR),
    headwearColor: pick(CLOTH_COLORS),
    glasses: Math.random() < 0.6 ? 'none' : pick(GLASSES),
    glassesColor: pick(GLASSES_COLORS),
    earrings: Math.random() < 0.6 ? 'none' : pick(EARRINGS),
    earringColor: pick(METAL_COLORS),
  };
}

// Skin tones of the visitors (SKIN_TONES order): mostly light, some medium, a few dark.
const SKIN_WEIGHTS = [10, 20, 25, 15, 12, 8, 6, 4];

/**
 * A plausible visitor of `gender` ('f' | 'm'): every trait drawn with its frequency among visitors
 * (population.ts), so nothing rare and no mix of genders.
 */
export function likelyLook(gender: Gender): Look {
  let r = Math.random() * SKIN_WEIGHTS.reduce((a, b) => a + b, 0);
  const skinIndex = SKIN_WEIGHTS.findIndex((w) => (r -= w) <= 0);
  const age: AgeGroup = Math.random() < 0.75 ? 'teen' : Math.random() < 0.7 ? 'adult' : 'senior';
  const context = { gender, age, skin: skinGroup(skinIndex) };
  const hair = draw('hair', context);
  const beard = draw('beard', context);
  const look = { ...randomLook(), skin: SKIN_TONES[skinIndex], hair, beardColor: hair, beard };
  look.mustache = draw('mustache', { ...context, beard });
  for (const key of ['faceShape', 'eyeShape', 'skinMarks', 'hairStyle', 'outfit', 'top', 'bottom', 'shoes', 'headwear', 'glasses',
    'glassesColor', 'earrings', 'eyeColor'] as const) {
    look[key] = draw(key, { ...context, hair });
  }
  return fitLook(look, gender);
}
