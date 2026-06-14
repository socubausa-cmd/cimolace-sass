import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';

const PublicNgowazuluPage = () => {
  return (
    <div className="min-h-screen bg-[#060910] text-white">
      <Helmet>
        <title>Ngowazulu | PRORASCIENCE</title>
        <meta
          name="description"
          content="Ngowazulu est le pôle temple de PRORASCIENCE: consultations, interventions, rituels et accompagnement de transformation."
        />
      </Helmet>

      <section className="border-b border-white/10 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--school-accent)]">Pôle Temple</p>
          <h1 className="mt-4 text-4xl font-semibold sm:text-6xl">Ngowazulu — transformer ce que vous ne pouviez pas résoudre seul</h1>
          <p className="mt-6 max-w-3xl text-gray-300">
            Ngowazulu propose une prise en charge sérieuse des blocages profonds: consultation, stratégie d'intervention
            et suivi encadré. Chaque dossier est traité avec méthode, confidentialité et responsabilité.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/services-spirituels#ngowazulu" className="rounded-xl bg-[var(--school-accent)] px-6 py-3 font-semibold text-black hover:bg-[#e5c04a]">
              Voir les services
            </Link>
            <Link to="/nous-contacter" className="rounded-xl border border-white/20 px-6 py-3 hover:bg-white/10">
              Prendre contact
            </Link>
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6">
        <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-2">
          {[
            {
              title: 'Consultations orientées résolution',
              text: 'Diagnostic clair, priorisation des urgences et plan de progression personnalisé.',
            },
            {
              title: 'Interventions spécialisées',
              text: 'Actions ciblées sur les causes, avec suivi de l\'évolution et adaptation continue.',
            },
            {
              title: 'Cadre communautaire protégé',
              text: 'Règles, discipline collective et soutien mutuel pour maintenir les résultats.',
            },
            {
              title: 'Accès progressif',
              text: 'Contribution minimale accessible, puis montée en accompagnement selon besoins.',
            },
          ].map((item) => (
            <article key={item.title} className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-lg font-semibold">{item.title}</h2>
              <p className="mt-2 text-sm text-gray-300">{item.text}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
};

export default PublicNgowazuluPage;
