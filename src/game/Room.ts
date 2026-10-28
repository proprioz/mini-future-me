import * as THREE from 'three';
import { Grid, type Tile } from './Grid.ts';
import { box, cylinder, sphere, mesh, toon, place } from '../render/materials.ts';
import { PALETTE as C } from '../render/palette.ts';
import { trade } from '../trades/current.ts';
import type { IconName } from '../ui/iconPaths.ts';

/** What the trade's buildStations() receives: the room's group to add meshes to and its walking grid. */
export interface RoomContext {
  group: THREE.Group;
  grid: Grid;
  interactables: Interactable[];
}

/** A work station (or the cork board) the avatar walks to and uses. */
export interface Interactable {
  id: string;
  label: string;
  icon: IconName;
  object: THREE.Object3D;
  /** Tile where the avatar stands to use it. */
  useTile: Tile;
  /** Point it looks at; its badge floats above. */
  focus: THREE.Vector3;
  markerAt: THREE.Vector3;
  hovered: boolean;
  glow: number;
  setHighlight(on: boolean): void;
  setGlow(amount: number): void;
  paint(): void;
}

export interface StationOptions {
  id: string;
  label: string;
  icon: IconName;
  useTile: Tile;
  focus: THREE.Vector3;
  /** Invisible box around the station (world units), so a tap near it counts too. */
  hitbox: { size: [number, number, number]; at: [number, number, number] };
}

export const ROOM_WIDTH = 7; // along X (tiles)
export const ROOM_DEPTH = 5; // along Z (tiles)
const WALL_HEIGHT = 2.6;
const WALL_THICKNESS = 0.15;

// Added to an object's emissive colour while hovered, and at the peak of the "use me" glow (linear RGB).
const HIGHLIGHT = new THREE.Color(0.16, 0.14, 0.09);
const GLOW = new THREE.Color(0.2, 0.07, 0.08);

/**
 * The little office: floor, two back walls, the cork board with the client's orders and some decor,
 * common to every trade; the trade adds its work stations (`trade().buildStations(ctx)`).
 * Back wall runs along X at z = 0, left wall along Z at x = 0; the camera looks from +X +Z.
 * Small room, big stations: each one reads at a glance and is an easy target for a finger.
 *
 * Free for the stations: the back wall from x = 1 (the plant stands in the corner), the left wall
 * from z = 3, and the floor away from the rug (around 3.4, 2.9) and the beanbag (tile 1, 4).
 */
export type Room = ReturnType<typeof buildRoom>;

export function buildRoom() {
  const ctx: RoomContext = {
    group: new THREE.Group(),
    grid: new Grid(ROOM_WIDTH, ROOM_DEPTH),
    interactables: [],
  };

  buildShell(ctx);
  buildOrdersCorner(ctx);
  buildDecor(ctx);
  trade().buildStations(ctx);
  buildFairyLights(ctx);

  return { ...ctx, width: ROOM_WIDTH, depth: ROOM_DEPTH };
}

export function addTo<T extends THREE.Object3D>(parent: THREE.Object3D, ...objects: [T, ...THREE.Object3D[]]): T {
  parent.add(...objects);
  return objects[0];
}

/**
 * Registers a work station. `hitbox` ({ size, at }, world units) is an invisible box around it, so a
 * tap near the station counts too: the visible parts (tripod legs, a phone) are thin.
 */
