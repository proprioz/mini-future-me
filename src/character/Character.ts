import * as THREE from 'three';
import { shadeHex } from '../render/materials.ts';
import { cel, celMesh } from '../render/celMaterial.ts';
import { FaceTexture, DEFAULT_FACE } from './FaceTexture.ts';
import type { Expression, FaceParams } from './FaceTexture.ts';
import { headGeometry, surface } from './head.ts';
import type { HeadParams } from './head.ts';
import { limb, smoothLathe } from './shapes.ts';
import { buildHair, HAIR_VOLUME } from './hair.ts';
import { buildFacialHair } from './beard.ts';
import { buildNose } from './nose.ts';
import { buildHeadwear, buildGlasses, buildEarrings, buildHeldItem, coversHair, hatEdge, hidesFace, hidesHair } from './accessories.ts';

const WALK_SPEED = 2.6; // tiles per second
const TURN_RATE = 12;
const HOP_DURATION = 0.55;

// Body layout (metres-ish, floor at 0): chibi, a big head on a small round body (≈ 2.3 heads tall).
const HIP_Y = 0.36;
const TORSO_Y = 0.32;
const SHOULDER_Y = 0.595;
const HEAD_Y = 1.05;
const HEAD_SCALE = 1.55;
const THIGH = 0.14;
const SHIN = 0.12;
const UPPER_ARM = 0.12;
const FOREARM = 0.1;
const OUTLINE = 0.005;
const LONG_SLEEVES = ['hoodie', 'sweater', 'shirt', 'jacket', 'cardigan', 'suit', 'robe', 'schoolRobe', 'overalls', 'heroSuit'];

const numbers = new Map<string, THREE.CanvasTexture>();

/** A big white jersey number with a dark edge, on a transparent canvas (cached). */
function numberTexture(text: string): THREE.CanvasTexture {
  if (numbers.has(text)) return numbers.get(text)!;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.font = '700 190px "Fredoka Variable", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 14;
  ctx.strokeStyle = 'rgba(30, 20, 20, 0.55)';
  ctx.strokeText(text, 128, 140);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, 128, 140);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  numbers.set(text, texture);
  return texture;
}

let spider: THREE.CanvasTexture | null = null;

