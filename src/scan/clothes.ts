import { CLASSES, rect, coverage, colorsWhere, is, type MaskView, type Box } from './masks.ts';
import { litColor, colorDistance, type Rgb } from './color.ts';
import type { FrontGeometry } from './frontFeatures.ts';

// Colour of the top (T-shirt, sweater…), from the "clothes" class of the segmentation: below the
// chin on the front photo, and the lower part of the back photo, where it shows the most.

const CLOTHES = is(CLASSES.clothes);

/** Clothes seen on one photo: their pixels, the share of the area they cover, and that area (front). */
export interface ClothesPart {
  pixels: Rgb[];
  amount: number;
  box?: Box;
}

/** Clothes pixels below the face of the front photo, and the area they were looked for in. */
export function clothesFront(view: MaskView, g: FrontGeometry): Required<ClothesPart> {
  const { faceL, faceR, faceW, faceH, chinY } = g;
  const area = rect(faceL - 0.8 * faceW, chinY + 0.25 * faceH, faceR + 0.8 * faceW, view.height);
  return { pixels: colorsWhere(view, CLOTHES, area), amount: coverage(view, CLOTHES, area), box: [area.x0, area.y0, area.x1, area.y1] };
}

/** Clothes pixels in the lower half of the back photo. */
export function clothesBack(view: MaskView): ClothesPart {
  const area = rect(0, view.height * 0.5, view.width, view.height);
  return { pixels: colorsWhere(view, CLOTHES, area), amount: coverage(view, CLOTHES, area) };
}

/**
 * Colour of the top as seen in the light (folds and shadows dropped), from every view that shows
 * enough of it, or null. `besides`: a colour to leave out (a headscarf draped over the shoulders is
 * segmented as clothes too).
 */
export function topColor(parts: (ClothesPart | undefined)[], besides: Rgb | null = null): Rgb | null {
  const seen = parts.filter((part) => part && part.amount > 0.05) as ClothesPart[];
  // Wide around the scarf colour: its folds in the shade are darker.
  const pixels = seen.flatMap((part) => part.pixels).filter((c) => !besides || colorDistance(c, besides) > 0.2);
  return pixels.length > 200 ? litColor(pixels) : null;
}
