import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookOpen, MonitorPlay, Library, PenLine, ChevronRight, GraduationCap } from 'lucide-react';
import {
  LiriMobileScreenShell,
  LiriGoldCard,
  LiriSectionLabel,
} from '@/components/mobile-liri/LiriMobileScreenShell';
import { LIRI_MOBILE } from '@/lib/liriMobileRoutes';
import { LiriWordmark } from '@/components/brand/LiriWordmark';
import { cn } from '@/lib/utils';

const rows = [
  {
    to: '/classroom',
    title: 'Ma classe',
    sub: 'Smartboard, semaines, progression',
    icon: MonitorPlay,
  },
  {
    to: '/formations/mes-formations',
    title: 'Mes formations',
    sub: 'Parcours inscrits',
    icon: GraduationCap,
  },
  {
    to: '/formations/catalogue',
    title: 'Catalogue',
    sub: 'Découvrir un cours',
    icon: Library,
  },
  {
    to: '/notebook',
    title: 'Carnet',
    sub: 'Notes & pratique',
    icon: PenLine,
  },
];

export default function MobileCoursesScreen() {
  return (
    <LiriMobileScreenShell contentClassName="overflow-y-auto pb-6">
      <div className="pt-2 pb-4">
        <LiriSectionLabel>
          <LiriWordmark size="kicker" className="text-current" />
        </LiriSectionLabel>
        <h1 className="mt-1 font-serif text-xl text-[#faf3e6] tracking-tight">Cours</h1>
        <p className="mt-1 text-sm text-white/48">Smartboard, contenu et progression.</p>
      </div>

      <ul className="flex flex-col gap-3">
        {rows.map((item, i) => (
          <motion.li
            key={item.to}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i }}
          >
            <Link to={item.to}>
              <LiriGoldCard className="flex items-center gap-3 p-4 active:scale-[0.99] transition-transform border-[#D4AF37]/28">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#D4AF37]/35 bg-gradient-to-br from-[#D4AF37]/14 to-transparent shadow-[0_0_20px_-8px_rgba(212,175,55,0.25)]">
                  <item.icon className="h-6 w-6 text-[#e8c547]" strokeWidth={1.75} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white/95">{item.title}</p>
                  <p className="text-xs text-white/45">{item.sub}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-white/25 shrink-0" />
              </LiriGoldCard>
            </Link>
          </motion.li>
        ))}
      </ul>

      <Link
        to={LIRI_MOBILE.home}
        className={cn(
          'mt-6 flex items-center justify-center gap-2 text-xs text-[#D4AF37]/80',
        )}
      >
        <BookOpen className="h-3.5 w-3.5" />
        Retour à l’accueil LIRI
      </Link>
    </LiriMobileScreenShell>
  );
}
