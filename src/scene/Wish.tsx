import { Suspense, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import type { LampSession } from '../session/lampSession';
import { Cards } from './Cards';
import { Genie } from './Genie';
import { GENIE_OFFER_POINT } from './genieGeometry';
import { newGenieStage } from './genieMotion';
import { Smoke, type SmokeDissolve, type SmokeMode } from './Smoke';

/**
 * The Smoke and the Wish it grants: while the Lamp session is `wishing` the Smoke swirls into a
 * spinning column and the Genie pours out of the spout, then offers the Cards. Cleared Cards
 * dissolve back into Smoke and the Genie is drawn back into the Lamp.
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
  const genie = useMemo(newGenieStage, []);
  /** Where the Genie holds the Cards before offering them. */
  const offerPoint = useMemo<THREE.Vector3Tuple>(
    () => [origin[0] + GENIE_OFFER_POINT[0], origin[1] + GENIE_OFFER_POINT[1], origin[2] + GENIE_OFFER_POINT[2]],
    [origin],
  );

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
      <Genie session={session} origin={origin} stage={genie} dissolve={dissolve} />
      <Suspense fallback={null}>
        <Cards session={session} origin={offerPoint} genie={genie} dissolve={dissolve} />
      </Suspense>
    </>
  );
}
