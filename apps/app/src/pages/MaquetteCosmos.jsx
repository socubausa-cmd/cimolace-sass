import React from 'react';
import { ArrowRight, Eye, Brain, Zap, Atom, Globe, Moon, Sun } from 'lucide-react';
import { MAQ_THEME } from '@/components/maquette/maqTheme';
import { MaqNav } from '@/components/maquette/MaqNav';
import { MaqFooter } from '@/components/maquette/MaqFooter';

const gold = { color: 'var(--gold)' };

const PILIERS = [
  {
    n: '01',
    icon: Eye,
    titre: 'Le Visible',
    sous: 'Maîtriser le monde matériel',
    texte: 'Lois de cause à effet, cycles naturels, corps physique, espace-temps. La science africaine ancre d'abord le pied dans le réel avant toute élévation.',
  },
  {
    n: '02',
    icon: Moon,
    titre: "L'Invisible",
    sous: 'Comprendre les forces cachées',
    texte: 'Énergie, ancêtres, karma, forces spirituelles. Ce que la science occidentale appelle « inexplicable » a ici une logique rigoureuse, une méthode et un protocole.',
  },
  {
    n: '03',
    icon: Brain,
    titre: 'La Transmission',
    sous: 'De la connaissance à l'action',
    texte: 'Savoir sans transmettre est stérile. La doctrine PRORASCIENCE exige que chaque initié devienne lui-même un vecteur : comprendre, appliquer, enseigner.',
  },
];

const LOIS = [
  { titre: 'Loi de correspondance', texte: 'Ce qui est en haut est comme ce qui est en bas. Chaque phénomène visible a sa contrepartie invisible.' },
  { titre: 'Loi de causalité', texte: 'Rien n'arrive sans cause. Le diagnostic précède l'intervention — toujours.' },
  { titre: 'Loi de vibration', texte: 'Tout vibre. La fréquence de votre état intérieur détermine ce que vous attirez et traversez.' },
  { titre: 'Loi de polarité', texte: 'Chaque chose a son opposé. La guérison commence quand on cesse de fuir le pôle négatif.' },
];