/** A black spider, the emblem on the superhero's chest, on a transparent canvas. */
function spiderTexture(): THREE.CanvasTexture {
  if (spider) return spider;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = ctx.strokeStyle = '#1a1416';
  ctx.lineWidth = 7;
  ctx.lineCap = ctx.lineJoin = 'round';
  for (const side of [-1, 1]) {
    // Four legs a side: two up, two down, each bent at the knee.
    for (const [kx, ky, fx, fy] of [[40, -40, 52, -96], [50, -12, 92, -50], [50, 18, 92, 60], [40, 40, 52, 104]]) {
      ctx.beginPath();
      ctx.moveTo(128, 128);
      ctx.lineTo(128 + side * kx, 128 + ky);
      ctx.lineTo(128 + side * fx, 128 + fy);
      ctx.stroke();
    }
  }
  ctx.beginPath();
  ctx.ellipse(128, 145, 15, 34, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(128, 100, 15, 0, Math.PI * 2);
  ctx.fill();
  spider = new THREE.CanvasTexture(canvas);
  spider.colorSpace = THREE.SRGBColorSpace;
  return spider;
}

/** Body proportions (the same for everyone); `limbs` scales arms and legs. */
const BODY = { shoulders: 0.175, chest: 0.168, waist: 0.155, hips: 0.166, limbs: 1.07 };

/** Face proportions (see sculpt() in head.ts), clearly apart so each shape reads at a glance. */
const FACE_SHAPES: Record<string, HeadParams> = {
  round: { width: 1.08, length: 0.86, jaw: 2.2, chin: 2, taper: 0.02 },
  oval: { width: 0.92, length: 1.06, jaw: 2, chin: 2, taper: 0.08 },
  square: { width: 1.0, length: 0.94, jaw: 4.5, chin: 3.5, taper: 0.1 },
  heart: { width: 1.1, length: 1.02, jaw: 1.4, chin: 2, taper: 0.3 },
};

// Neutral options wherever there is one (see options.ts), so the default look never mixes genders.
export const DEFAULT_LOOK = {
  skin: '#f1c7a5',
  faceShape: 'oval', // 'round' | 'oval' | 'square' | 'heart'
  eyeColor: '#5b3a29',
  eyeShape: 'round', // 'round' | 'almond'
  skinMarks: 'none', // 'none' | 'freckles'
  hair: '#4a3426',
  hairStyle: 'curly', // see HAIR_STYLES in options.ts
  beard: 'none', // 'none' | 'stubble' | 'goatee' (the chin) | 'short'
  mustache: 'none', // 'none' | 'stubble' | 'thick'
  beardColor: '#4a3426',
  // Also 'robe', 'schoolRobe', 'overalls', 'tankTop', 'jersey' and 'heroSuit', worn only by the ready-made characters (presets.ts).
  outfit: 'tshirt', // 'tshirt' | 'sweater' | 'shirt' | 'hoodie' | 'jacket' | 'cardigan' | 'suit' | 'dress'
  bottomStyle: 'trousers', // 'trousers' | 'shorts', not with a dress
  top: '#5b7fb8',
  bottom: '#2f3a56',
  shoes: '#f7f3ee',
  headwear: 'none', // 'none' | 'cap' | 'beanie' | 'headscarf' (and 'wizard', 'plumberCap', 'heroMask', presets.ts)
  headwearColor: '#2f3a56',
  glasses: 'none', // 'none' | 'round' | 'square' | 'bold' | 'catEye' | 'browline' (and 'sunRound', presets.ts)
  glassesColor: '#2b2d42', // see GLASSES_COLORS (the last one is clear plastic)
  earrings: 'none', // 'none' | 'studs' | 'hoops' | 'drops'
  earringColor: '#ffcf4a',
  // What the hands hold, only for the ready-made characters (presets.ts): 'none' | 'wand' | 'staff' | 'pistol' (the
  // left hand), 'pistols' (one in each hand).
  held: 'none',
};

/** Everything the visitor sets in « Crée ton perso » (and the scan measures). */
export type Look = typeof DEFAULT_LOOK;

/** Joints of a leg (see Character.build). */
export interface LegJoints {
  hip: THREE.Group;
  knee: THREE.Group;
}

/** Joints of an arm; `shoulder.userData.side` is +1 for the character's left, −1 for its right. */
export interface ArmJoints {
  shoulder: THREE.Group;
  elbow: THREE.Group;
}

type BodyMaterials = Record<'skin' | 'top' | 'bottom' | 'shoes', THREE.ShaderMaterial>;
type AnyMesh = THREE.Mesh<THREE.BufferGeometry, THREE.Material>;

function dispose(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (!(child as AnyMesh).isMesh || child.userData.outline) return; // outlines share their parent's geometry
    (child as AnyMesh).geometry.dispose();
    (child as AnyMesh).material.dispose();
  });
}

function joint(x: number, y: number, z = 0): THREE.Group {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  return group;
}

/**
 * Procedural cel-shaded character: sculpted head with a painted face, layered clothes, jointed
 * limbs. Facing direction is local +Z.
 */
export class Character {
  look: Look;
  faceTexture: FaceTexture;
  group: THREE.Group;
  rig: THREE.Group;
  path: THREE.Vector3[];
  onArrive: (() => void) | null;
  heading: number;
  targetHeading: number;
  walkPhase: number;
  walkBlend: number;
  hopTime: number;
  blinkTimer: number;
  legs!: LegJoints[];
  arms!: ArmJoints[];
  torso!: THREE.Group;
  head!: THREE.Group;
  heldItems!: THREE.Group[];

  constructor(look: Partial<Look> = {}) {
    this.look = { ...DEFAULT_LOOK, ...look };
    this.faceTexture = new FaceTexture(this.faceParams());

    this.group = new THREE.Group(); // floor position + heading
    this.rig = new THREE.Group(); // bob / hop offset
    this.group.add(this.rig);

    this.path = [];
    this.onArrive = null;
    this.heading = 0;
    this.targetHeading = 0;
    this.walkPhase = 0;
    this.walkBlend = 0;
    this.hopTime = -1;
    this.blinkTimer = 2;

    this.build();
  }

  get position(): THREE.Vector3 {
    return this.group.position;
  }

  /** Head shape shared by the head, hair, beard and glasses. */
  get headParams(): HeadParams {
    return FACE_SHAPES[this.look.faceShape] ?? FACE_SHAPES.oval;
  }

  faceParams(): Partial<FaceParams> {
    const { skin, hair, eyeColor, eyeShape, beard, mustache, beardColor, skinMarks } = this.look;
    return { skin, eyeColor, eyeShape, beard, mustache, beardColor, skinMarks, browColor: shadeHex(hair, -0.15) };
  }

