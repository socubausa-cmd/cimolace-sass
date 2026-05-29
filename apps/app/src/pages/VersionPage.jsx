import React from 'react';
import { Link } from 'react-router-dom';
import { AppVersionContent } from '@/components/version/AppVersionContent';

/**
 * Page web publique d'info build — miroir de contenu avec `/m/eleve/version`.
 */
export default function VersionPage() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#0B0B0F] px-4 py-12 text-white">
      <div
        className="pointer-events-none fixed inset-0 opacity-80"
        style={{
          background:
            'radial-gradient(50% 32% at 50% 0%, rgba(123, 97, 255, 0.12), transparent 70%)',
        }}
        aria-hidden
      />
      <div className="relative z-10 flex w-full max-w-2xl flex-col items-center">
        <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
          Diagnostic
        </p>
        <h1 className="mb-8 text-center font-serif text-2xl font-bold text-white sm:text-3xl">Version</h1>
        <AppVersionContent variant="web" />
        <Link
          to="/"
          className="relative z-10 mt-10 text-sm text-white/50 transition hover:text-white/80"
        >
          Retour accueil
        </Link>
      </div>
    </div>
  );
}
