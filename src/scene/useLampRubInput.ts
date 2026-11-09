import { useEffect } from 'react';
import type { LampSession } from '../session/lampSession';
import { useHandInput } from './HandInputProvider';

/**
 * Feeds the Hand's presses, moves and releases into the Lamp session.
 * Touch works like a held mouse button: the first finger Rubs, other fingers are ignored.
 */
export function useLampRubInput(session: LampSession) {
  const input = useHandInput();

  useEffect(
    () =>
      input.listen({
        press(pointer) {
          // A press on a Card in front of the Lamp is for the Card (flip or Inspect), not a Rub,
          // so dragging it across the Lamp doesn't dissolve the Cards.
          if (!pointer.cardsInFront) session.pointerDown(pointer);
        },
        move: (pointer) => session.pointerMove(pointer),
        release: () => session.pointerUp(),
      }),
    [input, session],
  );
}