  /** Changes part of the look and rebuilds the body; animation state is kept. */
  setLook(changes: Partial<Look>): void {
    this.look = { ...this.look, ...changes };
    // Redrawing and re-uploading the face canvas is the costly part: skip it when unchanged.
    const face = this.faceParams();
    if (Object.entries(face).some(([key, value]) => this.faceTexture.face[key as keyof FaceParams] !== value)) this.faceTexture.update(face);
    dispose(this.rig);
    this.rig.clear();
    this.build();
  }

  build(): void {
    const { skin, top, bottom, shoes, outfit } = this.look;
    const f = BODY;
    // The trousers of a suit match its jacket.
    const trousers = outfit === 'suit' ? top : bottom;
    const mat: BodyMaterials = { skin: cel(skin, { rim: 0.2 }), top: cel(top, { rim: 0.2 }), bottom: cel(trousers, { rim: 0.2 }), shoes: cel(shoes, { rim: 0.2 }) };
    const part = (geometry: THREE.BufferGeometry, material: THREE.Material, outline = OUTLINE) => celMesh(geometry, material, { outline });
    const shorts = outfit !== 'dress' && this.look.bottomStyle === 'shorts';
    const legMat = outfit === 'dress' || shorts ? mat.skin : mat.bottom;

    // Legs: hip → knee → foot, short and round.
    this.legs = [-1, 1].map((side) => {
      const hip = joint(side * f.hips * 0.5, HIP_Y);
      const l = f.limbs;
      const thigh = part(limb(0.074 * l, 0.064 * l, THIGH), legMat);
      if (shorts) {
        // A leg of the shorts over the thigh, a little wide, its hem just above the knee.
        const leg = part(new THREE.CylinderGeometry(0.083 * l, 0.081 * l, 0.13, 20), mat.bottom);
        leg.position.y = -0.05;
        hip.add(leg);
      }
      const knee = joint(0, -THIGH);
      const shin = part(limb(0.062 * l, 0.056 * l, SHIN), legMat);
      const ankle = joint(0, -SHIN);
      const shoeGeometry = new THREE.SphereGeometry(1, 20, 14);
      shoeGeometry.scale(0.062, 0.05, 0.105);
      const shoe = part(shoeGeometry, mat.shoes);
      shoe.position.set(0, -0.045, 0.03);
      const sole = part(new THREE.CylinderGeometry(1, 1, 0.018, 20), cel(shadeHex(shoes, -0.25)), 0);
      sole.scale.set(0.064, 1, 0.107);
      sole.position.set(0, -0.083, 0.03);
      ankle.add(shoe, sole);
      knee.add(shin, ankle);
      hip.add(thigh, knee);
      this.rig.add(hip);
      return { hip, knee };
    });

    this.torso = this.buildTorso(mat);
    this.rig.add(this.torso);

    // A short neck that shows between the chin and the collar, whatever the face shape.
    // The superhero's suit goes up the neck to his mask, and down to gloves.
    const hero = outfit === 'heroSuit';
    const neck = part(limb(0.055, 0.06, 0.1), hero ? mat.top : mat.skin);
    neck.position.y = 0.8;
    this.rig.add(neck);

    // Arms: shoulder → elbow → round mitten hand.
    const longSleeves = LONG_SLEEVES.includes(outfit);
    this.heldItems = [];
    this.arms = [-1, 1].map((side) => {
      const shoulder = joint(side * (f.shoulders - 0.015), SHOULDER_Y);
      shoulder.userData.side = side;
      const a = f.limbs;
      if (longSleeves) {
        shoulder.add(part(limb(0.056 * a, 0.05 * a, UPPER_ARM), mat.top));
      } else {
        shoulder.add(part(limb(0.05 * a, 0.045 * a, UPPER_ARM), mat.skin));
        // Tank top and basketball jersey: no sleeves.
        if (outfit !== 'tankTop' && outfit !== 'jersey') shoulder.add(part(limb(0.062 * a, 0.059 * a, 0.06), mat.top));
      }
      const elbow = joint(0, -UPPER_ARM);
      elbow.add(part(limb(0.046 * a, 0.04 * a, FOREARM), longSleeves ? mat.top : mat.skin));
      if (outfit === 'robe' || outfit === 'schoolRobe') {
        // Wide sleeves, flaring to the wrist.
        const cuff = part(new THREE.CylinderGeometry(0.05 * a, 0.075 * a, 0.07, 18, 1, true), mat.top);
        cuff.material.side = THREE.DoubleSide;
        cuff.position.y = -FOREARM + 0.01;
        elbow.add(cuff);
      }
      const handGeometry = new THREE.SphereGeometry(1, 16, 12);
      handGeometry.scale(0.046 * a, 0.05 * a, 0.038 * a);
      // The plumber's overalls come with white gloves.
      const handMat = outfit === 'overalls' ? cel('#f7f3ee', { rim: 0.2 }) : hero ? mat.top : mat.skin;
      const hand = part(handGeometry, handMat);
      hand.position.y = -FOREARM - 0.04;
      const thumbGeometry = new THREE.SphereGeometry(1, 10, 8);
      thumbGeometry.scale(0.014 * a, 0.022 * a, 0.014 * a);
      const thumb = part(thumbGeometry, handMat, 0);
      thumb.position.set(0, -FOREARM - 0.03, 0.03 * a);
      thumb.rotation.x = 0.5;
      elbow.add(hand, thumb);
      const item = buildHeldItem(this.look.held, side);
      if (item) {
        item.position.y = hand.position.y;
        item.userData.side = side;
        elbow.add(item);
        this.heldItems.push(item);
      }
      shoulder.add(elbow);
      this.rig.add(shoulder);
      return { shoulder, elbow };
    });

    this.head = new THREE.Group();
    this.head.position.y = HEAD_Y;
    this.head.scale.setScalar(HEAD_SCALE);
    this.buildHead(mat);
    this.rig.add(this.head);
  }

