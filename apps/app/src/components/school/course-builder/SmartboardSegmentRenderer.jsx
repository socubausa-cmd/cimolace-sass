import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, BookOpen, Lightbulb, Target } from 'lucide-react';
import SmartboardCanvasImage from '@/components/media/SmartboardCanvasImage';

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    return value
      .split('\n')
      .map((line) => line.replace(/^\s*[-*•]\s*/, '').trim())
      .filter(Boolean);
  }
  return [];
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Gamma-like full-screen slide component
function GammaSlide({ segment, ai, mode, illustrationUrl, unitLabel = 'Chapitre' }) {
  const chapterTitle = String(ai?.chapter_title || segment?.label || 'Chapitre').trim();
  const subtitle = String(ai?.subtitle || '').trim();
  const summary =
    mode === 'reformulation'
      ? String(ai?.reformulation_text || ai?.summary_text || '').trim()
      : String(ai?.summary_text || ai?.reformulation_text || '').trim();
  const retention = String(ai?.retention_text || '').trim();
  const keyPoints = toArray(ai?.key_points_json).slice(0, 5);
  const chapterNum = (segment?.index ?? 0) + 1;
  const hasContent = summary || keyPoints.length > 0 || retention;

  // Pick a gradient based on chapter index for variety
  const gradients = [
    'from-[#0a0f1e] via-[#0d1a2e] to-[#091520]',
    'from-[#0f0a1e] via-[#1a0d2e] to-[#120915]',
    'from-[#0a1a0f] via-[#0d2e1a] to-[#091520]',
    'from-[#1a0a0f] via-[#2e0d1a] to-[#200912]',
    'from-[#0a151a] via-[#0d202e] to-[#091520]',
  ];
  const accentColors = [
    { ring: 'ring-blue-500/30', glow: 'from-blue-500/15', text: 'text-blue-300', bg: 'bg-blue-500/10 border-blue-500/20' },
    { ring: 'ring-purple-500/30', glow: 'from-purple-500/15', text: 'text-purple-300', bg: 'bg-purple-500/10 border-purple-500/20' },
    { ring: 'ring-emerald-500/30', glow: 'from-emerald-500/15', text: 'text-emerald-300', bg: 'bg-emerald-500/10 border-emerald-500/20' },
    { ring: 'ring-rose-500/30', glow: 'from-rose-500/15', text: 'text-rose-300', bg: 'bg-rose-500/10 border-rose-500/20' },
    { ring: 'ring-amber-500/30', glow: 'from-amber-500/15', text: 'text-amber-300', bg: 'bg-amber-500/10 border-amber-500/20' },
  ];
  const gradIdx = (segment?.index ?? 0) % gradients.length;
  const accentIdx = (segment?.index ?? 0) % accentColors.length;
  const grad = gradients[gradIdx];
  const accent = accentColors[accentIdx];

  return (
    <div className={`relative h-full w-full rounded-2xl overflow-hidden bg-gradient-to-br ${grad} flex flex-col`}>
      {/* Illustration background (blurred, 30% opacity) */}
      {illustrationUrl && (
        <div className="absolute inset-0 pointer-events-none">
          <SmartboardCanvasImage
            src={illustrationUrl}
            alt=""
            className="w-full h-full object-cover"
            style={{ opacity: 0.18, filter: 'blur(6px) brightness(0.6)' }}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
          <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/50 to-black/70" />
        </div>
      )}

      {/* Ambient glow orbs */}
      <div className={`absolute top-0 right-0 w-64 h-64 rounded-full bg-gradient-radial ${accent.glow} to-transparent blur-3xl opacity-60 pointer-events-none`} />
      <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-gradient-radial from-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] to-transparent blur-3xl opacity-40 pointer-events-none" />

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '40px 40px' }}
      />

      <div className="relative z-10 flex flex-col h-full p-6 gap-4">
        {/* Top bar: chapter badge + time */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full border text-xs font-semibold ${accent.bg} ${accent.text}`}>
              <Sparkles className="w-3 h-3" />
              {unitLabel} {chapterNum}
            </span>
            {mode === 'masterclass' && (
              <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-[color-mix(in_srgb,var(--school-accent)_15%,transparent)] border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] text-[var(--school-accent)] text-[10px] font-semibold">
                <Target className="w-3 h-3" /> Masterclass
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500 font-mono">
            {formatTime(segment?.startSeconds)} → {formatTime(segment?.endSeconds)}
          </div>
        </div>

        {/* Title block */}
        <AnimatePresence mode="wait">
          <motion.div
            key={chapterTitle}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-1.5"
          >
            <h2 className="text-2xl md:text-3xl font-bold text-white leading-tight tracking-tight">
              {chapterTitle}
            </h2>
            {subtitle && (
              <p className={`text-sm font-medium ${accent.text} opacity-90`}>{subtitle}</p>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Content area */}
        {!hasContent ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 opacity-40">
            <BookOpen className="w-10 h-10 text-gray-400" />
            <p className="text-sm text-gray-400 text-center max-w-[200px]">
              Génère le contenu IA pour enrichir ce segment
            </p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-3 overflow-hidden">
            {/* Summary */}
            {summary && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.35 }}
                className="rounded-xl bg-white/5 border border-white/10 p-4"
              >
                <div className="flex items-start gap-2">
                  <BookOpen className={`w-4 h-4 ${accent.text} mt-0.5 shrink-0`} />
                  <p className="text-sm text-gray-200 leading-relaxed">{summary}</p>
                </div>
              </motion.div>
            )}

            {/* Key points */}
            {keyPoints.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.35 }}
                className="space-y-1.5"
              >
                <p className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold flex items-center gap-1.5">
                  <Lightbulb className="w-3 h-3" /> Points clés
                </p>
                <div className="grid grid-cols-1 gap-1.5">
                  {keyPoints.map((point, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.25 + i * 0.06, duration: 0.3 }}
                      className={`flex items-start gap-2.5 rounded-lg border px-3 py-2 ${accent.bg}`}
                    >
                      <span className={`text-xs font-bold ${accent.text} mt-0.5 shrink-0 w-4`}>{i + 1}.</span>
                      <span className="text-xs text-gray-200 leading-snug">{point}</span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Retention quote */}
            {retention && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.35 }}
                className="mt-auto rounded-xl border border-[color-mix(in_srgb,var(--school-accent)_25%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_8%,transparent)] p-3"
              >
                <p className="text-[10px] uppercase tracking-widest text-[color-mix(in_srgb,var(--school-accent)_70%,transparent)] font-semibold mb-1">À retenir</p>
                <p className="text-sm text-[var(--school-accent)] font-medium italic leading-snug">"{retention}"</p>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SmartboardSegmentRenderer({ segment, aiContent, mode = 'pedagogical', className = '', unitLabel = 'Chapitre' }) {
  // If there's a fully structured slide_content_json from AI, keep using the parallax stage for it
  const hasCustomSlide = useMemo(() => {
    const raw = aiContent?.slide_content_json;
    return raw && typeof raw === 'object' && Array.isArray(raw.elements) && raw.elements.length > 0;
  }, [aiContent]);

  if (hasCustomSlide) {
    // Dynamic import kept working by lazy-importing SlideParallaxStage only when needed
    const SlideParallaxStage = React.lazy(() => import('@/components/liri/live-room/SlideParallaxStage'));
    const slide = {
      id: aiContent.slide_content_json.id || `seg-${segment?.index ?? 'x'}`,
      title: aiContent.slide_content_json.title || String(aiContent?.chapter_title || segment?.label || ''),
      styleVariant: aiContent.slide_content_json.styleVariant || 'premium-dark',
      layoutType: aiContent.slide_content_json.layoutType || 'free',
      backgroundMode: aiContent.slide_content_json.backgroundMode || 'immersive-dark',
      elements: aiContent.slide_content_json.elements,
    };
    return (
      <React.Suspense fallback={<div className="h-full w-full bg-[#0a111d] rounded-2xl" />}>
        <div className={`relative h-full w-full rounded-2xl overflow-hidden border border-white/10 bg-[#0a111d] ${className}`}>
          <SlideParallaxStage slide={slide} spotlight />
        </div>
      </React.Suspense>
    );
  }

  return (
    <div className={`relative h-full w-full ${className}`}>
      <GammaSlide segment={segment} ai={aiContent} mode={mode} illustrationUrl={aiContent?.illustration_url || null} unitLabel={unitLabel} />
    </div>
  );
}
