import * as THREE from 'three';
import { addTo, canvasTexture } from '../../game/Room.ts';
import { box, cylinder, mesh, toon, place } from '../../render/materials.ts';
import { PALETTE as C } from '../../render/palette.ts';
import type { RoomContext } from '../../game/Room.ts';
import type { RoomLook } from '../types.ts';

// Decor only: what turns the common office into a media workshop, around the stations. Acoustic
// panels and a tool pegboard on the left wall, a shelf of lenses above the desk, the graphic designer's
// tools on the desk, tape marks on the shooting floor, flight cases beside the green screen,
// a rubber mat in front of the copier.

/** The workshop's shell: pale grey walls over a slate wainscot, and a floor of grey resin tiles. */
export const WORKSHOP_ROOM: RoomLook = {
  wall: C.workshopWall,
  wainscot: C.workshopWainscot,
  floor(g, size) {
    // One square tile per grid tile, so the walking grid still reads at a glance, each a shade apart.
    const tile = size / 2;
    for (let tz = 0; tz < 2; tz++) {
      for (let tx = 0; tx < 2; tx++) {
        const [x, y] = [tx * tile, tz * tile];
        g.fillStyle = C.workshopFloor[(tx + tz * 2) % C.workshopFloor.length];
        g.fillRect(x, y, tile, tile);
        // A soft sheen across the tile, a light bevel on two edges, then the joint.
        const sheen = g.createLinearGradient(x, y, x + tile, y + tile);
        sheen.addColorStop(0, 'rgba(255, 255, 255, 0.14)');
        sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
        g.fillStyle = sheen;
        g.fillRect(x, y, tile, tile);
        g.fillStyle = 'rgba(255, 255, 255, 0.3)';
        g.fillRect(x + 3, y + 3, tile - 6, 3);
        g.fillRect(x + 3, y + 3, 3, tile - 6);
        g.strokeStyle = C.workshopSeam;
        g.lineWidth = 4;
        g.strokeRect(x + 2, y + 2, tile - 4, tile - 4);
      }
    }
  },
};

export function buildWorkshop(ctx: RoomContext) {
  // The pieces against a wall or on the desk cast no shadow: barely visible, and half the draw calls.
  const flat = { ...ctx, group: new THREE.Group() };
  buildAcousticPanels(flat);
  buildPegboard(flat);
  buildLensShelf(flat);
  buildDeskTools(flat);
  buildTapeMarks(flat);
  buildFloorMat(flat);
  flat.group.traverse((child) => (child.castShadow = false));
  ctx.group.add(flat.group);
  buildFlightCases(ctx);
}

/** Hexagonal felt panels between the cork board and the pegboard: the sound booth corner. */
function buildAcousticPanels({ group }: RoomContext) {
  const panels: [number, number, string][] = [
    [2.0, 2.52, C.tealDeep], [1.72, 2.8, C.coral], [1.44, 2.52, C.tealMuted], [2.28, 2.8, C.blush],
  ];
  for (const [y, z, color] of panels) {
    const hex = place(cylinder(0.16, 0.16, 0.05, color, undefined, 6), 0.03, y, z);
    hex.rotation.set(Math.PI / 6, 0, Math.PI / 2, 'XZY');
    group.add(hex);
  }
}

