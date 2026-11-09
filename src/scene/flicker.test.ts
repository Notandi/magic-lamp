import { describe, expect, it } from 'vitest';
import { candleIntensity, gemGlow } from './flicker';

describe('candle light', () => {
  it('flickers around its base intensity without going dark', () => {
    const samples = Array.from({ length: 200 }, (_, i) => candleIntensity(i * 0.05));
    expect(Math.min(...samples)).toBeGreaterThan(30);
    expect(Math.max(...samples)).toBeLessThan(50);
    expect(new Set(samples.map((s) => s.toFixed(2))).size).toBeGreaterThan(10);
  });
});

describe('gem glow', () => {
  it('pulses but always glows', () => {
    const samples = Array.from({ length: 200 }, (_, i) => gemGlow(i * 0.05));
    expect(Math.min(...samples)).toBeGreaterThan(0.5);
    expect(Math.max(...samples) - Math.min(...samples)).toBeGreaterThan(0.5);
  });
});
