import { PALETTE as C } from '../../render/palette.ts';

// Procedural artwork shared by the mini-games: the product photo shoot of "Pétille", the
// lemonade brand that orders the whole campaign, and the poster made from it.

/** The photo studio, in scene units (drawn 1:1 into a cached canvas). */
export const SCENE = { w: 1600, h: 1000 };
/** Centre of the bottle's label: what the photographer frames and focuses on. */
export const PRODUCT = { x: 1060, y: 600 };
const BOTTLE_BOTTOM = 704;
/** The bottle's bounding box, cap included: what the framing must keep inside the centre box. */
export const BOTTLE = { x: PRODUCT.x - 65, y: BOTTLE_BOTTOM - 300, w: 130, h: 300 };

// The shoot happens on a green screen; the green is keyed out, and the retouch puts the product on
// one of the backdrops below. That composite is the photo every later task works with.
type Draw = (g: CanvasRenderingContext2D) => void;

/** A rectangle of the scene, in scene units. */
export interface View {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Backdrop {
  id: string;
  label: string;
  draw: Draw;
}

const layers: Record<string, HTMLCanvasElement> = {};

function layer(name: string, draw: Draw) {
  if (!layers[name]) {
    const canvas = document.createElement('canvas');
    canvas.width = SCENE.w;
    canvas.height = SCENE.h;
    draw(canvas.getContext('2d')!);
    layers[name] = canvas;
  }
  return layers[name];
}

/** The product on its pedestal, on a transparent background: what is left once the green is keyed out. */
export function productCanvas() {
  return layer('product', drawSet);
}

/** The green screen alone, lit by the softbox. */
export function greenCanvas() {
  return layer('green', drawGreenScreen);
}

/** The set as the camera sees it: the product in front of the green screen. */
export function greenScreenCanvas() {
  return layer('greenScreen', (g) => {
    g.drawImage(greenCanvas(), 0, 0);
    g.drawImage(productCanvas(), 0, 0);
  });
}

/** The backdrops the retouch offers. The brand's yellow paper is used until the visitor picks one. */
export const BACKDROPS: Backdrop[] = [
  { id: 'sun', label: 'Jaune', draw: drawPaperBackdrop },
  { id: 'lagoon', label: 'Lagon', draw: drawLagoonBackdrop },
  { id: 'bubbles', label: 'Bulles', draw: drawBubblesBackdrop },
  { id: 'night', label: 'Nuit', draw: drawNightBackdrop },
];
let backdropId = 'sun';
const backdropListeners = new Set<(id: string) => void>();

export function backdropCanvas(id = backdropId) {
  return layer(`backdrop-${id}`, BACKDROPS.find((b) => b.id === id)!.draw);
}

/** Picks the backdrop of the photo for the rest of the campaign. */
export function setBackdrop(id: string) {
  if (id === backdropId) return;
  backdropId = id;
  for (const fn of backdropListeners) fn(id);
}

/** Calls `fn(id)` whenever the photo's backdrop changes (screens in the room that show the photo). */
export function onBackdropChange(fn: (id: string) => void) {
  backdropListeners.add(fn);
}

/** The finished photo: the product on a backdrop. Call after `fontsReady()` (the label has text). */
export function studioCanvas(id = backdropId) {
  return layer(`studio-${id}`, (g) => {
    g.drawImage(backdropCanvas(id), 0, 0);
    g.drawImage(productCanvas(), 0, 0);
  });
}

/** Draws the `view` rectangle of the scene (scene units) into the destination rectangle. */
export function drawStudioView(g: CanvasRenderingContext2D, view: View, dx: number, dy: number, dw: number, dh: number) {
  g.drawImage(studioCanvas(), view.x, view.y, view.w, view.h, dx, dy, dw, dh);
}

/** The grey-and-white checkerboard image editors show where a picture is transparent. */
export function drawChecker(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, size: number) {
  g.fillStyle = '#fff';
  g.fillRect(x, y, w, h);
  g.fillStyle = '#dde6ea';
  for (let j = 0; j * size < h; j++) {
    for (let i = j % 2; i * size < w; i += 2) {
      g.fillRect(x + i * size, y + j * size, Math.min(size, w - i * size), Math.min(size, h - j * size));
    }
  }
}

/** Largest view of the given aspect (w / h) around the product, kept inside the scene. */
export function productView(aspect: number, fill = 0.92) {
  let h = SCENE.h * fill;
  let w = h * aspect;
  if (w > SCENE.w * fill) {
    w = SCENE.w * fill;
    h = w / aspect;
  }
  return clampView({ x: PRODUCT.x - w / 2, y: PRODUCT.y - h * 0.55, w, h });
}

export function clampView(view: View) {
  view.x = Math.min(Math.max(view.x, 0), SCENE.w - view.w);
  view.y = Math.min(Math.max(view.y, 0), SCENE.h - view.h);
  return view;
}

function ellipse(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string) {
  g.fillStyle = fill;
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  g.fill();
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string) {
  g.fillStyle = fill;
  g.beginPath();
  g.roundRect(x, y, w, h, r);
  g.fill();
}

function drawGreenScreen(g: CanvasRenderingContext2D) {
  const { w, h } = SCENE;
  const screen = g.createLinearGradient(0, 0, 0, h);
  screen.addColorStop(0, '#52d07f');
  screen.addColorStop(0.7, C.chroma);
  screen.addColorStop(1, '#2fae5c');
  g.fillStyle = screen;
  g.fillRect(0, 0, w, h);
  const glow = g.createRadialGradient(PRODUCT.x, 520, 0, PRODUCT.x, 520, 650);
  glow.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
  glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, w, h);
}

