import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { cel, celMesh } from '../render/celMaterial.ts';
import { mixHex, shadeHex } from '../render/materials.ts';
import { direction, surface, surfaceNormal, shellGeometry } from './head.ts';
import type { HeadParams, ShellOptions } from './head.ts';
import { sweep } from './shapes.ts';

// Hair = a shell hugging the skull (with a real hairline) + swept locks, in the cel-shaded style of
// Genshin Impact or Breath of the Wild. Coordinates are relative to the head centre; angles as in
// head.ts (lon 0 = face centre, lat > 0 up).

const { smoothstep, lerp } = THREE.MathUtils;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** How far above the skull each style goes (head units), for hats. */
export const HAIR_VOLUME: Record<string, number> = {
  bald: 0, shaved: 0.002, buzz: 0.008, short: 0.045, curly: 0.08, curlyFade: 0.09, pixie: 0.035, bob: 0.04, medium: 0.04, long: 0.04,
  curlyLong: 0.08, locs: 0.03, braids: 0.02, ponytail: 0.02, bun: 0.02,
};

/** Triangle wave, 0 at multiples of `period`, 1 halfway: pointed strands along an edge. */
/** Shell thickness (head units) at a point of the head. */
type ShellThickness = (lon: number, lat: number) => number;
/** Latitude of a line round the head (hairline…) at a longitude. */
type HeadLine = (lon: number) => number;

/** A direction on the head (see spiral()); `scale`: height of its bump (bumps()). */
interface Spot {
  lon: number;
  lat: number;
  d: THREE.Vector3;
  scale?: number;
}

interface Fringe {
  low: number;
  depth: number;
  period: number;
  spread: number;
}

interface RingletOptions {
  turns?: number;
  radius?: number;
  thickness?: number;
  detail?: number;
  radial?: number;
}

/** What a hair style is made of (see STYLES). */
export interface HairRecipe {
  shell?: ShellThickness;
  extra?: ShellOptions['extra'];
  locks?: THREE.BufferGeometry[];
  top?: THREE.BufferGeometry[];
  fade?: { line: HeadLine; top: HeadLine };
  stubble?: HeadLine;
  shade?: number;
  lockMap?: THREE.Texture;
}

function teeth(x: number, period: number): number {
  const f = x / period - Math.floor(x / period);
  return 1 - 2 * Math.abs(f - 0.5);
}

/**
 * Latitude of the hairline around the head: forehead, temples, above the ears, nape.
 * `fringe`: { low, depth, period, spread } lowers it over the forehead into pointed bangs.
 */
function hairline(
  lon: number,
  { forehead = 0.48, nape = -0.62, sides = null, fringe = null }:
    { forehead?: number; nape?: number; sides?: number | null; fringe?: Fringe | null } = {},
): number {
  const a = Math.abs(lon);
  if (fringe && a < fringe.spread) return fringe.low + fringe.depth * teeth(lon + fringe.period / 2, fringe.period);
  const points = sides === null
    ? [[0, forehead], [0.85, forehead - 0.18], [1.3, 0.12], [1.62, 0.02], [2.3, nape * 0.7], [Math.PI, nape]]
    // Hair over the ears and down the sides (bob, long hair, curls): only the face stays open.
    : [[0, forehead], [0.85, forehead - 0.18], [1.1, sides + 0.3], [1.35, sides], [2.3, Math.min(sides, nape)], [Math.PI, nape]];
  for (let i = 1; i < points.length; i++) {
    const [a0, l0] = points[i - 1];
    const [a1, l1] = points[i];
    if (a <= a1) return lerp(l0, l1, smoothstep(a, a0, a1));
  }
  return nape;
}

/**
 * Shell thickness: `base` everywhere, + `top` on the crown, nothing below the hairline (soft edge,
 * rising over `ramp` radians).
 */
function capThickness(line: HeadLine, base: number, top: number, ramp = 0.04): ShellThickness {
  return (lon, lat) => {
    const edge = line(lon);
    const cover = smoothstep(lat, edge - 0.01, edge + ramp);
    return cover > 0 ? cover * (base + top * Math.max(0, Math.sin(lat))) : 0;
  };
}

/** Swept lock through points, tapering from r0 to a fine tip; `flatten` < 1 makes it ribbon-like. */
function lock(points: THREE.Vector3[], r0: number, { tip = 0.002, flatten = 0.55 }: { tip?: number; flatten?: number } = {}) {
  const curve = new THREE.CatmullRomCurve3(points);
  return sweep(curve, (t) => lerp(r0, tip, t ** 1.4), { segments: 18, radial: 9, flatten });
}

/**
 * Hair falling below the hairline at the sides and back (bob, long hair): the shell is stretched
 * down by up to `length`, straight rather than following the jaw. The face stays open.
 */
function fall(length: number, { from = 1.0 }: { from?: number } = {}) {
  return (lon: number, lat: number): THREE.Vector3 => {
    // Nothing on the crown: there, all longitudes meet, and pushing only the back ones would tear a
    // hole in the top of the hair.
    const side = smoothstep(Math.abs(lon), from, from + 0.35) * (1 - smoothstep(lat, 0.6, 1.2));
    const below = smoothstep(-lat, -0.35, 0.62);
    const n = surfaceNormal(lon, lat);
    const out = V(n.x, 0, n.z).normalize().multiplyScalar(side * (0.015 + 0.03 * below));
    // Pointed ends along the bottom edge.
    const tips = 1 - 0.18 * teeth(lon, 0.32);
    return out.add(V(0, -side * below ** 1.2 * length * tips, 0));
  };
}

