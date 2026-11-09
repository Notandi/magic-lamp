import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import type { LampSession, WishCards } from '../session/lampSession';
import cardBackUrl from '../assets/cards/card-back.jpg';
import { CARD_SIZE, fanArc, type FanSlot } from './cardLayout';
import type { SmokeDissolve } from './Smoke';

/** Timing of the Cards' animations, in seconds. */
export const CARD_ANIMATION = {
  /** How long each Card takes to rise from the Smoke column to its place in the arc. */
  riseSeconds: 1.6,
  /** Delay between one Card starting to rise and the next. */
  riseStagger: 0.18,
  /** Full turns a Card spins about its vertical axis while rising. */
  riseSpins: 1.5,
  /** Height above the spout where Cards appear in the column. */
  columnHeight: 0.6,
  /** How long dissolving Cards take to vanish into Smoke. */
  dissolveSeconds: 0.7,
  /** Smoke puffs released per dissolving Card per frame. */
  dissolvePuffsPerFrame: 3,
} as const;

/** The image on each side of a Card. */
interface CardFaces {
  front: string;
  back: string;
}

interface ShownWish {
  id: number;
  faces: CardFaces[];
}

/** Shared, per-frame animation clock for the Cards on show. */
interface CardsClock {
  stage: 'rising' | 'settled' | 'dissolving';
  /** Seconds since the current stage began. */
  t: number;
}

function facesOf(cards: WishCards): CardFaces[] {
  if (cards.kind === 'cards') return cards.cards.map((c) => ({ front: c.frontImageUrl, back: c.backImageUrl }));
  return Array.from({ length: cards.count }, () => ({ front: cardBackUrl, back: cardBackUrl }));
}

const ease = (k: number) => 1 - Math.pow(1 - k, 3);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * A Wish's Cards. They rise out of the Smoke column one after another, spinning, and settle
 * into a fan-shaped arc above the Lamp; then they report Cards-settled to the Lamp session.
 * When the session clears them, they dissolve into Smoke. Each Wish replaces the last.
 */
export function Cards({
  session,
  origin,
  dissolve,
}: {
  session: LampSession;
  /** World position of the spout tip the Smoke column rises from. */
  origin: THREE.Vector3Tuple;
  dissolve: SmokeDissolve;
}) {
  const [shown, setShown] = useState<ShownWish | null>(null);
  const clock = useRef<CardsClock>({ stage: 'settled', t: 0 });
  const shownId = useRef(0);
  const slots = useMemo(() => (shown ? fanArc(shown.faces.length) : []), [shown]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    const { wishId, cards } = session.state;
    const c = clock.current;
    c.t += dt;

    if (cards && wishId !== shownId.current) {
      // A new Wish's Cards: they replace whatever was on show.
      shownId.current = wishId;
      clock.current = { stage: 'rising', t: 0 };
      setShown({ id: wishId, faces: facesOf(cards) });
      return;
    }
    if (!shown) return;

    const count = shown.faces.length;
    if (c.stage === 'rising' && c.t >= (count - 1) * CARD_ANIMATION.riseStagger + CARD_ANIMATION.riseSeconds) {
      clock.current = { stage: 'settled', t: 0 };
      session.cardsSettled();
    } else if (c.stage !== 'dissolving' && !cards) {
      clock.current = { stage: 'dissolving', t: 0 };
    } else if (c.stage === 'dissolving' && c.t >= CARD_ANIMATION.dissolveSeconds) {
      setShown(null);
    }
  });

  if (!shown) return null;
  return (
    <group>
      {shown.faces.map((faces, i) => (
        <CardSlab
          key={`${shown.id}-${i}`}
          index={i}
          faces={faces}
          slot={slots[i]}
          origin={origin}
          clock={clock}
          dissolve={dissolve}
        />
      ))}
    </group>
  );
}

