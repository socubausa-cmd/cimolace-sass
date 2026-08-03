import React from 'react';
import { PRORASCIENCE_KNOWLEDGE } from '@/lib/agent/prorascienceKnowledge';

/**
 * GLOSSAIRE — mêmes définitions que celles que l'OS rend cliquables via glossify()
 * (prorascienceKnowledge.glossary). Le site employait ces termes (FA, libation, talisman,
 * Manikongo, transmetteur…) sans jamais les définir, alors que sa promesse est « comprendre
 * au lieu de répéter ».
 */
export default function ProrascienceGlossaire({
  eyebrow = 'Le vocabulaire',
  titre = 'Les mots, définis.',
  termes = PRORASCIENCE_KNOWLEDGE.glossary,
}) {
  const gold = { color: 'var(--gold)' };
  return (
    <section id="glossaire" className="relative py-20">
      <div className="mx-auto max-w-5xl px-5 sm:px-6">
        <div className="text-center">
          <p className="text-[12px] font-semibold uppercase tracking-[0.4em]" style={gold}>{eyebrow}</p>
          <h2 className="mq-display mt-4 text-3xl font-semibold sm:text-5xl">{titre}</h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed" style={{ color: 'var(--muted)' }}>
            Ici, on n’emploie aucun mot sans l’expliquer. Voici ceux qui reviennent le plus.
          </p>
        </div>
        <dl className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
          {termes.map((t) => (
            <div key={t.term} className="rounded-2xl border p-5 sm:p-6" style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}>
              <dt className="mq-display text-lg font-semibold" style={gold}>{t.term}</dt>
              <dd className="mt-2 text-base leading-relaxed" style={{ color: 'var(--muted)' }}>{t.def}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
