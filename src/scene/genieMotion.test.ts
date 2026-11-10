import { describe, expect, it } from 'vitest';
import { GENIE_MOTION, genieIsReady, geniePose, newGenieStage, stepGenie } from './genieMotion';

const FRAME = 1 / 60;

/** Runs the Genie for `seconds`, one frame at a time. */
function run(stage: ReturnType<typeof newGenieStage>, wanted: { out: boolean; offering: boolean }, seconds: number) {
  for (let i = 0; i < Math.round(seconds / FRAME); i++) stepGenie(stage, wanted, FRAME);
}

describe('the Genie pouring out of the Lamp', () => {
  it('starts inside the Lamp: invisible and no size at all', () => {
    const stage = newGenieStage();
    expect(genieIsReady(stage)).toBe(false);
    expect(geniePose(stage)).toMatchObject({ scale: 0, opacity: 0 });
  });

  it('is fully out, upright and solid after the emerge time, and only then ready to offer Cards', () => {
    const stage = newGenieStage();
    run(stage, { out: true, offering: true }, GENIE_MOTION.emergeSeconds * 0.5);
    expect(genieIsReady(stage)).toBe(false);
    expect(stage.offer).toBe(0);
    run(stage, { out: true, offering: true }, GENIE_MOTION.emergeSeconds * 0.5 + 0.1);
    expect(genieIsReady(stage)).toBe(true);
    const pose = geniePose(stage);
    expect(pose.scale).toBeCloseTo(1);
    expect(pose.spin).toBeCloseTo(0);
    expect(pose.opacity).toBe(1);
  });

  it('spins and grows as it pours out', () => {
    const stage = newGenieStage();
    run(stage, { out: true, offering: false }, GENIE_MOTION.emergeSeconds * 0.3);
    const pose = geniePose(stage);
    expect(pose.scale).toBeGreaterThan(0);
    expect(pose.scale).toBeLessThan(1);
    expect(Math.abs(pose.spin)).toBeGreaterThan(0.5);
  });
});

describe('the Genie offering the Cards', () => {
  it('keeps its arms gathered until there are Cards to offer, then opens them', () => {
    const stage = newGenieStage();
    run(stage, { out: true, offering: false }, GENIE_MOTION.emergeSeconds + 1);
    expect(geniePose(stage).armSwing).toBeCloseTo(GENIE_MOTION.gatheredArmSwing);
    run(stage, { out: true, offering: true }, GENIE_MOTION.offerSeconds + 0.1);
    expect(geniePose(stage).armSwing).toBeCloseTo(0);
  });
});

describe('the Genie being drawn back into the Lamp', () => {
  it('shrinks away to nothing, faster than it came', () => {
    const stage = newGenieStage();
    run(stage, { out: true, offering: true }, 5);
    run(stage, { out: false, offering: false }, GENIE_MOTION.leaveSeconds + 0.1);
    expect(GENIE_MOTION.leaveSeconds).toBeLessThan(GENIE_MOTION.emergeSeconds);
    expect(stage).toEqual({ presence: 0, offer: 0 });
    expect(geniePose(stage)).toMatchObject({ scale: 0, opacity: 0 });
  });
});
