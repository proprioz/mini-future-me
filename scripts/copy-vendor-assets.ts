// Copies the runtimes and small models shipped inside npm packages into public/, so the photo /
// webcam analysis works offline. Runs on `pnpm install` (postinstall).
import { cpSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const modules = join(root, 'node_modules');

const copies = [
  // MediaPipe WASM runtime (the .task / .tflite models are committed in public/mediapipe).
  { from: join(modules, '@mediapipe', 'tasks-vision', 'wasm'), to: join(root, 'public', 'mediapipe', 'wasm') },
  // face-api age / gender network.
  ...['age_gender_model-weights_manifest.json', 'age_gender_model.bin'].map((file) => ({
    from: join(modules, '@vladmandic', 'face-api', 'model', file),
    to: join(root, 'public', 'face-api', file),
  })),
];

for (const { from, to } of copies) {
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true });
  console.log(`Copié : ${to}`);
}
