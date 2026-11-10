export type Vec3 = [number, number, number];

/** Fixed three-quarter view, framing the Lamp below and the Card arc above it. */
export const CAMERA_HOME: Vec3 = [1.5, 3.0, 7.4];
/** Point the camera always looks at. */
export const CAMERA_TARGET: Vec3 = [0.3, 1.7, 0];
/** How far (world units) the camera drifts at the window edge. */
export const CAMERA_DRIFT = { x: 0.4, y: 0.25 };

/**
 * Camera position for a mouse position in normalised device coordinates
 * (-1..1 on each axis, +y up). The camera never orbits; it only drifts.
 */
export function cameraDrift(mouse: { x: number; y: number }): Vec3 {
  return [
    CAMERA_HOME[0] + mouse.x * CAMERA_DRIFT.x,
    CAMERA_HOME[1] + mouse.y * CAMERA_DRIFT.y,
    CAMERA_HOME[2],
  ];
}
