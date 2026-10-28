import { PALETTE as C } from '../render/palette.ts';

// Poster backgrounds, painted in 2D in a frame 1000 units wide and 1414 high (A4 portrait).
// The floor starts around y = 1000; the character's feet stand at FEET_Y. On the poster, the decor is
// moved up so that this spot lands under the character's feet (see PosterRenderer.ts).
// These decors are shared by every trade: a trade picks the ones it offers and the domain that unlocks
// each (`studio` in the trade's module), and may paint its own (Studio photo, in media) with the
// helpers exported below.
export const W = 1000;
export const H = 1414;
export const FEET_Y = 1115;

/** A poster background; `draw` paints it in the W × H frame, `scale` being canvas pixels per unit. */
export interface Decor {
  id: string;
  label: string;
  draw(g: CanvasRenderingContext2D, scale: number): void;
  /** Id of the skill that unlocks it (poster/unlocks.ts). */
  skill?: string;
}

export const DECORS: Decor[] = [
  { id: 'lagoon', label: 'Lagon', draw: drawLagoon },
  { id: 'party', label: 'Fête', draw: drawParty },
  { id: 'city', label: 'Ville la nuit', draw: drawCity },
  { id: 'premiere', label: 'Grande première', draw: drawPremiere },
];

/** Paints `decor` over the whole canvas. */
export function paintDecor(canvas: HTMLCanvasElement, decor: Decor): void {
  const g = canvas.getContext('2d')!;
  g.save();
  g.scale(canvas.width / W, canvas.height / H);
  decor.draw(g, canvas.width / W);
  g.restore();
}

/** Small deterministic random generator: the confetti and windows stay put between redraws. */
export function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export function linear(
  g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, stops: [number, string][],
): CanvasGradient {
  const gradient = g.createLinearGradient(x0, y0, x1, y1);
  for (const [at, color] of stops) gradient.addColorStop(at, color);
  return gradient;
}

export function glow(g: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  const gradient = g.createRadialGradient(x, y, 0, x, y, r);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  g.fillStyle = gradient;
  g.fillRect(x - r, y - r, r * 2, r * 2);
}

export function ellipse(
  g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string | CanvasGradient | CanvasPattern,
): void {
  g.fillStyle = fill;
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  g.fill();
}

/** Four-pointed sparkle. */
export function sparkle(g: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string | CanvasGradient | CanvasPattern): void {
  g.fillStyle = fill;
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4;
    const d = i % 2 ? r * 0.28 : r;
    g.lineTo(x + Math.sin(angle) * d, y - Math.cos(angle) * d);
  }
  g.fill();
}

// ------------------------------------------------------------ 🏝️ Lagoon

function drawLagoon(g: CanvasRenderingContext2D): void {
  g.fillStyle = linear(g, 0, 0, 0, 900, [[0, '#d4f8f2'], [1, C.aqua]]);
  g.fillRect(0, 0, W, H);
  glow(g, 720, 430, 300, 'rgba(255, 236, 170, 0.8)');
  ellipse(g, 720, 430, 120, 120, C.sun);
  cloud(g, 220, 360, 1);
  cloud(g, 860, 640, 0.65);

  // Sea: bands of waves, darker towards the horizon.
  const bands = ['#5fcfc3', C.teal, '#3cc3b4', '#7ddbd0'];
  bands.forEach((color, i) => {
    const top = 860 + i * 48;
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(0, H);
    for (let x = 0; x <= W; x += 20) g.lineTo(x, top + Math.sin(x / 60 + i * 1.7) * 9);
    g.lineTo(W, H);
    g.fill();
  });

  // Sand, with a line of foam.
  const sand = (y: number) => 1040 + Math.sin(y / 140) * 18;
  g.beginPath();
  g.moveTo(0, H);
  for (let x = 0; x <= W; x += 20) g.lineTo(x, sand(x));
  g.lineTo(W, H);
  g.fillStyle = '#ffe6b8';
  g.fill();
  g.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  g.lineWidth = 12;
  g.stroke();
  g.fillStyle = linear(g, 0, 1040, 0, H, [[0, 'rgba(255, 255, 255, 0)'], [1, 'rgba(240, 194, 139, 0.45)']]);
  g.fillRect(0, 1040, W, H - 1040);
}

