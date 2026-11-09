import { describe, expect, it } from 'vitest';
import { createHandInput, type HandPick, type HandPointer } from './handInput';

const rect = { left: 0, top: 0, width: 200, height: 100 };

/** A pointer event as the browser sends it. */
function pointer(type: string, { x = 100, y = 50, isPrimary = true, button = 0, pointerType = 'mouse' } = {}) {
  return Object.assign(new Event(type), { clientX: x, clientY: y, isPrimary, button, pointerType });
}

/** A Hand input on a fake canvas; `pick` says what each pointer ray hits. */
function setup(pick: HandPick = () => ({ lamp: 5, cards: Infinity })) {
  const canvas = Object.assign(new EventTarget(), { getBoundingClientRect: () => rect });
  const page = new EventTarget();
  const input = createHandInput({ canvas, page, pick });
  const heard: (string | HandPointer)[] = [];
  input.listen({
    press: (p) => heard.push({ ...p }),
    move: (p) => heard.push({ ...p }),
    release: () => heard.push('release'),
  });
  return { canvas, page, input, heard };
}

describe('Hand input', () => {
  it('starts open, aimed at the centre of the view', () => {
    const { input } = setup();
    expect(input.pressed).toBe(false);
    expect(input.aim).toEqual({ x: 0, y: 0 });
  });

  it('a press closes the Hand, aims it at the press and reports whether it is over the Lamp', () => {
    const { canvas, input, heard } = setup();
    canvas.dispatchEvent(pointer('pointerdown', { x: 200, y: 0 }));
    expect(input.pressed).toBe(true);
    expect(input.aim).toEqual({ x: 1, y: 1 });
    expect(heard).toEqual([{ x: 200, y: 0, ndcX: 1, ndcY: 1, overLamp: true, cardsInFront: false }]);
  });

  it('reports a press on a Card in front of the Lamp', () => {
    const { canvas, heard } = setup(() => ({ lamp: 5, cards: 3 }));
    canvas.dispatchEvent(pointer('pointerdown'));
    expect(heard[0]).toMatchObject({ overLamp: true, cardsInFront: true });
  });

  it('moves anywhere on the page steer the Hand, and releasing opens it', () => {
    const { canvas, page, input, heard } = setup(() => ({ lamp: Infinity, cards: Infinity }));
    canvas.dispatchEvent(pointer('pointerdown'));
    page.dispatchEvent(pointer('pointermove', { x: 0, y: 100 }));
    expect(input.aim).toEqual({ x: -1, y: -1 });
    page.dispatchEvent(pointer('pointerup'));
    expect(input.pressed).toBe(false);
    expect(heard.slice(1)).toEqual([{ x: 0, y: 100, ndcX: -1, ndcY: -1, overLamp: false, cardsInFront: false }, 'release']);
  });

  it('a second finger neither presses, moves nor releases the Hand', () => {
    const { canvas, page, input, heard } = setup();
    canvas.dispatchEvent(pointer('pointerdown', { pointerType: 'touch' }));
    const second = { pointerType: 'touch', isPrimary: false, x: 10, y: 10 };
    canvas.dispatchEvent(pointer('pointerdown', second));
    page.dispatchEvent(pointer('pointermove', second));
    page.dispatchEvent(pointer('pointerup', second));
    expect(input.pressed).toBe(true);
    expect(input.aim).toEqual({ x: 0, y: 0 });
    expect(heard).toHaveLength(1);
  });

  it('only the main mouse button closes the Hand', () => {
    const { canvas, input, heard } = setup();
    canvas.dispatchEvent(pointer('pointerdown', { button: 2 }));
    expect(input.pressed).toBe(false);
    expect(heard).toEqual([]);
  });

  it('losing focus opens the Hand', () => {
    const { canvas, page, input, heard } = setup();
    canvas.dispatchEvent(pointer('pointerdown'));
    page.dispatchEvent(new Event('blur'));
    expect(input.pressed).toBe(false);
    expect(heard.at(-1)).toBe('release');
  });

  it('stops listening once disposed', () => {
    const { canvas, input, heard } = setup();
    input.dispose();
    canvas.dispatchEvent(pointer('pointerdown'));
    expect(input.pressed).toBe(false);
    expect(heard).toEqual([]);
  });
});
