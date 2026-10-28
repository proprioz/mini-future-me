import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { cel, celMesh } from '../../render/celMaterial.ts';
import { designCanvas } from './PosterLayout.ts';
import type { Design } from './PosterLayout.ts';
import type { Creation, Results } from '../types.ts';

// What the character holds on the final poster: the poster the visitor laid out in the layout task,
// a sheet of thick paper in A-format, a little shorter than the legs.
const SHEET = { w: 0.38 / Math.SQRT2, h: 0.38, thickness: 0.008 };

const art = new WeakMap<Design, HTMLCanvasElement>(); // design → its canvas, drawn once however many times the sheet is rebuilt

export const creation: Creation<Design> = {
  /** The layout's result ({ slots, background, ink }), or null before the layout task is won. */
  from(results: Results) {
    return (results.layout as Design | undefined) ?? null;
  },

  /** A sheet of thick paper with the visitor's poster on its front. */
  mesh(design: Design) {
    if (!art.has(design)) art.set(design, designCanvas(design));
    const texture = new THREE.CanvasTexture(art.get(design)!);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    const poster = new THREE.Group();
    const sheet = celMesh(new RoundedBoxGeometry(SHEET.w, SHEET.h, SHEET.thickness, 1, 0.003), cel('#ffffff', { rim: 0.2 }), { outline: 0.004 });
    const front = celMesh(new THREE.PlaneGeometry(SHEET.w, SHEET.h), cel('#ffffff', { map: texture, rim: 0 }), { outline: 0, shadow: false });
    front.position.z = SHEET.thickness / 2 + 0.0005;
    poster.add(sheet, front);
    poster.userData.size = { w: SHEET.w, h: SHEET.h, d: SHEET.thickness };
    return poster;
  },

  // The poses' grips (poses.ts) are made for a flat sheet like this one: nothing to override.
  holds: {},
};