/** Directions spread evenly (golden-angle spiral) between latitudes `minLat` and `maxLat`. */
function spiral(count: number, minLat: number, maxLat = Math.PI / 2): Spot[] {
  const top = Math.sin(maxLat);
  const bottom = Math.sin(minLat);
  return Array.from({ length: count }, (_, i) => {
    const lat = Math.asin(top - ((i + 0.5) / count) * (top - bottom));
    const lon = ((i * 2.399963) % (2 * Math.PI)) - Math.PI;
    return { lon, lat, d: direction(lon, lat) };
  });
}

/**
 * Cloud of round bumps of angular `radius` over the hair, `height` high: the outline turns into
 * scallops, the way curls are drawn in cel-shaded games, instead of a pile of balls. Each bump is a
 * dome; where two meet, a crease (which the toon shading draws as a line between two curls), its
 * bottom rounded near the crown by a smooth maximum: there the meridians of the mesh close up, so a
 * crease would be drawn much sharper than elsewhere, the outline showing through like a crack. The
 * spiral also leaves a few holes there, much deeper than the other creases: nothing goes below
 * `floor` (0–1).
 */
function bumps(centres: Spot[], radius: number, height: number, floor = 0): ShellThickness {
  const cos = Math.cos(radius);
  return (lon, lat) => {
    const d = direction(lon, lat);
    const k = 0.4 * smoothstep(lat, 1.0, 1.3) + 1e-6;
    let top = 0;
    for (const c of centres) {
      const dot = d.dot(c.d);
      if (dot <= cos) continue;
      const t = (dot - cos) / (1 - cos);
      const h = Math.sqrt(t * (2 - t)) * (c.scale ?? 1);
      const blend = Math.max(k - Math.abs(top - h), 0) / k;
      top = Math.max(top, h) + (blend * blend * k) / 4;
    }
    return Math.max(top, floor) * height;
  };
}

function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

// Small curls are too many to test at every vertex of every rebuild (thumbnails rebuild characters
// all the time): they are rasterised once on a longitude / latitude grid, then looked up.
const FIELD_LON = 720;
const FIELD_LAT = 360;

/**
 * Field of small round curls (0–1) above latitude `minLat`: `count` domes of angular radius about
 * `radius`, randomly placed and sized, rasterised once; returns a lookup (lon, lat) → 0–1.
 */
function curlField(count: number, radius: number, minLat: number, seed: number): ShellThickness {
  const field = new Float32Array(FIELD_LON * (FIELD_LAT + 1));
  const random = seeded(seed);
  const top = 1;
  const bottom = Math.sin(minLat);
  for (let k = 0; k < count; k++) {
    // Uniform over the sphere cap, jittered sizes: curls never look lined up.
    const clat = Math.asin(bottom + random() * (top - bottom));
    const clon = (random() * 2 - 1) * Math.PI;
    const r = radius * (0.7 + 0.6 * random());
    const height = 0.75 + 0.25 * random();
    const c = direction(clon, clat);
    const cos = Math.cos(r);
    const i0 = Math.max(0, Math.floor(((clat - r + Math.PI / 2) / Math.PI) * FIELD_LAT));
    const i1 = Math.min(FIELD_LAT, Math.ceil(((clat + r + Math.PI / 2) / Math.PI) * FIELD_LAT));
    for (let i = i0; i <= i1; i++) {
      const lat = (i / FIELD_LAT) * Math.PI - Math.PI / 2;
      const ratio = Math.sin(r) / Math.max(1e-3, Math.cos(lat));
      const span = ratio >= 1 ? Math.PI : Math.asin(ratio) + 0.01;
      const j0 = Math.floor(((clon - span + Math.PI) / (2 * Math.PI)) * FIELD_LON);
      const j1 = Math.ceil(((clon + span + Math.PI) / (2 * Math.PI)) * FIELD_LON);
      for (let jj = j0; jj <= j1; jj++) {
        const j = ((jj % FIELD_LON) + FIELD_LON) % FIELD_LON;
        const dot = direction((j / FIELD_LON) * 2 * Math.PI - Math.PI, lat).dot(c);
        if (dot <= cos) continue;
        const t = (dot - cos) / (1 - cos);
        const index = i * FIELD_LON + j;
        field[index] = Math.max(field[index], Math.sqrt(t * (2 - t)) * height);
      }
    }
  }
  return (lon, lat) => {
    const x = ((lon + Math.PI) / (2 * Math.PI)) * FIELD_LON;
    const y = Math.min(FIELD_LAT - 1e-6, Math.max(0, ((lat + Math.PI / 2) / Math.PI) * FIELD_LAT));
    const j0 = ((Math.floor(x) % FIELD_LON) + FIELD_LON) % FIELD_LON;
    const j1 = (j0 + 1) % FIELD_LON;
    const i0 = Math.floor(y);
    const fx = x - Math.floor(x);
    const fy = y - i0;
    const at = (i: number, j: number) => field[i * FIELD_LON + j];
    return lerp(lerp(at(i0, j0), at(i0, j1), fx), lerp(at(i0 + 1, j0), at(i0 + 1, j1), fx), fy);
  };
}

