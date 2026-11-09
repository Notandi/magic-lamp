import { useEffect, useState, type CSSProperties } from 'react';
import type { LampSession } from '../session/lampSession';

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

const magicUnavailable = (session: LampSession) => {
  const { cards } = session.state;
  return cards?.kind === 'face-down' && cards.reason === 'magic-unavailable';
};

/** A short note shown while the current Wish's Cards are face-down because Scryfall couldn't be reached. */
export function MagicUnavailableNote({ session }: { session: LampSession }) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    let frame = requestAnimationFrame(function watch() {
      setShown(magicUnavailable(session));
      frame = requestAnimationFrame(watch);
    });
    return () => cancelAnimationFrame(frame);
  }, [session]);

  if (!shown) return null;
  return (
    <div role="status" style={style}>
      The magic is unavailable right now.
    </div>
  );
}
