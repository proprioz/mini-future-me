import * as THREE from 'three';
import { addTo, canvasTexture, makeInteractable } from '../../game/Room.ts';
import { box, cylinder, sphere, mesh, toon, place } from '../../render/materials.ts';
import { PALETTE as C } from '../../render/palette.ts';
import { fontsReady } from '../../ui/fonts.ts';
import { drawIcon } from '../../ui/icons.ts';
import { drawStudioView, productView, drawPoster, onBackdropChange } from './artwork.ts';
import type { RoomContext } from '../../game/Room.ts';

// The work stations of the media office, added to the common room by `buildStations()`: the desk and
// its laptop against the back wall, the photo corner, the copier on the left wall, and the influencer
// set-up in front (decor only).

export function buildStations(ctx: RoomContext) {
  buildDesk(ctx);
  buildPhotoCorner(ctx);
  buildPrinter(ctx);
  buildPhoneCorner(ctx);
}

/**
 * Texture showing the campaign's artwork (photo, poster). The artwork has text, so it is drawn once
 * the fonts are loaded; `placeholder` fills the canvas until then.
 */
function artTexture(
  width: number, height: number, placeholder: string, draw: (g: CanvasRenderingContext2D, width: number, height: number) => void,
) {
  const texture = canvasTexture(width, height, (g) => {
    g.fillStyle = placeholder;
    g.fillRect(0, 0, width, height);
  });
  const paint = () => {
    draw(texture.image.getContext('2d')!, width, height);
    texture.needsUpdate = true;
  };
  fontsReady().then(paint);
  // The screens and prints show the campaign photo: repainted when the retouch gives it a new backdrop.
  onBackdropChange(paint);
  return texture;
}

/** 💻 Desk against the back wall, with a big laptop showing the photo being retouched. */
function buildDesk(ctx: RoomContext) {
  const { group, grid } = ctx;
  const desk = new THREE.Group();

  desk.add(place(box(1.9, 0.08, 0.9, C.paper, 0.02), 2.5, 0.74, 0.5));
  for (const [x, z] of [[1.62, 0.12], [3.38, 0.12], [1.62, 0.88], [3.38, 0.88]]) {
    desk.add(place(box(0.08, 0.7, 0.08, C.tealMuted, 0.02), x, 0.35, z));
  }

  // Oversized on purpose, like everything you can use in the room.
  const laptop = place(new THREE.Group(), 2.6, 0.78, 0.5);
  laptop.add(
    place(box(0.86, 0.04, 0.56, '#dfe7ee', 0.015), 0, 0.02, 0),
    place(box(0.74, 0.008, 0.26, C.inkSoft, 0.003), 0, 0.042, -0.07),
    place(box(0.26, 0.008, 0.14, '#c9d4dc', 0.003), 0, 0.042, 0.17),
  );
  const screen = artTexture(320, 200, C.ink, (g, w, h) => {
    // A photo editor: the shoot's photo in the middle, tools on the left, sliders on the right.
    g.fillStyle = C.ink;
    g.fillRect(0, 0, w, h);
    g.fillStyle = C.teal;
    g.fillRect(0, 0, w, 18);
    g.fillStyle = C.inkSoft;
    for (let i = 0; i < 5; i++) g.fillRect(8, 30 + i * 30, 22, 22);
    drawStudioView(g, productView(1.4, 0.7), 40, 28, 200, 143);
    for (let i = 0; i < 3; i++) {
      g.fillStyle = C.inkSoft;
      g.fillRect(252, 44 + i * 40, 58, 6);
      g.fillStyle = [C.sun, C.coral, C.teal][i];
      g.beginPath();
      g.arc(262 + i * 18, 47 + i * 40, 8, 0, Math.PI * 2);
      g.fill();
    }
  });
  const lid = place(new THREE.Group(), 0, 0.04, -0.28);
  lid.rotation.x = -0.22;
  lid.add(
    place(box(0.86, 0.56, 0.03, '#dfe7ee', 0.015), 0, 0.28, 0),
    place(box(0.78, 0.48, 0.006, '#ffffff', 0.002, { map: screen, emissive: '#ffffff', emissiveMap: screen, emissiveIntensity: 0.6 }), 0, 0.28, 0.018),
  );
  laptop.add(lid);
  desk.add(laptop);

  // Mug and desk lamp.
  desk.add(place(cylinder(0.06, 0.055, 0.14, C.sun), 1.85, 0.85, 0.7));
  const handle = place(mesh(new THREE.TorusGeometry(0.035, 0.012, 8, 16), toon(C.sun)), 1.91, 0.85, 0.7);
  handle.rotation.y = Math.PI / 2;
  desk.add(handle);

  const lamp = place(new THREE.Group(), 1.8, 0.78, 0.22);
  lamp.add(
    place(cylinder(0.09, 0.1, 0.03, C.ink), 0, 0.015, 0),
    place(cylinder(0.014, 0.014, 0.48, C.ink), 0, 0.25, 0),
  );
  const shade = place(cylinder(0.04, 0.12, 0.14, C.coral, { emissive: C.blush, emissiveIntensity: 0.25 }), 0.07, 0.49, 0.05);
  shade.rotation.z = -0.6;
  lamp.add(shade);
  desk.add(lamp);

  group.add(desk);
  grid.block([1, 0], [2, 0], [3, 0]);
  makeInteractable(ctx, desk, {
    id: 'laptop',
    label: 'Laptop',
    icon: 'laptop',
    useTile: { x: 2, z: 1 },
    focus: new THREE.Vector3(2.6, 1.2, 0.4),
    hitbox: { size: [2.0, 1.5, 1.0], at: [2.5, 0.75, 0.5] },
  });

  // Office chair, pushed aside.
  const chair = place(new THREE.Group(), 3.45, 0, 1.35);
  chair.rotation.y = -0.5;
  chair.add(
    place(cylinder(0.22, 0.24, 0.03, C.ink), 0, 0.03, 0),
    place(cylinder(0.03, 0.03, 0.42, C.ink), 0, 0.24, 0),
    place(box(0.48, 0.08, 0.46, C.coral, 0.03), 0, 0.48, 0),
    place(box(0.48, 0.5, 0.07, C.coral, 0.03), 0, 0.8, -0.22),
  );
  group.add(chair);
  grid.block([3, 1]);
}

