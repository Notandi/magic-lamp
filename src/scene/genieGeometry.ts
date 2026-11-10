import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { loft } from './lampGeometry';

/**
 * The Genie's shape, built in code. Everything is in the Genie's own space: the origin is the
 * spout tip its tail pours out of, +y is up and it faces +z. No React here.
 */

/** Where the Genie's torso floats, relative to the spout tip: left of it, above the Lamp, a little behind. */
export const GENIE_TORSO = { x: -1.6, z: -0.45 } as const;

/** Fraction of the body's spine that is tail; the rest is the torso. */
export const GENIE_TAIL_END = 0.55;

/**
 * The tail and torso are one surface. Each key is [x, y, half-depth, half-width]: a wisp at the
 * spout tip that curls up and over the Lamp, then swells into waist, chest and shoulders.
 */
const BODY_KEYS: [number, number, number, number][] = [
  [0.0, 0.0, 0.05, 0.05],
  [0.17, 0.3, 0.08, 0.08],
  [0.1, 0.62, 0.11, 0.11],
  [-0.32, 0.8, 0.13, 0.14],
  [-0.82, 0.62, 0.15, 0.17],
  [-1.3, 0.6, 0.19, 0.22],
  [-1.57, 0.9, 0.24, 0.3],
  [-1.6, 1.3, 0.27, 0.36],
  [-1.6, 1.68, 0.34, 0.52],
  [-1.6, 1.96, 0.33, 0.56],
  [-1.6, 2.14, 0.2, 0.3],
  [-1.6, 2.3, 0.13, 0.14],
];

/** Heights (above the spout tip) of the Genie's landmarks. */
export const GENIE_HEIGHTS = { waist: 1.02, chest: 1.7, shoulder: 1.98, neck: 2.26, head: 2.62 } as const;

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** A tube along `curve` whose radius at `t` (0..1) is `radius(t)`. */
function taperedTube(curve: THREE.Curve<THREE.Vector3>, radius: (t: number) => number, tubular = 40, radial = 16) {
  const geometry = new THREE.TubeGeometry(curve, tubular, 1, radial, false);
  const position = geometry.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i <= tubular; i++) {
    const t = i / tubular;
    const centre = curve.getPointAt(t);
    const r = radius(t);
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      v.fromBufferAttribute(position, k).sub(centre).multiplyScalar(r).add(centre);
      position.setXYZ(k, v.x, v.y, v.z);
    }
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** A sphere stretched to `size` and moved to `at`. */
function blob(size: THREE.Vector3Tuple, at: THREE.Vector3Tuple, detail = 24) {
  return new THREE.SphereGeometry(1, detail, Math.round(detail * 0.7)).scale(...size).translate(...at);
}

/** Drops everything but position and normal, so differently-built shapes can be merged. */
function plain(geometry: THREE.BufferGeometry) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
  return g;
}

const merge = (...parts: THREE.BufferGeometry[]) => mergeGeometries(parts.map(plain));

/** Marks how far along the body each vertex is (0 = spout tip, 1 = neck); rigid parts are all 1. */
function withAlong(geometry: THREE.BufferGeometry, along?: (i: number) => number) {
  const count = geometry.attributes.position.count;
  const values = new Float32Array(count);
  for (let i = 0; i < count; i++) values[i] = along ? along(i) : 1;
  geometry.setAttribute('aAlong', new THREE.BufferAttribute(values, 1));
  return geometry;
}

function buildBody() {
  const spine = new THREE.CatmullRomCurve3(BODY_KEYS.map(([x, y]) => v3(x, y, 0)));
  const radiiCurve = new THREE.CatmullRomCurve3(BODY_KEYS.map(([, , depth, width]) => v3(depth, width, 0)));
  const body = loft(
    spine,
    (t) => {
      const r = radiiCurve.getPoint(t);
      return [Math.max(r.x, 0.03), Math.max(r.y, 0.03)];
    },
    120,
    32,
  );
  // Sweep the torso back behind the Lamp's centreline, so the Cards have room in front of it.
  const position = body.attributes.position;
  const uv = body.attributes.uv;
  for (let i = 0; i < position.count; i++) {
    const k = THREE.MathUtils.smoothstep(uv.getX(i), 0.1, GENIE_TAIL_END);
    position.setZ(i, position.getZ(i) + GENIE_TORSO.z * k);
  }
  return withAlong(body, (i) => uv.getX(i));
}

/** One arm, from the shoulder (the origin) out to an open hand; `side` is +1 for the Genie's left (our right). */
function buildArm(side: 1 | -1) {
  const wrist = v3(side * 1.58, -0.2, 0.74);
  const curve = new THREE.CatmullRomCurve3([v3(0, 0, 0), v3(side * 0.42, -0.2, 0.05), v3(side * 0.88, -0.46, 0.2), v3(side * 1.3, -0.38, 0.5), wrist]);
  // Thick at the shoulder and upper arm, a pinch at the elbow, a strong forearm, a narrow wrist.
  const arm = taperedTube(curve, (t) => 0.2 - 0.05 * t + 0.04 * Math.sin(Math.PI * Math.min(1, t * 2.2)) - 0.05 * Math.pow(t, 3));

  // The open hand: palm up, fingers forward and a little outward.
  const palm = blob([0.15, 0.055, 0.17], [0, 0, 0.1]);
  const finger = new THREE.CapsuleGeometry(0.036, 0.15, 6, 10).rotateX(Math.PI / 2);
  const fingers = [-0.105, -0.035, 0.035, 0.105].map((x, i) =>
    finger
      .clone()
      .rotateX(-0.35) // tips curl up a little
      .rotateY(x * 1.6)
      .translate(x, 0.03, 0.3 - Math.abs(i - 1.5) * 0.02),
  );
  const thumb = new THREE.CapsuleGeometry(0.04, 0.1, 6, 10).rotateZ(Math.PI / 2).rotateY(-side * 0.7).translate(side * 0.17, 0.02, 0.08);
  const hand = merge(palm, ...fingers, thumb).rotateX(-0.3).rotateY(side * 0.35).translate(wrist.x, wrist.y, wrist.z);

  const tangent = curve.getTangentAt(1);
  const cuff = new THREE.TorusGeometry(0.115, 0.04, 12, 32)
    .applyQuaternion(new THREE.Quaternion().setFromUnitVectors(v3(0, 0, 1), tangent))
    .translate(wrist.x - tangent.x * 0.06, wrist.y - tangent.y * 0.06, wrist.z - tangent.z * 0.06);

  const shoulder = blob([0.26, 0.24, 0.25], [side * 0.04, -0.02, 0]);
  return { spirit: withAlong(merge(shoulder, arm, hand)), cuff };
}

