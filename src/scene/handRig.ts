import * as THREE from 'three';

/*
 * The WebXR generic hand stores its 25 joints flat under the armature, each
 * posed independently. To curl a finger we chain each finger's joints under
 * the wrist so rotating one knuckle carries the rest of the finger with it.
 *
 * Joint space follows WebXR hand conventions: -Z points along the bone toward
 * the fingertip, +Y out of the back of the hand, so flexing a knuckle is a
 * negative rotation about the joint's X axis.
 */

const FINGERS = ['index-finger', 'middle-finger', 'ring-finger', 'pinky-finger'];
const FINGER_JOINTS = ['metacarpal', 'phalanx-proximal', 'phalanx-intermediate', 'phalanx-distal', 'tip'];
const THUMB_JOINTS = ['metacarpal', 'phalanx-proximal', 'phalanx-distal', 'tip'];

/** Flexion (radians) of each joint at full curl. A slight grip, not a fist. */
const FINGER_CURL: Record<string, number> = {
  'phalanx-proximal': 0.45,
  'phalanx-intermediate': 0.55,
  'phalanx-distal': 0.35,
};
const THUMB_CURL: Record<string, number> = {
  'phalanx-proximal': 0.15,
  'phalanx-distal': 0.25,
};

export interface HandRig {
  /** Curl every finger: 0 = relaxed rest pose, 1 = full grip. */
  setCurl(amount: number): void;
}

const X_AXIS = new THREE.Vector3(1, 0, 0);
const bend = new THREE.Quaternion();

/** Chain the hand model's joints and return a handle that curls its fingers. */
export function rigHand(model: THREE.Object3D): HandRig {
  model.updateMatrixWorld(true);
  const wrist = model.getObjectByName('wrist');
  if (!wrist) throw new Error('hand model has no wrist joint');

  const curled: { joint: THREE.Object3D; rest: THREE.Quaternion; angle: number }[] = [];
  const chain = (finger: string, joints: string[], curl: Record<string, number>) => {
    let parent = wrist;
    for (const name of joints) {
      const joint = model.getObjectByName(`${finger}-${name}`);
      if (!joint) throw new Error(`hand model has no ${finger}-${name} joint`);
      parent.attach(joint); // keeps the joint's world pose, so the skin is unchanged
      if (curl[name]) curled.push({ joint, rest: joint.quaternion.clone(), angle: curl[name] });
      parent = joint;
    }
  };
  for (const finger of FINGERS) chain(finger, FINGER_JOINTS, FINGER_CURL);
  chain('thumb', THUMB_JOINTS, THUMB_CURL);

  return {
    setCurl(amount) {
      for (const { joint, rest, angle } of curled) {
        joint.quaternion.copy(rest).multiply(bend.setFromAxisAngle(X_AXIS, -angle * amount));
      }
    },
  };
}
