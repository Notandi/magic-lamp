import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { LampSession } from '../session/lampSession';
import { damp } from '../math';
import { GENIE_HEIGHTS, GENIE_TORSO, buildGenieGeometry } from './genieGeometry';
import { spiritMaterial } from './genieMaterial';
import { geniePose, stepGenie, type GenieStage } from './genieMotion';
import type { SmokeDissolve } from './Smoke';

/** Smoke puffs released per frame along the Genie while it is drawn back into the Lamp. */
const LEAVING_PUFFS_PER_FRAME = 2;
/** Brightness of the light the Genie casts on the Lamp and the Cards. */
const GENIE_LIGHT = 14;

function useGenieParts() {
  const parts = useMemo(() => {
    const geometry = buildGenieGeometry();
    const gold = new THREE.MeshStandardMaterial({ color: 0xf2b84b, metalness: 1, roughness: 0.3, transparent: true });
    return {
      geometry,
      /** The tail and torso, which sway and bob in the shader. */
      body: spiritMaterial(),
      /** The head and arms, which are moved as whole pieces. */
      limbs: spiritMaterial(),
      brows: spiritMaterial(0.25),
      gold,
      /** Eyes and smile: bright enough to bloom. */
      glow: new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.6, 1.5), transparent: true }),
    };
  }, []);
  useEffect(
    () => () => {
      const g = parts.geometry;
      const geometries = [g.body, g.torsoGold, ...Object.values(g.head), ...g.arms.flatMap((arm) => [arm.spirit, arm.cuff])];
      for (const geometry of geometries) geometry.dispose();
      for (const material of [parts.body, parts.limbs, parts.brows, parts.gold, parts.glow]) material.dispose();
    },
    [parts],
  );
  return parts;
}

/**
 * The Genie: it pours out of the Lamp's spout when a Wish starts, opens its arms to offer the
 * Wish's Cards, hovers over the Lamp while they're on show, and is drawn back in when they go.
 * It writes its progress to `stage`, which the Cards wait on.
 */
export function Genie({
  session,
  origin,
  stage,
  dissolve,
}: {
  session: LampSession;
  /** World position of the spout tip the Genie pours out of. */
  origin: THREE.Vector3Tuple;
  stage: GenieStage;
  dissolve: SmokeDissolve;
}) {
  const { geometry, body, limbs, brows, gold, glow } = useGenieParts();
  const root = useRef<THREE.Group>(null);
  const upper = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const arms = useRef<(THREE.Group | null)[]>([]);
  const light = useRef<THREE.PointLight>(null);

  useFrame(({ clock, pointer }, delta) => {
    const dt = Math.min(delta, 0.1);
    const t = clock.getElapsedTime();
    const out = session.isGenieOut();
    stepGenie(stage, { out, offering: session.state.cards !== null }, dt);
    const pose = geniePose(stage);

    const genie = root.current;
    if (!genie) return;
    genie.visible = stage.presence > 0;
    if (!genie.visible) return;
    genie.scale.setScalar(Math.max(pose.scale, 1e-3));
    genie.rotation.y = pose.spin;

    // Hover: a slow bob and a slight lean, which the tail stretches to follow.
    const bob = body.uniforms.uBob.value.set(0.03 * Math.sin(t * 0.9), 0.06 * Math.sin(t * 1.5), 0);
    upper.current?.position.copy(bob);
    for (const material of [body, limbs, brows]) {
      material.uniforms.uTime.value = t;
      material.uniforms.uOpacity.value = pose.opacity;
    }
    gold.opacity = glow.opacity = pose.opacity;
    if (light.current) light.current.intensity = GENIE_LIGHT * pose.opacity * (1 + 0.08 * Math.sin(t * 2.3));

    // The head follows the Hand a little, and nods as it bobs.
    if (head.current) {
      head.current.rotation.y = damp(head.current.rotation.y, pointer.x * 0.4, 4, dt);
      head.current.rotation.x = damp(head.current.rotation.x, -pointer.y * 0.2 + 0.05 + 0.03 * Math.sin(t * 1.5 + 1), 4, dt);
    }
    geometry.arms.forEach((arm, i) => {
      const group = arms.current[i];
      if (!group) return;
      group.rotation.y = -arm.side * pose.armSwing;
      group.rotation.z = arm.side * (0.05 * Math.sin(t * 1.5 + 0.6) + 0.25 * pose.armSwing);
    });

    // Drawn back into the Lamp: it trails Smoke as it shrinks.
    if (!out && stage.presence > 0.1) {
      const s = pose.scale;
      const along = Math.random();
      dissolve.bursts.push({
        x: origin[0] + GENIE_TORSO.x * s * along,
        y: origin[1] + GENIE_HEIGHTS.chest * s * along,
        z: origin[2] + GENIE_TORSO.z * s * along,
        count: LEAVING_PUFFS_PER_FRAME,
      });
    }
  });

  return (
    <group ref={root} position={origin} visible={false}>
      <mesh geometry={geometry.body} material={body} />
      <group ref={upper}>
        <mesh geometry={geometry.torsoGold} material={gold} />
        <group ref={head} position={geometry.neck}>
          <mesh geometry={geometry.head.spirit} material={limbs} />
          <mesh geometry={geometry.head.dark} material={brows} />
          <mesh geometry={geometry.head.glow} material={glow} />
          <mesh geometry={geometry.head.gold} material={gold} />
        </group>
        {geometry.arms.map((arm, i) => (
          <group
            key={arm.side}
            ref={(group) => {
              arms.current[i] = group;
            }}
            position={arm.shoulder}
          >
            <mesh geometry={arm.spirit} material={limbs} />
            <mesh geometry={arm.cuff} material={gold} />
          </group>
        ))}
        <pointLight
          ref={light}
          color={0x8fa4ff}
          intensity={0}
          distance={8}
          decay={2}
          position={[GENIE_TORSO.x, GENIE_HEIGHTS.chest, GENIE_TORSO.z + 0.9]}
        />
      </group>
    </group>
  );
}
