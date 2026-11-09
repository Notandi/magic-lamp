import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import handUrl from '../assets/hand/right.glb?url';
import { handTarget } from './handPose';
import { rigHand } from './handRig';
import { LAMP_OBJECT_NAME } from './Lamp';
import { canvasPointer, pressesWithHand, steersHand } from './pointerInput';

/** Hand model metres → scene units. The Hand ends up a little over half the Lamp's width. */
const HAND_SCALE = 7;
/** Centre of the palm skin in the model file (metres). */
const PALM_CENTRE = new THREE.Vector3(0.016, 0.01, 0.008);
/**
 * Maps the model file (palm -X, fingers -Y, thumb -Z) onto the Hand frame
 * used by handPose (palm -Y, fingers -Z, thumb -X).
 */
const MODEL_TO_HAND = new THREE.Quaternion().setFromRotationMatrix(
  new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0)),
);
const MODEL_OFFSET = PALM_CENTRE.clone().applyQuaternion(MODEL_TO_HAND).multiplyScalar(-HAND_SCALE);

/** How quickly the Hand catches up with its target (per second). High, so there's no visible lag. */
const FOLLOW_RATE = 30;
/** How quickly the fingers curl and relax (per second). */
const CURL_RATE = 12;

const normalMatrix = new THREE.Matrix3();

/** The player's 3D right Hand, standing in for the system cursor. */
export function Hand() {
  const gltf = useGLTF(handUrl);
  const { model, rig } = useMemo(() => {
    const model = cloneSkinned(gltf.scene);
    const skin = new THREE.MeshPhysicalMaterial({
      color: 0xd8967a,
      roughness: 0.55,
      sheen: 0.6,
      sheenColor: new THREE.Color(0xff9a7a),
      sheenRoughness: 0.5,
    });
    model.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.material = skin;
        o.castShadow = true;
        o.receiveShadow = true;
        o.frustumCulled = false;
        o.raycast = () => {}; // the Hand never blocks pointer picks on the Lamp or Cards
      }
    });
    return { model, rig: rigHand(model) };
  }, [gltf.scene]);

  const hand = useRef<THREE.Group>(null);
  const pressed = useRef(false);
  /** Where the Hand points, in normalised device coordinates. Starts at the centre of the view. */
  const aim = useRef(new THREE.Vector2());
  const curl = useRef(0);
  const placed = useRef(false);
  const lamp = useRef<THREE.Object3D | undefined>(undefined);
  const gl = useThree((s) => s.gl);

  // Hide the system cursor and track the pointer and button. The Hand reads raw pointer
  // events itself (like the Rub input) rather than R3F's pointer, so mouse, pen and touch
  // all steer it from the same client coordinates. On touch it follows the first finger.
  useEffect(() => {
    const canvas = gl.domElement;
    const previousCursor = canvas.style.cursor;
    canvas.style.cursor = 'none';
    const aimAt = (e: PointerEvent) => {
      const { ndcX, ndcY } = canvasPointer(e, canvas.getBoundingClientRect());
      aim.current.set(ndcX, ndcY);
    };
    const down = (e: PointerEvent) => {
      if (!pressesWithHand(e)) return;
      aimAt(e); // a tap has no move before it, so jump the Hand to the finger
      pressed.current = true;
    };
    const move = (e: PointerEvent) => {
      if (steersHand(e)) aimAt(e);
    };
    const up = (e: Event) => {
      if (e instanceof PointerEvent && !steersHand(e)) return;
      pressed.current = false;
    };
    canvas.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    window.addEventListener('blur', up);
    return () => {
      canvas.style.cursor = previousCursor;
      canvas.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      window.removeEventListener('blur', up);
    };
  }, [gl]);

  useFrame(({ camera, raycaster, scene }, dt) => {
    const group = hand.current;
    if (!group) return;
    if (!lamp.current?.parent) lamp.current = scene.getObjectByName(LAMP_OBJECT_NAME);

    raycaster.setFromCamera(aim.current, camera);
    const ray = raycaster.ray;
    let hit: { point: THREE.Vector3; normal: THREE.Vector3 } | null = null;
    const first = lamp.current ? raycaster.intersectObject(lamp.current, true)[0] : undefined;
    if (first?.face) {
      const normal = first.face.normal
        .clone()
        .applyMatrix3(normalMatrix.getNormalMatrix(first.object.matrixWorld))
        .normalize();
      if (normal.dot(ray.direction) > 0) normal.negate(); // always face the camera side
      hit = { point: first.point, normal };
    }

    const target = handTarget({ ray, pressed: pressed.current, hit });
    if (!placed.current) {
      group.position.copy(target.position);
      group.quaternion.copy(target.quaternion);
      placed.current = true;
    } else {
      const k = 1 - Math.exp(-FOLLOW_RATE * dt);
      group.position.lerp(target.position, k);
      group.quaternion.slerp(target.quaternion, k);
    }

    curl.current += ((pressed.current ? 1 : 0) - curl.current) * (1 - Math.exp(-CURL_RATE * dt));
    rig.setCurl(curl.current);
  });

  return (
    <group ref={hand}>
      <group position={MODEL_OFFSET} quaternion={MODEL_TO_HAND} scale={HAND_SCALE}>
        <primitive object={model} />
      </group>
    </group>
  );
}

useGLTF.preload(handUrl);
