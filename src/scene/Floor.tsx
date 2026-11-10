import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

/** Radius of the floor disc (world units). */
const FLOOR_RADIUS = 9;

/** Opaque in the middle, fading to nothing at the rim, so the floor has no visible edge. */
function fadeTexture(): THREE.Texture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d')!;
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, '#fff');
  gradient.addColorStop(0.45, '#fff');
  gradient.addColorStop(1, '#000');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

/** The dark floor the Lamp stands on. It melts into the darkness of the room at its rim. */
export function Floor() {
  const fade = useMemo(fadeTexture, []);
  useEffect(() => () => fade.dispose(), [fade]);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <circleGeometry args={[FLOOR_RADIUS, 64]} />
      <meshStandardMaterial color={0x140c1e} roughness={0.9} alphaMap={fade} transparent />
    </mesh>
  );
}
