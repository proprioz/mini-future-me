import {
  SKIN_TONES, HAIR_COLORS, EYE_COLORS, GLASSES_COLORS, CLOTH_COLORS, EYE_SHAPES, SKIN_MARKS, HAIR_STYLES, BEARDS, MUSTACHES,
  HEADWEAR, GLASSES, FACE_SHAPES, OUTFITS, EARRINGS, CLEAR_FRAME, fitLook, lookGender, type Option,
} from '../character/options.ts';
import {
  frequencies, ageGroup, skinGroup, FREQUENCY_KEYS,
  type AgeGroup, type Frequencies, type FrequencyKey, type Gender, type VisitorContext,
} from '../character/population.ts';
import type { Look } from '../character/Character.ts';
import type { IconName } from '../ui/iconPaths.ts';
import { lightness, rgbToOklab, colorDistance, hexToRgb, type Rgb } from './color.ts';
import { CALIBRATION, skinTone } from './FaceSampler.ts';
import { topColor } from './clothes.ts';
import type { Box, Point } from './masks.ts';
import type { FacialHairFront, HairFront } from './frontFeatures.ts';
import type { SideFeatures, SideHair } from './headFeatures.ts';
import type { AgeGender } from './ageGender.ts';
import type { Features, PhotoViews, ViewName } from './PortraitAnalyzer.ts';

// Measurements of FaceSampler.ts / frontFeatures.ts / headFeatures.ts → the options of the "Crée ton
// perso" screen. Each measurement gives a likelihood per option (`step()` around a threshold: the
// wider, the less sure), multiplied by how frequent the option is for this visitor (population.ts:
// gender, age, skin, hair). A clear measurement wins; an unsure one falls back on the most likely
// option given what was measured with more certainty. Tuned on public/portraits (tools/playwright).
export const RULES = {
  bald: 0.06, // share of the crown area that is hair, below which the head is bald
  buzz: 0.3, // … below which it is shaved (test portraits: buzz 0.28, short 0.31–0.5)
  curls: 0.55, // ragged hair outline (front) → curly (straight 0.2–0.52, curly 0.63–1.1)
  bobBelowChin: -0.35, // front: hair beside the face ending below this (/ face height) → bob
  mediumBelowChin: 0, // … → shoulder length
  longBelowChin: 0.25, // … → long
  bunBackY: 0.2, // profile: back-most hair point this high on the head → bun
  longHang: 0.2, // profile: hair hanging this far below the jaw → long (or ponytail when narrow)
  longBackY: 0.75, // profile: hair still behind the head this low (0 = top, 1 = jaw) → long
  ponytailHangWidth: 0.4, // profile: hanging hair narrower than this (× head height) → ponytail
  plaitWidth: 0.22, // … much narrower, and falling in front on the front photo: plaits (0.11–0.16; loose long hair ≥ 0.3)
  covered: 0.35, // crown covered by clothes / accessory pixels → headwear
  scarfSides: 0.3, // … and the sides of the face too → headscarf
  cap: 0.3, // crown covered by accessory pixels with hair visible around → cap
  glasses: 0.04, // share of the eye band covered by "accessory" pixels (frames: 0.06–0.13, clear or thin ones the least)
  glassesBridge: 0.06, // … with the nose bridge covered too (frames: 0.12–0.39; caps and turbans over the temples: 0)
  squareCorners: 0.9, // frame pixels reaching the corners of the lens box → angular frames
  mustache: 0.15, // upper lip darker than the cheeks (OKLab lightness)
  beard: 0.15, // chin darker than the cheeks
  whiteBeard: 0.04, // chin lighter than the cheeks by this much (and greyer): white beard
  // Grey hairs make the skin duller (saturation lost on the chin + jaw), a mere shadow doesn't: no
  // beard ≤ 0.02, grey or salt-and-pepper beards 0.1–0.23.
  greyBeard: 0.06,
  greyThick: 0.035, // … the chin alone this dull: a beard covering it, not stubble
  greyLip: 0.04, // … the upper lip this dull: a grey moustache
  thick: 0.3, // darkness relative to the skin lightness above which facial hair is a beard, not stubble
  longBeard: 0.3, // hair-class pixels below the chin: a real beard too
  // Gender estimate (never displayed), from the age-gender network: all 20 test portraits are on the
  // right side of 0.5, the least sure at 0.27, 0.31 and 0.89.
  masculine: 0.5,
  // Hair colour (OKLab lightness L and chroma C of the lit hair). Photos make hair lighter and
  // greyer than our stylised palette, so colours are picked by rules rather than nearest match.
  hairGrey: 0.03, // C below this: black / brown / grey / white
  // Dark hair less colourful than this: black, more: brown. Black hair has brownish highlights, and
  // brown hair is lighter: the lightness counts too (chroma + 0.05 × (L − 0.25); black ≤ 0.0132, brown ≥ 0.0155).
  hairBlackChroma: 0.0145,
  hairDark: 0.3, // L below this: black or brown
  hairDarkBrown: 0.4, // L below this (and grey-ish): brown, above: grey
  hairBlond: 0.55, // L above this (and colourful): blond
  hairWhite: 0.78, // L above this: white or blond
  hairRed: 0.065, // C above this: red (or blond when light)
};

