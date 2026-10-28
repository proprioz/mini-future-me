import { CLASSES, rect, bounds, rowExtents, centroidX, is, type MaskView } from './masks.ts';

// Raw measurements on the profile photos, from the segmentation only (no landmarks there).
// Lengths are relative to the head height H (top of the hair → bottom of the face).

const HAIR = is(CLASSES.hair);
const FACE = is(CLASSES.face);
const HEAD = is(CLASSES.hair, CLASSES.face, CLASSES.accessory);

/** Hair seen on a profile photo (see sideFeatures()). */
export interface SideHair {
  bald?: undefined;
  backY: number;
  hang: number;
  hangWidth: number;
}

/** A profile photo: its hair, or a bald head. */
export type SideFeatures = SideHair | { bald: true };

/** Profile photo: how high the hair goes behind the head (bun) and how far it hangs below the jaw. */
export function sideFeatures(view: MaskView): SideFeatures | null {
  const face = bounds(view, FACE);
  const head = bounds(view, HEAD);
  if (!face || !head || face.count < 50) return null;

  const headTop = head.y0;
  const faceBottom = face.y1;
  const H = Math.max(1, faceBottom - headTop);
  const faceX = centroidX(view, FACE)!;
  const hairX = centroidX(view, HAIR, rect(0, headTop, view.width, faceBottom));
  if (hairX === null) return { bald: true };
  const facing = faceX > hairX ? 1 : -1; // +1: the face looks towards +x

  // Row where the hair reaches furthest behind the head.
  const rows = rowExtents(view, HAIR, rect(0, headTop, view.width, view.height));
  let backX: number | null = null;
  let backRow = 0;
  rows.forEach((row, i) => {
    if (!row) return;
    const x = facing > 0 ? row[0] : row[1];
    if (backX === null || (facing > 0 ? x < backX : x > backX)) {
      backX = x;
      backRow = i;
    }
  });

  // Hair below the jaw: how far down, and how wide that hanging part is.
  const hanging = rows.slice(Math.round(faceBottom - headTop)).filter(Boolean) as [number, number][];
  const lowest = rows.reduce((last, row, i) => (row ? i : last), 0) + headTop;
  const hangWidth = hanging.length ? hanging.reduce((s, [l, r]) => s + (r - l), 0) / hanging.length / H : 0;

  return {
    backY: backRow / H, // 0 = top of the head, 1 = jaw level
    hang: (lowest - faceBottom) / H,
    hangWidth,
  };
}