/** Builds `make()` once, on first use. */
function once<T>(make: () => T): () => T {
  let value: T | null = null;
  return () => (value ??= make());
}

const smallCurls = once(() => curlField(900, 0.075, 0, 21));
const curlClumps = once(() => curlField(110, 0.22, 0, 22));

/**
 * Hairline hanging in round lobes over the forehead (curls falling on it), `depth` deep, one lobe
 * every `period` radians, within `spread` of the face centre.
 */
function curlyFringe(lon: number, { high, depth, period, spread }: { high: number; depth: number; period: number; spread: number }): number {
  const lobes = Math.abs(Math.sin((Math.PI * lon) / period));
  return high - depth * lobes * smoothstep(spread - Math.abs(lon), 0, 0.25);
}

/**
 * Corkscrew curl (ringlet) starting at `from`, coiling `turns` times around the `axis` direction
 * over `length`, its coil `radius` and tube `thickness` shrinking towards the tip.
 */
function ringlet(
  from: THREE.Vector3, axis: THREE.Vector3, length: number,
  { turns = 2.5, radius = 0.016, thickness = 0.011, detail = 3, radial = 8 }: RingletOptions = {},
): THREE.BufferGeometry {
  const down = axis.clone().normalize();
  const u = new THREE.Vector3(0, 0, 1).cross(down);
  if (u.lengthSq() < 1e-4) u.set(1, 0, 0);
  u.normalize();
  const v = down.clone().cross(u);
  const steps = Math.ceil(turns * 14);
  const points = Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const a = t * turns * Math.PI * 2;
    const r = radius * (1 - 0.35 * t);
    return from.clone().addScaledVector(down, t * length)
      .addScaledVector(u, Math.cos(a) * r).addScaledVector(v, Math.sin(a) * r);
  });
  return sweep(new THREE.CatmullRomCurve3(points), (t) => lerp(thickness, thickness * 0.55, t ** 1.5),
    { segments: steps * detail, radial });
}

/** Ringlets hanging from the hair at (lon, lat) positions: [lon, lat, length, turns]. */
function ringlets(
  params: HeadParams, spots: [number, number, number, number][], lift: number, options: RingletOptions = {},
): THREE.BufferGeometry[] {
  return spots.map(([lon, lat, length, turns]) => {
    const from = surface(lon, lat, lift, params);
    const n = surfaceNormal(lon, lat);
    // Hanging down, slightly away from the head.
    const axis = new THREE.Vector3(n.x * 0.35, -1, n.z * 0.35);
    return ringlet(from, axis, length, { turns, ...options });
  });
}

