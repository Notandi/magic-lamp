import { useEffect, type RefObject } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { LampPointer, LampSession } from '../session/lampSession';
import { CARDS_OBJECT_NAME } from './Cards';
import { canvasPointer, pressesWithHand, steersHand } from './pointerInput';

/**
 * Feeds the browser's pointer events into the Lamp session, raycasting each one
 * against the Lamp so the session knows whether the pointer is over it.
 * Touch works like a held mouse button: the first finger Rubs, other fingers are ignored.
 */
export function useLampRubInput(lamp: RefObject<THREE.Object3D | null>, session: LampSession) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);

  useEffect(() => {
    const canvas = gl.domElement;
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();

    /** Distance along the pointer ray to the first hit on `object`, or Infinity. */
    const hitDistance = (object: THREE.Object3D | null | undefined) =>
      (object && raycaster.intersectObject(object, true)[0]?.distance) ?? Infinity;

    const toLampPointer = (e: PointerEvent): LampPointer => {
      const { x, y, ndcX, ndcY } = canvasPointer(e, canvas.getBoundingClientRect());
      ndc.set(ndcX, ndcY);
      raycaster.setFromCamera(ndc, camera);
      return { x, y, overLamp: hitDistance(lamp.current) < Infinity };
    };

    const onDown = (e: PointerEvent) => {
      if (!pressesWithHand(e)) return;
      const pointer = toLampPointer(e);
      // A press on a Card in front of the Lamp is for the Card (flip or Inspect), not a Rub,
      // so dragging it across the Lamp doesn't dissolve the Cards.
      if (hitDistance(scene.getObjectByName(CARDS_OBJECT_NAME)) < hitDistance(lamp.current)) return;
      session.pointerDown(pointer);
    };
    const onMove = (e: PointerEvent) => {
      if (steersHand(e)) session.pointerMove(toLampPointer(e));
    };
    const onUp = (e: Event) => {
      if (e instanceof PointerEvent && !steersHand(e)) return; // a second finger lifting doesn't end the Rub
      session.pointerUp();
    };

    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('blur', onUp);
    return () => {
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('blur', onUp);
    };
  }, [gl, camera, scene, lamp, session]);
}