  /** Torso group (breathes via scale.y); clothes are children so they follow. */
  buildTorso({ top, bottom }: BodyMaterials): THREE.Group {
    const { outfit } = this.look;
    const f = BODY;
    const torso = new THREE.Group();
    torso.position.y = TORSO_Y;
    torso.scale.z = 0.78;
    const part = (geometry: THREE.BufferGeometry, material: THREE.Material, outline = OUTLINE) => celMesh(geometry, material, { outline });
    const trim = cel(shadeHex(this.look.top, -0.14));

    // Upper body, from the waist to the neck; its hem comes down over the waistband, like a real top.
    const robe = outfit === 'robe' || outfit === 'schoolRobe';
    const hem = outfit === 'dress' || robe ? 0.11 : 0.07;
    torso.add(part(smoothLathe([
      [0.0, hem - 0.005], [f.hips * 1.06, hem], [f.waist * 1.08, 0.14], [f.chest, 0.23], [f.shoulders * 0.95, 0.3],
      [f.shoulders * 0.7, 0.34], [0.07, 0.36], [0.0, 0.365],
    ]), top));

    if (outfit === 'dress') {
      torso.add(part(smoothLathe([
        [0.0, -0.14], [f.hips * 1.7, -0.13], [f.hips * 1.35, 0.0], [f.waist * 1.06, 0.13], [0.0, 0.14],
      ]), bottom));
      return torso;
    }

    // Trousers: from the crotch up under the top.
    torso.add(part(smoothLathe([
      [0.0, 0.0], [f.hips * 0.92, 0.01], [f.hips * 1.0, 0.045], [f.hips * 0.98, 0.08], [0.0, 0.09],
    ]), bottom));

    const collar = (radius = 0.07, tube = 0.016, material: THREE.Material = trim) => {
      const ring = part(new THREE.TorusGeometry(radius, tube, 8, 24), material, 0);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.345;
      return ring;
    };
    /** Panel of another colour on the front (open jacket), following the chest. */
    const front = (color: string, y: number, height: number, spread: number) => {
      const geometry = new THREE.CylinderGeometry(f.shoulders * 0.97, f.waist * 1.1, height, 18, 1, true, -spread / 2, spread);
      const panel = part(geometry, cel(color, { side: THREE.DoubleSide }), 0);
      panel.position.y = y;
      return panel;
    };

    /** Radius of the upper body at height `y` (its profile above, a little outside it). */
    const bodyRadius = (y: number) => {
      const profile = [[f.hips * 1.06, hem], [f.waist * 1.08, 0.14], [f.chest, 0.23], [f.shoulders * 0.95, 0.3], [f.shoulders * 0.7, 0.34], [0.07, 0.36]];
      const i = Math.max(1, profile.findIndex(([, py]) => py >= y));
      const [r0, y0] = profile[i - 1];
      const [r1, y1] = profile[i];
      return THREE.MathUtils.lerp(r0, r1, THREE.MathUtils.clamp((y - y0) / (y1 - y0), 0, 1)) + 0.006 + 0.25 * Math.max(0, y - 0.3);
    };
    /**
     * Patch of another colour on the front, from `bottom` up to the collar, between the angles
     * `edges(y)` (radians, 0 at the middle) at each height, `lift` above the body.
     */
    const wrap = (color: string, bottom: number, edges: (y: number) => [number, number], lift = 0) => {
      const top = 0.345;
      const geometry = new THREE.PlaneGeometry(1, 1, 12, 10);
      const position = geometry.attributes.position;
      for (let i = 0; i < position.count; i++) {
        const u = position.getX(i) + 0.5; // 0–1 across
        const y = THREE.MathUtils.lerp(bottom, top, position.getY(i) + 0.5);
        const [from, to] = edges(y);
        const a = THREE.MathUtils.lerp(from, to, u);
        const r = bodyRadius(y) + lift;
        position.setXYZ(i, r * Math.sin(a), y, r * Math.cos(a));
      }
      geometry.computeVertexNormals();
      return part(geometry, cel(color, { side: THREE.DoubleSide }), 0);
    };
    /** V of another colour at the neck (cardigan, suit), from the collar down to `bottom`, `spread` radians wide at the top. */
    const vNeck = (color: string, bottom: number, spread: number) => wrap(color, bottom, (y) => {
      const half = (spread / 2) * (y - bottom) / (0.345 - bottom);
      return [-half, half];
    });

    /** Patch of another colour on the body, from height `bottom` to `top`, `spread` radians wide round `angle` (0 = the front). */
    const panel = (color: string | THREE.Material, bottom: number, top: number, spread: number, angle = 0, lift = 0) => {
      const geometry = new THREE.PlaneGeometry(1, 1, Math.ceil(spread * 10), 10);
      const position = geometry.attributes.position;
      for (let i = 0; i < position.count; i++) {
        const y = THREE.MathUtils.lerp(bottom, top, position.getY(i) + 0.5);
        const a = angle + position.getX(i) * spread;
        const r = bodyRadius(y) + lift;
        position.setXYZ(i, r * Math.sin(a), y, r * Math.cos(a));
      }
      geometry.computeVertexNormals();
      return part(geometry, typeof color === 'string' ? cel(color, { side: THREE.DoubleSide }) : color, 0);
    };

    if (robe) {
      // Wizard's robe, down to the ankles with a hood on the back: tied with a cord ('robe'), or the
      // school one ('schoolRobe'), open on a white shirt under a striped scarf.
      torso.add(part(smoothLathe([
        [0.0, -0.25], [f.hips * 1.8, -0.245], [f.hips * 1.55, -0.12], [f.hips * 1.2, 0.0], [f.waist * 1.06, 0.13], [0.0, 0.14],
      ]), top));
      const hood = part(new THREE.TorusGeometry(0.085, 0.042, 10, 24), top);
      hood.rotation.x = Math.PI / 2 + 0.5;
      hood.position.set(0, 0.33, -0.06);
      torso.add(hood);
      if (outfit === 'robe') {
        const cord = part(new THREE.TorusGeometry(f.waist * 1.1, 0.01, 8, 32), cel(shadeHex(this.look.top, -0.3)), 0);
        cord.rotation.x = Math.PI / 2;
        cord.position.y = 0.135;
        torso.add(cord);
      } else {
        torso.add(vNeck('#f7f3ee', 0.17, 1.1), this.scarf());
      }
      return torso;
    }

    if (outfit === 'hoodie') {
      const hood = part(new THREE.TorusGeometry(0.08, 0.038, 10, 24), top);
      hood.rotation.x = Math.PI / 2 + 0.4;
      hood.position.set(0, 0.34, -0.05);
      const pocketGeometry = new THREE.CylinderGeometry(f.waist * 1.08, f.chest * 0.99, 0.07, 20, 1, false, -0.6, 1.2);
      const pocket = part(pocketGeometry, trim, 0);
      pocket.position.y = 0.17;
      torso.add(hood, pocket);
      for (const side of [-1, 1]) {
        const string = part(new THREE.CylinderGeometry(0.005, 0.005, 0.08, 6), cel('#ffffff'), 0);
        string.position.set(side * 0.03, 0.29, f.chest * 0.98);
        string.rotation.x = 0.3;
        torso.add(string);
      }
    } else if (outfit === 'sweater') {
      torso.add(collar(0.072, 0.018));
    } else if (outfit === 'shirt') {
      // Pointed collar and buttons down the front.
      for (const side of [-1, 1]) {
        const flap = part(new THREE.ConeGeometry(0.035, 0.07, 3), cel(shadeHex(this.look.top, 0.12)), 0.003);
        flap.scale.z = 0.35;
        flap.rotation.set(-0.35, 0, Math.PI + side * 0.75);
        flap.position.set(side * 0.04, 0.325, 0.085);
        torso.add(flap);
      }
      for (const [y, r] of [[0.27, f.chest * 1.0], [0.2, f.chest * 0.99], [0.13, f.waist * 1.08]]) {
        const button = part(new THREE.SphereGeometry(0.009, 8, 6), cel('#f7f3ee'), 0);
        button.position.set(0, y, r);
        torso.add(button);
      }
    } else if (outfit === 'jacket') {
      // Open jacket over a light T-shirt.
      const tee = this.look.top === '#f7f3ee' ? '#2f3a56' : '#f7f3ee';
      torso.add(front(tee, 0.21, 0.24, 0.7), collar(0.075, 0.02, top));
    } else if (outfit === 'cardigan') {
      // Buttoned knit cardigan: a V neck over a light top, buttons down the front, ribbed edges.
      const under = this.look.top === '#f7f3ee' ? '#2b2b2e' : '#f7f3ee';
      torso.add(vNeck(under, 0.19, 1.3));
      const knit = cel(shadeHex(this.look.top, -0.08));
      for (const y of [0.165, 0.125, 0.085]) {
        const button = part(new THREE.SphereGeometry(0.011, 10, 8), cel(shadeHex(this.look.top, -0.3)), 0);
        button.scale.z = 0.6;
        button.position.set(0, y, bodyRadius(y));
        torso.add(button);
      }
      const band = part(new THREE.CylinderGeometry(f.hips * 1.09, f.hips * 1.1, 0.03, 28, 1, true), knit, 0);
      band.material.side = THREE.DoubleSide;
      band.position.y = 0.075;
      torso.add(band);
    } else if (outfit === 'suit') {
      // Suit jacket buttoned at the waist, open in a V on a shirt and a tie, with lapels along the V.
      const shirt = this.look.top === '#f7f3ee' ? '#2f3a56' : '#f7f3ee';
      const tie = this.look.top === '#b83a44' ? '#2f3a56' : '#b83a44';
      const point = 0.17;
      const vHalf = (y: number) => 0.55 * (y - point) / (0.345 - point);
      torso.add(vNeck(shirt, point, 1.1));
      for (const side of [-1, 1]) {
        torso.add(wrap(shadeHex(this.look.top, -0.14), point, (y) => {
          const t = (y - point) / (0.345 - point);
          const edge = side * vHalf(y);
          return [edge, edge + side * 0.55 * t * (1.15 - t)];
        }, 0.002));
      }
      // Narrow at the knot, wider below, tucked under the jacket where the V closes.
      torso.add(wrap(tie, point, (y) => {
        const half = Math.min(0.9 * vHalf(y), (y > 0.31 ? 0.013 : THREE.MathUtils.mapLinear(y, 0.31, 0.2, 0.008, 0.02)) / bodyRadius(y));
        return [-half, half];
      }, 0.003));
      for (const y of [0.15, 0.11]) {
        const button = part(new THREE.SphereGeometry(0.01, 10, 8), cel(shadeHex(this.look.top, -0.35)), 0);
        button.scale.z = 0.6;
        button.position.set(0, y, bodyRadius(y));
        torso.add(button);
      }
      torso.add(collar(0.072, 0.016, cel(shadeHex(this.look.top, -0.14))));
    } else if (outfit === 'overalls') {
      // Dungarees in the « Bas » colour over the top: high waist, a bib on the chest, straps over the
      // shoulders with a big button each.
      const denim = this.look.bottom;
      torso.add(panel(denim, 0.06, 0.14, Math.PI * 2, 0, 0.01), panel(denim, 0.12, 0.27, 0.95, 0, 0.004));
      for (const side of [-1, 1]) {
        torso.add(panel(denim, 0.24, 0.335, 0.16, side * 0.42, 0.002), panel(denim, 0.12, 0.335, 0.16, Math.PI - side * 0.42, 0.002));
        const button = part(new THREE.SphereGeometry(0.014, 12, 8), cel('#f4c04e', { rim: 0.5 }), 0.002);
        button.scale.z = 0.6;
        button.position.set(bodyRadius(0.255) * Math.sin(side * 0.4), 0.255, bodyRadius(0.255) * Math.cos(side * 0.4) + 0.004);
        torso.add(button);
      }
      const pocket = panel(shadeHex(denim, -0.12), 0.16, 0.22, 0.4, 0, 0.002);
      torso.add(pocket);
    } else if (outfit === 'tankTop') {
      // The adventurer's tank top, a leather belt round the shorts.
      const belt = part(new THREE.TorusGeometry(f.hips * 1.03, 0.012, 8, 32), cel('#4a3426', { rim: 0.3 }), 0.002);
      belt.rotation.x = Math.PI / 2;
      belt.scale.z = 1.6;
      belt.position.y = 0.075;
      const buckle = part(new THREE.BoxGeometry(0.03, 0.026, 0.008), cel('#c9a227', { rim: 0.5 }), 0.002);
      buckle.position.set(0, 0.075, f.hips * 1.06);
      torso.add(belt, buckle);
    } else if (outfit === 'heroSuit') {
      // The superhero's suit: blue down the sides, a black spider on the chest.
      const blue = this.look.bottom;
      for (const side of [-1, 1]) torso.add(panel(blue, 0.07, 0.3, 0.9, side * Math.PI / 2, 0.002));
      const spider = cel('#ffffff', { map: spiderTexture(), rim: 0, transparent: true, side: THREE.DoubleSide });
      torso.add(panel(spider, 0.16, 0.3, 0.75, 0, 0.003));
    } else if (outfit === 'jersey') {
      // Basketball jersey: white trims round the neck, the number 23 on the front and the back.
      torso.add(collar(0.072, 0.012, cel('#f7f3ee')));
      const number = cel('#ffffff', { map: numberTexture('23'), rim: 0, transparent: true, side: THREE.DoubleSide });
      torso.add(panel(number, 0.13, 0.28, 0.9, 0, 0.003), panel(number, 0.13, 0.28, 0.9, Math.PI, 0.003));
    }
    return torso;
  }

