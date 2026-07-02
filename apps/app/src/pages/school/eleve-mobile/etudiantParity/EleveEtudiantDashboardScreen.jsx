import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Award, AlertTriangle, Bell, BookOpen, Calendar, CheckCircle, Clock, ChevronRight, LayoutDashboard } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useDataSync } from '@/contexts/DataSyncContext';
import { EleveMobileShell, EleveSectionTitle } from '@/components/eleve-mobile/EleveMobileShell';
import { useStudentDashboardParityData } from '@/hooks/useStudentDashboardParityData';
import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';
import { LiriPageFooterLine } from '@/components/brand/LiriWordmark';
import { format, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { EV_BG, EV_MUTED, EV_PAGE_AMBIENT, EV_R, listCardSurface, StatBox } from '@/pages/school/eleve-mobile/vieScolaire/vieScolaireSharedUI.jsx';

function safeFormat(dateInput, formatStr) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  return isValid(d) ? format(d, formatStr, { locale: fr }) : '';
}

/**
 * Aperçu aligné sur `StudentDashboard` (mêmes tables Supabase).
 * Route : `/m/eleve/etudiant`
 */
export default function EleveEtudiantDashboardScreen() {
  const { user } = useAuth();
  const { notifications: sync } = useDataSync();
  const inboxUnread = (Array.isArray(sync) ? sync : []).filter((n) => !n.isRead).length;
  const { loading, formations, notifications, absences, delays, evaluations, agenda, moyenneLabel, refresh } =
    useStudentDashboardParityData(user?.id);

  const weeksValidated = `${formations.filter((f) => Number(f.progress || 0) >= 100).length}/${formations.length || 0}`;

  return (
    <EleveMobileShell
      user={user}
      notificationCount={inboxUnread}
      contentClassName="!px-0"
      kicker="Espace étudiant"
      title="Tableau de bord"
      subtitle="Même source de données que le portail web."
    >
      <div
        className="w-full pb-2"
        style={{ backgroundColor: EV_BG, backgroundImage: EV_PAGE_AMBIENT, minHeight: '60dvh' }}
      >
        <div className="px-4 pb-3">
          {loading ? (
            <div className="grid grid-cols-2 gap-2.5 py-2" aria-busy>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-[88px] animate-pulse rounded-[18px] border border-white/[0.08] bg-white/[0.04]" />
              ))}
            </div>
          ) : (
            <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <StatBox label="Moyenne" value={moyenneLabel} icon={Award} tone="amber" />
              <StatBox label="Semaines valid." value={weeksValidated} icon={CheckCircle} tone="emerald" />
              <StatBox label="Absences" value={String(absences.length)} icon={AlertTriangle} tone="rose" />
              <StatBox label="Retards" value={String(delays.length)} icon={Clock} tone="sky" />
            </div>
          )}

          <button
            type="button"
            onClick={() => void refresh()}
            className="mb-4 w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 text-[12px] font-bold text-white/80 active:scale-[0.99]"
          >
            Actualiser les données
          </button>

          <div className="space-y-3">
            <SectionLink
              to={ELEVE_MOBILE.etudiantFormations}
              icon={BookOpen}
              title="Mes formations"
              sub="Inscriptions & parcours"
            />
            <SectionLink
              to={ELEVE_MOBILE.etudiantEvaluations}
              icon={LayoutDashboard}
              title="Évaluations"
              sub="Notes & prochains examens"
            />
            <SectionLink
              to={ELEVE_MOBILE.etudiantNotes}
              icon={Award}
              title="Notes & résultats"
              sub="Détail & moyenne"
            />
            <SectionLink
              to={ELEVE_MOBILE.etudiantAbsences}
              icon={AlertTriangle}
              title="Absences & assiduité"
              sub="Historique & statuts"
            />
            <SectionLink
              to={ELEVE_MOBILE.etudiantDocuments}
              icon={Bell}
              title="Documents"
              sub="Factures, comptes rendus, certificats"
            />
            <SectionLink
              to={ELEVE_MOBILE.agenda}
              icon={Calendar}
              title="Agenda LIRI"
              sub="Planning unifié (lives, RDV, école)"
            />
          </div>
        </div>

        <div className="px-4">
          <EleveSectionTitle className="!mb-2">Aperçu rapide</EleveSectionTitle>
          <div className="space-y-2.5">
            {notifications.slice(0, 2).map((n) => (
              <div key={n.id} className="p-3" style={{ borderRadius: EV_R.lg, ...listCardSurface() }}>
                <p className="line-clamp-2 text-[12px] text-white/90">{n.message}</p>
                <p className="mt-0.5 text-[9.5px] font-medium" style={{ color: EV_MUTED }}>
                  {safeFormat(n.date, 'd MMM')}
                </p>
              </div>
            ))}
            {!notifications.length && !loading ? (
              <p className="text-[12px] font-medium" style={{ color: EV_MUTED }}>
                Aucune notification récente.
              </p>
            ) : null}
            {evaluations.slice(0, 1).map((ev) => (
              <div key={ev.id} className="flex items-center justify-between p-3" style={{ borderRadius: EV_R.lg, ...listCardSurface() }}>
                <div>
                  <p className="text-[13px] font-bold text-white">{ev.title}</p>
                  <p className="text-[10px] font-medium" style={{ color: EV_MUTED }}>
                    {safeFormat(ev.date, 'd MMM yyyy')}
                  </p>
                </div>
                <span className="text-amber-200/90">
                  {ev.score}/{ev.max}
                </span>
              </div>
            ))}
            {agenda.slice(0, 1).map((a) => (
              <div key={a.id} className="p-3" style={{ borderRadius: EV_R.lg, ...listCardSurface() }}>
                <p className="text-[13px] font-bold text-white">{a.title}</p>
                <p className="text-[11px]" style={{ color: EV_MUTED }}>
                  {safeFormat(a.date, "EEE d MMM")} · {a.time} · {a.location}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="px-4">
          <LiriPageFooterLine className="w-full" marginClass="mt-4 mb-2" suffix="Espace étudiant" />
        </div>
      </div>
    </EleveMobileShell>
  );
}

function SectionLink({ to, icon: Icon, title, sub }) {
  return (
    <Link to={to} className="block min-w-0">
      <motion.div
        whileTap={{ scale: 0.99 }}
        className="flex items-center gap-3 p-3"
        style={{ borderRadius: EV_R.lg, ...listCardSurface() }}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-orange-500/15 text-orange-200 ring-1 ring-orange-400/25">
          <Icon className="h-[18px] w-[18px]" strokeWidth={2.1} />
        </div>
        <div className="min-w-0 flex-1 text-left">
          <p className="truncate text-[14px] font-extrabold text-white/95">{title}</p>
          <p className="mt-0.5 truncate text-[10.5px] font-medium" style={{ color: EV_MUTED }}>
            {sub}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-white/35" />
      </motion.div>
    </Link>
  );
}
