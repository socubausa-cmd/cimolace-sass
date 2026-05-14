/**
 * ScriptCanvasView — vue script prof / contenu brut du segment actif.
 * Affiche displayText + masterScript (intro, points clés, conclusion, notes).
 */
import React from 'react';
import { ScrollText, BookOpen, MessageSquare, Lightbulb } from 'lucide-react';

function ScriptBlock({ icon: Icon, title, content, accent = false }) {
  if (!content) return null;
  return (
    <div className={`rounded-xl border p-4 ${accent ? 'border-[#D4AF37]/25 bg-[#D4AF37]/5' : 'border-white/8 bg-white/[0.02]'}`}>
      <div className="mb-2 flex items-center gap-2">
        <Icon className={`h-3.5 w-3.5 ${accent ? 'text-[#D4AF37]' : 'text-white/40'}`} />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50">{title}</span>
      </div>
      <p className="text-[13px] leading-relaxed text-white/75 whitespace-pre-wrap">{content}</p>
    </div>
  );
}

export default function ScriptCanvasView({ segment }) {
  if (!segment) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-[12px] text-white/30">Sélectionnez un segment pour voir le script.</p>
      </div>
    );
  }

  const script = segment.masterScript;
  const keyPoints = script?.keyPoints ?? [];

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-6">
      {/* Display text (what appears on slide) */}
      <ScriptBlock icon={ScrollText} title="Texte du slide" content={segment.displayText} accent />

      {/* Script intro */}
      <ScriptBlock icon={MessageSquare} title="Introduction prof" content={script?.intro} />

      {/* Key points */}
      {keyPoints.length > 0 && (
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
          <div className="mb-3 flex items-center gap-2">
            <Lightbulb className="h-3.5 w-3.5 text-white/40" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50">Points clés</span>
          </div>
          <ol className="flex flex-col gap-2">
            {keyPoints.map((pt, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#D4AF37]/20 text-[10px] font-bold text-[#D4AF37]">{i + 1}</span>
                <span className="text-[13px] text-white/75">{pt}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Transitions */}
      {script?.transitions?.length > 0 && (
        <div className="rounded-xl border border-blue-500/15 bg-blue-500/5 p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-400/60">Transitions</span>
          </div>
          {script.transitions.map((t, i) => (
            <p key={i} className="text-[12px] italic text-blue-300/60">"…{t}…"</p>
          ))}
        </div>
      )}

      {/* Conclusion */}
      <ScriptBlock icon={BookOpen} title="Conclusion" content={script?.conclusion} />

      {/* Teacher notes (private) */}
      {script?.teacherNotes && (
        <div className="rounded-xl border border-amber-500/15 bg-amber-500/5 p-4">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-amber-400/60">
            Notes prof (privé)
          </div>
          <p className="text-[12px] text-amber-200/50 whitespace-pre-wrap">{script.teacherNotes}</p>
        </div>
      )}
    </div>
  );
}
