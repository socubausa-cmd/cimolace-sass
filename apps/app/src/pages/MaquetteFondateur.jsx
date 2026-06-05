import React from 'react';
import { ArrowRight } from 'lucide-react';
import { MAQ_THEME } from '@/components/maquette/maqTheme';
import { MaqNav } from '@/components/maquette/MaqNav';
import { MaqFooter } from '@/components/maquette/MaqFooter';
import { FOUNDER_IMAGE_SOURCES } from '@/lib/founderImageSources';
import RadialOrbitalTimeline, { FOUNDER_THESES } from '@/components/ui/radial-orbital-timeline';

const gold = { color: 'var(--gold)' };

const MANDAT = [
  { n: '01', t: 'Restaurer', d: 'La dignité intellectuelle et spirituelle de l’Afrique.' },
  { n: '02', t: 'Traduire', d: 'Les concepts africains dans le langage moderne universel.' },
  { n: '03', t: 'Structurer', d: 'L’initiation dans un modèle cohérent et transmissible.' },
  { n: '04', t: 'Transmettre', d: 'Ce qui a été restauré, traduit et structuré.' },
];

const REFUS = [
  { t: 'Refus de la peur', d: 'Aucun enseignement par la menace ou la culpabilisation.' },
  { t: 'Refus de la fascination', d: 'Pas de culte de la personnalité ni de miracles-spectacle.' },
  { t: 'Refus de l’autorité', d: 'L’argument d’autorité n’a aucune valeur. Seule la preuve compte.' },
  { t: 'Refus de la promesse', d: 'Pas de salut garanti. Seul le travail personnel libère.' },
];

export default function MaquetteFondateur() {
  return (
    <div className="mq2 fixed inset-0 z-[100] overflow-y-auto" style={{ background: 'var(--bg)', color: 'var(--fg)' }}>
      <style>{MAQ_THEME}</style>
      <MaqNav active="fondateur" />

      {/* ===== Hero — constellation orbitale de la pensée du Manikongo ===== */}
      <section className="relative border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="relative min-h-[640px]" style={{ height: 'calc(100vh - 66px)' }}>
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 px-6 pt-10 text-center">
            <p className="text-[12px] font-semibold uppercase tracking-[0.4em]" style={gold}>À propos de l&apos;auteur</p>
            <h1 className="mq-display mt-4 text-4xl font-semibold leading-[0.95] sm:text-6xl">Le 5ᵉ Manikongo</h1>
            <p className="mt-3 text-sm" style={{ color: 'var(--muted)' }}>Badika Jel David — Recteur de l&apos;ISNA</p>
            <div className="mt-5">
              <a href="/t/isna/mission" className="pointer-events-auto inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold transition hover:brightness-110" style={{ background: 'var(--gold)', color: '#0d0b09' }}>
                Notre mission <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
          <RadialOrbitalTimeline timelineData={FOUNDER_THESES} centerImage={FOUNDER_IMAGE_SOURCES[0]} />
          <div className="pointer-events-none absolute inset-x-0 bottom-6 z-20 text-center text-[11px] uppercase tracking-[0.3em]" style={{ color: 'var(--muted2)' }}>
            Cliquez une notion pour la déployer
          </div>
        </div>
      </section>

      {/* ===== Le titre ===== */}
      <section className="relative border-b py-24" style={{ borderColor: 'var(--border)' }}>
        <div className="mx-auto max-w-3xl px-6 text-center">
          <p className="text-[12px] font-semibold uppercase tracking-[0.4em]" style={gold}>Le titre</p>
          <h2 className="mq-display mt-5 text-3xl font-semibold sm:text-5xl">
            <span style={gold}>Mani</span> : Maître · <span style={gold}>Kongo</span> : Savoir
          </h2>
          <p className="mt-6 text-base leading-relaxed" style={{ color: 'var(--muted)' }}>
            Le Manikongo est le « Maître du Savoir » : celui qui protège l&apos;intégrité de la connaissance sacrée
            pour sa génération. Ce titre n&apos;est pas une revendication politique de la royauté Kongo — il désigne
            une charge spirituelle et une responsabilité de garde, héritée de l&apos;Ordre Mystique des Manikongo.
          </p>
        </div>
      </section>

      {/* ===== Le mandat ===== */}
      <section className="relative border-b py-24" style={{ borderColor: 'var(--border)' }}>
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center">
            <p className="text-[12px] font-semibold uppercase tracking-[0.4em]" style={gold}>Le mandat</p>
            <h2 className="mq-display mt-4 text-4xl font-semibold sm:text-5xl">Quatre verbes, une vie.</h2>
          </div>
          <div className="mx-auto mt-14 grid max-w-5xl grid-cols-1 gap-px overflow-hidden rounded-2xl border text-left sm:grid-cols-2 lg:grid-cols-4" style={{ borderColor: 'var(--border)', background: 'var(--border)' }}>
            {MANDAT.map((m) => (
              <div key={m.n} className="p-8" style={{ background: 'var(--bg)' }}>
                <div className="text-sm font-bold" style={gold}>{m.n}</div>
                <div className="mq-display mt-2 text-2xl font-semibold">{m.t}</div>
                <p className="mt-2 text-sm" style={{ color: 'var(--muted2)' }}>{m.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Maxime ===== */}
      <section className="relative border-b py-28 text-center" style={{ borderColor: 'var(--border)' }}>
        <div className="mx-auto max-w-4xl px-6">
          <blockquote className="mq-display text-3xl font-semibold leading-tight sm:text-5xl">
            « Je ne veux pas de disciples, <span style={{ color: 'var(--gold)', fontStyle: 'italic' }}>je veux des Maîtres.</span> »
          </blockquote>
          <p className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[12px] font-semibold uppercase tracking-[0.3em]" style={{ color: 'var(--muted)' }}>
            <span>Autonomie</span><span style={gold}>·</span><span>Souveraineté</span><span style={gold}>·</span><span>Liberté</span>
          </p>
        </div>
      </section>

      {/* ===== Quatre refus ===== */}
      <section className="relative border-b py-24" style={{ borderColor: 'var(--border)' }}>
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center">
            <p className="text-[12px] font-semibold uppercase tracking-[0.4em]" style={gold}>Sa posture</p>
            <h2 className="mq-display mt-4 text-4xl font-semibold sm:text-5xl">Quatre refus.</h2>
          </div>
          <div className="mx-auto mt-14 grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2">
            {REFUS.map((r) => (
              <div key={r.t} className="rounded-2xl border p-7" style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}>
                <div className="mq-display text-xl font-semibold" style={gold}>{r.t}</div>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>{r.d}</p>
              </div>
            ))}
          </div>
          <p className="mx-auto mt-14 max-w-3xl text-center font-mono text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
            « LA SCIENCE SANS CONSCIENCE EST LA RUINE DE L&apos;ÂME, MAIS LA CONSCIENCE SANS SCIENCE EST L&apos;IMPUISSANCE DE L&apos;ESPRIT. »
          </p>
        </div>
      </section>

      <MaqFooter />
    </div>
  );
}
