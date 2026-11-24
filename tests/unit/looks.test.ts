import { describe, expect, test } from 'vitest';
import { DEFAULT_LOOK } from '../../src/character/Character.ts';
import {
  codedFor, fitLook, likelyLook, lookGender, randomLook,
  FACE_SHAPES, EYE_SHAPES, SKIN_MARKS, HAIR_STYLES, BEARDS, MUSTACHES, OUTFITS, HEADWEAR, GLASSES, EARRINGS,
} from '../../src/character/options.ts';
import { PRESETS, welcomeVisitor } from '../../src/character/presets.ts';
import { typicalLook } from '../../src/character/population.ts';
import type { AgeGroup, Gender, SkinGroup } from '../../src/character/population.ts';
import { classify } from '../../src/scan/classify.ts';

// What the game picks on its own (the default look, the characters of the welcome screen, the scan)
// never mixes options coded feminine and masculine (AGENTS.md, "Character options"); only « Au hasard »,
// started by the visitor, mixes everything.

/** The genders the options of `look` are coded for: at most one when nothing is mixed. */
function codedGenders(look: object): Set<Gender> {
  const genders = new Set<Gender>();
  for (const [key, id] of Object.entries(look)) {
    const coded = typeof id === 'string' && codedFor(key, id);
    if (coded) genders.add(coded);
  }
  return genders;
}

const GENDERS: Gender[] = ['f', 'm'];
const AGES: AgeGroup[] = ['teen', 'adult', 'senior'];
const SKINS: SkinGroup[] = ['light', 'medium', 'dark'];
const RUNS = 2000;

test('« Au hasard » mixes, and the check sees it', () => {
  const mixed = Array.from({ length: RUNS }, randomLook).filter((look) => codedGenders(look).size > 1);
  expect(mixed.length).toBeGreaterThan(0);
});

test('earrings are coded feminine', () => {
  for (const id of ['studs', 'hoops', 'drops']) expect(codedFor('earrings', id)).toBe('f');
  expect(fitLook({ earrings: 'studs' }, 'm').earrings).toBe('none');
});

test('the wizard hat is only worn by the presets that give it', () => {
  for (let i = 0; i < RUNS; i++) {
    for (const look of [randomLook(), likelyLook(GENDERS[i % 2])]) expect(look.headwear).not.toBe('wizard');
  }
  for (const gender of GENDERS) expect(fitLook({ headwear: 'wizard' }, gender).headwear).toBe('wizard');
});

test('the default look is neutral', () => {
  expect(codedGenders(DEFAULT_LOOK).size).toBe(0);
});

describe.each(GENDERS)('gender %s', (gender) => {
  const other = gender === 'f' ? 'm' : 'f';

  test('characters of the welcome screen', () => {
    for (let i = 0; i < RUNS; i++) expect([...codedGenders(likelyLook(gender))]).not.toContain(other);
  });

  test.each(AGES.flatMap((age) => SKINS.map((skin) => [age, skin] as const)))('most likely look, %s, %s skin', (age, skin) => {
    expect([...codedGenders(typicalLook({ gender, age, skin }))]).not.toContain(other);
  });

  test('a random look fitted to a gender', () => {
    for (let i = 0; i < RUNS; i++) {
      const fitted = fitLook(randomLook(), gender);
      expect([...codedGenders(fitted)]).not.toContain(other);
      expect(fitLook(fitted, gender)).toEqual(fitted);
    }
  });
});

test('a look fitted without a gender takes the one of its options', () => {
  for (let i = 0; i < RUNS; i++) {
    const look = fitLook(randomLook());
    expect(codedGenders(look).size).toBeLessThanOrEqual(1);
    const gender = lookGender(look);
    if (gender) expect(codedGenders(look)).toEqual(new Set([gender]));
  }
});

describe('the scan', () => {
  // Only the age and gender estimate: the rest of the look comes from the frequencies, the part
  // most likely to pick options of both genders if the rule broke.
  test.each([
    ['no estimate', undefined],
    ...[0, 0.2, 0.45, 0.5, 0.55, 0.8, 1].flatMap((male) => [8, 16, 30, 70].map((age) => [`male ${male}, ${age} years`, { male, age }])),
  ] as [string, { male: number; age: number } | undefined][])('%s', (_, ageGender) => {
    const { look, base, findings } = classify({ ageGender } as Parameters<typeof classify>[0], {});
    for (const result of [look, base, { ...DEFAULT_LOOK, ...look }, ...findings.map((f) => f.patch)]) {
      expect(codedGenders(result).size).toBeLessThanOrEqual(1);
    }
  });
});

describe('the famous characters', () => {
  // `held` (what the hand holds) has no list: only the ready-made characters hold something.
  const LISTS: Record<string, { id: string }[]> = {
    faceShape: FACE_SHAPES, eyeShape: EYE_SHAPES, skinMarks: SKIN_MARKS, hairStyle: HAIR_STYLES, beard: BEARDS, mustache: MUSTACHES,
    outfit: OUTFITS, headwear: HEADWEAR, glasses: GLASSES, earrings: EARRINGS, held: [{ id: 'none' }],
  };
  const offered = (key: string, id: string) => LISTS[key].some((option) => option.id === id);
  /** What a preset wears that no list of « Crée ton perso » offers, as 'key=id'. */
  const exclusive = (look: object) => Object.entries(look).filter(([key, id]) => key in LISTS && !offered(key, id)).map(([key, id]) => `${key}=${id}`);

  test.each(PRESETS.map((p) => [p.label, p] as const))('%s: the game\'s face and haircut, something of its own', (_, { look }) => {
    for (const key of ['faceShape', 'eyeShape', 'hairStyle', 'beard', 'mustache']) expect(offered(key, look[key as keyof typeof look])).toBe(true);
    expect(exclusive(look).length).toBeGreaterThan(0);
  });

  test('what only they wear, nothing else gives', () => {
    const theirs = new Set(PRESETS.flatMap((p) => exclusive(p.look)));
    const looks = [
      ...Array.from({ length: RUNS }, randomLook),
      ...GENDERS.flatMap((gender) => Array.from({ length: RUNS }, () => likelyLook(gender))),
      ...GENDERS.flatMap((gender) => AGES.flatMap((age) => SKINS.map((skin) => typicalLook({ gender, age, skin })))),
      { ...DEFAULT_LOOK },
    ];
    for (const look of looks) for (const [key, id] of Object.entries(look)) expect(theirs.has(`${key}=${id}`)).toBe(false);
  });

  test('the welcome screen shows about one in five, whole and never twice in a row', () => {
    let previous = welcomeVisitor();
    let famous = 0;
    for (let i = 0; i < RUNS; i++) {
      const look = welcomeVisitor(previous);
      const preset = PRESETS.find((p) => p.look === look);
      if (preset) {
        famous++;
        expect(look).not.toBe(previous);
      } else {
        // An ordinary visitor: nothing of theirs, not even one item, and no mix of genders (a famous
        // character keeps its own look, such as the old wizard's long hair with a beard).
        expect(exclusive(look)).toEqual([]);
        expect(codedGenders(look).size).toBeLessThanOrEqual(1);
      }
      previous = look;
    }
    expect(famous / RUNS).toBeGreaterThan(0.15);
    expect(famous / RUNS).toBeLessThan(0.25);
  });
});