/** Likelihood (0–1) of each option id or colour, given a measurement. */
type Likelihood = Record<string, number>;

/**
 * Something the analysis animation draws on a photo, in fractions of its size (pixels until
 * normalize()). `on: false`: looked for there, not found.
 */
export type Mark = { on?: boolean } & (
  | { type: 'box'; box: Box }
  | { type: 'dots'; points: Point[]; big?: boolean }
  | { type: 'line'; from: Point; to: Point }
  | { type: 'mask'; cls: number }
);

/** One option of « Crée ton perso » found on a photo, replayed by the analysis animation. */
export interface Finding {
  view: ViewName;
  icon: IconName;
  title: string;
  value: string;
  patch: Partial<Look>;
  color?: string;
  marks: Mark[];
  /** Shown once every photo has been scanned (it uses them all). */
  final?: boolean;
}

/** One line of the console report (keys are the column titles). */
export interface ReportLine {
  élément: string;
  choix: string;
  certitude: string;
  'accord avec la mesure': string;
}

/** What the scan guessed about the visitor and how sure, for the console only (logReport). */
export interface ScanReport {
  gender: { value: string; certainty: number };
  age?: { value: number; group: string; certainty: number; error: number } | null;
  lines: ReportLine[];
}

export interface Classification {
  look: Partial<Look>;
  base: Partial<Look>;
  findings: Finding[];
  report: ScanReport;
}

/** 0 well below `at`, 1 well above, 0.5 at `at`; `width`: how unsure the measurement is around it. */
const step = (x: number, at: number, width: number) => 1 / (1 + Math.exp(-(x - at) / width));

// No measurement rules an option out completely: a very frequent option can still win when the
// measurement only slightly prefers another one.
const FLOOR = 0.03;

/**
 * Score of each option of look key `key`: frequency × likelihood. `likelihood`: { id: 0–1 }, empty
 * when nothing was measured (frequencies only). Unknown gender: both mixed. `floor`: smallest
 * likelihood (see FLOOR).
 */
function weigh(key: FrequencyKey, context: VisitorContext, likelihood: Likelihood = {}, floor = FLOOR): Frequencies {
  const measured = Object.keys(likelihood).length > 0;
  const tables = context.gender ? [frequencies(key, context)]
    : [frequencies(key, { ...context, gender: 'f' }), frequencies(key, { ...context, gender: 'm' })];
  const scores: Frequencies = {};
  for (const table of tables) {
    for (const [id, f] of Object.entries(table)) {
      scores[id] = (scores[id] ?? 0) + f * (measured ? Math.max(floor, likelihood[id] ?? 0) : 1);
    }
  }
  return scores;
}

/** Option with the highest score. */
const best = (scores: Frequencies) => Object.entries(scores).reduce((top, entry) => (entry[1] > top[1] ? entry : top))[0];

/** Option of look key `key` with the highest frequency × likelihood (see weigh()). */
function decide(key: FrequencyKey, context: VisitorContext, likelihood: Likelihood = {}, floor = FLOOR) {
  return best(weigh(key, context, likelihood, floor));
}

/** Most likely option of every look key for `context`: the look the scan starts from. */
function baseLook(context: VisitorContext) {
  const look = {} as Record<FrequencyKey, string>;
  for (const key of FREQUENCY_KEYS) look[key] = decide(key, { ...context, hair: look.hair, beard: look.beard });
  return look;
}

