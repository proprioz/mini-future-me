import { describe, expect, test } from 'vitest';
import { DEFAULT_LOOK } from '../../src/character/Character.ts';
import { codedFor, fitLook, likelyLook, lookGender, randomLook } from '../../src/character/options.ts';
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
