/**
 * Studio — Agent pédagogique LIRI (génération 10 étapes via IA).
 * Route : /studio/liri-agent (montée DANS la coque du portail, cf. StudioRouter).
 *
 * Charte LIRI appliquée à la source (le fond navy #0a0c10 n'était réchauffé que par le
 * remap CSS de studioWarm.css — mieux vaut qu'il soit chaud dans le fichier lui-même).
 *
 * ── POURQUOI LE WORDMARK A DISPARU DE CETTE BARRE ────────────────────────────
 * Deux raisons : (1) la coque du portail affiche déjà la marque dans sa topbar, juste
 * au-dessus — un second logo faisait doublon ; (2) `LiriWordmark` affiche « LIRI » en
 * toutes circonstances, y compris sur le domaine d'un tenant en marque blanche, où la
 * règle est de ne JAMAIS exposer « LIRI » (cf. le commentaire d'en-tête de ProTopBar).
 * Un intitulé de page neutre règle les deux d'un coup.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import LIRIAgent from '@/components/liri/LIRIAgent';
import { proColors } from '@/styles/proTokens';

/* Tokens partagés (déjà à la charte LIRI). Surtout pas `var(--school-accent)` :
   hors de la coque du portail elle vaut encore l'or FROID #d4af37 (index.css). */
const C = {
  base: proColors.surface2,             // #262624
  rail: proColors.surface1,             // #1f1e1c — bandeau
  encre: proColors.textPrimary,
  encreDouce: proColors.textSecondary,
  encreDiscrete: proColors.textMuted,   // plancher 4,5:1 tenu
  ligne: proColors.border,
  corail: proColors.accent,
};

export default function StudioLiriAgentPage() {
  return (
    <div className="min-h-[100dvh]" style={{ background: C.base, color: C.encre }}>
      <div
        className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 backdrop-blur-md"
        style={{
          // Rail sombre légèrement translucide : le `backdrop-blur` doit avoir de quoi flouter.
          background: `color-mix(in srgb, ${C.rail} 95%, transparent)`,
          borderBottom: `1px solid ${C.ligne}`,
        }}
      >
        <Link
          to="/studio"
          className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
          style={{ color: C.encreDouce, border: `1px solid ${C.ligne}` }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = C.corail;
            e.currentTarget.style.borderColor = `color-mix(in srgb, ${C.corail} 40%, transparent)`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = C.encreDouce;
            e.currentTarget.style.borderColor = C.ligne;
          }}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Retour au studio
        </Link>
        <span
          className="text-[10px] uppercase tracking-[0.2em]"
          style={{ color: C.encreDiscrete }}
        >
          Agent pédagogique
        </span>
      </div>
      <div className="mx-auto max-w-5xl px-2 pb-10 pt-4">
        <div
          className="overflow-hidden rounded-xl"
          style={{
            border: `1px solid ${C.ligne}`,
            boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
          }}
        >
          <LIRIAgent />
        </div>
      </div>
    </div>
  );
}
