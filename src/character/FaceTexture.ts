import * as THREE from 'three';
import { shadeHex, mixHex } from '../render/materials.ts';
import { FACE_SPAN, FEATURES } from './head.ts';
import { facialHairDensity } from './beard.ts';

// Face painted on a square canvas projected on the front of the head (see head.ts): the canvas
// covers longitude and latitude in [-FACE_SPAN, FACE_SPAN] around the centre of the face.
const SIZE = 1024;
const PX = SIZE / (2 * FACE_SPAN); // pixels per radian
const LINE = '#33201b';
const { smoothstep } = THREE.MathUtils;

export const EXPRESSIONS = ['neutral', 'happy', 'surprised', 'wink', 'focused'] as const;
export type Expression = (typeof EXPRESSIONS)[number];

// Eyebrows, the same for everyone: thickness (radians), arch (pixels) and how far they reach outwards.
const BROW = { thick: 0.036, arch: 8, reach: 1.05 };

// Character.faceParams() fills in the look; the proportions keep these values.
export const DEFAULT_FACE = {
  skin: '#f1c7a5',
  eyeColor: '#5b3a29',
  eyeSpacing: 0.42, // radians from the face centre
  eyeSize: 1,
  eyeShape: 'round', // 'round' | 'almond'
  browColor: '#4a3426',
  browLift: 0, // radians: raises (+) or lowers (−) the eyebrows
  mouthWidth: 1,
  beard: 'none', // stubble is painted; the other beards and moustaches are 3D (beard.ts)
  mustache: 'none',
  beardColor: '#4a3426',
  skinMarks: 'none', // 'none' | 'freckles'
};

/** What the face texture paints (see Character.faceParams()). */
export type FaceParams = typeof DEFAULT_FACE;

/** Canvas point for a longitude/latitude (radians) relative to the face centre. */
function at(lon: number, lat: number): [number, number] {
  return [SIZE / 2 + lon * PX, SIZE / 2 - lat * PX];
}

