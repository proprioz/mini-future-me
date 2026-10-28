import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import {
  CLASSES, rect, coverage, bounds, colorsWhere, colorsAround, rowExtents, jaggedness, is,
  type MaskView, type ClassTest, type Box, type Point,
} from './masks.ts';
import { medianRgb, litColor, lightness, colorDistance, rgbToOklab, type Rgb } from './color.ts';

// Raw measurements on the front photo (segmentation + face landmarks). Decisions are taken in
// classify.ts, so thresholds can be tuned without touching the measuring code.
// Lengths are relative to the face width (faceW) or height (faceH, landmark 10 → 152).

const HAIR = is(CLASSES.hair);
const ACCESSORY = is(CLASSES.accessory);
const FACE = is(CLASSES.face);

const LM = {
  faceRight: 234, faceLeft: 454, top: 10, chin: 152,
  eyes: [468, 473], browsUp: [105, 334], eyeTops: [159, 386], innerEyes: [133, 362],
  cheeks: [50, 280, 101, 330],
  // Between the nose and the upper lip: [nose point, lip point] pairs, sampled at their middle.
  mustache: [[2, 0], [98, 39], [327, 269]],
  chinZone: [199, 175],
  jaw: [148, 377, 176, 400],
};

export type FrontGeometry = ReturnType<typeof frontGeometry>;

export interface HairFront {
  hatTop: number;
  coverTop: number;
  coverSides: number;
  coverColor: Rgb | null;
  amount: number;
  length: number;
  curls: number;
  color: Rgb | null;
  cropped: boolean;
  marks: { crown: Box | null };
}

export interface GlassesFront {
  amount: number;
  bridge: number;
  cornerRatio: number;
  color: Rgb | null;
  marks: { lenses: Box[] };
}

/** How a beard zone differs from the cheeks (see facialHairFront). */
export interface ZoneContrast {
  dark: number;
  diff: number;
  speckle: number;
  grey: number;
}

export interface FacialHairFront {
  skin: Rgb;
  mustache: ZoneContrast;
  chin: ZoneContrast;
  jaw: ZoneContrast;
  below: number;
  color: Rgb | null;
  marks: { mustache: Point[]; beard: Point[] };
}

export function frontGeometry(view: MaskView, landmarks: NormalizedLandmark[]) {
  const p = (i: number): Point => [landmarks[i].x * view.width, landmarks[i].y * view.height];
  const faceL = p(LM.faceRight)[0];
  const faceR = p(LM.faceLeft)[0];
  const topY = p(LM.top)[1];
  const chinY = p(LM.chin)[1];
  return {
    p,
    faceL, faceR, topY, chinY,
    faceW: faceR - faceL,
    faceH: chinY - topY,
    cx: (faceL + faceR) / 2,
    eyeY: (p(LM.eyeTops[0])[1] + p(LM.eyeTops[1])[1]) / 2,
    browY: (p(LM.browsUp[0])[1] + p(LM.browsUp[1])[1]) / 2,
  };
}

