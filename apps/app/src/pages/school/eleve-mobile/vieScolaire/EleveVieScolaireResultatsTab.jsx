import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { Award } from 'lucide-react';
import { EV_BG, EV_MUTED, EV_PAGE_AMBIENT, EV_R, listCardSurface, safeFormat } from './vieScolaireSharedUI.jsx';

export default function EleveVieScolaireResultatsTab() {
  const data = useOutletContext();
  if (!data) return null;
  const { loading, evals } = data;

  return (
    <div
      className="w-full px-4 pb-3 pt-0"
      style={{ backgroundColor: EV_BG, backgroundImage: EV_PAGE_AMBIENT, minHeight: '40dvh' }}
    >
      <h2 className="mb-2 font-serif text-lg font-bold text-[#fbf3df]">Dernières évaluations</h2>
      {loading ? (
        <div className="space-y-2.5 py-1" aria-busy>
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-[64px] animate-pulse rounded-[16px] border border-white/[0.08] bg-white/[0.04]"
            />
          ))}
        </div>
      ) : (evals || []).length === 0 ? (
        <div
          className="flex items-start gap-3 p-3.5"
          style={{ borderRadius: EV_R.lg, ...listCardSurface() }}
        >
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
            style={{ background: 'rgba(245, 158, 11, 0.1)' }}
          >
            <Award className="h-5 w-5 text-amber-300" />
          </div>
          <p className="text-[12.5px] font-medium leading-relaxed" style={{ color: EV_MUTED }}>
            Aucune note enregistrée. Les enseignants alimentent cette section après chaque évaluation.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {evals.map((e) => (
            <div
              key={e.id}
              className="flex items-center justify-between gap-3 p-3.5"
              style={{ borderRadius: EV_R.lg, ...listCardSurface() }}
            >
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-[13.5px] font-bold leading-snug text-white">{e.title}</p>
                <p className="mt-0.5 text-[10.5px] font-semibold" style={{ color: EV_MUTED }}>
                  {safeFormat(e.at, 'd MMM yyyy')}
                </p>
              </div>
              <div
                className="shrink-0 rounded-xl px-2.5 py-1.5 text-right"
                style={{
                  background: 'linear-gradient(150deg, rgba(245,158,11,0.22) 0%, rgba(20,20,32,0.5) 100%)',
                  border: '1px solid rgba(245, 200, 120, 0.2)',
                }}
              >
                <p className="text-[8px] font-extrabold uppercase tracking-wider text-amber-200/80">Note</p>
                <p className="text-[16px] font-extrabold leading-none tabular-nums text-amber-50">
                  {e.score}
                  <span className="text-xs font-bold text-amber-200/70"> / {e.max}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
