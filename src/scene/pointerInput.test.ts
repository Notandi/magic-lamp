import { describe, expect, it } from 'vitest';
import { canvasPointer, hoversCards, pressesWithHand, steersHand } from './pointerInput';

const rect = { left: 100, top: 50, width: 800, height: 400 };

describe('canvasPointer', () => {
  it('gives the position in canvas pixels and in normalised device coordinates', () => {
    expect(canvasPointer({ clientX: 500, clientY: 250 }, rect)).toEqual({ x: 400, y: 200, ndcX: 0, ndcY: 0 });
  });

  it('puts the top-left corner at (-1, 1) and the bottom-right at (1, -1)', () => {
    expect(canvasPointer({ clientX: 100, clientY: 50 }, rect)).toMatchObject({ ndcX: -1, ndcY: 1 });
    expect(canvasPointer({ clientX: 900, clientY: 450 }, rect)).toMatchObject({ ndcX: 1, ndcY: -1 });
  });
});

describe('which pointers drive the Hand', () => {
  it('a mouse steers the Hand whenever it moves', () => {
    expect(steersHand({ pointerType: 'mouse', isPrimary: true })).toBe(true);
  });

  it('the first finger on a touch screen steers the Hand', () => {
    expect(steersHand({ pointerType: 'touch', isPrimary: true })).toBe(true);
  });

  it('a second finger is ignored, so pinching does not make the Hand jump', () => {
    expect(steersHand({ pointerType: 'touch', isPrimary: false })).toBe(false);
  });

  it('a touch presses like the main mouse button', () => {
    expect(pressesWithHand({ pointerType: 'touch', isPrimary: true, button: 0 })).toBe(true);
    expect(pressesWithHand({ pointerType: 'mouse', isPrimary: true, button: 0 })).toBe(true);
  });

  it('other mouse buttons and second fingers do not press', () => {
    expect(pressesWithHand({ pointerType: 'mouse', isPrimary: true, button: 2 })).toBe(false);
    expect(pressesWithHand({ pointerType: 'touch', isPrimary: false, button: 0 })).toBe(false);
  });
});

describe('hoversCards', () => {
  it('a mouse hovering over a Card tilts it', () => {
    expect(hoversCards({ pointerType: 'mouse' })).toBe(true);
    expect(hoversCards({ pointerType: 'pen' })).toBe(true);
  });

  it('touch has no hover, so a finger never tilts a Card', () => {
    expect(hoversCards({ pointerType: 'touch' })).toBe(false);
  });
});
