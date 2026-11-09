import { useMemo, useRef, type RefObject } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { LampSession } from '../session/lampSession';
import { damp } from '../math';
import { CARD_SIZE } from './cardLayout';
import { hoversCards, pressesWithHand } from './pointerInput';

/** Tuning for playing with settled Cards: hover tilt, drag-to-flip and Inspect. */
export const CARD_PLAY = {
  /** Largest tilt (radians) toward the Hand while hovering over a Card. */
  hoverTilt: 0.35,
  /** How quickly the hover tilt follows the Hand (per second). */
  tiltRate: 10,
  /** Horizontal drag (CSS pixels) that turns a Card half over. */
  dragPixelsPerHalfTurn: 220,
  /** How quickly a released Card settles onto its nearer side (per second). */
  flipSettleRate: 9,
  /** Pointer travel (CSS pixels) below which a press on a Card counts as a click, not a drag. */
  clickSlop: 6,
  /** How quickly a Card flies to and from the camera when Inspected (per second). */
  inspectRate: 5,
  /**
   * Distance in front of the camera where an Inspected Card hangs. Just beyond the floating
   * Hand (HAND_FLOAT_DEPTH), so the Hand stays visible over the Card; the Card is scaled up
   * to make up for the distance.
   */
  inspectDepth: 5.6,
  /** Fraction of the view's height (or width, if narrower) an Inspected Card fills. */
  inspectFill: 0.82,
  /** Extra self-lighting on an Inspected Card's faces, so its text is readable in the dim room. */
  inspectGlow: 0.55,
} as const;

const smoothstep = (x: number) => x * x * (3 - 2 * x);

interface Drag {
  pointerId: number;
  startX: number;
  startFlip: number;
}

const inspectPosition = new THREE.Vector3();
const forward = new THREE.Vector3();
const local = new THREE.Vector3();

/**
 * Hover tilt, drag-to-flip and Inspect for one Card of the current Wish.
 *
 * `handlers` go on the Card's outer group, `flipper` on an inner group holding its meshes.
 * Each frame, after placing the Card in the arc, call `pose` to tilt it toward the Hand
 * and blend it toward its Inspect pose in front of the camera; it returns the glow the
 * Card's faces should have, so they're readable while Inspected.
 */
