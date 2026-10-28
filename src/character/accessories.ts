import * as THREE from 'three';
import { cel, celMesh } from '../render/celMaterial.ts';
import type { CelMeshOptions } from '../render/celMaterial.ts';
import { smoothSeams, sweep } from './shapes.ts';
import { shadeHex } from '../render/materials.ts';
import { HEAD, FEATURES, surface, surfaceNormal, shellGeometry } from './head.ts';
import type { HeadParams } from './head.ts';
import { CLEAR_FRAME } from './options.ts';

// Headwear is modelled around a unit sphere, then stretched to the head ellipsoid (+ room for the
// hair). Glasses sit on the face surface, over the painted eyes.

const FRAME = '#2b2d42';

function part(geometry: THREE.BufferGeometry, color: string, options?: CelMeshOptions) {
  return celMesh(geometry, cel(color, { rim: 0.4 }), { outline: 0.012, ...options });
}

function star(outer: number, inner = outer * 0.5): THREE.Shape {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? inner : outer;
    (i ? shape.lineTo : shape.moveTo).call(shape, Math.cos(a) * r, Math.sin(a) * r);
  }
  return shape;
}

function cap(color: string): THREE.Group {
  const group = new THREE.Group();
  const dome = part(new THREE.SphereGeometry(1, 40, 16, 0, Math.PI * 2, 0, Math.PI * 0.45), color);
  // No rim light: seen at a grazing angle, it washed the visor out to grey.
  const visor = celMesh(new THREE.CylinderGeometry(0.95, 0.95, 0.08, 32, 1, false, -Math.PI / 2, Math.PI),
    cel(shadeHex(color, -0.15), { rim: 0 }), { outline: 0.012 });
  visor.position.set(0, 0.2, 0.8);
  visor.rotation.x = 0.16;
  const button = part(new THREE.SphereGeometry(0.1, 12, 8), color);
  button.position.y = 1;
  // Logo on the front panel: a star in a light contrasting colour.
  const logo = celMesh(new THREE.ShapeGeometry(star(0.22)), cel(shadeHex(color, 0.75), { rim: 0 }), { outline: 0 });
  const front = new THREE.Vector3(0, Math.sin(0.62), Math.cos(0.62));
  logo.position.copy(front).multiplyScalar(1.005);
  logo.lookAt(front.clone().multiplyScalar(2));
  group.add(dome, visor, button, logo);
  return group;
}

function beanie(color: string): THREE.Group {
  const group = new THREE.Group();
  const dome = part(new THREE.SphereGeometry(1, 40, 16, 0, Math.PI * 2, 0, Math.PI * 0.48), color);
  dome.scale.y = 1.1;
  const cuff = part(new THREE.CylinderGeometry(1.02, 1.05, 0.3, 40, 1, true), shadeHex(color, -0.12), { outline: 0 });
  cuff.material.side = THREE.DoubleSide;
  cuff.position.y = 0.12;
  const pompom = part(new THREE.SphereGeometry(0.24, 16, 12), shadeHex(color, 0.45));
  pompom.position.y = 1.18;
  group.add(dome, cuff, pompom);
  group.rotation.x = -0.15;
  return group;
}

const { smoothstep } = THREE.MathUtils;

/**
 * How far (lon, lat) is outside the face opening of the scarf: < 0 inside, 0 on its edge. An oval
 * from mid-forehead to just under the chin, rising to a soft point on the forehead; `top`: its top.
 */
function faceOpening(lon: number, lat: number, top = 0.42): number {
  const centre = -0.3;
  const up = lat > centre;
  const y = (lat - centre) / (up ? top - centre : 0.92);
  // Sides narrowing straighter towards the top: the arch of a scarf pinned on the forehead.
  const p = up ? THREE.MathUtils.lerp(2, 1.5, smoothstep(y, 0, 1)) : 2.4;
  return (Math.abs(lon / 1.06) ** p + Math.abs(y) ** 2) ** (1 / 2) - 1;
}

/** Depth of the drape in front at height `y`, for its half-width 1: tucked under the chin, then over the chest. */
const drapeFront = (y: number) => THREE.MathUtils.lerp(0.62, 0.84, smoothstep(-y, 0.16, 0.3));

/**
 * Drape of the scarf, from under the head to the top of the chest: a bell around the neck, flaring
 * over the shoulders, its hem lower at the front and back than on the shoulders, gently waved.
 * Profile [half-width, y] from top to bottom (head units, head centre at 0); the torso is shallower
 * than wide, so is the drape.
 */
