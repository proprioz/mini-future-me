// Shows the multiclass segmentation of test photos as coloured overlays, to see what the model finds.
// Usage from browser_evaluate: (await import('/tools/playwright/segment.ts')).show(['face2', 'back-bun'])
import { FilesetResolver, ImageSegmenter } from '@mediapipe/tasks-vision';

const COLORS = [null, [255, 120, 0], [0, 200, 255], [255, 230, 0], [60, 90, 255], [255, 0, 200]];
let segmenter: ImageSegmenter | undefined;

export async function show(names: string[], size = 300) {
  segmenter ??= await ImageSegmenter.createFromOptions(await FilesetResolver.forVisionTasks('/mediapipe/wasm'), {
    baseOptions: { modelAssetPath: '/mediapipe/selfie_multiclass_256x256.tflite', delegate: 'GPU' },
    runningMode: 'IMAGE',
    outputCategoryMask: true,
    outputConfidenceMasks: false,
  });
  document.getElementById('sheet')?.remove();
  const el = document.createElement('div');
  el.id = 'sheet';
  el.style.cssText = `position:fixed;inset:0;z-index:99;background:#fff;display:grid;grid-template-columns:repeat(4,${size}px);gap:4px;align-content:start`;
  const counts: Record<string, number[]> = {};
  for (const name of names) {
    const img = new Image();
    img.src = name.startsWith('/') ? name : `/.playwright-mcp/faces/${name}.jpg`; // test photos, not committed
    await img.decode();
    const scale = size / Math.max(img.width, img.height);
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const result = segmenter.segment(c);
    const mask = result.categoryMask!.getAsUint8Array();
    const data = ctx.getImageData(0, 0, c.width, c.height);
    const histogram = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < mask.length; i++) {
      histogram[mask[i]]++;
      const color = COLORS[mask[i]];
      if (!color) continue;
      for (let k = 0; k < 3; k++) data.data[i * 4 + k] = data.data[i * 4 + k] * 0.4 + color[k] * 0.6;
    }
    result.close();
    ctx.putImageData(data, 0, 0);
    counts[name] = histogram.map((n) => Math.round((100 * n) / mask.length));
    const fig = document.createElement('figure');
    fig.style.cssText = 'margin:0;position:relative';
    fig.append(c, Object.assign(document.createElement('figcaption'), { textContent: name, style: 'position:absolute;top:2px;left:4px;background:#fff;font:700 13px sans-serif' }));
    el.append(fig);
  }
  document.body.append(el);
  return { labels: segmenter.getLabels(), percent: counts };
}
