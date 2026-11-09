import { describe, expect, it } from 'vitest';
import type { Card, CardDraw, CardSource } from './cardSource';
import { preloadingCardSource } from './preloadingCardSource';

const card = (name: string): Card => ({
  name,
  frontImageUrl: `https://example.test/${name}/front.jpg`,
  backImageUrl: `https://example.test/${name}/back.jpg`,
  scryfallUri: `https://example.test/${name}`,
});

const sourceOf = (draw: CardDraw): CardSource => ({ drawCards: () => Promise.resolve(draw) });

/** An image loader the test controls: each load waits until the test finishes it. */
function fakeImageLoader() {
  const loads = new Map<string, { resolve: () => void; reject: (e: Error) => void }>();
  const loadImage = (url: string) => new Promise<void>((resolve, reject) => loads.set(url, { resolve, reject }));
  return { loadImage, loads };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('preloading card source', () => {
  it('gives the Cards only once both faces of every Card have loaded', async () => {
    const cards = [card('A'), card('B')];
    const { loadImage, loads } = fakeImageLoader();
    let draw: CardDraw | undefined;
    void preloadingCardSource(sourceOf({ kind: 'cards', cards }), loadImage)
      .drawCards(2)
      .then((d) => (draw = d));
    await flush();

    expect([...loads.keys()].sort()).toEqual(
      cards.flatMap((c) => [c.frontImageUrl, c.backImageUrl]).sort(),
    );
    const [last, ...rest] = [...loads.values()];
    rest.forEach((l) => l.resolve());
    await flush();
    expect(draw).toBeUndefined();

    last.resolve();
    await flush();
    expect(draw).toEqual({ kind: 'cards', cards });
  });

  it('reports magic unavailable when a Card image fails to load', async () => {
    const loadImage = (url: string) => (url.includes('B/back') ? Promise.reject(new Error('404')) : Promise.resolve());
    const source = preloadingCardSource(sourceOf({ kind: 'cards', cards: [card('A'), card('B')] }), loadImage);
    await expect(source.drawCards(2)).resolves.toEqual({ kind: 'magic-unavailable' });
  });

  it('passes magic unavailable straight through', async () => {
    const source = preloadingCardSource(sourceOf({ kind: 'magic-unavailable' }), () => Promise.resolve());
    await expect(source.drawCards(5)).resolves.toEqual({ kind: 'magic-unavailable' });
  });
});
