/**
 * Laboratoire Cours — hub du Studio Créateur (constructeur de cours)
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Wand2, GraduationCap, Sparkles, Compass, BookMarked } from 'lucide-react';
import useTenantBranding from '@/hooks/useTenantBranding';

const CARDS = [
  {
    to: '/studio/formation-llm-builder',
    icon: Wand2,
    title: 'Formation LLM Builder',
    desc: 'Point d entree unique pour creer un cours via IA, sans dispersion entre plusieurs constructeurs.',
    tag: 'Course Building',
    accent: 'from-[#d97757]/15 to-transparent',
  },
  {
    to: '/studio/formation',
    icon: GraduationCap,
    title: 'Parcours formation',
    desc: 'Modules, leçons et parcours pédagogiques structurés.',
    tag: 'Academy',
    accent: 'from-[#d97757]/15 to-transparent',
  },
];

export default function StudioCourseLabPage() {
  const { branding, cssVars } = useTenantBranding();

  return (
    <div
      className="relative flex min-h-dvh flex-col overflow-hidden p-6 text-white md:p-10"
      data-school-shell="studio-course-lab"
      data-tenant-brand={branding.slug}
      style={{
        ...cssVars,
        background: 'var(--school-background, #0a0908)',
        fontFamily: 'var(--school-font-family, Inter, sans-serif)',
      }}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-16 top-1/4 h-64 w-64 rounded-full bg-[#c96544]/10 blur-[100px]" />
        <div
          className="absolute bottom-0 right-0 h-72 w-72 rounded-full blur-[100px]"
          style={{ backgroundColor: 'color-mix(in srgb, var(--school-accent, #D4AF37) 6%, transparent)' }}
        />
      </div>
      <div className="relative mx-auto max-w-4xl">
        <Link
          to="/studio"
          className="mb-8 inline-flex items-center gap-2 font-display text-sm text-white/45 transition-colors hover:text-[var(--school-accent,#D4AF37)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Studio Créateur
        </Link>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div className="mb-2 flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-[#e08a5f]" />
            <p className="font-display text-xs font-semibold uppercase tracking-[0.26em] text-[#e8a97f]/85">
              Laboratoire Cours
            </p>
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">Constructeur de cours</h1>
          <p className="mt-3 max-w-xl text-base text-white/55 md:text-lg">
            Choisissez un outil pour créer ou enrichir vos contenus pédagogiques.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="mt-8 rounded-2xl border border-[#e0a458]/20 bg-gradient-to-br from-[#2e2016]/40 via-[#0a0908] to-transparent p-5 md:p-6"
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#d4924a]/15 text-[#ecc98f]">
                <Compass className="h-5 w-5" />
              </div>
              <div>
                <p className="font-display text-[10px] font-semibold uppercase tracking-[0.2em] text-[#ecc98f]/90">
                  Tous les constructeurs LIRI
                </p>
                <p className="mt-1 max-w-lg text-sm text-white/55">
                  Parcours modulaire, cours contenu unique, volet scolaire (calendrier / école du futur), SmartBoard… — hub
                  de choix + guide comparatif (avantages, publics, lien cahier des charges).
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/studio/liri/constructeurs"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#e0a458]/35 bg-[#2e2016]/30 px-4 py-2.5 text-sm font-medium text-[#f0d9b8] transition-colors hover:border-[#e6b566]/50 hover:bg-[#d4924a]/10"
              >
                <Compass className="h-4 w-4" />
                Hub constructeurs
              </Link>
              <Link
                to="/studio/liri/constructeurs/guide"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/85 transition-colors hover:bg-white/10"
              >
                <BookMarked className="h-4 w-4" />
                Guide comparatif
              </Link>
            </div>
          </div>
        </motion.div>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {CARDS.map((c, i) => (
            <motion.div
              key={c.to}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 * i }}
            >
              <Link
                to={c.to}
                className={`block h-full rounded-2xl border bg-gradient-to-br p-6 transition-colors hover:border-[color:var(--school-accent,#D4AF37)] ${c.accent}`}
                style={{ borderColor: 'color-mix(in srgb, var(--school-accent, #D4AF37) 10%, transparent)' }}
              >
                <c.icon className="w-8 h-8 text-white/80 mb-4" />
                <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1">{c.tag}</p>
                <h2 className="font-display mb-2 text-xl font-semibold tracking-tight text-white">{c.title}</h2>
                <p className="text-sm text-white/50 leading-relaxed">{c.desc}</p>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
