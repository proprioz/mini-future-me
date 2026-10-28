import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Three-step ramp shared by every toon material: gives the flat "cartoon" shading.
let gradientMap: THREE.DataTexture | null = null;

function getGradientMap(): THREE.DataTexture {
  if (!gradientMap) {
    gradientMap = new THREE.DataTexture(new Uint8Array([110, 190, 255]), 3, 1, THREE.RedFormat);
    gradientMap.minFilter = THREE.NearestFilter;
    gradientMap.magFilter = THREE.NearestFilter;
    gradientMap.needsUpdate = true;
  }
  return gradientMap;
}

export function toon(color: THREE.ColorRepresentation, params: THREE.MeshToonMaterialParameters = {}): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ color, gradientMap: getGradientMap(), ...params });
}

export function mesh<G extends THREE.BufferGeometry, M extends THREE.Material | THREE.Material[]>(
  geometry: G, material: M,
): THREE.Mesh<G, M> {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function box(
  w: number, h: number, d: number, color: THREE.ColorRepresentation, radius = 0.03,
  params?: THREE.MeshToonMaterialParameters,
): THREE.Mesh<THREE.BufferGeometry, THREE.MeshToonMaterial> {
  const r = Math.min(radius, Math.min(w, h, d) / 2 - 0.001);
  const geometry = r > 0.002 ? new RoundedBoxGeometry(w, h, d, 2, r) : new THREE.BoxGeometry(w, h, d);
  return mesh(geometry, toon(color, params));
}

export function cylinder(
  radiusTop: number, radiusBottom: number, height: number, color: THREE.ColorRepresentation,
  params?: THREE.MeshToonMaterialParameters, segments = 24,
): THREE.Mesh<THREE.CylinderGeometry, THREE.MeshToonMaterial> {
  return mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), toon(color, params));
}

export function sphere(
  radius: number, color: THREE.ColorRepresentation, params?: THREE.MeshToonMaterialParameters, segments = 20,
): THREE.Mesh<THREE.SphereGeometry, THREE.MeshToonMaterial> {
  return mesh(new THREE.SphereGeometry(radius, segments, Math.round(segments * 0.7)), toon(color, params));
}

export function place<T extends THREE.Object3D>(object: T, x: number, y: number, z: number): T {
  object.position.set(x, y, z);
  return object;
}

/** Mixes two '#rrggbb' colours in sRGB space (what the eye expects for 2D drawing). */
export function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) => {
    const va = (pa >> shift) & 255;
    const vb = (pb >> shift) & 255;
    return Math.round(va + (vb - va) * t);
  };
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
}

/** Positive amount lightens, negative darkens. */
export function shadeHex(hex: string, amount: number): string {
  return amount >= 0 ? mixHex(hex, '#ffffff', amount) : mixHex(hex, '#000000', -amount);
}
