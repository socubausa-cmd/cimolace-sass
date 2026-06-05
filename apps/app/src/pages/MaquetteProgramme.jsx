import React from 'react';
import { ArrowRight, Lock } from 'lucide-react';
import { MAQ_THEME } from '@/components/maquette/maqTheme';
import { MaqNav } from '@/components/maquette/MaqNav';
import { MaqFooter } from '@/components/maquette/MaqFooter';
import { FeaturesAtouts } from '@/components/ui/features-8';

const gold = { color: 'var(--gold)' };

const PHASES = [
  { n: '01', t: 'Comprendre', s: 'Cursus', d: 'Lois invisibles, métaphysique, énergie, structure des rituels.' },
  { n: '02', t: 'Pratiquer', s: 'Modules', d: 'Libation, talisman, protection, guérison.' },
  { n: '03', t: 'Exercer', s: 'Coaching', d: 'Apprendre le métier, accompagner, diagnostiquer.' },
  { n: '04', t: 'Évoluer', s: 'Spécial', d: 'Techniques avancées, secrets spirituels, cas complexes.' },
];

const OUTILS = [
  { t: 'LIRI Live Immersion', d: 'Cours à distance en immersion, interaction directe, suivi contextuel.' },
  { t: 'Smartboard scientifique', d: 'Les lois et mécanismes deviennent visibles : schémas, causalité, séquences.' },
  { t: 'Chat immersif', d: 'Un guide conversationnel vers la bonne action au bon moment.' },
  { t: 'Neuron QR', d: 'Le pont entre cours, capsule, exercice et validation terrain.' },
  { t: 'Certification progressive', d: 'Une montée en compétence traçable, validée par étapes.' },
];

export default function MaquetteProgramme() {
  return (
    <div className="mq2 fixed inset-0 z-[100] overflow-y-auto" style={{ background: 'var(--bg)', color: 'var(--fg)' }}>
      <style>{MAQ_THEME}</style>
      <MaqNav active="programme" />

      {/* ===== Hero ===== */}
      <section className="relative border-b py-24" style={{ borderColor: 'var(--border)' }}>
        <div className="mx-auto max-w-4xl px-6 text-center">
          <p className="text-[12px] font-semibold uppercase tracking-[0.4em]" style={gold}>Le plan du cours · ISNA</p>
          <h1 className="mq-display mt-5 text-5xl font-semibold leading-[0.95] sm:text-7xl">Comprendre avant d&apos;agir.</h1>
          <p className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed" style={{ color: 'var(--muted)' }}>
            Vous n&apos;êtes pas ici pour reproduire des gestes. Vous êtes ici pour comprendre, maîtriser, puis évoluer.
          </p>
        </div>
      </section>

      {/* ===== Statement rupture ===== */}
      <section className="relative border-b py-20 text-center" style={{ borderColor: 'var(--border)' }}>
        <div className="mx-auto max-w-3xl px-6">
          <p className="mq-display text-2xl font-semibold leading-snug sm:text-3xl">
            La pratique sans compréhension est aveugle. La compréhension sans pratique est inutile.
          </p>
          <p className="mt-5 text-[12px] font-semibold uppercase tracking-[0.3em]" style={gold}>
            Ce n&apos;est pas une formation. C&apos;est une transformation.
          </p>
        </div>
      </section>

      {/* ===== Quatre phases ===== */}
      <section className="relative border-b py-24" style={{ borderColor: 'var(--border)' }}>
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center">
            <p className="text-[12px] font-semibold uppercase tracking-[0.4em]" style={gold}>Le parcours</p>
            <h2 className="mq-display mt-4 text-4xl font-semibold sm:text-5xl">Quatre phases.</h2>
          </div>
          <div className="mx-auto mt-14 grid max-w-5xl grid-cols-1 gap-px overflow-hidden rounded-2xl border text-left sm:grid-cols-2 lg:grid-cols-4" style={{ borderColor: 'var(--border)', background: 'var(--border)' }}>
            {PHASES.map((p) => (
              <div key={p.n} className="p-8" style={{ background: 'var(--bg)' }}>
                <div className="text-sm font-bold" style={gold}>{p.n}</div>
                <div className="mq-display mt-2 text-2xl font-semibold">{p.t}</div>
                <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--muted2)' }}>{p.s}</div>
                <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--muted2)' }}>{p.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Les outils ===== */}
      <section className="relative border-b py-24" style={{ borderColor: 'var(--border)' }}>
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center">
            <p className="text-[12px] font-semibold uppercase tracking-[0.4em]" style={gold}>La salle de classe high-tech</p>
            <h2 className="mq-display mt-4 text-4xl font-semibold sm:text-5xl">Les outils LIRI.</h2>
          </div>
          <div className="mx-auto mt-14 grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {OUTILS.map((o) => (
              <div key={o.t} className="rounded-2xl border p-7" style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}>
                <div className="mq-display text-lg font-semibold" style={gold}>{o.t}</div>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>{o.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Atouts de la plateforme ===== */}
      <FeaturesAtouts eyebrow="La plateforme" title="Conçu pour la maîtrise." />

      {/* ===== Accès aux cours — connexion requise ===== */}
      <section className="relative overflow-hidden border-b py-28" style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}>
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(ellipse 60% 60% at 50% 50%, rgba(216,180,104,0.12), transparent 70%)' }}
        />
        <div className="relative z-10 mx-auto max-w-3xl px-6 text-center">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full border" style={{ borderColor: 'var(--gold)' }}>
            <Lock className="h-6 w-6" style={gold} />
          </div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.4em]" style={gold}>Accès aux cours</p>
          <h2 className="mq-display mt-4 text-4xl font-semibold leading-[1.05] sm:text-5xl">
            Le programme se découvre ici.<br />Les cours se suivent dans l&apos;application.
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed" style={{ color: 'var(--muted)' }}>
            Créez votre compte pour accéder aux cours, aux lives LIRI et à votre suivi personnalisé.
            Déjà membre ? Connectez-vous.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <a href="/t/isna/signup" className="inline-flex items-center gap-2 rounded-full px-7 py-3 text-sm font-semibold transition hover:brightness-110" style={{ background: 'var(--gold)', color: '#0d0b09' }}>
              Créer un compte <ArrowRight className="h-4 w-4" />
            </a>
            <a href="/t/isna/login" className="rounded-full border px-7 py-3 text-sm font-semibold transition hover:bg-[var(--gold)] hover:text-[#0d0b09]" style={{ borderColor: 'var(--gold)', color: 'var(--gold)' }}>
              Connexion
            </a>
          </div>
        </div>
      </section>

      <MaqFooter />
    </div>
  );
}
