import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { CARDS_OBJECT_NAME } from './Cards';
import { createHandInput, type HandInput } from './handInput';
import { LAMP_OBJECT_NAME } from './Lamp';

const HandInputContext = createContext<HandInput | null>(null);

/**
 * Owns the scene's one Hand input (see handInput.ts): listens on the canvas and window, and
 * raycasts each pointer event once against the Lamp and the Cards. Wrap the Hand and the Lamp in it.
 */
export function HandInputProvider({ children }: { children: ReactNode }) {
  const gl = useThree((state) => state.gl);
  const camera = useThree((state) => state.camera);
  const scene = useThree((state) => state.scene);
  const [input, setInput] = useState<HandInput | null>(null);

  useEffect(() => {
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let lamp: THREE.Object3D | undefined;
    /** Distance along the pointer ray to the first hit on `object`, or Infinity. */
    const hitDistance = (object: THREE.Object3D | undefined) =>
      (object && raycaster.intersectObject(object, true)[0]?.distance) ?? Infinity;

    const handInput = createHandInput({
      canvas: gl.domElement,
      page: window,
      pick(ndcX, ndcY) {
        if (!lamp?.parent) lamp = scene.getObjectByName(LAMP_OBJECT_NAME);
        raycaster.setFromCamera(ndc.set(ndcX, ndcY), camera);
        return { lamp: hitDistance(lamp), cards: hitDistance(scene.getObjectByName(CARDS_OBJECT_NAME)) };
      },
    });
    setInput(handInput);
    return () => handInput.dispose();
  }, [gl, camera, scene]);

  return input && <HandInputContext.Provider value={input}>{children}</HandInputContext.Provider>;
}

/** The scene's Hand input. Only for components inside a HandInputProvider. */
export function useHandInput(): HandInput {
  const input = useContext(HandInputContext);
  if (!input) throw new Error('useHandInput needs a HandInputProvider');
  return input;
}
