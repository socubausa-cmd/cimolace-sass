import React from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useDataSync } from '@/contexts/DataSyncContext';
import { EleveMobileShell } from '@/components/eleve-mobile/EleveMobileShell';
import { VieScolaireSubMenu } from '@/components/eleve-mobile/VieScolaireSubMenu';
import { LiriPageFooterLine } from '@/components/brand/LiriWordmark';
import { useVieScolaireData } from '@/hooks/useVieScolaireData';
import { EV_BG, EV_PAGE_AMBIENT } from './vieScolaireSharedUI.jsx';

/**
 * Hub « Vie scolaire » avec sous-menus (aperçu, calendrier, résultats, annonces). Les rubriques portail
 * sont sur l’onglet « En ligne » de la barre de navigation principale.
 * Route parent : `/m/eleve/vie-scolaire`
 */
export default function EleveVieScolaireLayout() {
  const { user } = useAuth();
  const { notifications: sync } = useDataSync();
  const data = useVieScolaireData(user?.id);
  const inboxUnread = (Array.isArray(sync) ? sync : []).filter((n) => !n.isRead).length;

  return (
    <EleveMobileShell user={user} notificationCount={inboxUnread} contentClassName="!px-0">
      <div
        className="flex w-full min-w-0 flex-1 flex-col"
        style={{
          minHeight: '100dvh',
          backgroundColor: EV_BG,
          backgroundImage: EV_PAGE_AMBIENT,
        }}
      >
        <VieScolaireSubMenu />
        <Outlet context={data} />
        <div className="px-4 pb-2">
          <LiriPageFooterLine className="w-full" marginClass="mt-4 mb-2" suffix="Vie scolaire" />
        </div>
      </div>
    </EleveMobileShell>
  );
}