  /** Scarf in red and gold stripes, wound round the neck, its two ends hanging on the chest (torso units). */
  scarf(): THREE.Group {
    const group = new THREE.Group();
    const stripes = [cel('#b83a44', { rim: 0.2 }), cel('#f4c04e', { rim: 0.2 })];
    const pieces = 12;
    for (let i = 0; i < pieces; i++) {
      const piece = celMesh(new THREE.TorusGeometry(0.085, 0.03, 8, 4, (Math.PI * 2) / pieces + 0.01), stripes[i % 2], { outline: 0.003 });
      piece.rotation.set(Math.PI / 2, 0, (i * Math.PI * 2) / pieces);
      piece.position.y = 0.335;
      group.add(piece);
    }
    for (const [x, tilt, length] of [[-0.045, 0.1, 6], [0.035, -0.05, 5]]) {
      const end = new THREE.Group();
      for (let i = 0; i < length; i++) {
        const stripe = celMesh(new THREE.BoxGeometry(0.056, 0.028, 0.014), stripes[i % 2], { outline: 0.003 });
        stripe.position.y = -0.014 - i * 0.028;
        end.add(stripe);
      }
      end.position.set(x, 0.33, 0.165);
      end.rotation.set(-0.3, 0, tilt);
      group.add(end);
    }
    return group;
  }

