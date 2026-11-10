import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { candleIntensity } from './flicker';

/**
 * A small photo studio for the gold to reflect: a dim amber dome so the metal is never
 * black, and a few softboxes for the highlights.
 */
function studioScene(): THREE.Scene {
  const studio = new THREE.Scene();
  const dome = new THREE.SphereGeometry(30, 32, 24);
  const top = new THREE.Color(0.2, 0.13, 0.09);
  const horizon = new THREE.Color(0.75, 0.42, 0.16);
  const under = new THREE.Color(0.1, 0.05, 0.14);
  const colors: number[] = [];
  const c = new THREE.Color();
  const position = dome.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const height = position.getY(i) / 30;
    if (height >= 0) c.copy(horizon).lerp(top, Math.pow(height, 0.6));
    else c.copy(horizon).lerp(under, Math.pow(-height, 0.4));
    colors.push(c.r, c.g, c.b);
  }
  dome.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  studio.add(new THREE.Mesh(dome, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));

  const softbox = (width: number, height: number, at: THREE.Vector3Tuple, color: THREE.Color) => {
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }),
    );
    panel.position.set(...at);
    panel.lookAt(0, 0, 0);
    studio.add(panel);
  };
  softbox(14, 9, [7, 9, 6], new THREE.Color(3.2, 2.5, 1.7)); // warm key
  softbox(6, 14, [-11, 4, 2], new THREE.Color(1.3, 0.7, 2.6)); // violet side strip
  softbox(16, 3, [0, 11, -8], new THREE.Color(2.4, 2.0, 1.6)); // top hair light
  softbox(5, 5, [1, 2, 12], new THREE.Color(1.4, 1.0, 0.6)); // front fill
  return studio;
}

/** Environment map so the Lamp's gold has something to reflect. */
function GoldEnvironment() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(studioScene(), 0.02).texture;
    scene.environment = env;
    scene.environmentIntensity = 1;
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
      <GoldEnvironment />
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
