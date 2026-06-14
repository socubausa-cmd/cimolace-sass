import React, { useCallback, useRef } from 'react';
import { mapGestureToOverlay, useMobileLiriStore } from '@/stores/mobileLiriStore';

const THRESHOLD = 56;
const EDGE_X = 28;
const EDGE_Y_TOP = 44;

/**
 * Zones de bord — évite de voler le scroll du contenu central.
 */
export function GestureOverlayController({
  enabled,
  onRequestExit,
  liveActive,
}) {
  const touchRef = useRef(null);
  const smartboardFull = useMobileLiriStore((s) => s.smartboardFull);

  const applyDirection = useCallback(
    (dx, dy) => {
      const ax = Math.abs(dx);
      const ay = Math.abs(dy);
      if (ax < THRESHOLD && ay < THRESHOLD) return;
      let dir = null;
      if (ay >= ax) {
        if (dy < -THRESHOLD) dir = 'up';
        else if (dy > THRESHOLD) dir = 'down';
      } else {
        if (dx > THRESHOLD) dir = 'right';
        else if (dx < -THRESHOLD) dir = 'left';
      }
      if (!dir) return;
      const mapped = mapGestureToOverlay(dir);
      if (mapped === 'exit') {
        if (liveActive) {
          useMobileLiriStore.getState().setOverlay('exit-confirm');
        } else {
          onRequestExit?.();
        }
        return;
      }
      if (mapped) useMobileLiriStore.getState().setOverlay(mapped);
    },
    [liveActive, onRequestExit],
  );

  const onTouchStart = (e) => {
    if (!enabled) return;
    const t = e.targetTouches[0];
    touchRef.current = { x: t.clientX, y: t.clientY, edge: e.currentTarget.dataset.liriEdge };
  };

  const onTouchEnd = (e) => {
    if (!enabled || !touchRef.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchRef.current.x;
    const dy = t.clientY - touchRef.current.y;
    touchRef.current = null;
    applyDirection(dx, dy);
  };

  if (!enabled) return null;

  const zone =
    'fixed z-[60] touch-none select-none bg-transparent active:bg-white/[0.02]';
  const showBottomEdge = !smartboardFull;

  return (
    <>
      {showBottomEdge ? (
      <div
        data-liri-edge="bottom"
        className={`${zone} bottom-0 left-0 right-0 h-[4.5rem]`}
        aria-hidden
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      />
      ) : null}
      <div
        data-liri-edge="top"
        className={`${zone} top-0 left-0 right-0`}
        style={{ height: EDGE_Y_TOP }}
        aria-hidden
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      />
      <div
        data-liri-edge="left"
        className={`${zone} top-0 bottom-0 left-0`}
        style={{ width: EDGE_X }}
        aria-hidden
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      />
      <div
        data-liri-edge="right"
        className={`${zone} top-0 bottom-0 right-0`}
        style={{ width: EDGE_X }}
        aria-hidden
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      />
      <p className="sr-only">
        Gestes bord d'écran LIRI : bas vers haut membres, haut vers bas plein écran SmartBoard, gauche
        vers droite réglages, droite vers gauche retour. En plein cadre SmartBoard, la zone basse est
        libérée pour le défilement du plateau.
      </p>
    </>
  );
}
