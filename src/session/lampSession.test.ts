import { describe, expect, it } from 'vitest';
import { createLampSession, LAMP_TUNING, type LampSession } from './lampSession';
import type { Card, CardDraw, CardSource } from './cardSource';

/** A card source the test controls: each request waits until the test resolves it. */
function fakeCardSource() {
  const requests: { count: number; resolve: (draw: CardDraw) => void }[] = [];
  const source: CardSource = {
    drawCards(count) {
      return new Promise((resolve) => requests.push({ count, resolve }));
    },
  };
  return { source, requests };
}

const card = (name: string): Card => ({
  name,
  frontImageUrl: `https://example.test/${name}/front.jpg`,
  backImageUrl: `https://example.test/${name}/back.jpg`,
  scryfallUri: `https://example.test/${name}`,
});

const fiveCards = () => ['A', 'B', 'C', 'D', 'E'].map(card);

/** Rubs steadily from a fresh press until Charge fills and a Wish starts. */
function rubUntilWish(session: LampSession) {
  pressOnLamp(session);
  const legFrames = 20; // 1/3 s legs across 100 px
  for (let frame = 1; frame <= 60 * 60 && session.state.phase !== 'wishing'; frame++) {
    const leg = Math.floor((frame - 1) / legFrames);
    const along = ((frame - 1) % legFrames + 1) / legFrames;
    session.tick(FRAME);
    session.pointerMove({ x: 100 * (leg % 2 === 0 ? along : 1 - along), y: 0, overLamp: true });
  }
  expect(session.state.phase).toBe('wishing');
}

/** Lets resolved card-source promises reach the session. */
const flush = () => new Promise((r) => setTimeout(r, 0));

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
    expect(session.state).toMatchObject({ phase: 'idle', charge: 0, isRubbing: false });
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
    expect(session.state).toMatchObject({ phase: 'idle', charge: 0, isRubbing: false });
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

  it('Charge builds at a rate that fills it in about 6 s of steady Rubbing', () => {
    const halfway = createLampSession();
    pressOnLamp(halfway);
    rub(halfway, 9); // 3 s at 3 strokes per second
    expect(halfway.state.charge).toBeGreaterThan(0.35);
    expect(halfway.state.charge).toBeLessThan(0.65);

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
    expect(session.state).toMatchObject({ phase: 'idle', charge: 0, isRubbing: false });
  });

  it('Charge never rises above 1', () => {
    const session = createLampSession();
    pressOnLamp(session);
    for (let i = 0; i < 200; i++) {
      rub(session, 1, 400, 0.05);
      expect(session.state.charge).toBeLessThanOrEqual(1);
    }
  });
});

describe('Lamp session: the Wish', () => {
  it('steady Rubbing for the fill time triggers exactly one Wish', () => {
    const session = createLampSession();
    expect(session.state.wishId).toBe(0);
    pressOnLamp(session);
    rub(session, 19); // 18 strokes fill Charge; the 19th leg's reversal ends the 18th
    expect(session.state.phase).toBe('wishing');
    expect(session.state.wishId).toBe(1);
    expect(session.state.charge).toBe(0);

    rub(session, 30); // keeps rubbing through the Wish
    expect(session.state.wishId).toBe(1);
  });
});

describe('Lamp session: Cards for the next Wish', () => {
  it('asks the card source for the next Wish\'s Cards when a Rub starts', () => {
    const { source, requests } = fakeCardSource();
    const session = createLampSession({ cardSource: source });
    session.pointerMove({ x: 0, y: 0, overLamp: true }); // hovering is not a Rub
    expect(requests).toHaveLength(0);

    pressOnLamp(session);
    expect(requests).toHaveLength(1);
    expect(requests[0].count).toBe(5);

    session.pointerUp();
    pressOnLamp(session); // a second Rub before the first request resolves
    expect(requests).toHaveLength(1);
  });
});

describe('Lamp session: a Wish\'s Cards', () => {
  it('attaches the Cards the card source prepared', async () => {
    const { source, requests } = fakeCardSource();
    const session = createLampSession({ cardSource: source });
    expect(session.state.cards).toBeNull();

    pressOnLamp(session);
    requests[0].resolve({ kind: 'cards', cards: fiveCards() });
    await flush();
    rubUntilWish(session);
    expect(session.state.cards).toEqual({ kind: 'cards', cards: fiveCards() });
  });

  it('a card source that reports "magic unavailable" still produces a Wish with face-down Cards', async () => {
    const { source, requests } = fakeCardSource();
    const session = createLampSession({ cardSource: source });
    pressOnLamp(session);
    requests[0].resolve({ kind: 'magic-unavailable' });
    await flush();
    rubUntilWish(session);
    expect(session.state.wishId).toBe(1);
    expect(session.state.cards).toEqual({ kind: 'face-down', count: 5, reason: 'magic-unavailable' });
  });
});

