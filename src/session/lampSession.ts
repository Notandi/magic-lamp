/**
 * The Lamp session: the game rules as a plain state machine.
 *
 * No React, three.js or DOM here. The scene feeds it pointer events and `tick(dt)`,
 * and reads back a read-only `state` snapshot to draw from.
 */

import { clamp01 } from '../math';
import { faceDownCardSource, type Card, type CardDraw, type CardSource } from './cardSource';

/** Tuning constants, kept together so they're easy to change after playtesting. */
export const LAMP_TUNING = {
  /** Seconds of steady back-and-forth Rubbing that take Charge from 0 to 1. */
  fillSeconds: 6,
  /** Rub strokes per second that count as "steady" Rubbing. */
  steadyRubStrokesPerSecond: 3,
  /** Minimum distance (CSS pixels) a drag must travel before reversing for it to count as a Rub stroke. */
  minRubStrokeDistance: 40,
  /** Distance (CSS pixels) the pointer must travel back before a reversal is recognised; filters jitter. */
  reversalDistance: 8,
  /** Rub stroke speed (CSS pixels/second) at or below which no speed bonus applies. */
  steadyRubStrokeSpeed: 300,
  /** Largest extra Charge a fast Rub stroke earns, as a fraction of a normal Rub stroke's Charge. */
  maxSpeedBonus: 0.25,
  /** Rub stroke speed, as a multiple of the steady speed, at which the full speed bonus is reached. */
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
   * The rule: the next Wish's Cards are requested as soon as the session is created and again
   * the moment a Wish takes its Cards, so they are normally ready long before Charge fills
   * (Scryfall can need ~10 s for 5 Cards and their images). The Wish itself always
   * starts the moment Charge fills; while its Cards are missing, `state.cards` is null and the
   * Smoke column keeps spinning. If they arrive within this wait they rise as usual; otherwise
   * the Cards rise face-down (`reason: 'not-ready'`), and the late Cards are kept for the next Wish.
   */
  cardWaitSeconds: 4,
} as const;

export type LampTuning = { [K in keyof typeof LAMP_TUNING]: number };

export type LampPhase = 'idle' | 'rubbing' | 'wishing' | 'showing' | 'inspecting';

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
  /** Index of the Card being Inspected, or null when no Card is Inspected. */
  readonly inspectedCard: number | null;
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
  /** The player clicked the Card at `index` in the current Wish. */
  cardClicked(index: number): void;
  /** The player clicked anywhere that isn't a Card. */
  backgroundClicked(): void;
  /** Advances time by `dt` seconds. */
  tick(dt: number): void;
  readonly state: LampState;
  /** Whether a Wish is under way: Charge has filled and its Cards haven't settled yet. */
  isWishing(): boolean;
  /** Whether settled Cards respond to the Hand hovering over them: they're on show and none is Inspected. */
  canHoverCards(): boolean;
  /** Whether the Card at `index` can be dragged to flip it: any settled Card on show, or the Inspected Card. */
  canFlipCard(index: number): boolean;
  /** Whether the Card at `index` is the one being Inspected. */
  isInspected(index: number): boolean;
}

interface Point {
  x: number;
  y: number;
}

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export interface LampSessionOptions {
  /** Where Wishes get their Cards. Defaults to a source whose Cards are always face-down. */
  cardSource?: CardSource;
  tuning?: Partial<LampTuning>;
}

