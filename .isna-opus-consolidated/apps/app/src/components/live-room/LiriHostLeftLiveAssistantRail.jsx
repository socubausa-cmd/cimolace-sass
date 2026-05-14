import React, { useEffect, useRef } from 'react';
import {
  Activity,
  BookOpen,
  Loader2,
  Mic,
  MicOff,
  Radio,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLiriLivePassiveAssistantFeed } from '@/hooks/useLiriLivePassiveAssistantFeed';
import { useLongiaWakePhraseListener } from '@/hooks/useLongiaWakePhraseListener';

const TOOL_FR = {
  pencil: 'Craie',
  line: 'Trait',
  arrow: 'Flèche',
  rect: 'Rectangle',
  ellipse: 'Ellipse',
  eraser: 'Gomme',
  text: 'Texte',
  select: 'Sélection',
  hand: 'Main',
  highlighter: 'Surligneur',
};

/**
 * Panneau latéral gauche hôte — fil passive LONGIA + vision « connecté » + écoute « Dis LONGIA ».
 */
export default function LiriHostLeftLiveAssistantRail() {
  const { items, busy, boardTextDraftActive, tool, previewLen } = useLiriLivePassiveAssistantFeed();
  const {
    supported: voiceSupported,
    listening: micListening,
    error: voiceError,
    engaged: voiceEngaged,
    startListening,
    stopListening,
  } = useLongiaWakePhraseListener();
  const scroller = useRef(null);

  useEffect(() => {
    if (!scroller.current) return;
    scroller.current.scrollTo({ top: 0, behavior: 'smooth' });
  }, [items.length]);

  const showVisionPulse = true;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <style
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes liriVisionHalo {
              0%, 100% { transform: scale(1); opacity: 0.45; }
              50% { transform: scale(1.08); opacity: 0.9; }
            }
            @keyframes liriVisionSweep {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            @keyframes liriVisionScan {
              0%, 100% { opacity: 0.2; }
              50% { opacity: 0.6; }
            }
            @keyframes liriEngageFlash {
              0% { opacity: 0; transform: scale(0.98); }
              15% { opacity: 1; transform: scale(1); }
              100% { opacity: 0.85; transform: scale(1); }
            }
            .liri-vision-aura { animation: liriVisionHalo 2.4s ease-in-out infinite; }
            .liri-vision-sweep { animation: liriVisionSweep 14s linear infinite; }
            .liri-vision-scan { animation: liriVisionScan 1.8s ease-in-out infinite; }
            .liri-engage-burst { animation: liriEngageFlash 0.6s ease-out forwards; }
          `,
        }}
      />

      <div
        className={cn(
          'relative mb-2 shrink-0 overflow-hidden rounded-2xl border transition-[box-shadow] duration-500',
          voiceEngaged
            ? 'border-amber-400/45 bg-gradient-to-b from-amber-950/40 to-[#0a0812]/95 shadow-[0_0_40px_rgba(251,191,36,0.22)]'
            : micListening
              ? 'border-emerald-400/30 bg-[#0a0a10]/95 shadow-[0_0_32px_rgba(52,211,153,0.18)]'
              : 'border-violet-500/25 bg-[#080712]/95 shadow-[0_0_28px_rgba(139,92,246,0.18)]',
        )}
      >
        <div
          className="liri-vision-sweep pointer-events-none absolute -left-1/2 -top-1/2 h-[200%] w-[200%] bg-[conic-gradient(from_0deg,transparent_0deg,rgba(124,58,237,0.12)_60deg,transparent_120deg,rgba(6,182,212,0.1)_200deg,transparent_280deg)]"
          aria-hidden
        />
        <div
          className="liri-vision-aura pointer-events-none absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-500/20 blur-2xl"
          aria-hidden
        />
        <div className="relative z-[1] border-b border-white/[0.06] px-2.5 pb-2 pt-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    'relative flex h-2 w-2 shrink-0',
                    showVisionPulse && 'liri-vision-scan',
                  )}
                  title="LONGIA Realtime"
                >
                  <span
                    className={cn(
                      'absolute inline-flex h-full w-full rounded-full',
                      voiceEngaged ? 'bg-amber-400' : micListening ? 'bg-emerald-400' : 'bg-violet-400',
                    )}
                    style={{ animation: 'liriVisionHalo 1.2s ease-in-out infinite' }}
                  />
                  <span
                    className={cn(
                      'relative inline-flex h-2 w-2 rounded-full',
                      voiceEngaged
                        ? 'bg-amber-300 shadow-[0_0_8px_2px_rgba(251,191,36,0.7)]'
                        : micListening
                          ? 'bg-emerald-300 shadow-[0_0_8px_2px_rgba(52,211,153,0.5)]'
                          : 'bg-violet-400 shadow-[0_0_6px_2px_rgba(167,139,250,0.5)]',
                    )}
                  />
                </span>
                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-amber-100/95">
                  LONGIA Realtime
                </p>
                <span className="rounded-full border border-cyan-400/25 bg-cyan-500/10 px-1.5 py-px text-[6px] font-bold uppercase tracking-widest text-cyan-200/90">
                  connecté
                </span>
              </div>
              <p className="mt-1 text-[8px] leading-relaxed text-white/42">
                Vision active · flux IA aligné sur votre saisie tableau
                {micListening ? ' · micro à l’écoute des mots d’appel' : ''}
              </p>
            </div>
            {voiceSupported ? (
              <button
                type="button"
                onClick={() => (micListening ? stopListening() : startListening())}
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border text-white/90 transition',
                  micListening
                    ? 'border-emerald-400/50 bg-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.35)]'
                    : 'border-white/15 bg-white/[0.06] hover:border-violet-400/35',
                )}
                title={
                  micListening
                    ? 'Couper l’écoute « Dis LONGIA »'
                    : 'Activer l’écoute : dites « Dis LONGIA » ou « S’il te plaît LONGIA »'
                }
                aria-pressed={micListening}
              >
                {micListening ? <Mic className="h-3.5 w-3.5" strokeWidth={2} /> : <MicOff className="h-3.5 w-3.5 opacity-70" strokeWidth={2} />}
              </button>
            ) : null}
          </div>
          {voiceError ? <p className="mt-1.5 text-[8px] text-amber-200/80">{voiceError}</p> : null}
          {voiceEngaged ? (
            <div
              className="liri-engage-burst mt-2 flex items-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-500/15 px-2 py-1.5"
              role="status"
            >
              <Radio className="h-3.5 w-3.5 shrink-0 text-amber-200" strokeWidth={2} aria-hidden />
              <p className="text-[9px] font-semibold text-amber-100">
                LONGIA engagé — dites ce que vous souhaitez, ou reprenez sur le tableau.
              </p>
            </div>
          ) : null}
        </div>
        <p className="relative z-[1] px-2.5 pb-2 text-[8px] leading-relaxed text-white/35">
          Mots d’appel : « Dis LONGIA », « S’il te plaît LONGIA » (micro activé).
        </p>
      </div>

      <div className="mb-1 shrink-0 text-[8px] text-white/30">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-0.5 rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-white/45">
            <Activity className="h-2.5 w-2.5" strokeWidth={2} aria-hidden />
            Outil : {TOOL_FR[tool] || tool}
          </span>
          {boardTextDraftActive ? (
            <span className="inline-flex items-center gap-0.5 rounded border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-emerald-200/80">
              {busy ? <Loader2 className="h-2.5 w-2.5 animate-spin" aria-hidden /> : null}
              Saisie · {previewLen} c.
            </span>
          ) : (
            <span className="text-white/28">Brouillon texte : en attente sur le SmartBoard</span>
          )}
        </div>
      </div>

      <div
        ref={scroller}
        className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5 [scrollbar-width:thin]"
      >
        {items.length === 0 && !boardTextDraftActive ? (
          <p className="select-none text-[10px] leading-relaxed text-white/32">
            Le fil affichera des corrections et des repères — sans cliquer ici. Activez le micro pour les phrases
            d’appel.
          </p>
        ) : null}
        {items.length === 0 && boardTextDraftActive && !busy ? (
          <p className="text-[9px] text-white/30">Saisie détectée — analyse après pause…</p>
        ) : null}
        {items.map((it) => (
          <article
            key={it.id}
            className={cn(
              'select-none rounded-lg border px-2 py-1.5',
              it.kind === 'correction' && 'border-emerald-500/20 bg-emerald-950/35',
              it.kind === 'enrichissement' && 'border-sky-500/20 bg-sky-950/30',
              it.kind === 'forme' && 'border-amber-500/20 bg-amber-950/20',
              it.kind === 'erreur' && 'border-red-500/25 bg-red-950/20',
            )}
          >
            <div className="mb-0.5 flex items-start justify-between gap-1">
              <span className="text-[7px] font-bold uppercase tracking-wider text-white/40">{it.titre}</span>
              {it.provider ? <span className="shrink-0 text-[7px] text-white/30">{it.provider}</span> : null}
            </div>
            {it.source ? (
              <p className="mb-0.5 border-b border-white/[0.06] pb-0.5 text-[8px] leading-snug text-white/32 line-clamp-2">
                {it.source}
              </p>
            ) : null}
            <p className="whitespace-pre-wrap text-[10px] leading-relaxed text-white/90">{it.corps}</p>
          </article>
        ))}
        {busy && items.length > 0 ? (
          <div className="flex items-center gap-1.5 text-[8px] text-white/35">
            <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} aria-hidden />
            Analyse…
          </div>
        ) : null}
      </div>

      <div className="mt-1 shrink-0 border-t border-white/[0.06] pt-1.5">
        <p className="inline-flex items-center gap-1 text-[7px] text-white/25">
          <BookOpen className="h-2.5 w-2.5" strokeWidth={2} aria-hidden />
          <Sparkles className="h-2.5 w-2.5" strokeWidth={2} aria-hidden />
          Modèles côté serveur (Claude → DeepSeek → Grok)
        </p>
      </div>
    </div>
  );
}
