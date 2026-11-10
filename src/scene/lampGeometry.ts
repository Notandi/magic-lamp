import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Lathe a profile of [radius, height] points around the y axis. */
export function lathe(points: [number, number][], segments = 96): THREE.LatheGeometry {
  return new THREE.LatheGeometry(
    points.map(([x, y]) => new THREE.Vector2(x, y)),
    segments,
  );
}

/** Half-width (along z) and half-height of the cross-section at position `t` along a spine. */
type Radii = (t: number) => [halfWidth: number, halfHeight: number];

const Z = new THREE.Vector3(0, 0, 1);

/** A curve through [x, y] points, lying in the XY plane. */
const planarCurve = (points: [number, number][]) =>
  new THREE.CatmullRomCurve3(points.map(([x, y]) => new THREE.Vector3(x, y, 0)));

/** Centre, tangent and in-plane normal of a planar spine at `t`. */
function frameAt(spine: THREE.Curve<THREE.Vector3>, t: number) {
  const centre = spine.getPoint(t);
  const tangent = spine.getTangent(t);
  return { centre, tangent, normal: new THREE.Vector3(-tangent.y, tangent.x, 0) };
}

/**
 * Sweeps an ellipse along a spine lying in the XY plane.
 * UVs: u runs along the spine, v runs around it (0 = underside, 0.5 = top).
 */
export function loft(
  spine: THREE.Curve<THREE.Vector3>,
  radii: Radii,
  segments: number,
  radial: number,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const { centre, normal } = frameAt(spine, t);
    const [halfWidth, halfHeight] = radii(t);
    for (let j = 0; j <= radial; j++) {
      const v = j / radial;
      const angle = v * Math.PI * 2 - Math.PI / 2;
      const up = halfHeight * Math.sin(angle);
      positions.push(centre.x + normal.x * up, centre.y + normal.y * up, halfWidth * Math.cos(angle));
      uvs.push(t, v);
    }
  }
  const row = radial + 1;
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * row + j;
      const b = a + row;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  // Weld the normals along the seam (the underside) so it doesn't show.
  const normals = geometry.attributes.normal;
  const first = new THREE.Vector3();
  const last = new THREE.Vector3();
  for (let i = 0; i <= segments; i++) {
    const a = i * row;
    const b = a + radial;
    first.fromBufferAttribute(normals, a).add(last.fromBufferAttribute(normals, b)).normalize();
    normals.setXYZ(a, first.x, first.y, first.z);
    normals.setXYZ(b, first.x, first.y, first.z);
  }
  return geometry;
}