/** Rounded-rectangle outline of a Card, centred on the origin. */
function cardShape(): THREE.Shape {
  const { width: w, height: h, cornerRadius: r } = CARD_SIZE;
  const x = -w / 2;
  const y = -h / 2;
  const s = new THREE.Shape();
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/** Card geometry shared by every Card: a thin rounded slab and its two faces. */
const cardGeometry = (() => {
  const shape = cardShape();
  const { width: w, height: h, thickness } = CARD_SIZE;
  const face = new THREE.ShapeGeometry(shape, 6);
  // ShapeGeometry's UVs are its x/y coordinates; stretch them to 0..1 over the Card.
  const uv = face.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / w + 0.5, uv.getY(i) / h + 0.5);
  const body = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 6 });
  body.translate(0, 0, -thickness / 2);
  return { face, body, faceOffset: thickness / 2 + 0.0005 };
})();

const edgeMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1612, roughness: 0.7, transparent: true });

function CardSlab({
  index,
  faces,
  slot,
  origin,
  clock,
  dissolve,
}: {
  index: number;
  faces: CardFaces;
  slot: FanSlot;
  origin: THREE.Vector3Tuple;
  clock: RefObject<CardsClock>;
  dissolve: SmokeDissolve;
}) {
  const group = useRef<THREE.Group>(null);
  const [front, back] = useTexture([faces.front, faces.back]);
  const materials = useMemo(() => {
    for (const tex of [front, back]) {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
    }
    const make = (map: THREE.Texture) =>
      new THREE.MeshStandardMaterial({ map, roughness: 0.45, metalness: 0, transparent: true });
    return { front: make(front), back: make(back), edge: edgeMaterial.clone() };
  }, [front, back]);
  useEffect(
    () => () => {
      materials.front.dispose();
      materials.back.dispose();
      materials.edge.dispose();
    },
    [materials],
  );

  const start = useMemo(() => new THREE.Vector3(origin[0], origin[1] + CARD_ANIMATION.columnHeight, origin[2]), [origin]);
  const end = useMemo(() => new THREE.Vector3(...slot.position), [slot]);

  useFrame(({ camera }) => {
    const g = group.current;
    const c = clock.current;
    if (!g || !c) return;

    let k = 1; // 0 in the column → 1 settled in the arc
    let fade = 1;
    if (c.stage === 'rising') k = clamp01((c.t - index * CARD_ANIMATION.riseStagger) / CARD_ANIMATION.riseSeconds);
    if (c.stage === 'dissolving') fade = 1 - clamp01(c.t / CARD_ANIMATION.dissolveSeconds);

    const e = ease(k);
    g.position.lerpVectors(start, end, e);
    // Rise in a slight arc: up the column first, then out to the slot.
    g.position.y += Math.sin(Math.PI * e) * 0.35;
    g.lookAt(camera.position);
    g.rotateZ(slot.tilt * e);
    g.rotateY((1 - e) * Math.PI * 2 * CARD_ANIMATION.riseSpins);
    const scale = (0.15 + 0.85 * e) * (0.4 + 0.6 * fade);
    g.scale.setScalar(scale);
    g.visible = k > 0 && fade > 0;

    for (const m of [materials.front, materials.back, materials.edge]) m.opacity = fade * Math.min(1, k * 4);

    if (c.stage === 'dissolving' && fade > 0.2) {
      dissolve.bursts.push({ x: g.position.x, y: g.position.y, z: g.position.z, count: CARD_ANIMATION.dissolvePuffsPerFrame });
    }
  });

  return (
    <group ref={group} visible={false}>
      <mesh geometry={cardGeometry.body} material={materials.edge} castShadow />
      <mesh geometry={cardGeometry.face} material={materials.front} position-z={cardGeometry.faceOffset} />
      <mesh geometry={cardGeometry.face} material={materials.back} position-z={-cardGeometry.faceOffset} rotation-y={Math.PI} />
    </group>
  );
}
