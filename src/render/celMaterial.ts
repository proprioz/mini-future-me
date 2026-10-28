import * as THREE from 'three';

// Cel shading for the characters, in the spirit of Breath of the Wild / Genshin Impact, lit like a
// photo studio: the sun is the key light (one crisp light/shadow split); in the shadow, a warm bounce
// from the floor and a cool sky from above keep the colours alive (no grey mud), and a soft fill from
// the camera opens up whatever faces the viewer; a back light draws a thin edge of lagoon light on the
// shadow side of the silhouette. Inked outline (inverted hull).

/** Shared by every character material: each stage aims it with `aimCharacterLight()` before rendering. */
export const CHARACTER_LIGHT = {
  direction: new THREE.Vector3(0.45, 0.8, 0.4).normalize(), // key light (the sun)
  back: new THREE.Vector3(-0.45, 0.5, -0.4).normalize(), // back light, across from the key
};

/** Points the key light along `sunDirection` and puts the back light across from it, behind the character. */
export function aimCharacterLight(sunDirection: THREE.Vector3): void {
  CHARACTER_LIGHT.direction.copy(sunDirection);
  CHARACTER_LIGHT.back.set(-sunDirection.x, 0.5, -sunDirection.z).normalize();
}

// Multiplied with the albedo in the shadow: the floor's warm bounce below, the sky's cool light above.
const SHADOW_GROUND = new THREE.Color('#e5cac4');
const SHADOW_SKY = new THREE.Color('#c9c0dc');
const RIM_COLOR = new THREE.Color('#fff4e0');
const BACK_COLOR = new THREE.Color('#d9fff7');

const vertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec2 vUv;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vNormal = normalize(mat3(modelMatrix) * normal);
    // Towards the camera: for an orthographic camera, its +Z axis in world space.
    vViewDir = isOrthographic ? normalize(vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]))
      : normalize(cameraPosition - world.xyz);
    vUv = uv;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 color;
  uniform sampler2D map;
  uniform bool useMap;
  uniform vec3 lightDir;
  uniform vec3 backDir;
  uniform vec3 shadowGround;
  uniform vec3 shadowSky;
  uniform vec3 rimColor;
  uniform vec3 backColor;
  uniform float rim;
  uniform float softness;
  uniform float wrap;
  uniform float opacity;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec2 vUv;
  void main() {
    vec3 n = normalize(vNormal);
    if (!gl_FrontFacing) n = -n;
    vec3 v = normalize(vViewDir);
    vec4 albedo = vec4(color, opacity);
    if (useMap) albedo *= texture2D(map, vUv);
    if (albedo.a < 0.01) discard; // see-through parts of a texture (beard edges) don't hide what's behind
    float ndl = dot(n, normalize(lightDir));
    float lit = smoothstep(-softness, softness, ndl - 0.05 + wrap);
    // Second, softer band so large shapes keep some volume in the light.
    float band = mix(0.9, 1.0, smoothstep(0.35, 0.55, ndl));
    // Shadow side: warm from below, cool from above, opened up where it faces the camera (fill light).
    vec3 ambient = mix(shadowGround, shadowSky, smoothstep(-0.6, 0.6, n.y));
    float fill = smoothstep(0.2, 1.0, dot(n, v));
    vec3 shadow = albedo.rgb * mix(ambient, vec3(0.95), 0.4 * fill);
    // Colours stay rich in the shadow instead of turning grey.
    shadow = max(mix(vec3(dot(shadow, vec3(0.2126, 0.7152, 0.0722))), shadow, 1.05), 0.0);
    vec3 shaded = mix(shadow, albedo.rgb * band, lit);
    float facing = max(dot(n, v), 0.0);
    float fresnel = pow(1.0 - facing, 4.0);
    shaded += rimColor * fresnel * rim * (0.2 + 0.5 * lit);
    // Back light: a thin edge along the silhouette, on the side turned towards it, tinted by the surface.
    float edge = smoothstep(0.6, 0.85, 1.0 - facing) * smoothstep(0.0, 0.35, dot(n, normalize(backDir)));
    shaded += backColor * mix(albedo.rgb, vec3(1.0), 0.4) * edge * min(rim * 2.0, 0.6) * (1.0 - 0.6 * lit);
    gl_FragColor = vec4(shaded, albedo.a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/**
 * Cel-shaded material. `softness`: width of the light/shadow transition (faces get a softer one);
 * `wrap`: how far the key light wraps round the shape (the face, lit like a portrait, keeps its cheeks
 * and chin in the light).
 */
export interface CelOptions {
  map?: THREE.Texture | null;
  rim?: number;
  softness?: number;
  wrap?: number;
  transparent?: boolean;
  opacity?: number;
  side?: THREE.Side;
}

export function cel(color: THREE.ColorRepresentation, {
  map = null, rim = 0.35, softness = 0.04, wrap = 0, transparent = false, opacity = 1, side = THREE.FrontSide,
}: CelOptions = {}): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      color: { value: new THREE.Color(color) },
      map: { value: map },
      useMap: { value: Boolean(map) },
      lightDir: { value: CHARACTER_LIGHT.direction },
      backDir: { value: CHARACTER_LIGHT.back },
      shadowGround: { value: SHADOW_GROUND },
      shadowSky: { value: SHADOW_SKY },
      rimColor: { value: RIM_COLOR },
      backColor: { value: BACK_COLOR },
      rim: { value: rim },
      softness: { value: softness },
      wrap: { value: wrap },
      opacity: { value: opacity },
    },
    vertexShader,
    fragmentShader,
    transparent,
    side,
  });
}

const outlineVertex = /* glsl */ `
  uniform float thickness;
  void main() {
    vec3 p = position + normalize(normal) * thickness;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const outlineFragment = /* glsl */ `
  uniform vec3 color;
  void main() {
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

const outlineMaterials = new Map<string, THREE.ShaderMaterial>();

/** Inked contour: back faces pushed out along the normals (`thickness` in local units). */
export function outlineMaterial(thickness = 0.006, color: THREE.ColorRepresentation = '#3a2620'): THREE.ShaderMaterial {
  const key = `${thickness}|${color}`;
  if (!outlineMaterials.has(key)) {
    outlineMaterials.set(key, new THREE.ShaderMaterial({
      uniforms: { thickness: { value: thickness }, color: { value: new THREE.Color(color) } },
      vertexShader: outlineVertex,
      fragmentShader: outlineFragment,
      side: THREE.BackSide,
    }));
  }
  return outlineMaterials.get(key)!;
}

/** Cel-shaded mesh with its outline as a child (shares the geometry). */
export interface CelMeshOptions {
  outline?: number;
  shadow?: boolean;
}

export function celMesh<G extends THREE.BufferGeometry, M extends THREE.Material | THREE.Material[]>(
  geometry: G, material: M, { outline = 0.006, shadow = true }: CelMeshOptions = {},
): THREE.Mesh<G, M> {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = shadow;
  if (outline) {
    const ink = new THREE.Mesh(geometry, outlineMaterial(outline));
    ink.userData.outline = true;
    ink.raycast = () => {};
    m.add(ink);
  }
  return m;
}