/** Hair (or what covers it) seen from the front: amount on the crown, length beside the face, curls, colour. */
export function hairFront(view: MaskView, g: FrontGeometry): HairFront {
  const { faceL, faceR, faceW, faceH, topY, chinY, eyeY, browY } = g;
  // Headwear: hats are segmented as "accessory", scarves and turbans as "clothes" or "accessory".
  const COVER = is(CLASSES.clothes, CLASSES.accessory);
  const crownBox = rect(faceL, topY - 0.4 * faceH, faceR, topY + 0.05 * faceH);
  const hatTop = coverage(view, ACCESSORY, crownBox);
  const coverTop = coverage(view, COVER, crownBox);
  const coverSides = (coverage(view, COVER, rect(faceL - 0.25 * faceW, eyeY, faceL, chinY))
    + coverage(view, COVER, rect(faceR, eyeY, faceR + 0.25 * faceW, chinY))) / 2;
  const coverColor = litColor(colorsWhere(view, COVER, crownBox));
  // Share of the area around the top of the head that is hair (≈ 0: bald or covered).
  const amount = coverage(view, HAIR, rect(faceL - 0.2 * faceW, topY - 0.45 * faceH, faceR + 0.2 * faceW, eyeY));

  const crown = bounds(view, HAIR, rect(faceL - 0.3 * faceW, 0, faceR + 0.3 * faceW, browY));

  // Lowest hair beside the face (both sides), compared to the chin.
  const sides = [
    rect(faceL - 0.5 * faceW, eyeY, faceL + 0.05 * faceW, view.height),
    rect(faceR - 0.05 * faceW, eyeY, faceR + 0.5 * faceW, view.height),
  ];
  const lows = sides.map((r) => bounds(view, HAIR, r)?.y1 ?? eyeY);
  const lowest = Math.max(...lows);
  const length = (lowest - chinY) / faceH;

  // Ragged outline (curls): wobble of the left/right edges and of the top edge.
  const rows = rowExtents(view, HAIR, rect(0, crown?.y0 ?? topY, view.width, eyeY));
  const columns: (number | null)[] = [];
  if (crown) {
    for (let x = crown.x0; x < crown.x1; x++) {
      columns.push(bounds(view, HAIR, rect(x, crown.y0, x + 1, eyeY))?.y0 ?? null);
    }
  }
  const curls = (jaggedness(rows.map((r) => r?.[0] ?? null)) + jaggedness(rows.map((r) => r?.[1] ?? null))
    + jaggedness(columns)) / 3 / faceW * 100;

  const color = litColor(colorsWhere(view, HAIR, rect(0, 0, view.width, eyeY)));

  return {
    hatTop, coverTop, coverSides, coverColor, amount, length, curls, color,
    // The photo stops before the end of the hair (portrait cropped at the chin or shoulders).
    cropped: lowest >= view.height - 2,
    marks: { crown: crown && [crown.x0, crown.y0, crown.x1, crown.y1] },
  };
}

/** Glasses: the segmenter puts frames (and tinted lenses) in the "accessory" class. */
export function glassesFront(view: MaskView, g: FrontGeometry): GlassesFront {
  const { p, faceL, faceR, faceW, faceH, browY, eyeY } = g;
  const region = rect(faceL, browY - 0.05 * faceH, faceR, eyeY + 0.2 * faceH);
  const amount = coverage(view, ACCESSORY, region);
  // Bridge of the nose between the inner corners of the eyes: every frame crosses it, a turban or a
  // cap coming down over the temples never does.
  const [innerR, innerL] = LM.innerEyes.map((i) => p(i)[0]);
  const bridge = coverage(view, ACCESSORY, rect(innerR, eyeY - 0.06 * faceH, innerL, eyeY + 0.04 * faceH));

  type Lens = { box: Box; cornerRatio: number };
  const lenses = LM.eyes.map((i): Lens | null => {
    const [ex, ey] = p(i);
    const box = bounds(view, ACCESSORY, rect(ex - 0.22 * faceW, ey - 0.15 * faceH, ex + 0.22 * faceW, ey + 0.15 * faceH));
    if (!box) return null;
    const w = box.x1 - box.x0;
    const h = box.y1 - box.y0;
    const fill = box.count / Math.max(1, w * h);
    // Frames reaching into the corners of their bounding box are rectangular; round ones leave them empty.
    const cw = Math.max(1, Math.round(w * 0.22));
    const ch = Math.max(1, Math.round(h * 0.22));
    const corners = [[box.x0, box.y0], [box.x1 - cw, box.y0], [box.x0, box.y1 - ch], [box.x1 - cw, box.y1 - ch]]
      .map(([x, y]) => coverage(view, ACCESSORY, rect(x, y, x + cw, y + ch)));
    const cornerRatio = (corners.reduce((a, b) => a + b, 0) / 4) / Math.max(0.01, fill);
    return { box: [box.x0, box.y0, box.x1, box.y1], cornerRatio };
  }).filter(Boolean) as Lens[];

  const mean = (key: 'cornerRatio') => (lenses.length ? lenses.reduce((s, l) => s + l[key], 0) / lenses.length : 0);
  return {
    amount,
    bridge,
    cornerRatio: mean('cornerRatio'),
    color: medianRgb(colorsWhere(view, ACCESSORY, region)),
    marks: { lenses: lenses.map((l) => l.box) },
  };
}

