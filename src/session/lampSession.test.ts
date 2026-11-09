import { describe, expect, it } from 'vitest';
import { createLampSession, type LampSession } from './lampSession';

const FRAME = 1 / 60;

/** Holds the button down over the Lamp at (x, y). */
function pressOnLamp(session: LampSession, x = 0, y = 0) {
  session.pointerDown({ x, y, overLamp: true });
}

/** Moves the pointer from `fromX` to `toX` over `seconds`, one frame at a time. */
function dragTo(session: LampSession, fromX: number, toX: number, seconds: number, overLamp = true) {
  const frames = Math.max(1, Math.round(seconds / FRAME));
  for (let i = 1; i <= frames; i++) {
    session.tick(FRAME);
    session.pointerMove({ x: fromX + ((toX - fromX) * i) / frames, y: 0, overLamp });
  }
}

/** Rubs back and forth across `width` pixels, each leg taking `legSeconds`. */
function rub(session: LampSession, legs: number, width = 100, legSeconds = 1 / 3) {
  for (let i = 0; i < legs; i++) {
    const [from, to] = i % 2 === 0 ? [0, width] : [width, 0];
    dragTo(session, from, to, legSeconds);
  }
}

describe('Lamp session: Rubbing builds Charge', () => {
  it('starts idle with no Charge', () => {
    const session = createLampSession();
    expect(session.state).toEqual({ phase: 'idle', charge: 0, isRubbing: false });
  });

  it('back-and-forth Rubbing on the Lamp builds Charge', () => {
    const session = createLampSession();
    pressOnLamp(session);
    rub(session, 6);
    expect(session.state.isRubbing).toBe(true);
    expect(session.state.phase).toBe('rubbing');
    expect(session.state.charge).toBeGreaterThan(0);
  });

  it('a single straight drag adds no Charge, however long', () => {
    const session = createLampSession();
    pressOnLamp(session);
    dragTo(session, 0, 2000, 3);
    expect(session.state.isRubbing).toBe(true);
    expect(session.state.charge).toBe(0);
  });

  it('tiny back-and-forth jiggles shorter than the minimum stroke add no Charge', () => {
    const session = createLampSession();
    pressOnLamp(session);
    rub(session, 30, 10, 0.05);
    expect(session.state.charge).toBe(0);
  });

  it('moving over the Lamp with the button up is not a Rub', () => {
    const session = createLampSession();
    for (let i = 0; i < 12; i++) dragTo(session, i % 2 ? 100 : 0, i % 2 ? 0 : 100, 1 / 3);
    expect(session.state).toEqual({ phase: 'idle', charge: 0, isRubbing: false });
  });

  it('rubbing with the button held but off the Lamp adds no Charge', () => {
    const session = createLampSession();
    session.pointerDown({ x: 0, y: 0, overLamp: false });
    for (let i = 0; i < 12; i++) dragTo(session, i % 2 ? 100 : 0, i % 2 ? 0 : 100, 1 / 3, false);
    expect(session.state.isRubbing).toBe(false);
    expect(session.state.charge).toBe(0);
  });

  it('leaving the Lamp ends the Rub', () => {
    const session = createLampSession();
    pressOnLamp(session);
    rub(session, 4);
    session.pointerMove({ x: 500, y: 0, overLamp: false });
    expect(session.state.isRubbing).toBe(false);
  });

  it('releasing the button ends the Rub', () => {
    const session = createLampSession();
    pressOnLamp(session);
    rub(session, 4);
    session.pointerUp();
    expect(session.state.isRubbing).toBe(false);
  });

  it('a stroke dragged off the Lamp and back does not count', () => {
    const session = createLampSession();
    pressOnLamp(session);
    dragTo(session, 0, 100, 1 / 3);
    dragTo(session, 100, 300, 1 / 3, false); // slides off the Lamp…
    session.pointerMove({ x: 0, y: 0, overLamp: true }); // …and jumps back on
    expect(session.state.charge).toBe(0);
  });

  it('about 6 s of steady back-and-forth Rubbing fills Charge from 0 to 1', () => {
    const halfway = createLampSession();
    pressOnLamp(halfway);
    rub(halfway, 9); // 3 s at 3 strokes per second
    expect(halfway.state.charge).toBeGreaterThan(0.35);
    expect(halfway.state.charge).toBeLessThan(0.65);

    const full = createLampSession();
    pressOnLamp(full);
    rub(full, 18); // 6 s
    rub(full, 1); // the reversal that ends the 18th stroke
    expect(full.state.charge).toBeCloseTo(1, 5);

    const almost = createLampSession();
    pressOnLamp(almost);
    rub(almost, 15); // 5 s
    expect(almost.state.charge).toBeLessThan(0.95);
  });

  it('faster Rub strokes add a small bonus', () => {
    const steady = createLampSession();
    pressOnLamp(steady);
    rub(steady, 5, 100, 1 / 3);

    const fast = createLampSession();
    pressOnLamp(fast);
    rub(fast, 5, 100, 1 / 8);

    const bonus = fast.state.charge / steady.state.charge;
    expect(bonus).toBeGreaterThan(1.1);
    expect(bonus).toBeLessThanOrEqual(1.5);
  });

  it('Charge holds for ~1.5 s after the last Rub stroke, then drains', () => {
    const session = createLampSession();
    pressOnLamp(session);
    rub(session, 10);
    session.pointerUp();
    const built = session.state.charge;

    for (let i = 0; i < 60; i++) session.tick(FRAME); // 1 s
    expect(session.state.charge).toBe(built);

    for (let i = 0; i < 60; i++) session.tick(FRAME); // 2 s
    expect(session.state.charge).toBeLessThan(built);
  });

  it('a pause while still holding on the Lamp also drains Charge', () => {
    const session = createLampSession();
    pressOnLamp(session);
    rub(session, 10);
    const built = session.state.charge;
    for (let i = 0; i < 180; i++) session.tick(FRAME);
    expect(session.state.isRubbing).toBe(true);
    expect(session.state.charge).toBeLessThan(built);
  });

  it('Charge drains back to 0, never below, and the Lamp returns to idle', () => {
    const session = createLampSession();
    pressOnLamp(session);
    rub(session, 6);
    session.pointerUp();
    for (let i = 0; i < 60 * 60; i++) session.tick(FRAME);
    expect(session.state).toEqual({ phase: 'idle', charge: 0, isRubbing: false });
  });

  it('Charge never rises above 1', () => {
    const session = createLampSession();
    pressOnLamp(session);
    rub(session, 60, 400, 0.05);
    expect(session.state.charge).toBe(1);
  });
});
