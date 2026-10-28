import * as THREE from 'three';

// The head: an ellipsoid sculpted into a skull, cheeks, jaw and chin. Everything on it (face
// texture, hair, beard, glasses) is placed with longitude / latitude angles measured from the
// centre of the face: lon > 0 towards the character's left (+X), lat > 0 upwards.

export const HEAD = { rx: 0.185, ry: 0.2, rz: 0.185 };

/** Latitude of the painted / modelled features (eyes, nose tip, mouth): low on the face, chibi style. */
export const FEATURES = { eyeLat: -0.07, noseLat: -0.25, mouthLat: -0.47 };

/** The face texture covers lon and lat in [-FACE_SPAN, FACE_SPAN]; the rest of the head clamps to skin. */
export const FACE_SPAN = 1.25;

const smoothstep = THREE.MathUtils.smoothstep;
const gauss = (x: number) => Math.exp(-x * x);

/** Face proportions (see sculpt() and jawline()). */
export interface HeadParams {
  width?: number;
  length?: number;
  jaw?: number;
  chin?: number;
  taper?: number;
}

/** A point of the head grid → [x, y, z] (or a normal, a uv). */
export type GridVertex = (lon: number, lat: number, d: THREE.Vector3) => number[];

export function direction(lon: number, lat: number): THREE.Vector3 {
  return new THREE.Vector3(Math.sin(lon) * Math.cos(lat), Math.sin(lat), Math.cos(lon) * Math.cos(lat));
}

/**
 * Half-width of the lower face at depth `t` under the eyes (0 = cheeks, 1 = chin), 1 = as wide as
 * the cheeks. `jaw`: 2 = round, higher = the face stays wide down to marked jaw corners, lower =
 * it narrows early towards a fine chin; `chin`: 2 = round chin, higher = flat chin; `taper`: how
 * much narrower the jaw is than the cheeks.
 */
function jawline(t: number, { jaw = 2, chin = 2, taper = 0.1 }: HeadParams): number {
  return (1 - t ** jaw) ** (1 / chin) * (1 - taper * t * t);
}

/**
 * Sculpted head point for a unit direction. `width` and `length`: face proportions; the lower face
 * follows jawline() (see its parameters), seen from the front; the nape stays round.
 */
export function sculpt(d: THREE.Vector3, { width = 1, length = 1, ...jaw }: HeadParams = {}): THREE.Vector3 {
  const low = smoothstep(-d.y, -0.1, 1); // 0 above the cheeks, 1 under the chin
  // Each horizontal ring of the head is scaled to the jawline; `ring` is its radius on the sphere.
  const ring = Math.sqrt(Math.max(1 - d.y * d.y, 0));
  let half = ring;
  let deep = ring;
  if (d.y < 0 && ring > 1e-6) {
    const front = smoothstep(d.z / ring, -0.7, 0.3);
    const shaped = THREE.MathUtils.lerp(ring, jawline(-d.y, jaw), front);
    half = shaped;
    deep = THREE.MathUtils.lerp(ring, shaped, 0.35 * front); // a wide jaw is a little deeper too
  }
  const k = ring > 1e-6 ? 1 / ring : 0;
  const x = d.x * k * half * HEAD.rx * width;
  const y = d.y * HEAD.ry * (d.y < 0 ? length : 1);
  let z = d.z * k * deep * HEAD.rz;
  if (d.z > 0) z *= 1 - 0.1 * low; // flatter face
  else z *= (d.y > -0.35 ? 1.07 : 1) * (1 - 0.32 * low); // round skull, slim nape
  z += gauss(d.x / 0.32) * gauss((d.y + 0.82) / 0.2) * Math.max(d.z, 0) * 0.012; // chin
  return new THREE.Vector3(x, y, z);
}

/** Outward normal of the head around a direction (smooth: faces are lit like a ball, no nose shadows). */
function softNormal(d: THREE.Vector3): THREE.Vector3 {
  return new THREE.Vector3(d.x / HEAD.rx, d.y / HEAD.ry, d.z / HEAD.rz).normalize();
}

/** Point `offset` above the head surface at (lon, lat). */
export function surface(lon: number, lat: number, offset = 0, params?: HeadParams): THREE.Vector3 {
  const d = direction(lon, lat);
  return sculpt(d, params).addScaledVector(softNormal(d), offset);
}