/** 📷 Photo corner: green screen, the lemonade bottle on a pedestal, softbox and camera on tripod. */
function buildPhotoCorner(ctx: RoomContext) {
  const { group, grid } = ctx;
  const paper = C.chroma;
  const cx = 5.8; // centre of the backdrop

  // Green screen sweeping from the wall onto the floor, keyed out after the shoot.
  const sweepRadius = 0.35;
  const curve = mesh(
    new THREE.CylinderGeometry(sweepRadius, sweepRadius, 2.2, 20, 1, true, Math.PI, Math.PI / 2),
    toon(paper, { side: THREE.DoubleSide }),
  );
  curve.rotation.z = Math.PI / 2;
  curve.position.set(cx, sweepRadius, 0.07 + sweepRadius);
  const roll = place(cylinder(0.07, 0.07, 2.4, C.ink), cx, 2.35, 0.12);
  roll.rotation.z = Math.PI / 2;
  addTo(group,
    place(box(2.2, 1.95, 0.03, paper, 0.005), cx, sweepRadius + 0.975, 0.07),
    curve,
    place(box(2.2, 0.015, 0.9, paper, 0.005), cx, 0.008, 0.42 + 0.45),
    roll,
  );

  // The product on a pedestal: a big lemonade bottle, the subject of the photo shoot.
  addTo(group,
    place(box(0.55, 0.5, 0.55, C.paper, 0.03), cx, 0.25, 0.75),
    place(cylinder(0.12, 0.13, 0.42, C.teal), cx, 0.71, 0.75),
    place(cylinder(0.131, 0.131, 0.14, C.coral), cx, 0.68, 0.75),
    place(cylinder(0.05, 0.11, 0.12, C.teal), cx, 0.98, 0.75),
    place(cylinder(0.055, 0.055, 0.08, C.ink), cx, 1.07, 0.75),
    place(sphere(0.1, C.sun), cx + 0.2, 0.58, 0.85),
  );
  grid.block([5, 0], [6, 0]);

  // Softbox aimed at the product.
  const softbox = place(new THREE.Group(), 6.55, 0, 1.75);
  softbox.add(
    place(cylinder(0.18, 0.2, 0.03, C.ink), 0, 0.015, 0),
    place(cylinder(0.02, 0.02, 1.55, C.ink), 0, 0.8, 0),
  );
  const head = place(new THREE.Group(), 0, 1.6, 0);
  head.rotation.set(0.25, Math.atan2(cx - 6.55, 0.75 - 1.75), 0, 'YXZ');
  head.add(
    place(box(0.55, 0.55, 0.3, C.ink, 0.04), 0, 0, 0),
    place(box(0.5, 0.5, 0.02, C.paper, 0.005, { emissive: '#fff6e6', emissiveIntensity: 0.9 }), 0, 0, 0.16),
  );
  softbox.add(head);
  group.add(softbox);
  grid.block([6, 1]);

  // Camera on tripod, looking at the product (-Z). Big enough to be recognised from across the room.
  const camera = place(new THREE.Group(), cx, 0, 2.5);
  camera.scale.setScalar(1.4);
  for (let i = 0; i < 3; i++) {
    const holder = place(new THREE.Group(), 0, 0.85, 0);
    holder.rotation.y = (i * Math.PI * 2) / 3 + Math.PI / 6;
    const tilt = new THREE.Group();
    tilt.rotation.x = 0.28;
    tilt.add(place(cylinder(0.02, 0.02, 0.88, C.ink, undefined, 8), 0, -0.44, 0));
    holder.add(tilt);
    camera.add(holder);
  }
  const lens = place(cylinder(0.085, 0.095, 0.2, C.inkSoft), 0, 1.15, -0.17);
  lens.rotation.x = Math.PI / 2;
  const glass = place(cylinder(0.065, 0.065, 0.01, C.aqua, { emissive: C.teal, emissiveIntensity: 0.4 }), 0, 1.15, -0.275);
  glass.rotation.x = Math.PI / 2;
  camera.add(
    place(cylinder(0.025, 0.025, 0.2, C.ink), 0, 0.93, 0),
    place(box(0.12, 0.05, 0.12, C.ink, 0.01), 0, 1.02, 0),
    place(box(0.38, 0.24, 0.17, C.ink, 0.03), 0, 1.16, 0),
    place(box(0.13, 0.08, 0.11, C.ink, 0.02), 0, 1.31, 0.01),
    place(cylinder(0.02, 0.02, 0.025, C.coral), 0.12, 1.29, 0.02),
    place(box(0.22, 0.14, 0.006, C.ink, 0.002, { emissive: C.teal, emissiveIntensity: 0.6 }), 0, 1.17, 0.087),
    lens,
    glass,
  );
  group.add(camera);
  grid.block([5, 2]);
  makeInteractable(ctx, camera, {
    id: 'camera',
    label: 'Appareil photo',
    icon: 'camera',
    useTile: { x: 5, z: 3 },
    focus: new THREE.Vector3(cx, 1.65, 2.5),
    hitbox: { size: [0.9, 2.0, 0.9], at: [cx, 1.0, 2.5] },
  });
}