/** Vertical gradient (skin at the bottom → hair at the top) for faded sides. */
function fadeTexture(skin: string, hair: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createLinearGradient(0, 64, 0, 0);
  gradient.addColorStop(0, skin);
  gradient.addColorStop(0.12, skin);
  gradient.addColorStop(0.4, mixHex(hair, skin, 0.5));
  gradient.addColorStop(0.7, mixHex(hair, skin, 0.2));
  gradient.addColorStop(1, mixHex(hair, skin, 0.05));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 4, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const stubbleTextures = new Map<string, THREE.CanvasTexture>();

/**
 * Hair shaved very close (like a 3-day beard, for the head), on a longitude / latitude map: the skin
 * darkened towards the hair colour above the hairline `line`, and tiny hairs, all fading out at the
 * hairline. Cached per colours.
 */
function stubbleTexture(skin: string, hair: string, line: HeadLine): THREE.CanvasTexture {
  const key = `${skin}|${hair}`;
  if (!stubbleTextures.has(key)) {
    const W = 1024;
    const H = 512;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;
    const toLat = (y: number) => Math.PI / 2 - (y / H) * Math.PI;
    const toLon = (x: number) => (x / W) * 2 * Math.PI - Math.PI;
    const density = (lon: number, lat: number) => smoothstep(lat, line(lon) - 0.02, line(lon) + 0.14);
    ctx.fillStyle = skin;
    ctx.fillRect(0, 0, W, H);
    // Shade, cell by cell, the hair colour showing through the skin.
    const cell = 4;
    ctx.fillStyle = hair;
    for (let y = 0; y < H; y += cell) {
      for (let x = 0; x < W; x += cell) {
        const d = density(toLon(x + cell / 2), toLat(y + cell / 2));
        if (d <= 0) continue;
        ctx.globalAlpha = 0.28 * d;
        ctx.fillRect(x, y, cell, cell);
      }
    }
    // Tiny hairs, spread evenly over the head (fewer rows of the map near the crown), pointing back.
    const random = seeded(17);
    ctx.strokeStyle = hair;
    ctx.lineWidth = 1.3;
    for (let i = 0; i < 40000; i++) {
      const lat = Math.asin(-0.9 + random() * 1.9);
      const lon = (random() * 2 - 1) * Math.PI;
      if (random() > density(lon, lat)) continue;
      const x = ((lon + Math.PI) / (2 * Math.PI)) * W;
      const y = ((Math.PI / 2 - lat) / Math.PI) * H;
      const stretch = 1 / Math.max(0.25, Math.cos(lat));
      ctx.globalAlpha = 0.2 + random() * 0.25;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (random() - 0.5) * 2.5 * stretch, y + 1 + random() * 2);
      ctx.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    stubbleTextures.set(key, texture);
  }
  return stubbleTextures.get(key)!;
}

/** Hair tie (small torus) at a point, around `normal`. */
function tie(point: THREE.Vector3, normal: THREE.Vector3, radius = 0.028): THREE.TorusGeometry {
  const geometry = new THREE.TorusGeometry(radius, radius * 0.45, 8, 16);
  geometry.lookAt(normal);
  geometry.translate(point.x, point.y, point.z);
  return geometry;
}

/** Shape of the broccoli cut (curlyFade): where the curls start, the mass under them. */
const broccoli = once(() => {
  const a = (lon: number) => Math.abs(lon);
  // Where the curls start: low over the forehead (fringe), at the temples on the sides, lower again
  // at the back of the crown.
  const topLine = (lon: number) => lerp(lerp(0.3, 0.46, smoothstep(a(lon), 0.5, 1.05)), 0.12, smoothstep(a(lon), 1.7, Math.PI));
  const curls = smallCurls();
  const clumps = curlClumps();
  // Mass on the front of the top, heaviest over the forehead.
  const mass = (lon: number, lat: number) => 0.008 + 0.022 * Math.max(0, Math.sin(lat))
    + 0.02 * Math.exp(-((lon / 0.8) ** 2)) * Math.exp(-(((lat - 0.6) / 0.35) ** 2));
  const cover = (lon: number, lat: number) => smoothstep(lat, topLine(lon) - 0.02, topLine(lon) + 0.06);
  const shell = (lon: number, lat: number) => {
    const c = cover(lon, lat);
    if (c <= 0) return 0;
    // Rounded like a cloud: thin at the edge (no shelf over the fade), fuller towards the top,
    // except over the forehead where the fringe is thick at once.
    const edge = topLine(lon);
    const round = Math.max(smoothstep(lat, edge, edge + 0.4), Math.exp(-((lon / 0.6) ** 2)));
    return c * (0.006 + round * (mass(lon, lat) + 0.016 * clumps(lon, lat)) + 0.01 * curls(lon, lat));
  };
  // The fringe juts forward and droops over the forehead instead of sticking to it.
  const extra = (lon: number, lat: number) => {
    const front = Math.exp(-((lon / 0.75) ** 2)) * smoothstep(lat, 0.2, 0.55) * (1 - smoothstep(lat, 0.85, 1.25));
    return V(0, -0.012, 0.03).multiplyScalar(front * cover(lon, lat));
  };
  return { topLine, shell, extra };
});

const broccoliCache = new Map<string, THREE.BufferGeometry>();

/**
 * The curls of the broccoli cut, as one geometry: a few hundred small corkscrews rooted in the mass
 * (standing out of it, tilted at random), longer ones hanging from the fringe over the forehead,
 * and some along the lower edge, pointing out and down. Cached per head shape (cloned: characters
 * dispose of their geometries).
 */
function broccoliCurls(params: HeadParams): THREE.BufferGeometry {
  const key = JSON.stringify(params);
  if (!broccoliCache.has(key)) {
    const { topLine, shell, extra } = broccoli();
    const random = seeded(31);
    const rand = (from: number, to: number) => from + random() * (to - from);
    /** Point of the outer surface of the mass, `depth` below it. */
    const at = (lon: number, lat: number, depth: number) => surface(lon, lat, Math.max(0, shell(lon, lat) - depth), params).add(extra(lon, lat));
    const coils: THREE.BufferGeometry[] = [];
    const coil = (from: THREE.Vector3, axis: THREE.Vector3, options: RingletOptions & { length: number }) => coils.push(ringlet(from, axis, options.length, { detail: 2, radial: 6, ...options }));

    // All over the mass, standing out of it: spread evenly, then jittered so no pattern shows.
    for (const spot of spiral(380, 0.1)) {
      const lon = spot.lon + rand(-0.06, 0.06);
      const lat = Math.min(Math.PI / 2, spot.lat + rand(-0.04, 0.04));
      if (lat < topLine(lon) + 0.06) continue;
      const n = surfaceNormal(lon, lat);
      const axis = n.clone().add(V(rand(-0.6, 0.6), rand(-0.6, 0.6), rand(-0.6, 0.6))).normalize();
      coil(at(lon, lat, 0.012), axis, {
        length: rand(0.016, 0.026), turns: rand(1, 1.6), radius: rand(0.008, 0.012), thickness: rand(0.0055, 0.0072),
      });
    }
    // Fringe: longer curls falling forward over the forehead, at uneven lengths.
    for (let i = 0; i < 15; i++) {
      const lon = -0.8 + (1.6 * (i + rand(0.2, 0.8))) / 15;
      const lat = topLine(lon) + rand(0.04, 0.12);
      const n = surfaceNormal(lon, lat);
      const axis = V(n.x * 0.5 + rand(-0.2, 0.2), -1, 0.35 + n.z * 0.3).normalize();
      coil(at(lon, lat, 0.01), axis, {
        length: rand(0.035, 0.06), turns: rand(1.4, 2.1), radius: rand(0.01, 0.013), thickness: rand(0.0065, 0.008),
      });
    }
    // Lower edge on the sides and back: curls pointing out and down over the fade.
    for (let i = 0; i < 34; i++) {
      const side = i % 2 ? 1 : -1;
      const lon = side * rand(0.85, Math.PI);
      const lat = topLine(lon) + rand(0.05, 0.12);
      const n = surfaceNormal(lon, lat);
      const axis = V(n.x, -0.7, n.z).normalize();
      coil(at(lon, lat, 0.01), axis, {
        length: rand(0.018, 0.028), turns: rand(1, 1.5), radius: rand(0.008, 0.011), thickness: rand(0.0055, 0.007),
      });
    }
    broccoliCache.set(key, mergeGeometries(coils));
  }
  return broccoliCache.get(key)!.clone();
}

/**
 * Braided rope, tiling along a lock: chevrons like the crossing strands of a braid (or the twists of
 * a loc), light grey multiplied with the hair colour.
 */
const braidTexture = once(() => {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#e8e8e8';
  ctx.fillRect(0, 0, 32, 32);
  ctx.lineCap = 'round';
  for (const [y, color, width] of [[10, '#6e6e6e', 6], [7, '#ffffff', 2.5]] as const) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    for (const dy of [-32, 0, 32]) {
      ctx.beginPath();
      ctx.moveTo(-2, y + dy);
      ctx.lineTo(16, y + dy + 12);
      ctx.lineTo(34, y + dy);
      ctx.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 11);
  texture.anisotropy = 4;
  return texture;
});

const locsCache = new Map<string, THREE.BufferGeometry>();

/** Hairline of locs and braids: a clean one, the hair pulled back from it. */
const locsLine = (lon: number) => hairline(lon, { forehead: 0.5 });

/**
 * Locs or braids: thick ropes rooted all over the scalp, pulled back and to the sides off the face,
 * hugging the head, then falling below the shoulders. Each rope swells and narrows along its length
 * (the twists of a loc, the crossings of a braid), which shows whatever the hair colour. Under a hat
 * they come out from under its edge. Cached per head shape (cloned: characters dispose of their
 * geometries).
 */
function locStrands(params: HeadParams, hatted: boolean): THREE.BufferGeometry {
  const key = `${JSON.stringify(params)}|${hatted}`;
  if (!locsCache.has(key)) {
    const random = seeded(41);
    const rand = (from: number, to: number) => from + random() * (to - from);
    const strands: THREE.BufferGeometry[] = [];
    // Under a hat, the roots are a ring just below its edge.
    const roots = hatted
      ? Array.from({ length: 30 }, (_, i) => ({ lon: -Math.PI + ((i + 0.5) / 30) * 2 * Math.PI, lat: 0.22 }))
      : spiral(48, 0.1);
    roots.forEach((root, i) => {
      if (root.lat < locsLine(root.lon) + 0.05 || (hatted && Math.abs(root.lon) < 1.0)) return;
      // Front roots sweep back to the side of the head, behind the temples; the others fall
      // straight down where they are.
      const side = Math.abs(root.lon) > 0.05 ? Math.sign(root.lon) : i % 2 ? 1 : -1;
      const lon1 = Math.abs(root.lon) < 1.25 ? side * rand(1.25, 1.55) : root.lon;
      const lat1 = rand(-0.42, -0.3);
      const points: THREE.Vector3[] = [];
      for (let k = 0; k <= 5; k++) {
        const f = k / 5;
        // Off the scalp a little more on the way down, clear of the ears.
        points.push(surface(lerp(root.lon, lon1, f ** 0.7), lerp(root.lat, lat1, f), lerp(0.018, 0.05, f), params));
      }
      const end = points.at(-1)!;
      const out = V(end.x, 0, end.z).normalize();
      const length = rand(0.16, 0.28);
      // A little sway, so the ropes don't hang like a curtain.
      const sway = () => V(rand(-0.012, 0.012), 0, rand(-0.012, 0.012));
      points.push(end.clone().addScaledVector(out, 0.012).add(V(0, -length * 0.5, 0)).add(sway()));
      points.push(end.clone().addScaledVector(out, 0.022).add(V(0, -length, 0)).add(sway()));
      const r0 = rand(0.015, 0.019);
      const curve = new THREE.CatmullRomCurve3(points);
      const beads = Math.round(curve.getLength() / 0.026);
      // Swelling twists (or braid crossings), and a rounded tip: the tube narrows only at the end.
      const radius = (t: number) => r0 * (0.82 + 0.3 * Math.abs(Math.sin(t * beads * Math.PI))) * (1 - 0.6 * smoothstep(t, 0.95, 1));
      strands.push(sweep(curve, radius, { segments: beads * 6, radial: 8 }));
    });
    locsCache.set(key, mergeGeometries(strands));
  }
  return locsCache.get(key)!.clone();
}

/**
 * Three-strand plait along `axis` (a curve): three round strands weaving around it, each one in
 * turn crossing over the middle, `width` wide (narrowing a little towards the end). `facing`: the
 * side the plait is seen from (its strands cross in front of the axis on that side).
 */
function plait(
  axis: THREE.Curve<THREE.Vector3>, width: number, facing: THREE.Vector3, { crossings = 6 }: { crossings?: number } = {},
): THREE.BufferGeometry {
  const steps = crossings * 12;
  const strands = [0, 1, 2].map((k) => {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const centre = axis.getPointAt(t);
      const along = axis.getTangentAt(t);
      const across = along.clone().cross(facing).normalize();
      const out = across.clone().cross(along).normalize();
      const w = width * (1 - 0.25 * t);
      const phase = 2 * Math.PI * (crossings * t + k / 3);
      points.push(centre.addScaledVector(across, 0.5 * w * Math.sin(phase)).addScaledVector(out, 0.22 * w * Math.sin(2 * phase)));
    }
    return sweep(new THREE.CatmullRomCurve3(points), (t) => width * 0.3 * (1 - 0.25 * t), { segments: steps, radial: 8 });
  });
  return mergeGeometries(strands);
}

