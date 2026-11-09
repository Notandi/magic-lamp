/**
 * Smoke logic: how Charge maps to the Smoke's look, and the lifecycle of its puffs.
 * No React or three.js here, so it can be tested on its own.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface SmokeLook {
  /** Puffs released per second. */
  emissionRate: number;
  /** Puff size (world units) at full growth. */
  size: number;
  /** Puff colour (linear 0..1). */
  color: Rgb;
}

/** Tuning constants for the Smoke, kept together so they're easy to change. */
export const SMOKE_TUNING = {
  /** Puffs per second at full Charge. */
  maxEmissionRate: 90,
  /** Charge below which no Smoke is released. */
  emissionThreshold: 0.02,
  minSize: 0.25,
  maxSize: 0.7,
  grey: { r: 0.45, g: 0.45, b: 0.47 },
  purple: { r: 0.62, g: 0.22, b: 1.0 },
  /** Seconds a puff lives. */
  puffLifetime: 2.6,
  /** Upward speed (world units/second) of a fresh puff. */
  riseSpeed: 0.55,
} as const;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** The Smoke's emission rate, puff size and colour for a given Charge (0..1). */
export function smokeLook(charge: number): SmokeLook {
  const c = clamp01(charge);
  const t = SMOKE_TUNING;
  const emissionRate = c < t.emissionThreshold ? 0 : t.maxEmissionRate * Math.pow(c, 1.3);
  // Colour turns purple a little ahead of Charge so the shift is noticeable early.
  const hue = Math.pow(c, 0.8);
  return {
    emissionRate,
    size: mix(t.minSize, t.maxSize, c),
    color: {
      r: mix(t.grey.r, t.purple.r, hue),
      g: mix(t.grey.g, t.purple.g, hue),
      b: mix(t.grey.b, t.purple.b, hue),
    },
  };
}

/** One Smoke puff. Position is relative to the spout tip, in world units. */
export interface Puff {
  alive: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** Seconds since release. */
  age: number;
  /** Seconds this puff lives. */
  life: number;
  /** Full-grown size, fixed at release from the Charge at that moment. */
  size: number;
  r: number;
  g: number;
  b: number;
  /** Per-puff random phase, so puffs don't drift in lockstep. */
  seed: number;
  /** Current rendered size (world units), updated each step. */
  scale: number;
  /** Current rendered opacity 0..1, updated each step. */
  opacity: number;
}

export interface SmokePool {
  /** Max live puffs. Lowering it removes the excess puffs on the next step. */
  budget: number;
  /** All puff slots; only those with `alive` set are drawn. */
  readonly puffs: readonly Puff[];
  readonly liveCount: number;
  /** Advances the Smoke by `dt` seconds, releasing puffs according to `charge`. */
  step(dt: number, charge: number): void;
}

export interface SmokePoolOptions {
  budget: number;
  /** Random source in [0, 1); injectable for deterministic runs. */
  random?: () => number;
}

const newPuff = (): Puff => ({
  alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, age: 0, life: 1,
  size: 0, r: 0, g: 0, b: 0, seed: 0, scale: 0, opacity: 0,
});

/** A pool of Smoke puffs released from the spout tip at a rate set by Charge. */
export function createSmokePool({ budget, random = Math.random }: SmokePoolOptions): SmokePool {
  const puffs: Puff[] = [];
  let liveCount = 0;
  let time = 0;
  let pending = 0;
  const t = SMOKE_TUNING;

  const release = (look: SmokeLook) => {
    let slot = -1;
    for (let i = 0; i < pool.budget; i++) {
      if (i >= puffs.length) puffs.push(newPuff());
      if (!puffs[i].alive) {
        slot = i;
        break;
      }
    }
    if (slot < 0) return;
    const p = puffs[slot];
    const spread = 0.04;
    p.alive = true;
    p.x = (random() - 0.5) * spread;
    p.y = 0;
    p.z = (random() - 0.5) * spread;
    p.vx = (random() - 0.5) * 0.15;
    p.vy = t.riseSpeed * (0.7 + random() * 0.6);
    p.vz = (random() - 0.5) * 0.15;
    p.age = 0;
    p.life = t.puffLifetime * (0.75 + random() * 0.5);
    p.size = look.size * (0.7 + random() * 0.6);
    p.r = look.color.r;
    p.g = look.color.g;
    p.b = look.color.b;
    p.seed = random() * 100;
    p.scale = 0;
    p.opacity = 0;
    liveCount++;
  };

  const pool: SmokePool = {
    budget,
    puffs,
    get liveCount() {
      return liveCount;
    },
    step(dt, charge) {
      time += dt;

      for (let i = 0; i < puffs.length; i++) {
        const p = puffs[i];
        if (!p.alive) continue;
        p.age += dt;
        if (p.age >= p.life || i >= pool.budget) {
          p.alive = false;
          liveCount--;
          continue;
        }
        // Smooth, layered sine flow field: soft sideways drift and swirl, no grid.
        const s = p.seed;
        const ax = Math.sin(p.y * 2.1 + time * 0.7 + s) + 0.6 * Math.sin(p.z * 3.3 + time * 1.3 + s * 1.7);
        const az = Math.cos(p.y * 1.9 + time * 0.8 + s * 0.6) + 0.6 * Math.sin(p.x * 3.1 + time * 1.1 + s * 2.3);
        p.vx += ax * 0.35 * dt;
        p.vz += az * 0.35 * dt;
        // Rising vapour slows and spreads as it cools.
        const drag = Math.exp(-0.6 * dt);
        p.vx *= drag;
        p.vz *= drag;
        p.vy *= Math.exp(-0.25 * dt);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;

        const k = p.age / p.life;
        // Grow quickly from a wisp and keep expanding; fade in fast, fade out slowly.
        p.scale = p.size * (0.3 + 0.7 * Math.sqrt(k)) * (1 + 0.5 * k);
        p.opacity = Math.min(1, k / 0.12) * Math.pow(1 - k, 1.5);
      }

      const look = smokeLook(charge);
      pending += look.emissionRate * dt;
      while (pending >= 1) {
        pending -= 1;
        release(look);
      }
    },
  };
  return pool;
}
