// Colour helpers for the face scan: photo pixels are compared to palettes in OKLab,
// where distances roughly match what the eye sees.

/** A colour as [r, g, b], 0-255. */
export type Rgb = [number, number, number];
/** OKLab [L, a, b]. */
export type Oklab = [number, number, number];

export function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]: Rgb): string {
  const c = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** sRGB (0-255) to OKLab [L, a, b], L in 0..1. */
export function rgbToOklab([r, g, b]: Rgb): Oklab {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [lr, lg, lb] = [lin(r), lin(g), lin(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363137098 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** Palette entry closest to `rgb`; `lightnessWeight` < 1 cares more about hue than brightness. */
export function nearestColor(rgb: Rgb, palette: readonly string[], lightnessWeight = 1): string {
  const [L, a, b] = rgbToOklab(rgb);
  let best = palette[0];
  let bestDistance = Infinity;
  for (const hex of palette) {
    const [L2, a2, b2] = rgbToOklab(hexToRgb(hex));
    const distance = ((L - L2) * lightnessWeight) ** 2 + (a - a2) ** 2 + (b - b2) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = hex;
    }
  }
  return best;
}

/** Perceptual distance between two colours (OKLab ΔE, ~0.02 = barely visible). */
export function colorDistance(a: Rgb, b: Rgb): number {
  const [L1, a1, b1] = rgbToOklab(a);
  const [L2, a2, b2] = rgbToOklab(b);
  return Math.hypot(L1 - L2, a1 - a2, b1 - b2);
}

export function lightness(rgb: Rgb): number {
  return rgbToOklab(rgb)[0];
}

/** Per-channel median of a list of [r, g, b]: robust to stray pixels (glasses, shadows, background). */
export function medianRgb(samples: Rgb[]): Rgb | null {
  if (!samples.length) return null;
  return [0, 1, 2].map((channel) => median(samples.map((s) => s[channel]))) as Rgb;
}

/** Colour of a surface as seen in the light: skips the darkest 40 % (shadows) and brightest 10 % (shine). */
export function litColor(pixels: Rgb[]): Rgb | null {
  const sorted = [...pixels].sort((a, b) => lightness(b) - lightness(a));
  const n = sorted.length;
  return medianRgb(n < 5 ? sorted : sorted.slice(Math.floor(n * 0.1), Math.ceil(n * 0.6)));
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((x, y) => x - y);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
