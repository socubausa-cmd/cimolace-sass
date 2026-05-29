/**
 * ValidationChecklist — Module 7 : checklist de validation finale du cours.
 */
import React, { useState, useMemo } from 'react';
import { CheckSquare, Square, ChevronDown, ChevronUp, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const CHECKLIST_ITEMS = [
  { id: 'objectives',  category: 'Pedagogie', label: 'Objectifs pedagogiques definis', critical: true },
  { id: 'structure',   category: 'Pedagogie', label: 'Structure coherente (intro → developpement → conclusion)', critical: true },
  { id: 'progression', category: 'Pedagogie', label: 'Progression logique entre les slides', critical: true },
  { id: 'script',      category: 'Pedagogie', label: 'Script professeur complet', critical: false },
  { id: 'timing',      category: 'Pedagogie', label: 'Duree par slide estimee', critical: false },
  { id: 'audience',    category: 'Pedagogie', label: 'Niveau du public cible adapte', critical: true },

  { id: 'title_slide', category: 'Design', label: 'Slide de titre present', critical: true },
  { id: 'visuals',     category: 'Design', label: 'Visuels adequats (images / icones)', critical: false },
  { id: 'colors',      category: 'Design', label: 'Palette de couleurs coherente', critical: false },
  { id: 'typo',        category: 'Design', label: 'Typographie lisible (police + taille)', critical: true },
  { id: 'density',     category: 'Design', label: 'Aucune slide surchargee de texte', critical: true },

  { id: 'examples',    category: 'Contenu', label: 'Exemples concrets fournis', critical: false },
  { id: 'keywords',    category: 'Contenu', label: 'Mots-cles importants mis en valeur', critical: false },
  { id: 'sources',     category: 'Contenu', label: 'Sources / references citees', critical: false },
  { id: 'summary',     category: 'Contenu', label: 'Slide de synthese / conclusion', critical: true },

  { id: 'live_ready',  category: 'Diffusion', label: 'Pret pour le live (format 1037x750)', critical: true },
  { id: 'exported',    category: 'Diffusion', label: 'Export PDF / PNG realise', critical: false },
  { id: 'backup',      category: 'Diffusion', label: 'Sauvegarde workspace effectuee', critical: true },
];

const CATEGORIES = ['Pedagogie', 'Design', 'Contenu', 'Diffusion'];

export default function ValidationChecklist({ projectQuality, className }) {
  const [checked, setChecked] = useState(() => {
    try {
      const saved = localStorage.getItem('sb_validation_checklist');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [expanded, setExpanded] = useState(true);

  const toggle = (id) => {
    setChecked((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try { localStorage.setItem('sb_validation_checklist', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const total = CHECKLIST_ITEMS.length;
  const done = CHECKLIST_ITEMS.filter((i) => checked[i.id]).length;
  const criticalMissing = CHECKLIST_ITEMS.filter((i) => i.critical && !checked[i.id]).length;
  const progress = Math.round((done / total) * 100);

  const isReady = criticalMissing === 0 && done >= Math.round(total * 0.75);

  return (
    <div className={cn('rounded-xl border border-white/[0.08] bg-[#0d1020]/95', className)}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2.5"
      >
        <div
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold',
            isReady ? 'border-green-500 text-green-400' : criticalMissing > 0 ? 'border-amber-500 text-amber-400' : 'border-blue-500 text-blue-300',
          )}
        >
          {progress}%
        </div>
        <div className="min-w-0 flex-1 text-left">
          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/40">
            Validation finale
          </p>
          <p className={cn('text-[11px] font-bold', isReady ? 'text-green-400' : 'text-amber-400')}>
            {isReady ? 'Pret pour le live' : `${criticalMissing} points critiques manquants`}
          </p>
        </div>
        {isReady ? (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-green-400" />
        ) : (
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
        )}
        {expanded ? <ChevronUp className="h-3.5 w-3.5 shrink-0 text-white/30" /> : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-white/30" />}
      </button>

      {expanded && (
        <div className="border-t border-white/[0.07] px-3 pb-3 pt-2">
          {/* Progress bar */}
          <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${progress}%`,
                background: isReady ? '#22c55e' : criticalMissing > 0 ? '#f59e0b' : '#60a5fa',
              }}
            />
          </div>

          {/* Stats */}
          {projectQuality && (
            <div className="mb-3 grid grid-cols-2 gap-1.5">
              <div className="rounded-lg bg-white/[0.04] px-2 py-1.5 text-center">
                <p className="text-[8px] text-white/35">Score moyen</p>
                <p className="text-[12px] font-bold" style={{ color: projectQuality.projectColor }}>
                  {projectQuality.avgScore}/100
                </p>
              </div>
              <div className="rounded-lg bg-white/[0.04] px-2 py-1.5 text-center">
                <p className="text-[8px] text-white/35">Progression</p>
                <p className="text-[12px] font-bold text-white">{done}/{total}</p>
              </div>
            </div>
          )}

          {/* Checklist par categorie */}
          {CATEGORIES.map((cat) => {
            const items = CHECKLIST_ITEMS.filter((i) => i.category === cat);
            const catDone = items.filter((i) => checked[i.id]).length;
            return (
              <div key={cat} className="mb-2">
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-[8px] font-semibold uppercase tracking-wider text-[#D4AF37]/70">
                    {cat}
                  </p>
                  <span className="text-[8px] text-white/30">{catDone}/{items.length}</span>
                </div>
                <div className="space-y-0.5">
                  {items.map((item) => {
                    const isDone = !!checked[item.id];
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => toggle(item.id)}
                        className={cn(
                          'flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left transition-colors',
                          isDone ? 'bg-green-900/20' : item.critical ? 'bg-amber-900/10 hover:bg-amber-900/20' : 'hover:bg-white/[0.04]',
                        )}
                      >
                        {isDone ? (
                          <CheckSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-400" />
                        ) : (
                          <Square className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', item.critical ? 'text-amber-400/70' : 'text-white/30')} />
                        )}
                        <span className={cn('text-[9px] leading-snug', isDone ? 'text-green-200/70 line-through' : item.critical ? 'text-amber-100/80' : 'text-white/60')}>
                          {item.label}
                          {item.critical && !isDone && (
                            <span className="ml-1 text-[8px] text-amber-400/70">• critique</span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <button
            type="button"
            onClick={() => {
              const all = {};
              CHECKLIST_ITEMS.forEach((i) => { all[i.id] = false; });
              setChecked(all);
              try { localStorage.setItem('sb_validation_checklist', JSON.stringify(all)); } catch {}
            }}
            className="mt-2 w-full rounded-lg border border-white/10 py-1 text-[8px] text-white/35 hover:bg-white/[0.04]"
          >
            Reinitialiser
          </button>
        </div>
      )}
    </div>
  );
}
