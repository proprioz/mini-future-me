// How often each option is seen among the visitors of a stand in Switzerland (mostly teenagers, some
// parents and teachers), as relative weights, by gender, age group and skin. The face scan guesses
// gender and age first, starts from the most likely look (typicalLook) and multiplies these weights
// with what it measures, so when a measurement is unsure the most frequent option wins; the welcome
// screen draws its characters from them.
//
// Orders of magnitude from published surveys, rounded and adapted to the options of the game:
// - Women's cuts: Medihair survey (layered 27 %, ponytail 21 %, bob 16 %, pixie 14 %, braids 1 %).
// - Men's cuts: Hims survey 2025 (fade 14 %, buzz cut 12 %, classic cut 10.5 %); among teenage boys,
//   curls (often a perm) on top of a fade are everywhere. Part of the buzz cuts, and many balding men,
//   shave close to the skin (boule à zéro).
// - Hair shape of Europeans: 45 % straight, 40 % wavy, 15 % curly (GWAS, PMC2775823).
// - Hair colour: brown dominant in Central Europe, black 5–8 % (more here: many visitors' families
//   come from southern Europe, the Balkans or Turkey), red 1–4 %; grey hair for most people between
//   45 and 65 (Panhard et al. 2012).
// - Eyes: Germany ≈ 40 % blue, 33 % intermediate (green, hazel), 27 % brown.
// - Baldness: ≈ 16 % of men 18–29, half of men in their 40s, 80 % after 70.
// - Facial hair: more than half of men under 40 (YouGov, Ifop), much less among teenagers.
// - Glasses: 68 % of the Swiss wear glasses or contact lenses (OFS 2022), more with age.
// - Frames: rectangular and square lead, cat-eye next (mostly women), browline popular.
// - Muslims ≈ 6 % of the Swiss population, a minority of women wear a headscarf.
// - Clothes: black, white, grey and navy are by far the most worn colours, jeans (blue) for the bottom.
// - Locs and braids: worn by a large share of people with afro-textured hair, rarely by others.
//   Two plaits: mostly girls (Medihair: braids 1 %).
// - Goatees: a minority of beards, more among young men.
// - Freckles: most people with red hair, about a quarter of the blond, few others.
// Options rarer than that (afro, turban, vitiligo, dyed hair…) are not in the game at all: a rare trait
// is drawn as its closest common option.

export type Gender = 'f' | 'm';
export type AgeGroup = 'teen' | 'adult' | 'senior';
export type SkinGroup = 'light' | 'medium' | 'dark';

/** Context of a visitor: gender 'f' | 'm', age group, skin 'light' | 'medium' | 'dark', hair colour. */
export interface VisitorContext {
  gender?: Gender | null;
  age?: AgeGroup;
  skin?: SkinGroup;
  hair?: string;
  beard?: string;
}

/** Relative weight of each option id (or colour). */
export type Frequencies = Record<string, number>;

type TableContext = VisitorContext & { age: AgeGroup; skin: SkinGroup };

export function ageGroup(age: number): AgeGroup {
  return age < 20 ? 'teen' : age < 45 ? 'adult' : 'senior';
}

/** Skin tone index in SKIN_TONES (light → dark) → skin group (the 4th tone is light, tanned). */
export function skinGroup(index: number): SkinGroup {
  return index <= 3 ? 'light' : index <= 5 ? 'medium' : 'dark';
}

const BLACK = '#1f1612';
const BROWN = '#4a3426';
const CHESTNUT = '#7a4a2a';
const RED = '#b5672e';
const BLOND = '#e8c27a';
const GREY = '#8f8a85';
const WHITE = '#d9d4cf';

const DARK_EYES = '#2b1d17';
const BROWN_EYES = '#5b3a29';
const HAZEL = '#8a6a2f';
const GREEN = '#4f8f5a';
const BLUE = '#3f7cbf';

