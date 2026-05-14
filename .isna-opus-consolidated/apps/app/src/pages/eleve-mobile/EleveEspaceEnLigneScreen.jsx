import React from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useDataSync } from '@/contexts/DataSyncContext';
import { EleveMobileShell } from '@/components/eleve-mobile/EleveMobileShell';
import { VieScolaireWebParityMenu } from '@/components/eleve-mobile/VieScolaireWebParityMenu';
import { LiriPageFooterLine } from '@/components/brand/LiriWordmark';
import { EV_BG, EV_MUTED, EV_PAGE_AMBIENT, EV_R, listCardSurface } from '@/pages/eleve-mobile/vieScolaire/vieScolaireSharedUI.jsx';

/**
 * Rubriques du portail étudiant (même entrées que le menu web) — accessible depuis la barre d’onglets,
 * indépendamment de l’écran « Vie scolaire ».
 * Route : `/m/eleve/en-ligne`
 */
export default function EleveEspaceEnLigneScreen() {
  const { user } = useAuth();
  const { notifications: sync } = useDataSync();
  const inboxUnread = (Array.isArray(sync) ? sync : []).filter((n) => !n.isRead).length;

  return (
    <EleveMobileShell user={user} notificationCount={inboxUnread} contentClassName="!px-0">
      <div
        className="flex w-full min-w-0 flex-1 flex-col pb-2"
        style={{
          minHeight: '100dvh',
          backgroundColor: EV_BG,
          backgroundImage: EV_PAGE_AMBIENT,
        }}
      >
        <div className="px-4 pb-1 pt-0.5">
          <div
            className="mb-3 p-3.5"
            style={{ borderRadius: EV_R.lg, ...listCardSurface() }}
          >
            <p className="text-[9px] font-extrabold uppercase tracking-wider text-violet-300/90">Espace en ligne</p>
            <p className="mt-1.5 text-[12.5px] font-medium leading-relaxed" style={{ color: EV_MUTED }}>
              Navigue entre les rubriques du portail étudiant (même menu que le site). Chaque carte ouvre la page
              correspondante.
            </p>
          </div>
        </div>
        <VieScolaireWebParityMenu />
        <div className="px-4">
          <LiriPageFooterLine className="w-full" marginClass="mt-4 mb-2" suffix="Espace en ligne" />
        </div>
      </div>
    </EleveMobileShell>
  );
}
