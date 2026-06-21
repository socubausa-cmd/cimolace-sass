import React, { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Slider } from '@/components/ui/slider';
import { formatSecondsToTimeText, getActiveSegmentIndex, parseTimestampToSeconds } from './segmentUtils';
import CourseSmartboardPanel from './CourseSmartboardPanel';
import SmartboardRichSlide from './SmartboardRichSlide';
import { buildDeckFromMindmap, cardToSlideProps } from '@/lib/smartboard/buildDeckFromMindmap';
import { Play, ChevronRight, ChevronLeft, Image as ImageIcon, Loader2 } from 'lucide-react';

export default function SplitScreenCoursePreview({
  videoUrl,
  videoRef,
  /** Styles additionnels sur la balise `<video>` (ex. `filter` NLE) */
  videoStyle = undefined,
  currentTime = 0,
  duration = 0,
  onSeek,
  segments = [],
  aiMap = {},
  mode = 'pedagogical',
  aiStatusText = '',
  activeChapterIdx,
  onSelectChapter,
  /**
   * Mindmap (arbre de cartes taggées `chapterIndex`). Si fourni → mode DECK :
   * « carte = slide, chapitre = section ». La même carte sert le slide SmartBoard
   * ET le nœud de révision (source unique). Absent → ancien rendu 1 chapitre = 1 slide.
   */
  mindmap = null,
  /** Génère l'illustration IA d'une carte (à la demande). Reçoit la carte. */
  onGenerateCardImage = null,
  /** Id de la carte en cours de génération (ou 'all'), pour l'état de chargement. */
  cardImageLoadingId = null,
}) {
  const activeIndex = useMemo(() => getActiveSegmentIndex(segments, currentTime), [segments, currentTime]);

  const resolvedActiveIndex = activeChapterIdx != null ? activeChapterIdx : activeIndex;

  const activeSegment = useMemo(() => {
    if (resolvedActiveIndex == null) return null;
    const row = segments[resolvedActiveIndex];
    if (!row) return null;
    const start = parseTimestampToSeconds(row?.startText);
    const end = parseTimestampToSeconds(row?.endText);
    return {
      ...row,
      index: resolvedActiveIndex,
      startSeconds: Number.isFinite(start) ? start : null,
      endSeconds: Number.isFinite(end) ? end : null,
    };
  }, [resolvedActiveIndex, segments]);

  const activeAi = resolvedActiveIndex != null ? aiMap[String(resolvedActiveIndex)] || null : null;

  // ── Mode DECK : construit les sections (chapitres) → slides (cartes) ──────────
  const deck = useMemo(() => {
    if (!mindmap) return null;
    const chapters = (segments || []).map((s) => ({
      label: s?.label,
      startSeconds: parseTimestampToSeconds(s?.startText),
      endSeconds: parseTimestampToSeconds(s?.endText),
    }));
    const built = buildDeckFromMindmap(mindmap, chapters);
    return built.totalSlides > 0 ? built : null;
  }, [mindmap, segments]);

  const activeSection = deck && resolvedActiveIndex != null ? deck.sections[resolvedActiveIndex] : null;
  const cards = activeSection?.slides || [];
  const deckMode = cards.length > 0;
  const hasTimes = useMemo(() => cards.some((c) => Number.isFinite(Number(c?.timeSeconds))), [cards]);

  // Index du slide affiché. Deux « écrivains » : la lecture vidéo (effet ci-dessous)
  // et la navigation manuelle (goToSlide). Le dernier qui écrit gagne → la nav
  // fonctionne même quand la vidéo n'est pas (encore) chargée.
  const [slideIndex, setSlideIndex] = useState(0);
  useEffect(() => { setSlideIndex(0); }, [resolvedActiveIndex]);

  // Carte que le TEMPS vidéo rend active (cartes horodatées).
  const timeActiveSlide = useMemo(() => {
    if (!deckMode || !hasTimes) return 0;
    let idx = 0;
    for (let i = 0; i < cards.length; i += 1) {
      const t = Number(cards[i]?.timeSeconds);
      if (Number.isFinite(t) && currentTime + 0.25 >= t) idx = i;
    }
    return idx;
  }, [deckMode, hasTimes, cards, currentTime]);

  // La vidéo pilote le slide quand le temps franchit une frontière de carte.
  useEffect(() => {
    if (deckMode && hasTimes) setSlideIndex(timeActiveSlide);
  }, [deckMode, hasTimes, timeActiveSlide]);

  const effectiveSlide = deckMode ? Math.min(slideIndex, Math.max(0, cards.length - 1)) : 0;
  const currentCard = deckMode ? cards[effectiveSlide] : null;
  const nextCardTime = deckMode
    ? (cards[effectiveSlide + 1] ? cards[effectiveSlide + 1].timeSeconds : (activeSection?.endSeconds ?? null))
    : null;
  const cardSlideProps = currentCard ? cardToSlideProps(currentCard, effectiveSlide, nextCardTime) : null;

  const goToSlide = (i) => {
    const idx = Math.max(0, Math.min(cards.length - 1, i));
    setSlideIndex(idx); // visuel immédiat (indépendant de l'état de la vidéo)
    const t = Number(cards[idx]?.timeSeconds);
    if (hasTimes && Number.isFinite(t)) onSeek?.(t); // synchronise la vidéo si elle est chargée
  };

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0b1220] overflow-hidden">
      {/* Main split: video | SmartBoard */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-0 xl:gap-0 min-h-[420px]">
        {/* Left — Video */}
        <div className="relative bg-black flex flex-col">
          {videoUrl ? (
            <video
              ref={videoRef}
              src={videoUrl}
              className="w-full flex-1 object-contain"
              style={{ aspectRatio: '16/9', ...(videoStyle || {}) }}
              controls
            />
          ) : (
            <div className="flex-1 aspect-video flex items-center justify-center text-sm text-gray-500">
              <div className="text-center">
                <Play className="w-10 h-10 mx-auto mb-2 opacity-20" />
                <span>URL vidéo manquante</span>
              </div>
            </div>
          )}

          {/* Video progress bar (custom, under video) */}
          <div className="px-3 py-2 bg-black/60 border-t border-white/5 space-y-1 touch-none">
            <div className="flex items-center justify-between text-[11px] text-gray-400">
              <span className="font-mono">{formatSecondsToTimeText(currentTime)}</span>
              <span className="font-mono">{formatSecondsToTimeText(duration)}</span>
            </div>
            <Slider
              value={[progressPct]}
              max={100}
              step={0.1}
              onValueChange={(values) => {
                const pct = Array.isArray(values) ? Number(values[0]) : 0;
                const next = duration > 0 ? (pct / 100) * duration : 0;
                onSeek?.(next);
              }}
              className="h-1.5"
            />
          </div>
        </div>

        {/* Right — SmartBoard (Gamma-like slide) */}
        <div className="relative border-l border-white/5 bg-[#090e1a] min-h-[360px] flex flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto">
            {deckMode ? (
              <SmartboardRichSlide
                card={currentCard}
                slide={currentCard?.slideContent}
                density="full"
                chapterNum={effectiveSlide + 1}
                time={currentCard?.time}
              />
            ) : (
              <CourseSmartboardPanel
                segment={activeSegment}
                aiContent={activeAi}
                mode={mode}
                statusText={aiStatusText}
              />
            )}
          </div>

          {/* Génération d'image à la demande pour la carte active (overlay élève) */}
          {deckMode && onGenerateCardImage ? (
            <div className="shrink-0 border-t border-white/10 bg-black/20 px-3 py-1.5 flex items-center justify-between gap-2">
              <span className="text-[10px] text-gray-500">
                {currentCard?.illustrationUrl ? 'Illustration générée' : "Pas encore d'illustration"}
              </span>
              <button
                type="button"
                onClick={() => onGenerateCardImage(currentCard)}
                disabled={!!cardImageLoadingId}
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg border border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] text-[var(--school-accent)] text-[11px] font-semibold hover:bg-[color-mix(in_srgb,var(--school-accent)_18%,transparent)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {cardImageLoadingId === currentCard?.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
                {currentCard?.illustrationUrl ? "Régénérer l'image" : "Générer l'image"}
              </button>
            </div>
          ) : null}

          {/* Per-card slide navigation (deck mode) — carte = slide DANS la section */}
          {deckMode && cards.length > 1 && (
            <div className="shrink-0 border-t border-white/10 bg-black/30 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => goToSlide(effectiveSlide - 1)}
                  disabled={effectiveSlide <= 0}
                  className="shrink-0 w-7 h-7 rounded-lg border border-white/10 bg-white/5 text-gray-300 flex items-center justify-center hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Carte précédente"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="flex-1 flex items-center justify-center gap-1.5 overflow-x-auto scrollbar-hide">
                  {cards.map((c, i) => {
                    const isOn = i === effectiveSlide;
                    return (
                      <button
                        key={c.id || i}
                        type="button"
                        onClick={() => goToSlide(i)}
                        title={c.label || `Carte ${i + 1}`}
                        className={`shrink-0 rounded-full transition-all ${
                          isOn
                            ? 'w-5 h-2 bg-[var(--school-accent)]'
                            : 'w-2 h-2 bg-white/20 hover:bg-white/40'
                        }`}
                        aria-label={`Aller à la carte ${i + 1}`}
                      />
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => goToSlide(effectiveSlide + 1)}
                  disabled={effectiveSlide >= cards.length - 1}
                  className="shrink-0 w-7 h-7 rounded-lg border border-white/10 bg-white/5 text-gray-300 flex items-center justify-center hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Carte suivante"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[10px] text-gray-500 text-center mt-1.5 truncate px-2">
                {currentCard?.label || ''}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Chapter navigation rail */}
      {segments.length > 0 && (
        <div className="border-t border-white/10 bg-[#070d18] px-3 py-3">
          <p className="text-[10px] uppercase tracking-widest text-gray-600 font-semibold mb-2 px-1">
            {deck ? 'Sections (chapitres) — navigation' : 'Chapitres — navigation'}
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {segments.map((seg, idx) => {
              const isActive = idx === resolvedActiveIndex;
              const start = parseTimestampToSeconds(seg?.startText);
              const end = parseTimestampToSeconds(seg?.endText);
              const hasAi = Boolean(aiMap[String(idx)]);
              const cardCount = deck?.sections?.[idx]?.slides?.length || 0;
              const label = String(seg?.label || '').trim() || `Chapitre ${idx + 1}`;

              // Calculate chapter progress
              let chPct = 0;
              if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
                chPct = Math.max(0, Math.min(100, ((currentTime - start) / (end - start)) * 100));
              }

              return (
                <motion.button
                  key={idx}
                  type="button"
                  onClick={() => onSelectChapter?.(idx)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  className={`relative shrink-0 rounded-xl border px-3 py-2.5 text-left transition-all min-w-[140px] max-w-[200px] ${
                    isActive
                      ? 'border-[color-mix(in_srgb,var(--school-accent)_50%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] shadow-[0_0_16px_rgba(212,175,55,0.15)]'
                      : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8'
                  }`}
                >
                  {/* Chapter number */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center ${
                      isActive ? 'bg-[var(--school-accent)] text-black' : 'bg-white/10 text-gray-400'
                    }`}>
                      {idx + 1}
                    </span>
                    {cardCount > 0 ? (
                      <span className="text-[9px] text-[color-mix(in_srgb,var(--school-accent)_70%,transparent)] font-semibold uppercase tracking-wider">
                        {cardCount} carte{cardCount > 1 ? 's' : ''}
                      </span>
                    ) : hasAi && (
                      <span className="text-[9px] text-[color-mix(in_srgb,var(--school-accent)_70%,transparent)] font-semibold uppercase tracking-wider">IA</span>
                    )}
                  </div>

                  {/* Label */}
                  <p className={`text-xs font-medium truncate leading-tight ${isActive ? 'text-white' : 'text-gray-400'}`}>
                    {label}
                  </p>

                  {/* Timecodes */}
                  <p className="text-[10px] text-gray-600 mt-0.5 font-mono">
                    {Number.isFinite(start) ? formatSecondsToTimeText(start) : '--'}
                    {Number.isFinite(end) ? ` → ${formatSecondsToTimeText(end)}` : ''}
                  </p>

                  {/* Chapter progress bar (only for active) */}
                  {isActive && Number.isFinite(start) && Number.isFinite(end) && end > start && (
                    <div className="mt-2 h-1 rounded-full bg-white/10 overflow-hidden">
                      <motion.div
                        className="h-full bg-[var(--school-accent)] rounded-full"
                        style={{ width: `${chPct}%` }}
                        transition={{ duration: 0.1 }}
                      />
                    </div>
                  )}

                  {isActive && (
                    <ChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[color-mix(in_srgb,var(--school-accent)_60%,transparent)]" />
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
