import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, Signal, SignalLow, SignalMedium, SignalZero } from 'lucide-react';
import LivePrimaryVideoStage from './LivePrimaryVideoStage';
import HostMiniPreview from './HostMiniPreview';
import { cn } from '@/lib/utils';
import { buildMaquettePlanRibbon, buildMaquetteSceneLineCaption } from '@/lib/liriMobilePlanRibbon';

const MAQUETTE_COURSE_COLLAPSED_KEY = 'liri_maquette_course_collapsed_v1';

function readStoredCourseCollapsed() {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(MAQUETTE_COURSE_COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

function maquetteInitials(name) {
  if (!name || typeof name !== 'string') return '?';
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (p.length >= 2) return `${p[0][0] || ''}${p[p.length - 1][0] || ''}`.toUpperCase() || '?';
  return name.slice(0, 2).toUpperCase();
}

function ConnectionGlyph({ quality, reconnecting }) {
  if (reconnecting) {
    return <SignalZero className="h-3.5 w-3.5 text-amber-400/90 animate-pulse" aria-hidden />;
  }
  const q = quality || 'good';
  if (q === 'lost' || q === 'poor') {
    return <SignalLow className="h-3.5 w-3.5 text-red-400/85" aria-hidden />;
  }
  if (q === 'good') {
    return <SignalMedium className="h-3.5 w-3.5 text-[#c9a962]/90" aria-hidden />;
  }
  return <Signal className="h-3.5 w-3.5 text-amber-400/90" aria-hidden />;
}

function WaveformBars() {
  return (
    <div className="flex h-3.5 items-end gap-0.5" aria-hidden>
      {[0.35, 0.65, 1, 0.55, 0.8].map((h, i) => (
        <span
          key={i}
          className="w-0.5 rounded-full bg-amber-400/80 origin-bottom animate-[liri-wave_0.9s_ease-in-out_infinite]"
          style={{
            height: `${h * 100}%`,
            animationDelay: `${i * 0.08}s`,
          }}
        />
      ))}
    </div>
  );
}

function ParticipantThumb({ name, avatarUrl, className }) {
  return (
    <div
      className={cn(
        'relative flex aspect-[4/5] min-h-0 flex-1 max-w-[48%] flex-col overflow-hidden rounded-xl',
        'border border-[#c9a962]/45 bg-black/40 shadow-[0_0_20px_-8px_rgba(201,169,98,0.45)]',
        className,
      )}
    >
      <div className="flex min-h-0 flex-1 items-center justify-center bg-[#0a0806]">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-full w-full object-cover opacity-95" />
        ) : (
          <span className="font-serif text-2xl font-semibold text-[#c9a962]/75">{maquetteInitials(name)}</span>
        )}
      </div>
      <div className="shrink-0 bg-gradient-to-t from-black/90 to-transparent px-2 py-1.5 pt-4">
        <p className="truncate text-center text-[11px] font-medium text-white/95">{name || 'Membre'}</p>
      </div>
    </div>
  );
}

/**
 * Layout mobile « premium » messagerie live 1:1 : parchemin, carte vidéo haute, bloc cours, scène, vignettes.
 */
