import { describe, expect, it } from 'vitest';
import { hintFor } from './Hint';

describe('the hint for a new player', () => {
  it('says to Rub the Lamp before the first Wish, and to keep going once Charge is building', () => {
    expect(hintFor({ phase: 'idle', wishId: 0, charge: 0 })).toBe('Rub the lamp');
    expect(hintFor({ phase: 'rubbing', wishId: 0, charge: 0.7 })).toBe('Keep rubbing…');
  });

  it('is silent while the Genie pours out', () => {
    expect(hintFor({ phase: 'wishing', wishId: 1, charge: 0 })).toBeNull();
  });

  it("says what the Cards can do while the first Wish's Cards are on show", () => {
    expect(hintFor({ phase: 'showing', wishId: 1, charge: 0 })).toMatch(/look closer/);
    expect(hintFor({ phase: 'inspecting', wishId: 1, charge: 0 })).toBeNull();
  });

  it('says nothing after the first Wish', () => {
    expect(hintFor({ phase: 'rubbing', wishId: 1, charge: 0.4 })).toBeNull();
    expect(hintFor({ phase: 'showing', wishId: 2, charge: 0 })).toBeNull();
  });
});