function drapeGeometry(profile: [number, number][] = [[0.15, -0.05], [0.13, -0.12], [0.134, -0.19], [0.158, -0.25], [0.188, -0.3], [0.205, -0.34]]) {
  const curve = new THREE.SplineCurve(profile.map(([r, y]) => new THREE.Vector2(r, y)));
  const rows = 24;
  const columns = 64;
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= rows; i++) {
    const v = i / rows;
    const { x: r, y } = curve.getPoint(v);
    for (let j = 0; j <= columns; j++) {
      const a = (j / columns) * Math.PI * 2;
      const depth = THREE.MathUtils.lerp(THREE.MathUtils.lerp(1, 0.84, v), drapeFront(y), smoothstep(Math.cos(a), -0.3, 0.3));
      const hem = (-0.03 * Math.cos(a) ** 2 + 0.006 * Math.sin(a * 7)) * v * v;
      // Soft vertical folds, deeper towards the hem.
      const fold = 1 + 0.025 * Math.sin(a * 9) * v;
      // At the back it hangs straight from the back of the head instead of hugging the neck.
      const hang = 0.045 * Math.max(0, -Math.cos(a)) ** 2 * smoothstep(v, 0.1, 0.35) * (1 - smoothstep(v, 0.55, 1));
      positions.push(Math.sin(a) * r * fold, y + hem, Math.cos(a) * (r * depth * fold + hang) - 0.01);
    }
  }
  const row = columns + 1;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < columns; j++) {
      const a = i * row + j;
      indices.push(a, a + row, a + 1, a + row, a + row + 1, a + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return smoothSeams(geometry);
}

/**
 * Fold of the scarf wrapped round the neck, under the chin: a soft, flat roll half sunk in the drape,
 * from `from` to `to` (angles round the neck, 0 = front), at height `y` behind the neck, `drop`
 * lower in front and `tilt` lower on the right than on the left (wrapped across), its ends tucked in.
 */
interface NeckFold {
  from: number;
  to: number;
  y: number;
  drop: number;
  tilt: number;
  radius: number;
}

function neckFold({ from, to, y, drop, tilt, radius }: NeckFold): THREE.BufferGeometry {
  const points: THREE.Vector3[] = [];
  for (let k = 0; k <= 16; k++) {
    const a = from + ((to - from) * k) / 16;
    const h = y - drop * (0.5 + 0.5 * Math.cos(a)) - tilt * Math.sin(a);
    // On the drape at that height (see drapeGeometry), the ends sinking into it.
    const r = THREE.MathUtils.lerp(0.134, 0.158, smoothstep(-h, 0.19, 0.25)) - radius * (1 - Math.sin((Math.PI * k) / 16));
    const depth = THREE.MathUtils.lerp(0.95, drapeFront(h), smoothstep(Math.cos(a), -0.3, 0.3));
    points.push(new THREE.Vector3(Math.sin(a) * r, h, Math.cos(a) * r * depth - 0.01));
  }
  return sweep(new THREE.CatmullRomCurve3(points), (t) => radius * Math.sin(Math.PI * t) ** 0.8,
    { segments: 48, radial: 10, flatten: 0.5 });
}

/**
 * Scarf (hijab), as most people wear it: pinned round the face from mid-forehead to under the chin
 * (a rolled hem along the edge, a darker underscarf showing on the forehead), smooth over the head
 * with a little volume at the back, wrapped once or twice round the neck, then draped over the
 * shoulders and the top of the chest.
 */
function headscarf(color: string, params: HeadParams): THREE.Group {
  const group = new THREE.Group();
  const material = cel(color, { rim: 0.25, softness: 0.08 });

  // Underscarf: a thin band showing between the forehead and the scarf.
  const under = shellGeometry(params, (lon, lat) => 0.01 * smoothstep(faceOpening(lon, lat, 0.35), 0, 0.05),
    { segments: { lonSegments: 240, latSegments: 160 } });
  group.add(celMesh(under, cel(shadeHex(color, -0.35), { rim: 0.15, softness: 0.08 }), { outline: 0.003 }));

  const thickness = (lon: number, lat: number) => {
    const e = faceOpening(lon, lat);
    if (e <= 0) return 0;
    const back = Math.exp(-(((Math.abs(lon) - Math.PI) / 0.9) ** 2) - ((lat - 0.25) / 0.5) ** 2);
    // Full thickness right at the edge (a clean hem), the hem rolled a little thicker.
    return smoothstep(e, 0, 0.06) * (0.026 + 0.005 * Math.exp(-(((e - 0.07) / 0.05) ** 2)) + 0.022 * back);
  };
  // Over the forehead the edge stands off a little, as the fabric arches from one temple to the other.
  const extra = (lon: number, lat: number) => new THREE.Vector3(0, 0.003, 0.008)
    .multiplyScalar(Math.exp(-((lon / 0.6) ** 2)) * smoothstep(lat, 0.15, 0.4) * (1 - smoothstep(lat, 0.7, 1.1)));
  const hood = shellGeometry(params, thickness, { extra, segments: { lonSegments: 240, latSegments: 160 } });
  group.add(celMesh(hood, material, { outline: 0.004 }));

  group.add(celMesh(drapeGeometry(), material, { outline: 0.004 }));
  for (const fold of [
    { from: -2.3, to: 2.1, y: -0.175, drop: 0.04, tilt: 0.012, radius: 0.022 },
    { from: -1.6, to: 2.4, y: -0.222, drop: 0.035, tilt: -0.014, radius: 0.02 },
  ]) {
    group.add(celMesh(neckFold(fold), material, { outline: 0.003 }));
  }
  return group;
}

/** Headwear that hides all the hair (no hair is built under it). */
export function hidesHair(type: string): boolean {
  return type === 'headscarf';
}

/**
 * `volume`: how far the hair rises above the skull (HAIR_VOLUME), so hats sit on it.
 * `params`: head shape, for the headwear that wraps it (scarf).
 */
export function buildHeadwear(
  type: string, { color, volume = 0.03, params }: { color: string; volume?: number; params: HeadParams },
): THREE.Group | null {
  if (type === 'headscarf') return headscarf(color, params);
  const group = ({ cap, beanie } as Record<string, (color: string) => THREE.Group>)[type]?.(color);
  if (!group) return null;
  // Hats squash the hair: only part of its volume counts.
  const room = 0.01 + Math.min(volume, 0.04) * 0.6;
  const holder = new THREE.Group();
  holder.scale.set(HEAD.rx + room, HEAD.ry + room, HEAD.rz + room);
  holder.position.y = HEAD.ry * 0.12;
  holder.add(group);
  return holder;
}

/** Hats hide the top of the hair. */
export function coversHair(type: string): boolean {
  return type === 'cap' || type === 'beanie';
}

// ---------------------------------------------------------------- glasses

// Frame shapes, in lens units (≈ the eye's half-width): superellipse half-width `a`, half-height `b`
// and squareness `n` (2 = ellipse), rim width, and a few typical tweaks.
/** A frame shape (see FRAMES). */
interface FrameSpec {
  a: number;
  b: number;
  n: number;
  rim: number;
  flare?: number;
  wing?: number;
  brow?: number;
}

const FRAMES: Record<string, FrameSpec> = {
  round: { a: 1, b: 1, n: 2, rim: 0.14 },
  square: { a: 1.25, b: 0.74, n: 6, rim: 0.09 }, // thin rectangles
  bold: { a: 1.2, b: 0.95, n: 4, rim: 0.28, flare: 0.2 }, // thick acetate, wider at the top
  catEye: { a: 1.15, b: 0.82, n: 2.6, rim: 0.2, wing: 0.55 }, // outer top corners swept up
  browline: { a: 1.18, b: 0.86, n: 4, rim: 0.07, brow: 0.3 }, // thick top bar over a thin metal rim
};
const METAL_RIM = '#b8bec6';
// Clear plastic: see-through, only its edges and highlights show. No ink outline (an opaque hull
// behind it would make it look solid): a thin darker line along each edge instead.
const CLEAR_OPACITY = 0.38;
const CLEAR_EDGE = '#9fb1b8';

/** Material of the frame: the colour, or see-through plastic. */
function frameMaterial(color: string, rim: number): THREE.ShaderMaterial {
  return color === CLEAR_FRAME ? cel(color, { rim: 0.9, transparent: true, opacity: CLEAR_OPACITY }) : cel(color, { rim });
}

/** Edge line of a clear frame along an outline (lens units), at depth `z`. */
function clearEdge(points: THREE.Vector2[], z: number, closed = true): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p.x, p.y, z)), closed);
  const material = new THREE.MeshBasicMaterial({ color: CLEAR_EDGE, transparent: true, opacity: 0.85 });
  return new THREE.Mesh(new THREE.TubeGeometry(curve, points.length * 2, 0.022, 5, closed), material);
}

