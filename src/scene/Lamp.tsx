import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { buildLampGeometry } from './lampGeometry';
import { engravingTexture, patinaTexture } from './lampTextures';
import { gemGlow } from './flicker';
import type { LampSession } from '../session/lampSession';
import { useLampRubInput } from './useLampRubInput';

/** Name of the Lamp's root object, so other scene parts (like the Hand) can raycast it. */
export const LAMP_OBJECT_NAME = 'lamp';

export const LAMP_POSITION: Readonly<THREE.Vector3> = new THREE.Vector3(-0.3, 0, 0);

/** Warm golden glow colour that rises with Charge. */
const CHARGE_GLOW = new THREE.Color(0xff8a2a);

/** How far (world units / radians) the Lamp shakes at full Charge. */
const MAX_TREMBLE = 0.035;

/** The glow down inside the spout: dim at rest, bright at full Charge. */
const THROAT_REST = new THREE.Color(0.9, 0.3, 1.9);
const THROAT_CHARGED = new THREE.Color(3.2, 1.2, 5.5);

/** A cut gemstone that glows from within. */
const gemMaterial = (color: number, glow: number, faceted: boolean) =>
  new THREE.MeshPhysicalMaterial({
    color,
    emissive: color,
    emissiveIntensity: glow,
    roughness: 0.08,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    flatShading: faceted,
  });

function useLampMaterials() {
  const materials = useMemo(() => {
    const patina = patinaTexture();
    const engraving = engravingTexture();
    const gold = (color: number, roughness: number, extra: THREE.MeshPhysicalMaterialParameters = {}) =>
      new THREE.MeshPhysicalMaterial({
        color,
        emissive: CHARGE_GLOW,
        emissiveIntensity: 0,
        metalness: 1,
        roughness,
        roughnessMap: patina,
        ...extra,
      });
    return {
      textures: [patina, engraving],
      /** The engraved body. Double-sided so the inside of the spout's lip shows. */
      engraved: gold(0xf2b84b, 0.34, {
        bumpMap: engraving,
        bumpScale: 0.9,
        side: THREE.DoubleSide,
        clearcoat: 0.25,
        clearcoatRoughness: 0.3,
      }),
      bright: gold(0xf2b84b, 0.3),
      dark: gold(0xb37a22, 0.42),
      throat: new THREE.MeshBasicMaterial({ color: THROAT_REST.clone(), side: THREE.DoubleSide }),
      amethyst: gemMaterial(0x9a4dff, 0.9, true),
      ruby: gemMaterial(0xd1123a, 0.35, true),
      emerald: gemMaterial(0x0c8f6a, 0.3, false),
    };
  }, []);
  useEffect(
    () => () => {
      for (const texture of materials.textures) texture.dispose();
    },
    [materials],
  );
  return materials;
}

/**
 * The code-built golden genie Lamp, ported from prototypes/fable-lamp.html.
 * It sends the player's Rubs into the Lamp session and glows and trembles with Charge.
 */
export function Lamp({ session }: { session: LampSession }) {
  const root = useRef<THREE.Group>(null);
  const glowLight = useRef<THREE.PointLight>(null);
  const finialGem = useRef<THREE.Mesh>(null);
  useLampRubInput(session);

  const geo = useMemo(buildLampGeometry, []);
  const mat = useLampMaterials();

  useFrame(({ clock }, dt) => {
    session.tick(dt);
    const { charge } = session.state;
    const t = clock.getElapsedTime();

    mat.amethyst.emissiveIntensity = gemGlow(t) + charge * 4;
    mat.engraved.emissiveIntensity = mat.bright.emissiveIntensity = charge * 0.35;
    mat.dark.emissiveIntensity = charge * 0.25;
    mat.throat.color.lerpColors(THROAT_REST, THROAT_CHARGED, Math.min(1, charge + 0.15 * Math.sin(t * 1.3) + 0.15));
    if (glowLight.current) glowLight.current.intensity = charge * charge * 30;
    if (finialGem.current) finialGem.current.rotation.y = t * 0.5;

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

  const part = (geometry: THREE.BufferGeometry, material: THREE.Material) => (
    <mesh geometry={geometry} material={material} castShadow receiveShadow />
  );
  return (
    <group ref={root} name={LAMP_OBJECT_NAME} position={LAMP_POSITION}>
      <pointLight ref={glowLight} color={0xffa040} intensity={0} distance={6} decay={2} position={[0, 1.2, 0]} />
      {part(geo.body, mat.engraved)}
      {part(geo.darkBands, mat.dark)}
      {part(geo.brightBands, mat.bright)}
      <mesh geometry={geo.throat} material={mat.throat} />
      {part(geo.handle, mat.bright)}
      {part(geo.scroll, mat.bright)}
      {part(geo.scrollTip, mat.dark)}
      {part(geo.foot, mat.bright)}
      {part(geo.footBeads, mat.dark)}
      {part(geo.lid, mat.bright)}
      {part(geo.lidBeads, mat.dark)}
      {part(geo.rubies, mat.ruby)}
      {part(geo.rubyBezels, mat.dark)}
      <mesh ref={finialGem} geometry={geo.finialGem} material={mat.amethyst} position={geo.finialGemPosition} castShadow />
      {part(geo.cabochons, mat.emerald)}
      {part(geo.cabochonBezels, mat.dark)}
    </group>
  );
}