/** The head, with the base of the neck as its origin. */
function buildHead() {
  const y = GENIE_HEIGHTS.head - GENIE_HEIGHTS.neck;
  const skull = blob([0.31, 0.35, 0.32], [0, y, 0], 32);
  const jaw = blob([0.23, 0.2, 0.22], [0, y - 0.2, 0.07]);
  const nose = blob([0.05, 0.075, 0.09], [0, y - 0.06, 0.27], 12);
  const ear = (side: number) =>
    new THREE.ConeGeometry(0.075, 0.3, 12)
      .scale(1, 1, 0.5)
      .rotateZ(-side * 1.0)
      .translate(side * 0.34, y + 0.08, -0.02);
  const beard = taperedTube(
    new THREE.CatmullRomCurve3([v3(0, y - 0.34, 0.16), v3(0, y - 0.5, 0.2), v3(0.03, y - 0.62, 0.24), v3(0.1, y - 0.66, 0.27), v3(0.13, y - 0.6, 0.28)]),
    (t) => 0.1 * Math.pow(1 - t, 0.8) + 0.008,
    16,
    10,
  );
  const topknot = taperedTube(
    new THREE.CatmullRomCurve3([v3(0, y + 0.3, -0.04), v3(0.02, y + 0.62, -0.06), v3(0.2, y + 0.84, -0.1), v3(0.42, y + 0.74, -0.12), v3(0.4, y + 0.56, -0.12), v3(0.3, y + 0.6, -0.12)]),
    (t) => 0.085 * Math.pow(1 - t, 0.7) + 0.008,
    28,
    12,
  );
  const brow = (side: number) =>
    new THREE.CapsuleGeometry(0.022, 0.13, 4, 8)
      .rotateZ(Math.PI / 2 + side * 0.16)
      .translate(side * 0.125, y + 0.115, 0.3);

  const eye = (side: number) =>
    blob([0.058, 0.03, 0.03], [0, 0, 0], 12)
      .rotateZ(side * 0.22)
      .translate(side * 0.125, y + 0.03, 0.283);
  const smile = new THREE.TorusGeometry(0.11, 0.014, 8, 20, Math.PI * 0.7)
    .rotateZ(Math.PI + Math.PI * 0.15)
    .translate(0, y - 0.13, 0.285);

  const earring = (side: number) => new THREE.TorusGeometry(0.06, 0.016, 8, 24).rotateY(Math.PI / 2).translate(side * 0.36, y - 0.1, -0.02);
  const knotRing = new THREE.TorusGeometry(0.085, 0.03, 10, 24).rotateX(Math.PI / 2).translate(0, y + 0.37, -0.045);

  return {
    spirit: withAlong(merge(skull, jaw, nose, ear(1), ear(-1), beard, topknot)),
    dark: withAlong(merge(brow(1), brow(-1))),
    glow: merge(eye(1), eye(-1), smile),
    gold: merge(earring(1), earring(-1), knotRing),
  };
}

/** A gold ring around the torso at `y`, sized to the body there. */
function torsoRing(y: number, halfWidth: number, halfDepth: number, thickness: number) {
  return new THREE.TorusGeometry(1, thickness, 12, 48)
    .rotateX(Math.PI / 2)
    .scale(halfWidth, 1, halfDepth)
    .translate(GENIE_TORSO.x, y, GENIE_TORSO.z);
}

/** All of the Genie's geometry. */
export function buildGenieGeometry() {
  const left = buildArm(1);
  const right = buildArm(-1);
  const head = buildHead();
  const shoulder = (side: number): THREE.Vector3Tuple => [GENIE_TORSO.x + side * 0.5, GENIE_HEIGHTS.shoulder, GENIE_TORSO.z];
  return {
    body: buildBody(),
    /** Gold on the torso: a sash at the waist and a collar at the neck. */
    torsoGold: merge(torsoRing(GENIE_HEIGHTS.waist + 0.08, 0.34, 0.27, 0.05), torsoRing(2.17, 0.24, 0.17, 0.035)),
    head,
    neck: [GENIE_TORSO.x, GENIE_HEIGHTS.neck, GENIE_TORSO.z] as THREE.Vector3Tuple,
    arms: [
      { ...left, shoulder: shoulder(1), side: 1 },
      { ...right, shoulder: shoulder(-1), side: -1 },
    ],
  };
}

/**
 * Where the Genie holds the Cards before offering them: between its gathered hands, in front
 * of its chest. Relative to the spout tip.
 */
export const GENIE_OFFER_POINT: THREE.Vector3Tuple = [GENIE_TORSO.x, GENIE_HEIGHTS.chest - 0.35, GENIE_TORSO.z + 0.95];
