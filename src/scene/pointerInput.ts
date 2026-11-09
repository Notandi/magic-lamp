/*
 * Pure rules for turning browser pointer events (mouse, pen or touch) into Hand input.
 * Shared by the Hand, the Rub input and Card play so every one of them reads the
 * pointer the same way.
 */

export interface CanvasRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface CanvasPointer {
  /** CSS pixels from the canvas's top-left corner. */
  x: number;
  y: number;
  /** Normalised device coordinates: -1..1, +Y up. */
  ndcX: number;
  ndcY: number;
}

/** Where a pointer event lands on the canvas, from its client coordinates. */
export function canvasPointer(e: { clientX: number; clientY: number }, rect: CanvasRect): CanvasPointer {
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  return { x, y, ndcX: (x / rect.width) * 2 - 1, ndcY: -(y / rect.height) * 2 + 1 };
}

type PointerKind = { pointerType: string; isPrimary: boolean };

/** Whether this pointer moves the Hand. Only the primary pointer does, so a second finger can't yank it away. */
export function steersHand(e: PointerKind): boolean {
  return e.isPrimary;
}

/** Whether this press closes the Hand: the main mouse button, or the first finger on a touch screen. */
export function pressesWithHand(e: PointerKind & { button: number }): boolean {
  return e.isPrimary && e.button === 0;
}

/** Whether this pointer can hover over Cards to tilt them. Touch has no hover. */
export function hoversCards(e: { pointerType: string }): boolean {
  return e.pointerType !== 'touch';
}
