/**
 * The Lamp session: the game rules as a plain state machine.
 *
 * No React, three.js or DOM here. The scene feeds it pointer events and `tick(dt)`,
 * and reads back a read-only `state` snapshot to draw from.
 */

import { faceDownCardSource, type Card, type CardDraw, type CardSource } from './cardSource';

/** Tuning constants, kept together so they're easy to change after playtesting. */
export const LAMP_TUNING = {
  /** Seconds of steady back-and-forth Rubbing that take Charge from 0 to 1. */
  fillSeconds: 6,
  /** Rub strokes per second that count as "steady" Rubbing. */
  steadyStrokesPerSecond: 3,
  /** Minimum distance (CSS pixels) a drag must travel before reversing for it to count as a Rub stroke. */
  minStrokeDistance: 40,
  /** Distance (CSS pixels) the pointer must travel back before a reversal is recognised; filters jitter. */
  reversalDistance: 8,
  /** Rub stroke speed (CSS pixels/second) at or below which no speed bonus applies. */
  steadyStrokeSpeed: 300,
  /** Largest extra Charge a fast Rub stroke earns, as a fraction of a normal stroke's Charge. */
  maxSpeedBonus: 0.25,
  /** Stroke speed, as a multiple of the steady speed, at which the full speed bonus is reached. */
  fullBonusSpeedMultiple: 2,
  /** Seconds without a Rub stroke before Charge starts draining. */
  drainDelaySeconds: 1.5,
  /** Charge lost per second while draining. */
  drainPerSecond: 0.15,
  /** Cards released by each Wish. */
  cardsPerWish: 5,
  /**
   * Seconds a Wish waits for its Cards if the card source hasn't answered when Charge fills.
   *
   * The rule: the next Wish's Cards are requested when a Rub starts, so they usually arrive
   * during the ~6 s of Rubbing (Scryfall needs ~3–6 s for 5 Cards). The Wish itself always
   * starts the moment Charge fills; while its Cards are missing, `state.cards` is null and the
   * Smoke column keeps spinning. If they arrive within this wait they rise as usual; otherwise
   * the Cards rise face-down (`reason: 'not-ready'`), and the late Cards are kept for the next Wish.
   */
  cardWaitSeconds: 2,
} as const;

export type LampTuning = { [K in keyof typeof LAMP_TUNING]: number };

export type LampPhase = 'idle' | 'rubbing' | 'wishing' | 'showing';

/**
 * The Cards a Wish released: real Cards, or face-down Cards showing the card back on both sides.
 * `reason` says why they're face-down: the card source reported "magic unavailable", or its
 * Cards weren't ready in time (see `LAMP_TUNING.cardWaitSeconds`).
 */
export type WishCards =
  | { readonly kind: 'cards'; readonly cards: readonly Card[] }
  | { readonly kind: 'face-down'; readonly count: number; readonly reason: 'magic-unavailable' | 'not-ready' };

/** Read-only snapshot of the Lamp session. */
export interface LampState {
  readonly phase: LampPhase;
  /** How much magic the Lamp has built up, 0..1. */
  readonly charge: number;
  /** True while the button is held and the pointer is over the Lamp. */
  readonly isRubbing: boolean;
  /** Increments once per Wish, so the scene can play the Wish animation exactly once. */
  readonly wishId: number;
  /** The current Wish's Cards, or null when no Cards are out. */
  readonly cards: WishCards | null;
}

/** A pointer event in screen space (CSS pixels), with whether the pointer is over any part of the Lamp. */
export interface LampPointer {
  readonly x: number;
  readonly y: number;
  readonly overLamp: boolean;
}

export interface LampSession {
  pointerDown(pointer: LampPointer): void;
  pointerMove(pointer: LampPointer): void;
  pointerUp(): void;
  /** The scene reports that the Wish animation has finished and the Cards have settled. */
  cardsSettled(): void;
  /** Advances time by `dt` seconds. */
  tick(dt: number): void;
  readonly state: LampState;
}

interface Point {
  x: number;
  y: number;
}

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export interface LampSessionOptions {
  /** Where Wishes get their Cards. Defaults to a source whose Cards are always face-down. */
  cardSource?: CardSource;
  tuning?: Partial<LampTuning>;
}

