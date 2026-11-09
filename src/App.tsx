import { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { Credits } from './credits/Credits';
import { AdaptiveQuality } from './scene/AdaptiveQuality';
import { CAMERA_HOME } from './scene/camera';
import { CameraRig } from './scene/CameraRig';
import { Hand } from './scene/Hand';
import { Lamp } from './scene/Lamp';
import { Lighting } from './scene/Lighting';
import { SPOUT_TIP } from './scene/lampGeometry';
import { LAMP_POSITION } from './scene/Lamp';
import { PostFx } from './scene/PostFx';
import { Wish } from './scene/Wish';
import { createLampSession } from './session/lampSession';

const SPOUT_TIP_WORLD = SPOUT_TIP.clone().add(LAMP_POSITION).toArray();

export function App() {
  const session = useMemo(() => createLampSession(), []);
  return (
    <>
    <Canvas
      shadows="soft"
      dpr={[1, 2]}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      camera={{ fov: 40, near: 0.1, far: 100, position: CAMERA_HOME }}
    >
      <color attach="background" args={[0x0b0710]} />
      <CameraRig />
      <Lighting />
      <Lamp session={session} />
      <Suspense fallback={null}>
        <Hand />
      </Suspense>
      <AdaptiveQuality>
        {({ smokeBudget, bloomResolutionScale }) => (
          <>
            <Wish session={session} origin={SPOUT_TIP_WORLD} smokeBudget={smokeBudget} />
            <PostFx bloomResolutionScale={bloomResolutionScale} />
          </>
        )}
      </AdaptiveQuality>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[6, 64]} />
        <meshStandardMaterial color={0x140c1e} roughness={0.9} />
      </mesh>
    </Canvas>
    <Credits />
    </>
  );
}