/**
 * 🖨️ Office copier standing on the floor, against the left wall and facing the room: three paper
 * drawers, the printed poster waiting in the output bay, scanner with its document feeder on top,
 * touch screen, and the manual bypass tray folded out on the visible side.
 */
function buildPrinter(ctx: RoomContext) {
  const { group, grid } = ctx;
  const z0 = 3.7;
  const printer = place(new THREE.Group(), 0, 0, z0);
  const body = '#f3f6f8';
  const trimColor = '#c9d4dc';
  const drawerColor = '#e2e9ee';
  const D = 0.78; // depth (X)
  const W = 1.04; // width (Z)
  const cx = 0.45;
  const front = cx + D / 2;

  // Plinth, paper deck with three drawers (handle and paper-level window each), print engine.
  printer.add(
    place(box(D - 0.06, 0.08, W - 0.06, C.inkSoft, 0.02), cx, 0.04, 0),
    place(box(D, 0.48, W, body, 0.04), cx, 0.32, 0),
    place(box(D, 0.32, W, body, 0.04), cx, 0.72, 0),
  );
  for (let i = 0; i < 3; i++) {
    const y = 0.16 + i * 0.16;
    printer.add(
      place(box(0.025, 0.145, W - 0.06, drawerColor, 0.01), front + 0.005, y, 0),
      place(box(0.02, 0.03, 0.34, C.inkSoft, 0.01), front + 0.02, y + 0.03, -0.1),
      place(box(0.01, 0.07, 0.07, C.paper, 0.003), front + 0.02, y, 0.38),
    );
  }

  // Engine front: the four CMYK toner tabs and a teal stripe under the output bay.
  ['#00b4d8', '#ec2f8b', '#ffd23f', '#1b1b24'].forEach((color, i) => {
    printer.add(place(box(0.02, 0.1, 0.07, color, 0.008), front + 0.005, 0.72, 0.1 + i * 0.1));
  });
  printer.add(place(box(0.02, 0.025, W - 0.04, C.teal, 0.008), front + 0.005, 0.865, 0));

  // Output bay, open at the front and on the side: a back wall and a column hold up the scanner.
  printer.add(
    place(box(0.14, 0.2, W, body, 0.03), 0.13, 0.98, 0),
    place(box(D, 0.2, 0.18, body, 0.03), cx, 0.98, -W / 2 + 0.09),
    place(box(D - 0.16, 0.02, W - 0.2, trimColor, 0.008), cx + 0.07, 0.89, 0.09),
  );
  // The freshly printed poster in the bay.
  const poster = artTexture(210, 297, C.sun, (g, w, h) => drawPoster(g, w, h));
  const sheet = place(box(0.3, 0.006, 0.42, '#ffffff', 0.002, { map: poster }), cx + 0.2, 0.904, 0.14);
  sheet.rotation.y = 0.08;
  printer.add(sheet);

  // Scanner, document feeder with originals waiting on top.
  printer.add(
    place(box(D, 0.1, W, body, 0.03), cx, 1.13, 0),
    place(box(D - 0.04, 0.06, W - 0.04, drawerColor, 0.02), cx, 1.21, 0),
    place(box(D - 0.1, 0.1, 0.22, trimColor, 0.03), cx - 0.02, 1.26, -W / 2 + 0.13),
    place(box(0.46, 0.03, 0.56, C.paper, 0.004), cx - 0.02, 1.255, 0.12),
  );

  // Touch screen on an arm, tilted towards whoever stands in front.
  const panel = place(new THREE.Group(), front + 0.06, 1.12, -0.24);
  panel.rotation.z = -0.75;
  panel.add(
    place(box(0.2, 0.04, 0.4, C.ink, 0.015), 0, 0, 0),
    place(box(0.15, 0.01, 0.28, C.aqua, 0.003, { emissive: C.teal, emissiveIntensity: 0.8 }), 0, 0.022, -0.03),
    place(cylinder(0.024, 0.024, 0.02, C.leaf), 0, 0.025, 0.15),
  );
  printer.add(panel);

  // Manual bypass tray folded out of the side, a sheet in it between its two guides.
  const bypass = place(new THREE.Group(), cx + 0.08, 0.7, W / 2);
  bypass.rotation.x = 0.3;
  bypass.add(
    place(box(0.56, 0.06, 0.04, trimColor, 0.015), 0, 0, 0.01),
    place(box(0.5, 0.02, 0.36, trimColor, 0.008), 0, 0, 0.2),
    place(box(0.4, 0.015, 0.14, drawerColor, 0.006), 0, 0.002, 0.43),
    place(box(0.34, 0.006, 0.36, C.paper, 0.002), 0, 0.014, 0.22),
    place(box(0.02, 0.05, 0.22, C.inkSoft, 0.006), -0.19, 0.03, 0.16),
    place(box(0.02, 0.05, 0.22, C.inkSoft, 0.006), 0.19, 0.03, 0.16),
  );
  printer.add(bypass);

  group.add(printer);
  grid.block([0, 3], [0, 4]);
  makeInteractable(ctx, printer, {
    id: 'printer',
    label: 'Imprimante',
    icon: 'printer',
    useTile: { x: 1, z: 3 },
    focus: new THREE.Vector3(0.5, 1.35, z0),
    hitbox: { size: [1.2, 1.6, 1.7], at: [0.55, 0.8, z0 + 0.15] },
  });
}

