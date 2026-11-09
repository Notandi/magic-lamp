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
 * art-series cards (the GLOSSARY's "not Cards"). Joke (Un-set) cards stay in.
 *
 * Why the last four terms too: Scryfall hides "extras" from searches by default, but naming any
 * `layout:` term in the query turns that default off, so excluding just the four above would let
 * the extras in. Those are deck-indicator "front cards" and the oversized Planechase planes,
 * Archenemy schemes and Vanguard cards: not normal game cards, and odd-shaped next to the rest
 * of a Wish. They are excluded explicitly to keep the random pool what it was before.
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
/** Scryfall asks for a 50–100 ms pause between requests; requests are sent one after another. */
const DEFAULT_REQUEST_GAP_MS = 100;
/** A lone random-card request normally takes 1–2 s; one taking longer than this counts as failed. */
const DEFAULT_TIMEOUT_MS = 6000;

/**
 * Sends requests to Scryfall one at a time: each starts only after the previous one has
 * answered and a short gap has passed, and at least the rate-limit spacing after the previous
 * one started. Overlapping requests only queue up on Scryfall's side and make each one slower.
 */
export interface ScryfallRequestQueue {
  run<T>(request: () => Promise<T>): Promise<T>;
}

export interface ScryfallRequestQueueOptions {
  /** Least time between one request answering and the next one starting. */
  gapMs?: number;
  /** Least time between the starts of two requests. */
  spacingMs?: number;
}

export function createScryfallRequestQueue({
  gapMs = DEFAULT_REQUEST_GAP_MS,
  spacingMs = DEFAULT_REQUEST_SPACING_MS,
}: ScryfallRequestQueueOptions = {}): ScryfallRequestQueue {
  let free: Promise<unknown> = Promise.resolve();
  return {
    run(request) {
      const turn = free.then(() => {
        const spaced = sleep(spacingMs);
        const result = request();
        return { result, done: Promise.all([spaced, result.catch(() => {}).then(() => sleep(gapMs))]) };
      });
      free = turn.then(({ done }) => done);
      return turn.then(({ result }) => result);
    },
  };
}

const sleep = (ms: number) =>
  ms > 0 ? new Promise<void>((resolve) => setTimeout(resolve, ms)) : Promise.resolve();

/** The queue every Scryfall card source uses unless given its own, so no two of them overlap requests. */
const sharedRequestQueue = createScryfallRequestQueue();

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
  /** Paces requests to Scryfall. Defaults to one queue shared by every Scryfall card source. */
  queue?: ScryfallRequestQueue;
  /** How long a single request may take before it counts as failed. */
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

/** Busy (429) or server trouble (5xx): the same request may well work a moment later. */
const isTransientStatus = (status: number) => status === 429 || status >= 500;

/** A failure that asking again won't fix (a 4xx other than 429, or an unreadable card), so it isn't retried. */
class FinalAnswer extends Error {
  constructor(cause: unknown) {
    super('Scryfall gave an answer a retry would not change', { cause });
  }
}

/**
 * Draws Cards from Scryfall, one random-card request per Card, sent one at a time through the
 * request queue. A request that hits a network error, times out, or answers 429 or 5xx is
 * retried once; any other failure (e.g. a 400 for a bad query) is not. If a Card still can't
 * be drawn, the whole draw is "magic unavailable". Never rejects.
 */
export function createScryfallCardSource({
  fetch = globalThis.fetch.bind(globalThis),
  cardBackUrl = SCRYFALL_CARD_BACK_URL,
  queue = sharedRequestQueue,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: ScryfallCardSourceOptions = {}): CardSource {
  const url = `${RANDOM_CARD_URL}?${new URLSearchParams({ q: RANDOM_CARD_QUERY })}`;

  async function requestCard(): Promise<Card> {
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(new DOMException('Scryfall took too long', 'TimeoutError')), timeoutMs);
    try {
      // A network error or timeout rejects here, and is worth one retry.
      const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: timeout.signal });
      if (response.status !== 200) {
        const error = new Error(`Scryfall answered ${response.status}`);
        throw isTransientStatus(response.status) ? error : new FinalAnswer(error);
      }
      try {
        return toCard((await response.json()) as ScryfallCard, cardBackUrl);
      } catch (error) {
        throw new FinalAnswer(error);
      }
    } finally {
      clearTimeout(timer);
    }
  }

  const drawCard = () =>
    queue.run(requestCard).catch((error: unknown) => {
      if (error instanceof FinalAnswer) throw error;
      return queue.run(requestCard);
    });

  return {
    async drawCards(count): Promise<CardDraw> {
      try {
        const cards: Card[] = [];
        // One at a time: a Card that can't be drawn ends the draw without spending the rate limit on the rest.
        for (let i = 0; i < count; i++) cards.push(await drawCard());
        return { kind: 'cards', cards };
      } catch {
        return { kind: 'magic-unavailable' };
      }
    },
  };
}
