import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { LampSession } from '../session/lampSession';
import { cameraDrift, cameraView } from './camera';
import { damp, followAmount } from '../math';

/** How quickly the camera moves between the home view and the wider view of the Genie (per second). */
const VIEW_RATE = 2.2;

const target = new THREE.Vector3();
const goal = new THREE.Vector3();

/**
 * Three-quarter camera that drifts gently toward the mouse and draws back to take in the
 * Genie while it is out of the Lamp. No orbiting.
 */
export function CameraRig({ session }: { session: LampSession }) {
  const wish = useRef(0);
  useFrame(({ camera, pointer, size }, dt) => {
    wish.current = damp(wish.current, session.isGenieOut() ? 1 : 0, VIEW_RATE, dt);
    const view = cameraView(wish.current, size.width / size.height);
    goal.set(...cameraDrift(pointer, view.position));
    camera.position.lerp(goal, followAmount(3, dt));
    camera.lookAt(target.set(...view.target));
  });
  return null;
}
