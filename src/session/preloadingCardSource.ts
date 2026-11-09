import type { CardDraw, CardSource } from './cardSource';

/**
 * Wraps a card source so its Cards arrive with their images already loaded, and a Wish never
 * waits on a download. If any Card's front or back image fails to load, the draw is
 * "magic unavailable". `loadImage` resolves once the image at `url` is ready to draw.
 */
export function preloadingCardSource(source: CardSource, loadImage: (url: string) => Promise<unknown>): CardSource {
  return {
    async drawCards(count): Promise<CardDraw> {
      const draw = await source.drawCards(count);
      if (draw.kind !== 'cards') return draw;
      try {
        await Promise.all(draw.cards.flatMap((c) => [loadImage(c.frontImageUrl), loadImage(c.backImageUrl)]));
        return draw;
      } catch {
        return { kind: 'magic-unavailable' };
      }
    },
  };
}
