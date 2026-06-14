import React from 'react';
import { Link } from 'react-router-dom';
import { getLiriMemberLoginPath } from '@/lib/liriVitrineModel';
import { isnaTenantConfig } from '@/tenants/isna/tenant.config';

export default function AppMemberAccessPage() {
  return (
    <div className="min-h-screen bg-[#060910] text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(212,175,55,0.18),transparent_35%),radial-gradient(circle_at_80%_20%,rgba(59,130,246,0.22),transparent_45%),linear-gradient(180deg,#060910_0%,#060910_100%)]" />
      <div className="relative mx-auto max-w-4xl px-4 py-24 sm:px-6 text-center">
        <p className="text-xs uppercase tracking-[0.22em] text-[var(--school-accent)]">Espace membre — application LIRI</p>
        <h1 className="mt-5 text-4xl sm:text-6xl font-semibold leading-tight">
          Accédez à l'app uniquement en vous connectant
        </h1>
        <p className="mt-5 text-gray-300 max-w-2xl mx-auto">
          <span className="text-white/90">{isnaTenantConfig.branding.name}</span> sur le web, c'est le <strong>portail public</strong> (vitrine, offre, contact).{' '}
          <span className="text-white/90">LIRI</span> est l'<strong>application</strong> qui héberge l\'école : cours, lives, messagerie, outils.{' '}
          Votre connexion membre s'y fait ici.
        </p>
        <div className="mt-9 flex flex-wrap gap-3 justify-center">
          <Link
            to={getLiriMemberLoginPath()}
            className="rounded-xl bg-[var(--school-accent)] px-6 py-3 font-semibold text-black hover:bg-[#e5c04a]"
            title="Ouvrir la connexion LIRI"
          >
            Se connecter à LIRI
          </Link>
          <Link to="/signup" className="rounded-xl border border-white/20 px-6 py-3 hover:bg-white/10">
            Créer un compte
          </Link>
          <Link to="/" className="rounded-xl border border-white/20 px-6 py-3 hover:bg-white/10">
            Retour au portail public
          </Link>
        </div>
      </div>
    </div>
  );
}
