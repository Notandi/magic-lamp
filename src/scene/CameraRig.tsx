import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CAMERA_TARGET, cameraDrift } from './camera';
import { followAmount } from '../math';

const target = new THREE.Vector3(...CAMERA_TARGET);
const goal = new THREE.Vector3();

/** Fixed three-quarter camera that drifts gently toward the mouse. No orbiting. */
export function CameraRig() {
  useFrame(({ camera, pointer }, dt) => {
    goal.set(...cameraDrift(pointer));
    camera.position.lerp(goal, followAmount(3, dt));
    camera.lookAt(target);
  });
  return null;
}
