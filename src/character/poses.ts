import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { cel, celMesh } from '../render/celMaterial.ts';
import type { Character } from './Character.ts';

// Still poses for the poster studio, applied over the idle animation (call after `Character.update`).
// Angles in radians. Arms: `out` raises the arm sideways, `fwd` forwards; `bendOut` and `bend` fold the
// elbow the same ways (negative = inwards). Legs: `out` spreads them, `fwd` lifts them, `knee` folds back.
// `left` is the character's left (+X), seen on the right of the poster.
// These poses are shared by every trade: a trade picks the ones it offers and the domain that unlocks
// each (`studio` in the trade's module), and may add its own (Photographe, in media).
// `props`: what the hands hold (see `hold()`). Once the visitor has made the trade's object (its
// `creation`, see `setCreation()`), every pose holds it: `withCreation` then replaces the arms and props
// it lists. `needsCreation`: the pose only exists with the object.
/** Angles of an arm, in radians (see above). */
export interface ArmPose { out?: number; fwd?: number; bendOut?: number; bend?: number }
export interface LegPose { out?: number; fwd?: number; knee?: number }

/** How a prop sits in the hands (see `hold()`). */
export interface Grip {
  hand?: 'left' | 'right' | 'both';
  grip?: [number, number] | [number, number, number];
  depth?: number;
  lean?: number;
  turn?: number;
  tilt?: number;
}

export interface PoseJoints {
  leftArm?: ArmPose;
  rightArm?: ArmPose;
  leftLeg?: LegPose;
  rightLeg?: LegPose;
  head?: { tilt?: number; nod?: number; turn?: number };
  lift?: number;
  /** By prop id ('creation' for the object the visitor made), how it is held. */
  props?: Record<string, Grip>;
}

export interface Pose extends PoseJoints {
  id: string;
  label: string;
  needsCreation?: boolean;
  withCreation?: PoseJoints;
  /** Id of the skill that unlocks it, set by poster/unlocks.ts from the trade's `studio.unlocks`. */
  skill?: string;
}

export const POSES: Pose[] = [
  {
    id: 'proud', label: 'Fier·ère', needsCreation: true,
    leftArm: { fwd: 0.8, out: 0.08, bend: 1.0, bendOut: -0.3 },
    rightArm: { fwd: 0.8, out: 0.08, bend: 1.0, bendOut: -0.3 },
    head: { tilt: -0.08, nod: -0.04 },
    props: { creation: { hand: 'both', grip: [0, 0.1], lean: -0.12 } },
  },
  {
    id: 'wave', label: 'Coucou',
    leftArm: { out: 1.15, bendOut: 1.75, fwd: 0.15 },
    rightArm: { out: 0.12, bend: 0.2 },
    head: { tilt: -0.1 },
    withCreation: {
      rightArm: { out: 0.32, fwd: 0.2, bend: 0.25 },
      props: { creation: { hand: 'right', grip: [0.55, 0.8], depth: 0.03, tilt: -0.1, turn: 0.15 } },
    },
  },
  {
    id: 'cheer', label: 'Youpi !',
    leftArm: { out: 2.55, bendOut: -0.35 },
    rightArm: { out: 2.55, bendOut: -0.35 },
    leftLeg: { out: 0.1, fwd: 0.35, knee: 0.9 },
    rightLeg: { out: 0.1, fwd: -0.15, knee: 0.5 },
    head: { nod: -0.08 },
    lift: 0.09,
    withCreation: {
      rightArm: { out: 1.9, fwd: 0.25, bendOut: -0.25 },
      props: { creation: { hand: 'right', grip: [0, -0.8], depth: 0.03, tilt: 0.12 } },
    },
  },
  {
    id: 'hero', label: 'Héroïque',
    leftArm: { out: 0.6, bendOut: -2.0, bend: 0.25 },
    rightArm: { out: 0.6, bendOut: -2.0, bend: 0.25 },
    leftLeg: { out: 0.13 },
    rightLeg: { out: 0.13 },
    head: { nod: -0.07 },
    withCreation: {
      rightArm: { out: 0.45, fwd: 0.1, bend: 0.1 },
      props: { creation: { hand: 'right', grip: [0, 0.95], depth: 0.03, tilt: -0.08 } },
    },
  },
];

/** The object the visitor made, as a character holds it (see setCreation()). */
export interface HeldCreation {
  mesh(): THREE.Object3D;
  holds?: Record<string, Grip>;
}

type PropMesh = THREE.Mesh<THREE.BufferGeometry, THREE.Material & { map?: THREE.Texture | null }>;

const REST_ARM: Required<ArmPose> = { out: 0.09, fwd: 0, bendOut: 0, bend: 0.15 };
const REST_LEG: Required<LegPose> = { out: 0, fwd: 0, knee: 0 };
// From the elbow joint to the middle of the hand (see Character.build).
const HAND = new THREE.Vector3(0, -0.14, 0);
const props = new WeakMap<Character, Map<string, THREE.Object3D>>(); // character → Map(id → mesh) of the props it holds
const creations = new WeakMap<Character, HeldCreation>(); // character → { mesh(), holds } of the object it made

/**
 * Gives `character` the object the visitor made, held in every pose: `mesh()` builds it (a
 * THREE.Object3D whose `userData.size` is { w, h, d }, centred on its middle), and `holds`, by pose id,
 * overrides how a pose holds it (grip, depth, rotation; see `hold()`). Null takes it away.
 */
export function setCreation(character: Character, creation: HeldCreation | null): void {
  if (creation) creations.set(character, creation);
  else creations.delete(character);
  removeProp(character, 'creation'); // rebuilt by the next applyPose()
}

