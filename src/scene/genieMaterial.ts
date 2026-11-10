import * as THREE from 'three';
import { GENIE_TAIL_END } from './genieGeometry';

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uBob;
  uniform float uTailEnd;
  attribute float aAlong;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vLocal;
  varying float vAlong;
  void main() {
    vec3 p = position;
    float tail = clamp(aAlong / uTailEnd, 0.0, 1.0);
    // The tail sways like smoke between its two fixed ends: the spout tip and the waist.
    float sway = sin(3.14159 * tail);
    p.x += sway * 0.07 * sin(uTime * 1.7 + aAlong * 11.0);
    p.z += sway * 0.09 * cos(uTime * 1.3 + aAlong * 8.0);
    // The torso bobs; the tail stretches to follow it.
    p += uBob * smoothstep(0.0, 1.0, tail);
    vec4 view = modelViewMatrix * vec4(p, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = -view.xyz;
    vLocal = p;
    vAlong = aAlong;
    gl_Position = projectionMatrix * view;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  uniform float uTailEnd;
  uniform vec3 uDeep;
  uniform vec3 uBody;
  uniform vec3 uRim;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vLocal;
  varying float vAlong;
  void main() {
    vec3 n = normalize(vNormal);
    vec3 v = normalize(vView);
    float facing = abs(dot(n, v));
    float rim = pow(1.0 - facing, 2.4);
    // Soft light from the upper right (where the candle is) and a touch from below (the Lamp's gold).
    float lit = 0.5 + 0.5 * dot(n, normalize(vec3(0.45, 0.75, 0.5)));
    float under = max(0.0, -n.y) * 0.5;
    vec3 colour = mix(uDeep, uBody, lit * lit) + vec3(0.5, 0.28, 0.08) * under * 0.35;
    colour += uRim * rim * 1.5;

    // The tail is smoke: thinner, streaked and brighter toward the spout.
    float solid = smoothstep(0.0, uTailEnd, vAlong);
    float streak = 0.5 + 0.5 * sin(vLocal.y * 16.0 - uTime * 3.5 + 3.0 * sin(vLocal.x * 7.0 + uTime));
    colour += uRim * (1.0 - solid) * (0.35 + 0.5 * streak);
    float alpha = mix(0.22 + 0.4 * streak, 0.97, solid);
    alpha = max(alpha, rim) * smoothstep(0.0, 0.06, vAlong) * uOpacity;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(colour, alpha);
  }
`;

export interface SpiritUniforms {
  [name: string]: THREE.IUniform;
  uTime: { value: number };
  uOpacity: { value: number };
  uBob: { value: THREE.Vector3 };
}

/**
 * The Genie's body: a deep violet spirit with a bright rim, turning to streaked smoke along its
 * tail. `shade` darkens it (for the brows).
 */
export function spiritMaterial(shade = 1): THREE.ShaderMaterial & { uniforms: SpiritUniforms } {
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 1 },
      uBob: { value: new THREE.Vector3() },
      uTailEnd: { value: GENIE_TAIL_END },
      uDeep: { value: new THREE.Color(0.035, 0.012, 0.16).multiplyScalar(shade) },
      uBody: { value: new THREE.Color(0.2, 0.13, 0.85).multiplyScalar(shade) },
      uRim: { value: new THREE.Color(0.45, 0.85, 1.7).multiplyScalar(shade) },
    },
  });
  return material as THREE.ShaderMaterial & { uniforms: SpiritUniforms };
}
