/**
 * Where a Wish's Cards settle: a fan-shaped arc floating in front of the Genie, between its
 * open hands, with the Lamp still visible (and reachable) below. No React or three.js here.
 */

import type { Vec3 } from './camera';

/** A Card's size in world units, at the standard Magic card ratio (63 × 88 mm). */
export const CARD_SIZE = { width: 0.756, height: 1.056, thickness: 0.014, cornerRadius: 0.036 } as const;

/** Tuning for the fan arc. */
export const FAN_TUNING = {
  /** World position of the middle Card. */
  centre: [0.9, 3.3, 0.45] as Vec3,
  /** Horizontal distance between neighbouring Cards. */
  spacing: 0.84,
  /** How much lower each step away from the middle sits (scaled by steps²). */
  droop: 0.06,
  /** Outward tilt (radians) per step away from the middle. */
  tiltPerStep: 0.07,
} as const;

export interface FanSlot {
  /** World position of the Card's centre. */
  position: Vec3;
  /** Rotation (radians) about the axis facing the camera; positive leans the top to the left. */
  tilt: number;
}

/** The settled place of each of `count` Cards, left to right. */
export function fanArc(count: number): FanSlot[] {
  const { centre, spacing, droop, tiltPerStep } = FAN_TUNING;
  return Array.from({ length: count }, (_, i) => {
    const step = i - (count - 1) / 2;
    return {
      position: [centre[0] + step * spacing, centre[1] - droop * step * step, centre[2]],
      tilt: -step * tiltPerStep,
    };
  });
}