export function createLampSession({
  cardSource = faceDownCardSource,
  tuning: overrides = {},
}: LampSessionOptions = {}): LampSession {
  const tuning: LampTuning = { ...LAMP_TUNING, ...overrides };
  const chargePerRubStroke = 1 / (tuning.fillSeconds * tuning.steadyRubStrokesPerSecond);

  let now = 0;
  let charge = 0;
  let buttonDown = false;
  let isRubbing = false;
  let lastRubStrokeAt = -Infinity;
  let wishId = 0;
  let wishing = false;
  let cards: WishCards | null = null;
  let wishStartedAt = 0;
  let inspectedCard: number | null = null;

  // The next Wish's Cards: requested up front, after each Wish takes its Cards, and at a Rub
  // start or Wish start when nothing is ready or on its way. Real Cards are kept until a Wish
  // takes them; a "magic unavailable" draw only counts for a Wish already waiting on it.
  // At most one request is in flight.
  let nextDraw: CardDraw | 'requested' | null = null;

  function requestNextCards() {
    if (nextDraw !== null) return;
    nextDraw = 'requested';
    cardSource
      .drawCards(tuning.cardsPerWish)
      .catch((): CardDraw => ({ kind: 'magic-unavailable' }))
      .then((draw) => {
        nextDraw = draw;
        if (wishing && !cards) attachPreparedCards();
        // A failure with no Wish waiting is dropped, not kept: the next Rub start asks again,
        // so a blip minutes ago doesn't turn a later Wish face-down.
        else if (draw.kind === 'magic-unavailable') nextDraw = null;
      });
  }

  // The Rub stroke in progress: where it began, and the farthest point reached from there.
  let rubStrokeStart: Point = { x: 0, y: 0 };
  let rubStrokeStartedAt = 0;
  let extreme: Point = rubStrokeStart;

  function beginRubStroke(from: Point, current: Point = from) {
    rubStrokeStart = { x: from.x, y: from.y };
    rubStrokeStartedAt = now;
    extreme = { x: current.x, y: current.y };
  }

  function addRubStrokeCharge(length: number, seconds: number) {
    const speed = length / Math.max(seconds, 1e-3);
    const over = (speed - tuning.steadyRubStrokeSpeed) / (tuning.steadyRubStrokeSpeed * (tuning.fullBonusSpeedMultiple - 1));
    const bonus = clamp01(over) * tuning.maxSpeedBonus;
    cards = null; // the first Rub stroke after a Wish dissolves its Cards
    charge = clamp01(charge + chargePerRubStroke * (1 + bonus));
    lastRubStrokeAt = now;
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
    requestNextCards(); // in case nothing was ready or on its way
  }

  /** While a Wish is waiting for Cards, hands it the prepared Cards as soon as there are some. */
  function attachPreparedCards() {
    if (!wishing || cards || nextDraw === null || nextDraw === 'requested') return;
    cards =
      nextDraw.kind === 'cards'
        ? { kind: 'cards', cards: nextDraw.cards }
        : { kind: 'face-down', count: tuning.cardsPerWish, reason: 'magic-unavailable' };
    nextDraw = null;
    requestNextCards();
  }

  function followRub(at: Point) {
    const reach = distance(extreme, rubStrokeStart);
    if (distance(at, rubStrokeStart) >= reach) {
      extreme = { x: at.x, y: at.y };
      return;
    }
    if (distance(at, extreme) < tuning.reversalDistance) return;
    // The drag has reversed: the leg from rubStrokeStart to extreme is over.
    if (reach >= tuning.minRubStrokeDistance) addRubStrokeCharge(reach, now - rubStrokeStartedAt);
    beginRubStroke(extreme, at);
  }

  function updateRubbing(pointer: LampPointer) {
    const rubbing = buttonDown && pointer.overLamp && !wishing && inspectedCard === null;
    if (rubbing && !isRubbing) {
      beginRubStroke(pointer);
      requestNextCards(); // in case nothing is ready or on its way
    }
    isRubbing = rubbing;
    if (rubbing) followRub(pointer);
  }

  requestNextCards();

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
    cardClicked(index) {
      // Any click while Inspecting sends the Card back; only one Card is Inspected at a time.
      if (inspectedCard !== null) inspectedCard = null;
      else if (!wishing && cards) {
        inspectedCard = index;
        isRubbing = false; // Rubbing is paused while a Card is Inspected
      }
    },
    backgroundClicked() {
      inspectedCard = null;
    },
    pointerUp() {
      buttonDown = false;
      isRubbing = false;
    },
    tick(dt) {
      now += dt;
      if (now - lastRubStrokeAt >= tuning.drainDelaySeconds) charge = clamp01(charge - tuning.drainPerSecond * dt);
      if (wishing && !cards && now - wishStartedAt >= tuning.cardWaitSeconds) {
        // Not ready in time: rise face-down. A draw still on its way is kept for the next Wish.
        cards = { kind: 'face-down', count: tuning.cardsPerWish, reason: 'not-ready' };
      }
    },
    get state(): LampState {
      return {
        phase: wishing ? 'wishing' : inspectedCard !== null ? 'inspecting' : cards ? 'showing' : isRubbing || charge > 0 ? 'rubbing' : 'idle',
        charge,
        isRubbing,
        wishId,
        cards,
        inspectedCard,
      };
    },
    isWishing: () => wishing,
    canHoverCards: () => !wishing && cards !== null && inspectedCard === null,
    canFlipCard: (index) => !wishing && cards !== null && (inspectedCard === null || inspectedCard === index),
    isInspected: (index) => inspectedCard === index,
  };
}
