import React from 'react';
import { Award, Loader2, TrendingUp } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useDataSync } from '@/contexts/DataSyncContext';
import { EleveMobileShell } from '@/components/eleve-mobile/EleveMobileShell';
import { LiriPageFooterLine } from '@/components/brand/LiriWordmark';
import { useStudentNotesParityData } from '@/hooks/useStudentNotesParityData';
import { format, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { EV_BG, EV_MUTED, EV_PAGE_AMBIENT, EV_R, listCardSurface } from '@/pages/school/eleve-mobile/vieScolaire/vieScolaireSharedUI.jsx';

/** Même requêtes que `StudentNotesPage` (sous réserve RLS). Route : `/m/eleve/etudiant/notes` */
export default function EleveEtudiantNotesScreen() {
  const { user } = useAuth();
  const { notifications: sync } = useDataSync();
  const inboxUnread = (Array.isArray(sync) ? sync : []).filter((n) => !n.isRead).length;
  const { gradesRows: grades, rankingValue: ranking, loading } = useStudentNotesParityData(user?.id);

  const average =
    grades.length > 0
      ? (
          grades.reduce((a, g) => a + (Number(g.max_score || 20) > 0 ? (Number(g.score || 0) / Number(g.max_score || 20)) * 20 : 0), 0) /
          grades.length
        ).toFixed(1)
      : 'N/A';

  return (
    <EleveMobileShell
      user={user}
      notificationCount={inboxUnread}
      contentClassName="!px-0"
      kicker="Espace étudiant"
      title="Notes & résultats"
      subtitle="Détail des relevés (même logique web)"
    >
      <div
        className="w-full px-4 pb-2"
        style={{ backgroundColor: EV_BG, backgroundImage: EV_PAGE_AMBIENT, minHeight: '50dvh' }}
      >
        {loading ? (
          <div className="flex flex-col items-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-violet-300" />
          </div>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-2 gap-2.5">
              <div className="p-3" style={{ borderRadius: EV_R.lg, ...listCardSurface() }}>
                <div className="flex items-center gap-2">
                  <Award className="h-4 w-4 text-amber-300" />
                  <span className="text-[9px] font-extrabold uppercase tracking-wider" style={{ color: EV_MUTED }}>
                    Moyenne
                  </span>
                </div>
                <p className="mt-1.5 text-2xl font-extrabold text-[#fbf3df]">
                  {average}
                  <span className="text-sm text-white/50">/20</span>
                </p>
              </div>
              <div className="p-3" style={{ borderRadius: EV_R.lg, ...listCardSurface() }}>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-300" />
                  <span className="text-[9px] font-extrabold uppercase tracking-wider" style={{ color: EV_MUTED }}>
                    Classement
                  </span>
                </div>
                <p className="mt-1.5 text-2xl font-extrabold text-[#fbf3df]">{ranking}</p>
              </div>
            </div>
            <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wider" style={{ color: EV_MUTED }}>
              Dernières notes
            </p>
            {grades.length === 0 ? (
              <p className="text-sm font-medium" style={{ color: EV_MUTED }}>
                Aucune note enregistrée.
              </p>
            ) : (
              <div className="space-y-2">
                {grades.map((g) => {
                  const d = g.evaluated_at ? new Date(g.evaluated_at) : null;
                  const dLabel = d && isValid(d) ? format(d, 'dd/MM/yyyy', { locale: fr }) : '—';
                  return (
                    <div key={g.id} className="p-3" style={{ borderRadius: EV_R.lg, ...listCardSurface() }}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[14px] font-bold text-white/95">{g.title || 'Évaluation'}</p>
                          <p className="text-[10.5px] font-medium" style={{ color: EV_MUTED }}>
                            {dLabel}
                          </p>
                          {g.comment ? (
                            <p className="mt-1 line-clamp-3 text-[11.5px] leading-relaxed" style={{ color: EV_MUTED }}>
                              {g.comment}
                            </p>
                          ) : null}
                        </div>
                        <p className="shrink-0 text-lg font-extrabold text-amber-200">
                          {g.score}
                          <span className="text-sm text-amber-200/70">/{g.max_score || 20}</span>
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
        <LiriPageFooterLine className="w-full" marginClass="mt-4 mb-2" suffix="Notes" />
      </div>
    </EleveMobileShell>
  );
}
