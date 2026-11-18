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

/**
 * Lower edge of the cap's crown, as a latitude on the head by longitude: across the upper forehead,
 * just over the ears, low on the back of the head. The hair comes out from under it (see hatEdge()).
 */
const capEdge = (lon: number) => 0.16 + 0.2 * Math.cos(lon);

/** Stitch rows of the visor, along its outer edge (v = 0 at the crown, 1 at the edge), multiplied with its colour. */
let stitches: THREE.CanvasTexture | null = null;
function visorStitches(): THREE.CanvasTexture {
  if (stitches) return stitches;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = '#b4b4b4';
  for (const v of [0.6, 0.72, 0.84]) {
    for (let x = 0; x < 256; x += 6) ctx.fillRect(x, Math.round((1 - v) * 64) - 1, 4, 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return (stitches = texture);
}

/**
 * The visor (bill) of the cap, coming out of the crown along its edge over the forehead: thin, round
 * in front, pitched down and bent down more and more towards its sides (a pre-curved bill), its
 * edge rounded. Two geometries: the top with its edge, and the underside.
 */
function visorGeometry(params: HeadParams, room: number): THREE.BufferGeometry[] {
  const halfSpan = 1.1; // longitude where the visor meets the crown, on each side
  const columns = 48;
  const steps = 10; // along the top and the underside
  const tip = 5; // round the edge
  const positions: number[] = [];
  const uvs: number[] = [];
  for (let c = 0; c <= columns; c++) {
    const u = (c / columns) * 2 - 1;
    const lon = u * halfSpan;
    const root = surface(lon, capEdge(lon) + 0.015, room - 0.004, params);
    const n = surfaceNormal(lon, 0);
    const flat = new THREE.Vector3(n.x, 0, n.z).normalize().lerp(new THREE.Vector3(0, 0, 1), 0.55).normalize();
    const pitch = 0.3 + 0.45 * u * u;
    const along = flat.clone().multiplyScalar(Math.cos(pitch)).setY(-Math.sin(pitch));
    const up = flat.clone().multiplyScalar(Math.sin(pitch)).setY(Math.cos(pitch));
    const length = 0.125 * Math.sqrt(1 - Math.abs(u) ** 2.4);
    const half = 0.0032 * (0.6 + 0.4 * (1 - u * u));
    const at = (s: number, h: number, v: number) => {
      // Arched along its length too: the middle of the bill a little higher than its ends.
      const p = root.clone().addScaledVector(along, s).addScaledVector(up, h + 0.012 * (s / 0.125) * (1 - s / 0.125 / 1.4));
      positions.push(p.x, p.y, p.z);
      uvs.push((u + 1) / 2, v);
    };
    for (let k = 0; k <= steps; k++) at((k / steps) * length, half, k / steps);
    for (let k = 1; k < tip; k++) {
      const a = Math.PI / 2 - (Math.PI * k) / tip;
      at(length + half * Math.cos(a), half * Math.sin(a), 1);
    }
    for (let k = steps; k >= 0; k--) at((k / steps) * length, -half, 1);
  }
  const profile = 2 * steps + tip + 1;
  const top: number[] = [];
  const under: number[] = [];
  for (let c = 0; c < columns; c++) {
    for (let k = 0; k < profile - 1; k++) {
      const a = c * profile + k;
      const b = a + profile;
      (k < steps + tip ? top : under).push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex([...top, ...under]);
  geometry.computeVertexNormals();
  // Same vertices and normals, so the two parts meet without a crease.
  return [top, under].map((indices) => geometry.clone().setIndex(indices));
}

/**
 * Grid of `rows` × `columns` quads through `point(i, j)` (i, j from 0 to 1), row 0 on top and
 * columns from left to right seen from outside (its front faces outwards), with smooth normals.
 */
function grid(rows: number, columns: number, point: (i: number, j: number) => THREE.Vector3): THREE.BufferGeometry {
  const positions: number[] = [];
  for (let i = 0; i <= rows; i++) {
    for (let j = 0; j <= columns; j++) positions.push(...point(i / rows, j / columns).toArray());
  }
  const indices: number[] = [];
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < columns; j++) {
      const a = i * (columns + 1) + j;
      const b = a + columns + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Wrench on a white disc, the badge of the plumber's cap (presets.ts), as flat shapes in head units
 * round the origin, from the bottom layer up.
 */
function wrenchBadge(color: string): [THREE.BufferGeometry, string][] {
  // Finely divided, so that laid on the crown they follow its curve instead of sinking into it.
  const disc = (r: number) => new THREE.RingGeometry(0, r, 32, 6);
  const bar = (w: number, h: number) => new THREE.PlaneGeometry(w, h, 2, 8);
  const at = (geometry: THREE.BufferGeometry, y: number) => geometry.translate(0, y, 0).rotateZ(-Math.PI / 4);
  return [
    [disc(0.05), '#f7f3ee'],
    [at(bar(0.011, 0.048), -0.008), color],
    [at(disc(0.009), -0.032), color],
    [at(disc(0.0165), 0.02), color],
    // The open jaw, and the hole at the other end of the handle.
    [at(bar(0.011, 0.024), 0.031), '#f7f3ee'],
    [at(disc(0.0038), -0.032), '#f7f3ee'],
  ];
}

/**
 * Baseball cap, built on the head itself so it fits every face shape: a crown of soft panels, fuller
 * over the forehead (the stiff front panels), a button on top, a logo on the front; its band across
 * the upper forehead, just over the ears and low on the back of the head, rolled under at its edge;
 * an opening at the back over the adjustable strap; a thin, curved visor, darker underneath.
 * `volume`: how far the hair under it rises (HAIR_VOLUME): big hair lifts it a little. `badge`: the
 * plumber's own cap (presets.ts), a wrench on a white disc instead of the star.
 */
function cap(color: string, params: HeadParams, volume: number, badge = false): THREE.Group {
  const group = new THREE.Group();
  const room = 0.012 + Math.min(volume, 0.09) * 0.3;
  const material = cel(color, { rim: 0.3 });
  // The opening at the back: the edge rises in an arch over the strap.
  const opening = 0.42;
  const edge = (lon: number) => capEdge(lon) + 0.2 * Math.sqrt(Math.max(0, 1 - ((Math.PI - Math.abs(lon)) / opening) ** 2));
  // Height of the crown above the head at (lon, v), v from its edge (0) to the button (1): fuller at
  // the front, the same all round near the top (where the panels meet).
  const front = (lon: number, v: number) => lerp(Math.exp(-((lon / 1.1) ** 2)), 0.45, smoothstep(v, 0.45, 1));
  const height = (lon: number, v: number) => room + (0.004 + 0.016 * front(lon, v)) * smoothstep(v, 0, 0.35) * (1 - 0.35 * smoothstep(v, 0.7, 1));
  const crownPoint = (lon: number, v: number, lift = 0) => surface(lon, lerp(edge(lon), Math.PI / 2, v), height(lon, v) + lift, params);

  // From the button down to the edge (v from 1 to 0), then the band rolled under it: a rounded lip,
  // then tucked in.
  const rows = 36;
  const crown = grid(rows + 2, 128, (i, j) => {
    const lon = (j * 2 - 1) * Math.PI;
    const row = Math.round(i * (rows + 2));
    if (row <= rows) return crownPoint(lon, 1 - row / rows);
    const under = row - rows;
    return surface(lon, edge(lon) - [0, 0.012, 0.022][under], room - [0, 0.002, 0.009][under], params);
  });
  group.add(celMesh(smoothSeams(crown), material, { outline: 0.004 }));

  // Seams between the panels: thin welts from the edge up to the button (none down the front panel,
  // where the logo is).
  const welt = cel(shadeHex(color, -0.18), { rim: 0.2 });
  for (const lon of [-2.1, -1.05, 1.05, 2.1, Math.PI]) {
    const curve = new THREE.CatmullRomCurve3(Array.from({ length: 13 }, (_, k) => crownPoint(lon, 0.04 + (0.92 * k) / 12, 0.0005)));
    group.add(celMesh(sweep(curve, () => 0.0018, { segments: 40, radial: 6 }), welt, { outline: 0 }));
  }
  const button = part(new THREE.SphereGeometry(0.016, 14, 10), color, { outline: 0.003 });
  button.scale.y = 0.55;
  button.position.copy(surface(0, Math.PI / 2, height(0, 1) + 0.002, params));
  group.add(button);

  // Logo on the front panel: a star in a contrasting colour (dark on a light cap), laid on the crown.
  const logoAt = 0.42;
  const layOn = (logo: THREE.BufferGeometry, lift: number) => {
    const p = logo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const lon = p.getX(i) / (HEAD.rz + room);
      const v = logoAt + p.getY(i) / ((HEAD.ry + room) * (Math.PI / 2 - edge(0)));
      const q = crownPoint(lon, v, lift);
      p.setXYZ(i, q.x, q.y, q.z);
    }
    logo.computeVertexNormals();
    return logo;
  };
  const light = new THREE.Color(color).getHSL({ h: 0, s: 0, l: 0 }).l > 0.7;
  const logo: [THREE.BufferGeometry, string][] = badge ? wrenchBadge(color) : [[new THREE.ShapeGeometry(star(0.036)), shadeHex(color, light ? -0.5 : 0.75)]];
  logo.forEach(([shape, c], layer) => group.add(celMesh(layOn(shape, 0.0012 + layer * 0.0008), cel(c, { rim: 0 }), { outline: 0 })));

  // The strap across the bottom of the opening, its ends sunk into the crown, with its snap.
  const strap = grid(3, 24, (i, j) => {
    const lift = j === 0 || j === 1 ? -0.006 : i === 0 || i === 1 ? 0.0005 : 0.002; // rounded edges
    return surface(Math.PI + (j * 2 - 1) * (opening + 0.04), capEdge(Math.PI) + 0.05 - 0.052 * i, room + lift, params);
  });
  group.add(celMesh(strap, cel(shadeHex(color, -0.12), { rim: 0.2 }), { outline: 0.002 }));
  const snap = part(new THREE.CylinderGeometry(0.0055, 0.0055, 0.002, 12), shadeHex(color, 0.5), { outline: 0.002 });
  snap.position.copy(surface(Math.PI, capEdge(Math.PI) + 0.024, room + 0.0025, params));
  snap.rotation.x = Math.PI / 2;
  group.add(snap);

  // No rim light on the visor: seen at a grazing angle, it washed it out to grey.
  const [bill, under] = visorGeometry(params, room);
  group.add(celMesh(bill, cel(color, { rim: 0, map: visorStitches() }), { outline: 0.003 }));
  group.add(celMesh(under, cel(shadeHex(color, -0.35), { rim: 0 }), { outline: 0.003 }));
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

/**
 * Wizard hat, a bit worn: a wide floppy brim, wavy and drooping at the edge, under a tall cone that
 * creases as it rises and folds back at the top, its tip sagging; a darker band and a sewn-on patch.
 */
function wizard(color: string): THREE.Group {
  const group = new THREE.Group();
  const base = 0.22;

  // Brim: a flat ring (an ellipse swept round the crown), lower and wavier towards its edge.
  const rows = 96;
  const ring = 16;
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= rows; i++) {
    const a = (i / rows) * Math.PI * 2;
    for (let j = 0; j <= ring; j++) {
      const u = (j / ring) * Math.PI * 2;
      const r = 1.24 + 0.32 * Math.cos(u);
      const out = smoothstep(r, 0.95, 1.56);
      const droop = out ** 1.6 * (0.2 + 0.05 * Math.cos(a) + 0.06 * Math.sin(a * 3 + 0.7));
      positions.push(Math.sin(a) * r, base + 0.035 * Math.sin(u) - droop, Math.cos(a) * r);
    }
  }
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < ring; j++) {
      const k = i * (ring + 1) + j;
      indices.push(k, k + ring + 1, k + 1, k + ring + 1, k + ring + 2, k + 1);
    }
  }
  const brimGeometry = new THREE.BufferGeometry();
  brimGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  brimGeometry.setIndex(indices);
  brimGeometry.computeVertexNormals();
  group.add(part(smoothSeams(brimGeometry), color));

  // Crown: rises, leans back, then folds over at the top, the tip hanging down a little.
  const spine = new THREE.CatmullRomCurve3([
    [0, base - 0.05, 0], [0, 0.72, -0.03], [0.02, 1.1, -0.1], [0.06, 1.32, -0.3], [0.1, 1.36, -0.58], [0.15, 1.18, -0.82],
  ].map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  // Wider at the bottom, narrowing to the tip, with a few soft creases of a hat crushed and shaped again.
  const radius = (t: number) => 0.98 * (1 - t) ** 1.1 * (1 + 0.05 * Math.sin(t * 17) * smoothstep(t, 0.1, 0.35));
  group.add(part(sweep(spine, radius, { segments: 64, radial: 32 }), color));

  // Band round the bottom of the crown.
  const band = part(new THREE.CylinderGeometry(0.97, 1.0, 0.2, 40, 1, true), shadeHex(color, -0.3), { outline: 0 });
  band.material.side = THREE.DoubleSide;
  band.position.y = base + 0.12;
  group.add(band);

  // Patch sewn on the side of the crown, a bit crooked.
  const t = 0.3;
  const point = spine.getPointAt(t);
  const side = new THREE.Vector3(0.75, 0, 0.66).normalize();
  // The crown narrows as it rises: its surface faces a little upwards.
  const slope = (radius(t + 0.01) - radius(t - 0.01)) / 0.02 / spine.getLength();
  const normal = side.clone().addScaledVector(spine.getTangentAt(t), -slope).normalize();
  // Thick enough that its flat corners stay out of the rounded crown.
  const patch = part(new THREE.BoxGeometry(0.3, 0.26, 0.07), shadeHex(color, 0.22), { outline: 0.008 });
  patch.position.copy(point).addScaledVector(side, radius(t));
  patch.lookAt(patch.position.clone().add(normal));
  patch.rotateZ(0.25);
  group.add(patch);

  group.rotation.set(-0.08, 0, 0.06);
  return group;
}

const { smoothstep, lerp } = THREE.MathUtils;

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
  return type === 'headscarf' || type === 'heroMask';
}

/** Headwear that covers the whole face: no nose, ears or glasses are built under it. */
export function hidesFace(type: string): boolean {
  return type === 'heroMask';
}

const webTextures = new Map<string, THREE.CanvasTexture>();

/**
 * The superhero's mask (presets.ts), in longitude / latitude over the whole head: a web of black
 * threads radiating from between the eyes, and two big white lenses rimmed in black.
 */
function maskTexture(color: string): THREE.CanvasTexture {
  if (webTextures.has(color)) return webTextures.get(color)!;
  const W = 1024;
  const H = 512;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const at = (lon: number, lat: number): [number, number] => [((lon + Math.PI) / (2 * Math.PI)) * W, ((Math.PI / 2 - lat) / Math.PI) * H];
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, H);
  const centre = { lon: 0, lat: FEATURES.eyeLat + 0.05 };
  const point = (angle: number, r: number) => at(centre.lon + Math.cos(angle) * r, centre.lat + Math.sin(angle) * r * 0.8);
  ctx.strokeStyle = '#1a1416';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  const spokes = 16;
  for (let k = 0; k < spokes; k++) {
    const a = (k / spokes) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(...point(a, 0.05));
    ctx.lineTo(...point(a, 3));
    ctx.stroke();
  }
  // Rings sagging towards the centre between two spokes.
  for (let r = 0.22; r < 3; r += 0.24) {
    for (let k = 0; k < spokes; k++) {
      const a0 = (k / spokes) * Math.PI * 2;
      const a1 = ((k + 1) / spokes) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(...point(a0, r));
      ctx.quadraticCurveTo(...point((a0 + a1) / 2, r * 0.86), ...point(a1, r));
      ctx.stroke();
    }
  }
  // The lenses: tilted, their outer corners raised (a determined look, not a sad one).
  for (const side of [-1, 1]) {
    const [x, y] = at(side * 0.45, FEATURES.eyeLat + 0.04);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-side * 0.3);
    ctx.beginPath();
    ctx.ellipse(0, 0, 0.3 * W / (2 * Math.PI), 0.2 * H / Math.PI, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#f7f3ee';
    ctx.fill();
    ctx.lineWidth = 9;
    ctx.stroke();
    ctx.restore();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  webTextures.set(color, texture);
  return texture;
}

/** The superhero's full mask (presets.ts): a skin-tight layer over the whole head, in its colour. */
function heroMask(color: string, params: HeadParams): THREE.Group {
  const group = new THREE.Group();
  const geometry = shellGeometry(params, () => 0.006, {
    uv: (lon, lat) => [(lon + Math.PI) / (2 * Math.PI), (lat + Math.PI / 2) / Math.PI],
    segments: { lonSegments: 160, latSegments: 100 },
  });
  group.add(celMesh(geometry, cel('#ffffff', { map: maskTexture(color), rim: 0.25, softness: 0.1 }), { outline: 0.004 }));
  return group;
}

/**
 * `volume`: how far the hair rises above the skull (HAIR_VOLUME), so hats sit on it.
 * `params`: head shape, for the headwear that wraps it (scarf).
 */
export function buildHeadwear(
  type: string, { color, volume = 0.03, params }: { color: string; volume?: number; params: HeadParams },
): THREE.Group | null {
  if (type === 'headscarf') return headscarf(color, params);
  if (type === 'heroMask') return heroMask(color, params);
  if (type === 'cap' || type === 'plumberCap') return cap(color, params, volume, type === 'plumberCap');
  const group = ({ beanie, wizard } as Record<string, (color: string) => THREE.Group>)[type]?.(color);
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
  return type === 'cap' || type === 'beanie' || type === 'wizard' || type === 'plumberCap';
}

/**
 * Lower edge of a hat, as a latitude on the head by longitude, for the hair to come out from under
 * it (see buildHair()); undefined for the hats that keep the default edge.
 */
export function hatEdge(type: string): ((lon: number) => number) | undefined {
  // The cuff of the beanie, tilted up at the front.
  if (type === 'beanie') return (lon) => 0.085 + 0.165 * Math.cos(lon);
  // The band of the wizard hat, level all round its crown.
  if (type === 'wizard') return () => 0.29;
  return type === 'cap' || type === 'plumberCap' ? capEdge : undefined;
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
  sunRound: { a: 1.08, b: 1.08, n: 2, rim: 0.12 }, // the adventurer's round sunglasses (presets.ts)
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
  const sun = type === 'sunRound';
  const glass = new THREE.MeshBasicMaterial({ color: sun ? '#1d262c' : '#e3f3ff', transparent: true, opacity: sun ? 0.88 : 0.22, depthWrite: false });
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

// ---------------------------------------------------------------- held items

// What the ready-made characters hold in their left hand (presets.ts), in the elbow's frame (see
// Character.build): centred on the fist, the forearm along −Y, forwards +Z.

const prop = (geometry: THREE.BufferGeometry, color: string) => celMesh(geometry, cel(color, { rim: 0.3 }), { outline: 0.003 });

function wand(): THREE.Group {
  const group = new THREE.Group();
  const handle = prop(new THREE.CylinderGeometry(0.011, 0.009, 0.09, 10), '#4a3426');
  handle.position.y = 0.005;
  const shaft = prop(new THREE.CylinderGeometry(0.004, 0.008, 0.16, 8), '#7a5236');
  shaft.position.y = 0.13;
  const knob = prop(new THREE.SphereGeometry(0.012, 10, 8), '#4a3426');
  knob.position.y = -0.045;
  group.add(handle, shaft, knob);
  // Pointing forwards and out, a little up.
  group.rotation.set(1.2, 0, -0.6);
  return group;
}

/** Wooden staff from the floor to above the head, gnarled at the top. */
function staff(): THREE.Group {
  const group = new THREE.Group();
  const wood = '#8a6a4a';
  const points = [[0, -0.3], [0.006, 0.2], [-0.004, 0.75], [0.004, 1.15], [0.03, 1.27], [0.02, 1.32]]
    .map(([x, y]) => new THREE.Vector3(x, y, 0));
  group.add(prop(sweep(new THREE.CatmullRomCurve3(points), (t) => 0.014 + 0.006 * t + 0.008 * Math.sin(t * 23) * t, { segments: 40, radial: 10 }), wood));
  for (const [x, y, r] of [[0.02, 1.2, 0.022], [0.035, 1.28, 0.02], [0.012, 1.33, 0.018], [-0.006, 1.25, 0.016]]) {
    const knot = prop(new THREE.SphereGeometry(r, 12, 8), shadeHex(wood, -0.12));
    knot.position.set(x, y, 0);
    group.add(knot);
  }
  // In front of the hand and leaning out from the body, so it shows beside the hair; it stays standing
  // like this whatever the arm does (Character.straightenHeld()).
  group.rotation.set(0.05, 0, -0.22);
  group.position.z = 0.04;
  group.userData.upright = group.quaternion.clone();
  return group;
}

/**
 * Small dark toy pistol, with the orange tip, trigger and sight of a toy gun: the grip in the fist (its butt
 * showing behind it), the barrel along the forearm; `side`: the hand.
 */
function pistol(side = 1): THREE.Group {
  const group = new THREE.Group();
  const toy = '#ff7b00';
  const grip = prop(new THREE.BoxGeometry(0.024, 0.085, 0.034), '#2b2b2e');
  grip.rotation.x = -0.25;
  grip.position.set(0, -0.012, -0.006);
  const slide = prop(new THREE.BoxGeometry(0.026, 0.03, 0.115), '#4a4e57');
  slide.position.set(0, 0.04, 0.0325);
  const tip = prop(new THREE.BoxGeometry(0.028, 0.032, 0.016), toy);
  tip.position.set(0, 0.04, 0.098);
  const sight = prop(new THREE.BoxGeometry(0.008, 0.01, 0.01), toy);
  sight.position.set(0, 0.058, 0.08);
  const muzzle = celMesh(new THREE.CircleGeometry(0.007, 10), cel('#121214', { rim: 0 }), { outline: 0 });
  muzzle.position.set(0, 0.042, 0.1065);
  const guard = prop(new THREE.TorusGeometry(0.016, 0.004, 6, 12, Math.PI), '#2b2b2e');
  guard.rotation.set(Math.PI, Math.PI / 2, 0);
  guard.position.set(0, 0.025, 0.035);
  const trigger = prop(new THREE.BoxGeometry(0.006, 0.016, 0.006), toy);
  trigger.rotation.x = 0.3;
  trigger.position.set(0, 0.016, 0.03);
  group.add(grip, slide, tip, sight, muzzle, guard, trigger);
  group.scale.setScalar(1.25);
  // Barrel in line with the forearm (the slide on the thumb's side), turned about it so it shows its side.
  group.rotation.set(Math.PI / 2, 0, -0.4 * side);
  group.position.z = -0.025; // the slide in the fist's front, so the barrel comes out of it
  return group;
}

/**
 * What the hand on `side` holds (+1 the left, −1 the right), or null: 'wand', 'staff' or 'pistol' in
 * the left hand, 'pistols' one in each.
 */
export function buildHeldItem(type: string, side: number): THREE.Group | null {
  if (type === 'pistols') return pistol(side);
  return side > 0 ? ({ wand, staff, pistol } as Record<string, () => THREE.Group>)[type]?.() ?? null : null;
}
