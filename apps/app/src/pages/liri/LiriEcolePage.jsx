/**
 * LiriEcolePage — Module ÉCOLE complet DANS le portail LIRI (`/liri/ecole`).
 *
 * Embarque la TOTALITÉ du back-office école (6 familles / ~24 onglets) DANS le shell du
 * portail LIRI (`LiriPortalShell`) → on ne retombe plus jamais sur le vieux shell séparé.
 *
 * - SHELL = `LiriPortalShell` (rail Accueil/Lives/Forum/Studio/École/Biblio/Brain).
 * - FIL D'ARIANE = poussé dans l'en-tête du portail (« École › <section> »).
 * - SOUS-NAV = sous-rail des familles (SOURCE UNIQUE `buildOwnerMenuGroups`).
 * - CONTENU = `OwnerDashboardBody` (switch réutilisé), basePath `/liri/ecole`.
 * - THÈME = sombre chaud (tokens `--lt-*` remappés terracotta).
 * - GATE = visible si un moteur école est actif (tenant_services), fail-open.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import { LiriPortalShell } from '@/components/liri/LiriPortalShell';
import { usePortalCrumb } from '@/components/liri/portalHeader';
import { OwnerDashboardBody } from '@/pages/OwnerDashboard';
import { buildOwnerMenuGroups } from '@/components/owner/ownerMenuGroups';
import { useResolvedTenantSlug } from '@/hooks/useResolvedTenantSlug';
import { SslThemeProvider } from '@/pages/school/student-school-life/sslTheme';
import ErrorBoundary from '@/components/ErrorBoundary';
import { catalogApi } from '@/lib/api-v2';

const ECOLE_BASE = '/liri/ecole';

// Surfaces back-office : tokens `--lt-*` remappés en SOMBRE CHAUD (palette portail).
const ECOLE_THEME_VARS = {
  '--lt-text': '#f5f1e9',
  '--lt-sub': 'rgba(245,241,233,0.60)',
  '--lt-muted': 'rgba(245,241,233,0.42)',
  '--lt-border': 'rgba(245,241,233,0.10)',
  '--lt-card-bg': '#211e1a',
  '--lt-card-border': 'rgba(245,241,233,0.08)',
  '--lt-card-shadow': '0 10px 30px -16px rgba(0,0,0,0.6)',
  '--lt-inner-bg': '#191512',
  '--lt-gold': '#d97757',
  '--lt-gold-ink': '#e58a5f',
  '--school-accent': '#d97757',
  '--school-accent-rgb': '217 119 87',
};

// HARMONISATION CHROMATIQUE : les surfaces back-office gardent l'ancien thème « premium »
// ISNA (navy #121a25/#192734 + violet + or) → on le REMAPPE en chaud, scopé .ecole-warm-scope.
// Sélecteurs [class*="…"] = robustes à l'opacité (bg-[#121A25]/70 etc.) ; + variables CSS
// premium + classes globales .premium-*. On préserve vert/rouge (sémantique succès/danger).
const ECOLE_WARM_CSS = `
.ecole-warm-scope {
  --premium-surface: #1d1916;
  --premium-surface-2: #221f1b;
  --bg-navy: #1d1916;
  --liri-gold: #d6953f;
  --primary-gold: #d6953f;
}
.ecole-warm-scope .premium-panel,
.ecole-warm-scope .premium-card { background: #1d1916 !important; border-color: rgba(245,241,233,0.10) !important; }
#root .ecole-warm-scope .premium-dashboard-shell { background-image: none !important; padding: 0 !important; min-height: 0 !important; }
.ecole-warm-scope [class*="bg-[#0F1419]"],
.ecole-warm-scope [class*="bg-[#121A25]"],
.ecole-warm-scope [class*="bg-[#121a25]"],
.ecole-warm-scope [class*="bg-[#192734]"],
.ecole-warm-scope [class*="bg-[#16202A]"] { background-color: #1d1916 !important; }
.ecole-warm-scope [class*="border-[#192734]"],
.ecole-warm-scope [class*="border-[#121A25]"] { border-color: rgba(245,241,233,0.10) !important; }
/* DIRECTIVE ARTISTIQUE (réf. Rapports & Analytique) : tableaux DISCRETS, pas de boîte-dans-
   la-boîte. Une surface sombre IMBRIQUÉE dans une autre → transparente (le tableau respire
   sur une seule carte, comme Rapports). En-têtes de tableau aussi → transparents. */
