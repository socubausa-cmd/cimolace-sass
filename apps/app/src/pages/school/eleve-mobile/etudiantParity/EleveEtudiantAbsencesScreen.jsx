import React from 'react';
import { AlertTriangle, CheckCircle, Clock, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useDataSync } from '@/contexts/DataSyncContext';
import { EleveMobileShell } from '@/components/eleve-mobile/EleveMobileShell';
import { useStudentAttendanceRecords } from '@/hooks/useStudentAttendanceRecords';
import { LiriPageFooterLine } from '@/components/brand/LiriWordmark';
import { format, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { EV_BG, EV_MUTED, EV_PAGE_AMBIENT, EV_R, listCardSurface } from '@/pages/school/eleve-mobile/vieScolaire/vieScolaireSharedUI.jsx';

/**
 * Même source que `StudentAbsencesPage` (`useStudentAttendanceRecords`).
 * Route : `/m/eleve/etudiant/absences`
 */
export default function EleveEtudiantAbsencesScreen() {
  const { user } = useAuth();
  const { notifications: sync } = useDataSync();
  const inboxUnread = (Array.isArray(sync) ? sync : []).filter((n) => !n.isRead).length;
  const { rows, loading } = useStudentAttendanceRecords(user?.id);

  const mapped = rows.map((r) => {
    const d = r.attendance_date ? new Date(r.attendance_date) : null;
    return {
      id: r.id,
      date: d && isValid(d) ? format(d, 'dd/MM/yyyy', { locale: fr }) : String(r.attendance_date || ''),
      duration: r.status === 'late' ? 'Retard' : r.status === 'excused' ? 'Justifiée' : 'Absence',
      reason: r.note,
      status: r.status === 'excused' ? 'justified' : r.status === 'late' ? 'pending' : 'unjustified',
    };
  });

  const unjust = mapped.filter((a) => a.status === 'unjustified').length;
  const justified = mapped.filter((a) => a.status === 'justified').length;

  return (
    <EleveMobileShell
      user={user}
      notificationCount={inboxUnread}
      contentClassName="!px-0"
      kicker="Espace étudiant"
      title="Absences & assiduité"
      subtitle="Historique (même table que le web)"
    >
      <div
        className="w-full px-4 pb-2"
        style={{ backgroundColor: EV_BG, backgroundImage: EV_PAGE_AMBIENT, minHeight: '50dvh' }}
      >
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-violet-300" />
          </div>
        ) : (
          <>
            <div className="mb-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl border border-white/10 p-2">
                <p className="text-xl font-extrabold text-white/95">{mapped.length}</p>
                <p className="text-[8px] font-extrabold uppercase tracking-wider" style={{ color: EV_MUTED }}>
                  Total
                </p>
              </div>
              <div className="rounded-2xl border border-rose-500/30 p-2">
                <p className="text-xl font-extrabold text-rose-300">{unjust}</p>
                <p className="text-[8px] font-extrabold uppercase tracking-wider" style={{ color: EV_MUTED }}>
                  Non just.
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-500/30 p-2">
                <p className="text-xl font-extrabold text-emerald-300">{justified}</p>
                <p className="text-[8px] font-extrabold uppercase tracking-wider" style={{ color: EV_MUTED }}>
                  Justif.
                </p>
              </div>
            </div>
            {mapped.length === 0 ? (
              <p className="py-4 text-sm font-medium" style={{ color: EV_MUTED }}>
                Aucun enregistrement d'assiduité.
              </p>
            ) : (
              <div className="space-y-2">
                {mapped.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-start gap-2 p-3"
                    style={{ borderRadius: EV_R.lg, ...listCardSurface() }}
                  >
                    {a.status === 'justified' ? (
                      <CheckCircle className="mt-0.5 h-4 w-4 text-emerald-400" />
                    ) : a.status === 'pending' ? (
                      <Clock className="mt-0.5 h-4 w-4 text-amber-400" />
                    ) : (
                      <AlertTriangle className="mt-0.5 h-4 w-4 text-rose-400" />
                    )}
                    <div>
                      <p className="text-[13px] font-bold text-white/95">
                        {a.date} · {a.duration}
                      </p>
                      {a.reason ? (
                        <p className="mt-0.5 text-[11px] font-medium" style={{ color: EV_MUTED }}>
                          {a.reason}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        <LiriPageFooterLine className="w-full" marginClass="mt-4 mb-2" suffix="Absences" />
      </div>
    </EleveMobileShell>
  );
}