/** Small deterministic random generator, so the stubble doesn't change at every redraw. */
function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export class FaceTexture {
  face: FaceParams;
  expression: Expression;
  blinking: boolean;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;

  constructor(face: Partial<FaceParams> = {}) {
    this.face = { ...DEFAULT_FACE, ...face };
    this.expression = 'neutral';
    this.blinking = false;

    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = SIZE;
    this.ctx = this.canvas.getContext('2d')!;

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
    this.draw();
  }

  update(face: Partial<FaceParams>): void {
    Object.assign(this.face, face);
    this.draw();
  }

  setExpression(expression: Expression): void {
    if (expression === this.expression) return;
    this.expression = expression;
    this.draw();
  }

  setBlink(blinking: boolean): void {
    if (blinking === this.blinking) return;
    this.blinking = blinking;
    this.draw();
  }

  draw(): void {
    const { ctx, face } = this;
    ctx.fillStyle = face.skin;
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    this.drawSkinMarks();
    this.drawBlush();
    this.drawBeard();
    this.drawNose();
    for (const side of [-1, 1]) {
      this.drawEye(side);
      this.drawBrow(side);
    }
    this.drawMouth();
    this.texture.needsUpdate = true;
  }

  /** Closed path through longitude/latitude points. */
  polygon(points: [number, number][]): void {
    const { ctx } = this;
    ctx.beginPath();
    points.forEach(([lon, lat], i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, ...at(lon, lat)));
    ctx.closePath();
  }

  drawBlush(): void {
    const { ctx, face } = this;
    const amount = 0.38;
    for (const side of [-1, 1]) {
      const [x, y] = at(side * 0.56, FEATURES.eyeLat - 0.22);
      const r = 0.17 * PX;
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
      gradient.addColorStop(0, `rgba(240, 110, 110, ${amount})`);
      gradient.addColorStop(1, 'rgba(240, 110, 110, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }

  /** Freckles over the nose and cheeks. */
  drawSkinMarks(): void {
    const { ctx, face } = this;
    if (face.skinMarks !== 'freckles') return;
    // Densest across the nose and the tops of the cheeks, fading out towards the sides.
    const random = seeded(3);
    ctx.fillStyle = mixHex(shadeHex(face.skin, -0.32), '#8a4a2a', 0.35);
    for (let i = 0; i < 260; i++) {
      const lon = (random() * 2 - 1) * 0.75;
      const lat = FEATURES.eyeLat - 0.1 - random() * 0.24;
      const keep = Math.exp(-(((Math.abs(lon) - 0.32) / 0.3) ** 2)) * Math.exp(-(((lat - FEATURES.eyeLat + 0.2) / 0.12) ** 2));
      if (random() > keep || (Math.abs(lon) < 0.08 && lat < FEATURES.noseLat + 0.04)) continue;
      const [x, y] = at(lon, lat);
      ctx.globalAlpha = 0.35 + random() * 0.35;
      ctx.beginPath();
      ctx.arc(x, y, 2.2 + random() * 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /**
   * Stubble: a shade and short hairs over the beard area. Under modelled beards and moustaches
   * (beard.ts), a lighter shade so their thinning edges blend into the skin.
   */
  drawBeard(): void {
    const { ctx, face } = this;
    const stubble = face.beard === 'stubble';
    const shell = (face.beard !== 'none' && !stubble) || face.mustache !== 'none';
    if (!stubble && !shell) return;
    const grown = stubble ? { beard: 'short', mustache: 'thick' } : { beard: face.beard, mustache: face.mustache };
    // Faded out before the edges of the canvas, which are stretched over the rest of the head.
    const border = (v: number) => smoothstep(FACE_SPAN - 0.04 - Math.abs(v), 0, 0.12);
    const density = (lon: number, lat: number) => facialHairDensity(grown.beard, grown.mustache, lon, lat, 0.02) * border(lon) * border(lat);

    // Shade, cell by cell (the canvas is too big to test every pixel at each redraw).
    const cell = 8;
    ctx.save();
    ctx.fillStyle = face.beardColor;
    for (let y = SIZE / 2; y < SIZE; y += cell) {
      for (let x = 0; x < SIZE; x += cell) {
        const d = density((x + cell / 2 - SIZE / 2) / PX, (SIZE / 2 - y - cell / 2) / PX);
        if (d <= 0) continue;
        ctx.globalAlpha = d * (stubble ? 0.3 : 0.22);
        ctx.fillRect(x, y, cell, cell);
      }
    }
    if (stubble) {
      // Short hairs, pointing down, fewer towards the edges.
      const random = seeded(7);
      ctx.strokeStyle = face.beardColor;
      ctx.lineWidth = 2.2;
      for (let i = 0; i < 4500; i++) {
        const lon = (random() - 0.5) * 2 * FACE_SPAN;
        const lat = -random() * FACE_SPAN;
        const d = density(lon, lat);
        if (random() > d) continue;
        const [x, y] = at(lon, lat);
        ctx.globalAlpha = 0.35 + random() * 0.35;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (random() - 0.5) * 3, y + 3 + random() * 3);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /** The nose itself is modelled (nose.ts): only paint its soft shadow on the lip. */
  drawNose(): void {
    const { ctx, face } = this;
    const [x, y] = at(0.02, FEATURES.noseLat - 0.06);
    const r = 0.08 * PX;
    const shadow = shadeHex(face.skin, -0.3);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, 0.5); // flat ellipse
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    gradient.addColorStop(0, `${shadow}66`);
    gradient.addColorStop(1, `${shadow}00`);
    ctx.fillStyle = gradient;
    ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.restore();
  }

  drawEye(side: number): void {
    const { ctx, face, expression } = this;
    const [cx, cy] = at(side * face.eyeSpacing, FEATURES.eyeLat);
    const s = PX * face.eyeSize;
    const w = 0.2 * s;
    let h = 0.15 * s * (face.eyeShape === 'almond' ? 0.72 : 1);
    if (expression === 'surprised') h *= 1.15;
    // Side +1 is the character's left eye (viewer's right); `inner` is towards the nose.
    const inner: [number, number] = [cx - side * w, cy + h * 0.2];
    const outer: [number, number] = [cx + side * w, cy - h * 0.1];
    const lidWidth = 8.5 * face.eyeSize;

    const happy = expression === 'happy' || (expression === 'wink' && side === 1);
    if (happy || this.blinking) {
      ctx.strokeStyle = LINE;
      ctx.lineWidth = lidWidth;
      ctx.beginPath();
      ctx.moveTo(...inner);
      if (happy) ctx.quadraticCurveTo(cx, cy - h * 1.5, ...outer);
      else ctx.quadraticCurveTo(cx, cy + h * 0.9, ...outer);
      ctx.stroke();
      return;
    }

    const upper = (path: Path2D) => {
      path.moveTo(...inner);
      path.bezierCurveTo(cx - side * w * 0.55, cy - h * 1.3, cx + side * w * 0.5, cy - h * 1.35, ...outer);
    };
    const eye = new Path2D();
    upper(eye);
    eye.bezierCurveTo(cx + side * w * 0.55, cy + h * 1.0, cx - side * w * 0.45, cy + h * 1.15, ...inner);

    ctx.save();
    ctx.fillStyle = '#fbf5f0';
    ctx.fill(eye);
    ctx.clip(eye);

    // Iris: big, cut by the lids, darker at the top.
    const ix = cx + side * w * 0.03;
    const iy = cy + h * 0.08;
    const ri = h * 1.02;
    const iris = ctx.createLinearGradient(0, iy - ri, 0, iy + ri);
    iris.addColorStop(0, shadeHex(face.eyeColor, -0.55));
    iris.addColorStop(0.55, face.eyeColor);
    iris.addColorStop(1, shadeHex(face.eyeColor, 0.4));
    ctx.fillStyle = iris;
    ctx.beginPath();
    ctx.arc(ix, iy, ri, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = shadeHex(face.eyeColor, -0.6);
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#1a0f0c';
    ctx.beginPath();
    ctx.arc(ix, iy, ri * (expression === 'surprised' ? 0.3 : 0.45), 0, Math.PI * 2);
    ctx.fill();

    // Shadow of the upper lid on the eyeball.
    const lidShadow = ctx.createLinearGradient(0, cy - h * 1.2, 0, cy);
    lidShadow.addColorStop(0, 'rgba(70, 35, 40, 0.45)');
    lidShadow.addColorStop(1, 'rgba(70, 35, 40, 0)');
    ctx.fillStyle = lidShadow;
    ctx.fillRect(cx - w * 1.2, cy - h * 1.4, w * 2.4, h * 1.4);

    if (expression === 'focused') {
      ctx.fillStyle = face.skin;
      ctx.fillRect(cx - w * 1.2, cy - h * 1.5, w * 2.4, h * 1.2);
    }
    ctx.restore();

    // Highlights.
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ix - side * ri * 0.32, iy - ri * 0.38, ri * 0.24, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.arc(ix + side * ri * 0.3, iy + ri * 0.4, ri * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Upper lid line with a small flick at the outer corner, soft lower line, lid crease.
    ctx.strokeStyle = LINE;
    ctx.lineWidth = lidWidth;
    const lid = new Path2D();
    if (expression === 'focused') {
      lid.moveTo(inner[0], cy - h * 0.25);
      lid.lineTo(outer[0], cy - h * 0.3);
    } else {
      upper(lid);
      lid.lineTo(outer[0] + side * w * 0.18, outer[1] - h * 0.28);
    }
    ctx.stroke(lid);

    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(outer[0] - side * w * 0.1, outer[1] + h * 0.5);
    ctx.bezierCurveTo(cx + side * w * 0.4, cy + h * 1.05, cx - side * w * 0.4, cy + h * 1.15, inner[0] + side * w * 0.15, inner[1] + h * 0.2);
    ctx.stroke();
    ctx.globalAlpha = 0.28;
    ctx.beginPath();
    ctx.moveTo(cx - side * w * 0.55, cy - h * 1.45);
    ctx.quadraticCurveTo(cx + side * w * 0.2, cy - h * 1.9, cx + side * w * 0.85, cy - h * 1.35);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  drawBrow(side: number): void {
    const { ctx, face, expression } = this;
    const lift = expression === 'surprised' ? 0.05 : 0;
    const [cx, cy] = at(side * face.eyeSpacing, FEATURES.eyeLat + 0.27 + lift + face.browLift);
    const w = 0.2 * PX * BROW.reach;
    const thick = BROW.thick * PX;
    const { arch } = BROW;
    const innerDrop = expression === 'focused' ? 10 : 0;
    // Brush stroke: thick at the inner end, tapering outwards, with an arch.
    const point = (t: number): [number, number] => {
      const x = cx + side * (-w * 0.85 + t * w * 1.9);
      const y = cy + arch * 0.5 - Math.sin(t * Math.PI * 0.85) * arch + (1 - t) * innerDrop;
      return [x, y];
    };
    const top: [number, number][] = [];
    const bottom: [number, number][] = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const [x, y] = point(t);
      const half = (thick * (1 - 0.6 * t ** 1.5)) / 2;
      top.push([x, y - half]);
      bottom.push([x, y + half]);
    }
    ctx.fillStyle = face.browColor;
    ctx.beginPath();
    [...top, ...bottom.reverse()].forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fill();
  }

  drawMouth(): void {
    const { ctx, face, expression } = this;
    const [x, y] = at(0, FEATURES.mouthLat);
    const w = 0.09 * PX * face.mouthWidth;
    const lineColor = mixHex(shadeHex(face.skin, -0.55), '#7a2a2a', 0.45);
    const lip = mixHex(face.skin, '#d9666a', 0.24);
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 4.5;

    // Lower lip, a soft shape under the mouth line.
    const lowerLip = () => {
      ctx.fillStyle = lip;
      ctx.beginPath();
      ctx.ellipse(x, y + 11, w * 0.55, 7, 0, 0, Math.PI * 2);
      ctx.fill();
    };

    switch (expression) {
      case 'happy': {
        const mouth = new Path2D();
        mouth.moveTo(x - w * 1.1, y - 6);
        mouth.quadraticCurveTo(x, y + 4, x + w * 1.1, y - 6);
        mouth.quadraticCurveTo(x, y + w * 1.5, x - w * 1.1, y - 6);
        ctx.fillStyle = '#6e2427';
        ctx.fill(mouth);
        ctx.save();
        ctx.clip(mouth);
        ctx.fillStyle = '#fbf3ee';
        ctx.fillRect(x - w * 1.2, y - 10, w * 2.4, 13);
        ctx.fillStyle = '#e8737d';
        ctx.beginPath();
        ctx.ellipse(x, y + w * 0.95, w * 0.6, w * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.lineWidth = 3.5;
        ctx.stroke(mouth);
        break;
      }
      case 'surprised':
        ctx.fillStyle = '#6e2427';
        ctx.beginPath();
        ctx.ellipse(x, y + 6, w * 0.38, w * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;
      case 'focused':
        lowerLip();
        ctx.fillStyle = '#e8737d';
        ctx.beginPath();
        ctx.ellipse(x + w * 0.4, y + 5, w * 0.24, w * 0.26, 0, 0, Math.PI);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x - w * 0.7, y + 2);
        ctx.lineTo(x + w * 0.75, y);
        ctx.stroke();
        break;
      default: {
        lowerLip();
        const smirk = expression === 'wink' ? 5 : 0;
        ctx.beginPath();
        ctx.moveTo(x - w, y - 3);
        ctx.bezierCurveTo(x - w * 0.4, y + 5, x + w * 0.4, y + 5, x + w, y - 3 - smirk);
        ctx.stroke();
      }
    }
  }
}