/** The brand's paper backdrop and props. */
function drawPaperBackdrop(g: CanvasRenderingContext2D) {
  const { w, h } = SCENE;

  // Paper backdrop, brighter where the softbox hits it.
  const paper = g.createLinearGradient(0, 0, 0, h);
  paper.addColorStop(0, '#ffdb73');
  paper.addColorStop(0.7, C.sun);
  paper.addColorStop(1, '#f4b42a');
  g.fillStyle = paper;
  g.fillRect(0, 0, w, h);
  const glow = g.createRadialGradient(PRODUCT.x, 520, 0, PRODUCT.x, 520, 650);
  glow.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
  glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, w, h);

  // Wes Anderson-ish props: a big blush disc and a teal arch on the backdrop.
  ellipse(g, 470, 360, 190, 190, C.blush);
  ellipse(g, 470, 360, 120, 120, '#ffb8c6');
  g.fillStyle = C.aqua;
  g.beginPath();
  g.moveTo(1380, 720);
  g.lineTo(1380, 330);
  g.arc(1480, 330, 100, Math.PI, 0);
  g.lineTo(1580, 720);
  g.fill();
  g.fillStyle = 'rgba(255, 255, 255, 0.18)';
  g.fillRect(0, 760, w, h - 760);

  drawPlant(g, 260, 1000);
}

/** Summer by the lagoon: a big sun, a teal sea with foam lines, a sand floor. */
function drawLagoonBackdrop(g: CanvasRenderingContext2D) {
  const { w, h } = SCENE;
  const sky = g.createLinearGradient(0, 0, 0, 600);
  sky.addColorStop(0, C.aqua);
  sky.addColorStop(1, C.mist);
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  ellipse(g, 640, 420, 120, 120, '#ffe08a');
  ellipse(g, 640, 420, 90, 90, C.sun);
  for (const [x, y, s] of [[1270, 330, 1], [450, 300, 0.7], [900, 170, 0.6]]) {
    ellipse(g, x, y, 90 * s, 34 * s, C.paper);
    ellipse(g, x - 50 * s, y + 6 * s, 54 * s, 26 * s, C.paper);
    ellipse(g, x + 56 * s, y + 8 * s, 48 * s, 22 * s, C.paper);
  }
  g.fillStyle = C.teal;
  g.fillRect(0, 560, w, 220);
  g.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  g.lineWidth = 6;
  g.lineCap = 'round';
  for (const [y, offset] of [[600, 0], [650, 90], [705, 40], [750, 130]]) {
    for (let x = offset - 200; x < w; x += 260) {
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + 40, y - 14, x + 80, y);
      g.stroke();
    }
  }
  g.fillStyle = '#f6dfb4';
  g.fillRect(0, 760, w, h - 760);
}

/** Pink fizz: soft bubbles rising on blush, like the lemonade itself. */
function drawBubblesBackdrop(g: CanvasRenderingContext2D) {
  const { w, h } = SCENE;
  const pink = g.createLinearGradient(0, 0, 0, h);
  pink.addColorStop(0, '#ffd3dc');
  pink.addColorStop(1, C.blush);
  g.fillStyle = pink;
  g.fillRect(0, 0, w, h);
  // Fixed pseudo-random bubbles, so every render is the same.
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 46; i++) {
    const x = rand() * w;
    const y = rand() * 760;
    const r = 14 + rand() ** 2 * 90;
    ellipse(g, x, y, r, r, 'rgba(255, 255, 255, 0.35)');
    ellipse(g, x - r * 0.35, y - r * 0.35, r * 0.22, r * 0.22, 'rgba(255, 255, 255, 0.7)');
  }
  g.fillStyle = C.coral;
  g.fillRect(0, 760, w, h - 760);
}

