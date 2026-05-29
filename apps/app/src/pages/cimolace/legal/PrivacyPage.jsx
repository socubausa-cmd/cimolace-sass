import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { cimolacePlatformConfig } from '@/tenants/cimolace/cimolacePlatform.config';

export default function CimolacePrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white px-6 py-16">
      <Helmet>
        <title>Confidentialité | {cimolacePlatformConfig.productName}</title>
        <meta name="description" content="Politique de confidentialité CIMOLACE." />
      </Helmet>

      <div className="max-w-3xl mx-auto">
        <Link
          to={cimolacePlatformConfig.routes.home}
          className="text-sm text-violet-400 hover:text-violet-300 transition-colors"
        >
          ← Retour à l'accueil
        </Link>

        <h1 className="mt-6 text-3xl md:text-4xl font-black tracking-tight">Politique de confidentialité</h1>
        <p className="mt-4 text-white/70">
          Cette page est un stub. Remplacez ce contenu par votre texte légal (collecte, finalités, base légale,
          conservation, sous-traitants, droits utilisateurs, contact).
        </p>

        <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-6">
          <p className="text-sm text-white/70">
            Contact: <a className="underline" href={`mailto:${cimolacePlatformConfig.contactEmail}`}>{cimolacePlatformConfig.contactEmail}</a>
          </p>
        </div>
      </div>
    </div>
  );
}