export default function LiriMobileMaquetteLayout({
  mainVideoRef,
  mainDisplayParticipant,
  remoteWaiting,
  videoBlur,
  videoBeauty,
  videoVbg,
  videoChromaKey,
  videoChromaColor,
  videoChromaSens,
  pipCanvasRefMain,
  miniVideoRef,
  miniDisplayParticipant,
  hostParticipant,
  pipCanvasRefMini,
  videoFilterCSS,
  compositorSlide,
  slideIndex,
  totalSlides,
  /** { native: { slides, index }, import: { slides, index } } — compteur plan = rail SmartBoard natif */
  coursePlanSplit = null,
  activeScene,
  scriptSections = [],
  scriptCurrentSection = null,
  promotedParticipantId,
  zone3PrivilegedSeats,
  currentUserId,
  connectionQuality,
  isReconnecting,
  onSwapVideoLayout,
  slideAreaRef,
  /** true = uniquement le SmartBoard (geste bord bas → plein cadre), sans vidéo / script / messagerie inline */
  smartboardFull = false,
  smartBoardChildren,
  messageDrawer,
  /** Hôte : journal arena / LONGIA (scroll ciblé par `LIRI_HOST_EXPAND_NOTIFICATIONS_EVENT`) */
  hostNotificationsRail = null,
}) {
  const remoteName = mainDisplayParticipant?.name || 'Interlocuteur';
  const selfName = miniDisplayParticipant?.name || hostParticipant?.name || 'Vous';
  /**
   * Sous la vidéo : en scène diapo → rail import + libellé « Plan diaporama » ;
   * sinon → rail SmartBoard natif + « Plan cours ». Sans slides dans le rail actif → repli compteur global.
   */
  const planRibbon = useMemo(
    () => buildMaquettePlanRibbon({
      activeScene,
      coursePlanSplit,
      slideIndex,
      totalSlides,
    }),
    [activeScene, coursePlanSplit, slideIndex, totalSlides],
  );

  const sceneLineCaption = useMemo(
    () => buildMaquetteSceneLineCaption({
      activeScene,
      compositorSlide,
      scriptCurrentSection,
    }),
    [activeScene, compositorSlide, scriptCurrentSection],
  );

  const courseTitle = useMemo(() => {
    const t =
      compositorSlide?.title
      || scriptCurrentSection?.title
      || scriptCurrentSection?.slide_title
      || compositorSlide?.slide_title;
    return t || 'Cours en direct';
  }, [compositorSlide, scriptCurrentSection]);

  const quoteLine = useMemo(() => {
    const raw = scriptCurrentSection?.content || scriptSections[0]?.content || '';
    const s = String(raw).trim();
    if (!s) return null;
    const one = s.split(/\n+/).map((x) => x.trim()).filter(Boolean)[0];
    if (!one) return null;
    const short = one.length > 160 ? `${one.slice(0, 157)}…` : one;
    return short;
  }, [scriptCurrentSection, scriptSections]);

  const numberedBlocks = useMemo(() => {
    const src = scriptSections.length > 0 ? scriptSections : [];
    if (src.length === 0) {
      return [
        {
          title: 'Contenu du cours',
          body:
            compositorSlide?.notes
            || compositorSlide?.subtitle
            || 'Le détail du cours s\'affiche ici lorsque le script ou les notes de diapositive sont renseignés.',
        },
      ];
    }
    return src.slice(0, 5).map((sec) => ({
      title: sec.title || sec.slide_title || 'Point',
      body: (sec.ai_content || sec.content || '').trim() || '—',
    }));
  }, [scriptSections, compositorSlide]);

  const remotePrivileged = Boolean(
    promotedParticipantId
    && zone3PrivilegedSeats?.some((s) => String(s.userId) === String(promotedParticipantId)),
  );
  const selfPrivileged = Boolean(
    currentUserId
    && zone3PrivilegedSeats?.some((s) => String(s.userId) === String(currentUserId)),
  );

  const remoteAvatar =
    mainDisplayParticipant?.avatar_url
    || mainDisplayParticipant?.avatarUrl
    || null;

  const [courseCollapsed, setCourseCollapsed] = useState(readStoredCourseCollapsed);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(MAQUETTE_COURSE_COLLAPSED_KEY, courseCollapsed ? '1' : '0');
    } catch {
      // ignore quota / private mode
    }
  }, [courseCollapsed]);

  if (smartboardFull) {
    return (
      <div
        className={cn(
          'absolute inset-0 z-[5] flex min-h-0 flex-col overflow-hidden bg-[#0a0806]',
          'pb-[env(safe-area-inset-bottom)]',
        )}
      >
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-1.5 border-r border-[#c9a962]/12 bg-gradient-to-b from-[#c9a962]/10 via-transparent to-[#c9a962]/6"
          aria-hidden
        />
        <motion.div
          key={`maquette-full-${activeScene}-${slideIndex}`}
          initial={{ opacity: 0.94 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          ref={slideAreaRef}
          className="relative z-[1] min-h-0 flex-1 overflow-hidden"
        >
          {smartBoardChildren}
        </motion.div>
        {hostNotificationsRail ? (
          <div className="relative z-[2] max-h-[min(32vh,280px)] shrink-0 overflow-y-auto overflow-x-hidden border-t border-[#c9a962]/25 bg-black/55 px-2 py-2 [scrollbar-width:thin]">
            {hostNotificationsRail}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'absolute inset-x-0 top-0 bottom-0 z-[5] flex min-h-0 h-full min-w-0 flex-col overflow-hidden',
        'bg-[#100d0a]',
        'pb-[max(0.25rem,env(safe-area-inset-bottom))]',
      )}
    >
      <style>
        {`
          @keyframes liri-wave {
            0%, 100% { transform: scaleY(0.35); opacity: 0.65; }
            50% { transform: scaleY(1); opacity: 1; }
          }
        `}
      </style>
      {/* Fond parchemin + filigrane bord gauche */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.97]"
        aria-hidden
        style={{
          background: `
            linear-gradient(180deg, rgba(28,22,18,0.92) 0%, rgba(14,11,9,0.98) 45%, rgba(8,6,5,1) 100%),
            radial-gradient(ellipse 120% 80% at 50% 0%, rgba(201,169,98,0.07) 0%, transparent 55%)
          `,
        }}
      />
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-2 border-r border-[#c9a962]/15 bg-gradient-to-b from-[#c9a962]/12 via-transparent to-[#c9a962]/8"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.045]"
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")',
        }}
        aria-hidden
      />

      <div className="relative z-[1] flex min-h-0 flex-1 flex-col gap-2 px-3 pt-2">
        {/* Carte vidéo principale */}
        <div className="relative shrink-0 overflow-hidden rounded-2xl border border-[#c9a962]/40 shadow-[0_0_28px_-10px_rgba(201,169,98,0.5)]">
          <div className="aspect-[16/10] max-h-[min(38vh,220px)] w-full min-h-[120px] bg-black/50">
            <LivePrimaryVideoStage
              videoRef={mainVideoRef}
              title={remoteName}
              subtitle={mainDisplayParticipant?.panelSubtitle || ''}
              panelLabel={mainDisplayParticipant?.panelLabel || 'Flux entrant'}
              blur={videoBlur}
              beauty={videoBeauty}
              vbg={videoVbg}
              chromaKey={videoChromaKey}
              chromaColor={videoChromaColor}
              chromaSens={videoChromaSens}
              immersiveGlass
              onPipCanvasRef={pipCanvasRefMain}
              waiting={remoteWaiting}
              waitingName={remoteName}
              privileged={remotePrivileged}
              onClick={onSwapVideoLayout}
              clickable={Boolean(onSwapVideoLayout)}
            />
          </div>
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 bg-gradient-to-b from-black/75 via-black/25 to-transparent px-3 py-2 pt-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate font-serif text-sm font-semibold text-white drop-shadow-md">{remoteName}</span>
              <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white bg-red-600/95 shadow-sm">
                • Live
              </span>
            </div>
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/80 via-black/35 to-transparent px-3 py-2">
            <div className="flex items-center gap-2 text-[10px] font-medium text-white/90">
              <span className="text-amber-400">●</span>
              <span>En direct</span>
              {!remoteWaiting ? <WaveformBars /> : null}
            </div>
            <div className="flex flex-col items-end gap-0.5 text-right">
              <span className="text-[8px] font-semibold uppercase tracking-[0.14em] text-[#c9a962]/80">
                {planRibbon.label}
              </span>
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    'text-[10px] tabular-nums text-[#c9a962]/95',
                    planRibbon.empty && 'text-[#c9a962]/55',
                  )}
                  title={planRibbon.title}
                >
                  {planRibbon.human}
                </span>
                <ConnectionGlyph quality={connectionQuality} reconnecting={isReconnecting} />
              </div>
            </div>
          </div>
        </div>

        {/* Bloc cours + SmartBoard : en-tête « Cours » repliable pour agrandir le plateau */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[#c9a962]/20 bg-black/25 shadow-inner">
          <div
            className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch] [scrollbar-width:thin] touch-pan-y"
            style={{ overscrollBehaviorY: 'contain' }}
          >
            <div className="border-b border-[#c9a962]/15">
              <button
                type="button"
                onClick={() => setCourseCollapsed((c) => !c)}
                aria-expanded={!courseCollapsed}
                aria-label={
                  courseCollapsed
                    ? 'Déplier le script et les points du cours'
                    : 'Replier le script pour agrandir le SmartBoard'
                }
                data-liri-no-doubletap
                className="flex w-full items-start gap-2 px-3 py-2.5 text-left transition-colors hover:bg-[#c9a962]/[0.06] active:bg-[#c9a962]/10"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-center font-serif text-[11px] tracking-[0.2em] text-[#c9a962]/70">— Cours —</p>
                  <h2
                    className={cn(
                      'mt-0.5 text-center font-serif font-bold leading-tight text-[#e8d4a8]',
                      courseCollapsed ? 'line-clamp-2 text-sm' : 'text-[1.35rem]',
                    )}
                  >
                    {courseTitle}
                  </h2>
                </div>
                <ChevronDown
                  className={cn(
                    'mt-1 h-5 w-5 shrink-0 text-[#c9a962]/75 transition-transform duration-200',
                    !courseCollapsed && 'rotate-180',
                  )}
                  aria-hidden
                />
              </button>
              {!courseCollapsed ? (
                <div className="space-y-2 px-3 pb-3 pt-0">
                  {quoteLine ? (
                    <p className="text-center font-serif text-[13px] italic leading-snug text-[#c9a962]/85">
                      &ldquo;{quoteLine}&rdquo;
                    </p>
                  ) : null}
                  <ol className="mt-1 space-y-2.5 text-[13px] leading-relaxed text-[#d8c9a8]/92">
                    {numberedBlocks.map((block, idx) => (
                      <li key={idx} className="list-decimal pl-1 marker:text-[#c9a962]/80">
                        <span className="font-semibold text-[#f0e6cc]">{block.title}</span>
                        <span className="block pt-0.5 font-normal text-[#d8c9a8]/88 whitespace-pre-wrap">
                          {block.body.length > 280 ? `${block.body.slice(0, 277)}…` : block.body}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}
            </div>

            <motion.div
              key={`maquette-${activeScene}-${slideIndex}`}
              initial={{ opacity: 0.9, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              ref={slideAreaRef}
              className={cn(
                'relative w-full overflow-hidden',
                courseCollapsed ? 'min-h-[min(52vh,380px)]' : 'min-h-[min(42vh,300px)]',
              )}
            >
              {smartBoardChildren}
            </motion.div>
          </div>
        </div>

        {/* Ligne scène (titre de diapo en priorité) */}
        <div className="shrink-0 border-t border-[#c9a962]/20 pt-1.5 text-center">
          <p className="line-clamp-2 px-1 font-serif text-[11px] leading-snug tracking-wide text-[#c9a962]/90">
            <span
              className={cn('tabular-nums', planRibbon.empty && 'text-[#c9a962]/70')}
              title={planRibbon.title}
            >
              {planRibbon.human}
            </span>
            <span className="text-[#c9a962]/50"> • </span>
            <span className="break-words">{sceneLineCaption}</span>
          </p>
        </div>

        {/* Vignettes + messagerie */}
        <div className="flex shrink-0 flex-col gap-2">
          <div className="flex min-h-[88px] flex-1 gap-2">
            <ParticipantThumb name={remoteName} avatarUrl={remoteAvatar} />
            <div
              className={cn(
                'relative flex min-h-0 flex-1 max-w-[48%] flex-col overflow-hidden rounded-xl',
                'border border-[#c9a962]/45 bg-black/40 shadow-[0_0_20px_-8px_rgba(201,169,98,0.45)]',
              )}
            >
              <div className="flex min-h-[104px] flex-1 items-stretch justify-center overflow-hidden py-1">
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
                  immersiveGlass
                  onPipCanvasRef={pipCanvasRefMini}
                  privileged={selfPrivileged}
                />
              </div>
            </div>
          </div>
          {messageDrawer}
          {hostNotificationsRail ? (
            <div className="max-h-[min(36vh,320px)] min-h-0 shrink-0 overflow-y-auto overflow-x-hidden rounded-xl border border-[#c9a962]/28 bg-black/40 px-1.5 py-1.5 [scrollbar-width:thin]">
              {hostNotificationsRail}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
