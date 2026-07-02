import React from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CalendarDays } from 'lucide-react';
import { EleveSectionTitle } from '@/components/eleve-mobile/EleveMobileShell';
import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';
import { EV_BG, EV_MUTED, EV_PAGE_AMBIENT, EV_R, listCardSurface, safeFormat } from './vieScolaireSharedUI.jsx';

export default function EleveVieScolaireCalendrierTab() {
  const data = useOutletContext();
  if (!data) return null;
  const { loading, agenda } = data;

  return (
    <div
      className="w-full px-4 pb-3 pt-0"
      style={{ backgroundColor: EV_BG, backgroundImage: EV_PAGE_AMBIENT, minHeight: '40dvh' }}
    >
      <EleveSectionTitle className="!mb-2" action="Tout l'agenda" actionTo={ELEVE_MOBILE.agenda}>
        Événements école
      </EleveSectionTitle>
      {loading ? (
        <div className="space-y-2.5 py-1" aria-busy>
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-[72px] animate-pulse rounded-[16px] border border-white/[0.08] bg-white/[0.04]"
            />
          ))}
        </div>
      ) : (agenda || []).length === 0 ? (
        <div
          className="flex items-start gap-3 p-3.5"
          style={{ borderRadius: EV_R.lg, ...listCardSurface() }}
        >
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
            style={{ background: 'rgba(217, 119, 87, 0.15)' }}
          >
            <CalendarDays className="h-5 w-5 text-orange-300" />
          </div>
          <div>
            <p className="text-[14px] font-extrabold text-white/95">Aucun événement bientôt</p>
            <p className="mt-0.5 text-[12.5px] font-medium leading-relaxed" style={{ color: EV_MUTED }}>
              Dès qu'il est prêt, le calendrier du secrétariat s\'affichera ici (et dans l\'agenda).
            </p>
            <Link
              to={ELEVE_MOBILE.agenda}
              className="mt-2.5 inline-flex text-[12px] font-bold text-orange-300/95 underline-offset-2 hover:underline"
            >
              Ouvrir l'agenda LIRI
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {agenda.map((a, idx) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(0.04 * idx, 0.2) }}
              className="relative overflow-hidden p-3.5 pl-4"
              style={{ borderRadius: EV_R.lg, ...listCardSurface() }}
            >
              <div
                className="absolute bottom-0 left-0 top-0 w-1 bg-gradient-to-b from-amber-400/90 to-orange-500/70"
                aria-hidden
              />
              <p className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: EV_MUTED }}>
                {safeFormat(a.when, "EEE d MMM '·' HH:mm")}
              </p>
              <p className="mt-1 text-[15px] font-extrabold leading-tight text-white">{a.title}</p>
              {a.loc ? (
                <p className="mt-1 text-[12px] font-medium" style={{ color: EV_MUTED }}>
                  {a.loc}
                </p>
              ) : null}
              {a.desc ? (
                <p className="mt-1 line-clamp-2 text-[11.5px] font-medium leading-relaxed" style={{ color: EV_MUTED, opacity: 0.85 }}>
                  {a.desc}
                </p>
              ) : null}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
