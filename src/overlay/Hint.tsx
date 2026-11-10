import { useEffect, useState, type CSSProperties } from 'react';
import type { LampSession, LampState } from '../session/lampSession';

const style: CSSProperties = {
  position: 'fixed',
  left: '50%',
  bottom: 28,
  transform: 'translateX(-50%)',
  zIndex: 5,
  maxWidth: 'calc(100vw - 96px)',
  color: '#e8c98a',
  font: 'italic 17px/1.4 Georgia, serif',
  letterSpacing: '0.02em',
  textAlign: 'center',
  textShadow: '0 1px 8px rgba(0, 0, 0, 0.9)',
  transition: 'opacity 0.8s ease',
  // Never in the way of a Rub.
  pointerEvents: 'none',
};

/**
 * What to tell a new player, or null once they've found their way: how to make the first Wish,
 * and, while the first Wish's Cards are on show, what can be done with them.
 */
export function hintFor(state: Pick<LampState, 'phase' | 'wishId' | 'charge'>): string | null {
  if (state.wishId === 0) return state.charge < 0.5 ? 'Rub the lamp' : 'Keep rubbing…';
  if (state.wishId === 1 && state.phase === 'showing') {
    return 'Pick a card to look closer · drag to flip it · rub the lamp to wish again';
  }
  return null;
}

/** A line of guidance at the foot of the page for a player's first Wish. It fades away afterwards. */
export function Hint({ session }: { session: LampSession }) {
  const [hint, setHint] = useState<string | null>(null);
  // The last hint stays in place while it fades out.
  const [text, setText] = useState('');

  useEffect(() => {
    let frame = requestAnimationFrame(function watch() {
      const next = hintFor(session.state);
      setHint(next);
      if (next) setText(next);
      frame = requestAnimationFrame(watch);
    });
    return () => cancelAnimationFrame(frame);
  }, [session]);

  return (
    <div role="status" style={{ ...style, opacity: hint ? 0.85 : 0 }}>
      {text}
    </div>
  );
}