/**
 * Plait hanging from the side of the head (`side` ±1) through `points` (head units, root first),
 * tied at the end, a short tuft below the tie.
 */
function hangingPlait(points: THREE.Vector3[], side: number, width: number): THREE.BufferGeometry[] {
  const axis = new THREE.CatmullRomCurve3(points);
  const end = axis.getPointAt(1);
  const down = axis.getTangentAt(1);
  // Seen from the outside and the front.
  const facing = V(side * 0.6, 0, 0.8).normalize();
  const tuft = lock([end.clone().addScaledVector(down, -0.006), end.clone().addScaledVector(down, 0.025),
    end.clone().addScaledVector(down, 0.05).add(V(side * 0.004, 0, 0))], width * 0.42, { tip: 0.004, flatten: 0.7 });
  return [plait(axis, width, facing), tie(end, down, width * 0.32), tuft];
}

// Each recipe (params, { hatted }) returns { shell?(lon, lat) → thickness, extra?(lon, lat) → displacement,
// locks: [geometries], top: [geometries a hat would cover or cross (dropped under one)], fade?: faded
// sides (see buildHair), stubble?: hairline of hair shaved very close (painted, see buildHair), shade?:
// the shell darker than the locks (shadows between curls, scalp between locs), lockMap?: texture of the
// locks }.
const STYLES: Record<string, (params: HeadParams, options: { hatted: boolean }) => HairRecipe> = {
  bald: () => ({ shell: () => 0 }),

  // Shaved very close: no volume, the hair only shows as a shade and tiny hairs on the scalp.
  shaved: () => ({ stubble: (lon) => hairline(lon, { forehead: 0.52, nape: -0.6 }) }),

  buzz: () => ({
    shell: capThickness((lon) => hairline(lon, { forehead: 0.55 }), 0.006, 0.006),
  }),

  short: () => ({
    shell: capThickness((lon) => hairline(lon, { fringe: { low: 0.26, depth: 0.2, period: 0.36, spread: 0.9 } })
      - 0.08 * teeth(lon, 0.4) * smoothstep(Math.abs(lon), 0.9, 1.2), 0.02, 0.035),
  }),

  // Short curls all over: a scalloped cloud, a few curls falling on the forehead.
  curly: (params) => {
    const line = (lon: number) => curlyFringe(lon, { high: 0.5, depth: 0.1, period: 0.3, spread: 0.85 })
      + Math.min(0, hairline(lon, { sides: -0.12, nape: -0.55 }) - 0.5);
    const base = capThickness(line, 0.025, 0.025, 0.08);
    const cloud = bumps(spiral(170, -0.6), 0.2, 0.05);
    return {
      shell: (lon, lat) => {
        const t = base(lon, lat);
        return t > 0 ? t + cloud(lon, lat) * smoothstep(t, 0, 0.02) : 0;
      },
      top: ringlets(params, [[-0.45, 0.5, 0.08, 1.75], [0.12, 0.52, 0.09, 2], [0.62, 0.48, 0.075, 1.5]], 0.04,
        { radius: 0.018, thickness: 0.014 }),
    };
  },

  // Curls (often a perm) on top, sides and back faded down to the skin: the "broccoli cut" of many
  // teenage boys today. Like the photos of the trend: a rounded mass of small corkscrew curls sticking
  // out every way (a fuzzy, curly outline), the heaviest part a fringe of curls falling forward over
  // the forehead down to the eyebrows; the fade goes from the skin above the ears and at the nape to
  // dark under the curls, its top line dropping behind the ears. The mass under the curls is darker:
  // the shadow between them.
  curlyFade: (params) => {
    const shape = broccoli();
    return {
      shell: shape.shell,
      extra: shape.extra,
      shade: -0.22,
      top: [broccoliCurls(params)],
      fade: { line: (lon) => hairline(lon, { forehead: 0.55, nape: -0.5 }), top: shape.topLine },
    };
  },

  // Shoulder-length curls: scalloped volume falling on the sides and back, ringlets at the ends.
  curlyLong: (params) => {
    const sides = (lon: number) => hairline(lon, { sides: -0.35, nape: -0.7 });
    const line = (lon: number) => curlyFringe(lon, { high: 0.5, depth: 0.1, period: 0.32, spread: 0.8 }) + Math.min(0, sides(lon) - 0.5);
    const base = capThickness(line, 0.03, 0.025, 0.08);
    const drop = fall(0.14, { from: 1.05 });
    const cloud = bumps(spiral(200, -1.2), 0.19, 0.05, 0.6);
    // Ringlets hanging from the lower edge of the hair, carried down by the fall like the shell.
    const ends: [number, number, number, number][] = [];
    for (const side of [-1, 1]) {
      for (const lon of [1.15, 1.45, 1.8, 2.15, 2.5, 2.85]) ends.push([side * lon, sides(lon) + 0.1, 0.16, 3]);
    }
    return {
      shell: (lon, lat) => {
        const t = base(lon, lat);
        return t > 0 ? t + cloud(lon, lat) * smoothstep(t, 0, 0.02) : 0;
      },
      extra: drop,
      top: ringlets(params, [[-0.42, 0.5, 0.08, 1.75], [0.35, 0.52, 0.085, 1.75]], 0.04, { radius: 0.018, thickness: 0.014 }),
      locks: ringlets(params, ends, 0.05, { radius: 0.022, thickness: 0.018 }).map((g, i) => {
        const shift = drop(ends[i][0], ends[i][1]);
        return g.translate(shift.x, shift.y, shift.z);
      }),
    };
  },

  // Locs or braids (one style for both): ropes from a tight scalp, falling below the shoulders.
  locs: (params, { hatted }) => ({
    shell: capThickness(locsLine, 0.012, 0.004),
    shade: -0.25,
    locks: [locStrands(params, hatted)],
    lockMap: braidTexture(),
  }),

  // Two plaits, from a middle parting, starting behind the ears and falling in front of the shoulders.
  braids: (params) => {
    // Pulled back over the top of the ears, down to the nape behind them.
    const line = (lon: number) => {
      const a = Math.abs(lon);
      if (a < 1.62) return lerp(0.48, 0.14, smoothstep(a, 0.2, 1.3));
      return lerp(0.14, -0.85, smoothstep(a, 1.62, 2.4));
    };
    const base = capThickness(line, 0.016, 0.01, 0.1);
    // The parting: the scalp shows in a thin line from the forehead, fading out before the top of
    // the head (a groove over the crown and down the back looks like a crack).
    const parting = (lon: number, lat: number) => {
      const line = smoothstep(lat, 0.15, 0.45) * (1 - smoothstep(lat, 0.8, 1.15));
      return 1 - Math.exp(-((lon / 0.035) ** 2)) * line;
    };
    // The hair is gathered low behind each ear, where the plait starts.
    const ROOT = [2.35, -0.48];
    const roots = [-1, 1].map((side) => direction(side * ROOT[0], ROOT[1]));
    const gathered = (lon: number, lat: number) => {
      const d = direction(lon, lat);
      return 0.025 * Math.max(...roots.map((r) => Math.exp(-((1 - d.dot(r)) / 0.025))));
    };
    // Down behind the neck, over the shoulders, then on the chest.
    const plaits = [-1, 1].flatMap((side) => hangingPlait([
      surface(side * ROOT[0], ROOT[1], 0.03, params),
      V(side * 0.115, -0.19, -0.075),
      V(side * 0.115, -0.24, 0.0),
      V(side * 0.1, -0.29, 0.08),
      V(side * 0.09, -0.37, 0.095),
    ], side, 0.058));
    return {
      shell: (lon, lat) => {
        const t = base(lon, lat);
        return t > 0 ? (t + gathered(lon, lat)) * parting(lon, lat) : 0;
      },
      locks: plaits,
    };
  },

  // Short women's cut: side-swept fringe, tapered sides and nape, ears showing.
  pixie: () => {
    // Deep side parting: the fringe sweeps diagonally across the forehead, low over one eyebrow.
    const sweep = (lon: number) => 0.24 * smoothstep(lon, -0.7, 0.8);
    return {
      shell: capThickness((lon) => hairline(lon, {
        forehead: 0.5, nape: -0.55, fringe: { low: 0.44 - sweep(lon), depth: 0.035, period: 0.16, spread: 0.95 },
      }), 0.022, 0.032),
      // Volume on the parted side, lying flat on the other. Measured across the head (x), not by
      // longitude, which jumps from -π to π at the back and would split the hair there.
      extra: (lon, lat, d) => V(0.012, 0.01, 0.006).multiplyScalar(smoothstep(lat, 0.2, 0.8) * smoothstep(d.x, -0.35, 0.55)),
    };
  },

  bob: () => ({
    shell: capThickness((lon) => hairline(lon, {
      sides: -0.5, nape: -0.72, fringe: { low: 0.24, depth: 0.05, period: 0.2, spread: 1.0 },
    }), 0.03, 0.02),
    extra: fall(0.06),
  }),

  // Shoulder-length layers with a soft wave, the most common women's cut.
  medium: () => {
    const drop = fall(0.16, { from: 1.05 });
    return {
      shell: capThickness((lon) => hairline(lon, {
        sides: -0.4, nape: -0.7, fringe: { low: 0.36, depth: 0.1, period: 0.3, spread: 0.6 },
      }), 0.03, 0.022),
      extra: (lon, lat) => {
        const n = surfaceNormal(lon, lat);
        const wave = Math.sin(lat * 12) * smoothstep(-lat, -0.1, 0.6) * smoothstep(Math.abs(lon), 1.0, 1.35);
        return drop(lon, lat).add(V(n.x, 0, n.z).normalize().multiplyScalar(0.01 * wave));
      },
    };
  },

  long: () => ({
    shell: capThickness((lon) => hairline(lon, {
      sides: -0.45, nape: -0.7, fringe: { low: 0.32, depth: 0.14, period: 0.28, spread: 0.7 },
    }), 0.028, 0.02),
    extra: fall(0.24),
  }),

  // Ponytail tied high at the back: a full tail, gathered at the tie, rounded out, then falling down
  // the back and ending in a few soft strands (not a single point).
  ponytail: (params) => {
    const root = surface(Math.PI, 0.55, 0.02, params);
    const axis = new THREE.CatmullRomCurve3([root.clone().add(V(0, 0, 0.01)), root.clone().add(V(0, 0.005, -0.05)),
      root.clone().add(V(0, -0.07, -0.095)), root.clone().add(V(0, -0.2, -0.09)), root.clone().add(V(0, -0.31, -0.065))]);
    // Narrow at the tie, full below it, slimmer lower down, closing round.
    const radius = (t: number) => (0.024 + 0.034 * Math.sin(Math.PI * Math.min(1, t / 0.85) ** 0.6))
      * Math.sqrt(1 - smoothstep(t, 0.88, 1) ** 2);
    const tail = sweep(axis, radius, { segments: 40, radial: 14, flatten: 0.85 });
    const end = axis.getPointAt(1);
    const down = axis.getTangentAt(1);
    const strands = [-1, 0, 1].map((k) => {
      const from = axis.getPointAt(0.8).add(V(k * 0.013, 0, 0));
      return lock([from, end.clone().add(V(k * 0.016, 0.004 * Math.abs(k), 0)),
        end.clone().addScaledVector(down, 0.035 - 0.01 * Math.abs(k)).add(V(k * 0.022, 0, 0.004))], 0.019, { tip: 0.006, flatten: 0.75 });
    });
    return {
      shell: capThickness((lon) => hairline(lon, { fringe: { low: 0.4, depth: 0.1, period: 0.3, spread: 0.5 } }), 0.012, 0.006),
      locks: [tie(root.clone().add(V(0, 0, -0.012)), surfaceNormal(Math.PI, 0.55), 0.032), tail, ...strands],
    };
  },

  bun: (params) => {
    const n = surfaceNormal(Math.PI * 0.92, 1.05);
    const centre = surface(Math.PI * 0.92, 1.05, 0.07, params);
    const bun = new THREE.SphereGeometry(0.075, 18, 14);
    bun.scale(1, 0.85, 1);
    bun.translate(centre.x, centre.y, centre.z);
    const swirl = new THREE.TorusGeometry(0.05, 0.022, 8, 20);
    swirl.lookAt(n);
    swirl.translate(centre.x + n.x * 0.04, centre.y + n.y * 0.04, centre.z + n.z * 0.04);
    return {
      shell: capThickness((lon) => hairline(lon), 0.012, 0.006),
      top: [bun, swirl],
    };
  },
};

