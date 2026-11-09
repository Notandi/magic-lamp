import { useEffect, useState, type CSSProperties } from 'react';
import type { LampSession, WishCards } from '../session/lampSession';

const style: CSSProperties = {
  position: 'fixed',
  left: '50%',
  top: 16,
  transform: 'translateX(-50%)',
  zIndex: 5,
  maxWidth: 'calc(100vw - 32px)',
  boxSizing: 'border-box',
  padding: '8px 16px',
  borderRadius: 8,
  border: '1px solid rgba(232, 201, 138, 0.3)',
  background: 'rgba(20, 12, 30, 0.7)',
  color: '#e8c98a',
  font: 'italic 15px/1.4 Georgia, serif',
  textAlign: 'center',
  // Never in the way of a Rub.
  pointerEvents: 'none',
};

/** What the note says over the current Wish's Cards, or null when there's nothing to say. */
export function faceDownNote(cards: WishCards | null): string | null {
  if (cards?.kind !== 'face-down') return null;
  return cards.reason === 'magic-unavailable' ? 'The magic is unavailable right now.' : 'The magic is still gathering…';
}

/**
 * A short note shown while the current Wish's Cards are face-down: Scryfall couldn't be reached,
 * or the Cards weren't ready in time.
 */
export function MagicUnavailableNote({ session }: { session: LampSession }) {
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let frame = requestAnimationFrame(function watch() {
      setNote(faceDownNote(session.state.cards));
      frame = requestAnimationFrame(watch);
    });
    return () => cancelAnimationFrame(frame);
  }, [session]);

  if (!note) return null;
  return (
    <div role="status" style={style}>
      {note}
    </div>
  );
}