/** Perforated tool board above the copier: headphones, cables and gaffer tape on hooks. */
function buildPegboard({ group }: RoomContext) {
  const z0 = 3.8;
  const holes = canvasTexture(320, 144, (g, w, h) => {
    g.fillStyle = C.aqua;
    g.fillRect(0, 0, w, h);
    g.fillStyle = C.tealMuted;
    for (let y = 10; y < h; y += 20) {
      for (let x = 10; x < w; x += 20) {
        g.beginPath();
        g.arc(x, y, 3.5, 0, Math.PI * 2);
        g.fill();
      }
    }
  });
  const board = place(box(0.03, 0.72, 1.6, '#ffffff', 0.01, { map: holes }), 0.03, 1.74, z0);
  const frame = place(box(0.02, 0.78, 1.66, C.tealMuted, 0.01), 0.015, 1.74, z0);
  group.add(frame, board);

  /** A small hook sticking out of the board at (y, z). */
  const hook = (y: number, z: number) => {
    const peg = place(cylinder(0.012, 0.012, 0.1, C.ink, undefined, 8), 0.09, y, z);
    peg.rotation.z = Math.PI / 2;
    return peg;
  };

  // Headphones, hanging by their band.
  const headphones = place(new THREE.Group(), 0.1, 1.6, z0 - 0.45);
  headphones.rotation.y = Math.PI / 2;
  const band = mesh(new THREE.TorusGeometry(0.15, 0.024, 8, 24, Math.PI), toon(C.ink));
  headphones.add(band);
  for (const side of [-1, 1]) {
    const cup = place(cylinder(0.075, 0.075, 0.07, C.coral), side * 0.15, -0.04, 0);
    cup.rotation.z = Math.PI / 2;
    headphones.add(cup);
  }
  group.add(hook(1.74, z0 - 0.45), headphones);

  // A coiled cable, two loops.
  for (const [dy, dz] of [[0, 0], [-0.03, 0.03]]) {
    const loop = place(mesh(new THREE.TorusGeometry(0.13, 0.018, 8, 28), toon(C.sky)), 0.09, 1.66 + dy, z0 + 0.12 + dz);
    loop.rotation.y = Math.PI / 2;
    group.add(loop);
  }
  group.add(hook(1.8, z0 + 0.12));

  // Gaffer tape rolls, stacked on one peg.
  for (const [y, color] of [[1.88, C.sun], [1.64, C.coral]] as const) {
    const roll = place(cylinder(0.09, 0.09, 0.07, color), 0.1, y, z0 + 0.58);
    roll.rotation.z = Math.PI / 2;
    const core = place(cylinder(0.05, 0.05, 0.072, C.paper), 0.1, y, z0 + 0.58);
    core.rotation.z = Math.PI / 2;
    group.add(roll, core);
  }

  // Steel ruler hung on the edge.
  group.add(place(box(0.015, 0.55, 0.06, '#c9d4dc', 0.005), 0.06, 1.74, z0 - 0.72));
}

/** Wall shelf above the desk: camera lenses and a vintage film camera. */
function buildLensShelf({ group }: RoomContext) {
  const y = 1.58;
  addTo(group,
    place(box(0.86, 0.04, 0.26, C.paper, 0.01), 1.5, y, 0.13),
    place(box(0.03, 0.14, 0.2, C.tealMuted, 0.01), 1.15, y - 0.09, 0.1),
    place(box(0.03, 0.14, 0.2, C.tealMuted, 0.01), 1.85, y - 0.09, 0.1),
  );
  // Two lenses standing on their mount, glass up.
  for (const [x, height, radius, ring] of [[1.2, 0.22, 0.075, C.coral], [1.4, 0.14, 0.07, C.sun]] as const) {
    addTo(group,
      place(cylinder(radius, radius, height, C.ink), x, y + 0.02 + height / 2, 0.14),
      place(cylinder(radius + 0.005, radius + 0.005, 0.025, ring), x, y + 0.02 + height * 0.7, 0.14),
      place(cylinder(radius - 0.015, radius - 0.015, 0.006, C.aqua, { emissive: C.teal, emissiveIntensity: 0.4 }), x, y + 0.02 + height, 0.14),
    );
  }
  // Film camera: silver top, ink leatherette, lens to the front.
  const film = place(new THREE.Group(), 1.7, y + 0.02, 0.14);
  const lens = place(cylinder(0.05, 0.05, 0.07, C.ink), 0, 0.08, 0.08);
  lens.rotation.x = Math.PI / 2;
  film.add(
    place(box(0.26, 0.15, 0.1, C.ink, 0.02), 0, 0.075, 0),
    place(box(0.26, 0.04, 0.1, '#dfe7ee', 0.015), 0, 0.15, 0),
    place(box(0.07, 0.05, 0.08, '#dfe7ee', 0.01), 0, 0.18, 0),
    lens,
    place(cylinder(0.035, 0.035, 0.008, C.aqua, { emissive: C.teal, emissiveIntensity: 0.4 }), 0, 0.08, 0.118).rotateX(Math.PI / 2),
  );
  group.add(film);
}

