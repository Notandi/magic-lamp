export type Vec3 = [number, number, number];

/** A place for the camera to stand and a point for it to look at. */
export interface CameraView {
  position: Vec3;
  target: Vec3;
}

/** Fixed three-quarter view of the Lamp, for Rubbing. */
export const CAMERA_HOME: Vec3 = [1.5, 3.0, 7.4];
/** Point the camera looks at from the home view. */
export const CAMERA_TARGET: Vec3 = [0.3, 1.7, 0];
/** The wider view while the Genie is out: the Lamp below, the Genie and its Cards above. */
export const CAMERA_WISH: CameraView = { position: [1.5, 3.7, 9.6], target: [0.5, 2.75, 0] };
/** How far (world units) the camera drifts at the window edge. */
export const CAMERA_DRIFT = { x: 0.4, y: 0.25 };
/**
 * The narrowest view (width / height) the two views are framed for. In a narrower window,
 * such as a phone held upright, the camera backs away so the Lamp's full length still fits.
 */
export const CAMERA_FIT_ASPECT = 1.2;

const mix = (a: Vec3, b: Vec3, k: number): Vec3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

/**
 * Where the camera stands and looks. `wish` blends from the home view (0) to the wider view
 * of the Genie (1); `aspect` is the view's width / height.
 */
export function cameraView(wish: number, aspect: number): CameraView {
  const position = mix(CAMERA_HOME, CAMERA_WISH.position, wish);
  const target = mix(CAMERA_TARGET, CAMERA_WISH.target, wish);
  const back = Math.max(1, CAMERA_FIT_ASPECT / aspect);
  return { position: mix(target, position, back), target };
}

/**
 * Camera position for a mouse position in normalised device coordinates
 * (-1..1 on each axis, +y up). The camera never orbits; it only drifts around `home`.
 */
export function cameraDrift(mouse: { x: number; y: number }, home: Vec3 = CAMERA_HOME): Vec3 {
  return [home[0] + mouse.x * CAMERA_DRIFT.x, home[1] + mouse.y * CAMERA_DRIFT.y, home[2]];
}
