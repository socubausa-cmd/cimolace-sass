import React, { useMemo } from 'react';
import LiriMobileMaquetteLayout from '@/components/liri/live-room/LiriMobileMaquetteLayout';
import { cn } from '@/lib/utils';

/** `LiriMobileMaquetteLayout` / `LivePrimaryVideoStage` attendent un callback, comme l'Arène — pas un objet ref seul. */
function pipRefToCallback(ref) {
  if (ref == null) return undefined;
  if (typeof ref === 'function') return ref;
  return (el) => {
    const r = ref;
    if (r && typeof r === 'object' && 'current' in r) {
      r.current = el;
    }
  };
}

/**
 * Bloc hôte : maquette LIRI mobile (parité Arène) + barre d'action minimale + pied de scène.
 */
export default function LiveHostLiriMobileColumn({
  onStop,
  stopLiveBusy = false,
  onlineMemberCount = 0,
  /** Intitulé hôte (libellé « Vous » / script) */
  hostDisplayName = 'Hôte',
  mainVideoRef,
  miniVideoRef,
  pipCanvasRefMain,
  pipCanvasRefMini,
  mainDisplayParticipant,
  miniDisplayParticipant,
  remoteWaiting = false,
  videoBlur = false,
  videoBeauty = false,
  videoVbg = 'none',
  videoChromaKey = false,
  videoChromaColor = '#00ff00',
  videoChromaSens = 0.35,
  videoFilterCSS = '',
  compositorSlide = null,
  slideIndex = 0,
  totalSlides = 1,
  coursePlanSplit = null,
  activeScene = 'smartboard',
  scriptSections = [],
  scriptCurrentSection = null,
  promotedParticipantId = null,
  zone3PrivilegedSeats = [],
  currentUserId = null,
  connectionQuality = 'good',
  isReconnecting = false,
  onSwapVideoLayout = undefined,
  slideAreaRef = undefined,
  smartboardFull = false,
  hostNotificationsRail = null,
  messageDrawer = null,
  /** Contenu zone SmartBoard (même nœud que le mode grille classique) */
  smartBoardSlot = null,
  /** Pied (LiveHostArenaLiveBar, etc.) */
  footerSlot = null,
}) {
  const onPipCanvasMain = useMemo(
    () => pipRefToCallback(pipCanvasRefMain),
    [pipCanvasRefMain],
  );
  const onPipCanvasMini = useMemo(
    () => pipRefToCallback(pipCanvasRefMini),
    [pipCanvasRefMini],
  );
  return (
    <div
      className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden"
      data-testid="live-host-liri-maquette-column"
    >
      <div
        className={cn(
          'flex shrink-0 items-center justify-between gap-2 border-b border-white/10',
          'bg-gradient-to-b from-[#0f0d0a] to-[#0a0806] px-2 py-1.5',
        )}
      >
        <div className="min-w-0 text-[9px] font-bold uppercase tracking-wider text-[#c9a962]/80">
          Maquette LIRI
        </div>
        <div className="flex items-center gap-2">
          <div className="text-center">
            <div className="text-[16px] font-bold leading-none text-[#C8960C]">{onlineMemberCount}</div>
            <div className="text-[6px] font-semibold text-white/40">EN LIGNE</div>
          </div>
          <button
            type="button"
            data-testid="live-host-stop-maquette"
            disabled={stopLiveBusy}
            onClick={() => (typeof onStop === 'function' ? onStop() : undefined)}
            className="shrink-0 rounded-md bg-gradient-to-br from-[#c63b3b] to-[#9b2222] px-2.5 py-1 text-[9px] font-extrabold text-white"
          >
            STOP
          </button>
        </div>
      </div>
      <div className="relative h-full min-h-0 w-full min-w-0 flex-1 overflow-hidden">
        <LiriMobileMaquetteLayout
          mainVideoRef={mainVideoRef}
          mainDisplayParticipant={mainDisplayParticipant}
          remoteWaiting={remoteWaiting}
          videoBlur={videoBlur}
          videoBeauty={videoBeauty}
          videoVbg={videoVbg}
          videoChromaKey={videoChromaKey}
          videoChromaColor={videoChromaColor}
          videoChromaSens={videoChromaSens}
          pipCanvasRefMain={onPipCanvasMain}
          miniVideoRef={miniVideoRef}
          miniDisplayParticipant={miniDisplayParticipant}
          hostParticipant={{ name: hostDisplayName }}
          pipCanvasRefMini={onPipCanvasMini}
          videoFilterCSS={videoFilterCSS}
          compositorSlide={compositorSlide}
          slideIndex={slideIndex}
          totalSlides={totalSlides}
          coursePlanSplit={coursePlanSplit}
          activeScene={activeScene}
          scriptSections={scriptSections}
          scriptCurrentSection={scriptCurrentSection}
          promotedParticipantId={promotedParticipantId}
          zone3PrivilegedSeats={zone3PrivilegedSeats}
          currentUserId={currentUserId}
          connectionQuality={connectionQuality}
          isReconnecting={isReconnecting}
          onSwapVideoLayout={onSwapVideoLayout}
          slideAreaRef={slideAreaRef}
          smartboardFull={smartboardFull}
          smartBoardChildren={smartBoardSlot}
          hostNotificationsRail={hostNotificationsRail}
          messageDrawer={messageDrawer}
        />
      </div>
      {footerSlot ? <div className="w-full shrink-0">{footerSlot}</div> : null}
    </div>
  );
}