/** The graphic designer's tools next to the laptop: a fan of colour swatches and a drawing tablet. */
function buildDeskTools({ group }: RoomContext) {
  const top = 0.78;
  const fan = place(new THREE.Group(), 2.0, top, 0.86);
  [C.coral, C.sun, C.leaf, C.teal, C.sky, C.lilac].forEach((color, i) => {
    const arm = place(new THREE.Group(), 0, 0.005 + i * 0.007, 0);
    arm.rotation.y = -0.55 + i * 0.2;
    arm.add(place(box(0.055, 0.006, 0.26, color, 0.002), 0, 0, -0.12));
    fan.add(arm);
  });
  fan.add(place(cylinder(0.012, 0.012, 0.05, C.ink, undefined, 8), 0, 0.02, 0));
  group.add(fan);

  const tablet = place(new THREE.Group(), 3.24, top, 0.55);
  tablet.rotation.y = -0.15;
  const pen = place(cylinder(0.012, 0.008, 0.26, C.coral, undefined, 10), 0.02, 0.03, 0.2);
  pen.rotation.set(Math.PI / 2, 0, 0.9);
  tablet.add(
    place(box(0.36, 0.02, 0.28, C.ink, 0.01), 0, 0.01, 0),
    place(box(0.26, 0.004, 0.2, C.inkSoft, 0.002, { emissive: C.teal, emissiveIntensity: 0.15 }), 0.03, 0.021, 0),
    place(box(0.03, 0.006, 0.03, C.teal, 0.004), -0.14, 0.022, -0.06),
    place(box(0.03, 0.006, 0.03, C.coral, 0.004), -0.14, 0.022, 0.0),
    place(box(0.03, 0.006, 0.03, C.sun, 0.004), -0.14, 0.022, 0.06),
    pen,
  );
  group.add(tablet);
}

/** Gaffer tape marks on the green sweep, in front of the product: where the next one goes. */
function buildTapeMarks({ group }: RoomContext) {
  for (const angle of [Math.PI / 4, -Math.PI / 4]) {
    const tape = place(box(0.3, 0.004, 0.05, C.sun, 0.001), 5.15, 0.018, 1.15);
    tape.rotation.y = angle;
    group.add(tape);
  }
}

/** Two hard cases for the gear, stacked beside the green screen, a cable coiled on top. */
function buildFlightCases({ group, grid }: RoomContext) {
  const stack = place(new THREE.Group(), 6.5, 0, 1.75);
  stack.rotation.y = -Math.PI / 2 + 0.15;
  const cornerColor = '#dfe7ee';
  const hardCase = (w: number, h: number, d: number, y: number, color: string) => {
    const parts: THREE.Object3D[] = [place(box(w, h, d, color, 0.04), 0, y + h / 2, 0)];
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        parts.push(place(box(0.08, h + 0.01, 0.08, cornerColor, 0.02), sx * (w / 2 - 0.03), y + h / 2, sz * (d / 2 - 0.03)));
      }
    }
    // Latches and the handle on the front (+Z).
    parts.push(
      place(box(0.07, 0.06, 0.02, cornerColor, 0.008), -w / 4, y + h * 0.7, d / 2 + 0.01),
      place(box(0.07, 0.06, 0.02, cornerColor, 0.008), w / 4, y + h * 0.7, d / 2 + 0.01),
      place(box(0.2, 0.035, 0.03, C.ink, 0.012), 0, y + h * 0.4, d / 2 + 0.015),
    );
    return parts;
  };
  addTo(stack, ...(hardCase(0.8, 0.38, 0.6, 0, C.tealDeep) as [THREE.Object3D]));
  addTo(stack, ...(hardCase(0.6, 0.26, 0.46, 0.38, C.coral) as [THREE.Object3D]));
  // A round sticker on the big case's side and an XLR cable on top.
  const sticker = place(cylinder(0.07, 0.07, 0.006, C.sun), 0.402, 0.2, 0.05);
  sticker.rotation.z = Math.PI / 2;
  const coil = place(mesh(new THREE.TorusGeometry(0.13, 0.02, 8, 28), toon(C.ink)), 0, 0.665, 0);
  coil.rotation.x = Math.PI / 2;
  stack.add(sticker, coil);
  group.add(stack);
  grid.block([6, 1]);
}

/** Ribbed rubber mat in front of the copier and its tool board. */
function buildFloorMat({ group }: RoomContext) {
  const ribs = canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = C.tealDeep;
    g.fillRect(0, 0, w, h);
    g.fillStyle = C.tealMuted;
    for (let x = 4; x < w; x += 16) g.fillRect(x, 6, 8, h - 12);
  });
  const mat = place(box(0.85, 0.012, 1.1, '#ffffff', 0.004, { map: ribs }), 1.35, 0.007, 3.7);
  group.add(mat);
}
