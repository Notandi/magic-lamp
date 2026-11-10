/**
 * How the Genie moves: pouring out of the spout, opening its arms to offer the Cards, and
 * being drawn back in. No React or three.js here, so it can be tested on its own.
 */

import { clamp01 } from '../math';

/** Tuning for the Genie's motion, kept together so it's easy to change. */
export const GENIE_MOTION = {
  /** Seconds the Genie takes to pour out of the spout. */
  emergeSeconds: 1.3,
  /** Seconds the Genie takes to be drawn back into the spout. */
  leaveSeconds: 0.75,
  /** Seconds the Genie takes to open its arms and offer the Cards. */
  offerSeconds: 1.1,
  /** Turns the Genie spins about the spout while pouring out. */
  emergeTurns: 0.75,
  /** How far inward (radians) the arms are folded before the offer. */
  gatheredArmSwing: 1.0,
} as const;

/** The Genie's progress, shared between the Genie and the Cards it offers. */
export interface GenieStage {
  /** 0 = inside the Lamp, 1 = fully out. */
  presence: number;
  /** 0 = arms gathered around the Cards, 1 = arms open, Cards offered. */
  offer: number;
}

export const newGenieStage = (): GenieStage => ({ presence: 0, offer: 0 });

/**
 * Advances the Genie by `dt` seconds. It pours out while `out` is set and is drawn back in
 * when it isn't; it opens its arms once it is fully out and `offering` is set.
 */
export function stepGenie(stage: GenieStage, { out, offering }: { out: boolean; offering: boolean }, dt: number): void {
  const m = GENIE_MOTION;
  stage.presence = clamp01(stage.presence + (out ? dt / m.emergeSeconds : -dt / m.leaveSeconds));
  const offer = out && offering && stage.presence >= 1;
  stage.offer = clamp01(stage.offer + (offer ? dt / m.offerSeconds : -dt / m.leaveSeconds));
}

/** Whether the Genie is far enough out to hand over the Cards. */
export const genieIsReady = (stage: GenieStage) => stage.presence >= 1;

/** Ease that overshoots a little before settling, for a springy arrival. */
export function easeOutBack(k: number): number {
  const c = 1.4;
  const x = clamp01(k) - 1;
  return 1 + (c + 1) * x * x * x + c * x * x;
}

const easeInOut = (k: number) => k * k * (3 - 2 * k);

export interface GeniePose {
  /** Size, as a fraction of full size; it grows out of the spout tip. */
  scale: number;
  /** Rotation (radians) about the vertical through the spout tip. */
  spin: number;
  /** 0 = invisible, 1 = solid. */
  opacity: number;
  /** How far inward (radians) each arm is folded: `gatheredArmSwing` when gathered, 0 when offering. */
  armSwing: number;
}

/** The Genie's pose for a stage. */
export function geniePose(stage: GenieStage): GeniePose {
  const p = clamp01(stage.presence);
  return {
    scale: Math.max(0, easeOutBack(p)),
    spin: -Math.pow(1 - p, 2) * GENIE_MOTION.emergeTurns * Math.PI * 2,
    opacity: clamp01(p / 0.4),
    armSwing: GENIE_MOTION.gatheredArmSwing * (1 - easeOutBack(easeInOut(clamp01(stage.offer)))),
  };
}
