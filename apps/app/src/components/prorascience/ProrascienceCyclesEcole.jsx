import React from 'react';
import { ArrowRight, Check, Minus } from 'lucide-react';
import { PRORASCIENCE_KNOWLEDGE } from '@/lib/agent/prorascienceKnowledge';
import {
  CHEMIN_FORFAITS,
  CYCLES_SANS_PRIX,
  cheminPaiement,
  useCyclesEcole,
} from '@/components/prorascience/prorascienceOffres';

/**
 * CYCLES ÉCOLE — la gamme la plus vendue du site, jusqu'ici absente de la page d'accueil
 * (elle n'apparaissait qu'APRÈS création de compte, sur /forfaits).
 *
 * ⛔ Les prix viennent de billing_plans (hook useCyclesEcole). Si la base ne répond pas, la carte
 * s'affiche SANS prix et renvoie vers /forfaits — jamais de montant de secours inventé.
 *
 * Le comparateur reprend `comparison.rows` de prorascienceKnowledge (même tableau que l'OS) :
 * une seule source de features pour les deux rendus.
 */
export default function ProrascienceCyclesEcole({
  eyebrow = 'L’École · ISNA',
  titre = 'Les quatre cycles de l’École.',
  sousTitre = PRORASCIENCE_KNOWLEDGE.comparison.intro,
  comparateur = true,
}) {
  const { chargement, cycles, indisponible } = useCyclesEcole();
  const liste = cycles.length ? cycles : CYCLES_SANS_PRIX;
  const gold = { color: 'var(--gold)' };

  const lignes = PRORASCIENCE_KNOWLEDGE.comparison.rows;
  // Les colonnes du comparateur suivent l'ordre canonique des cycles (autonome → privilégié),
  // qui est aussi celui de `comparison.plans` : l'index de la carte indexe donc `has[]`.
  const descriptions = PRORASCIENCE_KNOWLEDGE.comparison.plans;

  return (
    <section id="cycles" className="relative py-20" style={{ background: 'var(--bg)' }}>
      <div className="mx-auto max-w-7xl px-5 sm:px-6">
        <div className="text-center">
          <p className="text-[12px] font-semibold uppercase tracking-[0.4em]" style={gold}>{eyebrow}</p>
          <h2 className="mq-display mt-4 text-3xl font-semibold sm:text-5xl">{titre}</h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed" style={{ color: 'var(--muted)' }}>
            {sousTitre}
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {liste.map((c, i) => {
            const desc = descriptions[i]?.desc || '';
            const populaire = descriptions[i]?.popular;
            const href = c.prix
              ? cheminPaiement({
                plan: c.key,
                type: 'subscription',
                label: c.label,
                priceLabel: `${c.prix} ${c.devise === 'EUR' ? '€' : c.devise} / mois`,
              })
              : CHEMIN_FORFAITS;
            return (
              <div
                key={c.key}
                className="flex flex-col rounded-2xl border p-6"
                style={{
                  borderColor: populaire ? 'var(--gold)' : 'var(--border)',
                  background: 'var(--panel)',
                }}
              >
                {populaire && (
                  <div className="mb-3 self-start rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-widest" style={{ background: 'var(--gold)', color: '#0d0b09' }}>
                    Le plus choisi
                  </div>
                )}
                <div className="mq-display text-2xl font-semibold">{c.label}</div>
                <p className="mt-1 text-sm font-medium" style={gold}>{c.pourQui}</p>
                <div className="mt-5 flex items-baseline gap-1">
                  {chargement ? (
                    <span className="text-sm" style={{ color: 'var(--muted2)' }}>Tarif en cours de chargement…</span>
                  ) : c.prix ? (
                    <>
                      <span className="mq-display text-4xl font-semibold">{c.prix}</span>
                      <span className="text-lg" style={gold}>{c.devise === 'EUR' ? '€' : c.devise}</span>
                      <span className="text-sm" style={{ color: 'var(--muted2)' }}>/mois</span>
                    </>
                  ) : (
                    // Aucun prix inventé : la base n'a pas répondu, on renvoie vers la grille officielle.
                    <span className="text-sm" style={{ color: 'var(--muted2)' }}>Tarif sur la page Forfaits</span>
                  )}
                </div>
                <p className="mt-4 flex-1 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>{desc}</p>
                <a
                  href={href}
                  className="mt-6 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition hover:brightness-110"
                  style={populaire
                    ? { background: 'var(--gold)', color: '#0d0b09' }
                    : { border: '1px solid var(--gold)', color: 'var(--gold)' }}
                >
                  {c.prix ? 'Rejoindre ce cycle' : 'Voir le tarif'} <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            );
          })}
        </div>

        {indisponible && (
          <p className="mt-6 text-center text-sm" style={{ color: 'var(--muted2)' }}>
            Les tarifs se chargent depuis notre catalogue. En cas de souci,{' '}
            <a href={CHEMIN_FORFAITS} className="font-semibold underline underline-offset-4" style={gold}>voir la page Forfaits</a>.
          </p>
        )}

        {comparateur && (
          <div className="mt-14">
            <h3 className="mq-display text-center text-2xl font-semibold sm:text-3xl">Ce qui change d’un cycle à l’autre.</h3>
            {/* Table large : elle scrolle DANS son cadre, jamais la page. */}
            <div className="mt-6 overflow-x-auto rounded-2xl border" style={{ borderColor: 'var(--border)' }}>
              <table className="w-full min-w-[560px] border-collapse text-left text-sm">
                <thead>
                  <tr style={{ background: 'var(--panel)' }}>
                    <th className="p-4 font-semibold" style={{ color: 'var(--muted)' }}>Ce que vous obtenez</th>
                    {liste.map((c) => (
                      <th key={c.key} className="p-4 text-center font-semibold">{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lignes.map((l) => (
                    <tr key={l.feature} className="border-t" style={{ borderColor: 'var(--border)' }}>
                      <td className="p-4" style={{ color: 'var(--fg)' }}>{l.feature}</td>
                      {l.has.map((ok, i) => (
                        <td key={`${l.feature}-${i}`} className="p-4 text-center">
                          {ok
                            ? <Check className="mx-auto h-5 w-5" style={{ color: 'var(--gold)' }} aria-label="inclus" />
                            : <Minus className="mx-auto h-5 w-5" style={{ color: 'var(--muted2)' }} aria-label="non inclus" />}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