/** Likelihood of each palette colour for hair (or a beard) measured on a photo. */
function hairLikelihood(rgb: Rgb): Likelihood {
  const [L, a, b] = rgbToOklab(rgb);
  const C = Math.hypot(a, b);
  const [black, brown, chestnut, red, blond, grey, white] = HAIR_COLORS;
  const r = RULES;
  const light = step(L, r.hairWhite, 0.02);
  const dark = 1 - light;
  const greyish = 1 - step(C, r.hairGrey, 0.007);
  const reddish = step(C, r.hairRed, 0.005);
  const blackish = (1 - step(L, r.hairDark, 0.02)) * (1 - step(C + 0.05 * (L - 0.25), r.hairBlackChroma, 0.001));
  const warm = dark * (1 - greyish) * (1 - reddish);
  return {
    [white]: light * (1 - reddish),
    [blond]: light * reddish + dark * (1 - greyish) * step(L, r.hairBlond, 0.02),
    [black]: dark * blackish,
    [brown]: dark * (1 - blackish) * (greyish * (1 - step(L, r.hairDarkBrown, 0.015)) + (1 - greyish) * (1 - step(L, 0.32, 0.03))),
    [grey]: dark * greyish * step(L, r.hairDarkBrown, 0.015),
    [chestnut]: warm * step(L, 0.32, 0.03) * (1 - step(L, r.hairBlond, 0.02)),
    [red]: dark * (1 - greyish) * reddish * (1 - step(L, 0.62, 0.02)),
  };
}

/** Likelihood of each palette colour from the distance to the measured one (OKLab, `spread` ≈ unsureness). */
function colorLikelihood(rgb: Rgb, palette: string[], spread: number): Likelihood {
  return Object.fromEntries(palette.map((hex) => [hex, Math.exp(-((colorDistance(rgb, hexToRgb(hex)) / spread) ** 2))]));
}

/**
 * Likelihood of each clothes colour. Photos make dark clothes darker and duller, so colours are
 * compared on lightness, colourfulness relative to the lightness, and hue (only between two really
 * colourful colours: the hue of a near-grey means nothing). The palette only has the main colours:
 * relative to the closest one (likelihood 1), so a colour between two of them takes the closest
 * rather than the most frequent.
 */
function clothLikelihood(rgb: Rgb): Likelihood {
  const describe = (c: Rgb) => {
    const [L, a, b] = rgbToOklab(c);
    return { L, s: Math.hypot(a, b) / Math.max(L, 0.25), h: Math.atan2(b, a) };
  };
  const m = describe(rgb);
  const distances = CLOTH_COLORS.map((hex): [string, number] => {
    const p = describe(hexToRgb(hex));
    const hue = (Math.abs(Math.atan2(Math.sin(m.h - p.h), Math.cos(m.h - p.h))) * 180) / Math.PI;
    const hueWeight = Math.min(1, Math.min(m.s, p.s) / 0.08);
    // A photo makes clothes darker and duller, never the opposite: that way costs half as much.
    const dL = (m.L - p.L) * (m.L < p.L ? 0.5 : 1);
    const dS = (m.s - p.s) * (m.s < p.s ? 0.5 : 1);
    return [hex, (dL / 0.15) ** 2 + (dS / 0.07) ** 2 + hueWeight * (hue / 20) ** 2];
  });
  const closest = Math.min(...distances.map(([, d2]) => d2));
  // The top covers a large area: its colour is trusted more than the frequencies (cubed likelihood).
  return Object.fromEntries(distances.map(([hex, d2]) => [hex, Math.exp(-(d2 - closest) / 2) ** 3.3]));
}

/** What the profiles say about the hair style: likelihood of a bun, a ponytail, long hair, plaits (null: no profile). */
function sideHints(sides: (SideFeatures | null | undefined)[]) {
  const seen = sides.filter((s) => s && !s.bald) as SideHair[];
  if (!seen.length) return null;
  const max = (fn: (s: SideHair) => number) => Math.max(...seen.map(fn));
  return {
    bun: max((s) => 1 - step(s.backY, RULES.bunBackY, 0.03)),
    ponytail: max((s) => step(s.hang, RULES.longHang, 0.03) * (1 - step(s.hangWidth, RULES.ponytailHangWidth, 0.05))),
    long: max((s) => Math.max(step(s.hang, RULES.longHang, 0.03) * step(s.hangWidth, RULES.ponytailHangWidth, 0.05),
      step(s.backY, RULES.longBackY, 0.08))),
    plait: max((s) => step(s.hang, RULES.longHang, 0.03) * (1 - step(s.hangWidth, RULES.plaitWidth, 0.02))),
  };
}

