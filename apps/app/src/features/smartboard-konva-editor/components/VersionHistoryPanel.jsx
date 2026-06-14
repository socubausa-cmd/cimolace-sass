/**
 * VersionHistoryPanel - Module 1 : historique de versions / brouillons.
 * Affiche les 24 derniers snapshots de l'historique Zustand avec option de restauration.
 */
import React, { useState } from 'react';
import { History, RotateCcw, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

function relativeTime(ms) {
  if (!ms) return '';
  const diff = Date.now() - ms;
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'il y a ' + s + 's';
  const m = Math.floor(s / 60);
  if (m < 60) return 'il y a ' + m + ' min';
  const h = Math.floor(m / 60);
  if (h < 24) return 'il y a ' + h + 'h';
  return 'il y a ' + Math.floor(h / 24) + 'j';
}

export default function VersionHistoryPanel({ historyPast, historyTimestamps, onRestore, className }) {
  const [expanded, setExpanded] = useState(false);

  const count = historyPast ? historyPast.length : 0;

  return (
    <div className={cn('rounded-xl border border-white/[0.08] bg-[#0d1020]/95', className)}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2"
      >
        <History className="h-3.5 w-3.5 shrink-0 text-[color-mix(in_srgb,var(--school-accent)_70%,transparent)]" />
        <div className="min-w-0 flex-1 text-left">
          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/40">
            Historique
          </p>
          <p className="text-[10px] font-semibold text-white/70">
            {count === 0 ? 'Aucune version' : count + ' version' + (count > 1 ? 's' : '') + ' sauvegardee' + (count > 1 ? 's' : '')}
          </p>
        </div>
        {expanded ? (
          <ChevronUp className="h-3 w-3 shrink-0 text-white/30" />
        ) : (
          <ChevronDown className="h-3 w-3 shrink-0 text-white/30" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-white/[0.07] px-2 pb-2 pt-1">
          {count === 0 ? (
            <p className="py-2 text-center text-[9px] text-white/30">
              Aucune action effectuee - modifiez le canvas pour creer un historique
            </p>
          ) : (
            <div className="max-h-48 space-y-0.5 overflow-y-auto [scrollbar-width:thin]">
              {/* Version courante */}
              <div className="flex items-center gap-2 rounded-lg bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] px-2 py-1.5">
                <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--school-accent)]" />
                <span className="flex-1 text-[9px] text-[#f5dd8a]">Version actuelle</span>
                <span className="text-[8px] text-white/30">maintenant</span>
              </div>
              {/* Snapshots du plus recent au plus ancien */}
              {[...historyPast].reverse().map((snap, revIdx) => {
                const absIdx = count - 1 - revIdx;
                const ts = historyTimestamps ? historyTimestamps[absIdx] : null;
                const sceneCount = snap?.scenes?.length ?? 0;
                const objCount = snap?.scenes?.reduce((a, s) => a + (s.objects?.length ?? 0), 0) ?? 0;
                return (
                  <div
                    key={absIdx}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/[0.04]"
                  >
                    <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/20" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[9px] text-white/60">
                        {sceneCount} scene{sceneCount > 1 ? 's' : ''} · {objCount} objet{objCount > 1 ? 's' : ''}
                      </p>
                      {ts ? (
                        <p className="flex items-center gap-0.5 text-[8px] text-white/30">
                          <Clock className="h-2 w-2" />
                          {relativeTime(ts)}
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => onRestore && onRestore(absIdx)}
                      className="flex shrink-0 items-center gap-1 rounded-lg border border-white/15 px-1.5 py-0.5 text-[8px] text-white/50 hover:border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)] hover:text-[var(--school-accent)]"
                      title="Restaurer cette version"
                    >
                      <RotateCcw className="h-2.5 w-2.5" />
                      Restaurer
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
