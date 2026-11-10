import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import cardBackUrl from './assets/cards/card-back.jpg';
import { Credits } from './credits/Credits';
import { Hint } from './overlay/Hint';
import { MagicUnavailableNote } from './overlay/MagicUnavailableNote';
import { AdaptiveQuality } from './scene/AdaptiveQuality';
import { CAMERA_HOME } from './scene/camera';
import { CameraRig } from './scene/CameraRig';
import { Hand } from './scene/Hand';
import { Floor } from './scene/Floor';
import { HandInputProvider } from './scene/HandInputProvider';
import { Lamp } from './scene/Lamp';
import { Lighting } from './scene/Lighting';
import { SPOUT_TIP } from './scene/lampGeometry';
import { LAMP_POSITION } from './scene/Lamp';
import { PostFx } from './scene/PostFx';
import { Wish } from './scene/Wish';
import { loadCardImage } from './scene/cardImages';
import { createLampSession, type LampSession } from './session/lampSession';
import { preloadingCardSource } from './session/preloadingCardSource';
import { createScryfallCardSource } from './session/scryfallCardSource';

const SPOUT_TIP_WORLD = SPOUT_TIP.clone().add(LAMP_POSITION).toArray();

/** Real Cards from Scryfall, with their images loaded before the Wish; the bundled card back saves a download. */
const scryfallCards = () => preloadingCardSource(createScryfallCardSource({ cardBackUrl }), loadCardImage);

/**
 * The page's one Lamp session. Creating a session starts drawing its first Wish's Cards, so it
 * lives outside React: StrictMode's double render would otherwise make two, each drawing Cards.
 */
let pageSession: LampSession | undefined;
const lampSession = () => (pageSession ??= createLampSession({ cardSource: scryfallCards() }));

export function App() {
  const session = lampSession();
  return (
    <>
    <Canvas
      shadows="soft"
      dpr={[1, 2]}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      camera={{ fov: 40, near: 0.1, far: 100, position: CAMERA_HOME }}
      onPointerMissed={() => session.backgroundClicked()}
      // Dragging on the canvas Rubs, flips Cards and moves the Hand; it must never scroll, zoom or select the page.
      style={{ touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
    >
      <color attach="background" args={[0x0b0710]} />
      <CameraRig session={session} />
      <Lighting />
      <HandInputProvider>
        <Lamp session={session} />
        <Suspense fallback={null}>
          <Hand />
        </Suspense>
      </HandInputProvider>
      <AdaptiveQuality>
        {({ smokeBudget, bloomResolutionScale }) => (
          <>
            <Wish session={session} origin={SPOUT_TIP_WORLD} smokeBudget={smokeBudget} />
            <PostFx bloomResolutionScale={bloomResolutionScale} />
          </>
        )}
      </AdaptiveQuality>
      <Floor />
    </Canvas>
    <MagicUnavailableNote session={session} />
    <Hint session={session} />
    <Credits />
    </>
  );
}