/** Likelihood of each hair style. `capped`: a cap hides the crown, so little hair there doesn't mean bald. */
function styleLikelihood({ hair, left, right }: Features & { hair: HairFront }, capped: boolean): Likelihood {
  const r = RULES;
  const hints = sideHints([left, right]) ?? { bun: 0.25, ponytail: 0.25, long: 0, plait: 0 }; // no profile: unknown
  const bald = capped ? 0 : 1 - step(hair.amount, r.bald, 0.015);
  const hairy = 1 - bald;
  // Under a cap, the edge of the cap makes any outline ragged: curls can't be told.
  const curly = capped ? 0.3 : step(hair.curls, r.curls, 0.04);
  const straight = 1 - curly;
  // Hair falling below the chin on the front photo can't be tied back.
  const frontLong = Math.max(step(hair.length, r.longBelowChin, 0.05), hair.cropped ? 0.9 : 0);
  // Long hair hanging very narrow beside the neck, and in front of the shoulders: plaits, not loose hair.
  const plaited = hints.plait * frontLong;
  const reach = Math.max(frontLong, hints.long);
  const long = reach * (1 - plaited);
  const medium = step(hair.length, r.mediumBelowChin, 0.05) * (1 - reach);
  const bob = step(hair.length, r.bobBelowChin, 0.05) * (1 - medium) * (1 - reach);
  const short = (1 - bob) * (1 - medium) * (1 - reach);
  // Tied hair looks short from the front (unless it falls below the chin there).
  const loose = 1 - Math.max(hints.bun, hints.ponytail) * (1 - frontLong);
  const shaved = 1 - step(hair.amount, r.buzz, 0.03);
  return {
    bald,
    // Shaved very close, the hair hardly shows on a photo: like a bald head, the frequencies decide.
    shaved: bald,
    buzz: hairy * straight * short * shaved,
    short: hairy * straight * short * (1 - shaved) * loose,
    pixie: hairy * straight * short * (1 - shaved) * loose,
    // Short curls, with faded sides or not: the photos can't tell, the frequencies decide.
    curly: hairy * curly * (1 - reach) * (1 - medium),
    curlyFade: hairy * curly * (1 - reach) * (1 - medium),
    curlyLong: hairy * curly * Math.max(long, medium),
    // Locs and braids hang long with a ragged outline, a bit like long curls; how frequent they are
    // for this visitor (population.ts) tells them apart. Short locs end around the chin.
    locs: hairy * Math.max(long * (0.4 + 0.6 * curly), plaited),
    braids: hairy * plaited,
    bob: hairy * straight * bob * loose,
    medium: hairy * straight * medium * loose,
    long: hairy * straight * long * loose,
    bun: hairy * hints.bun * (1 - frontLong),
    ponytail: hairy * hints.ponytail * (1 - hints.bun) * (1 - frontLong),
  };
}

/** Likelihood of each headwear seen on the front photo. */
function headwearLikelihood(hair: HairFront): Likelihood {
  const covered = step(hair.coverTop, RULES.covered, 0.05);
  const sides = step(hair.coverSides, RULES.scarfSides, 0.05);
  const hat = step(hair.hatTop, RULES.cap, 0.05);
  const onTop = Math.max(covered, hat) * (1 - sides);
  return { none: (1 - covered) * (1 - hat), headscarf: covered * sides, cap: onTop, beanie: onTop * 0.6 };
}

/**
 * Likelihood of each beard and moustache (the moustache depends on the beard, see population.ts).
 * There is a single beard (between short and long), a goatee (always with the moustache) and a single
 * moustache. The photos can't tell a goatee from a full beard: their frequencies decide. A thin
 * moustache (or the shadow of stubble on the lip) counts as none.
 */
function facialHairLikelihood({ skin, chin, jaw, mustache, below }: FacialHairFront) {
  const skinL = lightness(skin);
  const white = step(-chin.dark, RULES.whiteBeard, 0.015) * step(chin.diff, 0.07, 0.015);
  // Grey or salt-and-pepper: hardly darker than the skin, but duller.
  const grey = step(chin.grey + jaw.grey, RULES.greyBeard, 0.01);
  const beard = Math.max(step(chin.dark, RULES.beard, 0.03), white, grey);
  const thick = chin.dark < 0 ? 1
    : Math.max(step(chin.dark / skinL, RULES.thick, 0.05), grey * step(chin.grey, RULES.greyThick, 0.008));
  const long = step(below, RULES.longBeard, 0.05);
  const lip = step(mustache.dark, RULES.mustache, 0.03);
  const lipThick = step(Math.abs(mustache.dark) / skinL, RULES.thick, 0.05);
  // A white or grey moustache is not darker than the skin, but greyer: looked for like the beard it goes with.
  const whiteLip = white * step(mustache.diff, 0.06, 0.01) * (1 - step(mustache.dark, 0.05, 0.02));
  const greyLip = grey * step(mustache.grey, RULES.greyLip, 0.01);
  const moustache = Math.max(lip * lipThick, whiteLip, greyLip);
  const grown = beard * (1 - (1 - long) * (1 - thick));
  return {
    // Found because it is duller than the skin, not darker: grey, not a warm colour.
    grey: grey * (1 - step(chin.dark, RULES.beard, 0.03)),
    // A goatee comes with a moustache: likely only as much as the moustache is.
    beard: { none: 1 - beard, stubble: beard * (1 - long) * (1 - thick), goatee: grown * moustache, short: grown },
    mustache: { none: 1 - moustache, thick: moustache },
  };
}

