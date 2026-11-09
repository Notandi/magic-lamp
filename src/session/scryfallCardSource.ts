/**
 * The Scryfall card source: each Card is a random real Magic: The Gathering card from
 * Scryfall's random-card endpoint (see docs/adr/0001-live-scryfall-cards.md).
 */

import type { Card, CardDraw, CardSource } from './cardSource';

/** The official Magic card back, as Scryfall serves it. */
export const SCRYFALL_CARD_BACK_URL = 'https://backs.scryfall.io/large/0/a/0aeebaf5-8c7d-4636-9e82-8c27447861f7.jpg';

const RANDOM_CARD_URL = 'https://api.scryfall.com/cards/random';

/**
 * Search query for a random Card: everything except tokens, double-faced tokens, emblems and
 * art-series cards. Joke (Un-set) cards stay in. Naming any `layout:` term also reveals the
 * "extras" Scryfall hides by default, so those are excluded explicitly: deck-indicator
 * "front cards" and the oversized planes, schemes and vanguards.
 */
export const RANDOM_CARD_QUERY = [
  'token',
  'double_faced_token',
  'emblem',
  'art_series',
  'front_card',
  'planar',
  'scheme',
  'vanguard',
]
  .map((layout) => `-layout:${layout}`)
  .join(' ');

/** Scryfall asks for at most 2 random-card requests per second. */
const DEFAULT_REQUEST_SPACING_MS = 500;
/** A random-card request normally takes 1–2 s; one taking longer than this counts as failed. */
const DEFAULT_TIMEOUT_MS = 8000;

/** The subset of a Scryfall card object the source reads. */
interface ScryfallCard {
  name: string;
  scryfall_uri: string;
  image_uris?: { large: string };
  card_faces?: { image_uris?: { large: string } }[];
}

export interface ScryfallCardSourceOptions {
  fetch?: typeof globalThis.fetch;
  /** Image used for the back of single-faced Cards. Defaults to Scryfall's copy of the official card back. */
  cardBackUrl?: string;
  /** Least time between the starts of two requests to Scryfall. */
  requestSpacingMs?: number;
  /** How long a single request may take before the Wish counts the magic as unavailable. */
  timeoutMs?: number;
}

function toCard(card: ScryfallCard, cardBackUrl: string): Card {
  const front = card.image_uris ?? card.card_faces?.[0]?.image_uris;
  // Double-faced layouts have no root image; their second face's image is the Card's back.
  const back = card.image_uris ? undefined : card.card_faces?.[1]?.image_uris;
  if (!front) throw new Error(`Scryfall card "${card.name}" has no image`);
  return {
    name: card.name,
    frontImageUrl: front.large,
    backImageUrl: back?.large ?? cardBackUrl,
    scryfallUri: card.scryfall_uri,
  };
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Draws Cards from Scryfall, one random-card request per Card. Requests overlap but their
 * starts are spaced out, across Wishes too. If any request fails, times out, or answers with
 * anything but 200, the whole draw is "magic unavailable". Never rejects.
 */
export function createScryfallCardSource({
  fetch = globalThis.fetch.bind(globalThis),
  cardBackUrl = SCRYFALL_CARD_BACK_URL,
  requestSpacingMs = DEFAULT_REQUEST_SPACING_MS,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: ScryfallCardSourceOptions = {}): CardSource {
  const url = `${RANDOM_CARD_URL}?${new URLSearchParams({ q: RANDOM_CARD_QUERY })}`;
  let nextSlotAt = 0;

  /** Waits for this request's turn under the rate limit. */
  function takeSlot(): Promise<void> {
    const now = performance.now();
    const at = Math.max(now, nextSlotAt);
    nextSlotAt = at + requestSpacingMs;
    return at > now ? sleep(at - now) : Promise.resolve();
  }

  async function drawCard(signal: AbortSignal): Promise<Card> {
    await takeSlot();
    signal.throwIfAborted();
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]),
    });
    if (response.status !== 200) throw new Error(`Scryfall answered ${response.status}`);
    return toCard((await response.json()) as ScryfallCard, cardBackUrl);
  }

  return {
    async drawCards(count): Promise<CardDraw> {
      const draw = new AbortController();
      try {
        const cards = await Promise.all(Array.from({ length: count }, () => drawCard(draw.signal)));
        return { kind: 'cards', cards };
      } catch {
        draw.abort(); // one Card failed: don't spend the rate limit on the rest
        return { kind: 'magic-unavailable' };
      }
    },
  };
}
