import { describe, expect, it } from 'vitest';
import { createQualityController, QUALITY_LEVELS, type QualityController } from './quality';

/** Feed the controller frames at a steady frame rate for some seconds; returns the levels seen. */
function run(q: QualityController, fps: number, seconds: number): number[] {
  const seen: number[] = [];
  const frames = Math.round(fps * seconds);
  for (let i = 0; i < frames; i++) {
    q.frame(1 / fps);
    if (seen[seen.length - 1] !== q.level) seen.push(q.level);
  }
  return seen;
}

describe('adaptive quality', () => {
  it('keeps full quality while the scene holds 60 fps', () => {
    const q = createQualityController();
    run(q, 60, 60);
    expect(q.level).toBe(0);
    expect(q.settings).toEqual(QUALITY_LEVELS[0]);
  });

  it('steps down one level after a sustained frame-rate shortfall', () => {
    const q = createQualityController();
    run(q, 40, 1);
    expect(q.level).toBe(0);
    run(q, 40, 2);
    expect(q.level).toBe(1);
  });

  it('ignores a brief dip', () => {
    const q = createQualityController();
    run(q, 60, 5);
    run(q, 30, 1);
    run(q, 60, 5);
    expect(q.level).toBe(0);
  });

  it('steps down gradually, one level at a time, and stops at the cheapest level', () => {
    const q = createQualityController();
    expect(run(q, 40, 3)).toEqual([0, 1]);
    expect(run(q, 20, 60)).toEqual([1, 2, 3]);
    expect(q.settings).toEqual(QUALITY_LEVELS[QUALITY_LEVELS.length - 1]);
  });

  it('recovers quality one level at a time once the frame rate holds up', () => {
    const q = createQualityController();
    run(q, 30, 10);
    expect(q.level).toBe(3);
    run(q, 60, 3);
    expect(q.level).toBe(3);
    run(q, 60, 120);
    expect(q.level).toBe(0);
  });

  it("doesn't oscillate on a machine that can only just manage the next level down", () => {
    // Level 0 runs at 40 fps; every cheaper level holds 60 fps.
    const q = createQualityController();
    const fpsAt = (level: number) => (level === 0 ? 40 : 60);
    let changes = 0;
    let atOne = 0;
    let last = q.level;
    for (let t = 0; t < 600; ) {
      const dt = 1 / fpsAt(q.level);
      q.frame(dt);
      t += dt;
      if (q.level !== last) changes++;
      if (q.level === 1) atOne += dt;
      last = q.level;
    }
    expect(q.level).toBeLessThanOrEqual(1);
    expect(changes).toBeLessThanOrEqual(10);
    expect(atOne / 600).toBeGreaterThan(0.9);
  });

  it('ignores the long pause when the tab comes back from the background', () => {
    const q = createQualityController();
    run(q, 60, 5);
    q.frame(5);
    run(q, 60, 5);
    expect(q.level).toBe(0);
  });
});
