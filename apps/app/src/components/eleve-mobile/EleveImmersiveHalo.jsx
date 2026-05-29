import React from 'react';
import { cn } from '@/lib/utils';
import {
  EV_BG,
  evHaloAtmosphere,
  EV_HALO_INSET_SPECULAR,
  EV_HALO_NOISE,
} from '@/pages/eleve-mobile/eleveMobileScreensShared';

/**
 * Fond d'atmosphère type Apple : halos en couches, grain fin, bords (specular + vignette).
 * Positionné en `absolute inset-0` derrière le contenu (`-z-10` sur l'enveloppe).
 */
export function EleveImmersiveHalo({ base = EV_BG, className }) {
  return (
    <div
      className={cn('pointer-events-none absolute inset-0 -z-10 overflow-hidden', className)}
      aria-hidden
    >
      {/* Atmosphère — bloom haut, flancs bleu/violet, puits bas */}
      <div
        className="absolute inset-0"
        style={{
          background: evHaloAtmosphere(base),
        }}
      />
      {/* Grain de surface (niveau 2–3 %, style « film ») */}
      <div
        className="absolute inset-0 mix-blend-overlay opacity-[0.28] [mask-image:linear-gradient(180deg,black_0%,black_40%,rgba(0,0,0,0.3)_100%)]"
        style={EV_HALO_NOISE}
      />
      {/* Bord haut légèrement « éclairé » (feuille d'iPhone sombre) */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.07) 0%, transparent 12%)',
        }}
      />
      {/* Vignette + sillon intérieur premium */}
      <div
        className="absolute inset-0"
        style={{
          ...EV_HALO_INSET_SPECULAR,
        }}
      />
    </div>
  );
}
