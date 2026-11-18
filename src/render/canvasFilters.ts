// Colour adjustments and blur of a 2D canvas, computed on its pixels. Safari (on the iPad as on the Mac)
// ignores the canvas `filter` property (`ctx.filter`) without an error, so the game never uses it.

/** Factors of the CSS filters of the same name: 1 changes nothing. */
export interface ColorAdjust {
  saturate?: number;
  brightness?: number;
  contrast?: number;
}

/** Applies `saturate()`, then `brightness()`, then `contrast()` to the canvas, in place, like the CSS filters. */
export function adjustColors(canvas: HTMLCanvasElement, { saturate = 1, brightness = 1, contrast = 1 }: ColorAdjust) {
  const g = canvas.getContext('2d')!;
  const image = g.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = image;
  // Brightness then contrast, for each channel value: a lookup table.
  const lut = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v++) lut[v] = (Math.min(255, v * brightness) - 127.5) * contrast + 127.5;
  // The saturation matrix of the Filter Effects spec.
  const s = saturate;
  const m = [
    0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s,
    0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s,
    0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s,
  ];
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let gr = data[i + 1];
    let b = data[i + 2];
    if (s !== 1) {
      [r, gr, b] = [
        Math.min(255, Math.max(0, Math.round(m[0] * r + m[1] * gr + m[2] * b))),
        Math.min(255, Math.max(0, Math.round(m[3] * r + m[4] * gr + m[5] * b))),
        Math.min(255, Math.max(0, Math.round(m[6] * r + m[7] * gr + m[8] * b))),
      ];
    }
    data[i] = lut[r];
    data[i + 1] = lut[gr];
    data[i + 2] = lut[b];
  }
  g.putImageData(image, 0, 0);
}

/**
 * Blurs the canvas in place like the CSS `blur(radius px)` (a Gaussian whose standard deviation is the
 * radius), the edges extended rather than faded. A large blur is computed on a smaller copy, scaled back up.
 */
export function blurCanvas(canvas: HTMLCanvasElement, radius: number) {
  if (radius <= 0) return;
  const { width, height } = canvas;
  const shrink = Math.max(1, Math.min(4, Math.floor(radius / 2)));
  let work = canvas;
  if (shrink > 1) {
    work = document.createElement('canvas');
    work.width = Math.max(1, Math.round(width / shrink));
    work.height = Math.max(1, Math.round(height / shrink));
    work.getContext('2d')!.drawImage(canvas, 0, 0, work.width, work.height);
  }

  const g = work.getContext('2d')!;
  const image = g.getImageData(0, 0, work.width, work.height);
  const { data } = image;
  const w = work.width;
  const h = work.height;
  // Premultiplied alpha, so that transparent pixels don't darken their neighbours.
  const a = new Float32Array(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3] / 255;
    a[i] = data[i] * alpha;
    a[i + 1] = data[i + 1] * alpha;
    a[i + 2] = data[i + 2] * alpha;
    a[i + 3] = data[i + 3];
  }
  const b = new Float32Array(data.length);
  // Three box blurs in a row are close to a Gaussian.
  for (const r of boxRadii(radius / shrink, 3)) {
    boxBlur(a, b, h, w, r, 4, w * 4); // rows
    boxBlur(b, a, w, h, r, w * 4, 4); // columns
  }
  for (let i = 0; i < data.length; i += 4) {
    const alpha = a[i + 3];
    const k = alpha > 0 ? 255 / alpha : 0;
    data[i] = a[i] * k;
    data[i + 1] = a[i + 1] * k;
    data[i + 2] = a[i + 2] * k;
    data[i + 3] = alpha;
  }
  g.putImageData(image, 0, 0);

  if (shrink > 1) {
    const out = canvas.getContext('2d')!;
    out.clearRect(0, 0, width, height);
    out.drawImage(work, 0, 0, width, height);
  }
}

/** Radii of `n` box blurs that together blur like a Gaussian of standard deviation `sigma`. */
function boxRadii(sigma: number, n: number) {
  let lower = Math.floor(Math.sqrt((12 * sigma * sigma) / n + 1));
  if (lower % 2 === 0) lower--;
  const upper = lower + 2;
  const m = Math.round((12 * sigma * sigma - n * lower * lower - 4 * n * lower - 3 * n) / (-4 * lower - 4));
  return Array.from({ length: n }, (_, i) => ((i < m ? lower : upper) - 1) / 2);
}

/**
 * Box blur of radius `r` along one direction of an RGBA buffer: `lines` lines of `length` pixels,
 * `step` apart within a line and `stride` apart between lines (both in array items).
 */
function boxBlur(src: Float32Array, dst: Float32Array, lines: number, length: number, r: number, step: number, stride: number) {
  if (r === 0) {
    dst.set(src);
    return;
  }
  const scale = 1 / (2 * r + 1);
  const last = length - 1;
  for (let line = 0; line < lines; line++) {
    const start = line * stride;
    for (let c = start; c < start + 4; c++) {
      let sum = 0;
      for (let x = -r; x <= r; x++) sum += src[c + Math.min(last, Math.max(0, x)) * step];
      for (let x = 0; x < length; x++) {
        dst[c + x * step] = sum * scale;
        sum += src[c + Math.min(last, x + r + 1) * step] - src[c + Math.max(0, x - r) * step];
      }
    }
  }
}
