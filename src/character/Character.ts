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
import { buildHeadwear, buildGlasses, buildEarrings, coversHair, hidesHair } from './accessories.ts';

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
const LONG_SLEEVES = ['hoodie', 'sweater', 'shirt', 'jacket', 'cardigan'];

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
  beard: 'none', // 'none' | 'stubble' | 'goatee' (always with the moustache) | 'short'
  mustache: 'none', // 'none' | 'thick'
  beardColor: '#4a3426',
  outfit: 'tshirt', // 'tshirt' | 'sweater' | 'shirt' | 'hoodie' | 'jacket' | 'cardigan' | 'dress'
  top: '#5b7fb8',
  bottom: '#2f3a56',
  shoes: '#f7f3ee',
  headwear: 'none', // 'none' | 'cap' | 'beanie' | 'headscarf'
  headwearColor: '#2f3a56',
  glasses: 'none', // 'none' | 'round' | 'square' | 'bold' | 'catEye' | 'browline'
  glassesColor: '#2b2d42', // see GLASSES_COLORS (the last one is clear plastic)
  earrings: 'none', // 'none' | 'studs' | 'hoops' | 'drops'
  earringColor: '#ffcf4a',
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
    const mat: BodyMaterials = { skin: cel(skin, { rim: 0.2 }), top: cel(top, { rim: 0.2 }), bottom: cel(bottom, { rim: 0.2 }), shoes: cel(shoes, { rim: 0.2 }) };
    const part = (geometry: THREE.BufferGeometry, material: THREE.Material, outline = OUTLINE) => celMesh(geometry, material, { outline });
    const legMat = outfit === 'dress' ? mat.skin : mat.bottom;

    // Legs: hip → knee → foot, short and round.
    this.legs = [-1, 1].map((side) => {
      const hip = joint(side * f.hips * 0.5, HIP_Y);
      const l = f.limbs;
      const thigh = part(limb(0.074 * l, 0.064 * l, THIGH), legMat);
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
    const neck = part(limb(0.055, 0.06, 0.1), mat.skin);
    neck.position.y = 0.8;
    this.rig.add(neck);

    // Arms: shoulder → elbow → round mitten hand.
    const longSleeves = LONG_SLEEVES.includes(outfit);
    this.arms = [-1, 1].map((side) => {
      const shoulder = joint(side * (f.shoulders - 0.015), SHOULDER_Y);
      shoulder.userData.side = side;
      const a = f.limbs;
      if (longSleeves) {
        shoulder.add(part(limb(0.056 * a, 0.05 * a, UPPER_ARM), mat.top));
      } else {
        shoulder.add(part(limb(0.05 * a, 0.045 * a, UPPER_ARM), mat.skin));
        shoulder.add(part(limb(0.062 * a, 0.059 * a, 0.06), mat.top));
      }
      const elbow = joint(0, -UPPER_ARM);
      elbow.add(part(limb(0.046 * a, 0.04 * a, FOREARM), longSleeves ? mat.top : mat.skin));
      const handGeometry = new THREE.SphereGeometry(1, 16, 12);
      handGeometry.scale(0.046 * a, 0.05 * a, 0.038 * a);
      const hand = part(handGeometry, mat.skin);
      hand.position.y = -FOREARM - 0.04;
      const thumbGeometry = new THREE.SphereGeometry(1, 10, 8);
      thumbGeometry.scale(0.014 * a, 0.022 * a, 0.014 * a);
      const thumb = part(thumbGeometry, mat.skin, 0);
      thumb.position.set(0, -FOREARM - 0.03, 0.03 * a);
      thumb.rotation.x = 0.5;
      elbow.add(hand, thumb);
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
    const hem = outfit === 'dress' ? 0.11 : 0.07;
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
    /** V of another colour at the neck (cardigan), from the collar down to `bottom`, `spread` radians wide at the top. */
    const vNeck = (color: string, bottom: number, spread: number) => {
      const top = 0.345;
      const geometry = new THREE.PlaneGeometry(1, 1, 12, 10);
      const position = geometry.attributes.position;
      for (let i = 0; i < position.count; i++) {
        const u = position.getX(i) + 0.5; // 0–1 across
        const v = position.getY(i) + 0.5; // 0 at the point, 1 at the collar
        const y = THREE.MathUtils.lerp(bottom, top, v);
        const a = (u - 0.5) * spread * v;
        const r = bodyRadius(y);
        position.setXYZ(i, r * Math.sin(a), y, r * Math.cos(a));
      }
      geometry.computeVertexNormals();
      return part(geometry, cel(color, { side: THREE.DoubleSide }), 0);
    };

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
    }
    return torso;
  }

  buildHead(mat: BodyMaterials): void {
    const {
      skin, hair, hairStyle, headwear, headwearColor, glasses, glassesColor, beard, mustache, beardColor, earrings, earringColor,
    } = this.look;
    const params = this.headParams;
    const face = cel('#ffffff', { map: this.faceTexture.texture, rim: 0.2, softness: 0.12, wrap: 0.3 });
    this.head.add(celMesh(headGeometry(params), face, { outline: 0.004 }));

    for (const side of [-1, 1]) {
      const earGeometry = new THREE.SphereGeometry(1, 14, 10);
      earGeometry.scale(0.018, 0.036, 0.026);
      const ear = celMesh(earGeometry, mat.skin, { outline: 0.003 });
      ear.position.copy(surface(side * 1.52, -0.1, -0.004, params));
      ear.rotation.y = side * 0.35;
      this.head.add(ear);
    }

    this.head.add(buildNose({ skin, params }));

    if (!hidesHair(headwear)) this.head.add(buildHair(hairStyle, { color: hair, skin, params, hatted: coversHair(headwear) }));
    const facialHair = buildFacialHair(beard, mustache, { color: beardColor, params });
    if (facialHair) this.head.add(facialHair);

    const hat = buildHeadwear(headwear, { color: headwearColor, volume: HAIR_VOLUME[hairStyle] ?? 0.03, params });
    if (hat) this.head.add(hat);

    const { eyeSpacing, eyeSize } = DEFAULT_FACE;
    const specs = buildGlasses(glasses, { color: glassesColor, params, eyeSpacing, eyeSize });
    if (specs) this.head.add(specs);
    const rings = headwear === 'headscarf' ? null : buildEarrings(earrings, { color: earringColor, params });
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
    this.updateBlink(dt);
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

