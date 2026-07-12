import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Maximize } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { SafeHtml } from '@/components/common/SafeHtml';

const PowerPointViewer = ({ powerpoint, onComplete }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [viewMode, setViewMode] = useState('split');
  const [direction, setDirection] = useState(1);

  const slides = powerpoint?.type === 'slides' && Array.isArray(powerpoint.slides) ? powerpoint.slides : [];
  const safeIndex = (idx) => Math.max(0, Math.min(idx, Math.max(0, slides.length - 1)));
  const goTo = (idx) => {
    if (slides.length === 0) return;
    const next = safeIndex(idx);
    setDirection(next > currentSlide ? 1 : -1);
    setCurrentSlide(next);
  };

  useEffect(() => {
    if (powerpoint?.type !== 'slides' || slides.length === 0) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goTo(currentSlide - 1);
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        goTo(currentSlide + 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [powerpoint?.type, slides.length, currentSlide]);

  if (!powerpoint) return null;

  const decodeHtmlEntities = (value) => {
    const raw = String(value ?? '');
    if (!raw) return '';
    try {
      if (typeof document !== 'undefined') {
        const el = document.createElement('textarea');
        el.innerHTML = raw;
        return el.value;
      }
    } catch {
      // ignore
    }
    return raw
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
  };

  const extractIframeSrc = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const m = raw.match(/<iframe[^>]*\ssrc=["']([^"']+)["'][^>]*>/i);
    if (m && m[1]) return decodeHtmlEntities(m[1].trim());
    const src2 = raw.match(/\ssrc=["']([^"']+)["']/i);
    if (src2 && src2[1] && raw.toLowerCase().includes('<iframe')) return decodeHtmlEntities(src2[1].trim());
    return decodeHtmlEntities(raw);
  };

  const asSafeUrl = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
      const u = new URL(raw);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
      return u.toString();
    } catch {
      return '';
    }
  };

  // Gamma Link
  if (powerpoint.type === 'gamma') {
    const raw = extractIframeSrc(powerpoint.gammaUrl);
    const safe = asSafeUrl(raw);
    const iframeSrc = (() => {
      if (!safe) return '';
      try {
        const u = new URL(safe);
        if (u.hostname === 'gamma.app') {
          if (u.pathname.startsWith('/docs/')) {
            u.pathname = u.pathname.replace(/^\/docs\//, '/embed/');
          }
          if (!u.pathname.startsWith('/embed/') && u.pathname.length > 1) {
            u.pathname = `/embed${u.pathname}`;
          }
        }
        return u.toString();
      } catch {
        return safe;
      }
    })();

    if (!iframeSrc) {
      return <div className="p-4 text-center text-[#82807a]">Aucun contenu disponible</div>;
    }

    return (
      <div className="w-full space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-[#f5f4ee] truncate">{powerpoint?.title || 'Support Gamma'}</div>
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <a href={safe || iframeSrc} target="_blank" rel="noreferrer">
              Ouvrir
            </a>
          </Button>
        </div>

        <div className="w-full aspect-[16/9] bg-[#2b2926] rounded-2xl overflow-hidden border border-[rgba(245,244,238,0.09)] shadow-[0_18px_60px_rgba(0,0,0,0.45)]">
          <iframe
            src={iframeSrc}
            className="w-full h-full"
            title="Gamma Presentation"
            allow="fullscreen"
          />
        </div>

        <div className="text-xs text-[#82807a]">
          Si Gamma bloque l'affichage ("n\'autorise pas la connexion"), utilise le bouton « Ouvrir ».
        </div>
      </div>
    );
  }

  // Native Slides (Created or Imported)
  if (powerpoint.type === 'slides' && powerpoint.slides?.length > 0) {
    const slide = slides[currentSlide];
    const previewText = (html) => {
      const text = String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      return text.length > 60 ? `${text.slice(0, 60)}…` : text;
    };

    const progressPct = slides.length > 1 ? (currentSlide / (slides.length - 1)) * 100 : 0;

    const containerClasses =
      'rounded-2xl overflow-hidden border border-[rgba(245,244,238,0.09)] bg-[#2b2926] text-[#f5f4ee] flex flex-col h-[560px] shadow-[0_20px_80px_rgba(0,0,0,0.5)]';

    const headerBar = (
      <div className="px-4 py-3 border-b border-[rgba(245,244,238,0.09)] bg-[#2b2926] flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs text-[#82807a]">Support</div>
          <div className="text-sm font-semibold truncate">{powerpoint?.title || 'Présentation'}</div>
        </div>

        <div className="hidden sm:flex items-center gap-3">
          <div className="text-xs text-[#82807a]">{currentSlide + 1}/{slides.length}</div>
          <div className="w-40 h-1.5 rounded-full bg-[rgba(245,244,238,0.08)] overflow-hidden">
            <div className="h-full bg-[#d97757]" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setViewMode((v) => (v === 'split' ? 'focus' : 'split'))}
          className="border-[rgba(245,244,238,0.09)] bg-[#2b2926] hover:bg-[rgba(245,244,238,0.06)] text-[#f5f4ee] rounded-full"
        >
          {viewMode === 'split' ? 'Focus' : 'Split'}
        </Button>
      </div>
    );

    const controlsBar = (
      <div className="px-4 py-3 flex items-center justify-between border-t border-[rgba(245,244,238,0.09)] bg-[#2b2926]">
        <div className="text-xs text-[#82807a]">Slide {currentSlide + 1} / {slides.length}</div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => goTo(currentSlide - 1)}
            disabled={currentSlide === 0}
            className="border-[rgba(245,244,238,0.09)] bg-[#2b2926] text-[#f5f4ee] hover:bg-[rgba(245,244,238,0.06)] rounded-full"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => goTo(currentSlide + 1)}
            disabled={currentSlide === slides.length - 1}
            className="border-[rgba(245,244,238,0.09)] bg-[#2b2926] text-[#f5f4ee] hover:bg-[rgba(245,244,238,0.06)] rounded-full"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {currentSlide === slides.length - 1 && typeof onComplete === 'function' ? (
          <Button onClick={onComplete} className="bg-[#d97757] hover:brightness-110 text-white rounded-full h-9 px-4 text-xs font-bold">
            Continuer
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="text-[#82807a] hover:text-[#f5f4ee] hover:bg-[rgba(245,244,238,0.06)] rounded-full">
              <Maximize className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    );

    return (
      <div className={containerClasses}>
        {headerBar}
        <div className={viewMode === 'split' ? 'flex-1 grid grid-cols-12 min-h-0' : 'flex-1 min-h-0'}>
          {viewMode === 'split' ? (
            <div className="col-span-4 min-h-0 border-r border-[rgba(245,244,238,0.09)] bg-[rgba(245,244,238,0.04)]">
              <div className="px-3 pt-3">
                <div className="text-xs font-semibold text-[#cfccc3]">Sommaire</div>
                <div className="text-[11px] text-[#82807a] mt-1">Clique pour naviguer</div>
              </div>
              <div className="overflow-y-auto h-full px-3 pb-3 pt-3 space-y-2">
                {slides.map((s, idx) => (
                  <motion.button
                    key={idx}
                    type="button"
                    onClick={() => goTo(idx)}
                    whileHover={{ y: -1 }}
                    className={
                      idx === currentSlide
                        ? 'w-full text-left rounded-xl border border-[rgba(245,244,238,0.09)] bg-[#2b2926] shadow-[0_12px_30px_rgba(0,0,0,0.45)] p-3'
                        : 'w-full text-left rounded-xl border border-transparent bg-transparent hover:border-[rgba(245,244,238,0.12)] hover:bg-[rgba(245,244,238,0.05)] p-3'
                    }
                  >
                    <div className="flex items-start gap-3">
                      <div className={idx === currentSlide ? 'mt-0.5 h-2.5 w-2.5 rounded-full bg-[#d97757] shadow-[0_0_0_4px_rgba(217,119,87,0.18)]' : 'mt-0.5 h-2.5 w-2.5 rounded-full bg-[#4a4844]'} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-[11px] font-semibold text-[#82807a]">Slide {idx + 1}</div>
                          {idx === currentSlide ? (
                            <div className="text-[11px] font-semibold text-[#d97757]">Actif</div>
                          ) : null}
                        </div>
                        <div className="text-sm font-semibold text-[#f5f4ee] line-clamp-1 mt-0.5">{s.title || `Slide ${idx + 1}`}</div>
                        <div className="text-xs text-[#b0ada3] mt-1 line-clamp-2">{previewText(s.content)}</div>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          ) : null}

          <div className={viewMode === 'split' ? 'col-span-8 min-h-0' : 'min-h-0'}>
            <div className="h-full overflow-hidden bg-[#2b2926]">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={currentSlide}
                  initial={{ opacity: 0, x: 40 * direction, scale: 0.995 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -40 * direction, scale: 0.995 }}
                  transition={{ duration: 0.24, ease: 'easeOut' }}
                  className={
                    viewMode === 'split'
                      ? 'h-full px-10 py-10 flex flex-col items-center justify-center text-center overflow-y-auto'
                      : 'h-full px-12 py-12 flex flex-col items-center justify-center text-center overflow-y-auto'
                  }
                >
                  <div className="w-full max-w-3xl">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[rgba(245,244,238,0.09)] bg-[rgba(245,244,238,0.05)] text-xs text-[#b0ada3] mb-5">
                      <span className="text-[#d97757] font-semibold">Slide</span>
                      <span>{currentSlide + 1}</span>
                    </div>
                    <h2 className="text-3xl font-bold mb-6 text-[#f5f4ee]">{slide.title}</h2>
                    <SafeHtml className="prose prose-invert max-w-none text-lg text-[#cfccc3]" html={slide.content} />
                    {slide.image ? (
                      <img src={slide.image} alt="Slide visual" className="mt-6 max-h-64 object-contain mx-auto" />
                    ) : null}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>

        {controlsBar}
      </div>
    );
  }

  return <div className="p-4 text-center text-[#82807a]">Aucun contenu disponible</div>;
};

export default PowerPointViewer;