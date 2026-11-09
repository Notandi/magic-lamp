import { describe, expect, it } from 'vitest';
import { createScryfallCardSource, SCRYFALL_CARD_BACK_URL } from './scryfallCardSource';
import normal from './fixtures/scryfall/card-normal.json';
import transform from './fixtures/scryfall/card-transform.json';
import modalDfc from './fixtures/scryfall/card-modal_dfc.json';
import split from './fixtures/scryfall/card-split.json';
import adventure from './fixtures/scryfall/card-adventure.json';
import noMatch from './fixtures/scryfall/error-404-random-no-match.json';

/** A fake `fetch` that answers every request with the next of `bodies`, as a 200 JSON response. */
function fakeFetch(...bodies: unknown[]) {
  const urls: string[] = [];
  let next = 0;
  const fetch = async (input: RequestInfo | URL) => {
    urls.push(String(input));
    const body = bodies[next++ % bodies.length];
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  return { fetch, urls };
}

const source = (fetch: typeof globalThis.fetch) => createScryfallCardSource({ fetch, requestSpacingMs: 0 });

describe('Scryfall card source', () => {
  it('maps a normal card to its face and the official card back', async () => {
    const { fetch } = fakeFetch(normal);
    const draw = await source(fetch).drawCards(1);
    expect(draw).toEqual({
      kind: 'cards',
      cards: [
        {
          name: 'Oilskelion',
          frontImageUrl: 'https://cards.scryfall.io/large/front/4/a/4a44bec7-23ec-464f-8e98-f90b06068cdf.jpg?1783917763',
          backImageUrl: 'https://backs.scryfall.io/large/0/a/0aeebaf5-8c7d-4636-9e82-8c27447861f7.jpg',
          scryfallUri: 'https://scryfall.com/card/unk/RA05b/oilskelion?utm_source=api',
        },
      ],
    });
    expect(SCRYFALL_CARD_BACK_URL).toBe('https://backs.scryfall.io/large/0/a/0aeebaf5-8c7d-4636-9e82-8c27447861f7.jpg');
  });

  it.each([
    ['transform', transform, 'd/4/d4d379b5-7f56-4a7d-a4ac-131fc3d579c6'],
    ['modal double-faced', modalDfc, '7/8/782ca27f-9f18-476c-b582-89c06fb2e322'],
  ])('shows the second face of a %s card on its back', async (_, fixture, path) => {
    const { fetch } = fakeFetch(fixture);
    const draw = await source(fetch).drawCards(1);
    expect(draw.kind === 'cards' && draw.cards[0]).toMatchObject({
      name: fixture.name,
      frontImageUrl: expect.stringContaining(`https://cards.scryfall.io/large/front/${path}.jpg`),
      backImageUrl: expect.stringContaining(`https://cards.scryfall.io/large/back/${path}.jpg`),
    });
  });

  it.each([
    ['split', split, 'd/9/d94fb4da-0d3f-4d84-966b-914b84b23289'],
    ['adventure', adventure, '3/2/32158458-42eb-41bc-a15a-11af28463eb0'],
  ])('shows a %s card as its single image with the official card back', async (_, fixture, path) => {
    const { fetch } = fakeFetch(fixture);
    const draw = await source(fetch).drawCards(1);
    expect(draw.kind === 'cards' && draw.cards[0]).toMatchObject({
      frontImageUrl: expect.stringContaining(`https://cards.scryfall.io/large/front/${path}.jpg`),
      backImageUrl: SCRYFALL_CARD_BACK_URL,
    });
  });

  it('can use a local copy of the card back', async () => {
    const { fetch } = fakeFetch(normal);
    const draw = await createScryfallCardSource({ fetch, requestSpacingMs: 0, cardBackUrl: '/back.jpg' }).drawCards(1);
    expect(draw.kind === 'cards' && draw.cards[0].backImageUrl).toBe('/back.jpg');
  });

  it('draws one random card per Card', async () => {
    const { fetch, urls } = fakeFetch(normal, split, transform);
    const draw = await source(fetch).drawCards(5);
    expect(urls).toHaveLength(5);
    expect(urls.every((u) => u.startsWith('https://api.scryfall.com/cards/random?'))).toBe(true);
    expect(draw.kind === 'cards' && draw.cards.map((c) => c.name)).toEqual([
      'Oilskelion',
      'Defiled Crypt // Cadaver Lab',
      'Primal Amulet // Primal Wellspring',
      'Oilskelion',
      'Defiled Crypt // Cadaver Lab',
    ]);
  });

  it('asks only for real game cards, keeping joke cards', async () => {
    const { fetch, urls } = fakeFetch(normal);
    await source(fetch).drawCards(1);
    const query = new URL(urls[0]).searchParams.get('q') ?? '';
    const terms = query.split(/\s+/);
    for (const layout of ['token', 'double_faced_token', 'emblem', 'art_series']) {
      expect(terms).toContain(`-layout:${layout}`);
    }
    expect(query).not.toMatch(/is:funny|not:funny|is:extra|set_type:funny/);
  });
});

describe('Scryfall card source when the magic is unavailable', () => {
  const unavailable = { kind: 'magic-unavailable' };

  it('reports a network error as magic unavailable', async () => {
    const fetch = async () => {
      throw new TypeError('Failed to fetch');
    };
    await expect(source(fetch).drawCards(5)).resolves.toEqual(unavailable);
  });

  it('reports a non-200 response as magic unavailable', async () => {
    const fetch = async () => new Response(JSON.stringify(noMatch), { status: 404 });
    await expect(source(fetch).drawCards(5)).resolves.toEqual(unavailable);
  });

  it('reports magic unavailable if any one of the Cards fails', async () => {
    let calls = 0;
    const fetch = async () =>
      ++calls === 3
        ? new Response('{}', { status: 429 })
        : new Response(JSON.stringify(normal), { status: 200 });
    await expect(source(fetch).drawCards(5)).resolves.toEqual(unavailable);
  });

  it('reports a malformed response as magic unavailable', async () => {
    const fetch = async () => new Response('<html>oops</html>', { status: 200 });
    await expect(source(fetch).drawCards(1)).resolves.toEqual(unavailable);
  });

  it('reports a request that times out as magic unavailable', async () => {
    const fetch = (_: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) =>
        init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))),
      );
    const timed = createScryfallCardSource({ fetch, requestSpacingMs: 0, timeoutMs: 20 });
    await expect(timed.drawCards(1)).resolves.toEqual(unavailable);
  });
});

describe('Scryfall card source rate limiting', () => {
  it('spaces its requests to respect the rate limit', async () => {
    const starts: number[] = [];
    const fetch = async () => {
      starts.push(performance.now());
      return new Response(JSON.stringify(normal), { status: 200 });
    };
    const spaced = createScryfallCardSource({ fetch, requestSpacingMs: 30 });
    await spaced.drawCards(3);
    await spaced.drawCards(1);
    const gaps = starts.slice(1).map((t, i) => t - starts[i]);
    expect(gaps).toHaveLength(3);
    for (const gap of gaps) expect(gap).toBeGreaterThanOrEqual(28);
  });
});