  buildHead(mat: BodyMaterials): void {
    const {
      skin, hair, hairStyle, headwear, headwearColor, glasses, glassesColor, beard, mustache, beardColor, earrings, earringColor,
    } = this.look;
    const params = this.headParams;
    const face = cel('#ffffff', { map: this.faceTexture.texture, rim: 0.2, softness: 0.12, wrap: 0.3 });
    this.head.add(celMesh(headGeometry(params), face, { outline: 0.004 }));

    const masked = hidesFace(headwear);
    for (const side of masked ? [] : [-1, 1]) {
      const earGeometry = new THREE.SphereGeometry(1, 14, 10);
      earGeometry.scale(0.018, 0.036, 0.026);
      const ear = celMesh(earGeometry, mat.skin, { outline: 0.003 });
      ear.position.copy(surface(side * 1.52, -0.1, -0.004, params));
      ear.rotation.y = side * 0.35;
      this.head.add(ear);
    }

    if (!masked) this.head.add(buildNose({ skin, params }));

    if (!hidesHair(headwear)) this.head.add(buildHair(hairStyle, { color: hair, skin, params, hatted: coversHair(headwear), hatEdge: hatEdge(headwear) }));
    const facialHair = buildFacialHair(beard, mustache, { color: beardColor, params });
    if (facialHair) this.head.add(facialHair);

    const hat = buildHeadwear(headwear, { color: headwearColor, volume: HAIR_VOLUME[hairStyle] ?? 0.03, params });
    if (hat) this.head.add(hat);

    const { eyeSpacing, eyeSize } = DEFAULT_FACE;
    const specs = masked ? null : buildGlasses(glasses, { color: glassesColor, params, eyeSpacing, eyeSize });
    if (specs) this.head.add(specs);
    const rings = headwear === 'headscarf' || masked ? null : buildEarrings(earrings, { color: earringColor, params });
    if (rings) this.head.add(rings);
  }