export function useCardPlay({
  session,
  index,
  card,
}: {
  session: LampSession;
  index: number;
  card: RefObject<THREE.Group | null>;
}) {
  const flipper = useRef<THREE.Group>(null);
  const play = useRef({
    settled: false,
    hover: null as { u: number; v: number } | null,
    tiltX: 0,
    tiltY: 0,
    flip: 0,
    drag: null as Drag | null,
    inspect: 0,
  });

  const handlers = useMemo(() => {
    const state = play.current;
    const canHover = () => state.settled && session.canHoverCards();
    const canFlip = () => state.settled && session.canFlipCard(index);

    const trackHover = (e: ThreeEvent<PointerEvent>) => {
      const cardGroup = card.current;
      if (!cardGroup || !canHover() || !hoversCards(e.nativeEvent)) {
        state.hover = null;
        return;
      }
      cardGroup.worldToLocal(local.copy(e.point));
      state.hover = {
        u: THREE.MathUtils.clamp(local.x / (CARD_SIZE.width / 2), -1, 1),
        v: THREE.MathUtils.clamp(local.y / (CARD_SIZE.height / 2), -1, 1),
      };
    };
    const endDrag = (e: ThreeEvent<PointerEvent>) => {
      if (!state.drag || state.drag.pointerId !== e.pointerId) return;
      state.drag = null;
      (e.target as Element).releasePointerCapture?.(e.pointerId);
    };

    return {
      onPointerOver(e: ThreeEvent<PointerEvent>) {
        e.stopPropagation();
        trackHover(e);
      },
      onPointerMove(e: ThreeEvent<PointerEvent>) {
        e.stopPropagation();
        if (state.drag?.pointerId === e.pointerId) {
          const dx = e.nativeEvent.clientX - state.drag.startX;
          state.flip = state.drag.startFlip + (dx / CARD_PLAY.dragPixelsPerHalfTurn) * Math.PI;
        } else trackHover(e);
      },
      onPointerOut() {
        state.hover = null;
      },
      onPointerDown(e: ThreeEvent<PointerEvent>) {
        e.stopPropagation();
        if (!pressesWithHand(e.nativeEvent) || !canFlip()) return;
        state.drag = { pointerId: e.pointerId, startX: e.nativeEvent.clientX, startFlip: state.flip };
        state.hover = null;
        (e.target as Element).setPointerCapture?.(e.pointerId);
      },
      onPointerUp: endDrag,
      onLostPointerCapture: endDrag,
      onClick(e: ThreeEvent<MouseEvent>) {
        e.stopPropagation(); // only the front-most Card hears the click
        if (e.delta <= CARD_PLAY.clickSlop) session.cardClicked(index);
      },
    };
  }, [session, index, card]);

  /** Poses the Card for this frame; returns how strongly its faces should glow (see `CARD_PLAY.inspectGlow`). */
  function pose(camera: THREE.Camera, dt: number, settled: boolean): number {
    const cardGroup = card.current;
    const state = play.current;
    if (!cardGroup) return 0;
    state.settled = settled;

    // Hover: tilt the Card's face toward the Hand.
    const hover = settled && session.canHoverCards() ? state.hover : null;
    state.tiltY = damp(state.tiltY, hover ? hover.u * CARD_PLAY.hoverTilt : 0, CARD_PLAY.tiltRate, dt);
    state.tiltX = damp(state.tiltX, hover ? -hover.v * CARD_PLAY.hoverTilt : 0, CARD_PLAY.tiltRate, dt);

    // Flip: follow the drag, then settle onto whichever side is nearer.
    if (!state.drag) state.flip = damp(state.flip, Math.round(state.flip / Math.PI) * Math.PI, CARD_PLAY.flipSettleRate, dt);
    if (flipper.current) flipper.current.rotation.y = state.flip;

    // Inspect: fly up close to the camera, facing it.
    const inspected = settled && session.isInspected(index);
    state.inspect = damp(state.inspect, inspected ? 1 : 0, CARD_PLAY.inspectRate, dt);
    if (state.inspect < 1e-3) state.inspect = 0;
    const inspectBlend = smoothstep(state.inspect);
    if (inspectBlend > 0) {
      camera.getWorldDirection(forward);
      inspectPosition.copy(camera.position).addScaledVector(forward, CARD_PLAY.inspectDepth);
      cardGroup.position.lerp(inspectPosition, inspectBlend);
      cardGroup.quaternion.slerp(camera.quaternion, inspectBlend);
      cardGroup.scale.setScalar(THREE.MathUtils.lerp(cardGroup.scale.x, inspectScale(camera), inspectBlend));
    }
    cardGroup.rotateX(state.tiltX);
    cardGroup.rotateY(state.tiltY);

    return CARD_PLAY.inspectGlow * inspectBlend;
  }

  return { handlers, flipper, pose };
}

/** Scale at which a Card at the Inspect depth fills `inspectFill` of the view. */
function inspectScale(camera: THREE.Camera): number {
  const fov = camera instanceof THREE.PerspectiveCamera ? camera.fov : 40;
  const aspect = camera instanceof THREE.PerspectiveCamera ? camera.aspect : 1;
  const viewHeight = 2 * CARD_PLAY.inspectDepth * Math.tan(THREE.MathUtils.degToRad(fov) / 2);
  const viewWidth = viewHeight * aspect;
  return CARD_PLAY.inspectFill * Math.min(viewHeight / CARD_SIZE.height, viewWidth / CARD_SIZE.width);
}
