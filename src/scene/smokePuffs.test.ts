import { describe, expect, it } from 'vitest';
import { createSmokePool, smokeLook, type SmokePool } from './smokePuffs';

describe('Smoke look follows Charge', () => {
  it('emits nothing at zero Charge', () => {
    expect(smokeLook(0).emissionRate).toBe(0);
  });

  it('gets denser and bigger as Charge rises', () => {
    const low = smokeLook(0.2);
    const high = smokeLook(0.9);
    expect(low.emissionRate).toBeGreaterThan(0);
    expect(high.emissionRate).toBeGreaterThan(low.emissionRate);
    expect(high.size).toBeGreaterThan(low.size);
  });

  it('is grey at low Charge and magical purple at full Charge', () => {
    const grey = smokeLook(0).color;
    expect(Math.max(grey.r, grey.g, grey.b) - Math.min(grey.r, grey.g, grey.b)).toBeLessThan(0.05);
    const purple = smokeLook(1).color;
    expect(purple.b).toBeGreaterThan(purple.g + 0.3);
    expect(purple.r).toBeGreaterThan(purple.g + 0.15);
  });
});

describe('Smoke puff pool', () => {
  const run = (pool: SmokePool, seconds: number, charge: number) => {
    for (let i = 0; i < seconds * 60; i++) pool.step(1 / 60, charge);
  };

  it('releases no Smoke at zero Charge', () => {
    const pool = createSmokePool({ budget: 200 });
    run(pool, 2, 0);
    expect(pool.liveCount).toBe(0);
  });

  it('releases Smoke while Charged, and it rises from the spout', () => {
    const pool = createSmokePool({ budget: 500 });
    run(pool, 1, 0.8);
    const live = pool.puffs.filter((p) => p.alive);
    expect(live.length).toBeGreaterThan(10);
    const meanY = live.reduce((s, p) => s + p.y, 0) / live.length;
    expect(meanY).toBeGreaterThan(0.1);
  });

  it('releases more Smoke at higher Charge', () => {
    const low = createSmokePool({ budget: 1000 });
    const high = createSmokePool({ budget: 1000 });
    run(low, 1, 0.2);
    run(high, 1, 0.9);
    expect(high.liveCount).toBeGreaterThan(low.liveCount * 2);
  });

  it('thins out and vanishes once Charge drains', () => {
    const pool = createSmokePool({ budget: 500 });
    run(pool, 1, 1);
    run(pool, 5, 0);
    expect(pool.liveCount).toBe(0);
  });

  it('never has more live puffs than the particle budget', () => {
    const pool = createSmokePool({ budget: 30 });
    run(pool, 3, 1);
    expect(pool.liveCount).toBe(30);
  });

  it('respects a lowered particle budget', () => {
    const pool = createSmokePool({ budget: 300 });
    run(pool, 2, 1);
    pool.budget = 40;
    run(pool, 0.1, 1);
    expect(pool.liveCount).toBeLessThanOrEqual(40);
  });

  it('drifts sideways rather than rising in a straight line', () => {
    const pool = createSmokePool({ budget: 500 });
    run(pool, 2, 1);
    const live = pool.puffs.filter((p) => p.alive && p.y > 0.5);
    const spreadX = Math.max(...live.map((p) => p.x)) - Math.min(...live.map((p) => p.x));
    expect(spreadX).toBeGreaterThan(0.1);
  });
});

describe('Smoke swirl column and dissolve', () => {
  const swirl = (pool: SmokePool, seconds: number) => {
    for (let i = 0; i < seconds * 60; i++) pool.step(1 / 60, 0, 1);
  };

  it('a Wish swirls Smoke into a tall, narrow, spinning column even at zero Charge', () => {
    const pool = createSmokePool({ budget: 800 });
    swirl(pool, 2);
    const live = pool.puffs.filter((p) => p.alive);
    expect(live.length).toBeGreaterThan(50);
    const tall = live.filter((p) => p.y > 1);
    expect(tall.length).toBeGreaterThan(10);
    // Narrow: puffs stay close to the column's axis.
    const meanRadius = live.reduce((s, p) => s + Math.hypot(p.x, p.z), 0) / live.length;
    expect(meanRadius).toBeLessThan(0.5);
    // Spinning: puffs circle the axis in one direction (angular momentum about y).
    const spin = live.reduce((s, p) => s + (p.x * p.vz - p.z * p.vx), 0) / live.length;
    expect(Math.abs(spin)).toBeGreaterThan(0.01);
  });

  it('a dissolve burst releases Smoke at the given point, within the budget', () => {
    const pool = createSmokePool({ budget: 20 });
    pool.burst({ x: 1, y: 2, z: 0 }, 50);
    expect(pool.liveCount).toBe(20);
    for (const p of pool.puffs.filter((q) => q.alive)) {
      expect(Math.hypot(p.x - 1, p.y - 2, p.z)).toBeLessThan(0.5);
    }
  });
});
