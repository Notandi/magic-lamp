/**
 * Adaptive quality: watches the frame rate and picks a quality level, stepping down
 * when the scene falls short of ~60 fps for a sustained period and back up once it
 * has recovered. No React or three.js here, so it can be tested on its own.
 */

export interface QualitySettings {
  /** Most Smoke puffs alive at once. */
  smokeBudget: number;
  /** Bloom render resolution as a fraction of the screen. */
  bloomResolutionScale: number;
}

/** Quality levels from best (index 0) to cheapest. */
export const QUALITY_LEVELS: readonly QualitySettings[] = [
  { smokeBudget: 400, bloomResolutionScale: 0.5 },
  { smokeBudget: 280, bloomResolutionScale: 0.4 },
  { smokeBudget: 180, bloomResolutionScale: 0.3 },
  { smokeBudget: 100, bloomResolutionScale: 0.2 },
];

/** Tuning constants for adaptive quality, kept together so they're easy to change. */
export const QUALITY_TUNING = {
  /** Seconds of frames averaged into one frame-rate sample. */
  window: 0.5,
  /** A frame longer than this (seconds) is a pause, e.g. a background tab, not slowness; it is skipped. */
  maxFrame: 0.25,
  /** Average fps below which a sample counts as too slow. */
  lowFps: 52,
  /** Seconds of consecutive slow samples before stepping down. */
  stepDownAfter: 2,
  /** Average fps at or above which a sample counts as healthy. */
  highFps: 57,
  /** Seconds of consecutive healthy samples before trying a better level. */
  stepUpAfter: 8,
  /** Seconds after a step up during which a step back down counts as a failed recovery. */
  probation: 10,
  /** Each failed recovery multiplies the wait before the next try (hysteresis). */
  backoff: 3,
  /** Longest wait (seconds) before trying a better level again. */
  maxStepUpAfter: 300,
};

export interface QualityController {
  /** Report one rendered frame's duration in seconds. */
  frame(dt: number): void;
  /** Current level: an index into the levels, 0 = best. */
  readonly level: number;
  readonly settings: QualitySettings;
}

export function createQualityController(levels: readonly QualitySettings[] = QUALITY_LEVELS): QualityController {
  const t = QUALITY_TUNING;
  let level = 0;
  let windowTime = 0;
  let windowFrames = 0;
  let slowFor = 0;
  let healthyFor = 0;
  /** Healthy seconds needed before the next step up; grows after each failed recovery. */
  let upWait = t.stepUpAfter;
  /** Seconds since the last step up, or Infinity if it has passed probation. */
  let sinceUp = Infinity;

  function onSample(fps: number, duration: number) {
    sinceUp += duration;
    if (sinceUp > t.probation) {
      if (sinceUp !== Infinity) upWait = t.stepUpAfter;
      sinceUp = Infinity;
    }
    if (fps < t.lowFps) {
      slowFor += duration;
      if (slowFor >= t.stepDownAfter - 1e-9 && level < levels.length - 1) {
        level++;
        slowFor = 0;
        if (sinceUp !== Infinity) upWait = Math.min(upWait * t.backoff, t.maxStepUpAfter);
        sinceUp = Infinity;
      }
    } else {
      slowFor = 0;
    }
    if (fps >= t.highFps) {
      healthyFor += duration;
      if (healthyFor >= upWait - 1e-9 && level > 0) {
        level--;
        healthyFor = 0;
        slowFor = 0;
        sinceUp = 0;
      }
    } else {
      healthyFor = 0;
    }
  }

  return {
    frame(dt) {
      if (dt > t.maxFrame) {
        windowTime = 0;
        windowFrames = 0;
        return;
      }
      windowTime += dt;
      windowFrames++;
      if (windowTime >= t.window - 1e-9) {
        onSample(windowFrames / windowTime, windowTime);
        windowTime = 0;
        windowFrames = 0;
      }
    },
    get level() {
      return level;
    },
    get settings() {
      return levels[level];
    },
  };
}
