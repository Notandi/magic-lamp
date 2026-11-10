import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { LAMP_TOP, SPOUT_TIP, buildLampGeometry, loft } from './lampGeometry';

describe('loft', () => {
  const straight = new THREE.LineCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(2, 0, 0));
  const tube = loft(straight, () => [0.5, 0.25], 4, 16);

  it('sweeps an ellipse of the given half-width and half-height along the spine', () => {
    tube.computeBoundingBox();
    const { min, max } = tube.boundingBox!;
    expect([min.x, max.x]).toEqual([0, 2]);
    expect(max.z).toBeCloseTo(0.5);
    expect(min.z).toBeCloseTo(-0.5);
    expect(max.y).toBeCloseTo(0.25);
    expect(min.y).toBeCloseTo(-0.25);
  });

  it('faces outward, so the Hand rests on the outside of the Lamp', () => {
    const position = tube.attributes.position;
    const normal = tube.attributes.normal;
    const p = new THREE.Vector3();
    const n = new THREE.Vector3();
    for (let i = 0; i < position.count; i++) {
      p.fromBufferAttribute(position, i).setX(0);
      n.fromBufferAttribute(normal, i);
      expect(n.dot(p)).toBeGreaterThan(0);
    }
  });
});

describe('the Lamp', () => {
  const lamp = buildLampGeometry();

  it('has its spout tip at the open end of the body, up and forward of the lid', () => {
    lamp.body.computeBoundingBox();
    // the lip flares a little past the tip's centre
    expect(lamp.body.boundingBox!.max.x - SPOUT_TIP.x).toBeGreaterThan(0);
    expect(lamp.body.boundingBox!.max.x - SPOUT_TIP.x).toBeLessThan(0.2);
    expect(SPOUT_TIP.y).toBeGreaterThan(2);
    expect(SPOUT_TIP.z).toBe(0);
  });

  it('is no taller than LAMP_TOP, which the Cards are laid out above', () => {
    for (const part of [lamp.body, lamp.lid, lamp.scroll]) {
      part.computeBoundingBox();
      expect(part.boundingBox!.max.y).toBeLessThanOrEqual(LAMP_TOP);
    }
    lamp.finialGem.computeBoundingBox();
    expect(lamp.finialGemPosition[1] + lamp.finialGem.boundingBox!.max.y).toBeCloseTo(LAMP_TOP, 1);
  });

  it('stands on the ground', () => {
    lamp.foot.computeBoundingBox();
    expect(lamp.foot.boundingBox!.min.y).toBeCloseTo(0);
  });

  it('has no broken geometry', () => {
    for (const [name, part] of Object.entries(lamp)) {
      if (!(part instanceof THREE.BufferGeometry)) continue;
      const bad = Array.from(part.attributes.position.array).some((v) => !Number.isFinite(v));
      expect(bad, name).toBe(false);
    }
  });
});
