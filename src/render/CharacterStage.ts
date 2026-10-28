import * as THREE from 'three';
import { cylinder } from './materials.ts';
import { aimCharacterLight } from './celMaterial.ts';
import { PALETTE, LIGHT } from './palette.ts';

const FOV = 26;

/** What a view keeps in frame (see VIEWS). */
export interface StageView {
  target: THREE.Vector3;
  height: number;
  width: number;
  lift: number;
}

// What each view keeps in frame: a vertical span (world units) centred on `target`, plus a minimum width.
const VIEWS = {
  stage: { target: new THREE.Vector3(0, 0.68, 0), height: 1.65, width: 1.3, lift: 0.3 },
  body: { target: new THREE.Vector3(0, 0.68, 0), height: 1.45, width: 0.95, lift: 0.2 },
  head: { target: new THREE.Vector3(0, 1.08, 0), height: 0.92, width: 0.92, lift: 0.05 },
  portrait: { target: new THREE.Vector3(0, 1.04, 0), height: 0.7, width: 0.7, lift: 0.03 },
  face: { target: new THREE.Vector3(0, 1.02, 0), height: 0.48, width: 0.48, lift: 0.02 },
} satisfies Record<string, StageView>;

export type ViewName = keyof typeof VIEWS;

/**
 * Small perspective scene showing one character face-on, used by the "Crée ton perso" screen
 * (live preview) and for rendering the option thumbnails.
 */
export class CharacterStage {
  renderer: THREE.WebGLRenderer;
  canvas: HTMLCanvasElement;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  view: StageView;
  sunDirection!: THREE.Vector3;

  constructor({ pedestal = true, shadows = true }: { pedestal?: boolean; shadows?: boolean } = {}) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = shadows;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.canvas = this.renderer.domElement;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 50);
    this.view = VIEWS.stage;
    this.addLights(shadows);

    if (pedestal) {
      // Same look as the game diorama: white top on a thick teal base.
      const top = cylinder(0.75, 0.75, 0.06, PALETTE.paper, undefined, 48);
      top.position.y = -0.03;
      const base = cylinder(0.78, 0.82, 0.3, PALETTE.tealDeep, undefined, 48);
      base.position.y = -0.21;
      for (const disc of [top, base]) {
        disc.castShadow = false;
        this.scene.add(disc);
      }
    }
  }

  addLights(shadows: boolean): void {
    const hemi = new THREE.HemisphereLight(LIGHT.sky, LIGHT.ground, 1.6);
    const sun = new THREE.DirectionalLight(LIGHT.sun, 2.0);
    sun.position.set(2.5, 5, 4);
    sun.castShadow = shadows;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    Object.assign(sun.shadow.camera, { left: -1.5, right: 1.5, top: 2.5, bottom: -0.5, near: 1, far: 12 });
    this.scene.add(hemi, sun);
    this.sunDirection = sun.position.clone().normalize();
  }

  /** A view name from VIEWS, or a custom { target, height, width, lift }. */
  setView(view: ViewName | StageView): void {
    this.view = typeof view === 'string' ? VIEWS[view] : view;
    this.updateCamera();
  }

  setSize(width: number, height: number): void {
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.updateCamera();
  }

  updateCamera(): void {
    const { target, height, width, lift } = this.view;
    const halfFov = THREE.MathUtils.degToRad(FOV / 2);
    const span = Math.max(height, width / this.camera.aspect);
    const distance = span / 2 / Math.tan(halfFov);
    this.camera.position.set(target.x, target.y + lift, target.z + distance);
    this.camera.lookAt(target.x, target.y + lift * 0.2, target.z);
    this.camera.updateProjectionMatrix();
  }

  render(): void {
    aimCharacterLight(this.sunDirection);
    this.renderer.render(this.scene, this.camera);
  }
}