/** Sets the joints of `character` to `pose` (or does nothing for null, the idle animation). */
export function applyPose(character: Character, pose: Pose | null | undefined): void {
  const creation = creations.get(character);
  const held = pose && creation ? { ...pose, ...pose.withCreation } : pose;
  const holds = Object.entries(held?.props ?? {})
    .filter(([id]) => id !== 'creation' || creation)
    .map(([id, grip]): [string, Grip] => [id, id === 'creation' ? { ...grip, ...creation!.holds?.[pose!.id] } : grip]);
  setProps(character, holds.map(([id]) => id));
  if (!held) return;

  character.arms.forEach(({ shoulder, elbow }) => {
    const side = shoulder.userData.side;
    const arm = { ...REST_ARM, ...(side > 0 ? held.leftArm : held.rightArm) };
    shoulder.rotation.set(-arm.fwd, 0, side * arm.out);
    elbow.rotation.set(-arm.bend, 0, side * arm.bendOut);
  });
  // Legs are built right (−X) then left (+X).
  character.legs.forEach(({ hip, knee }, i) => {
    const side = i ? 1 : -1;
    const leg = { ...REST_LEG, ...(side > 0 ? held.leftLeg : held.rightLeg) };
    hip.rotation.set(-leg.fwd, 0, side * leg.out);
    knee.rotation.x = leg.knee;
  });
  const { tilt = 0, nod = 0, turn = 0 } = held.head ?? {};
  character.head.rotation.set(nod, turn, tilt);
  character.rig.position.y = held.lift ?? 0;

  for (const [id, grip] of holds) hold(character, props.get(character)!.get(id)!, grip);
}

/** Keeps exactly the props `ids` in the character's group (they live outside the rebuilt rig). */
function setProps(character: Character, ids: string[]): void {
  if (!props.has(character)) props.set(character, new Map());
  const current = props.get(character)!;
  for (const id of current.keys()) if (!ids.includes(id)) removeProp(character, id);
  for (const id of ids) {
    if (current.has(id)) continue;
    const mesh = id === 'creation' ? creations.get(character)!.mesh() : PROPS[id]();
    character.group.add(mesh);
    current.set(id, mesh);
  }
}

function removeProp(character: Character, id: string): void {
  const mesh = props.get(character)?.get(id);
  if (!mesh) return;
  character.group.remove(mesh);
  mesh.traverse((child) => {
    if (!(child as PropMesh).isMesh || child.userData.outline) return;
    (child as PropMesh).geometry.dispose();
    (child as PropMesh).material.map?.dispose();
    (child as PropMesh).material.dispose();
  });
  props.get(character)!.delete(id);
}

/**
 * Puts a prop in the hands: `hand` ('left', 'right' or 'both': between them), `grip` the point of the
 * prop that sits in the hand (from its centre, in half-widths, half-heights and, optionally,
 * half-depths), `depth` how far the hand is in front of it, and its rotation (`lean` forwards, `turn`
 * around the vertical, `tilt` sideways).
 */
function hold(
  character: Character, mesh: THREE.Object3D, { hand = 'both', grip = [0, 0], depth = 0, lean = 0, turn = 0, tilt = 0 }: Grip,
): void {
  const { group } = character;
  group.updateMatrixWorld(true);
  const arms = character.arms.filter(({ shoulder }) => hand === 'both' || (hand === 'left') === shoulder.userData.side > 0);
  const point = new THREE.Vector3();
  for (const { elbow } of arms) point.add(elbow.localToWorld(HAND.clone()));
  group.worldToLocal(point.divideScalar(arms.length));
  mesh.rotation.set(lean, turn, tilt);
  const { w = 0, h = 0, d = 0 } = mesh.userData.size ?? {};
  const offset = new THREE.Vector3((grip[0] * w) / 2, (grip[1] * h) / 2, ((grip[2] ?? 0) * d) / 2 + depth).applyEuler(mesh.rotation);
  mesh.position.copy(point).sub(offset);
}

// Props of the poses that hold something, by id (the object the visitor made is the 'creation').
export const PROPS: Record<string, () => THREE.Object3D> = {
  /** Small reflex camera facing forwards, the lens towards the viewer. */
  camera() {
    const camera = new THREE.Group();
    const part = (geometry: THREE.BufferGeometry, color: string, x: number, y: number, z: number, outline = 0.004) => {
      const m = celMesh(geometry, cel(color, { rim: 0.25 }), { outline });
      m.position.set(x, y, z);
      camera.add(m);
      return m;
    };
    part(new RoundedBoxGeometry(0.19, 0.115, 0.075, 2, 0.02), '#2b2d42', 0, 0, 0);
    part(new RoundedBoxGeometry(0.06, 0.04, 0.06, 2, 0.012), '#2b2d42', -0.02, 0.07, -0.005);
    part(new RoundedBoxGeometry(0.035, 0.02, 0.03, 1, 0.006), '#ffffff', 0.06, 0.065, 0);
    part(new RoundedBoxGeometry(0.035, 0.1, 0.02, 2, 0.008), '#ff6584', -0.085, -0.005, 0.03);
    const lens = part(new THREE.CylinderGeometry(0.044, 0.048, 0.07, 24), '#3a3a3a', 0.01, -0.005, 0.065);
    lens.rotation.x = Math.PI / 2;
    part(new THREE.TorusGeometry(0.044, 0.008, 8, 24), '#ffc83d', 0.01, -0.005, 0.1, 0);
    part(new THREE.CircleGeometry(0.034, 24), '#5aa9ff', 0.01, -0.005, 0.101, 0);
    return camera;
  },
};