const ETAPES = [
  { n: '01', t: 'Écoute & observation', d: 'Aucun jugement, aucune projection. On part des faits bruts du demandeur.' },
  { n: '02', t: 'Diagnostic', d: 'Croisement des données visibles et invisibles pour identifier la cause racine.' },
  { n: '03', t: 'Prescription', d: 'Un plan d'action précis : cours, rites, accompagnement ou intervention selon le niveau.' },
  { n: '04', t: 'Validation', d: 'Le résultat se mesure. La doctrine refuse l'ésotérisme flou : ce qui fonctionne, se prouve.' },
];

export default function MaquetteCosmos() {
  return (
    <div className="mq2 fixed inset-0 z-[100] overflow-y-auto" style={{ background: 'var(--bg)', color: 'var(--fg)' }}>
      <style>{MAQ_THEME}</style>
      <MaqNav active="doctrine" />

      {/* ===== Hero ===== */}
      <section className="relative min-h-screen overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            backgroundImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(216,180,104,0.08), transparent 65%)',
          }}
        />
        <div className="relative z-10 mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 py-32 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.45em]" style={gold}>
            La doctrine · Cosmologie
          </p>
          <h1 className="mq-display mt-6 text-5xl font-semibold leading-[0.92] sm:text-7xl xl:text-[7rem]">
            La science qui{' '}
            <span style={gold}>unifie</span>
            <br />
            le visible et l&apos;invisible.
          </h1>
          <p className="mx-auto mt-9 max-w-2xl text-lg leading-relaxed" style={{ color: 'var(--muted)' }}>
            PRORASCIENCE n&apos;est pas une spiritualité parmi d&apos;autres. C&apos;est un système de connaissance
            africain total — rigoureux, vérifiable, transmissible — qui réconcilie ce que le monde moderne a séparé.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <a
              href="/t/isna/ecole"
              className="inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold transition hover:brightness-110"
              style={{ background: 'var(--gold)', color: '#0d0b09' }}
            >
              Entrer à l&apos;École <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="/t/isna/fondateur"
              className="rounded-full border px-7 py-3.5 text-sm font-semibold transition hover:bg-[rgba(216,180,104,0.12)]"
              style={{ borderColor: 'rgba(255,255,255,0.15)', color: 'var(--muted)' }}
            >
              Le Fondateur
            </a>
          </div>
        </div>
      </section>

      {/* ===== Manifeste ===== */}
      <section className="relative py-24">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.4em]" style={gold}>Manifeste</p>
          <blockquote
            className="mq-display mt-8 text-2xl font-medium leading-relaxed sm:text-3xl"
            style={{ color: 'var(--fg)' }}
          >
            &laquo;&nbsp;Recevez les yeux pour voir et les oreilles pour comprendre — la science qui structure
            l&apos;invisible, traduit l&apos;ancestral et rend le spirituel opérationnel.&nbsp;&raquo;
          </blockquote>
          <p className="mt-6 text-sm tracking-widest uppercase" style={{ color: 'var(--muted2)' }}>
            — Ngowazulu, 5ᵉ Manikongo
          </p>
        </div>
      </section>

      {/* ===== 3 Piliers ===== */}
      <section className="relative py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.4em]" style={gold}>Fondements</p>
            <h2 className="mq-display mt-4 text-4xl font-semibold sm:text-5xl">Les 3 piliers de la doctrine.</h2>
          </div>
          <div className="mt-16 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border md:grid-cols-3"
            style={{ borderColor: 'var(--border)', background: 'var(--border)' }}>
            {PILIERS.map((p) => {
              const Icon = p.icon;
              return (
                <div key={p.n} className="flex flex-col p-10" style={{ background: 'var(--bg)' }}>
                  <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl border"
                    style={{ borderColor: 'rgba(216,180,104,0.3)', background: 'rgba(216,180,104,0.06)' }}>
                    <Icon className="h-5 w-5" style={gold} />
                  </div>
                  <p className="text-xs font-bold tracking-[0.3em]" style={gold}>{p.n}</p>
                  <h3 className="mq-display mt-3 text-2xl font-semibold">{p.titre}</h3>
                  <p className="mt-1 text-sm font-semibold" style={{ color: 'var(--muted)' }}>{p.sous}</p>
                  <p className="mt-5 text-sm leading-relaxed" style={{ color: 'var(--muted2)' }}>{p.texte}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== 4 Lois universelles ===== */}
      <section className="relative py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-14 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.4em]" style={gold}>Les lois</p>
            <h2 className="mq-display mt-4 text-4xl font-semibold sm:text-5xl">4 lois universelles.</h2>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed" style={{ color: 'var(--muted)' }}>
              Ces lois ne sont pas des croyances — elles sont des constantes observables, vérifiables,
              opérationnelles dans chaque cas que le temple ou l&apos;école accompagne.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {LOIS.map((l, i) => (
              <div key={i} className="rounded-2xl border p-8"
                style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}>
                <div className="flex items-start gap-4">
                  <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                    style={{ background: 'rgba(216,180,104,0.12)', color: 'var(--gold)' }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <h3 className="font-semibold">{l.titre}</h3>
                    <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>{l.texte}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== La méthode en 4 étapes ===== */}
      <section className="relative py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.4em]" style={gold}>La méthode</p>
            <h2 className="mq-display mt-4 text-4xl font-semibold sm:text-5xl">Du problème à la résolution.</h2>
          </div>
          <div className="mx-auto mt-14 grid max-w-5xl grid-cols-1 gap-px overflow-hidden rounded-2xl border sm:grid-cols-2 lg:grid-cols-4"
            style={{ borderColor: 'var(--border)', background: 'var(--border)' }}>
            {ETAPES.map((e) => (
              <div key={e.n} className="p-8" style={{ background: 'var(--bg)' }}>
                <div className="text-sm font-bold" style={gold}>{e.n}</div>
                <div className="mq-display mt-2 text-xl font-semibold">{e.t}</div>
                <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--muted2)' }}>{e.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA final ===== */}
      <section className="relative py-28">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.4em]" style={gold}>Prochaine étape</p>
          <h2 className="mq-display mt-5 text-4xl font-semibold leading-[0.95] sm:text-5xl">
            La doctrine se vit,<br />elle ne se lit pas.
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed" style={{ color: 'var(--muted)' }}>
            L&apos;École ISNA vous donne les clés théoriques. Le Temple Ngowazulu fait traverser ce que les mots
            ne suffisent pas à résoudre.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <a
              href="/t/isna/ecole"
              className="inline-flex items-center gap-2 rounded-full px-8 py-3.5 text-sm font-semibold transition hover:brightness-110"
              style={{ background: 'var(--gold)', color: '#0d0b09' }}
            >
              L&apos;École ISNA <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="/t/isna/temple"
              className="rounded-full border px-8 py-3.5 text-sm font-semibold transition hover:bg-[rgba(216,180,104,0.12)]"
              style={{ borderColor: 'var(--gold)', color: 'var(--gold)' }}
            >
              Le Temple Ngowazulu
            </a>
          </div>
        </div>
      </section>

      <MaqFooter />
    </div>
  );
}
