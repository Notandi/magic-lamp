import { describe, expect, it } from 'vitest';
import { faceDownNote } from './MagicUnavailableNote';

describe('the note over face-down Cards', () => {
  it('says the magic is unavailable when the card source could not reach Scryfall', () => {
    expect(faceDownNote({ kind: 'face-down', count: 5, reason: 'magic-unavailable' })).toBe(
      'The magic is unavailable right now.',
    );
  });

  it('says the magic is still gathering when the Cards were not ready in time', () => {
    expect(faceDownNote({ kind: 'face-down', count: 5, reason: 'not-ready' })).toBe('The magic is still gathering…');
  });

  it('shows nothing for real Cards or when no Cards are out', () => {
    expect(faceDownNote({ kind: 'cards', cards: [] })).toBeNull();
    expect(faceDownNote(null)).toBeNull();
  });
});
