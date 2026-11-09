import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { CAMERA_HOME } from './scene/camera';
import { CameraRig } from './scene/CameraRig';
import { Hand } from './scene/Hand';
import { Lamp } from './scene/Lamp';
import { Lighting } from './scene/Lighting';

export function App() {
  return (
    <Canvas
      shadows="soft"
      dpr={[1, 2]}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      camera={{ fov: 40, near: 0.1, far: 100, position: CAMERA_HOME }}
    >
      <color attach="background" args={[0x0b0710]} />
      <CameraRig />
      <Lighting />
      <Lamp />
      <Suspense fallback={null}>
        <Hand />
      </Suspense>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[6, 64]} />
        <meshStandardMaterial color={0x140c1e} roughness={0.9} />
      </mesh>
    </Canvas>
  );
}
