import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { buildLampGeometry } from './lampGeometry';
import { gemGlow } from './flicker';

/** Name of the Lamp's root object, so other scene parts (like the Hand) can raycast it. */
export const LAMP_OBJECT_NAME = 'lamp';

/** The code-built brass genie Lamp, ported from prototypes/code-lamp.html. */
export function Lamp() {
  const geo = useMemo(buildLampGeometry, []);
  const brass = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: 0xd4a03a,
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

  useFrame(({ clock }) => {
    if (gemMaterial.current) gemMaterial.current.emissiveIntensity = gemGlow(clock.getElapsedTime());
  });

  return (
    <group name={LAMP_OBJECT_NAME} position={[-0.3, 0, 0]}>
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