export function surfaceNormal(lon: number, lat: number): THREE.Vector3 {
  return softNormal(direction(lon, lat));
}

/** Grid over the sphere: `vertex(lon, lat, d)` → [x, y, z] (and optional `normal`, `uv`) per vertex. */
interface GridOptions {
  lonSegments?: number;
  latSegments?: number;
  uv?: (lon: number, lat: number) => number[];
  normal?: ((d: THREE.Vector3) => number[]) | null;
}

function sphereGrid(
  vertex: GridVertex, { lonSegments = 72, latSegments = 48, uv = () => [0, 0], normal = null }: GridOptions = {},
): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= latSegments; i++) {
    const lat = Math.PI / 2 - (i / latSegments) * Math.PI;
    for (let j = 0; j <= lonSegments; j++) {
      const lon = -Math.PI + (j / lonSegments) * Math.PI * 2;
      const d = direction(lon, lat);
      positions.push(...vertex(lon, lat, d));
      if (normal) normals.push(...normal(d));
      uvs.push(...uv(lon, lat));
    }
  }
  const row = lonSegments + 1;
  for (let i = 0; i < latSegments; i++) {
    for (let j = 0; j < lonSegments; j++) {
      const a = i * row + j;
      const b = a + row;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  if (normal) geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  geometry.userData.grid = { lonSegments, latSegments };
  return geometry;
}

/**
 * Normals of a sphereGrid after computeVertexNormals: the first and last columns are the same
 * vertices (seam), and each pole row is a single point; average them so no crease or spot shows.
 */
function smoothGridNormals(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const { lonSegments, latSegments } = geometry.userData.grid;
  const normal = geometry.attributes.normal;
  const row = lonSegments + 1;
  const n = new THREE.Vector3();
  const v = new THREE.Vector3();
  const average = (indices: number[]) => {
    n.set(0, 0, 0);
    for (const i of indices) n.add(v.fromBufferAttribute(normal, i));
    n.normalize();
    for (const i of indices) normal.setXYZ(i, n.x, n.y, n.z);
  };
  for (let i = 0; i <= latSegments; i++) average([i * row, i * row + lonSegments]);
  for (const i of [0, latSegments]) average(Array.from({ length: row }, (_, j) => i * row + j));
  normal.needsUpdate = true;
  return geometry;
}

/** The head itself, with the face texture projected on the front. */
export function headGeometry(params: HeadParams): THREE.BufferGeometry {
  return sphereGrid((lon, lat, d) => sculpt(d, params).toArray(), {
    uv: (lon, lat) => [0.5 + lon / (2 * FACE_SPAN), 0.5 + lat / (2 * FACE_SPAN)],
    normal: (d) => softNormal(d).toArray(),
  });
}

/**
 * A layer over the head (hair, beard): `thickness(lon, lat, d)` in head units, ≤ 0 where there is
 * nothing (the layer then tucks under the skin, which draws a clean hairline). `extra(lon, lat, d)`
 * may return a displacement vector (long beards, volume); `uv(lon, lat)` maps a texture on it.
 * `skinNormals`: lit exactly like the head (a skin-tight layer that must blend into the skin).
 */
export interface ShellOptions {
  extra?: ((lon: number, lat: number, d: THREE.Vector3, t: number) => THREE.Vector3) | null;
  uv?: (lon: number, lat: number) => number[];
  segments?: { lonSegments?: number; latSegments?: number };
  skinNormals?: boolean;
}

export function shellGeometry(
  params: HeadParams, thickness: (lon: number, lat: number, d: THREE.Vector3) => number,
  { extra = null, uv, segments = {}, skinNormals = false }: ShellOptions = {},
): THREE.BufferGeometry {
  const geometry = sphereGrid((lon, lat, d) => {
    const t = thickness(lon, lat, d);
    const p = sculpt(d, params).addScaledVector(softNormal(d), t > 0 ? t : -0.004);
    if (extra) p.add(extra(lon, lat, d, t)); // tucked parts follow too, or stretched faces would show
    return p.toArray();
  }, { ...segments, uv, normal: skinNormals ? (d) => softNormal(d).toArray() : null });
  if (skinNormals) return geometry;
  geometry.computeVertexNormals();
  return smoothGridNormals(geometry);
}