/**
 * Beard and moustache: how different from the cheeks the chin, jaw and upper lip are (darker for
 * most beards, greyer / lighter for white ones).
 */
export function facialHairFront(view: MaskView, g: FrontGeometry): FacialHairFront | null {
  const { p, faceW, faceH, cx, chinY } = g;
  const middle = ([a, b]: number[]) => p(a).map((v, k) => (v + p(b)[k]) / 2) as Point;
  // Long beards are segmented as hair; but on the jaw, hair is more likely long head hair falling over it.
  const FACE_OR_HAIR = is(CLASSES.face, CLASSES.hair);
  const zone = (points: Point[], test: ClassTest) => {
    const pixels = points.flatMap((pt) => colorsAround(view, pt, 0.035 * faceW, test));
    return { color: medianRgb(pixels), pixels };
  };
  const cheeks = LM.cheeks.flatMap((i) => colorsAround(view, p(i), 0.04 * faceW, FACE));
  const skin = litColor(cheeks);
  if (!skin) return null;
  const mustache = zone(LM.mustache.map(middle), FACE_OR_HAIR);
  const chin = zone(LM.chinZone.map(p), FACE_OR_HAIR);
  const jaw = zone(LM.jaw.map(p), FACE);

  const skinL = lightness(skin);
  // Hairs on skin make a speckled zone: spread of the lightness (10th to 90th percentile), compared
  // to the cheeks', and colourfulness lost relative to the lightness (grey and white hairs; a mere
  // shadow darkens the skin without making it greyer).
  const spread = (pixels: Rgb[]) => {
    const L = pixels.map(lightness).sort((a, b) => a - b);
    return L.length < 5 ? 0 : L[Math.floor(L.length * 0.9)] - L[Math.floor(L.length * 0.1)];
  };
  const saturation = (c: Rgb) => {
    const [L, a, b] = rgbToOklab(c);
    return Math.hypot(a, b) / L;
  };
  const cheekSpread = spread(cheeks);
  const describe = ({ color, pixels }: { color: Rgb | null; pixels: Rgb[] }): ZoneContrast => (color
    ? {
      dark: skinL - lightness(color),
      diff: colorDistance(color, skin),
      speckle: spread(pixels) - cheekSpread,
      grey: saturation(skin) - saturation(color),
    }
    : { dark: 0, diff: 0, speckle: 0, grey: 0 });

  // Facial hair colour: the pixels clearly different from the skin in the beard zones, on the same
  // side of the skin's lightness as the chin (darker for most beards, lighter for white ones).
  const lighter = chin.color && lightness(chin.color) > skinL;
  const hairy = [...mustache.pixels, ...chin.pixels, ...jaw.pixels]
    .filter((c) => colorDistance(c, skin) > 0.1 && (lightness(c) > skinL) === lighter);

  // A long beard hangs below the chin and is segmented as hair.
  const below = coverage(view, HAIR, rect(cx - 0.25 * faceW, chinY, cx + 0.25 * faceW, chinY + 0.25 * faceH));

  return {
    skin,
    mustache: describe(mustache),
    chin: describe(chin),
    jaw: describe(jaw),
    below,
    color: medianRgb(hairy),
    marks: {
      mustache: LM.mustache.map(middle),
      beard: [...LM.chinZone, ...LM.jaw].map(p),
    },
  };
}