  placeAt(point: THREE.Vector3): void {
    this.position.set(point.x, 0, point.z);
    this.path = [];
  }

  /** Walks through `points` in order, then calls `onArrive`. Replaces any current walk. */
  walk(points: THREE.Vector3[], onArrive: (() => void) | null = null): void {
    this.path = points.map((p) => p.clone());
    this.onArrive = onArrive;
    if (!this.path.length) this.arrive();
  }

  lookAt(point: THREE.Vector3): void {
    this.targetHeading = Math.atan2(point.x - this.position.x, point.z - this.position.z);
  }

  setExpression(expression: Expression): void {
    this.faceTexture.setExpression(expression);
  }

  /** Turns blinking off for still images (posters), or back on. */
  setBlinking(on: boolean): void {
    this.faceTexture.setBlink(false);
    this.blinkTimer = on ? 2 : Infinity;
  }

  hop(): void {
    this.hopTime = 0;
  }

  arrive(): void {
    const callback = this.onArrive;
    this.onArrive = null;
    callback?.();
  }

  update(dt: number, time: number): void {
    this.followPath(dt);

    const diff = Math.atan2(Math.sin(this.targetHeading - this.heading), Math.cos(this.targetHeading - this.heading));
    this.heading += diff * Math.min(1, TURN_RATE * dt);
    this.group.rotation.y = this.heading;

    this.animate(dt, time);
    this.straightenHeld();
    this.updateBlink(dt);
  }