describe('Lamp session: during and after a Wish', () => {
  it('ignores Rubs while the Cards are rising', () => {
    const session = createLampSession();
    rubUntilWish(session);
    session.pointerUp();
    pressOnLamp(session);
    rub(session, 12);
    expect(session.state).toMatchObject({ phase: 'wishing', charge: 0, isRubbing: false, wishId: 1 });
  });

  it('moves to showing when the scene reports the Cards have settled', async () => {
    const session = createLampSession();
    pressOnLamp(session);
    await flush(); // the placeholder card source answers at once
    rubUntilWish(session);
    session.cardsSettled();
    expect(session.state.phase).toBe('showing');
    expect(session.state.cards).not.toBeNull();
  });

  it('the first Rub stroke after the Cards settle clears them and adds Charge', async () => {
    const session = createLampSession();
    pressOnLamp(session);
    await flush();
    rubUntilWish(session);
    session.cardsSettled();
    session.pointerUp();

    pressOnLamp(session);
    dragTo(session, 0, 100, 1 / 3); // a leg, not yet ended by a reversal
    expect(session.state.phase).toBe('showing');
    expect(session.state.cards).not.toBeNull();

    dragTo(session, 100, 0, 1 / 3); // the reversal counts the stroke
    expect(session.state.phase).toBe('rubbing');
    expect(session.state.cards).toBeNull();
    expect(session.state.charge).toBeGreaterThan(0);
  });

  it('the next Wish replaces the Cards, and its Cards are requested afresh', async () => {
    const { source, requests } = fakeCardSource();
    const session = createLampSession({ cardSource: source });
    pressOnLamp(session);
    requests[0].resolve({ kind: 'cards', cards: fiveCards() });
    await flush();
    rubUntilWish(session);
    session.cardsSettled();
    session.pointerUp();

    pressOnLamp(session);
    expect(requests).toHaveLength(2);
    const second = ['F', 'G', 'H', 'I', 'J'].map(card);
    requests[1].resolve({ kind: 'cards', cards: second });
    await flush();
    rub(session, 20);
    expect(session.state.wishId).toBe(2);
    expect(session.state.cards).toEqual({ kind: 'cards', cards: second });
  });
});

describe('Lamp session: Cards that are not ready when Charge fills', () => {
  const wait = (session: LampSession, seconds: number) => {
    for (let i = 0; i < Math.round(seconds / FRAME); i++) session.tick(FRAME);
  };

  it('the Wish starts at once and takes Cards that arrive within the wait', async () => {
    const { source, requests } = fakeCardSource();
    const session = createLampSession({ cardSource: source });
    rubUntilWish(session);
    expect(session.state.wishId).toBe(1);
    expect(session.state.cards).toBeNull();

    session.cardsSettled(); // nothing has risen yet, so this is ignored
    expect(session.state.phase).toBe('wishing');

    wait(session, LAMP_TUNING.cardWaitSeconds / 2);
    requests[0].resolve({ kind: 'cards', cards: fiveCards() });
    await flush();
    expect(session.state.cards).toEqual({ kind: 'cards', cards: fiveCards() });
    session.cardsSettled();
    expect(session.state.phase).toBe('showing');
  });

  it('falls back to face-down Cards once the wait runs out', () => {
    const { source } = fakeCardSource();
    const session = createLampSession({ cardSource: source });
    rubUntilWish(session);
    wait(session, LAMP_TUNING.cardWaitSeconds - 0.1);
    expect(session.state.cards).toBeNull();
    wait(session, 0.2);
    expect(session.state.cards).toEqual({ kind: 'face-down', count: 5, reason: 'not-ready' });
    expect(session.state.phase).toBe('wishing');
  });

  it('Cards that arrive too late are kept for the next Wish', async () => {
    const { source, requests } = fakeCardSource();
    const session = createLampSession({ cardSource: source });
    rubUntilWish(session);
    wait(session, LAMP_TUNING.cardWaitSeconds + 0.1);
    requests[0].resolve({ kind: 'cards', cards: fiveCards() });
    await flush();
    expect(session.state.cards).toMatchObject({ kind: 'face-down', reason: 'not-ready' });

    session.cardsSettled();
    session.pointerUp();
    pressOnLamp(session);
    rub(session, 20);
    expect(requests).toHaveLength(1);
    expect(session.state.wishId).toBe(2);
    expect(session.state.cards).toEqual({ kind: 'cards', cards: fiveCards() });
  });
});