export function makeInteractable(ctx: RoomContext, object: THREE.Object3D, { id, label, icon, useTile, focus, hitbox }: StationOptions): Interactable {
  const item: Interactable = {
    id,
    label,
    icon,
    object,
    useTile,
    focus,
    markerAt: focus.clone().add(new THREE.Vector3(0, 0.8, 0)),
    hovered: false,
    glow: 0,
    setHighlight(on) {
      this.hovered = on;
      this.paint();
    },
    /** `amount` in [0, 1]: a soft coral glow, pulsed on the station of the next order. */
    setGlow(amount) {
      this.glow = amount;
      this.paint();
    },
    paint() {
      object.traverse((child) => {
        if (!(child as THREE.Mesh).isMesh) return;
        const m = (child as THREE.Mesh<THREE.BufferGeometry, THREE.MeshToonMaterial>).material;
        m.userData.baseEmissive ??= m.emissive.clone();
        m.emissive.copy(m.userData.baseEmissive);
        if (this.hovered) m.emissive.add(HIGHLIGHT);
        else if (this.glow) m.emissive.add(GLOW.clone().multiplyScalar(this.glow));
      });
    },
  };
  object.userData.item = item;
  const hit = new THREE.Mesh(new THREE.BoxGeometry(...hitbox.size), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.set(...hitbox.at);
  hit.userData.item = item;
  ctx.group.add(hit);
  ctx.interactables.push(item);
  return item;
}

// ---------------------------------------------------------------- shell

export function canvasTexture(
  width: number, height: number, draw: (g: CanvasRenderingContext2D, width: number, height: number) => void,
): THREE.CanvasTexture<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d')!, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Basket-weave parquet: one square of three planks per tile, so the walking grid reads at a glance. */
function parquetTexture(): THREE.CanvasTexture<HTMLCanvasElement> {
  const size = 512;
  const tile = size / 2;
  const plank = tile / 3;
  const texture = canvasTexture(size, size, (g) => {
    for (let tz = 0; tz < 2; tz++) {
      for (let tx = 0; tx < 2; tx++) {
        const across = (tx + tz) % 2 === 0;
        for (let i = 0; i < 3; i++) {
          const [x, y, w, h] = across
            ? [tx * tile, tz * tile + i * plank, tile, plank]
            : [tx * tile + i * plank, tz * tile, plank, tile];
          g.fillStyle = C.parquet[(tx * 3 + tz * 2 + i) % C.parquet.length];
          g.fillRect(x, y, w, h);
          // Soft highlight along one edge of each plank, then the seam.
          g.fillStyle = 'rgba(255, 255, 255, 0.18)';
          if (across) g.fillRect(x, y + 3, w, 4);
          else g.fillRect(x + 3, y, 4, h);
          g.strokeStyle = C.wood;
          g.lineWidth = 2;
          g.strokeRect(x + 1, y + 1, w - 2, h - 2);
        }
      }
    }
  });
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(ROOM_WIDTH / 2, ROOM_DEPTH / 2); // one canvas = 2x2 tiles
  texture.anisotropy = 8;
  return texture;
}

function buildShell({ group }: RoomContext): void {
  const W = ROOM_WIDTH;
  const D = ROOM_DEPTH;
  const H = WALL_HEIGHT;
  const T = WALL_THICKNESS;

  // The room floats like a diorama: thick teal base, with a soft shadow far below it.
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(W * 1.9, D * 1.9),
    new THREE.MeshBasicMaterial({
      map: canvasTexture(256, 256, (g, w, h) => {
        const glow = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
        glow.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
        glow.addColorStop(0.5, 'rgba(255, 255, 255, 0.35)');
        glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
        g.fillStyle = glow;
        g.fillRect(0, 0, w, h);
      }),
      color: C.tealDeep,
      transparent: true,
      depthWrite: false,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(W / 2 + 0.8, -1.6, D / 2 + 0.8);
  shadow.raycast = () => {};
  group.add(shadow);

  const slab = place(box(W + T * 2, 0.6, D + T * 2, C.tealDeep, 0.08), W / 2, -0.32, D / 2);
  const lip = place(box(W + T * 2 + 0.03, 0.07, D + T * 2 + 0.03, C.tealMuted, 0.02), W / 2, -0.035, D / 2);
  for (const part of [slab, lip]) {
    part.castShadow = false;
    group.add(part);
  }

  const floor = mesh(new THREE.PlaneGeometry(W, D), toon('#ffffff', { map: parquetTexture() }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(W / 2, 0.001, D / 2);
  floor.castShadow = false;
  group.add(floor);

  // Back wall (z = 0), left wall (x = 0), with two-tone wainscot and a top cap.
  addTo(group,
    place(box(W + T, H, T, C.wall, 0.01), W / 2 - T / 2, H / 2, -T / 2),
    place(box(T, H, D, C.wall, 0.01), -T / 2, H / 2, D / 2),
    place(box(W + T + 0.04, 0.06, T + 0.04, C.tealDeep, 0.01), W / 2 - T / 2, H + 0.03, -T / 2),
    place(box(T + 0.04, 0.06, D + 0.02, C.tealDeep, 0.01), -T / 2, H + 0.03, D / 2),
    place(box(W, 0.9, 0.03, C.wainscot, 0.005), W / 2, 0.45, 0.015),
    place(box(0.03, 0.9, D, C.wainscot, 0.005), 0.015, 0.45, D / 2),
    place(box(W, 0.05, 0.05, C.trim, 0.01), W / 2, 0.92, 0.025),
    place(box(0.05, 0.05, D, C.trim, 0.01), 0.025, 0.92, D / 2),
  );
}

/** 📌 Cork board with the client's orders, above a sideboard on the left wall. */
function buildOrdersCorner(ctx: RoomContext): void {
  const { group, grid } = ctx;
  const z0 = 1.5;

  // Sideboard with binders and a little plant.
  addTo(group,
    place(box(0.6, 0.72, 1.2, C.tealMuted, 0.03), 0.33, 0.36, z0),
    place(box(0.01, 0.6, 0.55, C.teal, 0.005), 0.635, 0.37, z0 - 0.29),
    place(box(0.01, 0.6, 0.55, C.teal, 0.005), 0.635, 0.37, z0 + 0.29),
    place(sphere(0.025, C.sun), 0.645, 0.4, z0 - 0.06),
    place(sphere(0.025, C.sun), 0.645, 0.4, z0 + 0.06),
  );
  [C.coral, C.sun, C.paper, C.sky].forEach((color, i) => {
    group.add(place(box(0.28, 0.32, 0.06, color, 0.01), 0.3, 0.88, z0 - 0.45 + i * 0.075));
  });
  addTo(group,
    place(cylinder(0.08, 0.06, 0.12, C.paper), 0.3, 0.78, z0 + 0.4),
    place(sphere(0.09, C.leaf), 0.3, 0.9, z0 + 0.4),
  );
  grid.block([0, 1], [0, 2]);

  // Cork board with the client's orders: one big note per order, on two rows (up to six).
  const board = new THREE.Group();
  board.add(
    place(box(0.05, 1.0, 1.5, C.wood, 0.01), 0.03, 1.65, z0),
    place(box(0.06, 0.9, 1.4, '#e6c08f', 0.005), 0.04, 1.65, z0),
  );
  const count = Math.min(trade().tasks.length, 6);
  const top = Math.ceil(count / 2);
  const colors = [C.sun, C.blush, C.aqua, C.paper, C.sun, C.sky];
  const notes = Array.from({ length: count }, (_, i): [string, number, number] => {
    const row = i < top ? 0 : 1;
    const [index, size] = row ? [i - top, count - top] : [i, top];
    const y = (row ? 1.45 : 1.84) + ((i % 2) - 0.5) * 0.04;
    return [colors[i], y, z0 + (index - (size - 1) / 2) * (row ? 0.55 : 0.47)];
  });
  notes.forEach(([color, y, z], i) => {
    const note = place(box(0.01, 0.28, 0.28, color, 0.002), 0.08, y, z);
    note.rotation.x = (i % 2 ? 1 : -1) * 0.08;
    board.add(note, place(sphere(0.024, C.coral, undefined, 8), 0.095, y + 0.1, z));
  });
  group.add(board);
  makeInteractable(ctx, board, {
    id: 'orders',
    label: 'Commandes',
    icon: 'push-pin',
    useTile: { x: 1, z: 1 },
    focus: new THREE.Vector3(0.1, 1.55, z0),
    hitbox: { size: [0.4, 1.2, 1.6], at: [0.2, 1.65, z0] },
  });
}

// ---------------------------------------------------------------- decoration

function buildDecor({ group, grid }: RoomContext): void {
  // Beanbag in the front-left corner.
  const beanbag = place(sphere(0.45, C.sun, undefined, 24), 1.6, 0.25, 4.45);
  beanbag.scale.set(1, 0.6, 1);
  group.add(beanbag);
  grid.block([1, 4]);

  // Round rug in the middle of the room.
  for (const [radius, color, y] of [[1.2, C.teal, 0.011], [0.98, C.mist, 0.013], [0.72, C.blush, 0.015]] as const) {
    const ring = place(cylinder(radius, radius, 0.02, color, undefined, 48), 3.4, y, 2.9);
    ring.castShadow = false;
    group.add(ring);
  }

  // Big plant in the back corner.
  group.add(place(cylinder(0.22, 0.16, 0.42, C.paper), 0.5, 0.21, 0.5));
  const leaves: [number, number, number, number, string][] = [
    [0, 0.72, 0, 0.3, C.leaf], [0.15, 0.95, 0.1, 0.22, '#2d9470'], [-0.12, 1.0, -0.05, 0.24, '#5cc48c'],
    [0.05, 1.2, -0.1, 0.18, C.leaf], [-0.15, 0.72, 0.15, 0.2, '#2d9470'],
  ];
  for (const [x, y, z, r, color] of leaves) group.add(place(sphere(r, color), 0.5 + x, y, 0.5 + z));
  grid.block([0, 0]);

  // Framed poster above the desk.
  group.add(
    place(box(1.0, 0.75, 0.05, C.ink, 0.01), 2.5, 1.85, 0.025),
    place(box(0.88, 0.63, 0.02, C.teal, 0.003), 2.5, 1.85, 0.055),
    place(box(0.3, 0.3, 0.02, C.sun, 0.14), 2.35, 1.9, 0.065),
    place(box(0.5, 0.06, 0.02, C.paper, 0.01), 2.5, 1.62, 0.065),
  );

  // Window on the back wall, between the desk and the photo backdrop.
  const frame = place(new THREE.Group(), 4.1, 1.6, 0.03);
  frame.add(
    place(box(0.95, 1.1, 0.06, C.trim, 0.02), 0, 0, 0),
    place(windowPane(0.8, 0.92), 0, 0, 0.03),
    place(box(0.05, 0.92, 0.03, C.trim, 0.005), 0, 0, 0.04),
    place(box(0.8, 0.05, 0.03, C.trim, 0.005), 0, 0, 0.04),
    place(box(1.05, 0.05, 0.16, C.trim, 0.01), 0, -0.57, 0.05),
  );
  group.add(frame);
}

/** Window glass painted with the outside: blue-hour sky, clouds and teal rooftops. */
function windowPane(w: number, h: number): THREE.Mesh<THREE.BufferGeometry, THREE.MeshToonMaterial> {
  const map = canvasTexture(256, 210, (g, cw, ch) => {
    const sky = g.createLinearGradient(0, 0, 0, ch);
    sky.addColorStop(0, '#7fd3f2');
    sky.addColorStop(0.65, '#c9f0ec');
    sky.addColorStop(1, '#ffd9df');
    g.fillStyle = sky;
    g.fillRect(0, 0, cw, ch);
    g.fillStyle = 'rgba(255, 255, 255, 0.9)';
    for (const [x, y, r] of [[60, 50, 18], [82, 44, 24], [106, 52, 16], [180, 92, 12], [196, 86, 17], [214, 93, 11]]) {
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
    // Rooftops, back row lighter than the front one.
    for (const [color, base, roofs] of [
      [C.aqua, 150, [[0, 30, 40], [36, 20, 52], [84, 34, 30], [140, 26, 46], [200, 38, 60]]],
      [C.teal, 175, [[-10, 46, 22], [44, 58, 18], [118, 40, 30], [166, 52, 24], [222, 44, 26]]],
    ] as [string, number, [number, number, number][]][]) {
      g.fillStyle = color;
      for (const [x, width, height] of roofs) g.fillRect(x, base - height, width, ch);
    }
  });
  return box(w, h, 0.02, '#ffffff', 0.003, { map, emissive: '#ffffff', emissiveMap: map, emissiveIntensity: 0.55 });
}

// ---------------------------------------------------------------- fairy lights

/** Warm bulbs on a sagging cable along the top of both walls. */
function buildFairyLights({ group }: RoomContext): void {
  const y = 2.38;
  const sag = 0.14;
  const span = 1.4;
  const cable = toon(C.ink);
  const bulb = toon('#ffe9a8', { emissive: '#ffcf5c', emissiveIntensity: 0.9 });
  const bulbGeometry = new THREE.SphereGeometry(0.042, 10, 8);

  // [start, end] of each run, a little in front of the wall; the back one stops before the backdrop.
  const runs = [
    [new THREE.Vector3(0.35, y, 0.08), new THREE.Vector3(4.5, y, 0.08)],
    [new THREE.Vector3(0.08, y, 0.35), new THREE.Vector3(0.08, y, ROOM_DEPTH - 0.4)],
  ];
  for (const [start, end] of runs) {
    const length = start.distanceTo(end);
    const loops = Math.max(1, Math.round(length / span));
    const points: THREE.Vector3[] = [];
    const samples = loops * 12;
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const local = (t * loops) % 1;
      const p = start.clone().lerp(end, t);
      p.y -= sag * 4 * local * (1 - local);
      points.push(p);
    }
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), samples * 2, 0.007, 5), cable);
    group.add(tube);
    for (let i = 2; i < samples; i += 4) {
      const light = new THREE.Mesh(bulbGeometry, bulb);
      light.position.copy(points[i]).add(new THREE.Vector3(0, -0.04, 0));
      group.add(light);
    }
  }
}
