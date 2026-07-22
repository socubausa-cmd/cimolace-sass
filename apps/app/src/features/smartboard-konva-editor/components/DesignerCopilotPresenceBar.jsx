/**
 * Barre de présence Copilot — animation type interface vocale / scan hi-tech + résumé d'activité.
 */
import React from 'react';
import { cn } from '@/lib/utils';
import { Activity, Cpu, Link2, Radio } from 'lucide-react';
import { useDesignerCopilotPresenceStore } from '../store/useDesignerCopilotPresenceStore';

const MODE_LABEL = {
  idle: 'Veille',
  typing: 'Saisie',
  voice: 'Écoute vocale',
  canvas_exam: 'Examen canvas',
  vision: 'Vision',
  vision_analyze: 'Analyse vision',
  streaming: 'Génération',
};

export default function DesignerCopilotPresenceBar({
  presenceMode,
  activitySummary,
  copilotEngaged,
  designerChatStreaming,
}) {
  const coachHandoffQueued = useDesignerCopilotPresenceStore((s) => !!s.pendingCoachArchitectHandoff);
  const mode = designerChatStreaming ? 'streaming' : presenceMode;
  const active = copilotEngaged || mode !== 'idle' || designerChatStreaming;
  const label = MODE_LABEL[mode] || MODE_LABEL.idle;

  return (
    <div className="relative w-full overflow-hidden border-t border-[#ebca5e]/15 bg-gradient-to-r from-[#050a12] via-[#0a1520] to-[#050a12]">
      {/* scan lines */}
      <div
        className={cn(
          'pointer-events-none absolute inset-0 opacity-30',
          active && 'animate-pulse',
        )}
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(34,211,238,0.04) 2px, rgba(34,211,238,0.04) 4px)',
        }}
      />
      <div
        className={cn(
          'pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-[#ebca5e]/0 via-[#ebca5e]/12 to-[#ebca5e]/0',
          active && 'designer-presence-scan',
        )}
      />

      <div className="relative flex items-center gap-3 px-3 py-2">
        <div className="relative flex h-11 w-11 shrink-0 items-center justify-center">
          <span
            className={cn(
              'absolute inset-0 rounded-full border border-[#ebca5e]/35',
              active && 'designer-presence-orbit',
            )}
          />
          <span
            className={cn(
              'absolute inset-1 rounded-full border border-[#d97757]/25',
              active && 'designer-presence-orbit-rev',
            )}
          />
          <span
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#ebca5e]/25 to-[#ebca5e]/30 shadow-[0_0_24px_rgba(34,211,238,0.35)]',
              active && 'shadow-[0_0_32px_rgba(167,139,250,0.45)]',
            )}
          >
            {mode === 'voice' ? (
              <Radio className="h-4 w-4 text-[#ebca5e]" aria-hidden />
            ) : mode === 'canvas_exam' || mode === 'vision' || mode === 'vision_analyze' ? (
              <Cpu className="h-4 w-4 text-[#ebca5e]" aria-hidden />
            ) : (
              <Activity className={cn('h-4 w-4 text-[#ebca5e]', designerChatStreaming && 'animate-pulse')} aria-hidden />
            )}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em]',
                active
                  ? 'border-[#ebca5e]/40 bg-[#ebca5e]/10 text-[#ebca5e]'
                  : 'border-white/10 text-white/35',
              )}
            >
              Copilot
            </span>
            <span className="text-[11px] font-semibold text-white/85">{label}</span>
            {coachHandoffQueued && !designerChatStreaming ? (
              <span
                className="inline-flex items-center gap-0.5 rounded border border-emerald-500/35 bg-emerald-950/40 px-1.5 py-0.5 text-[9px] text-emerald-200/90"
                title="Handoff Coach→Architect sera joint au prochain message"
              >
                <Link2 className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
                Handoff file
              </span>
            ) : null}
            {active ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400/90">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                actif
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-white/50">
            {activitySummary ||
              (active
                ? 'Le Copilot suit votre saisie, la voix, le dessin et la caméra pour proposer des idées dans Architect et un résumé dans Guide IA.'
                : 'Activez la saisie ou le micro pour réveiller le Copilot ; les modifications sur le canvas déclenchent l\'analyse de la scène.')}
          </p>
        </div>
      </div>

      <style>{`
        @keyframes designer-presence-orbit-kf {
          to { transform: rotate(360deg); }
        }
        @keyframes designer-presence-scan-kf {
          0% { transform: translateX(-40%); opacity: 0.2; }
          50% { opacity: 0.5; }
          100% { transform: translateX(220%); opacity: 0.2; }
        }
        .designer-presence-orbit {
          animation: designer-presence-orbit-kf 2s linear infinite;
        }
        .designer-presence-orbit-rev {
          animation: designer-presence-orbit-kf 2.6s linear infinite reverse;
        }
        .designer-presence-scan {
          animation: designer-presence-scan-kf 2.8s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