/** Night sky: navy, stars and a crescent moon, so the bright bottle pops. */
function drawNightBackdrop(g: CanvasRenderingContext2D) {
  const { w, h } = SCENE;
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#16303f');
  sky.addColorStop(1, C.tealDeep);
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  let seed = 3;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 70; i++) {
    const r = 2 + rand() * 4;
    ellipse(g, rand() * w, rand() * 720, r, r, `rgba(255, 244, 194, ${0.5 + rand() * 0.5})`);
  }
  // Crescent: the moon's disc minus a shifted one.
  g.save();
  g.beginPath();
  g.arc(1260, 380, 80, 0, Math.PI * 2);
  g.clip();
  g.beginPath();
  g.rect(0, 0, w, h);
  g.arc(1296, 352, 72, 0, Math.PI * 2);
  g.fillStyle = '#fff4c2';
  g.fill('evenodd');
  g.restore();
  g.fillStyle = 'rgba(255, 255, 255, 0.08)';
  g.fillRect(0, 760, w, h - 760);
}

/** The pedestal, the bottle and the lemons: the subject, the same on the green screen and on the poster. */
function drawSet(g: CanvasRenderingContext2D) {
  drawPedestal(g, PRODUCT.x, BOTTLE_BOTTOM);
  drawLemon(g, 935, BOTTLE_BOTTOM - 26);
  drawSlice(g, 1190, BOTTLE_BOTTOM - 38);
  drawBottle(g, PRODUCT.x, BOTTLE_BOTTOM);
}

function drawPlant(g: CanvasRenderingContext2D, x: number, bottom: number) {
  const leaves = [[-70, -330, 0.5], [60, -360, -0.4], [-10, -420, 0.1], [-110, -250, 0.9], [100, -270, -0.8]];
  for (const [dx, dy, angle] of leaves) {
    g.save();
    g.translate(x + dx * 0.4, bottom - 200);
    g.rotate(angle);
    ellipse(g, 0, dy * 0.45, 46, 120, angle > 0 ? C.leaf : '#2d9470');
    g.restore();
  }
  roundRect(g, x - 90, bottom - 220, 180, 220, 24, C.paper);
  roundRect(g, x - 90, bottom - 220, 180, 34, 14, '#e6f4f2');
}

function drawPedestal(g: CanvasRenderingContext2D, cx: number, top: number) {
  roundRect(g, cx - 200, top, 400, SCENE.h - top + 20, 18, '#f4fbfa');
  g.fillStyle = 'rgba(30, 58, 76, 0.07)';
  g.fillRect(cx + 110, top + 20, 90, SCENE.h - top);
  roundRect(g, cx - 206, top - 4, 412, 26, 12, C.paper);
}

function drawLemon(g: CanvasRenderingContext2D, x: number, y: number) {
  ellipse(g, x + 10, y + 26, 60, 9, 'rgba(120, 70, 0, 0.16)');
  ellipse(g, x, y, 62, 44, '#ffd23f');
  ellipse(g, x - 66, y, 10, 8, '#f2b705');
  ellipse(g, x - 18, y - 16, 20, 10, 'rgba(255, 255, 255, 0.55)');
}

function drawSlice(g: CanvasRenderingContext2D, x: number, y: number) {
  ellipse(g, x + 6, y + 38, 40, 7, 'rgba(120, 70, 0, 0.16)');
  ellipse(g, x, y, 42, 42, '#f2b705');
  ellipse(g, x, y, 36, 36, '#fff4c2');
  ellipse(g, x, y, 31, 31, '#ffe066');
  g.strokeStyle = '#fff4c2';
  g.lineWidth = 3;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * 31, y + Math.sin(a) * 31);
    g.stroke();
  }
}

