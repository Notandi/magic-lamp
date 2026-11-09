/** Warm candle key light intensity at time `t` (seconds): a gentle, uneven flicker. */
export function candleIntensity(t: number): number {
  return 40 + Math.sin(t * 7) * 2 + Math.sin(t * 13) * 1.5;
}

/** Emissive intensity of the Lamp's gem finial at time `t` (seconds): a slow pulse. */
export function gemGlow(t: number): number {
  return 1 + Math.sin(t * 2) * 0.4;
}
