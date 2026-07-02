import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ChevronRight, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useDataSync } from '@/contexts/DataSyncContext';
import { EleveMobileShell } from '@/components/eleve-mobile/EleveMobileShell';
import { useStudentEnrollmentsList } from '@/hooks/useStudentEnrollmentsList';
import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';
import { LiriPageFooterLine } from '@/components/brand/LiriWordmark';
import { EV_BG, EV_MUTED, EV_PAGE_AMBIENT, EV_R, listCardSurface } from '@/pages/school/eleve-mobile/vieScolaire/vieScolaireSharedUI.jsx';

/**
 * Même source que `StudentFormationsPage` (`useStudentEnrollmentsList`).
 * Route : `/m/eleve/etudiant/formations`
 */
export default function EleveEtudiantFormationsScreen() {
  const { user } = useAuth();
  const { notifications: sync } = useDataSync();
  const inboxUnread = (Array.isArray(sync) ? sync : []).filter((n) => !n.isRead).length;
  const { enrolledFormations, loading } = useStudentEnrollmentsList(user?.id);

  return (
    <EleveMobileShell
      user={user}
      notificationCount={inboxUnread}
      contentClassName="!px-0"
      kicker="Espace étudiant"
      title="Mes formations"
      subtitle="Inscriptions (comme le portail web)"
    >
      <div
        className="w-full px-4 pb-2"
        style={{ backgroundColor: EV_BG, backgroundImage: EV_PAGE_AMBIENT, minHeight: '50dvh' }}
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3" aria-busy>
            <Loader2 className="h-8 w-8 animate-spin text-orange-300" />
            <p className="text-sm font-medium" style={{ color: EV_MUTED }}>
              Chargement…
            </p>
          </div>
        ) : enrolledFormations.length === 0 ? (
          <p className="py-6 text-sm font-medium" style={{ color: EV_MUTED }}>
            Aucune formation inscrite.
          </p>
        ) : (
          <div className="space-y-2.5">
            {enrolledFormations.map((f) => (
              <div key={f.enrollmentId} className="p-3.5" style={{ borderRadius: EV_R.lg, ...listCardSurface() }}>
                <p className="text-[15px] font-extrabold text-white/95">{f.title}</p>
                <p className="mt-1 line-clamp-2 text-[11.5px] font-medium leading-relaxed" style={{ color: EV_MUTED }}>
                  {(f.description || '').slice(0, 160) || '—'}
                </p>
                <p className="mt-2 text-[9px] font-extrabold uppercase tracking-wider text-white/40">
                  {f.status === 'completed' ? 'Terminé' : 'En cours'}
                </p>
                {f.id ? (
                  <Link
                    to={ELEVE_MOBILE.course(f.id)}
                    className="mt-3 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] font-bold text-orange-200"
                  >
                    <span className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4" />
                      Ouvrir dans LIRI
                    </span>
                    <ChevronRight className="h-4 w-4 text-white/40" />
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
        )}
        <LiriPageFooterLine className="w-full" marginClass="mt-4 mb-2" suffix="Formations" />
      </div>
    </EleveMobileShell>
  );
}