function drawBottle(g: CanvasRenderingContext2D, cx: number, by: number) {
  const height = 300;
  const bodyW = 130;
  const neckW = 54;
  const top = by - height;

  ellipse(g, cx + 24, by + 6, 100, 14, 'rgba(120, 70, 0, 0.2)');

  g.save();
  g.beginPath();
  g.moveTo(cx - neckW / 2, top + 26);
  g.lineTo(cx - neckW / 2, top + 80);
  g.bezierCurveTo(cx - neckW / 2, top + 110, cx - bodyW / 2, top + 112, cx - bodyW / 2, top + 150);
  g.lineTo(cx - bodyW / 2, by - 18);
  g.quadraticCurveTo(cx - bodyW / 2, by, cx - bodyW / 2 + 18, by);
  g.lineTo(cx + bodyW / 2 - 18, by);
  g.quadraticCurveTo(cx + bodyW / 2, by, cx + bodyW / 2, by - 18);
  g.lineTo(cx + bodyW / 2, top + 150);
  g.bezierCurveTo(cx + bodyW / 2, top + 112, cx + neckW / 2, top + 110, cx + neckW / 2, top + 80);
  g.lineTo(cx + neckW / 2, top + 26);
  g.closePath();
  const glass = g.createLinearGradient(cx - bodyW / 2, 0, cx + bodyW / 2, 0);
  glass.addColorStop(0, '#62d8cb');
  glass.addColorStop(0.5, C.teal);
  glass.addColorStop(1, '#12867c');
  g.fillStyle = glass;
  g.fill();
  g.clip();

  // Label, centred on PRODUCT.
  const labelY = PRODUCT.y - 46;
  g.fillStyle = C.coral;
  g.fillRect(cx - bodyW / 2, labelY, bodyW, 92);
  g.fillStyle = C.sun;
  g.fillRect(cx - bodyW / 2, labelY + 6, bodyW, 4);
  g.fillRect(cx - bodyW / 2, labelY + 82, bodyW, 4);
  g.fillStyle = C.paper;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '600 34px "Fredoka Variable"';
  g.fillText('Pétille', cx, PRODUCT.y - 6);
  g.font = '800 12px "Nunito Variable"';
  g.letterSpacing = '3px';
  g.fillText('LIMONADE', cx + 1.5, PRODUCT.y + 22);
  g.letterSpacing = '0px';

  g.fillStyle = 'rgba(255, 255, 255, 0.35)';
  g.beginPath();
  g.roundRect(cx - bodyW / 2 + 14, top + 124, 12, height - 146, 6);
  g.fill();
  for (const [dx, dy, r] of [[20, 140, 6], [34, 168, 4], [-8, 180, 5], [26, 205, 3], [8, 120, 3]]) {
    ellipse(g, cx + dx, top + dy, r, r, 'rgba(255, 255, 255, 0.45)');
  }
  g.restore();

  roundRect(g, cx - 32, top, 64, 32, 7, C.ink);
  g.fillStyle = 'rgba(255, 255, 255, 0.18)';
  for (let x = -24; x <= 24; x += 8) g.fillRect(cx + x - 1, top + 5, 2, 22);
}

// ---------------------------------------------------------------- poster

/**
 * The finished poster, drawn to fill (w, h) — the page as trimmed. Coloured shapes run off the
 * edges on purpose: that is what the bleed is for.
 */
export function drawPoster(g: CanvasRenderingContext2D, w: number, h: number) {
  const u = w / 100;
  g.fillStyle = C.sun;
  g.fillRect(0, 0, w, h);
  ellipse(g, w * 0.95, h * 0.04, 26 * u, 26 * u, C.blush);
  g.fillStyle = C.teal;
  g.fillRect(0, h * 0.84, w, h * 0.16);

  g.fillStyle = C.ink;
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.font = `600 ${21 * u}px "Fredoka Variable"`;
  g.fillText('PÉTILLE', w / 2, h * 0.15);
  g.font = `800 ${4.6 * u}px "Nunito Variable"`;
  g.fillText('La limonade qui pétille', w / 2, h * 0.205);

  const photo = { x: 8 * u, y: h * 0.25, w: 84 * u, h: h * 0.53 };
  roundRect(g, photo.x - 1.5 * u, photo.y - 1.5 * u, photo.w + 3 * u, photo.h + 3 * u, 4 * u, C.paper);
  g.save();
  g.beginPath();
  g.roundRect(photo.x, photo.y, photo.w, photo.h, 3 * u);
  g.clip();
  drawStudioView(g, productView(photo.w / photo.h, 0.7), photo.x, photo.y, photo.w, photo.h);
  g.restore();

  ellipse(g, 17 * u, h * 0.92, 8 * u, 8 * u, C.coral);
  g.fillStyle = C.paper;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `600 ${9 * u}px "Fredoka Variable"`;
  g.fillText('P', 17 * u, h * 0.922);
  g.fillStyle = C.ink;
  g.textAlign = 'right';
  g.font = `800 ${4.4 * u}px "Nunito Variable"`;
  g.fillText('Dès le 1er juin', 92 * u, h * 0.9);
  g.fillText('dans tes magasins', 92 * u, h * 0.945);
}
