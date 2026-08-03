import React from 'react';
import { PRORASCIENCE_KNOWLEDGE } from '@/lib/agent/prorascienceKnowledge';

/**
 * FAQ du site — MÊME contenu que la FAQ de l'OS (prorascienceKnowledge.faq) : une source,
 * deux rendus. Les questions supplémentaires passées en `extra` doivent elles aussi être
 * sourcées (politique du Temple, calendrier du culte…) — jamais rédigées au jugé.
 *
 * Rendu en <details> natif : accessible, tactile, et ouvert sans JavaScript.
 */
export default function ProrascienceFaq({
  eyebrow = 'Vos questions',
  titre = 'Avant de vous engager.',
  items = PRORASCIENCE_KNOWLEDGE.faq,
  extra = [],
}) {
  const gold = { color: 'var(--gold)' };
  const questions = [...items, ...extra];

  return (
    <section id="faq" className="relative py-20">
      <div className="mx-auto max-w-3xl px-5 sm:px-6">
        <div className="text-center">
          <p className="text-[12px] font-semibold uppercase tracking-[0.4em]" style={gold}>{eyebrow}</p>
          <h2 className="mq-display mt-4 text-3xl font-semibold sm:text-5xl">{titre}</h2>
        </div>
        <div className="mt-10 divide-y rounded-2xl border" style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}>
          {questions.map((f) => (
            <details key={f.q} className="group px-5 py-1">
              <summary
                className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-4 py-4 text-base font-semibold"
                style={{ color: 'var(--fg)' }}
              >
                {f.q}
                <span className="text-xl transition group-open:rotate-45" style={gold} aria-hidden="true">+</span>
              </summary>
              <p className="pb-5 text-base leading-relaxed" style={{ color: 'var(--muted)' }}>{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