/** Likelihood of each hair colour for the facial hair (`facial`: facialHairLikelihood()). */
function beardColorLikelihood(color: Rgb, facial: ReturnType<typeof facialHairLikelihood>) {
  const likelihood = hairLikelihood(color);
  const [, , chestnut, red, blond] = HAIR_COLORS;
  for (const warm of [chestnut, red, blond]) likelihood[warm] *= 1 - facial.grey;
  return likelihood;
}

/**
 * Gender 'f' | 'm' and how sure (0.5–1), from the age-gender estimate, facial hair tipping the unsure
 * cases (a shadow on the lip doesn't outweigh a clear estimate); null when unknown. Never displayed.
 */
function estimateGender(estimate: AgeGender | null | undefined, facialHair: number): { gender: Gender | null; certainty: number } {
  if (!estimate) return facialHair > 0.5 ? { gender: 'm', certainty: facialHair } : { gender: null, certainty: 0.5 };
  const male = Math.min(1, estimate.male + 0.3 * facialHair);
  return male > RULES.masculine ? { gender: 'm', certainty: male } : { gender: 'f', certainty: 1 - male };
}

// Typical error of an age guessed from one face (the network gives no uncertainty of its own).
const AGE_ERROR = 5;
const AGE_GROUPS: Record<AgeGroup, [number, number, string]> = { teen: [0, 20, 'moins de 20 ans'], adult: [20, 45, '20 à 44 ans'], senior: [45, 200, '45 ans et plus'] };

/** Normal cumulative distribution (Abramowitz–Stegun approximation of erf). */
function normalCdf(x: number) {
  const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2);
  const erf = 1 - t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))))
    * Math.exp(-(x * x) / 2);
  return 0.5 * (1 + Math.sign(x) * erf);
}

/** How sure the age group of `estimate` ({ age }) is. */
function ageCertainty({ age }: AgeGender) {
  const [from, to] = AGE_GROUPS[ageGroup(age)];
  return normalCdf((to - age) / AGE_ERROR) - normalCdf((from - age) / AGE_ERROR);
}

// Colours have no labels in options.ts: names for the findings.
export const HAIR_NAMES: Record<string, string> = {
  '#1f1612': 'noirs', '#4a3426': 'bruns', '#7a4a2a': 'châtains', '#b5672e': 'roux', '#e8c27a': 'blonds',
  '#8f8a85': 'gris', '#d9d4cf': 'blancs',
};
export const EYE_NAMES: Record<string, string> = { '#5b3a29': 'marron', '#2b1d17': 'marron foncé', '#8a6a2f': 'noisette', '#4f8f5a': 'verts', '#3f7cbf': 'bleus' };
export const CLOTH_NAMES: Record<string, string> = {
  '#2b2b2e': 'noir', '#8e9196': 'gris', '#f7f3ee': 'blanc', '#cdb497': 'beige', '#7a5236': 'brun', '#2f3a56': 'bleu marine',
  '#5b7fb8': 'bleu', '#3f7a57': 'vert', '#b83a44': 'rouge', '#f4c04e': 'jaune', '#8e72b8': 'violet', '#ff9fb1': 'rose',
};
export const GLASSES_NAMES: Record<string, string> = {
  '#2b2d42': 'noires', '#6b4226': 'écaille', '#c9a227': 'dorées', '#b8bec6': 'argentées', [CLEAR_FRAME]: 'transparentes',
};

/** Label of option `id` in `list` (options.ts), as written in a finding. */
const label = (list: Option[], id: string) => list.find((option) => option.id === id)!.label.toLowerCase();

