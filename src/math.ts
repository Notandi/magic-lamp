/** Small number helpers shared by the Lamp session and the scene. */

/** `value` limited to 0..1. */
export const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * How much of the remaining gap an exponential follow closes in `dt` seconds, at `rate` per
 * second. Use it as the lerp/slerp amount so following looks the same at any frame rate.
 */
export const followAmount = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);

/** Moves `from` toward `to` by an exponential follow at `rate` per second over `dt` seconds. */
export const damp = (from: number, to: number, rate: number, dt: number) =>
  from + (to - from) * followAmount(rate, dt);