export function createLampSession({
  cardSource = faceDownCardSource,
  tuning = {},
}: LampSessionOptions = {}): LampSession {
  const t: LampTuning = { ...LAMP_TUNING, ...tuning };
  const chargePerStroke = 1 / (t.fillSeconds * t.steadyStrokesPerSecond);

  let now = 0;
  let charge = 0;
  let buttonDown = false;
  let isRubbing = false;
  let lastStrokeAt = -Infinity;
  let wishId = 0;
  let wishing = false;
  let cards: WishCards | null = null;
  let wishStartedAt = 0;

  // The next Wish's Cards: requested when a Rub starts, kept until a Wish takes them.
  let nextDraw: CardDraw | 'requested' | null = null;

  function requestNextCards() {
    if (nextDraw !== null) return;
    nextDraw = 'requested';
    cardSource
      .drawCards(t.cardsPerWish)
      .catch((): CardDraw => ({ kind: 'magic-unavailable' }))
      .then((draw) => {
        nextDraw = draw;
        attachPreparedCards();
      });
  }

  // The Rub stroke in progress: where it began, and the farthest point reached from there.
  let strokeStart: Point = { x: 0, y: 0 };
  let strokeStartedAt = 0;
  let extreme: Point = strokeStart;

  function beginStroke(from: Point, current: Point = from) {
    strokeStart = { x: from.x, y: from.y };
    strokeStartedAt = now;
    extreme = { x: current.x, y: current.y };
  }

  function addStrokeCharge(length: number, seconds: number) {
    const speed = length / Math.max(seconds, 1e-3);
    const over = (speed - t.steadyStrokeSpeed) / (t.steadyStrokeSpeed * (t.fullBonusSpeedMultiple - 1));
    const bonus = clamp01(over) * t.maxSpeedBonus;
    cards = null; // the first Rub stroke after a Wish dissolves its Cards
    charge = clamp01(charge + chargePerStroke * (1 + bonus));
    lastStrokeAt = now;
    if (charge >= 1) startWish();
  }

  function startWish() {
    wishing = true;
    wishId++;
    wishStartedAt = now;
    charge = 0;
    isRubbing = false;
    cards = null;
    attachPreparedCards();
  }

  /** While a Wish is waiting for Cards, hands it the prepared Cards as soon as there are some. */
  function attachPreparedCards() {
    if (!wishing || cards || nextDraw === null || nextDraw === 'requested') return;
    cards =
      nextDraw.kind === 'cards'
        ? { kind: 'cards', cards: nextDraw.cards }
        : { kind: 'face-down', count: t.cardsPerWish, reason: 'magic-unavailable' };
    nextDraw = null;
  }

  function followRub(at: Point) {
    const reach = distance(extreme, strokeStart);
    if (distance(at, strokeStart) >= reach) {
      extreme = { x: at.x, y: at.y };
      return;
    }
    if (distance(at, extreme) < t.reversalDistance) return;
    // The drag has reversed: the leg from strokeStart to extreme is over.
    if (reach >= t.minStrokeDistance) addStrokeCharge(reach, now - strokeStartedAt);
    beginStroke(extreme, at);
  }

  function updateRubbing(pointer: LampPointer) {
    const rubbing = buttonDown && pointer.overLamp && !wishing;
    if (rubbing && !isRubbing) {
      beginStroke(pointer);
      requestNextCards();
    }
    isRubbing = rubbing;
    if (rubbing) followRub(pointer);
  }

  return {
    pointerDown(pointer) {
      buttonDown = true;
      updateRubbing(pointer);
    },
    pointerMove(pointer) {
      updateRubbing(pointer);
    },
    cardsSettled() {
      if (wishing && cards) wishing = false;
    },
    pointerUp() {
      buttonDown = false;
      isRubbing = false;
    },
    tick(dt) {
      now += dt;
      if (now - lastStrokeAt >= t.drainDelaySeconds) charge = clamp01(charge - t.drainPerSecond * dt);
      if (wishing && !cards && now - wishStartedAt >= t.cardWaitSeconds) {
        // Not ready in time: rise face-down. A draw still on its way is kept for the next Wish.
        cards = { kind: 'face-down', count: t.cardsPerWish, reason: 'not-ready' };
      }
    },
    get state(): LampState {
      return {
        phase: wishing ? 'wishing' : cards ? 'showing' : isRubbing || charge > 0 ? 'rubbing' : 'idle',
        charge,
        isRubbing,
        wishId,
        cards,
      };
    },
  };
}