/** Point of a lens outline (inner edge of the frame) at angle `t`, for side ±1 (+x towards the temple). */
function lensPoint(spec: FrameSpec, side: number, t: number): THREE.Vector2 {
  const c = Math.cos(t);
  const s = Math.sin(t);
  let x = spec.a * Math.sign(c) * Math.abs(c) ** (2 / spec.n);
  let y = spec.b * Math.sign(s) * Math.abs(s) ** (2 / spec.n);
  if (spec.flare) x *= 1 + spec.flare * y;
  if (spec.wing && x > 0) {
    // Outer corner pulled up and out into a point, the bottom tapering towards the nose.
    const corner = THREE.MathUtils.smoothstep(x / spec.a, 0.3, 1) * Math.max(0, y / spec.b + 0.4);
    y += spec.wing * corner;
    x += spec.wing * 0.45 * corner;
  }
  return new THREE.Vector2(x * side, y);
}

/** `steps` points of the outline from angle `from` to `to` (whole lens by default). */
function lensOutline(
  spec: FrameSpec, side: number, { steps = 48, from = 0, to = Math.PI * 2 }: { steps?: number; from?: number; to?: number } = {},
): THREE.Vector2[] {
  const closed = to - from >= Math.PI * 2;
  const count = closed ? steps : steps + 1;
  return Array.from({ length: count }, (_, i) => lensPoint(spec, side, from + ((to - from) * i) / steps));
}

