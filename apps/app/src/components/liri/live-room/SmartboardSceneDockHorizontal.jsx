import React, { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SmartboardNavigatorSceneIcon } from '@/components/liri/live-room/SmartboardNavigatorSceneIcon';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

function SceneNavTooltipTop({ scene, premiumArenaHostTray, children }) {
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={10}
        className={cn(
          'max-w-[min(92vw,268px)] border px-3 py-2.5 text-left shadow-[0_14px_44px_-14px_rgba(0,0,0,0.82)]',
          premiumArenaHostTray
            ? 'border-amber-400/35 bg-[#0c0820]/97 text-amber-50'
            : 'border-amber-400/32 bg-[#0f0e0a]/97 text-amber-50',
        )}
      >
        <p
          className={cn(
            'text-[11px] font-bold uppercase tracking-[0.07em]',
            premiumArenaHostTray ? 'text-amber-100' : 'text-amber-100',
          )}
        >
          {scene.label}
        </p>
        {scene.hint ? (
          <p className="mt-1.5 text-[10px] font-medium leading-relaxed text-white/50">{scene.hint}</p>
        ) : null}
      </TooltipContent>
    </Tooltip>
  );
}

function dockChromeBtnClass(premiumArenaHostTray) {
  return cn(
    'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-all duration-200 ease-out',
    'border-white/[0.08] bg-[#14131c]/95 text-white/52',
    'shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]',
    premiumArenaHostTray
      ? 'hover:border-amber-400/35 hover:bg-[#16122a] hover:text-amber-100'
      : 'hover:border-amber-400/32 hover:bg-[#1a1814] hover:text-amber-100/95',
    'active:scale-[0.96] disabled:pointer-events-none disabled:opacity-[0.22]',
  );
}

const SceneThumbH = forwardRef(function SceneThumbH(
  { scene, active, onClick, readOnly, premiumArenaHostTray },
  ref,
) {
  const cls = cn(
    'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-all duration-200 ease-out',
    active
      ? premiumArenaHostTray
        ? 'border-amber-400/45 bg-gradient-to-b from-amber-500/22 to-[#0c0a18] text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_0_16px_-10px_rgba(212,163,106,0.45)]'
        : 'border-amber-400/42 bg-gradient-to-b from-amber-500/18 to-[#14100c] text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_16px_-10px_rgba(245,158,11,0.3)]'
      : cn(
          'border-white/[0.07] bg-[#14131c]/90 text-white/48',
          'shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
          !readOnly &&
            (premiumArenaHostTray
              ? 'hover:border-amber-400/28 hover:bg-[#16122a] hover:text-amber-100/90'
              : 'hover:border-amber-400/26 hover:bg-[#1c1a16] hover:text-amber-100/90'),
        ),
    readOnly ? 'cursor-default opacity-[0.96]' : 'cursor-pointer',
  );
  const dotCls = cn(
    'pointer-events-none absolute bottom-1 left-1/2 h-[2px] w-4 -translate-x-1/2 rounded-full transition-all duration-200',
    active ? 'opacity-100' : 'opacity-0',
    premiumArenaHostTray
      ? 'bg-amber-300/90 shadow-[0_0_6px_rgba(212,163,106,0.65)]'
      : 'bg-amber-300/90 shadow-[0_0_6px_rgba(252,211,77,0.5)]',
  );
  const inner = (
    <>
      <SmartboardNavigatorSceneIcon sceneId={scene.id} className="h-4 w-4 shrink-0" strokeWidth={1.35} />
      <span className="sr-only">{scene.label}</span>
      <span aria-hidden className={dotCls} />
    </>
  );
  const spring = { type: 'spring', stiffness: 420, damping: 28, mass: 0.32 };
  if (readOnly) {
    return (
      <SceneNavTooltipTop scene={scene} premiumArenaHostTray={premiumArenaHostTray}>
        <motion.div ref={ref} role="presentation" className={cls} animate={{ scale: 1 }} transition={spring}>
          {inner}
        </motion.div>
      </SceneNavTooltipTop>
    );
  }
  return (
    <SceneNavTooltipTop scene={scene} premiumArenaHostTray={premiumArenaHostTray}>
      <motion.button
        ref={ref}
        type="button"
        onClick={onClick}
        whileTap={{ scale: 0.92 }}
        className={cls}
        transition={spring}
      >
        {inner}
      </motion.button>
    </SceneNavTooltipTop>
  );
});
SceneThumbH.displayName = 'SceneThumbH';

/**
 * Bandeau horizontal des scènes SmartBoard — pied de page avec la barre d'actions hôte (LiveControlsBar).
 */
export default function SmartboardSceneDockHorizontal({
  scenes = [],
  currentScene,
  onChangeScene,
  readOnly = false,
  premiumArenaHostTray = false,
}) {
  const total = scenes.length;
  const currentIndex = Math.max(0, scenes.findIndex((s) => s.id === currentScene));
  const goPrev = () => {
    if (readOnly || total <= 1) return;
    const prev = scenes[(currentIndex - 1 + total) % total];
    if (prev) onChangeScene?.(prev.id);
  };
  const goNext = () => {
    if (readOnly || total <= 1) return;
    const next = scenes[(currentIndex + 1) % total];
    if (next) onChangeScene?.(next.id);
  };

  if (total <= 0) return null;

  return (
    <TooltipProvider delayDuration={200} skipDelayDuration={100}>
      <div
        className={cn(
          'flex w-full min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-white/[0.08] bg-[#14131c]/90 px-2 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
          premiumArenaHostTray && 'border-amber-500/15 bg-[#14131c]/92',
        )}
        role="toolbar"
        aria-label="Scènes SmartBoard"
      >
        <Tooltip delayDuration={220}>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={goPrev}
              disabled={readOnly || total <= 1}
              className={dockChromeBtnClass(premiumArenaHostTray)}
              title="Scène précédente"
            >
              <ChevronLeft className="h-4 w-4 stroke-[1.5]" />
            </button>
          </TooltipTrigger>
          <TooltipContent
            side="top"
            className="max-w-[220px] border border-white/14 bg-[#0c0f16]/97 px-2.5 py-1.5 text-left text-[10px] text-white/75"
          >
            <span className="font-semibold text-amber-100/90">Scène précédente</span>
            <span className="mt-0.5 block text-white/45">Alt + ← ou ↑</span>
          </TooltipContent>
        </Tooltip>

        <div className="flex min-w-0 flex-1 items-center justify-center gap-1 overflow-x-auto py-0.5 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.12)_transparent]">
          {scenes.map((scene) => (
            <SceneThumbH
              key={scene.id}
              scene={scene}
              active={scene.id === currentScene}
              readOnly={readOnly}
              premiumArenaHostTray={premiumArenaHostTray}
              onClick={() => onChangeScene?.(scene.id)}
            />
          ))}
        </div>

        <Tooltip delayDuration={220}>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={goNext}
              disabled={readOnly || total <= 1}
              className={dockChromeBtnClass(premiumArenaHostTray)}
              title="Scène suivante"
            >
              <ChevronRight className="h-4 w-4 stroke-[1.5]" />
            </button>
          </TooltipTrigger>
          <TooltipContent
            side="top"
            className="max-w-[220px] border border-white/14 bg-[#0c0f16]/97 px-2.5 py-1.5 text-left text-[10px] text-white/75"
          >
            <span className="font-semibold text-amber-100/90">Scène suivante</span>
            <span className="mt-0.5 block text-white/45">Alt + → ou ↓</span>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