/** A raised band wrapped around a lofted shape at position `t` along its spine. */
function band(spine: THREE.Curve<THREE.Vector3>, radii: Radii, t: number, thickness: number): THREE.BufferGeometry {
  const { centre, tangent, normal } = frameAt(spine, t);
  const [halfWidth, halfHeight] = radii(t);
  const around = 72;
  const tube = 14;
  const positions: number[] = [];
  const indices: number[] = [];
  for (let j = 0; j <= around; j++) {
    const a = (j / around) * Math.PI * 2;
    const outward = normal
      .clone()
      .multiplyScalar(halfHeight * Math.sin(a))
      .addScaledVector(Z, halfWidth * Math.cos(a));
    const onSurface = centre.clone().add(outward);
    outward.normalize();
    for (let k = 0; k <= tube; k++) {
      const b = (k / tube) * Math.PI * 2;
      const p = onSurface
        .clone()
        .addScaledVector(outward, thickness * Math.cos(b))
        .addScaledVector(tangent, thickness * 1.5 * Math.sin(b));
      positions.push(p.x, p.y, p.z);
    }
  }
  for (let j = 0; j < around; j++) {
    for (let k = 0; k < tube; k++) {
      const a = j * (tube + 1) + k;
      const b = a + tube + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** `count` copies of `shape` placed by `place`, merged into one geometry. */
function scatter(shape: THREE.BufferGeometry, count: number, place: (i: number, m: THREE.Matrix4) => void) {
  const m = new THREE.Matrix4();
  const copies = Array.from({ length: count }, (_, i) => {
    place(i, m.identity());
    return shape.clone().applyMatrix4(m);
  });
  return mergeGeometries(copies);
}

/** A ring of beads around the y axis. */
function beadRing(count: number, radius: number, y: number, size: number) {
  return scatter(new THREE.SphereGeometry(size, 12, 8), count, (i, m) => {
    const a = (i / count) * Math.PI * 2;
    m.makeTranslation(Math.cos(a) * radius, y, Math.sin(a) * radius);
  });
}

/**
 * The body and spout are one surface. Each key is [x, y, half-width, half-height]:
 * the body swells, then draws out into the spout and flares at the lip.
 */
const BODY_KEYS: [number, number, number, number][] = [
  [-1.3, 0.97, 0.004, 0.004],
  [-1.16, 0.96, 0.44, 0.31],
  [-0.7, 0.95, 0.84, 0.53],
  [0.0, 0.93, 1.0, 0.62],
  [0.72, 0.95, 0.8, 0.5],
  [1.28, 1.02, 0.44, 0.31],
  [1.78, 1.2, 0.25, 0.195],
  [2.22, 1.5, 0.165, 0.14],
  [2.56, 1.86, 0.118, 0.108],
  [2.73, 2.09, 0.125, 0.115],
  [2.79, 2.19, 0.185, 0.165],
];
const bodySpine = planarCurve(BODY_KEYS.map(([x, y]) => [x, y]));
const bodyRadiiCurve = planarCurve(BODY_KEYS.map(([, , w, h]) => [w, h]));
const bodyRadii: Radii = (t) => {
  const r = bodyRadiiCurve.getPoint(t);
  return [Math.max(r.x, 0.004), Math.max(r.y, 0.004)];
};

/** The spout's open tip in the Lamp's local space; Smoke rises from here. */
export const SPOUT_TIP: Readonly<THREE.Vector3> = bodySpine.getPoint(1);

/** Height of the Lamp's highest point, the tip of the finial gem. */
export const LAMP_TOP = 2.4;

/** Where the lid sits along the Lamp's length. */
const LID_X = -0.04;
const RUBY_COUNT = 6;
/** Half the Lamp's width at its widest, where the flank cabochons sit. */
const FLANK_Z = 0.985;
const FLANK_Y = 0.93;

/** All of the Lamp's geometry, ported from prototypes/fable-lamp.html. */
export function buildLampGeometry() {
  const handleSpine = planarCurve([
    [-0.95, 1.24], [-1.42, 1.58], [-1.92, 1.56], [-2.16, 1.12], [-1.93, 0.66], [-1.46, 0.55], [-1.0, 0.72],
  ]);
  const scrollSpine = planarCurve([
    [-1.4, 1.6], [-1.56, 1.74], [-1.74, 1.95], [-1.6, 2.13], [-1.4, 2.05], [-1.42, 1.88], [-1.54, 1.9],
  ]);

  // The glowing disc down inside the spout, facing out along it.
  const throatAt = 0.955;
  const throatFrame = frameAt(bodySpine, throatAt);
  const [throatWidth, throatHeight] = bodyRadii(throatAt);
  const throat = new THREE.CircleGeometry(1, 40).applyMatrix4(
    new THREE.Matrix4()
      .makeBasis(
        Z.clone().multiplyScalar(throatWidth),
        throatFrame.normal.clone().multiplyScalar(throatHeight),
        throatFrame.tangent.clone().negate(),
      )
      .setPosition(throatFrame.centre),
  );

  const rubyPosition = (i: number) => {
    const a = (i / RUBY_COUNT) * Math.PI * 2 + 0.3;
    return { a, position: new THREE.Vector3(Math.cos(a) * 0.355, 1.715, Math.sin(a) * 0.355) };
  };
  const facing = new THREE.Object3D();

  const finialGem = new THREE.OctahedronGeometry(0.105, 1);
  finialGem.scale(0.85, 1.25, 0.85);

  const lidParts = {
    lid: lathe([
      [0, 1.42], [0.47, 1.42], [0.49, 1.49], [0.45, 1.525], [0.42, 1.545],
      [0.42, 1.57], [0.39, 1.67], [0.31, 1.76], [0.19, 1.83], [0.1, 1.865],
      [0.055, 1.89], [0.045, 1.95], [0.085, 1.985], [0.105, 2.02], [0.07, 2.06],
      [0.035, 2.1], [0.05, 2.135], [0.065, 2.15], [0, 2.155],
    ]),
    lidBeads: beadRing(34, 0.487, 1.49, 0.026),
    rubies: scatter(new THREE.SphereGeometry(0.038, 12, 8), RUBY_COUNT, (i, m) => {
      m.setPosition(rubyPosition(i).position);
    }),
    rubyBezels: scatter(new THREE.TorusGeometry(0.042, 0.012, 8, 20), RUBY_COUNT, (i, m) => {
      const { a, position } = rubyPosition(i);
      facing.position.copy(position);
      facing.lookAt(position.clone().add(new THREE.Vector3(Math.cos(a), 1.1, Math.sin(a))));
      facing.updateMatrix();
      m.copy(facing.matrix);
    }),
  };
  for (const part of Object.values(lidParts)) part.translate(LID_X, 0, 0);

  const onFlanks = (shape: THREE.BufferGeometry, sx: number, sy: number, sz: number) =>
    scatter(shape, 2, (i, m) => {
      m.makeScale(sx, sy, sz).setPosition(0, FLANK_Y, i === 0 ? FLANK_Z : -FLANK_Z);
    });

  return {
    /** Engraved: carries the UVs the engraving texture is drawn for. */
    body: loft(bodySpine, bodyRadii, 260, 96),
    darkBands: mergeGeometries([band(bodySpine, bodyRadii, 0.555, 0.022), band(bodySpine, bodyRadii, 0.86, 0.016)]),
    brightBands: mergeGeometries([band(bodySpine, bodyRadii, 0.585, 0.014), band(bodySpine, bodyRadii, 0.997, 0.02)]),
    throat,
    handle: loft(
      handleSpine,
      (t) => {
        const r = 0.055 + 0.035 * Math.sin(Math.PI * t);
        return [r * 1.25, r];
      },
      120,
      24,
    ),
    scroll: loft(
      scrollSpine,
      (t) => {
        const r = 0.07 - 0.045 * t;
        return [r * 1.2, r];
      },
      90,
      20,
    ),
    scrollTip: new THREE.SphereGeometry(0.045, 20, 14).translate(...scrollSpine.getPoint(1).toArray()),
    foot: lathe([
      [0, 0], [0.7, 0], [0.735, 0.03], [0.71, 0.07], [0.62, 0.095], [0.6, 0.12], [0.46, 0.15],
      [0.33, 0.2], [0.27, 0.27], [0.29, 0.33], [0.36, 0.37], [0.47, 0.43], [0, 0.43],
    ]),
    footBeads: beadRing(52, 0.73, 0.034, 0.028),
    ...lidParts,
    finialGem,
    finialGemPosition: [LID_X, 2.27, 0] as const,
    cabochons: onFlanks(new THREE.SphereGeometry(1, 32, 20), 0.2, 0.13, 0.07),
    cabochonBezels: onFlanks(new THREE.TorusGeometry(1, 0.11, 12, 48), 0.215, 0.145, 0.12),
  };
}
