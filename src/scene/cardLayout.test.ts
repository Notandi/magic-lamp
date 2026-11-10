import { describe, expect, it } from 'vitest';
import { CARD_SIZE, fanArc } from './cardLayout';
import { GENIE_TORSO } from './genieGeometry';
import { LAMP_POSITION } from './Lamp';
import { LAMP_TOP, SPOUT_TIP } from './lampGeometry';

describe('Card fan arc', () => {
  const slots = fanArc(5);

  it('has one slot per Card, side by side without overlapping', () => {
    expect(slots).toHaveLength(5);
    for (let i = 1; i < slots.length; i++) {
      expect(slots[i].position[0] - slots[i - 1].position[0]).toBeGreaterThan(CARD_SIZE.width);
    }
  });

  it('floats in the upper half of the view, clear above the Lamp', () => {
    for (const s of slots) expect(s.position[1] - CARD_SIZE.height / 2).toBeGreaterThan(LAMP_TOP);
  });

  it('hangs in front of the Genie, centred on its torso', () => {
    expect(slots[2].position[0]).toBeCloseTo(SPOUT_TIP.x + LAMP_POSITION.x + GENIE_TORSO.x, 1);
    expect(slots[2].position[2]).toBeGreaterThan(GENIE_TORSO.z + 0.5);
  });

  it('fans outward: the middle Card is highest and upright, the outer ones lower and tilted outwards', () => {
    expect(slots[2].position[1]).toBeGreaterThan(slots[0].position[1]);
    expect(slots[2].position[1]).toBeGreaterThan(slots[4].position[1]);
    expect(slots[2].tilt).toBeCloseTo(0);
    expect(slots[0].tilt).toBeGreaterThan(0);
    expect(slots[4].tilt).toBeLessThan(0);
  });
});
