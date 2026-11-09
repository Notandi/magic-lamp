import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { buildLampGeometry } from './lampGeometry';
import { gemGlow } from './flicker';
import type { LampSession } from '../session/lampSession';
import { useLampRubInput } from './useLampRubInput';

export const LAMP_POSITION: Readonly<THREE.Vector3> = new THREE.Vector3(-0.3, 0, 0);

/** Warm brass glow colour that rises with Charge. */
const CHARGE_GLOW = new THREE.Color(0xff8a2a);

/** How far (world units / radians) the Lamp shakes at full Charge. */
const MAX_TREMBLE = 0.035;

/**
 * The code-built brass genie Lamp, ported from prototypes/code-lamp.html.
 * It sends the player's Rubs into the Lamp session and glows and trembles with Charge.
 */
export function Lamp({ session }: { session: LampSession }) {
  const root = useRef<THREE.Group>(null);
  const glowLight = useRef<THREE.PointLight>(null);
  useLampRubInput(root, session);

  const geo = useMemo(buildLampGeometry, []);
  const brass = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: 0xd4a03a,
        emissive: CHARGE_GLOW,
        emissiveIntensity: 0,
        metalness: 1,
        roughness: 0.22,
        clearcoat: 0.6,
        clearcoatRoughness: 0.15,
      }),
    [],
  );
  const darkBrass = useMemo(() => {
    const m = brass.clone();
    m.color.set(0x9a6a1e);
    m.roughness = 0.35;
    return m;
  }, [brass]);
  const gemMaterial = useRef<THREE.MeshPhysicalMaterial>(null);

  useFrame(({ clock }, dt) => {
    session.tick(dt);
    const { charge } = session.state;
    const t = clock.getElapsedTime();

    if (gemMaterial.current) gemMaterial.current.emissiveIntensity = gemGlow(t) + charge * 4;
    brass.emissiveIntensity = charge * 0.35;
    darkBrass.emissiveIntensity = charge * 0.25;
    if (glowLight.current) glowLight.current.intensity = charge * charge * 30;

    const shake = MAX_TREMBLE * Math.pow(charge, 1.5);
    if (root.current) {
      root.current.position.set(
        LAMP_POSITION.x + shake * Math.sin(t * 53) * Math.sin(t * 7.3),
        LAMP_POSITION.y + shake * 0.5 * Math.sin(t * 61 + 1.1),
        LAMP_POSITION.z + shake * Math.sin(t * 47 + 2.3) * Math.sin(t * 5.1),
      );
      root.current.rotation.set(shake * 0.6 * Math.sin(t * 43 + 0.4), 0, shake * Math.sin(t * 57 + 0.9));
    }
  });

  return (
    <group ref={root} position={LAMP_POSITION}>
      <pointLight ref={glowLight} color={0xffa040} intensity={0} distance={6} decay={2} position={[0, 1.2, 0]} />
      <mesh geometry={geo.foot} material={darkBrass} castShadow receiveShadow />
      <mesh geometry={geo.body} material={brass} scale={[1.35, 1, 0.85]} castShadow receiveShadow />
      <mesh
        geometry={geo.band}
        material={darkBrass}
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, 0.9, 0]}
        scale={[1.35, 0.85, 1]}
        castShadow
        receiveShadow
      />
      <mesh geometry={geo.neck} material={darkBrass} castShadow receiveShadow />
      <mesh geometry={geo.lid} material={brass} castShadow receiveShadow />
      <mesh geometry={geo.finial} material={darkBrass} castShadow receiveShadow />
      <mesh geometry={geo.gem} position={[0, 2.12, 0]} castShadow>
        <meshPhysicalMaterial
          ref={gemMaterial}
          color={0x9b4dff}
          emissive={0x5a1fbf}
          emissiveIntensity={1.2}
          roughness={0.1}
          transmission={0.3}
        />
      </mesh>
      <mesh geometry={geo.spout} material={brass} castShadow receiveShadow />
      <mesh
        geometry={geo.spoutLip}
        material={darkBrass}
        position={geo.spoutTip}
        quaternion={geo.spoutLipRotation}
        castShadow
        receiveShadow
      />
      <mesh geometry={geo.handle} material={darkBrass} castShadow receiveShadow />
      <mesh geometry={geo.handleCurl} material={darkBrass} position={[-1.75, 1.38, 0]} castShadow receiveShadow />
    </group>
  );
}