const TABLES = {
  hairStyle: ({ gender, age, skin }): Frequencies => {
    // Locs and braids: common with afro-textured hair, rare otherwise.
    const all = { dark: { f: 30, m: 14 }, medium: { f: 3, m: 2 }, light: { f: 1, m: 0.5 } }[skin][gender === 'f' ? 'f' : 'm']
      * (age === 'senior' ? 0.4 : 1);
    // Women wear their hair shorter with age.
    if (gender === 'f') {
      const locs = all;
      return {
        teen: { long: 30, medium: 20, ponytail: 16, bun: 14, curlyLong: 8, bob: 6, braids: 4, pixie: 3, curly: 2, locs },
        adult: { medium: 26, long: 24, bob: 12, ponytail: 10, bun: 8, pixie: 8, curlyLong: 8, curly: 3, braids: 1.5, locs },
        senior: { bob: 28, medium: 24, pixie: 22, long: 8, curly: 7, curlyLong: 5, ponytail: 3, bun: 2, braids: 1.5, locs },
      }[age];
    }
    const locs = all;
    // Curls on top over faded sides (often a perm): the cut of a great many teenage boys today,
    // nearly as common as a classic short cut.
    if (age === 'teen') return { short: 36, curlyFade: 32, buzz: 12, curly: 6, shaved: 4, bald: 1, locs };
    if (age === 'adult') return { short: 46, buzz: 15, bald: 10, shaved: 9, curlyFade: 9, curly: 6, locs };
    return { short: 38, buzz: 11, curly: 4, bald: 31, shaved: 8, curlyFade: 1, locs };
  },
  hair: ({ age, skin }): Frequencies => {
    const old = age === 'senior';
    if (skin === 'dark') return { [BLACK]: 85, [BROWN]: 15, [GREY]: old ? 30 : 0, [WHITE]: old ? 8 : 0 };
    if (skin === 'medium') return { [BLACK]: 35, [BROWN]: 40, [CHESTNUT]: 12, [BLOND]: 5, [GREY]: old ? 30 : 1, [WHITE]: old ? 8 : 0 };
    // Blond hair darkens while growing up.
    return {
      [BROWN]: 36, [CHESTNUT]: 20, [BLOND]: age === 'teen' ? 24 : 16, [BLACK]: 16, [RED]: 3,
      [GREY]: old ? 45 : age === 'adult' ? 4 : 0, [WHITE]: old ? 12 : 0,
    };
  },
  eyeColor: ({ skin, hair }): Frequencies => {
    if (skin === 'dark') return { [DARK_EYES]: 80, [BROWN_EYES]: 18, [HAZEL]: 2 };
    if (skin === 'medium' || hair === BLACK) return { [DARK_EYES]: 40, [BROWN_EYES]: 35, [HAZEL]: 13, [GREEN]: 6, [BLUE]: 6 };
    if (hair === BLOND || hair === RED) return { [BLUE]: 48, [GREEN]: 18, [HAZEL]: 14, [BROWN_EYES]: 14, [DARK_EYES]: 6 };
    return { [BLUE]: 36, [BROWN_EYES]: 22, [HAZEL]: 16, [GREEN]: 14, [DARK_EYES]: 12 };
  },
  eyeShape: () => ({ round: 50, almond: 50 }),
  skinMarks: ({ skin, hair }) => {
    const freckles = hair === RED ? 60 : hair === BLOND ? 25 : skin === 'light' ? 10 : skin === 'medium' ? 3 : 1;
    return { none: 100 - freckles, freckles };
  },
  faceShape: () => ({ oval: 40, round: 25, square: 20, heart: 15 }),
  glasses: ({ gender, age }) => {
    const wearing = { teen: 30, adult: 40, senior: 65 }[age] ?? 35;
    // Thick and round frames are the young ones, thin rectangles the classic.
    const young = age === 'teen';
    const shapes = gender === 'f'
      ? { square: young ? 25 : 40, bold: young ? 30 : 20, round: young ? 25 : 15, catEye: young ? 20 : 15 }
      : { square: young ? 30 : 45, bold: young ? 30 : 20, round: young ? 25 : 12, browline: young ? 15 : 18 };
    return { none: 100 - wearing, ...Object.fromEntries(Object.entries(shapes).map(([id, w]) => [id, (w * wearing) / 100])) };
  },
  glassesColor: () => ({ '#2b2d42': 40, '#6b4226': 22, '#e4ecef': 15, '#b8bec6': 13, '#c9a227': 10 }),
  headwear: ({ gender, age }): Frequencies => (gender === 'f'
    ? { none: 90, beanie: 4, headscarf: 3, cap: 3 }
    : { none: 86, cap: age === 'teen' ? 9 : 5, beanie: 5 }),
  beard: ({ gender, age }): Frequencies => {
    if (gender === 'f') return { none: 100 };
    if (age === 'teen') return { none: 80, stubble: 14, goatee: 3, short: 3 };
    if (age === 'adult') return { none: 40, stubble: 24, goatee: 8, short: 28 };
    return { none: 50, stubble: 14, goatee: 6, short: 30 };
  },
  // Stubble already shades the upper lip; a beard almost always comes with a moustache, a goatee
  // always (it is a moustache, round the mouth and the chin).
  mustache: ({ gender, beard }) => {
    if (gender === 'f') return { none: 100 };
    return ({
      none: { none: 90, thick: 10 }, stubble: { none: 85, thick: 15 }, goatee: { thick: 100 }, short: { thick: 92, none: 8 },
    } as Record<string, Frequencies>)[beard ?? 'none'];
  },
  earrings: ({ gender, age }): Frequencies => (gender === 'f'
    ? { studs: 50, none: 35, hoops: age === 'teen' ? 20 : 15, drops: age === 'teen' ? 4 : 8 }
    : { none: age === 'teen' ? 85 : 90, studs: age === 'teen' ? 15 : 10 }),
  // Clothes colours (CLOTH_COLORS): black, then the other neutrals; older visitors wear more navy,
  // blue and beige, less black. Jeans blue for the bottom.
  top: ({ gender, age }) => {
    const old = age === 'senior';
    return {
      '#2b2b2e': old ? 14 : age === 'teen' ? 28 : 22, '#f7f3ee': 14, '#8e9196': 12, '#2f3a56': old ? 18 : 12,
      '#5b7fb8': old ? 14 : 10, '#cdb497': old ? 10 : 6, '#3f7a57': 8, '#7a5236': 5, '#b83a44': 6,
      '#f4c04e': 2, '#8e72b8': gender === 'f' ? 3 : 1, ...(gender === 'f' && { '#ff9fb1': 3 }),
    };
  },
  bottom: () => ({ '#2f3a56': 30, '#2b2b2e': 25, '#5b7fb8': 25, '#8e9196': 8, '#cdb497': 8, '#7a5236': 4 }),
  shoes: () => ({ '#f7f3ee': 40, '#2b2b2e': 35, '#8e9196': 10, '#cdb497': 5, '#7a5236': 5, '#2f3a56': 5 }),
  // Hoodies for teenagers, shirts and sweaters with age.
  outfit: ({ gender, age }) => ({
    ...{
      teen: { hoodie: 35, tshirt: 30, sweater: 15, jacket: 12, shirt: 3, cardigan: 3 },
      adult: { tshirt: 28, sweater: 22, shirt: 18, hoodie: 15, jacket: 12, cardigan: 6 },
      senior: { shirt: 30, sweater: 28, jacket: 18, tshirt: 15, cardigan: 12, hoodie: 2 },
    }[age],
    ...(gender === 'f' && { dress: 5 }),
  }),
} satisfies Record<string, (context: TableContext) => Frequencies>;