/** The outline pushed outwards by `width(point)`: outer edge of a rim. `closed`: whole lens, not an arc. */
function offsetOutline(points: THREE.Vector2[], width: (p: THREE.Vector2) => number, closed = true): THREE.Vector2[] {
  const n = points.length;
  return points.map((p, i) => {
    const prev = points[closed ? (i + n - 1) % n : Math.max(0, i - 1)];
    const next = points[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    const tangent = next.clone().sub(prev).normalize();
    let normal = new THREE.Vector2(tangent.y, -tangent.x);
    if (normal.dot(p) < 0) normal = normal.negate();
    return p.clone().addScaledVector(normal, width(p));
  });
}

/** Flat ring between two outlines, given a little depth. */
function ringGeometry(outer: THREE.Vector2[], inner: THREE.Vector2[], depth: number): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape(outer);
  shape.holes.push(new THREE.Path(inner));
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 1 });
}

function lens(type: string, size: number, color: string, side: number): THREE.Group {
  const spec = FRAMES[type] ?? FRAMES.round;
  const group = new THREE.Group();
  const inner = lensOutline(spec, side);
  const depth = 0.16;
  const clear = color === CLEAR_FRAME;
  // Outline thickness is in lens units here (the group is scaled to the lens size).
  const outline = clear ? 0 : 0.035;
  const outer = offsetOutline(inner, () => spec.rim);
  const rimColor = spec.brow ? METAL_RIM : color;
  group.add(celMesh(ringGeometry(outer, inner, depth), frameMaterial(rimColor, 0.2), { outline }));
  if (clear && !spec.brow) group.add(clearEdge(outer, depth), clearEdge(inner, depth));
  if (spec.brow) {
    // Upper half of the rim, thick, in the frame colour.
    const arc = lensOutline(spec, side, { steps: 24, from: -0.15, to: Math.PI + 0.15 });
    const bar = offsetOutline(arc, (p) => spec.rim + (spec.brow! - spec.rim) * THREE.MathUtils.smoothstep(p.y, 0, spec.b * 0.6), false);
    const geometry = new THREE.ExtrudeGeometry(new THREE.Shape([...bar, ...[...arc].reverse()]),
      { depth: depth * 1.3, bevelEnabled: false, curveSegments: 1 });
    group.add(celMesh(geometry, frameMaterial(color, 0.2), { outline }));
    if (clear) group.add(clearEdge(bar, depth * 1.3, false));
  }
  const glass = new THREE.MeshBasicMaterial({ color: '#e3f3ff', transparent: true, opacity: 0.22, depthWrite: false });
  const pane = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(inner)), glass);
  pane.position.z = depth * 0.5;
  group.add(pane);
  group.scale.setScalar(size);
  return group;
}