function cloud(g: CanvasRenderingContext2D, x: number, y: number, scale: number): void {
  for (const [dx, dy, r] of [[-70, 10, 45], [-20, -20, 62], [45, -5, 52], [90, 15, 36]]) {
    ellipse(g, x + dx * scale, y + dy * scale, r * scale, r * scale, 'rgba(255, 255, 255, 0.95)');
  }
  g.fillRect(x - 70 * scale, y + 10 * scale, 160 * scale, 41 * scale);
}

// ------------------------------------------------------------ 🎉 Party

function drawParty(g: CanvasRenderingContext2D): void {
  const bg = g.createRadialGradient(500, 760, 0, 500, 760, 1000);
  bg.addColorStop(0, '#ffeef0');
  bg.addColorStop(1, C.blush);
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);

  // Sunburst behind the character.
  g.fillStyle = 'rgba(255, 255, 255, 0.28)';
  const rays = 22;
  for (let i = 0; i < rays; i++) {
    const a0 = (i * 2 * Math.PI) / rays;
    const a1 = a0 + Math.PI / rays;
    g.beginPath();
    g.moveTo(500, 760);
    g.lineTo(500 + Math.cos(a0) * 1400, 760 + Math.sin(a0) * 1400);
    g.lineTo(500 + Math.cos(a1) * 1400, 760 + Math.sin(a1) * 1400);
    g.fill();
  }

  // Round podium.
  g.fillStyle = '#dc3f64';
  g.fillRect(140, 1115, 720, 95);
  ellipse(g, 500, 1210, 360, 70, '#dc3f64');
  ellipse(g, 500, 1115, 360, 70, C.coral);
  ellipse(g, 500, 1108, 340, 60, '#ffffff');

  const random = seeded(7);
  const colors = [C.sun, C.teal, C.coral, C.sky, C.lilac, '#ffffff'];
  for (let i = 0; i < 150; i++) {
    const x = random() * W;
    const y = random() * H;
    g.save();
    g.translate(x, y);
    g.rotate(random() * Math.PI);
    g.fillStyle = colors[i % colors.length];
    if (i % 3) g.fillRect(-7, -14, 14, 28);
    else ellipse(g, 0, 0, 9, 9, g.fillStyle);
    g.restore();
  }
}

// ------------------------------------------------------------ 🌃 City by night

function drawCity(g: CanvasRenderingContext2D, scale: number): void {
  g.fillStyle = linear(g, 0, 0, 0, 1000, [[0, '#13223a'], [0.6, '#2b2f6b'], [1, '#6b3f86']]);
  g.fillRect(0, 0, W, H);

  const random = seeded(11);
  for (let i = 0; i < 110; i++) {
    g.globalAlpha = 0.4 + random() * 0.6;
    ellipse(g, random() * W, random() * 820, 1.5 + random() * 2.5, 1.5 + random() * 2.5, '#ffffff');
  }
  g.globalAlpha = 1;
  glow(g, 800, 300, 170, 'rgba(255, 243, 196, 0.45)');
  ellipse(g, 800, 300, 64, 64, '#fff3c4');

  // Neon ring behind the character.
  g.save();
  g.shadowBlur = 40 * scale;
  for (const [color, r, width] of [[C.teal, 345, 8], [C.coral, 305, 16]] as const) {
    g.shadowColor = color;
    g.strokeStyle = color;
    g.lineWidth = width;
    g.beginPath();
    g.arc(500, 760, r, 0, Math.PI * 2);
    g.stroke();
  }
  g.restore();

  skyline(g, random, '#30296a', 230, 420, 0.35);
  skyline(g, random, '#211c4d', 120, 280, 0.8);
  g.fillStyle = linear(g, 0, 1000, 0, H, [[0, '#1b1740'], [1, '#100d2a']]);
  g.fillRect(0, 1000, W, H - 1000);
  // Wet street: a soft reflection of the neon.
  glow(g, 500, 1100, 380, 'rgba(255, 101, 132, 0.25)');
}