/** Look key → [name of the field, its options (or colour names)], for reports and docs. */
export const FIELDS = {
  faceShape: ['Forme du visage', FACE_SHAPES], eyeShape: ['Forme des yeux', EYE_SHAPES], eyeColor: ['Yeux', EYE_NAMES],
  skinMarks: ['Taches', SKIN_MARKS],
  hairStyle: ['Coupe', HAIR_STYLES], hair: ['Cheveux', HAIR_NAMES], beard: ['Barbe', BEARDS],
  mustache: ['Moustache', MUSTACHES], beardColor: ['Couleur de la barbe', HAIR_NAMES], glasses: ['Lunettes', GLASSES],
  glassesColor: ['Monture', GLASSES_NAMES], headwear: ['Sur la tête', HEADWEAR], headwearColor: ['Couleur du couvre-chef', CLOTH_NAMES],
  earrings: ["Boucles d'oreilles", EARRINGS], outfit: ['Tenue', OUTFITS], top: ['Haut', CLOTH_NAMES], bottom: ['Bas', CLOTH_NAMES],
  shoes: ['Chaussures', CLOTH_NAMES],
} satisfies Partial<Record<keyof Look, [string, Option[] | Record<string, string>]>>;

/** A look key the scan reports on. */
export type FieldKey = keyof typeof FIELDS;

/** Readable name of option `id` of look key `key`. */
export function optionLabel(key: FieldKey, id: string): string {
  const names = FIELDS[key][1];
  return Array.isArray(names) ? names.find((o) => o.id === id)?.label ?? id : names[id] ?? id;
}

const percent = (x: number) => `${Math.round(100 * x)} %`;

/**
 * One line of the console report: the option chosen for `key`, how sure (its share of all the
 * scores, frequencies included) and how well the measurement alone fits it (its likelihood).
 */
function reportLine(key: FieldKey, id: string, scores: Frequencies, likelihood: Likelihood = {}): ReportLine {
  const total = Object.values(scores).reduce((sum, v) => sum + v, 0);
  const measured = Object.keys(likelihood).length > 0;
  return {
    élément: FIELDS[key][0],
    choix: optionLabel(key, id),
    certitude: percent(total ? scores[id] / total : 0),
    'accord avec la mesure': measured ? percent(likelihood[id] ?? 0) : 'non mesuré : le plus fréquent',
  };
}

/** Prints what the scan guessed about the visitor in the console (never on screen). */
export function logReport({ gender, age, lines }: ScanReport) {
  console.group('🔎 Scan du visage : ce que j’estime');
  console.info(`Genre : ${gender.value} (certitude ${percent(gender.certainty)})`);
  if (age) console.info(`Âge : ${age.value} ans, tranche ${age.group} (certitude ${percent(age.certainty)}, ±${age.error} ans)`);
  else console.info('Âge : inconnu (pas de visage de face)');
  console.table(lines);
  console.groupEnd();
}

/** Mark coordinates in pixels → fractions of the photo, so the animation can draw at any size. */
function normalize(view: { width: number; height: number }, mark: Mark): Mark {
  const nx = (x: number) => x / view.width;
  const ny = (y: number) => y / view.height;
  switch (mark.type) {
    case 'box': return { ...mark, box: [nx(mark.box[0]), ny(mark.box[1]), nx(mark.box[2]), ny(mark.box[3])] };
    case 'dots': return { ...mark, points: mark.points.map(([x, y]) => [nx(x), ny(y)]) };
    default: return mark;
  }
}

/**
 * Measurements → { look, base, findings, report }. The scan guesses gender and age first, then
 * starts from the most likely look for them (`base`, see population.ts) and refines it: each finding
 * is one option of the "Crée ton perso" screen, shown during the analysis animation:
 * { view, icon, title, value, patch, color?, marks: [...] }. What isn't measured at all (face shape,
 * earrings, trousers, shoes) stays as in `base`. Every option
 * is neutral or coded for the visitor's estimated gender (see options.ts). `report`: what was guessed
 * and how sure, for the console (logReport).
 */
