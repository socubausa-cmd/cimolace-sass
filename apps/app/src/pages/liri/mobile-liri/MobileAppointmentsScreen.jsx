import React from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, ChevronRight, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { LiriMobileScreenShell, LiriGoldCard } from '@/components/liri/mobile-liri/LiriMobileScreenShell';
import { LIRI_MOBILE } from '@/lib/liriMobileRoutes';

export default function MobileAppointmentsScreen() {
  const { user } = useAuth();

  return (
    <LiriMobileScreenShell contentClassName="overflow-y-auto pb-8">
      <div className="pb-6 pt-1">
        <p className="font-display text-[10px] font-semibold uppercase tracking-[0.26em] text-[color-mix(in_srgb,var(--school-accent)_90%,transparent)]">
          LIRI
        </p>
        <h1 className="font-display mt-2 text-[1.75rem] font-semibold leading-tight tracking-tight text-[#f8efd9]">
          Mes rendez-vous
        </h1>
        <p className="mt-2 text-base leading-relaxed text-white/50">
          Consultez et gérez vos sessions réservées.
        </p>
      </div>

      {!user ? (
        <LiriGoldCard className="p-4 mb-4">
          <p className="text-sm text-white/70">Connectez-vous pour voir vos rendez-vous.</p>
          <Link
            to="/login"
            className="mt-3 flex h-10 items-center justify-center rounded-xl bg-gradient-to-r from-[var(--school-accent)] to-[#c9a227] text-sm font-semibold text-black"
          >
            Connexion
          </Link>
        </LiriGoldCard>
      ) : null}

      <Link to="/coaching-sessions">
        <LiriGoldCard className="flex items-center gap-3 p-4 active:scale-[0.99] transition-transform">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)]">
            <CalendarClock className="h-5 w-5 text-[var(--school-accent)]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-white/95">Coaching & sessions</p>
            <p className="text-xs text-white/45">Ouvrir le planning des séances</p>
          </div>
          <ChevronRight className="h-5 w-5 text-white/25 shrink-0" />
        </LiriGoldCard>
      </Link>

      <Link to="/prospect/entretien" className="mt-3 block">
        <LiriGoldCard className="flex items-center gap-3 p-4 active:scale-[0.99] transition-transform">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_12%,transparent)]">
            <Sparkles className="h-5 w-5 text-[var(--school-accent)]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-white/95">Salon entretien Prorascience</p>
            <p className="text-xs text-white/45">Compte à rebours, parcours et accès session</p>
          </div>
          <ChevronRight className="h-5 w-5 text-white/25 shrink-0" />
        </LiriGoldCard>
      </Link>

      <Link
        to={LIRI_MOBILE.booking}
        className="mt-3 block text-center text-sm text-[color-mix(in_srgb,var(--school-accent)_85%,transparent)]"
      >
        Prendre un nouveau rendez-vous
      </Link>
    </LiriMobileScreenShell>
  );
}
