// Age / gender estimate (face-api, MIT, runs locally on TensorFlow.js). It gives the frequencies the scan
// weighs its measurements with, and keeps the options neutral or coded for that gender (scan/classify.ts);
// the visitor can change everything. It is never displayed, nor kept once the look is chosen.
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { AgeAndGenderPrediction } from '@vladmandic/face-api';

const MODEL_PATH = '/face-api';
const INPUT = 112;

type FaceApi = typeof import('@vladmandic/face-api');
// The published types of the TensorFlow.js bundled in face-api leave these two out.
type Tf = FaceApi['tf'] & { setBackend(name: string): Promise<boolean>; ready(): Promise<void> };

/** `male`: probability 0–1. */
export interface AgeGender {
  male: number;
  age: number;
}

let loading: Promise<FaceApi> | null = null;

function load() {
  loading ??= (async () => {
    const faceapi = await import('@vladmandic/face-api');
    try {
      await (faceapi.tf as Tf).setBackend('webgl');
    } catch {
      await (faceapi.tf as Tf).setBackend('cpu');
    }
    await (faceapi.tf as Tf).ready();
    await faceapi.nets.ageGenderNet.loadFromUri(MODEL_PATH);
    return faceapi;
  })();
  return loading;
}

/** Starts loading early (optional). */
export function preloadAgeGender() {
  load().catch(() => {});
}

/**
 * `image`: canvas of the front photo, `landmarks`: its MediaPipe face landmarks.
 * Resolves with { male: probability 0–1, age } or null if the estimate is unavailable.
 */
export async function estimateAgeGender(image: HTMLCanvasElement, landmarks: NormalizedLandmark[]): Promise<AgeGender | null> {
  let faceapi: FaceApi;
  try {
    faceapi = await load();
  } catch (error) {
    console.warn('Estimation âge / genre indisponible :', error);
    return null;
  }
  // Square crop around the face, with some margin (the network was trained on loose crops).
  const xs = landmarks.map((p) => p.x * image.width);
  const ys = landmarks.map((p) => p.y * image.height);
  const size = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) * 1.4;
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
  const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  const crop = document.createElement('canvas');
  crop.width = crop.height = INPUT;
  crop.getContext('2d')!.drawImage(image, cx - size / 2, cy - size / 2, size, size, 0, 0, INPUT, INPUT);

  // One image in, one prediction out (an array only for a batch).
  const { gender, genderProbability, age } = await faceapi.nets.ageGenderNet.predictAgeAndGender(crop) as AgeAndGenderPrediction;
  crop.width = 0;
  return { male: gender === 'male' ? genderProbability : 1 - genderProbability, age };
}
