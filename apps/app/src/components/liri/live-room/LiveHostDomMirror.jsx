import React, { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { MOBILE_LIVE_VIEWPORT_CSS } from '@/lib/smartboardDesignCanvas';

const EMULATOR_MAX_H_EMBEDDED = 480;
const EMULATOR_MAX_H_MODAL = 580;

/**
 * Miroir du nœud DOM source (ex. grille live hôte) dans un cadre type smartphone.
 * Les flux vidéo partagent la même MediaStream (srcObject) ; les canvas 2D/WebGL
 * sont rafraîchis par requestAnimationFrame. Les interactions sur le miroir sont
 * neutralisées (le pilotage reste sur la vue principale).
 */
export default function LiveHostDomMirror({
  sourceRef,
  active = false,
  embedded = false,
  className,
}) {
  const rootRef = useRef(null);
  const mountRef = useRef(null);
  const rafId = useRef(0);
  const mo = useRef(null);
  const debounceTimer = useRef(0);
  const [box, setBox] = useState({ w: 320, h: 560, s: 0.4 });

  const remountClone = useCallback(() => {
    const src = sourceRef?.current;
    const el = mountRef.current;
    if (!src || !el) {
      if (el) el.innerHTML = '';
      return;
    }
    const next = src.cloneNode(true);
    try {
      next.querySelectorAll?.('[id]').forEach((node) => node.removeAttribute('id'));
      /** Évite les doublons de `data-testid` (Playwright strict mode / accessibilité). */
      next.querySelectorAll?.('[data-testid]').forEach((node) => node.removeAttribute('data-testid'));
    } catch {
      /* ignore */
    }
    el.replaceChildren(next);

    const oVideos = src.querySelectorAll('video');
    const cVideos = el.querySelectorAll('video');
    cVideos.forEach((cv, i) => {
      const ov = oVideos[i];
      if (ov && ov.srcObject) {
        cv.muted = true;
        cv.setAttribute('playsinline', 'true');
        try {
          cv.playsInline = true;
        } catch {
          /* ignore */
        }
        try {
          cv.srcObject = ov.srcObject;
          const p = cv.play();
          if (p && typeof p.catch === 'function') void p.catch(() => {});
        } catch {
          /* ignore */
        }
      } else {
        try {
          cv.muted = true;
        } catch {
          /* ignore */
        }
      }
    });
  }, [sourceRef]);

  const updateScale = useCallback(() => {
    const src = sourceRef?.current;
    if (!src) return;
    const r = src.getBoundingClientRect();
    const w = r.width;
    const h = r.height;
    if (w < 2 || h < 2) return;
    const maxW = Math.min(MOBILE_LIVE_VIEWPORT_CSS.width, rootRef.current?.clientWidth || MOBILE_LIVE_VIEWPORT_CSS.width);
    const maxH = embedded ? EMULATOR_MAX_H_EMBEDDED : EMULATOR_MAX_H_MODAL;
    const s = Math.min(1, maxW / w, maxH / h);
    setBox({ w, h, s });
  }, [embedded, sourceRef]);

  const scheduleRemount = useCallback(() => {
    if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
    debounceTimer.current = window.setTimeout(() => {
      debounceTimer.current = 0;
      remountClone();
      requestAnimationFrame(() => updateScale());
    }, 120);
  }, [remountClone, updateScale]);

  useEffect(() => {
    if (!active) {
      if (rafId.current) cancelAnimationFrame(rafId.current);
      rafId.current = 0;
      if (mountRef.current) mountRef.current.innerHTML = '';
      return;
    }
    remountClone();
    let live = true;
    const tick = () => {
      if (!live) return;
      const src = sourceRef?.current;
      const m = mountRef.current;
      if (src && m) {
        const oC = src.querySelectorAll('canvas');
        const tC = m.querySelectorAll('canvas');
        const n = Math.min(oC.length, tC.length);
        for (let i = 0; i < n; i += 1) {
          const o = oC[i];
          const t = tC[i];
          if (o.width < 1 || o.height < 1) continue;
          if (t.width !== o.width) t.width = o.width;
          if (t.height !== o.height) t.height = o.height;
          const ctx = t.getContext('2d');
          if (!ctx) continue;
          try {
            ctx.drawImage(o, 0, 0);
          } catch {
            /* WebGL : ignorer le cadre fautif */
          }
        }
      }
      rafId.current = requestAnimationFrame(tick);
    };
    requestAnimationFrame(() => {
      updateScale();
      if (rafId.current) cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(tick);
    });
    return () => {
      live = false;
      if (rafId.current) cancelAnimationFrame(rafId.current);
      rafId.current = 0;
    };
  }, [active, remountClone, updateScale, sourceRef]);

  useEffect(() => {
    if (!active) return;
    const src = sourceRef?.current;
    if (!src) return;
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(updateScale);
    });
    ro.observe(src);
    if (mo.current) mo.current.disconnect();
    mo.current = new MutationObserver(() => {
      scheduleRemount();
    });
    mo.current.observe(src, { subtree: true, childList: true, attributes: true });
    window.addEventListener('resize', updateScale);
    return () => {
      ro.disconnect();
      if (mo.current) mo.current.disconnect();
      window.removeEventListener('resize', updateScale);
    };
  }, [active, sourceRef, scheduleRemount, updateScale]);

  if (sourceRef == null) return null;

  return (
    <div className={cn('w-full', className)}>
      <div
        ref={rootRef}
        className="relative mx-auto w-full max-w-[min(100%,390px)] overflow-hidden rounded-[1.3rem] border-2 border-zinc-600/80 bg-zinc-950 shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_20px_50px_rgba(0,0,0,0.55)]"
        style={{ maxHeight: embedded ? EMULATOR_MAX_H_EMBEDDED + 24 : EMULATOR_MAX_H_MODAL + 24 }}
      >
        <div
          className="absolute left-1/2 top-2.5 h-1 w-8 -translate-x-1/2 rounded-full bg-white/20"
          aria-hidden
        />
        <div
          className="mt-3 overflow-hidden"
          style={{
            height: embedded ? EMULATOR_MAX_H_EMBEDDED : EMULATOR_MAX_H_MODAL,
            borderRadius: '0.6rem',
          }}
        >
          {!active || !sourceRef.current ? (
            <div className="flex h-full min-h-[12rem] flex-col items-center justify-center gap-2 bg-zinc-950 px-3 text-center">
              <p className="text-[11px] text-white/45">
                {active && !sourceRef.current
                  ? 'Raccordement de la zone live…'
                  : 'Activez l&apos;aperçu mobile ci-dessus : la grille passe en mode compact, le miroir s&apos;affiche ici.'}
              </p>
            </div>
          ) : (
            <div
              className="origin-top-left select-none will-change-transform pointer-events-none [&_*]:pointer-events-none"
              style={{
                width: Math.max(1, box.w) * box.s,
                height: Math.max(1, box.h) * box.s,
                position: 'relative',
              }}
            >
              <div
                className="origin-top-left"
                style={{
                  width: Math.max(1, box.w),
                  height: Math.max(1, box.h),
                  transform: `scale(${box.s || 0.1})`,
                }}
              >
                <div ref={mountRef} className="text-white" />
              </div>
            </div>
          )}
        </div>
        <div
          className="absolute bottom-1.5 left-1/2 h-0.5 w-10 -translate-x-1/2 rounded-full bg-white/12"
          aria-hidden
        />
      </div>
      <p className="mt-1.5 text-center text-[9px] leading-snug text-white/32">
        Miroir live (même contenu que la grille). Double connexion inutile — lecture seule.
      </p>
    </div>
  );
}
