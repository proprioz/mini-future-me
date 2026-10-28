import type { FaceLandmarker, ImageSegmenter, NormalizedLandmark } from '@mediapipe/tasks-vision';
import { createLandmarker, createSegmenter } from './vision.ts';
import { FaceSampler, headYaw, type FaceRaw } from './FaceSampler.ts';
import { CLASSES, centroidX, is, type MaskView } from './masks.ts';
import {
  frontGeometry, hairFront, glassesFront, facialHairFront,
  type FrontGeometry, type HairFront, type GlassesFront, type FacialHairFront,
} from './frontFeatures.ts';
import { sideFeatures, type SideFeatures } from './headFeatures.ts';
import { clothesFront, clothesBack, type ClothesPart } from './clothes.ts';
import { classify, type Classification } from './classify.ts';
import { estimateAgeGender, preloadAgeGender, type AgeGender } from './ageGender.ts';

const SIZE = 512; // photos are analysed at this size (longest side)
export type ViewName = 'front' | 'left' | 'right' | 'back';
export const VIEW_NAMES: ViewName[] = ['front', 'left', 'right', 'back'];
const FRONT_YAW = 0.45; // head turn (headYaw) under which a photo is a front view
// How far the face sits in front of the neck and shoulders, in image widths: ≥ 0.22 on the profiles of
// public/portraits, ≤ 0.07 on their backs (where only the ears or a bald head show some skin).
const PROFILE_SHIFT = 0.12;

const FACE = is(CLASSES.face);
const BODY = is(CLASSES.body, CLASSES.clothes);
const HAIR = is(CLASSES.hair);

/** A photo as the analyzer takes it. */
export type PhotoSource = ImageBitmap | HTMLImageElement | HTMLCanvasElement;
export type PhotoSources = Partial<Record<ViewName, PhotoSource>>;

/** One analysed photo: scaled canvas, its pixels and class mask (and face landmarks on the front). */
export interface PhotoView extends MaskView {
  canvas: HTMLCanvasElement;
  landmarks?: NormalizedLandmark[];
}
export type PhotoViews = Partial<Record<ViewName, PhotoView>>;

/** Raw measurements of every photo (only what could be measured). */
export interface Features {
  ageGender?: AgeGender | null;
  face?: FaceRaw | null;
  faceRaw?: ReturnType<FaceSampler['debug']>;
  hair?: HairFront;
  glasses?: GlassesFront;
  facialHair?: FacialHairFront | null;
  geometry?: FrontGeometry;
  clothesFront?: Required<ClothesPart>;
  left?: SideFeatures | null;
  right?: SideFeatures | null;
  clothesBack?: ClothesPart;
}

export interface Measurements {
  views: PhotoViews;
  features: Features;
}

export type ScanResult = Measurements & Classification;

/**
 * Analyses up to four portrait photos (front, both profiles, back) entirely in the browser: the
 * front gives the face, hair, glasses and facial hair, the profiles help with the hair style, and
 * the front and back give the colour of the top. Photos only live in memory during the analysis;
 * the result is a partial look plus the "findings" used to animate the analysis.
 */
export class PortraitAnalyzer {
  landmarker: FaceLandmarker;
  segmenter: ImageSegmenter;

  static async create() {
    preloadAgeGender();
    const [landmarker, segmenter] = await Promise.all([createLandmarker(), createSegmenter()]);
    return new PortraitAnalyzer(landmarker, segmenter);
  }

  constructor(landmarker: FaceLandmarker, segmenter: ImageSegmenter) {
    this.landmarker = landmarker;
    this.segmenter = segmenter;
  }

  /** Image (bitmap, <img>, canvas…) → analysed view: scaled canvas, pixels and class mask. */
  prepare(source: PhotoSource): PhotoView {
    const scale = SIZE / Math.max(source.width, source.height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(source.width * scale);
    canvas.height = Math.round(source.height * scale);
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

    const result = this.segmenter.segment(canvas);
    const mask = new Uint8Array(result.categoryMask!.getAsUint8Array());
    result.close();
    return { canvas, width: canvas.width, height: canvas.height, pixels: ctx.getImageData(0, 0, canvas.width, canvas.height), mask };
  }

  /**
   * Which view `source` is ('front', 'left', 'right' or 'back'), so photos picked together land in
   * the right slots. A face looking straight is the front (landmarks are unreliable on profiles);
   * otherwise a face ahead of the neck and shoulders is a profile, « gauche » when it looks towards the
   * left of the photo, and no face or one right above them is the back. Null if there is nobody.
   */
  guessView(source: PhotoSource): ViewName | null {
    const view = this.prepare(source);
    const landmarks = this.landmarker.detect(view.canvas).faceLandmarks[0];
    view.canvas.width = 0;
    if (landmarks && Math.abs(headYaw(landmarks)) < FRONT_YAW) return 'front';

    const face = centroidX(view, FACE);
    const body = centroidX(view, BODY) ?? centroidX(view, HAIR);
    if (body === null) return null;
    const shift = face === null ? 0 : (face - body) / view.width;
    if (Math.abs(shift) < PROFILE_SHIFT) return 'back';
    return shift < 0 ? 'left' : 'right';
  }

  /** Raw measurements of each view. `sources`: { front, left, right, back }, any of them may be missing. */
  async measure(sources: PhotoSources): Promise<Measurements> {
    const views: PhotoViews = {};
    for (const name of VIEW_NAMES) if (sources[name]) views[name] = this.prepare(sources[name]);

    const features: Features = {};
    const front = views.front;
    if (front) {
      const landmarks = this.landmarker.detect(front.canvas).faceLandmarks[0];
      if (landmarks) {
        front.landmarks = landmarks;
        // Gender and age first: everything else is weighed with what is frequent for them.
        features.ageGender = await estimateAgeGender(front.canvas, landmarks);
        const g = frontGeometry(front, landmarks);
        const face = new FaceSampler();
        face.addGeometry(landmarks, front.width, front.height);
        face.addColors(front.pixels, landmarks);
        features.face = face.raw();
        features.faceRaw = face.debug(); // for calibration (tools/playwright/analyze.ts)
        features.hair = hairFront(front, g);
        features.glasses = glassesFront(front, g);
        features.facialHair = facialHairFront(front, g);
        features.geometry = g;
        features.clothesFront = clothesFront(front, g);
      }
    }
    for (const name of ['left', 'right'] as const) {
      if (views[name]) features[name] = sideFeatures(views[name]);
    }
    if (views.back) features.clothesBack = clothesBack(views.back);
    return { views, features };
  }

  /** Everything: measurements, decisions (look) and findings for the animation. */
  async analyze(sources: PhotoSources): Promise<ScanResult> {
    const { views, features } = await this.measure(sources);
    return { views, features, ...classify(features, views) };
  }
}
