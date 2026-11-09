/**
 * The one source of Hand input: a single set of browser pointer listeners, read with the rules in
 * pointerInput.ts, and one pick of the scene per event. The Hand reads its aim and grip from it,
 * and the Rub input listens to its presses, moves and releases.
 *
 * Mouse, pen and touch all work the same: the Hand follows the primary pointer (the first
 * finger on a touch screen), closes on the main button or first finger, and ignores other fingers.
 */

import { canvasPointer, pressesWithHand, steersHand, type CanvasPointer, type CanvasRect } from './pointerInput';

/** Distances along the pointer ray, at (ndcX, ndcY), to the Lamp and to the Cards; Infinity where it misses. */
export type HandPick = (ndcX: number, ndcY: number) => { lamp: number; cards: number };

/** A Hand press or move: where it is on the canvas and what it's over. */
export interface HandPointer extends CanvasPointer {
  /** Whether the pointer is over any part of the Lamp. */
  overLamp: boolean;
  /** Whether a Card is in front of the Lamp (or of nothing) under the pointer. */
  cardsInFront: boolean;
}

export interface HandInputListener {
  press?(pointer: HandPointer): void;
  move?(pointer: HandPointer): void;
  release?(): void;
}

export interface HandInput {
  /** Where the Hand points, in normalised device coordinates. Starts at the centre of the view. */
  readonly aim: { readonly x: number; readonly y: number };
  /** Whether the Hand is closed: the main button or first finger is down. */
  readonly pressed: boolean;
  /** Hears every Hand press, move and release from now on; returns a function that stops it. */
  listen(listener: HandInputListener): () => void;
  /** Removes the browser listeners. */
  dispose(): void;
}

export interface HandInputOptions {
  /** Where presses start. */
  canvas: EventTarget & { getBoundingClientRect(): CanvasRect };
  /** Where moves and releases are heard, so a drag that leaves the canvas still ends: the window. */
  page: EventTarget;
  pick: HandPick;
}

type BrowserPointer = Event & { clientX: number; clientY: number; pointerType: string; isPrimary: boolean; button: number };

const isPointer = (e: Event): e is BrowserPointer => 'isPrimary' in e;

export function createHandInput({ canvas, page, pick }: HandInputOptions): HandInput {
  const aim = { x: 0, y: 0 };
  let pressed = false;
  const listeners = new Set<HandInputListener>();

  /** Aims the Hand at the event and picks what's under it. */
  const aimAt = (e: BrowserPointer): HandPointer => {
    const at = canvasPointer(e, canvas.getBoundingClientRect());
    aim.x = at.ndcX;
    aim.y = at.ndcY;
    const hits = pick(at.ndcX, at.ndcY);
    return { ...at, overLamp: hits.lamp < Infinity, cardsInFront: hits.cards < hits.lamp };
  };

  const down = (e: Event) => {
    if (!isPointer(e) || !pressesWithHand(e)) return;
    const at = aimAt(e); // a tap has no move before it, so jump the Hand to the finger
    pressed = true;
    for (const l of listeners) l.press?.(at);
  };
  const move = (e: Event) => {
    if (!isPointer(e) || !steersHand(e)) return;
    const at = aimAt(e);
    for (const l of listeners) l.move?.(at);
  };
  const up = (e: Event) => {
    if (isPointer(e) && !steersHand(e)) return; // a second finger lifting doesn't open the Hand
    pressed = false;
    for (const l of listeners) l.release?.();
  };

  canvas.addEventListener('pointerdown', down);
  page.addEventListener('pointermove', move);
  page.addEventListener('pointerup', up);
  page.addEventListener('pointercancel', up);
  page.addEventListener('blur', up);

  return {
    aim,
    get pressed() {
      return pressed;
    },
    listen(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose() {
      canvas.removeEventListener('pointerdown', down);
      page.removeEventListener('pointermove', move);
      page.removeEventListener('pointerup', up);
      page.removeEventListener('pointercancel', up);
      page.removeEventListener('blur', up);
      listeners.clear();
    },
  };
}
