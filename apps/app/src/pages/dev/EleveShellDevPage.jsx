import React from 'react';
import { EleveMobileShell } from '@/components/eleve-mobile/EleveMobileShell';
import { LiriPageFooterLine } from '@/components/brand/LiriWordmark';
import { EV_MUTED, EV_PAGE_AMBIENT } from '@/pages/eleve-mobile/eleveMobileScreensShared';

/**
 * Coque LIRI élève « vide » — même header d'accueil (logo + tagline) + zone centrale + onglets bas.
 * Ouvrir : /dev/eleve-shell (dev uniquement).
 */
export default function EleveShellDevPage() {
  return (
    <EleveMobileShell user={null} notificationCount={0} contentClassName="!px-0">
      <div
        className="flex min-h-[min(64dvh,28rem)] flex-col items-center justify-center px-6 py-8 text-center"
        style={{
          backgroundColor: '#0B0B0F',
          backgroundImage: EV_PAGE_AMBIENT,
        }}
      >
        <p className="text-[15px] font-semibold text-white/90">Zone de contenu vide</p>
        <p className="mt-2 max-w-xs text-[13px] leading-relaxed" style={{ color: EV_MUTED }}>
          Prévisualisation de la coque (développement). Header LIRI et barre d'onglets inchangés.
        </p>
        <LiriPageFooterLine marginClass="mt-6" suffix="Prévisualisation" />
      </div>
    </EleveMobileShell>
  );
}
