// Runs the FaceSampler on still test photos with the app's own landmarker (while the scan screen is open).
export async function measure(names: string[]) {
  const { FaceSampler } = await import('/src/scan/FaceSampler.ts');
  const analyzer = (await window.studio.scan.analyzerPromise)!;
  const out: Record<string, unknown> = {};
  for (const name of names) {
    const img = new Image();
    img.src = `/.playwright-mcp/faces/${name}.jpg`; // test photos, not committed
    await img.decode();
    const c = document.createElement('canvas');
    c.width = c.height = 640;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0, 640, 640);
    const sampler = new FaceSampler();
    const lm = analyzer.landmarker.detect(c).faceLandmarks[0];
    if (lm) {
      sampler.addGeometry(lm, 640, 640);
      sampler.addColors(ctx.getImageData(0, 0, 640, 640), lm);
    }
    out[name] = { raw: sampler.debug(), look: sampler.toLook() };
  }
  return out;
}
