import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';

const PublicIsnaPage = () => {
  return (
    <div className="min-h-screen bg-[#070b14] text-white">
      <Helmet>
        <title>ISNA | PRORASCIENCE</title>
        <meta
          name="description"
          content="ISNA est le pôle école de PRORASCIENCE: parcours structurés, pédagogie immersive et maîtrise des sciences nocturnes."
        />
      </Helmet>

      <section className="border-b border-white/10 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs uppercase tracking-[0.24em] text-[#D4AF37]">Pôle École</p>
          <h1 className="mt-4 text-4xl font-semibold sm:text-6xl">ISNA — apprendre avec structure et profondeur</h1>
          <p className="mt-6 max-w-3xl text-gray-300">
            ISNA professionnalise l’apprentissage: chaque concept est relié à une méthode, chaque méthode à une application.
            Vous ne suivez pas des contenus, vous construisez une compétence durable.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/nous-contacter" className="rounded-xl bg-[#D4AF37] px-6 py-3 font-semibold text-black hover:bg-[#e5c04a]">
              Parler à un conseiller
            </Link>
            <Link to="/" className="rounded-xl border border-white/20 px-6 py-3 hover:bg-white/10">
              Retour au site vitrine
            </Link>
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6">
        <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-3">
          {[
            {
              title: 'Programme structuré',
              text: 'Progression claire: fondations, compréhension, consolidation, maîtrise.',
            },
            {
              title: 'Pédagogie premium',
              text: 'Classe immersive, accompagnement ciblé et retours actionnables.',
            },
            {
              title: 'Impact business et personnel',
              text: 'Des résultats observables dans votre posture, vos décisions et vos performances.',
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

export default PublicIsnaPage;
