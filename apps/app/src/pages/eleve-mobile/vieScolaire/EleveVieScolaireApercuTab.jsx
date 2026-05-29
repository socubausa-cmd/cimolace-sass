import React from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  School,
  CalendarDays,
  Award,
  AlertTriangle,
  Clock,
  ChevronRight,
  User,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';
import {
  EV_ACCENT,
  EV_BG,
  EV_MUTED,
  EV_PAGE_AMBIENT,
  EV_R,
  EV_SH,
  pagePanelSurface,
  listCardSurface,
  StatBox,
} from './vieScolaireSharedUI.jsx';

/**
 * Sous-écran Aperçu (route index). Context : retour de `useVieScolaireData`.
 */
export default function EleveVieScolaireApercuTab() {
  const data = useOutletContext();
  if (!data) return null;
  const {
    loading,
    moyenneLabel,
    enrollmentCount,
    formationTitles,
    absenceCount,
    delayCount,
  } = data;

  return (
    <div
      className="w-full"
      style={{
        backgroundColor: EV_BG,
        backgroundImage: EV_PAGE_AMBIENT,
        minHeight: '60dvh',
      }}
    >
      <div className="px-4 pb-3 pt-0.5">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden"
          style={{ borderRadius: EV_R.lg, ...pagePanelSurface() }}
        >
          <div className="flex items-center gap-3 p-3.5">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center"
              style={{
                borderRadius: EV_R.md,
                background: 'linear-gradient(145deg, rgba(123,97,255,0.4) 0%, rgba(59,130,246,0.25) 100%)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12), 0 6px 20px -8px rgba(99, 102, 241, 0.45)',
                border: '1px solid rgba(255,255,255,0.12)',
              }}
            >
              <School className="h-5 w-5 text-white" strokeWidth={2.1} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">Espace scolaire</p>
              <h1 className="mt-0.5 font-serif text-[22px] font-bold leading-tight tracking-tight text-[#fbf3df]">
                Vue d'ensemble
              </h1>
              <p className="mt-0.5 text-[12px] leading-snug" style={{ color: EV_MUTED }}>
                L'onglet En ligne (barre du bas) mène à toutes les rubriques du portail. Ici : aperçu, calendrier, notes, annonces.
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="px-4 pb-3">
        {loading ? (
          <div className="space-y-4 py-2" aria-busy>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-[88px] animate-pulse rounded-[18px] border border-white/[0.08] bg-white/[0.04]"
                />
              ))}
            </div>
            <div className="h-24 animate-pulse rounded-[16px] bg-white/[0.04]" />
          </div>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <StatBox label="Moy. (aperçu)" value={moyenneLabel} icon={Award} tone="amber" />
              <StatBox
                label="Inscriptions"
                value={String(enrollmentCount)}
                icon={BookOpen}
                tone="emerald"
              />
              <StatBox
                label="Absences (connues)"
                value={String(absenceCount)}
                icon={AlertTriangle}
                tone="rose"
              />
              <StatBox
                label="Retards (connus)"
                value={String(delayCount)}
                icon={Clock}
                tone="sky"
              />
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
              <Link
                to={ELEVE_MOBILE.agenda}
                className="inline-flex h-10 min-h-[40px] items-center gap-1.5 rounded-full px-3.5 text-[12px] font-bold text-white transition-transform active:scale-[0.99]"
                style={{
                  background: `linear-gradient(100deg, ${EV_ACCENT} 0%, #3b3cde 100%)`,
                  boxShadow: EV_SH.cta,
                }}
              >
                <CalendarDays className="h-4 w-4 opacity-95" />
                Agenda
                <ChevronRight className="h-3.5 w-3.5 opacity-80" />
              </Link>
              <Link
                to={ELEVE_MOBILE.bibliotheque}
                className="inline-flex h-10 items-center gap-1 rounded-full border border-white/18 bg-white/[0.07] px-3 text-[11.5px] font-bold text-white/92 backdrop-blur-sm"
              >
                Cours
                <ChevronRight className="h-3.5 w-3.5 opacity-55" />
              </Link>
              <Link
                to={ELEVE_MOBILE.classe}
                className="inline-flex h-10 items-center gap-1 rounded-full border border-white/18 bg-white/[0.07] px-3 text-[11.5px] font-bold text-white/92 backdrop-blur-sm"
              >
                <User className="h-3.5 w-3.5" />
                Classe
                <ChevronRight className="h-3.5 w-3.5 opacity-55" />
              </Link>
            </div>
            {formationTitles.length > 0 ? (
              <div
                className="mb-0 flex items-start gap-2.5 px-3.5 py-2.5"
                style={{ borderRadius: EV_R.lg, ...listCardSurface() }}
              >
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-300/90" />
                <p className="text-[12px] font-medium leading-snug" style={{ color: EV_MUTED }}>
                  <span className="mb-0.5 block text-[9px] font-extrabold uppercase tracking-wider text-white/45">
                    Parcours
                  </span>
                  {formationTitles.slice(0, 3).join(' · ')}
                  {formationTitles.length > 3 ? '…' : ''}
                </p>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
