import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { rigHand } from './handRig';
import handDataUrl from '../assets/hand/right.glb?inline';

/** Load the bundled hand model, exactly as shipped. */
async function loadHand(): Promise<THREE.Object3D> {
  const data = await (await fetch(handDataUrl)).arrayBuffer();
  const gltf = await new GLTFLoader().parseAsync(data, '');
  return gltf.scene;
}

const TIPS = ['index-finger-tip', 'middle-finger-tip', 'ring-finger-tip', 'pinky-finger-tip', 'thumb-tip'];

function tipPositions(model: THREE.Object3D): THREE.Vector3[] {
  model.updateMatrixWorld(true);
  return TIPS.map((name) => model.getObjectByName(name)!.getWorldPosition(new THREE.Vector3()));
}

// In the model file the palm faces -X and the fingers point -Y.
describe('Hand finger curl', () => {
  it('leaves the model in its rest pose until it curls', async () => {
    const model = await loadHand();
    const before = tipPositions(model);
    rigHand(model);
    tipPositions(model).forEach((p, i) => expect(p.distanceTo(before[i])).toBeLessThan(1e-6));
  });

  it('bends every fingertip toward the palm side when curled', async () => {
    const model = await loadHand();
    const rest = tipPositions(model);
    rigHand(model).setCurl(1);
    tipPositions(model).forEach((p, i) => {
      expect(p.x, TIPS[i]).toBeLessThan(rest[i].x - 0.002);
    });
  });

  it('relaxes back to the rest pose when released', async () => {
    const model = await loadHand();
    const rest = tipPositions(model);
    const rig = rigHand(model);
    rig.setCurl(1);
    rig.setCurl(0);
    tipPositions(model).forEach((p, i) => expect(p.distanceTo(rest[i])).toBeLessThan(1e-6));
  });
});
