import React from 'react';
import { ArrowRight } from 'lucide-react';
import { MAQ_THEME } from '@/components/maquette/maqTheme';
import { MaqNav } from '@/components/maquette/MaqNav';
import { MaqFooter } from '@/components/maquette/MaqFooter';
import { TempleServices as ImageGrid, TempleFeatured as FeaturedBlock } from '@/components/ui/feature-sections';

const TECH = (id) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=700&q=80`;
const gold = { color: 'var(--gold)' };

const OUTILS = [
  { title: 'LIRI Live Immersion', desc: 'Cours à distance en immersion, interaction directe, suivi contextuel.', img: TECH('1531297484001-80022131f5a1'), href: '/programme' },
  { title: 'Smartboard scientifique', desc: 'Les lois et mécanismes invisibles deviennent visibles : schémas, causalité, séquences.', img: TECH('1518770660439-4636190af475'), href: '/programme' },
  { title: 'Chat immersif', desc: 'Un guide conversationnel vers la bonne action au bon moment.', img: TECH('1517180102446-f3ece451e9d8'), href: '/programme' },
  { title: 'Neuron QR', desc: 'Le pont entre cours, capsule, exercice et validation terrain.', img: TECH('1498050108023-c5249f4df085'), href: '/programme' },
  { title: 'Certification progressive', desc: 'Une montée en compétence traçable, validée par étapes.', img: TECH('1460925895917-afdab827c52f'), href: '/programme' },
];

const RUPTURE = [
  { n: '01', t: 'Avant', d: 'Beaucoup pratiquaient des gestes — libation, kola, rites — sans explication claire du « pourquoi ».' },
  { n: '02', t: 'La rupture', d: 'On passe de la répétition à la compréhension : méthode, logique, vérification, transmission.' },
  { n: '03', t: 'Le résultat', d: 'L’élève devient autonome : il comprend, explique, applique et encadre avec responsabilité.' },
];

export default function MaquetteEcole() {
  return (
    <div className="mq2 fixed inset-0 z-[100] overflow-y-auto" style={{ background: 'var(--bg)', color: 'var(--fg)' }}>
      <style>{MAQ_THEME}</style>
      <MaqNav />

      {/* ===== Hero ===== */}
      <section className="relative py-24 text-center">
        <div className="mx-auto max-w-3xl px-6">
          <p className="text-[12px] font-semibold uppercase tracking-[0.4em]" style={gold}>L&apos;univers École · ISNA</p>
          <h1 className="mq-display mt-5 text-5xl font-semibold leading-[0.95] sm:text-7xl">Comprendre avant d&apos;agir.</h1>
          <p className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed" style={{ color: 'var(--muted)' }}>
            ISNA — Initiation aux Sciences Nocturnes Africaines. Vous n&apos;êtes pas ici pour reproduire des gestes :
            vous êtes ici pour comprendre, maîtriser, puis évoluer.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <a href="/programme" className="inline-flex items-center gap-2 rounded-full px-7 py-3 text-sm font-semibold transition hover:brightness-110" style={{ background: 'var(--gold)', color: '#0d0b09' }}>
              Le plan du cours <ArrowRight className="h-4 w-4" />
            </a>
            <a href="/signup" className="rounded-full border px-7 py-3 text-sm font-semibold transition hover:bg-[var(--gold)] hover:text-[#0d0b09]" style={{ borderColor: 'var(--gold)', color: 'var(--gold)' }}>
              Créer un compte
            </a>
          </div>
        </div>
      </section>

      {/* ===== La rupture pédagogique ===== */}
      <section className="relative py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center">
            <p className="text-[12px] font-semibold uppercase tracking-[0.4em]" style={gold}>La rupture pédagogique</p>
            <h2 className="mq-display mt-4 text-4xl font-semibold sm:text-5xl">De la répétition à la compréhension.</h2>
          </div>
          <div className="mx-auto mt-14 grid max-w-5xl grid-cols-1 gap-px overflow-hidden rounded-2xl border text-left sm:grid-cols-3" style={{ borderColor: 'var(--border)', background: 'var(--border)' }}>
            {RUPTURE.map((r) => (
              <div key={r.n} className="p-8" style={{ background: 'var(--bg)' }}>
                <div className="text-sm font-bold" style={gold}>{r.n}</div>
                <div className="mq-display mt-2 text-2xl font-semibold">{r.t}</div>
                <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--muted2)' }}>{r.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Les outils LIRI (grille à images) ===== */}
      <ImageGrid
        eyebrow="La salle de classe high-tech"
        heading="Les outils LIRI."
        subheading="La compréhension devient visible, vérifiable, transmissible."
        items={OUTILS}
      />

      {/* ===== Bloc vedette — cours en ligne ===== */}
      <FeaturedBlock
        eyebrow="Cours en ligne"
        lead="LIRI réunit la rigueur d'une école et la présence d'un live : la compréhension devient une expérience vivante."
        bigImg={TECH('1518770660439-4636190af475')}
        cardImg={TECH('1531297484001-80022131f5a1')}
        title="Présence réelle, à distance"
        text="Échanges en direct, suivi contextuel, expérience vivante — comme en présentiel."
        ctaLabel="Découvrir le plan du cours"
        ctaHref="/programme"
      />

      <MaqFooter />
    </div>
  );
}
