import { describe, expect, it } from 'vitest';
import { CAMERA_HOME, cameraDrift } from './camera';

describe('camera drift', () => {
  it('sits at the three-quarter home view when the mouse is centred', () => {
    expect(cameraDrift({ x: 0, y: 0 })).toEqual(CAMERA_HOME);
  });

  it('drifts toward the mouse by only a small amount', () => {
    const right = cameraDrift({ x: 1, y: 0 });
    const up = cameraDrift({ x: 0, y: 1 });
    expect(right[0]).toBeGreaterThan(CAMERA_HOME[0]);
    expect(up[1]).toBeGreaterThan(CAMERA_HOME[1]);
    for (const [x, y] of [[1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      const p = cameraDrift({ x, y });
      const d = Math.hypot(p[0] - CAMERA_HOME[0], p[1] - CAMERA_HOME[1], p[2] - CAMERA_HOME[2]);
      expect(d).toBeLessThan(0.75);
    }
  });
});
