import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import HostMiniPreview from '../HostMiniPreview';
import { CourseMindmapPanel } from './CourseMindmapPanel';
import { MasterScriptBlocksPanel } from './MasterScriptBlocksPanel';
import { ReadAloudScriptPanel } from './ReadAloudScriptPanel';
import { LIRI_HOST_EVENT_CARD, LIRI_HOST_SIDE_COLUMN } from './liriHostUiTheme';
import { cn } from '@/lib/utils';

function AccordionRailSection({ title, open, onToggle, railTitleClass, children }) {
  return (
    <div className={cn(LIRI_HOST_EVENT_CARD, 'flex min-h-0 flex-col overflow-hidden backdrop-blur-sm')}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full shrink-0 items-center justify-between gap-2 px-2.5 py-2 text-left transition-colors hover:bg-white/[0.03]"
      >
        <span className={cn(railTitleClass, 'text-[10px] font-semibold uppercase tracking-[0.12em] text-white/55')}>
          {title}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-[#D4AF37]/75 transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </button>
      {open ? <div className="min-h-0 border-t border-white/[0.06]">{children}</div> : null}
    </div>
  );
}

/**
 * Colonne droite vue hôte verrouillée : flux hôte (héro), mindmap, MasterScript, script à dire.
 */
export function LiriHostGuidanceColumn({
  miniVideoRef,
  miniDisplayParticipant,
  hostParticipant,
  videoBlur,
  videoBeauty,
  videoVbg,
  videoFilterCSS,
  videoChromaKey,
  videoChromaColor,
  videoChromaSens,
  onPipCanvasRef,
  currentUserId,
  zone3PrivilegedSeats,
  immersiveVideoGlass,
  coursePlanSplit,
  slides,
  slideIndex,
  activeScene,
  onPickCoursePlanSlide,
  onGoToSlide,
  scriptSections,
  scriptCurrentSection,
  scriptObjective,
  railTitleClass,
  muted = false,
  cameraOff = false,
  onToggleMuted,
  onToggleCamera,
  onOpenLiveSettings,
  onToggleCinema,
  cinemaMode = false,
}) {
  const selfName = miniDisplayParticipant?.name || hostParticipant?.name || 'Vous';
  const [masterOpen, setMasterOpen] = useState(false);
  const [scriptOpen, setScriptOpen] = useState(false);

  return (
    <div
      className={cn(
        LIRI_HOST_SIDE_COLUMN,
        'gap-2 !pt-[7rem] pb-2 pl-0.5 pr-1 sm:pr-1.5',
      )}
    >
      <div className="relative shrink-0 rounded-xl p-[1px] bg-gradient-to-br from-[#D4AF37]/38 via-violet-500/22 to-[#D4AF37]/18 shadow-[0_0_44px_-14px_rgba(139,92,246,0.32),0_0_52px_-18px_rgba(212,175,55,0.2)]">
        <div className="relative overflow-hidden rounded-[11px] bg-[#0a0d14]/96">
          <div className="pointer-events-none absolute -inset-8 bg-[radial-gradient(circle_at_50%_18%,rgba(212,175,55,0.16),transparent_42%),radial-gradient(circle_at_82%_72%,rgba(139,92,246,0.18),transparent_48%)]" />
          <div className="relative z-[1] p-1.5">
            <p
              className={cn(
                railTitleClass,
                'mb-1.5 px-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#D4AF37]/85',
              )}
            >
              Hôte en direct
            </p>
            <HostMiniPreview
              videoRef={miniVideoRef}
              name={selfName}
              subtitle={miniDisplayParticipant?.panelSubtitle || ''}
              panelLabel={miniDisplayParticipant?.panelLabel || 'Caméra locale'}
              blur={videoBlur}
              beauty={videoBeauty}
              vbg={videoVbg}
              extraFilter={videoFilterCSS}
              chromaKey={videoChromaKey}
              chromaColor={videoChromaColor}
              chromaSens={videoChromaSens}
              embedded
              embeddedSize="hero"
              immersiveGlass={immersiveVideoGlass}
              onPipCanvasRef={onPipCanvasRef}
              showLiveBadge
              arenaHostGoldFrame
              privileged={Boolean(
                currentUserId
                && zone3PrivilegedSeats?.some((s) => String(s.userId) === String(currentUserId)),
              )}
              heroMediaControls={Boolean(onToggleMuted && onToggleCamera)}
              muted={muted}
              cameraOff={cameraOff}
              onHeroToggleMuted={onToggleMuted}
              onHeroToggleCamera={onToggleCamera}
              onHeroOpenSettings={onOpenLiveSettings}
              onHeroLayoutToggle={onToggleCinema}
              heroCinemaActive={cinemaMode}
            />
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden [scrollbar-width:thin]">
        <div className="flex flex-col gap-2 pb-1">
          <CourseMindmapPanel
            coursePlanSplit={coursePlanSplit}
            slides={slides}
            slideIndex={slideIndex}
            activeScene={activeScene}
            onPickCoursePlanSlide={onPickCoursePlanSlide}
            onGoToSlide={onGoToSlide}
            railTitleClass={railTitleClass}
          />

          <AccordionRailSection
            title="MasterScript"
            open={masterOpen}
            onToggle={() => setMasterOpen((v) => !v)}
            railTitleClass={railTitleClass}
          >
            <MasterScriptBlocksPanel
              scriptObjective={scriptObjective}
              scriptSections={scriptSections}
              scriptCurrentSection={scriptCurrentSection}
              railTitleClass={railTitleClass}
              omitTitle
              className="rounded-none border-0 bg-transparent"
            />
          </AccordionRailSection>

          <AccordionRailSection
            title="Script à dire"
            open={scriptOpen}
            onToggle={() => setScriptOpen((v) => !v)}
            railTitleClass={railTitleClass}
          >
            <ReadAloudScriptPanel
              scriptSections={scriptSections}
              railTitleClass={railTitleClass}
              hideTitleLabel
              className="rounded-none border-0 bg-transparent"
            />
          </AccordionRailSection>
        </div>
      </div>
    </div>
  );
}
