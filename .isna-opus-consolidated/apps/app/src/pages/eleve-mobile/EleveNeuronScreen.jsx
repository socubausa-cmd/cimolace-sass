import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Menu, BookOpen, Lightbulb, ListChecks, Brain as BrainIcon, ChevronRight, MessageCircle } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useDataSync } from '@/contexts/DataSyncContext';
import { EleveMobileShell, EleveSectionTitle } from '@/components/eleve-mobile/EleveMobileShell';
import { LiriStatusBar } from '@/pages/eleve-mobile/connection/EleveConnectionLayout';
import {
  EV_BG,
  EV_MUTED,
  EV_LINE,
  firstNameFromUser,
  EV_R,
} from '@/pages/eleve-mobile/eleveMobileScreensShared';
import { cn } from '@/lib/utils';
import { LiriWordmark } from '@/components/brand/LiriWordmark';

const PAGE_AMBIENT =
  'radial-gradient(50% 32% at 50% 0%, rgba(123, 97, 255, 0.14), transparent 70%)';

const ROW_HALO = [
  'rgba(56, 189, 248, 0.12)',
  'rgba(245, 158, 11, 0.12)',
  'rgba(123, 97, 255, 0.14)',
  'rgba(16, 185, 129, 0.12)',
];

function featRowSurface(index) {
  const h = ROW_HALO[index % ROW_HALO.length];
  return {
    background: [
      `radial-gradient(ellipse 100% 78% at 8% 0%, ${h} 0%, transparent 55%)`,
      'linear-gradient(195deg, rgba(24, 26, 40, 0.97) 0%, rgba(10, 12, 24, 0.99) 100%)',
    ].join(', '),
    border: '1px solid rgba(165, 180, 252, 0.18)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07), 0 2px 12px -4px rgba(0,0,0,0.4)',
  };
}

function heroSurface() {
  return {
    background: [
      'radial-gradient(ellipse 100% 80% at 20% 0%, rgba(56, 189, 248, 0.15) 0%, transparent 58%)',
      'radial-gradient(ellipse 60% 50% at 100% 100%, rgba(123, 97, 255, 0.12) 0%, transparent 55%)',
      'linear-gradient(168deg, rgba(28, 32, 52, 0.98) 0%, rgba(14, 16, 30, 0.99) 100%)',
    ].join(', '),
    border: '1px solid rgba(165, 180, 252, 0.2)',
    boxShadow: [
      'inset 0 1px 0 rgba(255,255,255,0.1)',
      '0 12px 36px -14px rgba(79, 70, 229, 0.3)',
      '0 4px 16px -4px rgba(0,0,0,0.45)',
    ].join(', '),
  };
}

function lastConvSurface() {
  return {
    background: [
      'radial-gradient(ellipse 90% 70% at 0% 50%, rgba(99, 102, 241, 0.1) 0%, transparent 60%)',
      'linear-gradient(188deg, rgba(22, 24, 34, 0.96) 0%, rgba(12, 14, 22, 0.99) 100%)',
    ].join(', '),
    border: '1px solid rgba(165, 180, 252, 0.14)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
  };
}

const FEATS = [
  {
    to: '/notebook',
    title: 'Résumer ce cours',
    sub: 'Synthèse claire de tes supports',
    icon: BookOpen,
    iconBox: 'bg-sky-500/20 border-sky-500/35',
    iconColor: 'text-sky-200',
  },
  {
    to: '/notebook',
    title: 'Expliquer un concept',
    sub: 'Définitions et exemples',
    icon: Lightbulb,
    iconBox: 'bg-amber-500/20 border-amber-500/35',
    iconColor: 'text-amber-200',
  },
  {
    to: '/notebook',
    title: 'Créer un quiz',
    sub: 'Questions à choix sur ton chapitre',
    icon: ListChecks,
    iconBox: 'bg-violet-500/20 border-violet-500/35',
    iconColor: 'text-violet-200',
  },
  {
    to: '/notebook',
    title: 'Mémoriser avec moi',
    sub: 'Fiches & répétition espacée',
    icon: BrainIcon,
    iconBox: 'bg-emerald-500/20 border-emerald-500/35',
    iconColor: 'text-emerald-200',
  },
];

const LAST = [
  { t: 'Ondes et lumière', when: "Aujourd'hui · 16:20" },
  { t: 'Chapitre 2 — Bases de chimie', when: 'Hier · 10:12' },
];

