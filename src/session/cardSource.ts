/**
 * The card source: where a Wish's Cards come from.
 *
 * "Give me N Cards" resolves to those Cards or to "magic unavailable". It never throws
 * or rejects; any failure is reported as `magic-unavailable` so the Wish still happens
 * with face-down Cards. The real one is `createScryfallCardSource`.
 */

/** A real Magic: The Gathering card, as the scene needs it. */
export interface Card {
  readonly name: string;
  /** Image of the Card's face. */
  readonly frontImageUrl: string;
  /** Image of the Card's back: the official card back, or the second face of a double-faced card. */
  readonly backImageUrl: string;
  /** Link to the Card on Scryfall. */
  readonly scryfallUri: string;
}

/** The outcome of asking a card source for Cards. */
export type CardDraw =
  | { readonly kind: 'cards'; readonly cards: readonly Card[] }
  | { readonly kind: 'magic-unavailable' };

export interface CardSource {
  /** Gives `count` Cards. Never rejects. */
  drawCards(count: number): Promise<CardDraw>;
}

/** A card source whose every Wish is face-down; the Lamp session's default. */
export const faceDownCardSource: CardSource = {
  drawCards: () => Promise.resolve({ kind: 'magic-unavailable' }),
};