/** Glasses over the painted eyes. */
export function buildGlasses(
  type: string,
  { color = FRAME, params, eyeSpacing, eyeSize }: { color?: string; params: HeadParams; eyeSpacing: number; eyeSize: number },
): THREE.Group | null {
  if (!type || type === 'none') return null;
  const group = new THREE.Group();
  const lat = FEATURES.eyeLat;
  const size = 0.047 * eyeSize;
  const frameMat = frameMaterial(color, 0.5);
  const heavy = type === 'bold' || type === 'browline';

  for (const side of [-1, 1]) {
    const lon = side * eyeSpacing;
    const piece = lens(type, size, color, side);
    piece.position.copy(surface(lon, lat, 0.022, params));
    piece.lookAt(piece.position.clone().add(surfaceNormal(lon * 0.6, lat)));
    group.add(piece);

    // Temple arm from the outer edge of the frame back to the ear.
    const from = surface(side * (eyeSpacing + 0.3), lat + 0.02, 0.02, params);
    const to = surface(side * 1.5, lat + 0.03, 0.012, params);
    const armRadius = heavy ? 0.0055 : 0.004;
    const arm = celMesh(new THREE.CylinderGeometry(armRadius, armRadius, from.distanceTo(to), 6), frameMat, { outline: 0 });
    arm.position.copy(from).add(to).multiplyScalar(0.5);
    arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
    group.add(arm);
  }

  // Bridge over the nose.
  const left = surface(-(eyeSpacing - 0.25), lat + 0.04, 0.022, params);
  const right = surface(eyeSpacing - 0.25, lat + 0.04, 0.022, params);
  const mid = surface(0, lat + 0.07, 0.032, params);
  const bridge = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(left, mid, right), 8, heavy ? 0.006 : 0.0045, 6),
    frameMat,
  );
  group.add(bridge);
  group.traverse((child) => {
    child.castShadow = false; // thin frames cast stripy shadows across the face
  });
  return group;
}

// ---------------------------------------------------------------- earrings

// Stone of the drop earrings: turquoise, which goes with every metal.
const STONE = '#2fb8b0';

/** Drop earring: a small hook on the lobe, a stone set in metal hanging below it. */
function drop(material: THREE.Material, side: number, params: HeadParams): THREE.Group {
  const group = new THREE.Group();
  const lobe = surface(side * 1.5, -0.3, 0.012, params);
  const hook = celMesh(new THREE.TorusGeometry(0.008, 0.0025, 6, 12, Math.PI * 1.4), material, { outline: 0 });
  hook.rotation.y = side * 1.1;
  hook.position.copy(lobe);
  const setting = new THREE.SphereGeometry(1, 16, 12);
  setting.scale(0.011, 0.018, 0.006);
  const frame = celMesh(setting, material, { outline: 0.002 });
  frame.position.copy(lobe).add(new THREE.Vector3(0, -0.03, 0));
  const gem = celMesh(setting.clone().scale(0.75, 0.75, 1.2), cel(STONE, { rim: 0.5 }), { outline: 0 });
  gem.position.copy(frame.position);
  group.add(hook, frame, gem);
  // Turned the way the ear faces.
  for (const child of [frame, gem]) child.rotation.y = side * 1.2;
  return group;
}

/** Studs, hoops or drops on the ear lobes (ears at lon ±1.52, see Character). */
export function buildEarrings(type: string, { color, params }: { color: string; params: HeadParams }): THREE.Group | null {
  if (!type || type === 'none') return null;
  const group = new THREE.Group();
  const material = cel(color, { rim: 0.6 });
  if (type === 'drops') {
    for (const side of [-1, 1]) group.add(drop(material, side, params));
    return group;
  }
  for (const side of [-1, 1]) {
    const geometry = type === 'hoops' ? new THREE.TorusGeometry(0.03, 0.007, 8, 24) : new THREE.SphereGeometry(0.015, 12, 10);
    const earring = celMesh(geometry, material, { outline: 0.002 });
    earring.position.copy(surface(side * 1.5, -0.3, 0.012, params));
    if (type === 'hoops') {
      earring.position.y -= 0.028; // hangs from the lobe
      earring.rotation.y = side * 1.1;
    }
    group.add(earring);
  }
  return group;
}
