import * as THREE from 'three';

/** Expanding ring shown where the player tapped. */
export class ClickMarker {
  mesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  t: number;

  constructor() {
    this.mesh = new THREE.Mesh(
      new THREE.RingGeometry(0.22, 0.3, 32),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, depthWrite: false }),
    );
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.visible = false;
    this.t = 1;
  }

  show(point: THREE.Vector3): void {
    this.mesh.position.set(point.x, 0.035, point.z);
    this.mesh.visible = true;
    this.t = 0;
  }

  update(dt: number): void {
    if (!this.mesh.visible) return;
    this.t += dt / 0.6;
    if (this.t >= 1) {
      this.mesh.visible = false;
      return;
    }
    this.mesh.scale.setScalar(0.6 + this.t * 0.8);
    this.mesh.material.opacity = 1 - this.t;
  }
}

/** Soft square under the mouse cursor, on walkable tiles. */
export class TileHighlight {
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;

  constructor() {
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.92, 0.92),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, depthWrite: false }),
    );
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.visible = false;
  }

  show(point: THREE.Vector3): void {
    this.mesh.position.set(point.x, 0.03, point.z);
    this.mesh.visible = true;
  }

  hide(): void {
    this.mesh.visible = false;
  }
}
