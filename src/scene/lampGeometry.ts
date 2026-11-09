import * as THREE from 'three';

/** Lathe a profile of [radius, height] points around the y axis. */
export function lathe(points: [number, number][], segments = 96): THREE.LatheGeometry {
  return new THREE.LatheGeometry(
    points.map(([x, y]) => new THREE.Vector2(x, y)),
    segments,
  );
}

/** A tube along `curve` that tapers from radius `r0` at the start to `r1` at the end. */
export function taperedTube(
  curve: THREE.Curve<THREE.Vector3>,
  r0: number,
  r1: number,
  tubular = 80,
  radial = 24,
): THREE.TubeGeometry {
  const geo = new THREE.TubeGeometry(curve, tubular, 1, radial, false);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i <= tubular; i++) {
    const t = i / tubular;
    const c = curve.getPointAt(t);
    const r = THREE.MathUtils.lerp(r0, r1, Math.pow(t, 0.8));
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      v.fromBufferAttribute(pos, k).sub(c).multiplyScalar(r).add(c);
      pos.setXYZ(k, v.x, v.y, v.z);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** All of the Lamp's geometry, ported from prototypes/code-lamp.html. */
export function buildLampGeometry() {
  const bodyProfile: [number, number][] = [];
  for (let i = 0; i <= 40; i++) {
    const a = -Math.PI / 2 + (i / 40) * Math.PI;
    const r = Math.cos(a) * (1 + 0.12 * Math.sin(a)); // slightly fuller at the top
    bodyProfile.push([Math.max(r, 0.0001), 0.85 + Math.sin(a) * 0.52]);
  }

  const spoutCurve = new THREE.CatmullRomCurve3([
    v3(0.95, 0.8, 0),
    v3(1.55, 0.92, 0),
    v3(2.1, 1.12, 0),
    v3(2.5, 1.42, 0),
    v3(2.68, 1.6, 0),
  ]);
  const handleCurve = new THREE.CatmullRomCurve3([
    v3(-1.2, 1.15, 0),
    v3(-1.75, 1.35, 0),
    v3(-2.05, 1.05, 0),
    v3(-1.85, 0.62, 0),
    v3(-1.4, 0.55, 0),
    v3(-1.15, 0.62, 0),
  ]);

  return {
    foot: lathe([[0, 0], [0.62, 0], [0.64, 0.04], [0.55, 0.09], [0.3, 0.16], [0.24, 0.28], [0.3, 0.36], [0, 0.36]]),
    body: lathe(bodyProfile),
    band: new THREE.TorusGeometry(1.0, 0.035, 16, 128),
    neck: lathe([[0, 1.3], [0.42, 1.3], [0.36, 1.42], [0.4, 1.48], [0, 1.48]]),
    lid: lathe([[0, 1.48], [0.38, 1.48], [0.34, 1.6], [0.22, 1.72], [0.1, 1.8], [0, 1.82]]),
    finial: lathe([[0, 1.8], [0.06, 1.82], [0.05, 1.9], [0.1, 1.98], [0.06, 2.06], [0, 2.1]]),
    gem: new THREE.IcosahedronGeometry(0.06, 2),
    spout: taperedTube(spoutCurve, 0.32, 0.075),
    spoutLip: new THREE.TorusGeometry(0.08, 0.02, 12, 32),
    spoutTip: spoutCurve.getPointAt(1),
    spoutLipRotation: new THREE.Quaternion().setFromUnitVectors(v3(0, 0, 1), spoutCurve.getTangentAt(1)),
    handle: new THREE.TubeGeometry(handleCurve, 80, 0.07, 20, false),
    handleCurl: new THREE.SphereGeometry(0.1, 24, 16),
  };
}
