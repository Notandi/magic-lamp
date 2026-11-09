import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { candleIntensity } from './flicker';

/** Room environment map so the brass has something to reflect. */
function BrassEnvironment() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.6;
    return () => {
      scene.environment = null;
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

/** Flickering warm candle key light, purple rim light and a dim ambient fill. */
export function Lighting() {
  const key = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    if (key.current) key.current.intensity = candleIntensity(clock.getElapsedTime());
  });
  return (
    <>
      <BrassEnvironment />
      <pointLight
        ref={key}
        color={0xffb060}
        intensity={40}
        distance={20}
        decay={2}
        position={[2.5, 3.5, 3]}
        castShadow
      />
      <pointLight color={0x8a5cff} intensity={25} distance={20} decay={2} position={[-3, 2, -2.5]} />
      <ambientLight color={0x30204a} intensity={0.4} />
    </>
  );
}
