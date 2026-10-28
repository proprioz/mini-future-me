import { SKIN_TONES, EYE_COLORS } from '../character/options.ts';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { Look } from '../character/Character.ts';
import { hexToRgb, rgbToHex, nearestColor, lightness, medianRgb, litColor, median, type Rgb } from './color.ts';
import type { Point } from './masks.ts';

// MediaPipe Face Landmarker indices (478 points, irises included).
// "Right"/"left" are the subject's, so the right eye is on the left of a non-mirrored image.
const LM = {
  faceRight: 234,
  faceLeft: 454,
  noseTip: 1,
  eyes: [
    { outer: 33, inner: 133, upper: 159, lower: 145, iris: 468, irisEdge: 469 },
    { outer: 263, inner: 362, upper: 386, lower: 374, iris: 473, irisEdge: 474 },
  ],
  // Upper and lower cheeks (beards and shadows of glasses are dropped by litColor).
  cheeks: [50, 280, 101, 330, 205, 425],
};

// Tune these at the stand with real visitors (the dev overlay prints the raw values).
export const CALIBRATION = {
  almondBelow: 0.28, // eye opening (height / width) under which eyes are almond-shaped
  skinLift: 0.02, // photos tend to under-expose faces: brighten the skin a bit
  // Well-lit photos flatten skin tones: stretch lightness around a typical light skin so darker
  // skins come out as dark as they look.
  skinPivot: 0.8,
  skinContrast: 1.5,
};

const MAX_SAMPLES = 40;

/** Medians of the face measurements (FaceSampler.raw()). */
export interface FaceRaw {
  eyeOpen: number;
  skin: Rgb;
  iris: Rgb;
}

/** Landmark in pixels of a `width` × `height` image. */
function px(landmarks: NormalizedLandmark[], index: number, width: number, height: number): Point {
  const p = landmarks[index];
  return [p.x * width, p.y * height];
}

function dist([ax, ay]: Point, [bx, by]: Point): number {
  return Math.hypot(ax - bx, ay - by);
}

/**
 * Head turn from the nose position between the face edges: 0 facing the camera,
 * positive when the subject turns to their left (the nose towards the right of the photo).
 */
export function headYaw(landmarks: NormalizedLandmark[]): number {
  const right = landmarks[LM.faceRight].x;
  const left = landmarks[LM.faceLeft].x;
  return ((landmarks[LM.noseTip].x - right) / (left - right) - 0.5) * 2;
}

/** Pixels of `image` (ImageData) inside a disc (or ring, or horizontal band of a ring) around (cx, cy). */
function patch(image: ImageData, cx: number, cy: number, radius: number, { inner = 0, maxDy = Infinity } = {}): Rgb[] {
  const pixels: Rgb[] = [];
  const r = Math.max(1, Math.round(radius));
  for (let y = Math.round(cy) - r; y <= Math.round(cy) + r; y++) {
    for (let x = Math.round(cx) - r; x <= Math.round(cx) + r; x++) {
      if (x < 0 || y < 0 || x >= image.width || y >= image.height) continue;
      const d = Math.hypot(x - cx, y - cy);
      if (d > radius || d < inner || Math.abs(y - cy) > maxDy) continue;
      const i = (y * image.width + x) * 4;
      pixels.push([image.data[i], image.data[i + 1], image.data[i + 2]]);
    }
  }
  return pixels;
}

/** Palette skin tone closest in lightness, so it keeps a natural hue whatever the photo. */
export function skinTone(rgb: Rgb): string {
  const { skinLift, skinPivot, skinContrast } = CALIBRATION;
  const target = skinPivot + (lightness(rgb) + skinLift - skinPivot) * skinContrast;
  const gap = (hex: string) => Math.abs(lightness(hexToRgb(hex)) - target);
  return SKIN_TONES.reduce((best, hex) => (gap(hex) < gap(best) ? hex : best));
}

/**
 * Measurements of the face on the front photo (skin, eyes): the analysis
 * (classify.ts) weighs their medians with the frequency of each option. Only numbers are kept: no
 * image of the face is ever stored.
 */
export class FaceSampler {
  geometry: { eyeOpen: number }[];
  colors: { skin: Rgb; iris: Rgb }[];

  constructor() {
    this.geometry = [];
    this.colors = [];
  }

  /** Eye opening, from the landmarks of a neutral, front-facing frame. */
  addGeometry(landmarks: NormalizedLandmark[], width: number, height: number) {
    if (this.geometry.length >= MAX_SAMPLES) return;
    const p = (index: number) => px(landmarks, index, width, height);
    const open = LM.eyes.map((eye) => dist(p(eye.upper), p(eye.lower)) / dist(p(eye.outer), p(eye.inner)));
    this.geometry.push({ eyeOpen: (open[0] + open[1]) / 2 });
  }

  /** Skin and iris colours, sampled from `image` (ImageData of the current frame). */
  addColors(image: ImageData, landmarks: NormalizedLandmark[]) {
    if (this.colors.length >= MAX_SAMPLES) return;
    const p = (index: number) => px(landmarks, index, image.width, image.height);
    const faceWidth = dist(p(LM.faceRight), p(LM.faceLeft));

    // Lit half of the cheeks: shadows of glasses, hair or the nose would darken the skin.
    const skin = litColor(LM.cheeks.flatMap((i) => patch(image, ...p(i), faceWidth * 0.035)));
    // Iris: both sides of the pupil. Above and below, eyelids and lashes usually cover it.
    const iris = medianRgb(LM.eyes.flatMap((eye) => {
      const radius = dist(p(eye.iris), p(eye.irisEdge));
      return patch(image, ...p(eye.iris), radius * 0.85, { inner: radius * 0.45, maxDy: radius * 0.4 });
    }));
    if (skin && iris) this.colors.push({ skin, iris });
  }

  /** Medians of everything sampled so far (null until there is something). */
  raw(): FaceRaw | null {
    if (!this.geometry.length || !this.colors.length) return null;
    return {
      eyeOpen: median(this.geometry.map((g) => g.eyeOpen))!,
      skin: medianRgb(this.colors.map((c) => c.skin))!,
      iris: medianRgb(this.colors.map((c) => c.iris))!,
    };
  }

  /** Quick partial look for the live preview (skin, eyes), or null if nothing was measured. */
  toLook(): Pick<Look, 'skin' | 'eyeColor' | 'eyeShape'> | null {
    const raw = this.raw();
    if (!raw) return null;
    return {
      skin: skinTone(raw.skin),
      eyeColor: nearestColor(raw.iris, EYE_COLORS, 0.5),
      eyeShape: raw.eyeOpen < CALIBRATION.almondBelow ? 'almond' : 'round',
    };
  }

  /** Raw values rounded for display (dev overlay, calibration). */
  debug(): { eyeOpen?: number; skin?: string; iris?: string } {
    const raw = this.raw();
    if (!raw) return {};
    const round = (v: number) => Number(v.toFixed(3));
    return {
      eyeOpen: round(raw.eyeOpen), skin: rgbToHex(raw.skin), iris: rgbToHex(raw.iris),
    };
  }
}
