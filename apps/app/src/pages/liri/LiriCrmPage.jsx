import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LiriPortalShell } from '@/components/liri/LiriPortalShell';
import { usePortalTabs, usePortalCrumb } from '@/components/liri/portalHeader';
import AdminMarketingPage from '@/pages/admin/AdminMarketingPage';
import CrmPipelineBoard from '@/components/liri/crm/CrmPipelineBoard';
import CrmContacts from '@/components/liri/crm/CrmContacts';
import CrmCompanies from '@/components/liri/crm/CrmCompanies';
import CrmActivity from '@/components/liri/crm/CrmActivity';
import CrmAnalytics from '@/components/liri/crm/CrmAnalytics';
import CrmSearchPalette from '@/components/liri/crm/CrmSearchPalette';

/**
 * CRM DANS le portail LIRI (rail « CRM », créateur owner/admin).
 *
 * /liri/crm est désormais un HÔTE d'onglets d'en-tête :
 *   - Pipeline   → CrmPipelineBoard (kanban sales-CRM, backend /crm)  ← vue par défaut
 *   - Contacts   → CrmContacts
 *   - Sociétés   → CrmCompanies
 *   - Croissance → AdminMarketingPage (Growth Engine marketing, INCHANGÉ)
 *
 * Les onglets sont poussés dans la TOPBAR via usePortalTabs (règle menus niveau 3 : pas de
 * barre d'onglets dans le corps). L'état de vue est persisté dans `?view=` — volontairement
 * DISTINCT du `?tab=` d'AdminMarketingPage (qui gère ses propres sous-onglets marketing) pour
 * éviter toute collision d'URL. Le shell (chrome + PortalHeaderProvider) est fourni UNE fois ;
 * les corps sont shell-less → pas de double-shell.
 */

const CRM_VIEWS = [
  { value: 'pipeline', label: 'Pipeline' },
  { value: 'dashboard', label: 'Tableau de bord' },
  { value: 'contacts', label: 'Contacts' },
  { value: 'companies', label: 'Sociétés' },
  { value: 'activity', label: 'Activité' },
  { value: 'growth', label: 'Croissance' },
];
const VALID_VIEWS = new Set(CRM_VIEWS.map((v) => v.value));

export default function LiriCrmPage() {
  return (
    <LiriPortalShell active="crm" rail>
      <LiriCrmContent />
    </LiriPortalShell>
  );
}

/** Rendu DANS le shell → le PortalHeaderProvider (topbar) est disponible pour usePortalTabs. */
function LiriCrmContent() {
  const [searchParams, setSearchParams] = useSearchParams();
  const view = useMemo(() => {
    const v = String(searchParams.get('view') || '').toLowerCase();
    return VALID_VIEWS.has(v) ? v : 'pipeline';
  }, [searchParams]);

  const setView = (next) => {
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.set('view', next);
        // Le ?tab= appartient au sous-nav marketing (onglet Croissance). En quittant
        // Croissance, on le retire pour ne pas laisser traîner un onglet marketing
        // périmé dans les liens partagés des vues sales-CRM.
        if (next !== 'growth') p.delete('tab');
        return p;
      },
      { replace: true },
    );
  };

  const activeLabel = CRM_VIEWS.find((v) => v.value === view)?.label ?? 'Pipeline';
  usePortalTabs(CRM_VIEWS, view, setView);
  usePortalCrumb(['CRM', activeLabel]);

  // Palette de recherche globale (Cmd/Ctrl+K), disponible sur toutes les vues CRM.
  const [paletteOpen, setPaletteOpen] = useState(false);
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); setPaletteOpen(true); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  const palette = (
    <CrmSearchPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onPick={(item) => setView(item.view)} />
  );

  // Onglet Croissance : AdminMarketingPage porte SON PROPRE conteneur centré (mx-auto max-w-5xl)
  // → on le rend nu, sans wrapper, pour ne rien casser du Growth Engine.
  if (view === 'growth') return <>{palette}<AdminMarketingPage /></>;

  // Vues sales-CRM : pleine largeur (le kanban a besoin d'espace), padding portail cohérent.
  return (
    <div className="w-full px-4 py-6 sm:px-6 sm:py-8">
      {palette}
      {view === 'pipeline' && <CrmPipelineBoard />}
      {view === 'dashboard' && <CrmAnalytics />}
      {view === 'contacts' && <CrmContacts />}
      {view === 'companies' && <CrmCompanies />}
      {view === 'activity' && <CrmActivity />}
    </div>
  );
}
