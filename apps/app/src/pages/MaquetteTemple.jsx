import React from 'react';
import { ArrowRight } from 'lucide-react';
import { MAQ_THEME } from '@/components/maquette/maqTheme';
import { MaqNav } from '@/components/maquette/MaqNav';
import { MaqFooter } from '@/components/maquette/MaqFooter';
import { TempleServices, TempleFeatured } from '@/components/ui/feature-sections';
import ProrascienceEntreeTemple from '@/components/prorascience/ProrascienceEntreeTemple';
import ProrascienceFaq from '@/components/prorascience/ProrascienceFaq';
import ProrascienceContactBloc from '@/components/prorascience/ProrascienceContactBloc';
import {
  CHEMIN_BOUTIQUE,
  CHEMIN_CONSULTATION,
  CHEMIN_CONTACT,
  CHEMIN_SERVICES_TEMPLE,
  OFFRES_MENTORAT,
} from '@/components/prorascience/prorascienceOffres';

const TEMPLE = (n) => `/ngowazulu/temple-${String(n).padStart(2, '0')}.jpg`;
const gold = { color: 'var(--gold)' };

// Fourchette du mentorat — bornée par la configuration, jamais retapée à la main.
const MENTORAT_MIN = OFFRES_MENTORAT[0]?.prix;
const MENTORAT_MAX = OFFRES_MENTORAT[OFFRES_MENTORAT.length - 1]?.prix;

// ⛔ Chaque service mène à un chemin QUI RÉPOND. Ils pointaient tous vers /#offres, une grille
// où quatre d'entre eux n'existent pas (le visiteur cherchait, ne trouvait pas, repartait).
export const TEMPLE_SERVICES = [
  { title: 'Consultation', desc: 'Diagnostic des blocages, lecture énergétique et karmique, orientation. 50 € · 1h30.', img: TEMPLE(2), href: CHEMIN_CONSULTATION },
  { title: 'Culte & communion', desc: 'Le rythme communautaire en live : on ouvre le mois le 1er dimanche, on le ferme le dernier vendredi.', img: TEMPLE(6), href: CHEMIN_SERVICES_TEMPLE },
  { title: 'Interventions', desc: 'Exorcisme, rééquilibrage, hospitalisation spirituelle — selon la gravité du cas. Le tarif se fixe après le diagnostic.', img: TEMPLE(3), href: CHEMIN_CONTACT },
  { title: 'Voyages initiatiques', desc: 'Rites de passage, sortie des anciens pactes, progression de conscience. Sur dossier, après entretien.', img: TEMPLE(8), href: CHEMIN_CONTACT },
  { title: 'Mentorat spirituel', desc: `Un Moniteur dédié : protection, guérison, élévation. De ${MENTORAT_MIN} à ${MENTORAT_MAX} €/mois.`, img: TEMPLE(5), href: '/#offres' },
  { title: 'NZO-WA-NKISI', desc: 'La maison des remèdes : le pack des 9 instruments sacrés, 700 € — activation et suivi de 3 mois inclus.', img: TEMPLE(7), href: CHEMIN_BOUTIQUE },
];

const PARCOURS = [
  { n: '01', t: 'Consultation', d: 'Écoute, analyse, lecture énergétique et karmique. Une orientation, pas un examen.' },
  { n: '02', t: 'Voyance', d: 'Si nécessaire : clairvoyance, FA / cauris, lecture du destin pour valider une suspicion.' },
  { n: '03', t: 'Diagnostic', d: 'Le problème est identifié de façon claire et actionnable.' },
  { n: '04', t: 'Intervention', d: 'Travail spirituel, rééquilibrage ou initiation — à distance ou en hospitalisation.' },
];

