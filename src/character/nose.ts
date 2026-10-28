import * as THREE from 'three';
import { cel, celMesh } from '../render/celMaterial.ts';
import { FEATURES, surface, surfaceNormal } from './head.ts';
import type { HeadParams } from './head.ts';

// Small modelled nose, the same for everyone: a soft rounded tip ("fleshy", the most common type),
// so it reads as a cartoon nose rather than a portrait of anyone's.

const TIP = [0.03, 0.024, 0.022]; // ellipsoid radii (x, y, z) in head units

export function buildNose({ skin, params }: { skin: string; params: HeadParams }): THREE.Mesh {
  const material = cel(skin, { rim: 0.15, softness: 0.1, wrap: 0.1 });
  const lat = FEATURES.noseLat;
  const [rx, ry, rz] = TIP;
  const geometry = new THREE.SphereGeometry(1, 20, 14);
  geometry.scale(rx, ry, rz);
  const tip = celMesh(geometry, material, { outline: 0 });
  tip.position.copy(surface(0, lat, rz * 0.3, params));
  tip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), surfaceNormal(0, lat * 0.5));
  return tip;
}
