import { useEffect, type RefObject } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { LampPointer, LampSession } from '../session/lampSession';

/**
 * Feeds the browser's pointer events into the Lamp session, raycasting each one
 * against the Lamp so the session knows whether the pointer is over it.
 */
export function useLampRubInput(lamp: RefObject<THREE.Object3D | null>, session: LampSession) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    const canvas = gl.domElement;
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();

    const toLampPointer = (e: PointerEvent): LampPointer => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      ndc.set((x / rect.width) * 2 - 1, -(y / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const overLamp = !!lamp.current && raycaster.intersectObject(lamp.current, true).length > 0;
      return { x, y, overLamp };
    };

    const onDown = (e: PointerEvent) => {
      if (e.button === 0) session.pointerDown(toLampPointer(e));
    };
    const onMove = (e: PointerEvent) => session.pointerMove(toLampPointer(e));
    const onUp = () => session.pointerUp();

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
  }, [gl, camera, lamp, session]);
}