export function classify(features: Features, views: PhotoViews): Classification {
  const { face, hair, glasses, facialHair, geometry: g } = features;
  // 1. Gender and age first (facial hair only tips an unsure gender estimate), and the skin: they set
  //    how frequent every other option is.
  const facial = facialHair && facialHairLikelihood(facialHair);
  const facialHairSeen = facial ? Math.max(1 - facial.beard.none, 1 - facial.mustache.none) : 0;
  const { gender, certainty: genderCertainty } = estimateGender(features.ageGender, facialHairSeen);
  const skin = face ? skinTone(face.skin) : null;
  const context: VisitorContext & { age: AgeGroup } = {
    gender,
    age: ageGroup(features.ageGender?.age ?? 16),
    skin: skinGroup(Math.max(0, (SKIN_TONES as (string | null)[]).indexOf(skin))),
  };
  // 2. The most likely look for this visitor, refined below by every measurement.
  const base = baseLook(context);

  // Every decision is noted with how sure it is, for the console (logReport).
  const lines: ReportLine[] = [];
  if (skin) {
    lines.push({
      élément: 'Teint', choix: `n° ${SKIN_TONES.indexOf(skin) + 1} sur ${SKIN_TONES.length} (du plus clair au plus foncé)`,
      certitude: '—', 'accord avec la mesure': 'mesuré sur les joues',
    });
  }
  /** decide(), noting the result; `field`: look key it fills when not `key` (colours). */
  const choose = (key: FrequencyKey, ctx: VisitorContext, likelihood: Likelihood = {},
    { floor = FLOOR, field = key }: { floor?: number; field?: FieldKey } = {}) => {
    const scores = weigh(key, ctx, likelihood, floor);
    const id = best(scores);
    lines.push(reportLine(field, id, scores, likelihood));
    return id;
  };

  const look: Partial<Look> = {};
  const findings: Finding[] = [];
  const add = (view: ViewName, finding: Omit<Finding, 'view' | 'marks'> & { marks?: Mark[] }) => {
    const patch = fitLook(finding.patch, gender);
    const marks = (finding.marks ?? []).map((m) => normalize(views[view]!, m));
    findings.push({ view, ...finding, patch, marks });
    Object.assign(look, patch);
  };

  // Hair colour first: eye colour frequencies depend on it.
  const headwear = hair ? choose('headwear', context, headwearLikelihood(hair)) : 'none';
  const hairHidden = headwear === 'headscarf';
  const hairStyle = hair && !hairHidden
    ? choose('hairStyle', context, styleLikelihood(features as Features & { hair: HairFront }, headwear === 'cap')) : null;
  const hairSeen = hair?.color && hairStyle !== 'bald' && hairStyle !== 'shaved' && !hairHidden;
  // Hidden, shaved or no hair: the colour of the beard if there is one, otherwise the most frequent.
  const hairColor = choose('hair', context, hairSeen ? hairLikelihood(hair.color!)
    : facialHairSeen > 0.5 && facialHair!.color ? beardColorLikelihood(facialHair!.color, facial!) : {});
  context.hair = hairColor;

  if (face && g) {
    add('front', {
      icon: 'drop', title: 'Teint', color: skin!, value: 'mesuré sur les joues',
      patch: { skin: skin! },
      marks: [{ type: 'dots', points: [50, 280, 101, 330].map(g.p), big: true }],
    });
    const eyeColor = choose('eyeColor', context, colorLikelihood(face.iris, EYE_COLORS, 0.08));
    const almond = 1 - step(face.eyeOpen, CALIBRATION.almondBelow, 0.02);
    const eyeShape = choose('eyeShape', context, { almond, round: 1 - almond });
    const eyeBoxes = [468, 473].map((i): Mark => {
      const [x, y] = g.p(i);
      return { type: 'box', box: [x - 0.13 * g.faceW, y - 0.07 * g.faceH, x + 0.13 * g.faceW, y + 0.07 * g.faceH] };
    });
    add('front', {
      icon: 'eye', title: 'Yeux', color: eyeColor, value: `${EYE_NAMES[eyeColor]}, ${label(EYE_SHAPES, eyeShape)}`,
      patch: { eyeColor, eyeShape },
      marks: eyeBoxes,
    });
  }

  if (glasses) {
    const present = step(glasses.amount, RULES.glasses, 0.01) * step(glasses.bridge, RULES.glassesBridge, 0.015);
    const angular = step(glasses.cornerRatio, RULES.squareCorners, 0.12);
    const shape = choose('glasses', context, {
      none: 1 - present, round: present * (1 - angular),
      ...Object.fromEntries(['square', 'bold', 'catEye', 'browline'].map((id) => [id, present * angular])),
    });
    if (shape === 'none') {
      add('front', { icon: 'eyeglasses', title: 'Lunettes', value: label(GLASSES, 'none'), patch: { glasses: 'none' } });
    } else {
      const color = choose('glassesColor', context, glasses.color ? colorLikelihood(glasses.color, GLASSES_COLORS, 0.1) : {});
      add('front', {
        icon: 'eyeglasses', title: 'Lunettes', value: `${label(GLASSES, shape)}, ${GLASSES_NAMES[color]}`, color,
        patch: { glasses: shape, glassesColor: color },
        marks: [...glasses.marks.lenses.map((box): Mark => ({ type: 'box', box })), { type: 'mask', cls: 5 }],
      });
    }
  }

  if (headwear !== 'none' && g) {
    const color = choose('top', context, hair!.coverColor ? clothLikelihood(hair!.coverColor) : {}, { floor: 1e-5, field: 'headwearColor' });
    add('front', {
      icon: 'baseball-cap', title: 'Sur la tête', value: label(HEADWEAR, headwear), color,
      patch: { headwear, headwearColor: color },
      marks: [{ type: 'box', box: [g.faceL, g.topY - 0.45 * g.faceH, g.faceR, g.topY + 0.05 * g.faceH] }],
    });
  }

  // Top: below the chin and on the back photo, leaving out a headscarf draped over the shoulders.
  const clothes = topColor([features.clothesFront, features.clothesBack], headwear === 'headscarf' ? hair!.coverColor : null);
  const top = choose('top', context, clothes ? clothLikelihood(clothes) : {}, { floor: 1e-5 });
  if (clothes) {
    const view = (features.clothesFront?.amount as number) > 0.05 ? 'front' : 'back'; // undefined > 0.05: false
    add(view, {
      icon: 't-shirt', title: 'Haut', value: CLOTH_NAMES[top], color: top, patch: { top },
      marks: [{ type: 'mask', cls: 4 }, ...(view === 'front' ? [{ type: 'box' as const, box: features.clothesFront!.box }] : [])],
    });
  }

  if (facial) {
    const beard = choose('beard', context, facial.beard);
    const mustache = choose('mustache', { ...context, beard }, facial.mustache);
    const hasHair = beard !== 'none' || mustache !== 'none';
    const beardColor = hasHair && facialHair.color
      ? choose('hair', context, beardColorLikelihood(facialHair.color, facial), { field: 'beardColor' }) : hairColor;
    add('front', {
      icon: 'beard', title: 'Barbe', value: label(BEARDS, beard), color: beard !== 'none' ? beardColor : undefined,
      patch: { beard, beardColor },
      marks: [{ type: 'dots', points: facialHair.marks.beard, big: true, on: beard !== 'none' }],
    });
    add('front', {
      icon: 'mustache', title: 'Moustache', value: label(MUSTACHES, mustache), color: mustache !== 'none' ? beardColor : undefined,
      patch: { mustache },
      marks: [{ type: 'dots', points: facialHair.marks.mustache, big: true, on: mustache !== 'none' }],
    });
  }

  if (hairStyle) {
    if (hairSeen) {
      add('front', {
        icon: 'hair-dryer', title: 'Cheveux', color: hairColor, value: HAIR_NAMES[hairColor], patch: { hair: hairColor },
        marks: [{ type: 'mask', cls: 1 }, ...(hair.marks.crown ? [{ type: 'box' as const, box: hair.marks.crown }] : [])],
      });
    }
    // Uses the profiles too: shown once every photo has been scanned.
    add('front', { icon: 'scissors', title: 'Coupe', value: label(HAIR_STYLES, hairStyle), patch: { hairStyle }, final: true });
  }

  // Not measured (face shape, trousers, shoes…): the base look, without a finding. Freckles depend
  // on the hair colour, measured since.
  const skinMarks = decide('skinMarks', context);
  const result = fitLook({ ...base, skinMarks, hair: hairColor, beardColor: hairColor, ...look }, gender);
  // Trousers not the colour of the top, or the character would wear a onesie.
  if (result.bottom === result.top) {
    result.bottom = decide('bottom', context, Object.fromEntries(CLOTH_COLORS.map((c) => [c, c === result.top ? 0 : 1])));
  }
  // Unknown gender: the one the look itself took (fitLook), applied to what the animation shows too.
  const shown = gender ?? lookGender(result);
  for (const finding of findings) finding.patch = fitLook(finding.patch, shown);
  for (const key of ['faceShape', 'skinMarks', 'earrings', 'outfit', 'bottom', 'shoes'] as const) {
    lines.push(reportLine(key, result[key], weigh(key, context)));
  }

  const estimate = features.ageGender;
  const report = {
    gender: { value: { f: 'femme', m: 'homme' }[gender as Gender] ?? 'inconnu', certainty: genderCertainty },
    age: estimate && {
      value: Math.round(estimate.age),
      group: AGE_GROUPS[context.age][2],
      certainty: ageCertainty(estimate),
      error: AGE_ERROR,
    },
    lines,
  };
  return { look: result, base: fitLook(base, shown), findings, report };
}
