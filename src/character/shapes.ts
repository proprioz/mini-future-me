import * as THREE from 'three';

// Geometry helpers for the procedural characters.

/**
 * Rounded, tapered limb along -Y from its joint at the origin: radius r0 at the joint, r1 at the
 * far end, `length` between the two sphere centres.
 */
export function limb(r0: number, r1: number, length: number, radial = 18): THREE.LatheGeometry {
  const points: THREE.Vector2[] = [];
  const steps = 8;
  for (let i = 0; i <= steps; i++) {
    const a = (Math.PI / 2) * (1 - i / steps); // top cap: from the pole down to the equator
    points.push(new THREE.Vector2(r0 * Math.cos(a), r0 * Math.sin(a)));
  }
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    points.push(new THREE.Vector2(THREE.MathUtils.lerp(r0, r1, t), -length * t));
  }
  for (let i = 0; i <= steps; i++) {
    const a = (Math.PI / 2) * (i / steps);
    points.push(new THREE.Vector2(r1 * Math.cos(a), -length - r1 * Math.sin(a)));
  }
  // LatheGeometry wants the profile from bottom to top.
  return new THREE.LatheGeometry(points.reverse(), radial);
}

/** Smooth solid of revolution through [radius, y] control points (bottom → top), closed at both ends. */
export function smoothLathe(controls: [number, number][], radial = 28, samples = 40): THREE.LatheGeometry {
  const curve = new THREE.SplineCurve(controls.map(([r, y]) => new THREE.Vector2(r, y)));
  const points = curve.getPoints(samples).map((p) => new THREE.Vector2(Math.max(0, p.x), p.y));
  return new THREE.LatheGeometry(points, radial);
}

/**
 * Tube swept along `curve`, whose radius follows `radius(t)` (t from 0 to 1), with an elliptic
 * section (`flatten` < 1 squashes it along the curve's binormal): hair locks, mustaches…
 */
export function sweep(
  curve: THREE.Curve<THREE.Vector3>, radius: (t: number) => number,
  { segments = 24, radial = 10, flatten = 1 }: { segments?: number; radial?: number; flatten?: number } = {},
): THREE.BufferGeometry {
  const frames = curve.computeFrenetFrames(segments, false);
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const center = curve.getPointAt(t);
    const r = radius(t);
    const { normals, binormals } = frames;
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const p = center.clone()
        .addScaledVector(normals[i], Math.cos(a) * r)
        .addScaledVector(binormals[i], Math.sin(a) * r * flatten);
      positions.push(p.x, p.y, p.z);
      uvs.push(j / radial, t);
    }
  }
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j;
      const b = a + radial + 1;
      indices.push(a, a + 1, b, b, a + 1, b + 1); // counter-clockwise seen from outside
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return smoothSeams(geometry);
}

/** Averages the normals of vertices sharing a position (UV seams, poles), so no shading crease shows. */
export function smoothSeams<G extends THREE.BufferGeometry>(geometry: G): G {
  const pos = geometry.attributes.position;
  const normal = geometry.attributes.normal;
  const groups = new Map<string, number[]>();
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(i);
  }
  const n = new THREE.Vector3();
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    n.set(0, 0, 0);
    for (const i of members) n.add({ x: normal.getX(i), y: normal.getY(i), z: normal.getZ(i) });
    n.normalize();
    for (const i of members) normal.setXYZ(i, n.x, n.y, n.z);
  }
  normal.needsUpdate = true;
  return geometry;
}
