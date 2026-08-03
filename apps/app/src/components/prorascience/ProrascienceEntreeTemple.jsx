import React from 'react';
import { CalendarDays, FileText, ShieldCheck, Stethoscope } from 'lucide-react';
import { PRORASCIENCE_KNOWLEDGE } from '@/lib/agent/prorascienceKnowledge';

/**
 * CE QUE L'ENTRÉE AU TEMPLE IMPLIQUE — la politique d'entrée était connue de l'OS
 * (prorascienceKnowledge.temple.policy) et absente du site, alors qu'elle justifie le prix
 * (confidentialité, cadre non-médical, gouvernance) et évite les dossiers incomplets.
 *
 * ⛔ Les quatre points ci-dessous DÉCOUPENT la phrase `temple.policy` — rien n'est ajouté.
 * Le calendrier du culte reprend `temple.sections` (« Ouverture dominicale et fermeture du
 * vendredi ») précisé par ServicesSpirituelsPage (« Premier dimanche : ouvrir le mois ·
 * Dernier vendredi : fermer le mois »).
 */
const POINTS = [
  {
    icon: FileText,
    titre: 'Un dossier, pas un formulaire vite fait',
    texte: 'Paiement d’ouverture, formulaire d’entrée, puis trois pièces : photo, pièce d’identité et preuve d’habitation.',
  },
  {
    icon: ShieldCheck,
    titre: 'Confidentialité stricte',
    texte: 'Un serment de confidentialité encadre la relation. Ce qui est dit au Temple reste au Temple.',
  },
  {
    icon: Stethoscope,
    titre: 'Un cadre clair, non médical',
    texte: 'Un disclaimer médical est signé à l’entrée : le Temple n’est pas un cabinet médical et ne remplace aucun traitement.',
  },
  {
    icon: CalendarDays,
    titre: 'Deux rôles distincts',
    texte: 'Le secrétariat qualifie la demande et suit l’administratif ; le maître donne l’orientation et le protocole spirituel.',
  },
];

export default function ProrascienceEntreeTemple({ calendrier = true }) {
  const gold = { color: 'var(--gold)' };
  return (
    <section id="entree" className="relative py-20">
      <div className="mx-auto max-w-7xl px-5 sm:px-6">
        <div className="text-center">
          <p className="text-[12px] font-semibold uppercase tracking-[0.4em]" style={gold}>Avant d’entrer</p>
          <h2 className="mq-display mt-4 text-3xl font-semibold sm:text-5xl">Ce que l’entrée implique.</h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed" style={{ color: 'var(--muted)' }}>
            L’entrée au Temple est encadrée. Ce cadre n’est pas une formalité : c’est ce qui rend
            l’accompagnement sérieux, traçable et confidentiel.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {POINTS.map((p) => {
            const Icon = p.icon;
            return (
              <div key={p.titre} className="rounded-2xl border p-6 sm:p-7" style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}>
                <Icon className="h-6 w-6" style={gold} aria-hidden="true" />
                <div className="mq-display mt-4 text-xl font-semibold">{p.titre}</div>
                <p className="mt-2 text-base leading-relaxed" style={{ color: 'var(--muted)' }}>{p.texte}</p>
              </div>
            );
          })}
        </div>

        {calendrier && (
          <div className="mx-auto mt-8 max-w-3xl rounded-2xl border p-6 sm:p-7" style={{ borderColor: 'var(--gold)', background: 'rgba(216,180,104,0.06)' }}>
            <p className="text-[12px] font-semibold uppercase tracking-[0.3em]" style={gold}>Le rythme du culte</p>
            <p className="mt-3 text-base leading-relaxed" style={{ color: 'var(--fg)' }}>
              Premier dimanche du mois&nbsp;: on ouvre le mois. Dernier vendredi du mois&nbsp;: on ferme le mois.
              Prière, enseignement et vision en direct, pour les membres.
            </p>
            <p className="mt-2 text-sm" style={{ color: 'var(--muted2)' }}>
              {PRORASCIENCE_KNOWLEDGE.temple.sections.find((s) => s.title === 'Culte en ligne')?.desc}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
