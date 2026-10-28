// Helpers on segmentation results. A "view" is one analysed photo:
// { width, height, pixels: ImageData, mask: Uint8Array of class ids (one per pixel) }.
import type { Rgb } from './color.ts';

export interface MaskView {
  width: number;
  height: number;
  pixels: ImageData;
  mask: Uint8Array;
}

/** Pixel area, x1 and y1 excluded. */
export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Pixel coordinates [x, y], and a box [x0, y0, x1, y1]. */
export type Point = [number, number];
export type Box = [number, number, number, number];

/** Whether a pixel counts, from its class id (and its index in the mask). */
export type ClassTest = (cls: number, index: number) => boolean;

/** Class ids of the selfie multiclass segmenter. */
export const CLASSES = { background: 0, hair: 1, body: 2, face: 3, clothes: 4, accessory: 5 };

export function rect(x0: number, y0: number, x1: number, y1: number): Rect {
  return { x0: Math.floor(x0), y0: Math.floor(y0), x1: Math.ceil(x1), y1: Math.ceil(y1) };
}

function clip(view: MaskView, r: Rect): Rect {
  return {
    x0: Math.max(0, r.x0), y0: Math.max(0, r.y0),
    x1: Math.min(view.width, r.x1), y1: Math.min(view.height, r.y1),
  };
}

/** Calls `fn(x, y, index)` for the pixels of `r` (whole view by default) whose class passes `test`. */
export function forEachPixel(view: MaskView, test: ClassTest, fn: (x: number, y: number, index: number) => void,
  r = rect(0, 0, view.width, view.height)) {
  const { x0, y0, x1, y1 } = clip(view, r);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = y * view.width + x;
      if (test(view.mask[i], i)) fn(x, y, i);
    }
  }
}

/** Fraction of the pixels of `r` whose class passes `test`. */
export function coverage(view: MaskView, test: ClassTest, r: Rect): number {
  const c = clip(view, r);
  const area = Math.max(1, (c.x1 - c.x0) * (c.y1 - c.y0));
  let count = 0;
  forEachPixel(view, test, () => count++, c);
  return count / area;
}

/** Bounding box and count of the pixels passing `test` inside `r`, or null if there are none. */
export function bounds(view: MaskView, test: ClassTest, r?: Rect): (Rect & { count: number }) | null {
  let box = null as Rect | null; // assigned in the callback: not narrowed to null
  let count = 0;
  forEachPixel(view, test, (x, y) => {
    count++;
    if (!box) box = { x0: x, y0: y, x1: x + 1, y1: y + 1 };
    else {
      box.x0 = Math.min(box.x0, x);
      box.x1 = Math.max(box.x1, x + 1);
      box.y0 = Math.min(box.y0, y);
      box.y1 = Math.max(box.y1, y + 1);
    }
  }, r);
  return box && { ...box, count };
}

/** Mean x of the pixels passing `test` inside `r`, or null if there are none. */
export function centroidX(view: MaskView, test: ClassTest, r?: Rect): number | null {
  let sum = 0;
  let n = 0;
  forEachPixel(view, test, (x) => {
    sum += x;
    n++;
  }, r);
  return n ? sum / n : null;
}

/** Colours [r, g, b] of (at most ~`limit`) pixels passing `test` inside `r`. */
export function colorsWhere(view: MaskView, test: ClassTest, r?: Rect, limit = 4000): Rgb[] {
  const c = clip(view, r ?? rect(0, 0, view.width, view.height));
  const step = Math.max(1, Math.floor(Math.sqrt(((c.x1 - c.x0) * (c.y1 - c.y0)) / limit)));
  const out: Rgb[] = [];
  const { data } = view.pixels;
  for (let y = c.y0; y < c.y1; y += step) {
    for (let x = c.x0; x < c.x1; x += step) {
      const i = y * view.width + x;
      if (test(view.mask[i], i)) out.push([data[i * 4], data[i * 4 + 1], data[i * 4 + 2]]);
    }
  }
  return out;
}

/** Colours of the pixels within `radius` of (cx, cy) whose class passes `test` (all by default). */
export function colorsAround(view: MaskView, [cx, cy]: Point, radius: number, test: ClassTest = () => true): Rgb[] {
  const r = Math.max(1, radius);
  return colorsWhere(view, test, rect(cx - r, cy - r, cx + r + 1, cy + r + 1), 400);
}

/** For each row of `r`: [leftmost x, rightmost x] of the pixels passing `test`, or null. */
export function rowExtents(view: MaskView, test: ClassTest, r: Rect): ([number, number] | null)[] {
  const c = clip(view, r);
  const rows: ([number, number] | null)[] = [];
  for (let y = c.y0; y < c.y1; y++) {
    let left = -1;
    let right = -1;
    for (let x = c.x0; x < c.x1; x++) {
      if (!test(view.mask[y * view.width + x], y * view.width + x)) continue;
      if (left < 0) left = x;
      right = x;
    }
    rows.push(left < 0 ? null : [left, right]);
  }
  return rows;
}

/** Mean absolute second difference of a profile (ragged outlines → large values). */
export function jaggedness(values: (number | null)[]): number {
  const v = values.filter((x) => x !== null);
  if (v.length < 3) return 0;
  let sum = 0;
  for (let i = 1; i < v.length - 1; i++) sum += Math.abs(v[i + 1] - 2 * v[i] + v[i - 1]);
  return sum / (v.length - 2);
}

export const is = (...ids: number[]) => (c: number) => ids.includes(c);