function skyline(
  g: CanvasRenderingContext2D, random: () => number, color: string, minHeight: number, maxHeight: number, lights: number,
): void {
  for (let x = -20; x < W;) {
    const w = 70 + random() * 80;
    const h = minHeight + random() * (maxHeight - minHeight);
    g.fillStyle = color;
    g.fillRect(x, 1000 - h, w - 6, h);
    g.fillStyle = C.sun;
    for (let wy = 1000 - h + 20; wy < 980; wy += 34) {
      for (let wx = x + 12; wx < x + w - 24; wx += 22) {
        if (random() < lights * 0.5) g.fillRect(wx, wy, 10, 16);
      }
    }
    x += w;
  }
}

// ------------------------------------------------------------ 🎬 Premiere

function drawPremiere(g: CanvasRenderingContext2D): void {
  g.fillStyle = linear(g, 0, 0, 0, 1000, [[0, '#2d1436'], [1, '#6b2b4f']]);
  g.fillRect(0, 0, W, H);
  g.fillStyle = linear(g, 0, 1000, 0, H, [[0, '#3b1a3c'], [1, '#22102a']]);
  g.fillRect(0, 1000, W, H - 1000);

  // Spotlight from above onto the stage.
  g.fillStyle = linear(g, 0, 0, 0, 1100, [[0, 'rgba(255, 244, 214, 0.05)'], [1, 'rgba(255, 244, 214, 0.32)']]);
  g.beginPath();
  g.moveTo(430, -20);
  g.lineTo(570, -20);
  g.lineTo(840, 1100);
  g.lineTo(160, 1100);
  g.fill();

  // Red carpet towards the viewer, with golden edges.
  g.beginPath();
  g.moveTo(400, 1000);
  g.lineTo(600, 1000);
  g.lineTo(800, H);
  g.lineTo(200, H);
  g.closePath();
  g.fillStyle = '#e0445f';
  g.fill();
  g.strokeStyle = C.sun;
  g.lineWidth = 10;
  g.stroke();
  ellipse(g, 500, 1115, 330, 70, 'rgba(255, 244, 214, 0.35)');

  // Curtains drawn to the sides, then the valance on top.
  for (const side of [-1, 1]) curtain(g, side);
  g.fillStyle = '#c23356';
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(W, 0);
  for (let x = W; x > 0; x -= 100) g.arc(x - 50, 110, 50, 0, Math.PI); // scalloped hem
  g.fill();
  g.fillStyle = C.sun;
  g.fillRect(0, 100, W, 10);

  const random = seeded(5);
  for (let i = 0; i < 16; i++) sparkle(g, 140 + random() * 720, 160 + random() * 760, 12 + random() * 16, i % 2 ? C.sun : '#ffffff');
}

function curtain(g: CanvasRenderingContext2D, side: number): void {
  g.save();
  if (side > 0) {
    g.translate(W, 0);
    g.scale(-1, 1);
  }
  // Folds: vertical stripes, light and dark, gathered at a tie-back.
  for (let i = 0; i < 4; i++) {
    const x = i * 45;
    g.fillStyle = i % 2 ? '#dc3f64' : C.coral;
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x + 50, 0);
    g.quadraticCurveTo(x * 0.4 + 40, 640, x * 0.25 + 30, 680);
    g.quadraticCurveTo(x * 0.6 + 70, 900, x + 60, H);
    g.lineTo(x, H);
    g.quadraticCurveTo(x * 0.5, 900, x * 0.25, 680);
    g.quadraticCurveTo(x * 0.3, 640, x, 0);
    g.fill();
  }
  ellipse(g, 70, 680, 46, 18, C.sun);
  g.restore();
}
