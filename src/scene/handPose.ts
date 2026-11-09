import * as THREE from 'three';

/**
 * Where the Hand wants to be this frame, in world space.
 *
 * Hand frame: origin at the centre of the palm skin, palm facing -Y, fingers
 * pointing -Z. The Hand component maps the hand model into this frame.
 */
export interface HandPose {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  /** True when the palm is resting on the Lamp. */
  onLamp: boolean;
}

export interface HandPoseInput {
  /** The pointer ray from the camera. `direction` must be normalised. */
  ray: { origin: THREE.Vector3; direction: THREE.Vector3 };
  /** Whether the button is held. */
  pressed: boolean;
  /** Where the pointer ray meets the Lamp, with the surface normal facing the camera, or null. */
  hit: { point: THREE.Vector3; normal: THREE.Vector3 } | null;
}

/** Distance from the camera (world units) at which the Hand floats, in front of the Lamp. */
export const HAND_FLOAT_DEPTH = 5;
/** Gap between the palm skin and the Lamp surface, so the Hand rests on it without sinking in. */
export const PALM_LIFT = 0.02;
/** How far the floating palm tips toward the Lamp (0 = flat, palm down). */
const FLOAT_TILT = 0.6;
/** How much the fingers lean away from the camera while on the Lamp. */
const SURFACE_LEAN = 0.5;

const UP = new THREE.Vector3(0, 1, 0);

/**
 * Orientation that turns the palm against `normal` (palm faces -normal) with
 * the fingers pointing as close to `forwardHint` as the surface allows.
 */
function palmBasis(normal: THREE.Vector3, ...forwardHints: THREE.Vector3[]): THREE.Quaternion {
  const y = normal.clone().normalize();
  let forward = new THREE.Vector3();
  for (const hint of [...forwardHints, new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, -1)]) {
    forward = hint.clone().addScaledVector(y, -hint.dot(y));
    if (forward.lengthSq() > 1e-6) break;
  }
  const z = forward.normalize().negate();
  const x = new THREE.Vector3().crossVectors(y, z);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

/**
 * The Hand's target pose: resting on the Lamp while the button is held over
 * it, otherwise floating at a fixed depth along the pointer ray.
 */
export function handTarget({ ray, pressed, hit }: HandPoseInput): HandPose {
  if (pressed && hit) {
    const lean = UP.clone().addScaledVector(ray.direction, SURFACE_LEAN);
    return {
      position: hit.point.clone().addScaledVector(hit.normal, PALM_LIFT),
      quaternion: palmBasis(hit.normal, lean, ray.direction),
      onLamp: true,
    };
  }
  const tilted = UP.clone().addScaledVector(ray.direction, -FLOAT_TILT);
  return {
    position: ray.origin.clone().addScaledVector(ray.direction, HAND_FLOAT_DEPTH),
    quaternion: palmBasis(tilted, ray.direction),
    onLamp: false,
  };
}