.ecole-warm-scope [class*="bg-[#121A25]"] [class*="bg-[#121A25]"],
.ecole-warm-scope [class*="bg-[#121A25]"] [class*="bg-[#0F1419]"],
.ecole-warm-scope [class*="bg-[#0F1419]"] [class*="bg-[#121A25]"],
.ecole-warm-scope [class*="bg-[#0F1419]"] [class*="bg-[#0F1419]"],
.ecole-warm-scope .premium-panel [class*="bg-[#0F1419]"],
.ecole-warm-scope .premium-panel [class*="bg-[#121A25]"],
.ecole-warm-scope .premium-panel [class*="bg-[#192734]"],
.ecole-warm-scope .premium-panel .premium-panel,
.ecole-warm-scope [class*="bg-[#121A25]"] thead,
.ecole-warm-scope [class*="bg-[#0F1419]"] thead,
.ecole-warm-scope .premium-panel thead { background-color: transparent !important; }
.ecole-warm-scope [class*="from-[#192734]"],
.ecole-warm-scope [class*="from-[#0F1419]"],
.ecole-warm-scope [class*="from-[#121A25]"] { --tw-gradient-from: #221f1b var(--tw-gradient-from-position) !important; }
.ecole-warm-scope [class*="to-[#0F1419]"],
.ecole-warm-scope [class*="to-[#121A25]"] { --tw-gradient-to: #191512 var(--tw-gradient-to-position) !important; }
.ecole-warm-scope [class*="bg-[#b5952f]"],
.ecole-warm-scope [class*="bg-[#c4a030]"],
.ecole-warm-scope [class*="bg-[#9a7b1f]"],
.ecole-warm-scope [class*="bg-[#D4AF37]"] { background-color: #c8893f !important; }
.ecole-warm-scope [class*="text-[#b5952f]"],
.ecole-warm-scope [class*="text-[#f0d98a]"],
.ecole-warm-scope [class*="text-[#c4a030]"] { color: #e6b066 !important; }
.ecole-warm-scope [class*="from-[#e8c45a]"],
.ecole-warm-scope [class*="from-[#f0d98a]"] { --tw-gradient-from: #e0a86a var(--tw-gradient-from-position) !important; }
.ecole-warm-scope [class*="to-[#e8c45a]"],
.ecole-warm-scope [class*="to-[#f0d98a]"] { --tw-gradient-to: #c8893f var(--tw-gradient-to-position) !important; }
.ecole-warm-scope [class*="bg-[#7C3AED]"],
.ecole-warm-scope [class*="bg-[#0EA5E9]"],
.ecole-warm-scope [class*="bg-[#3B82F6]"] { background-color: #d97757 !important; }
.ecole-warm-scope [class*="text-[#7C3AED]"],
.ecole-warm-scope [class*="text-[#0EA5E9]"] { color: #e58a5f !important; }
`;

const ECOLE_SERVICE_KEYS = ['course_builder', 'school', 'school_module', 'formations'];

export default function LiriEcolePage() {
  return (
    <LiriPortalShell active="ecole">
      <EcoleBody />
    </LiriPortalShell>
  );
}

// Rendu DANS le shell (sous le Provider d'en-tête) → peut pousser le fil d'Ariane.
function EcoleBody() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { slug: payoutTenantSlug } = useResolvedTenantSlug();
  const activeTab = searchParams.get('tab') || 'dashboard';
  const [ecoleActive, setEcoleActive] = useState(null); // null=inconnu (affiché), false=non activé

  const menuGroups = buildOwnerMenuGroups(payoutTenantSlug, ECOLE_BASE);
  const allItems = menuGroups.flatMap((g) => g.items);
  const activeLabel = allItems.find((i) => i.id === activeTab)?.label || "Vue d'ensemble";

  // Fil d'Ariane « École › <section> » dans l'en-tête du portail.
  usePortalCrumb(['École', activeLabel]);

  // GATE : l'École s'affiche si un moteur école est actif (tenant_services). Fail-open.
  useEffect(() => {
    let alive = true;
    catalogApi.getTenantServices()
      .then((svc) => {
        const ok = Array.isArray(svc) && svc.some((s) => s?.active && ECOLE_SERVICE_KEYS.includes(s?.service_key));
        if (alive) setEcoleActive(ok);
      })
      .catch(() => { if (alive) setEcoleActive(true); });
    return () => { alive = false; };
  }, []);

  // Sélection d'un item du sous-rail : href → navigation directe ; sinon → onglet (?tab=).
  const selectItem = (item) => {
    // « Communication » = le forum du portail (onglet Forum du rail) → un seul forum, pas de doublon.
    if (item.id === 'forum') { navigate('/liri/forum'); return; }
    if (item.href) {
      if (/^https?:\/\//.test(item.href)) window.location.assign(item.href);
      else navigate(item.href);
      return;
    }
    navigate(`${ECOLE_BASE}?tab=${item.id}`);
  };

  // Moteur école NON activé → état d'activation (au lieu d'enfermer).
  if (ecoleActive === false) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl text-white lp-ember"><GraduationCap size={26} /></span>
        <h2 className="text-[18px] font-semibold lp-ink">L'École n'est pas activée</h2>
        <p className="max-w-md text-[13px] lp-muted">
          Active le moteur École pour gérer formations, calendrier, élèves, coaching,
          certificats et finances directement depuis LIRI — sans site web.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0" style={ECOLE_THEME_VARS}>
      <style>{ECOLE_WARM_CSS}</style>

      {/* Sous-rail École — les 6 familles (source unique partagée avec le back-office) */}
      <aside className="hidden md:flex w-[212px] shrink-0 flex-col overflow-y-auto border-r lp-line py-3">
        {menuGroups.map((group) => (
          <div key={group.section} className="px-2 pb-1.5 pt-3 first:pt-1">
            <p className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-stone-500">{group.section}</p>
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = !item.href && item.id === activeTab;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectItem(item)}
                  className={`group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] transition-colors ${
                    isActive
                      ? 'font-semibold text-[var(--school-accent)]'
                      : 'text-stone-300 hover:bg-white/[0.04] hover:text-white'
                  }`}
                  style={isActive ? { background: 'color-mix(in srgb, var(--school-accent) 16%, transparent)' } : undefined}
                >
                  <Icon size={16} className="shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </aside>

      {/* Contenu — back-office complet réutilisé, sombre chaud, scopé pour le calendrier */}
      <div className="ecole-warm-scope min-h-0 flex-1 overflow-auto">
        <ErrorBoundary key={activeTab} logTag={`LIRI École · ${activeTab}`}>
          <SslThemeProvider mode="dark">
            <div className="p-4">
              <OwnerDashboardBody activeTab={activeTab} basePath={ECOLE_BASE} />
            </div>
          </SslThemeProvider>
        </ErrorBoundary>
      </div>
    </div>
  );
}