/** 📱 A big smartphone in a ring light on its stand, the influencer set-up: decor only. */
function buildPhoneCorner(ctx: RoomContext) {
  const { group, grid } = ctx;
  const stand = place(new THREE.Group(), 4.5, 0, 4.45);
  stand.scale.setScalar(1.25);
  // The ring and the screen face the camera.
  stand.rotation.y = Math.PI / 4;

  for (let i = 0; i < 3; i++) {
    const holder = place(new THREE.Group(), 0, 0.55, 0);
    holder.rotation.y = (i * Math.PI * 2) / 3;
    const tilt = new THREE.Group();
    tilt.rotation.x = 0.35;
    tilt.add(place(cylinder(0.018, 0.018, 0.6, C.ink, undefined, 8), 0, -0.29, 0));
    holder.add(tilt);
    stand.add(holder);
  }
  stand.add(place(cylinder(0.02, 0.02, 0.75, C.ink), 0, 0.9, 0));

  const ring = place(mesh(new THREE.TorusGeometry(0.36, 0.045, 12, 40), toon('#fff4dc', { emissive: '#ffe2a8', emissiveIntensity: 0.9 })), 0, 1.4, 0);
  const screen = artTexture(150, 270, C.blush, (g, w, h) => {
    // A post being published: profile bar, the photo, likes.
    g.fillStyle = C.paper;
    g.fillRect(0, 0, w, h);
    g.fillStyle = C.coral;
    g.beginPath();
    g.arc(22, 26, 12, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = C.mist;
    g.fillRect(42, 20, 80, 12);
    drawStudioView(g, productView(1, 0.8), 0, 50, w, w);
    drawIcon(g, 'heart', 8, 212, 30, { ink: C.coral });
    g.fillStyle = C.mist;
    g.fillRect(48, 218, 80, 10);
    g.fillRect(48, 236, 56, 10);
  });
  stand.add(
    ring,
    place(box(0.24, 0.44, 0.04, C.ink, 0.04), 0, 1.4, 0.01),
    place(box(0.2, 0.39, 0.006, '#ffffff', 0.002, { map: screen, emissive: '#ffffff', emissiveMap: screen, emissiveIntensity: 0.5 }), 0, 1.4, 0.033),
    place(box(0.06, 0.04, 0.04, C.ink, 0.01), 0, 1.15, 0),
  );
  group.add(stand);
  grid.block([4, 4]);

}