export default function MaquetteTemple() {
  return (
    <div className="mq2 fixed inset-0 z-[100] overflow-y-auto" style={{ background: 'var(--bg)', color: 'var(--fg)' }}>
      <style>{MAQ_THEME}</style>
      <MaqNav />

      {/* ===== Hero ===== */}
      <section className="relative py-24 text-center">
        <div className="mx-auto max-w-3xl px-6">
          <p className="text-[12px] font-semibold uppercase tracking-[0.4em]" style={gold}>L&apos;univers Temple · Ngowazulu</p>
          <h1 className="mq-display mt-5 text-5xl font-semibold leading-[0.95] sm:text-7xl">L&apos;hôpital de l&apos;âme.</h1>
          <p className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed" style={{ color: 'var(--muted)' }}>
            Là où l&apos;École fait comprendre, le Temple fait traverser. Vous venez résoudre une impasse réelle,
            avec une méthode, une équipe et un suivi responsable.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            {/* La consultation EST le rendez-vous d'entrée du Temple : on mène au checkout réel,
                et non à une ancre d'offres où la demande de RDV n'existait pas. */}
            <a href={CHEMIN_CONSULTATION} className="inline-flex min-h-[48px] items-center gap-2 rounded-full px-7 py-3 text-sm font-semibold transition hover:brightness-110" style={{ background: 'var(--gold)', color: '#0d0b09' }}>
              Réserver une consultation <ArrowRight className="h-4 w-4" />
            </a>
            <a href={CHEMIN_CONTACT} className="inline-flex min-h-[48px] items-center rounded-full border px-7 py-3 text-sm font-semibold transition hover:bg-[var(--gold)] hover:text-[#0d0b09]" style={{ borderColor: 'var(--gold)', color: 'var(--gold)' }}>
              Exposer mon cas
            </a>
          </div>
        </div>
      </section>

      {/* ===== Services (grille à photos) ===== */}
      <TempleServices
        eyebrow="Les services"
        heading="Ce que le Temple prend en charge."
        subheading="Prorascience enseigne. Ngowazulu intervient."
        items={TEMPLE_SERVICES}
      />

      {/* ===== Le parcours d'intervention ===== */}
      <section className="relative py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center">
            <p className="text-[12px] font-semibold uppercase tracking-[0.4em]" style={gold}>Le parcours</p>
            <h2 className="mq-display mt-4 text-4xl font-semibold sm:text-5xl">De l&apos;impasse à la traversée.</h2>
          </div>
          <div className="mx-auto mt-14 grid max-w-5xl grid-cols-1 gap-px overflow-hidden rounded-2xl border text-left sm:grid-cols-2 lg:grid-cols-4" style={{ borderColor: 'var(--border)', background: 'var(--border)' }}>
            {PARCOURS.map((p) => (
              <div key={p.n} className="p-8" style={{ background: 'var(--bg)' }}>
                <div className="text-sm font-bold" style={gold}>{p.n}</div>
                <div className="mq-display mt-2 text-2xl font-semibold">{p.t}</div>
                <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--muted2)' }}>{p.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Bloc vedette — la communion ===== */}
      <TempleFeatured
        eyebrow="Le cœur communautaire"
        lead="Le Temple n'est pas qu'un lieu d'intervention : c'est une communauté vivante, rythmée par le culte et la communion en direct."
        bigImg={TEMPLE(1)}
        cardImg={TEMPLE(9)}
        title="La communion Ngowazulu"
        text="Culte en live immersif : on ouvre le mois le premier dimanche, on le ferme le dernier vendredi. Prière, enseignement et vision en temps réel. Abonnement à partir de 15 €/mois."
        ctaLabel="Rejoindre la communion"
        // La communion n'est PAS dans la grille /#offres : on mène à la page qui la décrit et la vend.
        ctaHref={CHEMIN_SERVICES_TEMPLE}
      />

      {/* ===== Ce que l'entrée implique — politique, confidentialité, cadre non médical ===== */}
      <ProrascienceEntreeTemple />

      {/* ===== Objections propres au Temple ===== */}
      <ProrascienceFaq
        eyebrow="Avant de pousser la porte"
        titre="Les questions qu'on nous pose."
        extra={[
          {
            q: 'Est-ce que le Temple remplace un médecin ?',
            a: "Non. Un disclaimer médical est signé à l'entrée : l'accompagnement spirituel ne se substitue à aucun diagnostic ni traitement médical.",
          },
          {
            q: 'Ce que je raconte reste-t-il confidentiel ?',
            a: "Oui. Un serment de confidentialité encadre la relation, et la confidentialité est stricte, du secrétariat jusqu'au maître.",
          },
          {
            q: 'Qui traite ma demande ?',
            a: "Le secrétariat qualifie la demande et suit l'administratif ; le maître donne l'orientation et le protocole spirituel.",
          },
        ]}
      />

      {/* ===== Contact & rendez-vous ===== */}
      <ProrascienceContactBloc />

      <MaqFooter />
    </div>
  );
}
