import * as THREE from 'three';
import { aimCharacterLight } from '../render/celMaterial.ts';
import { LIGHT } from '../render/palette.ts';

const CAMERA_DISTANCE = 30;
// Zoom range around the fitted view (1): a little more air around the diorama, up to a close-up on the character.
export const MIN_ZOOM = 0.8;
export const MAX_ZOOM = 2.2;
// The camera turns a little around the room, either way: further on, a wall would turn edge-on.
export const MAX_TURN = THREE.MathUtils.degToRad(20);
// How fast the wheel and the buttons glide to their zoom and angle (per second).
const VIEW_EASE = 14;

/**
 * Renderer + orthographic camera at a true isometric angle, which the visitor can zoom, move and
 * turn a little. The view is fitted so that `viewSize` (world units) always stays visible,
 * whether the screen is landscape (PC) or portrait (tablet).
 */
export class IsoStage {
  container: HTMLElement;
  target: THREE.Vector3;
  viewSize: { width: number; height: number };
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  right: THREE.Vector3;
  up: THREE.Vector3;
  zoom: number;
  angle: number;
  pan: THREE.Vector2;
  goal: { zoom: number; angle: number; anchor: THREE.Vector2 };
  lastFrame: number;
  sunDirection!: THREE.Vector3;

  constructor(container: HTMLElement, { target, viewSize }: { target: THREE.Vector3; viewSize: { width: number; height: number } }) {
    this.container = container;
    this.target = target;
    this.viewSize = viewSize;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    this.right = new THREE.Vector3();
    this.up = new THREE.Vector3();

    // Zoom, angle around the room (0 = true isometric) and pan (in world units, along the screen) of
    // the view; `goal` is where the zoom and the angle glide to.
    this.zoom = 1;
    this.angle = 0;
    this.pan = new THREE.Vector2();
    this.goal = { zoom: 1, angle: 0, anchor: new THREE.Vector2() };
    this.lastFrame = 0;

    this.addLights();
    this.resize();
    new ResizeObserver(() => this.resize()).observe(container);
  }

  addLights(): void {
    const hemi = new THREE.HemisphereLight(LIGHT.sky, LIGHT.ground, 1.55);

    const sun = new THREE.DirectionalLight(LIGHT.sun, 2.0);
    sun.position.set(this.target.x + 6, 12, this.target.z + 8);
    sun.target.position.copy(this.target);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });

    this.scene.add(hemi, sun, sun.target);
    this.sunDirection = sun.position.clone().sub(this.target).normalize();
  }

  resize(): void {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    const aspect = width / height;

    let viewHeight = this.viewSize.height;
    if (viewHeight * aspect < this.viewSize.width) viewHeight = this.viewSize.width / aspect;

    Object.assign(this.camera, {
      left: (-viewHeight * aspect) / 2,
      right: (viewHeight * aspect) / 2,
      top: viewHeight / 2,
      bottom: -viewHeight / 2,
    });
    this.renderer.setSize(width, height);
    this.applyView();
  }

  get canZoomIn(): boolean {
    return this.goal.zoom < MAX_ZOOM - 1e-3;
  }

  get canZoomOut(): boolean {
    return this.goal.zoom > MIN_ZOOM + 1e-3;
  }

  /** Glides the zoom by `factor`, keeping the point under `anchor` (NDC, the centre by default) in place. */
  zoomBy(factor: number, anchor: THREE.Vector2 = new THREE.Vector2()): void {
    this.goal.zoom = THREE.MathUtils.clamp(this.goal.zoom * factor, MIN_ZOOM, MAX_ZOOM);
    this.goal.anchor.copy(anchor);
  }

  /** Can the camera still turn in the direction of `sign` (+1 or -1)? */
  canTurn(sign: number): boolean {
    return sign * this.goal.angle < MAX_TURN - 1e-3;
  }

  /** Glides the camera around the room by `angle` (radians; positive turns the room clockwise on screen). */
  turnBy(angle: number): void {
    this.goal.angle = THREE.MathUtils.clamp(this.goal.angle + angle, -MAX_TURN, MAX_TURN);
  }

  /** Turns the camera around the room by `angle` right away (drag, twist of two fingers). */
  turnNow(angle: number): void {
    this.angle = THREE.MathUtils.clamp(this.angle + angle, -MAX_TURN, MAX_TURN);
    this.goal.angle = this.angle;
    this.applyView();
  }

  /** Zooms by `factor` right away (pinch), keeping the point under `anchor` (NDC) in place. */
  zoomAt(factor: number, anchor: THREE.Vector2): void {
    const zoom = THREE.MathUtils.clamp(this.zoom * factor, MIN_ZOOM, MAX_ZOOM);
    const halfWidth = this.camera.right;
    const halfHeight = this.camera.top;
    this.pan.x += anchor.x * halfWidth * (1 / this.zoom - 1 / zoom);
    this.pan.y += anchor.y * halfHeight * (1 / this.zoom - 1 / zoom);
    this.zoom = zoom;
    this.goal.zoom = zoom;
    this.applyView();
  }

  /** Drags the view by a screen distance (CSS px): the room follows the finger. */
  panBy(dx: number, dy: number): void {
    const unitsPerPixel = (2 * this.camera.right) / this.zoom / this.container.clientWidth;
    this.pan.x -= dx * unitsPerPixel;
    this.pan.y += dy * unitsPerPixel;
    this.applyView();
  }

  /**
   * Places the camera. Zoomed in, the view can move but stays inside the fitted view, so the room
   * never slides off screen; zoomed out, it stays centred.
   */
  applyView(): void {
    const limitX = Math.max(0, this.camera.right * (1 - 1 / this.zoom));
    const limitY = Math.max(0, this.camera.top * (1 - 1 / this.zoom));
    this.pan.x = THREE.MathUtils.clamp(this.pan.x, -limitX, limitX);
    this.pan.y = THREE.MathUtils.clamp(this.pan.y, -limitY, limitY);

    // Isometric direction (from +X +Z, 35° above the floor), turned around the vertical axis so that
    // a positive angle turns the room clockwise on screen.
    const offset = CAMERA_DISTANCE / Math.sqrt(3);
    this.camera.position.set(offset, offset, offset).applyAxisAngle(THREE.Object3D.DEFAULT_UP, -this.angle).add(this.target);
    this.camera.lookAt(this.target);
    this.right.set(1, 0, 0).applyQuaternion(this.camera.quaternion);
    this.up.set(0, 1, 0).applyQuaternion(this.camera.quaternion);
    this.camera.position.addScaledVector(this.right, this.pan.x).addScaledVector(this.up, this.pan.y);
    this.camera.zoom = this.zoom;
    this.camera.updateProjectionMatrix();
  }

  render(): void {
    const now = performance.now();
    const dt = Math.min((now - this.lastFrame) / 1000, 0.05);
    this.lastFrame = now;
    const ease = 1 - Math.exp(-VIEW_EASE * dt);
    if (Math.abs(this.goal.zoom - this.zoom) > 1e-4) {
      const zoom = THREE.MathUtils.lerp(this.zoom, this.goal.zoom, ease);
      const goal = this.goal.zoom;
      this.zoomAt(zoom / this.zoom, this.goal.anchor);
      this.goal.zoom = goal;
    }
    if (Math.abs(this.goal.angle - this.angle) > 1e-4) {
      this.angle = THREE.MathUtils.lerp(this.angle, this.goal.angle, ease);
      this.applyView();
    }
    aimCharacterLight(this.sunDirection);
    this.renderer.render(this.scene, this.camera);
  }
}