/**
 * Hair of `style` around a head of shape `params` (see head.ts). `hatted`: a hat covers the crown,
 * so the shell stays flat on top and the `top` parts are dropped. `skin`: for faded sides.
 */
export function buildHair(
  style: string, { color, skin, params, hatted = false }: { color: string; skin: string; params: HeadParams; hatted?: boolean },
): THREE.Group {
  const recipe = (STYLES[style] ?? STYLES.short)(params, { hatted });
  const group = new THREE.Group();
  if (style === 'bald') return group;
  const thickness = hatted
    ? (lon: number, lat: number) => (lat > 0.25 ? Math.min(recipe.shell!(lon, lat), 0.006) : recipe.shell!(lon, lat)) : recipe.shell;
  const material = cel(color, { rim: 0.22 });
  const shellMaterial = recipe.shade ? cel(shadeHex(color, recipe.shade), { rim: 0.22 }) : material;
  if (recipe.shell) {
    const shell = shellGeometry(params, thickness!, {
      extra: recipe.extra, segments: { lonSegments: 200, latSegments: 120 },
    });
    group.add(celMesh(shell, shellMaterial, { outline: 0.004 }));
  }

  if (recipe.stubble) {
    // A skin-tight layer lit exactly like the head (as the faded sides below), painted.
    const line = recipe.stubble;
    const layer = shellGeometry(params, capThickness(line, 0.002, 0, 0.3), {
      uv: (lon, lat) => [(lon + Math.PI) / (2 * Math.PI), (lat + Math.PI / 2) / Math.PI],
      segments: { lonSegments: 120, latSegments: 72 },
      skinNormals: true,
    });
    group.add(celMesh(layer, cel('#ffffff', { map: stubbleTexture(skin, color, line), rim: 0.2, softness: 0.12 }), { outline: 0 }));
  }

  if (recipe.fade) {
    // Shaved sides: a skin-tight layer from the hairline up under the curly top, darker upwards.
    const { line, top } = recipe.fade;
    // Thin and rising slowly from the hairline (no crease where it starts), on the same grid as the
    // head so the two surfaces never cross (no flickering stairs at the nape).
    const fade = shellGeometry(params, capThickness(line, 0.003, 0.003, 0.3), {
      uv: (lon, lat) => [0.5, smoothstep(lat, line(lon), top(lon))],
      segments: { lonSegments: 72, latSegments: 48 },
      skinNormals: true,
    });
    // Same soft shading as the head, so the bottom of the fade melts into the skin.
    group.add(celMesh(fade, cel('#ffffff', { map: fadeTexture(skin, color), rim: 0.2, softness: 0.12 }), { outline: 0 }));
  }

  const parts = [...(recipe.locks ?? []), ...(hatted ? [] : recipe.top ?? [])];
  const lockMaterial = recipe.lockMap ? cel(color, { rim: 0.22, map: recipe.lockMap }) : material;
  if (parts.length) group.add(celMesh(mergeGeometries(parts), lockMaterial, { outline: 0.003 }));
  return group;
}
