import { describe, expect, it } from 'vitest';
import {
  CAMERA_FIT_ASPECT,
  CAMERA_HOME,
  CAMERA_TARGET,
  CAMERA_WISH,
  cameraDrift,
  cameraView,
  type CameraView,
} from './camera';

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

describe('camera view', () => {
  const distance = (v: CameraView) => Math.hypot(...v.position.map((p, i) => p - v.target[i]));

  it('is the home view of the Lamp while the Genie is in it', () => {
    expect(cameraView(0, 16 / 9)).toEqual({ position: CAMERA_HOME, target: CAMERA_TARGET });
  });

  it('draws back and looks higher to take in the Genie when it is out', () => {
    const home = cameraView(0, 16 / 9);
    const wish = cameraView(1, 16 / 9);
    expect(wish).toEqual(CAMERA_WISH);
    expect(distance(wish)).toBeGreaterThan(distance(home));
    expect(wish.target[1]).toBeGreaterThan(home.target[1]);
  });

  it('backs away in a narrow window so the Lamp still fits, looking at the same point', () => {
    const wide = cameraView(0, CAMERA_FIT_ASPECT);
    const narrow = cameraView(0, CAMERA_FIT_ASPECT / 2);
    expect(narrow.target).toEqual(wide.target);
    expect(distance(narrow)).toBeCloseTo(distance(wide) * 2);
    expect(cameraView(0, 3)).toEqual(wide);
  });

  it('drifts around whichever view it is in', () => {
    expect(cameraDrift({ x: 0, y: 0 }, CAMERA_WISH.position)).toEqual(CAMERA_WISH.position);
  });
});