/** A look key that has frequencies. */
export type FrequencyKey = keyof typeof TABLES;

/**
 * Relative frequency of each option of look key `key` for a visitor `context`
 * ({ gender, age: 'teen' | 'adult' | 'senior', skin: 'light' | 'medium' | 'dark', hair, beard }).
 * Options missing from the result are never picked for that visitor.
 */
export function frequencies(key: FrequencyKey, context: VisitorContext): Frequencies {
  return TABLES[key]({ age: 'teen', skin: 'light', ...context });
}

/** Draws an option from `frequencies()`. */
export function draw(key: FrequencyKey, context: VisitorContext, random = Math.random): string {
  const entries = Object.entries(frequencies(key, context));
  let r = random() * entries.reduce((sum, [, w]) => sum + w, 0);
  for (const [id, w] of entries) {
    r -= w;
    if (r <= 0) return id;
  }
  return entries.at(-1)![0];
}

/** Look keys that have frequencies, in an order where each only depends on earlier ones (hair, beard). */
export const FREQUENCY_KEYS = Object.keys(TABLES) as FrequencyKey[];

/** Most frequent option of `key` for `context`. */
export function mostLikely(key: FrequencyKey, context: VisitorContext): string {
  return Object.entries(frequencies(key, context)).reduce((best, entry) => (entry[1] > best[1] ? entry : best))[0];
}

/**
 * The most likely look of a visitor of this gender ('f' | 'm'), age group and skin: what the scan
 * starts from once it has guessed gender and age, before refining it with what it measures.
 * The whole table is written out in docs/profils-types.md (pnpm profils).
 */
export function typicalLook(context: VisitorContext): Record<FrequencyKey, string> {
  const look = {} as Record<FrequencyKey, string>;
  for (const key of FREQUENCY_KEYS) look[key] = mostLikely(key, { ...context, hair: look.hair, beard: look.beard });
  return look;
}
