import { Suspense, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import type { LampSession } from '../session/lampSession';
import { Cards } from './Cards';
import { Smoke, type SmokeDissolve, type SmokeMode } from './Smoke';

/**
 * The Smoke and the Wish it grants: the Smoke swirls into a spinning column while the
 * Lamp session is `wishing`, the Cards rise out of it, and cleared Cards dissolve back into Smoke.
 */
export function Wish({
  session,
  origin,
  smokeBudget,
}: {
  session: LampSession;
  /** World position of the spout tip. */
  origin: THREE.Vector3Tuple;
  /** Most Smoke puffs alive at once. */
  smokeBudget?: number;
}) {
  const [mode, setMode] = useState<SmokeMode>('rise');
  const modeRef = useRef(mode);
  const dissolve = useMemo<SmokeDissolve>(() => ({ bursts: [] }), []);

  useFrame(() => {
    const next: SmokeMode = session.isWishing() ? 'swirl-column' : 'rise';
    if (next !== modeRef.current) {
      modeRef.current = next;
      setMode(next);
    }
  });

  return (
    <>
      <Smoke session={session} origin={origin} budget={smokeBudget} mode={mode} dissolve={dissolve} />
      <Suspense fallback={null}>
        <Cards session={session} origin={origin} dissolve={dissolve} />
      </Suspense>
    </>
  );
}
