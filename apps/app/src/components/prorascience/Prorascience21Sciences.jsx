import React from 'react';
import { ArrowRight } from 'lucide-react';
import { ECOLES_SCIENCES } from '@/data/ecoles21SciencesData';
import { CHEMIN_FORFAITS } from '@/components/prorascience/prorascienceOffres';

/**
 * LES 21 SCIENCES — l'actif de contenu le plus concret de l'École, présent dans le dépôt
 * (data/ecoles21SciencesData) et connu de l'OS, mais absent du site : le visiteur ne voyait
 * jamais CE QU'IL VA APPRENDRE face au prix.
 *
 * On expose ici le TITRE, le sous-titre et l'objectif de chaque science (le détail des contenus
 * reste derrière le compte). Aucune science n'est réécrite : la liste est lue telle quelle.
 */
export default function Prorascience21Sciences({ ctaHref = CHEMIN_FORFAITS }) {
  const gold = { color: 'var(--gold)' };
  return (
    <section id="sciences" className="relative py-20">
      <div className="mx-auto max-w-7xl px-5 sm:px-6">
        <div className="text-center">
          <p className="text-[12px] font-semibold uppercase tracking-[0.4em]" style={gold}>Le contenu réel</p>
          <h2 className="mq-display mt-4 text-3xl font-semibold sm:text-5xl">Les 21 sciences.</h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed" style={{ color: 'var(--muted)' }}>
            Les sciences nocturnes africaines, enseignées une par une, de l’origine de l’être
            jusqu’à la sagesse sociale. Voilà ce que vous venez apprendre.
          </p>
        </div>

        <ol className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ECOLES_SCIENCES.map((s) => (
            <li key={s.number} className="rounded-2xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}>
              <div className="text-sm font-bold" style={gold}>{String(s.number).padStart(2, '0')}</div>
              <div className="mq-display mt-1 text-lg font-semibold">{s.name}</div>
              <div className="mt-1 text-sm" style={{ color: 'var(--muted2)' }}>{s.subtitle}</div>
              <p className="mt-3 text-base leading-relaxed" style={{ color: 'var(--muted)' }}>{s.objective}</p>
            </li>
          ))}
        </ol>

        <div className="mt-10 text-center">
          <a
            href={ctaHref}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full px-7 py-3 text-sm font-semibold transition hover:brightness-110"
            style={{ background: 'var(--gold)', color: '#0d0b09' }}
          >
            Voir les cycles et leurs tarifs <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </section>
  );
}
