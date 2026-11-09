import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { LampSession } from '../session/lampSession';
import { createSmokePool } from './smokePuffs';

/** Default particle budget: the most Smoke puffs alive at once. Adaptive quality (#11) lowers it. */
export const DEFAULT_SMOKE_BUDGET = 400;

/**
 * How the Smoke moves.
 * - `rise`: puffs rise and drift from the spout, driven by Charge.
 * - `swirl-column`: the spinning column played during a Wish. The Smoke eases into and out of it.
 */
export type SmokeMode = 'rise' | 'swirl-column';

/**
 * Smoke released by dissolving Cards. Whoever dissolves Cards queues bursts here
 * (world positions); the Smoke releases and empties them on its next frame.
 */
export interface SmokeDissolve {
  readonly bursts: { x: number; y: number; z: number; count: number }[];
}

/** Seconds the Smoke takes to ease fully into or out of the swirl column. */
const SWIRL_EASE_SECONDS = 0.6;

export interface SmokeProps {
  session: LampSession;
  /** World position of the spout tip the Smoke rises from. */
  origin: THREE.Vector3Tuple;
  /** Most puffs alive at once. */
  budget?: number;
  mode?: SmokeMode;
  /** Where the previous Wish's Cards are dissolving into Smoke. */
  dissolve?: SmokeDissolve;
}

/** Overall puff opacity; additive puffs stack, so each one stays faint. */
const PUFF_OPACITY = 0.32;

const vertexShader = /* glsl */ `
  attribute vec4 aColor;
  attribute float aSeed;
  varying vec4 vColor;
  varying vec2 vUv;
  varying float vSeed;
  void main() {
    vColor = aColor;
    vUv = uv;
    vSeed = aSeed;
    // Billboard: place the quad's centre in view space, then offset its corners facing the camera.
    vec4 centre = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    float scale = length(instanceMatrix[0].xyz);
    float a = aSeed;
    vec2 corner = mat2(cos(a), sin(a), -sin(a), cos(a)) * position.xy;
    centre.xy += corner * scale;
    gl_Position = projectionMatrix * centre;
  }
`;

const fragmentShader = /* glsl */ `
  varying vec4 vColor;
  varying vec2 vUv;
  varying float vSeed;
  void main() {
    vec2 p = vUv - 0.5;
    float r = length(p) * 2.0;
    float ang = atan(p.y, p.x);
    // Lumpy edge so puffs read as wisps, not discs.
    float edge = 1.0 + 0.18 * sin(ang * 3.0 + vSeed * 7.0) + 0.1 * sin(ang * 5.0 - vSeed * 3.0);
    float soft = 1.0 - smoothstep(0.0, edge, r);
    float alpha = soft * soft * vColor.a;
    if (alpha < 0.002) discard;
    gl_FragColor = vec4(vColor.rgb * alpha, alpha);
  }
`;

/**
 * The Smoke rising from the Lamp's spout: a pool of soft, additive billboard puffs
 * whose density, size and colour follow the Lamp session's Charge.
 */
export function Smoke({ session, origin, budget = DEFAULT_SMOKE_BUDGET, mode = 'rise', dissolve }: SmokeProps) {
  const [pool] = useState(() => createSmokePool({ budget }));
  useEffect(() => {
    pool.budget = budget;
  }, [pool, budget]);

  const mesh = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(1, 1);
    const colors = new THREE.InstancedBufferAttribute(new Float32Array(budget * 4), 4);
    const seeds = new THREE.InstancedBufferAttribute(new Float32Array(budget), 1);
    colors.setUsage(THREE.DynamicDrawUsage);
    seeds.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aColor', colors);
    geometry.setAttribute('aSeed', seeds);
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      // Premultiplied additive: colour adds light, so overlapping puffs glow.
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
    });
    const m = new THREE.InstancedMesh(geometry, material, budget);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false;
    m.count = 0;
    return m;
  }, [budget]);

  useEffect(
    () => () => {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      mesh.dispose();
    },
    [mesh],
  );

  const matrix = useMemo(() => new THREE.Matrix4(), []);
  const swirl = useRef(0);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    const target = mode === 'swirl-column' ? 1 : 0;
    const easeStep = dt / SWIRL_EASE_SECONDS;
    swirl.current = target > swirl.current ? Math.min(target, swirl.current + easeStep) : Math.max(target, swirl.current - easeStep);
    if (dissolve) {
      for (const b of dissolve.bursts) pool.burst({ x: b.x - origin[0], y: b.y - origin[1], z: b.z - origin[2] }, b.count);
      dissolve.bursts.length = 0;
    }
    pool.step(dt, session.state.charge, swirl.current);

    const colors = mesh.geometry.getAttribute('aColor') as THREE.InstancedBufferAttribute;
    const seeds = mesh.geometry.getAttribute('aSeed') as THREE.InstancedBufferAttribute;
    const capacity = seeds.count;
    let n = 0;
    for (const p of pool.puffs) {
      if (!p.alive || n >= capacity) continue;
      matrix.makeScale(p.scale, p.scale, p.scale);
      matrix.setPosition(origin[0] + p.x, origin[1] + p.y, origin[2] + p.z);
      mesh.setMatrixAt(n, matrix);
      colors.setXYZW(n, p.r, p.g, p.b, p.opacity * PUFF_OPACITY);
      seeds.setX(n, p.seed);
      n++;
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    colors.needsUpdate = true;
    seeds.needsUpdate = true;
  });

  return <primitive object={mesh} />;
}
