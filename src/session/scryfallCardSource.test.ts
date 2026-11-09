import { afterEach, describe, expect, it, vi } from 'vitest';
import { createScryfallCardSource, createScryfallRequestQueue, SCRYFALL_CARD_BACK_URL } from './scryfallCardSource';
import normal from './fixtures/scryfall/card-normal.json';
import transform from './fixtures/scryfall/card-transform.json';
import modalDfc from './fixtures/scryfall/card-modal_dfc.json';
import split from './fixtures/scryfall/card-split.json';
import adventure from './fixtures/scryfall/card-adventure.json';
import noMatch from './fixtures/scryfall/error-404-random-no-match.json';
import badQuery from './fixtures/scryfall/error-400-bad-query.json';

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

/** A request queue without pauses, so tests that aren't about pacing run instantly. */
const unpaced = () => createScryfallRequestQueue({ gapMs: 0, spacingMs: 0 });

const source = (fetch: typeof globalThis.fetch) => createScryfallCardSource({ fetch, queue: unpaced() });

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
    const draw = await createScryfallCardSource({ fetch, queue: unpaced(), cardBackUrl: '/back.jpg' }).drawCards(1);
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

  it('reports magic unavailable if any one of the Cards fails, retry included', async () => {
    let calls = 0;
    const fetch = async () =>
      [3, 4].includes(++calls)
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
    const timed = createScryfallCardSource({ fetch, queue: unpaced(), timeoutMs: 20 });
    await expect(timed.drawCards(1)).resolves.toEqual(unavailable);
  });
});

describe('Scryfall card source pacing', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  /** A fake `fetch` whose responses the test hands out by hand; records when each request starts and ends. */
  function manualFetch() {
    const pending: { respond: (status?: number) => void }[] = [];
    let inFlight = 0;
    let maxInFlight = 0;
    const fetch = (_: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((resolve, reject) => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        init?.signal?.addEventListener('abort', () => {
          inFlight--;
          reject(new DOMException('Timed out', 'TimeoutError'));
        });
        pending.push({
          respond: (status = 200) => {
            inFlight--;
            resolve(new Response(JSON.stringify(normal), { status }));
          },
        });
      });
    return {
      fetch,
      requests: () => pending.length,
      respond: (index: number, status?: number) => pending[index].respond(status),
      maxInFlight: () => maxInFlight,
    };
  }

  it('requests one Card at a time, each a short gap after the previous one answered', async () => {
    vi.useFakeTimers();
    const scryfall = manualFetch();
    const queue = createScryfallRequestQueue({ gapMs: 100, spacingMs: 0 });
    const draw = createScryfallCardSource({ fetch: scryfall.fetch, queue }).drawCards(2);

    await vi.advanceTimersByTimeAsync(3000);
    expect(scryfall.requests()).toBe(1); // a slow answer holds the next request back

    scryfall.respond(0);
    await vi.advanceTimersByTimeAsync(99);
    expect(scryfall.requests()).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(scryfall.requests()).toBe(2);

    scryfall.respond(1);
    await expect(draw).resolves.toMatchObject({ kind: 'cards' });
  });

  it('keeps requests at least the rate-limit spacing apart, across Wishes too', async () => {
    vi.useFakeTimers();
    const starts: number[] = [];
    const fetch = async () => {
      starts.push(Date.now());
      return new Response(JSON.stringify(normal), { status: 200 });
    };
    const scryfall = createScryfallCardSource({ fetch, queue: createScryfallRequestQueue({ gapMs: 100, spacingMs: 500 }) });
    const first = scryfall.drawCards(3);
    const second = scryfall.drawCards(1);
    await vi.advanceTimersByTimeAsync(5000);
    await Promise.all([first, second]);
    const gaps = starts.slice(1).map((t, i) => t - starts[i]);
    expect(gaps).toEqual([500, 500, 500]);
  });

  it('never overlaps requests from two card sources sharing the default queue', async () => {
    vi.useFakeTimers();
    const scryfall = manualFetch();
    const one = createScryfallCardSource({ fetch: scryfall.fetch }).drawCards(2);
    const two = createScryfallCardSource({ fetch: scryfall.fetch }).drawCards(2);
    for (let i = 0; i < 4; i++) {
      await vi.advanceTimersByTimeAsync(1000);
      expect(scryfall.requests()).toBe(i + 1);
      scryfall.respond(i);
    }
    await vi.advanceTimersByTimeAsync(1000);
    await expect(one).resolves.toMatchObject({ kind: 'cards' });
    await expect(two).resolves.toMatchObject({ kind: 'cards' });
    expect(scryfall.maxInFlight()).toBe(1);
  });

  it('retries a failed request once', async () => {
    vi.useFakeTimers();
    let calls = 0;
    const fetch = async () => {
      if (++calls === 2) throw new TypeError('Failed to fetch');
      return new Response(JSON.stringify(normal), { status: 200 });
    };
    const draw = createScryfallCardSource({ fetch, queue: unpaced() }).drawCards(3);
    await vi.advanceTimersByTimeAsync(0);
    await expect(draw).resolves.toMatchObject({ kind: 'cards' });
    expect(calls).toBe(4);
  });

  it('retries a timed-out request once', async () => {
    vi.useFakeTimers();
    const scryfall = manualFetch();
    const draw = createScryfallCardSource({ fetch: scryfall.fetch, queue: unpaced(), timeoutMs: 5000 }).drawCards(1);
    await vi.advanceTimersByTimeAsync(5000); // the first attempt times out
    expect(scryfall.requests()).toBe(2);
    scryfall.respond(1);
    await expect(draw).resolves.toMatchObject({ kind: 'cards' });
  });

  it.each([429, 500, 503])('retries a %i response once', async (status) => {
    let calls = 0;
    const fetch = async () =>
      ++calls === 1 ? new Response('{}', { status }) : new Response(JSON.stringify(normal), { status: 200 });
    const draw = await createScryfallCardSource({ fetch, queue: unpaced() }).drawCards(1);
    expect(draw).toMatchObject({ kind: 'cards' });
    expect(calls).toBe(2);
  });

  it.each([
    [400, badQuery],
    [404, noMatch],
  ])('does not retry a %i response: asking again would get the same answer', async (status, body) => {
    let calls = 0;
    const fetch = async () => {
      calls++;
      return new Response(JSON.stringify(body), { status });
    };
    const draw = await createScryfallCardSource({ fetch, queue: unpaced() }).drawCards(5);
    expect(draw).toEqual({ kind: 'magic-unavailable' });
    expect(calls).toBe(1);
  });

  it('gives up with magic unavailable when the retry fails too, without requesting the rest', async () => {
    vi.useFakeTimers();
    let calls = 0;
    const fetch = async () => {
      calls++;
      throw new TypeError('Failed to fetch');
    };
    const draw = createScryfallCardSource({ fetch, queue: unpaced() }).drawCards(5);
    await vi.advanceTimersByTimeAsync(0);
    await expect(draw).resolves.toEqual({ kind: 'magic-unavailable' });
    expect(calls).toBe(2);
  });
});
