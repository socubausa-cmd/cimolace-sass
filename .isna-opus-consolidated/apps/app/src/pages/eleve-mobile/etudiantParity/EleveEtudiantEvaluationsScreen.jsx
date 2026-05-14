import React from 'react';
import { GraduationCap, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useDataSync } from '@/contexts/DataSyncContext';
import { EleveMobileShell } from '@/components/eleve-mobile/EleveMobileShell';
import { useStudentEvaluationsParityData } from '@/hooks/useStudentEvaluationsParityData';
import { LiriPageFooterLine } from '@/components/brand/LiriWordmark';
import { format, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { EV_BG, EV_MUTED, EV_PAGE_AMBIENT, EV_R, listCardSurface } from '@/pages/eleve-mobile/vieScolaire/vieScolaireSharedUI.jsx';

function fmt(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return isValid(d) ? format(d, "d MMM yyyy '·' HH:mm", { locale: fr }) : '—';
}

/**
 * Même source que `StudentEvaluationsPage` (`useStudentEvaluationsParityData`).
 * Route : `/m/eleve/etudiant/evaluations`
 */
export default function EleveEtudiantEvaluationsScreen() {
  const { user } = useAuth();
  const { notifications: sync } = useDataSync();
  const inboxUnread = (Array.isArray(sync) ? sync : []).filter((n) => !n.isRead).length;
  const { evaluationsRows, upcomingRows, loading } = useStudentEvaluationsParityData(user?.id);
  const completed = evaluationsRows || [];
  const upcoming = upcomingRows || [];

  return (
    <EleveMobileShell
      user={user}
      notificationCount={inboxUnread}
      contentClassName="!px-0"
      kicker="Espace étudiant"
      title="Évaluations"
      subtitle="Résultats + examens à venir (même règles que le portail web)"
    >
      <div
        className="w-full px-4 pb-2"
        style={{ backgroundColor: EV_BG, backgroundImage: EV_PAGE_AMBIENT, minHeight: '50dvh' }}
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3" aria-busy>
            <Loader2 className="h-8 w-8 animate-spin text-violet-300" />
          </div>
        ) : (
          <>
            <h3 className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-amber-200/80">À venir (agenda)</h3>
            {upcoming.length === 0 ? (
              <p className="mb-4 text-sm font-medium" style={{ color: EV_MUTED }}>
                Aucun examen à venir repéré sur le calendrier d’établissement.
              </p>
            ) : (
              <div className="mb-4 space-y-2">
                {upcoming.map((e) => (
                  <div key={e.id} className="flex items-start gap-2 p-3" style={{ borderRadius: EV_R.lg, ...listCardSurface() }}>
                    <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                    <div>
                      <p className="text-[14px] font-extrabold text-white/95">{e.title}</p>
                      <p className="text-[11px] font-medium" style={{ color: EV_MUTED }}>
                        {fmt(e.start_at)} {e.location ? `· ${e.location}` : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <h3 className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-violet-200/80">Résultats</h3>
            {completed.length === 0 ? (
              <p className="text-sm font-medium" style={{ color: EV_MUTED }}>
                Aucune note enregistrée.
              </p>
            ) : (
              <div className="space-y-2">
                {completed.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center justify-between p-3"
                    style={{ borderRadius: EV_R.lg, ...listCardSurface() }}
                  >
                    <div>
                      <p className="text-[14px] font-bold text-white/95">{e.title || 'Évaluation'}</p>
                      <p className="text-[10px] font-medium" style={{ color: EV_MUTED }}>
                        {fmt(e.evaluated_at)}
                      </p>
                    </div>
                    <p className="text-[15px] font-extrabold text-amber-200">
                      {e.score}
                      <span className="text-xs font-bold text-amber-200/70">/{e.max_score || 20}</span>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        <LiriPageFooterLine className="w-full" marginClass="mt-4 mb-2" suffix="Évaluations" />
      </div>
    </EleveMobileShell>
  );
}
