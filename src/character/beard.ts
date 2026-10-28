import * as THREE from 'three';
import { cel, celMesh } from '../render/celMaterial.ts';
import { shadeHex } from '../render/materials.ts';
import { FEATURES, shellGeometry } from './head.ts';
import type { HeadParams } from './head.ts';

// Beard and moustache are one layer of hair over the jaw and the upper lip (a shell, see head.ts),
// painted with fine strands: dense in the middle, thinning out into single hairs at the edges, so it
// reads as hair rather than a mask. Stubble is only painted on the face (FaceTexture), which also
// gets a light shadow under the other beards.

const { smoothstep, lerp } = THREE.MathUtils;

// Beard texture: canvas over this longitude / latitude window.
const LON = 1.7;
const LAT_MIN = -1.6;
const LAT_MAX = 0.2;
const TEX_W = 1024;
const TEX_H = Math.round((TEX_W * (LAT_MAX - LAT_MIN)) / (2 * LON));

/** Cheap deterministic noise in [-1, 1]: ragged outlines that don't look regular. */
function noise(lon: number, lat: number): number {
  return 0.5 * Math.sin(lon * 41.3 + Math.sin(lat * 17.1) * 2) + 0.5 * Math.sin(lat * 37.7 - lon * 13.9 + 1.3);
}

/** Piecewise smooth curve through [x, y] points (x increasing). */
function curve(points: [number, number][], x: number): number {
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    if (x <= x1) return lerp(y0, y1, smoothstep(x, x0, x1));
  }
  return points.at(-1)![1];
}

// Upper edge of the beard, from the chin (lon 0) to the sideburns in front of the ears: low on the
// cheeks, from the corners of the mouth up to the sideburns, like a trimmed beard.
const CHEEK_LINE: [number, number][] = [[0, -0.55], [0.35, -0.56], [0.6, -0.52], [0.85, -0.4], [1.1, -0.22], [1.35, -0.02], [1.45, 0.08]];

/**
 * How much beard grows at (lon, lat), 0–1. `grow` pushes the edges outwards (the shell is a little
 * larger than the painted hair, so the stray hairs at the edge have something to sit on).
 */
function beardDensity(style: string, lon: number, lat: number, grow = 0): number {
  if (style === 'none' || style === 'stubble') return 0;
  const a = Math.abs(lon);
  // The lips stay visible.
  const mouth = smoothstep((lon / 0.21) ** 2 + ((lat - FEATURES.mouthLat + 0.01) / 0.075) ** 2, 0.8, 1.4);
  if (style === 'goatee') {
    // Round the mouth (down from the ends of the moustache) and over the chin, the cheeks shaved.
    const top = FEATURES.mouthLat + 0.03 + grow;
    const width = 0.3 - 0.03 * smoothstep(-lat, 0.5, 0.8) - 0.12 * smoothstep(-lat, 0.85, 1.05) + 0.02 * noise(lon, lat) + grow;
    return smoothstep(top - lat, -0.01, 0.04) * smoothstep(width - a, 0, 0.05) * smoothstep(lat + 1.05 + grow, 0, 0.1) * mouth;
  }
  const edge = curve(CHEEK_LINE, a) + 0.03 * noise(lon, lat) + grow;
  // Thinning out over a band on the cheeks rather than stopping at a line.
  const below = smoothstep(edge - lat, -0.02, 0.16);
  // Back edge: down from the sideburn in front of the ear, then forward along the angle of the jaw
  // (the nape side of the neck stays bare).
  const back = lerp(1.52, 0.95, smoothstep(-lat, 0.45, 1.15)) + 0.02 * noise(lat, lon) + grow;
  // Under the jaw it stops before the neck (and the pole of the shell, where every longitude meets).
  const throat = smoothstep(lat + 1.3 + grow, 0, 0.12);
  return below * smoothstep(back - a, 0, 0.1) * throat * mouth;
}

/** Thick moustache over the upper lip, its ends drooping to the corners of the mouth. */
function mustacheDensity(style: string, lon: number, lat: number, grow = 0): number {
  if (style === 'none') return 0;
  const a = Math.abs(lon);
  const m = FEATURES.mouthLat;
  // From under the nose down over the upper lip.
  const top = m + 0.16 - 0.07 * smoothstep(a, 0.08, 0.3) + 0.012 * noise(lon, lat) + grow;
  const bottom = m + 0.005 - 0.06 * smoothstep(a, 0.14, 0.3) - grow;
  const width = 0.33 + grow;
  return smoothstep(lat - bottom, 0, 0.02) * smoothstep(top - lat, 0, 0.035) * smoothstep(width - a, 0, 0.05);
}

/** A goatee always comes with its moustache. */
const withMustache = (beard: string, mustache: string) => (beard === 'goatee' ? 'thick' : mustache);

/** Facial hair density (beard and moustache together), for the shell and the painted shadow. */
export function facialHairDensity(beard: string, mustache: string, lon: number, lat: number, grow = 0): number {
  mustache = withMustache(beard, mustache);
  return Math.max(beardDensity(beard, lon, lat, grow), mustacheDensity(mustache, lon, lat, grow));
}

/** Canvas pixel for a longitude / latitude of the beard texture. */
const toPixel = (lon: number, lat: number): [number, number] => [((lon + LON) / (2 * LON)) * TEX_W, ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * TEX_H];

function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const textures = new Map<string, THREE.CanvasTexture>();

