import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { HAND_FLOAT_DEPTH, PALM_LIFT, handTarget } from './handPose';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// Camera at the origin looking down -z.
const ray = { origin: v(0, 0, 0), direction: v(0, 0, -1) };
const lampHit = { point: v(0, 0, -6), normal: v(0, 0, 1) };

/** Direction the palm faces, in world space, for a target pose. */
const palmFacing = (q: THREE.Quaternion) => v(0, -1, 0).applyQuaternion(q);
/** Direction the fingers point, in world space, for a target pose. */
const fingersPoint = (q: THREE.Quaternion) => v(0, 0, -1).applyQuaternion(q);

describe('Hand pose', () => {
  it('floats at a fixed depth along the pointer ray when the button is up, even over the Lamp', () => {
    const pose = handTarget({ ray, pressed: false, hit: lampHit });
    expect(pose.onLamp).toBe(false);
    expect(pose.position.distanceTo(v(0, 0, -HAND_FLOAT_DEPTH))).toBeLessThan(1e-6);
  });

  it('floats when the button is held but the pointer is off the Lamp', () => {
    const pose = handTarget({ ray: { origin: v(0, 0, 0), direction: v(0.6, 0, -0.8) }, pressed: true, hit: null });
    expect(pose.onLamp).toBe(false);
    expect(pose.position.distanceTo(v(0.6, 0, -0.8).multiplyScalar(HAND_FLOAT_DEPTH))).toBeLessThan(1e-6);
  });

  it('rests the palm on the Lamp surface, facing into it, when pressed over the Lamp', () => {
    const pose = handTarget({ ray, pressed: true, hit: lampHit });
    expect(pose.onLamp).toBe(true);
    expect(pose.position.distanceTo(v(0, 0, -6 + PALM_LIFT))).toBeLessThan(1e-6);
    expect(palmFacing(pose.quaternion).dot(v(0, 0, -1))).toBeCloseTo(1, 6);
  });

  it('aligns the palm to a sloped surface and keeps the fingers flat along it', () => {
    const normal = v(1, 1, 0).normalize();
    const pose = handTarget({ ray, pressed: true, hit: { point: v(1, 1, -5), normal } });
    expect(palmFacing(pose.quaternion).dot(normal)).toBeCloseTo(-1, 6);
    expect(fingersPoint(pose.quaternion).dot(normal)).toBeCloseTo(0, 6);
  });

  it('points the fingers up the surface, never back toward the camera', () => {
    const pose = handTarget({ ray, pressed: true, hit: lampHit });
    const fingers = fingersPoint(pose.quaternion);
    expect(fingers.y).toBeGreaterThan(0.9);
  });

  it('turns the palm toward the Lamp and points the fingers away from the camera while floating', () => {
    const pose = handTarget({ ray, pressed: false, hit: null });
    expect(palmFacing(pose.quaternion).z).toBeLessThan(0);
    expect(palmFacing(pose.quaternion).y).toBeLessThan(0);
    expect(fingersPoint(pose.quaternion).z).toBeLessThan(0);
  });
});