  /** Keeps a held item that stands (the staff) upright in the character's frame, whatever the arm does. */
  straightenHeld(): void {
    for (const item of this.heldItems) {
      const upright = item.userData.upright;
      if (!upright) continue;
      const arm = item.parent!.getWorldQuaternion(new THREE.Quaternion());
      item.quaternion.copy(arm.invert().multiply(this.group.getWorldQuaternion(new THREE.Quaternion())).multiply(upright));
    }
  }

  followPath(dt: number): void {
    let step = WALK_SPEED * dt;
    while (this.path.length && step > 0) {
      const target = this.path[0];
      const dx = target.x - this.position.x;
      const dz = target.z - this.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist <= step) {
        this.position.x = target.x;
        this.position.z = target.z;
        step -= dist;
        this.path.shift();
        if (!this.path.length) this.arrive();
      } else {
        this.position.x += (dx / dist) * step;
        this.position.z += (dz / dist) * step;
        this.targetHeading = Math.atan2(dx, dz);
        step = 0;
      }
    }
  }

  animate(dt: number, time: number): void {
    const moving = this.path.length > 0;
    this.walkBlend = THREE.MathUtils.damp(this.walkBlend, moving ? 1 : 0, 10, dt);
    this.walkPhase += dt * 11 * this.walkBlend;
    const b = this.walkBlend;

    // Legs swing from the hips; the knee bends while the leg comes forward.
    this.legs.forEach(({ hip, knee }, i) => {
      const phase = this.walkPhase + i * Math.PI;
      hip.rotation.x = -Math.sin(phase) * 0.55 * b;
      knee.rotation.x = Math.max(0, Math.sin(phase + 1.3)) * 0.9 * b;
    });

    let lift = Math.abs(Math.cos(this.walkPhase)) * 0.025 * b;
    let armRaise = 0;
    if (this.hopTime >= 0) {
      this.hopTime += dt;
      const k = this.hopTime / HOP_DURATION;
      if (k >= 1) {
        this.hopTime = -1;
      } else {
        const arc = Math.sin(Math.PI * k);
        lift += arc * 0.16;
        armRaise = arc * 2.4;
      }
    }
    // Arms swing opposite to the legs, elbows a little bent.
    this.arms.forEach(({ shoulder, elbow }, i) => {
      const side = shoulder.userData.side;
      shoulder.rotation.x = Math.sin(this.walkPhase + i * Math.PI) * 0.5 * b;
      shoulder.rotation.z = side * (0.09 + armRaise);
      elbow.rotation.x = -0.15 - 0.35 * b;
    });

    this.rig.position.y = lift;
    this.torso.scale.y = 1 + Math.sin(time * 2.2) * 0.01;
    this.head.position.y = HEAD_Y + Math.sin(time * 2.2 - 0.4) * 0.004;
    this.head.rotation.z = Math.sin(time * 1.1) * 0.03 * (1 - b);
    this.head.rotation.x = 0.03 * b;
  }

  updateBlink(dt: number): void {
    this.blinkTimer -= dt;
    if (this.blinkTimer > 0) return;
    const closing = !this.faceTexture.blinking;
    this.faceTexture.setBlink(closing);
    this.blinkTimer = closing ? 0.12 : 2 + Math.random() * 3;
  }
}

