// Shared loading of the MediaPipe vision runtime and models, all served from public/ (works offline).
import type { FaceLandmarker, FilesetResolver, ImageSegmenter } from '@mediapipe/tasks-vision';

const WASM_PATH = '/mediapipe/wasm';
const LANDMARKER_MODEL = '/mediapipe/face_landmarker.task';
const SEGMENTER_MODEL = '/mediapipe/selfie_multiclass_256x256.tflite';

type Vision = typeof import('@mediapipe/tasks-vision');
type Delegate = 'GPU' | 'CPU';
type WasmFileset = Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>;

let runtime: Promise<{ vision: Vision; fileset: WasmFileset }> | null = null;

/** The tasks-vision module and its WASM fileset, loaded once and only when a scan starts. */
function loadRuntime() {
  runtime ??= (async () => {
    const vision = await import('@mediapipe/tasks-vision');
    const fileset = await vision.FilesetResolver.forVisionTasks(WASM_PATH);
    return { vision, fileset };
  })();
  return runtime;
}

async function withGpuFallback<T>(create: (delegate: Delegate) => Promise<T>): Promise<T> {
  try {
    return await create('GPU');
  } catch {
    return create('CPU');
  }
}

/** Face landmarks (478 points) + blendshapes, on still photos. */
export async function createLandmarker(): Promise<FaceLandmarker> {
  const { vision, fileset } = await loadRuntime();
  return withGpuFallback((delegate) => vision.FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: LANDMARKER_MODEL, delegate },
    runningMode: 'IMAGE',
    numFaces: 1,
    outputFaceBlendshapes: true,
  }));
}

/** Per-pixel classes (see CLASSES in masks.ts): background, hair, body skin, face skin, clothes, accessories. */
export async function createSegmenter(): Promise<ImageSegmenter> {
  const { vision, fileset } = await loadRuntime();
  return withGpuFallback((delegate) => vision.ImageSegmenter.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: SEGMENTER_MODEL, delegate },
    runningMode: 'IMAGE',
    outputCategoryMask: true,
    outputConfidenceMasks: false,
  }));
}