/** Strand texture of a beard + moustache (cached: thumbnails rebuild characters all the time). */
function hairTexture(beard: string, mustache: string, color: string): THREE.CanvasTexture {
  const key = `${beard}|${mustache}|${color}`;
  if (textures.has(key)) return textures.get(key)!;

  const canvas = document.createElement('canvas');
  canvas.width = TEX_W;
  canvas.height = TEX_H;
  const ctx = canvas.getContext('2d')!;

  // Dense hair: solid where the beard is thick, fading out before the edges.
  const image = ctx.createImageData(TEX_W, TEX_H);
  const base = new THREE.Color(color);
  for (let y = 0; y < TEX_H; y++) {
    const lat = LAT_MAX - (y / TEX_H) * (LAT_MAX - LAT_MIN);
    for (let x = 0; x < TEX_W; x++) {
      const lon = (x / TEX_W) * 2 * LON - LON;
      const d = facialHairDensity(beard, mustache, lon, lat);
      if (d <= 0.4) continue;
      const shade = 0.92 + 0.08 * noise(lon * 0.6, lat * 0.6);
      const i = (y * TEX_W + x) * 4;
      image.data[i] = base.r * 255 * shade;
      image.data[i + 1] = base.g * 255 * shade;
      image.data[i + 2] = base.b * 255 * shade;
      image.data[i + 3] = 255 * smoothstep(d, 0.35, 0.85);
    }
  }
  ctx.putImageData(image, 0, 0);

  // Strands on top, flowing down (beard) or out from the middle (moustache). Fewer where the beard
  // thins out, so the edge is made of single hairs.
  const random = seeded(11);
  const shades = [-0.3, -0.18, -0.08, 0.06, 0.16];
  ctx.lineCap = 'round';
  for (let i = 0; i < 14000; i++) {
    const lon = (random() * 2 - 1) * LON;
    const lat = LAT_MIN + random() * (LAT_MAX - LAT_MIN);
    const b = beardDensity(beard, lon, lat);
    const m = mustacheDensity(mustache, lon, lat);
    const d = Math.max(b, m);
    if (d <= 0.02 || random() > d * 1.3) continue;
    const side = Math.sign(lon) || 1;
    const out = m > b ? side * 1.4 : side * 0.3 * smoothstep(Math.abs(lon), 0.1, 1.0);
    const length = (m > b ? 7 : 9) + random() * 8;
    const dx = (out / Math.hypot(out, 1)) * length;
    const dy = length / Math.hypot(out, 1);
    const [x, y] = toPixel(lon, lat);
    ctx.strokeStyle = shadeHex(color, shades[Math.floor(random() * shades.length)]);
    ctx.lineWidth = 1.4 + random() * 1.4;
    ctx.globalAlpha = 0.65 + random() * 0.35;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + dx * 0.5, y + dy * 0.5, x + dx, y + dy * 1.1);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  textures.set(key, texture);
  return texture;
}

/**
 * Volume of the beard: the chin and the underside of the jaw pushed down and a little forward, into
 * a rounded mass between a short and a long beard (none on the cheeks, which stay close-cropped).
 */
function beardVolume(lon: number, lat: number, b: number): THREE.Vector3 {
  // The front of the chin only: the throat behind it stays where it is (no hook under the jaw).
  const front = Math.cos(lon) * Math.cos(lat);
  const chin = b * Math.exp(-((lon / 0.55) ** 2)) * smoothstep(-lat, 0.6, 1.0) * smoothstep(front, 0.15, 0.5);
  return new THREE.Vector3(0, -0.045 * chin, 0.03 * chin);
}

/**
 * Beard and moustache as one mesh, or null (no facial hair, or stubble only: painted).
 * `beard`: 'none' | 'stubble' | 'goatee' (with its moustache) | 'short'; `mustache`: 'none' | 'thick'.
 */
export function buildFacialHair(
  beard: string, moustache: string, { color, params }: { color: string; params: HeadParams },
): THREE.Mesh | null {
  const mustache = withMustache(beard, moustache);
  if ((beard === 'none' || beard === 'stubble') && mustache === 'none') return null;
  const thickness = (lon: number, lat: number) => {
    const b = beardDensity(beard, lon, lat, 0.04);
    const m = mustacheDensity(mustache, lon, lat, 0.03);
    if (Math.max(b, m) < 0.02) return 0;
    // Thin on the cheeks, thicker along the jaw and under the chin; moustaches bulge in the middle
    // of the lip.
    const beardDepth = b * lerp(0.004, beard === 'short' ? 0.024 : 0.018, smoothstep(-lat, 0.45, 1.1));
    return 0.0015 + Math.max(beardDepth, m * 0.012);
  };
  const geometry = shellGeometry(params, thickness, {
    extra: beard === 'short' ? (lon, lat) => beardVolume(lon, lat, beardDensity(beard, lon, lat, 0.04)) : null,
    uv: (lon, lat) => [(lon + LON) / (2 * LON), (lat - LAT_MIN) / (LAT_MAX - LAT_MIN)],
    segments: { lonSegments: 160, latSegments: 110 },
  });
  // No rim light: it lit the thin stray hairs at the edges up in white.
  const material = cel('#ffffff', { map: hairTexture(beard, mustache, color), rim: 0, softness: 0.1, transparent: true });
  // No ink outline: it made beards look like masks.
  const mesh = celMesh(geometry, material, { outline: 0 });
  mesh.castShadow = false;
  return mesh;
}