function BrainArt() {
  return (
    <div className="relative h-[100px] w-[110px] shrink-0">
      <div
        aria-hidden
        className="absolute inset-0 scale-110 rounded-full opacity-60 blur-2xl"
        style={{ background: 'radial-gradient(circle, rgba(56, 189, 248, 0.55) 0%, rgba(123, 97, 255, 0.4) 45%, transparent 70%)' }}
      />
      <svg
        viewBox="0 0 200 180"
        className="relative h-full w-full drop-shadow-[0_0_24px_rgba(56,189,248,0.45)]"
        aria-hidden
      >
        <path
          d="M100 20 C 55 20 30 50 32 90 C 34 120 50 150 100 160 C 150 150 168 120 170 90 C 172 50 145 20 100 20 Z"
          fill="url(#nr-br)"
        />
        <path
          d="M 78 70 Q 100 50 122 70 Q 100 90 78 70"
          fill="none"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth="1.2"
        />
        <path
          d="M 65 100 Q 100 80 135 100"
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="1"
        />
        <defs>
          <linearGradient id="nr-br" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#7dd3fc" />
            <stop offset="0.45" stopColor="#7B61FF" />
            <stop offset="1" stopColor="#4c1d95" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

export default function EleveNeuronScreen() {
  const { user } = useAuth();
  const { notifications: sync } = useDataSync();
  const unread = (Array.isArray(sync) ? sync : []).filter((n) => !n.isRead).length;
  const prenom = firstNameFromUser(user);

  return (
    <EleveMobileShell user={user} notificationCount={unread} hideHeader contentClassName="!px-0">
      <div
        className="flex w-full flex-1 flex-col"
        style={{
          minHeight: '100dvh',
          backgroundColor: EV_BG,
          backgroundImage: PAGE_AMBIENT,
        }}
      >
        <div className="px-4 pt-[max(0.35rem,env(safe-area-inset-top))]">
          <LiriStatusBar />
        </div>

        <div className="px-4 pb-4">
          <div className="mb-4 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <LiriWordmark size="kicker" className="text-white/40" />
              <div className="mt-0.5 flex flex-wrap items-center gap-2">
                <h1 className="text-[22px] font-extrabold leading-tight tracking-[-0.02em] text-white">Neuron IA</h1>
                <span
                  className="shrink-0 rounded-md border border-violet-500/40 px-1.5 py-0.5 text-[7.5px] font-extrabold uppercase tracking-wider"
                  style={{ background: 'rgba(123, 97, 255, 0.2)', color: 'rgba(196, 181, 253, 0.95)' }}
                >
                  BÊTA
                </span>
              </div>
              <p className="mt-1 text-[13px] font-medium" style={{ color: EV_MUTED }}>
                Aide pédagogique, quiz et fiches
              </p>
            </div>
            <Link
              to="/notebook"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border active:scale-95"
              style={{ borderColor: EV_LINE, background: 'rgba(255,255,255,0.05)' }}
              aria-label="Ouvrir le carnet Neuron"
            >
              <Menu className="h-5 w-5 text-white/88" strokeWidth={2} />
            </Link>
          </div>

        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative mb-5 flex items-center justify-between gap-2 overflow-hidden p-4"
          style={{ borderRadius: EV_R.lg, ...heroSurface() }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-4 -top-6 h-28 w-28 rounded-full opacity-40 blur-2xl"
            style={{ background: 'radial-gradient(circle, rgba(196, 181, 253, 0.35) 0%, transparent 70%)' }}
          />
          <div className="relative min-w-0 flex-1 pr-1">
            <p className="text-[19px] font-extrabold leading-tight text-white">
              Salut {prenom} ! <span className="inline-block">👋</span>
            </p>
            <p className="mt-1.5 text-[12px] leading-relaxed" style={{ color: EV_MUTED }}>
              Demande de l&apos;aide sur ton cours, en un clic.
            </p>
          </div>
          <BrainArt />
        </motion.div>

        <div className="mb-5 space-y-2.5">
          {FEATS.map((f, i) => {
            const Ic = f.icon;
            return (
              <Link key={f.title} to={f.to} className="block">
                <div
                  className="flex min-h-[72px] items-center gap-3 p-3.5 pl-3 active:scale-[0.99] active:opacity-95"
                  style={{ borderRadius: EV_R.md, ...featRowSurface(i) }}
                >
                  <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border', f.iconBox)}>
                    <Ic className={cn('h-5 w-5', f.iconColor)} strokeWidth={2.1} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold text-white">{f.title}</p>
                    <p className="mt-0.5 text-[11.5px] leading-snug" style={{ color: EV_MUTED }}>
                      {f.sub}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-white/30" strokeWidth={2.2} />
                </div>
              </Link>
            );
          })}
        </div>

        <EleveSectionTitle className="mb-2.5">Dernières conversations</EleveSectionTitle>
        <div className="space-y-2">
          {LAST.map((x) => (
            <Link
              key={x.t}
              to="/notebook"
              className="flex items-center justify-between gap-2 px-3 py-3 transition active:scale-[0.99]"
              style={{ borderRadius: EV_R.sm, ...lastConvSurface() }}
            >
              <div className="flex min-w-0 items-center gap-2">
                <MessageCircle className="h-4 w-4 shrink-0 text-violet-300/85" strokeWidth={2} />
                <span className="line-clamp-1 text-[13px] font-medium text-white/95">{x.t}</span>
              </div>
              <span className="shrink-0 pl-1 text-[10.5px] tabular-nums" style={{ color: EV_MUTED }}>
                {x.when}
              </span>
            </Link>
          ))}
        </div>
        </div>
      </div>
    </EleveMobileShell>
  );
}
