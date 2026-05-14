import React, { useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { DEFAULT_MAPPER, mapperForObjectContain } from '@/lib/liriEmbeddedControl/mapper.js';

/**
 * Surface de contrôle pour une app capturée (aperçu + saisie) — même contrat que LIRI_FULL_SYSTEM.
 *
 * @param {object} props
 * @param {string | null | undefined} props.previewUrl
 * @param {{ status?: string; focusMode?: string; inputEnabled?: boolean }} props.runtimeState
 * @param {(evt: object) => void} [props.onInputEvent]
 * @param {(mapper: object) => void} [props.onMapperChange]
 * @param {Array<{ label: string; action: string }>} [props.longiaActions]
 * @param {(action: string) => void} [props.onLongiaAction]
 */
export default function EmbeddedAppSurface({
  previewUrl,
  runtimeState = {},
  onInputEvent,
  onMapperChange,
  longiaActions = [],
  onLongiaAction,
}) {
  const surfaceRef = useRef(null);
  const dragStart = useRef(null);
  const [imgNatural, setImgNatural] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    onMapperChange?.(DEFAULT_MAPPER);
  }, [previewUrl, onMapperChange]);

  useLayoutEffect(() => {
    const el = surfaceRef.current;
    if (!el || !onMapperChange) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      if (imgNatural.w > 0 && imgNatural.h > 0 && rect.width > 0 && rect.height > 0) {
        onMapperChange(mapperForObjectContain(imgNatural.w, imgNatural.h, rect.width, rect.height));
      } else {
        onMapperChange({ ...DEFAULT_MAPPER });
      }
    };
    update();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => update()) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [imgNatural, onMapperChange, previewUrl]);

  function localPoint(e) {
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  const inputEnabled = runtimeState.inputEnabled !== false;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex flex-wrap gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
        <span className="rounded-md bg-violet-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-200">
          Contrôle intégré
        </span>
        <span className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] text-white/55">
          Statut : {runtimeState.status || 'idle'}
        </span>
        <span className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] text-white/55">
          Focus : {runtimeState.focusMode || 'app'}
        </span>
        <span className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] text-white/55">
          Input : {inputEnabled ? 'on' : 'off'}
        </span>
      </div>

      <div
        ref={surfaceRef}
        className={cn(
          'relative min-h-[280px] flex-1 overflow-hidden rounded-xl border border-white/10 bg-black/40 outline-none',
          inputEnabled ? 'cursor-crosshair' : 'cursor-not-allowed opacity-60',
        )}
        tabIndex={inputEnabled ? 0 : -1}
        onClick={(e) => {
          if (!inputEnabled) return;
          const p = localPoint(e);
          onInputEvent?.({ eventType: 'click', x: p.x, y: p.y, timestampMs: Date.now() });
        }}
        onDoubleClick={(e) => {
          if (!inputEnabled) return;
          const p = localPoint(e);
          onInputEvent?.({ eventType: 'double_click', x: p.x, y: p.y, timestampMs: Date.now() });
        }}
        onWheel={(e) => {
          if (!inputEnabled) return;
          e.preventDefault();
          const p = localPoint(e);
          onInputEvent?.({
            eventType: 'scroll',
            x: p.x,
            y: p.y,
            deltaY: e.deltaY,
            timestampMs: Date.now(),
          });
        }}
        onMouseDown={(e) => {
          if (!inputEnabled) return;
          dragStart.current = localPoint(e);
        }}
        onMouseUp={(e) => {
          if (!inputEnabled || !dragStart.current) return;
          const end = localPoint(e);
          const start = dragStart.current;
          const moved = Math.abs(end.x - start.x) + Math.abs(end.y - start.y);
          if (moved > 8) {
            onInputEvent?.({
              eventType: 'drag',
              startX: start.x,
              startY: start.y,
              endX: end.x,
              endY: end.y,
              timestampMs: Date.now(),
            });
          }
          dragStart.current = null;
        }}
        onKeyDown={(e) => {
          if (!inputEnabled) return;
          if (e.key.length === 1) {
            onInputEvent?.({ eventType: 'text_input', text: e.key, timestampMs: Date.now() });
          } else {
            onInputEvent?.({ eventType: 'key_down', key: e.key, timestampMs: Date.now() });
          }
        }}
      >
        {previewUrl ? (
          <img
            className="pointer-events-none h-full w-full object-contain select-none"
            src={previewUrl}
            alt="Aperçu source"
            draggable={false}
            onLoad={(ev) => {
              const t = ev.currentTarget;
              setImgNatural({ w: t.naturalWidth, h: t.naturalHeight });
            }}
          />
        ) : (
          <div className="flex h-full min-h-[200px] items-center justify-center px-6 text-center text-[13px] text-white/40">
            Sélectionne une fenêtre (shell Electron) ou charge un aperçu pour calibrer les clics.
          </div>
        )}

        {longiaActions.length > 0 ? (
          <div className="pointer-events-auto absolute bottom-3 left-3 right-3 flex flex-wrap gap-2 rounded-lg border border-amber-500/20 bg-black/55 p-2 backdrop-blur-sm">
            {longiaActions.map((a) => (
              <button
                key={a.action}
                type="button"
                className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-100 transition hover:bg-amber-500/20"
                onClick={() => onLongiaAction?.(a.action)}
              >
                {a.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
